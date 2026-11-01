// params-panel.js — every tunable parameter of the flight/glide solver in one panel, built from a
// DECLARED SCHEMA rather than hand-written HTML, so nothing can be silently missing.
//
//   import { buildSchema, mountParams, sourcedDefaults, encodeToQuery, decodeFromQuery,
//            listSets, saveSet, loadSet, deleteSet, diffSets, KINDS } from './params-panel.js';
//
//   const schema = buildSchema(paramsJson, baselineJson, groundEffectJson);  // the schema IS the contract
//   const values = sourcedDefaults(schema);
//   mountParams(el, { schema, values, onChange(values, changedKey) {...} });
//
// The schema is a declared list of records shaped like sim-engine/scenarios/*.mjs `params`:
//   { key, label, unit, default, min, max, kind, source }
// plus, because this panel exists to show where a number came from and when you have left it:
//   { group, raw_kind, path, type, step, range_kind, settable, note }
//
// `kind` uses the sim-engine/CONTRACT.md vocabulary (measured | measured-secondhand | derived |
// calibrated | borrowed | assumed); `raw_kind` keeps params.json's own word so nothing is relabelled
// behind the reader's back. The mapping is in KIND_MAP below and is shown in the panel.
//
// WHAT THIS FILE DOES NOT DO: it never edits index.html. Constants the solver hard-codes are listed
// here with `settable: false` so the inventory is complete, and they render as read-only rows marked
// "hard-coded in index.html". The report names them; routing them is the solver owner's call.
//
// Applying a value set to the solver lives in sweep.js (`applyValues`), because the sweep worker
// needs it and this module is the UI half. The schema's `path` field is the shared contract.

export const KINDS = ['measured', 'measured-secondhand', 'derived', 'calibrated', 'borrowed', 'assumed', 'unknown'];

// params.json / baseline.json words -> sim-engine/CONTRACT.md kinds. Nothing is upgraded by this map.
export const KIND_MAP = {
  measured: 'measured',
  secondary: 'measured-secondhand',          // "quoted second-hand in a fetched source"
  'measured-secondhand': 'measured-secondhand',
  derived: 'derived',
  standard: 'derived',                        // a conventional constant, no new empirical content
  observed: 'measured-secondhand',            // stated in a fetched source as an observation
  locked: 'derived',                          // locked to another committed file; see note
  tuned: 'calibrated',                        // "chosen so a sourced quantity is reproduced"
  calibrated: 'calibrated',
  borrowed: 'borrowed',
  proxy: 'borrowed',
  assumed: 'assumed',
  hypothetical: 'assumed',
  supplied: 'assumed',
  unknown: 'unknown',
};
export const kindOf = raw => KIND_MAP[String(raw || 'unknown').toLowerCase().split(' ')[0]] || 'unknown';
const KIND_CLASS = { measured: 'k-measured', 'measured-secondhand': 'k-second', derived: 'k-derived', calibrated: 'k-calib', borrowed: 'k-borrow', assumed: 'k-assumed', unknown: 'k-unknown' };
const KIND_SHORT = { measured: 'measured', 'measured-secondhand': 'measured-2nd', derived: 'derived', calibrated: 'calibrated', borrowed: 'borrowed', assumed: 'assumed', unknown: 'unknown' };

export const GROUPS = [
  { id: 'physics', label: 'Physics', blurb: 'Universal constants and the shape of the force laws.' },
  { id: 'organism', label: 'Organism', blurb: 'This one 60 g specimen: morphology, its measured fin polar, its behaviour and its muscle.' },
  { id: 'environment', label: 'Environment', blurb: 'The medium and the surface the fish moves through.' },
  { id: 'numerics', label: 'Numerics', blurb: 'Integration and run limits. Changing these must not change the answer; if one does, that is the finding.' },
];

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => typeof v === 'number' && isFinite(v);
const srcOf = p => (p && (p.source || p.note)) || '';

// ---------------------------------------------------------------------------------------------
// buildSchema: EXTRACT the solver's real inputs. Every entry below is read by index.html's solver
// (derive / accel / rk4 / newSim / stepSim) or declared hard-coded inside it. Nothing is invented.
// ---------------------------------------------------------------------------------------------

function fishParam(f, key, o) {
  const p = f && f[key];
  const v = p ? (o && o.field ? p[o.field] : p.value) : undefined;
  const rawKind = p ? (o && o.kindFrom ? o.kindFrom : p.kind) : 'unknown';
  const span = (o && o.span) || 0.5;
  let min = o && num(o.min) ? o.min : (p && num(p.min) ? p.min : (p && num(p.min_factor) ? p.min_factor : null));
  let max = o && num(o.max) ? o.max : (p && num(p.max) ? p.max : (p && num(p.max_factor) ? p.max_factor : null));
  let rangeKind = 'sourced-range';
  if (!num(min) || !num(max)) {
    const base = num(v) ? Math.abs(v) : 1;
    min = o && o.min0 ? 0 : (num(v) ? v - span * base : 0);
    max = num(v) ? v + span * base : 1;
    rangeKind = 'panel-default-range';
  }
  return {
    key: (o && o.key) || key,
    label: (o && o.label) || key.replace(/_/g, ' '),
    unit: (o && o.unit) || '1',
    default: v,
    min, max,
    kind: kindOf(rawKind),
    raw_kind: rawKind,
    source: srcOf(p) || ((o && o.source) || 'not stated in params.json'),
    group: (o && o.group) || 'organism',
    type: (o && o.type) || (typeof v === 'boolean' ? 'bool' : 'number'),
    step: (o && o.step) != null ? o.step : null,
    path: (o && o.path) || (o && o.field ? { t: 'fishField', key, field: o.field } : { t: 'fish', key }),
    settable: (o && o.settable) !== false,
    range_kind: rangeKind,
    note: (o && o.note) || '',
    used_by: (o && o.used_by) || '',
  };
}

