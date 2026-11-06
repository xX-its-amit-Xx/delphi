// HOW MANY ANIMALS, AND WHEN WE REFUSE TO SAY.
//
// ============================== WHY THIS FILE EXISTS ==============================
// Every route in sop.mjs ends on the same gate: "the comparison was powered before the embryos were
// injected", and `if_not` reads "a null result is uninterpretable and the experiment answered nothing".
// Until now this package asserted that gate without being able to pass it: an audit of the bench package
// on 2026-11-05 found that the word "power" appeared only as a gate and as a cost driver, and that no case
// computed a sample size. A gate nothing can satisfy is decoration.
//
// So this file computes N where the literature supplies what a computation needs, and REFUSES where it
// does not - naming the one missing quantity rather than substituting a conventional effect size. A
// refusal here is the useful output: it converts "we need to power this" into "we need exactly this
// number, from exactly this source, and it is a data request rather than an experiment".
//
// ============================== WHAT THIS IS NOT ==============================
// Not a statistical consultation. The formulas are the standard normal-approximation ones, stated in full
// so a statistician can disagree with the choice rather than reverse-engineer it. Nothing here is a
// substitute for the test the lab will actually run, and for the small counts involved an exact test is
// usually the right one - which the output says on every line where it applies.

export const PURPOSE =
  'Compute animals-per-arm where published numbers allow it, and refuse by naming the missing quantity ' +
  'where they do not. Standard normal-approximation formulas, written out. Not a statistical consultation.';

export const CONVENTIONS = {
  alpha: { value: 0.05, kind: 'CONVENTION - OURS', why: 'the field default. Stated because it is a choice: a two-sided 0.05 is not a law of nature and a pre-registration should name it.' },
  power: { value: 0.8, kind: 'CONVENTION - OURS', why: 'the field default. 0.9 roughly multiplies N by 1.34 for the same effect, which is the honest way to describe the cost of wanting to be more sure.' },
  two_sided: { value: true, kind: 'CONVENTION - OURS', why: 'two-sided even where a direction is predicted, because a result in the unpredicted direction is a finding and a one-sided test discards it.' },
};

// ---------------------------------------------------------------------------------------------------
// Inverse standard normal CDF. Acklam's rational approximation, refined by one Halley step so the
// returned quantile is accurate to better than 1e-12 - which matters not for the statistics but so that
// a reader re-running these numbers in R or Python gets the same digits back.
// ---------------------------------------------------------------------------------------------------
const A = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const B = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
const C = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const D = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

function erfc(x) {
  // Numerical Recipes' incomplete-gamma-free rational approximation; |relative error| < 1.2e-7.
  const z = Math.abs(x), t = 2 / (2 + z);
  const ty = 4 * t - 2;
  const cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3,
    -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
    1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
    -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13,
    3.81e-16, 7.106e-15];
  let d = 0, dd = 0;
  for (let j = cof.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + cof[j]; dd = tmp; }
  const ans = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd);
  return x >= 0 ? ans : 2 - ans;
}
const normCdf = x => 0.5 * erfc(-x / Math.SQRT2);

