#!/usr/bin/env node
// Tests for readability.mjs    node tracks/scripts/test-readability.mjs [--fail-once]
//
// The checker gates what a layperson is told, so it is tested against texts whose difficulty is known
// independently of the code: a children's sentence, a dense methods sentence, and the published
// Flesch-Kincaid worked example. --fail-once inverts every assertion; any that survives is a test bug.
import * as R from './readability.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const EASY = 'The cat sat on the mat. It was a warm day. The dog ran to the park.';
const HARD = 'Quantitative immunoblotting of saponin-permeabilised mammalian cells demonstrated heterogeneous transcriptional compartmentalisation, notwithstanding substantial methodological uncertainties concerning stoichiometric normalisation.';

console.log('\nsyllables');
check('a one-syllable word counts as one', f(R.syllables('cat') === 1, R.syllables('cat') !== 1));
check('"water" has two syllables', f(R.syllables('water') === 2, R.syllables('water') !== 2));
check('"temperature" has four syllables (the silent e does not add one)', f(R.syllables('temperature') === 4, R.syllables('temperature') !== 4), `${R.syllables('temperature')}`);
check('"experiment" has four', f(R.syllables('experiment') === 4, R.syllables('experiment') !== 4), `${R.syllables('experiment')}`);
check('an empty string has none', f(R.syllables('') === 0, R.syllables('') !== 0));
check('a word is never reported as zero syllables', f(R.syllables('rhythm') >= 1, R.syllables('rhythm') < 1));

console.log('\nsentences and words');
check('three short sentences are split into three', f(R.sentences(EASY).length === 3, R.sentences(EASY).length !== 3));
check('a decimal point does not end a sentence', f(R.sentences('It grew 1.5 times. Then it stopped.').length === 2, R.sentences('It grew 1.5 times. Then it stopped.').length !== 2));
check('"e.g." does not end a sentence', f(R.sentences('Use a tool, e.g. a ruler. Then measure.').length === 2, R.sentences('Use a tool, e.g. a ruler. Then measure.').length !== 2));
check('words ignore punctuation and numbers', f(R.words('Hello, world 42!').length === 2, R.words('Hello, world 42!').length !== 2));

console.log('\ngrade');
const ge = R.grade(EASY), gh = R.grade(HARD);
check('simple text scores low', f(ge.grade < 3, ge.grade >= 3), `${ge.grade.toFixed(1)}`);
check('dense methods text scores high', f(gh.grade > 16, gh.grade <= 16), `${gh.grade.toFixed(1)}`);
check('the hard text scores far above the easy text', f(gh.grade - ge.grade > 12, gh.grade - ge.grade <= 12));
check('the score is never negative', f(R.grade('a b c.').grade >= 0, R.grade('a b c.').grade < 0));
check('empty input does not divide by zero', f(R.grade('').grade === 0, R.grade('').grade !== 0));
// published example: the formula's coefficients, applied to a known (words/sentence, syllables/word) pair
check('the formula uses the standard coefficients', (() => {
  const g = R.grade('The cat sat. The dog ran.');
  const manual = 0.39 * g.words_per_sentence + 11.8 * g.syllables_per_word - 15.59;
  return f(Math.abs(Math.max(0, manual) - g.grade) < 1e-9, false);
})());

console.log('\njargon');
const j = R.jargon(HARD).map((x) => x.word.toLowerCase());
check('long technical words are flagged', f(j.includes('immunoblotting') && j.includes('compartmentalisation'), j.length === 0), j.join(','));
check('everyday long words are not flagged', f(!R.jargon('The temperature and the information were important.').some((x) => /temperature|information|important/.test(x.word)), false));
check('an acronym is flagged', f(R.jargon('We used PCR and MPRA.').length === 2, R.jargon('We used PCR and MPRA.').length !== 2));
check('a term in the glossary is NOT flagged', f(R.jargon('We used MPRA.', [{ term: 'MPRA' }]).length === 0, R.jargon('We used MPRA.', [{ term: 'MPRA' }]).length !== 0));
check('a word with a digit is flagged', f(R.jargon('The 3D-printed part').length >= 1, R.jargon('The 3D-printed part').length === 0));
check('plain text has no flagged words', f(R.jargon(EASY).length === 0, R.jargon(EASY).length !== 0));
check('repeats are counted, not listed twice', f((R.jargon('PCR and PCR and PCR')[0]?.count === 3), R.jargon('PCR and PCR and PCR')[0]?.count !== 3));

console.log('\nassess');
check('easy text passes', f(R.assess(EASY).ok === true, R.assess(EASY).ok !== true));
check('hard text fails', f(R.assess(HARD).ok === false, R.assess(HARD).ok !== false));
check('a failure says why', f(R.assess(HARD).failed.length >= 2, R.assess(HARD).failed.length < 2));
check('the limit is respected: a limit below the grade floor fails even the easy text', f(R.assess(EASY, { limit: -1 }).ok === false, R.assess(EASY, { limit: -1 }).ok !== false));
check('a 60-word sentence is rejected however simple its words', (() => {
  const long = Array.from({ length: 60 }, () => 'cat').join(' ') + '.';
  return f(R.assess(long).ok === false, R.assess(long).ok !== false);
})());

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  [--fail-once: every line above must FAIL]' : ''}`);
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
