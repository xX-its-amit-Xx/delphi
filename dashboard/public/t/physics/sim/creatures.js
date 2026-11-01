// creatures.js -- random motion of creatures in the flying-fish simulator scene.
//
// Dependency-free ES module. THREE is handed in by the host (scene3d.js); this file never imports it,
// so every function below also runs in node (that is how the ensemble maths is tested:
// `node creatures-test.mjs`). The only import is the dashboard's own dependency-free geometry helper,
// used for one thing: converting GLB model units to metres.
//
// ===========================================================================================
// THIS FILE DOES TWO SEPARATE THINGS. THEY ARE NOT THE SAME KIND OF THING.
//
//   SECTION A -- STOCHASTIC DRIVING OF THE MODELLED FISH.  This is PHYSICS, not decoration.
//       Real flying fish do not repeat one trajectory, so the simulator should not draw one line
//       and call it the answer. `makeEnsemble` / `perturbRun` run the solver many times with
//       every random input drawn from a STATED distribution, and return per-draw trajectories
//       plus a median and a 5-95% band. Each distribution carries its source and its kind
//       (measured / measured-secondhand / borrowed / assumed), exactly as the rest of the
//       repository labels numbers. Section A quantities enter the published result.
//
//   SECTION B -- AMBIENT CREATURES.  This is DECORATION and nothing else.
//       A small school of fish below the surface, an optional predator, and a couple of distant
//       gliders. Their motion is invented to make the scene look alive. NOTHING in Section B is
//       evidence, enters a metric, or may be cited. Every ambient object carries
//       `object.userData.decorative = true` and the UI legend must label it "decorative".
//
//   The two must stay visibly apart in the code, in the UI legend and in any report. `LEGEND`
//   below is the exact wording for the UI.
// ===========================================================================================
//
// NO AVES (BIRDS) ANYWHERE IN THIS FILE, AND NONE MAY BE ADDED.
//   Aves is the DELPHI frozen holdout (re-frozen 2026-10-31, roster unchanged). Putting a seabird
//   in the sky -- even a decorative one, even an impostor sprite -- puts holdout taxon imagery into
//   a published figure of a non-holdout result, and bird flight data have been kept out of every
//   physics module in this repository on purpose (`glide.mjs`: "No bird data anywhere";
//   `predator.mjs`: the same). There are no gulls, terns, frigatebirds, boobies or petrels in this
//   scene, no bird silhouettes, no bird-shaped impostors, and no aerial predator. The only aerial
//   creatures are flying fish. The only predator is a fish, below the surface. Do not add one later.
//
// Exports
//   -- Section A (physics) --------------------------------------------------------------------
//   DISTRIBUTIONS                      the catalogue: key, shape, source, kind of the spread
//   makeRng(seed)                      seeded reproducible PRNG with .uniform/.normal/.fork
//   perturbRun(baseParams, rng, opts?) one draw: perturbed params + the record of what was drawn
//   glideTrajectory(params, opts?)     the default solver: the simulator's own glide dynamics
//   analyticBound(params)              glide.mjs's published two-phase bound, for comparison
//   makeEnsemble({draws, seed, distributions, baseParams, run?, conditions?})
//   summarise(values)                  median, 5th, 95th percentile, min, max, mean, n
//   seedFromUrl(search?) / seedToUrl(url, seed)      the seed lives in the URL state
//   UNCERTAINTY_NOTE                   the "this is an illustration, not a measured distribution"
//   -- Section B (decoration) -----------------------------------------------------------------
//   makeSchool({THREE, scene, species, count, bounds, ...})
//   makeAmbient({THREE, scene, rng, conditions, ...})
//   mountCreatures({THREE, scene, rng, conditions})  -> the single interface scene3d.js calls
//   SPECIES_SCALE / metresPerUnit                    GLB model units -> metres
//   LEGEND / legendHtml()              the A-vs-B wording for the UI
//
// See CREATURES-HOOK.md for how scene3d.js calls this.

import { metresPerUnit } from '../../../blueprint3d/partedit.js';
export { metresPerUnit };

const DEG = Math.PI / 180;
const G = 9.81;              // m/s2, as params.json constants.g (standard gravity, rounded as physics/results.json)
const RHO_AIR = 1.225;       // kg/m3, as params.json constants.rho_air (sea level; same value as physics/analysis.py)

// ===========================================================================================
// SECTION A -- STOCHASTIC DRIVING OF THE MODELLED FISH (PHYSICS)
// ===========================================================================================

// ---------------------------------------------------------------- seeded PRNG
// cyrb128 + sfc32 (public-domain small PRNGs). Chosen because they are a few lines, have no
// dependencies, and give byte-identical streams in node and in every browser: the same seed must
// give the same ensemble, and the seed is carried in the URL state (seedFromUrl / seedToUrl).
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/**
 * Seeded PRNG. `rng()` is a float in [0,1). Extras:
 *   rng.uniform(a, b)     rng.normal(mu, sd)     rng.int(n)     rng.pick(array)
 *   rng.fork(label)       an INDEPENDENT stream derived from this seed and the label.
 * Forking matters: the ensemble stream and the decorative-school stream must not share a
 * sequence, or changing the school size would silently change the published ensemble.
 */
export function makeRng(seed = 'delphi-v1') {
  const s = String(seed);
  let [a, b, c, d] = cyrb128(s);
  let spare = null;
  const rng = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) rng(); // discard: sfc32 needs a short warm-up before the stream is well mixed
  rng.seed = s;
  rng.uniform = (lo, hi) => lo + (hi - lo) * rng();
  rng.int = n => Math.floor(rng() * n) % Math.max(1, n | 0);
  rng.pick = arr => arr[rng.int(arr.length)];
  rng.normal = (mu = 0, sd = 1) => {               // Box-Muller with the second value cached
    if (spare !== null) { const v = spare; spare = null; return mu + sd * v; }
    let u = 0, v = 0, r = 0;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; r = u * u + v * v; } while (r === 0 || r >= 1);
    const f = Math.sqrt((-2 * Math.log(r)) / r);
    spare = v * f;
    return mu + sd * u * f;
  };
  rng.fork = label => makeRng(s + '|' + label);
  return rng;
}

// ---------------------------------------------------------------- reading and writing parameters
// baseParams may be either a flat numeric object {mass_kg: 0.06, ...} or the repository's
// {value, kind, source} shape (params.json, and the live `fish` object inside index.html).
// Both are read, and a perturbed field is written back in the SAME shape, with kind 'assumed'
// and a source that names the distribution it was drawn from. That is the point: a perturbed
// value must never keep the provenance of the measured value it replaced.
const pv = (p, k) => {
  const f = p && p[k];
  if (f == null) return null;
  if (typeof f === 'object') return f.value == null ? null : f.value;
  return typeof f === 'number' ? f : null;
};
/** True when this parameter object uses the repository's {value, kind, source} shape. Checked once
 *  per perturbRun so a field that is ABSENT from the base object is still written in the same shape
 *  as its siblings -- otherwise launch_height_m would come back as a bare number next to
 *  mass_kg: {value, kind, source}, and a caller reading `.value` would silently get undefined. */
const isShaped = p => Object.values(p || {}).some(v => v && typeof v === 'object' && !Array.isArray(v) && 'value' in v);
function setPv(out, k, value, source, shaped) {
  const f = out[k];
  if (f && typeof f === 'object') { out[k] = Object.assign({}, f, { value, kind: 'assumed', source, drawn_from: source, replaced: f.source || f.kind || null }); return; }
  out[k] = (shaped ?? isShaped(out)) ? { value, kind: 'assumed', source, drawn_from: source, replaced: null } : value;
}
const text = p => [p && p.species, p && p.id, p && p.label,
  p && p.species && typeof p.species === 'object' ? p.species.value : null].filter(Boolean).join(' ');

// The same regex glide.mjs uses, so this module gates the taxi band on exactly the animals that
// module gives a sourced launch speed to. 'flier'/'tff' are the repository's flying-fish-derived
// designed fliers (params.json flier-F1, tff-v2): same 60 g body, taxi assumed to work the same way.
const FF_RE = /exocoet|flying ?fish|cypselurus|hirundichthys|cheilopogon|\bflier\b|\btff\b/i;
/** Does the SPECIES match? This is not sufficient to draw the taxi band -- see launchDrawGate. */
export const isFlier = p => FF_RE.test(text(p));

/** The lower end of the sourced 15-20 m/s taxi band. */
export const TAXI_BAND_LOW_M_S = 15;

/**
 * THE STAGE GATE. May the 15-20 m/s taxi band be drawn for this animal?
 *
 * The species test alone is NOT enough, and the first version of this file got it wrong. The taxi
 * band is measured for ADULT flying fish only. glide.mjs's `organismLaunchSpeed` is explicit:
 * adults get the taxi end speed (15 m/s), and every earlier stage gets min(10 m/s, 30 BL/s x SL)
 * with the comment "no taxiing speed is measured for juveniles, so none is added". Gating on the
 * species text alone handed a flying-fish LARVA the adult taxi band, and the larva then glided.
 *
 * That is validation defect D1 coming back through the ensemble. D1 is the one the independent
 * harness caught when every organism got a default 15 m/s launch and a 0.5 mg zebrafish larva
 * "glided" 42.8 m; ENVIRONMENT.md's fix was "launch speed comes from the organism, never a global
 * default". Drawing a band the organism's own stage has no claim to is the same error wearing a
 * distribution, and a wider band makes it harder to see, not easier.
 *
 * The rule, matching sim-engine/validate/physics/ensemble.mjs so the two cannot diverge: draw the
 * band only when THE ENGINE'S OWN LAUNCH SPEED FOR THIS STATE IS ALREADY A TAXI SPEED, i.e. at or
 * above the band's lower end. An adult reaches 15-20 m/s by taxiing and qualifies; a larva at
 * 0.15 m/s or a juvenile capped at the 10 m/s leap speed does not, and gets no launch-speed draw
 * at all -- exactly as glide.mjs refuses to invent one.
 *
 * `override` (opts.allow_launch_draw) forces the answer when the caller has already asked the
 * engine. Returns {allow, species_matches, reason}.
 */
export function launchDrawGate(params, baseLaunchSpeed, override) {
  const species_matches = isFlier(params);
  const v = baseLaunchSpeed;
  if (override != null) {
    return { allow: !!override, species_matches,
      reason: override ? 'the caller states that the engine\'s own launch speed for this state is a taxi speed'
        : `the caller states that the engine's own launch speed for this state is NOT a taxi speed (scenarios/glide.mjs organismLaunchSpeed), so no launch-speed spread is drawn and none is invented` };
  }
  if (!species_matches) {
    return { allow: false, species_matches,
      reason: 'no measured launch-speed spread exists for this animal: glide.mjs gives a sourced launch speed only to flying fish (the taxi band) and zebrafish (Umax = 1.15 Ucrit, a point value with no published spread), and this module invents neither' };
  }
  if (!(v >= TAXI_BAND_LOW_M_S)) {
    return { allow: false, species_matches,
      reason: `the species matches but the STAGE does not: the 15-20 m/s taxi band is measured for ADULT flying fish only, and the engine's own launch speed for this state is ${v == null ? 'not sourced' : `${(+v).toFixed(2)} m/s`}, below the band's lower end of ${TAXI_BAND_LOW_M_S} m/s (scenarios/glide.mjs organismLaunchSpeed: adults get the taxi end speed, earlier stages get min(10 m/s, 30 BL/s x SL) and "no taxiing speed is measured for juveniles, so none is added"). No launch-speed spread is drawn and none is invented.` };
  }
  return { allow: true, species_matches, reason: 'the 15-20 m/s taxi band applies to this animal at this stage' };
}

