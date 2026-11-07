#!/usr/bin/env node
// analogues/combos/pairs/anoxia-ethanol.mjs
//
// Two analogy-pair dossiers in the schema of analogues/analogy.mjs PAIRS, both drawn from the same
// design question: can DELPHI borrow an extreme oxygen-budget trait into Danio rerio, the host it
// designs in? One pair is a GAIN by gene duplication plus neofunctionalisation; the other is a LOSS.
// They fail in opposite directions, and the two failures are the reason both are here.
//
//   node analogues/combos/pairs/anoxia-ethanol.mjs        # print the two verdicts
//   node analogues/combos/pairs/test-anoxia-ethanol.mjs [--fail-once]
//
// ============================== WHAT WAS ACTUALLY RETRIEVED ==============================
// Every citation in SOURCES was fetched in the session that wrote this file, and every source carries
// a `verified_how` saying what was read back from it. Where a fact could not be read back, the slot it
// would have filled is marked present:false with a `why`. Two things were specifically NOT established
// and are recorded as absences rather than guessed:
//   * which of the two zebrafish pdha1 genes is the closer relative of the crucian carp PDC paralogue.
//     Fagernes et al. 2017 report the clade structure but give no zebrafish gene symbol or accession
//     for either zebrafish paralogue, and no tree was built here. See THE_CLADE_IS_NOT_A_MAPPING.
//   * which locus in the current Carassius carassius reference annotation IS PDHE1alpha3. The paper
//     cloned transcripts and deposited them; the reference assembly was annotated afterwards and its
//     four E1-alpha-family loci were not matched to the paper's subscripts here. See THE_SUBSCRIPT_GAP.
//
// ============================== THE TWO FINDINGS ==============================
// 1. THE_ZEBRAFISH_PROBLEM is worse than one-to-many in the carp case: it is MANY-TO-MANY, and the
//    phylogeny that could narrow it puts the carp HOUSEKEEPING paralogue and the carp NEOFUNCTIONALISED
//    paralogue in the SAME clade. So the single zebrafish gene in that clade is equally the nominal
//    orthologue of the gene that makes acetyl-CoA and the gene that makes acetaldehyde. Orthology does
//    not merely fail to pick a host target here; it cannot even separate the two donor functions.
// 2. The module's evidence vocabulary CANNOT express a gene loss. See LOSS_IS_NOT_IN_THE_VOCABULARY.
//    `present: false` is a claim about the evidence, not about the gene, so "measured to be absent" and
//    "not looked for" land in the same slot - and for the icefish globin locus the measured absence is
//    the best-evidenced fact in the pair. The pair bands at the floor for a reason that is about the
//    schema and not about the biology, and the no-basis class then attaches a warning that is false here.

import { scoreAnalogy, classify, refuse, EVIDENCE_IDS, HOMOLOGY_TYPES, AMBIGUOUS_HOMOLOGY_TYPES } from '../../analogy.mjs';

// =====================================================================================================
// SOURCES
// =====================================================================================================
// Retrieved this session. PubMed and PubMed Central were queried through the PubMed MCP tools; Ensembl,
// NCBI Gene (E-utilities) and ZFIN were fetched live. `verified_how` says what was read back.

