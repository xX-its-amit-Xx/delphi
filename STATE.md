# STATE — DELPHI atlas + six tracks (antigravity session b0ad0789)

Read this first. Updated 2026-11-13 (late).

## What this session owns
- `sim-engine/scales/atlas/`, `sim-engine/scales/micro/division.mjs`, `sim-engine/scales/molecular/`
- `tracks/` and `dashboard/public/blueprint3d/studio-live/{atlas,tracks,retro,embryo/embryo-nuclei.*,embryo/embryo-divisions.json}`
- `benchmarks/retro-validation/`, `devlog/`
- NOT ours: `lean/` (31), `genotype/` (68), `organism-design/` (32), `physics/` (58), `holdout/` (93), blueprint3d viz (51). Read only.

## Briefs (all saved verbatim in tracks/)
- `BRIEF-2026-11-12.md`: PAPER (with Buehler, Marom) and CONTRACTING (Mamou-Mani, Formlabs print); six tracks.
- `BRIEF-2026-11-13-green-fire-coatings.md`: fire-coatings lead. `BRIEF-2026-11-13-group-split.md`: group splits into academic zebrafish paper and industry (biomaterials, zebot, locomotion).
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
- Print files: `python -I tracks/print/make_poc.py && python -I tracks/print/test_poc.py [--fail-once]`
- Holdout: `node holdout/check-leaks.mjs tracks`; `node sim-engine/scales/atlas/holdout-html-scan.mjs`
- Deploy: `node dashboard/predeploy.mjs` then `cd dashboard && npx wrangler deploy`. Live: https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/tracks/

## Deliverables of 2026-11-13 (dashboard section "Deliverables")
1. PRINT: `tracks/print/make_poc.py` -> `studio-live/tracks/print/{single-print-plate,active-plate,passive-plate,bonding-jig}.stl` + manifest. Thicknesses doubled to meet Formlabs' 0.4 mm supported-wall minimum. NOT met: Form Now's 1.5 mm rule for Flexible 80A. Nothing printed.
2. PROPOSAL: `tracks/proposals/mamou-mani-biomaterial.md` (soybean-oil resin + polysaccharide, one face dipped in citric/tannic acid; three-stage contract). Hypothesis; nobody contacted; partner name unconfirmed.
3. SUITE: `check.sh` v2 closes four holes (no toolchain, sorry without audit line, hand-written axiom, empty file); probes in `tracks/lean/probes/`. `tracks/suite/suite-gate.mjs` + schema (self-test 29/29) is NOT yet run on real cases. Eight `cs-*` cases have validation / holdout / performance / what-was-wrong (bundle `deliverables.cases`).

## Case results worth remembering (each is the agent's own run; no second re-run yet)
- Enhancer rank: multiplicative model held-out R2 0.835; exact no-reversal law FALSIFIED (1,051 significant flips, about 25 expected) but the violation is 0.039% of comparisons.
- Binding affinity: ligand-only model on held-out targets r 0.164, worse than a constant in RMSE; noise ceiling is too unstable to diagnose leakage.
- Fire ignition: bound direction holds 108/108 held-out, but as a predictor the law is WORSE than both baselines.
- Xenobots: energy-store lifetime bound FAILED out of sample (0/4; held-out bots are fed in medium, so the closed-store hypothesis is false).
- Hygromorph: 2 held-out records only; 9 of 12 development records sit ABOVE the 3/2 ceiling (inferred strain, wide strips). Unresolved; settle on our own coupons.
- Crosslink swelling: 9/11 held-out series right sign, effective n about 3-4. Fish: Strouhal band holds 80% held-out; larval zebrafish sit at 0.72-2.5.
- Lean added and passing: crosslinker window (14 thm), xenobot laws (13), print structure (21), fire certificate V2 (11; v1's three eliminations were wrong-way), binding thermo fixed (9).

## Known gaps
- Fire v1 file `FireCoatingCertificate.lean` is still in the folder; quote V2 only.
- 29 theorems in four older files have no axiom line of their own (check.sh prints a NOTE).
- Pre-registration times in `design-validation/` and `validation/` are self-attested (not ours to change; reported).
- Explainers still read 3-4 of 5 to no-context readers. Agent quotes are unverified unless a verify-* file says otherwise.
- Issues #17-#42: 1 resolved (#27), 12 partly, 11 need Amit, 2 blocked. Drafts in `tracks/research/agent-scripts/is-fix-*/`; no comments posted.

## What is running
- Nothing after this turn's Lean re-run finishes. No cluster jobs, no GPUs. Explorer/Discovery still decline the SSH key.

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
