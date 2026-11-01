#!/usr/bin/env node
// law-surfaces: for ONE law, does it actually reach every surface a design is judged on?
//
//   node lean/registry/law-surfaces.mjs <law_id> [--design '<json>'] [--json] [--fast]
//
// check-exposed.mjs answers "is every law on every surface" for the whole tree and fails CI. This answers the
// same question for one law, hop by hop, and prints what each hop returned, so a release can be SHOWN to have
// closed the loop rather than asserted to have. It is the capture tool for lean/registry/LIVE-LOOP-DEMO.md.
//
// The eight surfaces, in the order a new law travels them:
//   a registry-lawset   lean/registry/lawsets/current.json pins the law (version + status)
//   b browser-checker   the generated lean/eliminate/browser-check.mjs emits a row ATTRIBUTED to this law
//   c static-mirror     dashboard/public/api/lean/ has the law and its lawset, and changes.json mentions it
//   d sim-engine-mcp    sim-engine/contract.json + sim-engine/lean-cli.mjs return it (the stdio MCP's tools)
//   e hosted-mcp        mcp/cli.mjs (the hosted delphisci server's own path through the same handlers)
//   f studio-verdict    the files the BROWSER fetches (/api/lean/current.json + /api/lean/browser-check.mjs),
//                       evaluated the way dashboard/public/blueprint3d/lean-client.js checkState does, with the
//                       red / amber / grey display the Studio draws
//   g optimizer-rule    sim-engine/tools/studio.mjs optimize: is the law in the rule that rejects a candidate
//                       (binding and new), and does a violating design actually get rejected for it
//   h validation-tool   sim-engine/validate/lean-components.mjs leanByComponent, which validate_design reports
//
// Nothing here writes to disk. The local tree is the source: LEANBIO_REMOTE is forced off.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const R = (...p) => path.join(ROOT, ...p);
const imp = rel => import(pathToFileURL(R(rel)).href);
process.env.LEANBIO_REMOTE = 'off';

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const FAST = args.includes('--fast');
const lawId = args.find(a => !a.startsWith('--'));
const designArg = args.includes('--design') ? args[args.indexOf('--design') + 1] : null;
if (!lawId) { console.error("usage: node lean/registry/law-surfaces.mjs <law_id> [--design '<json>'] [--json] [--fast]"); process.exit(2); }

// A design that commits the two numbers every row needs, plus a taxon so scoped rows are judged.
const DEFAULT_DESIGN = { taxon: 'Danio rerio', life_stage: 'adult', SL_m: 0.04, mass_kg: 0.0009 };
const design = designArg ? JSON.parse(designArg) : DEFAULT_DESIGN;

const hops = [];
const hop = (key, title, reached, detail, evidence) => hops.push({ surface: key, title, reached, detail, ...(evidence === undefined ? {} : { evidence }) });

const src = await imp('lib/lean-source.mjs');
const reg = src.load({ fresh: true, local: true });
const law = reg.laws.find(l => l.law_id === lawId);
if (!law) { console.error(`no law "${lawId}" in lean/registry/laws/. lean_laws_list returns every law_id.`); process.exit(2); }

// ── a. the registry law set ─────────────────────────────────────────────────
const cur = reg.lawsets.find(s => s.version === reg.current);
const pin = cur && cur.laws.find(x => x.law_id === lawId);
hop('a registry-lawset', `lawsets/current.json (${reg.current})`, !!pin,
  pin ? `pinned ${lawId}@${pin.version} status ${pin.status} content_hash ${String(pin.content_hash).slice(0, 12)}...`
      : `law set ${reg.current} does not pin ${lawId}: it is in the registry but in no release, so every caller ignores it`,
  pin || null);

// ── b. the generated browser checker ────────────────────────────────────────
const bc = await src.browserCheck();
const rawRows = bc.checkRaw ? bc.checkRaw(design) : [];
const mine = rawRows.filter(r => (bc.CONSTRAINT_LAW || {})[r.id] === lawId
  || (!(bc.CONSTRAINT_LAW || {})[r.id] && (law.constraints || []).includes(r.id)));
