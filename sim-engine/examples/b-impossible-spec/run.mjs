// Example (b): the request from (a) made impossible -> "no design meets the spec", with the laws that rule it out.
//   node sim-engine/examples/b-impossible-spec/run.mjs
// parse_design_text + design_from_spec (tools/spec-tools.mjs), scenario_run (tools/studio.mjs),
// lean_law_get + lean_check (tools/lean-tools.mjs). Writes nothing outside this folder.
import { parseDesignTextTool, designFromSpec } from '../../tools/spec-tools.mjs';
import { organismGet, scenarioRun } from '../../tools/studio.mjs';
import { lawGet, check as leanCheck } from '../../tools/lean-tools.mjs';
import { n, q, metric, checker, finish, slim, table } from '../_lib.mjs';

const TEXT = 'a zebrafish-derived fish that glides at least 1000 m from a 1 m launch and survives 10–45 °C as an adult';
const WHATIF_LAUNCH = 10; // as in example (a): the glide is evaluated at all only with this assumed launch speed
const SEED = 1, BUDGET = 60;
const { checks, expect } = checker();

const parsed = await parseDesignTextTool({ text: TEXT });
const P = parsed.result;
expect('parser returns a valid spec', P.validation.ok, JSON.stringify(P.validation.errors));
const spec0 = structuredClone(P.validation.normalised_spec);
const glideC = spec0.criteria.find(c => c.scenario === 'glide');
expect('parser keeps the impossible 1000 m target (does not clip it)', glideC?.value === 1000, JSON.stringify(glideC));
const temps = spec0.criteria.filter(c => c.scenario === 'temperature').map(c => c.params.water_temperature_C).sort((a, b) => a - b);
expect('parser keeps 45 °C', JSON.stringify(temps) === '[10,45]', JSON.stringify(temps));

const zf = (await organismGet({ organism: 'zebrafish-adult' })).result.parameters;
const ff = (await organismGet({ organism: 'flying-fish' })).result.parameters;
const pv = (P_, k) => P_[k]?.value ?? P_[k];
const spec = { ...spec0, editable: [
  { target: { level: 'body', id: 'body' }, param: 'pectoral_area_over_SL2', min: pv(zf, 'pectoral_area_over_SL2'), max: pv(ff, 'pectoral_area_over_SL2') },
  { target: { level: 'body', id: 'body' }, param: 'pectoral_span_over_SL', min: pv(zf, 'pectoral_span_over_SL'), max: pv(ff, 'pectoral_span_over_SL') },
] };
spec.criteria.find(c => c.scenario === 'glide').params.launch_airspeed_override_m_s = WHATIF_LAUNCH;

const design = await designFromSpec({ spec, seed: SEED, budget: BUDGET });
const D = design.result;
const startExp = D.starting_design.explanation;

// The model inputs behind the two impossibilities, read from the scenarios themselves
const glideRun = (await scenarioRun({ organism: 'zebrafish-adult', scenario: 'glide', ageDays: 180, params: { launch_height_m: 1, launch_airspeed_override_m_s: WHATIF_LAUNCH } })).result.run;
const tempRun = (await scenarioRun({ organism: 'zebrafish-adult', scenario: 'temperature', ageDays: 180, params: { water_temperature_C: 45 } })).result.run;
const LD = glideRun.provenance.find(p => p.quantity === '(L/D)max');
const ctmax = metric(tempRun, 'ctmax_C'), ctmin = metric(tempRun, 'ctmin_C');

