#!/usr/bin/env node
// node sim-engine/validate/locomotion/test/locomotion.mjs
//
// The locomotion layer. Each assertion names the wrong answer it exists to prevent, and the three kinds of
// result are tested as three different kinds of thing: a theorem that may declare a design impossible,
// arithmetic that may catch a design contradicting itself, and regime indicators that must NEVER fail
// anything however suggestive the number is.
import assert from 'node:assert/strict';
import { locomotionCheck, MODES } from '../index.mjs';

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok    ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n          ' + String(e.message).split('\n').join('\n          ')); } };
const S = s => ({ source: s });
const BACT = { taxon: 'Escherichia coli', mode: 'swim', medium: 'water',
  body_length_m: { value: 2e-6, ...S('test fixture') }, speed_m_s: { value: 3e-5, ...S('test fixture') } };

console.log('\ninputs');
ok('a bare number is refused by name, never read as a quantity', () => {
  const r = locomotionCheck({ ...BACT, body_length_m: 2e-6 });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /body_length_m.*bare number/s);
});
ok('a quantity with no source is refused', () => {
  const r = locomotionCheck({ ...BACT, speed_m_s: { value: 3e-5 } });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /speed_m_s.*source/s);
});
ok('an unstated mode is refused with the list, because the layer is about HOW it moves', () => {
  const r = locomotionCheck({ taxon: 'Escherichia coli' });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.ok(Object.keys(r.modes).every(m => Object.keys(MODES).includes(m)));
});

console.log('\nthe scallop theorem -- the one check here that may declare a design impossible');
ok('a reciprocal stroke at low Reynolds number is IMPOSSIBLE, not merely poor', () => {
  // The verdict that could not be reached from a part list: nothing is wrong with the paddle as a
  // structure. Net displacement per cycle is zero, at any beat frequency.
  const r = locomotionCheck({ ...BACT, gait: { reciprocal: true, degrees_of_freedom: 1, source: 'test fixture' } });
  assert.equal(r.verdict, 'impossible');
  const c = r.checks.find(x => x.id === 'reciprocal_stroke_at_low_reynolds');
  assert.equal(c.kind, 'theorem');
  assert.equal(c.detail.doi, '10.1119/1.10903');
  assert.match(c.limiting_factor, /depends on the PATH/);
  assert.ok(c.detail.what_would_fix_it, 'a theorem that forbids something must say what would satisfy it');
});
ok('one degree of freedom is reciprocal whether or not the caller says so', () => {
  const r = locomotionCheck({ ...BACT, gait: { degrees_of_freedom: 1, source: 'test fixture' } });
  assert.equal(r.verdict, 'impossible');
});
ok('beating faster does not help, because the theorem is about the path and not the rate', () => {
  const slow = locomotionCheck({ ...BACT, gait: { reciprocal: true, degrees_of_freedom: 1, cycle_hz: { value: 1, ...S('fixture') }, distance_per_cycle_m: { value: 3e-5, ...S('fixture') }, source: 'fixture' } });
  const fast = locomotionCheck({ ...BACT, gait: { reciprocal: true, degrees_of_freedom: 1, cycle_hz: { value: 1000, ...S('fixture') }, distance_per_cycle_m: { value: 3e-8, ...S('fixture') }, source: 'fixture' } });
  assert.equal(slow.verdict, 'impossible');
  assert.equal(fast.verdict, 'impossible');
});
ok('a non-reciprocal stroke is not forbidden at any Reynolds number', () => {
  const r = locomotionCheck({ ...BACT, gait: { reciprocal: false, degrees_of_freedom: 3, source: 'test fixture' } });
  assert.equal(r.checks.find(x => x.id === 'reciprocal_stroke_at_low_reynolds').verdict, 'holds');
  assert.notEqual(r.verdict, 'impossible');
});
ok('a reciprocal stroke at HIGH Reynolds number is fine -- a scallop is a scallop because it is big', () => {
  const r = locomotionCheck({ taxon: 'Danio rerio', mode: 'swim', medium: 'seawater',
    body_length_m: { value: 0.08, ...S('fixture') }, speed_m_s: { value: 0.3, ...S('fixture') },
    gait: { reciprocal: true, degrees_of_freedom: 1, source: 'fixture' } });
  assert.equal(r.checks.find(x => x.id === 'reciprocal_stroke_at_low_reynolds').verdict, 'holds');
  assert.ok(r.reynolds.max > 1000);
});
ok('between the limits it is at-risk, not impossible: the theorem is about Re -> 0', () => {
  // Re about 5: above the creeping boundary, far below the inertial one. 1 mm at 5 mm/s in water.
  const r = locomotionCheck({ taxon: 'Xenopus laevis', mode: 'ciliary', medium: 'water',
    body_length_m: { value: 1e-3, ...S('fixture') }, speed_m_s: { value: 5e-3, ...S('fixture') },
    gait: { reciprocal: true, degrees_of_freedom: 1, source: 'fixture' } });
  assert.ok(r.reynolds.max > 1 && r.reynolds.max < 100, `Re ${r.reynolds.max} should sit between the two conventional boundaries`);
  assert.equal(r.verdict, 'at-risk');
  assert.match(r.checks.find(x => x.id === 'reciprocal_stroke_at_low_reynolds').limiting_factor, /not far above it/);
});
ok('a gait with no source gets no theorem applied to it', () => {
  const r = locomotionCheck({ ...BACT, gait: { reciprocal: true, degrees_of_freedom: 1 } });
  assert.equal(r.checks.find(x => x.id === 'reciprocal_stroke_at_low_reynolds').verdict, 'cannot-evaluate');
  assert.notEqual(r.verdict, 'impossible', 'whether a stroke is time-reversible is a claim about the design and is not inferred here');
});

