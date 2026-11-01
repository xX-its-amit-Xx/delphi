# Pre-registration: validating the design scorer (`design_score`, scorer v1.0.0)

Written 2026-11-01 before `scorer-validation.mjs` was run, in either full or quick mode. The script refuses to run
unless the last line of this file is the sha256 of everything above it, so nothing here can move after a number
is seen. Deviations go in `SCORER-RESULTS.md` under "Deviations", and they never replace a result.

## What is being validated

The claim under test is that `design_score` (in `sim-engine/validate/score.mjs`, `SCORER` v1.0.0) gives real
organisms and real specimens high scores and gives designs that real biology rules out low scores. It is NOT a
claim that a high score means a design could exist.

## The scorer, frozen

There are five components, each in [0, 1].

- **P, phenotype plausibility.** P is the minimum of four terms:
  - `min(1, p_body/0.05)`
  - `min(1, p_fin_pectoral/0.05)`
  - `p_fin_envelope`
  - the flight-muscle organ fit (0 if partedit containment refused the design)

  `p_body` and `p_fin_pectoral` are empirical p-values of the distance to the nearest real neighbour
  (`phenotype.mjs`). They are calibrated as follows:
  - **Body.** Held-out-species FishShapes specimens, measured against the train pool. Species split seed
    20261101: 20 % calibration, 20 % test, 60 % train. The OOD threshold is the 99th percentile.
  - **Pectoral length.** Leave-one-group-out over the fin references.

  `p_fin_envelope` = exp(−max excess outside the fin-reference range). It is **uncalibrated**.
- **L, Lean.** L = 1 if no accepted-law binding violation is newly caused, relative to the design's leaf reference
  organisms, else 0. Candidate and contested violations are listed but not scored.
- **G, genotype sequence sanity.** G is the product over gene edits of:
  - 0 for a wrong reference residue, an out-of-range position, or an unparseable edit;
  - 0.5 for a conserved column (≥ 90 % of ≥ 8 rows) changed to a state that no real organism in the panel carries;
  - 1 otherwise.

  G = 1 when there are no gene edits. G is not a phenotype prediction.
- **S, spec.** S is the fraction of judged spec criteria met. It is used only when a spec is given. No spec is
  given in this validation, so S is excluded throughout.
- **E, evidence.** E maps the weakest provenance kind among the inputs read to a number: measured 1, derived 0.9,
  measured-secondhand 0.8, calibrated 0.7, borrowed 0.6, assumed 0.5. A FishShapes specimen is `measured`.

The components combine as

`score = exp(Σ w_i ln max(c_i, 0.01) / Σ w_i)`

over the components that ran, with weights P 0.35, L 0.25, G 0.15, S 0.15, E 0.10.

**Plausible means score ≥ 0.5.**

What follows from the formula:
- One zero in L or G caps the score near 0.2 or below.
- With E = 0.5 (our own organisms, many assumed parameters), plausible needs P ≳ 0.23.
- With E = 1, plausible needs P ≳ 0.13.

## Disclosure: what was seen before this was written

These numbers were seen during development:
- The four named designs: unedited zebrafish, winged zebrafish, TFF and the 50:50 chimera.
- Five ad-hoc negatives: flying fish with mass ×10, with SL ×3 at constant mass, with flight muscle 0.5 and with
  gill area ×0.05, and zebrafish with mass ×10.
- The calibration distribution.

The gill-area design scored 0.92. The scorer does not read gills, so a known hole exists before the start.

The alpha transform, `min(1, p/0.05)`, was added after reasoning that a raw p-value would make sensitivity
≈ 1 − (p cut-off) by construction. That reasoning used the calibration only, not any validation set. No validation
set below has been scored.

## Sets

**Positives** (should score plausible):

- **A1.** 300 FishShapes specimens drawn (seeded) from the 20 % **test** species split. Each is scored with its own
  species excluded from the references, using its measured SL, mass, depth, width and peduncle values. No
  calibration-species specimen is used.
- **A2.** Our 3 real organisms (zebrafish adult, zebrafish larva, flying fish), each with its **own lineage
  excluded** from the references.
