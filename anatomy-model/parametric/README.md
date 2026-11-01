# anatomy-model/parametric — one builder, parameter sets, designs, development

Every fish mesh in the project now comes out of **one** builder driven by a **parameter set**. A
design that nobody has ever seen — the hypothetical truly flying fish (TFF) — gets a real mesh from
its numbers, on the same footing as the flying fish and the zebrafish. Development is carried as
glTF morph targets inside a single file per organism, so a viewer can play growth as an animation.

> ## The caveat that goes everywhere a weight appears
> **This is MORPHOLOGICAL interpolation, not genetic hybridisation.** Averaging two species' body
> parameters says nothing about whether such an animal could be bred, is viable, or is
> developmentally reachable; genomes do not average. **Flying fish and zebrafish are not crossable.**
> A weighted blend is never a "hybrid" without that sentence next to it.
>
> That sentence is for a **blend of two species**. Since generator 2.0.0 each manifest's
> `MORPHOLOGICAL_NOT_GENETIC` is written for its own kind (`params.caveat_for`): a single-parent design
> says it is one parent plus named deltas, not a genetic modification; a growth series says it is one
> species, that blending stage targets is vertex interpolation and not a developmental mechanism, and
> which of its stage numbers are measured and which assumed. Versions and history: `CHANGELOG.md`.

## The generative model

```
parameters = SUM over reference organisms ( weight_i x parent_i.parameter ) + delta
```

weights summing to 1, `delta` the explicit novel part. Reference organisms are the ones with real
parameter sets: `flying-fish`, `zebrafish-adult`, `zebrafish-larva`. Everything else is a design.

For **every** parameter the output manifest records which parents contributed at which weights, each
parent's own value and evidence kind, the blended value, whether a delta moved it, the delta's reason
and evidence, and the final kind. A parameter that is *entirely* delta — no ancestor, no evidence —
is flagged `NO_ANCESTOR_NO_EVIDENCE`, because that is exactly where a claim needs the most scrutiny.

## Files

```
params.py          parameter schema, the 3 reference organisms, the 4 designs, the chimera resolver
design-schema.json machine-readable schema (generated: params.py --dump)
organisms/*.json   the reference parameter sets                      (generated)
designs/*.json     the design records                                (generated)
resolved/*.json    every organism and design resolved, with full per-parameter provenance (generated)
stages.mjs         turns development/trajectory.mjs + development/zebrafish/trajectory.mjs into
stages.json          per-stage parameter overrides                   (generated)
build.py           the Blender builder: parameter set -> GLB + manifest (+ morph targets)
diff_refactor.py   proves the refactor reproduces the committed flying fish
refactor-diff.json the result                                        (generated)
verify.py          structural check of every emitted GLB
CHANGELOG.md       versions (GENERATOR/MANIFEST/SCHEMA_VERSION in params.py) and history
INTEGRATION.md     for the viewer agent: file names, target names, how to drive it
```

Rebuild everything:

```
python -I anatomy-model/parametric/params.py --dump
node       anatomy-model/parametric/stages.mjs
blender.exe -b --factory-startup --python anatomy-model/parametric/build.py -- \
    --organism flying-fish --glb dashboard/public/blueprint3d/model/flying-fish-dev.glb \
    --manifest dashboard/public/blueprint3d/model/flying-fish-dev-manifest.json
python -I anatomy-model/parametric/verify.py
```

## The parameters

25 of them. Lengths are normalised (`*_over_SL`, `*_over_SL2`) so blends are dimensionless; only
`standard_length_m` and `body_mass_kg` carry physical size. Counts blend then round. See
`design-schema.json` for the full table with units, what each drives in the mesh, and the blend rule.

Body: `standard_length_m`, `body_mass_kg`, `body_depth_over_SL`, `body_width_over_SL`,
`body_section_exponent`, `head_fraction_SL`, `peduncle_depth_frac`, `peduncle_width_frac`.
Pectoral: `pectoral_len_over_SL`, `pectoral_span_over_SL`, `pectoral_area_over_SL2`,
`pectoral_ray_count`. Other fins: `pelvic_len_over_SL`, `pelvic_ray_count`,
`dorsal_height_over_SL`, `dorsal_ray_count`, `anal_height_over_SL`, `anal_ray_count`,
`caudal_upper_lobe_over_SL`, `caudal_lower_lobe_over_SL`, `caudal_ray_count`.
Axial: `vertebra_count`, `myomere_count`. Muscle: `flight_muscle_fraction`. Mesh: `mesh_detail`.

