#!/usr/bin/env node
// Tests for analogues/analogy.mjs - the homology/analogy distinction and the refusals built on it.
//
//   node analogues/test-analogy.mjs [--fail-once]
//
// Four things are checked harder than the rest, because they are the four ways this module could do
// damage if it were wrong:
//
//   1. A ONE-TO-MANY ORTHOLOGUE REACHING THE FUNCTIONAL-EQUIVALENCE CLASS. That is the failure that ends
//      as a dead experiment, so it is tested against a synthetic pair carrying EVERY evidence kind at
//      once, rescue included. If maximal evidence can promote a one-to-many pair, the guard is decorative.
//   2. A CONVERGENT PAIR WITH ZERO ORTHOLOGY FALLING TO no-basis. If it does, the module cannot represent
//      the cases the design programme exists to find, and its usefulness is exactly inverted: it would be
//      most confident about the mappings that matter least.
//   3. "NO ORTHOLOGUE FOUND" BEING READ AS "NO FUNCTIONAL ANALOGUE EXISTS". The orthology negative is a
//      statement about ancestry; the conclusion is about function; and convergent analogues have no
//      orthology by construction, so the search cannot in principle see them.
//   4. A FUSED SCALAR APPEARING AS THE HEADLINE. One float gets read downstream as a probability, and the
//      weighting that produced it becomes invisible at the first function call.
//
// --fail-once injects one fault into every assertion by inverting its predicate. Every line must then
// FAIL. An assertion that survives its own inversion is asserting nothing about its subject.
//
// Every number in a synthetic pair below is ILLUSTRATIVE and is marked as such. No experimental result is
// asserted here that is not in analogy.mjs's CITATIONS.
import * as A from './analogy.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const RANK = ['no-support', 'weak', 'moderate', 'strong', 'directly-tested'];
const rank = l => RANK.indexOf(l);
const allKinds = (extra = {}) => Object.fromEntries(A.EVIDENCE_IDS.map(k => [k, { present: true, ...(extra[k] || {}) }]));

console.log(`\nanalogy: homology is ancestry, analogy is function${FAULT ? '   [--fail-once: every predicate inverted]' : ''}\n`);

// ====================================================================================================
// 1. THE EVIDENCE KINDS, AND THE ONE THAT TESTS FUNCTION
// ====================================================================================================
{
  check('EVIDENCE_KINDS is frozen',
    f(Object.isFrozen(A.EVIDENCE_KINDS) === true, Object.isFrozen(A.EVIDENCE_KINDS) !== true));
  check('all seven evidence kinds are present',
    f(A.EVIDENCE_IDS.length === 7, A.EVIDENCE_IDS.length !== 7), `${A.EVIDENCE_IDS.length}`);
  const missingText = A.EVIDENCE_IDS.filter(k => !A.EVIDENCE_KINDS[k].establishes || !A.EVIDENCE_KINDS[k].does_not_establish);
  check('every evidence kind states what it establishes AND what it does not',
    f(missingText.length === 0, missingText.length !== 0), missingText.join(', '));
  const direct = A.EVIDENCE_IDS.filter(k => A.EVIDENCE_KINDS[k].directly_tests_function === true);
  check('EXACTLY ONE evidence kind directly tests function',
    f(direct.length === 1, direct.length !== 1), `${direct.length}: ${direct.join(', ')}`);
  check('and that one is rescue / complementation',
    f(direct[0] === 'rescue', direct[0] !== 'rescue'), `${direct[0]}`);
  check('the other six are labelled as not testing function directly',
    f(A.EVIDENCE_IDS.filter(k => A.EVIDENCE_KINDS[k].directly_tests_function !== true).length === 6,
      A.EVIDENCE_IDS.filter(k => A.EVIDENCE_KINDS[k].directly_tests_function !== true).length !== 6));
  check('RESCUE_IS_THE_ONLY_DIRECT_TEST says so plainly and calls the rest correlates',
    f(/only one that directly tests function/i.test(A.RESCUE_IS_THE_ONLY_DIRECT_TEST.claim) && /correlates/i.test(A.RESCUE_IS_THE_ONLY_DIRECT_TEST.claim),
      !(/only one that directly tests function/i.test(A.RESCUE_IS_THE_ONLY_DIRECT_TEST.claim) && /correlates/i.test(A.RESCUE_IS_THE_ONLY_DIRECT_TEST.claim))));
  check('rescue is NOT sold as a blank cheque: its own limits are enumerated',
    f(A.RESCUE_IS_THE_ONLY_DIRECT_TEST.and_rescue_is_not_a_blank_cheque.length >= 4,
      !(A.RESCUE_IS_THE_ONLY_DIRECT_TEST.and_rescue_is_not_a_blank_cheque.length >= 4)));
  check('synteny is explicitly NO evidence about function, however good it is about ancestry',
    f(/function, at all/i.test(A.EVIDENCE_KINDS['synteny'].does_not_establish), !/function, at all/i.test(A.EVIDENCE_KINDS['synteny'].does_not_establish)));
  check('sequence orthology REQUIRES a homology type to be usable',
    f(typeof A.EVIDENCE_KINDS['sequence-orthology'].requires === 'string', typeof A.EVIDENCE_KINDS['sequence-orthology'].requires !== 'string'));
  check('synteny and bare orthology are excluded from the function-bearing set',
    f(!A.FUNCTION_BEARING.includes('synteny') && !A.FUNCTION_BEARING.includes('sequence-orthology'),
      A.FUNCTION_BEARING.includes('synteny') || A.FUNCTION_BEARING.includes('sequence-orthology')), A.FUNCTION_BEARING.join(', '));
}

