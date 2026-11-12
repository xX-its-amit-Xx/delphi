// MEASURED CLEAVAGE: re-exporting idr0068 without the filter that threw the divisions away.
//
// ============================== WHY THIS FILE EXISTS ==============================
// The first export of this dataset (sim-engine/scales/micro/embryo.mjs, another thread's file, read
// only) kept tracks of >= 50 frames. That filter is defensible for an identity-asserting animation -
// 142 of 62,300 tracks survive it - but it is catastrophic for DIVISIONS, because a division is
// precisely the moment one track ENDS and two begin. Requiring 50 frames on all three of parent,
// daughter A and daughter B leaves almost nothing: the atlas viewer could draw 4 cleavage events out
// of the hundreds the file contains.
//
// This module re-reads the same archive with no length filter and exports the division events
// themselves, which is the artefact the viewer actually needs. A division needs three detections in
// two consecutive frames, not three tracks of 50.
//
// ============================== WHAT THE SOURCE ACTUALLY CONTAINS ==============================
// Each frame is a GMEM (Gaussian Mixture Expectation Maximisation; Amat et al. 2014) result: one
// <GaussianMixtureModel> element per detected nucleus, carrying
//
//   m      the mean, i.e. the nucleus centre, in VOXEL INDICES
//   W      the Wishart scale matrix, 9 numbers, symmetric
//   nu     the Wishart degrees of freedom
//   parent an index into the PREVIOUS frame's element list, or a self/invalid reference
//
// The size of a nucleus is therefore not stored as a radius. It is implied by the Gaussian's
// covariance, and the covariance is the inverse of the expected precision E[P] = nu * W. So
//
//   covariance  = (nu * W)^-1
//   axis sds    = sqrt(eigenvalues of the covariance)
//   equivalent-sphere sd radius = (a*b*c)^(1/3) = det(cov)^(1/6) = det(nu*W)^(-1/6)
//
// The last identity matters: the equivalent radius needs only a 3x3 determinant, so it is computed
// exactly for all 222,071 detections without an eigensolver. Eigenvalues are computed too, but only
// for anisotropy reporting.
//
// ============================== THE SIGMA PROBLEM, STATED NOT HIDDEN ==============================
// A Gaussian has no boundary. Turning one into a drawn sphere needs a multiple of sd, and NOTHING in
// the deposited data says which multiple the depositors would endorse. So this module exports the sd
// and refuses to bake a radius: SIGMA_FOR_DRAWING is a stated, separable depiction choice, and every
// derived volume in here is a function of it. Change it and every number moves together.
//
// ============================== AND THE SCALE PROBLEM ==============================
// IDR records this study's physical pixel size as null. Every length here is in VOXELS. The temptation
// to divide the embryo's 1088-voxel span by a textbook 700 um zebrafish embryo is recorded in
// SCALE.a_temptation_not_taken and not acted on, because that would turn a guess about the specimen
// into a unit on every number downstream.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCE = Object.freeze({
  study: 'idr0068-shah-zebrafishlightsheet',
  layer: 'endoderm',
  url: 'https://ftp.ebi.ac.uk/pub/databases/IDR/idr0068-shah-zebrafishlightsheet/20211129-ftp/endoderm.zip',
  bytes: 96312189,
  sha256: '93b50ce8a8a0173e323fa727c98e0e58f03fd6666a7b2ea9266ed8feb80d5eeb',
  sha256_note:
    'computed on the file downloaded 2026-11-08. The earlier export recorded only the byte count; the ' +
    'byte count matched exactly, which is why re-downloading was safe. The digest is recorded here so ' +
    'the next re-download is checkable without a byte-count coincidence.',
  licence: 'CC BY 4.0',
  redistributable: true,
  citation: 'Shah et al. 2019, Nat Commun 10:5753, doi 10.1038/s41467-019-13625-0, PMID 31848345',
  data_doi: '10.17867/10000172',
  tracker_citation: 'Amat et al. 2014, Nat Methods 11:951, doi 10.1038/nmeth.3036 - the GMEM/TGMM tracker whose output this is',
  retrieved: '2026-11-08',
  frames: 420,
  frame_interval_s: 150,
});

export const SCALE = Object.freeze({
  units: 'voxel indices',
  physical_pixel_size: null,
  why_null: 'IDR records this study\'s physical pixel size as null. No micron scale is asserted anywhere in this module.',
  a_temptation_not_taken:
    'the detection cloud spans about 1088 voxels, and a zebrafish embryo at these stages is often quoted ' +
    'near 700 um, which would give about 0.64 um per voxel. That is an inference from a textbook figure ' +
    'about a different specimen, not a calibration of this recording, so it is written here and used nowhere.',
});

