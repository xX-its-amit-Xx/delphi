# Registering `validate_generation` in `sim-engine/server.mjs` (patch for the hub)

`sim-engine/tools/pipeline-tools.mjs` exports `PIPELINE_TOOLS`: **one** tool, in the same
`{name, title, description, inputSchema, handler}` shape as `TOOLS`. I did not edit `server.mjs`.

| tool | what it does |
|---|---|
| `validate_generation` | The unifying validator. Input: the generated organism, the base organism, and the **desired phenotype as text** — the same prompt the generator was given. It parses the text into a DesignSpec, identifies the closest **functional** analogue from the desired function (not from relatedness) and fetches that analogue's genotype, sweeps the functional annotations at **ten biological scales**, then runs `functional_resolution`, `lean_check` and `physics_check` with the spec as the physics target. Returns five named results side by side, each with its own gate, **never summed**, plus a per-scale coverage number and a verdict **sentence**. |

JS entry point, for callers that do not want MCP:

```js
import { validateGeneration } from './validate/pipeline/index.mjs';
const report = await validateGeneration({ generated, base, desired_phenotype, opts });
```

CLI: `node sim-engine/validate-cli.mjs "<desired phenotype>" --base <id|file> --generated <id|file>`
(exit 0 every gate passed, 1 a gate failed, 2 nothing failed but something could not be assessed).

**Until this patch is applied:**

- `sim-engine/http.mjs` already serves it as `POST /tool/validate_generation`, through its `tools/` discovery.
- The stdio MCP server does not list it.

## Patch

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { VALIDATE_TOOLS } from './tools/validate-tools.mjs';
+import { PIPELINE_TOOLS } from './tools/pipeline-tools.mjs';
@@
   ...VALIDATE_TOOLS,
+  // The unifying validator: text + generated + base -> analogue, every scale, Lean, physics, five gates.
+  // (sim-engine/validate/pipeline/; tools/pipeline-tools.mjs; see validate/pipeline/RESULTS.md)
+  ...PIPELINE_TOOLS,
 ];
```

If `VALIDATE_TOOLS` is not yet registered either (see `VALIDATE-REGISTER.md`), apply that patch first; the two are
independent and either order works.

After applying it, regenerate the contract:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
```

Then add one line to the tool list in `CONTRACT.md` pointing at `sim-engine/validate/pipeline/RESULTS.md`.

## What a caller must understand about the output

Three things, because each one is a way the report could be misread.

**1. There are no generated genomes, and the report says so on every call.** A DELPHI design is a parent parameter
set plus deltas. `inputs.sequence.sequence_basis` is one of:

- `supplied` — real sequence was handed in for both sides
- `reconstructed-at-edited-loci` — a document with gene-level edits; sequence exists only at those loci, mapped
  through the editplan thread's Ensembl GRCz11 coordinates
- `document-only` — a document with no gene-level edit. **Every organism in the repository bundle is this case**
  (all seven carry `edits: []`), so `loci_covered` is `0` and `genotype_similarity` is `cannot-assess`, which is
  deliberately **not** a pass.

Do not render a genotype panel as green on a `document-only` run.

**2. Nothing is summed.** `results` holds five entries — `genotype_similarity`, `phenotype_similarity`,
`lean_check`, `functional_resolution`, `physics_check` — each `{status, gate, gate_set_by, result}` with
`status` one of `pass` | `fail` | `cannot-assess`. There is no overall number. The scorer thread's own composite is
carried separately under `composite_score_from_the_scorer` and is **not** the verdict: on the headline case the
frozen scorer says 0.878 "plausible" for a design the physics module says cannot leave the water.

That entry now carries two fields a UI must render with the number, never without it (2026-11-01,
`sim-engine/validate/SCORER-VERSION.md`):
- `evaluation` — the version and its blind-evaluation verdict. For every released version, including v1.3.0, that
  verdict on the **composite** is `FAIL`; `evaluation.warning` is `true`. A panel that shows the composite
  without this is claiming a validated measurement that does not exist.