// ====================================================================================================
// 2. A ONE-TO-MANY ORTHOLOGUE IS NEVER A FUNCTIONAL EQUIVALENT
// ====================================================================================================
// The central guard. It is tested against a synthetic pair holding EVERY evidence kind at once, rescue
// included, maximal identity - i.e. the best case anyone could ever bring. If evidence can buy the
// promotion, the guard is decorative and the module is worse than nothing, because it would be lending
// its vocabulary to the error it was written to stop.
{
  const maximal = {
    id: 'synthetic-one-to-many-maximal',
    a: { species: 'species A', name: 'geneX' }, b: { species: 'species B', name: 'geneY-copy1' },
    claim: 'functional-equivalence',
    note: 'SYNTHETIC. Every value illustrative; no experiment is being asserted. Its job is to be the strongest possible one-to-many case.',
    developmental_context: { difference_stated: true },
    databases_searched: ['r1', 'r2', 'r3', 'r4'],
    analogue_search: { performed: true },
    evidence: allKinds({ 'sequence-orthology': { homology_type: 'one-to-many', identity: 0.99, n_on_b_side: 2 } }),
  };
  const c = A.classify(maximal);
  check('a one-to-many pair with EVERY evidence kind present is still not a functional equivalent',
    f(c.functional_equivalent === false, c.functional_equivalent !== false), `functional_equivalent ${c.functional_equivalent}`);
  check('a one-to-many pair with rescue evidence does NOT reach the functional-equivalence class',
    f(!A.FUNCTIONAL_EQUIVALENCE_CLASSES.includes(c.class), A.FUNCTIONAL_EQUIVALENCE_CLASSES.includes(c.class)), `class ${c.class}`);
  check('it is classified one-to-many-ambiguous, naming the reason rather than quietly downgrading',
    f(c.class === 'one-to-many-ambiguous', c.class !== 'one-to-many-ambiguous'), `class ${c.class}`);
  check('and a refusal fires for it by name',
    f(c.refusals.some(r => r.id === 'one-to-many-is-not-equivalence'), !c.refusals.some(r => r.id === 'one-to-many-is-not-equivalence')),
    c.refusals.map(r => r.id).join(', '));
  check('the refusal states that it does not weaken as evidence accumulates',
    f(/does not weaken with more evidence/i.test(c.refusals.find(r => r.id === 'one-to-many-is-not-equivalence').and),
      !/does not weaken with more evidence/i.test(c.refusals.find(r => r.id === 'one-to-many-is-not-equivalence').and)));

  const manyToMany = { ...maximal, id: 'synthetic-many-to-many', evidence: allKinds({ 'sequence-orthology': { homology_type: 'many-to-many', identity: 0.95 } }) };
  check('many-to-many is treated the same way as one-to-many, not left as a gap in the guard',
    f(A.classify(manyToMany).functional_equivalent === false && A.classify(manyToMany).class === 'one-to-many-ambiguous',
      !(A.classify(manyToMany).functional_equivalent === false && A.classify(manyToMany).class === 'one-to-many-ambiguous')),
    A.classify(manyToMany).class);

  // An orthology claim with NO homology type is the commonest real input: a table row, no shape. It must
  // fall to the ambiguous side, because the ambiguous case is the one that fails at the bench.
  const untyped = { ...maximal, id: 'synthetic-untyped-orthology', evidence: { 'sequence-orthology': { present: true, identity: 0.95 }, 'rescue': { present: true } } };
  const u = A.classify(untyped);
  check('an orthology claim with NO homology type is treated as ambiguous, not as one-to-one',
    f(u.class === 'one-to-many-ambiguous' && u.functional_equivalent === false, !(u.class === 'one-to-many-ambiguous' && u.functional_equivalent === false)), `class ${u.class}`);
  check('every pair in worked() that is one-to-many is marked functional_equivalent: false',
    f(A.worked().rows.filter(r => r.class === 'one-to-many-ambiguous').every(r => r.functional_equivalent === false),
      !A.worked().rows.filter(r => r.class === 'one-to-many-ambiguous').every(r => r.functional_equivalent === false)));
  check('exactly one class in the whole scheme means functional equivalence, so there is one gate to guard',
    f(A.FUNCTIONAL_EQUIVALENCE_CLASSES.length === 1, A.FUNCTIONAL_EQUIVALENCE_CLASSES.length !== 1), A.FUNCTIONAL_EQUIVALENCE_CLASSES.join(', '));
}

// ====================================================================================================
// 3. A CONVERGENT PAIR WITH ZERO ORTHOLOGY MUST REACH A REAL CLASS
// ====================================================================================================
// If zero orthology forced no-basis, the module could not represent an insect wing against a vertebrate
// appendage, or two independently evolved antifreeze proteins - which are the cases a design programme
// cares about most, because "that lineage solved it by a route the host does not have" is the premise of
// borrowing at all.
{
  const convergent = {
    id: 'synthetic-convergent',
    a: { species: 'species A', name: 'structure P' }, b: { species: 'species B', name: 'structure Q' },
    claim: 'convergent-analogy',
    note: 'SYNTHETIC. Illustrative only.',
    developmental_context: { difference_stated: true },
    databases_searched: ['r1', 'r2', 'r3'],
    analogue_search: { performed: true },
    evidence: {
      'sequence-orthology': { present: false, homology_type: 'none' },
      'synteny': { present: false },
      'expression-domain': { present: true },
      'domain-architecture': { present: true },
      'lof-phenotype': { present: true },
      'rescue': { present: false },
      'positional-correspondence': { present: false },
    },
  };
  const c = A.classify(convergent);
  check('a pair with ZERO orthology does not collapse to no-basis',
    f(c.class !== 'no-basis', c.class === 'no-basis'), `class ${c.class}`);
  check('it is classified convergent-analogue: shared function without shared ancestry',
    f(c.class === 'convergent-analogue', c.class !== 'convergent-analogue'), `class ${c.class}`);
  check('its homology_type is recorded as none rather than left undefined',
    f(c.homology_type === 'none', c.homology_type !== 'none'), `${c.homology_type}`);
  check('its support band is above the floor: zero orthology does not mean zero support',
    f(c.confidence.hi > 0.10, !(c.confidence.hi > 0.10)), `hi ${c.confidence.hi}`);

  const real = A.worked().rows.filter(r => r.class === 'convergent-analogue');
  check('worked() contains at least one real convergent pair with no orthology',
    f(real.length >= 1, !(real.length >= 1)), `${real.length}`);
  check('the real convergent pairs have no orthology at all',
    f(real.every(r => r.homology_type === 'none'), !real.every(r => r.homology_type === 'none')), real.map(r => `${r.id}:${r.homology_type}`).join(', '));
  check('convergent-analogue is nonetheless NOT sold as substitutable in a design',
    f(A.CLASSES['convergent-analogue'].functional_equivalent === false && typeof A.CLASSES['convergent-analogue'].functional_equivalent_note === 'string',
      !(A.CLASSES['convergent-analogue'].functional_equivalent === false && typeof A.CLASSES['convergent-analogue'].functional_equivalent_note === 'string')));
  check('and the deep-homology complication is named rather than left to be discovered',
    f(/[Dd]eep homology/.test(A.CLASSES['convergent-analogue'].upgrade), !/[Dd]eep homology/.test(A.CLASSES['convergent-analogue'].upgrade)));
}

