# sim-engine/swarm: a task board and recruiter on top of codesign sessions

Products 2 and 3 recruit a decentralised swarm of agents: the Design Studio to generate and augment an organism at each
level, the Validation system to check closest relatives, genotype/phenotype sanity and the Lean laws. This folder is
the shared mechanism. Agents pull tasks from a board; every result lands in a codesign session as a proposal or a
comment; a human decides every proposal with `session_decide`.

| file | what it is |
|---|---|
| `board.mjs` | the task model, append-only JSONL board with leases, cross-process lock, and the five MCP tools (`SWARM_TOOLS`) |
| `mcp-server.mjs` | stdio MCP server: every sim-engine tool + swarm (or `SWARM_TOOLSET=worker` for the worker subset) |
| `http.mjs` | HTTP bridge with the same tools, port 7342 |
| `recruit.mjs` | recruiter: spec text + base organism -> per-level tasks -> local headless workers, scripted bots, optional Frontier drafts |
| `export.mjs` | board + sessions -> `dashboard/public/swarm-board/board.json` |
| `test/board.mjs` | 32 checks (leases, claims, expiry, dependencies, roles, a 3-process race) and `--mutate` |
| `JOIN.md` | how a remote agent joins |
| `demo/` | the end-to-end run: `transcript.md`, `session.jsonl`, `tasks.jsonl`, `board.json`, `run.json`, `workers/` |
| `../tools/SWARM-REGISTER.md` | the server.mjs patch for the hub |

## Task model

`{task_id, session_id, kind: generate|evaluate|validate|review, level, target, title, inputs, required_role, depends_on,
lease_s, max_attempts, status: open|claimed|done|failed|expired, claimed_by_role, lease_until, attempts, result_ref}`.
Status is derived from the event log at read time: a claim whose lease has passed reads `expired` and is claimable
again; after `max_attempts` claims it reads `failed`. `result_ref` is `<session>#p<n>` (proposal) or `<session>#seq<n>`.

## Run

```bash
node sim-engine/swarm/test/board.mjs && node sim-engine/swarm/test/board.mjs --mutate
node sim-engine/swarm/recruit.mjs --no-llm --pipeline-test --out C:/Temp/swarm-check   # no LLM cost
node sim-engine/swarm/recruit.mjs --llm-budget 5 --frontier-draft                       # the demo (about $0.5)
```

The recruiter writes into a throwaway store under `C:/Temp` (never `sim-engine/sessions/`) and copies the results
to `--out`. Local workers are `claude -p` with `--tools ""`, `--strict-mcp-config`, an MCP config naming only
`mcp-server.mjs` in its worker toolset, `--allowedTools mcp__delphi`, a per-call `--max-budget-usd`, the prompt on stdin,
and a scratch working directory (lessons from `swarm/compare/run.mjs`). At most 3 run at once.

## Limits

- One board file; the lock is a lock file, adequate for a few local processes, not a distributed queue.
- Leases rely on the clocks of the processes sharing the file.
- Nothing stops an agent that has the full toolset (not the worker subset) from calling `session_post` with
  `kind: "proposal"` outside the board, or `organism_edit` on the saved document. The worker subset removes those tools;
  the rule does the rest.
- The scripted bots evaluate proposals one at a time and all together; they do not search combinations.
