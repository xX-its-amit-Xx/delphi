# Registering the Lean law tools in sim-engine/server.mjs (patch for the hub)

`sim-engine/tools/lean-tools.mjs` exports `LEAN_TOOLS`: six tools in the same `{name, title, description,
inputSchema, handler}` shape as `TOOLS` in `server.mjs`. The Lean-API work does not edit `server.mjs`
(another thread owns it); apply this patch there.

Until it is applied:

- `sim-engine/http.mjs` already serves the six as `POST /tool/lean_*` through its `tools/` discovery,
  except `lean_check`, where the v1 wrapper registered in `server.mjs` wins.
- The stdio MCP server lists only the v1 `lean_check`.
- `node lean/registry/check-exposed.mjs` fails with `e:sim-engine` (six items), because `contract.json`
  does not carry the lean tools. That failure is intended: it clears when this patch lands.

## Patch

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import * as morphogen from './tools/morphogen-diffusion.mjs';
 import * as protein from './tools/protein-structure.mjs';
-import { physiologySchema, physiologyChain, growthSchema, growthTrajectory, leanSchema, leanCheck } from './tools/wrappers.mjs';
+import { physiologySchema, physiologyChain, growthSchema, growthTrajectory } from './tools/wrappers.mjs';
+import { LEAN_TOOLS } from './tools/lean-tools.mjs';
 import { STUDIO_TOOLS } from './tools/studio.mjs';

 export const TOOLS = [
   { name: 'morphogen_diffusion', ...morphogen.schema, handler: args => morphogen.run(args) },
   { name: 'protein_structure', ...protein.schema, handler: args => protein.run(args) },
   { name: 'physiology_chain', ...physiologySchema, handler: args => physiologyChain(args) },
   { name: 'growth_trajectory', ...growthSchema, handler: args => growthTrajectory(args) },
-  { name: 'lean_check', ...leanSchema, handler: args => leanCheck(args) },
+  // Lean laws: lean_laws_list, lean_law_get, lean_lawset_get, lean_check, lean_propose, lean_verify.
+  // One loader (lib/lean-source.mjs); the same handlers serve mcp/server.mjs, http.mjs and lean-cli.mjs.
+  ...LEAN_TOOLS,
   // Design Studio: organism documents, STATE, scenarios, optimisation, co-design sessions (tools/studio.mjs).
   ...STUDIO_TOOLS,
 ];
```

Then regenerate the contract and check:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node lean/registry/check-exposed.mjs
```

## Compatibility of `lean_check`

- **Input:** the new `lean_check` still accepts `{spec}` (an alias of `design`) and adds `lawset`
  (default `current`). v1 calls work unchanged.
- **Output:** `result` changes shape. v1 returned browser-check's raw row array. The new one returns
  `{lawset, kernel, summary, verdicts, violations, excluded, laws_without_browser_evaluation}`, with each
  verdict and violation tagged `{law_id, version, kind, status, binding}`. The only caller in the repo is
  `sim-engine/test/smoke.mjs`, which calls `wrappers.leanCheck` directly and reads only `scope`, so it keeps
  passing. `wrappers.mjs` can stay as it is, or its `lean_check` section can be deleted once nothing
  imports it.
- **`lean_propose`** is marked `local: true`. `http.mjs` withholds it when exposed off loopback, and
  `mcp/server.mjs` never registers it in HTTP (hosted) mode, because it runs a Lean build on submitted text.
  On the stdio server it is available.
- **CONTRACT.md:** add one line under the tool list pointing at `tools/lean-tools.mjs` and
  `lean/registry/README.md`. The schemas themselves come from `--dump-contract`.
