# Swarm: structure, and a measured comparison against one agent

Two things live here.

**1. The control logic.** `emperor.mjs` decides swarm structure (kings, queens per king, peer links, context budgets)
from `roster.json` plus per-queen metrics; it never reads science content. Without `metrics.json` it runs a seeded
simulation and labels the output `simulated`. With `metrics.json` (written by the comparison below) it runs in
`measured` mode. `state.json` is its output and feeds the main dashboard.

**2. The comparison (`compare/`).** Does a swarm beat a single agent at a real unit of this project's work? The task:
for 20 Darwin and Thompson claims, write a pre-registered test plan naming one real public dataset. Four arms, same
model, tools, prompt, schema and budget; a script checks every URL and DOI. Design and scoring rule were fixed before
any run in [`PREREG.md`](PREREG.md); anything that changed after is in [`compare/DEVIATIONS.md`](compare/DEVIATIONS.md).

| arm | who decides | feedback |
|---|---|---|
| single | one agent, one call, all 20 claims | none |
| isolated | 20 parallel workers, one claim each | none |
| centralized | emperor sets structure, king assigns, reviews, retries, escalates | through the king |
| decentralized | queens pull from a shared board, post gaps and tips | through the board |

Results, verdicts and every plan are on the sub-dashboard `dashboard/public/t/swarm/` (live at `/t/swarm/`), all read
from `compare/results.json`.

**When it helps, and when it does not.** A sister project ([delphi-evolve](https://github.com/kganjam/delphi-evolve),
page `/evolve/`) ran the same four-arm design on an enzyme benchmark (equal 1,000-assay budget, 100 episodes, zero false
certificates anywhere) and found no collective advantage: specialists sharing evidence 78/100, isolated 77/100, a single
planner 78/100, a single planner without its model prior 96/100. Their members are deterministic code, so every member
computes the same thing and sharing adds nothing. Ours are language models with a context limit, and the per-claim table
shows the single agent lost mainly by leaving plans blank (all 8 losses in experiment 2, 3 of 7 in experiment 1) rather
than by naming worse datasets. Collaboration paid where the bottleneck was attention. The centralized arm's wins over the
single agent are spread over 6 (experiment 1) and 7 (experiment 2) distinct claims, not one item.

## Reproduce

Needs Node 20+, the Claude Code CLI on `PATH` and logged in (`claude --version`), and network access. No API key is read
from the repo. Each arm costs about $3 at list price and takes 2 to 3 minutes.

```bash
node swarm/compare/run.mjs --arm single        # or isolated | centralized | decentralized
node swarm/compare/metrics.mjs                 # -> compare/results.json and swarm/metrics.json (measured queen metrics)
node swarm/emperor.mjs                         # -> swarm/state.json in measured mode
node swarm/compare/publish.mjs                 # copies data files next to the sub-dashboard
node dashboard/build.mjs && (cd dashboard && npx wrangler deploy)
```

Run the arms one at a time so wall-clock minutes are comparable. Each run writes `compare/runs/<arm>-<time>/` with one
JSON per agent call (`calls/`), the plans (`plans/`), the verifier records (`verify/`), an event log (`log.jsonl`) and
`summary.json`. The earliest full run per arm is the primary result; later ones are replicates. `--tag test` or
`--limit N` marks a run as a test, which the aggregator ignores.

Files: `compare/claims.json` (frozen inputs and the selection rule), `compare/prompt.md` and `compare/plan.schema.json`
(what every agent gets), `compare/briefs.json` (the distinct information each queen has), `compare/verify.mjs`
(the mechanical checker and its classes: resolves, fabricated, blocked, malformed).
