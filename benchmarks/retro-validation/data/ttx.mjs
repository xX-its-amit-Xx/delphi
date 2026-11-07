#!/usr/bin/env node
// ttx.mjs - TETRODOTOXIN RESISTANCE IN VOLTAGE-GATED SODIUM CHANNELS, AS A RETRO-VALIDATION CASE.
//
// ============================== WHY THIS CASE ==============================
// A retro-validation case has to be two things at once, and almost nothing is both:
//
//   QUANTITATIVE. There must be a number, with a unit, that a prediction could have missed. "Resistant"
//   is not a target. "TTX IC50 = 7620 +/- 691 nM on rNaV1.4 D1532A in Xenopus oocytes" is a target.
//
//   CONVERGENT. The same functional outcome must have been reached more than once, from different
//   starting material, in lineages that do not share the derived state by descent. That is what makes
//   it a test of a FUNCTIONAL analogy rather than a test of an orthology table: the pore-loop residue
//   is orthologous between lineages, but the SUBSTITUTION at it is not, and in some cases the lineages
//   did not even reach the same amino acid.
//
// Tetrodotoxin resistance is both. TTX plugs the outer vestibule of the voltage-gated sodium channel
// and stops the sodium current; a handful of substitutions in the four pore loops (P-loops, one from
// each of domains DI-DIV) reduce the block. Those substitutions have been made by site-directed
// mutagenesis in a mammalian channel and measured by voltage clamp, AND they occur naturally in
// squamate reptiles, in amphibians, and in bony fishes, and the natural variants have themselves been
// cloned and measured. So for several positions there is a measured number from a controlled mutant
// and a measured number from a natural variant, in lineages that acquired it independently.
//
// ============================== THE HARD PART, WHICH IS NOT THE BIOLOGY ==============================
// The numbers are real and they are NOT COMMENSURABLE. Five things in this file are routinely treated
// as one quantity and are not:
//
//   1. IC50 and Kd are different estimands even when both are fitted from a Langmuir isotherm, and the
//      error bars quoted are sometimes SEM and sometimes a 95% confidence interval.
//   2. The same wild-type channel, rat NaV1.4 in Xenopus oocytes, has a published TTX IC50 of 48.6 nM
//      in one lab and 36 nM in another. That ~1.4x between-lab spread is the floor on any cross-study
//      fold-change, and it is not an error bar anyone reports.
//   3. A substitution measured in a mammalian channel background is not the same experiment as the same
//      substitution measured in the native channel of the animal that evolved it. Hague et al. 2018 saw
//      gating shifts in the native snake channel that earlier work in a mammalian background had not.
//   4. Four numbering conventions are in play. D1532, D1568 and D1431 are three papers' names for what
//      their authors take to be one position in three species. This file never silently equates them.
//   5. Channel block, muscle fibre action potential, and whole-animal resistance are three levels. A
//      260-fold channel shift is not a 260-fold animal. See WHY_IT_MIGHT_NOT_BE.
//
// ============================== THE RULE THIS FILE OBEYS ==============================
// A FABRICATED DOI OR MEASUREMENT IS THE WORST THING THIS PROJECT CAN PRODUCE. Every number below was
// read out of a source that was actually retrieved in the session that wrote this file, and every source
// says in `verified_how` exactly what was retrieved and how. Where a number exists in the literature but
// could not be retrieved, the field is `{ value: null, null_reason, what_would_have_to_be_measured }`
// and it stays that way. Four such refusals are recorded in REFUSED_VALUES. Fold-changes that no paper
// states are computed here and carry `derived_by`, never a citation.
//
// DATA PROVENANCE NOTE: the comparative surveys drawn on here (Jost et al. 2008 in particular) tabulate
// rows from a wider span of animals than this repo's comparative scope. Only the mammal, bony-fish,
// amphibian and squamate-reptile rows have been taken; the subset is mammals, fishes, amphibians and
// squamates because that is this repo's comparative scope, and the omitted rows are not summarised,
// counted or referred to anywhere below.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). No member of it is named,
// read or substituted for here. Run `node holdout/check-leaks.mjs benchmarks/retro-validation`.
//
//   node benchmarks/retro-validation/data/ttx.mjs            # print summary()
//   node benchmarks/retro-validation/data/test-ttx.mjs        # the tests

// ====================================================================================================
// FREEZING
// ====================================================================================================
const deepFreeze = (o) => {
  if (o === null || (typeof o !== 'object')) return o;
  Object.getOwnPropertyNames(o).forEach((k) => deepFreeze(o[k]));
  return Object.freeze(o);
};

export const WHAT_THIS_IS = 'Measured tetrodotoxin block of voltage-gated sodium channels, per pore-loop substitution, kept separate by numbering convention, by construct type and by level of biological organisation, so that a convergent functional analogy can be scored without pretending the numbers are commensurable.';

// ====================================================================================================
// SOURCES - every one retrieved, and what was retrieved said plainly
// ====================================================================================================
export const SOURCES = deepFreeze({
  choudhary_2003: {
    citation: 'Choudhary, G., Yotsu-Yamashita, M., Shang, L., Yasumoto, T. & Dudley, S.C. (2003) Interactions of the C-11 hydroxyl of tetrodotoxin with the sodium channel outer vestibule. Biophysical Journal 84:287-294.',
    doi: '10.1016/S0006-3495(03)74849-8',
    pmid: '12524282',
    pmcid: 'PMC1302610',
    open_access: true,
    verified_how: 'PMID 12524282 resolved through the PubMed MCP tool (title, journal, DOI, abstract all returned). The PubMed Central record PMC1302610 was then fetched over HTTP and its Table 1 parsed out of the HTML; every TTX IC50 value, SEM and n attributed to this source below was read from that parsed table, not from the abstract and not from any later paper citing it.',
    what_it_measured: 'TTX and 11-deoxyTTX IC50 for 17 site-directed mutants of the adult rat skeletal-muscle channel rNaV1.4 (SCN4A), expressed in Xenopus laevis oocytes, two-electrode voltage clamp, static bath, holding potential -100 mV, IC50 fitted from a single-site Langmuir adsorption isotherm.',
  },
  jost_2008: {
    citation: 'Jost, M.C., Hillis, D.M., Lu, Y., Kyle, J.W., Fozzard, H.A. & Zakon, H.H. (2008) Toxin-resistant sodium channels: parallel adaptive evolution across a complete gene family. Molecular Biology and Evolution 25:1016-1024.',
    doi: '10.1093/molbev/msn025',
    pmid: '18258611',
    pmcid: 'PMC2877999',
    open_access: true,
    verified_how: 'PMID 18258611 resolved through the PubMed MCP tool. The PubMed Central record PMC2877999 was fetched over HTTP; the Results text and Table 1 were parsed out of the HTML. The IC50 values in micromolar, the 15.2-fold and 1.5-fold figures, the mutant names M1240T and A1529G, and the Table 1 fold ranges below were all read from that parsed text.',
    what_it_measured: 'Site-directed mutagenesis of two pore-loop positions into rat NaV1.4, expressed in Xenopus laevis oocytes, dose-response voltage clamp, TTX and saxitoxin IC50 in micromolar. Plus a comparative survey of pore-loop sequence across eight teleost sodium-channel paralogues in four pufferfish species.',
  },
  hague_2018: {
    citation: 'Hague, M.T.J., Toledo, G., Geffeney, S.L., Hanifin, C.T., Brodie, E.D. Jr & Brodie, E.D. III (2018) Large-effect mutations generate trade-off between predatory and locomotor ability during arms race coevolution with deadly prey. Evolution Letters 2:406-416.',
    doi: '10.1002/evl3.76',
    pmid: '30283691',
    pmcid: 'PMC6121790',
    open_access: true,
    verified_how: 'PMID 30283691 resolved through the PubMed MCP tool; the full text of PMC6121790 was then retrieved through the PubMed MCP full-text tool AND, because that extraction silently dropped the superscripted allele labels, the PMC HTML was additionally fetched over HTTP and Table 2 re-parsed so that the allele names NaV1.4+, NaV1.4V and NaV1.4LVNV could be read with their superscripts intact. Every Kd, V-half, n and the 260-fold figure below was read from that re-parsed Table 2 and from the Results text that reports it.',
    what_it_measured: 'Three NATIVE Thamnophis sirtalis NaV1.4 alleles, cloned whole (1875 aa) from a TTX-sensitive Illinois snake background and mutagenised at the DIV pore loop, expressed in Xenopus laevis oocytes, cut-open oocyte Vaseline-gap voltage clamp at 22-25 C. TTX Kd fitted from a single-site Langmuir isotherm; voltage dependence of activation and of fast inactivation fitted with a Boltzmann function. Separately, whole-animal crawl speed on a 4 m racetrack in 77 California and 95 Pacific Northwest neonates.',
  },
  hanifin_2015: {
    citation: 'Hanifin, C.T. & Gilly, W.F. (2015) Evolutionary history of a complex adaptation: tetrodotoxin resistance in salamanders. Evolution 69:232-244.',
    doi: '10.1111/evo.12552',
    pmid: '25346116',
    pmcid: 'PMC5333673',
    open_access: true,
    verified_how: 'PMID 25346116 resolved through the PubMed MCP tool; PMC5333673 fetched over HTTP and the Results, Discussion and figure legends parsed out of the HTML. The four salSCN4a substitution names, the muscle action-potential TTX concentrations in micromolar, the 89.4% sequence identity, the 30000-fold cross-study statement and the sentence about additivity and genetic background were all read from that parsed text.',
    what_it_measured: 'Muscle action-potential block by bath TTX in intact skeletal muscle of four salamandrid and ambystomatid species, plus salSCN4a (NaV1.4) coding sequence from ten species. This is a MUSCLE FIBRE assay, not a cloned-channel assay: no IC50 or Kd for an isolated channel is reported.',
  },
  maruta_2007: {
    citation: 'Maruta, S., Yamaoka, K. & Yotsu-Yamashita, M. (2008) Two critical residues in p-loop regions of puffer fish Na+ channels on TTX sensitivity. Toxicon 51:381-387.',
    doi: '10.1016/j.toxicon.2007.10.014',
    pmid: '18067939',
    open_access: false,
    verified_how: 'PMID 18067939 resolved through the PubMed MCP tool, which returned the full structured abstract. Every fold-change below is quoted from that retrieved abstract. The absolute Kd table is NOT in the abstract and the article body was not retrievable, so the absolute Kd values are recorded as null rather than reconstructed. See REFUSED_VALUES.',
    what_it_measured: 'Site-directed mutants F385N, F385A, F385Q, G1718T and the double mutant F385N/G1718T of rat NaV1.2a, transiently expressed in HEK-293 cells; TTX dissociation constant Kd, plus k_off. The two positions mimic the anomalous Asn-383 (DI) and Thr-1569 (DIV) residues of the pufferfish Takifugu pardalis skeletal-muscle channel fNaV1.4a.',
  },
  venkatesh_2005: {
    citation: 'Venkatesh, B., Lu, S.Q., Dandona, N., See, S.L., Brenner, S. & Soong, T.W. (2005) Genetic basis of tetrodotoxin resistance in pufferfishes. Current Biology 15:2069-2072.',
    doi: '10.1016/j.cub.2005.10.068',
    pmid: '16303569',
    open_access: false,
    verified_how: 'PMID 16303569 resolved through the PubMed MCP tool; the abstract was returned and read. The abstract states WHICH residues confer resistance but gives no IC50, Kd or fold-change, and the article body was not retrievable, so this source supports only the qualitative rows below. No number is attributed to it anywhere in this file.',
    what_it_measured: 'Pore-loop sequence of duplicated NaV1.4a / NaV1.4b channels in Takifugu rubripes, Tetraodon nigroviridis and the TTX-sensitive Danio rerio, plus electrophysiology showing that the non-aromatic DI residue (Asn in T. rubripes, Cys in T. nigroviridis) confers TTX resistance.',
  },
  geffeney_2005: {
    citation: 'Geffeney, S.L., Fujimoto, E., Brodie, E.D. III, Brodie, E.D. Jr & Ruben, P.C. (2005) Evolutionary diversification of TTX-resistant sodium channels in a predator-prey interaction. Nature 434:759-763.',
    doi: '10.1038/nature03444',
    pmid: '15815629',
    open_access: false,
    verified_how: 'PMID 15815629 resolved through the PubMed MCP tool; title, journal, DOI and abstract were returned and read. The abstract contains NO numeric TTX affinity, and the article body was not retrievable. Everything this file says about its numbers is therefore flagged as second-hand through jost_2008 or hanifin_2015, with the primary source recorded as not retrieved. See REFUSED_VALUES.',
    what_it_measured: 'Functional expression of tsNaV1.4 variants from four Thamnophis sirtalis populations, and the residue numbering (including I1561 and D1568) that the later snake literature uses.',
  },
  geffeney_2022: {
    citation: 'Geffeney, S.L., Cordingley, J.A., Mitchell, K. & Hanifin, C.T. (2022) In silico analysis of tetrodotoxin binding in voltage-gated sodium ion channels from toxin-resistant animal lineages. Marine Drugs 20:723.',
    doi: '10.3390/md20110723',
    pmid: '36422001',
    pmcid: 'PMC9698786',
    open_access: true,
    verified_how: 'PMID 36422001 resolved through the PubMed MCP tool; the full abstract was returned and read. Only the abstract is used, and only for its stated negative conclusion - no docking number is quoted from it.',
    what_it_measured: 'Homology modelling and TTX docking across toxin-resistant lineages, testing whether positionally convergent substitutions produce convergent TTX-channel interactions. Reported little evidence that they do, on polar-contact count, contact position or estimated binding energy.',
  },
  hague_2017: {
    citation: 'Hague, M.T.J., Feldman, C.R., Brodie, E.D. Jr & Brodie, E.D. III (2017) Convergent adaptation to dangerous prey proceeds through the same first-step mutation in the garter snake Thamnophis sirtalis. Evolution 71:1504-1518.',
    doi: '10.1111/evo.13244',
    pmid: '28370004',
    open_access: false,
    verified_how: 'PMID 28370004 resolved through the PubMed MCP tool; the abstract was returned and read. Used only for its stated qualitative finding - that the I1561V changes in the two lineages are not identical by descent but arose independently - which the abstract asserts in those terms. No number is taken from it.',
    what_it_measured: 'Range-wide sequencing of NaV1.4 in Thamnophis sirtalis, and a NaV1.4 gene tree bearing on whether the two lineages share the derived state by descent.',
  },
  feldman_2010: {
    citation: 'Feldman, C.R., Brodie, E.D. Jr, Brodie, E.D. III & Pfrender, M.E. (2010) Genetic architecture of a feeding adaptation: garter snake (Thamnophis) resistance to tetrodotoxin bearing prey. Proceedings of the Royal Society B 277:3317-3325.',
    doi: '10.1098/rspb.2010.0748',
    pmid: '20522513',
    pmcid: 'PMC2981930',
    open_access: true,
    verified_how: 'PMID 20522513 resolved through the PubMed MCP tool; the full abstract was returned and read. The 23% figure below is quoted from that abstract verbatim ("Allelic variation in Na(v)1.4 explains 23 per cent of the variation in TTX resistance in T. atratus").',
    what_it_measured: 'Whole-animal TTX resistance phenotype against NaV1.4 genotype and against neutral microsatellites, in local samples of Thamnophis atratus and Thamnophis sirtalis.',
  },
  mcglothlin_2014: {
    citation: 'McGlothlin, J.W., Chuckalovcak, J.P., Janes, D.E., Edwards, S.V., Feldman, C.R., Brodie, E.D. Jr, Pfrender, M.E. & Brodie, E.D. III (2014) Parallel evolution of tetrodotoxin resistance in three voltage-gated sodium channel genes in the garter snake Thamnophis sirtalis. Molecular Biology and Evolution 31:2836-2846.',
    doi: '10.1093/molbev/msu237',
    pmid: '25135948',
    pmcid: 'PMC4209135',
    open_access: true,
    verified_how: 'PMID 25135948 resolved through the PubMed MCP tool; the full abstract was returned and read. Used for the qualitative claim that NaV1.6 and NaV1.7 each carry at least one substitution identical to one previously found in NaV1.4, and that NaV1.1-1.3 show none. No number is taken from it.',
    what_it_measured: 'BAC-library scans of six NaV paralogues in Thamnophis sirtalis, scored for the presence of known TTX-resistance substitutions.',
  },
  gendreau_2020: {
    citation: 'Gendreau, K.L., Hague, M.T.J., Feldman, C.R., Brodie, E.D. Jr, Brodie, E.D. III & McGlothlin, J.W. (2020) Sex linkage of the skeletal muscle sodium channel gene (SCN4A) explains apparent deviations from Hardy-Weinberg equilibrium of tetrodotoxin-resistance alleles in garter snakes (Thamnophis sirtalis). Heredity 124:647-657.',
    doi: '10.1038/s41437-020-0300-5',
    pmid: '32111979',
    pmcid: 'PMC7171075',
    open_access: true,
    verified_how: 'PMID 32111979 resolved through the PubMed MCP tool; the full abstract was returned and read. Used only for the qualitative claim that SCN4A is Z-linked in Thamnophis, which bears on how allele frequencies at this locus may be read. No number is taken from it.',
    what_it_measured: 'Genomic data and quantitative PCR placing SCN4A on the Z chromosome in Thamnophis and other advanced snakes.',
  },
});

