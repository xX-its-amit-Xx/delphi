#!/usr/bin/env node
// Tests for devlog/glossary.mjs.
//
// House discipline: every assertion is written twice, once as the real predicate and once INVERTED.
// `node devlog/test-glossary.mjs --fail-once` runs the inverted form of every assertion, and ZERO of
// them may print "ok" - an assertion that survives its own fault was not testing its subject. The
// inversions here are negations, never loosened thresholds, because a loosened threshold still passes
// on correct data and would be reported as a survivor.

import {
  GLOSSARY, CATEGORIES, UNDEFINED_BUT_USED, lookup, byId, annotate, categoryCounts,
} from './glossary.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const REQUIRED = ['id', 'term', 'aliases', 'short', 'long', 'concrete_example', 'why_it_matters_here', 'see_also', 'category'];
const MUST_COVER = [
  'ortholog', 'paralog', 'ohnolog', 'homology', 'analogy', 'synteny', 'rescue', 'the ortholog conjecture',
  'teleost genome duplication', 'CRISPR', 'Cas9', 'PAM', 'spacer', 'protospacer', 'sgRNA', 'HDR', 'NHEJ',
  'homology arm', 'safe harbour', 'cassette', 'promoter', 'terminator', 'transgenesis', 'knock-in',
  'knockout', 'allometry', 'R*', 'Monod kinetics', 'ZNGI', 'competitive exclusion', 'founder control',
  'Mahalanobis distance', 'AUC', 'hard negative', 'decoy', 'bootstrap confidence interval',
  "Spearman's rho", 'overdispersion', 'non-vacuity', 'vacuous truth', 'mutation testing', 'Lean',
  'proof assistant', 'axiom', 'sorry', 'Carnegie stage', 'somite', 'morula', 'blastomere',
  'trophectoderm', 'inner cell mass', 'in situ', 'transcriptome', 'compliance vs modulus',
  'Needleman-Wunsch', 'Smith-Waterman', 'affine gap', 'BLOSUM62', 'percent identity', 'FASTA', 'STL',
  'provenance', 'holdout', '--fail-once', 'Delphi', 'Nous', 'Aletheia',
];

console.log('\n--- shape of the array ---');

check('at least 50 entries exist',
  f(GLOSSARY.length >= 50, !(GLOSSARY.length >= 50)),
  `${GLOSSARY.length}`);

check('no more than 80 entries',
  f(GLOSSARY.length <= 80, !(GLOSSARY.length <= 80)),
  `${GLOSSARY.length}`);

check('GLOSSARY is frozen',
  f(Object.isFrozen(GLOSSARY), !Object.isFrozen(GLOSSARY)));

check('every entry is frozen',
  f(GLOSSARY.every(g => Object.isFrozen(g)), !GLOSSARY.every(g => Object.isFrozen(g))));

console.log('\n--- required fields ---');

const missingField = GLOSSARY.flatMap(g => REQUIRED.filter(k => !(k in g)).map(k => `${g.id ?? '?'}.${k}`));
check('every entry has all nine required fields',
  f(missingField.length === 0, missingField.length !== 0),
  missingField.join(', '));

const badString = GLOSSARY.filter(g => ['id','term','short','long','concrete_example','why_it_matters_here','category']
  .some(k => typeof g[k] !== 'string' || g[k].trim() === ''));
check('every string field is a non-empty string',
  f(badString.length === 0, badString.length !== 0),
  badString.map(g => g.id).join(', '));

const badArray = GLOSSARY.filter(g => !Array.isArray(g.aliases) || !Array.isArray(g.see_also));
check('aliases and see_also are arrays on every entry',
  f(badArray.length === 0, badArray.length !== 0),
  badArray.map(g => g.id).join(', '));

const emptyExample = GLOSSARY.filter(g => typeof g.concrete_example !== 'string' || g.concrete_example.trim().length === 0);
check('every concrete_example is NON-EMPTY',
  f(emptyExample.length === 0, emptyExample.length !== 0),
  emptyExample.map(g => g.id).join(', '));

