// altitude.mjs: high altitude. Thinner air raises the minimum glide speed (v_min ~ 1/sqrt(rho)) and the power
// to fly; lower O2 partial pressure lowers arterial O2 content (aerobic supply) for a flier, and lowers the O2
// tension of water at the surface of a high lake for a swimmer. Atmosphere: NASA Glenn troposphere curve fit,
// the same one physics/flier/tff/design.py and lean/Delphi/Altitude.lean use. Pure ESM. No bird data.
import { G, PARK_CHOI, glidePath, glideParts, launchSpeed, LAUNCH_HEIGHT_PARAM, LAUNCH_OVERRIDE_PARAM, LEAN_SRC, KIN_SRC, fickPower, FICK, val, metric, nullMetrics, liftingArea, airDensity, polarOf } from './glide.mjs';

const NASA = { url: 'https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html', cite: 'NASA Glenn Research Center, Earth Atmosphere Model, metric units (troposphere curve fit, valid to 11,000 m)' };
export function atmosphere(h) {
  const T = 15.04 - 0.00649 * h;                                 // degC
  const p = 101.29 * Math.pow((T + 273.1) / 288.08, 5.256);      // kPa
  return { T_C: T, p_kPa: p, rho: p / (0.2869 * (T + 273.1)) };  // kg/m3
}
const pH2O = T => 0.61094 * Math.exp((17.625 * T) / (T + 243.04)); // kPa, Magnus form, as physiology/index.js and lib/state.mjs
// Rogers et al. 2016 Pcrit database: mean +/- SD Pcrit in the 'control' subset 5.15 +/- 2.21 kPa (across species).
const PCRIT = { mean: 5.15, sd: 2.21, cite: 'Rogers NJ, Urbina MA, Reardon EE, McKenzie DJ, Wilson RW (2016). A new analysis of hypoxia tolerance in fishes using a database of critical oxygen level (Pcrit). Conserv Physiol 4:cow012', doi: 'https://doi.org/10.1093/conphys/cow012' };
const O2_FRACTION = 0.2095; // standard dry-air O2 mole fraction 20.95% (baseline.json rounds it to 0.209)

const METRICS = [
  { key: 'air_pressure_kPa', label: 'Barometric pressure', unit: 'kPa', better: null },
  { key: 'air_temperature_C', label: 'Standard-atmosphere air temperature', unit: '°C', better: null },
  { key: 'air_density_kg_m3', label: 'Air density', unit: 'kg/m3', better: 'higher' },
  { key: 'air_pO2_kPa', label: 'O2 partial pressure of dry air', unit: 'kPa', better: 'higher' },
  { key: 'water_pO2_kPa', label: 'O2 tension of air-equilibrated surface water at this altitude', unit: 'kPa', better: 'higher' },
  { key: 'hypoxia_margin_kPa', label: 'Water pO2 minus a cross-species mean Pcrit (borrowed)', unit: 'kPa', better: 'higher' },
  { key: 'v_min_m_s', label: 'Minimum lift-supported airspeed at this altitude', unit: 'm/s', better: 'lower' },
  { key: 'v_min_ratio', label: 'v_min relative to sea level', unit: '1', better: 'lower' },
  { key: 'launch_airspeed_m_s', label: 'Launch speed reachable by this organism', unit: 'm/s', better: 'higher' },
  { key: 'glide_range_lean_bound_m', label: 'Glide distance covered by the Lean bound, h (L/D)max (independent of altitude)', unit: 'm', better: 'higher' },
  { key: 'kinetic_phase_m', label: 'Level kinetic-energy phase at this altitude (OUTSIDE the Lean theorem)', unit: 'm', better: 'higher' },
  { key: 'power_required_W', label: 'Power for level flight at v_min', unit: 'W', better: 'lower' },
  { key: 'aerobic_power_available_W', label: 'Fick aerobic power bound at this altitude (air breathing)', unit: 'W', better: 'higher' },
  { key: 'powered_flight_margin', label: 'Aerobic power available / required', unit: '1', better: 'higher' },
  { key: 'arterial_O2_content_ratio', label: 'Arterial O2 content relative to sea level (PaO2 = PiO2)', unit: '1', better: 'higher' },
];

export const needs = [{ field: 'pcrit_kPa', why: 'species critical O2 tension. Absent, a cross-species database mean (5.15 +/- 2.21 kPa) is borrowed; no zebrafish or flying-fish Pcrit was fetched.' }];

