#!/usr/bin/env node
// electric-organ.mjs - TWO DOSSIERS ON THE MYOGENIC ELECTRIC ORGAN, BUILT AGAINST analogues/analogy.mjs
//
//   node analogues/combos/pairs/electric-organ.mjs        # print the two verdicts
//   node analogues/combos/pairs/test-electric-organ.mjs   # the tests
//
// ============================== WHY THESE TWO PAIRS ==============================
// analogy.mjs is built on the premise that HOMOLOGY (shared ancestry) and ANALOGY (shared function) are
// different claims supported by different evidence. Its classifier treats them as alternatives: the
// `convergent-analogue` class is reachable only when `sequence-orthology` is absent, and the orthology
// branches are taken first. These two pairs were chosen because each one breaks that alternative, in
// opposite directions, and because the breakage is checkable rather than rhetorical.
//
//   PAIR 1 - scn4aa in two independently electric fish lineages. The gene is ORTHOLOGOUS between the
//            lineages AND was independently CO-OPTED into a novel organ in each. Both claims are true at
//            once. analogy.mjs can hold only one of them in its class label, and it holds the less
//            interesting one. Reported below as a finding about the module, not a complaint about biology.
//
//   PAIR 2 - the electrocyte against the skeletal myofibre of the SAME fish. Here ancestry is not in
//            doubt at any level: the electrocyte is a modified myofibre. There is no gene pair, so
//            `sequence-orthology` is absent, so the classifier reaches `convergent-analogue` - "shared
//            function without shared ancestry" - for the one pair in this repo whose shared ancestry is
//            least in question. That is a false label produced by correct code, and it is the single most
//            useful thing in this file.
//
// ============================== WHAT WAS CHECKED, AND HOW ==============================
// Every accession, gene id, DOI and PMID below was retrieved live in the session that wrote this file.
// SOURCES carries a `verified_how` on each entry saying what was fetched and what was read back. Two
// things that would have made the dossiers look better were checked and found NOT to hold, and are
// recorded as absences:
//
//   (a) THERE IS NO scn4aa IN THE MORMYROID REFERENCE ANNOTATION. NCBI Gene has exactly one voltage-gated
//       sodium channel type IV alpha gene annotated in Paramormyrops kingsleyae - scn4ab, GeneID
//       111856075, chromosome 22 - and no scn4aa. NCBI's scn4ab ortholog group (225 species) contains
//       that gene; NCBI's scn4aa ortholog group (266 species, exactly one gene per species) does not
//       contain any mormyroid gene at all. So side (a) of pair 1 is a gene the literature sequenced and
//       the reference annotation does not carry. The orthology claim rests on cDNA accessions and
//       published gene trees, not on a database ortholog edge.
//
//   (b) THE CURATED MORMYROID AND GYMNOTIFORM Nav1.4a PROTEINS ARE HALF-LENGTH. UniProt E5DMN3
//       (Gnathonemus petersii) is 967 aa and E5DMP7 (Brachyhypopomus pinnicaudatus) is 944 aa, against
//       1829 aa for the full Danio rerio scn4aa protein (Q2XVR3). The GenBank records they come from say
//       "partial cds" in the title. So the four-domain architecture is NOT established from a record on
//       either side of pair 1, and `domain-architecture` is marked absent rather than asserted from the
//       family name.
//
// ============================== THE DUPLICATION QUESTION ==============================
// The pair-1 interpretation turns on whether the scn4aa/scn4ab duplication is SHARED (one ancient event,
// before either lineage) or INDEPENDENT (two events). What the record says:
//
//   SHARED, and old. Zakon et al. 2006 state the two genes "duplicated early in teleost evolution,
//   likely the result of a genomewide duplication". Arnegard et al. 2010 put a number on the gap:
//   "Independent evolution of electric organs and Scn4aa co-option occurred more than 100 million years
//   following the origin of Scn4aa by duplication."
//
//   SO THE INDEPENDENT THING IS THE CO-OPTION, NOT THE DUPLICATION. The duplicate was sitting in the
//   genome of the common ancestor of both lineages, doing a muscle job, for over 100 Myr; each lineage
//   then separately moved it into a novel organ. That is why this pair is orthologous and convergent at
//   the same time, and it is also why the convergence is NOT "two lineages invented the same gene" - it
//   is "two lineages reached for the same pre-existing spare part".
//
//   WHERE IT IS NOT SETTLED, stated rather than smoothed:
//     * The whole-genome-duplication attribution is hedged in the source. "Likely the result of a
//       genomewide duplication" is a phylogenetic inference from a gene tree; Zakon 2006 presents no
//       synteny or chromosomal analysis to distinguish an ohnolog pair from an older local duplication,
//       which is the analysis that would settle it (analogy.mjs: synteny "is the main way to tell an
//       ohnolog pair apart from a recent local duplication").
//     * What this file CAN add is weaker than synteny and is reported as such: in three teleost genomes
//       checked live, scn4aa and scn4ab sit on different chromosomes - Danio rerio 12 and 3, Electrophorus
//       electricus 15 and 6, Scleropages formosus 3 and 8. Non-adjacency in three genomes is inconsistent
//       with a recent tandem duplication and consistent with ohnologs. It is NOT a synteny check: no
//       flanking-gene correspondence was examined, so the `synteny` slot below stays absent and says why.
//     * No mormyroid chromosome could be put into that comparison, because of (a) above.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). Nothing here names a member
// of it or reads a datum from it. Run `node holdout/check-leaks.mjs analogues` against this folder.
//
// ============================== THE RULE FOLLOWED THROUGHOUT ==============================
// An evidence kind this file cannot establish from a record it actually read is marked `present: false`
// with a `why` naming what is missing. Nothing is asserted from a family name, a review's summary of
// somebody else's figure, or the plausibility of the claim. Pair 2 lands in a weak band for that reason,
// and the weak band is the correct report.

import { scoreAnalogy, classify, refuse, HOMOLOGY_TYPES, AMBIGUOUS_HOMOLOGY_TYPES, EVIDENCE_IDS } from '../../analogy.mjs';

// =====================================================================================================
// SOURCES
// =====================================================================================================
// Every entry was retrieved in-session. `verified_how` says which endpoint was called and which field was
// read back. Nothing in this object is recalled; where a title in the task brief disagreed with the
// record, the record wins and the disagreement is noted.

