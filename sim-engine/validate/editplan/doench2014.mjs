// Doench et al. 2014 "Rule Set 1": the ONLY on-target efficiency model in this project whose coefficients
// come from a publication rather than from us.
//
// WHY THIS MODULE EXISTS. editplan's original on-target number is a heuristic with weights WE chose
// (ON_TARGET_RULE in editplan.mjs). That heuristic is still here, still labelled, and is still what ranks a
// non-SpCas9 guide, because nothing published covers those geometries. But where a real published model
// applies - SpCas9, 20-nt spacer, NGG PAM - a published model should be used instead of one we invented.
//
// WHAT IT IS. The logistic regression of Doench et al. 2014, Nat Biotechnol 32:1262-1267,
// doi 10.1038/nbt.3026, "Rational design of highly active sgRNAs for CRISPR-Cas9-mediated gene
// inactivation". 70 position-specific nucleotide and dinucleotide features over a 30-mer, plus a GC term
// and an intercept. The score is the logistic of the linear predictor, so it lies in (0,1).
//
// WHERE THE COEFFICIENTS CAME FROM, exactly. Doench et al. 2014 Supplementary Table 9, "Feature weights
// from the final model used to score sgRNAs", page 15 of the Supplementary Text and Figures PDF:
//   https://static-content.springer.com/esm/art%3A10.1038%2Fnbt.3026/MediaObjects/41587_2014_BFnbt3026_MOESM4_ESM.pdf
// That PDF was fetched in this run and its page 15 extracted with pdftotext -raw. The table exists ONLY as
// a PDF table: none of the six .xlsx supplements (MOESM5-10) contain these numbers, which corroborates
// CRISPOR's own source comment about typing the table out of the PDF.
//
// The published values are rounded to 8 decimal places. The values below carry 9, from the Bioconductor
// crisprScore package. All 70 feature keys match the published table exactly, and all 70 nine-decimal
// values round to the published eight-decimal values exactly, so this is a strict refinement of the
// published numbers, not a disagreement with them. Four independent sources agree on the whole table: the
// published PDF, CRISPOR's doenchScore.py, Bioconductor crisprScore, and FlashFry.
//
// A NOTE ON FOUR DEGENERATE PAIRS. A25/AG25, C25/CG25, T25/TG25 and T28/GT27 (1-based names) carry
// identical coefficients. That is in the published table, not a transcription slip: the PAM G's sit at
// 1-based positions 26 and 27, so the dinucleotide AG at 25 is the single A at 25 plus a constant G. The
// model double-counts those features by construction, and every implementation reproduces the double
// count. So does this one, because removing it would no longer be Doench 2014.
//
// ============================== WHAT THIS SCORE IS NOT ==============================
//   * NOT Doench 2016 "Rule Set 2" / Azimuth, which is the newer and better model. Rule Set 2 cannot be
//     reimplemented from published numbers, and that is now established rather than assumed: the shipped
//     model is a pickled scikit-learn GradientBoostingRegressor of 100 depth-3 decision trees over 627
//     features, so no coefficient vector exists to publish. Doench 2016's Supplementary Table 17 is Gini
//     feature importance - a ranking, not weights. Porting Rule Set 2 means extracting 100 trees from a
//     pickle, not transcribing a table, and that was not done here. See RULE_SET_2.
//   * NOT measured on our guides, and NOT measured in zebrafish. It was fitted on sgRNAs tiling mouse and
//     human genes in cell lines, with a lentiviral, flow-sorted, protein-knockout readout. Zebrafish
//     one-cell-stage injection of Cas9 protein or mRNA is a different delivery, a different chromatin
//     state and a different readout. Using it here is a TRANSFER ACROSS SPECIES AND ASSAY, and it is
//     labelled that way in the provenance.
//   * NOT a prediction of knock-in (HDR) efficiency. It predicts how well a guide CUTS, in a gene-
//     inactivation screen. Cutting is necessary for HDR and nowhere near sufficient.
//   * NOT applicable outside SpCas9 with a 20-nt spacer and an NGG PAM. For SaCas9 and AsCas12a it returns
//     {ran: false} with the reason, rather than a number computed on a geometry the model never saw.
//   * NOT evidence about specificity or safety. It says nothing whatever about off-targets.
//   * NOT a phenotype prediction. A guide that cuts well at kcnk5b says nothing about fin length.

export const CITATION = 'Doench et al. 2014, Nat Biotechnol 32:1262-1267, doi 10.1038/nbt.3026; coefficients from its Supplementary Table 9 ("Feature weights from the final model used to score sgRNAs"), page 15 of the Supplementary Text and Figures PDF';
export const COEFFICIENT_SOURCE_URL = 'https://static-content.springer.com/esm/art%3A10.1038%2Fnbt.3026/MediaObjects/41587_2014_BFnbt3026_MOESM4_ESM.pdf';
export const COEFFICIENT_PRECISION_NOTE =
  'The published table is rounded to 8 decimal places. The values used here carry 9, from Bioconductor crisprScore; ' +
  'all 70 keys match the published table and all 70 values round to the published values exactly, so this is a ' +
  'refinement of the published numbers rather than a different model. Cross-checked against CRISPOR doenchScore.py ' +
  'and FlashFry.';

