// Fish muscle: aerobic power from O2 delivery, a Hill-type force-velocity model, and burst (anaerobic) power.
// Dependency-free ES module. No flying-fish muscle mechanics were found; every value is a labelled proxy or assumption.
// fast_pelagic: true marks values measured in tunas (fast pelagic scombrids). No bird data used.
//
// Equations
//   Aerobic power:        P_aero = VO2 * Eox * eta
//                         VO2 <= Q * (Ca - Cv_min)              (O2 delivery bound; contents in ml O2/ml blood)
//                         Eox = 13.54 J per mg O2 = 13.54 / 0.7 J per ml O2 (STPD)
//   Hill force-velocity:  F/F0 = (1 - v) / (1 + v/kappa),  v = V/Vmax  (rectangular hyperbola, Hill 1938 form)
//                         power ratio  p(v) = v (1 - v) / (1 + v/kappa);  dp/dv = 0 at v_opt = sqrt(kappa(1+kappa)) - kappa
//   Mass-specific power:  P/m = sigma0 * Vmax[L/s] * p(v) / rho        (W/kg; sigma0 in Pa, rho in kg/m^3)
//   Cyclic (work-loop-like) power vs frequency f with strain amplitude +/-eps:
//                         V = 4 eps f (L/s, mean shortening velocity over the shortening half-cycle)
//                         P(f)/m = duty * sigma0 * V * F(V)/F0 / rho * A(f),  A(f) = 1 / (1 + (f/fc)^2)
//                         duty = 0.5 (shortening half of the cycle), A(f) a lumped activation/relaxation penalty
//   Temperature:          X(T) = X(Tref) * Q10^((T - Tref)/10)
import { ML_O2_PER_MG } from './haemoglobin.js';

