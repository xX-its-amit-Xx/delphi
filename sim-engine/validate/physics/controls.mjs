#!/usr/bin/env node
// The controls, run and reported. `node sim-engine/validate/physics/controls.mjs` writes
// physics-results.json and RESULTS.md next to this file and exits non-zero if any control comes out
// the wrong way round.
//
// A control that comes out wrong is a DEFECT in the engine or in this check, and is reported as one.
// Nothing here is tuned to make a control pass; the thresholds are fixed below and are the same for
// every organism in a given control.
import fs from 'node:fs';
import path from 'node:path';
import { physicsCheck } from './index.mjs';

const HERE = import.meta.dirname;
const DRAWS = Number(process.env.PHYSICS_DRAWS || 400);
const SEED = process.env.PHYSICS_SEED || 'delphi-v1';

// One realistic glide function, applied unchanged to four organisms. 10 m from a 1 m launch sits well
// inside the 5-75 m band the independent harness scores the real flying fish against (STUDIO-RESULTS W9).
const GLIDE_SPEC = {
  start_from: [], criteria: [
    { id: 'glide-feasible', scenario: 'glide', op: 'feasible', params: { launch_height_m: 1 }, stages: ['adult'], hard: true, weight: 1,
      source_text: 'lift must carry the weight at the launch speed the animal can actually reach' },
    { id: 'glide-range', scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 10, unit: 'm', params: { launch_height_m: 1 }, stages: ['adult'], hard: true, weight: 1,
      source_text: 'a realistic glide: at least 10 m from a 1 m launch' },
  ],
};
// Powered flight: the aerobic supply must at least equal the power level flight needs.
const POWERED_SPEC = {
  start_from: [], criteria: [
    { id: 'powered-margin', scenario: 'glide', metric: 'powered_flight_margin', op: '>=', value: 1, unit: '1', params: { launch_height_m: 1 }, stages: ['adult'], hard: true, weight: 1,
      source_text: 'a design that claims POWERED flight must have aerobic power at least equal to the power level flight needs' },
  ],
};
// Swim only: hold station at the current scenario's own default test speed.
const SWIM_SPEC = {
  start_from: [], criteria: [
    { id: 'hold-station', scenario: 'current', op: 'feasible', params: { current_m_s: 0.2 }, stages: ['adult'], hard: true, weight: 1,
      source_text: 'an unedited zebrafish asked only to swim: hold station at 0.2 m/s' },
  ],
};

export const CONTROLS = [
  { id: 'C1', organism: 'flying-fish', spec: GLIDE_SPEC, expect: 'pass', why: 'the real adult flying fish glides; if this fails the check is broken, not the animal' },
  { id: 'C2', organism: 'zebrafish-adult', spec: GLIDE_SPEC, expect: 'fail', why: 'a zebrafish cannot glide: its burst speed is an order of magnitude below its own v_min' },
  { id: 'C3', organism: 'wingless-flying-fish', spec: GLIDE_SPEC, expect: 'fail', why: 'take the wings off a flying fish and it cannot glide, at the same launch speed' },
  { id: 'C4', organism: 'tff', spec: POWERED_SPEC, expect: 'fail', why: 'THE HEADLINE RESULT: the hypothetical truly flying fish cannot pay for powered flight. This control must survive' },
  { id: 'C5', organism: 'zebrafish-adult', spec: SWIM_SPEC, expect: 'pass', why: 'an unedited zebrafish asked only to swim does what it does' },
  // Not a control: reported for the ensemble numbers the hub asked for.
  { id: 'X1', organism: 'winged-zebrafish', spec: GLIDE_SPEC, expect: 'fail', why: 'the winged zebrafish: fins moved toward the flying fish, still far below its own v_min', observation: false },
];

const pct = x => (x == null ? 'n/a' : `${(x * 100).toFixed(1)} %`);
const n4 = x => (x == null ? 'n/a' : typeof x === 'number' ? (Math.abs(x) >= 1000 || (x !== 0 && Math.abs(x) < 1e-3) ? x.toExponential(3) : +x.toFixed(4)) : String(x));

export async function runControls({ draws = DRAWS, seed = SEED } = {}) {
  const rows = [];
  for (const c of CONTROLS) {
    const r = await physicsCheck(c.organism, { spec: c.spec, draws, seed });
    const got = r.function_achieved ? 'pass' : 'fail';
    const correct = got === c.expect;
    rows.push({ ...c, got, correct, gate_status: r.gate_status, physics_gate_failed: r.physics_gate_failed,
      criteria: r.criteria.map(x => ({ id: x.id, scenario: x.scenario, metric: x.metric || x.op, status: x.status, limiting_factor: x.limiting_factor,
        model_confidence: x.model_confidence?.validated ?? null, weakest: x.model_confidence?.weakest_input_kind ?? null,
        per_stage: x.per_stage.map(s => ({ stage: s.stage, status: s.status, measured: s.measured, threshold: s.threshold, op: s.op, unit: s.unit, limiting_factor: s.limiting_factor,
          ensemble: s.ensemble ? { source: s.ensemble.source, draws: s.ensemble.draws, fraction_achieved: s.ensemble.fraction_achieved, median: s.ensemble.median, p5: s.ensemble.p5, p95: s.ensemble.p95, species_gate: s.ensemble.species_gate.is_flier, not_drawn: s.ensemble.not_drawn } : null })) })),
      standing: r.standing_checks.map(s => ({ id: s.id, stage: s.stage, status: s.status, measured: s.measured, threshold: s.threshold, unit: s.unit, limiting_factor: s.limiting_factor, model_confidence: s.model_confidence?.validated ?? null })),
      unchecked: r.unchecked_requirements, circular: r.model_honesty.circular_checks.map(x => x.where), rests_on_assumed: r.model_honesty.rests_on_assumed, gate: r.gate });
  }
  const controls = rows.filter(r => r.observation !== false);
  return { generated_at: new Date().toISOString(), draws, seed, n_controls: controls.length,
    correct: controls.filter(r => r.correct).length, wrong: controls.filter(r => !r.correct).map(r => r.id), rows };
}

