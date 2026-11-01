# CREATURES-HOOK.md — how `scene3d.js` calls `creatures.js`

`creatures.js` is a self-contained ES module in this directory. It takes `THREE` from the host and
imports nothing except `../../../blueprint3d/partedit.js` (for `metresPerUnit`, which is also
dependency-free), so the same file runs in the browser next to `scene3d.js` and in node
(`node creatures-test.mjs`, 158 checks).

**Nothing in this document asks you to edit `index.html`, `env3d.js` or `sim-engine/`.** The only
file you change is `scene3d.js`, and the module was written so that change is small.

---

## The thing to get right before anything else

The module does **two different kinds of thing**, and they must not be presented as one:

| | what it is | where it may appear |
|---|---|---|
| **A. `makeEnsemble` / `perturbRun`** | **PHYSICS.** The modelled fish driven stochastically: every random input drawn from a stated distribution with a source and a `kind`. This is a result. | The plot, the statistics table, a figure, a nanopub |
| **B. `mountCreatures` / `makeSchool` / `makeAmbient`** | **DECORATION.** A school, a predator and two distant gliders with invented motion. | The 3D scene only, always labelled "decorative" |

Use `LEGEND` (or `legendHtml()`) for the on-screen wording; do not paraphrase it. Every B object
carries `userData.decorative === true` and a `userData.note`, so the label survives into the scene
graph. `SCOPE_NOTES` holds four things the ensemble cannot tell you; print them next to the band.

**No birds.** Aves is the frozen holdout. There are no seabirds in this scene, no bird silhouettes
and no aerial predator — only flying fish in the air and a fish predator below the surface. The
reason is written into the file header; please leave it there, and do not add one.

---

## B. The scene hook — three lines in `scene3d.js`

```js
import { mountCreatures, seedFromUrl } from './creatures.js';

// after `scene` exists, once:
const creatures = mountCreatures({
  THREE, scene,
  rng:        seedFromUrl(),      // the URL's ?cseed=, or 'delphi-v1'
  conditions: { headwind_m_s: 0, gust_m_s: 2 },   // optional; see Section A
});

// in the render loop, before renderer.render():
creatures.update(dt, tSeconds);

// on teardown:
creatures.dispose();
```

That is the whole required change. Everything below is optional.

### The returned object

| member | type | what it does |
|---|---|---|
| `school` | object | the flocking school; **settable** (see `useGeometry`) |
| `ambient` | object | predator + distant gliders |
| `update(dt, t)` | fn | one frame. `dt` in seconds (clamped internally to 50 ms), `t` the scene clock in seconds. Allocates nothing. |
| `setPredator(bool)` | fn | show the predator and make the school flee |
| `getPredatorState(target?, preySL_m?)` | fn | see below |
| `useGeometry(geometry, manifest, extra?)` | fn | rebuild the school around a mesh you loaded later |
| `dispose()` | fn | removes everything from the scene and frees it |
| `legend` | object | `LEGEND` |
| `info` | object | species, instance count, metres-per-unit and its source, seed, the decorative note |

### Options (all optional)

| option | default | note |
|---|---|---|
| `schoolSpecies` | `'zebrafish'` | key into `SPECIES_SCALE` |
| `schoolCount` | `24` | hard-capped at 256; one `InstancedMesh`, one draw call |
| `schoolSizeMultiplier` | `6` | decorative: a 3.9 cm zebrafish is invisible at scene scale. Pass `1` for true size. |
| `schoolBounds` | `{x:[-14,14], y:[-5.5,-0.7], z:[-10,10]}` | metres. `y` is height; the school never crosses `y = 0`. |
| `gliders` | `2` | distant gliding flying fish, capped at 8 |
| `preySL_m` | `0.203` | the modelled fish's standard length, for the looming geometry |
| `school` / `ambient` | — | objects merged into the `makeSchool` / `makeAmbient` options |

### Making the predator trigger the modelled fish's escape

```js
creatures.setPredator(true);
// each frame, or when you need it:
const st = creatures.getPredatorState({ x: fishX, y: fishY, z: fishZ }, 0.203);
if (st.triggers_escape) startEscape();        // your escape, from the solver
```

`getPredatorState()` returns `{active, visible, position, distance_m, visual_angle_deg,
threshold_deg, response_distance_m, triggers_escape, source, path_is_decorative}`.

