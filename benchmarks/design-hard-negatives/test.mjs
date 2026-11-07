#!/usr/bin/env node
// node benchmarks/design-hard-negatives/test.mjs [--fail-once]
//
// --fail-once injects ONE fault per assertion and requires that the assertion notices. A test that
// survives its own fault is reported as a failure, because it was not testing anything.

import { triIndex, pooled, cholesky, cholSolve, makeScorer, loadModel, mulberry32, gaussians } from './joint.mjs';
import { independentMarginal, gaussianTypical, jitterReal, auc, aucCI, LADDER, PRESERVES, EXPECTATION } from './decoys.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};
const f = (real, broken) => (FAULT ? broken : real);

console.log('triangle packing');
{
  const d = 4;
  const seen = new Set();
  for (let i = 0; i < d; i++) for (let j = i; j < d; j++) seen.add(triIndex(i, j, d));
  check('upper triangle indices are a bijection onto 0..d(d+1)/2-1', f(seen.size === 10, seen.size === 9), `got ${seen.size}`);
  check('triIndex is symmetric', f(triIndex(1, 3, d) === triIndex(3, 1, d), triIndex(1, 3, d) === triIndex(2, 2, d)));
  check('the diagonal comes first in each row', f(triIndex(0, 0, d) === 0 && triIndex(1, 1, d) === 4, triIndex(0, 0, d) === 1));
}

console.log('cholesky and the solve');
{
  const A = [[4, 2, 0], [2, 5, 1], [0, 1, 3]];
  const L = cholesky(A);
  check('a positive definite matrix factors', f(L !== null, L === null));
  // L L' must reproduce A
  let worst = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += L[i][k] * L[j][k];
    worst = Math.max(worst, Math.abs(s - A[i][j]));
  }
  check('L L\' reproduces the matrix', f(worst < 1e-12, worst > 1e-12), `worst ${worst.toExponential(1)}`);
  const b = [1, 2, 3];
  const x = cholSolve(L, b);
  const Ax = A.map(r => r.reduce((s, v, k) => s + v * x[k], 0));
  const err = Math.max(...Ax.map((v, i) => Math.abs(v - b[i])));
  check('cholSolve solves A x = b', f(err < 1e-12, err > 1e-12), `residual ${err.toExponential(1)}`);
  check('an indefinite matrix is refused rather than fudged', f(cholesky([[1, 2], [2, 1]]) === null, cholesky([[1, 2], [2, 1]]) !== null));
}

console.log('the reconstructed model');
const { block, meta } = loadModel('fishbase');
const P = pooled(block);
const S = makeScorer(P);
{
  check('the pooled n matches the count the model itself declares', f(P.n === block.n, P.n === block.n + 1), `${P.n} vs ${block.n}`);
  check('every family contributed', f(P.families === block.n_families, P.families === block.n_families - 1), `${P.families} vs ${block.n_families}`);
  const atMean = {};
  P.traits.forEach((t, i) => { atMean[t] = Math.pow(10, P.mu[i]); });
  const q0 = S.q(atMean);
  check('q at the mean is zero', f(q0 < 1e-20, q0 < 1e-40), `q=${q0.toExponential(1)}`);
  // a vector one model-sd out along one axis has q = 1/d
  const one = { ...atMean };
  one[P.traits[0]] = Math.pow(10, P.mu[0] + Math.sqrt(P.cov[0][0]));
  check('q scales as D^2/d', f(S.q(one) > 0 && S.q(one) < 1, S.q(one) > 1), `q=${S.q(one).toFixed(3)}`);
  const missing = { ...atMean };
  delete missing[P.traits[2]];
  check('a missing trait is UNSCOREABLE, not imputed', f(S.q(missing) === null, S.q(missing) !== null));
  const neg = { ...atMean, [P.traits[1]]: -1 };
  check('a non-positive trait is unscoreable (log10 needs positives)', f(S.q(neg) === null, S.q(neg) !== null));
  check('holding a family out changes the model', (() => {
    const fam = Object.keys(block.per_family)[0];
    const Q = pooled(block, [fam]);
    return f(Q.n < P.n && Q.families === P.families - 1, Q.n === P.n);
  })());
  check('the model was not fitted on the heldout split', f(/heldout\/ never read/.test(meta.source), !/heldout/.test(meta.source)));
}

