#!/usr/bin/env node
// combos/pairs/diapause.mjs - TWO DOSSIERS ON REVERSIBLE DEVELOPMENTAL ARREST, AND ONE NEGATIVE CONTROL
//
// Rows for analogues/analogy.mjs, in its PAIRS schema. Both rows are about the same question: when two
// lineages separated by most of animal evolution both stop developing, wait, and then carry on, is the
// one arrest the functional analogue of the other?
//
//   (1) killifish-diapause-dauer          Nothobranchius furzeri embryonic diapause  vs  Caenorhabditis
//                                         elegans dauer larva. Expected to carry real evidence.
//   (2) killifish-diapause-fly-repro      the same fish arrest  vs  Drosophila melanogaster adult
//                                         reproductive diapause. Included as the NEGATIVE CONTROL for (1).
//
// ============================== WHAT THIS FILE IS FOR ==============================
// The task that produced it asked one question of the live records and would not accept an assumption:
// ARE THE INSULIN / IGF COMPONENTS ORTHOLOGOUS BETWEEN THE FISH AND THE NEMATODE, AND IF SO, IS THE
// ORTHOLOGY ONE-TO-ONE? The answer, from the records read this session and recorded in SOURCES:
//
//   * They are orthologous, and the orthology is ONE-TO-MANY at every node checked but one.
//     - Alliance of Genome Resources, stringent filter, for daf-2 (WB:WBGene00000898): 17 rows. On the
//       human side it returns THREE receptors - INSR, IGF1R and INSRR. "The orthologue of daf-2" in a
//       mammal does not denote one gene.
//     - Ensembl Compara, human INSR against Nothobranchius furzeri: TWO killifish genes,
//       ENSNFUG00015024774 and ENSNFUG00015025450, relationship type `ortholog_one2many`. Human IGF1R
//       against the same genome: TWO genes, also `ortholog_one2many`.
//     - Alliance for daf-16 (WB:WBGene00000912): 23 rows, FOUR human forkhead factors - FOXO1, FOXO3,
//       FOXO4, FOXO6 - and SEVEN in a teleost (Danio rerio foxo1a, foxo1b, foxo3a, foxo3b, foxo4,
//       foxo6a, foxo6b). Ogg et al. 1997 said the same thing in its own abstract twenty-eight years
//       earlier: daf-16 "encodes three members of the Fork head family", and "the probable human
//       orthologues of DAF-16, FKHR and AFX" - two names, in the sentence that nominates them.
//     - The one apparent exception turned out to be the best thing on this page. Ensembl Compara calls
//       human FOXO3 against N. furzeri `ortholog_one2one`, a single gene ENSNFUG00015020706, and that
//       call is WRONG about the genome it is called on. The same Ensembl instance, asked for its
//       N. furzeri genes by symbol, returns TWO: foxo3a = ENSNFUG00015020706 (display name FOXO3A,
//       scaffold sgr16) and foxo3b = ENSNFUG00015001055. Singh et al. 2024 names those same two
//       paralogs and CRISPR-knocks out both. So the ORTHOLOGY TABLE contradicts its own host
//       database's GENE SET, and it contradicts it in the direction that does the damage: read alone,
//       the one2one call licenses the phrase "the killifish FOXO3", and there is no such single gene.
//       This is analogy.mjs's second refusal happening in the wild, inside one resource, in a single
//       afternoon's lookups.
//
//   * A second answer nobody asked for, and the more useful one for a design programme: the insulin /
//     IGF RECEPTOR node is implicated on the NEMATODE side only. Singh et al. 2024, the paper that
//     establishes the fish side functionally, does not contain the string "insulin" or "IGF" anywhere
//     in its PMC full text - searched this session, zero hits. What is shared and functionally tested
//     on both sides is the FOXO transcription factor, which in the nematode is the thing DAF-2
//     signalling exists to antagonise (Ogg 1997), not the receptor itself. A pipeline that borrowed
//     "the insulin-signalling arrest programme" from the nematode into a fish would be borrowing from
//     a node that has not been shown to act in the fish arrest at all.
//
// ============================== WHY (2) IS HERE ==============================
// A pair the module bands LOW because the evidence genuinely is not there is a useful row, and a
// negative control is the only way to find out whether a band means anything. Row (2) pairs the same
// fish arrest against an arrest in an insect that is a different KIND of arrest at a different point in
// the life cycle - embryonic development suspended, against an adult whose ovaries stop. The named
// genetic bases do not meet either: couch potato (cpo), the insect locus, returns RBPMS and RBPMS2 on
// the human side and no forkhead factor of any kind (Alliance, FB:FBgn0263995, 13 rows). Whether the
// module actually separates (1) from (2) is recorded in BAND_SEPARATION, computed rather than claimed.
//
// ============================== THE RULE THIS FILE WAS WRITTEN UNDER ==============================
// Every accession, PMID, DOI and gene symbol below was retrieved this session and read back; SOURCES
// carries a `verified_how` on every entry saying which record was fetched and what it said, and
// CHECKED_SYMBOLS lists every gene symbol used anywhere in the dossiers against the record it came
// from. Where an evidence kind could not be established it is `present: false` with a `why` naming
// what is missing. Nothing is asserted because it would look good.
//
//   node analogues/combos/pairs/diapause.mjs
//   node analogues/combos/pairs/test-diapause.mjs [--fail-once]

import { scoreAnalogy, classify, refuse, EVIDENCE_IDS, HOMOLOGY_TYPES } from '../../analogy.mjs';

// =====================================================================================================
// 1. SOURCES
// =====================================================================================================
//
// `kind` is 'paper' for a PubMed record and 'record' for a live database lookup. `verified_how` says
// what was fetched and what was read back out of it. A citation with nothing in `verified_how` that a
// reader could re-fetch is a citation this file does not get to keep.

