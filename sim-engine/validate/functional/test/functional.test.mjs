// Tests for the functional-resolution ledger. Run: node --test sim-engine/validate/functional/test/
//
// The tests that matter most are the REFUSALS: a requirement the design genuinely lacks must land in UNRESOLVED
// and must NOT be rescued into PARALOGUE or COMPENSATORY without evidence. Each of those was written to FAIL
// first against a deliberately weakened version of the rule, and the weakening it caught is named in the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { functionalResolution } from '../index.mjs';
import { closestFunctionalAnalogue, functionFromText, registry } from '../analogue.mjs';
import { requirementSet, detectDirection } from '../requirements.mjs';
import { paralogueResolution, analogousSetResolution, resolveOne, scoreCompensationVerdict } from '../resolve.mjs';
import { compensationApplies, lesionTriggersDecay } from '../compensation.mjs';
import { SPECIFICITY_RULE, sharedPathwayTerms, termSpecificity } from '../cards.mjs';
import { LADDER, normaliseLedger } from '../../functional-interface.mjs';

const GLIDE = { spec: { desired_phenotype: 'a zebrafish with wings that glides over the water like a flying fish' } };

// ---------------------------------------------------------------- the interface contract
test('the module satisfies the scorer\'s interface: a normalisable ledger with only ladder classes', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  assert.equal(L.ran, true, L.reason || '');
  const N = normaliseLedger(L);
  assert.equal(N.ran, true);
  assert.deepEqual(N.unknown_classes, [], 'every class must be one of the six rungs');
  assert.ok(!N.counts_disagreed_with_module, `our own counts must match the interface's recount: ${JSON.stringify(N.counts_disagreed_with_module)}`);
  for (const e of N.entries) assert.ok(LADDER.includes(e.class));
});

test('demonstrated and hypothesised resolutions are never summed into one number', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  const r = L.resolution_two_ways;
  assert.equal(typeof r.demonstrated_resolved, 'number');
  assert.equal(typeof r.hypothesis_resolved, 'number');
  assert.ok(!('resolved_total' in r) && !('resolved' in r), 'no merged "resolved" number may exist');
  // every row that is not UNRESOLVED and not demonstrated must be flagged as a hypothesis
  for (const row of L.ledger) if (row.class !== 'UNRESOLVED' && row.hypothesis) assert.ok(row.hypothesis_why, `${row.id} is a hypothesis and must say why`);
});

// ---------------------------------------------------------------- THE CORE REFUSAL TESTS
test('a requirement the design genuinely lacks lands in UNRESOLVED and is not rescued', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  // wasf2 L126I: the analogue carries it, the design does not edit wasf2, and nothing in our annotations accounts
  // for it. It must be UNRESOLVED, with its refusals recorded.
  const row = L.ledger.find(r => r.gene === 'wasf2');
  assert.ok(row, 'the wasf2 requirement must be in the ledger');
  assert.equal(row.class, 'UNRESOLVED');
  assert.equal(row.hypothesis, false);
  assert.ok(row.paralogue_refused || row.search_depth !== 'full', 'an UNRESOLVED row must record WHY the ladder was refused');
  assert.ok(L.unresolved_genes.some(u => u.gene === 'wasf2'), 'UNRESOLVED rows must be listed gene by gene');
});

test('PARALOGUE is refused when a paralogue merely exists (no expression, or no shared domain)', async () => {
  // FAILED FIRST against a rule that accepted "a paralogue is recorded" on its own. ralbb is the discriminating
  // case: it HAS a within-species paralogue at 84 % identity, and that weakened rule rescued its row into
  // PARALOGUE. The paralogue carries no gene symbol in our map, so no expression or domain record exists for it.
  const ps = (await import('../cards.mjs')).paralogues('ralbb');
  assert.ok(ps.length > 0, 'the test only bites if ralbb really has a paralogue on record');
  const r = paralogueResolution('ralbb');
  assert.equal(r.applies, false, 'a paralogue existing is not a resolution');
  assert.match(r.refusal, /"A paralogue exists" is not a resolution/);
  assert.match(r.refusal, /NO gene symbol in our map/, 'the refusal must say WHY the candidate could not be followed up');
  // and the ledger row must stay UNRESOLVED
  const L = await functionalResolution('zebrafish-adult', GLIDE);
  assert.equal(L.ledger.find(x => x.gene === 'ralbb').class, 'UNRESOLVED');
});

