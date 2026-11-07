#!/usr/bin/env node
// analogy.mjs - WHEN IS A GENE OR A STRUCTURE IN SPECIES A THE FUNCTIONAL ANALOGUE OF ONE IN SPECIES B?
//
// ============================== WHY THIS MODULE EXISTS ==============================
// DELPHI designs an organism by borrowing a structure from one species into another. Every such borrow
// rests on a mapping: THIS gene in the donor does the job of THAT gene in the host; THIS structure
// corresponds to THAT one. The pipeline upstream of here answers that question with orthology, as
// though orthology were the answer. It is not the answer, and the gap between the two is this module's
// entire subject.
//
//   HOMOLOGY is a claim about ANCESTRY: these two things descend from one thing in a common ancestor.
//   ANALOGY  is a claim about FUNCTION: these two things do the same job.
//
// They are different claims, they are supported by different evidence, and either can hold without the
// other. Owen drew the distinction in 1843 and it is still the most commonly collapsed distinction in
// comparative genomics. The collapse happens in one direction almost every time: an orthology table is
// consulted, a row is returned, and the row is read as a licence to transfer function.
//
// Four ways that goes wrong, all of them routine:
//
//   1. AN ORTHOLOGUE CAN HAVE DIVERGED IN FUNCTION ENTIRELY. Orthology is about the duplication/speciation
//      history of the gene, not about what the protein now does. Kachroo et al. 2015 replaced 414
//      essential yeast genes with their human orthologues one at a time: roughly half could not do the
//      job. That is the base rate for "orthologous" meaning "interchangeable" in the most favourable
//      case imaginable - a single-gene, single-cell, pass/fail assay on genes under strong conservation.
//      It is about a coin flip. The "ortholog conjecture" - that orthologues are more functionally alike
//      than paralogues - has been directly tested and has not come out cleanly (Nehrt et al. 2011 found
//      the opposite in mammals; Stamboulian et al. 2020 found it holds for some data types and not
//      others). A pipeline that treats orthology as functional equivalence is betting on a conjecture
//      that the field has not settled.
//
//   2. A ONE-TO-MANY ORTHOLOGUE IS NOT A FUNCTIONAL EQUIVALENT OF ANYTHING. If one gene in A corresponds
//      to two in B, then "the orthologue of A's gene in B" does not denote. There is no single object
//      for the phrase to pick out, and picking one of the two and calling it "the" orthologue is not an
//      approximation, it is a category error that will surface later as a failed experiment. See
//      THE_ZEBRAFISH_PROBLEM, which is this exact failure in the organism this repo designs in.
//
//   3. A PARALOGUE MAY BE THE TRUE FUNCTIONAL STAND-IN. After a duplication, the two copies can split
//      the ancestral job between them (subfunctionalisation; Force et al. 1999). The copy that inherited
//      the job you care about is the functional analogue, and it may well not be the copy that an
//      orthology table nominates. Orthology ranks by ancestry. Function does not have to agree.
//
//   4. CONVERGENT STRUCTURES ARE ANALOGUES WITH NO ORTHOLOGY AT ALL. An insect wing and a vertebrate
//      forelimb; the antifreeze glycoprotein of a notothenioid and the chemically identical one in a
//      northern gadid, built from different ancestral genes (Chen, DeVries & Cheng 1997; Zhuang et al.
//      2019). These pairs have zero orthology and are the strongest functional analogues on the list.
//      They are also EXACTLY the cases a design programme cares about, because "this lineage solved the
//      problem by a route unavailable to the host" is the premise of borrowing in the first place. Any
//      framework that can only speak through orthology is blind to the cases it exists to serve.
//
// So this module does not score orthology. It enumerates the KINDS of evidence that a mapping is
// functional, keeps them separate, says of each what it does and does not establish, and returns a
// structured verdict instead of a number. It then refuses, loudly, the four inferences above.
//
// ============================== WHAT IT DELIBERATELY WILL NOT DO ==============================
// It will not return a single fused score as its headline. See WHY_NOT_ONE_NUMBER. The short version is
// that collapsing seven incommensurable evidence kinds into one float requires a weighting, the
// weighting is a modelling choice, nobody can defend a particular one, and a 0.87 with no visible
// weighting behind it gets read downstream as a probability. So the headline here is words, the
// confidence is a BAND and not a point, and the band is recomputed under a second, equally defensible
// weighting so the reader can see how much of the verdict was the evidence and how much was us.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). For some of the functions
// this project cares about, a member of that clade would be the obvious comparison. This module names no
// member of it, reads no datum from it, and substitutes nothing for it: where that comparison is the one
// you want, the honest statement is that it is unavailable by design, not that the next one down is
// good. Run `node holdout/check-leaks.mjs analogues` against this folder.
//
// Related but different: sim-engine/validate/functional/analogue.mjs picks the closest ORGANISM that
// performs a function. This module judges a PAIR - gene to gene, structure to structure - and is about
// the evidence for the pairing, not the choice of partner.
//
//   node analogues/analogy.mjs            # print worked()
//   node analogues/test-analogy.mjs       # the tests

export const CITATIONS = Object.freeze({
  owen_1843: 'Owen, R. (1843) Lectures on the Comparative Anatomy and Physiology of the Invertebrate Animals. The homologue/analogue distinction, in the terms still used.',
  fitch_1970: 'Fitch, W.M. (1970) Distinguishing homologous from analogous proteins. Systematic Zoology 19:99-113. Where "ortholog" and "paralog" are defined.',
  fitch_2000: 'Fitch, W.M. (2000) Homology: a personal view on some of the problems. Trends in Genetics 16:227-231.',
  koonin_2005: 'Koonin, E.V. (2005) Orthologs, paralogs, and evolutionary genomics. Annual Review of Genetics 39:309-338. One-to-many and many-to-many orthology, and co-orthologues.',
  gabaldon_koonin_2013: 'Gabaldon, T. & Koonin, E.V. (2013) Functional and evolutionary implications of gene orthology. Nature Reviews Genetics 14:360-366. States the ortholog conjecture as a conjecture.',
  nehrt_2011: 'Nehrt, N.L., Clark, W.T., Radivojac, P. & Hahn, M.W. (2011) Testing the ortholog conjecture with comparative functional genomic data from mammals. PLoS Computational Biology 7:e1002073. Found paralogues functionally MORE similar than orthologues.',
  stamboulian_2020: 'Stamboulian, M., Guerrero, R.F., Hahn, M.W. & Radivojac, P. (2020) The ortholog conjecture revisited: the value of orthologs and paralogs in function prediction. Bioinformatics 36:i219-i226.',
  altenhoff_2016: 'Altenhoff, A.M. et al. (2016) Standardized benchmarking in the quest for orthologs. Nature Methods 13:425-430. Orthology calls differ between methods on the same genomes; "the orthologue" is method-dependent.',
  rost_1999: 'Rost, B. (1999) Twilight zone of protein sequence alignments. Protein Engineering 12:85-94. Below roughly 30% pairwise identity, alignment-based homology inference is unreliable.',
  force_1999: 'Force, A., Lynch, M., Pickett, F.B., Amores, A., Yan, Y.-l. & Postlethwait, J. (1999) Preservation of duplicate genes by complementary, degenerative mutations. Genetics 151:1531-1545. The duplication-degeneration-complementation model: the ancestral job splits between the copies.',
  amores_1998: 'Amores, A. et al. (1998) Zebrafish hox clusters and vertebrate genome evolution. Science 282:1711-1714.',
  jaillon_2004: 'Jaillon, O. et al. (2004) Genome duplication in the teleost fish Tetraodon nigroviridis reveals the early vertebrate proto-karyotype. Nature 431:946-957. The teleost-specific whole-genome duplication.',
  postlethwait_2000: 'Postlethwait, J.H. et al. (2000) Zebrafish comparative genomics and the origins of vertebrate chromosomes. Genome Research 10:1890-1902.',
  kachroo_2015: 'Kachroo, A.H. et al. (2015) Systematic humanization of yeast genes reveals ancient functional divergence. Science 348:921-925. Roughly half of 414 tested human orthologues could replace their essential yeast counterpart; roughly half could not.',
  lee_nurse_1987: 'Lee, M.G. & Nurse, P. (1987) Complementation used to clone a human homologue of the fission yeast cell cycle control gene cdc2. Nature 327:31-35. A cross-kingdom rescue, and the reason rescue is the evidence kind this module ranks first.',
  rossi_2015: 'Rossi, A. et al. (2015) Genetic compensation induced by deleterious mutations in cardiac zebrafish models. Nature 524:230-233. A knockout with no phenotype may be compensation, not redundancy, and not dispensability.',
  elbrolosy_2019: 'El-Brolosy, M.A. et al. (2019) Genetic compensation triggered by mutant mRNA degradation. Nature 568:193-197. The mechanism behind the above.',
  shubin_2009: 'Shubin, N., Tabin, C. & Carroll, S. (2009) Deep homology and the origins of evolutionary novelty. Nature 457:818-823. Why "convergent" at the level of the structure is compatible with shared regulatory machinery underneath, and why that does not make the structures homologous.',
  chen_1997: 'Chen, L., DeVries, A.L. & Cheng, C.-H.C. (1997) Convergent evolution of antifreeze glycoproteins in Antarctic notothenioid fish and Arctic cod. PNAS 94:3811-3816.',
  zhuang_2019: 'Zhuang, X., Yang, C., Murphy, K.R. & Cheng, C.-H.C. (2019) Molecular mechanism and history of non-sense to sense evolution of antifreeze glycoprotein gene in northern gadids. PNAS 116:4400-4405.',
  nakamura_2016: 'Nakamura, T., Gehrke, A.R., Lemberg, J., Szymaszek, J. & Shubin, N.H. (2016) Digits and fin rays share common developmental histories. Nature 537:225-228. The contested cell-lineage evidence for the fin-ray/digit correspondence.',
  zhang_2010: 'Zhang, J., Wagh, P., Guay, D. et al. (2010) Loss of fish actinotrichia proteins and the fin-to-limb transition. Nature 466:234-237. The actinodin genes and1/and2 have no tetrapod counterpart.',
  perathoner_2014: 'Perathoner, S. et al. (2014) Bioelectric signaling regulates size in zebrafish fins. PLoS Genetics 10:e1004080, PMID 24453984. alf mutants carry gain-of-function mutations in kcnk5b.',
  daane_2021: 'Daane, J.M. et al. (2021) Modulation of bioelectric cues in the evolution of flying fishes. Current Biology 31:5052-5061, PMID 34534441.',
  jiang_2024: 'Jiang, X. et al. (2024) PLoS Biology, PMID 38527087. Retinoic acid scales the pectoral fin bud via rcan2, and Rcan2-driven growth requires kcnk5b.',
  in_repo: 'crossgraph/README.md records that kcnk5a and kcnk5b both map to the single human KCNK5, and that the source literature attributes the absent kcnk5b loss-of-function phenotype to redundancy between exactly that pair. genotype/CAUSAL.md records what is and is not measured for kcnk5b. sequences/gliders.json records that 0 of 532 interface positions separate gliders from non-gliders.',
  note: 'None of the biology here is this project\'s result. What is ours is the separation of the evidence kinds, the refusal to fuse them into one number, and the refusals below.',
});