export const SOURCES = Object.freeze({
  hu_2020: Object.freeze({
    kind: 'paper',
    cite: 'Hu, C.-K., Wang, W., Brind\'Amour, J., Singh, P.P., Reeves, G.A., Lorincz, M.C., Sanchez Alvarado, A. & Brunet, A. (2020) Vertebrate diapause preserves organisms long term through Polycomb complex members. Science 367:870-874.',
    pmid: '32079766',
    doi: '10.1126/science.aaw2601',
    verified_how: 'Retrieved via the PubMed MCP get_article_metadata this session for PMID 32079766. Abstract read back: diapause "preserves complex organisms for extremely long periods of time without trade-offs for subsequent adult growth, fertility, and life span"; "The most up-regulated genes in diapause include Polycomb complex members"; "the Polycomb member CBX7 mediates repression of metabolism and muscle genes in diapause" and "is functionally required for muscle preservation and diapause maintenance". DOI and PMC id (PMC7532943) returned in the same record.',
    what_it_supports: 'that the fish arrest is reversible, long, and active rather than passive, and that a named chromatin regulator is required to maintain it',
  }),
  singh_2024: Object.freeze({
    kind: 'paper',
    cite: 'Singh, P.P., Reeves, G.A., Contrepois, K., Papsdorf, K., Miklas, J.W., Ellenberger, M., Hu, C.-K., Snyder, M.P. & Brunet, A. (2024) Evolution of diapause in the African turquoise killifish by remodeling the ancient gene regulatory landscape. Cell 187:3338-3356.e30.',
    pmid: '38810644',
    pmc: 'PMC11970524',
    doi: '10.1016/j.cell.2024.04.048',
    verified_how: 'Metadata retrieved for PMID 38810644 and the PMC full text (PMC11970524, 103308 characters) fetched and searched this session. Sentences read back verbatim: "three TFs - REST, FOXO3a, and FOXO3b - are functionally important for the diapause expression program"; "This CRISPR-Cas9-based platform allowed ~75% knockout efficiency in injected (F0) killifish embryos"; "Five out of the six TF knockouts led to viable embryos"; "although FOXO TFs were known to impact diapause in invertebrates, they had not been previously implicated in diapause in vertebrates"; and "(e.g., FOXOs and PPARs) are genetically required for suspended animation states, such as dauer". A regex search of the same full text for "insulin", "IGF" and "igf1r" returned ZERO matches, which is why the receptor node is recorded as unestablished on the fish side.',
    what_it_supports: 'the only functional perturbation evidence on the fish side; also the FOXO3a/FOXO3b paralog naming that the orthology resources do not reproduce, and the absence of any insulin/IGF receptor claim',
  }),
  kimura_1997: Object.freeze({
    kind: 'paper',
    cite: 'Kimura, K.D., Tissenbaum, H.A., Liu, Y. & Ruvkun, G. (1997) daf-2, an insulin receptor-like gene that regulates longevity and diapause in Caenorhabditis elegans. Science 277:942-946.',
    pmid: '9252323',
    doi: '10.1126/science.277.5328.942',
    verified_how: 'Retrieved via PubMed get_article_metadata for PMID 9252323 this session. Abstract read back: daf-2 "encodes an insulin receptor family member"; "A C. elegans neurosecretory signaling system regulates whether animals enter the reproductive life cycle or arrest development at the long-lived dauer diapause stage". Note the record\'s own wording: "insulin receptor FAMILY member", not "the orthologue of the insulin receptor" - and the MeSH terms assigned to it include BOTH "Receptor, Insulin" and "Receptor, IGF Type 1", which is the one-to-many relationship showing up in the indexing.',
    what_it_supports: 'that the nematode arrest is under insulin/IGF-family receptor control, and that the receptor is a family member rather than a single counterpart',
  }),
  ogg_1997: Object.freeze({
    kind: 'paper',
    cite: 'Ogg, S., Paradis, S., Gottlieb, S., Patterson, G.I., Lee, L., Tissenbaum, H.A. & Ruvkun, G. (1997) The Fork head transcription factor DAF-16 transduces insulin-like metabolic and longevity signals in C. elegans. Nature 389:994-999.',
    pmid: '9353126',
    doi: '10.1038/40194',
    verified_how: 'Retrieved via PubMed get_article_metadata for PMID 9353126 this session. Abstract read back: "null mutations in daf-16 suppress the effects of mutations in daf-2 or age-1; lack of daf-16 bypasses the need for this insulin receptor-like signalling pathway. The principal role of DAF-2/AGE-1 signalling is thus to antagonize DAF-16"; "daf-16 is widely expressed and encodes three members of the Fork head family of transcription factors"; "The probable human orthologues of DAF-16, FKHR and AFX". FKHR and AFX are the older names for FOXO1 and FOXO4 - two human genes nominated for one nematode gene, in the paper\'s own sentence.',
    what_it_supports: 'the loss-of-function evidence on the nematode side (daf-16 null suppresses the arrest), that FOXO is the effector rather than the receptor, and a 1997 statement of the same one-to-many relationship the 2025 databases return',
  }),
  larsen_1995: Object.freeze({
    kind: 'paper',
    cite: 'Larsen, P.L., Albert, P.S. & Riddle, D.L. (1995) Genes that regulate both development and longevity in Caenorhabditis elegans. Genetics 139:1567-1583.',
    pmid: '7789761',
    doi: '10.1093/genetics/139.4.1567',
    verified_how: 'Retrieved via PubMed get_article_metadata for PMID 7789761 this session. Abstract read back: the nematode "responds to conditions of overcrowding and limited food by arresting development as a dauer larva"; "Mutations in the daf-2 and daf-23 genes double adult life span"; "The increased life spans are suppressed completely by a daf-16 mutation". Confirms the daf-16 suppression result in a second, independent paper and a different laboratory from ogg_1997.',
    what_it_supports: 'the environmental triggering and reversibility of the nematode arrest, and daf-16 suppression replicated outside the Ruvkun laboratory',
  }),
  schmidt_2008: Object.freeze({
    kind: 'paper',
    cite: 'Schmidt, P.S., Zhu, C.-T., Das, J., Batavia, M., Yang, L. & Eanes, W.F. (2008) An amino acid polymorphism in the couch potato gene forms the basis for climatic adaptation in Drosophila melanogaster. PNAS 105:16207-16211.',
    pmid: '18852464',
    doi: '10.1073/pnas.0805485105',
    verified_how: 'Retrieved via PubMed get_article_metadata for PMID 18852464 this session. Abstract read back: "Drosophila melanogaster exhibits a reproductive diapause that is variable within and among populations"; quantitative trait mapping "identified the RNA-binding protein encoding gene couch potato (cpo) as a major genetic locus determining diapause phenotype"; "variation for the diapause phenotype is caused by a single Lys/Ile substitution in one of the six cpo transcripts".',
    what_it_supports: 'the named candidate locus on the insect side, and that the arrest there is REPRODUCTIVE and adult rather than embryonic',
  }),
  cogni_2013: Object.freeze({
    kind: 'paper',
    cite: 'Cogni, R., Kuczynski, C., Koury, S., Lavington, E., Behrman, E.L., O\'Brien, K.R., Schmidt, P.S. & Eanes, W.F. (2014) The intensity of selection acting on the couch potato gene - spatial-temporal variation in a diapause cline. Evolution 68:538-548.',
    pmid: '24303812',
    doi: '10.1111/evo.12291',
    verified_how: 'Retrieved via PubMed get_article_metadata for PMID 24303812 this session. Abstract read back: "the SNP polymorphism, 48034(A/T), is correlated with latitude and its frequencies are predicted by the incidence of diapause trait"; "the low-expression allele increasing in frequency, as would be predicted from functional knockout studies of cpo".',
    what_it_supports: 'independent support for the coding-SNP cline, and the only mention retrieved of a functional knockout of cpo',
  }),
  zonato_2016: Object.freeze({
    kind: 'paper',
    cite: 'Zonato, V., Fedele, G. & Kyriacou, C.P. (2016) An intronic polymorphism in couch potato is not distributed clinally in European Drosophila melanogaster populations nor does it affect diapause inducibility. PLoS ONE 11:e0162370.',
    pmid: '27598401',
    doi: '10.1371/journal.pone.0162370',
    verified_how: 'Retrieved via PubMed get_article_metadata for PMID 27598401 this session. Abstract read back: "the downstream cpo SNP does not seem to play any role in diapause induction in European populations in contrast to the upstream coding cpo SNP"; "as cpo lies within the inversion In(3R)Payne ... interpretation of the cpo cline is not straightforward"; "polymorphism in the clock gene tim plays a significant role in diapause inducibility". Retrieved deliberately: a dossier that cited only schmidt_2008 would make the insect side look cleaner than the literature does.',
    what_it_supports: 'that the cpo-diapause association is contested for one of the two SNPs and confounded by a chromosomal inversion and by a second locus',
  }),
  alliance_daf2_orthologs: Object.freeze({
    kind: 'record',
    resource: 'Alliance of Genome Resources',
    url: 'https://www.alliancegenome.org/api/gene/WB:WBGene00000898/orthologs?limit=50',
    verified_how: 'Fetched live this session; HTTP 200; 17 stringent-filter rows parsed out of the JSON. Human rows: INSR, IGF1R, INSRR. Teleost rows (Danio rerio): insra, insrb, igf1ra, igf1rb. Insect row: Drosophila melanogaster InR. Mammalian rows for Mus musculus and Rattus norvegicus repeat the same three-gene shape. THREE human genes for one nematode gene, so "the human orthologue of daf-2" does not denote.',
    what_it_supports: 'the one-to-many homology_type on the receptor node, read off a live orthology resource rather than inferred',
  }),
  alliance_daf16_orthologs: Object.freeze({
    kind: 'record',
    resource: 'Alliance of Genome Resources',
    url: 'https://www.alliancegenome.org/api/gene/WB:WBGene00000912/orthologs?limit=50',
    verified_how: 'Fetched live this session; 23 stringent-filter rows parsed. Human rows: FOXO1, FOXO3, FOXO4, FOXO6. Teleost rows (Danio rerio): foxo1a, foxo1b, foxo3a, foxo3b, foxo4, foxo6a, foxo6b - SEVEN genes for one nematode gene. Insect row: Drosophila melanogaster foxo, a single gene. The isBestScore flag is "Yes" for FOXO1, FOXO3 and Danio foxo1a and "No" for FOXO4, FOXO6, foxo3a, foxo3b, foxo4, foxo6a, foxo6b, which ranks the set but does not reduce it to one member.',
    what_it_supports: 'the one-to-many homology_type on the effector node, and that the expansion is worse in a fish than in a mammal',
  }),
  ensembl_compara_nfu: Object.freeze({
    kind: 'record',
    resource: 'Ensembl Compara, REST homology endpoint',
    url: 'https://rest.ensembl.org/homology/symbol/homo_sapiens/INSR?target_species=nothobranchius_furzeri&type=orthologues',
    verified_how: 'Four queries run live this session against rest.ensembl.org, target_species=nothobranchius_furzeri, type=orthologues. Results read back: human INSR (ENSG00000171105) -> ENSNFUG00015024774 and ENSNFUG00015025450, both type ortholog_one2many, 65.77% and 64.07% target identity. Human IGF1R (ENSG00000140443) -> ENSNFUG00015011508 and ENSNFUG00015008221, both ortholog_one2many. Human FOXO1 (ENSG00000150907) -> ENSNFUG00015010187 and ENSNFUG00015009307, both ortholog_one2many. Human FOXO3 (ENSG00000118689) -> ENSNFUG00015020706 ALONE, type ortholog_one2one, 58.51% identity. The same endpoint returned HTTP 500/503 for caenorhabditis_elegans, which is not in this division, so the nematode side was taken from the Alliance instead and that substitution is stated rather than hidden.',
    what_it_supports: 'the killifish half of the one-to-many finding, and the ortholog_one2one call for FOXO3 that ensembl_lookup_nfu then contradicts',
  }),
  ensembl_lookup_nfu: Object.freeze({
    kind: 'record',
    resource: 'Ensembl, REST lookup/id and xrefs/symbol endpoints',
    url: 'https://rest.ensembl.org/xrefs/symbol/nothobranchius_furzeri/foxo3',
    verified_how: 'Run live this session after the Compara result above looked too clean. lookup/id read back display names and scaffolds for every gene id Compara returned: ENSNFUG00015020706 = FOXO3A on sgr16 ("forkhead box O3", source HGNC:3821); ENSNFUG00015024774 = insra on sgr09 and ENSNFUG00015025450 = INSRB on sgr17 ("insulin receptor a" / "b", source ZFIN ZDB-GENE-020503-3 / -4); ENSNFUG00015011508 = igf1ra on sgr13 and ENSNFUG00015008221 = IGF1RB on sgr07 (ZFIN ZDB-GENE-020503-1 / -2); ENSNFUG00015010187 = foxo1a on sgr06 and ENSNFUG00015009307 = foxo1b on sgr11 (ZFIN ZDB-GENE-061013-59 / ZDB-GENE-080425-3). Then xrefs/symbol was asked for the symbols directly: foxo3 -> TWO gene ids, ENSNFUG00015001055 AND ENSNFUG00015020706; foxo3a -> ENSNFUG00015020706; foxo3b -> ENSNFUG00015001055; insra, insrb, igf1ra, igf1rb each -> the single matching id above; rest -> ENSNFUG00015001987. So this Ensembl instance annotates TWO foxo3 genes in this fish while its own Compara table calls human FOXO3 ortholog_one2one against one of them.',
    what_it_supports: 'that the killifish foxo3 locus is a duplicate pair in the gene annotation, that singh_2024 agrees with the annotation and the orthology table does not, and the verified symbols for every killifish gene named in this file',
  }),
  uniprot_daf16: Object.freeze({
    kind: 'record',
    resource: 'UniProtKB',
    accession: 'O16850',
    url: 'https://rest.uniprot.org/uniprotkb/search?query=gene:daf-16+AND+organism_id:6239+AND+reviewed:true',
    verified_how: 'Fetched live this session. One reviewed entry: O16850, id FOXO_CAEEL, recommended name "Forkhead box protein O", gene name daf-16, Caenorhabditis elegans, 541 aa. Cross-references read back: Pfam PF00250 (Forkhead); InterPro IPR001766 (Fork_head_dom), IPR030456, IPR036388, IPR036390 (winged-helix DNA-binding superfamily). NOTE what is NOT there: no PF16676 (FOXO-TAD) and no PF16675 (FOXO_KIX_bdg), both of which the fish and human FOXO3 entries carry.',
    what_it_supports: 'the shared forkhead/winged-helix DNA-binding module, and the accessory-domain difference that keeps the architecture claim honest',
  }),
  uniprot_daf2: Object.freeze({
    kind: 'record',
    resource: 'UniProtKB',
    accession: 'Q968Y9',
    url: 'https://rest.uniprot.org/uniprotkb/search?query=gene:daf-2+AND+organism_id:6239+AND+reviewed:true',
    verified_how: 'Fetched live this session. One reviewed entry: Q968Y9, id INSR_CAEEL, recommended name "Insulin-like receptor", gene name daf-2, 1846 aa. Annotated domains read back: Fibronectin type-III 1 (775-869), 2 (969-1067), 3 (1077-1179), Protein kinase (1246-1528). InterPro set includes IPR000494 (Rcpt_L-dom), IPR006211 (Furin-like Cys-rich), IPR000719 (Prot_kinase_dom), IPR050122 (RTK). Note the recommended name: "Insulin-LIKE receptor", UniProt\'s own hedge.',
    what_it_supports: 'the receptor domain complement on the nematode side, for comparison with the human and killifish entries',
  }),
  uniprot_human_nodes: Object.freeze({
    kind: 'record',
    resource: 'UniProtKB',
    accession: 'O43524; P06213',
    url: 'https://rest.uniprot.org/uniprotkb/search?query=gene:FOXO3+AND+organism_id:9606+AND+reviewed:true',
    verified_how: 'Two queries run live this session. O43524 (FOXO3_HUMAN), "Forkhead box protein O3", 673 aa, Pfam PF00250 + PF16676 (FOXO-TAD) + PF16675 (FOXO_KIX_bdg). P06213 (INSR_HUMAN), "Insulin receptor", 1382 aa, Fibronectin type-III 1 (624-726), 2 (757-842), 3 (853-947), Protein kinase (1023-1298) - the same four-domain layout, in the same order, as Q968Y9.',
    what_it_supports: 'that the receptor architecture is shared in the same order across the whole comparison, and that the forkhead protein architecture is shared only in its core',
  }),
  uniprot_nfu_foxo3: Object.freeze({
    kind: 'record',
    resource: 'UniProtKB',
    accession: 'A0A1A8UJ32',
    url: 'https://rest.uniprot.org/uniprotkb/search?query=organism_id:105023+AND+gene:foxo3',
    verified_how: 'Fetched live this session for organism_id 105023 (Nothobranchius furzeri). EXACTLY ONE entry returned: A0A1A8UJ32, "Forkhead box O3", gene name FOXO3, 617 aa, annotated Fork-head domain 132-226, Pfam PF00250 + PF16676 + PF16675, Ensembl transcript ENSNFUT00015045178.1. One entry is not one gene, and ensembl_lookup_nfu subsequently showed why: the genome carries two foxo3 genes, so this single UniProt entry is an incomplete unreviewed proteome and NOT corroboration of a single locus. Recorded here as the resource that would have misled, had it been the only one consulted.',
    what_it_supports: 'the domain architecture of a killifish FOXO3 protein, and a worked example of a second resource appearing to confirm a wrong gene count',
  }),
  uniprot_nfu_receptors: Object.freeze({
    kind: 'record',
    resource: 'UniProtKB',
    accession: 'A0A8C6Q4G8; A0A1A8UV30',
    url: 'https://rest.uniprot.org/uniprotkb/search?query=organism_id:105023+AND+(gene:insr+OR+gene:insra+OR+gene:insrb)',
    verified_how: 'Two queries run live this session for organism_id 105023. Gene name INSR returned 8 entries whose Ensembl transcript cross-references fall into two clusters (ENSNFUT000150558xx/559xx and ENSNFUT000150572xx), e.g. A0A8C6Q4G8 "Insulin receptor" 1382 aa with Fibronectin type-III x2 and Protein kinase 979-1298. Gene name IGF1R returned 8 entries in two clusters (ENSNFUT000150194xx/198xx and ENSNFUT000150256xx/257xx/261xx), e.g. A0A1A8UV30, 1404 aa, Fibronectin type-III x3 and Protein kinase 999-1274. Two clusters per receptor is consistent with the two-gene ortholog_one2many calls from ensembl_compara_nfu. One caveat read back and recorded: several IGF1R entries also carry an obviously spurious automatic "4Fe-4S ferredoxin-type" domain call, so these per-entry domain annotations are not treated as clean.',
    what_it_supports: 'independent corroboration that the killifish carries two receptor loci per human receptor, and a stated reason not to lean on the automatic domain calls',
  }),
  ncbi_gene_cpo: Object.freeze({
    kind: 'record',
    resource: 'NCBI Gene',
    accession: 'GeneID 45840',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=45840',
    verified_how: 'Looked up live this session by esearch on cpo[sym] AND "Drosophila melanogaster"[orgn], which returned the single GeneID 45840, then esummary. Read back: symbol cpo, description "couch potato", chromosome 3R, map 3-61 cM, current annotation symbol CG43738, 25 listed transcript designations. The Alliance-supplied summary in the same record states: "Involved in chemical synaptic transmission; dormancy process; and regulation of hemocyte proliferation" and "Orthologous to human RBPMS (RNA binding protein, mRNA processing factor) and RBPMS2". The FlyBase identifier FBgn0263995 was taken from the efetch XML for the same GeneID.',
    what_it_supports: 'that cpo is a real locus with a dormancy annotation, and that its human counterparts are RBPMS and RBPMS2 - two genes, and not forkhead factors',
  }),
  alliance_cpo_orthologs: Object.freeze({
    kind: 'record',
    resource: 'Alliance of Genome Resources',
    url: 'https://www.alliancegenome.org/api/gene/FB:FBgn0263995/orthologs?limit=60',
    verified_how: 'Fetched live this session; 13 stringent rows parsed. Human: RBPMS and RBPMS2. Teleost (Danio rerio): rbpms, rbpms2a, rbpms2b. Nematode: mec-8. Microbial (Saccharomyces cerevisiae S288C): WHI3 and WHI4. NOT ONE forkhead factor in the set. A method note worth keeping: the first identifier tried, FBgn0000363, returned total=0 AND an all-null gene record - a wrong-but-plausible accession fails as an empty success here, not as an error, which is exactly the shape in which a fabricated accession would pass unnoticed. The working identifier was recovered from the NCBI Gene efetch XML.',
    what_it_supports: 'that the genetic bases named on the two sides of pair (2) are not orthologous to one another in any resource checked, which is the substance of the negative control',
  }),
});

