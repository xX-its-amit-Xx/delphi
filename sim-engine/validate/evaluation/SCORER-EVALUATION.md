# Independent evaluation of the design scorer

This file is the evaluator's report on `designScore` (`sim-engine/validate/score.mjs`). The benchmark is the
pre-registered one in `sim-engine/validate/benchmark/` (`BENCHMARK-PREREGISTRATION.md`). The evaluator built neither
the scorer nor the benchmark, and did not edit either. Defects went to the hub, and none was patched here. Every run
is listed with its versions and hashes. Failures are kept.

The public page for these results is `dashboard/public/scorer/index.html`. It reads `data.json` (the latest run),
`data-w<version>.json` (one file per scorer version) and `versions.json` (the side-by-side table).

<!-- RESULTS:BEGIN -->
## Top line

**On held-out families scored family-out, scorer v1.0.0 adds nothing over raw nearest-neighbour distance.** Both
reach AUC 0.585. The difference is −0.0005, with a paired family-bootstrap 95 % CI of −0.014 to +0.015, and the
scorer beats the nearest-neighbour baseline in only 49 % of resamples. In this setting the five-component composite
is the nearest-neighbour distance and nothing more.

**It calls nearly everything plausible.** 99.5 % of real organisms score at or above 0.5. Only 12.0 % of negatives
score below it. Passing the test "existing organisms score high" is necessary but nowhere near sufficient, and this
is the proof: a scorer that returned 1.0 for every input would pass it too.

**Four of the five components do no work on this benchmark.** Moving any weight by ±20 %, alone or all together (200
draws), leaves the AUC at exactly 0.585. L (Lean), G (genotype) and E (evidence) are constant across the benchmark
items, and S (spec) never runs. All of the separation comes from P, and P is a thresholded transform of the
nearest-neighbour distance. Thresholding at p/0.05 loses information: the full scorer is slightly *better* than P
alone (+0.030, CI 0.017 to 0.046), but only because the composite floors and caps differ.

Verdict per BENCHMARK-PREREGISTRATION.md: **FAIL**. All three primary endpoints fail.

## Results, scorer v1.0.0 (run 2026-11-01T04-37-49Z_w1.0.0)

The run used:
- score-weights.json v1.0.0;
- score.mjs sha256 7c8bac18be34…;
- benchmark prereg sha256 b2586640… (matches PREREG.sha256);
- manifest ba6684e9….

It scored all 23,355 held-out labelled items under specimen-out, species-out and family-out, plus a stratified 12,044
of the 34,419 dev items (every type with 60 or fewer items kept whole). Genus-out was NOT RUN. Only 5
`organ_containment` items failed. They threw on an out-of-bounds partedit edit and were counted as worst case.

### Exclusion audit: PASS

- 61,490 nearest-reference returns were checked against the evaluator's own taxon index, with 0 violations.
- The canary is live: held-out item fs-00006, scored with no exclusions, returns itself
  (`fishshapes:150082:Ablabys_taenianotus`) at distance 0, and the audit trips.
- 94 FishShapes lots named in exclusion lists are absent from the scorer's references, so there was nothing to
  exclude. The scorer dropped those rows itself for missing mass or other core fields.

### Pre-registered endpoints (held-out, family-out unless stated)

| id | measured | threshold | result |
|---|---|---|---|
| P1 | FishShapes real vs FishShapes standard decoys: AUC 0.690 (family CI 0.678 to 0.701), 5,604 vs 4,097 | ≥ 0.75 and lower bound > 0.5 | **FAIL** |
| P2 | 26.8 % of 354 easy negatives score below the positives' 5th percentile, which is 1.000. Extrapolations 26 %; law-breakers 5/8, only because they score 0.95 to 0.98 against a percentile of 1.000; impossible combo 0/1; containment 0/3 | ≥ 90 % | **FAIL** |
| P3 | median FishShapes positive 1.000; 75th percentile of standard decoys 1.000 | median > p75 | **FAIL** |
| S1 | FishBase real vs FishBase decoys: AUC 0.500, exactly chance. Every FishBase item scores 1.0 because the scorer reads none of their traits | ≥ 0.70 | FAIL |
| S2 | hard negatives vs same-source positives: FishShapes 0.618, FishBase 0.500 | ≥ 0.60 | FAIL (the FishBase half) |
| S3 | P1 under specimen-out 0.697 vs family-out 0.690: gap 0.007 | ≤ 0.10 | PASS |
| S4 | 0 of 12 ontogeny stages score above the decoy median, which is 1.000 | ≥ 75 % | FAIL |
| S5 | the FishShapes 25th percentile is 1.000, so no specimen can score above it | all above | FAIL |
| S6 | Lean controls 0.948, 0.978 and 1.0 vs the highest law-breaker 1.0. The scorer has no input for flight claims | not below any law-breaker | FAIL |

S4, S5 and S6 fail by saturation: so many decoys score 1.0 that no real item can rank above them.

### Whole held-out set, all real vs all negatives

| split | ROC-AUC (family CI) | PR-AUC | real ≥ 0.5 | negatives < 0.5 |
|---|---|---|---|---|
| held-out, family-out | 0.585 (0.578 to 0.593) | 0.507 | 99.5 % | 12.0 % |
| held-out, species-out | 0.587 | 0.508 | 99.7 % | 11.8 % |
| held-out, specimen-out | 0.589 | 0.509 | 99.8 % | 11.7 % |
| dev, family-out | 0.621 | | 99.2 % | 17.3 % |

On held-out, family-out, restricted to items the scorer can read (5,601 real vs 5,623 negatives whose altered traits
include at least one it reads), the AUC is 0.693.