export const RULE_SET_2 = {
  reimplementable_from_published_numbers: false,
  what_was_checked:
    'Doench et al. 2016, Nat Biotechnol 34:184-191, doi 10.1038/nbt.3437 ("Rule Set 2") was pursued first, because ' +
    'it is the better model and the one CRISPOR and CHOPCHOP report. It cannot be reimplemented from published ' +
    'numbers. The shipped Azimuth model is a pickled scikit-learn GradientBoostingRegressor: 100 decision trees of ' +
    'depth 3 over 627 features, learning rate 0.1, squared-error loss. There is no coefficient vector anywhere in ' +
    'it to transcribe. Doench 2016 Supplementary Table 17 is Gini feature importance - a feature RANKING, not ' +
    'weights. Supplementary Table 19 could not be inspected: nature.com is behind an idp.nature.com login wall and ' +
    'the PMC copy exposes only uncaptioned PDFs, so its contents remain UNVERIFIED rather than assumed empty.',
  what_it_would_take: 'extracting the 100 trees from the pickle and reimplementing the ensemble, not transcribing a table',
  what_we_did_instead: 'implemented Doench 2014 Rule Set 1, whose coefficients ARE published, and kept our own labelled heuristic beside it',
  no_rest_api: 'CRISPOR and CHOPCHOP serve no callable REST API, so neither could be asked for a Rule Set 2 score; CHOPCHOP\'s Bitbucket repository (valenlab/chopchop) now returns 404 on every raw branch path and on the Bitbucket API.',
};

const INTERCEPT = 0.597636154;
const GC_WEIGHT_GT10 = -0.166587752;   // GC count in the 20-nt spacer above 10
const GC_WEIGHT_LE10 = -0.202625894;   // GC count in the 20-nt spacer at or below 10

/**
 * The 70 position-specific features, as [position0, motif, weight].
 * `position0` is a 0-BASED offset into the 30-mer; a 2-letter motif occupies position0 and position0+1.
 * (The published table names positions 1-based, so published "G02" is [1,'G'] here.)
 */
export const FEATURES = [
  [1, 'G', -0.275377128], [1, 'GT', -0.625778696], [2, 'A', -0.323887456], [2, 'C', 0.172128871],
  [3, 'C', -0.100666209], [4, 'C', -0.20180294], [4, 'G', 0.245956633], [4, 'GC', 0.300043317],
  [5, 'A', 0.036440041], [5, 'C', 0.098376835], [5, 'AA', -0.834836245], [5, 'TA', 0.760627772],
  [6, 'C', -0.741181291], [6, 'G', -0.393264397], [6, 'GG', -0.490816749], [11, 'A', -0.466099015],
  [11, 'GG', -1.516907439], [11, 'TA', 0.7092612], [11, 'TC', 0.496298609], [11, 'TT', -0.586873894],
  [12, 'GG', -0.334563735], [13, 'GA', 0.76384993], [13, 'GC', -0.53702517], [14, 'A', 0.085376945],
  [14, 'C', -0.013813972], [15, 'A', 0.272620512], [15, 'C', -0.119022648], [15, 'T', -0.285944222],
  [16, 'A', 0.097454592], [16, 'G', -0.17554617], [16, 'TG', -0.798146133], [17, 'C', -0.345795451],
  [17, 'G', -0.678096426], [18, 'A', 0.22508903], [18, 'C', -0.507794051], [18, 'GG', -0.66680873],
  [18, 'TC', 0.353183252], [19, 'G', -0.417373597], [19, 'T', -0.054306959], [19, 'CC', 0.748072092],
  [19, 'TG', -0.367266772], [20, 'G', 0.379899366], [20, 'T', -0.090712644], [20, 'AC', 0.568209132],
  [20, 'CG', 0.329072074], [20, 'GA', -0.836456755], [20, 'GG', -0.782207584], [21, 'C', 0.057823319],
  [21, 'T', -0.530567296], [21, 'TC', -1.029692957], [22, 'T', -0.877007428], [22, 'CG', 0.856197823],
  [22, 'CT', -0.463207679], [23, 'C', -0.876235846], [23, 'G', 0.278916259], [23, 'T', -0.403102218],
  [23, 'AA', -0.579492389], [23, 'AG', 0.649075537], [24, 'A', -0.077300704], [24, 'C', 0.287935617],
  [24, 'T', -0.221637217], [24, 'AG', -0.077300704], [24, 'CG', 0.287935617], [24, 'TG', -0.221637217],
  [26, 'GT', 0.117877577], [27, 'G', -0.689016682], [27, 'T', 0.117877577], [28, 'C', -0.160445304],
  [28, 'GG', -0.697740024], [29, 'G', 0.386342585],
];

