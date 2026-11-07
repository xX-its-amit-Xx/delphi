// The hard negative that has to be CONSTRUCTED, because sampling cannot find it.
//
// ============================== THE QUESTION ==============================
// The decoy ladder in decoys.mjs asks how the scorer does against negatives of varying difficulty. This
// file asks the sharper version: what is the MOST TYPICAL ANATOMICALLY IMPOSSIBLE ANIMAL the model allows?
//
// That is an optimisation, not a sample. Minimise q subject to violating a constraint that no real animal
// can violate. Drawing 20,000 decoys from the fitted model found 88 that break the eye-in-head constraint
// and NOT ONE of them inside the typical radius q < 1. A search finds one immediately. Sampled negatives
// cannot measure a worst case, which is why the benchmark's 12,606 drawn negatives never found this.
//
// ============================== THE CONSTRAINTS, AND THE FOUR THAT WERE WRONG ==============================
// A constraint used here must hold for EVERY real specimen. The way to find out is to check, and checking
// rejected four constraints that sound obviously true:
//
//     100.00 %   preorbital + eye_diameter <= head_length      KEPT - geometric containment
//     100.00 %   eye_diameter <= head_length                   KEPT (implied by the above)
//     100.00 %   preorbital <= head_length                     KEPT (implied by the above)
//      99.98 %   every along-body distance <= 1 SL             kept as near-strict, flagged
//      99.91 %   prepelvic <= preanal                          kept as near-strict, flagged
//      97.58 %   predorsal <= preanal                          REJECTED - a tendency, not a law
//      69.66 %   prepectoral <= prepelvic                      REJECTED
//      60.62 %   head_length <= prepectoral                    REJECTED - barely better than a coin
//
// "The pectoral fin sits behind the head" is false for 39 % of real fish. Had it gone in unchecked, every
// hard negative built on it would have been a real fish mislabelled impossible, and the benchmark would
// have reported the scorer failing to detect animals that exist. The check against real specimens is the
// control, and it is not optional.
//
// What survives is one genuinely geometric fact: the eye lies within the head, behind the snout. It holds
// on 4,673 of 4,673 held-out specimens. The benchmark's own `organ_containment` negative class - the right
// idea - contains THREE items.

import { makeScorer } from './joint.mjs';

/** Constraints that every real specimen satisfies, with the rate that was measured, not assumed. */
export const CONSTRAINTS = [
  {
    id: 'eye-in-head',
    statement: 'preorbital_over_SL + eye_diameter_over_SL <= head_length_over_SL',
    why: 'the eye lies within the head and behind the snout, so the snout length plus the eye diameter cannot exceed the whole head',
    strictness: 'geometric: a violation is not a rare animal, it is not an animal',
    measured_on_real_heldout: 1.0,
    n_real: 4673,
    traits: ['preorbital_over_SL', 'eye_diameter_over_SL', 'head_length_over_SL'],
    slack: p => p.head_length_over_SL - (p.preorbital_over_SL + p.eye_diameter_over_SL),
  },
];

/** Candidates that CHECKING rejected. Kept in the file because the rejection is the useful part. */
export const REJECTED = Object.freeze([
  { statement: 'head_length_over_SL <= prepectoral_over_SL', holds_on_real: 0.6062, note: 'the pectoral fin is NOT behind the head in 39 % of real fish' },
  { statement: 'prepectoral_over_SL <= prepelvic_over_SL', holds_on_real: 0.6966, note: 'fin order along the body is not fixed' },
  { statement: 'predorsal_over_SL <= preanal_over_SL', holds_on_real: 0.9758, note: 'close, but 2.4 % of real fish break it, so it cannot label an impossibility' },
]);

export const NEAR_STRICT = Object.freeze([
  { statement: 'prepelvic_over_SL <= preanal_over_SL', holds_on_real: 0.9991 },
  { statement: 'every along-body distance <= 1 standard length', holds_on_real: 0.9998 },
]);