export const SOURCE_IDS = Object.freeze(Object.keys(SOURCES));

// =====================================================================================================
// 2. EVERY GENE SYMBOL USED, AGAINST THE RECORD IT CAME FROM
// =====================================================================================================
//
// The point of this table is that it is checkable. A symbol that appears in a dossier below and not
// here, or here without a record identifier, is a symbol nobody verified.

export const CHECKED_SYMBOLS = Object.freeze([
  Object.freeze({ symbol: 'daf-2', species: 'Caenorhabditis elegans', record: 'WB:WBGene00000898 / UniProt Q968Y9', source: 'uniprot_daf2' }),
  Object.freeze({ symbol: 'daf-16', species: 'Caenorhabditis elegans', record: 'WB:WBGene00000912 / UniProt O16850', source: 'uniprot_daf16' }),
  Object.freeze({ symbol: 'age-1', species: 'Caenorhabditis elegans', record: 'named in the ogg_1997 abstract as a homologue of the PI 3-kinase catalytic subunit', source: 'ogg_1997' }),
  Object.freeze({ symbol: 'daf-23', species: 'Caenorhabditis elegans', record: 'named in the larsen_1995 abstract', source: 'larsen_1995' }),
  Object.freeze({ symbol: 'mec-8', species: 'Caenorhabditis elegans', record: 'returned as a cpo ortholog row by the Alliance', source: 'alliance_cpo_orthologs' }),
  Object.freeze({ symbol: 'INSR', species: 'Homo sapiens', record: 'ENSG00000171105 / UniProt P06213', source: 'uniprot_human_nodes' }),
  Object.freeze({ symbol: 'IGF1R', species: 'Homo sapiens', record: 'ENSG00000140443', source: 'ensembl_compara_nfu' }),
  Object.freeze({ symbol: 'INSRR', species: 'Homo sapiens', record: 'returned as a daf-2 ortholog row by the Alliance', source: 'alliance_daf2_orthologs' }),
  Object.freeze({ symbol: 'FOXO1', species: 'Homo sapiens', record: 'ENSG00000150907', source: 'ensembl_compara_nfu' }),
  Object.freeze({ symbol: 'FOXO3', species: 'Homo sapiens', record: 'ENSG00000118689 / UniProt O43524', source: 'uniprot_human_nodes' }),
  Object.freeze({ symbol: 'FOXO4', species: 'Homo sapiens', record: 'returned as a daf-16 ortholog row by the Alliance; the AFX of the ogg_1997 abstract', source: 'alliance_daf16_orthologs' }),
  Object.freeze({ symbol: 'FOXO6', species: 'Homo sapiens', record: 'returned as a daf-16 ortholog row by the Alliance', source: 'alliance_daf16_orthologs' }),
  Object.freeze({ symbol: 'RBPMS', species: 'Homo sapiens', record: 'returned as a cpo ortholog row by the Alliance and named in the NCBI Gene summary', source: 'alliance_cpo_orthologs' }),
  Object.freeze({ symbol: 'RBPMS2', species: 'Homo sapiens', record: 'returned as a cpo ortholog row by the Alliance and named in the NCBI Gene summary', source: 'alliance_cpo_orthologs' }),
  Object.freeze({ symbol: 'foxo3a', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015020706, Ensembl display name FOXO3A, scaffold sgr16, "forkhead box O3"; the gene Compara calls ortholog_one2one to human FOXO3', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'foxo3b', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015001055, returned by the Ensembl xrefs/symbol lookup for foxo3b and absent from the Compara human-FOXO3 ortholog set; the second of the two paralogs singh_2024 knocks out', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'insra', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015024774, sgr09, "insulin receptor a", symbol sourced from ZFIN ZDB-GENE-020503-3', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'insrb', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015025450, sgr17, "insulin receptor b", ZFIN ZDB-GENE-020503-4', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'igf1ra', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015011508, sgr13, "insulin-like growth factor 1a receptor", ZFIN ZDB-GENE-020503-1', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'igf1rb', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015008221, sgr07, "insulin-like growth factor 1b receptor", ZFIN ZDB-GENE-020503-2', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'foxo1a', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015010187, sgr06, "forkhead box O1 a", ZFIN ZDB-GENE-061013-59', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'foxo1b', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015009307, sgr11, "forkhead box O1 b", ZFIN ZDB-GENE-080425-3', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'rest', species: 'Nothobranchius furzeri', record: 'ENSNFUG00015001987 from the Ensembl xrefs/symbol lookup; named and CRISPR-knocked out as REST in singh_2024', source: 'ensembl_lookup_nfu' }),
  Object.freeze({ symbol: 'CBX7', species: 'Nothobranchius furzeri', record: 'named in the hu_2020 abstract as functionally required for diapause maintenance', source: 'hu_2020' }),
  Object.freeze({ symbol: 'cpo', species: 'Drosophila melanogaster', record: 'NCBI GeneID 45840 / FB:FBgn0263995 / CG43738', source: 'ncbi_gene_cpo' }),
  Object.freeze({ symbol: 'InR', species: 'Drosophila melanogaster', record: 'returned as a daf-2 ortholog row by the Alliance', source: 'alliance_daf2_orthologs' }),
  Object.freeze({ symbol: 'foxo', species: 'Drosophila melanogaster', record: 'returned as a daf-16 ortholog row by the Alliance, a single gene', source: 'alliance_daf16_orthologs' }),
  Object.freeze({ symbol: 'tim', species: 'Drosophila melanogaster', record: 'named in the zonato_2016 abstract as a clock locus affecting diapause inducibility', source: 'zonato_2016' }),
  Object.freeze({ symbol: 'insra / insrb / igf1ra / igf1rb', species: 'Danio rerio', record: 'returned as daf-2 ortholog rows by the Alliance', source: 'alliance_daf2_orthologs' }),
  Object.freeze({ symbol: 'foxo1a / foxo1b / foxo3a / foxo3b / foxo4 / foxo6a / foxo6b', species: 'Danio rerio', record: 'returned as daf-16 ortholog rows by the Alliance, seven genes', source: 'alliance_daf16_orthologs' }),
]);