export const SOURCE_IDS = deepFreeze(Object.keys(SOURCES));

// ====================================================================================================
// NUMBERING CONVENTIONS - four of them, kept apart
// ====================================================================================================
// "D1532", "D1568" and "D1431" are three papers' names for what their authors take to be one position
// in three species' channels. This file records each substitution under the convention its own source
// used and NEVER rewrites one into another. Where a source itself asserts an equivalence, the assertion
// is recorded in CONVERGENCE as that source's claim, not as a fact of this dataset.
export const NUMBERING_CONVENTIONS = deepFreeze({
  'rNaV1.4': {
    means: 'Residue numbering of the adult rat skeletal-muscle sodium channel NaV1.4 (SCN4A), as used by choudhary_2003 and jost_2008.',
    organism_of_the_numbering: 'Rattus norvegicus',
    clade_of_the_numbering: 'mammal',
    example: 'D1532A',
  },
  'rNaV1.2a': {
    means: 'Residue numbering of the rat brain sodium channel NaV1.2a, as used by maruta_2007 for its mutants. A DIFFERENT paralogue from rNaV1.4, so its residue numbers are not interchangeable with rNaV1.4 numbers.',
    organism_of_the_numbering: 'Rattus norvegicus',
    clade_of_the_numbering: 'mammal',
    example: 'F385N',
  },
  'tsNaV1.4': {
    means: 'Residue numbering of the Thamnophis sirtalis skeletal-muscle channel NaV1.4, established in geffeney_2005 and used by hague_2017, hague_2018 and jost_2008 when they speak of snake positions.',
    organism_of_the_numbering: 'Thamnophis sirtalis',
    clade_of_the_numbering: 'squamate reptile',
    example: 'I1561V',
  },
  'salSCN4a': {
    means: 'Residue numbering of the salamandrid skeletal-muscle channel NaV1.4 (salSCN4a), as used by hanifin_2015.',
    organism_of_the_numbering: 'Taricha granulosa and relatives',
    clade_of_the_numbering: 'amphibian',
    example: 'D1431S',
  },
  'fNaV1.4a': {
    means: 'Residue numbering of the Takifugu pardalis skeletal-muscle channel fNaV1.4a, referred to by maruta_2007 when naming the natural pufferfish residues Asn-383 (DI) and Thr-1569 (DIV) that its rNaV1.2a mutants were built to mimic.',
    organism_of_the_numbering: 'Takifugu pardalis',
    clade_of_the_numbering: 'bony fish',
    example: 'Asn-383',
  },
});

export const NUMBERING_IDS = deepFreeze(Object.keys(NUMBERING_CONVENTIONS));

export const CROSS_CONVENTION_RULE = deepFreeze({
  rule: 'No residue number in this file is translated between conventions. A row states its own convention and nothing more.',
  because: 'Translating a residue number is an alignment claim, and alignment claims are the step at which a convergence dataset quietly becomes a homology dataset. Two sources can agree that "the equivalent residue" was substituted and still disagree about which residue that is.',
  where_equivalences_live: 'CONVERGENCE, each one attributed to the source that asserted it, with asserted_by naming that source.',
});

// ====================================================================================================
// CLOSED VOCABULARIES
// ====================================================================================================
export const CLADES = deepFreeze(['mammal', 'bony fish', 'amphibian', 'squamate reptile']);

export const CONSTRUCT_TYPES = deepFreeze({
  'site-directed-mutant': 'A substitution introduced by mutagenesis into a channel from a species that does not carry it naturally. Isolates the substitution; says nothing about the background it occurs in naturally.',
  'native-cloned-variant': 'A channel cloned from the species that carries the variant, expressed heterologously. Keeps the native background; still not the native cell.',
  'native-tissue': 'The animal\'s own muscle or nerve, recorded without cloning anything. Keeps everything; isolates nothing.',
  'no-functional-construct': 'A sequence observation only. No channel was expressed and no block was measured.',
});

export const MEASUREMENT_LEVELS = deepFreeze({
  'channel-heterologous': 'TTX block of a channel expressed in a host cell (Xenopus oocyte or HEK-293). The number is a property of a channel in a membrane that is not its own.',
  'muscle-fibre': 'TTX block of the action potential in the animal\'s own skeletal muscle. Integrates channel density, channel mix, and the fibre.',
  'whole-animal': 'A resistance or performance phenotype of the intact animal. Integrates absorption, distribution, every tissue, and behaviour.',
  'sequence-only': 'No block was measured at any level.',
});

export const LEVEL_IDS = deepFreeze(Object.keys(MEASUREMENT_LEVELS));

export const QUANTITIES = deepFreeze({
  'TTX-IC50': { means: 'Bath TTX concentration reducing peak sodium current by 50%.', unit: 'nM or uM, as the source reported it' },
  'TTX-Kd': { means: 'TTX concentration at which half the channels are toxin-bound, fitted from a single-site Langmuir isotherm.', unit: 'nM' },
  'STX-IC50': { means: 'As TTX-IC50 but for saxitoxin, a different guanidinium toxin at the same site.', unit: 'uM' },
  'TTX-fold-change-in-Kd': { means: 'Ratio of a mutant\'s Kd to a stated reference channel\'s Kd, as the source reported the ratio.', unit: 'fold (dimensionless ratio)' },
  'activation-V-half': { means: 'Voltage at which half the channels are open.', unit: 'mV' },
  'fast-inactivation-V-half': { means: 'Voltage at which half the channels are closed by fast inactivation.', unit: 'mV' },
  'AP-block-threshold': { means: 'Lowest bath TTX concentration at which the source reports the muscle action potential blocked.', unit: 'uM' },
  'variance-explained': { means: 'Share of phenotypic variance in whole-animal TTX resistance attributable to genotype at one locus.', unit: 'percent of phenotypic variance' },
  'sequence-identity': { means: 'Pairwise amino-acid identity between two species\' channels.', unit: 'percent' },
});

export const QUANTITY_IDS = deepFreeze(Object.keys(QUANTITIES));

const NO_VALUE = (null_reason, what_would_have_to_be_measured) => ({
  value: null, unit: null, null_reason, what_would_have_to_be_measured,
});

// ====================================================================================================
// SUBSTITUTIONS - the measured rows
// ====================================================================================================
// Every row: channel, gene, P-loop domain, substitution WITH its numbering convention, the measured
// quantity with units, the species the channel came from, the species or cell it was expressed in,
// whether it is a mutant or a native variant, the level of organisation, the source, verified_how.
//
// `whole_animal_fold_shift` is present and null on every row that is not a whole-animal measurement,
// so that the absence is a recorded fact rather than a missing field. No row carries a whole-animal
// fold-shift at all: none of the retrieved sources reports one.
const C = SOURCES.choudhary_2003;
const J = SOURCES.jost_2008;
const HG = SOURCES.hague_2018;

const choudharyRow = (id, sub, domain, value, sem, n, note) => ({
  id,
  channel: 'NaV1.4',
  gene: 'SCN4A',
  domain,
  substitution: sub,
  numbering: 'rNaV1.4',
  channel_from_species: 'Rattus norvegicus',
  channel_from_clade: 'mammal',
  expressed_in: 'Xenopus laevis oocytes, two-electrode voltage clamp',
  construct: 'site-directed-mutant',
  measurement_level: 'channel-heterologous',
  quantity: 'TTX-IC50',
  measured: {
    value, unit: 'nM',
    error: sem === null ? null : { value: sem, unit: 'nM', kind: 'SEM' },
    n,
    censored: sem === null ? 'lower-bound-only: the source reports this as a greater-than value, so no point estimate exists' : null,
  },
  reference_channel: { id: 'choudhary-2003-rNaV1.4-wild-type', substitution: 'none (wild type)', value: 48.6, unit: 'nM' },
  whole_animal_fold_shift: null,
  whole_animal_fold_shift_absent_because: 'This is a channel-level block measurement in a host oocyte. No animal was dosed.',
  source: 'choudhary_2003',
  verified_how: `Read from the parsed Table 1 of ${C.pmcid}, fetched over HTTP. ${C.verified_how.split('. ').slice(-1)[0]}`,
  note,
});