hop('b browser-checker', 'lean/eliminate/browser-check.mjs', mine.length > 0,
  mine.length ? `${mine.length} row(s) attributed to this law: ${mine.map(r => `${r.id} -> ${r.verdict}`).join(', ')}${law.browser_check ? ` (declarative: ${law.browser_check.relation})` : ''}`
    : `NO row is attributed to this law${(law.constraints || []).length ? ` (its constraints ${(law.constraints || []).join(', ')} either have no formula or are attributed elsewhere)` : ' (it declares no constraint)'}, so nothing is evaluated for it on any surface. A law file may carry a "browser_check" block to fix this with no code edit (lean/registry/README.md).`,
  mine.map(r => ({ id: r.id, verdict: r.verdict, numbers: r.numbers, missing: r.missing })));

// ── c. the static mirror and the changes feed ───────────────────────────────
const MIR = 'dashboard/public/api/lean';
const read = rel => { try { return JSON.parse(fs.readFileSync(R(MIR, rel), 'utf8')); } catch { return null; } };
const idx = read('index.json');
const lawDoc = read(`laws/${lawId.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
const changes = read('changes.json');
const curDoc = read('current.json');
const inIdx = !!(idx && idx.laws.some(l => l.law_id === lawId));
const inCurDoc = !!(curDoc && (curDoc.laws || []).some(l => l.law_id === lawId));
const changeEntry = changes && (changes.entries || []).find(e => (e.diff?.added || []).some(x => x.law_id === lawId) || (e.diff?.version || []).some(x => x.law_id === lawId) || (e.diff?.status || []).some(x => x.law_id === lawId));
hop('c static-mirror', `${MIR}/ (index.json, laws/, current.json, changes.json)`, inIdx && !!lawDoc && inCurDoc,
  `index.json: ${inIdx ? 'present' : 'MISSING'}; laws/${lawId}.json: ${lawDoc ? `present (status ${lawDoc.status}, version ${lawDoc.version})` : 'MISSING'}; current.json (${curDoc?.version}): ${inCurDoc ? 'present' : 'MISSING'}; changes feed: ${changeEntry ? `named in the ${changeEntry.version} entry` : 'not named in any entry'}`,
  { index: inIdx, law_doc: !!lawDoc, current: inCurDoc, changes_entry: changeEntry ? changeEntry.version : null, mirror_current_lawset: idx?.current_lawset ?? null });

// ── d. the sim-engine MCP server ────────────────────────────────────────────
const tools = await imp('sim-engine/tools/lean-tools.mjs');
const T = Object.fromEntries(tools.LEAN_TOOLS.map(t => [t.name, t]));
const listed = await T.lean_laws_list.handler({});
const inList = listed.result.laws.some(l => l.law_id === lawId);
let got = null; try { got = (await T.lean_law_get.handler({ id: lawId })).result; } catch (e) { got = { error: e.message }; }
const contract = (() => { try { return JSON.parse(fs.readFileSync(R('sim-engine/contract.json'), 'utf8')); } catch { return null; } })();
const contractHasLean = !!(contract && contract.tools && tools.LEAN_TOOLS.every(t => contract.tools.some(x => x.name === t.name)));
hop('d sim-engine-mcp', 'sim-engine/tools/lean-tools.mjs via sim-engine/contract.json + lean-cli.mjs', inList && !got.error && contractHasLean,
  `lean_laws_list: ${inList ? 'returns it' : 'does NOT return it'}; lean_law_get: ${got.error ? `failed (${got.error})` : `${got.law_id}@${got.version} status ${got.status}`}; contract.json carries all ${tools.LEAN_TOOLS.length} lean_* tools: ${contractHasLean}; envelope source ${listed.source} lawset_version ${listed.lawset_version}`,
  { source: listed.source, lawset_version: listed.lawset_version, fetched_at: listed.fetched_at });

// ── e. the hosted mcp/ server ───────────────────────────────────────────────
if (FAST) hop('e hosted-mcp', 'mcp/cli.mjs (hosted delphisci server)', null, 'skipped (--fast)');
else {
  const r = spawnSync(process.execPath, [R('mcp/cli.mjs'), 'laws'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 << 20, env: { ...process.env, LEANBIO_REMOTE: 'off' } });
  let ids = null; try { ids = JSON.parse(r.stdout).result.laws.map(l => l.law_id); } catch { }
  hop('e hosted-mcp', 'mcp/cli.mjs laws (the hosted delphisci server\'s own path through the same handlers)', ids ? ids.includes(lawId) : false,
    ids ? `${ids.length} laws; ${lawId} ${ids.includes(lawId) ? 'present' : 'MISSING'}` : `mcp/cli.mjs laws did not print a law list (exit ${r.status}): ${(r.stderr || '').slice(0, 200)}`);
}

// ── f. the Design Studio verdict (the files the browser actually fetches) ───
// Replicates dashboard/public/blueprint3d/lean-client.js checkState: the mirror's law set decides law_id,
// version, kind and status; the mirror's copy of the evaluator computes the rows; lib/lean-scope.mjs (mirrored
// as scope.mjs) decides out-of-scope; display is red / amber / grey / green.
let studio = { reached: false, detail: 'the mirror is missing current.json or browser-check.mjs' };
try {
  const pageBc = await import(pathToFileURL(R(MIR, 'browser-check.mjs')).href);
  const { outOfScope } = await import(pathToFileURL(R(MIR, 'scope.mjs')).href);
  const ls = JSON.parse(fs.readFileSync(R(MIR, 'current.json'), 'utf8'));
  const byId = {}, byConstraint = {};
  for (const l of ls.laws || []) { byId[l.law_id] = l; for (const c of l.constraints || []) if (!byConstraint[c]) byConstraint[c] = l; }
  const rows = (pageBc.check || pageBc.default)(design, { lawset: ls.version, includeCandidates: true });
  const ours = [];
  for (const r of rows) {
    const l = (r.law && byId[r.law.law_id]) || byConstraint[r.id] || null;
    if (!l || l.law_id !== lawId) continue;
    const oos = r.verdict === 'unknown-lawset' ? null : outOfScope(r, l, design);
    const verdict = oos ? 'out-of-scope' : r.verdict;
    const display = verdict === 'violated' ? (l.status === 'accepted' ? 'red' : 'grey (candidate: shown, never binding)')
      : verdict === 'contested' ? 'amber' : verdict === 'holds' ? 'green' : 'grey';
    ours.push({ constraint: r.id, verdict, display, status: l.status, version: l.version, numbers: r.numbers, scope_reason: oos?.reason ?? null });
  }
  studio = { reached: ours.length > 0, detail: ours.length ? ours.map(o => `${o.constraint}: ${o.verdict} -> ${o.display} (law status ${o.status})`).join('; ') : `the Studio draws no row for ${lawId}: the mirror's law set ${ls.version} ${byId[lawId] ? 'pins it but no evaluator row is attributed to it' : 'does not pin it'}`, evidence: ours };
} catch (e) { studio = { reached: false, detail: `could not evaluate the Studio path: ${e.message}` }; }
hop('f studio-verdict', `${MIR}/browser-check.mjs + current.json, via lean-client.js checkState`, studio.reached, studio.detail, studio.evidence);

