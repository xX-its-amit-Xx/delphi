# Registering the LeanBio tools (patch for the hub)

`pipeline/leanbio/tools.mjs` exports `LEANBIO_TOOLS`: three tools in the same `{name, title, description,
inputSchema, handler}` shape as `TOOLS` in `sim-engine/server.mjs` and `LEAN_TOOLS` in `tools/lean-tools.mjs`. The
LeanBio work does not edit `server.mjs`, `http.mjs` or `mcp/server.mjs`; apply the patches below.

| tool | what it returns | network |
|---|---|---|
| `leanbio_queue` | the formalization candidate queue (`pipeline/leanbio/out/queue.json`), filterable by `min_belief`, `relation`, `origin` | none |
| `leanbio_ground` | text -> entity mentions with groundings, or `entity` -> one grounding decision | Gilda, MyGene.info, OLS4 on a cache miss; `offline: true` answers from the cache only |
| `leanbio_claim` | one record: groundings, INDRA-style statement, evidence items, belief breakdown, linked laws with their current registry status, queue position or reason, and an unsigned nanopub draft (TriG) | none |

All three are read-only (no file is written except the grounding cache on a `leanbio_ground` cache miss) and return
the provenance envelope `{result, provenance, scope}`.

## Patch: sim-engine/server.mjs

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { LEAN_TOOLS } from './tools/lean-tools.mjs';
+import { LEANBIO_TOOLS } from '../pipeline/leanbio/tools.mjs';
 import { STUDIO_TOOLS } from './tools/studio.mjs';

 export const TOOLS = [
@@
   ...LEAN_TOOLS,
+  // LeanBio: queue, grounding, claim records (pipeline/leanbio/tools.mjs).
+  ...LEANBIO_TOOLS,
   // Design Studio: organism documents, STATE, scenarios, optimisation, co-design sessions (tools/studio.mjs).
   ...STUDIO_TOOLS,
 ];
```

Then regenerate the contract (tool names changed) and re-run the checks:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node lean/registry/check-exposed.mjs
node pipeline/leanbio/test.mjs
```

and bump `contract_version` (minor: tools added) with a `sim-engine/CHANGELOG.md` entry.

`sim-engine/http.mjs` serves whatever `TOOLS` holds as `POST /tool/<name>`, so the three tools are on the HTTP bridge
once `server.mjs` carries them. (They are deliberately NOT placed in `sim-engine/tools/`, so http.mjs's directory
discovery does not serve them before the hub decides to.)

## Patch: mcp/server.mjs (hosted delphisci server)

See `mcp/LEANBIO-PATCH.md`: the zod shapes, the `package.json` `files` and `.dockerignore` lines the hosted image needs,
and the version bump.

## Not done here, on purpose

- No edit to `server.mjs`, `http.mjs`, `mcp/server.mjs`, `package.json` or `.dockerignore`: those are applied by the hub.
- No contract regeneration: `contract.json` changes only when the patch lands.
