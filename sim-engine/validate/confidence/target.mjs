// WHAT A CONFIDENCE SCORE WOULD PREDICT THE ERROR OF. Written down before anything is fitted.
//
// ============================== WHY THIS FILE IS FIRST ==============================
// pLDDT works because lDDT is well defined: a bounded scalar computable from a prediction and a
// reference, with a known random baseline near 0.20 for unrelated topologies. Nothing in this repository
// defines the analogue, and until it is written down there is nothing to calibrate against - a
// calibration curve needs a thing on the x axis.
//
// This file exists so that the choice is a RECORDED DECISION rather than whatever the first
// implementation happened to compute. It is hashed, dated, and it states what it refuses to claim.
//
// ============================== THE SUPERVISION GAP, IN NUMBERS ==============================
// pLDDT is a regression head trained against experimental structures: the PDB with a maximum release
// date of 2018-04-30, a window containing 139,403 entries and 122,770 protein-only ones (counted from
// the RCSB search API, because neither AlphaFold paper states a training-structure count - the widely
// repeated ~170,000 is not in them). Its published calibration is a regression of true on predicted
// accuracy, lDDT-Ca = 0.997 x pLDDT - 1.17, r = 0.76 over n = 10,795 chains.
//
// This project has ZERO outcome labels. Not few: none. Every label in the benchmark is "is this trait
// vector a real animal or a shuffled decoy" (10,749 positives against 12,606 synthetic negatives), which
// is a strictly easier question than "will this design work". So the honest first signal cannot be a
// probability of success, and this file says which quantity it IS about instead.
//
// ============================== THE CEILING TO AIM BELOW ==============================
// On 614 experimentally characterised de novo designed monomers (269 successful, 43 %), pLDDT-class
// metrics separate success from failure at ROC AUC 0.60-0.72 - AlphaFold3 pLDDT worst at 0.60 - with no
// transferable threshold, because the distributions are topology-dependent (doi 10.1002/pro.70453). That
// is the best-supervised confidence score in structural biology, asked the question a design pipeline
// actually asks. Any number this project publishes should be read against 0.60-0.72, not against pLDDT's
// r = 0.76 on a different question.

import crypto from 'node:crypto';

export const CANDIDATES = [
  {
    id: 'morphometric-residual',
    quantity: 'the signed residual of a designed trait vector against a matched real counterpart, per trait',
    needs: 'a matched real animal per design, and a defensible matching rule',
    what_it_would_be_calibrated_against: 'nothing yet: the current benchmark has no designs with measured counterparts',
    why_not_chosen: 'it is what the existing scorer secretly computes (a Mahalanobis distance in log-trait space), so adopting it as the target would make the confidence score a restatement of the thing being evaluated.',
  },
  {
    id: 'phenotype-appeared-in-f0',
    quantity: 'a binary: did the predicted phenotype appear in the injected generation, scored blind',
    needs: 'lab results. One per arm per clutch.',
    what_it_would_be_calibrated_against: 'returned lab observations, through sim-engine/validate/bench/return.mjs',
    why_not_chosen_yet: 'it is the RIGHT target and it is unavailable: there are zero lab results. It is recorded here as the target the register is built to collect, so that the first 22 observations land in a calibration set rather than in an inbox.',
  },
  {
    id: 'inside-the-real-envelope',
    quantity: 'a per-design INSIDE/OUTSIDE call against the distribution real animals occupy, at a stated miscoverage rate alpha',
    needs: 'nothing new: the leave-one-family-out empirical quantile tables already exist, frozen, at sim-engine/validate/data/joint-calibration.v1.3.0.json',
    what_it_would_be_calibrated_against: 'real specimen and trait records, 10,694 and 7,100 of them, each scored with its OWN FAMILY held out of the fit',
    chosen: true,
    why_chosen:
      'it is the only one of the three that can be computed TODAY with a finite-sample guarantee, and the ' +
      'guarantee is about a quantity that genuinely exists: the fraction of real animals whose score falls ' +
      'below a threshold. It makes no claim about success, and it cannot be mistaken for one if it is ' +
      'always reported as a coverage statement rather than a number between 0 and 1.',
  },
];

