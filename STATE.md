# STATE — DELPHI atlas + six tracks (antigravity session b0ad0789)

Read this first, then BRAIN.md. Updated 2026-11-18.

## What this session owns
- `sim-engine/scales/atlas/`, `sim-engine/scales/micro/division.mjs`, `sim-engine/scales/molecular/`
- `tracks/` and `dashboard/public/blueprint3d/studio-live/{atlas,tracks,retro,embryo/embryo-nuclei.*,embryo/embryo-divisions.json}`
- `benchmarks/retro-validation/`, `devlog/`
- NOT ours: `lean/` (31), `genotype/` (68), `organism-design/` (32), `physics/` (58), `holdout/` (93), blueprint3d viz (51). Read only.

## Briefs (all saved verbatim in tracks/)
- `BRIEF-2026-11-12.md`: PAPER (with Buehler, Marom) and CONTRACTING (Mamou-Mani, Formlabs print); six tracks.
- `BRIEF-2026-11-13-green-fire-coatings.md`: fire-coatings lead. `BRIEF-2026-11-13-group-split.md`: group splits into academic zebrafish paper and industry (biomaterials, zebot, locomotion).
- `BRIEF-2026-11-17-community-badge-watcher.md`: alphaXiv Community, methods paper, "Lean4Bio checked" badge, paper watcher (priority: scraping for verification); Slack bot question.
- `BRIEF-2026-11-17-alphaxiv-collaboration.md`: run daily, widen searches, use the named account for alphaXiv, three or more collaboration ideas implemented.
- `BRIEF-2026-11-13-deliverables.md`: top deliverables = Formlabs print file, biomaterial proposal grounded in "linker biology", validation-suite improvements and more cases (validation / holdout / performance / what was wrong). Biomaterials and xenobots must use Lean for Biology.

