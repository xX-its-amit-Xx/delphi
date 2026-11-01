# Registering the capability-map tools (patch for the hub)

`pipeline/leanbio/capability-map/tools.mjs` exports `CAPABILITY_TOOLS`: four tools in the same
`{name, title, description, inputSchema, handler}` shape as `TOOLS` in `sim-engine/server.mjs`, `LEAN_TOOLS` in
`tools/lean-tools.mjs` and `LEANBIO_TOOLS` in `pipeline/leanbio/tools.mjs`. The capability-map work does **not**
edit `server.mjs`, `http.mjs`, `cli.mjs` or `mcp/server.mjs`; apply the patches below.

| tool | what it returns | network |
|---|---|---|
| `leanbio_personas` | who could use Lean for Bio: who they are, what they do today, what they would ask, and the tools they need with each marked EXISTS / PARTIAL / MISSING | none |
| `leanbio_use_cases` | one row per concrete job: the question, the tool sequence that answers it today, what is missing, a worked example where one exists, and the honest limit of the answer | none |
| `leanbio_grand_questions` | the grand questions of biology, each split into the formalisable core (what a proof settles, with the Lean declaration where one exists) and the empirical remainder (what only measurement can settle), plus what already exists here and the tools needed | none |
| `leanbio_tool_gap` | the deduplicated gap list with signatures, what each would read, effort and buildability, ranked by how many personas, use cases and grand questions each unblocks; plus the things deliberately absent | none |

All four are read-only, make no outbound call, write nothing, and return the provenance envelope
`{result, provenance, scope}`. They are safe on the hosted server as-is: unlike `leanbio_ground` there is no cache
to write and no third-party service to call, and unlike `lean_propose` there is no Lean build.

## Patch: sim-engine/server.mjs

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { LEANBIO_TOOLS } from '../pipeline/leanbio/tools.mjs';
+import { CAPABILITY_TOOLS } from '../pipeline/leanbio/capability-map/tools.mjs';
 import { STUDIO_TOOLS } from './tools/studio.mjs';

 export const TOOLS = [
@@
   ...LEANBIO_TOOLS,
+  // The capability map: personas, use cases, grand questions and the tool gap analysis
+  // (pipeline/leanbio/capability-map/tools.mjs). Read-only, no network, no writes.
+  ...CAPABILITY_TOOLS,
   ...STUDIO_TOOLS,
 ];
```

Then regenerate the contract (tool names changed) and re-run the checks:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node lean/registry/check-exposed.mjs
node pipeline/leanbio/capability-map/test.mjs
node pipeline/leanbio/capability-map/build.mjs
```

Bump `contract_version` (minor: tools added) with a `sim-engine/CHANGELOG.md` entry.

**Note the ordering, because it matters here and nowhere else.** The capability map's own test checks that every
tool name it marks `EXISTS` is a real tool, resolving names from `sim-engine/contract.json`, `mcp/server.mjs` and
the map's own export. Its four tools are in that export, so the test passes before and after this patch; what
changes is that they also appear in `contract.json`, which `cli.mjs` and `http.mjs` read. Rebuild the map after
regenerating the contract: the new tool count is one of the numbers the map reports about itself.

`sim-engine/http.mjs` serves whatever `TOOLS` holds as `POST /tool/<name>`, so the four tools are on the HTTP
bridge once `server.mjs` carries them. They are deliberately NOT placed in `sim-engine/tools/`, so http.mjs's
directory discovery does not serve them before the hub decides to.

## Patch: sim-engine/cli.mjs (optional, for parity with the lean_* subcommands)

```diff
+  case "capability": out(await cap.leanbio_personas.handler({ brief: true })); break;
+  case "personas": out(await cap.leanbio_personas.handler({ id: arg(1) })); break;
+  case "use-cases": out(await cap.leanbio_use_cases.handler({ id: arg(1), limit: 50 })); break;
+  case "grand-questions": out(await cap.leanbio_grand_questions.handler({ id: arg(1) })); break;
+  case "tool-gap": out(await cap.leanbio_tool_gap.handler({ id: arg(1), limit: 30 })); break;
```

Until then the same answers come from `node pipeline/leanbio/capability-map/cli.mjs <subcommand>`, which calls the
identical handlers and adds `--table` for the human view. Full flag list: the header of that file.

## Static API (already wired)

`dashboard/build-lean-api.mjs` imports `mirrorFiles()` from the map's `build.mjs` behind an optional `try/await
import`, the same pattern the open-questions registry uses, and publishes it under
`/api/lean/capability/`. Nothing to apply; `node dashboard/build-lean-api.mjs --check` covers it.

## Not done here, on purpose

- No edit to `server.mjs`, `http.mjs`, `cli.mjs`, `mcp/server.mjs`, `package.json` or `.dockerignore`.
- No contract regeneration: `contract.json` changes only when the patch lands.
- Nothing in `lean/registry/open-questions/`, which belongs to another thread. The capability map reads none of
  its files directly and credits its three tools (`lean_open_questions`, `lean_open_question`,
  `lean_open_question_guard`) as EXISTS where they answer part of a persona's need.
