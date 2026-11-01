// glide.mjs: gliding from a launch height and airspeed in still air, and the aerobic (Fick) bound on
// powered level flight. Pure ESM, no imports. Reuses the physics thread's model unchanged:
//   W = m g; v_min = sqrt(2 W / (rho S C_Lmax)); range <= h (L/D)max; P_req = W v_min / (L/D)max
//   (physics/analysis.py, physics/results.json interpretations B and C), the Park & Choi 2010 polar
//   (C_Lmax 0.78, (L/D)max 4.37) and the measured ground effect (physics/ground-effect.json).
// The exported helpers are reused by altitude.mjs and wind.mjs. No bird data anywhere.
import { zebrafishUcrit28 } from './current.mjs';
import { ucritRel } from './temperature.mjs';

export const G = 9.81; // m/s2, standard gravity (conventional 9.80665) rounded as in physics/results.json

export const PARK_CHOI = {
  cite: 'Park H, Choi H (2010). Aerodynamic characteristics of flying fish in gliding flight. J Exp Biol 213:3269-3279',
  doi: 'https://doi.org/10.1242/jeb.046052',
  CL_max: 0.78, // Table 2, alpha 35 deg, stuffed Cypselurus hiraii, 12 m/s wind tunnel
  LD_max: 4.37, // Table 2, alpha 0 deg
  // C_L at 0 deg: Park & Choi (Results, Fig. 4 text) measured the lift at 0 deg and found it 'nearly same' as the body
  // weight for models L1 and L3, so C_L(0) = m g / (0.5 rho U^2 S) = 0.06 x 9.81 / (0.5 x 1.225 x 12^2 x 0.012688) = 0.53
  // (0.49-0.57 with mass rounded to 0.01 kg). Replaces the 0.4 ASSUMED in the simulator's params.json. Sets only v_LD.
  CL_at_zero_deg: 0.53,
  L3: { mass_kg: 0.06, ref_area_m2: 0.012688, span_m: 0.261, pectoral_area_m2: 0.006377 },
};
// Pectoral -> total lifting area transfer used by the flight simulator (NOTES-FOR-HUB.md item 3): the one
// specimen's ratio 0.012688 / 0.006377. Applying it to any other animal is an ASSUMED transfer.
export const LIFT_OVER_PECTORAL = 0.012688 / 0.006377;

// Fick aerobic bound; constants as in physics/flier/tff/design.py and the physiology chain.
export const FICK = {
  eta: { value: 0.15, kind: 'borrowed', source: 'gamperl2021 via physiology/muscle.js: ventricular muscle efficiency ~15% in Atlantic salmon (no fetched value for fish skeletal muscle)' },
  E_J_per_ml: { value: 13.54 / 0.7, kind: 'measured-secondhand', source: 'oxycalorific 13.54 J/mg O2 (gerry2014, quoting its ref. 89; measured-secondhand) / 0.7 mg O2 per ml (STPD; a standard unit conversion) = 19.34 J/ml; physiology/muscle.js' },
  Qmax_ml_min_kg: { value: 58.48, kind: 'borrowed', source: 'durnford2026 Table 1 (schoolmaster snapper, Ucrit group, 28 degC) maximum cardiac output 58.48 ml/min/kg (physiology/cardiac.js), x body mass. Lean C14 and physics/flier/tff/design.py use 0.0656 ml/s for 0.06 kg (65.6 ml/min/kg) instead' },
  hb_cap_ml_ml: { value: 0.206, kind: 'calibrated', source: 'physiology/index.js warmHbCapacity: set so the snapper maximal O2 extraction (durnford2026) fits the trout Hill curve. Calibrated, not measured' },
  P50_kPa: { value: 24.8 / 7.50062, kind: 'borrowed', source: 'rummer2015 Table 1: rainbow trout P50 24.8 mmHg (borrowed) / 7.50062 mmHg per kPa (standard unit conversion)' },
  n_H: { value: 1.34, kind: 'borrowed', source: 'rummer2015 Results text: rainbow trout Hill n 1.34 (Table 1 shows 1.3 +/- 0.1)' },
};
export const hillSat = (P, P50, n) => (P > 0 ? P ** n / (P ** n + P50 ** n) : 0);

// Breakpoints 0.33 / 0.86 / 0.97: physics/ground-effect.json (park-choi-2010, Results 'Ground effect', model L3 over water).
/** Drag multiplier in ground effect, physics/ground-effect.json simulator_model (Park & Choi 2010, water
 *  surface, model L3): 1 for r >= 0.97, linear to 0.86 at r = 0.33, 0.86 below; r = h / (span/2). */