export const MUSCLE_PARAMS = {
  oxycalorific_J_per_mgO2: { value: 13.54, kind: 'secondary', source: 'gerry2014 (Fig. 1 legend): "oxycaloric value of 13.54 J mg-1 O2" citing their ref. 89' },
  efficiency: { value: 0.15, kind: 'proxy', species: 'Salmo salar (ventricular muscle)', source: 'gamperl2021: efficiency of ventricular muscle ~15% in salmon (7% in char); trout ventricle 15-25% (Harwood et al. 2002, cited there). No fetched value for fish skeletal muscle, so cardiac muscle is used.' },
  density_kg_m3: { value: 1060, kind: 'assumed', source: 'muscle density ~1060 kg/m^3; standard value, not fetched' },
  red: {
    Vmax_L_s: { value: 5.55, Tref: 20, Q10: 1.69, kind: 'proxy', species: 'Stenotomus chrysops (scup) red muscle', source: 'rome1992 abstract: Vmax 3.32 L/s at 10 degC, 5.55 L/s at 20 degC, Q10 1.69' },
    sigma0_Pa: { value: 183e3, Tref: 20, Q10: 1.08, kind: 'proxy', species: 'scup red muscle', source: 'rome1992 abstract: isometric force 183 kN m-2, Q10 1.08' },
    Pmax_W_kg: { value: 134, Tref: 20, Q10: 1.88, kind: 'proxy', species: 'scup red muscle', source: 'rome1992 abstract: maximal power 71 W/kg at 10 degC, 134 W/kg at 20 degC, Q10 1.88 (steady force-velocity power)' },
    v_opt: { value: 0.37, kind: 'proxy', species: 'scup', source: 'rome1992 abstract: V/Vmax 0.37 "where maximum power is generated"; in vivo use range 0.17-0.37' },
    fraction_of_myotome: { value: 0.05, kind: 'secondary', species: 'Oncorhynchus mykiss', source: 'gerry2014 Discussion: mosaic slow-like fibres "approximately 5% of the myotomal muscle mass [49], an amount approximately equal to that of the superficial slow muscle"' },
  },
  pink: {
    Vmax_L_s: { value: 7.26, Tref: 20, kind: 'proxy', species: 'scup pink muscle', source: 'coughlin1996 abstract: 7.26 +/- 0.18 L/s at 20 degC, 4.46 at 10 degC' },
  },
  white: {
    Vmax_L_s: { value: 12, Tref: 10, Q10: 1.5, kind: 'proxy', species: 'Osmerus mordax (rainbow smelt) myotomal muscle', source: 'woytanowski2013: Vmax ~5-9 L/s (2011) and ~12->18 L/s (2012) at 10 degC depending on acclimation; 12 taken (2012 warm-acclimated). Q10 ~1.5 quoted there citing Coughlin et al. 1996.' },
    sigma0_Pa: { value: 183e3, kind: 'assumed', source: 'no fetched isometric stress for fish white muscle; set equal to scup red muscle (rome1992)' },
    burst_W_kg: { value: 307, kind: 'proxy', species: 'Myoxocephalus scorpius (short-horn sculpin) fast muscle', source: 'james1998 abstract: max instantaneous power 307 W/kg wet muscle (C-bend), 222 W/kg (contralateral contraction), independent of size; work loops with in vivo strain/stimulation' },
  },
  burstStore_J_per_kg_body: { value: 1307 * 13.54, kind: 'proxy', species: 'Coryphaena hippurus (mahi-mahi, pelagic)', source: 'derived: heuer2026 EPOC after chase to exhaustion 1307 +/- 77 mg O2/kg at 4 h (>=1701 at 7 h) x 13.54 J/mg (gerry2014) = 17.7 kJ/kg body metabolic energy. EPOC overestimates the anaerobic energy actually used (it includes other recovery costs), so treat as an upper bound.' },
  burstRecovery_tau_s: { value: 240 * 60, kind: 'proxy', species: 'mahi-mahi', source: 'heuer2026: post-Ucrit EPOC lasted ~240 min; used as the recovery time constant' },
  pelagic: {
    skipjack_red: { fast_pelagic: true, species: 'Katsuwonus pelamis', source: 'syme2002 abstract (25 degC): strain +/-5.5% (0.44 FL) and +/-8% (0.70 FL); power maximal at 5 Hz, near zero at 15 Hz; cruise tail-beat 2.8-5.2 Hz gives 75-100% of max power' },
    yellowfin_red: { fast_pelagic: true, species: 'Thunnus albacares', source: 'shadwick2008 abstract: red-muscle strain +/-5.4% at 0.5 L; power maximal at 3-4 Hz, <50% of max above 6 Hz' },
    tuna_bonito_temperature: { fast_pelagic: true, species: 'Thunnus albacares, Sarda chiliensis', source: 'altringham1997 abstract: a 10 degC differential "would typically double maximum muscle power output" and f_opt (qualitative; no absolute values used)' },
  },
  strain_amplitude: { value: 0.055, kind: 'proxy', fast_pelagic: true, species: 'Katsuwonus pelamis', source: 'syme2002 abstract: +/-5.5% anterior red muscle' },
  fc_Hz: { value: null, kind: 'tuned', source: 'activation/relaxation cutoff chosen so red-muscle cyclic power peaks at 5 Hz at 25 degC, the skipjack value (syme2002). Computed by tuneFc().' },
};

const q10 = (p, T) => (p.Q10 && p.Tref !== undefined ? p.value * Math.pow(p.Q10, (T - p.Tref) / 10) : p.value);

export function kappaFromVopt(v_opt) { // invert v_opt = sqrt(k(1+k)) - k  ->  k = v_opt^2 / (1 - 2 v_opt)
  return (v_opt * v_opt) / (1 - 2 * v_opt);
}
export const KAPPA = kappaFromVopt(MUSCLE_PARAMS.red.v_opt.value); // 0.5265, Hill curvature a/F0 (tuned to v_opt)

export function forceRatio(v, kappa = KAPPA) { if (v >= 1) return 0; if (v <= 0) return 1; return (1 - v) / (1 + v / kappa); }
export function powerRatio(v, kappa = KAPPA) { return v * forceRatio(v, kappa); }

