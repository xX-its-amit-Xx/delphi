# Three architectures, four levels: arm definitions and pre-registered metrics

**Written 2026-11-01, before any arm was run.** Nothing in this file is edited after the first arm starts.
Anything learned afterwards goes in `RESULTS.md` under "Deviations", with a time, including any metric that
changed after data were seen.

This is a separate experiment from `swarm/PREREG.md` + `swarm/compare/`, which compared four arms on one
task (naming a verifiable dataset for a historical claim). That pipeline belongs to another thread and is
not touched. Its call mechanism (headless `claude -p`, `--json-schema`, `stream-json` event parsing, cost
and token accounting from the `result` event) is **reused**: `swarm/benchmark/agent.mjs` is adapted from
`swarm/compare/run.mjs` `runClaude`, with that file named as its source. What is new here is that the unit
of comparison is a **level of the DELPHI stack**, each with its own grader, and that the graders are the
repository's own existing checks rather than a checker written for the experiment.

---

## 1. The three arms

`N = 3`, `model = claude-sonnet-5-5`, and the **total token budget per cell is equal across all three
arms**. A cell is one (arm, level, task). These three numbers are held fixed everywhere.

| arm | definition | calls per cell | per-call cap |
|---|---|---|---|
| **single** | One agent does the whole task end to end. It sees the whole input and emits the final artifact. | 1 | $0.45 |
| **decentralised swarm** | `N = 3` agents work the **same** task **independently**. No agent sees another agent's work while working. There is no orchestrator and no shared state. The three outputs are merged at the end by a fixed, pre-registered, **oracle-free** rule (section 3). | 3 (parallel) | $0.15 |
| **centralised swarm** | An orchestrator call splits the task into `N = 3` subtasks; three workers each receive one subtask plus the same shared input; a second orchestrator call sees **all three** worker outputs and decides what is kept, emitting the final artifact. | 5 (1 plan + 3 parallel workers + 1 merge) | $0.09 |

### 1.1 The budget choice, stated once

**Equal TOTAL budget per cell ($0.45 list price), not equal budget per agent.** The question answered is
therefore *"what is the best use of a fixed budget?"* — the single agent gets the whole $0.45 in one call;
each decentralised agent gets $0.45/3; each centralised call gets $0.45/5.

This is a choice, and it is the one that disadvantages the swarms: splitting a fixed budget three or five
ways means each swarm agent has a smaller cap than the single agent. The alternative experiment — give the
single agent 1/N of the budget, or give every *agent* $0.45 so the swarms cost 3x and 5x — answers a
different question ("is more parallel compute better?") and is **not run here**. This is listed as a
limitation in `RESULTS.md`, and cost is reported beside quality on every figure and in every table, so a
swarm that wins by a little at several times the cost is visible as a loss.

The cap is enforced by the CLI's own `--max-budget-usd` per call. A call that would exceed its cap is
stopped by the CLI, which is recorded as a cap stop and not as a quality failure.

### 1.2 Tools: none

Every call runs with **no tools** (`--allowedTools` empty). Everything an arm needs is in its prompt, and
the prompt for a given task is **byte-identical** in the shared-input portion across all three arms. This
is deliberate:

- it makes the arms' inputs provably identical, which is the thing a comparison needs most;
- it removes the largest source of harness failure (a `claude -p` tool timeout is not an architecture
  property), which `swarm/compare/DEVIATIONS.md` had to disclose repeatedly;
- it means this benchmark measures the three architectures **as reasoning architectures over fixed
  inputs**, and does **not** measure tool-use or tool-coordination skill.

That last point is a real limitation and it is stated again in `RESULTS.md`. In particular, level 3
measures *"writes a design specification the studio accepts"*, not *"drives the studio interactively"*, and
level 4 measures *"reads the validator's own output and reports it honestly"*, not *"invokes the
validator"* (section 2.4).

### 1.3 What the decentralised arm is, and is not

With no tools and no shared state, the decentralised arm is **three independent samples plus a vote**. That
is the honest reading of "N agents work the same task independently with no shared state, merged at the
end", and it is a real and commonly deployed baseline (self-consistency). It is **not** a blackboard swarm
with inter-agent messaging; `swarm/compare/`'s `decentralized` arm, which does have a shared board, is a
different design and its numbers are not comparable to these.

### 1.4 Prompt construction

For every level, each call's prompt is `ROLE_BLOCK + "\n\n" + SHARED_INPUT`, where `SHARED_INPUT` is a
per-task string read from `tasks/*.json` and is identical for every arm and every call in that task.
`ROLE_BLOCK` is the only thing that differs, and the three role blocks are in `prompts/`. Temperature is
not settable through the CLI, so **runs are not deterministic**; this is why effect sizes and spreads are
reported rather than point claims (section 4).

