#!/usr/bin/env node
// predict.mjs - THE PREDICTION FUNCTIONS FOR RETROSPECTIVE VALIDATION. NO BIOLOGICAL DATA LIVES HERE.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// A retrospective validation works like this: a paper measured something in a set of species; we take
// the paper's INPUTS (sequences, a tuning table, a reference numbering), make a prediction with code
// that has never seen the paper's OUTPUTS, and only then look at the measured column. The whole value of
// the exercise is that the prediction was made first. That is a claim about the SHAPE of the code, not
// about anyone's good intentions, so this module is built so that the claim can be checked:
//
//   1. IT HOLDS NO BIOLOGICAL DATA. Not one sequence, not one measurement, not one species. Sequences,
//      reference sequences, tuning tables and baselines all arrive as ARGUMENTS. The data modules in this
//      folder are written by other threads and are deliberately NOT imported here - not even lazily, not
//      even optionally - so that no edit to a data file can change a prediction function, and no edit to
//      a prediction function can be excused by "the data moved".
//   2. IT NEVER TOUCHES THE NETWORK. No fetch, no import of anything outside node builtins (in fact it
//      imports nothing at all). A function that could fetch could, in principle, fetch the answer.
//   3. IT IS DETERMINISTIC AND SEEDED. Math.random does not appear. The permutation test carries its own
//      PRNG so that a p value is a function of (data, iters, seed) and of nothing else, and so that a p
//      value quoted in a record can be recomputed by anyone who has those three things.
//
// ============================== THE EPISTEMIC RULES THIS FILE OBEYS ==============================
// A FABRICATED DOI OR MEASUREMENT IS THE WORST THING THIS PROJECT CAN PRODUCE. Every number in SOURCES
// below was read out of a document retrieved during the writing of this file, and SOURCES says for each
// one exactly what was retrieved and by what route. Where a number was needed and could NOT be
// retrieved, the slot holds { value: null, null_reason, what_would_have_to_be_measured } and the code
// either refuses or states its substitute in the open. Two such nulls exist in this file and both are
// load-bearing:
//
//   - THE ARGININE pKa. Neither pKa compilation cited here reports one (Thurlkill et al. 2006 measured
//     Asp, Glu, His, Cys, Tyr, Lys and both termini in alanine pentapeptides; Grimsley et al. 2009
//     tabulated measured values for the same groups in folded proteins). So netCharge treats Arg as
//     fully protonated, +1, and REFUSES outright above pH 10.5 rather than extrapolate a guanidinium
//     titration it has no number for. See PKA_ARG_UNMEASURED.
//   - THE Zmb VALUE ITSELF. See the long note on zmbSurfaceCharge. The convention was retrieved, in
//     words, and it cannot be executed from a sequence. So zmbSurfaceCharge returns no number called
//     Zmb. It returns four named sequence-only variants and makes the caller pick one by name.
//
// And: no fused confidence scalar is anyone's headline here. ciFisher returns an interval, not a point.
// permutationTest returns a p with its definition and its seed attached. predictLambdaMax returns the
// sites it could NOT read alongside the nm it computed, because a prediction built from four of six
// tuned sites is a different object from one built from six, and a bare nm hides which you have.
//
// ============================== DATA PROVENANCE OF THE CITED SOURCES ==============================
// The comparative work cited here (Mirceta et al. 2013; He et al. 2021; McLellan 1984) is MAMMALS ONLY.
// That is this repo's comparative scope (mammals and fishes), and where a cited dataset is broader, only
// the mammalian rows are ever in view for us. Nothing in this file depends on that subset, because
// nothing in this file holds data; it matters only for reading the citations correctly.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). This module names no
// taxon at all - not a species, not a clade, not a gene from one - because it holds no data. That is not
// an accident of writing; it is the point. Run `node holdout/check-leaks.mjs benchmarks/retro-validation`.
//
//   node benchmarks/retro-validation/predict.mjs          # self-check on synthetic input, prints SOURCES
//   node benchmarks/retro-validation/test-predict.mjs     # the tests
//   node benchmarks/retro-validation/test-predict.mjs --fail-once

// =====================================================================================================
// 0. DEEP FREEZE
// =====================================================================================================

function deepFreeze(o) {
  if (o === null || (typeof o !== 'object' && typeof o !== 'function')) return o;
  if (Object.isFrozen(o)) return o;
  Object.freeze(o);
  for (const k of Object.getOwnPropertyNames(o)) {
    const v = o[k];
    if (v && (typeof v === 'object' || typeof v === 'function')) deepFreeze(v);
  }
  return o;
}

// =====================================================================================================
// 1. SOURCES
// =====================================================================================================
// Every numeric constant attributed to a paper below is traceable to one of these entries, and each
// entry says what was actually retrieved. Where only the abstract was retrievable, the entry says so,
// and nothing is attributed to the parts that were not read.

