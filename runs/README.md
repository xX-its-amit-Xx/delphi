# runs/ — one question, put through the whole suite, and what it broke

Each folder is a single design question driven end to end through the MCP surface: the front-door parser,
`organism-design/blueprint.mjs`, the Design Studio, the Lean law check, the validation harness, and — since
the second round — the locomotion and ecology layers. Every call goes through the tool registrations in
`mcp/server.mjs`, so nothing a run does can work in a way an agent with the MCP server could not.

```
node runs/<name>/run.mjs                               # the generations, logging everything
node dashboard/public/blueprint3d/studio-live/gen.mjs  # bake the replays the live page reads
node runs/_lib/shoot.mjs --run <name>                  # screenshots, one per generation
```

Watch any of them: **`dashboard/public/blueprint3d/studio-live.html`**, which polls a running studio
(`node sim-engine/http.mjs`) and replays the baked session otherwise, saying in the badge which it is doing.

## The runs

| run | question | the answer, and the layer that gave it |
|---|---|---|
| [flying-mouse](flying-mouse/) | can a mouse grow wings that support its flight? | **No.** Uberon refuses `wing` and `patagium` for Glires; at 70 cm² and a jump launch lift reaches 0.39× the weight; powered flight is refused as a power question. |
| [carbon-eating-bacterium](carbon-eating-bacterium/) | a bacterium that eats carbon — and could it live anywhere? | **Not as first designed, and probably not anywhere.** A paddle stroke is *impossible* by the scallop theorem; a flagellum is not contradicted; on the designer's own parameters it cannot invade against the resident autotroph guild. |
| [long-lived-fruit-fly](long-lived-fruit-fly/) | a fruit fly that lives longer | **Unanswerable here.** Nothing in this repository models time-to-death: 12 scenarios, none about lifespan, no mortality rate and no senescence model for any clade. |
| [xenobot](xenobot/) | a xenobot that sweeps particles into piles | **The subject is not representable.** Every layer that needs a taxon takes the donor frog's and carries on. The task — what the thing *does* — has no layer at all. |

## Why there are four

They were chosen to leave the animals, leave the shapes, and leave the organisms:

- a **mouse** is an animal the engine has no parameters for — it tests clade generality
- a **bacterium** is not an animal at all — it tests kingdom generality, and found that the anatomy
  ontologies, the cell ontology and the law set are all animal artefacts even where the code is not
- a **fruit fly living longer** is not a question about a shape — it tests whether the system notices a
  dimension it has no layer for, instead of answering a nearby question it can do
- a **xenobot** is not an organism — it tests what happens when the subject itself is the wrong kind of thing

## What every run says about itself

**Declared inputs.** Masses, areas, speeds, beat frequencies and all four competition parameters are
*design inputs*, each carrying a source string that says so. Nobody has measured a winged mouse, a flagellated
*Cupriavidus* strain at a stated speed, or a xenobot's beat frequency.

**No meshes.** No subject in any run has a surface mesh. `anatomy-model/parametric` is a parametric *teleost*
builder and Blender is not installed on the machine these ran on. The 3D view is the ontology hierarchy —
structure without shape. Every generation record carries `mesh.glb: null` with that reason.

**Nothing is recomputed for display.** Every verdict on the live page is the string the tool returned, with
the numbers it returned, copied from the Design Studio session log.

## Defects these runs found

Fourteen so far, none of them found by reading the code. The ones that would have produced a confident
wrong answer rather than a crash:

- `physics_check` applied a stuffed flying fish's lift coefficient to any design it was handed
- `parse_design_text` discarded every criterion in a clause naming an unknown organism — "a mouse that
  supports its flight" asked for nothing at all
- `parse_design_text` read the `fly` in **fruit fly** as the verb, and added a glide requirement to a
  request about lifespan
- `blueprint.mjs` silently defaulted an unrecognised organism to **Metazoa** and returned a generic animal,
  with organ systems, for "a bacterium that eats carbon"
- `blueprint.mjs` substituted structures for a refused one without saying so
- `closest_relative_phenotype` named a cichlid as a mouse's closest relative
- the **ecology layer wrote held-out-clade records to its own cache**. The filter downstream was perfect and
  every result was clean; the raw GBIF responses were being written to disk on the way past, so 28 bird
  species sat in `sim-engine/validate/ecology/cache/` about to be committed. The screen now runs before the
  cache write, and a test asserts the cache directory is clean.

Each run's README lists its own.
