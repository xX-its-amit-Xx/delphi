# Pre-registration: scorer v1.1.0

Written 2026-11-01 before `SCORER_VERSION=1.1.0 node sim-engine/validate/scorer-validation.mjs` was run. The script
refuses to run unless the last line of this file is the sha256 of everything above it. v1.0.0 and its results
(`SCORER-PREREGISTRATION.md`, `scorer-results.v1.0.0.json`, `SCORER-RESULTS.md`) are left unchanged. Both versions
stay callable through `designScore(design, {version})`.

## What changed from v1.0.0

The weights are frozen in `score-weights.v1.1.0.json`. Weights, floor, alpha, the 0.5 cut and the evidence map are
unchanged from v1.0.0. Only the P component is redefined:

1. **Missing-feature masking (the C5/N4 failure).**
   - In the body block, a reference that lacks a feature the design has now adds z² = 1 per missing feature.
     Before, the reference was matched on the shared subset alone.
   - The RMS is taken over the design's feature count, with minShared 3.
   - The OOD calibration is recomputed with the same rule, on the same held-out calibration species.
2. **Larvae (the C2/C3 failure).** For a design whose stage is embryo, hatching or larva, the body block is an
   envelope over the larval ontogeny-stage references of every lineage not excluded, widened ×/÷1.5 in log10.
   - p = exp(−excess / 0.05 decades). It is used directly, with no alpha.
   - It is **uncalibrated**: two lineages only.
3. **Fins (the C5/N3 failure).** The fin envelope's excess is now in units of 0.05 log10, replacing the
   cross-reference scale of about 0.3. The pectoral-length upper bound becomes 0.823, the flying-fish specimen
   maximum (Daane 2021, n 49, quoted in `design-validation/REPORT.md`). Before, it was the largest median, 0.705.
4. **STATE envelopes (the C8 failure).** P gains a `p_state` term. Every STATE field that can be bounded from repo
   data is checked against an envelope widened by a factor fixed in `sanity.mjs STATE_ENVELOPES`, with
   p = exp(−max excess / 0.05 decades). The fields:
   - gill area per kg (7 species)
   - Hb P50 (1 species, ×/÷3)
   - body density
   - red muscle fraction
   - routine metabolic rate
   - vertebra and ray counts (adult only)
   - head fraction
   - section exponent
   - flight-muscle fraction

   **Several envelopes rest on one or two species and are narrow by construction.** A real fish outside them, such
   as an eel's vertebra count, would be flagged.

The flow-matching body likelihood (`sim-engine/generative`) is **not** in v1.1.0, for three reasons:
- Its density is joint over 7 features, including head depth, which designs lack.
- Its held-out split is by species, not by family.
- Its RESULTS reports a blow-up in the likelihood tail.

It is deferred, not faked.

## Disclosure: this validation is not blind

v1.1.0 was designed **after** reading every v1.0.0 failure on these same sets. Changes 1–4 target those failures,
and the C8 predicate's fields are exactly the ones the STATE envelopes now bound. Passing C2, C3, C5 or C8 here is
therefore **weak evidence**; for C8 it is close to true by construction.

The real test is the independent evaluator's run on the benchmark builder's frozen set, including
`sim-engine/validate/benchmark/heldout/`. I have not read that set and will not.

Seen before hashing, for development only: the v1.1.0 scores of the four named designs.

| design | v1.0.0 | v1.1.0 |
|---|---|---|
| zebrafish | 0.92 | 0.92 |
| winged zebrafish | 0.92 | 0.92 |
| TFF | 0.35 | 0.14 |
| chimera | 0.82 | 0.82 |

## Sets, criteria, thresholds

Identical to `SCORER-PREREGISTRATION.md`, including the seeds and sample sizes:

| id | criterion |
|---|---|
| C1 | ≥ 90 % of A1 score plausible |
| C2 | all of A2 score plausible |
| C3 | ≥ 90 % of A3 score plausible |
| C4 | ≥ 80 % of A4 score plausible |
| C5 | ≥ 90 % of all negatives score implausible, and every family ≥ 80 % |
| C6 | AUC ≥ 0.90 |
| C7 | seed stability |
| C8 | adversarial |

## Predictions, stated now

- **C8 passes, or nearly passes.** This is by construction, as disclosed above.
- **C1 may drop below v1.0.0's 98.7 %.** The missing-feature penalty can push real specimens with a missing
  peduncle value outward.
- **C2/C3 depend on whether a zebrafish larva lies within ×/÷1.5 of the flying-fish larval stages** once its own
  lineage is excluded. I do not know.
- **C4 still fails on prdm1a m805.** The numbering problem is unchanged.
- **Every A3 juvenile and adult stage passes the STATE envelopes** (counts are checked on adults only).

Results go in `scorer-results.v1.1.0.json` and in a v1.1.0 section of `SCORER-RESULTS.md`, beside v1.0.0.
sha256 94dc405787140d7ca46a6d83031bada8c083319ab91b4bc51921180791011311
