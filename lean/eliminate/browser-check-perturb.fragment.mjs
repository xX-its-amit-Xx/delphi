// FRAGMENT spliced into lean/eliminate/browser-check.mjs by lean/eliminate/build-browser-check.mjs.
// Real JavaScript so it can be syntax-checked on its own; not a module on its own (it uses META, result and
// KERNEL_NOTE from the generated file). The perturbation rows P1-P5 of lean/Delphi/Perturb.lean.
// The one placeholder, named for the constant it fills, is the slim source record of lean/perturb-sources.json.

/** Perturbation sources (lean/perturb-sources.json): every constant these rows use, with its quoted source. */
export const PERTURB = __PERTURB__;

// ISA troposphere and hydrostatics, the constants of lean/Delphi/Perturb.lean's witness (sources in PERTURB).
const ISA = { rho0: 1.225, T0: 288.15, beta: 0.0065, n: 4.2559 };
const HYDRO = { p0_atm: 1, k_atm_per_m: 0.1 };
const DEPTH_CAP_M = 8200;
const WATER_RHO_DEFAULT = 1033.2; // derived from 1 atm per 10 m (Yancey 2020) and g0; approximate
const SDA_DEFAULT = 0.06; // walleye, fraction of digestible energy (Bihun et al. 2024)

/** ISA troposphere density at height h (m). Delphi.Perturb.ISATroposphere.rho. Null at or above T0/beta. */
export function isaDensity(h) { const b = 1 - ISA.beta * h / ISA.T0; return b > 0 ? ISA.rho0 * Math.pow(b, ISA.n) : null; }
/** Absolute pressure (atm) at depth d (m): 1 + d/10. Delphi.Perturb.Hydrostatic.pressure. */
export function pressureAtm(d) { return HYDRO.p0_atm + HYDRO.k_atm_per_m * d; }

// Perturbation rows carry band "hypothesis" (proved in Lean FROM named hypotheses) and a premise naming the
// weakest one: "physical-model" (Boyle, drag and Fick, ISA form, glide kinematics, energy conservation) or
// "sourced-observation" (the thermal window and Q10 rule, the osmolyte depth cap), which a reader may reject.
// The "empirical" band stays reserved for the E rows of lean/empirical.json; kernel keeps KERNEL_NOTE.
const perturbRow = (id, premise, verdict, numbers, missing, note, sides, srcIds) => ({
  ...result(id, verdict, numbers, missing, note, sides), band: 'hypothesis', premise: premise === 'empirical' ? 'sourced-observation' : 'physical-model', status: 'hypothesis',
  sources: (srcIds || []).map(k => ({ id: k, ...(PERTURB.sources[k] || {}) })),
  lawNote: 'the law is Lean-proved from NAMED HYPOTHESES (lean/Delphi/Perturb.lean), listed in "hypotheses"; constants and quoted sources in lean/perturb-sources.json' });

/** Perturbation rows for a design at one developmental stage (call check() once per stage).
 * Fields: body_temperature_C (else water_temperature_C), ct_min_C, ct_max_C, q10, reference_temperature_C,
 * reference_sustained_power_W, sustained_power_W; current_speed_m_s, critical_swimming_speed_m_s,
 * water_density_kg_m3, drag_coefficient, drag_area_m2, aerobicCeiling_W (else efficiency x oxycaloric x
 * cardiacOutput x arterialO2); depth_m, teleost (default true), bladder_volume_surface_ml,
 * bladder_volume_at_depth_ml; altitude_m (with mass_kg, finArea_m2, CLmax, airspeed_m_s); wind_along_track_m_s
 * (POSITIVE = TAILWIND), horizontal_airspeed_m_s (else airspeed_m_s), glideHeight_m, LD_max, ground_distance_m;
 * intake_J_per_day, routine_cost_J_per_day, activity_cost_J_per_day, assimilation_efficiency, sda_coefficient
 * (default 0.06), mass_change ("positive" | "zero" | "negative", or a number). */
