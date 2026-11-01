#!/usr/bin/env node
// Tests for the law registry. Every check runs twice: on the real input (must pass) and on a deliberately broken
// input (must FAIL), so no check can pass vacuously ("make each fail once"). Exit code 1 on any problem.
//   node lean/registry/test.mjs            # REGISTRY_TEST_FAST=1 skips the two Lean proposal runs (about 2 min)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { REG, ROOT, LAWS_DIR, readJson, loadLaws, listLawsets, loadLawset, contentHash, statementText, validate, sha256, scratchDir } from './registry-lib.mjs';
import { releaseProblems } from './release.mjs';
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
const hashErrs = ls => ls.flatMap(l => [contentHash(l) !== l.content_hash ? `${l.law_id}: content_hash` : null, l.lean_ref.content_hash !== l.content_hash ? `${l.law_id}: lean_ref.content_hash` : null].filter(Boolean));
check('hashes: content_hash matches the hashed fields', () => hashErrs(laws), () => { const b = clone(laws); b[3].statement_en += ' (edited without a version bump)'; return hashErrs(b); });

// 3. statement drift against the Lean source now on disk
const driftErrs = (ls, readSrc) => ls.filter(l => l.lean_ref.module && l.lean_ref.statement_sha256).flatMap(l => {
  const p = path.join(ROOT, l.lean_ref.module); if (!fs.existsSync(p)) return [`${l.law_id}: module ${l.lean_ref.module} missing`];
  const t = statementText(readSrc(p), l.lean_ref.structure || l.lean_ref.theorem);
  return t && sha256(t) === l.lean_ref.statement_sha256 ? [] : [`${l.law_id}: statement of ${l.lean_ref.structure || l.lean_ref.theorem} changed in ${l.lean_ref.module} (bump the law's version)`];
});
check('pins: each statement_sha256 matches the statement in its module', () => driftErrs(laws, p => fs.readFileSync(p, 'utf8')),
  () => driftErrs(laws.filter(l => l.law_id === 'E2'), p => fs.readFileSync(p, 'utf8').replace('hi : b ≤ (3.02 : ℝ)', 'hi : b ≤ (3.05 : ℝ)')));

// 4. law-set reproducibility: every pinned law still exists, unchanged versions keep their hash, nothing deleted
const lawsetErrs = (sets, ls) => {
  const by = new Map(ls.map(l => [l.law_id, l])); const e = [];
  for (const s of sets) for (const p of s.laws) {
    const l = by.get(p.law_id);
    if (!l) e.push(`${s.version}: ${p.law_id} deleted (laws are never deleted)`);
    else if (l.version === p.version && l.content_hash !== p.content_hash) e.push(`${s.version}: ${p.law_id} ${p.version} hash changed; the law set is no longer reproducible`);
  }
  return e;
};
const sets = listLawsets().map(v => loadLawset(v));
check(`lawsets: ${sets.map(s => s.version).join(', ')} reproducible from the law files`, () => lawsetErrs(sets, laws),
  () => { const b = clone(sets); b[0].laws[0].content_hash = '0'.repeat(64); return lawsetErrs(b, laws.filter(l => l.law_id !== 'E5')); });
const cur = readJson(path.join(REG, 'lawsets/current.json'));
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

// 7 and 8. proposals through Lean: a contradictory law is contested; a sorry is rejected
if (!process.env.REGISTRY_TEST_FAST) {
  const S = scratchDir('test-proposals');
  const band = (lo, hi, extra = '') => `import Mathlib\n\nnamespace Delphi.Proposed.TestBand\n\n/-- TEST ONLY: a mass-exponent band for flying fish. -/\nstructure MassBand where\n  b : ℝ\n  lo : (${lo} : ℝ) ≤ b\n  hi : b ≤ (${hi} : ℝ)\n\ntheorem witness : Nonempty MassBand :=\n  ⟨⟨${((lo + hi) / 2).toFixed(3)}, ${extra || 'by norm_num, by norm_num'}⟩⟩\n\nend Delphi.Proposed.TestBand\n`;
  const meta = (lo, hi) => ({ law_id: 'test-mass-band', kind: 'biological', class: 'empirical-observation', statement_en: `TEST: mass exponent of flying fish in [${lo}, ${hi}]`, lean: { structure: 'Delphi.Proposed.TestBand.MassBand', witness: 'Delphi.Proposed.TestBand.witness', fields: { b: 'massExponent' } }, shared_scope: { atoms: [`${lo} ≤ q.massExponent`, `q.massExponent ≤ ${hi}`], quantities: { massExponent: { unit: '1' } }, witness_values: { massExponent: ((lo + hi) / 2).toFixed(3) } }, scope: { taxa: ['Exocoetidae'] }, origin: { by_role: 'registry-test', kind: 'agent' } });
  const write = (n, t) => { const f = path.join(S, n); fs.writeFileSync(f, t); return f; };
  const fContra = write('contra.lean', band(3.1, 3.3)), fOk = write('ok.lean', band(2.95, 3.0));
  const fSorry = write('sorry.lean', band(2.95, 3.0, 'sorry, by norm_num'));
  const [rc, rk, rs] = await Promise.all([propose(fContra, meta(3.1, 3.3), { mutants: false }), propose(fOk, meta(2.95, 3.0), { mutants: false }), propose(fSorry, meta(2.95, 3.0), { mutants: false })]);
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