/** Build the whole schema from the committed data files. `fishIndex` picks the params.json entry. */
export function buildSchema(params, baseline, groundEffect, fishIndex = 0) {
  const f = params.fish[fishIndex];
  const C = params.constants;
  const out = [];
  const K = (o) => out.push(o);
  const cst = (key, o) => K({
    key: 'const.' + key, label: o.label, unit: o.unit, default: C[key].value,
    min: o.min, max: o.max, kind: kindOf(o.kindOverride || C[key].kind), raw_kind: o.kindOverride || C[key].kind,
    source: o.source || srcOf(C[key]) || 'params.json constants', group: o.group || 'physics', type: 'number',
    step: o.step || null, path: { t: 'const', key }, settable: true, range_kind: 'panel-default-range', note: o.note || '', used_by: o.used_by || '',
  });
  const hard = (key, label, unit, value, where, why, group = 'physics') => K({
    key: 'hard.' + key, label, unit, default: value, min: null, max: null,
    kind: 'assumed', raw_kind: 'hard-coded', source: why, group, type: typeof value === 'number' ? 'number' : 'text',
    step: null, path: { t: 'hardcoded', where }, settable: false, range_kind: 'none',
    note: 'HARD-CODED in index.html ' + where + '. Not reachable from this panel; listed so the inventory is complete.', used_by: where,
  });

  // ---- physics -------------------------------------------------------------------------------
  cst('g', { label: 'gravity', unit: 'm/s^2', min: 9.7, max: 9.9, step: 0.001, source: 'params.json constants.g, kind "standard" (the conventional value, rounded as in physics/results.json)', used_by: 'accel az, derive W and v_min' });
  hard('stall_falloff_end_deg', 'angle at which C_L has fallen to zero past the stall', 'deg', 60, 'CL()', 'C_L(a) falls linearly from C_Lmax at the stall to 0 at 60 deg. The 60 deg and the 25 deg span in the denominator are a chosen stall shape; params.json says "shape assumed" but carries no number for it.');
  hard('CL_floor', 'lowest C_L the polar will return', '1', -0.5, 'CL()', 'Math.max(-0.5, ...) clamps the linear branch. Not in params.json and not measured; it bounds the taxi trim law at negative angles of attack.');
  hard('ge_knee_upper_r', 'h/b above which the ground effect is off', '1', 0.97, 'fge()', 'park-choi-2010 over water. The page FETCHES data/ground-effect.json but fge() uses `ge` only as an on/off flag and hard-codes this number.');
  hard('ge_knee_lower_r', 'h/b at the maximum drag reduction', '1', 0.33, 'fge()', 'park-choi-2010 over water (measured; r = 0.33). Hard-coded rather than read from the fetched ground-effect.json.');
  hard('ge_drag_floor', 'drag multiplier at and below the lower knee', '1', 0.86, 'fge()', 'park-choi-2010: drag -14 % at r = 0.33 over water, held flat below (not measured lower). Measured value, hard-coded.');
  hard('lobe_drag_area_fraction', 'lobe wetted area as a fraction of body frontal area', '1', 0.2, 'accel() taxi branch', 'Commented "assumed 20% of frontal area". An assumed hydrodynamic number with no slider, and the calibrated taxi thrust factor compensates for it (params.json taxi_thrust_N source says so).', 'organism');
  hard('thrust_cap_weights', 'cap on powered thrust, in body weights', 'W', 2, 'accel() glide branch', 'T = min(P_avail / v, 2 W). An assumed ceiling; the v2 flag path uses 4 W for the axial muscle instead.', 'organism');
  hard('powered_speed_floor_m_s', 'speed floor when turning power into thrust (glide)', 'm/s', 1, 'accel() glide branch', 'Math.max(v, 1) stops T = P/v diverging at low speed. A numerical guard that sets the thrust at launch.', 'numerics');
  hard('physcap_speed_floor_m_s', 'speed floor in the physiology thrust cap', 'm/s', 0.5, 'physCap()', 'Math.max(v, 0.5). Same role as above for the axial muscle.', 'numerics');
  hard('buoyancy_equals_weight', 'buoyancy while submerged', '-', 'exactly weight', 'accel() swim branch', 'params.json breach/buoyancy note: "taken equal to weight while submerged (assumed neutral)". There is no body_density or swimbladder parameter, so neutral buoyancy cannot be varied at all.', 'organism');

  // ---- organism: morphology and the measured polar -------------------------------------------
  K(fishParam(f, 'mass_kg', { label: 'body mass', unit: 'kg', min: 0.01, max: 0.2, step: 0.001, used_by: 'derive d.m, W, v_min' }));
  K(fishParam(f, 'standard_length_m', { label: 'standard length', unit: 'm', min: 0.05, max: 0.5, step: 0.001, used_by: 'NOT read by the integrator: the design intake, the Lean state (SL_m) and the provenance table', note: 'The integrator never reads standard length; it is here because the schema intake and the Lean checks do.' }));
  K(fishParam(f, 'ref_area_m2', { label: 'reference (total lifting) area', unit: 'm^2', min: 0.004, max: 0.03, step: 0.0001, used_by: 'derive d.S; lift and drag; v_min' }));
  K(fishParam(f, 'span_m', { label: 'full pectoral span', unit: 'm', min: 0.1, max: 0.6, step: 0.001, used_by: 'derive d.b = span/2; the ground-effect argument h/b' }));
  K(fishParam(f, 'CL_max', { label: 'maximum lift coefficient', unit: '1', min: 0.3, max: 1.4, step: 0.01, used_by: 'derive d.CLmax, CL(), v_min' }));
  K(fishParam(f, 'LD_max', { label: 'best lift-to-drag ratio', unit: '1', min: 2, max: 12, step: 0.01, used_by: 'derive d.k (the polar curvature); the Lean C15 glide bound' }));
  K(fishParam(f, 'CD_min', { label: 'minimum drag coefficient', unit: '1', min: 0.01, max: 0.2, step: 0.001, used_by: 'derive d.CDmin, CD()' }));
  K(fishParam(f, 'CL_at_zero_deg', { label: 'lift coefficient at zero angle of attack', unit: '1', step: 0.01, used_by: 'derive d.CL0, the C_L slope and d.k', note: 'sim-engine/scenarios/glide.mjs reads Park and Choi differently and gets 0.53, calling this 0.4 the ASSUMED value it replaces. The two files disagree.' }));
  K(fishParam(f, 'stall_alpha_deg', { label: 'stall angle of attack', unit: 'deg', min: 20, max: 50, step: 0.5, used_by: 'derive d.stall, the C_L slope, the trim bound' }));
  K(fishParam(f, 'glide_alpha_deg', { label: 'angle of attack held in the glide', unit: 'deg', step: 0.5, used_by: 'accel() glide branch' }));
  K(fishParam(f, 'body_frontal_area_m2', { label: 'body frontal area', unit: 'm^2', step: 0.00001, used_by: 'water drag, swim thrust, lobe drag' }));
  K(fishParam(f, 'water_drag_coefficient', { label: 'water drag coefficient (body)', unit: '1', step: 0.005, used_by: 'derive d.Cdw, swim and taxi thrust, lobe drag (also overridable by the url flag cdw)' }));
  K(fishParam(f, 'lobe_length_m', { label: 'lower caudal lobe length', unit: 'm', step: 0.001, used_by: 'the phase boundaries, the immersed fraction, the trim target height' }));
  K(fishParam(f, 'pitch_at_leap_deg', { label: 'body pitch at the leap', unit: 'deg', min: 5, max: 40, step: 0.5, used_by: 'DEAD INPUT: derive computes d.pitch and nothing reads it', note: 'derive() sets d.pitch from this measured value and no equation uses it. Moving it changes nothing; the path angle is approach_angle_deg.' }));

  // ---- organism: behaviour (the control law) -------------------------------------------------
  K(fishParam(f, 'approach_speed_m_s', { label: 'approach / launch-run speed', unit: 'm/s', min: 2, max: 20, step: 0.1, used_by: 'derive d.vapp -> T_swim = 1/2 rho_w vapp^2 A_f C_dw, and so the whole speed budget, including the launch speed' }));
  K(fishParam(f, 'approach_angle_deg', { label: 'path angle of the swim toward the surface', unit: 'deg', step: 0.5, used_by: 'accel() swim branch, the direction of the swim thrust' }));
  K(fishParam(f, 'taxi_thrust_N', { key: 'taxi_thrust_factor', field: 'factor', label: 'taxi thrust as a fraction of the swim thrust', unit: '1', min: 0.05, max: 2, step: 0.01, used_by: 'derive d.Ttaxi = factor x T_swim' }));
  K(fishParam(f, 'takeoff_speed_target_m_s', { label: 'take-off speed target', unit: 'm/s', step: 0.1, used_by: 'the taxi trim law: above it the fish stops trimming low and holds the glide angle' }));
  K(fishParam(f, 'reentry_min_speed_m_s', { label: 'minimum speed to taxi again after re-entry', unit: 'm/s', step: 0.1, used_by: 'stepSim: below it the run stops' }));
  hard('trim_height_gain_per_m', 'taxi trim gain on height error', '1/m', 2, 'accel() taxi branch', 'The trim law needs lift = W (1 + 2 (lobe/2 - z)/lobe - 2 vz). params.json taxi_trim names the gains ("2 per m and 2 s per m, assumed") but gives them no fields, so they cannot be moved.', 'organism');
  hard('trim_rate_gain_s_per_m', 'taxi trim damping gain on vertical speed', 's/m', 2, 'accel() taxi branch', 'Same expression. Added after the run-5 sweep; assumed, and not reachable.', 'organism');
  hard('trim_target_height_frac', 'taxi trim target height, as a fraction of the lobe', '1', 0.5, 'accel() taxi branch', 'lobe/2. An assumed set-point with no field.', 'organism');
  hard('trim_alpha_min_deg', 'lower bound on the trimmed angle of attack', 'deg', -10, 'accel() taxi branch', 'Math.max(-10, ...). It decides the lift-off speed (about 16 m/s with this polar), which is the single most consequential hard-coded number on the page.', 'organism');

  // ---- organism: muscle and physiology (read by derive, used when powered or the chain is on) --
  const phys = [
    ['powered', { label: 'flapping thrust allowed', unit: 'bool', type: 'bool', used_by: 'accel() glide branch' }],
    ['flight_muscle_fraction', { label: 'flight muscle fraction', unit: '1', min: 0, max: 0.3, step: 0.001, used_by: 'derive d.Pavail = f m p - p_inert m' }],
    ['muscle_specific_power_W_per_kg', { label: 'muscle specific power', unit: 'W/kg', min: 0, max: 400, step: 1, used_by: 'derive d.Pavail' }],
    ['inertial_power_W_per_kg_body', { label: 'inertial power per kg of body', unit: 'W/kg', min: 0, max: 100, step: 0.5, used_by: 'derive d.Pavail' }],
    ['aerobic_capacity_W', { label: 'aerobic capacity at sea level', unit: 'W', min: 0, max: 5, step: 0.01, used_by: 'accel() glide branch, altitude model only' }],
    ['hb_P50_kPa', { label: 'haemoglobin P50', unit: 'kPa', min: 1, max: 8, step: 0.01, used_by: 'satHb() in the altitude model' }],
    ['hb_n', { label: 'Hill coefficient n', unit: '1', min: 1, max: 3, step: 0.01, used_by: 'satHb() in the altitude model' }],
    ['axial_muscle_fraction', { label: 'axial muscle fraction', unit: '1', min: 0, max: 0.8, step: 0.01, used_by: 'newSim: the physiology chain only' }],
    ['gillArea_m2', { label: 'gill area', unit: 'm^2', step: 0.0001, used_by: 'newSim: the physiology chain only' }],
    ['hbCapacity_mlO2_per_ml', { label: 'haemoglobin O2 capacity', unit: 'ml O2/ml', min: 0, max: 0.4, step: 0.001, used_by: 'newSim: the physiology chain only' }],
  ];
  for (const [key, o] of phys) {
    if (!f[key]) continue;                  // never invent a field the entry does not carry
    const r = fishParam(f, key, Object.assign({ min0: true }, o));
    if (r.default == null && o.type !== 'bool') {
      // The field is declared with a null value: params.json has no number for it and the solver's
      // own `|| 0` fallback is what runs. Tunable, but there is no sourced value to be moved off.
      r.default = 0;
      r.note = 'params.json declares this field with value null (kind "' + r.raw_kind + '"), so the solver\'s own fallback of 0 is what runs. It is tunable, but 0 is a fallback, not a sourced value.';
      if (!isFinite(r.min) || !isFinite(r.max) || r.min >= r.max) { r.min = 0; r.max = o.max != null ? o.max : 1; }
    }
    K(r);
  }

  // ---- environment ---------------------------------------------------------------------------
  const blAir = baseline && baseline.conditions && baseline.conditions.air_density_kg_m3;
  cst('rho_air', {
    label: 'air density', unit: 'kg/m^3', min: 0.4, max: 1.4, step: 0.001, group: 'environment',
    kindOverride: (blAir && blAir.kind) || 'standard',
    source: 'index.html OVERWRITES params.json with data/baseline.json conditions.air_density_kg_m3 = ' + ((blAir && blAir.value) ?? '?') + ' and relabels the kind "locked". baseline.json itself calls that value ' + ((blAir && blAir.kind) || '?') + ': "' + esc((blAir && (blAir.note || blAir.source)) || '') + '". The underlying kind is shown here, not the relabel.',
    used_by: 'lift, drag, v_min (or atmo() when the altitude model is on)',
  });
  cst('rho_water', { label: 'sea-water density', unit: 'kg/m^3', min: 995, max: 1050, step: 0.5, group: 'environment', source: 'params.json constants.rho_water, kind "standard", note "sea water". No temperature or salinity dependence: the value is a single constant.', used_by: 'swim thrust, water drag, lobe drag' });
  K({
    key: 'env.ground_effect', label: 'apply the measured ground effect', unit: 'bool', default: !!groundEffect,
    min: 0, max: 1, kind: 'measured', raw_kind: 'measured', group: 'environment', type: 'bool', step: null,
    path: { t: 'geOff' }, settable: true, range_kind: 'none',
    source: 'the curve is measured (park-choi-2010 Fig. 12 and text, data/ground-effect.json); the switch is a modelling choice. fge() uses the fetched file ONLY as an on/off flag and hard-codes its three numbers.',
    note: 'Off means the drag multiplier is 1 everywhere. This is index.html\'s own GE_OFF switch, set through solveWith, the same path the 3D view uses.', used_by: 'fge(), GE_OFF',
  });
  K({
    key: 'env.headwind_m_s', label: 'uniform horizontal headwind', unit: 'm/s', default: 0,
    min: -12, max: 12, step: 0.1, kind: 'assumed', raw_kind: 'assumed', group: 'environment', type: 'number',
    path: { t: 'fish', key: 'headwind_m_s' }, settable: true, range_kind: 'panel-default-range',
    source: 'NOT in any params.json entry. index.html derive() reads f.headwind_m_s and defaults it to 0; it was added for the 3D view\'s wind control. At 0 the equations are the committed ones, number for number; above 0 the aerodynamic forces use the air-relative velocity (vx + u, vz).',
    note: 'A tunable input with no committed value and no source, so it has no sourced default to be moved off: 0 is the only value the page calls committed. Lean P4b (glide ground range in wind) is the law that bounds this.',
    used_by: 'derive d.wind, accel() air-relative velocity',
  });
  K({
    key: 'env.lobe_cd', label: 'lobe water drag coefficient', unit: '1', default: null,
    min: 0.01, max: 0.5, step: 0.005, kind: 'assumed', raw_kind: 'assumed', group: 'environment', type: 'number',
    path: { t: 'flag', key: 'lobecd' }, settable: true, range_kind: 'panel-default-range',
    source: 'url flag `lobecd` in accel(); when unset it falls back to water_drag_coefficient. No measured value exists for a flying fish lobe.',
    note: 'Blank = follow the body water drag coefficient (the default).', used_by: 'accel() taxi branch',
  });
  K({
    key: 'env.taxi_drag_on', label: 'lobe water drag during the taxi', unit: 'bool', default: true,
    min: 0, max: 1, kind: 'assumed', raw_kind: 'assumed', group: 'environment', type: 'bool', step: null,
    path: { t: 'flag', key: 'taxidrag', falseValue: '0' }, settable: true, range_kind: 'none',
    source: 'url flag `taxidrag=0` in accel() removes the lobe drag entirely. The drag itself is assumed.',
    note: '', used_by: 'accel() taxi branch',
  });
  if (f.altitude_model) K(fishParam(f, 'altitude_model', { label: 'altitude-dependent air density and O2', unit: 'bool', type: 'bool', group: 'environment', used_by: 'atmo(); also raises the distance limit to 30 km' }));
  for (const [k, lab, unit, mn, mx, st] of [['water_temperature_C', 'water temperature', 'degC', 0, 35, 0.5], ['salinity_psu', 'salinity', 'psu', 0, 40, 0.5], ['air_O2_fraction', 'air O2 fraction', '1', 0.1, 0.3, 0.001]]) {
    const b = baseline && baseline.conditions && baseline.conditions[k];
    if (!b || !num(b.value)) continue;
    K({
      key: 'base.' + k, label: lab, unit, default: b.value, min: mn, max: mx, step: st,
      kind: kindOf(b.kind), raw_kind: b.kind, source: srcOf(b) || 'data/baseline.json', group: 'environment',
      type: 'number', path: { t: 'baseline', key: k }, settable: true, range_kind: 'panel-default-range',
      note: 'Reaches the solver only through the physiology chain (newSim env); with the chain off it changes nothing.',
      used_by: 'newSim -> createPhysiology',
    });
  }

  // ---- numerics ------------------------------------------------------------------------------
  K({
    key: 'num.tmax', label: 'run time limit', unit: 's', default: 60, min: 5, max: 300, step: 1,
    kind: 'assumed', raw_kind: 'assumed', source: 'url flag `tmax` in stepSim, default 60 s. A run limit, not a physical quantity.',
    group: 'numerics', type: 'number', path: { t: 'flag', key: 'tmax' }, settable: true, range_kind: 'panel-default-range',
    note: 'A sweep point that ends because the clock ran out is not infeasible; the outcome records which stop fired.', used_by: 'stepSim',
  });
  K(fishParam(f, 'max_glides', { label: 'glides after which the run stops', unit: '1', min: 1, max: 20, step: 1, group: 'numerics', used_by: 'stepSim' }));
  K(fishParam(f, 'start_depth_m', { label: 'starting depth of the body centre', unit: 'm', min: -5, max: -0.2, step: 0.05, group: 'numerics', used_by: 'newSim initial z; sets how long the swim phase lasts' }));
  hard('dt_s', 'integration step', 's', 0.001, 'newSim()', 'dt: 0.001 in the returned state. RK4 at 1 ms is stated on the page as part of the model, but there is no field for it, so the step cannot be refined to check convergence.', 'numerics');
  hard('sample_interval_s', 'history sampling interval', 's', 0.02, 'stepSim()', 'S.nextSample += 0.02. It sets the resolution of every chart AND of the page\'s own test-1 row (which counts 0.02 s of climbing below 0.95 v_min), so it is not purely cosmetic.', 'numerics');
  hard('max_distance_m', 'distance at which the run stops', 'm', 900, 'stepSim()', 'S.s.x > (d.alt ? 30000 : 900). A run limit with no field.', 'numerics');
  hard('phys_substep_s', 'physiology chain sub-step', 's', 0.01, 'stepSim()', 'S.physAcc >= 0.01 gates the physiology step. Only active with the chain on.', 'numerics');

  return out;
}

