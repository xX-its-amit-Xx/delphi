#!/usr/bin/env node
// Tests for counts.mjs and the derived counts.json
//
//   node sim-engine/scales/atlas/test-counts.mjs [--fail-once]
//
// Four things are checked harder than the rest.
//
//   1. THE HELD-OUT CHECKS ARE REALLY HELD OUT. The whole calibration rests on fitting one parameter to
//      one measurement and then checking it against two others. The test asserts that the fitted anchor
//      does NOT include the held-out quantities, that both checks pass, and - the part that matters -
//      that the REJECTED anchors fail them. A model-selection story where every candidate passes is not
//      a selection.
//
//   2. THE TABLE TESTS ARE CHECKED IN THE ORDER THAT MATTERS. The test asserts that the rejected iBAQ
//      table would have WON on the spread test alone. That is the lesson of the file, and an assertion
//      that only checked the final choice would not carry it.
//
//   3. THE DOWNSAMPLING CONTRACT CANNOT UNDERSTATE. instancesFor is the function that stands between a
//      measured five million and a drawable twenty thousand. Its label must always name the ratio, its
//      is_complete flag must be false whenever anything was dropped, and the product of what is drawn
//      and what each one stands for must return the measured total.
//
//   4. THE REFUSALS CARRY NUMBERS. A refusal without a number is an opinion. Each one is checked for a
//      digit.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL; an assertion that survives its own fault asserts nothing.
import * as C from './counts.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ------------------------------------------------------------------ 2. the table tests, in order
console.log('\nwhich table, and the order the tests had to be applied in');
{
  const tt = C.DATA.protein_abundance.table_tests.results;
  const cpc = tt.nagaraj_2011_cpc, ibaq = tt.nagaraj_2011_iBAQ, geiger = tt.geiger_2012;

  check('the chosen table is the cpc derivative', f(
    C.DATA.protein_abundance.table_chosen === 'nagaraj_2011_cpc',
    C.DATA.protein_abundance.table_chosen === 'nagaraj_2011_iBAQ'), C.DATA.protein_abundance.table_chosen);
  check('the chosen table passes the dynamic-range test', f(cpc.T1_pass === true, cpc.T1_pass !== true));
  check('the chosen table passes the known-ratio test', f(cpc.T2_pass === true, cpc.T2_pass !== true));
  check('the rejected table FAILS the dynamic-range test', f(ibaq.T1_pass === false, ibaq.T1_pass !== false));
  check('the rejected table\'s whole dynamic range is under 100-fold', f(
    ibaq.T1_dynamic_range_fold < 100, ibaq.T1_dynamic_range_fold > 100), `${ibaq.T1_dynamic_range_fold.toFixed(1)}x`);
  check('the chosen table spans at least four orders of magnitude', f(
    cpc.T1_dynamic_range_fold > 1e4, cpc.T1_dynamic_range_fold < 1e4), `${cpc.T1_dynamic_range_fold.toExponential(2)}`);

  // THE LESSON: the rejected table wins on the elegant test
  check('the REJECTED table scores BETTER on the equimolar-spread test than the chosen one', f(
    ibaq.T3_median_equimolar_spread_fold < cpc.T3_median_equimolar_spread_fold,
    ibaq.T3_median_equimolar_spread_fold > cpc.T3_median_equimolar_spread_fold),
    `iBAQ ${ibaq.T3_median_equimolar_spread_fold.toFixed(1)}x vs cpc ${cpc.T3_median_equimolar_spread_fold.toFixed(1)}x`);
  check('and the order problem is written down rather than left implicit', f(
    /T3.*on its own.*WRONG table|order matters/i.test(JSON.stringify(C.DATA.protein_abundance.table_tests.order_matters)), false));
  check('the ribosomal-to-Pol II ratio is reproduced by the chosen table and flattened by the rejected one', f(
    cpc.T2_ribosomal_over_pol2_median > 5 && ibaq.T2_ribosomal_over_pol2_median < 2,
    cpc.T2_ribosomal_over_pol2_median < 5),
    `cpc ${cpc.T2_ribosomal_over_pol2_median.toFixed(2)} vs iBAQ ${ibaq.T2_ribosomal_over_pol2_median.toFixed(2)}`);
  check('the third table is rejected for an identifier problem, not a numerical one', f(
    geiger.verdict === 'REJECTED' && /identifier/i.test(geiger.why), geiger.verdict !== 'REJECTED'));
  check('both surviving tables have the same gene count, so the choice is not about coverage', f(
    cpc.genes === ibaq.genes, cpc.genes !== ibaq.genes));
}