test('PARALOGUE, where it does fire, carries expression AND domain evidence and stays a hypothesis', () => {
  const r = paralogueResolution('slc43a2a');
  assert.equal(r.applies, true, `slc43a2a has the paralogue slc43a1a with fin expression: ${r.refusal || ''}`);
  assert.equal(r.hypothesis, true);
  assert.equal(r.evidence.length, 3);
  assert.match(r.evidence[1].claim, /expressed in/);
  assert.match(r.evidence[2].claim, /share \d+ annotated domain/);
  assert.equal(r.documented_rescue, null, 'no rescue experiment is in our sources, so none may be claimed');
});

test('ANALOGOUS_SET is refused on generic terms: "both are in the membrane" resolves nothing', () => {
  // FAILED FIRST: before the measured specificity rule, kcnh2a "resolved" ralbb, slc39a6 and chrne through
  // GO:0016020 membrane and GO:0005886 plasma membrane, which 760 and 802 of 3,856 annotated genes carry.
  const generic = termSpecificity({ feature: 'go_component', id: 'GO:0016020', term: 'membrane' });
  assert.equal(generic.specific, false, 'membrane must never license the class');
  assert.ok(generic.why_not);
  const shared = sharedPathwayTerms('kcnh2a', 'chrne');
  assert.ok(shared.length > 0, 'these two genes DO share terms, which is why the test matters');
  assert.equal(shared.filter(t => t.specificity.specific).length, 0, 'none of their shared terms is specific enough');
  const r = analogousSetResolution('chrne', { edits: [{ gene: 'kcnh2a' }, { gene: 'slc43a2a' }] });
  assert.equal(r.applies, false);
  assert.match(r.refusal, /no pathway, GO term or domain|NONE is specific enough/);
});

test('the specificity threshold is a measured fraction of the gene universe, not a hand-written blocklist', () => {
  assert.equal(SPECIFICITY_RULE.max_fraction_of_universe, 0.01);
  assert.deepEqual(SPECIFICITY_RULE.excluded_features, ['go_component']);
  const t = termSpecificity({ feature: 'go_process', id: 'GO:0033334', term: 'fin morphogenesis' });
  assert.ok(t.n_genes_with_term > 0, 'the table must actually contain real GO terms');
  assert.equal(t.universe, 3856);
});

// ---------------------------------------------------------------- compensation
test('COMPENSATORY is refused for a missense and for a cis-regulatory change, by the published rule', () => {
  assert.equal(lesionTriggersDecay({ kind: 'missense', raw: 'p.T200K' }).triggers, false);
  assert.equal(lesionTriggersDecay({ kind: 'regulatory', raw: 'cis-regulatory inversion' }).triggers, false);
  assert.equal(lesionTriggersDecay({ kind: 'expression', raw: 'expression x0.2' }).triggers, false);
  assert.equal(lesionTriggersDecay({ kind: 'nonsense', raw: 'p.Y295*' }).triggers, true);
  assert.equal(lesionTriggersDecay({ kind: 'knockout', raw: 'knockout' }).triggers, null, 'a bare "knockout" does not say whether a transcript is made, so the rule abstains');
});

test('COMPENSATORY is refused outright at an unedited locus: there is no mutant mRNA to decay', () => {
  const r = compensationApplies({ requirementGene: 'wasf2', lesion: null });
  assert.equal(r.applies, false);
  assert.equal(r.hypothesis, false);
  assert.match(r.refusal, /no lesion/);
});

test('COMPENSATORY needs all three conditions; each one alone is refused', () => {
  const lesion = { kind: 'nonsense', raw: 'p.Y295*' };
  assert.equal(compensationApplies({ requirementGene: 'hhip', lesion }).applies, false, 'condition 2 (a sequence-similar gene) is missing');
  assert.equal(compensationApplies({ requirementGene: 'hhip', lesion, similarGene: { symbol: 'hhipl1' } }).applies, false, 'condition 3 (expression in context) is missing');
  const full = compensationApplies({ requirementGene: 'hhip', lesion, similarGene: { symbol: 'hhipl1' }, expression: { anatomy: 'pectoral fin', source: 'test' } });
  assert.equal(full.applies, true);
  assert.equal(full.hypothesis, true, 'even a fully satisfied rule is a hypothesis, never a demonstration');
});

