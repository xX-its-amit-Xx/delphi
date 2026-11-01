# Does the design scorer work? Results of the pre-registered validation

This report covers scorer **v1.0.0**. Pre-registration: `SCORER-PREREGISTRATION.md`, sha256 `839c3bfef7c8e9c2b0f4b16ac53cdb87c991b56b0e91678239f52a0d726dc28e`,
hashed 2026-11-01T04:12:53Z, before any validation set was scored. The weights are in `score-weights.json`
(v1.0.0). The data are in `scorer-results.v1.0.0.json`: every scored row, the calibration table, the stability runs
and the adversarial failures.

v1.1.0 will be reported below, beside v1.0.0. v1.0.0 results are never overwritten.

## The honest sentence

**v1.0.0 separates real fish from out-of-range designs on the shape features it reads: AUC 0.94, and 98.7 % of
held-out real species score plausible. It fails four of eight pre-registered criteria.**

- **It calls real zebrafish larvae implausible** once their own lineage is left out, because no real larva is in
  the reference data.
- **It misses a fifth of the negatives.** A feature pushed out of range can be masked by reference specimens that
  never measured that feature.
- **Almost any implausibility it does not read gets through.** 120 of the 121 clearly implausible adversarial
  designs scored plausible: ray counts, gill area, haemoglobin, body density and head length are invisible to it.

## Criteria

| id | criterion | result | value |
|---|---|---|---|
| C1 | ≥ 90 % of held-out **test-species** FishShapes specimens plausible (n = 300) | **PASS** | 98.7 % (4 fail: *Indostomus paradoxus* 0.15, *Chilomycterus spinosus* 0.19, *Ptilichthys goodei* 0.19, *Scolecenchelys gymnota* 0.47, all extreme body plans) |
| C2 | all 3 real organisms plausible with their **own lineage excluded** | **FAIL** | 2/3. The zebrafish larva scores 0.14: its nearest real body is a flying-fish hatchling, at a distance beyond every held-out adult |
| C3 | ≥ 90 % of ontogeny stages plausible, own lineage excluded | **FAIL** | 83 % (10/12). Zebrafish at 0 d and 3 d fail for the same reason |
| C4 | ≥ 80 % of real lab mutants plausible (n = 14) | **PASS** | 92.9 %. **prdm1a m805 W154\* failed (0.41), as predicted**: the allele's numbering refers to another isoform, so G = 0 for a "wrong reference residue". A real mutant scored down for a bookkeeping reason |
| C5 | ≥ 90 % of negatives implausible, and every family ≥ 80 % | **FAIL** | 82.3 % overall. N1 Lean breakers 100 %; N2 organs that do not fit 75 %; N3 allometric 75 %; N4 synthetic beyond-range 82.3 % |
| C6 | AUC, all positives vs all negatives, ≥ 0.90 | **PASS** | 0.937 |
| C7 | 5 split seeds: AUC range ≤ 0.05, threshold relative SD ≤ 10 % | **PASS** | AUC range 0.0001; threshold 0.547–0.603 (relative SD 3.6 %) |
| C8 | adversarial search finds no clearly-implausible design that scores plausible | **FAIL** | 300 searched; 121 clearly implausible by the predicate; **120 of those scored plausible** |

Four of eight pass. The failures stay in this report.

## What failed, and why

**N4: one feature beyond range, masked.**
- All 53 N4 misses moved a **peduncle** feature, depth or width.
- The body block needs only 4 shared features. A reference specimen with no peduncle measurement (about 1 % of
  FishShapes) therefore matches on the other four at near-zero distance. The extreme feature is skipped, not
  penalised.
- The same mechanism let "flying fish, peduncle depth ×3" score 0.92.
- **Fix for v1.1:** score over the shared subset, and count each missing feature as a fixed penalty instead of
  ignoring it.

**N3: fins.**
- "Zebrafish, pectoral fin length ×6 (0.93 SL)" scored 0.79. The uncalibrated fin envelope uses a scale of 0.32 in
  log10, about a factor of 2, so 0.93 against a reference maximum of 0.705 costs only exp(−0.37).
- Fin scoring is weak because FishShapes has no fins. Our only fin references are two lineages and nine Daane 2021
  beloniform medians.

**N2: a muscle budget 27 % met still scores plausible.**
- "Flying fish, flight muscle 0.16 (the TFF value) on the unchanged body" has P = 0.27 and scores 0.53.
- By the frozen formula, with E = 0.5, P ≈ 0.27 is not enough to cross 0.5. This consequence was stated in the
  pre-registration.