// ------------------------------------------------------------------ 1. the held-out checks
console.log('\nthe calibration, and the two measurements it was not fitted to');
{
  const sel = C.DATA.anchor_selection, fit = C.DATA.calibration, ho = C.DATA.held_out;
  check('the chosen anchor is Pol II alone', f(sel.chosen === 'pol2_only', sel.chosen === 'all_seven'));
  check('three anchors were considered, not one', f(Object.keys(sel.candidates).length === 3, Object.keys(sel.candidates).length !== 3));
  check('the chosen anchor uses exactly one constraint', f(
    sel.candidates.pol2_only.constraints_used === 1, sel.candidates.pol2_only.constraints_used !== 1));
  check('the chosen anchor passes BOTH held-out checks', f(
    sel.candidates.pol2_only.held_out_passed === 2, sel.candidates.pol2_only.held_out_passed !== 2));

  // the part that makes it a selection
  check('the transcription-factor anchor FAILS both held-out checks', f(
    sel.candidates.gtfs_only.held_out_passed === 0, sel.candidates.gtfs_only.held_out_passed !== 0),
    `passed ${sel.candidates.gtfs_only.held_out_passed}`);
  check('the all-seven anchor also fails, so the selection is not vacuous', f(
    sel.candidates.all_seven.held_out_passed < 2, sel.candidates.all_seven.held_out_passed === 2),
    `passed ${sel.candidates.all_seven.held_out_passed}`);
  check('the three anchors give materially different scale factors', f(
    Math.max(...Object.values(sel.candidates).map(c => c.T)) / Math.min(...Object.values(sel.candidates).map(c => c.T)) > 3,
    false),
    Object.entries(sel.candidates).map(([k, v]) => `${k}=${v.T.toExponential(2)}`).join(' '));

  check('held-out check 1, total protein molecules per cell, lands inside the independent range', f(
    ho.H1_total_protein.inside_range === true, ho.H1_total_protein.inside_range !== true));
  check('held-out check 2, ribosomes per cell, lands inside the measured range', f(
    ho.H2_ribosomes.inside_range === true, ho.H2_ribosomes.inside_range !== true),
    `${ho.H2_ribosomes.predicted.toExponential(2)} in [${ho.H2_ribosomes.lo.toExponential(1)}, ${ho.H2_ribosomes.hi.toExponential(1)}]`);
  check('the ribosome range comes from two primary measurements and excludes the vendor figure', f(
    /vendor/.test(ho.H2_ribosomes.source) && ho.H2_ribosomes.lo === 3.3e6 && ho.H2_ribosomes.hi === 9.5e6,
    ho.H2_ribosomes.lo !== 3.3e6));
  check('each held-out quantity states why it is independent, naming what it does NOT depend on', f(
    /no reference to/i.test(ho.H1_total_protein.why_independent)
      && /unrelated to/i.test(ho.H2_ribosomes.why_independent),
    !/no reference to/i.test(ho.H1_total_protein.why_independent)));
  check('a single-constraint fit reports a residual of exactly 1 and says why', f(
    fit.residual_rms_fold === 1 && /no residual/i.test(sel.candidates.pol2_only.residual_note),
    fit.residual_rms_fold !== 1), `${fit.residual_rms_fold}`);
  check('the scale factor carries an interval, not a bare number', f(
    Array.isArray(fit.interval_95) && fit.interval_95[0] < fit.total_protein_molecules_per_cell
      && fit.interval_95[1] > fit.total_protein_molecules_per_cell, false));
  check('the verdict is CALIBRATED', f(C.DATA.verdict === 'CALIBRATED', C.DATA.verdict === 'NOT CALIBRATED'));
}