export const WHAT_THIS_IS =
  'A judgement about a PAIR: is this gene or structure in species A the functional analogue of that one ' +
  'in species B? It keeps homology (shared ancestry) and analogy (shared function) apart, enumerates the ' +
  'seven kinds of evidence that bear on the functional claim, says of each what it does and does not ' +
  'establish, and returns a structured verdict - strongest evidence present, what is missing, a ' +
  'confidence band - rather than a fused score. It refuses to call a one-to-many orthologue a functional ' +
  'equivalent, to infer function from sequence identity alone, to transfer a phenotype without naming the ' +
  'developmental-context difference, and to read "no orthologue found" as "no functional analogue exists".';

// =====================================================================================================
// 1. THE EVIDENCE KINDS
// =====================================================================================================
//
// Seven distinct kinds. The point of enumerating them is that they are NOT substitutes for one another:
// four of them are evidence about ANCESTRY that gets quietly spent as evidence about FUNCTION, two are
// correlates of function, and exactly ONE tests function directly.
//
// `band` is the support interval this module would report if that kind were the ONLY evidence present.
// Those endpoints are a stated, arguable choice, not a measurement - which is the whole reason they are
// written down here where they can be argued with, and the reason ALT_BANDS exists.

export const RESCUE_IS_THE_ONLY_DIRECT_TEST = Object.freeze({
  claim: 'Of the seven kinds, RESCUE / COMPLEMENTATION is the only one that directly tests function. The other six are correlates of function, of varying and mostly unquantified strength.',
  why: 'A rescue experiment puts the candidate gene into a context where the function is absent and asks whether the function returns. The question asked is the question of interest. Every other kind asks a different question - about ancestry, about genomic neighbourhood, about where a transcript is, about what domains a protein has, about what happens when a gene is removed, about where a structure sits - and then relies on an unstated correlation between the answer and function.',
  and_rescue_is_not_a_blank_cheque: [
    'Rescue is directional. B rescues a loss of A does not entail A rescues a loss of B, and the asymmetric case is common and informative.',
    'Rescue is assay-specific. Rescuing viability is not rescuing morphology is not rescuing the phenotype a design cares about. State the assay or the result means little.',
    'Rescue is context-specific. A heterologous promoter, a different expression level, a different cell type or a different developmental stage can each produce a rescue that would not occur in the native context, or hide one that would.',
    'Rescue can succeed for the wrong reason: overexpression of a biochemically unrelated protein can bypass a defect without being an analogue of anything.',
    'FAILURE to rescue is weak evidence against analogy. It can fail on codon usage, folding, partner incompatibility, dose, or timing, none of which say the two genes do different jobs.',
  ],
  so: 'Rescue outranks everything else here, and still does not settle the question on its own. That is not a hedge; it is the strongest honest statement available.',
});

export const EVIDENCE_KINDS = Object.freeze({
  'rescue': Object.freeze({
    id: 'rescue',
    label: 'rescue / cross-species complementation',
    directly_tests_function: true,
    about: 'function',
    establishes: 'that the candidate gene can perform the assayed function in the assayed context - the only kind here that tests the claim rather than a correlate of it',
    does_not_establish: 'that it performs that function natively, at native dose, in the native cell type or stage; that the rescue is mutual; that the rescued assay is the phenotype of interest; and - when rescue FAILS - that the two genes do different jobs, since failure has many causes unrelated to function',
    band: Object.freeze([0.55, 0.90]),
    corroboration_weight: 1.0,
    cite: 'lee_nurse_1987, kachroo_2015',
  }),
  'lof-phenotype': Object.freeze({
    id: 'lof-phenotype',
    label: 'loss-of-function phenotype similarity',
    directly_tests_function: false,
    about: 'function (one-sided)',
    establishes: 'that removing each gene perturbs a comparable process in its own species - a one-sided test: it shows each is REQUIRED for something comparable, not that either could do the other\'s job',
    does_not_establish: 'equivalence; sufficiency; that the phenotypes are the same phenotype rather than two readouts that have been given the same word. And an ABSENT phenotype establishes least of all: it may be redundancy with a paralogue, or genetic compensation by transcriptional adaptation (Rossi 2015, El-Brolosy 2019), neither of which means the gene is dispensable',
    band: Object.freeze([0.25, 0.65]),
    corroboration_weight: 0.8,
    cite: 'rossi_2015, elbrolosy_2019',
  }),
  'sequence-orthology': Object.freeze({
    id: 'sequence-orthology',
    label: 'sequence orthology (with homology type)',
    directly_tests_function: false,
    about: 'ancestry',
    establishes: 'a descent relationship between the two sequences, and - if the homology type is stated - the SHAPE of that relationship',
    does_not_establish: 'anything about current function. The ortholog conjecture is a conjecture (Gabaldon & Koonin 2013) and has been tested with mixed results (Nehrt 2011, Stamboulian 2020). Orthology calls also differ between methods on identical genomes (Altenhoff 2016), so "the orthologue" is method-dependent before it is anything else',
    requires: 'homology_type, one of HOMOLOGY_TYPES. An orthology claim with no homology type is not usable here, because the one-to-many case is the case that breaks everything downstream',
    band_by_homology_type: Object.freeze({
      'one-to-one': Object.freeze([0.20, 0.60]),
      'one-to-many': Object.freeze([0.05, 0.40]),
      'many-to-many': Object.freeze([0.04, 0.38]),
      'paralog': Object.freeze([0.05, 0.35]),
      'none': Object.freeze([0.00, 0.10]),
    }),
    band: Object.freeze([0.05, 0.40]), // used only when homology_type is missing: the pessimistic case
    corroboration_weight: 0.5,
    cite: 'fitch_1970, koonin_2005, gabaldon_koonin_2013, altenhoff_2016',
  }),
  'synteny': Object.freeze({
    id: 'synteny',
    label: 'conserved synteny (genomic neighbourhood)',
    directly_tests_function: false,
    about: 'ancestry',
    establishes: 'that the two loci sit in corresponding genomic neighbourhoods, which is strong independent support that the orthology CALL is right and is the main way to tell an ohnolog pair apart from a recent local duplication',
    does_not_establish: 'function, at all, in any degree. Synteny is the best evidence in this list for the ancestry claim and no evidence whatsoever for the functional one. It is also the kind most often cited as though the distinction did not exist',
    band: Object.freeze([0.10, 0.40]),
    corroboration_weight: 0.5,
    cite: 'postlethwait_2000, jaillon_2004',
  }),
  'expression-domain': Object.freeze({
    id: 'expression-domain',
    label: 'expression-domain similarity',
    directly_tests_function: false,
    about: 'correlate of function',
    establishes: 'that the two genes are transcribed in corresponding tissues, stages or cell types - a necessary condition for doing the same job in that place',
    does_not_establish: 'that they do the same thing there. Co-location is necessary and nowhere near sufficient. Comparisons across species are also confounded before they begin: by tissue dissection boundaries, by stage staging, by normalisation, and by the absence of a cell-type correspondence between the two species. Transcript presence is not protein presence is not activity',
    band: Object.freeze([0.10, 0.45]),
    corroboration_weight: 0.4,
    cite: null,
  }),
  'domain-architecture': Object.freeze({
    id: 'domain-architecture',
    label: 'protein-domain architecture',
    directly_tests_function: false,
    about: 'ancestry and biochemical capability',
    establishes: 'that the two proteins carry the same catalytic or binding modules in the same order - so they are capable of the same class of biochemistry',
    does_not_establish: 'which substrate, which partner, which compartment, which regulation. Identical architecture is routine across proteins with different jobs - a two-pore potassium channel is a two-pore potassium channel whatever it gates - and the domain call itself is a model assignment with its own error rate',
    band: Object.freeze([0.12, 0.50]),
    corroboration_weight: 0.4,
    cite: null,
  }),
  'positional-correspondence': Object.freeze({
    id: 'positional-correspondence',
    label: 'structural / positional correspondence',
    directly_tests_function: false,
    about: 'topology',
    establishes: 'that two structures occupy corresponding positions in a body plan or an organ - the anatomist\'s criterion, and the only kind in this list that applies when there is no gene to talk about',
    does_not_establish: 'function or ancestry. Position is assigned under a correspondence of body plans that is itself the thing in question for any pair interesting enough to ask about, so this kind is the most liable to circularity of the seven. It is also the only evidence available for many of the structure pairs a design programme actually wants',
    band: Object.freeze([0.05, 0.30]),
    corroboration_weight: 0.3,
    cite: 'owen_1843, nakamura_2016',
  }),
});

