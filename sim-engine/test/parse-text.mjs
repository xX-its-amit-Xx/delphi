// node sim-engine/test/parse-text.mjs            run the corpus + spec checks
// node sim-engine/test/parse-text.mjs --mutate   prove every corpus case can fail: each case is re-run
//                                                against a deliberately damaged parse, and the run
//                                                passes only if EVERY case then fails
//
// Corpus: sentences with the DesignSpec they must produce (partial match: only keys written in
// `expect` are compared; criteria are compared in order and their COUNT must match exactly).

import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.__fs = fs;
import { parseDesignText, splitClauses } from '../lib/parse-text.mjs';
import { validateSpec, specToObjective, explainResult, makeRegistry, loadRegistry, stagePoints, convert, AVES_REFUSAL } from '../lib/spec.mjs';

const MUTATE = process.argv.includes('--mutate');
let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; if (!MUTATE) console.log(`  ok    ${name}`); }
  catch (e) { fail++; if (!MUTATE) console.log(`  FAIL  ${name}\n          ${e.message.split('\n').join('\n          ')}`); }
};

// partial deep match with numeric tolerance
function match(actual, expected, path = '') {
  if (expected instanceof RegExp) { assert.ok(expected.test(typeof actual === 'string' ? actual : JSON.stringify(actual)), `${path}: ${JSON.stringify(actual)} !~ ${expected}`); return; }
  if (typeof expected === 'number') { assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-3 * Math.max(1, Math.abs(expected)), `${path}: ${actual} != ${expected}`); return; }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: not an array (${JSON.stringify(actual)})`);
    assert.equal(actual.length, expected.length, `${path}: length ${actual.length} != ${expected.length}: ${JSON.stringify(actual)}`);
    expected.forEach((e, i) => match(actual[i], e, `${path}[${i}]`)); return;
  }
  if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', `${path}: missing (${JSON.stringify(actual)})`);
    for (const k of Object.keys(expected)) match(actual[k], expected[k], `${path}.${k}`);
    return;
  }
  assert.equal(actual, expected, `${path}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

const ZF = [{ organism: 'zebrafish-adult', weight: 1 }], FF = [{ organism: 'flying-fish', weight: 1 }];
const T = (t, stages = ['adult']) => ({ scenario: 'temperature', op: 'survives', params: { water_temperature_C: t }, stages, hard: true });