export const SOURCES = deepFreeze({
  thurlkill_2006: {
    citation: 'Thurlkill, R.L., Grimsley, G.R., Scholtz, J.M. & Pace, C.N. (2006) pK values of the ionizable groups of proteins. Protein Science 15:1214-1218.',
    doi: '10.1110/ps.051840806',
    pmid: '16597822',
    pmcid: 'PMC2242523',
    what_it_measured: 'Potentiometric titration of ionizable groups in alanine pentapeptides with blocked termini, 0.1 M KCl, 25 C. Intended as a model for the UNPERTURBED pK of each group.',
    verified_how: 'Retrieved the PubMed record for PMID 16597822 via the PubMed MCP get_article_metadata tool on 2026-11-07. The eight pK values and their stated uncertainties used in PKA_THURLKILL_2006 are quoted from that abstract, which lists them explicitly with +/- errors.',
    what_was_NOT_retrieved: 'The full text. Nothing is attributed to it. Only the eight values that the abstract itself enumerates are used.',
    does_not_report: 'Arg. The abstract enumerates alpha-carboxyl, Asp, Glu, His, alpha-amino, Cys, Tyr and Lys, and no guanidinium value. See PKA_ARG_UNMEASURED.',
  },
  grimsley_2009: {
    citation: 'Grimsley, G.R., Scholtz, J.M. & Pace, C.N. (2009) A summary of the measured pK values of the ionizable groups in folded proteins. Protein Science 18:247-251.',
    doi: '10.1002/pro.19',
    pmid: '19177368',
    pmcid: 'PMC2708032',
    what_it_measured: 'A compilation of 541 pK values measured in 78 FOLDED proteins - i.e. groups in their real structural environments, not model peptides.',
    verified_how: 'Retrieved the Europe PMC core record for PMID 19177368 on 2026-11-07 (REST search, EXT_ID:19177368, resultType=core). The eight averages, their standard deviations and the per-group counts in PKA_GRIMSLEY_2009_FOLDED are quoted from that abstract, which lists all three for each group.',
    why_it_is_here: 'Its standard deviations are the honest uncertainty on any sequence-only net-charge calculation. Asp averages 3.5 +/- 1.2 across 139 measurements in folded proteins. A single-pKa Henderson-Hasselbalch model assigns every Asp the same number; the spread says how wrong that can be for an individual site.',
    does_not_report: 'Arg. The abstract names Asp, Glu, His, Cys, Tyr, Lys and the two termini only.',
  },
  mirceta_2013: {
    citation: 'Mirceta, S., Signore, A.V., Burns, J.M., Cossins, A.R., Campbell, K.L. & Berenbrink, M. (2013) Evolution of mammalian diving capacity traced by myoglobin net surface charge. Science 340:1234192.',
    doi: '10.1126/science.1234192',
    pmid: '23766330',
    verified_how: 'Retrieved the PubMed record for PMID 23766330 (PubMed MCP get_article_metadata) and the Europe PMC record for the same DOI, both on 2026-11-07. The ABSTRACT was retrieved in full and states the finding: "an adaptive molecular signature of elevated myoglobin net surface charge in diving species that is mechanistically linked with maximal myoglobin concentration", over a 130-species mammalian phylogeny.',
    what_was_NOT_retrieved: 'The methods. The full text is subscription-only and the Europe PMC record carries metadata and abstract only. NO number and NO calculation convention is attributed to this paper from this file. The convention used below was read out of He et al. 2021 instead, which restates it and cites this paper for it.',
    scope: 'Mammals.',
  },
  he_2021: {
    citation: 'He, K., Eastman, T.G., Czolacz, H., Li, S., Shinohara, A., Kawada, S.-I., Springer, M.S., Berenbrink, M. & Campbell, K.L. (2021) Myoglobin primary structure reveals multiple convergent transitions to semi-aquatic life in the world\'s smallest mammalian divers. eLife 10:e66797.',
    doi: '10.7554/eLife.66797',
    pmid: '33949308',
    pmcid: 'PMC8205494',
    verified_how: 'Retrieved the full text XML from Europe PMC (REST, /PMC8205494/fullTextXML) on 2026-11-07, stripped tags, and read the Methods section heading "Calculation of myoglobin net surface charge and electrophoretic mobility". The convention quoted in ZMB_CONVENTION is verbatim from that section. PMID/DOI confirmed by PubMed MCP id conversion from PMC8205494.',
    why_it_is_here: 'It is the open-access restatement of the Mirceta et al. 2013 Zmb convention, and it is the reason this file does not pretend it can compute Zmb from a sequence.',
    scope: 'Mammals.',
  },
  mclellan_1984: {
    citation: 'McLellan, T. (1984) Molecular charge and electrophoretic mobility in cetacean myoglobins of known sequence. Biochemical Genetics 22:181-200.',
    doi: '10.1007/BF00499297',
    pmid: '6712587',
    verified_how: 'Retrieved the PubMed record for PMID 6712587 (PubMed MCP get_article_metadata) on 2026-11-07. The abstract confirms it is the titration study whose per-site pK values the Zmb convention relies on: "The relative mobility of the myoglobins in the gels is significantly correlated with the charges of the proteins calculated from the pK values of the ionized groups", at five pH values.',
    what_was_NOT_retrieved: 'The site-specific ionisation constants themselves. They are in the paper\'s tables, which were not retrieved. This is the second half of why Zmb is not computable here.',
    scope: 'Mammals.',
  },
  henikoff_1992: {
    citation: 'Henikoff, S. & Henikoff, J.G. (1992) Amino acid substitution matrices from protein blocks. PNAS 89:10915-10919.',
    doi: '10.1073/pnas.89.22.10915',
    pmid: '1438297',
    pmcid: 'PMC50453',
    verified_how: 'Retrieved the PubMed record for PMID 1438297 on 2026-11-07. The BLOSUM62 integers in BLOSUM62 below were NOT typed from memory: they were downloaded from https://ftp.ncbi.nlm.nih.gov/blast/matrices/BLOSUM62 on 2026-11-07 and transcribed programmatically. The file header reads "Matrix made by matblas from blosum62.iij / BLOSUM Clustered Scoring Matrix in 1/2 Bit Units / Cluster Percentage: >= 62". test-predict.mjs re-checks symmetry, the strict-diagonal-maximum property over the 20 standard residues, and five spot values.',
  },
  needleman_wunsch_1970: {
    citation: 'Needleman, S.B. & Wunsch, C.D. (1970) A general method applicable to the search for similarities in the amino acid sequence of two proteins. Journal of Molecular Biology 48:443-453.',
    doi: '10.1016/0022-2836(70)90057-4',
    pmid: '5420325',
    verified_how: 'Retrieved the PubMed record for PMID 5420325 on 2026-11-07; title, journal, volume and pages confirmed. PubMed carries no abstract for it ("[Abstract not available]"), so nothing is quoted from one.',
    note: 'The affine-gap formulation implemented here is Gotoh\'s, not the 1970 paper\'s linear-gap version. Gotoh (1982) J Mol Biol 162:705-708 is the correct attribution for the three-matrix recursion; that record was NOT retrieved during the writing of this file, so it is named here as an attribution of the ALGORITHM and no number is taken from it.',
  },
  statistics: {
    note: 'The statistical transforms here are textbook and carry no retrieved measurement: Pearson product-moment correlation; Spearman rank correlation with mid-ranks for ties; Fisher\'s variance-stabilising z = artanh(r) with standard error 1/sqrt(n-3) for the 95% interval; a two-sided permutation test on the absolute statistic. No paper is cited for them because no value is attributed to a paper. The 1/sqrt(n-3) form (rather than 1/sqrt(n-1) or 1/sqrt(n-2)) and the (1+k)/(1+iters) p-value estimator are both CHOICES, and both are named in the returned objects so a reader can see which was used.',
    mulberry32: 'The PRNG is mulberry32, a public-domain 32-bit state generator in wide use. It is here because it is three lines, is not Math.random, and gives the same stream on every platform. It is not a cryptographic generator and nothing here needs one.',
  },
});

// =====================================================================================================
// 2. pKa SETS
// =====================================================================================================
// Two sets, both retrieved, deliberately different in kind:
//
//   PKA_THURLKILL_2006        - unperturbed model-compound pKs. The right choice if you want a
//                               well-defined, reproducible sequence-only number.
//   PKA_GRIMSLEY_2009_FOLDED  - averages of pKs MEASURED IN FOLDED PROTEINS, with their spreads. The
//                               right choice if you want the central tendency of real sites, and the
//                               spreads are the reason not to believe the second decimal of either.
//
// The caller chooses. netCharge defaults to Thurlkill because it is a model-compound set and so is a
// definition rather than an average over a non-random sample of proteins, and because its own errors are
// hundredths of a pH unit where Grimsley's are whole units.

export const PKA_ARG_UNMEASURED = deepFreeze({
  group: 'Arg (guanidinium)',
  value: null,
  null_reason: 'Neither cited compilation reports it. Thurlkill et al. 2006 enumerate alpha-carboxyl, Asp, Glu, His, alpha-amino, Cys, Tyr and Lys; Grimsley et al. 2009 tabulate Asp, Glu, His, Cys, Tyr, Lys and the two termini. Arg appears in neither. A number was needed and could not be retrieved, so none is written.',
  what_would_have_to_be_measured: 'A potentiometric or NMR titration of the arginine guanidinium group in a blocked model peptide under the same conditions as the rest of the set (0.1 M KCl, 25 C), or a compilation of measured guanidinium pKs in folded proteins comparable to Grimsley et al. 2009. Guanidinium titrates near the top of the accessible pH range, which is exactly why it is missing: it is hard to measure before the protein unfolds.',
  what_this_module_does_instead: 'Treats every Arg as fully protonated, charge exactly +1, and REFUSES to compute at pH >= 10.5. The refusal is the point: between pH 2 and 10.5 the +1 assumption costs nothing a sequence-only model could resolve, and above it the assumption is doing work that no retrieved number supports.',
  valid_below_pH: 10.5,
});

export const PKA_THURLKILL_2006 = deepFreeze({
  id: 'thurlkill-2006',
  source: 'thurlkill_2006',
  measured_in: 'alanine pentapeptides with blocked termini, 0.1 M KCl, 25 C',
  kind: 'model-compound (unperturbed) pK values',
  // Quoted from the abstract of PMID 16597822, which lists each with its error.
  cationic: Object.freeze({ K: 10.40, H: 6.54, N_TERMINUS: 8.00 }),
  anionic: Object.freeze({ D: 3.67, E: 4.25, C: 8.55, Y: 9.84, C_TERMINUS: 3.67 }),
  stated_error: Object.freeze({ C_TERMINUS: 0.03, D: 0.04, E: 0.05, H: 0.04, N_TERMINUS: 0.03, C: 0.03, Y: 0.11, K: 0.08 }),
  arg: PKA_ARG_UNMEASURED,
  note: 'Thurlkill et al. report alpha-carboxyl 3.67 and Asp 3.67 as the same value; that coincidence is theirs, not a transcription error here. They also note their set differs from the Nozaki & Tanford values often used in the literature for Asp, His, alpha-amino, Cys and Tyr. Nozaki & Tanford was NOT retrieved for this file and none of its numbers appear.',
});

export const PKA_GRIMSLEY_2009_FOLDED = deepFreeze({
  id: 'grimsley-2009-folded',
  source: 'grimsley_2009',
  measured_in: '541 pK values measured in 78 folded proteins, compiled',
  kind: 'averages of pK values measured in folded proteins',
  cationic: Object.freeze({ K: 10.5, H: 6.6, N_TERMINUS: 7.7 }),
  anionic: Object.freeze({ D: 3.5, E: 4.2, C: 6.8, Y: 10.3, C_TERMINUS: 3.3 }),
  stated_sd: Object.freeze({ D: 1.2, E: 0.9, H: 1.0, C: 2.7, Y: 1.2, K: 1.1, C_TERMINUS: 0.8, N_TERMINUS: 0.5 }),
  n_measurements: Object.freeze({ D: 139, E: 153, H: 131, C: 25, Y: 20, K: 35, C_TERMINUS: 22, N_TERMINUS: 16 }),
  arg: PKA_ARG_UNMEASURED,
  the_spread_is_the_message:
    'Asp 3.5 +/- 1.2 over 139 measurements; Cys 6.8 +/- 2.7 over 25. A single-pKa model gives every Asp in a protein the same number. These standard deviations say that an individual carboxyl can sit more than a pH unit either side of that, which is why a sequence-only net charge is a coarse quantity and why the second decimal of anything this function returns is decoration.',
});

