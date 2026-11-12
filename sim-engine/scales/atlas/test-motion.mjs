#!/usr/bin/env node
// Tests for motion.mjs
//
//   node sim-engine/scales/atlas/test-motion.mjs [--fail-once]
//
// Five things are checked harder than the rest.
//
//   1. THE PHYSICS IS CHECKED AGAINST CLOSED FORMS AND SCALING LAWS, not against itself. Stokes-Einstein
//      must scale as 1/r, as T and as 1/eta, and must round-trip against its own inverse. Displacement
//      must be sqrt(6 D t) in three dimensions and sqrt(2 D t) per axis, and those two must agree by
//      the factor sqrt(3).
//
//   2. THE RANDOM WALK IS CHECKED STATISTICALLY. It is not enough that stepSigmaUm returns the right
//      number; stepping a population with it must actually produce the right mean square displacement.
//      100,000 walkers are run and their RMS compared to the closed form. That is the assertion that
//      would catch a missing factor of two in the viewer.
//
//   3. THE SLOWDOWN IS A SQUARE, and the test asserts it as one. Displacement grows as sqrt(t), so
//      halving the apparent speed needs four times the slowing. Getting this linear would make the
//      animation four times too fast and look entirely plausible.
//
//   4. ONE CLOCK PRESERVES RELATIVE SPEEDS. The whole point of a shared time factor is that a
//      polymerase still outruns a ribosome on screen by the real ratio. The test asserts the ratio
//      equals sqrt(D1/D2) to floating-point tolerance, and that per-machine clocks would destroy it.
//
//   5. THE BOUND IS LABELLED A BOUND. The central honesty claim of the file is that its headline
//      number is an upper bound in a known direction. Assertions check that the flag is set, that the
//      direction is recorded, and that the subdiffusion exponent is null with a reason rather than
//      invented.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL; an assertion that survives its own fault asserts nothing.
import * as M from './motion.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rel = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b));

// ------------------------------------------------------------------ 1. the physics
console.log('\nStokes-Einstein, against its scaling laws and its own inverse');
{
  const kT = M.PHYS.boltzmann_J_per_K * 310.15;
  const eta = M.PHYS.water_viscosity_Pa_s.at_37C;
  const D1 = M.stokesEinstein(1e-9, eta, 310.15);
  check('D matches the closed form kT / (6 pi eta r)',
    rel(f(D1, D1 * 2), kT / (6 * Math.PI * eta * 1e-9), 1e-12), `${D1.toExponential(4)}`);
  check('D halves when the radius doubles', rel(f(M.stokesEinstein(2e-9, eta, 310.15), D1), D1 / 2, 1e-12));
  check('D is proportional to temperature', rel(
    f(M.stokesEinstein(1e-9, eta, 620.30) / D1, 1), 2, 1e-12));
  check('D is inversely proportional to viscosity', rel(
    f(M.stokesEinstein(1e-9, 2 * eta, 310.15) / D1, 1), 0.5, 1e-12));
  check('hydrodynamicRadius inverts stokesEinstein exactly', rel(
    f(M.hydrodynamicRadius(D1, eta, 310.15), 1), 1e-9, 1e-12));
  let threw = false; try { M.stokesEinstein(-1, eta, 310.15); } catch { threw = true; }
  check('a negative radius is refused rather than returning a number', f(threw, !threw));
  let threw2 = false; try { M.hydrodynamicRadius(0, eta, 310.15); } catch { threw2 = true; }
  check('a zero diffusion coefficient is refused by the inverse', f(threw2, !threw2));
  check('Boltzmann\'s constant is the exact SI value', f(
    M.PHYS.boltzmann_J_per_K === 1.380649e-23, M.PHYS.boltzmann_J_per_K !== 1.380649e-23));
}

// ------------------------------------------------------------------ the chain's sanity check
console.log('\nthe inferred GFP radius, which is a check on the whole chain');
{
  const g = M.gfpRadiusNm();
  check('a radius is inferred at each candidate temperature', f(g.length === 2, g.length !== 2));
  check('both land in the size range of a small protein, 2 to 5 nm', f(
    g.every(x => x.radius_nm > 2 && x.radius_nm < 5), g.some(x => x.radius_nm < 2 || x.radius_nm > 5)),
    g.map(x => `${x.label} ${x.radius_nm.toFixed(2)} nm`).join('; '));
  check('the warmer candidate gives the LARGER radius, since D is fixed and eta falls', f(
    g[1].radius_nm > g[0].radius_nm, g[1].radius_nm < g[0].radius_nm));
  check('the two differ by more than 30 %, which is why the temperature is not quietly chosen', f(
    g[1].radius_nm / g[0].radius_nm > 1.3, g[1].radius_nm / g[0].radius_nm < 1.3),
    `${(g[1].radius_nm / g[0].radius_nm).toFixed(3)}x`);
  check('the temperature is recorded as not established, with a reason', f(
    M.TEMPERATURE.not_established === true && M.TEMPERATURE.why.length > 20,
    M.TEMPERATURE.not_established !== true));
}

