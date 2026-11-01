# Registering the editing-plan tools in `sim-engine/server.mjs` (patch for the hub)

`sim-engine/tools/editplan-tools.mjs` exports `EDITPLAN_TOOLS`: two tools in the same
`{name, title, description, inputSchema, handler}` shape as `TOOLS`. **I did not edit `server.mjs`**, and I did
not edit `sim-engine/validate/score.mjs` either — see "Validation report section" below.

| tool | what it does |
|---|---|
| `edit_plan` | For each gene-level edit on a design (or for one `gene` + `change`): the exact GRCz11 coordinates of the change, SpCas9/SaCas9/Cas12a protospacers in the required window, an ssODN donor with arms and silent blocking mutations, a base-editor or prime-editing route, a GRCz11 off-target search, and — as first-class output — what is NOT established plus a falsifier list. `panel_only:true` returns just the report section. |
| `edit_plan_methods` | The scoring rules, the off-target method, the feasibility statements with citations and the falsifier list, without running a plan. Read it before quoting any number `edit_plan` produced. |

**Until this patch is applied:**
- `sim-engine/http.mjs` already serves both as `POST /tool/<name>` through its `tools/` discovery.
- The stdio MCP server does not list them.

## Patch

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { VALIDATE_TOOLS } from './tools/validate-tools.mjs';
+import { EDITPLAN_TOOLS } from './tools/editplan-tools.mjs';
@@
   ...VALIDATE_TOOLS,
+  // The germline editing plan for a design's gene edits (sim-engine/validate/editplan/; a PROPOSAL, never a
+  // protocol). Zebrafish only; it refuses every other species.
+  ...EDITPLAN_TOOLS,
 ];
```

After applying it, regenerate the contract:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
```

Then add one line to the tool list in `CONTRACT.md` pointing at `sim-engine/validate/editplan/RESULTS.md`.

## Validation report section

The requirement is that "a design's report carries its editing plan". `sim-engine/validate/score.mjs` is the
validation thread's file, so instead of editing it there is a wrapper in this thread's own folder:

```js
import { validateDesignWithEditPlan } from '../validate/editplan/report-section.mjs';
// identical arguments to validate_design; the report gains result.editing_plan
```

When the owner of `score.mjs` wants it in place, this is the whole change — three lines, and it appends a
section without touching the score, the verdict or any gate:

```diff
--- a/sim-engine/validate/score.mjs
+++ b/sim-engine/validate/score.mjs
@@ export async function validateDesign(args = {}) {
   if (args.swarm) res.swarm = swarmTasks(args, r);
+  if (args.edit_plan) {
+    const { editPlansForDoc, panel } = await import('./editplan/plan.mjs');
+    const plans = await editPlansForDoc(r.design?.doc ?? (await getDoc(args.organism)).doc, { offtarget: args.offtarget === true });
+    res.editing_plan = { ...panel(plans), plans };
+  }
   return envelope(res, provOf(r), SCOPE);
 }
```

**It must stay appended, never merged.** No editing-plan number may enter `design_score`, the verdict or a
gate. A guide RNA is further from a phenotype than a residue is, and the house rule (a residue is a STATE, not
a phenotype) applies with more force here, not less.

Also add one validation sub-task to `swarmTasks` if the board should carry it:

```js
T('edit-plan', 'Germline editing plan for each gene edit (proposal)', 'edit_plan', {},
  'every gene edit either has a plan with exact GRCz11 coordinates, a guide, a donor or base/prime-editing route and an off-target search, or a stated REFUSAL; the plan is never described as validated')
```

## CLI

```bash
node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.W169L
node sim-engine/validate/editplan/cli.mjs --gene hhip   --change knockout --no-offtarget
node sim-engine/validate/editplan/cli.mjs --organism winged-zebrafish --panel
node sim-engine/validate/editplan/cli.mjs --methods          # the scoring rules, without running a plan
node sim-engine/validate/editplan/test.mjs                   # 26 tests
node sim-engine/validate/editplan/test.mjs --fail-once       # inject a fault per test; every one must FAIL
```

## Scope limits enforced in code, not only documented

- **Danio rerio only.** `resolveGenomic()` refuses any other `species`, and refuses a request whose gene or
  change string names a non-fish organism (`NON_FISH_WORDS`). `edit_plan` refuses before it reaches the
  resolver as well. There is no argument that produces a human or other mammalian editing plan.
- **No Aves data** is read or fetched anywhere in this module.
- **No credentials.** Every endpoint is public and unauthenticated.
- **Refusals are refusals.** A gene symbol that does not resolve, a reference residue that does not match the
  genome, a position past the end of the protein or an unparseable change all return `{resolved:false,
  refusal}` and no plan. None of them is downgraded to a warning on a plan that still gets printed.

## Data and network

- **Nothing is committed.** Every fetch is cached under `C:/Temp/editplan-cache` (override with
  `EDITPLAN_CACHE_DIR`), off the near-full D: drive, as the environment rules require.
- **Endpoints:** Ensembl REST (`rest.ensembl.org`: `/lookup/symbol`, `/sequence/id?type=cds`, `/map/cds`,
  `/sequence/region`, `/overlap/region`), the Kazusa Codon Usage Database (`Danio rerio` [gbvrt]), and the
  NCBI BLAST URL API (`blastn-short` against `GPIPE/7955/current/all_top_level`, the zebrafish genome
  assembly). Polite: a minimum gap between Ensembl calls (`EDITPLAN_MIN_GAP_MS`, default 120 ms), one BLAST
  request in flight per guide and 15 s between polls.
- `network:false` runs entirely from cache; `offtarget:false` skips the BLAST step, which is the slow one
  (minutes per guide).

## Every number's label

`edit_plan_methods` is the authoritative list. In short:

| number | kind | what it is NOT |
|---|---|---|
| GRCz11 coordinates, codon, strand | **measured** | not inferred — the reference codon is read back out of the genome and re-translated, and a mismatch is a refusal |
| zebrafish codon usage | **measured** | Kazusa, 19 062 CDSs / 8 042 248 codons, fetched and parsed in the run; never typed from memory |
| on-target guide score | **assumed** (a labelled heuristic) | **not Doench 2016 Rule Set 2, not Azimuth, not a measured cutting efficiency, not calibrated on any zebrafish data.** The terms come from published observations; the weights are ours and were not fitted |
| Hsu 2013 position weights | measured-secondhand | the published MIT weights, not re-derived |
| MIT specificity | **derived** | a prediction from sequence, not a measured off-target rate; a **floor**, because a heuristic aligner can miss sites |
| off-target site list | derived | primary assembly only, no bulges modelled, `word_size 7` can miss spread-out mismatches |
| ssODN arm lengths | borrowed | 40/40 is conventional, not Boel's measured optimum; the 36/91 asymmetric split is a human-cell result |
| HDR rate (1–4 % error-free) | measured | **Boel 2018's loci, not ours** |
| prime-editing rate (up to 30 % somatic) | measured | **Petri 2022's loci, not ours** |
| pegRNA PBS/RTT lengths | assumed | Anzalone 2019 defaults, not optimised for this locus |
| "the edit produces the predicted phenotype" | **assumed — NOT ESTABLISHED** | `design-validation/REPORT.md` scored 1 of 10 phenotypic parameters, that one **failed**, and the joint verdict was `(NOT CLOSE / largely UNSHOWN, Lean gate FAILS)` |