- `components_that_ran` and `depends_on_the_desired_phenotype_text` — the composite is a function of the asked-for
  spec, not of the design alone. The same design at the same version is 0.9217 with no spec, 0.878 with the
  headline three-criterion ask, and 0.4676 with a glide-only ask. Do not put two composites on one axis unless
  both fields match.

**3. `cannot-assess` is not `pass`.** A component that did not run, or ran on no data, gets the third status. So
does a Lean check where every law was `cannot-evaluate`. `verdict.word_validated_withheld` is `true` whenever any
gate failed, any gate could not be assessed, any scale could not be assessed, any clause of the desired phenotype
went unparsed, or no sequence was compared — and `verdict.withheld_because` lists which. Honour it.

## Report shape

```
{
  tool, version, scope, signature,
  pipeline:   { order[], desired_phenotype_carried_into[] },
  inputs:     { desired_phenotype: { text, spec, criteria[], unparsed_verbatim[], refused_verbatim[],
                                     assumptions[], unparsed_warning },
                generated: { given, supplied_as, id, ... }, base: { ... },
                sequence:  { sequence_basis, loci_covered, genome_fraction_assessed, statement } },
  differences:{ n, entries[] },        // parameter deltas (with direction + toward_the_analogue),
                                       // gene edits, and real sequence differences when both sides are sequence
  analogue:   { rule, analogues[], per_criterion[], criteria_with_no_known_analogue[], requirement_set[],
                agreement_with_the_functional_ledger },
  scales:     { difference_set, anatomy_reached, gene_set, requirements_by_scale, scales{...},
                per_scale_coverage, unassessable_scales[] },
  per_scale_coverage,                  // the same ten coverage objects, hoisted for convenience
  results:    { <five named results>, each { status, gate, gate_set_by, result } },
  verdict:    { statement, passed[], failed[], could_not_assess[], scales_not_assessed[],
                unparsed_desired_phenotype[], word_validated_withheld, withheld_because[] },
  composite_score_from_the_scorer, notes[], ms
}
```

The ten scales, in order: `sequence_genomic`, `transcriptomic`, `proteomic`, `ptm`, `pathway`, then `cell`,
`tissue`, `organ`, `organ_system`, `body`. Each coverage object carries `assessable: true|false`; at an
anatomical scale `assessable` requires both that a term was reached by the difference set **and** that at least
one gene is annotated against it, because naming a term is not assessing it.

## Dependencies, and what happens when one is absent

Every component is owned by another thread. `validate/pipeline/deps.mjs` imports their stated entry points and
reports `{ran: false, reason}` when one is missing. Nothing is substituted, and an absent dependency becomes a
`cannot-assess` gate rather than a passed one.

| dependency | entry point | status 2026-11-01 |
|---|---|---|
| scorer | `validate/score.mjs` `assess()`, `namedResults()` | landed |
| functional ledger | `validate/functional/index.mjs` `functionalResolution(design, opts)` | **absent** — `functional_resolution` is `cannot-assess` on every run |
| physics | `validate/physics/index.mjs` `physicsCheck(design, opts)` | landed; its own `gate_status` is carried through unchanged |
| editplan | `validate/editplan/editplan.mjs` `resolveGenomic()` | landed; used only to reconstruct sequence at edited loci, and no design has one yet |
| text parser | `lib/parse-text.mjs` `parseDesignText()` | landed |
| omics | `omics/index/genes/*.json.gz`, `omics/index/parts.json.gz`, `omics/<layer>/MANIFEST.json` | landed; `omics/build-index.mjs` is neither run nor edited |
| anatomy | `dashboard/public/blueprint3d/model/*-manifest.json` | landed; read from disk, because the bundle's copy drops `ontology_label` and `levels` |

`validate/pipeline/coverage-gaps.json` holds measured per-layer row counts by species and by anatomy so the
sweep's "what is unknown" lines quote figures rather than memories. Regenerate with
`node sim-engine/validate/pipeline/scan-gaps.mjs` (~4 s) after any layer is rebuilt.

Results and the five real runs, including the control: `sim-engine/validate/pipeline/RESULTS.md`.
Tests: `node sim-engine/validate/pipeline/test.mjs` (21 checks; every property is also run against a
deliberately broken report, which must fail).