// ── g. the optimizer's rejection rule ──────────────────────────────────────
// The rule itself (sim-engine/tools/studio.mjs optimize, evaluateDoc): a candidate is rejected when a BINDING
// (accepted-law) violation appears that the unedited start design does not already have. leanVerdicts is the
// one path both it and the Studio use, so showing the law in leanVerdicts' rows shows it in the rule.
let optim = { reached: false, detail: 'sim-engine/lib/lean.mjs could not be loaded' };
try {
  const { leanVerdicts } = await imp('sim-engine/lib/lean.mjs');
  const fake = { parts: {}, _meta: { leaves: {} }, ...Object.fromEntries(Object.entries(design).map(([k, v]) => [k, v])) };
  const r = await src.checkDesign(design, 'current');
  const rows = r.verdicts.filter(v => v.law_id === lawId);
  const viol = r.violations.filter(v => v.law_id === lawId);
  const binding = viol.filter(v => v.binding);
  optim = { reached: rows.length > 0,
    detail: rows.length
      ? `the rule sees ${rows.length} row(s) for this law: ${rows.map(v => `${v.constraint} ${v.verdict}${v.binding ? ' [binding]' : ' [advisory: status ' + v.status + ']'}`).join(', ')}. `
        + (binding.length ? `A design with these numbers IS rejected by optimize (a new binding violation).` : viol.length ? `Violated but NOT binding (status ${viol[0].status}), so optimize reports it and does not reject: candidate is the automatic ceiling and a candidate law never silently kills a design.` : 'no violation for these numbers, so the rule lets the design through')
      : `the rule never sees this law: lean_check returns no row for it (${r.laws_without_browser_evaluation.includes(lawId) ? 'it is in laws_without_browser_evaluation' : 'no row attributed'})`,
    evidence: { rows, violations: viol, lawset: r.lawset } };
} catch (e) { optim = { reached: false, detail: `could not run the rule: ${e.message}` }; }
hop('g optimizer-rule', 'sim-engine/tools/studio.mjs optimize -> sim-engine/lib/lean.mjs leanVerdicts', optim.reached, optim.detail, optim.evidence);