/** The one depiction choice in this file, isolated so it can be changed in one place.
 *
 *  A Gaussian nucleus is drawn as a sphere of radius SIGMA_FOR_DRAWING * sd_equivalent. 1.5 is chosen
 *  because it is the multiple at which the measured nuclei in this dataset stop overlapping their
 *  nearest neighbours more often than not - a property this module MEASURES (see `calibrate`) rather
 *  than assumes. It is still a choice; it is not a measurement of a nuclear envelope. */
export const SIGMA_FOR_DRAWING = 1.5;

// ---------------------------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------------------------

const NUMS = (s) => s.trim().split(/\s+/).map(Number);

/** ============================== THE SIZE THAT IS NOT A FREE MEASUREMENT ==============================
 *  The first run of this module reported a median daughter/parent volume ratio of 1.95 and a parent
 *  radius distribution whose minimum and lower quartile were the SAME number to seven digits:
 *  2.1214196 and 2.1214329 voxels. A quartile that equals the minimum is not a distribution, it is a
 *  floor, and a floor in a fitted quantity means the fit did not move.
 *
 *  Chasing it produced two separate facts, and only the second one matters.
 *
 *  FACT ONE, which turned out to be universal and therefore useless as a filter. Every GMEM element
 *  carries both a posterior (nu, W) and a prior (nuPrior, WPrior), and the posterior precision nu*W
 *  equals the prior precision nuPrior*WPrior for 100 % of detections, to the six significant figures
 *  the tracker wrote. Not most. All 2,713 in the diagnostic sample, and so every one of the 1,634
 *  division events. A flag that selects everything selects nothing, so atPrior() is kept as a
 *  MEASUREMENT reported in the summary and not used to subset anything.
 *
 *  FACT TWO, which is the one with teeth. The precision is REGULARISED: no axis is ever allowed a
 *  precision above about 0.2222, which is a FLOOR on the per-axis standard deviation of
 *  1/sqrt(0.2222) = 2.1214 voxels. The prior still varies per detection - 1,967 distinct equivalent
 *  radii in 2,713 detections, and anisotropic shapes with real off-diagonal terms - so the sizes are
 *  not one constant. But most nuclei sit ON that floor in two of their three axes, and a parent and
 *  two daughters all sitting on the same floor give a daughter/parent volume ratio of exactly 2.
 *
 *  The measured median is 1.997. That is the floor's signature, not a biological result, and
 *  `volume_ratio_by_axes_off_floor` in the output is the partition that demonstrates it. */
export function atPrior(nu, W, nuPrior, WPrior) {
  if (!Number.isFinite(nuPrior) || !Array.isArray(WPrior) || WPrior.length !== 9) return null;
  for (let i = 0; i < 9; i++) {
    const a = nu * W[i], b = nuPrior * WPrior[i];
    const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
    if (Math.abs(a - b) / scale > 1e-4) return false;
  }
  return true;
}

/** Parse one GMEM frame. Returns detections in FILE ORDER, because `parent` indexes that order. */
export function parseFrame(text) {
  const out = [];
  // One element per nucleus. Attributes are plain and unescaped in this corpus, so a scoped regex is
  // both correct and about 40x faster than a DOM parse over 100 MB.
  const re = /<GaussianMixtureModel\s([\s\S]*?)>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const attrs = m[1];
    const get = (k) => {
      const mm = new RegExp(`\\b${k}="([^"]*)"`).exec(attrs);
      return mm ? mm[1] : null;
    };
    const mean = NUMS(get('m') ?? '');
    const W = NUMS(get('W') ?? '');
    if (mean.length !== 3 || W.length !== 9) continue;
    const WPrior = NUMS(get('WPrior') ?? '');
    const nuPrior = Number(get('nuPrior'));
    const d = {
      id: Number(get('id')),
      lineage: Number(get('lineage')),
      parent: Number(get('parent')),
      x: mean[0], y: mean[1], z: mean[2],
      nu: Number(get('nu')),
      W,
    };
    d.at_prior = atPrior(d.nu, W, nuPrior, WPrior);
    out.push(d);
  }
  return out;
}

/** det of a row-major 3x3. */
export function det3(a) {
  return a[0] * (a[4] * a[8] - a[5] * a[7])
       - a[1] * (a[3] * a[8] - a[5] * a[6])
       + a[2] * (a[3] * a[7] - a[4] * a[6]);
}

/** Eigenvalues of a SYMMETRIC row-major 3x3, by the closed-form trigonometric method.
 *  Returned ascending. Used for anisotropy only; the radius uses det3 directly. */
