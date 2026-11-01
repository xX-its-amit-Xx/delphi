# Registering the functional-spec tools in sim-engine/server.mjs (patch for the hub)

`sim-engine/tools/spec-tools.mjs` exports `SPEC_TOOLS`: two tools in the same
`{name, title, description, inputSchema, handler}` shape as `STUDIO_TOOLS` and `LEAN_TOOLS`.

- `parse_design_text`: text → `{spec, unparsed, refused, assumptions, validation}` (rule-based, no LLM)
- `design_from_spec`: DesignSpec (or text) → validate → evaluate the starting design → `optimize` → per-criterion, per-stage explanation

The spec work does not edit `server.mjs`. Apply these three lines there:

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { STUDIO_TOOLS } from './tools/studio.mjs';
+import { SPEC_TOOLS } from './tools/spec-tools.mjs';
@@
   ...STUDIO_TOOLS,
+  // Functional criteria: parse_design_text, design_from_spec (tools/spec-tools.mjs, lib/spec.mjs, lib/parse-text.mjs).
+  ...SPEC_TOOLS,
 ];
```

Then regenerate the contract:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node sim-engine/test/parse-text.mjs            # 66-sentence corpus + spec.mjs and tool checks
node sim-engine/test/parse-text.mjs --mutate   # every corpus case must fail on a damaged parse
```

## Browser

Nothing to register. `lib/spec.mjs` and `lib/parse-text.mjs` have no static node-only import, so
`node dashboard/build-engine.mjs` already copies them to `dashboard/public/blueprint3d/engine/lib/`.
`dashboard/public/blueprint3d/spec-box.js` imports them from there (see the comment at its top for the
`mountSpecBox` call that perturb.js makes). Re-run `build-engine.mjs` after any change to either file.

## Dependencies the tools use (read-only)

- `tools/studio.mjs` `optimize` (dynamic import, so a missing or failing studio only fails `design_from_spec`).
- `lib/organism.mjs`, `lib/state.mjs`, `lib/data-node.mjs`, `lib/lean.mjs`, `scenarios/index.mjs`.

`design_from_spec` writes nothing: no saved organism, no session entry.
