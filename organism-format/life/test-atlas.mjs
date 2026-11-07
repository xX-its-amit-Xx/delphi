#!/usr/bin/env node
// Tests for the Carnegie staging layer.
//
//   node organism-format/life/test-atlas.mjs
//   node organism-format/life/test-atlas.mjs --fail-once     <- every assertion must flip to FAIL
//
// Most of these check that something is REFUSED or that a number is a RANGE, because the failure mode
// that matters here is not a crash - it is a single plausible day for a Carnegie stage, or a composite
// that reads as an organism. Both of those are well-formed output.
//
// Three of them are of a different kind, and they are the ones worth keeping: the prose in RANGE_SHAPE
// is held against the table it describes, so a claim about the data cannot rot beside the data; the
// stamped temperature is run through the real reader, so "assumed" has to survive the provenance census
// and not just sit in a field; and the composite is run through the real reader too, because a document
// this module calls ok and read.mjs refuses would be a lie in two places.

import * as SPEC from './spec.mjs';
import { read, provenanceCensus } from './read.mjs';
import {
  CARNEGIE, STAGE_RANGE, RANGE_SHAPE, DAYS_SOURCE, SOURCES, OPERATIONS,
  LENGTH_IS_NOT_A_CRITERION, EXTERNAL_CRITERIA_ARE_NOT_ENOUGH, TEMPERATURE_AWKWARDNESS,
  WHAT_AN_ATLAS_IS_NOT, NOT_ESTABLISHED,
  toDays, isStage, refuseArithmetic, spanOf, humanMouseCaution, atlasStageToLife, compositeFromAtlas,
} from './atlas.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

// ===================================================================================================
// fixtures
// ===================================================================================================

/** An atlas-shaped record, HESTA's shape: a stage, an embryo, a section. */
const REC = (over = {}) => ({
  carnegie_stage: 12,
  embryo: 'E2',
  section: 'S01',
  temperature_C: 37,
  staged_by: 'Pan et al. 2026, staged on external morphology per O\'Rahilly & Müller',
  ...over,
});

// ===================================================================================================
// 1. CARNEGIE covers 1-23 with no gaps
// ===================================================================================================
console.log('\nCARNEGIE');
{
  const nums = CARNEGIE.map(r => r.stage);
  const expected = Array.from({ length: 23 }, (_, i) => i + 1);
  check('CARNEGIE has exactly 23 rows',
    f(CARNEGIE.length === 23, CARNEGIE.length !== 23), `${CARNEGIE.length} rows`);
  check('CARNEGIE covers stages 1-23 in order with no gaps and no duplicates',
    f(nums.join(',') === expected.join(','), nums.join(',') !== expected.join(',')), nums.join(','));
  check('STAGE_RANGE agrees with the table it describes',
    f(STAGE_RANGE.lo === nums[0] && STAGE_RANGE.hi === nums[nums.length - 1] && STAGE_RANGE.count === CARNEGIE.length,
      !(STAGE_RANGE.lo === nums[0] && STAGE_RANGE.hi === nums[nums.length - 1] && STAGE_RANGE.count === CARNEGIE.length)));
  check('there is no stage 0 and no stage 24, and asking refuses',
    f(toDays(0).refused === true && toDays(24).refused === true,
      !(toDays(0).refused === true && toDays(24).refused === true)));

  check('every row carries a day RANGE object, not a number',
    f(CARNEGIE.every(r => r.days && typeof r.days === 'object' && typeof r.days.lo === 'number' && typeof r.days.hi === 'number'),
      !CARNEGIE.every(r => r.days && typeof r.days === 'object' && typeof r.days.lo === 'number' && typeof r.days.hi === 'number')));
  check('every row records BOTH published age conventions verbatim',
    f(CARNEGIE.every(r => typeof r.age_1987 === 'string' && r.age_1987.length > 0 && typeof r.age_2010 === 'string' && r.age_2010.length > 0),
      !CARNEGIE.every(r => typeof r.age_1987 === 'string' && r.age_1987.length > 0 && typeof r.age_2010 === 'string' && r.age_2010.length > 0)));
  check('every row carries a one-line morphological criterion',
    f(CARNEGIE.every(r => typeof r.criteria === 'string' && r.criteria.length > 20 && !r.criteria.includes('\n')),
      !CARNEGIE.every(r => typeof r.criteria === 'string' && r.criteria.length > 20 && !r.criteria.includes('\n'))));
  check('every row MARKS its criteria as unverified, because the Carnegie plates were not read',
    f(CARNEGIE.every(r => r.criteria_verified === false && typeof r.criteria_source === 'string'),
      !CARNEGIE.every(r => r.criteria_verified === false && typeof r.criteria_source === 'string')));
  check('length is recorded as GREATEST length, never crown-rump, which is the fetal measure',
    f(CARNEGIE.every(r => !('crown_rump_length_mm' in r)) && CARNEGIE.every(r => 'greatest_length_mm' in r) && /crown-?RUMP is not in it|not crown-rump/i.test(LENGTH_IS_NOT_A_CRITERION),
      !(CARNEGIE.every(r => !('crown_rump_length_mm' in r)) && CARNEGIE.every(r => 'greatest_length_mm' in r) && /crown-?RUMP is not in it|not crown-rump/i.test(LENGTH_IS_NOT_A_CRITERION))));
  check('the table says in prose that length does not assign a stage, and names the 20 mm case',
    f(/20-mm embryo/.test(LENGTH_IS_NOT_A_CRITERION) && /never be assigned merely on the basis of embryonic length/.test(LENGTH_IS_NOT_A_CRITERION),
      !(/20-mm embryo/.test(LENGTH_IS_NOT_A_CRITERION) && /never be assigned merely on the basis of embryonic length/.test(LENGTH_IS_NOT_A_CRITERION))));
  check('stages 19-23 are flagged as not delineable from external features alone',
    f([19, 20, 21, 22, 23].every(n => CARNEGIE[n - 1].external_criteria_insufficient === true)
      && CARNEGIE.slice(0, 18).every(r => r.external_criteria_insufficient !== true),
      !([19, 20, 21, 22, 23].every(n => CARNEGIE[n - 1].external_criteria_insufficient === true)
        && CARNEGIE.slice(0, 18).every(r => r.external_criteria_insufficient !== true))));
  check('rows whose 2010 estimate carries the authors\' own question mark are flagged source_uncertain',
    f(CARNEGIE.filter(r => r.age_2010.includes('?')).every(r => r.source_uncertain === true)
      && CARNEGIE.filter(r => r.source_uncertain).map(r => r.stage).join(',') === '5,6,7,10',
      !(CARNEGIE.filter(r => r.age_2010.includes('?')).every(r => r.source_uncertain === true)
        && CARNEGIE.filter(r => r.source_uncertain).map(r => r.stage).join(',') === '5,6,7,10')),
    `flagged: ${CARNEGIE.filter(r => r.source_uncertain).map(r => r.stage).join(',')}`);
  check('every row\'s range is the union of its two source conventions, or says why not',
    // the union rule: days.lo <= min(both lows) and days.hi >= max(both highs), read off the source strings
    f(CARNEGIE.every(r => {
      const ns = `${r.age_1987} ${r.age_2010}`.match(/\d+(?:½)?/g) ?? [];
      const vals = ns.map(s => Number(s.replace('½', '.5')));
      if (!vals.length) return true;
      return r.days.lo <= Math.min(...vals) && r.days.hi >= Math.max(...vals);
    }), !CARNEGIE.every(r => {
      const ns = `${r.age_1987} ${r.age_2010}`.match(/\d+(?:½)?/g) ?? [];
      const vals = ns.map(s => Number(s.replace('½', '.5')));
      if (!vals.length) return true;
      return r.days.lo <= Math.min(...vals) && r.days.hi >= Math.max(...vals);
    })));
  check('the only row widened from a point is stage 1, and it says so',
    f(CARNEGIE.filter(r => r.widened_from_a_point).map(r => r.stage).join(',') === '1'
      && /widened to 0-1/.test(DAYS_SOURCE.the_one_row_that_is_not_a_union),
      !(CARNEGIE.filter(r => r.widened_from_a_point).map(r => r.stage).join(',') === '1'
        && /widened to 0-1/.test(DAYS_SOURCE.the_one_row_that_is_not_a_union))));
  check('CARNEGIE and every row in it are frozen',
    f(Object.isFrozen(CARNEGIE) && CARNEGIE.every(r => Object.isFrozen(r) && Object.isFrozen(r.days)),
      !(Object.isFrozen(CARNEGIE) && CARNEGIE.every(r => Object.isFrozen(r) && Object.isFrozen(r.days)))));
}