// The laws, from the registry, and a floating-point lean_check of the two claims
const glideLaw = (await lawGet({ id: 'flight-climb-glide-law' })).result;
const thermalLaw = (await lawGet({ id: 'perturb-thermal' })).result;
const claim = {
  taxon: 'Danio rerio', life_stage: 'adult',
  glideHeight_m: 1, glideDistance_m: 1000, LD_max: LD?.value, groundEffect: 0,
  water_temperature_C: 45, ct_min_C: ctmin?.value, ct_max_C: ctmax?.value,
  sustained_power_W: 1e-6, // "survives / keeps swimming" committed as any positive sustained power
};
const lc = await leanCheck({ design: claim });
const rows = lc.result.verdicts || lc.result.results || lc.result.rows || [];
const row = id => (Array.isArray(rows) ? rows : Object.values(rows)).find(r => r.id === id || r.constraint === id || r.constraint_id === id);
const C15 = row('C15'), P1 = row('P1');

// ------------------------------------------------------------- expectations
expect('design_from_spec: no design meets the spec', D.status === 'no design meets the spec' && D.meets === false, `status=${D.status}`);
expect('every optimizer candidate rejected', D.optimizer && D.optimizer.rejected_count === D.optimizer.evaluations, `${D.optimizer?.rejected_count}/${D.optimizer?.evaluations}`);
const tc45 = startExp.criteria.find(c => c.scenario === 'temperature' && /45/.test(JSON.stringify(c)) ) || startExp.criteria.find(c => c.id === spec.criteria.find(x => x.params?.water_temperature_C === 45)?.id);
expect('45 °C criterion fails on the starting design', tc45?.verdict === 'failed', JSON.stringify(tc45?.stages));
expect('45 °C is above the zebrafish CTmax', typeof ctmax?.value === 'number' && ctmax.value < 45, JSON.stringify(ctmax));
expect('flight-climb-glide-law is accepted, theorem glide_range_le', glideLaw.status === 'accepted' && /glide_range_le/.test(glideLaw.lean_ref?.theorem || ''), `${glideLaw.status} ${glideLaw.lean_ref?.theorem}`);
expect('lean_check: C15 (glide range) violated by a 1000 m glide from 1 m', C15?.verdict === 'violated', JSON.stringify(C15)?.slice(0, 300));
expect('lean_check: P1 (thermal window) violated at 45 °C', P1?.verdict === 'violated', JSON.stringify(P1)?.slice(0, 300));
const maxSeen = Math.max(...(D.optimizer?.rejected_sample || []).map(r => typeof r.actual === 'number' ? r.actual : -Infinity));
expect('the best glide any sampled candidate reached is far below 1000 m', maxSeen < 1000, String(maxSeen));

expect('every sampled rejection names the glide constraint', (D.optimizer?.rejected_sample || []).every(r => /glide/.test(r.constraint || '')), JSON.stringify((D.optimizer?.rejected_sample || []).map(r => r.constraint || r.reason)));