// ====================================================================================================
// 4. "NO ORTHOLOGUE FOUND" IS NOT "NO FUNCTIONAL ANALOGUE EXISTS"
// ====================================================================================================
{
  const oneDb = A.PAIRS.find(p => p.id === 'and1-mouse-limb');
  const r = A.refuse(oneDb);
  check('a pair searched in ONE database triggers the absence-of-evidence refusal',
    f(r.refusals.some(x => x.id === 'absence-of-evidence'), !r.refusals.some(x => x.id === 'absence-of-evidence')), r.refusals.map(x => x.id).join(', '));
  const ae = r.refusals.find(x => x.id === 'absence-of-evidence');
  check('the refusal names the inference it is refusing, in those words',
    f(/will not read "no orthologue found" as "no functional analogue exists"/.test(ae.refusal),
      !/will not read "no orthologue found" as "no functional analogue exists"/.test(ae.refusal)), ae?.refusal?.slice(0, 60));
  check('it says searching one database is not searching',
    f(/[Ss]earching one database is not searching/.test(ae.because), !/[Ss]earching one database is not searching/.test(ae.because)));
  check('it makes the second, deeper point: an orthology negative is about ancestry, not function',
    f(/convergent analogues have no orthology by construction/i.test(ae.because), !/convergent analogues have no orthology by construction/i.test(ae.because)));
  check('it states the asymmetry: a positive is evidence, a negative is not its mirror',
    f(typeof ae.the_asymmetry === 'string' && /not two directions of one test/i.test(ae.the_asymmetry),
      !(typeof ae.the_asymmetry === 'string' && /not two directions of one test/i.test(ae.the_asymmetry))));
  check('and it names a remedy rather than only obstructing',
    f(/function-first search/i.test(ae.what_would_change_it), !/function-first search/i.test(ae.what_would_change_it)));

  const c = A.classify(oneDb);
  check('the no-basis class carries a warning that it is about the SEARCH, not the biology',
    f(/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(c.critical_warning ?? ''), !/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(c.critical_warning ?? '')));
  check('no-basis never reports functional_equivalent true',
    f(c.functional_equivalent === false, c.functional_equivalent !== false));
  check('a well-supported orthology ABSENCE still does not license the conclusion',
    f(c.class === 'no-basis' && c.refusals.some(x => x.id === 'absence-of-evidence'),
      !(c.class === 'no-basis' && c.refusals.some(x => x.id === 'absence-of-evidence'))), `class ${c.class}`);

  // Searching enough resources removes the first half of the complaint and not the second.
  const searched = { ...oneDb, id: 'synthetic-searched', databases_searched: ['r1', 'r2', 'r3', 'r4'], analogue_search: { performed: false } };
  check('searching MIN_DATABASES resources does not clear the refusal while the function-first search is unrun',
    f(A.refuse(searched).refusals.some(x => x.id === 'absence-of-evidence'), !A.refuse(searched).refusals.some(x => x.id === 'absence-of-evidence')));
  const done = { ...searched, id: 'synthetic-both-done', analogue_search: { performed: true } };
  check('and it DOES clear once both the orthology search and the function-first search are done',
    f(!A.refuse(done).refusals.some(x => x.id === 'absence-of-evidence'), A.refuse(done).refusals.some(x => x.id === 'absence-of-evidence')),
    A.refuse(done).refusals.map(x => x.id).join(', '));
  check('MIN_DATABASES is stated as a number and is more than one',
    f(A.MIN_DATABASES > 1, !(A.MIN_DATABASES > 1)), `${A.MIN_DATABASES}`);
}

