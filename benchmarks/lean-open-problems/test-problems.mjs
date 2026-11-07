// Tests for the open-problems scoping list.
//
// House discipline: every assertion wraps its condition in `f(real, broken)`, where `broken` must be FALSE
// whenever the code is correct. Run with `--fail-once` and NOTHING may print `ok` - that is the only way to
// know the predicates are load-bearing rather than tautologies that pass on any input.
//
//   node benchmarks/lean-open-problems/test-problems.mjs
//   node benchmarks/lean-open-problems/test-problems.mjs --fail-once    # expect 0 ok, every check FAIL
//
// The substantive checks read lean/registry/laws/*.json and verify the overlap claims made in
// problems.mjs against it. A scoping document that asserts "the registry has no ecology law" without
// checking is a guess, so every such claim here is a test: if someone adds a coexistence law to the
// registry, `registry has no competitive-exclusion law` fails and the recommendation must be revisited.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PROBLEMS,
  TRIAGE,
  THE_HONEST_LIMIT,
  RECOMMENDED,
  NOT_RECOMMENDED_AND_WHY,
  FORMALISABLE_VOCAB,
  SETTLES_VOCAB,
  WHAT_THIS_IS,
} from './problems.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

// ---------------------------------------------------------------------------------------------------
// Load the registry the claims are made about.
// ---------------------------------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));
const LAWS_DIR = join(HERE, '..', '..', 'lean', 'registry', 'laws');
const LAWS = readdirSync(LAWS_DIR).filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(join(LAWS_DIR, n), 'utf8')));
const LAW_IDS = new Set(LAWS.map((l) => l.law_id));
const LAWS_BLOB = JSON.stringify(LAWS);

const REQUIRED = [
  'id', 'title', 'statement_en', 'field', 'why_it_is_open', 'source', 'formalisable',
  'settles_the_open_question', 'what_lean_would_add', 'the_hypotheses_it_would_need',
  'how_it_could_be_false', 'registry_overlap',
];

console.log(`\nlean-open-problems: ${PROBLEMS.length} problems, ${LAWS.length} registry laws${FAULT ? '   [--fail-once: EVERY check must FAIL]' : ''}\n`);

// ---------------------------------------------------------------------------------------------------
console.log('shape');
// ---------------------------------------------------------------------------------------------------

check('PROBLEMS is frozen',
  f(Object.isFrozen(PROBLEMS), !Object.isFrozen(PROBLEMS)));

check('PROBLEMS has 10-15 entries',
  f(PROBLEMS.length >= 10 && PROBLEMS.length <= 15, PROBLEMS.length > 15 || PROBLEMS.length < 10),
  `got ${PROBLEMS.length}`);

{
  const missing = PROBLEMS.flatMap((p) => REQUIRED.filter((k) => !(k in p)).map((k) => `${p.id || '?'}.${k}`));
  check('every problem has every required field',
    f(missing.length === 0, missing.length > 0),
    missing.join(', '));
}

{
  const ids = PROBLEMS.map((p) => p.id);
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  check('problem ids are unique',
    f(dupes.length === 0, dupes.length > 0),
    dupes.join(', '));
}

{
  const bad = PROBLEMS.filter((p) => typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id));
  check('problem ids are slug-shaped',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

check('WHAT_THIS_IS states the two-grade finding',
  f(/formalisable/i.test(WHAT_THIS_IS) && /settled/i.test(WHAT_THIS_IS),
    !(/formalisable/i.test(WHAT_THIS_IS) && /settled/i.test(WHAT_THIS_IS))));

// ---------------------------------------------------------------------------------------------------
console.log('\ngrades are in the vocabulary');
// ---------------------------------------------------------------------------------------------------

{
  const bad = PROBLEMS.filter((p) => !FORMALISABLE_VOCAB.includes(p.formalisable));
  check('formalisable is always one of the four grades',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => `${p.id}=${p.formalisable}`).join(', '));
}

