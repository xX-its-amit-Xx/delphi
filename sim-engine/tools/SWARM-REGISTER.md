# Registering the swarm board tools in sim-engine/server.mjs (patch for the hub)

`sim-engine/swarm/board.mjs` exports `SWARM_TOOLS`: five tools in the same `{name, title, description, inputSchema,
handler}` shape as `STUDIO_TOOLS`, `LEAN_TOOLS` and `SPEC_TOOLS`.

| tool | what it does | writes |
|---|---|---|
| `swarm_post_task` | adds a task (kind generate/evaluate/validate/review, level, target, inputs, required_role prefix, depends_on, lease_s, max_attempts) bound to a codesign session | board log |
| `swarm_claim` | claims the first claimable task matching an agent role (or `task_id`) under a lease; one live claim per role; `renew:true` extends it; returns the session organism, proposals and comments as context | board log |
| `swarm_submit` | finishes a claimed task: edits become a session `proposal` (validated, not applied), anything else a `comment`; `failed` frees the task until `max_attempts` | board log + session (proposal/comment only) |
| `swarm_status` | every task with its derived status (open, claimed, done, failed, expired) and the proposals awaiting a human | nothing |
| `swarm_try_edits` | dry-runs edits on an inline copy of the session organism: per-edit Lean verdicts and optional scenario runs | nothing |

The swarm work does not edit `server.mjs`. Apply these lines there:

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { SPEC_TOOLS } from './tools/spec-tools.mjs';
+import { SWARM_TOOLS } from './swarm/board.mjs';
@@
   ...SPEC_TOOLS,
+  // Swarm task board on codesign sessions: swarm_post_task, swarm_claim, swarm_submit, swarm_status, swarm_try_edits
+  // (swarm/board.mjs). Results land in the session as proposals or comments; humans still decide with session_decide.
+  ...SWARM_TOOLS,
 ];
```

Then regenerate the contract and run the tests:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node sim-engine/swarm/test/board.mjs            # 32 checks: leases, claims, expiry, deps, roles, cross-process lock
node sim-engine/swarm/test/board.mjs --mutate   # each of 3 damaged boards must fail at least one check
```

Until it is registered, agents reach the same tools through `node sim-engine/swarm/mcp-server.mjs` (stdio, all tools +
swarm) or `node sim-engine/swarm/http.mjs` (HTTP bridge on 127.0.0.1:7342). Registration changes neither file.

**HTTP bridge note.** `sim-engine/http.mjs` auto-discovers tool arrays exported from `sim-engine/tools/*.mjs` only, so
it does not see `swarm/board.mjs` until the server.mjs patch above is applied (then they come in through `TOOLS`).

## Storage and policy

- Board log: `<STUDIO_SESSIONS_DIR or sim-engine/sessions>/swarm/tasks.jsonl`, append-only, gitignored with the rest of
  `sim-engine/sessions/` (`sessions/*` in `sim-engine/.gitignore`). Override with `SWARM_BOARD_FILE`. Writers from several
  processes serialise through `tasks.jsonl.lock` (stale after 30 s).
- Roles: claims and submits need an `agent:` role label that passes `checkAuthor`; a `human` role cannot claim (humans
  decide). `swarm_submit` can only post `proposal` or `comment`, never `edit` or `decision`.
- AGENT-GUIDE.md section 7 is regenerated from the live tool list; after registration it will list the five tools.
