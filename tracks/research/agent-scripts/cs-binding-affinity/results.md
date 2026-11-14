# cs-binding-affinity — noise ceiling vs trivial baselines, whole TARGETS held out

Data fetched 2026-11-14 from the ChEMBL REST API (`activity.json`, standard_type=Ki, relation "=",
pchembl present, assay_type=B, max 4000 rows/target), 40 targets from the earlier q2-data roster.
Raw JSON: `C:/Temp/delphi-sprint/cs-binding-affinity/raw` (6.9 MB). Pre-registration: `prereg.md`
(written 2026-11-14T04:17:57Z, before any download). Final held-out run: 2026-11-14T04:21:29Z.

Split rule (untunable): target held out iff sha256(target_chembl_id) mod 4 == 0 -> 15 held out, 25 development.
One of the 15 returned 0 rows and one returned 5, so 14 held-out targets carry data, 12 have >= 30 pairs.

## Numbers

| quantity | development (25 targets) | held out (14 targets) |
|---|---|---|
| compound-target pairs | 34,165 | 33,826 |
| cross-document replicate pairs (non-identical) | 20,226 | 13,339 |
| s, SD of one measurement (pKi) | 0.622 | 0.546 (ratio 0.88) |
| fraction of replicate pairs that are identical numbers | 0.575 | 0.654 |
| fraction of non-identical replicate pairs differing > 1 log | 0.174 | 0.138 |
| SD of labels (pooled) | 1.237 | 1.320 |
| pooled attenuation ceiling sqrt(1 - s_dev^2/var_obs) | 0.864 | 0.882 |
| mean within-target ceiling | 0.837 | 0.865 (range 0.787-0.926) |
| between-target share of variance | 0.141 | 0.038 |

Held-out models (single final evaluation, Pearson r, n = 33,826 pairs / 14 targets;
CI = 1000 bootstraps resampling whole targets):

| model | pooled r | 95% CI | mean within-target r | RMSE |
|---|---|---|---|---|
| 5-NN Morgan/Tanimoto, ligand only, trained on development targets | **0.164** | [-0.001, 0.306] | 0.146 | 1.534 |
| same, training labels shuffled (broken-input control) | 0.004 | [-0.013, 0.018] | -0.011 | 1.441 |
| constant = development grand mean (7.084) | undefined | — | — | 1.331 |
| leave-one-out target mean (knows the target, nothing about the compound) | 0.193 | [0.092, 0.257] | — | 1.296 |
| 5-NN with a RANDOM within-target split (the leaky protocol) | **0.824** | [0.790, 0.847] | 0.799 | 0.753 |

Similarity stratification of the honest 5-NN: r = 0.0007 (n = 12,282) where the nearest training
compound has Tanimoto < 0.4, r = 0.244 (n = 21,544) where it is >= 0.4. 32% of held-out pairs involve
a compound that also appears (against a different target) in training.

Replicate sanity check on held-out targets: one document's value vs another document's value for the
same compound-target pair, r = 0.954 (n = 2,132 pairs) -> implied ceiling sqrt(r) = 0.977 for that
(better-replicated, wide-range) subset. So the ceiling depends strongly on which replicate subset you
take: 0.88 from the squared-difference estimator, 0.98 from the replicate correlation.

## Reading

1. Held-out-target ceiling is ~0.88 pooled / ~0.79-0.93 per target. Nothing here comes close: the best
   honest model is 0.16. Noise is NOT what binds.
2. The same fingerprint model with a random within-target split scores 0.824 — a factor of 5 in r from
   the split alone, and that leaky number sits just under the ceiling, which is exactly how a leaked
   benchmark looks "almost optimal".
3. Published CASF-2016 numbers quoted in the earlier repo agents (ligand-only bias baseline r 0.76,
   ML scoring functions 0.74-0.82, CleanSplit-trained 0.75-0.80) all sit under the ceilings computed
   here, so the ceiling does not by itself prove leakage; the evidence for leakage is the split contrast
   (0.82 vs 0.16) and their own peptide/ligand-bias-free holdouts (r 0.17-0.41).

Full numbers: `dev_results.json`, `final_results.json`. One command: `bash run_all.sh`.