export const SOURCES = Object.freeze({
  zakon_2006: Object.freeze({
    citation: 'Zakon, H.H., Lu, Y., Zwickl, D.J. & Hillis, D.M. (2006) Sodium channel genes and the evolution of diversity in communication signals of electric fishes: convergent molecular evolution. PNAS 103(10):3675-3680.',
    pmid: '16505358',
    pmcid: 'PMC1450141',
    doi: '10.1073/pnas.0600160103',
    verified_how: 'PubMed search_articles then get_article_metadata on PMID 16505358: title, journal PNAS 103(10):3675-80, DOI 10.1073/pnas.0600160103, PMC1450141 and the full abstract were returned. The article body was then fetched from pmc.ncbi.nlm.nih.gov/articles/PMC1450141/ to read two specific sentences back.',
    what_it_states_that_is_used_here: [
      'Nav1.4a "is expressed in muscle in nonelectric fishes has lost its expression in muscle and is expressed instead in the evolutionarily novel electric organ in both lineages of electric fishes" (abstract, read back verbatim).',
      'The exception, read back from the body: "Nav1.4a is expressed solely in the EO in S. macrurus and B. pinnicaudatus, but in the muscle of A. leptorhynchus." So the loss of muscle expression is not uniform even within one of the two electric lineages.',
      'The duplication, read back from the body: the two genes "duplicated early in teleost evolution, likely the result of a genomewide duplication". Hedged in the source, and no synteny or chromosomal analysis is presented there.',
      'Convergent amino-acid replacements fall in domains that influence channel inactivation, with selection on the inactivation "ball" in one lineage and on its receptor site in the other (abstract).',
    ],
    what_it_does_not_state: 'No electrophysiological comparison of a mormyroid Nav1.4a against a gymnotiform Nav1.4a, and no cross-lineage expression or complementation experiment. The paper is a sequence-and-expression comparison.',
  }),
  arnegard_2010: Object.freeze({
    citation: 'Arnegard, M.E., Zwickl, D.J., Lu, Y. & Zakon, H.H. (2010) Old gene duplication facilitates origin and diversification of an innovative communication system - twice. PNAS 107(51):22172-22177.',
    pmid: '21127261',
    pmcid: 'PMC3009798',
    doi: '10.1073/pnas.1011803107',
    verified_how: 'PubMed get_article_metadata on PMID 21127261 returned the title, PNAS 107(51):22172-7, DOI 10.1073/pnas.1011803107, PMC3009798 and the full abstract. get_full_text_article on PMC3009798 returned an EMPTY full_text field, so only the abstract was read and only abstract-level statements are used below.',
    what_it_states_that_is_used_here: [
      'Scn4aa "arose by whole-genome duplication" and "was neofunctionalized for expression in electric organ and subsequently experienced strong positive selection" (abstract).',
      '"Independent evolution of electric organs and Scn4aa co-option occurred more than 100 million years following the origin of Scn4aa by duplication." (abstract). This is the sentence that settles shared-duplication / independent-co-option.',
      '"amino acid substitutions in both groups occurred in the same regions of the sodium channel" during diversification (abstract).',
    ],
    what_it_does_not_state: 'The abstract makes no synteny claim and reports no functional assay on either channel. Whether the body contains one is UNKNOWN here: the full text did not retrieve.',
  }),
  gallant_2014: Object.freeze({
    citation: 'Gallant, J.R., Traeger, L.L., Volkening, J.D., Moffett, H., Chen, P.-H., Novina, C.D., Phillips, G.N., Anand, R., Wells, G.B., Pinch, M., Guth, R., Unguez, G.A., Albert, J.S., Zakon, H.H., Samanta, M.P. & Sussman, M.R. (2014) Genomic basis for the convergent evolution of electric organs. Science 344(6191):1522-1525.',
    pmid: '24970089',
    pmcid: 'PMC5541775',
    doi: '10.1126/science.1254432',
    verified_how: 'PubMed get_article_metadata on PMID 24970089. NOTE: the task brief gave this paper\'s title as "Genomic basis for stimulus-induced..." and that is WRONG. The record returns "Nonhuman genetics. Genomic basis for the convergent evolution of electric organs.", Science 344(6191):1522-5, DOI 10.1126/science.1254432. The brief\'s title was not used.',
    what_it_states_that_is_used_here: [
      '"The myogenic electric organ has evolved six times in fishes" (abstract) - so "twice" in pair 1 is two of six, not the whole story.',
      'The study assembled the Electrophorus electricus genome and sequenced "electric organ and skeletal muscle transcriptomes from three lineages that have independently evolved electric organs" (abstract). That is the electric-organ-versus-skeletal-muscle comparison pair 2 is about, run at transcriptome scale.',
      '"independent lineages have leveraged similar transcription factors and developmental and cellular pathways in the evolution of electric organs" (abstract).',
    ],
    what_it_does_not_state: 'No per-gene expression value is taken from this paper here, because the full text was not retrieved. Only the abstract-level statement that the EO/muscle transcriptome comparison was made is used.',
  }),
  unguez_zakon_1998: Object.freeze({
    citation: 'Unguez, G.A. & Zakon, H.H. (1998) Reexpression of myogenic proteins in mature electric organ after removal of neural input. Journal of Neuroscience 18(23):9924-9935.',
    pmid: '9822748',
    pmcid: 'PMC6793277',
    doi: '10.1523/JNEUROSCI.18-23-09924.1998',
    verified_how: 'PubMed get_article_metadata on PMID 9822748 returned the title, J Neurosci 18(23):9924-35, DOI 10.1523/JNEUROSCI.18-23-09924.1998 and the full abstract, read back below.',
    what_it_states_that_is_used_here: [
      '"The electric organ (EO) of the weakly electric fish Sternopygus macrurus derives from striated myofibers that fuse and suppress many muscle properties." - the derivation claim for pair 2, from a primary source.',
      '"Mature electrocytes are larger than muscle fibers, do not contain sarcomeres, or express myosin heavy chain (MHC) or tropomyosin. Furthermore, electrocytes express keratin, a protein not expressed in muscle."',
      'After spinal transection or denervation, electrocytes up-regulate MHC and tropomyosin and form "newly formed sarcomere clusters", which the authors call "a partial reversal of the electrocyte phenotype to an earlier developmental stage of its myogenic lineage".',
    ],
    what_it_does_not_state: 'Nothing about any gene\'s loss of function. The perturbation is removal of neural input, not removal of a gene - which is why the `lof-phenotype` slot in pair 2 is absent and says so.',
  }),
  kim_2004: Object.freeze({
    citation: 'Kim, J.A., Jonsson, C.B., Calderone, T. & Unguez, G.A. (2004) Transcription of MyoD and myogenin in the non-contractile electrogenic cells of the weakly electric fish, Sternopygus macrurus. Development Genes and Evolution 214(8):380-392.',
    pmid: '15309633',
    doi: '10.1007/s00427-004-0421-5',
    verified_how: 'PubMed get_article_metadata on PMID 15309633 returned title, Dev Genes Evol 214(8):380-92, DOI 10.1007/s00427-004-0421-5 and the full abstract.',
    what_it_states_that_is_used_here: [
      '"mature electrocytes, which retain the muscle proteins dystrophin, desmin, acetylcholine receptors (AChRs), alpha-actin, and alpha-actinin, also transcribe the MyoD and myogenin genes."',
      '"expression of these MRFs is confined to the myogenic lineage" in this fish.',
      '"the levels of MyoD and myogenin transcripts in skeletal muscle and EO could not be used to predict the level to which a cell manifests the muscle program."',
    ],
    what_it_does_not_state: 'No quantitative cell-type-resolved expression matrix; the comparison is tissue-level EO versus muscle.',
  }),
  cuellar_2006: Object.freeze({
    citation: 'Cuellar, H., Kim, J.A. & Unguez, G.A. (2006) Evidence of post-transcriptional regulation in the maintenance of a partial muscle phenotype by electrogenic cells of S. macrurus. FASEB Journal 20(14):2540.',
    pmid: '17077280',
    doi: '10.1096/fj.06-6474fje',
    verified_how: 'PubMed get_article_metadata on PMID 17077280 returned title, FASEB J 20(14):2540, DOI 10.1096/fj.06-6474fje and the full abstract.',
    what_it_states_that_is_used_here: [
      '"Our expression analyses detected transcripts for alpha-actin, alpha-acetylcholine (ACh) receptor (alpha-AChR), desmin, muscle creatine kinase (MCK), myosin heavy chain (MHC) isoforms, titin, tropomyosin, and troponin-T genes in the EO."',
      '"However, immunolabeling studies revealed that electrocytes do not contain MCK, MHCs, or tropomyosin or troponin-T proteins."',
    ],
    why_this_source_is_the_important_one_here:
      'It is a measured instance of the caveat analogy.mjs already attaches to the expression-domain kind - "Transcript presence is not protein presence is not activity" - in the exact pair being scored. The transcripts match and four of the proteins are absent. Expression-domain evidence is marked present for pair 2 and this is carried as its caveat.',
  }),
  kim_2008: Object.freeze({
    citation: 'Kim, J.A., Laney, C., Curry, J. & Unguez, G.A. (2008) Expression of myogenic regulatory factors in the muscle-derived electric organ of Sternopygus macrurus. Journal of Experimental Biology 211(Pt 13):2172-2184.',
    pmid: '18552307',
    pmcid: 'PMC2650510',
    doi: '10.1242/jeb.016592',
    verified_how: 'PubMed get_article_metadata on PMID 18552307 returned title, J Exp Biol 211(Pt 13):2172-84, DOI 10.1242/jeb.016592 and the full abstract.',
    what_it_states_that_is_used_here: [
      '"Southern blot analyses revealed a single MyoD, myogenin, myf5 and MRF4 gene" in the S. macrurus genome - i.e. no duplicate pair to confound the within-species comparison for these four genes.',
      '"Quantitative RT-PCR showed that muscle and EO transcribe all MRF genes. With the exception of MyoD, the endogenous levels of myogenin, myf5 and MRF4 transcripts in electrocytes were greater than those detected in muscle fibers."',
      '"the partial muscle program of the EO is not associated with a partial expression of MRFs".',
    ],
    what_it_does_not_state: 'It does not identify what does cause the partial program. The paper reports that the obvious explanation fails.',
  }),
  kim_2009: Object.freeze({
    citation: 'Kim, H.-J., Guth, R., Jonsson, C.B. & Unguez, G.A. (2009) S. macrurus myogenic regulatory factors (MRFs) induce mammalian skeletal muscle differentiation; evidence for functional conservation of MRFs. International Journal of Developmental Biology 53(7):993-1002.',
    pmid: '19598116',
    pmcid: 'PMC2711524',
    doi: '10.1387/ijdb.082672hk',
    verified_how: 'PubMed get_article_metadata on PMID 19598116 returned title, Int J Dev Biol 53(7):993-1002, DOI 10.1387/ijdb.082672hk and the full abstract.',
    what_it_states_that_is_used_here: [
      'S. macrurus MyoD and myogenin, over-expressed in mouse C3H/10T1/2 and NIH3T3 cells, "efficiently convert these two cell lines into multinucleated myotubes which expressed differentiated muscle markers", at levels "comparable to those obtained with mouse MRF homologs".',
    ],
    why_it_is_NOT_entered_as_rescue_for_pair_2:
      'Three reasons, all of them disqualifying. (1) The subject is the MRF protein, not the cell-type pair: it tests whether a fish MyoD can act like a mouse MyoD, which says nothing about whether an electrocyte is the functional analogue of a myofibre. (2) It is a trans-differentiation gain of function in a non-muscle cell line, not complementation of a loss. (3) The host is a mammalian cell line, so a positive result is about the transcription factor\'s portability and not about either fish cell. Entering it as rescue would be exactly the inflation analogy.mjs enumerates under `and_rescue_is_not_a_blank_cheque`.',
  }),
  ncbi_gene_danio_scn4aa: Object.freeze({
    record: 'NCBI Gene 572442 - scn4aa, "sodium channel, voltage-gated, type IV, alpha, a", Danio rerio, chromosome 12; synonyms zscn3, Nav1.4a; nomenclature authority ZFIN ZDB-GENE-051201-2; Swiss-Prot Q2XVR3.',
    verified_how: 'Live GET https://api.ncbi.nlm.nih.gov/datasets/v2alpha/gene/id/572442 - read back symbol, description, chromosome 12, ZFIN identifier ZDB-GENE-051201-2, swiss_prot_accessions ["Q2XVR3"], synonyms ["zscn3","Nav1.4a"]. Cross-checked against live GET https://rest.ensembl.org/lookup/symbol/danio_rerio/scn4aa which returned ENSDARG00000098738 on GRCz11 chromosome 12, description "sodium channel, voltage-gated, type IV, alpha, a [Source:ZFIN;Acc:ZDB-GENE-051201-2]".',
    what_it_establishes: 'That the symbol scn4aa and the name Nav1.4a denote one gene, in two independent resources that agree on its identity and chromosome. It is the anchor the ortholog group below is drawn from, and the reason the literature\'s "Nav1.4a" and the databases\' "scn4aa" can be treated as the same object in this file.',
  }),
  ncbi_gene_danio_scn4ab: Object.freeze({
    record: 'NCBI Gene 564977 - scn4ab, "sodium channel, voltage-gated, type IV, alpha, b", Danio rerio, chromosome 3; aliases Nav1.4b, zscn5.',
    verified_how: 'Live esearch on db=gene for scn4ab[sym] AND Danio rerio[orgn] returned two ids, 564977 and 652950; esummary showed 652950 is a withdrawn record (status 1, currentid 564977), so the live gene is 564977 alone. Read back name, description and chromosome 3. Recording this is the reason a naive "two hits, therefore one-to-many" reading was avoided.',
    what_it_establishes: 'The identity of the sibling ohnolog, and - by the withdrawn second id - that a hit count from a symbol search is not a copy number. Two search hits here would have read as one-to-many to anything that counted rows instead of checking their status, which is the exact failure analogy.mjs says breaks a mapping.',
  }),
  ncbi_gene_electrophorus: Object.freeze({
    record: 'NCBI Gene 113588309 - scn4aa, Electrophorus electricus, chromosome 15, locus tag AB5993_002405. NCBI Gene 113587832 - scn4ab, Electrophorus electricus, chromosome 6, locus tag AB5993_018997.',
    verified_how: 'Live esearch db=gene for Electrophorus electricus[orgn] AND scn4a* returned exactly these two ids; esummary read back both symbols, descriptions and chromosomes. Gene 113588309 also appears in the live ortholog listing below.',
    what_it_establishes: 'That the gymnotiform genome carries exactly two scn4a alpha genes, one per ohnolog group, on different chromosomes - the same arrangement as the non-electric reference. So the gymnotiform side of pair 1 is not a lineage-specific duplicate, and the co-option worked on a copy that was already there.',
  }),
  ncbi_gene_paramormyrops: Object.freeze({
    record: 'NCBI Gene 111856075 - scn4ab, "sodium channel, voltage-gated, type IV, alpha, b", Paramormyrops kingsleyae, chromosome 22. NO scn4aa is annotated in this genome.',
    verified_how: 'Live esearch db=gene: Paramormyrops kingsleyae[orgn] AND scn4a* returned no scn4aa; a wider search on "type IV, alpha" returned 9 genes of which exactly one is a sodium channel (111856075 scn4ab) and the rest are collagens and ceramide transporters; a search on "sodium channel AND alpha" returned 12 genes with no scn4aa among them. The genome is annotated (44,677 genes in db=gene for this organism), so this is an absence in an annotated genome and not an absence of a genome.',
    why_this_matters: 'Side (a) of pair 1 is a gene with no node in the reference annotation of the only mormyroid genome in NCBI Gene. The orthology claim therefore cannot be read off a database edge and has to be carried by cDNA accessions and published gene trees, which is a weaker and differently-shaped basis. It is also the single most load-bearing thing checked for this file.',
  }),
  ncbi_ortholog_group_scn4aa: Object.freeze({
    record: 'NCBI Ortholog group for scn4aa (anchored on GeneID 572442): 266 genes across 266 species, exactly one gene per species, no species with two. Members read back include Danio rerio 572442 (chr 12), Electrophorus electricus 113588309 (chr 15), Ictalurus punctatus 100304603 (chr 13), Astyanax mexicanus 103021833 (chr 15), Brachyhypopomus gauderio, and Scleropages formosus 108924827 (chr 3). No mormyroid member.',
    verified_how: 'Live GET https://api.ncbi.nlm.nih.gov/datasets/v2alpha/gene/id/572442/orthologs?page_size=500 - total_count 266, 266 reports returned, counted one gene per taxname with an empty set of species having more than one, and grepped the taxname list for mormyroid genera (none) and gymnotiform genera (Electrophorus electricus, Brachyhypopomus gauderio).',
    what_it_establishes: 'The SHAPE of the scn4aa relationship across teleosts is one-to-one in this resource: 266 species, 266 genes. That is the fact that licenses homology_type "one-to-one" for pair 1, and it is a statement about one resource\'s graph, which analogy.mjs is explicit about (Altenhoff 2016).',
    what_it_does_not_establish: 'Anything about the mormyroid side, which is absent from the group.',
  }),
  ncbi_ortholog_group_scn4ab: Object.freeze({
    record: 'NCBI Ortholog group for scn4ab (anchored on GeneID 564977): 225 genes across 225 species, one per species. Members read back include Danio rerio 564977 (chr 3), Electrophorus electricus 113587832 (chr 6), Scleropages formosus 108941716 (chr 8), Paramormyrops kingsleyae 111856075 (chr 22), Danio aesculapii 130221051 (chr 3).',
    verified_how: 'Live GET https://api.ncbi.nlm.nih.gov/datasets/v2alpha/gene/id/564977/orthologs?page_size=500 - total 225 reports, one gene per taxname, and the four records above printed by filtering the taxname list.',
    what_it_establishes: 'That the mormyroid genome IS represented in the sibling ohnolog\'s group. The absence of a mormyroid scn4aa is therefore specific to scn4aa and is not a general gap in that genome\'s annotation or in NCBI\'s ortholog graph.',
  }),
  genbank_mormyroid_scn4aa_cdnas: Object.freeze({
    record: 'GU362024 - Mormyrops anguilloides voltage-gated sodium channel type IV alpha subunit Nav1.4a (scn4aa) mRNA, PARTIAL cds, 2871 bp. GU362025 - Myomyrus macrops, same, 2901 bp. GU362026 - Petrocephalus soudanensis, same, 2886 bp. All three created 2010/11/14.',
    verified_how: 'Live esearch db=nuccore for Mormyridae[orgn] AND Scn4aa (240 records) then esummary on three ids, reading back caption, full title, organism, sequence length and creation date. The deposit date matches Arnegard 2010.',
    what_it_establishes: 'That mormyroid scn4aa sequence exists as deposited cDNA. The titles say "partial cds" and the lengths are about half a full Nav alpha coding sequence, which is why domain-architecture is absent for pair 1.',
  }),
  genbank_gymnotiform_scn4aa: Object.freeze({
    record: 'XM_035533255 - PREDICTED: Electrophorus electricus scn4aa mRNA, 7224 bp, created 2020/07/16. OR839038 - Sternopygus macrurus isolate 9065 Nav1.4a protein (scn4aa) gene, PARTIAL cds, 561 bp, created 2024/03/07 (one of a Sternopygus series OR839033-OR839040).',
    verified_how: 'Live esearch db=nuccore for Gymnotiformes[orgn] AND scn4aa[titl] then esummary, reading back caption, title, organism, length and date for each.',
    what_it_establishes: 'A full-length predicted transcript exists on the gymnotiform side; the Sternopygus records are 561 bp fragments. The two sides of pair 1 are therefore not symmetric in what is available, and the asymmetry is in the record rather than in the biology.',
  }),
  uniprot_danio_q2xvr3: Object.freeze({
    record: 'UniProt Q2XVR3 (SC4AA_DANRE) - "Sodium channel protein type 4 subunit alpha A", Danio rerio, gene scn4aa, 1829 aa. 24 annotated transmembrane segments. Pfam PF00520 (Ion_trans) with MatchStatus 4 - four copies. Pfam PF06512 (Na_trans_assoc), PF24609 (IQ_SCN5A_C). InterPro IPR001696 (Na_channel_asu), IPR044564 (Na_chnl_inactivation_gate), IPR005821 (Ion_trans_dom), IPR027359 (Volt_channel_dom_sf).',
    verified_how: 'Live GET https://rest.uniprot.org/uniprotkb/Q2XVR3.json with fields for protein_name, gene_names, length, xref_pfam, xref_interpro, ft_domain, ft_transmem; read back the accession, entry name SC4AA_DANRE, length 1829, the count of 24 Transmembrane features, and the Pfam PF00520 MatchStatus of 4.',
    what_it_establishes: 'The canonical architecture - four Ion_trans repeats, 24 transmembrane segments, an annotated inactivation-gate signature - FOR THE NON-ELECTRIC REFERENCE GENE. It is the yardstick that shows the electric-lineage records are partial, not evidence about either side of pair 1.',
  }),
  uniprot_electric_lineage_nav14a: Object.freeze({
    record: 'UniProt E5DMN3 (E5DMN3_9TELE) - "Voltage-gated sodium channel type IV alpha subunit Nav1.4a", Gnathonemus petersii, gene scn4aa, 967 aa, unreviewed. E5DMP7 (E5DMP7_BRAPD) - same protein name, Brachyhypopomus pinnicaudatus, 944 aa, unreviewed. E5DMQ2 - Apteronotus leptorhynchus, 927 aa. Eleven further mormyroid entries at 919-967 aa (E5DMN2, E5DMN4-E5DMN9, E5DMP0-E5DMP4).',
    verified_how: 'Two live GETs to https://rest.uniprot.org/uniprotkb/search with query gene:scn4aa AND taxonomy_name:Mormyridae, and the same for Gymnotiformes, fields accession/id/protein_name/organism_name/length/reviewed in TSV. Lengths and organism names read back directly from the returned table.',
    what_it_establishes: 'That curated protein records exist on both sides of pair 1, naming the same protein, in the two species Zakon 2006 compared (G. petersii on the mormyroid side, B. pinnicaudatus on the gymnotiform side). Also that they are 944-967 aa against 1829 aa for the full Danio protein - roughly half - and all unreviewed. So they support the orthology call and do NOT support a domain-architecture call.',
  }),
  chromosomal_placements_checked: Object.freeze({
    record: 'scn4aa and scn4ab sit on different chromosomes in all three genomes where both were readable: Danio rerio 12 / 3, Electrophorus electricus 15 / 6, Scleropages formosus 3 / 8.',
    verified_how: 'Chromosome fields read back from the two live NCBI ortholog-group listings above (GeneIDs 572442 and 564977) for the three species present in both.',
    what_it_establishes: 'Weak support for ohnologs over a recent tandem duplication, which bears on the shared-versus-independent question in the header.',
    what_it_is_not: 'It is not synteny. Synteny means a correspondence of flanking genes, and no flanking gene was examined. analogy.mjs is explicit that synteny is the kind that distinguishes an ohnolog pair from a local duplication, and this is not that kind of evidence. The synteny slot in pair 1 is marked absent for exactly this reason.',
  }),
});

