// CRISPRscan: the only on-target model in this project that was fitted ON ZEBRAFISH, reimplemented from
// its published coefficients and VERIFIED against its own published outputs.
//
// ============================== WHY THIS EXISTS ==============================
// editplan ranks guides with two scores: Doench 2014 Rule Set 1 where the geometry allows, and a
// heuristic whose weights we chose. Both are labelled honestly - the Doench module says in its own text
// that it was "fitted on sgRNAs tiling mouse and human genes in cell lines" and that using it here is "a
// TRANSFER ACROSS SPECIES AND ASSAY". Neither had ever been checked against a zebrafish measurement.
//
// Moreno-Mateos et al. 2015 measured the activity of sgRNAs injected into zebrafish embryos and fitted a
// linear model to that data. It is the model that should be used for this organism, and it is also the
// yardstick against which the two incumbent scores can finally be measured.
//
// ============================== WHERE THE COEFFICIENTS CAME FROM ==============================
// Moreno-Mateos et al. 2015, Nat Methods 12:982-988, doi 10.1038/nmeth.3543, "CRISPRscan: designing
// highly efficient sgRNAs for CRISPR-Cas9 targeting in vivo", Supplementary Table 3 ("Parameters of
// CRISPRscan model"), read directly from the xlsx in this run:
//   https://static-content.springer.com/esm/art%3A10.1038%2Fnmeth.3543/MediaObjects/41592_2015_BFnmeth3543_MOESM640_ESM.xlsx
// 92 entries: an intercept, 57 single-nucleotide and 34 dinucleotide position features over a 35-mer,
// used at full published precision.
//
// ============================== THE COORDINATE SYSTEM WAS DERIVED, NOT ASSUMED ==============================
// The feature names ("A04", "T21", "AG34") give a position in 1..35 but not what position 1 IS. Rather
// than read a layout out of the paper and hope, every offset from 0 to 12 was scored against the 25
// sgRNAs whose CRISPRscan score the paper publishes (Source Data to Fig. 3, MOESM634). Exactly one offset
// reproduces them, and it reproduces them EXACTLY:
//
//     offset 6 : Spearman 1.0000, maximum absolute difference 0.0000 across all 25 guides
//     every other offset 0..12 : |r| <= 0.43 and max difference >= 0.32
//
// So the 35-mer is 6 nt upstream + 20 nt protospacer + 3 nt PAM + 6 nt downstream, and that is a
// measurement rather than a reading. selfTest() re-runs the comparison against the committed fixture.
//
// A note on how that test first failed: the genomic windows were built from the scan's start/end
// coordinates, which is right on the plus strand and wrong on the minus strand, because reverse-
// complementing a window flips the flanks with it. 20 of 25 protospacers did not sit where the
// arithmetic said. Anchoring on indexOf(spacer) has no coordinate convention to get wrong, and all 25
// then matched.
//
// ============================== WHAT THIS SCORE IS NOT ==============================
//   * NOT a probability, and not a mutagenesis rate. It is a linear predictor the authors rank by.
//   * NOT applicable outside SpCas9 with an NGG PAM and a 20-nt genomic protospacer.
//   * NOT a phenotype prediction. It predicts how well a guide cuts. Cutting is necessary for a phenotype
//     and nowhere near sufficient - see the bench package's finding that in the fin-size program the
//     knockouts are phenotypically normal.
//   * NOT a statement about off-targets.
//   * NOT independent of the assay it was fitted on: one-cell-stage injection of Cas9 mRNA with T7-
//     transcribed sgRNA. A lab using Cas9 protein RNP is using a different delivery.

export const CITATION = 'Moreno-Mateos et al. 2015, Nat Methods 12:982-988, doi 10.1038/nmeth.3543; coefficients from Supplementary Table 3, "Parameters of CRISPRscan model"';
export const COEFFICIENT_SOURCE_URL = 'https://static-content.springer.com/esm/art%3A10.1038%2Fnmeth.3543/MediaObjects/41592_2015_BFnmeth3543_MOESM640_ESM.xlsx';
export const CONTEXT_SPEC = Object.freeze({
  length: 35,
  layout: '6 nt upstream + 20 nt protospacer + 3 nt PAM (NGG) + 6 nt downstream',
  position_1_is: 'the first of the 6 upstream nucleotides',
  how_this_was_established: 'derived by scoring 25 sgRNAs with published CRISPRscan scores at every offset 0..12; offset 6 reproduced all 25 exactly (max |difference| 0.0000) and no other offset came close.',
});