export function eigSym3(a) {
  const p1 = a[1] * a[1] + a[2] * a[2] + a[5] * a[5];
  const tr = a[0] + a[4] + a[8];
  if (p1 === 0) return [a[0], a[4], a[8]].sort((u, v) => u - v);
  const q = tr / 3;
  const p2 = (a[0] - q) ** 2 + (a[4] - q) ** 2 + (a[8] - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const B = a.map((v, i) => (v - (i % 4 === 0 ? q : 0)) / p);
  let r = det3(B) / 2;
  r = Math.max(-1, Math.min(1, r));
  const phi = Math.acos(r) / 3;
  const e1 = q + 2 * p * Math.cos(phi);
  const e3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  const e2 = tr - e1 - e3;
  return [e3, e2, e1];
}

/** The equivalent-sphere standard deviation of a GMEM detection, in voxels.
 *  covariance = (nu*W)^-1, so (abc)^(1/3) = det(cov)^(1/6) = det(nu*W)^(-1/6). */
export function sdRadius(nu, W) {
  const d = det3(W.map((v) => v * nu));
  if (!(d > 0) || !Number.isFinite(d)) return null;
  return Math.pow(d, -1 / 6);
}

/** The regularisation floor, measured from the data rather than assumed.
 *  `measureFloor` scans detections for the largest per-axis precision any of them is allowed, and the
 *  sd floor is 1/sqrt of it. On idr0068 this comes to 0.2222 and 2.1214 voxels. */
export const FLOOR = { precision_cap: null, sd_voxels: null, measured_over: 0 };

export function measureFloor(frames, { stride = 20 } = {}) {
  let cap = 0, n = 0;
  for (let t = 0; t < frames.length; t += stride) {
    for (const d of frames[t]) {
      const ev = eigSym3(d.W.map((v) => v * d.nu));
      if (ev[2] > cap) cap = ev[2];
      n++;
    }
  }
  FLOOR.precision_cap = cap;
  FLOOR.sd_voxels = 1 / Math.sqrt(cap);
  FLOOR.measured_over = n;
  return { ...FLOOR };
}

/** How many of a detection's three axes are strictly above the floor. 0 means the shape carries no
 *  size information at all beyond the regulariser; 3 means all three axes were free to move. */
export function axesOffFloor(nu, W, { rel = 1e-3 } = {}) {
  if (FLOOR.sd_voxels === null) return null;
  const sds = sdAxes(nu, W);
  if (!sds) return null;
  return sds.filter((s) => s > FLOOR.sd_voxels * (1 + rel)).length;
}

/** Axis standard deviations, ascending, in voxels. */
export function sdAxes(nu, W) {
  const ev = eigSym3(W.map((v) => v * nu)); // precision eigenvalues, ascending
  if (ev.some((e) => !(e > 0))) return null;
  return ev.map((e) => 1 / Math.sqrt(e)).sort((a, b) => a - b); // cov sds ascending
}

// ---------------------------------------------------------------------------------------------
// divisions
// ---------------------------------------------------------------------------------------------

export const PARENT_RULE = Object.freeze({
  rule: 'detection d in frame t has parent index p = d.parent into frame t-1\'s file-order list. A division is a p with exactly two children in frame t.',
  invalid_parent:
    'a parent index is unusable if it is negative, out of range for frame t-1, or (in frame 0) self-referential. ' +
    'The earlier export measured 26.6 % of detections with unusable parent refs; this module recomputes it.',
});

/** Build division events from consecutive frames. Pure, so it is testable without the archive. */
export function divisionsBetween(prev, cur, frameIndex) {
  const kids = new Map();
  let invalid = 0;
  for (let i = 0; i < cur.length; i++) {
    const p = cur[i].parent;
    if (!Number.isInteger(p) || p < 0 || p >= prev.length) { invalid++; continue; }
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(i);
  }
  const events = [];
  let three_or_more = 0;
  for (const [p, cs] of kids) {
    if (cs.length === 2) events.push({ frame: frameIndex, parent_index: p, child_indices: cs });
    else if (cs.length > 2) three_or_more++;
  }
  return { events, invalid_parents: invalid, three_or_more_children: three_or_more };
}

/** Geometry of one division, from the three detections. All lengths in voxels. */
export function divisionGeometry(parent, a, b, sigma = SIGMA_FOR_DRAWING) {
  const rP = sdRadius(parent.nu, parent.W);
  const rA = sdRadius(a.nu, a.W);
  const rB = sdRadius(b.nu, b.W);
  if (rP === null || rA === null || rB === null) return null;
  const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const vol = (r) => (4 / 3) * Math.PI * (sigma * r) ** 3;
  const vP = vol(rP), vA = vol(rA), vB = vol(rB);
  // overlap of the two drawn daughter spheres: the lens volume, zero when they are clear of each other
  const RA = sigma * rA, RB = sigma * rB;
  let lens = 0;
  if (d < RA + RB) {
    if (d <= Math.abs(RA - RB)) lens = (4 / 3) * Math.PI * Math.min(RA, RB) ** 3;
    else {
      lens = (Math.PI / (12 * d)) * (RA + RB - d) ** 2
           * (d * d + 2 * d * (RA + RB) - 3 * (RA - RB) ** 2);
    }
  }
  return {
    separation: d,
    sd_radius: { parent: rP, a: rA, b: rB },
    drawn_radius: { parent: sigma * rP, a: RA, b: RB },
    volume: { parent: vP, a: vA, b: vB, daughters_sum: vA + vB, daughters_union: vA + vB - lens, lens },
    volume_ratio_sum: (vA + vB) / vP,
    volume_ratio_union: (vA + vB - lens) / vP,
    separation_over_parent_drawn_radius: d / (sigma * rP),
    size_asymmetry: Math.abs(vA - vB) / (vA + vB),
    daughters_overlap: lens > 0,
  };
}

export const WHAT_THIS_TESTS = Object.freeze({
  claim: 'sim-engine/scales/micro/division.mjs animates cleavage as division WITHOUT growth: the union of the two daughters equals the parent volume at every instant, so separation is the only free parameter and the radius is solved from it.',
  how_this_file_tests_it: 'volume_ratio_union over every measured division event. If division without growth holds for these nuclei, the distribution sits at 1.',
  why_it_is_a_real_test: 'the constraint was written and committed before any measured division geometry existed in this project. Its prediction is a number, and these events supply that number.',
  what_a_failure_would_mean:
    'these are NUCLEI, not cells, and a nucleus reassembles after mitosis rather than being cleaved. A ratio ' +
    'far from 1 refutes "nuclear volume is conserved through division", which is a claim worth refuting, ' +
    'but it does not by itself refute volume conservation for the CELL - no cell boundary was imaged here.',
});

/** THE ANSWER, AND WHY IT IS NOT THE ANSWER THE TEST WAS LOOKING FOR.
 *
 *  Over all 1,360 usable events the median daughter-union / parent volume ratio is 1.997. Taken at face
 *  value that is a flat refutation of division without growth, by a factor of two, with n in the
 *  thousands. It is also wrong, and the data says so when you ask it one more question.
 *
 *  Partition the events by k = the minimum, over parent and both daughters, of how many principal axes
 *  are strictly above the regularisation floor:
 *
 *      k   events   median volume ratio   median parent sd radius (voxels)
 *      0      748          1.999998                 2.12143
 *      1      521          1.8028                   2.5451
 *      2       66          1.6482                   3.1862
 *      3       25          1.6014                   3.9770
 *
 *  At k = 0 the ratio is 2 to six decimal places, because three spheres all pinned to the same floor
 *  radius give exactly 2 and nothing else. The ratio then walks monotonically away from 2 as the axes
 *  come free. A quantity that converges on its arithmetic artefact precisely where the measurement is
 *  least free is not measuring the specimen.
 *
 *  So the verdict is UNTESTABLE, not REFUTED - and the untestability is demonstrated rather than
 *  asserted. The k = 3 subset would be the honest test, and it has 25 events whose parent radii are
 *  nearly twice the floor, i.e. it is a sample selected for being big. 25 size-biased events do not
 *  settle a volume law.
 *
 *  What this export DOES deliver is the other half: 1,360 measured parent-and-two-daughter
 *  configurations with measured positions. Position is not floored. Separation is a difference of two
 *  means, and the means are free. */
export const RESULT = Object.freeze({
  verdict: 'UNTESTABLE',
  quantity: 'daughter-union / parent volume ratio at the moment of division',
  naive_answer: 1.997445769371841,
  naive_answer_n: 1360,
  why_not_reported_as_refuted:
    'the ratio is 1.999998 in the 748 events where no axis is free, and falls monotonically to 1.601 as ' +
    'axes come free. The number tracks the regulariser, not the nucleus.',
  partition: Object.freeze([
    { axes_off_floor: 0, events: 748, median_ratio: 1.999998344993427, median_parent_sd: 2.121430357267132 },
    { axes_off_floor: 1, events: 521, median_ratio: 1.802839740422426, median_parent_sd: 2.5451257101901463 },
    { axes_off_floor: 2, events: 66, median_ratio: 1.648206958896864, median_parent_sd: 3.1862182134992434 },
    { axes_off_floor: 3, events: 25, median_ratio: 1.6013767365525242, median_parent_sd: 3.977013624949043 },
  ]),
  what_would_settle_it: 'a segmentation that reports a nuclear boundary rather than a regularised Gaussian, or the same tracker run with the precision cap lifted. Neither is in the deposit.',
  what_is_delivered_instead: '1,360 measured parent-and-two-daughter position triples. Positions are means and are not floored; separations are differences of means. Those are usable and are what the viewer draws.',
  separation_median_voxels: 15.700596517330139,
  separation_iqr_voxels: [12.007523058483002, 21.565445648073208],
});

// ---------------------------------------------------------------------------------------------
// tracks, with no length filter
// ---------------------------------------------------------------------------------------------

export const TELEPORT_MAX_VOXELS = 50;

/** Chain detections into tracks across all frames. No minimum length.
 *  A step longer than TELEPORT_MAX_VOXELS cuts the track rather than deleting it, so short honest
 *  fragments survive where the earlier export dropped the whole track. */
export function buildTracks(frames) {
  const trackOf = frames.map((f) => new Array(f.length).fill(-1));
  const tracks = [];
  for (let t = 0; t < frames.length; t++) {
    for (let i = 0; i < frames[t].length; i++) {
      if (trackOf[t][i] !== -1) continue;
      const tid = tracks.length;
      const pts = [];
      let ft = t, fi = i;
      while (ft < frames.length && trackOf[ft][fi] === -1) {
        trackOf[ft][fi] = tid;
        const d = frames[ft][fi];
        pts.push({ frame: ft, x: d.x, y: d.y, z: d.z, r: sdRadius(d.nu, d.W) });
        // find the unique child in ft+1 whose parent is fi, and only if it is unique
        if (ft + 1 >= frames.length) break;
        const next = frames[ft + 1];
        let child = -1, n = 0;
        for (let j = 0; j < next.length; j++) if (next[j].parent === fi) { child = j; n++; }
        if (n !== 1) break;
        const step = Math.hypot(next[child].x - d.x, next[child].y - d.y, next[child].z - d.z);
        if (step > TELEPORT_MAX_VOXELS) break;
        ft = ft + 1; fi = child;
      }
      tracks.push({ id: tid, start: t, length: pts.length, points: pts });
    }
  }
  return tracks;
}

// ---------------------------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------------------------

export function readArchive(dir) {
  const files = readdirSync(dir).filter((f) => /^GMEMfinalResult_frame\d+\.xml$/.test(f))
    .sort((a, b) => a.localeCompare(b));
  return files.map((f) => parseFrame(readFileSync(join(dir, f), 'utf8')));
}

/** Measure, do not assume, the sigma at which nuclei stop overlapping their nearest neighbour.
 *  For each frame, the nearest-neighbour distance of every detection; the sigma that puts the MEDIAN
 *  pair exactly in contact is 0.5 * median(nn) / median(sd). Reported, not applied. */
export function calibrate(frames) {
  const nn = [], sds = [];
  for (let t = 0; t < frames.length; t += 10) {
    const f = frames[t];
    for (let i = 0; i < f.length; i++) {
      let best = Infinity;
      for (let j = 0; j < f.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(f[i].x - f[j].x, f[i].y - f[j].y, f[i].z - f[j].z);
        if (d < best) best = d;
      }
      if (Number.isFinite(best)) nn.push(best);
      const r = sdRadius(f[i].nu, f[i].W);
      if (r !== null) sds.push(r);
    }
  }
  const med = (a) => { const s = a.slice().sort((u, v) => u - v); return s[Math.floor(s.length / 2)]; };
  const mnn = med(nn), msd = med(sds);
  return {
    frames_sampled: Math.ceil(frames.length / 10),
    median_nearest_neighbour_voxels: mnn,
    median_sd_radius_voxels: msd,
    sigma_at_which_median_pair_touches: (0.5 * mnn) / msd,
    sigma_used_for_drawing: SIGMA_FOR_DRAWING,
    verdict: null, // filled by the caller once both numbers exist
  };
}

export function run({ dir, out }) {
  const frames = readArchive(dir);
  const detections = frames.reduce((a, f) => a + f.length, 0);
  const floor = measureFloor(frames);
  let priorCount = 0;
  for (const f of frames) for (const d of f) if (d.at_prior === true) priorCount++;

  // divisions
  const events = [];
  let invalid = 0, threePlus = 0;
  const perFrame = [];
  for (let t = 1; t < frames.length; t++) {
    const r = divisionsBetween(frames[t - 1], frames[t], t);
    invalid += r.invalid_parents; threePlus += r.three_or_more_children;
    perFrame.push(r.events.length);
    for (const e of r.events) {
      const P = frames[t - 1][e.parent_index];
      const A = frames[t][e.child_indices[0]];
      const B = frames[t][e.child_indices[1]];
      const g = divisionGeometry(P, A, B);
      if (!g) continue;
      events.push({ frame: t, parent: P, a: A, b: B, geom: g });
    }
  }

  // ========================= THE RULE THAT HAD TO BE REPLACED =========================
  // The first version flagged a frame whose division count exceeded 15 % of its own population. It
  // flagged NOTHING - and the earlier export's own record names four frames, reporting 61, 64, 65 and
  // 84 divisions, as a re-segmentation artefact. The threshold sat just above them: 84 divisions in a
  // frame of about 560 is 15.0 %, so a rule written as a round number landed on the wrong side of the
  // very events it was written to catch. A threshold chosen for how it reads is not a threshold.
  //
  // The replacement is relative to this file's own behaviour: flag a frame whose division RATE exceeds
  // ten times the median frame's. That needs no view about zebrafish cell cycles and no round number,
  // and it is checkable against the earlier record, which is what the test does.
  const rates = [];
  for (let t = 1; t < frames.length; t++) rates.push(perFrame[t - 1] / Math.max(1, frames[t].length));
  const sortedRates = rates.slice().sort((a, b) => a - b);
  const medianRate = sortedRates[Math.floor(sortedRates.length / 2)];
  const SUSPECT_MULTIPLE = 10;
  const suspectFrames = new Set();
  for (let t = 1; t < frames.length; t++) {
    if (rates[t - 1] > SUSPECT_MULTIPLE * medianRate) suspectFrames.add(t);
  }
  for (const e of events) {
    e.suspect = suspectFrames.has(e.frame);
    e.at_prior = !!(e.parent.at_prior && e.a.at_prior && e.b.at_prior);
    e.axes_off_floor = Math.min(
      axesOffFloor(e.parent.nu, e.parent.W) ?? 0,
      axesOffFloor(e.a.nu, e.a.W) ?? 0,
      axesOffFloor(e.b.nu, e.b.W) ?? 0,
    );
  }

  const clean = events.filter((e) => !e.suspect);

  const stat = (xs) => {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { n: s.length, min: s[0], q25: q(0.25), median: q(0.5), q75: q(0.75), max: s[s.length - 1],
      mean: s.reduce((a, b) => a + b, 0) / s.length };
  };

  const tracks = buildTracks(frames);
  const lenHist = {};
  for (const tr of tracks) lenHist[tr.length] = (lenHist[tr.length] ?? 0) + 1;

  const summary = {
    what_this_is: 'measured cleavage events from idr0068, re-exported with no track-length filter',
    source: SOURCE,
    scale: SCALE,
    sigma_for_drawing: SIGMA_FOR_DRAWING,
    parent_rule: PARENT_RULE,
    detections,
    frames: frames.length,
    invalid_parent_refs: invalid,
    invalid_parent_share: invalid / detections,
    parents_with_three_or_more_children: threePlus,
    division_events_total: events.length,
    division_events_suspect: events.length - clean.length,
    division_events_usable: clean.length,
    suspect_frames: [...suspectFrames].sort((a, b) => a - b),
    suspect_rule: `a frame whose division rate exceeds ${SUSPECT_MULTIPLE}x the median frame's rate. See the comment above the rule for the threshold this replaced and why.`,
    median_division_rate_per_frame: medianRate,
    posterior_equals_prior: {
      detections_where_true: priorCount,
      share: priorCount / detections,
      what_it_means: 'the deposited posterior precision nu*W equals the deposited prior precision nuPrior*WPrior. See atPrior(). Measured, not assumed, and reported because a share of 1 is itself the finding.',
    },
    regularisation_floor: {
      ...floor,
      what_it_means: 'no axis of any detection is allowed a precision above precision_cap, so no axis standard deviation is below sd_voxels. Sizes are bounded below by the tracker, not by the specimen.',
    },
    what_the_old_export_could_draw: 4,
    what_the_old_export_could_draw_why: 'it required all three of parent, daughter A and daughter B to survive a 50-frame minimum, and a division is where tracks start and stop.',
    geometry: {
      all_usable_events: {
        separation_voxels: stat(clean.map((e) => e.geom.separation)),
        parent_sd_radius_voxels: stat(clean.map((e) => e.geom.sd_radius.parent)),
        volume_ratio_union: stat(clean.map((e) => e.geom.volume_ratio_union)),
        separation_over_parent_drawn_radius: stat(clean.map((e) => e.geom.separation_over_parent_drawn_radius)),
        size_asymmetry: stat(clean.map((e) => e.geom.size_asymmetry)),
        share_with_overlapping_daughters: clean.filter((e) => e.geom.daughters_overlap).length / Math.max(1, clean.length),
      },
      // THE PARTITION THAT SETTLES IT. k = the minimum, over parent and both daughters, of how many
      // axes are strictly above the regularisation floor. If the median volume ratio of 2 came from
      // the floor, it must move as k rises. If it stays at 2 across k, the floor is not the
      // explanation and the ratio means something.
      volume_ratio_by_axes_off_floor: Object.fromEntries([0, 1, 2, 3].map((k) => {
        const g = clean.filter((e) => e.axes_off_floor === k);
        return [k, { events: g.length, volume_ratio_union: stat(g.map((e) => e.geom.volume_ratio_union)),
          parent_sd_radius_voxels: stat(g.map((e) => e.geom.sd_radius.parent)) }];
      })),
      all_three_axes_free: (() => {
        const g = clean.filter((e) => e.axes_off_floor === 3);
        return {
          events: g.length,
          volume_ratio_union: stat(g.map((e) => e.geom.volume_ratio_union)),
          separation_voxels: stat(g.map((e) => e.geom.separation)),
          size_asymmetry: stat(g.map((e) => e.geom.size_asymmetry)),
        };
      })(),
    },
    what_this_tests: WHAT_THIS_TESTS,
    calibration: (() => {
      const c = calibrate(frames);
      c.verdict = c.sigma_at_which_median_pair_touches > SIGMA_FOR_DRAWING
        ? `spheres drawn at ${SIGMA_FOR_DRAWING} sd are clear of their neighbours: contact would need ${c.sigma_at_which_median_pair_touches.toFixed(2)} sd. The drawing choice is conservative by a factor of ${(c.sigma_at_which_median_pair_touches / SIGMA_FOR_DRAWING).toFixed(2)}.`
        : `spheres drawn at ${SIGMA_FOR_DRAWING} sd INTERPENETRATE their neighbours: the median pair touches at ${c.sigma_at_which_median_pair_touches.toFixed(2)} sd. The drawing choice is too large.`;
      return c;
    })(),
    tracks: {
      total: tracks.length,
      length_histogram_head: Object.fromEntries(Object.entries(lenHist).slice(0, 12)),
      single_frame: lenHist[1] ?? 0,
      at_least_50: tracks.filter((t) => t.length >= 50).length,
      mean_length: tracks.reduce((a, t) => a + t.length, 0) / tracks.length,
      note: 'every track is kept. The 50-frame set is reported so this export can be compared with the earlier one.',
    },
  };

  // the drawable export: the usable events, trimmed to what a viewer needs, centred and normalised the
  // same way the existing cloud is so the two overlay without a second transform.
  const C = [354.55, 284.98, 298.83], R = 543.84;
  const nrm = (d) => [(d.x - C[0]) / R, (d.y - C[1]) / R, (d.z - C[2]) / R];
  const draw = clean.map((e) => ({
    f: e.frame,
    m: e.at_prior ? 0 : 1, // 1 = all three sizes were fitted; 0 = at least one is the tracker's prior
    p: nrm(e.parent).map((v) => +v.toFixed(5)),
    a: nrm(e.a).map((v) => +v.toFixed(5)),
    b: nrm(e.b).map((v) => +v.toFixed(5)),
    rp: +(e.geom.drawn_radius.parent / R).toFixed(6),
    ra: +(e.geom.drawn_radius.a / R).toFixed(6),
    rb: +(e.geom.drawn_radius.b / R).toFixed(6),
    vr: +e.geom.volume_ratio_union.toFixed(4),
  }));

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'embryo-divisions.json'), JSON.stringify({
    ...summary,
    normalisation: { centroid_voxels: C, radius_voxels: R,
      note: 'identical to the existing embryo-manifest.json, so divisions and the point cloud share one frame of reference' },
    events: draw,
  }, null, 1));

  return summary;
}