**C2 and C3: larvae.**
- FishShapes is adult museum specimens. A zebrafish larva with its own lineage excluded has only flying-fish
  hatchlings as larval neighbours, and they are far away.
- This is a gap in the reference data, not evidence about the larva.

**C8: the scorer reads 6 body features, the pectoral length, the 7 other fin ratios (envelope only) and the
flight-muscle budget. Nothing else.**
- Examples that scored **0.92**:
  - zebrafish with caudal rays ×0.23
  - zebrafish with body density 602 kg/m³, vertebrae ×0.25 and gill area ×0.08
  - flying fish with vertebrae ×0.22
- This failure was **predicted in the pre-registration**. It is the most important one: a design can hide any
  implausibility in a field the scorer ignores.

**Lean decides almost nothing.**
- N1 passed (100 %) only because SL changes at fixed mass trigger C7b and E2, which also move the body block.
- For every zebrafish-based design, every law is out of scope or cannot evaluate.
- **L is close to a constant 1** outside flying-fish scaling edits.

## Also reported (no pass/fail)

- **Sensitivity by positive family:** A1 0.987 · A2 0.667 · A3 0.833 · A4 0.929.
- **AUC by negative family** (against all positives): N1 0.997 · N2 0.980 · N3 0.980 · N4 0.935.
- **Calibration** (score bin: positives / negatives):

  | score bin | positives | negatives |
  |---|---|---|
  | [0, 0.2) | 6 | 228 |
  | [0.2, 0.4) | 0 | 17 |
  | [0.4, 0.5) | 2 | 16 |
  | [0.5, 0.6) | 1 | 6 |
  | [0.6, 0.8) | 2 | 13 |
  | [0.8, 1] | 318 | 37 |

  Scores are not probabilities: 37 negatives sit in the top bin.
- **Stability across five species splits** (100 test specimens against 100 mass ×12 or ÷12 perturbations each):
  - AUC 0.9999–1.000
  - sensitivity 0.99–1.00
  - specificity 0.99

  These perturbations are easier than N4.

## Deviations

1. **The first full run had a bug in the Aves filter.** It matched genus stems such as *psittac-* and *columb-*, and
   dropped 17 real fish specimens (*Scarus psittacus*, *Catostomus columbianus* and four other species) from the
   references. No bird was involved. After the regex was fixed to class and order names, the run was repeated.
   - Run 1 is kept in `scorer-results.run1-aves-filter-bug.json`.
   - Same pass/fail pattern: C1 99.3 %, C2 0.667, C3 0.833, C4 0.929, C5 0.795, C6 0.930, C7 pass, C8 120/121.
   - The table above is run 2.
2. **Added after the pre-registration, for the independent evaluator; none changes the v1.0.0 numbers above:**
   - `reference_set_excluding` accepts `family:` and `order:` entries.
   - The Daane-only fin references are labelled with their families.
   - The weights moved verbatim into `score-weights.json`.

## Not done

- **The flow-matching body likelihood** (`sim-engine/generative`) is not in v1.0.0, for three reasons:
  - Its density is joint over 7 features including head depth, which designs do not carry.
  - Its held-out split is by species, not family.
  - Its own RESULTS reports a blow-up in the probability-flow likelihood tail.
- **The spec component S** was not tested.
- **partedit mesh containment** was not tested; it needs the browser.
- **Birds** are excluded everywhere (frozen holdout).

<!-- V11:BEGIN -->
## v1.1.0, beside v1.0.0

Pre-registration: `SCORER-PREREGISTRATION-v1.1.0.md`, sha256 on its last line, hashed before the run. The weights
are in `score-weights.v1.1.0.json` and the data in `scorer-results.v1.1.0.json`. **This run is not blind.** v1.1.0
was built after reading every v1.0.0 failure on these same sets, as the pre-registration discloses. The real test
of v1.1.0 is the independent evaluator's run on the benchmark builder's frozen set, including
`benchmark/heldout/`, which I have not read.