The **predator's path is decorative** (`path_is_decorative: true`) — a slow circuit that closes on
the origin while active. The **trigger criterion is not**: it is the looming threshold from
`sim-engine/scenarios/predator.mjs` — visual angle 14° (McKee & McHenry 2020,
doi:10.1093/iob/obaa023; their best fits were 10.3–15.8° in adult zebrafish and 14° is the value in
their own model sweep) and a predator body width of 0.69 prey body lengths. For a 0.203 m flying
fish that gives a response distance of **0.570 m**. Use `triggers_escape`, not a distance you pick.

### Reusing a real GLB mesh for the school

The school is an `InstancedMesh`, so a real mesh costs one draw call. Hand in a geometry you have
already loaded and the GLB's manifest:

```js
const gltf = await new GLTFLoader().loadAsync('../../../blueprint3d/model/flying-fish-dev.glb');
const mf   = await (await fetch('../../../blueprint3d/model/flying-fish-dev-manifest.json')).json();
let geo = null;
gltf.scene.traverse(o => { if (o.isMesh && /^skin/.test(o.name) && !geo) geo = o.geometry; });
creatures.useGeometry(geo, mf, { species: 'flying-fish', count: 18, sizeMultiplier: 1 });
```

Three things the module handles so you do not have to:

1. **Scale.** The metres-per-unit comes from `partedit.js metresPerUnit(manifest)`, and `info.school
   .scale_source` records which manifest field it came from. `flying-fish-dev` and `tff` give
   0.247561 m/unit; `zebrafish-dev` and `winged-zebrafish` give 0.047317. The **plain** manifests
   (`manifest.json`, `manifest-adult.json`, `manifest-larva.json`) have **no**
   `parameters.standard_length_m`, so `metresPerUnit` returns `m_per_unit: null` rather than
   guessing — use a `-dev` manifest, or pass `SL_m` explicitly.
2. **Morph targets.** The `-dev` GLBs are **growth series**: every mesh carries morph targets. An
   `InstancedMesh` has no `morphTargetInfluences`, and three r160 then reads `.length` of
   `undefined` inside `WebGLMorphtargets` on the first render and **the whole frame loop dies**.
   That happened here the first time; `makeSchool` now clones the geometry without the morph
   attributes. If you ever instance a `-dev` geometry yourself, do the same.
3. **The swap.** `useGeometry` puts the new school in the scene before disposing the old one, so no
   frame renders a disposed mesh. Replacing `creatures.school = …` directly does the same thing.

Axes match the manifests: **head at +X, back at +Y, the fish's left at −Z, glTF Y-up.** If your own
mesh is oriented differently, pre-rotate the geometry before handing it in.

### If you have no GLB (or do not want to pay for one)

Leave `geometry` out and `impostorGeometry(THREE)` is used: a 10-triangle fusiform fish, 1 unit
snout-to-tail, same axes. The harness defaults to impostors.

---

## A. The ensemble hook — for whoever draws the plot

This half does not touch the scene. It can live in `index.html`'s own script, in `scene3d.js`, or
anywhere else; it only needs the parameter object.

```js
import { makeEnsemble, seedFromUrl, seedToUrl, LEGEND, SCOPE_NOTES } from './creatures.js';

const E = makeEnsemble({
  draws:      300,
  seed:       seedFromUrl(),        // ?cseed=… ; THE SAME SEED GIVES THE SAME ENSEMBLE
  baseParams: fish,                 // params.json fish entry, or index.html's live `fish` object
  conditions: { headwind_m_s: 0, gust_m_s: 2 },
  // run: myOwnSolver,              // optional; see below
});
history.replaceState(null, '', seedToUrl(location.href, E.seed));   // keep the seed in the URL
```

`baseParams` may be flat numbers **or** the repository's `{value, kind, source}` shape (so
`index.html`'s live `fish` object works unchanged, and so do `params.json` entries). Perturbed
fields come back in the same shape with `kind: 'assumed'` and a `source` that names the
distribution, plus `replaced` holding the provenance the draw overwrote — a drawn value can never
be mistaken for the measured one it replaced. `perturbRun` never mutates `baseParams`.

### What comes back

```
{ seed, draws,
  runs:          [{ i, draw, skipped, params, result, analytic }, …]
  deterministic: the UNPERTURBED single run (so the plot can show where the old one line sits)
  stats:         { glide_range_m, time_aloft_s, max_height_m, launch_airspeed_m_s, v_min_m_s,
                   wing_loading_N_m2, analytic_lean_bound_m, analytic_total_m,
                   can_glide_fraction }          each = {n, median, p5, p95, min, max, mean}
  distributions: one row per quantity: label, unit, shape, band, band_kind, shape_kind, source
  species_gate:  whether the 15-20 m/s taxi band applied, and why
  note:          UNCERTAINTY_NOTE      scope: SCOPE_NOTES      sea: the assumed sea state
  solver:        which solver was used }
```