export function groundEffectDrag(h_m, span_m) {
  if (!(span_m > 0) || h_m == null) return 1;
  const r = h_m / (span_m / 2);
  if (r >= 0.97) return 1;
  if (r <= 0.33) return 0.86;
  return 0.86 + ((1 - 0.86) * (r - 0.33)) / (0.97 - 0.33);
}

export const vMin = (W, rho, S, CLmax = PARK_CHOI.CL_max) => Math.sqrt((2 * W) / (rho * S * CLmax));

/**
 * Energy-height glide bound in a uniform horizontal wind (headwind u > 0, tailwind u < 0).
 * Phase A, level at the launch height: weight carried, drag W/(L/D)_eff, so airspeed falls at the constant
 * rate g/(L/D)_eff from v0 to v_min: air distance (L/D)_eff (v0^2 - v_min^2)/(2g), time (L/D)_eff (v0 - v_min)/g.
 * Phase B, descent from h at the best-L/D airspeed v_LD: air distance h (L/D), time h (L/D)/v_LD.
 * Ground distance = air distance - u x time. (L/D)max everywhere makes both phases upper bounds.
 */
export function glidePath({ W, S, rho, v0, h, span, LD = PARK_CHOI.LD_max, CLmax = PARK_CHOI.CL_max, CL0 = PARK_CHOI.CL_at_zero_deg, u = 0, groundEffect = true }) {
  const vmin = vMin(W, rho, S, CLmax);
  const f = groundEffect ? groundEffectDrag(h, span) : 1;
  const LDa = LD / f;
  const xA = v0 > vmin ? (LDa * (v0 * v0 - vmin * vmin)) / (2 * G) : 0;
  const tA = v0 > vmin ? (LDa * (v0 - vmin)) / G : 0;
  const vLD = vmin * Math.sqrt(CLmax / CL0);
  const xB = h > 0 ? h * LD : 0;
  const tB = h > 0 ? xB / vLD : 0;
  return {
    vmin, vLD, ground_effect_drag_factor: f, LD_level: LDa,
    air_range_m: xA + xB, ground_range_m: xA - u * tA + xB - u * tB, time_s: tA + tB,
    phaseA: { air_m: xA, t_s: tA }, phaseB: { air_m: xB, t_s: tB }, lift_supported_at_launch: v0 >= vmin,
  };
}

/** Fick aerobic power bound eta E Q Ca, with Ca from the Hill curve at PaO2 = inspired PO2 (an upper bound). */
export function fickPower({ mass_kg, pO2_kPa, P50_kPa = FICK.P50_kPa.value, Q_ml_s = null }) {
  const Q = Q_ml_s ?? (FICK.Qmax_ml_min_kg.value * mass_kg) / 60;
  const Ca = FICK.hb_cap_ml_ml.value * hillSat(pO2_kPa, P50_kPa, FICK.n_H.value);
  return { Q_ml_s: Q, Ca_ml_ml: Ca, P_W: FICK.eta.value * FICK.E_J_per_ml.value * Q * Ca };
}

// ---------------------------------------------------------------- small helpers (reused by wind/altitude)
export const val = (state, k) => (state && state[k] && state[k].value != null ? state[k].value : null);
export function ambientField(state, ...keys) {
  const a = state && state.ambient;
  if (!a) return null;
  for (const k of keys) if (a[k] && a[k].value != null) return a[k];
  return null;
}
export function metric(key, label, value, unit, better, kind, source, reason) {
  const ok = typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean';
  const m = { key, label, value: ok ? value : null, unit, better, kind: ok ? kind : 'assumed', source: ok ? source : 'none' };
  if (!ok) m.reason = reason || 'not computable from the inputs given';
  return m;
}
export const nullMetrics = (defs, why) => defs.map(d => metric(d.key, d.label, null, d.unit, d.better, 'assumed', 'none', why));

/** Lifting (aerodynamic reference) area: state lifting_area_m2 if present (field listed in `needs`), else
 *  pectoral_area_both x 1.98965 (assumed transfer). */