// =====================================================================================================
// THE PAIRS
// =====================================================================================================

export const PAIRS = Object.freeze([
  Object.freeze({
    id: 'scn4aa-mormyroid-gymnotiform',
    a: { species: 'Gnathonemus petersii', name: 'scn4aa (Nav1.4a)' },
    b: { species: 'Brachyhypopomus pinnicaudatus', name: 'scn4aa (Nav1.4a)' },
    claim: 'convergent-analogy',
    note:
      'The pair that is orthologous AND convergent at once, which is the case analogy.mjs treats as two alternatives. The duplication that created scn4aa is SHARED and ancient - Zakon 2006 places it "early in teleost evolution, likely the result of a genomewide duplication", and Arnegard 2010 states the co-option happened "more than 100 million years following the origin of Scn4aa by duplication" - so what each lineage did independently is RECRUIT a pre-existing spare copy into a novel organ, not invent a gene. ' +
      'Both halves of that are true of this pair simultaneously, and the classifier can report only one: with sequence-orthology present it takes the orthology branch and returns orthologous-untested, which is correct by its own rules and omits the entire reason the pair is interesting. See SCHEMA_STRAIN. ' +
      'Two things that would have improved this dossier were checked and failed. There is no scn4aa annotated in Paramormyrops kingsleyae, the only mormyroid genome in NCBI Gene, although its scn4ab IS in the sibling ortholog group - so side (a) has no node in the reference annotation. And the curated Nav1.4a proteins on both sides are 944-967 aa against 1829 aa for the full Danio protein, so the four-domain architecture is not established from a record on either side and domain-architecture is marked absent.',
    developmental_context: {
      difference_stated: true,
      a: 'mormyroid: a single myogenic electric organ in the caudal peduncle; electrocytes derived from myogenic precursors; Nav1.4a transcription restricted to the electric organ and lost from muscle (Zakon 2006). No staged developmental series for electrocyte differentiation is held in this repo, so the stage at which the restriction is established is not stated.',
      b: 'gymnotiform: a myogenic electric organ along the body with lineage-specific morphology; Nav1.4a restricted to the electric organ in Sternopygus macrurus and Brachyhypopomus pinnicaudatus - BUT retained in muscle in Apteronotus leptorhynchus, read back verbatim from Zakon 2006. The expression restriction is therefore not a property of the clade, and the context difference inside the gymnotiform side is larger than the one between the two sides for this trait.',
      why_it_still_matters: 'Pair 1 makes no phenotype-transfer claim, so analogy.mjs would not demand this field. It is stated because the Apteronotus exception is the fact most likely to be lost when this pair is summarised.',
    },
    databases_searched: ['NCBI Gene', 'NCBI Datasets ortholog groups', 'Ensembl REST (danio_rerio)', 'GenBank nuccore', 'UniProtKB', 'ZFIN (via NCBI nomenclature authority field)'],
    analogue_search: { performed: true, what: 'function-first: asked which sodium-channel gene carries the electrocyte action current in each lineage independently of ancestry, via the Zakon 2006 and Arnegard 2010 expression results and the Gallant 2014 electric-organ/skeletal-muscle transcriptome comparison, then went to the gene records rather than the reverse.' },
    evidence: {
      'sequence-orthology': {
        present: true,
        homology_type: 'one-to-one',
        what: 'scn4aa is one-to-one across teleosts in NCBI\'s ortholog graph: 266 genes in 266 species, exactly one per species, no species with two. Electrophorus electricus scn4aa (GeneID 113588309, chr 15) is a member; the sibling ohnolog scn4ab forms a separate 225-species group. On each side there are two scn4a genes per genome where both were readable, consistent with one ancient duplicate pair rather than lineage-specific duplication.',
        members_checked: ['Danio rerio 572442 (chr 12)', 'Electrophorus electricus 113588309 (chr 15)', 'Scleropages formosus 108924827 (chr 3)'],
        protein_records_both_sides: ['UniProt E5DMN3, Gnathonemus petersii, 967 aa', 'UniProt E5DMP7, Brachyhypopomus pinnicaudatus, 944 aa'],
        cdna_records: ['GU362024', 'GU362025', 'GU362026', 'XM_035533255', 'OR839038'],
        identity: null,
        why_no_identity: 'No pairwise alignment was run in this session, so no identity figure is entered. A number recalled rather than computed is the kind of thing this repo treats as the worst available output, and analogy.mjs does not need one: identity is not evidence about function either way.',
        the_hole_in_this_call: 'There is NO scn4aa in the NCBI Gene annotation of Paramormyrops kingsleyae, the only mormyroid genome in that resource, although its scn4ab is in the sibling ortholog group. So the one-to-one shape is established from the resource\'s graph for 266 OTHER species and from cDNA records plus published gene trees for the mormyroid side - not from a database ortholog edge joining the two sides of this pair. A single resource\'s graph is a statement about one method (Altenhoff 2016) before it is anything else, and here it has a hole exactly where this pair needs it.',
        source: 'SOURCES.ncbi_ortholog_group_scn4aa, ncbi_ortholog_group_scn4ab, ncbi_gene_paramormyrops, uniprot_electric_lineage_nav14a, genbank_mormyroid_scn4aa_cdnas',
      },
      'expression-domain': {
        present: true,
        what: 'The same gene occupies the same novel expression domain in both lineages: Zakon 2006 reports that Nav1.4a "has lost its expression in muscle and is expressed instead in the evolutionarily novel electric organ in both lineages of electric fishes". Gallant 2014 made the electric-organ-versus-skeletal-muscle transcriptome comparison in three independently electric lineages.',
        caveat: 'It does not hold across the gymnotiform side. Apteronotus leptorhynchus retains the ancestral muscle expression. Read back verbatim from Zakon 2006: "Nav1.4a is expressed solely in the EO in S. macrurus and B. pinnicaudatus, but in the muscle of A. leptorhynchus." A correspondence that fails within one of the two groups being compared is a correspondence with a stated exception, not a clade-level fact, and the exception is the more informative half: Zakon 2006 uses that species as its internal control, reporting no evidence of selection on the gene where muscle expression is retained.',
        second_caveat: 'Tissue-level transcript localisation, in dissected electric organ versus dissected muscle. No cell-type-resolved measurement and no protein-level or channel-density measurement is entered here, so analogy.mjs\'s standing caveat applies in full: transcript presence is not protein presence is not activity.',
        source: 'SOURCES.zakon_2006, SOURCES.gallant_2014',
      },
      'domain-architecture': {
        present: false,
        why: 'Not establishable from a record on either side. The curated Nav1.4a proteins for the two species in this pair are UniProt E5DMN3 at 967 aa and E5DMP7 at 944 aa, against 1829 aa for the full Danio rerio scn4aa protein Q2XVR3, and the GenBank mRNAs they derive from say "partial cds" in their titles. The four Ion_trans repeats (Pfam PF00520, MatchStatus 4), the 24 transmembrane segments and the annotated inactivation-gate signature were read back from Q2XVR3 - a NON-ELECTRIC reference gene that is not either side of this pair. Asserting the architecture for the two electric-lineage proteins from the family name, or from a reference species, would be exactly the substitution this module refuses.',
        what_would_establish_it: 'A full-length coding sequence from a mormyroid and from a gymnotiform, or an InterPro/Pfam scan showing four Ion_trans repeats in each. Zakon 2006 does report convergent substitutions in the inactivation ball and its receptor site, which locates the interesting residues inside the DIII-DIV region the partial cDNAs do cover - but that is a claim about particular residues, not about the architecture, and it is not what this evidence kind asks.',
      },
      'synteny': {
        present: false,
        why: 'No flanking-gene correspondence was examined, and synteny means flanking-gene correspondence. What WAS checked live is weaker and is recorded in SOURCES.chromosomal_placements_checked: scn4aa and scn4ab sit on different chromosomes in all three genomes where both were readable (Danio 12/3, Electrophorus 15/6, Scleropages 3/8), which is inconsistent with a recent tandem duplication and consistent with ohnologs. No mormyroid chromosome could enter that comparison at all, because no mormyroid scn4aa is annotated.',
        why_it_matters_here_more_than_usual: 'analogy.mjs says synteny "is the main way to tell an ohnolog pair apart from a recent local duplication", and the shared-versus-independent duplication question is the whole interpretation of this pair. Zakon 2006 hedges - "likely the result of a genomewide duplication" - and presents no synteny or chromosomal analysis. So the evidence kind that would settle the pair\'s central question is the one absent on both sides, and the source\'s own hedge is still the state of the record.',
      },
      'lof-phenotype': {
        present: false,
        why: 'No loss-of-function experiment on scn4aa exists in either lineage in anything read here. Neither group is a genetically tractable model: Zakon 2006 and Arnegard 2010 are sequence-and-expression comparisons across wild-caught species, and Gallant 2014 is genome assembly plus transcriptomes. A knockout would also be hard to interpret even if it existed, because the sibling ohnolog scn4ab is present in both genomes and is a candidate compensator (Rossi 2015, El-Brolosy 2019).',
      },
      'rescue': {
        present: false,
        why: 'No complementation experiment in either direction, and nothing close to one. No heterologous expression of a mormyroid Nav1.4a in a gymnotiform electrocyte or the reverse; no expression of either in a common cell background scored against the other. This is the only kind that would test the functional claim and it is absent, so everything present here is a correlate.',
        what_the_experiment_would_be: 'Express the mormyroid and the gymnotiform channel in one heterologous background and compare inactivation kinetics in the same recording, since the convergent substitutions Zakon 2006 identifies are specifically in the inactivation machinery. That is a biophysical comparison of the two proteins and still not a test that either can do the other\'s job in the other\'s electrocyte - which is the claim, and which may not be testable at all in these animals.',
      },
      'positional-correspondence': {
        present: false,
        why: 'This pair is a gene pair. The structures the genes sit in do correspond - both are myogenic electric organs - but entering that here would double-count the convergence that the expression-domain slot already carries, and position is not what is being claimed about the genes.',
      },
    },
  }),

  Object.freeze({
    id: 'electrocyte-skeletal-myofibre',
    a: { species: 'Sternopygus macrurus', name: 'electrocyte (electric organ current-producing cell)' },
    b: { species: 'Sternopygus macrurus', name: 'skeletal muscle fibre (striated myofibre)' },
    claim: 'developmental-correspondence',
    note:
      'A CELL-TYPE pair, entered to find out whether analogy.mjs can speak about one at all. Both sides are the same species on purpose: the comparison the primary literature actually measured is electric organ versus muscle in one fish, and taking both sides from S. macrurus removes the cross-species tissue-vocabulary confound that analogy.mjs flags for the expression-domain kind. ' +
      'The biology is not in dispute. Unguez & Zakon 1998: the electric organ "derives from striated myofibers that fuse and suppress many muscle properties"; mature electrocytes "do not contain sarcomeres, or express myosin heavy chain (MHC) or tropomyosin" and do express keratin, "a protein not expressed in muscle". Kim 2004: electrocytes retain dystrophin, desmin, AChRs, alpha-actin and alpha-actinin and transcribe MyoD and myogenin. ' +
      'And the module gets it wrong. There is no gene pair, so sequence-orthology is absent, so homology_type computes to "none", so the classifier - finding function-bearing evidence with no orthology - returns convergent-analogue, whose stated meaning is "shared function with no shared ancestry at the level of the structure or gene in question". That label is false here in the strongest available sense: the electrocyte IS a modified myofibre, by cell lineage, in the same animal. The code is correct and the output is wrong, which is the most useful kind of failure to have on the record. See SCHEMA_STRAIN.',
    developmental_context: {
      difference_stated: true,
      a: 'mature multinucleated non-contractile electrocyte of the caudal electric organ, derived postembryonically from fused striated myofibres, cholinergically innervated, driven continuously at frequencies above those of the intermittently active muscle (Unguez & Zakon 1998). Keratin-positive, sarcomere-free.',
      b: 'striated myofibre of the same fish: sarcomeric, contractile, intermittently active, keratin-negative. Single MyoD, myogenin, myf5 and MRF4 genes in this genome (Kim 2008 Southern blot), so for these four regulators there is no duplicate pair to confound the comparison - which is worth stating explicitly in a repo whose central problem is duplicate pairs.',
      the_difference_that_matters: 'Not stage or species but DIRECTION: side (a) is derived from side (b) within the life of one animal, and the derivation is reversible. After denervation or spinal transection, electrocytes re-express MHC and tropomyosin and form "newly formed sarcomere clusters", which Unguez & Zakon call "a partial reversal of the electrocyte phenotype to an earlier developmental stage of its myogenic lineage". A pair where one side can be driven back toward the other is not the kind of pair this schema was built for.',
    },
    databases_searched: ['PubMed', 'PubMed Central', 'NCBI Gene (S. macrurus MRF gene count checked against Kim 2008 rather than assumed)'],
    analogue_search: { performed: true, what: 'function-first: asked which cell type in a non-electric teleost performs the job the electrocyte performs, and which cell type the electrocyte came from, via PubMed searches on electrocyte origin and myogenic marker retention. The answer - the striated myofibre, by derivation - came back from four primary papers (Unguez & Zakon 1998, Kim 2004, Cuellar 2006, Kim 2008) and is what set side (b).' },
    evidence: {
      'positional-correspondence': {
        present: true,
        what: 'The electrocyte occupies the position of, and is continuous with the lineage of, the striated myofibre it derives from: the electric organ sits in the caudal body where myotomal muscle sits, and the electrocytes are fused myofibre descendants (Unguez & Zakon 1998). Multinucleate, cholinergically innervated, retaining dystrophin, desmin, AChRs, alpha-actin and alpha-actinin (Kim 2004).',
        caveat: 'This is being entered against the definition of a kind that was written for structures in a body plan - "the anatomist\'s criterion ... when there is no gene to talk about". What is actually recorded here is a CELL LINEAGE relationship, which is a different and in this case much stronger thing. analogy.mjs names shared cell lineage as one of the three ways to BREAK the circularity of positional correspondence (under CLASSES["positional-only"].upgrade, citing Nakamura 2016) - so the evidence that should upgrade this pair out of positional-only is the evidence being entered INTO the positional slot, because there is nowhere else to put it. The band this produces is therefore too low, and it is too low for a structural reason rather than because the evidence is thin.',
        why_not_claimed_as_homology: 'Because this module scores analogy, and the lineage fact is a homology fact. The pair is entered to show that the module has no slot that says so.',
        source: 'SOURCES.unguez_zakon_1998, SOURCES.kim_2004',
      },
      'expression-domain': {
        present: true,
        what: 'Both cell types transcribe the same myogenic programme. All four MRF genes - MyoD, myogenin, myf5, MRF4 - are transcribed in both electric organ and muscle, with myogenin, myf5 and MRF4 transcripts HIGHER in electrocytes than in muscle fibres (Kim 2008, quantitative RT-PCR). The electric organ additionally transcribes alpha-actin, alpha-AChR, desmin, muscle creatine kinase, myosin heavy chain isoforms, titin, tropomyosin and troponin-T (Cuellar 2006). The co-regulators MEF2C, Id1 and Id2 are not unique to either tissue and show similar patterns (Kim 2008).',
        caveat_that_is_the_whole_point: 'Cuellar 2006 measured the proteins and four of them are not there: "immunolabeling studies revealed that electrocytes do not contain MCK, MHCs, or tropomyosin or troponin-T proteins." So this is a measured, in-pair instance of the caveat analogy.mjs attaches to this evidence kind as a standing warning - transcript presence is not protein presence is not activity. The transcript correspondence between these two cell types is high and the protein correspondence is partial, in the same cells, from the same group. Anyone reading the expression evidence as function here has the counter-measurement in the same citation.',
        second_caveat: 'Kim 2004 adds that MRF transcript levels "could not be used to predict the level to which a cell manifests the muscle program", and Kim 2008 that "the partial muscle program of the EO is not associated with a partial expression of MRFs". The correspondence in this slot is real and is explicitly reported by its own authors as not explaining the phenotype difference.',
        source: 'SOURCES.kim_2008, SOURCES.cuellar_2006, SOURCES.kim_2004',
      },
      'lof-phenotype': {
        present: false,
        why: 'No gene loss-of-function experiment on either cell type is held here, and the schema has no slot for the perturbation that WAS done. Unguez & Zakon 1998 removed neural input - spinal transection or denervation - and electrocytes partially reverted: about a third expressed MHC and a quarter tropomyosin at two weeks after transection, roughly two thirds expressed MHC at two weeks after denervation, all electrocytes contained both by five weeks, and sarcomere clusters appeared. Kim 2008 reports the same up-regulation with no accompanying change in MRF transcripts or in MEF2C, Id1 or Id2. That is a strong, quantified, informative perturbation result showing the electrocyte phenotype is actively maintained and is a cell state rather than a terminal identity - and it is not a loss of function of a gene, in either species, so it cannot be entered. See SCHEMA_STRAIN.',
        what_would_fill_the_slot_properly: 'Loss of function of a named gene, scored comparably in electrocyte and myofibre - for instance the gene responsible for the post-transcriptional block Cuellar 2006 infers, which is unidentified. Nothing read here identifies it.',
      },
      'rescue': {
        present: false,
        why: 'No complementation experiment bearing on this pair. The nearest result is Kim 2009, in which S. macrurus MyoD and myogenin over-expressed in mouse C3H/10T1/2 and NIH3T3 cells converted them into multinucleated myotubes at levels comparable to the mouse MRFs. It is deliberately NOT entered here, for the three reasons set out in SOURCES.kim_2009: its subject is the portability of an MRF protein and not the cell-type correspondence; it is a trans-differentiation gain of function rather than complementation of a loss; and its host is a mammalian cell line, so neither fish cell is the thing tested.',
        and_the_deeper_reason: 'Rescue may not be definable for a cell-type pair at all. "Can cell type A do cell type B\'s job" has no complementation assay of the form analogy.mjs describes - there is no mutant to complement and no gene to put in. The absence here is partly a gap in the evidence and partly a gap in the question, and the module\'s output does not distinguish those two. It counts this as one of three high-value missing kinds and widens the band downward accordingly, which is the right arithmetic applied to a slot that cannot be filled.',
      },
      'sequence-orthology': {
        present: false,
        homology_type: 'none',
        why: 'Not a gene pair: both sides are cell types. The honest entry is absent, and the consequence is the misclassification this dossier exists to record - homology_type computes to "none" and the classifier reads that as no shared ancestry, when the two cell types share not merely ancestry but a lineage inside one animal. The value "none" is doing double duty in this module: it means both "no orthology relationship" and "not the kind of thing that has one", and nothing downstream can tell those apart.',
      },
      'synteny': { present: false, why: 'Not applicable to a cell-type pair. No genomic neighbourhood to compare.' },
      'domain-architecture': { present: false, why: 'Not applicable to a cell-type pair. No protein on either side to assign domains to.' },
    },
  }),
]);