// ------------------------------------------------------------------ the disagreement, kept
console.log('\nthe contradiction that is recorded rather than averaged');
{
  const per = C.DATA.calibration.per_constraint;
  const pol = per.find(p => /polymerase_ii/.test(p.constraint));
  const gtfs = per.filter(p => !/polymerase_ii/.test(p.constraint));
  check('Pol II is fitted exactly, since it is the anchor', f(near(pol.fold, 1, 1e-9), !near(pol.fold, 1, 1e-9)), `${pol.fold}`);
  check('every transcription factor is over-predicted, not scattered either side', f(
    gtfs.every(g => g.fold > 1), gtfs.some(g => g.fold > 1) === false),
    gtfs.map(g => g.fold.toFixed(1)).join(', '));
  check('the disagreement is at least sevenfold for most factors', f(
    gtfs.filter(g => g.fold >= 7).length >= 4, gtfs.filter(g => g.fold >= 7).length < 4),
    `${gtfs.filter(g => g.fold >= 7).length} of ${gtfs.length} at >= 7x`);
  check('the disagreement is named as a contradiction between two measurements', f(
    /cannot satisfy both/i.test(C.DATA.anchor_selection.problem), false));
  check('TBP is excluded from the constraints with a stated reason', f(
    /lower bound|bound pool/i.test(C.DATA.absolute_anchor.tbp_excluded) && !per.some(p => p.constraint === 'TBP'),
    per.some(p => p.constraint === 'TBP')));
}

// ------------------------------------------------------------------ the inventory
console.log('\nthe inventory, and the spread it carries');
{
  check('twelve machines have a count', f(
    Object.values(C.DATA.machines).filter(m => typeof m.copies_per_cell === 'number').length === 12,
    Object.values(C.DATA.machines).filter(m => typeof m.copies_per_cell === 'number').length !== 12));
  check('Pol II comes out at the measured 320,000, because it is the anchor', f(
    near(C.copiesPerCell('rna_polymerase_ii'), 320000, 1), !near(C.copiesPerCell('rna_polymerase_ii'), 320000, 1)));
  check('ribosomes outnumber Pol II by more than tenfold, as they must', f(
    C.copiesPerCell('ribosome') / C.copiesPerCell('rna_polymerase_ii') > 10, false),
    `${(C.copiesPerCell('ribosome') / C.copiesPerCell('rna_polymerase_ii')).toFixed(1)}x`);
  check('the proteasome, never fitted and never used to choose, lands within twofold of the literature 800,000', f(
    Math.abs(Math.log(C.copiesPerCell('proteasome_20s_core') / 8e5)) < Math.log(2),
    Math.abs(Math.log(C.copiesPerCell('proteasome_20s_core') / 8e5)) > Math.log(2)),
    `${C.copiesPerCell('proteasome_20s_core').toLocaleString('en-GB')}`);
  check('every count is a MEDIAN over subunits, which is stated on each entry', f(
    Object.values(C.DATA.machines).every(m => !m.copies_per_cell || /median/i.test(m.estimator)), false));
  check('every count carries the abundance table\'s own subunit spread', f(
    Object.values(C.DATA.machines).every(m => !m.copies_per_cell || typeof m.subunit_spread_fold === 'number'), false));
  check('the spread is the LARGER uncertainty for most machines, and is not hidden', f(
    Object.values(C.DATA.machines).filter(m => m.subunit_spread_fold > C.DATA.calibration.residual_rms_fold).length >= 10,
    false));
  check('a machine with too few measured subunits is refused rather than guessed', f(
    C.drawingSpec('a_machine_that_does_not_exist').drawable === false,
    C.drawingSpec('a_machine_that_does_not_exist').drawable !== false));
  check('copiesPerCell returns null for an unknown machine, not zero', f(
    C.copiesPerCell('nonsense') === null, C.copiesPerCell('nonsense') === 0));
  check('drawingSpec names its provenance as measured-times-derived', f(
    /MEASURED/.test(C.drawingSpec('ribosome').provenance) && /DERIVED/.test(C.drawingSpec('ribosome').provenance), false));
  check('coverage is reported, so a complex measured in half its subunits says so', f(
    C.drawingSpec('rna_polymerase_ii').coverage < 1 && C.drawingSpec('mcm_helicase').coverage === 1,
    C.drawingSpec('rna_polymerase_ii').coverage === 1));
}

