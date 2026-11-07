#!/usr/bin/env node
// node analogues/test-cases.mjs [--fail-once]
//
// House discipline: every assertion wraps its condition in f(real, broken), where `broken` is the
// INVERTED predicate and so evaluates FALSE whenever the data are correct. Running with --fail-once must
// therefore print ZERO "ok" lines: if any assertion still passes under the fault, that assertion was not
// actually testing anything and the fault did not bite.
//
// These tests exist to hold the three verdicts apart. The set was chosen because the requests fail in
// three DIFFERENT ways, so the tests that matter most are the ones checking the differences: that the
// methane case names the wrong organism, that the three verdicts are mutually distinct, that the glow
// case separates fluorescence from bioluminescence in so many words, and that no case claims CRISPR is
// appropriate without saying why.

import {
  CASES, CRISPR_RELEVANCE, THE_SHARED_LESSON, THE_HAMMER, VERDICTS, ANALOGY_CLASSES,
  ALL_SOURCES, NULL_SOURCES, PROVENANCE, crossCheckAnalogyVocabulary,
} from './cases.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};
const f = (real, broken) => (FAULT ? broken : real);

const REQUIRED_FIELDS = [
  'id', 'request', 'what_is_actually_being_asked', 'target_organism',
  'is_the_target_organism_the_right_one', 'route', 'analogy_class',
  'what_would_have_to_be_measured', 'verdict', 'how_it_could_fail', 'sources',
];
const ALLOWED_VERDICTS = ['addable', 'polygenic-not-a-single-edit', 'wrong-organism',
  'needs-measurement-first'];

const DOI_SHAPE = /^10\.\d{4,9}\/[^\s]+$/;
const PMID_SHAPE = /^\d{4,8}$/;

const byId = (id) => CASES.find((c) => c.id === id);
const crisprFor = (id) => CRISPR_RELEVANCE.find((r) => r.case_id === id);
const GLOW = byId('glowing-fly');
const WORM = byId('protein-worm');
const COW = byId('low-methane-cow');
const nonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;
const words = (v) => (nonEmptyStr(v) ? v.trim().split(/\s+/).length : 0);

console.log(`\n${FAULT ? 'FAULT INJECTED (--fail-once): zero assertions may pass' : 'analogues/cases.mjs'}\n`);

// ---------------------------------------------------------------------------------------------------
console.log('shape: the set itself');
// ---------------------------------------------------------------------------------------------------

check('CASES holds exactly the three chosen requests',
  f(CASES.length === 3, CASES.length !== 3), `length=${CASES.length}`);

check('CASES is frozen',
  f(Object.isFrozen(CASES), !Object.isFrozen(CASES)));

check('every case object is frozen, not just the array',
  f(CASES.every((c) => Object.isFrozen(c)), !CASES.every((c) => Object.isFrozen(c))));

check('nested arrays inside a case are frozen too (a consumer cannot drop a caveat)',
  f(CASES.every((c) => Object.isFrozen(c.sources) && Object.isFrozen(c.how_it_could_fail)),
    !CASES.every((c) => Object.isFrozen(c.sources) && Object.isFrozen(c.how_it_could_fail))));

check('case ids are unique',
  f(new Set(CASES.map((c) => c.id)).size === CASES.length,
    new Set(CASES.map((c) => c.id)).size !== CASES.length));

check('all three expected cases are present by id',
  f(Boolean(GLOW && WORM && COW), !(GLOW && WORM && COW)),
  `found=${CASES.map((c) => c.id).join(',')}`);

// ---------------------------------------------------------------------------------------------------
console.log('\nshape: every case has all fields');
// ---------------------------------------------------------------------------------------------------

