// creatures-test.mjs -- node tests for SECTION A of creatures.js (the ensemble maths).
//
//   node dashboard/public/t/physics/sim/creatures-test.mjs
//
// Section B (the decorative school / predator / gliders) needs THREE and a GL context and is
// checked in the browser by creatures-test.html, headless with Edge + swiftshader.
//
// Every assertion was made to fail once. `CREATURES_TEST_SABOTAGE=1` inverts every assertion, and
// all of them must then fail: that proves none of them is vacuous. The same convention as
// sim-engine/test/scenarios-environment.mjs (ENV_TEST_SABOTAGE).

import {
  DISTRIBUTIONS, SEA_STATE, MASS_CV, REF_AREA_CV, PARK_CHOI_REF_AREAS_M2,
  elevationSd, slopeSdDeg, makeRng, perturbRun, glideTrajectory, analyticBound,
  makeEnsemble, summarise, seedFromUrl, seedToUrl, isFlier, UNCERTAINTY_NOTE, LEGEND,
} from './creatures.js';

const SABOTAGE = process.env.CREATURES_TEST_SABOTAGE === '1';
let pass = 0; const fails = [];
function ok(cond, what) {
  const c = SABOTAGE ? !cond : !!cond;
  if (c) pass++; else fails.push(what);
}
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

// ---------------------------------------------------------------- fixtures
// The flying fish: params.json fish[0], Park & Choi 2010 specimen L3, transcribed here so the
// test does not depend on the live params.json being loadable as JSON from node.
const L3 = {
  id: 'cypselurus-hiraii-L3', species: 'Cypselurus hiraii',
  mass_kg: { value: 0.06, kind: 'measured', source: 'park-choi-2010 Table 1 model L3' },
  ref_area_m2: { value: 0.012688, kind: 'measured', source: 'park-choi-2010 Table 1 model L3: A1+A2+A3' },
  span_m: { value: 0.261, kind: 'measured', source: 'park-choi-2010 Table 1 model L3' },
  CL_max: { value: 0.78, kind: 'measured', source: 'park-choi-2010 Table 2' },
  LD_max: { value: 4.37, kind: 'measured', source: 'park-choi-2010 Table 2' },
  CD_min: { value: 0.055, kind: 'measured', source: 'park-choi-2010 Table 2' },
  CL_at_zero_deg: { value: 0.4, kind: 'assumed', source: 'params.json: not in the text' },
  stall_alpha_deg: { value: 35, kind: 'measured', source: 'park-choi-2010' },
  glide_alpha_deg: { value: 5, kind: 'assumed', source: 'params.json: not measured' },
  approach_angle_deg: { value: 10, kind: 'assumed', source: 'params.json' },
  takeoff_speed_target_m_s: { value: 17.5, kind: 'assumed', source: 'params.json: midpoint of the 15-20 m/s band' },
};
// The winged zebrafish: params.json fish[3], the hypothetical that glide.mjs says gets 0.
// Its launch speed is the zebrafish's OWN Umax, not the what-if 8 m/s in params.json:
// Umax = 1.15 x Ucrit, Ucrit <= 17.9 SL/s (current.mjs / ENVIRONMENT.md adult range 13.7-17.9
// SL/s) x SL 0.030 m = 0.537 m/s, x1.15 = 0.617 m/s. The TOP of the measured range, so this is
// the most generous zebrafish launch speed the repository supports.
const ZF = {
  id: 'zebrafish-winged-hypothetical', species: 'Danio rerio',
  mass_kg: { value: 0.00051, kind: 'derived', source: 'params.json fish[3]' },
  ref_area_m2: { value: 0.000277, kind: 'derived', source: 'params.json fish[3]' },
  span_m: { value: 0.0386, kind: 'derived', source: 'params.json fish[3]' },
  CL_max: { value: 0.78 }, LD_max: { value: 4.37 }, CD_min: { value: 0.055 },
  CL_at_zero_deg: { value: 0.4 }, stall_alpha_deg: { value: 35 }, glide_alpha_deg: { value: 5 },
  approach_angle_deg: { value: 10 },
  launch_airspeed_m_s: { value: 0.617, kind: 'calibrated', source: 'zebrafish Umax = 1.15 x Ucrit (current.mjs), at the TOP of the measured adult 13.7-17.9 SL/s range x SL 0.030 m' },
};

