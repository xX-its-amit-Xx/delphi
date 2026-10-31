// Coupling interface between the organism-level flight mechanics (sim/index.html) and the physiology chain.
// The real modules are being written by another agent as physiology/{countercurrent,cardiac,haemoglobin,muscle}.js
// with circulation.json and a README of sources. This file is the STUB the sim imports until they land. Every number
// here is labelled: nothing in this stub is a measurement of a flying fish, and no bird value is used.
//
// Contract (what the sim calls, what it expects back; units SI):
//   const phys = createPhysiology(spec, env)
//     spec: { mass_kg, flightMuscleFraction, axialMuscleFraction, gillArea_m2, hbCapacity_mlO2_per_ml, bloodVolume_ml, ... }
//           every field carries {value, kind, source} in params.json; the sim passes the values.
//     env:  { waterO2_mg_per_l, waterTemp_C, airO2_fraction }
//   phys.step(dt_s, state)  -> advances the internal O2 and energy stores; state = {phase, speed_m_s, demand_W}
//   phys.powerAvailable(muscleGroup, speed_m_s) -> { aerobic_W, burst_W, total_W, limitedBy: 'o2' | 'muscle' | 'store' }
//   phys.o2()  -> { deliveredRate_mlO2_per_s, arterialSat, venousSat, storeFraction }
//   phys.describe() -> array of {quantity, value, unit, kind, source} for the parameter panel
//
// Chain the real modules implement (each level its own module, coupled through the shared quantities):
//   chemistry: water O2 -> gill counter-current exchange (gill area, diffusion distance, ventilation) -> arterial O2
//   chemistry: haemoglobin O2 binding (Hill equation: P50, n) -> O2 content per ml blood
//   organ:     cardiac output (Windkessel) -> O2 delivery = cardiac output x (arterial - venous) content
//   tissue:    aerobic power = O2 delivery x oxycaloric equivalent x mechanical efficiency; burst power from
//              phosphagen/glycolytic stores with a depletion time; Hill force-velocity for the muscle's power-speed curve
//   organism:  thrust (swim/taxi), flapping power (designed flier) drawn from powerAvailable; drag/lift in sim/index.html

export function createPhysiology(spec, env) {
  // STUB values. Each is a placeholder with the kind of source it must eventually have. The sim shows them as "stub".
  const S = {
    // mass-specific aerobic power of locomotor muscle: upper bound to be replaced by the chain's O2-delivery-limited value
    aerobicSpecific_W_per_kg: { value: 0, kind: 'stub', source: 'set to 0 until physiology/ lands; the O2 chain decides it' },
    // burst (anaerobic) specific power and its store: placeholder, to be sourced from fish muscle literature by the physiology agent
    burstSpecific_W_per_kg: { value: 0, kind: 'stub', source: 'set to 0 until physiology/ lands' },
    burstStore_J_per_kg: { value: 0, kind: 'stub', source: 'set to 0 until physiology/ lands' },
  };
  let store = 1; // fraction of burst store remaining
  return {
    step(dt, state) {
      const total = this.powerAvailable('axial', state.speed_m_s).total_W;
      if (state.demand_W > 0 && total > 0 && S.burstStore_J_per_kg.value > 0) {
        store = Math.max(0, store - (Math.min(state.demand_W, total) * dt) / (S.burstStore_J_per_kg.value * spec.mass_kg));
      }
    },
    powerAvailable(group, v) {
      const frac = group === 'flight' ? (spec.flightMuscleFraction ?? 0) : (spec.axialMuscleFraction ?? 0);
      const mm = frac * spec.mass_kg;
      const aerobic = mm * S.aerobicSpecific_W_per_kg.value;
      const burst = store > 0 ? mm * S.burstSpecific_W_per_kg.value : 0;
      return { aerobic_W: aerobic, burst_W: burst, total_W: aerobic + burst, limitedBy: 'stub' };
    },
    o2() { return { deliveredRate_mlO2_per_s: null, arterialSat: null, venousSat: null, storeFraction: store }; },
    describe() {
      return Object.entries(S).map(([k, p]) => ({ quantity: k, value: p.value, unit: k.includes('W_per') ? 'W/kg' : 'J/kg', kind: p.kind, source: p.source }));
    },
    isStub: true,
  };
}
