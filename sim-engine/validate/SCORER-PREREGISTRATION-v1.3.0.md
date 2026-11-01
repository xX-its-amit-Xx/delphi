# Pre-registration: scorer v1.3.0 (a joint, correlation-aware term)

Written 2026-11-01 before `SCORER_VERSION=1.3.0 node sim-engine/validate/dev-benchmark-v12.mjs` was run. v1.0.0,
v1.1.0, v1.1.1 and v1.2.0 and all their published results are left unchanged, and v1.2.0 stays frozen for the
evaluator's blind run. Tuned on `benchmark/dev` only; `heldout/` has not been read.

## The finding that motivates this version

v1.2.0 scored **AUC 0.498** against FishBase standard decoys: a coin flip. That is not a tuning failure, it is
structural. The benchmark's standard decoys take every trait from a specimen of another family, so each **marginal
stays exactly where real fish are** and only the **correlations between traits** are broken. A scorer built from
per-trait envelopes cannot see that, no matter how the envelopes are tuned, because every trait is individually
inside its envelope.

**Detecting shuffled synthetic organisms requires a joint model.** This is the one substantive change in v1.3.0.

## The change

Exactly one new term is added to P. Weights, floor, alpha, the 0.5 cut, the evidence map, the per-trait envelopes,
the definitional and organ rules, the Lean gate, the coverage factor and `rank_score` are all v1.2.0 unchanged,
reached through injection points in `score-v12.mjs` so v1.2.0's own behaviour is untouched.

**`p_joint`** (`joint.mjs`):
- A multivariate Gaussian on the **log10 trait vector**, fitted on benchmark **dev positives**.
- Two blocks, because the two large sources measure different traits: `fishshapes` (9 traits) and `fishbase`
  (10 traits). The block with more traits present is used, and the marginal sub-block covers whatever subset is
  present, with a minimum of 3 traits.
- **The design's own family is held out of the fit exactly**, by subtracting that family's stored sufficient
  statistics. Every `family:` entry in `reference_set_excluding` is held out. `genus:`, `species:` and `order:`
  entries do **not** remove a family from the fit; that is reported per call, not hidden.
- The statistic is the Mahalanobis distance, `q = D²/d`.
- **Calibration:** `q` of real dev positives under **leave-own-family-out**, stored as 101 quantiles per (block,
  dimension). So `p_joint` answers "how often is a real fish, whose family the model never saw, at least this far
  out?" Real fish have much fatter tails than a Gaussian would imply (q99 ≈ 5–7 against chi-square's ≈ 2.4), which
  is exactly why the calibration is empirical rather than analytic.
- `p_joint` enters P under the same alpha transform as the other calibrated p-values: `min(1, p/0.05)`.
- A ridge of 1e-8 × mean(diag) is added for numerical safety only.
- The term reports **which trait pair** is in an impossible combination, from the off-diagonal contributions to D²,
  alongside that pair's correlation among real fish. A low score is explainable.

## Why this option, and not the others

The coordinator offered three. I chose the Mahalanobis / Gaussian route because it is cheap, transparent and says
which correlation it breaks.

- **The generative flow-matching density** was not used. The earlier blockers are real and unchanged: its joint
  density includes head depth, which designs do not carry; its held-out split is by species, not family; and its
  own RESULTS reports a blow-up in the probability-flow likelihood tail. Forcing it would mean reporting a number I
  cannot stand behind.
- **Per-pair ratio envelopes** would be a weaker version of the same idea. The Mahalanobis form already covers
  every pair at once, and attributes the failure to a pair.

## Honest limits, stated before the numbers

- A Gaussian on log traits has one mode and no allometric curvature. It is a crude model of fish shape.
- It detects decoys **because they break the linear correlation structure**. A decoy that preserved that structure
  would not be caught.
- A real fish from an unusual family can sit far out. The calibration's own tail shows this: about 5 % of real dev
  positives are below p = 0.05 by construction, which is what a calibrated test means.
- The model is fitted on dev positives, so dev numbers are optimistic for this term. Family-held-out fitting and
  the blind run are the defence.

## What will be reported on dev

The benchmark's own endpoints (P1, P2, P3, S1, S2, S4) under leave-one-family-out, computed for `rank_score`,
`score` and v1.2.0 side by side, as for v1.2.0.

## Predictions

- **S1 rises well above 0.70.** Decoys break correlations and that is what the term reads. This is the criterion
  the version exists for.
- **S2 (hard negatives) rises but stays the weakest.** One swapped trait moves the vector much less than a full
  shuffle, and a percentile-corner chimera is extreme in every trait at once, so I expect corners to be caught and
  single swaps to be caught poorly.
- **P1 rises above 0.871.**
- **P3 may still fail.** It needs the median positive above the decoy 75th percentile, and with alpha-transformed
  terms many positives and some decoys both saturate at 1.
- **C1-type sensitivity falls slightly.** About 5 % of real fish sit in the joint tail by construction, so a few
  positives will lose their top score.
sha256 bac949e83129d91d4e7d1c83d0549ec6a91a36539cb30cfd350f6fc671aabe6e
