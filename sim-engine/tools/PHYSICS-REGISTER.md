# Registering `physics_check` in `sim-engine/server.mjs` (patch for the hub)

`sim-engine/tools/physics-tools.mjs` exports `PHYSICS_TOOLS`: one tool, `physics_check`, in the same
`{name, title, description, inputSchema, handler}` shape as `TOOLS`. **`server.mjs` was not edited by this
thread**, and neither were `validate/score*.mjs`, `validate/functional-interface.mjs`, `validate/benchmark/`,
`validate/evaluation/`, the scenario modules or `dashboard/public/t/physics/sim/`.

| tool | what it does |
|---|---|
| `physics_check` | The **fifth named result**: does the design actually DO the thing? It runs the engine's own scenario modules on the design at every requested life stage against the desired function (a `DesignSpec` in `spec`, authoritative when given; otherwise inferred from the design's declared intent and said to be inferred), and reports per criterion **met / not met / no model** with the measured metric, the threshold and the limiting factor. Plus the standing physical checks as separate named checks, a `model_confidence` on every one, and a seeded ensemble giving the fraction of draws in which the function is achieved with the median and the 5–95 % band. A **gate**, not a score. |

Note the line already in `server.mjs` just below `TOOLS`:

> `flight_sim` is deliberately absent. It would wrap the physics simulation's equations, which are not
> exposed as a module, and `physics/` belongs to another thread.

`physics_check` is **not** that tool and does not replace it. It wraps no `physics/` code: it runs
`sim-engine/scenarios/*.mjs` (which already carry the physics thread's equations by agreement, see
`scenarios/glide.mjs`) and it *consumes* the physics thread's browser ensemble module
`dashboard/public/t/physics/sim/creatures.js` read-only. When `flight_sim` lands, the comment can stay as it is.

## Patch

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { GENERATIVE_TOOLS } from './tools/generative-tools.mjs';
+import { PHYSICS_TOOLS } from './tools/physics-tools.mjs';
 import { SWARM_TOOLS } from './swarm/board.mjs';
@@
   // Generative backends: generate_candidates, generative_backends_status (sim-engine/generative, README there).
   ...GENERATIVE_TOOLS,
+  // The FIFTH named result: physics_check -- does the design actually do the thing? (validate/physics/,
+  // interface in validate/physics/INTERFACE.md, controls in validate/physics/RESULTS.md). It is a GATE and
+  // never moves the composite design score, in the same way the Lean gate does not.
+  ...PHYSICS_TOOLS,
 ];
```

After applying it, regenerate the contract:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
```

and add one line to the tool table in `CONTRACT.md`:

```
| `physics_check` | Does the design actually do the thing? Runs the engine's scenarios against the desired
  function at every life stage; met / not met / no model per criterion, the standing physical checks as named
  checks, a seeded ensemble (fraction of draws achieved, median, 5-95 %) and a model_confidence on every check.
  A gate (`physics_gate_failed`), never part of the score. See `validate/physics/INTERFACE.md`. |
```

## Until this patch is applied

- `sim-engine/http.mjs` already serves it as `POST /tool/physics_check` through its `tools/` discovery
  (same mechanism that picks up `validate-tools.mjs`); verified by `discoverTools()` listing it with no errors.
- The stdio MCP server does not list it.
- The JS entry point works regardless: `import { physicsCheck } from './validate/physics/index.mjs'`.

## Shape of the call

```jsonc
{
  "organism": "tff",
  "spec": {                       // optional; AUTHORITATIVE when present
    "start_from": [],
    "criteria": [
      { "scenario": "glide", "metric": "powered_flight_margin", "op": ">=", "value": 1,
        "stages": ["adult"], "hard": true, "weight": 1 }
    ]
  },
  "draws": 200,                   // ensemble draws per criterion per stage; 0 switches it off
  "seed": "delphi-v1"
}
```

The envelope's `scope` states that this is a gate and not a score, and names how many of the checks in the
report rest on a model the independent harness calls circular. `weakest_input` on a typical call is
`assumed`, because the ensemble's distribution shapes and the sea state are assumed — that is the honest
answer and it should not be smoothed over in a UI.

## What a caller must not do with the result

- Do **not** average `fraction_achieved` into a score. It is a gate figure.
- Do **not** show "function achieved" without the `model_confidence` beside it. A `circular` grade means the
  model was scored against a number read back from the paper it is compared with; it is not evidence however
  green it looks.
- Do **not** treat `gate_status: "incomplete"` as a pass. It means a hard requirement had no model and was
  never checked, and `unchecked_requirements` lists which.
