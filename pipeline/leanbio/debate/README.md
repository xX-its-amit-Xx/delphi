# The LeanBio law debate: which candidate laws are fit to constrain a design

The discovery agent turns nanopubs into candidate Lean laws and gets them through `lean/registry/propose.mjs`. That
asks whether the Lean is sound: it builds, there is no `sorry` or `axiom`, a non-vacuity witness compiles, every
statement mutant is rejected, and a joint witness exists with the accepted set. Passing it does not mean the law is
about biology, that its constants are real, or that its scope is honest.

This folder decides that, by running an adversarial debate with four roles, against criteria fixed and hashed before
the first debate ran, and ending in one verdict per law.

```
candidate law (propose.mjs -> candidate)
   |
   +-- evidence.mjs        GET Europe PMC / Crossref / the repo bytes; is each quoted constant IN its source?
   +-- gates.mjs           C1 non-vacuity + a rejecting design | C2 constants | C5 consistency | C6 wild-type firing
   |
   +-- PROPONENT  (worker, no web)    the strongest honest case FOR
   +-- CRITIC     (worker, web)       seven attacks, independently of the proponent
   +-- EVIDENCE CHECKER (worker, web) judges the fetch report, catches its false positives
   +-- REFEREE    (worker, no web)    rules against CRITERIA.md, seeing everything, bound by the gates
   |
   +-- referee.mjs reconcile  ->  PROMOTE-TO-CANDIDATE | NEEDS-WORK | REJECT | CONTESTED
        |
        +-- survivors: propose.mjs --write  ->  registry status `candidate`  (MCP serves it; studio draws it DASHED)
        +-- a promotion REQUEST with the written ruling  ->  queue/promotion-queue.jsonl  ->  A HUMAN
        +-- every ruling  ->  out/records/<law_id>.json  for lean/registry/open-questions/
```

## The automation question

Amit asked for a swarm whose debate "should automatically update the MCP server, and thus the constraints on design
studio + validation tool". It does — **up to `candidate`, and no further. That stopping point is a design decision,
not a missing feature.**

| step | automatic? | why |
|---|---|---|
| debate a candidate as it arrives on the board | yes | `debate.mjs --poll` |
| write a survivor to the registry as `candidate` | **yes**, through `propose.mjs` | the MCP tools (`lean_laws_list`, `lean_law_get`, `lean_check`) read the registry through `lib/lean-source.mjs`, so the law is served the moment it is written; the studio already draws a candidate **dashed**, and `checkDesign` marks its violations `binding: false` with `[advisory: law status is candidate, not accepted]` |
| promote `candidate` -> `accepted` | **NO** | an accepted law turns designs **RED** and constrains the optimizer. In this project only a human does that |

So the automatic half changes what the studio *shows* and what the MCP *serves*, immediately. It cannot change what
the studio *forbids*. A debate that passes queues a promotion request carrying the referee's written ruling:

```bash
node pipeline/leanbio/debate/promote.mjs queue
node pipeline/leanbio/debate/promote.mjs approve <law_id> --by human:project-lead     # the one command
node pipeline/leanbio/debate/promote.mjs approve <law_id> --by human:project-lead --dry-run
node pipeline/leanbio/debate/promote.mjs refuse  <law_id> --by human:project-lead --why "..."
```

`approve` refuses an agent role (`agent:law-critic` cannot approve — that is the whole point of the queue), refuses a
law the debate did not pass, and refuses a law that is not in the registry. It writes `approval.approved_by_role`,
bumps the version and recomputes `content_hash` with the registry's own `contentHash`, then prints the release step
(`release.mjs`, `build-lean-api.mjs`, `check-exposed.mjs`) that publishes it. Nothing in this folder ever writes
`accepted` on its own.

### The flag, default OFF

If debate-passing laws should one day auto-accept, that is **one flag with a recorded decision, never a silent
default**:

