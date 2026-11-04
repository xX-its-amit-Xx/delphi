# sim-engine/scales: the scale theatre

One designed organism, at every level this repository can say anything about, in 3D. Click a part and you
see which Lean law reaches it (and can open the proof), which checks looked at it, and the graded,
quoted literature chain from a protein up to it.

```
node sim-engine/scales/audit-taxon.mjs          # does the ontology actually place each part in this organism?
node sim-engine/scales/build.mjs                # the scale ladder for every run, and the page bundle
node sim-engine/scales/serve.mjs                # serve dashboard/public; prints the theatre url
node sim-engine/scales/shoot.mjs                # screenshots from the real page
node sim-engine/scales/test/scales.mjs          # 43 tests
node sim-engine/scales/build.mjs --meshes       # also build the Blender illustration meshes (DELPHI_MESH=1 does the same)
node sim-engine/scales/mesh/preview.mjs --run <run> [--part <slot>]   # screenshots of the page in mesh mode, real clicks
node sim-engine/scales/test/mesh.mjs            # 47 tests: mesh contract, budgets, holdout, depicts, notes, prune, no Blender unless asked
```

**You do not normally run any of these.** Running a simulation opens the theatre for you:

- `node runs/<name>/run.mjs` opens it on that run in live mode, and rebuilds the ladder and its illustration
  mesh after every generation, so the open page redraws as the design is checked. `DELPHI_OPEN=0` runs
  headless (the ladder and mesh are still rebuilt); `DELPHI_MESH=0` skips the mesh.
- an agent calls the MCP tool **`studio_theatre { run }`**, or passes `run` to **`session_open`**.
- `node mcp/cli.mjs tool session_open ...` at a terminal opens it too. A pipe or a CI job does not.

The test suite never opens anything and never starts a server: with `DELPHI_OPEN` unset, `session_open`
reports a url only if a server is already up, and otherwise has no side effects at all.

## The files

| file | what it is |
|---|---|
| `../lib/scales.mjs` | the join: blueprint + checks + laws + chain + taxon audit + growth track, per generation |
| `body-frames.json` | five schematic body plans (insect, tetrapod, prokaryote, construct, teleost). **Declared positions, not morphometry.** |
| `part-laws.json` | which of the 41 Lean laws is about which kind of part, through which quantity |
| `audit-taxon.mjs` | `in_taxon` / `never_in_taxon` from Ubergraph's nonredundant graph, graded by how specific the constraint is |
| `build.mjs` | replays each run's own organism call and resolves a STATE at every declared life stage |
| `serve.mjs`, `../tools/theatre.mjs` | the static server and the launcher |
| `../../dashboard/public/blueprint3d/studio-live/theatre.{html,js}`, `drawings.js` | the page |
| `../../runs/_chains/<run>.json` | the molecule-to-organ chains, each link quoted from a fetched document and adversarially re-verified |
| `mesh/` | the Blender ILLUSTRATION meshes: spec + hash, the Blender driver, `lib.py`, one sculptor per frame, the preview. See `mesh/README.md`. |
| `../../dashboard/public/blueprint3d/studio-live/meshes/` | the built GLBs and manifests, `<frame>-<hash>.{glb,json}` |

## Meshes: illustrated mode

The theatre draws the body two ways. **Illustrated** (the default when a GLB exists) is a Blender mesh
sculpted from a textbook body plan, one per frame (insect, tetrapod, prokaryote, construct), with a separate
form per declared life stage (egg / larva / pupa / adult; neonate / juvenile / adult; lag / growing /
stationary), chosen by the declared stage NAME: nothing is interpolated between stages and development is not
simulated. **Schematic** is the one-primitive-per-part view. The page says "illustration sculpted in Blender —
shapes are not measured" whenever the mesh is on screen. Full contract: `mesh/README.md`.

