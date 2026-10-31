// Coupled physiology for the flying-fish simulator: water O2 -> gill counter-current -> haemoglobin -> heart ->
// muscle aerobic power, plus burst (anaerobic) power and an explicit blood O2 store that drains when the gills are out
// of the water. Matches the contract in dashboard/public/t/physics/sim/physiology-stub.js.
// Every internal parameter is {value, kind, source}; kinds: measured | proxy | secondary | derived | tuned | assumed.
// Nothing here is flying-fish physiology data except what the caller passes in spec (mass etc.). No bird data used.
//
// Model (per time step dt):
//   in water: gills ventilate. Arterial content Ca = counter-current(Pw_in, Pv = P(C_pool), D, Gw, Q) (Hb mode)
//   in air (taxi/glide/flight): gills do not ventilate -> no uptake, Ca = C_pool
//   tissue O2 use   VO2 = SMR + P_aero / (Eox * eta), capped at Q (Ca - C_floor)
//   blood O2 store  V_b dC_pool/dt = Q (Ca - C_pool) - VO2          (one well-mixed venous pool)
//   storeFraction = (C_pool - C_floor) / (C_pool,rest - C_floor)
//   C_floor = content at the lowest venous PO2 that supported swimming in trout (8.6 torr, steffensen1998)
//   burst store (J, mechanical) = EPOC energy x eta, drained by any demand above the aerobic supply,
//   recovered in water with time constant tau (heuer2026)
import { solve, tuneD } from './countercurrent.js';
import { HB_PARAMS, content, pressureFromContent, saturation, ML_O2_PER_MG, MMHG_PER_KPA } from './haemoglobin.js';
import { CARDIAC_PARAMS, state as cardiacState } from './cardiac.js';
import { MUSCLE_PARAMS, aerobicPowerFromVO2, availablePower } from './muscle.js';

const P = (value, kind, source, extra = {}) => ({ value, kind, source, ...extra });
const AIR_PHASES = new Set(['taxi', 'glide', 'flight', 'air', 'airborne', 'leap', 'ballistic']);

// Saturation vapour pressure of water (kPa), Magnus form; standard formula, not fetched.
const pH2O = (T) => 0.61094 * Math.exp((17.625 * T) / (T + 243.04));

export const GILL_PARAMS = {
  // trout reference used to tune the gill O2 transfer D per m^2 of gill area
  ref_Q_ml_min_kg: P(26.3, 'proxy', 'sundell2018 (O. mykiss SW, 10.5 degC) cardiac output 26.3 ml/min/kg'),
  ref_MO2_ml_h_kg: P(20.59149728 / 0.3111901235, 'secondary', 'bigman2021 dataset PairedMeanMRData.csv: O. mykiss 20.59 ml O2/h at 311 g, 12 degC (White et al. 2012 compilation) -> 66.2 ml/kg/h'),
  ref_PaO2_kPa: P(15.8, 'proxy', 'mcarley2022: resting arterial PO2 15.8 +/- 0.4 kPa in normoxic O. mykiss at ~10 degC (9.9 kPa after exhaustive exercise)'),
  ref_T_C: P(10, 'proxy', 'mcarley2022 / sundell2018 temperatures ~10 degC'),
  ref_waterO2_mg_l: P(11.3, 'assumed', 'air-saturated fresh water at 10 degC; textbook solubility, not fetched'),
  ref_gillArea_m2_per_kg: P(2021.8e-4 / 1.3064, 'secondary', 'bigman2021 dataset PairedRSAData.csv: O. mykiss 2021.8 cm2 at 1306 g (Niimi & Morgan 1980 via data thief) -> 0.155 m2/kg'),
  ventilation_to_perfusion: P(10, 'assumed', 'water flow / blood flow (Vw/Q); no fetched ventilation volume. Sets water capacitance rate Gw = 10 Q beta_w'),
  default_gillArea_m2_per_kg: P(210756e-6 / 0.182, 'secondary', 'bigman2021 dataset: Scomber scombrus 210756 mm2 at 182 g (Gray 1954) -> 1.16 m2/kg. Active pelagic proxy; no flying-fish gill area found'),
  Pv_floor_kPa: P(8.6 / MMHG_PER_KPA, 'proxy', 'steffensen1998: venous PO2 at fatigue 8.6 torr in sham-operated trout (lowest supporting swimming 11.1 torr)'),
  blood_ml_per_kg: P(30, 'assumed', 'teleost blood volume; no fetched value. Sets how long the blood O2 store lasts out of water'),
  N: P(20, 'assumed', 'lamella segments used at run time (test.mjs uses 50-200)'),
};