// STATE lifting_area_m2, when present, is pectoral + pelvic + caudal membrane area measured on the mesh (core lib/state.mjs),
// NOT Park & Choi's pectoral + pelvic + body-planform reference area: a convention difference this module does not correct.
export function liftingArea(state) {
  const direct = (state && (state.lifting_area_m2 || (state.parts && state.parts.lifting_area_m2))) || null;
  if (direct && direct.value != null) return { value: direct.value, kind: direct.kind || 'derived', source: `${direct.source || 'state lifting_area_m2'} (pectoral + pelvic + caudal on the mesh; Park & Choi's reference area uses body planform instead of caudal)` };
  const pa = val(state, 'pectoral_area_both_m2');
  if (pa == null) return { value: null, kind: 'assumed', source: 'none', reason: 'no pectoral_area_both_m2 and no lifting_area_m2 in the state' };
  return { value: pa * LIFT_OVER_PECTORAL, kind: 'assumed', source: `pectoral_area_both_m2 (${state.pectoral_area_both_m2.kind}) x ${LIFT_OVER_PECTORAL.toFixed(5)}, the Park & Choi L3 total/pectoral area ratio (NOTES-FOR-HUB.md item 3): an assumed transfer` };
}
export const isParkChoiSpecies = state => /Cypselurus hiraii/i.test(String(val(state, 'species') || ''));
export function airDensity(state) {
  const f = ambientField(state, 'air_density_kg_m3', 'air_density');
  return f ? { value: f.value, kind: f.kind || 'assumed', source: f.source || 'state.ambient air density' }
    : { value: 1.225, kind: 'assumed', source: 'conditions/baseline.json air_density_kg_m3 (1.225, standard sea-level air)' };
}
export function airPO2(state) {
  const f = ambientField(state, 'air_pO2_kPa', 'pO2_kPa');
  return f ? { value: f.value, kind: f.kind || 'derived', source: f.source || 'state.ambient pO2' }
    : { value: 0.2095 * 101.325, kind: 'measured-secondhand', source: 'dry-air O2 fraction 0.2095 (20.95%, standard dry-air composition) x 101.325 kPa' };
}
export function polarOf(state) {
  const kind = isParkChoiSpecies(state) ? 'measured' : 'borrowed';
  return { kind, source: `${PARK_CHOI.cite}, Table 2 (stuffed C. hiraii in a wind tunnel)${kind === 'borrowed' ? '; borrowed: this animal\'s own polar is not measured' : ''}` };
}