// =====================================================================================================
// 3. THE DOSSIERS
// =====================================================================================================

export const PAIRS = Object.freeze([

  // ---------------------------------------------------------------------------------------------------
  // (1) CONVERGENT DEVELOPMENTAL ARREST
  // ---------------------------------------------------------------------------------------------------
  Object.freeze({
    id: 'killifish-diapause-dauer',
    a: { species: 'Nothobranchius furzeri', name: 'embryonic diapause' },
    b: { species: 'Caenorhabditis elegans', name: 'dauer larva' },
    claim: 'functional-analogy',
    note:
      'Two reversible, stress-resistant developmental arrests separated by most of animal evolution, each with its own gene programme, and - the part that makes the pair worth a dossier - with a genuinely SHARED, genuinely TESTED node: the forkhead box O transcription factor. On the nematode side daf-16 null mutations suppress the arrest caused by daf-2 or age-1 (ogg_1997, replicated in larsen_1995); on the fish side CRISPR-Cas9 knockout of FOXO3a and FOXO3b disrupts the diapause expression programme (singh_2024). ' +
      'The orthology question was asked of live records rather than assumed, and the answer is ONE-TO-MANY at every node checked but one. daf-2 returns THREE human receptors (INSR, IGF1R, INSRR; alliance_daf2_orthologs) and human INSR and IGF1R each return TWO killifish genes typed ortholog_one2many (ensembl_compara_nfu). daf-16 returns FOUR human forkhead factors and SEVEN in a teleost (alliance_daf16_orthologs), which is what ogg_1997 already said in 1997 when it nominated two human orthologues in one sentence. ' +
      'The apparent exception is the finding. Ensembl Compara calls human FOXO3 against this fish ortholog_one2one - one gene, ENSNFUG00015020706 - and UniProt returns a single FOXO3 entry, so two resources appear to agree that the fish has one. They are both wrong, and the same Ensembl instance says so: asked for its N. furzeri genes by symbol, it returns foxo3a = ENSNFUG00015020706 (display name FOXO3A, scaffold sgr16) AND foxo3b = ENSNFUG00015001055, which is exactly the pair singh_2024 names and knocks out. The orthology table contradicts its own host database\'s gene annotation, in the direction that licenses the phrase "the killifish FOXO3" for a gene that is not single. ' +
      'A second thing that was checked and did NOT hold up: the insulin/IGF RECEPTOR node is implicated on the nematode side only. A regex search of the singh_2024 PMC full text for "insulin", "IGF" and "igf1r" returned zero matches. What is shared and tested is the effector, not the receptor - and in the nematode the receptor exists in this story to ANTAGONISE the effector (ogg_1997). Any design step that borrowed "insulin-signalling arrest" from the nematode into a fish would be borrowing a node with no demonstrated role in the fish arrest.',
    developmental_context: {
      difference_stated: true,
      a: 'Nothobranchius furzeri, EMBRYONIC. The arrest interrupts embryonic development; hu_2020 reports that it can be held for extremely long periods "without trade-offs for subsequent adult growth, fertility, and life span", and that it is actively maintained, with Polycomb members among the most up-regulated genes and CBX7 functionally required. The perturbation evidence in singh_2024 is F0 mosaic knockout in injected embryos at roughly 75% editing efficiency, scored by single-embryo RNA-seq - not a germline null, and not a scored morphological phenotype.',
      b: 'Caenorhabditis elegans, LARVAL. The arrest is an alternative third larval stage entered in response to crowding and limited food (larsen_1995), with its own cuticle and non-feeding physiology, exited by resumption of the reproductive cycle. The perturbation evidence is germline null alleles of daf-16 scored as suppression of dauer arrest and of lifespan extension. ' +
        'So: different life stage, different trigger modality, different cell types, no staging-series correspondence of any kind, and two readouts of "the arrest was disrupted" that do not share an assay - a transcriptional programme on one side, a developmental decision on the other. The word "diapause" is doing more work across this pair than any measurement is.',
    },
    databases_searched: ['Alliance of Genome Resources', 'Ensembl Compara (REST homology)', 'UniProtKB', 'NCBI Gene', 'PubMed / PubMed Central'],
    analogue_search: { performed: true, how: 'function-first: the question asked was which gene in each organism is required for ITS OWN arrest, taken from perturbation results (ogg_1997, larsen_1995, singh_2024), and only then was the orthology of the resulting genes looked up. The orthology lookup was the second search, not the first.' },
    evidence: {
      'rescue': {
        present: false,
        why: 'No cross-species complementation experiment exists for this pair in anything retrieved. The experiment that would exist is specific and absent: put a killifish FOXO3 coding sequence into a daf-16 null and ask whether dauer arrest is restored, or put daf-16 into a FOXO3-knockout killifish embryo and ask whether the diapause programme returns. Neither direction is recorded. This is the one absence that decides the pair, and nothing below substitutes for it.',
      },
      'lof-phenotype': {
        present: true,
        what: 'Removing the forkhead box O factor perturbs the arrest in each species, in its own species\' terms. Nematode: "null mutations in daf-16 suppress the effects of mutations in daf-2 or age-1" and the lifespan extension is "suppressed completely by a daf-16 mutation" (ogg_1997; larsen_1995, two laboratories). Fish: knockout of FOXO3a and FOXO3b disrupts the diapause expression programme - "three TFs - REST, FOXO3a, and FOXO3b - are functionally important for the diapause expression program" (singh_2024).',
        caveat: 'TWO DIFFERENT ASSAYS SHARING A DESCRIPTION. The nematode result is a germline null scored as a developmental decision (does the animal arrest or not). The fish result is F0 mosaic editing at roughly 75% efficiency scored as a transcriptional programme by single-embryo RNA-seq; no arrest/no-arrest morphological scoring of the knockouts is recorded in what was retrieved. "Disrupts the arrest" therefore means two measurably different things on the two sides, and the module\'s own warning about one-sided evidence applies: each factor is shown to be REQUIRED for something comparable, not shown to be able to do the other\'s job.',
        source: 'ogg_1997; larsen_1995; singh_2024',
      },
      'sequence-orthology': {
        present: true,
        homology_type: 'one-to-many',
        what: 'The genetic components named on the two sides ARE orthologous, and the relationship is one-to-many at every node. daf-2 (the nematode receptor) returns INSR, IGF1R and INSRR on the human side; daf-16 (the nematode effector) returns FOXO1, FOXO3, FOXO4 and FOXO6, and seven forkhead factors in a teleost. On the killifish side human INSR and IGF1R each return two genes typed ortholog_one2many, and the foxo3 and foxo1 loci are each a pair in the gene annotation. There is no node here at which one gene corresponds to one gene.',
        n_on_human_side_receptor: 3,
        n_on_human_side_effector: 4,
        n_on_fish_side_per_human_receptor: 2,
        members_receptor_human: ['INSR', 'IGF1R', 'INSRR'],
        members_effector_human: ['FOXO1', 'FOXO3', 'FOXO4', 'FOXO6'],
        members_fish_insr: ['insra = ENSNFUG00015024774 (sgr09)', 'insrb = ENSNFUG00015025450 (sgr17)'],
        members_fish_igf1r: ['igf1ra = ENSNFUG00015011508 (sgr13)', 'igf1rb = ENSNFUG00015008221 (sgr07)'],
        members_fish_foxo3: ['foxo3a = ENSNFUG00015020706 (sgr16)', 'foxo3b = ENSNFUG00015001055'],
        members_fish_foxo1: ['foxo1a = ENSNFUG00015010187 (sgr06)', 'foxo1b = ENSNFUG00015009307 (sgr11)'],
        identity: null,
        identity_why: 'No pairwise identity is entered for the nematode-to-fish comparison because none was computed this session. The 65.8% / 64.1% and 58.5% figures that WERE retrieved are human-to-fish Compara values (ensembl_compara_nfu) and entering one of them here as if it described this pair would be a fabricated number with a real-looking provenance. The module\'s identity refusal is therefore not triggered, and that is correct: there is no identity claim to refuse.',
        the_orthology_table_contradicted_its_own_database:
          'Ensembl Compara: human FOXO3 -> ENSNFUG00015020706, type ortholog_one2one, ONE gene (ensembl_compara_nfu). UniProt organism_id 105023 gene FOXO3: ONE entry, A0A1A8UJ32 (uniprot_nfu_foxo3). ' +
          'Ensembl xrefs/symbol for the same genome in the same release: foxo3 -> TWO gene ids, foxo3a = ENSNFUG00015020706 and foxo3b = ENSNFUG00015001055 (ensembl_lookup_nfu). singh_2024 names those two paralogs and CRISPR-knocks out both. ' +
          'So the duplicate pair is real and the ortholog_one2one call is the artefact - a call made by one method, inside a database whose own gene annotation carries the second copy. The practical reading: a pipeline that resolved "the killifish FOXO3" through the Compara homology endpoint would have got a single gene id back, with a one2one type stamped on it, for a locus the functional literature treats as a pair. Altenhoff 2016, cited in analogy.mjs, is the general form - "the orthologue" is method-dependent before it is anything else - and this is the specific instance, found by asking a second endpoint of the same resource.',
        why_still_scored_one_to_many:
          'Not because of the FOXO3 ambiguity, which is now resolved against the one2one call, but because every node is one-to-many on its own merits: daf-2 -> three human receptors; human INSR and IGF1R -> two killifish genes each; daf-16 -> four human and seven teleost forkhead factors; and the killifish foxo3 and foxo1 loci are each a pair. There is no node in this comparison at which a single gene on one side corresponds to a single gene on the other.',
        source: 'alliance_daf2_orthologs; alliance_daf16_orthologs; ensembl_compara_nfu; ensembl_lookup_nfu; uniprot_nfu_foxo3; ogg_1997',
      },
      'synteny': {
        present: false,
        why: 'No synteny analysis was run or retrieved, in either of the two places it would matter. (a) Between the nematode and the fish there is no expectation of conserved gene order at this distance, so a negative there would carry no information. (b) WITHIN the fish, synteny is what would say whether foxo3a and foxo3b (and insra/insrb, igf1ra/igf1rb, foxo1a/foxo1b) are ohnologs from the teleost whole-genome duplication or later local duplications - the existence of the pairs is now established from the gene annotation (ensembl_lookup_nfu), but their ORIGIN is not, and only the origin says whether to expect the ancestral function to have been split between them. The genes do sit on different scaffolds where both are known (foxo1a sgr06 / foxo1b sgr11; insra sgr09 / insrb sgr17; igf1ra sgr13 / igf1rb sgr07), which is consistent with a whole-genome duplication and is not a synteny analysis.',
      },
      'expression-domain': {
        present: false,
        why: 'There is no tissue or cell-type correspondence to compare across. The fish side is an embryo; the nematode side is a larva with its own cuticle and a non-feeding gut. ogg_1997 states only that "daf-16 is widely expressed", which is not a domain to match; singh_2024 reports FOXO binding-site enrichment in diapause-specific accessible chromatin, which is a regulatory-landscape measurement and not an expression comparison. Entering either as expression-domain evidence would be counting a different measurement under this heading.',
      },
      'domain-architecture': {
        present: true,
        what: 'The forkhead/winged-helix DNA-binding module is shared and verified on both sides from separate UniProt records: DAF-16 is O16850, Pfam PF00250 (Forkhead), InterPro IPR001766 plus the winged-helix superfamily entries; the killifish FOXO3 is A0A1A8UJ32, annotated Fork-head domain 132-226, Pfam PF00250. On the receptor node the agreement is stronger still: Q968Y9 (DAF-2) and P06213 (human INSR) carry the same four annotated domains in the same order - three fibronectin type-III repeats then a protein kinase domain - alongside a receptor L-domain and a furin-like cysteine-rich region in both.',
        caveat: 'NOT the same architecture, only the same core. The fish and human FOXO3 entries both carry PF16676 (FOXO-TAD) and PF16675 (FOXO_KIX_bdg); the DAF-16 entry carries neither. Two transactivation-associated modules present in one and absent in the other is a real difference in what the proteins can do, and the module\'s own caution applies with force here: identical architecture says nothing about which partner, which compartment or which regulation, and this architecture is not even identical. Several killifish receptor entries additionally carry an obviously spurious automatic "4Fe-4S ferredoxin-type" domain call (uniprot_nfu_receptors), so the per-entry domain annotations on that side are not clean.',
        source: 'uniprot_daf16; uniprot_daf2; uniprot_human_nodes; uniprot_nfu_foxo3; uniprot_nfu_receptors',
      },
      'positional-correspondence': {
        present: false,
        why: 'Not applicable and not quietly borrowed. These are life-history states, not structures occupying places in a body plan, so the anatomist\'s criterion has nothing to attach to. The tempting substitute - "both occupy the position in the life cycle where the lineage waits" - is not positional correspondence in the sense this module defines, and it is also false: one arrest is embryonic and the other larval, so even the life-cycle positions do not correspond.',
      },
    },
  }),

  // ---------------------------------------------------------------------------------------------------
  // (2) THE NEGATIVE CONTROL
  // ---------------------------------------------------------------------------------------------------
  Object.freeze({
    id: 'killifish-diapause-fly-reproductive-diapause',
    a: { species: 'Nothobranchius furzeri', name: 'embryonic diapause' },
    b: { species: 'Drosophila melanogaster', name: 'adult reproductive diapause' },
    claim: 'functional-analogy',
    note:
      'INCLUDED AS A NEGATIVE CONTROL for killifish-diapause-dauer, and recorded as such before the module was run on it. Its purpose is to find out whether a band from analogy.mjs carries information, which it cannot do unless a pair with genuinely absent evidence lands somewhere different from a pair with genuinely present evidence. ' +
      'The two arrests share a word and little else. The fish arrest interrupts EMBRYONIC development (hu_2020). The insect arrest is an ADULT, reproductive state - schmidt_2008 describes "a reproductive diapause that is variable within and among populations", i.e. an adult whose ovaries stop, not an embryo that stops developing. Different life stage, different organ, different physiology. ' +
      'The named genetic bases do not meet either, and this was checked rather than assumed: the insect locus is couch potato (cpo, NCBI GeneID 45840, FB:FBgn0263995, CG43738), an RNA-binding protein gene whose stringent Alliance ortholog set is RBPMS and RBPMS2 on the human side, rbpms/rbpms2a/rbpms2b in a teleost, mec-8 in a nematode, and WHI3/WHI4 in a microbe - 13 stringent rows and not one forkhead factor. The fish side\'s tested factors are FOXO3a, FOXO3b and REST (singh_2024). There is no gene pair here to be orthologous or not. ' +
      'The insect side is also weaker than one citation makes it look, and both citations are kept: schmidt_2008 attributes the diapause difference to a single Lys/Ile substitution in one of six cpo transcripts, while zonato_2016 finds that the downstream SNP "does not seem to play any role in diapause induction in European populations", notes that cpo sits inside the inversion In(3R)Payne so that "interpretation of the cpo cline is not straightforward", and reports that the clock locus tim also affects diapause inducibility. cogni_2013 supports the coding-SNP cline and is the only retrieved source to mention a functional knockout of cpo at all. ' +
      'So every one of the seven evidence kinds is recorded absent, with a stated reason. That is the expected result and it is the point. What it also exposes is a limit of the module: `no-basis` is the class it lands in, and that class\'s own critical_warning says no-basis means "we have not looked". Here we looked - five resources, a function-first search, and a specific orthology check on the insect locus - and found that nothing of these seven kinds applies. The module cannot tell those two situations apart in the class label. The only place the difference shows up is the absence-of-evidence REFUSAL, which fires for a pair that was not searched and stays silent for this one. That is a finding about the module, and it is recorded in MODULE_FINDINGS below rather than left for someone to trip over.',
    developmental_context: {
      difference_stated: true,
      a: 'Nothobranchius furzeri, EMBRYONIC arrest: embryonic development suspended, reversible, actively maintained with Polycomb members up-regulated and CBX7 required (hu_2020); the functionally tested factors are FOXO3a, FOXO3b and REST (singh_2024).',
      b: 'Drosophila melanogaster, ADULT REPRODUCTIVE arrest: a fully developed adult whose reproductive output is suspended, variable within and between populations and clinal with latitude (schmidt_2008; cogni_2013). ' +
        'The contrast is the whole content of the row: the arrest is at a different life stage, in a different organ system, scored by a different measurement (incidence of reproductive arrest in a population of adults, versus a transcriptional programme in single embryos), and the loci implicated on the two sides are not orthologous to one another in any resource checked. A phenotype transferred across this pair would be a prediction with every one of its premises hidden.',
    },
    databases_searched: ['Alliance of Genome Resources', 'NCBI Gene', 'UniProtKB', 'Ensembl Compara (REST homology)', 'PubMed / PubMed Central'],
    analogue_search: { performed: true, how: 'function-first: the loci actually implicated in each arrest were taken from perturbation and mapping results (singh_2024 for the fish; schmidt_2008, cogni_2013 and zonato_2016 for the insect), and then the insect locus was put through a live ortholog lookup to ask whether it meets the fish side anywhere. It does not. The search being recorded as performed is what distinguishes this row from a row nobody looked at.' },
    evidence: {
      'rescue': {
        present: false,
        why: 'No cross-species complementation in either direction, and no plausible version of one: the assays do not correspond. There is no readout in an embryo that corresponds to "this adult\'s ovaries resumed", so even a successful transfer would not be scoring the same thing.',
      },
      'lof-phenotype': {
        present: false,
        why: 'Perturbation results exist on both sides and they are not a matched comparison. Fish: FOXO3a/FOXO3b/REST knockout disrupts the diapause expression programme (singh_2024). Insect: a Lys/Ile substitution in cpo shifts the incidence of reproductive diapause (schmidt_2008), with the association contested for the second SNP, confounded by In(3R)Payne, and shared with tim (zonato_2016). The genes are not counterparts - cpo\'s human orthologs are RBPMS and RBPMS2, not any FOXO (alliance_cpo_orthologs) - the perturbations are of different types (engineered knockout versus natural allelic variation), and the scored states are different states at different life stages. Recording this as lof-phenotype evidence would be exactly the trap analogy.mjs names: two assays sharing a word.',
      },
      'sequence-orthology': {
        present: false,
        homology_type: 'none',
        why: 'There is no gene pair to assert orthology between. The pair as stated is state-against-state, and the genes named on the two sides are not orthologous to one another: the Alliance returns 13 stringent rows for cpo (FB:FBgn0263995) - human RBPMS and RBPMS2, teleost rbpms/rbpms2a/rbpms2b, nematode mec-8, microbial WHI3/WHI4 - and no forkhead factor appears in the set. This is a checked negative on a named locus, not an unperformed search; and under the module\'s own rule it remains a statement about ANCESTRY that licenses no conclusion about function.',
        source: 'alliance_cpo_orthologs; ncbi_gene_cpo',
      },
      'synteny': {
        present: false,
        why: 'Not applicable: no gene pair is asserted, so there is no expected locus at which to check a neighbourhood. Across this phylogenetic distance a synteny negative would also carry no information even if there were.',
      },
      'expression-domain': {
        present: false,
        why: 'No shared tissue, stage or cell-type vocabulary exists between an arrested fish embryo and an adult insect reproductive system. There is nothing to align the comparison against, so no comparison is entered.',
      },
      'domain-architecture': {
        present: false,
        why: 'Not applicable to a state pair, and not available even if the genes were substituted for the states: cpo encodes an RNA-binding protein (NCBI GeneID 45840, "Predicted to enable mRNA binding activity") while the tested fish factors are forkhead/winged-helix DNA-binding transcription factors. Different protein class, so there is no shared module to report.',
      },
      'positional-correspondence': {
        present: false,
        why: 'None, and the absence is the informative part. These are not structures in a body plan. The nearest life-cycle analogue of the criterion actively fails: the arrests sit at NON-corresponding points in their life cycles - embryo against reproductive adult - so the one criterion that might have been granted on generosity is the one the comparison explicitly fails.',
      },
    },
  }),
]);

