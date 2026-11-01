# anatomy-model/parametric — CHANGELOG

Everything here can be changed, provided the change is versioned. Version numbers live in `params.py`:
`GENERATOR_VERSION` (anything build.py emits), `MANIFEST_VERSION` (manifest fields and what they mean),
`SCHEMA_VERSION` (`design-schema.json`). Each one is written into every manifest and into the schema.
Never hand-edit a generated manifest. Change the generator and rebuild (README "Rebuild everything").

## 2.0.0 — 2026-10-31 (manifest_version 2, schema version 2)

The viewer agent and the hub found these defects. All of them are fixed in the generator, and all six
GLBs and manifests were rebuilt. `verify.py` passes, and its new content checks fail on the 1.x manifests.

**Versioning.** Manifests now carry `manifest_version`, `generator_version` and `changelog`. Before this
release they carried no version, so read anything without one as 1.x.

**MORPHOLOGICAL_NOT_GENETIC is now written for each kind of file** (`params.caveat_for`). Before, every
manifest carried the two-species chimera sentence, including the single-species growth series, which
have `parents: []`. Now:
- a growth series (`flying-fish-dev`, `zebrafish-dev`) says it is one species and not a cross. It says
  that blending stage targets is vertex interpolation, not a developmental mechanism. It also says which
  stage numbers are measured (SL and mass fits, the Daane fin ratio, the zebrafish depth, head and
  fin-milestone data) and which are assumed (ramps, transfers, shapes held at the adult values).
- a single-parent design (`tff`, `winged-zebrafish`, `wingless-flying-fish`) says it is one parent plus
  named deltas and not a genetic modification. The TFF also says its stages are borrowed, not data.
- the two-parent blend (`ff-zf-chimera`) keeps the chimera sentence.

**The growth series have their own ids.** The `id` is now the GLB's basename (`--id`, which defaults to
the basename). The new field `parameter_set` names the set the file was built from. The model label says
"growth series 0–N d after hatching". The base target follows the id:
- `base_flying-fish` became `base_flying-fish-dev`
- `base_zebrafish-adult` became `base_zebrafish-dev`

Nothing in `dashboard/public/blueprint3d/*.js`, `explode.html`, `perturb.html`, `sim-engine/` or
`t/physics/sim/` reads the manifest `id` or a `base_*` target name: the viewer selects targets with
`kind === 'stage'`. `parent_<organism>` names are unchanged.

**size_rel is now SL(stage) / SL(base resolved set)**, read from `resolved/<id>.json`. Before, it was
SL(stage) / SL(adult stage). That drew the flying fish's 365 d target (labelled SL 206.2 mm) at the
base's 203 mm, and gave the target a different metres-per-unit from the base mesh. The 365 d target is
now `size_rel` 1.0155 (zebrafish 180 d: 1.0008). The zebrafish's assumed fin and muscle ramps still use
SL / SL(180 d), so their values are unchanged.

**The flying-fish adult mass: two sources, both kept, each for its own purpose.** The new manifest block
is `adult_mass`; the data are in `params.ADULT_MASS`.

| | SL (m) | mass (kg) | source | used for |
|---|---|---|---|---|
| base set (`base_flying-fish-dev`) | 0.203 | 0.060 | Park & Choi 2010 Table 1, model L3: ONE *Cypselurus hiraii*, weighed fresh before stuffing, mass given to 0.01 kg | base mesh scale, flight-muscle volume, wing loading; the mass `physics/analysis.py` uses for v_min = 9.85 m/s. W, the areas and C_L,max all come from that one fish, and its tunnel lift at 0° matched its weight (Fig. 4) |
| `stage_365d` | 0.20615 | 0.1316 | `development/trajectory.mjs`: von Bertalanffy SL, then W = 0.0116 FL^3.01 with FL = SL/0.927 (*Hirundichthys affinis*, Barbados, FishBase; `physics/length-weight.csv`) | the stage targets only. It is a typical adult on the population curve, so the series is smooth |

The 2.2× gap is **not** a units or definitions issue. I checked it against the sources:
- Both lengths are standard length. FL > SL, so the SL/FL 0.927 conversion lowers the predicted mass; it
  cannot raise it.
- Both masses are fresh wet mass in kg.
- The species differ, but every fitted exocoetid length–weight relation in `physics/length-weight.csv`
  gives 111–166 g at SL 0.203 m: *Cheilopogon atrisignis* n=570 130 g, *C. unicolor* n=1640 115 g,
  *Cypselurus poecilopterus* n=2769 166 g, *H. oxycephalus* n=682 111 g, *H. affinis* 126 g.
- Fish 1990 (J Zool 221:391), Table I, *Cypselurus*, n=113, ethanol-preserved: SL = 0.460 M^0.355, which
  gives 0.100 kg at SL 0.203 m.

So the L3 specimen really is light for its length. Its condition factor 100·W/SL(cm)³ is 0.72; the
population fits give about 1.5. The paper does not give a cause.

