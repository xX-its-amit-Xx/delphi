# Pre-registration: single agent vs swarm on pre-registered test plans

Written 2026-10-31 06:25 UTC by the `swarm` thread (session scienceclaw-3d), before any arm was run.
The only agent calls made before this file: two one-claim prompt smoke tests (claim darwin1859-ch12-08), whose
outputs are not used. Nothing in this file is changed after the runs start; corrections go in `swarm/compare/DEVIATIONS.md`.

## Task

For each of 20 claims, produce one **pre-registered empirical test plan**: hypothesis, numeric pass and fail
criteria, interpretation, and **exactly one real public dataset** (title, publisher, landing URL, DOI if any) that
could decide it. The plan format is `swarm/compare/plan.schema.json`; the instructions every agent receives are
`swarm/compare/prompt.md`. An honest `dataset: null` with a reason is allowed.

## Inputs (frozen)

`swarm/compare/claims.json`: the 10 highest-testability claims each for Darwin (*Origin*, 1859) and Thompson
(*On Growth and Form*, 1917) from `docs/claims.json`, excluding the 4 claims that already have a `claim-tests/` directory.
Wolfram claims carry no testability score and are not dataset-shaped, so they are not used.

## Arms (same model, tools, prompt, schema and budget for every arm)

Every "worker call" is one headless `claude -p` run: model `claude-sonnet-5-5`, tools `WebFetch` and `WebSearch` only
(no file system, no repo access), run from a scratch directory, output validated against the plan schema, at most 12 turns.
Three "queens" exist with **distinct information**: each has a short brief naming data portals for its domain
(`swarm/compare/briefs.json`): `q-evolution` (biogeography and biodiversity portals), `q-morphology` (growth,
morphometrics, fisheries, anthropometrics), `q-holdout` (general repositories and museum collections, no domain).