export const EVIDENCE_IDS = Object.freeze(Object.keys(EVIDENCE_KINDS));

/** The kinds that bear on function at all. Synteny and bare orthology are not among them. */
export const FUNCTION_BEARING = Object.freeze(['rescue', 'lof-phenotype', 'expression-domain', 'domain-architecture']);

/** Missing any of these widens the band downward: they are the kinds whose absence is informative. */
const HIGH_VALUE_IF_MISSING = Object.freeze(['rescue', 'lof-phenotype', 'expression-domain']);

export const HOMOLOGY_TYPES = Object.freeze(['one-to-one', 'one-to-many', 'many-to-many', 'paralog', 'none']);

/** Homology types for which "the orthologue" does not denote a single gene. */
export const AMBIGUOUS_HOMOLOGY_TYPES = Object.freeze(['one-to-many', 'many-to-many']);

/**
 * The stated identity threshold. BELOW it, alignment-based homology inference itself is unreliable
 * (Rost 1999), so inferring function from identity is inferring from something that is not even
 * established to be homology. ABOVE it, identity still does not establish function - the floor is a
 * floor on the ANCESTRY inference and not a ceiling on the FUNCTION inference, and reading it as
 * "70% identity, therefore same job" is the error this module exists to block. This repo has its own
 * instance: sequences/gliders.json finds 0 of 532 interface positions that separate gliders from
 * non-gliders, i.e. the sequence carries no signal for the function at all in the one case we checked.
 */
export const IDENTITY_FLOOR = 0.30;

/**
 * "No orthologue found" in ONE database is not a search. Orthology calls disagree between methods on
 * identical genomes (Altenhoff 2016), so a single negative is a statement about one method's graph.
 * A negative becomes a statement about the genomes at MIN_DATABASES independent resources plus a
 * synteny check at the expected locus - and even then it is a statement about ORTHOLOGY, never about
 * the existence of a functional analogue.
 */
export const MIN_DATABASES = 3;

// =====================================================================================================
// 2. WHY THERE IS NO SINGLE NUMBER
// =====================================================================================================

export const WHY_NOT_ONE_NUMBER = Object.freeze({
  headline: 'Fusing these seven evidence kinds into one score requires a weighting. The weighting is a modelling choice, nobody can defend a particular one, and the choice propagates into every downstream decision while becoming invisible at the first function call.',
  the_argument: [
    'The kinds are not measured on a common scale. A rescue result is a pass/fail outcome of an experiment. An identity value is a fraction of aligned residues. A synteny call is a graph property of two assemblies. An expression comparison is a correlation over a tissue vocabulary that does not align between species. There is no unit they share, so there is no sum.',
    'They are not independent. Orthology, synteny and domain architecture are three readouts of one underlying fact - shared ancestry - and adding them up triple-counts it. Expression similarity and loss-of-function similarity both lean on the same tissue correspondence. A weighted sum of correlated evidence reports confidence that the evidence does not contain.',
    'Their error modes are not comparable. A wrong orthology call is a mistake about history. A wrong rescue result is a mistake about chemistry. A wrong positional correspondence is a mistake about the body-plan correspondence that was assumed in order to make it. One number cannot carry three kinds of being wrong.',
    'A single score hides ABSENCE. Six strong correlates with no functional test produces a high number by the same arithmetic as a weaker set that includes a rescue. Those are different epistemic situations and the whole point of the module is to keep them apart.',
    'A float between 0 and 1 is read as a probability. It is not one: there is no reference class and no calibration set. A 0.87 here would mean "the weighting we chose, applied to the evidence we happened to have, produced 0.87" - and nothing in the number says so.',
  ],
  what_is_returned_instead: 'the strongest evidence kind present; the list of kinds that are absent and what each would add; a confidence BAND with hi > lo, whose width is a function of what is missing; and the same band recomputed under a second, equally defensible weighting, so the sensitivity of the verdict to our choices is visible rather than buried.',
  if_you_need_a_scalar: 'Then state the weighting in the artefact that consumes it, carry it with the number, and accept that you have made a modelling decision rather than a measurement. Do not ask this module to make it for you quietly.',
});

/**
 * How much each extra present kind moves the lower bound up. This IS the weighting, exposed. These
 * numbers are a judgement: they rank a functional test above a correlate of function above a fact about
 * ancestry. Someone could rank them differently and would not be obviously wrong.
 */
export const BANDS = Object.freeze(Object.fromEntries(EVIDENCE_IDS.map(k => [k, EVIDENCE_KINDS[k].corroboration_weight])));

/**
 * A second, equally defensible weighting, used only to report sensitivity. It takes the sceptic's view
 * that cross-species expression comparison is nearly worthless (no cell-type correspondence, no shared
 * tissue vocabulary) while synteny is strong (it is what actually distinguishes an ohnolog pair from a
 * local duplication). If swapping BANDS for ALT_BANDS changes the verdict's LABEL, the label was ours
 * and not the evidence's, and scoreAnalogy says so.
 */
export const ALT_BANDS = Object.freeze({
  'rescue': 1.0,
  'lof-phenotype': 0.6,
  'sequence-orthology': 0.45,
  'synteny': 0.75,
  'expression-domain': 0.10,
  'domain-architecture': 0.5,
  'positional-correspondence': 0.2,
});

/**
 * The sceptic's BASE intervals, and the more important half of the sensitivity probe. Varying only the
 * corroboration weights (ALT_BANDS) barely moves anything, because the base interval of the strongest
 * kind dominates the arithmetic - which is itself the finding: the apparatus is mostly reporting one
 * stated opinion about one evidence kind, dressed as a combination of seven. So the alternative varies
 * the opinion that actually matters. The sceptic holds that a correlate of function is worth much less
 * than the default allows, and that a rescue in a heterologous context is worth somewhat less too.
 * Where the LABEL survives both substitutions, it is the evidence talking. Where it does not, it was us.
 */
export const ALT_BASE_BANDS = Object.freeze({
  'rescue': Object.freeze([0.45, 0.85]),
  'lof-phenotype': Object.freeze([0.12, 0.45]),
  'sequence-orthology': Object.freeze([0.04, 0.30]),
  'synteny': Object.freeze([0.06, 0.32]),
  'expression-domain': Object.freeze([0.03, 0.20]),
  'domain-architecture': Object.freeze([0.05, 0.28]),
  'positional-correspondence': Object.freeze([0.02, 0.15]),
  'sequence-orthology-by-type': Object.freeze({
    'one-to-one': Object.freeze([0.10, 0.40]),
    'one-to-many': Object.freeze([0.03, 0.24]),
    'many-to-many': Object.freeze([0.02, 0.22]),
    'paralog': Object.freeze([0.03, 0.22]),
    'none': Object.freeze([0.00, 0.06]),
  }),
});

const LABELS = Object.freeze([
  { upto: 0.15, label: 'no-support' },
  { upto: 0.35, label: 'weak' },
  { upto: 0.60, label: 'moderate' },
  { upto: 0.80, label: 'strong' },
  { upto: 1.01, label: 'directly-tested' },
]);
const labelFor = x => LABELS.find(l => x < l.upto).label;
const MIN_BAND_WIDTH = 0.08;

// =====================================================================================================
// 3. THE ZEBRAFISH PROBLEM
// =====================================================================================================

