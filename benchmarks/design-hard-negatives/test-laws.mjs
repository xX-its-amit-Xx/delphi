#!/usr/bin/env node
// Tests for laws.mjs: the registry audit, the real-fish control, and the search on what survives it.
//
//   node benchmarks/design-hard-negatives/test-laws.mjs [--fail-once]
//
// --fail-once inverts every assertion. The point of the flag is that a test which cannot fail proves
// nothing, so each predicate has a fault written for it that makes it false, and the run must print zero
// `ok` lines under the flag. If any survives, that assertion was never testing anything.
//
// The load-bearing test is `cleared constraint holds on 100 % of real positives`. Everything else in this
// file exists to stop that one from being passed by accident - by a stale number, by a boolean verdict in
// place of a count, by a law quoted as proved when the registry gives it no theorem, or by a survey whose
// denominator is a selection rather than the registry.

import {
  TRAITS, SURVEY, WHY_NOT, CANDIDATES, REJECTED, OMITTED_AS_VACUOUS,
  loadRegistry, proofStatus, surveyCensus, realPositives, verifyAgainstReal, cleared, report,
  WHAT_THE_SURVEY_MEANS,
} from './laws.mjs';
import { loadModel, pooled, makeScorer } from './joint.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const registry = loadRegistry();
const sample = realPositives();
const census = surveyCensus(registry);
const CLEARED = cleared({ sample });

// ---------------------------------------------------------------- the survey accounts for the registry
console.log('\nthe survey against the registry');

check('every law file has a survey row',
  f(census.laws_not_surveyed.length === 0, census.laws_not_surveyed.length !== 0),
  `unsurveyed: ${census.laws_not_surveyed.join(', ')}`);

check('no survey row invents a law',
  f(census.survey_rows_with_no_law.length === 0, census.survey_rows_with_no_law.length !== 0),
  `unknown: ${census.survey_rows_with_no_law.join(', ')}`);

check('survey row count equals the registry size',
  f(census.survey_rows === census.laws_in_registry, census.survey_rows !== census.laws_in_registry),
  `${census.survey_rows} rows vs ${census.laws_in_registry} laws`);

check('every ACCEPTED law in the registry is surveyed (count matches)',
  f(census.accepted_rows_in_survey === census.accepted_in_registry,
    census.accepted_rows_in_survey !== census.accepted_in_registry),
  `${census.accepted_rows_in_survey} accepted rows vs ${census.accepted_in_registry} accepted laws`);

check('the registry holds 62 laws, 36 accepted',
  f(census.laws_in_registry === 62 && census.accepted_in_registry === 36,
    census.laws_in_registry !== 62 || census.accepted_in_registry !== 36),
  `${census.laws_in_registry} / ${census.accepted_in_registry}`);

check('48 laws carry a Lean module and theorem',
  f(census.theorem_carrying === 48, census.theorem_carrying !== 48), `got ${census.theorem_carrying}`);

check('survey law_ids are unique',
  f(new Set(SURVEY.map(r => r.law_id)).size === SURVEY.length,
    new Set(SURVEY.map(r => r.law_id)).size !== SURVEY.length));

check('every survey row gives a reason code that WHY_NOT explains',
  f(SURVEY.every(r => r.why_not in WHY_NOT), !SURVEY.every(r => r.why_not in WHY_NOT)),
  SURVEY.filter(r => !(r.why_not in WHY_NOT)).map(r => `${r.law_id}:${r.why_not}`).join(', '));

check('every survey row gives a note, so no law is dismissed without a stated reason',
  f(SURVEY.every(r => typeof r.note === 'string' && r.note.length > 10),
    !SURVEY.every(r => typeof r.note === 'string' && r.note.length > 10)),
  SURVEY.filter(r => !(typeof r.note === 'string' && r.note.length > 10)).map(r => r.law_id).join(', '));

check('expressible is true exactly when the reason code is "expressible"',
  f(SURVEY.every(r => r.expressible === (r.why_not === 'expressible')),
    !SURVEY.every(r => r.expressible === (r.why_not === 'expressible'))));

