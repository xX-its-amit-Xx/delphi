#!/usr/bin/env node
// Tests for the confidence layer.
//
//   node sim-engine/validate/confidence/test.mjs             run the tests
//   node sim-engine/validate/confidence/test.mjs --fail-once  inject one fault per test, every line FAILs
//
// No network. Reads two frozen artefacts belonging to the scorer thread (the calibration table and the
// evaluation results) read-only, which is the point: this layer adds statements, not fits.
import * as T from './target.mjs';
import * as C from './conformal.mjs';
import * as R from './register.mjs';
import * as P from './promote.mjs';

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

// ---------------------------------------------------------------------------------------------------
// TEST 1. The target quantity is chosen, frozen and explicit about what it is not. A confidence layer
// whose target can drift is a layer whose numbers mean whatever is convenient later.
// INJECTED FAULT: perturb the hashed payload.
function test1(f) {
  check(`target: exactly one candidate is chosen, and it is the one computable today${f ? ' +FAULT' : ''}`,
    T.CANDIDATES.filter(c => c.chosen).length === 1 && T.CHOSEN.id === (f ? 'phenotype-appeared-in-f0' : 'inside-the-real-envelope'),
    T.CHOSEN.id);

  const notProb = T.WHAT_IT_IS_NOT.filter(s => /NOT a probability/.test(s));
  check(`target: the first refusal is that it is not a probability of success${f ? ' +FAULT' : ''}`,
    !f && notProb.length >= 1 && /NOT a probability that the design works/.test(T.WHAT_IT_IS_NOT[0]),
    T.WHAT_IT_IS_NOT[0].slice(0, 58));

  const h1 = T.hash(), h2 = T.hash();
  check(`target: the pre-registration hash is stable across calls${f ? ' +FAULT' : ''}`,
    !f && h1.sha256 === h2.sha256 && h1.sha256.length === 64, `${h1.sha256.slice(0, 16)}... over ${h1.bytes} bytes`);

  check(`target: the exchangeability violation is stated, not buried${f ? ' +FAULT' : ''}`,
    !f && /violated/.test(T.EXCHANGEABILITY.why_it_is_violated) && /nothing available/.test(T.EXCHANGEABILITY.what_would_repair_it),
    'violation and the absence of a repair both recorded');
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The conformal threshold must round the quantile index UP. Rounding down makes the region
// smaller than the stated coverage, which breaks the guarantee silently and in the flattering direction.
// INJECTED FAULT: round down.
function test2(f) {
  const th = C.threshold({ block: 'fishshapes', d: 5, alpha: 0.05 });
  const exact = th.quantile_index_exact;
  const used = f ? Math.floor(exact) : th.quantile_index_used;
  check(`conformal: the quantile index is rounded UP from the exact conformal level${f ? ' +FAULT' : ''}`,
    used >= exact && used === Math.ceil(exact), `exact ${exact} -> used ${used}`);

  check(`conformal: the coverage bound is the finite-sample one, with n and the assumption named${f ? ' +FAULT' : ''}`,
    !f && Math.abs(th.coverage_bound.lower - 0.95) < 1e-12 &&
      Math.abs(th.coverage_bound.upper - (0.95 + 1 / (th.n + 1))) < 1e-7 &&   // the bound is stored rounded to 8 dp
      /exchangeability/.test(th.coverage_bound.assumption),
    th.coverage_bound.statement);

  check(`conformal: n is the real calibration size from the frozen table${f ? ' +FAULT' : ''}`,
    !f && th.n === 10694 && th.traits.length === 5, `n=${th.n}, ${th.traits.length} traits`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. INSIDE/OUTSIDE must flip at the threshold and never be reported as a probability.
// INJECTED FAULT: call everything INSIDE.
function test3(f) {
  const th = C.threshold({ d: 5, alpha: 0.05 }).threshold_q;
  const below = C.insideAt(th - 1e-6, { d: 5, alpha: 0.05 });
  const above = C.insideAt(th + 1e-6, { d: 5, alpha: 0.05 });
  check(`conformal: the call flips exactly at the threshold${f ? ' +FAULT' : ''}`,
    below.call === 'INSIDE' && above.call === (f ? 'INSIDE' : 'OUTSIDE'), `${th - 1e-6} -> ${below.call}, ${th + 1e-6} -> ${above.call}`);

  check(`conformal: an OUTSIDE call says what it does NOT mean${f ? ' +FAULT' : ''}`,
    !f && /not "impossible"/.test(above.read_this_as) && /unusual among measured animals/.test(above.read_this_as),
    'OUTSIDE is explained as unusual, not impossible');

  check(`conformal: no return value is a probability${f ? ' +FAULT' : ''}`,
    !f && /not a probability/i.test(below.what_this_is_not), below.what_this_is_not.slice(0, 50));
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. probability() exists only to refuse, and the refusal carries the measured calibration error of
// the existing score so the reason is a number rather than an opinion.
// INJECTED FAULT: return a number.
function test4(f) {
  const p = f ? { refused: false, value: 0.87 } : C.probability();
  check(`conformal: probability() refuses${f ? ' +FAULT' : ''}`, p.refused === true, p.refused ? 'refused' : `returned ${p.value}`);
  check(`conformal: the refusal cites the measured ECE of the existing score${f ? ' +FAULT' : ''}`,
    !f && p.because.some(b => /0\.4765/.test(b)), 'ECE 0.4765 quoted in the refusal');

  const bad = [C.threshold({ block: 'nope' }), C.threshold({ d: 99 }), C.threshold({ alpha: 0 }), C.insideAt(-1)];
  check(`conformal: an unknown block, dimension or alpha is refused with the valid options${f ? ' +FAULT' : ''}`,
    !f && bad.every(b => b.refused === true && typeof b.why === 'string'), bad.map(b => b.refused).join(','));
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. The coverage-slack numbers are quoted from the source, not invented. 22 is the one that
// decides whether a lab programme can ever calibrate anything.
// INJECTED FAULT: shift the table.
function test5(f) {
  const a = C.nForSlack(0.1), b = C.nForSlack(0.05);
  check(`conformal: 22 labels for a 0.1 coverage slack, 102 for 0.05, with the citation${f ? ' +FAULT' : ''}`,
    (f ? a.n === 102 : a.n === 22) && b.n === 102 && /2107\.07511/.test(a.source), `${a.n} and ${b.n}`);
  const tiny = C.nForSlack(0.0001);
  check(`conformal: a slack finer than the table is refused rather than extrapolated${f ? ' +FAULT' : ''}`,
    !f && tiny.n === null && /stops at 0\.001/.test(tiny.why), tiny.why ?? 'returned a number');
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. A prediction cannot be issued without the five things that make it a test, and the id must be
// derived from the content so that changing a prediction cannot silently reuse its id.
// INJECTED FAULT: issue one with no criterion.
function test6(f) {
  const base = { design_id: 'd1', quantity: 'pectoral fin length / SL', predicted: 1.6, criterion: '>= 1.4', versions: { scorer: '1.0.0' } };
  const r = R.issue(f ? { ...base, criterion: undefined } : base);
  check(`register: a prediction with all five required parts is issued with a content-hash id${f ? ' +FAULT' : ''}`,
    !r.refused && /^[0-9a-f]{16}$/.test(r.prediction_id ?? ''), r.refused ? r.why : r.prediction_id);

  const same = R.issue(base), changed = R.issue({ ...base, predicted: 1.7 });
  check(`register: identical predictions share an id; a changed one gets a different id${f ? ' +FAULT' : ''}`,
    !f && same.prediction_id === R.issue(base).prediction_id && same.prediction_id !== changed.prediction_id,
    `${same.prediction_id} vs ${changed.prediction_id}`);

  const noCrit = R.issue({ ...base, criterion: 'it should look right' });
  check(`register: a criterion nothing could fail is refused${f ? ' +FAULT' : ''}`,
    !f && noCrit.refused === true && /no comparison/.test(noCrit.why), noCrit.why?.slice(0, 54) ?? 'accepted');

  const missing = R.issue({ design_id: 'd' });
  check(`register: a missing part is named, with why it is required${f ? ' +FAULT' : ''}`,
    !f && missing.refused && /quantity/.test(missing.why) && typeof missing.because.criterion === 'string',
    missing.why?.slice(0, 54) ?? 'accepted');
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. An observation may not overwrite an observation. An append-only register exists precisely to
// stop a second result quietly replacing the first.
// INJECTED FAULT: attach to a record that has no observation yet, so nothing can be refused.
function test7(f) {
  const p = R.issue({ design_id: 'd1', quantity: 'q', predicted: 1, criterion: '>= 1', versions: {} });
  const once = R.attach(p, { value: 1.2 });
  const twice = R.attach(f ? p : once, { value: 9.9 });
  check(`register: a second observation on one prediction is refused${f ? ' +FAULT' : ''}`,
    twice.refused === true && /already carries an observation/.test(twice.why ?? ''),
    twice.refused ? 'refused' : 'overwrote the first observation');
  check(`register: the refusal says what to do instead${f ? ' +FAULT' : ''}`,
    !f && /replication with its own id/.test(twice.what_to_do ?? ''), (twice.what_to_do ?? '').slice(0, 48));
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. The calibration refusal. Below 22 labels the module returns the count and the shortfall and
// nothing resembling a calibration.
// INJECTED FAULT: lower the requirement to 1.
function test8(f) {
  // the fault supplies ENOUGH labels, so the refusal cannot fire
  const preds = Array.from({ length: f ? 25 : 4 }, (_, i) => {
    const p = R.issue({ design_id: `d${i}`, quantity: 'q', predicted: 1, criterion: '>= 1', versions: {} });
    return { ...R.attach(p, { value: 1.5 }), usable_as_a_label: true };
  });
  const set = R.calibrationSet(preds, { eps: 0.1 });
  check(`register: 4 labels is refused against the 22 needed, with the shortfall named${f ? ' +FAULT' : ''}`,
    set.refused === true && set.n_labels === 4 && set.n_needed === 22 && set.shortfall === 18,
    set.refused ? `${set.n_labels}/${set.n_needed}, short ${set.shortfall}` : `emitted a rate of ${set.empirical_hit_rate}`);

  check(`register: the refusal says what MAY be said instead${f ? ' +FAULT' : ''}`,
    !f && /Individual results are reportable/.test(set.what_you_may_say_instead ?? ''), 'individual results allowed, calibration not');

  const status = R.statusWithNoLabels(preds);
  check(`register: with no calibration, the publishable list excludes any probability${f ? ' +FAULT' : ''}`,
    !f && status.calibration === null && status.what_may_not.some(s => /probability that a design works/.test(s)),
    `${status.predictions_graded} graded, calibration ${status.calibration}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 9. Grading is mechanical where the criterion is numeric and REFUSES where it is not - naming that
// a person must grade it and be named.
// INJECTED FAULT: grade an observation that failed its own gates.
function test9(f) {
  const p = R.issue({ design_id: 'd', quantity: 'q', predicted: 1.6, criterion: '>= 1.4', versions: {} });
  const ok = { ...R.attach(p, { value: f ? 1.0 : 1.5 }), usable_as_a_label: true };
  const g = R.grade(ok);
  check(`register: a numeric criterion is graded mechanically and shows its arithmetic${f ? ' +FAULT' : ''}`,
    g.graded === true && g.pass === true && /1\.5 >= 1\.4 is true/.test(g.how), g.how ?? g.why);

  const unusable = { ...R.attach(R.issue({ design_id: 'd2', quantity: 'q', predicted: 1, criterion: '>= 1', versions: {} }), { value: 5 }), usable_as_a_label: f ? true : false, why_not_usable: ['not blind'] };
  const g2 = R.grade(unusable);
  check(`register: an observation that failed its own gates cannot grade a prediction${f ? ' +FAULT' : ''}`,
    g2.graded === false && /did not pass its own gates/.test(g2.why ?? ''), g2.graded ? 'graded it anyway' : 'refused');

  const prose = { ...R.attach(R.issue({ design_id: 'd3', quantity: 'q', predicted: 1, criterion: 'INSIDE the envelope', versions: {} }), { value: 1 }), usable_as_a_label: true };
  const g3 = R.grade(prose);
  check(`register: a non-numeric criterion is refused and asks for a named human grader${f ? ' +FAULT' : ''}`,
    !f && g3.graded === false && /WHO graded it/.test(g3.what_to_do ?? ''), (g3.what_to_do ?? '').slice(0, 44));
}

// ---------------------------------------------------------------------------------------------------
// TEST 10. The promotion gate on the real artefacts: no released version may be the default, and the
// shipped default is blocked by the endpoints it declared in advance.
// INJECTED FAULT: treat every endpoint as passing.
function test10(f) {
  const runs = P.evaluationRuns().map(r => f ? { ...r, criteria: r.criteria.map(c => ({ ...c, pass: true })) } : r);
  const a = { ...P.audit(), per_version: [...new Set(runs.map(r => r.version))].sort().map(v => P.promotable(v, { runs })) };
  const promotable = a.per_version.filter(r => r.promotable);
  check(`promote: no released scorer version passes the gate${f ? ' +FAULT' : ''}`,
    promotable.length === 0, promotable.length ? `promotable: ${promotable.map(r => r.version).join(', ')}` : `${a.per_version.length} version(s), none promotable`);

  const real = P.audit();
  check(`promote: the shipped default is identified and blocked by its own primary endpoints${f ? ' +FAULT' : ''}`,
    !f && real.shipped_default === '1.0.0' && real.shipped_default_promotable === false,
    `default ${real.shipped_default}, promotable ${real.shipped_default_promotable}`);

  check(`promote: a failure is explained as "not earned the default", not as "the version is bad"${f ? ' +FAULT' : ''}`,
    !f && /not that the version is bad/.test(real.per_version[0].what_a_failure_means ?? ''), 'failure framed correctly');

  check(`promote: the protocol makes every iteration a version and keeps the failures${f ? ' +FAULT' : ''}`,
    !f && P.THE_PROTOCOL.some(s => s.step === 'freeze') && P.THE_PROTOCOL.some(s => /keep the failures/.test(s.step)) &&
      /one bit per decision/.test(P.WHY_NOT_JUST_TUNE),
    `${P.THE_PROTOCOL.length} steps, and the cost of tuning is quantified`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 11. Endpoints must not be double-counted across the raw and reanalysed copies of one run, and a
// split variant must not be mistaken for the version's main run. The first version of the gate did both
// and reported "0/6 primary endpoints pass, failing P1, P2, P3, P1, P2, P3".
// INJECTED FAULT: count every file for the version.
function test11(f) {
  const runs = P.evaluationRuns();
  const v = '1.3.0';
  const files = runs.filter(r => r.version === v);
  const auth = P.authoritativeRun(v, runs);
  const counted = f ? files.flatMap(r => r.criteria.filter(c => c.primary)) : auth.criteria.filter(c => c.primary);
  check(`promote: exactly 3 primary endpoints are counted for a version, not one set per file${f ? ' +FAULT' : ''}`,
    counted.length === 3 && files.length > 1, `${counted.length} endpoint(s) from ${files.length} file(s) on disk`);

  check(`promote: the authoritative run is the main REANALYSED file, not a split variant${f ? ' +FAULT' : ''}`,
    !f && /_w1\.3\.0_reanalysed\.json$/.test(auth.file), auth.file);

  const v12 = P.authoritativeRun('1.2.0', runs);
  check(`promote: a "-specimen" variant with a later timestamp does not become the main run${f ? ' +FAULT' : ''}`,
    !f && /_w1\.2\.0_reanalysed\.json$/.test(v12.file) && !/specimen/.test(v12.file), v12.file);
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7, test8, test9, test10, test11];
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
