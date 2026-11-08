#!/usr/bin/env node
// Tests for embryo-divisions.mjs
//
//   node sim-engine/scales/atlas/test-embryo-divisions.mjs [--fail-once]
//   DELPHI_IDR_DIR=<dir of GMEMfinalResult_frame*.xml>   to run the archive-backed checks
//
// Five things are checked harder than the rest.
//
//   1. THE DIVISION COUNT IS CHECKED AGAINST AN INDEPENDENT RECORD. micro/embryo.mjs - written in
//      another thread, from a separate parse of the same archive - published a per-frame division
//      histogram. This module's count must equal that histogram's sum, 1,634, exactly. Two independent
//      parsers agreeing on an integer is the strongest check available here, and it is free.
//
//   2. THE SUSPECT-FRAME RULE IS CHECKED AGAINST THE FRAMES THAT RECORD NAMES. The earlier record names
//      four frames as a tracker re-segmentation. The rule must flag exactly those four and no others.
//      The first version of the rule flagged none, which is why this assertion exists.
//
//   3. THE SIZE FLOOR IS ASSERTED AS THE REASON FOR THE VOLUME RATIO. It is not enough to record that
//      the median ratio is 2. The test asserts the MONOTONE PARTITION - that the ratio moves away from
//      2 as axes come free - because that is the evidence, and a module that merely stored the number
//      1.997 would pass a weaker test.
//
//   4. THE GEOMETRY IS CHECKED AGAINST CLOSED FORMS. det3 and eigSym3 have known values on constructed
//      matrices; sdRadius has an exact closed form for an isotropic precision; the lens volume has
//      known values at d = 0 and d = RA + RB. These are the only numbers here not produced by the code.
//
//   5. THE PARSER IS CHECKED ON A HAND-WRITTEN FRAME. A regex parser over 100 MB of XML is the single
//      most likely place for a silent wrong answer, so it is run on a four-element fixture whose every
//      field is known by hand, including a detection that must be REJECTED for a malformed mean.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL; an assertion that survives its own fault asserts nothing.
import { existsSync } from 'node:fs';
import * as E from './embryo-divisions.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ------------------------------------------------------------------ 5. the parser, on a known frame
console.log('\nthe parser, on a frame written by hand');
const FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<document>
<GaussianMixtureModel id="0" lineage="7" parent="0" dims="3" splitScore="3" scale="1 1 1 "
nu="4" beta="4" alpha="4" m="10 20 30 " W="0.25 0 0 0 0.25 0 0 0 0.25 "
nuPrior="4" betaPrior="0.2" alphaPrior="0" distMRFPrior="0" mPrior="10 20 30 " WPrior="0.25 0 0 0 0.25 0 0 0 0.25 " svIdx="1 ">
</GaussianMixtureModel>
<GaussianMixtureModel id="1" lineage="8" parent="0" dims="3" splitScore="3" scale="1 1 1 "
nu="2" beta="2" alpha="2" m="14 20 30 " W="0.5 0 0 0 0.5 0 0 0 0.125 "
nuPrior="4" betaPrior="0.2" alphaPrior="0" distMRFPrior="0" mPrior="14 20 30 " WPrior="0.125 0 0 0 0.125 0 0 0 0.125 " svIdx="2 ">
</GaussianMixtureModel>
<GaussianMixtureModel id="2" lineage="9" parent="5" dims="3" splitScore="3" scale="1 1 1 "
nu="4" beta="4" alpha="4" m="0 0 0 " W="1 0 0 0 1 0 0 0 1 "
nuPrior="4" betaPrior="0.2" alphaPrior="0" distMRFPrior="0" mPrior="0 0 0 " WPrior="1 0 0 0 1 0 0 0 1 " svIdx="3 ">
</GaussianMixtureModel>
<GaussianMixtureModel id="3" lineage="10" parent="0" dims="3" splitScore="3" scale="1 1 1 "
nu="4" beta="4" alpha="4" m="99 99 " W="0.25 0 0 0 0.25 0 0 0 0.25 "
nuPrior="4" betaPrior="0.2" alphaPrior="0" distMRFPrior="0" mPrior="99 99 " WPrior="0.25 0 0 0 0.25 0 0 0 0.25 " svIdx="4 ">
</GaussianMixtureModel>
</document>`;
{
  const ds = E.parseFrame(FIXTURE);
  check('a two-number mean is rejected, not padded: 4 elements in, 3 detections out',
    f(ds.length === 3, ds.length !== 3), `got ${ds.length}`);
  check('the mean is read in file order', f(ds[0].x === 10 && ds[0].y === 20 && ds[0].z === 30, ds[0].x !== 10));
  check('lineage and id are read as distinct fields', f(ds[0].id === 0 && ds[0].lineage === 7, ds[0].lineage === 0));
  check('parent is read, including an out-of-range one', f(ds[2].parent === 5, ds[2].parent === 0));
  check('W is read as nine numbers', f(ds[0].W.length === 9, ds[0].W.length !== 9));
  check('at_prior is true when nu*W equals nuPrior*WPrior', f(ds[0].at_prior === true, ds[0].at_prior !== true));
  check('at_prior is false when they differ', f(ds[1].at_prior === false, ds[1].at_prior !== false),
    `nu*W[0]=${2 * 0.5} vs nuPrior*WPrior[0]=${4 * 0.125}`);
  // detection 1: nu*W = diag(1,1,0.25); nuPrior*WPrior = diag(0.5,0.5,0.5). Differ -> false.
  // the broken value here must be FALSE, not true: `f(cond, true)` is a line that passes under its own
  // fault, which is exactly what --fail-once exists to catch. It caught this one.
  check('at_prior compares the OFF-diagonal terms too, not just the trace', f(
    E.atPrior(1, [1, 0.3, 0, 0.3, 1, 0, 0, 0, 1], 1, [1, 0, 0, 0, 1, 0, 0, 0, 1]) === false, false));
  check('at_prior returns null rather than a boolean when the prior is absent',
    f(E.atPrior(1, new Array(9).fill(1), NaN, null) === null, E.atPrior(1, new Array(9).fill(1), NaN, null) !== null));
}

// ------------------------------------------------------------------ 4. closed forms
console.log('\nthe linear algebra, against closed forms');
{
  check('det3 of the identity is 1', f(near(E.det3([1, 0, 0, 0, 1, 0, 0, 0, 1]), 1, 1e-12), false));
  check('det3 of diag(2,3,4) is 24', f(near(E.det3([2, 0, 0, 0, 3, 0, 0, 0, 4]), 24, 1e-12), false));
  check('det3 picks up off-diagonal terms', f(
    near(E.det3([1, 2, 3, 4, 5, 6, 7, 8, 10]), -3, 1e-9), near(E.det3([1, 2, 3, 4, 5, 6, 7, 8, 10]), 0, 1e-9)),
    `got ${E.det3([1, 2, 3, 4, 5, 6, 7, 8, 10])}`);
  const ev = E.eigSym3([2, 0, 0, 0, 3, 0, 0, 0, 4]);
  check('eigSym3 returns diagonal entries ascending for a diagonal matrix',
    f(near(ev[0], 2, 1e-9) && near(ev[1], 3, 1e-9) && near(ev[2], 4, 1e-9), near(ev[0], 4, 1e-9)));
  const ev2 = E.eigSym3([2, 1, 0, 1, 2, 0, 0, 0, 5]); // eigenvalues 1, 3, 5
  check('eigSym3 solves a non-diagonal symmetric matrix', f(
    near(ev2[0], 1, 1e-8) && near(ev2[1], 3, 1e-8) && near(ev2[2], 5, 1e-8),
    near(ev2[0], 2, 1e-8)), `got ${ev2.map(v => v.toFixed(6)).join(', ')}`);
  check('eigSym3 eigenvalues sum to the trace', f(
    near(E.eigSym3([4, 1, 2, 1, 5, 3, 2, 3, 6]).reduce((a, b) => a + b, 0), 15, 1e-8), false));

  // isotropic precision p on every axis: covariance = 1/p, sd = 1/sqrt(p), equivalent radius the same
  check('sdRadius of an isotropic precision is 1/sqrt(p)', f(
    near(E.sdRadius(1, [0.25, 0, 0, 0, 0.25, 0, 0, 0, 0.25]), 2, 1e-9),
    near(E.sdRadius(1, [0.25, 0, 0, 0, 0.25, 0, 0, 0, 0.25]), 4, 1e-9)));
  check('sdRadius scales with nu as nu^(-1/2)', f(
    near(E.sdRadius(4, [0.25, 0, 0, 0, 0.25, 0, 0, 0, 0.25]), 1, 1e-9), false));
  check('sdRadius equals the geometric mean of the axis sds', (() => {
    const nu = 3, W = [0.1, 0.02, 0, 0.02, 0.2, 0, 0, 0, 0.4];
    const axes = E.sdAxes(nu, W);
    const gm = Math.cbrt(axes[0] * axes[1] * axes[2]);
    return f(near(E.sdRadius(nu, W), gm, 1e-9), near(E.sdRadius(nu, W), axes[0], 1e-9));
  })());
  check('sdRadius returns null for a singular precision rather than Infinity',
    f(E.sdRadius(1, new Array(9).fill(0)) === null, E.sdRadius(1, new Array(9).fill(0)) !== null));
  check('sdAxes returns null for a non-positive-definite precision',
    f(E.sdAxes(1, [1, 0, 0, 0, -1, 0, 0, 0, 1]) === null, E.sdAxes(1, [1, 0, 0, 0, -1, 0, 0, 0, 1]) !== null));
}

// ------------------------------------------------------------------ division detection, on fixtures
console.log('\ndivision detection, on fixtures where the answer is known by hand');
{
  const det = (parent, x = 0) => ({ parent, x, y: 0, z: 0, nu: 1, W: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 0.25], at_prior: true });
  const prev = [det(0), det(0), det(0)];
  // frame t: indices 0,1 are children of prev[0]; index 2 is the only child of prev[1]; index 3 has an
  // out-of-range parent; indices 4,5,6 are three children of prev[2], which is NOT a division.
  const cur = [det(0), det(0), det(1), det(99), det(2), det(2), det(2)];
  const r = E.divisionsBetween(prev, cur, 5);
  check('exactly two children is a division', f(r.events.length === 1, r.events.length !== 1), `got ${r.events.length}`);
  check('the division names the right parent index', f(r.events[0].parent_index === 0, r.events[0].parent_index !== 0));
  check('a single child is not a division', f(!r.events.some(e => e.parent_index === 1), r.events.some(e => e.parent_index === 1)));
  check('three children is not a division and is counted separately',
    f(r.three_or_more_children === 1, r.three_or_more_children !== 1));
  check('an out-of-range parent is counted as invalid, not assigned to index 99',
    f(r.invalid_parents === 1, r.invalid_parents !== 1));
  check('a negative parent index is invalid', f(
    E.divisionsBetween(prev, [det(-1)], 1).invalid_parents === 1, E.divisionsBetween(prev, [det(-1)], 1).invalid_parents !== 1));
  check('the frame index is carried onto the event', f(r.events[0].frame === 5, r.events[0].frame !== 5));
}

// ------------------------------------------------------------------ division geometry
console.log('\ndivision geometry, against closed forms');
{
  const mk = (x, p) => ({ x, y: 0, z: 0, nu: 1, W: [p, 0, 0, 0, p, 0, 0, 0, p] });
  // sd radius 2 for p = 0.25. sigma 1.5 -> drawn radius 3.
  const P = mk(0, 0.25), A = mk(-10, 0.25), B = mk(10, 0.25);
  const g = E.divisionGeometry(P, A, B, 1.5);
  check('separation is the daughter-to-daughter distance', f(near(g.separation, 20, 1e-9), near(g.separation, 10, 1e-9)));
  check('the drawn radius is sigma times the sd radius', f(near(g.drawn_radius.a, 3, 1e-9), near(g.drawn_radius.a, 2, 1e-9)));
  check('well-separated daughters have no lens', f(g.volume.lens === 0, g.volume.lens !== 0));
  check('with equal radii and no overlap the volume ratio is exactly 2',
    f(near(g.volume_ratio_union, 2, 1e-12), near(g.volume_ratio_union, 1, 1e-12)), `got ${g.volume_ratio_union}`);
  check('equal daughters have zero size asymmetry', f(near(g.size_asymmetry, 0, 1e-12), !near(g.size_asymmetry, 0, 1e-12)));
  check('daughters_overlap is false when they are clear', f(g.daughters_overlap === false, g.daughters_overlap !== false));

  const g0 = E.divisionGeometry(P, mk(0, 0.25), mk(0, 0.25), 1.5);
  check('coincident daughters: the union is one sphere, so the ratio is 1',
    f(near(g0.volume_ratio_union, 1, 1e-9), near(g0.volume_ratio_union, 2, 1e-9)), `got ${g0.volume_ratio_union}`);
  check('coincident daughters: the lens is a whole sphere',
    f(near(g0.volume.lens, (4 / 3) * Math.PI * 27, 1e-9), false));
  const gT = E.divisionGeometry(P, mk(-3, 0.25), mk(3, 0.25), 1.5);
  check('daughters exactly touching have a zero lens and a ratio of 2',
    f(near(gT.volume.lens, 0, 1e-9) && near(gT.volume_ratio_union, 2, 1e-9), near(gT.volume_ratio_union, 1, 1e-9)));
  check('unequal daughters give a non-zero size asymmetry',
    f(E.divisionGeometry(P, mk(-10, 0.25), mk(10, 1.0), 1.5).size_asymmetry > 0.5, false));
  check('a singular daughter makes the whole geometry null rather than NaN',
    f(E.divisionGeometry(P, { x: 0, y: 0, z: 0, nu: 1, W: new Array(9).fill(0) }, B, 1.5) === null,
      E.divisionGeometry(P, { x: 0, y: 0, z: 0, nu: 1, W: new Array(9).fill(0) }, B, 1.5) !== null));
  check('the sigma argument scales volumes as sigma cubed, leaving the RATIO unchanged', (() => {
    const a = E.divisionGeometry(P, A, B, 1.0), b = E.divisionGeometry(P, A, B, 2.0);
    return f(near(b.volume.parent / a.volume.parent, 8, 1e-9) && near(a.volume_ratio_union, b.volume_ratio_union, 1e-9),
      near(b.volume.parent / a.volume.parent, 2, 1e-9));
  })());
}

// ------------------------------------------------------------------ track chaining
console.log('\ntrack chaining, with no length filter');
{
  const d = (parent, x) => ({ parent, x, y: 0, z: 0, nu: 1, W: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 0.25], at_prior: true });
  // three frames. frame 1 index 0 and 1 are both children of frame 0 index 0 -> the track must STOP at
  // the division rather than picking one daughter and calling it the same cell.
  const frames = [[d(0, 0)], [d(0, 1), d(0, -1)], [d(0, 2), d(1, -2)]];
  const tr = E.buildTracks(frames);
  check('a division terminates the parent track instead of choosing a daughter',
    f(tr[0].length === 1, tr[0].length !== 1), `got ${tr[0].length}`);
  check('every detection lands in exactly one track',
    f(tr.reduce((a, t) => a + t.length, 0) === 5, tr.reduce((a, t) => a + t.length, 0) !== 5));
  check('single-frame tracks are KEPT, which is the whole point of this export',
    f(tr.some(t => t.length === 1), !tr.some(t => t.length === 1)));
  const far = [[d(0, 0)], [d(0, 1000)]];
  check('a teleport cuts the track rather than deleting it',
    f(E.buildTracks(far).length === 2 && E.buildTracks(far)[0].length === 1, E.buildTracks(far).length === 1));
  const near2 = [[d(0, 0)], [d(0, 1)]];
  check('a step inside the teleport limit is chained', f(E.buildTracks(near2)[0].length === 2, E.buildTracks(near2)[0].length !== 2));
  check('the teleport limit is the documented 50 voxels', f(E.TELEPORT_MAX_VOXELS === 50, E.TELEPORT_MAX_VOXELS !== 50));
  check('track points carry a radius, so the viewer need not re-derive one',
    f(typeof tr[0].points[0].r === 'number', typeof tr[0].points[0].r !== 'number'));
}

// ------------------------------------------------------------------ the stored RESULT
console.log('\nthe stored result, and the partition that is its evidence');
{
  const R = E.RESULT;
  check('the verdict is UNTESTABLE, not REFUTED', f(R.verdict === 'UNTESTABLE', R.verdict === 'REFUTED'));
  check('the naive answer is recorded rather than quietly dropped',
    f(Math.abs(R.naive_answer - 2) < 0.01, Math.abs(R.naive_answer - 2) > 0.01));
  check('the partition covers all four axis counts', f(R.partition.length === 4, R.partition.length !== 4));
  check('the partition is MONOTONE: the ratio falls as axes come free', f(
    R.partition.every((p, i, a) => i === 0 || p.median_ratio < a[i - 1].median_ratio),
    R.partition.every((p, i, a) => i === 0 || p.median_ratio > a[i - 1].median_ratio)),
    R.partition.map(p => p.median_ratio.toFixed(3)).join(' > '));
  check('the zero-free-axis group sits on 2 to five decimals, which is the floor signature', f(
    Math.abs(R.partition[0].median_ratio - 2) < 1e-5, Math.abs(R.partition[0].median_ratio - 2) > 1e-5),
    `${R.partition[0].median_ratio}`);
  check('the parent radius RISES across the partition, confirming the groups differ by size and not by luck', f(
    R.partition.every((p, i, a) => i === 0 || p.median_parent_sd > a[i - 1].median_parent_sd), false));
  check('the free-axis group is small enough to say so: under 30 events',
    f(R.partition[3].events < 30, R.partition[3].events >= 30), `${R.partition[3].events}`);
  check('the partition events sum to the usable event count 1360', f(
    R.partition.reduce((a, p) => a + p.events, 0) === 1360,
    R.partition.reduce((a, p) => a + p.events, 0) !== 1360),
    `${R.partition.reduce((a, p) => a + p.events, 0)}`);
  check('what is delivered instead is named, so the untestable verdict is not the whole answer',
    f(/position/i.test(R.what_is_delivered_instead), !/position/i.test(R.what_is_delivered_instead)));
  check('the separation median is inside its own IQR', f(
    R.separation_median_voxels > R.separation_iqr_voxels[0] && R.separation_median_voxels < R.separation_iqr_voxels[1],
    R.separation_median_voxels < R.separation_iqr_voxels[0]));
}

// ------------------------------------------------------------------ provenance and refusals
console.log('\nwhat the module refuses to claim');
{
  check('no micron scale is asserted', f(E.SCALE.physical_pixel_size === null, E.SCALE.physical_pixel_size !== null));
  check('the voxel-to-micron temptation is recorded and not applied',
    f(/not a calibration/.test(E.SCALE.a_temptation_not_taken), !/not a calibration/.test(E.SCALE.a_temptation_not_taken)));
  check('the sigma used for drawing is a named constant, not a literal in the geometry',
    f(E.SIGMA_FOR_DRAWING === 1.5, E.SIGMA_FOR_DRAWING !== 1.5));
  check('the archive digest is recorded so the next re-download is checkable',
    f(/^[0-9a-f]{64}$/.test(E.SOURCE.sha256), !/^[0-9a-f]{64}$/.test(E.SOURCE.sha256)));
  check('the licence permits redistribution of the derived artefact',
    f(E.SOURCE.licence === 'CC BY 4.0' && E.SOURCE.redistributable === true, E.SOURCE.redistributable !== true));
  check('the tracker is cited separately from the study, because the numbers are the tracker\'s',
    f(/Amat/.test(E.SOURCE.tracker_citation), !/Amat/.test(E.SOURCE.tracker_citation)));
  check('the not-modelled list names the nucleus-versus-cell problem',
    f(E.WHAT_THIS_DOES_NOT_MODEL.some(s => /nuclei/i.test(s) && /membrane|boundary/i.test(s)), false));
  check('the not-modelled list names the unsampled 150 s in which the division happens',
    f(E.WHAT_THIS_DOES_NOT_MODEL.some(s => /150 s/.test(s)), false));
  check('the not-modelled list refuses to label which daughter is which',
    f(E.WHAT_THIS_DOES_NOT_MODEL.some(s => /file order/.test(s)), false));
}

// ------------------------------------------------------------------ 1,2,3. the archive, if present
const DIR = process.env.DELPHI_IDR_DIR || 'D:/Users/ashenoy00000/delphi-work/idr0068/x';
if (existsSync(DIR)) {
  console.log(`\nthe archive itself (${DIR})`);
  const frames = E.readArchive(DIR);
  const floor = E.measureFloor(frames);
  const detections = frames.reduce((a, fr) => a + fr.length, 0);

  check('420 frames are read', f(frames.length === 420, frames.length !== 420), `${frames.length}`);
  check('222,071 detections, matching the independent earlier parse exactly',
    f(detections === 222071, detections !== 222071), `${detections}`);

  // 1. the independent histogram, from micro/embryo.mjs - a different thread's separate parse
  const INDEPENDENT_HISTOGRAM = { 0: 73, 1: 82, 2: 60, 3: 50, 4: 32, 5: 23, 6: 25, 7: 20, 8: 15, 9: 12, 10: 13, 11: 7, 12: 1, 14: 2, 61: 1, 64: 1, 65: 1, 84: 1 };
  const independentTotal = Object.entries(INDEPENDENT_HISTOGRAM).reduce((a, [k, n]) => a + Number(k) * n, 0);
  const independentFrames = Object.values(INDEPENDENT_HISTOGRAM).reduce((a, b) => a + b, 0);
  let total = 0, threePlus = 0;
  const perFrame = [];
  for (let t = 1; t < frames.length; t++) {
    const r = E.divisionsBetween(frames[t - 1], frames[t], t);
    total += r.events.length; threePlus += r.three_or_more_children;
    perFrame.push({ frame: t, n: r.events.length, pop: frames[t].length });
  }
  check(`the division count equals the independent record's histogram sum (${independentTotal})`,
    f(total === independentTotal, total !== independentTotal), `${total}`);
  check(`the histogram covers 419 frame transitions (${independentFrames})`,
    f(independentFrames === 419, independentFrames !== 419));
  check('a parent with three or more children never occurs, as the earlier record states',
    f(threePlus === 0, threePlus !== 0), `${threePlus}`);

  // reproduce the histogram shape, not just its sum
  const mine = {};
  for (const p of perFrame) mine[p.n] = (mine[p.n] ?? 0) + 1;
  const sameShape = Object.keys(INDEPENDENT_HISTOGRAM).every(k => mine[k] === INDEPENDENT_HISTOGRAM[k])
    && Object.keys(mine).length === Object.keys(INDEPENDENT_HISTOGRAM).length;
  check('the per-frame histogram matches bin for bin, not merely in total',
    f(sameShape, !sameShape),
    sameShape ? '' : `mine has ${Object.keys(mine).length} bins vs ${Object.keys(INDEPENDENT_HISTOGRAM).length}`);

  // 2. the suspect rule must name the four frames the record names
  const rates = perFrame.map(p => p.n / Math.max(1, p.pop));
  const med = rates.slice().sort((a, b) => a - b)[Math.floor(rates.length / 2)];
  const flagged = perFrame.filter((p, i) => rates[i] > 10 * med).map(p => p.frame);
  check('the suspect rule flags exactly the four burst frames 416-419',
    f(flagged.join(',') === '416,417,418,419', flagged.join(',') !== '416,417,418,419'), `[${flagged.join(',')}]`);
  check('the four flagged frames are the ones carrying 61, 64, 65 and 84 divisions', (() => {
    const counts = flagged.map(fr => perFrame.find(p => p.frame === fr).n).sort((a, b) => a - b);
    return f(counts.join(',') === '61,64,65,84', counts.join(',') !== '61,64,65,84');
  })());
  check('the 15 % rule this replaced would have flagged NOTHING, which is why it was replaced',
    f(perFrame.every(p => p.n / p.pop <= 0.15), !perFrame.every(p => p.n / p.pop <= 0.15)),
    `max share ${Math.max(...perFrame.map(p => p.n / p.pop)).toFixed(4)}`);

  // 3. the floor, and the share at prior
  check('the measured precision cap is 0.2222, so the sd floor is 2.1214 voxels',
    f(near(floor.precision_cap, 0.2222015, 1e-6) && near(floor.sd_voxels, 2.1214191, 1e-6),
      near(floor.precision_cap, 1, 1e-6)), `cap ${floor.precision_cap}, sd ${floor.sd_voxels}`);
  let priorTrue = 0;
  for (const fr of frames) for (const d of fr) if (d.at_prior === true) priorTrue++;
  check('posterior equals prior for over 99.99 % of detections',
    f(priorTrue / detections > 0.9999, priorTrue / detections < 0.9999), `${(priorTrue / detections * 100).toFixed(4)}%`);
  check('it is not ALL of them: the exceptions are counted, not rounded away',
    f(priorTrue < detections, priorTrue >= detections), `${detections - priorTrue} exceptions`);
  // the fault must INVERT the predicate. The first attempt tightened the threshold instead, and
  // because almost every axis sits strictly above the floor the tightened version was also true, so
  // the line survived its own fault. A fault is a sign flip, never a tighter bound.
  check('no detection has an axis sd below the floor',
    f(frames[200].every(d => (E.sdAxes(d.nu, d.W) ?? [Infinity])[0] >= floor.sd_voxels - 1e-9),
      frames[200].some(d => (E.sdAxes(d.nu, d.W) ?? [Infinity])[0] < floor.sd_voxels - 1e-9)));
  check('and the floor is actually BINDING: some axes sit on it rather than merely above it',
    f(frames[200].some(d => near((E.sdAxes(d.nu, d.W) ?? [0])[0], floor.sd_voxels, 1e-6)),
      frames[200].every(d => !near((E.sdAxes(d.nu, d.W) ?? [0])[0], floor.sd_voxels, 1e-6))));
  check('sizes are nonetheless not one constant: most detections have a distinct radius',
    (() => {
      const rs = frames[200].map(d => E.sdRadius(d.nu, d.W)).filter(r => r !== null);
      const u = new Set(rs.map(r => r.toFixed(6))).size;
      return f(u / rs.length > 0.5, u / rs.length < 0.5);
    })());
  check('axesOffFloor returns 0 for a detection pinned on all three axes',
    f(E.axesOffFloor(1, [floor.precision_cap, 0, 0, 0, floor.precision_cap, 0, 0, 0, floor.precision_cap]) === 0,
      E.axesOffFloor(1, [floor.precision_cap, 0, 0, 0, floor.precision_cap, 0, 0, 0, floor.precision_cap]) !== 0));
  check('axesOffFloor returns 3 when every axis is well clear of the floor',
    f(E.axesOffFloor(1, [0.01, 0, 0, 0, 0.02, 0, 0, 0, 0.03]) === 3, E.axesOffFloor(1, [0.01, 0, 0, 0, 0.02, 0, 0, 0, 0.03]) !== 3));

  // the calibration that justifies sigma = 1.5
  const cal = E.calibrate(frames);
  check('the sigma at which the median pair touches is measured, and exceeds the sigma used for drawing',
    f(cal.sigma_at_which_median_pair_touches > E.SIGMA_FOR_DRAWING,
      cal.sigma_at_which_median_pair_touches < E.SIGMA_FOR_DRAWING),
    `${cal.sigma_at_which_median_pair_touches.toFixed(3)} vs ${E.SIGMA_FOR_DRAWING}`);
} else {
  console.log(`\n(archive checks skipped: ${DIR} not present. Set DELPHI_IDR_DIR.)`);
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  [--fail-once: every line above must FAIL]' : ''}`);
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