// { text, expect:{start_from, criteria, editable}, unparsed:n|RegExp, refused:n, assume:RegExp, invalid:RegExp }
const CORPUS = [
  // ── the headline request
  { text: 'a zebrafish that glides at least 30 m from 1 m height, survives 4 °C to 32 °C, outswims a 0.3 m/s current as a larva and adult, keep the Lean laws',
    expect: { start_from: ZF, constraints: { lean: 'must-hold' }, criteria: [
      { scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 30, unit: 'm', params: { launch_height_m: 1 }, stages: ['adult'], hard: true },
      T(4), T(32),
      { scenario: 'current', op: 'feasible', params: { current_m_s: 0.3 }, stages: ['larva', 'adult'] }] }, unparsed: 0, refused: 0 },
  // ── organisms
  { text: '70% zebrafish 30% flying fish that survives 10 °C', expect: { start_from: [{ organism: 'zebrafish-adult', weight: 0.7 }, { organism: 'flying-fish', weight: 0.3 }], criteria: [T(10)] }, unparsed: 0 },
  { text: 'a flying fish that glides at least 50 m from 2 m', expect: { start_from: FF, criteria: [{ scenario: 'glide', metric: 'glide_range_total_m', value: 50, params: { launch_height_m: 2 } }] }, unparsed: 0 },
  { text: 'a winged zebrafish that glides at least 10 m from 0.5 m height as an adult', expect: { start_from: [{ organism: 'winged-zebrafish', weight: 1 }], criteria: [{ scenario: 'glide', value: 10, params: { launch_height_m: 0.5 }, stages: ['adult'] }] }, unparsed: 0 },
  { text: 'a wingless flying fish that outswims a 0.5 m/s current at all stages', expect: { start_from: [{ organism: 'wingless-flying-fish', weight: 1 }], criteria: [{ scenario: 'current', op: 'feasible', params: { current_m_s: 0.5 }, stages: 'all' }] }, unparsed: 0 },
  { text: 'TFF that glides at least 100 m from 1 m', expect: { start_from: [{ organism: 'tff', weight: 1 }], criteria: [{ scenario: 'glide', value: 100 }] }, unparsed: 0 },
  { text: 'half zebrafish half flying fish gliding at least 20 m from 1 m', expect: { start_from: [{ organism: 'zebrafish-adult', weight: 0.5 }, { organism: 'flying-fish', weight: 0.5 }], criteria: [{ scenario: 'glide', value: 20 }] }, unparsed: 0 },
  { text: 'a zebrafish and a flying fish that survive 20 °C', expect: { start_from: [{ organism: 'zebrafish-adult', weight: 0.5 }, { organism: 'flying-fish', weight: 0.5 }], criteria: [T(20)] }, assume: /equal weights/, unparsed: 0 },
  // ── units
  { text: 'a zebrafish that survives 277 K to 305 K', expect: { criteria: [T(3.85), T(31.85)] }, unparsed: 0 },
  { text: 'zebrafish surviving 40 °F', expect: { criteria: [T(4.444)] }, unparsed: 0 },
  { text: 'zebrafish that survives 4 to 32 degrees Celsius', expect: { criteria: [T(4), T(32)] }, unparsed: 0 },
  { text: 'a zebrafish that swims at least 10 BL/s as a juvenile', expect: { criteria: [{ scenario: 'current', metric: 'ucrit_m_s', op: '>=', value: 10, unit: 'BL/s', stages: ['juvenile'] }] }, unparsed: 0 },
  { text: 'a zebrafish that swims at least 1.8 km/h', expect: { criteria: [{ metric: 'ucrit_m_s', value: 1.8, unit: 'km/h' }] }, unparsed: 0 },
  { text: 'a zebrafish that outswims a 30 cm/s current', expect: { criteria: [{ scenario: 'current', params: { current_m_s: 0.3 } }] }, unparsed: 0 },
  { text: 'a zebrafish that holds station in a 1 knot current', expect: { criteria: [{ scenario: 'current', op: 'feasible', params: { current_m_s: 0.514 } }] }, unparsed: 0 },
  { text: 'a zebrafish that survives a dive to 50 m depth', expect: { criteria: [{ scenario: 'pressure', params: { depth_m: 50, water: 'sea' } }] }, assume: /seawater assumed/, unparsed: 0 },
  { text: 'a zebrafish that survives 5 atm', expect: { criteria: [{ scenario: 'pressure', params: { pressure_kPa: 506.625 } }] }, unparsed: 0 },
  { text: 'a zebrafish that survives 2 MPa', expect: { criteria: [{ scenario: 'pressure', params: { pressure_kPa: 2000 } }] }, unparsed: 0 },
  { text: 'a zebrafish that survives 3 bar', expect: { criteria: [{ scenario: 'pressure', params: { pressure_kPa: 300 } }] }, unparsed: 0 },
  { text: 'a zebrafish that lives at 2000 m altitude', expect: { criteria: [{ scenario: 'altitude', params: { altitude_m: 2000 } }] }, unparsed: 0 },
  { text: 'a flying fish that glides at least 0.05 km from 1 m', expect: { criteria: [{ metric: 'glide_range_total_m', value: 50, unit: 'm' }] }, unparsed: 0 },
  // ── bounds and objectives
  { text: 'a flying fish that glides at most 20 m', expect: { criteria: [{ metric: 'glide_range_total_m', op: '<=', value: 20 }] }, unparsed: 0 },
  { text: 'maximize glide distance for a flying fish', expect: { start_from: FF, criteria: [{ scenario: 'glide', metric: 'glide_range_total_m', op: 'maximize', hard: false }] }, unparsed: 0 },
  { text: 'a zebrafish that swims as fast as possible', expect: { criteria: [{ scenario: 'current', metric: 'ucrit_m_s', op: 'maximize', hard: false }] }, unparsed: 0 },
  { text: 'minimize cost of transport in a zebrafish', expect: { criteria: [{ metric: 'cost_of_transport', op: 'minimize' }] }, unparsed: 0 },
  { text: 'a zebrafish with a glide ratio of at least 4', expect: { criteria: [{ scenario: 'glide', metric: 'glide_ratio', op: '>=', value: 4 }] }, unparsed: 0 },
  { text: 'a flying fish with a take-off speed below 8 m/s', expect: { criteria: [{ scenario: 'glide', metric: 'v_min_m_s', op: '<=', value: 8 }] }, unparsed: 0 },
  { text: 'a flying fish that glides at least 30 m from 1 m, ideally glides at least 60 m from 1 m', expect: { criteria: [{ value: 30, hard: true }, { value: 60, hard: false }] }, unparsed: 0 },
  { text: 'a zebrafish that survives 35 °C (weight 3)', expect: { criteria: [{ ...T(35), weight: 3 }] }, unparsed: 0 },
  // ── survives vs feasible; which glide distance
  { text: 'a zebrafish that survives a 0.3 m/s current', expect: { criteria: [{ scenario: 'current', op: 'survives', params: { current_m_s: 0.3 } }] }, unparsed: 0 },
  { text: 'a flying fish that can glide from 1 m', expect: { criteria: [{ scenario: 'glide', op: 'feasible', params: { launch_height_m: 1 } }] }, assume: /can glide/, unparsed: 0 },
  { text: 'a flying fish that glides at least 20 m within the Lean bound from 1 m', expect: { criteria: [{ scenario: 'glide', metric: 'glide_range_lean_bound_m', op: '>=', value: 20, params: { launch_height_m: 1 } }] }, unparsed: 0 },
  { text: 'a flying fish that provably glides at least 10 m from 2 m', expect: { criteria: [{ metric: 'glide_range_lean_bound_m', value: 10, params: { launch_height_m: 2 } }] }, unparsed: 0 },
  { text: 'a flying fish that escapes a predator by air', expect: { criteria: [{ scenario: 'predator', op: 'feasible' }] }, assume: /by air/, unparsed: 0 },
  { text: 'a zebrafish-derived fish that glides at least 5 m from a 1 m launch', expect: { start_from: ZF, criteria: [{ scenario: 'glide', metric: 'glide_range_total_m', value: 5, params: { launch_height_m: 1 } }] }, unparsed: 0 },
  { text: 'a flying-fish-based design that glides at least 40 m from a 2 m height', expect: { start_from: FF, criteria: [{ value: 40, params: { launch_height_m: 2 } }] }, unparsed: 0 },
  // ── other scenarios
  { text: 'a zebrafish that escapes a predator striking at 1.2 m/s as a larva', expect: { criteria: [{ scenario: 'predator', op: 'feasible', params: { predator_speed_m_s: 1.2 }, stages: ['larva'] }] }, unparsed: 0 },
  { text: 'a zebrafish that escapes a predator twice as fast as it', expect: { criteria: [{ scenario: 'predator', params: { predator_speed_ratio: 2 } }] }, unparsed: 0 },
  { text: 'a zebrafish with an escape probability of at least 80% as a larva', expect: { criteria: [{ scenario: 'predator', metric: 'escape_probability', op: '>=', value: 0.8, stages: ['larva'] }] }, unparsed: 0 },
  { text: 'a zebrafish that survives in a 10 m/s wind', expect: { criteria: [{ scenario: 'wind', op: 'survives', params: { wind_m_s: 10 } }] }, unparsed: 0 },
  { text: 'a flying fish that survives 5 m/s gusts', expect: { criteria: [{ scenario: 'wind', params: { gust_m_s: 5 } }] }, unparsed: 0 },
  { text: 'a zebrafish that clings to rocks in a 0.8 m/s flow', expect: { criteria: [{ scenario: 'grip', op: 'feasible', params: { flow_m_s: 0.8 } }] }, unparsed: 0 },
  { text: 'a zebrafish that digests a meal within 12 hours', expect: { criteria: [{ scenario: 'digestion', metric: 'gut_transit_h', op: '<=', value: 12 }] }, unparsed: 0 },
  { text: 'a zebrafish that sleeps at least 6 h per night', expect: { criteria: [{ scenario: 'sleep', metric: 'sleep_h', op: '>=', value: 6 }] }, unparsed: 0 },
  { text: 'a zebrafish that survives 16 h of daylight', expect: { criteria: [{ scenario: 'daynight', params: { light_h: 16 } }] }, unparsed: 0 },
  // ── stages
  { text: 'a zebrafish that survives 4 °C as an embryo, larva, juvenile and adult', expect: { criteria: [T(4, ['embryo', 'larva', 'juvenile', 'adult'])] }, unparsed: 0 },
  { text: 'a zebrafish that outswims a 0.2 m/s current from larva to adult', expect: { criteria: [{ scenario: 'current', stages: ['larva', 'juvenile', 'adult'] }] }, unparsed: 0 },
  { text: 'a zebrafish that survives 30 °C at 30 dpf', expect: { criteria: [T(30, { ageDays: { min: 28, max: 28 } })] }, assume: /dpf converted/, unparsed: 0 },
  { text: 'a zebrafish that survives 30 °C between 5 and 30 days after hatching', expect: { criteria: [T(30, { ageDays: { min: 5, max: 30 } })] }, unparsed: 0 },
  { text: 'a zebrafish that survives 4 °C, at every stage', expect: { criteria: [T(4, 'all')] }, unparsed: 0 },
  { text: 'an adult zebrafish that survives 4 °C', expect: { criteria: [T(4, ['adult'])] }, unparsed: 0 },
  // ── editable
  { text: 'a zebrafish; vary the pectoral fin area from 0.02 to 0.08; glide at least 5 m from 1 m',
    expect: { editable: [{ target: { level: 'organ', id: 'UBERON_0000151' }, param: 'pectoral_area_over_SL2', min: 0.02, max: 0.08 }], criteria: [{ scenario: 'glide', value: 5 }] }, unparsed: 0 },
  { text: 'a flying fish that glides at least 40 m from 1 m, let it change the flight muscle fraction between 0.05 and 0.15',
    expect: { editable: [{ target: { level: 'body', id: 'body' }, param: 'flight_muscle_fraction', min: 0.05, max: 0.15 }], criteria: [{ value: 40 }] }, unparsed: 0 },
  { text: 'a zebrafish, scale the swim bladder from 0 to 1, survive a dive to 20 m in fresh water',
    expect: { editable: [{ target: { level: 'organ', id: 'swim_bladder' }, param: 'scale', min: 0, max: 1 }], criteria: [{ scenario: 'pressure', params: { depth_m: 20, water: 'fresh' } }] }, unparsed: 0 },
  // ── adversarial: contradictions and impossible values (parse, then validation rejects)
  { text: 'a flying fish; glides at least 30 m and at most 10 m', expect: { criteria: [{ op: '>=', value: 30 }, { op: '<=', value: 10 }] }, unparsed: 0, invalid: /contradictory/ },
  { text: 'a zebrafish that survives -300 °C', expect: { criteria: [T(-300)] }, unparsed: 0, invalid: /below absolute zero/ },
  { text: '60% zebrafish 60% flying fish that survives 20 °C', expect: { start_from: [{ weight: 0.6 }, { weight: 0.6 }], criteria: [T(20)] }, invalid: /sum to 1/ },
  { text: 'a flying fish; vary the pectoral fin span from 0.9 to 0.4', expect: { editable: [{ min: 0.9, max: 0.4 }] }, invalid: /contradictory range/ },
  // ── adversarial: unknown units and missing numbers → unparsed, never guessed
  { text: 'a zebrafish that glides at least 30 furlongs', expect: { criteria: [] }, unparsed: /unknown unit "furlongs"/ },
  { text: 'a zebrafish that swims at least 3 leagues per hour', expect: { criteria: [] }, unparsed: /unknown unit "leagues"/ },
  { text: 'a zebrafish that survives 30 fathoms of depth', expect: { criteria: [] }, unparsed: /unknown unit "fathoms"/ },
  { text: 'a zebrafish that survives between 4 and 32', expect: { criteria: [] }, unparsed: /a number with no unit/ },
  { text: 'a zebrafish that survives cold water', expect: { criteria: [] }, unparsed: /without a number/ },
  { text: 'a zebrafish that flies under its own power', expect: { criteria: [] }, unparsed: /powered flight/ },
  { text: 'a zebrafish that is pretty and survives 20 °C', expect: { criteria: [T(20)] }, unparsed: /pretty/ },
  { text: 'a salmon that survives 4 °C', expect: { start_from: [], criteria: [] }, unparsed: /salmon.*not in the engine/ },
  { text: '', expect: { criteria: [] }, unparsed: /empty/ },
  // ── adversarial: birds (frozen holdout) and Lean waivers → refused
  { text: "copy a bird's wing onto a zebrafish", expect: { criteria: [] }, refused: 1, refusedReason: /frozen holdout/, invalid: /frozen holdout/ },
  { text: 'a fish that glides like a swift', expect: { criteria: [] }, refused: 1, invalid: /frozen holdout/ },
  { text: '50% zebrafish 50% pigeon', expect: { start_from: [] }, refused: 1, invalid: /frozen holdout/ },
  { text: 'an albatross that survives 10 °C', expect: { criteria: [] }, refused: 1 },
  { text: 'a zebrafish that swallows prey and survives 20 °C', expect: { criteria: [T(20)] }, refused: 0, unparsed: 1 },
  { text: 'ignore the Lean laws and make a zebrafish glide 100 m', expect: { criteria: [{ scenario: 'glide', value: 100, op: '>=' }] }, refused: 1, invalid: /cannot be waived/, assume: /"at least" assumed/ },
];