export const PKA_SETS = deepFreeze({
  'thurlkill-2006': PKA_THURLKILL_2006,
  'grimsley-2009-folded': PKA_GRIMSLEY_2009_FOLDED,
});

// pH window within which this module will compute at all. The lower bound is where the carboxyl
// titrations are still described by a single pK; the upper bound is PKA_ARG_UNMEASURED.valid_below_pH.
export const PH_RANGE = deepFreeze({
  min: 2.0,
  max: 10.5,
  why_min: 'Below about pH 2 the alpha-carboxyl and side-chain carboxyls are essentially fully protonated and the model has nothing left to say, and real proteins are acid-denatured, so the "net charge of the sequence" is no longer a statement about the folded molecule.',
  why_max: 'PKA_ARG_UNMEASURED: no retrieved guanidinium pK, so Arg is pinned at +1, which becomes a lie somewhere above here.',
});

const CATIONIC_RESIDUES = Object.freeze(['K', 'R', 'H']);
const ANIONIC_RESIDUES = Object.freeze(['D', 'E', 'C', 'Y']);

// Residues this module refuses to guess at. B = Asx (Asp or Asn), Z = Glx (Glu or Gln): in both cases
// the two possibilities differ by one unit of charge, so an ambiguity code is a one-charge uncertainty
// and not a residue. X is anything. U/O are selenocysteine/pyrrolysine, for which no pK was retrieved.
export const AMBIGUOUS_OR_UNSUPPORTED = deepFreeze({
  B: 'Asx: Asp or Asn. They differ by one unit of charge, so this is a +/-1 ambiguity, not a residue.',
  Z: 'Glx: Glu or Gln. Same one-unit ambiguity.',
  J: 'Xle: Leu or Ile. Neither is ionisable, but the code is still not a residue and is refused for consistency.',
  X: 'Any residue. Could carry any charge from -1 to +1.',
  U: 'Selenocysteine. Its selenol pK is lower than cysteine\'s thiol, and no value for it was retrieved for this file.',
  O: 'Pyrrolysine. No pK retrieved.',
});

// =====================================================================================================
// 3. SEQUENCE HYGIENE
// =====================================================================================================

export const STANDARD_AA = 'ACDEFGHIKLMNPQRSTVWY';

/**
 * Uppercase, strip whitespace and gap characters, and validate.
 * @param {string} seq
 * @param {{ name?: string, allowAmbiguous?: boolean, allowEmpty?: boolean }} [opts]
 * @returns {string}
 */
export function cleanSeq(seq, { name = 'sequence', allowAmbiguous = false, allowEmpty = false } = {}) {
  if (typeof seq !== 'string') throw new TypeError(`${name}: expected a string, got ${typeof seq}`);
  const s = seq.replace(/[\s\-.*]/g, '').toUpperCase();
  if (!allowEmpty && s.length === 0) throw new RangeError(`${name}: empty after stripping whitespace and gaps. An empty sequence has no net charge and no alignment; refusing rather than returning 0.`);
  const bad = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (STANDARD_AA.includes(c)) continue;
    if (allowAmbiguous && c in AMBIGUOUS_OR_UNSUPPORTED) continue;
    bad.push(`${c}@${i + 1}`);
  }
  if (bad.length) {
    const first = s[ [...s].findIndex(c => !STANDARD_AA.includes(c) && !(allowAmbiguous && c in AMBIGUOUS_OR_UNSUPPORTED)) ];
    const why = AMBIGUOUS_OR_UNSUPPORTED[first] ?? 'not one of the 20 standard amino acids.';
    throw new RangeError(`${name}: ${bad.length} character(s) this module will not guess at (${bad.slice(0, 8).join(', ')}${bad.length > 8 ? ', ...' : ''}). ${first}: ${why}`);
  }
  return s;
}

// =====================================================================================================
// 4. NET CHARGE - HENDERSON-HASSELBALCH OVER THE IONISABLE GROUPS
// =====================================================================================================
//
// For a cationic group (Lys, His, the N-terminal alpha-amino), the protonated form carries the charge,
// and the fraction protonated is
//
//     f+ = 1 / (1 + 10^(pH - pKa))              contribution  +f+
//
// For an anionic group (Asp, Glu, Cys, Tyr, the C-terminal alpha-carboxyl), the DEprotonated form
// carries the charge, and the fraction deprotonated is
//
//     f- = 1 / (1 + 10^(pKa - pH))              contribution  -f-
//
// Arg contributes exactly +1 (see PKA_ARG_UNMEASURED) and the function refuses above pH 10.5.
//
// What this model is NOT: it assigns every instance of a residue the same pK, so it knows nothing about
// the desolvation, hydrogen bonding and charge-charge interactions that move real site pKs by more than
// a pH unit (PKA_GRIMSLEY_2009_FOLDED.the_spread_is_the_message). It is a sequence-composition statistic
// with a pH-dependent weighting, and it is useful because it is reproducible, not because it is right
// about any individual group.

/**
 * Fraction of a cationic group that is protonated (and therefore charged) at a given pH.
 * @param {number} pH @param {number} pKa @returns {number} in (0, 1)
 */
export function fracProtonated(pH, pKa) { return 1 / (1 + Math.pow(10, pH - pKa)); }

/**
 * Fraction of an anionic group that is deprotonated (and therefore charged) at a given pH.
 * @param {number} pH @param {number} pKa @returns {number} in (0, 1)
 */
export function fracDeprotonated(pH, pKa) { return 1 / (1 + Math.pow(10, pKa - pH)); }

function resolvePkaSet(pKaSet) {
  if (typeof pKaSet === 'string') {
    const s = PKA_SETS[pKaSet];
    if (!s) throw new RangeError(`unknown pKa set "${pKaSet}". Known: ${Object.keys(PKA_SETS).join(', ')}`);
    return s;
  }
  if (pKaSet && typeof pKaSet === 'object' && pKaSet.cationic && pKaSet.anionic) return pKaSet;
  throw new TypeError('pKaSet must be a key of PKA_SETS or an object with cationic and anionic pKa tables');
}

/**
 * Full, inspectable breakdown of the net charge calculation.
 *
 * @param {string} seq
 * @param {{ pH?: number, pKaSet?: string|object, includeTermini?: boolean }} [opts]
 * @returns {object} frozen
 */
export function chargeBreakdown(seq, { pH = 7.4, pKaSet = PKA_THURLKILL_2006, includeTermini = true } = {}) {
  if (typeof pH !== 'number' || !Number.isFinite(pH)) throw new TypeError(`pH must be a finite number, got ${pH}`);
  if (pH < PH_RANGE.min || pH >= PH_RANGE.max) {
    throw new RangeError(
      `pH ${pH} is outside [${PH_RANGE.min}, ${PH_RANGE.max}), the range in which this module will compute. ` +
      `Upper bound: ${PKA_ARG_UNMEASURED.null_reason} Lower bound: ${PH_RANGE.why_min}`);
  }
  const set = resolvePkaSet(pKaSet);
  const s = cleanSeq(seq, { name: 'seq' });

  const counts = Object.create(null);
  for (const c of s) counts[c] = (counts[c] ?? 0) + 1;

  const groups = [];
  let positive = 0, negative = 0;

  for (const r of CATIONIC_RESIDUES) {
    const n = counts[r] ?? 0;
    if (n === 0) continue;
    if (r === 'R') {
      groups.push({ group: 'Arg', n, pKa: null, pKa_is_null_because: 'PKA_ARG_UNMEASURED', charge_each: 1, total: n, sign: '+' });
      positive += n;
      continue;
    }
    const pKa = set.cationic[r];
    if (typeof pKa !== 'number') throw new RangeError(`pKa set "${set.id}" has no value for cationic residue ${r}`);
    const f = fracProtonated(pH, pKa);
    groups.push({ group: r === 'K' ? 'Lys' : 'His', n, pKa, charge_each: f, total: n * f, sign: '+' });
    positive += n * f;
  }
  for (const r of ANIONIC_RESIDUES) {
    const n = counts[r] ?? 0;
    if (n === 0) continue;
    const pKa = set.anionic[r];
    if (typeof pKa !== 'number') throw new RangeError(`pKa set "${set.id}" has no value for anionic residue ${r}`);
    const f = fracDeprotonated(pH, pKa);
    const nm = { D: 'Asp', E: 'Glu', C: 'Cys', Y: 'Tyr' }[r];
    groups.push({ group: nm, n, pKa, charge_each: -f, total: -n * f, sign: '-' });
    negative += n * f;
  }
  if (includeTermini) {
    const fN = fracProtonated(pH, set.cationic.N_TERMINUS);
    const fC = fracDeprotonated(pH, set.anionic.C_TERMINUS);
    groups.push({ group: 'N-terminal alpha-amino', n: 1, pKa: set.cationic.N_TERMINUS, charge_each: fN, total: fN, sign: '+' });
    groups.push({ group: 'C-terminal alpha-carboxyl', n: 1, pKa: set.anionic.C_TERMINUS, charge_each: -fC, total: -fC, sign: '-' });
    positive += fN;
    negative += fC;
  }

  return deepFreeze({
    net_charge: positive - negative,
    positive,
    negative,
    pH,
    pKa_set: set.id,
    termini_included: includeTermini,
    length: s.length,
    groups,
    arg_treatment: (counts.R ?? 0) > 0 ? PKA_ARG_UNMEASURED : null,
    what_this_is_not:
      'Not Zmb. Not a surface charge. Not a per-site statement. Every instance of a residue was given the ' +
      'same pK, which is wrong for every individual site by an amount PKA_GRIMSLEY_2009_FOLDED quantifies.',
  });
}