// ---------------------------------------------------------------------------------------------
// Cross-parameter constraints the solver DOES NOT enforce. These are not styling: each one is a
// combination at which the model contradicts itself, found by sweeping and verified in the solver's
// own derive()/CL(). A sweep can walk into every one of them, so they are declared, checked and
// shown, and the sweep rows carry the same flags.
// ---------------------------------------------------------------------------------------------
export const CONSTRAINTS = [
  {
    id: 'polar-consistent-with-CLmax',
    keys: ['CL_max', 'CL_at_zero_deg', 'glide_alpha_deg', 'stall_alpha_deg'],
    test: v => v.CL_max > v.CL_at_zero_deg,
    message: v => 'CL_max (' + v.CL_max + ') is not above CL_at_zero_deg (' + v.CL_at_zero_deg + '), so index.html\'s C_L slope (CL_max - CL0)/stall is ' +
      (v.CL_max === v.CL_at_zero_deg ? 'zero' : 'NEGATIVE') + ' and CL() returns more lift at the glide angle than CL_max allows. ' +
      'v_min is computed from CL_max while the forces come from the polar, and the solver does not tie them together, so the fish glides below its own v_min. ' +
      'Verified in derive() and CL(): at CL_max 0.30 with CL0 0.40 the glide C_L is 0.386 and v_min reads 15.89 m/s while the fish launches at 13.79 m/s and still glides 160 m.',
  },
  {
    id: 'glide-alpha-inside-the-polar',
    keys: ['glide_alpha_deg', 'stall_alpha_deg'],
    test: v => v.glide_alpha_deg <= v.stall_alpha_deg,
    message: v => 'the glide angle of attack (' + v.glide_alpha_deg + ' deg) is past the stall (' + v.stall_alpha_deg + ' deg), so the glide runs on CL()\'s post-stall branch, whose shape is an assumed straight line to zero at a hard-coded 60 deg.',
  },
  {
    id: 'lobe-shorter-than-the-start-depth',
    keys: ['lobe_length_m', 'start_depth_m'],
    test: v => Math.abs(v.start_depth_m) > v.lobe_length_m,
    message: v => 'the run starts at ' + v.start_depth_m + ' m with a lobe of ' + v.lobe_length_m + ' m, so the body centre begins inside the taxi band and the swim phase never runs.',
  },
  {
    id: 'reentry-below-takeoff-target',
    keys: ['reentry_min_speed_m_s', 'takeoff_speed_target_m_s'],
    test: v => v.reentry_min_speed_m_s < v.takeoff_speed_target_m_s,
    message: v => 'the re-entry cut-off (' + v.reentry_min_speed_m_s + ' m/s) is not below the take-off target (' + v.takeoff_speed_target_m_s + ' m/s), so the run stops after the first glide whatever else happens.',
  },
];