export const SOURCES = Object.freeze({
  fagernes_2017: Object.freeze({
    cite: 'Fagernes, C.E., Stenslokken, K.-O., Rohr, A.K., Berenbrink, M., Ellefsen, S. & Nilsson, G.E. (2017) Extreme anoxia tolerance in crucian carp and goldfish through neofunctionalization of duplicated genes creating a new ethanol-producing pyruvate decarboxylase pathway. Scientific Reports 7:7884.',
    pmid: '28801642',
    pmcid: 'PMC5554223',
    doi: '10.1038/s41598-017-07385-4',
    verified_how: 'PubMed metadata retrieved for PMID 28801642 (title, journal "Scientific reports" 7(1):7884, 2017-08-11, six authors, DOI 10.1038/s41598-017-07385-4, PMCID PMC5554223). Full text retrieved from PMC5554223 and read. The PMC plain-text extraction strips subscripts, so the paralogue designations were read back a second time from the PMC HTML, which returned: three E1-alpha paralogues PDHE1alpha1-3; two E1-beta paralogues PDHE1beta1-2; the muscle-dominant pair is E1alpha3 + E1beta2 at 95.7 +/- 0.4% and 97.1 +/- 0.4% of total E1alpha and E1beta transcript in red muscle; brain, liver and heart are dominated by E1alpha1 or E1alpha2 with E1beta1; and for the host side, "only revealed one E1beta paralog and two E1alpha paralogs that originated from a basal split of teleost E1alpha paralogs into an E1alpha1/E1alpha3 and an E1alpha2 clade". The cyprinid paleotetraploidization is dated in the paper at approximately 8.2 MYA.',
    what_it_does_not_contain: 'No zebrafish gene symbol and no zebrafish accession for either host E1-alpha paralogue; the host paralogues are named only by clade. No rescue or complementation experiment in either direction. No enzyme assay of a purified PDHE1alpha3 protein: the functional argument is a homology model (SWISS-MODEL on PDB 3EXE and 1W85), a transcript-share measurement, a Western blot, an immuno-EM localisation, and a phosphorylation-state change.',
  }),
  cocca_1995: Object.freeze({
    cite: 'Cocca, E., Ratnayake-Lecamwasam, M., Parker, S.K., Camardella, L., Ciaramella, M., di Prisco, G. & Detrich, H.W. (1995) Genomic remnants of alpha-globin genes in the hemoglobinless antarctic icefishes. PNAS 92:1817-1821.',
    pmid: '7892183',
    pmcid: 'PMC42373',
    doi: '10.1073/pnas.92.6.1817',
    verified_how: 'PubMed metadata retrieved for PMID 7892183; abstract read back. It states that alpha- and beta-globin cDNAs from the red-blooded notothenioid Notothenia coriiceps were hybridised against genomic DNA from three white-blooded channichthyids and four red-blooded notothenioid relatives; the alpha probe hybridised to both, the beta probe only to the red-blooded genomes; and the authors propose "deletion of the single adult beta-globin locus prior to the diversification of the clade".',
  }),
  zhao_1998: Object.freeze({
    cite: 'Zhao, Y., Ratnayake-Lecamwasam, M., Parker, S.K., Cocca, E., Camardella, L., di Prisco, G. & Detrich, H.W. (1998) The major adult alpha-globin gene of antarctic teleosts and its remnants in the hemoglobinless icefishes. Journal of Biological Chemistry 273:14745-14752.',
    pmid: '9614073',
    doi: '10.1074/jbc.273.24.14745',
    verified_how: 'PubMed metadata retrieved for PMID 9614073; abstract read back. It names Chaenocephalus aceratus and Chionodraco rastrospinosus as the two species examined, states that loss of alpha1 expression results from truncation of the 5-prime end of the notothenioid alpha1-globin gene, that what is RETAINED in both icefish genomes is "a portion of intron 2, exon 3, and the 3-prime-untranslated region", and proposes "a single mutational event in the ancestral channichthyid that deleted the entire beta-globin gene and the 5-prime end of the linked alpha1-globin gene".',
  }),
  diprisco_2002: Object.freeze({
    cite: 'di Prisco, G., Cocca, E., Parker, S.K. & Detrich, H.W. (2002) Tracking the evolutionary loss of hemoglobin expression by the white-blooded Antarctic icefishes. Gene 295:185-191.',
    pmid: '12354652',
    doi: '10.1016/s0378-1119(02)00691-1',
    verified_how: 'PubMed metadata retrieved for PMID 12354652; abstract read back. It states that three channichthyid genomes retain "transcriptionally inactive alpha1-globin-related DNA sequences", that "the icefish genomes have no beta-globin genes", that Southern blots with probes flanking the embryonic/juvenile complex "indicated that icefishes have also lost embryonic/juvenile globin genes", and that the proposed cause is "a single, large-scale deletional event".',
  }),
  garofalo_2009: Object.freeze({
    cite: 'Garofalo, F., Pellegrino, D., Amelio, D. & Tota, B. (2009) The Antarctic hemoglobinless icefish, fifty five years later: a unique cardiocirculatory interplay of disaptation and phenotypic plasticity. Comparative Biochemistry and Physiology A 154:10-28.',
    pmid: '19401238',
    doi: '10.1016/j.cbpa.2009.04.621',
    verified_how: 'PubMed metadata retrieved for PMID 19401238; abstract read back. It is the source for the function-first answer used in this file: oxygen "occurs by carrying the gas physically dissolved in the plasma" is di Prisco 2002, and this review enumerates the system-level compensations as "hypervolemia, near-zero hematocrit and low blood viscosity, large bore capillaries, increased vascularity with great capacitance, cardiomegaly with very large cardiac output, high blood flow with low systemic pressure and systemic resistance". It also states the icefishes are "a unique example of disaptation among adult vertebrates".',
  }),
  ensembl_compara_pdha1: Object.freeze({
    cite: 'Ensembl Compara, via the Ensembl REST endpoint /homology/symbol/homo_sapiens/PDHA1 with target_species=danio_rerio, type=orthologues, format=condensed. Release current as fetched.',
    verified_how: 'Fetched live and the JSON read back. Source gene ENSG00000131828 (human PDHA1) returns exactly two Danio rerio homologies, ENSDARG00000010555 and ENSDARG00000012387, and the `type` field on BOTH is the literal string "ortholog_many2many" at taxonomy_level "Euteleostomi". The same endpoint for human PDHA2 (ENSG00000163114) returns the SAME two zebrafish genes, also both typed "ortholog_many2many". So Ensembl itself does not call this one-to-many; it calls it many-to-many, because there are two genes on each side.',
  }),
  ensembl_lookup_zebrafish_pdha: Object.freeze({
    cite: 'Ensembl REST /lookup/id for ENSDARG00000012387, ENSDARG00000010555 and ENSDARG00000116841, assembly GRCz11.',
    verified_how: 'Fetched live and read back. ENSDARG00000012387 = display_name "pdha1a", description "pyruvate dehydrogenase E1 subunit alpha 1a [Source:ZFIN;Acc:ZDB-GENE-040426-2719]", seq_region_name "5", 24031314-24044877, strand -1. ENSDARG00000010555 = display_name "pdha1b", description "...alpha 1b [Source:ZFIN;Acc:ZDB-GENE-040718-96]", seq_region_name "24", 24273371-24282427, strand -1. A symbol search for "pdha1a" also returned a third id, ENSDARG00000116841 - which lookup shows sits on seq_region_name "ALT_CTG5_1_14" and is sourced to "NCBI gene ... Acc:406702", i.e. the alternate-haplotype annotation of the same NCBI gene as pdha1a, not a third paralogue. Counting it would have made the family three genes instead of two.',
  }),
  ncbi_gene_zebrafish_pdh: Object.freeze({
    cite: 'NCBI Gene via E-utilities esearch/esummary, organism Danio rerio, symbols pdha1a, pdha1b, pdhb.',
    verified_how: 'Fetched live and read back. pdha1a = GeneID 406702, chromosome 5. pdha1b = GeneID 436672, chromosome 24. pdhb = GeneID 406428, chromosome 22, 10764853-10774278, "pyruvate dehydrogenase E1 subunit beta" - a single gene, which independently corroborates the "one E1beta paralog" the paper reports for the host. The two E1-alpha genes sitting on different chromosomes (5 and 24) is consistent with a whole-genome-duplication origin rather than a local tandem duplication, but no synteny analysis was run here and the coordinates alone do not establish it.',
  }),
  ncbi_gene_carassius_pdh: Object.freeze({
    cite: 'NCBI Gene and NCBI Nucleotide via E-utilities, organism Carassius carassius, reference assembly fCarCar2.1.',
    verified_how: 'Fetched live and read back. A symbol search for pdha1a / pdha1b / pdhb returns exactly ONE gene with a pdha-style symbol: pdha1b, GeneID 132124165, chromosome 42, 18853289-18857591. There is no gene symbolised pdha1a in this annotation. A nucleotide search for "pyruvate dehydrogenase" in C. carassius returns three further E1-alpha-family loci carried only as LOC identifiers with the description "pyruvate dehydrogenase E1 component subunit alpha, mitochondrial-like": LOC132141476 (chromosome 5, 36129733-36139837), LOC132141477 (chromosome 5, 36187715-36198440 - about 48 kb downstream of the previous one) and LOC132139822 (chromosome 4, 32370671-32380643). So the current reference annotation carries FOUR E1-alpha-family loci where the paper reports three cloned paralogues, and none of the four is labelled with the paper\'s subscript.',
  }),
  zfin_pdha1a: Object.freeze({
    cite: 'ZFIN gene record ZDB-GENE-040426-2719 (pdha1a), https://zfin.org/ZDB-GENE-040426-2719',
    verified_how: 'Page fetched live and read back. Name "pyruvate dehydrogenase E1 subunit alpha 1a"; Chr 5 on assembly GRCz12tu at 24685989-24701412 (note: a different assembly from the GRCz11 coordinates above, same chromosome). The record states the gene "is expressed in several structures, including adaxial cell; alar plate midbrain region; heart tube; musculature system; and pronephric duct". The Mutants and Sequence Targeting Reagents headings carry NO entries, and the Phenotype Summary and Wild Type Expression Summary sections are empty of text. No developmental stages are given for any expression entry.',
  }),
  zfin_pdha1b: Object.freeze({
    cite: 'ZFIN gene record ZDB-GENE-040718-96 (pdha1b), https://zfin.org/ZDB-GENE-040718-96',
    verified_how: 'Page fetched live and read back. Name "pyruvate dehydrogenase E1 subunit alpha 1b"; Chr 24 on GRCz12tu at 28193905-28204084; previous names fp73b04, wu:fp73b04, zgc:92705. The Mutants and Sequence Targeting Reagents headings carry no entries; under All Phenotype Data the record says "No data available" and the Phenotype Summary is empty. The Wild Type Expression Summary has no text, and the record does not mention musculature, somites or adaxial cells. So of the two host genes, only pdha1a has any recorded tissue-level expression domain, and NEITHER has a mutant allele or a targeting reagent.',
  }),
  ncbi_gene_zebrafish_globins: Object.freeze({
    cite: 'NCBI Gene via E-utilities, organism Danio rerio, title term "hemoglobin", live genes only.',
    verified_how: 'Fetched live; 17 genes returned and their coordinates read back, sorted. THIRTEEN sit in one cluster on chromosome 3 between about 58.39 and 58.45 Mb: hbba2 (445037), hbaa2 (497166), ba1l (504174), hbaa1 (30507), hbba1 (30216), hbba1.2 (497162), hbbe1.1 (81538), hbae1.1 (30597), hbbe1.2 (793447), hbae1.2 (572729), hbbe1.3 (573653), hbae1.3 (100334599), hbae3 (30601). FOUR sit in a second cluster on chromosome 12 between about 22.62 and 22.64 Mb: hbae4 (563335), hbbe3 (30596), hbbe2 (405772), hbae5 (561790). The adult and embryonic alpha genes are interleaved within the chromosome-3 cluster - hbaa1 at 58399730 and hbae1.1 at 58420680, about 20 kb apart - so "the adult cluster" and "the embryonic cluster" are not two separable loci on this assembly.',
  }),
});

