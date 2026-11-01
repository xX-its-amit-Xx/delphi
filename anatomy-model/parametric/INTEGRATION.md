# INTEGRATION — parametric models, morph targets, Design Studio

For the viewer agent. Short and exact. Nothing here asks you to change how pieces are picked,
coloured or labelled: the node names, `extras` and manifest schema are unchanged from
`anatomy-model/manifest.json`.

## 1. Files

All in `dashboard/public/blueprint3d/model/`. Each `X.glb` has a sibling `X-manifest.json`.

| GLB | bytes | pieces | morph targets | what it is |
|---|---|---|---|---|
| `flying-fish-dev.glb` | 3 885 304 | 112 | 7 | flying fish with enlarged pectoral fins, 6 growth stages |
| `zebrafish-dev.glb` | 3 630 444 | 100 | 7 | zebrafish, 6 growth stages |
| `tff.glb` | 4 259 740 | 112 | 8 | **HYPOTHETICAL** TFF v2, 6 growth stages + 1 parent |
| `winged-zebrafish.glb` | 1 547 152 | 100 | 2 | design: zebrafish + fin-proportion delta |
| `wingless-flying-fish.glb` | 1 651 808 | 112 | 2 | design: flying fish + halfbeak fin proportion |
| `ff-zf-chimera.glb` | 2 077 112 | 106 | 3 | design: 0.5 flying fish / 0.5 zebrafish blend |

The existing `flying-fish.glb`, `zebrafish-adult.glb`, `zebrafish-larva.glb` and their manifests are
untouched. The `-dev` files are *lower-resolution* (mesh_detail 0.62) and have a zero-thickness skin
shell, because Blender cannot apply a solidify modifier to a mesh that carries shape keys. Render the
skin double-sided (`side: THREE.DoubleSide`) or it will disappear when the camera goes inside.

## 2. Morph targets

Every mesh in a file carries the **same** target list in the **same order**, named in
`meshes[i].extras.targetNames` and listed in the manifest's `morph_targets` array.

Three kinds, distinguished by `morph_targets[i].kind`:

* `resolved` — always index 0, always named `base_<file id>` (the manifest's `id`, which since generator
  2.0.0 is the GLB's own basename: `base_flying-fish-dev`, `base_zebrafish-dev`, `base_tff`, ...; the
  parameter set it was built from is the manifest's `parameter_set`). This is the adult / resolved design.
* `stage` — a growth stage, with `age_days`, `stage`, `SL_m`, `mass_kg`, `size_rel`.
* `parent` — one reference organism of a design, named `parent_<organism-id>`, with `size_rel`.

**Invariant: the weights you set must sum to 1.** The basis mesh is never shown on its own.

Blender writes **delta-encoded** targets (`POSITION` holds `target - base`), which three.js'
`GLTFLoader` handles for you via `geometry.morphTargetsRelative === true`. With relative targets the
render is `base + SUM(w_i * delta_i)`, so weights summing to 1 give exactly `SUM(w_i * target_i)` —
the rule above is the right one either way. Consequence: `base_<id>` is an all-zero delta, so
setting it to 1 and everything else to 0 is the same as setting every weight to 0. It is in the list
so that the "weights sum to 1" rule never has an exception, and so the adult/design always has a
name to address. Targets carry **positions only** — no morph normals or tangents, to keep the files
small — so recompute vertex normals after a weight change if your shading looks flat at the
extremes.

### Stage names and ages

`flying-fish-dev.glb` and `tff.glb` (same ages; the TFF's curve is borrowed, see §5):

| target | age (days after hatching) | stage | SL (m) | size_rel |
|---|---|---|---|---|
| `stage_000d` | 0 | hatching | 0.00400 | 0.0197 |
| `stage_003d` | 3 | larva | 0.00706 | 0.0348 |
| `stage_010d` | 10 | larva | 0.01421 | 0.0700 |
| `stage_030d` | 30 | juvenile | 0.04356 | 0.2146 |
| `stage_090d` | 90 | juvenile | 0.11274 | 0.5554 |
| `stage_365d` | 365 | adult | 0.20615 | 1.0155 |

`zebrafish-dev.glb`:

| target | age (days post-hatching) | stage | SL (m) | size_rel |
|---|---|---|---|---|
| `stage_000d` | 0 | hatching (2 dpf) | 0.00310 | 0.0799 |
| `stage_003d` | 3 | larva (5 dpf) | 0.00420 | 0.1082 |
| `stage_010d` | 10 | larva (12 dpf) | 0.00644 | 0.1660 |
| `stage_025d` | 25 | juvenile (27 dpf) | 0.01128 | 0.2907 |
| `stage_060d` | 60 | juvenile (62 dpf) | 0.02199 | 0.5667 |
| `stage_180d` | 180 | adult (182 dpf) | 0.03883 | 1.0008 |

Parent targets: `tff.glb` → `parent_flying-fish`; `winged-zebrafish.glb` → `parent_zebrafish-adult`;
`wingless-flying-fish.glb` → `parent_flying-fish`; `ff-zf-chimera.glb` → `parent_flying-fish`,
`parent_zebrafish-adult`.

### Driving an age (continuous development)

```js
// ages: the age_days of the stage targets, ascending. idx: their index in morphTargetInfluences.
function weightsForAge(age, ages) {
  const w = new Array(ages.length).fill(0);
  if (age <= ages[0])  { w[0] = 1; return w; }
  if (age >= ages.at(-1)) { w[w.length - 1] = 1; return w; }
  let i = 0; while (ages[i + 1] < age) i++;
  const f = (age - ages[i]) / (ages[i + 1] - ages[i]);   // LINEAR IN AGE, see the caveat below
  w[i] = 1 - f; w[i + 1] = f; return w;
}
// apply to every mesh; index 0 (base_*) stays 0 while any stage weight is non-zero.
for (const mesh of meshes) {
  const inf = mesh.morphTargetInfluences;
  inf.fill(0);
  const w = weightsForAge(age, AGES);
  AGES.forEach((_, k) => { inf[STAGE_INDEX[k]] = w[k]; });
}
```

Caveat to surface in the UI: **interpolating between two stage targets is linear in whatever you
interpolate on, and growth is not linear.** The stage ages are spaced 0, 3, 10, 30, 90, 365 d precisely
so that linear-in-age interpolation is a tolerable approximation of the real curve. If you want it
exact, interpolate on `size_rel` instead: look up the true `SL(age)` with `development/trajectory.mjs`
`at(age).SL_m`, divide by the BASE `SL_m` (the `resolved` target's `SL_m`), and find `f` between the two
bracketing `size_rel` values. Since 2.0.0 `size_rel` = SL(stage) / SL(base), so the flying fish's 365 d
target is 1.0155 (SL 0.20615 m against the base's 0.203 m) and every target shares the base's metres
per model unit.
Do that and the slider is honest at every intermediate frame, not just at the six keyframes.

### Driving a parent blend

```js
// ff-zf-chimera.glb: slide between the two parents, with or without the design's deltas.
inf.fill(0);
inf[IDX.parent_flying_fish]   = 1 - t;   // t = 0 -> pure flying fish
inf[IDX.parent_zebrafish_adult] = t;     // t = 1 -> pure zebrafish
// or show the resolved design (blend + deltas) instead:
inf.fill(0); inf[IDX.base_ff_zf_chimera] = 1;
```

For a one-parent design (`tff`, `winged-zebrafish`, `wingless-flying-fish`) the pair
`(parent_X, base_Y)` is a *delta slider*: weight 1 on `parent_X` shows the parent organism, weight 1
on `base_Y` shows the parent with the design's deltas applied, and anything between shows a partial
delta. Label that slider with the delta, not with a species name.

**Whenever a weight appears in the UI, the file's `MORPHOLOGICAL_NOT_GENETIC` sentence must appear with
it.** Read it from the manifest rather than retyping it: since 2.0.0 it is written per kind and is only
true of its own file. A two-parent blend carries the chimera sentence (*morphological interpolation, not
genetic hybridisation ... Flying fish and zebrafish are not crossable*); a single-parent design says it
is one parent plus named deltas, not a genetic modification; a growth series (`growth_series: true`)
says it is one species, that the blend between stages is vertex interpolation and not a developmental
mechanism, and which of its stage numbers are measured and which assumed.

### Pieces that have not formed yet

A piece that does not exist at a stage is **shrunk to a point about its own centroid**, not removed —
topology has to be identical across morph targets. `morph_targets[i].shrunk_pieces` names the groups
and their scale factors; `manifest.objects[].driven_by_parameters` says which parameter moves a piece.
If you want a crisper disappearance, hide a node when its scale drops below ~0.1; do not treat a
shrunk piece as present.

### Growth is anchored at the snout

The snout stays at model x = +0.50 and the fish grows backwards and outwards from it. If you prefer a
centred animation, translate the whole model by `-(1 - size_rel) * 0.5 * SL_units` along +X, where
`SL_units = 0.82`. `size_rel` is in the manifest per target.

## 3. Parameter schema

`anatomy-model/parametric/design-schema.json` is the machine-readable copy. Summary:

* 25 parameters, each `{value, kind, source}` with `kind` ∈ measured / secondary / derived / assumed /
  hypothetical. Lengths are normalised (`*_over_SL`, `*_over_SL2`) so they blend dimensionlessly; only
  `standard_length_m` and `body_mass_kg` carry physical size.
* Counts (`*_ray_count`, `vertebra_count`, `myomere_count`) blend as a weighted mean then round; the
  unrounded value is kept in the provenance.
* A design is `parameters = SUM over parents (weight_i * parent_i.parameter) + delta`, weights summing
  to 1. A delta is `{value|scale|add, reason, evidence}`.
* The manifest's `provenance_per_parameter` gives, **for every parameter**: `ancestry` (which parents
  at which weights), each parent's own value and kind, `blended_value`, the `delta` applied with its
  reason and evidence, and the final `kind`. A parameter that is entirely delta with
  `evidence: "none"` is flagged `NO_ANCESTOR_NO_EVIDENCE: true` — show that flag.
* `derived_from_the_mesh` holds quantities measured on the exported geometry and must never be edited
  by hand: `pectoral_span_m`, `pectoral_area_both_m2`, `pectoral_aspect_ratio`, `lifting_area_m2`,
  `wing_loading_N_m2`, `caudal_lobe_asymmetry`, `flight_muscle_volume_*`, and since 2.0.0 the aspect
  ratio under every named convention: `span2_over_area_both` (= `pectoral_aspect_ratio` = Park & Choi's
  S²/A1, A1 = BOTH pectoral fins), `aspect_ratio_one_fin` (= half of it) and
  `span2_over_wing_area_fish1990` (span² / pectoral + pelvic area: Fish 1990's convention, upper bound).
  Compare a fish with Park & Choi's 9.0–10.7 on the first, with Fish 1990's 3.0–16.9 on the last.
* `adult_mass` (growth series and the TFF): when the adult stage's mass differs from the base set's, both
  are shown with their sources and roles. Flying fish: base 0.060 kg (one Park & Choi specimen, the mass
  the physics glide numbers use) vs 0.1316 kg at the 365 d target (population length–weight fit).
* `manifest_version` / `generator_version`: bump history in `anatomy-model/parametric/CHANGELOG.md`.
* `moved_parameters` / `lean_recheck.parameters` is the list a design's deltas touched — the exact set
  `lean/eliminate/browser-check.mjs` should be re-run on. A design inherits whatever constraints its
  parents satisfy; every delta needs re-checking.

## 4. Driving a continuous parameter edit from the Design Studio

A parameter edit is not a morph target. There are two routes:

**(a) Preview, in the browser, no rebuild.** Only these parameters have a safe, purely geometric
preview, because they scale pieces without changing topology:

| parameter | preview transform |
|---|---|
| `standard_length_m` | uniform scale of the whole model by `new/old`, snout fixed at x = +0.5 |
| `pectoral_len_over_SL` | scale `pectoral_fin_{L,R}` and `pectoral_fin_ray_{L,R}_*` about the fin root (the manifest `centre_gltf` of `cleithrum_{L,R}` is a good enough root) |
| `pelvic_len_over_SL`, `dorsal_height_over_SL`, `anal_height_over_SL` | scale that fin about its own `centre_gltf` |
| `caudal_upper_lobe_over_SL`, `caudal_lower_lobe_over_SL` | scale `caudal_fin` in +Y / −Y about its root |
| `flight_muscle_fraction` | scale `pectoral_muscle_{L,R}` by `(new/old)^(1/3)`, and `cleithrum/scapula/coracoid` by the girdle factor `min(1 + 1.6*(f − 0.04)/0.12, 2.6)` |

Preview only. Mark it as such: the real builder re-solves the span/area fit, re-fits the muscle to
what actually fits inside the skin, and re-runs the inside check. A preview can show a muscle bulging
through the skin; a built model cannot.

**(b) Commit.** Write a design JSON in the `design-schema.json` shape and run

```
node   anatomy-model/parametric/stages.mjs                     # only if stages changed
blender -b --factory-startup --python anatomy-model/parametric/build.py -- \
        --organism <design-id> --glb <out>.glb --manifest <out>-manifest.json \
        [--parents] [--stages auto|none] [--no-render]
python -I anatomy-model/parametric/verify.py
```

`<design-id>` must exist in `anatomy-model/parametric/params.py` `DESIGNS` (or `REFERENCES`). Adding a
design is adding one dict there, then `python -I anatomy-model/parametric/params.py --dump`.

**Parameters that change topology** — `pectoral_ray_count`, `pelvic_ray_count`, `dorsal_ray_count`,
`anal_ray_count`, `caudal_ray_count`, `vertebra_count`, `myomere_count`, `mesh_detail` — cannot be
previewed and cannot be morphed. They change the piece list, so they require route (b). Grey them out
in a live slider and offer "rebuild" instead.

## 5. What the viewer must say out loud

* `tff.glb`: `manifest.hypothetical === true` and **every** piece has `hypothetical: true` plus a
  `hypothetical_note`. Its body plan is the flying fish's with the spec's wing area, span and
  flight-muscle fraction applied; it is a design, not anatomy. Say that, not "fin-to-wing".
* `tff.glb` growth: show `morph_targets[i].basis.THE_STATED_ASSUMPTION` next to the age slider —
  *"growth curve borrowed from the flying fish; the TFF has no developmental data"*. It is also at
  `design_record` level and in `stages.json` under `tff.assumption`.
* `derived_from_the_mesh.tff_spec_cross_check.MISMATCHES_FOUND` is a 4-item list of real
  inconsistencies found while building the TFF (two aspect-ratio definitions, a rounding gap, two
  incompatible readings of the spec, and a flight muscle that does not fit inside the body). Surface
  it; it is the most informative thing in the file.
* `derived_from_the_mesh.parameter_vs_mesh_check` says whether the mesh actually meets its span and
  area parameters. For the reference organisms it does **not**, deliberately, and the ratio is given.
