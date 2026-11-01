# Pre-registration: scorer v1.2.0

Written 2026-11-01 before `dev-benchmark-v12.mjs` and before the independent evaluator's blind run. The weights are
in `score-weights.v1.2.0.json`; the code is `score-v12.mjs`, reached through
`designScore(design, {version: '1.2.0'})`. v1.0.0, v1.1.0 and v1.1.1 are left unchanged.

## Why v1.2.0

The independent evaluator's probe on the frozen benchmark found five defects, and the core agent found a sixth.
Each is fixed as follows (details in `score-weights.v1.2.0.json` "changes_from_1.1.0").

1. **Absence counted as a pass.** P now always runs.
   - Every present trait with an envelope is checked: 20 traits, envelopes = [min, max] of log10 over benchmark
     **dev positives**, n ≥ 20 each, in `data/trait-envelopes.v1.2.0.json`. A single-trait check counts.
   - P is multiplied by a coverage factor, 0.5 + 0.5 · min(1, checked/4). With nothing checkable, P = 0.25.
   - Coverage is reported.
2. **Refused or invalid edits threw.** They now score 0.01 and are marked implausible. A scorer bug returns
   `score: null` with `error`, never a fake verdict.
3. **No genus leave-out.** `genus:Name` is now accepted.
4. **Claims went unread.** `lean_spec` claims run through lean_check. Only **claim-caused** accepted binding
   violations set L = 0: the violations of the full spec minus those of the same spec with its claim fields removed.
   Real Park & Choi L1 and L2 already "violate" C7b, E2, C2a and C8e against the single reference specimen L3, and
   that must not count against a claim.
5. **Definitional and sanity failures did not feed the score.** They now feed P:
   - a peduncle fraction above 1;
   - an organ volume fraction that cannot fit. The swim bladder is anchored at 0.051 ×/÷2. Any other organ at
     ≥ 0.5 of body volume is treated as impossible, which is an assumption. Organs summing to ≥ 0.8 are also
     impossible.
   - a failed non-range phenotype sanity check (mass fits the body, organ fit, stage), at 0.05.
6. **Scores could not rank.** `rank_score` is added, carried over from v1.1.1, with the coverage factor applied.

**Also changed:**
- Specimens below the FishShapes 0.5th-percentile SL use the larval envelope.
- The v1.1 fin envelope is kept only for fin traits that lack a dev envelope.

## Tuning disclosure

**Tuned on dev only:** the trait envelopes are built from dev positives. `heldout/` has not been read.

**Seen before hashing:** v1.2.0 scores on 2 dev items of each of these types:

| item type | v1.2.0 score |
|---|---|
| organ_containment | 0.15, and 0.01 (refused) |
| law_breaker | 0.26 |
| impossible_combo | 0.26 |
| specimen_with_fins | 1.0 |
| out_of_range_extrapolation | 0.15 |
| fishbase_picture | 1.0 |
| ontogeny_stage | 0.51 |
| mutant_quantified | 1.0 |

Seen also: the zebrafish (0.92) and TFF (0.14). The lean_spec checks were run on the 3 specimen_with_fins
positives.

**One consequence to read with care:** dev positives score inside their own envelopes by construction, so P2 and
P3 on dev overstate held-out performance on those traits.

## What will be reported on dev

Comparisons:
- The benchmark's own P1, P2, P3, S1, S2 and S4.
- Leave-one-family-out (LOFO): every source specimen's family and species is excluded.
- Up to 1 000 items per group, seeded, plus every easy negative, every ontogeny stage and every other positive.
- Computed for `rank_score`, `score` and v1.0.0's score, side by side.

**Primary output for the benchmark:** `rank_score`, the ranking quantity. `score` and `plausible` (cut 0.5) stay the
pass/fail call.

Predictions:
- **P2 passes with rank_score.** The easy negatives hit envelopes, claims or organ rules.
- **P1 and S1 stay modest (around 0.6–0.8).** Shuffled decoys keep realistic marginals, so only the nearest-neighbour
  body term, which needs ≥ 3 body traits, can see them.
- **S4 is about 50–80 %.**

## Not changed

- The flow-matching likelihood is not included: its joint density includes head depth, its held-out split is by
  species rather than family, and its tail is unstable.
- Weights, floor, alpha, the 0.5 cut and the evidence map are unchanged.
sha256 5c1b3ce148d7c0c1a126ceab2e5d829cd864f4c8621115c4c89954bbccab50ee