// =====================================================================================================
// THE TWO FINDINGS, STATED BEFORE THE PAIRS THAT PRODUCED THEM
// =====================================================================================================

/**
 * Why the one-to-many problem is not softened by the phylogeny in the carp case, but sharpened.
 */
export const THE_CLADE_IS_NOT_A_MAPPING = Object.freeze({
  what_the_paper_establishes: 'Fagernes 2017 reports that the two host E1-alpha paralogues "originated from a basal split of teleost E1alpha paralogs into an E1alpha1/E1alpha3 and an E1alpha2 clade". So one host gene sits in the clade that contains the donor PDC paralogue and one does not.',
  why_that_looks_like_a_resolution: 'It appears to narrow a two-gene ambiguity to one gene: pick the host paralogue in the E1alpha1/E1alpha3 clade and you have "the" counterpart of the donor gene.',
  why_it_is_not: [
    'The paper gives no zebrafish gene symbol and no accession for either host paralogue. The clade labels are the only identification offered, so the published record does not say whether pdha1a or pdha1b is the one in that clade, and no tree was built here to decide it. The SHAPE of the relationship is reported; the IDENTITY of the member is not.',
    'The clade that contains the donor PDC paralogue (E1alpha3) ALSO contains the donor housekeeping paralogue (E1alpha1) - the copy that kept the acetyl-CoA-producing function inside the intact complex. Whichever single host gene sits in that clade is therefore the nominal orthologue of BOTH donor functions at once. Orthology here cannot separate the gene whose product makes acetyl-CoA from the gene whose product makes acetaldehyde, which is exactly the distinction a borrow would have to make.',
    'The counts make the relationship many-to-many before any clade argument starts: three donor E1-alpha paralogues against two host E1-alpha genes. Ensembl Compara independently types the human-to-host relationship for this family as "ortholog_many2many" on both of its two human genes.',
  ],
  so: 'The phylogeny makes the mapping worse, not better. It says the two donor paralogues whose functions a design would need to tell apart are the two that an orthology table cannot tell apart.',
});