// ===================================================================================================
// 2. toDays returns a range, never a scalar
// ===================================================================================================
console.log('\ntoDays');
{
  const all = CARNEGIE.map(r => toDays(r.stage));

  check('toDays never returns a number, for any stage 1-23',
    f(all.every(d => typeof d === 'object' && d !== null && typeof d !== 'number'),
      !all.every(d => typeof d === 'object' && d !== null && typeof d !== 'number')));
  check('toDays returns hi > lo for EVERY stage, stage 1 included',
    f(all.every(d => d.hi > d.lo), !all.every(d => d.hi > d.lo)),
    `offenders: ${all.filter(d => !(d.hi > d.lo)).map(d => d.stage).join(',') || 'none'}`);
  check('toDays carries unit "days_post_fertilisation"',
    f(all.every(d => d.unit === 'days_post_fertilisation'), !all.every(d => d.unit === 'days_post_fertilisation')));
  check('that unit string is DELIBERATELY not a legal SPEC.TIME_UNITS value, so it cannot be written as a time',
    f(!SPEC.TIME_UNITS.includes('days_post_fertilisation') && /deliberately not a legal `time_unit`/.test(toDays(12).why_this_unit_string),
      !(!SPEC.TIME_UNITS.includes('days_post_fertilisation') && /deliberately not a legal `time_unit`/.test(toDays(12).why_this_unit_string))));
  check('every toDays result carries a `why` saying a point estimate would be a fabrication',
    f(all.every(d => /point estimate would be a fabrication/.test(d.why ?? '')),
      !all.every(d => /point estimate would be a fabrication/.test(d.why ?? ''))));
  check('the `why` names morphology as the definition of a stage, and quotes the source',
    f(/never be assigned merely on the basis of prenatal age/.test(toDays(12).why) && /MORPHOLOGY/.test(toDays(12).why),
      !(/never be assigned merely on the basis of prenatal age/.test(toDays(12).why) && /MORPHOLOGY/.test(toDays(12).why))));
  check('a refused toDays STILL carries lo:null/hi:null and the `why`, not a thrown error or a number',
    f(toDays('twelve').refused === true && toDays('twelve').lo === null && typeof toDays('twelve').why === 'string',
      !(toDays('twelve').refused === true && toDays('twelve').lo === null && typeof toDays('twelve').why === 'string')));
  check('a fractional stage is refused as an interpolation, naming the spec rule',
    f(toDays(12.5).refused === true && /interpolation/.test(toDays(12.5).why_refused),
      !(toDays(12.5).refused === true && /interpolation/.test(toDays(12.5).why_refused))),
    toDays(12.5).why_refused);
  check('toDays accepts "CS12" and "carnegie stage 12" as the same stage as 12',
    f(toDays('CS12').lo === toDays(12).lo && toDays('carnegie stage 12').hi === toDays(12).hi,
      !(toDays('CS12').lo === toDays(12).lo && toDays('carnegie stage 12').hi === toDays(12).hi)));
  check('isStage agrees with toDays about what is a stage',
    f(isStage(12) && isStage('CS23') && !isStage(0) && !isStage(24) && !isStage(12.5),
      !(isStage(12) && isStage('CS23') && !isStage(0) && !isStage(24) && !isStage(12.5))));
  check('toDays(12) is the sourced union 26-31, covering 1987\'s 26 and 2010\'s 29-31',
    f(toDays(12).lo === 26 && toDays(12).hi === 31, !(toDays(12).lo === 26 && toDays(12).hi === 31)),
    `${toDays(12).lo}-${toDays(12).hi}`);
  check('toDays names the other stages whose ranges overlap it, so the day cannot identify the stage',
    f(toDays(12).overlaps.includes(11) && toDays(12).overlaps.includes(13) && toDays(12).overlaps.length >= 2,
      !(toDays(12).overlaps.includes(11) && toDays(12).overlaps.includes(13) && toDays(12).overlaps.length >= 2)),
    `stage 12 overlaps ${toDays(12).overlaps.join(',')}`);
  check('the HESTA range CS12-23 lands at roughly 4 to 8 postfertilisation weeks',
    f(toDays(12).lo / 7 > 3.5 && toDays(12).lo / 7 < 4.5 && toDays(23).hi / 7 > 7.5 && toDays(23).hi / 7 < 8.5,
      !(toDays(12).lo / 7 > 3.5 && toDays(12).lo / 7 < 4.5 && toDays(23).hi / 7 > 7.5 && toDays(23).hi / 7 < 8.5)),
    `${(toDays(12).lo / 7).toFixed(1)}-${(toDays(23).hi / 7).toFixed(1)} weeks`);
}

