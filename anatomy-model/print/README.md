# Winged zebrafish — 3D-printable files

Everything here is generated from the project's own meshes and data. Nothing was
modelled by hand. Every file is verified before it ships, and every place where the
anatomy was altered to make it printable is recorded in `manifest.json`.

---

## ⚠ READ FIRST — two printing hazards

**1. The 120 mm glider has a SEALED CAVITY.** `winged-zebrafish-glider-120mm.stl` is
hollowed in the trunk and tail with no opening. A sealed cavity in a resin printer traps
uncured resin, can balloon or implode under peel suction, and can fail mid-print. Before
resin printing, **add a drain hole**; or print it FDM at 0% infill with a 1.5 mm wall.
I did not choose a hole position because the right place depends on your print
orientation. The 1:1 files have no sealed cavity — the ballast bore opens at the snout.

**2. Glide performance is UNVERIFIED.** See "What we do and do not know about flying"
below before quoting any speed.

---

## What this is, and what it is not

- The "winged zebrafish" is a **design**, not a described species. No animal like this
  has been observed. Every part carries its `hypothetical_note` in `manifest.json`.
- The geometry is **schematic**. Organ shapes, sizes and positions are generated from a
  parameter set, not measured from a specimen.
- **The one evidence-backed proportion** in the whole project is the pectoral fin:
  `pectoral_len_over_SL` and the span and area that follow from it. Everything else is a
  plausible arrangement, not data.
- **Cell tokens are markers, not cells.** The source has no cell-level geometry and
  inventing cell shapes would be fiction. A token stands for a cell type recorded in our
  data, paired with its Cell Ontology id. See "Cell tokens".
- A printed copy is a teaching object. It is not a reference for zebrafish anatomy, and
  it certainly is not a reference for an animal that does not exist.

## Scale basis

`standard_length_m` is 0.0388 m: the real fish is **38.8 mm** standard length, which is
**0.82 model units**. Every number here is on that basis.

Standard length in fish morphometrics is measured to the hypural plate — the caudal
fin's structural base — **not** to the posterior tip of the skin. Measuring to the skin
tip gives 0.8528 units instead, and makes every derived figure come out 4% small. If you
see files built at 0.8528, they are the superseded set.

Because standard length excludes the caudal fin, every bounding box is longer than the
stated standard length.

---

## The two designs

| design | `pectoral_len_over_SL` | basis |
|---|---|---|
| `winged-zebrafish` | 0.35 | **CHOSEN** — a point picked between the zebrafish placeholder (0.155) and the flying-fish median |
| `winged-zebrafish-ff-fins` | **0.687** | **MEASURED** — the flying fish's median, Daane 2021 Data S1A, n = 49 |

`winged-zebrafish-ff-fins` is a *different design*, defined in
`design-winged-zebrafish-ff-fins.json` and built by `build_ff_fins.py`. It exists
because a glide requirement made the chosen 0.35 untenable: at 0.35 the 1:1 print's
minimum flying speed is far above anything you could throw it at. **It therefore rests
on the one evidence-backed proportion available, which is a better basis than the chosen
value — but only for that one parameter.** Everything else about it is still generated,
and the animal is still a design, not a species.

`build_ff_fins.py` injects the design into the parametric resolver at run time. Nothing
under `anatomy-model/parametric/` is modified; that code is read and used as a library.

---

## Files

### Display and flight

| file | scale | what |
|---|---|---|
| `print/winged-zebrafish-whole-120mm.stl` | 120 mm SL, 3.0928x life | whole animal, one piece, solid |
| `print/winged-zebrafish-glider-120mm.stl` | 120 mm SL | one-piece glider, hollowed — **sealed cavity, see above** |
| `print/kit-1to1/winged-zebrafish-ff-fins-solid-1to1-38.8mm.stl` | **1:1** | **the one to throw** — ff-fins design, solid, with a ballast bore |
| `print/kit-1to1/winged-zebrafish-whole-1to1-38.8mm.stl` | 1:1 | the 0.35-fin design at life size, solid |
| `print/kit-1to1/FIT-TEST-COUPON__peg1.4mm__clearance-0.05-to-0.16.stl` | n/a | **print this first** |

