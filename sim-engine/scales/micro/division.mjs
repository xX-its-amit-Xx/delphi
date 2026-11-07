#!/usr/bin/env node
// division.mjs - CLEAVAGE AS A CONSTRAINT, NOT AS AN EASING CURVE.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// A viewer that shows cells splitting has to decide what happens between one stage and the next. The
// cheap way is to fade one sphere out and two spheres in, or to slide two half-size spheres apart on
// an ease-in-out curve. Both look fine and both are drawings of nothing.
//
// There is a real constraint available, and it is the one that defines cleavage: in a cleaving embryo
// the cells divide WITHOUT GROWING. Total volume is conserved, so the daughters are smaller than the
// parent by exactly 2^(-1/3) in radius, and at every instant in between the two forming daughters must
// still add up to the parent's volume. That is enough to pin down the whole interpolation.
//
// So this module does not interpolate positions and radii independently. It takes the separation of
// the two daughter centres as the single free parameter of the division, and SOLVES for the radius
// that keeps the union volume constant. Early in the division the two spheres overlap heavily and the
// shape is a sphere; as they separate it becomes a peanut; at full separation they are two touching
// spheres of radius r0 * 2^(-1/3). The furrow appears on its own, because overlapping spheres make one.
//
// The worked .life example this drives conserves volume to within one part in 10^4 across all five
// stages, so the constraint is a property of the data and not an assumption imposed on it.
//
// ============================== WHAT IS MEASURED AND WHAT IS DRAWN ==============================
// MEASURED-SECONDHAND: the stage sequence, the cell counts per stage, the stage times.
// DEPICTED:            every cell POSITION and RADIUS in the source file, and therefore every position
//                      and radius here. The geometry provenance in the source file is "depicted" and
//                      this module propagates that word rather than laundering it by computing on it.
// DERIVED:            the radius-vs-separation relation below, from the conservation constraint.
//
// A division animation built on depicted geometry is a diagram of a process, not a measurement of one.
// `provenanceOf()` returns that sentence rather than leaving the caller to guess.

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

export const SPHERE = Object.freeze({
  volume: (r) => (4 / 3) * Math.PI * r ** 3,
  radiusForVolume: (v) => Math.cbrt((3 * v) / (4 * Math.PI)),
});

/**
 * Volume of the lens where two spheres of EQUAL radius r overlap, centres a distance d apart.
 *   V = pi/12 * (4r + d) * (2r - d)^2    for 0 <= d <= 2r,  and 0 beyond.
 * Checks: at d = 0 this is (4/3)pi r^3, one whole sphere; at d = 2r it is 0.
 */
export function lensVolume(r, d) {
  if (!(r > 0)) throw new RangeError(`lensVolume needs r > 0, got ${r}`);
  if (d < 0) throw new RangeError(`lensVolume needs d >= 0, got ${d}`);
  if (d >= 2 * r) return 0;
  return (Math.PI / 12) * (4 * r + d) * (2 * r - d) ** 2;
}

/** Volume of the union of two equal spheres of radius r whose centres are d apart. */
export function unionVolume(r, d) {
  return 2 * SPHERE.volume(r) - lensVolume(r, d);
}

/**
 * The radius two forming daughters must have, at centre separation d, for their union to equal
 * `targetVolume`. Solved by bisection because the closed form is a depressed cubic in r whose root
 * selection is fiddlier than the bisection and no more exact in floating point.
 *
 * unionVolume is strictly increasing in r at fixed d, so bisection is safe and the bracket is simple:
 * the answer lies between the single-sphere radius (d = 0 case) and the fully separated radius.
 */
