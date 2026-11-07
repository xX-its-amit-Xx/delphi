// Reconstruct the frozen joint model and score a trait vector the way it does.
//
// sim-engine/validate/data/joint-model.v1.3.0.json stores, per block and per family, the sufficient
// statistics of a multivariate Gaussian on log10 traits: n, the vector of sums, and the upper triangle of
// the matrix of sums of products. Summing those across families gives the pooled mean and covariance, so
// the scorer's own geometry can be reproduced here without importing its code.
//
// The model was built from benchmark/dev positives only - its own `source` field says "heldout/ never
// read" - so scoring heldout items against it is a genuine held-out evaluation.
//
// NOTHING here reimplements the scorer's calibration, verdicts or thresholds. It is the Mahalanobis
// geometry alone, which the project's own evaluation found IS the scorer: the joint term by itself
// reaches 0.8833 of the full score's discrimination, "one term wearing a costume".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MODEL_PATH = path.resolve(HERE, '../../sim-engine/validate/data/joint-model.v1.3.0.json');

/** Index into a packed upper triangle (i <= j) of a d x d matrix, row-major. */
export function triIndex(i, j, d) {
  if (i > j) [i, j] = [j, i];
  let off = 0;
  for (let k = 0; k < i; k++) off += d - k;
  return off + (j - i);
}

/**
 * Pool the per-family sufficient statistics of one block into a mean and covariance.
 *
 * excludeFamilies is exactly the subtraction the model was shaped to allow. Holding a family out matters
 * because a design's nearest real relatives are usually its own family, and leaving them in makes the
 * model look better than it is.
 */
export function pooled(block, excludeFamilies = []) {
  const d = block.traits.length;
  const drop = new Set(excludeFamilies);
  let N = 0, families = 0;
  const SUM = new Float64Array(d);
  const SXX = new Float64Array((d * (d + 1)) / 2);
  for (const [fam, f] of Object.entries(block.per_family)) {
    if (drop.has(fam)) continue;
    families++;
    N += f.n;
    for (let i = 0; i < d; i++) SUM[i] += f.sum[i];
    for (let k = 0; k < SXX.length; k++) SXX[k] += f.sxx[k];
  }
  if (N < d + 2) throw new Error(`pooled: only ${N} specimens for ${d} traits - covariance is not estimable`);
  const mu = Array.from(SUM, s => s / N);
  const cov = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      const c = (SXX[triIndex(i, j, d)] - N * mu[i] * mu[j]) / (N - 1);
      cov[i][j] = c; cov[j][i] = c;
    }
  }
  return { traits: block.traits.slice(), n: N, families, mu, cov, excluded: excludeFamilies.slice() };
}

/** Cholesky factor L with cov = L L'. Returns null if the matrix is not positive definite. */
export function cholesky(cov) {
  const d = cov.length;
  const L = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let s = cov[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0)) return null;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

/** Solve cov x = b from a Cholesky factor, so no explicit inverse is formed. */
export function cholSolve(L, b) {
  const d = L.length;
  const y = new Array(d).fill(0);
  for (let i = 0; i < d; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  const x = new Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < d; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/**
 * A scorer over one pooled block: q = D^2 / d, the Mahalanobis distance in log10 space normalised by
 * dimension. LOWER is more typical of real fish, so an AUC uses -q.
 *
 * Returns null, not a number, when a trait is missing or non-positive. A design with a missing trait is
 * not a typical fish and not an atypical one either; it is unscoreable, and the difference matters
 * because quietly substituting a mean makes an incomplete design look average.
 */
export function makeScorer(P) {
  const L = cholesky(P.cov);
  if (!L) throw new Error('the pooled covariance is not positive definite; the model cannot be reproduced');
  const d = P.traits.length;
  const q = params => {
    const x = new Array(d);
    for (let i = 0; i < d; i++) {
      const v = params[P.traits[i]];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null; // log10 needs positives
      x[i] = Math.log10(v) - P.mu[i];
    }
    const s = cholSolve(L, x);
    let D2 = 0;
    for (let i = 0; i < d; i++) D2 += x[i] * s[i];
    return D2 / d;
  };
  return { q, L, d, traits: P.traits, pooled: P };
}

export function loadModel(blockName = 'fishbase') {
  const m = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  const block = m.blocks[blockName];
  if (!block) throw new Error(`no block ${blockName}; have ${Object.keys(m.blocks).join(', ')}`);
  return { meta: { built: m.built, source: m.source, model: m.model, dev_sha256: m.dev_sha256 }, block };
}

/** Deterministic RNG. A benchmark whose numbers move between runs cannot be compared to itself. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller, drawing two at a time from one uniform stream. */
export function gaussians(rng) {
  let spare = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    while (u <= Number.EPSILON) u = rng();
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}
