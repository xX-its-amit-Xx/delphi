#!/usr/bin/env node
// check-exposed: every Lean law must be reachable through every surface, from the same loader.
//
//   node lean/registry/check-exposed.mjs          human-readable; exit 1 on any failure
//   node lean/registry/check-exposed.mjs --json   machine-readable report
//   node lean/registry/check-exposed.mjs --fast   skip the two subprocess checks (MCP stdio round-trip, CLI spawn)
//
// Owned by the Lean-API work (not by the registry agent). Node only: no Lean toolchain is needed, so CI can run it
// on every PR; whether the Lean compiles is the separate `lake build` check.
//
// What counts as a law (the INVENTORY): every entry of lean/laws.json, every constraint in lean/constraints.json,
// every entry of lean/empirical.json, every file in lean/registry/laws/, every law_id a lawset names, every Lean
// module under lean/Delphi/ (Certificates/ excluded) that is not listed in INFRASTRUCTURE below, every Lean
// declaration whose name ends in `_rules_out` (the form an eliminating constraint lemma takes), and every Lean
// comment tag `@law <law_id>` (the way to mark a new theorem as a law before the registry entry exists).
//
// FAILS when any of these is not:
//   (a) a law in the registry with a law_id (constraints and modules: backed by one; theorems named by a law or
//       constraint: present in the Lean source)
//   (b) returned by lean_laws_list via the handler (sim-engine/tools/lean-tools.mjs), and by lean_law_get
//   (c) in the static mirror dashboard/public/api/lean/ (index.json + laws/<law_id>.json)
//   (d) reachable via the CLI (sim-engine/lean-cli.mjs `law <id>`, and mcp/cli.mjs `laws`)
//   (e) returned by the hosted server's tools (mcp/server.mjs over stdio: lean_laws_list), and by the sim-engine HTTP
//       bridge's tool discovery
//   (f) self-update: every lean_* envelope carries source, lawset_version and fetched_at; lean_changes covers every
//       lawset; .github/workflows/leanbio-publish.yml republishes the mirror and deploy-mcp.yml's path filters
//       cover the law sources (lean/registry/SELF-UPDATE.md)
// and when the static mirror or sim-engine/contract.json is stale relative to the sources (content comparison), or a
// registered theorem's statement no longer matches its pinned lean_ref.statement_sha256 (drift).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const R = (...p) => path.join(ROOT, ...p);
const imp = rel => import(pathToFileURL(R(rel)).href);
const JSON_OUT = process.argv.includes('--json');
const FAST = process.argv.includes('--fast');