// A one-word "example" is not an example. The floor is deliberately low; it only catches a placeholder.
const thinExample = GLOSSARY.filter(g => g.concrete_example.trim().length < 40);
check('every concrete_example is more than a placeholder (>= 40 chars)',
  f(thinExample.length === 0, thinExample.length !== 0),
  thinExample.map(g => `${g.id}:${g.concrete_example.length}`).join(', '));

// The point of the field is specificity, so most examples should carry a digit from the repo's results.
const withNumber = GLOSSARY.filter(g => /\d/.test(g.concrete_example)).length;
check('most concrete_examples carry a real number from the repo',
  f(withNumber >= GLOSSARY.length * 0.6, !(withNumber >= GLOSSARY.length * 0.6)),
  `${withNumber}/${GLOSSARY.length}`);

const restated = GLOSSARY.filter(g => g.short.trim().toLowerCase() === g.term.trim().toLowerCase());
check('no short is a bare restatement of its own term',
  f(restated.length === 0, restated.length !== 0),
  restated.map(g => g.id).join(', '));

console.log('\n--- the 140-character hover budget ---');

const tooLong = GLOSSARY.filter(g => g.short.length >= 140);
check('every short is under 140 characters',
  f(tooLong.length === 0, tooLong.length !== 0),
  tooLong.map(g => `${g.id}:${g.short.length}`).join(', '));

const oneSentence = GLOSSARY.filter(g => (g.short.match(/[.!?](\s|$)/g) || []).length > 1);
check('every short is a single sentence',
  f(oneSentence.length === 0, oneSentence.length !== 0),
  oneSentence.map(g => g.id).join(', '));

const shortLong = GLOSSARY.filter(g => g.long.length <= g.short.length);
check('every long says more than its short',
  f(shortLong.length === 0, shortLong.length !== 0),
  shortLong.map(g => g.id).join(', '));

console.log('\n--- uniqueness of terms and aliases ---');

const seen = new Map();
const collisions = [];
for (const g of GLOSSARY) {
  for (const key of [g.term, ...g.aliases]) {
    const k = key.toLowerCase();
    if (seen.has(k)) collisions.push(`"${key}" in ${seen.get(k)} and ${g.id}`);
    else seen.set(k, g.id);
  }
}
check('no two entries share a term or an alias (case-insensitively)',
  f(collisions.length === 0, collisions.length !== 0),
  collisions.join('; '));

const ids = GLOSSARY.map(g => g.id);
check('every id is unique',
  f(new Set(ids).size === ids.length, !(new Set(ids).size === ids.length)),
  `${new Set(ids).size} of ${ids.length}`);

const selfAlias = GLOSSARY.filter(g => g.aliases.some(a => a.toLowerCase() === g.term.toLowerCase()));
check('no entry lists its own term as an alias',
  f(selfAlias.length === 0, selfAlias.length !== 0),
  selfAlias.map(g => g.id).join(', '));

console.log('\n--- see_also resolves ---');

const dangling = GLOSSARY.flatMap(g => g.see_also.filter(s => lookup(s) === null).map(s => `${g.id} -> ${s}`));
check('every see_also resolves to a real entry',
  f(dangling.length === 0, dangling.length !== 0),
  dangling.join(', '));

const selfRef = GLOSSARY.filter(g => g.see_also.some(s => lookup(s) === g));
check('no see_also points at its own entry',
  f(selfRef.length === 0, selfRef.length !== 0),
  selfRef.map(g => g.id).join(', '));

const noSeeAlso = GLOSSARY.filter(g => g.see_also.length === 0);
check('every entry links to at least one other term',
  f(noSeeAlso.length === 0, noSeeAlso.length !== 0),
  noSeeAlso.map(g => g.id).join(', '));

console.log('\n--- categories ---');