// ------------------------------------------------------------------ 3. the downsampling contract
console.log('\nthe downsampling contract, which is what stands between five million and a drawable scene');
{
  const r = C.instancesFor('ribosome', { budget: 20000 });
  check('a budget below the measured count downsamples', f(r.instances_to_draw === 20000, r.instances_to_draw !== 20000));
  check('is_complete is false when anything was dropped', f(r.is_complete === false, r.is_complete !== false));
  check('drawn x stands-for returns the measured total', f(
    near(r.instances_to_draw * r.one_drawn_stands_for, r.measured_total, 1), false),
    `${r.instances_to_draw} x ${r.one_drawn_stands_for.toFixed(2)} = ${(r.instances_to_draw * r.one_drawn_stands_for).toFixed(0)} vs ${r.measured_total.toFixed(0)}`);
  check('the label names the ratio, so the scene cannot be read as complete', f(
    /stands for/.test(r.label) && /\d/.test(r.label), !/stands for/.test(r.label)), r.label);
  check('the label names both the drawn and the measured number', f(
    r.label.includes('20,000') && /4,928,476|4,928/.test(r.label), false), r.label);

  const t = C.instancesFor('tfiid', { budget: 60000 });
  check('a machine that fits the budget is drawn complete', f(t.is_complete === true, t.is_complete !== true), `${t.measured_total} of budget 60000`);
  check('and its label says so without inventing a ratio', f(
    /all /.test(t.label) && !/stands for/.test(t.label), /stands for/.test(t.label)), t.label);
  check('one drawn stands for exactly 1 when nothing is dropped', f(
    near(t.one_drawn_stands_for, 1, 1e-9), !near(t.one_drawn_stands_for, 1, 1e-9)));
  check('a share splits the budget rather than ignoring it', f(
    C.instancesFor('ribosome', { budget: 20000, share: 0.5 }).instances_to_draw === 10000,
    C.instancesFor('ribosome', { budget: 20000, share: 0.5 }).instances_to_draw !== 10000));
  check('an unknown machine is not drawable and says why', f(
    C.instancesFor('nonsense').drawable === false, C.instancesFor('nonsense').drawable !== false));
  check('the budget never rounds down to zero instances', f(
    C.instancesFor('ribosome', { budget: 1, share: 1e-9 }).instances_to_draw >= 1, false));
}