// ====================================================================================================
// 5. RESCUE OUTRANKS SEQUENCE IDENTITY
// ====================================================================================================
// A pair with a rescue and nothing else must outrank a pair with near-perfect identity and nothing else.
// If identity could win, the module would be an orthology scorer with extra vocabulary.
{
  const base = { developmental_context: { difference_stated: true }, databases_searched: ['r1', 'r2', 'r3'], analogue_search: { performed: true } };
  const identityOnly = A.scoreAnalogy('geneX', 'geneY', { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.99 } });
  const rescueOnly = A.scoreAnalogy('geneX', 'geneZ', { 'rescue': { present: true, assay: 'illustrative' } });

  check('the strongest kind for an identity-only pair is sequence orthology, not something stronger',
    f(identityOnly.strongest.kind === 'sequence-orthology', identityOnly.strongest.kind !== 'sequence-orthology'), identityOnly.strongest.kind);
  check('99% identity alone is flagged as NOT a direct test of function',
    f(identityOnly.directly_tested === false, identityOnly.directly_tested !== false));
  check('a rescue alone IS flagged as a direct test of function',
    f(rescueOnly.directly_tested === true, rescueOnly.directly_tested !== true));
  check('rescue alone outranks 99% identity alone on the lower bound',
    f(rescueOnly.confidence.lo > identityOnly.confidence.lo, !(rescueOnly.confidence.lo > identityOnly.confidence.lo)),
    `${rescueOnly.confidence.lo} vs ${identityOnly.confidence.lo}`);
  check('rescue alone outranks 99% identity alone on the upper bound too',
    f(rescueOnly.confidence.hi > identityOnly.confidence.hi, !(rescueOnly.confidence.hi > identityOnly.confidence.hi)),
    `${rescueOnly.confidence.hi} vs ${identityOnly.confidence.hi}`);
  check('rescue alone outranks 99% identity alone on the band LABEL',
    f(rank(rescueOnly.confidence.label) > rank(identityOnly.confidence.label), !(rank(rescueOnly.confidence.label) > rank(identityOnly.confidence.label))),
    `${rescueOnly.confidence.label} vs ${identityOnly.confidence.label}`);
  check('99% identity alone never reaches a strong label',
    f(rank(identityOnly.confidence.label) < rank('strong'), !(rank(identityOnly.confidence.label) < rank('strong'))), identityOnly.confidence.label);

  const both = A.scoreAnalogy('geneX', 'geneY', {
    'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.99 },
    'rescue': { present: true, assay: 'illustrative' },
  });
  check('with both present, rescue is named as the strongest evidence',
    f(both.strongest.kind === 'rescue', both.strongest.kind !== 'rescue'), both.strongest.kind);
  check('a one-to-one orthologue WITHOUT rescue is classified orthologous-untested, not equivalent',
    f(A.classify({ ...base, id: 's1', a: 'geneX', b: 'geneY', evidence: { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.99 } } }).class === 'orthologous-untested',
      A.classify({ ...base, id: 's1', a: 'geneX', b: 'geneY', evidence: { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.99 } } }).class !== 'orthologous-untested'));
  check('and its upgrade path is the rescue experiment and nothing cheaper',
    f(/rescue or complementation experiment/i.test(A.CLASSES['orthologous-untested'].upgrade), !/rescue or complementation experiment/i.test(A.CLASSES['orthologous-untested'].upgrade)));
  check('the paralogous-candidate class records that a paralogue can outrank the nominal orthologue',
    f(/more similar than orthologues|functionally more similar/i.test(A.CLASSES['paralogous-candidate'].upgrade),
      !/more similar than orthologues|functionally more similar/i.test(A.CLASSES['paralogous-candidate'].upgrade)));
}

// ====================================================================================================
// 6. scoreAnalogy EXPOSES NO FUSED SCALAR AS ITS HEADLINE
// ====================================================================================================
{
  const v = A.scoreAnalogy('geneX', 'geneY', { 'rescue': { present: true }, 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.8 } });
  const topLevelNumbers = Object.entries(v).filter(([, x]) => typeof x === 'number').map(([k]) => k);
  check('NO top-level property of the verdict is a bare number',
    f(topLevelNumbers.length === 0, topLevelNumbers.length !== 0), topLevelNumbers.join(', '));
  check('fused_scalar is explicitly null rather than absent, so the absence is on the record',
    f(v.fused_scalar === null && 'fused_scalar' in v, !(v.fused_scalar === null && 'fused_scalar' in v)));
  check('score and probability are null too: there is no alias to read instead',
    f(v.score === null && v.probability === null, !(v.score === null && v.probability === null)));
  check('the headline is a sentence, not a value',
    f(typeof v.headline === 'string' && v.headline.length > 40, !(typeof v.headline === 'string' && v.headline.length > 40)));
  check('the headline contains NO digits at all, so no float can be quoted out of it',
    f(/[0-9]/.test(v.headline) === false, /[0-9]/.test(v.headline) === true), v.headline.slice(0, 70));
  check('the headline names the strongest evidence kind and what is absent',
    f(/Strongest evidence present/.test(v.headline) && /Absent:/.test(v.headline), !(/Strongest evidence present/.test(v.headline) && /Absent:/.test(v.headline))));
  check('WHY_NOT_ONE_NUMBER is exported and gives more than one reason',
    f(A.WHY_NOT_ONE_NUMBER.the_argument.length >= 4, !(A.WHY_NOT_ONE_NUMBER.the_argument.length >= 4)), `${A.WHY_NOT_ONE_NUMBER.the_argument.length}`);
  check('WHY_NOT_ONE_NUMBER names the propagation problem: the choice becomes invisible downstream',
    f(/propagates|invisible/i.test(A.WHY_NOT_ONE_NUMBER.headline), !/propagates|invisible/i.test(A.WHY_NOT_ONE_NUMBER.headline)));
  check('WHY_NOT_ONE_NUMBER names the specific hazard of a float being read as a probability',
    f(A.WHY_NOT_ONE_NUMBER.the_argument.some(s => /read as a probability/i.test(s)), !A.WHY_NOT_ONE_NUMBER.the_argument.some(s => /read as a probability/i.test(s))));
  check('the verdict carries WHY_NOT_ONE_NUMBER with it, so a caller cannot get the band without the caveat',
    f(v.why_no_fused_scalar === A.WHY_NOT_ONE_NUMBER, v.why_no_fused_scalar !== A.WHY_NOT_ONE_NUMBER));
  check('the confidence block says in words that it is not a probability',
    f(typeof v.confidence.not_a_probability === 'string' && /no reference class/i.test(v.confidence.not_a_probability),
      !(typeof v.confidence.not_a_probability === 'string' && /no reference class/i.test(v.confidence.not_a_probability))));
  check('the weighting actually used is exposed, not hidden in the implementation',
    f(v.confidence.weighting_used === A.BANDS && typeof v.confidence.base_intervals_used === 'object',
      !(v.confidence.weighting_used === A.BANDS && typeof v.confidence.base_intervals_used === 'object')));
  check('the verdict is frozen, so a caller cannot staple a scalar onto it downstream',
    f(Object.isFrozen(v) === true, Object.isFrozen(v) !== true));
}

