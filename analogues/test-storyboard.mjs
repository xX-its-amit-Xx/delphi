#!/usr/bin/env node
// node analogues/test-storyboard.mjs [--fail-once]

import { STAGES, WHY_IT_CAN_FAIL, buildCase, buildAll } from './storyboard.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};
const f = (real, broken) => (FAULT ? broken : real);

// Stand-in modules, so the storyboard's LOGIC is tested without depending on the real ones landing.
const FIXTURE = {
  cases: {
    CASES: [
      { id: 'glowing-fly', request: 'a fruit fly that glows', what_is_actually_being_asked: 'fluorescence, probably',
        target_organism: 'Drosophila melanogaster', is_the_target_organism_the_right_one: true,
        analogy_class: 'foreign addition with no orthologue', verdict: 'addable',
        how_it_could_fail: 'the asker meant bioluminescence', sources: ['doi:10.0000/x'] },
      { id: 'protein-worm', request: 'higher protein', what_is_actually_being_asked: 'composition',
        target_organism: 'Caenorhabditis elegans', is_the_target_organism_the_right_one: true,
        analogy_class: 'polygenic quantitative trait', verdict: 'polygenic-not-a-single-edit',
        how_it_could_fail: 'no single edit moves it', sources: [] },
      { id: 'low-methane-cow', request: 'less methane', what_is_actually_being_asked: 'enteric methane',
        target_organism: 'Bos taurus', is_the_target_organism_the_right_one: false,
        analogy_class: 'trait of an associated community', verdict: 'wrong-organism',
        how_it_could_fail: 'n/a', sources: [] },
    ],
  },
  inventory: { SPECIES: [{ common_name: 'zebrafish', binomial: 'Danio rerio', why: 'the base organism' }] },
  analogy: { EVIDENCE_KINDS: { orthology: {}, rescue: {} } },
  phylo: { TREE: '(a,b);', THE_NAMING_TRAP: 'x' },
  align: { needlemanWunsch: () => ({}) },
};

console.log('the stage list');
check('there are stages, each with an id and a title', f(
  STAGES.length >= 6 && STAGES.every(s => s.id && s.title && s.what),
  STAGES.length >= 6 && STAGES.every(s => s.id && s.title && s.what && s.id !== 'request')));
check('stage ids are unique', f(
  new Set(STAGES.map(s => s.id)).size === STAGES.length,
  new Set(STAGES.map(s => s.id)).size !== STAGES.length));
check('the pipeline reaches a cassette stage and a verdict stage', f(
  STAGES.some(s => s.id === 'cassette') && STAGES.some(s => s.id === 'verdict'),
  !STAGES.some(s => s.id === 'cassette')));

console.log('degradation without the modules');
{
  const b = await buildCase('nothing-here', { cases: null, analogy: null, phylo: null, align: null, inventory: null });
  check('an absent case still produces a storyboard rather than throwing', f(b && Array.isArray(b.stages), !b));
  check('and it says it did not find the case', f(b.found === false, b.found === true));
  check('missing modules are NAMED, not silently absent', f(
    b.modules_missing.length > 0, b.modules_missing.length === 0), b.modules_missing.join(','));
  const mine = b.stages.find(s => s.id === 'mine');
  check('with no inventory, mining DEGRADES rather than reporting a pass', f(
    mine.outcome === 'degrade', mine.outcome === 'proceed'), mine.outcome);
  check('and it says nothing was searched rather than showing a count of zero as success', f(
    mine.species_searched === 0 && /not a pass/i.test(mine.note), mine.species_searched !== 0));
}

console.log('the refusals, which are the point');
{
  const cow = await buildCase('low-methane-cow', FIXTURE);
  check('a wrong-organism case REFUSES at the mapping stage', f(
    cow.stages.find(s => s.id === 'map').outcome === 'refuse',
    cow.stages.find(s => s.id === 'map').outcome !== 'refuse'));
  check('its refusal says the genome cannot produce the trait', f(
    /wrong genome|not encoded|editing the wrong/i.test(cow.stages.find(s => s.id === 'map').refusal ?? ''),
    !/wrong genome|not encoded|editing the wrong/i.test(cow.stages.find(s => s.id === 'map').refusal ?? '')));
  check('it never reaches a cassette', f(cow.reached_cassette === false, cow.reached_cassette === true));
  check('and refused_at names where', f(cow.refused_at === 'map', cow.refused_at !== 'map'), String(cow.refused_at));

  const worm = await buildCase('protein-worm', FIXTURE);
  check('a polygenic case gets through mapping but is refused a cassette', f(
    worm.stages.find(s => s.id === 'map').outcome === 'proceed' && worm.stages.find(s => s.id === 'cassette').outcome === 'refuse',
    worm.stages.find(s => s.id === 'cassette').outcome === 'proceed'));
  check('the cassette refusal quotes the verdict that caused it', f(
    /polygenic/.test(worm.stages.find(s => s.id === 'cassette').refusal ?? ''),
    !/polygenic/.test(worm.stages.find(s => s.id === 'cassette').refusal ?? '')));

  const fly = await buildCase('glowing-fly', FIXTURE);
  check('an addable case DOES reach a cassette, or the animation shows nothing working', f(
    fly.reached_cassette === true && fly.refused_at === null,
    fly.reached_cassette === false));
}

console.log('the set as a whole');
{
  const all = await buildAll(FIXTURE);
  check('every case is built', f(all.cases.length === 3, all.cases.length !== 3));
  // THE load-bearing assertion: a storyboard where everything succeeds is a bug in the storyboard.
  check('at least one case refuses before reaching a cassette, or the animation is a brochure', f(
    all.refused >= 1, all.refused === 0), `${all.refused} refused`);
  check('not everything refuses either, or it shows nothing working', f(
    all.reached_cassette >= 1, all.reached_cassette === 0));
  check('the headline states the ratio rather than only the successes', f(
    /of \d+ requests reach a cassette/.test(all.the_headline), !/reach a cassette/.test(all.the_headline)),
    all.the_headline);
  check('the design rule is stated in the artefact, not only in a comment', f(
    /marketing asset/.test(WHY_IT_CAN_FAIL.because) && typeof WHY_IT_CAN_FAIL.the_test === 'string',
    !/marketing asset/.test(WHY_IT_CAN_FAIL.because)));
  check('the storyboard carries no timestamp, so it is reproducible', f(
    !JSON.stringify(all).match(/\d{4}-\d{2}-\d{2}T\d{2}:/), Boolean(JSON.stringify(all).match(/\d{4}-\d{2}-\d{2}T\d{2}:/))));
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should FAIL; any "ok" is a test that does not test)' : ''}`);
process.exit(fail && !FAULT ? 1 : 0);