export function radiusForUnion(targetVolume, d, { tol = 1e-12, maxIter = 200 } = {}) {
  if (!(targetVolume > 0)) throw new RangeError(`radiusForUnion needs a positive target volume, got ${targetVolume}`);
  if (d < 0) throw new RangeError(`radiusForUnion needs d >= 0, got ${d}`);
  const rCoincident = SPHERE.radiusForVolume(targetVolume);            // d = 0: one sphere
  const rSeparate = SPHERE.radiusForVolume(targetVolume / 2);          // d >= 2r: two spheres
  let lo = rSeparate, hi = rCoincident;
  if (unionVolume(rSeparate, d) >= targetVolume) return rSeparate;     // already fully separated
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const v = unionVolume(mid, d);
    if (Math.abs(v - targetVolume) <= tol * targetVolume) return mid;
    if (v < targetVolume) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Pair each parent cell with the daughters it becomes.
 *
 * The source file records stages, not lineages: nothing in it says which daughter came from which
 * parent. So this is an ASSIGNMENT WE ARE MAKING, and it is made by the cheapest defensible rule -
 * each daughter goes to its nearest parent centre - and then checked. If the assignment does not come
 * out as exactly two daughters per parent, the function says so rather than silently animating a cell
 * that splits into three.
 *
 * `balanced: false` in the result is not an error to swallow: it means the drawing would be inventing
 * a lineage the geometry does not support, and the caller should fall back to a non-lineage transition.
 */
export function pairDaughters(parents, daughters) {
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const assignment = daughters.map((d, di) => {
    let best = 0, bestD = Infinity;
    parents.forEach((p, pi) => { const s = dist2(p.centre, d.centre); if (s < bestD) { bestD = s; best = pi; } });
    return { daughter: di, parent: best, distance: Math.sqrt(bestD) };
  });
  const perParent = parents.map((_, pi) => assignment.filter(a => a.parent === pi).map(a => a.daughter));
  const counts = perParent.map(x => x.length);
  const balanced = counts.length > 0 && counts.every(c => c === 2) && daughters.length === parents.length * 2;
  return {
    pairs: perParent.map((ds, pi) => ({ parent: pi, daughters: ds })),
    counts,
    balanced,
    why_not: balanced ? null
      : `expected exactly 2 daughters per parent; got counts [${counts.join(', ')}] for ${parents.length} parent(s) and ${daughters.length} daughter(s). The source records stages, not lineage, so nearest-centre assignment is a guess and this one did not come out two-to-one.`,
    rule: 'each daughter assigned to the nearest parent centre; this is an assignment made here, not a lineage recorded in the data',
  };
}

/**
 * One frame of one cell dividing.
 *
 * `t` runs 0 -> 1 over the division. The free parameter is the centre separation, which goes from 0 to
 * the separation the two daughter positions actually have in the next stage. Radius is then SOLVED, not
 * interpolated, so union volume is constant for every t.
 *
 * Returns both spheres plus `furrow`, the depth of the waist as a fraction of the daughter radius,
 * which is 0 while the union is still convex and rises as the two spheres pull apart. A caller can use
 * it to decide when to draw a contractile ring; it is a geometric description of the drawn shape, not a
 * claim about cytokinesis.
 */
export function divisionFrame(parent, daughterA, daughterB, t, { ease = (x) => x } = {}) {
  if (!(t >= 0 && t <= 1)) throw new RangeError(`divisionFrame needs t in [0, 1], got ${t}`);
  const V = SPHERE.volume(parent.radius);
  const finalSep = Math.hypot(
    daughterA.centre[0] - daughterB.centre[0],
    daughterA.centre[1] - daughterB.centre[1],
    daughterA.centre[2] - daughterB.centre[2]);
  const u = ease(t);
  const d = finalSep * u;
  const r = radiusForUnion(V, d);
  const mid = [0, 1, 2].map(i => (daughterA.centre[i] + daughterB.centre[i]) / 2);
  const axis = finalSep === 0 ? [0, 0, 0]
    : [0, 1, 2].map(i => (daughterA.centre[i] - daughterB.centre[i]) / finalSep);
  // At t = 0 both daughters sit on the parent centre; at t = 1 they sit where the next stage puts them.
  const centreOf = (sign) => [0, 1, 2].map(i =>
    parent.centre[i] * (1 - u) + (mid[i] + sign * axis[i] * d / 2) * u);
  const separated = d >= 2 * r;
  return {
    t, separation: d, radius: r,
    a: { centre: centreOf(+1), radius: r },
    b: { centre: centreOf(-1), radius: r },
    union_volume: unionVolume(r, d),
    parent_volume: V,
    furrow: separated ? 1 : Math.max(0, 1 - Math.sqrt(Math.max(0, 1 - (d / (2 * r)) ** 2))),
    separated,
    axis,
  };
}

/**
 * How badly do the cells of one stage interpenetrate?
 *
 * This exists because the worked example's cells DO interpenetrate, substantially, and a viewer that
 * simply draws the stored spheres draws cells sitting inside one another. Measure it rather than
 * discover it on screen.
 */
export function packingCheck(cells) {
  let pairs = 0, overlapping = 0, worst = 0, minSep = Infinity;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const d = Math.hypot(...[0, 1, 2].map(k => cells[i].centre[k] - cells[j].centre[k]));
      const touch = cells[i].radius + cells[j].radius;
      pairs++;
      if (d < touch) { overlapping++; worst = Math.max(worst, (touch - d) / touch); }
      minSep = Math.min(minSep, d);
    }
  }
  const summed = cells.reduce((a, c) => a + SPHERE.volume(c.radius), 0);
  return {
    n: cells.length, pairs, overlapping,
    fraction_of_pairs_overlapping: pairs ? overlapping / pairs : 0,
    worst_overlap_fraction: worst,
    min_centre_separation: cells.length > 1 ? minSep : null,
    summed_volume: summed,
    interpenetrating: overlapping > 0,
  };
}