// ====================================================================================================
// 7. CONFIDENCE IS A BAND, WITH hi > lo, ALWAYS
// ====================================================================================================
{
  const cases = [
    ['no evidence at all', {}],
    ['one weak kind', { 'positional-correspondence': { present: true } }],
    ['a rescue, the strongest kind there is', { 'rescue': { present: true } }],
    ['every kind at once', allKinds({ 'sequence-orthology': { homology_type: 'one-to-one', identity: 0.99 } })],
  ];
  for (const [label, ev] of cases) {
    const c = A.scoreAnalogy('x', 'y', ev).confidence;
    check(`confidence is a band with hi > lo (${label})`,
      f(c.hi > c.lo, !(c.hi > c.lo)), `lo ${c.lo} hi ${c.hi}`);
    check(`the band is not collapsible to a point (${label})`,
      f(c.is_a_band_not_a_point === true && c.hi - c.lo >= 0.07, !(c.is_a_band_not_a_point === true && c.hi - c.lo >= 0.07)), `width ${(c.hi - c.lo).toFixed(2)}`);
  }
  const everyPair = A.worked().rows;
  check('every pair in worked() has hi > lo',
    f(everyPair.every(r => r.band[1] > r.band[0]), !everyPair.every(r => r.band[1] > r.band[0])),
    everyPair.filter(r => !(r.band[1] > r.band[0])).map(r => r.id).join(', '));
  const full = A.scoreAnalogy('x', 'y', allKinds({ 'sequence-orthology': { homology_type: 'one-to-one', identity: 0.99 } })).confidence;
  check('even maximal evidence does not produce certainty: hi stays below 1',
    f(full.hi < 1, !(full.hi < 1)), `hi ${full.hi}`);
  check('the band width is explained as a function of what is MISSING, not of model precision',
    f(/evidence kinds are absent/.test(full.width_is_the_message), !/evidence kinds are absent/.test(full.width_is_the_message)));
  const straddle = A.scoreAnalogy('x', 'y', { 'rescue': { present: true }, 'sequence-orthology': { present: true, homology_type: 'one-to-one' }, 'domain-architecture': { present: true } }).confidence;
  check('when the band crosses a label boundary, the label_span says so rather than hiding it',
    f(straddle.label_span.length > 1, !(straddle.label_span.length > 1)), straddle.label_span.join('/'));
  const notRobust = A.worked().rows.filter(r => r.label_robust_to_weighting === false);
  check('the sensitivity probe actually bites: some labels change under the alternative weighting',
    f(notRobust.length > 0, !(notRobust.length > 0)), `${notRobust.length} of ${A.worked().n}: ${notRobust.map(r => r.id).join(', ')}`);
  // The pair whose label moved: same evidence, two defensible weightings, two different words.
  const moved = A.scoreAnalogy('x', 'y', A.PAIRS.find(p => p.id === 'KCNK5-mouse').evidence).confidence;
  check('a label that moved under re-weighting says in words that the difference was OURS, not the biology\'s',
    f(moved.label_is_robust_to_weighting === false && /is ours, not the biology/.test(moved.if_the_label_moved),
      !(moved.label_is_robust_to_weighting === false && /is ours, not the biology/.test(moved.if_the_label_moved))),
    `${moved.label} -> ${moved.under_alternative_weighting.label}`);
  check('and a label that survived re-weighting says that instead',
    f(/the evidence talking/.test(A.scoreAnalogy('x', 'y', { 'rescue': { present: true } }).confidence.if_the_label_moved),
      !/the evidence talking/.test(A.scoreAnalogy('x', 'y', { 'rescue': { present: true } }).confidence.if_the_label_moved)));
}

// ====================================================================================================
// 8. EVERY CLASS EXISTS, IS REACHABLE, AND HAS A STATED UPGRADE PATH
// ====================================================================================================
{
  const expected = ['orthologous-and-functionally-tested', 'orthologous-untested', 'one-to-many-ambiguous', 'paralogous-candidate', 'convergent-analogue', 'positional-only', 'no-basis'];
  check('all seven classes are defined, with no extras',
    f(A.CLASS_IDS.length === 7 && expected.every(c => A.CLASS_IDS.includes(c)), !(A.CLASS_IDS.length === 7 && expected.every(c => A.CLASS_IDS.includes(c)))), A.CLASS_IDS.join(', '));
  const noUpgrade = A.CLASS_IDS.filter(c => typeof A.CLASSES[c].upgrade !== 'string' || A.CLASSES[c].upgrade.length < 40);
  check('EVERY class has a stated upgrade path, with substance in it',
    f(noUpgrade.length === 0, noUpgrade.length !== 0), noUpgrade.join(', '));
  const noMeans = A.CLASS_IDS.filter(c => typeof A.CLASSES[c].means !== 'string');
  check('every class states what it means',
    f(noMeans.length === 0, noMeans.length !== 0), noMeans.join(', '));
  check('the top class\'s upgrade path admits it is not a licence even so',
    f(/still not a licence/i.test(A.CLASSES['orthologous-and-functionally-tested'].upgrade), !/still not a licence/i.test(A.CLASSES['orthologous-and-functionally-tested'].upgrade)));
  check('the one-to-many upgrade path does NOT offer a better orthology call as the fix',
    f(/[Nn]ot a better orthology call/.test(A.CLASSES['one-to-many-ambiguous'].upgrade), !/[Nn]ot a better orthology call/.test(A.CLASSES['one-to-many-ambiguous'].upgrade)));
  check('the positional-only upgrade path names the circularity as the specific weakness',
    f(/circl|circular|assuming its conclusion/i.test(A.CLASSES['positional-only'].upgrade), !/circl|circular|assuming its conclusion/i.test(A.CLASSES['positional-only'].upgrade)));
  check('classify() returns the upgrade path with the verdict, not just the label',
    f(typeof A.classify(A.PAIRS[0]).upgrade === 'string' && A.classify(A.PAIRS[0]).upgrade.length > 40,
      !(typeof A.classify(A.PAIRS[0]).upgrade === 'string' && A.classify(A.PAIRS[0]).upgrade.length > 40)));
  check('classify() returns exactly one class, drawn from CLASS_IDS, for every pair',
    f(A.PAIRS.every(p => A.CLASS_IDS.includes(A.classify(p).class)), !A.PAIRS.every(p => A.CLASS_IDS.includes(A.classify(p).class))));
}