// ------------------------------------------------------------------ equivalent radius
console.log('\nthe equivalent-sphere radius, from measured extents');
{
  check('a sphere of diameter d gives radius d/2', f(
    near(M.equivalentRadiusNm([10, 10, 10]), 5, 1e-12), near(M.equivalentRadiusNm([10, 10, 10]), 10, 1e-12)));
  check('it is the geometric mean of the extents, halved', (() => {
    const e = [30.2, 27.3, 26.1];
    return f(near(M.equivalentRadiusNm(e), Math.cbrt(e[0] * e[1] * e[2]) / 2, 1e-12), false);
  })());
  check('an elongated object gives a radius between its shortest and longest half-extents', (() => {
    const r = M.equivalentRadiusNm([40, 10, 10]);
    return f(r > 5 && r < 20, r < 5 || r > 20);
  })());
  check('a malformed extent list returns null, not NaN', f(
    M.equivalentRadiusNm([1, 2]) === null && M.equivalentRadiusNm([1, 2, 0]) === null,
    M.equivalentRadiusNm([1, 2]) !== null));
}

// ------------------------------------------------------------------ 1. displacement closed forms
console.log('\ndisplacement, against the closed forms');
{
  const D = 7.38, t = 1 / 60;
  check('rms displacement is sqrt(6 D t)', rel(
    f(M.rmsDisplacementUm(D, t), M.rmsDisplacementUm(D, t) * 2), Math.sqrt(6 * D * t), 1e-12));
  check('per-axis sigma is sqrt(2 D t)', rel(
    f(M.stepSigmaUm(D, t), M.stepSigmaUm(D, t) / 2), Math.sqrt(2 * D * t), 1e-12));
  check('the two agree by the factor sqrt(3), which is the 3D identity', rel(
    f(M.rmsDisplacementUm(D, t) / M.stepSigmaUm(D, t), 1), Math.sqrt(3), 1e-12));
  check('displacement grows as the square root of time, not linearly', (() => {
    const a = M.rmsDisplacementUm(D, t), b = M.rmsDisplacementUm(D, 4 * t);
    return f(rel(b / a, 2, 1e-12), rel(b / a, 4, 1e-12));
  })(), `${(M.rmsDisplacementUm(D, 4 * t) / M.rmsDisplacementUm(D, t)).toFixed(4)}`);
  check('zero time gives zero displacement', f(M.rmsDisplacementUm(D, 0) === 0, M.rmsDisplacementUm(D, 0) !== 0));
  let threw = false; try { M.rmsDisplacementUm(-1, t); } catch { threw = true; }
  check('a negative diffusion coefficient is refused', f(threw, !threw));
}

// ------------------------------------------------------------------ 2. the walk, statistically
console.log('\nthe random walk itself, run and measured');
{
  // A deterministic generator, so the test does not flake. It must also be UNBIASED, which the
  // textbook LCG is not in JavaScript - see mulberry32's comment in motion.mjs. The tolerance below
  // is 1 %, and the broken generator missed it by 1.04 %, which is how it was found.
  const rnd = M.mulberry32(123456789);
  const pairs = [];
  for (let i = 0; i < 60000; i++) pairs.push(M.gaussianPair(rnd));
  const flat = pairs.flat();
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  const sd = Math.sqrt(flat.reduce((a, b) => a + (b - mean) ** 2, 0) / flat.length);
  check('gaussianPair has mean 0 to within 0.02', f(Math.abs(mean) < 0.02, Math.abs(mean) > 0.02), `${mean.toFixed(5)}`);
  check('gaussianPair has unit standard deviation to within 1 %', f(
    Math.abs(sd - 1) < 0.01, Math.abs(sd - 1) > 0.01), `${sd.toFixed(5)}`);
  check('gaussianPair returns two independent values, not one repeated', f(
    pairs.filter(p => p[0] === p[1]).length === 0, pairs.filter(p => p[0] === p[1]).length > 0));

  // THE ASSERTION THAT WOULD CATCH A FACTOR OF TWO IN THE VIEWER
  const D = 7.38, dt = 2.062e-6;
  const sigma = M.stepSigmaUm(D, dt);
  let sum2 = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) {
    const [a, b] = M.gaussianPair(rnd), [c] = M.gaussianPair(rnd);
    const x = a * sigma, y = b * sigma, z = c * sigma;
    sum2 += x * x + y * y + z * z;
  }
  const empiricalRms = Math.sqrt(sum2 / N);
  const closed = M.rmsDisplacementUm(D, dt);
  check('stepping 100,000 walkers with stepSigmaUm reproduces sqrt(6 D t) to within 1 %', f(
    Math.abs(empiricalRms - closed) / closed < 0.01, Math.abs(empiricalRms - closed) / closed > 0.01),
    `empirical ${empiricalRms.toExponential(4)} vs closed ${closed.toExponential(4)}`);
}