{
  const bad = PROBLEMS.filter((p) => !SETTLES_VOCAB.includes(p.settles_the_open_question));
  check('settles_the_open_question is always in its vocabulary',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => `${p.id}=${p.settles_the_open_question}`).join(', '));
}

check('the vocabularies are frozen',
  f(Object.isFrozen(FORMALISABLE_VOCAB) && Object.isFrozen(SETTLES_VOCAB),
    !(Object.isFrozen(FORMALISABLE_VOCAB) && Object.isFrozen(SETTLES_VOCAB))));

{
  // A grade used by nothing is dead vocabulary; a list that uses only the optimistic grades is a wish list.
  const used = new Set(PROBLEMS.map((p) => p.formalisable));
  check('all four formalisable grades are actually used',
    f(FORMALISABLE_VOCAB.every((g) => used.has(g)), !FORMALISABLE_VOCAB.every((g) => used.has(g))),
    `used: ${[...used].join(', ')}`);
}

{
  // The headline finding: honest rejects must exist and must not be a token one.
  const rejects = PROBLEMS.filter((p) => p.formalisable === 'not-formalisable' || p.formalisable === 'statable-only');
  check('at least a third of the list is statable-only or not-formalisable',
    f(rejects.length >= PROBLEMS.length / 3, rejects.length < PROBLEMS.length / 3),
    `${rejects.length}/${PROBLEMS.length}`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nevery problem is actually a problem');
// ---------------------------------------------------------------------------------------------------

{
  // "A problem that cannot be false is not a problem."
  const TRIVIAL = /^(unknown|n\/?a|none|tbd|-{0,3})\.?$/i;
  const bad = PROBLEMS.filter((p) =>
    typeof p.how_it_could_be_false !== 'string' ||
    p.how_it_could_be_false.trim().length < 80 ||
    TRIVIAL.test(p.how_it_could_be_false.trim()));
  check('how_it_could_be_false is non-trivial everywhere',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  // A refutation condition that names no observation is prose, not a refutation condition.
  const OBSERVATIONAL = /measur|observ|experiment|refut|counterexample|data|fossil|estimat|demonstrat|construct|exhibit|comput|witness|fit\b|regression/i;
  const bad = PROBLEMS.filter((p) => !OBSERVATIONAL.test(p.how_it_could_be_false));
  check('how_it_could_be_false names an observation or a construction',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  const bad = PROBLEMS.filter((p) => p.why_it_is_open.trim().length < 120);
  check('why_it_is_open is substantive',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  // why_it_is_open must say what is unresolved, not restate the problem.
  const bad = PROBLEMS.filter((p) => p.why_it_is_open.trim() === p.statement_en.trim());
  check('why_it_is_open is not a copy of statement_en',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  const bad = PROBLEMS.filter((p) => p.the_hypotheses_it_would_need.trim().length < 100);
  check('the_hypotheses_it_would_need is spelled out, not gestured at',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  const bad = PROBLEMS.filter((p) => p.what_lean_would_add.trim().length < 100);
  check('what_lean_would_add is spelled out',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  // The brief said: for most, be honest that the answer is "little or nothing". Check that it is.
  const NEGATIVE = /\bnothing\b|\blittle\b|\bnot\b|\bnil\b|narrow|no information|worthless|adds nothing/i;
  const honest = PROBLEMS.filter((p) => NEGATIVE.test(p.what_lean_would_add));
  check('most what_lean_would_add answers are honestly negative',
    f(honest.length > PROBLEMS.length / 2, honest.length <= PROBLEMS.length / 2),
    `${honest.length}/${PROBLEMS.length}`);
}

{
  const bad = PROBLEMS.filter((p) => typeof p.field !== 'string' || p.field.trim().length < 3);
  check('every problem names a field',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nsources: real, or null and flagged');
// ---------------------------------------------------------------------------------------------------

{
  // A sourceless problem is allowed, but never silently.
  const bad = PROBLEMS.filter((p) => {
    const sourceless = p.source === null || p.source.citation === null || p.source.doi === null;
    if (!sourceless) return false;
    const flagged = typeof p.source?.verified === 'string' && p.source.verified.trim().length > 40;
    return !flagged;
  });
  check('every null-or-DOI-less source carries an explicit explanation',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  const nulls = PROBLEMS.filter((p) => p.source === null || p.source.citation === null);
  const unflagged = nulls.filter((p) => typeof p.source_note !== 'string' || p.source_note.trim().length < 40);
  check('a fully null source additionally carries source_note',
    f(unflagged.length === 0, unflagged.length > 0),
    `${nulls.length} null source(s): ${nulls.map((p) => p.id).join(', ')}; unflagged: ${unflagged.map((p) => p.id).join(', ')}`);
}

{
  // Every asserted DOI must look like a DOI and claim a verification.
  const withDoi = PROBLEMS.filter((p) => p.source && p.source.doi);
  const bad = withDoi.filter((p) => !/^10\.\d{4,9}\//.test(p.source.doi) || !/crossref/i.test(p.source.verified || ''));
  check('every asserted DOI is well-formed and marked Crossref-verified',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => `${p.id}:${p.source.doi}`).join(', '));
}

{
  const bad = PROBLEMS.flatMap((p) => (p.secondary_sources || [])
    .filter((s) => (s.doi !== null && !/^10\.\d{4,9}\//.test(s.doi)) || typeof s.verified !== 'string' || s.verified.length < 10)
    .map((s) => `${p.id}:${s.doi}`));
  check('every secondary source is well-formed and carries a verification note',
    f(bad.length === 0, bad.length > 0),
    bad.join(', '));
}

{
  // The two DOIs I got wrong from memory must not reappear anywhere in the file.
  const blob = readFileSync(join(HERE, 'problems.mjs'), 'utf8');
  const RETRACTED = ['10.1111/j.0269-8463.2004.00846.x'];
  const present = RETRACTED.filter((d) => new RegExp(`doi: ?'${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(blob));
  check('no retracted/misattributed DOI is asserted as a source',
    f(present.length === 0, present.length > 0),
    present.join(', '));
}

{
  // The Cooke & Zeeman DOI needs the S; the S-less form 404s.
  const somite = PROBLEMS.find((p) => p.id === 'somite-clock-scaling');
  check('Cooke & Zeeman DOI carries the S prefix',
    f(somite.source.doi === '10.1016/S0022-5193(76)80131-2', somite.source.doi !== '10.1016/S0022-5193(76)80131-2'),
    somite.source.doi);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nTRIAGE');
// ---------------------------------------------------------------------------------------------------

{
  const sum = Object.values(TRIAGE.by_formalisable).reduce((a, b) => a + b, 0);
  check('by_formalisable counts sum to PROBLEMS.length',
    f(sum === PROBLEMS.length, sum === PROBLEMS.length + 1),
    `${sum} vs ${PROBLEMS.length}`);
}

{
  const sum = Object.values(TRIAGE.by_settles_the_open_question).reduce((a, b) => a + b, 0);
  check('by_settles_the_open_question counts sum to PROBLEMS.length',
    f(sum === PROBLEMS.length, sum === PROBLEMS.length - 1),
    `${sum} vs ${PROBLEMS.length}`);
}

{
  const sum = Object.values(TRIAGE.by_registry_relation).reduce((a, b) => a + b, 0);
  check('by_registry_relation counts sum to PROBLEMS.length',
    f(sum === PROBLEMS.length, sum !== PROBLEMS.length),
    `${sum} vs ${PROBLEMS.length}`);
}

check('TRIAGE.total and counts_sum_check agree with PROBLEMS.length',
  f(TRIAGE.total === PROBLEMS.length && TRIAGE.counts_sum_check === PROBLEMS.length,
    TRIAGE.total !== PROBLEMS.length || TRIAGE.counts_sum_check !== PROBLEMS.length));

{
  const bad = Object.keys(TRIAGE.by_formalisable).filter((k) => !FORMALISABLE_VOCAB.includes(k));
  check('by_formalisable keys are all in the vocabulary',
    f(bad.length === 0, bad.length > 0),
    bad.join(', '));
}

{
  // Recount independently: the histogram must be derived from PROBLEMS, not typed in.
  const recount = {};
  for (const p of PROBLEMS) recount[p.formalisable] = (recount[p.formalisable] || 0) + 1;
  const same = FORMALISABLE_VOCAB.every((g) => (TRIAGE.by_formalisable[g] || 0) === (recount[g] || 0));
  check('by_formalisable matches an independent recount',
    f(same, !same),
    JSON.stringify(TRIAGE.by_formalisable));
}

{
  const recount = {};
  for (const p of PROBLEMS) recount[p.settles_the_open_question] = (recount[p.settles_the_open_question] || 0) + 1;
  const same = SETTLES_VOCAB.every((g) => (TRIAGE.by_settles_the_open_question[g] || 0) === (recount[g] || 0));
  check('by_settles_the_open_question matches an independent recount',
    f(same, !same),
    JSON.stringify(TRIAGE.by_settles_the_open_question));
}

check('TRIAGE is frozen',
  f(Object.isFrozen(TRIAGE), !Object.isFrozen(TRIAGE)));

{
  // The headline must lead with the honest ratio, not the flattering one.
  const h = TRIAGE.headline;
  const blunt = /wrong number|flatter|misleading/i.test(h) && /\bone\b|\b1\b/i.test(h);
  check('TRIAGE.headline leads with the unflattering number',
    f(blunt, !blunt));
}

{
  // The claim "exactly one settles anything" must be true of the data.
  const yes = PROBLEMS.filter((p) => p.settles_the_open_question === 'yes');
  check('exactly one problem is graded settles=yes, as the headline claims',
    f(yes.length === 1, yes.length !== 1),
    yes.map((p) => p.id).join(', '));
}

{
  const no = PROBLEMS.filter((p) => p.settles_the_open_question === 'no');
  check('the "11 of 14 settle nothing" claim matches the data',
    f(no.length === 11 && PROBLEMS.length === 14, !(no.length === 11 && PROBLEMS.length === 14)),
    `${no.length} of ${PROBLEMS.length}`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nregistry overlap claims, checked against lean/registry/laws/');
// ---------------------------------------------------------------------------------------------------

check('the registry was found and loaded',
  f(LAWS.length > 50, LAWS.length <= 50),
  `${LAWS.length} laws`);

{
  // Every law_id cited in an overlap claim must exist. This catches invented or stale ids.
  const bad = PROBLEMS.flatMap((p) => (p.registry_overlap.law_ids || [])
    .filter((id) => !LAW_IDS.has(id))
    .map((id) => `${p.id} -> ${id}`));
  check('every law_id cited in a registry_overlap exists in the registry',
    f(bad.length === 0, bad.length > 0),
    bad.join(', '));
}

{
  const RELATIONS = ['none', 'partial', 'direct-dependency', 'already-present-unproved'];
  const bad = PROBLEMS.filter((p) => !RELATIONS.includes(p.registry_overlap.relation));
  check('registry_overlap.relation is in its vocabulary',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => `${p.id}=${p.registry_overlap.relation}`).join(', '));
}

{
  const bad = PROBLEMS.filter((p) => typeof p.registry_overlap.note !== 'string' || p.registry_overlap.note.trim().length < 60);
  check('every overlap claim carries a note justifying it',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  // No problem may be a bare restatement of an existing law.
  const collide = PROBLEMS.filter((p) => LAW_IDS.has(p.id));
  check('no problem id collides with an existing law_id',
    f(collide.length === 0, collide.length > 0),
    collide.map((p) => p.id).join(', '));
}

{
  // relation 'none' must cite no law_ids as overlapping - adjacency goes elsewhere.
  const bad = PROBLEMS.filter((p) => p.registry_overlap.relation === 'none' && (p.registry_overlap.law_ids || []).length > 0
    && !/adjacent|not overlapping/i.test(p.registry_overlap.note));
  check('relation "none" cites no law unless the note calls it merely adjacent',
    f(bad.length === 0, bad.length > 0),
    bad.map((p) => p.id).join(', '));
}

{
  // THE CLAIM: elastic-similarity is already in the registry, unproved, status "proposed".
  const es = LAWS.find((l) => l.law_id === 'elastic-similarity');
  const asClaimed = !!es && es.status === 'proposed' && !es.lean_ref?.module;
  check('claim: elastic-similarity is present, status "proposed", with no Lean module',
    f(asClaimed, !asClaimed),
    es ? `status=${es.status} module=${es.lean_ref?.module}` : 'law not found');

  const prob = PROBLEMS.find((p) => p.id === 'elastic-vs-geometric-similarity');
  check('the elastic-similarity problem declares itself a deliberate duplicate',
    f(prob.registry_overlap.relation === 'already-present-unproved',
      prob.registry_overlap.relation !== 'already-present-unproved'),
    prob.registry_overlap.relation);
}

{
  // THE CLAIM: the registry contains no competitive-exclusion / coexistence law.
  const tight = /competitive exclusion|coexist|limiting factor|predator.prey|paradox of enrichment|carrying capacity/i;
  const hits = LAWS.filter((l) => tight.test(JSON.stringify(l))).map((l) => l.law_id);
  check('claim: registry has no competitive-exclusion or coexistence law',
    f(hits.length === 0, hits.length > 0),
    hits.join(', '));
}

{
  // THE CLAIM: no buckling criterion anywhere, so tree-height is a real gap.
  const hits = LAWS.filter((l) => /buckl|greenhill|euler column/i.test(JSON.stringify(l))).map((l) => l.law_id);
  check('claim: registry has no buckling law (tree-height gap is real)',
    f(hits.length === 0, hits.length > 0),
    hits.join(', '));
}

{
  // THE CLAIM: no age-structured demography, so senescence is an empty slot.
  const hits = LAWS.filter((l) => /senesc|euler-lotka|survivorship|age-specific mortality/i.test(JSON.stringify(l))).map((l) => l.law_id);
  check('claim: registry has no age-structured demography law (senescence slot is empty)',
    f(hits.length === 0, hits.length > 0),
    hits.join(', '));
}

{
  // THE CLAIM: fisher-ftns is accepted, so the total-change counterexample is a boundary not a duplicate.
  const ftns = LAWS.find((l) => l.law_id === 'fisher-ftns');
  check('claim: fisher-ftns is in the registry and accepted',
    f(!!ftns && ftns.status === 'accepted', !(!!ftns && ftns.status === 'accepted')),
    ftns ? ftns.status : 'not found');
}

{
  // THE CLAIM: Fisher.lean asserts in prose that the total-change version is false, and proves nothing.
  const fisherLean = readFileSync(join(HERE, '..', '..', 'lean', 'Delphi', 'Fisher.lean'), 'utf8');
  const asserted = /\*\*false\*\*\s+for\s+the\s+\*total\*\s+change/i.test(fisherLean.replace(/\s+/g, ' '));
  check('claim: Fisher.lean asserts the total-change theorem is false, in prose',
    f(asserted, !asserted));

  const proved = /theorem\s+\w*total\w*|mean_fitness_can_decrease/i.test(fisherLean);
  check('claim: Fisher.lean does NOT prove it (no total-change theorem present)',
    f(!proved, proved));
}

{
  // THE CLAIM in THE_HONEST_LIMIT: all 48 theorem-carrying laws have a non-vacuity witness.
  const withThm = LAWS.filter((l) => l.lean_ref?.module && l.lean_ref?.theorem);
  const withWitness = withThm.filter((l) => l.non_vacuity_witness);
  check('claim: 48 theorem-carrying laws, all with a non-vacuity witness',
    f(withThm.length === 48 && withWitness.length === 48,
      !(withThm.length === 48 && withWitness.length === 48)),
    `${withThm.length} with theorem, ${withWitness.length} with witness`);
}

{
  // ...and the 35 accepted ones the mutation README cites.
  const acceptedWithThm = LAWS.filter((l) => l.status === 'accepted' && l.lean_ref?.module && l.lean_ref?.theorem);
  check('claim: 35 accepted theorem-carrying laws (matches lean-mutation README)',
    f(acceptedWithThm.length === 35, acceptedWithThm.length !== 35),
    `${acceptedWithThm.length}`);
}

{
  // THE CLAIM: haldane cost accounting is carried as a never-proved named hypothesis.
  const h = LAWS.find((l) => l.law_id === 'haldane-cost-of-selection');
  const asClaimed = !!h && h.status === 'contested' && /NAMED HYPOTHESIS/i.test(h.statement_en);
  check('claim: haldane-cost-of-selection is contested and carried as a named hypothesis',
    f(asClaimed, !asClaimed),
    h ? h.status : 'not found');
}

{
  // Sanity on the registry blob itself, so the "no X law" checks above cannot pass by reading nothing.
  check('registry blob is substantial (guards the negative claims above)',
    f(LAWS_BLOB.length > 100000, LAWS_BLOB.length <= 100000),
    `${LAWS_BLOB.length} chars`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nRECOMMENDED');
// ---------------------------------------------------------------------------------------------------

check('RECOMMENDED has 2-3 entries',
  f(RECOMMENDED.length >= 2 && RECOMMENDED.length <= 3, RECOMMENDED.length > 3 || RECOMMENDED.length < 2),
  `${RECOMMENDED.length}`);

{
  const ids = new Set(PROBLEMS.map((p) => p.id));
  const orphans = RECOMMENDED.filter((r) => !ids.has(r.id));
  check('every RECOMMENDED id exists in PROBLEMS',
    f(orphans.length === 0, orphans.length > 0),
    orphans.map((r) => r.id).join(', '));
}

{
  const ranks = RECOMMENDED.map((r) => r.rank).sort((a, b) => a - b);
  const expected = RECOMMENDED.map((_, i) => i + 1);
  check('RECOMMENDED ranks are 1..n without gaps or ties',
    f(JSON.stringify(ranks) === JSON.stringify(expected), JSON.stringify(ranks) !== JSON.stringify(expected)),
    ranks.join(','));
}

{
  const bad = RECOMMENDED.filter((r) => typeof r.why !== 'string' || r.why.trim().length < 120);
  check('every recommendation gives a substantive reason',
    f(bad.length === 0, bad.length > 0),
    bad.map((r) => r.id).join(', '));
}

{
  const bad = RECOMMENDED.filter((r) => typeof r.lean_sketch_uncompiled !== 'string'
    || !/theorem|structure/.test(r.lean_sketch_uncompiled)
    || r.lean_sketch_uncompiled.length < 200);
  check('every recommendation carries a Lean statement sketch',
    f(bad.length === 0, bad.length > 0),
    bad.map((r) => r.id).join(', '));
}

{
  // The sketch is a string, not compiled - it must say so, so nobody mistakes it for a checked proof.
  const bad = RECOMMENDED.filter((r) => !/SKETCH, not compiled/i.test(r.lean_sketch_uncompiled));
  check('every sketch is marked as uncompiled',
    f(bad.length === 0, bad.length > 0),
    bad.map((r) => r.id).join(', '));
}

{
  const bad = RECOMMENDED.filter((r) => typeof r.what_it_does_not_do !== 'string' || r.what_it_does_not_do.trim().length < 60);
  check('every recommendation states what it does NOT do',
    f(bad.length === 0, bad.length > 0),
    bad.map((r) => r.id).join(', '));
}

{
  // A recommendation must not be graded not-formalisable - that would be incoherent.
  const byId = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
  const bad = RECOMMENDED.filter((r) => byId[r.id].formalisable === 'not-formalisable');
  check('no recommendation is graded not-formalisable',
    f(bad.length === 0, bad.length > 0),
    bad.map((r) => r.id).join(', '));
}

{
  // The rank-1 recommendation must be the one that actually settles something.
  const byId = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
  const top = RECOMMENDED.find((r) => r.rank === 1);
  check('the rank-1 recommendation is the only problem graded settles=yes',
    f(byId[top.id].settles_the_open_question === 'yes', byId[top.id].settles_the_open_question !== 'yes'),
    `${top.id}=${byId[top.id].settles_the_open_question}`);
}

{
  const recIds = new Set(RECOMMENDED.map((r) => r.id));
  const notRecIds = Object.keys(NOT_RECOMMENDED_AND_WHY);
  const overlap = notRecIds.filter((id) => recIds.has(id));
  check('nothing is both recommended and not-recommended',
    f(overlap.length === 0, overlap.length > 0),
    overlap.join(', '));
}

{
  const ids = new Set(PROBLEMS.map((p) => p.id));
  const orphans = Object.keys(NOT_RECOMMENDED_AND_WHY).filter((id) => !ids.has(id));
  check('every NOT_RECOMMENDED key exists in PROBLEMS',
    f(orphans.length === 0, orphans.length > 0),
    orphans.join(', '));
}

check('RECOMMENDED is frozen',
  f(Object.isFrozen(RECOMMENDED), !Object.isFrozen(RECOMMENDED)));

// ---------------------------------------------------------------------------------------------------
console.log('\nTHE_HONEST_LIMIT');
// ---------------------------------------------------------------------------------------------------

check('THE_HONEST_LIMIT is frozen',
  f(Object.isFrozen(THE_HONEST_LIMIT), !Object.isFrozen(THE_HONEST_LIMIT)));

{
  const keys = ['one_sentence', 'therefore', 'the_shape_of_the_mistake_to_avoid', 'the_narrow_win_that_is_real',
    'what_formalisation_cannot_catch', 'the_test_for_any_proposed_law'];
  const missing = keys.filter((k) => typeof THE_HONEST_LIMIT[k] !== 'string' || THE_HONEST_LIMIT[k].length < 60);
  check('THE_HONEST_LIMIT has all its sections, each substantive',
    f(missing.length === 0, missing.length > 0),
    missing.join(', '));
}

{
  // The core claim: Lean checks entailment, not premise truth.
  const s = THE_HONEST_LIMIT.one_sentence;
  const right = /premises/i.test(s) && /cannot/i.test(s) && /organism/i.test(s);
  check('one_sentence says Lean cannot check premises against organisms',
    f(right, !right),
    s);
}

{
  const t = THE_HONEST_LIMIT.therefore;
  const right = /vacuity/i.test(t) && /equivocation/i.test(t);
  check('therefore names vacuity and equivocation as the two real catches',
    f(right, !right));
}

{
  const w = THE_HONEST_LIMIT.the_narrow_win_that_is_real;
  const right = /48/.test(w) && /non-vacuity/i.test(w) && /narrow/i.test(w);
  check('the_narrow_win cites the 48-witness result and calls it narrow',
    f(right, !right));
}

{
  const w = THE_HONEST_LIMIT.what_formalisation_cannot_catch;
  const right = /statement_en/.test(w);
  check('what_formalisation_cannot_catch names the statement_en gap',
    f(right, !right));
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(`  --fail-once: ${pass === 0 ? 'OK - zero assertions passed, every predicate bites' : `BROKEN - ${pass} assertion(s) still passed and are not load-bearing`}`);
}
process.exit(fail && !FAULT ? 1 : 0);
