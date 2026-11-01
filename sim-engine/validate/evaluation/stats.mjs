// Independent statistics for the scorer evaluation. No scorer code is imported here.
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const r4 = x => (x == null || Number.isNaN(x) ? null : +(+x).toFixed(4));
export const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const sd = a => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
export const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

/** ROC-AUC = P(score_pos > score_neg) + 0.5 P(tie), via mid-ranks (O(n log n)). */
export function rocAuc(pos, neg) {
  if (!pos.length || !neg.length) return null;
  const all = [...pos.map(s => [s, 1]), ...neg.map(s => [s, 0])].sort((a, b) => a[0] - b[0]);
  let rankSumPos = 0;
  for (let i = 0; i < all.length;) {
    let j = i; while (j < all.length && all[j][0] === all[i][0]) j++;
    const mid = (i + j + 1) / 2; // 1-based mid-rank
    for (let k = i; k < j; k++) if (all[k][1]) rankSumPos += mid;
    i = j;
  }
  return (rankSumPos - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length);
}
/** PR-AUC as average precision, positives = class 1. Ties are processed as one block (no optimistic ordering). */
export function prAuc(pos, neg) {
  if (!pos.length) return null;
  const all = [...pos.map(s => [s, 1]), ...neg.map(s => [s, 0])].sort((a, b) => b[0] - a[0]);
  let tp = 0, fp = 0, ap = 0, prevRecall = 0;
  for (let i = 0; i < all.length;) {
    let j = i; while (j < all.length && all[j][0] === all[i][0]) j++;
    for (let k = i; k < j; k++) all[k][1] ? tp++ : fp++;
    const recall = tp / pos.length, precision = tp / (tp + fp);
    ap += (recall - prevRecall) * precision; prevRecall = recall; i = j;
  }
  return ap;
}
/** Stratified percentile bootstrap of a two-sample statistic. */
export function bootstrapCI(pos, neg, stat, { B = 1000, seed = 1, alpha = 0.05 } = {}) {
  if (!pos.length || !neg.length) return { lo: null, hi: null, B: 0 };
  const rnd = mulberry32(seed), vals = [];
  const draw = a => { const o = new Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[Math.floor(rnd() * a.length)]; return o; };
  for (let b = 0; b < B; b++) { const v = stat(draw(pos), draw(neg)); if (v != null) vals.push(v); }
  return { lo: r4(quantile(vals, alpha / 2)), hi: r4(quantile(vals, 1 - alpha / 2)), B };
}
/** Wilson 95 % interval for a proportion. */
export function wilson(k, n, z = 1.96) {
  if (!n) return { lo: null, hi: null };
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { lo: r4((c - h) / d), hi: r4((c + h) / d) };
}
export function histogram(xs, bins = 20, lo = 0, hi = 1) {
  const h = new Array(bins).fill(0);
  for (const x of xs) { if (x == null) continue; let i = Math.floor((x - lo) / (hi - lo) * bins); if (i >= bins) i = bins - 1; if (i < 0) i = 0; h[i]++; }
  return h;
}
export function summary(xs) {
  const a = xs.filter(x => x != null);
  return { n: a.length, mean: r4(mean(a)), min: r4(Math.min(...a)), q10: r4(quantile(a, 0.1)), q25: r4(quantile(a, 0.25)), median: r4(quantile(a, 0.5)), q75: r4(quantile(a, 0.75)), q90: r4(quantile(a, 0.9)), max: r4(Math.max(...a)) };
}
/** Reliability table treating the score as P(real). Base-rate dependent: the benchmark's class mix sets it. */
export function calibration(rows, edges = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001]) {
  const out = []; let ece = 0, brier = 0; const N = rows.length;
  for (const r of rows) brier += (r.score - r.y) ** 2;
  for (let i = 0; i < edges.length - 1; i++) {
    const b = rows.filter(r => r.score >= edges[i] && r.score < edges[i + 1]);
    if (!b.length) { out.push({ bin: [edges[i], Math.min(1, edges[i + 1])], n: 0 }); continue; }
    const mScore = mean(b.map(r => r.score)), frac = mean(b.map(r => r.y));
    ece += (b.length / N) * Math.abs(mScore - frac);
    out.push({ bin: [edges[i], Math.min(1, +edges[i + 1].toFixed(2))], n: b.length, mean_score: r4(mScore), fraction_real: r4(frac), ...wilson(b.filter(r => r.y).length, b.length) });
  }
  return { bins: out, ece: r4(ece), brier: r4(brier / N), n: N };
}

/** Cluster bootstrap (BENCHMARK-PREREGISTRATION section 1: resample families; base families for negatives; 1000
 *  resamples, seed 1). rows: [{s, y, c}] where c is the cluster key. */
export function clusterBootstrap(rows, stat, { B = 1000, seed = 1, alpha = 0.05 } = {}) {
  const groups = new Map(); for (const r of rows) { if (!groups.has(r.c)) groups.set(r.c, []); groups.get(r.c).push(r); }
  const keys = [...groups.keys()]; if (keys.length < 2) return { lo: null, hi: null, B: 0, clusters: keys.length };
  const rnd = mulberry32(seed), vals = [];
  for (let b = 0; b < B; b++) {
    const pos = [], neg = [];
    for (let i = 0; i < keys.length; i++) for (const r of groups.get(keys[Math.floor(rnd() * keys.length)])) (r.y ? pos : neg).push(r.s);
    const v = stat(pos, neg); if (v != null) vals.push(v);
  }
  return { lo: r4(quantile(vals, alpha / 2)), hi: r4(quantile(vals, 1 - alpha / 2)), B: vals.length, clusters: keys.length };
}