export const SUBSTITUTIONS = deepFreeze([
  // ---- the reference channel itself -------------------------------------------------------------
  {
    id: 'choudhary-2003-rNaV1.4-wild-type',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'none (unsubstituted)',
    substitution: 'none (wild type)', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, two-electrode voltage clamp',
    construct: 'site-directed-mutant',
    construct_note: 'The unmutated parent of the mutant series; typed with the series so that the comparison is like for like.',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-IC50',
    measured: { value: 48.6, unit: 'nM', error: { value: 4.3, unit: 'nM', kind: 'SEM' }, n: 6, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'choudhary_2003',
    verified_how: 'Read from the parsed Table 1 of PMC1302610, fetched over HTTP. The source itself notes this value is close to a previously published one for the same channel.',
    note: 'This is the denominator for every choudhary_2003 fold-change computed in this file. jost_2008 reports 0.036 uM = 36 nM for nominally the same channel in nominally the same system: see DISCREPANCIES.between_lab_wild_type.',
  },

  // ---- DIV, the aspartate -----------------------------------------------------------------------
  choudharyRow('choudhary-2003-D1532A', 'D1532A', 'DIV', 7620, 691, 21,
    'The largest TTX shift in the series. The DIV aspartate is the residue choudhary_2003 identifies as interacting most strongly with the TTX C-11 hydroxyl.'),
  choudharyRow('choudhary-2003-D1532K', 'D1532K', 'DIV', 3190, 173, 15,
    'Charge reversal at the same position, a smaller shift than the neutral Ala substitution. Not monotonic in charge.'),
  choudharyRow('choudhary-2003-D1532N', 'D1532N', 'DIV', 1480, 185, 6,
    'The charge-neutralising Asp-to-Asn change. This is the substitution class that the squamate and amphibian literature points at, which is why its measured value matters here and why DISCREPANCIES.asp_to_asn_fold_attribution is recorded.'),
  choudharyRow('choudhary-2003-N1536A', 'N1536A', 'DIV', 71.8, 17.5, 7,
    'A nearby DIV substitution with almost no effect, which is what makes the D1532 result a position-specific result rather than a domain-wide one.'),

  // ---- DII, the threonine and its neighbours ----------------------------------------------------
  choudharyRow('choudhary-2003-T759A', 'T759A', 'DII', 100000, null, 4,
    'Reported as >100,000 nM. A lower bound, not a measurement: see DISCREPANCIES.thr_fold_attribution for why this row is the one a later survey appears to have conflated with the Ile/Asp/Lys rows.'),
  choudharyRow('choudhary-2003-T759D', 'T759D', 'DII', 387.0, 15.0, 6, 'The largest effect among the non-Ala substitutions at this threonine.'),
  choudharyRow('choudhary-2003-T759I', 'T759I', 'DII', 89.7, 3.7, 6, 'Under twofold. Small.'),
  choudharyRow('choudhary-2003-T759K', 'T759K', 'DII', 104.0, 10.6, 18, 'Just over twofold.'),
  choudharyRow('choudhary-2003-E758Q', 'E758Q', 'DII', 8000, null, 8, 'Reported as >8,000 nM. A lower bound.'),
  choudharyRow('choudhary-2003-D762N', 'D762N', 'DII', 56.6, 9.5, 22, 'Minimal effect.'),
  choudharyRow('choudhary-2003-E765Q', 'E765Q', 'DII', 60.4, 4.7, 4, 'Minimal effect.'),

  // ---- DI ---------------------------------------------------------------------------------------
  choudharyRow('choudhary-2003-D400A', 'D400A', 'DI', 3000, null, 6, 'Reported as >3,000 nM. A lower bound.'),
  choudharyRow('choudhary-2003-E403Q', 'E403Q', 'DI', 100000, null, 4, 'Reported as >100,000 nM. A lower bound.'),
  choudharyRow('choudhary-2003-N404A', 'N404A', 'DI', 78.5, 9.9, 9, 'About twofold.'),
  choudharyRow('choudhary-2003-N404R', 'N404R', 'DI', 132.0, 8.3, 10, 'Two- to threefold; Arg is the residue native to cardiac channels at this position.'),

  // ---- DIII -------------------------------------------------------------------------------------
  choudharyRow('choudhary-2003-M1240A', 'M1240A', 'DIII', 181.0, 15.0, 8,
    'Same position as jost_2008\'s M1240T but a different substitution, measured in a different lab. Both are in this file; the two numbers are NOT two estimates of one quantity.'),
  choudharyRow('choudhary-2003-D1241A', 'D1241A', 'DIII', 29.7, 4.6, 5,
    'MORE sensitive than wild type, not less. A substitution in a TTX-binding pore loop that moves affinity the other way: the direction of effect is not a property of the domain.'),

  // ---- jost_2008: two positions, into rat NaV1.4, in micromolar --------------------------------
  {
    id: 'jost-2008-rNaV1.4-wild-type-TTX',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'none (unsubstituted)',
    substitution: 'none (wild type)', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, dose-response voltage clamp',
    construct: 'site-directed-mutant',
    construct_note: 'Unmutated parent of this paper\'s mutant pair.',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-IC50',
    measured: { value: 0.036, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'jost_2008',
    verified_how: 'Read from the parsed Results text of PMC2877999 ("micromolar TTX to reduce current by 50% [IC50] was 0.55 for mutants, vs. 0.036 for wild type"). No error bar or n is given for it in that sentence, so both are recorded null rather than guessed.',
    note: 'Nominally the same channel and host cell as choudhary-2003-rNaV1.4-wild-type, and a different number. See DISCREPANCIES.between_lab_wild_type.',
  },
  {
    id: 'jost-2008-M1240T-TTX',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIII',
    substitution: 'M1240T', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, dose-response voltage clamp',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-IC50',
    measured: { value: 0.55, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: { id: 'jost-2008-rNaV1.4-wild-type-TTX', substitution: 'none (wild type)', value: 0.036, unit: 'uM' },
    fold_change_as_the_source_states_it: { value: 15.2, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Table 1 of jost_2008; the Results text rounds the same figure to "approximately 15-fold"' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'jost_2008',
    verified_how: 'IC50 values and the 15.2-fold figure read from the parsed Results text and Table 1 of PMC2877999, fetched over HTTP.',
    note: 'The natural counterpart is a Met-to-Thr change in DIII found in several pufferfish sodium-channel paralogues and, at the position hanifin_2015 calls M1116, in modern newts. This row is the measured mammalian stand-in for that natural change, not a measurement of either natural channel.',
  },
  {
    id: 'jost-2008-M1240T-STX',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIII',
    substitution: 'M1240T', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, dose-response voltage clamp',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'STX-IC50',
    measured: { value: 0.045, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: { id: 'jost-2008-rNaV1.4-wild-type-STX', substitution: 'none (wild type)', value: 0.003, unit: 'uM' },
    fold_change_as_the_source_states_it: { value: 15, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Results text and Table 1 of jost_2008, for saxitoxin' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'jost_2008',
    verified_how: 'Read from the parsed Results text of PMC2877999 ("micromolar STX for IC50 was 0.045 for mutants, vs. 0.003 for wild type").',
    note: 'A DIFFERENT TOXIN at the same site. Included because the next row shows the two toxins come apart: A1529G shifts STX about 11-fold and TTX about 1.5-fold. A dataset that treats "guanidinium toxin resistance" as one axis loses that.',
  },
  {
    id: 'jost-2008-A1529G-TTX',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'A1529G', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, dose-response voltage clamp',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-IC50',
    measured: { value: 0.056, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: { id: 'jost-2008-rNaV1.4-wild-type-TTX', substitution: 'none (wild type)', value: 0.036, unit: 'uM' },
    fold_change_as_the_source_states_it: { value: 1.5, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Results text and Table 1 of jost_2008' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'jost_2008',
    verified_how: 'Read from the parsed Results text of PMC2877999 ("micromolar TTX for IC50 was 0.056 for mutants, vs. 0.036 for wild type, about 1.5-fold").',
    note: 'The same source reports that channels carrying this substitution produced currents so large that the mRNA had to be diluted to 0.05-0.02 of the wild-type amount. If the substitution changes single-channel conductance or expression level, then "resistance of the current" and "affinity of the channel" are two different things here, and only one of them is what IC50 measures.',
  },
  {
    id: 'jost-2008-A1529G-STX',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'A1529G', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, dose-response voltage clamp',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'STX-IC50',
    measured: { value: 0.033, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: { id: 'jost-2008-rNaV1.4-wild-type-STX', substitution: 'none (wild type)', value: 0.003, unit: 'uM' },
    fold_change_as_the_source_states_it: { value: 11, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Results text and Table 1 of jost_2008, for saxitoxin' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'jost_2008',
    verified_how: 'Read from the parsed Results text of PMC2877999 ("micromolar STX for IC50 was 0.033 for mutants, vs. 0.003 for wild type, about 11-fold").',
    note: 'About 11-fold for saxitoxin against about 1.5-fold for TTX at the same substitution. The toxins do not co-vary.',
  },
  {
    id: 'jost-2008-rNaV1.4-wild-type-STX',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'none (unsubstituted)',
    substitution: 'none (wild type)', numbering: 'rNaV1.4',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'Xenopus laevis oocytes, dose-response voltage clamp',
    construct: 'site-directed-mutant',
    construct_note: 'Unmutated parent, saxitoxin arm.',
    measurement_level: 'channel-heterologous',
    quantity: 'STX-IC50',
    measured: { value: 0.003, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'jost_2008',
    verified_how: 'Read from the parsed Results text of PMC2877999, fetched over HTTP in this session ("micromolar STX for IC50 was 0.045 for mutants, vs. 0.003 for wild type"). No error bar and no n are given for it there, so both are recorded null rather than guessed.',
    note: 'Denominator for the two STX rows.',
  },

  // ---- hague_2018: NATIVE snake channels -------------------------------------------------------
  {
    id: 'hague-2018-NaV1.4-plus',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'none (ancestral, TTX-sensitive DIV p-loop); allele labelled NaV1.4-plus',
    numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'Xenopus laevis oocytes, cut-open oocyte Vaseline-gap voltage clamp, 22-25 C',
    construct: 'native-cloned-variant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-Kd',
    measured: { value: 50, unit: 'nM', error: { value: 5.2, unit: 'nM', kind: '95% confidence interval' }, n: 13, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte. The same paper measures whole-animal crawl speed separately, and reports no whole-animal fold-shift for any allele.',
    source: 'hague_2018',
    verified_how: 'Read from the re-parsed Table 2 of PMC6121790. The allele label had to be recovered from the PMC HTML because the full-text extraction dropped the superscript.',
    note: 'The whole 1875-residue channel was cloned from a TTX-sensitive Illinois snake, so this is a native snake background, not a mammalian one. The source states 99.7% sequence identity to western snakes over the full protein. Denominator for the two rows below.',
  },
  {
    id: 'hague-2018-NaV1.4-V',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'I1561V (single DIV p-loop substitution); allele labelled NaV1.4-V',
    numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'Xenopus laevis oocytes, cut-open oocyte Vaseline-gap voltage clamp, 22-25 C',
    construct: 'native-cloned-variant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-Kd',
    measured: { value: 65, unit: 'nM', error: { value: 11, unit: 'nM', kind: '95% confidence interval' }, n: 11, censored: null },
    reference_channel: { id: 'hague-2018-NaV1.4-plus', substitution: 'none (ancestral DIV p-loop)', value: 50, unit: 'nM' },
    fold_change_as_the_source_states_it: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte.',
    source: 'hague_2018',
    verified_how: 'Read from the re-parsed Table 2 of PMC6121790. The source describes this as "a small increase in TTX resistance compared to the ancestral wild-type" and gives no fold figure for it, so no fold figure is attributed to the source here.',
    note: 'I1561V is the substitution hague_2017 reports as the FIRST resistant step in both the California and Pacific Northwest lineages, arising independently in each. Its measured effect is a 15 nM shift on a 50 nM channel: the first step of a 260-fold trajectory is barely detectable, and the error bars of the two alleles overlap.',
  },
  {
    id: 'hague-2018-NaV1.4-LVNV',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'four substitutions in the DIV p-loop; allele labelled NaV1.4-LVNV. Two of the four are named in the source text as I1561V and D1568N',
    numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'Xenopus laevis oocytes, cut-open oocyte Vaseline-gap voltage clamp, 22-25 C',
    construct: 'native-cloned-variant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-Kd',
    measured: { value: 13000, unit: 'nM', error: { value: 1800, unit: 'nM', kind: '95% confidence interval' }, n: 11, censored: null },
    reference_channel: { id: 'hague-2018-NaV1.4-plus', substitution: 'none (ancestral DIV p-loop)', value: 50, unit: 'nM' },
    fold_change_as_the_source_states_it: { value: 260, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Results text of hague_2018: "a dramatic 260-fold increase in TTX resistance"' },
    all_four_substitutions: NO_VALUE(
      'The source names two of the four (I1561V and D1568N) in its running text and shows the full DIV p-loop haplotypes only in Figure 1A, which is a raster image. The other two could not be read from any retrieved text.',
      'The full four-residue DIV p-loop haplotype of the allele labelled NaV1.4-LVNV, from the GenBank deposition the source cites or from the figure source data. Until then this row is a measurement of an allele, not of four identified substitutions.'),
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in a host oocyte. The source measures crawl speed in the same animals, and reports it as a velocity with a p-value, never as a fold-shift.',
    source: 'hague_2018',
    verified_how: 'Kd, CI, n read from the re-parsed Table 2 of PMC6121790; the 260-fold figure and the two named substitutions read from the parsed Results text of the same record. 13000/50 = 260 exactly, so the source\'s fold figure is internally consistent with its own table.',
    note: 'The headline number of this case: a 260-fold channel shift carried by a native channel from the animal that evolved it. The same row is also the case\'s best warning, because the same clone shows a 20 mV depolarising shift in activation - see GATING_COSTS. Resistance and excitability moved together.',
  },
  {
    id: 'hague-2018-activation-V-half-plus',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'none (ancestral DIV p-loop); allele labelled NaV1.4-plus', numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'Xenopus laevis oocytes, cut-open oocyte Vaseline-gap voltage clamp, 22-25 C',
    construct: 'native-cloned-variant',
    measurement_level: 'channel-heterologous',
    quantity: 'activation-V-half',
    measured: { value: -36.2, unit: 'mV', error: { value: 1.0, unit: 'mV', kind: '95% confidence interval' }, n: 7, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'A gating voltage, not a toxin dose. A fold-shift of it would not even be dimensionally meaningful.',
    source: 'hague_2018',
    verified_how: 'Read from the re-parsed Table 2 of PMC6121790, fetched over HTTP in this session so that the superscripted allele label survived; the activation V-half column of that table gives -36.2 +/- 1.0 mV at n = 7 for this allele.',
    note: 'Baseline for the gating cost.',
  },
  {
    id: 'hague-2018-activation-V-half-LVNV',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'four DIV p-loop substitutions; allele labelled NaV1.4-LVNV', numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'Xenopus laevis oocytes, cut-open oocyte Vaseline-gap voltage clamp, 22-25 C',
    construct: 'native-cloned-variant',
    measurement_level: 'channel-heterologous',
    quantity: 'activation-V-half',
    measured: { value: -16.4, unit: 'mV', error: { value: 0.5, unit: 'mV', kind: '95% confidence interval' }, n: 7, censored: null },
    reference_channel: { id: 'hague-2018-activation-V-half-plus', substitution: 'none (ancestral DIV p-loop)', value: -36.2, unit: 'mV' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'A gating voltage, not a toxin dose.',
    source: 'hague_2018',
    verified_how: 'Read from the re-parsed Table 2 of PMC6121790; the source describes the same figure in its text as "a large 20 mV shift ... toward more depolarized potentials", consistent with -16.4 against -36.2.',
    note: 'The cost that travels with the 260-fold resistance, in the SAME clone. A design that borrowed the resistance would borrow this.',
  },

  // ---- maruta_2007: a pufferfish pair, mimicked in a rat brain channel -------------------------
  {
    id: 'maruta-2007-F385N',
    channel: 'NaV1.2a', gene: 'SCN2A', domain: 'DI',
    substitution: 'F385N', numbering: 'rNaV1.2a',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'HEK-293 cells, transient expression',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-fold-change-in-Kd',
    measured: { value: 3000, unit: 'fold (dimensionless ratio)', error: null, n: null, censored: null },
    absolute_Kd: NO_VALUE(
      'Only the abstract of maruta_2007 was retrievable; the Kd table is in the article body, behind the publisher paywall. The abstract states fold-changes and not absolute constants.',
      'The absolute TTX Kd in nM for wild-type rNaV1.2a and for each mutant in this paper, from its own table. Without them this row cannot be placed on the same axis as the nM rows above, only compared as a ratio.'),
    reference_channel: { id: 'maruta-2007-rNaV1.2a-wild-type', substitution: 'none (wild type)', value: null, unit: null },
    fold_change_as_the_source_states_it: { value: 3000, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Abstract of maruta_2007: "F385N caused 3000-fold increase of the K(d)"' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in HEK-293 cells.',
    source: 'maruta_2007',
    verified_how: 'Quoted from the structured abstract returned by the PubMed MCP tool for PMID 18067939. The abstract was read in full; no number here comes from anywhere else, and the absolute Kd is recorded null because the abstract does not contain it.',
    note: 'Built to mimic the anomalous non-aromatic Asn-383 of the DI pore loop of the pufferfish Takifugu pardalis channel fNaV1.4a. The natural fish residue is in fNaV1.4a numbering; the measured mutant is in rNaV1.2a numbering; they are not the same number and this file does not equate them.',
  },
  {
    id: 'maruta-2007-G1718T',
    channel: 'NaV1.2a', gene: 'SCN2A', domain: 'DIV',
    substitution: 'G1718T', numbering: 'rNaV1.2a',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'HEK-293 cells, transient expression',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-fold-change-in-Kd',
    measured: { value: 2, unit: 'fold (dimensionless ratio)', error: null, n: null, censored: null },
    absolute_Kd: NO_VALUE(
      'Abstract only; the Kd table is behind the paywall.',
      'Absolute TTX Kd in nM for this mutant and its wild-type parent.'),
    reference_channel: { id: 'maruta-2007-rNaV1.2a-wild-type', substitution: 'none (wild type)', value: null, unit: null },
    fold_change_as_the_source_states_it: { value: 2, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Abstract of maruta_2007: "G1718T ... caused 2- ... fold increase[s] compared with ... WT"' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in HEK-293 cells.',
    source: 'maruta_2007',
    verified_how: 'Quoted from the structured abstract returned by the PubMed MCP tool for PMID 18067939.',
    note: 'Mimics the anomalous Thr-1569 of the DIV pore loop of fNaV1.4a. Alone it is a twofold change: the kind of effect that disappears into between-lab scatter if it is reported as an absolute number by a second lab.',
  },
  {
    id: 'maruta-2007-F385N-G1718T',
    channel: 'NaV1.2a', gene: 'SCN2A', domain: 'DI and DIV',
    substitution: 'F385N + G1718T (double mutant)', numbering: 'rNaV1.2a',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'HEK-293 cells, transient expression',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-fold-change-in-Kd',
    measured: { value: 3, unit: 'fold (dimensionless ratio)', error: null, n: null, censored: null },
    absolute_Kd: NO_VALUE('Abstract only.', 'Absolute TTX Kd in nM for the double mutant.'),
    reference_channel: { id: 'maruta-2007-F385N', substitution: 'F385N', value: 3000, unit: 'fold (dimensionless ratio) relative to wild type' },
    fold_change_as_the_source_states_it: { value: 3, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Abstract of maruta_2007: "F385N/G1718T caused ... 3-fold increase[s] compared with ... F385N"' },
    reference_is_not_wild_type: 'This 3-fold is relative to the F385N SINGLE MUTANT, not to wild type. Chaining it onto the 3000-fold would give about 9000-fold relative to wild type, and that product is a derivation, not a measurement. It is not written anywhere in this file as a measured value.',
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in HEK-293 cells.',
    source: 'maruta_2007',
    verified_how: 'Quoted from the structured abstract returned by the PubMed MCP tool for PMID 18067939.',
    note: 'The one NON-ADDITIVITY measurement in this file that comes from a single lab, a single system and a single paper. G1718T alone is 2-fold; on an F385N background it adds a further 3-fold. The source states it as G1718T "further enhanced TTX resistivity caused by F385N". Whether that is formal epistasis cannot be settled from the fold-changes alone without the absolute constants, so this file calls it non-additivity and not epistasis.',
  },
  {
    id: 'maruta-2007-F385Q',
    channel: 'NaV1.2a', gene: 'SCN2A', domain: 'DI',
    substitution: 'F385Q', numbering: 'rNaV1.2a',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'HEK-293 cells, transient expression',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-fold-change-in-Kd',
    measured: { value: 11, unit: 'fold (dimensionless ratio)', error: null, n: null, censored: null },
    absolute_Kd: NO_VALUE('Abstract only.', 'Absolute TTX Kd in nM for this mutant.'),
    reference_channel: { id: 'maruta-2007-F385N', substitution: 'F385N', value: 3000, unit: 'fold (dimensionless ratio) relative to wild type' },
    fold_change_as_the_source_states_it: { value: 11, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Abstract of maruta_2007: "The K(d) for F385A and F385Q were 2- and 11-fold larger than that of F385N"' },
    reference_is_not_wild_type: 'Relative to F385N, not to wild type.',
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in HEK-293 cells.',
    source: 'maruta_2007',
    verified_how: 'Quoted from the structured abstract returned by the PubMed MCP tool for PMID 18067939.',
    note: 'The source reads its own F385A/F385N/F385Q series as showing that a longer non-aromatic side chain costs more TTX sensitivity. Note that Gln is NOT the residue any species in this file carries naturally: it is a probe, not an analogue.',
  },
  {
    id: 'maruta-2007-F385A',
    channel: 'NaV1.2a', gene: 'SCN2A', domain: 'DI',
    substitution: 'F385A', numbering: 'rNaV1.2a',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'HEK-293 cells, transient expression',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-fold-change-in-Kd',
    measured: { value: 2, unit: 'fold (dimensionless ratio)', error: null, n: null, censored: null },
    absolute_Kd: NO_VALUE('Abstract only.', 'Absolute TTX Kd in nM for this mutant.'),
    reference_channel: { id: 'maruta-2007-F385N', substitution: 'F385N', value: 3000, unit: 'fold (dimensionless ratio) relative to wild type' },
    fold_change_as_the_source_states_it: { value: 2, unit: 'fold (dimensionless ratio)', quantity: 'TTX-fold-change-in-Kd', stated_in: 'Abstract of maruta_2007' },
    reference_is_not_wild_type: 'Relative to F385N, not to wild type.',
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in HEK-293 cells.',
    source: 'maruta_2007',
    verified_how: 'Quoted from the structured abstract returned by the PubMed MCP tool for PMID 18067939.',
    note: 'A probe substitution, not one found in any species named in this file.',
  },
  {
    id: 'maruta-2007-rNaV1.2a-wild-type',
    channel: 'NaV1.2a', gene: 'SCN2A', domain: 'none (unsubstituted)',
    substitution: 'none (wild type)', numbering: 'rNaV1.2a',
    channel_from_species: 'Rattus norvegicus', channel_from_clade: 'mammal',
    expressed_in: 'HEK-293 cells, transient expression',
    construct: 'site-directed-mutant',
    construct_note: 'Unmutated parent of this paper\'s series.',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-Kd',
    measured: NO_VALUE(
      'The absolute wild-type Kd is in the article body of maruta_2007, which was not retrievable. The abstract gives only fold-changes.',
      'Wild-type rNaV1.2a TTX Kd in nM from this paper\'s own table.'),
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Channel-level block in HEK-293 cells.',
    source: 'maruta_2007',
    verified_how: 'Abstract retrieved through the PubMed MCP tool and read in full; it does not contain this number, so the row is a declared null rather than an absent row.',
    note: 'This row exists so that the denominator of every maruta_2007 fold-change is visibly MISSING rather than quietly assumed to be the same as the rNaV1.4 wild type in the rows above. It is a different paralogue in a different cell line.',
  },

  // ---- hanifin_2015: amphibian muscle, not channels --------------------------------------------
  {
    id: 'hanifin-2015-Taricha-granulosa-muscle',
    channel: 'NaV1.4 (the single NaV channel the source reports in salamandrid skeletal muscle)',
    gene: 'salSCN4a / SCN4A', domain: 'DIII and DIV',
    substitution: 'M1116T (DIII), I1424S, D1431S, G1432D (DIV)', numbering: 'salSCN4a',
    channel_from_species: 'Taricha granulosa', channel_from_clade: 'amphibian',
    expressed_in: 'not expressed: recorded in the animal\'s own intact skeletal muscle',
    construct: 'native-tissue',
    measurement_level: 'muscle-fibre',
    quantity: 'AP-block-threshold',
    measured: { value: 300, unit: 'uM', error: null, n: null, censored: 'not-blocked: the source reports that 300 uM TTX had MINIMAL EFFECT on the action potential, so 300 uM is a concentration at which block did NOT occur, not a threshold at which it did' },
    reference_channel: { id: 'hanifin-2015-Ambystoma-mavortium-muscle', substitution: 'none (TTX-sensitive out-group)', value: 0.025, unit: 'uM' },
    per_substitution_effect: NO_VALUE(
      'hanifin_2015 reports a whole-muscle phenotype and a sequence, and does not express or measure any of its four candidate substitutions individually. The effects it quotes for two of the positions are drawn from other papers in other species.',
      'Each of M1116T, I1424S, D1431S and G1432D introduced singly and in combination into a salamandrid NaV1.4 background, expressed, and TTX Kd or IC50 measured. Until then the four substitutions are candidates attached to a phenotype, not four measured effects.'),
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'This is a muscle-fibre recording. The intact animal was not dosed and no whole-animal number is reported.',
    source: 'hanifin_2015',
    verified_how: 'Concentrations and substitution names read from the parsed Results, Discussion and Figure 1 legend of PMC5333673, fetched over HTTP. The four substitution names appear verbatim as "(M1116T in Domain III; I1424S, D1431S, and G1432D in Domain IV)".',
    note: 'A MUSCLE number, deliberately not placed on the same axis as any channel Kd in this file. The source also reports 89.4% amino-acid identity between the NaV1.4 of the TTX-sensitive out-group Ambystoma mavortium and that of Taricha torosa, which is a reminder that the whole channel is conserved and the handful of pore-loop residues are what differ.',
  },
  {
    id: 'hanifin-2015-Ambystoma-mavortium-muscle',
    channel: 'NaV1.4', gene: 'salSCN4a / SCN4A', domain: 'none (TTX-sensitive out-group)',
    substitution: 'none (ancestral at all four candidate positions)', numbering: 'salSCN4a',
    channel_from_species: 'Ambystoma mavortium', channel_from_clade: 'amphibian',
    expressed_in: 'not expressed: recorded in the animal\'s own intact skeletal muscle',
    construct: 'native-tissue',
    measurement_level: 'muscle-fibre',
    quantity: 'AP-block-threshold',
    measured: { value: 0.025, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Muscle-fibre recording.',
    source: 'hanifin_2015',
    verified_how: 'Read from the parsed Figure 1 legend and Results of PMC5333673: action potentials in A. mavortium "were eliminated in submicromolar concentrations of TTX (0.025 uM)".',
    note: 'THE SENSITIVE CONTROL at the muscle level, and the one that makes the Taricha row interpretable at all: 0.025 uM blocks, 300 uM does not, in the same assay in the same paper by the same hands. That is the comparison this whole case needs and almost never gets.',
  },
  {
    id: 'hanifin-2015-Salamandra-salamandra-muscle',
    channel: 'NaV1.4', gene: 'salSCN4a / SCN4A', domain: 'DIV',
    substitution: 'Thr at the position the source numbers I1424 (true salamanders)', numbering: 'salSCN4a',
    channel_from_species: 'Salamandra salamandra', channel_from_clade: 'amphibian',
    expressed_in: 'not expressed: recorded in the animal\'s own intact skeletal muscle',
    construct: 'native-tissue',
    measurement_level: 'muscle-fibre',
    quantity: 'AP-block-threshold',
    measured: { value: 0.050, unit: 'uM', error: null, n: null, censored: null },
    reference_channel: { id: 'hanifin-2015-Ambystoma-mavortium-muscle', substitution: 'none', value: 0.025, unit: 'uM' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Muscle-fibre recording.',
    source: 'hanifin_2015',
    verified_how: 'Read from the parsed Figure 1 legend of PMC5333673: "0.050 uM TTX (dashed line) was required to block APs in the true salamander (S. salamandra)".',
    note: 'An intermediate. Twofold over the sensitive control, in a species that does not bear TTX. The graded series is what lets the source argue exaptation rather than a single origin.',
  },
  {
    id: 'hanifin-2015-Tylototriton-shanjing-muscle',
    channel: 'NaV1.4', gene: 'salSCN4a / SCN4A', domain: 'DIV',
    substitution: 'Ser at the position the source numbers I1424 (primitive and modern newts)', numbering: 'salSCN4a',
    channel_from_species: 'Tylototriton shanjing', channel_from_clade: 'amphibian',
    expressed_in: 'not expressed: recorded in the animal\'s own intact skeletal muscle',
    construct: 'native-tissue',
    measurement_level: 'muscle-fibre',
    quantity: 'AP-block-threshold',
    measured: { value: 0.050, unit: 'uM', error: null, n: null, censored: 'not-blocked: the source reports that 0.050 uM FAILED to block APs in this species, so this is a lower bound' },
    reference_channel: { id: 'hanifin-2015-Ambystoma-mavortium-muscle', substitution: 'none', value: 0.025, unit: 'uM' },
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'Muscle-fibre recording.',
    source: 'hanifin_2015',
    verified_how: 'Read from the parsed Figure 1 legend of PMC5333673: 0.050 uM "failed to block APs in the primitive newt (T. shanjing)".',
    note: 'Same number as the row above, opposite meaning: there 0.050 uM blocked, here it did not. A dataset that stored only the number and the unit would make these two rows identical. That is why `censored` exists on every measurement in this file.',
  },
  {
    id: 'hanifin-2015-salSCN4a-identity',
    channel: 'NaV1.4', gene: 'salSCN4a / SCN4A', domain: 'whole protein',
    substitution: 'none (a sequence comparison, not a substitution)', numbering: 'salSCN4a',
    channel_from_species: 'Ambystoma mavortium compared with Taricha torosa', channel_from_clade: 'amphibian',
    expressed_in: 'not applicable',
    construct: 'no-functional-construct',
    measurement_level: 'sequence-only',
    quantity: 'sequence-identity',
    measured: { value: 89.4, unit: 'percent', error: null, n: null, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'A sequence identity. Nothing was dosed.',
    source: 'hanifin_2015',
    verified_how: 'Read from the parsed Results of PMC5333673: "89.4% sequence identity between NaV1.4 from A. mavortium and T. torosa".',
    note: 'Included because it is the number most likely to be misread as support for a functional claim. 89.4% identity between a sensitive and a resistant lineage says the channels are overwhelmingly the same and tells you nothing about the toxin, which is the whole point of keeping identity off the function axis.',
  },

  // ---- feldman_2010: the whole-animal row ------------------------------------------------------
  {
    id: 'feldman-2010-NaV1.4-variance-explained-T-atratus',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV (the locus, not a single residue)',
    substitution: 'allelic variation at NaV1.4, not a named single substitution', numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis atratus', channel_from_clade: 'squamate reptile',
    expressed_in: 'not expressed: a genotype-phenotype association in wild-caught animals',
    construct: 'no-functional-construct',
    measurement_level: 'whole-animal',
    quantity: 'variance-explained',
    measured: { value: 23, unit: 'percent of phenotypic variance', error: null, n: null, censored: null },
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'The source reports a share of variance, not a fold-shift. A fold-shift would require dosing matched genotypes, which it did not do. This row is the clearest case in the file where the temptation to manufacture a fold-shift exists and is refused.',
    source: 'feldman_2010',
    verified_how: 'Quoted from the abstract returned by the PubMed MCP tool for PMID 20522513: "Allelic variation in Na(v)1.4 explains 23 per cent of the variation in TTX resistance in T. atratus while variation in a haphazard sample of the genome (neutral microsatellite markers) shows no association with the phenotype."',
    note: 'THE NUMBER THAT BREAKS THE CHAIN. Even at a locus the same abstract calls "a major effect locus", genotype at NaV1.4 accounts for 23% of whole-animal variation in one of the two species studied. The other 77% is not in this dataset. Any claim that a 260-fold channel shift predicts a 260-fold animal has to pass through this row first.',
  },
  {
    id: 'feldman-2010-NaV1.4-correlation-T-sirtalis',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV (the locus)',
    substitution: 'allelic variation at NaV1.4', numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'not expressed: a genotype-phenotype association in wild-caught animals',
    construct: 'no-functional-construct',
    measurement_level: 'whole-animal',
    quantity: 'variance-explained',
    measured: NO_VALUE(
      'The retrieved abstract says allelic variation "correlates almost perfectly with TTX resistance in T. sirtalis" but gives no coefficient or variance share for that species, and the article body was not retrieved.',
      'The r-squared or variance share for NaV1.4 genotype against whole-animal TTX resistance in T. sirtalis, from the paper\'s own table.'),
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'No fold-shift is reported and none is inferred.',
    source: 'feldman_2010',
    verified_how: 'Abstract retrieved through the PubMed MCP tool for PMID 20522513 and read in full. "Almost perfectly" is a phrase, not a number, and is not converted into one here.',
    note: 'Recorded as a null rather than dropped, because the shape of the argument matters: 23% in one species and "almost perfectly" in the other is exactly the pattern that gets summarised as "NaV1.4 explains whole-animal resistance".',
  },

  // ---- the second-hand snake rows --------------------------------------------------------------
  {
    id: 'geffeney-2005-I1561-secondhand',
    channel: 'NaV1.4', gene: 'SCN4A', domain: 'DIV',
    substitution: 'I1561V', numbering: 'tsNaV1.4',
    channel_from_species: 'Thamnophis sirtalis', channel_from_clade: 'squamate reptile',
    expressed_in: 'reported as chimaeric mutants; the exact host construct could not be read from a retrieved source',
    construct: 'site-directed-mutant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-fold-change-in-Kd',
    measured: NO_VALUE(
      'geffeney_2005 is in Nature and was not retrievable; its abstract carries no number. The only figures available are second-hand: jost_2008 Table 1 gives "TTX: 2- to 5-fold" for this position citing geffeney_2005, and hanifin_2015 says a substitution at the equivalent residue "roughly doubles the estimated Kd" citing the same paper. Those two second-hand reports do not agree with each other closely enough to be written down as one value.',
      'The TTX Kd in nM for the I1561V variant and its parent, from geffeney_2005 Table 1 or its source data, measured on a non-chimaeric construct. jost_2008 itself says the chimaeric design means "additional experiments on this site in isolation would be needed to confirm this effect".'),
    secondhand_reports: [
      { value: '2 to 5', unit: 'fold (dimensionless ratio)', reported_in: 'jost_2008', citing: 'geffeney_2005', caveat_the_reporter_states: 'the study used chimaeric mutants, so the site was not tested in isolation' },
      { value: 'roughly 2', unit: 'fold (dimensionless ratio)', reported_in: 'hanifin_2015', citing: 'geffeney_2005', caveat_the_reporter_states: 'stated of "the equivalent residue" of snake NaV1.4, which is itself an alignment claim' },
    ],
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'No whole-animal number is involved.',
    source: 'jost_2008',
    primary_source_not_retrieved: 'geffeney_2005',
    verified_how: 'The two second-hand reports were read from the parsed Table 1 and Results of PMC2877999 and from the parsed Discussion of PMC5333673 respectively. geffeney_2005 itself was resolved only to the level of its PubMed abstract, which contains no number; this is recorded in SOURCES.geffeney_2005.verified_how and the primary value is left null.',
    note: 'The independently measured value for this substitution IS in this file, from hague_2018: 65 nM against 50 nM on a native snake background. That is about 1.3-fold, below both second-hand figures. Keep this row and the hague-2018-NaV1.4-V row side by side: they are the same substitution, and the published estimates of its size span 1.3 to 5.',
  },
  {
    id: 'venkatesh-2005-pufferfish-DI-nonaromatic',
    channel: 'NaV1.4a', gene: 'SCN4A (teleost duplicate a)', domain: 'DI',
    substitution: 'aromatic to non-aromatic in the DI pore loop: Asn in Takifugu rubripes, Cys in Tetraodon nigroviridis',
    numbering: 'fNaV1.4a',
    numbering_caveat: 'venkatesh_2005 identifies the residue by domain and by the amino acid present, and the retrieved abstract gives no residue number. The convention is recorded as fNaV1.4a because that is the pufferfish NaV1.4a numbering the adjacent literature uses; no number is asserted under it here.',
    channel_from_species: 'Takifugu rubripes and Tetraodon nigroviridis', channel_from_clade: 'bony fish',
    expressed_in: 'reported as electrophysiological studies; the host system could not be read from the retrieved abstract',
    construct: 'native-cloned-variant',
    measurement_level: 'channel-heterologous',
    quantity: 'TTX-IC50',
    measured: NO_VALUE(
      'Only the abstract of venkatesh_2005 was retrievable. It states that the non-aromatic DI residue "confers TTX resistance" and gives no IC50, Kd or fold-change.',
      'TTX IC50 or Kd in nM for pufferfish NaV1.4a and for the matched zebrafish channel, from venkatesh_2005 or a successor, with the expression system stated.'),
    reference_channel: null,
    whole_animal_fold_shift: null,
    whole_animal_fold_shift_absent_because: 'No whole-animal number is involved.',
    source: 'venkatesh_2005',
    verified_how: 'Abstract retrieved through the PubMed MCP tool for PMID 16303569 and read in full. The row is qualitative because the abstract is qualitative. The closest MEASURED proxy in this file is maruta-2007-F385N, which is a mammalian brain channel mutated to carry Asn at the homologous DI position - a different channel, a different species and a different numbering convention, and therefore a different row.',
    note: 'A functional claim with no number attached, kept in the dataset because its ABSENCE of a number is part of what the retro-validation is scoring. The same source also reports a Glu-to-Asp change in DII of Tetraodon NaV1.4b, likewise without a figure.',
  },
]);

export const SUBSTITUTION_IDS = deepFreeze(SUBSTITUTIONS.map((r) => r.id));

// ====================================================================================================
// SPECIES
// ====================================================================================================
export const SPECIES = deepFreeze([
  {
    id: 'thamnophis-sirtalis', binomial: 'Thamnophis sirtalis', common: 'common garter snake',
    clade: 'squamate reptile', role: 'resistant',
    what_is_known: 'Resistance is largely polymorphism at SCN4A, which encodes NaV1.4. Two phylogenetically distinct lineages, in California and the Pacific Northwest, evolved DIV pore-loop resistance separately; hague_2017 reports that both began with the same I1561V change and that the two I1561V alleles are not identical by descent. mcglothlin_2014 reports that the peripheral-nerve paralogues NaV1.6 and NaV1.7 each carry at least one substitution identical to one previously found in NaV1.4, while NaV1.1-1.3, expressed only in the central nervous system, carry none.',
    measured_rows_here: ['hague-2018-NaV1.4-plus', 'hague-2018-NaV1.4-V', 'hague-2018-NaV1.4-LVNV', 'hague-2018-activation-V-half-plus', 'hague-2018-activation-V-half-LVNV', 'geffeney-2005-I1561-secondhand', 'feldman-2010-NaV1.4-correlation-T-sirtalis'],
    complications: [
      'gendreau_2020 places SCN4A on the Z chromosome in Thamnophis, so apparent departures from Hardy-Weinberg at this locus can be female hemizygosity rather than selection. Allele-frequency arguments at this locus need that correction.',
      'hague_2018 found a crawl-speed cost in the California lineage and NOT in the Pacific Northwest lineage, so the cost is not a property of "TTX resistance" but of a particular allele.',
    ],
    sources: ['hague_2018', 'hague_2017', 'mcglothlin_2014', 'gendreau_2020', 'geffeney_2005'],
    verified_how: 'Every clause above is drawn from an abstract or full text retrieved in this session: PMIDs 30283691, 28370004, 25135948, 32111979, 15815629. No claim is made about this species beyond what those retrieved texts state.',
  },
  {
    id: 'thamnophis-atratus', binomial: 'Thamnophis atratus', common: 'aquatic garter snake',
    clade: 'squamate reptile', role: 'resistant',
    what_is_known: 'Independently evolved TTX resistance through mutations distinct from those in T. sirtalis. feldman_2010 reports that allelic variation at NaV1.4 explains 23% of the variation in whole-animal TTX resistance in this species, while neutral microsatellite variation shows none.',
    measured_rows_here: ['feldman-2010-NaV1.4-variance-explained-T-atratus'],
    complications: ['No cloned-channel measurement for this species appears in any source retrieved here, so its channel-level shift is unknown to this dataset.'],
    sources: ['feldman_2010'],
    verified_how: 'From the abstract of PMID 20522513, retrieved and read in full. The independence of the two species\' mutations is also stated in the abstract of PMID 34254727, retrieved in the same session.',
  },
  {
    id: 'taricha-granulosa', binomial: 'Taricha granulosa', common: 'rough-skinned newt',
    clade: 'amphibian', role: 'resistant',
    what_is_known: 'TTX-bearing, and its skeletal muscle action potential is minimally affected by 300 uM bath TTX. hanifin_2015 identifies four pore-loop substitutions in salSCN4a - M1116T in DIII and I1424S, D1431S, G1432D in DIV - as the likely basis, plus S146N and A151S in the DI P1 helix and N1435I in the DIV P2 helix as additional observed changes of unstated effect.',
    measured_rows_here: ['hanifin-2015-Taricha-granulosa-muscle'],
    complications: [
      'The resistance is measured at the muscle, not at a cloned channel. None of the four candidate substitutions has been expressed and measured individually in any source retrieved here.',
      'hanifin_2015 states that the newt muscle NaV1.4 is 30000-fold more resistant than that of TTX-sensitive vertebrates, but that figure is a ratio across STUDIES - it cites geffeney_2005 and jost_2008 for the comparison - and not a measurement made in one assay. It is recorded in DERIVED_AND_CROSS_STUDY and is not written as a measurement anywhere in SUBSTITUTIONS.',
    ],
    sources: ['hanifin_2015'],
    verified_how: 'From the parsed Results, Discussion and Figure 1 legend of PMC5333673, fetched over HTTP.',
  },
  {
    id: 'taricha-torosa', binomial: 'Taricha torosa', common: 'California newt',
    clade: 'amphibian', role: 'resistant',
    what_is_known: 'salSCN4a sequence was obtained; its NaV1.4 is 89.4% identical in amino-acid sequence to that of the TTX-sensitive out-group Ambystoma mavortium.',
    measured_rows_here: ['hanifin-2015-salSCN4a-identity'],
    complications: ['No TTX block measurement for this species appears in the retrieved text; only the sequence comparison does.'],
    sources: ['hanifin_2015'],
    verified_how: 'From the parsed Results of PMC5333673, fetched over HTTP in this session; the 89.4% identity figure and the list of species from which salSCN4a sequence was obtained were both read from that text.',
  },
  {
    id: 'salamandra-salamandra', binomial: 'Salamandra salamandra', common: 'fire salamander',
    clade: 'amphibian', role: 'intermediate',
    what_is_known: 'Not TTX-bearing, yet its muscle action potentials require 0.050 uM TTX to block against 0.025 uM for the out-group. Carries Thr at the position hanifin_2015 numbers I1424.',
    measured_rows_here: ['hanifin-2015-Salamandra-salamandra-muscle'],
    complications: ['An intermediate phenotype in a lineage with no TTX to resist is the observation hanifin_2015 builds its exaptation argument on; it is also the observation that makes "resistance evolved because of the toxin" harder to assert for the family as a whole.'],
    sources: ['hanifin_2015'],
    verified_how: 'From the parsed Figure 1 legend and Figure 2 legend of PMC5333673, fetched over HTTP in this session; the 0.050 uM block concentration and the Thr residue at the I1424 position were both read from that text.',
  },
  {
    id: 'tylototriton-shanjing', binomial: 'Tylototriton shanjing', common: 'Chinese crocodile newt',
    clade: 'amphibian', role: 'intermediate',
    what_is_known: 'Muscle action potentials were NOT blocked by 0.050 uM TTX. Carries Ser at the position hanifin_2015 numbers I1424, as do modern newts.',
    measured_rows_here: ['hanifin-2015-Tylototriton-shanjing-muscle'],
    complications: ['Its datum is a lower bound, not a threshold.'],
    sources: ['hanifin_2015'],
    verified_how: 'From the parsed Figure 1 legend and Figure 2 legend of PMC5333673, fetched over HTTP in this session; the statement that 0.050 uM "failed to block APs in the primitive newt (T. shanjing)" and the Ser residue at the I1424 position were both read from that text.',
  },
  {
    id: 'takifugu-rubripes', binomial: 'Takifugu rubripes', common: 'fugu',
    clade: 'bony fish', role: 'resistant',
    what_is_known: 'Carries duplicate NaV1.4a and NaV1.4b channels. venkatesh_2005 reports that the non-aromatic Asn in the DI pore loop of NaV1.4a confers TTX resistance, and finds several substitutions in the TTX-binding outer vestibule of both pufferfish channels.',
    measured_rows_here: ['venkatesh-2005-pufferfish-DI-nonaromatic'],
    complications: [
      'The duplicate NaV1.4a / NaV1.4b pair is a one-to-many mapping onto the single NaV1.4 of the other species here. "The NaV1.4 of fugu" does not denote. Which copy carries which part of the job is a question this dataset cannot answer.',
      'No IC50 or Kd for this species could be retrieved.',
    ],
    sources: ['venkatesh_2005', 'jost_2008'],
    verified_how: 'From the abstract of PMID 16303569, read in full, and from the parsed Results of PMC2877999.',
  },
  {
    id: 'tetraodon-nigroviridis', binomial: 'Tetraodon nigroviridis', common: 'green spotted puffer',
    clade: 'bony fish', role: 'resistant',
    what_is_known: 'Carries Cys at the non-aromatic DI position of NaV1.4a, and a Glu-to-Asp change in the DII pore loop of NaV1.4b. jost_2008 notes the DII Glu-to-Asp change as a single occurrence on its tree.',
    measured_rows_here: [],
    complications: [
      'No IC50 or Kd for this species could be retrieved. The DII Glu-to-Asp change has a fold figure in the secondary literature that this file declines to attribute: see REFUSED_VALUES.',
      'Same one-to-many duplicate-channel problem as the species above.',
    ],
    sources: ['venkatesh_2005', 'jost_2008'],
    verified_how: 'From the abstract of PMID 16303569 and the parsed Results of PMC2877999.',
  },
  {
    id: 'takifugu-pardalis', binomial: 'Takifugu pardalis', common: 'panther puffer',
    clade: 'bony fish', role: 'resistant',
    what_is_known: 'maruta_2007 names Asn-383 (DI) and Thr-1569 (DIV) of its skeletal-muscle channel fNaV1.4a as anomalous relative to TTX-sensitive channels, and built its rNaV1.2a mutants F385N and G1718T to mimic them.',
    measured_rows_here: ['maruta-2007-F385N', 'maruta-2007-G1718T', 'maruta-2007-F385N-G1718T'],
    complications: ['Every measured number associated with this species in this file was measured on a RAT BRAIN CHANNEL carrying a mimicking substitution, not on the fish channel. The fish channel\'s own affinity is not in this dataset.'],
    sources: ['maruta_2007'],
    verified_how: 'From the abstract of PMID 18067939, retrieved through the PubMed MCP tool and read in full, which names both residues and attributes them to earlier work by two of its authors.',
  },
  {
    id: 'danio-rerio', binomial: 'Danio rerio', common: 'zebrafish',
    clade: 'bony fish', role: 'sensitive-control',
    what_is_known: 'The TTX-SENSITIVE comparison in venkatesh_2005, carrying the same duplicate NaV1.4a / NaV1.4b architecture as the resistant pufferfishes but aromatic residues in the DI pore loop. jost_2008 separately notes a DIV Ala-to-Gly change in its NaV1.1La paralogue, which is the change measured as A1529G in rat and found to shift TTX about 1.5-fold.',
    measured_rows_here: [],
    complications: [
      'A sensitive control that shares the duplicate-channel architecture is the right control for the pufferfish comparison and the wrong control for the single-channel species: it cannot tell you what one copy would do alone.',
      'No TTX IC50 for this species could be retrieved either, so the sensitive side of the pufferfish comparison is as unquantified here as the resistant side.',
    ],
    sources: ['venkatesh_2005', 'jost_2008'],
    verified_how: 'From the abstract of PMID 16303569 ("the TTX-sensitive zebrafish") and the parsed Results and Table 1 of PMC2877999.',
  },
  {
    id: 'ambystoma-mavortium', binomial: 'Ambystoma mavortium', common: 'barred tiger salamander',
    clade: 'amphibian', role: 'sensitive-control',
    what_is_known: 'The TTX-SENSITIVE out-group in hanifin_2015, and the only sensitive lineage in this file with a MEASURED block threshold: muscle action potentials eliminated at 0.025 uM TTX, in the same assay, same paper and same hands as the resistant rows it is compared against.',
    measured_rows_here: ['hanifin-2015-Ambystoma-mavortium-muscle', 'hanifin-2015-salSCN4a-identity'],
    complications: ['A muscle threshold, so it anchors the muscle rows and not the channel rows. The channel rows\' sensitive anchors are the wild-type rat channels, which are a different clade and a different level.'],
    sources: ['hanifin_2015'],
    verified_how: 'From the parsed Figure 1 legend and Results of PMC5333673, fetched over HTTP in this session; the sentence that APs in A. mavortium "were eliminated in submicromolar concentrations of TTX (0.025 uM)" and the 89.4% identity comparison were both read from that text.',
  },
  {
    id: 'rattus-norvegicus', binomial: 'Rattus norvegicus', common: 'rat',
    clade: 'mammal', role: 'sensitive-control',
    what_is_known: 'The TTX-sensitive background in which most of the quantified substitutions in this file were actually measured: rNaV1.4 in choudhary_2003 and jost_2008, rNaV1.2a in maruta_2007. Wild-type rNaV1.4 TTX IC50 is 48.6 nM in one lab and 0.036 uM in another.',
    measured_rows_here: ['choudhary-2003-rNaV1.4-wild-type', 'jost-2008-rNaV1.4-wild-type-TTX', 'jost-2008-rNaV1.4-wild-type-STX', 'maruta-2007-rNaV1.2a-wild-type'],
    complications: [
      'It is a sensitive control AND the host background for most mutants, which means almost every "effect of substitution X" number in this file is an effect measured in a lineage that never evolved X.',
      'hague_2018 states that gating shifts it saw in the native snake channel "were not observed in past experiments that expressed the same TTX-resistant substitutions in the foreign genetic background of a mammalian NaV1.4 channel". So the host background is not neutral, at least for gating.',
    ],
    sources: ['choudhary_2003', 'jost_2008', 'maruta_2007', 'hague_2018'],
    verified_how: 'From the parsed Table 1 of PMC1302610, the parsed Results of PMC2877999, the abstract of PMID 18067939, and the parsed Discussion of PMC6121790.',
  },
]);

export const SPECIES_IDS = deepFreeze(SPECIES.map((s) => s.id));
export const SPECIES_ROLES = deepFreeze(['resistant', 'intermediate', 'sensitive-control']);

// ====================================================================================================
// CONVERGENCE - the part the analogy module cares about
// ====================================================================================================
// Each set: a position, the lineages that substituted at it, whether the lineages reached the SAME
// residue, what the orthology situation is at the site, and where the measurement for the set actually
// came from. `asserted_by` records WHICH SOURCE claims the positions are equivalent, because that claim
// is an alignment claim and belongs to a paper, not to this file.
export const CONVERGENCE = deepFreeze({
  what_makes_this_the_interesting_part: 'The gene is orthologous across every lineage here: SCN4A is SCN4A. The DERIVED STATE is not. Two lineages that both substituted the DIV aspartate did not inherit that substitution from a common ancestor, and in one case two lineages substituted the same position to DIFFERENT amino acids. So the mapping between a snake substitution and a newt substitution is a functional analogy sitting on top of an orthologous scaffold, which is precisely the configuration an orthology table cannot represent and precisely the configuration a design programme wants to borrow from.',

  sets: [
    {
      id: 'DIV-aspartate',
      position_description: 'The aspartate in the DIV selectivity-filter linker, the residue choudhary_2003 found interacting most strongly with the TTX C-11 hydroxyl.',
      lineages: [
        { clade: 'squamate reptile', species: 'Thamnophis sirtalis', change: 'D1568N, named in hague_2018 as one of the DIV p-loop substitutions and described there as removing a negative charge that interacts with TTX', numbering: 'tsNaV1.4', natural: true },
        { clade: 'amphibian', species: 'Taricha granulosa', change: 'D1431S', numbering: 'salSCN4a', natural: true },
        { clade: 'mammal', species: 'Rattus norvegicus', change: 'D1532A, D1532K, D1532N', numbering: 'rNaV1.4', natural: false, why_listed: 'This is where the position was MEASURED. Three substitutions, three IC50s, one lab, one assay: 7620, 3190 and 1480 nM against 48.6 nM wild type.' },
      ],
      same_residue_reached: false,
      same_residue_note: 'Asn in the snake, Ser in the newt. Same position, different amino acid, different lineage. Positional convergence, not substitution identity.',
      independent_origins: 2,
      independent_origins_counts_only: 'The two natural lineages. The rat substitutions are experimental and are not origins.',
      orthology_at_the_gene: 'one-to-one for the single-channel species here; one-to-many for the pufferfishes, which carry duplicate NaV1.4a and NaV1.4b',
      orthology_at_the_site: 'the ancestral aspartate is shared by descent; the derived state is not shared by descent in any pair of lineages here',
      analogy_class_this_implies: 'convergent-analogue at the level of the substitution, sitting inside a one-to-one orthologous gene pair',
      measured_where: ['choudhary-2003-D1532A', 'choudhary-2003-D1532K', 'choudhary-2003-D1532N', 'hague-2018-NaV1.4-LVNV'],
      asserted_by: 'hanifin_2015 asserts the equivalence of its D1431 to the corresponding snake residue; hague_2018 names D1568N in the snake. No retrieved source states a three-way alignment of D1532, D1568 and D1431 in one place, so this set records three sources\' separate claims and not one alignment.',
      verified_how: 'Substitution names and the three rat IC50 values read from the parsed Table 1 of PMC1302610 and the parsed text of PMC6121790 and PMC5333673, all fetched in this session.',
    },
    {
      id: 'DIV-isoleucine',
      position_description: 'An isoleucine in the DIV pore loop, numbered I1561 in the snake literature after geffeney_2005 and I1424 in the salamandrid literature after hanifin_2015.',
      lineages: [
        { clade: 'squamate reptile', species: 'Thamnophis sirtalis', change: 'Ile to Val (I1561V)', numbering: 'tsNaV1.4', natural: true },
        { clade: 'amphibian', species: 'Taricha granulosa and other modern newts', change: 'Ile to Ser (I1424S); Ile to Thr in true salamanders', numbering: 'salSCN4a', natural: true },
        { clade: 'bony fish', species: 'three pufferfish species in NaV1.6b, and one in NaV1.4a', change: 'Ile to Met, all three times', numbering: 'not stated in a retrieved source for the fish channels', natural: true },
      ],
      same_residue_reached: false,
      same_residue_note: 'Val in the snake, Ser or Thr in the amphibians, Met in the fishes. jost_2008 states this plainly: "In Thamnophis, the change appears as Ile-to-Val; in pufferfishes, it appears all 3 times as Ile-to-Met." Three clades, three different destinations, one position. If a design pipeline matched on substitution identity it would see no analogy here at all.',
      independent_origins: 4,
      independent_origins_counts_only: 'jost_2008 reports at least 2 evolutionarily independent replacements at this residue among the pufferfishes; add the squamate origin and the amphibian origin. The count is a minimum from one tree in one paper, not a settled number.',
      orthology_at_the_gene: 'mixed: NaV1.4 against NaV1.4 for the snake-amphibian pair, but NaV1.6b against NaV1.4 for most of the fish instances - a PARALOGUE comparison, not an orthologue one',
      orthology_at_the_site: 'ancestral Ile shared by descent; derived state independent, and not even the same derived state',
      analogy_class_this_implies: 'convergent-analogue, and for the fish NaV1.6b instances a paralogous-candidate rather than an orthologous comparison at all',
      measured_where: ['hague-2018-NaV1.4-V', 'geffeney-2005-I1561-secondhand'],
      asserted_by: 'jost_2008 asserts the cross-clade identity of the position, citing geffeney_2005 for the snake numbering; hanifin_2015 asserts the equivalence of its I1424 to the snake residue.',
      verified_how: 'Read from the parsed Results and Table 1 of PMC2877999 and the parsed Discussion of PMC5333673.',
      the_awkward_part: 'This is the position whose effect size is least settled in the whole file. hague_2018 measures the snake I1561V allele at 65 nM against 50 nM, about 1.3-fold. jost_2008 reports 2- to 5-fold second-hand from geffeney_2005. hanifin_2015 reports roughly 2-fold from the same paper. The substitution that hague_2017 identifies as the FIRST STEP in two independent escalations has a published effect size spanning 1.3 to 5, and the only measurement made on a native channel is the smallest of them.',
    },
    {
      id: 'DIII-methionine',
      position_description: 'A methionine in the DIII pore loop, numbered M1240 in rat and M1116 in the salamandrid literature.',
      lineages: [
        { clade: 'amphibian', species: 'Taricha granulosa', change: 'M1116T', numbering: 'salSCN4a', natural: true },
        { clade: 'bony fish', species: 'several pufferfish sodium-channel paralogues', change: 'Met to Thr', numbering: 'not stated in a retrieved source', natural: true },
        { clade: 'mammal', species: 'Rattus norvegicus', change: 'M1240T (measured, 15.2-fold) and M1240A (measured, 181 nM against 48.6 nM)', numbering: 'rNaV1.4', natural: false, why_listed: 'Where the position was measured, by two labs with two different substitutions.' },
      ],
      same_residue_reached: true,
      same_residue_note: 'Met to Thr in both natural clades, and Met to Thr is also the substitution jost_2008 chose to measure in rat. This is the one set in this file where positional convergence and substitution identity coincide across clades.',
      independent_origins: 2,
      independent_origins_counts_only: 'The amphibian origin and the pufferfish origin(s). jost_2008 notes that one equally parsimonious optimisation of its tree would imply a minimum of 6 independent Met-Thr replacements among the pufferfishes alone, so even this count is optimisation-dependent.',
      orthology_at_the_gene: 'mixed; the pufferfish instances span several paralogues',
      orthology_at_the_site: 'ancestral Met shared by descent, derived Thr independent',
      analogy_class_this_implies: 'convergent-analogue with substitution identity - the strongest configuration in this file, and still not a licence, because the only measurement of it is in a third clade',
      measured_where: ['jost-2008-M1240T-TTX', 'jost-2008-M1240T-STX', 'choudhary-2003-M1240A'],
      asserted_by: 'jost_2008 asserts the cross-clade identity of the position; hanifin_2015 asserts that its M1116T is the same change and quotes a 15-fold effect for it, citing jost_2008 and others.',
      verified_how: 'Read from the parsed Results and Table 1 of PMC2877999, the parsed Discussion of PMC5333673, and the parsed Table 1 of PMC1302610.',
      the_awkward_part: 'The 15.2-fold figure that hanifin_2015 attaches to the newt M1116T was measured on a rat channel. The newt channel carrying M1116T also carries three other substitutions and has never been expressed. So the number travelling with the amphibian claim was never measured in an amphibian.',
    },
    {
      id: 'DI-aromatic-to-nonaromatic',
      position_description: 'The well-studied aromatic residue (Phe or Tyr) in the DI pore loop, whose replacement by any non-aromatic residue reduces guanidinium-toxin binding.',
      lineages: [
        { clade: 'bony fish', species: 'pufferfishes: Asn in Takifugu rubripes NaV1.4a, Cys in Tetraodon nigroviridis NaV1.4a, Asn-383 in Takifugu pardalis fNaV1.4a', change: 'aromatic to non-aromatic', numbering: 'fNaV1.4a for the T. pardalis residue; not stated for the others', natural: true },
        { clade: 'amphibian', species: 'a Cynops newt channel', change: 'aromatic to non-aromatic', numbering: 'not stated in a retrieved source', natural: true },
        { clade: 'mammal', species: 'three mammalian channel paralogues carry a non-aromatic residue natively', change: 'aromatic to non-aromatic', numbering: 'not stated in a retrieved source', natural: true },
        { clade: 'mammal', species: 'Rattus norvegicus', change: 'F385N, F385A, F385Q in rNaV1.2a (measured as fold-changes); D400A and E403Q in rNaV1.4 are at adjacent DI positions, not this one', numbering: 'rNaV1.2a', natural: false, why_listed: 'Where the position was measured.' },
      ],
      same_residue_reached: false,
      same_residue_note: 'Asn in one pufferfish, Cys in another. The convergence is to a CLASS of residue - non-aromatic - not to a residue.',
      independent_origins: 3,
      independent_origins_counts_only: 'Fishes, amphibians, and the mammalian paralogue cluster, as jost_2008 Table 1 lists them. Within the fishes there may be more.',
      orthology_at_the_gene: 'spans orthologues and paralogues; the three mammalian channels that carry it natively are paralogues of NaV1.4, not orthologues of a fish NaV1.4a',
      orthology_at_the_site: 'ancestral aromatic shared by descent; derived non-aromatic independent, and not the same residue',
      analogy_class_this_implies: 'convergent-analogue to a residue CLASS. Any pipeline that encodes the analogy as a specific amino-acid identity misses it; any pipeline that encodes it as "non-aromatic" has to explain why F385A is 2-fold and F385Q is 11-fold relative to F385N.',
      measured_where: ['maruta-2007-F385N', 'maruta-2007-F385A', 'maruta-2007-F385Q'],
      asserted_by: 'jost_2008 Table 1 lists the position, the clades that carry it, and a fold range; venkatesh_2005 asserts it for the two pufferfish species; maruta_2007 asserts that its F385 mutants model the T. pardalis Asn-383.',
      verified_how: 'Read from the parsed Table 1 and Results of PMC2877999, the abstract of PMID 16303569, and the abstract of PMID 18067939.',
      the_awkward_part: 'jost_2008 states the fold range for this position as "190- to 2,500-fold" in its Results text and as "~190- to 2,000-fold" in its own Table 1. A range whose upper bound differs by 25% between the text and the table of one paper is the range that would be quoted downstream as a single number.',
    },
    {
      id: 'intraspecific-I1561V',
      position_description: 'The same substitution, I1561V, in two lineages of ONE species.',
      lineages: [
        { clade: 'squamate reptile', species: 'Thamnophis sirtalis, California lineage', change: 'I1561V', numbering: 'tsNaV1.4', natural: true },
        { clade: 'squamate reptile', species: 'Thamnophis sirtalis, Pacific Northwest lineage', change: 'I1561V', numbering: 'tsNaV1.4', natural: true },
      ],
      same_residue_reached: true,
      same_residue_note: 'Identical substitution. hague_2017 reports that a NaV1.4 gene tree indicates the two are NOT identical by descent but arose independently.',
      independent_origins: 2,
      independent_origins_counts_only: 'The two lineages, as hague_2017\'s gene tree resolves them.',
      orthology_at_the_gene: 'the same gene in the same species: orthology is not the question here at all',
      orthology_at_the_site: 'identical derived state, independently acquired, so NOT shared by descent despite being indistinguishable by sequence - convergence with zero divergence to hide behind',
      analogy_class_this_implies: 'convergent-analogue inside a single species. The cleanest possible case, and the one that shows why "same gene, same residue, same amino acid" still does not establish shared ancestry of the derived state.',
      measured_where: ['hague-2018-NaV1.4-V'],
      asserted_by: 'hague_2017, in its abstract, in those terms: "A gene tree of Na1.4 suggests the I1561V mutations in each lineage are not identical-by-decent, but rather they arose independently."',
      verified_how: 'Quoted from the abstract of PMID 28370004, retrieved through the PubMed MCP tool and read in full.',
      the_awkward_part: 'The downstream substitutions in the two lineages are NOT the same, and hague_2018 found a crawl-speed cost in one lineage and not the other. Convergence at the first step did not make the two trajectories interchangeable.',
    },
  ],

  the_in_silico_warning: {
    claim: 'Positional convergence has been tested for functional convergence and did not reliably produce it.',
    what_was_found: 'geffeney_2022 docked TTX into homology models of channels from toxin-resistant lineages and found little evidence that amino acids at convergent positions generated similar patterns across lineages, on number of polar contacts, on contact position, or on estimated binding energy. Its stated conclusion is that a simple model in which fewer TTX-channel bonds prevent blocking is not supported, and that models incorporating protein flexibility may describe the effect better.',
    why_it_belongs_here: 'Every set above is positional convergence. This is the one retrieved source that asked whether positional convergence means mechanistic convergence, and its answer was mostly no. A convergence dataset that did not carry this would be selling the premise it has not established.',
    source: 'geffeney_2022',
    verified_how: 'Read from the abstract of PMID 36422001, retrieved through the PubMed MCP tool. Only the abstract was used and no docking number is quoted from it.',
  },

  not_a_count_of_convergences: 'The independent_origins numbers above are minima from particular trees in particular papers, read off those papers. They are not a census and summing them would not mean anything.',
});

// ====================================================================================================
// DERIVED NUMBERS - computed here, attributed to nobody
// ====================================================================================================
const byId = Object.fromEntries(SUBSTITUTIONS.map((r) => [r.id, r]));

export const foldOf = (rowId) => {
  const r = byId[rowId];
  if (!r || !r.reference_channel || typeof r.measured?.value !== 'number' || typeof r.reference_channel.value !== 'number') return null;
  if (r.measured.unit !== r.reference_channel.unit) return null;
  return {
    row: rowId,
    fold: r.measured.value / r.reference_channel.value,
    unit: 'fold (dimensionless ratio)',
    numerator: { value: r.measured.value, unit: r.measured.unit, censored: r.measured.censored ?? null },
    denominator: { value: r.reference_channel.value, unit: r.reference_channel.unit, row: r.reference_channel.id },
    derived_by: 'Derived here in ttx.mjs, as measured.value / reference_channel.value. NOT a value any source states. If the numerator is censored this ratio is a bound, not a ratio.',
    is_a_bound: r.measured.censored !== null && r.measured.censored !== undefined,
  };
};

export const DERIVED_AND_CROSS_STUDY = deepFreeze({
  what_this_block_is: 'Numbers that are arithmetic on other people\'s numbers. They are kept apart from SUBSTITUTIONS so that no derived figure can be read as a measurement, and every one of them carries derived_by instead of a citation.',
  between_lab_wild_type: {
    derived_by: 'ttx.mjs: choudhary_2003 wild-type rNaV1.4 TTX IC50 48.6 nM divided by jost_2008 wild-type rNaV1.4 TTX IC50 0.036 uM = 36 nM.',
    ratio: 48.6 / 36,
    unit: 'fold (dimensionless ratio)',
    what_it_means: 'About 1.35x. Two labs, nominally the same rat channel, nominally the same host cell, two values. Every cross-paper fold-change in this file sits on top of this.',
    what_it_does_not_mean: 'It is not an error bar and it is not a correction factor. Two numbers do not give a distribution.',
  },
  newt_30000_fold: {
    the_claim: 'hanifin_2015 states that the NaV1.4 of TTX-bearing newts is 30000-fold more resistant to TTX than NaV1.4 from TTX-sensitive vertebrates.',
    what_kind_of_number_it_is: 'A CROSS-STUDY RATIO. hanifin_2015 cites geffeney_2005 and jost_2008 for the comparison; it is not a ratio of two measurements made in one assay by one pair of hands.',
    why_it_is_not_in_SUBSTITUTIONS: 'Because it would then be indistinguishable from the 260-fold figure, which IS a ratio of two rows of one table in one paper. Those are different kinds of number and this file keeps them in different places.',
    source_of_the_claim: 'hanifin_2015',
    verified_how: 'Quoted from the parsed Discussion of PMC5333673.',
  },
  maruta_chain_not_computed: {
    the_temptation: 'maruta_2007 gives F385N as 3000-fold over wild type and F385N/G1718T as 3-fold over F385N. Multiplying gives about 9000-fold over wild type.',
    why_it_is_not_written_anywhere: 'Because the product of two fold-changes from an abstract, with no absolute constants and no error bars, is not a measurement of anything. It is recorded here as a derivation that was declined, so that nobody has to wonder whether it was overlooked.',
  },
});

// ====================================================================================================
// DISCREPANCIES - found by retrieving both sources, not asserted
// ====================================================================================================
export const DISCREPANCIES = deepFreeze({
  what_this_block_is: 'Places where two retrieved sources, or one source and itself, do not agree. Each was found by reading both, in this session. None is a correction of anybody: the primary table is quoted and the secondary report is quoted and the reader is left holding both.',

  between_lab_wild_type: {
    sources: ['choudhary_2003', 'jost_2008'],
    the_disagreement: 'Wild-type rat NaV1.4, TTX IC50, Xenopus oocytes, voltage clamp: 48.6 +/- 4.3 nM (n=6) in choudhary_2003 Table 1; 0.036 uM, i.e. 36 nM, in jost_2008 Results.',
    size: 'about 1.35x',
    why_it_matters_more_than_it_looks: 'Several substitutions in this file have effects of 1.5-fold to 2-fold. Those are the same size as the disagreement between two labs about the unmutated channel. A 1.5-fold result from lab A and a 2-fold result from lab B cannot be ordered.',
    what_it_does_not_mean: 'It is not an error bar and it is not a correction factor to be applied. Two numbers do not give a distribution, and nothing here licenses rescaling one lab\'s values onto the other\'s.',
    verified_how: 'Both values read in this session: the first from the parsed Table 1 of PMC1302610, the second from the parsed Results text of PMC2877999.',
  },

  asp_to_asn_fold_attribution: {
    sources: ['jost_2008', 'choudhary_2003'],
    the_disagreement: 'jost_2008 Table 1 lists the DIV Asp-to-Asn change as conferring "TTX: ~300-fold" and cites choudhary_2003 for the figure. choudhary_2003 Table 1 reports TTX IC50 of 1480 +/- 185 nM for D1532N against 48.6 +/- 4.3 nM wild type. That is about 30-fold, not about 300-fold. The other two substitutions choudhary_2003 measured at the same position give about 157-fold (D1532A, 7620 nM) and about 66-fold (D1532K, 3190 nM): none of the three is near 300-fold.',
    what_this_file_does_about_it: 'Reports the primary table and declines to carry the ~300-fold figure as a measurement. The ~300-fold is recorded in REFUSED_VALUES.',
    what_would_resolve_it: 'Identifying which measurement the ~300-fold actually came from. It may be in a source neither retrieved here nor cited in that Table 1 row; the arithmetic from choudhary_2003\'s own table does not produce it.',
    why_it_matters: 'The ~300-fold figure then travels: hanifin_2015 states that the charge-neutralising D1431 replacement in modern newts yields a "300-fold" increase in NaV1.4 resistance to TTX, citing a chain that includes jost_2008. A number that cannot be traced to a measurement has been attached to an amphibian substitution that has never been expressed.',
    all_three_folds_derived_by: 'ttx.mjs, from choudhary_2003 Table 1: 1480/48.6, 7620/48.6 and 3190/48.6.',
    verified_how: 'jost_2008 Table 1 row and citation key read from the parsed HTML of PMC2877999; the three D1532 IC50 values read from the parsed Table 1 of PMC1302610; the hanifin_2015 sentence read from the parsed Discussion of PMC5333673. All three in this session.',
  },

  thr_fold_attribution: {
    sources: ['jost_2008', 'choudhary_2003'],
    the_disagreement: 'jost_2008 states that "Choudhary et al. (2003) showed that other mutations at this Thr (to Ile, Asp, or Lys) can increase TTX resistance up to 2,000-fold". In choudhary_2003 Table 1 the three named substitutions are T759I at 89.7 nM, T759K at 104.0 nM and T759D at 387.0 nM, which against 48.6 nM wild type are about 1.8-fold, 2.1-fold and 8.0-fold. The row that exceeds 2000-fold is T759A at >100,000 nM - an ALANINE substitution, which is not Ile, Asp or Lys, and a censored lower bound rather than a measurement.',
    what_this_file_does_about_it: 'The four T759 rows are recorded individually with their own values and their own censoring flags. The "up to 2,000-fold" summary is not carried.',
    why_it_matters: 'This is the generic failure of a comparative table: a list of substitutions and a single range, where the range came from a substitution not on the list. Nothing is wrong with either paper\'s own data.',
    folds_derived_by: 'ttx.mjs, from choudhary_2003 Table 1: 89.7/48.6, 104.0/48.6, 387.0/48.6 and 100000/48.6.',
    verified_how: 'The jost_2008 sentence read from the parsed Results of PMC2877999; the four T759 values read from the parsed Table 1 of PMC1302610.',
  },

  jost_internal_range: {
    sources: ['jost_2008'],
    the_disagreement: 'For the DI aromatic-to-nonaromatic position, the Results text of jost_2008 says "190- to 2,500-fold" and its own Table 1 says "~190- to 2,000-fold".',
    what_this_file_does_about_it: 'Both are recorded, in CONVERGENCE.sets[DI-aromatic-to-nonaromatic].the_awkward_part, as what the paper says in each place. Neither is adopted.',
    verified_how: 'Both strings read from the parsed HTML of PMC2877999 in this session.',
  },

  background_dependence: {
    sources: ['hague_2018', 'hanifin_2015'],
    the_disagreement: 'hanifin_2015 reports, citing geffeney_2005, that substitutions at I1424 had additive effects when combined with substitutions at D1431 and that those effects "are also not dependent on the genetic background in which they occur", and separately that site-directed mutagenesis has shown epistatic interactions between pore-loop mutations and other channel regions do not affect TTX binding. hague_2018, having cloned the whole native snake channel precisely to avoid a foreign background, reports gating shifts that "were not observed in past experiments that expressed the same TTX-resistant substitutions in the foreign genetic background of a mammalian NaV1.4 channel", and says in its own limitations that the four DIV substitutions "might have different functional consequences depending on their genetic background".',
    is_it_a_contradiction: 'Not exactly, and that is the point. The first claim is about TTX BINDING; the second is about GATING. A substitution can be background-independent for affinity and background-dependent for excitability, and a dataset that stored one number per substitution could not represent that.',
    what_this_file_does_about_it: 'Records both, keeps affinity and gating as different quantities with different units, and does not assert that epistasis among the pore-loop substitutions has been demonstrated for TTX binding. The one measured non-additivity in this file is maruta_2007\'s G1718T on an F385N background, within one paper and one system.',
    verified_how: 'The hanifin_2015 sentences read from the parsed Discussion of PMC5333673; the hague_2018 sentences read from the parsed Results and Discussion of PMC6121790.',
  },
});

// ====================================================================================================
// REFUSED VALUES - numbers declined, and what it would take
// ====================================================================================================
export const REFUSED_VALUES = deepFreeze([
  {
    value_refused: 'The absolute TTX Kd in nM for wild-type rNaV1.2a and for the F385N, F385A, F385Q, G1718T and F385N/G1718T mutants.',
    source_it_would_come_from: 'maruta_2007',
    null_reason: 'Only the abstract was retrievable through the PubMed MCP tool; the Kd table is in the paywalled article body. The abstract gives fold-changes only, and two of those fold-changes are relative to a mutant rather than to wild type.',
    what_would_have_to_be_measured: 'Nothing new: the numbers exist. The article body has to be obtained. Until then every maruta_2007 row in this file is a ratio with a missing denominator.',
  },
  {
    value_refused: 'Any TTX affinity figure for the Thamnophis sirtalis NaV1.4 variants as geffeney_2005 measured them.',
    source_it_would_come_from: 'geffeney_2005',
    null_reason: 'The paper is in Nature and was not retrievable; its PubMed abstract contains no numeric affinity. Two later papers report figures from it second-hand and the two reports do not agree closely (2- to 5-fold against roughly 2-fold).',
    what_would_have_to_be_measured: 'The article body, or better, the site measured in isolation rather than in a chimaera - jost_2008 says in as many words that the chimaeric design means additional experiments on this site alone would be needed to confirm the effect.',
  },
  {
    value_refused: 'The ~300-fold TTX resistance attributed to the DIV Asp-to-Asn change.',
    source_it_would_come_from: 'cited by jost_2008 to choudhary_2003, and carried forward by hanifin_2015',
    null_reason: 'It cannot be reproduced from choudhary_2003 Table 1, whose three D1532 substitutions give about 30-, 66- and 157-fold against the same paper\'s wild type. See DISCREPANCIES.asp_to_asn_fold_attribution.',
    what_would_have_to_be_measured: 'Either the source of the ~300-fold has to be located, or the Asp-to-Asn change has to be measured again in a stated background with a stated wild-type reference.',
  },
  {
    value_refused: 'A TTX IC50 or Kd for any pufferfish channel, resistant or sensitive, including the Danio rerio sensitive control.',
    source_it_would_come_from: 'venkatesh_2005, or a successor',
    null_reason: 'Only the abstract of venkatesh_2005 was retrievable and it is qualitative. jost_2008 measured the relevant substitutions in a RAT channel, not in a fish channel, so its numbers are not fish numbers.',
    what_would_have_to_be_measured: 'Pufferfish NaV1.4a and NaV1.4b, and the matched Danio rerio channels, expressed in one system by one lab, with TTX IC50 and the duplicate copies measured separately so the one-to-many mapping is not averaged away.',
  },
  {
    value_refused: 'A per-substitution effect size for any of M1116T, I1424S, D1431S or G1432D in an amphibian channel.',
    source_it_would_come_from: 'hanifin_2015 identifies them; no retrieved source measures them.',
    null_reason: 'hanifin_2015 reports a whole-muscle phenotype and a sequence. None of the four substitutions has been expressed individually in a salamandrid background in any source retrieved here. The effect sizes it quotes for two of the positions were measured in other species.',
    what_would_have_to_be_measured: 'The four substitutions introduced singly and in combination into a salamandrid NaV1.4 background, expressed, and TTX Kd measured - which would also be the first test of whether they are additive in the lineage that actually carries them.',
  },
  {
    value_refused: 'An r-squared or variance share for NaV1.4 genotype against whole-animal TTX resistance in Thamnophis sirtalis.',
    source_it_would_come_from: 'feldman_2010',
    null_reason: 'The retrieved abstract says the correlation is "almost perfect" and gives no coefficient. "Almost perfectly" is not converted into a number here.',
    what_would_have_to_be_measured: 'Nothing new; the article body has to be read.',
  },
]);

// ====================================================================================================
// WHY THIS IS A GOOD TEST
// ====================================================================================================
export const WHY_THIS_IS_A_GOOD_TEST = deepFreeze({
  headline: 'A small number of named substitutions, measured as doses with units, reached independently by squamates, amphibians and fishes, with a sensitive control measured in the same assay.',
  reasons: [
    'IT HAS A NUMBER WITH A UNIT, AND MORE THAN ONE OF THEM. A prediction can be scored against 7620 nM or against 13000 nM. It cannot be scored against "resistant". This case has 30 measured values across four quantities, each with the unit the source reported.',
    'THE SENSITIVE CONTROL IS MEASURED IN THE SAME ASSAY. hanifin_2015 blocks Ambystoma mavortium muscle at 0.025 uM and fails to block Taricha granulosa muscle at 300 uM, in one paper, one assay, one pair of hands. Almost no comparative case has its negative control measured alongside its positive.',
    'THE SUBSTITUTIONS ARE FEW AND NAMED. Four in the snake DIV p-loop, four in the newt pore loop, two in the pufferfish mimic. This is not a polygenic trait that can absorb any prediction.',
    'THE CONVERGENCE IS REAL AND SOMETIMES IMPERFECT, WHICH IS BETTER. Three clades substituted the same DIV isoleucine and reached Val, Ser and Met. A pipeline that matches on amino-acid identity fails here and a pipeline that matches on position succeeds, so the case discriminates between two things that usually score the same.',
    'THERE IS A CASE OF CONVERGENCE WITH ZERO SEQUENCE DIVERGENCE TO HIDE BEHIND. hague_2017 reports that the two Thamnophis sirtalis lineages acquired the identical I1561V independently. Same species, same gene, same residue, same amino acid, separate origin. Nothing about the sequence distinguishes the two, which makes it a clean test of whether a method is inferring ancestry or inferring function.',
    'BOTH SIDES OF ONE SUBSTITUTION WERE MEASURED, IN DIFFERENT BACKGROUNDS. I1561V has a measurement on a native snake channel (hague_2018, about 1.3-fold) and second-hand figures from a chimaeric construct (2- to 5-fold). A retro-validation can ask which one a method would have predicted.',
    'THE COST IS MEASURED IN THE SAME CLONE AS THE BENEFIT. The 260-fold allele shows a 20 mV depolarising shift in activation and the animals carrying it crawl more slowly. A design proposal that borrowed the resistance would inherit the shift, and this case can say so with numbers rather than in principle.',
    'IT IS AN ARMS RACE, SO THE SAME TOXIN IS ON BOTH SIDES. Prey resistance and predator resistance are measured against one molecule, which removes the usual confound that two lineages were solving slightly different problems.',
  ],
});

// ====================================================================================================
// WHY IT MIGHT NOT BE
// ====================================================================================================
export const WHY_IT_MIGHT_NOT_BE = deepFreeze({
  headline: 'The fold-shifts come from different labs, different expression systems, different channel paralogues and different levels of biological organisation, and the whole-animal phenotype is demonstrably not the sum of the channel-level ones.',
  reasons: [
    {
      id: 'cross-lab-and-cross-system-incomparability',
      the_problem: 'Fold-shifts in this file were measured in Xenopus oocytes under two-electrode voltage clamp (choudhary_2003), in Xenopus oocytes under dose-response voltage clamp (jost_2008), in Xenopus oocytes under cut-open Vaseline-gap clamp at 22-25 C (hague_2018), and in HEK-293 cells (maruta_2007). Two of those report IC50 and two report Kd. Error bars are SEM in one and a 95% confidence interval in another. Some rows have no error bar and no n at all.',
      the_measured_size_of_it: 'Wild-type rat NaV1.4 TTX IC50 is 48.6 nM in one lab and 36 nM in another. About 1.35x, for the unmutated channel.',
      what_it_rules_out: 'It rules out ordering any two substitutions whose reported effects differ by less than about 2-fold when the two numbers come from different papers: those pairs cannot be ordered at all. A substantial fraction of the rows above fall into that category.',
      what_would_fix_it: 'One lab, one system, one toxin lot, one reference channel, all the substitutions. Nothing short of that.',
    },
    {
      id: 'non-additivity-and-the-background',
      the_problem: 'The retrieved literature does not agree about whether the pore-loop substitutions act independently. hanifin_2015, citing geffeney_2005, reports additivity for TTX binding and background-independence. maruta_2007 reports that G1718T is 2-fold alone and adds a further 3-fold on an F385N background, which is non-additive on its face. hague_2018 cloned a whole native snake channel precisely because it doubted the mammalian background, and then saw gating shifts that the mammalian-background experiments had not.',
      what_it_rules_out: 'Summing per-substitution fold-shifts to predict a multi-substitution allele. The 260-fold NaV1.4-LVNV allele carries four substitutions; no retrieved source gives four effects whose product is 260-fold, and the one that would have to be largest (D1568N) has no traceable measurement at all.',
      what_would_fix_it: 'A full combinatorial series in the native background: all four single substitutions, the pairs, and the quadruple, in the snake channel, in one assay.',
      note: 'This file says NON-ADDITIVITY and not EPISTASIS, because the maruta_2007 fold-changes alone cannot distinguish a non-additive ratio from a reparameterisation, and the absolute constants needed to settle it were not retrievable.',
    },
    {
      id: 'levels-are-not-rungs-on-one-ladder',
      the_problem: 'Channel block, muscle action-potential block, and whole-animal resistance are three quantities with three units, and this file holds all three. feldman_2010 reports that allelic variation at NaV1.4 explains 23% of whole-animal TTX-resistance variation in Thamnophis atratus - at a locus the same abstract calls a major-effect locus. mcglothlin_2014 reports resistance substitutions in NaV1.6 and NaV1.7 as well, so NaV1.4 is not the only resistant channel in the animal. hague_2018 says plainly that pore mutations in NaV1.4 "are not the sole determinant of whole-animal TTX resistance".',
      what_it_rules_out: 'Reading the 260-fold channel shift as a 260-fold animal. No row in this file carries a whole-animal fold-shift, and that is a deliberate structural property, enforced by a test: a row at channel level has whole_animal_fold_shift set to null and a stated reason.',
      what_would_fix_it: 'Whole-animal dose-response in animals of known genotype, alongside cloned-channel measurement of the same alleles, in the same study. hague_2018 says itself that establishing the mechanistic link "would require direct recordings from muscle fibers of snakes with known genotypes", which it did not do.',
    },
    {
      id: 'positional-convergence-may-not-be-mechanistic-convergence',
      the_problem: 'geffeney_2022 tested exactly the premise this case rests on - that positionally convergent substitutions produce convergent TTX-channel interactions - and found little evidence for it across polar-contact count, contact position and estimated binding energy.',
      what_it_rules_out: 'Treating "the newt substituted the same position" as evidence that the newt channel works the way the snake channel works. The functional outcome may converge while the mechanism does not.',
      what_would_fix_it: 'Structures, or at least a mutant-cycle analysis of the same positions in two lineages\' own channels.',
    },
    {
      id: 'the-measured-and-the-natural-are-mostly-different-channels',
      the_problem: 'Most quantified rows here are substitutions measured in rat channels: rNaV1.4 in choudhary_2003 and jost_2008, rNaV1.2a in maruta_2007. The natural carriers - pufferfishes, newts - have almost no measured channel affinity in this dataset at all. The only native-background measurements are the three snake alleles of hague_2018.',
      what_it_rules_out: 'Saying that a pufferfish channel is N-fold resistant, for any N. It rules out, in particular, the comparison the case most invites: pufferfish against newt against snake, at the channel level, on one axis.',
      what_would_fix_it: 'Clone and measure the native channels. For the pufferfishes that means measuring NaV1.4a and NaV1.4b SEPARATELY, because the duplicate pair is a one-to-many mapping and averaging it would destroy the only thing worth knowing about it.',
    },
    {
      id: 'the-secondary-literature-has-drifted',
      the_problem: 'Three separate numbers quoted in review-style tables could not be reproduced from the primary tables they cite: a ~300-fold for the DIV Asp-to-Asn change, an "up to 2,000-fold" for Thr substitutions that in fact belongs to an Alanine substitution, and a DI range stated as 2,500-fold in one paper\'s text and 2,000-fold in its own table. See DISCREPANCIES.',
      what_it_rules_out: 'Building a retro-validation target out of review tables. Every number in this file was taken from the paper that measured it, or declared null.',
      what_would_fix_it: 'Nothing, for this case. It is a standing property of the literature and the reason verified_how exists on every row.',
    },
    {
      id: 'censoring-and-missing-error-bars',
      the_problem: 'Five rows are greater-than or did-not-block values rather than point estimates. Two rows share the number 0.050 uM with opposite meanings: in one species 0.050 uM blocked the action potential and in another it failed to. Several rows have no error bar and no n because their source gives none.',
      what_it_rules_out: 'Any analysis that reads measured.value without reading measured.censored. A dataset that stored value and unit alone would silently equate the two 0.050 uM rows.',
      what_would_fix_it: 'Higher toxin concentrations for the censored rows, and reporting n and a dispersion estimate for every value.',
    },
    {
      id: 'selection-on-what-got-measured',
      the_problem: 'The substitutions with measurements are the ones somebody thought worth mutating. The substitutions in natural resistant channels with NO measurement - D1568N in the snake, all four amphibian candidates, every pufferfish residue - are missing not at random: they are missing because they sit in channels nobody has expressed.',
      what_it_rules_out: 'Treating the measured rows as a sample of pore-loop substitutions. They are a sample of experimenters\' attention.',
      what_would_fix_it: 'Deep mutational scanning of the pore loops, which would also settle the non-additivity question.',
    },
  ],
});

// ====================================================================================================
// GATING COSTS - because the benefit and the cost are in the same clone
// ====================================================================================================
export const GATING_COSTS = deepFreeze({
  why_this_is_here: 'A design programme that borrows TTX resistance borrows whatever else the substitutions do. In this case the cost is measured in the same clone as the benefit, which is unusual enough to be worth its own block.',
  measured: [
    { what: 'voltage dependence of activation, V-half', ancestral: { value: -36.2, unit: 'mV' }, resistant_LVNV: { value: -16.4, unit: 'mV' }, shift: { value: 19.8, unit: 'mV', direction: 'depolarising', derived_by: 'ttx.mjs, difference of the two Table 2 values; hague_2018 describes the same shift in its text as "a large 20 mV shift"' }, source: 'hague_2018' },
    { what: 'voltage dependence of fast inactivation, V-half', ancestral: { value: -56.6, unit: 'mV' }, resistant_LVNV: { value: -54.7, unit: 'mV' }, single_substitution_V: { value: -49.2, unit: 'mV' }, note: 'The single-substitution allele shifted fast inactivation by about 7 mV and the four-substitution allele barely at all. The two alleles do not lie on one trajectory for this quantity.', source: 'hague_2018' },
  ],
  whole_animal_consequence: {
    what_was_measured: 'Crawl speed of neonate snakes on a 4 m racetrack, as a function of DIV p-loop genotype, in two lineages analysed separately.',
    california: 'DIV genotype accounted for significant variance in crawl speed: Wald chi-squared 6.09, p = 0.014. Animals homozygous for the highly resistant allele crawled more slowly than those with the ancestral channel.',
    pacific_northwest: 'No significant relationship: Wald chi-squared 0.16, p = 0.924. Body mass was the only significant fixed effect.',
    unit: 'the test statistic is a Wald chi-squared with one degree of freedom; crawl speed itself is in m/s',
    fold_shift: null,
    fold_shift_absent_because: 'The source reports least-squares mean velocities and test statistics, never a fold-shift, and this file does not manufacture one.',
    what_it_does_not_show: 'A fitness cost. hague_2018 is explicit that the mechanistic link between channel function and locomotor performance "still remains untested" and that compensatory changes in muscle cells could ameliorate the reduced excitability.',
    source: 'hague_2018',
  },
  verified_how: 'V-half values, n and the two Wald statistics with their p-values read from the re-parsed Table 2 and Table 1 of PMC6121790 and from the parsed Results text of the same record.',
  the_asymmetry_worth_noticing: 'The cost appeared in the lineage with four substitutions and not in the lineage with one. So the cost is not a cost of resistance; it is a cost of a particular allele at a particular point on a particular trajectory. A design that took the first substitution only might take the benefit without the cost - and would take about 1.3-fold of benefit.',
});

// ====================================================================================================
// PER-AXIS VERDICT - no fused score anywhere
// ====================================================================================================
export const AXES = deepFreeze({
  'quantitative-target-exists': { asks: 'Is there a number with a unit that a prediction could have missed?' },
  'sensitive-control-in-the-same-assay': { asks: 'Was the unresisted baseline measured by the same hands in the same assay as the resisted case?' },
  'convergence-is-independent': { asks: 'Did the lineages reach the state separately, and does a retrieved source say so?' },
  'cross-study-commensurability': { asks: 'Can the numbers be placed on one axis?' },
  'level-discipline': { asks: 'Are channel, muscle and animal kept apart, with no fold-shift laundered across levels?' },
  'per-substitution-attribution': { asks: 'Is the effect of each individual substitution measured, rather than inferred from an allele that carries several?' },
  'mechanistic-convergence': { asks: 'Is there evidence that the convergent positions work the same way, not merely that they are the same positions?' },
});

export const AXIS_IDS = deepFreeze(Object.keys(AXES));

export const VERDICT_VOCABULARY = deepFreeze(['strong', 'adequate', 'weak', 'absent', 'contradicted']);

export const WHY_NOT_ONE_NUMBER = deepFreeze({
  headline: 'Seven axes, several of them pulling opposite ways, cannot be averaged into a retro-validatability score without a weighting that nobody can defend, and the weighting becomes invisible at the first function call.',
  the_argument: [
    'Two of the axes here are strong and two are absent. A mean of those is a number that describes no state of affairs.',
    'A single float gets read as a probability downstream, and there is no reference class for it to be a probability over.',
    'The weighting that produces the float is a modelling choice made by whoever wrote the weighting, and it stops being visible the moment the float is returned.',
    'The useful output of this file is WHICH axis is absent, because that is what names the next experiment. A score erases exactly that.',
  ],
});

const BANDS = deepFreeze({ strong: [0.70, 0.88], adequate: [0.50, 0.70], weak: [0.25, 0.48], absent: [0.03, 0.18], contradicted: [0.01, 0.12] });

export const retroValidationVerdict = () => {
  const axes = {
    'quantitative-target-exists': {
      verdict: 'strong',
      because: '30 measured values across TTX-IC50, TTX-Kd, STX-IC50, activation and fast-inactivation V-half, AP block threshold, variance explained and sequence identity, each with the unit its source reported. The headline target is 13000 +/- 1800 nM against 50 +/- 5.2 nM on a native snake channel.',
      what_would_raise_it: 'Nothing; it is as high as this axis goes.',
    },
    'sensitive-control-in-the-same-assay': {
      verdict: 'adequate',
      because: 'At the muscle level, yes and cleanly: 0.025 uM blocks Ambystoma mavortium and 300 uM fails to block Taricha granulosa, in one paper. At the channel level the sensitive anchors are wild-type rat channels, which are a different clade from every resistant lineage here, and the designated sensitive fish control has no retrievable number at all.',
      what_would_raise_it: 'A TTX IC50 for the Danio rerio channels measured alongside the pufferfish channels in one system.',
    },
    'convergence-is-independent': {
      verdict: 'strong',
      because: 'Five convergence sets, each with a retrieved source asserting independence. The strongest is intraspecific: hague_2017 states that the identical I1561V in the two Thamnophis sirtalis lineages is not identical by descent.',
      what_would_raise_it: 'Nothing; it is as high as this axis goes.',
    },
    'cross-study-commensurability': {
      verdict: 'weak',
      because: 'Four expression systems, two estimands (IC50 and Kd), two kinds of error bar, several rows with none, and a measured 1.35x disagreement between two labs about the unmutated rat channel. Substitution effects of 1.5- to 2-fold are the same size as that disagreement.',
      what_would_raise_it: 'One lab, one system, one reference channel, all the substitutions.',
    },
    'level-discipline': {
      verdict: 'adequate',
      because: 'This file enforces it: every row declares its level, and no row carries a whole-animal fold-shift. But the discipline is imposed here, not supplied by the literature - the 30000-fold figure and the ~300-fold figure both travel across levels and studies in the sources themselves.',
      what_would_raise_it: 'A study that measures cloned channel, muscle fibre and whole animal on the same genotypes. hague_2018 names that study and says it did not do it.',
    },
    'per-substitution-attribution': {
      verdict: 'weak',
      because: 'The 260-fold allele carries four substitutions and only two of them are even named in the retrieved text. None of the four amphibian candidates has been expressed individually. The one substitution with a native-background measurement, I1561V, has published effect sizes spanning 1.3 to 5.',
      what_would_raise_it: 'A combinatorial series in the native background, or deep mutational scanning of the pore loops.',
    },
    'mechanistic-convergence': {
      verdict: 'contradicted',
      because: 'geffeney_2022 asked whether positionally convergent substitutions produce convergent TTX-channel interactions and found little evidence that they do, across three metrics. This is the one axis where a retrieved source argues against the premise rather than being silent on it.',
      what_would_raise_it: 'Structures of two lineages\' own resistant channels with TTX bound, or mutant-cycle analysis of the same positions in both.',
    },
  };

  const present = AXIS_IDS.map((a) => axes[a].verdict);
  const lo = Math.min(...present.map((v) => BANDS[v][0]));
  const hi = Math.max(...present.map((v) => BANDS[v][1]));

  return deepFreeze({
    case_id: 'ttx-resistance-in-voltage-gated-sodium-channels',
    axes,
    axis_verdicts: Object.fromEntries(AXIS_IDS.map((a) => [a, axes[a].verdict])),
    headline: 'Quantitative target present and convergence independently established; commensurability across studies and per-substitution attribution both weak; mechanistic convergence actively argued against by a retrieved source. The next experiment is named on each axis.',
    fused_scalar: null,
    score: null,
    probability: null,
    retro_validatability: null,
    why_no_fused_scalar: WHY_NOT_ONE_NUMBER,
    band: {
      lo, hi,
      is_a_band_not_a_point: true,
      width_is_the_message: 'The band spans nearly the whole range because the axes disagree with each other, not because the estimate is imprecise. Collapsing it would hide the disagreement, which is the only interesting thing about it.',
      not_a_probability: 'There is no reference class of retro-validation cases over which this could be a frequency.',
      label_span: [...new Set(present)],
    },
    the_axis_that_decides_the_next_experiment: 'per-substitution-attribution. It is the only weak axis that a single tractable experiment would move, and moving it would also move cross-study-commensurability and non-additivity at the same time.',
  });
};

// ====================================================================================================
// SUMMARY
// ====================================================================================================
export const summary = () => {
  const rows = SUBSTITUTIONS;
  const numeric = rows.filter((r) => typeof r.measured?.value === 'number');
  const nulled = rows.filter((r) => r.measured?.value === null);
  const censored = numeric.filter((r) => r.measured.censored);
  const byLevel = Object.fromEntries(LEVEL_IDS.map((l) => [l, rows.filter((r) => r.measurement_level === l).length]));
  const byNumbering = Object.fromEntries(NUMBERING_IDS.map((n) => [n, rows.filter((r) => r.numbering === n).length]));
  return deepFreeze({
    n_rows: rows.length,
    n_with_a_measured_number: numeric.length,
    n_nulled: nulled.length,
    n_censored: censored.length,
    n_species: SPECIES.length,
    n_sensitive_controls: SPECIES.filter((s) => s.role === 'sensitive-control').length,
    n_convergence_sets: CONVERGENCE.sets.length,
    n_refused_values: REFUSED_VALUES.length,
    n_discrepancies: Object.keys(DISCREPANCIES).filter((k) => k !== 'what_this_block_is').length,
    rows_by_level: byLevel,
    rows_by_numbering_convention: byNumbering,
    headline_measurement: 'Thamnophis sirtalis NaV1.4 allele NaV1.4-LVNV: TTX Kd 13000 +/- 1800 nM (n=11) against 50 +/- 5.2 nM (n=13) for the ancestral allele, both native snake channels in Xenopus oocytes, cut-open voltage clamp (hague_2018, DOI 10.1002/evl3.76). The source states 260-fold and 13000/50 = 260.',
    headline_warning: 'At the same locus, in a congener, NaV1.4 genotype explains 23% of whole-animal TTX-resistance variation (feldman_2010, DOI 10.1098/rspb.2010.0748). No row in this file carries a whole-animal fold-shift.',
    verdict: retroValidationVerdict().axis_verdicts,
    fused_scalar: null,
  });
};

if (import.meta.url === `file://${process.argv[1]?.split('\\').join('/')}` || process.argv[1]?.endsWith('ttx.mjs')) {
  console.log(JSON.stringify(summary(), null, 2));
}