/**
 * Net charge of a protein sequence at a given pH, by Henderson-Hasselbalch over the ionisable groups
 * plus both terminal groups. pKa set defaults to Thurlkill et al. 2006 (see SOURCES).
 *
 * Throws, rather than extrapolating, for pH outside [2.0, 10.5) and for any character that is not one of
 * the 20 standard amino acids.
 *
 * @param {string} seq
 * @param {{ pH?: number, pKaSet?: string|object, includeTermini?: boolean }} [opts]
 * @returns {number}
 */
export function netCharge(seq, opts = {}) {
  return chargeBreakdown(seq, opts).net_charge;
}

// =====================================================================================================
// 5. Zmb - AND WHY THERE IS NO NUMBER CALLED THAT IN THIS FILE
// =====================================================================================================
//
// The convention was retrieved, verbatim, from the Methods of He et al. 2021 (open access, full text via
// Europe PMC; see SOURCES.he_2021), where it is restated and attributed to McLellan 1984 and Mirceta et
// al. 2013:
//
//     "We calculated Z_Mb as the sum of the charge of all ionizable groups in myoglobin at pH = 6.5 by
//      modelling Mb primary structures onto the tertiary structure and using published, conserved,
//      site-specific ionisation constants (McLellan, 1984; Mirceta et al., 2013)."
//
// Three things in that sentence make Zmb uncomputable from a sequence, and all three are worth stating
// separately because each one is a different kind of obstacle:
//
//   1. "MODELLING PRIMARY STRUCTURES ONTO THE TERTIARY STRUCTURE." The calculation is structure-mediated.
//      A sequence-only function cannot do this step at all. Note what this also settles: despite the name
//      "net surface charge", the quantity is the sum over ALL ionizable groups, not over a solvent-
//      exposed subset. The structure is there to place each group in its environment, not to select a
//      surface. So "do they exclude buried residues?" has an answer, and the answer is no - but a
//      sequence-only function still cannot reproduce the quantity, for reason 2.
//   2. "PUBLISHED, CONSERVED, SITE-SPECIFIC IONISATION CONSTANTS." Not one pK per residue type; one pK
//      per POSITION in the molecule. Those constants are in McLellan 1984's tables, which were not
//      retrieved for this file. Substituting a model-compound set for them would not be an approximation
//      of Zmb, it would be a different quantity wearing its name.
//   3. "AT pH = 6.5." Not 7.4. A net charge at pH 7.4 is not a Zmb evaluated at a different pH; His has
//      pK 6.54 in the Thurlkill set, so the histidines - which is where much of the comparative signal
//      in this literature sits - are near half-titrated at the paper's pH and mostly neutral at 7.4. A
//      histidine-rich and a histidine-poor sequence are ranked differently by the two pHs.
//
// So this function returns NO value named Zmb. It returns four named sequence-only variants, computed by
// the function above with an explicitly stated pKa set, and it makes the caller name the one they want.
// If a downstream record wants to say "Zmb", it has to get the number from somewhere that can compute it.
//
// The four variants, and why each exists:
//   seq_net_charge_pH74       - the generic sequence net charge at physiological pH. Comparable to other
//                               proteins; not comparable to the Zmb literature.
//   seq_net_charge_pH65       - the same calculation at the pH the papers use. The closest sequence-only
//                               analogue of Zmb, and still not Zmb.
//   his_counted_full_pH65     - histidines forced to +1. The upper bound on the histidine contribution.
//   his_excluded_pH65         - histidines forced to 0. The lower bound.
// The last two are not models of anything; they bracket the one term whose treatment moves the answer
// most, so a caller can see how much of a between-sequence difference is histidine bookkeeping.

export const ZMB_CONVENTION = deepFreeze({
  quote: 'We calculated Z_Mb as the sum of the charge of all ionizable groups in myoglobin at pH = 6.5 by modelling Mb primary structures onto the tertiary structure and using published, conserved, site-specific ionisation constants (McLellan, 1984; Mirceta et al., 2013).',
  quoted_from: 'he_2021',
  quote_location: 'Methods, section headed "Calculation of myoglobin net surface charge and electrophoretic mobility".',
  verified_how: SOURCES.he_2021.verified_how,
  pH: 6.5,
  scope_of_the_sum: 'all ionizable groups - NOT a solvent-exposed subset, despite the name "net surface charge"',
  requires_structure: true,
  requires_site_specific_pKs: true,
  site_specific_pKs_source: 'mclellan_1984',
  what_could_NOT_be_reproduced: [
    'The structure-mediated step. "Modelling primary structures onto the tertiary structure" cannot be done from a sequence, and this module takes sequences.',
    'The site-specific ionisation constants. They are in McLellan 1984\'s tables, which were not retrieved for this file (only its abstract was). Without them, a per-residue-type pKa set is a substitute, not an approximation.',
    'There is no reported Zmb value for any species anywhere in this file, because none was retrieved from a methods section or a data table.',
  ],
  what_the_abstract_of_mirceta_2013_does_support:
    'That elevated myoglobin net surface charge is the reported adaptive signature in diving mammals and is mechanistically linked with maximal myoglobin concentration, over a 130-species mammalian phylogeny. That is a statement of the finding, retrieved in full. It is not a method.',
  therefore: 'zmbSurfaceCharge returns no key holding a number called Zmb. It returns named sequence-only variants and requires the caller to choose one by name.',
});

/**
 * Sequence-only charge variants in the neighbourhood of the Mirceta-style net-surface-charge convention.
 * Deliberately returns NO value named Zmb. See ZMB_CONVENTION.
 *
 * @param {string} seq
 * @param {{ pKaSet?: string|object, includeTermini?: boolean }} [opts]
 * @returns {object} frozen
 */
