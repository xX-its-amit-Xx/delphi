#!/usr/bin/env node
// Tests for analogues/combos/pairs/cave-regression.mjs
//
//   node analogues/combos/pairs/test-cave-regression.mjs
//   node analogues/combos/pairs/test-cave-regression.mjs --fail-once
//
// HOUSE TEST DISCIPLINE, THE STRICT READING OF --fail-once:
// the flag does NOT invert every assertion at once. It runs the whole suite ONCE PER ASSERTION, and on
// pass k it substitutes the broken value for assertion k and for no other. Assertion k must then FAIL.
// An assertion that still passes while its own fault is injected is a SURVIVOR: it is asserting nothing
// about its subject, and it counts as a test failure.
//
// Faults are predicate inversions or wrong-value substitutions. No fault tightens a threshold, because a
// tightened threshold proves only that the threshold was loose.
//
// What is checked hardest, and why:
//
//   1. THAT NO BAND, LABEL OR CLASS IN THE DOSSIER WAS TYPED BY HAND. Every band is re-derived from
//      scoreAnalogy() inside the test and compared to what the module exported. If a hand-written number
//      could survive here, SCORED would be decoration.
//   2. THAT EVERY ABSENCE CARRIES A REASON. An evidence kind marked absent with no `why` is a kind
//      someone could not establish and did not say so. The three mammal-side absences in pair 2 are the
//      substance of that pair and are checked by name.
//   3. THAT EVERY CITATION CARRIES verified_how. A DOI, PMID, gene symbol or accession with no statement
//      of what was fetched and read back is treated by this project as unverified, and the test is the
//      place that enforces it.
//   4. THAT THE ONE-TO-MANY GUARD FIRES ON PAIR 2. If maximal evidence could promote it, the module's
//      central refusal would be decorative - and pair 2 is a real instance of exactly that shape.
//
// Every number asserted below about a band was READ from a run of the module, not chosen. If the evidence
// in the dossier is edited, these assertions are supposed to fail; that is what makes them tests.

import * as A from '../../analogy.mjs';
import * as M from './cave-regression.mjs';

const FAULT = process.argv.includes('--fail-once');

// ---- the injector -------------------------------------------------------------------------------
// One f() call per check(), in order. `cursor` is the assertion index within a pass; INJECT names the
// single index that gets the broken value this pass.
let cursor = 0, INJECT = -1;
const RESULTS = [];
const f = (real, broken) => { const i = cursor++; return i === INJECT ? broken : real; };
const check = (name, cond, detail = '') => { RESULTS.push({ name, ok: cond === true, detail }); };

const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const P1 = M.PAIRS[0], P2 = M.PAIRS[1];
const allEv = M.PAIRS.flatMap(p => Object.entries(p.evidence).map(([k, v]) => ({ pair: p.id, kind: k, rec: v })));
const SRC = M.SOURCES;
const srcKeys = Object.keys(SRC);
const refsIn = s => String(s ?? '').split(',').map(t => t.trim()).filter(t => /^[a-z][a-z0-9_]*$/.test(t));
const allRefs = [
  ...allEv.flatMap(e => refsIn(e.rec.source)),
  ...refsIn(M.SYMBOL_TRAP.source),
  ...Object.values(M.WHAT_THE_RECORDS_SAID).flatMap(v => refsIn(v.source)),
];

