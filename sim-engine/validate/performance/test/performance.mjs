#!/usr/bin/env node
// node sim-engine/validate/performance/test/performance.mjs
//
// The performance layer. The thing this layer most easily becomes is a rubber stamp -- "the design says it
// does X, therefore X" -- so most of what is pinned here is the line it must not cross: it accepts declared
// INPUTS and never a declared OUTCOME, and each check rests on something that cannot be argued with.
import assert from 'node:assert/strict';
import { performanceCheck, CHECK_KINDS } from '../index.mjs';

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok    ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n          ' + String(e.message).split('\n').join('\n          ')); } };
const S = s => ({ source: s });

console.log('\ninputs');
ok('an unknown kind is refused with the list', () => {
  const r = performanceCheck({ kind: 'vibes' });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.deepEqual(Object.keys(r.kinds), Object.keys(CHECK_KINDS));
});
ok('a bare number is refused by name, in every kind', () => {
  for (const [kind, args] of [
    ['lifespan', { intrinsic_hazard_per_day: 0.01, designed_intrinsic_hazard_per_day: { value: 0.005, ...S('f') }, extrinsic_hazard_per_day: { value: 0.08, ...S('f') } }],
    ['manipulation', { particle_radius_m: 1e-5, transport_speed_m_s: { value: 1e-4, ...S('f') }, available_thrust_N: { value: 1e-10, ...S('f') } }],
    ['mass_balance', { carbon_uptake_mol_per_day: 1e-14, carbon_into_biomass_mol_per_day: { value: 5e-15, ...S('f') } }],
  ]) {
    const r = performanceCheck({ kind, ...args });
    assert.equal(r.verdict, 'cannot-evaluate', `${kind} accepted a bare number`);
    assert.match(r.reason, /bare number/);
  }
});
ok('a missing quantity is named and never defaulted', () => {
  const r = performanceCheck({ kind: 'lifespan', intrinsic_hazard_per_day: { value: 0.01, ...S('f') } });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /cannot be defaulted/);
  assert.ok(r.how_to_get_them, 'a refusal for want of a number should say where such a number comes from');
});

console.log('\nlifespan: the life-history point is the result, not a footnote');
ok('when extrinsic mortality dominates, a longer intrinsic lifespan buys almost nothing', () => {
  // Doubling the intrinsic lifespan of an animal that is being eaten every twelve days.
  const r = performanceCheck({ kind: 'lifespan',
    intrinsic_hazard_per_day: { value: 1 / 60, ...S('baseline') },
    designed_intrinsic_hazard_per_day: { value: 1 / 120, ...S('the design asks for double') },
    extrinsic_hazard_per_day: { value: 0.08, ...S('a wild hazard') } });
  assert.equal(r.ran, true);
  assert.ok(Math.abs(r.intrinsic_fold_change_asked_for - 2) < 1e-9, 'the design asked for 2x');
  assert.ok(r.fold_change.worst_case < 1.2, `a 2x intrinsic change bought ${r.fold_change.worst_case}x, which should be small here`);
  assert.equal(r.verdict, 'marginally-longer');
  assert.match(r.reading, /not dying of being old/);
});
ok('with no extrinsic hazard the same design does deliver', () => {
  const r = performanceCheck({ kind: 'lifespan',
    intrinsic_hazard_per_day: { value: 1 / 60, ...S('baseline') },
    designed_intrinsic_hazard_per_day: { value: 1 / 120, ...S('double') },
    extrinsic_hazard_per_day: { value: 1e-6, ...S('a protected laboratory') } });
  assert.ok(r.fold_change.worst_case > 1.9, `expected nearly 2x in protection, got ${r.fold_change.worst_case}`);
  assert.equal(r.verdict, 'longer');
  assert.match(r.reading, /headroom/);
});
ok('the exponential assumption is stated, because it is wrong exactly where senescence lives', () => {
  const r = performanceCheck({ kind: 'lifespan', intrinsic_hazard_per_day: { value: 0.01, ...S('f') },
    designed_intrinsic_hazard_per_day: { value: 0.005, ...S('f') }, extrinsic_hazard_per_day: { value: 0.01, ...S('f') } });
  assert.match(r.model_caveat, /CONSTANT hazard/);
  assert.match(r.model_caveat, /Gompertz|Weibull/);
  assert.ok(r.what_this_cannot_say.some(x => /HOW/.test(x)), 'it must say it models no mechanism');
  assert.ok(r.what_this_cannot_say.some(x => /fecundity|cost/.test(x)), 'and that it prices no trade-off');
});

