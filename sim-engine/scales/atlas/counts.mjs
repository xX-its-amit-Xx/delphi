// HOW MANY TO DRAW: the measured molecular inventory of one cell, and what it licenses.
//
// ============================== THE PROBLEM THIS SOLVES ==============================
// The atlas draws ribosomes, polymerases and chromatin. Until now it drew a number of them chosen to
// look right. That is the one thing this project is not allowed to do, and the fix is not to pick a
// better-looking number but to go and get the measured one.
//
// Measured turns out to be three separate problems:
//
//   1. WHICH TABLE. PaxDb ships several HeLa proteomes and they disagree. One had to be chosen, and the
//      choice had to be a measurement.
//   2. WHAT SCALE. Abundance tables report relative abundance. Copies per cell needs one more number -
//      the total protein molecules in a cell - and that number had to be fitted and then checked.
//   3. WHAT THE TRANSCRIPTOME CAN AND CANNOT SAY. Arc's Tahoe-100M is 100 million measured single-cell
//      transcriptomes, which sounds like the obvious source for molecular counts and is not one.
//
// Every number below carries which of those it came from. The full derivation, with every intermediate,
// is in ./counts.json; this file is the reading of it and the drawing contract.
//
// ============================== 1. THE TABLE TEST, AND ITS OWN BUG ==============================
// Three tests, and the ORDER is the finding:
//
//   T1 dynamic range     real abundances in one cell span 4-6 orders of magnitude
//   T2 a known ratio     ribosomal proteins outnumber Pol II subunits in a growing cell
//   T3 equimolar spread  a 1:1 complex's subunits must come out level
//
// T3 was written first, because it is the elegant one: it needs no anchor, no literature count and no
// scale factor, only the stoichiometry. On its own it picks the WRONG table. PaxDb's iBAQ derivative of
// the Nagaraj HeLa proteome is log-compressed - its entire dynamic range is 27-fold - so its subunits
// come out level because EVERYTHING comes out level, and it scores a near-perfect 1.3-fold median
// spread. The cpc derivative of the SAME mass spectrometry run on the SAME cells spans 1.75e8-fold and
// scores 25.5.
//
// A spread test rewards flatness. T1 is what makes T3 mean anything, and T3 is retained not as a
// pass/fail but as the per-subunit noise that forces every count below to be a MEDIAN over subunits
// rather than a single gene's value.
//
// ============================== 2. THE SCALE, AND A GENUINE CONTRADICTION ==============================
// Fitting the scale factor on all seven of Kimura's absolute immunoblot counts at once gives a 3.03-fold
// residual and misses both held-out checks by about tenfold. That is not a fitting problem. Kimura's
// headline result is that Pol II exceeds the general transcription factors by 10 to 30 times; the
// abundance table puts them at a ratio near 1. Two careful measurements twelve years apart disagree
// about a RATIO by an order of magnitude, and one parameter cannot satisfy both.
//
// So the anchor was chosen by two measurements it was not fitted to. Anchoring on Pol II alone gives
// 2.51e9 protein molecules per cell, which lands inside an independently compiled total (3.70e9) and
// predicts 4.93 million ribosomes, inside the 3.3-9.5 million measured twice in the primary literature.
// Anchoring on the transcription factors fails both. The GTF disagreement is therefore recorded as an
// open discrepancy, per factor, rather than averaged away.
//
// A third number was never fitted and never used to choose: the 20S proteasome comes out at 998,982
// per cell against a literature figure near 800,000.
//
// ============================== 3. WHAT 100 MILLION CELLS CANNOT TELL YOU ==============================
// Tahoe-100M is the largest single-cell perturbation atlas there is, CC0, and the natural first stop for
// "how many ribosomes does this cell have". The answer it gives is zero, for every cell and every
// machine, and the reason is arithmetic: a complex needs every subunit detected, and the median cell in
// this library detects 1,066 of 62,710 genes. The probability that all twelve Pol II subunits appear in
// one cell is 3.6e-15, so the expected number of countable cells in 56,449 is 0.000.
//
// That is a refusal with a number attached, and it is machine-specific rather than blanket: cohesin, at
// five abundant subunits, is expected in 138 cells of the 56,449. The transcriptome is still used here -
// for the perturbation axis, where it is the only source that exists - but it never sets a count.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA = Object.freeze(JSON.parse(readFileSync(join(HERE, 'counts.json'), 'utf8')));

