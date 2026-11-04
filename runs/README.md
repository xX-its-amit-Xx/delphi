# runs/ — one question, put through the whole suite, and what it broke

Each folder is a single design question driven end to end through the MCP surface: the front-door parser
and its routing, `organism-design/blueprint.mjs`, the Design Studio, the Lean law check, the validation
harness, and the locomotion, ecology and performance layers. Every call goes through the tool registrations
in `mcp/server.mjs`, so nothing a run does can work in a way an agent with the MCP server could not.

```
node runs/<name>/run.mjs                               # the generations, logging everything
node dashboard/public/blueprint3d/studio-live/gen.mjs  # bake the replays the live page reads
node runs/_lib/shoot.mjs --run <name>                  # screenshots, one per generation
```

**Running one opens the 3D scale theatre on it, live** (`dashboard/public/blueprint3d/studio-live/theatre.html`):
the organism on a schematic body plan, every part clickable, each showing the Lean laws that reach it (with
the proof), the checks that looked at it and the graded chain from a protein up to it. The page redraws
after every generation. `DELPHI_OPEN=0` runs headless. See [`sim-engine/scales/`](../sim-engine/scales/README.md).

The molecule-to-organ chains are in [`_chains/`](_chains/): 68 links across the four runs, each quoted from
a fetched, logged document and re-verified by a second agent that deleted or downgraded what it could not
confirm, with 30 missing rungs declared rather than guessed across.

Or watch the session log: **`dashboard/public/blueprint3d/studio-live.html`**, which polls a running studio
(`node sim-engine/http.mjs`) and replays the baked session otherwise, saying in the badge which it is doing.

## The runs

| run | question | where it ends |
|---|---|---|
| [flying-mouse](flying-mouse/) | can a mouse grow wings that support its flight? | **No.** Uberon refuses `wing` and `patagium` for Glires; lift reaches 0.39× the weight at a jump launch; powered flight is refused as a power question. With the three quantities declared, `physics_check` runs on a mouse and the area check is **met** at a 4 m drop. |
| [carbon-eating-bacterium](carbon-eating-bacterium/) | a bacterium that eats carbon — could it live anywhere? | A paddle is **impossible** by the scallop theorem; a flagellum is not contradicted; it is **outcompeted** on the designer's own parameters; and its first carbon numbers **violate conservation of mass**, which the corrected ones do not. |
| [long-lived-fruit-fly](long-lived-fruit-fly/) | a fruit fly that lives longer | **2× in a vial, 1.09× in the wild.** Extrinsic mortality sets a ceiling of 12.5 days that nothing done inside the animal can reach past. |
| [xenobot](xenobot/) | a xenobot that sweeps particles into piles | The subject is declared a **construct**, so the phenotype reference set refuses as one. It can move **one or two** particles, not the twenty first claimed. |

## Why these four

They were chosen to leave the animals, leave the shapes, and leave the organisms:

- a **mouse** is an animal the engine has no parameters for — clade generality
- a **bacterium** is not an animal at all — kingdom generality, and it found that the anatomy ontologies,
  the cell ontology and the law set are all animal artefacts even where the code is not
- a **fruit fly living longer** is not a question about a shape — a dimension with no layer
- a **xenobot** is not an organism — the subject itself is the wrong kind of thing

## Every requirement now reaches a check

The first round of these runs ended on refusals that were correct and useless: the thing being asked for was
not expressible, so nothing could take it. Three layers and a routing block closed that.

| what was asked | what takes it now |
|---|---|
| a shape, a structure | `blueprint.mjs` → `organism_from_blueprint` |
| a law | `lean_check`, clade scope from the taxon |
| a scenario criterion | `physics_check` |
| **how it moves** | `locomotion_check` — a theorem, arithmetic, and regimes that never fail a design |
| **how long it lives** | `performance_check { kind: "lifespan" }` |
| **what it does to the world** | `performance_check { kind: "manipulation" }` |
| **what it eats** | `performance_check { kind: "mass_balance" }` |
| **whether the world has room** | `ecology_check` |

`parse_design_text` returns a **`routing`** block naming the tool for each requirement, and for everything
it could not read, whether a layer exists for it at all. "I do not understand these words" and "I understand
them and nothing here answers them" are different facts and used to be indistinguishable.

**36 of the 49 gates across the four runs now reach a verdict.** Of the 13 that do not, none is a missing
layer: five are generation-0 baselines that a later generation closes, five are named data gaps (teleost-only
reference sets, no powered flier in the functional registry with Aves held out), and three are the correct
answer — a construct has no occurrence records, and powered flight is a power question an area check cannot
take.

## What every run says about itself

**Declared inputs.** Masses, areas, speeds, beat frequencies, hazard rates, thrusts, carbon fluxes and all
four competition parameters are *design inputs*, each carrying a source that says so. They enter STATE with
kind `assumed`, so every `model_confidence` and weakest-input downstream carries the fact that a person
stated them. You may declare an input; you may not declare an outcome.

**No measured meshes.** No subject in any run has a measured surface mesh: `anatomy-model/parametric` is a
parametric *teleost*-only builder, so it had nothing to build for these (Blender itself is installed on this
machine; that was never the reason). The studio-live 3D view is the ontology hierarchy. The scale theatre now
draws Blender **illustration** meshes for the insect, tetrapod, prokaryote and construct frames
(`sim-engine/scales/mesh/`): sculpted from textbook body plans, labelled as not measured, and styled per
ladder so a slot the blueprint lacks is ghosted or hidden rather than drawn as present. A run builds them by
default (`DELPHI_MESH=1`, set by `runs/_lib/studio-run.mjs`); `DELPHI_MESH=0` turns that off.

**Nothing is recomputed for display.** Every verdict on the live page is the string the tool returned.

## Defects these runs found

Twenty so far, none by reading the code. The ones that would have produced a confident wrong answer:

- `physics_check` applied a stuffed flying fish's lift coefficient to any design handed to it
- `parse_design_text` discarded every criterion in a clause naming an unknown organism — "a mouse that
  supports its flight" asked for nothing at all
- `parse_design_text` read the `fly` in **fruit fly** as the verb, adding a glide requirement to a question
  about lifespan
- `blueprint.mjs` silently defaulted an unrecognised organism to **Metazoa** and returned a generic animal,
  with organ systems, for "a bacterium that eats carbon"
- `blueprint.mjs` substituted structures for a refused one without saying so
- `closest_relative_phenotype` named a cichlid as a mouse's closest relative, and a frog as a xenobot's
- the **ecology layer wrote held-out-clade records to its own cache** — the filter downstream was perfect
  and the raw GBIF responses went to disk on the way past, 28 bird species about to be committed
- a taxon base **resolved no STATE at all**, so `organism_get` refused outright and everything built on a
  STATE was unreachable for any organism outside the bundle — a capability gap reported as a fact about the
  organism

Each run's README lists its own.
