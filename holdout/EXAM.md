# Exam protocol

How a supported law is scored on the held-out clade. Read `README.md` first for what is held out
and why. This file says what happens after building stops.

## Who

- **Builder**: whoever produced the claim test, organism design or swarm result. The builder never
  runs or scores the exam on their own work (`assessor != builder`, as in `BEST_PRACTICES.md`).
- **Assessor**: a different session, using a different model provider where one is available. At
  the hack the holdout thread (`scienceclaw-93`) runs the exam for claim tests it did not write.

## When

Once, after the builder declares the result final (the claim test's `result.json` has
`status: complete`). Not before, and not again after seeing the outcome. A builder who changes a
model after its exam result is a new builder with a new pre-registration, and the exam is run once
more on the new version with that stated.

## Preconditions, checked in this order

1. `node holdout/make-split.mjs --verify` prints `frozen split intact`. If not, stop: the roster
   moved and nothing can be scored until the move is explained in `holdout/README.md`.
2. `node holdout/check-leaks.mjs <the builder's folder>` exits 0, or every hit is on the allowlist
   with a reason the assessor agrees with. A builder folder that names a held-out organism outside
   the allowlist is scored as **not blind**, which is recorded and ends the exam for that result.
3. The builder's `result.json` has pre-registered `pass_criterion` and `fail_criterion` and a verdict
   on training organisms. The exam applies the same criteria; it never writes new ones.

## What is scored

For a claim test that reports a verdict on training organisms:

- Re-run the committed analysis with the held-out class **included only as the evaluation set**:
  fit nothing on it. The expected shape is a flag such as `--exam` on `analysis.py` that applies
  the frozen model (or the law's prediction) to class Aves rows and reports the same measured
  quantity the pre-registration named.
- Apply the pre-registered pass and fail criteria to that measured quantity on birds alone.
- Report four things: the builder's verdict on training organisms, the exam verdict on birds, the
  measured values for both, and whether the two agree.

For an organism design or a simulation, the analogue is: the design procedure is run for a roster
species with its identifiers only, and the output is compared with that species' public trait or
genome record, using the pass criterion the builder registered for training organisms.

## Where results go

`holdout/exam-results/<project>/<claim-id>/result.json`, one per examined result, never edited after
it is written (a second run is a second file with a suffix and a stated reason):

```json
{
  "claim_id": "kimura1968-heterozygosity",
  "builder_result": "claim-tests/math-bio-theorems/kimura-heterozygosity/result.json",
  "builder_verdict": "supports",
  "builder_measured": { "value": 0.0, "unit": "", "n": 0 },
  "exam_clade": "Aves",
  "exam_roster_sha256": "<CHECKSUMS.json outputs.exam.json.sha256 at the time of the run>",
  "preconditions": { "split_verified": true, "leak_check_exit": 0, "allowlisted_files": [] },
  "command": "python3 analysis.py --exam",
  "exam_measured": { "value": 0.0, "unit": "", "n": 0 },
  "pass_criterion": "copied verbatim from the builder's result.json",
  "fail_criterion": "copied verbatim from the builder's result.json",
  "exam_verdict": "supports | refutes | inconclusive",
  "agrees_with_builder": true,
  "caveats": [],
  "assessor": { "kind": "session", "id": "scienceclaw-93", "model": "<model id>", "date": "2026-11-01" }
}
```

Every number in `exam_measured` comes from the command recorded in `command`. If the roster species
with the needed data number fewer than the builder's own `n` threshold, the verdict is
`inconclusive` with `reason: underpowered`, not a pass.

## What the exam does not do

- It does not rescue a law. A law that fails on birds failed; the builder may say why in a caveat.
- It does not use trait values that the roster does not cover; it never fetches new bird data that
  the builder could not also have named in `planned_datasets` with the class filtered out.
- It does not pool exam results across different rubric or criterion versions.
- It does not test the operationalisation. The exam applies the builder's own pre-registered rule and unit of
  analysis to unseen species, so it cannot show that a verdict would change under a different reading of the
  claim. That hazard is real: the hub's cross-check against the collaborator swarm
  (`dashboard/public/crosscheck.json`, 2026-10-31) found that of 8 claims both swarms tested independently,
  6 verdicts agree and 2 differ (supports against mixed) under different operationalisations. Blindness to the
  clade and robustness to the operationalisation are separate checks; a claim needs both, and only the first
  lives here.