// =====================================================================================================
// 4. SCORED - COMPUTED AT IMPORT TIME, NOT TYPED BY HAND
// =====================================================================================================
//
// The band is recorded by running the module, so nobody gets to assert a band in prose. If analogy.mjs
// changes its intervals, these move and the tests notice.

export const SCORED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, scoreAnalogy(p.a, p.b, p.evidence)])
));

export const CLASSIFIED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, classify(p)])
));

export const REFUSED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, refuse(p)])
));

const RANK = Object.freeze(['no-support', 'weak', 'moderate', 'strong', 'directly-tested']);
const TEST_PAIR = 'killifish-diapause-dauer';
const CONTROL_PAIR = 'killifish-diapause-fly-reproductive-diapause';

/**
 * Did the module actually separate the test pair from its negative control? Computed, because a
 * dossier that reported the separation it hoped for would be worth nothing.
 */
export const BAND_SEPARATION = Object.freeze({
  test_pair: TEST_PAIR,
  control_pair: CONTROL_PAIR,
  test_band: Object.freeze([SCORED[TEST_PAIR].confidence.lo, SCORED[TEST_PAIR].confidence.hi]),
  control_band: Object.freeze([SCORED[CONTROL_PAIR].confidence.lo, SCORED[CONTROL_PAIR].confidence.hi]),
  test_label: SCORED[TEST_PAIR].confidence.label,
  control_label: SCORED[CONTROL_PAIR].confidence.label,
  labels_differ: SCORED[TEST_PAIR].confidence.label !== SCORED[CONTROL_PAIR].confidence.label,
  test_label_is_higher: RANK.indexOf(SCORED[TEST_PAIR].confidence.label) > RANK.indexOf(SCORED[CONTROL_PAIR].confidence.label),
  bands_do_not_overlap: SCORED[TEST_PAIR].confidence.lo > SCORED[CONTROL_PAIR].confidence.hi,
  // The same question asked again under analogy.mjs's second, equally defensible set of intervals.
  // A separation that only exists under one weighting is our weighting, not the evidence.
  alt_test_band: Object.freeze([SCORED[TEST_PAIR].confidence.under_alternative_weighting.lo, SCORED[TEST_PAIR].confidence.under_alternative_weighting.hi]),
  alt_control_band: Object.freeze([SCORED[CONTROL_PAIR].confidence.under_alternative_weighting.lo, SCORED[CONTROL_PAIR].confidence.under_alternative_weighting.hi]),
  alt_labels_differ: SCORED[TEST_PAIR].confidence.under_alternative_weighting.label !== SCORED[CONTROL_PAIR].confidence.under_alternative_weighting.label,
  alt_bands_do_not_overlap: SCORED[TEST_PAIR].confidence.under_alternative_weighting.lo > SCORED[CONTROL_PAIR].confidence.under_alternative_weighting.hi,
  test_label_is_robust_to_weighting: SCORED[TEST_PAIR].confidence.label_is_robust_to_weighting,
  control_label_is_robust_to_weighting: SCORED[CONTROL_PAIR].confidence.label_is_robust_to_weighting,
  test_class: CLASSIFIED[TEST_PAIR].class,
  control_class: CLASSIFIED[CONTROL_PAIR].class,
  neither_is_a_functional_equivalent: CLASSIFIED[TEST_PAIR].functional_equivalent === false && CLASSIFIED[CONTROL_PAIR].functional_equivalent === false,
  what_this_is:
    'Whether analogy.mjs put the pair with real evidence somewhere different from the pair with none. ' +
    'If labels_differ were false, the band would be carrying no information about these two rows and the ' +
    'dossier would be reporting that instead.',
});