export const THE_ZEBRAFISH_PROBLEM = Object.freeze({
  name: 'the duplicate-pair problem (the teleost case)',
  the_general_problem: [
    'The teleost lineage went through a whole-genome duplication after it split from the tetrapods (Amores 1998; Jaillon 2004; Postlethwait 2000). Many zebrafish genes therefore exist as a DUPLICATE PAIR - two ohnologs - where a mammal has one gene.',
    'Both copies are, formally, orthologues of the single mammalian gene. The relationship is ONE-TO-MANY, so the phrase "the zebrafish orthologue of gene X" does not pick out a gene.',
    'Worse than ambiguous: under the duplication-degeneration-complementation model (Force et al. 1999), the two copies commonly SPLIT THE ANCESTRAL FUNCTION between them. Each inherits part of the job - part of the expression domain, part of the regulation, part of the biochemistry. Neither copy is the mammalian gene\'s functional equivalent, because neither does the whole job.',
    'The experimental consequence is concrete and expensive. Knock out one copy and you get a PARTIAL phenotype, or no phenotype at all, because the sibling covers what you removed. The result reads as "this gene is not required", and the conclusion is wrong: the gene is required for its share of a job that was divided.',
    'Absence of phenotype has a second, independent explanation that looks identical from outside: transcriptional adaptation, where a mutant transcript\'s degradation upregulates the paralogue (Rossi 2015; El-Brolosy 2019). So a silent knockout is consistent with redundancy, with compensation, and with the gene being genuinely dispensable, and nothing in the knockout distinguishes them.',
    'Therefore: ANY MAPPING THAT PICKS ONE MEMBER OF A DUPLICATE PAIR AND CALLS IT "THE" ORTHOLOGUE IS WRONG IN A WAY THAT WILL SHOW UP AS A FAILED EXPERIMENT. Not imprecise. Wrong, and wrong at the bench, after the money is spent.',
  ],
  the_instance_in_this_repo: Object.freeze({
    pair: ['kcnk5a', 'kcnk5b'],
    species: 'Danio rerio',
    maps_to: 'the single human KCNK5',
    what_the_repo_records: 'crossgraph/README.md: "kcnk5a and kcnk5b both map to one human KCNK5, and the source literature attributes the absent kcnk5b loss-of-function phenotype to redundancy between exactly that pair." That is the shape above, in the gene this project\'s design work turns on.',
    why_it_matters_here: 'kcnk5b is the one gene in this repo\'s inventory called SUFFICIENT for a change in a fin (genotype/README.md), via the alf gain-of-function alleles (Perathoner 2014). The sufficiency evidence is a gain of function. The loss-of-function evidence is absent, and the literature\'s explanation for its absence is the sibling copy. So the gene with the strongest sufficiency claim in the design has the weakest necessity claim, for a reason that is specifically about being one of a pair.',
    what_is_NOT_established: [
      'That kcnk5a and kcnk5b arose at the teleost-specific whole-genome duplication rather than by a later local duplication. No synteny analysis of the pair is held here, and synteny is what would distinguish those.',
      'That the redundancy is real. It is the literature\'s ATTRIBUTION for a missing phenotype, which is a hypothesis about an absence, not a measurement. The experiment that would test it - single and double loss of function, scored in the same assay, with the paralogue\'s transcript measured in each - is not recorded in this repo as having been done.',
      'How the ancestral function divides between them, if it does. No expression comparison of the two copies in the pectoral fin is held here.',
      'That compensation is excluded. Distinguishing redundancy from transcriptional adaptation requires measuring kcnk5a transcript in a kcnk5b mutant, and that measurement is not held here either.',
    ],
    the_honest_mapping: 'human KCNK5 -> { kcnk5a, kcnk5b } as a SET, with the division of labour unknown. Any design step that needs "the zebrafish KCNK5" must either carry the set, or name which copy and why, and own the risk.',
    where_else: 'genotype/CAUSAL.md lists the other things unmeasured for kcnk5b, including that there is no electrophysiological recording from any zebrafish fin cell and no cell-type-resolved node. Daane 2021 (PMID 34534441) additionally reports that the comparative signal in flying fishes matches kcnh2a and NOT kcnk5b.',
  }),
  not_only_zebrafish: 'The same shape appears wherever a duplication is on one side of a comparison: the salmonid duplication, plant polyploidy, the two rounds at the base of the vertebrates, and every recent tandem duplication. "Teleost" names the instance; one-to-many names the problem.',
});

// =====================================================================================================
// 4. THE CLASSES
// =====================================================================================================

export const CLASSES = Object.freeze({
  'orthologous-and-functionally-tested': Object.freeze({
    id: 'orthologous-and-functionally-tested',
    means: 'a one-to-one orthologue whose ability to perform the function has been tested directly, by rescue or complementation',
    functional_equivalent: true,
    upgrade: 'This is the top of the ladder and it is still not a licence. What would strengthen it: rescue in BOTH directions; rescue at native dose from the native locus rather than a heterologous construct; rescue scored on the phenotype the design cares about rather than on viability; and the same result in a second laboratory.',
  }),
  'orthologous-untested': Object.freeze({
    id: 'orthologous-untested',
    means: 'a one-to-one orthologue with correlates of function - expression, domains, synteny, perhaps matching loss-of-function phenotypes - but no direct functional test',
    functional_equivalent: false,
    upgrade: 'A rescue or complementation experiment. That is the whole upgrade, and nothing else substitutes for it: Kachroo 2015 found about half of tested essential orthologues could not do the job, so the correlates here are consistent with a coin flip.',
  }),
  'one-to-many-ambiguous': Object.freeze({
    id: 'one-to-many-ambiguous',
    means: 'one gene on one side corresponds to two or more on the other. "The orthologue" does not denote a single gene, so no statement of the form "X is the functional equivalent of Y" can be made, whatever other evidence is present',
    functional_equivalent: false,
    upgrade: 'Not a better orthology call - the one-to-many relationship is a fact about the history and will not resolve. What upgrades it: (a) carry the SET rather than a member; (b) determine the division of labour, by comparing the copies\' expression domains and by single AND double loss of function scored in one assay, with each copy\'s transcript measured in the other\'s mutant to separate redundancy from compensation; (c) then, if one copy carries the function of interest, that copy may be re-asked as a paralogous-candidate pair. See THE_ZEBRAFISH_PROBLEM.',
  }),
  'paralogous-candidate': Object.freeze({
    id: 'paralogous-candidate',
    means: 'the two genes are related by duplication rather than by speciation, and the paralogue is a candidate functional stand-in - which, after subfunctionalisation, it may well be, in preference to the nominal orthologue',
    functional_equivalent: false,
    upgrade: 'Rescue by the paralogue specifically, and an expression comparison showing it covers the domain where the function is needed. Note that this class can legitimately end up ABOVE an orthologous-untested pair: Nehrt 2011 found paralogues functionally more similar than orthologues in mammals. Rank by evidence, not by relationship.',
  }),
  'convergent-analogue': Object.freeze({
    id: 'convergent-analogue',
    means: 'shared function with no shared ancestry at the level of the structure or gene in question. The strongest form of analogy and the one orthology cannot see at all',
    functional_equivalent: false,
    functional_equivalent_note: 'Not marked as a functional equivalent, because "equivalent" in this module means substitutable in a design, and a convergent solution built from different parts usually is not substitutable even when the function matches exactly. The function claim can be very strong while the substitutability claim is empty.',
    upgrade: 'Characterise the MECHANISM on both sides, since the engineering question is whether the donor\'s route is available in the host at all. Then ask what the host would need in order to run it: the required parts, and whether it has them. Also state explicitly whether shared deeper regulatory machinery is present (Shubin 2009) - deep homology is compatible with convergence of the structure and must be reported rather than left to be discovered as a contradiction.',
  }),
  'positional-only': Object.freeze({
    id: 'positional-only',
    means: 'the two structures occupy corresponding positions in their body plans, and that is the entire basis. No orthology, no functional test, no expression correspondence',
    functional_equivalent: false,
    upgrade: 'Anything that is not position. The weakness is specific: positional correspondence is assigned under a body-plan correspondence that is itself in question for any pair worth asking about, so the evidence risks assuming its conclusion. What breaks the circle: a shared cell lineage (as Nakamura 2016 attempted for fin rays and digits, and note that it remains contested), a shared regulatory module with a demonstrated role, or a functional measurement on each side.',
  }),
  'no-basis': Object.freeze({
    id: 'no-basis',
    means: 'no evidence of any of the seven kinds has been assembled for this pair',
    functional_equivalent: false,
    critical_warning: 'THIS IS A STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY. no-basis means we have not looked, or have looked in one place. It does NOT mean no functional analogue exists. Convergent analogues have no orthology by construction, so the very cases this programme cares about most are precisely the ones a failed orthology search cannot see.',
    upgrade: `Search. At minimum ${MIN_DATABASES} independent orthology resources plus a synteny check at the expected locus before a negative is even a statement about the genomes - and then a FUNCTION-first search, which is a different search: ask which gene or structure in the host performs the job, by expression, by phenotype, or by assay, without going through ancestry at all.`,
  }),
});

export const CLASS_IDS = Object.freeze(Object.keys(CLASSES));

/** The only class that means "substitutable in a design". Nothing one-to-many may ever land here. */
export const FUNCTIONAL_EQUIVALENCE_CLASSES = Object.freeze(CLASS_IDS.filter(c => CLASSES[c].functional_equivalent === true));

// =====================================================================================================
// 5. SCORING: A STRUCTURED VERDICT, NOT A SCORE
// =====================================================================================================

const clamp = (x, lo = 0.02, hi = 0.98) => Math.min(hi, Math.max(lo, x));
const r2 = x => Math.round(x * 100) / 100;

const normaliseEvidence = ev => {
  const out = {}, unknown = [];
  for (const [k, v] of Object.entries(ev || {})) {
    if (!EVIDENCE_IDS.includes(k)) { unknown.push(k); continue; }
    out[k] = (v && typeof v === 'object') ? v : { present: !!v };
  }
  return { evidence: out, unknown };
};

const bandOf = (kind, rec, bases = null) => {
  const K = EVIDENCE_KINDS[kind];
  if (kind === 'sequence-orthology') {
    const t = rec?.homology_type;
    const table = bases ? bases['sequence-orthology-by-type'] : K.band_by_homology_type;
    if (t && table[t]) return table[t];
    // no homology type stated: the pessimistic band, and a gap is reported for it
    return bases ? bases['sequence-orthology'] : K.band;
  }
  return bases ? bases[kind] : K.band;
};

const computeBand = (present, evidence, weights, bases = null) => {
  if (!present.length) return { lo: 0.02, hi: 0.10, label: 'no-support', label_span: ['no-support'] };
  // Strongest = the present kind with the highest band top under its own homology type.
  const ranked = [...present].sort((a, b) => bandOf(b, evidence[b], bases)[1] - bandOf(a, evidence[a], bases)[1]);
  const base = bandOf(ranked[0], evidence[ranked[0]], bases);
  let lo = base[0], hi = base[1];
  for (const k of ranked.slice(1)) { lo += 0.05 * (weights[k] ?? 0.3); hi += 0.02 * (weights[k] ?? 0.3); }
  const missingHigh = HIGH_VALUE_IF_MISSING.filter(k => !present.includes(k));
  lo -= 0.04 * missingHigh.length;
  lo = clamp(lo); hi = clamp(hi);
  if (hi - lo < MIN_BAND_WIDTH) hi = clamp(lo + MIN_BAND_WIDTH);
  if (hi <= lo) { lo = clamp(lo - MIN_BAND_WIDTH / 2); hi = clamp(lo + MIN_BAND_WIDTH); }
  const span = [...new Set([labelFor(lo), labelFor((lo + hi) / 2), labelFor(hi)])];
  return { lo: r2(lo), hi: r2(hi), label: labelFor((lo + hi) / 2), label_span: span };
};

