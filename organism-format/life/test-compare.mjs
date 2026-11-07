#!/usr/bin/env node
// Tests for life/compare.mjs.
//
//   node organism-format/life/test-compare.mjs [--fail-once]
//
// Most of these check that a comparison is REFUSED, because a distance function's failure mode is not a
// crash - it is a number. Every assertion is written as f(real, broken), and --fail-once swaps in the
// broken predicate: every line must then FAIL. A line that still says "ok" under its own injected fault
// asserts nothing about its subject and is not a test.

import {
  stageKey, stageTimeKey, alignTimelines, phenotypicDistance, geneticDistance, compare,
  neighbourJoiningReady, whyNoCombinedScore, WHAT_A_DISTANCE_HIDES, DEFAULT_EXCLUDED_KINDS,
} from './compare.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

// ---------------------------------------------------------------------------------------------------
// FIXTURES. Small, inline, and built by functions so that no test can mutate another's input.
// ---------------------------------------------------------------------------------------------------
const V = (v, kind = 'measured', unit = 'mm') => ({
  v, unit, kind,
  source: (kind === 'assumed' || kind === 'depicted') ? null : 'fixture: a measurement that exists for the test',
  scope: 'establishes this trait at this stage in this fixture and nothing beyond it',
});
const frame = (name, extra) => ({
  format: 'life/0.1.0',
  identity: { name },
  provenance: { written_by: 'test-compare.mjs' },
  not_established: ['that the organism exists', 'that it is viable'],
  ...extra,
});
const EDITS_A = [
  { chrom: 'chr1', start: 1000, end: 1000, ref: 'A', alt: 'G' },
  { chrom: '7', start: 55000, end: 55000, ref: 'C', alt: 'T' },
];

// A: two stages in hpf.
const lifeA = () => frame('fixture A', {
  genome: { representation: 'edit-list', assembly: 'GRCz11', edits: EDITS_A.map(e => ({ ...e })) },
  timeline: { stages: [
    { id: 'a24', name: 'prim-5', time: 24, time_unit: 'hpf', temperature_C: 28.5, traits: {
      body_length_mm: V(2.0), eye_diameter_mm: V(0.40), somite_count: V(18, 'measured', null) } },
    { id: 'a36', name: 'prim-15', time: 36, time_unit: 'hpf', temperature_C: 28.5, traits: {
      body_length_mm: V(2.6), eye_diameter_mm: V(0.52) } },
  ] },
});
// B: same assembly, one shared edit and one of its own; stages at 24 (pairs with A) and 48 (does not).
const lifeB = () => frame('fixture B', {
  genome: { representation: 'edit-list', assembly: 'GRCz11', edits: [
    { chrom: '1', start: 1000, end: 1000, ref: 'A', alt: 'g' },   // same edit, spelled differently
    { chrom: 'chr9', start: 2000, end: 2000, ref: 'T', alt: 'A' },
  ] },
  timeline: { stages: [
    { id: 'b24', name: 'prim-5', time: 24, time_unit: 'hpf', temperature_C: 28.5, traits: {
      body_length_mm: V(2.2), eye_diameter_mm: V(0.44), somite_count: V(19, 'measured', null) } },
    { id: 'b48', name: 'long-pec', time: 48, time_unit: 'hpf', temperature_C: 28.5, traits: {
      body_length_mm: V(3.1), eye_diameter_mm: V(0.60) } },
  ] },
});
// C: the same trajectory recorded in dpf instead of hpf.
const lifeC = () => frame('fixture C', {
  genome: { representation: 'edit-list', assembly: 'GRCz11', edits: EDITS_A.map(e => ({ ...e })) },
  timeline: { stages: [
    { id: 'c1', name: 'prim-5', time: 1, time_unit: 'dpf', temperature_C: 28.5, traits: {
      body_length_mm: V(2.1), eye_diameter_mm: V(0.41) } },
    { id: 'c2', name: 'long-pec', time: 2, time_unit: 'dpf', temperature_C: 28.5, traits: {
      body_length_mm: V(3.0), eye_diameter_mm: V(0.58) } },
  ] },
});
// D and E: an ordinal human staging against a duration.
const lifeD = () => frame('fixture D', {
  genome: { representation: 'edit-list', assembly: 'GRCh38', edits: [] },
  timeline: { stages: [
    { id: 'd12', name: 'Carnegie 12', time: 12, time_unit: 'carnegie_stage', temperature_C: 37, traits: {
      crown_rump_mm: V(4.0) } },
    { id: 'd14', name: 'Carnegie 14', time: 14, time_unit: 'carnegie_stage', temperature_C: 37, traits: {
      crown_rump_mm: V(6.5) } },
  ] },
});
const lifeE = () => frame('fixture E', {
  genome: { representation: 'edit-list', assembly: 'GRCh38', edits: [] },
  timeline: { stages: [
    { id: 'e6', name: 'week 6', time: 6, time_unit: 'weeks', temperature_C: 37, traits: {
      crown_rump_mm: V(4.2) } },
    { id: 'e7', name: 'week 7', time: 7, time_unit: 'weeks', temperature_C: 37, traits: {
      crown_rump_mm: V(6.8) } },
  ] },
});
// F: A's edits against a different assembly.
const lifeF = () => frame('fixture F', {
  genome: { representation: 'edit-list', assembly: 'GRCz10', edits: EDITS_A.map(e => ({ ...e })) },
  timeline: { stages: lifeA().timeline.stages },
});
// G: shares exactly ONE trait with A's 24 hpf stage.
const lifeG = () => frame('fixture G', {
  genome: { representation: 'edit-list', assembly: 'GRCz11', edits: [] },
  timeline: { stages: [
    { id: 'g24', name: 'prim-5', time: 24, time_unit: 'hpf', temperature_C: 28.5, traits: {
      body_length_mm: V(2.4), fin_span_mm: V(1.1) } },
  ] },
});

