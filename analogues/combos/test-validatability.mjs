#!/usr/bin/env node
// Tests for analogues/combos/validatability.mjs - whether a design could be shown to be wrong.
//
//   node analogues/combos/test-validatability.mjs [--fail-once]
//
// Five things are checked harder than the rest, because they are the five ways this module could do
// damage if it were wrong:
//
//   1. tier() NOT BEING TOTAL. A design that falls through the rules would come back undefined and get
//      rendered as a blank cell in a table, which reads as "fine". So the full cartesian product of the
//      seven closed vocabularies is enumerated - every one of them - and each must land on a member of
//      TIER_IDS with a named rule. The module throws rather than returning undefined; the test proves
//      the throw never fires.
//   2. A DESIGN BUYING ITS WAY PAST A BLOCKING AXIS. The whole point of refusing to average is that six
//      good axes must not compensate for NO_COMMITMENT, for nothing that could fail, or for an
//      unenumerated confound set. Each of those three is swept across the ENTIRE product with every
//      other axis at its best value, and must still be refused.
//   3. prereg() WARNING INSTEAD OF THROWING on an empty refutation condition. A pre-registration with
//      no refutation condition is the ceremony of rigour round an unfalsifiable sentence, and it gets
//      cited later as though the ceremony were the thing. It must be an exception, not a field.
//   4. written_before_looking BEING DEFAULTED. If the module supplied true, every post-hoc record in the
//      repo would be laundered into a prediction at no cost. It must throw when the caller omits it, and
//      must label the record POST_HOC when the caller says false.
//   5. A FUSED SCORE APPEARING ANYWHERE. One float gets read downstream as a probability that the design
//      is right, which is not the subject of this module at all.
//
// --fail-once injects one fault into every assertion by inverting its predicate. Every line must then
// FAIL. An assertion that survives its own inversion is asserting nothing about its subject.
//
// No number in this file is attributed to any paper. The source values the module records were
// retrieved by it; the tests here check the SHAPE of that honesty - that a refused value is null with a
// reason - and not the biology.
import * as V from './validatability.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

// The full cartesian product of the seven closed vocabularies: the domain tier() must be total over.
const product = () => {
  let acc = [{}];
  for (const a of V.AXIS_IDS) {
    const next = [];
    for (const partial of acc) for (const val of V.VOCABULARY[a]) next.push({ ...partial, [a]: val });
    acc = next;
  }
  return acc;
};
const ALL = product();
const BEST = Object.freeze({
  QUANTITATIVE_PREDICTION: 'NUMBER_WITH_UNITS',
  EXISTING_ASSAY: 'PUBLISHED_ASSAY',
  RETRO_DECIDABLE: 'DECIDABLE_FROM_PUBLISHED_DATA',
  HOST_TRACTABLE: 'ROUTINE_IN_HOST',
  TIME_TO_READOUT: 'DAYS',
  CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_AND_SEPARABLE',
  NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_SPECIFIED',
});
const tierOf = a => V.tier(a).tier;

console.log(`\nvalidatability: not "is it a good idea" - "could we be shown to be wrong"${FAULT ? '   [--fail-once: every predicate inverted]' : ''}\n`);

// ====================================================================================================
// 1. THE AXES, CLOSED AND FROZEN
// ====================================================================================================
{
  check('AXES is frozen',
    f(Object.isFrozen(V.AXES) === true, Object.isFrozen(V.AXES) !== true));
  check('the exported constants are DEEP frozen, not frozen at the top level only',
    f(Object.isFrozen(V.AXES.QUANTITATIVE_PREDICTION.vocabulary) === true, Object.isFrozen(V.AXES.QUANTITATIVE_PREDICTION.vocabulary) !== true));
  check('seven axes, no more and no fewer',
    f(V.AXIS_IDS.length === 7, V.AXIS_IDS.length !== 7), V.AXIS_IDS.join(', '));
  const required = ['QUANTITATIVE_PREDICTION', 'EXISTING_ASSAY', 'RETRO_DECIDABLE', 'HOST_TRACTABLE', 'TIME_TO_READOUT', 'CONFOUND_SEVERITY', 'NEGATIVE_CONTROL_EXISTS'];
  check('all seven required axes are present by name',
    f(required.every(a => V.AXIS_IDS.includes(a)), !required.every(a => V.AXIS_IDS.includes(a))),
    required.filter(a => !V.AXIS_IDS.includes(a)).join(', '));
  const noQuestion = V.AXIS_IDS.filter(a => typeof V.AXES[a].question !== 'string' || !/\?/.test(V.AXES[a].question));
  check('every axis states the QUESTION it asks, as a question',
    f(noQuestion.length === 0, noQuestion.length !== 0), noQuestion.join(', '));
  const badVocab = V.AXIS_IDS.filter(a => !Array.isArray(V.AXES[a].vocabulary) || V.AXES[a].vocabulary.length < 3);
  check('every axis has its OWN closed vocabulary of at least three answers',
    f(badVocab.length === 0, badVocab.length !== 0), badVocab.join(', '));
  const undocumented = V.AXIS_IDS.flatMap(a => V.AXES[a].vocabulary.filter(w => typeof V.AXES[a].answers[w] !== 'string').map(w => `${a}:${w}`));
  check('every answer in every vocabulary says what it MEANS, so the word is not the whole content',
    f(undocumented.length === 0, undocumented.length !== 0), undocumented.join(', '));
  check('the prediction axis\'s vocabulary is exactly the three stated answers',
    f(V.VOCABULARY.QUANTITATIVE_PREDICTION.join('|') === 'NUMBER_WITH_UNITS|DIRECTION_ONLY|NO_COMMITMENT',
      V.VOCABULARY.QUANTITATIVE_PREDICTION.join('|') !== 'NUMBER_WITH_UNITS|DIRECTION_ONLY|NO_COMMITMENT'), V.VOCABULARY.QUANTITATIVE_PREDICTION.join('|'));
  check('the assay axis\'s vocabulary is exactly the three stated answers',
    f(V.VOCABULARY.EXISTING_ASSAY.join('|') === 'PUBLISHED_ASSAY|ASSAY_NEEDS_ADAPTING|NO_KNOWN_ASSAY',
      V.VOCABULARY.EXISTING_ASSAY.join('|') !== 'PUBLISHED_ASSAY|ASSAY_NEEDS_ADAPTING|NO_KNOWN_ASSAY'), V.VOCABULARY.EXISTING_ASSAY.join('|'));
  check('the retro axis\'s vocabulary is exactly the three stated answers',
    f(V.VOCABULARY.RETRO_DECIDABLE.join('|') === 'DECIDABLE_FROM_PUBLISHED_DATA|NEEDS_NEW_MEASUREMENT|UNDECIDABLE_EITHER_WAY',
      V.VOCABULARY.RETRO_DECIDABLE.join('|') !== 'DECIDABLE_FROM_PUBLISHED_DATA|NEEDS_NEW_MEASUREMENT|UNDECIDABLE_EITHER_WAY'), V.VOCABULARY.RETRO_DECIDABLE.join('|'));
  check('TIME_TO_READOUT is reported as the five stated BANDS, not as a date or a number of weeks',
    f(V.VOCABULARY.TIME_TO_READOUT.join('|') === 'DAYS|WEEKS|MONTHS|YEARS|GENERATIONS',
      V.VOCABULARY.TIME_TO_READOUT.join('|') !== 'DAYS|WEEKS|MONTHS|YEARS|GENERATIONS'), V.VOCABULARY.TIME_TO_READOUT.join('|'));
  check('the negative-control axis exists and its worst answer is total absence',
    f(V.VOCABULARY.NEGATIVE_CONTROL_EXISTS.includes('NO_NEGATIVE_CONTROL'), !V.VOCABULARY.NEGATIVE_CONTROL_EXISTS.includes('NO_NEGATIVE_CONTROL')));
  check('the negative-control axis names this repo\'s own hard-negative failure as its reason for existing',
    f(/0\.536|chance/.test(V.AXES.NEGATIVE_CONTROL_EXISTS.why_it_is_an_axis_and_not_a_footnote), !/0\.536|chance/.test(V.AXES.NEGATIVE_CONTROL_EXISTS.why_it_is_an_axis_and_not_a_footnote)));
  check('N_ANSWER_SETS equals the size of the product the test actually enumerated',
    f(V.N_ANSWER_SETS === ALL.length, V.N_ANSWER_SETS !== ALL.length), `${V.N_ANSWER_SETS} vs ${ALL.length}`);
  check('the product is big enough that the totality claim is not trivial',
    f(ALL.length >= 2000, !(ALL.length >= 2000)), `${ALL.length}`);
}

