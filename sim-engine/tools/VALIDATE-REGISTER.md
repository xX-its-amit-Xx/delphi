# Registering the design-validation tools in `sim-engine/server.mjs` (patch for the hub)

`sim-engine/tools/validate-tools.mjs` exports `VALIDATE_TOOLS`: seven tools in the same
`{name, title, description, inputSchema, handler}` shape as `TOOLS`. I did not edit `server.mjs`.

| tool | what it does |
|---|---|
| `design_score` | The scorer. It has a stable JS entry point, `designScore(design, opts)` in `validate/score.mjs`. Its weights are in `validate/score-weights.json` (v1.0.0, frozen). It supports leave-out scoring through `reference_set_excluding`, which takes ids, `species:`, `family:`, `order:` or `organism:` entries. |
| `validate_design` | One report: closest relatives, sanity checks, Lean by component and the score. `swarm:true` adds sub-tasks. |
| `closest_relative_phenotype` | Nearest real specimens and organisms, with the OOD flag (calibrated threshold). |
| `closest_relative_genotype` | The edited protein compared with real orthologues. It is a STATE, never a phenotype. |
| `sanity_check_design` | Genotype and phenotype sanity checks. |
| `lean_by_component` | Lean verdicts grouped by system or part and by gene. Accepted-law violations are kept apart from candidate and contested ones. |
| `validate_swarm_tasks` | The six validation sub-tasks, as JSON. |

**Until this patch is applied:**
- `sim-engine/http.mjs` already serves all seven as `POST /tool/<name>`, through its `tools/` discovery. This was
  checked: `discoverTools()` lists them, with no errors.
- The stdio MCP server does not list them.

## Patch

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { SPEC_TOOLS } from './tools/spec-tools.mjs';
+import { VALIDATE_TOOLS } from './tools/validate-tools.mjs';
@@
   ...SPEC_TOOLS,
+  // Design validation and the pre-registered design scorer (sim-engine/validate/; tools/validate-tools.mjs).
+  ...VALIDATE_TOOLS,
 ];
```

After applying it, regenerate the contract:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
```

Then add one line to the tool list in `CONTRACT.md`, pointing to `sim-engine/validate/RESULTS.md` and
`SCORER-RESULTS.md`.

## Swarm board

`sim-engine/swarm/` did not exist when this was written, so `validate_design {swarm:true}` and
`validate_swarm_tasks` emit tasks in this neutral shape:

```
{id, kind, title, tool, args, depends_on, acceptance}
```

There are six kinds:
- `closest-relative-phenotype`
- `closest-relative-genotype`
- `sanity-geno`
- `sanity-pheno`
- `lean-by-component`
- `adversarial-review`, which depends on the other five

Each task maps onto one `swarm_post_task` call: title is title, body is acceptance, and the tool and args become
the task's inputs. The result carries `board_present: true` once `sim-engine/swarm/` exists.

## Data and network

- **Committed:** `validate/data/fishshapes-features.json`, 1.8 MB. It is a slimmed, derived copy of FishShapes v1
  (CC0), rebuilt by `validate/data/build-fishshapes.mjs`, which downloads the CSV to `C:/Temp/validate-data`.
- **Network calls:** UniProt, Ensembl and NCBI BLAST. They are cached in `validate/cache/`, are optional
  (`network:false`), and use no credentials. BLAST runs only on request (`blast:true`).