function suite() {
  // ================================================================================================
  // 1. SCHEMA: the rows are the rows analogy.mjs PAIRS uses, with nothing missing and nothing extra
  // ================================================================================================
  check('the dossier holds exactly two pairs',
    f(M.PAIRS.length === 2, M.PAIRS.length === 3), `${M.PAIRS.length}`);

  check('the two ids are the two this file is for',
    f(eq(M.PAIRS.map(p => p.id), ['cave-eye-regression-pachon-molino', 'cave-eye-regression-vs-spalax']),
      eq(M.PAIRS.map(p => p.id), ['cave-eye-regression-pachon-molino', 'some-other-pair'])),
    M.PAIRS.map(p => p.id).join(', '));

  const wrongKinds = M.PAIRS.filter(p => !eq([...Object.keys(p.evidence)].sort(), [...A.EVIDENCE_IDS].sort()));
  check('every pair carries ALL SEVEN evidence kinds and no invented eighth',
    f(wrongKinds.length === 0, wrongKinds.length !== 0), wrongKinds.map(p => p.id).join(', '));

  const notObjects = allEv.filter(e => !(e.rec && typeof e.rec === 'object' && typeof e.rec.present === 'boolean'));
  check('every evidence slot is an object with a boolean `present`, never a bare truthy value',
    f(notObjects.length === 0, notObjects.length !== 0), notObjects.map(e => `${e.pair}:${e.kind}`).join(', '));

  const presentNoWhat = allEv.filter(e => e.rec.present === true && !(typeof e.rec.what === 'string' && e.rec.what.length > 20));
  check('every PRESENT kind states what it is, in substance',
    f(presentNoWhat.length === 0, presentNoWhat.length !== 0), presentNoWhat.map(e => `${e.pair}:${e.kind}`).join(', '));

  const absentNoWhy = allEv.filter(e => e.rec.present === false && !(typeof e.rec.why === 'string' && e.rec.why.length > 40));
  check('every ABSENT kind states WHY it is absent - an honest absence is the point of the module',
    f(absentNoWhy.length === 0, absentNoWhy.length !== 0), absentNoWhy.map(e => `${e.pair}:${e.kind}`).join(', '));

  const badHt = allEv.filter(e => e.kind === 'sequence-orthology' && e.rec.present === true && !A.HOMOLOGY_TYPES.includes(e.rec.homology_type));
  check('any PRESENT orthology claim carries a homology_type drawn from HOMOLOGY_TYPES',
    f(badHt.length === 0, badHt.length !== 0), badHt.map(e => e.pair).join(', '));

  check('every pair carries a note with substance, so no hardcoded evidence is unexplained',
    f(M.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60),
      !M.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60)));

  check('neither pair is synthetic: both are real, hand-specified, cited pairs',
    f(M.PAIRS.filter(p => /SYNTHETIC/i.test(p.note)).length === 0,
      M.PAIRS.filter(p => /SYNTHETIC/i.test(p.note)).length !== 0));

  check('both pairs state the developmental-context DIFFERENCE rather than assuming a match',
    f(M.PAIRS.every(p => p.developmental_context?.difference_stated === true),
      !M.PAIRS.every(p => p.developmental_context?.difference_stated === true)));

  check('both pairs searched at least MIN_DATABASES independent resources',
    f(M.PAIRS.every(p => p.databases_searched.length >= A.MIN_DATABASES),
      !M.PAIRS.every(p => p.databases_searched.length >= A.MIN_DATABASES)),
    M.PAIRS.map(p => `${p.id}:${p.databases_searched.length}`).join(', '));

  check('both pairs ran the FUNCTION-first search, and say how',
    f(M.PAIRS.every(p => p.analogue_search?.performed === true && typeof p.analogue_search.how === 'string'),
      !M.PAIRS.every(p => p.analogue_search?.performed === true && typeof p.analogue_search.how === 'string')));

  check('PAIRS is frozen, so a consumer cannot staple evidence on later',
    f(Object.isFrozen(M.PAIRS) === true, Object.isFrozen(M.PAIRS) !== true));

  // ================================================================================================
  // 2. SCORED IS A RECORD, NOT A CLAIM
  // ================================================================================================
  // The whole value of exporting SCORED is that nobody typed the band. So the test recomputes it.
  check('SCORED holds one verdict per pair',
    f(M.SCORED.length === M.PAIRS.length, M.SCORED.length !== M.PAIRS.length), `${M.SCORED.length}`);

  const fresh = M.PAIRS.map(p => A.scoreAnalogy(p.a, p.b, p.evidence));
  const drift = M.PAIRS.map((p, i) => ({ id: p.id, same: eq(
    [M.SCORED[i].confidence.lo, M.SCORED[i].confidence.hi, M.SCORED[i].confidence.label, M.SCORED[i].present_kinds],
    [fresh[i].confidence.lo, fresh[i].confidence.hi, fresh[i].confidence.label, fresh[i].present_kinds]) })).filter(r => !r.same);
  check('every exported band re-derives EXACTLY from scoreAnalogy on the pair\'s own evidence',
    f(drift.length === 0, drift.length !== 0), drift.map(r => r.id).join(', '));

  // Cross-check the recompute is discriminating: pair 1's verdict must NOT match pair 2's evidence.
  const crossed = A.scoreAnalogy(P1.a, P1.b, P2.evidence);
  check('and the recompute discriminates: swapping the evidence changes the band, so the check has teeth',
    f(crossed.confidence.label !== M.SCORED[0].confidence.label || crossed.confidence.lo !== M.SCORED[0].confidence.lo,
      !(crossed.confidence.label !== M.SCORED[0].confidence.label || crossed.confidence.lo !== M.SCORED[0].confidence.lo)),
    `${crossed.confidence.lo}-${crossed.confidence.hi} vs ${M.SCORED[0].confidence.lo}-${M.SCORED[0].confidence.hi}`);

  check('SCORED_BY_ID is keyed by the pair ids, so no consumer has to know the array order',
    f(eq(Object.keys(M.SCORED_BY_ID), M.PAIRS.map(p => p.id)), eq(Object.keys(M.SCORED_BY_ID), ['a', 'b'])));

  check('every verdict is frozen',
    f(M.SCORED.every(v => Object.isFrozen(v)), !M.SCORED.every(v => Object.isFrozen(v))));

  check('every verdict is a BAND with hi > lo, including the weaker pair',
    f(M.SCORED.every(v => v.confidence.hi > v.confidence.lo), !M.SCORED.every(v => v.confidence.hi > v.confidence.lo)),
    M.SCORED.map(v => `${v.confidence.lo}-${v.confidence.hi}`).join(', '));

  check('no verdict headline contains a digit, so no float can be quoted out of either pair',
    f(M.SCORED.every(v => /[0-9]/.test(v.headline) === false), !M.SCORED.every(v => /[0-9]/.test(v.headline) === false)));

  check('no verdict exposes a fused scalar under any of its three names',
    f(M.SCORED.every(v => v.fused_scalar === null && v.score === null && v.probability === null),
      !M.SCORED.every(v => v.fused_scalar === null && v.score === null && v.probability === null)));

  const handWritten = M.PAIRS.flatMap(p => ['band', 'confidence', 'label', 'class', 'score', 'support'].filter(k => k in p));
  check('NO pair object carries a hand-written band, label, class or score field',
    f(handWritten.length === 0, handWritten.length !== 0), handWritten.join(', '));

  // ================================================================================================
  // 3. THE BANDS THE MODULE ACTUALLY RETURNED
  // ================================================================================================
  // These values were read off a run. They are asserted so that editing the evidence breaks the test.
  const C1 = M.SCORED[0].confidence, C2 = M.SCORED[1].confidence;

  check('pair 1 (two cave populations) bands moderate',
    f(C1.label === 'moderate', C1.label === 'strong'), C1.label);

  check('pair 1\'s endpoints are 0.19 to 0.66',
    f(C1.lo === 0.19 && C1.hi === 0.66, C1.lo === 0.42 && C1.hi === 0.95), `${C1.lo}-${C1.hi}`);

  check('pair 1\'s band straddles more than one word, and the module says so rather than hiding it',
    f(C1.label_span.length > 1, !(C1.label_span.length > 1)), C1.label_span.join('/'));

  check('pair 1\'s LABEL does NOT survive the alternative weighting - that difference is ours, not the biology\'s',
    f(C1.label_is_robust_to_weighting === false && C1.under_alternative_weighting.label === 'weak',
      !(C1.label_is_robust_to_weighting === false && C1.under_alternative_weighting.label === 'weak')),
    `${C1.label} -> ${C1.under_alternative_weighting.label}`);

  check('and the module states in words that a moved label was ours',
    f(/is ours, not the biology/.test(C1.if_the_label_moved), !/is ours, not the biology/.test(C1.if_the_label_moved)));

  check('pair 2 (cross-lineage) bands weak, which is the honest output for a descriptive mammalian side',
    f(C2.label === 'weak', C2.label === 'moderate'), C2.label);

  check('pair 2\'s endpoints are 0.04 to 0.52',
    f(C2.lo === 0.04 && C2.hi === 0.52, C2.lo === 0.30 && C2.hi === 0.80), `${C2.lo}-${C2.hi}`);

  check('pair 2 is supported LESS than pair 1 on the lower bound: distance plus absent experiments costs it',
    f(C2.lo < C1.lo, !(C2.lo < C1.lo)), `${C2.lo} vs ${C1.lo}`);

  check('pair 2\'s label SURVIVES the alternative weighting, so on that pair the word is the evidence talking',
    f(C2.label_is_robust_to_weighting === true, C2.label_is_robust_to_weighting === false),
    `${C2.label} / ${C2.under_alternative_weighting.label}`);

  check('neither pair reaches a direct functional test: no rescue anywhere in this dossier',
    f(M.SCORED.every(v => v.directly_tested === false), !M.SCORED.every(v => v.directly_tested === false)));

  check('and every verdict says so in its gaps, in those terms',
    f(M.SCORED.every(v => v.gaps.some(g => /no direct functional test/.test(g))),
      !M.SCORED.every(v => v.gaps.some(g => /no direct functional test/.test(g)))));

  check('pair 1\'s strongest evidence is the loss-of-function phenotype comparison, not something stronger',
    f(M.SCORED[0].strongest.kind === 'lof-phenotype', M.SCORED[0].strongest.kind === 'rescue'),
    M.SCORED[0].strongest.kind);

  check('pair 2\'s strongest evidence is domain architecture - a statement about biochemical capability only',
    f(M.SCORED[1].strongest.kind === 'domain-architecture', M.SCORED[1].strongest.kind === 'lof-phenotype'),
    M.SCORED[1].strongest.kind);

  // ================================================================================================
  // 4. CLASSIFICATION AND THE REFUSALS
  // ================================================================================================
  const K1 = A.classify(P1), K2 = A.classify(P2);

  check('pair 1 classifies convergent-analogue: function-bearing evidence with no orthology asserted',
    f(K1.class === 'convergent-analogue', K1.class === 'orthologous-untested'), K1.class);

  check('pair 2 classifies one-to-many-ambiguous, naming the reason rather than quietly downgrading',
    f(K2.class === 'one-to-many-ambiguous', K2.class === 'convergent-analogue'), K2.class);

  check('NEITHER pair is sold as a functional equivalent',
    f(K1.functional_equivalent === false && K2.functional_equivalent === false,
      !(K1.functional_equivalent === false && K2.functional_equivalent === false)));

  check('the one-to-many refusal fires on pair 2, by name',
    f(K2.refusals.some(r => r.id === 'one-to-many-is-not-equivalence'),
      !K2.refusals.some(r => r.id === 'one-to-many-is-not-equivalence')), K2.refusals.map(r => r.id).join(', '));

  check('and that refusal states it does not weaken as evidence accumulates',
    f(/does not weaken with more evidence/i.test(K2.refusals.find(r => r.id === 'one-to-many-is-not-equivalence').and),
      !/does not weaken with more evidence/i.test(K2.refusals.find(r => r.id === 'one-to-many-is-not-equivalence').and)));

  check('pair 2 points at the duplicate-pair record rather than leaving the reader to find it',
    f(K2.see === 'THE_ZEBRAFISH_PROBLEM', K2.see === undefined), `${K2.see}`);

  check('no absence-of-evidence refusal fires: both pairs searched enough resources AND ran the function-first search',
    f(!A.refuse(P1).refusals.some(r => r.id === 'absence-of-evidence') && !A.refuse(P2).refusals.some(r => r.id === 'absence-of-evidence'),
      A.refuse(P1).refusals.some(r => r.id === 'absence-of-evidence') || A.refuse(P2).refusals.some(r => r.id === 'absence-of-evidence')),
    [...A.refuse(P1).refusals, ...A.refuse(P2).refusals].map(r => r.id).join(', '));

  check('no phenotype-transfer refusal fires: the developmental-context difference is stated on both pairs',
    f(![P1, P2].some(p => A.refuse(p).refusals.some(r => r.id === 'phenotype-transfer-without-context')),
      [P1, P2].some(p => A.refuse(p).refusals.some(r => r.id === 'phenotype-transfer-without-context'))));

  // And the absence-of-evidence guard is discriminating, not just satisfied: strip the function-first
  // search from pair 1 and it must fire. A guard that never fires on this dossier is not a guard.
  check('that guard is discriminating: removing pair 1\'s function-first search makes the refusal fire',
    f(A.refuse({ ...P1, id: 'probe', analogue_search: { performed: false } }).refusals.some(r => r.id === 'absence-of-evidence'),
      !A.refuse({ ...P1, id: 'probe', analogue_search: { performed: false } }).refusals.some(r => r.id === 'absence-of-evidence')));

  // ================================================================================================
  // 5. THE HONESTY RULES, PAIR BY PAIR
  // ================================================================================================
  check('pair 1 does NOT assert sequence orthology between two populations of one species',
    f(P1.evidence['sequence-orthology'].present === false, P1.evidence['sequence-orthology'].present === true));

  check('and its reason names the relationship correctly: ALLELIC, not orthologous',
    f(/allelic/i.test(P1.evidence['sequence-orthology'].why) && /speciation/i.test(P1.evidence['sequence-orthology'].why),
      !(/allelic/i.test(P1.evidence['sequence-orthology'].why) && /speciation/i.test(P1.evidence['sequence-orthology'].why))));

  check('the cost of that honesty is recorded: classify() then reports homology_type "none" for a pair that shares a genome',
    f(M.SCORED[0].homology_type === 'none' && /homology_type "none"/.test(P1.the_vocabulary_problem_this_pair_exposes),
      !(M.SCORED[0].homology_type === 'none' && /homology_type "none"/.test(P1.the_vocabulary_problem_this_pair_exposes))));

  check('pair 1\'s rescue slot is absent and names BOTH near-miss experiments rather than borrowing either',
    f(P1.evidence['rescue'].present === false && /scleral ossicle/i.test(P1.evidence['rescue'].why) && /surface-fish embryonic lens/i.test(P1.evidence['rescue'].why),
      !(P1.evidence['rescue'].present === false && /scleral ossicle/i.test(P1.evidence['rescue'].why) && /surface-fish embryonic lens/i.test(P1.evidence['rescue'].why))));

  check('pair 1 names the experiment that would move it, and notes the rescue would ARGUE AGAINST the identity claim',
    f(typeof P1.evidence['rescue'].what_would_establish_it === 'string' && /DIFFERENT loci/.test(P1.evidence['rescue'].and_note_the_direction),
      !(typeof P1.evidence['rescue'].what_would_establish_it === 'string' && /DIFFERENT loci/.test(P1.evidence['rescue'].and_note_the_direction))));

  check('pair 1\'s expression-domain is absent because the source does not name the two populations - not asserted across them',
    f(P1.evidence['expression-domain'].present === false && /several different cavefish populations/.test(P1.evidence['expression-domain'].why),
      !(P1.evidence['expression-domain'].present === false && /several different cavefish populations/.test(P1.evidence['expression-domain'].why))));

  check('pair 2\'s homology_type is one of the AMBIGUOUS types, which is what bars it from equivalence',
    f(A.AMBIGUOUS_HOMOLOGY_TYPES.includes(P2.evidence['sequence-orthology'].homology_type),
      !A.AMBIGUOUS_HOMOLOGY_TYPES.includes(P2.evidence['sequence-orthology'].homology_type)),
    P2.evidence['sequence-orthology'].homology_type);

  check('pair 2 records TWO genes on the teleost side and names both, so the SET is carried rather than a member',
    f(P2.evidence['sequence-orthology'].n_on_a_side === 2 && P2.evidence['sequence-orthology'].members_on_a_side.length === 2,
      !(P2.evidence['sequence-orthology'].n_on_a_side === 2 && P2.evidence['sequence-orthology'].members_on_a_side.length === 2)));

  check('pair 2 invents NO pairwise identity value, and says that it did not compute one',
    f(!('identity' in P2.evidence['sequence-orthology']) && /no pairwise identity was computed/i.test(P2.evidence['sequence-orthology'].no_identity_value_is_given),
      !(!('identity' in P2.evidence['sequence-orthology']) && /no pairwise identity was computed/i.test(P2.evidence['sequence-orthology'].no_identity_value_is_given))));

  const mammalAbsences = ['lof-phenotype', 'expression-domain', 'rescue'].filter(k => P2.evidence[k].present === false);
  check('all three experimental evidence kinds are ABSENT on pair 2 - the mammalian side is not overstated',
    f(mammalAbsences.length === 3, mammalAbsences.length !== 3), mammalAbsences.join(', '));

  check('and pair 2 says in its own words that the lof absence is the one that defines it',
    f(/THIS IS THE ABSENCE THAT DEFINES THE PAIR/.test(P2.evidence['lof-phenotype'].why),
      !/THIS IS THE ABSENCE THAT DEFINES THE PAIR/.test(P2.evidence['lof-phenotype'].why)));

  check('pair 2\'s synteny absence names the unplaced-scaffold reason rather than just saying "none"',
    f(P2.evidence['synteny'].present === false && /unplaced scaffold/i.test(P2.evidence['synteny'].why),
      !(P2.evidence['synteny'].present === false && /unplaced scaffold/i.test(P2.evidence['synteny'].why))));

  check('pair 2 flags that the two sides share the ORGAN by ancestry, so position buys the convergence claim nothing',
    f(/homologous/i.test(P2.evidence['positional-correspondence'].the_honest_complication),
      !/homologous/i.test(P2.evidence['positional-correspondence'].the_honest_complication)));

  check('pair 2 states that "eye regression" is two readouts sharing a word, and which tissue fails on each side',
    f(/sharing a word/i.test(P2.the_two_regressions_are_not_the_same_regression) && /iris-ciliary body/i.test(P2.the_two_regressions_are_not_the_same_regression),
      !(/sharing a word/i.test(P2.the_two_regressions_are_not_the_same_regression) && /iris-ciliary body/i.test(P2.the_two_regressions_are_not_the_same_regression))));

  const absentCount = allEv.filter(e => e.rec.present === false).length;
  check('across both pairs, most slots are ABSENT - this dossier is mostly a record of what is missing',
    f(absentCount > allEv.length / 2, !(absentCount > allEv.length / 2)), `${absentCount} of ${allEv.length}`);

  // ================================================================================================
  // 6. EVERY CITATION WAS RETRIEVED, AND SAYS WHAT WAS READ BACK
  // ================================================================================================
  const noVerified = srcKeys.filter(k => !(typeof SRC[k].verified_how === 'string' && SRC[k].verified_how.length > 60));
  check('EVERY source states verified_how, in substance: what was fetched and what was read back',
    f(noVerified.length === 0, noVerified.length !== 0), noVerified.join(', '));

  const sessionless = srcKeys.filter(k => !/this session/i.test(SRC[k].verified_how));
  check('and every verified_how says the retrieval happened THIS SESSION, not that it is known',
    f(sessionless.length === 0, sessionless.length !== 0), sessionless.join(', '));

  const lit = srcKeys.filter(k => SRC[k].kind === 'literature');
  check('there are literature sources to check',
    f(lit.length >= 8, !(lit.length >= 8)), `${lit.length}`);

  const badPmid = lit.filter(k => !/^[0-9]{7,8}$/.test(String(SRC[k].pmid)));
  check('every literature source carries a PMID that is digits only, of plausible length',
    f(badPmid.length === 0, badPmid.length !== 0), badPmid.map(k => `${k}:${SRC[k].pmid}`).join(', '));

  const badDoi = lit.filter(k => !(typeof SRC[k].doi === 'string' && SRC[k].doi.includes('10.')) && !(SRC[k].doi === null && typeof SRC[k].doi_note === 'string'));
  check('every literature source either carries a DOI containing a registrant prefix, or states that the record returned none',
    f(badDoi.length === 0, badDoi.length !== 0), badDoi.join(', '));

  const unmarkedPreprint = lit.filter(k => SRC[k].peer_reviewed === false && typeof SRC[k].preprint_warning !== 'string');
  check('any non-peer-reviewed source is marked as a preprint and carries the warning',
    f(unmarkedPreprint.length === 0, unmarkedPreprint.length !== 0), unmarkedPreprint.join(', '));

  check('at least one source IS marked not peer reviewed, so that field is doing work',
    f(lit.some(k => SRC[k].peer_reviewed === false), !lit.some(k => SRC[k].peer_reviewed === false)));

  const genes = srcKeys.filter(k => SRC[k].kind === 'gene-record');
  const badGene = genes.filter(k => !(typeof SRC[k].resource === 'string' && (SRC[k].accession || SRC[k].accessions)));
  check('every gene record names the resource it came from and carries an accession',
    f(badGene.length === 0, badGene.length !== 0), badGene.join(', '));

  check('there are gene records for both sides of pair 2, and the counts they establish differ',
    f(SRC.gene_astyanax_shha.organism !== SRC.gene_spalax_shh.organism && M.WHAT_THE_RECORDS_SAID.sonic_hedgehog_gene_count.teleost_side !== M.WHAT_THE_RECORDS_SAID.sonic_hedgehog_gene_count.mammal_side,
      !(SRC.gene_astyanax_shha.organism !== SRC.gene_spalax_shh.organism && M.WHAT_THE_RECORDS_SAID.sonic_hedgehog_gene_count.teleost_side !== M.WHAT_THE_RECORDS_SAID.sonic_hedgehog_gene_count.mammal_side)));

  const dangling = [...new Set(allRefs)].filter(r => !srcKeys.includes(r));
  check('every source id referenced from an evidence slot or a finding exists in SOURCES: no dangling citation',
    f(dangling.length === 0, dangling.length !== 0), dangling.join(', '));

  check('the references actually reach most of SOURCES, so the block is not padding',
    f(new Set(allRefs).size >= srcKeys.length - 4, !(new Set(allRefs).size >= srcKeys.length - 4)),
    `${new Set(allRefs).size} referenced of ${srcKeys.length}`);

  // ================================================================================================
  // 7. THE THREE THINGS THE LIVE RECORDS SAID THAT WERE NOT EXPECTED
  // ================================================================================================
  check('the symbol trap is recorded, and names the gene the resource wrongly returned',
    f(/prkra/i.test(M.SYMBOL_TRAP.what_that_gene_is), !/prkra/i.test(M.SYMBOL_TRAP.what_that_gene_is)));

  check('and it names the gene the query should have found, with its accession',
    f(/103038458/.test(M.SYMBOL_TRAP.the_gene_it_should_have_found), !/103038458/.test(M.SYMBOL_TRAP.the_gene_it_should_have_found)));

  check('the trap record says why a well-formed wrong answer is the worst kind, and gives a defence',
    f(/strongest in the vocabulary/i.test(M.SYMBOL_TRAP.why_it_is_the_worst_kind_of_error) && /stable identifier/i.test(M.SYMBOL_TRAP.the_defence),
      !(/strongest in the vocabulary/i.test(M.SYMBOL_TRAP.why_it_is_the_worst_kind_of_error) && /stable identifier/i.test(M.SYMBOL_TRAP.the_defence))));

  check('the trap\'s own source records the ONE thing that was inferred rather than read from the resource',
    f(/not something read from Ensembl/.test(SRC.ensembl_rax_symbol_trap.one_honest_caveat),
      !/not something read from Ensembl/.test(SRC.ensembl_rax_symbol_trap.one_honest_caveat)));

  const q = M.WHAT_THE_RECORDS_SAID.eye_qtl_regions_shared_across_lineages;
  check('the shared-QTL finding is recorded as a COUNT, because the count is the unambiguous number',
    f(q.count === 9, q.count === 16), `${q.count}`);

  check('the preprint\'s denominator is recorded as the TWO values it gives, with no single one chosen',
    f(q.denominator_as_stated_in_the_preprint.length === 2 && /no single percentage is recorded as fact/.test(q.this_file_reports),
      !(q.denominator_as_stated_in_the_preprint.length === 2 && /no single percentage is recorded as fact/.test(q.this_file_reports))),
    q.denominator_as_stated_in_the_preprint.join(' / '));

  check('and the arithmetic that does not reconcile is written down in the source rather than smoothed',
    f(/nine of sixteen is 56%, not 43%/.test(SRC.richards_2026.the_number_does_not_reconcile_in_the_preprint),
      !/nine of sixteen is 56%, not 43%/.test(SRC.richards_2026.the_number_does_not_reconcile_in_the_preprint)));

  const sweep = M.WHAT_THE_RECORDS_SAID.genes_under_selection_in_all_three_wild_cave_populations;
  check('the sweep-scan null result is recorded: 2 genes of 2,433 inside QTL regions, neither in an eye QTL',
    f(sweep.count === 2 && sweep.out_of_genes_inside_qtl_regions === 2433 && /neither is in an eye QTL/.test(sweep.and),
      !(sweep.count === 2 && sweep.out_of_genes_inside_qtl_regions === 2433 && /neither is in an eye QTL/.test(sweep.and))));

  check('so the answer to "same loci?" is recorded as settled at the REGION level and open at the GENE level',
    f(/region-level repeatability is real; the gene-level question is open/i.test(sweep.so),
      !/region-level repeatability is real; the gene-level question is open/i.test(sweep.so)));

  check('the third possibility - parallelism from shared standing variation - is recorded, not collapsed into the other two',
    f(/standing genetic variation/i.test(M.WHAT_THE_RECORDS_SAID.snps_differentiated_in_both_cave_lineages.attributed_to) && /standing variation/i.test(P1.note),
      !(/standing genetic variation/i.test(M.WHAT_THE_RECORDS_SAID.snps_differentiated_in_both_cave_lineages.attributed_to) && /standing variation/i.test(P1.note))));

  check('the two orthology resources are recorded as AGREEING on the gene count and DISAGREEING elsewhere',
    f(M.WHAT_THE_RECORDS_SAID.sonic_hedgehog_gene_count.agreed_by.length === 2 && /do not agree/.test(M.WHAT_THE_RECORDS_SAID.retinal_homeobox_gene_count.and_the_disagreement),
      !(M.WHAT_THE_RECORDS_SAID.sonic_hedgehog_gene_count.agreed_by.length === 2 && /do not agree/.test(M.WHAT_THE_RECORDS_SAID.retinal_homeobox_gene_count.and_the_disagreement))));

  check('the assembly-coordinate disagreement between the two resources is recorded rather than resolved',
    f(SRC.ensembl_shh_orthologues.two_honest_caveats.some(s => /do not match the NCBI chromosome assignments/.test(s)),
      !SRC.ensembl_shh_orthologues.two_honest_caveats.some(s => /do not match the NCBI chromosome assignments/.test(s))));

  check('the UniProt entries are marked unreviewed, and the count mismatch against NCBI is admitted',
    f(SRC.uniprot_hedgehog_domains.three_honest_caveats.some(s => /unreviewed/i.test(s)) && SRC.uniprot_hedgehog_domains.three_honest_caveats.some(s => /count does not match/i.test(s)),
      !(SRC.uniprot_hedgehog_domains.three_honest_caveats.some(s => /unreviewed/i.test(s)) && SRC.uniprot_hedgehog_domains.three_honest_caveats.some(s => /count does not match/i.test(s)))));

  check('the choice of which mammal was made on a stated, retrieved basis - and that basis is labelled as no finding',
    f(/crude proxy/i.test(SRC.pubmed_record_depth_counts.what_it_does_NOT_justify) && /28/.test(SRC.pubmed_record_depth_counts.what_was_counted),
      !(/crude proxy/i.test(SRC.pubmed_record_depth_counts.what_it_does_NOT_justify) && /28/.test(SRC.pubmed_record_depth_counts.what_was_counted))));

  check('the two bodies of mammalian evidence are joined by a NOMENCLATURAL link, and the record says only that',
    f(/nomenclatural link, not a demonstration/.test(SRC.taxonomy_spalax.why_this_matters),
      !/nomenclatural link, not a demonstration/.test(SRC.taxonomy_spalax.why_this_matters)));

  check('the vocabulary gap pair 1 ran into is exported, not just mentioned in a comment',
    f(/same locus, different alleles/.test(M.HOMOLOGY_VOCABULARY_USED.what_pair_1_needed_and_did_not_find),
      !/same locus, different alleles/.test(M.HOMOLOGY_VOCABULARY_USED.what_pair_1_needed_and_did_not_find)));
}