## Upstream
- `origin` = `fractastical/delphi` (issues #17-#42 are ours). Lean library split out as `fractastical/leanbio` (law set 1.6.0; this repo 1.8.1).
- We push to `fork` (`xX-its-amit-Xx/delphi`), branch `generalise-any-base-organism`.

## Data and paths (nothing big on C: or D:; D: has under 5 GB free)
- Working data: `D:\Users\ashenoy00000\delphi-work\` (`agents*/` = raw workflow outputs, not committed). Agent downloads of this round: `C:\Temp\delphi-sprint\`.
- Committed copies: `tracks/research/agents/*.json` (127), `agent-scripts/`, `lean/*.lean`, `lean/failed/`, `lean/CHECKED.txt`.

## How to run
- Bring a fleet in (one command; fails on a leak or a surviving negative control): `bash tracks/scripts/integrate-fleet.sh <journal.jsonl> <agents_out_dir>`
- Bundle: `node tracks/build.mjs`. Render check: `node sim-engine/scales/atlas/shoot.mjs --page tracks/`
- Everything: `node tracks/reproduce.mjs [--online] [--only lean,print,suite]`
- Lean: `bash tracks/lean/check.sh <file>` (v2, strict) and `bash tracks/lean/check.sh --probes`
- Cases: `node tracks/suite/make-cases.mjs [--expect|--record]` (cs-* runs -> `tracks/suite/cases/*.case.json` -> gate); `node tracks/suite/rerun-cases.mjs` (re-executes six case scripts in a scratch copy)
- Paper watcher: `node tracks/watch/watch.mjs` (Europe PMC -> `queue.jsonl`), readers write `watch-*.json` (prompt shape in BRAIN/brief; outputs in `delphi-work/agents6/`), `node tracks/watch/verify.mjs --from <folder>` (Lean-checks every record, writes `summary.json`, badges), `--status` prints the tally
- Print files: `python -I tracks/print/make_poc.py && python -I tracks/print/test_poc.py [--fail-once]`
- Holdout: `node holdout/check-leaks.mjs tracks`; `node sim-engine/scales/atlas/holdout-html-scan.mjs`
- Kernel (new 2026-11-19, `tracks/kernel/`): `node tracks/kernel/test-kernel.mjs [--fail-once|--with-lean]` (28 faults, 0 may survive); `bash tracks/lean/check.sh tracks/kernel/lean/CircuitLaws.lean`; `node tracks/kernel/compile/compile.mjs tracks/kernel/compile/designs/and2.v`; `node tracks/kernel/compile/expect.mjs [--record]`; `node tracks/kernel/cli.mjs {summary|verify|laws|verdicts|refusals|builds|trace <id>|why <text>}`; `node tracks/kernel/audit-lean.mjs <file|url>`; `node tracks/kernel/page.mjs`
- Deploy: `node dashboard/predeploy.mjs` then `cd dashboard && npx wrangler deploy`. Live: https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/tracks/
  - predeploy still FAILS 3 checks for one reason only: no root `node_modules`, so the MCP/Lean-exposure checks cannot run. Deploys are done with `npx wrangler deploy` directly. Open decision for Amit: `npm install` at the root (D: has under 5 GB free).

## Deliverables of 2026-11-13 (dashboard section "Deliverables")
1. PRINT: `tracks/print/make_poc.py` -> `studio-live/tracks/print/{single-print-plate,active-plate,passive-plate,bonding-jig}.stl` + manifest. Thicknesses doubled to meet Formlabs' 0.4 mm supported-wall minimum. NOT met: Form Now's 1.5 mm rule for Flexible 80A. Nothing printed.
2. PROPOSAL: `tracks/proposals/mamou-mani-biomaterial.md` (soybean-oil resin + polysaccharide, one face dipped in citric/tannic acid; three-stage contract). Hypothesis; nobody contacted; partner name unconfirmed.
3. SUITE: `check.sh` v2 closes four holes (no toolchain, sorry without audit line, hand-written axiom, empty file); probes in `tracks/lean/probes/`. `tracks/suite/suite-gate.mjs` + schema (self-test 29/29) now runs on the eight real cases: 4 earned (enhancer, binding, crosslink, somite), 4 not (fish, fire, hygromorph: prereg file last changed at or after the result; xenobots: broken-input control did not fail). Verdicts pinned in `cases/expected.json`. Times are file mtimes of the agents' originals (self-attested); min n = 10 units is a convention set after the runs. Eight `cs-*` cases have validation / holdout / performance / what-was-wrong (bundle `deliverables.cases`).

## Case results worth remembering (six re-executed 2026-11-15, all numbers identical; enhancer and binding not re-run; no independent replication)
- Enhancer rank: multiplicative model held-out R2 0.835; exact no-reversal law FALSIFIED (1,051 significant flips, about 25 expected) but the violation is 0.039% of comparisons.
- Binding affinity: ligand-only model on held-out targets r 0.164, worse than a constant in RMSE; noise ceiling is too unstable to diagnose leakage.
- Fire ignition: bound direction holds 108/108 held-out, but as a predictor the law is WORSE than both baselines.
- Xenobots: energy-store lifetime bound FAILED out of sample (0/4; held-out bots are fed in medium, so the closed-store hypothesis is false).
- Hygromorph: 2 held-out records only; 9 of 12 development records sit ABOVE the 3/2 ceiling (inferred strain, wide strips). All 14 records are under the proved wide-plate ceiling 9/4 (max 2.06; post-hoc consistency check, `tracks/scripts/check-hygromorph-plate-ceiling.py`). Quote 9/4 until our own narrow coupons are measured.
- Crosslink swelling: 9/11 held-out series right sign, effective n about 3-4. Fish: Strouhal band holds 80% held-out; larval zebrafish sit at 0.72-2.5.
- Lean added and passing: crosslinker window (14 thm), xenobot laws (13), print structure (21), fire certificate V2 (11; v1's three eliminations were wrong-way), binding thermo fixed (9).

## Paper watcher (2026-11-18: wider searches, arXiv added, daily)
- Sources: arXiv API (what alphaXiv mirrors) + Europe PMC; 17 searches in `tracks/watch/usecases.json`. 97 new papers read since 2026-05-01 (+4 sealed, +2 back-catalogue). 6 checked: 40 checks (31 Lean, 9 script), 28 inside, 12 outside. arXiv: 19 found, 1 checked (arxiv:2610.29389).
- Not checkable: 31 off-topic, 23 abstract only, 19 partial inputs, 11 no numbers, 7 no law yet, 4 sealed. 29 new-law suggestions, none formalised.
- Second reader (`second.mjs`, readings kept in `tracks/watch/second/`): 3 papers re-read blind; numbers agree; one difference (whether to count the uncrosslinked control). The other 3 checked papers have one reading.
- Two reader records were refused by me as second-hand or model-parameter numbers (scratch script, reasons in each paper's `why`).
- Daily: `node tracks/watch/daily.mjs [--deploy]` (search, headless Sonnet reader via `reader-prompt.md`, verify, second, community, build, gates, deploy only if all pass; never commits). Log: `tracks/watch/daily-log.jsonl`. So the working tree drifts ahead of git until someone commits.
- Public page `studio-live/tracks/alphaxiv/` (built by `tracks/watch/community.mjs`): try-your-numbers checker, law breakers, one number short, laws wanted (+Lean stubs), badges, comment drafts, `feed.xml`. Drafts in `tracks/watch/community/` (digest.md, comments/); none posted.
- alphaXiv: signed in with Google as the account Amit named; "Communities" are now Feeds. Created public feed https://www.alphaxiv.org/?feed=lean4bio-papers-we-can-check-7jkmeu . No comments, no blog post, no API key.

## Known gaps
- Public bundle is scrubbed of machine paths at write time (build.mjs); committed agent JSONs still contain them.
- Fire v1 file `FireCoatingCertificate.lean` is still in the folder; quote V2 only.
- 29 theorems in four older files have no axiom line of their own (check.sh prints a NOTE).
- Pre-registration times in `design-validation/` and `validation/` are self-attested (not ours to change; reported).
- Explainers still read 3-4 of 5 to no-context readers. Agent quotes are unverified unless a verify-* file says otherwise.
- Issues #17-#42: 1 resolved (#27), 12 partly, 11 need Amit, 2 blocked. Drafts in `tracks/research/agent-scripts/is-fix-*/`; no comments posted.

## What is running
- Windows scheduled task "Delphi paper watcher (daily)", 06:17, wrapper `C:Tempdelphi-watch-dailyun.cmd` (row in registry-claims.md). No cluster jobs, no GPUs. Explorer/Discovery still decline the SSH key.

## Standing constraints
- Frozen holdout: nothing from the held-out clade (roster in holdout/split.json) in any file, mesh, manifest or log. Never add allowlist entries. Agents may download tables that contain it: keep raw downloads out of the repo.
- No credentials in the repo; no personal identifiers to outside services. Do not commit `genotype/map.json`.
- Thirteen other-thread dirty files stay untouched and unstaged (stage only STATE.md, tracks/, studio-live/tracks).
- Email ashenoy000@gmail.com with the live link when a feature ships.

## Open decisions for Amit
1. Sentry: where is it (#36)?  2. Which repo holds the manuscript (#37)?  3. Is the partner Mamou-Mani (#28)?
4. Does "linker biology" mean crosslinker chemistry (how I read it) or "Lean for biology"?
5. Post the drafted issue replies as public comments?  6. Coupon swelling measurement (#21) needs a printer.
7. Standing: revoke the GitHub token, rotate the Frontier token, Nebius key, cluster SSH key.

## The kernel and the biological compiler (2026-11-19)
Asked for: "turn delphi into a kernel" + a pasted spec for a nanopub-driven genetic-circuit compiler.
We had none of it. Full rationale, decisions and findings: BRAIN.md (2026-11-19 entries). In short:
- `tracks/kernel/kernel.mjs`: five primitives (evidence, fact, law, verdict, build) over an append-only
  hash-chained store. `law()` runs tracks/lean/check.sh itself. `cannot-assess` is never a pass.
  `build()` refuses on any non-inside verdict and mints a refusal naming what was missing.
- `tracks/kernel/lean/CircuitLaws.lean`: 12 audited theorems, ALL CHECKED. All three laws are now Lean
  laws: the two that were script-checked (orthogonality, parameter completeness) were formalised
  2026-11-19 and the scripts now only supply the data. PROPOSED for the registry, parked under tracks/
  like HygromorphCeiling.lean (lean/ is session 31's). leanCheck is memoised by file bytes, so one file
  proving three laws starts the toolchain once.
- `tracks/kernel/compile/`: HDL subset -> gates -> DNA (GenBank with real assembly_gap for open slots),
  Opentrons + Autoprotocol, SBML, unsigned nanopub drafts, JSON-LD justification. `expected.json` pins
  the verdicts: 2 inside, 2 outside, 2 cannot-assess; 1 artifact built, 2 refused; 3 of 14 slots filled.
- `tracks/kernel/audit-lean.mjs`: audits anyone's Lean file; holdout-screened, counts and hashes only.
- Live: .../studio-live/tracks/kernel/ (version 4fd29ff2-7079-4fe9-8541-301bfc1efd9e). 4 new reproduce rows.

## One explainer video per feature (2026-11-19)
Amit: each major feature add ships with a 1-2 minute first-principles video. `tracks/video/`:
`node tracks/video/render.mjs <id> [--dry|--no-audio|--still <scene>]`, scripts in
`tracks/video/scripts/`. Local only: Windows SAPI for the voice, Playwright/Edge for frames,
ffmpeg-static (`C:/Temp/ffmpeg-install`). Every number spoken is a `{{token}}` filled from the
feature's own run output, so a stale figure stops the render; `--dry` is a reproduce row.
Output in `C:/Temp/delphi-video/<id>/`; `page.mjs` copies mp4+vtt+poster next to the page.
The mp4 is gitignored (recipe is versioned, artifact is not). First one: kernel, 1:57.

### Open (kernel)
- Registry exposure (AGENTS-RULE) for the circuit laws belongs to the lean thread; ours are proposals.
- Promoter/repressor sequences are open slots: parts.igem.org 403s automated requests and the SynBioHub
  mirror is behind a bot check (api.synbiohub.org returns 401 "Login required"), which we do not pass.
  Unblocked only by Amit opening one Registry page himself.
- Upstreamed to fractastical/morpholib: issue #331 (nanopub provenance pins commit a2201fd3, which
  predates all five artifacts it cites) and PR #332 (axiom-audit.sh + AXIOM-AUDIT.md; 115 theorems
  across 3 files, all CHECKED on the standard three axioms). Fork: xX-its-amit-Xx/morpholib.
- A third-party repo listing surfaced held-out-clade species names into this session's tool-result cache
  (.claude-antigravity/projects/.../tool-results/bn4i1fwfp.txt). No repo file touched; all leak gates
  clean. Flagged for the holdout thread (93) to rule on; not deleted by us.