### The kits

| folder | scale | parts | what |
|---|---|---|---|
| `print/kit-1to1/starter/` | **1:1** | **10** | the life-size starter kit — chunky parts that snap together |
| `print/kit-120mm/` | 120 mm SL | **56** | **the containment-hierarchy kit** — systems, organs, tissues |

**The 1:1 starter kit is not the hierarchy kit.** At life size a zebrafish kidney is a
thread about 0.4 mm across and a fin ray is finer than a hair — both below what SLA
holds. Rather than inflate them 10–80x and call it anatomy, the starter merges the small
viscera into one block and the fine skeleton into chunky carriers. **Its containment
hierarchy is flattened**: there are no organ-system trays, every part pegs straight into
the body case, and one block spans six organ systems. That is a real loss, recorded per
part in `manifest.json`. The 120 mm kit is the one that teaches the hierarchy.

#### 1:1 starter kit — 10 parts, all passing

| # | part | merged from | bbox mm |
|---|---|---|---|
| 01 | body case, half L | skin_L | 40.6 x 26.1 x 10.7 |
| 02 | body case, half R | skin_R | 40.6 x 5.9 x 11.3 |
| 03 | vertebral column, spine | **32 vertebrae → 1** | 31.3 x 2.0 x 7.9 |
| 04 | cranium, skull block | skull L+R **+ both eyes** → 1 | 7.9 x 5.0 x 4.9 |
| 05 / 06 | pectoral fin plate L / R | membrane **+ 12 rays → 1** | 19.2 x 21.7 x 5.7 |
| 07 | viscera, organ block | **10 organs across 6 systems → 1** | 20.8 x 2.9 x 5.1 |
| 08 / 09 | myotome muscle L / R | — (tissue level) | 29.1 x 2.7 x 9.5 |
| 10 | caudal fin plate | membrane + rays → 1 | 6.2 x 1.4 x 15.1 |

Deliberately abandoned at 1:1, and why: **the separate girdle bones** (scapula 0.57 mm,
coracoid 1.23 mm), **individual vertebrae** (~1.6 mm long), **fin rays**, **rib struts**,
**the eyes as sense-organ pieces** (2.2 mm), and **the small viscera** (spleen 1.3 mm,
heart 2.1 mm, head kidney 1.6 mm, kidney a 0.4 mm thread). All sit under the 0.50 mm
printable wall or the 2.50 mm handleable minimum.

#### 120 mm containment-hierarchy kit — 56 parts, 44 passing

4 body-case pieces, **13 organ-system carriers**, 35 organ pieces, 4 tissue pieces. Each
organ pegs into its system carrier; each carrier legs into the body case; organs sit on
bosses of the height their anatomical position demands. **12 parts fail their checks and
are listed in `manifest.json` rather than dropped** — see "Parts that fail" below.

### Print the coupon first

The coupon is one STL holding seven separate solids: a 48 x 12 x 2.6 mm bar with five
**blind** D-sockets at five radial clearances — 0.05, 0.08, 0.10, 0.12, 0.16 mm — each
labelled with raised digits and a raised index triangle showing which way the D-flat
faces, plus six identical D-pegs (1.4 mm dia x 1.5 mm long) on 5.2 mm handle discs so
they can be picked up.

Print it flat. Try a peg in each socket. **The tightest socket a peg enters by hand
without forcing, and holds without glue, is the clearance the kit should be built at.**
Report that number and the kit is rebuilt to it. The kit currently assumes 0.10 mm.

---

## Measured physical properties

All measured on the exported meshes, not estimated. Volumes are cross-checked two ways
(surface integral and an independent point-in-solid Monte Carlo) and must agree.

### 120 mm whole animal, solid

| quantity | value |
|---|---|
| solid volume | 35.751 cm3 |
| mass PLA / resin / PETG | 44.33 g / 40.04 g / 45.40 g |
| centre of mass from snout | 0.4284 x SL |
| pectoral planform, both fins | 1184.67 mm2 = 1.18467e-3 m2 |
| the same at life size | 1.2385e-4 m2 |
| tip-to-tip span | 78.95 mm |
| aspect ratio (span2/area) | 5.261 |