export const COEFFICIENTS = Object.freeze({
  "Intercept": 0.183930943629, "A04": -0.0421535206047, "A11": -0.0182872920807,
  "A12": 0.0116332345075, "A13": 0.017628924254, "A14": -0.0184872292452,
  "A15": -0.0105952955376, "A18": -0.0338204320002, "A19": -0.0155764988875,
  "A22": 0.0319309087749, "A24": 0.0374664775295, "A25": 0.0105064050328,
  "A27": 0.0191268154262, "A31": 0.00158974977347, "A32": 0.0124352308169,
  "A35": 0.0485962591677, "AA10": -0.0169054146176, "AA19": -0.0973770966031,
  "AG10": 0.0637170933285, "AG23": -0.0543384556991, "AG34": -0.0419359084607,
  "C09": 0.0024492239247, "C13": 0.0694959439929, "C15": -0.000477727288834,
  "C16": -0.0216386089249, "C20": 0.0150895135396, "C21": 0.0342629206803,
  "C22": 0.0376316196793, "C24": 0.0529723136618, "C25": -0.031648352971,
  "C26": -0.000368972859222, "C27": 0.0799339215437, "C30": -0.0131827325942,
  "C31": -0.030715556059, "CA24": 0.0622193697604, "CA30": 0.0577598506643,
  "CC21": 0.0889196009093, "CC23": 0.0950722864525, "CT26": -0.0842648932315,
  "G01": -0.0296937089124, "G04": -0.00544886928417, "G09": 0.114600681211,
  "G10": 0.0677391822097, "G11": 0.0209290394428, "G12": 0.0275911379406,
  "G13": 0.061360904679, "G14": 0.0251167144259, "G15": 0.0511297166878,
  "G16": 0.0379709424474, "G17": 0.0154937801148, "G18": 0.016457815932,
  "G19": 0.0179168436986, "G20": 0.0339570080799, "G22": 0.101144380251,
  "G24": 0.105488324852, "G26": 0.0361466486748, "G27": 0.085151051597,
  "G30": -0.0463159143121, "G32": 0.0307124896871, "G34": -0.0141671225608,
  "GA20": 0.00974079889824, "GA31": -0.01227989, "GA34": -0.0377977074249,
  "GC03": 0.0246817853421, "GC09": 0.0541714023256, "GC25": -0.0734536086796,
  "GG09": -0.00157798989048, "GG10": 0.0268021578544, "GG12": 0.041883008595,
  "GG13": 0.0743558475817, "GG25": 0.111559440706, "GT11": 0.0536784362118,
  "GT18": 0.00239174406352, "GT23": 0.106718562559, "GT24": 0.0609521142769,
  "GT31": 0.0734253503704, "T13": 0.0354451707029, "T21": -0.0687304966631,
  "T22": 0.0132240349237, "T23": -0.00142224326996, "T24": -0.0119961724142,
  "T27": -0.000280844938195, "T30": 0.0172631618141, "T34": -0.0176476916909,
  "TG03": 0.0229499956202, "TG15": 0.0533728222344, "TG18": 0.0459089908401,
  "TG23": -0.0663880753745, "TG31": 0.04813681225, "TT13": -0.0861877104467,
  "TT17": 0.0349288099016, "TT18": -0.0944240749849,
});

/** Score a 35-mer. Returns the linear predictor, or a refusal with the reason. */
export function score(mer35) {
  const m = String(mer35 ?? '').toUpperCase();
  if (m.length !== 35) return { ran: false, why: `CRISPRscan needs a 35-mer; got ${m.length} nt. ${CONTEXT_SPEC.layout}` };
  if (/[^ACGT]/.test(m)) return { ran: false, why: 'the 35-mer contains a base that is not A, C, G or T - an N in the assembly, or a soft-masked region read without upper-casing' };
  const pam = m.slice(26, 29);
  if (!/^.GG$/.test(pam)) return { ran: false, why: `positions 27-29 of the 35-mer must be an NGG PAM; found "${pam}". The window is misaligned.` };
  let x = COEFFICIENTS.Intercept;
  let matched = 0;
  for (const [k, v] of Object.entries(COEFFICIENTS)) {
    if (k === 'Intercept') continue;
    const mm = /^([ACGT]{1,2})(\d+)$/.exec(k);
    if (!mm) continue;
    const base = mm[1], pos = Number(mm[2]) - 1;
    if (pos + base.length > 35) continue;
    if (m.slice(pos, pos + base.length) === base) { x += v; matched++; }
  }
  return { ran: true, score: +x.toFixed(10), features_matched: matched, pam, context: m };
}

/** Build the 35-mer from a genomic window and where the queried sequence starts in it.
 *  The protospacer is defined as the 20 nt immediately 5' of the PAM, whatever length was queried -
 *  which is what lets an 18-mer or a 22-mer oligo be scored on its true genomic context. */
export function contextFrom(window, startOfQuery, queryLength) {
  const pamStart = startOfQuery + queryLength;
  const start = pamStart - 26;
  if (start < 0 || start + 35 > window.length) return null;
  return window.slice(start, start + 35);
}

/** Reproduce the published scores from the committed fixture. */
export function selfTest(fixture) {
  if (!Array.isArray(fixture) || !fixture.length) {
    return { ran: false, why: 'selfTest needs the fixture of published scores and their 35-mers (fixtures/published-scores.json)' };
  }
  let worst = 0, n = 0;
  const bad = [];
  for (const row of fixture) {
    const s = score(row.context);
    if (!s.ran) { bad.push({ id: row.id, why: s.why }); continue; }
    const d = Math.abs(s.score - row.published_score);
    worst = Math.max(worst, d);
    n++;
    if (d > 5e-4) bad.push({ id: row.id, computed: s.score, published: row.published_score, diff: d });
  }
  return {
    ran: true, n,
    max_abs_difference: +worst.toFixed(10),
    reproduces_published_scores: bad.length === 0,
    disagreements: bad,
    what_this_proves: 'that the coefficients were transcribed correctly AND that the 35-mer layout is right. Either error alone would show up here.',
    what_it_does_not_prove: 'that the model is any good. Reproducing the authors\' arithmetic is a different claim from the model predicting activity, which is what the benchmark measures.',
  };
}