// ------------------------------------------------------------------ 3. the slowdown is a square
console.log('\nthe animation plan');
{
  const p = M.animationPlan({ D_um2_s: 7.38, box_um: 2.702, fps: 60, target_fraction_of_box: 0.005 });
  check('at real speed a ribosome crosses a large fraction of the box per frame', f(
    p.real_rms_as_fraction_of_box > 0.2, p.real_rms_as_fraction_of_box < 0.2),
    `${(100 * p.real_rms_as_fraction_of_box).toFixed(1)}%`);
  check('so the plan says it needs slowing', f(p.needs_slowing === true, p.needs_slowing !== true));
  check('the slowdown is the SQUARE of the displacement ratio, not the ratio', f(
    rel(p.time_slowdown_factor, (p.real_rms_per_frame_um / p.target_rms_per_frame_um) ** 2, 1e-9),
    rel(p.time_slowdown_factor, p.real_rms_per_frame_um / p.target_rms_per_frame_um, 1e-9)),
    `${p.time_slowdown_factor.toFixed(1)}`);
  check('applying the slowed dt lands on the target displacement', (() => {
    const dt = 1 / (60 * p.time_slowdown_factor);
    return f(rel(M.rmsDisplacementUm(7.38, dt), p.target_rms_per_frame_um, 1e-9), false);
  })());
  check('one second of animation is reported as a real duration, and it is sub-millisecond', f(
    p.one_second_of_animation_is_s_of_real_time < 1e-3 && p.one_second_of_animation_is_s_of_real_time > 0,
    p.one_second_of_animation_is_s_of_real_time > 1e-3),
    `${(p.one_second_of_animation_is_s_of_real_time * 1e6).toFixed(0)} us`);
  check('a slow enough particle needs no slowing at all', (() => {
    const q = M.animationPlan({ D_um2_s: 1e-9, box_um: 2.702 });
    return f(q.needs_slowing === false && q.time_slowdown_factor === 1, q.needs_slowing === true);
  })());
}

