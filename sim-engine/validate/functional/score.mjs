// score.mjs - THE FUNCTIONAL RESOLUTION LEDGER: one row per requirement, plus the headline numbers.
//
// Exposed as `functional_resolution`, the FOURTH named result beside genotype_similarity, phenotype_similarity and
// lean_check. The scorer's interface is sim-engine/validate/functional-interface.mjs (another thread's file, which
// this thread does not edit): it recomputes the counts from these rows, refuses any class outside the six-rung
// ladder, and never sums demonstrated with hypothesised resolutions. This file does not try to beat it to the
// punch - it reports its own counts so that a disagreement is visible, which is the point.
//
// THE HEADLINE IS COVERAGE, NOT RESOLVED FRACTION. A resolved fraction over a denominator we chose, from an
// analogue with no functional data, is the number most likely to mislead. `assessable of total` comes first.
import { requirementSet } from './requirements.mjs';
import { resolveAll, LADDER, compensationClassifier } from './resolve.mjs';
import { PAPERS } from './compensation.mjs';

export const SCOPE =
  'A functional-analogue ledger for ONE function, built from the loci one paper reports as known to differ in the '
  + 'analogue. Every requirement is a SEQUENCE STATE of the analogue, never a measured function of it: no flying-fish '
  + 'transcriptome, proteome, mutant or functional assay exists in any archive we searched, so nothing here says what '
  + 'the analogue\'s genes DO. Resolutions above UNRESOLVED carry their evidence and its kind; hypothesised and '
  + 'demonstrated resolutions are reported as two numbers and are never added together. No Aves data (frozen holdout).';