/* ============================== NUCLEI, NOT POINTS ==============================
 * The existing embryo artefact is a float16 cloud of positions with no size: the viewer draws it as
 * GL points, which is why the embryo reads as a dust cloud rather than as cells. Every detection has a
 * measured extent - that is what the covariance is - so this exports it.
 *
 * Written as a SEPARATE file under a new name rather than by extending embryo-cloud.f16, because that
 * artefact and its manifest belong to another thread's module and this one has no business changing
 * the bytes it describes.
 *
 * Layout: float16 little-endian, FOUR per detection (x, y, z, r), frames concatenated in order. The
 * normalisation is the one already in embryo-manifest.json, so the two overlay without a second
 * transform. r is the drawn radius - SIGMA_FOR_DRAWING standard deviations - divided by the same
 * normalising radius as the positions, so it is in the same units as x, y, z.
 */
export function exportNuclei({ dir, out }) {
  const frames = readArchive(dir);
  measureFloor(frames);
  const C = [354.55, 284.98, 298.83], R = 543.84;
  const total = frames.reduce((a, f) => a + f.length, 0);
  const buf = new Uint16Array(total * 4);
  const index = [];
  let w = 0, offset = 0;
  let atFloor = 0, rMin = Infinity, rMax = -Infinity, rSum = 0;
  for (const f of frames) {
    index.push({ offset, count: f.length });
    offset += f.length;
    for (const d of f) {
      const sd = sdRadius(d.nu, d.W);
      const r = sd === null ? FLOOR.sd_voxels : sd;
      if (Math.abs(r - FLOOR.sd_voxels) < 1e-6) atFloor++;
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); rSum += r;
      buf[w++] = f32to16((d.x - C[0]) / R);
      buf[w++] = f32to16((d.y - C[1]) / R);
      buf[w++] = f32to16((d.z - C[2]) / R);
      buf[w++] = f32to16((SIGMA_FOR_DRAWING * r) / R);
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'embryo-nuclei.f16'), Buffer.from(buf.buffer));
  const manifest = {
    what_this_is: 'every detection in idr0068 as a nucleus with a measured radius, not a dimensionless point',
    why_a_new_file: 'embryo-cloud.f16 and its manifest are another thread\'s artefacts. This neither replaces nor rewrites them.',
    source: SOURCE,
    scale: SCALE,
    layout: 'float16 little-endian, 4 per detection (x y z r), frames concatenated in order',
    detections: total,
    frames: frames.length,
    bytes: buf.byteLength,
    normalisation: { centroid_voxels: C, radius_voxels: R,
      note: 'identical to embryo-manifest.json, so the two overlay without a second transform' },
    radius: {
      what_it_is: `SIGMA_FOR_DRAWING (${SIGMA_FOR_DRAWING}) standard deviations, divided by the normalising radius, so it is in the same units as x y z`,
      sigma_for_drawing: SIGMA_FOR_DRAWING,
      sd_voxels: { min: rMin, max: rMax, mean: rSum / total },
      drawn_normalised: { min: SIGMA_FOR_DRAWING * rMin / R, max: SIGMA_FOR_DRAWING * rMax / R },
      share_exactly_at_the_regularisation_floor: atFloor / total,
      floor: { ...FLOOR },
      honesty:
        'the radius is bounded below by the tracker, not by the specimen. See the regularisation floor. '
        + 'It is a real per-nucleus number - most detections are NOT at the floor on all three axes - but '
        + 'it is not a free measurement of a nuclear envelope.',
    },
    index,
  };
  writeFileSync(join(out, 'embryo-nuclei.json'), JSON.stringify(manifest, null, 1));
  return { detections: total, frames: frames.length, bytes: buf.byteLength,
    radius_sd_voxels: { min: rMin, max: rMax, mean: rSum / total },
    share_at_floor: atFloor / total };
}