export const MODULE_FINDINGS = Object.freeze([
  Object.freeze({
    finding: 'The module separated the two pairs, by label and by non-overlapping bands.',
    detail: `${TEST_PAIR} bands ${BAND_SEPARATION.test_band.join('-')} (${BAND_SEPARATION.test_label}); ${CONTROL_PAIR} bands ${BAND_SEPARATION.control_band.join('-')} (${BAND_SEPARATION.control_label}). The lower bound of the first is above the upper bound of the second, so the separation is not only a label boundary.`,
    verified: BAND_SEPARATION.labels_differ && BAND_SEPARATION.test_label_is_higher && BAND_SEPARATION.bands_do_not_overlap,
  }),
  Object.freeze({
    finding: 'The SEPARATION survives re-weighting only as a label. The disjoint bands do not.',
    detail: `Under the default intervals the test pair bands ${BAND_SEPARATION.test_band.join('-')} and the control ${BAND_SEPARATION.control_band.join('-')} - disjoint. Under analogy.mjs's second, equally defensible set of base intervals they band ${BAND_SEPARATION.alt_test_band.join('-')} and ${BAND_SEPARATION.alt_control_band.join('-')}, which OVERLAP, while the labels still differ. And the test pair's own label moves from "${BAND_SEPARATION.test_label}" to "${SCORED[TEST_PAIR].confidence.under_alternative_weighting.label}" on identical evidence, so analogy.mjs's own sensitivity probe says the word "${BAND_SEPARATION.test_label}" on this pair is ours and not the biology's. The honest headline for pair (1) is therefore the ORDERING against its control, which both weightings agree on, and not the band endpoints, which they do not.`,
    verified: BAND_SEPARATION.bands_do_not_overlap
      && BAND_SEPARATION.alt_bands_do_not_overlap === false
      && BAND_SEPARATION.alt_labels_differ
      && BAND_SEPARATION.test_label_is_robust_to_weighting === false,
  }),
  Object.freeze({
    finding: 'The module cannot distinguish "searched and found nothing" from "did not look" in its CLASS label.',
    detail: 'The negative control lands in `no-basis`, whose critical_warning reads "THIS IS A STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY. no-basis means we have not looked". For this row five resources were queried, a function-first search was run, and a specific orthology lookup on the insect locus returned a checked negative. The class label is the same either way. The only signal that separates them is the absence-of-evidence refusal, which stays silent here because databases_searched meets MIN_DATABASES and analogue_search.performed is true. A reader who looks at the class and not the refusals will draw the wrong conclusion about this row.',
    verified: CLASSIFIED[CONTROL_PAIR].class === 'no-basis'
      && typeof CLASSIFIED[CONTROL_PAIR].critical_warning === 'string'
      && REFUSED[CONTROL_PAIR].refusals.every(r => r.id !== 'absence-of-evidence'),
  }),
  Object.freeze({
    finding: 'An orthology table contradicted its own host database\'s gene annotation, in the direction that breaks a mapping.',
    detail: 'Ensembl Compara returns human FOXO3 -> ENSNFUG00015020706 with type ortholog_one2one. The Ensembl xrefs/symbol endpoint, same resource, same genome, returns TWO foxo3 genes for this fish: foxo3a = ENSNFUG00015020706 and foxo3b = ENSNFUG00015001055. singh_2024 names and knocks out both. A pipeline that resolved "the killifish FOXO3" through the homology endpoint alone would have received one gene id with a one2one stamp on it. This is not a finding about analogy.mjs so much as a demonstration that the hazard it was written against is live, inside a single resource, on the first locus checked.',
    verified: true,
    verified_by: 'ensembl_compara_nfu and ensembl_lookup_nfu, both fetched this session; see SOURCES',
  }),
  Object.freeze({
    finding: 'The one-to-many guard held on the pair that had the most evidence, which is where it matters.',
    detail: 'killifish-diapause-dauer carries three present evidence kinds including a two-sided loss-of-function result, and still cannot reach a functional-equivalence class, because the orthology relationship on both of its named nodes is one-to-many. The refusal fired by name.',
    verified: CLASSIFIED[TEST_PAIR].class === 'one-to-many-ambiguous'
      && CLASSIFIED[TEST_PAIR].functional_equivalent === false
      && REFUSED[TEST_PAIR].refusals.some(r => r.id === 'one-to-many-is-not-equivalence'),
  }),
]);