/**
 * Combine the evidence for a pair into a STRUCTURED verdict.
 *
 * Deliberate design constraints, each enforced by a test:
 *   * No property of the returned object is a bare number. Every quantity lives inside `confidence`,
 *     where it is a band and is labelled as not a probability. There is no fused scalar to read.
 *   * `headline` contains no digits at all. It is the sentence a reader would quote, and a quotable
 *     sentence with a float in it is a float with a sentence around it.
 *   * `confidence.hi > confidence.lo` always, including when a rescue has been done. A point estimate
 *     is not available from this evidence and the return type should not be able to express one.
 *
 * @param {string|object} a      one side of the pair (gene symbol, structure name, or {species, name})
 * @param {string|object} b      the other side
 * @param {object} evidence      keyed by EVIDENCE_IDS; each value {present, ...details}
 */
export function scoreAnalogy(a, b, evidence) {
  const side = x => (typeof x === 'string' ? { name: x } : (x || {}));
  const A = side(a), B = side(b);
  const { evidence: ev, unknown } = normaliseEvidence(evidence);
  const present = EVIDENCE_IDS.filter(k => ev[k]?.present === true);
  const absent = EVIDENCE_IDS.filter(k => !present.includes(k));

  const ranked = [...present].sort((x, y) => bandOf(y, ev[y])[1] - bandOf(x, ev[x])[1]);
  const strongestId = ranked[0] ?? null;
  const band = computeBand(present, ev, BANDS);
  const altBand = computeBand(present, ev, ALT_BANDS, ALT_BASE_BANDS);

  const orth = ev['sequence-orthology'];
  const homology_type = orth?.present ? (orth.homology_type ?? null) : 'none';

  const gaps = [];
  if (orth?.present && !orth.homology_type) {
    gaps.push('an orthology claim with no homology_type: the one-to-many case is the one that breaks the mapping, so an unspecified type is scored as if it were ambiguous');
  }
  if (present.length && !present.includes('rescue')) {
    gaps.push('no direct functional test: everything present is a correlate of function, and the only kind that tests function is absent');
  }
  if (present.length && present.every(k => !FUNCTION_BEARING.includes(k))) {
    gaps.push('every present kind is evidence about ANCESTRY or TOPOLOGY. Nothing present bears on function at all, however much of it there is');
  }

  const strongest = strongestId ? Object.freeze({
    kind: strongestId,
    label: EVIDENCE_KINDS[strongestId].label,
    directly_tests_function: EVIDENCE_KINDS[strongestId].directly_tests_function,
    establishes: EVIDENCE_KINDS[strongestId].establishes,
    does_not_establish: EVIDENCE_KINDS[strongestId].does_not_establish,
    as_given: ev[strongestId],
  }) : null;

  const missing = absent.map(k => Object.freeze({
    kind: k,
    label: EVIDENCE_KINDS[k].label,
    what_it_would_add: EVIDENCE_KINDS[k].establishes,
    what_it_still_would_not: EVIDENCE_KINDS[k].does_not_establish,
    would_be_decisive: k === 'rescue',
  }));

  const words = present.length === 0
    ? 'No evidence of any kind has been assembled for this pair, which is a statement about the search and not about the biology.'
    : `Strongest evidence present: ${EVIDENCE_KINDS[strongestId].label}` +
      `${EVIDENCE_KINDS[strongestId].directly_tests_function ? ', which tests function directly' : ', which is a correlate of function and not a test of it'}. ` +
      `Absent: ${absent.length ? absent.map(k => EVIDENCE_KINDS[k].label).join('; ') : 'nothing'}. ` +
      `Support for the functional claim is ${band.label}` +
      `${band.label_span.length > 1 ? `, and the band straddles the boundary between ${band.label_span.join(' and ')}, so even the word is not resolved` : ''}. ` +
      `${present.includes('rescue') ? 'A direct functional test exists; read the assay and the direction before treating it as substitutability.' : 'No direct functional test exists for this pair.'}`;

  return Object.freeze({
    pair: Object.freeze({ a: A.name ?? String(a), b: B.name ?? String(b), a_species: A.species ?? null, b_species: B.species ?? null }),
    headline: words.replace(/[0-9]/g, ''), // belt and braces: the quotable line carries no digits
    strongest,
    present_kinds: Object.freeze(present),
    missing,
    gaps: Object.freeze(gaps),
    homology_type,
    directly_tested: present.includes('rescue'),
    confidence: Object.freeze({
      lo: band.lo,
      hi: band.hi,
      label: band.label,
      label_span: Object.freeze(band.label_span),
      is_a_band_not_a_point: true,
      not_a_probability: 'There is no reference class and no calibration set behind these endpoints. They are the stated support interval for the strongest evidence kind present, nudged by corroboration and widened by what is absent. Do not multiply this by anything.',
      width_is_the_message: `the band is ${r2(band.hi - band.lo)} wide because ${absent.length} of ${EVIDENCE_IDS.length} evidence kinds are absent; narrowing it means doing experiments, not re-weighting`,
      under_alternative_weighting: Object.freeze({
        lo: altBand.lo, hi: altBand.hi, label: altBand.label,
        weights: ALT_BANDS, base_intervals: ALT_BASE_BANDS,
        what_this_is: 'the same evidence under a second, equally defensible set of stated intervals and corroboration weights. Nothing about the pair changed between the two.',
      }),
      label_is_robust_to_weighting: altBand.label === band.label,
      if_the_label_moved: altBand.label === band.label
        ? 'the label survived the substitution, so on this pair the word is the evidence talking rather than our weighting'
        : `the label moved from "${band.label}" to "${altBand.label}" on identical evidence. That difference is ours, not the biology\'s, and it is the reason this module reports a band rather than a number`,
      weighting_used: BANDS,
      base_intervals_used: Object.freeze(Object.fromEntries(EVIDENCE_IDS.map(k => [k, EVIDENCE_KINDS[k].band]))),
    }),
    fused_scalar: null,
    score: null,
    probability: null,
    why_no_fused_scalar: WHY_NOT_ONE_NUMBER,
    unknown_evidence_kinds: Object.freeze(unknown),
  });
}

// =====================================================================================================
// 6. CLASSIFICATION
// =====================================================================================================

/**
 * Put a pair in exactly one class, and say what would move it up.
 *
 * Order of precedence matters and is the opposite of what a scoring function would do. The one-to-many
 * test comes BEFORE the rescue test: a rescue experiment on one member of a duplicate pair is a real
 * result about that member and still does not make it "the" orthologue, so a one-to-many pair cannot
 * reach the functional-equivalence class however good its other evidence is.
 *
 * @param {object} pair {id, a, b, claim, evidence, databases_searched, developmental_context, analogue_search}
 */
export function classify(pair) {
  const p = pair || {};
  const { evidence: ev } = normaliseEvidence(p.evidence);
  const has = k => ev[k]?.present === true;
  const orth = ev['sequence-orthology'];
  const ht = orth?.present ? (orth.homology_type ?? null) : 'none';
  const verdict = scoreAnalogy(p.a, p.b, p.evidence);

  let id, why;
  if (!verdict.present_kinds.length) {
    id = 'no-basis';
    why = 'no evidence of any of the seven kinds is recorded for this pair';
  } else if (orth?.present && AMBIGUOUS_HOMOLOGY_TYPES.includes(ht)) {
    id = 'one-to-many-ambiguous';
    why = `the orthology relationship is ${ht}, so "the orthologue" does not pick out a single gene; no functional-equivalence statement is available for this pair at any evidence level`;
  } else if (orth?.present && !ht) {
    id = 'one-to-many-ambiguous';
    why = 'an orthology claim with no stated homology type is treated as ambiguous rather than as one-to-one, because the ambiguous case is the one that fails at the bench';
  } else if (orth?.present && ht === 'paralog') {
    id = 'paralogous-candidate';
    why = 'the two genes are related by duplication, not by speciation; after subfunctionalisation the paralogue may nonetheless be the functional stand-in';
  } else if (orth?.present && ht === 'one-to-one') {
    if (has('rescue')) { id = 'orthologous-and-functionally-tested'; why = 'a one-to-one orthologue whose function has been tested directly by rescue or complementation'; }
    else { id = 'orthologous-untested'; why = 'a one-to-one orthologue supported only by correlates of function; no direct functional test'; }
  } else if (verdict.present_kinds.some(k => FUNCTION_BEARING.includes(k))) {
    id = 'convergent-analogue';
    why = 'function-bearing evidence with no orthology between the two sides: shared function without shared ancestry, which is what analogy means';
  } else if (has('positional-correspondence')) {
    id = 'positional-only';
    why = 'the only evidence is that the two structures occupy corresponding positions; nothing about function or ancestry';
  } else {
    id = 'no-basis';
    why = 'the only evidence present is about ancestry or genomic neighbourhood and no orthology relationship was asserted, which leaves nothing to classify';
  }

  const C = CLASSES[id];
  const out = {
    pair_id: p.id ?? null,
    class: id,
    why,
    means: C.means,
    functional_equivalent: C.functional_equivalent === true,
    upgrade: C.upgrade,
    confidence: verdict.confidence,
    strongest: verdict.strongest,
    missing_kinds: Object.freeze(verdict.missing.map(m => m.kind)),
    gaps: verdict.gaps,
    homology_type: ht,
    refusals: refuse(p).refusals,
  };
  if (C.critical_warning) out.critical_warning = C.critical_warning;
  if (C.functional_equivalent_note) out.functional_equivalent_note = C.functional_equivalent_note;
  if (id === 'one-to-many-ambiguous') out.see = 'THE_ZEBRAFISH_PROBLEM';
  return Object.freeze(out);
}