// =====================================================================================================
// SCORED - computed at import time, so the band is recorded rather than asserted by hand
// =====================================================================================================
//
// No band, label or class below is typed into this file. They are whatever scoreAnalogy and classify
// return for the evidence above. If the module changes, these change, and the tests read them from here.

export const SCORED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, scoreAnalogy(p.a, p.b, p.evidence)])
));

export const CLASSIFIED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, classify(p)])
));

export const REFUSALS = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, refuse(p)])
));

// =====================================================================================================
// SCHEMA_STRAIN - where the schema did not fit, stated as findings rather than left to be discovered
// =====================================================================================================
//
// The brief asked, for pair 2, to say exactly where the schema strains. It strains in four places, and
// three of them are visible in the computed output above rather than only in prose, which is why the
// tests assert them.

export const SCHEMA_STRAIN = Object.freeze({
  'orthology-and-convergence-are-not-alternatives': Object.freeze({
    pair: 'scn4aa-mormyroid-gymnotiform',
    what_happens: 'classify() takes its orthology branches before its convergence branch, so a pair with sequence-orthology present can never reach convergent-analogue. This pair is both: the genes are one-to-one orthologues and the organ they were recruited into arose independently in each lineage, more than 100 Myr after the duplication (Arnegard 2010). The returned class is orthologous-untested.',
    why_the_code_is_right: 'The precedence exists to stop a one-to-many pair buying promotion with other evidence, which is the failure that ends as a dead experiment. Reordering the branches to let this pair through would reopen that hole. The cost of closing it is that convergence becomes invisible whenever orthology is present.',
    why_the_output_is_still_incomplete: 'The class label carries the less interesting of two true facts. A reader who sees orthologous-untested learns that there is a one-to-one orthologue and no rescue, and learns nothing about the independent co-option - which is the only reason a design programme would look at this pair, since "that lineage recruited a spare copy into a new organ" is the borrowable move.',
    what_would_fix_it_in_the_module: 'Not a reordering. A second, orthogonal field - whether the FUNCTION arose independently - reported alongside the class rather than instead of it. Convergence of function and orthology of sequence are answers to different questions and the current single-label output can only answer one. The convergent-analogue class as written conflates "the function arose independently" with "there is no orthology", and this pair separates them.',
  }),
  'none-means-two-different-things': Object.freeze({
    pair: 'electrocyte-skeletal-myofibre',
    what_happens: 'sequence-orthology absent makes homology_type "none". The classifier then finds function-bearing evidence with no orthology and returns convergent-analogue, defined as "shared function with no shared ancestry at the level of the structure or gene in question".',
    why_that_label_is_false: 'The electrocyte is a modified myofibre. It derives from striated myofibres that fuse (Unguez & Zakon 1998), retains myogenic markers (Kim 2004), transcribes all four MRFs (Kim 2008), and partially reverts toward muscle when neural input is removed. Shared ancestry is less in question for this pair than for any other pair in this repo, and the module labels it as having none.',
    the_mechanism: '"none" is overloaded. It means "no orthology relationship was found" and it also means "these are not the kind of things that have an orthology relationship", and nothing downstream distinguishes them. A cell-type pair, a structure pair and a gene pair whose orthology search came back empty all arrive at the same value.',
    what_would_fix_it: 'A distinct homology_type value for not-applicable, or a declared pair KIND (gene / structure / cell-type) that gates which evidence kinds are even askable and which classes are reachable. Note that analogy.mjs already carries structure pairs that mark sequence-orthology "not a gene pair" - insect-wing-pectoral-fin and endoskeletal-disc-autopod - and both of those happen to be genuinely non-homologous or genuinely uncertain, so the overloading never bit. This pair is the one where it bites.',
  }),
  'no-slot-for-a-cell-state-perturbation': Object.freeze({
    pair: 'electrocyte-skeletal-myofibre',
    what_happens: 'The strongest perturbation result available for this pair - denervation and spinal transection driving electrocytes back toward a muscle phenotype, with quantified proportions at two and five weeks and newly formed sarcomeres (Unguez & Zakon 1998), and no accompanying MRF change (Kim 2008) - cannot be entered. lof-phenotype is defined as removing a GENE. So a quantified, repeated, mechanistically informative experiment is recorded as an absence.',
    the_consequence_is_arithmetical_not_only_cosmetic: 'lof-phenotype is one of the three HIGH_VALUE_IF_MISSING kinds, so its absence pushes the lower bound of the band down by a fixed amount. The band for this pair is narrower and lower than the evidence warrants, and the reason is the shape of the slot rather than the state of the literature.',
    what_would_fix_it: 'An eighth kind for a perturbation that changes a cell STATE rather than removing a gene - denervation, transplantation, culture, forced activity - with its own statement of what it does and does not establish. It establishes that the phenotype is actively maintained and is reversible, which is a genuinely different thing from either rescue or loss of function, and it is the kind of evidence a cell-type analogy will most often have.',
  }),
  'the-lineage-evidence-goes-in-the-slot-it-is-supposed-to-rescue': Object.freeze({
    pair: 'electrocyte-skeletal-myofibre',
    what_happens: 'Shared cell lineage had to be entered under positional-correspondence, the weakest kind in the list (band 0.05-0.30), because there is no other slot for it.',
    why_that_is_backwards: 'analogy.mjs names shared cell lineage as one of the three things that BREAK the circularity of positional correspondence - under CLASSES["positional-only"].upgrade, citing Nakamura 2016 on fin rays and digits. So the evidence that is supposed to upgrade a pair out of positional-only is being scored AS positional-only, at positional-only\'s band. The one pair in this repo that actually has the upgrade gets no credit for it.',
    what_would_fix_it: 'Either a shared-lineage evidence kind of its own, or an explicit field on positional-correspondence recording that the correspondence is lineage-based rather than topological, with a different band. The distinction matters precisely because position is circular and lineage is not.',
  }),
  what_did_NOT_strain: Object.freeze([
    'The refusals. Neither pair triggers one, and in both cases that is correct rather than lucky: pair 1 has function-bearing evidence so the identity-alone refusal rightly stands down, has a one-to-one relationship so the one-to-many refusal rightly does not fire, and makes no phenotype-transfer claim. Pair 2 has a completed function-first search and enough resources searched, so the absence-of-evidence refusal rightly clears. The refusals discriminated.',
    'The band-not-a-point discipline. Both pairs come back with hi > lo and a label span, and pair 1\'s span straddles label boundaries, which is the honest report for evidence this shaped.',
    'The insistence on homology_type. Having to state it forced the shared-versus-independent duplication question to be answered from the record instead of waved at, and that question turned out to have a clean answer (shared duplication, independent co-option) and a hedge in the source ("likely the result of a genomewide duplication", with no synteny analysis presented). Both are now on the record.',
  ]),
});

