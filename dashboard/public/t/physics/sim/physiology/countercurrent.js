// Counter-current (and co-current) O2 exchange along one gill lamella, steady state, discretised into N segments.
// Dependency-free ES module. Water flows from x=0 to x=1. Counter-current: blood flows x=1 -> x=0.
// Co-current: blood flows x=0 -> x=1.
//
// Per segment i (length 1/N), O2 flux from water to blood:
//   J_i = (D/N) * (Pw_i - Pb_i)                [ml O2 s-1]; Pw_i, Pb_i = segment-mean PO2 (kPa)
// Water side (capacitance rate Gw = Vw * beta_w, ml O2 s-1 kPa-1):
//   Pw_out,i = Pw_in,i - J_i / Gw
// Blood side, linear mode (capacitance rate Gb = Q * beta_b):
//   Pb_out,i = Pb_in,i + J_i / Gb
// Blood side, haemoglobin mode (Hill curve from haemoglobin.js):
//   Cb_out,i = Cb_in,i + J_i / Q ;  Pb = C^-1(Cb)
// Dimensionless form (what the viewer uses): k = D / Gw (water-side transfer number), ratio = Gw / Gb.
// Co-current: one forward march. Counter-current: shooting - bisect on the blood outlet value at x=0 so that the
// marched blood value at x=1 equals the blood inlet. Each segment is solved implicitly (fixed point on its flux).
//
// Outputs:
//   extraction  = (Pw_in - Pw_out) / (Pw_in - Pb_in)  exchanger effectiveness: fraction of the maximum possible
//                                                     water-side PO2 drop
//   utilisation = (Pw_in - Pw_out) / Pw_in            fraction of inspired water O2 removed
// Analytic check (linear mode, standard exchanger theory; test.mjs compares):
//   counter: E = (1 - e^{-k(1-R)}) / (1 - R e^{-k(1-R)}),  R = ratio  (E = k/(1+k) when R = 1)
//   co:      E = (1 - e^{-k(1+R)}) / (1 + R)
// Note: "segment" values are a discretisation of one lamella. Lamellar dimensions (gills.json) set the geometry the
// viewer draws; the exchange itself depends only on k and ratio (or D, Gw, Q in physical mode).
import { content, pressureFromContent } from './haemoglobin.js';

export function solve(params = {}, counter = true) {
  const N = params.N ?? 50;
  const Pw_in = params.Pw_in, Pb_in = params.Pb_in;
  const phys = params.physical || null; // { D, Gw, Q, hb } -> Hill-curve blood; else linear with k, ratio
  const kseg = phys ? phys.D / phys.Gw / N : params.k / N;
  // blood state variable c: PO2 (linear mode) or O2 content (Hb mode)
  const toP = phys ? (c) => pressureFromContent(c, phys.hb) : (c) => c;
  const toC = phys ? (P) => content(P, phys.hb) : (P) => P;
  const dc = phys ? (J) => (J * phys.Gw) / phys.Q : (J) => J * params.ratio; // blood gain per water-PO2 drop J
  const sgn = counter ? -1 : 1; // blood change in +x direction
  const c_in = toC(Pb_in);
  // March x = 0 -> 1 from known water inlet and a blood value at x = 0, implicit per segment (fixed point on J).
  function march(c0) {
    const water = new Array(N), blood = new Array(N);
    let Pw = Pw_in, c = c0;
    for (let i = 0; i < N; i++) {
      let J = kseg * (Pw - toP(c)) / (1 + kseg / 2);
      for (let it = 0; it < 30; it++) {
        const cR = c + sgn * dc(J);
        const Jn = (kseg * (Pw - toP(0.5 * (c + cR)))) / (1 + kseg / 2);
        if (Math.abs(Jn - J) < 1e-13) { J = Jn; break; }
        J = Jn;
      }
      const cR = c + sgn * dc(J);
      water[i] = Pw - J / 2; blood[i] = toP(0.5 * (c + cR));
      Pw -= J; c = cR;
    }
    return { water, blood, waterOut: Pw, cEnd: c };
  }
  let r, cOut, iterations = 0;
  if (!counter) { r = march(c_in); cOut = r.cEnd; }
  else {
    // shoot on the blood outlet value at x = 0: it lies between c_in and equilibrium with inspired water
    let lo = c_in, hi = toC(Pw_in);
    for (; iterations < 80; iterations++) {
      const mid = 0.5 * (lo + hi);
      r = march(mid);
      if (r.cEnd > c_in) hi = mid; else lo = mid;
      if (hi - lo < 1e-12 * Math.max(1, Math.abs(hi))) break;
    }
    cOut = 0.5 * (lo + hi); r = march(cOut);
  }
  const Jtot = Pw_in - r.waterOut;
  const bloodOut = toP(cOut);
  return {
    mode: counter ? 'counter' : 'co',
    x: r.water.map((_, i) => (i + 0.5) / N),
    water: r.water, blood: r.blood, // segment-mean PO2 (kPa) at the same x; blood enters at x=1 (counter) or x=0 (co)
    waterOut: r.waterOut, bloodOut, bloodOutContent: phys ? cOut : null,
    extraction: Jtot / (Pw_in - Pb_in),
    utilisation: Jtot / Pw_in,
    uptake: phys ? Jtot * phys.Gw : Jtot, // ml O2/s (physical mode) or water-PO2 units (dimensionless mode)
    iterations, converged: true,
  };
}

export function analytic(k, R, counter = true) {
  if (!counter) return (1 - Math.exp(-k * (1 + R))) / (1 + R);
  if (Math.abs(R - 1) < 1e-9) return k / (1 + k);
  const e = Math.exp(-k * (1 - R));
  return (1 - e) / (1 - R * e);
}

// Find the transfer D (ml O2 s-1 kPa-1) for which the physical (Hb) counter-current solution gives a target
// arterial PO2. Used to tune D to a measured arterial PO2 (see gills.json "k").
export function tuneD(target_Pa, base, counter = true) {
  let lo = base.physical.Gw * 1e-3, hi = base.physical.Gw * 1e2; // k between 0.001 and 100
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    const r = solve({ ...base, physical: { ...base.physical, D: mid } }, counter);
    if (r.bloodOut < target_Pa) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}