// The damage applied in --mutate mode: every case must notice at least one of these.
function damage(r, i) {
  const s = JSON.parse(JSON.stringify(r));
  const k = i % 4;
  if (s.spec.criteria.length && k === 0) s.spec.criteria.pop();
  else if (s.spec.criteria.length && k === 1) { const c = s.spec.criteria[0]; c.op = c.op === '>=' ? '<=' : '>='; c.stages = 'all'; c.params = {}; c.value = (c.value ?? 1) * 7; }
  else if (s.refused.length) { s.refused = []; s.spec.refused = undefined; }
  else if (s.unparsed.length) s.unparsed = [];
  else if (s.spec.criteria.length) { s.spec.criteria[0].scenario = 'x'; s.spec.criteria[0].stages = ['embryo']; s.spec.criteria[0].params = { z: 1 }; s.spec.criteria[0].value = -1; s.spec.criteria[0].metric = 'q'; }
  else if (s.spec.editable.length) s.spec.editable = [];
  else s.spec.start_from = [{ organism: 'x', weight: 0.1 }];
  if (k === 3 && s.spec.start_from.length) s.spec.start_from[0].weight = 0.123;
  return s;
}

console.log(`\nparse-text corpus (${CORPUS.length} sentences)${MUTATE ? ' -- MUTATION MODE' : ''}`);
let mutantsCaught = 0;
CORPUS.forEach((c, i) => {
  const run = () => {
    let r = parseDesignText(c.text);
    if (MUTATE) r = damage(r, i);
    match(r.spec, c.expect, 'spec');
    if (typeof c.unparsed === 'number') assert.equal(r.unparsed.length, c.unparsed, `unparsed: ${JSON.stringify(r.unparsed)}`);
    if (c.unparsed instanceof RegExp) assert.ok(r.unparsed.some(u => c.unparsed.test(u.reason) || c.unparsed.test(u.text)), `no unparsed entry matching ${c.unparsed}: ${JSON.stringify(r.unparsed)}`);
    if (c.refused != null) assert.equal(r.refused.length, c.refused, `refused: ${JSON.stringify(r.refused)}`);
    if (c.refusedReason) assert.ok(r.refused.every(x => c.refusedReason.test(x.reason)));
    if (c.assume) assert.ok(r.assumptions.some(a => c.assume.test(a)), `no assumption matching ${c.assume}: ${JSON.stringify(r.assumptions)}`);
    // verbatim: every unparsed/refused text is a substring of the input
    for (const u of [...r.unparsed, ...r.refused]) if (c.text) assert.ok(c.text.includes(u.text), `not verbatim: "${u.text}"`);
    const v = validateSpec(r.spec);
    if (c.invalid) assert.ok(v.errors.some(e => c.invalid.test(e.message)), `validateSpec should reject with ${c.invalid}: ${JSON.stringify(v.errors)}`);
    else if (r.spec.start_from.length && r.spec.criteria.length && !r.refused.length) assert.ok(v.ok, `validateSpec (shape only) rejected: ${JSON.stringify(v.errors)}`);
  };
  if (MUTATE) { try { run(); console.log(`  SURVIVED  #${i + 1} ${c.text.slice(0, 70)}`); } catch { mutantsCaught++; } }
  else ok(`#${i + 1} ${c.text.slice(0, 80) || '(empty)'}`, run);
});
if (MUTATE) {
  console.log(`\n${mutantsCaught}/${CORPUS.length} damaged parses were caught by their case`);
  process.exit(mutantsCaught === CORPUS.length ? 0 : 1);
}