// ====================================================================================================
// 9. THE OTHER TWO REFUSALS
// ====================================================================================================
{
  check('all four refusal ids are declared',
    f(A.REFUSAL_IDS.length === 4, A.REFUSAL_IDS.length !== 4), A.REFUSAL_IDS.join(', '));

  // Identity below the stated floor.
  const low = {
    id: 'synthetic-low-identity', a: 'geneX', b: 'geneY', claim: 'functional-equivalence',
    developmental_context: { difference_stated: true }, databases_searched: ['r1', 'r2', 'r3'], analogue_search: { performed: true },
    evidence: { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.18 } },
  };
  const lr = A.refuse(low).refusals.find(x => x.id === 'identity-alone-is-not-function');
  check('an identity below the stated floor is refused as a basis for function',
    f(lr !== undefined, lr === undefined), A.refuse(low).refusals.map(x => x.id).join(', '));
  check('the refusal states the floor as a number rather than gesturing at one',
    f(lr !== undefined && lr.refusal.includes(String(A.IDENTITY_FLOOR)), !(lr !== undefined && lr.refusal.includes(String(A.IDENTITY_FLOOR)))), `floor ${A.IDENTITY_FLOOR}`);
  check('and it says the floor is not a ceiling: above it, identity still does not establish function',
    f(lr !== undefined && /floor is not a ceiling|places no bound on the function inference/i.test(lr.the_floor_is_not_a_ceiling ?? ''),
      !(lr !== undefined && /floor is not a ceiling|places no bound on the function inference/i.test(lr.the_floor_is_not_a_ceiling ?? ''))));
  const highButBare = { ...low, id: 'synthetic-high-identity-bare', evidence: { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.97 }, 'synteny': { present: true } } };
  check('high identity with only ancestry evidence is STILL refused as a basis for function',
    f(A.refuse(highButBare).refusals.some(x => x.id === 'identity-alone-is-not-function'), !A.refuse(highButBare).refusals.some(x => x.id === 'identity-alone-is-not-function')),
    A.refuse(highButBare).refusals.map(x => x.id).join(', '));
  const withFunction = { ...highButBare, id: 'synthetic-high-identity-plus-function', evidence: { ...highButBare.evidence, 'expression-domain': { present: true } } };
  check('adding function-bearing evidence clears that refusal, so it is a real discriminator',
    f(!A.refuse(withFunction).refusals.some(x => x.id === 'identity-alone-is-not-function'), A.refuse(withFunction).refusals.some(x => x.id === 'identity-alone-is-not-function')));

  // Phenotype transfer with no developmental-context difference stated.
  const pheno = {
    id: 'synthetic-phenotype-transfer', a: { species: 'species A', name: 'geneX' }, b: { species: 'species B', name: 'geneY' },
    claim: 'phenotype-transfer', databases_searched: ['r1', 'r2', 'r3'], analogue_search: { performed: true },
    developmental_context: { difference_stated: false },
    evidence: { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.9 }, 'lof-phenotype': { present: true } },
  };
  const pr = A.refuse(pheno).refusals.find(x => x.id === 'phenotype-transfer-without-context');
  check('transferring a phenotype with no stated developmental-context difference is refused',
    f(pr !== undefined, pr === undefined), A.refuse(pheno).refusals.map(x => x.id).join(', '));
  check('the refusal itemises what must be stated, rather than asking for "context"',
    f(pr !== undefined && pr.what_must_be_stated.length >= 4, !(pr !== undefined && pr.what_must_be_stated.length >= 4)), `${pr?.what_must_be_stated?.length}`);
  check('it names compensating paralogues as one of the context differences that matters',
    f(pr !== undefined && pr.what_must_be_stated.some(s => /paralogue/i.test(s)), !(pr !== undefined && pr.what_must_be_stated.some(s => /paralogue/i.test(s)))));
  check('it names the trap of two assays sharing a word',
    f(pr !== undefined && pr.what_must_be_stated.some(s => /sharing a word/i.test(s)), !(pr !== undefined && pr.what_must_be_stated.some(s => /sharing a word/i.test(s)))));
  check('stating the difference clears it: the refusal is about the statement, not about the species',
    f(!A.refuse({ ...pheno, developmental_context: { difference_stated: true, a: 'stage X', b: 'stage Y' } }).refusals.some(x => x.id === 'phenotype-transfer-without-context'),
      A.refuse({ ...pheno, developmental_context: { difference_stated: true, a: 'stage X', b: 'stage Y' } }).refusals.some(x => x.id === 'phenotype-transfer-without-context')));

  const everyRefusal = A.PAIRS.flatMap(p => A.refuse(p).refusals);
  check('every refusal that fires on a real pair names what would change it',
    f(everyRefusal.every(r => typeof r.what_would_change_it === 'string' && r.what_would_change_it.length > 30),
      !everyRefusal.every(r => typeof r.what_would_change_it === 'string' && r.what_would_change_it.length > 30)));
  check('a refusal is stated as a limit on the evidence, not as a verdict that the mapping is false',
    f(/not a verdict that the mapping is false/.test(A.refuse(A.PAIRS.find(p => p.id === 'and1-mouse-limb')).note),
      !/not a verdict that the mapping is false/.test(A.refuse(A.PAIRS.find(p => p.id === 'and1-mouse-limb')).note)));
  check('refuse() on a fully specified, well-evidenced pair fires nothing, so the refusals discriminate',
    f(A.refuse(A.PAIRS.find(p => p.id === 'cdc2-CDK1')).refused === false, A.refuse(A.PAIRS.find(p => p.id === 'cdc2-CDK1')).refused !== false),
    A.refuse(A.PAIRS.find(p => p.id === 'cdc2-CDK1')).refusals.map(x => x.id).join(', '));
  check('and a clean pair is still not called an endorsement',
    f(/not an endorsement/.test(A.refuse(A.PAIRS.find(p => p.id === 'cdc2-CDK1')).note), !/not an endorsement/.test(A.refuse(A.PAIRS.find(p => p.id === 'cdc2-CDK1')).note)));
}