// ====================================================================================================
// 2. THE TIERS: EXACTLY FOUR, NAMED
// ====================================================================================================
{
  const expected = ['RETRO_VALIDATABLE_NOW', 'VALIDATABLE_IN_A_LAB', 'NOT_YET_DECIDABLE', 'REFUSED_BEFORE_VALIDATION'];
  check('exactly four tiers, and exactly the four stated ones',
    f(V.TIER_IDS.length === 4 && expected.every(t => V.TIER_IDS.includes(t)), !(V.TIER_IDS.length === 4 && expected.every(t => V.TIER_IDS.includes(t)))), V.TIER_IDS.join(', '));
  const noMeans = V.TIER_IDS.filter(t => typeof V.TIERS[t].means !== 'string' || V.TIERS[t].means.length < 40);
  check('every tier states what it means, with substance in it',
    f(noMeans.length === 0, noMeans.length !== 0), noMeans.join(', '));
  const noIsNot = V.TIER_IDS.filter(t => typeof V.TIERS[t].is_not !== 'string');
  check('every tier states what it is NOT, which is where a tier gets misread',
    f(noIsNot.length === 0, noIsNot.length !== 0), noIsNot.join(', '));
  check('the top tier explicitly denies being a statement that the design is right',
    f(/a statement that the design is right/i.test(V.TIERS.RETRO_VALIDATABLE_NOW.is_not), !/a statement that the design is right/i.test(V.TIERS.RETRO_VALIDATABLE_NOW.is_not)));
  check('the lab tier denies predicting success, and says most designs there will be refuted',
    f(/refuted/i.test(V.TIERS.VALIDATABLE_IN_A_LAB.is_not), !/refuted/i.test(V.TIERS.VALIDATABLE_IN_A_LAB.is_not)));
  check('the refused tier says plainly that it is not a judgement that the idea is bad',
    f(/best idea in the set|not a judgement that the biology is wrong/i.test(V.TIERS.REFUSED_BEFORE_VALIDATION.is_not),
      !/best idea in the set|not a judgement that the biology is wrong/i.test(V.TIERS.REFUSED_BEFORE_VALIDATION.is_not)));
  check('the refused tier says the fix is editorial rather than experimental',
    f(/editorial, not experimental/i.test(V.TIERS.REFUSED_BEFORE_VALIDATION.what_to_do), !/editorial, not experimental/i.test(V.TIERS.REFUSED_BEFORE_VALIDATION.what_to_do)));
}

// ====================================================================================================
// 3. TOTALITY - THE CENTRAL GUARD
// ====================================================================================================
// Every one of the answer sets in the product must land on exactly one tier from the closed set, named
// by a rule, with no throw. If the rules leave a hole the module throws, which is better than
// undefined, and this sweep is what finds the hole.
{
  const bad = [], threw = [], noRule = [];
  for (const a of ALL) {
    let v;
    try { v = V.tier(a); } catch (e) { threw.push(`${JSON.stringify(a)}: ${e.message}`); continue; }
    if (!V.TIER_IDS.includes(v.tier)) bad.push(JSON.stringify(a));
    if (!V.RULE_IDS.includes(v.rule)) noRule.push(JSON.stringify(a));
  }
  check(`tier() maps EVERY one of the ${ALL.length} answer sets to a tier in the closed set`,
    f(bad.length === 0, bad.length !== 0), `${bad.length} off-vocabulary: ${bad.slice(0, 2).join(' ')}`);
  check('tier() throws on NONE of them: the rule set is total, not merely usually total',
    f(threw.length === 0, threw.length !== 0), `${threw.length} threw: ${threw.slice(0, 1).join('')}`);
  check('every answer set is attributed to a rule from RULE_IDS, so no verdict is anonymous',
    f(noRule.length === 0, noRule.length !== 0), `${noRule.length}`);

  const reached = new Set(ALL.map(tierOf));
  check('all four tiers are actually reachable from the vocabularies, so none is decorative',
    f(reached.size === 4, reached.size !== 4), [...reached].join(', '));
  const unreachedRules = V.RULE_IDS.filter(id => !ALL.some(a => V.tier(a).rule === id));
  check('every rule WINS for at least one answer set: no rule is dead code shadowed by an earlier one',
    f(unreachedRules.length === 0, unreachedRules.length !== 0), unreachedRules.join(', '));
  const multi = ALL.filter(a => V.tier(a).all_matching_rules.length > 1);
  check('where several rules match, the verdict lists them all so the precedence is visible',
    f(multi.length > 0 && multi.every(a => V.tier(a).all_matching_rules[0] === V.tier(a).rule),
      !(multi.length > 0 && multi.every(a => V.tier(a).all_matching_rules[0] === V.tier(a).rule))), `${multi.length} overlapping sets`);
  const noBecause = V.RULE_IDS.filter(id => { const r = V.RULES.find(x => x.id === id); return typeof r.because !== 'string' || r.because.length < 40; });
  check('every rule carries its own one-line justification, in the export, not in a comment',
    f(noBecause.length === 0, noBecause.length !== 0), noBecause.join(', '));
  const noWhen = V.RULE_IDS.filter(id => typeof V.RULES.find(x => x.id === id).when !== 'string');
  check('every rule states its condition in words as well as in code',
    f(noWhen.length === 0, noWhen.length !== 0), noWhen.join(', '));
  check('the verdict carries the rule\'s justification with it, so a tier cannot be quoted without its reason',
    f(V.tier(BEST).because === V.RULES.find(r => r.id === V.tier(BEST).rule).because,
      V.tier(BEST).because !== V.RULES.find(r => r.id === V.tier(BEST).rule).because));
  check('RULES is frozen and its order is the precedence',
    f(Object.isFrozen(V.RULES) === true && V.RULE_IDS[0] === V.RULES[0].id, !(Object.isFrozen(V.RULES) === true && V.RULE_IDS[0] === V.RULES[0].id)));
}