test('the hub\'s compensation scoring rule: only documented WITH functional rescue counts', () => {
  assert.equal(scoreCompensationVerdict({ class: 'documented', functional_rescue: true }).counts, true);
  assert.equal(scoreCompensationVerdict({ class: 'documented', functional_rescue: false }).counts, false);
  assert.equal(scoreCompensationVerdict({ class: 'documented' }).counts, false, 'documented alone is not a pass: transcript-level compensation is not rescue of the organism');
  assert.equal(scoreCompensationVerdict({ class: 'plausible-by-rule' }).counts, false);
  assert.equal(scoreCompensationVerdict({ class: 'plausible-by-rule' }).flag, 'review');
  assert.equal(scoreCompensationVerdict({ class: 'not-expected' }).trusted, true);
  assert.equal(scoreCompensationVerdict({ class: 'unknown' }).counts, false);
});

test('no row is scored COMPENSATORY while the validated classifier is absent', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  if (!L.compensation_rule.classifier) assert.equal(L.counts.COMPENSATORY, 0, 'without the validated classifier, the rule table can only refuse');
});

// ---------------------------------------------------------------- the analogue
test('the analogue is chosen by FUNCTION from the desired phenotype, not from relatedness', () => {
  const a = closestFunctionalAnalogue('winged-zebrafish', { desired_phenotype: 'glides over the water' });
  assert.equal(a.function.id, 'glides_over_water');
  assert.match(a.function_signal, /^specified/);
  assert.equal(a.id, 'flying-fish');
  assert.equal(a.base.species, 'Danio rerio');
  // the two distances are separate, and the functional one is honestly unmeasurable here
  assert.equal(a.distance.functional.measurable, false);
  assert.match(a.distance.functional.why_unmeasurable, /CANNOT SCORE on BOTH sides/);
  assert.equal(a.distance.phylogenetic.dated_divergence, null);
});

test('with no desired phenotype the function is INFERRED and labelled as inferred', () => {
  const a = closestFunctionalAnalogue('winged-zebrafish', null);
  assert.match(a.function_signal, /^INFERRED, not specified/);
});

test('the stronger claim wins when a text names both powered flight and gliding', () => {
  const t = functionFromText('a fish that truly flies under its own power, not just glides');
  assert.equal(t.function, 'sustained_powered_flight');
  assert.ok(t.also_matched.some(x => x.function === 'glides_over_water'));
});

test('no Aves analogue is ever named, and the refusal is explicit', () => {
  for (const [, fn] of Object.entries(registry())) {
    const taxa = (fn.taxa || []).map(t => `${t.name} ${t.taxon}`).join(' ');
    assert.doesNotMatch(taxa, /\bAves\b|\bbird/i, `${fn.id} names a bird`);
  }
  const a = closestFunctionalAnalogue('tff', 'sustained_powered_flight');
  assert.match(a.refused, /FROZEN HOLDOUT/);
  assert.match(a.pterosaurs, /no DNA/);
});

// ---------------------------------------------------------------- the three directions
test('ADDITION, SUBTRACTION and NO_ANALOGUE are each detected with evidence', async () => {
  const add = await requirementSet('winged-zebrafish', { desired_phenotype: 'glides over the water' });
  assert.equal(add.direction, 'ADDITION');
  assert.ok(add.direction_evidence.length);

  const sub = await requirementSet('wingless-flying-fish', { desired_phenotype: 'a flying fish with ordinary fins that no longer glides' });
  assert.equal(sub.direction, 'SUBTRACTION');
  assert.equal(sub.coverage.requirements_assessable, 0, 'a subtraction against a locus set built to make non-gliders score zero is unassessable BY CONSTRUCTION');
  assert.ok(sub.requirements.every(r => /BY CONSTRUCTION/.test(r.unassessable_reason)));

  const none = await requirementSet('tff', { desired_phenotype: 'truly flies under its own power' });
  assert.equal(none.direction, 'NO_ANALOGUE');
  assert.equal(none.requirements.length, 0, 'no analogue means no requirement set');
});

