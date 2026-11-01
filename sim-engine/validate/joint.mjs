// The JOINT term for scorer v1.3.0: Mahalanobis distance of a design's log-trait vector under a multivariate
// Gaussian fitted on the benchmark's DEV positives, with the design's own family (and anything else the caller
// excludes) held out exactly.
//
// WHY. The benchmark's standard decoys take each trait from a different family, so every marginal stays realistic
// and only the correlations break. Per-trait envelopes are blind to that by construction: v1.2.0 scored AUC 0.50
// against FishBase decoys. A joint model is the smallest thing that can see it, and the Mahalanobis form says
// WHICH pair of traits is in an impossible combination, which an opaque density would not.
//
// WHAT IT IS NOT. A Gaussian on log traits is a crude model of fish shape: it has one mode and no allometric
// curvature, and the decoys it detects are detected because they break the LINEAR correlation structure. A real
// fish from an unusual family can also sit far out (reported: see the calibration's own tail).
import fs from 'node:fs';
import path from 'node:path';
// The two trait blocks, because the two large sources measure different traits. The builder imports these.
export const BLOCKS = {
  fishshapes: ['standard_length_m', 'body_mass_kg', 'body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac', 'peduncle_width_frac', 'head_depth_over_body_depth', 'lower_jaw_over_SL', 'mouth_width_over_SL'],
  fishbase: ['body_depth_over_SL', 'caudal_fin_aspect_ratio', 'caudal_fin_height_over_SL', 'eye_diameter_over_SL', 'head_length_over_SL', 'preanal_over_SL', 'predorsal_over_SL', 'preorbital_over_SL', 'prepectoral_over_SL', 'prepelvic_over_SL'],
};

const DIR = import.meta.dirname;
export const RIDGE = 1e-8;           // x mean(diag), for numerical safety only; stated in the preregistration
export const MIN_TRAITS = 3;         // fewer than 3 present traits: the joint term does not run
export const MIN_FIT_N = 200;        // fewer complete cases after exclusion: does not run

let _model = null, _cal = null;
export function loadJoint() {
  if (!_model) _model = JSON.parse(fs.readFileSync(path.join(DIR, 'data', 'joint-model.v1.3.0.json'), 'utf8'));
  return _model;
}
export function loadCalibration() {
  if (_cal === null) { const f = path.join(DIR, 'data', 'joint-calibration.v1.3.0.json'); _cal = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : false; }
  return _cal;
}