/**
 * The schema limitation. This is the more valuable of the two findings and it is reported rather than
 * worked around: the icefish pair is NOT forced into a slot that would make it look better.
 */
export const LOSS_IS_NOT_IN_THE_VOCABULARY = Object.freeze({
  the_question: 'What does an analogy claim even mean when one side of the pair is an absence?',
  the_answer: 'As posed - "is the icefish globin locus the functional analogue of the host globin clusters?" - it means nothing, because the subject term does not denote. There is no icefish adult beta-globin gene for the claim to be about. The only claim that CAN be made is the negative one, and that is a different claim with a different truth-maker: that the host clusters have no counterpart in that genome and the function is not performed by any analogue. That is why this pair is entered with claim "no-analogue-exists" rather than as a correspondence.',
  what_the_vocabulary_cannot_express: [
    '`present: false` is a predicate on the EVIDENCE, not on the gene. So three different situations collapse into one slot: (i) no orthology relationship exists because the lineages are independent - the antifreeze-glycoprotein case already in analogy.mjs; (ii) no orthology relationship exists because the gene was deleted from a lineage that demonstrably had it - this case; (iii) nobody looked. The absence-of-evidence refusal separates (iii) from the others. NOTHING in the seven kinds separates (i) from (ii).',
    'And (ii) is the one a design programme needs. A convergence tells you the host route never existed. A LOSS tells you the host route existed and was abandoned - which is a different and much more actionable fact, because the locus, its regulation and its partners may still be partly present.',
    'There is no evidence kind for a POSITIVELY MEASURED ABSENCE. All seven are framed as evidence for a correspondence. In this pair the best-evidenced fact on the table is an absence: alpha and beta cDNA probes hybridised against seven notothenioid genomes with the beta signal present only in the red-blooded ones (Cocca 1995), the surviving alpha1 fragment sequenced down to which exon and which part of which intron remains (Zhao 1998), and the flanking-probe blots showing the embryonic/juvenile genes gone too (di Prisco 2002). Thirty years of replicated work, and it enters this schema as seven falses.',
    'Consequently the pair bands at the floor. That band is a correct report of the EVIDENCE SLOTS and a wrong report of the state of knowledge, and the two cannot be distinguished from the band.',
  ],
  and_the_class_warning_is_false_here: 'With no present kinds the pair classifies no-basis, whose critical_warning reads "THIS IS A STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY. no-basis means we have not looked, or have looked in one place." For this pair the search WAS run - four resources plus the function-first question, which is why the absence-of-evidence refusal correctly does not fire - and the biology is known. So the class attaches a warning whose content is false for the pair it is attached to, and nothing in the module can tell this pair from one that was never searched. The refusal and the class disagree, and the refusal is the one that is right.',
  what_would_fix_it_in_the_module: 'An eighth evidence kind, or a second axis on each kind, distinguishing "not established" from "established absent" - and on the orthology kind specifically, a homology_type value such as "lost" or "deleted" alongside "none", so that a lineage that discarded the gene is not recorded identically to a lineage that never had it. HOMOLOGY_TYPES as shipped has no such value; the test file asserts that, so the limitation is checked rather than described.',
  not_forced: 'This file does not enter the loss as present evidence under some other kind to raise the band. The band staying at the floor IS the finding.',
});

/** Why no locus identifier is given for the donor gene on side a of pair 1. */
export const THE_SUBSCRIPT_GAP = Object.freeze({
  what_is_named: 'PDHE1alpha3 is the paper\'s own designation for the paralogue whose transcript is 95.7 +/- 0.4% of total E1-alpha in donor red muscle and minimal or non-detectable in brain, liver and heart.',
  what_is_not_named: 'Which locus in the current C. carassius reference annotation that is. The annotation carries four E1-alpha-family loci - one symbolised pdha1b on chromosome 42 and three unnamed LOC loci on chromosomes 4 and 5 - and the paper predates the assembly. The paper deposited its cloned sequences in GenBank and lists the accessions in a supplementary table that was not retrieved here, so no accession is quoted for side a.',
  why_this_matters: 'A design step that needed to target or express this gene would have to do that mapping first. Recording four annotated loci against three published paralogues, with no correspondence established, is the honest state: it says the donor side of this pair is not yet resolved to a locus either, so the ambiguity is on BOTH sides of the comparison and not only on the host side.',
  and_the_count_does_not_match: 'Three cloned paralogues in the paper, four E1-alpha-family loci in the reference annotation. That discrepancy was not resolved here and is not assumed away in either direction.',
});