Never set by hand, always measured on the exported mesh: `pectoral_aspect_ratio`
(= span² / both-pectoral area = Park & Choi 2010's S²/A1; also stored as `span2_over_area_both`, with
`aspect_ratio_one_fin` = half of it and `span2_over_wing_area_fish1990` = span² / (pectoral + pelvic
area), Fish 1990's convention; definitions and evidence in `design-schema.json`
`aspect_ratio_conventions`), `lifting_area_m2`, `wing_loading_N_m2`, `caudal_lobe_asymmetry`,
`flight_muscle_volume_*`.

`flight_muscle_fraction` drives a real piece: `pectoral_muscle_L/R`, two new named meshes whose
**volume** is `fraction x body_mass / 1060 kg m⁻³`, anchored just behind the cleithrum and extended
backwards along the body wall, then clipped to what actually fits inside the skin. The cleithrum,
scapula and coracoid thicken with it (a bigger muscle needs a bigger anchor). The manifest reports
the target volume, the realised volume and the shortfall.

## Refactor faithfulness

`refactor-diff.json`, produced by rebuilding the `flying-fish` reference set at `mesh_detail 1.0`
with the solidify modifiers on and diffing against the committed
`dashboard/public/blueprint3d/model/flying-fish.glb`:

* **110 of 110 committed pieces reproduced**, same names, same `extras` (label, ontology id, layer,
  side, organ system, level), **0 vertex-count differences, 0 node-translation differences**.
* **2 pieces added**: `pectoral_muscle_L`, `pectoral_muscle_R`. They are new — the committed model had
  no pectoral girdle musculature, and `flight_muscle_fraction` has to drive something visible.
* 0 removed. Byte size 2 589 920 vs 2 592 376; the difference is the procedural scale normal-map
  texture, which the parametric builder drops (a texture, not geometry).

The morph-target builds necessarily differ from that: `mesh_detail 0.62` and no solidify, because
Blender cannot apply a modifier to a mesh that carries shape keys. The skin is therefore a
zero-thickness shell and must be rendered double-sided.

## Development

One GLB per organism, base mesh + one shape key per stage, so a viewer interpolates continuously.
Stage parameters come from the project's real trajectories (`development/trajectory.mjs`,
`development/zebrafish/trajectory.mjs`) and nothing else. Stages are built at **true relative size**
(`size_rel = SL(age)/SL(base)`, the base being the resolved parameter set the GLB's base mesh is built
from), so the animation is real growth, not shape-only morphing — a flying-fish hatchling really is
about 2% of adult length. The growth-series manifests have their own ids, `flying-fish-dev` and
`zebrafish-dev` (`parameter_set` names the set they were built from), and an `adult_mass` block: the
flying fish's base set is one Park & Choi 2010 specimen (SL 0.203 m, 0.060 kg, the mass the physics
glide numbers use) while its 365 d target is the population length–weight fit (SL 0.206 m, 0.1316 kg).
The 2.2x gap is not a units or length-definition error; see `CHANGELOG.md` 2.0.0.

Pieces that have not formed are **shrunk to a point**, not deleted (topology must match across morph
targets). What is shrunk, and why, is per stage in `stages.json` and in the manifest's
`morph_targets[i].shrunk_pieces` / `.basis`.

Measured vs assumed, per organism:

**Flying fish** — *measured*: SL(age) and mass(SL) fits (Oxenford 1994 via FishBase; the
length-weight row), the pectoral fin-length ratio over 1.68–24 cm SL (Daane 2021 Data S1A, n = 49),
pelvic fins about equal to the pectorals in H. affinis larvae (Hunte 1995), mature gonad in adults.
*Assumed*: hatch length 0.4 cm and the whole 0–14 d segment, fin span and area carried from the adult
by the fin-length ratio (span linear, area ^1.834 Davenport), absence of pectoral rays below 1.68 cm
SL (a zebrafish proxy), the vertebral fade-in, and **body depth held at the adult value at every age**
— no flying-fish body-depth ontogeny was found, which is the largest honest gap in the flying-fish
animation. *Hypothetical*: nothing.

**Zebrafish** — *measured*: SL(age) and mass (Parichy 2009, Beaudouin 2015), body depth and head
fraction at each larval size (Parichy 2009 Table 3 regressions), ZFS stage, and the presence/absence
of every fin from the Parichy Table 4 standardised-standard-length milestones, and the absence of
pectoral lepidotrichia below 6.4 mm SL (Lalonde & Akimenko 2018). *Assumed*: pectoral fin length at
every size — **no fetched source measures pectoral length / SL in a wild-type zebrafish at any age**
(`genotype/compare-2x2.json` panel A) — plus body width and the fin-ray counts beyond the literature
ranges. *Hypothetical*: nothing.

