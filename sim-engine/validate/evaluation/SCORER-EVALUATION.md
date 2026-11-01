# Independent evaluation of the design scorer

This file is the evaluator's report on `designScore` (`sim-engine/validate/score.mjs`). The benchmark is the
pre-registered one in `sim-engine/validate/benchmark/` (`BENCHMARK-PREREGISTRATION.md`). The evaluator built neither
the scorer nor the benchmark, and did not edit either. Defects went to the hub, and none was patched here. Every run
is listed with its versions and hashes. Failures are kept.

The public page for these results is `dashboard/public/scorer/index.html`. It reads `data.json` (the latest run),
`data-w<version>.json` (one file per scorer version) and `versions.json` (the side-by-side table).

<!-- RESULTS:BEGIN -->
(filled in after each run; see "Runs" below)
<!-- RESULTS:END -->

## Protocol, as run

- **What the scorer sees.** Each item's `params` are mapped onto the scorer's specimen record. The fourteen params it
  reads are SL, mass, depth/SL, width/SL, peduncle depth and width fractions, and the pectoral, pelvic, dorsal, anal
  and caudal fin ratios. Items that carry a `doc` are passed as organism documents. Nothing else is passed: no taxon,
  label, subset, donors or exclusion. Params the scorer has no input for are dropped and reported, never imputed. The
  scorer also has no input for `lean_spec`, so flight claims never reach it.
- **Splits.** Each item is scored under specimen-out, species-out and family-out. The benchmark's own
  `item.exclusion` lists are passed through `reference_set_excluding`:
  - FishShapes museum lots are translated to the scorer's reference ids.
  - Zebrafish, flying-fish and Park & Choi specimens map to the scorer's repository lineages.

  **Genus-out is NOT RUN.** The scorer's leave-out matcher has no genus key, and `splits.json` says to report such a
  split as NOT RUN rather than substitute another.
- **Exclusion audit.** For every scored item the evaluator takes the nearest reference the scorer returned (body block
  and fin block). It looks up that reference's species and family in its **own** index, parsed directly from the data
  files (`reference-index.mjs`, not the scorer's matcher), and asserts that the reference is:
  - not the item itself or its repository lineage;
  - under species-out, not of any excluded species;
  - under family-out, not of any excluded family.

  Any hit makes the run exit with code 2. A canary runs first: one held-out FishShapes positive is scored with no
  exclusions, and the audit must catch it (nearest = itself at distance 0). If the canary does not trip, the run aborts.
- **Failures.** An item that throws or returns no score takes the worst case, per the pre-registration: the lowest
  observed score for a positive, the highest for a negative. The count of failures per type is reported.
- **Statistics.**
  - ROC-AUC is Mann-Whitney with ties counted as 0.5. PR-AUC is average precision with tied scores taken as one block.
  - 95 % CIs come from a family-cluster bootstrap: 1000 resamples, seed 1, using base families for negatives and one
    cluster per synthetic item without a family.
  - Proportions get Wilson intervals.
  - Calibration bins treat the score as P(real). That depends on the benchmark's class mix, so read it as a shape.
- **Baselines** are computed on the same items and the same exclusions:
  - nearest-neighbour distance alone (minus the scorer's own body or fin nearest distance);
  - component P alone;
  - component L (Lean) alone;
  - random.

  The scorer is compared with each by a paired family bootstrap of the AUC difference.
- **Stability.**
  - Seeds: a fixed, stratified 8 % sample of the held-out set is rescored under 5 seeds of the scorer's species split
    (`phenotype.useSeed`), which changes its calibration and its train pool.
  - Weights: each weight is scaled ×0.8 and ×1.2 on its own, and then all five together over 200 random draws within
    ±20 %. Scores are recomputed from the scorer's own component values. As a check, recomputing with the frozen
    weights reproduces the scorer's score.
- **Adversarial search** (`adversarial.mjs`), two parts:
  - **A. Specimen space.** 1500 random specimens over the seven numbers the body block reads, kept only if they break
    a hard rule fixed before running:
    - H1: fill factor mass / (1000 kg/m³ × SL × depth × width) > 1.1, which would mean denser than a water-density
      box enclosing the fish;
    - H2: fill factor < 0.05;
    - H3: peduncle deeper or wider than 1.05 × the body maximum, which contradicts the definition of a maximum;
    - H4: pectoral fin longer than 1.5 SL on a fish heavier than 5 kg.

    The five highest-scoring designs are then hill-climbed while staying inside the violating region.
  - **B. Unread traits.** 150 random edit sets on the zebrafish or flying fish, touching gills, Hb P50, ray and
    vertebra counts, density, red muscle and head length. They are judged by the SCORER-PREREGISTRATION C8 predicate,
    re-implemented from its text, as an independent replication of the scorer agent's own C8 count.
- **No Aves data** is used anywhere. Neither the benchmark nor the scorer's references hold any birds.

## Runs

| run | weights | score.mjs sha256 | benchmark prereg / manifest | note |
|---|---|---|---|---|