// ---------------------------------------------------------------------------------------------------
console.log('\nstage keys');
// ---------------------------------------------------------------------------------------------------
{
  const s1 = { id: 'x', name: 'prim-5', time: 24, time_unit: 'hpf', temperature_C: 28.5 };
  const s2 = { temperature_C: 28.5, time_unit: 'hpf', time: 24, name: 'a different name', id: 'y' };
  const s3 = { id: 'z', name: 'prim-5', time: 24, time_unit: 'dpf', temperature_C: 28.5 };
  const k1 = stageKey(s1), k2 = stageKey(s2), k3 = stageKey(s3);
  check('stageKey is order-independent and ignores name and id',
    f(k1 === k2, k1 !== k2), `${k1} vs ${k2}`);
  check('stageKey keeps the time unit, so 24 hpf and 24 dpf are different keys',
    f(k1 !== k3, k1 === k3), `${k1} vs ${k3}`);
  check('stageKey carries the temperature, because 24 hpf at 25 C is not 24 hpf at 33 C',
    f(stageKey({ ...s1, temperature_C: 33 }) !== k1 && /28\.5/.test(k1),
      stageKey({ ...s1, temperature_C: 33 }) === k1), k1);
  check('stageKey refuses a stage with no temperature, no time or no unit',
    f(stageKey({ time: 24, time_unit: 'hpf' }) === null
      && stageKey({ time: 24, temperature_C: 28.5 }) === null
      && stageKey({ time_unit: 'hpf', temperature_C: 28.5 }) === null,
      stageKey({ time: 24, time_unit: 'hpf' }) !== null));
  check('24 and 24.0 and "24" are one key, not three',
    f(stageTimeKey({ time: 24, time_unit: 'hpf' }) === stageTimeKey({ time: 24.0, time_unit: 'hpf' })
      && stageTimeKey({ time: '24', time_unit: 'hpf' }) === stageTimeKey({ time: 24, time_unit: 'hpf' }),
      stageTimeKey({ time: '24', time_unit: 'hpf' }) !== stageTimeKey({ time: 24, time_unit: 'hpf' })));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nalignment, and the cross-unit refusal');
// ---------------------------------------------------------------------------------------------------
{
  const al = alignTimelines(lifeA(), lifeB());
  check('two timelines in the same unit pair on time, and the unmatched stages are reported',
    f(al.pairs.length === 1 && al.pairs[0].a.id === 'a24' && al.pairs[0].b.id === 'b24'
      && al.unpaired_a.length === 1 && al.unpaired_b.length === 1 && al.refused.length === 0,
      !(al.pairs.length === 1 && al.unpaired_a.length === 1 && al.unpaired_b.length === 1)),
    `${al.pairs.length} pair(s), ${al.unpaired_a.length}/${al.unpaired_b.length} unpaired`);

  const mixed = alignTimelines(lifeA(), lifeC());
  const xr = mixed.refused.find(r => r.refusal === 'no_cross_unit_distance');
  check('hpf against dpf with no stated conversion is REFUSED, not converted',
    f(!!xr && xr.units.includes('hpf') && xr.units.includes('dpf') && xr.conversion_offered === false
      && mixed.pairs.length === 0,
      !(mixed.refused.length > 0) || mixed.pairs.length > 0),
    xr ? xr.why.slice(0, 60) : `no refusal; ${mixed.pairs.length} pair(s)`);
  check('the cross-unit refusal says what would resolve it instead of guessing 24',
    f(!!xr && /conversions:/.test(xr.what_would_resolve_it ?? ''),
      !xr || !/conversions:/.test(xr.what_would_resolve_it ?? '')));

  const converted = alignTimelines(lifeA(), lifeC(), {
    conversions: { 'hpf->dpf': { factor: 1 / 24, source: 'the definition of a day, stated here' } },
  });
  check('with a STATED conversion, hpf and dpf pair, and the pair records the conversion',
    f(converted.pairs.length === 1 && converted.refused.length === 0
      && converted.pairs[0].via_conversion?.direction === 'hpf->dpf',
      !(converted.pairs.length === 1 && converted.refused.length === 0)),
    `${converted.pairs.length} pair(s), ${converted.refused.length} refusal(s)`);
  check('a conversion stated in the other direction is inverted rather than ignored',
    f(alignTimelines(lifeA(), lifeC(), { conversions: { 'dpf->hpf': { factor: 24, source: 's' } } })
      .pairs.length === 1,
      alignTimelines(lifeA(), lifeC(), { conversions: { 'dpf->hpf': { factor: 24, source: 's' } } })
        .pairs.length !== 1));

  const ord = alignTimelines(lifeD(), lifeE(), {
    conversions: { 'carnegie_stage->weeks': { factor: 0.5, source: 'a table somebody published' } },
  });
  const orr = ord.refused.find(r => r.refusal === 'no_cross_unit_distance');
  check('carnegie_stage is REFUSED even WITH a conversion offered, and the offer is recorded as declined',
    f(!!orr && orr.ordinal_unit === 'carnegie_stage' && orr.conversion_offered === true
      && orr.conversion_declined === 'carnegie_stage->weeks' && ord.pairs.length === 0,
      !orr || ord.pairs.length > 0),
    orr ? `declined ${orr.conversion_declined}` : `no refusal; ${ord.pairs.length} pair(s)`);
  check('the ordinal refusal explains that there is no quantity for a factor to act on',
    f(!!orr && /is not 2 of anything/.test(orr.why), !orr || !/is not 2 of anything/.test(orr.why)));
  check('two ordinal timelines in the SAME unit still pair, because equality is not arithmetic',
    f(alignTimelines(lifeD(), lifeD()).pairs.length === 2
      && alignTimelines(lifeD(), lifeD()).refused.length === 0,
      alignTimelines(lifeD(), lifeD()).pairs.length !== 2));

  const warm = lifeB();
  warm.timeline.stages[0].temperature_C = 33;
  const hot = alignTimelines(lifeA(), warm);
  check('stages at the same hour and different temperatures still pair, and the pair carries the delta',
    f(hot.pairs.length === 1 && hot.pairs[0].temperature_delta_C === 4.5
      && hot.pairs[0].same_temperature === false && /not\s+similarity/.test(hot.pairs[0].caveat ?? ''),
      !(hot.pairs.length === 1 && hot.pairs[0].same_temperature === false)),
    `delta ${hot.pairs[0]?.temperature_delta_C} C`);

  const noTemp = lifeB();
  delete noTemp.timeline.stages[0].temperature_C;
  const nt = alignTimelines(lifeA(), noTemp);
  check('a stage with no temperature is unpaired with a reason, not silently matched',
    f(nt.pairs.length === 0 && nt.unpaired_b.some(u => /temperature_C/.test(u.why)),
      nt.pairs.length > 0 || !nt.unpaired_b.some(u => /temperature_C/.test(u.why))));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nphenotypic distance');
// ---------------------------------------------------------------------------------------------------
{
  const sa = lifeA().timeline.stages[0], sb = lifeB().timeline.stages[0];
  const self = phenotypicDistance(sa, lifeA().timeline.stages[0]);
  check('a stage against itself is distance exactly 0 over all three of its traits',
    f(self.distance === 0 && self.n_traits_used === 3, self.distance !== 0 || self.n_traits_used !== 3),
    `${self.distance} over ${self.n_traits_used}`);

  const ab = phenotypicDistance(sa, sb), ba = phenotypicDistance(sb, sa);
  check('phenotypic distance is symmetric: d(a,b) === d(b,a)',
    f(ab.distance === ba.distance && ab.distance > 0, ab.distance !== ba.distance),
    `${ab.distance} vs ${ba.distance}`);

  check('ratio-scale traits are compared in log space, so a doubling is the same difference at any size',
    f(Math.abs(phenotypicDistance({ traits: { x: V(2) } }, { traits: { x: V(4) } }).distance
      - phenotypicDistance({ traits: { x: V(20) } }, { traits: { x: V(40) } }).distance) < 1e-12,
      Math.abs(phenotypicDistance({ traits: { x: V(2) } }, { traits: { x: V(4) } }).distance
        - phenotypicDistance({ traits: { x: V(20) } }, { traits: { x: V(40) } }).distance) > 1e-12));

  // THE CONFOUND: two files that share one trait are compared on one trait, and n says so.
  const sparse = phenotypicDistance(lifeA().timeline.stages[0], lifeG().timeline.stages[0]);
  check('two organisms sharing only one trait report n_traits_used === 1, so the confound is visible',
    f(sparse.n_traits_used === 1 && sparse.traits_used[0] === 'body_length_mm'
      && sparse.n_excluded === 3 && sparse.excluded_because.every(e => e.why === 'present_in_only_one'),
      sparse.n_traits_used !== 1),
    `n_used=${sparse.n_traits_used}, n_excluded=${sparse.n_excluded}`);
  check('a sparse comparison carries a caveat naming n, not just a number',
    f(/\b1 of 4 trait/.test(sparse.caveat) && /n_traits_used/.test(sparse.caveat),
      !/n_traits_used/.test(sparse.caveat)), sparse.caveat.slice(0, 60));

  // ASSUMED and DEPICTED are excluded by default: a distance driven by two guesses compares the guessers.
  const ga = { traits: { body_length_mm: V(2.0), fin_span_mm: V(1.0, 'assumed') } };
  const gb = { traits: { body_length_mm: V(2.2), fin_span_mm: V(1.4, 'assumed') } };
  const guessy = phenotypicDistance(ga, gb);
  const ex = guessy.excluded_because.find(e => e.trait === 'fin_span_mm');
  check('an `assumed` value is excluded from the distance and counted in n_excluded',
    f(guessy.n_traits_used === 1 && guessy.n_excluded === 1 && !!ex && /assumed/.test(ex.why)
      && !guessy.kinds_used.includes('assumed'),
      guessy.n_traits_used !== 1 || guessy.n_excluded !== 1),
    ex ? ex.why : 'the guess was not excluded');
  check('the excluded-kind reason says WHY, not just which',
    f(!!ex && /comparison of the guessers/.test(ex.detail ?? ''),
      !ex || !/comparison of the guessers/.test(ex.detail ?? '')));
  check('`depicted` is excluded by default too, and both defaults are declared',
    f(phenotypicDistance({ traits: { x: V(1, 'depicted') } }, { traits: { x: V(2, 'depicted') } })
      .n_traits_used === 0 && DEFAULT_EXCLUDED_KINDS.includes('assumed')
      && DEFAULT_EXCLUDED_KINDS.includes('depicted'),
      phenotypicDistance({ traits: { x: V(1, 'depicted') } }, { traits: { x: V(2, 'depicted') } })
        .n_traits_used !== 0));
  check('including a guess is possible but must be asked for explicitly',
    f(phenotypicDistance(ga, gb, { exclude_kinds: [] }).n_traits_used === 2,
      phenotypicDistance(ga, gb, { exclude_kinds: [] }).n_traits_used !== 2));

  // A real .life stage spells its trait map `phenotype` (life/read.mjs, mouse-preimplantation.life);
  // a .organism stage spells it `traits`. Both are read, so a real file is not compared on nothing.
  const realShape = (v) => ({ id: 's', name: 'morula', time: 2.5, time_unit: 'E', temperature_C: 37,
    phenotype: { cell_count: V(v, 'measured-secondhand', 'cells') } });
  check('a stage that spells its trait map `phenotype` is compared, not read as having no traits',
    f(phenotypicDistance(realShape(8), realShape(16)).n_traits_used === 1
      && phenotypicDistance(realShape(8), realShape(8)).distance === 0
      && phenotypicDistance(realShape(8), { traits: { cell_count: V(16, 'measured', 'cells') } })
        .n_traits_used === 1,
      phenotypicDistance(realShape(8), realShape(16)).n_traits_used !== 1),
    `n_used=${phenotypicDistance(realShape(8), realShape(16)).n_traits_used}`);

  const none = phenotypicDistance({ traits: { only_mine: V(1) } }, { traits: { only_yours: V(2) } });
  check('no shared trait gives distance null, NOT 0, because nothing-compared is not identical',
    f(none.distance === null && none.n_traits_used === 0, none.distance !== null),
    `distance=${JSON.stringify(none.distance)}`);

  const ne = phenotypicDistance(
    { traits: { x: { v: null, unknown: true, kind: 'not-established', why: 'no source reports it', scope: 'nothing follows' } } },
    { traits: { x: V(2) } });
  check('a not-established value has no number to subtract and is excluded with that reason',
    f(ne.n_traits_used === 0 && ne.excluded_because[0].why === 'not-established',
      ne.n_traits_used !== 0));
  // Real .life files carry boolean and categorical traits (mouse-preimplantation.life writes
  // total_volume_conserved: true and utmm_coverage: "transcriptome only"). true is not 1 here.
  const cat = phenotypicDistance(
    { phenotype: { conserved: V(true, 'assumed', null), coverage: V('none', 'derived', null) } },
    { phenotype: { conserved: V(true, 'assumed', null), coverage: V('transcriptome only', 'derived', null) } });
  check('a boolean or categorical trait is excluded as non_numeric, not coerced to 1 and 0',
    f(cat.distance === null && cat.n_traits_used === 0
      && cat.excluded_because.some(e => e.trait === 'coverage' && e.why === 'non_numeric'),
      cat.distance !== null || cat.n_traits_used !== 0),
    JSON.stringify(cat.excluded_because.map(e => `${e.trait}:${e.why}`)));

  check('a bare number with no provenance kind is not a value and is excluded',
    f(phenotypicDistance({ traits: { x: 2 } }, { traits: { x: 3 } }).excluded_because[0].why === 'no_provenance_kind',
      phenotypicDistance({ traits: { x: 2 } }, { traits: { x: 3 } }).n_traits_used !== 0));
  check('the same trait in two different units is excluded rather than converted',
    f(phenotypicDistance({ traits: { x: V(2, 'measured', 'mm') } }, { traits: { x: V(2, 'measured', 'cm') } })
      .excluded_because[0].why === 'unit_mismatch',
      phenotypicDistance({ traits: { x: V(2, 'measured', 'mm') } }, { traits: { x: V(2, 'measured', 'cm') } })
        .n_traits_used !== 0));
  check('a zero on a ratio-scale trait is excluded and counted, not silently dropped',
    f(phenotypicDistance({ traits: { x: V(0) } }, { traits: { x: V(2) } }).excluded_because[0].why
      === 'non_positive_on_ratio_scale'
      && phenotypicDistance({ traits: { x: V(0) } }, { traits: { x: V(2) } }).n_excluded === 1,
      phenotypicDistance({ traits: { x: V(0) } }, { traits: { x: V(2) } }).n_excluded !== 1));
  check('an interval-scale trait can be declared, and is then differenced linearly',
    f(phenotypicDistance({ traits: { c: V(-1) } }, { traits: { c: V(2) } }, { scales: { c: 'interval' } })
      .distance === 3,
      phenotypicDistance({ traits: { c: V(-1) } }, { traits: { c: V(2) } }, { scales: { c: 'interval' } })
        .distance !== 3));
}

// ---------------------------------------------------------------------------------------------------
console.log('\ngenetic distance');
// ---------------------------------------------------------------------------------------------------
{
  const self = geneticDistance(lifeA(), lifeA());
  check('a genome against itself is distance exactly 0',
    f(self.distance === 0 && self.refused === false, self.distance !== 0), `${self.distance}`);

  const ab = geneticDistance(lifeA(), lifeB()), ba = geneticDistance(lifeB(), lifeA());
  check('genetic distance is the symmetric difference, and it is symmetric',
    f(ab.distance === 2 && ab.distance === ba.distance && ab.n_shared === 1,
      ab.distance !== ba.distance), `${ab.distance} / ${ba.distance}, ${ab.n_shared} shared`);
  check('chr1 and 1, and alt "g" and "G", are one edit and not two',
    f(ab.n_shared === 1 && ab.in_a_only.length === 1 && ab.in_b_only.length === 1,
      ab.n_shared !== 1), JSON.stringify(ab.in_a_only));

  const cross = geneticDistance(lifeA(), lifeF());
  check('two different reference assemblies are REFUSED for genetic distance',
    f(cross.refused === true && cross.refusal === 'different_reference_assembly' && cross.distance === null
      && cross.assembly_a === 'GRCz11' && cross.assembly_b === 'GRCz10',
      cross.refused !== true || cross.distance !== null),
    cross.refused ? cross.why.slice(0, 56) : `accepted, distance ${cross.distance}`);
  check('the assembly refusal explains that chr1:1000 is a different locus, and names a liftover',
    f(/different locus/.test(cross.why) && /lift/.test(cross.what_would_resolve_it ?? ''),
      !/different locus/.test(cross.why)));
  check('identical edits against different assemblies would otherwise score 0, which is the trap',
    f(cross.distance === null && geneticDistance(lifeA(), { genome: { ...lifeA().genome } }).distance === 0,
      cross.distance === 0));

  // A real .life writes the assembly under genome.reference.assembly (examples/mouse-preimplantation.life)
  // while life/read.mjs documents genome.assembly. Looking in one place only would refuse real files.
  const nested = { genome: { representation: 'reference-only',
    reference: { assembly: 'GRCz11', accession: 'GCF_000002035.6' }, edits: [] } };
  check('the assembly is found under genome.reference.assembly as well as genome.assembly',
    f(geneticDistance(nested, { genome: { assembly: 'GRCz11', edits: [] } }).refused === false
      && geneticDistance(nested, { genome: { assembly: 'GRCm39', edits: [] } }).refusal
        === 'different_reference_assembly',
      geneticDistance(nested, { genome: { assembly: 'GRCz11', edits: [] } }).refused !== false));

  const noAsm = lifeB(); delete noAsm.genome.assembly;
  check('an edit list with no named assembly is REFUSED: it is a list of edits to nothing',
    f(geneticDistance(lifeA(), noAsm).refusal === 'no_named_assembly',
      geneticDistance(lifeA(), noAsm).refused !== true));
  check('an edit with no chromosome or no start is not counted, and is warned about',
    f(geneticDistance(
      { genome: { assembly: 'x', edits: [{ start: 10, alt: 'A' }] } },
      { genome: { assembly: 'x', edits: [] } }).warnings.some(w => /no chromosome/.test(w.what)),
      !geneticDistance(
        { genome: { assembly: 'x', edits: [{ start: 10, alt: 'A' }] } },
        { genome: { assembly: 'x', edits: [] } }).warnings.some(w => /no chromosome/.test(w.what))));
  // The same error as a mismatched assembly, one base wide (spec COORDINATE_CONVENTIONS).
  const conv = geneticDistance(
    { genome: { assembly: 'x', coordinate_convention: '1-based-inclusive', edits: EDITS_A } },
    { genome: { assembly: 'x', coordinate_convention: '0-based-half-open', edits: EDITS_A } });
  check('two DECLARED and different coordinate conventions are REFUSED, not compared verbatim',
    f(conv.refused === true && conv.refusal === 'different_coordinate_convention' && conv.distance === null,
      conv.refused !== true || conv.distance !== null),
    conv.refused ? conv.why.slice(0, 56) : `accepted, distance ${conv.distance}`);
  check('an UNDECLARED coordinate convention cannot be refused, so every such comparison is warned',
    f(ab.warnings.some(w => /coordinate_convention/.test(w.what) && /nobody can see/.test(w.consequence))
      && /neither says/.test(WHAT_A_DISTANCE_HIDES.undeclared_coordinates),
      !ab.warnings.some(w => /coordinate_convention/.test(w.what))));

  check('a one-base substitution and a 10 kb knock-in are both distance 1, and the caveat says so',
    f(geneticDistance(
      { genome: { assembly: 'x', edits: [] } },
      { genome: { assembly: 'x', edits: [{ chrom: '1', start: 1, end: 10000, alt: 'A'.repeat(20) }] } }).distance
      === geneticDistance(
        { genome: { assembly: 'x', edits: [] } },
        { genome: { assembly: 'x', edits: [{ chrom: '1', start: 1, end: 1, alt: 'G' }] } }).distance
      && /10 kb knock-in as equal/.test(WHAT_A_DISTANCE_HIDES.edit_count),
      !/10 kb knock-in as equal/.test(WHAT_A_DISTANCE_HIDES.edit_count)));
}

// ---------------------------------------------------------------------------------------------------
console.log('\ncompare: two distances, never one');
// ---------------------------------------------------------------------------------------------------
{
  const self = compare(lifeA(), lifeA());
  check('a .life compared to ITSELF is distance exactly 0 on both axes',
    f(self.phenotypic.distance === 0 && self.genetic.distance === 0,
      self.phenotypic.distance !== 0 || self.genetic.distance !== 0),
    `phenotypic ${self.phenotypic.distance}, genetic ${self.genetic.distance}`);

  const ab = compare(lifeA(), lifeB()), ba = compare(lifeB(), lifeA());
  check('compare is symmetric on both axes',
    f(ab.phenotypic.distance === ba.phenotypic.distance && ab.genetic.distance === ba.genetic.distance
      && ab.phenotypic.distance > 0,
      ab.phenotypic.distance !== ba.phenotypic.distance || ab.genetic.distance !== ba.genetic.distance),
    `${ab.phenotypic.distance} / ${ab.genetic.distance}`);
  check('every distance compare returns carries its n_traits_used beside it',
    f(ab.phenotypic.n_traits_used === 3
      && ab.phenotypic.per_stage_pair.every(p => typeof p.n_traits_used === 'number'),
      ab.phenotypic.n_traits_used !== 3));

  // THE REFUSAL: no summed score anywhere in the result object.
  const sum = ab.phenotypic.distance + ab.genetic.distance;
  const COMBINING = /combin|total|sum|overall|score|composite|aggregate/i;
  const offenders = [];
  (function walk(node, path) {
    if (node === null || node === undefined) return;
    if (typeof node === 'function') return;
    if (typeof node === 'number') {
      if (Math.abs(node - sum) < 1e-12) offenders.push(`${path} = ${node} (the sum)`);
      return;
    }
    if (typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    for (const [k, v] of Object.entries(node)) {
      if (COMBINING.test(k) && typeof v === 'number') offenders.push(`${path}.${k} is a number`);
      walk(v, `${path}.${k}`);
    }
  })(ab, 'result');
  check('compare() exposes NO summed score anywhere in its result',
    f(offenders.length === 0, offenders.length > 0), offenders.join('; ') || `sum would have been ${sum}`);
  check('combined_distance is present and null, with the refusal beside it',
    f(ab.combined_distance === null && 'combined_distance' in ab
      && /never summed/.test(ab.why_no_combined_score),
      ab.combined_distance !== null || !('combined_distance' in ab)));
  check('the result explains why there is no combined score, and names the weights as the caller\'s job',
    f(/propagates|propagate/.test(ab.explainNoCombinedScore().why_it_matters_more_than_it_looks)
      && /supply the weights/.test(ab.explainNoCombinedScore().what_a_caller_must_do)
      && whyNoCombinedScore().refusal === 'no_single_number_distance',
      whyNoCombinedScore().refusal !== 'no_single_number_distance'));
  check('one number is available only on weights the caller supplies, and comes back with them attached',
    f(ab.combine({ phenotypic: 1, genetic: 0.1 }).value === ab.phenotypic.distance + 0.1 * ab.genetic.distance
      && ab.combine({ phenotypic: 1, genetic: 0.1 }).weights.genetic === 0.1,
      ab.combine({ phenotypic: 1, genetic: 0.1 }).value !== ab.phenotypic.distance + 0.1 * ab.genetic.distance));
  check('combine() with no weights is refused: a default weight is the invisible decision itself',
    f(ab.combine().refused === true && ab.combine({ phenotypic: 1 }).refused === true,
      ab.combine().refused !== true));
  check('a combined number is labelled a property of the weights, not of the organisms',
    f(/not a property of these two organisms/.test(ab.combine({ phenotypic: 1, genetic: 1 }).what_it_is_not)
      && ab.combine({ phenotypic: 1, genetic: 1 }).provenance.startsWith('assumed'),
      !ab.combine({ phenotypic: 1, genetic: 1 }).provenance.startsWith('assumed')));

  const mixed = compare(lifeA(), lifeC());
  check('compare carries the cross-unit refusal to the top level and returns no phenotypic distance',
    f(mixed.refused.some(r => r.refusal === 'no_cross_unit_distance') && mixed.phenotypic.distance === null,
      !mixed.refused.some(r => r.refusal === 'no_cross_unit_distance') || mixed.phenotypic.distance !== null),
    `${mixed.refused.length} refusal(s)`);
  check('compare carries the assembly refusal on the genetic axis without refusing the whole comparison',
    f(compare(lifeA(), lifeF()).genetic.refused === true
      && compare(lifeA(), lifeF()).refused.some(r => r.axis === 'genetic')
      && compare(lifeA(), lifeF()).phenotypic.distance === 0,
      compare(lifeA(), lifeF()).genetic.refused !== true));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nmatrix validation, the last gate before a tree');
// ---------------------------------------------------------------------------------------------------
{
  const good = [[0, 1, 2], [1, 0, 3], [2, 3, 0]];
  const r = neighbourJoiningReady(good);
  check('a square, symmetric, zero-diagonal matrix is ready',
    f(r.ready === true && r.problems.length === 0 && r.n === 3, r.ready !== true),
    JSON.stringify(r.problems).slice(0, 60));

  const asym = neighbourJoiningReady([[0, 1, 2], [1, 0, 3], [2.5, 3, 0]]);
  const a = asym.problems.find(p => p.problem === 'asymmetric');
  check('a non-symmetric matrix is caught, and the offending index PAIR is named',
    f(asym.ready === false && !!a && a.i === 0 && a.j === 2 && a.a_ij === 2 && a.a_ji === 2.5,
      asym.ready !== false || !a || a.i !== 0 || a.j !== 2),
    a ? `[${a.i}][${a.j}]: ${a.a_ij} vs ${a.a_ji}` : 'asymmetry not caught');
  check('the asymmetry problem explains that neighbour joining reads one triangle',
    f(!!a && /one triangle/.test(a.detail), !a || !/one triangle/.test(a.detail)));

  const diag = neighbourJoiningReady([[0, 1], [1, 0.5]]);
  const d = diag.problems.find(p => p.problem === 'nonzero_diagonal');
  check('a non-zero diagonal is caught and its index named',
    f(diag.ready === false && !!d && d.i === 1 && d.value === 0.5, !d || d.i !== 1));

  const nan = neighbourJoiningReady([[0, NaN], [NaN, 0]]);
  const nulls = neighbourJoiningReady([[0, 1], [null, 0]]);
  check('NaN and null entries are caught with their indices, because neither is a large distance',
    f(nan.problems.some(p => p.problem === 'not_a_number' && p.i === 0 && p.j === 1)
      && nulls.problems.some(p => p.problem === 'not_a_number' && p.i === 1 && p.j === 0)
      && nan.ready === false && nulls.ready === false,
      nan.ready !== false || nulls.ready !== false));

  const sq = neighbourJoiningReady([[0, 1], [1, 0], [0, 0]]);
  const s = sq.problems.find(p => p.problem === 'not_square');
  check('a non-square matrix is caught, with the row index and both lengths',
    f(sq.ready === false && !!s && s.i === 0 && s.row_length === 2 && s.expected === 3,
      !s || s.row_length !== 2));

  const neg = neighbourJoiningReady([[0, -1], [-1, 0]]);
  check('a negative distance is caught: it is a sign error upstream, not a short branch',
    f(neg.problems.some(p => p.problem === 'negative_distance' && p.i === 0 && p.j === 1),
      !neg.problems.some(p => p.problem === 'negative_distance')));

  check('an empty or non-matrix input is refused rather than treated as a tree of nothing',
    f(neighbourJoiningReady([]).ready === false && neighbourJoiningReady(null).ready === false
      && neighbourJoiningReady([]).problems[0].problem === 'not_a_matrix',
      neighbourJoiningReady([]).ready !== false));
  check('the validator says it is not a tree builder and names what it did NOT check',
    f(/tree search is downstream/.test(r.why_not_a_tree_builder)
      && r.not_checked.some(x => /four-point/.test(x)),
      !/tree search is downstream/.test(r.why_not_a_tree_builder)));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nwhat a distance hides');
// ---------------------------------------------------------------------------------------------------
{
  check('WHAT_A_DISTANCE_HIDES is frozen, so the honest notes cannot be edited out at runtime',
    f(Object.isFrozen(WHAT_A_DISTANCE_HIDES), !Object.isFrozen(WHAT_A_DISTANCE_HIDES)));
  check('it says a small distance at two different temperatures is not similarity',
    f(/different temperatures is not/.test(WHAT_A_DISTANCE_HIDES.different_temperatures),
      !/different temperatures is not/.test(WHAT_A_DISTANCE_HIDES.different_temperatures)));
  check('it says edit-count treats a substitution and a 10 kb knock-in as equal',
    f(/single-base substitution/.test(WHAT_A_DISTANCE_HIDES.edit_count)
      && /10 kb knock-in/.test(WHAT_A_DISTANCE_HIDES.edit_count),
      !/single-base substitution/.test(WHAT_A_DISTANCE_HIDES.edit_count)));
  check('it says a distance over mostly not-established traits is a statement about coverage',
    f(/not-established/.test(WHAT_A_DISTANCE_HIDES.coverage_masquerading_as_similarity)
      && /about coverage, not/.test(WHAT_A_DISTANCE_HIDES.coverage_masquerading_as_similarity),
      !/about coverage, not/.test(WHAT_A_DISTANCE_HIDES.coverage_masquerading_as_similarity)));
  check('compare() hands the notes to its caller rather than leaving them in the source',
    f(compare(lifeA(), lifeB()).what_this_hides === WHAT_A_DISTANCE_HIDES,
      compare(lifeA(), lifeB()).what_this_hides !== WHAT_A_DISTANCE_HIDES));
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(`--fail-once: every assertion above should read FAIL. ${pass} survived its own injected ` +
    `fault and assert nothing about their subject.`);
}
process.exit(fail && !FAULT ? 1 : 0);