// ---------------------------------------------------------------- the distribution catalogue
// EVERY random quantity in Section A appears here with:
//   band_kind   provenance of the SPREAD (not of the central value): measured | measured-secondhand
//               | borrowed | assumed, the repository's own kinds.
//   shape_kind  provenance of the SHAPE of the distribution. Almost always 'assumed': the sources
//               give a range or a standard deviation, never a distribution. This distinction is
//               the whole honesty of Section A, and the UI must not collapse it.
// Defaults for the sea state live in SEA_STATE below and are ASSUMED: the repository has no sea
// state anywhere, and wind.mjs says in so many words that wave-induced updrafts are not modelled.

/** Assumed sea state. Nothing in the repository measures one; these two numbers are the input
 *  the wave distributions are computed from, and both are modelling choices. */
export const SEA_STATE = {
  Hs_m: 1.0,
  wavelength_m: 30,
  kind: 'assumed',
  source: 'NO sea state exists anywhere in this repository. Hs 1.0 m and wavelength 30 m are a modelling choice (a "slight" wind sea) chosen so the wave terms are small next to the 1 m default launch height. sim-engine/scenarios/wind.mjs states explicitly: "no wave-induced updrafts (not modelled)", so these two numbers are the first time a wave surface is given any role, and they are assumed, not measured.',
};
/** sigma of the sea-surface elevation. Hs = 4 sigma is the DEFINITION of significant wave height
 *  for a narrow-band Gaussian sea (a standard relation, not a repository source); Hs itself is assumed. */
export const elevationSd = (sea = SEA_STATE) => sea.Hs_m / 4;
/** rms surface slope of a linear deep-water sinusoid of amplitude Hs/2 and the assumed wavelength,
 *  sampled at a uniformly random phase: max slope = pi Hs / lambda, rms = that / sqrt(2). */
export const slopeSdDeg = (sea = SEA_STATE) => Math.atan((Math.PI * sea.Hs_m) / sea.wavelength_m / Math.SQRT2) / DEG;

// Measured specimen-to-specimen spreads, transcribed here with the arithmetic shown.
// physics/glide-data.csv, Park & Choi 2010 Table 1, the three models with both fin pairs spread
// (L1, L2, L3). Reference area = A1 + A2 + A3 (pectoral + pelvic + body planform), the area the
// coefficients are referred to and the area the simulator uses as ref_area_m2.
export const PARK_CHOI_REF_AREAS_M2 = [0.013049, 0.013243, 0.012688]; // L1, L2, L3
export const REF_AREA_CV = (() => {
  const a = PARK_CHOI_REF_AREAS_M2, n = a.length;
  const mean = a.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  return sd / mean; // 0.02168
})();
// physics/glide-data.csv, Makiguchi 2013 Table 1: mass 227.7 +- 19.8 g over 13 Cheilopogon
// heterurus doederleini. The only proper specimen-to-specimen mass statistic in the repository:
// Park & Choi's five masses are rounded to 0.01 kg, so their quantisation is as large as their spread.
export const MASS_CV = 19.8 / 227.7; // 0.08696

export const DISTRIBUTIONS = [
  {
    key: 'launch_airspeed_m_s',
    label: 'Launch (take-off) airspeed',
    unit: 'm/s',
    shape: 'uniform',
    shape_kind: 'assumed',
    band_kind: 'measured-secondhand',
    band: [15, 20],
    applies: 'adult flying fish and the flying-fish-derived designed fliers only',
    source: 'Band 15-20 m/s, second-hand but quoted in two fetched sources: "taxiing ... can probably accelerate the flying fish to a speed up to 15 - 20 m s-1 (Davenport 1994)" (Deng, Wang, Zhang, Mao 2019, bioRxiv doi:10.1101/765560, Introduction); flying fish "glide for up to 50 m ... at an air speed of 15 to 20 m s-1" (Makiguchi et al. 2013, Aquat Biol 18:105, doi:10.3354/ab00494, Introduction, citing Edgerton & Breder 1941 and Davenport 1990); see sim-engine/scenarios/glide.mjs TAXI_END_M_S / TAXI_MAX_M_S and physics/glide-data.csv. The BAND is measured-secondhand. The UNIFORM SHAPE inside the band is ASSUMED: neither source gives a distribution, only the two endpoints. Note the simulator\'s own deterministic take-off target, params.json takeoff_speed_target_m_s = 17.5 (kind assumed), is the midpoint of this band, so the band is centred on the deterministic run by construction; glide.mjs instead takes 15, the band\'s lower end, so glide.mjs\'s single number is this ensemble\'s lower edge, not its median.',
    draw(rng, base, ctx) {
      // THE STAGE GATE, not just the species. See launchDrawGate: a flying-fish LARVA must get no
      // launch-speed draw at all, because the taxi band is measured for adults only.
      const g = launchDrawGate(ctx.params, base, ctx.allowLaunchDraw);
      ctx.gate = g;
      if (!g.allow) return { skipped: true, reason: g.reason, value: base };
      return { value: rng.uniform(this.band[0], this.band[1]) };
    },
  },
  {
    key: 'launch_path_angle_deg',
    label: 'Flight-path angle at take-off (before the wave slope is added)',
    unit: 'deg',
    shape: 'normal',
    shape_kind: 'assumed',
    band_kind: 'borrowed',
    sd: 3.3,
    source: 'sd 3.3 deg is MEASURED: Makiguchi et al. 2013 Table 3, pitch at leap 20.0 +- 3.3 deg (10 leaps, 13 fish, captive; doi:10.3354/ab00494, transcribed in physics/glide-data.csv). Using it as the spread of the FLIGHT-PATH angle is BORROWED, and params.json says why it is not the same quantity: "the measured 20 deg (Makiguchi 2013) is the body pitch at the moment of leaping, not the path". The MEAN is the simulator\'s own approach_angle_deg / glide_alpha_deg geometry, not drawn here. The normal shape is assumed; the source gives a mean and an sd, not a distribution.',
    draw(rng, base, ctx) { return { value: rng.normal(base, this.sd) }; },
  },
  {
    key: 'surface_elevation_m',
    label: 'Wave-induced launch height (sea-surface elevation at take-off)',
    unit: 'm',
    shape: 'normal',
    shape_kind: 'assumed',
    band_kind: 'assumed',
    spread_text: sea => `sd = Hs/4 = ${elevationSd(sea).toFixed(2)} m`,
    source: 'Added to the launch height. sigma = Hs/4, which is the DEFINITION of significant wave height for a narrow-band Gaussian sea (a standard relation, not a repository source). Hs itself is ASSUMED (SEA_STATE: 1.0 m); the repository contains no sea state and wind.mjs states "no wave-induced updrafts (not modelled)". The only measured height anchor nearby is the 8 m maximum recorded flight HEIGHT (Deng et al. 2019 Introduction, second-hand, physics/glide-data.csv), which bounds height aloft, not launch height. The repository\'s own launch height, glide.mjs LAUNCH_HEIGHT_PARAM = 1 m, is itself labelled assumed.',
    draw(rng, base, ctx) { return { value: rng.normal(0, elevationSd(ctx.sea)) }; },
  },
  {
    key: 'surface_slope_deg',
    label: 'Sea-surface slope at take-off (added to the path angle)',
    unit: 'deg',
    shape: 'normal',
    shape_kind: 'assumed',
    band_kind: 'assumed',
    spread_text: sea => `sd ${slopeSdDeg(sea).toFixed(2)} deg from the assumed sea state`,
    source: 'Linear deep-water sinusoid of amplitude Hs/2 and wavelength lambda sampled at a uniformly random phase: maximum slope atan(pi Hs / lambda), rms that over sqrt(2). The GEOMETRY is standard; both inputs (SEA_STATE Hs 1.0 m, lambda 30 m) are ASSUMED, so this whole quantity is assumed. The fish leaves a sloping, moving water surface; wind.mjs does not model this at all.',
    draw(rng, base, ctx) { return { value: rng.normal(0, slopeSdDeg(ctx.sea)) }; },
  },
  {
    key: 'wind_along_path_m_s',
    label: 'Wind component along the flight path (positive = headwind)',
    unit: 'm/s',
    shape: 'normal',
    shape_kind: 'assumed',
    band_kind: 'assumed',
    gust_amplitude_m_s: 2,
    spread_text: () => 'sd = half the assumed gust amplitude = 1 m/s',
    source: 'Mean = conditions.headwind_m_s if the host supplies one, otherwise 0 (no headwind is added silently). sd = half the gust amplitude. BOTH numbers come from sim-engine/scenarios/wind.mjs, where headwind_m_s (default 5) and gust_m_s (default +-2) are labelled kind "assumed", source "design input"; wind.mjs also notes the gusts are treated quasi-steady with no unsteady aerodynamics and no shear. So this is assumed on assumed. Its only measured neighbour is Hertel\'s calculated 10 m/s headwind case (physics/glide-data.csv, row_kind "theory"), which is a model result, not an observed wind.',
    draw(rng, base, ctx) {
      const mean = ctx.conditions && ctx.conditions.headwind_m_s != null ? +ctx.conditions.headwind_m_s : 0;
      const gust = ctx.conditions && ctx.conditions.gust_m_s != null ? +ctx.conditions.gust_m_s : this.gust_amplitude_m_s;
      return { value: rng.normal(mean, gust / 2) };
    },
  },
  {
    key: 'mass_kg',
    label: 'Body mass (specimen-to-specimen)',
    unit: 'kg',
    shape: 'lognormal-cv',
    shape_kind: 'assumed',
    band_kind: 'borrowed',
    cv: MASS_CV,
    source: `CV ${(MASS_CV * 100).toFixed(2)}% = 19.8 / 227.7 g, MEASURED: Makiguchi et al. 2013 Table 1, body mass 227.7 +- 19.8 g over 13 Cheilopogon heterurus doederleini (doi:10.3354/ab00494, transcribed in physics/glide-data.csv). Applying that CV to the simulator's Cypselurus hiraii base mass is BORROWED (a different genus, and captive fish). Park & Choi's own five specimen masses (0.06, 0.05, 0.06, 0.04, 0.04 kg) are rounded to 0.01 kg, so their quantisation is as large as their spread and they cannot give a usable CV. Lognormal shape is assumed; a mass must stay positive, which is the only reason that shape was chosen over a normal.`,
    draw(rng, base, ctx) { return { value: base * Math.exp(rng.normal(0, Math.log(1 + this.cv ** 2) ** 0.5)) }; },
  },
  {
    key: 'ref_area_m2',
    label: 'Aerodynamic reference (total lifting) area (specimen-to-specimen)',
    unit: 'm2',
    shape: 'lognormal-cv',
    shape_kind: 'assumed',
    band_kind: 'measured',
    cv: REF_AREA_CV,
    source: `CV ${(REF_AREA_CV * 100).toFixed(2)}%, MEASURED on three specimens: Park & Choi 2010 Table 1 models L1, L2 and L3, reference area A1+A2+A3 (pectoral + pelvic + body planform) = ${PARK_CHOI_REF_AREAS_M2.join(', ')} m2 (doi:10.1242/jeb.046052, transcribed in physics/glide-data.csv). Models M and N are excluded because their fins were folded (A2 recorded as 0). n = 3 stuffed museum specimens of ONE species: a real measured spread, but a very small sample. span_m is scaled by the square root of the area factor so the aspect ratio, and therefore the ground-effect ratio h/(span/2), stays self-consistent. Lognormal shape assumed (area must stay positive).`,
    draw(rng, base, ctx) { return { value: base * Math.exp(rng.normal(0, Math.log(1 + this.cv ** 2) ** 0.5)) }; },
  },
  {
    key: 'glide_alpha_deg',
    label: 'Angle of attack held in the glide',
    unit: 'deg',
    shape: 'normal',
    shape_kind: 'assumed',
    band_kind: 'assumed',
    sd: 2,
    source: 'Fully ASSUMED. params.json: "the fish\'s chosen angle of attack in the glide is not measured; the literature cited by Park and Choi says only that glides are nearly parallel to the surface". sd 2 deg is a deliberately NARROW choice representing "the fish does not hold one exact angle"; it is NOT the simulator\'s slider range for this parameter (-5 to 30 deg), which would dominate every other input. Set `distributions` without this entry to switch it off.',
    draw(rng, base, ctx) { return { value: rng.normal(base, this.sd) }; },
  },
];

