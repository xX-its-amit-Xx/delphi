// Haemoglobin O2 binding (Hill equation) for the DELPHI flying-fish physiology chain.
// No flying-fish haemoglobin data were found (Europe PMC / Crossref searches, 2026-10-31). All curve parameters
// are rainbow trout (Oncorhynchus mykiss) values from Rummer & Brauner 2015 (PLoS One, doi 10.1371/journal.pone.0139477,
// Table 1, 0.25% CO2 treatment, pHe 8.01, fish held at 10 degC). No bird data used.
//
// Equations (P in kPa, contents in ml O2 per ml blood, STPD):
//   S(P)      = P^n / (P^n + P50^n)                         Hill equation
//   C(P)      = cap * S(P) + alpha * P                       bound + dissolved O2
//   P50(dpH)  = P50 * 10^(phi * dpH)                         Bohr shift (phi = dlogP50/dpH, Rummer & Brauner 2015 Eq. 1)
//   cap       = 4 * [Hb tetramer] * 22.4 ml/mmol             4 O2 per tetramer; molar volume of an ideal gas at STPD
export const MMHG_PER_KPA = 7.50062;
export const ML_O2_PER_MG = 22.4 / 32.0; // 0.7 ml O2 (STPD) per mg O2: molar volume / molar mass (standard constants)

export const HB_PARAMS = {
  P50_kPa: { value: 24.8 / MMHG_PER_KPA, kind: 'proxy', species: 'Oncorhynchus mykiss', source: 'rummer2015 Table 1: P50 24.8 +/- 0.3 mmHg at 0.25% CO2 (pHe 8.01); converted to kPa (3.31)' },
  n: { value: 1.34, kind: 'proxy', species: 'Oncorhynchus mykiss', source: 'rummer2015 text: Hill coefficient 1.34 at 0.25% CO2 (Table 1: 1.3 +/- 0.1)' },
  bohr_phi: { value: -0.91, kind: 'proxy', species: 'Oncorhynchus mykiss', source: 'rummer2015 Table 1: Bohr coefficient -0.91 at 0.25% CO2 (range -0.67 to -0.91 across CO2 levels)' },
  cap_ml_per_ml: { value: (4 * 0.9 * 22.4) / 1000, kind: 'proxy', species: 'Oncorhynchus mykiss', source: 'derived from rummer2015 Table 1 [Hb] 0.9 mM per tetramer (Hct standardised to ~25%): 4 x 0.9 mmol/l x 22.4 ml/mmol = 0.0806 ml O2/ml' },
  alpha_ml_per_ml_kPa: { value: 0.00003 * MMHG_PER_KPA, kind: 'assumed', source: 'plasma O2 solubility ~0.00003 ml O2 ml-1 mmHg-1 is a textbook physical value, not fetched, so assumed; it is <2% of arterial content' },
  root_effect: { value: true, kind: 'proxy', species: 'Oncorhynchus mykiss', source: 'rummer2015: low cooperativity "characteristic of Root effect Hbs"; P50 > 160 mmHg at 4% CO2 (pHe 6.96). Only the Bohr shift is modelled.' },
};

const val = (p, k) => (p && p[k] !== undefined ? (typeof p[k] === 'object' ? p[k].value : p[k]) : HB_PARAMS[k].value);

export function saturation(P_kPa, p = {}) {
  const P50 = val(p, 'P50_kPa'), n = val(p, 'n');
  if (P_kPa <= 0) return 0;
  const x = Math.pow(P_kPa, n);
  return x / (x + Math.pow(P50, n));
}

export function content(P_kPa, p = {}) {
  return val(p, 'cap_ml_per_ml') * saturation(P_kPa, p) + val(p, 'alpha_ml_per_ml_kPa') * Math.max(0, P_kPa);
}

// Inverse of content(): PO2 (kPa) giving content C. Start from the analytic Hill inverse (ignoring dissolved O2),
// refine with safeguarded Newton steps; content is monotonic in P.
export function pressureFromContent(C, p = {}) {
  if (C <= 0) return 0;
  const cap = val(p, 'cap_ml_per_ml'), alpha = val(p, 'alpha_ml_per_ml_kPa'), P50 = val(p, 'P50_kPa'), n = val(p, 'n');
  const S0 = Math.min(0.999999, Math.max(1e-9, C / cap));
  let P = Math.min(P50 * Math.pow(S0 / (1 - S0), 1 / n), C / alpha);
  for (let i = 0; i < 50; i++) {
    const x = Math.pow(P, n), y = Math.pow(P50, n);
    const f = cap * (x / (x + y)) + alpha * P - C;
    const df = (cap * n * x * y) / (P * (x + y) * (x + y)) + alpha;
    let Pn = P - f / df;
    if (!(Pn > 0)) Pn = P / 2;
    if (Math.abs(Pn - P) < 1e-12 * Math.max(1, P)) { P = Pn; break; }
    P = Pn;
  }
  return P;
}

// Bohr shift: P50 after an arterial-to-venous pH change dpH (negative = acidification -> right shift).
export function bohrP50(dpH, p = {}) {
  return val(p, 'P50_kPa') * Math.pow(10, val(p, 'bohr_phi') * dpH);
}

// Effective blood O2 capacitance between two PO2s (ml O2 ml-1 kPa-1), the beta_b a linear exchanger model needs.
export function effectiveCapacitance(P1, P2, p = {}) {
  if (Math.abs(P1 - P2) < 1e-9) { const h = 1e-4; return (content(P1 + h, p) - content(P1 - h, p)) / (2 * h); }
  return (content(P1, p) - content(P2, p)) / (P1 - P2);
}