- **A3.** Every ontogeny stage age of the zebrafish and of the flying fish, with its own lineage excluded.
- **A4.** 14 real lab mutants, scored without excluding their own species:
  - kcnk5b alf W169L/+ and F241Y
  - slc43a2a lat4a nr21 T200K/+
  - kcnh2a lfr1 Y669N, lfr2 L739Q and WL7 Y418*, plus the longfin t2 inversion
  - gja1b j7e1 F30V, tl28d W78L and dmh35 G138D
  - prdm1a m805 W154*
  - the Daane 2021 winged-zebrafish double heterozygote (the repository design plus its two edits)
  - hhip uki Y285* larva with pectoral area +65 % at 72 hpf
  - prdm1a tp39 larva with pectoral length −30 % at 4 dpf

  Prediction, stated now: **prdm1a m805 W154* will fail G.** Its numbering does not match the canonical Ensembl
  protein (sequences/README.md), so the scorer will call it a wrong reference residue. That counts as a scorer
  failure on a real mutant.

**Negatives** (should score implausible):

- **N1, Lean breakers** (5). Flying fish with SL ×3, ×2 or ×0.4 at constant mass, and with mass ×8 or ×0.1 at
  constant SL.
- **N2, organs that do not fit** (4). Zebrafish with flight muscle at 0.30 or 0.50 of mass. Flying fish with flight
  muscle at 0.30, and at 0.16 on the unchanged body.
- **N3, allometric impossibilities** (8):
  - zebrafish mass ×10 and ×0.1
  - zebrafish depth/SL ×3 and width/SL ×4
  - zebrafish pectoral length ×6 and caudal lobes ×4
  - flying fish pectoral span ×3 and peduncle depth fraction ×3
- **N4, held-out synthetic perturbations** (300). Other test-species specimens with one body feature, chosen at
  random, moved 0.5 × the observed range beyond the FishShapes minimum or maximum (in log10). Moving SL keeps
  mass/SL³ fixed.

## Criteria

Each criterion passes or fails as written.

| id | criterion |
|---|---|
| C1 | ≥ 90 % of A1 score plausible |
| C2 | all of A2 score plausible |
| C3 | ≥ 90 % of A3 score plausible |
| C4 | ≥ 80 % of A4 score plausible |
| C5 | ≥ 90 % of all negatives score implausible, and every negative family N1–N4 ≥ 80 % |
| C6 | AUC, all positives against all negatives, ≥ 0.90 |
| C7 | Over 5 species-split seeds (20261101, 11, 22, 33, 44), with 100 test specimens against 100 mass ×12 or ÷12 perturbations each: AUC range ≤ 0.05, and relative SD of the body OOD threshold ≤ 10 % |
| C8 | A random search over 300 edited designs finds **no** design that is clearly implausible by the predicate below and still scores plausible |

The C8 predicate is fixed now. A design is clearly implausible if any of these holds:
- a ray count or the vertebra count is scaled ≥ 3× or ≤ 1/3
- gill area ≤ 0.1×
- Hb P50 ≥ 10× or ≤ 0.1×
- red muscle ≥ 0.9 of the myotome
- body density < 800 or > 1500 kg/m³
- head length ≥ 2.5× or ≤ 0.4×

The search draws 1–3 edits from a fixed list on a zebrafish or flying-fish base, with seed 20261200.

**Predictions, stated now:**
- C8 will **FAIL**: the scorer reads none of these quantities.
- C4 is at risk from prdm1a m805.
- N1 depends on the Lean laws evaluating at all, and most cannot from STATE.

## Also reported

These have no pass/fail:
- AUC per negative family
- sensitivity per positive family
- a calibration table (fraction of positives per score bin)
- the five stability runs
- up to 25 adversarial failures, kept in full

Every row is written to `scorer-results.json`.

## Not tested

- The spec component S.
- partedit mesh containment, which needs the browser.
- Physiology, development and behaviour.
- Birds: excluded everywhere as the frozen holdout.
sha256 839c3bfef7c8e9c2b0f4b16ac53cdb87c991b56b0e91678239f52a0d726dc28e