/** Which declared cross-parameter constraints a value set breaks. */
export function checkConstraints(values) {
  const out = [];
  for (const c of CONSTRAINTS) {
    if (c.keys.some(k => values[k] == null)) continue;
    let ok = true;
    try { ok = !!c.test(values); } catch (e) { continue; }
    if (!ok) out.push({ id: c.id, keys: c.keys, message: c.message(values) });
  }
  return out;
}

/** The value set every parameter's source supports: `default` for each schema entry. */
export function sourcedDefaults(schema) {
  const v = {};
  for (const p of schema) if (p.settable) v[p.key] = p.default;
  return v;
}

/** Which keys have been moved off their sourced value. */
export function movedKeys(schema, values) {
  const out = [];
  for (const p of schema) {
    if (!p.settable) continue;
    const a = values[p.key], b = p.default;
    if (a == null && b == null) continue;
    if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > Math.max(1e-12, Math.abs(b) * 1e-9)) out.push(p.key); }
    else if (a !== b) out.push(p.key);
  }
  return out;
}

const fmt = (v, p) => v == null ? '(unset)' : (typeof v === 'boolean' ? (v ? 'on' : 'off') : (typeof v === 'number' ? (Math.abs(v) >= 1000 || (Math.abs(v) < 0.001 && v !== 0) ? v.toPrecision(4) : String(+v.toPrecision(6))) : String(v)));

