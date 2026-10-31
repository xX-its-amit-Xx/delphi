# Deviations from and disclosures about swarm/PREREG.md

Anything that changed after the pre-registration, or that a reader needs to weigh the result, goes here with a time.

## Disclosures

- **2026-10-31 06:05 UTC. Held-out clade (Aves).** The holdout thread held out class Aves after the claim set was
  frozen and the arms had started. `node holdout/check-leaks.mjs` flags one claim in the set, `darwin1859-ch01-10`
  (domestic pigeons descend from *Columba livia*); `thompson1917-ch15-01` (egg shape) is about birds by subject though
  it names no held-out taxon. The arms only write test plans and never download organism data, so no held-out records
  were read. But the agents have seen these two claims, so **neither claim can serve as a blind exam item** for the
  holdout, and the comparison is **not blind to Aves**. The set was not changed mid-run; dropping the two claims would
  have broken the pre-registration.
- **GBIF web pages are unreachable by script.** `https://www.gbif.org/...` returns HTTP 403 (a Cloudflare challenge)
  to every non-browser client, so a plan whose only identifier is a gbif.org web page counts as *blocked*, not
  verified. The GBIF API (`api.gbif.org`) and GBIF dataset DOIs resolve normally. This was known before the arms ran
  (found during the smoke test) and is the pre-registered behaviour, stated here so nobody reads "blocked" as "fake".
- **Workers did not use the web tools in the smoke tests** (0 WebFetch and 0 WebSearch calls) although both were
  allowed. The arms measure what the agents chose to do with equal tools, not what they could have done.

## Deviations

- **2026-10-31 06:12 UTC. First single-arm run excluded (infrastructure failure).** `runs/single-2026-10-31T05-57-45`
  exited after 1 second with exit code 1, no stdout, no stderr, zero tokens and $0: the CLI never made a model call.
  Diagnosed at 06:20 UTC from the CLI's own JSON: `API Error: 400 tools.0.custom.input_schema.type: Input should be 'object'`.
  The single arm's output schema had an array at its root (20 plans) and the API only accepts an object there. Fix: the
  array is wrapped as `{ "plans": [...] }`; the plan schema itself is unchanged. While diagnosing, prompts over 8,000
  characters were also moved to the CLI's stdin (harmless; worker prompts of about 3,000 characters are unchanged).
  The aggregator (`metrics.mjs`) excludes any run with zero tokens as an infrastructure failure and lists it under
  `infra_failures_excluded`. The single arm is rerun after the other three arms finish, so the arms still run one at a
  time. No agent output was seen before this change.
- **2026-10-31 06:35 UTC. Budget overshoot in the decentralized arm.** The cap is checked before each worker launch;
  workers already in flight finish. The decentralized arm hit the cap with calls in flight and ended at $3.28 list
  price against the $3.00 cap (centralized ended at $2.98, isolated at $2.60). The overshoot bought no extra launches:
  the two gap tickets left on the board were never re-pulled because the cap had been reached. Reported, not corrected.
- **2026-10-31 06:35 UTC. No arm used the web tools.** Every arm had WebFetch and WebSearch allowed and made
  0 searches and 0 fetches (the CLI reports both counts per call). The agents wrote plans from memory; verification came
  only from our script, and only the feedback arms could act on it. This is a property of the agents' behaviour under
  equal tools, not of the design, and it is why the feedback loop is the whole difference between arms.
- **2026-10-31 06:40 UTC. The one identifier classed fabricated, checked after the fact.** In the decentralized arm,
  q-evolution's first plan for `darwin1859-ch01-10` named the dataset "Columba livia genome assembly Cliv_2.1
  (GCF_000337935.2)" at `https://www.ncbi.nlm.nih.gov/assembly/GCF_000337935.2`, which returns HTTP 404. NCBI has
  retired its old `/assembly/` pages, so a 404 there alone would not prove the accession is invented. A post-hoc check
  against the NCBI Datasets API (`/v2/genome/accession/<acc>/dataset_report`) returns no report for `GCF_000337935.2`
  (nor for `GCF_000337935.1`), while the real Cliv_2.1 assembly is `GCA_001887795.1` (colLiv2). So the accession as
  written does not exist and the pre-registered classification stands. The second attempt on the same claim, after the
  board's gap note, named a verifiable dataset. The pre-registration counts fabricated identifiers "across the arm's
  20 plans"; the code counts every attempt, so the arm's primary run has 1 and fails the hard constraint. Under the
  looser reading (final plans only) it would have 0. Both numbers are reported; the stricter one decides.