`result.pts` is `[{x, z}, …]` in metres (`x` = ground distance, `z` = height above mean sea level),
subsampled at 50 ms — the same shape `scene3d.js`'s band renderer already reads, so its own
`hostRun` solver and the default one are interchangeable. Pass `keepTrajectories: false` when you
only want statistics.

### Drawing it

Draw the **band**, not a line. Every draw thin and faint, the 5–95% band of the range, the median,
and the deterministic run dashed so the viewer can see it is one sample of many. `creatures-test
.html` has a 60-line canvas version you can copy; it also marks the two measured references (the
8 m maximum recorded flight height and the 50 m quoted glide, both second-hand from
`physics/glide-data.csv`).

Print `UNCERTAINTY_NOTE` under the plot and `SCOPE_NOTES` beside it. **A spread computed from
assumed distributions is an uncertainty illustration, not a measured distribution of real glides**,
and the four scope notes are findings, not boilerplate: the max-height band runs above the highest
flight ever recorded, and the ensemble does **not** reproduce the 50 m field glide.

### Supplying your own solver

The default solver, `glideTrajectory`, is the simulator's **own** glide-phase dynamics — the same
`derive` / `CL` / `CD` / `fge` / RK4 as `index.html`, power off, integrated to the water at a
constant angle of attack. It does not model the breach or the taxi. If you want the full
breach + taxi + glide run per draw, pass:

```js
run: (params) => { /* your sim */ return { range_m, time_s, max_height_m, can_glide, pts }; }
```

`analyticBound(params)` additionally reproduces `glide.mjs`'s published two-phase bound
(`lean_bound_m` = h·(L/D)max, the only part the Lean theorem covers, plus the kinetic phase), and
every run carries it, so the plot can show the bound next to the integrated trajectory. The
integrated range comes out **below** the bound (about three quarters of it) because a fixed-alpha
glide re-enters the water still travelling fast and never cashes in the residual kinetic energy.

### The species gate

The 15–20 m/s launch band applies **only** to flying fish and the flying-fish-derived designed
fliers, matching `glide.mjs`'s own regex. For any other animal the launch speed is **not drawn at
all** — the draw records `skipped: true` and the reason, because no measured launch-speed spread
exists for it and this module invents none. A winged-zebrafish ensemble therefore never glides, at
any seed, and `stats.can_glide_fraction` is 0.

---

## Performance

Measured headless in Edge with `--use-gl=swiftshader --enable-unsafe-swiftshader`, 28 instanced
fish + predator + 2 gliders + a water plane: **60 fps at 1280×900 and at 390×844**, and **0 bytes
per `update()`** over 1200 updates (`performance.memory`).

How: one `InstancedMesh` for the school; boid state in flat `Float32Array`s with all vector maths on
scalar locals; exactly one `Matrix4` / `Quaternion` / `Vector3` reused for every instance of every
frame; the distant gliders replay a path computed once at mount instead of integrating per frame;
`update()` allocates nothing and clamps `dt` to 50 ms so a long frame cannot explode the flock.
The flocking is O(n²), which is why `count` is capped at 256 — at 24 it is about 600 distance
checks a frame. Add your scene content and re-measure before raising the count.

---

## Tests

| file | what it covers |
|---|---|
| `creatures-test.mjs` | node, 158 checks: the distribution catalogue and its provenance, the PRNG and fork independence, `summarise`, `analyticBound` against `physics/results.json` (v_min 9.854 m/s, W/S 46.39 N/m², P_req 1.327 W), the integrator's monotonicity and wind sign, `perturbRun`'s relabelling and species gate, seeded reproducibility, the band covering the deterministic run, the zebrafish never gliding at four seeds, the URL seed round-trip, and a host-supplied solver. `CREATURES_TEST_SABOTAGE=1` inverts every assertion and all 158 fail, so none is vacuous. |
| `creatures-test.html` | browser, 28 checks: the interface, the single draw call, every object flagged decorative, **no bird anywhere in the scene graph**, bounded flocking that never crosses the surface, seeded reproducibility of the school, that running the school cannot shift a published ensemble, the sourced looming threshold and response distance, fleeing measured against a control school, instance-buffer reuse, per-frame allocation, the band covering the deterministic run, the GLB reuse path with its scale and stripped morph targets, and the frame rate. |

Open `creatures-test.html?glb=0` to skip the 3.9 MB GLB fetch. `document.body.dataset.failed` is
`"0"` when everything passes, which is what the headless runner reads.