**TFF** — *everything is hypothetical.* See below.

## The TFF

`dashboard/public/blueprint3d/model/tff.glb`. **Its body plan is the flying fish's, with the spec's
wing area, span and flight-muscle fraction applied.** It is a design, not a described animal: no such
animal has been observed, dissected or measured, `manifest.hypothetical` is true and **every one of
the 112 pieces** carries `hypothetical: true` and a note saying so.

It resolves as `1.0 x flying-fish` plus four deltas: pectoral span ×2.545674, lifting area ×3.865857,
the pelvic and caudal lobes by √(area multiplier), and `flight_muscle_fraction` set to 0.16. Wing
loading and aspect ratio then **fall out** rather than being set twice. The built mesh hits the spec:
wing loading 12.000 N m⁻², lifting area 0.049050 m², span 0.66441 m, span²/lifting-area 9.000.

Four things the build found, all in `derived_from_the_mesh.tff_spec_cross_check.MISMATCHES_FOUND`:

1. **Two different aspect ratios wear the same name.** `physics/flier/design.py` keeps "the fish's own
   aspect ratio" at 9.0–10.7 from Park & Choi, where AR = span² / A1 with A1 the area of **both**
   pectoral fins (0.261²/0.006377 = 10.68). It then applies 9.0 to the **total lifting** area to get the
   span. On the real fish's own numbers span²/total-lifting-area is 5.37, not 10.7. The TFF's AR 9.0
   must be read as span²/total-lifting-area; on Park & Choi's both-pectoral convention it is 17.9, 1.7×
   the measured specimen. *(Corrected in 2.0.0: this used to say "more slender than any measured flying
   fish", against Fish 1990's 3.0–16.9. Fish 1990 divides by pectoral + pelvic area plus the body between
   them, which puts the TFF at ≤ 13.9, inside that range.)*
2. **The round multipliers do not reproduce the spec.** ×3.9 area and ×2.5 span give wing loading
   11.90 N m⁻² and AR 8.60, not 12.0 and 9.0. The exact ratios 3.865857 and 2.545674 do.
3. **Two incompatible readings, and no mesh satisfies both.** (A) built here: spread the area
   multiplier over all lifting surfaces → wing loading exactly 12.0, pectoral-only AR 17.9. (B) put
   all the extra area in the pectorals → pectoral AR exactly 9.0, matching Park & Choi's convention,
   but total lifting area 0.05536 m² and wing loading 10.63. The spec names 12 N m⁻² as the design
   decision, so (A) ships.
4. **The flight muscle does not fit.** 0.16 of 0.060 kg is 9.06 × 10⁻⁶ m³ of muscle at 1060 kg m⁻³.
   Only **29.5 %** of that volume fits inside a flying fish's body at the pectoral girdle in this
   geometry; the rest is clipped, and the manifest says so. That is a geometric consequence of the
   spec, not a modelling choice.

### TFF development — the stated assumption

There is **no developmental data for the TFF at all**, and none was invented. The stages are the
flying fish's measured growth with the TFF's deltas ramped in on the schedule of the flying fish's own
measured pectoral-fin ontogeny:

```
delta strength(age) = (finRatio(age) - finRatio(hatch)) / (finRatio(adult) - finRatio(hatch))
```

so at hatching the TFF **is** a real flying-fish hatchling and the invention becomes visible as it
grows. The label, verbatim, in `stages.json`, in `tff-manifest.json` (`morph_targets[i].basis.
THE_STATED_ASSUMPTION`) and here:

> **growth curve borrowed from the flying fish; the TFF has no developmental data**

Two alternatives were considered and rejected: showing only the adult hides the question; applying
the adult deltas at every age would put a 3.3 × SL wingspan on a 4 mm hatchling, a shape no
developmental process produces. The construction used keeps the youngest stage identical to measured
flying-fish larval morphology, so the **only** invented quantity is the ramp. Nothing about the ramp
is measured, and nothing here claims a TFF could develop, hatch or survive.

## The other designs

* **`winged-zebrafish`** — `1.0 x zebrafish-adult` + a delta moving `pectoral_len_over_SL` to 0.35.
  **This one has a real experimental counterpart**: the germline `lat4a nr21/+ ; kcnh2a lof/+` double
  heterozygote, `genotype/compare-2x2.json` panel B. Its paired-fin measurements exist **only in
  figure panels** (Fig. 4B pectoral fin length); no numeric value appears in the paper's text, legends
  or Data S1, and nothing is digitised here. So 0.35 is **not** that experiment's number — it is a
  chosen point between the zebrafish placeholder (itself not a zebrafish datum) and the flying-fish
  median, near the flying-halfbeak range. The real fish is described as having overgrown paired fins,
  wild-type-sized medial fins and a hypocercal caudal.