/** Build the ledger for one design. `target` is the desired phenotype when the caller has one. */
export async function ledgerFor(design, { target = null, designFinSL = null } = {}) {
  const reqSet = await requirementSet(design, target, { designFinSL });
  const rows = await resolveAll(reqSet);
  const comp = await compensationClassifier();

  const count = p => rows.filter(p).length;
  const counts = Object.fromEntries(LADDER.map(c => [c, count(r => r.class === c)]));
  const demonstrated = count(r => r.class !== 'UNRESOLVED' && !r.hypothesis);
  const hypothesised = count(r => r.hypothesis);
  const unresolved = counts.UNRESOLVED;

  const cov = reqSet.coverage;
  const headline =
    reqSet.direction === 'NO_ANALOGUE'
      ? `NO FUNCTIONAL ANALOGUE EXISTS for "${reqSet.analogue.function.label}" in any organism we may read, so there is no requirement set and no ledger. This is the finding, not a pass.`
      : reqSet.direction === 'SUBTRACTION'
        ? `SUBTRACTION. ${cov.requirements_total} requirements were derived against an organism that already lacks the function, and ${cov.requirements_assessable} of them are assessable. A subtraction is a different animal, not a pile of unmet requirements, and this ledger does not score it as one.`
        : `We can assess ${cov.requirements_assessable} of ${cov.requirements_total} requirements (${cov.assessable_fraction == null ? 'n/a' : (100 * cov.assessable_fraction).toFixed(1)} %); the other ${cov.unassessable} are unassessable, each with a stated reason. Of the ${rows.length} assessable differences: ${demonstrated} have a DEMONSTRATED resolution, ${hypothesised} rest on a HYPOTHESIS, and ${unresolved} are UNRESOLVED. ZERO loci have any flying-fish expression or functional-assay data.`;

  return {
    ran: true,
    closest_functional_analogue: {
      id: reqSet.analogue.id, name: reqSet.analogue.name, taxon: reqSet.analogue.taxon,
      function: reqSet.analogue.function.label, function_id: reqSet.analogue.function.id,
      function_operational_definition: reqSet.analogue.function.operational,
      function_signal: reqSet.analogue.function_signal,
      // Carried through the whitelist deliberately: this is the field that says the ledger is
      // about a function the caller did not ask for. Dropping it here left the gate passing.
      desired_phenotype_unmatched: reqSet.analogue.desired_phenotype_unmatched || null,
      basis: reqSet.analogue.basis, source: reqSet.analogue.source, evidence: reqSet.analogue.evidence,
      distance: reqSet.analogue.distance,
      other_satisfying_taxa: reqSet.analogue.other_satisfying_taxa,
      no_analogue: !!reqSet.analogue.no_analogue,
      nearest_partial_analogues: reqSet.analogue.nearest_partial_analogues || [],
      non_satisfying_taxa_listed: reqSet.analogue.non_satisfying_taxa_listed || [],
      refused: reqSet.analogue.refused, pterosaurs: reqSet.analogue.pterosaurs,
      data_poor: reqSet.analogue.data_poor, data_poor_statement: reqSet.analogue.data_poor_statement,
      functional_data_we_hold: reqSet.analogue.functional_data_we_hold,
      direction: reqSet.direction, direction_detected_by: reqSet.direction_detected_by, direction_evidence: reqSet.direction_evidence,
    },
    base_genome: reqSet.base_genome,
    design: { id: reqSet.genotype.id, label: reqSet.genotype.label, genotype_source: reqSet.genotype.source, genotype_provenance: reqSet.genotype.provenance,
      n_edits: (reqSet.genotype.edits || []).length, edits: (reqSet.genotype.edits || []).map(e => ({ gene: e.gene, edit: e.raw, kind: e.kind, zygosity: e.zygosity || null, allele: e.allele || null, source: e.source })),
      no_genotype_note: reqSet.genotype.no_genotype_note || null, not_ours: reqSet.genotype.not_ours || null, status_caveat: reqSet.genotype.status_caveat || null },
    requirement_set: reqSet.requirements.map(r => ({ id: r.id, requirement: r.requirement, value: r.value, unit: r.unit, source: r.source, kind: r.kind,
      assessable: r.assessable, unassessable_reason: r.unassessable_reason, search_depth: r.search_depth,
      analogue_has: r.level === 'residue' && r.analogue_state.read
        ? `${r.locus.alt} in ${r.analogue_state.n_carrying_derived}/${r.analogue_state.n_with_data} Exocoetidae species with data` : r.analogue_state.why || null,
      analogue_evidence_class: r.kind, analogue_functional_data: r.analogue_functional_data })),
    ledger: rows,
    counts,
    headline,
    resolution_two_ways: {
      demonstrated_resolved: demonstrated,
      hypothesis_resolved: hypothesised,
      unresolved: unresolved,
      differences_classified: rows.length,
      demonstrated_fraction: rows.length ? +(demonstrated / rows.length).toFixed(4) : null,
      hypothesis_fraction: rows.length ? +(hypothesised / rows.length).toFixed(4) : null,
      rule: 'the two fractions are reported separately and are NEVER summed. "Could be compensated" is a hypothesis, not evidence.',
    },
    unresolved_genes: rows.filter(r => r.class === 'UNRESOLVED').map(r => ({ id: r.id, gene: r.gene, difference: r.difference, caveat: r.unresolved_caveat || null, paralogue_refused: r.paralogue_refused || null, analogous_set_refused: r.analogous_set_refused || null, review_flag: r.review_flag || null })),
    coverage: {
      // the shape validate/functional-interface.mjs reads, plus the numbers that make it honest
      differences_classified: rows.length,
      differences_total: cov.requirements_total,
      genes_mapped: reqSet.requirements.filter(r => r.zebrafish?.symbol).length,
      genes_total: cov.requirements_total,
      requirements_assessable: cov.requirements_assessable,
      requirements_total: cov.requirements_total,
      assessable_fraction: cov.assessable_fraction,
      unassessable: cov.unassessable,
      unassessable_by_reason: cov.unassessable_by_reason,
      search_depth_full: cov.search_depth_full,
      search_depth_gene_level_only: cov.search_depth_gene_level_only,
      design_side_residue_read: cov.design_side_residue_read,
      analogue_loci_with_any_flying_fish_identifier: cov.analogue_loci_with_any_flying_fish_identifier,
      analogue_loci_with_any_flying_fish_EXPRESSION_or_ASSAY: cov.analogue_loci_with_any_flying_fish_EXPRESSION_or_ASSAY,
      note: cov.note,
    },
    requirement_set_scope: reqSet.scope,
    source_dataset: reqSet.source_dataset,
    compensation_rule: { classifier: comp.ok ? comp.from : null, classifier_absent_reason: comp.ok ? null : comp.reason,
      papers: Object.fromEntries(Object.entries(PAPERS).map(([k, p]) => [k, `${p.first_author || ''} ${p.year}, ${p.journal}, PMID ${p.pmid}${p.doi ? `, doi ${p.doi}` : ''}`.trim()])),
      scoring_rule: 'a requirement is MET by compensation only on class "documented" AND functional_rescue === true; "plausible-by-rule" is an UNMET requirement with a review flag; "not-expected" is trusted; "unknown" is never a pass' },
    scope: SCOPE,
  };
}

/** A compact table for RESULTS.md and for a human reading the ledger. */
export function ledgerTable(L) {
  const head = ['requirement', 'analogue evidence', 'design state', 'class', 'evidence', 'kind', 'hypothesis'];
  const rows = (L.ledger || []).map(r => [
    r.requirement, (r.evidence[0]?.claim || '').slice(0, 120), (r.difference || '').slice(0, 160), r.class,
    r.evidence.map(e => `${e.claim} [${e.source}; ${e.kind}]`).join(' | ').slice(0, 400), r.kind || '', r.hypothesis ? 'yes' : 'no',
  ]);
  return { head, rows };
}