export const PROVENANCE = Object.freeze({
  protein_abundance: {
    kind: 'DATABASE_RECORD',
    what: 'PaxDb, dataset 9606-hela_Nagaraj_2011_cpc.txt, relative protein abundance in parts per million',
    citation: DATA.protein_abundance.source.citation,
    url: DATA.protein_abundance.source.url,
    retrieved: DATA.protein_abundance.source.retrieved,
    chosen_how: 'by the three tests in DATA.protein_abundance.table_tests, not by preference',
  },
  absolute_counts: {
    kind: 'MEASURED',
    what: 'copies per HeLa cell of RNA polymerase II and six general transcription factors, by quantitative immunoblotting',
    citation: DATA.absolute_anchor.citation,
    retrieved: DATA.absolute_anchor.retrieved,
  },
  scale_factor: {
    kind: 'DERIVED',
    what: 'total protein molecules per HeLa cell, one free parameter fitted to the Pol II count',
    from: 'fitted in this repo by sim-engine/scales/atlas/counts.json, over the PaxDb abundance table and the Kimura 1999 absolute count',
    value: DATA.calibration.total_protein_molecules_per_cell,
    interval_95: DATA.calibration.interval_95,
    validated_by: 'two held-out measurements, in DATA.held_out',
  },
  transcriptome: {
    kind: 'DATABASE_RECORD',
    what: 'Tahoe-100M, two of 3,388 shards, 56,449 cells, 5,089 cell-line-by-drug conditions',
    citation: DATA.transcriptome.source.citation,
    host: DATA.transcriptome.source.host,
    licence: DATA.transcriptome.source.licence,
    part_of: DATA.transcriptome.source.part_of,
    retrieved: DATA.transcriptome.source.retrieved,
    used_for: 'the perturbation axis only. It never sets a count; see REFUSALS.',
  },
  held_out_totals: {
    kind: 'DERIVED',
    what: 'the total protein count and ribosome count used to check the scale factor',
    from: 'sim-engine/scales/molecular/budget.mjs, which compiled them with their own provenance',
    citations: [
      'Chen et al. 2023, via budget.mjs: 1,525,243 protein copies per um^3 at 2,425 um^3',
      'Duncan & Hershey 1983, J Biol Chem 258:7228, PMID 6853516: implies 3.3e6 ribosomes per HeLa cell',
      'Wolf & Schlessinger 1977, Biochemistry 16:2783, PMID 889788: 9.5e6 ribosomes per HeLa cell',
    ],
  },
});

/** Copies per cell of an assembled complex, as a median over its measured subunits.
 *  Returns null for a machine with no entry, rather than a number that looks like a measurement. */
export function copiesPerCell(machine) {
  const m = DATA.machines[machine];
  if (!m || m.refused || typeof m.copies_per_cell !== 'number') return null;
  return m.copies_per_cell;
}

/** Everything a caller needs to draw a machine honestly, or null.
 *
 *  `uncertainty_fold` is the calibration residual, and `subunit_spread_fold` is the abundance table's
 *  own disagreement across subunits of a complex that cannot disagree. The second is usually the
 *  larger of the two and is the one a reader should see. */
export function drawingSpec(machine) {
  const m = DATA.machines[machine];
  if (!m || typeof m.copies_per_cell !== 'number') {
    return { machine, drawable: false, why: m?.refused ?? 'no entry in the inventory' };
  }
  return Object.freeze({
    machine,
    drawable: true,
    copies_per_cell: m.copies_per_cell,
    estimator: m.estimator,
    subunits_measured: m.subunits_found,
    subunits_total: m.subunits_requested,
    coverage: m.coverage,
    subunit_spread_fold: m.subunit_spread_fold,
    calibration_uncertainty_fold: DATA.calibration.residual_rms_fold,
    provenance: 'MEASURED abundance x DERIVED scale factor. Neither is a choice; the scale factor is validated against two held-out measurements.',
  });
}

export const DRAW_BUDGET_DEFAULT = 60000;

/** THE DOWNSAMPLING CONTRACT.
 *
 *  Nearly five million ribosomes cannot be drawn. The viewer draws a sample, and the honest way to do
 *  that is to make the sampling an explicit, stated ratio rather than a quietly smaller number. A
 *  viewer that draws 20,000 ribosomes and calls them "ribosomes" is lying by a factor of 246.
 *
 *  Returns the instance count to draw, the ratio it represents, and the sentence a label must carry. */