// ------------------------------------------------------------------ the transcriptome
console.log('\nwhat 100 million measured cells can and cannot say');
{
  const tr = C.DATA.transcriptome;
  check('the transcriptome source is Arc\'s Tahoe-100M under CC0', f(
    /Tahoe-100M/.test(tr.source.dataset) && tr.source.licence === 'CC0-1.0', tr.source.licence !== 'CC0-1.0'));
  check('it is named as part of the Arc Virtual Cell Atlas', f(/Arc/.test(tr.source.part_of), !/Arc/.test(tr.source.part_of)));
  check('two of 3,388 shards were read, and the file says so rather than implying all of it', f(
    tr.source.shards_read.length === 2 && tr.source.shards_total === 3388, tr.source.shards_total !== 3388));
  check('56,449 cells across 5,089 conditions', f(
    tr.scanned.cells === 56449 && tr.scanned.conditions === 5089, tr.scanned.cells !== 56449));
  check('the detection rate is the stated reason per-cell counts are refused', f(
    tr.scanned.median_genes_detected_per_cell < 2000 && tr.scanned.genes_in_vocabulary > 60000,
    tr.scanned.median_genes_detected_per_cell > 2000),
    `${tr.scanned.median_genes_detected_per_cell} of ${tr.scanned.genes_in_vocabulary}`);
  check('the Pol II refusal carries a probability, not an adjective', f(
    tr.per_cell_counts_refused.per_machine.rna_polymerase_ii.probability_all_subunits_detected_if_independent < 1e-12,
    tr.per_cell_counts_refused.per_machine.rna_polymerase_ii.probability_all_subunits_detected_if_independent > 1e-12));
  check('the refusal is machine-specific: cohesin is expected in over 100 cells', f(
    tr.per_cell_counts_refused.per_machine.cohesin.expected_cells_with_all_subunits_of_56k > 100,
    tr.per_cell_counts_refused.per_machine.cohesin.expected_cells_with_all_subunits_of_56k < 100),
    `${tr.per_cell_counts_refused.per_machine.cohesin.expected_cells_with_all_subunits_of_56k.toFixed(0)}`);

  const h = tr.histone_capture_test;
  check('the histone capture prediction was stated before the measurement', f(
    /not polyadenylated|stem-loop/i.test(h.claim_under_test), false));
  check('and it is SUPPORTED by a factor of at least ten', f(
    h.verdict === 'SUPPORTED' && h.ratio_umi_per_gene_variant_over_replication_dependent > 10,
    h.verdict !== 'SUPPORTED'), `${h.ratio_umi_per_gene_variant_over_replication_dependent.toFixed(1)}x`);
  check('the test compares per-gene rates, not raw totals, since the two sets differ in size', f(
    h.replication_dependent.genes !== h.polyadenylated_variants.genes
      && typeof h.replication_dependent.umi_per_gene === 'number', false));

  check('transcriptShare flags the three contaminated gene sets as unusable for a min estimator', f(
    C.transcriptShare('ribosome_60s').usable_for_a_min_estimator === false
      && C.transcriptShare('nuclear_pore').usable_for_a_min_estimator === false,
    C.transcriptShare('ribosome_60s').usable_for_a_min_estimator === true));
  check('and passes the curated ones', f(
    C.transcriptShare('rna_polymerase_ii').usable_for_a_min_estimator === true,
    C.transcriptShare('rna_polymerase_ii').usable_for_a_min_estimator === false));
  check('the curated gene sets are labelled curated and the pattern ones pattern', f(
    C.transcriptShare('rna_polymerase_ii').gene_set === 'curated'
      && C.transcriptShare('nuclear_pore').gene_set === 'pattern', false));
  check('transcriptShare returns null for an unknown machine', f(
    C.transcriptShare('nonsense') === null, C.transcriptShare('nonsense') !== null));
  check('the drug axis is reported with the vehicle control separated out', f(
    tr.drug_axis.vehicle_conditions > 0 && tr.drug_axis.conditions_with_at_least_40_cells > tr.drug_axis.vehicle_conditions,
    tr.drug_axis.vehicle_conditions === 0));
  check('the pseudogene drops are listed by name, not counted', f(
    Array.isArray(tr.pseudogenes_dropped.ribosome_60s) && tr.pseudogenes_dropped.ribosome_60s.includes('RPL13P'),
    !Array.isArray(tr.pseudogenes_dropped.ribosome_60s)));
}