// =====================================================================================================
// WHAT THIS FILE DOES NOT CLAIM
// =====================================================================================================

export const NOT_CLAIMED = Object.freeze([
  'That either scn4aa can do the other\'s job. No rescue, no cross-lineage expression, no biophysical comparison of the two channels in one background is held here. The pair rests on one-to-one orthology plus a shared novel expression domain, both correlates.',
  'That the scn4aa/scn4ab duplication is definitely a whole-genome duplication product. The source hedges ("likely"), no synteny was examined by it or by this file, and the chromosomal non-adjacency checked here is weaker evidence than synteny and covers three genomes, none of them mormyroid.',
  'That loss of muscle expression of Nav1.4a is a property of either electric lineage. It is not: Apteronotus leptorhynchus retains it, read back verbatim from Zakon 2006.',
  'Any pairwise identity figure for pair 1. None was computed in this session, so none is recorded. The slot is null with a stated reason.',
  'That the electrocyte and the myofibre are convergent. The module returns that label; this file records it as a misclassification and says which mechanism produced it.',
  'That the mormyroid scn4aa does not exist. It is deposited as cDNA (GU362024-GU362026) and curated as protein (E5DMN3 and eleven siblings). What was checked and found absent is a gene node in the NCBI Gene annotation of Paramormyrops kingsleyae - an annotation gap, not a biological absence, and the distinction is the kind this repo exists to keep.',
  'Anything about how many times a myogenic electric organ arose. Gallant 2014 says six times in fishes; only two lineages are compared here, and nothing in this file bears on the other four.',
]);