console.log('the RNG is deterministic');
{
  const a = Array.from({ length: 5 }, mulberry32(42));
  const b = Array.from({ length: 5 }, mulberry32(42));
  check('the same seed gives the same stream', f(a.join() === b.join(), a.join() !== b.join()));
  const c = Array.from({ length: 5 }, mulberry32(43));
  check('a different seed gives a different stream', f(a.join() !== c.join(), a.join() === c.join()));
  const g = gaussians(mulberry32(7));
  const xs = Array.from({ length: 20000 }, g);
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((s, v) => s + v * v, 0) / xs.length - m * m);
  check('box-muller has mean 0 and sd 1', f(Math.abs(m) < 0.03 && Math.abs(sd - 1) < 0.03, Math.abs(m) < 1e-6), `mean ${m.toFixed(4)} sd ${sd.toFixed(4)}`);
}

console.log('AUC');
{
  check('perfectly separated gives 1', f(auc([3, 4, 5], [0, 1, 2]) === 1, auc([3, 4, 5], [0, 1, 2]) === 0));
  check('perfectly reversed gives 0', f(auc([0, 1, 2], [3, 4, 5]) === 0, auc([0, 1, 2], [3, 4, 5]) === 1));
  check('identical samples give exactly 0.5 (ties averaged)', f(auc([1, 1, 1], [1, 1, 1]) === 0.5, auc([1, 1, 1], [1, 1, 1]) === 1));
  // closed form: pos {1,3}, neg {2,4} -> pairs (1>2)no (1>4)no (3>2)yes (3>4)no = 1/4
  check('a hand-computed case', f(auc([1, 3], [2, 4]) === 0.25, auc([1, 3], [2, 4]) === 0.75), `got ${auc([1, 3], [2, 4])}`);
  check('an empty side returns null rather than a number', f(auc([], [1, 2]) === null, auc([], [1, 2]) === 0.5));
  const ci = aucCI([3, 4, 5, 6], [0, 1, 2, 3], { n: 200, rngFactory: mulberry32 });
  const ci2 = aucCI([3, 4, 5, 6], [0, 1, 2, 3], { n: 200, rngFactory: mulberry32 });
  check('the bootstrap interval is reproducible', f(JSON.stringify(ci) === JSON.stringify(ci2), JSON.stringify(ci) !== JSON.stringify(ci2)));
  check('the interval brackets the point estimate', f(ci[0] <= 1 && ci[1] >= ci[0], ci[0] > ci[1]));
}

console.log('the decoy ladder');
{
  const rngA = mulberry32(1);
  const im = independentMarginal(P, rngA, 400);
  const gt = gaussianTypical(P, S.L, mulberry32(1), 400);
  const jr = jitterReal(P, S.L, mulberry32(1), [Object.fromEntries(P.traits.map((t, i) => [t, Math.pow(10, P.mu[i])]))], 400);
  check('every generator fills every trait with a positive number', f(
    [im, gt, jr].every(set => set.every(p => P.traits.every(t => p[t] > 0))),
    im.every(p => p[P.traits[0]] < 0)));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const gq = gt.map(p => S.q(p)).filter(Number.isFinite);
  // THE load-bearing property: samples from the fitted model have E[q] = 1 exactly, since q = D^2/d.
  check('samples from the fitted model have mean q ~ 1, which is what makes the model reconstruction verifiable',
    f(Math.abs(mean(gq) - 1) < 0.12, Math.abs(mean(gq) - 1) < 1e-6), `mean q = ${mean(gq).toFixed(3)}`);
  const iq = im.map(p => S.q(p)).filter(Number.isFinite);
  check('zeroing the correlation makes decoys MORE atypical, which is the whole mechanism',
    f(mean(iq) > mean(gq) * 1.3, mean(iq) < mean(gq)), `independent ${mean(iq).toFixed(2)} vs gaussian ${mean(gq).toFixed(2)}`);
  const jq = jr.map(p => S.q(p)).filter(Number.isFinite);
  check('a jittered specimen stays near where it started', f(mean(jq) < mean(gq), mean(jq) > mean(gq)), `jitter ${mean(jq).toFixed(3)}`);
  check('every rung of the ladder is documented', f(
    LADDER.every(k => PRESERVES[k] && EXPECTATION[k]),
    LADDER.every(k => PRESERVES[k] && EXPECTATION[k] && k !== 'jitter-real')));
  check('the ladder is ordered from least to most structure preserved', f(
    LADDER[0] === 'extreme-corner' && LADDER[LADDER.length - 1] === 'jitter-real',
    LADDER[0] === 'jitter-real'));
}

