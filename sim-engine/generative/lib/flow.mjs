// Pure-JS inference for the body-level generative models trained by generative/body/train.py.
// No Python or torch at runtime: the weights are base64 float32 in model/{fm,ddpm}.json, and this file implements the
// same MLP (layout must match train.py Net.forward) and the same ODE samplers:
//   fm   : rectified-flow velocity field, integrate noise (t=0) -> data (t=1), RK4
//   ddpm : VP-SDE epsilon model, integrate the probability-flow ODE from t=1 (noise) to t=1e-3 (data), RK4
// Pure ESM, no node-only imports (the browser engine could load it with fetch()ed weights).

function decodeF32(b64) {
  let bytes;
  if (typeof Buffer !== 'undefined') bytes = Buffer.from(b64, 'base64');
  else { const s = atob(b64); bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float64Array(bytes.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = dv.getFloat32(i * 4, true);
  return out;
}

export function loadModel(json) {
  const W = {};
  for (const [k, v] of Object.entries(json.weights)) W[k] = { shape: v.shape, data: decodeF32(v.f32_b64) };
  return { ...json, W, nfam: json.families.length };
}

// y = W x + b for one vector; W is [out, in] row-major (torch Linear layout)
function linear(L, B, x) {
  const [nout, nin] = L.shape; const y = new Float64Array(nout);
  for (let o = 0; o < nout; o++) { let s = B.data[o]; const r = o * nin; for (let i = 0; i < nin; i++) s += L.data[r + i] * x[i]; y[o] = s; }
  return y;
}
const silu = v => v.map(z => z / (1 + Math.exp(-z)));

/** The network output for one input. fam: integer index (nfam = NULL / "any teleost"). obs, mask: length-D arrays. */
export function netForward(M, x, t, fam, obs, mask) {
  const { D, EMB, NFREQ } = M.arch;
  const tf = [t];
  for (let k = 1; k <= NFREQ; k++) tf.push(Math.sin(2 * Math.PI * t * k));
  for (let k = 1; k <= NFREQ; k++) tf.push(Math.cos(2 * Math.PI * t * k));
  const emb = Array.from(M.W['emb.weight'].data.subarray(fam * EMB, fam * EMB + EMB));
  const om = obs.map((o, i) => o * mask[i]);
  const h0 = Float64Array.from([...x, ...tf, ...emb, ...om, ...mask]);
  if (h0.length !== M.W['l1.weight'].shape[1]) throw new Error(`input width ${h0.length} != ${M.W['l1.weight'].shape[1]} (D ${D})`);
  let h = silu(linear(M.W['l1.weight'], M.W['l1.bias'], h0));
  h = silu(linear(M.W['l2.weight'], M.W['l2.bias'], h));
  h = silu(linear(M.W['l3.weight'], M.W['l3.bias'], h));
  return linear(M.W['l4.weight'], M.W['l4.bias'], h);
}

const vpLogab = (t, vp) => -(vp.beta_min * t + 0.5 * (vp.beta_max - vp.beta_min) * t * t);
const vpBeta = (t, vp) => vp.beta_min + t * (vp.beta_max - vp.beta_min);

function drift(M, x, t, fam, obs, mask) {
  const out = netForward(M, x, t, fam, obs, mask);
  if (M.kind === 'fm') return out;
  const vp = M.arch.vp; const sig = Math.sqrt(1 - Math.exp(vpLogab(t, vp))); const b = vpBeta(t, vp);
  return x.map((xi, i) => -0.5 * b * (xi - out[i] / sig));
}

// mulberry32 + Box-Muller: seeded, reproducible noise
export function rng(seed) {
  let a = seed >>> 0;
  const u = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, normal: () => { let x = 0; while (x === 0) x = u(); return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * u()); } };
}

/** One sample in STANDARDISED feature space. */
export function sampleOne(M, { fam, obs, mask, steps = 48, noise }) {
  const D = M.arch.D;
  let x = Float64Array.from(noise);
  const ts = [];
  for (let i = 0; i <= steps; i++) ts.push(M.kind === 'fm' ? i / steps : 1 - (1 - M.arch.vp.t_min) * i / steps);
  const add = (a, b, s) => a.map((v, i) => v + s * b[i]);
  for (let i = 0; i < steps; i++) {
    const a = ts[i], h = ts[i + 1] - ts[i];
    const k1 = drift(M, x, a, fam, obs, mask);
    const k2 = drift(M, add(x, k1, h / 2), a + h / 2, fam, obs, mask);
    const k3 = drift(M, add(x, k2, h / 2), a + h / 2, fam, obs, mask);
    const k4 = drift(M, add(x, k3, h), a + h, fam, obs, mask);
    x = x.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  if (x.length !== D) throw new Error('dimension mismatch');
  return x;
}

export const standardise = (M, v) => v.map((x, i) => (x - M.mu[i]) / M.sd[i]);
export const unstandardise = (M, z) => Array.from(z, (x, i) => x * M.sd[i] + M.mu[i]);