| id | criterion | v1.0.0 | v1.1.0 |
|---|---|---|---|
| C1 | held-out test-species specimens plausible ≥ 90 % | PASS 98.7 % | PASS 98.7 % |
| C2 | 3 real organisms plausible, own lineage excluded | FAIL 2/3 | **FAIL** 2/3 (zebrafish larva 0.45, was 0.14) |
| C3 | ontogeny stages plausible ≥ 90 %, own lineage excluded | FAIL 83 % | **FAIL 75 %** (worse: flying fish at 10 d now fails too) |
| C4 | real mutants plausible ≥ 80 % | PASS 92.9 % | PASS 85.7 % (worse: the prdm1a tp39 larva, pectoral length −30 %, now falls below the tighter fin envelope) |
| C5 | negatives implausible ≥ 90 %, every family ≥ 80 % | FAIL 82.3 % | **PASS 91.5 %** (N1 100 %, N2 100 %, N3 87.5 %, N4 91.3 %) |
| C6 | AUC ≥ 0.90 | PASS 0.937 | PASS **0.994** |
| C7 | seed stability | PASS | PASS |
| C8 | no clearly implausible adversarial design scores plausible | FAIL 120/121 | **FAIL 2/121** |

v1.0.0 passed 4 of 8; v1.1.0 passes 5 of 8.

**What v1.1.0 fixed:**
- **Negatives.** C5 now passes, and AUC rose from 0.94 to 0.99.
- **The top score bin is clean.** In v1.0.0 it held 318 positives and 37 negatives; now it holds 317 positives and
  2 negatives.
- **Adversarial designs.** These now nearly all fail, but by construction: the STATE envelopes bound exactly the
  fields the C8 predicate uses.

**What it did not fix, or made worse:**
- **Larvae (C2, C3).** The uncalibrated larval envelope (two lineages, widened ×/÷1.5) is too tight. A zebrafish
  hatchling judged only against flying-fish larvae scores 0.45. The flying fish at 10 d now fails as well.
  - **The underlying problem is unchanged:** there is no real larval reference data beyond our own two lineages.
  - A sourced larval morphometric set (Parichy 2009 stages for zebrafish, plus other species) is what is needed. A
    wider factor would only be tuning to this set.
- **Peduncle masking (N4) is only partly fixed.** 26 of 300 N4 negatives still pass, all peduncle features.
  - A peduncle value beyond range costs z² ≈ (0.5 range / scale)², averaged over 6 features.
  - For some specimens that stays under the 99th-percentile threshold.
  - Tighter feature-wise range checks would catch them. The phenotype sanity check already flags them as failed;
    it does not enter the score.
- **Adversarial: 2 survivors.** Both are gill area ×0.08 (flying fish 0.65; zebrafish with section exponent ×1.13,
  0.56). The gill envelope is widened ×/÷1.5 below the 7-species minimum, which is trout at 155 mm²/g. A ×0.08
  gill lies only about 0.1 decade beyond it. The predicate's threshold (≤ 0.1×) is stricter than the envelope.
- **A real fin mutant now fails (C4).** The tighter fin envelope rejects the prdm1a tp39 hypomorph larva.
  **Tightening the fins traded one false negative for one false positive.**
- **Zebrafish pectoral ×6 (0.93 SL) still scores 0.60.** The extended 0.823 bound leaves it only 0.05 decade
  outside.

**Both versions stay callable** (`designScore(design, {version})`). v1.0.0 is the default because it is the version
whose validation was blind.
<!-- V11:END -->

## functional_resolution: the fourth named result, and why it stays out of the composite

`functional_resolution` is exposed beside `genotype_similarity`, `phenotype_similarity` and `lean_check`, in
`designScore` and in `validate_design` (`result.results`), and on the Validate panel. The ledger is built by
another thread in `sim-engine/validate/functional/`; I consume it through `validate/functional-interface.mjs`,
which states the shape, validates what comes back, recomputes the counts from the rows so a module summary cannot
disagree with its own entries, and reports "did not run" when the module is absent. Nothing is assumed in its
place.

**Where I will not put it: inside the composite score or `rank_score`.** I agree with the coordinator, and the
reasons are measurable rather than stylistic.

1. **Thin-data terms have already cost real organisms in this scorer.** When I added the larval envelope from two
   lineages in v1.1.0, C3 got *worse*, 83 % to 75 %. When I tightened the fin envelope, a real mutant (prdm1a tp39)
   lost its plausible status. Both were honest attempts to add a signal from sparse data, and both produced false
   negatives on real biology. The functional ledger is sparser still.
2. **A sparse component breaks ranking in a way the number hides.** The composite renormalises the weights over the
   components that actually ran. A design with a ledger would therefore be scored on a different weighting from one
   without, so the two scores would not be comparable — and ranking synthetic designs is the whole purpose. This is
   exactly why `S` is excluded when no spec is given.