// =====================================================================================================
// THE PAIRS
// =====================================================================================================

export const PAIRS = Object.freeze([
  Object.freeze({
    id: 'pdhe1a3-carp-pdha1-zebrafish',
    a: { species: 'Carassius carassius', name: 'PDHE1alpha3 (the muscle-dominant pyruvate dehydrogenase E1-alpha paralogue, acting as a pyruvate decarboxylase)' },
    b: { species: 'Danio rerio', name: 'pdha1a + pdha1b (the two-gene E1-alpha set)' },
    claim: 'functional-equivalence',
    note: 'The donor trait is survival of months of anoxia by converting pyruvate to acetaldehyde and then to ethanol in skeletal muscle, which diffuses out across the gills instead of accumulating as lactate (Fagernes 2017). The mechanism is a duplicated E1-alpha/E1-beta pair that detached from the rest of the complex: the paper attributes the detachment to a beta-D319N substitution in E1beta2 that raises the E1-E2 dissociation constant, plus a W382 substitution in the dominant muscle E2 paralogue, and reports NO additional substitution in E1alpha that would alter its structure or kinetics. So the donor side\'s functional change does not live in the E1-alpha catalytic module at all - which is the gene this pair is about. Host side verified from Ensembl, NCBI Gene and ZFIN: exactly two E1-alpha genes, pdha1a on chromosome 5 and pdha1b on chromosome 24, and a single E1-beta gene pdhb. Three donor paralogues against two host genes is many-to-many, and Ensembl Compara types the family that way too. See THE_CLADE_IS_NOT_A_MAPPING and THE_SUBSCRIPT_GAP.',
    developmental_context: {
      difference_stated: true,
      a: 'Adult Carassius carassius, red and white skeletal muscle, mitochondrial compartment, at 4-6.5 C; the state that matters is a metabolic one rather than a developmental stage - E1-alpha is fully dephosphorylated and thus active under anoxia and massively rephosphorylated on reoxygenation, so the function is present only in a physiological window the host is never placed in.',
      b: 'Danio rerio, where ZFIN records pdha1a expression in musculature system and adaxial cell with NO developmental stage attached to any entry, and records no tissue-level expression summary at all for pdha1b. So there is no stage correspondence to state on the host side, because the host side has no stages recorded. The host is also a tropical fish that is not anoxia-tolerant, so the donor\'s enabling context - prolonged whole-animal anoxia at near-freezing temperature with a large liver glycogen store - does not exist in it.',
      and: 'The donor function also requires a second gene the host side of this pair does not include: a muscle-expressed alcohol dehydrogenase. Fagernes 2017 reports three donor ADH8a paralogues of which ADH8a3 is 96% of muscle ADH8a transcript and absent from liver. A pair about E1-alpha alone cannot carry the pathway, and saying so is part of stating the context difference.',
    },
    databases_searched: ['Ensembl Compara (REST /homology)', 'Ensembl (REST /lookup, /xrefs, GRCz11)', 'ZFIN', 'NCBI Gene (E-utilities)'],
    analogue_search: {
      performed: true,
      how: 'Function-first question asked and answered: which host gene performs mitochondrial pyruvate decarboxylation to acetaldehyde? Answer from the retrieved records: none is reported to. The host carries the ordinary complex (two E1-alpha genes, one E1-beta gene) and Fagernes 2017 states that this is the FIRST pyruvate decarboxylase described in any vertebrate, so there is no host gene with the donor function to map onto.',
      what_that_means_for_the_pair: 'The pair is therefore not a search failure. It is a case where the host genuinely lacks the function, which is the premise of a borrow - and the obstacle is that the host locus a borrow would have to act on is a two-gene set whose division of labour is unmeasured.',
    },
    evidence: {
      'sequence-orthology': {
        present: true,
        homology_type: 'many-to-many',
        n_on_a_side: 3,
        n_on_b_side: 2,
        members_a: ['PDHE1alpha1', 'PDHE1alpha2', 'PDHE1alpha3'],
        members_b: ['pdha1a (ENSDARG00000012387, NCBI GeneID 406702, chromosome 5)', 'pdha1b (ENSDARG00000010555, NCBI GeneID 436672, chromosome 24)'],
        why_many_to_many_and_not_one_to_many: 'Both sides carry more than one gene. The donor has three E1-alpha paralogues (Fagernes 2017, read back from the PMC HTML) and the host has two (Ensembl lookup plus NCBI Gene). Ensembl Compara independently reports the type as the literal string "ortholog_many2many" for human PDHA1 against both host genes, and returns the same two host genes for human PDHA2 - so there are two genes on the reference side as well, and the relationship is many-to-many from whichever side it is entered.',
        the_clade_does_not_rescue_it: 'see THE_CLADE_IS_NOT_A_MAPPING: the published clade split puts the donor PDC paralogue and the donor housekeeping paralogue in the SAME clade as each other, and names neither host gene.',
        identity: null,
        identity_why_null: 'No pairwise identity was computed here and none is quoted from the paper, so no number is entered. An identity value the file did not measure would be the one thing in this dossier that could not be checked.',
        source: 'ensembl_compara_pdha1; ensembl_lookup_zebrafish_pdha; ncbi_gene_zebrafish_pdh; ncbi_gene_carassius_pdh; fagernes_2017',
      },
      'domain-architecture': {
        present: true,
        what: 'Both sides are pyruvate dehydrogenase E1 alpha subunits and carry the same catalytic module; Fagernes 2017 modelled the donor E1 tetramers on the human E1 crystal structure PDB 3EXE and the E1beta-E2 contact on PDB 1W85, and reports that modelling of the donor E1-alpha and E1-beta paralogues "did not reveal additional amino acid substitutions that would be expected to alter structural or kinetic properties of E1".',
        and_this_is_why_it_is_weak_here: 'The architecture being identical is the problem, not the support. The donor\'s neofunctionalisation is attributed to the E1beta2 beta-D319N substitution at the E1-E2 binding interface and to a W382 substitution in the muscle E2 paralogue - both of which are about whether E1 stays attached to the complex, not about what the E1-alpha catalytic module does. So this slot is present and its content argues AGAINST reading it as support for the functional claim: identical architecture here is evidence that the E1-alpha gene is not where the difference lives.',
        caveat: 'A homology model is a model. No crystal structure, and no enzyme assay of a purified donor paralogue, was reported or retrieved.',
        source: 'fagernes_2017',
      },
      'expression-domain': {
        present: true,
        what: 'Donor side quantified: PDHE1alpha3 is 95.7 +/- 0.4% of total E1-alpha transcript in red skeletal muscle (with E1beta2 at 97.1 +/- 0.4% of E1-beta), a similar picture in white muscle, and minimal or non-detectable in brain, liver and heart; corroborated at protein level by Western blot and by immuno-EM showing mitochondrial localisation in red muscle. Host side: ZFIN records pdha1a expression in "musculature system" and "adaxial cell". So there is a muscle-to-muscle correspondence for ONE member of the host set.',
        caveat: 'Three separate weaknesses, all of which matter more than the correspondence does. (1) The correspondence is to a MEMBER of a many-to-many set, not to the set - which is the inference the one-to-many refusal exists to block, so this slot must not be read as naming a host target. (2) ZFIN records NO tissue-level expression summary for pdha1b, so the second host gene\'s domain is unknown rather than known to be different, and the division of labour between the host pair is therefore unmeasured. (3) ZFIN attaches no developmental stage to any pdha1a expression entry, and the donor measurement is in adult muscle under anoxia, so the two sides are not staged against each other at all.',
        and: 'The donor transcript share is also not a measurement of the host-relevant quantity. What makes the donor pathway work is that total E1 transcript exceeds E2 and E3 by more than 60-fold in muscle - an excess of free E1 over the complex that can hold it. That ratio is a property of the whole muscle transcriptome, not of the gene pair, and nothing comparable was retrieved for the host.',
        source: 'fagernes_2017; zfin_pdha1a; zfin_pdha1b',
      },
      'rescue': {
        present: false,
        why: 'No cross-species complementation in either direction was reported in Fagernes 2017 or retrieved from any source here. The paper\'s functional case is a homology model, a transcript-share measurement, a Western blot, an immuno-EM localisation and a phosphorylation-state change under anoxia - five correlates, no experiment in which the donor gene is asked to do the job somewhere the job is absent. This is the one absence that would decide the pair, and on a many-to-many relationship it could not promote it anyway: a rescue by one member of the host set would be a real result about that member and would leave the set ambiguous.',
      },
      'lof-phenotype': {
        present: false,
        why: 'Nothing on either side. On the host side ZFIN lists no mutant allele and no sequence targeting reagent for pdha1a OR pdha1b, and for pdha1b states "No data available" under All Phenotype Data - so the host pair has never been knocked out singly, let alone doubly in one assay, which is the experiment the one-to-many upgrade path calls for. On the donor side there is no reverse genetics in Carassius carassius reported or retrieved. Note that a silent single knockout in the host would in any case be uninterpretable here, since redundancy between the pair and transcriptional adaptation would both predict it.',
      },
      'synteny': {
        present: false,
        why: 'Coordinates are held for every locus on both sides and no synteny analysis has been run against them. Host: pdha1a on chromosome 5 (GRCz11 24031314-24044877), pdha1b on chromosome 24 (24273371-24282427). Donor: pdha1b-symbolised gene on chromosome 42, plus LOC132141476 and LOC132141477 about 48 kb apart on chromosome 5 and LOC132139822 on chromosome 4. Coordinates are not synteny: no flanking-gene comparison was made, so nothing here establishes which donor locus corresponds to which host locus, nor whether the host pair are ohnologs of the teleost duplication rather than a later duplication.',
        the_trap_worth_naming: 'Two donor E1-alpha loci sit on donor chromosome 5 and host pdha1a sits on host chromosome 5. That is a coincidence of chromosome NUMBERING between two independently assembled genomes and carries no information whatever. It is recorded here because it is the kind of thing that gets read as synteny.',
      },
      'positional-correspondence': {
        present: false,
        why: 'Not applicable: this is a gene pair, not a structure pair, so there is no body-plan position to compare.',
      },
    },
  }),

  Object.freeze({
    id: 'globin-locus-icefish-zebrafish',
    a: { species: 'Chaenocephalus aceratus', name: 'adult alpha/beta-globin locus (beta-globin gene deleted; of alpha1 only part of intron 2, exon 3 and the 3-prime UTR retained, transcriptionally inactive)' },
    b: { species: 'Danio rerio', name: 'globin gene clusters (17 annotated genes: 13 on chromosome 3, 4 on chromosome 12)' },
    claim: 'no-analogue-exists',
    note: 'A GENE LOSS pair, entered to find out whether this module\'s vocabulary can express one. It cannot, and that is the row\'s value - see LOSS_IS_NOT_IN_THE_VOCABULARY. The biology is among the best-characterised losses in vertebrates: the channichthyids are described as the only adult vertebrates with no functional haemoglobin, the beta-globin gene is gone from three species tested by Southern blot (Cocca 1995), the surviving alpha1 remnant has been sequenced to the exon (Zhao 1998), the embryonic/juvenile globin genes are gone too (di Prisco 2002), and the proposed cause is a single large deletion in the ancestral channichthyid. All of that enters this schema as seven absences, because every evidence kind is a predicate on evidence FOR a correspondence and none can carry a measured absence. The pair consequently bands at the floor and classifies no-basis - whose own warning says that means nobody looked, which is false here. The pair is not reshaped to avoid that.',
    developmental_context: {
      difference_stated: true,
      a: 'Adult Chaenocephalus aceratus, in water perennially at or near freezing and oxygen-rich. There is no developmental window in which the locus is expressed, at any stage, because di Prisco 2002 reports the embryonic/juvenile globin genes lost as well as the adult ones - so the absence is not stage-restricted and there is no stage on this side to correspond to anything.',
      b: 'Danio rerio, where the chromosome-3 cluster interleaves adult and embryonic globin genes within about 50 kb - hbaa1 at 58399730 and hbae1.1 at 58420680 on this assembly - so even naming "the adult cluster" as the side-b object is not something the assembly supports. The host switches globins developmentally; the donor side has no globin to switch.',
      and: 'The two sides are also not comparable physiologically: the donor lineage operates at near-freezing temperature in oxygen-rich water, which is the condition under which carrying oxygen dissolved in plasma is sufficient at all. A host at tropical temperature is not in that condition, so even a successful transfer of the LOSS would not transfer the viability.',
    },
    databases_searched: ['PubMed (metadata for PMIDs 7892183, 9614073, 12354652, 19401238)', 'PubMed Central', 'NCBI Gene (E-utilities)', 'Ensembl (REST)'],
    analogue_search: {
      performed: true,
      how: 'Function-first question asked and answered: what performs the host globin clusters\' job - oxygen carriage by an intracellular respiratory pigment - in an adult icefish? Answer from the retrieved records: nothing does. di Prisco 2002 states that oxygen delivery "occurs by carrying the gas physically dissolved in the plasma", and Garofalo 2009 enumerates the system-level compensations that make that sufficient: hypervolemia, near-zero haematocrit and low blood viscosity, large-bore capillaries, increased vascularity with great capacitance, cardiomegaly with very large cardiac output, and high blood flow at low systemic pressure and resistance.',
      and_what_that_answer_is_not: 'It is not a molecular analogue. No protein took over; the solution is at the level of the circulatory system and of the thermal and oxygen environment it runs in. So the honest answer to "what is the analogue" is that the question has no gene-level answer, which is a genuinely informative outcome of a function-first search and is a different thing from the search having failed. The module has no way to record it: analogue_search.performed is a boolean, and "performed, and the answer is that there is no analogue" reads identically to "performed, and we found one".',
    },
    evidence: {
      'sequence-orthology': {
        present: false,
        homology_type: 'none',
        why: 'There is no icefish-to-host orthology assignment to enter, for two independent reasons. (1) The published comparisons are icefish against a red-blooded notothenioid - Cocca 1995 and Zhao 1998 both probe and align against Notothenia coriiceps - not icefish against the host, and no icefish-to-host globin orthology call was retrieved from any resource here. (2) Side b is 17 genes in two clusters, so the relationship could not be one-to-one whatever was found. What DOES exist on side a is a sequenced, transcriptionally inactive alpha1 fragment - part of intron 2, exon 3 and the 3-prime UTR - whose descent from the notothenioid alpha1 gene is established; and the module has nowhere to put that, because entering it as present would assert an orthology to the host that nobody has made, and entering it as absent loses the fact that the remnant exists and has been sequenced.',
        and_this_is_the_limitation: 'homology_type "none" is being used here to mean "the gene was deleted from a lineage that had it". It means exactly the same thing in this schema as "these two lineages are unrelated at this locus" - the antifreeze-glycoprotein case in analogy.mjs PAIRS uses the same value for the opposite situation. HOMOLOGY_TYPES has no value for a loss. See LOSS_IS_NOT_IN_THE_VOCABULARY.',
        source: 'cocca_1995; zhao_1998; diprisco_2002; ncbi_gene_zebrafish_globins',
      },
      'synteny': {
        present: false,
        why: 'No icefish-to-host synteny comparison exists here, and the icefish assembly was not consulted. What is established is a LINKAGE within the donor lineage: Zhao 1998 proposes "a single mutational event in the ancestral channichthyid that deleted the entire beta-globin gene and the 5-prime end of the linked alpha1-globin gene", and di Prisco 2002 probed with fragments of the genes flanking the embryonic/juvenile complex. That is a neighbourhood argument about the deletion, made against a red-blooded relative - which is the strongest ancestry evidence in this pair and is not evidence about the host comparison at all.',
      },
      'expression-domain': {
        present: false,
        why: 'This is where the schema fails hardest. There is no expression on side a - the retained alpha1 fragment is described as transcriptionally inactive and the adult blood contains no haemoglobin - so the comparison is not "unmeasured", it is measured and it is zero. An expression-domain correspondence between a present domain and a measured-absent one is not a weak correspondence; it is a category the slot cannot hold. Recorded present:false, which reads as "no comparison was entered" and is the wrong reason.',
      },
      'domain-architecture': {
        present: false,
        why: 'There is no protein on side a. The retained fragment is part of intron 2, exon 3 and the 3-prime UTR of alpha1 with the 5-prime end truncated (Zhao 1998), which cannot encode a globin fold, and the beta-globin gene is absent entirely (Cocca 1995). No domain call is available because there is no domain.',
      },
      'lof-phenotype': {
        present: false,
        why: 'Tempting and refused. There is a dramatic natural phenotype on side a - a lineage with no haemoglobin, near-zero haematocrit and a hugely enlarged heart - but it is an evolutionary outcome in a wild lineage with millions of years for compensations to accumulate, not a loss-of-function experiment, and Garofalo 2009 frames those compensations as adaptive recovery rather than as the direct consequence of the loss. There is no matched host experiment: no deletion of the host globin clusters scored in the same assay was retrieved. Entering the natural condition as a loss-of-function phenotype would be entering an outcome as an experiment, and would be the single most misleading thing this file could do.',
      },
      'rescue': {
        present: false,
        why: 'No complementation in either direction, and for this pair none is available even in principle in the direction that matters: the donor has no gene to put into the host. The other direction - a functional globin gene expressed in an icefish - has not been done and was not retrieved.',
      },
      'positional-correspondence': {
        present: false,
        why: 'Not applicable: a gene locus pair, not a structure pair.',
      },
    },
  }),
]);