export const UNCERTAINTY_NOTE =
  'A spread computed from assumed distributions is an UNCERTAINTY ILLUSTRATION, not a measured distribution of real glides. ' +
  'No one has published a distribution of flying-fish glide ranges, and this ensemble is not one. What each input contributes: ' +
  'MEASURED spread -- the reference (lifting) area, from three Park & Choi 2010 specimens (n = 3, stuffed, one species). ' +
  'MEASURED-SECONDHAND band -- the 15-20 m/s launch airspeed, quoted from Davenport 1994 in two fetched sources; the band is theirs, the uniform shape inside it is ours. ' +
  'BORROWED -- the body-mass CV (measured on 13 Cheilopogon heterurus doederleini, applied to a Cypselurus hiraii base mass) and the take-off path-angle sd (measured as a body-pitch sd, used as a path-angle sd, which params.json says is a different quantity). ' +
  'ASSUMED -- the entire sea state (the repository has none, and wind.mjs says wave effects are not modelled), so both wave terms; the gust sd, which is half of wind.mjs\'s own assumed design input; and the glide angle-of-attack spread. ' +
  'Two further limits: mass and fin area are drawn INDEPENDENTLY because no source in the repository gives their correlation, and real fish correlate them, so the wing-loading spread here is WIDER than a real population\'s; and the shape of every distribution is assumed, so the 5th and 95th percentiles are much softer than the median.';

// ---------------------------------------------------------------- what the field numbers measure
/**
 * The quoted field figures, and WHICH QUANTITY EACH ONE IS. This block exists because the
 * simulator models ONE HOP -- one launch, one glide, one re-entry -- while flying fish string
 * several hops together, taxiing between them. Comparing a single-hop model against a sequence
 * total would make the model look wrong when the comparison was simply mismatched, so the sources
 * were checked, in the copies already fetched under physics/prior-art/raw/.
 *
 * They draw the distinction themselves, and they put 50 m on the SINGLE-HOP side:
 *
 *   Deng, Wang, Zhang, Mao (2019) Bioinspir. Biomim. 14:046009, Introduction, verbatim:
 *     "During the free flight (airspeed 15-20 m s-1), with a reachable flight distance of 50 m
 *      and a peak height up to 8 m, the tail fin is held high and still. In the final stage of
 *      free flight, the tail is lowered, re-enters the water, resumes beating and therefore
 *      provides the impetus for A FURTHER FREE FLIGHT. A total flight distance of 400 m can be
 *      achieved in 30 s by the REPEATED TAXIING before the fish submerges eventually into the water."
 *   -> 50 m and 8 m are ONE free flight. 400 m in 30 s is the WHOLE SEQUENCE. Explicit.
 *
 *   Park & Choi (2010) J Exp Biol 213:3269, Introduction, verbatim:
 *     "The flying fish glides over a total distance of as much as 400 m in 30 s by A SUCCESSIVE
 *      SEQUENCE of taxiing and flight" ... "they use this taxiing to gain additional speed for
 *      successive gliding flights" ... "when ... the gliding speed decreases at the END OF ONE
 *      GLIDE, some flying fish dip the lower lobe of the caudal fin and beat the tail".
 *   -> agrees: 400 m is the sequence, and a glide ends before the next taxi begins.
 *
 *   Davenport (1994) review summary, point 5, verbatim:
 *     "...leap through the water surface at a shallow angle, accelerate to take-off speed by
 *      taxiing ... and enter a free flight THAT MAY BE PROLONGED BY FURTHER TAXIING."
 *   -> the hop structure, from the review itself. It gives no distance in the copy fetched here.
 *
 *   Makiguchi et al. (2013) Aquat Biol 18:105, Introduction, verbatim:
 *     "flying fish leap from the water surface at a speed of about 10 m s-1 and GLIDE FOR UP TO
 *      50 m ... at an air speed of 15 to 20 m s-1" (citing Edgerton & Breder 1941, Davenport 1990).
 *   -> consistent with one glide, though it does not say so in as many words.
 *
 * So the single-hop ensemble was already comparing like with like against the 50 m. What WAS
 * wrong is the statistic: "up to 50 m" and "reachable" are an UPPER ENVELOPE of observed glides,
 * not a typical glide, so the thing to compare it against is the ensemble's upper tail, not its
 * median or even its 95th percentile. See SCOPE_NOTES.
 *
 * None of these four is a primary observation. All of them restate Edgerton & Breder 1941,
 * Davenport 1990 and Hertel 1966, none of which has been fetched, and none of which is quoted
 * with a sample size or a distribution.
 */
export const FIELD_OBSERVATIONS = {
  single_hop_range_m: { value: 50, measures: 'ONE free flight (one hop)', kind: 'measured-secondhand', source: 'Deng et al. 2019 Bioinspir. Biomim. 14:046009 Introduction, "a reachable flight distance of 50 m" during "the free flight", distinguished in the same paragraph from the 400 m sequence total; Makiguchi et al. 2013 doi:10.3354/ab00494 Introduction "glide for up to 50 m", citing Edgerton & Breder 1941 and Davenport 1990 (neither fetched)', statistic: 'an upper envelope ("up to", "reachable"), NOT a mean or a typical glide, and quoted with no sample size' },
  single_hop_peak_height_m: { value: 8, measures: 'peak height within ONE free flight', kind: 'measured-secondhand', source: 'Deng et al. 2019 Introduction, "a peak height up to 8 m", in the same sentence as the 50 m single free flight (its ref. 6; not fetched)', statistic: 'a maximum recorded height, not a typical one' },
  sequence_total_range_m: { value: 400, measures: 'the WHOLE SEQUENCE of hops, taxi included', kind: 'measured-secondhand', source: 'Park & Choi 2010 doi:10.1242/jeb.046052 Introduction, "a total distance of as much as 400 m in 30 s by a successive sequence of taxiing and flight" (citing Hertel 1966, Rayner 1986, Vogel 1994); Deng et al. 2019 Introduction, "A total flight distance of 400 m can be achieved in 30 s by the repeated taxiing"', statistic: 'a maximum ("as much as"), over an unstated number of hops' },
  sequence_total_time_s: { value: 30, measures: 'the duration of that whole sequence', kind: 'measured-secondhand', source: 'as sequence_total_range_m' },
  taxi_length_m: { value: 9, measures: 'the taxi run BETWEEN two hops', kind: 'measured-secondhand', source: 'Deng et al. 2019 Introduction, "an average taxiing length of 9 m for cypselurid flying fish" (its ref. 11; not fetched). The only taxi-length figure in the repository, and it is an average with no spread.' },
  leap_speed_m_s: { value: 10, measures: 'speed leaving the water, before the taxi', kind: 'measured-secondhand', source: 'Makiguchi et al. 2013 Discussion citing Davenport 1994: "approached and leaped from the water surface at approximately 10 m s-1"' },
};

/**
 * Multi-hop BOOKKEEPING, so the 400 m / 30 s sequence figure can be compared like with like.
 *
 * This is arithmetic on the single-hop ensemble, NOT a new model and NOT a hop-count prediction.
 * Nothing in the repository gives a distribution of hop counts, and the taxi is not modelled at
 * all: glide.mjs says the taxi distance is not added to the range and the taxi power (burst,
 * anaerobic; Deng's CFD figure of 350 W to reach 16.5 m/s is a model result) is never checked
 * against the animal's muscle. So this function does not predict how many hops a fish makes. It
 * answers one question only: how many hops OF THE SIZE THIS ENSEMBLE PRODUCES would be needed to
 * cover the quoted sequence, and how long they would take.
 *
 * The one assumption, stated: each hop is taken to start at the same drawn take-off airspeed,
 * which is what the sources describe -- the fish taxis back up to 15-20 m/s for the next hop
 * (Park & Choi: taxiing "to gain additional speed for successive gliding flights"). The taxi time
 * is 9 m divided by the mean of the 10 m/s leap speed and the hop's take-off speed, i.e. a
 * constant acceleration along the taxi run: that linearity is ASSUMED and is the weakest step here.
 */
export function sequenceStats(perHopRange_m, perHopTime_s, takeoffSpeed_m_s, obs = FIELD_OBSERVATIONS) {
  const n = Math.min(perHopRange_m.length, perHopTime_s.length);
  const hops = [], cycleT = [], d30 = [], seqT = [];
  for (let i = 0; i < n; i++) {
    const r = perHopRange_m[i], t = perHopTime_s[i];
    const v = takeoffSpeed_m_s[i] ?? obs.leap_speed_m_s.value;
    if (!(r > 0) || !(t > 0)) continue;
    const taxiT = obs.taxi_length_m.value / Math.max(1e-6, (obs.leap_speed_m_s.value + v) / 2);
    const cycleD = r + obs.taxi_length_m.value, cycleTime = t + taxiT;
    hops.push(obs.sequence_total_range_m.value / cycleD);
    cycleT.push(cycleTime);
    seqT.push((obs.sequence_total_range_m.value / cycleD) * cycleTime);
    d30.push((obs.sequence_total_time_s.value / cycleTime) * cycleD);
  }
  return {
    hops_to_cover_400m: summarise(hops),
    cycle_time_s: summarise(cycleT),
    time_to_cover_400m_s: summarise(seqT),
    distance_covered_in_30s_m: summarise(d30),
    compare_with: { sequence_total_range_m: obs.sequence_total_range_m.value, sequence_total_time_s: obs.sequence_total_time_s.value },
    is_prediction: false,
    note: 'BOOKKEEPING, not a model. The hop COUNT is not predicted -- no source in the repository gives one -- and the taxi is not modelled: its 9 m length is an average quoted second-hand (Deng et al. 2019 ref. 11) and its power is never checked against the animal\'s muscle (glide.mjs says so explicitly). Each hop is taken to start at the same drawn take-off airspeed, which is what the sources describe; the taxi time assumes constant acceleration from the 10 m/s leap speed to that take-off speed over the 9 m, and that linearity is assumed. Read `distance_covered_in_30s_m` against the quoted 400 m in 30 s, and `time_to_cover_400m_s` against the quoted 30 s.',
  };
}