The planform is the projection of the two single-layer fin **membranes** onto the
horizontal span-chord plane — the source surfaces, before printable thickening. That is
the lifting area; the thickened print geometry over-reports it. (Halving a closed
surface area is not the same thing and gives a different, wrong answer.)

The 5.261 aspect ratio is close to the real flying fish's 5.37, which is a useful sanity
check — but note it mostly confirms that the fin parameter was applied as intended,
rather than validating the mesh.

### 120 mm glider

| quantity | value |
|---|---|
| material volume | 14.711 cm3 → PLA 18.24 g |
| wall | 1.5 mm, **trunk and tail only**; the whole head prints solid |
| fins | solid, 1.8 mm |
| centre of mass from snout | 0.3850 x SL |

Hollowing the *whole* body moved the centre of mass the wrong way for a glider — aft,
from 0.4284 to 0.4849 SL — because the cavity removes mass from the deep mid-body and
leaves the solid head and fins. Stopping the cavity at `head_fraction_SL` = 0.231 (x =
45.49 mm from the snout) instead puts it at **0.3850 SL**, forward of even the solid
fish, for 7.7 g more material. No ballast is needed; in fact the required ballast comes
out negative, so **the question has flipped from "too tail-heavy" to possibly too
nose-heavy, and that is still untested.**

### 1:1 ff-fins solid — the one to throw

| quantity | value |
|---|---|
| solid volume | 1.4532 cm3 (cross-checked: 1453.2 integral vs 1445.9 Monte Carlo) |
| bbox | 45.22 x 46.63 x 15.90 mm |
| pectoral planform, both fins | 4.7442e-4 m2 |
| span / aspect ratio | 46.55 mm / 4.567 |
| minimum wall | 0.50 mm |

**Ballast bore:** 2.6 mm diameter, 9 mm deep, on the midline at the height of the centre
of mass, **open at the snout** — so it is not a sealed cavity and needs no drain hole.
2.6 mm for a 2.5 mm steel part is a 0.1 mm slip fit. It removes 45.6 mm3.

One print, three states, all measured on the shipped mesh in Tough 2000:

| state | mass | CG | static margin | v_min |
|---|---|---|---|---|
| **empty, as printed** | 1.628 g | 0.4556 SL | **−7.7% MAC — unstable** | 8.39 m/s |
| **2.5 mm steel rod x 9 mm** (0.347 g) | 1.974 g | 0.3960 SL | **+10.9% — stable** | 9.24 m/s |
| M2.5 x 8 mm steel grub screw (~0.262 g) | 1.890 g | 0.4085 SL | +7.0% — stable | 9.04 m/s |

The bore is sized for the rod: a 9 mm length of 2.5 mm steel rod, a 2.5 mm drill blank,
or piano wire cut to 9 mm. Throw it empty, then drop the rod in and throw it again.
Ballast costs about 0.85 m/s in minimum speed and buys the margin.

---

## What we do and do not know about flying

**Measured on these meshes, and usable:** volume, mass, centre of mass, planform area,
span, aspect ratio.

**Estimated, first-order, and clearly labelled:** the static margin. The neutral point is
taken as the quarter-chord of the pectoral planform's mean aerodynamic chord (MAC =
12.44 mm, neutral point 0.431 SL). This is a **FIRST-ORDER, FLAT-PLATE, PECTORAL-FINS-ONLY**
estimate. It ignores the body, the median fins, the caudal fin, downwash, sweep and
dihedral. It tells you the stability question is live. It does not tell you the answer.

**Not known at all:**

- No wind-tunnel test, no CFD, no free-flight test has been run on this geometry.
- `C_Lmax = 0.78` and `(L/D)max = 4.37` are **Park & Choi's measurements on a real
  stuffed flying-fish specimen** of about 20 cm — not on this mesh. At 38.8 mm the
  Reynolds number is roughly 5x lower and the flow regime is different, so **those
  coefficients do not transfer cleanly to either scale.** Every v_min above inherits
  that assumption and is therefore indicative only.
