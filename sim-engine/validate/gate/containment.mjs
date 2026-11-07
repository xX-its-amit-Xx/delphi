// A GATE, not a term. Refuses designs that are geometrically impossible, before anything scores them.
//
// ============================== WHY A GATE AND NOT A SCORE ==============================
// benchmarks/design-hard-negatives found an animal whose snout and eye overhang the back of its head by
// 2 % of its body length - no room left for braincase, jaw, gills or operculum - which the design scorer
// calls TYPICAL (q = 0.918 < 1) and ranks as more plausible than 1,279 of 4,673 real held-out fish.
//
// That is not a tuning problem. The scorer measures distance to real fish and measures it correctly; what
// it cannot do is bound anatomical possibility, because a Gaussian fitted to real fish assigns probability
// to the whole of its own support, impossible regions included. No reweighting removes that, and adding an
// impossibility PENALTY would only trade one arbitrary constant for another.
//
// A containment constraint is different in kind: it is exact arithmetic with no free parameters, and the
// answer is yes or no. So it belongs in front of the scorer as a REFUSAL - "this is not an animal" - and
// never inside it as another term to be weighed against the others.
//
// ============================== THE RULE THAT KEEPS THIS HONEST ==============================
// A constraint may gate ONLY if it holds on every real specimen we have. Four constraints that sound
// obviously true were rejected on exactly that test:
//
//      60.62 %   head_length <= prepectoral     "the pectoral fin sits behind the head" - FALSE for 39 % of real fish
//      69.66 %   prepectoral <= prepelvic
//      97.58 %   predorsal <= preanal           close, and still not a law
//
// Any of those, used as a gate, would REFUSE REAL ANIMALS. A gate that rejects real fish is worse than no
// gate, so admit() refuses to apply a constraint whose recorded support is not 1.0 over a real sample -
// the check is in the code, not in a comment, and a constraint with no evidence field cannot gate at all.

export const VERSION = '1.0.0';

/**
 * Constraints cleared to gate. `supported_on` is the measured share of REAL specimens satisfying it and
 * must be exactly 1 over a stated n, or the constraint is carried but not enforced.
 */
export const GATING = Object.freeze([
  Object.freeze({
    id: 'eye-in-head',
    statement: 'preorbital_over_SL + eye_diameter_over_SL <= head_length_over_SL',
    plain: 'the eye lies within the head and behind the snout, so snout length plus eye diameter cannot exceed the head',
    kind: 'geometric containment',
    traits: ['preorbital_over_SL', 'eye_diameter_over_SL', 'head_length_over_SL'],
    supported_on: { share: 1, n: 4673, sample: 'sim-engine/validate/benchmark/heldout positives complete on the fishbase traits' },
    slack: p => p.head_length_over_SL - (p.preorbital_over_SL + p.eye_diameter_over_SL),
  }),
]);

/** Carried for the record: constraints that FAILED the real-specimen control and must never gate. */
export const REFUSED_AS_GATES = Object.freeze([
  Object.freeze({ statement: 'head_length_over_SL <= prepectoral_over_SL', supported_on: { share: 0.6062, n: 4673 }, why_not: 'the pectoral fin is not behind the head in 39 % of real fish; as a gate it would refuse them' }),
  Object.freeze({ statement: 'prepectoral_over_SL <= prepelvic_over_SL', supported_on: { share: 0.6966, n: 4673 }, why_not: 'fin order along the body is not fixed' }),
  Object.freeze({ statement: 'predorsal_over_SL <= preanal_over_SL', supported_on: { share: 0.9758, n: 4673 }, why_not: 'a tendency. 2.4 % of real fish break it, and a gate must refuse nothing real' }),
]);

/** Near-strict and deliberately NOT gating, because 99.9 % is not 100 %. */
export const NOT_GATING_YET = Object.freeze([
  Object.freeze({ statement: 'prepelvic_over_SL <= preanal_over_SL', supported_on: { share: 0.9991, n: 4673 } }),
  Object.freeze({ statement: 'every along-body distance <= 1 standard length', supported_on: { share: 0.9998, n: 4673 } }),
]);

export const ENFORCEMENT_RULE =
  'a constraint gates only when its recorded support over a real sample is exactly 1. Anything less would ' +
  'refuse real animals, and a gate that rejects real fish is worse than no gate.';

/** True only for a constraint that cleared the control. Used by admit(), and worth calling directly. */
export function mayGate(c) {
  return Boolean(c && c.supported_on && c.supported_on.share === 1 && c.supported_on.n > 0 && typeof c.slack === 'function');
}

/**
 * Decide whether a design is admissible at all.
 *
 * Three outcomes, and the third is the one that is usually got wrong:
 *   admissible          every applicable constraint holds
 *   refused             a constraint is violated: this is not an animal, and no score should be reported
 *   not_applicable      the traits a constraint needs are absent. NOT a pass. An unmeasured design has not
 *                       cleared anything, and saying so is the difference between "checked" and "unchecked".
 */
export function admit(params, { constraints = GATING } = {}) {
  const checked = [], violations = [], skipped = [];
  for (const c of constraints) {
    if (!mayGate(c)) {
      skipped.push({ id: c.id, reason: `not cleared to gate: support ${c.supported_on ? c.supported_on.share : 'unrecorded'}`, is_a_pass: false });
      continue;
    }
    const have = c.traits.every(t => typeof params[t] === 'number' && Number.isFinite(params[t]));
    if (!have) {
      skipped.push({ id: c.id, reason: 'the design does not carry the traits this constraint needs', missing: c.traits.filter(t => typeof params[t] !== 'number'), is_a_pass: false });
      continue;
    }
    const slack = c.slack(params);
    checked.push({ id: c.id, slack: Number(slack.toFixed(6)) });
    if (slack < 0) violations.push({ id: c.id, statement: c.statement, plain: c.plain, by: Number((-slack).toFixed(6)), units: 'standard lengths' });
  }
  const admissible = violations.length === 0 && checked.length > 0;
  return {
    admissible,
    unchecked: checked.length === 0,
    checked, violations, skipped,
    refusal: violations.length
      ? `not an animal: ${violations.map(v => `${v.plain} (violated by ${v.by} standard lengths)`).join('; ')}. No plausibility score is meaningful for this design.`
      : null,
    note: checked.length === 0
      ? 'no constraint could be applied, so nothing was checked. This is not a pass.'
      : null,
    version: VERSION,
  };
}

/**
 * The intended call order. A score for an inadmissible design is not a small error, it is a category
 * error - it reports how fish-like something is that is not a fish - so the gate runs first and the
 * scorer is not consulted at all when it refuses.
 */
export function scoreIfAdmissible(params, scoreFn, opts = {}) {
  const gate = admit(params, opts);
  if (!gate.admissible) return { gate, score: null, refused: gate.refusal ?? gate.note };
  return { gate, score: scoreFn(params), refused: null };
}

export const HOW_TO_WIRE_THIS_IN =
  'sim-engine/validate/score.mjs belongs to another thread, so this module does not patch it. The change ' +
  'is to call admit() at the top of the scorer and return the refusal instead of a score when it fails. ' +
  'Until that happens this gate is available and unused, and the benchmark result stands: a design that ' +
  'is geometrically impossible still receives a plausibility score.';