/** Comparisons this module could not settle, for lean/registry/open-questions/. */
export const OPEN_QUESTIONS = [
  {
    id: 'ff-50m-single-hop-vs-sequence',
    question: 'Is the quoted 50 m flying-fish glide one hop or a sequence of hops, and what statistic is it?',
    status: 'settled for the hop question, OPEN for the statistic',
    settled: 'Single hop. Deng et al. 2019 (Bioinspir. Biomim. 14:046009, Introduction) draws the distinction in one paragraph: 50 m and a peak height of 8 m belong to "the free flight", while "a total flight distance of 400 m can be achieved in 30 s by the repeated taxiing". Park & Choi 2010 agrees that the 400 m is "a successive sequence of taxiing and flight". So a single-hop model should be compared against the 50 m, not against the 400 m.',
    open: 'What statistic 50 m is. Both sources say "up to" / "reachable", so it is an upper envelope of observed glides, but neither gives a sample size, a mean or a spread, and both are second-hand: the primary observations (Edgerton & Breder 1941, Davenport 1990, Hertel 1966) are not fetched. Until one of them is read, there is no way to know whether 50 m is the largest of ten glides or of ten thousand, and therefore no way to say which percentile of a model distribution it should match.',
    why_it_matters: 'It decides whether this ensemble reproduces the field observation. Against the median (37 m) it does not; against the upper tail (max 55 m over 1000 draws) it does. ENVIRONMENT.md already records that the 50 m "pass" was withdrawn as circular, because the 15-20 m/s launch band is taken from the same observations.',
    to_resolve: 'Fetch Edgerton & Breder 1941 (stroboscopic film) or Davenport 1990 and read how many glides were measured and how the 50 m was reported.',
  },
  {
    id: 'ff-sequence-not-reproduced',
    question: 'Does the repository\'s glide model reproduce the 400 m in 30 s sequence?',
    status: 'OPEN',
    open: 'The single-hop ensemble\'s own bookkeeping (sequenceStats) falls short of 400 m in 30 s, in the same direction and by a similar factor as the single-hop shortfall. But the taxi between hops is not modelled anywhere in this repository -- glide.mjs does not add the taxi distance to the range and never checks the taxi power against the animal\'s muscle -- so the shortfall cannot be attributed between the glide model and the missing taxi.',
    to_resolve: 'Model the taxi phase with a power budget, or state the sequence figure as out of scope.',
  },
];

/** What this ensemble cannot tell you. Read these before quoting any number from it. They are
 *  findings about the model, not disclaimers: each one was found by running the ensemble. */
export const SCOPE_NOTES = [
  'MAX HEIGHT IS A MODEL ARTEFACT, NOT A PREDICTION -- and this one IS a like-for-like comparison. Deng et al. 2019 puts the 8 m peak height in the same sentence as the single 50 m free flight, so it is the peak of ONE hop, which is exactly what this ensemble computes. At the launch airspeed band and the simulator\'s assumed glide angle of attack (5 deg) the lift is about 1.8 times the weight, so the fixed-alpha trajectory climbs hard: the median max height is about 7.8 m and the 95th percentile near 12 m, against a RECORD of 8 m. The median of a model should not sit at the highest value ever observed. Real fish do not hold one angle of attack through a glide; index.html does, and this ensemble inherits it. Treat the height band as the spread of a model, not as a height distribution. Fixing it means letting the angle of attack be trimmed, which is a change to the solver and not this module\'s call.',
  'THE 50 m FIGURE IS ONE HOP, NOT A SEQUENCE -- CHECKED, because the opposite was suspected. Flying fish string several glides together, taxiing between them, so a single-hop model compared against a sequence total would look wrong for the wrong reason. The sources settle it, and they settle it against that worry: Deng et al. 2019 (Bioinspir. Biomim. 14:046009, Introduction) separates the two in one paragraph -- 50 m and 8 m belong to "the free flight", while "a total flight distance of 400 m can be achieved in 30 s by the repeated taxiing" -- and Park & Choi 2010 calls the 400 m "a successive sequence of taxiing and flight". FIELD_OBSERVATIONS carries the verbatim quotes. So this single-hop ensemble was already comparing like with like.',
  'WHAT WAS WRONG WAS THE STATISTIC, NOT THE HOP COUNT. Both sources say "up to 50 m" and "a reachable flight distance of 50 m": an UPPER ENVELOPE of observed glides, not a typical one, and an upper envelope belongs against a model\'s upper tail rather than its median. The ensemble median is 37 m and its 95th percentile 47 m, but its MAXIMUM over 1000 draws is about 55 m, so the ensemble does bracket the quoted figure. The honest statement is therefore NOT "our model underestimates real glides" but: the ensemble is consistent with a quoted maximum of 50 m, and it does not reproduce it, because a figure given with no sample size and no spread, three sources removed from the observation, cannot be matched to a percentile. ENVIRONMENT.md already records that the 50 m "pass" was withdrawn as circular, since the 15-20 m/s launch band is taken from the same observations; nothing here rescues it. OPEN_QUESTIONS says what would settle it.',
  'THE SEQUENCE FIGURE BEHAVES EXACTLY LIKE THE SINGLE-HOP ONE, WHICH IS THE REAL RESULT. stats.sequence is bookkeeping on the single-hop draws, not a model: it asks how many hops of this size would cover the quoted 400 m and how long that would take. It gives about 8.7 hops, 37 s to cover 400 m against the quoted 30 s, and 326 m covered in 30 s (5-95% 266-382 m, maximum 435 m) against the quoted 400 m. Note the pattern: the 400 m is also quoted as a maximum ("as much as 400 m in 30 s"), and here too the ensemble MEDIAN falls short while its upper tail BRACKETS the figure. Both quoted field numbers are maxima, both are bracketed by the ensemble maximum and missed by its median, and that is the consistent reading of all of it -- not that the model under-ranges, but that maxima quoted without a sample size cannot be matched to a percentile. The shortfall also cannot be split between the glide model and the taxi, because the taxi is modelled nowhere in this repository: glide.mjs does not add the 9 m taxi run to the range and never checks the taxi power -- burst and anaerobic -- against the animal\'s muscle. The hop COUNT is not predicted; no source gives one.',
  'FOR A SMALL ANIMAL THE ASSUMED GUST SWAMPS EVERYTHING. The gust sd is 1 m/s (half of wind.mjs\'s assumed +-2 m/s design input). The winged zebrafish\'s entire launch speed is 0.62 m/s, so its drawn ground range is sometimes NEGATIVE: it is blown backwards. That is arithmetically right and scientifically useless. An ensemble over an animal whose launch speed is below the assumed gust is a distribution of being blown about, not of gliding, and its only honest readout is the one reported: it never glides, at any seed.',
  'THE BAND IS NARROWER THAN THE TRUTH IN ONE WAY AND WIDER IN ANOTHER. Narrower: only eight inputs are drawn. The drag polar itself (C_Lmax 0.78, (L/D)max 4.37) is held fixed at one measurement of stuffed specimens at one wind speed, and C_L at 0 deg is the assumed 0.4 in params.json (glide.mjs has since derived 0.53), so polar uncertainty -- probably the largest single term -- is absent. Wider: mass and fin area are drawn independently because no source gives their correlation, and real fish correlate them.',
];

// ---------------------------------------------------------------- one draw
/**
 * Draw one perturbed parameter set.
 *   perturbRun(baseParams, rng, {distributions, conditions, sea}) -> {params, draw, skipped}
 * `params` is a shallow clone of baseParams with the perturbed fields written back in baseParams'
 * own shape; a {value, kind, source} field becomes kind 'assumed' with the distribution named in
 * `source`, so a drawn number can never be mistaken for the measured one it replaced.
 * `draw` records every quantity, including the ones deliberately NOT drawn and why.
 */
export function perturbRun(baseParams, rng, opts = {}) {
  const dists = opts.distributions || DISTRIBUTIONS;
  const sea = opts.sea || SEA_STATE;
  const conditions = opts.conditions || {};
  const params = Object.assign({}, baseParams);
  const shaped = isShaped(baseParams);           // write absent fields in the base object's own shape
  const ctx = { params: baseParams, conditions, sea, allowLaunchDraw: opts.allow_launch_draw ?? null };
  const draw = {}, skipped = [];

  // Base values. launch airspeed: the explicit field, else the simulator's take-off target
  // (params.json takeoff_speed_target_m_s), else the approach speed.
  const base = {
    launch_airspeed_m_s: pv(baseParams, 'launch_airspeed_m_s') ?? pv(baseParams, 'takeoff_speed_target_m_s') ?? pv(baseParams, 'approach_speed_m_s') ?? 0,
    launch_path_angle_deg: pv(baseParams, 'launch_path_angle_deg') ?? pv(baseParams, 'approach_angle_deg') ?? 0,
    surface_elevation_m: 0,
    surface_slope_deg: 0,
    wind_along_path_m_s: 0,
    mass_kg: pv(baseParams, 'mass_kg') ?? 0,
    ref_area_m2: pv(baseParams, 'ref_area_m2') ?? 0,
    glide_alpha_deg: pv(baseParams, 'glide_alpha_deg') ?? 0,
  };

  for (const d of dists) {
    const b = base[d.key] ?? 0;
    const r = d.draw(rng, b, ctx);
    if (r && r.skipped) { draw[d.key] = { value: b, skipped: true, reason: r.reason }; skipped.push(d.key); continue; }
    draw[d.key] = { value: r.value, base: b, distribution: d.key, shape: d.shape, band_kind: d.band_kind, shape_kind: d.shape_kind };
  }

  // Write the drawn values back into the parameter object the solver reads.
  const src = k => { const d = dists.find(x => x.key === k); return d ? `DRAWN from the ${d.shape} distribution "${d.key}" (band ${d.band_kind}, shape ${d.shape_kind}) -- creatures.js DISTRIBUTIONS. ${d.source}` : `DRAWN (creatures.js ${k})`; };
  if (draw.mass_kg && !draw.mass_kg.skipped) setPv(params, 'mass_kg', draw.mass_kg.value, src('mass_kg'), shaped);
  if (draw.ref_area_m2 && !draw.ref_area_m2.skipped) {
    const f = base.ref_area_m2 > 0 ? draw.ref_area_m2.value / base.ref_area_m2 : 1;
    setPv(params, 'ref_area_m2', draw.ref_area_m2.value, src('ref_area_m2'), shaped);
    const span = pv(baseParams, 'span_m');
    // Span scales as sqrt(area) so the aspect ratio -- and therefore the ground-effect ratio
    // h/(span/2) -- stays self-consistent with the drawn area. Stated in the area distribution.
    if (span != null) setPv(params, 'span_m', span * Math.sqrt(f), src('ref_area_m2') + ' span_m scaled by sqrt(area factor) to hold the aspect ratio.', shaped);
  }
  if (draw.glide_alpha_deg && !draw.glide_alpha_deg.skipped) setPv(params, 'glide_alpha_deg', draw.glide_alpha_deg.value, src('glide_alpha_deg'), shaped);
  if (draw.launch_airspeed_m_s && !draw.launch_airspeed_m_s.skipped) {
    setPv(params, 'launch_airspeed_m_s', draw.launch_airspeed_m_s.value, src('launch_airspeed_m_s'), shaped);
    if (pv(baseParams, 'takeoff_speed_target_m_s') != null) setPv(params, 'takeoff_speed_target_m_s', draw.launch_airspeed_m_s.value, src('launch_airspeed_m_s'), shaped);
  } else {
    setPv(params, 'launch_airspeed_m_s', base.launch_airspeed_m_s,
      `NOT DRAWN: ${draw.launch_airspeed_m_s ? draw.launch_airspeed_m_s.reason : 'no launch-speed distribution supplied'}. The base value is kept unchanged.`, shaped);
  }
  // Launch height = the base launch height plus the drawn sea-surface elevation, floored just
  // above the surface (a launch from below mean sea level is not a launch).
  const h0 = pv(baseParams, 'launch_height_m') ?? 1;
  const h = Math.max(0.05, h0 + (draw.surface_elevation_m ? draw.surface_elevation_m.value : 0));
  setPv(params, 'launch_height_m', h, src('surface_elevation_m'), shaped);
  // Path angle = drawn take-off path angle + drawn sea-surface slope.
  const gamma = (draw.launch_path_angle_deg ? draw.launch_path_angle_deg.value : base.launch_path_angle_deg)
    + (draw.surface_slope_deg ? draw.surface_slope_deg.value : 0);
  setPv(params, 'launch_path_angle_deg', gamma, src('launch_path_angle_deg') + ' Plus the drawn surface_slope_deg.', shaped);
  setPv(params, 'headwind_m_s', draw.wind_along_path_m_s ? draw.wind_along_path_m_s.value : 0, src('wind_along_path_m_s'), shaped);

  return { params, draw, skipped, gate: ctx.gate || launchDrawGate(baseParams, base.launch_airspeed_m_s, opts.allow_launch_draw ?? null) };
}