// ---------------------------------------------------------------- 1. the distribution catalogue
ok(DISTRIBUTIONS.length >= 8, 'the catalogue has at least the eight documented distributions');
for (const d of DISTRIBUTIONS) {
  ok(typeof d.key === 'string' && d.key.length > 0, `distribution has a key`);
  ok(['measured', 'measured-secondhand', 'borrowed', 'assumed'].includes(d.band_kind), `${d.key}: band_kind is one of the repository's kinds (got ${d.band_kind})`);
  ok(['measured', 'measured-secondhand', 'borrowed', 'assumed'].includes(d.shape_kind), `${d.key}: shape_kind is one of the repository's kinds`);
  ok(typeof d.source === 'string' && d.source.length > 60, `${d.key}: has a real source string, not a stub`);
  ok(typeof d.draw === 'function', `${d.key}: has a draw function`);
}
const byKey = k => DISTRIBUTIONS.find(d => d.key === k);
// Every distribution's SHAPE is assumed: no source in the repository gives a distribution.
ok(DISTRIBUTIONS.every(d => d.shape_kind === 'assumed'), 'every shape is labelled assumed (no source gives a distribution, only ranges and sds)');
// The launch band is the sourced 15-20 m/s, and it is measured-secondhand, not measured.
ok(byKey('launch_airspeed_m_s').band[0] === 15 && byKey('launch_airspeed_m_s').band[1] === 20, 'launch airspeed band is 15-20 m/s');
ok(byKey('launch_airspeed_m_s').band_kind === 'measured-secondhand', 'the launch band is measured-secondhand (Davenport 1994, quoted)');
ok(/Davenport 1994/.test(byKey('launch_airspeed_m_s').source) && /10\.1101\/765560/.test(byKey('launch_airspeed_m_s').source), 'the launch band cites Davenport 1994 via the Deng 2019 DOI');
// The two wave terms and the gust are assumed, because the repository has no sea state at all.
for (const k of ['surface_elevation_m', 'surface_slope_deg', 'wind_along_path_m_s', 'glide_alpha_deg']) {
  ok(byKey(k).band_kind === 'assumed', `${k} is labelled assumed`);
}
ok(byKey('ref_area_m2').band_kind === 'measured', 'the fin-area spread is measured (Park & Choi, n = 3)');
ok(byKey('mass_kg').band_kind === 'borrowed', 'the mass spread is borrowed (a different genus)');
// The hand arithmetic behind the two measured CVs.
near(MASS_CV, 19.8 / 227.7, 1e-12, 'MASS_CV = 19.8/227.7 (Makiguchi 2013 Table 1, n = 13)');
near(MASS_CV, 0.08696, 1e-4, 'MASS_CV is 8.70%');
ok(PARK_CHOI_REF_AREAS_M2.length === 3, 'three Park & Choi specimens with both fin pairs spread (L1, L2, L3)');
near(PARK_CHOI_REF_AREAS_M2[2], 0.006377 + 0.001837 + 0.004474, 1e-12, 'L3 reference area = pectoral + pelvic + planform from glide-data.csv');
near(REF_AREA_CV, 0.021677, 1e-5, 'REF_AREA_CV is 2.17% (sample sd / mean of the three areas)');
// The sea state is assumed and its two derived quantities follow the stated geometry.
ok(SEA_STATE.kind === 'assumed', 'the sea state is labelled assumed');
near(elevationSd(), 0.25, 1e-12, 'elevation sd = Hs/4 = 0.25 m for the assumed Hs 1.0 m');
near(slopeSdDeg(), Math.atan((Math.PI * 1.0) / 30 / Math.SQRT2) * 180 / Math.PI, 1e-12, 'slope sd follows atan(pi Hs / lambda / sqrt 2)');
near(slopeSdDeg(), 4.2355, 1e-3, 'slope sd is 4.24 deg for the assumed Hs 1.0 m and lambda 30 m');
ok(/UNCERTAINTY ILLUSTRATION, not a measured distribution/.test(UNCERTAINTY_NOTE), 'the uncertainty note says the spread is an illustration, not a measured distribution');
ok(/independently/i.test(UNCERTAINTY_NOTE), 'the uncertainty note admits mass and area are drawn independently');
ok(LEGEND.ambient.badge === 'decorative' && LEGEND.ensemble.badge === 'physics', 'the legend labels B decorative and A physics');
ok(/No birds anywhere/.test(LEGEND.no_birds), 'the legend states there are no birds');