/**
 * THE REASON THE SOURCE FILE INTERPENETRATES, AND WHY NO FILE OF THIS KIND CAN AVOID IT.
 *
 * Cleavage divides without growth, so the daughters' volumes must sum to the parent's. A depiction
 * that also wants the embryo to keep the parent's outline must therefore fit n spheres of total
 * volume V inside a container of volume V. That is impossible for n > 1: equal spheres cannot fill
 * more than pi/(3*sqrt(2)) ~ 0.7405 of space even in an infinite optimal packing (Hales' proof of the
 * Kepler conjecture), and packings of a few spheres inside a sphere do considerably worse than that.
 *
 * So a drawing of cleavage has exactly three options, and must pick one:
 *   1. let the cells interpenetrate               - what the source file does, 31% union shortfall at two cells
 *   2. let the envelope grow                      - geometrically honest, but the embryo does not grow
 *   3. stop drawing cells as spheres              - which is what the embryo actually does
 *
 * Option 3 is the biology. Blastomeres flatten against one another, and at the 8-cell stage of a mouse
 * embryo they do so dramatically - compaction, an adhesion-driven change of cell SHAPE. A sphere cannot
 * represent it, so any sphere-based depiction of cleavage is wrong at exactly the stage where the
 * interesting thing happens. This module cannot fix that; it can refuse to hide it.
 */
export const THE_PACKING_IMPOSSIBILITY = deepFreeze({
  claim: 'n equal spheres of total volume V cannot fit inside a sphere of volume V, for any n > 1',
  max_packing_fraction_infinite: 0.7404804896930611,
  max_packing_fraction_source: 'pi/(3*sqrt(2)), the face-centred-cubic/hexagonal density; proved optimal by Hales (Kepler conjecture)',
  envelope_growth_required: (n) => Math.cbrt(1 / 0.7404804896930611),
  the_three_options: [
    'let the cells interpenetrate - what the worked example does',
    'let the envelope grow by at least 1/0.7405^(1/3) ~ 1.105 in radius - honest geometry, wrong biology',
    'stop drawing cells as spheres - correct, and not available to a format that stores a centre and a radius',
  ],
  what_the_embryo_actually_does:
    'it flattens the cells against one another. In a mouse embryo the 8-cell stage compacts, which is a ' +
    'change in cell shape and adhesion, not in cell volume. A centre-and-radius representation cannot ' +
    'express it, so the stage with the most interesting mechanics is the stage the depiction cannot draw.',
});

/** Build the whole animation plan from the stage list of a .life timeline. */
export function plan(stages, { secondsPerDivision = 1.2 } = {}) {
  const steps = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i], to = stages[i + 1];
    const parents = from.cells, daughters = to.cells;
    const pairing = pairDaughters(parents, daughters);
    const vFrom = parents.reduce((a, c) => a + SPHERE.volume(c.radius), 0);
    const vTo = daughters.reduce((a, c) => a + SPHERE.volume(c.radius), 0);
    steps.push({
      from: from.id, to: to.id,
      parents: parents.length, daughters: daughters.length,
      pairing,
      volume_from: vFrom, volume_to: vTo,
      volume_ratio: vTo / vFrom,
      volume_conserved: Math.abs(vTo / vFrom - 1) < 1e-3,
      packing_from: packingCheck(parents), packing_to: packingCheck(daughters),
      from_time: from.time ?? null, to_time: to.time ?? null, time_unit: from.time_unit ?? to.time_unit ?? null,
      seconds: secondsPerDivision,
    });
  }
  return {
    steps,
    total_seconds: steps.length * secondsPerDivision,
    all_balanced: steps.every(s => s.pairing.balanced),
    all_volume_conserved: steps.every(s => s.volume_conserved),
    any_interpenetration: steps.some(s => s.packing_to.interpenetrating),
    unbalanced_steps: steps.filter(s => !s.pairing.balanced).map(s => `${s.from} -> ${s.to}`),
    // A caller that animates lineage must know which transitions it may NOT animate that way.
    lineage_animatable: steps.map(s => ({ step: `${s.from} -> ${s.to}`, ok: s.pairing.balanced })),
  };
}

export const PROVENANCE = deepFreeze({
  measured_secondhand: ['the stage sequence', 'the cell count at each stage', 'the stage times and their unit'],
  depicted: ['every cell centre', 'every cell radius', 'the lineage assignment between stages'],
  derived: ['the radius-versus-separation relation, from constant union volume', 'the furrow depth, as a description of the drawn shape'],
  the_sentence:
    'This is a diagram of cleavage, not a measurement of one. The stage sequence and timing come from ' +
    'the source file; every position and radius in it is marked "depicted", and nothing computed here ' +
    'can turn a depicted position into a measured one.',
});

export function provenanceOf() { return PROVENANCE; }

export const WHAT_THIS_DOES_NOT_MODEL = deepFreeze([
  'cytokinesis. There is no contractile ring, no spindle, and no mechanism: the waist in this drawing is ' +
  'the geometry of two overlapping spheres, which happens to look like a furrow.',
  'the timing WITHIN a division. The separation is driven by an easing function supplied by the caller; ' +
  'nothing here knows how long anaphase takes relative to telophase.',
  'asynchrony. Real cleavage divisions in an embryo are not simultaneous, and blastomeres divide out of ' +
  'step from the 2-cell stage onward. This plan divides a whole stage at once because the source file ' +
  'records stages rather than per-cell division times.',
  'anything about shape other than sphericity. Real blastomeres flatten against one another, and ' +
  'compaction at the 8-cell stage is a change in cell SHAPE and adhesion that a sphere cannot show.',
]);