// ---------------------------------------------------------------- launch speed from the organism
// Never a global default. Flying fish: "approached and leaped from the water surface at approximately 10 m s-1
// (20 to 30 body length s-1)" (makiguchi-2013 Discussion, citing Davenport 1994; read in the fetched PDF,
// physics/prior-art/raw/pdf-takahashi-2013.txt). Below adult size the 30 BL/s upper end is used. Zebrafish: the
// maximum swimming speed Umax = 1.15 Ucrit from current.mjs (calibrated). No other species has a value.
const FF_RE = /exocoet|flying fish|cypselurus|hirundichthys|cheilopogon/i;
// Taxi phase (adult flying fish). Sources, all fetched (physics/prior-art/raw):
//  - leap: "approached and leaped from the water surface at approximately 10 m s-1" (makiguchi-2013 Discussion,
//    citing Davenport 1994);
//  - taxi end: taxiing "can probably accelerate the flying fish to a speed up to 15 - 20 m s-1 (Davenport 1994)"
//    (Deng, Wang, Zhang, Mao 2019 bioRxiv 10.1101/765560, Introduction); flying fish "glide for up to 50 m ... at an
//    air speed of 15 to 20 m s-1" (makiguchi-2013 Introduction citing Edgerton & Breder 1941 and Davenport 1990);
//    "they use this taxiing to gain additional speed for successive gliding flights" (park-choi-2010 Introduction).
//  - taxi length: average 9 m for cypselurid flying fish (deng-2019 Bioinspir Biomim Introduction, second-hand).
// Not modelled mechanistically: the taxi power (Deng 2019 preprint CFD: 36 W at 10 m/s, 350 W to reach 16.5 m/s, a
// model result) is burst/anaerobic and is NOT checked against this animal's muscle.
export const LEAP_M_S = 10;
export const TAXI_END_M_S = 15;
export const TAXI_MAX_M_S = 20;
const TAXI_SRC = 'adult flying fish: leap at ~10 m/s (makiguchi-2013 citing Davenport 1994), then taxi to take-off; take-off airspeed = 15 m/s, the LOWER end of the 15-20 m/s taxi-end / glide airspeed range (Davenport 1994 as quoted by Deng et al. 2019 bioRxiv https://doi.org/10.1101/765560; Edgerton & Breder 1941 as quoted by makiguchi-2013 https://doi.org/10.3354/ab00494). Family-level, second-hand; the taxi power is not checked';
const ZF_RE = /danio rerio|zebrafish/i;
export function organismLaunchSpeed(state) {
  const sp = String(val(state, 'species') || '');
  const SL = val(state, 'SL_m');
  if (/\+/.test(sp)) return { value: null, reason: 'blended species: no measured leap or burst speed exists for a blend, and none is invented' };
  if (FF_RE.test(sp)) {
    if (SL == null) return { value: null, reason: 'SL_m is null' };
    // Stage boundary: the state's own stage (the dominant parent's staging table, development/stages.json). For the
    // reference flying fish that is 'adult' from ~250 days after hatching (SL >= ~0.187 m). Adults take the measured
    // ~10 m/s leap speed; earlier stages scale 30 BL/s x SL (no leap speed is measured for them).
    const adult = /adult/i.test(String(val(state, 'stage') || ''));
    // Adults: leap at ~10 m/s, then TAXI (caudal lower lobe beating in the water, body airborne) up to the take-off
    // airspeed. Taxi end speed = TAXI_END_M_S (15 m/s, the LOWER end of the measured 15-20 m/s range), never above 20.
    if (adult) return { value: TAXI_END_M_S, kind: 'measured-secondhand', taxi: { leap_m_s: LEAP_M_S, end_m_s: TAXI_END_M_S, max_m_s: TAXI_MAX_M_S }, source: TAXI_SRC };
    const v = Math.min(LEAP_M_S, 30 * SL);
    return { value: v, kind: 'borrowed', source: `30 BL/s x SL ${(SL * 1000).toFixed(0)} mm, capped at the 10 m/s adult leap speed (makiguchi-2013 citing Davenport 1994: ~10 m/s, 20-30 BL/s), borrowed for a non-adult stage; no taxiing speed is measured for juveniles, so none is added` };
  }
  if (ZF_RE.test(sp)) {
    const age = val(state, 'ageDays');
    const T = val(state, 'temperature_C') ?? 25;
    const u = zebrafishUcrit28(age != null ? age + 2 : null, SL);
    const r = ucritRel(T);
    if (u.value == null || r.value == null) return { value: null, reason: `no zebrafish swimming speed at this stage/temperature: ${u.reason || r.reason}` };
    return { value: 1.15 * u.value * r.value, kind: 'calibrated', source: 'zebrafish Umax = 1.15 x Ucrit (current.mjs: Plaut 2000 via Widrick 2018, x SL, x Wakamatsu temperature curve). Burst C-start speeds are higher (the validation harness quotes ~25 TL/s for adults from Danos & Lauder 2012, not fetched here), still far below any glide v_min in the repository' };
  }
  return { value: null, reason: `no measured leap or burst speed for ${sp || 'this species'}` };
}
/** Launch speed: the override parameter if > 0 (a what-if, kind assumed); else a state launch_speed_m_s; else the organism's own. */
export function launchSpeed(state, override) {
  if (override > 0) return { value: override, kind: 'assumed', source: `what-if override launch_airspeed_override_m_s = ${override} m/s (not this organism's measured speed)` };
  if (val(state, 'launch_speed_m_s') != null) return { value: state.launch_speed_m_s.value, kind: state.launch_speed_m_s.kind || 'assumed', source: state.launch_speed_m_s.source || 'state launch_speed_m_s' };
  return organismLaunchSpeed(state);
}
export const LAUNCH_OVERRIDE_PARAM = { key: 'launch_airspeed_override_m_s', label: "What-if launch airspeed (0 = the organism's own sourced speed)", unit: 'm/s', default: 0, min: 0, max: 30, kind: 'assumed', source: "0 uses the organism's sourced leap/burst speed (flying fish ~10 m/s, makiguchi-2013; zebrafish Umax from current.mjs); any other value is a labelled what-if" };
export const LAUNCH_HEIGHT_PARAM = { key: 'launch_height_m', label: 'Launch height above the surface', unit: 'm', default: 1, min: 0, max: 10, kind: 'assumed', source: 'design input; maximum recorded flying-fish flight height 8 m (deng-2019 Introduction, second-hand)' };

/** The glide range split the way the Lean law requires: the part covered by glide_range_le (h (L/D)max, still
 *  air, delta = 0) and the level kinetic phase, which lies OUTSIDE that theorem. All zero when lift cannot carry
 *  the weight at the launch speed ("cannot glide"). */
export function glideParts(gp, canGlide) {
  if (!canGlide) return { lean: 0, kinetic: 0, total: 0 };
  return { lean: gp.phaseB.air_m, kinetic: gp.phaseA.air_m, total: gp.phaseB.air_m + gp.phaseA.air_m };
}
export const LEAN_SRC = 'h (L/D)max: the part covered by the Lean theorem glide_range_le (d <= h (L/D)/(1 - delta); delta = 0 here: still air, steady unpowered glide)';
export const KIN_SRC = 'OUTSIDE the Lean theorem: level flight at the launch height decelerating from the launch speed to v_min at (L/D)max with the measured ground-effect drag factor; assumes (L/D)max throughout and launch speed = airspeed';

