# Single agent vs decentralised swarm vs centralised swarm, at four stages

Measured 2026-11-01. Pre-registration: [`ARMS.md`](ARMS.md), written before the first call.
Numbers: [`results.json`](results.json) (the same file the dashboard page reads), built from the run files by
`publish.mjs`. Page: `dashboard/public/t/benchmark/`. Raw logs: `runs/`, one traceable JSON per cell under
`dashboard/public/t/benchmark/logs/`.

**n = 3 tasks per (arm, stage). 36 cells. 108 model calls. $8.35 list price. Nothing here is a significance claim.**

---

## 1. The headline

> **Given the same total budget and byte-identical inputs, the three architectures do not separate on quality
> at three of the four stages, while the swarms cost 1.5x to 5.9x the single agent. The one difference that
> replicated is a cost effect, not a quality one: a centralised swarm pays its coordination cost at the merge,
> the merge is structurally the most expensive single call in the architecture, and an equal-total-budget rule
> starves exactly that step.**

Read these two before quoting anything above.

1. **n = 3.** Three tasks per arm per stage. No significance test is possible and none is run. Every difference
   is reported as a difference of means beside the within-arm min-max spread, and a difference smaller than
   that spread is reported as **not separating**.
2. **No arm had any tools.** Every arm's input was byte-identical and everything an arm needed was in its
   prompt. This measures the three architectures **as reasoning architectures over fixed inputs**. It does
   **not** measure tool use or tool coordination — which is what the rest of DELPHI actually does. The result
   will be over-read if this sentence is dropped.

---

## 2. The numbers

Quality is the mean of that stage's pre-registered checks, 0 to 1. Cost is CLI-reported list price. Tokens are
input + output + both cache counts. Every cell is one final artifact, whatever the arm's call count.

### Stage 1 — nanopub creation

| arm | mean | min–max | spread | $ | tokens | wall s | calls | cap stops | artifacts absent |
|---|---|---|---|---|---|---|---|---|---|
| single | **0.648** | 0.500–0.778 | 0.278 | 0.405 | 83,738 | 80 | 3 | 0 | 0 |
| decentralised | **0.593** | 0.500–0.667 | 0.167 | 0.954 | 372,538 | 111 | 10 | 1 | 0 |
| centralised | **0.000** | 0.000–0.000 | 0.000 | 1.611 | 405,692 | 269 | 18 | 8 | **3** |

Single over decentralised is **0.056**, inside both arms' spreads: **does not separate**. The centralised 0.000
is not a quality measurement — the arm produced no artifact at all (section 4).

### Stage 2 — LeanBio formalisation

| arm | mean | min–max | spread | $ | tokens | wall s | calls | cap stops |
|---|---|---|---|---|---|---|---|---|
| single | **0.990** | 0.971–1.000 | 0.029 | 0.464 | 108,568 | 44 | 3 | 0 |
| decentralised | **0.867** | 0.600–1.000 | 0.400 | 0.691 | 414,846 | 72 | 10 | 1 |
| centralised | **1.000** | 1.000–1.000 | 0.000 | 0.955 | 463,775 | 189 | 15 | 1 |

Largest gap 0.133 (centralised over decentralised), inside the decentralised arm's 0.400 spread:
**does not separate**. 8 of 9 final artifacts compiled, carried a proved non-vacuity witness, and had
load-bearing hypotheses. The single failure is the decentralised arm on `l2-t2`, and it is a merge failure
(section 5), not a formalisation failure.

### Stage 3 — design-studio usage

| arm | mean | min–max | spread | $ | tokens | wall s | calls | cap stops |
|---|---|---|---|---|---|---|---|---|
| single | **0.568** | 0.296–0.705 | 0.409 | 0.153 | 33,978 | 55 | 3 | 0 |
| decentralised | **0.720** | 0.682–0.773 | 0.091 | 0.392 | 98,848 | 51 | 9 | 0 |
| centralised | **0.599** | 0.455–0.750 | 0.296 | 0.912 | 192,760 | 194 | 15 | 2 |

Largest gap 0.152 (decentralised over single), inside the single arm's 0.409 spread: **does not separate**.
This stage is also the one whose task design is defective (section 6), so its quality numbers should not be
quoted at all.

### Stage 4 — validation-framework usage