// ====================================================================================================
// 4. A DESIGN CANNOT BUY ITS WAY PAST A BLOCKING AXIS
// ====================================================================================================
// The three refusals are swept across the WHOLE product, i.e. against every possible combination of
// the other six axes at their best. If any of them can be outvoted, the module is averaging in
// disguise and its headline claim is false.
{
  const noCommit = ALL.filter(a => a.QUANTITATIVE_PREDICTION === 'NO_COMMITMENT');
  const survivors1 = noCommit.filter(a => tierOf(a) !== 'REFUSED_BEFORE_VALIDATION');
  check('NO_COMMITMENT is refused in EVERY one of its answer sets, however good the other six axes are',
    f(survivors1.length === 0, survivors1.length !== 0), `${survivors1.length} of ${noCommit.length} escaped`);
  check('and specifically: perfect on all six other axes plus NO_COMMITMENT is still refused',
    f(tierOf({ ...BEST, QUANTITATIVE_PREDICTION: 'NO_COMMITMENT' }) === 'REFUSED_BEFORE_VALIDATION',
      tierOf({ ...BEST, QUANTITATIVE_PREDICTION: 'NO_COMMITMENT' }) !== 'REFUSED_BEFORE_VALIDATION'),
    tierOf({ ...BEST, QUANTITATIVE_PREDICTION: 'NO_COMMITMENT' }));

  const noNeg = ALL.filter(a => a.NEGATIVE_CONTROL_EXISTS === 'NO_NEGATIVE_CONTROL');
  const survivors2 = noNeg.filter(a => tierOf(a) !== 'REFUSED_BEFORE_VALIDATION');
  check('NO_NEGATIVE_CONTROL is refused in EVERY one of its answer sets: a test nothing could fail is not a test',
    f(survivors2.length === 0, survivors2.length !== 0), `${survivors2.length} of ${noNeg.length} escaped`);
  check('and specifically: a published dataset plus a published assay cannot outvote the missing negative control',
    f(tierOf({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL' }) === 'REFUSED_BEFORE_VALIDATION',
      tierOf({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL' }) !== 'REFUSED_BEFORE_VALIDATION'),
    tierOf({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL' }));

  const unenum = ALL.filter(a => a.CONFOUND_SEVERITY === 'CONFOUNDS_UNENUMERATED');
  const survivors3 = unenum.filter(a => tierOf(a) !== 'REFUSED_BEFORE_VALIDATION');
  check('CONFOUNDS_UNENUMERATED is refused in EVERY one of its answer sets: the result is uninterpretable before collection',
    f(survivors3.length === 0, survivors3.length !== 0), `${survivors3.length} of ${unenum.length} escaped`);
  check('and specifically: a tractable host and a day-long readout cannot outvote unenumerated confounds',
    f(tierOf({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_UNENUMERATED' }) === 'REFUSED_BEFORE_VALIDATION',
      tierOf({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_UNENUMERATED' }) !== 'REFUSED_BEFORE_VALIDATION'),
    tierOf({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_UNENUMERATED' }));

  // And the refusals must not be so broad that they swallow everything: the discriminator has to bite
  // in both directions or it is not a discriminator.
  check('the best answer set is NOT refused, so the refusals discriminate rather than obstruct',
    f(tierOf(BEST) === 'RETRO_VALIDATABLE_NOW', tierOf(BEST) !== 'RETRO_VALIDATABLE_NOW'), tierOf(BEST));
  const refusedFraction = ALL.filter(a => tierOf(a) === 'REFUSED_BEFORE_VALIDATION').length / ALL.length;
  check('refusal does not swallow the whole product: some answer sets reach every other tier',
    f(refusedFraction < 0.8, !(refusedFraction < 0.8)), `${(refusedFraction * 100).toFixed(1)}% refused`);
}

// ====================================================================================================
// 5. THE TIER LOGIC, ONE RULE AT A TIME
// ====================================================================================================
{
  check('published data plus separable confounds plus a stated number is RETRO_VALIDATABLE_NOW',
    f(tierOf(BEST) === 'RETRO_VALIDATABLE_NOW', tierOf(BEST) !== 'RETRO_VALIDATABLE_NOW'), tierOf(BEST));
  check('a direction-only prediction can still be retro-validatable: a sign can be contradicted by published data',
    f(tierOf({ ...BEST, QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY' }) === 'RETRO_VALIDATABLE_NOW',
      tierOf({ ...BEST, QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY' }) !== 'RETRO_VALIDATABLE_NOW'),
    tierOf({ ...BEST, QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY' }));
  check('but a direction-only verdict carries the caveat that a tiny right-sign result would pass',
    f(V.tier({ ...BEST, QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY' }).caveats.some(c => /right sign and negligible size/i.test(c)),
      !V.tier({ ...BEST, QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY' }).caveats.some(c => /right sign and negligible size/i.test(c))));
  check('published data that cannot separate a NAMED rival is NOT_YET_DECIDABLE, not retro-validatable',
    f(tierOf({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE' }) === 'NOT_YET_DECIDABLE',
      tierOf({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE' }) !== 'NOT_YET_DECIDABLE'),
    tierOf({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE' }));
  check('that verdict names the rival-separation rule rather than the retro rule',
    f(V.tier({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE' }).rule === 'R6-retro-data-cannot-separate-the-rival',
      V.tier({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE' }).rule !== 'R6-retro-data-cannot-separate-the-rival'),
    V.tier({ ...BEST, CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE' }).rule);

  const lab = { ...BEST, RETRO_DECIDABLE: 'NEEDS_NEW_MEASUREMENT', TIME_TO_READOUT: 'MONTHS' };
  check('a new measurement with an assay, a tractable host and separable confounds is VALIDATABLE_IN_A_LAB',
    f(tierOf(lab) === 'VALIDATABLE_IN_A_LAB', tierOf(lab) !== 'VALIDATABLE_IN_A_LAB'), tierOf(lab));
  check('the same design with NO assay drops to NOT_YET_DECIDABLE: a number with no instrument is a wish',
    f(tierOf({ ...lab, EXISTING_ASSAY: 'NO_KNOWN_ASSAY' }) === 'NOT_YET_DECIDABLE',
      tierOf({ ...lab, EXISTING_ASSAY: 'NO_KNOWN_ASSAY' }) !== 'NOT_YET_DECIDABLE'),
    tierOf({ ...lab, EXISTING_ASSAY: 'NO_KNOWN_ASSAY' }));
  check('the same design in an intractable host drops to NOT_YET_DECIDABLE',
    f(tierOf({ ...lab, HOST_TRACTABLE: 'NOT_TRACTABLE_IN_HOST' }) === 'NOT_YET_DECIDABLE',
      tierOf({ ...lab, HOST_TRACTABLE: 'NOT_TRACTABLE_IN_HOST' }) !== 'NOT_YET_DECIDABLE'),
    tierOf({ ...lab, HOST_TRACTABLE: 'NOT_TRACTABLE_IN_HOST' }));
  check('the same design whose readout crosses a GENERATION drops to NOT_YET_DECIDABLE',
    f(tierOf({ ...lab, TIME_TO_READOUT: 'GENERATIONS' }) === 'NOT_YET_DECIDABLE',
      tierOf({ ...lab, TIME_TO_READOUT: 'GENERATIONS' }) !== 'NOT_YET_DECIDABLE'),
    tierOf({ ...lab, TIME_TO_READOUT: 'GENERATIONS' }));
  check('an ADAPTABLE assay does NOT by itself drop the lab tier: it is a caveat, not a blocker',
    f(tierOf({ ...lab, EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING' }) === 'VALIDATABLE_IN_A_LAB',
      tierOf({ ...lab, EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING' }) !== 'VALIDATABLE_IN_A_LAB'),
    tierOf({ ...lab, EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING' }));
  check('but the adapted assay is recorded as a caveat, naming the risk of confusing assay failure with design failure',
    f(V.tier({ ...lab, EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING' }).caveats.some(c => /indistinguishable from the design's failure/i.test(c)),
      !V.tier({ ...lab, EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING' }).caveats.some(c => /indistinguishable from the design's failure/i.test(c))));

  const undec = { ...BEST, RETRO_DECIDABLE: 'UNDECIDABLE_EITHER_WAY' };
  check('UNDECIDABLE with an instrument that exists is NOT_YET_DECIDABLE: the claim\'s shape is the blocker',
    f(tierOf(undec) === 'NOT_YET_DECIDABLE', tierOf(undec) !== 'NOT_YET_DECIDABLE'), tierOf(undec));
  check('UNDECIDABLE with NO instrument at all is REFUSED: neither a present nor a future route to being wrong',
    f(tierOf({ ...undec, EXISTING_ASSAY: 'NO_KNOWN_ASSAY' }) === 'REFUSED_BEFORE_VALIDATION',
      tierOf({ ...undec, EXISTING_ASSAY: 'NO_KNOWN_ASSAY' }) !== 'REFUSED_BEFORE_VALIDATION'),
    tierOf({ ...undec, EXISTING_ASSAY: 'NO_KNOWN_ASSAY' }));
}

// ====================================================================================================
// 6. THE TWO AXES THAT DELIBERATELY DO NOT MOVE THE TIER STILL REPORT THEMSELVES
// ====================================================================================================
// An axis that never changes anything is decoration. An axis that changes the tier for a reason the
// module did not state is a hidden weighting. Both of these are checked, in both directions.
{
  const concDiff = ALL.filter(a => a.NEGATIVE_CONTROL_EXISTS === 'NEGATIVE_CONTROL_SPECIFIED')
    .filter(a => tierOf(a) !== tierOf({ ...a, NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_CONCEIVABLE' }));
  check('NEGATIVE_CONTROL_CONCEIVABLE never changes the tier anywhere in the product: it is a to-do, by stated rule',
    f(concDiff.length === 0, concDiff.length !== 0), `${concDiff.length} answer sets changed`);
  check('but it is always reported as a caveat, so it is not silently dropped',
    f(V.tier({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_CONCEIVABLE' }).caveats.some(c => /conceivable and not specified/i.test(c)),
      !V.tier({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_CONCEIVABLE' }).caveats.some(c => /conceivable and not specified/i.test(c))));
  check('and its total ABSENCE does change the tier, so the axis is not decoration',
    f(tierOf({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL' }) !== tierOf(BEST),
      tierOf({ ...BEST, NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL' }) === tierOf(BEST)));

  const shortBands = ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'];
  const timeDiff = ALL.filter(a => a.TIME_TO_READOUT === 'DAYS')
    .flatMap(a => shortBands.slice(1).filter(b => tierOf({ ...a, TIME_TO_READOUT: b }) !== tierOf(a)).map(b => `${b}`));
  check('DAYS, WEEKS, MONTHS and YEARS all give the same tier: waiting is budgeting, not epistemics',
    f(timeDiff.length === 0, timeDiff.length !== 0), `${timeDiff.length} differences`);
  check('YEARS is nonetheless recorded as a caveat rather than passed over in silence',
    f(V.tier({ ...BEST, TIME_TO_READOUT: 'YEARS' }).caveats.some(c => /nobody should call this design checked/i.test(c)),
      !V.tier({ ...BEST, TIME_TO_READOUT: 'YEARS' }).caveats.some(c => /nobody should call this design checked/i.test(c))));
  const genDiff = ALL.filter(a => tierOf({ ...a, TIME_TO_READOUT: 'MONTHS' }) !== tierOf({ ...a, TIME_TO_READOUT: 'GENERATIONS' }));
  check('GENERATIONS DOES change the tier somewhere: the one time distinction the module calls epistemic actually bites',
    f(genDiff.length > 0, !(genDiff.length > 0)), `${genDiff.length} answer sets`);
  check('and the generations caveat names inheritance, drift and selection entering the readout',
    f(/inheritance, drift and selection/i.test(V.tier({ ...BEST, TIME_TO_READOUT: 'GENERATIONS' }).caveats.join(' ')),
      !/inheritance, drift and selection/i.test(V.tier({ ...BEST, TIME_TO_READOUT: 'GENERATIONS' }).caveats.join(' '))));
}

// ====================================================================================================
// 7. tier() REFUSES AN INCOMPLETE OR INVENTED ANSWER
// ====================================================================================================
{
  const threw = fn => { try { fn(); return false; } catch { return true; } };
  const { QUANTITATIVE_PREDICTION, ...missingOne } = BEST;
  check('an answer set missing an axis THROWS rather than defaulting that axis to a pass',
    f(threw(() => V.tier(missingOne)) === true, threw(() => V.tier(missingOne)) !== true));
  check('the message says an unanswered axis is a refusal to say and may not be scored as a pass',
    f(/refusal to say/i.test((() => { try { V.tier(missingOne); return ''; } catch (e) { return e.message; } })()),
      !/refusal to say/i.test((() => { try { V.tier(missingOne); return ''; } catch (e) { return e.message; } })())));
  check('an answer outside the closed vocabulary THROWS instead of being treated as unknown-but-fine',
    f(threw(() => V.tier({ ...BEST, EXISTING_ASSAY: 'probably fine' })) === true, threw(() => V.tier({ ...BEST, EXISTING_ASSAY: 'probably fine' })) !== true));
  check('the message lists the allowed answers, so the caller is not left guessing',
    f(/allowed: PUBLISHED_ASSAY/.test((() => { try { V.tier({ ...BEST, EXISTING_ASSAY: 'probably fine' }); return ''; } catch (e) { return e.message; } })()),
      !/allowed: PUBLISHED_ASSAY/.test((() => { try { V.tier({ ...BEST, EXISTING_ASSAY: 'probably fine' }); return ''; } catch (e) { return e.message; } })())));
  check('no answer set at all THROWS',
    f(threw(() => V.tier(undefined)) === true, threw(() => V.tier(undefined)) !== true));
  check('an EXTRA key that is not an axis buys nothing and is reported as ignored',
    f(V.tier({ ...BEST, PLAUSIBILITY: 'very high' }).caveats.some(c => /not axes/i.test(c)) && V.tier({ ...BEST, PLAUSIBILITY: 'very high' }).tier === tierOf(BEST),
      !(V.tier({ ...BEST, PLAUSIBILITY: 'very high' }).caveats.some(c => /not axes/i.test(c)) && V.tier({ ...BEST, PLAUSIBILITY: 'very high' }).tier === tierOf(BEST))));
  check('the verdict is frozen, so a caller cannot staple a score onto it downstream',
    f(Object.isFrozen(V.tier(BEST)) === true, Object.isFrozen(V.tier(BEST)) !== true));
}

// ====================================================================================================
// 8. prereg() THROWS. IT DOES NOT WARN.
// ====================================================================================================
{
  const base = {
    id: 'synthetic-prereg-fixture',
    organism: 'synthetic host', function: 'synthetic function',
    written_before_looking: true,
    prediction: {
      statement: 'SYNTHETIC. Illustrative only; no experiment and no paper is being asserted.',
      number: { value: 2, units: 'illustrative units' },
      refuted_if: { measurement: 'an illustrative instrument reading an illustrative quantity', comparison: '<', threshold: 2, units: 'illustrative units' },
    },
  };
  const threwWith = (d, re) => { try { prereg_(d); return false; } catch (e) { return re.test(e.message); } };
  const prereg_ = d => V.prereg(d, BEST);
  const threw = d => { try { prereg_(d); return false; } catch { return true; } };

  check('a complete pre-registration is accepted and labelled PRE_REGISTRATION',
    f(prereg_(base).kind === 'PRE_REGISTRATION', prereg_(base).kind !== 'PRE_REGISTRATION'), prereg_(base).kind);
  check('a MISSING refutation condition THROWS',
    f(threw({ ...base, prediction: { ...base.prediction, refuted_if: null } }) === true, threw({ ...base, prediction: { ...base.prediction, refuted_if: null } }) !== true));
  check('an EMPTY-OBJECT refutation condition throws too: the hole is not only the null case',
    f(threw({ ...base, prediction: { ...base.prediction, refuted_if: {} } }) === true, threw({ ...base, prediction: { ...base.prediction, refuted_if: {} } }) !== true));
  check('the message says a pre-registration with nothing that would refute it is not a pre-registration',
    f(threwWith({ ...base, prediction: { ...base.prediction, refuted_if: null } }, /is not a pre-registration/i) === true,
      threwWith({ ...base, prediction: { ...base.prediction, refuted_if: null } }, /is not a pre-registration/i) !== true));
  check('a refutation condition with no MEASUREMENT throws: name the instrument or there is no refutation',
    f(threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, measurement: '' } } }) === true,
      threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, measurement: '' } } }) !== true));
  check('a refutation condition with no THRESHOLD throws rather than being recorded as open',
    f(threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, threshold: null } } }) === true,
      threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, threshold: null } } }) !== true));
  check('a threshold with no UNITS throws: a threshold without units is not a threshold',
    f(threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, units: '' } } }) === true,
      threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, units: '' } } }) !== true));
  check('a comparison outside the closed set throws, so "we would know it when we saw it" is unavailable',
    f(threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, comparison: 'much worse than expected' } } }) === true,
      threw({ ...base, prediction: { ...base.prediction, refuted_if: { ...base.prediction.refuted_if, comparison: 'much worse than expected' } } }) !== true));
  check('COMPARISONS is a closed, frozen set',
    f(Object.isFrozen(V.COMPARISONS) === true && V.COMPARISONS.length >= 5, !(Object.isFrozen(V.COMPARISONS) === true && V.COMPARISONS.length >= 5)), V.COMPARISONS.join(' '));

  // written_before_looking: the field a module must never default.
  const { written_before_looking, ...noFlag } = base;
  check('an OMITTED written_before_looking throws: defaulting it would launder every post-hoc record',
    f(threw(noFlag) === true, threw(noFlag) !== true));
  check('a non-boolean written_before_looking throws rather than being coerced',
    f(threw({ ...base, written_before_looking: 'yes' }) === true, threw({ ...base, written_before_looking: 'yes' }) !== true));
  check('the message says the module will not default it, and why',
    f(threwWith(noFlag, /will not default it/i) === true, threwWith(noFlag, /will not default it/i) !== true));
  const post = prereg_({ ...base, written_before_looking: false });
  check('written_before_looking false produces a POST_HOC_RECORD, not a pre-registration',
    f(post.kind === 'POST_HOC_RECORD', post.kind !== 'POST_HOC_RECORD'), post.kind);
  check('the post-hoc record says it may be reported as a consistency check and never as a prediction',
    f(/never as a prediction/i.test(post.honesty_note), !/never as a prediction/i.test(post.honesty_note)));
  check('the post-hoc record is KEPT rather than discarded, and says why hiding it would be worse',
    f(/hiding it would be worse/i.test(post.honesty_note), !/hiding it would be worse/i.test(post.honesty_note)));
  check('the pre-registration record admits the module cannot verify the flag',
    f(/cannot verify that/i.test(prereg_(base).honesty_note), !/cannot verify that/i.test(prereg_(base).honesty_note)));

  const r = prereg_(base);
  check('the record states the measurement that would refute it, as its own field',
    f(typeof r.measurement_that_would_refute_it === 'string' && r.measurement_that_would_refute_it.length > 20,
      !(typeof r.measurement_that_would_refute_it === 'string' && r.measurement_that_would_refute_it.length > 20)));
  check('the record renders the refutation condition as one readable sentence',
    f(/^refuted when /.test(r.refuted_if.read_as), !/^refuted when /.test(r.refuted_if.read_as)), r.refuted_if.read_as);
  check('the record carries the validatability tier with it, so a prereg cannot be read without it',
    f(r.validatability.tier === tierOf(BEST), r.validatability.tier !== tierOf(BEST)));
  check('a missing power calculation is recorded as an explicit null with a reason, not omitted',
    f(r.n_required.value === null && typeof r.n_required.null_reason === 'string',
      !(r.n_required.value === null && typeof r.n_required.null_reason === 'string')));
  check('the record denies being a result or a prediction of success',
    f(/not a result/i.test(r.what_this_record_is_not), !/not a result/i.test(r.what_this_record_is_not)));
  check('the record is frozen',
    f(Object.isFrozen(r) === true, Object.isFrozen(r) !== true));
  check('prereg also validates the answer set: a bad axis answer throws there too',
    f((() => { try { V.prereg(base, { ...BEST, HOST_TRACTABLE: 'quite easy' }); return false; } catch { return true; } })() === true,
      (() => { try { V.prereg(base, { ...BEST, HOST_TRACTABLE: 'quite easy' }); return false; } catch { return true; } })() !== true));
}

// ====================================================================================================
// 9. NO FUSED SCORE, ANYWHERE
// ====================================================================================================
{
  const v = V.tier(BEST);
  const topLevelNumbers = Object.entries(v).filter(([, x]) => typeof x === 'number').map(([k]) => k);
  check('NO top-level property of a tier verdict is a bare number',
    f(topLevelNumbers.length === 0, topLevelNumbers.length !== 0), topLevelNumbers.join(', '));
  check('fused_score, score and probability are explicitly null, so the absence is on the record',
    f(v.fused_score === null && v.score === null && v.probability === null && 'fused_score' in v,
      !(v.fused_score === null && v.score === null && v.probability === null && 'fused_score' in v)));

  const a = V.assess(V.DESIGNS[0], V.DESIGNS[0].answers);
  const assessNumbers = Object.entries(a).filter(([, x]) => typeof x === 'number').map(([k]) => k);
  check('NO top-level property of an assessment is a bare number either',
    f(assessNumbers.length === 0, assessNumbers.length !== 0), assessNumbers.join(', '));
  check('the assessment headline is a sentence, not a value',
    f(typeof a.headline === 'string' && a.headline.length > 60, !(typeof a.headline === 'string' && a.headline.length > 60)));
  check('the headline contains NO digits at all, so no float can be quoted out of it',
    f(/[0-9]/.test(a.headline) === false, /[0-9]/.test(a.headline) === true), a.headline.slice(0, 80));
  check('the headline says in words that it is not a judgement of whether the design is a good idea',
    f(/nothing about whether the design is a good idea/i.test(a.headline), !/nothing about whether the design is a good idea/i.test(a.headline)));
  check('the assessment carries WHY_NOT_A_SCORE with it, so the band cannot be had without the caveat',
    f(a.why_no_score === V.WHY_NOT_A_SCORE, a.why_no_score !== V.WHY_NOT_A_SCORE));
  check('the assessment reports a verdict PER AXIS, one for each of the seven',
    f(a.per_axis.length === 7 && a.per_axis.every(x => V.AXIS_IDS.includes(x.axis)), !(a.per_axis.length === 7 && a.per_axis.every(x => V.AXIS_IDS.includes(x.axis)))), `${a.per_axis.length}`);
  check('each per-axis row carries the question, the answer and what the answer means',
    f(a.per_axis.every(x => typeof x.question === 'string' && typeof x.what_that_means === 'string'),
      !a.per_axis.every(x => typeof x.question === 'string' && typeof x.what_that_means === 'string')));
  check('the assessment states explicitly that it is not a merit judgement',
    f(/refutable and wrong/i.test(a.not_a_merit_judgement), !/refutable and wrong/i.test(a.not_a_merit_judgement)));

  check('WHY_NOT_A_SCORE gives more than one reason',
    f(V.WHY_NOT_A_SCORE.the_argument.length >= 5, !(V.WHY_NOT_A_SCORE.the_argument.length >= 5)), `${V.WHY_NOT_A_SCORE.the_argument.length}`);
  check('WHY_NOT_A_SCORE names the conjunctive structure: the right operation is AND, not a weighted sum',
    f(V.WHY_NOT_A_SCORE.the_argument.some(s => /AND is not a weighted sum/i.test(s)), !V.WHY_NOT_A_SCORE.the_argument.some(s => /AND is not a weighted sum/i.test(s))));
  check('WHY_NOT_A_SCORE names the specific failure an average would cause: six good axes plus NO_COMMITMENT',
    f(V.WHY_NOT_A_SCORE.the_argument.some(s => /NO_COMMITMENT/.test(s)), !V.WHY_NOT_A_SCORE.the_argument.some(s => /NO_COMMITMENT/.test(s))));
  check('WHY_NOT_A_SCORE names the hazard of a float being read as a probability of being right',
    f(V.WHY_NOT_A_SCORE.the_argument.some(s => /read as a probability/i.test(s)), !V.WHY_NOT_A_SCORE.the_argument.some(s => /read as a probability/i.test(s))));
  check('WHY_NOT_A_SCORE says what to rank on instead, so it is not only an obstruction',
    f(/Rank on the TIERS/.test(V.WHY_NOT_A_SCORE.if_you_need_to_rank), !/Rank on the TIERS/.test(V.WHY_NOT_A_SCORE.if_you_need_to_rank)));
}

// ====================================================================================================
// 10. THE SOURCES, AND THE VALUES THAT WERE REFUSED
// ====================================================================================================
// A fabricated DOI or measurement is the worst thing this project can produce. These assertions check
// the SHAPE of the honesty: every source retrieved and identified, every unretrieved value null with a
// reason and with what would have to be measured.
{
  const noIds = V.SOURCE_IDS.filter(s => !/^\d{7,8}$/.test(V.SOURCES[s].pmid ?? '') || !/^10\.\d{4,9}\//.test(V.SOURCES[s].doi ?? ''));
  check('every source carries a well-formed PMID and a well-formed DOI',
    f(noIds.length === 0, noIds.length !== 0), noIds.join(', '));
  const noVerified = V.SOURCE_IDS.filter(s => typeof V.SOURCES[s].verified_how !== 'string' || V.SOURCES[s].verified_how.length < 60);
  check('every source says in verified_how exactly what was checked',
    f(noVerified.length === 0, noVerified.length !== 0), noVerified.join(', '));
  const noFetchNamed = V.SOURCE_IDS.filter(s => !/PubMed record/i.test(V.SOURCES[s].verified_how));
  check('and verified_how names the retrieval, not merely the belief that it happened',
    f(noFetchNamed.length === 0, noFetchNamed.length !== 0), noFetchNamed.join(', '));
  const noReadsOut = V.SOURCE_IDS.filter(s => typeof V.SOURCES[s].reads_out !== 'string');
  check('every source says what it READS OUT, which is the only reason a validatability module cites one',
    f(noReadsOut.length === 0, noReadsOut.length !== 0), noReadsOut.join(', '));

  const refused = V.SOURCE_IDS.flatMap(s => Object.entries(V.SOURCES[s].values_refused ?? {}).map(([k, x]) => ({ s, k, x })));
  check('at least three sources have a value that was REFUSED rather than guessed',
    f(refused.length >= 3, !(refused.length >= 3)), `${refused.length} refusals`);
  const malformed = refused.filter(({ x }) => x.value !== null || typeof x.null_reason !== 'string' || typeof x.what_would_have_to_be_measured !== 'string');
  check('every refused value is null AND carries a reason AND says what would have to be measured',
    f(malformed.length === 0, malformed.length !== 0), malformed.map(m => `${m.s}.${m.k}`).join(', '));
  check('the per-seta force is one of the refused values, with fold-changes given as the reason',
    f(V.SOURCES.autumn_2000.values_refused.single_seta_force_uN.value === null && /fold-changes/i.test(V.SOURCES.autumn_2000.values_refused.single_seta_force_uN.null_reason),
      !(V.SOURCES.autumn_2000.values_refused.single_seta_force_uN.value === null && /fold-changes/i.test(V.SOURCES.autumn_2000.values_refused.single_seta_force_uN.null_reason))));
  check('and the module records that refusing it DEMOTED our own design, rather than working around it',
    f(/demoted our own design/i.test(V.SOURCES.autumn_2000.consequence_in_this_module), !/demoted our own design/i.test(V.SOURCES.autumn_2000.consequence_in_this_module)));

  // The link between that refusal and the design's axis answer: this is the refusal actually biting.
  const setal = V.DESIGNS.find(d => /setal-dry-adhesion/.test(d.id));
  check('the design that would have used the refused number reports DIRECTION_ONLY, not NUMBER_WITH_UNITS',
    f(setal.answers.QUANTITATIVE_PREDICTION === 'DIRECTION_ONLY', setal.answers.QUANTITATIVE_PREDICTION !== 'DIRECTION_ONLY'),
    setal.answers.QUANTITATIVE_PREDICTION);
  check('and its own prediction number is null with the refusal as the reason, not a remembered figure',
    f(setal.prediction.number.value === null && /will not recall one/i.test(setal.prediction.number.null_reason),
      !(setal.prediction.number.value === null && /will not recall one/i.test(setal.prediction.number.null_reason))));

  const orphan = V.DESIGNS.flatMap(d => (d.sources ?? []).filter(s => !V.SOURCE_IDS.includes(s)).map(s => `${d.id}:${s}`));
  check('every source id cited by a design exists in SOURCES: no design cites a source that is not there',
    f(orphan.length === 0, orphan.length !== 0), orphan.join(', '));
  const unused = V.SOURCE_IDS.filter(s => !V.DESIGNS.some(d => (d.sources ?? []).includes(s)));
  check('and every source in SOURCES is actually used by a design, so none is decorative',
    f(unused.length === 0, unused.length !== 0), unused.join(', '));
  const nullNoReason = V.DESIGNS.filter(d => d.prediction?.number && d.prediction.number.value === null && typeof d.prediction.number.null_reason !== 'string');
  check('every design whose predicted number is null gives a null_reason',
    f(nullNoReason.length === 0, nullNoReason.length !== 0), nullNoReason.map(d => d.id).join(', '));
  check('SOURCES is deep frozen, down to a nested refusal record',
    f(Object.isFrozen(V.SOURCES.autumn_2000.values_refused.single_seta_force_uN) === true, Object.isFrozen(V.SOURCES.autumn_2000.values_refused.single_seta_force_uN) !== true));
}

// ====================================================================================================
// 11. THE WORKED DESIGNS
// ====================================================================================================
{
  const w = V.worked();
  check('worked() runs over a handful of designs',
    f(w.n >= 6, !(w.n >= 6)), `${w.n}`);
  check('worked() reaches all four tiers, so the tiering is exercised rather than asserted',
    f(w.tiers_unreached.length === 0, w.tiers_unreached.length !== 0), w.tiers_unreached.join(', '));
  check('the distribution sums to the number of designs, so each got exactly one tier',
    f(Object.values(w.distribution).reduce((a, b) => a + b, 0) === w.n, Object.values(w.distribution).reduce((a, b) => a + b, 0) !== w.n));
  check('every design\'s answer set is complete and in-vocabulary, or worked() would have thrown',
    f(w.rows.every(r => V.AXIS_IDS.every(ax => V.VOCABULARY[ax].includes(r.answers[ax]))),
      !w.rows.every(r => V.AXIS_IDS.every(ax => V.VOCABULARY[ax].includes(r.answers[ax])))));
  const noNotes = V.DESIGNS.filter(d => typeof d.answer_notes !== 'object' || Object.keys(d.answer_notes).length === 0);
  check('every design argues at least some of its axis answers rather than asserting them',
    f(noNotes.length === 0, noNotes.length !== 0), noNotes.map(d => d.id).join(', '));
  const noOurs = V.DESIGNS.filter(d => typeof d.ours !== 'string');
  check('every design states that the proposal is OURS and not a claim made by a cited paper',
    f(noOurs.length === 0, noOurs.length !== 0), noOurs.map(d => d.id).join(', '));

  check('exactly the design with no refutation condition makes prereg() throw',
    f(w.n_prereg_refused === 1, w.n_prereg_refused !== 1), `${w.n_prereg_refused}`);
  const thrower = w.rows.find(r => r.prereg_threw !== null);
  check('and that design is the one the module included so the throw is exercised against something realistic',
    f(/oscillatory-flight-musculature/.test(thrower.id), !/oscillatory-flight-musculature/.test(thrower.id)), thrower.id);
  check('that design is also REFUSED_BEFORE_VALIDATION, so the two refusals agree',
    f(thrower.tier === 'REFUSED_BEFORE_VALIDATION', thrower.tier !== 'REFUSED_BEFORE_VALIDATION'), thrower.tier);
  check('it is refused despite being buildable in its host: tractability is not the headline',
    f(thrower.answers.HOST_TRACTABLE === 'POSSIBLE_IN_HOST', thrower.answers.HOST_TRACTABLE !== 'POSSIBLE_IN_HOST'), thrower.answers.HOST_TRACTABLE);

  check('at least one design is a POST_HOC_RECORD, labelled rather than hidden',
    f(w.n_post_hoc >= 1, !(w.n_post_hoc >= 1)), `${w.n_post_hoc}`);
  const retro = w.rows.filter(r => r.tier === 'RETRO_VALIDATABLE_NOW');
  check('the retro-validatable design is the one whose prereg is post-hoc, which is the uncomfortable part',
    f(retro.some(r => r.prereg_kind === 'POST_HOC_RECORD'), !retro.some(r => r.prereg_kind === 'POST_HOC_RECORD')),
    retro.map(r => `${r.id}:${r.prereg_kind}`).join(', '));
  check('worked() names the uncomfortable row rather than burying it in the table',
    f(/one retro-test we have is one we did not pass/i.test(w.the_uncomfortable_row), !/one retro-test we have is one we did not pass/i.test(w.the_uncomfortable_row)));
  check('and that design itself records why the post-hoc label is honest rather than deleting the row',
    f(/most misleading edit available/i.test(V.DESIGNS.find(d => /published-cross-species-comparison/.test(d.id)).the_honesty_problem),
      !/most misleading edit available/i.test(V.DESIGNS.find(d => /published-cross-species-comparison/.test(d.id)).the_honesty_problem)));
  check('worked() states that its distribution is NOT a base rate',
    f(/NOT a base rate/.test(w.what_it_does_not_show), !/NOT a base rate/.test(w.what_it_does_not_show)));
  check('worked() carries the data-provenance note about the comparative subset',
    f(/mammals, fishes/.test(w.data_provenance), !/mammals, fishes/.test(w.data_provenance)));

  // The design whose rival is named by its own source's abstract: the sharpest case in the set.
  const donor = w.rows.find(r => /hyaluronan-synthase/.test(r.id));
  check('the already-performed transfer lands NOT_YET_DECIDABLE because a named rival is inseparable',
    f(donor.tier === 'NOT_YET_DECIDABLE' && donor.answers.CONFOUND_SEVERITY === 'CONFOUNDS_NAMED_NOT_SEPARABLE',
      !(donor.tier === 'NOT_YET_DECIDABLE' && donor.answers.CONFOUND_SEVERITY === 'CONFOUNDS_NAMED_NOT_SEPARABLE')), `${donor.tier}`);
  check('and the rival is the one named in the source\'s own retrieved abstract',
    f(/not specific to the nmrHas2 gene/.test(V.SOURCES.zhang_2023.values_retrieved.the_sentence_that_matters),
      !/not specific to the nmrHas2 gene/.test(V.SOURCES.zhang_2023.values_retrieved.the_sentence_that_matters)));
  check('every row names the blocking axes when there are any, and none when there are not',
    f(w.rows.every(r => (r.tier === 'RETRO_VALIDATABLE_NOW' || r.tier === 'VALIDATABLE_IN_A_LAB') ? r.blockers.length === 0 : r.blockers.length > 0),
      !w.rows.every(r => (r.tier === 'RETRO_VALIDATABLE_NOW' || r.tier === 'VALIDATABLE_IN_A_LAB') ? r.blockers.length === 0 : r.blockers.length > 0)),
    w.rows.map(r => `${r.tier}:${r.blockers.length}`).join(' '));
  check('worked() is frozen',
    f(Object.isFrozen(w) === true, Object.isFrozen(w) !== true));
}

// ====================================================================================================
// 12. THE UNCOMFORTABLE PART
// ====================================================================================================
{
  const U = V.THE_UNCOMFORTABLE_PART;
  check('THE_UNCOMFORTABLE_PART is frozen',
    f(Object.isFrozen(U) === true, Object.isFrozen(U) !== true));
  check('it states that two of the three levels came out at chance against external ground truth',
    f(/two of the three levels came out at chance/i.test(U.headline), !/two of the three levels came out at chance/i.test(U.headline)));
  check('it draws the consequence: validatability is currently a stronger claim than design quality',
    f(/stronger claim than any claim about the QUALITY/i.test(U.headline), !/stronger claim than any claim about the QUALITY/i.test(U.headline)));
  check('it quotes the line from this repo\'s own benchmark file rather than paraphrasing it',
    f(U.the_numbers.the_line_from_the_file === V.REPO_BENCHMARKS.the_line_from_the_file,
      U.the_numbers.the_line_from_the_file !== V.REPO_BENCHMARKS.the_line_from_the_file));
  check('the benchmark numbers are recorded as OURS, read from the repo, not attributed to a paper',
    f(/not any paper/i.test(V.REPO_BENCHMARKS.verified_how) && /benchmarks\/README\.md/.test(V.REPO_BENCHMARKS.verified_how),
      !(/not any paper/i.test(V.REPO_BENCHMARKS.verified_how) && /benchmarks\/README\.md/.test(V.REPO_BENCHMARKS.verified_how))));
  check('the guide-score interval includes zero, and the record says so',
    f(V.REPO_BENCHMARKS.guide_score.ci[0] < 0 && V.REPO_BENCHMARKS.guide_score.ci[1] > 0,
      !(V.REPO_BENCHMARKS.guide_score.ci[0] < 0 && V.REPO_BENCHMARKS.guide_score.ci[1] > 0)), V.REPO_BENCHMARKS.guide_score.ci.join(', '));
  check('the design scorer\'s hard-negative AUC is recorded as the near-chance value, not the easy one',
    f(V.REPO_BENCHMARKS.design_scorer.auc_on_real_fish_nudged_quarter_sd < 0.6 && V.REPO_BENCHMARKS.design_scorer.auc_on_shuffles > 0.8,
      !(V.REPO_BENCHMARKS.design_scorer.auc_on_real_fish_nudged_quarter_sd < 0.6 && V.REPO_BENCHMARKS.design_scorer.auc_on_shuffles > 0.8)),
    `${V.REPO_BENCHMARKS.design_scorer.auc_on_shuffles} -> ${V.REPO_BENCHMARKS.design_scorer.auc_on_real_fish_nudged_quarter_sd}`);
  check('the constructed impossible animal that the scorer calls typical is on the record',
    f(V.REPO_BENCHMARKS.design_scorer.constructed_negative.q > 0.9, !(V.REPO_BENCHMARKS.design_scorer.constructed_negative.q > 0.9)),
    `q = ${V.REPO_BENCHMARKS.design_scorer.constructed_negative.q}`);
  check('the one level that PASSED is reported too, so the record is not selectively gloomy',
    f(/48\/48/.test(U.the_numbers.the_one_that_passed), !/48\/48/.test(U.the_numbers.the_one_that_passed)));
  check('it names the ordering consequence: a ranked list of ways to be wrong, not of organisms',
    f(U.what_follows_from_it.some(s => /not a ranked list of organisms/i.test(s)), !U.what_follows_from_it.some(s => /not a ranked list of organisms/i.test(s))));
  check('it says the quality verdicts are a shortlist from an uncalibrated instrument, in those terms',
    f(U.what_follows_from_it.some(s => /uncalibrated instrument/i.test(s)), !U.what_follows_from_it.some(s => /uncalibrated instrument/i.test(s))));
  check('it sets a priority: getting the scorer above chance beats producing more designs',
    f(U.what_follows_from_it.some(s => /worth more than any number of further designs/i.test(s)), !U.what_follows_from_it.some(s => /worth more than any number of further designs/i.test(s))));
  check('it refuses to let the admission become an excuse for vagueness',
    f(/does not license vagueness/i.test(U.not_an_excuse) || /None of this licenses vagueness/i.test(U.not_an_excuse),
      !(/does not license vagueness/i.test(U.not_an_excuse) || /None of this licenses vagueness/i.test(U.not_an_excuse))));
  check('WHY_NOT_A_SCORE points at it, so the two pieces of prose are not independent assertions',
    f(V.WHY_NOT_A_SCORE.the_argument.some(s => /THE_UNCOMFORTABLE_PART/.test(s)), !V.WHY_NOT_A_SCORE.the_argument.some(s => /THE_UNCOMFORTABLE_PART/.test(s))));
  check('WHAT_THIS_IS says the module reports nothing about whether a design is a good idea',
    f(/nothing whatever about/i.test(V.WHAT_THIS_IS) && /good idea/.test(V.WHAT_THIS_IS), !(/nothing whatever about/i.test(V.WHAT_THIS_IS) && /good idea/.test(V.WHAT_THIS_IS))));
}

// ====================================================================================================
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
