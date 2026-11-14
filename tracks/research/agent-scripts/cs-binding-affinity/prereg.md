# Pre-registration: binding-affinity noise ceiling, whole targets held out
Written 2026-11-14T04:17:57Z (shell `date -u`), BEFORE any activity data was downloaded in this run.

## Data
ChEMBL REST API, activity endpoint. Filters: standard_type=Ki, standard_relation "=", pchembl_value present, assay_type=B.
Roster: the 40 target ids in targets.py, copied unchanged from the earlier q2-data agent. At most the first 4000 rows per target (API default order).

## Held-out rule (cannot be tuned)
A target is HELD OUT if int(sha256(target_chembl_id), 16) mod 4 == 0. This gives 15 held-out and 25 development targets (computed from ids only).
No held-out target row is read by any development step. analyze.py --stage dev refuses to load held-out files. The held-out part is evaluated once (analyze.py --stage final).

## Law under test (Lean: tracks/research/lean/q2-theory-lean__Q2Theory.lean, Q2.pearson_attenuation, Q2.r2_target_only)
r(any predictor, one noisy measurement) <= sqrt(vy/(vy+s^2)) = sqrt(1 - s^2/var_obs), when predictor errors are uncorrelated with assay noise.
s = SD of one measurement, from cross-document replicate differences d of the same compound-target pair: s = sqrt(mean(d^2)/2).

## Frozen choices
- One value per (compound, target, document) = mean of its rows. Replicate pairs = all pairs of different documents for the same compound-target.
- PRIMARY s excludes pairs with |d| < 0.005 (likely re-citations of the same number). Secondary: all pairs. Robust: 1.4826*median|d|/sqrt(2).
- s is calibrated on development targets only. Label for a pair = mean over documents.
- Fingerprint: RDKit Morgan radius 2, 2048 bits. kNN: k=5 (mean of the 5 most Tanimoto-similar training compounds; training label for a compound = mean of its pair labels across development targets). k is fixed, not tuned.

## Predictions to be scored on the held-out targets (single final run)
P1 (noise transfers): held-out primary s is within +/-25% of development primary s.
P2 (ceiling holds): every model's pooled Pearson r on held-out targets is below the pooled ceiling sqrt(1 - s_dev^2/var_obs_heldout); mean within-target r below the mean within-target ceiling.
P3 (headline metric): pooled Pearson r, held-out targets, of ligand-only 5-NN trained on development targets only. Baselines: (a) constant = development grand mean (r undefined, RMSE reported); (b) leave-one-out target mean (knows the target, nothing about the compound).
P4 (leak contrast): 5-NN with a random within-target split of the held-out targets (5-fold) scores higher than P3; this is the leaky protocol.
P5 (broken-input control): the P3 scorer rerun with training labels shuffled (seed 0) must drop to |r| < 0.05; otherwise the test is broken.
P6: a published benchmark number above the ceiling is flagged as probable leakage. Published numbers come from other datasets (PDBbind/CASF), so this comparison is indicative only.