export const CHOSEN = CANDIDATES.find(c => c.chosen);

export const WHAT_IT_IS = {
  statement:
    'For a design and a miscoverage rate alpha, an INSIDE or OUTSIDE call against the distribution of ' +
    'q = D^2/d over real animals, where the threshold is the empirical (1 - alpha) quantile of that ' +
    'distribution computed with each real animal\'s own family held out of the fit.',
  guarantee:
    'Split conformal gives finite-sample marginal coverage 1 - alpha <= P(a real animal is called INSIDE) ' +
    '<= 1 - alpha + 1/(n+1), under exchangeability alone and with no model assumption.',
  units: 'a call, plus the threshold and the design\'s own q. Never a probability.',
};

export const WHAT_IT_IS_NOT = [
  'NOT a probability that the design works. Nothing in this repository has ever been built, so no such number can be calibrated.',
  'NOT a probability that the design is biologically possible. The reference set is real animals that EXIST, and a thing can be possible without existing.',
  'NOT comparable to pLDDT. pLDDT predicts the error of a structure against a solved structure; this predicts membership in a distribution of measured animals.',
  'NOT valid per design class. Conditional coverage is impossible in general (Angelopoulos & Bates, arXiv:2107.07511), so an INSIDE call for one design says nothing about the next one of its kind.',
  'NOT valid under the exchangeability it formally requires. A designed organism is not drawn from the distribution of museum specimens. This is the deepest caveat and it does not go away with more data: see EXCHANGEABILITY below.',
  'NOT a substitute for the evaluability scorecard. design-validation/scorecard.json records that 9 of 10 pre-registered phenotypic axes cannot be scored at all, and an INSIDE call on the traits that CAN be scored says nothing about the nine that cannot.',
];

export const EXCHANGEABILITY = {
  what_is_required: 'that the design and the calibration points are exchangeable - loosely, that the design could have been one of the real animals.',
  why_it_is_violated: 'a designed organism is constructed to sit somewhere no real animal sits. That is the point of designing it. So the one assumption the guarantee rests on is violated by the act of using it.',
  what_is_still_true:
    'the threshold itself. "95 % of real fish have q below 3.07 at d = 5" is a measured fact about real ' +
    'fish and survives the violation intact. What does not survive is reading the design\'s side of the ' +
    'comparison as a probability. So the output is always phrased as: this design is inside/outside the ' +
    'region where N % of real animals fall.',
  what_would_repair_it: 'nothing available. Weighted conformal prediction handles a known covariate shift, and the shift here is not known - it is the design intent, which is different for every design.',
};

/** The freeze. A target quantity chosen after seeing results is not a pre-registration. */
export function hash() {
  const payload = JSON.stringify({ CANDIDATES, CHOSEN: CHOSEN.id, WHAT_IT_IS, WHAT_IT_IS_NOT, EXCHANGEABILITY });
  return { sha256: crypto.createHash('sha256').update(payload).digest('hex'), bytes: payload.length };
}

export const PREREGISTRATION = {
  written: '2026-11-07',
  chosen_target: CHOSEN.id,
  before_any_number_was_computed: true,
  how_to_verify: 'node -e "import(\'./sim-engine/validate/confidence/target.mjs\').then(t=>console.log(t.hash()))" and compare against the sha256 recorded in any report that cites this target.',
  what_would_invalidate_this_file:
    'editing it after a calibration number exists. The repository\'s rule for score-weights.json applies ' +
    'here with the same force: never edit in place, add a version. A target quantity quietly adjusted to ' +
    'make a result look better is the one failure that would make every number downstream worthless.',
};