---

## 2. The four levels and their pre-registered metrics

Each level has one grader script. Each grader was made to **fail once on purpose** before the arms ran, and
the failing case is recorded in `fixtures/grader-selftest.json`. A metric here is not changed after results
are seen; if one is, `RESULTS.md` says so under "Deviations".

### 2.1 Level 1 — nanopub creation

**Input (identical per task).** A *finding dossier*: 4 to 7 facts, each with its own **locator** (a repository
file path plus a line number, field name or SHA-256), and a verbatim TriG skeleton (prefixes and the four
named graphs) copied from `holdout/nanopubs/unsigned/triage-coverage.trig`.

**Output.** One TriG nanopublication draft, unsigned, for that finding.

**Graded by (`grade-nanopub.mjs`):**

| metric | how it is measured | direction |
|---|---|---|
| `parses` | `java -jar nanopub-1.95.0 check -v` reports the file valid, read structurally by **the repository's own `holdout/nanopubs/check.mjs`** (not a pattern scan), with the same `EXPECTED_ISSUES` allowance for unsigned drafts | 1 is better |
| `leak_clean` | `node holdout/check-leaks.mjs <the arm's output dir>` exits 0 with no `strong` and no `claim` hit | 1 is better |
| `locator_traceability` | fraction of the record's **assertion-graph literals longer than 40 characters** that cite at least one locator from the dossier (file path, line number, accession or SHA-256 prefix, matched literally). A record that asserts things with no locator scores low | higher is better |
| `unsupported_numeric_claims` | count of numeric literals in the assertion graph that do **not** appear in the dossier (an invented number) | 0 is better |
| `boilerplate_reuse` | over the arm's **three** records for the three tasks: the fraction of the five template-shaped fields (`rdfs:label` on the claim, `dct:description` on the claim, `rdfs:label` on the evidence item, `dct:description` on the evidence item, `rdfs:comment` in pubinfo) whose value is byte-identical across two or more of the arm's three records, after whitespace normalisation. **This is the "shared boilerplate rather than real content" test** | 0 is better |
| `quotable_line` | does the record contain a single sentence a reader could quote that is true of the finding *and* states its limit? Measured mechanically as: the claim's `dct:description` contains a status word (`established`, `observed`, `inconclusive`, `pre-registered`, `burned`, `measured`, `not established`) **and** a limiting clause (a sentence matching `/does not (establish|show|mean|prove)|is not (a|an|evidence)|nothing about|silent on|says nothing/i`) | 1 is better |

**Level score** = unweighted mean of `parses`, `leak_clean`, `locator_traceability`, `quotable_line`,
`1 - min(1, unsupported_numeric_claims/3)`, and `1 - boilerplate_reuse`. The six components are reported
separately as well; **the mean is never the only number shown**.

### 2.2 Level 2 — LeanBio formalization

**Input (identical per task).** One claim in English, plus the list of **required content elements** for
that claim, fixed in `tasks/level2.json` before any arm ran, plus the instruction that the file must import
only `Mathlib`.

**Output.** One self-contained Lean 4 file containing a theorem named `task_<id>` with a complete proof, and
a second declaration named `task_<id>_witness` that instantiates every hypothesis of `task_<id>` with
concrete numbers (the non-vacuity witness, in the shape the registry already requires — see
`lean/registry/lean/Witnesses.lean` and the `non_vacuity_witness` field in
`lean/registry/laws-registry.schema.json`).

**Graded by (`grade-lean.mjs`). One `lake` process at a time, serially, never concurrently.**

| metric | how it is measured | direction |
|---|---|---|
| `compiles` | `lake env lean <file>` in `lean/` (ELAN_HOME=`C:\Temp\elan`) exits 0 with no `error:` on stderr. **This is the ground truth** | 1 is better |
| `no_cheats` | the file contains none of `sorry`, `admit`, `axiom `, `native_decide`, `@[implemented_by`, `Classical.choice` as a proof term, `:= trivial` as the whole proof of `task_<id>` | 1 is better |
| `witness_present_and_proved` | a declaration named `task_<id>_witness` exists, and the file compiles (so the witness is proved, not asserted) | 1 is better |
| `hypotheses_load_bearing` | the grader mechanically strips from `task_<id>` every binder whose type contains a relational operator (`<`, `≤`, `=`, `≠`, `>`, `≥`, `∈`) and re-compiles the stripped theorem under a fresh name. **If the stripped version still compiles, the hypotheses were decorative and this metric is 0** — a statement that compiles but is trivially true is a FAILURE, as required | 1 is better |
| `says_what_the_claim_says` | fraction of the task's pre-registered **required content elements** present in the theorem statement. Each element is a (regex, description) pair fixed in `tasks/level2.json` before the arms ran, so the judgement is mechanical. The benchmark author also records a one-line human read per item in `RESULTS.md`; where the mechanical score and the human read disagree, **both are reported and the disagreement is the finding** | higher is better |

