# Registering the generative tools in sim-engine/server.mjs (patch for the hub)

`sim-engine/tools/generative-tools.mjs` exports `GENERATIVE_TOOLS`: two tools in the same
`{name, title, description, inputSchema, handler}` shape as `STUDIO_TOOLS`, `LEAN_TOOLS` and `SPEC_TOOLS`.

- `generate_candidates`: `{level, base, text, conditions, n, seed}` → envelope with `result.candidates[]`. At the body
  level each candidate has `params` (the parametric model's own units), `organism` (a ready organism document:
  base parents + body-level `set` edits by `agent:generative`), `conditioned_on`, `diagnostics` and `provenance`.
- `generative_backends_status`: per level and per provider, `ok` / `not configured` / `auth failed` / `unreachable` /
  `no training data`, plus the body model's held-out metrics.

**Status: applied by the hub in commit 36a9ea36 (engine 0.4.0).** The diff is kept for the record. This work did not edit `server.mjs`; before the patch, `http.mjs` already serves both tools (it
discovers every tool array exported from `tools/*.mjs`; they show under `http_only_tools` in `GET /contract`).

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { SPEC_TOOLS } from './tools/spec-tools.mjs';
+import { GENERATIVE_TOOLS } from './tools/generative-tools.mjs';
@@
   ...SPEC_TOOLS,
+  // Generative backends: generate_candidates, generative_backends_status (sim-engine/generative, README there).
+  ...GENERATIVE_TOOLS,
 ];
```

Then regenerate the contract and run the tests:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node sim-engine/generative/test/generative.mjs             # offline checks
node sim-engine/generative/test/generative.mjs --network   # + NIM auth-failed probe and the AlphaFold DB fallback
MUTATE=conditioning node sim-engine/generative/test/generative.mjs   # any check name: that check must FAIL
```

Bump `CONTRACT_VERSION` (minor: two new tools, nothing removed) and add a `CHANGELOG.md` line; that file belongs to the
hub, so it is not edited here.

## Seeding the optimizer from generated candidates

**`optimize` needs no change.** Its `organism` argument already accepts an organism document, and a candidate's
`organism` is one. Score the candidates, then climb from the best:

```js
const gen = await generate_candidates({ level: 'body', base: 'flying-fish', text: 'much deeper body', n: 8, seed: 1 });
// pick by scenario_run on your objective, or take candidates[0]
await optimize({ organism: gen.result.candidates[k].organism, objective: {...}, variables: [...] });
```

`node sim-engine/gen-cli.mjs seed-optimize ...` does exactly this from the command line (generate, score every candidate
with `scenario_run`, run `optimize` from the best).

**`design_from_spec` needs a three-line patch** in `tools/spec-tools.mjs` (spec thread's file, so not applied here).
Its existing `seed` is the optimizer's RNG seed, so the new option is called `start_organism`:

```diff
--- a/sim-engine/tools/spec-tools.mjs
+++ b/sim-engine/tools/spec-tools.mjs
@@ designSchema.properties
     seed: { type: 'integer' }, restarts: { type: 'integer' },
+    start_organism: { type: 'object', description: 'Optional organism document to start from instead of spec.start_from, e.g. a generate_candidates result.candidates[k].organism. Its parents must match spec.start_from.' },
@@ designFromSpec
-  const baseDoc = reg.docFor(spec);
+  const baseDoc = args.start_organism ? { ...args.start_organism, edits: [...(args.start_organism.edits || [])] } : reg.docFor(spec);
```

With that, "the starting design" in the explanation is the generated candidate, the optimizer's `start` score is the
candidate's, and everything else (hard constraints, Lean, per-stage explanation) is unchanged. Validation of the
document happens inside `optimize` (`getDoc` → `validateDoc`), so a malformed candidate is rejected there with the
reason.

## Browser

Not wired into perturb.js by this work. `generative/lib/flow.mjs` and `generative/lib/text-conditions.mjs` are pure
ESM with no node-only imports, and the weights are JSON (`generative/body/model/fm.json`, ~250 KB), so the viz thread
could sample in the browser; `backends/body.mjs` reads files with `node:fs` and would need a fetch-based loader.

## Dependencies (read-only)

`lib/organism.mjs` (createOrganism, appendEdit, resolveParameters, leaves), `lib/data-node.mjs` (loadBundle),
`lib/parse-text.mjs` (parseDesignText, for the base organism and the bird refusal), `lib/envelope.mjs`.
Runtime needs no Python: training does (`python sim-engine/generative/body/train.py`, torch 2.x, numpy).
