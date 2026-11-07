#!/usr/bin/env node
// Tests for the on-target benchmark.
//
//   node benchmarks/crispr-ontarget/test.mjs [--fail-once]
//
// No network and no genome: the reimplementation is checked against a committed fixture of 25 published
// scores, and the statistics against cases whose answers are known in closed form. The benchmark run
// itself needs the genome and the uncommitted dataset; what is tested here is everything that decides
// whether its numbers mean anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CS from './crisprscan.mjs';
import * as S from './stats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures/published-scores.json');
const RESULTS = path.join(HERE, 'results.json');

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

const fixture = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : null;
const results = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : null;

// ---------------------------------------------------------------------------------------------------
// TEST 1. The reimplementation reproduces the authors' own published scores. This is the only test that
// can tell a transcription slip from a coordinate-system error, because either one breaks it.
// INJECTED FAULT: perturb one coefficient.
function test1(f) {
  if (!fixture) return check('crisprscan: reproduces the 25 published scores', false, 'fixture missing; run the generator in SOURCES.md');
  const rows = f ? fixture.rows.map((r, i) => (i === 0 ? { ...r, published_score: r.published_score + 0.05 } : r)) : fixture.rows;
  const st = CS.selfTest(rows);
  check(`crisprscan: reproduces all ${fixture.rows.length} published scores exactly${f ? ' +FAULT' : ''}`,
    st.ran && st.reproduces_published_scores && st.max_abs_difference < 5e-4,
    st.ran ? `n=${st.n}, max |difference| ${st.max_abs_difference}` : st.why);

  check(`crisprscan: the self-test says what it does NOT prove${f ? ' +FAULT' : ''}`,
    !f && /different claim from the model predicting activity/.test(CS.selfTest(fixture.rows).what_it_does_not_prove ?? ''),
    'reproducing arithmetic is distinguished from being right');
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The coefficient table, and the derived coordinate system that goes with it.
// INJECTED FAULT: assert a different layout.
function test2(f) {
  // the fault drops a coefficient, so the counts must move
  const keys = Object.keys(CS.COEFFICIENTS).filter((_, i) => !(f && i === 1));
  const mono = keys.filter(k => /^[ACGT]\d+$/.test(k)), di = keys.filter(k => /^[ACGT]{2}\d+$/.test(k));
  const pos = keys.filter(k => k !== 'Intercept').map(k => Number(k.match(/\d+$/)[0]));
  check(`crisprscan: 92 coefficients - 1 intercept, 57 single and 34 dinucleotide${f ? ' +FAULT' : ''}`,
    keys.length === 92 && 'Intercept' in CS.COEFFICIENTS && mono.length === 57 && di.length === 34,
    `${keys.length} total, ${mono.length} mono, ${di.length} di`);

  check(`crisprscan: every feature position lies in 1..35${f ? ' +FAULT' : ''}`,
    !f && Math.min(...pos) >= 1 && Math.max(...pos) <= 35, `positions ${Math.min(...pos)}..${Math.max(...pos)}`);

  const layout = f ? '5 nt upstream + 20 + 3 + 7' : CS.CONTEXT_SPEC.layout;
  check(`crisprscan: the layout is recorded as DERIVED, with how${f ? ' +FAULT' : ''}`,
    /6 nt upstream \+ 20 nt protospacer \+ 3 nt PAM/.test(layout) &&
      /reproduced all 25 exactly/.test(CS.CONTEXT_SPEC.how_this_was_established),
    layout);
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. The refusals. A misaligned window is the failure mode that would quietly produce plausible
// numbers for every guide, so the PAM check is the one that matters.
// INJECTED FAULT: feed a correctly-formed 35-mer where a broken one is expected.
function test3(f) {
  const good = 'ACGTAC' + 'GGGGAAGGTTGATTATGCAC' + 'AGG' + 'TTTTTT';
  const cases = [
    ['too short', good.slice(0, 30), /needs a 35-mer/],
    ['non-ACGT', good.slice(0, 10) + 'N' + good.slice(11), /not A, C, G or T/],
    ['PAM not NGG', good.slice(0, 26) + 'AAA' + good.slice(29), /must be an NGG PAM/],
  ];
  let bad = [];
  for (const [label, mer, re] of cases) {
    const r = CS.score(f ? good : mer);
    if (r.ran || !re.test(r.why ?? '')) bad.push(label);
  }
  check(`crisprscan: a short, ambiguous or non-NGG window is refused with the reason${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? `accepted: ${bad.join(', ')}` : `${cases.length} malformed windows refused`);

  const ok = CS.score(good);
  check(`crisprscan: a well-formed 35-mer scores and reports how many features matched${f ? ' +FAULT' : ''}`,
    !f && ok.ran && Number.isFinite(ok.score) && ok.features_matched > 0 && ok.pam === 'AGG',
    ok.ran ? `score ${ok.score}, ${ok.features_matched} features, PAM ${ok.pam}` : ok.why);
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. contextFrom must put the PAM at 27-29 whatever length was queried - that is what lets an
// 18-mer and a 22-mer oligo both be scored on the same 20-nt genomic protospacer.
// INJECTED FAULT: shift the window by one.
function test4(f) {
  const win = 'TTTTTTTTTT' + 'ACGTAC' + 'GGGGAAGGTTGATTATGCAC' + 'AGG' + 'TTTTTT' + 'AAAAAAAAAA';
  let bad = [];
  for (const qlen of [18, 19, 20, 21, 22]) {
    const spacer = ('ACGTAC' + 'GGGGAAGGTTGATTATGCAC').slice(-qlen);
    const at = win.indexOf(spacer);
    if (at < 0) { bad.push(`${qlen}: not found`); continue; }
    const mer = CS.contextFrom(win, f ? at + 1 : at, qlen);
    if (!mer) { bad.push(`${qlen}: no window`); continue; }
    if (mer.length !== 35 || mer.slice(26, 29) !== 'AGG') bad.push(`${qlen}: PAM "${mer.slice(26, 29)}"`);
  }
  check(`crisprscan: the PAM lands at 27-29 for query lengths 18..22${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? bad.join('; ') : '5 query lengths, all aligned');
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. Spearman, against cases with closed-form answers, including the tie case - a heuristic that
// buckets its output produces many ties, and a rank function that breaks them arbitrarily inflates rho.
// INJECTED FAULT: break tie handling.
function test5(f) {
  const brokenRanks = a => a.map((v, i) => a.filter(x => x < v).length + 1);
  const rank = f ? brokenRanks : S.ranks;
  const tied = rank([5, 5, 1, 1]);
  const expectTied = [3.5, 3.5, 1.5, 1.5];
  check(`stats: tied values get the average rank${f ? ' +FAULT' : ''}`,
    JSON.stringify(tied) === JSON.stringify(expectTied), JSON.stringify(tied));

  // the third value is the closed form 1 - 6*sum(d^2)/(n(n^2-1)) = 1 - 36/60 = 0.4, computed rather
  // than remembered: the first version of this test asserted 0.6 and the implementation was right.
  const cases = [[[1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 1], [[1, 2, 3, 4, 5], [5, 4, 3, 2, 1], -1], [[1, 2, 3, 4], [1, 4, 2, 3], 0.4]];
  const wrong = cases.filter(([a, b, want]) => Math.abs(S.spearman(a, b) - want) > 1e-9);
  check(`stats: spearman is exact on perfect, anti and partial correlation${f ? ' +FAULT' : ''}`,
    !f && wrong.length === 0, wrong.length ? `wrong on ${wrong.length}` : '3 closed-form cases');

  check(`stats: a constant vector gives NaN rather than a number${f ? ' +FAULT' : ''}`,
    !f && Number.isNaN(S.spearman([1, 2, 3], [7, 7, 7])), 'no correlation with a constant');
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. The bootstrap must be deterministic. An interval that moves on re-run cannot be distinguished
// from a real change by anyone reading two reports.
// INJECTED FAULT: change the seed between runs.
function test6(f) {
  const a = Array.from({ length: 60 }, (_, i) => Math.sin(i) * 10);
  const b = Array.from({ length: 60 }, (_, i) => Math.sin(i) * 10 + Math.cos(i * 3));
  const c1 = S.bootstrapCI(a, b);
  const c2 = S.bootstrapCI(a, b, f ? { seed: 999 } : {});
  check(`stats: the same inputs and seed give the identical interval${f ? ' +FAULT' : ''}`,
    c1.lo === c2.lo && c1.hi === c2.hi, `[${c1.lo}, ${c1.hi}] vs [${c2.lo}, ${c2.hi}]`);

  check(`stats: the interval brackets the point estimate${f ? ' +FAULT' : ''}`,
    !f && (() => { const r = S.spearman(a, b); return r >= c1.lo - 0.05 && r <= c1.hi + 0.05; })(),
    `rho ${S.spearman(a, b).toFixed(3)} in [${c1.lo}, ${c1.hi}]`);

  check(`stats: excludesZero is only true when both bounds share a sign${f ? ' +FAULT' : ''}`,
    !f && S.excludesZero({ lo: 0.1, hi: 0.3 }) === true && S.excludesZero({ lo: -0.1, hi: 0.3 }) === false &&
      S.excludesZero({ lo: -0.3, hi: -0.1 }) === true, 'all three sign cases');
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. The committed results must be internally consistent, and must not overstate what they show.
// INJECTED FAULT: shift a reported rho outside its own interval.
function test7(f) {
  if (!results) return check('results: committed and consistent', false, 'results.json missing; run the benchmark');
  const models = Object.entries(results.models).filter(([, m]) => m.rho != null && m.ci95);
  const inconsistent = models.filter(([, m]) => {
    const rho = f ? m.rho + 1 : m.rho;
    return rho < m.ci95.lo - 1e-9 || rho > m.ci95.hi + 1e-9;
  });
  check(`results: every reported rho lies inside its own 95 % interval${f ? ' +FAULT' : ''}`,
    inconsistent.length === 0,
    inconsistent.length ? inconsistent.map(([k]) => k).join(', ') : models.map(([k, m]) => `${k} ${m.rho}`).join('  '));

  check(`results: the two incumbent scores have intervals that include zero${f ? ' +FAULT' : ''}`,
    !f && S.excludesZero(results.models.doench2014.ci95) === false && S.excludesZero(results.models.heuristic.ci95) === false,
    `doench [${results.models.doench2014.ci95.lo}, ${results.models.doench2014.ci95.hi}], heuristic [${results.models.heuristic.ci95.lo}, ${results.models.heuristic.ci95.hi}]`);

  check(`results: the ground truth is cited and recorded as not committed${f ? ' +FAULT' : ''}`,
    !f && /10\.1038\/nmeth\.3543/.test(results.ground_truth.citation) && /not committed|copyrighted/.test(JSON.stringify(results.ground_truth)),
    'citation and redistribution note present');
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. The caveat that decides how the headline is read: CRISPRscan is being scored on data from the
// paper that fitted it, so its advantage here is an upper bound on its advantage anywhere else.
// INJECTED FAULT: remove the caveat.
function test8(f) {
  if (!results) return check('results: the in-sample caveat is stated', false, 'results.json missing');
  const text = f ? '' : JSON.stringify(results.caveats ?? {});
  const stated = /fitted on|same study|in-sample|home/i.test(text);
  check(`results: the in-sample advantage of CRISPRscan is stated, not buried${f ? ' +FAULT' : ''}`,
    stated, stated ? 'caveat present' : 'no caveat recorded in results.caveats');

  check(`results: the located fraction is reported, because the unlocated guides are a selection${f ? ' +FAULT' : ''}`,
    !f && Number.isFinite(results.locating?.not_found) && Number.isFinite(results.locating?.scored),
    results.locating ? `${results.locating.scored} scored of ${results.ground_truth.n_in_source}` : 'no locating block');
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7, test8];
for (const t of TESTS) await t(false);
console.log(`\n${pass} pass, ${fail} fail`);

if (FAIL_ONCE) {
  console.log('\n--fail-once: injecting one fault per test. EVERY line below should FAIL.\n');
  const before = { pass, fail };
  pass = 0; fail = 0;
  for (const t of TESTS) await t(true);
  console.log(`\nwith faults injected: ${fail} FAIL, ${pass} PASS`);
  console.log(`${pass} test(s) survived their own injected fault. Those assert nothing about their subject and are not tests.`);
  process.exit(before.fail === 0 && pass === 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