/** double -> float16 bit pattern. Uses Float16Array, which is the reference implementation.
 *
 *  ============================== TWO BUGS IN A HAND-ROLLED CONVERTER ==============================
 *  This was written by hand first, on the reasoning that the encoding should not depend on the Node
 *  version that happens to run the export. It was wrong twice, and the second one is the interesting
 *  one because no round-trip test can see it.
 *
 *  BUG ONE: the comment said round-to-nearest-EVEN and the code did round-half-UP. Over 50,012 values
 *  it disagreed with Float16Array on 4, every one an exact tie, every one off by a single unit in the
 *  last place. The comment was right and the code was wrong.
 *
 *  BUG TWO, after the tie-break was fixed: still 15 mismatches in 220,016, now in BOTH directions.
 *  The cause is DOUBLE ROUNDING. JavaScript numbers are float64; the hand-rolled path wrote the value
 *  into a Float32Array first and converted float32 -> float16, so every value was rounded twice.
 *  Float16Array converts float64 -> float16 in one step. A double sitting just below a float16 tie
 *  rounds UP to float32, landing exactly on the tie, and the tie-break then sends it up - where a
 *  single correct rounding would have sent it down.
 *
 *  A round-trip test cannot catch this: decode the float16 and compare, and the answer is within half
 *  an ulp either way. It takes a reference implementation, and there is one.
 *
 *  So Float16Array is used. The hand-rolled path is kept as `f32to16Manual` for runtimes without it,
 *  and the test asserts they agree where both exist - which is the assertion that found both bugs. */