// ------------------------------------------------------------------ 4. refusals carry numbers
console.log('\nthe refusals');
{
  check('six refusals are recorded', f(C.REFUSALS.length === 6, C.REFUSALS.length !== 6), `${C.REFUSALS.length}`);
  check('every refusal states a reason', f(C.REFUSALS.every(r => r.why && r.why.length > 30), false));
  check('every refusal carries a digit somewhere, so none is a bare opinion', f(
    C.REFUSALS.every(r => /\d/.test(JSON.stringify(r))), false),
    C.REFUSALS.filter(r => !/\d/.test(JSON.stringify(r))).map(r => r.refused).join('; '));
  check('the single-cell refusal is explicitly not blanket', f(
    /per machine/i.test(C.REFUSALS[0].not_blanket), false));
  check('the mRNA-to-protein refusal quotes the measured spread', f(
    /81-fold/.test(C.REFUSALS[2].why), !/81-fold/.test(C.REFUSALS[2].why)));
  check('the HeLa-only refusal names what would lift it', f(
    C.WHAT_WOULD_CHANGE_THESE_NUMBERS.some(s => /cell type/i.test(s)), false));
  check('what-would-change names the measurement that removes the free parameter', f(
    C.WHAT_WOULD_CHANGE_THESE_NUMBERS.some(s => /free parameter/i.test(s)), false));
  check('and states that more Tahoe shards would NOT change the counts', f(
    C.WHAT_WOULD_CHANGE_THESE_NUMBERS.some(s => /structural/i.test(s) && /shard/i.test(s)), false));
}

// ------------------------------------------------------------------ provenance
console.log('\nprovenance');
{
  const P = C.PROVENANCE;
  const KINDS = ['MEASURED', 'DEPICTED', 'DERIVED', 'DATABASE_RECORD', 'TOOL_OUTPUT', 'CONTESTED', 'NOT_ESTABLISHED'];
  check('every provenance entry uses a kind from the project vocabulary', f(
    Object.values(P).every(v => KINDS.includes(v.kind)), false),
    Object.values(P).map(v => v.kind).join(', '));
  check('the immunoblot counts are MEASURED and the scale factor DERIVED', f(
    P.absolute_counts.kind === 'MEASURED' && P.scale_factor.kind === 'DERIVED',
    P.scale_factor.kind === 'MEASURED'));
  check('both abundance sources are DATABASE_RECORD, not MEASURED', f(
    P.protein_abundance.kind === 'DATABASE_RECORD' && P.transcriptome.kind === 'DATABASE_RECORD',
    P.protein_abundance.kind === 'MEASURED'));
  check('every entry carries a citation or a named source', f(
    Object.values(P).every(v => v.citation || v.citations || v.from), false));
  check('the Kimura citation carries a DOI and a PMID', f(
    /10\.1128\/MCB\.19\.8\.5383/.test(P.absolute_counts.citation) && /10409729/.test(P.absolute_counts.citation),
    !/10409729/.test(P.absolute_counts.citation)));
  check('the transcriptome entry states it never sets a count', f(
    /never sets a count/i.test(P.transcriptome.used_for), false));
  check('the table choice is attributed to the tests, not to preference', f(
    /not by preference/i.test(P.protein_abundance.chosen_how), false));
  check('the held-out totals are credited to the module that compiled them', f(
    /budget\.mjs/.test(P.held_out_totals.from), !/budget\.mjs/.test(P.held_out_totals.from)));
  check('three literature citations back the held-out numbers', f(
    P.held_out_totals.citations.length === 3, P.held_out_totals.citations.length !== 3));
  // the absolute-counts entry records HOW it was retrieved as well as when, so the assertion is on
  // the date being present rather than on the field being nothing but a date.
  check('every retrieval field names this run\'s date', f(
    [P.protein_abundance.retrieved, P.absolute_counts.retrieved, P.transcriptome.retrieved]
      .every(d => typeof d === 'string' && d.includes('2026-11-08')),
    [P.protein_abundance.retrieved, P.absolute_counts.retrieved, P.transcriptome.retrieved]
      .some(d => !String(d).includes('2026-11-08'))));
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  [--fail-once: every line above must FAIL]' : ''}`);
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
