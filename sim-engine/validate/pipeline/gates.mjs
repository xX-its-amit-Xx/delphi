// One gate per named result, and the verdict SENTENCE.
//
// Two of the five results arrive without a gate of their own: the scorer thread states a gate for `lean_check`
// and `functional_resolution` only, and deliberately does not gate the two similarity results, because a
// similarity number is not a pass/fail. So the gates for those two are stated HERE, as the pipeline's own
// reading, labelled `gate_set_by: 'pipeline'`, and they never pretend to be the scorer's.
//
// Three statuses, and the third is the point: 'pass', 'fail', 'cannot-assess'. A component that did not run,
// or ran on no data, is cannot-assess -- never a pass. Nothing is summed; there is no overall number.

export const STATUS = ['pass', 'fail', 'cannot-assess'];

/** genotype_similarity -> a gate. A STATE comparison, so the gate can only be about the state, never function. */
export function genotypeGate(gs) {
  if (!gs) return { status: 'cannot-assess', gate: 'genotype_similarity did not run', gate_set_by: 'pipeline' };
  if (!gs.n_edits) {
    return { status: 'cannot-assess', gate_set_by: 'pipeline',
      gate: 'CANNOT ASSESS: the generated design carries no gene-level edit, so there is no edited sequence state to compare with any real orthologue. This is not a pass: it means no genotype was assessed. The design differs from its base morphologically, and a parameter delta has no allele to score.' };
  }
  const a = gs.aggregate || {};
  const failed = (gs.per_gene || []).filter(g => (g.checks || []).some(c => c.status === 'failed'));
  if (failed.length) return { status: 'fail', gate_set_by: 'pipeline', gate: `FAIL: ${failed.length} edit(s) failed a genotype check (${failed.map(g => g.gene).join(', ')}): the edit could not be parsed against the reference or the reference residue did not match.` };
  if (a.conserved_sites_changed > 0 && a.edits_whose_state_exists_in_a_real_organism < a.edits_assessed) {
    return { status: 'fail', gate_set_by: 'pipeline', gate: `FAIL: ${a.conserved_sites_changed} conserved site(s) were changed and ${a.edits_assessed - a.edits_whose_state_exists_in_a_real_organism} of ${a.edits_assessed} edited state(s) occur in no real organism in the panel.` };
  }
  return { status: 'pass', gate_set_by: 'pipeline', gate: `no genotype check failed across ${gs.n_edits} edit(s). This is a SEQUENCE-STATE result: it says the edited states parse and occur, and nothing about whether any function is preserved.` };
}

/** phenotype_similarity -> a gate. Out-of-distribution shape is the failure this one can see. */
export function phenotypeGate(ps) {
  if (!ps) return { status: 'cannot-assess', gate: 'phenotype_similarity did not run', gate_set_by: 'pipeline' };
  const bodyRan = ps.body && ps.body.ran !== false;
  const finRan = ps.fins && ps.fins.ran !== false;
  if (!bodyRan && !finRan) return { status: 'cannot-assess', gate_set_by: 'pipeline', gate: `CANNOT ASSESS: no phenotype feature could be compared (body: ${ps.body?.reason || 'n/a'}; fins: ${ps.fins?.reason || 'n/a'}).` };
  const outside = (ps.fins?.envelope_outside || []).map(o => o.feature);
  const envOut = (ps.physiology_envelope_outside || []).map(o => o.field);
  if (ps.ood || outside.length || envOut.length) {
    return { status: 'fail', gate_set_by: 'pipeline',
      gate: `FAIL: the design is outside the calibrated distribution of real specimens${ps.ood ? ' (OOD flag set)' : ''}${outside.length ? `; fin features outside the envelope: ${outside.join(', ')}` : ''}${envOut.length ? `; physiology fields outside the state envelope: ${envOut.join(', ')}` : ''}. Shape only: this says the design is unlike any measured animal, not that it is impossible.` };
  }
  return { status: 'pass', gate_set_by: 'pipeline', gate: `inside the calibrated shape distribution${ps.body?.p_value != null ? ` (body p ${ps.body.p_value})` : ''}. Shape similarity to real specimens, not relatedness, and silent on every feature the comparison does not read.` };
}