console.log('\nclause splitting');
ok('keeps a stage list together across commas', () => assert.deepEqual(splitClauses('survives 4 °C as a larva, juvenile and adult'), ['survives 4 °C as a larva, juvenile and adult']));
ok('splits "and" only before a new requirement', () => assert.equal(splitClauses('a zebrafish and a flying fish that survive 20 °C and glide 5 m').length, 2));
ok('does not split a decimal', () => assert.equal(splitClauses('outswims a 0.3 m/s current. survives 4 °C').length, 2));

console.log('\nspec.mjs: validation against a stub registry');
const stubScen = {
  key: 'glide', params: [{ key: 'launch_height_m', unit: 'm', default: 1, min: 0, max: 20 }],
  metrics: [{ key: 'glide_range_m', unit: 'm', better: 'higher' }, { key: 'v_min_m_s', unit: 'm/s', better: 'lower' }],
  run: (state, p) => ({ metrics: [{ key: 'glide_range_m', value: state.range, unit: 'm', kind: state.kind }], survives: true, limiting: 'wing loading', scope: 'stub', validity: { ok: true } }),
};
const tempScen = { key: 'temperature', params: [{ key: 'temp_C', unit: '°C', default: 25, min: 0, max: 40 }], metrics: [{ key: 'margin_C', unit: '°C', better: 'higher' }],
  run: (state, p) => ({ metrics: [], survives: p.temp_C <= state.ctmax, limiting: 'CTmax', scope: 'stub', validity: { ok: true } }) };