What a heavier mass would do to the physics. This is reported only; `physics/` was not changed. On
A1+A2+A3 = 0.012688 m²:
- with 0.1316 kg, wing loading goes from 46.4 to 101.7 N/m² and v_min from 9.85 to 14.6 m/s;
- with Fish 1990's 0.100 kg, v_min is 12.7 m/s.

The pre-registered verdict B ("inside") holds for any mass up to 0.247 kg. The prose "10–20 m/s at or
above the 9.9 m/s minimum" is true only with the specimen mass. The TFF has the same split, at the same
size and with the same sources: spec 0.060 kg versus 0.1316 kg at its borrowed 365 d target, so its wing
loading is 12.0 at the base and about 25.5 N/m² at that target.

**The aspect ratio question is settled from the papers.** The convention is in `design-schema.json`
`aspect_ratio_conventions`:
- **Park & Choi 2010:** AR = S²/A1. S is the full tip-to-tip span. A1 is the planform area of the
  pectoral fin **pair**. Their symbol list defines the mean chord c = A1/S, and L3's c = 24 mm =
  6377/261. Also, A1 < A = A1+A2+A3 = 12688 mm². L3 comes out at 10.68.
- **Fish 1990:** AR = span²/wing area. Span = 2 × base-to-tip + body width. Wing area = pectoral +
  pelvic fins, one side traced and doubled, plus the body rectangles between each fin pair. The 3.0–16.9
  range (199 specimens, 6 genera) uses this convention. Read on Fish's terms, L3 is ≤ 8.29, which agrees
  with Fish's *Cypselurus* regression (8.0 at 0.06 kg).
- **The repo's code was already right; its prose was wrong.** `pectoral_aspect_ratio` was always span² /
  both-fins area, which is the Park & Choi convention. The schema and params text "area of ONE pectoral
  fin" was wrong and has been corrected.
- **New derived fields in every manifest:**
  - `span2_over_area_both`, equal to `pectoral_aspect_ratio`;
  - `aspect_ratio_one_fin` = (S/2)²/one-fin area, which is half of it;
  - `span2_over_wing_area_fish1990` = S²/(pectoral + pelvic). The body rectangles are not modelled, so
    this is an upper bound.
- The quantity span²/one-fin area (2× Park & Choi) matches no source, so it is not stored.
  `blueprint3d/partedit.js` computes exactly that quantity as `aspect_ratio` and labels it with the old,
  wrong definition.
- **The TFF:** 17.906 on the Park & Choi convention, which is 1.7× L3. On Fish's convention it is
  ≤ 13.902, inside 3.0–16.9. So the old sentence "more slender than any measured flying fish" was a
  comparison across conventions, and it has been withdrawn from the generator and the README.
  `physics/flier/tff/SPEC-MISMATCHES.md` item 1 still says it.

**Flying-fish body depth is labelled as assumed at every stage.** No flying-fish body-depth measurement
at any size exists in the repo (searched `development/`, `physics/`, `genotype/`, `organisms/`). Each
stage now carries `body_depth_over_SL` explicitly at the adult value 0.17, which is itself assumed. Each
stage also has a `parameter_kinds` map (measured / secondary / assumed / assumed transfer). The
`stage_365d` basis gains an `adult_mass` note.

**Open (not changed; it would move the TFF geometry):** `lifting_area_m2` on the mesh is pectoral +
pelvic + **caudal** membrane. The physics reference area 0.012688 m² is Park & Choi's A1+A2+A3, and A3 =
0.004474 m² is the **body planform**, not the caudal fin. The TFF span/area fit (`build.py`, `shares`)
labels 0.004474 as "caudal" and sizes the TFF's caudal fin to 3.866 × the specimen's body planform. The
headline numbers are unaffected: total lifting area is 0.04905 m² and wing loading is 12.0, both
exactly. But the TFF's caudal fin is sized from the wrong surface. The DERIVED text now says this.
Fixing it means measuring the body planform on the mesh and refitting the TFF.

**Files:**
- `params.py`: versions, `caveat_for`, `GROWTH_BASIS`, `ADULT_MASS`, `ASPECT_RATIO_CONVENTIONS`, and
  corrected DERIVED/SCHEMA text.
- `stages.mjs`: size_rel against the base, explicit body depth, `parameter_kinds`, `_version`.
- `build.py`: `--id`, per-kind caveat, AR fields, `adult_mass`, versions, corrected TFF mismatch text,
  pelvic and caudal areas in metres.
- `verify.py`: content checks, and `PARAMETRIC_MODEL_DIR` for fixtures.
- Regenerated: `organisms/`, `designs/`, `resolved/`, `design-schema.json`, `stages.json`, all six
  GLBs and manifests.
- Renders were not regenerated (`--no-render`), so the `04_*`/`07_*` stage renders in
  `C:\Temp\fish-models\parametric-renders\` predate the 1.5% size_rel change.

## 1.x — 2026-10-31

The first parametric builder, the reference sets, four designs and the stage morph targets. There was no
version field. See README.