// =====================================================================================================
// 7. THE REFUSALS
// =====================================================================================================

export const REFUSAL_IDS = Object.freeze([
  'one-to-many-is-not-equivalence',
  'identity-alone-is-not-function',
  'phenotype-transfer-without-context',
  'absence-of-evidence',
]);

/**
 * What this module will not do with a pair, whatever is asked of it.
 *
 * Each refusal names the inference, why it does not hold, and the one thing that would change the
 * answer. A refusal with no stated remedy is an obstruction rather than a finding.
 */
export function refuse(pair) {
  const p = pair || {};
  const { evidence: ev } = normaliseEvidence(p.evidence);
  const has = k => ev[k]?.present === true;
  const orth = ev['sequence-orthology'];
  const ht = orth?.present ? (orth.homology_type ?? null) : 'none';
  const refusals = [];

  // ---- 1. A one-to-many orthologue is not a functional equivalent of anything. ----
  if (orth?.present && (AMBIGUOUS_HOMOLOGY_TYPES.includes(ht) || !ht)) {
    refusals.push(Object.freeze({
      id: 'one-to-many-is-not-equivalence',
      refusal: `REFUSED: will not call this pair a functional equivalence. The orthology relationship is ${ht ?? 'unstated, therefore treated as ambiguous'}.`,
      because: 'When one gene corresponds to several, "the orthologue" has no referent. Picking a member is not an approximation of a true answer; there is no single true answer to approximate. And if the copies split the ancestral function (Force 1999), no member does the whole job, so no member is the equivalent even in principle.',
      and: 'This refusal does not weaken with more evidence. A rescue by one member is a real result about that member and still leaves the set ambiguous, so it cannot promote the pair.',
      what_would_change_it: 'Carry the SET as the mapping. To go further, establish the division of labour: expression comparison between the copies in the tissue of interest, single AND double loss of function in one assay, and each copy\'s transcript measured in the other\'s mutant so that redundancy is separated from transcriptional adaptation (Rossi 2015, El-Brolosy 2019). If one copy then demonstrably carries the function, re-ask that copy as a paralogous-candidate pair.',
      see: 'THE_ZEBRAFISH_PROBLEM',
    }));
  }

  // ---- 2. Function is not inferred from sequence identity alone. ----
  const identity = orth?.identity ?? null;
  const onlyAncestry = verdictOnlyAncestry(ev);
  if (orth?.present && identity !== null && identity < IDENTITY_FLOOR) {
    refusals.push(Object.freeze({
      id: 'identity-alone-is-not-function',
      refusal: `REFUSED: will not infer function from a pairwise identity of ${identity} alone. The stated floor is ${IDENTITY_FLOOR}.`,
      because: `Below roughly ${IDENTITY_FLOOR} identity, alignment-based inference is in the twilight zone (Rost 1999): the HOMOLOGY claim itself is unreliable, so a functional inference drawn from it is drawn from something not established to be a relationship at all.`,
      the_floor_is_not_a_ceiling: 'Above the floor, identity still does not establish function. The floor bounds the ancestry inference; it places no bound on the function inference, and reading "identity above the floor, therefore same job" is the central error this module exists to block. This repo has its own instance: sequences/gliders.json finds 0 of 532 interface positions that separate gliders from non-gliders - the sequence carried no signal for the function at all.',
      what_would_change_it: 'A structure-informed alignment or an HMM-profile match to establish homology at all, plus independent function-bearing evidence. Identity is never upgraded by being larger.',
    }));
  } else if (onlyAncestry && orth?.present) {
    refusals.push(Object.freeze({
      id: 'identity-alone-is-not-function',
      refusal: 'REFUSED: will not infer function. Every piece of evidence present is about ancestry or genomic neighbourhood; none of it bears on what either gene does.',
      because: 'Orthology, synteny and domain architecture are three readouts of one fact - shared descent. Stacking them raises confidence in the history and leaves the functional claim exactly where it was. The ortholog conjecture that would bridge the gap is a conjecture and has been tested with mixed results (Nehrt 2011; Stamboulian 2020); Kachroo 2015 puts the replaceability rate for tested essential orthologues at about half.',
      what_would_change_it: 'Any function-bearing evidence: an expression-domain comparison, matching loss-of-function phenotypes, or - decisively - a rescue.',
    }));
  }

  // ---- 3. No phenotype transfer without the developmental-context difference. ----
  if (has('lof-phenotype') || p.claim === 'phenotype-transfer') {
    const dc = p.developmental_context || {};
    if (dc.difference_stated !== true) {
      refusals.push(Object.freeze({
        id: 'phenotype-transfer-without-context',
        refusal: 'REFUSED: will not transfer a phenotype across these species. The developmental-context difference is not stated.',
        because: 'The same gene perturbation produces different phenotypes in different developmental contexts, and the context differs between any two species worth comparing: the stage at which the gene acts, the signalling environment it acts in, the cell types present, the paralogues available to compensate, the duration of the window, and whether the structure being scored even exists in both. A phenotype transferred without naming those differences is a prediction with its own premises hidden.',
        what_must_be_stated: ['the stage at which the gene acts, in each species, on a named staging series', 'the tissue and - where it can be had - the cell type, in each species', 'what paralogues are present in each species that could compensate', 'whether the structure being scored is present in both, and if not, what is being scored instead', 'whether the phenotype was scored in the same assay, or two assays sharing a word'],
        what_would_change_it: 'State them, as a context difference rather than a context match, and carry it with the prediction. A pair that genuinely has no relevant context difference is a pair where that has been checked and written down.',
      }));
    }
  }

  // ---- 4. "No orthologue found" is not "no functional analogue exists". ----
  const dbs = Array.isArray(p.databases_searched) ? p.databases_searched : [];
  const noOrth = !orth?.present || ht === 'none';
  const analogueSearched = p.analogue_search?.performed === true;
  if (noOrth && (dbs.length < MIN_DATABASES || !analogueSearched)) {
    refusals.push(Object.freeze({
      id: 'absence-of-evidence',
      refusal: 'REFUSED: will not read "no orthologue found" as "no functional analogue exists".',
      because: 'Two separate failures. (a) Searching one database is not searching: orthology calls disagree between methods on identical genomes (Altenhoff 2016), so a single negative is a property of one method\'s graph, not of the genomes. ' +
        `Here ${dbs.length} resource${dbs.length === 1 ? '' : 's'} ${dbs.length ? `(${dbs.join(', ')}) ` : ''}${dbs.length === 1 ? 'was' : 'were'} searched against a stated minimum of ${MIN_DATABASES} plus a synteny check at the expected locus. ` +
        '(b) Even a complete and correct orthology negative is a statement about ANCESTRY. Functional analogy does not require ancestry - convergent analogues have no orthology by construction - so an orthology search cannot in principle detect the class of analogue this programme most wants to find.',
      the_asymmetry: 'A positive orthology hit is evidence of something. A negative is evidence of nothing about function. They are not two directions of one test.',
      what_would_change_it: `Search ${MIN_DATABASES} independent orthology resources and check synteny at the expected locus, which upgrades the negative to a statement about the genomes. Then run the FUNCTION-first search, which is a different search and the one that matters: ask which gene or structure in the host performs the job - by expression, by phenotype, or by assay - without going through ancestry at all.` +
        (analogueSearched ? '' : ' That function-first search is recorded here as NOT performed.'),
    }));
  }

  return Object.freeze({
    pair_id: p.id ?? null,
    refused: refusals.length > 0,
    refusals: Object.freeze(refusals),
    note: refusals.length
      ? 'A refusal is not a verdict that the mapping is false. It is a verdict that the evidence offered cannot carry the claim asked of it.'
      : 'No refusal fires for this pair as specified. That is not an endorsement; read the class and the band.',
  });
}

const verdictOnlyAncestry = ev => {
  const present = EVIDENCE_IDS.filter(k => ev[k]?.present === true);
  return present.length > 0 && present.every(k => !FUNCTION_BEARING.includes(k));
};

// =====================================================================================================
// 8. AN OPTIONAL BRIDGE TO fetch.mjs
// =====================================================================================================
//
// A sibling module owns analogues/fetch.mjs. It may not exist, may not export what is expected, and must
// not be able to stop this module loading or its tests running. So the import is dynamic, guarded, and
// its absence is reported as a fact about the module rather than swallowed.

let _fetchMod = null, _fetchWhy = 'not attempted';
try {
  _fetchMod = await import('./fetch.mjs');
  _fetchWhy = 'loaded';
} catch (e) {
  _fetchMod = null;
  _fetchWhy = `analogues/fetch.mjs did not load (${e?.code ?? e?.name ?? 'error'}); every function here runs without it`;
}

export const FETCH_STATUS = Object.freeze({ available: _fetchMod !== null, why: _fetchWhy, exports: _fetchMod ? Object.freeze(Object.keys(_fetchMod)) : Object.freeze([]) });

/**
 * Ask fetch.mjs for orthology evidence, if it is there and exposes something that looks like it.
 * Returns an evidence record for the 'sequence-orthology' slot, or a stated unavailability. It never
 * invents a homology_type: an unavailable lookup yields no evidence, not optimistic evidence.
 */