// ── h. the validation tool ─────────────────────────────────────────────────
let val = { reached: false, detail: 'not run' };
try {
  const { leanRounds } = await imp('sim-engine/validate/lean-rounds.mjs');
  const r = await leanRounds({ design, from: args.includes('--from') ? args[args.indexOf('--from') + 1] : null });
  const inR2 = r.round2.verdicts.filter(v => v.law_id === lawId);
  val = { reached: inR2.length > 0,
    detail: `validate_design round 2 (law set ${r.round2.lawset_version}): ${inR2.length ? inR2.map(v => `${v.constraint} ${v.verdict}`).join(', ') : 'no row for this law'}`
      + `; newly_violated_since ${r.round1.lawset_version} -> ${r.round2.lawset_version}: ${r.newly_violated_since.length ? r.newly_violated_since.map(v => `${v.law_id}/${v.constraint}`).join(', ') : 'none'}`,
    evidence: { round1_lawset: r.round1.lawset_version, round2_lawset: r.round2.lawset_version, newly_violated_since: r.newly_violated_since } };
} catch (e) { val = { reached: false, detail: `could not run the second Lean round: ${e.message}` }; }
hop('h validation-tool', 'sim-engine/validate/lean-rounds.mjs (validate_design round 2) + lean-components.mjs', val.reached, val.detail, val.evidence);

// ── report ─────────────────────────────────────────────────────────────────
const out = { law_id: lawId, law_version: law.version, law_status: law.status, lawset: reg.current,
  checked_at: new Date().toISOString(), design, reached: hops.filter(h => h.reached === true).length,
  of: hops.filter(h => h.reached !== null).length, surfaces: hops };
if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`law-surfaces ${lawId}@${law.version} (status ${law.status}) against law set ${reg.current} at ${out.checked_at}`);
  console.log(`design: ${JSON.stringify(design)}`);
  for (const h of hops) console.log(`  [${h.reached === null ? 'skip' : h.reached ? ' ok ' : 'FAIL'}] ${h.surface}  (${h.title})\n        ${h.detail}`);
  console.log(`\n${out.reached}/${out.of} surfaces reached.`);
}
process.exit(hops.some(h => h.reached === false) ? 1 : 0);