const badCategory = GLOSSARY.filter(g => !CATEGORIES.includes(g.category));
check('every category is in the vocabulary',
  f(badCategory.length === 0, badCategory.length !== 0),
  badCategory.map(g => `${g.id}:${g.category}`).join(', '));

const counts = categoryCounts();
const emptyCats = CATEGORIES.filter(c => counts[c] === 0);
check('every category in the vocabulary is used',
  f(emptyCats.length === 0, emptyCats.length !== 0),
  emptyCats.join(', '));

check('categoryCounts sums to the entry count',
  f(Object.values(counts).reduce((a, b) => a + b, 0) === GLOSSARY.length,
    Object.values(counts).reduce((a, b) => a + b, 0) !== GLOSSARY.length),
  JSON.stringify(counts));

console.log('\n--- coverage of the required vocabulary ---');

const uncovered = MUST_COVER.filter(t => lookup(t) === null);
check('every term the dev log must define is defined',
  f(uncovered.length === 0, uncovered.length !== 0),
  uncovered.join(', '));

check('the three DNA layers are each their own entry',
  f(lookup('Delphi') !== lookup('Nous') && lookup('Nous') !== lookup('Aletheia') && lookup('Delphi') !== null,
    !(lookup('Delphi') !== lookup('Nous') && lookup('Nous') !== lookup('Aletheia') && lookup('Delphi') !== null)));

console.log('\n--- lookup ---');

check('lookup finds an exact term',
  f(lookup('Mahalanobis distance')?.id === 'mahalanobis-distance',
    lookup('Mahalanobis distance')?.id !== 'mahalanobis-distance'));

check('lookup is case-insensitive',
  f(lookup('mahalanobis DISTANCE')?.id === 'mahalanobis-distance',
    lookup('mahalanobis DISTANCE')?.id !== 'mahalanobis-distance'));

check('lookup finds an alias',
  f(lookup('Mahalanobis')?.id === 'mahalanobis-distance',
    lookup('Mahalanobis')?.id !== 'mahalanobis-distance'));

check('lookup finds an alias case-insensitively',
  f(lookup('R-STAR')?.id === 'r-star', lookup('R-STAR')?.id !== 'r-star'));

check('lookup tolerates surrounding whitespace',
  f(lookup('  ohnologue  ')?.id === 'ohnolog', lookup('  ohnologue  ')?.id !== 'ohnolog'));

check('lookup returns null for an unknown term rather than throwing',
  f(lookup('zzz not a term zzz') === null, lookup('zzz not a term zzz') !== null));

check('lookup returns null for a non-string',
  f(lookup(42) === null && lookup(null) === null, !(lookup(42) === null && lookup(null) === null)));

check('byId resolves an id that is not a term',
  f(byId('fail-once')?.term === '--fail-once', byId('fail-once')?.term !== '--fail-once'));

console.log('\n--- annotate ---');

const longest = annotate('the scorer uses a Mahalanobis distance over ten traits');
check('annotate prefers the LONGEST match: "Mahalanobis distance" beats "Mahalanobis"',
  f(longest.length === 1 && longest[0].text === 'Mahalanobis distance',
    !(longest.length === 1 && longest[0].text === 'Mahalanobis distance')),
  JSON.stringify(longest.map(s => s.text)));

check('the longest match carries the right id',
  f(longest[0]?.id === 'mahalanobis-distance', longest[0]?.id !== 'mahalanobis-distance'));

const aliasOnly = annotate('the Mahalanobis geometry alone');
check('the shorter alias still matches when the long term is not present',
  f(aliasOnly.length === 1 && aliasOnly[0].text === 'Mahalanobis' && aliasOnly[0].id === 'mahalanobis-distance',
    !(aliasOnly.length === 1 && aliasOnly[0].text === 'Mahalanobis' && aliasOnly[0].id === 'mahalanobis-distance')),
  JSON.stringify(aliasOnly.map(s => s.text)));

