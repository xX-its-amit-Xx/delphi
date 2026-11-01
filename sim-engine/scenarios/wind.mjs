// wind.mjs: steady headwind or tailwind and horizontal gusts acting on a glide. Ground distance = air distance
// minus wind x time (glide.mjs glidePath); takeoff water speed needed = v_min - headwind; gust stall margin and
// quasi-steady load factor. The launch speed is the organism's own (glide.mjs launchSpeed), never a default.
// Pure ESM. Reuses the physics/ polar unchanged. No bird data.
import { G, PARK_CHOI, glidePath, glideParts, launchSpeed, LAUNCH_HEIGHT_PARAM, LAUNCH_OVERRIDE_PARAM, LEAN_SRC, KIN_SRC, val, metric, nullMetrics, liftingArea, airDensity, polarOf } from './glide.mjs';

const METRICS = [
  { key: 'glide_range_lean_bound_m', label: 'Still-air glide distance covered by the Lean bound, h (L/D)max', unit: 'm', better: 'higher' },
  { key: 'kinetic_phase_m', label: 'Level kinetic-energy phase, still air (OUTSIDE the Lean theorem)', unit: 'm', better: 'higher' },
  { key: 'ground_distance_total_m', label: 'Ground distance with wind, both phases (NOT covered by the Lean theorem)', unit: 'm', better: 'higher' },
  { key: 'wind_distance_change_m', label: 'Ground distance minus still-air distance (-u x time airborne)', unit: 'm', better: 'higher' },
  { key: 'glide_time_s', label: 'Time airborne (bound)', unit: 's', better: 'higher' },
  { key: 'launch_airspeed_m_s', label: 'Launch speed reachable by this organism', unit: 'm/s', better: 'higher' },
  { key: 'v_min_m_s', label: 'Minimum lift-supported airspeed', unit: 'm/s', better: 'lower' },
  { key: 'takeoff_water_speed_m_s', label: 'Speed over the water needed to reach v_min airspeed', unit: 'm/s', better: 'lower' },
  { key: 'gust_stall_margin_m_s', label: 'Glide airspeed minus gust minus v_min (negative = stall in a lull)', unit: 'm/s', better: 'higher' },
  { key: 'gust_load_factor', label: 'Quasi-steady lift / weight in a gust peak', unit: '1', better: 'lower' },
];

const LIN = (value, unit, kind, source, reason) => (value == null || (typeof value === 'number' && !Number.isFinite(value)) ? { value: null, unit, kind: 'assumed', source: 'none', reason: reason || 'not computable from the inputs given' } : { value, unit, kind, source });

export const needs = [{ field: 'lifting_area_m2', why: 'as glide.mjs' }, { field: 'launch_speed_m_s', why: 'as glide.mjs' }];

