// Tests for the environment scenarios (temperature, current, pressure, altitude, wind, glide).
// Run: node sim-engine/test/scenarios-environment.mjs
// Fail-once checks:  ENV_TEST_SABOTAGE=1 inverts every assertion (all must then FAIL, proving none is vacuous);
//                    ENV_TEST_MUTATE=mass|sl|fresh|air|species perturbs one fixture input; the checks that
//                    depend on it must fail (see ENVIRONMENT.md for the recorded fail-once runs).
// Fixtures are hand-built here (not taken from other agents' folders). No bird data.
import { validateModule, runScenario, validateResult } from '../scenarios/index.mjs';
import temperature from '../scenarios/temperature.mjs';
import current from '../scenarios/current.mjs';
import pressure from '../scenarios/pressure.mjs';
import altitude, { atmosphere } from '../scenarios/altitude.mjs';
import wind from '../scenarios/wind.mjs';
import glide from '../scenarios/glide.mjs';
import fs from 'node:fs';
import url from 'node:url';

const SABOTAGE = process.env.ENV_TEST_SABOTAGE === '1';
const MASS = process.env.ENV_TEST_MUTATE === 'mass' ? 2 : 1;
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  const ok = SABOTAGE ? !cond : !!cond;
  if (ok) pass++; else { fail++; failures.push(`${name}${detail ? ` (${detail})` : ''}`); }
}
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;
const F = (value, unit, kind = 'assumed', source = 'test fixture (hand-built)') => ({ value, unit, kind, source });

// ---- fixtures ---------------------------------------------------------------------------------------
// Zebrafish adult: SL 30 mm (adult zebrafish range; fixture value), mass 0.45 g, wetted area 4e-4 m2,
// red muscle 5% of myotome, fresh water 28 degC.
const zebrafish = {
  species: F('Danio rerio', null), design_id: F('zebrafish', null), ageDays: F(120, 'days after hatching'), stage: F('adult', null),
  SL_m: F(0.030, 'm'), mass_kg: F(0.00045 * MASS, 'kg'), body_density_kg_m3: F(null, 'kg/m3'), wetted_area_m2: F(4.0e-4, 'm2'),
  frontal_area_m2: F(2.5e-5, 'm2'), pectoral_area_both_m2: F(2.0e-5, 'm2'), pectoral_span_m: F(0.012, 'm'), caudal_area_m2: F(null, 'm2'),
  red_muscle_fraction: F(0.05, '-'), white_muscle_fraction: F(0.95, '-'), gill_area_m2: F(1.0e-4, 'm2'), hb_P50_kPa: F(3.31, 'kPa', 'borrowed'),
  has_swimbladder: F(true, 'bool'), temperature_C: F(28, 'degC'),
  ambient: { salinity_psu: F(0, 'psu'), water_density_kg_m3: F(996, 'kg/m3'), air_density_kg_m3: F(1.225, 'kg/m3'), pressure_kPa: F(101.325, 'kPa'), pO2_kPa: F(20.5, 'kPa') },
  parts: {},
};
// Flying fish adult: Park & Choi 2010 model L3 morphometrics (Cypselurus hiraii, 0.06 kg, SL 0.203 m, both pectoral
// fins 0.006377 m2, span 0.261 m); wetted area and red fraction are fixture values. Sea water 25 degC.
const flyingfish = {
  species: F('Cypselurus hiraii', null), design_id: F('flying-fish', null), ageDays: F(365, 'days after hatching'), stage: F('adult', null),
  SL_m: F(0.203, 'm', 'measured', 'park-choi-2010 Table 1 L3'), mass_kg: F(0.06 * MASS, 'kg', 'measured', 'park-choi-2010 Table 1 L3'), body_density_kg_m3: F(null, 'kg/m3'),
  wetted_area_m2: F(0.018, 'm2'), frontal_area_m2: F(7e-4, 'm2'), pectoral_area_both_m2: F(0.006377, 'm2', 'measured', 'park-choi-2010 Table 1 L3'),
  pectoral_span_m: F(0.261, 'm', 'measured', 'park-choi-2010 Table 1 L3'), caudal_area_m2: F(null, 'm2'), red_muscle_fraction: F(0.05, '-'), white_muscle_fraction: F(0.95, '-'),
  gill_area_m2: F(0.003, 'm2'), hb_P50_kPa: F(3.31, 'kPa', 'borrowed'), has_swimbladder: F(true, 'bool'), temperature_C: F(25, 'degC'),
  ambient: { salinity_psu: F(35, 'psu'), water_density_kg_m3: F(1025, 'kg/m3'), air_density_kg_m3: F(1.225, 'kg/m3'), pressure_kPa: F(101.325, 'kPa'), pO2_kPa: F(20.5, 'kPa') },
  parts: {},
};

