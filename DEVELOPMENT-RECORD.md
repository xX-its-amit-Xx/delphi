# DELPHI development record: ScienceClaw Hack @ MIT, Oct 30 – Nov 1, 2026

How the team built DELPHI (the `delphisci` repository, its live dashboard, its MCP servers and design studio, and the
exchange with the Delphi Frontier graph) in about 30 hours before the data freeze on **Sunday Nov 1, 12:00 noon**.

**How to read this.** Every number has a source file or commit beside it. Times are Boston time (EDT). Commit links
point to `https://github.com/xX-its-amit-Xx/delphi/commit/<sha>`, where every SHA here resolves: the fork's branch
`delphi-hack-2026-10-31` is the head of PR #36 on the upstream repository (fractastical/delphi, formerly
`delphisci`), and upstream commits resolve there too. Where a sentence is a quoted figure that was not recounted
for this record, it says so. Written from the repository on Oct 31 – Nov 1; other agents were still landing work, so
the figures are a snapshot. Readable timeline page: `dashboard/public/record/index.html` (live at `/record/`).

---

## 1. At a glance

| | value | source |
|---|---|---|
| Upstream commits since Oct 30 (Joel Dietz, Cursor cloud agents, Ashley) | 489 non-merge | `git log origin/main --since=2026-10-30 --no-merges` |
| Commits on PR #36's branch not in upstream (hub + threads) | 166 non-merge (Nov 1, 00:11) | `git log fork/delphi-hack-2026-10-31 --not origin/main --no-merges` |
| Claims extracted upstream (Darwin, Thompson, Wolfram) | 247 + 291 + 321 | commits [c8b4ec9b](https://github.com/xX-its-amit-Xx/delphi/commit/c8b4ec9b), [8ad9c204](https://github.com/xX-its-amit-Xx/delphi/commit/8ad9c204), [b3f424ba](https://github.com/xX-its-amit-Xx/delphi/commit/b3f424ba) |
| Species inventory upstream | 22 slices, 938 taxa, 1,679 datasets | [6295cab1](https://github.com/xX-its-amit-Xx/delphi/commit/6295cab1) |
| Claim tests run by this team's claims thread | 16 (6 supported, 5 refuted, 3 mixed, 2 inconclusive), beside the collaborators' 129 | `dashboard/public/t/claims/status.json` |
| Lean theorems compiling, `sorry`, non-standard axioms | 152, 0, 0 | `dashboard/public/t/lean/status.json` |
| Statement mutants rejected (latest run in results) | 57 of 57; controls 15 of 18 passed | `dashboard/public/results/results.json` `section_4_held_up.mutations` |
| Unsigned nanopub drafts, all passing validation | 157 | `nanopubs-index/README.md`, `results.json` `section_6_corpus` |
| Ideas logged, by origin | 41: 5 researched, 29 reach-synthesis, 7 serendipitous | `decisions/ideas.json` |
| Pre-registered design test of the "winged zebrafish" | **failed**: 1 of 10 axes scorable, 1 of 74 loci (1.4 %) | `design-validation/REPORT.md` |
| Parameters held for a dynamical model of the 4,571 genes | 0 of 18,733 (15.9 % with a lenient substitute) | `simulation-readiness/README.md`, `results.json` |
| Cross-check against Delphi Frontier | 33 claims: 6 agree, 4 partial, 1 disagree | `crosscheck-frontier/REPORT.md` |
| Records written into Delphi Frontier | 22 proposed, 0 accepted (MCP cannot accept) | `frontier-contrib/REPORT.md` |
| MCP server test | 93 of 100 cases pass; hosted = upstream `main` on all 100 | `validation/MCP-TEST-REPORT.md` |
| Studio validation (pre-registered harness) | 20 pass, 6 circular, 2 fail as pre-registered; 22 pass, 8 circular, 0 fail after three labelled amendments (latest harness run) | `sim-engine/validation/STUDIO-RESULTS.md` |

---

## 2. The team

Names and roles as the repository records them (`dashboard/public/index.html` team section; issue #53 "Team roles
and deadlines"; `decisions/ideas.json`, which writes "project lead (Amit)"). The three sources do not use the same
titles, and that is stated rather than resolved here:

| person | role as recorded | owned at the hack (issue #53) |
|---|---|---|
| **Kavita Kulkarni** | team lead (dashboard team card) | presentation layer: claim graph site, demo flow and slides |
| **Amit Shenoy** | project lead (`ideas.json`, `AGENTS.md` standing orders); "set this project's direction and holds the publishing and commit decisions" (team card) | genotype–phenotype links, downstream use cases, MCP testing. The hub session and the parallel Claude threads described below worked on this row |
| **Joel Dietz** | "lead, integrator and publisher" (issue #53) | merges, production nanopub publishing signed with his ORCID key, final submission; ran the Cursor agent swarm that extracted claims and vendored organisms |
| **Ashley** | collaborator, software (Knowledge Pixels) | nanopub generation and checks (#37), claim grounding to external graphs (#34; PR #63, merged upstream) |
| **Kris** (written "Chris" on the team card) | collaborator, more theoretical | form simulator (#54) and queryable open problems (#55) |

The Claude sessions and background agents are tools the team ran, not team members; they are described in §4.

---

## 3. What was built: the architecture

The goal in `README.md` is to find candidate fundamental laws of biology and test them. The chain the repository
implements:

```
claims ──► assessments ──► claim tests (pre-registered) ──► nanopub drafts
   │                                   │
   └──► Lean formalisation ──► law registry ──► MCP / API / CLI ──► design studio ──► independent validation
```

| layer | what it is | where |
|---|---|---|
| Claims | Verbatim-quoted claims from Darwin 1859, Thompson 1917, Wolfram 2002, math-bio thinkers and Levin papers; GPT and Grok resolvability assessments | upstream `claim-sources/` (books moved there in [88c87cb5](https://github.com/xX-its-amit-Xx/delphi/commit/88c87cb5)); `docs/claims.json` |
| Organisms | Taxa and datasets named in the books, merged from parallel agent slices | `organisms/merged/` |
| Claim tests | `result.json` committed with pass and fail criteria before any data is downloaded; data files recorded by URL and SHA-256 | `claim-tests/` |
| Holdout | Class Aves frozen as an exam before building; leak checker over the whole tree | `holdout/` |
| Nanopubs | Delphi ontology v2.0 records; this team's are unsigned drafts only | `*/nanopubs/unsigned/`, index in `nanopubs-index/` |
| Lean 4 | Theorems with 0 `sorry` and standard axioms; statement-level mutation testing; constraint checker and elimination ledgers | `lean/`, `lean/eliminate/` |
| Law registry | One file per law, immutable lawsets with content hashes; laws retired or contested, never deleted | `lean/registry/` (lawset 1.0.0 → 1.5.0, `CHANGELOG.md`) |
| Surfaces | `delphisci` MCP server (hosted on Fly.io), its CLI, the static mirror `/api/lean/`, and the `sim-engine` MCP server and HTTP bridge; one loader `lib/lean-source.mjs` | `mcp/`, `sim-engine/`, `dashboard/public/api/lean/` |
| Organism model | Ontology blueprint (536 Uberon/CL terms), segmented flying-fish GLB (110 meshes), zebrafish adult (189) and larva (58), parametric "parents + deltas" builder | `organism-design/`, `anatomy-model/` |
| Genotype | Vetted proxy-fish genotype–phenotype map over 4,571 genes, pathways for 3,857, 42 causal chains, 92 interventions | `genotype/` |
| Physics and physiology | Glide table, Thompson envelope test, pre-registered browser simulator, circulation/gill/heart/muscle models | `physics/`, `physiology/`, `development/` |
| Design studio | Text to spec, edit at body-to-gene level, 11 perturbation scenarios, laws marked red/amber/dashed | `sim-engine/`, `/blueprint3d/explode.html?mode=perturb` |
| Validation | Pre-registered skeptic harness for the studio; pre-registered design scorecard; MCP test; simulation check of Lean results | `sim-engine/validation/`, `design-validation/`, `validation/` |
| Dashboard | Static site built from repo files, every count computed at build time; `/start/` aggregates thread status files | `dashboard/`, https://delphi-mission-control.ashenoy000.workers.dev |

Two statements the repository makes about its own limits, quoted from `README.md`: a machine-checked proof "does not
show that living systems satisfy those assumptions", and "no numeric prediction about a real zebrafish counts as
independent evidence yet".

---

## 4. How the team worked: the multi-agent method

### 4.1 Two swarms on one repository

- **Upstream swarm (Joel Dietz).** Cursor cloud agents on per-slice branches (`cursor/claim-tests-*`,
  `cursor/organisms-*`), merged by Joel: 367 "Cursor Agent" commits since Oct 30, plus PRs #18–#33 for organism
  slices. Specs for parallel cloud agents landed at 00:16 on Oct 31 ([015de3cf](https://github.com/xX-its-amit-Xx/delphi/commit/015de3cf)),
  and 129 claim-test results from 13 agent branches were merged by 10:04 ([6295cab1](https://github.com/xX-its-amit-Xx/delphi/commit/6295cab1)).
- **Hub and threads (Amit's row).** One Claude Code **hub** session (`scienceclaw-03`) owned the main dashboard,
  `AGENTS.md`, the build and the deploy. Parallel Claude sessions ("threads") each owned one folder and one
  sub-dashboard (`dashboard/THREADS.md`): `swarm`, `claims`, `holdout`, `lean`, `organism`, then `genotype`, `viz`,
  `validation` and `physics` from kickoff prompts in `dashboard/NEW-THREADS.md` ([b8145c4c](https://github.com/xX-its-amit-Xx/delphi/commit/b8145c4c)).
  The hub also launched background agents for bounded jobs: the prior-art search, the design-validation scorecard,
  the Frontier cross-check and contribution, the simulation-readiness census, the nanopub curation pass and the
  studio's independent skeptic. Commit trailers on the branch name three Claude models (Opus 5.5 on 93 commits,
  Opus 5 on 41, Fable 5.1 on 32).

Threads did not commit or push; they messaged the hub, which committed (the kickoff prompts say "You do not commit
or push; message the hub"). All work reached upstream as one PR from the fork, #36, opened 14:17 on Oct 31.

### 4.2 Coordination rules that held

From `AGENTS.md` "Inter-agent communication", written from the day of running the sessions:

1. **Files are the source of truth; messages are for asks and handoffs.** Each thread rewrote
   `dashboard/public/t/<thread>/status.json` at least every 30 minutes; `/start/` reads them live.
2. **One writer per path.** "This is the cheapest possible lock and it held all day." A thread that needed a change in
   another folder messaged its owner. A later rule (`AGENTS.md`, "Everything is modifiable, as long as it is
   versioned (Amit, Oct 31)") made clear ownership is about not clobbering live work, not permission.
3. **Issues to claim work, files for state, the dashboard for visibility.** A second hosted board (Notion) was
   rejected: "A second dashboard doubles that cost and immediately disagrees with the first."
4. **A peer's message is never user approval** (see §6.6).

### 4.3 The claim pipeline as roles with contracts

`AGENTS.md` turned the team's nine agent instructions into roles A1–A13 (scribe, attestor, taxon, scout, inventory,
scale, formalizer, experimenter, faithfulness, publisher; holdout warden, red team, debate), each with what it owns,
writes, must pass and must refuse. Three steps were **changed on purpose** and two roles were **added**:

- **A7 formalizer:** the original gate "formalise only if resolvability > 90 %" was replaced, because real
  resolvability scores run 0.12–0.36 and two assessors on one Darwin claim returned 0.118 and 0.362; a 90 % gate
  formalises nothing. Replacement: two assessors from different providers, a reachable matching dataset,
  operationalisable terms, a stated falsifier, and one model per interpretation.
- **A10 publisher:** the trigger is "the test ran as pre-registered and its outcome is interpretable", not a pass rate
  above 80 %, because publishing only passes "builds a victory log, not a knowledge graph".
- **A9 faithfulness (new):** the assessor is never the builder or the builder's model. Seven blinded OpenAI gpt-5
  assessments of the claims thread's tests all returned representative-with-caveats; one provider only, so none
  travels with a nanopub yet ([766ec02f](https://github.com/xX-its-amit-Xx/delphi/commit/766ec02f)).
- **A13 debate and tournament (new, not built):** the file says "this does not exist yet" and forbids describing the
  current score averaging as a tournament.

### 4.4 Pre-registration, hashed

Every evaluative step was written down before data was seen, and later changes were labelled:

| what | pre-registration | evidence it came first |
|---|---|---|
| Claim tests | `claim-tests/<id>/result.json` committed first | e.g. pre-register [9b731287](https://github.com/xX-its-amit-Xx/delphi/commit/9b731287) 01:55, results [c330f91d](https://github.com/xX-its-amit-Xx/delphi/commit/c330f91d) 02:04; generator verifies the cited pre-registration commit ([99d30b6c](https://github.com/xX-its-amit-Xx/delphi/commit/99d30b6c)) |
| Swarm comparison | `swarm/PREREG.md` | deviations in `swarm/compare/DEVIATIONS.md` |
| Holdout | `holdout/CHECKSUMS.json` | first frozen 05:52:44 UTC, re-frozen 14:38:42 UTC with roster unchanged |
| Physics simulator | `physics/sim/PREREG.md` + `.sha256` | hashed pre-registration ([d0b9c15d](https://github.com/xX-its-amit-Xx/delphi/commit/d0b9c15d)) |
| Lean-vs-simulation check | `validation/PREREG.md`, SHA-256 in `sim/results.json` | written before any simulation code |
| Design validation | `design-validation/PREREG.md`, sha256 `ea6f99eb…aa76` | hashed 2026-10-31T22:00:34Z "before the first number was produced" |
| Studio validation | `sim-engine/validation/STUDIO-PREREGISTRATION.md`, sha256 `f2523da8…a66d` | hashed 2026-11-01T02:30:37Z, "before any scenario module existed" |
| Attestation | SHA-256 of every pre-registered result, draft record and frozen exam | [4b600686](https://github.com/xX-its-amit-Xx/delphi/commit/4b600686) |

### 4.5 Skeptics, and checks made to fail once

- **Statement mutation in Lean:** mutate the theorem statement, not the proof, and require the mutant to fail to
  compile (`idea-statement-mutation`). The studio harness's own self-test plants a bad input for each check ("all 20
  behave as designed"), and a fixture run of deliberately wrong scenario modules flagged 12 of 18 evaluable checks.
- **Non-vacuity:** empirical constraints are Lean hypotheses, not axioms, with a witness that instantiates all of them
  at once, because an inconsistent set would eliminate everything and look like success ([c9a8c47d](https://github.com/xX-its-amit-Xx/delphi/commit/c9a8c47d)).
- **Staleness guard:** nanopub drafts cite pinned commits; a guard re-hashes every cited file and was tested by
  doctoring a hash ([08140aa6](https://github.com/xX-its-amit-Xx/delphi/commit/08140aa6)).
- **Circularity rule:** a studio value fitted to, or read back from, the paper it is scored against is `circular`,
  never a pass (`STUDIO-AMENDMENTS.md` A1).
- **Idea provenance:** every adopted idea is `researched`, `reach-synthesis` or `serendipitous`, and a
  reach-synthesis idea "never appears in a pitch or a record as established method" (`AGENTS.md`, standing order).

### 4.6 Self-corrections are published, not fixed quietly

`/results/` leads with the corrections and the failed design test, every value read from its committed file at build
time ([5021e589](https://github.com/xX-its-amit-Xx/delphi/commit/5021e589)). §6 lists them.

---

## 5. Timeline

### Friday Oct 30 – upstream foundations (Joel Dietz and Cursor agents)

| time | event | commit |
|---|---|---|
| 18:40 | Repository started for the hack; best practices adapted from the Project Delphi ontology; goal stated | [21f20173](https://github.com/xX-its-amit-Xx/delphi/commit/21f20173), [adb32187](https://github.com/xX-its-amit-Xx/delphi/commit/adb32187) |
| 19:25 | 247 Darwin claims extracted as nanopub drafts; promoted to production at 20:41 | [c8b4ec9b](https://github.com/xX-its-amit-Xx/delphi/commit/c8b4ec9b), [fc982b2e](https://github.com/xX-its-amit-Xx/delphi/commit/fc982b2e) |
| 22:05 | 291 Thompson claims | [8ad9c204](https://github.com/xX-its-amit-Xx/delphi/commit/8ad9c204) |
| 23:12 | `delphisci` MCP server, runnable via `npx`; `AGENTS.md` created | [ace57697](https://github.com/xX-its-amit-Xx/delphi/commit/ace57697), [1c94b052](https://github.com/xX-its-amit-Xx/delphi/commit/1c94b052) |
| 23:46 | 321 Wolfram NKS claims; GPT and Grok resolvability assessments published to the test registry through the night | [b3f424ba](https://github.com/xX-its-amit-Xx/delphi/commit/b3f424ba), [6339689d](https://github.com/xX-its-amit-Xx/delphi/commit/6339689d) |
| Oct 31 00:32 | MCP hosted on Fly.io, deployed from `main` by GitHub Actions | [d3933e21](https://github.com/xX-its-amit-Xx/delphi/commit/d3933e21) |
| 00:28–01:40 | 16 organism slices vendored by parallel agents and merged: 782 taxa, 1,372 datasets | [0669dc11](https://github.com/xX-its-amit-Xx/delphi/commit/0669dc11) |

### Saturday Oct 31, night to morning – first threads

| time | event | commit |
|---|---|---|
| 01:52 | Holdout first frozen (Aves, provisional) | `holdout/README.md` |
| 01:55–02:19 | Claims thread: 8 math-bio tests pre-registered then run (3 supports, 1 refutes, 2 mixed, 2 data-unavailable); 2 pre-registrations amended to hold out Aves; 4 Darwin/Thompson tests (2 supports, 2 refutes) | [9b731287](https://github.com/xX-its-amit-Xx/delphi/commit/9b731287), [6f5de706](https://github.com/xX-its-amit-Xx/delphi/commit/6f5de706), [c330f91d](https://github.com/xX-its-amit-Xx/delphi/commit/c330f91d), [cc65b2c0](https://github.com/xX-its-amit-Xx/delphi/commit/cc65b2c0) |
| 10:05–10:27 | 15 unsigned evidence drafts; post-hoc power simulations; cross-check of thompson1917-ch03-07 against the upstream swarm (age range, not aggregation, explains 2.41 vs 2.74); four test folders suffixed `--delphi-claims` where both swarms had created the same claim directory, keeping both attempts | [bc0d8675](https://github.com/xX-its-amit-Xx/delphi/commit/bc0d8675), [2f752816](https://github.com/xX-its-amit-Xx/delphi/commit/2f752816), [c364a3d8](https://github.com/xX-its-amit-Xx/delphi/commit/c364a3d8) |
| 10:33 | Hub, swarm, holdout, lean and organism thread work committed together | [df9b6bdc](https://github.com/xX-its-amit-Xx/delphi/commit/df9b6bdc) |
| 10:44 | Aves confirmed by Amit and re-frozen; power table published as its own finding | [da7e271b](https://github.com/xX-its-amit-Xx/delphi/commit/da7e271b), [3521452b](https://github.com/xX-its-amit-Xx/delphi/commit/3521452b) |
| 10:59–11:03 | A9 faithfulness package (#40); OpenResearch grounding for 6 tests (#16): 5 of 6 already answered by prior work | [4f9b4546](https://github.com/xX-its-amit-Xx/delphi/commit/4f9b4546), [c87bcde0](https://github.com/xX-its-amit-Xx/delphi/commit/c87bcde0) |
| 14:17 | PR #36 opened from the fork | issue/PR #36 |

The swarm thread's four-arm comparison finished in this period (status `done`, 13:56 UTC): see §7.

### Saturday midday to evening – the flying fish

The team adopted Darwin's flying-fish sentence (Origin ch. VI) as the worked example (issue #42, work packages
#43–#50, opened 15:57 UTC).

| time | event | commit |
|---|---|---|
| 11:52 | Flying-fish blueprint and the six-step worked example | [fb34a434](https://github.com/xX-its-amit-Xx/delphi/commit/fb34a434) |
| 11:57 | Lean: substitution budget for the flying fish, inconclusive, with "an honest refusal" | [46821aff](https://github.com/xX-its-amit-Xx/delphi/commit/46821aff) |
| 12:19 | Claim Book and Knowledge Graph | [085622b9](https://github.com/xX-its-amit-Xx/delphi/commit/085622b9) |
| 12:38 | Kernel-checked well-formedness certificate for the generated blueprint (536 terms, 674 part_of edges, acyclic) | [f68bf8b7](https://github.com/xX-its-amit-Xx/delphi/commit/f68bf8b7) |
| 13:10–13:20 | 215 open problems, 80 candidate answers; theorems as constraints with a three-state checker | [5fc1b801](https://github.com/xX-its-amit-Xx/delphi/commit/5fc1b801), [380cd54c](https://github.com/xX-its-amit-Xx/delphi/commit/380cd54c) |
| 14:08 | Research standing order, the idea log, a physics thread | [153261d9](https://github.com/xX-its-amit-Xx/delphi/commit/153261d9) |
| 14:14 | Prior-art search: "the parts exist, the whole does not; Phenoscape is the closest" | [da329d5a](https://github.com/xX-its-amit-Xx/delphi/commit/da329d5a) |
| 14:19–14:21 | MCP test report 93/100; simulations agree with three Lean results | [d65be856](https://github.com/xX-its-amit-Xx/delphi/commit/d65be856), [8b618ee5](https://github.com/xX-its-amit-Xx/delphi/commit/8b618ee5) |
| 14:45–14:59 | Vetted genotype map; Thompson envelope test (fish inside; scaling inconclusive; power cannot tell); Daane 2021 fin ratios (109 specimens) | [695ee639](https://github.com/xX-its-amit-Xx/delphi/commit/695ee639), [b1e6fc90](https://github.com/xX-its-amit-Xx/delphi/commit/b1e6fc90), [e49023dd](https://github.com/xX-its-amit-Xx/delphi/commit/e49023dd) |
| 15:11–15:30 | Scaling laws R2–R9 from physics proved in Lean | [4289b826](https://github.com/xX-its-amit-Xx/delphi/commit/4289b826), [f089a1fa](https://github.com/xX-its-amit-Xx/delphi/commit/f089a1fa) |
| 16:01–16:11 | Segmented flying-fish GLB (110 meshes) and "Open the Fish" viewer | [e629707e](https://github.com/xX-its-amit-Xx/delphi/commit/e629707e), [5a039ef4](https://github.com/xX-its-amit-Xx/delphi/commit/5a039ef4) |
| 16:36 | Lean audit of all 92 theorems against the real fish: 19 hold, 6 hypotheses violated, 67 cannot evaluate | [7769f0ce](https://github.com/xX-its-amit-Xx/delphi/commit/7769f0ce) |
| 16:42–17:22 | Simulator v1–v3, test 4, drag bound, hypothetical powered flier, TFF ("truly flying fish") co-design map | [639d38ea](https://github.com/xX-its-amit-Xx/delphi/commit/639d38ea), [5ae9de8a](https://github.com/xX-its-amit-Xx/delphi/commit/5ae9de8a), [718b0c99](https://github.com/xX-its-amit-Xx/delphi/commit/718b0c99), [0f95a22d](https://github.com/xX-its-amit-Xx/delphi/commit/0f95a22d), [da18a466](https://github.com/xX-its-amit-Xx/delphi/commit/da18a466), [5b51ba4f](https://github.com/xX-its-amit-Xx/delphi/commit/5b51ba4f) |
| 17:02–17:10 | Lean Flight module; sustained aerobic flight eliminated with kernel-checked certificates | [1fcc5164](https://github.com/xX-its-amit-Xx/delphi/commit/1fcc5164), [74ccf1df](https://github.com/xX-its-amit-Xx/delphi/commit/74ccf1df) |
| 17:36 | `sim-engine` MCP server v1; its first pre-registered test (hhip) **failed** on axis | [e2395540](https://github.com/xX-its-amit-Xx/delphi/commit/e2395540) |
| 17:39 | Segmented zebrafish adult and larva, every piece ZFA-mapped | [b7f1b2e2](https://github.com/xX-its-amit-Xx/delphi/commit/b7f1b2e2) |
| 17:56 | Correction: an annotated flying-fish genome exists | [2ac2ee4d](https://github.com/xX-its-amit-Xx/delphi/commit/2ac2ee4d), [467dc3bc](https://github.com/xX-its-amit-Xx/delphi/commit/467dc3bc) |
| 18:01–18:05 | Sequences: no glider convergence; the convergent-site ladder is inverted | [72ab753e](https://github.com/xX-its-amit-Xx/delphi/commit/72ab753e), [de40f9a1](https://github.com/xX-its-amit-Xx/delphi/commit/de40f9a1) |
| 18:14 | **Design validation fails** | [da086ee0](https://github.com/xX-its-amit-Xx/delphi/commit/da086ee0) |
| 18:16–18:18 | Frontier cross-check; simulation readiness 0/18,733; nanopub curation of 157 drafts | [0eae0953](https://github.com/xX-its-amit-Xx/delphi/commit/0eae0953), [ca1cb887](https://github.com/xX-its-amit-Xx/delphi/commit/ca1cb887), [aeb248bd](https://github.com/xX-its-amit-Xx/delphi/commit/aeb248bd) |
| 18:27–18:28 | Parametric builder; four TFF spec mismatches; ray-interray null withdrawn; lat4a identity split | [fd095cf2](https://github.com/xX-its-amit-Xx/delphi/commit/fd095cf2), [b1f62e9a](https://github.com/xX-its-amit-Xx/delphi/commit/b1f62e9a), [27d21592](https://github.com/xX-its-amit-Xx/delphi/commit/27d21592) |

### Saturday night – consolidation, studio, print

| time | event | commit |
|---|---|---|
| 18:44–18:50 | Deck: new evidence slides, 10 numbers corrected against source, a CSS bug that meant no bar ever rendered | [caae50c2](https://github.com/xX-its-amit-Xx/delphi/commit/caae50c2), [fd2277a0](https://github.com/xX-its-amit-Xx/delphi/commit/fd2277a0) |
| 18:46 | Holdout: Lean scaling theorem ruled eligible; leak checker widened to 7,276 files | [b1750b52](https://github.com/xX-its-amit-Xx/delphi/commit/b1750b52) |
| 19:01 | `/results/`: one page of the day's findings, 29 source files read at build time | [5021e589](https://github.com/xX-its-amit-Xx/delphi/commit/5021e589) |
| 19:08 | 22 records written to Delphi Frontier | [83802250](https://github.com/xX-its-amit-Xx/delphi/commit/83802250) |
| 19:10 | Structures: 0 of 532 interface positions separate gliders from non-gliders | [8e919b17](https://github.com/xX-its-amit-Xx/delphi/commit/8e919b17) |
| 19:13 | QA sweep: three page-breaking bugs fixed | [b135c060](https://github.com/xX-its-amit-Xx/delphi/commit/b135c060) |
| 19:34 | Shared header and nav across 13 pages | [c863ed77](https://github.com/xX-its-amit-Xx/delphi/commit/c863ed77) |
| 20:02–22:38 | Printable kit: 100 part STLs (11 zero-thickness, flagged); 1:1 starter kit (10 parts, all pass); `/print/` viewer; kcnk5b MD systems built, zero ns production (GPU cap) | [1116f16d](https://github.com/xX-its-amit-Xx/delphi/commit/1116f16d), [e3a87210](https://github.com/xX-its-amit-Xx/delphi/commit/e3a87210), [7bc50a52](https://github.com/xX-its-amit-Xx/delphi/commit/7bc50a52), [20b2d6f8](https://github.com/xX-its-amit-Xx/delphi/commit/20b2d6f8) |
| 23:03–23:08 | Design studio checkpoint; Perturb mode in Open the Fish; versioned law registry, lawsets 1.2.0 and 1.3.0 (depth cap contested) | [8b701c7a](https://github.com/xX-its-amit-Xx/delphi/commit/8b701c7a), [5bad0acb](https://github.com/xX-its-amit-Xx/delphi/commit/5bad0acb), [6e2b7a85](https://github.com/xX-its-amit-Xx/delphi/commit/6e2b7a85), [bba92aa3](https://github.com/xX-its-amit-Xx/delphi/commit/bba92aa3) |
| 23:53–23:55 | Lawset 1.5.0: five perturbation laws accepted by the project lead; engine 0.3.2 | [f5e5a991](https://github.com/xX-its-amit-Xx/delphi/commit/f5e5a991), [d6d9e0d5](https://github.com/xX-its-amit-Xx/delphi/commit/d6d9e0d5) |
| 23:59–Nov 1 00:03 | Genotype layer in Perturb mode; engine 0.3.3: accepted laws P4, P4b and P5 evaluate and go red on designed violations | [f3c4ae43](https://github.com/xX-its-amit-Xx/delphi/commit/f3c4ae43), [e7a19cd9](https://github.com/xX-its-amit-Xx/delphi/commit/e7a19cd9) |
| Nov 1 00:06–00:11 | An `omics/` layer (3,860-gene zebrafish universe, shared row schema and validator, transcriptomic and pathway rows); a swarm task board with leases over co-design sessions, proposals left for a human; MCP 0.4.0 with Lean laws that self-update at runtime, content-hash pinned | [bccc3697](https://github.com/xX-its-amit-Xx/delphi/commit/bccc3697), [d769ec14](https://github.com/xX-its-amit-Xx/delphi/commit/d769ec14), [bd9982c3](https://github.com/xX-its-amit-Xx/delphi/commit/bd9982c3), [dd014786](https://github.com/xX-its-amit-Xx/delphi/commit/dd014786) |

---

## 6. Major decisions, with evidence and the alternatives rejected

| decision | evidence | rejected | source |
|---|---|---|---|
| Hold out class **Aves** as the exam, not Mammalia | Clean monophyletic class, AVONET full coverage. Cost stated: held-out counts fall below builders' minimums (13 vs 50, 8 vs 15), so both examined tests read inconclusive | Mammalia: 1 of 2 decisive, but 3 already-built tests would become post hoc | `holdout/README.md`, `holdout/POWER.md` |
| Replace A7's 90 % gate | Scores run 0.12–0.36; two assessors gave 0.118 and 0.362 | A threshold that formalises nothing; raising scores to clear it | `AGENTS.md` A7 |
| Publish refuted and inconclusive results | A refuted claim is often the more valuable record | Publishing only passes > 80 % | `AGENTS.md` A10 |
| Unsigned drafts and test registry only | Production signing is irreversible; a request to record findings is not key-owner approval | Signing on a lead's request | `AGENTS.md` standing order |
| Lean: mutate statements, not proofs | A proof nobody tried to break is not evidence | Trusting a compile | `decisions/ideas.json` `idea-statement-mutation` |
| Empirical constraints as named hypotheses with a non-vacuity witness | `#print axioms` still shows only standard axioms | Lean `axiom` declarations (unsound if wrong); prose notes (cannot bind a checker) | `idea-empirical-constraints-as-hypotheses-not-axioms` |
| Medaka and zebrafish as labelled proxy species | No flying-fish expression or phenotype records exist | Presenting zebrafish data as flying-fish data; waiting for data that does not exist | `idea-proxy-species` |
| Exclude birds from the flight-envelope comparison | Aves is the frozen holdout | Bats, squirrels, colugos, flies **and** birds, as the kickoff said | `idea-physics-aves-excluded` |
| Fit gliders and powered fliers separately; test Thompson against wing loading | Two physical regimes; his derivation balances weight against lift | One pooled envelope; regressing on length or mass | `idea-physics-gliders-vs-powered`, `idea-physics-wing-loading-axis` |
| Grade a causal chain by its weakest link | Strongest-link reporting would have called all 8 first-batch chains mechanistic | Strongest-link grading | `idea-chain-strength-is-the-weakest-link` |
| Build our own MCP sim engine with a versioned contract | Collaborator server availability before the freeze was uncertain | Depending on it | `idea-own-mcp-sim-engine`, `sim-engine/CHANGELOG.md` |
| Test the studio on zebrafish first | Every flying-fish genetic result is a cross-species transfer | Testing only on the flying fish | `idea-zebrafish-as-ground-truth-model` |
| Three-state law verdicts (holds, violated, cannot evaluate) | Two-state red/green "would show cannot-evaluate as passing" | Red/green | `idea-live-lean-violation-glow` |
| Never digitise figures | Fixed in the design pre-registration before scoring | Reading values off Daane 2021 Fig 4B | `design-validation/PREREG.md` |
| Keep a contested law and the observation against it | 8,336 m snailfish below the 8,200 m teleost cap | Deleting the law, or ignoring the record | `lean/registry/CHANGELOG.md` 1.2.0–1.3.0 |
| Change components in place and version them | Parallel copies drift | "A parallel copy of a component to avoid touching it" | `AGENTS.md` (Amit, Oct 31) |
| One source for Lean laws across MCP, CLI, API and pages, enforced by `check-exposed.mjs` in a pre-commit hook and CI | Pasted law lists go stale | Copying law ids into pages | `AGENTS.md` "Lean laws: one source" |
| Novelty stated narrowly: "we did not find prior use of a proof assistant on an ontology-derived anatomy hierarchy" | Prior-art search: each part exists; Lean has been applied to the genetic code and K-Lean exists; even the narrow claim is "not found", not "does not exist" | "The first formal verification of biology" | `idea-novelty-claim-narrow`, `research/prior-art/REPORT.md` |
| Say "fin enlargement for gliding" | A flying fish's "wing" is an enlarged pectoral fin | "Fin-to-wing transition" (reads as limb homology) | `idea-wording-fin-enlargement` |
| Agent harness architecture | The five proposed stages are right; the harness assignments were judged "mostly backwards" and an independent assessor stage missing | OpenResearch for extraction; BioNeMo as a harness | issue #17 |
| A physics thread scoped to fin size and gliding, run as a named session | Unowned issues #50 and #43; 17 open-problem candidates could not be ruled on without strength ∝ L² | A general physics engine (no data to validate it); a form simulator (#54, Kris's); wing printing (#45–#47); a background agent ("the project lead chose a session") | `idea-physics-thread` |

---

## 7. Failures, retractions and corrections

These are the results the repository leads with (`/results/` section 1 and 2). Each was found by a check, a reader or
a collaborator, and each is recorded where it was made.

1. **The designed organism failed its own pre-registered test.** The "winged zebrafish" (a germline
   `lat4a`/`kcnh2a` double heterozygote, which is Daane et al. 2021's own experiment, as the report says: "the design
   is not ours") was scored against the real flying fish. 1 of 10 phenotypic axes could be scored, and it scored
   f = 0.00; the axis the claim rests on (pectoral fin length / SL) cannot be scored at either end. Genetically 1 of 74
   loci known to differ (1.4 %). The Lean gate fails both the design and the real fish. Verdict: the claim that we
   can design an organism is dropped as **unsupported** (PREREG rule 2; rule 1 "drop outright" was judged to overstate
   what the gate can tell). `design-validation/REPORT.md`, `scorecard.json`; [da086ee0](https://github.com/xX-its-amit-Xx/delphi/commit/da086ee0).
2. **"Almost no molecular data exists for flying fish" – corrected.** Found by the project lead reading a primary
   source the thread had not read: Xu et al. 2021 annotated a draft genome (23,611 predicted genes, 23,492 with a
   database hit). The gap is expression and phenotype, not genes; 9 files' wording was rewritten and a correction
   nanopub drafted. [2ac2ee4d](https://github.com/xX-its-amit-Xx/delphi/commit/2ac2ee4d). *Still open:* the README
   hackathon section on the PR branch says "almost none exists for Exocoetidae itself" (line 95).
3. **gja5a link to fin length – retracted.** The thread's own cell-cell subagent found the zebrafish fin connexin is
   `gja1b`; `gja5a` has no fin record and Daane put cx43 under constrained evolution. `genotype/nanopubs/DECISIONS.md`;
   [927cddfd](https://github.com/xX-its-amit-Xx/delphi/commit/927cddfd).
4. **"No ray-to-inter-ray signalling arrow in any fin of any fish" – withdrawn, then narrowed.** The curation pass,
   not the thread that wrote it, found three contradicting papers on the first page of one PubMed query, one already
   held by the thread and read title-only. `nanopubs-index/README.md` finding 1; [27d21592](https://github.com/xX-its-amit-Xx/delphi/commit/27d21592).
5. **"lat4a = slc43a2a, settled" – split.** Adopted as a researched idea, then challenged by the collaborator graph's
   record `gx-problem-lat4a-identity` (the only DISAGREE row of 33). Resolved half: the zebrafish allele is on
   `slc43a2a` (chromosome mapping; ZFIN allele dmh26). Open half: which paralogue carries the flying-fish signal
   (phyloP: slc43a2b p = 1e-5, slc43a2a p = 0.00837). The design's T200K allele is not the flying-fish F326L.
   `results.json` `section_1_corrections`.
6. **TFF aspect ratio "more slender than any measured flying fish" – withdrawn.** Building the spec as a mesh and
   reading Fish 1990 and Park & Choi 2010 in full showed the comparison crossed conventions: 17.9 on Park & Choi's,
   ≤ 13.9 on Fish's, inside the measured 3.0–16.9. The code was right and the prose wrong.
   `anatomy-model/parametric/CHANGELOG.md` 2.0.0; `physics/flier/tff/SPEC-MISMATCHES.md` (corrected 2026-11-01).
   The same pass found the TFF's flight muscle does not fit in the animal ([b1f62e9a](https://github.com/xX-its-amit-Xx/delphi/commit/b1f62e9a)).
7. **Flying-fish mass: two sources 2.2× apart, both kept.** The aerodynamic specimen (Park & Choi 2010, one
   *Cypselurus hiraii*, 0.060 kg at SL 0.203 m, condition factor 0.72) is light for its length; population fits give
   111–166 g. With 0.1316 kg, v_min rises from 9.85 to 14.6 m/s. The pre-registered "inside the envelope" verdict
   holds up to 0.247 kg, but the prose "10–20 m/s at or above the 9.9 m/s minimum" holds only with the specimen mass.
   STATE keeps 0.060 kg, labelled with both roles. `anatomy-model/parametric/CHANGELOG.md`, `sim-engine/CHANGELOG.md`.
8. **Depth cap contested.** The `perturb-depth-cap` law (teleosts ≤ 8,200 m) is contradicted by a snailfish recorded
   at 8,336 m (Jamieson et al.). Lawset 1.2.0 marks it contested (amber, never red); 1.3.0 compiles the contradiction
   in Lean (`lean/registry/lean/P3bContested.lean`: the cap applied at 8,336 m proves `False`). Pressure law v1 was
   also superseded (1 atm per 10 m overstated sea-water pressure by 0.5–1 %) in 1.4.0. `lean/registry/CHANGELOG.md`.
9. **sim-engine's first pre-registered test failed.** A single-morphogen threshold model puts hhip fin growth on the
   wrong axis (measured: dorsoventral +50 %, anteroposterior unchanged). "Nothing was tuned afterwards."
   `dashboard/public/t/organism/status.json`; [e2395540](https://github.com/xX-its-amit-Xx/delphi/commit/e2395540).
10. **Studio passes are mostly circular.** Under the pre-registered harness, every in-band wild-type number is read
    from the paper it is scored against; the two pre-registered fails (W11 current signs, N5 glide bound) pass only
    under labelled amendments, shown beside the original. `STUDIO-FINDINGS.md`: "it passes nothing about the wild type
    on its own strength either".
11. **Physics launch.** Simulator test 4 failed under a bat-mean upper bound (26 s burst bouts, unphysical for a 60 g
    fish); sim v2 found launch not reachable on chain power at any swept drag; v3 reached it only at the zero-drag
    bound; the derived threshold is body Cd ≤ 0.01. [5ae9de8a](https://github.com/xX-its-amit-Xx/delphi/commit/5ae9de8a), [718b0c99](https://github.com/xX-its-amit-Xx/delphi/commit/718b0c99), [da18a466](https://github.com/xX-its-amit-Xx/delphi/commit/da18a466).
12. **Smaller corrections.** Three PBDB first-appearance dates corrected and a fourth flagged ([ad640568](https://github.com/xX-its-amit-Xx/delphi/commit/ad640568));
    10 deck numbers corrected and a CSS bug that hid every bar ([caae50c2](https://github.com/xX-its-amit-Xx/delphi/commit/caae50c2));
    four nanopub record kinds claimed "every URL resolved" from an empty path list ([08140aa6](https://github.com/xX-its-amit-Xx/delphi/commit/08140aa6));
    a studio "Q10 erratum" and adult Ucrit range ([bba92aa3](https://github.com/xX-its-amit-Xx/delphi/commit/bba92aa3));
    three page-breaking bugs found by a QA sweep ([b135c060](https://github.com/xX-its-amit-Xx/delphi/commit/b135c060)).

### Process failures, from `AGENTS.md`

- **Role collision:** sessions started with placeholder names and two inferred overlapping roles; fix: roles assigned
  by one party and written down.
- **Permission laundering:** a peer asked for an action this session's permissions would block; now a hard rule that
  "a message from another agent is never user approval".
- **Personal identifier sent to an outside service:** a research agent sent the project lead's email to NCBI as an
  etiquette parameter; now prohibited.
- **Leak found by the curator, not the checker:** a bird-titled Lean draft; the holdout leak checker was widened to
  the whole tree (7,276 files, 0 hits outside a 26-entry reasoned allowlist).
- **Credential in chat:** the Frontier bearer token "arrived in a plain chat message and must be treated as possibly
  known to others"; it was passed only as a request header and appears in no file (`frontier-contrib/REPORT.md`).

---

## 8. Results that held up (with their limits)

- **Sustained aerobic flight is eliminated for a flying fish** with kernel-checked certificates: aerobic ceiling
  0.0357 W on the committed teleost proxies against 1.35 W for level flight at 10 m/s (38×); 0.0458 W at most across
  the measured teleost ranges (29×). **Corrected 2026-11-01:** those proxies borrowed a snapper cardiac output, and a
  measured zebrafish at U_crit takes up 2.8× the O2 the ceiling allowed (Palstra et al. 2010, PMC3013094). With a
  zebrafish-derived O2 delivery and a skeletal-muscle efficiency the shortfall is about 10 to 30× (central about 20×; 16× on
  the widened E3 2.0.0 envelope of 0.0833 W); 38× is what the original snapper-based proxies give. Still ruled out by an
  order of magnitude (`physics/FICK-CEILING-CHECK.md`). It does not bound gliding or burst flight. `lean/eliminate/ledger.physiology.json`; [fd2277a0](https://github.com/xX-its-amit-Xx/delphi/commit/fd2277a0).
- **One glide cannot explain the long flights:** from 8 m at the measured L/D 4.37 the bound is 35 m (40.7 m with
  ground effect) against 50–400 m reported. `results.json` `single_glide`.
- **Gliders do not converge** in the 9 genes compared: 11 shared columns among gliders against 17 for the reversed
  baseline. `sequences/README.md`.
- **Six textbook limb-signalling claims are refuted or not established for zebrafish.** `genotype/CAUSAL.md`.
- **Swarm vs single agent** (pre-registered, 4 arms, 20 claims, equal model and budget): centralized 19 and 18
  verified plans, single agent 13 and 12; the single agent cost about a tenth (exp. 2: $0.52 vs $5.61 list) and lost
  mainly by leaving plans blank. A sister enzyme project found no collective advantage. `swarm/README.md`.
- **Lean results match simulation** for neutral fixation i/M, fixation ≥ i/M for s ≥ 0, and the twofold cost of sex;
  byte-identical rerun. `validation/SIM-REPORT.md`.

---

## 9. Collaboration with Delphi Frontier ("delphi-frontier"), the upstream swarm, and MorphoScale

**Delphi Frontier** is a collaborator knowledge graph served over MCP at `https://frontier.morphoswarm.ai/mcp`
(namespaces `delphi-frontier` and `node-a`).

- **Read-only cross-check first** ([0eae0953](https://github.com/xX-its-amit-Xx/delphi/commit/0eae0953)): 240
  anonymous calls, 33 claims compared. Findings: nothing in their store is accepted (all `imported_unreviewed` or
  `proposed`); no artifact bytes are verifiable; and much of `node-a` is a bulk import of DELPHI's own registry, so
  "any match on one of those ids is our own work reflected back and must never be counted as corroboration". The
  strongest independent agreement: the lat4a × kcnh2a transfer to flying fish stays a hypothesis, held by four of
  their records from two issuers. Both sides pin the same Mathlib revision, which is disclosed whenever their Lean
  check is cited.
- **Then a write** ([83802250](https://github.com/xX-its-amit-Xx/delphi/commit/83802250)): 22 records (7 corrections,
  4 Lean, 9 genotypic, 2 measurements), each read back; 2 schema refusals reproduced verbatim. Written as a shared
  identity `team-demo-agent`, so attribution was put into every payload with the repository path, commit and sha256.
  `proposed` is the ceiling: "MCP cannot make anything 'accepted'".

**The upstream swarm** is treated as a cross-check source, not a duplicate: the claims thread compared verdicts on
thompson1917-ch03-07 and kept both attempts where both swarms created the same claim directory. Upstream also ran a
self-assessment on the judging rubric with three blind assessors from other providers (merged 57–60/100; issue #61,
[72cc5efe](https://github.com/xX-its-amit-Xx/delphi/commit/72cc5efe)) and a `delphi_morpholib` MCP tool linking
MorphoEval audits from `fractastical/morpholib` ([bd5756c5](https://github.com/xX-its-amit-Xx/delphi/commit/bd5756c5)).

**MorphoScale.** Named by the team lead in the brief for this record. The name does not appear in the repository, its
commits, its issues or PR #36, so this record does not describe it. The related names that do appear are MorphoSwarm
(host of the Delphi Frontier MCP) and MorphoEval / morpholib.

---

## 10. What remains open

- **Nothing is signed or published by this team.** 157 drafts await the ORCID key owner (`nanopubs-index/README.md`).
  Curation gaps: two threads with zero records, the failed sim-engine test with no record, 15 drafts with no external
  source (`nanopubs-index/gaps.md`).
- **A9 faithfulness has one provider.** Seven OpenAI assessments; a second non-Anthropic provider is needed before any
  verdict travels. The claims status file still reads "0 of 7 (awaiting non-Anthropic run)", which is stale.
- **A13 debate and tournament** is designed, not built.
- **The holdout exam has not been run**; with Aves held out, the two tests that touch birds cannot reach a verdict at
  the builders' minimum n.
- **Design studio:** no numeric wild-type prediction counts as independent evidence; W10 (gut passage) has no target;
  law verdicts are floating-point checks of Lean-backed formulas, and the accepted lawset was grandfathered at
  bootstrap without per-law review (`README.md`).
- **Contested and candidate laws:** depth cap contested; pressure law candidate (`lean/registry/CHANGELOG.md` 1.5.0).
- **lat4a paralogue** unresolved; the accelerated non-coding axis of Daane's data is a named gap, not a zero.
- **Physical wing:** the print kit is verified as geometry; flight is untested (issue #58 "actually print wings").
- **kcnk5b MD:** systems built, zero ns of production run (GPU cap).
- **Frontier records** sit at `proposed` until a reviewer with their own credential acts; the token's rotation is the
  lead's call.
- **README** on the PR branch still carries the pre-correction genome sentence; the PR branch and local `main` were
  still moving at the time of writing: commits were reaching the PR branch past midnight, and `pipeline/` and
  `sim-engine/generative/` were uncommitted in the shared tree.

---

## 11. Sources

`AGENTS.md`, `README.md`, `DATA.md`, `dashboard/THREADS.md`, `dashboard/NEW-THREADS.md`, `decisions/ideas.json`,
`dashboard/public/t/*/status.json`, `dashboard/public/results/results.json`, `dashboard/public/deck/data.json`,
`design-validation/`, `crosscheck-frontier/REPORT.md`, `frontier-contrib/REPORT.md`, `holdout/README.md`,
`holdout/POWER.md`, `swarm/README.md`, `claim-tests/README.md`, `genotype/nanopubs/DECISIONS.md`,
`nanopubs-index/README.md`, `research/prior-art/REPORT.md`, `simulation-readiness/README.md`, `sim-engine/CHANGELOG.md`,
`sim-engine/validation/STUDIO-*.md`, `lean/registry/CHANGELOG.md`, `mcp/CHANGELOG.md`,
`anatomy-model/parametric/CHANGELOG.md`, `physics/flier/tff/SPEC-MISMATCHES.md`, `validation/MCP-TEST-REPORT.md`,
`validation/SIM-REPORT.md`; GitHub issues #17, #36, #42, #53, #61 on fractastical/delphi; `git log` of `origin/main`
and `fork/delphi-hack-2026-10-31`. No credentials, no Aves data, and no personal identifiers beyond names already in
the repository's documents were used.