* **`wingless-flying-fish`** — `1.0 x flying-fish` + `pectoral_len_over_SL` set to 0.140. The **value**
  is measured, in halfbeaks (group median, n = 22, `genotype/cache/daane2021_fin_ratios.json`). Putting
  it on a flying fish's body is the hypothesis: `compare-2x2.json` says such an animal "would be
  expected to sit near the halfbeak end, but that is an inference from relatives, not a measurement of
  a flying fish."
* **`ff-zf-chimera`** — `0.5 x flying-fish + 0.5 x zebrafish-adult`, no deltas. It exists only to show
  the two-parent mechanism works. It is a shape halfway between two parameter sets and nothing else —
  see the caveat at the top of this file.

## Lean

Each design's manifest carries `lean_recheck.parameters`: exactly the parameters a delta moved. A
design inherits whatever constraints its parents satisfy, but **every delta needs re-checking**, so
that list is what `lean/eliminate/browser-check.mjs` should be run on. This directory does not run the
check; it only emits the list.

| design | parameters that moved |
|---|---|
| `tff` | `caudal_lower_lobe_over_SL`, `caudal_upper_lobe_over_SL`, `flight_muscle_fraction`, `pectoral_area_over_SL2`, `pectoral_span_over_SL`, `pelvic_len_over_SL` |
| `winged-zebrafish` | `pectoral_area_over_SL2`, `pectoral_len_over_SL`, `pectoral_span_over_SL` |
| `wingless-flying-fish` | `pectoral_area_over_SL2`, `pectoral_len_over_SL`, `pectoral_span_over_SL` |
| `ff-zf-chimera` | none (pure blend; it inherits both parents' constraints and adds nothing) |

## The weakest numbers in this directory

Stated plainly so nobody has to find them:

1. **`flight_muscle_fraction` for the flying fish = 0.040 is a placeholder.** No measured
   pectoral-muscle mass fraction exists for any flying fish in the fetched sources. It is the baseline
   the TFF's 0.16 is compared against, so the comparison inherits that weakness.
2. **`pectoral_len_over_SL` for the zebrafish = 0.155 is a placeholder.** No fetched source measures
   it in a wild-type zebrafish. Every zebrafish fin number downstream of it is therefore assumed.
3. **The committed flying-fish mesh does not match the Park & Choi specimen it is compared with.**
   `derived_from_the_mesh.parameter_vs_mesh_check` on `flying-fish-dev.glb`: mesh pectoral span
   0.241 m vs parameter 0.261 m, and mesh membrane area 0.01334 m² vs parameter 0.006377 m² — the mesh
   fins are about twice as broad, aspect ratio 4.36 vs 10.7. The reference geometry was left faithful
   to the committed model on purpose (that is what the refactor diff proves), so the discrepancy is
   reported rather than fitted away. Surface-vs-projected area accounts for a few per cent, not a
   factor of two.
4. **Body depth is held constant with age for the flying fish.** No flying-fish body-depth measurement at
   any size exists in the repository (searched 2026-10-31). Every stage now carries
   `body_depth_over_SL` explicitly at the adult value with `parameter_kinds.body_depth_over_SL:
   "assumed (held at the adult value)"`; the adult value is itself assumed (schematic).
5. **The parametric zebrafish is not the detailed zebrafish.** `zebrafish-dev.glb` is the shared
   generic-teleost parametric body plan driven by zebrafish measurements, at 100 pieces. The
   189-piece `zebrafish-adult.glb` from `anatomy-model/zebrafish/build_adult.py` remains the
   anatomical reference and is untouched.

## Renders

`C:\Temp\fish-models\parametric-renders\` — 71 PNGs. Per organism: `01_adult_lateral`,
`02_adult_3q`, `03_adult_inside` (skin removed), `05_pectoral_girdle` (the close-up where
`flight_muscle_fraction` is visible), `06_adult_frame`, one `04_<target>` per morph target
(auto-framed, shape only) and one `07_to_scale_<stage>` per stage (adult frame, so relative size is
visible). Every GLB passes `verify.py`: it parses, node names match the manifest, every node carries
the six `extras`, morph targets are present and identically named on every mesh, no internal piece
pokes outside the skin at any stage, and every file is under the 8 MB budget.