// =====================================================================================================
// SCORED - computed at import, not asserted by hand
// =====================================================================================================
//
// The band is whatever scoreAnalogy returns for the evidence as entered above. Nothing in this file
// states a band as a literal, so a band in the test output is a result and not a copy.

export const SCORED = Object.freeze(PAIRS.map(p => Object.freeze({
  id: p.id,
  verdict: scoreAnalogy(p.a, p.b, p.evidence),
  classification: classify(p),
  refusal: refuse(p),
})));

export const SUMMARY = Object.freeze({
  n: PAIRS.length,
  rows: Object.freeze(SCORED.map(s => Object.freeze({
    id: s.id,
    class: s.classification.class,
    functional_equivalent: s.classification.functional_equivalent,
    homology_type: s.classification.homology_type,
    strongest: s.verdict.strongest?.kind ?? null,
    band: Object.freeze([s.verdict.confidence.lo, s.verdict.confidence.hi]),
    band_label: s.verdict.confidence.label,
    label_robust_to_weighting: s.verdict.confidence.label_is_robust_to_weighting,
    present_kinds: s.verdict.present_kinds,
    refusals: Object.freeze(s.refusal.refusals.map(r => r.id)),
  }))),
  what_these_two_rows_show:
    'One pair bands low because the host side is a gene set rather than a gene, and the phylogeny that ' +
    'looked as though it would narrow the set turns out to put the two donor functions in the same clade. ' +
    'The other bands at the floor because the schema cannot record a measured absence, while the absence ' +
    'is the best-evidenced fact in the pair. Neither row was reshaped to look better than that.',
  what_they_do_not_show:
    'Any base rate, and nothing about whether either borrow is a good idea. Two pairs chosen because they ' +
    'were expected to break something are not a sample.',
});