// ---------------------------------------------------------------- the scenario
const METRICS = [
  { key: 'glide_range_lean_bound_m', label: 'Glide distance covered by the Lean bound, h (L/D)max', unit: 'm', better: 'higher' },
  { key: 'kinetic_phase_m', label: 'Level kinetic-energy phase (OUTSIDE the Lean theorem; assumption flagged)', unit: 'm', better: 'higher' },
  { key: 'glide_range_total_m', label: 'Sum: Lean-covered part + kinetic phase (the sum is NOT covered by the theorem)', unit: 'm', better: 'higher' },
  { key: 'launch_airspeed_m_s', label: 'Launch speed reachable by this organism', unit: 'm/s', better: 'higher' },
  { key: 'wing_loading_N_m2', label: 'Wing loading W/S (lifting area)', unit: 'N/m2', better: 'lower' },
  { key: 'v_min_m_s', label: 'Minimum lift-supported airspeed', unit: 'm/s', better: 'lower' },
  { key: 'launch_speed_margin_m_s', label: 'Launch speed minus v_min', unit: 'm/s', better: 'higher' },
  { key: 'glide_airspeed_m_s', label: 'Descent airspeed at best L/D (C_L(0 deg) 0.53, approximate)', unit: 'm/s', better: null },
  { key: 'glide_time_s', label: 'Time airborne (bound)', unit: 's', better: 'higher' },
  { key: 'glide_ratio', label: '(L/D)max used', unit: '1', better: 'higher' },
  { key: 'power_required_W', label: 'Power for level flight at v_min, W v_min/(L/D)max', unit: 'W', better: 'lower' },
  { key: 'aerobic_power_available_W', label: 'Fick aerobic power bound eta E Q Ca', unit: 'W', better: 'higher' },
  { key: 'powered_flight_margin', label: 'Aerobic power available / power required', unit: '1', better: 'higher' },
];

export const needs = [
  { field: 'lifting_area_m2', why: "aerodynamic lifting area. The core STATE supplies pectoral + pelvic + caudal membrane area measured on the design mesh (not the body outline); Park & Choi's own reference area is pectoral + pelvic + body planform, so the two conventions differ by the caudal-vs-body term. Absent, the pectoral area x 1.98965 (one specimen's ratio) is used and labelled assumed." },
  { field: 'cardiac_output_max_ml_s', why: 'Q for the Fick bound. Absent, snapper Q_max 58.48 ml/min/kg x mass is borrowed.' },
  { field: 'launch_speed_m_s', why: 'a sourced leap/burst speed for any species other than flying fish and zebrafish (and for blends). Absent, the glide is not evaluated (null), never defaulted.' },
];