## Replicates

- **2026-10-31 06:18 UTC. One replicate per arm, same order of magnitude, same ordering.** Verified of 20, primary then replicate: single 13 then 15; isolated 17 then 15; centralized 19 then 19; decentralized 18 then 18. Fabricated identifiers in the replicates: single 0, isolated 0, centralized 0, decentralized 0. The centralized and decentralized replicates ended at $3.0751 and $3.0463 against the $3.00 cap, for the in-flight reason recorded above. Replicates are reported beside the primary and do not change the pre-registered verdicts, which are computed from the primary run only.

## Experiment 2: outcome against the prediction

- **2026-10-31 06:39 UTC. All four arms finished between 06:28 and 06:39 UTC**, inside the 08:30 stop. Verified of 20 (the stricter rule: checker + agent fetched + title agrees): single 12 (predicted 14, checker-only 12); isolated 16 (predicted 15, checker-only 17); centralized 18 (predicted 18, checker-only 19); decentralized 17 (predicted 17, checker-only 18). Fabricated identifiers: single 0, isolated 0, centralized 0, decentralized 0 (predicted 0 everywhere: right). Ordering centralized > decentralized > isolated > single as predicted, and the centralized and decentralized point guesses were exact. **Wrong parts of the prediction:** the single agent did not improve with web tools; it fell from 13 to 12, naming only 12 datasets and leaving the rest as honest nulls after 13 fetches for 20 claims in one context. Costs stayed under the cap (single $0.5225, isolated $4.4837, centralized $5.6118, decentralized $6.3667) rather than at it, and minutes were 2 to 4, not 5 to 12.
- **The hard cap held.** The decentralized arm stopped launching at $5.64 spent with 3 calls in flight (worst case $7.44 < $8) and ended at $6.3667. No arm exceeded $8.
- **Attribution of fetches in the single arm.** Fetch counts are per call, and the single agent is one call, so every plan it wrote counts as "agent fetched something" (20 of 20); per-plan evidence there rests on the reported page title matching the checker's view and on the fetched-URL list containing that plan's landing URL, which the verifier does check. The checker-only and strict counts agree for the single arm (12 and 12).
- **Decentralized was not tuned.** The arm ran exactly as pre-registered; its zero fabricated identifiers this time is reported as a finding beside experiment 1's one.

## Context from a sister project (added after both experiments)

- **2026-10-31 ~07:10 UTC. Not a deviation; added for interpretation.** The hub reported that delphi-evolve (github.com/kganjam/delphi-evolve, page /evolve/) ran the same four-arm design on an enzyme benchmark and found no collective advantage (sharing 78/100, isolated 77/100, single planner 78/100, single planner without model prior 96/100; zero false certificates). We did not rerun or re-verify their numbers; they are quoted from the hub's message. The write-up now states the reconciliation: their members are deterministic code and compute the same thing, ours are context-limited language models, and the single agent here lost mainly by leaving plans blank (experiment 2: 8 of 8 losses blank, 0 named-but-unverified; experiment 1: 3 blank, 4 named-but-unverified). Per-claim breadth of the centralized arm's win over single: 6 distinct claims in experiment 1, 7 in experiment 2 (single won 1 back). These counts come from results.json and results2.json per_claim and were computed before the text was written.

## Pre-registration timestamp correction and nanopub drafts

- **2026-10-31 ~14:10 UTC. The header of `swarm/PREREG.md` says "Written 2026-10-31 06:25 UTC". That is a typo.** The session transcript records the file being written at 2026-10-31T05:52:04Z, before the first primary run started (isolated, 05:57:46Z); the experiment-2 section was appended at 06:27:23Z, before the first experiment-2 run (isolated, 06:28:12Z). The file itself is not edited, because it says it is not changed after the runs start; this entry is the correction. No git commit of PREREG.md exists yet (the hub holds all commits), so the pre-registration cannot yet be shown by a commit hash; the transcript timestamps are the evidence.
- **2026-10-31 ~14:10 UTC. Unsigned nanopub drafts written for three findings** (`swarm/nanopubs/`, built from results.json and results2.json by `build.mjs`). Records 02 (shortfall is mostly blank plans) and 03 (advantage spread over distinct claims) are post-hoc breakdowns of the pre-registered runs, computed after the results were known at the hub's prompting; both say so. Nothing is signed or published.