test('a SUBTRACTION is never scored as a pile of UNRESOLVED gaps', async () => {
  const L = await functionalResolution('wingless-flying-fish', { spec: { desired_phenotype: 'a flying fish with ordinary fins that no longer glides' } });
  assert.equal(L.counts.UNRESOLVED, 0);
  assert.match(L.headline, /SUBTRACTION/);
});

test('NO_ANALOGUE names no analogue and lists the partial ones with what they do not supply', async () => {
  const L = await functionalResolution('tff', { spec: { desired_phenotype: 'truly flies under its own power' } });
  const a = L.closest_functional_analogue;
  assert.equal(a.id, null);
  assert.equal(a.no_analogue, true);
  assert.ok(a.nearest_partial_analogues.length >= 2);
  for (const p of a.nearest_partial_analogues) assert.ok(p.does_not_supply, `${p.name} must say what it does not supply`);
  assert.match(a.basis, /NO ORGANISM WE MAY READ SATISFIES/);
});

// ---------------------------------------------------------------- the controls
test('the real flying fish against itself resolves everything', async () => {
  const L = await functionalResolution('flying-fish', GLIDE);
  assert.equal(L.counts.UNRESOLVED, 0, 'the analogue cannot differ from itself');
  assert.ok(L.counts.SAME > 0);
  assert.equal(L.base_genome.kind, 'analogue');
});

test('the unedited zebrafish against the flying fish shows a large, honest unresolved count', async () => {
  const L = await functionalResolution('zebrafish-adult', GLIDE);
  assert.ok(L.counts.UNRESOLVED >= 15, `expected many unresolved, got ${L.counts.UNRESOLVED}`);
  assert.equal(L.design.n_edits, 0);
});

test('a design with no genome (the 50:50 chimera) is unassessable, not resolved and not failed', async () => {
  const L = await functionalResolution('ff-zf-chimera', GLIDE);
  assert.equal(L.coverage.requirements_assessable, 0);
  assert.equal(L.ledger.length, 0);
  assert.equal(L.base_genome.kind, 'undefined');
  assert.match(L.base_genome.why, /not a genome/);
});

// ---------------------------------------------------------------- coverage honesty
test('coverage is the headline, and the flying-fish functional-data number is zero', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  assert.equal(L.coverage.analogue_loci_with_any_flying_fish_EXPRESSION_or_ASSAY, 0);
  assert.ok(L.coverage.requirements_total > L.coverage.requirements_assessable, 'the unassessable count must be real, not zero');
  assert.ok(Object.keys(L.coverage.unassessable_by_reason).length, 'every unassessable requirement needs a reason');
  assert.match(L.headline, /^We can assess \d+ of \d+ requirements/);
  for (const r of L.requirement_set) if (!r.assessable) assert.ok(r.unassessable_reason, `${r.id} is unassessable and must say why`);
});

test('the design-side residue read is guarded: a low-confidence alignment is not evidence', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  // ralbb T138S aligns 105 residues away from its site; the window rule must have caught it.
  const row = L.ledger.find(r => r.gene === 'ralbb');
  assert.ok(row, 'the ralbb requirement must be in the ledger');
  assert.equal(row.class, 'UNRESOLVED');
  assert.ok(row.evidence.some(e => /LOW CONFIDENCE|could not be read/.test(e.claim)), 'the low-confidence read must be reported, not used');
});

test('the winged zebrafish\'s one real overlap is ALLELIC and a hypothesis, not SAME', async () => {
  const L = await functionalResolution('winged-zebrafish', GLIDE);
  const row = L.ledger.find(r => r.gene === 'slc43a2a');
  assert.equal(row.class, 'ALLELIC');
  assert.equal(row.hypothesis, true);
  assert.match(row.difference, /DIFFERENT state/);
  assert.match(row.hypothesis_why, /functionally neutral/);
});