- Nobody has checked this body's stability beyond the first-order estimate above.
- **The assembled kit will not fly.** It has joints, a clearance gap at every socket, a
  stepped surface and mass concentrated at every peg and carrier. That is exactly why
  the glider and the 1:1 solid are separate one-piece objects. Do not confuse them.

---

## Print settings assumed

**1:1 files — Formlabs SLA.** Values chosen and why:

| value | chosen | why |
|---|---|---|
| minimum wall | **0.50 mm** | Formlabs reliably holds ~0.4 mm supported; 0.5 for margin |
| minimum handleable part | **2.50 mm** longest dimension | below this a person cannot pick it up and seat it |
| peg | **1.40 mm dia x 1.50 mm**, D-keyed | the smallest pin that survives repeated assembly in Tough 2000 |
| radial clearance | **0.10 mm** (confirm with the coupon) | SLA assembly clearance is ~0.1–0.2 mm; 0.1 gives a friction fit that holds without glue |
| depth clearance | 0.15 mm | the peg must bottom on friction, not on the socket floor |
| resin | **Tough 2000** | press fits need stiffness and repeated assembly. Standard/Clear is too brittle at 1.4 mm; Durable creeps under an interference fit |

**120 mm files — FDM.** 0.4 mm nozzle, 0.2 mm layer, 3 perimeters, minimum wall 1.0 mm
(1.8 mm for glider fins). The whole animal prints without supports on one flank.

A voxel remesh is the last step on every joined part. It guarantees a closed manifold
solid and **rounds away any detail finer than the voxel** — a real loss of fidelity,
recorded per part in `manifest.json`.

---

## Joinery

One scheme throughout:

- **Blind D-profile peg into a matching D socket.** A cylindrical peg with one flat
  chord, so a part seats in **one rotation only** — it cannot go in back to front.
- **Stated radial clearance** (0.10 mm at 1:1, to be confirmed by the coupon). The
  socket's flat is offset by the same clearance as its round face, so the key does not
  bind before the shank does.
- **A visible index mark**: a raised triangle beside the peg and another beside its
  socket. Align the triangles and the part is the right way round.
- **Nothing needs glue.** The fit is friction.
- **Bilateral halves mate on the midline**: three keyed pins on the left case half, three
  matching sockets on the right, set on the sagittal rim.
- **Organs sit on bosses** of the exact height their anatomical position demands, so
  seating a part does not move it off its true place in the body.

On cantilever snap clips: at sub-centimetre scale in standard resin they break, so they
are not used for the small parts. Keyed press-fit is the right answer there. True snap
features are only feasible on the largest parts — the two body halves — where the arm
length allows the deflection.

---

## Cell tokens

The manifest has **no cell-level geometry**, and inventing cell shapes would be fiction.
Instead, for each organ where our data records a cell type, the kit carries a **cell
token**: a small labelled solid, not a pretended cell shape, that drops into a recess and
is paired with its Cell Ontology id. **A token is a marker for a recorded cell type, not
a model of a cell.**

Sources: `dashboard/public/blueprint3d/data.json` (cell types placed under each organ)
and `genotype/fin-subtree.json` (the 10 cell-in-structure nodes). That gives **75 cell
types across 12 structures**. The full registry, with every CL id, is carried in
`manifest.json` under `cell_tokens.registry`.

**At 1:1 the tokens are DROPPED.** A token must be at least the 2.5 mm handleable
minimum and must drop into a recess in a part that is itself only a few millimetres.
Neither is possible at 38.8 mm. Rather than shrink a token into something nobody can pick
up, the 1:1 kit has none and the register is carried as **data** instead. They are
viable at the larger kit scale, where an organ piece can carry a recess.

Where an organ has **no** recorded cell type there is no token, and `manifest.json` says
so per organ. That is an **absence of record, not evidence that the organ has no cell
types.** Six of the ten fin-subtree cell nodes sit in structures that do not exist in
this mesh at all (fin bud, fin cartilage, fin fold) and are listed as such.

---

## Verification

Every STL is checked in Blender with `bmesh`:

1. every edge has exactly two faces → **watertight**;
2. every edge is *contiguous* — its two faces wind in opposite directions → **no
   inverted normals anywhere**. This is the correct test and, unlike comparing a face
   normal against the direction of the centre of mass, it is right for concave shapes;
3. no loose vertices or edges;
4. signed volume > 0, so the consistent orientation points outward;
5. **volume cross-check**: the surface integral must agree with an independent
   point-in-solid Monte Carlo;
6. **minimum wall is measured**, not assumed: a ray is cast inward from each sampled
   vertex and the shortest hit on a genuinely opposing surface is taken.

Checks 5 and 6 exist because of two real bugs caught during this build, both worth
knowing about:

- **A sealed cavity passes checks 1–4.** The first ballast bore stopped short of the
  snout, making an internal void that nothing could be inserted into and that would trap
  resin in the printer. It reported watertight, zero non-manifold edges and zero
  inconsistently-wound edges. What exposed it was the volume going *up* after cutting a
  hole. Cause: Blender's "recalculate normals outside" orients each **disconnected
  shell** outward on its own, so an internal cavity gets turned inside out and then reads
  as added solid. **Never recalculate normals after a boolean that can leave a cavity.**
  The Monte Carlo volume is immune to this; the surface integral is not.
- **A naive thickness probe reads near-zero at every convex edge**, because the ray
  grazes the adjacent face a few microns away. The fix is to accept only hits on a
  genuinely opposing surface. Before the fix, parts were being inflated on readings of
  0.001 mm.
- **Then that fix was itself inverted, and the symptom was silence rather than a wrong
  number.** The far wall is hit *from inside the solid*, so its outward normal points
  **along** the inward ray, not against it: the test is `dot(hit_normal, ray) > +0.5`.
  Requiring `< -0.5` rejected every true opposing wall and kept only creases and
  near-tangent facets — about 1% of rays. Parts came back with 17 to 60 valid samples
  instead of ~6000, every measured wall was noise, and the gate reported "thickness not
  established" for almost everything. After the correction the same parts return 5000 to
  6700 samples and physically sensible numbers: a shell solidified at 0.9 mm measures a
  median of 0.899 mm. **The lesson worth keeping: a measurement that returns very few
  samples is not a conservative measurement, it is a broken one.** Sample count is now
  reported alongside every thickness, and a wall is not judged at all below 150 valid
  samples.

A third trap, found while repairing a carrier: `bmesh.ops.dissolve_degenerate` is a
*repair* operation that can make things worse. On a thin plate it collapses geometry
across the thickness, and it turned one carrier from 28 non-manifold edges into 32. It
is no longer used; removing duplicate vertices and loose geometry is enough.

Results are in `manifest.json` under each part's `checks` and `volume_cross_check`.
**Parts that fail are reported there, not dropped silently.**

### Parts that fail

**1:1 starter kit: 10 of 10 pass.**

**120 mm kit: 44 of 56 pass. The 12 that fail, and why:**

*Genuinely too thin at this scale (anatomy, not a bug):*
- `digestive__oesophagus__organ` — 5th-percentile wall **0.330 mm** against a 1.20 mm
  minimum. The oesophagus is a thin tube; inflation could not reach the limit without
  turning it into a rod.
- `digestive__liver__organ` — 1.143 mm, marginally under 1.20.
- `nervous__system__carrier` — 0.812 mm; `renal__system__carrier` — 0.449 mm. Both are
  carrier plates thinned by their own socket bores.

*Measurement could not be established (treat the wall as unverified, not as bad):*
- `digestive__system__carrier`, `gas-bladder__system__carrier`,
  `hematopoietic__system__carrier`, `reproductive__system__carrier`,
  `musculoskeletal__pectoral-muscle__muscle-L` and `-R`. These are small parts with few
  vertices; even sampling 30,000 rays returns only 62–130 valid hits, which is too few
  to judge a distribution. The gate refuses to pass them on a guess.

*Volume cross-check failed — a shell is probably wound inside out:*
- `nervous__brain__organ` (180.0 mm3 integral vs 131.7 Monte Carlo) and
  `renal__head-kidney__organ` (76.4 vs 53.8). **Do not print these two without
  inspecting them**; this is the same signature as the sealed-cavity bug above.