export default {
  key: 'glide',
  title: "Glide from a launch height at the organism's own launch speed (still air), with the aerobic bound on powered flight",
  group: 'environment',
  params: [
    LAUNCH_HEIGHT_PARAM,
    LAUNCH_OVERRIDE_PARAM,
    { key: 'ground_effect', label: 'Apply the measured ground effect in the level phase (1 yes, 0 no)', unit: '1', default: 1, min: 0, max: 1, kind: 'assumed', source: 'a modelling switch (the toggle itself is a design choice); the drag curve it switches on is measured: physics/ground-effect.json (park-choi-2010 text: drag -14% at r = 0.33 over water, model L3)' },
  ],
  requires: ['mass_kg'],
  metrics: METRICS,
  needs,
  run(state, params = {}) {
    const p = { launch_height_m: 1, launch_airspeed_override_m_s: 0, ground_effect: 1, ...params };
    const m = val(state, 'mass_kg');
    const S = liftingArea(state);
    const span = val(state, 'pectoral_span_m');
    const rho = airDensity(state);
    const po2 = airPO2(state);
    const P50 = val(state, 'hb_P50_kPa') ?? FICK.P50_kPa.value;
    const polar = polarOf(state);
    const ls = launchSpeed(state, p.launch_airspeed_override_m_s);
    const prov = [
      { quantity: 'C_Lmax', value: PARK_CHOI.CL_max, kind: polar.kind, source: polar.source },
      { quantity: '(L/D)max', value: PARK_CHOI.LD_max, kind: polar.kind, source: polar.source },
      { quantity: 'C_L at 0 deg (best-L/D airspeed only)', value: PARK_CHOI.CL_at_zero_deg, kind: 'derived', source: 'Park & Choi 2010 Fig. 4 text: lift at 0 deg ~ body weight for L3 -> C_L(0) = mg/(0.5 rho U^2 S) = 0.53 at U = 12 m/s (range 0.49-0.57); Fig. 5 itself not read' },
      { quantity: 'air density (kg/m3)', value: rho.value, kind: rho.kind, source: rho.source },
      { quantity: 'lifting area (m2)', value: S.value, kind: S.kind, source: S.source },
      { quantity: 'launch speed (m/s)', value: ls.value, kind: ls.value != null ? ls.kind : 'assumed', source: ls.value != null ? ls.source : `none: ${ls.reason}` },
      { quantity: 'g (m/s2)', value: G, kind: 'measured-secondhand', source: 'standard gravity, rounded to 9.81 as in physics/results.json' },
      { quantity: 'Fick eta', value: FICK.eta.value, kind: FICK.eta.kind, source: FICK.eta.source },
      { quantity: 'Fick E_O2 (J/ml)', value: FICK.E_J_per_ml.value, kind: FICK.E_J_per_ml.kind, source: FICK.E_J_per_ml.source },
      { quantity: 'Hb O2 capacity (ml/ml)', value: FICK.hb_cap_ml_ml.value, kind: FICK.hb_cap_ml_ml.kind, source: FICK.hb_cap_ml_ml.source },
    ];
    if (m == null || S.value == null) {
      const why = m == null ? 'mass_kg is null in the state' : S.reason;
      return { metrics: nullMetrics(METRICS, why), survives: null, feasible: null, limiting: null, provenance: prov, scope: `Nothing computed: ${why}.`, validity: { inRange: false, notes: why } };
    }
    const W = m * G;
    const known = ls.value != null;
    const v0 = known ? ls.value : 0;
    const gp = glidePath({ W, S: S.value, rho: rho.value, v0, h: p.launch_height_m, span, groundEffect: !!p.ground_effect });
    const canGlide = known ? v0 >= gp.vmin : null;
    const parts = glideParts(gp, canGlide);
    const Preq = (W * gp.vmin) / PARK_CHOI.LD_max;
    const Qs = val(state, 'cardiac_output_max_ml_s');
    const fk = fickPower({ mass_kg: m, pO2_kPa: po2.value, P50_kPa: P50, Q_ml_s: Qs });
    prov.push({ quantity: 'cardiac output (ml/s)', value: fk.Q_ml_s, kind: Qs != null ? state.cardiac_output_max_ml_s.kind || 'assumed' : FICK.Qmax_ml_min_kg.kind, source: Qs != null ? state.cardiac_output_max_ml_s.source || 'state' : FICK.Qmax_ml_min_kg.source });
    prov.push({ quantity: 'arterial PO2 = inspired air PO2 (kPa, upper bound)', value: po2.value, kind: po2.kind, source: po2.source });
    const notes = [];
    let inRange = true;
    const chord = span ? S.value / span : null;
    const Re = chord ? (Math.max(v0, gp.vmin) * chord) / 1.46e-5 : null; // ISA sea-level air kinematic viscosity 1.46e-5 m2/s
    if (m < 0.02 || m > 0.4) { inRange = false; notes.push(`Mass ${m} kg is outside 0.02-0.4 kg (polar specimens 0.04-0.06 kg; field fliers to ~0.4 kg): polar extrapolated.`); }
    if (Re != null && (Re < 5e3 || Re > 1e5)) { inRange = false; notes.push(`Mean-chord Reynolds number ~${Re.toExponential(1)} is outside 5e3-1e5 around the polar's Re ~1e4 (Park & Choi: 'gliding flying fish (Re ~10^4)'; air kinematic viscosity 1.46e-5 m2/s).`); }
    if (S.kind === 'assumed') notes.push("Lifting area is the pectoral area times one specimen's total/pectoral ratio (assumed transfer).");
    if (FF_RE.test(String(val(state, 'species') || ''))) notes.push(ls.taxi ? `Adult flying fish: launch airspeed is the taxi end speed (${ls.taxi.end_m_s} m/s, lower end of the measured 15-20 m/s), reached by taxiing after a ~${ls.taxi.leap_m_s} m/s leap; the taxi distance (~9 m, second-hand) is not added to the glide range and the taxi power is not checked.` : 'No taxiing is credited to this stage.');
    notes.push('glide_range_total_m exceeds the Lean bound whenever the kinetic phase is non-zero; only glide_range_lean_bound_m is covered by glide_range_le.');
    notes.push('Fick bound: arterial PO2 taken equal to air PO2 and gills taken to work in air; gills do not ventilate in air (physiology chain), so for a gill-breather this is a generous upper bound.');
    notes.push('TFF: NOTES-FOR-HUB.md item 2 says only 29.5% of the flight muscle the simulator charges fits in the body. This module uses no muscle power (the Fick bound is the cap), so the issue does not enter here; any muscle-based claim for the TFF must take it into account.');
    const margin = fk.P_W / Preq;
    const limiting = !known ? `glide not evaluated: ${ls.reason}`
      : !canGlide ? `cannot glide: the reachable launch speed ${v0.toFixed(2)} m/s is below v_min ${gp.vmin.toFixed(2)} m/s, so lift cannot carry the weight`
      : margin < 1 ? 'glide only: the aerobic O2 supply cannot pay for level powered flight (Fick bound)' : null;
    const why = known ? null : ls.reason;
    const metrics = [
      metric('glide_range_lean_bound_m', METRICS[0].label, known ? parts.lean : null, 'm', 'higher', 'derived', canGlide ? LEAN_SRC : 'cannot glide: 0', why),
      metric('kinetic_phase_m', METRICS[1].label, known ? parts.kinetic : null, 'm', 'higher', 'derived', canGlide ? `${KIN_SRC}; ground-effect drag factor ${gp.ground_effect_drag_factor.toFixed(3)}` : 'cannot glide: 0', why),
      metric('glide_range_total_m', METRICS[2].label, known ? parts.total : null, 'm', 'higher', 'derived', canGlide ? 'glide_range_lean_bound_m + kinetic_phase_m; NOT covered by the Lean theorem as a whole' : 'cannot glide: 0', why),
      metric('launch_airspeed_m_s', METRICS[3].label, ls.value, 'm/s', 'higher', ls.kind || 'assumed', ls.source, ls.reason),
      metric('wing_loading_N_m2', METRICS[4].label, W / S.value, 'N/m2', 'lower', 'derived', `m g / lifting area (${S.kind})`),
      metric('v_min_m_s', METRICS[5].label, gp.vmin, 'm/s', 'lower', 'derived', 'sqrt(2W/(rho S C_Lmax)), physics/results.json interpretation B'),
      metric('launch_speed_margin_m_s', METRICS[6].label, known ? v0 - gp.vmin : null, 'm/s', 'higher', 'derived', 'launch speed - v_min', why),
      metric('glide_airspeed_m_s', METRICS[7].label, canGlide ? gp.vLD : null, 'm/s', null, 'derived', 'v_min sqrt(C_Lmax / C_L(0 deg)); C_L(0 deg) = 0.53 from Park & Choi lift-equals-weight at 0 deg (approximate)', why || 'cannot glide'),
      metric('glide_time_s', METRICS[8].label, known ? (canGlide ? gp.time_s : 0) : null, 's', 'higher', 'derived', '(L/D)_eff (v0 - v_min)/g + h (L/D)/v_LD; v_LD uses C_L(0 deg) 0.53 (approximate)', why),
      metric('glide_ratio', METRICS[9].label, PARK_CHOI.LD_max, '1', 'higher', polar.kind, polar.source),
      metric('power_required_W', METRICS[10].label, Preq, 'W', 'lower', 'derived', 'physics/results.json interpretation C formula'),
      metric('aerobic_power_available_W', METRICS[11].label, fk.P_W, 'W', 'higher', 'derived', `eta E Q Ca, Ca ${fk.Ca_ml_ml.toFixed(4)} ml/ml at PO2 ${po2.value.toFixed(1)} kPa (Hill P50 ${P50.toFixed(2)} kPa, n 1.34), Q ${fk.Q_ml_s.toFixed(4)} ml/s`),
      metric('powered_flight_margin', METRICS[12].label, margin, '1', 'higher', 'derived', '>= 1 would mean the O2 budget does not forbid level flight (necessary, not sufficient)'),
    ];
    return {
      metrics, survives: null, feasible: canGlide, feasibility_note: limiting, limiting: null, provenance: prov,
      scope: "Still air over a flat surface; steady glide polar of stuffed flying fish in a wind tunnel; ranges are upper bounds (every metre at (L/D)max). Only glide_range_lean_bound_m is covered by the Lean theorem glide_range_le. Launch speed is the organism's own sourced leap/burst speed (or a labelled what-if). Takeoff (taxiing), control, stability, flapping and burst power are not modelled. survives = null (a glide attempt is not a lethal perturbation in this model); feasible = lift can carry the weight at the reachable launch speed (null if no sourced launch speed).",
      validity: { inRange, notes: notes.join(' ') },
    };
  },
  modelCard: {
    equations: [
      'W = m g; v_min = sqrt(2 W / (rho S C_Lmax))',
      "launch speed v0 = the organism's own: adult flying fish = taxi end speed 15 m/s (leap ~10 m/s then taxi; lower end of the measured 15-20 m/s); other flying-fish stages min(10 m/s, 30 BL/s x SL), no taxi; zebrafish Umax = 1.15 Ucrit; otherwise not evaluated",
      'cannot glide if v0 < v_min: every range = 0, feasible = false',
      'Lean-covered part: d_lean = h (L/D)max   (glide_range_le: d <= h (L/D)/(1 - delta))',
      'kinetic phase (outside the theorem): x_A = (L/D)_eff (v0^2 - v_min^2)/(2g), (L/D)_eff = (L/D)max / f_ground(h/(b/2))',
      'total = d_lean + x_A (labelled as not covered by the theorem)',
      'P_req = W v_min / (L/D)max; P_aerobic <= eta E_O2 Q C_a(PO2)',
    ],
    sources: [
      { cite: PARK_CHOI.cite, doi_or_url: PARK_CHOI.doi },
      { cite: 'Makiguchi Y et al. (2013). Take-off performance of flying fish Cypselurus heterurus doederleini measured with miniature acceleration data loggers. Aquat Biol 18:105-111 (leap speed ~10 m/s, 20-30 BL/s, citing Davenport 1994; glide up to 50 m at 15-20 m/s citing Edgerton & Breder 1941)', doi_or_url: 'https://doi.org/10.3354/ab00494' },
      { cite: 'Deng J et al. (2019). Numerical prediction of aerodynamic performance for a flying fish during gliding flight. Bioinspir Biomim 14:046009 (maximum flight height 8 m; average taxiing length 9 m, second-hand)', doi_or_url: 'https://doi.org/10.1088/1748-3190/ab23e6' },
      { cite: 'Deng J, Wang S, Zhang L, Mao X (2019). Why does a flying fish taxi on sea surface before take-off? A hydrodynamic interpretation. bioRxiv 765560 (taxiing accelerates to 15-20 m/s, citing Davenport 1994)', doi_or_url: 'https://doi.org/10.1101/765560' },
      { cite: 'Durnford FPH, Porter ES, Gamperl AK (2026). Increased heart rate and blood oxygen extraction ... schoolmaster snapper. J Exp Biol', doi_or_url: 'https://doi.org/10.1242/jeb.252059' },
      { cite: 'Rummer JL, Brauner CJ (2015). Root effect haemoglobins in fish ... PLoS One 10:e0139477', doi_or_url: 'https://doi.org/10.1371/journal.pone.0139477' },
      { cite: 'Gerry SP, Ellerby DJ (2014). Resolving shifting patterns of muscle energy use in swimming fish. PLoS One 9:e106030', doi_or_url: 'https://doi.org/10.1371/journal.pone.0106030' },
    ],
    validity: 'Flying-fish-sized gliders (0.02-0.4 kg), mean-chord Re 5e3-1e5, launch heights 0-10 m. The polar is from stuffed specimens at one wind speed (12 m/s; Park & Choi: Re ~1e4); a zebrafish-sized or larval animal is far outside it (inRange false), and cannot reach its v_min anyway.',
    validatedAgainst: [
      { organism: 'Cypselurus hiraii (Park & Choi model L3)', observation: 'code regression against physics/results.json at rho 1.225', predicted: 'v_min 9.854 m/s, P_req 1.327 W', measured: 'physics/results.json: 9.854 m/s, 1.327 W (same equations: a code check, not a test against nature)', source: 'physics/results.json interpretation_B and interpretation_C' },
      { organism: 'Exocoetidae (several genera)', observation: 'glides up to 50 m at 15-20 m/s airspeed after taxiing (stroboscopic film, Edgerton & Breder 1941, quoted second-hand)', predicted: 'with the taxi end speed 15 m/s (L3 polar): ~33 m from 1 m (Lean part 4.37 m + kinetic phase ~29 m), ~64 m from the 8 m maximum height', measured: 'up to 50 m', source: 'makiguchi-2013 Introduction (https://doi.org/10.3354/ab00494). Inside the range, but PARTLY CIRCULAR: the 15 m/s take-off speed comes from the same body of observations (15-20 m/s) as the 50 m glide. Not independent evidence.' },
      { organism: 'Cheilopogon (Cypselurus) heterurus doederleini', observation: 'leap speed about 10 m/s (Davenport 1994, stroboscopic, quoted by Makiguchi)', predicted: 'v_min 9.85 m/s (L3): a fish leaving the water at 10 m/s is barely lift-supported, consistent with the taxiing seen before long glides', measured: '~10 m/s', source: 'makiguchi-2013. Consistent; not a pass/fail test' },
    ],
  },
};