// Zebrafish larva (3 days after hatching ~ 5 dpf, SL 4.8 mm, 0.85 mg) and a winged zebrafish (SL 30 mm with the
// flying-fish fin proportions scaled isometrically: both pectorals 1.39e-4 m2, span 38.6 mm).
const zlarva = { ...zebrafish, ageDays: F(3, 'days after hatching'), stage: F('larva', null), SL_m: F(0.0048, 'm'), mass_kg: F(8.5e-7, 'kg'), wetted_area_m2: F(1.2e-5, 'm2'), pectoral_area_both_m2: F(3e-7, 'm2'), pectoral_span_m: F(0.0015, 'm') };
const wingedZ = { ...zebrafish, design_id: F('winged-zebrafish', null), mass_kg: F(0.00051, 'kg'), pectoral_area_both_m2: F(1.39e-4, 'm2'), pectoral_span_m: F(0.0386, 'm') };

// Targeted input mutations (each must make specific checks fail): sl, fresh, air, species.
const MUT = process.env.ENV_TEST_MUTATE;
if (MUT === 'sl') zebrafish.SL_m = F(0.060, 'm');
if (MUT === 'fresh') flyingfish.ambient = { ...flyingfish.ambient, salinity_psu: F(0, 'psu'), water_density_kg_m3: F(998, 'kg/m3') };
if (MUT === 'air') flyingfish.ambient = { ...flyingfish.ambient, air_density_kg_m3: F(1.0, 'kg/m3') };
if (MUT === 'species') zebrafish.species = F('Danio aesculapii', null); // a congener: zebrafish data must NOT be applied

const ALL = { temperature, current, pressure, altitude, wind, glide };
const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];
const get = (r, k) => r.metrics.find(m => m.key === k)?.value;

// ---- interface checks, both fixtures, defaults ------------------------------------------------------
for (const [name, mod] of Object.entries(ALL)) {
  check(`${name}: validateModule`, validateModule(mod, name).length === 0, validateModule(mod, name).join('; '));
  check(`${name}: group environment`, mod.group === 'environment');
  check(`${name}: static metrics have units and snake_case keys`, mod.metrics.every(m => typeof m.unit === 'string' && m.unit.length > 0 && /^[a-z][a-z0-9_]*$/i.test(m.key) && !/\s/.test(m.key)));
  check(`${name}: params all have sources and kinds`, mod.params.every(p => p.source && KINDS.includes(p.kind) && p.min <= p.default && p.default <= p.max));
  check(`${name}: modelCard has sources with DOI/URL`, mod.modelCard.sources.length > 0 && mod.modelCard.sources.every(s => /^(https?:\/\/|physiology\/)/.test(s.doi_or_url)));
  check(`${name}: modelCard validatedAgainst present`, Array.isArray(mod.modelCard.validatedAgainst) && mod.modelCard.validatedAgainst.length > 0);
  for (const [fx, st] of [['zebrafish', zebrafish], ['flyingfish', flyingfish]]) {
    const r = runScenario(mod, st, {});
    check(`${name}/${fx}: runScenario ok`, r.ok === true, r.error + ' ' + JSON.stringify(r.errors || r.missing || ''));
    if (!r.ok) continue;
    check(`${name}/${fx}: validateResult clean`, validateResult(mod, r).length === 0, validateResult(mod, r).join('; '));
    check(`${name}/${fx}: run keys == static keys`, JSON.stringify(r.metrics.map(m => m.key)) === JSON.stringify(mod.metrics.map(m => m.key)));
    check(`${name}/${fx}: units match static list`, r.metrics.every((m, i) => m.unit === mod.metrics[i].unit));
    check(`${name}/${fx}: null metrics carry a reason`, r.metrics.every(m => m.value !== null || (typeof m.reason === 'string' && m.reason.length > 5)));
    check(`${name}/${fx}: provenance kinds valid`, r.provenance.every(q => KINDS.includes(q.kind)));
  }
}