// ---------------------------------------------------------------- the default solver
// The simulator's OWN glide-phase dynamics, taken from index.html (derive / CL / CD / fge / rk4)
// with power off, so an ensemble draw is the same physics the single deterministic line is drawn
// from. It is NOT a new model:
//   CL(a)  = CL0 + (CLmax - CL0)/stall * a           (linear to the stall, as index.html)
//   CD(CL) = CDmin + k CL^2, k = (CL0/LDmax - CDmin)/CL0^2
//   ground-effect drag factor: 1 for r >= 0.97, linear to 0.86 at r = 0.33, 0.86 below; r = h/(span/2)
//     (physics/ground-effect.json, Park & Choi 2010 model L3 over water -- MEASURED)
//   v_min  = sqrt(2W / (rho S CLmax))                (physics/results.json interpretation B)
// Lift and drag act on the AIR-relative velocity; gravity and the integrated position are in the
// ground frame, so a headwind shortens the ground range without touching the aerodynamics.
// The angle of attack is held constant in the glide, exactly as index.html's glide phase does, so
// the trajectory phugoids: that is the simulator's model, not an addition.
//
// DIFFERENCE FROM glide.mjs's PUBLISHED BOUND, stated because it matters and because the first
// version of this file got the direction wrong. glide.mjs's glidePath is a two-phase ANALYTIC
// BOUND: level flight at the launch height decelerating all the way to v_min at (L/D)max, then a
// descent of h (L/D)max. That level phase converts nearly all the excess launch kinetic energy
// into horizontal distance, which requires the fish to trim its angle of attack continuously to
// hold L = W as it slows. The integration here instead holds the angle of attack CONSTANT, as
// index.html's glide phase does, so the trajectory phugoids -- it climbs while L > W, arcs over,
// and RE-ENTERS THE WATER STILL TRAVELLING FAST (about 12 m/s for the L3 fish from 17.5 m/s).
// The residual kinetic energy is never cashed in as distance, so the integrated range is
// SHORTER than glide.mjs's bound, roughly three quarters of it. That is the bound behaving as a
// bound. `analyticBound` below returns glide.mjs's numbers so both appear in every ensemble result.
function derive(params) {
  const m = pv(params, 'mass_kg'), S = pv(params, 'ref_area_m2'), span = pv(params, 'span_m');
  const CLmax = pv(params, 'CL_max') ?? 0.78, LDmax = pv(params, 'LD_max') ?? 4.37;
  const CDmin = pv(params, 'CD_min') ?? 0.055, CL0 = pv(params, 'CL_at_zero_deg') ?? 0.4;
  const stall = pv(params, 'stall_alpha_deg') ?? 35, alpha = pv(params, 'glide_alpha_deg') ?? 5;
  const rho = pv(params, 'rho_air') ?? RHO_AIR, g = pv(params, 'g') ?? G;
  if (!(m > 0) || !(S > 0)) return null;
  const CLslope = (CLmax - CL0) / stall;
  return {
    m, S, b: (span || 0) / 2, CLmax, LDmax, CDmin, CL0, stall, alpha, rho, g,
    CLslope, k: (CL0 / LDmax - CDmin) / (CL0 * CL0),
    W: m * g, vmin: Math.sqrt((2 * m * g) / (rho * S * CLmax)),
  };
}
const clOf = (d, a) => (a <= d.stall ? Math.max(-0.5, d.CL0 + d.CLslope * a) : (d.CLmax * (60 - Math.min(a, 60))) / 25);
const cdOf = (d, cl) => d.CDmin + d.k * cl * cl;
function fge(d, h, on) {
  if (!on || !(d.b > 0)) return 1;
  const r = h / d.b;
  if (r >= 0.97) return 1;
  if (r <= 0.33) return 0.86;
  return 1 - ((0.97 - r) / (0.97 - 0.33)) * 0.14;
}

/**
 * Integrate one unpowered glide with the simulator's glide-phase dynamics.
 *   glideTrajectory(params, {dt, tmax, sample, groundEffect}) ->
 *   {range_m, time_s, max_height_m, can_glide, v_min_m_s, wing_loading_N_m2,
 *    launch_airspeed_m_s, launch_height_m, headwind_m_s, pts: [{x, z}, ...], stop}
 * pts are {x: ground distance in m, z: height above mean sea level in m}, subsampled at `sample`
 * seconds. The {x, z} object form is deliberate: it is what scene3d.js's band renderer reads, so a
 * host solver passed as `run` and this default solver are interchangeable.
 */
export function glideTrajectory(params, opts = {}) {
  const d = derive(params);
  const dt = opts.dt ?? 0.002, tmax = opts.tmax ?? 30, sample = opts.sample ?? 0.05;
  const xmax = opts.xmax ?? 900;
  const ge = opts.groundEffect ?? ((pv(params, 'ground_effect') ?? 1) ? true : true);
  const v0 = pv(params, 'launch_airspeed_m_s') ?? pv(params, 'takeoff_speed_target_m_s') ?? 0;
  const h0 = pv(params, 'launch_height_m') ?? 1;
  const u = pv(params, 'headwind_m_s') ?? 0;          // + = headwind, air moves at -u in x
  const gamma = (pv(params, 'launch_path_angle_deg') ?? 0) * DEG;
  if (!d) return { range_m: null, time_s: null, max_height_m: null, can_glide: null, reason: 'mass_kg or ref_area_m2 missing or non-positive', pts: [] };

  // Air-relative accelerations; the state is in the ground frame.
  const acc = (st, out) => {
    const vax = st[2] + u, vaz = st[3];              // air-relative velocity
    const va = Math.hypot(vax, vaz) || 1e-9;
    const ux = vax / va, uz = vaz / va;
    const cl = clOf(d, d.alpha), cd = cdOf(d, cl);
    const q = 0.5 * d.rho * va * va * d.S;
    const L = q * cl, D = q * cd * fge(d, Math.max(0, st[1]), ge);
    out[0] = (-D * ux - L * uz) / d.m;
    out[1] = (-D * uz + L * ux) / d.m - d.g;
  };
  // RK4, same scheme as index.html. Scratch arrays are allocated once per call, never per step.
  // The launch speed is an AIRSPEED, as glide.mjs takes it ("the launch speed itself is taken as
  // airspeed, as in glide.mjs" -- wind.mjs), and the path angle is relative to the air. The state
  // is in the GROUND frame, so the initial ground velocity in x is the airspeed component minus
  // the headwind. Without this subtraction a headwind would lengthen the ground range, which is
  // backwards: glide.mjs has ground distance = air distance - u x time.
  const s = [0, h0, v0 * Math.cos(gamma) - u, v0 * Math.sin(gamma)];
  const a = [0, 0], k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0], tmp = [0, 0, 0, 0];
  const f = (st, k) => { acc(st, a); k[0] = st[2]; k[1] = st[3]; k[2] = a[0]; k[3] = a[1]; };
  const mix = (st, k, hh) => { for (let i = 0; i < 4; i++) tmp[i] = st[i] + hh * k[i]; return tmp; };

  const pts = [{ x: 0, z: h0 }];
  let t = 0, maxH = h0, next = sample, stop = 'surface';
  while (t < tmax) {
    f(s, k1); f(mix(s, k1, dt / 2), k2); f(mix(s, k2, dt / 2), k3); f(mix(s, k3, dt), k4);
    for (let i = 0; i < 4; i++) s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    t += dt;
    if (s[1] > maxH) maxH = s[1];
    if (t >= next) { pts.push({ x: s[0], z: s[1] }); next += sample; }
    if (s[1] <= 0) { stop = 'surface'; break; }
    if (s[0] > xmax) { stop = 'x limit'; break; }
    if (t >= tmax) { stop = 't limit'; break; }
  }
  pts.push({ x: s[0], z: Math.max(0, s[1]) });
  return {
    range_m: s[0], time_s: t, max_height_m: maxH, stop,
    can_glide: v0 >= d.vmin,
    v_min_m_s: d.vmin, wing_loading_N_m2: d.W / d.S,
    launch_airspeed_m_s: v0, launch_height_m: h0, headwind_m_s: u,
    launch_path_angle_deg: gamma / DEG, glide_alpha_deg: d.alpha, pts,
  };
}

/**
 * glide.mjs's published two-phase analytic bound, reproduced here unchanged so each ensemble draw
 * can be read against it. Returns {lean_bound_m, kinetic_m, total_m, time_s, v_min_m_s, v_LD_m_s}.
 * lean_bound_m = h (L/D)max is the only part the Lean theorem glide_range_le covers; kinetic_m is
 * the level phase, which lies OUTSIDE that theorem (glide.mjs LEAN_SRC / KIN_SRC).
 */
export function analyticBound(params) {
  const d = derive(params);
  if (!d) return null;
  const v0 = pv(params, 'launch_airspeed_m_s') ?? pv(params, 'takeoff_speed_target_m_s') ?? 0;
  const h = pv(params, 'launch_height_m') ?? 1;
  const u = pv(params, 'headwind_m_s') ?? 0;
  // glide.mjs uses CL_at_zero_deg 0.53 (derived from Park & Choi's lift-equals-weight at 0 deg);
  // params.json still carries the older assumed 0.4. Whatever the params object says is used, and
  // which one it is shows in the params' own `kind`.
  const f = fge(d, h, true), LDa = d.LDmax / f;
  const xA = v0 > d.vmin ? (LDa * (v0 * v0 - d.vmin * d.vmin)) / (2 * d.g) : 0;
  const tA = v0 > d.vmin ? (LDa * (v0 - d.vmin)) / d.g : 0;
  const vLD = d.vmin * Math.sqrt(d.CLmax / d.CL0);
  const xB = h > 0 ? h * d.LDmax : 0, tB = h > 0 ? xB / vLD : 0;
  const can = v0 >= d.vmin;
  return {
    lean_bound_m: can ? xB : 0, kinetic_m: can ? xA : 0, total_m: can ? xA + xB : 0,
    ground_total_m: can ? xA - u * tA + xB - u * tB : 0,
    time_s: can ? tA + tB : 0, v_min_m_s: d.vmin, v_LD_m_s: vLD, can_glide: can,
    source: 'sim-engine/scenarios/glide.mjs glidePath (LEAN_SRC + KIN_SRC): level flight at the launch height decelerating to v_min, then a descent of h (L/D)max. An upper bound in each phase, and it truncates the kinetic phase at v_min, so it is SHORTER than the integrated trajectory.',
  };
}

