// The standing physical checks: the things that have to hold for ANY design of this organism, whether
// or not the spec asked about them.
//
// Each one is a NAMED check with its own status, its own measured value, its own threshold, its own
// limiting factor and its own model_confidence. None of them is folded into a single number, because
// a single number hides which law the design broke.
//
//   reaches_minimum_flight_speed   can it get to its own v_min = sqrt(2W/(rho S C_Lmax))?
//   lifting_area_supports_mass     does the lifting area it HAS carry the weight at the speed it can
//                                  reach?  (the same inequality read as an area, so the shortfall is
//                                  reported in m2 rather than m/s)
//   sustained_swimming_aerobic     does rigid-body drag power at the test current fit inside the whole
//                                  red-muscle aerobic power?
//   organ_volume_fits_body         does the requested organ volume fit inside the skin?  (the flight
//                                  muscle, the only organ the meshes clip)
//   static_pitch_margin            is it stable in pitch?  REPORTED AS `no model`: see below.
//
// WHY static_pitch_margin IS `no model` AND NOT A NUMBER. The print work did measure a static margin,
// from the quarter-chord of the pectoral planform's mean aerodynamic chord (anatomy-model/print/
// balance_1to1.py). That calculation needs three quantities: the snout coordinate, the pectoral
// PLANFORM AREA CENTROID, and the CENTRE OF MASS. The engine has none of them. STATE carries areas and
// a span but no longitudinal positions; the mesh manifests carry a per-object `centre_gltf`, which is
// an object centre, not an area centroid and not a centre of mass. Building a margin out of
// `centre_gltf` and a guessed snout gives about -43 % MAC for the adult flying fish, against the
// -7.7 % the print script MEASURED on a real 1:1 flying-fish mesh: a factor of five on the one instance
// we can check. So the geometry does NOT allow it, the check reports `no model`, and the measured print
// values are quoted as what they are -- measurements of a printed object, not of the designed organism.
import fs from 'node:fs';
import path from 'node:path';
import { modelConfidence, SIM_ROOT } from './provenance.mjs';

const ROOT = path.resolve(SIM_ROOT, '..');
const val = (s, k) => (s?.[k]?.value ?? null);
const num = x => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const mval = (run, key) => { const m = run?.metrics?.find(x => x.key === key); return m ? num(m.value) : null; };

/** Measured static margins that DO exist in this repository, and what they are measurements of. */
export const PRINT_STATIC_MARGINS = {
  source: 'anatomy-model/print/manifest.json (balance_1to1.py / ff_solid_ballast.py), measured on the shipped print meshes',
  rows: [
    { object: '1:1 solid glider, empty as printed', static_margin_fraction_of_MAC: -0.0767, note: 'CG aft of the estimated neutral point: unstable by this first-order estimate' },
    { object: '1:1 solid glider + 2.5 mm steel rod x 9 mm', static_margin_fraction_of_MAC: 0.1093, note: 'stable; ballast costs about 0.85 m/s in v_min' },
    { object: '1:1 solid glider + M2.5 x 8 mm grub screw', static_margin_fraction_of_MAC: 0.0702, note: 'stable' },
    { object: 'whole-body 0.35-fin design, first-order', static_margin_fraction_of_MAC: -0.0557, note: 'MAC 12.444 mm, neutral point 0.431 SL, CG 0.4489 SL, area centroid 0.5112 SL at SL 38.8 mm' },
  ],
  caveat: 'FIRST-ORDER, FLAT-PLATE, PECTORAL-FINS-ONLY. It ignores the body, the median fins, the caudal fin, downwash, sweep and dihedral. No wind tunnel, no CFD, no free flight. anatomy-model/print/README.md: "It tells you the stability question is live. It does not tell you the answer."',
};

const CHECK = (id, label, o) => ({ id, label, status: 'no model', measured: null, unit: null, threshold: null, op: null, limiting_factor: null, gating: false, ...o });