console.log('\nmanipulation: Stokes drag decides, not the designer');
ok('a thrust below the drag is cannot-move-it, not slow', () => {
  const r = performanceCheck({ kind: 'manipulation', medium: 'water',
    particle_radius_m: { value: 1e-4, ...S('f') }, transport_speed_m_s: { value: 1e-3, ...S('f') },
    available_thrust_N: { value: 1e-12, ...S('f') } });
  assert.equal(r.verdict, 'cannot-move-it');
  assert.match(r.reading, /does not move it/);
});
ok('the drag is Stokes drag and the arithmetic is right', () => {
  const r = performanceCheck({ kind: 'manipulation', medium: 'water',
    particle_radius_m: { value: 2.5e-5, ...S('f') }, transport_speed_m_s: { value: 2e-4, ...S('f') },
    available_thrust_N: { value: 5e-10, ...S('f') } });
  const expect = 6 * Math.PI * 0.001002 * 2.5e-5 * 2e-4;
  assert.ok(Math.abs(r.drag_per_particle_N[0] - expect) < 1e-18, `${r.drag_per_particle_N[0]} != ${expect}`);
  assert.equal(r.verdict, 'can-move-it');
});
ok('the force reported is a LOWER bound, and the result says so', () => {
  const r = performanceCheck({ kind: 'manipulation', particle_radius_m: { value: 1e-5, ...S('f') },
    transport_speed_m_s: { value: 1e-4, ...S('f') }, available_thrust_N: { value: 1e-9, ...S('f') } });
  assert.match(r.model_caveat, /friction and adhesion/);
  assert.match(r.model_caveat, /lower bound/);
  assert.ok(r.what_this_cannot_say.some(x => /pile/.test(x)), 'moving particles and accumulating them are different problems');
});

console.log('\nmass balance: conservation of mass is not negotiable');
ok('more carbon out than in is impossible, and is called that', () => {
  const r = performanceCheck({ kind: 'mass_balance',
    carbon_uptake_mol_per_day: { value: 1e-14, ...S('f') },
    carbon_into_biomass_mol_per_day: { value: 8e-15, ...S('f') },
    carbon_respired_mol_per_day: { value: 4e-15, ...S('f') } });
  assert.equal(r.verdict, 'violates-conservation');
  assert.match(r.reading, /impossible one/);
});
ok('a balance that holds is reported with the yield', () => {
  const r = performanceCheck({ kind: 'mass_balance',
    carbon_uptake_mol_per_day: { value: 1e-14, ...S('f') },
    carbon_into_biomass_mol_per_day: { value: 5e-15, ...S('f') },
    carbon_respired_mol_per_day: { value: 4e-15, ...S('f') } });
  assert.equal(r.verdict, 'balances');
  assert.ok(r.biomass_yield_C_per_C[0] > 0 && r.biomass_yield_C_per_C[1] <= 1);
});
ok('omitting respiration makes the check trivially satisfiable, and it says so', () => {
  const r = performanceCheck({ kind: 'mass_balance',
    carbon_uptake_mol_per_day: { value: 1e-14, ...S('f') },
    carbon_into_biomass_mol_per_day: { value: 1e-14, ...S('f') } });
  assert.equal(r.verdict, 'balances');
  assert.match(r.reading, /trivially satisfiable/);
});
ok('the balance is one element and one day, and the caveat names what that leaves out', () => {
  const r = performanceCheck({ kind: 'mass_balance', carbon_uptake_mol_per_day: { value: 1, ...S('f') },
    carbon_into_biomass_mol_per_day: { value: 0.4, ...S('f') }, carbon_respired_mol_per_day: { value: 0.5, ...S('f') } });
  assert.match(r.model_caveat, /energy budget/);
  assert.match(r.model_caveat, /nitrogen|phosphorus/);
});

console.log('\nthe line this layer does not cross');
ok('no kind accepts a declared outcome', () => {
  // Every input this layer takes is a quantity. There is no `works: true`, no `achieves`, no `succeeds`.
  for (const kind of Object.keys(CHECK_KINDS)) {
    const r = performanceCheck({ kind, works: true, achieves: 'the task', succeeds: true });
    assert.equal(r.verdict, 'cannot-evaluate', `${kind} returned a verdict from a declared outcome`);
  }
});
ok('a verdict never claims the design works, only that nothing here contradicts it', () => {
  const r = performanceCheck({ kind: 'manipulation', particle_radius_m: { value: 1e-6, ...S('f') },
    transport_speed_m_s: { value: 1e-5, ...S('f') }, available_thrust_N: { value: 1, ...S('f') } });
  assert.equal(r.verdict, 'can-move-it');
  assert.ok(r.what_this_cannot_say.length >= 3);
  assert.ok(r.model_caveat);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