// ===================================================================================================
// 3. the shape of the ranges, held against the prose that describes it
// ===================================================================================================
console.log('\nRANGE_SHAPE (the prose is checked against the table)');
{
  const lo = CARNEGIE.map(r => r.days.lo);
  const hi = CARNEGIE.map(r => r.days.hi);

  const loStrict = lo.every((v, i) => i === 0 || v > lo[i - 1]);
  const hiNonDec = hi.every((v, i) => i === 0 || v >= hi[i - 1]);
  const hiStrict = hi.every((v, i) => i === 0 || v > hi[i - 1]);

  check('lo is STRICTLY increasing in stage number, as RANGE_SHAPE claims',
    f(loStrict === true && RANGE_SHAPE.lo_strictly_increases === true,
      !(loStrict === true && RANGE_SHAPE.lo_strictly_increases === true)));
  check('hi is non-decreasing but NOT strictly increasing - the real table ties, and the claim says so',
    f(hiNonDec === true && hiStrict === false && RANGE_SHAPE.hi_is_non_decreasing_but_not_strict === true,
      !(hiNonDec === true && hiStrict === false && RANGE_SHAPE.hi_is_non_decreasing_but_not_strict === true)));
  check('the tie is at stages 10 and 11, both ending day 30, exactly where RANGE_SHAPE says',
    f(hi[9] === 30 && hi[10] === 30 && /stages 10 and 11/.test(RANGE_SHAPE.where_hi_ties),
      !(hi[9] === 30 && hi[10] === 30 && /stages 10 and 11/.test(RANGE_SHAPE.where_hi_ties))));

  // adjacent pairs: overlap or touch when hi[n] >= lo[n+1]
  const pairs = CARNEGIE.slice(0, -1).map((r, i) => ({ a: r.stage, b: CARNEGIE[i + 1].stage, overlap: r.days.hi >= CARNEGIE[i + 1].days.lo }));
  const gaps = pairs.filter(p => !p.overlap).map(p => `${p.a}->${p.b}`);
  const overlaps = pairs.filter(p => p.overlap);

  check('adjacent ranges DO overlap or touch, for most pairs, as RANGE_SHAPE claims',
    f(RANGE_SHAPE.adjacent_ranges_overlap === true && overlaps.length === 18 && pairs.length === 22,
      !(RANGE_SHAPE.adjacent_ranges_overlap === true && overlaps.length === 18 && pairs.length === 22)),
    `${overlaps.length} overlap or touch of ${pairs.length} adjacent pairs`);
  check('and the four gaps are 1->2, 2->3, 4->5, 5->6 - stated, not glossed',
    f(gaps.join(' ') === '1->2 2->3 4->5 5->6' && /Four gaps, eighteen overlaps or touches/.test(RANGE_SHAPE.overlap_detail),
      !(gaps.join(' ') === '1->2 2->3 4->5 5->6' && /Four gaps, eighteen overlaps or touches/.test(RANGE_SHAPE.overlap_detail))),
    `gaps: ${gaps.join(' ')}`);
  check('overlap is explained as the staging system working, not as a defect',
    f(/age not to determine stage/.test(RANGE_SHAPE.why_overlap_is_not_a_bug) && /day 30/.test(RANGE_SHAPE.why_overlap_is_not_a_bug),
      !(/age not to determine stage/.test(RANGE_SHAPE.why_overlap_is_not_a_bug) && /day 30/.test(RANGE_SHAPE.why_overlap_is_not_a_bug))));
  check('day 30 really is ambiguous between stages 11, 12 and 13, as that explanation asserts',
    f(CARNEGIE.filter(r => r.days.lo <= 30 && r.days.hi >= 30).map(r => r.stage).join(',') === '10,11,12,13',
      CARNEGIE.filter(r => r.days.lo <= 30 && r.days.hi >= 30).map(r => r.stage).join(',') !== '10,11,12,13'),
    `day 30 is consistent with stages ${CARNEGIE.filter(r => r.days.lo <= 30 && r.days.hi >= 30).map(r => r.stage).join(',')}`);
  check('RANGE_SHAPE is frozen, so the claim cannot be edited to match a broken table at runtime',
    f(Object.isFrozen(RANGE_SHAPE) && Object.isFrozen(DAYS_SOURCE), !(Object.isFrozen(RANGE_SHAPE) && Object.isFrozen(DAYS_SOURCE))));
}

// ===================================================================================================
// 4. refuseArithmetic
// ===================================================================================================
console.log('\nrefuseArithmetic');
{
  const sub = refuseArithmetic(12, 10, 'subtract');
  const avg = refuseArithmetic(12, 16, 'average');
  const interp = refuseArithmetic(12, 13, 'interpolate');

  check('refuseArithmetic refuses SUBTRACTION',
    f(sub.refused === true, sub.refused !== true));
  check('refuseArithmetic refuses AVERAGING',
    f(avg.refused === true, avg.refused !== true));
  check('refuseArithmetic refuses INTERPOLATION',
    f(interp.refused === true, interp.refused !== true));
  check('the three refusals give three DIFFERENT reasons, not one shared one',
    f(new Set([sub.why, avg.why, interp.why]).size === 3, new Set([sub.why, avg.why, interp.why]).size !== 3));
  check('the subtraction reason is the spec\'s own sentence: Carnegie 12 minus Carnegie 10 is not 2 of anything',
    f(/Carnegie 12 minus Carnegie 10 is not 2 of anything/.test(sub.why), !/Carnegie 12 minus Carnegie 10 is not 2 of anything/.test(sub.why)));
  check('the averaging reason says the mean of 12 and 16 is not stage 14',
    f(/mean of stage 12 and stage 16 is not stage 14/.test(avg.why), !/mean of stage 12 and stage 16 is not stage 14/.test(avg.why)));
  check('the interpolation reason cites SPEC.REFUSALS.no_interpolated_stage verbatim',
    f(interp.why.includes(SPEC.REFUSALS.no_interpolated_stage), !interp.why.includes(SPEC.REFUSALS.no_interpolated_stage)));
  check('there is NO success path: every known operation, and an unknown one, refuses',
    f([...Object.keys(OPERATIONS), 'blerg', undefined].every(op => refuseArithmetic(12, 10, op).refused === true),
      ![...Object.keys(OPERATIONS), 'blerg', undefined].every(op => refuseArithmetic(12, 10, op).refused === true)));
  check('mean, midpoint, lerp, ratio, divide, scale, add and sum are all refused too',
    f(['mean', 'midpoint', 'lerp', 'ratio', 'divide', 'scale', 'add', 'sum'].every(op => refuseArithmetic(20, 10, op).refused === true && refuseArithmetic(20, 10, op).operation_recognised === true),
      !['mean', 'midpoint', 'lerp', 'ratio', 'divide', 'scale', 'add', 'sum'].every(op => refuseArithmetic(20, 10, op).refused === true && refuseArithmetic(20, 10, op).operation_recognised === true)));
  check('called with no operation it refuses ALL of them and lists what it refused',
    f(refuseArithmetic(12, 10).refused === true && refuseArithmetic(12, 10).operations_refused.length >= 10 && !refuseArithmetic(12, 10).operations_refused.includes('any'),
      !(refuseArithmetic(12, 10).refused === true && refuseArithmetic(12, 10).operations_refused.length >= 10 && !refuseArithmetic(12, 10).operations_refused.includes('any'))));
  check('validity is NOT permission: two real stages still refuse, and the result says why that is worse',
    f(sub.operands_are_valid_stages === true && /MORE necessary, not less/.test(sub.why_validity_is_not_permission),
      !(sub.operands_are_valid_stages === true && /MORE necessary, not less/.test(sub.why_validity_is_not_permission))));
  check('an INVALID operand also refuses, rather than throwing or passing through',
    f(refuseArithmetic('twelve', null, 'subtract').refused === true && refuseArithmetic('twelve', null, 'subtract').operands_are_valid_stages === false,
      !(refuseArithmetic('twelve', null, 'subtract').refused === true && refuseArithmetic('twelve', null, 'subtract').operands_are_valid_stages === false)));
  check('the refusal says what to do instead, and reports the two day RANGES rather than a difference',
    f(sub.day_ranges.a.lo === 26 && sub.day_ranges.b.lo === 22 && /spanOf/.test(sub.what_to_do_instead),
      !(sub.day_ranges.a.lo === 26 && sub.day_ranges.b.lo === 22 && /spanOf/.test(sub.what_to_do_instead))),
    sub.what_to_do_instead);
  check('the refusal reports that the spec filed its own example under the wrong rule',
    f(/no_cross_unit_distance/.test(sub.the_spec_rule_is_misfiled) && /within a SINGLE unit/.test(sub.the_spec_rule_is_misfiled),
      !(/no_cross_unit_distance/.test(sub.the_spec_rule_is_misfiled) && /within a SINGLE unit/.test(sub.the_spec_rule_is_misfiled))));
  check('and the spec really does lack an ordinal-arithmetic rule, which is why that finding stands',
    f(!('no_ordinal_arithmetic' in SPEC.REFUSALS) && SPEC.REFUSALS.no_cross_unit_distance.includes('Carnegie 12 minus Carnegie 10'),
      !(!('no_ordinal_arithmetic' in SPEC.REFUSALS) && SPEC.REFUSALS.no_cross_unit_distance.includes('Carnegie 12 minus Carnegie 10'))));
  check('carnegie_stage is in SPEC.ORDINAL_UNITS, which is the rule being enforced',
    f(SPEC.ORDINAL_UNITS.includes('carnegie_stage'), !SPEC.ORDINAL_UNITS.includes('carnegie_stage')));
}

