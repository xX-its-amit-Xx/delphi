#!/usr/bin/env node
// Tests for the fifth named result. `node sim-engine/validate/physics/test/physics.mjs`
//
// EVERY CHECK WAS MADE TO FAIL ONCE. `MUTATE=<name>` plants the corresponding defect and the check
// that guards it must go red; if it stays green the check is decoration. Run
// `node test/physics.mjs --selftest` to plant every mutation in turn and confirm each one is caught.
//
//   MUTATE=vmin_pass            a design that cannot reach v_min is reported as achieving its function
//   MUTATE=no_model_passes      a criterion with no scenario is reported as met
//   MUTATE=drop_unchecked       a no-model criterion is dropped from unchecked_requirements
//   MUTATE=confidence_missing   a met criterion is reported without model_confidence
//   MUTATE=ensemble_ignored     a criterion met in a small minority of draws is still reported met
//   MUTATE=gate_open            physics_gate_failed stays false although a hard criterion is not met
import { physicsCheck, holds, readCriterion, filterParams, agesForStage, inferFunction } from '../index.mjs';
import { modelConfidence, studioResults } from '../provenance.mjs';
import { loadCreatures, baseParamsFromState, ownSummarise, OWN_DISTRIBUTIONS } from '../ensemble.mjs';

const M = process.env.MUTATE || '';
let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; } else { fail++; console.log(`  FAIL ${what}`); } };
const section = s => console.log(`\n${s}`);

const GLIDE = h => ({ start_from: [], criteria: [
  { id: 'g-feasible', scenario: 'glide', op: 'feasible', params: { launch_height_m: 1 }, stages: ['adult'], hard: true, weight: 1 },
  { id: 'g-range', scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: h, unit: 'm', params: { launch_height_m: 1 }, stages: ['adult'], hard: true, weight: 1 },
] });

// Mutations are applied to the RESULT, which is exactly how a wrong implementation would look.
function mutate(r) {
  if (M === 'vmin_pass') { r.function_achieved = true; r.physics_gate_failed = false; for (const c of r.criteria) { c.status = 'met'; for (const s of c.per_stage) s.status = 'met'; } }
  if (M === 'no_model_passes') for (const c of r.criteria) if (c.status === 'no model') { c.status = 'met'; for (const s of c.per_stage) s.status = 'met'; }
  if (M === 'drop_unchecked') r.unchecked_requirements = [];
  if (M === 'confidence_missing') for (const c of r.criteria) { c.model_confidence = null; for (const s of c.per_stage) s.model_confidence = null; }
  if (M === 'ensemble_ignored') for (const c of r.criteria) for (const s of c.per_stage) if (s.ensemble && s.ensemble.fraction_achieved < 0.5) s.status = 'met';
  if (M === 'gate_open') r.physics_gate_failed = false;
  return r;
}
const check = async (design, opts) => mutate(await physicsCheck(design, opts));

// ---------------------------------------------------------------- 1. pure helpers
section('1. helpers');
ok(holds('>=', 5, 3) === true && holds('>=', 2, 3) === false, 'holds >=');
ok(holds('<=', 2, 3) === true && holds('feasible', true) === true && holds('feasible', null) === false, 'holds <= / feasible');
ok(holds('feasible', false) === false, 'feasible false is not met');
ok(holds('maximize', 5, null) === null, 'maximize has no threshold');
{
  const s = { params: [{ key: 'launch_height_m' }, { key: 'ground_effect' }] };
  const { params, dropped } = filterParams(s, { launch_height_m: 2, headwind_m_s: 5 });
  ok(params.launch_height_m === 2 && !('headwind_m_s' in params) && dropped.includes('headwind_m_s'),
    'filterParams keeps declared params and reports the dropped ones (an undeclared param makes runScenario refuse the whole run)');
}
{
  const stages = [{ ageDays: 0, key: 'stage_000d', label: 'hatching' }, { ageDays: 3, key: 'stage_003d', label: 'larva' }, { ageDays: 10, key: 'stage_010d', label: 'larva' }, { ageDays: 365, key: 'stage_365d', label: 'adult' }];
  ok(agesForStage(stages, 'adult')[0].ageDays === 365, 'adult stage resolves to the adult age');
  ok(agesForStage(stages, 'larva')[0].ageDays === 10, 'larva resolves to the LAST larval age (the most developed form of the stage)');
  ok(agesForStage(stages, 'embryo')[0].ageDays === 0, 'embryo maps onto the hatching stage this staging table does have');
  ok(agesForStage(stages, 'nonesuch').length === 0, 'a stage the table does not have resolves to nothing, so the criterion can report no model');
}