3. **It would let a hypothesis pay for a gap.** If a resolution raises the score, then asserting "this difference
   could be compensated" raises the score, and a design with an unexplained gap scores *higher* by adding a
   hypothesis. That is the v1.2.0 "absence = pass" failure in a worse form: not absence passing, but a claim paying
   for absence. A compensation decision rule narrows this but cannot close it, because the rule's evidence base is
   the transcriptional-adaptation literature in zebrafish, not in the analogue.
4. **Coverage, not the resolved fraction, is the honest headline.** There is no flying-fish transcriptome or
   proteome, and about 9 focal genes are mapped against 4 571 in the vetted map. A resolved fraction computed over
   9 genes would be precise and close to meaningless.

**Where it does belong:** beside the score, as a gate, exactly like the Lean gate. `functional_gate_failed` is true
when any difference is UNRESOLVED, and the gate string says the design is not functionally accounted for whatever
the similarity scores say. A gate changes the verdict's wording and not the ranking, so it cannot distort a
comparison between designs.

**What would change my mind,** and the conditions I would want on it: a new version with its own pre-registration
hashed first; only demonstrated classes counted, never COMPENSATORY; a coverage floor below which the component
does not run at all, so it cannot be gamed by classifying one easy difference; and a benchmark negative family that
specifically exercises function, showing the term moves AUC without costing real organisms plausible status. Until
there is a negative set it can be shown to catch, folding it in would be tuning against a hope.


## v1.3.0: shuffled synthetic organisms cannot be caught without a joint model

Pre-registration: `SCORER-PREREGISTRATION-v1.3.0.md`, sha256 `bac949e8...`, hashed before the run. Weights:
`score-weights.v1.3.0.json`. Model: `joint.mjs`, `data/joint-model.v1.3.0.json`,
`data/joint-calibration.v1.3.0.json`. Dev only; `heldout/` not read. v1.2.0 is untouched and still frozen for the
blind run.

### The finding, stated plainly

**Detecting a shuffled synthetic organism requires a joint model. No set of per-trait ranges can do it, however
well tuned.**

The benchmark's standard decoys take each trait from a specimen of a different family. Every marginal therefore
sits exactly where real fish sit, and only the **correlations between traits** are broken. A scorer assembled from
per-trait envelopes asks only "is each trait a value a real fish could have?", and for these decoys the answer is
yes for every trait. v1.2.0 scored **AUC 0.498 against FishBase decoys**: a coin flip, from 25 envelopes and
20 traits. That is a structural limit of marginal checks, not a tuning shortfall.

This matters beyond the benchmark. A generative model that gets every trait distribution right and the
*correlations* wrong produces organisms that a marginal scorer calls plausible. Scoring synthetic designs needs a
term that reads the joint structure.

### What v1.3.0 adds

