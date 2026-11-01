// Seeded ensemble over the STATED input distributions, run through the REAL engine scenarios.
//
// WHY AN ENSEMBLE AT ALL. A design that achieves its function in 8 % of draws has not achieved it.
// The inputs have a spread (the launch speed is a 15-20 m/s band, the launch height moves with the
// sea surface, specimen mass and fin area vary between individuals), so a bare yes/no from the
// midpoint is a claim the inputs do not support. Every criterion therefore reports the FRACTION of
// draws in which the function is achieved, with the median and the 5-95 % band of the metric.
//
// WHERE THE DISTRIBUTIONS COME FROM. The physics thread's browser module
// `dashboard/public/t/physics/sim/creatures.js` owns the catalogue (`DISTRIBUTIONS`), the seeded PRNG
// (`makeRng`), the per-draw draw (`perturbRun`) and the percentiles (`summarise`), each entry carrying
// the provenance of its SPREAD (`band_kind`) apart from the provenance of its SHAPE (`shape_kind`).
// We CONSUME that module; we do not copy it. If it is absent, `OWN_DISTRIBUTIONS` below implements the
// same stated distributions from the same sources and every result says `source: "own"` so a reader
// knows which ran.
//
// WHAT IS PERTURBED, AND WHAT IS NOT. creatures.js draws parameters for ITS OWN solver (the
// simulator's glide-phase integration). We do not use that solver: we take its DRAWS and push them
// through the engine's own scenario modules, so the physics stays the engine's and only the inputs
// move. The draws arrive in Park & Choi's reference-area convention (pectoral + pelvic + body
// planform) while STATE's `lifting_area_m2` is pectoral + pelvic + caudal, so the drawn area and span
// are applied as FACTORS on STATE, never as absolute values: that transfers the measured spread
// without silently changing the area convention. Mass is applied the same way.
//
// A spread computed from assumed distributions is an UNCERTAINTY ILLUSTRATION, not a measured
// distribution of real glides; creatures.js's own UNCERTAINTY_NOTE says so and is carried through.
import path from 'node:path';
import url from 'node:url';

export const CREATURES_PATH = path.resolve(import.meta.dirname, '..', '..', '..', 'dashboard', 'public', 't', 'physics', 'sim', 'creatures.js');

let _mod;
/** Load the physics thread's ensemble module, or report plainly that it has not landed. Never throws. */
export async function loadCreatures(file = CREATURES_PATH) {
  if (_mod !== undefined) return _mod;
  try {
    const m = await import(url.pathToFileURL(file).href);
    const need = ['makeRng', 'perturbRun', 'DISTRIBUTIONS', 'summarise', 'isFlier'];
    const missing = need.filter(k => !(k in m));
    _mod = missing.length
      ? { ok: false, reason: `${file} exists but exports no ${missing.join(', ')}; the ensemble was implemented here instead` }
      : { ok: true, m, file: 'dashboard/public/t/physics/sim/creatures.js' };
  } catch (e) {
    _mod = { ok: false, reason: `dashboard/public/t/physics/sim/creatures.js did not load (${e.message}); the ensemble was implemented here against the same stated distributions` };
  }
  return _mod;
}
/** For tests: force the absent-module path, or forget the cache. */
export function setCreatures(v) { _mod = v; }

// ---------------------------------------------------------------- our own copy of the same distributions
// Used ONLY when creatures.js has not landed. Same numbers, same sources, same two provenance kinds.
const PARK_CHOI_REF_AREAS_M2 = [0.013049, 0.013243, 0.012688]; // L1, L2, L3, Park & Choi 2010 Table 1
const refAreaCv = (() => { const a = PARK_CHOI_REF_AREAS_M2, n = a.length, mu = a.reduce((s, x) => s + x, 0) / n;
  return Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1)) / mu; })();
const MASS_CV = 19.8 / 227.7;
export const OWN_SEA_STATE = { Hs_m: 1.0, wavelength_m: 30, kind: 'assumed',
  source: 'NO sea state exists anywhere in this repository; Hs 1.0 m and wavelength 30 m are a modelling choice. scenarios/wind.mjs states that wave-induced updrafts are not modelled.' };