// ---------------------------------------------------------------- 2. THE CENTRAL TEST
// A design that cannot reach v_min must NEVER report its function achieved.
section('2. a design that cannot reach v_min never reports its function achieved');
for (const id of ['zebrafish-adult', 'winged-zebrafish', 'wingless-flying-fish']) {
  const r = await check(id, { spec: GLIDE(10), draws: 40 });
  const vmin = r.standing_checks.find(s => s.id === 'reaches_minimum_flight_speed');
  ok(r.ran === true, `${id}: the check ran`);
  ok(vmin && vmin.status === 'not met', `${id}: reaches_minimum_flight_speed is not met`);
  ok(r.function_achieved === false, `${id}: function_achieved is FALSE although the design was asked to glide`);
  ok(r.physics_gate_failed === true, `${id}: physics_gate_failed is true`);
  const range = r.criteria.find(c => c.metric === 'glide_range_total_m');
  ok(range.status === 'not met', `${id}: the glide-range criterion is not met`);
  ok(range.per_stage.every(s => s.status !== 'met'), `${id}: no stage reports met`);
  ok(/below v_min|cannot glide|does not satisfy/i.test(range.limiting_factor || ''), `${id}: the limiting factor names the speed shortfall`);
  ok(range.per_stage.every(s => !s.ensemble || s.ensemble.fraction_achieved === 0), `${id}: 0 % of ensemble draws achieve the function`);
}

// ---------------------------------------------------------------- 3. no model is reported, never passed
section('3. a scenario with no model reports `no model`, never a pass');
{
  const spec = { start_from: [], criteria: [
    { id: 'absent', scenario: 'photosynthesis', metric: 'oxygen_mg_h', op: '>=', value: 1, unit: null, params: {}, stages: ['adult'], hard: true, weight: 1, source_text: 'a scenario this engine does not have' },
  ] };
  const r = await check('zebrafish-adult', { spec, draws: 0 });
  const c = r.criteria[0];
  ok(c.status === 'no model', 'an absent scenario reports status `no model`');
  ok(c.status !== 'met', 'it is NOT reported as met');
  ok(r.function_achieved === false, 'function_achieved is false when a hard criterion has no model');
  ok(r.gate_status === 'incomplete', 'the gate status is `incomplete`, not `pass`');
  ok(/INCOMPLETE/.test(r.gate) && /NOT checked/.test(r.gate), 'the gate string says the requirement was not checked');
  ok(r.unchecked_requirements.length === 1 && r.unchecked_requirements[0].scenario === 'photosynthesis',
    'the unchecked requirement is LISTED, not dropped');
  ok(c.model_confidence?.validated === 'no model', 'its model_confidence is `no model`');
}
{
  // A scenario that exists but cannot run on this STATE: the grip scenario on a fish with no gripping organ.
  const spec = { start_from: [], criteria: [
    { id: 'grip', scenario: 'grip', metric: 'adhesive_force_N', op: '>=', value: 0.01, unit: 'N', params: {}, stages: ['adult'], hard: true, weight: 1 },
  ] };
  const r = await check('zebrafish-adult', { spec, draws: 0 });
  ok(r.criteria[0].status === 'no model', 'a metric that is not computable on this STATE reports `no model`');
  ok(r.unchecked_requirements.length >= 1, 'and is listed as unchecked');
}
{
  // A stage this organism's staging table does not have.
  const spec = { start_from: [], criteria: [
    { id: 'stageless', scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 1, unit: 'm', params: {}, stages: ['nonesuch'], hard: true, weight: 1 },
  ] };
  const r = await check('flying-fish', { spec, draws: 0 });
  ok(r.criteria[0].per_stage[0].status === 'no model', 'a stage the organism does not have reports `no model` for that stage');
  ok(r.unchecked_requirements.length === 1, 'and is listed as unchecked');
}