let _calib = null;
export function calibrateGills() {
  if (_calib) return _calib;
  const G = GILL_PARAMS;
  const Q = G.ref_Q_ml_min_kg.value / 60; // ml/s per kg
  const MO2 = G.ref_MO2_ml_h_kg.value / 3600; // ml O2/s per kg
  const Pw = 0.2095 * (101.325 - pH2O(G.ref_T_C.value));
  const betaW = (G.ref_waterO2_mg_l.value * ML_O2_PER_MG) / 1000 / Pw; // ml O2 per ml water per kPa
  const Gw = G.ventilation_to_perfusion.value * Q * betaW;
  const Ca = content(G.ref_PaO2_kPa.value);
  const Cv = Ca - MO2 / Q;
  const Pv = pressureFromContent(Cv);
  const base = { Pw_in: Pw, Pb_in: Pv, N: 50, physical: { Gw, Q, hb: {}, D: 1 } };
  const D = tuneD(G.ref_PaO2_kPa.value, base, true);
  const D_per_m2 = D / G.ref_gillArea_m2_per_kg.value;
  const co = solve({ ...base, physical: { ...base.physical, D } }, false);
  const cc = solve({ ...base, physical: { ...base.physical, D } }, true);
  const betaB = (Ca - Cv) / (G.ref_PaO2_kPa.value - Pv);
  _calib = { Pw_in: Pw, Pb_in: Pv, Q, MO2, Ca, Cv, betaW, Gw, D, D_per_m2, betaB, k: D / Gw, ratio: Gw / (Q * betaB), counter: cc, co };
  return _calib;
}