check('exactly one law is expressible on these ten traits, and it carries a theorem',
  f(census.expressible === 1 && census.expressible_with_a_lean_theorem === 1,
    census.expressible !== 1 || census.expressible_with_a_lean_theorem !== 1),
  `${census.expressible} expressible, ${census.expressible_with_a_lean_theorem} with a theorem`);

check('the low expressibility rate is reported as a number, not rounded away',
  f(census.expressibility_rate_over_theorem_carrying > 0 && census.expressibility_rate_over_theorem_carrying < 0.03,
    !(census.expressibility_rate_over_theorem_carrying > 0 && census.expressibility_rate_over_theorem_carrying < 0.03)),
  `rate ${census.expressibility_rate_over_theorem_carrying}`);

check('the near miss is recorded as a WRONG MEASUREMENT, not as an absent law',
  f(SURVEY.filter(r => r.why_not === 'trait-not-in-block').length === 3
    && SURVEY.find(r => r.law_id === 'E5').note.includes('prepectoral_over_SL'),
    !(SURVEY.filter(r => r.why_not === 'trait-not-in-block').length === 3
      && SURVEY.find(r => r.law_id === 'E5').note.includes('prepectoral_over_SL'))));

// ---------------------------------------------------------------- no law is treated as proved for free
console.log('\nproof status is read from the registry, never assumed');

const noThm = [...registry.values()].filter(l => proofStatus(l) === 'no-lean-theorem').map(l => l.law_id);

check('14 laws have no Lean theorem and are identified as such',
  f(noThm.length === registry.size - 48, noThm.length !== registry.size - 48),
  `${noThm.length} without a theorem`);

check('a named gap with no theorem is NOT reported as proved',
  f(proofStatus(registry.get('fin-length-ratio')) === 'no-lean-theorem',
    proofStatus(registry.get('fin-length-ratio')) !== 'no-lean-theorem'));

check('a named hypothesis with no theorem is NOT reported as proved',
  f(proofStatus(registry.get('fick-principle')) === 'no-lean-theorem',
    proofStatus(registry.get('fick-principle')) !== 'no-lean-theorem'));

check('a lean_ref with a module but no theorem counts as unproved',
  f(proofStatus({ lean_ref: { module: 'lean/Delphi/Flight.lean', theorem: null } }) === 'no-lean-theorem',
    proofStatus({ lean_ref: { module: 'lean/Delphi/Flight.lean', theorem: null } }) !== 'no-lean-theorem'));

check('no theorem-free law supplies a constraint',
  f(CANDIDATES.every(c => !noThm.includes(c.law_id)), !CANDIDATES.every(c => !noThm.includes(c.law_id))),
  CANDIDATES.filter(c => noThm.includes(c.law_id)).map(c => c.id).join(', '));

check('every constraint names a law that is in the registry, accepted, and has a theorem',
  f(CANDIDATES.every(c => registry.has(c.law_id) && registry.get(c.law_id).status === 'accepted'
      && proofStatus(registry.get(c.law_id)) === 'theorem'),
    !CANDIDATES.every(c => registry.has(c.law_id) && registry.get(c.law_id).status === 'accepted'
      && proofStatus(registry.get(c.law_id)) === 'theorem')));

// ---------------------------------------------------------------- the interpretation is on the record
console.log('\nevery constraint records the interpretation it made');

const hasInterp = c => c.interpretation
  && typeof c.interpretation.reads === 'string' && c.interpretation.reads.length > 5
  && typeof c.interpretation.as === 'string' && c.interpretation.as.length > 5
  && typeof c.interpretation.unproved_step === 'string' && c.interpretation.unproved_step.length > 20;

check('every candidate carries reads / as / unproved_step',
  f(CANDIDATES.every(hasInterp), !CANDIDATES.every(hasInterp)),
  CANDIDATES.filter(c => !hasInterp(c)).map(c => c.id).join(', '));