// ---------------------------------------------------------------- 4. never a verdict without provenance
section('4. "function achieved" never appears without its model_confidence');
{
  const r = await check('flying-fish', { spec: GLIDE(10), draws: 40 });
  ok(r.function_achieved === true, 'the real flying fish achieves a realistic glide');
  for (const c of r.criteria) {
    ok(!!c.model_confidence && typeof c.model_confidence.validated === 'string', `criterion ${c.id} carries a model_confidence`);
    for (const s of c.per_stage) ok(!!s.model_confidence, `criterion ${c.id} @ ${s.stage} carries a model_confidence`);
  }
  for (const s of r.standing_checks) ok(!!s.model_confidence, `standing check ${s.id} carries a model_confidence`);
  ok(r.criteria.every(c => c.model_confidence?.validated !== 'independent'),
    'the glide model is NOT reported as independently validated: every validatedAgainst entry it has admits it is a code check or partly circular');
  ok(r.model_honesty.circular_checks.length > 0, 'the circular checks are named in model_honesty');
}

// ---------------------------------------------------------------- 5. the ensemble decides, not the midpoint
section('5. a function achieved in a minority of draws is not achieved');
{
  // 72.9 m is above the flying fish's 5-95 % band upper edge at 400 draws, so only a few draws reach it.
  const r = await check('flying-fish', { spec: GLIDE(70), draws: 200 });
  const c = r.criteria.find(x => x.metric === 'glide_range_total_m');
  const s = c.per_stage[0];
  ok(s.ensemble && s.ensemble.draws === 200, 'the ensemble ran');
  ok(s.ensemble.fraction_achieved < 0.5, `only ${(s.ensemble.fraction_achieved * 100).toFixed(1)} % of draws reach 70 m`);
  ok(s.status === 'not met', 'so the criterion is NOT met, whatever the single deterministic run says');
  ok(/draws/.test(s.limiting_factor || ''), 'and the limiting factor names the fraction of draws');
}
{
  const r = await check('flying-fish', { spec: GLIDE(10), draws: 60 });
  const s = r.criteria.find(x => x.metric === 'glide_range_total_m').per_stage[0];
  ok(s.ensemble.median != null && s.ensemble.p5 != null && s.ensemble.p95 != null, 'the median and the 5-95 % band are reported, never a bare yes/no');
  ok(s.ensemble.p5 <= s.ensemble.median && s.ensemble.median <= s.ensemble.p95, 'the band brackets the median');
  ok(typeof s.ensemble.note === 'string' && /ILLUSTRATION/i.test(s.ensemble.note), 'the uncertainty note travels with the band');
  ok(s.ensemble.distributions.every(d => d.band_kind && d.shape_kind), 'every distribution states the provenance of its SPREAD apart from the provenance of its SHAPE');
}
{
  const a = await physicsCheck('flying-fish', { spec: GLIDE(10), draws: 50, seed: 'same' });
  const b = await physicsCheck('flying-fish', { spec: GLIDE(10), draws: 50, seed: 'same' });
  const c = await physicsCheck('flying-fish', { spec: GLIDE(10), draws: 50, seed: 'other' });
  const med = r => r.criteria.find(x => x.metric === 'glide_range_total_m').per_stage[0].ensemble.median;
  ok(med(a) === med(b), 'the same seed gives the same ensemble');
  ok(med(a) !== med(c), 'a different seed gives a different one');
}

// ---------------------------------------------------------------- 6. the headline result
section('6. the TFF cannot pay for powered flight');
{
  const spec = { start_from: [], criteria: [
    { id: 'powered', scenario: 'glide', metric: 'powered_flight_margin', op: '>=', value: 1, unit: '1', params: { launch_height_m: 1 }, stages: ['adult'], hard: true, weight: 1 },
  ] };
  const r = await check('tff', { spec, draws: 60 });
  const s = r.criteria[0].per_stage[0];
  ok(r.function_achieved === false && r.physics_gate_failed === true, 'the TFF does not achieve powered flight and the gate fails');
  ok(s.measured < 1, `the aerobic power margin is ${s.measured.toFixed(4)}, far below 1`);
  ok(s.ensemble.fraction_achieved === 0, 'no draw in the ensemble reaches a margin of 1');
  const organ = r.standing_checks.find(x => x.id === 'organ_volume_fits_body');
  ok(organ.status === 'not met', 'and the standing organ-fit check fails too: the requested flight muscle does not fit in the body');
}