// =====================================================================================================

const RUN_DIRECTLY = /(^|[\\/])electric-organ\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
  console.log(`\nanalogues/combos/pairs/electric-organ.mjs - ${PAIRS.length} dossiers, ${Object.keys(SOURCES).length} verified sources\n`);
  for (const p of PAIRS) {
    const s = SCORED[p.id], c = CLASSIFIED[p.id];
    console.log(`  ${p.id}`);
    console.log(`    ${p.a.species}:${p.a.name}`);
    console.log(`    ${p.b.species}:${p.b.name}`);
    console.log(`    class        ${c.class}   (functional_equivalent ${c.functional_equivalent})`);
    console.log(`    band         ${s.confidence.lo}-${s.confidence.hi}  label ${s.confidence.label}  span ${s.confidence.label_span.join('/')}`);
    console.log(`    alt band     ${s.confidence.under_alternative_weighting.lo}-${s.confidence.under_alternative_weighting.hi}  label ${s.confidence.under_alternative_weighting.label}  (label robust: ${s.confidence.label_is_robust_to_weighting})`);
    console.log(`    homology     ${s.homology_type}`);
    console.log(`    present      ${s.present_kinds.join(', ') || 'none'}`);
    console.log(`    absent       ${EVIDENCE_IDS.filter(k => !s.present_kinds.includes(k)).join(', ')}`);
    console.log(`    refusals     ${REFUSALS[p.id].refusals.map(r => r.id).join(', ') || 'none'}`);
    console.log(`    gaps         ${s.gaps.length}`);
    console.log('');
  }
  console.log(`  schema strain recorded at ${Object.keys(SCHEMA_STRAIN).filter(k => k !== 'what_did_NOT_strain').length} points; ${SCHEMA_STRAIN.what_did_NOT_strain.length} parts of the schema held.`);
  console.log(`  homology type vocabulary in use: ${HOMOLOGY_TYPES.join(', ')} (ambiguous: ${AMBIGUOUS_HOMOLOGY_TYPES.join(', ')})`);
  console.log(`  things this file does not claim: ${NOT_CLAIMED.length}\n`);
}