**By negative type** (held-out family-out; share scoring below 0.5):

| type | share below 0.5 | median score |
|---|---|---|
| chimera_extreme_corner | 41 % | 1.0 |
| decoy_shuffle_shape | 25 % | 1.0 |
| out_of_range_extrapolation | 23 % | 1.0 |
| decoy_shuffle_all | 9.5 % | 1.0 |
| decoy_shuffle_one | 8 % | 1.0 |
| law_breaker, impossible_combo, organ_containment | 0 % | 1.0 |

FishBase-built negatives are invisible to the scorer. They carry only body depth among the traits it reads, so the
body block does not run, P is dropped, and the score is L·G·E = 1.

### Baselines (held-out family-out; paired family bootstrap of the AUC difference)

| rule | AUC | scorer minus rule (95 % CI) |
|---|---|---|
| nearest-neighbour distance alone | 0.585 | −0.0005 (−0.014 to 0.015) |
| P alone | 0.553 | +0.030 (0.017 to 0.046) |
| Lean alone | 0.500 | +0.085 (0.077 to 0.094) |
| random | 0.499 | +0.086 (0.074 to 0.097) |

### Per taxon

168 held-out families were scored. Two families with at least 3 real items have fewer than 80 % of them scoring
plausible: Eurypharyngidae (gulper eels, 3/5) and Aspredinidae (banjo catfishes, 20/29). The low scorers are elongate
or extreme body plans whose nearest remaining relative, once their family is removed, is far away. Examples:
- fs-05942, a gulper eel, scores 0.15; its nearest is the cutlassfish *Lepturacanthus savala* at d 0.96;
- fs-01370, a banjo catfish, scores 0.15; its nearest is *Plotosus canius* at d 1.05.

These are benchmark-coverage limits of a nearest-neighbour method, not wrong labels: a body plan with no surviving
relative looks out of distribution. By order, the weakest separation from negatives is in Scorpaeniformes (0.49),
Lophiiformes (0.51) and Anguilliformes (0.52).

### Calibration

Read as P(real), the score is badly calibrated: ECE 0.48, Brier 0.47. 20,989 of 23,355 items fall in the top bin
[0.9, 1], and only 50 % of those are real.

### Stability

- Over 5 seeds of the scorer's species split, on a 1,890-item stratified held-out sample, P1's AUC ranges from 0.691
  to 0.704. The range of 0.013 is small.
- Weights ±20 %: AUC unchanged at 0.585 (see the top line). The share of real items at or above the cut ranges
  99.4 to 99.6 %.
- Recomputing the score with the frozen weights reproduces the scorer to within 1e-4.

### Attacks

- **Specimen space.** Of 1,500 random specimens, 933 break a hard rule, and 31 of those score ≥ 0.5. By rule:
  - H3, peduncle larger than the body maximum: 24 of 532 score plausible;
  - H1, fill factor above 1.1: 9 of 498;
  - H2, fill factor below 0.05: 0 of 135;
  - H4, a 1.5 SL pectoral fin on a fish over 5 kg: 0 of 6.

  **Best attack: score 1.0.** It is a 0.37 m, 53 g fish whose peduncle is 1.91× deeper and 1.54× wider than its own
  maximum body depth and width. Its nearest real relative is *Synaphobranchus affinis* at d 0.35. The scorer's own
  `range:log_ped_depth` and `range:log_ped_width` sanity checks fail on it but do not enter the score.
- **Unread traits.** 74 of 74 clearly implausible documents score plausible, at 0.92. This **confirms** the scorer
  agent's own C8 finding. An example: the flying fish with its dorsal rays cut to 0.28× and a body density of
  578 kg/m³ scores 0.92.
- The evaluator's hard rules hold for real data with a few exceptions, which should be noted. 15 of 16,377 FishShapes
  rows have a fill factor above 1.1 (up to 4.3), and 2 have a peduncle deeper than 1.05× the body. These are
  recording errors in the source, and the benchmark builder screened them out.

### Exploratory

- **Mutants vs their paired wild-type baseline:** the differences run from 0 to −0.035 (prdm1a tp39 −0.035, prdm1a m805
  −0.032, the rest 0). The scorer does not penalise viable real phenotypes, though it also barely reads them.
- **Own models** (unlabelled):
  - TFF 0.349, at the 0.2nd percentile of held-out positives;
  - the ff-zf chimera 0.82, limited by flight-muscle fit;
  - the other five 0.92.

### Defects reported to the hub (not patched)

1. **Absence = pass.** When the body block can't run, P is dropped rather than scored low. Every FishBase item, and
   every FishBase-built extrapolation (body depth at 2× the maximum), scores 1.0.
2. **Containment documents throw** (partedit bounds) instead of scoring as implausible.
3. **No genus key**, so genus-out was NOT RUN.
4. **No `lean_spec` input**, so flight claims never reach Lean and law-breakers score 0.95 to 1.0.
5. **Failed range and definitional checks don't enter the score.**
6. After v1.1.0, v1.1.1 and v1.2.0 were frozen, the shared `threeResults()` in score.mjs (sha256 a11e1311…) crashed on
   every specimen under versions 1.1.0 and 1.2.0 (`r.state_envelope.outside` undefined). Their blind runs waited for
   the fix.
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
| 2026-11-01T04-37-49Z_w1.0.0 | v1.0.0 (score-weights.json 761e59108b8f) | 7c8bac18be34 | b2586640 / ba6684e9 | held-out full x 3 splits, dev 12,044 stratified; results/2026-11-01T04-37-49-397Z_w1.0.0.json; rows C:/Temp/delphi-eval/ |