const inWord = annotate('a PAMPHLET about PAMs is not a PAM');
check('annotate does not match inside a word ("PAM" in "PAMPHLET")',
  f(inWord.every(s => s.text === 'PAM'), !inWord.every(s => s.text === 'PAM')),
  JSON.stringify(inWord.map(s => [s.start, s.text])));

check('annotate finds the standalone occurrence it should',
  f(inWord.some(s => s.id === 'pam'), !inWord.some(s => s.id === 'pam')));

const noSubstring = annotate('synthetic sorrowful transgenics');
check('annotate matches no term inside "sorrowful" or "synthetic"',
  f(noSubstring.length === 0, noSubstring.length !== 0),
  JSON.stringify(noSubstring.map(s => s.text)));

const multi = annotate('A decoy that preserves correlation defeats the Mahalanobis distance, so the AUC falls to chance; the gate is exact arithmetic.');
const overlapping = multi.some((s, i) => i > 0 && s.start < multi[i - 1].end);
check('annotate returns non-overlapping spans',
  f(!overlapping, overlapping),
  JSON.stringify(multi.map(s => [s.start, s.end, s.text])));

const ascending = multi.every((s, i) => i === 0 || s.start >= multi[i - 1].start);
check('annotate returns spans in ascending order',
  f(ascending, !ascending));

check('annotate finds several distinct terms in one sentence',
  f(new Set(multi.map(s => s.id)).size >= 4, !(new Set(multi.map(s => s.id)).size >= 4)),
  JSON.stringify(multi.map(s => s.id)));

const slices = multi.every(s => s.text === 'A decoy that preserves correlation defeats the Mahalanobis distance, so the AUC falls to chance; the gate is exact arithmetic.'.slice(s.start, s.end));
check('every span\'s start/end actually slice out its own text',
  f(slices, !slices));

const punctTerm = annotate('see R* and the --fail-once flag');
check('annotate matches terms whose edges are not word characters (R*, --fail-once)',
  f(punctTerm.some(s => s.id === 'r-star') && punctTerm.some(s => s.id === 'fail-once'),
    !(punctTerm.some(s => s.id === 'r-star') && punctTerm.some(s => s.id === 'fail-once'))),
  JSON.stringify(punctTerm.map(s => s.text)));

check('annotate on an empty string returns an empty array',
  f(annotate('').length === 0, annotate('').length !== 0));

check('annotate on a non-string returns an empty array rather than throwing',
  f(annotate(null).length === 0 && annotate(7).length === 0,
    !(annotate(null).length === 0 && annotate(7).length === 0)));

const everyIdReal = annotate('ohnolog synteny ZNGI founder control').every(s => byId(s.id) !== null);
check('every span id resolves back to an entry',
  f(everyIdReal, !everyIdReal));

console.log('\n--- honesty about the gaps ---');

check('UNDEFINED_BUT_USED is a frozen, non-empty list',
  f(Object.isFrozen(UNDEFINED_BUT_USED) && UNDEFINED_BUT_USED.length > 0,
    !(Object.isFrozen(UNDEFINED_BUT_USED) && UNDEFINED_BUT_USED.length > 0)),
  `${UNDEFINED_BUT_USED.length}`);

const badGap = UNDEFINED_BUT_USED.filter(u => !u.term || !u.where_seen || !u.why_not_defined);
check('every undefined term says where it was seen and why it is not defined',
  f(badGap.length === 0, badGap.length !== 0),
  badGap.map(u => u.term).join(', '));

const doubleDipped = UNDEFINED_BUT_USED.filter(u => lookup(u.term) !== null);
check('nothing is both defined and listed as undefined',
  f(doubleDipped.length === 0, doubleDipped.length !== 0),
  doubleDipped.map(u => u.term).join(', '));

console.log(`\n  ${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(`  --fail-once: ${pass} assertion(s) survived their own fault (want 0)`);
}
process.exit(fail && !FAULT ? 1 : 0);