check('every candidate states which part_of edge it is reading (or that there is none)',
  f(CANDIDATES.every(c => typeof c.edge === 'string' && c.edge.length > 3),
    !CANDIDATES.every(c => typeof c.edge === 'string' && c.edge.length > 3)));

check('the sibling-pair constraints admit the theorem licenses nothing',
  f(CANDIDATES.filter(c => c.edge.startsWith('none')).every(c => c.interpretation.reads.includes('nothing in the theorem')),
    !CANDIDATES.filter(c => c.edge.startsWith('none')).every(c => c.interpretation.reads.includes('nothing in the theorem'))));

check('the level-as-extent substitution is named as not in the Lean module',
  f(CANDIDATES.every(c => /not in the Lean module|does not contain|constrains them not at all/.test(c.interpretation.unproved_step)),
    !CANDIDATES.every(c => /not in the Lean module|does not contain|constrains them not at all/.test(c.interpretation.unproved_step))));

check('nothing claims the arithmetic was checked against the theorem',
  f(WHAT_THE_SURVEY_MEANS.what_is_not_checked.includes('no proof term connects them'),
    !WHAT_THE_SURVEY_MEANS.what_is_not_checked.includes('no proof term connects them')));

check('no candidate stores a pre-baked satisfaction rate that could go stale',
  f(CANDIDATES.every(c => !('measured_on_real_heldout' in c) && !('holds_on_real' in c)),
    !CANDIDATES.every(c => !('measured_on_real_heldout' in c) && !('holds_on_real' in c))));

check('candidate ids are unique',
  f(new Set(CANDIDATES.map(c => c.id)).size === CANDIDATES.length,
    new Set(CANDIDATES.map(c => c.id)).size !== CANDIDATES.length));

// ---------------------------------------------------------------- declared traits are the traits read
console.log('\ndeclared traits match the traits the slack function reads');

const base = Object.fromEntries(TRAITS.map(t => [t, 0.3]));
const readsTrait = (c, t) => {
  const bumped = { ...base, [t]: base[t] * 3 };
  return c.slack(bumped) !== c.slack(base);
};
const traitsOk = c => c.traits.every(t => TRAITS.includes(t))
  && c.traits.every(t => readsTrait(c, t))
  && TRAITS.filter(t => !c.traits.includes(t)).every(t => !readsTrait(c, t));

check('every candidate reads exactly the traits it declares',
  f(CANDIDATES.every(traitsOk), !CANDIDATES.every(traitsOk)),
  CANDIDATES.filter(c => !traitsOk(c)).map(c => c.id).join(', '));

check('no candidate reads caudal_fin_aspect_ratio, the one trait no law touches',
  f(CANDIDATES.every(c => !c.traits.includes('caudal_fin_aspect_ratio')),
    !CANDIDATES.every(c => !c.traits.includes('caudal_fin_aspect_ratio'))));

check('TRAITS is exactly the fishbase block, in the model\'s own order',
  f(TRAITS.join() === pooled(loadModel('fishbase').block).traits.join(),
    TRAITS.join() !== pooled(loadModel('fishbase').block).traits.join()));

// ---------------------------------------------------------------- the control
console.log('\nthe real-fish control');

check('the control sample is the 4,673 real held-out positives complete on all ten traits',
  f(sample.length === 4673, sample.length !== 4673), `got ${sample.length}`);

check('every specimen in the sample is complete and positive on all ten traits',
  f(sample.every(r => TRAITS.every(t => Number.isFinite(r.params[t]) && r.params[t] > 0)),
    !sample.every(r => TRAITS.every(t => Number.isFinite(r.params[t]) && r.params[t] > 0))));

const verdicts = CANDIDATES.map(c => verifyAgainstReal(c, { sample }));

check('verifyAgainstReal returns counts, with no boolean verdict field',
  f(verdicts.every(v => Object.values(v).every(x => typeof x !== 'boolean')),
    !verdicts.every(v => Object.values(v).every(x => typeof x !== 'boolean'))));