export const OWN_DISTRIBUTIONS = [
  { key: 'launch_airspeed_m_s', label: 'Launch (take-off) airspeed', unit: 'm/s', shape: 'uniform', band: [15, 20],
    band_kind: 'measured-secondhand', shape_kind: 'assumed', applies: 'adult flying fish and flying-fish-derived designed fliers only',
    source: 'Band 15-20 m/s quoted from Davenport 1994 in two fetched sources (Deng et al. 2019 bioRxiv 10.1101/765560 Introduction; Makiguchi et al. 2013 doi:10.3354/ab00494 Introduction). The BAND is measured-secondhand; the UNIFORM SHAPE inside it is assumed. scenarios/glide.mjs takes 15, the band\'s LOWER end, so the engine\'s single number is this ensemble\'s lower edge, not its median.',
    skip_reason: 'no measured launch-speed spread exists for this animal: glide.mjs gives a sourced launch speed only to flying fish (taxi band) and zebrafish (Umax = 1.15 Ucrit, a point value with no published spread), and none is invented' },
  { key: 'surface_elevation_m', label: 'Wave-induced launch height', unit: 'm', shape: 'normal', band_kind: 'assumed', shape_kind: 'assumed',
    source: 'sigma = Hs/4, the definition of significant wave height for a narrow-band Gaussian sea; Hs itself is ASSUMED (1.0 m). Added to the launch height, floored at 0.05 m.' },
  { key: 'wind_along_path_m_s', label: 'Gust along the flight path (positive = headwind)', unit: 'm/s', shape: 'normal', band_kind: 'assumed', shape_kind: 'assumed',
    source: 'sd = half the gust amplitude; gust +/-2 m/s is scenarios/wind.mjs\'s own assumed design input. Assumed on assumed.' },
  { key: 'mass_kg', label: 'Body mass (specimen-to-specimen)', unit: 'kg', shape: 'lognormal-cv', cv: MASS_CV, band_kind: 'borrowed', shape_kind: 'assumed',
    source: `CV ${(MASS_CV * 100).toFixed(2)} % = 19.8/227.7 g, MEASURED on 13 Cheilopogon heterurus doederleini (Makiguchi 2013 Table 1); applying it to any other body is BORROWED.` },
  { key: 'ref_area_m2', label: 'Lifting area (specimen-to-specimen)', unit: 'm2', shape: 'lognormal-cv', cv: refAreaCv, band_kind: 'measured', shape_kind: 'assumed',
    source: `CV ${(refAreaCv * 100).toFixed(2)} %, MEASURED on three Park & Choi 2010 specimens (L1, L2, L3 reference areas ${PARK_CHOI_REF_AREAS_M2.join(', ')} m2). n = 3 stuffed museum specimens of one species. Span is scaled by sqrt(the area factor) so the aspect ratio holds.` },
];
const FF_RE = /exocoet|flying ?fish|cypselurus|hirundichthys|cheilopogon|\bflier\b|\btff\b/i;