// ------------------------------------------------------------------ 4. one clock
console.log('\none clock for the whole scene, and what it preserves');
{
  const members = [
    { machine: 'ribosome', radius_nm: 13.91, D_um2_s: 7.38 },
    { machine: 'pol2', radius_nm: 7.33, D_um2_s: 14.01 },
    { machine: 'spliceosome', radius_nm: 14.78, D_um2_s: 6.95 },
  ];
  const s = M.sceneAnimationPlan(members, { box_um: 2.702 });
  check('the shared factor is the LARGEST any member needs', f(
    rel(s.time_slowdown_factor, Math.max(...members.map(m =>
      M.animationPlan({ D_um2_s: m.D_um2_s, box_um: 2.702 }).time_slowdown_factor)), 1e-12), false));
  check('and it is set by the member with the largest D, which is the smallest machine', f(
    s.set_by === 'pol2', s.set_by === 'ribosome'), s.set_by);
  check('every member is inside the displacement budget under the shared clock', f(
    s.members.every(m => m.rms_as_fraction_of_box <= 0.005 + 1e-9),
    s.members.some(m => m.rms_as_fraction_of_box > 0.005 + 1e-9)),
    s.members.map(m => (100 * m.rms_as_fraction_of_box).toFixed(3)).join(', '));

  // THE PROPERTY THE SHARED CLOCK EXISTS FOR
  const rib = s.members.find(m => m.machine === 'ribosome');
  const pol = s.members.find(m => m.machine === 'pol2');
  check('on-screen speed ratio equals sqrt of the diffusion-coefficient ratio', f(
    rel(pol.rms_per_frame_um / rib.rms_per_frame_um, Math.sqrt(14.01 / 7.38), 1e-9),
    rel(pol.rms_per_frame_um / rib.rms_per_frame_um, 14.01 / 7.38, 1e-9)),
    `${(pol.rms_per_frame_um / rib.rms_per_frame_um).toFixed(4)} vs ${Math.sqrt(14.01 / 7.38).toFixed(4)}`);
  check('the polymerase is visibly faster than the ribosome, not equal to it', f(
    pol.rms_per_frame_um / rib.rms_per_frame_um > 1.2,
    pol.rms_per_frame_um / rib.rms_per_frame_um < 1.2));
  check('per-machine clocks WOULD destroy that, which is why they are not used', (() => {
    // under its own clock every machine lands on the same target, so the ratio collapses to 1
    const a = M.animationPlan({ D_um2_s: 7.38, box_um: 2.702 }).target_rms_per_frame_um;
    const b = M.animationPlan({ D_um2_s: 14.01, box_um: 2.702 }).target_rms_per_frame_um;
    return f(rel(a / b, 1, 1e-12), !rel(a / b, 1, 1e-12));
  })());
  check('the slowed dt is consistent with the shared factor', f(
    rel(s.slowed_dt_s, 1 / (60 * s.time_slowdown_factor), 1e-12), false));
  check('the reason the clock is set by the fastest member is recorded', f(
    /largest D/.test(s.why_set_by_the_fastest), !/largest D/.test(s.why_set_by_the_fastest)));
  let threw = false; try { M.sceneAnimationPlan([], { box_um: 1 }); } catch { threw = true; }
  check('an empty scene is refused rather than returning a plan', f(threw, !threw));
}

// ------------------------------------------------------------------ 5. the bound is a bound
console.log('\nthe honesty of the headline number');
{
  const rib = M.equivalentRadiusNm([30.2, 27.3, 26.1]);
  const d = M.diffusionUpperBound(rib);
  check('the result is flagged as an upper bound', f(d.is_upper_bound === true, d.is_upper_bound !== true));
  check('it carries the reason it is only a bound', f(d.why.length > 40 && /5 nm|20-200/.test(d.why), false));
  check('the cytoplasmic value is the saline value divided by the measured slowdown', f(
    rel(d.D_saline_um2_s / d.D_cytoplasm_um2_s, M.MEASURED.cytoplasmic_slowdown_translational.value, 1e-12),
    false));
  check('a smaller machine gets a larger diffusion coefficient', f(
    M.diffusionUpperBound(5).D_cytoplasm_um2_s > M.diffusionUpperBound(15).D_cytoplasm_um2_s, false));
  check('an invalid radius returns null rather than Infinity', f(
    M.diffusionUpperBound(0) === null && M.diffusionUpperBound(-1) === null,
    M.diffusionUpperBound(0) !== null));
  check('the direction of the error is stated, and it is "too fast"', f(
    /too fast/i.test(M.UPPER_BOUND.direction), !/too fast/i.test(M.UPPER_BOUND.direction)));
  check('what would replace the bound is named concretely', f(
    /measured diffusion coefficient/i.test(M.UPPER_BOUND.what_would_replace_it), false));

  // the two measurements that disagree, kept apart
  check('the translational and rotational slowdowns are stored separately, not averaged', f(
    M.MEASURED.cytoplasmic_slowdown_translational.value !== M.MEASURED.cytoplasmic_slowdown_rotational.value,
    M.MEASURED.cytoplasmic_slowdown_translational.value === M.MEASURED.cytoplasmic_slowdown_rotational.value));
  check('and the file says a single cytoplasmic viscosity is not a quantity', f(
    /no single number/i.test(M.MEASURED.cytoplasmic_slowdown_rotational.why_it_matters), false));
  check('the two differ by about a factor of two, which is the point', f(
    rel(M.MEASURED.cytoplasmic_slowdown_translational.value / M.MEASURED.cytoplasmic_slowdown_rotational.value, 2.13, 0.02),
    false));

  check('the subdiffusion exponent is null with a reason, not invented', f(
    M.MEASURED.subdiffusion.exponent === null && M.MEASURED.subdiffusion.null_reason.length > 40,
    M.MEASURED.subdiffusion.exponent !== null));
  check('and its direction of error is recorded as pointing the same way as the bound', f(
    /too fast/i.test(M.MEASURED.subdiffusion.direction_of_the_error), false));
  check('the size-specific result that rules out the extrapolation is recorded with its range', f(
    M.MEASURED.size_specificity_of_crowding.affected_range_nm[0] === 20
      && M.MEASURED.size_specificity_of_crowding.unaffected_at_or_below_nm === 5, false));
  check('a ribosome sits inside the affected range and GFP below it, which is the whole argument', f(
    rib * 2 > 20 && rib * 2 < 200 && M.gfpRadiusNm()[0].radius_nm * 2 < 8, false),
    `ribosome ${(rib * 2).toFixed(1)} nm, GFP ${(M.gfpRadiusNm()[0].radius_nm * 2).toFixed(1)} nm`);
}

