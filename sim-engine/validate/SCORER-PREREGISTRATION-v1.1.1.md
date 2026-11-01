# Pre-registration: scorer v1.1.1 (a ranking score)

Written 2026-11-01 before `SCORER_VERSION=1.1.1 node sim-engine/validate/scorer-validation.mjs`. v1.0.0 and v1.1.0
and their results are left unchanged.

## The defect

The core agent found it, and I confirmed it before writing this. The `score` of v1.0.0 and v1.1.0 cannot rank
plausible designs. Under leave-lineage-out scoring, zebrafish, flying fish and the winged zebrafish all score
exactly 0.9217. The breakdown shows why:

- **P saturates.** P = min(min(1, p/0.05), ...) is exactly 1 whenever the nearest-neighbour p-value exceeds 0.05.
  The raw p-values were 0.45, 0.24 and 0.45 under v1.0.0, and 0.06, 0.08 and 0.06 under v1.1.0. All of them were
  capped to 1.
- **L, G and S carry no information here.** L = 1 because no law evaluates. G = 1 because there are no gene edits.
  S does not run.
- **E is constant.** E is the weakest input kind, which is "assumed" (0.5) for every repository organism.

So score = exp(0.10 ln 0.5 / 0.85) = 0.9217 for every typical repository design, and 1.0 for every typical
specimen. Across the 646 v1.0.0 validation rows there are only 60 distinct scores. Among the 300 held-out specimens
there are 9, and 290 of those specimens score exactly 1.

The scorer was built as a pass/fail classifier. It is not a ranker.

## The change (`score-weights.v1.1.1.json`)

- **The score is unchanged.** `score`, its components and the plausible cut are identical to v1.1.0, so C1–C8
  cannot change. That is checked by re-running them.
- **A new `rank_score`** = exp(Σ w_i ln max(r_i, 1e-4) / Σ w_i), using the same weights.
  - r_P is the geometric mean of the **raw** P parts: empirical p-values not divided by alpha, plus the envelopes,
    organ fit and state envelope.
  - r_E is the **mean** evidence value over the kinds of inputs read, not the weakest.
  - r_L, r_G and r_S are as in v1.1.0.
- **Seen before hashing:** rank_score for zebrafish 0.701, flying fish 0.772, winged zebrafish 0.745, chimera 0.691
  and TFF 0.202 (leave-lineage-out where it applies).

## Criteria

C1–C8 are as before; their values must equal v1.1.0's. Three new criteria are added:

| id | criterion |
|---|---|
| R1 | at least 90 % of the validation rows have a distinct `rank_score` |
| R2 | `rank_score` AUC, all positives against all negatives, ≥ the v1.1.0 score AUC (0.9943) |
| R3 | among the A1 held-out specimens, Spearman(rank_score, nearest-real-neighbour distance) ≤ −0.5 |

R3 means a more typical body should rank higher.

## Predictions

- **R1 passes.**
- **R3 passes.** The raw p is monotone in distance, but the other P parts and E add noise.
- **R2 is uncertain.** Removing the alpha cap may let a few positives with small p fall below negatives that sit
  near the cut.
- **Not blind.** The defect was found by inspection, and these three criteria were written to test the fix.
sha256 67c3cd947c00aed1e2ea233d181293e203d2d4786413779c61bbd6bee0dbc640