export function zmbSurfaceCharge(seq, { pKaSet = PKA_THURLKILL_2006, includeTermini = true } = {}) {
  const set = resolvePkaSet(pKaSet);
  const s = cleanSeq(seq, { name: 'seq' });

  const hisCount = [...s].filter(c => c === 'H').length;
  const at = (pH) => chargeBreakdown(s, { pH, pKaSet: set, includeTermini });
  const b74 = at(7.4);
  const b65 = at(6.5);
  // His forced: remove the Henderson-Hasselbalch histidine term and add back 0 or +1 per histidine.
  const hisTerm65 = hisCount * fracProtonated(6.5, set.cationic.H);

  return deepFreeze({
    zmb: {
      value: null,
      null_reason: 'Zmb as defined in the literature requires modelling the primary structure onto the tertiary structure and using published site-specific ionisation constants at pH 6.5. This module takes sequences and has neither. A sequence-only number would be a different quantity wearing the name.',
      what_would_have_to_be_measured:
        'Either (a) a structure for each sequence plus the site-specific ionisation constants from McLellan 1984 Tables, then the sum over all ionizable groups at pH 6.5 as ZMB_CONVENTION.quote describes; or (b) the direct experimental proxy the same literature uses to validate it - native-PAGE electrophoretic mobility of the myoglobin band at pH 6.5, relative to a standard run on the same gel.',
      convention: ZMB_CONVENTION,
    },
    caller_must_choose: true,
    recommended_variant: null,
    recommended_variant_is_null_because:
      'Picking one and calling it the answer is the error this function exists to prevent. Which variant is right depends on what it is being compared against, and only the caller knows that. If the comparison is to published Zmb values, the honest answer is that none of these is comparable; use the rank order and say so.',
    variants: {
      seq_net_charge_pH74: b74.net_charge,
      seq_net_charge_pH65: b65.net_charge,
      his_counted_full_pH65: b65.net_charge - hisTerm65 + hisCount,
      his_excluded_pH65: b65.net_charge - hisTerm65,
    },
    variant_notes: {
      seq_net_charge_pH74: 'Generic sequence net charge at physiological pH. Not comparable to the Zmb literature, which works at 6.5.',
      seq_net_charge_pH65: 'Same calculation at the pH the Zmb literature uses. Closest sequence-only analogue; still not Zmb, because of the site-specific pKs and the structure step.',
      his_counted_full_pH65: 'Upper bound on the histidine contribution: every His forced to +1.',
      his_excluded_pH65: 'Lower bound on the histidine contribution: every His forced to 0, i.e. the same calculation with the histidines taken out of it entirely.',
    },
    histidine_bracket_width: hisCount,
    histidine_bracket_note:
      'The two bounded variants differ by exactly the histidine count, in charge units. That width is how much of any between-sequence comparison is histidine bookkeeping rather than sequence difference, and at pH 6.5 - within 0.1 of the His pK in the Thurlkill set - it is the single largest modelling choice in the calculation.',
    n_histidine: hisCount,
    pKa_set: set.id,
    pH_of_the_convention: ZMB_CONVENTION.pH,
    length: s.length,
  });
}

// =====================================================================================================
// 6. BLOSUM62 AND GLOBAL PAIRWISE ALIGNMENT (NEEDLEMAN-WUNSCH / GOTOH, AFFINE GAPS)
// =====================================================================================================
// The integers below were downloaded from ftp.ncbi.nlm.nih.gov/blast/matrices/BLOSUM62 and transcribed
// programmatically, not typed from memory. Column order is the NCBI file's own, including the ambiguity
// codes B, Z, X and the stop character, so that the transcription can be diffed against the source file.
// test-predict.mjs re-derives symmetry, the strict diagonal maximum over the 20 standard residues, and
// five spot values, so a transcription slip fails a test rather than quietly shifting every alignment.

const BLOSUM62_ORDER = 'ARNDCQEGHILKMFPSTWYVBZX*';
const BLOSUM62_ROWS = Object.freeze({
  A: '4 -1 -2 -2 0 -1 -1 0 -2 -1 -1 -1 -1 -2 -1 1 0 -3 -2 0 -2 -1 0 -4',
  R: '-1 5 0 -2 -3 1 0 -2 0 -3 -2 2 -1 -3 -2 -1 -1 -3 -2 -3 -1 0 -1 -4',
  N: '-2 0 6 1 -3 0 0 0 1 -3 -3 0 -2 -3 -2 1 0 -4 -2 -3 3 0 -1 -4',
  D: '-2 -2 1 6 -3 0 2 -1 -1 -3 -4 -1 -3 -3 -1 0 -1 -4 -3 -3 4 1 -1 -4',
  C: '0 -3 -3 -3 9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1 -3 -3 -2 -4',
  Q: '-1 1 0 0 -3 5 2 -2 0 -3 -2 1 0 -3 -1 0 -1 -2 -1 -2 0 3 -1 -4',
  E: '-1 0 0 2 -4 2 5 -2 0 -3 -3 1 -2 -3 -1 0 -1 -3 -2 -2 1 4 -1 -4',
  G: '0 -2 0 -1 -3 -2 -2 6 -2 -4 -4 -2 -3 -3 -2 0 -2 -2 -3 -3 -1 -2 -1 -4',
  H: '-2 0 1 -1 -3 0 0 -2 8 -3 -3 -1 -2 -1 -2 -1 -2 -2 2 -3 0 0 -1 -4',
  I: '-1 -3 -3 -3 -1 -3 -3 -4 -3 4 2 -3 1 0 -3 -2 -1 -3 -1 3 -3 -3 -1 -4',
  L: '-1 -2 -3 -4 -1 -2 -3 -4 -3 2 4 -2 2 0 -3 -2 -1 -2 -1 1 -4 -3 -1 -4',
  K: '-1 2 0 -1 -3 1 1 -2 -1 -3 -2 5 -1 -3 -1 0 -1 -3 -2 -2 0 1 -1 -4',
  M: '-1 -1 -2 -3 -1 0 -2 -3 -2 1 2 -1 5 0 -2 -1 -1 -1 -1 1 -3 -1 -1 -4',
  F: '-2 -3 -3 -3 -2 -3 -3 -3 -1 0 0 -3 0 6 -4 -2 -2 1 3 -1 -3 -3 -1 -4',
  P: '-1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4 7 -1 -1 -4 -3 -2 -2 -1 -2 -4',
  S: '1 -1 1 0 -1 0 0 0 -1 -2 -2 0 -1 -2 -1 4 1 -3 -2 -2 0 0 0 -4',
  T: '0 -1 0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1 1 5 -2 -2 0 -1 -1 0 -4',
  W: '-3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1 1 -4 -3 -2 11 2 -3 -4 -3 -2 -4',
  Y: '-2 -2 -2 -3 -2 -1 -2 -3 2 -1 -1 -2 -1 3 -3 -2 -2 2 7 -1 -3 -2 -1 -4',
  V: '0 -3 -3 -3 -1 -2 -2 -3 -3 3 1 -2 1 -1 -2 -2 0 -3 -1 4 -3 -2 -1 -4',
  B: '-2 -1 3 4 -3 0 1 -1 0 -3 -4 0 -3 -3 -2 0 -1 -4 -3 -3 4 1 -1 -4',
  Z: '-1 0 0 1 -3 3 4 -2 0 -3 -3 1 -1 -3 -1 0 -1 -3 -2 -2 1 4 -1 -4',
  X: '0 -1 -1 -1 -2 -1 -1 -1 -1 -1 -1 -1 -1 -1 -2 0 0 -2 -1 -1 -1 -1 -1 -4',
  '*': '-4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 1',
});

function buildMatrix(order, rows) {
  const m = Object.create(null);
  const letters = [...order];
  for (const a of letters) {
    const vals = rows[a].trim().split(/\s+/).map(Number);
    if (vals.length !== letters.length) throw new Error(`BLOSUM62 row ${a} has ${vals.length} values, expected ${letters.length}`);
    m[a] = Object.create(null);
    letters.forEach((b, j) => { m[a][b] = vals[j]; });
  }
  return m;
}

/** BLOSUM62, as the NCBI matrix file gives it. Keys are single-letter codes; m[a][b] is the score. */
export const BLOSUM62 = deepFreeze(buildMatrix(BLOSUM62_ORDER, BLOSUM62_ROWS));
export const BLOSUM62_ALPHABET = BLOSUM62_ORDER;

/**
 * Gap cost convention, stated rather than implied: a gap of length k costs
 *     gapOpen + k * gapExtend
 * so with the defaults below a single-residue gap costs 12 and each further residue costs 1 more. These
 * are BLAST's default values for BLOSUM62. They are SOFTWARE DEFAULTS, not measurements, and both are
 * parameters of alignToReference so a caller can change them and see what moves.
 */
export const GAP_DEFAULTS = deepFreeze({
  gapOpen: 11,
  gapExtend: 1,
  cost_of_gap_of_length_k: 'gapOpen + k * gapExtend',
  cost_of_a_single_residue_gap: 12,
  these_are_not_measurements: 'These are software defaults, not measurements. They are BLAST\'s defaults for BLOSUM62, reproduced so that an alignment made here matches one made with default settings elsewhere. Nothing in SOURCES measures them.',
});

const NEG_INF = -1e18;

/**
 * Global pairwise alignment of a query sequence to a reference, Needleman-Wunsch with affine gaps
 * (Gotoh's three-matrix recursion). Returns, among other things, a mapping from REFERENCE positions to
 * QUERY positions, so that a site number quoted in reference numbering can be read off any homologue.
 *
 * Deterministic: ties in the traceback are broken in a fixed order (match state, then gap-in-query, then
 * gap-in-reference; and within a gap state, opening is preferred to extending). Two runs on the same
 * input give the same alignment, always.
 *
 * @param {string} seq      query sequence
 * @param {string} refSeq   reference sequence (the numbering everything is quoted in)
 * @param {{ matrix?: object, gapOpen?: number, gapExtend?: number, matrixName?: string }} [opts]
 * @returns {object} frozen; refToQuery is 1-based (index 0 unused, value null where the reference
 *                  position aligns to a gap). queryToRef likewise.
 */