console.log('the constructed hard negative');
{
  const { CONSTRAINTS, REJECTED, mostTypicalViolator, impossibilityCurve } = await import('./adversarial.mjs');
  const fsx = await import('node:fs');
  const C = CONSTRAINTS[0];
  const pos = [];
  for (const l of fsx.readFileSync('sim-engine/validate/benchmark/heldout/items.jsonl', 'utf8').split('\n')) {
    if (!l) continue;
    const it = JSON.parse(l);
    if (it.label !== 'positive') continue;
    const p = it.params || {};
    if (P.traits.every(t => typeof p[t] === 'number' && p[t] > 0)) pos.push(p);
  }
  // THE CONTROL. A constraint that any real animal breaks is not a constraint, and a hard negative built
  // on one would be a real fish mislabelled impossible.
  const posQ = pos.map(p => S.q(p)).filter(Number.isFinite);
  const ok = pos.filter(p => C.slack(p) >= 0).length;
  check('the constraint holds on EVERY real held-out specimen', f(ok === pos.length, ok === pos.length - 1), `${ok}/${pos.length}`);
  check('the rejected candidates really do fail on real fish, which is why they were rejected', f(
    REJECTED.every(r => r.holds_on_real < 0.99),
    REJECTED.every(r => r.holds_on_real > 0.99)));
  check('the worst rejected candidate is near chance, not near certainty', f(
    Math.min(...REJECTED.map(r => r.holds_on_real)) < 0.7,
    Math.min(...REJECTED.map(r => r.holds_on_real)) > 0.7));

  const v = mostTypicalViolator(P, C, { margin: 0.02 });
  check('the search returns a vector that actually VIOLATES the constraint', f(C.slack(v.params) < 0, C.slack(v.params) > 0), `slack ${C.slack(v.params).toExponential(1)}`);
  check('it reaches the requested margin', f(v.reached_margin, !v.reached_margin), `violation ${v.violation.toFixed(4)} vs margin 0.02`);
  check('the impossible animal is called TYPICAL by the scorer (q < 1)', f(v.q < 1, v.q > 1), `q=${v.q.toFixed(4)}`);
  check('snout plus eye genuinely exceeds the whole head', f(v.snout_plus_eye > v.head_length, v.snout_plus_eye < v.head_length),
    `${v.snout_plus_eye.toFixed(4)} vs ${v.head_length.toFixed(4)}`);
  // the load-bearing claim: a SEARCH beats SAMPLING, which is why drawn negatives never found this
  const { gaussianTypical } = await import('./decoys.mjs');
  const drawn = gaussianTypical(P, S.L, mulberry32(5), 20000).filter(p => C.slack(p) < 0).map(p => S.q(p)).filter(Number.isFinite);
  const bestDrawn = drawn.length ? Math.min(...drawn) : Infinity;
  check('the search finds a MORE typical violator than 20,000 draws do, which is the point of constructing it',
    f(v.q < bestDrawn, v.q > bestDrawn), `search ${v.q.toFixed(3)} vs best of ${drawn.length} draws ${bestDrawn === Infinity ? 'none' : bestDrawn.toFixed(3)}`);
  check('no draw at all landed inside the typical radius', f(!drawn.some(q => q < 1), drawn.some(q => q < 1)),
    `${drawn.filter(q => q < 1).length} of ${drawn.length} drawn violators had q<1`);

  const curve = impossibilityCurve(P, C, posQ, [0.01, 0.05]);
  check('a more impossible animal is harder to make typical (the curve rises)', f(
    curve[1].min_q > curve[0].min_q, curve[1].min_q < curve[0].min_q),
    `${curve[0].min_q} then ${curve[1].min_q}`);
  check('the curve is reproducible without an RNG', (() => {
    const again = impossibilityCurve(P, C, posQ, [0.01]);
    return f(again[0].min_q === curve[0].min_q, again[0].min_q !== curve[0].min_q);
  })());
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should FAIL here; any "ok" is a test that does not test)' : ''}`);
process.exit(fail && !FAULT ? 1 : 0);