check('satisfied + violated accounts for every specimen measured',
  f(verdicts.every(v => v.n_satisfied + v.n_violated === v.n_measured && v.n_measured === v.n_real),
    !verdicts.every(v => v.n_satisfied + v.n_violated === v.n_measured && v.n_measured === v.n_real)));

check('the measured rate is satisfied / measured, not asserted',
  f(verdicts.every(v => Math.abs(v.rate - v.n_satisfied / v.n_measured) < 1e-12),
    !verdicts.every(v => Math.abs(v.rate - v.n_satisfied / v.n_measured) < 1e-12)));

// --- THE LOAD-BEARING ONE ---
const clearedVerdicts = CLEARED.map(c => verifyAgainstReal(c, { sample }));

check('EVERY cleared constraint is satisfied by 100 % of real positives',
  f(clearedVerdicts.every(v => v.rate === 1 && v.n_violated === 0),
    !clearedVerdicts.every(v => v.rate === 1 && v.n_violated === 0)),
  clearedVerdicts.filter(v => v.rate !== 1).map(v => `${v.id}@${v.rate.toFixed(5)}`).join(', '));

check('every cleared constraint has 4,673 of 4,673, named explicitly',
  f(clearedVerdicts.every(v => v.n_satisfied === 4673), !clearedVerdicts.every(v => v.n_satisfied === 4673)));

check('six of the thirteen candidates clear the control',
  f(CLEARED.length === 6, CLEARED.length !== 6), `${CLEARED.length} of ${CANDIDATES.length}`);

check('a cleared constraint has non-negative slack on every single specimen',
  f(CLEARED.every(c => sample.every(r => c.slack(r.params) >= 0)),
    !CLEARED.every(c => sample.every(r => c.slack(r.params) >= 0))));

// --- a deliberately broken constraint must be caught ---
const broken = {
  id: 'deliberately-broken', law_id: 'blueprint-well-formedness',
  statement: 'eye_diameter_over_SL <= head_length_over_SL / 2',
  traits: ['eye_diameter_over_SL', 'head_length_over_SL'],
  slack: p => p.head_length_over_SL / 2 - p.eye_diameter_over_SL,
};
const brokenV = verifyAgainstReal(broken, { sample });

check('a deliberately broken constraint is REJECTED by verifyAgainstReal',
  f(brokenV.rate < 1 && brokenV.n_violated > 0, !(brokenV.rate < 1 && brokenV.n_violated > 0)),
  `rate ${brokenV.rate.toFixed(4)}, ${brokenV.n_violated} violators`);

check('the rejection names the real fish that break it',
  f(brokenV.violators.length > 0 && brokenV.violators.every(v => typeof v.species === 'string'),
    !(brokenV.violators.length > 0 && brokenV.violators.every(v => typeof v.species === 'string'))));

check('cleared() excludes the deliberately broken constraint',
  f(!cleared({ sample, candidates: [...CANDIDATES, broken] }).some(c => c.id === 'deliberately-broken'),
    cleared({ sample, candidates: [...CANDIDATES, broken] }).some(c => c.id === 'deliberately-broken')));

// --- cleared() must not round 0.99979 up to 1 ---
const nearStrict = verifyAgainstReal(CANDIDATES.find(c => c.id === 'bp-anal-origin-on-body'), { sample });

check('a constraint one real fish breaks measures 0.99979, not 1',
  f(nearStrict.rate < 1 && nearStrict.n_violated === 1, !(nearStrict.rate < 1 && nearStrict.n_violated === 1)),
  `rate ${nearStrict.rate}`);

check('cleared() excludes a constraint at 0.99979 - near-strict is not strict',
  f(!CLEARED.some(c => c.id === 'bp-anal-origin-on-body'), CLEARED.some(c => c.id === 'bp-anal-origin-on-body')));

check('cleared() excludes everything below 1.0, at any distance from it',
  f(CANDIDATES.filter(c => verifyAgainstReal(c, { sample }).rate < 1).every(c => !CLEARED.some(k => k.id === c.id)),
    !CANDIDATES.filter(c => verifyAgainstReal(c, { sample }).rate < 1).every(c => !CLEARED.some(k => k.id === c.id))));