## Totals

| | parts | material volume | plates (200 x 200 mm) |
|---|---|---|---|
| 1:1 starter kit | 10 | 1.94 cm3 | **1** (uses ~12% of the bed) |
| 120 mm hierarchy kit | 56 | 159.8 cm3 | **3** (3 / 34 / 19 parts) |
| 120 mm whole animal | 1 | 35.75 cm3 | 1 |
| 120 mm glider | 1 | 20.91 cm3 | 1 |
| 1:1 ff-fins solid | 1 | 1.45 cm3 | shares a plate |
| fit coupon | 1 file, 7 solids | 1.63 cm3 | shares a plate |

**71 STL files shipped**, 124 MB in total. The kit STLs are large because the voxel
remesh that guarantees watertightness also tessellates heavily; decimating them breaks
manifoldness, so size was reduced at the source by using a coarser voxel with a thicker
compensating wall. If the repository needs them smaller, rebuild with a larger
`VOX`/`SHELL_WALL` pair rather than decimating the output.

## Renders

In `renders/`: `starter-plate.jpg` (the 1:1 kit on one 200 mm bed),
`starter-exploded.jpg` (assembly order, pegs and index marks visible),
`kit120-plate.jpg` (the fullest of the three 120 mm plates),
`coupon-final.jpg`, `ff-solid.jpg` (the ballast bore is visible at the snout).

---

## How to rebuild

Portable Blender 4.2.23 LTS, headless. Scratch goes to `C:\Temp\stl\`; only finished
STLs are copied into `dashboard/public/blueprint3d/print/`.

```sh
B="C:/Temp/tools/blender/blender-4.2.23-windows-x64/blender.exe"
M="dashboard/public/blueprint3d/model"
S="anatomy-model/print"

# the ff-fins design GLB (injects the design; writes nothing into parametric/)
"$B" -b --python $S/build_ff_fins.py -- \
    --design $S/design-winged-zebrafish-ff-fins.json \
    --glb C:/Temp/stl/ff/winged-zebrafish-ff-fins.glb --no-render

# 120 mm whole animal, and the glider + its balance study
"$B" -b --python $S/stage1_whole.py -- "$M/winged-zebrafish.glb" \
    "$M/winged-zebrafish-manifest.json" C:/Temp/stl/out 120
"$B" -b --python $S/glider_balance.py -- "$M/winged-zebrafish.glb" \
    "$M/winged-zebrafish-manifest.json" C:/Temp/stl/out 120

# the fit coupon
"$B" -b --python $S/coupon.py -- "$M/winged-zebrafish.glb" \
    "$M/winged-zebrafish-manifest.json" C:/Temp/stl/kit1to1

# the 1:1 solid with its ballast bore
"$B" -b --python $S/ff_solid_ballast.py -- \
    C:/Temp/stl/ff/winged-zebrafish-ff-fins.glb \
    C:/Temp/stl/ff/winged-zebrafish-ff-fins-manifest.json C:/Temp/stl/ff

# the 1:1 kit (last argument is the clearance the coupon told you to use)
"$B" -b --python $S/build_kit1to1.py -- \
    C:/Temp/stl/ff/winged-zebrafish-ff-fins.glb \
    C:/Temp/stl/ff/winged-zebrafish-ff-fins-manifest.json C:/Temp/stl/kitff 0.10

# merge every build record into manifest.json
python $S/assemble_manifest.py .
```

`kitlib.py` holds the shared geometry and verification helpers; `plan.py` derives the
part plan and the cell registry from the project's own data.

---

## Assembly order

1. Print and check the **fit coupon**. Settle the clearance before printing anything else.
2. Lay out the **left case half**. It is the tray everything seats into.
3. Seat each **organ-system carrier** into the left case half by its leg.
4. Seat each **organ** into its system carrier — match the index triangles.
5. Seat each **tissue** piece.
6. (Larger scales only) drop the **cell tokens** into their register recesses.
7. Close the **right case half** onto the three midline pins.

The right half is a removable lid; the model is meant to be displayed open.