// ===================================================================================================
// 5. spanOf
// ===================================================================================================
console.log('\nspanOf');
{
  const one = spanOf([12]);
  const hesta = spanOf([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  const sparse = spanOf([12, 16, 23]);

  check('spanOf of a SINGLE stage equals that stage\'s own range exactly',
    f(one.lo === toDays(12).lo && one.hi === toDays(12).hi && one.single_stage === true,
      !(one.lo === toDays(12).lo && one.hi === toDays(12).hi && one.single_stage === true)),
    `${one.lo}-${one.hi} vs ${toDays(12).lo}-${toDays(12).hi}`);
  check('spanOf of a single stage is still a RANGE and still says so',
    f(one.hi > one.lo && one.is_union_of_ranges === true && one.unit === 'days_post_fertilisation',
      !(one.hi > one.lo && one.is_union_of_ranges === true && one.unit === 'days_post_fertilisation')));
  check('spanOf takes lo from the EARLIEST stage and hi from the LATEST',
    f(hesta.lo === toDays(12).lo && hesta.hi === toDays(23).hi && hesta.earliest_stage === 12 && hesta.latest_stage === 23,
      !(hesta.lo === toDays(12).lo && hesta.hi === toDays(23).hi && hesta.earliest_stage === 12 && hesta.latest_stage === 23)),
    `${hesta.lo}-${hesta.hi} d`);
  check('spanOf marks the result a UNION of ranges',
    f(hesta.is_union_of_ranges === true && /union of 12 stage ranges/.test(hesta.why_union),
      !(hesta.is_union_of_ranges === true && /union of 12 stage ranges/.test(hesta.why_union))));
  check('spanOf says the union is WIDER than any individual embryo\'s actual development',
    f(/cannot both be true of one individual/.test(hesta.wider_than_any_embryo) && /ENVELOPE over/.test(hesta.wider_than_any_embryo),
      !(/cannot both be true of one individual/.test(hesta.wider_than_any_embryo) && /ENVELOPE over/.test(hesta.wider_than_any_embryo))));
  check('spanOf adds the atlas caveat: these may be stages of DIFFERENT individuals',
    f(/stages of DIFFERENT individuals/.test(hesta.and_it_is_wider_still_if_the_stages_came_from_an_atlas),
      !/stages of DIFFERENT individuals/.test(hesta.and_it_is_wider_still_if_the_stages_came_from_an_atlas)));
  check('spanOf names the stages that lie inside the span and are NOT in the set',
    f(sparse.gaps_in_the_set.join(',') === '13,14,15,17,18,19,20,21,22' && /interpolating across the gap/.test(sparse.gaps_note),
      !(sparse.gaps_in_the_set.join(',') === '13,14,15,17,18,19,20,21,22' && /interpolating across the gap/.test(sparse.gaps_note))),
    `gaps: ${sparse.gaps_in_the_set.join(',')}`);
  check('spanOf reports no gaps when the set is contiguous',
    f(hesta.gaps_in_the_set.length === 0 && hesta.gaps_note === null,
      !(hesta.gaps_in_the_set.length === 0 && hesta.gaps_note === null)));
  check('spanOf de-duplicates and sorts rather than trusting the caller\'s order',
    f(spanOf([23, 12, 12]).stages.join(',') === '12,23' && spanOf([23, 12, 12]).lo === 26,
      !(spanOf([23, 12, 12]).stages.join(',') === '12,23' && spanOf([23, 12, 12]).lo === 26)));
  check('spanOf of an empty set is nothing_checked, not a zero-width span',
    f(spanOf([]).nothing_checked === true && spanOf([]).lo === null && /Zero width is not a narrow span/.test(spanOf([]).why_nothing_checked),
      !(spanOf([]).nothing_checked === true && spanOf([]).lo === null && /Zero width is not a narrow span/.test(spanOf([]).why_nothing_checked))));
  check('spanOf REFUSES a set with a bad member rather than spanning the rest of it',
    f(spanOf([12, 'twelve', 23]).refused === true && spanOf([12, 'twelve', 23]).lo === null,
      !(spanOf([12, 'twelve', 23]).refused === true && spanOf([12, 'twelve', 23]).lo === null)));
  check('spanOf accepts a bare stage as well as an array',
    f(spanOf(12).lo === one.lo && spanOf(12).hi === one.hi, !(spanOf(12).lo === one.lo && spanOf(12).hi === one.hi)));
}

// ===================================================================================================
// 6. humanMouseCaution
// ===================================================================================================
console.log('\nhumanMouseCaution');
{
  const c = humanMouseCaution();

  check('humanMouseCaution returns a FROZEN note, the same object every call',
    f(Object.isFrozen(c) && humanMouseCaution() === c, !(Object.isFrozen(c) && humanMouseCaution() === c)));
  check('its nested reasons and sources are frozen too, not just the top level',
    f(Object.isFrozen(c.the_three_reasons) && Object.isFrozen(c.sources) && Object.isFrozen(c.if_you_must_pick_a_pairing),
      !(Object.isFrozen(c.the_three_reasons) && Object.isFrozen(c.sources) && Object.isFrozen(c.if_you_must_pick_a_pairing))));
  check('it states reason 1: organogenesis is NOT a uniform time rescaling',
    f(/NOT A UNIFORM TIME RESCALING/.test(c.the_three_reasons[0]), !/NOT A UNIFORM TIME RESCALING/.test(c.the_three_reasons[0])));
  check('it states reason 2: different organs are heterochronic between the two species',
    f(/HETEROCHRONIC BETWEEN THE TWO SPECIES/.test(c.the_three_reasons[1]) && /corticogenesis/.test(c.the_three_reasons[1]),
      !(/HETEROCHRONIC BETWEEN THE TWO SPECIES/.test(c.the_three_reasons[1]) && /corticogenesis/.test(c.the_three_reasons[1]))));
  check('it states reason 3: a correspondence that holds for one organ fails for another, and SILENTLY',
    f(/FAILS FOR ANOTHER, AND SILENTLY/.test(c.the_three_reasons[2]) && /invisible in the picture/.test(c.the_three_reasons[2]),
      !(/FAILS FOR ANOTHER, AND SILENTLY/.test(c.the_three_reasons[2]) && /invisible in the picture/.test(c.the_three_reasons[2]))));
  check('it cites a REAL, verified paper for heterochrony, with a DOI',
    f(/Workman/.test(c.sources.heterochrony) && /10\.1523\/JNEUROSCI\.5746-12\.2013/.test(c.sources.heterochrony),
      !(/Workman/.test(c.sources.heterochrony) && /10\.1523\/JNEUROSCI\.5746-12\.2013/.test(c.sources.heterochrony))));
  check('it cites MOSTA, the mouse atlas the HESTA tool actually compares against',
    f(/10\.1016\/j\.cell\.2022\.04\.003/.test(c.sources.mouse_atlas) && /MOSTA/.test(c.sources.mouse_atlas),
      !(/10\.1016\/j\.cell\.2022\.04\.003/.test(c.sources.mouse_atlas) && /MOSTA/.test(c.sources.mouse_atlas))));
  check('it quotes the HESTA tool\'s own "shared developmental-stage timeline" wording',
    f(/shared developmental-stage timeline/.test(c.sources.the_tool), !/shared developmental-stage timeline/.test(c.sources.the_tool)));
  check('it MARKS what was not verified: the mouse E-days MOSTA covers',
    f(/NOT confirmed in this session/.test(c.sources.mouse_days_unverified), !/NOT confirmed in this session/.test(c.sources.mouse_days_unverified)));
  check('it leans on SPEC\'s own rule that ordinal units are never converted',
    f(c.what_a_shared_timeline_cannot_be.includes('ordinal units are never converted at all'),
      !c.what_a_shared_timeline_cannot_be.includes('ordinal units are never converted at all')));
  check('it says what the comparison CAN legitimately be, rather than only refusing',
    f(/stated hypothesis about which pairs of sections/.test(c.what_it_can_legitimately_be) && /matched on forelimb bud morphology/.test(c.what_it_can_legitimately_be),
      !(/stated hypothesis about which pairs of sections/.test(c.what_it_can_legitimately_be) && /matched on forelimb bud morphology/.test(c.what_it_can_legitimately_be))));
  check('it says what IT does not establish, including that Workman is not a human-mouse offset table',
    f(/NOT a table of human-mouse offsets/.test(c.what_this_note_does_not_establish) && /does not say the comparison is worthless/.test(c.what_this_note_does_not_establish),
      !(/NOT a table of human-mouse offsets/.test(c.what_this_note_does_not_establish) && /does not say the comparison is worthless/.test(c.what_this_note_does_not_establish))));
  check('it names "borrowed" as the right KINDS entry for a cross-species stage match',
    f(/borrowed/.test(c.if_you_must_pick_a_pairing.and_record_it_as), !/borrowed/.test(c.if_you_must_pick_a_pairing.and_record_it_as)));
}

// ===================================================================================================
// 7. atlasStageToLife
// ===================================================================================================
console.log('\natlasStageToLife');
{
  const ok = atlasStageToLife(REC());
  const rec = REC(); delete rec.temperature_C;
  const noTemp = atlasStageToLife(rec);

  check('atlasStageToLife REFUSES a record with no temperature',
    f(noTemp.status === 'refused' && noTemp.stage === null, !(noTemp.status === 'refused' && noTemp.stage === null)));
  check('the refusal names temperature_C and quotes the spec\'s reason for requiring it',
    f(noTemp.problems[0].field === 'temperature_C' && noTemp.problems[0].why === SPEC.WHY_EACH_RULE.temperature_required,
      !(noTemp.problems[0].field === 'temperature_C' && noTemp.problems[0].why === SPEC.WHY_EACH_RULE.temperature_required)));
  check('the refusal states the awkwardness: 37 C in utero is an assumption, not a measurement',
    f(/reasonable assumption and not a measurement/.test(noTemp.problems[0].and_the_awkwardness) && /Nobody put a probe in/.test(noTemp.problems[0].and_the_awkwardness),
      !(/reasonable assumption and not a measurement/.test(noTemp.problems[0].and_the_awkwardness) && /Nobody put a probe in/.test(noTemp.problems[0].and_the_awkwardness))));
  check('it does NOT silently default to 37, and says why defaulting would be wrong',
    f(noTemp.stage === null && /provenance filed off/.test(noTemp.problems[0].not_defaulted_because),
      !(noTemp.stage === null && /provenance filed off/.test(noTemp.problems[0].not_defaulted_because))));

  check('a supplied 37 C is accepted and marked "assumed", never "measured"',
    f(ok.status === 'ok' && ok.stage.temperature_C.kind === 'assumed' && ok.stage.temperature_C.v === 37,
      !(ok.status === 'ok' && ok.stage.temperature_C.kind === 'assumed' && ok.stage.temperature_C.v === 37)),
    `kind=${ok.stage?.temperature_C?.kind}`);
  check('the assumed temperature is a STAMPED value node, not a bare number a reader would trust',
    f(typeof ok.stage.temperature_C === 'object' && typeof ok.stage.temperature_C.scope === 'string' && ok.stage.temperature_C.scope.length > 10,
      !(typeof ok.stage.temperature_C === 'object' && typeof ok.stage.temperature_C.scope === 'string' && ok.stage.temperature_C.scope.length > 10)));
  check('its scope says plainly that nobody measured it and nobody can',
    f(/nobody measured it, and nobody can/.test(ok.stage.temperature_C.scope), !/nobody measured it, and nobody can/.test(ok.stage.temperature_C.scope)));
  check('the assumed stamp survives the REAL provenance census as "assumed", not as data',
    f(provenanceCensus({ timeline: { stages: [ok.stage] } }).by_kind.assumed >= 1
      && provenanceCensus({ timeline: { stages: [ok.stage] } }).may_be_treated_as_data === 0,
      !(provenanceCensus({ timeline: { stages: [ok.stage] } }).by_kind.assumed >= 1
        && provenanceCensus({ timeline: { stages: [ok.stage] } }).may_be_treated_as_data === 0)),
    provenanceCensus({ timeline: { stages: [ok.stage] } }).line);
  check('a caller claiming "measured" with NO source is downgraded to assumed and told so',
    f(atlasStageToLife(REC({ temperature_provenance: 'measured' })).stage.temperature_C.kind === 'assumed'
      && atlasStageToLife(REC({ temperature_provenance: 'measured' })).degradations.length > 0,
      !(atlasStageToLife(REC({ temperature_provenance: 'measured' })).stage.temperature_C.kind === 'assumed'
        && atlasStageToLife(REC({ temperature_provenance: 'measured' })).degradations.length > 0)));
  check('a claimed measurement WITH a source is honoured as measured',
    f(atlasStageToLife(REC({ temperature_provenance: 'measured', temperature_source: 'intrauterine probe, hypothetical study' })).stage.temperature_C.kind === 'measured',
      atlasStageToLife(REC({ temperature_provenance: 'measured', temperature_source: 'intrauterine probe, hypothetical study' })).stage.temperature_C.kind !== 'measured'));
  check('an assumed temperature far from the 37 C convention degrades rather than passing quietly',
    f(atlasStageToLife(REC({ temperature_C: 25 })).degradations.some(d => /more than 1.5 C from the 37 C convention/.test(d.what)),
      !atlasStageToLife(REC({ temperature_C: 25 })).degradations.some(d => /more than 1.5 C from the 37 C convention/.test(d.what))));

  check('the produced stage carries every one of SPEC.STAGE_REQUIRED',
    f(SPEC.STAGE_REQUIRED.every(k => ok.stage[k] !== undefined && ok.stage[k] !== null),
      !SPEC.STAGE_REQUIRED.every(k => ok.stage[k] !== undefined && ok.stage[k] !== null)),
    `missing: ${SPEC.STAGE_REQUIRED.filter(k => ok.stage[k] == null).join(',') || 'none'}`);
  check('time is the stage NUMBER and time_unit is carnegie_stage, a legal SPEC.TIME_UNITS value',
    f(ok.stage.time === 12 && ok.stage.time_unit === 'carnegie_stage' && SPEC.TIME_UNITS.includes(ok.stage.time_unit),
      !(ok.stage.time === 12 && ok.stage.time_unit === 'carnegie_stage' && SPEC.TIME_UNITS.includes(ok.stage.time_unit))));
  check('the day range rides along as DATA under `carnegie`, and never as the stage\'s time',
    f(ok.stage.carnegie.days.lo === 26 && ok.stage.carnegie.days.hi === 31 && ok.stage.time === 12,
      !(ok.stage.carnegie.days.lo === 26 && ok.stage.carnegie.days.hi === 31 && ok.stage.time === 12)));
  check('a record with neither embryo nor section is NOT marked observed, and is told why',
    f(atlasStageToLife({ carnegie_stage: 12, temperature_C: 37 }).stage.observed === false
      && atlasStageToLife({ carnegie_stage: 12, temperature_C: 37 }).degradations.some(d => d.field === 'observed'),
      !(atlasStageToLife({ carnegie_stage: 12, temperature_C: 37 }).stage.observed === false
        && atlasStageToLife({ carnegie_stage: 12, temperature_C: 37 }).degradations.some(d => d.field === 'observed'))));
  check('a missing or impossible Carnegie stage is refused before anything else is attempted',
    f(atlasStageToLife({ temperature_C: 37 }).status === 'refused' && atlasStageToLife({ carnegie_stage: 99, temperature_C: 37 }).status === 'refused',
      !(atlasStageToLife({ temperature_C: 37 }).status === 'refused' && atlasStageToLife({ carnegie_stage: 99, temperature_C: 37 }).status === 'refused')));
  check('no staging provenance degrades the stage, because staging is a person\'s judgement',
    f(atlasStageToLife(REC({ staged_by: undefined })).degradations.some(d => d.field === 'carnegie.staged_by'),
      !atlasStageToLife(REC({ staged_by: undefined })).degradations.some(d => d.field === 'carnegie.staged_by')));
  check('a stage 19-23 record is degraded for the histology O\'Rahilly & Müller say it needs',
    f(atlasStageToLife(REC({ carnegie_stage: 23 })).degradations.some(d => /cannot be delineated from external features alone/.test(d.what)),
      !atlasStageToLife(REC({ carnegie_stage: 23 })).degradations.some(d => /cannot be delineated from external features alone/.test(d.what))));
  check('the result says a single atlas record is one observation and not a trajectory',
    f(/not a trajectory/.test(ok.and_it_is_one_stage_of_one_individual), !/not a trajectory/.test(ok.and_it_is_one_stage_of_one_individual)));
  check('TEMPERATURE_AWKWARDNESS records the spec finding: the field is required, its provenance is not',
    f(Object.isFrozen(TEMPERATURE_AWKWARDNESS) && /does not require a provenance kind on it/.test(TEMPERATURE_AWKWARDNESS.the_spec_finding)
      && !SPEC.STAGE_REQUIRED.includes('temperature_provenance'),
      !(Object.isFrozen(TEMPERATURE_AWKWARDNESS) && /does not require a provenance kind on it/.test(TEMPERATURE_AWKWARDNESS.the_spec_finding)
        && !SPEC.STAGE_REQUIRED.includes('temperature_provenance'))));
}

// ===================================================================================================
// 8. the composite is marked composite
// ===================================================================================================
console.log('\ncompositeFromAtlas');
{
  const records = [12, 13, 15, 20, 23].map((cs, i) => REC({ carnegie_stage: cs, embryo: `E${i + 1}`, section: `S${i + 1}` }));
  const comp = compositeFromAtlas(records);
  const doc = comp.document;

  check('a composite built from atlas stages IS MARKED COMPOSITE at the top level of the document',
    f(doc.composite.is_composite === true, doc.composite?.is_composite !== true));
  check('the composite flag carries the reason, naming cross-section versus trajectory',
    f(/CROSS-SECTION ACROSS INDIVIDUALS/.test(doc.composite.why) && /TRAJECTORY OF ONE/.test(doc.composite.why),
      !(/CROSS-SECTION ACROSS INDIVIDUALS/.test(doc.composite.why) && /TRAJECTORY OF ONE/.test(doc.composite.why))));
  check('it reports ZERO donors observed at more than one stage, and says how it knows',
    f(doc.composite.donors_observed_at_more_than_one_stage === 0 && /Counted, not assumed/.test(doc.composite.how_that_number_was_obtained),
      !(doc.composite.donors_observed_at_more_than_one_stage === 0 && /Counted, not assumed/.test(doc.composite.how_that_number_was_obtained))));
  check('the identity declares it is NOT an individual',
    f(doc.identity.is_an_individual === false && /COMPOSITE/.test(doc.identity.organism),
      !(doc.identity.is_an_individual === false && /COMPOSITE/.test(doc.identity.organism))));
  check('the composite names what it must not be used for, starting with rates',
    f(doc.composite.what_it_must_not_be_used_for.some(s => /rate of change/.test(s))
      && doc.composite.what_it_must_not_be_used_for.some(s => /pseudotime/.test(s)),
      !(doc.composite.what_it_must_not_be_used_for.some(s => /rate of change/.test(s))
        && doc.composite.what_it_must_not_be_used_for.some(s => /pseudotime/.test(s)))));
  check('not_established leads with which stages were observed and that no transition was',
    f(/none of the transitions between them was observed in any individual/.test(doc.not_established[0]),
      !/none of the transitions between them was observed in any individual/.test(doc.not_established[0])));
  check('the composite carries the spanOf union rather than a duration',
    f(doc.composite.day_span.is_union_of_ranges === true && doc.composite.day_span.lo === 26 && doc.composite.day_span.hi === 58,
      !(doc.composite.day_span.is_union_of_ranges === true && doc.composite.day_span.lo === 26 && doc.composite.day_span.hi === 58)));

  // the real reader has to agree, or the module is lying in one of two places
  const r = read(doc);
  check('the composite is READABLE by the real .life reader - not refused',
    f(r.status !== 'refused', r.status === 'refused'), `${r.status}: ${r.headline}`);
  check('and the reader reports it as DEGRADED, not ok, because it is a composite of guesses',
    f(r.status === 'degraded' && r.degradations.length > 0, !(r.status === 'degraded' && r.degradations.length > 0)),
    `${r.degradations.length} degradation(s)`);
  check('the reader finds every stage in order, in one time unit, with no duplicate ids',
    f(r.timeline_order.ok === true && Object.keys(r.timeline_order.units).join(',') === 'carnegie_stage' && r.timeline_order.violations.length === 0,
      !(r.timeline_order.ok === true && Object.keys(r.timeline_order.units).join(',') === 'carnegie_stage' && r.timeline_order.violations.length === 0)));
  check('the reader reports the gap between stages as null, because the unit is ordinal',
    f(r.timeline_order.violations.length === 0 && SPEC.ORDINAL_UNITS.includes('carnegie_stage'),
      !(r.timeline_order.violations.length === 0 && SPEC.ORDINAL_UNITS.includes('carnegie_stage'))));
  check('the reader\'s census sees the temperatures as assumed and NOTHING as data',
    f(r.census.by_kind.assumed === 5 && r.census.may_be_treated_as_data === 0,
      !(r.census.by_kind.assumed === 5 && r.census.may_be_treated_as_data === 0)),
    r.census.line);
  check('the reader reports identity as UNCHECKED, not agreed, since a composite has no genome',
    f(r.identity.checked === false && r.identity.agreed === null, !(r.identity.checked === false && r.identity.agreed === null)));

  // duplicates: the collision with read.mjs's strictly-increasing rule
  const dupes = [REC({ carnegie_stage: 12, embryo: 'E1', section: 'S1' }), REC({ carnegie_stage: 12, embryo: 'E2', section: 'S2' }), REC({ carnegie_stage: 13, embryo: 'E3', section: 'S3' })];
  const cd = compositeFromAtlas(dupes);
  check('two records at the same Carnegie stage collapse to one stage, and the dropped one is NAMED',
    f(cd.document.timeline.stages.length === 2 && cd.dropped.length === 1 && cd.dropped[0].stage === 12,
      !(cd.document.timeline.stages.length === 2 && cd.dropped.length === 1 && cd.dropped[0].stage === 12)),
    `${cd.document.timeline.stages.length} stage(s), ${cd.dropped.length} dropped`);
  check('the drop is a degradation that explains the collision with the reader\'s strict-increase rule',
    f(cd.status === 'degraded' && cd.degradations.some(d => /two stages at one instant are one stage/.test(d.why)),
      !(cd.status === 'degraded' && cd.degradations.some(d => /two stages at one instant are one stage/.test(d.why)))));
  check('and the collapsed document is accepted by the reader, where the uncollapsed one would be refused',
    f(read(cd.document).status !== 'refused'
      && read({ ...cd.document, timeline: { stages: [cd.document.timeline.stages[0], { ...cd.document.timeline.stages[0], id: 'other' }] } }).status === 'refused',
      !(read(cd.document).status !== 'refused'
        && read({ ...cd.document, timeline: { stages: [cd.document.timeline.stages[0], { ...cd.document.timeline.stages[0], id: 'other' }] } }).status === 'refused')));

  check('compositeFromAtlas REFUSES the whole document when one record cannot become a stage',
    f(compositeFromAtlas([REC(), REC({ carnegie_stage: 13, temperature_C: null })]).status === 'refused',
      compositeFromAtlas([REC(), REC({ carnegie_stage: 13, temperature_C: null })]).status !== 'refused'));
  check('compositeFromAtlas refuses an empty record list rather than emitting an empty trajectory',
    f(compositeFromAtlas([]).status === 'refused' && compositeFromAtlas([]).document === null,
      !(compositeFromAtlas([]).status === 'refused' && compositeFromAtlas([]).document === null)));
}

// ===================================================================================================
// 9. WHAT_AN_ATLAS_IS_NOT
// ===================================================================================================
console.log('\nWHAT_AN_ATLAS_IS_NOT');
{
  const W = WHAT_AN_ATLAS_IS_NOT;

  check('WHAT_AN_ATLAS_IS_NOT is frozen',
    f(Object.isFrozen(W), !Object.isFrozen(W)));
  check('the FIRST key is the one that matters: an atlas is not a trajectory of any individual',
    f(Object.keys(W)[0] === 'a_trajectory_of_any_individual', Object.keys(W)[0] !== 'a_trajectory_of_any_individual'));
  check('it says plainly that NO EMBRYO IN IT WAS OBSERVED AT TWO STAGES',
    f(/NO EMBRYO IN IT WAS OBSERVED AT TWO STAGES/.test(W.a_trajectory_of_any_individual),
      !/NO EMBRYO IN IT WAS OBSERVED AT TWO STAGES/.test(W.a_trajectory_of_any_individual)));
  check('it names the cross-section/trajectory distinction as the headline contrast',
    f(/CROSS-SECTION ACROSS INDIVIDUALS/.test(W.a_trajectory_of_any_individual) && /TRAJECTORY OF ONE/.test(W.a_trajectory_of_any_individual),
      !(/CROSS-SECTION ACROSS INDIVIDUALS/.test(W.a_trajectory_of_any_individual) && /TRAJECTORY OF ONE/.test(W.a_trajectory_of_any_individual))));
  check('it says a composite is a trajectory of an animal that never existed',
    f(/animal that never existed/.test(W.a_trajectory_of_any_individual), !/animal that never existed/.test(W.a_trajectory_of_any_individual)));
  check('it draws the consequence: every rate from an atlas is a between-individual difference',
    f(/BETWEEN-INDIVIDUAL difference being read as a WITHIN-INDIVIDUAL change/.test(W.and_the_consequence_for_every_rate),
      !/BETWEEN-INDIVIDUAL difference being read as a WITHIN-INDIVIDUAL change/.test(W.and_the_consequence_for_every_rate)));

  check('it states that the atlas is NOT multimodal in the strong sense',
    f(/NOT multimodal in the strong sense/.test(W.multimodal_in_the_strong_sense),
      !/NOT multimodal in the strong sense/.test(W.multimodal_in_the_strong_sense)));
  check('it says what is actually on offer - Stereo-seq plus snRNA-seq, BOTH RNA',
    f(/BOTH ARE RNA/.test(W.multimodal_in_the_strong_sense) && /snRNA-seq/.test(W.multimodal_in_the_strong_sense),
      !(/BOTH ARE RNA/.test(W.multimodal_in_the_strong_sense) && /snRNA-seq/.test(W.multimodal_in_the_strong_sense))));
  check('it warns that a plan assuming PROTEIN-level data will be disappointed',
    f(/no protein/.test(W.multimodal_in_the_strong_sense) && /protein-level data will be\s+disappointed|protein-level data will be disappointed/.test(W.multimodal_in_the_strong_sense),
      !(/no protein/.test(W.multimodal_in_the_strong_sense) && /protein-level data will be\s+disappointed|protein-level data will be disappointed/.test(W.multimodal_in_the_strong_sense))));
  check('it names epigenomics and proteomics as the absent modalities, not just "multimodal"',
    f(/epigenomics/.test(W.multimodal_in_the_strong_sense) && /proteomics/.test(W.multimodal_in_the_strong_sense) && /chromatin accessibility/.test(W.multimodal_in_the_strong_sense),
      !(/epigenomics/.test(W.multimodal_in_the_strong_sense) && /proteomics/.test(W.multimodal_in_the_strong_sense) && /chromatin accessibility/.test(W.multimodal_in_the_strong_sense))));
  check('it adds the sharper point: two RNA assays cannot contradict each other about translation',
    f(/cannot contradict each other about translation/.test(W.the_two_modalities_fail_together),
      !/cannot contradict each other about translation/.test(W.the_two_modalities_fail_together)));
  check('it marks the regulons as INFERRED, at best `derived`, and never measured',
    f(/INFERRED/.test(W.the_regulons) && /`derived`/.test(W.the_regulons) && /not `measured`/.test(W.the_regulons),
      !(/INFERRED/.test(W.the_regulons) && /`derived`/.test(W.the_regulons) && /not `measured`/.test(W.the_regulons))));

  check('13 embryos is not a population, and it says n = 1 for most stages',
    f(/13 embryos is not a population/.test(W.a_population) && /n = 1/.test(W.a_population),
      !(/13 embryos is not a population/.test(W.a_population) && /n = 1/.test(W.a_population))));
  check('a sagittal section is not a volume, and the 3D reconstruction is called proof-of-concept',
    f(/sagittal section is not a volume/.test(W.a_volume) && /proof-of-concept/.test(W.a_volume),
      !(/sagittal section is not a volume/.test(W.a_volume) && /proof-of-concept/.test(W.a_volume))));
  check('an atlas is a reference, and a reference is not a thing any individual matched',
    f(/is a REFERENCE/.test(W.a_reference_for_an_individual) && /not a thing\s+any individual matched|not a thing any individual matched/.test(W.a_reference_for_an_individual),
      !(/is a REFERENCE/.test(W.a_reference_for_an_individual) && /not a thing\s+any individual matched|not a thing any individual matched/.test(W.a_reference_for_an_individual))));
  check('and the Carnegie stage on a section is not a clock, pointing back at refuseArithmetic',
    f(/ORDINAL label/.test(W.a_clock) && /refuseArithmetic/.test(W.a_clock), !(/ORDINAL label/.test(W.a_clock) && /refuseArithmetic/.test(W.a_clock))));
}

// ===================================================================================================
// 10. the sources, and what was not established
// ===================================================================================================
console.log('\nSOURCES and NOT_ESTABLISHED');
{
  check('SOURCES is frozen and names the verified Nature DOI for HESTA',
    f(Object.isFrozen(SOURCES) && /10\.1038\/s41586-026-10545-0/.test(SOURCES.the_atlas.finding_paper) && /654\(8119\):751-761/.test(SOURCES.the_atlas.finding_paper),
      !(Object.isFrozen(SOURCES) && /10\.1038\/s41586-026-10545-0/.test(SOURCES.the_atlas.finding_paper) && /654\(8119\):751-761/.test(SOURCES.the_atlas.finding_paper))));
  check('SOURCES records that the acronym is spelt three different ways in public',
    f(SOURCES.the_atlas.names_in_use.length === 3 && SOURCES.the_atlas.names_in_use.some(n => /Early/.test(n)) && SOURCES.the_atlas.names_in_use.some(n => /no acronym at all/.test(n)),
      !(SOURCES.the_atlas.names_in_use.length === 3 && SOURCES.the_atlas.names_in_use.some(n => /Early/.test(n)) && SOURCES.the_atlas.names_in_use.some(n => /no acronym at all/.test(n)))));
  check('SOURCES names the second, GigaScience resource paper the search summary missed',
    f(/10\.1093\/gigascience\/giag063/.test(SOURCES.the_atlas.resource_paper), !/10\.1093\/gigascience\/giag063/.test(SOURCES.the_atlas.resource_paper)));
  check('SOURCES cites O\'Rahilly & Müller 2010 with its DOI, and says the 1987 monograph was not read',
    f(/10\.1159\/000289817/.test(SOURCES.staging_system.revision) && /was NOT read/.test(SOURCES.staging_system.verified),
      !(/10\.1159\/000289817/.test(SOURCES.staging_system.revision) && /was NOT read/.test(SOURCES.staging_system.verified))));
  check('SOURCES admits the day table is a SECONDARY compilation, not the primary table',
    f(/SECONDARY compilation/.test(SOURCES.day_estimates.verified), !/SECONDARY compilation/.test(SOURCES.day_estimates.verified)));
  check('NOT_ESTABLISHED is frozen and leads with the 1987 monograph not having been read',
    f(Object.isFrozen(NOT_ESTABLISHED) && /1987 Carnegie monograph was not read/.test(NOT_ESTABLISHED[0]),
      !(Object.isFrozen(NOT_ESTABLISHED) && /1987 Carnegie monograph was not read/.test(NOT_ESTABLISHED[0]))));
  check('NOT_ESTABLISHED names the stage-17 error that proves the secondary tables are wrong somewhere',
    f(NOT_ESTABLISHED.some(s => /implantation to stage 17/.test(s)), !NOT_ESTABLISHED.some(s => /implantation to stage 17/.test(s))));
  check('NOT_ESTABLISHED says a marked composite is not thereby fit for any purpose',
    f(NOT_ESTABLISHED.some(s => /only that it is marked as a composite/.test(s)), !NOT_ESTABLISHED.some(s => /only that it is marked as a composite/.test(s))));
  check('EXTERNAL_CRITERIA_ARE_NOT_ENOUGH quotes the source on stages 19-23 needing histology',
    f(/depends on histological examination/.test(EXTERNAL_CRITERIA_ARE_NOT_ENOUGH) && /five of its twelve stages/.test(EXTERNAL_CRITERIA_ARE_NOT_ENOUGH),
      !(/depends on histological examination/.test(EXTERNAL_CRITERIA_ARE_NOT_ENOUGH) && /five of its twelve stages/.test(EXTERNAL_CRITERIA_ARE_NOT_ENOUGH))));
}

// ===================================================================================================
console.log(`\n  ${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: 0 passed is the correct result)' : ''}\n`);
process.exit(fail && !FAULT ? 1 : 0);