// ------------------------------------------------------------------ what is drawn exactly
console.log('\nthe two things that are drawn as measured, not as bounds');
{
  const W = M.WHAT_THE_VIEWER_DRAWS;
  check('the immobile fraction follows from the measured mobile fraction', f(
    rel(W.immobile_fraction.value, 1 - M.MEASURED.mobile_fraction.value, 1e-12), false));
  check('it is about a fifth, and is drawn', f(
    W.immobile_fraction.value > 0.15 && W.immobile_fraction.value < 0.2, false),
    `${(100 * W.immobile_fraction.value).toFixed(0)}%`);
  check('and the file says what the measurement does NOT say', f(
    /does NOT say which/i.test(W.immobile_fraction.honesty), false));
  check('the Pol II cluster lifetime is the measured 5.1 s', f(
    W.pol2_clustering.lifetime_s === 5.1, W.pol2_clustering.lifetime_s !== 5.1));
  check('its interval brackets the measured value', f(
    M.MEASURED.pol2_cluster_lifetime.interval[0] < 5.1 && M.MEASURED.pol2_cluster_lifetime.interval[1] > 5.1,
    false));
  check('the cluster SIZE is declared depicted rather than measured', f(
    /not taken from anywhere|depicted/i.test(W.pol2_clustering.honesty), false));
  check('the absence of collisions is named as the largest missing physics', f(
    /excluded volume/i.test(W.no_collisions) && /largest/i.test(W.no_collisions), false));
  check('and it is linked to the subdiffusion, since they are the same omission', f(
    /subdiffusive/i.test(W.no_collisions), !/subdiffusive/i.test(W.no_collisions)));
}

// ------------------------------------------------------------------ provenance
console.log('\nprovenance and refusals');
{
  check('four citations, each with a DOI', f(
    Object.keys(M.CITATIONS).length >= 4
      && Object.values(M.CITATIONS).filter(c => /doi:/.test(c)).length >= 4, false),
    `${Object.keys(M.CITATIONS).length} entries`);
  check('every citation says how it was read in this run', f(
    Object.values(M.CITATIONS).filter(c => /read .*(abstract|full text)|in this run/i.test(c)).length >= 4,
    false));
  check('the Delarue entry admits its numbers were NOT recoverable', f(
    /NOT recoverable/.test(M.CITATIONS.delarue_2018), !/NOT recoverable/.test(M.CITATIONS.delarue_2018)));
  check('the Weiss entry admits the full text came back empty', f(
    /empty full text/.test(M.CITATIONS.weiss_2004), false));
  check('sizes are credited to the measuring module, not to literature', f(
    /machines\.mjs/.test(M.CITATIONS.machines_module) && /No size here is quoted/.test(M.CITATIONS.machines_module),
    false));
  check('seven things are named as not modelled', f(
    M.WHAT_THIS_DOES_NOT_MODEL.length === 7, M.WHAT_THIS_DOES_NOT_MODEL.length !== 7),
    `${M.WHAT_THIS_DOES_NOT_MODEL.length}`);
  check('binding is named, since it dominates where a machine actually is', f(
    M.WHAT_THIS_DOES_NOT_MODEL.some(s => /binding/i.test(s) && /dominates/i.test(s)), false));
  check('active transport is named separately from diffusion', f(
    M.WHAT_THIS_DOES_NOT_MODEL.some(s => /active transport/i.test(s)), false));
  check('worked() runs and reports the slowdown', f(
    /slower than real time/.test(M.worked()), !/slower than real time/.test(M.worked())));
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  [--fail-once: every line above must FAIL]' : ''}`);
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