A file that compiles but scores 0 on `hypotheses_load_bearing` **counts as a failure of the level**, not a
partial credit: `level_pass` requires `compiles AND no_cheats AND witness_present_and_proved AND
hypotheses_load_bearing AND says_what_the_claim_says >= 0.75`.

**Level score** = unweighted mean of the five metrics. Reported alongside `level_pass`.

### 2.3 Level 3 — design studio usage

**Input (identical per task).** A text brief naming the taxon, life stage, flight mode, and a set of SI
quantities with values and units. Each brief splits its quantities into **fixed** (the sponsor's numbers,
which must appear in the design under the contract's own key for them) and **free** (the arm chooses).
`brief_fields_present` counts only the fixed ones, so an arm is never penalised for a number it was asked to
choose, and `accepted` is reachable on every brief.

**Output.** One `design` object for `lean_check` — the SI-unit specification the studio judges.

**Graded by (`grade-design.mjs`), with `node sim-engine/cli.mjs tool lean_check --json {...} --lawset 1.8.1`:**

| metric | how it is measured | direction |
|---|---|---|
| `accepted` | `lean_check` returns an envelope with no error, **and** every quantity the brief states is present in the design under the contract's own key for it, with the brief's value to within 1 % relative, **and** `binding_violations == 0` | 1 is better |
| `binding_violations` | `result.summary.binding_violations` at lawset **1.8.1** | 0 is better |
| `evaluable_binding_laws` | number of binding laws whose verdict is `holds` or `violated` (that is, actually evaluated rather than `cannot-evaluate`). **This metric exists to defeat the degenerate strategy of naming almost nothing**, which scores zero violations by being unjudgeable | higher is better |
| `brief_fields_present` | fraction of the brief's stated quantities present and correct in the design | higher is better |
| `invented_fields` | count of numeric design keys the brief did not state and the arm did not flag as an assumption in its `assumptions` list | 0 is better |

Lawset is pinned to **1.8.1** (`lean/registry/lawsets/current.json`, created 2026-11-01T05:37:39Z) for every
call, so a lawset release mid-experiment cannot move the numbers.

**Level score** = mean of `accepted`, `brief_fields_present`, `evaluable_binding_laws / max_over_tasks`, and
`1 - min(1, invented_fields/3)`.

### 2.4 Level 4 — validation framework usage

**Input (identical per task).** The **verbatim** output of `validate_generation` for a (generated, base,
desired_phenotype) triple, as a trimmed JSON object holding `inputs.sequence`, `results` (all five, each
with its `status` and its full reason text), `per_scale_coverage`, `verdict` (all eight fields) and
`composite_score_from_the_scorer` **including its own note verbatim**. The three fixtures were generated by
`node sim-engine/validate-cli.mjs` before the arms ran and are stored with their SHA-256 in
`fixtures/level4-manifest.json`. The full 600–750 KB reports are kept beside them.

The harness runs the validator, not the arm. This is a stated deviation from "the arm runs
`validate_generation`": it is done because (a) it makes the input byte-identical across arms, which a
re-run of a seeded ensemble would not be, and (b) it removes tool-invocation failure from a level whose
subject is *honest reporting*. The cost is that this level does not measure whether an arm would think to
call the validator at all. Recorded as a limitation in `RESULTS.md`.

**Output.** A report of the result for a collaborator.

**Graded by (`grade-validation.mjs`). These are the failures named in the task, and each is checked for
explicitly:**

| metric | how it is measured | direction |
|---|---|---|
| `five_named_correct` | all five named results are named **and** each is given the status the fixture gives it (`pass` / `fail` / `cannot-assess`), to the exact word | 1 is better |
| `no_summing` | the report contains no summed, averaged, counted-as-score or "x of 5 passed" treatment of the five results. Checked as: no arithmetic combination of the five appears (`/\b\d\s*(\/|of|out of)\s*5\b/`, `/\b(sum|total|average|mean|aggregate|overall)\s+(score|result|gate)/i`, a numeric "score" the fixture does not contain) | 1 is better |
| `cannot_assess_not_a_pass` | no `cannot-assess` result is described with pass-flavoured language (`pass`, `passed`, `clear`, `clean`, `satisfied`, `ok`, `fine`, `no problem`), and the report states somewhere that `cannot-assess` is not a pass | 1 is better |
| `composite_not_the_verdict` | if the composite is mentioned, it is mentioned with its disclaimer (not the verdict / for reference only / no gate feeds it); the report never states the composite as the outcome, and never calls the design plausible or validated on the strength of it | 1 is better |
| `withholding_reported` | the report states that the word "validated" is withheld, and gives at least `ceil(k/2)` of the fixture's `k` `withheld_because` reasons | 1 is better |
| `scales_reported` | the report names the biological scales that could not be assessed (`cell`, `tissue`, `organ_system`) | 1 is better |
| `fabrications` | count of statuses, numbers or reasons in the report that contradict the fixture | 0 is better |

`level_pass` requires `five_named_correct AND no_summing AND cannot_assess_not_a_pass AND
composite_not_the_verdict AND fabrications == 0`.

**Level score** = mean of the six boolean metrics and `1 - min(1, fabrications/3)`.

Task 3 is kept in the set deliberately: in its fixture **no gate failed**, four could not be assessed, and
the scorer's composite is 0.8449 "plausible". An arm that reads "nothing failed" plus a high composite as a
pass fails this level, and that is the single most informative item in the benchmark.

---

## 3. The merge rules (fixed, oracle-free)

The decentralised arm's merge must not consult a grader, or the arm would be scored on the grader's own
judgement rather than on its architecture. All merges are therefore **medoid votes**: of the three
candidates, keep the one with the highest mean similarity to the other two; a tie is broken by the lowest
worker index (workers are indexed 0, 1, 2 in launch order, which is fixed).

| level | similarity used by the medoid vote |
|---|---|
| 1 nanopub | Jaccard of the set of dossier locators cited in the assertion graph |
| 2 lean | Jaccard of the identifier/operator token multiset of the theorem statement |
| 3 design | fraction of shared design keys whose values agree within 1 % |
| 4 validation | agreement of the five reported statuses, then Jaccard of reported `withheld_because` reasons |

The centralised arm does **not** use a medoid; its second orchestrator call decides, which is the point of
the arm. Both swarm arms are therefore scored on exactly one final artifact per cell, like the single arm.

For diagnosis only, every individual candidate in both swarm arms is **also** graded, and
`RESULTS.md` reports how often the merge discarded a candidate that would have scored better. That number
is a property of the merge rule, not of the architecture, and is labelled as such.

---

## 4. n, and what cannot be claimed

**3 tasks x 4 levels x 3 arms = 36 cells.** n = 3 per (arm, level). That is an n at which **no claim of
statistical significance is possible**, and none will be made. `RESULTS.md` reports, for every (arm, level):
the three per-task scores, their mean, their min–max spread, the raw cost in tokens and dollars, and the wall
time. Differences are reported as effect sizes (difference of means, in the metric's own units, beside the
spread). A difference smaller than the within-arm spread is reported as **not separating**.

If the arms do not separate, `RESULTS.md` says they do not separate. A null result is the expected outcome
at this n and is reported as the result, not buried.

## 5. Failure attribution

Every failure is classed in `RESULTS.md` as one of:

- **architecture** — the arm produced an artifact and the artifact was wrong;
- **harness** — the CLI errored, timed out, returned no parseable output, or the cap stopped the call before
  it answered (`stop_reason`, `terminal_reason` and `is_error` are recorded per call from the CLI's own
  `result` event);
- **grader** — the grader could not run (missing `java`, Lean toolchain, etc.).

Harness and grader failures are excluded from the level scores and listed separately with their counts, in
the same way `swarm/compare/metrics.mjs` excludes zero-token runs as infrastructure failures. A cell with a
harness failure is **retried once**, and both attempts are kept on disk.

## 6. What is logged

Every call writes `runs/<level>/<arm>/<task>/<label>.json` holding: the full prompt as sent, the raw CLI
`result` event, the parsed structured output, `cost_usd`, the four token counts, `duration_ms`,
`num_turns`, `stop_reason`, `terminal_reason`, `is_error` and stderr. Every grader writes its full output
per artifact. `results.json` is recomputable from those files alone, and `RESULTS.md` quotes nothing that is
not in them.

## 7. Rules this experiment runs under

- **Aves is a frozen holdout.** No bird data, no bird taxon, no bird claim id is used in any task, dossier,
  brief or fixture. `holdout/check-leaks.mjs` is run over `swarm/benchmark/` as part of grading and its
  result is reported.
- No credentials in any file. No agent output is written outside `swarm/benchmark/`.
- One `lake` process at a time.
- No other thread's folder is edited. `sim-engine/`, `lean/`, `holdout/` and `swarm/compare/` are **read and
  invoked, never written**. The one exception is unavoidable and disclosed: `sim-engine/sessions/` is
  gitignored session state, and **no tool that writes it is called by this experiment** (`lean_check`,
  `validate_generation` and `lake env lean` are all read-only).
- Nothing is committed and nothing is deployed.