export function alignToReference(seq, refSeq, { matrix = BLOSUM62, gapOpen = GAP_DEFAULTS.gapOpen, gapExtend = GAP_DEFAULTS.gapExtend, matrixName = 'BLOSUM62' } = {}) {
  const q = cleanSeq(seq, { name: 'seq' });
  const r = cleanSeq(refSeq, { name: 'refSeq' });
  if (!(gapOpen >= 0) || !(gapExtend > 0)) throw new RangeError(`gapOpen must be >= 0 and gapExtend > 0 (got ${gapOpen}, ${gapExtend}). Costs are subtracted, so they are given as positive numbers.`);
  for (const [nm, s] of [['refSeq', r], ['seq', q]]) {
    for (const c of s) if (!(matrix[c] && Object.prototype.hasOwnProperty.call(matrix[c], c))) throw new RangeError(`${nm}: residue ${c} is not in the scoring matrix`);
  }

  const n = r.length, m = q.length;
  const W = m + 1;
  const sz = (n + 1) * W;
  const M = new Float64Array(sz), X = new Float64Array(sz), Y = new Float64Array(sz);
  // pointers: 0 = from M, 1 = from X, 2 = from Y, 3 = origin
  const pM = new Uint8Array(sz), pX = new Uint8Array(sz), pY = new Uint8Array(sz);
  const at = (i, j) => i * W + j;

  M[0] = 0; X[0] = NEG_INF; Y[0] = NEG_INF; pM[0] = 3;
  for (let i = 1; i <= n; i++) {
    M[at(i, 0)] = NEG_INF;
    Y[at(i, 0)] = NEG_INF;
    X[at(i, 0)] = -(gapOpen + i * gapExtend);
    pX[at(i, 0)] = i === 1 ? 0 : 1;
  }
  for (let j = 1; j <= m; j++) {
    M[at(0, j)] = NEG_INF;
    X[at(0, j)] = NEG_INF;
    Y[at(0, j)] = -(gapOpen + j * gapExtend);
    pY[at(0, j)] = j === 1 ? 0 : 2;
  }

  for (let i = 1; i <= n; i++) {
    const ri = r[i - 1];
    const row = matrix[ri];
    for (let j = 1; j <= m; j++) {
      const k = at(i, j);
      // X: gap in the QUERY (the reference residue is consumed; vertical move).
      const xOpen = M[at(i - 1, j)] - gapOpen - gapExtend;
      const xExt = X[at(i - 1, j)] - gapExtend;
      if (xOpen >= xExt) { X[k] = xOpen; pX[k] = 0; } else { X[k] = xExt; pX[k] = 1; }
      // Y: gap in the REFERENCE (the query residue is consumed; horizontal move).
      const yOpen = M[at(i, j - 1)] - gapOpen - gapExtend;
      const yExt = Y[at(i, j - 1)] - gapExtend;
      if (yOpen >= yExt) { Y[k] = yOpen; pY[k] = 0; } else { Y[k] = yExt; pY[k] = 2; }
      // M: the two residues are aligned.
      const d = at(i - 1, j - 1);
      let best = M[d], from = 0;
      if (X[d] > best) { best = X[d]; from = 1; }
      if (Y[d] > best) { best = Y[d]; from = 2; }
      M[k] = row[q[j - 1]] + best;
      pM[k] = from;
    }
  }

  const end = at(n, m);
  let state = 0, score = M[end];
  if (X[end] > score) { state = 1; score = X[end]; }
  if (Y[end] > score) { state = 2; score = Y[end]; }

  const refToQuery = new Array(n + 1).fill(null);
  const queryToRef = new Array(m + 1).fill(null);
  const ar = [], aq = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const k = at(i, j);
    if (state === 0) {
      refToQuery[i] = j; queryToRef[j] = i;
      ar.push(r[i - 1]); aq.push(q[j - 1]);
      state = pM[k]; i--; j--;
    } else if (state === 1) {
      ar.push(r[i - 1]); aq.push('-');
      state = pX[k]; i--;
    } else {
      ar.push('-'); aq.push(q[j - 1]);
      state = pY[k]; j--;
    }
  }
  ar.reverse(); aq.reverse();
  const alignedRef = ar.join(''), alignedQuery = aq.join('');

  let pairs = 0, identical = 0, gapCols = 0;
  for (let c = 0; c < alignedRef.length; c++) {
    if (alignedRef[c] === '-' || alignedQuery[c] === '-') { gapCols++; continue; }
    pairs++;
    if (alignedRef[c] === alignedQuery[c]) identical++;
  }

  return deepFreeze({
    score,
    refToQuery,
    queryToRef,
    aligned: { ref: alignedRef, query: alignedQuery },
    ref_length: n,
    query_length: m,
    alignment_length: alignedRef.length,
    n_aligned_pairs: pairs,
    n_identical: identical,
    n_gap_columns: gapCols,
    identity: pairs === 0 ? null : identical / pairs,
    identity_denominator: 'aligned pairs, excluding gap columns',
    params: { matrix: matrixName, gapOpen, gapExtend, gap_cost: GAP_DEFAULTS.cost_of_gap_of_length_k },
    tie_breaking: 'deterministic: match state, then gap-in-query, then gap-in-reference; opening preferred to extending',
    what_this_is_not:
      'Not evidence that the two sequences are homologous, and not a structural superposition. Below roughly ' +
      '30% pairwise identity an alignment of this kind is not reliable about which positions correspond, so a ' +
      'site read through a low-identity alignment is a guess with a position number attached.',
  });
}

/**
 * Read the query residue at a position quoted in REFERENCE numbering.
 * @param {object} alignment  from alignToReference
 * @param {string} seq        the same query sequence passed to alignToReference
 * @param {number} refPos     1-based position in the reference
 * @returns {{ residue: string|null, query_position: number|null, reason: string|null }}
 */
export function residueAtRefPos(alignment, seq, refPos) {
  const q = cleanSeq(seq, { name: 'seq' });
  if (!Number.isInteger(refPos) || refPos < 1) throw new RangeError(`refPos must be a positive integer (1-based), got ${refPos}`);
  if (refPos > alignment.ref_length) return { residue: null, query_position: null, reason: `refPos ${refPos} is past the end of the reference (length ${alignment.ref_length})` };
  const qp = alignment.refToQuery[refPos];
  if (qp === null) return { residue: null, query_position: null, reason: 'alignment-gap: this reference position aligns to a gap in the query' };
  return { residue: q[qp - 1], query_position: qp, reason: null };
}

// =====================================================================================================
// 7. predictLambaMax - AN ADDITIVE SITE-SHIFT MODEL, WITH ITS UNREAD SITES IN THE OPEN
// =====================================================================================================
// Shape of siteShifts: an array of entries, one per tuned site,
//
//     { site: 83, from: 'D', shifts: { 'N': -14 }, note?: '...' }
//
// where `site` is in REFERENCE numbering, `from` is the residue the reference is expected to carry at
// that site (optional, but checked when given - a reference-numbering slip is the commonest way this
// calculation goes silently wrong), and `shifts` maps a substituted residue to its shift in nm.
//
// The function supplies no shifts, no baselines and no sites. All of that is the caller's, and must come
// from a source the caller can cite.
//
// THE ADDITIVITY ASSUMPTION IS THIS FUNCTION'S, NOT THE LITERATURE'S. Summing per-site shifts assumes
// the sites do not interact. That is a modelling choice made here for want of a pairwise table, it is
// stated in every returned object, and it is the first thing to suspect when a prediction misses.

/**
 * @param {string} seq
 * @param {string} refSeq
 * @param {Array<{site:number, from?:string, shifts:Record<string,number>}>} siteShifts
 * @param {{ baseline?: number|null, matrix?: object, gapOpen?: number, gapExtend?: number, alignment?: object }} opts
 * @returns {object} frozen
 */