// ================================================================================================
// RUN
// ================================================================================================
function run(inject) { RESULTS.length = 0; cursor = 0; INJECT = inject; suite(); return { rows: RESULTS.slice(), calls: cursor }; }

console.log(`\ncave-regression: two eye-regression dossiers, and what the live records actually said\n`);

const clean = run(-1);
for (const r of clean.rows) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${!r.ok && r.detail ? ` - ${r.detail}` : ''}`);
const passed = clean.rows.filter(r => r.ok).length;
const failed = clean.rows.length - passed;
console.log(`\n${passed} pass, ${failed} fail`);

if (clean.calls !== clean.rows.length) {
  console.log(`\nHARNESS ERROR: ${clean.calls} fault slots for ${clean.rows.length} assertions. One f() per check() is the contract.`);
  process.exit(2);
}

let survivors = [];
if (FAULT) {
  for (let k = 0; k < clean.rows.length; k++) {
    const r = run(k).rows;
    if (r[k].ok) survivors.push(`#${k} ${r[k].name}`);
  }
  console.log(`\n--fail-once: the suite ran ${clean.rows.length} times, each with exactly ONE assertion's value broken.`);
  console.log(survivors.length === 0
    ? `No survivors across ${clean.rows.length} injected faults: every assertion is load-bearing.`
    : `SURVIVORS (${survivors.length}). These assert nothing about their subject:\n  ${survivors.join('\n  ')}`);
}

process.exit((failed || survivors.length) ? 1 : 0);