const RUN_DIRECTLY = /(^|[\\/])anoxia-ethanol\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
  console.log(`\nanalogues/combos/pairs/anoxia-ethanol.mjs - ${SUMMARY.n} pairs\n`);
  for (const r of SUMMARY.rows) {
    console.log(`  ${r.id}`);
    console.log(`    class            ${r.class}  (functional_equivalent: ${r.functional_equivalent})`);
    console.log(`    homology_type    ${r.homology_type}`);
    console.log(`    strongest        ${r.strongest ?? 'none present'}`);
    console.log(`    band             ${r.band[0]} - ${r.band[1]}  (${r.band_label}; robust to re-weighting: ${r.label_robust_to_weighting})`);
    console.log(`    present kinds    ${r.present_kinds.length ? r.present_kinds.join(', ') : 'NONE'}`);
    console.log(`    refusals         ${r.refusals.length ? r.refusals.join(', ') : 'none'}\n`);
  }
  console.log(`  evidence kinds in the schema: ${EVIDENCE_IDS.length}`);
  console.log(`  homology types available:    ${HOMOLOGY_TYPES.join(', ')}`);
  console.log(`  ambiguous types:             ${AMBIGUOUS_HOMOLOGY_TYPES.join(', ')}`);
  console.log(`\n  ${LOSS_IS_NOT_IN_THE_VOCABULARY.the_question}`);
  console.log(`  ${LOSS_IS_NOT_IN_THE_VOCABULARY.the_answer}\n`);
}
