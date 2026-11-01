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
