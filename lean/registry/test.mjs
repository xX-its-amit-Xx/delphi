#!/usr/bin/env node
// Tests for the law registry. Every check runs twice: on the real input (must pass) and on a deliberately broken
// input (must FAIL), so no check can pass vacuously ("make each fail once"). Exit code 1 on any problem.
//   node lean/registry/test.mjs            # REGISTRY_TEST_FAST=1 skips the two Lean proposal runs (about 2 min)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { REG, ROOT, LAWS_DIR, readJson, loadLaws, listLawsets, loadLawset, contentHash, statementText, validate, sha256, scratchDir, loadLawVersion } from './registry-lib.mjs';
import { releaseProblems, lawsetsKnownToChecker } from './release.mjs';
import { propose } from './propose.mjs';

let failures = 0;
const results = [];
function check(name, realFn, brokenFn) {
  let real, broken;
  try { real = realFn(); } catch (e) { real = [String(e.message || e)]; }
  try { broken = brokenFn(); } catch (e) { broken = [String(e.message || e)]; }
  const realOk = Array.isArray(real) ? real.length === 0 : !!real;
  const brokenCaught = Array.isArray(broken) ? broken.length > 0 : !broken;
  const ok = realOk && brokenCaught;
  if (!ok) failures++;
  results.push({ name, ok, real: realOk ? 'pass' : real, brokenCaught: brokenCaught ? 'fails as it must' : 'DID NOT FAIL on broken input' });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${realOk ? '' : '\n     real input: ' + JSON.stringify(real).slice(0, 600)}${brokenCaught ? '' : '\n     broken input was NOT caught'}`);
}
async function checkAsync(name, realFn, brokenFn) {
  let real, broken;
  try { real = await realFn(); } catch (e) { real = [String(e.stack || e)]; }
  try { broken = await brokenFn(); } catch (e) { broken = [String(e.stack || e)]; }
  check(name, () => real, () => broken);
}
const clone = x => JSON.parse(JSON.stringify(x));
const laws = loadLaws();
const schema = readJson(path.join(REG, 'laws-registry.schema.json'));

// 1. schema
const schemaErrs = ls => ls.flatMap(l => validate(schema, l).map(e => `${l.law_id}: ${e}`));
check('schema: every law file validates', () => schemaErrs(laws), () => { const b = clone(laws); b[0].kind = 'chemical'; b[1].status = 'accepted'; b[1].approval = { approved_by_role: 'someone@example.org', date: 'x', basis: 'x' }; return schemaErrs(b); });

// 2. content hashes
// lean_ref.content_hash is a convenience mirror of content_hash for the loader; a law with no Lean module may
// leave it null, so require null-or-equal rather than equal.
const hashErrs = ls => ls.flatMap(l => [contentHash(l) !== l.content_hash ? `${l.law_id}: content_hash does not match its hashed fields` : null, l.lean_ref.content_hash != null && l.lean_ref.content_hash !== l.content_hash ? `${l.law_id}: lean_ref.content_hash is set but differs from content_hash` : null].filter(Boolean));
check('hashes: content_hash matches the hashed fields', () => hashErrs(laws), () => { const b = clone(laws); b[3].statement_en += ' (edited without a version bump)'; return hashErrs(b); });

// 3. statement drift against the Lean source now on disk
const driftErrs = (ls, readSrc) => ls.filter(l => l.lean_ref.module && l.lean_ref.statement_sha256).flatMap(l => {
  const p = path.join(ROOT, l.lean_ref.module); if (!fs.existsSync(p)) return [`${l.law_id}: module ${l.lean_ref.module} missing`];
  const t = statementText(readSrc(p), l.lean_ref.structure || l.lean_ref.theorem);
  return t && sha256(t) === l.lean_ref.statement_sha256 ? [] : [`${l.law_id}: statement of ${l.lean_ref.structure || l.lean_ref.theorem} changed in ${l.lean_ref.module} (bump the law's version)`];
});
check('pins: each statement_sha256 matches the statement in its module', () => driftErrs(laws, p => fs.readFileSync(p, 'utf8')),
  () => driftErrs(laws.filter(l => l.law_id === 'E2'), p => fs.readFileSync(p, 'utf8').replace('hi : b ≤ (3.02 : ℝ)', 'hi : b ≤ (3.05 : ℝ)')));