/**
 * Minimise q subject to violating a constraint by at least `margin`.
 *
 * Penalty method with numerical gradients on the log10 coordinates. d = 10 and q is a smooth quadratic in
 * those coordinates, so this is easy going; the schedule is fixed and seedless, which makes the result
 * reproducible without an RNG.
 *
 * `margin` is in units of standard length: 0.02 means the snout plus the eye overhang the back of the head
 * by 2 % of the animal's body length.
 */
export function mostTypicalViolator(P, constraint, { margin = 0.01, lambdas = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7], iters = 3000 } = {}) {
  const S = makeScorer(P);
  const T = P.traits;
  const toParams = u => Object.fromEntries(T.map((t, i) => [t, Math.pow(10, u[i])]));
  // violation = -slack, positive when the constraint is broken
  const violation = u => -constraint.slack(toParams(u));
  const q = u => S.q(toParams(u));

  let u = P.mu.slice();
  for (const lambda of lambdas) {
    const obj = v => {
      const shortfall = Math.max(0, margin - violation(v));
      return q(v) + lambda * shortfall * shortfall;
    };
    let step = 0.05;
    for (let it = 0; it < iters; it++) {
      const base = obj(u);
      const grad = u.map((_, i) => {
        const h = 1e-6;
        const a = u.slice();
        a[i] += h;
        return (obj(a) - base) / h;
      });
      const norm = Math.hypot(...grad) || 1;
      const next = u.map((v, i) => v - (step * grad[i]) / norm);
      if (obj(next) < base) u = next;
      else step *= 0.7;
      if (step < 1e-9) break;
    }
  }
  const params = toParams(u);
  const v = violation(u);
  return {
    params, q: q(u), violation: v,
    reached_margin: v >= margin * 0.99,
    margin,
    // the three numbers a reader should see, because the animal is absurd and should look absurd
    snout_plus_eye: params.preorbital_over_SL + params.eye_diameter_over_SL,
    head_length: params.head_length_over_SL,
  };
}

/** How impossible can a design be and still look typical? One row per margin. */
export function impossibilityCurve(P, constraint, realQ, margins = [0.001, 0.01, 0.02, 0.05, 0.1]) {
  const sorted = [...realQ].sort((a, b) => a - b);
  return margins.map(margin => {
    const r = mostTypicalViolator(P, constraint, { margin });
    const lessTypical = sorted.filter(v => v > r.q).length;
    return {
      margin, min_q: Number(r.q.toFixed(4)),
      reached: r.reached_margin,
      called_typical_by_the_scorer: r.q < 1,
      real_fish_less_typical_than_it: lessTypical,
      real_fish_less_typical_share: Number((lessTypical / sorted.length).toFixed(4)),
      snout_plus_eye: Number(r.snout_plus_eye.toFixed(4)),
      head_length: Number(r.head_length.toFixed(4)),
    };
  });
}

export const WHAT_THE_CURVE_MEANS = Object.freeze({
  the_result:
    'an animal whose snout and eye overhang the back of its head by 2 % of its body length scores q = 0.918, ' +
    'which the scorer calls typical, and ranks as more plausible than 1,279 of 4,673 real held-out fish.',
  why_sampling_missed_it:
    '20,000 draws from the fitted model produced 88 violations and none inside q < 1. A worst case is not a ' +
    'sample; it has to be searched for. The benchmark drew 12,606 negatives and never found this.',
  what_it_does_not_show:
    'that the scorer is wrong. The scorer measures distance to real fish and it does that correctly. It shows ' +
    'that distance to real fish does not bound anatomical possibility, so a design can be ordinary by this ' +
    'measure and still be an animal that cannot be built.',
  the_fix_that_is_not_tuning:
    'a containment check is a few lines of arithmetic and it is exact. It belongs in front of the scorer as a ' +
    'gate, not inside it as a term - a design that fails it should be refused rather than scored.',
});