export function predictLambdaMax(seq, refSeq, siteShifts, { baseline = null, matrix = BLOSUM62, gapOpen = GAP_DEFAULTS.gapOpen, gapExtend = GAP_DEFAULTS.gapExtend, alignment = null } = {}) {
  if (!Array.isArray(siteShifts)) throw new TypeError('siteShifts must be an array of { site, from?, shifts } entries');
  if (siteShifts.length === 0) throw new RangeError('siteShifts is empty. A prediction from zero tuned sites is the baseline, and calling it a prediction is the error this refusal prevents.');
  const q = cleanSeq(seq, { name: 'seq' });
  const r = cleanSeq(refSeq, { name: 'refSeq' });
  const aln = alignment ?? alignToReference(q, r, { matrix, gapOpen, gapExtend });

  const seen = new Set();
  const applied = [];
  const unmatched = [];
  const reference_state = [];
  let delta = 0;

  for (const entry of siteShifts) {
    const { site, from, shifts } = entry ?? {};
    if (!Number.isInteger(site) || site < 1) throw new RangeError(`siteShifts: site must be a positive integer in reference numbering, got ${site}`);
    if (seen.has(site)) throw new RangeError(`siteShifts: site ${site} appears twice. A duplicated site would be counted twice by an additive model.`);
    seen.add(site);
    if (!shifts || typeof shifts !== 'object') throw new TypeError(`siteShifts: site ${site} has no shifts object`);

    if (site > r.length) { unmatched.push({ site, reason: 'site-past-end-of-reference', ref_length: r.length }); continue; }
    const refRes = r[site - 1];
    if (typeof from === 'string' && from.toUpperCase() !== refRes) {
      unmatched.push({ site, reason: 'reference-residue-mismatch', expected_in_table: from.toUpperCase(), found_in_refSeq: refRes,
        why_it_matters: 'The shift table and the reference sequence disagree about what the reference carries here. That is a numbering or an isoform mismatch, and reading a site through it would attribute a shift to the wrong position.' });
      continue;
    }
    const read = residueAtRefPos(aln, q, site);
    if (read.residue === null) { unmatched.push({ site, reason: 'alignment-gap', detail: read.reason }); continue; }

    const qRes = read.residue;
    if (qRes === refRes) {
      reference_state.push({ site, residue: qRes, query_position: read.query_position });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(shifts, qRes)) {
      unmatched.push({ site, reason: 'substitution-not-in-shift-table', reference_residue: refRes, observed_residue: qRes, query_position: read.query_position,
        shifts_available_for: Object.keys(shifts),
        why_it_matters: 'The site was read successfully and carries a substitution the table says nothing about. Treating it as no shift is an assumption, not a reading.' });
      continue;
    }
    const nm = Number(shifts[qRes]);
    if (!Number.isFinite(nm)) throw new TypeError(`siteShifts: site ${site} shift for ${qRes} is not a finite number (${shifts[qRes]})`);
    applied.push({ site, from: refRes, to: qRes, shift_nm: nm, query_position: read.query_position });
    delta += nm;
  }

  const sites_total = siteShifts.length;
  const sites_read = applied.length + reference_state.length;
  const haveBaseline = typeof baseline === 'number' && Number.isFinite(baseline);

  return deepFreeze({
    nm: haveBaseline ? baseline + delta : null,
    nm_is_null_because: haveBaseline ? null : 'No baseline was supplied. The additive model gives a SHIFT; without a baseline wavelength there is nothing to shift. Returning the shift alone as "nm" would be a unit error with a plausible-looking magnitude.',
    what_would_have_to_be_measured: haveBaseline ? null : 'The lambda-max of the reference pigment under the same conditions the shifts were measured in, from the source that supplied the shift table.',
    total_shift_nm: delta,
    baseline: haveBaseline ? baseline : null,
    applied,
    unmatched_sites: unmatched,
    reference_state_sites: reference_state,
    sites_read,
    sites_total,
    all_sites_read: unmatched.length === 0,
    fraction_of_sites_read: sites_total === 0 ? null : sites_read / sites_total,
    band: {
      value: null,
      null_reason: 'A shift table of point estimates carries no residual, so no interval can be formed from it. An interval would have to come from the source\'s own residuals or from a refit, neither of which this function has.',
      what_would_have_to_be_measured: 'The per-site standard errors, or the residual spread of the additive model on the source\'s own training set.',
    },
    additivity_assumed: true,
    additivity_note:
      'Per-site shifts were summed, which assumes the tuned sites do not interact. That assumption is this ' +
      'function\'s, made for want of a pairwise table, and is the first thing to suspect when a prediction misses.',
    unread_sites_are_not_zero:
      'Every site in unmatched_sites was NOT given a shift of zero as a decision; it was not read. ' +
      'sites_read / sites_total is reported so that a prediction made from part of the table cannot be ' +
      'quoted as though it had used all of it.',
    alignment_summary: { score: aln.score, identity: aln.identity, n_gap_columns: aln.n_gap_columns, ref_length: aln.ref_length, query_length: aln.query_length },
  });
}

// =====================================================================================================
// 8. CORRELATION, AND AN INTERVAL RATHER THAN A POINT
// =====================================================================================================

function pairFinite(xs, ys, name) {
  if (!Array.isArray(xs) || !Array.isArray(ys)) throw new TypeError(`${name}: both arguments must be arrays`);
  if (xs.length !== ys.length) throw new RangeError(`${name}: length mismatch (${xs.length} vs ${ys.length})`);
  if (xs.length < 3) throw new RangeError(`${name}: ${xs.length} points. A correlation on fewer than 3 points is not a statistic.`);
  for (let i = 0; i < xs.length; i++) {
    if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) throw new RangeError(`${name}: non-finite value at index ${i} (${xs[i]}, ${ys[i]}). Missing values must be dropped by the caller, pairwise, and the drop recorded.`);
  }
}

/**
 * Pearson product-moment correlation.
 * @param {number[]} xs @param {number[]} ys @returns {number}
 */
export function pearson(xs, ys) {
  pairFinite(xs, ys, 'pearson');
  const n = xs.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) throw new RangeError('pearson: one input has zero variance, so no correlation is defined. Returning 0 would read as "no relation" when the truth is "no question".');
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Mid-ranks (average of tied ranks), 1-based.
 * @param {number[]} v @returns {number[]}
 */
export function ranks(v) {
  const n = v.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => (v[a] - v[b]) || (a - b));
  const out = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j++;
    const mid = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k]] = mid;
    i = j + 1;
  }
  return out;
}

/**
 * Spearman rank correlation, with mid-ranks for ties (so it is the Pearson correlation of the ranks,
 * which is correct in the presence of ties where the 6*sum(d^2) shortcut is not).
 * @param {number[]} xs @param {number[]} ys @returns {number}
 */
export function spearman(xs, ys) {
  pairFinite(xs, ys, 'spearman');
  return pearson(ranks(xs), ranks(ys));
}

/** Two-sided normal quantile at 0.975, to the precision used here. */
export const Z_975 = 1.959963984540054;

/**
 * 95% confidence interval for a correlation via Fisher's z transform.
 *   z = artanh(r),  se = 1 / sqrt(n - 3),  interval = tanh(z +/- 1.96 * se)
 * The 1/sqrt(n-3) form is a CHOICE and is named in the return value; 1/sqrt(n-1) and 1/sqrt(n-2) are
 * also in use. For |r| = 1 the transform diverges and the interval collapses to the point, which is
 * reported as degenerate rather than as a tight interval.
 *
 * @param {number} r @param {number} n @param {{ z?: number, se_form?: string }} [opts]
 * @returns {object} frozen
 */
export function ciFisher(r, n, { z = Z_975 } = {}) {
  if (!Number.isFinite(r) || r < -1 || r > 1) throw new RangeError(`ciFisher: r must be in [-1, 1], got ${r}`);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`ciFisher: n must be a non-negative integer, got ${n}`);
  if (n < 4) {
    return deepFreeze({
      r, n, lo: null, hi: null,
      is_an_interval: false,
      null_reason: `n = ${n}. The standard error 1/sqrt(n-3) is undefined for n <= 3, so no interval exists. A correlation on this many points has no useful uncertainty statement, and inventing one is worse than saying so.`,
      what_would_have_to_be_measured: 'More paired observations. Four is the bare minimum for this form to produce a number at all, and it will be nearly the whole interval [-1, 1].',
      method: 'fisher-z', se_form: '1/sqrt(n-3)', z,
    });
  }
  if (Math.abs(r) === 1) {
    return deepFreeze({
      r, n, lo: r, hi: r,
      is_an_interval: false,
      degenerate: true,
      degenerate_reason: 'artanh(+/-1) diverges, so the interval collapses onto the point estimate. That is an artefact of the transform, NOT a statement that the correlation is known exactly. With a perfect correlation on a finite sample the honest reading is that this transform has nothing to say.',
      method: 'fisher-z', se_form: '1/sqrt(n-3)', z,
    });
  }
  const zr = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  const lo = Math.tanh(zr - z * se);
  const hi = Math.tanh(zr + z * se);
  return deepFreeze({
    r, n, lo, hi,
    is_an_interval: true,
    width: hi - lo,
    method: 'fisher-z',
    se_form: '1/sqrt(n-3)',
    se,
    z,
    coverage_nominal: 0.95,
    not_a_point: 'The interval is the result. Quoting r without it, or quoting the midpoint of it, discards the only part of this output that says how much the sample size bought.',
    assumes: 'Approximate bivariate normality for the Pearson case. Applied to a Spearman r it is a common but rougher approximation, and the se form is debated; say which statistic the r came from wherever this interval is quoted.',
  });
}