// ---------------------------------------------------------------- 7. the spec is authoritative
section('7. opts.spec is authoritative; inference is labelled as inference');
{
  const withSpec = await physicsCheck('tff', { spec: GLIDE(10), draws: 0 });
  ok(withSpec.target_function.source === 'spec', 'a spec is used as given');
  ok(/authoritative/i.test(withSpec.target_function.statement), 'and is said to be authoritative');
  ok(withSpec.criteria.every(c => c.inferred === false), 'no criterion is marked inferred');
  const noSpec = await physicsCheck('tff', { draws: 0 });
  ok(noSpec.target_function.source === 'inferred', 'with no spec the function is inferred');
  ok(/INFERRED/.test(noSpec.target_function.statement) && typeof noSpec.target_function.inferred_from === 'string',
    'and the inference says so and quotes the words it was inferred from');
  ok(noSpec.criteria.every(c => c.inferred === true), 'every inferred criterion is marked inferred');
  ok(noSpec.target_function.inferred_function === 'powered-flight', "the TFF's declared intent infers the POWERED-flight function, not a glide");
  ok(inferFunction({ id: 'z', base: { parents: [{ organism: 'zebrafish-adult', weight: 1 }] } }, { organisms: { 'zebrafish-adult': { name: 'zebrafish (Danio rerio), adult' } } }).id === 'swim',
    'a design with no flight intent infers the swim function');
}

// ---------------------------------------------------------------- 8. a specimen has no STATE
section('8. inputs that cannot be run say so');
{
  const r = await physicsCheck({ specimen: { body_SL: 1 } }, {});
  ok(r.ran === false && /specimen/.test(r.reason), 'a specimen is reported as not runnable, not guessed at');
  const n = await physicsCheck(null, {});
  ok(n.ran === false, 'no design reports ran: false');
}

