# STATE — DELPHI atlas + six tracks (antigravity session b0ad0789)

Read this first. Updated 2026-11-12.

## What this session owns
- `sim-engine/scales/atlas/`, `sim-engine/scales/micro/division.mjs`, `sim-engine/scales/molecular/`
- `tracks/` (new, 2026-11-12) and `dashboard/public/blueprint3d/studio-live/{atlas,tracks,retro,embryo/embryo-nuclei.*,embryo/embryo-divisions.json}`
- `benchmarks/retro-validation/`, `devlog/`
- NOT ours: `lean/` (31), `genotype/` (68), `organism-design/` (32), `physics/` (58), `holdout/` (93), blueprint3d viz (51). Read only.

## The pivot (Amit, 2026-11-12) — brief saved at `tracks/BRIEF-2026-11-12.md`
Two strategies: the PAPER (with Markus Buehler and Lee Marom) and CONTRACTING (Mamou-Mani, Formlabs print).
Six tracks: 1 reporter response · 2 spatial patterns · 3 lumen geometry · 4 passive glide surrogate ·
5 new biomaterial printed on Formlabs · 6 flying fish framework.

## Upstream moved
- `origin` is now `https://github.com/fractastical/delphi.git` (old `delphisci` 404s). main was force-updated 2026-11-08.
- Lean library split out: `fractastical/leanbio`, law set 1.6.0. Shallow clone at `D:\Users\ashenoy00000\delphi-work\upstream\leanbio`.
- We push to `fork` (`xX-its-amit-Xx/delphi`), branch `generalise-any-base-organism`.

## Data and paths (nothing big on C:)
- Working data: `D:\Users\ashenoy00000\delphi-work\` — `idr0068/` (embryo XML), `tahoe/`, `paxdb/`, `agents/` (workflow outputs), `upstream/`.
- Agent outputs are NOT committed. `tracks/build.mjs` merges and checks them into `tracks/research/` and the dashboard bundle.
- Corpus: `tracks/research/corpus/buehler.json` (795 of 892 works, OpenAlex, year-by-year walk; cursor paging 401s without a key).

## How to run
- Tracks bundle: `python tracks/scripts/verify-dois.py && node tracks/build.mjs`
- Atlas bundle: `node sim-engine/scales/atlas/build.mjs`
- Render check (starts and stops its own server): `node sim-engine/scales/atlas/shoot.mjs [--page tracks/] [--live]`
- Tests (each also takes `--fail-once`; a surviving assertion is a test bug): `sim-engine/scales/atlas/test-{counts,embryo-divisions,motion}.mjs`, `sim-engine/scales/micro/test-division.mjs`, `sim-engine/scales/molecular/test-*.mjs`, `devlog/test-registers.mjs`
- Holdout: `node holdout/check-leaks.mjs <path>` on every .mjs/.md; `node sim-engine/scales/atlas/holdout-html-scan.mjs` for the .html/.json the gate skips.
- Deploy: `node dashboard/predeploy.mjs` then `cd dashboard && npx wrangler deploy`. Live: https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/{atlas,tracks}/

## Done 2026-11-12 (workflow wf_42562527-bc5, 39 agents, finished; registry claim removed)
- Live: https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/tracks/
- All six tracks designed with frozen predictions; synthesis in `tracks/synthesis.json`; agent outputs in `D:/Users/ashenoy00000/delphi-work/agents/` (not committed).
- Citations: 217 of 221 resolve with matching titles (`tracks/scripts/verify-dois.py`: Crossref, then DataCite, then arXiv). Corpus: 544 relevant, 357/357 quotes verbatim.
- KNOWN GAP: the law-mapping agents read leanbio at law set 1.6.0; this repo is 1.8.1, so six laws are missing from their maps (`python tracks/scripts/lawset-diff.py 1.6.0 1.8.1`). The four new candidates have no sorry/axiom in code (the grep hits are the docstring words "not an axiom"), but each is a NAMED HYPOTHESIS its theorem is conditional on. 14 of 59 pinned laws have no Lean theorem at all.
- Proposed Lean, UNCHECKED (Mathlib not built here): `tracks/lean/HygromorphCeiling.lean`. Hand to session 31; do not write into lean/.
- Embryo drawn as nuclei at measured radii (Gemini-written `atlas/embryo-render.mjs`, reviewed).

## Done 2026-11-12 (second fleet, wf_af15c8ea-cdf, 77 agents, finished)
- Outputs copied to `tracks/research/agents/*.json` (77), `tracks/research/agent-scripts/` (agent-written scripts), `tracks/research/lean/*.lean` (12). Originals stay in `D:/Users/ashenoy00000/delphi-work/agents2/`.
- COPY RULES: after copying, run `python -I tracks/scripts/scrub-holdout.py tracks/research` (agents wrote the held-out clade's common names and two claim ids; the gate caught 20), then `node tracks/build.mjs`, then `node holdout/check-leaks.mjs tracks`.
- Three agent files were stubs ("full result returned via StructuredOutput"): pp-sentry-agent-platform, q1-critic, q1-theory-lean. Recovered from the workflow journal (`.../subagents/workflows/wf_af15c8ea-cdf/journal.jsonl`, `result` lines). Check for `findings` in every file after a copy.
- Bundle now has `fleet` (77 agents, 2,583 findings); page section "The research fleet". Evidence quotes are labelled the agent's own: a verifier pass has NOT run.
- Citations: 529 of 1,021 resolved independently, 0 failed, 484 not yet checked (no DOI/arXiv id, or not in the resolver run).
- `tracks/lean/check.sh` now makes relative paths absolute (it runs from lean/). A deliberate negative control, `bm-lean-materials-laws__NegativeControl.lean`, MUST fail (it does).

## What is running
- Background: `complete-corpus-when-ready.sh` waiting for the OpenAlex budget (resets 00:00 UTC) to fill 97 missing Buehler works. No cluster jobs, no GPUs. Explorer/Discovery still decline the SSH key (since 2026-11-07).
- Not started: phase 2 (layperson explainers + no-context reader check + claim verifiers).

## Standing constraints
- Frozen holdout: nothing from the held-out clade (roster in holdout/split.json) in any file, mesh, manifest or log. Never add allowlist entries.
- No credentials in the repo; no personal identifiers to outside services. Do not commit `genotype/map.json`.
- Thirteen other-thread dirty files in the working tree stay untouched and unstaged.
- Email ashenoy000@gmail.com with the live link when a feature ships.

## Open decisions for Amit
1. "Senty" — nothing by that name found. What is it and how is it reached?
2. "The paper is in repo" — no manuscript on any fetched branch. Which repo and path?
3. "Mobile Money" in the brief is read as Mamou-Mani — confirm.
4. Anthropic Lean token grant: the 14 pinned laws with no theorem, or the 17 laws the biomaterial track needs? (my pick: the 14)
5. Standing: revoke the GitHub token (repo/admin:org/admin:enterprise), rotate the Frontier token, Nebius key, cluster SSH key.