const _f16 = typeof Float16Array !== 'undefined' ? new Float16Array(1) : null;
const _f16bits = _f16 ? new Uint16Array(_f16.buffer) : null;
export const F16_REFERENCE_AVAILABLE = !!_f16;

export function f32to16(v) {
  if (_f16) { _f16[0] = v; return _f16bits[0]; }
  return f32to16Manual(v);
}

/** The hand-rolled fallback. Correct to within one ulp on ties, for runtimes with no Float16Array. */
export function f32to16Manual(v) {
  const f = new Float32Array(1); const i = new Uint32Array(f.buffer);
  f[0] = v;
  const x = i[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = (x >>> 23) & 0xff;
  let man = x & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (man ? 0x200 : 0); // inf / nan
  let e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;                         // overflow -> inf
  if (e <= 0) {
    if (e < -10) return sign;                                  // underflow -> zero
    man |= 0x800000;
    const shift = 14 - e;
    const lsb = (man >>> shift) & 1;
    const half = (man + ((1 << (shift - 1)) - 1) + lsb) >>> shift;
    return sign | half;
  }
  // round to nearest, ties to even: add half-an-ulp minus one, plus the kept mantissa's low bit
  const lsb = (man >>> 13) & 1;
  const rounded = man + 0x0fff + lsb;
  if (rounded & 0x800000) { e += 1; man = 0; if (e >= 0x1f) return sign | 0x7c00; }
  else man = rounded;
  return sign | (e << 10) | (man >>> 13);
}

export const WHAT_THIS_DOES_NOT_MODEL = Object.freeze([
  'a cell boundary. These are nuclei. Nothing in this recording images a plasma membrane, so every "cell" word in the viewer that points at this data is pointing at a nucleus.',
  'a cleavage furrow. The parent is present in frame t-1 and absent in frame t; the intervening 150 s contains the entire mechanical event and was not sampled.',
  'which daughter is which. The two children are in file order, and file order is not a biological label.',
  'a micron scale, for the reason in SCALE.',
  'whether a division is mitosis or a tracker re-segmentation, except by the population-share heuristic in suspect_rule, which is a heuristic.',
]);