// cyrb128 + sfc32, the same pair creatures.js uses, so our fallback is reproducible in the same way.
function ownRng(seed) {
  const s = String(seed); let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < s.length; i++) { k = s.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179); }
  let a = Math.imul(h3 ^ (h1 >>> 18), 597399067) >>> 0, b = Math.imul(h4 ^ (h2 >>> 22), 2869860233) >>> 0;
  let c = Math.imul(h1 ^ (h3 >>> 17), 951274213) >>> 0, d = Math.imul(h2 ^ (h4 >>> 19), 2716044179) >>> 0;
  let spare = null;
  const r = () => { a |= 0; b |= 0; c |= 0; d |= 0; const t = (((a + b) | 0) + d) | 0; d = (d + 1) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0; return (t >>> 0) / 4294967296; };
  r.uniform = (lo, hi) => lo + (hi - lo) * r();
  r.normal = (mu = 0, sd = 1) => { if (spare != null) { const v = spare; spare = null; return mu + sd * v; }
    const u = Math.max(r(), 1e-12), v = r(), m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v); return mu + sd * m * Math.cos(2 * Math.PI * v); };
  return r;
}
export function ownSummarise(values) {
  const v = values.filter(x => typeof x === 'number' && Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0, median: null, p5: null, p95: null, min: null, max: null, mean: null };
  const q = p => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo); };
  return { n, median: q(0.5), p5: q(0.05), p95: q(0.95), min: v[0], max: v[n - 1], mean: v.reduce((s, x) => s + x, 0) / n };
}
function ownPerturb(baseParams, rng) {
  const draw = {}, skipped = [];
  const flier = FF_RE.test([baseParams.species, baseParams.id, baseParams.label].filter(Boolean).join(' '));
  for (const d of OWN_DISTRIBUTIONS) {
    if (d.key === 'launch_airspeed_m_s') {
      if (!flier) { draw[d.key] = { value: baseParams.launch_airspeed_m_s ?? 0, skipped: true, reason: d.skip_reason }; skipped.push(d.key); continue; }
      draw[d.key] = { value: rng.uniform(d.band[0], d.band[1]), base: baseParams.launch_airspeed_m_s ?? 0, distribution: d.key, shape: d.shape, band_kind: d.band_kind, shape_kind: d.shape_kind }; continue;
    }
    if (d.key === 'surface_elevation_m') { draw[d.key] = { value: rng.normal(0, OWN_SEA_STATE.Hs_m / 4), base: 0, distribution: d.key, shape: d.shape, band_kind: d.band_kind, shape_kind: d.shape_kind }; continue; }
    if (d.key === 'wind_along_path_m_s') { draw[d.key] = { value: rng.normal(0, 1), base: 0, distribution: d.key, shape: d.shape, band_kind: d.band_kind, shape_kind: d.shape_kind }; continue; }
    const base = baseParams[d.key] ?? 0;
    const sigma = Math.sqrt(Math.log(1 + d.cv ** 2));
    draw[d.key] = { value: base * Math.exp(rng.normal(0, sigma)), base, distribution: d.key, shape: d.shape, band_kind: d.band_kind, shape_kind: d.shape_kind };
  }
  const params = { ...baseParams };
  params.mass_kg = draw.mass_kg.value;
  const f = baseParams.ref_area_m2 > 0 ? draw.ref_area_m2.value / baseParams.ref_area_m2 : 1;
  params.ref_area_m2 = draw.ref_area_m2.value;
  if (baseParams.span_m != null) params.span_m = baseParams.span_m * Math.sqrt(f);
  params.launch_airspeed_m_s = draw.launch_airspeed_m_s.value;
  params.launch_height_m = Math.max(0.05, (baseParams.launch_height_m ?? 1) + draw.surface_elevation_m.value);
  params.headwind_m_s = draw.wind_along_path_m_s.value;
  return { params, draw, skipped };
}

export const OWN_NOTE = 'A spread computed from assumed distributions is an UNCERTAINTY ILLUSTRATION, not a measured distribution of real glides. No one has published a distribution of flying-fish glide ranges and this ensemble is not one. The launch-speed BAND is measured-secondhand and its uniform shape is ours; the lifting-area spread is measured on three stuffed specimens of one species; the mass CV is measured on a different genus and borrowed; the entire sea state and the gust sd are assumed. Mass and area are drawn independently because no source here gives their correlation, so the wing-loading spread is WIDER than a real population\'s.';

/** Base parameters for the draw, read out of the engine's resolved STATE. */
export function baseParamsFromState(state, { launch_height_m = 1, launch_airspeed_m_s = null } = {}) {
  const v = k => (state?.[k]?.value ?? null);
  const lift = v('lifting_area_m2') ?? (v('pectoral_area_both_m2') != null ? v('pectoral_area_both_m2') * (0.012688 / 0.006377) : null);
  return {
    species: v('species'), id: state?.design_id?.value ?? null, label: v('species'),
    mass_kg: v('mass_kg'), ref_area_m2: lift, span_m: v('pectoral_span_m'),
    launch_height_m, launch_airspeed_m_s: launch_airspeed_m_s ?? 0,
  };
}

/**
 * The seeded ensemble.
 *   runOne(stateForDraw, scenarioParams, drawRecord) -> any      the caller runs the REAL scenario
 *   stateFor(state, params) is applied here: the drawn mass / area / span are written back into a
 *   shallow copy of STATE as `assumed` fields naming the distribution they came from, so a drawn
 *   number can never be mistaken for the measured one it replaced.
 *
 * Returns { source, file, seed, draws, distributions, note, species_gate, skipped, rows }.
 */