export default {
  key: 'altitude',
  title: 'High altitude: air density and O2 partial pressure for gliding, flight and aerobic supply',
  group: 'environment',
  params: [
    { key: 'altitude_m', label: 'Altitude above sea level', unit: 'm', default: 2000, min: 0, max: 11000, kind: 'assumed', source: 'design input; 11,000 m is the top of the troposphere fit' },
    LAUNCH_HEIGHT_PARAM,
    LAUNCH_OVERRIDE_PARAM,
  ],
  requires: ['mass_kg'],
  metrics: METRICS,
  needs,
  run(state, params = {}) {
    const p = { altitude_m: 2000, launch_height_m: 1, launch_airspeed_override_m_s: 0, ...params };
    const ls = launchSpeed(state, p.launch_airspeed_override_m_s);
    const h = p.altitude_m;
    const a = atmosphere(h), a0 = atmosphere(0);
    const rhoState = airDensity(state);
    const rho = rhoState.value * (a.rho / a0.rho); // scaled so that h = 0 reproduces glide.mjs exactly
    const Tw = val(state, 'temperature_C') ?? 25;
    const pO2air = O2_FRACTION * a.p_kPa;
    const pO2water = O2_FRACTION * (a.p_kPa - pH2O(Tw));
    const pcritState = val(state, 'pcrit_kPa');
    const pcrit = pcritState ?? PCRIT.mean;
    const m = val(state, 'mass_kg');
    const S = liftingArea(state);
    const span = val(state, 'pectoral_span_m');
    const P50 = val(state, 'hb_P50_kPa') ?? FICK.P50_kPa.value;
    const polar = polarOf(state);
    const notes = [];
    let inRange = h >= 0 && h <= 11000;
    if (!inRange) notes.push('Altitude outside the 0-11,000 m troposphere fit.');
    const prov = [
      { quantity: 'atmosphere T(h), p(h), rho(h)', value: 'T = 15.04 - 0.00649 h; p = 101.29 ((T+273.1)/288.08)^5.256; rho = p/(0.2869 (T+273.1))', kind: 'borrowed', source: `${NASA.cite}, ${NASA.url}: a mid-latitude standard atmosphere, not a measurement at any site` },
      { quantity: 'air O2 fraction', value: O2_FRACTION, kind: 'measured-secondhand', source: 'standard dry-air composition, O2 20.95% by mole (conditions/baseline.json rounds to 0.209)' },
      { quantity: 'sea-level air density (kg/m3)', value: rhoState.value, kind: rhoState.kind, source: `${rhoState.source}; scaled by rho_fit(h)/rho_fit(0)` },
      { quantity: 'water vapour pressure (kPa)', value: pH2O(Tw), kind: 'derived', source: 'Magnus form 0.61094 exp(17.625 T/(T+243.04)) (Alduchov & Eskridge 1996 coefficients), as physiology/index.js' },
      { quantity: 'Pcrit (kPa)', value: pcrit, kind: pcritState != null ? state.pcrit_kPa.kind || 'assumed' : 'borrowed', source: pcritState != null ? state.pcrit_kPa.source || 'state' : `${PCRIT.cite}, ${PCRIT.doi}: mean of the control subset across species (SD 2.21)` },
    ];
    notes.push('Water temperature is held at the state value; the cooling of a high lake with altitude is not modelled (the air temperature is reported but not applied to water).');
    // Aquatic O2 criterion
    const margin = pO2water - pcrit;
    let survives = null, limiting = null;
    if (pcritState != null) survives = margin > 0;
    else if (margin > PCRIT.sd) survives = true;
    else if (margin < -PCRIT.sd) survives = false;
    if (survives === false) limiting = `water pO2 ${pO2water.toFixed(1)} kPa is below Pcrit: aerobic metabolism cannot be sustained`;
    else if (survives === null) limiting = `water pO2 ${pO2water.toFixed(1)} kPa is within one SD of the borrowed cross-species Pcrit: cannot tell`;
    // Flight side
    let flightMetrics, feasible = null, feasibilityNote = null;
    if (m == null || S.value == null) {
      const why = m == null ? 'mass_kg is null' : S.reason;
      flightMetrics = nullMetrics(METRICS.slice(6), why);
      feasibilityNote = `flight not evaluated: ${why}`;
    } else {
      const W = m * G;
      const known = ls.value != null;
      const v0 = known ? ls.value : 0;
      const gp = glidePath({ W, S: S.value, rho, v0, h: p.launch_height_m, span });
      const gp0 = glidePath({ W, S: S.value, rho: rhoState.value, v0, h: p.launch_height_m, span });
      const canGlide = known ? v0 >= gp.vmin : null;
      const parts = glideParts(gp, canGlide);
      feasible = canGlide;
      feasibilityNote = !known ? `glide not evaluated: ${ls.reason}` : !canGlide ? `cannot glide at ${h} m: reachable launch speed ${v0.toFixed(2)} m/s is below v_min ${gp.vmin.toFixed(2)} m/s` : null;
      prov.push({ quantity: 'launch speed (m/s)', value: ls.value, kind: known ? ls.kind : 'assumed', source: known ? ls.source : `none: ${ls.reason}` });
      const Preq = (W * gp.vmin) / PARK_CHOI.LD_max;
      const fk = fickPower({ mass_kg: m, pO2_kPa: pO2air, P50_kPa: P50, Q_ml_s: val(state, 'cardiac_output_max_ml_s') });
      const fk0 = fickPower({ mass_kg: m, pO2_kPa: O2_FRACTION * a0.p_kPa, P50_kPa: P50, Q_ml_s: val(state, 'cardiac_output_max_ml_s') });
      prov.push({ quantity: 'glide polar C_Lmax / (L/D)max', value: `${PARK_CHOI.CL_max} / ${PARK_CHOI.LD_max}`, kind: polar.kind, source: polar.source });
      prov.push({ quantity: 'lifting area (m2)', value: S.value, kind: S.kind, source: S.source });
      prov.push({ quantity: 'Fick constants', value: `eta ${FICK.eta.value}, E ${FICK.E_J_per_ml.value.toFixed(2)} J/ml, cap ${FICK.hb_cap_ml_ml.value} ml/ml`, kind: 'calibrated', source: `${FICK.eta.source}; ${FICK.E_J_per_ml.source}; ${FICK.hb_cap_ml_ml.source}` });
      notes.push('Glide range from a given height in still air does not depend on air density (L/D does not); altitude shortens only the level, kinetic-energy phase, because v_min rises.');
      notes.push('Fick bound: PaO2 = inspired air PO2, gills working in air: a generous upper bound for a gill-breather. The Lean result (lean/Delphi/Altitude.lean) applies: a design infeasible at sea level is infeasible at every altitude.');
      flightMetrics = [
        metric('v_min_m_s', METRICS[6].label, gp.vmin, 'm/s', 'lower', 'derived', 'sqrt(2W/(rho(h) S C_Lmax))'),
        metric('v_min_ratio', METRICS[7].label, gp.vmin / gp0.vmin, '1', 'lower', 'derived', 'sqrt(rho(0)/rho(h))'),
        metric('launch_airspeed_m_s', METRICS[8].label, ls.value, 'm/s', 'higher', ls.kind || 'assumed', ls.source, ls.reason),
        metric('glide_range_lean_bound_m', METRICS[9].label, known ? parts.lean : null, 'm', 'higher', 'derived', canGlide ? LEAN_SRC : 'cannot glide: 0', ls.reason),
        metric('kinetic_phase_m', METRICS[10].label, known ? parts.kinetic : null, 'm', 'higher', 'derived', canGlide ? `${KIN_SRC}; at rho(h)` : 'cannot glide: 0', ls.reason),
        metric('power_required_W', METRICS[11].label, Preq, 'W', 'lower', 'derived', 'W v_min(h)/(L/D)max'),
        metric('aerobic_power_available_W', METRICS[12].label, fk.P_W, 'W', 'higher', 'derived', `eta E Q Ca(PO2 ${pO2air.toFixed(1)} kPa)`),
        metric('powered_flight_margin', METRICS[13].label, fk.P_W / Preq, '1', 'higher', 'derived', 'aerobic available / required'),
        metric('arterial_O2_content_ratio', METRICS[14].label, fk.Ca_ml_ml / fk0.Ca_ml_ml, '1', 'higher', 'derived', `Hill curve P50 ${P50.toFixed(2)} kPa, n 1.34, at PO2(h)/PO2(0)`),
      ];
    }
    const metrics = [
      metric('air_pressure_kPa', METRICS[0].label, a.p_kPa, 'kPa', null, 'derived', NASA.url),
      metric('air_temperature_C', METRICS[1].label, a.T_C, '°C', null, 'derived', NASA.url),
      metric('air_density_kg_m3', METRICS[2].label, rho, 'kg/m3', 'higher', 'derived', `${NASA.url}, scaled to the state's sea-level density`),
      metric('air_pO2_kPa', METRICS[3].label, pO2air, 'kPa', 'higher', 'derived', '0.2095 p(h), dry air (design.py uses 0.209)'),
      metric('water_pO2_kPa', METRICS[4].label, pO2water, 'kPa', 'higher', 'derived', '0.2095 (p(h) - pH2O(T_water)): surface water in equilibrium with moist air'),
      metric('hypoxia_margin_kPa', METRICS[5].label, margin, 'kPa', 'higher', pcritState != null ? 'derived' : 'borrowed', pcritState != null ? 'water pO2 - state pcrit_kPa' : `water pO2 - 5.15 kPa (cross-species mean, ${PCRIT.cite})`),
      ...flightMetrics,
    ];
    return {
      metrics, survives, feasible, feasibility_note: feasibilityNote, limiting, provenance: prov,
      scope: 'Standard (mid-latitude) atmosphere; air-equilibrated surface water; no acclimatisation (haematocrit, ventilation, cardiac output held fixed), no cold, no UV. survives = the fish survives living in water at this altitude (water pO2 against Pcrit); limiting explains survives only. feasible = it can glide at this altitude at its own reachable launch speed (feasibility_note says why not); powered flight is in powered_flight_margin. Pcrit is a cross-species mean unless the state provides one, so survives is null within one SD of it.',
      validity: { inRange, notes: notes.join(' ') },
    };
  },
  modelCard: {
    equations: [
      'T(h) = 15.04 - 0.00649 h; p(h) = 101.29 ((T + 273.1)/288.08)^5.256 kPa; rho = p / (0.2869 (T + 273.1))',
      'PO2_air = 0.2095 p(h); PO2_water = 0.2095 (p(h) - pH2O(T_water))',
      'v_min(h) = sqrt(2W/(rho(h) S C_Lmax)) = v_min(0) sqrt(rho(0)/rho(h))',
      'P_req(h) = W v_min(h)/(L/D)max; P_aerobic(h) <= eta E Q Ca(PO2_air(h))',
      'survives (aquatic): PO2_water - Pcrit > SD (true), < -SD (false), else null',
      'feasible (glide): organism launch speed >= v_min(h)',
    ],
    sources: [
      { cite: NASA.cite, doi_or_url: NASA.url },
      { cite: 'West JB, Lahiri S, Maret KH, Peters RM, Pizzo CJ (1983). Barometric pressures at extreme altitudes on Mt. Everest: physiological significance. J Appl Physiol 54:1188-1194 (validation)', doi_or_url: 'https://doi.org/10.1152/jappl.1983.54.5.1188' },
      { cite: PCRIT.cite, doi_or_url: PCRIT.doi },
      { cite: PARK_CHOI.cite, doi_or_url: PARK_CHOI.doi },
    ],
    validity: '0-11,000 m. The standard atmosphere under-predicts pressure at low latitudes by a few percent (validation below). The flight side inherits glide.mjs validity.',
    validatedAgainst: [
      { organism: 'none (atmosphere check)', observation: 'barometric pressure measured on Mt. Everest at 5,400 / 6,300 / 8,050 / 8,848 m: 400.4 / 351.0 / 283.6 / 253.0 Torr', predicted: '51.29 / 45.36 / 35.43 / 31.53 kPa', measured: '53.38 / 46.80 / 37.81 / 33.73 kPa', source: 'West et al. 1983 (https://doi.org/10.1152/jappl.1983.54.5.1188). PASS within 10% (errors -3.1% to -6.5%), systematically LOW: the paper attributes this to latitude (pressure at altitude is higher near the equator). pO2 at altitude is under-predicted by the same fraction.' },
      { organism: 'any fish', observation: 'gliding or flight performance at altitude', predicted: 'v_min rises 1/sqrt(rho): +16% at 3,000 m, +29% at 5,000 m', measured: 'none: no fish flies at altitude, and no fetched measurement exists', source: 'no organism-level validation is possible' },
    ],
  },
};