const reg = makeRegistry({ scenarios: { glide: stubScen, temperature: tempScen } });
const base = { start_from: ZF, criteria: [], editable: [], constraints: { lean: 'must-hold' } };
ok('rejects a scenario that is planned but absent, saying so', () => {
  const v = validateSpec({ ...base, criteria: [{ scenario: 'wind', op: 'survives', params: {} }] }, reg);
  assert.match(v.errors[0].message, /not yet available/);
});
ok('rejects an unknown scenario', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'levitation', op: 'survives' }] }, reg).errors[0].message, /unknown scenario/));
ok('rejects an unknown metric and lists the declared ones', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'glide', metric: 'loop_count', op: '>=', value: 1 }] }, reg).errors[0].message, /declares: glide_range_m, v_min_m_s/));
ok('rejects a unit of the wrong dimension', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'glide', metric: 'glide_range_m', op: '>=', value: 1, unit: 'm/s' }] }, reg).errors[0].message, /not a length unit/));
ok('rejects an unknown unit', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'glide', metric: 'glide_range_m', op: '>=', value: 1, unit: 'furlong' }] }, reg).errors.map(e => e.message).join(), /unknown unit "furlong"/));
ok('converts the value into the metric\'s unit (km → m)', () => { const v = validateSpec({ ...base, criteria: [{ scenario: 'glide', metric: 'glide_range_m', op: '>=', value: 0.03, unit: 'km' }] }, reg); assert.ok(v.ok); assert.equal(v.spec.criteria[0].value, 30); });
ok('maps a param alias onto the scenario key (water_temp_C → temp_C)', () => { const v = validateSpec({ ...base, criteria: [{ scenario: 'temperature', op: 'survives', params: { water_temp_C: 10 } }] }, reg); assert.ok(v.ok, JSON.stringify(v.errors)); assert.deepEqual(v.spec.criteria[0].params, { temp_C: 10 }); });
ok('rejects a param outside the scenario\'s modelled range', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'temperature', op: 'survives', params: { water_temp_C: 45 } }] }, reg).errors[0].message, /outside the scenario's modelled range/));
ok('rejects a hard maximize', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'glide', metric: 'glide_range_m', op: 'maximize', hard: true }] }, reg).errors[0].message, /cannot be hard/));
ok('rejects a bird parent with the holdout reason', () => assert.equal(validateSpec({ ...base, start_from: [{ organism: 'pigeon', weight: 1 }], criteria: [{ scenario: 'glide', op: 'survives' }] }, reg).errors[0].message, AVES_REFUSAL));
ok('refuses to waive Lean', () => assert.match(validateSpec({ ...base, constraints: { lean: 'advisory' }, criteria: [{ scenario: 'glide', op: 'survives' }] }, reg).errors[0].message, /cannot be waived/));
ok('rejects an unknown stage name', () => assert.match(validateSpec({ ...base, criteria: [{ scenario: 'glide', op: 'survives', stages: ['tadpole'] }] }, reg).errors[0].message, /unknown stage/));