| arm | mean | min–max | spread | $ | tokens | wall s | calls | cap stops |
|---|---|---|---|---|---|---|---|---|
| single | **1.000** | 1.000–1.000 | 0.000 | 0.352 | 87,703 | 27 | 3 | 0 |
| decentralised | **1.000** | 1.000–1.000 | 0.000 | 0.529 | 181,419 | 27 | 9 | 0 |
| centralised | **0.952** | 0.857–1.000 | 0.143 | 0.932 | 249,301 | 83 | 15 | 0 |

Largest gap 0.048, inside the centralised arm's 0.143 spread: **does not separate**.
This is the cleanest cell of the benchmark and the one that was expected to discriminate most. It did not.

### Cost, which is the part that does separate

| stage | decentralised $ | centralised $ | decentralised tokens | centralised tokens |
|---|---|---|---|---|
| nanopub | 2.4x single | 4.0x single | 4.4x | 4.8x |
| leanbio | 1.5x | 2.1x | 3.8x | 4.3x |
| design | 2.6x | 5.9x | 2.9x | 5.7x |
| validation | 1.5x | 2.6x | 2.1x | 2.8x |

Wall time tells the same story: the centralised arm took 3.1x to 4.3x the single agent's wall clock at every
stage, because its five calls run in two serial phases around a merge.

**An arm that wins by 5 % at 3x the tokens lost.** At every stage here, the largest quality gap is inside a
within-arm spread while the cost gap is 1.5x to 5.9x. On this benchmark the single agent is the best use of a
fixed budget, and the honest form of that sentence is: *nothing we measured justified the extra spend.*

---

## 3. The one trap, and all three arms passed it

Stage 4 task `l4-t3` is the most informative item in the set. In its fixture **no gate failed**, four of the
five named results are `cannot-assess`, and the scorer's own composite is **0.8449, flagged "plausible"**. An
arm that reads "nothing failed" plus a high composite as a pass fails the stage.

All three arms reported it correctly: all five statuses right, no summing, no treating `cannot-assess` as a
pass, the composite named only with its disclaimer, and the withheld verdict reported. All three opened on the
withholding or reached it within a paragraph. There is no architectural difference to report here, and that is
the finding.

---

## 4. The centralised arm's merge is where it breaks, and it is a budget effect

Under the pre-registered equal split of $0.45 across five calls ($0.09 each), the centralised arm produced
**no artifact on all three nanopub cells**. The cause is in the CLI's own result events, not inferred:

| call | cost | terminal_reason | tokens |
|---|---|---|---|
| `orchestrator-plan` | $0.0528 | `completed` | 12,197 |
| `worker-0` | $0.0629 | `completed` | 53,413 |
| `worker-1` | $0.0602 | `completed` | 53,065 |
| `worker-2` | $0.0774 | `completed` | 54,699 |
| `orchestrator-merge` | $0.1045 | **`budget_exhausted`** | 0 |
| `orchestrator-merge-retry` | $0.1147 | **`budget_exhausted`** | 0 |

(`runs/nanopub/centralised/l1-t1/`; the other two cells are the same shape.) The three workers succeeded and
their individual drafts graded 0.667, 0.833 and 0.667 — **better than any other arm's final artifact on that
task**. The arm died at the join.

The general form of this, which is the part worth carrying: **the merge call is structurally the most expensive
single call in a centralised architecture.** It must read every worker's output and then re-emit a complete
artifact, so its input scales with N and its output is full size. Any equal-total-budget rule divides the budget
by the call count and therefore starves exactly the step that makes centralisation worth doing — and starves it
harder as N grows. This is a general claim; the post-hoc test below is what we have to probe it.

### Post hoc (labelled, never mixed in): the same $0.45 split unevenly

`node swarm/benchmark/run.mjs --level nanopub --arm centralised --alloc uneven --tag posthoc-uneven`
gives the arm the **same $0.45 total**, allocated $0.05 plan / $0.09 per worker / $0.13 merge.

| task | calls | $ | tokens | wall s | cap stops | artifact |
|---|---|---|---|---|---|---|
| l1-t1 | 5 | 0.292 | 111,762 | 55 | 0 | produced |
| l1-t2 | 5 | 0.382 | 149,498 | 62 | 1 | produced |
| l1-t3 | 5 | 0.351 | 63,636 | 60 | 1 | produced |

**The merge was rescued by re-allocation, at the same total budget**, and at *lower* total cost than the even
split's failed runs ($1.02 against $1.61). So the honest headline is **"centralisation works here but is
budget-fragile at the join"**, not "centralisation does not pay". These numbers are post hoc, were produced
after the pre-registered failure was seen, and are never averaged into any table above.