// ------------------------------------------------------------- README
const reasons = {};
for (const r of D.optimizer?.rejected_sample || []) reasons[r.constraint || r.reason] = (reasons[r.constraint || r.reason] || 0) + 1;
const bound = (LD?.value ?? NaN) * 1;
const readme = `
**Request:** "${TEXT}". This is example (a) with the glide raised from 5 m to 1000 m and the temperature range widened to 45 °C.
The same labelled what-if launch speed (${WHATIF_LAUNCH} m/s, *assumed*) is kept, so that the glide is limited by the glide law and not only by the zebrafish's launch speed.

**Headline. ${D.status}.** ${D.optimizer?.rejected_count} of ${D.optimizer?.evaluations} candidates were rejected. Two laws rule the request out:

1. **Glide range** — law \`${glideLaw.law_id}\` v${glideLaw.version} (${glideLaw.status}; Lean theorem \`${glideLaw.lean_ref?.theorem}\`, module \`${glideLaw.lean_ref?.module}\`):
   "${glideLaw.statement_en}"
   With h = 1 m and the model's (L/D)max = ${n(LD?.value)} (${LD?.kind}: ${LD?.source || 'stuffed flying fish polar'}), a steady unpowered glide covers at most ${n(bound)} m.
   \`lean_check\` on the claim "1000 m from 1 m" returns **C15 ${C15?.verdict}**${C15?.message ? `: ${C15.message}` : ''}.
2. **Thermal window** — law \`${thermalLaw.law_id}\` v${thermalLaw.version} (${thermalLaw.status}, not yet accepted, so it is advisory; theorem \`${thermalLaw.lean_ref?.theorem}\`):
   "${thermalLaw.statement_en}"
   The temperature scenario gives the adult zebrafish CTmax ${q(ctmax, '°C')} and CTmin ${q(ctmin, '°C')}. 45 °C is outside that window.
   \`lean_check\` returns **P1 ${P1?.verdict}**${P1?.message ? `: ${P1.message}` : ''}. (The CT values are interpolations of the same paper the validation thread scored them against, so the validation thread rates them circular: see validation/STUDIO-FINDINGS.md D4.)

## The optimizer's rejections (\`design_from_spec\`, seed ${SEED}, budget ${BUDGET})

A candidate is rejected at its first broken hard constraint, and the glide constraint is checked first, so every rejection names the glide.

${table(['first broken constraint (sample of ' + (D.optimizer?.rejected_sample?.length ?? 0) + ')', 'count'], Object.entries(reasons))}

The longest glide any sampled candidate reached was ${n(maxSeen)} m (\`glide_range_total_m\`, derived; it includes the level kinetic phase, which lies outside the Lean theorem). That is ${n(1000 / maxSeen, 3)} times short of the target.

## Starting design, per criterion

${table(['id', 'criterion', 'stage', 'verdict', 'value', 'weakest provenance', 'limiting'], startExp.criteria.flatMap(c => c.stages.map(s => [c.id, c.text, s.stage, s.verdict, typeof s.value === 'number' ? n(s.value) + ' ' + (s.unit || '') : String(s.value), s.weakest_provenance, s.limiting || ''])))}

## What the lean_check was given

${table(['field', 'value', 'where it came from'], [
  ['glideHeight_m, glideDistance_m', '1, 1000', 'the request'],
  ['LD_max', n(LD?.value), `glide scenario provenance, kind ${LD?.kind}`],
  ['groundEffect', '0', 'away from the surface (the bound with the measured 14 % drag reduction is only h (L/D)max / 0.86)'],
  ['water_temperature_C', '45', 'the request'],
  ['ct_min_C, ct_max_C', `${n(ctmin?.value)}, ${n(ctmax?.value)}`, `temperature scenario, kinds ${ctmin?.kind}, ${ctmax?.kind}`],
  ['sustained_power_W', '1e-6', '"survives and keeps swimming" written as any positive sustained power (a stand-in for the claim, not a measurement)'],
])}

The lean_check verdicts are floating-point evaluations of the formulas the Lean lemmas encode (\`${glideLaw.constraint_details?.[0]?.lemma}\`, \`${thermalLaw.constraint_details?.[0]?.lemma}\`), not kernel proofs of this case.

## Scope (from the tool)

${design.scope}
`;

finish({
  dir: import.meta.dirname, title: 'Example (b): an impossible spec', checks,
  headline: `${D.status}: ${D.optimizer?.rejected_count}/${D.optimizer?.evaluations} rejected; C15 glide_range ${C15?.verdict} (bound ${n(bound)} m from 1 m vs 1000 m), P1 thermal ${P1?.verdict} (CTmax ${n(ctmax?.value)} °C vs 45 °C)`,
  output: { text: TEXT, parse: parsed, spec, design: slim(design), glide_run: glideRun, temperature_run: tempRun,
    laws: { glide: { law_id: glideLaw.law_id, version: glideLaw.version, status: glideLaw.status, lean_ref: glideLaw.lean_ref, statement_en: glideLaw.statement_en, constraint_details: glideLaw.constraint_details },
      thermal: { law_id: thermalLaw.law_id, version: thermalLaw.version, status: thermalLaw.status, lean_ref: thermalLaw.lean_ref, statement_en: thermalLaw.statement_en, constraint_details: thermalLaw.constraint_details } },
    lean_check_input: claim, lean_check: lc },
  readme,
});