export async function ensembleOverState({ state, draws = 200, seed = 'delphi-v1', launch_height_m = 1, launch_airspeed_m_s = null, runOne }) {
  const c = await loadCreatures();
  const base = baseParamsFromState(state, { launch_height_m, launch_airspeed_m_s });
  const using = c.ok
    ? { perturb: (p, r) => c.m.perturbRun(p, r, { distributions: c.m.DISTRIBUTIONS }), rng: c.m.makeRng(String(seed)).fork('ensemble'),
        dists: c.m.DISTRIBUTIONS, note: c.m.UNCERTAINTY_NOTE, isFlier: c.m.isFlier, summarise: c.m.summarise,
        source: 'creatures.js', file: c.file, sea: c.m.SEA_STATE }
    : { perturb: ownPerturb, rng: ownRng(`${seed}:ensemble`), dists: OWN_DISTRIBUTIONS, note: OWN_NOTE,
        isFlier: p => FF_RE.test([p.species, p.id, p.label].filter(Boolean).join(' ')), summarise: ownSummarise,
        source: 'own', file: 'sim-engine/validate/physics/ensemble.mjs OWN_DISTRIBUTIONS', sea: OWN_SEA_STATE, reason: c.reason };

  const rows = []; let skipped = [];
  for (let i = 0; i < draws; i++) {
    const { params, draw, skipped: sk } = using.perturb(base, using.rng);
    skipped = sk || [];
    const pv = k => { const x = params[k]; return x && typeof x === 'object' && 'value' in x ? x.value : x; };
    const drawnMass = pv('mass_kg'), drawnArea = pv('ref_area_m2'), drawnSpan = pv('span_m');
    const st = { ...state };
    const F = (f, value, dist) => (f && typeof f === 'object'
      ? { ...f, value, kind: 'assumed', source: `DRAWN from the "${dist}" distribution (${using.source === 'creatures.js' ? 'creatures.js DISTRIBUTIONS' : 'validate/physics OWN_DISTRIBUTIONS'}); replaced ${f.source || f.kind}` }
      : { value, unit: null, kind: 'assumed', source: `DRAWN from "${dist}"` });
    if (drawnMass != null && base.mass_kg) st.mass_kg = F(state.mass_kg, drawnMass, 'mass_kg');
    if (drawnArea != null && base.ref_area_m2) {
      const f = drawnArea / base.ref_area_m2;
      if (state.lifting_area_m2?.value != null) st.lifting_area_m2 = F(state.lifting_area_m2, state.lifting_area_m2.value * f, 'ref_area_m2 (applied as a FACTOR: the draw is in Park & Choi\'s pectoral+pelvic+planform convention, STATE is pectoral+pelvic+caudal)');
      if (state.pectoral_area_both_m2?.value != null) st.pectoral_area_both_m2 = F(state.pectoral_area_both_m2, state.pectoral_area_both_m2.value * f, 'ref_area_m2 factor');
    }
    if (drawnSpan != null && base.span_m) st.pectoral_span_m = F(state.pectoral_span_m, state.pectoral_span_m.value * (drawnSpan / base.span_m), 'ref_area_m2 span = sqrt(area factor)');
    const scenarioParams = { launch_height_m: pv('launch_height_m') ?? launch_height_m, headwind_m_s: pv('headwind_m_s') ?? 0,
      launch_airspeed_override_m_s: (draw.launch_airspeed_m_s && !draw.launch_airspeed_m_s.skipped) ? pv('launch_airspeed_m_s') : 0 };
    rows.push({ i, draw, state: st, params: scenarioParams, result: runOne ? runOne(st, scenarioParams, draw) : null });
  }
  return {
    source: using.source, file: using.file, ...(using.reason ? { fell_back_because: using.reason } : {}),
    seed: String(seed), draws, species_gate: { is_flier: using.isFlier(base), note: using.isFlier(base) ? 'the 15-20 m/s taxi band applies to this animal' : 'the 15-20 m/s taxi band does NOT apply: no sourced launch-speed spread for this animal, so the launch speed is NOT drawn and stays at the engine\'s own value. The spread below therefore comes only from mass, area and the wave terms.' },
    not_drawn: skipped, note: using.note, sea_state: using.sea,
    distributions: using.dists.map(d => ({ key: d.key, label: d.label, unit: d.unit, shape: d.shape, band: d.band ?? null, sd: d.sd ?? null, cv: d.cv ?? null, band_kind: d.band_kind, shape_kind: d.shape_kind, applies: d.applies || 'all animals', source: d.source })),
    summarise: using.summarise, rows,
  };
}