// 4. law-set reproducibility: every law each law set pins exists AT THE PINNED VERSION (current file or archived
// snapshot in law-versions/) with the pinned hash; nothing is deleted
const lawsetErrs = (sets, ls, loadAt = loadLawVersion) => {
  const ids = new Set(ls.map(l => l.law_id)); const e = [];
  for (const s of sets) for (const p of s.laws) {
    if (!ids.has(p.law_id)) { e.push(`${s.version}: ${p.law_id} deleted (laws are never deleted)`); continue; }
    const l = loadAt(p.law_id, p.version);
    if (!l) e.push(`${s.version}: ${p.law_id}@${p.version} missing (superseded versions must be archived in law-versions/)`);
    else if (contentHash(l) !== p.content_hash) e.push(`${s.version}: ${p.law_id}@${p.version} hash differs from the pin; the law set is no longer reproducible`);
  }
  return e;
};
const sets = listLawsets().map(v => loadLawset(v));
check(`lawsets: ${sets.map(s => s.version).join(', ')} reproducible from the law files`, () => lawsetErrs(sets, laws),
  () => { const b = clone(sets); b[0].laws[0].content_hash = '0'.repeat(64); return lawsetErrs(b, laws.filter(l => l.law_id !== 'E5'), (id, v) => id === 'perturb-pressure' && v === '1.0.0' ? null : loadLawVersion(id, v)); });
const cur = readJson(path.join(REG, 'lawsets/current.json'));
// The release-order rule: the GENERATED checker must know the version current.json names. When current.json was
// bumped to 1.6.0 while lean/eliminate/browser-check.mjs still knew only up to 1.5.0, every checkDesign threw
// "unknown law set 1.6.0" and the studio, the scorer and the examples broke mid-release. release.mjs now refuses to
// move current.json until the regenerated checker knows the version, judgeRows fails soft, and this is the check.
const knownToChecker = () => {
  const known = lawsetsKnownToChecker();
  if (known === null) return ['could not read LAWSETS out of lean/eliminate/browser-check.mjs'];
  return known.includes(cur.version) ? [] : [`lawsets/current.json names ${cur.version}, which the generated lean/eliminate/browser-check.mjs does not know (it knows ${known.join(', ')}): run node lean/eliminate/build-browser-check.mjs`];
};
check('release order: the generated browser-check knows the law set current.json names', knownToChecker,
  () => { const known = lawsetsKnownToChecker() || []; const fake = '99.0.0'; return known.includes(fake) ? [] : [`current.json naming ${fake} would be caught: the checker knows ${known.join(', ')}`]; });

check('lawsets: current.json names an existing law set', () => sets.some(s => s.version === cur.version) ? [] : ['missing'], () => sets.some(s => s.version === '9.9.9') ? [] : ['missing']);

// 5. approval rule: accepted needs a human approval by ROLE
const approvalErrs = ls => releaseProblems(ls).filter(p => /approv|role/.test(p));
check('approval: accepted laws carry approved_by_role (a role, not a person)', () => approvalErrs(laws),
  () => { const b = clone(laws.filter(l => l.status === 'candidate')).slice(0, 2); b[0].status = 'accepted'; b[1].status = 'accepted'; b[1].approval = { approved_by_role: 'Jane Doe', date: 'x', basis: 'x' }; return approvalErrs(b); });