export function createPhysiology(spec = {}, env = {}) {
  const g = (x, d) => (x === undefined || x === null ? d : typeof x === 'object' ? x.value : x);
  const M = g(spec.mass_kg, 0.06);
  const T = g(env.waterTemp_C, 25);
  const airFrac = g(env.airO2_fraction, 0.2095);
  const waterO2 = g(env.waterO2_mg_per_l, 6.8);
  const cal = calibrateGills();

  const S = {
    mass_kg: P(M, spec.mass_kg !== undefined ? 'measured' : 'assumed', 'spec.mass_kg (sim)'),
    waterTemp_C: P(T, env.waterTemp_C !== undefined ? 'measured' : 'assumed', env.waterTemp_C !== undefined ? 'env (sim)' : 'default 25 degC, warm surface water; assumed'),
    waterO2_mg_l: P(waterO2, env.waterO2_mg_per_l !== undefined ? 'measured' : 'assumed', env.waterO2_mg_per_l !== undefined ? 'env (sim)' : 'default 6.8 mg/l, air-saturated warm sea water; assumed, not fetched'),
    gillArea_m2: P(g(spec.gillArea_m2, GILL_PARAMS.default_gillArea_m2_per_kg.value * M), spec.gillArea_m2 !== undefined ? 'proxy' : 'secondary', spec.gillArea_m2 !== undefined ? 'spec.gillArea_m2 (sim)' : GILL_PARAMS.default_gillArea_m2_per_kg.source),
    D_per_m2: P(cal.D_per_m2, 'tuned', 'gill O2 transfer per m2 (ml O2 s-1 kPa-1 m-2), tuned so the trout reference (Q, MO2, Hb) gives PaO2 15.8 kPa (mcarley2022); assumes flying-fish lamellar barrier = trout'),
    hbCap: P(g(spec.hbCapacity_mlO2_per_ml, HB_PARAMS.cap_ml_per_ml.value), spec.hbCapacity_mlO2_per_ml !== undefined ? 'proxy' : 'proxy', spec.hbCapacity_mlO2_per_ml !== undefined ? 'spec.hbCapacity_mlO2_per_ml (sim)' : HB_PARAMS.cap_ml_per_ml.source + '. NOTE: snapper max EO2 0.205 mg/ml = 0.14 ml/ml (durnford2026) exceeds this, so trout blood underestimates warm-water fish'),
    bloodVolume_ml: P(g(spec.bloodVolume_ml, GILL_PARAMS.blood_ml_per_kg.value * M), spec.bloodVolume_ml !== undefined ? 'proxy' : 'assumed', spec.bloodVolume_ml !== undefined ? 'spec.bloodVolume_ml (sim)' : GILL_PARAMS.blood_ml_per_kg.source),
    axialMuscleFraction: P(g(spec.axialMuscleFraction, 0.5), spec.axialMuscleFraction !== undefined ? 'proxy' : 'assumed', spec.axialMuscleFraction !== undefined ? 'spec (sim)' : 'assumed 0.5 of body mass; not fetched'),
    flightMuscleFraction: P(g(spec.flightMuscleFraction, 0), spec.flightMuscleFraction !== undefined ? 'proxy' : 'assumed', spec.flightMuscleFraction !== undefined ? 'spec (sim)' : 'assumed 0 (real flying fish glide; they do not flap)'),
    redFraction: P(MUSCLE_PARAMS.red.fraction_of_myotome.value, 'secondary', MUSCLE_PARAMS.red.fraction_of_myotome.source + '; applied to both groups (assumed)'),
    Q_rest_ml_s: P((CARDIAC_PARAMS.warm.Q_rest_ml_min_kg.value * M) / 60, 'proxy', CARDIAC_PARAMS.warm.Q_rest_ml_min_kg.source),
    Q_max_ml_s: P((CARDIAC_PARAMS.warm.Q_max_ml_min_kg.value * M) / 60, 'proxy', CARDIAC_PARAMS.warm.Q_max_ml_min_kg.source),
    SMR_ml_s: P((CARDIAC_PARAMS.warm.MO2_rest_mg_kg_h.value * ML_O2_PER_MG * M) / 3600, 'proxy', CARDIAC_PARAMS.warm.MO2_rest_mg_kg_h.source),
    oxycal_J_per_mgO2: P(MUSCLE_PARAMS.oxycalorific_J_per_mgO2.value, 'secondary', MUSCLE_PARAMS.oxycalorific_J_per_mgO2.source),
    efficiency: P(MUSCLE_PARAMS.efficiency.value, 'proxy', MUSCLE_PARAMS.efficiency.source),
    redPmax_W_kg: P(MUSCLE_PARAMS.red.Pmax_W_kg.value * Math.pow(MUSCLE_PARAMS.red.Pmax_W_kg.Q10, (T - 20) / 10), 'proxy', MUSCLE_PARAMS.red.Pmax_W_kg.source + ', scaled to water temperature with Q10 1.88 (body temp = water temp assumed)'),
    burst_W_kg: P(MUSCLE_PARAMS.white.burst_W_kg.value, 'proxy', MUSCLE_PARAMS.white.burst_W_kg.source),
    burstStore_J: P(MUSCLE_PARAMS.burstStore_J_per_kg_body.value * MUSCLE_PARAMS.efficiency.value * M, 'proxy', 'mechanical J = ' + MUSCLE_PARAMS.burstStore_J_per_kg_body.source + ' x efficiency'),
    burstRecovery_tau_s: P(MUSCLE_PARAMS.burstRecovery_tau_s.value, 'proxy', MUSCLE_PARAMS.burstRecovery_tau_s.source),
    Pv_floor_kPa: P(GILL_PARAMS.Pv_floor_kPa.value, 'proxy', GILL_PARAMS.Pv_floor_kPa.source),
    ventilation_to_perfusion: P(GILL_PARAMS.ventilation_to_perfusion.value, 'assumed', GILL_PARAMS.ventilation_to_perfusion.source),
    ventilation_mode: P('unknown', 'assumed', 'ram vs buccal-opercular pumping in flying fish: no fetched source; both are modelled the same way (Vw = ratio x Q)'),
    gills_in_air: P(0, 'assumed', 'during taxi/glide/flight phases the gills are treated as not ventilating (no uptake); taxiing fish keep only the caudal lobe in water'),
  };

  const hb = { cap_ml_per_ml: S.hbCap.value };
  const Pw_in = airFrac * (101.325 - pH2O(T));
  const betaW = (waterO2 * ML_O2_PER_MG) / 1000 / Pw_in;
  const D = S.D_per_m2.value * S.gillArea_m2.value;
  const Cfloor = content(S.Pv_floor_kPa.value, hb);
  const Jml = S.oxycal_J_per_mgO2.value / ML_O2_PER_MG; // J per ml O2
  const eta = S.efficiency.value;

  const cache = new Map();
  function gillCa(Pv, Q) {
    const key = Pv.toFixed(2) + '|' + Q.toPrecision(3);
    if (cache.has(key)) return cache.get(key);
    const Gw = S.ventilation_to_perfusion.value * Q * betaW;
    const r = solve({ Pw_in, Pb_in: Pv, N: GILL_PARAMS.N.value, physical: { D, Gw, Q, hb } }, true);
    const Ca = Math.max(r.bloodOutContent, content(Pv, hb));
    if (cache.size > 5000) cache.clear();
    cache.set(key, Ca);
    return Ca;
  }
  // resting steady state in water: find C_pool with Q_rest (Ca - C_pool) = SMR
  const Qr = S.Q_rest_ml_s.value, SMR = S.SMR_ml_s.value;
  let lo = 0, hi = content(Pw_in, hb);
  for (let i = 0; i < 50; i++) { const mid = 0.5 * (lo + hi); const up = Qr * (gillCa(pressureFromContent(mid, hb), Qr) - mid); if (up > SMR) lo = mid; else hi = mid; }
  const CpoolRest = 0.5 * (lo + hi);
  const restingFeasible = CpoolRest > Cfloor;
  // maximum aerobic O2 supply in water: Q_max with venous at the floor
  const Qm = S.Q_max_ml_s.value;
  const CaMax = gillCa(S.Pv_floor_kPa.value, Qm);
  const VO2maxWater = Math.max(0, Qm * (CaMax - Cfloor));

  let Cpool = CpoolRest, burstLeft = S.burstStore_J.value, inWater = true;
  let last = { VO2: SMR, Ca: gillCa(pressureFromContent(CpoolRest, hb), Qr), Q: Qr };

  function o2SupplyForWork() { // ml O2/s available for muscle work above SMR, right now
    if (inWater) return Math.max(0, VO2maxWater - SMR);
    return Math.max(0, Qm * (Cpool - Cfloor) - SMR);
  }

  function groupPower(group) {
    const frac = group === 'flight' ? S.flightMuscleFraction.value : S.axialMuscleFraction.value;
    const mm = frac * M;
    const r = availablePower({ muscleMass_kg: mm, T, VO2_supply_ml_s: o2SupplyForWork(), redFraction: S.redFraction.value, burstStoreLeft_J: burstLeft });
    let limitedBy = r.aerobicLimitedBy;
    if (!inWater && Cpool - Cfloor < 1e-4) limitedBy = 'store';
    if (burstLeft <= 0 && limitedBy !== 'muscle') limitedBy = 'store';
    return { aerobic_W: r.aerobic_W, burst_W: r.burst_W, total_W: r.total_W, limitedBy, aerobicMuscleCap_W: r.aerobicMuscleCap_W, aerobicO2Cap_W: r.aerobicO2Cap_W };
  }

  return {
    step(dt, st = {}) {
      inWater = !AIR_PHASES.has(st.phase);
      const demand = Math.max(0, st.demand_W ?? 0);
      const a = groupPower('axial'), f = groupPower('flight');
      const aeroCap = Math.min(a.aerobicMuscleCap_W + f.aerobicMuscleCap_W, aerobicPowerFromVO2(o2SupplyForWork(), eta));
      const aero = Math.min(demand, aeroCap);
      const VO2need = SMR + aero / (Jml * eta);
      const x = Math.max(0, Math.min(1, (VO2need - SMR) / Math.max(1e-12, VO2maxWater - SMR)));
      const Q = Qr + x * (Qm - Qr);
      const Ca = inWater ? gillCa(pressureFromContent(Cpool, hb), Q) : Cpool;
      const VO2 = Math.min(VO2need, Math.max(0, Q * (Ca - Cfloor)));
      const shortfall_W = Math.max(0, (VO2need - VO2) * Jml * eta);
      const uptake = inWater ? Q * (Ca - Cpool) : 0;
      Cpool = Math.max(Cfloor, Cpool + (dt * (uptake - VO2)) / S.bloodVolume_ml.value);
      const burstUse = Math.max(0, demand - aero) + shortfall_W;
      burstLeft = Math.max(0, burstLeft - burstUse * dt);
      if (inWater && burstUse === 0) burstLeft += (S.burstStore_J.value - burstLeft) * (dt / S.burstRecovery_tau_s.value);
      last = { VO2, Ca, Q };
    },
    powerAvailable(group, speed_m_s) { // speed is accepted for the contract; tail-beat frequency mapping is not sourced
      return groupPower(group);
    },
    o2() {
      return {
        deliveredRate_mlO2_per_s: last.VO2,
        arterialSat: saturation(pressureFromContent(last.Ca, hb), hb),
        venousSat: saturation(pressureFromContent(Cpool, hb), hb),
        storeFraction: Math.max(0, Math.min(1, (Cpool - Cfloor) / (CpoolRest - Cfloor))),
        burstStoreFraction: burstLeft / S.burstStore_J.value,
        inWater,
      };
    },
    describe() {
      const unit = { mass_kg: 'kg', waterTemp_C: 'degC', waterO2_mg_l: 'mg/l', gillArea_m2: 'm2', D_per_m2: 'ml O2 s-1 kPa-1 m-2', hbCap: 'ml O2/ml', bloodVolume_ml: 'ml', axialMuscleFraction: '-', flightMuscleFraction: '-', redFraction: '-', Q_rest_ml_s: 'ml/s', Q_max_ml_s: 'ml/s', SMR_ml_s: 'ml O2/s', oxycal_J_per_mgO2: 'J/mg O2', efficiency: '-', redPmax_W_kg: 'W/kg muscle', burst_W_kg: 'W/kg muscle', burstStore_J: 'J', burstRecovery_tau_s: 's', Pv_floor_kPa: 'kPa', ventilation_to_perfusion: '-', ventilation_mode: '', gills_in_air: '' };
      const rows = Object.entries(S).map(([k, p]) => ({ quantity: k, value: p.value, unit: unit[k] ?? '', kind: p.kind, source: p.source }));
      rows.push({ quantity: 'Pw_in_kPa', value: Pw_in, unit: 'kPa', kind: 'derived', source: 'airO2_fraction x (101.325 - pH2O(T)), Magnus pH2O (standard formula, not fetched); assumes air-saturated water' });
      rows.push({ quantity: 'VO2max_water_ml_s', value: VO2maxWater, unit: 'ml O2/s', kind: 'derived', source: 'Q_max x (Ca at Q_max - C at Pv_floor), gill counter-current + Hill' });
      rows.push({ quantity: 'restingFeasible', value: restingFeasible, unit: '', kind: 'derived', source: 'false means proxy Q and Hb cannot meet proxy SMR (species mismatch); raise hbCapacity' });
      rows.push({ quantity: 'blood_store_ml_O2', value: S.bloodVolume_ml.value * (CpoolRest - Cfloor), unit: 'ml O2', kind: 'derived', source: 'V_b x (C_pool,rest - C_floor): usable O2 once gills leave the water' });
      return rows;
    },
    isStub: false,
  };
}