export function instancesFor(machine, { budget = DRAW_BUDGET_DEFAULT, share = 1 } = {}) {
  const n = copiesPerCell(machine);
  if (n === null) return { machine, drawable: false, why: drawingSpec(machine).why };
  const allowed = Math.max(1, Math.floor(budget * share));
  const draw = Math.min(n, allowed);
  const ratio = n / draw;
  return Object.freeze({
    machine,
    drawable: true,
    measured_total: n,
    instances_to_draw: Math.round(draw),
    one_drawn_stands_for: ratio,
    is_complete: ratio <= 1.0000001,
    label: ratio <= 1.0000001
      ? `all ${Math.round(n).toLocaleString('en-GB')} drawn`
      : `${Math.round(draw).toLocaleString('en-GB')} drawn of ${Math.round(n).toLocaleString('en-GB')} measured - one sphere stands for ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toLocaleString('en-GB')}`,
  });
}

/** Share of the transcriptome a machine's subunits take, at pseudobulk.
 *  A share survives aggregation; a per-cell count does not. Returns null where the gene set is one of
 *  the three this project found to be contaminated. */
export function transcriptShare(machine) {
  const s = DATA.transcriptome.machine_shares[machine];
  if (!s) return null;
  const broken = s.min_over_q10 !== undefined && s.min_over_q10 !== null && s.min_over_q10 < 0.3;
  return Object.freeze({
    machine,
    share_of_transcriptome: s.share_of_transcriptome,
    gene_set: s.gene_set,
    min_over_q10: s.min_over_q10,
    usable_for_a_min_estimator: !broken,
    why: broken
      ? 'min_over_q10 below 0.3 means one gene is carrying the whole estimate. This gene set contains a pseudogene or a tissue-specific paralogue; see DATA.transcriptome.min_estimator_fragility.'
      : 'the scarcest subunit is within a factor of three of the tenth percentile, so no single gene is carrying the estimate.',
  });
}

export const REFUSALS = Object.freeze([
  {
    refused: 'a molecular machine count from a single cell',
    source_that_cannot_give_it: 'Tahoe-100M, or any droplet or split-pool single-cell transcriptome',
    why: DATA.transcriptome.per_cell_counts_refused.reason,
    with_a_number: 'P(all twelve Pol II subunits detected in one cell) = 3.6e-15, so 0.000 countable cells expected in 56,449',
    not_blanket: 'cohesin, five abundant subunits, is expected in 138 of the 56,449 cells. The refusal is per machine.',
  },
  {
    refused: 'a nucleosome or histone count from this transcriptome',
    why: 'replication-dependent histone mRNAs end in a stem-loop rather than a polyA tail, so a polyA-primed library under-counts them. Predicted before looking, then measured: 375 UMI per gene for the replication-dependent histones against 11,233 for the polyadenylated variants, a 29.9-fold gap.',
    verdict: DATA.transcriptome.histone_capture_test.verdict,
  },
  {
    refused: 'protein copy numbers converted from mRNA',
    why: 'measured on the genes present in both tables: one transcript buys between 1 and 60 protein copies depending on the gene, an 81-fold spread across the middle 80 % of genes. mRNA ranks proteins; it does not count them.',
  },
  {
    refused: 'a count for any machine whose subunit gene set was built by pattern rather than by hand',
    why: 'the scarcest-subunit estimator was set by a gene that does not belong to the complex three times running - ribosomal pseudogenes, then RPL10L, then NUP210L. Every count in DATA.machines is a median over subunits for exactly this reason.',
  },
  {
    refused: 'a reconciliation of Kimura\'s transcription-factor counts with the abundance table',
    why: 'they disagree by 7 to 25-fold per factor after the scale factor is fixed by Pol II. Both are measurements. Recorded in DATA.anchor_selection, not averaged.',
  },
  {
    refused: 'anything about a cell that is not HeLa',
    why: 'all 5 inputs are HeLa - the abundance table, the immunoblot counts, the 3.70e9 total protein count, the 3.3-9.5e6 ribosome count and the 2,425 um^3 cell volume. Mixing cell types would make the inventory incoherent, which is the thing it exists to avoid.',
  },
]);

export const WHAT_WOULD_CHANGE_THESE_NUMBERS = Object.freeze([
  'a modern absolute proteome of HeLa with copies per cell measured directly rather than fitted. That would remove the one free parameter entirely.',
  'a repeat of Kimura\'s immunoblots, which would settle whether the Pol II to transcription-factor ratio is 10-30 or near 1.',
  'the remaining 3,386 Tahoe shards, which would not change any count - the refusal is structural, not a sample-size problem - but would tighten the perturbation axis.',
  'a cell type with its own complete measurement set, which would let the inventory move off HeLa.',
]);