/** The sentence the brief asks for, verbatim in shape: "moved off source: 0.78 -> 0.91 (measured, ...)". */
export function movedSentence(p, value) {
  return 'moved off source: ' + fmt(p.default, p) + ' → ' + fmt(value, p) + ' (' + p.kind + ', ' + p.source + ')';
}

// ---------------------------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------------------------
const Q = 'p.';
/** Only the moved parameters go in the link, so a link stays short and says what it changed. */
export function encodeToQuery(schema, values, extra) {
  const q = new URLSearchParams();
  for (const k of movedKeys(schema, values)) {
    const v = values[k];
    q.set(Q + k, v == null ? '' : (typeof v === 'boolean' ? (v ? '1' : '0') : String(v)));
  }
  if (extra) for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') q.set(k, String(v));
  return q;
}
export function decodeFromQuery(schema, query, into) {
  const q = query instanceof URLSearchParams ? query : new URLSearchParams(String(query || ''));
  const values = Object.assign({}, into || sourcedDefaults(schema));
  const byKey = new Map(schema.map(p => [p.key, p]));
  const applied = [];
  for (const [k, raw] of q.entries()) {
    if (!k.startsWith(Q)) continue;
    const p = byKey.get(k.slice(Q.length));
    if (!p || !p.settable) continue;
    if (p.type === 'bool') values[p.key] = raw === '1' || raw === 'true';
    else if (raw === '') values[p.key] = null;
    else if (isFinite(+raw)) values[p.key] = +raw;
    else continue;
    applied.push(p.key);
  }
  return { values, applied };
}

// ---------------------------------------------------------------------------------------------
// Named sets in localStorage (every access wrapped; a blocked or full store must not break the page)
// ---------------------------------------------------------------------------------------------
const LS = 'delphi.sim.paramsets.v1';
function readStore() { try { const s = localStorage.getItem(LS); const j = s ? JSON.parse(s) : null; return (j && typeof j === 'object' && !Array.isArray(j)) ? j : {}; } catch (e) { return {}; } }
function writeStore(o) { try { localStorage.setItem(LS, JSON.stringify(o)); return true; } catch (e) { return false; } }
export function listSets() { return Object.keys(readStore()).sort(); }
export function saveSet(name, values, meta) {
  const n = String(name || '').trim(); if (!n) return { ok: false, why: 'a set needs a name' };
  const o = readStore(); o[n] = { saved_at: new Date().toISOString(), values: values, meta: meta || null };
  return writeStore(o) ? { ok: true } : { ok: false, why: 'localStorage refused the write (full, or blocked in this context); the link still carries the set' };
}
export function loadSet(name) { const r = readStore()[name]; return r ? r.values : null; }
export function deleteSet(name) { const o = readStore(); delete o[name]; return writeStore(o); }

