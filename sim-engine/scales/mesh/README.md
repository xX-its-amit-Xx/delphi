# sim-engine/scales/mesh: illustration meshes for the scale theatre

Blender-sculpted bodies for the theatre's "illustrated" mode. **Every mesh is an ILLUSTRATION**: shaped by
hand from textbook body plans, with slot positions from `../body-frames.json` (which are themselves
declared). Nothing is measured. Every GLB and manifest says `geometry_basis: "schematic-illustration"` and
carries `THIS_IS_NOT_MORPHOMETRY`, and the page says "illustration sculpted in Blender — shapes are not
measured" whenever the mesh is on screen.

## The mesh never decides what the design HAS

The whole frame library is sculpted every time; the page
(`dashboard/public/blueprint3d/studio-live/theatre.js`) styles each piece per ladder:

| state | when | drawn as |
|---|---|---|
| **present** | a non-ghost part of the blueprint lands in the slot and can make it solid (an organ, an organ system, or a part placed by the slot's own Uberon id; in the prokaryote and construct frames any part, since they are made of cells) | solid, clickable |
| **ghost** | only the literature chain names a part there (`from: 'chain'`, `blueprint_has_it: false`) | translucent violet, always labelled "literature only, not in this blueprint" |
| **body** | an envelope region (head, thorax, trunk, cell body, surface) with no part of its own | neutral; a click opens the body |
| **cells** (cells-only) | only cells or tissues of the blueprint land in an organ slot (a mis-slotted cell must not become a solid sculpted limb) | amber/green translucent outline, labelled with the cell's name, e.g. "iris smooth muscle (tissue) — cells only, no muscle organ" |
| **absent** | nothing lands there | hidden; "show what this blueprint lacks" draws a faint labelled outline |

**Pieces that depict one specific part (`extras.requires`).** A deco is otherwise drawn whenever its parent slot
is, so a solid liver would carry a solid gallbladder the blueprint lacks. A node (`slot:` or `deco:`) may carry
`extras.requires = [<ontology id> | "/<regex>/<flags>", ...]`, a non-empty list meaning "this piece depicts that
specific part". The page styles it by `depictState(requires, ladder.parts)` (`depicts.mjs`), independent of its
parent slot: **ids first** (a part whose ontology id, or id minus `ghost:`, with `:` = `_`, equals one of the ids:
present if a blueprint part matches, else ghost if a chain part does); **labels** only when no id matches any part
at all, same rule; otherwise **absent**. Body-level parts never satisfy. Blueprint parts that only share a word
when an id decided are listed on the card as `related` and never make the piece solid. There is no ontology
reasoner, so a subclass counts only through the label fallback: this can under-claim and never over-claims.
Optional `extras.depicts` (a short label) and `extras.view_note` (how to see it, shown on the run card). If a
hidden parent slot holds a present piece, the parent stays in the scene as an invisible, unpickable **carrier**.
`theatre.js` is a classic script, so it carries a verbatim copy of the rule between `// >>> depicts` and
`// <<< depicts`; the test checks the copies match as text and in behaviour on every bundle.

Pieces that carry `requires` today:

| frame | piece | requires |
|---|---|---|
| construct | `deco:surface:mcc_cells`, `deco:surface:cilia` | `CL_0005012`, `/multicilia/i` (a ghost in every xenobot generation, so both are violet) |
| insect | ocelli; salivary glands (under the gut); pupal spiracles | `UBERON_0003161` `/ocell/i`; `UBERON_0001044` `/saliva\|salivary gland/i`; `/trache\|spiracl/i` |
| tetrapod | `deco:liver:gallbladder`, `deco:endocrine:parathyroid`, `deco:heart:aorta` (with the carotids), `deco:heart:great_veins`, `deco:kidney:adrenal`, `deco:kidney:ureter`, `deco:lung:trachea`, `deco:eye:lid` | `UBERON_0002110`, `UBERON_0001132`, `UBERON_0000947`, `/vena cava\|pulmonary vein/i`, `UBERON_0002369`, `UBERON_0000056`, `UBERON_0003126`, `UBERON_0001711`, each with a label regex |

For the mouse blueprint the gallbladder, parathyroid, aorta, great veins, adrenal and eyelids are therefore
hidden (outlined only with "show what this blueprint lacks"); the ureter is present by id; the trachea is
present only through the label fallback (the blueprint has no `UBERON_0003126`, but has "tracheobronchial tree"
and "epithelium of trachea"). The adrenal was a cap joined into the ureter piece; it is now its own piece, with
the same geometry. Generic features of a sculpt (bristles, facets, fur, whiskers, claws, tendons, nerves, wing
veins, the chorion, the flagellar motor) carry no `requires`: they are part of their slot as drawn.

A stage form is chosen by the declared stage NAME: nothing is interpolated between stages and development is
not simulated. The page applies the declared `length_ratio` on top.

## Files

| file | what it is |
|---|---|
| `spec.mjs` | `meshSpec(ladder)` -> frame, stage keys (by keyword on the DECLARED stage label), drivers, `stage_of_point`; `specHash(spec)` |
| `blender.mjs` | `findBlender()`, `blenderWhyNot()`, `buildMesh(spec, {force})`, `pruneMeshes(keep, {frames})`, `framesTouched(built)`, `wantMeshes(argv, env)`, `meshField(ladder, opts)` (the `ladder.mesh` block) |
| `build_mesh.py` | the Blender driver: one root empty `stage:<key>` per stage, `frames/<frame>.py` `build(spec, lib, stage)` inside each, one Draco GLB + manifest, contract names, illustration notes, the contract check |
| `lib.py` | shared bpy helpers (below). Takes PAGE coordinates. |
| `depicts.mjs` | the `extras.requires` rule (`depictState`, `requiresProblems`) |
| `frames/{insect,tetrapod,prokaryote,construct}.py` | one sculptor per frame |
| `preview.mjs` | screenshots of the REAL theatre page in mesh mode, plus real mouse clicks on every node |
| `../../../dashboard/public/blueprint3d/studio-live/mesh-preview.html?glb=meshes/<file>.glb[&stage=key]` | one GLB alone, same lighting, no per-ladder styling |
| `../../../dashboard/public/blueprint3d/studio-live/meshes/<frame>-<hash>.{glb,json}` | the output |
| `../test/mesh.mjs` | the contract, budgets, holdout, depicts, notes, extents, prune and no-side-effect tests |

## When meshes are built

```
node sim-engine/scales/build.mjs --run long-lived-fruit-fly --meshes          # insect, ~11 s
node sim-engine/scales/build.mjs --run flying-mouse --meshes                  # tetrapod, two GLBs (gens 0-3: adult only; gen 4: three stages), ~16 s
node sim-engine/scales/build.mjs --run carbon-eating-bacterium --meshes       # prokaryote, ~6 s
node sim-engine/scales/build.mjs --run xenobot --meshes                       # construct, ~3 s
node sim-engine/scales/build.mjs --meshes                                     # every run
```

- `build.mjs` builds only with `--meshes` or `DELPHI_MESH=1`; `DELPHI_MESH=0` always wins. Without it nothing
  launches Blender and nothing is pruned: the hash is still computed, so the page uses a GLB an earlier build
  left (`status: 'not-requested'`, `exists: true`). The test suite proves this with a sentinel "Blender" that
  would leave a file behind (after first proving the sentinel does fire when asked).
- `studio_theatre` / `session_open` (`sim-engine/tools/theatre.mjs`) pass `--meshes` on a launch unless
  `DELPHI_MESH=0`.
- Every run built on `runs/_lib/studio-run.mjs`, and `runs/flying-mouse/run.mjs`, default `DELPHI_MESH=1` and
  rebuild the ladder **and** its mesh after every generation, **headless too** (`DELPHI_OPEN=0` only stops the
  browser). `DELPHI_MESH=0` turns the mesh off; with both `DELPHI_OPEN=0` and `DELPHI_MESH=0` a run rebuilds
  nothing. The rebuild timeout is 600 s, enough for any sculptor here on a loaded machine.

**Cache key.** A GLB is named `<frame>-<hash>`, the hash being sha256 (12 hex) of the canonical JSON of
`{frame, generator_version, stage keys, drivers}`. Stage labels, ages and notes do not enter it, so generations
that declare the same stages share one GLB. `generator_version` is `GENERATOR_SEMVER` plus an 8-hex digest of
`build_mesh.py`, `lib.py` and `frames/<frame>.py` (line endings normalised): a sculptor's edit rebuilds exactly
that frame, an edit to `build_mesh.py` or `lib.py` rebuilds every frame. A build is a cache hit when both the
GLB and its manifest exist; `--force-meshes` rebuilds anyway. One Blender run per spec per process.

**Pruning.** With `--meshes`, after writing its bundles, `build.mjs` deletes generator-named files
(`<frame>-<12 hex>.{glb,json}`) that no bundle on disk references, **only for the frames this invocation built
or reused** (`framesTouched`). `--run xenobot --meshes` can therefore remove only construct files no bundle
names, never another frame's GLB that some other run's bundle (or one about to be rebuilt) still needs. A
build that made no mesh prunes nothing; any other file in `meshes/` is never touched. What is left: two
concurrent invocations building the SAME frame for different runs can still race (one may prune the other's
new GLB before that bundle is written); rebuilding that run with `--meshes` restores it.

**Finding Blender.** `DELPHI_BLENDER` (a path; `none` disables), then `PATH`, then
`C:/Temp/tools/blender/*/blender.exe`, `C:/Program Files/Blender Foundation/*/blender.exe` and the usual
macOS/Linux paths. Blender 4.2 is installed on this machine (`C:/Temp/tools/blender/blender-4.2.23-windows-x64/`).
When none is found the status is `no-blender` and `why` names the actual cause: `DELPHI_BLENDER points at <path>,
and no file exists there`, `... which is a folder, not the Blender executable`, `Blender is switched off:
DELPHI_BLENDER=none`, or `Blender not found on PATH, in ...`. The page badge says the same in short. A failed
sculpt leaves no GLB; the bundle says `failed` with the Python traceback's tail. Run Blender by hand to see
everything:

```
"C:/Temp/tools/blender/blender-4.2.23-windows-x64/blender.exe" -b --factory-startup \
  --python sim-engine/scales/mesh/build_mesh.py -- <spec.json> <out.glb>
```

## What the page does with it

- **Opens on the last declared stage.** With a fetchable GLB the page opens on the LAST point of the declared
  timeline (the adult, the stationary phase), the most legible form, because the first is often an egg or a
  lag-phase cell. `?age=<i>` overrides; the slider reaches every stage.
- **Beads are stage-relative.** In mesh mode the coarse levels are the mesh; tissue and cell parts stay beads, off
  until the reader turns them on. A bead sits at the centre of the nearest node of its own slot in the CURRENT
  stage form, offset by its own declared position relative to the slot's frame position, so a larva's gut cells
  sit in the larva's gut and not where the adult's would be. A bead whose slot this form does not sculpt is not
  drawn; the stage note counts them and the body's card lists them.
- **Illustration notes.** A sculptor writes down, per piece, the drawing choices a viewer could mistake for data
  (bristle counts, a ribosome density, beat shapes frozen in a wave, the membrane-area ratio a drawing reached).
  They used different custom-property keys; `build_mesh.py` folds every one (`NOTE_KEYS`: `illustration_note`,
  `note`, `schematic`, `shape_basis`, `beat`, `cells_drawn`, in that order, de-duplicated) into
  `extras.illustration_note` (with `illustration_note_from` listing the keys), into the manifest's node record,
  and, for a stage root, into the manifest's stage record. The original keys stay. Clicking a piece shows its
  note (and, for a deco under a slot, the slot's too) on the part card under a small **about this drawing** line.
- **Fallbacks, each said on screen.** three.js did not load -> no 3D view, the panel still works; the GLB could
  not be fetched or decoded (the Draco decoder comes from jsdelivr) -> `mesh could not be loaded: ... — schematic
  shown`; `no-blender` / `failed` -> the reason, schematic shown; `not-requested` with no GLB -> "mesh not
  requested — schematic shown (build with ... --meshes)"; a frame with no sculptor (teleost, unknown) or a
  generation with no body (no blueprint) -> `status: 'not-requested'`, `glb: null` and a `why`; the reader can
  always switch to **schematic**.

## Preview

```
node sim-engine/scales/mesh/preview.mjs --run long-lived-fruit-fly --gen 1 --part eye [--stage larva] [--dark] [--no-build] [--out dir]
```

Builds if needed (`--run <run> --meshes`, which prunes only that run's frame), serves `dashboard/public`, opens
`theatre.html?run=..&gen=..`, and writes to `<os tmpdir>/delphi-mesh-preview/<run>/` (never the repo):
`<run>-g<gen>-<stage>-body.png` per stage, `-<stage>-lacks.png` (absent slots outlined), `-part-<slot>.png`
(close-up after a real click), `-schematic.png`, and `preview.json` (mesh state, every click: the node under
the cursor and the card that opened). Exit 1 on a page error, a mesh that does not load, or a click that opens
the wrong card. The Draco decoder is fetched from the CDN, so a "mesh did not load" on a busy machine is worth
one retry before it is believed.

## Coordinates (verified in the page)

Page / glTF: **+X anterior, +Y dorsal, +Z the organism's RIGHT, -Z its left**, world = `body-frames.json` pos x 2.
`lib.P(x, y, z)` converts to Blender (x, -z, y); the exporter's Y-up conversion brings it back exactly. In
`lib.slot(name, side, i)` the side signs z (`right` +, `left` -) and, for the insect's repeated legs, `i = 0`
is the most POSTERIOR pair.

**Stage roots are not normalised to a common size.** An earlier version of this contract said a stage form
spans about x in [-1.6, 1.6]. None does exactly, and two frames deliberately do not try: the **construct** and
the **prokaryote** are sculpted at their frame's own slot radii, so the tissue and cell beads (placed at slot
positions x 2) land inside the drawn body. The test asserts what is true for those two: each stage root's world
extent contains every slot position x 2 of the slot nodes in that stage. The insect and tetrapod do not satisfy
even that (the pupa's antennae and wings are folded against the body, short of their slots; the larva's heart
slot sits a hair above the larva's back; the gliding adult's limbs are spread sideways at body height, above
the slots' standing-pose position; the neonate's and juvenile's flank folds stand nearer the body than the
membrane slot), and the page does not need it: it frames the visible box.
Current x extents: construct -1.21..1.12; prokaryote -2.29..1.35 (with the flagellum); insect egg -1.60..2.01,
larva -1.68..1.67, pupa -1.60..1.62, adult -1.33..1.88; tetrapod neonate -1.36..2.08, juvenile -2.71..2.06,
adult -2.97..2.05 (with the tail). Do not bake stage size differences in: the page scales by the declared
`length_ratio`.

## lib.py in one screen

```
coordinates  P, to_page, slot(name, side, i), slot_r(name), side_sign(side)
naming       part(obj, slot, side='single', i=None, role=None)   -> clickable 'slot:<slot>[:<side>[:<i>]]'
             deco(obj, parent, what)                              -> 'deco:<slot>:<what>', hung under a slot node
materials    material(name, base, rough, metal, transmission, clearcoat, sheen, sheen_tint, subsurface, ior, alpha,
                      emission, vertex_color)                     -> Principled BSDF -> glTF PBR + KHR transmission/clearcoat/sheen/ior
primitives   ellipsoid, icosphere, polyhedron, lathe(profile [(x, ry, rz, yc)]), tube(points, radius|radii),
             helix_points, limb(points, radii)  [skin modifier], blob(balls)  [metaballs -> mesh],
             membrane(outline, billow, normal, thickness)
surface      instance_on_surface(name, target, proto, count, mat, length, radius, lean, mask, budget_tris)
             scatter_in_ellipsoid(name, center, radii, proto, count, ...); protos: proto_hair, proto_cilium, proto_bead, proto_hex
finishing    move, transform(fn), smooth, subdivide, displace_noise, gradient / bands (vertex colours), mirror_z, join,
             triangles, page_bbox
data         driver(name, default) -> a declared number from spec.drivers, recorded on the next part() as basis 'declared'
```

Roles (`DEFAULT_ROLE`, override with `part(..., role=)`): **envelope** (head/thorax/abdomen, head/trunk,
cell_body, surface) is drawn see-through over interior organs and, with no part of its own, as the body;
**shell** (cuticle, skin, envelope) encloses everything and is picked last; **appendage** and **interior**
are picked first. Vertex colours need `material(..., vertex_color=True)` plus `gradient()`/`bands()`; note
that `export_image_format='NONE'` silently drops them in Blender 4.2, so the driver uses `AUTO`.

## Contract additions (beyond the fixed mesh contract)

- Node extras carry `node` (the contract name: three.js strips `:` from object names, so the page reads this),
  `slot`, `side`, `stage`, `role`, `geometry_basis`; deco extras carry `deco`.
- **Every deco hangs under a slot node of its own slot.** `lib.deco(obj, None, 'body:<what>')` (a free piece of the
  whole organism) still exists in `lib.py`, but no sculptor uses it any more (the egg's chorion hangs under the
  abdomen slot) and the contract test refuses a GLB with a `deco:body:*` node or a deco outside its slot.
- Optional `requires`, `depicts`, `view_note` (above); `illustration_note` and `illustration_note_from`, written
  by `build_mesh.py`.
- GLBs are Draco-compressed (`KHR_draco_mesh_compression`); the page decodes with three's DRACOLoader from
  jsdelivr.
- `ladder.mesh` carries `glb`, `manifest`, `hash`, `frame`, `stages`, `stage_labels`, `stage_of_point`,
  `generator_version`, `geometry_basis`, `status` (cached | built | no-blender | failed | not-requested), `exists`,
  `blender`, `why`, `driver_notes`, `notes`, `seconds`.
- The manifest's nodes carry `illustration_note` where one was written; its stages carry `triangles`, `bbox`
  (page coordinates) and a stage root's `illustration_note`.

## Budgets

<= 150k triangles per stage, GLB <= 4 MB; `build_mesh.py` refuses to leave a GLB that breaks either. Current:
insect egg 61k / larva 59k / pupa 74k / adult 143k (1.40 MB); tetrapod neonate 116k / juvenile 128k / adult 143k
(2.01 MB), adult-only 143k (0.98 MB); prokaryote lag 131k / growing 145k / stationary 132k (1.15 MB); construct
135k (0.46 MB).