// ====================================================================================================
// 10. THE DUPLICATE-PAIR PROBLEM, AND ITS INSTANCE IN THIS REPO
// ====================================================================================================
{
  const Z = A.THE_ZEBRAFISH_PROBLEM;
  check('THE_ZEBRAFISH_PROBLEM is frozen',
    f(Object.isFrozen(Z) === true, Object.isFrozen(Z) !== true));
  check('it states the GENERAL problem: a whole-genome duplication leaves duplicate pairs',
    f(Z.the_general_problem.some(s => /whole-genome duplication/i.test(s)), !Z.the_general_problem.some(s => /whole-genome duplication/i.test(s))));
  check('it states that the copies SPLIT the ancestral function between them',
    f(Z.the_general_problem.some(s => /SPLIT THE ANCESTRAL FUNCTION/i.test(s)), !Z.the_general_problem.some(s => /SPLIT THE ANCESTRAL FUNCTION/i.test(s))));
  check('it states the consequence: knocking out one copy gives a partial or absent phenotype',
    f(Z.the_general_problem.some(s => /PARTIAL phenotype|no phenotype at all/i.test(s)), !Z.the_general_problem.some(s => /PARTIAL phenotype|no phenotype at all/i.test(s))));
  check('it says plainly that picking one copy and calling it "the" orthologue is WRONG, not imprecise',
    f(Z.the_general_problem.some(s => /CALLS IT "THE" ORTHOLOGUE IS WRONG/i.test(s)), !Z.the_general_problem.some(s => /CALLS IT "THE" ORTHOLOGUE IS WRONG/i.test(s))));
  check('it says the error surfaces as a failed experiment',
    f(Z.the_general_problem.some(s => /failed experiment/i.test(s)), !Z.the_general_problem.some(s => /failed experiment/i.test(s))));
  check('it names the repo\'s real instance: the kcnk5b / kcnk5a pair',
    f(Z.the_instance_in_this_repo.pair.includes('kcnk5b') && Z.the_instance_in_this_repo.pair.includes('kcnk5a'),
      !(Z.the_instance_in_this_repo.pair.includes('kcnk5b') && Z.the_instance_in_this_repo.pair.includes('kcnk5a'))), Z.the_instance_in_this_repo.pair.join('/'));
  check('and records that both map to the single human gene',
    f(/KCNK5/.test(Z.the_instance_in_this_repo.maps_to), !/KCNK5/.test(Z.the_instance_in_this_repo.maps_to)));
  check('the redundancy is recorded as the literature\'s ATTRIBUTION, not as a measured result',
    f(Z.the_instance_in_this_repo.what_is_NOT_established.some(s => /hypothesis about an absence|attribution/i.test(s)),
      !Z.the_instance_in_this_repo.what_is_NOT_established.some(s => /hypothesis about an absence|attribution/i.test(s))));
  check('transcriptional adaptation is named as the rival explanation for a silent knockout',
    f(Z.the_general_problem.some(s => /transcriptional adaptation/i.test(s)), !Z.the_general_problem.some(s => /transcriptional adaptation/i.test(s))));
  check('the honest mapping is stated as a SET, not as a chosen member',
    f(/as a SET/.test(Z.the_instance_in_this_repo.the_honest_mapping), !/as a SET/.test(Z.the_instance_in_this_repo.the_honest_mapping)));
  check('the problem is explicitly said not to be unique to one lineage',
    f(/one-to-many names the problem/i.test(Z.not_only_zebrafish), !/one-to-many names the problem/i.test(Z.not_only_zebrafish)));

  const real = A.classify(A.PAIRS.find(p => p.id === 'KCNK5-kcnk5b'));
  check('the repo\'s own mapping classifies as one-to-many-ambiguous and points at the record',
    f(real.class === 'one-to-many-ambiguous' && real.see === 'THE_ZEBRAFISH_PROBLEM', !(real.class === 'one-to-many-ambiguous' && real.see === 'THE_ZEBRAFISH_PROBLEM')), real.class);
  check('its loss-of-function evidence is recorded ABSENT rather than asserted from the redundancy story',
    f(A.PAIRS.find(p => p.id === 'KCNK5-kcnk5b').evidence['lof-phenotype'].present === false,
      A.PAIRS.find(p => p.id === 'KCNK5-kcnk5b').evidence['lof-phenotype'].present !== false));
  check('its synteny evidence is recorded ABSENT, which is what would distinguish ohnologs from a local duplication',
    f(A.PAIRS.find(p => p.id === 'KCNK5-kcnk5b').evidence['synteny'].present === false,
      A.PAIRS.find(p => p.id === 'KCNK5-kcnk5b').evidence['synteny'].present !== false));
}