/** lean_check -> the scorer thread's own gate, carried through unchanged. */
export function leanGate(lc) {
  if (!lc) return { status: 'cannot-assess', gate: 'lean_check did not run', gate_set_by: 'scorer' };
  const failed = /^FAIL/.test(lc.gate || '');
  const c = lc.counts || {};
  const evaluated = (c.holds || 0) + (c.violated || 0);
  if (failed) return { status: 'fail', gate: lc.gate, gate_set_by: 'scorer' };
  if (!evaluated) return { status: 'cannot-assess', gate_set_by: 'scorer', gate: `CANNOT ASSESS: no Lean law could be evaluated on this design (${c.cannot_evaluate ?? '?'} cannot-evaluate, ${c.out_of_scope ?? '?'} out of scope). ${lc.gate}` };
  return { status: 'pass', gate: lc.gate, gate_set_by: 'scorer', laws_evaluated: evaluated };
}

/** functional_resolution -> the functional/scorer threads' own gate, carried through unchanged. */
export function functionalGate(fr) {
  if (!fr || fr.ran === false) return { status: 'cannot-assess', gate_set_by: 'functional-interface', gate: `CANNOT ASSESS: ${fr?.reason || 'the functional ledger did not run'}` };
  const failed = /^FAIL/.test(fr.gate || '');
  if (failed) return { status: 'fail', gate: fr.gate, gate_set_by: 'functional' };
  if (!fr.resolution?.differences) return { status: 'cannot-assess', gate_set_by: 'functional', gate: `CANNOT ASSESS: ${fr.gate || 'the ledger classified no difference'}` };
  return { status: 'pass', gate: fr.gate, gate_set_by: 'functional' };
}

/** physics_check -> the physics thread's OWN gate, carried through unchanged.
 *  sim-engine/validate/physics/index.mjs states `gate_status` ('fail' | 'incomplete' | 'pass' | 'nothing
 *  checked'), `physics_gate_failed` and a `gate` sentence, and lists every requirement no scenario could model
 *  under `unchecked_requirements`. This maps its four statuses onto the pipeline's three and re-states nothing:
 *  'incomplete' and 'nothing checked' both become cannot-assess, because a hard criterion with no model is not
 *  a pass. Its own sentence is what the report prints. */
export function physicsGate(pc) {
  if (!pc || pc.ran === false) return { status: 'cannot-assess', gate_set_by: 'pipeline', gate: `CANNOT ASSESS: ${pc?.reason || 'the physics module did not run'}` };
  const s = pc.gate_status ?? (pc.physics_gate_failed ? 'fail' : null);
  const sentence = pc.gate || pc.verdict || '(the physics module stated no gate sentence)';
  const summary = pc.summary ?? null;
  const unchecked = Array.isArray(pc.unchecked_requirements) ? pc.unchecked_requirements : [];
  const extra = { gate_set_by: 'physics', module_gate_status: s, target_function_source: pc.target_function?.source ?? null,
    summary, unchecked_requirements: unchecked.length, function_achieved: pc.function_achieved ?? null };
  if (s === 'fail') return { status: 'fail', gate: sentence, ...extra };
  if (s === 'pass') return { status: 'pass', gate: sentence, ...extra };
  if (s === 'incomplete') return { status: 'cannot-assess', gate: `CANNOT FULLY ASSESS: ${sentence}`, ...extra };
  if (s === 'nothing checked') return { status: 'cannot-assess', gate: `CANNOT ASSESS: ${sentence}`, ...extra };
  return { status: 'cannot-assess', gate: `CANNOT ASSESS: the physics module reported no gate status. ${sentence}`, ...extra };
}

const NAMES = {
  genotype_similarity: 'genotype similarity', phenotype_similarity: 'phenotype similarity',
  lean_check: 'the Lean check', functional_resolution: 'the functional-analogue ledger', physics_check: 'the physics check',
};