// ---------------------------------------------------------------- summary statistics
/** median, p5, p95, min, max, mean, n. Percentiles by linear interpolation on the sorted sample. */
export function summarise(values) {
  const v = values.filter(x => typeof x === 'number' && Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0, median: null, p5: null, p95: null, min: null, max: null, mean: null };
  const q = p => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo); };
  return { n, median: q(0.5), p5: q(0.05), p95: q(0.95), min: v[0], max: v[n - 1], mean: v.reduce((s, x) => s + x, 0) / n };
}

/**
 * Run the solver `draws` times with every random input drawn from DISTRIBUTIONS.
 *
 *   makeEnsemble({draws, seed, distributions, baseParams, run, conditions, sea, keepTrajectories})
 *
 *   baseParams         the parameter object (params.json fish entry, or index.html's live `fish`)
 *   run(params)        the solver. Defaults to `glideTrajectory`. A host that wants the full
 *                      breach + taxi + glide simulation passes its own wrapper; it must return
 *                      {range_m, time_s, max_height_m, can_glide, pts?}.
 *   seed               any string or number. The SAME SEED GIVES THE SAME ENSEMBLE, and the seed
 *                      belongs in the URL state (seedFromUrl / seedToUrl).
 *
 * Returns {seed, draws, runs, deterministic, stats, distributions, note, sea, species_gate}.
 * `deterministic` is the UNPERTURBED single run, so the UI can show where the one line everybody
 * used to look at sits inside the band.
 */
export function makeEnsemble(opts = {}) {
  const draws = Math.max(1, opts.draws ?? 200);
  const seed = opts.seed ?? 'delphi-v1';
  const dists = opts.distributions || DISTRIBUTIONS;
  const baseParams = opts.baseParams || {};
  const run = opts.run || glideTrajectory;
  const sea = opts.sea || SEA_STATE;
  const conditions = opts.conditions || {};
  const keep = opts.keepTrajectories !== false;
  const solverOpts = opts.solverOpts || {};

  // One stream for the ensemble, forked off the seed and labelled, so the decorative school
  // (which forks 'ambient') can never shift a published draw.
  const rng = makeRng(seed).fork('ensemble');

  // The deterministic run: the base parameters with only the structural fields the solver needs
  // filled in, and NOTHING drawn.
  const detParams = Object.assign({}, baseParams);
  const detShaped = isShaped(baseParams);
  if (pv(detParams, 'launch_airspeed_m_s') == null) {
    const v = pv(baseParams, 'takeoff_speed_target_m_s') ?? pv(baseParams, 'approach_speed_m_s') ?? 0;
    setPv(detParams, 'launch_airspeed_m_s', v, 'deterministic run: the base take-off target (params.json takeoff_speed_target_m_s), nothing drawn', detShaped);
  }
  if (pv(detParams, 'launch_height_m') == null) setPv(detParams, 'launch_height_m', 1, 'deterministic run: glide.mjs LAUNCH_HEIGHT_PARAM default 1 m (kind assumed)', detShaped);
  if (pv(detParams, 'launch_path_angle_deg') == null) setPv(detParams, 'launch_path_angle_deg', pv(baseParams, 'approach_angle_deg') ?? 0, 'deterministic run: the base approach_angle_deg', detShaped);
  if (pv(detParams, 'headwind_m_s') == null) setPv(detParams, 'headwind_m_s', 0, 'deterministic run: still air', detShaped);
  const deterministic = Object.assign({}, run(detParams, solverOpts), { analytic: analyticBound(detParams), params: detParams });
  const gate = launchDrawGate(baseParams, pv(detParams, 'launch_airspeed_m_s'), opts.allow_launch_draw ?? null);

  const runs = [];
  for (let i = 0; i < draws; i++) {
    const { params, draw, skipped } = perturbRun(baseParams, rng, { distributions: dists, conditions, sea, allow_launch_draw: opts.allow_launch_draw ?? null });
    const result = run(params, solverOpts);
    if (!keep && result && result.pts) result.pts = null;
    runs.push({ i, draw, skipped, params, result, analytic: analyticBound(params) });
  }

  const col = f => runs.map(r => f(r));
  const stats = {
    glide_range_m: summarise(col(r => r.result && r.result.range_m)),
    time_aloft_s: summarise(col(r => r.result && r.result.time_s)),
    max_height_m: summarise(col(r => r.result && r.result.max_height_m)),
    launch_airspeed_m_s: summarise(col(r => r.draw.launch_airspeed_m_s && r.draw.launch_airspeed_m_s.value)),
    v_min_m_s: summarise(col(r => r.result && r.result.v_min_m_s)),
    wing_loading_N_m2: summarise(col(r => r.result && r.result.wing_loading_N_m2)),
    analytic_lean_bound_m: summarise(col(r => r.analytic && r.analytic.lean_bound_m)),
    analytic_total_m: summarise(col(r => r.analytic && r.analytic.total_m)),
    can_glide_fraction: runs.filter(r => r.result && r.result.can_glide).length / runs.length,
  };
  // Multi-hop BOOKKEEPING, so the quoted 400 m / 30 s SEQUENCE can be read against a model that
  // computes ONE hop. See FIELD_OBSERVATIONS for which quoted figure measures which quantity.
  stats.sequence = stats.can_glide_fraction > 0
    ? sequenceStats(col(r => r.result && r.result.range_m), col(r => r.result && r.result.time_s), col(r => r.result && r.result.launch_airspeed_m_s))
    : { note: 'not computed: this animal cannot glide, so it makes no hops', is_prediction: false };
  return {
    seed: String(seed), draws, runs, deterministic, stats, sea,
    species_gate: {
      // Field names match sim-engine/validate/physics/ensemble.mjs so the two reports line up.
      is_flier: gate.allow, species_matches_flier: gate.species_matches,
      launch_speed_drawn: gate.allow, note: gate.reason,
    },
    distributions: dists.map(d => ({
      key: d.key, label: d.label, unit: d.unit, shape: d.shape, band: d.band || null, sd: d.sd ?? null, cv: d.cv ?? null,
      spread: d.spread_text ? d.spread_text(sea) : d.band ? `${d.band[0]}-${d.band[1]} ${d.unit}` : d.cv != null ? `CV ${(d.cv * 100).toFixed(2)}%` : d.sd != null ? `sd ${d.sd} ${d.unit}` : 'see the source',
      band_kind: d.band_kind, shape_kind: d.shape_kind, applies: d.applies || 'all animals', source: d.source,
    })),
    note: UNCERTAINTY_NOTE,
    scope: SCOPE_NOTES,
    field_observations: FIELD_OBSERVATIONS,
    open_questions: OPEN_QUESTIONS,
    solver: run === glideTrajectory
      ? "creatures.js glideTrajectory: the simulator's own glide-phase dynamics (index.html derive/CL/CD/fge/rk4) with power off, integrated to the water at a CONSTANT angle of attack. The trajectory phugoids and re-enters the water still travelling fast, so the residual kinetic energy is never converted into distance and the integrated range comes out SHORTER than glide.mjs's analytic bound (which assumes level flight decelerating all the way to v_min). Both are reported in stats."
      : 'a solver supplied by the host',
  };
}

// ---------------------------------------------------------------- the seed in the URL state
export const SEED_PARAM = 'cseed';
/** Read the ensemble seed from a URL query string. Returns the default when absent. */
export function seedFromUrl(search, key = SEED_PARAM) {
  const s = search != null ? search : (typeof location !== 'undefined' ? location.search : '');
  const v = new URLSearchParams(s).get(key);
  return v == null || v === '' ? 'delphi-v1' : v;
}
/** Write the ensemble seed into a URL and return the new URL string. */
export function seedToUrl(url, seed, key = SEED_PARAM) {
  const u = new URL(String(url), typeof location !== 'undefined' ? location.href : 'https://example.invalid/');
  u.searchParams.set(key, String(seed));
  return u.toString();
}

// ===========================================================================================
// SECTION B -- AMBIENT CREATURES (DECORATIVE)
//
// Everything below this line is DECORATION. The school's flocking rule, the predator's circuit
// and the distant gliders' spacing are invented to make the scene look alive. They are not
// evidence, they do not feed a metric, and they must be labelled "decorative" wherever they
// appear. Every object gets userData.decorative = true and userData.note, so a reader who
// inspects the scene graph finds the label there too.
//
// Performance rules kept here: one InstancedMesh for the school, flat Float32Array state, all
// vector maths on scalar locals, and exactly one Matrix4 / Quaternion / Vector3 reused for every
// instance of every frame. Nothing is allocated inside update().
//
// AND AGAIN: NO BIRDS. See the file header. The sky holds flying fish and nothing else.
// ===========================================================================================

const DECOR_NOTE = 'DECORATIVE. Ambient scene dressing with invented motion. Not evidence, not a metric, not citable.';

/** Species scale table: SL in metres from the GLB manifest, via partedit.js metresPerUnit.
 *  The manifests whose `parameters.standard_length_m` is set are the `-dev` ones; the plain
 *  manifests (manifest.json, manifest-adult.json) have no metres scale at all, and metresPerUnit
 *  says so rather than guessing, so they are not listed. */
export const SPECIES_SCALE = {
  'flying-fish': { manifest: '../../../blueprint3d/model/flying-fish-dev-manifest.json', glb: '../../../blueprint3d/model/flying-fish-dev.glb', SL_m: 0.203 },
  zebrafish: { manifest: '../../../blueprint3d/model/zebrafish-dev-manifest.json', glb: '../../../blueprint3d/model/zebrafish-dev.glb', SL_m: 0.0388 },
  'winged-zebrafish': { manifest: '../../../blueprint3d/model/winged-zebrafish-manifest.json', glb: '../../../blueprint3d/model/winged-zebrafish.glb', SL_m: 0.0388 },
};

/** Model units -> metres for a loaded GLB, from its manifest. Falls back to an explicit SL_m.
 *  Returns {scale, source}: `scale` multiplies the loaded GLB's local units to give metres. */
export function glbScale(manifest, fallbackSL_m) {
  if (manifest) {
    const r = metresPerUnit(manifest);
    if (r && r.m_per_unit > 0) return { scale: r.m_per_unit, source: 'partedit.js metresPerUnit: ' + r.source };
  }
  if (fallbackSL_m > 0) return { scale: fallbackSL_m / 0.82, source: `no manifest metres scale; SL ${fallbackSL_m} m over the manifests' standard 0.82 model units` };
  return { scale: 1, source: 'no manifest and no SL: left at 1 model unit (the impostor geometry is already 1 unit long)' };
}

/** A low-poly fish impostor, 1 unit from snout to caudal tip, head at +X, back at +Y, the fish's
 *  left at -Z: the GLB manifests' own axes ("glTF Y-up; head at +X, back at +Y, the fish's left
 *  side at -Z"), so an impostor and a real GLB geometry are interchangeable in `makeSchool`.
 *  18 triangles: a fusiform body, a forked caudal fin, spread pectorals and a small dorsal. The
 *  pectorals matter -- without them a fish at scene distance is a 3-pixel sliver that reads as a
 *  scratch on the glass rather than an animal. Used only when no GLB geometry is handed in.
 *  (A flying fish, not a bird. There is no bird impostor in this file and there must not be one.) */
