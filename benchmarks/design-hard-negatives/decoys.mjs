// Decoy generators, ordered by HOW MUCH OF THE REAL CORRELATION STRUCTURE THEY KEEP.
//
// ============================== THE POINT ==============================
// The design scorer is, to 0.88 of its own discrimination, a Mahalanobis distance in log10 trait space.
// A Mahalanobis distance measures ONE thing: how unusual a vector is under a fitted Gaussian. So its
// measured accuracy is not a property of the scorer alone - it is a property of the scorer AND the decoy
// generator, and the published AUC is a statement about the negatives as much as about the model.
//
// The repository's heldout negatives are 12,152 shuffles out of 12,606. A shuffle keeps each trait's
// marginal distribution and destroys the correlation between traits, which is precisely and only what a
// Mahalanobis distance detects. Scoring well on them is close to tautological.
//
// So this file generates decoys along a LADDER of preserved structure, and the benchmark reports AUC as a
// function of where on that ladder the negatives sit. The expectation, stated before running:
//
//   corner / shuffle        correlation destroyed       -> high AUC
//   independent-marginal    correlation exactly zero    -> high AUC
//   gaussian-typical        correlation exactly right   -> AUC ~ 0.5 BY CONSTRUCTION
//   jitter-real             real fish, nudged           -> AUC ~ 0.5
//
// ============================== WHAT IS AND IS NOT A FINDING ==============================
// `gaussian-typical` reaching 0.5 is NOT a discovery. Samples from the fitted Gaussian have, by
// definition, the distribution the scorer tests for; a model cannot separate a sample from its own
// distribution. It is a CONSTRUCTION, and in the run it serves as a check that the reconstruction is
// faithful - if it came out far from 0.5, this harness would be wrong.
//
// The finding is the SIZE OF THE GAP. It puts a number on how much of the headline accuracy is carried
// by the decoy generator rather than by the model, and it bounds what this scorer can ever do: a
// statistically typical fish passes, whether or not it is a fish that can exist. The scorer is a
// PLAUSIBILITY model, not a VIABILITY model, and no amount of tuning changes that - only a different
// kind of evidence does.
//
// A real hard negative is a trait vector that is statistically typical and biologically impossible. The
// ladder's top rung approximates that from the statistical side. Producing one from the BIOLOGICAL side -
// a combination a developmental or mechanical law forbids while the covariance finds it ordinary - needs
// the law layer, and the registry has 48 theorems that could supply it. That is the next piece of work
// and it is named in the README rather than quietly skipped.

import { gaussians } from './joint.mjs';

export const LADDER = ['extreme-corner', 'shuffle-all', 'independent-marginal', 'gaussian-typical', 'jitter-real'];

export const PRESERVES = Object.freeze({
  'extreme-corner': 'nothing: each trait is drawn independently from an extreme percentile, so both the marginals and the correlation are wrong',
  'shuffle-all': 'the marginals exactly (each trait is a permutation of real values); the correlation is destroyed',
  'independent-marginal': 'the marginals, as fitted Gaussians; the correlation is exactly zero',
  'gaussian-typical': 'the marginals AND the full correlation structure, exactly, by sampling the fitted model',
  'jitter-real': 'everything local to a real specimen: a real held-out fish moved a short way along the covariance',
});

export const EXPECTATION = Object.freeze({
  'extreme-corner': 'high AUC',
  'shuffle-all': 'high AUC',
  'independent-marginal': 'high AUC',
  'gaussian-typical': 'AUC ~ 0.5 by construction - a check on the harness, not a result',
  'jitter-real': 'AUC ~ 0.5, and above it only in so far as real fish sit slightly off the Gaussian',
});

/** Sample each trait independently from its own fitted marginal. Correlation exactly zero. */
export function independentMarginal(P, rng, count) {
  const g = gaussians(rng);
  const sd = P.traits.map((_, i) => Math.sqrt(P.cov[i][i]));
  const out = [];
  for (let k = 0; k < count; k++) {
    const p = {};
    P.traits.forEach((t, i) => { p[t] = Math.pow(10, P.mu[i] + sd[i] * g()); });
    out.push(p);
  }
  return out;
}

/** Sample the fitted multivariate Gaussian: x = mu + L z. Marginals and correlation both exact. */
export function gaussianTypical(P, L, rng, count) {
  const g = gaussians(rng);
  const d = P.traits.length;
  const out = [];
  for (let k = 0; k < count; k++) {
    const z = Array.from({ length: d }, () => g());
    const p = {};
    for (let i = 0; i < d; i++) {
      let v = P.mu[i];
      for (let j = 0; j <= i; j++) v += L[i][j] * z[j];
      p[P.traits[i]] = Math.pow(10, v);
    }
    out.push(p);
  }
  return out;
}

/**
 * Take a real held-out specimen and move it a short way along the covariance. `scale` is in units of the
 * model's own standard deviations, so 0.25 means a quarter of a typical fish's spread - a change large
 * enough to be a different animal and small enough that the scorer should still call it typical.
 */
export function jitterReal(P, L, rng, reals, count, scale = 0.25) {
  const g = gaussians(rng);
  const d = P.traits.length;
  const out = [];
  for (let k = 0; k < count; k++) {
    const base = reals[Math.floor(rng() * reals.length)];
    const z = Array.from({ length: d }, () => g() * scale);
    const p = {};
    for (let i = 0; i < d; i++) {
      const b = base[P.traits[i]];
      if (!(typeof b === 'number' && b > 0)) { p[P.traits[i]] = b; continue; }
      let shift = 0;
      for (let j = 0; j <= i; j++) shift += L[i][j] * z[j];
      p[P.traits[i]] = Math.pow(10, Math.log10(b) + shift);
    }
    out.push(p);
  }
  return out;
}

/** Mann-Whitney AUC with averaged ranks for ties. Higher score = more positive-like. */
export function auc(posScores, negScores) {
  const pos = posScores.filter(Number.isFinite);
  const neg = negScores.filter(Number.isFinite);
  if (!pos.length || !neg.length) return null;
  const all = [...pos, ...neg];
  const order = all.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(all.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  let rs = 0;
  for (let k = 0; k < pos.length; k++) rs += r[k];
  return (rs - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}

/** Seeded bootstrap over both samples, so a reported interval is reproducible. */
export function aucCI(pos, neg, { n = 1000, seed = 20261107, alpha = 0.05, rngFactory } = {}) {
  const rng = rngFactory(seed);
  const vals = [];
  for (let b = 0; b < n; b++) {
    const p = Array.from({ length: pos.length }, () => pos[Math.floor(rng() * pos.length)]);
    const q = Array.from({ length: neg.length }, () => neg[Math.floor(rng() * neg.length)]);
    const a = auc(p, q);
    if (a !== null) vals.push(a);
  }
  if (vals.length < 20) return null;
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor((alpha / 2) * vals.length)];
  const hi = vals[Math.min(vals.length - 1, Math.floor((1 - alpha / 2) * vals.length))];
  return [lo, hi];
}
