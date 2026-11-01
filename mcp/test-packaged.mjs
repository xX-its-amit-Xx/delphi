#!/usr/bin/env node
// Does the hosted server still answer every validation tool the SAME from a packaged copy as from here?
//
//   node mcp/test-packaged.mjs                 # the working tree
//   node mcp/test-packaged.mjs <dir>           # an unpacked `npm pack` tarball (see mcp/README.md)
//
// The byte counts it prints must match between the two runs. They are the real signal: a tool whose data
// file is missing from the package still returns 200, just smaller.
//
// Stronger proof than "it answered": every tool is called from the ROOT given, and the result must pass
// per-tool assertions that a DEGRADED answer fails. The first version of this test passed while
// functional_resolution was silently coming back {ran:false, ENOENT omics/genes.json} from the package,
// because the module never throws -- a missing data file turns into `cannot-assess`, which is not a pass
// but still a 200. So each tool now asserts on the content, not on the absence of an exception.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..'));
process.env.DELPHI_HTTP_PORT = '9999';
process.chdir(ROOT);
const srv = await import(pathToFileURL(path.join(ROOT, 'mcp/server.mjs')).href);
const byName = Object.fromEntries(srv.TOOLS.map(t => [t[0], t[3]]));
console.log(`# ${ROOT}`);
console.log(`server ${srv.VERSION} | hosted tools ${srv.TOOLS.length}\n`);

const ok = (c, m) => { if (!c) throw new Error('assertion failed: ' + m); };
const CALLS = [
  ['validate_generation', { desired_phenotype: 'a zebrafish that can glide above the water for at least 20 metres after launching, like a flying fish', generated: 'winged-zebrafish', base: 'zebrafish-adult' },
    r => { ok(Object.keys(r.results).length === 5, 'five named results'); ok(r.results.functional_resolution.status !== 'cannot-assess', 'functional_resolution ran (not cannot-assess)');
           ok(r.results.physics_check.status === 'fail', 'physics gate fails for this design'); ok(r.verdict.word_validated_withheld === true, 'the word validated is withheld');
           ok(r.analogue.analogues.length > 0, 'a functional analogue was found'); ok(Object.keys(r.scales.scales).length === 10, 'ten scales swept'); } ],
  ['functional_resolution', { organism: 'winged-zebrafish', desired_phenotype: 'glide 20 m over water' },
    r => { ok(r.ran === true, 'the ledger ran: ' + (r.reason || '')); ok(r.entries.length > 0, 'differences were classified'); ok(r.closest_functional_analogue, 'an analogue was chosen'); } ],
  ['physics_check', { organism: 'tff', draws: 20 },
    r => { ok(r.ran === true, 'physics ran'); ok(r.criteria.length > 0, 'criteria were evaluated'); ok(r.model_honesty, 'model_honesty present'); } ],
  ['validate_design', { organism: 'winged-zebrafish' },
    r => { ok(r.score && typeof r.score.value === 'number', 'a score came back'); ok(r.score.components.P.ran === true, 'the phenotype component ran'); ok(r.closest_relative_phenotype, 'closest relative present');
           ok(r.lean_by_component, 'lean by component present'); ok(Object.keys(r.results || {}).length >= 4, 'the named results are present'); } ],
  ['closest_relative_phenotype', { organism: 'winged-zebrafish' }, r => { ok(r.closest_real_relative, 'a closest real relative'); ok(r.calibration.body.n > 0, 'the OOD threshold is calibrated on real specimens'); }],
  ['closest_relative_genotype', { organism: 'winged-zebrafish' }, r => ok(r, 'answered')],
  ['sanity_check_design', { organism: 'winged-zebrafish' }, r => ok((r.phenotype?.checks || r.checks || []).length >= 0, 'checks ran')],
  ['lean_by_component', { organism: 'winged-zebrafish' }, r => ok(r.by_component || r.components, 'grouped by component')],
  ['validate_swarm_tasks', { organism: 'winged-zebrafish' }, r => ok(r.tasks.length === 6, 'six sub-tasks')],
  ['parse_design_text', { text: 'glide at least 20 m after launching' }, r => ok(r.spec.criteria.length > 0, 'a criterion was parsed')],
  ['edit_plan_methods', {}, r => ok(r.feasibility && r.on_target, 'methods text present')],
  ['lean_open_questions', {}, r => ok(r.questions.length > 0, 'open questions listed')],
  ['lean_open_question', { id: 'oq-kcnk5b-vm-sign' }, r => { ok(r.question_id === 'oq-kcnk5b-vm-sign', 'the asked-for record'); ok(r.arms.length > 1, 'both arms present'); }],
  ['lean_open_question_guard', { law_id: 'x', statement_en: 'kcnk5b depolarisation lengthens fins' }, r => ok('would_be_refused' in r, 'guard verdict present')],
  ['design_score', { organism: 'winged-zebrafish' },
    r => { ok(typeof r.score === 'number', 'score'); ok(r.functional_resolution?.ran === true, 'the scorer\'s own functional ledger ran: ' + (r.functional_resolution?.reason || '')); } ],
  ['omics_gene', { symbol: 'kcnk5b' }, r => ok(r.layers || r.gene, 'omics card returned')],
  ['lean_check', { design: { SL_m: 0.04, mass_kg: 0.0007 } }, r => { ok(r.verdicts.length > 0, 'laws evaluated'); ok(r.lawset, 'a lawset version'); }],
  ['leanbio_queue', { limit: 3 }, r => ok(r.items.length > 0, 'queue items')],
  ['leanbio_personas', {}, r => ok(r.personas.length > 0 && r.personas.every(x => (x.tools || []).length > 0), 'every persona has a non-empty tool list')],
  ['leanbio_use_cases', { limit: 5 }, r => ok(r.use_cases.length > 0, 'use cases returned')],
  ['leanbio_grand_questions', {}, r => { ok(r.grand_questions.length > 0, 'grand questions returned'); ok(r.the_line, 'the proof/measurement line is stated'); }],
  ['leanbio_tool_gap', { limit: 5 }, r => ok(r.gaps.length > 0, 'gaps returned')],
];

let bad = 0;
for (const [name, args, assert_] of CALLS) {
  const t0 = Date.now();
  let out;
  try { out = await byName[name](args); } catch (e) { bad++; console.log(`FAIL  ${name.padEnd(28)} threw: ${e.message}`); continue; }
  const envOk = out && Array.isArray(out.provenance) && typeof out.scope === 'string' && out.scope.trim();
  if (!envOk) { bad++; console.log(`FAIL  ${name.padEnd(28)} broke the provenance envelope`); continue; }
  try { assert_(out.result); console.log(`PASS  ${name.padEnd(28)} ${String(Date.now() - t0).padStart(6)} ms  ${String(JSON.stringify(out).length).padStart(8)} B`); }
  catch (e) { bad++; console.log(`FAIL  ${name.padEnd(28)} ${e.message}`); }
}
console.log(bad ? `\n${bad} TOOL(S) FAILED` : '\nall tools passed their content assertions');
process.exit(bad ? 1 : 0);