| arm | who decides | information | feedback |
|---|---|---|---|
| **single** | one agent, one call, all 20 claims, up to 60 turns | union of all three briefs | none from us; it may verify its own URLs with WebFetch |
| **isolated** | 20 workers in parallel (5 at a time), one claim each | the brief of the queen whose domain matches the claim's thinker | none: no board, no messages, no retries |
| **centralized** | emperor sets per-queen concurrency; king assigns Darwin to q-evolution and Thompson to q-morphology; on an unverified plan the king sends one retry to the same queen with the verifier's failure text, then one escalation to q-holdout; after 2 consecutive failures in a queen the king appends a serendipity prompt from `roster.json` | per-queen brief | yes, via the king |
| **decentralized** | no planner: the three queens pull tickets from a shared board (own-domain open tickets first, then other queens' gap tickets, then any open ticket), run a worker, verify, and post `done` or `gap` with the failure text; verified plans post a one-line tip (publisher that worked) that every queen sees | per-queen brief plus board tips and gap notes | yes, via the board; no agent directs another |

Budget per arm: **$3.00 at list price** of model usage (the orchestrator stops launching workers when the cumulative
spend reported by the CLI reaches the cap; the single agent runs with `--max-budget-usd 3`) and **45 minutes wall clock**.
At most 2 extra attempts per claim in the feedback arms.

## Verification (mechanical, identical for all arms, `swarm/compare/verify.mjs`)

Every URL and DOI in a plan (the named fields plus a regex scan of all text) is fetched once by script with redirects
followed and a 25 s timeout. Classes:
- `resolves`: final HTTP status 2xx.
- `fabricated`: HTTP 404 or 410, DNS name not found, or `doi.org` reporting the DOI does not exist.
- `blocked`: 401, 403, 429, 5xx, timeout or TLS error. Counted as *not verified* but *not fabricated*.
- `malformed`: not a parseable URL or DOI.

For the named dataset the verifier also records the page title and whether at least one distinctive word (5+ letters)
of the dataset's title or publisher appears in the page title, body or final URL (`name_match`).

## Scores (per arm, all written to `swarm/metrics.json` and `swarm/compare/results.json`)

1. **verified-dataset rate** (primary): claims whose named dataset's landing URL (or DOI) `resolves` **and** `name_match` is true, out of 20. The looser count (resolves only) is reported beside it.
2. **fabricated identifiers**: number of unique identifiers classed `fabricated` across the arm's 20 plans. **Must be 0.** An arm with any fabricated identifier fails the hard constraint whatever its rate.
3. **untouched claims**: claims with no worker attempt (or missing from the single agent's output).
4. **duplicated work**: worker calls on a claim that already had a verified plan, plus duplicate claim ids in one output.
5. **minutes**: wall clock from first worker launch to last worker exit; agent-minutes (sum of call durations) beside it.
6. **tokens and cost**: input, output, cache-read and cache-creation tokens and list-price USD as reported by the CLI.

## Decision rule (pre-registered)

Arm A **beats** arm B if A has 0 fabricated identifiers and A's verified-dataset count exceeds B's by at least 2 claims
(10 points). A difference under 2 claims is reported as **no difference**. The comparisons we report, in this order:
centralized vs single (the question Amit asked), decentralized vs centralized, centralized vs isolated, and the
best swarm arm vs single. If the single agent or the hierarchy wins, that is the headline. One run per arm is the
primary result; replicate runs, if time allows, are reported as replicates and never replace the primary.

## What this does not show

Twenty claims is small; a 2-claim margin is the pre-registered minimum, not a significance test. "Verified" means the
URL resolves to a page that mentions the dataset, not that the dataset can decide the claim; that judgement needs an
assessor from a different provider and is out of scope here. The queens in the decentralized arm are concurrent
coroutines in one Node process that interact only through the board file; they are not separate machines.

---

# Experiment 2: the same four arms with web tools required

Written 2026-10-31 06:27 UTC, after experiment 1 was complete and deployed, before any experiment-2 arm was run. Asked for by
the hub because experiment 1's biggest caveat was that no arm used the web tools: that result is about feedback loops
over memory. The only agent calls made before this section: three one-claim pilots of the new prompt (claim
darwin1859-ch12-08 from experiment 1, outputs unused) to measure cost and to confirm that tool calls can be counted.

## Prediction, stated before running

1. Verified datasets (of 20): centralized >= decentralized > isolated > single, with the single agent improving most over
   experiment 1 because it can now fetch and is no longer stuck on blocked portals. Point guesses: centralized 18,
   decentralized 17, isolated 15, single 14.
2. Fabricated identifiers: 0 in every arm. Fetching before naming should remove invented URLs. If the decentralized arm
   again writes one, that is a finding about first attempts under a shared board, and the arm will not be tuned after
   the fact.
3. Cost: every multi-agent arm ends at or near the $8 cap; the single agent well under it. Minutes: 5 to 12 per arm.
4. The pre-registered margin (2 claims) will separate centralized from single and from isolated, but not centralized
   from decentralized.

## What changes from experiment 1 (everything else is identical)

- **Claims:** `swarm/compare/claims2.json`, 20 new claims: the next 10 by testability for Darwin and for Thompson,
  excluding the 20 already used, claims with a `claim-tests/` directory, the two burned bird claims and anything in
  the holdout's list, and any claim whose text contains a bird word (two skipped: darwin1859-ch07-04 "nest",
  thompson1917-ch15-08 "eggs"; rule and regex in `select2.log`). `node holdout/check-leaks.mjs` reports no held-out
  taxon in the set.
- **Prompt and schema:** `prompt2.md` and `plan2.schema.json`. The agent MUST open the landing page with WebFetch
  before naming it and report `fetched: {url, http_status, page_title}`. A plan whose landing page the agent did not
  fetch is scored as unverified.
- **Tool use is counted from the CLI's event stream** (every WebFetch URL and WebSearch query per call is logged), not
  from the API's server-side counters, which stay at zero for these client-side tools.
- **Scoring: "verified" now requires three things:** (a) the checker verifies the landing page as in experiment 1
  (HTTP 200 and the page names the dataset), (b) the call that wrote the plan fetched that landing URL (or its DOI, or
  the URL it reports in `fetched`), and (c) the page title the agent reports shares a distinctive word with the page
  the checker saw (waived only when the checker saw no title at all, such as a JSON API endpoint). The checker-only
  count is reported beside it. Fabricated, untouched, duplicated, minutes, tokens and cost are unchanged.
- **Budget: $8.00 at list price per arm, as a hard stop.** The pilot cost $0.19 to $0.26 per fetching call, about three
  times experiment 1, so $3 would not cover 20 claims. Per-call cap $0.60 (enforced by the CLI); a worker is launched
  only if spent + (calls in flight + 1) x $0.60 <= $8.00, so no arm can end above the cap. The single agent runs as
  one call with `--max-budget-usd 8` and up to 250 turns. Wall cap 45 minutes per arm. Worker turn cap 20.
- **Order and timing:** arms run one at a time, isolated, centralized, decentralized, single. Hard stop at 08:30 UTC:
  whatever has not finished by then is reported as not run.

## Decision rule

Unchanged: A beats B if A has 0 fabricated identifiers and at least 2 more verified datasets than B, primary run only.
Comparisons in the same order as experiment 1. Experiment 2 does not replace experiment 1; both are reported.