---

## 5. What the merge rule threw away (a property of the rule, not the architecture)

The decentralised arm merges by a fixed, oracle-free medoid vote: keep the candidate most agreed with by the
other two. The rule never consults a grader, so it can discard a better answer. Every candidate was graded
separately for exactly this diagnosis. It discarded a better candidate in **2 of 12** swarm cells:

- `leanbio / l2-t2`: kept candidate 2 (score 0.6, **does not compile**) over candidates 0 and 1 (both 1.0, both
  compile). The kept file's non-vacuity witness instantiates `Pavail = 250` where its own equation
  `Pavail = eta*E*Q*(Ca-Cv)` gives `0.5*20*10*(10-5) = 500`, so `norm_num` leaves unsolved goals
  (`l2_t2.lean:17:74: error: unsolved goals`, verified by re-running `lake env lean` on the file by hand).
  **This single merge decision is the whole of the decentralised arm's deficit at stage 2.**
- `nanopub / l1-t3`: kept candidate 0 (0.611) over candidates 1 and 2 (both 0.778).

In the other 10 cells the vote kept the best candidate or a tie. A vote that could see the compiler would have
scored the decentralised arm 1.000 at stage 2 — but that would be scoring the grader, not the architecture, which
is why the rule was pre-registered oracle-free.

---

## 6. What could not run, and what the benchmark got wrong

Published because the alternative is to quote numbers that do not mean what they appear to.

### 6.1 Stage 3's briefs are infeasible. The stage cannot discriminate the arms.

`accepted` was reached in 1 of 9 cells, and **all three arms violated the identical five binding laws** on brief
1 (`thompson1917-ch03-07`, `scaling-area-law`, `scaling-strength-law`, `thompson1917-ch02-10`, `E2`). Measured
cause, by re-running `lean_check` on one arm's own design with a single field changed:

| design | binding violations |
|---|---|
| as submitted (brief's fixed `SL_m` 0.25, `mass_kg` 0.075) | **5** |
| same design, `SL_m` 0.19 (the laws' reference specimen) | **0** |
| the brief's fixed quantities alone, nothing else | **2** |

The sponsor's own fixed length and mass sit outside the Exocoetidae isometry band the accepted laws are scoped
to, so `accepted` was **unreachable by construction** on briefs 1 and 3 for every arm. Stage 3 measures the
brief, not the arms. Its quality column is reported for completeness and should not be quoted.

A second defect at the same stage: `invented_fields` penalises any numeric key outside the brief's
fixed-plus-free lists, but the shared input itself advertised about 45 valid `lean_check` keys. The centralised
arm's 5 "invented" fields on `l3-t1` are all keys the prompt listed. The metric is reported as pre-registered and
this is the reason not to read it as dishonesty.

### 6.2 Stage 1's `parses` measures the prompt, not the arms

`parses` came out **0 for every arm on every task**, and the reason is uniform and is the task design: the prompt
never asked for `nt:wasCreatedFromProvenanceTemplate`, so every record drew "Nanopub has no provenance template",
and every record is minutes old, which draws a creation-time note. Neither is an RDF or nanopub-structure problem.

A post-hoc secondary, `parses_valid_rdf`, tolerates those notes and asks only whether the validator accepts the
record. It separates where `parses` cannot:

| arm | records the validator accepts | what failed |
|---|---|---|
| single | **1 of 3** | `l1-t2` wrote `urn:locator:...` IRIs (invalid URI protocol, 11 occurrences); `l1-t3` was a hard `RDF ERROR` |
| decentralised | **3 of 3** | — |
| centralised | **0 of 3** | no artifact (section 4) |

Reported beside `parses`, never instead of it. At n = 3 it is one task of difference.

### 6.3 Two defects in this benchmark's own graders, found after results were seen

Both are published because finding them is the reason the per-check reasoning is in the logs.

- **A cap stop looked exactly like an infrastructure failure.** A call killed by its own `--max-budget-usd`
  reports `terminal_reason: budget_exhausted`, a **non-zero cost** and **zero tokens**. The harness classed
  zero-token calls as infrastructure failures, so it counted the centralised arm's budget-starved merges as
  crashes. Fixed in `agent.mjs` and recomputed from the saved per-call metadata, so no run had to be repeated.
  Harness failures, cap stops and architecture failures are now three separate columns everywhere.
  Final counts: **0 infrastructure failures in the whole matrix**; 13 cap stops, all attributable to a call
  exceeding its arm's per-call cap.
- **The `cannot-assess` guard fired on the right answer.** Its negation guard covered "not a pass" but not the
  article-less "not pass", so the phrase *"physics_check: cannot-assess, not pass"* — which is exactly what an
  honest report should say — was scored as pass-flavoured language and failed `validation / centralised / l4-t3`.
  The guard was widened and verified both ways (it still flags "genotype_similarity passed cleanly" and
  "physics_check is fine"). The centralised arm's stage-4 mean moves **0.905 to 0.952**; both numbers are here.

### 6.4 An absent artifact used to score 0.5

An artifact that does not exist trivially satisfies every "0 is better" component (no invented number can be in a
record that was never written), which gave the centralised arm a floor of 0.5 at stage 1 for producing nothing.
Corrected after the first grading pass: a cell with no artifact scores **0** and is flagged, with the uncorrected
component values kept beside it (`score_uncorrected` in `results.json` and on the page).

### 6.5 Deviations from `ARMS.md`

- **`locator_traceability` was rewritten before any level-1 call was made** (after three level-4 smoke cells had
  run). Original wording: *"fraction of the record's assertion-graph literals longer than 40 characters that cite
  at least one locator from the dossier"*. It would have scored near zero for every arm, because a locator is
  normally carried on the provenance graph rather than repeated inside each description, and a metric that is
  zero for everyone measures nothing. Replaced by "fraction of the dossier's locators that appear literally in
  the record", with `untraceable_assertions` kept as the diagnostic. No level-1 output had been seen.
- **Stage 4's validator was run by the harness, not by the arms.** Pre-registered and re-stated here: it makes
  the input byte-identical (a re-run seeded ensemble would not be) and removes tool-invocation failure from a
  stage whose subject is honest *reporting*. The cost is that stage 4 does not measure whether an arm would think
  to call the validator at all.
- **Briefs split their quantities into fixed and free** (added to `ARMS.md` before any level-3 call), so an arm is
  never penalised for a number it was asked to choose.

### 6.6 Things that did not run

- **No replicate.** `swarm/compare/` ran one replicate per arm; this benchmark did not, for time. With n = 3 and
  a non-deterministic CLI (temperature is not settable through `claude -p`), a replicate is the first thing to add.
- **No tool-using variant.** The whole experiment is tool-free by design (limitation 2).
- **No N other than 3**, and no unequal-budget variant other than the one post-hoc allocation test.

---

## 7. Compliance

- **Aves holdout respected.** No bird taxon, claim id or dataset appears in any task, dossier, brief or fixture.
  `node holdout/check-leaks.mjs` was run over every generated artifact as part of grading: **0 strong hits and
  0 claim-id hits** across the 9 final nanopub records and the 17 graded swarm candidates; 9 of 9 final records
  `leak_clean`.
- **One `lake` process at a time**, enforced in the grader by a guard that throws rather than racing.
- **No other thread's folder was written.** `sim-engine/`, `lean/`, `holdout/` and `swarm/compare/` were read and
  invoked, never modified. `swarm/compare/run.mjs`'s `runClaude` is the acknowledged source of `agent.mjs`.
- **No credentials in any file.** Agents ran with `--tools ""` and a cwd outside the repository, so no agent could
  write into the tree.
- **Nothing committed, nothing deployed.**
- **Every grader check was made to fail once before it was trusted**: 12 checks, each with a corrupted input that
  flipped its verdict, in `fixtures/grader-selftest.json`. One of them (an intact repository record failing
  `parses`) exposed a real defect in this grader before any arm was scored.

## 8. Files

| path | what |
|---|---|
| `ARMS.md` | the pre-registration: arm definitions, metrics, budget choice |
| `agent.mjs` | one headless `claude -p` call; adapted from `swarm/compare/run.mjs` |
| `levels.mjs` | per-stage shared input, output schema, merge similarity |
| `run.mjs` | the three arms |
| `grade.mjs` | all four graders, plus `--selftest` |
| `publish.mjs` | `results.json` and the traceable per-cell logs |
| `tasks/`, `fixtures/` | the 12 task inputs and the `validate_generation` fixtures with their SHA-256 |
| `runs/` | every call: prompt, raw output, tokens, cost, timings, stop reason |
| `graded/` | every grader verdict, including each swarm candidate |
| `dashboard/public/t/benchmark/` | the page, `data.json`, and 36 traceable cell logs |