// ---------------------------------------------------------------- linear algebra (d <= 10)
export function inverse(A) {
  const d = A.length, M = A.map((r, i) => [...r, ...A.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < d; c++) {
    let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const pv = M[c][c]; for (let j = 0; j < 2 * d; j++) M[c][j] /= pv;
    for (let r = 0; r < d; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * d; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(r => r.slice(d));
}

/** Fit one block's mean and covariance from the per-family sufficient statistics, holding out families. */
export function fitBlock(blockName, { excludeFamilies = [] } = {}) {
  const B = loadJoint().blocks[blockName];
  const d = B.traits.length;
  const drop = new Set([...excludeFamilies].map(f => String(f).toLowerCase()));
  let n = 0; const sum = new Array(d).fill(0), sxx = new Array((d * (d + 1)) / 2).fill(0);
  const held = [];
  for (const [fam, F] of Object.entries(B.per_family)) {
    if (drop.has(fam.toLowerCase())) { held.push(fam); continue; }
    n += F.n;
    for (let i = 0; i < d; i++) sum[i] += F.sum[i];
    for (let k = 0; k < sxx.length; k++) sxx[k] += F.sxx[k];
  }
  if (n < MIN_FIT_N) return { ran: false, reason: `only ${n} complete cases remain after holding out ${held.length} family/families`, n, held_out_families: held };
  const mu = sum.map(s => s / n);
  const cov = Array.from({ length: d }, () => new Array(d).fill(0));
  let k = 0;
  for (let i = 0; i < d; i++) for (let j = i; j < d; j++) { const c = sxx[k++] / n - mu[i] * mu[j]; cov[i][j] = c; cov[j][i] = c; }
  const mdiag = cov.reduce((a, r, i) => a + r[i], 0) / d;
  for (let i = 0; i < d; i++) cov[i][i] += RIDGE * mdiag;
  return { ran: true, traits: B.traits, mu, cov, n, n_families: B.n_families - held.length, held_out_families: held };
}

/** Mahalanobis distance of the traits PRESENT, using the marginal sub-block of the fitted Gaussian. */
export function mahalanobis(fit, params) {
  if (!fit.ran) return { ran: false, reason: fit.reason };
  const idx = fit.traits.map((t, i) => [t, i]).filter(([t]) => typeof params[t] === 'number' && params[t] > 0).map(([, i]) => i);
  if (idx.length < MIN_TRAITS) return { ran: false, reason: `only ${idx.length} of the block's traits are present (need ${MIN_TRAITS})`, d: idx.length };
  const sub = idx.map(i => idx.map(j => fit.cov[i][j]));
  const om = inverse(sub);
  if (!om) return { ran: false, reason: 'the covariance sub-block is singular' };
  const z = idx.map(i => Math.log10(params[fit.traits[i]]) - fit.mu[i]);
  let D2 = 0;
  for (let a = 0; a < z.length; a++) for (let b = 0; b < z.length; b++) D2 += z[a] * om[a][b] * z[b];
  // Attribution: D2 = sum_a Om_aa z_a^2 + 2 sum_{a<b} Om_ab z_a z_b. A large POSITIVE off-diagonal term is a pair
  // of traits in a combination the fitted correlation says should not occur together.
  const pairs = [];
  for (let a = 0; a < z.length; a++) for (let b = a + 1; b < z.length; b++) {
    const term = 2 * z[a] * om[a][b] * z[b];
    const sd = (i, j) => fit.cov[i][j] / Math.sqrt(fit.cov[i][i] * fit.cov[j][j]);
    pairs.push({ traits: [fit.traits[idx[a]], fit.traits[idx[b]]], contribution_to_D2: +term.toFixed(4), correlation_in_real_fish: +sd(idx[a], idx[b]).toFixed(3),
      z_scores: [+(z[a] / Math.sqrt(fit.cov[idx[a]][idx[a]])).toFixed(3), +(z[b] / Math.sqrt(fit.cov[idx[b]][idx[b]])).toFixed(3)] });
  }
  pairs.sort((x, y) => y.contribution_to_D2 - x.contribution_to_D2);
  const singles = z.map((v, a) => ({ trait: fit.traits[idx[a]], z: +(v / Math.sqrt(fit.cov[idx[a]][idx[a]])).toFixed(3), contribution_to_D2: +(om[a][a] * v * v).toFixed(4) })).sort((x, y) => y.contribution_to_D2 - x.contribution_to_D2);
  return { ran: true, d: idx.length, traits_used: idx.map(i => fit.traits[i]), D2: +D2.toFixed(4), q: +(D2 / idx.length).toFixed(5), top_broken_pairs: pairs.slice(0, 3), top_traits: singles.slice(0, 3) };
}

// ---------------------------------------------------------------- calibration -> p-value
/** Empirical p-value of q = D^2/d from the stored quantile grid for (block, d); linear interpolation. */
export function pFromGrid(block, d, q) {
  const cal = loadCalibration();
  const g = cal && cal.blocks?.[block]?.[String(d)];
  if (!g) return { p: null, reason: 'no calibration for this block and dimension' };
  const Q = g.quantiles; // 101 values, q at probabilities 0, 0.01, ..., 1
  if (q <= Q[0]) return { p: 1, n: g.n };
  if (q >= Q[Q.length - 1]) return { p: 1 / (g.n + 1), n: g.n, beyond_calibration: true };
  let i = 0; while (i < Q.length - 1 && Q[i + 1] < q) i++;
  const frac = (q - Q[i]) / (Q[i + 1] - Q[i] || 1);
  const cdf = (i + frac) / (Q.length - 1);
  return { p: +Math.max(1 / (g.n + 1), 1 - cdf).toFixed(5), n: g.n };
}

/** The joint term for a design. Picks the block with the most present traits. */
export function jointTerm(params, { excludeFamilies = [] } = {}) {
  const counts = Object.entries(BLOCKS).map(([name, traits]) => [name, traits.filter(t => typeof params[t] === 'number' && params[t] > 0).length]);
  counts.sort((a, b) => b[1] - a[1]);
  const [name, present] = counts[0];
  if (present < MIN_TRAITS) return { ran: false, reason: `the design has ${present} trait(s) in the best-matching block (need ${MIN_TRAITS})`, block: name };
  const fit = fitBlock(name, { excludeFamilies });
  const m = mahalanobis(fit, params);
  if (!m.ran) return { ...m, block: name, fit_n: fit.n ?? null, held_out_families: fit.held_out_families ?? [] };
  const { p, n, beyond_calibration, reason } = pFromGrid(name, m.d, m.q);
  return { ran: true, block: name, ...m, p_value: p, calibration_n: n ?? null, beyond_calibration: !!beyond_calibration, calibration_missing: reason || undefined,
    fit: { n: fit.n, n_families: fit.n_families, held_out_families: fit.held_out_families },
    rule: 'Mahalanobis distance of the log10 trait vector under a Gaussian fitted on benchmark DEV positives with the stated families held out; p is the empirical tail probability among leave-own-family-out real specimens of the same dimension.' };
}
