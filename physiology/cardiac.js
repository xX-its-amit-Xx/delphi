// Minimal teleost heart model for animation and for the O2 chain. Dependency-free ES module.
// No flying-fish cardiac data were found. Two proxy sets:
//   warm: schoolmaster snapper Lutjanus apodus, 28 degC seawater (durnford2026 Table 1, Ucrit group) - default,
//         because flying fish live in warm surface water; snapper is a tropical reef fish, NOT a pelagic.
//   cold: rainbow trout Oncorhynchus mykiss, seawater-acclimated, 10.5 degC (sundell2018) - used for dorsal aortic
//         pressure and systemic resistance (snapper pressure was not reported).
//
// Equations
//   Q = HR * SV                                                    cardiac output (ml/min/kg = beats/min x ml/kg)
//   Intensity x in [0,1]:  HR(x) = HR_rest + x (HR_max - HR_rest),  SV(x) likewise
//   Inflow (bulbus -> ventral aorta) during systole, half-sine:
//     Qin(t) = (pi/2) * (SV*m) / Ts * sin(pi * tau / Ts)  for tau = t mod T < Ts, else 0     (integral = SV*m)
//   Two-element Windkessel at the ventral aorta (bulbus arteriosus + elastic ventral aorta as compliance C,
//   gills + systemic beds in series as resistance R):
//     C dP_VA/dt = Qin(t) - (P_VA - P_cv) / R,   R = R_gill + R_sys
//   Dorsal aorta (after the gills, quasi-steady):  P_DA = P_VA - Q_out * R_gill
//   R_sys = mean P_DA / mean Q (P_cv taken as 0)
const CMH2O_KPA = 0.0980665;

export const CARDIAC_PARAMS = {
  warm: {
    HR_rest_bpm: { value: 96.41, kind: 'proxy', species: 'Lutjanus apodus, 28 degC', source: 'durnford2026 Table 1 (Ucrit group) resting fH 96.41 +/- 7.05 beats/min' },
    HR_max_bpm: { value: 153.01, kind: 'proxy', species: 'Lutjanus apodus, 28 degC', source: 'durnford2026 Table 1 (Ucrit) maximum fH 153.01 +/- 3.74; 183.09 in the CTSmax test' },
    SV_rest_ml_kg: { value: 0.306, kind: 'proxy', species: 'Lutjanus apodus', source: 'durnford2026 Table 1 (Ucrit) resting SV 0.306 +/- 0.030 ml/kg' },
    SV_max_ml_kg: { value: 0.429, kind: 'proxy', species: 'Lutjanus apodus', source: 'durnford2026 Table 1 (Ucrit) maximum SV 0.429 +/- 0.030 ml/kg' },
    Q_rest_ml_min_kg: { value: 28.54, kind: 'proxy', species: 'Lutjanus apodus', source: 'durnford2026 Table 1 (Ucrit) resting Q 28.54 +/- 2.02 ml/min/kg' },
    Q_max_ml_min_kg: { value: 58.48, kind: 'proxy', species: 'Lutjanus apodus', source: 'durnford2026 Table 1 (Ucrit) maximum Q 58.48 +/- 3.44 ml/min/kg' },
    MO2_rest_mg_kg_h: { value: 224.92, kind: 'proxy', species: 'Lutjanus apodus', source: 'durnford2026 Table 1 (Ucrit) resting MO2 224.92 +/- 10.41 mg O2/kg/h (max 684.57)' },
    EO2_max_mg_ml: { value: 0.205, kind: 'proxy', species: 'Lutjanus apodus', source: 'durnford2026 Table 1 (Ucrit) max blood O2 extraction MO2/Q 0.205 +/- 0.013 mg O2/ml blood (rest 0.134)' },
  },
  cold: {
    Q_ml_min_kg: { value: 26.3, kind: 'proxy', species: 'O. mykiss, SW, 10.5 degC', source: 'sundell2018: cardiac output 26.3 +/- 4.1 ml/min/kg (SW) vs 15.7 +/- 1.9 (FW)' },
    SV_ml_beat: { value: 0.44, kind: 'proxy', species: 'O. mykiss, SW', source: 'sundell2018: stroke volume 0.44 +/- 0.06 "ml beat-1" (SW) vs 0.28 (FW); unit printed without per-kg, but Q/SV then implies ~19 bpm for ~0.32 kg fish, so it is probably per kg (HR ~60 bpm, not reported in text)' },
    P_DA_kPa: { value: 20.7 * CMH2O_KPA, kind: 'proxy', species: 'O. mykiss, SW', source: 'sundell2018: mean dorsal aortic pressure 20.7 +/- 1.5 cmH2O (SW), 30.8 +/- 1.6 (FW); converted 1 cmH2O = 0.0980665 kPa -> 2.03 kPa' },
    Q_range_ml_min_kg: { value: [20, 75], kind: 'secondary', species: 'O. mykiss', source: 'gerry2014 Discussion: ventral aortic flow-cuff values ~20 at rest to ~75 ml/min/kg maximum (citing refs)' },
  },
  gillResistanceFraction: { value: 0.25, kind: 'assumed', source: 'share of total vascular resistance across the gills; no fetched absolute ventral aortic pressure (kiceniuk1977 abstract gives only % changes: ventral +60%, dorsal +20% at Ucrit)' },
  systoleFraction: { value: 0.4, kind: 'assumed', source: 'fraction of the cycle with ventricular ejection; not fetched' },
  tau_s: { value: 1.0, kind: 'assumed', source: 'Windkessel time constant R*C; not fetched. Chosen so the pressure pulse is smoothed but visible at ~1.6 Hz' },
  P_cv_kPa: { value: 0, kind: 'assumed', source: 'central venous pressure taken as 0 for R_sys; kiceniuk1977 abstract: CVP "virtually unchanged" in exercise (no value read)' },
};