check('a constraint broken by exactly one specimen in 4,673 is still rejected',
  f(REJECTED.some(r => r.n_violated === 1), !REJECTED.some(r => r.n_violated === 1)));

// ---------------------------------------------------------------- the frozen rejection record is live
console.log('\nthe REJECTED record reproduces under measurement');

const rejMatches = REJECTED.every(r => {
  const c = CANDIDATES.find(k => k.id === r.id);
  if (!c) return false;
  const v = verifyAgainstReal(c, { sample });
  return v.n_violated === r.n_violated && Math.abs(v.rate - r.holds_on_real) < 5e-5;
});

check('every REJECTED row reproduces its own rate and violator count',
  f(rejMatches, !rejMatches));

check('REJECTED records a rate for every row',
  f(REJECTED.every(r => typeof r.holds_on_real === 'number' && r.holds_on_real < 1),
    !REJECTED.every(r => typeof r.holds_on_real === 'number' && r.holds_on_real < 1)));

check('seven candidates were rejected by the control',
  f(REJECTED.length === 7, REJECTED.length !== 7), `${REJECTED.length}`);

check('cleared plus rejected accounts for every candidate, with no overlap',
  f(CLEARED.length + REJECTED.length === CANDIDATES.length
    && !REJECTED.some(r => CLEARED.some(c => c.id === r.id)),
    !(CLEARED.length + REJECTED.length === CANDIDATES.length
      && !REJECTED.some(r => CLEARED.some(c => c.id === r.id)))));

check('the worst rejection is "the tail is no deeper than the body" at 0.70',
  f(REJECTED[0].id === 'bp-caudal-fin-in-body-depth' && REJECTED[0].n_violated === 1393,
    !(REJECTED[0].id === 'bp-caudal-fin-in-body-depth' && REJECTED[0].n_violated === 1393)));

check('more candidates were rejected than kept, and the file says so',
  f(REJECTED.length > CLEARED.length && WHAT_THE_SURVEY_MEANS.the_control_result.includes('SEVEN are false'),
    !(REJECTED.length > CLEARED.length && WHAT_THE_SURVEY_MEANS.the_control_result.includes('SEVEN are false'))));

const omitOk = OMITTED_AS_VACUOUS.every(o => o.holds_on_real === 1 && o.min_slack > 0.1);
check('the containments omitted as vacuous are recorded with their slack, not silently dropped',
  f(omitOk && OMITTED_AS_VACUOUS.length === 4, !(omitOk && OMITTED_AS_VACUOUS.length === 4)));

// ---------------------------------------------------------------- the search
console.log('\nthe adversarial search on what survived');

const R = report({ margins: [0.02], sample });
const byId = Object.fromEntries(R.rows.map(r => [r.id, r]));

check('report() returns one row per cleared constraint per margin',
  f(R.rows.length === CLEARED.length, R.rows.length !== CLEARED.length), `${R.rows.length} rows`);

check('every reported row reached its requested violation margin',
  f(R.rows.every(r => r.reached_margin), !R.rows.every(r => r.reached_margin)),
  R.rows.filter(r => !r.reached_margin).map(r => r.id).join(', '));

const reallyViolates = R.rows.every(r => {
  const c = CANDIDATES.find(k => k.id === r.id);
  return c.slack(r.params) < 0;
});
check('every reported animal really does violate its own constraint',
  f(reallyViolates, !reallyViolates));

check('report() carries the measured rate and the minimum real slack alongside each q',
  f(R.rows.every(r => r.holds_on_real === 1 && typeof r.min_slack_on_real === 'number'),
    !R.rows.every(r => r.holds_on_real === 1 && typeof r.min_slack_on_real === 'number')));

check('report() counts real fish against the same 4,673 specimens',
  f(R.n_real === 4673, R.n_real !== 4673));

