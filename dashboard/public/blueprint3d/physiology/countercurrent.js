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
// The coupled profiles are solved by under-relaxed fixed-point iteration until the largest change < tol.
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
  const tol = params.tol ?? 1e-10, maxIter = params.maxIter ?? 20000, relax = params.relax ?? 0.5;
  const phys = params.physical || null; // { D, Gw, Q, hb } -> Hill-curve blood; else linear with k, ratio
  const kseg = phys ? phys.D / phys.Gw / N : params.k / N;
  const ratio = phys ? null : params.ratio;
  const blood = new Array(N).fill(Pb_in), water = new Array(N).fill(Pw_in);
  const waterEdge = new Array(N + 1);
  const J = new Array(N);
  const order = counter ? [...Array(N).keys()].reverse() : [...Array(N).keys()];
  let iter = 0, delta = Infinity;
  while (iter < maxIter && delta > tol) {
    iter++;
    // water march x = 0 -> 1, implicit in the water segment mean: Pw_out = Pw_in - kseg*((Pw_in+Pw_out)/2 - Pb)
    waterEdge[0] = Pw_in;
    for (let i = 0; i < N; i++) {
      const a = waterEdge[i];
      const out = (a - kseg * (a / 2 - blood[i])) / (1 + kseg / 2);
      waterEdge[i + 1] = out;
      J[i] = a - out; // flux in water-PO2 units (x Gw = ml O2/s)
    }
    // blood march in its own flow direction
    const newBlood = new Array(N);
    if (!phys) {
      let Pb = Pb_in;
      for (const i of order) { const outP = Pb + J[i] * ratio; newBlood[i] = 0.5 * (Pb + outP); Pb = outP; }
    } else {
      let C = content(Pb_in, phys.hb);
      for (const i of order) {
        const Cout = C + (J[i] * phys.Gw) / phys.Q;
        newBlood[i] = pressureFromContent(0.5 * (C + Cout), phys.hb);
        C = Cout;
      }
    }
    delta = 0;
    for (let i = 0; i < N; i++) {
      const nb = blood[i] + relax * (newBlood[i] - blood[i]);
      delta = Math.max(delta, Math.abs(nb - blood[i]));
      blood[i] = nb;
    }
  }
  for (let i = 0; i < N; i++) water[i] = 0.5 * (waterEdge[i] + waterEdge[i + 1]);
  const Jtot = waterEdge[0] - waterEdge[N];
  let bloodOut, bloodOutContent = null;
  if (!phys) bloodOut = Pb_in + Jtot * ratio;
  else {
    bloodOutContent = content(Pb_in, phys.hb) + (Jtot * phys.Gw) / phys.Q;
    bloodOut = pressureFromContent(bloodOutContent, phys.hb);
  }
  const waterOut = waterEdge[N];
  return {
    mode: counter ? 'counter' : 'co',
    x: water.map((_, i) => (i + 0.5) / N),
    water, blood, // segment-mean PO2 (kPa) at the same x positions; blood enters at x=1 (counter) or x=0 (co)
    waterOut, bloodOut, bloodOutContent,
    extraction: (Pw_in - waterOut) / (Pw_in - Pb_in),
    utilisation: (Pw_in - waterOut) / Pw_in,
    uptake: phys ? Jtot * phys.Gw : Jtot, // ml O2/s (physical mode) or water-PO2 units (dimensionless mode)
    iterations: iter,
    converged: delta <= tol,
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
  let lo = 1e-6, hi = 1e3;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    const r = solve({ ...base, physical: { ...base.physical, D: mid } }, counter);
    if (r.bloodOut < target_Pa) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}