export const OPEN_QUESTIONS = Object.freeze([
  'Are foxo3a/foxo3b, insra/insrb, igf1ra/igf1rb and foxo1a/foxo1b ohnologs from the teleost whole-genome duplication, or later local duplications? The pairs themselves are established from the gene annotation; their origin is not, and only the origin says whether to expect the ancestral job to have been split between the copies. Synteny around each locus is the check, it is not held here, and it is the cheapest decisive analysis on this page.',
  'Which copy of each pair carries the diapause function? singh_2024 knocks out foxo3a and foxo3b together. Single knockouts scored in the same assay, with each copy\'s transcript measured in the other\'s mutant, is what would separate redundancy from transcriptional adaptation and tell a design programme which gene to carry.',
  'Does the insulin/IGF receptor node act in the fish arrest at all? Nothing retrieved this session implicates it, and the fish has two loci per human receptor, so the question is not "is the receptor involved" but "which of the four".',
  'Can a killifish FOXO3 coding sequence restore dauer arrest in a daf-16 null? That is the rescue experiment, it would be the first direct functional test for this pair, and the one-to-many orthology means the answer would still not make either gene the other\'s equivalent - it would make the SET the mapping.',
  'Is the fish-side loss-of-function result robust to germline nulls rather than F0 mosaics, and does it hold when the arrest itself is scored rather than its transcriptional programme?',
]);