console.log('\narithmetic -- a design contradicting itself');
ok('a cycle that cannot reach the stated speed is reported as contradicting it', () => {
  const r = locomotionCheck({ ...BACT, speed_m_s: { value: 1e-3, ...S('fixture') },
    gait: { reciprocal: false, degrees_of_freedom: 3, cycle_hz: { value: 100, ...S('fixture') }, distance_per_cycle_m: { value: 1e-8, ...S('fixture') }, source: 'fixture' } });
  const c = r.checks.find(x => x.id === 'cycle_produces_the_speed');
  assert.equal(c.kind, 'arithmetic');
  assert.equal(c.verdict, 'contradicts');
  assert.match(c.limiting_factor, /short by a factor/);
  assert.equal(r.verdict, 'contradicts-itself');
});
ok('an overshoot is caught too, and says one of the three numbers is wrong', () => {
  const r = locomotionCheck({ ...BACT, speed_m_s: { value: 1e-8, ...S('fixture') },
    gait: { reciprocal: false, degrees_of_freedom: 3, cycle_hz: { value: 100, ...S('fixture') }, distance_per_cycle_m: { value: 1e-6, ...S('fixture') }, source: 'fixture' } });
  assert.match(r.checks.find(x => x.id === 'cycle_produces_the_speed').limiting_factor, /overshoots/);
});
ok('overlapping ranges are consistent, not forced to a point', () => {
  const r = locomotionCheck({ ...BACT, speed_m_s: { min: 1e-5, max: 5e-5, ...S('fixture') },
    gait: { reciprocal: false, degrees_of_freedom: 3, cycle_hz: { min: 50, max: 150, ...S('fixture') }, distance_per_cycle_m: { min: 2e-7, max: 5e-7, ...S('fixture') }, source: 'fixture' } });
  assert.equal(r.checks.find(x => x.id === 'cycle_produces_the_speed').verdict, 'consistent');
});

console.log('\nregimes -- reported, and never a verdict');
ok('no regime check can fail a design, however suggestive its number', () => {
  for (const args of [
    { ...BACT },
    { taxon: 'Mus musculus', mode: 'run', body_length_m: { value: 0.09, ...S('f') }, speed_m_s: { value: 40, ...S('f') } },
    { taxon: 'Mus musculus', mode: 'walk', body_length_m: { value: 0.09, ...S('f') }, speed_m_s: { value: 1e-6, ...S('f') } },
  ]) {
    const r = locomotionCheck(args);
    for (const c of r.checks.filter(x => x.kind === 'regime')) {
      assert.equal(c.verdict, 'reported', `${c.id} returned ${c.verdict}; a regime indicator must never fail a design`);
    }
  }
});
ok('the Froude check says in the result why it is not a verdict', () => {
  const r = locomotionCheck({ taxon: 'Mus musculus', mode: 'walk', body_length_m: { value: 0.09, ...S('f') }, speed_m_s: { value: 0.5, ...S('f') } });
  const c = r.checks.find(x => x.id === 'froude_regime');
  assert.match(c.detail.why_this_is_not_a_verdict, /necessary/i);
  assert.match(c.detail.why_this_is_not_a_verdict, /human result/, 'the 0.5 transition is a human number and the result must say so');
});
ok('the medium carries its own caveat: water is not mucus', () => {
  const r = locomotionCheck(BACT);
  assert.match(r.checks.find(x => x.id === 'reynolds_regime').detail.medium_caveat, /mucus|biofilm|cytoplasm/);
});

console.log('\nflight delegates rather than reimplementing');
ok('a flight mode with no clade coefficient refuses, and does not borrow one', () => {
  const r = locomotionCheck({ taxon: 'Drosophila melanogaster', mode: 'fly',
    body_length_m: { value: 0.0025, ...S('f') }, speed_m_s: { value: 0.5, ...S('f') },
    mass_kg: { value: 1.2e-6, ...S('f') }, lifting_area_m2: { value: 4e-6, ...S('f') } });
  const c = r.checks.find(x => x.id === 'lift_carries_the_weight');
  assert.equal(c.verdict, 'cannot-evaluate');
  assert.equal(c.detail.delegated_to.includes('flight_support_check'), true, 'there must be ONE lift-coefficient policy, not two that can drift');
  assert.equal(r.verdict, 'partly-evaluated');
  assert.match(r.reading, /PARTLY EVALUATED/, 'a check that did not run is not a check that passed, and the reading must not say otherwise');
});

console.log('\nwhat it refuses to claim');
ok('a design it does not contradict is never reported as shown to move', () => {
  const r = locomotionCheck({ ...BACT, gait: { reciprocal: false, degrees_of_freedom: 3, source: 'fixture' } });
  assert.equal(r.verdict, 'not-contradicted');
  assert.match(r.reading, /NOT a finding that it moves/);
  assert.ok(r.what_this_layer_cannot_say.length >= 4);
  assert.ok(r.what_this_layer_cannot_say.some(x => /muscle/.test(x)) && r.what_this_layer_cannot_say.some(x => /energy|metabol/.test(x)));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