The mesh is an illustration, so it must never make a part look present that the blueprint lacks. Each slot
node is styled from the ladder: **present** (solid) when a non-ghost part that can make the organ solid lands
in that slot; **ghost** (translucent violet, labelled "literature only, not in this blueprint") when only the
chain names it; **body** (neutral) for an envelope region (head, thorax, trunk, cell body) with no part of its
own, where a click opens the body; **cells-only** (amber/green outline, labelled with the cell's name) when only
cells or tissues land in an organ slot, so a mis-slotted cell never becomes a solid sculpted organ; **absent**
(hidden) when nothing lands there, with a "show what this blueprint lacks" toggle that outlines and labels them.
A piece that depicts one specific part carries `extras.requires` (ontology ids first, label regexes as a
fallback) and follows THAT part's state, not its slot's: the xenobot's cilia and multiciliated cells are violet
ghosts because `CL_0005012` is only in the literature chain; the mouse's gallbladder, aorta, great veins,
parathyroid, adrenal and eyelids are hidden because its blueprint has none of them, although the liver, heart,
endocrine, kidney and eye slots they hang from may be solid. Clicking a piece shows its
`extras.illustration_note` (the drawing choices a viewer could mistake for data) under "about this drawing".

The page opens on the LAST declared stage point when a GLB is available (`?age=<i>` overrides), keeps the
tissue and cell beads off until asked, and places each bead relative to its own slot's node in the CURRENT
stage form (a bead whose slot that form does not sculpt is not drawn, and the stage note says so).

Every ladder carries `ladder.mesh` (glb, manifest, hash, frame, stages, stage_of_point, status, why, ...).
`build.mjs` builds meshes only with `--meshes` or `DELPHI_MESH=1`; otherwise nothing launches Blender and the
status is `not-requested` (an existing GLB for the same spec is still used). A launch through `studio_theatre` /
`session_open`, every run under `runs/` built on `runs/_lib/studio-run.mjs`, and `runs/flying-mouse/run.mjs` turn
meshes on unless `DELPHI_MESH=0`, also when `DELPHI_OPEN=0`. The GLB name is `<frame>-<hash>`: the hash covers
frame, stage keys, drivers and a digest of `build_mesh.py`, `lib.py` and that frame's sculptor, so a cached GLB is
reused instantly and a sculptor's edit rebuilds only its frame. With `--meshes`, unreferenced generated meshes are
pruned only for the frames that invocation built, so building one run never deletes another run's GLB.
Blender 4.2 is installed here (`C:/Temp/tools/blender/`); it is found from `DELPHI_BLENDER`, `PATH` or the usual
install folders. If it is missing, or the sculpt fails, or the GLB cannot be loaded, the page falls back to the
schematic and says which, naming the cause (`mesh not built: DELPHI_BLENDER points at a file that does not exist`,
`mesh not built: Blender not found (set DELPHI_BLENDER)`, `mesh build failed: ...`, `mesh could not be loaded: ...`).

## Four colours, four kinds of statement

| | |
|---|---|
| **proof** | a Lean theorem, kernel-checked, with a module and a line. The chip opens the source. |
| **check** | arithmetic in `sim-engine/validate/`, resting on something undisputed but not formalised |
| **literature** | a graded, quoted link from a paper, usually in another species |
| **declared** | a number a person typed, carrying the source string that says they typed it |

Nothing leaves `scales.mjs` without one of these four, and a test pins it. The view is worth having only
if a reader can tell a proof from a citation from a guess without reading.

## What a law chip's status means

`supports` / `violates` only when a check actually evaluated the law. Quantities present and nothing run is
**`constrains-but-not-evaluated`** — having the numbers is not the same as anyone having checked them.
`out-of-scope` means the law's own `scope.taxa` excludes the organism. `wrong-quantity` means the law's
quantity does not represent this organism's physics at all (a steady lift coefficient for an insect).

## What it found that nothing else had

**The fruit fly's body is not a fly's.** Joining the literature chain to the blueprint showed that the
chain's organs — the adult fat body and the adult brain, where the longevity experiments act — are not in
the blueprint, which instead contains bone marrow, hyaline cartilage, a penis and a uropygial gland. The
taxon audit says why: of 131 parts, **2** carry an `in_taxon` restriction specific enough to be evidence
that a fly has them; 44 are restricted only to Bilateria, and 85 carry no restriction at all. The
blueprint keeps a part unless a constraint removes it, and the constraints almost never can. Mouse: 79 of
737. The chain's anatomy that the blueprint lacks is drawn as **ghosts**, marked `blueprint_has_it: false`.

## What it does not do

- **No geometry is measured.** Every position is a slot in `body-frames.json`.
- **Development is not simulated.** The age axis is a declared growth track the engine resolves a STATE
  at; nothing divides, nothing forms, and order of appearance is not modelled. The fruit fly's track is
  deliberately non-monotonic (the larva is longer than the adult), and the xenobot has none, because its
  own declaration says it does not inherit a life cycle.
- **The molecular rungs are not proofs.** `gene-regulatory-dynamics` is not formalised; nothing in Lean
  connects a molecule to a tissue.