function markdown(res) {
  const L = [];
  L.push('# physics_simulation: controls and what they rest on', '');
  L.push(`Generated ${res.generated_at} by \`node sim-engine/validate/physics/controls.mjs\`. Ensemble: **${res.draws} draws**, seed \`${res.seed}\`. Machine-readable: \`physics-results.json\`.`, '');
  L.push(`**${res.correct} of ${res.n_controls} controls came out the right way round.**${res.wrong.length ? ` WRONG: ${res.wrong.join(', ')} -- a control that comes out wrong is a defect in the engine or in this check and is NOT tuned around.` : ''}`, '');
  L.push('## Controls', '');
  L.push('| id | organism | function | expected | got | verdict |', '|---|---|---|---|---|---|');
  for (const r of res.rows) {
    const fn = r.criteria.map(c => `${c.scenario}/${c.metric}`).join(', ');
    L.push(`| ${r.id}${r.observation === false ? ' (observation)' : ''} | \`${r.organism}\` | ${fn} | ${r.expect} | **${r.got}** | ${r.correct ? 'correct' : '**WRONG**'} |`);
  }
  L.push('', '## Per criterion, with the ensemble', '');
  L.push('| id | criterion | measured | threshold | status | ensemble: achieved / median / 5-95 % | model_confidence |', '|---|---|---|---|---|---|---|');
  for (const r of res.rows) for (const c of r.criteria) for (const s of c.per_stage) {
    const e = s.ensemble;
    L.push(`| ${r.id} | \`${c.scenario}/${c.metric}\` @ ${s.stage} | ${n4(s.measured)}${s.unit ? ' ' + s.unit : ''} | ${s.op || ''} ${n4(s.threshold)} | **${s.status}** | ${e ? `${pct(e.fraction_achieved)} of ${e.draws} / ${n4(e.median)} / ${n4(e.p5)}-${n4(e.p95)}${e.species_gate ? '' : ' (launch speed NOT drawn)'}` : 'not run'} | ${c.model_confidence}${c.weakest ? `, weakest ${c.weakest}` : ''} |`);
  }
  for (const r of res.rows) {
    L.push('', `### ${r.id} \`${r.organism}\` -- ${r.why}`, '');
    L.push(`Gate: \`${r.gate_status}\`, physics_gate_failed = \`${r.physics_gate_failed}\`.`, '');
    L.push(r.gate, '');
    L.push('| standing check | stage | measured | threshold | status | model_confidence |', '|---|---|---|---|---|---|');
    for (const s of r.standing) L.push(`| \`${s.id}\` | ${s.stage} | ${n4(s.measured)}${s.unit ? ' ' + s.unit : ''} | ${n4(s.threshold)} | ${s.status} | ${s.model_confidence} |`);
    if (r.unchecked.length) { L.push('', '**Unchecked requirements (no model; NOT met and NOT unmet):**', ''); for (const u of r.unchecked) L.push(`- \`${u.scenario}/${u.metric}\`${u.stage ? ` @ ${u.stage}` : ''}: ${u.why}`); }
    if (r.circular.length) { L.push('', '**Rests on a circular model:**', ''); for (const c of r.circular) L.push(`- ${c}`); }
    if (r.rests_on_assumed.length) { L.push('', '**Rests on an assumed input:**', ''); for (const c of r.rests_on_assumed) L.push(`- ${c}`); }
  }
  L.push('', '## What these controls do and do not establish', '');
  L.push('The four negative controls (C2, C3, C4 and X1) are the part of this result that is **not** circular: each turns on an inequality between two independently sourced quantities -- a burst or taxi speed from one body of field observations against a v_min computed from a wind-tunnel polar and a measured mass and area -- rather than on a number fitted to the comparison. C1, the positive control, is `rests-on-assumed` at best and `circular` in part: the independent harness records (STUDIO-RESULTS W9) that the 36.5 m it predicts at 15 m/s is in band, but the 15 m/s launch speed and the 50 m field glide come from the same body of second-hand observations (Davenport 1994 / Edgerton & Breder 1941 via Makiguchi 2013 and Deng 2019). glide.mjs\'s own modelCard says so: "PARTLY CIRCULAR ... Not independent evidence."', '');
  L.push('Nothing here models control, flapping, unsteady aerodynamics, take-off power or whole-body stability. The static-margin check reports `no model` on purpose: see the header of `standing.mjs`.', '');
  return L.join('\n');
}

if (import.meta.filename === path.resolve(process.argv[1] || '')) {
  const res = await runControls();
  fs.writeFileSync(path.join(HERE, 'physics-results.json'), JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(HERE, 'RESULTS.md'), markdown(res));
  console.log(`${res.correct}/${res.n_controls} controls correct${res.wrong.length ? `; WRONG: ${res.wrong.join(', ')}` : ''}`);
  for (const r of res.rows) console.log(`  ${r.id} ${r.organism.padEnd(22)} expect ${r.expect.padEnd(4)} got ${r.got.padEnd(4)} ${r.correct ? 'ok' : 'WRONG'}`);
  console.log(`wrote ${path.join(HERE, 'RESULTS.md')}`);
  process.exit(res.wrong.length ? 1 : 0);
}

export { markdown };