export function impostorGeometry(THREE) {
  const nose = [0.5, 0, 0], tb = [-0.3, 0, 0];
  const r = [[0.08, 0.1, 0], [0.08, 0, 0.07], [0.08, -0.085, 0], [0.08, 0, -0.07]];
  const tri = [];
  const push = (...ps) => { for (const p of ps) tri.push(p[0], p[1], p[2]); };
  const both = (a, b, c) => { push(a, b, c); push(a, c, b); };   // a thin fin needs both faces
  for (let i = 0; i < 4; i++) { const a = r[i], b = r[(i + 1) % 4]; push(nose, a, b); push(tb, b, a); }
  both(tb, [-0.5, 0.2, 0], [-0.44, 0, 0]);                 // forked caudal, upper lobe
  both(tb, [-0.44, 0, 0], [-0.5, -0.26, 0]);               // lower lobe, longer: the taxi lobe
  for (const s of [1, -1]) both([0.12, 0.02, s * 0.05], [-0.18, 0.06, s * 0.42], [-0.04, -0.02, s * 0.30]);
  both([0.0, 0.09, 0], [-0.22, 0.2, 0], [-0.24, 0.07, 0]); // small dorsal, for a readable silhouette
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A small school of fish below the surface with bounded, seeded, boids-style flocking
 * (separation / alignment / cohesion). DECORATIVE.
 *
 *   makeSchool({THREE, scene, species, count, bounds, rng, geometry, manifest, material, colour})
 *
 *   geometry   optional THREE.BufferGeometry already extracted from a real GLB. When given it is
 *              instanced as-is and scaled by the manifest's metres-per-unit, so the school reuses
 *              the real mesh for the cost of one draw call. Otherwise `impostorGeometry` is used.
 *   manifest   the GLB's *-manifest.json, read for the metres scale via partedit.js metresPerUnit.
 *   bounds     {x:[lo,hi], y:[lo,hi], z:[lo,hi]} in metres. y is height; the school stays below 0.
 *
 * Returns {mesh, count, update(dt), setPredator(bool), predatorAt(x,y,z), dispose(), info}.
 */
export function makeSchool(o = {}) {
  const THREE = o.THREE;
  if (!THREE) throw new Error('makeSchool needs THREE handed in by the host');
  const species = o.species || 'zebrafish';
  const count = Math.max(1, Math.min(o.count ?? 24, 256));   // capped: this is decoration, not a crowd sim
  const rng = o.rng || makeRng('school');
  const sp = SPECIES_SCALE[species] || {};
  const bounds = o.bounds || { x: [-14, 14], y: [-5.5, -0.7], z: [-10, 10] };
  const B = [bounds.x || [-14, 14], bounds.y || [-5.5, -0.7], bounds.z || [-10, 10]];

  let geo = o.geometry || impostorGeometry(THREE);
  let owned = !o.geometry;
  // The repository's `-dev` GLBs are GROWTH SERIES: every mesh carries morph targets (the viewer
  // blends between ages). An InstancedMesh has no `morphTargetInfluences`, and three r160 then
  // reads `.length` of undefined inside WebGLMorphtargets on the first render and the whole frame
  // loop dies -- which is exactly what happened the first time this school was handed a real GLB
  // geometry. A decorative school has no use for the growth morphs, so the geometry is cloned
  // without them. scene3d.js gets this for free by handing its geometry in; it strips nothing.
  if (o.geometry && o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) {
    geo = o.geometry.clone();
    geo.morphAttributes = {};
    owned = true;
  }
  const sc = glbScale(o.manifest, o.SL_m ?? sp.SL_m);
  // A real GLB is one model unit per unit; the impostor is already 1 unit snout-to-tail, so both
  // are scaled by the metres-per-unit the manifest gives. Decorative schools are drawn a little
  // larger than life when the species is tiny, or a 3.9 cm zebrafish is invisible at scene scale.
  const sizeMul = o.sizeMultiplier ?? 1;
  const scale = sc.scale * sizeMul;

  const mat = o.material || new THREE.MeshLambertMaterial({ color: o.colour ?? 0xbcd9e6, emissive: o.emissive ?? 0x16323c, side: THREE.DoubleSide });
  const ownedMat = !o.material;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'decorative-school-' + species;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.decorative = true;
  mesh.userData.note = DECOR_NOTE + ' Boids flocking (separation/alignment/cohesion), seeded; no part of it is a measured behaviour.';
  if (o.scene) o.scene.add(mesh);

  // Flat state. No per-frame allocation anywhere below.
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  const cruise = 0.6 + 0.4 * (sp.SL_m ? Math.min(1, sp.SL_m / 0.1) : 0.5);   // m/s, decorative
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rng.uniform(B[0][0], B[0][1]);
    pos[i * 3 + 1] = rng.uniform(B[1][0], B[1][1]);
    pos[i * 3 + 2] = rng.uniform(B[2][0], B[2][1]);
    const th = rng.uniform(0, Math.PI * 2), ph = rng.normal(0, 0.15);
    vel[i * 3] = Math.cos(th) * Math.cos(ph) * cruise;
    vel[i * 3 + 1] = Math.sin(ph) * cruise;
    vel[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * cruise;
  }

  // The single set of scratch objects reused for every instance of every frame.
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
  const _dir = new THREE.Vector3(), _s = new THREE.Vector3(scale, scale, scale);
  const _X = new THREE.Vector3(1, 0, 0);                   // model forward: head at +X

  const R_SEP = o.separation_m ?? 0.55, R_NEI = o.neighbourhood_m ?? 2.4;
  const W_SEP = 1.6, W_ALI = 0.55, W_COH = 0.35, W_WALL = 2.2, W_FLEE = 7;
  let predator = false, px = 0, py = -2, pz = 0;

  function update(dt) {
    const h = Math.min(dt, 0.05);                          // a long frame must not explode the flock
    const r2sep = R_SEP * R_SEP, r2nei = R_NEI * R_NEI;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2];
      let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, na = 0, nc = 0;
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        const j3 = j * 3;
        const dx = pos[j3] - x, dy = pos[j3 + 1] - y, dz = pos[j3 + 2] - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2nei || d2 === 0) continue;
        if (d2 < r2sep) { const inv = 1 / Math.max(d2, 1e-4); sx -= dx * inv; sy -= dy * inv; sz -= dz * inv; }
        ax += vel[j3]; ay += vel[j3 + 1]; az += vel[j3 + 2]; na++;
        cx += pos[j3]; cy += pos[j3 + 1]; cz += pos[j3 + 2]; nc++;
      }
      let fx = sx * W_SEP, fy = sy * W_SEP, fz = sz * W_SEP;
      if (na) { fx += (ax / na - vel[i3]) * W_ALI; fy += (ay / na - vel[i3 + 1]) * W_ALI; fz += (az / na - vel[i3 + 2]) * W_ALI; }
      if (nc) { fx += (cx / nc - x) * W_COH; fy += (cy / nc - y) * W_COH; fz += (cz / nc - z) * W_COH; }
      // Soft walls: the school is bounded, and it never crosses the surface (y stays below B[1][1]).
      for (let k = 0; k < 3; k++) {
        const v = k === 0 ? x : k === 1 ? y : z, lo = B[k][0], hi = B[k][1], m = 1.2;
        let w = 0;
        if (v < lo + m) w = (lo + m - v) * W_WALL;
        else if (v > hi - m) w = -(v - (hi - m)) * W_WALL;
        if (k === 0) fx += w; else if (k === 1) fy += w; else fz += w;
      }
      if (predator) {
        const dx = x - px, dy = y - py, dz = z - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 36) { const inv = W_FLEE / Math.max(d2, 0.25); fx += dx * inv; fy += dy * inv; fz += dz * inv; }
      }
      let vx = vel[i3] + fx * h, vy = vel[i3 + 1] + fy * h, vz = vel[i3 + 2] + fz * h;
      const sp2 = vx * vx + vy * vy + vz * vz, top = predator ? cruise * 2.6 : cruise * 1.5;
      if (sp2 > top * top) { const s = top / Math.sqrt(sp2); vx *= s; vy *= s; vz *= s; }
      else if (sp2 < (cruise * 0.45) ** 2) { const s = (cruise * 0.45) / Math.max(Math.sqrt(sp2), 1e-6); vx *= s; vy *= s; vz *= s; }
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      pos[i3] = x + vx * h; pos[i3 + 1] = Math.min(B[1][1], y + vy * h); pos[i3 + 2] = z + vz * h;

      _dir.set(vx, vy, vz);
      if (_dir.lengthSq() > 1e-10) { _dir.normalize(); _q.setFromUnitVectors(_X, _dir); }
      _p.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);   // place the instances before the first frame

  return {
    mesh, count, update,
    setPredator: on => { predator = !!on; },
    predatorAt: (x, y, z) => { px = x; py = y; pz = z; },
    positions: pos,
    dispose() {
      if (o.scene) o.scene.remove(mesh);
      mesh.dispose();
      if (owned) geo.dispose();
      if (ownedMat) mat.dispose();
    },
    info: { species, count, scale, scale_source: sc.source, bounds, decorative: true, note: mesh.userData.note },
  };
}

/**
 * The rest of the ambient dressing: an optional predator below the surface, and a couple of
 * distant gliding fish. DECORATIVE.
 *
 *   makeAmbient({THREE, scene, rng, conditions, gliders, predator, bounds, geometry, manifest})
 *
 * Returns {predatorMesh, gliders, update(dt, t), setPredator(bool), getPredatorState(), dispose(), info}
 *
 * The predator's PATH is decorative. The one thing that is NOT decorative about it is the test for
 * whether it would trigger the modelled fish's escape: that geometry is taken from
 * sim-engine/scenarios/predator.mjs, which uses the looming threshold of McKee & McHenry 2020
 * (visual angle 14 deg, inside their measured 10.3-15.8 deg for adult zebrafish) and a predator
 * body width of 0.69 prey body lengths (their 2.5 cm model width over a 3.6 cm adult zebrafish,
 * Liu et al. 2026). getPredatorState() reports that angle and the threshold it is compared with,
 * so scene3d.js can trigger the escape on a sourced criterion instead of an invented distance.
 */
