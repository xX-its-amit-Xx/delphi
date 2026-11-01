// Example (a): text -> DesignSpec -> optimize -> per-criterion verdicts.
//   node sim-engine/examples/a-text-to-design/run.mjs
// Calls parse_design_text and design_from_spec (tools/spec-tools.mjs), organism_get and scenario_run
// (tools/studio.mjs): the exported handlers, not copies. Writes nothing outside this folder.
import { parseDesignTextTool, designFromSpec } from '../../tools/spec-tools.mjs';
import { organismGet, scenarioRun } from '../../tools/studio.mjs';
import { n, q, metric, checker, finish, slim, table } from '../_lib.mjs';

const TEXT = 'a zebrafish-derived fish that glides at least 5 m from a 1 m launch and survives 10–30 °C as an adult';
const WHATIF_LAUNCH = 10; // m/s: the flying-fish leap speed (~10 m/s, makiguchi-2013 citing Davenport 1994). Given to a zebrafish it is ASSUMED.
const SEED = 1, BUDGET = 60;
const { checks, expect } = checker();

// 1. parse the sentence
const parsed = await parseDesignTextTool({ text: TEXT });
const P = parsed.result;
expect('parser returns a valid spec', P.validation.ok, JSON.stringify(P.validation.errors));
const spec0 = structuredClone(P.validation.normalised_spec);
const glideC = spec0.criteria.find(c => c.scenario === 'glide');
const tempC = spec0.criteria.filter(c => c.scenario === 'temperature').map(c => c.params.water_temperature_C).sort((a, b) => a - b);
expect('parser reads a glide criterion >= 5 m from 1 m', glideC && glideC.op === '>=' && glideC.value === 5 && glideC.params.launch_height_m === 1, JSON.stringify(glideC));
expect('parser reads 10-30 °C as two survives criteria', JSON.stringify(tempC) === '[10,30]', JSON.stringify(tempC));
expect('parser starts from zebrafish-adult', spec0.start_from.length === 1 && spec0.start_from[0].organism === 'zebrafish-adult', JSON.stringify(spec0.start_from));

// 2. the agent resolves what the parser left open: the editable parts. Ranges come from the two
//    reference organisms (zebrafish value .. flying-fish value), read with organism_get.
const zf = (await organismGet({ organism: 'zebrafish-adult' })).result.parameters;
const ff = (await organismGet({ organism: 'flying-fish' })).result.parameters;
const pv = (P_, k) => P_[k]?.value ?? P_[k];
const editable = [
  { target: { level: 'body', id: 'body' }, param: 'pectoral_area_over_SL2', min: pv(zf, 'pectoral_area_over_SL2'), max: pv(ff, 'pectoral_area_over_SL2') },
  { target: { level: 'body', id: 'body' }, param: 'pectoral_span_over_SL', min: pv(zf, 'pectoral_span_over_SL'), max: pv(ff, 'pectoral_span_over_SL') },
];
const spec = { ...spec0, editable };

// 3. design against the spec exactly as written (the zebrafish's own launch speed)
const honest = await designFromSpec({ spec, seed: SEED, budget: BUDGET });
const H = honest.result;

// 4. a labelled what-if: the same spec, but the glide criterion grants the fish a flying-fish leap speed
const specW = structuredClone(spec);
specW.criteria.find(c => c.scenario === 'glide').params.launch_airspeed_override_m_s = WHATIF_LAUNCH;
const whatif = await designFromSpec({ spec: specW, seed: SEED, budget: BUDGET });
const W = whatif.result;

// 5. re-run the winning what-if design through scenario_run to show what the glide number is made of
let check = null;
if (W.design?.doc) check = await scenarioRun({ organism: W.design.doc, scenario: 'glide', ageDays: 180, params: { launch_height_m: 1, launch_airspeed_override_m_s: WHATIF_LAUNCH } });
const CR = check?.result?.run;