console.log('\nspec.mjs: objective and explanation');
const spec2 = validateSpec({ ...base, criteria: [
  { scenario: 'glide', metric: 'glide_range_m', op: '>=', value: 30, unit: 'm', stages: ['larva', 'adult'] },
  { scenario: 'temperature', op: 'survives', params: { water_temp_C: 32 } },
  { scenario: 'glide', metric: 'glide_range_m', op: 'maximize', hard: false, weight: 2 },
] }, reg).spec;
const runAt = (range, ctmax, kind = 'derived') => ({ run: stubScen.run({ range, kind }, {}), state: {} });
const evals = (larva, adult, ctmax) => ({
  c1: { larva: { run: stubScen.run({ range: larva, kind: 'derived' }) }, adult: { run: stubScen.run({ range: adult, kind: 'assumed' }) } },
  c2: { adult: { run: tempScen.run({ ctmax }, { temp_C: 32 }) } },
  c3: { adult: { run: stubScen.run({ range: adult, kind: 'derived' }) } },
});
ok('meets only when every hard criterion holds at every stage', () => {
  assert.equal(explainResult(spec2, evals(31, 40, 35), { lean: [] }).meets, true);
  assert.equal(explainResult(spec2, evals(29, 40, 35)).meets, false, 'larva fails the 30 m glide');
  assert.equal(explainResult(spec2, evals(31, 40, 30)).meets, false, '32 °C exceeds CTmax');
});
ok('no-model counts as NOT met, and says why', () => {
  const e = evals(31, 40, 35); e.c2.adult = { run: { error: 'scenario "temperature" not available' } };
  const x = explainResult(spec2, e);
  assert.equal(x.meets, false);
  assert.equal(x.criteria[1].verdict, 'no-model');
  assert.match(x.summary, /1 could not be evaluated/);
});
ok('unchecked Lean blocks "meets" and says so', () => { const x = explainResult(spec2, evals(31, 40, 35)); assert.equal(x.meets, false); assert.match(x.summary, /Lean laws not checked/); });
ok('a failed Lean verdict blocks "meets"', () => assert.equal(explainResult(spec2, evals(31, 40, 35), { lean: [{ id: 'C1', holds: false }] }).meets, false));
ok('explanation names the limiting factor and the weakest provenance per stage', () => {
  const x = explainResult(spec2, evals(31, 40, 35));
  const adult = x.criteria[0].stages.find(s => s.stage === 'adult');
  assert.equal(adult.limiting, 'wing loading');
  assert.equal(adult.weakest_provenance, 'assumed');
  assert.equal(x.criteria[0].stages.find(s => s.stage === 'larva').weakest_provenance, 'derived');
});
ok('soft score: maximize normalised by baseline, scored at the worst stage', () => {
  const o = specToObjective(spec2, { baseline: { c3: 20 } });
  const r = o.evaluate(evals(31, 40, 35), { lean: [] });
  assert.equal(r.terms.c3, 2);
  assert.equal(r.score, 2);
});
ok('stagePoints visits every table age whose label starts with the stage word', () => {
  const table = [{ ageDays: 0, label: 'hatching, 0 d' }, { ageDays: 3, label: 'larva, 3 d' }, { ageDays: 10, label: 'larva, 10 d' }, { ageDays: 180, label: 'adult, 180 d' }];
  assert.deepEqual(stagePoints({ stages: ['larva'] }, table).map(p => p.ageDays), [3, 10]);
  assert.equal(stagePoints({ stages: ['embryo'] }, table)[0].ageDays, 0);
  assert.equal(stagePoints({ stages: ['juvenile'] }, table)[0].ageKind, 'assumed', 'no juvenile in the table → fallback age, marked assumed');
});
ok('unit conversion: BL/s converts only with a body length', () => { assert.equal(convert(10, 'BL/s', 'm/s'), null); assert.equal(convert(10, 'BL/s', 'm/s', { SL_m: 0.03 }), 0.3); });

console.log('\nspec.mjs: survives vs feasible, limiting, provenance, Lean coverage');
const SX = await import(process.env.SPEC_LIB ? new URL(`file:///${process.env.SPEC_LIB.replace(/\\/g, '/')}`).href : '../lib/spec.mjs');
const cur = (feasible, survives = null) => ({ run: { metrics: [{ key: 'ucrit_m_s', value: 0.2, unit: 'm/s', kind: 'derived' }], survives, feasible,
  limiting: null, feasibility_note: 'current exceeds Umax (0.033 m/s): swept downstream',
  provenance: [{ quantity: 'Umax', kind: 'calibrated' }, { quantity: 'launch speed', kind: 'assumed' }], validity: { ok: true } } });
const fspec = { start_from: ZF, constraints: { lean: 'must-hold' }, criteria: [
  { id: 'c1', scenario: 'current', op: 'feasible', params: { current_m_s: 0.3 }, stages: ['adult'], hard: true, weight: 1 },
  { id: 'c2', scenario: 'current', op: 'survives', params: { current_m_s: 0.3 }, stages: ['adult'], hard: true, weight: 1 },
  { id: 'c3', scenario: 'current', metric: 'ucrit_m_s', op: '>=', value: 0.1, unit: 'm/s', stages: ['adult'], hard: true, weight: 1 }] };