export function makeAmbient(o = {}) {
  const THREE = o.THREE;
  if (!THREE) throw new Error('makeAmbient needs THREE handed in by the host');
  const rng = o.rng || makeRng('ambient');
  const group = new THREE.Group();
  group.name = 'decorative-ambient';
  group.userData.decorative = true;
  group.userData.note = DECOR_NOTE;
  if (o.scene) o.scene.add(group);

  const geo = o.geometry || impostorGeometry(THREE);
  const owned = !o.geometry;

  // --- the predator: one fish, below the surface, on a slow decorative circuit ---------------
  const predMat = new THREE.MeshLambertMaterial({ color: o.predatorColour ?? 0x55646f, emissive: 0x11191f, side: THREE.DoubleSide });
  const predator = new THREE.Mesh(geo, predMat);
  predator.name = 'decorative-predator';
  predator.visible = false;
  predator.userData.decorative = true;
  predator.userData.note = DECOR_NOTE + ' A fish, below the surface. NOT a bird: there is no aerial predator in this scene and none may be added (Aves is the frozen holdout).';
  const PRED_SL_M = o.predatorSL_m ?? 0.35;                 // decorative size, not a species
  predator.scale.setScalar(PRED_SL_M / 0.82);
  group.add(predator);
  const circuit = { r: o.predatorRadius_m ?? 7, y: o.predatorDepth_m ?? -1.6, w: o.predatorRate ?? 0.22, phase: rng.uniform(0, Math.PI * 2) };
  let predOn = false, approach = 0;

  // --- distant gliders: a couple of flying fish far off, replaying one precomputed glide -----
  // Each glider replays a trajectory computed ONCE at mount from glideTrajectory (Section A's
  // solver) so the shape of the arc is not nonsense, then loops it with an offset. It is still
  // DECORATIVE: the position is a lookup into a cached path, nothing is integrated per frame, and
  // the fish, the spacing and the loop period are invented.
  const nG = Math.max(0, Math.min(o.gliders ?? 2, 8));
  const gliderMat = new THREE.MeshLambertMaterial({ color: o.gliderColour ?? 0xd8e7ef, emissive: 0x1b2d38, side: THREE.DoubleSide });
  const gliders = [];
  let path = null, pathLen = 0;
  if (nG > 0) {
    const gp = Object.assign({
      mass_kg: 0.06, ref_area_m2: 0.012688, span_m: 0.261, CL_max: 0.78, LD_max: 4.37,
      CD_min: 0.055, CL_at_zero_deg: 0.4, stall_alpha_deg: 35, glide_alpha_deg: 5,
      launch_airspeed_m_s: 17.5, launch_height_m: 1, launch_path_angle_deg: 6, headwind_m_s: 0,
    }, o.gliderParams || {});
    const tr = glideTrajectory(gp, { sample: 0.1, tmax: 20 });
    path = tr.pts; pathLen = tr.time_s;
    for (let i = 0; i < nG; i++) {
      const m = new THREE.Mesh(geo, gliderMat);
      m.name = 'decorative-distant-glider-' + i;
      m.scale.setScalar(0.203 / 0.82);                     // flying fish SL 0.203 m, manifest 0.82 units
      m.userData.decorative = true;
      m.userData.note = DECOR_NOTE + ' A distant FLYING FISH, not a bird.';
      group.add(m);
      gliders.push({
        mesh: m, t0: rng.uniform(0, pathLen || 1),
        z: rng.uniform(-70, 70) * (rng() < 0.5 ? 1 : -1) || 40,
        x0: rng.uniform(-60, 20), dir: rng() < 0.5 ? 1 : -1, period: (pathLen || 6) + rng.uniform(1.5, 4),
      });
    }
  }

  const _d = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0);

  function update(dt, t) {
    const tt = t == null ? (update._t = (update._t || 0) + dt) : t;
    if (predOn) {
      approach = Math.min(1, approach + dt * 0.25);
      const a = circuit.phase + tt * circuit.w;
      const r = circuit.r * (1 - 0.82 * approach);
      predator.position.set(Math.cos(a) * r, circuit.y, Math.sin(a) * r);
      _d.set(-Math.sin(a), 0, Math.cos(a));
      predator.quaternion.setFromUnitVectors(_X, _d);
    } else if (approach > 0) {
      approach = Math.max(0, approach - dt * 0.4);
      const a = circuit.phase + tt * circuit.w;
      predator.position.set(Math.cos(a) * circuit.r, circuit.y, Math.sin(a) * circuit.r);
    }
    predator.visible = predOn || approach > 0;
    if (path) {
      for (const g of gliders) {
        const u = ((tt + g.t0) % g.period) / g.period;
        const k = Math.min(path.length - 1, Math.floor(u * path.length));
        const p = path[k], pn = path[Math.min(path.length - 1, k + 1)];
        g.mesh.position.set(g.x0 + g.dir * p.x, Math.max(0.15, p.z), g.z);
        _d.set(g.dir * (pn.x - p.x), pn.z - p.z, 0);
        if (_d.lengthSq() > 1e-12) { _d.normalize(); g.mesh.quaternion.setFromUnitVectors(_X, _d); }
        g.mesh.visible = u < 0.94;
      }
    }
  }
  update(0, 0);

  // Sourced looming criterion, from predator.mjs. See the doc comment above.
  const LOOM = {
    theta_thresh_deg: 14, predator_width_SL: 0.69,
    source: 'sim-engine/scenarios/predator.mjs params: theta_thresh_deg 14 (McKee A, McHenry MJ 2020, Integr Org Biol 2:obaa023, doi:10.1093/iob/obaa023 -- best fits 10.3-15.8 deg in adult zebrafish, 14 deg used in their model sweep) and predator_width_SL 0.69 (their 2.5 cm model width over a 3.6 cm adult zebrafish, Liu et al. 2026). Both are labelled kind "assumed" in predator.mjs because they are the modelling values inside a measured range. The predator\'s PATH here is decorative; only this threshold is sourced.',
  };
  function getPredatorState(target, preySL_m) {
    const SL = preySL_m ?? o.preySL_m ?? 0.203;
    const tx = target ? target.x : 0, ty = target ? target.y : 0, tz = target ? target.z : 0;
    const dx = predator.position.x - tx, dy = predator.position.y - ty, dz = predator.position.z - tz;
    const d = Math.hypot(dx, dy, dz);
    const w = LOOM.predator_width_SL * SL;
    const theta = d > 0 ? 2 * Math.atan(w / (2 * d)) / DEG : 180;
    const dResp = w / (2 * Math.tan((LOOM.theta_thresh_deg / 2) * DEG));
    return {
      active: predOn, visible: predator.visible,
      position: { x: predator.position.x, y: predator.position.y, z: predator.position.z },
      distance_m: d, visual_angle_deg: theta,
      threshold_deg: LOOM.theta_thresh_deg, response_distance_m: dResp,
      triggers_escape: predOn && theta >= LOOM.theta_thresh_deg,
      source: LOOM.source,
      path_is_decorative: true,
    };
  }

  return {
    group, predatorMesh: predator, gliders, update,
    setPredator: on => { predOn = !!on; },
    getPredatorState,
    dispose() {
      if (o.scene) o.scene.remove(group);
      for (const g of gliders) g.mesh.geometry === geo || g.mesh.geometry.dispose();
      gliderMat.dispose(); predMat.dispose();
      if (owned) geo.dispose();
    },
    info: { gliders: nG, predator_SL_m: PRED_SL_M, decorative: true, note: DECOR_NOTE, looming: LOOM, no_birds: LEGEND.no_birds },
  };
}

/**
 * THE SINGLE INTERFACE scene3d.js CALLS.
 *
 *   const creatures = mountCreatures({THREE, scene, rng, conditions});
 *   // each frame:  creatures.update(dt, t);
 *   // predator on: creatures.setPredator(true);  then read creatures.getPredatorState()
 *   // teardown:    creatures.dispose();
 *
 * `rng` may be a seed string or a makeRng instance. The streams are FORKED by label, so the
 * decorative school can never shift a Section A ensemble drawn from the same seed.
 *
 * Returns {school, ambient, update, setPredator, getPredatorState, dispose, legend, info}.
 * The ensemble functions are separate named exports; they are not mounted into the scene.
 */
export function mountCreatures(o = {}) {
  const THREE = o.THREE;
  if (!THREE) throw new Error('mountCreatures needs THREE handed in by the host');
  const rng = typeof o.rng === 'function' ? o.rng : makeRng(o.rng ?? o.seed ?? 'delphi-v1');
  const conditions = o.conditions || {};

  const schoolOpts = Object.assign({
    THREE, scene: o.scene, rng: rng.fork('school'),
    species: o.schoolSpecies || 'zebrafish',
    count: o.schoolCount ?? 24,
    sizeMultiplier: o.schoolSizeMultiplier ?? 6,   // decorative: a 3.9 cm fish is invisible at scene scale
    bounds: o.schoolBounds,
  }, o.school || {});
  let school = makeSchool(schoolOpts);

  const ambient = makeAmbient(Object.assign({
    THREE, scene: o.scene, rng: rng.fork('ambient'), conditions,
    gliders: o.gliders ?? 2, preySL_m: o.preySL_m ?? 0.203,
  }, o.ambient || {}));

  let t = 0, predOn = false;
  const api = {
    ambient, legend: LEGEND,
    // `school` is a live property: update() always reads the CURRENT school. That matters because
    // a host that loads a GLB asynchronously wants to swap the impostor school for a real-mesh one
    // after mounting, and `useGeometry` below does it safely (the old one is disposed only after
    // the new one is in place, so no frame ever renders a disposed mesh).
    get school() { return school; },
    set school(s) { const old = school; school = s; if (old && old !== s) old.dispose(); if (predOn) s.setPredator(true); },
    /** Rebuild the school around a geometry loaded later (e.g. from a GLB), keeping the same seed.
     *  Pass the GLB's manifest so the metres scale comes from partedit.js metresPerUnit. */
    useGeometry(geometry, manifest, extra = {}) {
      api.school = makeSchool(Object.assign({}, schoolOpts, { geometry, manifest }, extra));
      return api.school;
    },
    update(dt, tt) {
      const h = Math.min(dt || 0, 0.05);
      t = tt == null ? t + h : tt;
      ambient.update(h, t);
      const p = ambient.predatorMesh.position;
      school.predatorAt(p.x, p.y, p.z);
      school.update(h);
    },
    setPredator(on) { predOn = !!on; school.setPredator(predOn); ambient.setPredator(predOn); },
    getPredatorState: (target, preySL_m) => ambient.getPredatorState(target, preySL_m),
    dispose() { school.dispose(); ambient.dispose(); },
    get info() { return { school: school.info, ambient: ambient.info, seed: rng.seed, decorative: true, note: DECOR_NOTE, no_birds: LEGEND.no_birds }; },
  };
  return api;
}

// ===========================================================================================
// THE UI LEGEND -- the exact wording that keeps A and B apart on screen
// ===========================================================================================

export const LEGEND = {
  ensemble: {
    badge: 'physics',
    title: 'Ensemble: the modelled fish, driven stochastically',
    body: 'The shaded band is the simulator run many times over, with the launch airspeed, take-off path angle, wave-induced launch height, sea-surface slope, gust, body mass, fin area and glide angle of attack each drawn from a stated distribution. The solid line is the median; the band is the 5th to 95th percentile; the dashed line is the old single deterministic run. Real flying fish do not repeat one trajectory, so one line was never the answer. Seeded: the same seed gives the same ensemble, and the seed is in the URL.',
    caveat: UNCERTAINTY_NOTE,
  },
  ambient: {
    badge: 'decorative',
    title: 'Ambient creatures: decorative',
    body: 'The school below the surface, the predator and the distant gliding fish are DECORATIVE. Their motion is invented scene dressing (boids flocking, a slow circuit, a looped arc). They are not evidence, they feed no metric, and nothing about them may be cited. The one sourced part is the test for whether the predator would trigger the modelled fish\'s escape: that uses the looming threshold from sim-engine/scenarios/predator.mjs (McKee & McHenry 2020, 14 deg visual angle). The predator\'s path itself is not sourced.',
  },
  no_birds: 'No birds anywhere in this scene. Aves is the DELPHI frozen holdout, and no bird flight data have been used in any physics module in this repository (glide.mjs and predator.mjs both say so). There are no seabirds in the sky and no aerial predator; the only aerial creatures are flying fish. Do not add one.',
};

/** The legend as a small HTML block the host can inject. Classes only, no inline style, so the
 *  page's own theme tokens apply. */
export function legendHtml() {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sec = l => `<div class="creature-legend-item"><p><span class="chip">${esc(l.badge)}</span> <b>${esc(l.title)}</b></p><p class="small">${esc(l.body)}</p>${l.caveat ? `<p class="small mute">${esc(l.caveat)}</p>` : ''}${l.scope ? `<ul class="small mute">${l.scope.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  return `<div class="creature-legend">${sec(LEGEND.ensemble)}${sec(LEGEND.ambient)}<p class="small mute">${esc(LEGEND.no_birds)}</p></div>`;
}