/**
 * Run the standing checks.
 *   state       the resolved STATE at this stage
 *   runs        { glide, current }  real scenario results (runScenario output), or null
 *   scenarios   { glide, current }  the scenario modules, for model_confidence
 *   doc,bundle  for the mesh manifest (organ fit)
 */
export function standingChecks({ state, runs = {}, scenarios = {}, doc = null, bundle = null, flightMuscleFit = null } = {}) {
  const out = [];
  const g = runs.glide, c = runs.current;
  const gs = scenarios.glide || null, cs = scenarios.current || null;

  // ---- 1. can it reach its own minimum flight speed?
  {
    const v0 = mval(g, 'launch_airspeed_m_s'), vmin = mval(g, 'v_min_m_s'), margin = mval(g, 'launch_speed_margin_m_s');
    const mc = modelConfidence({ scenario: gs, run: g, metricKey: 'glide_range_total_m' });
    if (!g || g.ok === false) out.push(CHECK('reaches_minimum_flight_speed', 'Reaches its own minimum lift-supported airspeed', {
      limiting_factor: g?.error || 'the glide scenario did not run on this STATE', model_confidence: mc }));
    else if (v0 == null || vmin == null) out.push(CHECK('reaches_minimum_flight_speed', 'Reaches its own minimum lift-supported airspeed', {
      measured: null, unit: 'm/s', threshold: vmin, op: '>=',
      limiting_factor: v0 == null ? `no sourced leap or burst speed for this organism, so the question is not answerable from measurement: ${g.feasibility_note || 'launch speed null'}` : 'v_min not computable',
      model_confidence: mc }));
    else out.push(CHECK('reaches_minimum_flight_speed', 'Reaches its own minimum lift-supported airspeed', {
      status: margin >= 0 ? 'met' : 'not met', measured: v0, unit: 'm/s', threshold: vmin, op: '>=',
      limiting_factor: margin >= 0 ? null : `reachable launch speed ${v0.toFixed(2)} m/s is ${(vmin - v0).toFixed(2)} m/s below v_min ${vmin.toFixed(2)} m/s: lift cannot carry the weight`,
      detail: { launch_speed_margin_m_s: margin }, model_confidence: mc }));
  }

  // ---- 2. does the lifting area it has support its mass at the speed it can reach?
  {
    const v0 = mval(g, 'launch_airspeed_m_s'), WL = mval(g, 'wing_loading_N_m2');
    const S = val(state, 'lifting_area_m2') ?? (val(state, 'pectoral_area_both_m2') != null ? val(state, 'pectoral_area_both_m2') * (0.012688 / 0.006377) : null);
    const m = val(state, 'mass_kg');
    const rho = state?.ambient?.air_density_kg_m3?.value ?? 1.225;
    const CLmax = 0.78; // Park & Choi 2010 Table 2, stuffed Cypselurus hiraii at alpha 35 deg
    const mc = modelConfidence({ scenario: gs, run: g, metricKey: 'glide_range_total_m',
      extra: { assumed_inputs: ['C_Lmax 0.78 is measured on a stuffed Cypselurus hiraii in a wind tunnel; using it for any other body is borrowed'] } });
    if (v0 == null || S == null || m == null || !(v0 > 0)) out.push(CHECK('lifting_area_supports_mass', 'Lifting area supports the mass at the reachable launch speed', {
      unit: 'm2', limiting_factor: v0 == null || !(v0 > 0) ? 'no sourced launch speed for this organism: the required area is undefined' : 'mass or lifting area is null in STATE', model_confidence: mc }));
    else {
      const Sreq = (2 * m * 9.81) / (rho * v0 * v0 * CLmax);
      out.push(CHECK('lifting_area_supports_mass', 'Lifting area supports the mass at the reachable launch speed', {
        status: S >= Sreq ? 'met' : 'not met', measured: S, unit: 'm2', threshold: Sreq, op: '>=',
        limiting_factor: S >= Sreq ? null : `the lifting area is ${(Sreq / S).toFixed(2)}x too small: ${(S * 1e4).toFixed(2)} cm2 against ${(Sreq * 1e4).toFixed(2)} cm2 needed to carry ${(m * 9.81).toFixed(3)} N at ${v0.toFixed(2)} m/s`,
        detail: { wing_loading_N_m2: WL, wing_loading_limit_N_m2: 0.5 * rho * v0 * v0 * CLmax, area_convention: 'STATE lifting_area_m2 is pectoral + pelvic + caudal (mesh); Park & Choi refer their coefficients to pectoral + pelvic + body planform. The conventions differ and this check does not correct for it.' },
        model_confidence: mc }));
    }
  }

  // ---- 3. does drag power fit the aerobic ceiling for sustained swimming?
  {
    const P = mval(c, 'drag_power_at_current_W'), Pred = mval(c, 'red_muscle_power_W'), bound = mval(c, 'ucrit_upper_bound_m_s');
    const mc = modelConfidence({ scenario: cs, run: c, metricKey: 'ucrit_bl_s',
      extra: { assumed_inputs: ['the myotomal muscle fraction is assumed; red-muscle mass-specific power 134 W/kg is scup red muscle, borrowed', 'drag is a rigid flat-plate LOWER bound, so the true power demand is higher and the margin reported here is optimistic'] } });
    if (!c || c.ok === false || P == null || Pred == null) out.push(CHECK('sustained_swimming_aerobic_ceiling', 'Drag power at the test current fits inside the red-muscle aerobic ceiling', {
      unit: 'W', limiting_factor: c?.error || (P == null ? 'drag power not computable (wetted area or SL null in STATE)' : 'red-muscle power not computable (red_muscle_fraction null in STATE)'), model_confidence: mc }));
    else out.push(CHECK('sustained_swimming_aerobic_ceiling', 'Drag power at the test current fits inside the red-muscle aerobic ceiling', {
      status: P <= Pred ? 'met' : 'not met', measured: P, unit: 'W', threshold: Pred, op: '<=',
      limiting_factor: P <= Pred ? null : `rigid-body drag power ${P.toExponential(3)} W already exceeds the whole red-muscle aerobic power ${Pred.toExponential(3)} W at this current`,
      detail: { current_m_s: c.params?.current_m_s ?? null, headroom_factor: P > 0 ? Pred / P : null, ucrit_upper_bound_m_s: bound, feasible: c.feasible, feasibility_note: c.feasibility_note ?? null },
      model_confidence: mc }));
  }

  // ---- 4. does the organ volume fit the body?
  out.push(organFitCheck({ state, doc, bundle, flightMuscleFit }));

  // ---- 5. stability
  out.push(CHECK('static_pitch_margin', 'Statically stable in pitch (static margin from the pectoral MAC quarter-chord)', {
    status: 'no model',
    limiting_factor: 'the engine has no geometry for it: STATE carries areas and a span but no longitudinal positions, and the mesh manifests carry only a per-object centre, which is neither a planform AREA CENTROID nor a CENTRE OF MASS. Estimating the margin from that object centre gives about -43 % MAC for the adult flying fish against the -7.7 % MEASURED by anatomy-model/print/balance_1to1.py on a real 1:1 flying-fish mesh, a factor of five on the one instance available, so no number is reported here.',
    detail: { measured_elsewhere: PRINT_STATIC_MARGINS, what_would_be_needed: ['snout x', 'pectoral planform area centroid x', 'centre of mass x', 'mean aerodynamic chord (not the mean chord)'] },
    model_confidence: modelConfidence({ extra: { statement: 'No model. The only static margins in this repository are first-order estimates measured on PRINT meshes (anatomy-model/print), not on the designed organism, and the print README says in so many words that they tell you the stability question is live, not the answer. Nothing here has been in a wind tunnel, a CFD run or a free flight.' } }),
  }));

  return out;
}