// =====================================================================================================
// 9. A SEEDED PERMUTATION TEST
// =====================================================================================================
// Math.random does not appear in this file. mulberry32 is here so that a p value is a function of
// (xs, ys, iters, seed) and of nothing else - same stream on every platform, same p on every run - and
// so that a p quoted in a record can be recomputed by anyone holding those four things.

/**
 * mulberry32: a small, deterministic 32-bit-state PRNG. Public domain. Not cryptographic.
 * @param {number} seed @returns {() => number} uniform in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher-Yates shuffle driven by a supplied uniform generator. */
function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export const PERMUTATION_STATISTICS = deepFreeze(['pearson', 'spearman']);

/**
 * Two-sided permutation test for an association between xs and ys. ys is permuted; the statistic is
 * recomputed; the p value is the proportion of permutations whose |statistic| is at least the observed
 * |statistic|, using the add-one estimator
 *
 *     p = (1 + #{ |stat_perm| >= |stat_obs| }) / (1 + iters)
 *
 * which cannot return 0 - a Monte Carlo test with `iters` draws cannot distinguish p = 0 from
 * p < 1/(1+iters), and reporting 0 would claim it could. The estimator and the floor are both in the
 * returned object.
 *
 * @param {number[]} xs @param {number[]} ys
 * @param {{ iters?: number, seed?: number, statistic?: 'pearson'|'spearman' }} [opts]
 * @returns {object} frozen
 */
export function permutationTest(xs, ys, { iters = 10000, seed = 1, statistic = 'pearson' } = {}) {
  pairFinite(xs, ys, 'permutationTest');
  if (!PERMUTATION_STATISTICS.includes(statistic)) throw new RangeError(`permutationTest: statistic must be one of ${PERMUTATION_STATISTICS.join(', ')}, got ${statistic}`);
  if (!Number.isInteger(iters) || iters < 1) throw new RangeError(`permutationTest: iters must be a positive integer, got ${iters}`);
  if (!Number.isInteger(seed)) throw new RangeError(`permutationTest: seed must be an integer, got ${seed}. An unseeded or non-integer seed makes the p unreproducible, which is the one thing this function exists to prevent.`);

  // For Spearman, permuting the ranks is identical to ranking the permutation, so rank once.
  const useRanks = statistic === 'spearman';
  const X = useRanks ? ranks(xs) : xs.slice();
  const Y0 = useRanks ? ranks(ys) : ys.slice();

  const observed = pearson(X, Y0);
  const absObs = Math.abs(observed);
  const rand = mulberry32(seed);
  const Y = Y0.slice();
  let ge = 0;
  for (let it = 0; it < iters; it++) {
    shuffleInPlace(Y, rand);
    if (Math.abs(pearson(X, Y)) >= absObs - 1e-12) ge++;
  }

  const p = (1 + ge) / (1 + iters);
  return deepFreeze({
    p,
    p_definition: 'p = (1 + #{ |stat_perm| >= |stat_obs| }) / (1 + iters), two-sided on the absolute statistic',
    p_floor: 1 / (1 + iters),
    p_is_at_the_floor: p <= 1 / (1 + iters) + 1e-15,
    p_at_floor_means: 'No permutation beat the observed statistic in this many draws. That is an upper bound on p, not a small p value: all it says is p < 1/(1+iters) at this iteration count.',
    observed,
    statistic,
    n: xs.length,
    iters,
    seed,
    n_ge: ge,
    prng: 'mulberry32',
    deterministic: true,
    reproduce_with: `permutationTest(xs, ys, { iters: ${iters}, seed: ${seed}, statistic: '${statistic}' })`,
    what_it_tests: 'Exchangeability of the ys with respect to the xs. It does NOT test whether the relation is causal, monotone, or driven by more than one point, and with n this small a single leverage point can carry the whole statistic.',
    not_a_fused_score: 'A p value is not an effect size. Quote it next to ciFisher(observed, n), never instead of it.',
  });
}

// =====================================================================================================
// 10. SELF-CHECK (SYNTHETIC INPUT ONLY)
// =====================================================================================================

/**
 * A demonstration on wholly invented sequences and an invented shift table. Every value here is
 * SYNTHETIC. No measurement and no species is asserted; the point is to show the shapes.
 * @returns {object}
 */
export function demo() {
  // SYNTHETIC. These are not anyone's sequences.
  const ref = 'MKAHDEYCWRGSTKDEQHLAVFPNQ';
  const qry = 'MKAHNEYCWRGSTKDEQQLAVFPNQ';     // substitutions at reference positions 5 (D->N) and 18 (H->Q)
  const gapped = 'MKAHDEYCWRGSTKDEQLAVFPNQ';    // reference position 18 deleted

  const shifts = [
    { site: 5, from: 'D', shifts: { N: -14 }, note: 'SYNTHETIC illustrative shift, not a measurement' },
    { site: 18, from: 'H', shifts: { Q: 7 }, note: 'SYNTHETIC' },
  ];

  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const ys = [2, 1, 4, 3, 6, 5, 8, 7];

  return {
    note: 'EVERY VALUE BELOW IS SYNTHETIC. Sequences, shifts and baselines are invented to show the output shapes.',
    net_charge_ref_pH74: netCharge(ref),
    zmb_variants: zmbSurfaceCharge(ref).variants,
    zmb_value: zmbSurfaceCharge(ref).zmb.value,
    alignment_identity: alignToReference(qry, ref).identity,
    predicted: predictLambdaMax(qry, ref, shifts, { baseline: 500 }),
    predicted_through_a_gap: predictLambdaMax(gapped, ref, shifts, { baseline: 500 }),
    pearson: pearson(xs, ys),
    spearman: spearman(xs, ys),
    ci: ciFisher(pearson(xs, ys), xs.length),
    perm: permutationTest(xs, ys, { iters: 2000, seed: 7 }),
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('predict.mjs')) {
  const d = demo();
  console.log('\npredict.mjs - prediction functions, no biological data, no network, seeded.\n');
  console.log(d.note, '\n');
  console.log('net charge of the synthetic reference at pH 7.4:', d.net_charge_ref_pH74.toFixed(3));
  console.log('zmb value:', d.zmb_value, '  <- deliberately null; see ZMB_CONVENTION');
  console.log('sequence-only variants:', d.zmb_variants);
  console.log('alignment identity (one substitution):', d.alignment_identity);
  console.log('prediction:', d.predicted.nm, 'nm;  sites read', `${d.predicted.sites_read}/${d.predicted.sites_total}`);
  console.log('through a gap:', d.predicted_through_a_gap.nm, 'nm;  sites read',
    `${d.predicted_through_a_gap.sites_read}/${d.predicted_through_a_gap.sites_total}`,
    '; unmatched:', JSON.stringify(d.predicted_through_a_gap.unmatched_sites.map(u => `${u.site}:${u.reason}`)));
  console.log('pearson', d.pearson.toFixed(4), ' spearman', d.spearman.toFixed(4));
  console.log('95% CI', [d.ci.lo, d.ci.hi].map(v => v.toFixed(4)).join(' .. '), `(${d.ci.se_form})`);
  console.log('permutation p', d.perm.p, `(${d.perm.reproduce_with})`);
  console.log('\nsources actually retrieved:');
  for (const [k, v] of Object.entries(SOURCES)) {
    if (!v.doi) continue;
    console.log(`  ${k}: ${v.doi}${v.pmid ? ` (PMID ${v.pmid})` : ''}`);
  }
  console.log('\nvalues refused:');
  console.log('  Zmb                 ->', ZMB_CONVENTION.therefore);
  console.log('  Arg pKa             ->', PKA_ARG_UNMEASURED.null_reason.slice(0, 120) + '...');
  console.log('  lambda-max band     -> no residual in a table of point estimates');
  console.log();
}