export default {
  key: 'wind',
  title: 'Wind on a glide: headwind, tailwind and horizontal gusts',
  group: 'environment',
  params: [
    { key: 'headwind_m_s', label: 'Steady headwind (negative = tailwind)', unit: 'm/s', default: 5, min: -20, max: 20, kind: 'assumed', source: 'design input' },
    { key: 'gust_m_s', label: 'Horizontal gust amplitude (+/-)', unit: 'm/s', default: 2, min: 0, max: 10, kind: 'assumed', source: 'design input; quasi-steady treatment' },
    LAUNCH_HEIGHT_PARAM,
    LAUNCH_OVERRIDE_PARAM,
  ],
  requires: ['mass_kg'],
  metrics: METRICS,
  needs,
  run(state, params = {}) {
    const p = { headwind_m_s: 5, gust_m_s: 2, launch_height_m: 1, launch_airspeed_override_m_s: 0, ...params };
    const m = val(state, 'mass_kg');
    const S = liftingArea(state);
    const span = val(state, 'pectoral_span_m');
    const rho = airDensity(state);
    const polar = polarOf(state);
    const ls = launchSpeed(state, p.launch_airspeed_override_m_s);
    const prov = [
      { quantity: 'glide polar C_Lmax / (L/D)max', value: `${PARK_CHOI.CL_max} / ${PARK_CHOI.LD_max}`, kind: polar.kind, source: polar.source },
      { quantity: 'C_L at 0 deg (sets the descent airspeed)', value: PARK_CHOI.CL_at_zero_deg, kind: 'assumed', source: 'dashboard/public/t/physics/sim/params.json' },
      { quantity: 'air density (kg/m3)', value: rho.value, kind: rho.kind, source: rho.source },
      { quantity: 'lifting area (m2)', value: S.value, kind: S.kind, source: S.source },
      { quantity: 'launch speed (m/s)', value: ls.value, kind: ls.value != null ? ls.kind : 'assumed', source: ls.value != null ? ls.source : `none: ${ls.reason}` },
    ];
    if (m == null || S.value == null) {
      const why = m == null ? 'mass_kg is null' : S.reason;
      return { metrics: nullMetrics(METRICS, why), survives: null, feasible: null, limiting: null, provenance: prov, scope: `Nothing computed: ${why}.`, validity: { inRange: false, notes: why } };
    }
    const W = m * G;
    const u = p.headwind_m_s;
    const known = ls.value != null;
    const v0 = known ? ls.value : 0;
    const gw = glidePath({ W, S: S.value, rho: rho.value, v0, h: p.launch_height_m, span, u });
    const canGlide = known ? v0 >= gw.vmin : null;
    const parts = glideParts(gw, canGlide);
    const ground = canGlide ? gw.ground_range_m : known ? 0 : null;
    const time = canGlide ? gw.time_s : known ? 0 : null;
    const vRef = canGlide ? Math.max(gw.vmin, Math.min(v0, gw.vLD)) : null;
    const stallMargin = canGlide ? vRef - p.gust_m_s - gw.vmin : null;
    const n = canGlide ? (1 + p.gust_m_s / vRef) ** 2 : null;
    const notes = [];
    let inRange = true;
    if (canGlide && Math.abs(u) >= gw.vmin) notes.push(`|wind| ${Math.abs(u)} m/s is at or above v_min ${gw.vmin.toFixed(1)} m/s: in a headwind the fish can hold position or drift backwards over the ground.`);
    if (m < 0.02 || m > 0.4) { inRange = false; notes.push(`Mass ${m} kg is outside the 0.02-0.4 kg range of the glide polar (extrapolated).`); }
    notes.push('Uniform wind, no shear, no wave-induced updrafts (not modelled); gusts quasi-steady (lift scales with airspeed squared, no unsteady aerodynamics).');
    notes.push('A headwind helps takeoff (takeoff_water_speed_m_s) but the launch speed itself is taken as airspeed, as in glide.mjs.');
    const lean_inputs = {
      descent_airspeed_m_s: LIN(canGlide ? gw.vLD : null, 'm/s', 'derived', 'best-L/D airspeed v_min sqrt(C_Lmax/C_L(0 deg)), C_L(0 deg) 0.53 (Park & Choi lift = weight at 0 deg, approximate)', known ? 'cannot glide' : ls.reason),
      descent_ground_distance_m: LIN(canGlide ? gw.phaseB.air_m - u * gw.phaseB.t_s : known ? 0 : null, 'm', 'derived', 'descent phase only: h (L/D)max - headwind x h (L/D)max / v_LD', ls.reason),
      launch_height_m: LIN(p.launch_height_m, 'm', 'assumed', 'launch_height_m parameter'),
      headwind_m_s: LIN(u, 'm/s', 'assumed', 'headwind_m_s parameter (negative = tailwind)'),
      LD_max: LIN(PARK_CHOI.LD_max, '1', polar.kind, polar.source),
    };
    const feasible = !known ? null : !canGlide ? false : stallMargin >= 0;
    const limiting = !known ? `glide not evaluated: ${ls.reason}`
      : !canGlide ? `cannot glide: reachable launch speed ${v0.toFixed(2)} m/s is below v_min ${gw.vmin.toFixed(2)} m/s`
      : stallMargin < 0 ? `a ${p.gust_m_s} m/s gust lull drops airspeed below v_min: stall risk`
      : gw.ground_range_m < 0 ? 'headwind exceeds the glide airspeed: net drift downwind' : null;
    const why = known ? null : ls.reason;
    const cg = canGlide === false ? 'cannot glide' : why;
    const metrics = [
      metric('glide_range_lean_bound_m', METRICS[0].label, known ? parts.lean : null, 'm', 'higher', 'derived', canGlide ? LEAN_SRC : 'cannot glide: 0', why),
      metric('kinetic_phase_m', METRICS[1].label, known ? parts.kinetic : null, 'm', 'higher', 'derived', canGlide ? KIN_SRC : 'cannot glide: 0', why),
      metric('ground_distance_total_m', METRICS[2].label, ground, 'm', 'higher', 'derived', canGlide ? 'air distance - headwind x time, per phase (glide.mjs glidePath); outside the still-air Lean theorem' : 'cannot glide: 0', why),
      metric('wind_distance_change_m', METRICS[3].label, canGlide ? gw.ground_range_m - gw.air_range_m : known ? 0 : null, 'm', 'higher', 'derived', '-u x time airborne', why),
      metric('glide_time_s', METRICS[4].label, time, 's', 'higher', 'derived', 'unchanged by a uniform wind', why),
      metric('launch_airspeed_m_s', METRICS[5].label, ls.value, 'm/s', 'higher', ls.kind || 'assumed', ls.source, ls.reason),
      metric('v_min_m_s', METRICS[6].label, gw.vmin, 'm/s', 'lower', 'derived', 'sqrt(2W/(rho S C_Lmax))'),
      metric('takeoff_water_speed_m_s', METRICS[7].label, Math.max(0, gw.vmin - u), 'm/s', 'lower', 'derived', 'v_min - headwind (airspeed = ground speed + headwind)'),
      metric('gust_stall_margin_m_s', METRICS[8].label, stallMargin, 'm/s', 'higher', 'derived', `min(launch speed, best-L/D airspeed ${gw.vLD.toFixed(2)} m/s, assumed C_L(0)) - gust - v_min`, cg),
      metric('gust_load_factor', METRICS[9].label, n, '1', 'lower', 'derived', '(1 + gust/V)^2 at constant lift coefficient', cg),
    ];
    return {
      metrics, lean_inputs, survives: null, feasible, feasibility_note: limiting, limiting: null, provenance: prov,
      scope: 'Kinematics of a glide in a uniform horizontal wind with the still-air polar at the organism\'s own launch speed; distances are upper bounds (as glide.mjs) and only glide_range_lean_bound_m (still air) is covered by the Lean theorem. No wind shear over waves, no updrafts, no unsteady gust response, no control or structural limit. survives = null (wind on a glide is not modelled as lethal); feasible = can glide and no stall in a gust lull.',
      validity: { inRange, notes: notes.join(' ') },
    };
  },
  modelCard: {
    equations: [
      'launch speed v0 = organism\'s own (glide.mjs); cannot glide if v0 < v_min (all distances 0)',
      'level phase: t_A = (L/D)_eff (v0 - v_min)/g; x_A,ground = (L/D)_eff (v0^2 - v_min^2)/(2g) - u t_A  (outside the Lean theorem)',
      'descent from h at v_LD: t_B = h (L/D)/v_LD; x_B,ground = h (L/D) - u t_B  (the still-air part h (L/D) is the Lean-covered bound)',
      'takeoff water speed = v_min - u',
      'gust: stall margin = V - gust - v_min; load factor n = (1 + gust/V)^2',
    ],
    sources: [
      { cite: PARK_CHOI.cite, doi_or_url: PARK_CHOI.doi },
      { cite: 'Makiguchi Y et al. (2013). Aquat Biol 18:105-111 (flying-fish leap speed ~10 m/s, citing Davenport 1994)', doi_or_url: 'https://doi.org/10.3354/ab00494' },
      { cite: 'Deng J et al. (2019). Bioinspir Biomim 14:046009 (Introduction, quoting Hertel 1966: a theoretical 48 m flight at 20 m/s into a 10 m/s headwind)', doi_or_url: 'https://doi.org/10.1088/1748-3190/ab23e6' },
    ],
    validity: 'As glide.mjs (0.02-0.4 kg, 0-10 m launch heights), uniform winds up to 20 m/s.',
    validatedAgainst: [
      { organism: 'any flying fish', observation: 'glide distance measured with a known wind', predicted: 'n/a', measured: 'none found: no fetched source reports a glide distance together with the wind speed', source: 'no validation possible; the only wind figure is Hertel 1966\'s THEORETICAL 48 m trajectory for Cypselurus californicus (0.38 kg, C_L 0.6, 20 m/s airspeed, 10 m/s headwind, ~10 m height), quoted second-hand by Deng 2019. It is a model, not an observation, and needs a wing area the sources do not give, so it was not compared.' },
    ],
  },
};