export function zQuantile(p) {
  if (!(p > 0 && p < 1)) throw new Error(`zQuantile needs 0<p<1, got ${p}`);
  const pLow = 0.02425;
  let x;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5, r = q * q;
    x = (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q /
        (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  // one Halley refinement against the CDF
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return +(x - u / (1 + x * u / 2)).toPrecision(12);
}

/** The 95 % upper bound on a rate when ZERO events were seen in n trials: the rule of three.
 *  0/240 does not mean "the rate is 0"; it means "the rate is below about 1.25 %". */
export function ruleOfThree(n) {
  if (!(n > 0)) return null;
  return {
    observed: `0/${n}`,
    upper_95_bound: +(3 / n).toPrecision(4),
    as_percent: +((3 / n) * 100).toPrecision(3),
    why: 'for zero events in n independent trials the one-sided 95 % upper confidence bound on the rate is approximately 3/n. Using 0 as the control rate in a power calculation makes the comparison look easier than it is; using 3/n is the conservative read of the same data.',
    formula: '3/n',
  };
}

/** Two independent proportions, normal approximation with the pooled-variance alpha term. */
export function nForTwoProportions({ p1, p2, alpha = 0.05, power = 0.8, two_sided = true, label = null }) {
  for (const [k, v] of Object.entries({ p1, p2 })) if (!(v >= 0 && v <= 1)) throw new Error(`${k} must be a proportion, got ${v}`);
  const za = zQuantile(1 - alpha / (two_sided ? 2 : 1));
  const zb = zQuantile(power);
  const pbar = (p1 + p2) / 2;
  const term1 = za * Math.sqrt(2 * pbar * (1 - pbar));
  const term2 = zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  const delta = Math.abs(p1 - p2);
  if (delta === 0) return { refused: true, why: 'p1 equals p2, so no sample size detects the difference' };
  const nRaw = Math.pow(term1 + term2, 2) / Math.pow(delta, 2);
  const n = Math.ceil(nRaw);
  const smallest_expected_count = Math.min(n * p1, n * (1 - p1), n * p2, n * (1 - p2));
  return {
    label,
    n_per_arm: n,
    n_per_arm_exact: +nRaw.toPrecision(5),
    assumptions: { p1, p2, alpha, power, two_sided },
    formula: 'n = [ z_(1-alpha/2) * sqrt(2 * pbar * (1-pbar)) + z_(1-beta) * sqrt(p1(1-p1) + p2(1-p2)) ]^2 / (p1-p2)^2, with pbar = (p1+p2)/2',
    z_values: { 'z_(1-alpha/2)': +za.toPrecision(6), 'z_(1-beta)': +zb.toPrecision(6) },
    smallest_expected_count: +smallest_expected_count.toPrecision(3),
    use_an_exact_test: smallest_expected_count < 5,
    use_an_exact_test_because: smallest_expected_count < 5
      ? `the smallest expected cell count is ${smallest_expected_count.toPrecision(3)}, below the usual 5 at which the normal approximation is trusted. Use Fisher's exact test, and expect it to need slightly MORE animals than this number, not fewer.`
      : null,
  };
}

/** Two independent means, equal n, from a standardised effect size (Cohen's d). */
export function nForTwoMeans({ d, alpha = 0.05, power = 0.8, two_sided = true, label = null }) {
  if (!(Math.abs(d) > 0)) return { refused: true, why: 'a standardised effect size of zero is not detectable at any n' };
  const za = zQuantile(1 - alpha / (two_sided ? 2 : 1));
  const zb = zQuantile(power);
  const nRaw = 2 * Math.pow(za + zb, 2) / Math.pow(d, 2);
  return {
    label,
    n_per_arm: Math.ceil(nRaw),
    n_per_arm_exact: +nRaw.toPrecision(5),
    assumptions: { d, alpha, power, two_sided },
    formula: 'n = 2 * (z_(1-alpha/2) + z_(1-beta))^2 / d^2, where d = (mean1 - mean2) / pooled SD',
    z_values: { 'z_(1-alpha/2)': +za.toPrecision(6), 'z_(1-beta)': +zb.toPrecision(6) },
    note: 'a normal-approximation formula: for n below roughly 20 per arm add one or two animals for the t-distribution, or run the exact calculation.',
  };
}

// ---------------------------------------------------------------------------------------------------
// WHAT IS MISSING, PER CASE. Each refusal names ONE quantity and where it would come from, so that the
// gap is actionable. The common shape: the DIRECTION is published and the DISPERSION is not.
// ---------------------------------------------------------------------------------------------------
export const MISSING_QUANTITIES = {
  'kcnk5b-f0-finbud': {
    readout: 'continuous - pectoral fin bud area normalised to eye area at 48 hpf',
    what_is_published: 'the direction only: "fin buds of kcnk5b-targeted embryos were reduced in size by 48 hpf"',
    the_one_missing_quantity: 'the standard deviation of the bud-area/eye-area ratio in control embryos, and the mean difference',
    where_it_would_come_from: 'Jiang et al. 2024 S4 Data (doi 10.1371/journal.pbio.3002565). The main text and figure legends give no mean, SD, n or p for this comparison; the per-comparison values are in the source data file only.',
    this_is_a_data_request_not_an_experiment: true,
    what_it_would_unlock: 'the cheapest informative experiment in the package - a two-day readout with a powerable comparison. Until then this case can be run but its null result would mean nothing.',
  },
  'kcnk5b-alf-knockin': {
    readout: 'continuous - an allometric coefficient (a regression slope), measured on CAUDAL fins',
    what_is_published: 'two point estimates and their R^2: wild type k = 1.29 (R^2 = 0.92), alf/+ k near 2 (R^2 = 0.95), p < 0.001',
    the_one_missing_quantity: 'a standard error on the allometric coefficient, or the per-animal residuals behind the regression',
    where_it_would_come_from: 'Perathoner et al. 2014 Fig. 1D states NO n at all, because it is a regression across development rather than a group comparison. The n = 4 in that figure belongs to panel 1C, a different measurement on a different fin. There is no published dispersion for this coefficient.',
    second_problem: 'the coefficient is for CAUDAL fins and the design claim is about PECTORAL fins, so even a powered caudal replication tests the design only by extrapolation across appendages.',
    this_is_a_data_request_not_an_experiment: false,
    what_it_would_unlock: 'nothing on its own: this case needs a cross either way, so the power question is downstream of a seven-month commitment.',
  },
  'hhip-knockout-radials': {
    readout: 'integer counts - radial bones, ventral hypurals',
    what_is_published: 'the direction and the wild-type value: four pectoral radials in wild type, more in mutants; ventral hypurals two to five; n = 5 mutant and 5 wild-type adult skeletons',
    the_one_missing_quantity: 'the PENETRANCE - what fraction of homozygous mutants show the altered count. With a binary per-animal call and a penetrance, this becomes a proportions calculation and needs very few animals.',
    where_it_would_come_from: 'Tanaka et al. 2024 (doi 10.1242/dev.202526), or any lab that has the line. Integer counts with no overlap between genotypes are the EASIEST readout to power - the obstacle is purely that the proportion was not reported.',
    this_is_a_data_request_not_an_experiment: true,
    what_it_would_unlock: 'a powered skeletal comparison, though still behind two generations of crosses.',
    also: 'the paper reports adult skeletons are often fused and unrecognisable, which costs scorable animals and must inflate whatever N the calculation gives.',
  },
  'kcnh2a-knockout': {
    readout: 'continuous - fin length',
    what_is_published: 'a NULL result: homozygous loss has no overt effect on fin length',
    the_one_missing_quantity: 'an EQUIVALENCE MARGIN - how large a difference in fin length would count as "not no effect"',
    where_it_would_come_from: 'nobody. This is not a data request: a margin is a judgement about what difference matters biologically, and it has to be declared by the people running the experiment before they look.',
    this_is_a_data_request_not_an_experiment: false,
    why_it_matters: 'powering a study to CONFIRM a null is a different calculation from powering one to detect a difference, and it is impossible without a margin. A conventional-looking "n = 20 per group" here would be a number with nothing behind it.',
  },
};

/** Power what can be powered. Returns a computation or a refusal naming the missing quantity. */
export function powerFor(caseId, { alpha = 0.05, power = 0.8 } = {}) {
  if (caseId === 'kcnk5b-overexpression-f0') {
    const control = ruleOfThree(240);
    const primary = nForTwoProportions({
      p1: 0.40, p2: control.upper_95_bound, alpha, power,
      label: 'overgrowth rate in kcnk5b-overexpressing fish vs the marker-only control',
    });
    const specificity = nForTwoProportions({
      p1: 0.40, p2: ruleOfThree(32).upper_95_bound, alpha, power,
      label: 'overgrowth rate in kcnk5b-overexpressing fish vs the conductance-dead (GFG->AAA) control',
    });
    return {
      powerable: true,
      why_this_one_and_not_the_others:
        'because both of its comparison arms have PUBLISHED RATES, and a rate is all a proportions ' +
        'calculation needs. Every other case in the package has a published direction and an unpublished ' +
        'dispersion, which is exactly the thing a power calculation cannot do without.',
      control_rate: control,
      specificity_control_rate: { ...ruleOfThree(32), context: 'no overgrowth in n = 32 fins containing DsRed-positive tissue' },
      treatment_rate: { value: 0.40, source: 'Perathoner et al. 2014: "In about 40% of the fish injected with plasmids encoding wild type or mutant kcnk5b and showing DsRed positive cells in the fins"', kind: 'measured' },
      primary_comparison: primary,
      specificity_comparison: specificity,
      n_per_arm_to_use: Math.max(primary.n_per_arm, specificity.n_per_arm),
      and_now_the_part_that_bites: {
        what_n_counts: 'N is SCORABLE ADULTS THAT CARRY FIN-EXPRESSING CLONES, not injected embryos.',
        two_unpublished_fractions_sit_between_them: [
          'the fraction of injected embryos that survive to adulthood in this lab, on this mix - unpublished for this route, which is why the plan records the survival curve rather than assuming one',
          'the fraction of surviving adults that show DsRed-positive cells IN THE FINS - the published 40 % is conditioned on this, and the conditioning fraction itself is not published',
        ],
        consequence:
          `so ${Math.max(primary.n_per_arm, specificity.n_per_arm)} per arm is a floor on the number of ` +
          'ANIMALS SCORED, and the embryos to inject is that number divided by two fractions nobody has ' +
          'published. A first session should inject generously and measure both fractions, which then make ' +
          'every later session plannable. That measurement is itself a publishable number.',
        a_cheap_way_to_de_risk_it: 'score the larval DsRed rate in a pilot clutch, which bounds the second fraction from above and costs one clutch and one afternoon.',
      },
      honest_caveat:
        'the overgrowth call is subjective and patchy. A proportions calculation assumes a clean binary ' +
        'per-animal call, so the plan requires blind scoring and a recorded disagreement rate between ' +
        'scorers. If scorers disagree on a fifth of the animals, this N is optimistic.',
    };
  }
  const missing = MISSING_QUANTITIES[caseId];
  if (!missing) return { powerable: false, refused: true, why: `no power analysis is recorded for case "${caseId}"` };
  return {
    powerable: false,
    refused: true,
    why: `this comparison cannot be powered yet: ${missing.the_one_missing_quantity} is not published.`,
    ...missing,
    what_we_refuse_to_do:
      'substitute a conventional effect size (a "medium d = 0.5", or a round n = 20 per group) to make the ' +
      'gate pass. A sample size derived from a convention rather than from this system\'s own numbers would ' +
      'look identical to a real one in the plan, and would be the single most dangerous number in it.',
  };
}