One term, `p_joint`: the Mahalanobis distance of the log10 trait vector under a Gaussian fitted on dev positives,
with the design's **own family held out of the fit exactly** (by subtracting that family's sufficient statistics).
Calibrated empirically against real fish under leave-own-family-out, because real fish have far fatter tails than a
Gaussian implies (q99 about 5-7 against chi-square's 2.4). It reports **which trait pair** is in an impossible
combination, with that pair's correlation among real fish, so a low score is explainable.

Everything else is v1.2.0 unchanged, reached through injection points so v1.2.0's behaviour is untouched.

### Dev results, leave-one-family-out, 5 410 items, `rank_score`

| endpoint | threshold | v1.2.0 | **v1.3.0** |
|---|---|---|---|
| P1 FishShapes positives vs decoys, AUC | >= 0.75 | 0.871 | **0.897** |
| P2 easy negatives below the positives' 5th percentile | >= 90 % | 100 % | **100 %** (all four types) |
| P3 median positive above the decoy 75th percentile | pass | **fail** (0.860 vs 1.000) | **pass** (0.819 vs 0.655) |
| S1 FishBase positives vs decoys, AUC | >= 0.70 | **0.498** | **0.823** |
| S2 hard negatives, AUC | >= 0.60 | **0.538** | **0.641** |
| S4 ontogeny stages above the decoy median | >= 75 % | 75 % | **100 %** |
| distinct values among 5 410 rows | | 1 310 | **5 064** (94 %) |
| real positives still scored plausible | | 99.2 % | 98.7 % |

Every pre-registered threshold is met on dev. The cost is as predicted and small: 0.5 % of real positives lose
plausible status, because a calibrated test puts about 5 % of real fish in its own tail and some of those fall
below the cut.

**My predictions, scored honestly.** S1, S2, P1 and the sensitivity cost came out as predicted.
I predicted **P3 may still fail**; it passed, because the joint term moved the decoy 75th percentile down from
1.000 to 0.655. The prediction was wrong in the favourable direction.

### Limits that remain

- **A Gaussian on log traits is a crude model of fish shape:** one mode, no allometric curvature. It catches these
  decoys *because they break the linear correlation structure*. A decoy preserving that structure would pass.
- **Hard negatives are still the weakest** (S2 0.641). A single swapped trait barely moves the vector. The corner
  chimeras are caught; single swaps are caught poorly.
- **Dev is optimistic for this term**, since the model is fitted on dev positives. Family-held-out fitting is the
  defence, and the blind held-out run is the test.
- **Fins and physiology are not in the joint model.** No large source measures paired-fin size, so fins keep their
  small-sample envelopes.
- **The flow-matching density was not used.** Its blockers are unchanged and real: head depth is in its joint
  density but not in designs, its split is by species rather than family, and its likelihood tail is unstable.


### Deviation 3: a crash in the shipped entry point, and how the dev numbers were produced

**The bug.** `threeResults` in `score.mjs` read `r.state_envelope.outside.map(...)` behind a truthiness check only.
`stateEnvelope()` returns `{ran: false, reason}` with **no `outside`** for any specimen-shaped item, because a
specimen has no resolved STATE. Every specimen-shaped benchmark item therefore threw a `TypeError`: under v1.1.0 it
propagated, and under v1.2.0 it was caught and returned `score: null`. The independent evaluator found it on
held-out items of every type and refused to launch the blind run, which was the right call: benchmark rules would
have scored those items worst-case, making the run meaningless rather than a legitimate failure.

A test now calls `designScore` on a bare `{specimen}` **and** a `{params}` item under every version (1.0.0, 1.1.0,
1.1.1, 1.2.0) and asserts a numeric score. Against the pre-fix file **7 of those 8 combinations failed**; only
v1.0.0 with a specimen survived, because v1.0.0 never builds a state envelope. The same audit guarded
`ph.fin.nearest[0]`, `alt.in_natural_orthologues`, `e.checks` and `c.verdicts`, which had the same shape.
`three-results-guards` tests the guards directly and is seen to fail when `state_envelope.outside` throws.

**No version bump and no weights change.** This is a crash fix in a reporting function. Scores, components, weights
and the 0.5 cut are untouched.

**One input-handling change, stated because it is not purely a fix:** a `{params}` item is now accepted by every
version (its traits are mapped to the specimen record, and the unread ones are returned as
`traits_not_read_by_this_version`). Before, `{params}` threw "not an organism document" under 1.0.0, 1.1.0 and
1.1.1, so no previously published number can have come from that path.

**How the dev numbers were produced, and whether they stand.** The evaluator was right to ask: the dev run called
`designScoreV12` in `score-v12.mjs` **directly**, and it ran **before** `threeResults` existed, so it never
exercised the shipped path. The run was therefore repeated through `score.mjs designScore` after the fix, and
`dev-benchmark-v1.2.0.json` now records `scored_through: "score.mjs designScore (the shipped entry point)"`. Every
headline number is **identical**: P1 0.870798, P2 100 percent, S1 0.498, S2 0.538, S4 75 percent, 1310 distinct
values, 4 refused, 0 errors. The dev numbers stand, and they now come from the path the evaluator will call.

`score.mjs` sha256 after the fix: `87bb335e262bddd5fd73355b831d5b0539c4b5083929782a2f25cf7e26817a7f`


## v1.1.1: a ranking score (`rank_score`); the score is unchanged

Pre-registration: `SCORER-PREREGISTRATION-v1.1.1.md`. Weights: `score-weights.v1.1.1.json`. Data:
`scorer-results.v1.1.1.json`.

**The defect.** Under leave-lineage-out scoring, zebrafish, flying fish and the winged zebrafish all score exactly
0.9217. The cause:
- P = min(1, p/0.05) is capped at 1 whenever p > 0.05. The raw p-values were 0.45, 0.24 and 0.45 under v1.0.0, and
  0.06, 0.08 and 0.06 under v1.1.0.
- L, G and S are all 1: no law evaluates, there are no gene edits, and no spec is given.
- E is the *weakest* input kind, which is "assumed" = 0.5 for every repository organism.

Hence 0.9217 = exp(0.1 ln 0.5 / 0.85). There were only 60 distinct scores across the 646 v1.0.0 rows, and 9 among
the 300 held-out specimens, 290 of which scored exactly 1. **The score is a pass/fail classifier, not a ranker.**

**The fix.** `rank_score` uses the raw P parts (geometric mean, no alpha cap, no min) and the *mean* evidence kind.
Leave-out examples: zebrafish 0.70, flying fish 0.77, winged zebrafish 0.75, chimera 0.69, TFF 0.20.

| id | criterion | result |
|---|---|---|
| C1–C8 | must equal v1.1.0 | identical (checked) |
| R1 | ≥ 90 % of rows have a distinct `rank_score` | **FAIL**, 51 % |
| R2 | rank AUC ≥ the v1.1.0 score AUC | **FAIL**, 0.991 vs 0.994 |
| R3 | Spearman(rank_score, nearest-neighbour distance) ≤ −0.5 on held-out specimens | PASS, −1.0 |

**On R1.** Many negatives sit at the 1e-4 floor, and the repository designs repeat.

**On R3.** The −1.0 is exact because, for a specimen, the raw body p-value is the only term that varies. **A ranking
by typicality alone.**

## v1.2.0: the evaluator's defects fixed; dev-benchmark results

Pre-registration: `SCORER-PREREGISTRATION-v1.2.0.md`, sha256 `5c1b3ce1…`. Code: `score-v12.mjs`. Weights:
`score-weights.v1.2.0.json`. Envelopes: `data/trait-envelopes.v1.2.0.json`, built from dev positives only. The
held-out run belongs to the independent evaluator. **I have not read `heldout/`.**

Dev partition, leave-one-family-out, 1 000 items per group, every easy negative and every ontogeny stage
(`dev-benchmark-v1.2.0.json`, 5 410 items). Thresholds are the benchmark's own (`BENCHMARK-PREREGISTRATION.md`).

| endpoint | threshold | v1.0.0 score | v1.2.0 score | v1.2.0 **rank_score** |
|---|---|---|---|---|
| P1 FishShapes positives vs decoys, AUC | ≥ 0.75 | 0.747 | 0.738 | **0.871** |
| P2 easy negatives below the 5th percentile of positives | ≥ 90 % | 31.6 % (organ_containment 0 %, impossible_combo 0 %) | 100 %* | **100 %** (all four types) |
| P3 median positive above the decoy 75th percentile | pass | fail | fail | **fail** (0.86 vs 1.0) |
| S1 FishBase positives vs decoys, AUC | ≥ 0.70 | 0.50 | 0.50 | **0.50** |
| S2 hard negatives, AUC | ≥ 0.60 | 0.557 | 0.555 | 0.538 |
| S4 ontogeny stages above the decoy median | ≥ 75 % | 0 % | 0 % | 75 % |
| distinct values in 5 410 rows | | 118 | 128 | 1 310 |

\* Under `score` the positives' 5th percentile is 1.0, so "below p5" only means "not exactly 1".

**Fixed:**
- **Absence passing.** Easy negatives (2×/3×/5× extrapolations, flight claims that break laws, organs that cannot
  fit, impossible combinations) all rank below the 5th percentile of positives. Before, 32 % did.
- **Refused edits.** These now score 0.01. Four organ-containment docs were refused this way.
- **Leave-out.** genus leave-out is available.
- **Flight claims.** They reach Lean. Only claim-caused accepted violations count, so real Park & Choi specimens
  score 1.0 and the same specimens with impossible claims score 0.26.

**Not fixed:**
- **FishBase decoys (S1 = 0.50).** The scorer sees FishBase traits only through per-trait envelopes. A shuffled
  decoy keeps every marginal inside its envelope, and the scorer has no joint model of FishBase traits, so it is
  blind there.
- **P3.** Pooled decoys reach rank_score 1.0 at the 75th percentile: the FishBase decoys again.
- **Hard negatives (S2 ≈ 0.54).** One swapped trait, or a percentile-corner chimera, is close to invisible.
- **Next step: a joint model for FishBase traits** (nearest neighbour or density on the 10 MORPHMET ratios, built
  from dev positives with family leave-out). That is v1.3 work.
- **Envelopes and dev positives.** Dev positives sit inside their own envelopes by construction, so dev P2 and P3
  are optimistic for the envelope terms. The blind held-out run is the test.

**Deviation.** Before the full dev run, a 20-per-group crash test of `dev-benchmark-v12.mjs` printed numbers. It was
kept, not used, and is in the session scratchpad.

