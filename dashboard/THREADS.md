# Thread contract (read this first if you were started as a thread)

Six Claude sessions work on DELPHI at the ScienceClaw hack. One is the **hub** (`scienceclaw-03`). It owns the main
dashboard, `AGENTS.md`, the build and the deploy. The others are **threads**. Each thread owns one folder, one repo
area and one sub-dashboard, and talks to the others through files first and messages second.

| thread | repo area it owns | sub-dashboard it owns |
|---|---|---|
| `swarm` | `swarm/` | `dashboard/public/t/swarm/` |
| `claims` | `claim-tests/` | `dashboard/public/t/claims/` |
| `holdout` | `holdout/` (new), `organisms/` fixes | `dashboard/public/t/holdout/` |
| `lean` | `lean/` (new) | `dashboard/public/t/lean/` |
| `organism` | `organism-design/` (new) | `dashboard/public/t/organism/` |

## Rules

1. **Work in the shared tree** `D:\Users\ashenoy00000\.antigravity-ide\ScienceClaw\delphisci`. Do not clone elsewhere.
   Write only inside your two folders above. Never edit `dashboard/public/index.html`, `app.js`, `labs.js`,
   `inventory.js`, `content.js`, `glossary.js`, `dashboard/build.mjs` or `AGENTS.md`. To change one, message the hub.
2. **Your sub-dashboard** is a self-contained `index.html` in your folder (inline CSS and JS, data in JSON files beside
   it). Same design language as the main page: plain words for a lay reader, every number computed from a file, honest
   labels for anything simulated, unverified or unfinished. Add a back link to `../../index.html`.
3. **Your status file**, `dashboard/public/t/<you>/status.json`, is how the hub shows your progress. Rewrite it
   whenever something changes, at least every 30 minutes:
   ```json
   {
     "thread": "lean",
     "title": "Lean formalization",
     "updated": "2026-10-31T09:30:00Z",
     "state": "working",
     "headline": "One sentence: what is true right now.",
     "metrics": [{ "label": "theorems compiling", "value": 1 }],
     "links": [{ "label": "Sub-dashboard", "url": "t/lean/index.html" }],
     "blockers": ["Plain sentence, or empty list"],
     "needs": [{ "from": "holdout", "ask": "What you need from another thread" }],
     "next": ["Next concrete step"]
   }
   ```
   `state` is one of `starting`, `working`, `blocked`, `done`. Never write a number you did not compute.
4. **Talking to other sessions.** Use the SendMessage tool with the target's name from ListAgents. Put the whole point
   in the first line. Use messages for asks and handoffs, and files for results. Do not message to say "working on it".
   Do not ask a peer to do something your own permissions would block.
5. **Building and deploying.** Everyone shares one tree, so a deploy includes everyone's current files:
   ```
   node dashboard/build.mjs
   cd dashboard && npx wrangler deploy
   ```
   Run it after a meaningful update. Never deploy from a copy of the tree. The live site is
   https://delphi-mission-control.ashenoy000.workers.dev and your page lives at `/t/<you>/`.
6. **Rules inherited from `AGENTS.md` and `BEST_PRACTICES.md`**, in short: nanopubs go to the test registry only and only
   with the key owner's approval; an assessor never scores what it built; never invent a DOI, accession, URL or number;
   pre-register a test before looking at data; never put API keys or the hackathon's credit links in the repo.
7. **Deadline.** Hacking ends Sunday Nov 1 at 1:00 PM (event time zone not stated; assume Boston). Final slides are due
   then. Plan to have your headline result and sub-dashboard final by Sunday 9:00 AM.

## Scoring, so you know what the work is for

Problem significance 20, scientific or technical impact 25, decentralized agency 20, collective capability 25,
execution and validation 10, plus up to 10 for capabilities that other teams reuse. A result is worth more when it
is measured against a baseline, validated on data the builder never saw, and reproducible from a clean checkout.
