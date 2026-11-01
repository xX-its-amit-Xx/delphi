// Perturbation inputs for the Lean P laws (lean/eliminate/browser-check-perturb.fragment.mjs checkPerturb).
// Pure ESM: maps STATE, a scenario's params and its run() result onto the EXACT spec names checkPerturb reads.
// Nothing is back-solved or defaulted: a name is passed only when a STATE field, a scenario param or a scenario
// metric IS that quantity. Every value carries where it came from (returned in `sources`).
//
//   P1   body_temperature_C, water_temperature_C, ct_min_C, ct_max_C, sustained_power_W
//   P1b  q10, reference_temperature_C, reference_sustained_power_W            (not supplied: no committed design values)
//   P2   current_speed_m_s, critical_swimming_speed_m_s
//   P2b  drag_coefficient, drag_area_m2, aerobicCeiling_W                      (not supplied: scenarios report drag, not Cd and A)
//   P3   depth_m, bladder_volume_surface_ml, bladder_volume_at_depth_ml             (not supplied: hydrostatic convention mismatch, see below)
//   P3b  depth_m, teleost
//   P4   altitude_m, CLmax, airspeed_m_s, finArea_m2                           (not supplied: CLmax and the Lean area convention are not exposed)
//   P4b  wind_along_track_m_s, horizontal_airspeed_m_s, glideHeight_m, LD_max, ground_distance_m (not supplied: see below)
//   P5   intake_J_per_day, routine_cost_J_per_day, activity_cost_J_per_day, assimilation_efficiency, mass_change (not supplied)

const num = x => typeof x === 'number' && Number.isFinite(x);
// ontogeny.json units_note: 1 umol O2 g-1 h-1 = 0.1204 W/kg (13.54 J/mg O2, gerry2014 secondhand).
const W_PER_KG_PER_UMOL_G_H = 0.1204;
const TELEOSTS = ['Exocoetidae', 'Danio rerio', 'Teleostei'];

export function perturbInputs(state, scenarioKey = null, params = {}, run = null) {
  const spec = {}, sources = {};
  const put = (k, v, src) => { if (num(v) || typeof v === 'boolean') { spec[k] = v; sources[k] = src; } };
  const metric = k => (run && run.ok && Array.isArray(run.metrics) ? run.metrics.find(m => m.key === k)?.value : undefined);
  const f = k => state?.[k]?.value;
  const amb = k => state?.ambient?.[k]?.value;

  // State-level inputs (any scenario, or none).
  put('body_temperature_C', f('temperature_C'), 'STATE temperature_C (body = water temperature, ectotherm; conditions/baseline.json unless set)');
  put('water_temperature_C', f('temperature_C'), 'STATE temperature_C');
  put('water_density_kg_m3', amb('water_density_kg_m3'), 'STATE ambient.water_density_kg_m3');
  if (amb('medium') === 'water' && num(amb('depth_m')) && amb('depth_m') > 0) put('depth_m', amb('depth_m'), 'STATE ambient.depth_m (condition)');
  if (num(amb('current_m_s'))) put('current_speed_m_s', amb('current_m_s'), 'STATE ambient.current_m_s (condition)');
  put('critical_swimming_speed_m_s', f('ucrit_m_s'), 'STATE ucrit_m_s (ontogeny.json)');
  const taxon = state?._meta?.taxon;
  if (taxon) put('teleost', TELEOSTS.includes(taxon), `taxon ${taxon}`);
  const rmr = f('routine_metabolic_rate_umol_g_h'), M = f('mass_kg');
  if (num(rmr) && num(M)) put('sustained_power_W', rmr * W_PER_KG_PER_UMOL_G_H * M, 'routine metabolic power = STATE routine_metabolic_rate_umol_g_h x 0.1204 W/kg per umol g-1 h-1 (ontogeny.json units_note) x mass: the power the organism must sustain to stay alive');

  // Scenario params and the scenario's own computed quantities.
  if (scenarioKey === 'temperature') {
    put('body_temperature_C', params.water_temperature_C, 'temperature scenario param water_temperature_C (body = water)');
    put('water_temperature_C', params.water_temperature_C, 'temperature scenario param water_temperature_C');
    put('ct_max_C', metric('ctmax_C'), 'temperature scenario metric ctmax_C');
    put('ct_min_C', metric('ctmin_C'), 'temperature scenario metric ctmin_C');
  }
  if (scenarioKey === 'current') {
    put('current_speed_m_s', params.current_m_s, 'current scenario param current_m_s');
    put('critical_swimming_speed_m_s', metric('ucrit_m_s'), 'current scenario metric ucrit_m_s (this design, this size)');
  }
  if (scenarioKey === 'pressure') {
    put('depth_m', params.depth_m, 'pressure scenario param depth_m');
    // P3 (Boyle, closed bladder) is NOT fed: the pressure scenario computes V/V0 with real hydrostatics
    // (P/P0 = 1 + rho g d / P_atm, about 1 + d/10.09 m), while the Lean law bounds it with the 1 atm per 10 m
    // approximation and a 1e-12 tolerance. A correct Boyle volume therefore exceeds the law's bound by ~0.5-1 %
    // at every depth and would show as a violation that is only a convention mismatch. Recomputing the volume
    // with the law's own convention would make P3 hold by construction. Left cannot-evaluate until the law
    // states its tolerance or the conventions agree (reported to the hub, 2026-11-01).
  }
  if (scenarioKey === 'altitude') put('altitude_m', params.altitude_m, 'altitude scenario param altitude_m');
  // P4 needs CLmax and the Lean lifting-area convention; P4b needs L/D and a ground distance that is not the
  // scenario's own bound (checking a bound against itself proves nothing); P5 needs an assimilation efficiency
  // and activity cost no scenario commits. They stay cannot-evaluate rather than being filled by guesses.
  return { spec, sources };
}