/** Flight-muscle volume vs what fits inside the skin. The mesh's own clipped fraction when the design
 *  IS one of the built meshes; otherwise the analytic capacity transfer from validate/sanity.mjs. */
export function organFitCheck({ state, doc, bundle, flightMuscleFit = null }) {
  const P = state?._meta?.parameters || {};
  const pv = k => num(P[k]?.value);
  const raw = { flight_muscle_fraction: pv('flight_muscle_fraction'), mass_kg: val(state, 'mass_kg'), SL_m: val(state, 'SL_m'),
    depth_SL: pv('body_depth_over_SL'), width_SL: pv('body_width_over_SL') };
  // The mesh-measured clip, when a manifest for this organism exists and the design is unedited in the
  // parameters the muscle is sized from. An edited design gets the analytic estimate instead, labelled.
  let mesh = null, meshFile = null;
  const parents = doc?.base?.parents || [];
  const dom = parents.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0]?.organism || null;
  const mf = dom && bundle?.organisms?.[dom]?.manifest;
  if (mf && bundle.manifests?.[mf]) { mesh = num(bundle.manifests[mf].derived_from_the_mesh?.flight_muscle_fit_fraction); meshFile = mf; }
  const edited = (doc?.edits || []).length > 0;
  const analytic = flightMuscleFit ? flightMuscleFit(raw) : null;
  const mc = modelConfidence({ extra: {
    model: mesh != null && !edited ? `mesh clip measured on dashboard/public/blueprint3d/model/${meshFile} (derived_from_the_mesh.flight_muscle_fit_fraction)` : 'validate/sanity.mjs FLIGHT_MUSCLE_CAPACITY, an analytic capacity per body envelope transferred from the two meshes in which the requested muscle did NOT fit',
    assumed_inputs: [`flight_muscle_fraction ${raw.flight_muscle_fraction ?? '?'} is kind \`assumed\` in STATE (no fish value exists; the TFF's 0.16 is above the bat mean 0.0913)`,
      ...(mesh == null || edited ? ['the capacity per body envelope is transferred from two clipped meshes: an ASSUMED transfer'] : []),
      'the mesh geometry is schematic, so "fits inside the skin" is a statement about a generated shell, not about an animal'],
    statement: 'Unvalidated: no dissection, no measured pectoral-girdle muscle volume for any flying fish. The mesh clip is a fact about the generated mesh.' } });

  if (mesh == null && !analytic) return CHECK('organ_volume_fits_body', 'Requested organ volume fits inside the body (flight muscle)', {
    limiting_factor: 'needs flight_muscle_fraction, mass, SL, body depth/SL and width/SL, or a mesh manifest for this organism', model_confidence: mc });
  const use = mesh != null && !edited ? mesh : (analytic ? analytic.fit : mesh);
  const basis = mesh != null && !edited ? `mesh clip (${meshFile})` : 'analytic capacity transfer (validate/sanity.mjs)';
  return CHECK('organ_volume_fits_body', 'Requested organ volume fits inside the body (flight muscle)', {
    status: use >= 0.95 ? 'met' : 'not met', measured: use, unit: 'fraction of the requested volume', threshold: 0.95, op: '>=',
    limiting_factor: use >= 0.95 ? null : `only ${(use * 100).toFixed(1)} % of the requested flight-muscle volume fits inside the skin (${basis}); the remaining ${((1 - use) * 100).toFixed(1)} % has nowhere to go, so any power claim that charges the full muscle mass is unphysical`,
    detail: { basis, mesh_fit_fraction: mesh, analytic_fit: analytic ? analytic.fit : null, analytic_range: analytic ? analytic.fit_range : null, inputs: raw, design_is_edited: edited },
    model_confidence: mc });
}

/** Read a raw mesh manifest from disk (the bundle strips per-object geometry). Read-only. */
export function rawManifest(file) {
  const p = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'model', file);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