// =====================================================================================================
// 5. CLI
// =====================================================================================================

const RUN_DIRECTLY = /(^|[\\/])diapause\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
  console.log(`\nanalogues/combos/pairs/diapause.mjs - ${PAIRS.length} dossiers, ${SOURCE_IDS.length} verified sources, ${CHECKED_SYMBOLS.length} checked symbols\n`);
  for (const p of PAIRS) {
    const s = SCORED[p.id], c = CLASSIFIED[p.id], r = REFUSED[p.id];
    console.log(`  ${p.id}`);
    console.log(`    ${p.a.species}: ${p.a.name}  vs  ${p.b.species}: ${p.b.name}`);
    console.log(`    class ${c.class}  homology ${c.homology_type}  band ${s.confidence.lo}-${s.confidence.hi} (${s.confidence.label})  span ${s.confidence.label_span.join('/')}`);
    console.log(`    present: ${s.present_kinds.join(', ') || 'nothing'}`);
    console.log(`    refusals: ${r.refusals.map(x => x.id).join(', ') || 'none'}`);
    console.log(`    alt weighting: ${s.confidence.under_alternative_weighting.lo}-${s.confidence.under_alternative_weighting.hi} (${s.confidence.under_alternative_weighting.label}); label robust: ${s.confidence.label_is_robust_to_weighting}`);
    console.log('');
  }
  console.log(`  separation: ${BAND_SEPARATION.test_label} vs ${BAND_SEPARATION.control_label}; labels differ ${BAND_SEPARATION.labels_differ}; bands disjoint ${BAND_SEPARATION.bands_do_not_overlap}\n`);
  for (const m of MODULE_FINDINGS) console.log(`  [${m.verified ? 'verified' : 'NOT VERIFIED'}] ${m.finding}`);
  console.log('');
  for (const q of OPEN_QUESTIONS) console.log(`  open: ${q.slice(0, 150)}`);
  console.log('');
  // A cheap internal consistency print: every evidence kind accounted for on every pair.
  for (const p of PAIRS) {
    const missing = EVIDENCE_IDS.filter(k => !(k in p.evidence));
    console.log(`  ${p.id}: evidence kinds declared ${EVIDENCE_IDS.length - missing.length}/${EVIDENCE_IDS.length}${missing.length ? ` MISSING ${missing.join(', ')}` : ''}; homology types vocabulary ${HOMOLOGY_TYPES.join('|')}`);
  }
  console.log('');
}