/**
 * The top-line verdict: a SENTENCE naming what passed, what failed, what could not be assessed and why.
 * The word "validated" is withheld whenever any gate failed OR any scale is unassessable, and the report says
 * which condition withheld it.
 */
export function verdictSentence({ results, scales, inputs, analogue }) {
  const entries = Object.entries(results);
  const passed = entries.filter(([, r]) => r.status === 'pass').map(([k]) => k);
  const failed = entries.filter(([, r]) => r.status === 'fail').map(([k]) => k);
  const cannot = entries.filter(([, r]) => r.status === 'cannot-assess').map(([k]) => k);
  const unassessable = scales?.unassessable_scales || [];
  const unparsed = inputs?.desired_phenotype?.unparsed_verbatim || [];
  const refused = inputs?.desired_phenotype?.refused_verbatim || [];

  const withheld = [];
  if (failed.length) withheld.push(`${failed.length} gate(s) failed`);
  if (cannot.length) withheld.push(`${cannot.length} gate(s) could not be assessed`);
  if (unassessable.length) withheld.push(`${unassessable.length} biological scale(s) could not be assessed`);
  if (unparsed.length) withheld.push(`${unparsed.length} clause(s) of the desired phenotype were not parsed, so they were never checked`);
  if ((inputs?.sequence?.loci_covered ?? 0) === 0) withheld.push('no sequence was compared at any locus');

  const parts = [];
  parts.push(`Desired phenotype: "${inputs?.desired_phenotype?.text ?? '(none given)'}" parsed into ${inputs?.desired_phenotype?.criteria_parsed ?? 0} criterion/criteria${unparsed.length ? `, with ${unparsed.length} clause(s) NOT parsed and therefore NOT checked` : ''}${refused.length ? `, and ${refused.length} clause(s) refused` : ''}.`);
  parts.push(`Generated input was given as ${inputs?.generated?.given ?? 'nothing'}${inputs?.generated?.id ? ` ("${inputs.generated.id}")` : ''} and base as ${inputs?.base?.given ?? 'nothing'}${inputs?.base?.id ? ` ("${inputs.base.id}")` : ''}; sequence basis ${inputs?.sequence?.sequence_basis ?? 'unknown'} covering ${inputs?.sequence?.loci_covered ?? 0} locus/loci.`);
  parts.push(`Functional analogue(s), chosen from the desired function rather than relatedness: ${(analogue?.analogues || []).map(a => `${a.name} for ${a.function}`).join('; ') || 'none could be chosen'}${analogue?.criteria_with_no_known_analogue?.length ? `; ${analogue.criteria_with_no_known_analogue.length} criterion/criteria had no known analogue` : ''}.`);
  parts.push(passed.length ? `PASSED: ${passed.map(k => NAMES[k] || k).join(', ')}.` : 'PASSED: nothing.');
  parts.push(failed.length ? `FAILED: ${failed.map(k => `${NAMES[k] || k} -- ${results[k].gate}`).join(' ')}` : 'FAILED: nothing.');
  parts.push(cannot.length ? `COULD NOT BE ASSESSED: ${cannot.map(k => `${NAMES[k] || k} -- ${results[k].gate}`).join(' ')}` : 'COULD NOT BE ASSESSED: no named result was left unassessed.');
  parts.push(unassessable.length
    ? `SCALES NOT ASSESSED: ${unassessable.join(', ')} (see per_scale_coverage for why each one is empty rather than clear).`
    : 'SCALES: every scale in the sweep returned at least one record.');
  parts.push(withheld.length
    ? `The word "validated" is WITHHELD: ${withheld.join('; ')}. This report says what was checked and what was not; it is not a validity claim.`
    : 'Every gate passed and every scale returned a record. Even so this is a report on what was checked, against proxy-species annotation, and not a claim that the organism would work.');

  return {
    statement: parts.join(' '),
    passed, failed, could_not_assess: cannot,
    scales_not_assessed: unassessable,
    unparsed_desired_phenotype: unparsed,
    word_validated_withheld: withheld.length > 0,
    withheld_because: withheld,
  };
}