// ---- glide ---------------------------------------------------------------------------------------------
{
  const r = glide.run(flyingfish, { launch_height_m: 0, ground_effect: 0 });
  check('glide: v_min reproduces physics/results.json 9.854 m/s', near(get(r, 'v_min_m_s'), 9.854, 0.001), get(r, 'v_min_m_s'));
  check('glide: P_req reproduces physics/results.json 1.327 W', near(get(r, 'power_required_W'), 1.3272, 0.0005), get(r, 'power_required_W'));
  check('glide: wing loading 46.39 N/m2 (physics/results.json L3)', near(get(r, 'wing_loading_N_m2'), 46.39, 0.01), get(r, 'wing_loading_N_m2'));
  check('glide: aerobic bound far below requirement (Lean C14 direction, >30x)', get(r, 'powered_flight_margin') < 1 / 30, get(r, 'powered_flight_margin'));
  const d = glide.run(flyingfish, {});
  check('glide: flying fish launches at its own sourced 10 m/s, not a global default', near(get(d, 'launch_airspeed_m_s'), 10, 1e-9) && d.metrics.find(m => m.key === 'launch_airspeed_m_s').kind === 'borrowed');
  const ffl = glide.run({ ...flyingfish, stage: F('larva', null), SL_m: F(0.009, 'm'), mass_kg: F(5e-6, 'kg'), pectoral_area_both_m2: F(1.25e-5, 'm2'), pectoral_span_m: F(0.0116, 'm') }, {});
  check('glide: flying-fish larva launch speed scales with SL (30 BL/s) and cannot glide', near(get(ffl, 'launch_airspeed_m_s'), 0.27, 1e-9) && ffl.feasible === false);
  check('glide: flying fish (10 m/s > v_min 9.85) can glide; survives not claimed', d.feasible === true && d.survives === null);
  check('glide: Lean-covered part = h (L/D)max = 4.37 m from 1 m', near(get(d, 'glide_range_lean_bound_m'), 4.37, 1e-9), get(d, 'glide_range_lean_bound_m'));
  check('glide: total = Lean part + kinetic phase', near(get(d, 'glide_range_total_m'), get(d, 'glide_range_lean_bound_m') + get(d, 'kinetic_phase_m'), 1e-9));
  check('glide: kinetic phase at 10 m/s is under 1 m', get(d, 'kinetic_phase_m') > 0 && get(d, 'kinetic_phase_m') < 1, get(d, 'kinetic_phase_m'));
  for (const [fx, st] of [['flyingfish', flyingfish], ['zebrafish', zebrafish], ['larva', zlarva], ['winged', wingedZ]]) for (const h of [0, 1, 8]) {
    const g = glide.run(st, { launch_height_m: h });
    const lb = get(g, 'glide_range_lean_bound_m');
    check(`glide/${fx}/h=${h}: Lean-labelled distance <= h (L/D)max`, lb === null || lb <= h * 4.37 + 1e-9, lb);
  }
  for (const [fx, st] of [['zebrafish adult', zebrafish], ['zebrafish larva', zlarva], ['winged zebrafish', wingedZ]]) {
    const g = glide.run(st, {});
    check(`glide: ${fx} cannot glide -> every range 0, feasible false`, g.feasible === false && get(g, 'glide_range_total_m') === 0 && get(g, 'glide_range_lean_bound_m') === 0 && get(g, 'kinetic_phase_m') === 0 && /cannot glide/.test(g.feasibility_note), `${get(g, 'launch_airspeed_m_s')} vs ${get(g, 'v_min_m_s')}`);
  }
  const blend = glide.run({ ...flyingfish, species: F('Cypselurus hiraii (w 0.5) + Danio rerio (w 0.5)', null) }, {});
  check('glide: blend has no launch speed -> ranges null, feasible null', blend.feasible === null && get(blend, 'glide_range_total_m') === null);
  const what = glide.run(zebrafish, { launch_airspeed_override_m_s: 20 });
  check('glide: what-if override is labelled assumed', what.metrics.find(m => m.key === 'launch_airspeed_m_s').kind === 'assumed');
  const hi = glide.run(flyingfish, { launch_height_m: 0, launch_airspeed_override_m_s: 20 });
  check('glide: 50 m (Edgerton & Breder) reached only with a 20 m/s what-if (circular; recorded, not a pass)', get(hi, 'glide_range_total_m') > 50 && get(d, 'glide_range_total_m') < 50);
}
// ---- temperature ---------------------------------------------------------------------------------------
{
  const r = temperature.run(zebrafish, { water_temperature_C: 28, acclimation_temperature_C: 28 });
  check('temperature: CTmax(28) within 0.5 degC of Morgan 2018 40.97', near(get(r, 'ctmax_C'), 40.97, 0.5), get(r, 'ctmax_C'));
  check('temperature: CTmax(28) within 0.5 degC of Andreassen 2022 adult 41.0', near(get(r, 'ctmax_C'), 41.0, 0.5));
  check('temperature: ucrit_relative(28) = 1', near(get(r, 'ucrit_relative'), 1, 1e-9));
  check('temperature: smr_factor = 1 at acclimation', near(get(r, 'smr_factor'), 1, 1e-9));
  check('temperature: survives at 28', r.survives === true);
  const hot = temperature.run(zebrafish, { water_temperature_C: 42, acclimation_temperature_C: 28 });
  check('temperature: 42 degC exceeds CTmax', hot.survives === false && get(hot, 'thermal_margin_C') < 0);
  const cold = temperature.run(zebrafish, { water_temperature_C: 8, acclimation_temperature_C: 28 });
  check('temperature: 8 degC below CTmin(28) 9.7', cold.survives === false);
  const r14 = temperature.run(zebrafish, { water_temperature_C: 14, acclimation_temperature_C: 28 });
  check('temperature: Ucrit(14)/Ucrit(28) = 15.4/23.8 (Wakamatsu)', near(get(r14, 'ucrit_relative'), 15.4 / 23.8, 1e-9));
  const ff = temperature.run(flyingfish, {});
  check('temperature: flying fish has no data -> all null, survives null', ff.metrics.every(m => m.value === null) && ff.survives === null);
  const accl = temperature.run(zebrafish, { water_temperature_C: 28, acclimation_temperature_C: 33 });
  check('temperature: acclimation outside 20-30 flagged inRange=false', accl.validity.inRange === false);
}
// ---- current -------------------------------------------------------------------------------------------
{
  const r = current.run(zebrafish, { current_m_s: 0.2 });
  check('current: adult zebrafish Ucrit 15.5 SL/s at 28 degC', near(get(r, 'ucrit_bl_s'), 15.5, 1e-6), get(r, 'ucrit_bl_s'));
  check('current: Ucrit in 0.40-0.55 m/s literature range (SL 30 mm)', get(r, 'ucrit_m_s') >= 0.40 && get(r, 'ucrit_m_s') <= 0.55);
  check('current: measured Ucrit below the physical upper bound', get(r, 'ucrit_m_s') < get(r, 'ucrit_upper_bound_m_s'), `${get(r, 'ucrit_m_s')} vs ${get(r, 'ucrit_upper_bound_m_s')}`);
  check('current: holds station at 0.2 m/s (feasible), survives not claimed', r.feasible === true && r.survives === null);
  check('current: drag in N is small and positive', get(r, 'drag_at_current_N') > 0 && get(r, 'drag_at_current_N') < 0.01);
  check('current: Re = rho U L / mu ~ 6.7e3 at 28 degC', near(get(r, 'reynolds_number'), (996.2 * 0.2 * 0.03) / 0.000834, 400), get(r, 'reynolds_number'));
  const fast = current.run(zebrafish, { current_m_s: 1.0 });
  check('current: 1 m/s sweeps an adult zebrafish away (feasible false)', fast.feasible === false);
  const ff = current.run(flyingfish, { current_m_s: 0.5 });
  check('current: flying fish Ucrit null (not measured), reason given', get(ff, 'ucrit_m_s') === null && /no measured Ucrit/.test(ff.metrics[0].reason));
  const ffx = current.run(flyingfish, { current_m_s: 3 });
  check('current: flying fish beyond physical bound -> feasible false', get(ffx, 'ucrit_upper_bound_m_s') < 3 ? ffx.feasible === false : ffx.feasible === null);
  const larva = current.run({ ...zebrafish, ageDays: F(1, 'days after hatching'), stage: F('larva', null) }, {});
  check('current: 3 dpf larva has no Ucrit', get(larva, 'ucrit_m_s') === null);
}
// ---- pressure ------------------------------------------------------------------------------------------
{
  const r = pressure.run(flyingfish, { depth_m: 10 });
  check('pressure: 10 m of sea water ~ 201.8 kPa', near(get(r, 'pressure_kPa'), 101.325 + 1025 * 9.80665 * 10 / 1000, 1e-6));
  check('pressure: Boyle halves gas volume at ~10 m', near(get(r, 'gas_volume_fraction_of_surface'), 0.502, 0.005));
  check('pressure: compressed bladder -> negative buoyancy', get(r, 'negative_buoyancy_fraction') > 0);
  const surf = pressure.run(flyingfish, { depth_m: 0 });
  check('pressure: neutral at the surface', near(get(surf, 'negative_buoyancy_fraction'), 0, 1e-9));
  const t7 = pressure.run(flyingfish, { depth_m: 7000 });
  check('pressure: TMAO(7000) within 2 SD of snailfish 386 +/- 18', near(get(t7, 'tmao_required_mmol_kg'), 386, 36), get(t7, 'tmao_required_mmol_kg'));
  const deep = pressure.run(flyingfish, { depth_m: 9000 });
  check('pressure: 9000 m below the teleost ceiling -> survives false', deep.survives === false);
  check('pressure: documented failure: deepest fish 8336 m lies below the predicted ceiling', get(surf, 'depth_limit_margin_m') < 8336);
  const zf = pressure.run(zebrafish, { depth_m: 9000 });
  check('pressure: freshwater zebrafish gets no marine ceiling verdict', zf.survives === null);
  check('pressure: shallow depths never claim survives=true', r.survives === null);
}
// ---- altitude ------------------------------------------------------------------------------------------
{
  const g0 = glide.run(flyingfish, {});
  const a0 = altitude.run(flyingfish, { altitude_m: 0 });
  check('altitude: h = 0 reproduces glide v_min', near(get(a0, 'v_min_m_s'), get(g0, 'v_min_m_s'), 1e-9));
  const a5 = altitude.run(flyingfish, { altitude_m: 5000 });
  check('altitude: v_min ratio at 5000 m ~ 1.29 (rho 0.738/1.227)', near(get(a5, 'v_min_ratio'), Math.sqrt(1.2266 / 0.7377), 0.005), get(a5, 'v_min_ratio'));
  check('altitude: arterial O2 content falls with altitude', get(a5, 'arterial_O2_content_ratio') < 1);
  check('altitude: rho(5000) matches physics/flier/tff/tff.json 0.7377', near(get(a5, 'air_density_kg_m3') * 1.2266 / 1.225, 0.73767, 0.001));
  const everest = [[5400, 400.4], [6300, 351.0], [8050, 283.6], [8848, 253.0]].map(([h, torr]) => (atmosphere(h).p_kPa - torr * 0.133322) / (torr * 0.133322));
  check('altitude: Everest pressures within 10% (West 1983)', everest.every(e => Math.abs(e) < 0.10), everest.map(e => (e * 100).toFixed(1)).join(','));
  check('altitude: standard atmosphere is systematically LOW on Everest (documented)', everest.every(e => e < 0));
  const zf = altitude.run(zebrafish, { altitude_m: 2000 });
  check('altitude: zebrafish in a 2000 m lake has O2 to spare', zf.survives === true && get(zf, 'hypoxia_margin_kPa') > 2.21);
  check('altitude: survives and flight are split (zebrafish survives, cannot glide; limiting not about flight)', zf.feasible === false && !/v_min|glide/i.test(String(zf.limiting || '')));
  const fh = [0, 1000, 3000, 5000, 8000].map(h => altitude.run(flyingfish, { altitude_m: h }).feasible);
  check('altitude: feasible heights downward closed (Lean feasible_downward_closed)', fh.every((f, i) => i === 0 || !(f === true && fh[i - 1] === false)), fh.join(','));
  check('altitude: flying fish at 10 m/s loses lift-support with altitude', fh[0] === true && fh[2] === false, fh.join(','));
  const zh = altitude.run(zebrafish, { altitude_m: 10500 });
  check('altitude: at 10.5 km water pO2 near/below the borrowed Pcrit -> not true', zh.survives !== true);
}
// ---- wind ----------------------------------------------------------------------------------------------
{
  const calm = wind.run(flyingfish, { headwind_m_s: 0, gust_m_s: 0 });
  const g = glide.run(flyingfish, {});
  check('wind: no wind -> ground distance = glide.mjs total', near(get(calm, 'ground_distance_total_m'), get(g, 'glide_range_total_m'), 1e-9));
  check('wind: Lean part equals glide.mjs', near(get(calm, 'glide_range_lean_bound_m'), get(g, 'glide_range_lean_bound_m'), 1e-9));
  const head = wind.run(flyingfish, { headwind_m_s: 3, gust_m_s: 0 });
  const tail = wind.run(flyingfish, { headwind_m_s: -3, gust_m_s: 0 });
  check('wind: headwind shortens, tailwind lengthens the ground distance', get(head, 'ground_distance_total_m') < get(calm, 'ground_distance_total_m') && get(tail, 'ground_distance_total_m') > get(calm, 'ground_distance_total_m'));
  check('wind: change = -u x time', near(get(head, 'wind_distance_change_m'), -3 * get(head, 'glide_time_s'), 1e-9));
  check('wind: takeoff water speed = v_min - headwind', near(get(head, 'takeoff_water_speed_m_s'), get(head, 'v_min_m_s') - 3, 1e-9));
  check('wind: no glide-range key other than the Lean-covered one', !wind.metrics.some(m => /glide.*(range|dist)/.test(m.key) && m.key !== 'glide_range_lean_bound_m'));
  const gust = wind.run(flyingfish, { headwind_m_s: 0, gust_m_s: 2 });
  check('wind: 2 m/s gust lull at the 10 m/s launch (v_min 9.85) -> stall risk, feasible false', gust.feasible === false && get(gust, 'gust_stall_margin_m_s') < 0 && gust.survives === null);
  const zl = wind.run(zlarva, {});
  check('wind: larva cannot glide -> distances 0', zl.feasible === false && get(zl, 'ground_distance_total_m') === 0);
}
// ---- lean_inputs blocks (numeric inputs for the Lean laws P1b/P2b/P4/P4b) ------------------------------------
{
  const num = (li, k) => li && li[k] && typeof li[k].value === 'number' && Number.isFinite(li[k].value) && KINDS.includes(li[k].kind) && !!li[k].source;
  const c = current.run(zebrafish, { current_m_s: 0.2 });
  check('lean_inputs current: drag_coefficient, drag_reference_area_m2, drag_area_CdA_m2, aerobic_ceiling_W numeric with kind+source', ['drag_coefficient', 'drag_reference_area_m2', 'drag_area_CdA_m2', 'aerobic_ceiling_W'].every(k => num(c.lean_inputs, k)), JSON.stringify(c.lean_inputs));
  check('lean_inputs current: reference area is the wetted area (not CdA)', c.lean_inputs.drag_reference_area_m2.value === 4.0e-4 && !('drag_area_m2' in c.lean_inputs));
  check('lean_inputs current: CdA = C_D x A_ref', near(c.lean_inputs.drag_area_CdA_m2.value, c.lean_inputs.drag_coefficient.value * c.lean_inputs.drag_reference_area_m2.value, 1e-15));
  check('lean_inputs current: P2b form 0.5 rho C_D A_ref U^2 reproduces drag_at_current_N', near(get(c, 'drag_at_current_N'), 0.5 * 996.2 * c.lean_inputs.drag_coefficient.value * c.lean_inputs.drag_reference_area_m2.value * 0.04, 1e-7), `${get(c, 'drag_at_current_N')}`);
  const t = temperature.run(zebrafish, { water_temperature_C: 33, acclimation_temperature_C: 28 });
  check('lean_inputs temperature: q10, reference_temperature_C, reference_sustained_power_W, sustained_power_W numeric', ['q10', 'reference_temperature_C', 'reference_sustained_power_W', 'sustained_power_W'].every(k => num(t.lean_inputs, k)) && ['SMR', 'MMR'].includes(t.lean_inputs.q10_basis.value), JSON.stringify(t.lean_inputs));
  check('lean_inputs temperature: sustained = reference x q10^((T-Tref)/10)', near(t.lean_inputs.sustained_power_W.value, t.lean_inputs.reference_sustained_power_W.value * t.lean_inputs.q10.value ** 0.5, 1e-12));
  const w = wind.run(flyingfish, { headwind_m_s: 3, gust_m_s: 0 });
  check('lean_inputs wind: descent_airspeed_m_s and descent_ground_distance_m numeric', num(w.lean_inputs, 'descent_airspeed_m_s') && num(w.lean_inputs, 'descent_ground_distance_m'), JSON.stringify(w.lean_inputs));
  check('lean_inputs wind: descent ground = h L/D (1 - u/v_LD)', near(w.lean_inputs.descent_ground_distance_m.value, 1 * 4.37 * (1 - 3 / w.lean_inputs.descent_airspeed_m_s.value), 1e-9));
  const a = altitude.run(flyingfish, { altitude_m: 2000 });
  check('lean_inputs altitude: CLmax 0.78 and LD_max 4.37 as numbers', num(a.lean_inputs, 'CLmax') && num(a.lean_inputs, 'LD_max') && a.lean_inputs.CLmax.value === 0.78 && a.lean_inputs.LD_max.value === 4.37);
}
// ---- positive / negative glide controls on the REAL, unedited organisms (core resolveState, read-only) ----------
{
  let rows = [];
  try {
    const { loadBundle } = await import('../lib/data-node.mjs');
    const O = await import('../lib/organism.mjs');
    const S = await import('../lib/state.mjs');
    const b = await loadBundle();
    for (const id of Object.keys(b.organisms)) {
      const st = S.resolveState(O.docFor(b, id), null, {}, b); // reference (adult) age
      if (MASS !== 1) st.mass_kg = { ...st.mass_kg, value: st.mass_kg.value * MASS };
      const g = glide.run(st, {});
      rows.push({ id, stage: st.stage.value, feasible: g.feasible, v0: get(g, 'launch_airspeed_m_s'), vmin: get(g, 'v_min_m_s') });
    }
  } catch (e) { rows = null; check('real organisms: core resolveState runs', false, e.message); }
  if (rows) {
    console.log('adult glide controls (reference age): ' + rows.map(r => `${r.id} [${r.stage}] v0 ${r.v0 == null ? 'null' : r.v0.toFixed(2)} vs v_min ${r.vmin.toFixed(2)} -> feasible ${r.feasible}`).join('; '));
    const R = id => rows.find(r => r.id === id);
    check('POSITIVE CONTROL: unedited adult flying fish can glide', R('flying-fish') && R('flying-fish').feasible === true, JSON.stringify(R('flying-fish')));
    check('NEGATIVE CONTROL: unedited adult zebrafish cannot glide', R('zebrafish-adult') && R('zebrafish-adult').feasible === false, JSON.stringify(R('zebrafish-adult')));
  }
}
// ---- no bird data in the environment scenario files --------------------------------------------------------
{
  const dir = url.fileURLToPath(new URL('../scenarios/', import.meta.url));
  const files = ['temperature', 'current', 'pressure', 'altitude', 'wind', 'glide'].map(f => fs.readFileSync(dir + f + '.mjs', 'utf8'));
  const birdy = /\b(aves|avian|passerin\w*|columba|sturnus|taeniopygia|finch|pigeon|starling|swift|hummingbird|gull|albatross)\b/i;
  check('no bird taxa named in the environment scenarios', files.every(t => !birdy.test(t.replace(/No bird data( anywhere)?\.?/g, ''))));
}

console.log(`${SABOTAGE ? '[SABOTAGE: every assertion inverted] ' : ''}${MUT ? `[MUTATE: ${MUT}] ` : ''}environment scenarios: ${pass} passed, ${fail} failed`);
if (failures.length) console.log(failures.map(f => '  FAIL ' + f).join('\n'));
if (SABOTAGE) { if (pass > 0) { console.log('SABOTAGE: some assertions passed when inverted -> vacuous'); process.exit(1); } process.exit(0); }
process.exit(fail ? 1 : 0);
