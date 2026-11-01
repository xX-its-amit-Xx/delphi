# Winged zebrafish — 3D-printable anatomical puzzle kit

**Status: stage 1 shipped. Stage 2 (the assembly kit) is in progress.**

Everything here is generated from
`dashboard/public/blueprint3d/model/winged-zebrafish.glb` and its manifest. Nothing
was modelled by hand.

## What this is, and what it is not

- The "winged zebrafish" is a **design**, not a described species. It is a zebrafish
  with the pectoral fin proportion moved toward the flying fish. Every part carries
  that `hypothetical_note` in `manifest.json`.
- The geometry is **schematic**. Organ shapes, positions and sizes are generated from a
  parameter set, not measured from a specimen. The one proportion with evidence behind
  it is the pectoral fin planform (`pectoral_area_over_SL2`); the rest is a plausible
  arrangement, not data.
- **Cell tokens are markers, not cells.** See "Cell tokens" below.
- A printed copy is a teaching object. It is not a reference for zebrafish anatomy, and
  it is certainly not a reference for an animal that does not exist.

## Files shipped so far

| file | what |
|---|---|
| `dashboard/public/blueprint3d/print/winged-zebrafish-whole-120mm.stl` | stage 1: whole animal, one piece, solid |
| `dashboard/public/blueprint3d/print/winged-zebrafish-glider-120mm.stl` | one-piece glider variant, hollowed — **not** part of the kit |

## Scale

The manifest's `standard_length_m` is 0.0388 m — the real fish is **38.8 mm** standard
length. Both files print at **120 mm standard length**, a scale factor of **3.0928x
life size** (146.34 mm per model unit). 120 mm was chosen because the animal with its
fins spread fits one 200x200 mm plate.

Standard length excludes the caudal fin, so the bounding box is longer than 120 mm:
137.3 x 79.1 x 48.8 mm.

## Measured physical properties

Measured on the exported meshes by integrating the triangle soup — these are
measurements, not estimates.

| quantity | value |
|---|---|
| solid volume, whole animal | **35.751 cm3** |
| solid mass, PLA (1.24 g/cm3) | 44.33 g |
| solid mass, resin (1.12 g/cm3) | 40.04 g |
| solid mass, PETG (1.27 g/cm3) | 45.40 g |
| centre of mass from the snout, uniform density | **0.4284 x SL** (51.4 mm) |
| pectoral planform (lifting) area, both fins | **1184.67 mm2 = 1.18467e-3 m2** at print scale |
| the same area at life size | 1.2385e-4 m2 |
| tip-to-tip pectoral span | 78.95 mm at print scale (25.53 mm at life size) |
| pectoral aspect ratio (span2/area) | 5.261 |

The planform is the projection of the two single-layer fin **membranes** onto the
horizontal span-chord plane — the source surfaces, before the printable thickening.
That is the lifting area; the thickened print geometry would over-report it.

### Glider variant

| quantity | value |
|---|---|
| material volume | **14.711 cm3** |
| mass, PLA | 18.24 g |
| mass, resin | 16.48 g |
| centre of mass from the snout | **0.4849 x SL** |
| wall | 1.5 mm, body only; fins and fin rays solid at 1.8 mm |
| cavity volume | 25.787 cm3 |

Hollowing moves the centre of mass aft, from 0.4284 to 0.4849 of standard length,
because the cavity removes mass from the deep mid-body and leaves the solid head and
solid fins.

**The cavity is sealed.** For resin printing, add a drain hole before slicing. For FDM,
slice with 0% infill and this wall thickness.

## Glide performance is UNVERIFIED

Read this before anybody flies anything or quotes a number.

- No wind-tunnel test, no CFD and no free-flight test has been run on this geometry.
- The project's `C_Lmax = 0.78` and `(L/D)max = 4.37` were measured by **Park & Choi on
  a real stuffed flying-fish specimen**, not on this mesh. They describe a different
  object: a real animal's body with real fin membranes, surface texture and camber. This
  body is schematic and its fins are flat plates 1.8 mm thick at print scale.
- **Nobody has checked this body's stability.** The centre of mass is reported above; no
  neutral point, no static margin, no pitch, yaw or roll stability has been computed. A
  centre of mass at 0.48 SL tells you nothing on its own about whether the thing trims.
- The volume, mass, centre of mass and planform area above **are** measured on this mesh
  and can be used. Any lift, drag or glide-ratio figure attached to this mesh is a guess
  until somebody tests it.
- **The assembled kit will not fly.** It has joints, clearance gaps at every socket, a
  stepped surface, and mass concentrated wherever the pegs and carriers are. The glider
  is a separate one-piece object for that reason. Do not confuse them.

## Print settings assumed

- FDM, 0.4 mm nozzle, 0.2 mm layer height, 3 perimeters.
- Minimum wall / membrane thickness at this scale: **1.0 mm** (kit), 1.8 mm (glider fins).
- Voxel remesh at 0.45 mm is the last step on every joined part. It guarantees a closed
  manifold solid and it rounds any detail finer than 0.45 mm. That is a real loss of
  fidelity and it is recorded per part in `manifest.json`.
- No supports needed for the whole animal printed on its side (flat on one flank).

## Verification

Every STL is checked in Blender with `bmesh`:

1. every edge has exactly two faces — **watertight**;
2. every edge is *contiguous*, i.e. its two faces wind in opposite directions — this is
   the real inverted-normal test and it is correct for concave shapes, unlike comparing
   a face normal against the direction of the centre of mass;
3. no loose vertices or edges;
4. signed volume > 0, so the consistent orientation points outward.

Both shipped files pass all four. Results are in `manifest.json` under each part's
`checks`.

## How to rebuild

Portable Blender 4.2.23 LTS, headless:

```sh
B="C:/Temp/tools/blender/blender-4.2.23-windows-x64/blender.exe"
M="dashboard/public/blueprint3d/model"

# stage 1: whole animal at 120 mm standard length
"$B" -b --python anatomy-model/print/stage1_whole.py -- \
    "$M/winged-zebrafish.glb" "$M/winged-zebrafish-manifest.json" <outdir> 120

# metrics + the glider variant
"$B" -b --python anatomy-model/print/stage1_metrics_glider.py -- \
    "$M/winged-zebrafish.glb" "$M/winged-zebrafish-manifest.json" \
    <shipped-whole-stl> <outdir> 120

# verification of any finished STL
"$B" -b --python anatomy-model/print/verify_prints.py -- <outdir> <out.json>
```

Scratch output goes to `C:\Temp\stl\`; only the finished STLs are copied into
`dashboard/public/blueprint3d/print/`.

## Still to come (stage 2)

The assembly kit: organ systems as top-level carriers, each organ a separate seated
piece, the four tissue-level pieces, and cell tokens for the organs where our data
records a cell type. Joinery, parts list, assembly order, plate preview and totals will
be added to this file when that lands.