// ---------------------------------------------------------------- 2. the PRNG
{
  const a = makeRng('abc'), b = makeRng('abc'), c = makeRng('xyz');
  const A = Array.from({ length: 50 }, () => a()), B = Array.from({ length: 50 }, () => b()), C = Array.from({ length: 50 }, () => c());
  ok(A.every((v, i) => v === B[i]), 'the same seed gives the same stream');
  ok(A.some((v, i) => v !== C[i]), 'a different seed gives a different stream');
  ok(A.every(v => v >= 0 && v < 1), 'the stream stays in [0, 1)');
  const m = A.reduce((s, x) => s + x, 0) / A.length;
  ok(m > 0.3 && m < 0.7, `the stream is not degenerate (mean ${m.toFixed(3)})`);
  // Forking must be independent: this is what stops a decorative school from shifting an ensemble.
  const p = makeRng('seed-1'), q = makeRng('seed-1');
  const pe = p.fork('ensemble'); const first = Array.from({ length: 10 }, () => pe());
  const qs = q.fork('school'); for (let i = 0; i < 1000; i++) qs();      // burn the school stream hard
  const qe = q.fork('ensemble'); const second = Array.from({ length: 10 }, () => qe());
  ok(first.every((v, i) => v === second[i]), 'forked streams are independent: burning the school stream does not move the ensemble stream');
  ok(p.fork('school')() !== p.fork('ensemble')(), 'different fork labels give different streams');
  // normal(): mean and sd within sampling error over 20000 draws.
  const r = makeRng('normal-check'); const N = 20000; let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) { const x = r.normal(3, 2); s1 += x; s2 += x * x; }
  const mu = s1 / N, sd = Math.sqrt(s2 / N - mu * mu);
  near(mu, 3, 0.06, 'rng.normal mean');
  near(sd, 2, 0.06, 'rng.normal sd');
}