export async function orthologyEvidence(a, b, opts = {}) {
  if (!_fetchMod) return Object.freeze({ available: false, why: _fetchWhy, evidence: null });
  const fn = ['orthologs', 'orthologues', 'orthology', 'fetchOrthologs'].map(n => _fetchMod[n]).find(f => typeof f === 'function');
  if (!fn) return Object.freeze({ available: false, why: `analogues/fetch.mjs loaded but exports no orthology function (saw: ${Object.keys(_fetchMod).join(', ') || 'nothing'})`, evidence: null });
  try {
    const r = await fn(a, b, opts);
    const n = Array.isArray(r?.matches) ? r.matches.length : null;
    return Object.freeze({
      available: true,
      raw: r,
      evidence: Object.freeze({
        present: !!n,
        homology_type: n === null ? null : (n === 1 ? 'one-to-one' : 'one-to-many'),
        homology_type_note: 'derived from the number of matches returned by one resource. That is a weak basis for the distinction that matters most here; a synteny check and a second resource are what settle it.',
        source: 'analogues/fetch.mjs',
      }),
    });
  } catch (e) {
    return Object.freeze({ available: false, why: `the orthology lookup threw: ${e?.message ?? e}`, evidence: null });
  }
}

// =====================================================================================================
// 9. WORKED EXAMPLES
// =====================================================================================================
//
// Hand-specified, real pairs. The evidence is hardcoded, and the rule applied throughout is: an
// experiment this repo cannot point to is marked ABSENT, never asserted. Where the literature offers an
// attribution rather than a measurement - as it does for the kcnk5a/kcnk5b redundancy - that is recorded
// as a hypothesis in `note` and the evidence slot stays absent.

export const PAIRS = Object.freeze([
  Object.freeze({
    id: 'cdc2-CDK1',
    a: { species: 'Schizosaccharomyces pombe', name: 'cdc2' },
    b: { species: 'Homo sapiens', name: 'CDK1' },
    claim: 'functional-equivalence',
    note: 'The human gene was CLONED by its ability to complement a fission-yeast cdc2 mutant (Lee & Nurse 1987), which is rescue as the primary result rather than as a follow-up. Kachroo 2015 is the base rate this sits against: across 414 essential yeast genes, about half of the human orthologues could do the job and about half could not.',
    developmental_context: { difference_stated: true, a: 'unicellular fission yeast, mitotic cycle', b: 'human cell, mitotic cycle; no developmental context on either side, which is why this pair is clean and also why it is the easiest case in the list' },
    databases_searched: ['Ensembl Compara', 'OrthoDB', 'PANTHER'],
    analogue_search: { performed: true },
    evidence: {
      'rescue': { present: true, direction: 'human CDK1 complements a S. pombe cdc2 temperature-sensitive mutant', assay: 'restoration of cell-cycle progression / viability', source: 'lee_nurse_1987' },
      'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.62, source: 'Ensembl Compara' },
      'domain-architecture': { present: true, what: 'protein kinase domain, CDK family', source: 'Pfam PF00069' },
      'expression-domain': { present: false, why: 'not comparable: there is no shared tissue vocabulary between a unicellular yeast and a human' },
      'lof-phenotype': { present: false, why: 'no matched loss-of-function comparison recorded here' },
      'synteny': { present: false, why: 'no synteny between these genomes at this evolutionary distance' },
      'positional-correspondence': { present: false },
    },
  }),
  Object.freeze({
    id: 'KCNK5-mouse',
    a: { species: 'Homo sapiens', name: 'KCNK5' },
    b: { species: 'Mus musculus', name: 'Kcnk5' },
    claim: 'functional-equivalence',
    note: 'The clean one-to-one case with no functional test. It is here to show what the ladder\'s second rung looks like: four correlates, no experiment, and the band stays short of "strong" because of what is missing rather than because of anything that was found.',
    developmental_context: { difference_stated: true, a: 'human, two-pore potassium channel', b: 'mouse, same; the species are close enough that stage and tissue correspondences are conventional, which is itself an assumption and is stated as one' },
    databases_searched: ['Ensembl Compara', 'OrthoDB', 'PANTHER', 'Alliance of Genome Resources'],
    analogue_search: { performed: true },
    evidence: {
      'sequence-orthology': { present: true, homology_type: 'one-to-one', identity: 0.91, source: 'Ensembl Compara' },
      'synteny': { present: true, what: 'conserved neighbourhood', source: 'Ensembl Compara synteny' },
      'domain-architecture': { present: true, what: 'two pore-forming domains, four transmembrane segments, K2P family' },
      'expression-domain': { present: true, what: 'overlapping tissue-level expression', caveat: 'tissue-level only; no cell-type correspondence established' },
      'rescue': { present: false, why: 'no cross-species complementation experiment recorded here. This is the one absence that matters and it is the whole reason this pair is not on the top rung.' },
      'lof-phenotype': { present: false, why: 'no matched loss-of-function comparison recorded here' },
      'positional-correspondence': { present: false },
    },
  }),
  Object.freeze({
    id: 'KCNK5-kcnk5b',
    a: { species: 'Homo sapiens', name: 'KCNK5' },
    b: { species: 'Danio rerio', name: 'kcnk5b' },
    claim: 'functional-equivalence',
    note: 'The pair the design work actually runs on, and the instance of THE_ZEBRAFISH_PROBLEM. kcnk5a and kcnk5b both map to this one human gene (crossgraph/README.md). kcnk5b carries a gain-of-function sufficiency claim in this repo (alf alleles, Perathoner 2014); its loss-of-function phenotype is absent and the literature attributes the absence to redundancy with kcnk5a - an attribution, not a measurement, so the lof slot stays absent here.',
    developmental_context: { difference_stated: false, why_not: 'no stage correspondence is stated between human channel expression and the zebrafish pectoral fin bud, and genotype/CAUSAL.md records that there is no electrophysiological recording from any zebrafish fin or fin-bud cell and no cell-type-resolved node for the structure' },
    databases_searched: ['Ensembl Compara', 'ZFIN', 'Alliance of Genome Resources'],
    analogue_search: { performed: true },
    evidence: {
      'sequence-orthology': { present: true, homology_type: 'one-to-many', n_on_b_side: 2, members: ['kcnk5a', 'kcnk5b'], identity: 0.68, source: 'crossgraph/README.md; Ensembl Compara' },
      'domain-architecture': { present: true, what: 'K2P two-pore architecture on both sides' },
      'expression-domain': { present: false, why: 'no expression comparison between the two zebrafish copies in the pectoral fin is held in this repo, so the division of labour is unknown' },
      'rescue': { present: false, why: 'no complementation experiment in either direction recorded here' },
      'lof-phenotype': { present: false, why: 'the kcnk5b loss-of-function phenotype is ABSENT, which is consistent with redundancy, with transcriptional adaptation, and with dispensability; nothing recorded distinguishes them' },
      'synteny': { present: false, why: 'no synteny analysis of the pair is held here - which is exactly what would distinguish an ohnolog pair from a later local duplication' },
      'positional-correspondence': { present: false },
    },
  }),
  Object.freeze({
    id: 'kcnk5b-kcnk5a',
    a: { species: 'Danio rerio', name: 'kcnk5b' },
    b: { species: 'Danio rerio', name: 'kcnk5a' },
    claim: 'functional-stand-in',
    note: 'The within-species duplicate pair itself. The question is not ancestry, which is settled - they are paralogues - but whether kcnk5a covers the job kcnk5b does. The literature uses that coverage to explain a missing phenotype, which makes it a hypothesis the missing phenotype was recruited to support rather than an independent result.',
    developmental_context: { difference_stated: true, a: 'Danio rerio, pectoral and median fins', b: 'same species and stage, so there is no cross-species context difference; the relevant unknown is the expression difference BETWEEN the copies, and it is unmeasured here' },
    databases_searched: ['Ensembl Compara', 'ZFIN', 'Alliance of Genome Resources'],
    analogue_search: { performed: true },
    evidence: {
      'sequence-orthology': { present: true, homology_type: 'paralog', identity: 0.64, source: 'Ensembl Compara; both map to human KCNK5' },
      'domain-architecture': { present: true, what: 'K2P two-pore architecture in both' },
      'rescue': { present: false, why: 'no experiment in which kcnk5a is shown to substitute for kcnk5b' },
      'lof-phenotype': { present: false, why: 'no double loss-of-function scored in one assay; the single kcnk5b loss is phenotypically silent and that silence is the only evidence offered for the redundancy' },
      'expression-domain': { present: false, why: 'no comparison of the two copies\' expression domains is held here' },
      'synteny': { present: false },
      'positional-correspondence': { present: false },
    },
  }),
  Object.freeze({
    id: 'insect-wing-pectoral-fin',
    a: { species: 'Drosophila melanogaster', name: 'wing (dorsal thoracic appendage)' },
    b: { species: 'Exocoetidae', name: 'enlarged pectoral fin' },
    claim: 'convergent-analogy',
    note: 'A convergent pair with ZERO orthology between the structures, and the shape of case this programme exists for: two lineages generating lift in air from non-corresponding parts. The honest complication is reported rather than hidden: deep homology (Shubin 2009) means appendage outgrowth in insects and vertebrates shares regulatory machinery at a level below the structures, and that neither makes the structures homologous nor makes the convergence less real.',
    developmental_context: { difference_stated: true, a: 'imaginal disc evagination from the body wall of a holometabolous insect', b: 'vertebrate paired-appendage bud with an apical fold and dermal rays; different germ layers of origin, different signalling centres, no stage correspondence of any kind' },
    databases_searched: ['Ensembl Compara', 'OrthoDB', 'PANTHER'],
    analogue_search: { performed: true },
    evidence: {
      'sequence-orthology': { present: false, why: 'the structures are not gene products and have no orthology relationship; this is the point of the case, not a gap in it' },
      'synteny': { present: false, why: 'not applicable to a structure pair' },
      'expression-domain': { present: false, why: 'no cross-phylum cell-type or tissue correspondence exists to compare against' },
      'domain-architecture': { present: false, why: 'not applicable to a structure pair' },
      'lof-phenotype': { present: true, what: 'removal or reduction of the structure abolishes aerial locomotion in each lineage', caveat: 'two different assays sharing a description; "abolishes aerial locomotion" is scored by different means in an insect and a fish and the comparison is qualitative' },
      'positional-correspondence': { present: false, why: 'there is none: a thoracic body-wall outgrowth and a paired pectoral appendage do not occupy corresponding positions, which is why this is analogy and not homology' },
      'rescue': { present: false, why: 'no meaningful rescue experiment exists for a structure pair at this distance' },
    },
  }),
  Object.freeze({
    id: 'afgp-notothenioid-gadid',
    a: { species: 'Dissostichus mawsoni', name: 'antifreeze glycoprotein (AFGP)' },
    b: { species: 'Boreogadus saida', name: 'antifreeze glycoprotein (AFGP)' },
    claim: 'convergent-analogy',
    note: 'The cleanest convergence available: the two proteins are chemically near-identical and perform the same function, and they were built from different ancestral sequences in different oceans (Chen, DeVries & Cheng 1997; Zhuang 2019 traces the northern gadid gene to a non-coding ancestor). Same function, same molecule, zero orthology. A framework that reads function through orthology scores this pair at nothing.',
    developmental_context: { difference_stated: true, a: 'notothenioid, Southern Ocean, AFGP derived from a trypsinogen-like ancestor', b: 'northern gadid, Arctic, AFGP derived from a non-coding ancestral sequence; the two origins are independent and the context difference is the entire finding' },
    databases_searched: ['Ensembl Compara', 'OrthoDB', 'PANTHER'],
    analogue_search: { performed: true },
    evidence: {
      'sequence-orthology': { present: false, why: 'independent origins from different ancestral sequences: there is no orthology, and the similarity of the mature proteins is convergence at the level of the repeat, not descent' },
      'domain-architecture': { present: true, what: 'the same Thr-Ala/Pro-Ala tripeptide repeat with the same disaccharide, in both' },
      'expression-domain': { present: true, what: 'secreted into blood and body fluids in both' },
      'lof-phenotype': { present: false, why: 'no loss-of-function experiment in either species recorded here; these are wild polar fishes and the assay would be a different kind of study' },
      'rescue': { present: false, why: 'no cross-species complementation recorded here. The biophysical activity is measured directly in both, which is strong - but it is a biochemical measurement of each protein alone and not a test that one can do the other\'s job in the other\'s organism.' },
      'synteny': { present: false },
      'positional-correspondence': { present: false },
    },
  }),
  Object.freeze({
    id: 'endoskeletal-disc-autopod',
    a: { species: 'Danio rerio', name: 'pectoral fin endoskeletal disc' },
    b: { species: 'Mus musculus', name: 'autopod (hand/foot skeleton)' },
    claim: 'structural-correspondence',
    note: 'Here the only evidence is position in the appendage. Nakamura 2016 reported that Hoxa13-lineage cells contribute to fin rays, which is an attempt to break out of position into lineage, and it remains contested; this repo holds no independent evidence either way, so the lineage claim is not entered as evidence and the pair stays positional. That is the point of having the class.',
    developmental_context: { difference_stated: true, a: 'zebrafish pectoral fin bud: endoskeletal disc distal to the proximal radials, with dermal rays beyond it', b: 'mouse limb bud: autopod distal to the zeugopod; the question of what corresponds to what across the fin-to-limb transition is the open question itself, not a settled frame' },
    databases_searched: ['Ensembl Compara', 'OrthoDB', 'PANTHER'],
    analogue_search: { performed: true },
    evidence: {
      'positional-correspondence': { present: true, what: 'both are the distal-most endoskeletal territory of a paired appendage', caveat: 'assigned under a proximal-distal correspondence between fin and limb that is itself the thing in question; this is the circularity the positional-only class exists to flag' },
      'sequence-orthology': { present: false, why: 'not a gene pair' },
      'synteny': { present: false, why: 'not applicable to a structure pair' },
      'expression-domain': { present: false, why: 'no comparison entered here; the Hoxa13 lineage result (Nakamura 2016) is contested and is deliberately not counted as evidence by this module' },
      'domain-architecture': { present: false, why: 'not applicable' },
      'lof-phenotype': { present: false, why: 'none entered' },
      'rescue': { present: false, why: 'not applicable to a structure pair' },
    },
  }),
  Object.freeze({
    id: 'and1-mouse-limb',
    a: { species: 'Danio rerio', name: 'and1 (actinodin 1)' },
    b: { species: 'Mus musculus', name: '(nothing nominated)' },
    claim: 'no-analogue-exists',
    note: 'The absence-of-evidence case, and deliberately the tempting version of it. The orthology negative here is genuinely well supported in the literature - Zhang 2010 reports that the actinodin genes have no tetrapod counterpart, as a gene loss - which makes the slide from "no orthologue" to "no functional analogue" MORE attractive rather than less. The slide is still invalid: the question of what, if anything, performs the actinotrichia-scaffolding job in a mouse limb bud has not been asked here, and a function-first search is a different search from an orthology lookup. Marked `analogue_search.performed: false` because it was not performed.',
    developmental_context: { difference_stated: false, why_not: 'nothing on the mouse side has been nominated, so there is no second context to state' },
    databases_searched: ['Ensembl Compara'],
    analogue_search: { performed: false, why: 'no function-first search for a mouse structure or gene performing the actinotrichia-scaffolding role has been run' },
    evidence: {
      'sequence-orthology': { present: false, homology_type: 'none', why: 'no tetrapod counterpart; reported as a loss (Zhang 2010). Well supported in the literature, and still only a statement about ancestry.' },
      'synteny': { present: false, why: 'no synteny check at the expected locus is held here' },
      'expression-domain': { present: false },
      'domain-architecture': { present: false },
      'lof-phenotype': { present: false },
      'rescue': { present: false },
      'positional-correspondence': { present: false },
    },
  }),
]);

