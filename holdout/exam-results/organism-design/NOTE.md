# Record of runs (organism-design exam)

The protocol in `holdout/EXAM.md` says an exam result is never edited or overwritten. That rule was broken once
here by a scripting error, and this note is the record.

- **Run 1, 2026-10-31 about 06:41 UTC.** `score.mjs` wrote `result.json`. Verdict `inconclusive`: the panel has
  no sternal-keel or foot-webbing term (tests A and B have zero scored species) and reports no conflicts (test
  C not evaluable). Precondition `leak_check_exit` was non-zero for a real reason: a regenerated rock-pigeon
  example was present in `organism-design/`. `ratites_on_roster` was reported as 0 because of a counting slip
  (it counted ratites only among scored species).
- **Run 2, about 06:52 UTC, overwrote run 1.** The scorer's rerun-naming change had not applied, so run 2 was
  written to `result.json` instead of `result.run2.json`. Its verdict and measurements were identical to run 1.
  Its `leak_check_exit` was also non-zero, but this time spuriously: the scorer ran the leak check without a
  large enough output buffer and the check was killed by its 53,378 weak-word warnings from the SPARQL cache; the
  standalone `node holdout/check-leaks.mjs organism-design` exited 0 at that time, after the organism thread had
  deleted the pigeon example and its cache entries. `result.json` now holds run 2's content.
- **Run 3** is written by the corrected scorer (leak check via `--json`, rerun files named `result.runN.json`,
  ratites counted over the whole roster) as `result.run2.json`, with `supersedes: result.json` and the reason on
  the command line. It is the result the dashboard shows.

The predictions file was the same in every run (its SHA-256 is in each result's `preconditions`). The exam
verdict did not change across runs; what changed is the preconditions record and the reporting slips.