export function checkPerturb(s, derived) {
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const rows = [];
  const W = derived && num(derived.W_N) ? derived.W_N : null, S = derived && num(derived.S_m2) ? derived.S_m2 : null;

  // P1 and P1b: temperature.
  { const T = num(s.body_temperature_C) ? s.body_temperature_C : (num(s.water_temperature_C) ? s.water_temperature_C : null);
    const P = num(s.sustained_power_W) ? s.sustained_power_W : null;
    const miss = []; if (T === null) miss.push('body_temperature_C'); if (!num(s.ct_min_C)) miss.push('ct_min_C'); if (!num(s.ct_max_C)) miss.push('ct_max_C'); if (P === null) miss.push('sustained_power_W');
    if (miss.length) rows.push(perturbRow('P1', 'empirical', 'cannot-evaluate', { body_temperature_C: T }, miss, 'the thermal window is a design input: no CTmin or CTmax is defaulted (zebrafish CTmax 40.97 C, Morgan et al. 2018, is a reference only)', null, ['schulte2015', 'morgan2018']));
    else { const inside = T >= s.ct_min_C && T <= s.ct_max_C; const ok = inside || P <= 0;
      rows.push(perturbRow('P1', 'empirical', ok ? 'holds' : 'violated', { body_temperature_C: T, ct_min_C: s.ct_min_C, ct_max_C: s.ct_max_C, sustained_power_W: P }, [],
        inside ? 'inside the thermal window' : 'outside the thermal window no positive sustained power exists (thermal_rules_out)', { needed: { temperature_between_C: [s.ct_min_C, s.ct_max_C] }, available: { temperature_C: T } }, ['schulte2015'])); }
    const miss2 = []; if (T === null) miss2.push('body_temperature_C'); for (const k of ['q10', 'reference_temperature_C', 'reference_sustained_power_W']) if (!num(s[k])) miss2.push(k); if (P === null) miss2.push('sustained_power_W');
    if (miss2.length) rows.push(perturbRow('P1b', 'empirical', 'cannot-evaluate', {}, miss2, 'Q10 for sustained red-muscle power is 1.88 in scup (Rome et al. 1992); a design must commit its own', null, ['rome1992b']));
    else if (!(s.q10 > 0)) rows.push(perturbRow('P1b', 'empirical', 'cannot-evaluate', { q10: s.q10 }, ['q10 > 0'], 'the Q10 rule needs Q10 > 0'));
    else { const bound = s.reference_sustained_power_W * Math.pow(s.q10, (T - s.reference_temperature_C) / 10);
      rows.push(perturbRow('P1b', 'empirical', leTol(P, bound) ? 'holds' : 'violated', { body_temperature_C: T, q10: s.q10, reference_temperature_C: s.reference_temperature_C, reference_sustained_power_W: s.reference_sustained_power_W, bound_W: bound, sustained_power_W: P }, [],
        'P <= P_ref Q10^((T - T_ref)/10) (sustained_power_le); the Q10 is method-dependent (1.88 steady, 2.29 work-loop)', { needed: { power_W: P }, available: { power_W: bound } }, ['rome1992b', 'romeswank1992'])); } }

  // P2 and P2b: holding station in a current.
  { const U = num(s.current_speed_m_s) ? s.current_speed_m_s : null;
    if (U === null || !num(s.critical_swimming_speed_m_s)) rows.push(perturbRow('P2', 'proved', 'cannot-evaluate', {}, [U === null ? 'current_speed_m_s' : null, num(s.critical_swimming_speed_m_s) ? null : 'critical_swimming_speed_m_s'].filter(Boolean), 'U_crit is a design input (0.80 m/s for scup on red muscle at 20 C, Rome et al. 1992, as a reference)', null, ['plaut2001', 'rome1992a']));
    else rows.push(perturbRow('P2', 'proved', U <= s.critical_swimming_speed_m_s ? 'holds' : 'violated', { current_speed_m_s: U, critical_swimming_speed_m_s: s.critical_swimming_speed_m_s }, [],
      U <= s.critical_swimming_speed_m_s ? 'the current is within the sustained swimming speed' : 'no design holds station in a current faster than its U_crit (no_station_above_ucrit)', { needed: { swim_speed_m_s: U }, available: { swim_speed_m_s: s.critical_swimming_speed_m_s } }, ['plaut2001']));
    const ceiling = num(s.aerobicCeiling_W) ? s.aerobicCeiling_W : (['efficiency', 'oxycaloric_J_per_unit_O2', 'cardiacOutput', 'arterialO2'].every(k => num(s[k])) ? s.efficiency * s.oxycaloric_J_per_unit_O2 * s.cardiacOutput * s.arterialO2 : null);
    const rho = num(s.water_density_kg_m3) ? s.water_density_kg_m3 : WATER_RHO_DEFAULT;
    const miss = []; if (U === null) miss.push('current_speed_m_s'); if (!num(s.drag_coefficient)) miss.push('drag_coefficient'); if (!num(s.drag_area_m2)) miss.push('drag_area_m2'); if (ceiling === null) miss.push('aerobicCeiling_W (or efficiency, oxycaloric, cardiacOutput, arterialO2)');
    if (miss.length) rows.push(perturbRow('P2b', 'proved', 'cannot-evaluate', { water_density_kg_m3: rho }, miss, 'drag coefficient and area are design inputs; nothing is defaulted', null, ['plaut2001']));
    else { const drag = rho * s.drag_coefficient * s.drag_area_m2 * U * U * U / 2;
      rows.push(perturbRow('P2b', 'proved', leTol(drag, ceiling) ? 'holds' : 'violated', { current_speed_m_s: U, water_density_kg_m3: rho, drag_coefficient: s.drag_coefficient, drag_area_m2: s.drag_area_m2, dragPower_W: drag, aerobicCeiling_W: ceiling, shortfall_factor: ceiling > 0 ? drag / ceiling : null }, [],
        (num(s.water_density_kg_m3) ? '' : 'water density defaulted to 1033.2 kg/m^3 (from 1 atm per 10 m, approximate); ') + 'drag power rho Cd A U^3 / 2 against the Fick ceiling (no_station_above_drag_bound); burst swimming is outside it', { needed: { power_W: drag }, available: { power_W: ceiling } }, ['yancey2020'])); } }

  // P3 and P3b: pressure.
  { const d = num(s.depth_m) ? s.depth_m : null;
    const V0 = num(s.bladder_volume_surface_ml) ? s.bladder_volume_surface_ml : null, Vd = num(s.bladder_volume_at_depth_ml) ? s.bladder_volume_at_depth_ml : null;
    if (d === null || V0 === null || Vd === null || d < 0) rows.push(perturbRow('P3', 'proved', 'cannot-evaluate', d === null ? {} : { depth_m: d, pressure_atm: pressureAtm(Math.max(d, 0)) }, [d === null || d < 0 ? 'depth_m (>= 0)' : null, V0 === null ? 'bladder_volume_surface_ml' : null, Vd === null ? 'bladder_volume_at_depth_ml' : null].filter(Boolean), 'Boyle (perturb-pressure v2.0.0): a closed bladder holds V(0) p0 / (p0 + rho_w g d) at depth d; keeping V(0) needs 1 + rho_w g d / p0 times the gas', null, ['yancey2020', 'kerr2023']));
    else { // perturb-pressure v2.0.0 (lean/Delphi/Hydrostatics.lean, Delphi.Hydro.closed_bladder_rules_out): P(d) = p0 + rho_w g d
      const rhoW = num(s.water_density_kg_m3) ? s.water_density_kg_m3 : WATER_RHO_DEFAULT, gW = num(s.g) ? s.g : 9.80665, p0Pa = num(s.surface_pressure_Pa) ? s.surface_pressure_Pa : 101325;
      const PdPa = p0Pa + rhoW * gW * d, bound = V0 * p0Pa / PdPa;
      rows.push(perturbRow('P3', 'proved', leTol(Vd, bound) ? 'holds' : 'violated', { depth_m: d, water_density_kg_m3: rhoW, g: gW, surface_pressure_Pa: p0Pa, pressure_Pa: PdPa, pressure_atm: PdPa / 101325, bladder_volume_surface_ml: V0, boyleVolume_ml: bound, bladder_volume_at_depth_ml: Vd, secretionRatio: PdPa / p0Pa }, [],
        (num(s.water_density_kg_m3) ? '' : 'water density defaulted to 1033.2 kg/m^3 (the "1 atm per 10 m" case); pass water_density_kg_m3 (sea water about 1025, fresh 998.2) and g for real hydrostatics; ') + 'closed bladder, fixed temperature, quasi-static (Kerr et al. 2023: not for fast decompression); a larger volume needs gas secretion, which this row does not model', { needed: { volume_ml: Vd }, available: { volume_ml: bound } }, ['yancey2020', 'kerr2023'])); }
    if (d === null) rows.push(perturbRow('P3b', 'empirical', 'cannot-evaluate', {}, ['depth_m'], 'the osmolyte cap is 8200 m for teleosts (Yancey et al. 2014)', null, ['yancey2014']));
    else if (s.teleost === false) rows.push(perturbRow('P3b', 'empirical', 'cannot-evaluate', { depth_m: d }, ['a teleost design'], 'the osmolyte depth cap is a teleost hypothesis; it says nothing about other taxa', null, ['yancey2014']));
    else rows.push(perturbRow('P3b', 'empirical', d <= DEPTH_CAP_M ? 'holds' : 'violated', { depth_m: d, depthCap_m: DEPTH_CAP_M, pressure_atm: pressureAtm(Math.max(d, 0)) }, [],
      d <= DEPTH_CAP_M ? 'above the osmolyte depth cap' : 'below 8200 m a teleost would have to be hyperosmotic to seawater (no_teleost_below); CONDITIONAL on Yancey et al. 2014\'s extrapolation, and CONTESTED: a snailfish has been recorded at 8336 m (Jamieson et al. 2026), so 8200 m is a soft limit, not a cap', { needed: { depth_at_most_m: DEPTH_CAP_M }, available: { depth_m: d } }, ['yancey2014', 'jamieson2026'])); }

  // P4 and P4b: altitude and wind.
  { const h = num(s.altitude_m) ? s.altitude_m : null;
    const miss = []; if (h === null) miss.push('altitude_m'); if (W === null) miss.push('mass_kg'); if (S === null) miss.push('finArea_m2'); if (!num(s.CLmax)) miss.push('CLmax'); if (!num(s.airspeed_m_s)) miss.push('airspeed_m_s');
    const rhoH = h === null ? null : isaDensity(h);
    if (miss.length) rows.push(perturbRow('P4', 'proved', 'cannot-evaluate', { altitude_m: h, isaDensity_kg_m3: rhoH }, miss, null, null, ['narayanan2022']));
    else if (rhoH === null || h < 0) rows.push(perturbRow('P4', 'proved', 'cannot-evaluate', { altitude_m: h }, ['an altitude in the troposphere (0 <= h < 44 km by the formula; about 11 km physically)'], null, null, ['narayanan2022']));
    else { const vmH = Math.sqrt(2 * W / (rhoH * S * s.CLmax)), vm0 = Math.sqrt(2 * W / (ISA.rho0 * S * s.CLmax));
      rows.push(perturbRow('P4', 'proved', geTol(s.airspeed_m_s, vmH) ? 'holds' : 'violated', { altitude_m: h, isaDensity_kg_m3: rhoH, vminAtAltitude_m_s: vmH, vminSeaLevel_m_s: vm0, vminRatio: vmH / vm0, airspeed_m_s: s.airspeed_m_s }, [],
        'v_min grows as 1/sqrt(rho) (vmin_density_ratio); ISA troposphere, constant lapse rate' + (h > 11000 ? '; ABOVE 11 km the constant-lapse formula is outside its range' : ''), { needed: { airspeed_m_s: vmH }, available: { airspeed_m_s: s.airspeed_m_s } }, ['narayanan2022'])); } }
  { const w = num(s.wind_along_track_m_s) ? s.wind_along_track_m_s : null;
    const u = num(s.horizontal_airspeed_m_s) ? s.horizontal_airspeed_m_s : (num(s.airspeed_m_s) ? s.airspeed_m_s : null);
    const miss = []; if (w === null) miss.push('wind_along_track_m_s (positive = tailwind)'); if (u === null || !(u > 0)) miss.push('horizontal_airspeed_m_s (or airspeed_m_s)'); for (const k of ['glideHeight_m', 'LD_max', 'ground_distance_m']) if (!num(s[k])) miss.push(k);
    if (miss.length) rows.push(perturbRow('P4b', 'proved', 'cannot-evaluate', {}, miss, 'sign convention: w POSITIVE FOR A TAILWIND, negative for a headwind'));
    else { const bound = w >= -u ? s.LD_max * s.glideHeight_m * (1 + w / u) : 0;
      rows.push(perturbRow('P4b', 'proved', leTol(s.ground_distance_m, bound) ? 'holds' : 'violated', { wind_along_track_m_s: w, horizontal_airspeed_m_s: u, glideHeight_m: s.glideHeight_m, LD_max: s.LD_max, bound_m: bound, ground_distance_m: s.ground_distance_m }, [],
        w >= -u ? 'x <= (L/D)max h (1 + w/u), w positive for a tailwind (glide_ground_range_le)' : 'a headwind at or above the airspeed: no ground is gained', { needed: { ground_distance_m: s.ground_distance_m }, available: { ground_range_m: bound } })); } }

  // P5: daily energy balance.
  { const sda = num(s.sda_coefficient) ? s.sda_coefficient : SDA_DEFAULT;
    const mc = s.mass_change; const sign = typeof mc === 'number' ? (mc > 0 ? 'positive' : mc < 0 ? 'negative' : 'zero') : (['positive', 'zero', 'negative'].includes(mc) ? mc : null);
    const miss = []; for (const k of ['intake_J_per_day', 'routine_cost_J_per_day', 'activity_cost_J_per_day', 'assimilation_efficiency']) if (!num(s[k])) miss.push(k); if (sign === null) miss.push('mass_change');
    if (miss.length) rows.push(perturbRow('P5', 'proved', 'cannot-evaluate', { sda_coefficient: sda }, miss, 'no fetched source gives a teleost energy assimilation efficiency, so the design must commit it', null, ['bihun2024']));
    else if (!(s.assimilation_efficiency > 0 && s.assimilation_efficiency <= 1) || !(sda >= 0 && sda < 1)) rows.push(perturbRow('P5', 'proved', 'cannot-evaluate', { assimilation_efficiency: s.assimilation_efficiency, sda_coefficient: sda }, ['0 < assimilation_efficiency <= 1 and 0 <= sda_coefficient < 1']));
    else { const need = (s.routine_cost_J_per_day + s.activity_cost_J_per_day) / (s.assimilation_efficiency * (1 - sda));
      const net = s.assimilation_efficiency * s.intake_J_per_day * (1 - sda) - s.routine_cost_J_per_day - s.activity_cost_J_per_day;
      const ok = sign === 'negative' || geTol(s.intake_J_per_day, need);
      rows.push(perturbRow('P5', 'proved', ok ? 'holds' : 'violated', { intake_J_per_day: s.intake_J_per_day, intakeNeeded_J_per_day: need, netEnergy_J_per_day: net, assimilation_efficiency: s.assimilation_efficiency, sda_coefficient: sda, mass_change: sign }, [],
        (num(s.sda_coefficient) ? '' : 'SDA coefficient defaulted to 0.06 of digestible energy (walleye, Bihun et al. 2024); ') + (ok ? (net < 0 ? 'a deficit: the mass must fall (mass_declines_of_deficit), as claimed' : 'intake pays the day\'s costs') : 'mass claimed held or gained on less intake than the costs need (energy_rules_out)'),
        { needed: { intake_J_per_day: need }, available: { intake_J_per_day: s.intake_J_per_day } }, ['bihun2024', 'secor2009'])); } }

  return rows;
}