// Mass-specific steady (isovelocity) power at relative velocity v, W/kg muscle
export function steadyPower(fibre = 'red', T = 20, v = MUSCLE_PARAMS.red.v_opt.value) {
  const f = MUSCLE_PARAMS[fibre];
  const Vmax = q10(f.Vmax_L_s, T), sigma = f.sigma0_Pa.Q10 ? q10(f.sigma0_Pa, T) : f.sigma0_Pa.value;
  return (sigma * Vmax * powerRatio(v)) / MUSCLE_PARAMS.density_kg_m3.value;
}

// Cyclic power vs contraction (tail-beat) frequency, W/kg muscle
export function cyclicPower(fibre, T, f_Hz, eps = MUSCLE_PARAMS.strain_amplitude.value, fc = null) {
  const m = MUSCLE_PARAMS[fibre];
  const Vmax = q10(m.Vmax_L_s, T), sigma = m.sigma0_Pa.Q10 ? q10(m.sigma0_Pa, T) : m.sigma0_Pa.value;
  const V = 4 * eps * f_Hz;
  const fcut = fc ?? tuneFc();
  const A = 1 / (1 + Math.pow(f_Hz / fcut, 2));
  return (0.5 * sigma * V * forceRatio(V / Vmax)) / MUSCLE_PARAMS.density_kg_m3.value * A;
}

let _fc = null;
export function tuneFc(target_Hz = 5, T = 25) {
  if (_fc) return _fc;
  const peakOf = (fc) => { let best = 0, bf = 0; for (let f = 0.1; f <= 20; f += 0.05) { const p = cyclicPower('red', T, f, undefined, fc); if (p > best) { best = p; bf = f; } } return bf; };
  let lo = 0.5, hi = 100;
  for (let i = 0; i < 50; i++) { const mid = Math.sqrt(lo * hi); if (peakOf(mid) < target_Hz) lo = mid; else hi = mid; }
  _fc = Math.sqrt(lo * hi);
  MUSCLE_PARAMS.fc_Hz.value = _fc;
  return _fc;
}

export function powerCurve(fibre = 'red', T = 20, fMax = 15, df = 0.25) {
  const out = [];
  for (let f = df; f <= fMax + 1e-9; f += df) out.push({ f_Hz: +f.toFixed(3), W_per_kg: cyclicPower(fibre, T, f) });
  return out;
}

// Aerobic mechanical power (W) from an O2 consumption rate (ml O2 / s)
export function aerobicPowerFromVO2(VO2_ml_s, eta = MUSCLE_PARAMS.efficiency.value) {
  const J_per_ml = MUSCLE_PARAMS.oxycalorific_J_per_mgO2.value / ML_O2_PER_MG;
  return VO2_ml_s * J_per_ml * eta;
}
// O2-delivery bound on VO2 (ml/s): Q (ml blood / s) x (Ca - Cv_min)
export function maxVO2(Q_ml_s, Ca, Cv_min) { return Math.max(0, Q_ml_s * (Ca - Cv_min)); }

// Aerobic and burst power available from a muscle mass (kg) at temperature T, given an O2 supply (ml O2/s)
export function availablePower({ muscleMass_kg, T = 20, VO2_supply_ml_s = Infinity, redFraction = MUSCLE_PARAMS.red.fraction_of_myotome.value, burstStoreLeft_J = Infinity }) {
  const redMass = muscleMass_kg * redFraction, whiteMass = muscleMass_kg - redMass;
  const aerobicMuscleCap = redMass * q10(MUSCLE_PARAMS.red.Pmax_W_kg, T);
  const aerobicO2Cap = aerobicPowerFromVO2(VO2_supply_ml_s);
  const aerobic = Math.min(aerobicMuscleCap, aerobicO2Cap);
  const burst = burstStoreLeft_J > 0 ? whiteMass * MUSCLE_PARAMS.white.burst_W_kg.value : 0;
  return { aerobic_W: aerobic, burst_W: burst, total_W: aerobic + burst, aerobicLimitedBy: aerobicO2Cap < aerobicMuscleCap ? 'o2' : 'muscle', aerobicMuscleCap_W: aerobicMuscleCap, aerobicO2Cap_W: aerobicO2Cap };
}