// ------------------------------------------------------------- expectations (what the README claims)
const hExp = H.design?.explanation ?? H.starting_design.explanation;
const hGlide = hExp.criteria.find(c => c.id === glideC.id);
expect('as written: no design meets the spec', H.meets === false && /no design meets the spec|does not meet/.test(H.status), `status=${H.status}`);
expect('as written: glide fails on launch speed below v_min', /launch speed .* below v_min/.test(hGlide?.stages?.[0]?.limiting || ''), hGlide?.stages?.[0]?.limiting);
expect('as written: temperature criteria met at 10 and 30 °C', hExp.criteria.filter(c => c.id !== glideC.id).every(c => c.verdict === 'met'), JSON.stringify(hExp.criteria.map(c => [c.id, c.verdict])));
expect('what-if: meets the spec', W.meets === true && W.status === 'meets the spec', `status=${W.status}`);
const wGlide = W.design?.explanation?.criteria?.find(c => c.id === glideC.id);
expect('what-if: glide >= 5 m at adult', typeof wGlide?.stages?.[0]?.value === 'number' && wGlide.stages[0].value >= 5, JSON.stringify(wGlide?.stages?.[0]));
expect('what-if: no Lean law violated by the winning design', (W.design?.explanation?.lean || []).every(l => l.holds !== false), JSON.stringify(W.design?.explanation?.lean));
expect('re-run of winning design: launch speed labelled assumed (the what-if)', metric(CR, 'launch_airspeed_m_s')?.kind === 'assumed', JSON.stringify(metric(CR, 'launch_airspeed_m_s')));
expect('re-run reproduces the design_from_spec glide value', CR && Math.abs(metric(CR, 'glide_range_total_m')?.value - wGlide?.stages?.[0]?.value) < 1e-9, `${metric(CR, 'glide_range_total_m')?.value} vs ${wGlide?.stages?.[0]?.value}`);
// known studio defects: recorded (not failed) so the README states them; a fix flips the README text
const weakDefect = !!wGlide && wGlide.stages[0].weakest_provenance !== 'assumed';
const feasDefect = !!W.optimizer && W.optimizer.feasible === 0 && W.optimizer.status === 'ok';

// ------------------------------------------------------------- README
const critRows = exp => exp.criteria.flatMap(c => c.stages.map(s => [c.id, c.text, `${c.op}${c.target != null ? ' ' + c.target + ' ' + (c.unit || '') : ''}`, s.stage, s.verdict, typeof s.value === 'number' ? n(s.value) + ' ' + (s.unit || '') : String(s.value), s.weakest_provenance, s.limiting || '']));
const bestVals = W.optimizer?.best_values ? Object.entries(W.optimizer.best_values).map(([k, v]) => `\`${k}\` = ${n(v)}`).join(', ') : 'none';
const rejReasons = [...new Set((H.optimizer?.rejected_sample || []).map(r => r.constraint || r.reason))].join('; ') || 'n/a';
const glideRows = CR ? ['launch_airspeed_m_s', 'v_min_m_s', 'glide_range_lean_bound_m', 'kinetic_phase_m', 'glide_range_total_m', 'wing_loading_N_m2']
  .map(k => [k, n(metric(CR, k)?.value) + ' ' + (metric(CR, k)?.unit || ''), metric(CR, k)?.kind]) : [];
const defects = [];
if (weakDefect) defects.push(`- **weakest_provenance understates the glide verdict.** design_from_spec reports \`${wGlide.stages[0].weakest_provenance}\` for the glide criterion, but the launch speed behind it is \`${metric(CR, 'launch_airspeed_m_s')?.kind}\` in the what-if (and \`calibrated\` as written). lib/spec.mjs explainResult takes the metric's own kind before the run's weakest input. Reported to the hub.`);
if (feasDefect) defects.push('- **The optimizer summary says `feasible: 0`** although the optimizer returned status ok with a feasible best design: tools/spec-tools.mjs reads `o.feasible`, but `optimize` now returns `feasible_candidates`. Reported to the hub.');
if (P.unparsed.length) defects.push(`- **Parser gap:** "${P.unparsed.map(u => u.leftover ?? u.text).join('", "')}" was left unparsed, so \`design_from_spec({text})\` would stop at "needs clarification". Reported to the hub.`);