// ---------------------------------------------------------------- 3. summarise
{
  const s = summarise([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  ok(s.n === 10, 'summarise counts the sample');
  near(s.median, 5.5, 1e-12, 'median of 1..10');
  near(s.p5, 1.45, 1e-12, 'p5 of 1..10 by linear interpolation');
  near(s.p95, 9.55, 1e-12, 'p95 of 1..10 by linear interpolation');
  ok(s.min === 1 && s.max === 10, 'min and max');
  const e = summarise([1, null, NaN, undefined, 3]);
  ok(e.n === 2 && e.median === 2, 'summarise drops nulls and NaN');
  ok(summarise([]).n === 0 && summarise([]).median === null, 'an empty sample gives n 0 and null statistics');
}

// ---------------------------------------------------------------- 4. the analytic bound reproduces physics/results.json
{
  const p = Object.assign({}, L3, { launch_airspeed_m_s: { value: 17.5 }, launch_height_m: { value: 1 } });
  const a = analyticBound(p);
  near(a.v_min_m_s, 9.854, 0.002, 'v_min reproduces physics/results.json (9.854 m/s) -- a CODE check, not a test against nature');
  const t = glideTrajectory(p);
  near(t.wing_loading_N_m2, 46.39, 0.02, 'wing loading reproduces physics/results.json (46.39 N/m2)');
  near((t.wing_loading_N_m2 * t.v_min_m_s * 0.012688) / 4.37, 1.327, 0.003, 'P_req = W v_min/(L/D)max reproduces physics/results.json (1.327 W)');
  ok(a.lean_bound_m > 0 && a.kinetic_m > 0, 'both analytic phases are non-zero at 17.5 m/s');
  near(a.lean_bound_m, 1 * 4.37, 1e-9, 'the Lean-covered part is exactly h (L/D)max');
  ok(a.total_m > a.lean_bound_m, 'the total exceeds the Lean-covered part whenever the kinetic phase is non-zero');
  // Ground effect: at a launch height of 0.05 m the drag factor is below 1, so the level phase is longer.
  const low = analyticBound(Object.assign({}, p, { launch_height_m: { value: 0.05 } }));
  ok(low.kinetic_m > a.kinetic_m, 'the measured ground effect lengthens the level phase near the surface');
  // A speed below v_min cannot glide at all, and every distance is zero (glide.mjs's rule).
  const slow = analyticBound(Object.assign({}, p, { launch_airspeed_m_s: { value: 5 } }));
  ok(slow.can_glide === false && slow.total_m === 0 && slow.lean_bound_m === 0, 'below v_min: cannot glide, every analytic distance 0');
}

// ---------------------------------------------------------------- 5. the integrated solver
{
  const p = Object.assign({}, L3, { launch_airspeed_m_s: { value: 17.5 }, launch_height_m: { value: 1 }, launch_path_angle_deg: { value: 10 }, headwind_m_s: { value: 0 } });
  const t = glideTrajectory(p);
  ok(t.range_m > 0 && Number.isFinite(t.range_m), `the integrated range is finite and positive (${t.range_m.toFixed(1)} m)`);
  ok(t.time_s > 0 && t.time_s < 30, `time aloft is finite (${t.time_s.toFixed(2)} s)`);
  ok(t.max_height_m >= 1, 'max height is at least the launch height');
  ok(t.can_glide === true, '17.5 m/s is above v_min, so the L3 fish can glide');
  ok(t.pts.length > 10, 'a trajectory is returned, not just the summary');
  ok(t.pts[0].x === 0 && Math.abs(t.pts[0].z - 1) < 1e-9, 'the trajectory starts at the launch point');
  ok(t.pts[t.pts.length - 1].z <= 0.001, 'the trajectory ends at the water surface');
  ok(t.pts.every(q => typeof q.x === 'number' && typeof q.z === 'number'), 'points are {x, z} objects, the form scene3d.js band renderer reads');
  // A faster launch must fly further, and a headwind must shorten the GROUND range.
  const fast = glideTrajectory(Object.assign({}, p, { launch_airspeed_m_s: { value: 20 } }));
  const slow = glideTrajectory(Object.assign({}, p, { launch_airspeed_m_s: { value: 15 } }));
  ok(fast.range_m > t.range_m && t.range_m > slow.range_m, 'range increases monotonically with launch airspeed');
  const head = glideTrajectory(Object.assign({}, p, { headwind_m_s: { value: 5 } }));
  const tail = glideTrajectory(Object.assign({}, p, { headwind_m_s: { value: -5 } }));
  ok(head.range_m < t.range_m && tail.range_m > t.range_m, 'a headwind shortens and a tailwind lengthens the ground range');
  // glide.mjs's analytic bound assumes level flight decelerating all the way to v_min, which cashes
  // in nearly all the excess launch kinetic energy as distance. The fixed-alpha trajectory does not:
  // it re-enters the water still travelling fast. So the bound must be an UPPER bound on it.
  const a = analyticBound(p);
  ok(t.range_m < a.total_m, `the integrated range (${t.range_m.toFixed(1)} m) is below glide.mjs's analytic bound (${a.total_m.toFixed(1)} m): the bound behaves as a bound`);
  ok(t.range_m > 0.5 * a.total_m, `the integrated range is not absurdly below the bound either (${(100 * t.range_m / a.total_m).toFixed(0)}% of it)`);
  const vEnd = (() => { const n = t.pts.length; return Math.hypot(t.pts[n - 1].x - t.pts[n - 2].x, t.pts[n - 1].z - t.pts[n - 2].z) / 0.05; })();
  ok(vEnd > 5, `the fish re-enters the water still moving fast (~${vEnd.toFixed(0)} m/s), which is why the residual energy never becomes distance`);
  // Missing inputs are refused, never defaulted.
  const bad = glideTrajectory({ mass_kg: { value: 0.06 } });
  ok(bad.range_m === null && typeof bad.reason === 'string', 'a missing reference area gives null and a reason, not a guess');
}

// ---------------------------------------------------------------- 6. perturbRun: labelling and the species gate
{
  const r = makeRng('perturb-check');
  const { params, draw, skipped } = perturbRun(L3, r);
  ok(params.mass_kg.value !== L3.mass_kg.value, 'the drawn mass differs from the base mass');
  ok(params.mass_kg.kind === 'assumed', 'a drawn value is relabelled kind "assumed"');
  ok(/DRAWN from the lognormal-cv distribution "mass_kg"/.test(params.mass_kg.source), 'the drawn value\'s source names the distribution it came from');
  ok(params.mass_kg.replaced === L3.mass_kg.source, 'the provenance it replaced is recorded, so a measured label cannot be silently lost');
  ok(L3.mass_kg.value === 0.06, 'perturbRun does not mutate the base parameters');
  // span must co-vary with area so the aspect ratio holds.
  const f = params.ref_area_m2.value / L3.ref_area_m2.value;
  near(params.span_m.value / L3.span_m.value, Math.sqrt(f), 1e-12, 'span is scaled by sqrt(area factor), holding the aspect ratio');
  ok(skipped.length === 0, 'nothing is skipped for a flying fish');
  ok(draw.launch_airspeed_m_s.value >= 15 && draw.launch_airspeed_m_s.value <= 20, 'the drawn launch airspeed lies inside the sourced band');
  ok(params.launch_height_m.value >= 0.05, 'the launch height is never below the surface floor');
  ok(typeof params.launch_height_m === 'object' && 'value' in params.launch_height_m, 'a field ABSENT from the base object is still written in the base object own {value, kind, source} shape');
  ok(typeof perturbRun({ mass_kg: 0.06, ref_area_m2: 0.012688, span_m: 0.261, species: 'Cypselurus hiraii' }, makeRng('flat')).params.launch_height_m === 'number', 'a FLAT numeric base object gets flat numbers back');
  // The species gate: a zebrafish gets NO launch-speed draw, and the reason is recorded.
  ok(isFlier(L3) === true && isFlier(ZF) === false, 'the flier gate matches glide.mjs: flying fish yes, Danio rerio no');
  const z = perturbRun(ZF, makeRng('zf'));
  ok(z.skipped.includes('launch_airspeed_m_s'), 'the zebrafish launch speed is NOT drawn from the flying-fish taxi band');
  ok(/no measured launch-speed spread/.test(z.draw.launch_airspeed_m_s.reason), 'the skip carries its reason');
  near(z.params.launch_airspeed_m_s.value, 0.617, 1e-9, 'the zebrafish keeps its own sourced launch speed unchanged');
  ok(/NOT DRAWN/.test(z.params.launch_airspeed_m_s.source), 'the kept value says it was not drawn');
  // Switching a distribution off by leaving it out of the list.
  const only = perturbRun(L3, makeRng('one'), { distributions: [byKey('mass_kg')] });
  ok(only.params.ref_area_m2.value === L3.ref_area_m2.value, 'a distribution left out of the list is not drawn at all');
}

// ---------------------------------------------------------------- 7. the ensemble: reproducibility
{
  const a = makeEnsemble({ draws: 60, seed: 'repro', baseParams: L3, keepTrajectories: false });
  const b = makeEnsemble({ draws: 60, seed: 'repro', baseParams: L3, keepTrajectories: false });
  const c = makeEnsemble({ draws: 60, seed: 'other', baseParams: L3, keepTrajectories: false });
  const R = e => e.runs.map(r => r.result.range_m);
  ok(R(a).every((v, i) => v === R(b)[i]), 'THE SAME SEED GIVES THE SAME ENSEMBLE, draw for draw');
  ok(R(a).some((v, i) => v !== R(c)[i]), 'a different seed gives a different ensemble');
  ok(a.stats.glide_range_m.median === b.stats.glide_range_m.median, 'the summary statistics are reproducible too');
  ok(a.seed === 'repro', 'the ensemble records its seed');
  ok(a.draws === 60 && a.runs.length === 60, 'the requested number of draws is run');
  ok(a.distributions.length === DISTRIBUTIONS.length && a.distributions.every(d => d.source && d.band_kind), 'the ensemble carries the provenance of every distribution');
  ok(a.note === UNCERTAINTY_NOTE, 'the ensemble carries the uncertainty note');
  ok(a.species_gate.is_flier === true, 'the ensemble records which species gate applied');
  ok(a.runs[0].result.pts == null, 'keepTrajectories false drops the point arrays');
  const k = makeEnsemble({ draws: 3, seed: 'repro', baseParams: L3 });
  ok(Array.isArray(k.runs[0].result.pts) && k.runs[0].result.pts.length > 5, 'by default each draw keeps its trajectory');
}

// ---------------------------------------------------------------- 8. the band covers the deterministic run
{
  const e = makeEnsemble({ draws: 400, seed: 'band', baseParams: L3, keepTrajectories: false });
  const d = e.deterministic;
  ok(d && d.range_m > 0, 'the deterministic unperturbed run is returned alongside the ensemble');
  near(d.launch_airspeed_m_s, 17.5, 1e-9, 'the deterministic run uses the base take-off target 17.5 m/s');
  for (const [k, v] of [['glide_range_m', d.range_m], ['time_aloft_s', d.time_s], ['max_height_m', d.max_height_m]]) {
    const s = e.stats[k];
    ok(v >= s.p5 && v <= s.p95, `the 5-95% band of ${k} covers the deterministic single run (${v.toFixed(3)} in [${s.p5.toFixed(3)}, ${s.p95.toFixed(3)}])`);
  }
  // The band is centred on the deterministic run because takeoff_speed_target_m_s (17.5) is the
  // midpoint of the sourced 15-20 m/s band. Check it really is near the middle, not at an edge.
  const s = e.stats.glide_range_m;
  ok(s.p5 < s.median && s.median < s.p95, 'the band is not degenerate');
  const frac = e.runs.filter(r => r.result.range_m < d.range_m).length / e.runs.length;
  ok(frac > 0.2 && frac < 0.8, `the deterministic run sits inside the body of the ensemble, not at an edge (${(frac * 100).toFixed(0)}% of draws below it)`);
  ok(e.stats.can_glide_fraction === 1, 'every draw of the adult flying fish can glide');
  ok(e.stats.launch_airspeed_m_s.min >= 15 && e.stats.launch_airspeed_m_s.max <= 20, 'every drawn launch airspeed stayed inside the sourced band');
  near(e.stats.launch_airspeed_m_s.median, 17.5, 0.35, 'the launch-airspeed median is the band midpoint');
}

// ---------------------------------------------------------------- 9. a zebrafish ensemble still never glides
{
  const e = makeEnsemble({ draws: 300, seed: 'zebrafish', baseParams: ZF, keepTrajectories: false });
  ok(e.species_gate.is_flier === false, 'the zebrafish ensemble records that the taxi band does not apply');
  ok(e.stats.can_glide_fraction === 0, 'NOT ONE draw of the winged zebrafish can glide');
  ok(e.runs.every(r => r.result.can_glide === false), 'every single draw is below v_min');
  ok(e.runs.every(r => r.result.launch_airspeed_m_s < r.result.v_min_m_s), 'the launch speed is below v_min in every draw');
  ok(e.stats.v_min_m_s.min > e.stats.launch_airspeed_m_s.max * 5, `v_min (min ${e.stats.v_min_m_s.min.toFixed(2)} m/s) is far above any drawn launch speed (max ${e.stats.launch_airspeed_m_s.max.toFixed(3)} m/s)`);
  ok(e.stats.glide_range_m.p95 < 2, `the whole 5-95% band of the zebrafish range is under 2 m (p95 ${e.stats.glide_range_m.p95.toFixed(3)} m): a drop, not a glide`);
  ok(e.stats.analytic_total_m.max === 0, "glide.mjs's analytic bound is 0 in every zebrafish draw, as ENVIRONMENT.md says it must be");
  ok(e.deterministic.can_glide === false, 'the deterministic zebrafish run cannot glide either');
  // And no amount of re-seeding helps: the result is structural, not a lucky seed.
  for (const s of ['a', 'b', 'c', 'd']) {
    const x = makeEnsemble({ draws: 50, seed: s, baseParams: ZF, keepTrajectories: false });
    ok(x.stats.can_glide_fraction === 0, `seed "${s}": the zebrafish still never glides`);
  }
}

// ---------------------------------------------------------------- 10. the seed in the URL state
{
  ok(seedFromUrl('') === 'delphi-v1', 'an absent seed falls back to the default');
  ok(seedFromUrl('?cseed=abc123') === 'abc123', 'the seed is read from the URL');
  ok(seedFromUrl('?foo=1&cseed=z') === 'z', 'the seed is read alongside other parameters');
  const u = seedToUrl('https://example.invalid/t/physics/sim/?x=1', 'my-seed');
  ok(/cseed=my-seed/.test(u) && /x=1/.test(u), 'the seed is written into the URL without losing other parameters');
  ok(seedFromUrl(new URL(u).search) === 'my-seed', 'the seed round-trips through the URL');
  const e1 = makeEnsemble({ draws: 20, seed: seedFromUrl('?cseed=shared'), baseParams: L3, keepTrajectories: false });
  const e2 = makeEnsemble({ draws: 20, seed: seedFromUrl(new URL(seedToUrl('https://example.invalid/', 'shared')).search), baseParams: L3, keepTrajectories: false });
  ok(e1.runs.every((r, i) => r.result.range_m === e2.runs[i].result.range_m), 'a seed carried through the URL reproduces the ensemble exactly');
}

// ---------------------------------------------------------------- 11. a host-supplied solver
{
  let seen = 0;
  const e = makeEnsemble({
    draws: 5, seed: 'host', baseParams: L3, keepTrajectories: false,
    run: () => { seen++; return { range_m: 42, time_s: 1, max_height_m: 2, can_glide: true }; },
  });
  ok(seen === 6, 'the host solver is called once per draw plus once for the deterministic run');
  ok(e.stats.glide_range_m.median === 42, 'the host solver\'s results are what get summarised');
  ok(/supplied by the host/.test(e.solver), 'the ensemble records that the solver was not its own');
}

// ---------------------------------------------------------------- report
const total = pass + fails.length;
if (SABOTAGE) {
  console.log(`SABOTAGE: ${fails.length} of ${total} assertions failed (every one must).`);
  if (pass > 0) { console.error(`BAD: ${pass} assertion(s) still passed under sabotage, so they are vacuous:\n  ` + 'see the inverted list'); process.exit(1); }
  console.log('OK: no assertion is vacuous.');
  process.exit(0);
}
console.log(`creatures-test: ${pass}/${total} checks passed.`);
if (fails.length) { console.error('\nFAILED:\n' + fails.map(f => '  - ' + f).join('\n')); process.exit(1); }

// A short printout of what the ensemble actually says, for the report.
const E = makeEnsemble({ draws: 1000, seed: 'delphi-v1', baseParams: L3, keepTrajectories: false });
const f3 = s => `median ${s.median.toFixed(2)}  5-95% [${s.p5.toFixed(2)}, ${s.p95.toFixed(2)}]  min ${s.min.toFixed(2)} max ${s.max.toFixed(2)}`;
console.log('\nAdult flying fish (Park & Choi L3), 1000 draws, seed delphi-v1:');
console.log('  glide range (m)        ', f3(E.stats.glide_range_m), ' | deterministic', E.deterministic.range_m.toFixed(2));
console.log('  time aloft (s)         ', f3(E.stats.time_aloft_s), ' | deterministic', E.deterministic.time_s.toFixed(2));
console.log('  max height (m)         ', f3(E.stats.max_height_m), ' | deterministic', E.deterministic.max_height_m.toFixed(2));
console.log('  launch airspeed (m/s)  ', f3(E.stats.launch_airspeed_m_s));
console.log('  v_min (m/s)            ', f3(E.stats.v_min_m_s));
console.log('  wing loading (N/m2)    ', f3(E.stats.wing_loading_N_m2));
console.log("  glide.mjs analytic bound: lean", f3(E.stats.analytic_lean_bound_m));
console.log('  glide.mjs analytic total ', f3(E.stats.analytic_total_m), ' | deterministic', E.deterministic.analytic.total_m.toFixed(2));
console.log('  can glide fraction      ', E.stats.can_glide_fraction);
const Z = makeEnsemble({ draws: 1000, seed: 'delphi-v1', baseParams: ZF, keepTrajectories: false });
console.log('\nWinged zebrafish (hypothetical), 1000 draws:');
console.log('  glide range (m)        ', f3(Z.stats.glide_range_m));
console.log('  v_min (m/s)            ', f3(Z.stats.v_min_m_s), ' vs launch', f3(Z.stats.launch_airspeed_m_s));
console.log('  can glide fraction      ', Z.stats.can_glide_fraction);