// Lean modules that hold no law of their own. Each needs a reason; adding a module here is a reviewed decision.
const INFRASTRUCTURE = {
  'lean/Delphi/Audit.lean': 'prints axioms of other modules\' theorems; declares nothing',
  'lean/Delphi/Constraints.lean': 'eliminating lemmas (`*_rules_out`) for laws declared elsewhere; each lemma is checked below as a constraint',
};
// ACCEPTED laws that deliberately produce no design row in the generated evaluator, each with the reason and
// what would make it bind. An accepted law that evaluates nowhere gives false assurance -- the law base says a
// design was checked against it when nothing was -- so this list is the only way to have one, it is reviewed,
// and check-exposed fails when an entry here stops being true (the law gained a row, or is no longer accepted).
// Anything NOT on this list must reach the evaluator, which for a new law means a `browser_check` block in its
// law file (lean/registry/README.md "Declarative browser check"); no code edit is needed for that.
const NO_DESIGN_ROW = {
  'fick-principle': 'DECIDED BY THE LAW OWNER (2026-11-01, fick-principle 1.3.0): it is the named HYPOTHESIS that aerobic-power-bound rests on, not the law that rules anything out, so it owns no constraint. C14 and C14b belong to aerobic-power-bound, whose Lean theorem does the eliminating. The law a user sees in a verdict should be the law that eliminated the design, and a premise should not own an eliminating constraint. Before this, both laws listed C14 and the generated checker broke the tie alphabetically, so a violation of the aerobic ceiling was reported under fick-principle for no better reason than the letter f',
  E5: 'DELIBERATE, and the law file says so (E5 scope.note): "It is deliberately NOT a constraint in the ledger, so that nothing is ever reported as eliminated by it; it is a flag in the Design Studio." The evaluator emits an E5 row, but as a provenance flag (verdictKind "provenance") whose verdict is only holds or cannot-evaluate, never violated',
  E1: 'an observation ABOUT the reference data (isometry fails within a species), not a relation over the numbers a design commits; it is the evidence behind the C2a/C8e exponent bands rather than a row of its own',
  E6: 'a convention about blueprint graph edge semantics ("required for" is not propagated down part_of); it constrains the graph builder in anatomy-model/, not a design\'s numbers',
  'altitude-coupling': 'an existence statement about the SET of flyable heights, not an inequality on one design; P4 (perturb-isa-vmin) is the design-facing altitude row',
  'blueprint-well-formedness': 'about an emitted anatomical blueprint graph (C6), checked where the graph is built, not by a numeric row over a design spec',
  'favored-fixation-lower-bound': 'a population-genetic process over generations (C3/C3b); a design document commits no population state (N, s, initial copies), so there is nothing to evaluate. G4 is the design-facing substitution-budget row',
  'fisher-ftns': 'a statement about the rate of change of mean fitness in a population (C4/C4b/C4c); a design commits no fitness distribution',
  'kimura-fixation-probability': 'fixation probability of an allele in a population (C2); a design commits no population size or selection coefficient',
  'kimura-substitution-rate': 'the neutral substitution rate of a lineage over time (C1/C1b); a design commits no mutation rate or divergence time. G4/G5 are the design-facing time-budget rows',
  'maynardsmith-twofold-cost': 'the twofold cost of sex, a comparison between reproductive modes (C5/C5b), not a bound on a design\'s committed numbers',
  'physiology-laplace': 'needs vessel wall thickness, radius and transmural pressure, none of which the resolved STATE carries yet; it binds as soon as those become design fields and the law gains a browser_check block',
  'physiology-q10': 'the Q10 relation IS evaluated for designs, as row P1b of perturb-thermal; this law is the underlying theorem and declares no constraint of its own',
  'scaling-bending-law': 'the section modulus (C12/C12b/C12c) needs a cross-section (breadth, depth, second moment); the resolved STATE carries no section, so no design can be judged',
  'thompson1917-ch02-07': 'a claim about ostrich and moa having passed the size at which muscular flight is possible: a statement about two real birds, not a relation over a design',
};
// Rows the generated evaluator emits that are deliberately not a law. Each needs a reason.
const UNCLAIMED_ROW_OK = {
  'unconstrained-inputs': 'a diagnostic row listing accepted-but-unconstrained inputs (fin length ratio, caudal lobe ratio); it carries no verdict and is not a law',
};
// A row the evaluator marks verdictKind "provenance" states where a design sits relative to the record and can
// never read as a violation, so it is not a law row and does not have to be claimed (E5 is the one today).
const provenanceRow = r => r.verdictKind === 'provenance';
// `*_rules_out` declarations that are deliberately not a constraint of their own. Each needs a reason.
const RULES_OUT_EXEMPT = {
  'Delphi.Constraints.cubeLaw_rules_out': 'unprimed form of cubeLaw_rules_out\' (constraint C7 uses the primed form); same law thompson1917-ch03-07',
  "Delphi.Constraints.supply_rules_out'": 'variant of supply_rules_out (constraint C3b); same law favored-fixation-lower-bound',
};

// This check is about the local tree: never let a configured remote law source (LEANBIO_REMOTE) stand in for it.
process.env.LEANBIO_REMOTE = 'off';

const failures = [];
const notes = [];
const fail = (check, item, msg, fix) => failures.push({ check, item, msg, fix });

const src = await imp('lib/lean-source.mjs');
const reg = src.load({ fresh: true });
const ids = new Set(reg.laws.map(l => l.law_id));
const readJson = rel => JSON.parse(fs.readFileSync(R(rel), 'utf8'));
const has = rel => fs.existsSync(R(rel));
const REGFIX = reg.origin === 'registry'
  ? 'add lean/registry/laws/<law_id>.json (node lean/registry/propose.mjs <file.lean> --meta meta.json --write), then node dashboard/build-lean-api.mjs'
  : 'add the law to lean/laws.json (lean/laws/build-laws.mjs) or create lean/registry/, then node dashboard/build-lean-api.mjs';