```json
// pipeline/leanbio/debate/config.json
{ "auto_accept_on_debate_pass": false,
  "auto_accept_decision": null }
```

`node promote.mjs flag` shows its state. Setting it `true` alone does **nothing**: the flag refuses to take effect
without `auto_accept_decision = {by: "human:<role>", date, where_recorded}`, and refuses a personal identifier in
`by`. So turning off the human step leaves a record of who turned it off, when, and where the decision is written
down. The test suite checks all three behaviours, so the flag is real rather than decoration.

### Why this is where it stops

A candidate law is advisory: a designer sees a dashed line and can ignore it. An accepted law is a wall. The debate
is good enough to say "this is worth a person's attention" and not good enough to say "this is true about every
organism in its scope" — its own criteria admit that (`C6 unclear` means no real animal could test the law at all,
and five of the eight laws debated so far are in exactly that state). Promoting on a debate verdict would convert the
referee's judgement into a constraint on other people's work without anyone having looked.

## Run it

```bash
node pipeline/leanbio/debate/debate.mjs --lock            # fix and hash the criteria. Do this ONCE, first.
node pipeline/leanbio/debate/build-wildtype.mjs --write   # the wild-type dossier C6 is evaluated against
node pipeline/leanbio/debate/test.mjs                     # 69 checks, no network, no worker invocation
node pipeline/leanbio/debate/test.mjs --mutate            # break each gate on purpose; the suite must notice

export SWARM_BOARD_FILE=C:/Temp/leanbio-round2/sessions/swarm/tasks.jsonl
export STUDIO_SESSIONS_DIR=C:/Temp/leanbio-round2/sessions
node pipeline/leanbio/debate/debate.mjs --poll --for 30 --max-invocations 22 --concurrency 3
node pipeline/leanbio/debate/debate.mjs --law disc-measured-wing-loading-band          # one law
node pipeline/leanbio/debate/debate.mjs --law <id> --no-llm                             # gates + evidence only, free
node pipeline/leanbio/debate/evidence.mjs <law_id>        # just the fetch report
node pipeline/leanbio/debate/records.mjs                  # what lean/registry/open-questions/ should pick up
```