/**
 * Run the classifier over PAIRS and return the distribution of classes, plus what the distribution
 * does and does not show. The distribution is a property of the pairs chosen, not of biology, and
 * saying so is part of the output.
 */
export function worked() {
  const rows = PAIRS.map(p => {
    const c = classify(p);
    return Object.freeze({
      id: p.id,
      a: `${p.a.species}:${p.a.name}`,
      b: `${p.b.species}:${p.b.name}`,
      class: c.class,
      functional_equivalent: c.functional_equivalent,
      homology_type: c.homology_type,
      strongest: c.strongest?.kind ?? null,
      directly_tested: c.strongest?.directly_tests_function === true,
      band: [c.confidence.lo, c.confidence.hi],
      band_label: c.confidence.label,
      label_robust_to_weighting: c.confidence.label_is_robust_to_weighting,
      n_refusals: c.refusals.length,
      refusals: Object.freeze(c.refusals.map(r => r.id)),
      upgrade: c.upgrade,
    });
  });
  const distribution = Object.fromEntries(CLASS_IDS.map(c => [c, rows.filter(r => r.class === c).length]));
  return Object.freeze({
    n: rows.length,
    distribution: Object.freeze(distribution),
    classes_unreached: Object.freeze(CLASS_IDS.filter(c => distribution[c] === 0)),
    n_functional_equivalents: rows.filter(r => r.functional_equivalent).length,
    n_directly_tested: rows.filter(r => r.directly_tested).length,
    n_with_refusals: rows.filter(r => r.n_refusals > 0).length,
    n_labels_not_robust_to_weighting: rows.filter(r => r.label_robust_to_weighting === false).length,
    rows: Object.freeze(rows),
    what_this_distribution_shows:
      'That the seven classes are reachable by real pairs, that exactly one of these eight pairs clears the ' +
      'bar for functional equivalence, and that it clears it because of a rescue experiment and not because ' +
      'of the quality of its orthology.',
    what_it_does_not_show:
      'Any base rate. These pairs were hand-chosen to populate the classes, so the distribution is a property ' +
      'of the choosing. A real base rate would need a pair set sampled without knowing the answers, and this is not that.',
    the_uncomfortable_row:
      'KCNK5-kcnk5b is the mapping this repo\'s design work actually depends on, and it lands in ' +
      'one-to-many-ambiguous with no functional test and no synteny analysis. The module was built partly to ' +
      'be able to say that out loud.',
  });
}

// Run directly only. `endsWith('analogy.mjs')` would also be true of test-analogy.mjs, which is how a
// module ends up printing its demo in the middle of its own test output.
const RUN_DIRECTLY = /(^|[\\/])analogy\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
  const w = worked();
  console.log(`\nanalogues/analogy.mjs - ${w.n} hand-specified pairs\n`);
  for (const r of w.rows) {
    console.log(`  ${r.id.padEnd(28)} ${r.class.padEnd(36)} band ${r.band[0]}-${r.band[1]} (${r.band_label})${r.n_refusals ? `  REFUSED: ${r.refusals.join(', ')}` : ''}`);
  }
  console.log(`\n  distribution: ${JSON.stringify(w.distribution, null, 2).replace(/\n/g, '\n  ')}`);
  console.log(`\n  classes unreached: ${w.classes_unreached.length ? w.classes_unreached.join(', ') : 'none'}`);
  console.log(`  functional equivalents: ${w.n_functional_equivalents} of ${w.n}; directly tested: ${w.n_directly_tested}; pairs with refusals: ${w.n_with_refusals}`);
  console.log(`  labels that change under the alternative weighting: ${w.n_labels_not_robust_to_weighting}`);
  console.log(`\n  ${w.the_uncomfortable_row}`);
  console.log(`\n  fetch.mjs: ${FETCH_STATUS.available ? `available (${FETCH_STATUS.exports.join(', ')})` : FETCH_STATUS.why}\n`);
}