// 6. browser-check: law-set aware, scope gives 'out-of-scope', no accepted law red on an unedited wild type
async function loadChecker() {
  const real = path.join(ROOT, 'lean/eliminate/browser-check.mjs');
  const m = await import(pathToFileURL(real).href + '?t=' + Date.now());
  if (m.LAWSET_VERSION) return { m, where: 'lean/eliminate/browser-check.mjs' };
  // The generated file predates the registry change (it is regenerated by `node lean/eliminate/build-browser-check.mjs`,
  // which needs lean/constraints.json to hold every constraint the generator uses). Build a mirror in scratch instead,
  // with any constraint missing from constraints.json dropped, so the registry logic is still exercised.
  const S = scratchDir('bc-mirror');
  const cp = (rel) => { const d = path.join(S, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.cpSync(path.join(ROOT, rel), d, { recursive: true }); };
  for (const rel of ['lean/eliminate', 'lean/genotype/code.mjs', 'lean/genotype/gene-nodes.json', 'lean/genotype/dev-certificate.json', 'lean/constraints.json', 'lean/empirical.json', 'lean/perturb-sources.json', 'physics/glide-data.csv', 'conditions/baseline.json', 'lean/registry/laws', 'lean/registry/lawsets']) if (fs.existsSync(path.join(ROOT, rel))) cp(rel);
  const ids = new Set(readJson(path.join(ROOT, 'lean/constraints.json')).constraints.map(c => c.id));
  const gen = path.join(S, 'lean/eliminate/build-browser-check.mjs');
  fs.writeFileSync(gen, fs.readFileSync(gen, 'utf8').replace(/const USED = \[([^\]]*)\];/, (_, xs) => `const USED = [${xs.split(',').map(s => s.trim()).filter(s => ids.has(s.replace(/'/g, ''))).join(', ')}];`));
  const r = spawnSync(process.execPath, [gen], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('mirror build failed: ' + r.stderr);
  const mm = await import(pathToFileURL(path.join(S, 'lean/eliminate/browser-check.mjs')).href);
  return { m: mm, where: `scratch mirror (${S}); the repo's browser-check.mjs has not been regenerated yet` };
}
const { m: BC, where } = await loadChecker();
console.log(`     checker: ${where}, LAWSET_VERSION ${BC.LAWSET_VERSION}`);
const wildTypes = ['flying-fish', 'zebrafish-adult', 'zebrafish-larva'].map(id => {
  const d = readJson(path.join(ROOT, `anatomy-model/parametric/resolved/${id}.json`)); const p = d.parameters;
  const taxon = /Danio rerio/.test(d.name) ? 'Danio rerio' : /Exocoetidae/.test(d.name) ? 'Exocoetidae' : null;
  const life_stage = /larva/.test(d.name) ? 'larva' : 'adult';
  return { id, design: { taxon, life_stage, SL_m: p.standard_length_m, mass_kg: p.body_mass_kg, fin_area_m2: p.pectoral_area_over_SL2 * p.standard_length_m ** 2, fin_length_over_SL: p.pectoral_len_over_SL } };
});
const acceptedRed = rows => rows.filter(r => r.law && r.law.status === 'accepted' && r.verdict === 'violated').map(r => r.id);
check('scope sanity: no ACCEPTED law is red for an unedited measured wild type within its scope (flying fish, zebrafish adult, zebrafish larva)',
  () => wildTypes.flatMap(w => acceptedRed(BC.check(w.design)).map(id => `${w.id}: ${id}`)),
  // broken: the same designs judged WITHOUT scope (formula verdicts) do turn accepted laws red, which is the defect
  () => wildTypes.flatMap(w => BC.checkRaw(w.design).filter(r => r.verdict === 'violated' && BC.CONSTRAINT_LAW[r.id] && BC.LAWSETS[BC.LAWSET_VERSION].laws[BC.CONSTRAINT_LAW[r.id]].status === 'accepted').map(r => `${w.id}: ${r.id}`)));
// STANDING CHECK (hub, 2026-11-01): no ACCEPTED law may be violated by a real organism making a REALISTIC claim
// within that law's scope. A law that a measured wild type breaks is wrong, or is being applied outside its scope;
// either way it must not be accepted-and-red. This caught the class of error it is meant to catch: E3 and C14 fired
// on Park and Choi flying fish making ordinary glide claims, because a glide had been turned into a level-powered-
// flight power requirement. Fixtures use SOURCED numbers only (the checker's REFERENCE specimen, which comes from
// physics/glide-data.csv, and anatomy-model/parametric/resolved/*.json); design-committed inputs are marked.
const REF = BC.REFERENCE;
const o = id => readJson(path.join(ROOT, `anatomy-model/parametric/resolved/${id}.json`)).parameters;
const zfa = o('zebrafish-adult'), zfl = o('zebrafish-larva');
// Every Cypselurus hiraii specimen Park and Choi measured, not just the one the checker uses as its reference.
// The sibling specimens are why this check exists: their length ratios sit within 1 to 3 percent of the reference,
// which is exactly where an implied exponent is near-singular.
const glideCsv = fs.readFileSync(path.join(ROOT, 'physics/glide-data.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
const glideHead = glideCsv[0].split(',');
const glideRows = glideCsv.slice(1).map(l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return Object.fromEntries(glideHead.map((h, i) => [h, c[i] ?? ''])); })
  .filter(r => r.species === 'Cypselurus hiraii' && r.row_kind === 'specimen');
const SPECIMENS = glideRows.map(r => {
  const area = +r.pectoral_fin_area_m2 + (+r.pelvic_fin_area_m2 || 0) + (+r.body_planform_area_m2 || 0);
  const winged = +r.pectoral_fin_area_m2 > 0;   // models M and N have fins folded; N is body only
  const base = { taxon: 'Cypselurus hiraii', life_stage: 'adult', SL_m: +r.body_length_m, mass_kg: +r.body_mass_kg, fin_area_m2: area };
  return { id: `park-choi-${r.source_locator.replace(/[^A-Za-z0-9]+/g, '-')}`,
    note: `${r.source_locator}: measured morphometry, length ratio ${(+r.body_length_m / BC.REFERENCE.SL_m).toFixed(4)} against the checker's reference specimen` + (winged ? ', in an ordinary unpowered glide' : '; fins folded in this model, so no flight claim is attributed to it'),
    design: winged
      ? { ...base, CLmax: BC.REFERENCE.CLmax, LD_max: BC.REFERENCE.LD_max, airspeed_m_s: 12, flight_mode: 'glide', glideHeight_m: 8, glide_distance_m: 30,
          efficiency: 0.15, oxycaloric_J_per_unit_O2: 19.34, cardiacOutput: 0.0656, arterialO2: 0.187 }
      : base };
});
const FIXTURES = [
  ...SPECIMENS,
  { id: 'flying-fish-glide', note: 'Park and Choi 2010 model L3 in an ordinary unpowered glide: 8 m launch height (deng-2019), 30 m over the ground, inside the L/D 4.37 bound of 34.96 m, at 12 m/s (field range 10 to 20 m/s)',
    design: { taxon: 'Cypselurus hiraii', life_stage: 'adult', SL_m: REF.SL_m, mass_kg: REF.mass_kg, fin_area_m2: REF.liftingArea_m2, CLmax: REF.CLmax, LD_max: REF.LD_max,
      airspeed_m_s: 12, flight_mode: 'glide', glideHeight_m: 8, glide_distance_m: 30,
      efficiency: 0.15, oxycaloric_J_per_unit_O2: 19.34, cardiacOutput: 0.0656, arterialO2: 0.187 } },
  { id: 'zebrafish-adult', note: 'the unedited adult zebrafish as resolved, no locomotion claim',
    design: { taxon: 'Danio rerio', life_stage: 'adult', SL_m: zfa.standard_length_m, mass_kg: zfa.body_mass_kg, fin_area_m2: zfa.pectoral_area_over_SL2 * zfa.standard_length_m ** 2, fin_length_over_SL: zfa.pectoral_len_over_SL } },
  { id: 'zebrafish-adult-swimming', note: 'the same fish holding station in a current below the U_crit it commits to (both design inputs, not claims about reality)',
    design: { taxon: 'Danio rerio', life_stage: 'adult', SL_m: zfa.standard_length_m, mass_kg: zfa.body_mass_kg, current_speed_m_s: 0.1, critical_swimming_speed_m_s: 0.2 } },
  { id: 'zebrafish-larva', note: 'the unedited 5 dpf larva as resolved',
    design: { taxon: 'Danio rerio', life_stage: 'larva', SL_m: zfl.standard_length_m, mass_kg: zfl.body_mass_kg, fin_area_m2: zfl.pectoral_area_over_SL2 * zfl.standard_length_m ** 2 } },
];
const acceptedRedIn = rows => rows.filter(r => r.law && r.law.status === 'accepted' && r.verdict === 'violated')
  .map(r => `${r.id} (${r.law.law_id}@${r.law.version}): ${JSON.stringify(r.numbers).slice(0, 160)}`);
const standingErrs = (fixtures = FIXTURES) => fixtures.flatMap(f => acceptedRedIn(BC.check(f.design)).map(x => `${f.id}: ${x}`));
check(`standing: no accepted law is violated by any of the ${FIXTURES.length} real organisms making realistic claims (${SPECIMENS.length} measured Park and Choi specimens, the reference glide, 2 zebrafish states and a swimming claim; law set ${BC.LAWSET_VERSION})`,
  () => standingErrs(),
  // The broken input is the defect this guards against: the SAME realistic glide mapped as a sustained powered
  // demand. The aerobic laws then fire (the flying fish cannot power level flight, a real finding), so the check
  // must report it rather than pass.
  () => standingErrs([{ id: 'flying-fish-glide-mismapped-as-powered', design: { ...FIXTURES[0].design, flight_mode: 'powered' } }]));

// scope_check is authoritative for BOTH kinds of out-of-scope: 'organism' (taxon, life stage, range) and
// 'claim-kind' (the caller asked the wrong law, e.g. an unpowered glide against an aerobic bound). A consumer must
// not have to fall back to `note` to learn why, and the claim-kind row carries the law's excludes.
const kindErrs = rows => {
  const e = [];
  for (const r of rows.filter(x => x.verdict === 'out-of-scope')) {
    const sc = r.scope_check;
    if (!sc || sc.in_scope !== false) e.push(`${r.id}: out-of-scope with no scope_check`);
    else if (!['organism', 'claim-kind'].includes(sc.kind)) e.push(`${r.id}: scope_check.kind is ${sc.kind}`);
    else if (!sc.reason) e.push(`${r.id}: scope_check carries no reason`);
    else if (sc.kind === 'claim-kind' && !(sc.scope.excludes || []).length) e.push(`${r.id}: claim-kind row carries no excludes`);
  }
  return e;
};
check("scope_check explains every out-of-scope row, with kind 'organism' or 'claim-kind'",
  () => kindErrs([...BC.check(FIXTURES[0].design), ...BC.check(FIXTURES[1].design)]),
  () => kindErrs([{ id: 'fake', verdict: 'out-of-scope', scope_check: null }]));

const zf = BC.check(wildTypes[1].design);
const zfScoped = ['C7b', 'C2a', 'C8e', 'E2'].map(id => zf.find(r => r.id === id)).filter(Boolean);
check('scope: C7b, C2a, C8e, E2 are out-of-scope (grey) for the unedited adult zebrafish',
  () => zfScoped.filter(r => !(r.verdict === 'out-of-scope' || r.verdict === 'cannot-evaluate') || r.display === 'red').map(r => `${r.id}: ${r.verdict}`).concat(zfScoped.length ? [] : ['rows missing']),
  () => zfScoped.filter(r => r.computed_verdict === 'violated').map(r => `${r.id} would be red without scope`)); // the formula alone violates them
// status semantics on synthetic rows
const lid = Object.keys(BC.LAW_INFO).find(k => !(BC.LAW_INFO[k].scope.taxa || []).some(t => t !== 'any') && Object.keys(BC.LAW_INFO[k].constraint_scopes).length === 0);
const cid = Object.entries(BC.CONSTRAINT_LAW).find(([, v]) => v === lid)[0];
const judgeAs = (status, opts = {}) => { const ls = clone(BC.LAWSETS[BC.LAWSET_VERSION]); ls.laws[lid].status = status; const save = BC.LAWSETS[BC.LAWSET_VERSION]; BC.LAWSETS['0.0.0-test'] = ls; const r = BC.judgeRows([{ id: cid, verdict: 'violated' }], {}, {}, { lawset: '0.0.0-test', ...opts })[0]; delete BC.LAWSETS['0.0.0-test']; return r; };
check(`status: accepted red, candidate not red (flagged), candidate red with includeCandidates, contested amber, retired not judged (law ${lid}, constraint ${cid})`,
  () => [judgeAs('accepted').display === 'red' || 'accepted', judgeAs('candidate').verdict === 'candidate-violated' || 'candidate', judgeAs('candidate', { includeCandidates: true }).display === 'red' || 'candidate+include', judgeAs('contested').display === 'amber' || 'contested', judgeAs('retired').verdict === 'not-in-lawset' || 'retired'].filter(x => x !== true),
  () => [judgeAs('contested').display === 'red' || 'contested is not red'].filter(x => x !== true));

// Fail-soft: an unknown law set must degrade, never throw. The broken input is the OLD behaviour (a throw), which
// this check must catch; that is what broke every caller mid-release.
const softCheck = judge => {
  let rows;
  try { rows = judge(); } catch (e) { return ['threw instead of degrading: ' + e.message]; }
  return rows.length && rows.every(r => r.verdict === 'unknown-lawset' && r.display === 'grey' && r.unknown_lawset_reason) ? [] : ['rows were judged, or carry no reason'];
};
check('fail soft: an unknown law set yields unknown-lawset rows (grey) instead of throwing',
  () => softCheck(() => BC.check({ taxon: 'Exocoetidae', SL_m: 0.2, mass_kg: 0.06 }, { lawset: '99.0.0' })),
  () => softCheck(() => { throw new Error('unknown law set 99.0.0; known: 1.0.0'); }));

// 7 and 8. proposals through Lean: a contradictory law is contested; a sorry is rejected
if (!process.env.REGISTRY_TEST_FAST) {
  const S = scratchDir('test-proposals');
  const band = (lo, hi, extra = '') => `import Mathlib\n\nnamespace Delphi.Proposed.TestBand\n\n/-- TEST ONLY: a mass-exponent band for flying fish. -/\nstructure MassBand where\n  b : ℝ\n  lo : (${lo} : ℝ) ≤ b\n  hi : b ≤ (${hi} : ℝ)\n\ntheorem witness : Nonempty MassBand :=\n  ⟨⟨${((lo + hi) / 2).toFixed(3)}, ${extra || 'by norm_num, by norm_num'}⟩⟩\n\nend Delphi.Proposed.TestBand\n`;
  const meta = (lo, hi) => ({ law_id: 'test-mass-band', kind: 'biological', class: 'empirical-observation', statement_en: `TEST: mass exponent of flying fish in [${lo}, ${hi}]`, lean: { structure: 'Delphi.Proposed.TestBand.MassBand', witness: 'Delphi.Proposed.TestBand.witness', fields: { b: 'massExponent' } }, shared_scope: { atoms: [`${lo} ≤ q.massExponent`, `q.massExponent ≤ ${hi}`], quantities: { massExponent: { unit: '1' } }, witness_values: { massExponent: ((lo + hi) / 2).toFixed(3) } }, scope: { taxa: ['Exocoetidae'] }, origin: { by_role: 'registry-test', kind: 'agent' } });
  const write = (n, t) => { const f = path.join(S, n); fs.writeFileSync(f, t); return f; };
  const fContra = write('contra.lean', band(3.1, 3.3)), fOk = write('ok.lean', band(2.95, 3.0));
  const fSorry = write('sorry.lean', band(2.95, 3.0, 'sorry, by norm_num'));
  // Sequential, not parallel: concurrent Mathlib-importing compiles can fail to read .olean files under memory
  // pressure, which looks like a rejection (seen once on this box); one at a time removes that flake.
  const rc = await propose(fContra, meta(3.1, 3.3), { mutants: false });
  const rk = await propose(fOk, meta(2.95, 3.0), { mutants: false });
  const rs = await propose(fSorry, meta(2.95, 3.0), { mutants: false });
  if (rc.status !== 'contested') console.log('     contested-test detail:', rc.status, rc.reasons, (rc.steps.joint.output || '').slice(0, 400));
  check('propose: a band contradicting E2 ([3.1, 3.3] vs [2.90, 3.02]) is recorded as contested with E2, not accepted',
    () => rc.status === 'contested' && rc.law.contested_with.some(c => c.law_id === 'E2') ? [] : [`status ${rc.status}, contradicts ${JSON.stringify(rc.steps.joint.contradicts)}, reasons ${rc.reasons}`],
    () => rk.status === 'contested' ? [] : [`a consistent band [2.95, 3.0] is ${rk.status}, so the contested assertion fails on it`]);
  check('propose: a proposal containing sorry is rejected (status proposed, forbidden: sorry)',
    () => rs.status === 'proposed' && rs.steps.forbidden.found.includes('sorry') ? [] : [`status ${rs.status}`],
    () => rk.status === 'proposed' && rk.steps.forbidden.found.includes('sorry') ? [] : [`the sorry-free twin is ${rk.status}`]);
} else console.log('     (REGISTRY_TEST_FAST: Lean proposal tests skipped)');

const counts = {}; for (const l of laws) { const k = `${l.kind}/${l.status}`; counts[k] = (counts[k] || 0) + 1; }
console.log(`\nregistry: ${laws.length} laws`, counts, `current lawset ${cur.version}`);
console.log(failures ? `${failures} check(s) FAILED` : `all ${results.length} checks passed (each also failed once on broken input)`);
process.exit(failures ? 1 : 0);