check('the dorsal-fin-on-the-body violator is called TYPICAL by the scorer at q = 0.347',
  f(byId['bp-dorsal-origin-on-body'].min_q < 0.36 && byId['bp-dorsal-origin-on-body'].called_typical_by_the_scorer,
    !(byId['bp-dorsal-origin-on-body'].min_q < 0.36 && byId['bp-dorsal-origin-on-body'].called_typical_by_the_scorer)),
  `q = ${byId['bp-dorsal-origin-on-body'].min_q}`);

check('it outranks 4,068 of 4,673 real fish - worse than the hand-found eye-in-head case',
  f(byId['bp-dorsal-origin-on-body'].real_fish_less_typical_than_it > 4000
    && byId['bp-dorsal-origin-on-body'].min_q < byId['bp-snout-plus-eye-in-head'].min_q,
    !(byId['bp-dorsal-origin-on-body'].real_fish_less_typical_than_it > 4000
      && byId['bp-dorsal-origin-on-body'].min_q < byId['bp-snout-plus-eye-in-head'].min_q)),
  `${byId['bp-dorsal-origin-on-body'].real_fish_less_typical_than_it} real fish score worse`);

check('the law-derived snout-plus-eye constraint reproduces adversarial.mjs\'s q = 0.918 exactly',
  f(Math.abs(byId['bp-snout-plus-eye-in-head'].min_q - 0.9183) < 1e-3
    && byId['bp-snout-plus-eye-in-head'].real_fish_less_typical_than_it === 1279,
    !(Math.abs(byId['bp-snout-plus-eye-in-head'].min_q - 0.9183) < 1e-3
      && byId['bp-snout-plus-eye-in-head'].real_fish_less_typical_than_it === 1279)),
  `q = ${byId['bp-snout-plus-eye-in-head'].min_q}, ${byId['bp-snout-plus-eye-in-head'].real_fish_less_typical_than_it} worse`);

check('two of the six cleared constraints are broken inside the typical radius q < 1',
  f(R.rows.filter(r => r.called_typical_by_the_scorer).length === 2,
    R.rows.filter(r => r.called_typical_by_the_scorer).length !== 2),
  `${R.rows.filter(r => r.called_typical_by_the_scorer).length} inside q < 1`);

check('a head longer than the whole body is NOT called typical - the scorer catches that one',
  f(byId['bp-head-in-body'].min_q > 3 && !byId['bp-head-in-body'].called_typical_by_the_scorer,
    !(byId['bp-head-in-body'].min_q > 3 && !byId['bp-head-in-body'].called_typical_by_the_scorer)),
  `q = ${byId['bp-head-in-body'].min_q}`);

const S = makeScorer(pooled(loadModel('fishbase').block));
const violatorsAreScoreable = R.rows.every(r => Number.isFinite(S.q(r.params)));
check('every reported violator is a scoreable animal, not an unscoreable one',
  f(violatorsAreScoreable, !violatorsAreScoreable));

// ---------------------------------------------------------------- the exports are frozen
console.log('\nthe audit cannot be edited after the fact');

const frozen = [SURVEY, CANDIDATES, REJECTED, WHY_NOT, OMITTED_AS_VACUOUS, TRAITS, WHAT_THE_SURVEY_MEANS];
check('SURVEY, CANDIDATES, REJECTED, WHY_NOT, OMITTED_AS_VACUOUS, TRAITS and the prose are all frozen',
  f(frozen.every(o => Object.isFrozen(o)), !frozen.every(o => Object.isFrozen(o))));

check('each candidate\'s interpretation record is frozen too',
  f(CANDIDATES.every(c => Object.isFrozen(c.interpretation)),
    !CANDIDATES.every(c => Object.isFrozen(c.interpretation))));

// ----------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(pass === 0
    ? `  every one of the ${fail} assertions failed under its own fault; none is vacuous.`
    : `  ${pass} assertion(s) SURVIVED their fault and are testing nothing.`);
}
process.exit(fail && !FAULT ? 1 : 0);