Outputs: `out/rulings.json` (every ruling, with the criteria hash it was decided under), `out/run.json` (invocations,
cost, caps), `out/records/<law_id>.json` (one record per ruling for the open-questions registry),
`transcripts/<law_id>/<role>.json` (each worker's full prompt, answer, tool calls and cost),
`queue/promotion-queue.jsonl` (append-only), and `DEBATE-RESULTS.md`.

## The four roles, and why they are isolated

Each role is a separate headless `claude -p` process with its own prompt file in `roles/` and **no access to the
others' reasoning until its turn**. The isolation is enforced in one place, `debate.mjs`'s `candidateBlock()` and the
`blocks` list per invocation, so it can be read off:

| role | sees | tools | why |
|---|---|---|---|
| `proponent` | the candidate, the overlapping accepted laws | none | a case built on a number it fetched itself is a number nobody checked |
| `critic` | the same, and NOT the proponent's case | `WebFetch`, `WebSearch` | so its attacks are not shaped by someone else's framing |
| `evidence-checker` | the candidate and the mechanical fetch report | `WebFetch`, `WebSearch` | it must be independent of both arguments; only retrieved bytes count |
| `referee` | everything, plus the gate results and `CRITERIA.md` | none | it rules; it does not gather |

Headless-worker gotchas reused from `sim-engine/swarm/recruit.mjs` and `swarm/compare/run.mjs`: the prompt goes on
**stdin** (a role prompt plus a candidate exceeds a safe argv length on Windows), `--output-format stream-json
--verbose` so every tool call lands in the transcript and the `result` event carries cost, `--no-session-persistence`,
a scratch cwd that is never the repo, `windowsHide`, a per-call `--max-budget-usd`, `--strict-mcp-config` with no MCP
config so a worker cannot reach a tool nobody gave it, and the structured answer parsed from a fenced block when
`structured_output` is absent. A worker that returns prose is a **failed** worker, recorded as such, never a silent
default.

## Why the hard gates are code and not an argument

C1, C2, C5 and C6 are decided by `gates.mjs` against the repository's own data, and `referee.mjs`'s `reconcile()`
will not let the referee's verdict exceed what the gates allow. If the referee votes PROMOTE on a law that fires on a
real animal, the verdict is REJECT and the vote is recorded in `gate_disagreement`.

That is deliberate. A language model that could argue its way past the wild-type check would make the check
worthless, and the whole value of this pipeline is that the one criterion with teeth — *a real animal must not
violate a law in that law's own scope* — cannot be talked around. `test.mjs` asserts it three times, and
`test.mjs --mutate` weakens each gate on purpose to prove the rejection comes from the gate and not from the test.

The referee is still necessary: C3 (scope honesty), C4 (independence vs restatement) and C7 (record bound vs
impossibility) are judgements about meaning that no inequality decides, and they are the criteria on which laws
mostly fail.

## Files

| file | what it is |
|---|---|
| `CRITERIA.md` | the referee's criteria, fixed and hashed before any debate. Amendments are versioned, and the lock records every superseded hash |
| `criteria.lock.json` | the hash. `requireLock()` refuses to run if `CRITERIA.md` no longer matches it |
| `open-disputes.json` | questions this project holds open; a candidate asserting one arm is CONTESTED, not promotable |
| `wildtype.json` | 34 wild-type organisms with measured quantities, built by `build-wildtype.mjs` from `physics/*.csv` and `lean/registry/observations/`. No bird: Aves is the frozen holdout, and the builder fails if a source names one |
| `lib.mjs` | the criteria lock, a small evaluator for Lean inequality atoms, scope/lineage, the held-out guard |
| `gates.mjs` | C1, C2, C5, C6, the known-dispute check, the overlapping accepted set and an implication probe for C4 |
| `evidence.mjs` | the GET-based fetcher and the number matcher (`--self-test` runs the matcher offline) |
| `candidates.mjs` | where a candidate comes from (board, round dir, registry) and the one shape every role sees |
| `worker.mjs` | one role = one headless `claude -p`; role-to-tools mapping lives here |
| `referee.mjs` | `runGates`, `allowedVerdicts`, `reconcile`: how a ruling and the gates become one verdict |
| `promote.mjs` | the candidate write, the promotion queue, `approve`/`refuse`, and the auto-accept flag |
| `records.mjs` | one record per ruling for `lean/registry/open-questions/` (failed-theorem / open-question / candidate-with-requirements / promotion-request) |
| `test.mjs` | 69 checks + `--mutate`; every rejection test is paired with an acceptance test so a check that rejects everything fails |
| `DEBATE-RESULTS.md` | what the debate actually decided, per law |

## Rules this folder keeps

- **No Aves.** The held-out clade is guarded in `lib.mjs` (`touchesHoldout`), applied to every candidate before any
  role or service call sees it, to the wild-type dossier at build time, and stated in the critic's prompt.
- **No credentials.** Europe PMC and Crossref are open APIs; nothing here reads a token, and the worker prompts
  forbid attempting one.
- **Nothing is accepted.** See above. `propose.mjs` is the only writer into the registry, and it never writes
  `accepted`.
- **Not our files.** `sim-engine/swarm/board.mjs` is read (folded from its documented event log) and called, never
  edited. The scorer's files and `lean/registry/` internals are not edited; `propose.mjs`, `registry-lib.mjs`'s
  `contentHash` and `release.mjs` are the only ways in.
- **A failure is a result.** An unreachable source is `source-unreachable`, not a pass. A worker that returns no JSON
  is recorded as failed. A law no real animal can test is `unclear`, never `pass`.