// ---------------------------------------------------------------- 9. the ensemble module
section('9. the ensemble consumes the physics thread\'s module when it is there');
{
  const c = await loadCreatures();
  console.log(`  creatures.js: ${c.ok ? 'LANDED and consumed' : `absent (${c.reason})`}`);
  const r = await physicsCheck('flying-fish', { spec: GLIDE(10), draws: 20 });
  const e = r.criteria.find(x => x.metric === 'glide_range_total_m').per_stage[0].ensemble;
  ok(e.source === (c.ok ? 'creatures.js' : 'own'), 'the ensemble names which implementation ran');
  ok(c.ok ? e.file.includes('creatures.js') : !!e.fell_back_because, 'and either names the file or says why it fell back');
  ok(OWN_DISTRIBUTIONS.find(d => d.key === 'launch_airspeed_m_s').band_kind === 'measured-secondhand'
    && OWN_DISTRIBUTIONS.find(d => d.key === 'launch_airspeed_m_s').shape_kind === 'assumed',
    'the fallback catalogue keeps the band provenance apart from the shape provenance');
  const s = ownSummarise([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  ok(s.median === 5.5 && s.n === 10, 'the fallback percentiles are right');
  ok(ownSummarise([]).median === null, 'an empty sample gives null, not 0');
}
{
  // The non-flier gate: no sourced launch-speed spread means the launch speed is NOT drawn.
  const r = await physicsCheck('zebrafish-adult', { spec: GLIDE(10), draws: 20 });
  const e = r.criteria.find(x => x.metric === 'glide_range_total_m').per_stage[0].ensemble;
  ok(e.species_gate.is_flier === false, 'a zebrafish is not gated into the 15-20 m/s taxi band');
  ok(e.not_drawn.includes('launch_airspeed_m_s'), 'and its launch speed is reported as NOT drawn');
  ok(/does NOT apply/.test(e.species_gate.note), 'with the reason stated');
}

// ---------------------------------------------------------------- 9b. the STAGE gate on the taxi band
section('9b. the 15-20 m/s taxi band is not handed to a larva');
{
  // creatures.js's isFlier reads the SPECIES text only, so without a stage gate a flying-fish larva
  // would be given the adult take-off speed and would "glide" 40 m. This is the defect the
  // independent validation thread recorded as D1; it must not come back through the ensemble.
  const spec = { start_from: [], criteria: [
    { id: 'g', scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 10, unit: 'm', params: { launch_height_m: 1 }, stages: 'all', hard: true, weight: 1 },
  ] };
  const r = await check('flying-fish', { spec, draws: 60 });
  const by = s => r.criteria[0].per_stage.find(x => x.stage === s);
  ok(by('adult') && by('larva') && by('juvenile') && by('embryo'), 'every stage of the flying fish was evaluated');
  ok(by('adult').ageDays === 365 && by('embryo').ageDays === 0,
    'the stage names map onto the right ages (the adult label contains the word "hatching", so matching the whole label would make embryo hit the adult)');
  ok(by('adult').status === 'met', 'the ADULT flying fish glides');
  for (const s of ['embryo', 'larva', 'juvenile']) {
    ok(by(s).status === 'not met', `the ${s} does NOT glide`);
    ok(by(s).ensemble.species_gate.launch_speed_drawn === false, `the ${s} is not handed the adult taxi band`);
    ok(by(s).ensemble.species_gate.species_matches_flier === true, `although its species text does match the flier gate (${s})`);
    ok(/ADULT flying fish only/.test(by(s).ensemble.species_gate.note), `and the reason is stated (${s})`);
    ok(by(s).ensemble.fraction_achieved === 0, `0 % of draws glide at ${s}`);
  }
  ok(by('adult').ensemble.species_gate.launch_speed_drawn === true, 'the adult IS handed the taxi band');
  ok(r.criteria[0].status === 'not met' && r.criteria[0].stages_met === 1, 'a criterion asked at all stages is not met when only one stage meets it');
}

// ---------------------------------------------------------------- 10. model_confidence reads the real files
section('10. model_confidence is read from the harness and the model cards, not hard-coded');
{
  const S = studioResults();
  ok(!S.error, `studio-results.json is readable (${S.error || S.generated_at})`);
  ok(S.byModule.get('glide')?.length > 0, 'it has rows for the glide module');
  const mc = modelConfidence({ extra: { statement: 'x' } });
  ok(mc.validated === 'no model', 'no scenario and no model gives `no model`');
  const bad = modelConfidence({ scenario: { key: 'nonesuch', modelCard: { equations: [], sources: [], validity: '' } } });
  ok(bad.validated === 'unvalidated', 'a scenario with no validatedAgainst and no harness row is `unvalidated`, never a pass');
}

// ---------------------------------------------------------------- 11. standing checks are named, not summed
section('11. the standing checks are named checks, never one number');
{
  const r = await physicsCheck('flying-fish', { spec: GLIDE(10), draws: 0 });
  const ids = r.standing_checks.map(s => s.id);
  for (const id of ['reaches_minimum_flight_speed', 'lifting_area_supports_mass', 'sustained_swimming_aerobic_ceiling', 'organ_volume_fits_body', 'static_pitch_margin'])
    ok(ids.includes(id), `standing check ${id} is reported`);
  ok(r.standing_checks.every(s => 'measured' in s && 'threshold' in s && 'limiting_factor' in s),
    'each carries its own measured value, threshold and limiting factor');
  const sm = r.standing_checks.find(s => s.id === 'static_pitch_margin');
  ok(sm.status === 'no model' && /no geometry/.test(sm.limiting_factor), 'static_pitch_margin reports `no model`, with the reason');
  ok(sm.detail.measured_elsewhere.rows.length === 4, 'and quotes the print measurements as what they are');
  ok(!('score' in r) && !('composite' in r), 'nothing here produces a composite score: this is a gate, not a score');
}

// ---------------------------------------------------------------- selftest
if (process.argv.includes('--selftest')) {
  const { execFileSync } = await import('node:child_process');
  const muts = ['vmin_pass', 'no_model_passes', 'drop_unchecked', 'confidence_missing', 'ensemble_ignored', 'gate_open'];
  console.log('\nself-test: each mutation must make at least one check fail');
  let bad = 0;
  for (const m of muts) {
    let out = '';
    try { out = execFileSync(process.execPath, [import.meta.filename], { env: { ...process.env, MUTATE: m }, encoding: 'utf8' }); }
    catch (e) { out = `${e.stdout || ''}${e.stderr || ''}`; }
    const caught = /FAIL/.test(out);
    console.log(`  MUTATE=${m.padEnd(20)} ${caught ? 'caught' : 'NOT CAUGHT -- the check is decoration'}`);
    if (!caught) bad++;
  }
  console.log(bad ? `\n${bad} mutation(s) NOT caught` : '\nevery mutation caught');
  process.exit(bad ? 1 : 0);
}

console.log(`\n${pass} passed, ${fail} failed${M ? ` (MUTATE=${M})` : ''}`);
process.exit(fail ? 1 : 0);