// ====================================================================================================
// 11. worked(), AND THE MODULE RUNNING WITHOUT fetch.mjs
// ====================================================================================================
{
  const w = A.worked();
  check('worked() runs over a handful of real pairs',
    f(w.n >= 6, !(w.n >= 6)), `${w.n}`);
  check('worked() reaches all seven classes',
    f(w.classes_unreached.length === 0, w.classes_unreached.length !== 0), w.classes_unreached.join(', '));
  check('the distribution sums to the number of pairs, so each pair got exactly one class',
    f(Object.values(w.distribution).reduce((a, b) => a + b, 0) === w.n, Object.values(w.distribution).reduce((a, b) => a + b, 0) !== w.n));
  check('at most a small minority of real pairs clear the functional-equivalence bar',
    f(w.n_functional_equivalents < w.n / 2, !(w.n_functional_equivalents < w.n / 2)), `${w.n_functional_equivalents} of ${w.n}`);
  check('the one that clears it does so on a direct functional test, not on orthology quality',
    f(w.n_directly_tested === w.n_functional_equivalents, w.n_directly_tested !== w.n_functional_equivalents),
    `directly tested ${w.n_directly_tested}, equivalents ${w.n_functional_equivalents}`);
  check('worked() includes a convergent case with no orthology',
    f(w.rows.some(r => r.class === 'convergent-analogue' && r.homology_type === 'none'), !w.rows.some(r => r.class === 'convergent-analogue' && r.homology_type === 'none')));
  check('worked() states that its distribution is NOT a base rate',
    f(/base rate/i.test(w.what_it_does_not_show), !/base rate/i.test(w.what_it_does_not_show)));
  check('worked() names the uncomfortable row rather than burying it in the table',
    f(/KCNK5-kcnk5b/.test(w.the_uncomfortable_row), !/KCNK5-kcnk5b/.test(w.the_uncomfortable_row)));

  // The sibling module owns analogues/fetch.mjs. Nothing above imported it; everything above ran.
  check('FETCH_STATUS reports the sibling module\'s availability as a fact, either way',
    f(typeof A.FETCH_STATUS.available === 'boolean' && typeof A.FETCH_STATUS.why === 'string',
      !(typeof A.FETCH_STATUS.available === 'boolean' && typeof A.FETCH_STATUS.why === 'string')), `available ${A.FETCH_STATUS.available}`);
  check('every verdict above was produced without calling fetch.mjs, so the module stands alone',
    f(A.worked().n === w.n && A.classify(A.PAIRS[0]).class === 'orthologous-and-functionally-tested',
      !(A.worked().n === w.n && A.classify(A.PAIRS[0]).class === 'orthologous-and-functionally-tested')));
  check('the optional bridge exists as a function and is not required by anything else here',
    f(typeof A.orthologyEvidence === 'function', typeof A.orthologyEvidence !== 'function'));
  check('every worked pair carries a note, so no hardcoded evidence is unexplained',
    f(A.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60), !A.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60)),
    A.PAIRS.filter(p => !(typeof p.note === 'string' && p.note.length > 60)).map(p => p.id).join(', '));
  const synthetic = A.PAIRS.filter(p => /SYNTHETIC/i.test(p.note));
  check('none of the worked pairs is synthetic: they are all real, hand-specified pairs',
    f(synthetic.length === 0, synthetic.length !== 0), synthetic.map(p => p.id).join(', '));
}

// ====================================================================================================
// 12. HOMOLOGY AND ANALOGY ARE KEPT APART
// ====================================================================================================
{
  check('WHAT_THIS_IS states the distinction in the first breath',
    f(/shared ancestry/.test(A.WHAT_THIS_IS) && /shared function/.test(A.WHAT_THIS_IS), !(/shared ancestry/.test(A.WHAT_THIS_IS) && /shared function/.test(A.WHAT_THIS_IS))));
  const aboutAncestry = A.EVIDENCE_IDS.filter(k => /ancestry/.test(A.EVIDENCE_KINDS[k].about));
  const aboutFunction = A.EVIDENCE_IDS.filter(k => /function/.test(A.EVIDENCE_KINDS[k].about));
  check('each evidence kind declares whether it is about ancestry or about function',
    f(aboutAncestry.length > 0 && aboutFunction.length > 0 && A.EVIDENCE_IDS.every(k => typeof A.EVIDENCE_KINDS[k].about === 'string'),
      !(aboutAncestry.length > 0 && aboutFunction.length > 0 && A.EVIDENCE_IDS.every(k => typeof A.EVIDENCE_KINDS[k].about === 'string'))),
    `ancestry: ${aboutAncestry.join(', ')} | function: ${aboutFunction.join(', ')}`);
  const ancestryOnly = A.scoreAnalogy('x', 'y', { 'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.95 }, 'synteny': { present: true } });
  check('a verdict built only from ancestry evidence says so in its gaps, in those terms',
    f(ancestryOnly.gaps.some(g => /ANCESTRY or TOPOLOGY/.test(g)), !ancestryOnly.gaps.some(g => /ANCESTRY or TOPOLOGY/.test(g))), ancestryOnly.gaps.join(' | '));
  check('any verdict with no rescue says so in its gaps, however much else is present',
    f(A.scoreAnalogy('x', 'y', allKinds({ 'rescue': { present: false }, 'sequence-orthology': { homology_type: 'one-to-one' } })).gaps.some(g => /no direct functional test/.test(g)),
      !A.scoreAnalogy('x', 'y', allKinds({ 'rescue': { present: false }, 'sequence-orthology': { homology_type: 'one-to-one' } })).gaps.some(g => /no direct functional test/.test(g))));
  check('an orthology claim with no homology type is reported as a gap, not silently defaulted',
    f(A.scoreAnalogy('x', 'y', { 'sequence-orthology': { present: true } }).gaps.some(g => /no homology_type/.test(g)),
      !A.scoreAnalogy('x', 'y', { 'sequence-orthology': { present: true } }).gaps.some(g => /no homology_type/.test(g))));
  check('the ortholog conjecture is named AS a conjecture, with the citation for the doubt',
    f(/conjecture/i.test(A.EVIDENCE_KINDS['sequence-orthology'].does_not_establish) && /nehrt/i.test(A.CITATIONS.nehrt_2011),
      !(/conjecture/i.test(A.EVIDENCE_KINDS['sequence-orthology'].does_not_establish) && /nehrt/i.test(A.CITATIONS.nehrt_2011))));
  check('the citations include the measured replaceability rate for tested orthologues',
    f(/roughly half/i.test(A.CITATIONS.kachroo_2015), !/roughly half/i.test(A.CITATIONS.kachroo_2015)));
  check('an unknown evidence kind is reported rather than silently dropped',
    f(A.scoreAnalogy('x', 'y', { 'vibes': { present: true } }).unknown_evidence_kinds.includes('vibes'),
      !A.scoreAnalogy('x', 'y', { 'vibes': { present: true } }).unknown_evidence_kinds.includes('vibes')));
  check('an unknown evidence kind buys no support: it is not counted as a present kind',
    f(A.scoreAnalogy('x', 'y', { 'vibes': { present: true } }).present_kinds.length === 0, A.scoreAnalogy('x', 'y', { 'vibes': { present: true } }).present_kinds.length !== 0));
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