/** Diff two value sets against the schema. Returns only the keys that differ. */
export function diffSets(schema, a, b) {
  const rows = [];
  for (const p of schema) {
    if (!p.settable) continue;
    const x = a ? a[p.key] : undefined, y = b ? b[p.key] : undefined;
    const same = (typeof x === 'number' && typeof y === 'number') ? Math.abs(x - y) <= Math.max(1e-12, Math.abs(y) * 1e-9) : x === y;
    if (same) continue;
    rows.push({ key: p.key, label: p.label, unit: p.unit, kind: p.kind, source: p.source, group: p.group, a: x, b: y, sourced: p.default });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// mountParams
// ---------------------------------------------------------------------------------------------
const CSS = `
.pp{--pp-gap:10px}
.pp *{box-sizing:border-box}
.pp .pp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}
.pp .pp-bar .pp-grow{flex:1 1 auto}
.pp input[type=text],.pp input[type=number],.pp select{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:4px 6px}
.pp input[type=number]{width:11ch;font-variant-numeric:tabular-nums}
.pp input[type=range]{width:100%;accent-color:var(--accent);margin:0}
.pp h4{margin:16px 0 2px;font-size:1rem;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.pp h4 .pp-n{font-weight:400;color:var(--mute);font-size:.8rem}
.pp .pp-blurb{color:var(--mute);font-size:.82rem;margin:0 0 8px}
.pp .pp-row{border-top:1px solid var(--line);padding:8px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,190px);gap:4px 12px;align-items:start}
.pp .pp-row.pp-moved{background:color-mix(in srgb,var(--warn) 9%,transparent);border-left:3px solid var(--warn);padding-left:8px;margin-left:-11px}
.pp .pp-row.pp-ro{opacity:.82}
.pp .pp-lab{font-weight:600;font-size:.9rem;line-height:1.35}
.pp .pp-lab .pp-u{font-weight:400;color:var(--mute)}
.pp .pp-meta{font-size:.76rem;color:var(--mute);margin:2px 0 0}
.pp .pp-ctl{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.pp .pp-ctl .pp-slide{flex:1 1 100%;min-width:120px}
.pp .pp-src{font-size:.76rem;color:var(--mute);margin:3px 0 0;overflow-wrap:anywhere}
.pp .pp-src b{color:var(--ink);font-weight:600}
.pp .pp-off{font-size:.78rem;color:var(--warn);font-weight:600;margin:3px 0 0;overflow-wrap:anywhere}
.pp .pp-off .pp-mini{font-weight:400;color:var(--mute)}
.pp .pp-badge{display:inline-block;padding:0 7px;border-radius:99px;font-size:.7rem;border:1px solid var(--line);background:var(--soft);color:var(--mute);white-space:nowrap;vertical-align:1px;font-weight:600}
.pp .k-measured{color:var(--ok);border-color:var(--ok)}
.pp .k-second{color:var(--s1,#2a78d6);border-color:var(--s1,#2a78d6)}
.pp .k-derived{color:var(--mute)}
.pp .k-calib{color:var(--s2,#eb6834);border-color:var(--s2,#eb6834)}
.pp .k-borrow{color:var(--viol,#6b4fb3);border-color:var(--viol,#6b4fb3)}
.pp .k-assumed{color:var(--warn);border-color:var(--warn)}
.pp .k-unknown{color:var(--bad);border-color:var(--bad)}
.pp .pp-hc{color:var(--bad);border-color:var(--bad)}
.pp .pp-counts{display:flex;gap:10px;flex-wrap:wrap;font-size:.78rem;color:var(--mute);margin:2px 0 10px}
.pp .pp-diff{width:100%;border-collapse:collapse;font-size:.82rem;margin-top:8px}
.pp .pp-diff th,.pp .pp-diff td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.pp .pp-diff th{color:var(--mute);font-weight:600}
.pp .pp-diff td.pp-num{font-variant-numeric:tabular-nums;white-space:nowrap}
.pp .pp-note{font-size:.78rem;color:var(--mute);margin:6px 0 0}
.pp .pp-msg{font-size:.8rem;margin:6px 0 0}
.pp .pp-msg.bad{color:var(--bad)}
.pp .pp-msg.ok{color:var(--ok)}
.pp .pp-cons{border-left:4px solid var(--bad);background:color-mix(in srgb,var(--bad) 8%,transparent);padding:8px 10px;border-radius:0 8px 8px 0;font-size:.82rem;margin:0 0 10px}
.pp .pp-cons ul{margin:5px 0 0 18px;padding:0}
.pp .pp-cons li{margin:3px 0}
@media (max-width:560px){
  .pp .pp-row{grid-template-columns:minmax(0,1fr)}
  .pp .pp-ctl{justify-content:flex-start}
  .pp input[type=number]{width:9ch}
  .pp .pp-diff{font-size:.76rem}
  .pp .pp-diff th,.pp .pp-diff td{padding:3px 4px}
}
`;
let cssDone = false;
function injectCss(doc) {
  if (cssDone) return; cssDone = true;
  const s = doc.createElement('style'); s.textContent = CSS; doc.head.appendChild(s);
}

/**
 * mountParams(el, {schema, values, onChange}) -> controller
 * Renders every schema entry, grouped, with provenance, "moved off source" marks, resets,
 * URL state, named sets and a diff view. Returns {get, set, reset, resetKey, link, refresh, el}.
 */
export function mountParams(el, opts) {
  const { schema } = opts;
  const doc = el.ownerDocument || document;
  injectCss(doc);
  let values = Object.assign(sourcedDefaults(schema), opts.values || {});
  const onChange = opts.onChange || (() => { });
  el.classList.add('pp');

  const byKey = new Map(schema.map(p => [p.key, p]));
  const rows = new Map();
  let msgEl = null;

  function emit(key) { try { onChange(get(), key); } catch (e) { console.error('params-panel onChange threw', e); } }
  function get() { return Object.assign({}, values); }
  function setValues(v, { silent = false, key = null } = {}) {
    values = Object.assign(sourcedDefaults(schema), v || {});
    refresh();
    if (!silent) emit(key);
  }
  function setOne(key, v, { silent = false } = {}) {
    const p = byKey.get(key); if (!p || !p.settable) return;
    values[key] = v; refreshRow(key); updateCounts();
    if (!silent) emit(key);
  }

  // ---- header -------------------------------------------------------------------------------
  const bar = doc.createElement('div'); bar.className = 'pp-bar';
  bar.innerHTML =
    '<button type="button" data-a="reset-all">Reset to sourced defaults</button>' +
    '<button type="button" data-a="link">Copy link to this set</button>' +
    '<span class="pp-grow"></span>' +
    '<input type="text" data-f="name" placeholder="name this set" size="14">' +
    '<button type="button" data-a="save">Save</button>' +
    '<select data-f="sets"></select>' +
    '<button type="button" data-a="load">Load</button>' +
    '<button type="button" data-a="del">Delete</button>' +
    '<button type="button" data-a="diff">Diff two sets</button>';
  el.appendChild(bar);
  const counts = doc.createElement('div'); counts.className = 'pp-counts'; el.appendChild(counts);
  const consEl = doc.createElement('div'); consEl.className = 'pp-cons'; consEl.hidden = true; el.appendChild(consEl);
  msgEl = doc.createElement('div'); msgEl.className = 'pp-msg'; el.appendChild(msgEl);
  const diffBox = doc.createElement('div'); diffBox.style.display = 'none'; el.appendChild(diffBox);
  const body = doc.createElement('div'); el.appendChild(body);

  function msg(t, cls) { msgEl.className = 'pp-msg ' + (cls || ''); msgEl.textContent = t || ''; }

  // ---- rows ---------------------------------------------------------------------------------
  for (const g of GROUPS) {
    const list = schema.filter(p => p.group === g.id);
    if (!list.length) continue;
    const h = doc.createElement('h4');
    const nSet = list.filter(p => p.settable).length;
    h.innerHTML = esc(g.label) + ' <span class="pp-n">' + list.length + ' parameters, ' + nSet + ' tunable, ' + (list.length - nSet) + ' hard-coded</span>';
    body.appendChild(h);
    const bl = doc.createElement('p'); bl.className = 'pp-blurb'; bl.textContent = g.blurb; body.appendChild(bl);
    for (const p of list) body.appendChild(buildRow(p));
  }

  function buildRow(p) {
    const row = doc.createElement('div');
    row.className = 'pp-row' + (p.settable ? '' : ' pp-ro');
    row.dataset.key = p.key;
    const left = doc.createElement('div');
    const right = doc.createElement('div'); right.className = 'pp-ctl';

    const badge = '<span class="pp-badge ' + (p.settable ? KIND_CLASS[p.kind] : 'pp-hc') + '">' + esc(p.settable ? KIND_SHORT[p.kind] : 'hard-coded') + '</span>';
    const rawNote = (p.raw_kind && kindOf(p.raw_kind) !== String(p.raw_kind).toLowerCase() && p.settable)
      ? ' <span class="pp-badge">params.json says &ldquo;' + esc(p.raw_kind) + '&rdquo;</span>' : '';
    left.innerHTML =
      '<div class="pp-lab">' + esc(p.label) + ' <span class="pp-u">' + esc(p.unit === '1' || p.unit === 'bool' ? '' : p.unit) + '</span> ' + badge + rawNote + '</div>' +
      '<div class="pp-meta"><code>' + esc(p.key) + '</code>' +
      (p.settable && p.type === 'number' ? ' &middot; range ' + esc(fmt(p.min)) + ' to ' + esc(fmt(p.max)) + ' <span title="' + (p.range_kind === 'sourced-range' ? 'the min/max committed in params.json' : 'a panel default range, not sourced') + '">(' + (p.range_kind === 'sourced-range' ? 'range from params.json' : 'panel range, not sourced') + ')</span>' : '') +
      ' &middot; default ' + esc(fmt(p.default, p)) +
      (p.used_by ? ' &middot; used by ' + esc(p.used_by) : '') + '</div>' +
      '<div class="pp-src"><b>source:</b> ' + esc(p.source) + (p.note ? ' <i>' + esc(p.note) + '</i>' : '') + '</div>' +
      '<div class="pp-off" hidden></div>';

    if (!p.settable) {
      right.innerHTML = '<span class="pp-badge">' + esc(fmt(p.default, p)) + '</span>';
    } else if (p.type === 'bool') {
      right.innerHTML = '<label class="pp-meta" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-r="chk"> on</label>' +
        '<button type="button" data-r="reset" title="reset this parameter to its sourced value">reset</button>';
    } else {
      right.innerHTML =
        '<input type="number" data-r="numv" step="any">' +
        '<button type="button" data-r="reset" title="reset this parameter to its sourced value">reset</button>' +
        '<input class="pp-slide" type="range" data-r="rng" min="' + p.min + '" max="' + p.max + '" step="' + (p.step || (p.max - p.min) / 500 || 'any') + '">';
    }
    row.appendChild(left); row.appendChild(right);
    rows.set(p.key, row);

    const q = s => row.querySelector('[data-r="' + s + '"]');
    if (p.settable) {
      const rst = q('reset'); if (rst) rst.onclick = () => setOne(p.key, p.default);
      if (p.type === 'bool') { const c = q('chk'); c.onchange = () => setOne(p.key, c.checked); }
      else {
        const n = q('numv'), r = q('rng');
        n.oninput = () => { const t = n.value.trim(); setOne(p.key, t === '' ? null : (isFinite(+t) ? +t : values[p.key])); };
        r.oninput = () => { n.value = r.value; setOne(p.key, +r.value); };
      }
    }
    return row;
  }

  function refreshRow(key) {
    const p = byKey.get(key), row = rows.get(key);
    if (!p || !row || !p.settable) return;
    const v = values[key];
    const q = s => row.querySelector('[data-r="' + s + '"]');
    if (p.type === 'bool') { const c = q('chk'); if (c) c.checked = !!v; }
    else {
      const n = q('numv'), r = q('rng');
      if (n && doc.activeElement !== n) n.value = v == null ? '' : v;
      if (r && v != null) r.value = Math.min(p.max, Math.max(p.min, v));
    }
    const moved = movedKeys(schema, values).includes(key);
    row.classList.toggle('pp-moved', moved);
    const off = row.querySelector('.pp-off');
    if (off) {
      off.hidden = !moved;
      if (moved) {
        const outside = p.type === 'number' && v != null && (v < p.min || v > p.max);
        off.innerHTML = esc(movedSentence(p, v)) +
          (outside ? ' <span class="pp-mini">&mdash; and outside the declared range ' + esc(fmt(p.min)) + ' to ' + esc(fmt(p.max)) + '</span>' : '');
      }
    }
  }

  function updateCounts() {
    const set = schema.filter(p => p.settable);
    const byKind = {};
    for (const p of set) byKind[p.kind] = (byKind[p.kind] || 0) + 1;
    const mv = movedKeys(schema, values);
    const mvKinds = {};
    for (const k of mv) { const p = byKey.get(k); mvKinds[p.kind] = (mvKinds[p.kind] || 0) + 1; }
    counts.innerHTML =
      '<span><b style="color:var(--ink)">' + schema.length + '</b> parameters in the schema: ' + set.length + ' tunable, ' + (schema.length - set.length) + ' hard-coded in index.html</span>' +
      KINDS.filter(k => byKind[k]).map(k => '<span><span class="pp-badge ' + KIND_CLASS[k] + '">' + esc(KIND_SHORT[k]) + '</span> ' + byKind[k] + '</span>').join('') +
      '<span style="color:' + (mv.length ? 'var(--warn)' : 'var(--mute)') + '"><b>' + mv.length + ' moved off source</b>' +
      (mv.length ? ' (' + KINDS.filter(k => mvKinds[k]).map(k => mvKinds[k] + ' ' + KIND_SHORT[k]).join(', ') + ')' : '') + '</span>';
    el.dataset.moved = String(mv.length);
    const broken = checkConstraints(values);
    el.dataset.constraintsBroken = String(broken.length);
    consEl.hidden = !broken.length;
    if (broken.length) consEl.innerHTML = '<b>' + broken.length + ' cross-parameter constraint' + (broken.length > 1 ? 's' : '') +
      ' the solver does not enforce ' + (broken.length > 1 ? 'are' : 'is') + ' broken by these values</b><ul>' +
      broken.map(b => '<li><code>' + esc(b.id) + '</code> &mdash; ' + esc(b.message) + '</li>').join('') + '</ul>';
  }

  function refreshSets() {
    const sel = bar.querySelector('[data-f="sets"]');
    const cur = sel.value;
    const names = listSets();
    sel.innerHTML = '<option value="">(saved sets: ' + names.length + ')</option>' + names.map(n => '<option>' + esc(n) + '</option>').join('');
    if (names.includes(cur)) sel.value = cur;
  }

  function refresh() { for (const p of schema) if (p.settable) refreshRow(p.key); updateCounts(); refreshSets(); }

  // ---- diff view ----------------------------------------------------------------------------
  function renderDiff() {
    const names = listSets();
    const options = ['__current', '__sourced'].concat(names);
    const lab = n => n === '__current' ? 'current panel values' : n === '__sourced' ? 'sourced defaults' : n;
    const of = n => n === '__current' ? get() : n === '__sourced' ? sourcedDefaults(schema) : loadSet(n);
    diffBox.style.display = '';
    const prevA = diffBox.querySelector('[data-f="da"]'), prevB = diffBox.querySelector('[data-f="db"]');
    const a0 = (prevA && prevA.value) || '__current', b0 = (prevB && prevB.value) || '__sourced';
    const sel = (f, v) => '<select data-f="' + f + '">' + options.map(o => '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(lab(o)) + '</option>').join('') + '</select>';
    const A = of(a0), B = of(b0);
    const rowsD = (A && B) ? diffSets(schema, A, B) : [];
    diffBox.innerHTML =
      '<div class="pp-bar">Diff ' + sel('da', a0) + ' against ' + sel('db', b0) +
      ' <button type="button" data-a="diffclose">close</button></div>' +
      (!A || !B ? '<p class="pp-note">one of those sets could not be read from localStorage.</p>' :
        !rowsD.length ? '<p class="pp-note">no differences.</p>' :
          '<table class="pp-diff"><caption class="pp-note" style="text-align:left;caption-side:top">' + rowsD.length + ' of ' + schema.filter(p => p.settable).length + ' tunable parameters differ.</caption>' +
          '<thead><tr><th>parameter</th><th>' + esc(lab(a0)) + '</th><th>' + esc(lab(b0)) + '</th><th>sourced</th><th>kind</th></tr></thead><tbody>' +
          rowsD.map(r => '<tr><td>' + esc(r.label) + ' <code>' + esc(r.key) + '</code>' + (r.unit && r.unit !== '1' && r.unit !== 'bool' ? ' <span class="pp-u">' + esc(r.unit) + '</span>' : '') + '</td>' +
            '<td class="pp-num">' + esc(fmt(r.a)) + '</td><td class="pp-num">' + esc(fmt(r.b)) + '</td><td class="pp-num">' + esc(fmt(r.sourced)) + '</td>' +
            '<td><span class="pp-badge ' + KIND_CLASS[r.kind] + '">' + esc(KIND_SHORT[r.kind]) + '</span></td></tr>').join('') +
          '</tbody></table>');
    diffBox.querySelector('[data-a="diffclose"]').onclick = () => { diffBox.style.display = 'none'; };
    for (const f of ['da', 'db']) diffBox.querySelector('[data-f="' + f + '"]').onchange = renderDiff;
  }

  // ---- header actions -----------------------------------------------------------------------
  bar.querySelector('[data-a="reset-all"]').onclick = () => { setValues(sourcedDefaults(schema)); msg('All ' + schema.filter(p => p.settable).length + ' tunable parameters are back on their sourced values.', 'ok'); };
  bar.querySelector('[data-a="link"]').onclick = () => {
    const u = link();
    msg(u, '');
    try { navigator.clipboard.writeText(u); msg(u + '  (copied)', 'ok'); } catch (e) { }
  };
  bar.querySelector('[data-a="save"]').onclick = () => {
    const n = bar.querySelector('[data-f="name"]').value;
    const r = saveSet(n, get(), { schema_size: schema.length, moved: movedKeys(schema, values) });
    refreshSets(); msg(r.ok ? 'Saved set "' + n + '".' : r.why, r.ok ? 'ok' : 'bad');
    if (r.ok) bar.querySelector('[data-f="sets"]').value = String(n).trim();
  };
  bar.querySelector('[data-a="load"]').onclick = () => {
    const n = bar.querySelector('[data-f="sets"]').value;
    if (!n) return msg('pick a saved set first.', 'bad');
    const v = loadSet(n);
    if (!v) return msg('set "' + n + '" could not be read.', 'bad');
    setValues(v); msg('Loaded set "' + n + '".', 'ok');
  };
  bar.querySelector('[data-a="del"]').onclick = () => {
    const n = bar.querySelector('[data-f="sets"]').value;
    if (!n) return msg('pick a saved set first.', 'bad');
    deleteSet(n); refreshSets(); msg('Deleted set "' + n + '".', 'ok');
  };
  bar.querySelector('[data-a="diff"]').onclick = renderDiff;

  function link(extra) {
    const q = encodeToQuery(schema, values, extra);
    const base = (typeof location !== 'undefined' ? location.origin + location.pathname : '');
    const s = q.toString();
    return base + (s ? '?' + s : '');
  }

  refresh();
  return {
    el, schema,
    get, set: setValues, setOne,
    reset: () => setValues(sourcedDefaults(schema)),
    resetKey: k => setOne(k, (byKey.get(k) || {}).default),
    moved: () => movedKeys(schema, values),
    link, refresh, showDiff: renderDiff, message: msg,
  };
}