const readme = `
**Request (plain English):** "${TEXT}"

**Headline.** As written, **${H.status}**. The glide criterion fails because ${hGlide.stages[0].limiting}.
With a labelled **what-if** that gives the fish a flying fish's ~${WHATIF_LAUNCH} m/s leap speed (an *assumed* input for a zebrafish), the optimizer finds a
design that **${W.status}**: ${bestVals}, gliding ${n(wGlide?.stages?.[0]?.value)} m from 1 m. That design rests on the assumption. It is not evidence that a zebrafish-derived fish could glide.

## Step 1. Text to spec (\`parse_design_text\`: rule-based, no LLM)

The parser produced ${spec0.criteria.length} criteria:

${table(['id', 'scenario', 'op', 'value', 'params', 'stages'], spec0.criteria.map(c => [c.id, c.scenario, c.op, c.value ?? '', JSON.stringify(c.params), JSON.stringify(c.stages)]))}

- Text it could not read (returned verbatim, not guessed): ${P.unparsed.length ? P.unparsed.map(u => `"${u.leftover ?? u.text}" (${u.reason})`).join('; ') : 'none'}.
- Defaults it applied: ${P.assumptions.map(a => `"${a}"`).join('; ')}.
- Validation warnings: ${P.validation.warnings.map(w => `${w.path}: ${w.message}`).join('; ') || 'none'}.

${P.unparsed.length ? 'Because some text was left unparsed, calling `design_from_spec` with the raw text would stop with "needs clarification". ' : ''}Acting as the agent, the script
does what AGENT-GUIDE-SPEC.md says. It keeps the parser's \`zebrafish-adult\` start (which is what "zebrafish-derived" means here) and
adds the editable parts the user left open. The ranges run from the zebrafish value to the flying-fish value, read with \`organism_get\` (each value's kind is in output.json under \`ranges_from\`):

${table(['target', 'param', 'min (zebrafish-adult)', 'max (flying-fish)'], editable.map(e => [`${e.target.level}:${e.target.id}`, e.param, n(e.min), n(e.max)]))}

## Step 2. Design against the spec as written (\`design_from_spec\`, seed ${SEED}, budget ${BUDGET})

Status: **${H.status}**. The optimizer made ${H.optimizer?.evaluations ?? 'n/a'} evaluations and rejected ${H.optimizer?.rejected_count ?? 'n/a'}.
Rejection reasons (first 8 are in output.json): ${rejReasons}.

The starting design (plain adult zebrafish), per criterion and stage:

${table(['id', 'criterion', 'target', 'stage', 'verdict', 'value', 'weakest provenance', 'limiting'], critRows(H.starting_design.explanation))}

In the glide model, the zebrafish's launch speed is its own maximum swimming speed. It is *calibrated*: 1.15 x Ucrit, read back from Plaut 2000 (current.mjs).
No pectoral fin inside the range lowers v_min to that speed, so the glide constraint rejects every candidate.

## Step 3. Labelled what-if: grant a ${WHATIF_LAUNCH} m/s launch (\`launch_airspeed_override_m_s\`, kind *assumed*)

Status: **${W.status}**. ${W.summary}
The optimizer made ${W.optimizer?.evaluations} evaluations (including the start design), climbing \`${W.optimizer?.objective?.scenario}.${W.optimizer?.objective?.metric}\` (${W.optimizer?.objective?.direction}).
Winning edits: ${bestVals}.

${table(['id', 'criterion', 'target', 'stage', 'verdict', 'value', 'weakest provenance (as reported)', 'limiting'], W.design ? critRows(W.design.explanation) : [])}

Lean verdicts on the winning design: ${(W.design?.explanation?.lean || []).length ? JSON.stringify(W.design.explanation.lean) : 'no violation reported (a floating-point check of the Lean-backed formulas, not a kernel proof)'}.

**What the ${n(wGlide?.stages?.[0]?.value)} m is made of** (the winning design re-run through \`scenario_run\` glide, with the same parameters):

${table(['metric', 'value', 'kind'], glideRows)}

Only \`glide_range_lean_bound_m\` (${q(metric(CR, 'glide_range_lean_bound_m'), 'm')}) is covered by the Lean theorem \`glide_range_le\`. The level
kinetic-energy phase (${q(metric(CR, 'kinetic_phase_m'), 'm')}) lies outside the theorem's hypotheses, and the assumed launch speed drives it.

## Studio defects seen in this run

${defects.join('\n') || 'none'}

## Scope (from the tool)

${whatif.scope}
`;

finish({
  dir: import.meta.dirname, title: 'Example (a): text to design', checks,
  headline: `as written: ${H.status}; what-if ${WHATIF_LAUNCH} m/s launch (assumed): ${W.status}, glide ${n(wGlide?.stages?.[0]?.value)} m with ${bestVals}`,
  output: {
    text: TEXT, parse: parsed,
    ranges_from: { 'zebrafish-adult': { pectoral_area_over_SL2: zf.pectoral_area_over_SL2, pectoral_span_over_SL: zf.pectoral_span_over_SL }, 'flying-fish': { pectoral_area_over_SL2: ff.pectoral_area_over_SL2, pectoral_span_over_SL: ff.pectoral_span_over_SL } },
    spec, design_as_written: slim(honest), spec_whatif: specW, design_whatif: slim(whatif), whatif_glide_rerun: check ? slim(check) : null,
    known_defects: { weakest_provenance_understated: weakDefect, optimizer_feasible_zero: feasDefect, parser_unparsed: P.unparsed },
  },
  readme,
});