// ── (a) inventory -> registry ────────────────────────────────────────────────
const lawsJson = has('lean/laws.json') ? readJson('lean/laws.json').laws : [];
for (const l of lawsJson) if (!ids.has(l.id)) fail('a:registry', l.id, `lean/laws.json entry "${l.id}" has no registry law_id`, REGFIX);
const empirical = has('lean/empirical.json') ? readJson('lean/empirical.json').entries || [] : [];
for (const e of empirical) if (!ids.has(e.id)) fail('a:registry', e.id, `lean/empirical.json entry "${e.id}" has no registry law_id`, REGFIX);
const cidx = src.constraintIndex();
for (const c of reg.constraints) {
  if (!cidx[c.id]) fail('a:registry', c.id, `constraint ${c.id} (lean/constraints.json, lemma ${c.lemma}) is backed by no registry law`, `list "${c.id}" in the constraints of its law (lean/registry/laws/<law_id>.json)`);
  for (const n of [c.lemma, c.law]) if (n && !src.findDecl(n, c.module)) fail('a:lean', `${c.id}:${n}`, `constraint ${c.id} names ${n}, which is not declared in any Lean module`, 'fix the name in lean/constraints.json or restore the declaration');
}
for (const ls of reg.lawsets) for (const x of ls.laws) {
  if (!ids.has(x.law_id)) fail('a:registry', x.law_id, `lawset ${ls.version} names "${x.law_id}", which has no law file`, 'restore the law file (laws are retired, never deleted)');
  else if (x.version && !src.lawVersion(x.law_id, x.version)) fail('a:registry', `${x.law_id}@${x.version}`, `lawset ${ls.version} pins ${x.law_id}@${x.version}, which is neither the current law file nor an archived snapshot`, `archive it as lean/registry/law-versions/${x.law_id}@${x.version}.json`);
}
// Archived versions (law-versions/<id>@<v>.json) keep older lawsets reproducible: their theorems must still exist,
// and they count as backing for the lemmas they name (a superseded lemma is not dead code).
const archived = Object.values(reg.versions || {});
for (const v of archived) {
  if (v.lean_ref?.theorem && !src.findDecl(v.lean_ref.theorem, v.lean_ref.module)) fail('a:lean', `${v.law_id}@${v.version}`, `archived ${v.law_id}@${v.version} names ${v.lean_ref.theorem}, no longer in the Lean sources; older lawsets pinning it cannot reproduce`, 'restore the theorem (keep superseded lemmas compiled)');
}
for (const l of reg.laws) {
  const ref = l.lean_ref;
  if (ref?.theorem && !src.findDecl(ref.theorem, ref.module)) fail('a:lean', l.law_id, `law ${l.law_id} names theorem ${ref.theorem}, not found in the Lean sources`, 'fix lean_ref.theorem or restore the theorem');
  if (ref?.module && !has(ref.module)) fail('a:lean', l.law_id, `law ${l.law_id} points at missing module ${ref.module}`, 'fix lean_ref.module');
}
// Pinned statements: a registered theorem whose statement changed without a new law version is drift.
for (const d of src.verify().drift) fail('drift', d.law_id, `law ${d.law_id}: ${d.status} (${d.decl || d.module})`, d.status === 'drift' ? 'the Lean statement changed: bump the law version and re-pin lean_ref.statement_sha256 (lean/registry), or revert the Lean edit' : 'fix lean_ref in the law file');
const covered = new Set([...reg.laws, ...archived].map(l => l.lean_ref?.module).filter(Boolean));
const allModules = src.leanModules({ includeCertificates: false });
for (const m of allModules) {
  if (INFRASTRUCTURE[m]) continue;
  if (!covered.has(m)) fail('a:lean', m, `Lean module ${m} backs no registry law`, `register its law(s) (${REGFIX.split(',')[0]}), or, if it truly holds no law, add it to INFRASTRUCTURE in lean/registry/check-exposed.mjs with a reason`);
}
const constraintLemmas = new Set([...reg.constraints.map(c => c.lemma), ...archived.map(v => v.lean_ref?.theorem).filter(Boolean)]);
const tags = [];
for (const m of src.leanModules({ includeCertificates: true })) {
  const text = fs.readFileSync(R(m), 'utf8');
  for (const t of text.matchAll(/@law\s+([A-Za-z0-9_.-]+)/g)) tags.push({ module: m, id: t[1] });
  if (m.includes('/Certificates/')) continue;
  for (const d of src.declarations(m)) {
    if (!/_rules_out'?$/.test(d.short) || !['theorem', 'lemma'].includes(d.keyword)) continue;
    if (constraintLemmas.has(d.name) || RULES_OUT_EXEMPT[d.name]) continue;
    fail('a:lean', d.name, `${d.name} (${m}:${d.line}) is an eliminating lemma that no constraint or law uses`, 'add a constraint for it in lean/constraints.json mapped to a registry law, or add it to RULES_OUT_EXEMPT with a reason');
  }
}
for (const t of tags) if (!ids.has(t.id)) fail('a:registry', t.id, `${t.module} tags "@law ${t.id}" but the registry has no such law_id`, REGFIX);

// The generated checker must embed the law set current.json names. Without this, every checkDesign call returns
// 'unknown-lawset' (it used to throw), so the studio, the scorer and the examples silently evaluate nothing.
// Read as text via release.mjs, so this check does not import the large generated module.
if (reg.origin === 'registry' && reg.current) {
  let known = null;
  try { known = (await imp('lean/registry/release.mjs')).lawsetsKnownToChecker(); }
  catch (e) { notes.push(`could not ask lean/registry/release.mjs which law sets the checker knows: ${e.message}`); }
  if (known === null) fail('stale:checker', 'LAWSETS', 'could not read `export const LAWSETS` out of lean/eliminate/browser-check.mjs', 'node lean/eliminate/build-browser-check.mjs');
  else if (!known.includes(reg.current)) fail('stale:checker', reg.current, `lawsets/current.json names ${reg.current}, which the generated lean/eliminate/browser-check.mjs does not embed (it knows ${known.join(', ') || 'none'}): every check would evaluate nothing`, 'node lean/eliminate/build-browser-check.mjs');
  for (const ls of reg.lawsets) if (known && !known.includes(ls.version)) notes.push(`law set ${ls.version} is not embedded in the generated checker; lean_check against it returns unknown-lawset`);
}

// ── (a2) does each law actually BIND? ───────────────────────────────────────
// A law can be accepted, released in a law set, served by every tool and still evaluate NOTHING, because the
// generated evaluator only emits rows for constraint ids with a formula. That is the worst failure a living law
// base can have: every surface reports the design was checked against the law, and no arithmetic ran. So:
//   - every row id the evaluator emits must be claimed by some law (else the row reaches no caller);
//   - every ACCEPTED law in the current law set must have at least one claimed row, or an entry in NO_DESIGN_ROW;
//   - a NO_DESIGN_ROW entry that has stopped being true is itself a failure, so the list cannot rot.
// Candidate, proposed and contested laws without a row are a note, not a failure: they bind nothing by status.
let rowIds = null, claimed = null, provenanceIds = new Set();
try {
  const bc = await src.browserCheck();
  const rows = [...(bc.checkRaw ? bc.checkRaw({}) : []), ...(bc.checkRaw ? bc.checkRaw({ taxon: 'Danio rerio', SL_m: 0.04, mass_kg: 0.0009, finLength_SL: 0.6, lowerLobe_SL: 0.3 }) : [])];
  rowIds = new Set(rows.map(r => r.id));
  provenanceIds = new Set(rows.filter(provenanceRow).map(r => r.id));
  // Attribution, exactly as lib/lean-source.mjs checkDesign does it: the law the generated row names
  // (CONSTRAINT_LAW, last writer wins in the generator) and otherwise the first law listing that constraint.
  // Two laws may legitimately share a constraint id (C14 is both the Fick supply and the aerobic ceiling), so
  // "does this law bind" has to ask who the row is actually attributed to, not merely who mentions the id.
  claimed = new Map(Object.entries(bc.CONSTRAINT_LAW || {}));
  for (const l of reg.laws) for (const c of l.constraints || []) if (!claimed.has(c)) claimed.set(c, l.law_id);
} catch (e) { fail('bind:evaluator', 'browser-check', `could not read the rows lean/eliminate/browser-check.mjs emits: ${e.message}`, 'node lean/eliminate/build-browser-check.mjs'); }
if (rowIds) {
  for (const id of rowIds) {
    if (claimed.has(id) || UNCLAIMED_ROW_OK[id] || provenanceIds.has(id)) continue;
    fail('bind:unclaimed', id, `the generated evaluator emits a row "${id}" that no law claims, so lean_check drops it as an unmapped constraint and no surface ever shows it`,
      `add "${id}" to the "constraints" array of the law it belongs to (constraints is NOT a hashed field, so no content_hash or law-set pin moves), or add it to UNCLAIMED_ROW_OK in lean/registry/check-exposed.mjs with a reason`);
  }
  const curSet = reg.lawsets.find(s => s.version === reg.current);
  const binds = l => (l.constraints || []).some(c => rowIds.has(c) && claimed.get(c) === l.law_id);  // attributed to THIS law, not merely mentioned by it
  // Every law the current release pins, PLUS every law file already marked accepted but not yet released: a
  // law promoted to accepted in its file is claiming assurance from the moment of the promotion, so it has to
  // be able to evaluate something before the release, not after.
  const toCheck = [...(curSet ? curSet.laws : [])];
  for (const l of reg.laws) if (l.status === 'accepted' && !toCheck.some(x => x.law_id === l.law_id)) toCheck.push({ law_id: l.law_id, version: l.version, status: l.status, unreleased: true });
  for (const pin of toCheck) {
    const l = src.lawVersion(pin.law_id, pin.version) || reg.laws.find(x => x.law_id === pin.law_id);
    if (!l) continue;
    const status = pin.status || l.status;
    if (binds(l)) {
      if (NO_DESIGN_ROW[l.law_id]) fail('bind:exempt-stale', l.law_id, `${l.law_id} is listed in NO_DESIGN_ROW ("${NO_DESIGN_ROW[l.law_id].slice(0, 60)}...") but the evaluator now DOES emit a row for it`, 'remove it from NO_DESIGN_ROW in lean/registry/check-exposed.mjs');
      continue;
    }
    if (status === 'retired') continue;
    if (status !== 'accepted') {
      if (!NO_DESIGN_ROW[l.law_id]) notes.push(`${l.law_id} (${status}) evaluates nothing: no constraint of its own produces a row in lean/eliminate/browser-check.mjs. It binds nothing by status today; give it a browser_check block before it is accepted.`);
      continue;
    }
    if (NO_DESIGN_ROW[l.law_id]) continue;
    const why = (l.constraints || []).map(c => !rowIds.has(c) ? `${c}: the evaluator emits no row for it`
      : `${c}: the row exists but is attributed to law ${claimed.get(c)}`).join('; ') || 'it declares no constraint';
    fail('bind:accepted', l.law_id, `ACCEPTED law ${l.law_id} evaluates NOTHING (${why}), so lean_check, the Studio's verdicts, the optimizer's rejection rule and validate_design all report a design as checked against it while no arithmetic ran`,
      'give the law a declarative "browser_check" block (lean/registry/README.md "Declarative browser check"; data, no code edit) and bump its version, or add it to NO_DESIGN_ROW in lean/registry/check-exposed.mjs with the reason it cannot be a design row and what would make it bind');
  }
  // Two laws claiming ONE constraint id. The generated checker breaks the tie by file order (last writer wins,
  // i.e. alphabetically), and lib/lean-source.mjs constraintIndex breaks it the other way (first wins), so a
  // user reading a violation is told which law it came from for no better reason than a letter of the alphabet.
  // Attribution of a violation to a law is user-facing: it must be explicit, not emergent. Retired laws are
  // excluded (a retired law keeps its constraint list so old verdicts stay reproducible).
  const claimants = new Map();
  for (const l of reg.laws) { if (l.status === 'retired') continue; for (const c of l.constraints || []) (claimants.get(c) || claimants.set(c, []).get(c)).push(l.law_id); }
  for (const [c, who] of claimants) {
    if (who.length < 2) continue;
    fail('bind:ambiguous', c, `constraint ${c} is claimed by ${who.length} laws (${who.join(', ')}), so which law a violation of it is reported under is decided by file order, not by a decision: the generated checker attributes it to ${claimed.get(c) || 'none'} and lib/lean-source.mjs constraintIndex would pick ${who[0]}`,
      `make the constraint belong to exactly ONE law: remove it from the other law's "constraints" (constraints is not a hashed field), and if both laws really need to be evaluated give the second one its own constraint id with a "browser_check" block`);
  }

  // A law file that no law set pins is excluded by lean_check ("not in lawset <v>"), so it reaches the
  // registry, the mirror, both MCP servers and both CLIs and still judges nothing. For an accepted law that is
  // a release that was forgotten; for a candidate it is the normal state until the next release.
  for (const l of reg.laws) {
    if (['proposed', 'retired'].includes(l.status)) continue;
    if (reg.lawsets.some(s => s.laws.some(x => x.law_id === l.law_id))) continue;
    if (l.status === 'accepted') fail('a:unreleased', l.law_id, `${l.law_id} is ACCEPTED but no law set pins it, so lean_check excludes it ("not in lawset ${reg.current}") and no design is ever judged by it`, `cut a release: node lean/registry/release.mjs <next semver> "<note>"`);
    else notes.push(`${l.law_id} (${l.status}) is in no law set yet, so lean_check excludes it and it judges no design until the next release (node lean/registry/release.mjs).`);
  }
  for (const id of Object.keys(NO_DESIGN_ROW)) {
    const l = reg.laws.find(x => x.law_id === id);
    if (!l) fail('bind:exempt-stale', id, `NO_DESIGN_ROW names "${id}", which is not a law any more`, 'remove the entry from lean/registry/check-exposed.mjs');
  }
  // A declarative block must be wired to its law, or the row cannot be mapped back.
  for (const l of reg.laws) {
    const d = l.browser_check;
    if (!d) continue;
    if (!d.constraint) fail('bind:declared', l.law_id, `${l.law_id} has a browser_check block with no constraint id`, 'add browser_check.constraint');
    else if (!(l.constraints || []).includes(d.constraint)) fail('bind:declared', l.law_id, `${l.law_id} declares browser_check.constraint "${d.constraint}" but does not list it in its own "constraints" array, so the row maps back to no law`, `add "${d.constraint}" to the law's constraints`);
    else if (!rowIds.has(d.constraint)) fail('bind:declared', l.law_id, `${l.law_id} declares browser_check.constraint "${d.constraint}" but the generated evaluator emits no such row`, 'node lean/eliminate/build-browser-check.mjs');
  }
}

// ── (b) handlers ─────────────────────────────────────────────────────────────
const tools = await imp('sim-engine/tools/lean-tools.mjs');
const T = Object.fromEntries(tools.LEAN_TOOLS.map(t => [t.name, t]));
const listed = new Set((await T.lean_laws_list.handler({})).result.laws.map(l => l.law_id));
for (const id of ids) {
  if (!listed.has(id)) fail('b:handler', id, `lean_laws_list does not return ${id}`, 'lib/lean-source.mjs listLaws must return every law');
  try { const g = await T.lean_law_get.handler({ id }); if (g.result.law_id !== id) throw new Error('wrong law'); }
  catch (e) { fail('b:handler', id, `lean_law_get(${id}) failed: ${e.message}`, 'see lib/lean-source.mjs getLaw'); }
}
try { await T.lean_lawset_get.handler({ version: 'current' }); } catch (e) { fail('b:handler', 'lean_lawset_get', e.message, 'lean/registry/lawsets/current.json'); }
// Self-update: every lean_* envelope says where its laws came from (source, lawset_version, fetched_at), and the
// status and changes tools answer.
for (const t of tools.LEAN_TOOLS.filter(t => !t.local && t.name !== 'lean_check')) {
  try {
    const args = t.name === 'lean_law_get' ? { id: [...ids][0] } : {};
    const r = await t.handler(args);
    for (const k of ['source', 'lawset_version', 'fetched_at']) if (r[k] == null) throw new Error(`envelope has no ${k}`);
    if (r.lawset_version !== reg.current) throw new Error(`envelope lawset_version ${r.lawset_version} is not the current lawset ${reg.current}`);
  } catch (e) { fail('b:source', t.name, `${t.name}: ${e.message}`, 'wrap the handler with withSource() in sim-engine/tools/lean-tools.mjs'); }
}
try {
  const c = (await T.lean_changes.handler({})).result;
  const vs = new Set(c.entries.map(e => e.version));
  for (const ls of reg.lawsets) if (!vs.has(ls.version)) fail('b:changes', ls.version, `lean_changes has no entry for lawset ${ls.version}`, 'add a "## <version> (<date>)" section to lean/registry/CHANGELOG.md (release.mjs writes one)');
} catch (e) { fail('b:changes', 'lean_changes', e.message, 'lib/lean-source.mjs getChanges'); }
// CI self-update: the mirror republishes and the hosted server redeploys when laws change.
const wf = rel => (has(rel) ? fs.readFileSync(R(rel), 'utf8') : null);
const pub = wf('.github/workflows/leanbio-publish.yml');
if (!pub) fail('ci:publish', 'leanbio-publish.yml', '.github/workflows/leanbio-publish.yml is missing: the /api/lean/ mirror would not republish when laws change', 'restore the workflow (lean/registry/SELF-UPDATE.md)');
else for (const need of ['lean/**', 'build-lean-api.mjs', 'check-exposed.mjs', 'wrangler', 'CLOUDFLARE_API_TOKEN']) if (!pub.includes(need)) fail('ci:publish', need, `leanbio-publish.yml does not mention ${need}`, 'see lean/registry/SELF-UPDATE.md');
const dep = wf('.github/workflows/deploy-mcp.yml');
if (dep) for (const need of ['lean/registry/**', 'lib/lean-source.mjs', 'sim-engine/tools/lean-tools.mjs']) if (!dep.includes(`"${need}"`)) fail('ci:deploy-mcp', need, `deploy-mcp.yml path filters do not cover ${need}`, 'add it under on.push.paths');
try { await T.lean_check.handler({ design: {} }); } catch (e) { fail('b:handler', 'lean_check', e.message, 'lean/eliminate/browser-check.mjs'); }

// ── (c) static mirror ────────────────────────────────────────────────────────
const mirror = await imp('dashboard/build-lean-api.mjs');
if (!has('dashboard/public/api/lean/index.json')) fail('c:mirror', 'index.json', 'static mirror dashboard/public/api/lean/ does not exist', 'node dashboard/build-lean-api.mjs');
else {
  const idx = readJson('dashboard/public/api/lean/index.json');
  const inIdx = new Set(idx.laws.map(l => l.law_id));
  for (const id of ids) {
    if (!inIdx.has(id)) fail('c:mirror', id, `${id} missing from /api/lean/index.json`, 'node dashboard/build-lean-api.mjs');
    if (!has(`dashboard/public/api/lean/laws/${id.replace(/[^A-Za-z0-9._-]/g, '_')}.json`)) fail('c:mirror', id, `/api/lean/laws/${id}.json missing`, 'node dashboard/build-lean-api.mjs');
  }
  for (const v of archived) if (!has(`dashboard/public/api/lean/laws/${v.law_id}@${v.version}.json`)) fail('c:mirror', `${v.law_id}@${v.version}`, `/api/lean/laws/${v.law_id}@${v.version}.json missing`, 'node dashboard/build-lean-api.mjs');
  // The page's own copy of the evaluator is maintained by another build step (dashboard/build-graph.mjs) and is not
  // failed on here; lean-client.js prefers the mirror's copy. A lag is still worth saying out loud.
  // The Studio page has its own copy of the evaluator, copied by another thread's dashboard/build-graph.mjs.
  // A BYTE lag is a note (lean-client.js prefers the mirror's copy, so law verdicts are unaffected). A lag that
  // has made the page copy forget the CURRENT law set is a FAILURE: anything importing the page copy directly
  // (perturb.js's fallback) then judges every row 'unknown-lawset', so the page silently stops evaluating laws.
  // This is the "the studio's bundled copy went stale by 7 hours" failure, made loud instead of remembered.
  const pageChecker = 'dashboard/public/blueprint3d/browser-check.mjs';
  if (has(pageChecker)) {
    const pageText = fs.readFileSync(R(pageChecker), 'utf8').replace(/\r\n/g, '\n');
    const lags = pageText !== fs.readFileSync(R('lean/eliminate/browser-check.mjs'), 'utf8').replace(/\r\n/g, '\n');
    const m = /export const LAWSETS = (\{[\s\S]*?\n\});/.exec(pageText);
    let pageKnows = null;
    try { pageKnows = m ? Object.keys(JSON.parse(m[1])) : null; } catch { pageKnows = null; }
    if (reg.current && pageKnows && !pageKnows.includes(reg.current))
      fail('stale:page-checker', reg.current, `${pageChecker} does not embed the current law set ${reg.current} (it knows ${pageKnows.join(', ') || 'none'}): every page importing it directly (perturb.js fallback) judges every row 'unknown-lawset' and evaluates no law at all`,
        'node dashboard/build-graph.mjs (it copies lean/eliminate/browser-check.mjs into the page), or ask the Viz thread to re-run it; lean-client.js itself prefers /api/lean/browser-check.mjs, which dashboard/build-lean-api.mjs keeps fresh');
    else if (reg.current && pageKnows === null)
      fail('stale:page-checker', 'LAWSETS', `could not read "export const LAWSETS" out of ${pageChecker}, so it cannot be shown to know the current law set`, 'node dashboard/build-graph.mjs');
    else if (lags)
      notes.push(`${pageChecker} lags lean/eliminate/browser-check.mjs byte-for-byte (another thread's dashboard/build-graph.mjs copies it) but DOES embed the current law set ${reg.current}. lean-client.js uses /api/lean/browser-check.mjs instead, so law verdicts are unaffected; anything importing the page copy directly (perturb.js fallback) evaluates with the older build.`);
  }
  const d = mirror.diff();
  if (d.length) fail('stale:mirror', `${d.length} files`, `static mirror is stale relative to the sources: ${d.slice(0, 6).map(x => `${x.file} (${x.why})`).join(', ')}${d.length > 6 ? ', ...' : ''}`, 'node dashboard/build-lean-api.mjs');
}

// ── (d) CLIs ─────────────────────────────────────────────────────────────────
const cli = await imp('sim-engine/lean-cli.mjs');
for (const id of ids) {
  try { const { out } = await cli.run(['law', id, '--result']); if (out.law_id !== id) throw new Error('wrong law'); }
  catch (e) { fail('d:cli', id, `lean-cli law ${id} failed: ${e.message}`, 'sim-engine/lean-cli.mjs'); }
}
if (!FAST) {
  for (const [bin, label] of [['sim-engine/lean-cli.mjs', 'sim-engine/lean-cli.mjs laws'], ['mcp/cli.mjs', 'mcp/cli.mjs laws']]) {
    const r = spawnSync(process.execPath, [R(bin), 'laws'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 << 20 });
    let got = null;
    try { got = new Set(JSON.parse(r.stdout).result.laws.map(l => l.law_id)); } catch { }
    if (!got) fail('d:cli', label, `${label} did not print the law list (exit ${r.status}): ${(r.stderr || '').slice(0, 300)}`, `run: node ${bin} laws`);
    else for (const id of ids) if (!got.has(id)) fail('d:cli', id, `${label} does not return ${id}`, bin);
  }
}

// ── (e) servers ──────────────────────────────────────────────────────────────
// sim-engine stdio server: its published contract must carry every lean_* tool with the handler module's schema.
const contractPath = 'sim-engine/contract.json';
if (has(contractPath)) {
  const contract = readJson(contractPath);
  const dump = spawnSync(process.execPath, [R('sim-engine/server.mjs'), '--dump-contract'], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 << 20 });
  let live = null; try { live = JSON.parse(dump.stdout); } catch { }
  if (!live) fail('stale:contract', contractPath, `node sim-engine/server.mjs --dump-contract failed (exit ${dump.status}): ${(dump.stderr || '').slice(0, 300)}`, 'fix sim-engine/server.mjs');
  else if (JSON.stringify(live) !== JSON.stringify(contract)) fail('stale:contract', contractPath, 'sim-engine/contract.json differs from what server.mjs publishes now', 'node sim-engine/server.mjs --dump-contract > sim-engine/contract.json');
  for (const t of tools.LEAN_TOOLS) {
    const c = contract.tools?.find(x => x.name === t.name);
    if (!c) fail('e:sim-engine', t.name, `${t.name} is not in sim-engine/contract.json (not registered in sim-engine/server.mjs)`, 'apply sim-engine/tools/LEAN-REGISTER.md, then regenerate contract.json');
    else if (JSON.stringify(c.inputSchema) !== JSON.stringify(t.inputSchema)) fail('e:sim-engine', t.name, `${t.name} in contract.json is not the lean-tools.mjs definition (old wrapper still registered?)`, 'apply sim-engine/tools/LEAN-REGISTER.md, then regenerate contract.json');
  }
}
if (has('sim-engine/http.mjs')) {
  try {
    const { discoverTools } = await imp('sim-engine/http.mjs');
    const { tools: ht } = await discoverTools();
    for (const t of tools.LEAN_TOOLS) if (!ht.some(x => x.name === t.name)) fail('e:http', t.name, `sim-engine HTTP bridge does not discover ${t.name}`, 'sim-engine/http.mjs discoverTools');
  } catch (e) { notes.push(`sim-engine/http.mjs discovery not checked: ${e.message}`); }
}
// The hosted delphisci MCP: spawn it over stdio (exactly what `npx github:...` runs) and ask it.
if (!FAST && has('mcp/server.mjs')) {
  try {
    const { Client } = await import(pathToFileURL(R('node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')).href);
    const { StdioClientTransport } = await import(pathToFileURL(R('node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')).href);
    const env = { ...process.env, LEANBIO_REMOTE: 'off' }; delete env.DELPHI_HTTP_PORT;
    const transport = new StdioClientTransport({ command: process.execPath, args: [R('mcp/server.mjs')], cwd: ROOT, env, stderr: 'pipe' });
    const client = new Client({ name: 'check-exposed', version: '1' });
    await client.connect(transport);
    const names = (await client.listTools()).tools.map(t => t.name);
    for (const t of tools.LEAN_TOOLS) if (!names.includes(t.name)) fail('e:mcp', t.name, `mcp/server.mjs (stdio) does not offer ${t.name}`, 'register it in mcp/server.mjs (leanTool(...))');
    const r = await client.callTool({ name: 'lean_laws_list', arguments: {} });
    const got = new Set(JSON.parse(r.content[0].text).result.laws.map(l => l.law_id));
    for (const id of ids) if (!got.has(id)) fail('e:mcp', id, `mcp lean_laws_list does not return ${id}`, 'mcp/server.mjs must use sim-engine/tools/lean-tools.mjs');
    await client.close();
  } catch (e) { fail('e:mcp', 'mcp/server.mjs', `could not query mcp/server.mjs over stdio: ${e.message}`, 'npm install at the repo root; node mcp/server.mjs'); }
}
// Packaging: the hosted image and `npx github:` installs must contain what the loader reads.
if (has('package.json')) {
  const files = readJson('package.json').files || [];
  const di = has('.dockerignore') ? fs.readFileSync(R('.dockerignore'), 'utf8') : '';
  for (const need of ['lib/lean-source.mjs', 'lib/lean-scope.mjs', 'sim-engine/tools/lean-tools.mjs', 'sim-engine/lib/envelope.mjs', 'lean/registry/laws/', 'lean/registry/lawsets/', 'lean/registry/law-versions/', 'lean/registry/registry-lib.mjs', 'lean/laws.json', 'lean/constraints.json', 'lean/eliminate/browser-check.mjs', 'lean/Delphi']) {
    if (!files.some(f => f === need || f.startsWith(need))) fail('e:package', need, `package.json "files" does not ship ${need}`, 'add it to "files" in package.json');
    if (di && !di.split(/\r?\n/).some(l => l.startsWith('!' + need))) fail('e:package', need, `.dockerignore does not let ${need} into the image`, `add !${need}... to .dockerignore`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const summary = { ok: failures.length === 0, origin: reg.origin, laws: ids.size, constraints: reg.constraints.length,
  lean_modules: allModules.length, lawsets: reg.lawsets.map(s => s.version), current: reg.current, failures, notes };
if (JSON_OUT) console.log(JSON.stringify(summary, null, 1));
else {
  console.log(`check-exposed: ${ids.size} laws (${reg.origin}), ${reg.constraints.length} constraints, ${allModules.length} Lean modules, lawsets ${summary.lawsets.join(', ') || 'none'} (current ${reg.current})`);
  for (const n of notes) console.log(`  note: ${n}`);
  if (!failures.length) console.log('  OK: every law is in the registry, the handlers, the static mirror, both CLIs, the MCP servers and the contract; nothing is stale.');
  else {
    const by = {};
    for (const f of failures) (by[f.check] ||= []).push(f);
    for (const [k, fs_] of Object.entries(by)) {
      console.log(`  FAIL ${k} (${fs_.length})`);
      for (const f of fs_.slice(0, 12)) console.log(`    - ${f.msg}\n      fix: ${f.fix}`);
      if (fs_.length > 12) console.log(`    ... ${fs_.length - 12} more`);
    }
    console.log(`\n${failures.length} failure(s). Rule: any new Lean law must be exposed through the registry, the MCP tools, the CLI and /api/lean/ (lean/registry/AGENTS-RULE.md).`);
  }
}
process.exit(failures.length ? 1 : 0);