for (const c of CASES) {
  const missing = REQUIRED_FIELDS.filter((k) => !(k in c));
  check(`${c.id}: has all ${REQUIRED_FIELDS.length} required fields`,
    f(missing.length === 0, missing.length !== 0), `missing=${missing.join(',')}`);

  const empty = REQUIRED_FIELDS.filter((k) => {
    const v = c[k];
    if (typeof v === 'boolean') return false;
    if (Array.isArray(v)) return v.length === 0;
    return !nonEmptyStr(v);
  });
  check(`${c.id}: no required field is empty`,
    f(empty.length === 0, empty.length !== 0), `empty=${empty.join(',')}`);

  check(`${c.id}: is_the_target_organism_the_right_one is a boolean, not prose`,
    f(typeof c.is_the_target_organism_the_right_one === 'boolean',
      typeof c.is_the_target_organism_the_right_one !== 'boolean'),
    `got ${typeof c.is_the_target_organism_the_right_one}`);

  check(`${c.id}: verdict is from the closed vocabulary`,
    f(ALLOWED_VERDICTS.includes(c.verdict), !ALLOWED_VERDICTS.includes(c.verdict)), c.verdict);

  check(`${c.id}: analogy_class is one of the declared ANALOGY_CLASSES`,
    f(Object.values(ANALOGY_CLASSES).includes(c.analogy_class),
      !Object.values(ANALOGY_CLASSES).includes(c.analogy_class)), c.analogy_class);

  check(`${c.id}: route describes a mechanism concretely (not a one-liner)`,
    f(words(c.route) >= 30, !(words(c.route) >= 30)), `${words(c.route)} words`);

  check(`${c.id}: what_would_have_to_be_measured lists several things`,
    f(Array.isArray(c.what_would_have_to_be_measured) && c.what_would_have_to_be_measured.length >= 4,
      !(Array.isArray(c.what_would_have_to_be_measured) && c.what_would_have_to_be_measured.length >= 4)),
    `n=${c.what_would_have_to_be_measured?.length}`);

  check(`${c.id}: how_it_could_fail lists several distinct failure modes`,
    f(Array.isArray(c.how_it_could_fail) && c.how_it_could_fail.length >= 4,
      !(Array.isArray(c.how_it_could_fail) && c.how_it_could_fail.length >= 4)),
    `n=${c.how_it_could_fail?.length}`);

  check(`${c.id}: says WHY the target organism is or is not the right one`,
    f(words(c.why_the_target_is_or_is_not_right) >= 15,
      !(words(c.why_the_target_is_or_is_not_right) >= 15)));

  check(`${c.id}: says WHY that analogy_class, not just which`,
    f(words(c.why_that_analogy_class) >= 25, !(words(c.why_that_analogy_class) >= 25)));

  check(`${c.id}: verdict carries reasoning, so it is not a bare label`,
    f(words(c.verdict_reasoning) >= 25, !(words(c.verdict_reasoning) >= 25)));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe methane case: the named organism is the wrong one, and that IS the finding');
// ---------------------------------------------------------------------------------------------------

check('methane case: is_the_target_organism_the_right_one is false',
  f(COW.is_the_target_organism_the_right_one === false,
    COW.is_the_target_organism_the_right_one !== false),
  `got ${COW?.is_the_target_organism_the_right_one}`);

check('methane case: verdict is exactly "wrong-organism"',
  f(COW.verdict === 'wrong-organism', COW.verdict !== 'wrong-organism'), COW?.verdict);

check('methane case: it is the ONLY case whose named organism is wrong',
  f(CASES.filter((c) => c.is_the_target_organism_the_right_one === false).length === 1,
    CASES.filter((c) => c.is_the_target_organism_the_right_one === false).length !== 1));

check('methane case: the case whose organism is wrong is the one with the wrong-organism verdict',
  f(CASES.every((c) => (c.verdict === 'wrong-organism') === (c.is_the_target_organism_the_right_one === false)),
    !CASES.every((c) => (c.verdict === 'wrong-organism') === (c.is_the_target_organism_the_right_one === false))));

{
  // The decisive fact has to be stated, not merely implied by the verdict label.
  const t = `${COW.what_is_actually_being_asked} ${COW.why_the_target_is_or_is_not_right} ${COW.route}`;
  check('methane case: names the archaea as the producers',
    f(/archae/i.test(t), !/archae/i.test(t)));
  check('methane case: locates the reaction in the rumen',
    f(/rumen/i.test(t), !/rumen/i.test(t)));
  check('methane case: states that the cow genome encodes no methanogenesis pathway',
    f(/encodes no methanogenesis/i.test(t), !/encodes no methanogenesis/i.test(t)));
  check('methane case: names the enzyme that actually does it',
    f(/methyl-coenzyme M reductase|MCR\b/.test(t), !/methyl-coenzyme M reductase|MCR\b/.test(t)));
  check('methane case: redirects to the microbiome or the feed',
    f(/microbiom/i.test(t) && /feed/i.test(t), !(/microbiom/i.test(t) && /feed/i.test(t))));
  check('methane case: names 3-NOP as a real measured route',
    f(/3-NOP|3-nitrooxypropanol/i.test(t), !/3-NOP|3-nitrooxypropanol/i.test(t)));
}

check('methane case: separates "heritable" from "editable" in a dedicated block',
  f(Boolean(COW.heritable_is_not_editable) && words(COW.heritable_is_not_editable.the_distinction) >= 25,
    !(Boolean(COW.heritable_is_not_editable) && words(COW.heritable_is_not_editable.the_distinction) >= 25)));

check('methane case: reports actual heritability figures, not just the word "heritable"',
  f(Array.isArray(COW.heritable_is_not_editable?.the_figures)
    && COW.heritable_is_not_editable.the_figures.length >= 3,
    !(Array.isArray(COW.heritable_is_not_editable?.the_figures)
      && COW.heritable_is_not_editable.the_figures.length >= 3)),
  `n=${COW.heritable_is_not_editable?.the_figures?.length}`);

check('methane case: every heritability figure is attributed to a source key that exists',
  f(COW.heritable_is_not_editable.the_figures.every((x) => ALL_SOURCES.some((s) => s.key === x.source)),
    !COW.heritable_is_not_editable.the_figures.every((x) => ALL_SOURCES.some((s) => s.key === x.source))));

check('methane case: heritability figures are non-zero but modest (0 < h2 < 0.5), as reported',
  f(COW.heritable_is_not_editable.the_figures.some((x) => x.value === 0.21)
    && COW.heritable_is_not_editable.the_figures.every((x) =>
      typeof x.value !== 'number' || (x.value > 0 && x.value < 0.5)),
    !(COW.heritable_is_not_editable.the_figures.some((x) => x.value === 0.21)
      && COW.heritable_is_not_editable.the_figures.every((x) =>
        typeof x.value !== 'number' || (x.value > 0 && x.value < 0.5)))));

check('methane case: says explicitly that no causal variant of large effect is named',
  f(/no causal variant/i.test(COW.heritable_is_not_editable.what_follows),
    !/no causal variant/i.test(COW.heritable_is_not_editable.what_follows)));

check('methane case: the cheap decisive check (search the cow genome for mcr homologues) is listed',
  f(COW.what_would_have_to_be_measured.some((m) => /mcrA|mcr[ABG]/.test(m)),
    !COW.what_would_have_to_be_measured.some((m) => /mcrA|mcr[ABG]/.test(m))));

check('methane case: a failure mode is that a cassette gets produced anyway',
  f(COW.how_it_could_fail.some((h) => /cassette/i.test(h)),
    !COW.how_it_could_fail.some((h) => /cassette/i.test(h))));

check('methane case: a failure mode is "heritable" being misread as "editable"',
  f(COW.how_it_could_fail.some((h) => /heritable/i.test(h) && /editable/i.test(h)),
    !COW.how_it_could_fail.some((h) => /heritable/i.test(h) && /editable/i.test(h))));

check('methane case: analogy_class is the associated-community one',
  f(COW.analogy_class === ANALOGY_CLASSES.ASSOCIATED_COMMUNITY,
    COW.analogy_class !== ANALOGY_CLASSES.ASSOCIATED_COMMUNITY));

// ---------------------------------------------------------------------------------------------------
console.log('\nthe three verdicts are mutually distinct (the set exists to show different failure modes)');
// ---------------------------------------------------------------------------------------------------

{
  const vs = CASES.map((c) => c.verdict);
  check('the three verdicts are pairwise distinct',
    f(new Set(vs).size === vs.length, new Set(vs).size !== vs.length), vs.join(' / '));

  check('the set covers exactly: addable, polygenic-not-a-single-edit, wrong-organism',
    f(new Set(vs).size === 3
      && ['addable', 'polygenic-not-a-single-edit', 'wrong-organism'].every((v) => vs.includes(v)),
      !(new Set(vs).size === 3
        && ['addable', 'polygenic-not-a-single-edit', 'wrong-organism'].every((v) => vs.includes(v)))),
    vs.join(' / '));

  const cls = CASES.map((c) => c.analogy_class);
  check('the three analogy classes are pairwise distinct too',
    f(new Set(cls).size === cls.length, new Set(cls).size !== cls.length), cls.join(' / '));

  check('no two cases fail the same way (failure modes are not copy-paste)',
    f(new Set(CASES.map((c) => c.how_it_could_fail.join('|'))).size === CASES.length,
      new Set(CASES.map((c) => c.how_it_could_fail.join('|'))).size !== CASES.length));

  check('exactly one case is "addable" -- only one is a genome-engineering problem in the assumed shape',
    f(vs.filter((v) => v === 'addable').length === 1, vs.filter((v) => v === 'addable').length !== 1));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe glow case: fluorescence and bioluminescence are distinguished EXPLICITLY');
// ---------------------------------------------------------------------------------------------------

{
  const d = GLOW.the_distinction_that_decides_the_case;

  check('glow case: carries a dedicated fluorescence-vs-bioluminescence block',
    f(Boolean(d && d.fluorescence && d.bioluminescence), !(d && d.fluorescence && d.bioluminescence)));

  check('glow case: both words appear in what_is_actually_being_asked, not only in a side note',
    f(/fluorescen/i.test(GLOW.what_is_actually_being_asked)
      && /biolumines/i.test(GLOW.what_is_actually_being_asked),
      !(/fluorescen/i.test(GLOW.what_is_actually_being_asked)
        && /biolumines/i.test(GLOW.what_is_actually_being_asked))));

  check('glow case: fluorescence does NOT glow in the dark',
    f(d.fluorescence.glows_in_the_dark === false, d.fluorescence.glows_in_the_dark !== false));

  check('glow case: fluorescence DOES need excitation light',
    f(d.fluorescence.needs_excitation_light === true, d.fluorescence.needs_excitation_light !== true));

  check('glow case: bioluminescence DOES glow in the dark',
    f(d.bioluminescence.glows_in_the_dark === true, d.bioluminescence.glows_in_the_dark !== true));

  check('glow case: the two phenomena differ on glows_in_the_dark (the whole point)',
    f(d.fluorescence.glows_in_the_dark !== d.bioluminescence.glows_in_the_dark,
      !(d.fluorescence.glows_in_the_dark !== d.bioluminescence.glows_in_the_dark)));

  check('glow case: only bioluminescence needs a supplied substrate',
    f(d.bioluminescence.needs_a_supplied_substrate === true
      && d.fluorescence.needs_a_supplied_substrate === false,
      !(d.bioluminescence.needs_a_supplied_substrate === true
        && d.fluorescence.needs_a_supplied_substrate === false)));

  check('glow case: states that the fly cannot make luciferin itself',
    f(/no luciferin biosynthesis|cannot make/i.test(d.bioluminescence.why),
      !/no luciferin biosynthesis|cannot make/i.test(d.bioluminescence.why)));

  check('glow case: names the trap -- most askers mean bioluminescence and will be handed fluorescence',
    f(words(d.the_trap) >= 30 && /biolumines/i.test(d.the_trap),
      !(words(d.the_trap) >= 30 && /biolumines/i.test(d.the_trap))));

  check('glow case: a listed failure mode is delivering the wrong phenomenon',
    f(GLOW.how_it_could_fail.some((h) => /glow(s)? in the dark|wanted a fly that glows/i.test(h)),
      !GLOW.how_it_could_fail.some((h) => /glow(s)? in the dark|wanted a fly that glows/i.test(h))));

  check('glow case: says this is NOT an analogy mapping at all',
    f(/not an analogy mapping/i.test(GLOW.why_that_analogy_class),
      !/not an analogy mapping/i.test(GLOW.why_that_analogy_class)));

  check('glow case: says the function is ADDED rather than transferred',
    f(/added/i.test(GLOW.why_that_analogy_class) && /transferr?ed/i.test(GLOW.why_that_analogy_class),
      !(/added/i.test(GLOW.why_that_analogy_class) && /transferr?ed/i.test(GLOW.why_that_analogy_class))));

  check('glow case: says there is no fly orthologue and none is needed',
    f(/no (fly )?(insect )?(genome|counterpart|orthologue)/i.test(GLOW.why_that_analogy_class)
      && /needed/i.test(GLOW.why_that_analogy_class),
      !(/no (fly )?(insect )?(genome|counterpart|orthologue)/i.test(GLOW.why_that_analogy_class)
        && /needed/i.test(GLOW.why_that_analogy_class))));

  check('glow case: the promoter question is in the route, since it decides where and when',
    f(/promoter/i.test(GLOW.route), !/promoter/i.test(GLOW.route)));

  check('glow case: chromophore maturation and oxygen are among the things to measure',
    f(GLOW.what_would_have_to_be_measured.some((m) => /chromophore/i.test(m))
      && GLOW.what_would_have_to_be_measured.some((m) => /oxygen/i.test(m)),
      !(GLOW.what_would_have_to_be_measured.some((m) => /chromophore/i.test(m))
        && GLOW.what_would_have_to_be_measured.some((m) => /oxygen/i.test(m)))));

  check('glow case: the energetic/folding cost is listed as unmeasured rather than asserted',
    f(GLOW.what_would_have_to_be_measured.some((m) => /fitness cost/i.test(m))
      && GLOW.sources.some((s) => s.key === 'flyGfpFitnessCost' && s.doi === null),
      !(GLOW.what_would_have_to_be_measured.some((m) => /fitness cost/i.test(m))
        && GLOW.sources.some((s) => s.key === 'flyGfpFitnessCost' && s.doi === null))));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe protein case: three edits, three verdicts, and a use-case question');
// ---------------------------------------------------------------------------------------------------

check('protein case: verdict is polygenic-not-a-single-edit',
  f(WORM.verdict === 'polygenic-not-a-single-edit', WORM.verdict !== 'polygenic-not-a-single-edit'));

check('protein case: enumerates exactly the three ways to read "higher in protein"',
  f(Array.isArray(WORM.sub_routes) && WORM.sub_routes.length === 3,
    !(Array.isArray(WORM.sub_routes) && WORM.sub_routes.length === 3)),
  `n=${WORM.sub_routes?.length}`);

check('protein case: every sub-route carries its own verdict from the closed vocabulary',
  f(WORM.sub_routes.every((r) => ALLOWED_VERDICTS.includes(r.sub_verdict)),
    !WORM.sub_routes.every((r) => ALLOWED_VERDICTS.includes(r.sub_verdict))));

check('protein case: every sub-route says whether it is a single edit, as a boolean',
  f(WORM.sub_routes.every((r) => typeof r.is_a_single_edit === 'boolean'),
    !WORM.sub_routes.every((r) => typeof r.is_a_single_edit === 'boolean')));

check('protein case: every sub-route states its catch, so none is left flattered',
  f(WORM.sub_routes.every((r) => words(r.the_catch) >= 20),
    !WORM.sub_routes.every((r) => words(r.the_catch) >= 20)));

check('protein case: the ratio sub-route is a single edit YET is not endorsed as the answer',
  f(WORM.sub_routes.some((r) => r.is_a_single_edit === true && r.sub_verdict !== 'addable'),
    !WORM.sub_routes.some((r) => r.is_a_single_edit === true && r.sub_verdict !== 'addable')));

check('protein case: says plainly that the ratio route works by REMOVING LIPID',
  f(WORM.sub_routes.some((r) => /removing lipid|denominator shrank/i.test(r.the_catch)),
    !WORM.sub_routes.some((r) => /removing lipid|denominator shrank/i.test(r.the_catch))));

check('protein case: cites the measured baseline composition (60% protein of dry mass)',
  f(/60% protein/.test(JSON.stringify(WORM)), !/60% protein/.test(JSON.stringify(WORM))));

check('protein case: the baseline is attributed to a real source with a DOI',
  f(WORM.sources.some((s) => s.key === 'zecic2019' && DOI_SHAPE.test(s.doi || '')),
    !WORM.sources.some((s) => s.key === 'zecic2019' && DOI_SHAPE.test(s.doi || ''))));

check('protein case: carries the baseline\'s own caveat ("has not yet been characterised in detail")',
  f(/has not yet been characterised in detail/i.test(JSON.stringify(WORM)),
    !/has not yet been characterised in detail/i.test(JSON.stringify(WORM))));

check('protein case: notes the bacterial food is itself ~55% protein (so the trophic step buys little)',
  f(/55%/.test(JSON.stringify(WORM)), !/55%/.test(JSON.stringify(WORM))));

check('protein case: asks "protein for whom?" explicitly',
  f(/protein for whom/i.test(WORM.the_question_that_decides_the_use_case?.question || ''),
    !/protein for whom/i.test(WORM.the_question_that_decides_the_use_case?.question || '')));

check('protein case: answers that the limiting factor is digestibility or production cost, not content',
  f(/digestibilit/i.test(JSON.stringify(WORM.the_question_that_decides_the_use_case))
    && /production cost/i.test(JSON.stringify(WORM.the_question_that_decides_the_use_case)),
    !(/digestibilit/i.test(JSON.stringify(WORM.the_question_that_decides_the_use_case))
      && /production cost/i.test(JSON.stringify(WORM.the_question_that_decides_the_use_case)))));

check('protein case: names at least two actual limiting factors, each cited',
  f(Array.isArray(WORM.the_question_that_decides_the_use_case?.the_actual_limiting_factors)
    && WORM.the_question_that_decides_the_use_case.the_actual_limiting_factors.length >= 2,
    !(Array.isArray(WORM.the_question_that_decides_the_use_case?.the_actual_limiting_factors)
      && WORM.the_question_that_decides_the_use_case.the_actual_limiting_factors.length >= 2)));

check('protein case: the amino-acid sub-route admits it has no measured baseline',
  f(WORM.sources.some((s) => s.key === 'wormAminoAcidProfile' && s.doi === null && s.pmid === null),
    !WORM.sources.some((s) => s.key === 'wormAminoAcidProfile' && s.doi === null && s.pmid === null)));

check('protein case: a failure mode is the number rising because lipid fell',
  f(WORM.how_it_could_fail.some((h) => /lipid went down|leaner/i.test(h)),
    !WORM.how_it_could_fail.some((h) => /lipid went down|leaner/i.test(h))));

check('protein case: a failure mode is measuring the bacteria in the gut instead of the worm',
  f(WORM.how_it_could_fail.some((h) => /bacterial protein/i.test(h)),
    !WORM.how_it_could_fail.some((h) => /bacterial protein/i.test(h))));

// ---------------------------------------------------------------------------------------------------
console.log('\nCRISPR relevance: no case claims CRISPR is appropriate without saying why');
// ---------------------------------------------------------------------------------------------------

check('CRISPR_RELEVANCE covers every case, one entry each',
  f(CRISPR_RELEVANCE.length === CASES.length
    && CASES.every((c) => CRISPR_RELEVANCE.some((r) => r.case_id === c.id)),
    !(CRISPR_RELEVANCE.length === CASES.length
      && CASES.every((c) => CRISPR_RELEVANCE.some((r) => r.case_id === c.id)))));

check('CRISPR_RELEVANCE is frozen, entries and all',
  f(Object.isFrozen(CRISPR_RELEVANCE) && CRISPR_RELEVANCE.every((r) => Object.isFrozen(r)),
    !(Object.isFrozen(CRISPR_RELEVANCE) && CRISPR_RELEVANCE.every((r) => Object.isFrozen(r)))));

check('every CRISPR entry states is_crispr_the_right_tool as a boolean',
  f(CRISPR_RELEVANCE.every((r) => typeof r.is_crispr_the_right_tool === 'boolean'),
    !CRISPR_RELEVANCE.every((r) => typeof r.is_crispr_the_right_tool === 'boolean')));

// The headline rule: an appropriateness claim with no reasoning is the hammer behaviour this guards against.
check('NO case claims CRISPR is appropriate without saying why',
  f(CRISPR_RELEVANCE.every((r) => r.is_crispr_the_right_tool !== true || words(r.why) >= 20),
    !CRISPR_RELEVANCE.every((r) => r.is_crispr_the_right_tool !== true || words(r.why) >= 20)),
  CRISPR_RELEVANCE.filter((r) => r.is_crispr_the_right_tool === true && words(r.why) < 20)
    .map((r) => r.case_id).join(','));

check('every CRISPR entry gives a substantive why, whichever way it answers',
  f(CRISPR_RELEVANCE.every((r) => words(r.why) >= 20),
    !CRISPR_RELEVANCE.every((r) => words(r.why) >= 20)),
  CRISPR_RELEVANCE.map((r) => `${r.case_id}:${words(r.why)}w`).join(' '));

check('every CRISPR entry names a preferred tool instead of leaving a gap',
  f(CRISPR_RELEVANCE.every((r) => nonEmptyStr(r.preferred_tool)),
    !CRISPR_RELEVANCE.every((r) => nonEmptyStr(r.preferred_tool))));

check('glow case: CRISPR is not the right tool, and transgenesis is named instead',
  f(crisprFor('glowing-fly').is_crispr_the_right_tool === false
    && /transgenesis/i.test(crisprFor('glowing-fly').why)
    && /phiC31|piggyBac|P-element/i.test(crisprFor('glowing-fly').preferred_tool),
    !(crisprFor('glowing-fly').is_crispr_the_right_tool === false
      && /transgenesis/i.test(crisprFor('glowing-fly').why)
      && /phiC31|piggyBac|P-element/i.test(crisprFor('glowing-fly').preferred_tool))));

check('glow case: knock-in at a safe harbour is acknowledged as possible but not required',
  f(crisprFor('glowing-fly').crispr_is_possible_but_not_required === true
    && /safe harbour|safe harbor|knock-in/i.test(crisprFor('glowing-fly').why),
    !(crisprFor('glowing-fly').crispr_is_possible_but_not_required === true
      && /safe harbour|safe harbor|knock-in/i.test(crisprFor('glowing-fly').why))));

check('protein case: flagged as right tool, wrong target',
  f(crisprFor('protein-worm').right_tool_wrong_target === true,
    crisprFor('protein-worm').right_tool_wrong_target !== true));

check('methane case: CRISPR on the cow is called beside the point',
  f(crisprFor('low-methane-cow').is_crispr_the_right_tool === false
    && /beside the point/i.test(crisprFor('low-methane-cow').why),
    !(crisprFor('low-methane-cow').is_crispr_the_right_tool === false
      && /beside the point/i.test(crisprFor('low-methane-cow').why))));

check('methane case: the preferred tool is an additive and/or selection, not a cassette',
  f(/additive/i.test(crisprFor('low-methane-cow').preferred_tool)
    && /selection/i.test(crisprFor('low-methane-cow').preferred_tool),
    !(/additive/i.test(crisprFor('low-methane-cow').preferred_tool)
      && /selection/i.test(crisprFor('low-methane-cow').preferred_tool))));

check('CRISPR is the right tool for none of the three as phrased (that is the hammer finding)',
  f(CRISPR_RELEVANCE.every((r) => r.is_crispr_the_right_tool === false),
    !CRISPR_RELEVANCE.every((r) => r.is_crispr_the_right_tool === false)));

check('THE_HAMMER states the warning and is frozen',
  f(Object.isFrozen(THE_HAMMER) && /hammer/i.test(THE_HAMMER.statement)
    && words(THE_HAMMER.evidence_from_this_set) >= 25,
    !(Object.isFrozen(THE_HAMMER) && /hammer/i.test(THE_HAMMER.statement)
      && words(THE_HAMMER.evidence_from_this_set) >= 25)));

// ---------------------------------------------------------------------------------------------------
console.log('\nsources: every non-null source has a plausible DOI or PMID shape; every null is flagged');
// ---------------------------------------------------------------------------------------------------

for (const c of CASES) {
  check(`${c.id}: has at least four sources`,
    f(c.sources.length >= 4, !(c.sources.length >= 4)), `n=${c.sources.length}`);

  check(`${c.id}: every source is an object with citation, doi, pmid keys`,
    f(c.sources.every((s) => s && typeof s === 'object'
      && 'citation' in s && 'doi' in s && 'pmid' in s),
      !c.sources.every((s) => s && typeof s === 'object'
        && 'citation' in s && 'doi' in s && 'pmid' in s)));

  const bad = c.sources.filter((s) => {
    if (s.doi === null && s.pmid === null) return false;        // nulls checked separately
    const doiOk = s.doi === null || DOI_SHAPE.test(s.doi);
    const pmidOk = s.pmid === null || PMID_SHAPE.test(s.pmid);
    const hasOne = DOI_SHAPE.test(s.doi || '') || PMID_SHAPE.test(s.pmid || '');
    return !(doiOk && pmidOk && hasOne);
  });
  check(`${c.id}: every non-null source has a plausible DOI or PMID shape`,
    f(bad.length === 0, bad.length !== 0),
    bad.map((s) => `${s.key}(doi=${s.doi},pmid=${s.pmid})`).join(' '));

  check(`${c.id}: every source says what it supports`,
    f(c.sources.every((s) => words(s.supports) >= 10 || words(s.null_reason) >= 10),
      !c.sources.every((s) => words(s.supports) >= 10 || words(s.null_reason) >= 10)));

  check(`${c.id}: every source records how it was verified`,
    f(c.sources.every((s) => nonEmptyStr(s.verified_how)),
      !c.sources.every((s) => nonEmptyStr(s.verified_how))));
}

check('every source carrying a DOI uses the 10.xxxx/ form (no bare URLs, no invented prefixes)',
  f(ALL_SOURCES.filter((s) => s.doi !== null).every((s) => DOI_SHAPE.test(s.doi)),
    !ALL_SOURCES.filter((s) => s.doi !== null).every((s) => DOI_SHAPE.test(s.doi))));

check('every source carrying a PMID uses 4-8 digits',
  f(ALL_SOURCES.filter((s) => s.pmid !== null).every((s) => PMID_SHAPE.test(s.pmid)),
    !ALL_SOURCES.filter((s) => s.pmid !== null).every((s) => PMID_SHAPE.test(s.pmid))));

check('ANY null source is flagged with a null_reason, so an absence is never silent',
  f(NULL_SOURCES.length > 0 && NULL_SOURCES.every((s) => words(s.null_reason) >= 10),
    !(NULL_SOURCES.length > 0 && NULL_SOURCES.every((s) => words(s.null_reason) >= 10))),
  `${NULL_SOURCES.length} null source(s)`);

check('a null source has BOTH doi and pmid null (no half-identified citations)',
  f(ALL_SOURCES.every((s) => (s.doi === null) === (s.pmid === null)
    || DOI_SHAPE.test(s.doi || '') || PMID_SHAPE.test(s.pmid || '')),
    !ALL_SOURCES.every((s) => (s.doi === null) === (s.pmid === null)
      || DOI_SHAPE.test(s.doi || '') || PMID_SHAPE.test(s.pmid || ''))));

check('every null source is reachable from a case (no orphaned excuses)',
  f(NULL_SOURCES.every((s) => CASES.some((c) => c.sources.includes(s))),
    !NULL_SOURCES.every((s) => CASES.some((c) => c.sources.includes(s)))));

check('source keys are unique across the whole set',
  f(new Set(ALL_SOURCES.map((s) => s.key)).size === ALL_SOURCES.length,
    new Set(ALL_SOURCES.map((s) => s.key)).size !== ALL_SOURCES.length));

check('DOIs are unique (no citation duplicated under two keys)',
  f(new Set(ALL_SOURCES.filter((s) => s.doi).map((s) => s.doi)).size
    === ALL_SOURCES.filter((s) => s.doi).length,
    new Set(ALL_SOURCES.filter((s) => s.doi).map((s) => s.doi)).size
    !== ALL_SOURCES.filter((s) => s.doi).length));

check('PROVENANCE attributes the PubMed-derived information, per the PubMed terms',
  f(/PubMed/.test(PROVENANCE.attribution) && /DOI/.test(PROVENANCE.attribution),
    !(/PubMed/.test(PROVENANCE.attribution) && /DOI/.test(PROVENANCE.attribution))));

check('PROVENANCE reports the null-source count, matching NULL_SOURCES',
  f(PROVENANCE.null_source_count === NULL_SOURCES.length,
    PROVENANCE.null_source_count !== NULL_SOURCES.length));

check('PROVENANCE records an independent DOI-resolution check, not only the PubMed pairing',
  f(/crossref/i.test(PROVENANCE.doi_resolution_check || '')
    && nonEmptyStr(PROVENANCE.doi_resolution_checked_at),
    !(/crossref/i.test(PROVENANCE.doi_resolution_check || '')
      && nonEmptyStr(PROVENANCE.doi_resolution_checked_at))));

check('the DOI-resolution note covers every non-null DOI in the set',
  f(new RegExp(`\\b${ALL_SOURCES.filter((s) => s.doi !== null).length}\\b`)
    .test(PROVENANCE.doi_resolution_check || ''),
    !new RegExp(`\\b${ALL_SOURCES.filter((s) => s.doi !== null).length}\\b`)
      .test(PROVENANCE.doi_resolution_check || '')),
  `${ALL_SOURCES.filter((s) => s.doi !== null).length} non-null DOIs`);

// ---------------------------------------------------------------------------------------------------
console.log('\nTHE_SHARED_LESSON: three failure modes, one editing problem');
// ---------------------------------------------------------------------------------------------------

check('THE_SHARED_LESSON is frozen',
  f(Object.isFrozen(THE_SHARED_LESSON), !Object.isFrozen(THE_SHARED_LESSON)));

check('THE_SHARED_LESSON nested arrays are frozen too',
  f(Object.isFrozen(THE_SHARED_LESSON.three_distinct_failure_modes)
    && THE_SHARED_LESSON.three_distinct_failure_modes.every((x) => Object.isFrozen(x)),
    !(Object.isFrozen(THE_SHARED_LESSON.three_distinct_failure_modes)
      && THE_SHARED_LESSON.three_distinct_failure_modes.every((x) => Object.isFrozen(x)))));

check('THE_SHARED_LESSON states that only one is a genome-editing problem in the assumed shape',
  f(/only one of the three is a genome-editing problem/i.test(THE_SHARED_LESSON.statement),
    !/only one of the three is a genome-editing problem/i.test(THE_SHARED_LESSON.statement)));

check('THE_SHARED_LESSON states the three-times-wrong consequence',
  f(/wrong three times in three different ways/i.test(THE_SHARED_LESSON.statement),
    !/wrong three times in three different ways/i.test(THE_SHARED_LESSON.statement)));

check('THE_SHARED_LESSON names which single case is the editing problem, and it is a real case id',
  f(CASES.some((c) => c.id === THE_SHARED_LESSON.only_one_is_a_genome_editing_problem),
    !CASES.some((c) => c.id === THE_SHARED_LESSON.only_one_is_a_genome_editing_problem)),
  THE_SHARED_LESSON.only_one_is_a_genome_editing_problem);

check('the case named as the editing problem is the one with the addable verdict',
  f(byId(THE_SHARED_LESSON.only_one_is_a_genome_editing_problem).verdict === 'addable',
    byId(THE_SHARED_LESSON.only_one_is_a_genome_editing_problem).verdict !== 'addable'));

check('THE_SHARED_LESSON qualifies even that one (it is transgenesis, not CRISPR)',
  f(/transgenesis/i.test(THE_SHARED_LESSON.and_even_that_one),
    !/transgenesis/i.test(THE_SHARED_LESSON.and_even_that_one)));

{
  const fm = THE_SHARED_LESSON.three_distinct_failure_modes;

  check('THE_SHARED_LESSON lists exactly three failure modes',
    f(fm.length === 3, fm.length !== 3), `n=${fm.length}`);

  check('each failure mode maps to a real case id, one per case',
    f(fm.length === CASES.length
      && new Set(fm.map((x) => x.case_id)).size === 3
      && fm.every((x) => CASES.some((c) => c.id === x.case_id)),
      !(fm.length === CASES.length
        && new Set(fm.map((x) => x.case_id)).size === 3
        && fm.every((x) => CASES.some((c) => c.id === x.case_id)))));

  check('the three "not a ..." descriptions are distinct (they are different failure modes)',
    f(new Set(fm.map((x) => x.not_a)).size === 3, new Set(fm.map((x) => x.not_a)).size !== 3),
    fm.map((x) => x.not_a).join(' / '));

  check('each failure mode gives a substantive because',
    f(fm.every((x) => words(x.because) >= 20), !fm.every((x) => words(x.because) >= 20)));

  check('each failure mode says what a naive pipeline would get wrong',
    f(fm.every((x) => words(x.what_the_pipeline_would_get_wrong) >= 20),
      !fm.every((x) => words(x.what_the_pipeline_would_get_wrong) >= 20)));

  check('each failure mode\'s verdict matches its case\'s verdict (no drift between the two records)',
    f(fm.every((x) => byId(x.case_id).verdict === x.verdict),
      !fm.every((x) => byId(x.case_id).verdict === x.verdict)),
    fm.filter((x) => byId(x.case_id).verdict !== x.verdict).map((x) => x.case_id).join(','));

  check('the mapping-failure case is the glow case and the organism-failure case is the methane case',
    f(fm.find((x) => /mapping/i.test(x.not_a))?.case_id === 'glowing-fly'
      && fm.find((x) => /named organism/i.test(x.not_a))?.case_id === 'low-methane-cow',
      !(fm.find((x) => /mapping/i.test(x.not_a))?.case_id === 'glowing-fly'
        && fm.find((x) => /named organism/i.test(x.not_a))?.case_id === 'low-methane-cow')));
}

check('THE_SHARED_LESSON gives three checks, one per failure mode',
  f(Array.isArray(THE_SHARED_LESSON.the_three_checks_that_catch_them)
    && THE_SHARED_LESSON.the_three_checks_that_catch_them.length === 3,
    !(Array.isArray(THE_SHARED_LESSON.the_three_checks_that_catch_them)
      && THE_SHARED_LESSON.the_three_checks_that_catch_them.length === 3)));

check('each of the three checks says which case it catches',
  f(THE_SHARED_LESSON.the_three_checks_that_catch_them.every((x) => /Catches case \d/.test(x)),
    !THE_SHARED_LESSON.the_three_checks_that_catch_them.every((x) => /Catches case \d/.test(x))));

check('THE_SHARED_LESSON describes what a silent pipeline would have produced',
  f(words(THE_SHARED_LESSON.what_a_silent_pipeline_would_have_produced) >= 25
    && /cassette/i.test(THE_SHARED_LESSON.what_a_silent_pipeline_would_have_produced),
    !(words(THE_SHARED_LESSON.what_a_silent_pipeline_would_have_produced) >= 25
      && /cassette/i.test(THE_SHARED_LESSON.what_a_silent_pipeline_would_have_produced))));

check('THE_SHARED_LESSON explains why the set is three and not one',
  f(words(THE_SHARED_LESSON.why_the_set_is_three_and_not_one) >= 20,
    !(words(THE_SHARED_LESSON.why_the_set_is_three_and_not_one) >= 20)));

// ---------------------------------------------------------------------------------------------------
console.log('\nsibling independence: this file must build and pass without ./analogy.mjs');
// ---------------------------------------------------------------------------------------------------

{
  const x = await crossCheckAnalogyVocabulary();

  check('crossCheckAnalogyVocabulary resolves without throwing, present or absent',
    f(x && typeof x === 'object' && 'available' in x, !(x && typeof x === 'object' && 'available' in x)));

  check('it never throws: an absent or broken sibling yields available:false with a reason',
    f(x.available === true || (x.available === false && nonEmptyStr(x.module_error ?? x.note)),
      !(x.available === true || (x.available === false && nonEmptyStr(x.module_error ?? x.note)))));

  check('it reports the analogy classes this file actually uses, whatever the sibling says',
    f(Array.isArray(x.classes_used) && x.classes_used.length === 3
      && x.classes_used.every((c) => CASES.some((k) => k.analogy_class === c)),
      !(Array.isArray(x.classes_used) && x.classes_used.length === 3
        && x.classes_used.every((c) => CASES.some((k) => k.analogy_class === c)))));

  check('the verdicts do not depend on the sibling module (local vocabulary stands alone)',
    f(CASES.every((c) => Object.values(ANALOGY_CLASSES).includes(c.analogy_class)),
      !CASES.every((c) => Object.values(ANALOGY_CLASSES).includes(c.analogy_class))));

  if (x.available) {
    console.log(`       (./analogy.mjs present, vocabulary from ${x.vocabulary_source}: ` +
      `${x.recognised.length} recognised, ${x.unrecognised.length} on a different axis)`);
  } else {
    console.log(`       (./analogy.mjs not usable yet: ${x.module_error || x.note})`);
  }
}

// ---------------------------------------------------------------------------------------------------
console.log('\nhonesty: nothing here flatters a request');
// ---------------------------------------------------------------------------------------------------

check('no case is given a clean yes: every one carries failure modes',
  f(CASES.every((c) => c.how_it_could_fail.length >= 4),
    !CASES.every((c) => c.how_it_could_fail.length >= 4)));

check('the only "addable" case still says the deliverable is probably not what was asked for',
  f(/probably not what was asked for|not what was asked/i.test(THE_SHARED_LESSON.and_even_that_one),
    !/probably not what was asked for|not what was asked/i.test(THE_SHARED_LESSON.and_even_that_one)));

check('every case names something that must be measured before anyone proceeds',
  f(CASES.every((c) => c.what_would_have_to_be_measured.length >= 4),
    !CASES.every((c) => c.what_would_have_to_be_measured.length >= 4)));

check('THE_SHARED_LESSON records that none of the three verdicts is the wanted one',
  f(/none of these three verdicts is the one the requester wanted/i.test(THE_SHARED_LESSON.the_honesty_rule),
    !/none of these three verdicts is the one the requester wanted/i.test(THE_SHARED_LESSON.the_honesty_rule)));

// ---------------------------------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(pass === 0
    ? '--fail-once: correct, zero assertions passed under the injected fault.'
    : `--fail-once: ${pass} assertion(s) STILL PASSED. Those predicates do not bite; fix them.`);
}
process.exit(fail && !FAULT ? 1 : 0);
