// The two statistics this benchmark needs, written out so they can be tested rather than trusted.
//
// Both are small enough that a dependency would cost more than it saves, and a correlation reported
// without a confidence interval is a number with no width - which, on 307 points, is how a rho of 0.08
// and a rho of 0.27 end up being discussed as though they were different in kind.

/** Average ranks, ties shared. A rank function that breaks ties arbitrarily inflates rho on data with
 *  repeated scores, and a heuristic that buckets its output produces a lot of ties. */
export function ranks(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(arr.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(a, b) {
  if (a.length !== b.length) throw new Error(`spearman needs equal lengths, got ${a.length} and ${b.length}`);
  if (a.length < 2) return NaN;
  const ra = ranks(a), rb = ranks(b), n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = ra[i] - ma, y = rb[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : NaN;
}

/** A DETERMINISTIC bootstrap: a seeded LCG rather than Math.random.
 *  A confidence interval that comes out different every run is not a confidence interval, and a reader
 *  who re-runs the benchmark and gets a different bound cannot tell that from a real change. */
export function bootstrapCI(a, b, { n = 2000, seed = 20261107, alpha = 0.05 } = {}) {
  let s = seed >>> 0;
  const rnd = () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let k = 0; k < n; k++) {
    const xa = new Array(a.length), xb = new Array(a.length);
    for (let i = 0; i < a.length; i++) { const j = Math.floor(rnd() * a.length); xa[i] = a[j]; xb[i] = b[j]; }
    const r = spearman(xa, xb);
    if (Number.isFinite(r)) out.push(r);
  }
  if (!out.length) return { lo: null, hi: null, n_resamples: 0, seed, why: 'every resample was degenerate' };
  out.sort((x, y) => x - y);
  return {
    lo: +out[Math.floor((alpha / 2) * out.length)].toFixed(4),
    hi: +out[Math.min(out.length - 1, Math.floor((1 - alpha / 2) * out.length))].toFixed(4),
    n_resamples: out.length, seed,
    deterministic: 'seeded LCG; the same inputs and seed always give the same interval',
  };
}

/** Does an interval exclude zero? The only question most of these rhos need answered. */
export function excludesZero(ci) {
  if (!ci || ci.lo == null) return null;
  return (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0);
}