export const CONTEXT_SPEC =
  '30-mer: 4 nt of genomic sequence 5\' of the protospacer, the 20-nt protospacer, the 3-nt NGG PAM, then 3 nt ' +
  'of genomic sequence 3\' of the PAM. All on the protospacer strand, 5\'->3\'. The model was fitted on exactly ' +
  'this context, so a guide whose flanks run off the end of the available window gets {ran: false}, not a guess.';

/**
 * Doench 2014 Rule Set 1 score for a 30-mer context.
 * @param {string} seq30 the 30-mer described by CONTEXT_SPEC
 * @returns {{ran: boolean, score?: number, ...}}
 */
export function ruleSet1(seq30) {
  const base = { kind: 'published-model', model: 'Doench 2014 Rule Set 1', citation: CITATION,
    context_spec: CONTEXT_SPEC, NOT: RULE_SET_1_NOT };
  if (typeof seq30 !== 'string' || seq30.length !== 30)
    return { ...base, ran: false, reason: `Rule Set 1 needs a 30-mer context; got ${seq30 == null ? 'nothing' : `${seq30.length} nt`}. ${CONTEXT_SPEC}` };
  const s = seq30.toUpperCase();
  if (/[^ACGT]/.test(s)) return { ...base, ran: false, reason: 'the 30-mer context contains a base that is not A, C, G or T (an N in the assembly, or a window edge)', context_30mer: s };
  const spacer = s.slice(4, 24);
  const pam = s.slice(24, 27);
  if (!/^.GG$/.test(pam))
    return { ...base, ran: false, reason: `the model is SpCas9/NGG only, and positions 25-27 of this 30-mer are "${pam}", not NGG`, context_30mer: s };

  const gc = (spacer.match(/[GC]/g) || []).length;
  const gcWeight = gc <= 10 ? GC_WEIGHT_LE10 : GC_WEIGHT_GT10;
  const gcTerm = Math.abs(10 - gc) * gcWeight;
  let linear = INTERCEPT + gcTerm;
  const hit = [];
  for (const [pos, motif, w] of FEATURES) {
    if (s.slice(pos, pos + motif.length) === motif) { linear += w; hit.push({ position_1based: pos + 1, motif, weight: w }); }
  }
  const score = 1 / (1 + Math.exp(-linear));
  return { ...base, ran: true, score: +score.toFixed(4), logit: +linear.toFixed(6),
    context_30mer: s, spacer, pam,
    terms: { intercept: INTERCEPT, gc_count_in_spacer: gc, gc_weight_used: gcWeight, gc_term: +gcTerm.toFixed(6), n_sequence_features_matched: hit.length },
    features_matched: hit,
    coefficient_source: COEFFICIENT_SOURCE_URL, coefficient_precision: COEFFICIENT_PRECISION_NOTE,
    interpretation: 'a rank, not a rate: higher means the guide looks more like the guides that cut well in the 2014 screen. There is no percentage attached to it.' };
}

export const RULE_SET_1_NOT =
  'NOT Doench 2016 Rule Set 2 (which cannot be reimplemented from published numbers - see RULE_SET_2). NOT measured ' +
  'on our guides. NOT measured in zebrafish: fitted in mouse and human cell lines with a lentiviral, flow-sorted ' +
  'protein-knockout readout, so using it on a one-cell-stage zebrafish injection is a transfer across species, ' +
  'delivery and readout. NOT a knock-in (HDR) efficiency: it scores CUTTING in a gene-inactivation screen. NOT ' +
  'applicable to SaCas9 or Cas12a. NOT evidence about off-targets, specificity or safety. NOT a phenotype prediction.';

/**
 * The two reference vectors printed by CRISPOR's doenchScore.py, used as a self-test. If these do not
 * reproduce, the coefficient table in this file is wrong and every score from it is worthless.
 */
export const REFERENCE_VECTORS = [
  { seq30: 'TATAGCTGCGATCTGAGGTAGGGAGGGACC', expected: 0.713089368437 },
  { seq30: 'TCCGCACCTGTCACGGTCGGGGCTTGGCGC', expected: 0.0189838463593 },
];
/** Run the reference vectors. Returns {ok, results}. Called by test.mjs and by edit_plan_methods. */
export function selfTest({ tolerance = 1e-6 } = {}) {
  const results = REFERENCE_VECTORS.map(v => {
    const r = ruleSet1(v.seq30);
    const got = r.ran ? 1 / (1 + Math.exp(-r.logit)) : null;
    return { seq30: v.seq30, expected: v.expected, got: got == null ? null : +got.toFixed(12), ran: r.ran,
      reason: r.reason, within_tolerance: got != null && Math.abs(got - v.expected) < tolerance };
  });
  return { ok: results.every(r => r.within_tolerance), tolerance, results,
    what_this_checks: 'that this file\'s coefficient table reproduces the two reference vectors published in CRISPOR\'s doenchScore.py, which are themselves the Broad web tool\'s output. It checks the TRANSCRIPTION, not the model: a passing self-test says the numbers were copied correctly, not that Rule Set 1 predicts zebrafish cutting.' };
}

if (process.argv[1] && import.meta.filename === (await import('node:path')).resolve(process.argv[1])) {
  console.log(JSON.stringify(selfTest(), null, 2));
}