export function state(intensity = 0, set = 'warm') {
  const p = CARDIAC_PARAMS[set];
  const x = Math.max(0, Math.min(1, intensity));
  const HR = p.HR_rest_bpm.value + x * (p.HR_max_bpm.value - p.HR_rest_bpm.value);
  const SV = p.SV_rest_ml_kg.value + x * (p.SV_max_ml_kg.value - p.SV_rest_ml_kg.value);
  return { HR_bpm: HR, SV_ml_kg: SV, Q_ml_min_kg: HR * SV, period_s: 60 / HR };
}

// Simulate the ventral-aortic Windkessel. Returns time series for animation.
export function simulate({ mass_kg = 1, intensity = 0, beats = 5, dt = 0.002, set = 'warm' } = {}) {
  const s = state(intensity, set);
  const Q_mean = (s.Q_ml_min_kg * mass_kg) / 60; // ml/s
  const PDA = CARDIAC_PARAMS.cold.P_DA_kPa.value; // trout pressure applied to the warm set: proxy
  const fg = CARDIAC_PARAMS.gillResistanceFraction.value;
  const PVA_mean = PDA / (1 - fg);
  const R = (PVA_mean - CARDIAC_PARAMS.P_cv_kPa.value) / Q_mean; // kPa s / ml
  const Rg = fg * R;
  const C = CARDIAC_PARAMS.tau_s.value / R; // ml / kPa
  const T = s.period_s, Ts = CARDIAC_PARAMS.systoleFraction.value * T, SVabs = s.SV_ml_kg * mass_kg;
  const t = [], Qin = [], PVA = [], PDAs = [];
  let P = PVA_mean;
  // spin up 10 beats so the periodic state is reached, then record
  const nSpin = Math.round((10 * T) / dt), nRec = Math.round((beats * T) / dt);
  for (let i = 0; i < nSpin + nRec; i++) {
    const tt = i * dt, tau = tt % T;
    const q = tau < Ts ? (Math.PI / 2) * (SVabs / Ts) * Math.sin((Math.PI * tau) / Ts) : 0;
    const qout = (P - CARDIAC_PARAMS.P_cv_kPa.value) / R;
    P += (dt * (q - qout)) / C;
    if (i >= nSpin) { t.push(+(tt - nSpin * dt).toFixed(4)); Qin.push(q); PVA.push(P); PDAs.push(P - qout * Rg); }
  }
  const stats = (a) => ({ mean: a.reduce((x, y) => x + y, 0) / a.length, max: Math.max(...a), min: Math.min(...a) });
  return { ...s, Q_mean_ml_s: Q_mean, R_kPa_s_ml: R, C_ml_kPa: C, t, Qin_ml_s: Qin, P_VA_kPa: PVA, P_DA_kPa: PDAs, P_VA: stats(PVA), P_DA: stats(PDAs) };
}
