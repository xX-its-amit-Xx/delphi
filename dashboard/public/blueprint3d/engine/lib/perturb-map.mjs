// Perturbation inputs for the Lean P laws (lean/eliminate/browser-check-perturb.fragment.mjs checkPerturb).
// Pure ESM: maps STATE, a scenario's params and its run() result onto the EXACT spec names checkPerturb reads.
// Nothing is back-solved or defaulted: a name is passed only when a STATE field, a scenario param or a scenario
// metric IS that quantity. Every value carries where it came from (returned in `sources`).
//
//   P1   body_temperature_C, water_temperature_C, ct_min_C, ct_max_C, sustained_power_W
//   P1b  q10, reference_temperature_C, reference_sustained_power_W            (not supplied: no committed design values)
//   P2   current_speed_m_s, critical_swimming_speed_m_s
//   P2b  drag_coefficient, drag_area_m2, aerobicCeiling_W                      (not supplied: scenarios report drag, not Cd and A)
//   P3   depth_m, bladder_volume_surface_ml, bladder_volume_at_depth_ml, water_density_kg_m3, g, surface_pressure_Pa (v2.0.0)
//   P3b  depth_m, teleost
//   P4   altitude_m, CLmax, airspeed_m_s, finArea_m2                           (not supplied: CLmax and the Lean area convention are not exposed)
//   P4b  wind_along_track_m_s, horizontal_airspeed_m_s, glideHeight_m, LD_max, ground_distance_m (not supplied: see below)
//   C15  glideHeight_m, LD_max, glideDistance_m, groundEffect (glide scenario: the Lean-covered part only, never the total)
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
    // P3 (Boyle, closed bladder; perturb-pressure v2.0.0, lawset >= 1.4.0) is parameterised by rho, g and the
    // surface pressure, so it is fed the pressure scenario's OWN values: rho_w and P0 from its provenance, g
    // recovered exactly from its own pressure_kPa = P0 + rho g z. The bladder volumes come from STATE
    // (swimbladder_volume_fraction x body volume) and the scenario's gas_volume_fraction_of_surface.
    // (Under v1, with "1 atm per 10 m" fixed, a correct Boyle volume showed as violated: convention mismatch.)
    const pv = q => (run && run.ok ? run.provenance?.find(x => x.quantity === q)?.value : undefined);
    const rhoW = pv('water density (kg/m3)'), P0 = pv('surface pressure (kPa)'), Pz = metric('pressure_kPa'), z = params.depth_m;
    put('water_density_kg_m3', rhoW, 'pressure scenario provenance: water density (kg/m3)');
    if (num(P0)) put('surface_pressure_Pa', P0 * 1000, 'pressure scenario provenance: surface pressure (kPa) x 1000');
    if (num(Pz) && num(P0) && num(rhoW) && num(z) && z > 0) put('g', (Pz - P0) * 1000 / (rhoW * z), "recovered from the pressure scenario's own pressure_kPa = P0 + rho g z (it uses standard gravity)");
    const svf = f('swimbladder_volume_fraction'), rhoB = f('body_density_kg_m3'), gvf = metric('gas_volume_fraction_of_surface');
    if (num(svf) && num(rhoB) && num(M) && num(gvf)) {
      const V0 = svf * (M / rhoB) * 1e6;
      put('bladder_volume_surface_ml', V0, 'STATE swimbladder_volume_fraction x body volume (mass / body_density_kg_m3), in ml');
      put('bladder_volume_at_depth_ml', V0 * gvf, 'bladder_volume_surface_ml x pressure scenario metric gas_volume_fraction_of_surface');
    }
  }
  if (scenarioKey === 'altitude') put('altitude_m', params.altitude_m, 'altitude scenario param altitude_m');
  // C15 (glide_range_le, x <= h (L/D)max / (1 - ground effect)) bounds the STEADY glide only. The scenario's
  // glide_range_total_m adds a level kinetic-energy phase the theorem's hypotheses do not cover, so it is NEVER
  // passed; only glide_range_lean_bound_m (the h (L/D) descent, no ground effect in that phase) is. This makes C15 a
  // consistency check of the scenario's bound against the theorem (it holds unless the two formulas drift apart),
  // not an independent test. Fed only when the scenario says the glide is feasible: a zero distance would hold vacuously.
  if ((scenarioKey === 'glide' || scenarioKey === 'altitude') && run?.ok && run.feasible === true) {
    put('glideHeight_m', params.launch_height_m, `${scenarioKey} scenario param launch_height_m`);
    put('LD_max', metric('glide_ratio') ?? undefined, `${scenarioKey} scenario metric glide_ratio ((L/D)max used)`);
    put('glideDistance_m', metric('glide_range_lean_bound_m'), `${scenarioKey} scenario metric glide_range_lean_bound_m (the Lean-covered part; glide_range_total_m is deliberately NOT passed: its kinetic phase is outside the theorem)`);
    put('groundEffect', 0, 'the Lean-covered h (L/D) descent carries no ground effect (glide.mjs applies it only in the level phase)');
  }
  // P4 needs CLmax and the Lean lifting-area convention; P4b needs L/D and a ground distance that is not the
  // scenario's own bound (checking a bound against itself proves nothing); P5 needs an assimilation efficiency
  // and activity cost no scenario commits. They stay cannot-evaluate rather than being filled by guesses.
  return { spec, sources };
}