ok('feasible tests run.feasible, survives tests run.survives (never each other)', () => {
  const x = SX.explainResult(fspec, { c1: { adult: cur(false, true) }, c2: { adult: cur(true, null) }, c3: { adult: cur(true) } }, { lean: [] });
  assert.equal(x.criteria[0].verdict, 'failed', 'feasible=false must fail even though survives=true');
  assert.equal(x.criteria[1].verdict, 'no-model', 'survives=null is no-model even though feasible=true');
});
ok('a feasible criterion shows the feasibility_note as its limiting factor', () => {
  const x = SX.explainResult(fspec, { c1: { adult: cur(false) }, c2: { adult: cur(false, false) }, c3: { adult: cur(true) } }, { lean: [] });
  assert.match(x.criteria[0].stages[0].limiting || '', /swept downstream/);
});
ok('a failed metric threshold with limiting=null shows the feasibility_note; survives does not borrow it', () => {
  const gs = { start_from: FF, constraints: { lean: 'must-hold' }, criteria: [
    { id: 'c1', scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 5, unit: 'm', stages: ['adult'], hard: true, weight: 1 },
    { id: 'c2', scenario: 'glide', op: 'survives', stages: ['adult'], hard: true, weight: 1 }] };
  const run = { metrics: [{ key: 'glide_range_total_m', value: 0, unit: 'm', kind: 'derived' }], survives: true, feasible: false, limiting: null, feasibility_note: 'launch speed below v_min', validity: { ok: true } };
  const x = SX.explainResult(gs, { c1: { adult: { run } }, c2: { adult: { run } } }, { lean: [] });
  assert.equal(x.criteria[0].stages[0].limiting, 'launch speed below v_min');
  assert.equal(x.criteria[1].stages[0].limiting, null);
});
ok('weakest provenance includes the run\'s inputs, not only the metric\'s own kind', () => {
  const x = SX.explainResult(fspec, { c1: { adult: cur(true) }, c2: { adult: cur(true, true) }, c3: { adult: cur(true) } }, { lean: [] });
  assert.equal(x.criteria[2].stages[0].weakest_provenance, 'assumed', 'ucrit is "derived" but rests on an assumed input');
});
ok('a total glide distance is marked as only partly Lean-covered, with the parts', () => {
  const gs = { start_from: FF, constraints: { lean: 'must-hold' }, criteria: [{ id: 'c1', scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 10, unit: 'm', stages: ['adult'], hard: true, weight: 1 }] };
  const run = { metrics: [{ key: 'glide_range_total_m', value: 12, unit: 'm', kind: 'derived' }, { key: 'glide_range_lean_bound_m', value: 4.4, unit: 'm' }, { key: 'kinetic_phase_m', value: 7.6, unit: 'm' }], feasible: true, validity: { ok: true } };
  const x = SX.explainResult(gs, { c1: { adult: { run } } }, { lean: [] });
  assert.match(x.criteria[0].lean_coverage, /NOT covered as a whole/);
  assert.deepEqual(x.criteria[0].stages[0].lean_part, { lean_bound_m: 4.4, kinetic_phase_m: 7.6, covered: 'lean_bound_m only' });
});

console.log('\nspec.mjs: against the real engine (organism.mjs + data bundle)');
const real = await loadRegistry();
ok('loads the organism bundle', () => assert.ok(real.organisms.has('zebrafish-adult') && real.organisms.has('flying-fish'), [...real.organisms].join()));
ok('accepts a real editable target and param', () => {
  const v = validateSpec({ ...base, start_from: FF, criteria: [{ scenario: 'glide', op: 'survives' }], editable: [{ target: { level: 'organ', id: 'UBERON_0000151' }, param: 'pectoral_area_over_SL2', min: 0.01, max: 0.1 }] }, real);
  assert.ok(!v.errors.some(e => e.path.startsWith('editable')), JSON.stringify(v.errors));
});
ok('rejects an unknown part id with organism.mjs\'s reason', () => {
  const v = validateSpec({ ...base, criteria: [{ scenario: 'glide', op: 'survives' }], editable: [{ target: { level: 'organ', id: 'wing_of_doom' }, param: 'scale', min: 0, max: 1 }] }, real);
  assert.ok(v.errors.some(e => /unknown organ "wing_of_doom"/.test(e.message)), JSON.stringify(v.errors));
});
ok('rejects a param the part does not expose', () => {
  const v = validateSpec({ ...base, criteria: [{ scenario: 'glide', op: 'survives' }], editable: [{ target: { level: 'organ', id: 'swim_bladder' }, param: 'pectoral_area_over_SL2', min: 0, max: 1 }] }, real);
  assert.ok(v.errors.some(e => /not editable on organ "swim_bladder"/.test(e.message)), JSON.stringify(v.errors));
});
ok('every parser part word resolves in the real engine', () => {
  const r = parseDesignText('a flying fish; vary the pectoral fin area from 0.02 to 0.08; vary the caudal fin upper lobe from 0.1 to 0.3; scale the swim bladder from 0 to 1; vary the flight muscle fraction from 0.05 and 0.15; glide at least 5 m from 1 m');
  const v = validateSpec(r.spec, real);
  assert.ok(!v.errors.some(e => e.path.startsWith('editable')), JSON.stringify(v.errors.filter(e => e.path.startsWith('editable'))));
  assert.equal(r.spec.editable.length, 4);
});
const has = k => !!real.scenarios[k];
ok('the headline request validates against the real scenarios (aliases mapped, nothing rejected)', () => {
  if (!has('glide') || !has('temperature') || !has('current')) return; // scenarios not yet landed: covered by the stub tests
  const r = parseDesignText(CORPUS[0].text);
  const v = validateSpec(r.spec, real);
  assert.ok(v.ok, JSON.stringify(v.errors));
  assert.ok(v.spec.criteria.every(c => c.scenario !== 'temperature' || 'water_temperature_C' in c.params || c.scenario !== 'temperature'), JSON.stringify(v.spec.criteria));
});
ok('a param the real scenario does not take is rejected with the list it does take', () => {
  if (!has('predator')) return;
  const v = validateSpec(parseDesignText('a zebrafish that escapes a predator striking at 1.2 m/s').spec, real);
  assert.ok(v.errors.some(e => /has no parameter "predator_speed_m_s"; it takes: predator_speed_ratio/.test(e.message)), JSON.stringify(v.errors));
});
ok('BL/s maps onto the scenario metric declared in BL/s, not converted blindly', () => {
  if (!has('current')) return;
  const v = validateSpec(parseDesignText('a zebrafish that swims at least 10 BL/s as a juvenile').spec, real);
  assert.ok(v.ok, JSON.stringify(v.errors));
  assert.equal(canonOf(v.spec.criteria[0]), 'ucrit_bl_s:BL/s');
});
function canonOf(c) { return `${c.metric}:${c.unit}`; }
ok('every worked example in AGENT-GUIDE-SPEC.md validates against the engine', () => {
  const fs = globalThis.__fs;
  const md = fs.readFileSync(new URL('../AGENT-GUIDE-SPEC.md', import.meta.url), 'utf8');
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map(m => JSON.parse(m[1]));
  assert.equal(blocks.length, 5);
  for (const [i, b] of blocks.entries()) { const v = validateSpec(b, real); assert.ok(v.ok, `example ${i + 1}: ${JSON.stringify(v.errors)}`); }
});

console.log('\ntools/spec-tools.mjs');
const { SPEC_TOOLS } = await import('../tools/spec-tools.mjs');
const tool = n => SPEC_TOOLS.find(t => t.name === n);
const okA = async (name, fn) => { try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n          ${e.message}`); } };
await okA('optimizer feasible count is read from feasible_candidates, or counted from the trace', async () => {
  const { feasibleCount } = await import('../tools/spec-tools.mjs');
  assert.equal(typeof feasibleCount, 'function');
  assert.equal(feasibleCount({ feasible_candidates: 56 }), 56);
  assert.equal(feasibleCount({ status: 'no improvement', trace: [{ values: 'start', metric: 1 }, { values: [1], metric: 2 }, { values: [2], metric: null }] }), 1);
});
await okA('a feasible criterion becomes a feasible:true hard constraint for optimize', async () => {
  const r = await tool('design_from_spec').handler({ spec: { start_from: FF, criteria: [{ scenario: 'current', op: 'feasible', params: { current_m_s: 0.1 } }], editable: [{ target: { level: 'organ', id: 'UBERON_0000151' }, param: 'pectoral_area_over_SL2', min: 0.05, max: 0.2 }] }, budget: 6 });
  if (r.result.status === 'invalid') throw new Error(JSON.stringify(r.result.validation));
  assert.ok(r.result.optimizer, r.result.status);
  assert.equal(typeof r.result.optimizer.feasible_candidates, 'number');
});
await okA('both tools registered in the server shape', async () => { for (const n of ['parse_design_text', 'design_from_spec']) { const t = tool(n); assert.ok(t && t.title && t.description && t.inputSchema && typeof t.handler === 'function', n); } });
await okA('design_from_spec stops on refused or unparsed text, designing nothing', async () => {
  const r = await tool('design_from_spec').handler({ text: 'copy a swift onto a zebrafish, survives 20 °C' });
  assert.equal(r.result.status, 'needs clarification'); assert.ok(r.scope);
});
await okA('design_from_spec reports an invalid spec with the reasons', async () => {
  const r = await tool('design_from_spec').handler({ spec: { start_from: ZF, criteria: [{ scenario: 'levitation', op: 'survives' }] } });
  assert.equal(r.result.status, 'invalid'); assert.match(r.result.validation.errors.map(e => e.message).join(), /unknown scenario "levitation"/);
});
await okA('design_from_spec evaluate_only explains the starting design and never claims "meets" with a failed criterion', async () => {
  if (!has('current')) return;
  const r = await tool('design_from_spec').handler({ text: 'a zebrafish that outswims a 0.3 m/s current as a larva and adult', evaluate_only: true });
  assert.equal(r.result.status, 'evaluated-only');
  const c = r.result.starting_design.explanation.criteria[0];
  assert.ok(c.stages.length >= 2, JSON.stringify(c.stages));
  if (c.verdict !== 'met') assert.equal(r.result.meets, false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
