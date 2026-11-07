#!/usr/bin/env node
// ucp1-thermogenesis.mjs - TWO DOSSIERS ON HEAT AND ON CHROMATIN, BUILT AGAINST analogues/analogy.mjs
//
//   node analogues/combos/pairs/ucp1-thermogenesis.mjs        # print the two verdicts
//   node analogues/combos/pairs/test-ucp1-thermogenesis.mjs   # the tests
//
// ============================== WHY THESE TWO PAIRS ==============================
// analogy.mjs ranks RESCUE first because it is the only one of its seven evidence kinds that tests
// function rather than a correlate of function. Most pairs therefore sit on correlates, and the module
// spends most of its time saying so. These two pairs were chosen to sit at the two ends of that scale and
// to be checkable at both ends.
//
//   PAIR 1 - mouse Ucp1 against the disrupted pig UCP1 locus. THE RESCUE HAS ACTUALLY BEEN DONE, in the
//            host, with the donor's gene. Zheng et al. 2017 knocked a mouse UCP1 cassette into the
//            porcine UCP1 locus and measured thermoregulation in live pigs. This is the one pair in this
//            folder where the top rung of the ladder is occupied by a real experiment rather than by an
//            argument, so it is worth being exact about what the experiment did and did not restore.
//
//   PAIR 2 - tardigrade Dsup against human HMGN1. A foreign protein that works in a vertebrate cell and
//            has no orthologue anywhere in the vertebrates. The question asked here is the one a design
//            programme would ask next: is there a host protein this is the functional counterpart OF?
//            A candidate exists and is named in the literature. The pair still assembles to zero present
//            evidence kinds, because every function-bearing experiment on either side was run on one side
//            alone. The module's answer is a refusal, not a low score, and that is the correct answer.
//
// ============================== WHAT WAS CHECKED, AND HOW ==============================
// Every accession, gene id, coordinate, DOI and PMID below was retrieved live in the session that wrote
// this file. SOURCES carries a `verified_how` on each entry naming what was fetched and what was read
// back. Four things that would have made these dossiers look better were checked and found NOT to hold,
// and are recorded as absences rather than smoothed over:
//
//   (a) THE THREE RESOURCES DISAGREE ABOUT WHETHER PIG UCP1 EXISTS AS A GENE. NCBI Gene holds two live
//       records with the locus symbol UCP1 for Sus scrofa: GeneID 751863, typed `pseudo`, flagged "not
//       in current annotation release", carrying the Berg 2006 sentence about the exon 3-5 deletion; and
//       GeneID 106504722, typed `protein-coding`, three exons, in the current annotation. Ensembl's REST
//       symbol lookup for sus_scrofa UCP1 returns "No valid lookup found for symbol UCP1" while the same
//       endpoint returns a VGNC-symbolled gene for sus_scrofa UCP3. So the thing on side (b) of pair 1
//       is a pseudogene, a protein-coding gene, or not a gene, depending on which record you read.
//
//   (b) THE ORTHOLOGY EDGE POINTS AT THE PROTEIN-CODING RECORD, AND THAT RECORD'S PROTEIN IS FLAGGED.
//       NCBI's ortholog set for mouse Ucp1 contains exactly one pig gene, 106504722 - so the relationship
//       is one-to-one and not one-to-many. Its single protein model, XP_084827257.1, is titled "LOW
//       QUALITY PROTEIN: mitochondrial brown fat uncoupling protein 1" and is 198 aa against the mouse
//       protein's 307 aa (NP_033489.1). The resource that supplies the orthology call does not itself
//       record the locus as disrupted; the flag on the protein and the exon count are the only hints in
//       it, and the disruption is a result from the primary literature.
//
//   (c) NO DOMAIN DATABASE ASSIGNS Dsup TO ANYTHING AT ALL. InterPro's entry endpoint for UniProt P0DOW4
//       returns HTTP 204, no content: zero entries from any member database. UniProtKB's P0DOW4 cross-
//       references are EMBL, AlphaFoldDB, Proteomes, GO and DisProt - no Pfam, no InterPro, no PANTHER,
//       no OrthoDB. For comparison the same InterPro endpoint returns six entries for HMGN1 (P05114),
//       including Pfam PF01101 and PANTHER PTHR23087. The HMGN-like motif in Dsup is a literature
//       finding, not a database assignment, so `domain-architecture` is recorded ABSENT for pair 2.
//
//   (d) NOBODY HAS PUT Dsup INTO AN HMGN1-NULL CELL. Birger et al. 2003 and 2005 built exactly the assay
//       this pair would need - Hmgn1-/- fibroblasts, hypersensitive to UV and to ionizing radiation,
//       reverted by wild-type HMGN1 and not by HMGN mutants that cannot bind chromatin - and the Dsup
//       experiments were all additions to cells carrying their own full HMGN complement. The rescue slot
//       is absent for a reason that names the experiment, which is the most useful thing in pair 2.
//
// ============================== HOW THE EVIDENCE WAS DECIDED ==============================
// The rule applied to every slot: an experiment that cannot be pointed at is ABSENT, and a present slot
// carries what was measured rather than what it suggests. Two slots in pair 1 are present on evidence
// that is real but asymmetric, and the asymmetry is written into the slot: the loss-of-function
// comparison puts an engineered mouse knockout against a 20-million-year-old natural lesion, and the
// rescue puts a heterologous promoter in the wrong fat depot against a gene that natively works in a
// tissue the host does not have.
import { scoreAnalogy, classify, refuse, HOMOLOGY_TYPES, AMBIGUOUS_HOMOLOGY_TYPES, EVIDENCE_IDS } from '../../analogy.mjs';

// =====================================================================================================
// SOURCES
// =====================================================================================================
// Each entry says what it is and, in `verified_how`, what was fetched in this session and what came back.
// Nothing here is cited from memory. Where a lookup was flaky, that is recorded too.

export const SOURCES = Object.freeze({
  // ---- pair 1: the literature ----
  zheng_2017: Object.freeze({
    cite: 'Zheng, Q. et al. (2017) Reconstitution of UCP1 using CRISPR/Cas9 in the white adipose tissue of pigs decreases fat deposition and improves thermogenic capacity. PNAS 114(45):E9474-E9482.',
    pmid: '29078316',
    doi: '10.1073/pnas.1707853114',
    pmcid: 'PMC5692550',
    what_it_reports: 'A CRISPR/Cas9, homologous-recombination-independent knock-in of a mouse adiponectin-promoter-driven UCP1 cassette into the porcine endogenous UCP1 locus. Knock-in pigs maintained body temperature better during acute cold exposure; fat deposition fell by 4.89% (P<0.01) and carcass lean percentage rose (P<0.05); the loss of fat was attributed to elevated lipolysis. Physical activity levels and total daily energy expenditure were NOT altered.',
    verified_how: 'PubMed search, then get_article_metadata on PMID 29078316 and get_full_text_article on PMC5692550: title, abstract, journal, volume 114, issue 45, pages E9474-E9482, DOI and the 2017-10-23 date read back. The PMC XML strips italicised gene symbols, so the PMC web record was fetched separately to read the locus and promoter sentences: "mouse adiponectin-UCP1 was efficiently inserted into the porcine endogenous UCP1 locus", a mouse UCP1 cDNA driven by the adiponectin promoter, rectal temperature over 4 h at 4 C in 1-month-old piglets (n=6 per genotype), and the statement that no classical brown adipose tissue was identified in pigs, which is why white fat was targeted.',
  }),
  berg_2006: Object.freeze({
    cite: 'Berg, F., Gustafson, U. & Andersson, L. (2006) The uncoupling protein 1 gene (UCP1) is disrupted in the pig lineage: a genetic explanation for poor thermoregulation in piglets. PLoS Genetics 2(8):e129.',
    pmid: '16933999',
    doi: '10.1371/journal.pgen.0020129',
    what_it_reports: 'The complete genomic sequence of pig UCP1 by long-range PCR and genome walking. Alignment against human UCP1 shows exons 3 to 5 eliminated by a deletion; three further disrupting mutations in the remaining exons; the deletion present in every pig lineage tested; an elevated nonsynonymous substitution rate against the human, cattle and mouse sequences, from which the disruption is dated to about 20 million years ago. Piglets appear to lack brown adipose tissue and rely on shivering.',
    verified_how: 'PubMed get_article_metadata on PMID 16933999: title, full abstract, PLoS Genet volume 2 issue 8 page e129, DOI and the 2006-08-18 date read back. The same exon 3-5 sentence was independently read back out of the NCBI Gene XML for pig GeneID 751863, where it is carried as gene commentary.',
  }),
  enerback_1997: Object.freeze({
    cite: 'Enerback, S. et al. (1997) Mice lacking mitochondrial uncoupling protein are cold-sensitive but not obese. Nature 387(6628):90-94.',
    pmid: '9139827',
    doi: '10.1038/387090a0',
    what_it_reports: 'Targeted inactivation of the mouse UCP1 gene. UCP-deficient mice consume less oxygen after a beta3-adrenergic agonist and are sensitive to cold, so thermoregulation is defective; the deficiency produced neither hyperphagia nor obesity on standard or high-fat diet. The authors propose that the loss may be compensated by UCP2, which is ubiquitously expressed and is induced in the brown fat of the UCP-deficient mice.',
    verified_how: 'PubMed search on Enerback S[Author] AND uncoupling protein AND 1997[pdat] returned exactly one record; get_article_metadata on PMID 9139827 read back title, full abstract, Nature volume 387 issue 6628 pages 90-4, DOI and the May 1997 date. The paralogue-compensation sentence is quoted from that abstract and is the authors\' proposal, not a measurement.',
  }),
  pan_2019: Object.freeze({
    cite: 'Pan, J. et al. (2019) Adipose lipidomics and RNA-Seq analysis revealed the enhanced mitochondrial function in UCP1 knock-in pigs. Biochimica et Biophysica Acta Molecular and Cell Biology of Lipids 1864(10):1375-1383.',
    pmid: '31271850',
    doi: '10.1016/j.bbalip.2019.06.017',
    what_it_reports: 'A follow-up on the same animals, described there as adipocyte-specific UCP1 knock-in pigs. Inguinal subcutaneous white adipose tissue and backfat show distinct lipidomic profiles, with only mild alteration in backfat; inguinal fat shows decreased total triacylglycerol, downregulated fatty-acid-metabolism genes, increased total sphingolipids and sharply increased mitochondrial cardiolipin species, with more large mitochondria and more cristae.',
    verified_how: 'PubMed search, then get_article_metadata on PMID 31271850: title, abstract, journal, volume 1864 issue 10 pages 1375-1383 and DOI read back. Used here for one thing only - that the construct is adipocyte-specific and the effect is depot-dependent, which bears on the rescue being non-native in its expression domain.',
  }),
  // ---- pair 2: the literature ----
  hashimoto_2016: Object.freeze({
    cite: 'Hashimoto, T. et al. (2016) Extremotolerant tardigrade genome and improved radiotolerance of human cultured cells by tardigrade-unique protein. Nature Communications 7:12808.',
    pmid: '27649274',
    doi: '10.1038/ncomms12808',
    what_it_reports: 'The Ramazzottius varieornatus genome, and the original Dsup result: a tardigrade-unique DNA-associating protein expressed in human cultured cells suppresses X-ray-induced DNA damage by about 40% and improves radiotolerance. The MeSH terms on the record include HEK293 Cells.',
    verified_how: 'PubMed get_article_metadata on PMID 27649274: title, full abstract, Nat Commun volume 7 article 12808, DOI, the 2016-09-20 date and the HEK293 MeSH term read back.',
  }),
  chavez_2019: Object.freeze({
    cite: 'Chavez, C., Cruz-Becerra, G., Fei, J., Kassavetis, G.A. & Kadonaga, J.T. (2019) The tardigrade damage suppressor protein binds to nucleosomes and protects DNA from hydroxyl radicals. eLife 8:e47682.',
    pmid: '31571581',
    doi: '10.7554/eLife.47682',
    what_it_reports: 'Dsup is a nucleosome-binding protein that protects chromatin from hydroxyl radicals; a Dsup orthologue from a second tardigrade species does the same; and - the sentence this dossier turns on - "a conserved region in Dsup proteins exhibits sequence similarity to the nucleosome-binding domain of vertebrate HMGN proteins and is functionally important for nucleosome binding and hydroxyl radical protection".',
    verified_how: 'PubMed get_article_metadata on PMID 31571581: title, full abstract, eLife volume 8, DOI and the 2019-10-01 date read back. The HMGN sentence above is quoted from that abstract. The same finding is reflected in the UniProt P0DOW4 feature table, fetched separately.',
  }),
  aguilar_2025: Object.freeze({
    cite: 'Aguilar, R.R. et al. (2025) Multivalent binding of the tardigrade Dsup protein to chromatin promotes yeast survival and longevity upon exposure to oxidative damage. Nature Communications 16(1):8617.',
    pmid: '41022789',
    doi: '10.1038/s41467-025-63652-3',
    what_it_reports: 'Dsup expressed in Saccharomyces cerevisiae reduces oxidative DNA damage and extends lifespan under chronic oxidative genotoxicity. Dsup engages the nucleosomal H2A/H2B acidic patch, the H3/H4 histone tails and DNA, binding across the yeast genome without bias, and effective chromatin binding and genome protection require the Dsup HMGN-like motif and the C-terminal sequences.',
    verified_how: 'PubMed get_article_metadata on PMID 41022789: title, full abstract, Nat Commun volume 16 issue 1 page 8617, DOI and the 2025-09-29 date read back. Used for the HMGN-like motif requirement and for the third host in which Dsup has been expressed.',
  }),
  ricci_2021: Object.freeze({
    cite: 'Ricci, C. et al. (2021) The Tardigrade Damage Suppressor Protein Modulates Transcription Factor and DNA Repair Genes in Human Cells Treated with Hydroxyl Radicals and UV-C. Biology (Basel) 10(10):970.',
    pmid: '34681069',
    doi: '10.3390/biology10100970',
    what_it_reports: 'An independent group confirms that Dsup confers resistance to UV-C and to hydrogen peroxide in human cells relative to untransfected controls, and reports altered transcription-factor activation and altered expression of endogenous apoptosis, survival and DNA-repair genes in Dsup-expressing cells.',
    verified_how: 'PubMed get_article_metadata on PMID 34681069: title, full abstract, Biology volume 10 issue 10, DOI and the 2021-09-27 date read back. Carried here because the Dsup effect replicating outside the originating laboratory is part of the honest picture, and so is the finding that Dsup changes host gene expression rather than acting purely as a shield.',
  }),
  escarcega_2023: Object.freeze({
    cite: 'Escarcega, R.D. et al. (2023) The Tardigrade damage suppressor protein Dsup promotes DNA damage in neurons. Molecular and Cellular Neurosciences 125:103826.',
    pmid: '36858083',
    doi: '10.1016/j.mcn.2023.103826',
    what_it_reports: 'In cortical neurons cultured from rat embryos, codon-optimised Dsup localises to the nucleus and promotes neurotoxicity and neurodegeneration; Dsup expression results in DNA double-strand breaks and, by electron microscopy, promotes chromatin condensation. The authors conclude that neurons are sensitive to Dsup and that Dsup is a doubtful surrogate for DNA protection in neuronal cells.',
    verified_how: 'PubMed get_article_metadata on PMID 36858083: title, full abstract, Mol Cell Neurosci volume 125 page 103826, DOI and the 2023-02-28 date read back. This is the result that makes the Dsup claim cell-type-dependent, and it is recorded in the pair note rather than left for a reader to discover.',
  }),
  birger_2003: Object.freeze({
    cite: 'Birger, Y. et al. (2003) Chromosomal protein HMGN1 enhances the rate of DNA repair in chromatin. The EMBO Journal 22(7):1665-1675.',
    pmid: '12660172',
    doi: '10.1093/emboj/cdg142',
    what_it_reports: 'Hmgn1-/- mouse embryonic fibroblasts are hypersensitive to ultraviolet light and remove photoproducts from chromatin more slowly, while the nucleotide-excision-repair pathway itself remains intact. The hypersensitivity is rescued by plasmids expressing wild-type HMGN1 and NOT by HMGN1 mutants that cannot bind nucleosomes or cannot unfold chromatin.',
    verified_how: 'PubMed search HMGN1[Title] AND (repair OR radiation OR ultraviolet), then get_article_metadata on PMID 12660172: title, full abstract, EMBO J volume 22 issue 7 pages 1665-75, DOI and the April 2003 date read back.',
  }),
  birger_2005: Object.freeze({
    cite: 'Birger, Y. et al. (2005) Increased tumorigenicity and sensitivity to ionizing radiation upon loss of chromosomal protein HMGN1. Cancer Research 65(15):6711-6718.',
    pmid: '16061652',
    doi: '10.1158/0008-5472.CAN-05-0310',
    what_it_reports: 'Hmgn1-/- fibroblasts are hypersensitive to ionizing radiation and show altered G2-M checkpoint activation; irradiated Hmgn1-/- mice have higher mortality and tumour burden than their Hmgn1+/+ littermates. Both the radiation hypersensitivity and the checkpoint defect revert on transfection with wild-type HMGN1 and not with HMGN mutants that do not bind chromatin.',
    verified_how: 'PubMed get_article_metadata on PMID 16061652: title, full abstract, Cancer Res volume 65 issue 15 pages 6711-8, DOI and the August 2005 date read back.',
  }),
  // ---- the database records ----
  ncbi_gene_mouse_ucp1: Object.freeze({
    record: 'NCBI Gene 22227 - Ucp1, Mus musculus, "uncoupling protein 1 (mitochondrial, proton carrier)", aliases Slc25a7 and Ucp, chromosome 8 at 39.65 cM, NC_000074.7:84,016,976-84,025,084, 6 exons.',
    verified_how: 'eutils esearch db=gene for Ucp1[sym] AND "Mus musculus"[orgn] returned the single id 22227; esummary read back the name, description, aliases, chromosome, map location, the genomic range on NC_000074.7 and the exon count of 6. The Alliance-provided summary on the same record states the gene is orthologous to human UCP1.',
  }),
  ncbi_gene_pig_ucp1_coding: Object.freeze({
    record: 'NCBI Gene 106504722 - UCP1, Sus scrofa, type protein-coding, status live, chromosome 8, NC_139390.1:92,968,372-92,970,626, 3 exons, 1 transcript and 1 protein, on assembly GCF_054392235.1 annotation GCF_054392235.1-RS_2026_06. The record carries the annotation note "Low expression observed in reference dataset".',
    verified_how: 'eutils esearch db=gene for UCP1[sym] AND "Sus scrofa"[orgn] returned TWO ids, 751863 and 106504722. esummary and efetch retmode=xml on 106504722 read back Entrezgene_type value="protein-coding", Gene-track_status value="live", the coordinates, the exon count of 3 and the low-expression note. The NCBI Datasets ortholog report for GeneID 22227 read back the same coordinates and the assembly and annotation names.',
  }),
  ncbi_gene_pig_ucp1_pseudo: Object.freeze({
    record: 'NCBI Gene 751863 - UCP1, Sus scrofa, type pseudo, status live, chromosome 8, no genomic placement, flagged "not in current annotation release". Its gene commentary carries the Berg 2006 sentence: "An alignment with human UCP1 revealed that exons 3 to 5 were eliminated by a deletion in the pig sequence."',
    verified_how: 'efetch db=gene retmode=xml on 751863 read back Entrezgene_type value="pseudo", Gene-track_status value="live", the Gene-ref_locus UCP1, the "not in current annotation release" commentary and the quoted Berg sentence. esummary returned no genomicinfo block for this id, which is consistent with it being out of the current annotation.',
  }),
  ncbi_ortholog_ucp1: Object.freeze({
    record: 'NCBI Datasets ortholog set for mouse Ucp1 (GeneID 22227): 583 genes. Exactly ONE Sus scrofa gene is in it - GeneID 106504722, symbol UCP1, type PROTEIN_CODING, chromosome 8, transcript_count 1, protein_count 1 - with gene_groups [{id: 7350, method: "NCBI Ortholog"}], 7350 being human UCP1. The pseudogene record 751863 is not in the set.',
    verified_how: 'GET https://api.ncbi.nlm.nih.gov/datasets/v2alpha/gene/id/22227/orthologs?returned_content=COMPLETE&page_size=200, then the returned JSON was filtered for tax_id 9823: a single pig report came back, printed in full. Mouse Ucp1, human UCP1 (GeneID 7350, chromosome 4) and cattle UCP1 (GeneID 281561, chromosome 17) were read back from the same set. This is what makes the homology type one-to-one rather than one-to-many.',
  }),
  ensembl_mouse_ucp1: Object.freeze({
    record: 'Ensembl ENSMUSG00000031710 - Ucp1, mus_musculus, protein_coding, chromosome 8:84,016,647-84,025,085 on GRCm39, source ensembl_havana, description sourced from MGI:98894.',
    verified_how: 'GET https://rest.ensembl.org/lookup/symbol/mus_musculus/Ucp1 with Accept: application/json returned the gene id, biotype, assembly name GRCm39, coordinates and the MGI accession, all read back.',
  }),
  ensembl_pig_ucp1_absent: Object.freeze({
    record: 'Ensembl REST has no sus_scrofa gene under the symbol UCP1. The successful call returned exactly {"error":"No valid lookup found for symbol UCP1"}.',
    verified_how: 'GET https://rest.ensembl.org/lookup/symbol/sus_scrofa/UCP1 was issued repeatedly. The endpoint is flaky and returned HTTP 500 and HTTP 503 on several attempts, and on the attempt that completed it returned the JSON error above rather than a gene. As a control on the same endpoint and the same species in the same session, GET /lookup/symbol/sus_scrofa/UCP3 returned ENSSSCG00000014834, protein_coding, chromosome 9:8,378,021-8,386,211, Sscrofa11.1, description sourced from VGNC:108624. So sus_scrofa genes with VGNC symbols are retrievable and UCP1 is not one of them. Recorded with the flakiness because a negative from an endpoint that intermittently 500s is weaker than one from an endpoint that does not.',
  }),
  refseq_proteins_ucp1: Object.freeze({
    record: 'Mouse NP_033489.1 "mitochondrial brown fat uncoupling protein 1 [Mus musculus]", 307 aa. Pig XP_084827257.1 "LOW QUALITY PROTEIN: mitochondrial brown fat uncoupling protein 1 [Sus scrofa]", 198 aa - the single protein model of GeneID 106504722, from transcript XM_084971131.',
    verified_how: 'The XM_/XP_ accessions were grepped out of the efetch gene XML for 106504722 and the NM_/NP_ accessions out of the gene XML for 22227. efetch db=protein rettype=fasta on each: the mouse FASTA header and a residue count of 307, and the pig FASTA header carrying the literal prefix "LOW QUALITY PROTEIN:" with a residue count of 198, were both read back from the sequences themselves rather than from a length field.',
  }),
  synteny_ucp1: Object.freeze({
    record: 'Gene order TBC1D9 - UCP1 - ELMOD2 on chromosome 8 in both species, from current RefSeq assemblies. Mouse NC_000074.7: Tbc1d9 83,891,980-83,999,568; Ucp1 84,016,976-84,025,084; Elmod2 84,039,260-84,059,114. Pig NC_139390.1: TBC1D9 92,850,017-92,964,624; UCP1 92,968,372-92,970,626; ELMOD2 92,974,483-93,015,122.',
    verified_how: 'eutils esearch db=gene for (ELMOD2[sym] OR TBC1D9[sym]) AND ("Mus musculus"[orgn] OR "Sus scrofa"[orgn]) returned ids 244548, 71310, 100738980, 100512423 and 100739067; esummary on all of them printed the organism, chromosome, genomic range and accession for each, and the ranges above were read off those records and ordered by coordinate. The pig UCP1 range comes from the GeneID 106504722 record. Id 100739067 is a second pig TBC1D9 record on the previous assembly NC_010450.3 and is not used. This is a synteny check at the expected locus, done on coordinates rather than asserted from a synteny table.',
  }),
  uniprot_mouse_ucp1: Object.freeze({
    record: 'UniProtKB P12242 (UCP1_MOUSE), reviewed, "Mitochondrial brown fat uncoupling protein 1 (UCP 1) (Solute carrier family 25 member 7) (Thermogenin)", gene names Ucp1 / Slc25a7 / Ucp, 307 aa.',
    verified_how: 'GET https://rest.uniprot.org/uniprotkb/search with query gene:Ucp1 AND organism_id:10090 AND reviewed:true, fields accession,id,protein_name,gene_names,length, format tsv: the single row above was read back.',
  }),
  interpro_mouse_ucp1: Object.freeze({
    record: 'InterPro returns 10 entries for P12242, including IPR002067 (family, Mitochondrial carrier protein), IPR018108 (repeat, Mitochondrial carrier protein transmembrane region), Pfam PF00153 (repeat, Mitochondrial carrier protein), PRINTS PR00784 (MTUNCOUPLING), PROSITE profile PS50920 (Solcar repeat) and PANTHER PTHR45618.',
    verified_how: 'GET https://www.ebi.ac.uk/interpro/api/entry/all/protein/uniprot/P12242/ with Accept: application/json returned count 10; each result\'s source_database, accession, type and name were printed and read back. Carried here as the baseline against which the pig truncation and the Dsup blank are read.',
  }),
  uniprot_dsup: Object.freeze({
    record: 'UniProtKB P0DOW4 (DSUP_RAMVA), reviewed, "Damage suppressor protein", gene names Dsup / RvY_17224, Ramazzottius varieornatus (taxId 947166), 445 aa. Features: Disordered 1-145 and 203-445; region 208-445 "Required and sufficient for DNA-binding and co-localization with nuclear DNA"; region 360-445 "Required for nucleosome binding and for the protection of chromatin from hydroxyl radical-mediated DNA damage"; mutagenesis 360-445 (M1) loses nucleosome binding, mutagenesis 363-367 (M2) decreases it. Cross-references: EMBL (LC050827, BDGG01000015), AlphaFoldDB, Proteomes (UP000186922), GO, DisProt (DP04343) - and nothing else.',
    verified_how: 'GET https://rest.uniprot.org/uniprotkb/search for Dsup AND organism_name:"Ramazzottius varieornatus" returned the single reviewed entry P0DOW4 with its length. GET https://rest.uniprot.org/uniprotkb/P0DOW4.json was then parsed: the FUNCTION comment (citing PubMed 27649274 and 31571581), the full feature table and the complete list of cross-reference databases were printed. The absence of Pfam, InterPro, PANTHER, OrthoDB and eggNOG is the printed list being complete, not an inference.',
  }),
  interpro_dsup_none: Object.freeze({
    record: 'InterPro assigns zero entries from any member database to P0DOW4. The protein itself is known to InterPro.',
    verified_how: 'GET https://www.ebi.ac.uk/interpro/api/entry/all/protein/uniprot/P0DOW4/ with Accept: application/json returned HTTP 204 with 0 bytes downloaded, recorded with curl -w "HTTP %{http_code} bytes %{size_download}". The companion call GET https://www.ebi.ac.uk/interpro/api/protein/uniprot/P0DOW4/ returned the protein record with accession P0DOW4, id DSUP_RAMVA and source_organism taxId 947166, so the 204 is "no entries match this protein" and not "no such protein".',
  }),
  uniprot_hmgn1: Object.freeze({
    record: 'UniProtKB P05114 (HMGN1_HUMAN), reviewed, "Non-histone chromosomal protein HMG-14 (High mobility group nucleosome-binding domain-containing protein 1)", gene names HMGN1 / HMG14, 100 aa.',
    verified_how: 'GET https://rest.uniprot.org/uniprotkb/search with query gene:HMGN1 AND organism_id:9606 AND reviewed:true, format tsv: the single row above, including the length of 100, was read back.',
  }),
  interpro_hmgn1: Object.freeze({
    record: 'InterPro returns 6 entries for P05114: IPR000079 (family, High mobility group protein HMGN), Pfam PF01101 (HMG14 and HMG17), PRINTS PR00925, PROSITE PS00355 (conserved site), PANTHER PTHR23087 (High Mobility Group Nucleosome-binding) and SMART SM00527.',
    verified_how: 'GET https://www.ebi.ac.uk/interpro/api/entry/all/protein/uniprot/P05114/ with Accept: application/json returned count 6; each entry\'s source_database, accession, type and name were printed and read back.',
  }),
  ncbi_gene_hmgn1: Object.freeze({
    record: 'NCBI Gene 3150 - HMGN1, Homo sapiens, "high mobility group nucleosome binding domain 1", alias HMG14, chromosome 21. NCBI Gene 15312 - Hmgn1, Mus musculus, "high mobility group nucleosomal binding domain 1", aliases HMG-14 and Hmg14, chromosome 16.',
    verified_how: 'eutils esearch db=gene for HMGN1[sym] AND ("Homo sapiens"[orgn] OR "Mus musculus"[orgn]) returned ids 3150 and 15312; esummary printed the name, organism, chromosome, aliases and description for each, read back above.',
  }),
  ncbi_ortholog_hmgn1_no_invertebrate: Object.freeze({
    record: 'NCBI Datasets ortholog set for human HMGN1 (GeneID 3150): 535 genes across 535 distinct taxa, with symbols drawn only from HMGN1, Hmgn1, hmgn1 and two LOC identifiers. The set contains no gene from Ramazzottius varieornatus, Hypsibius, Caenorhabditis, Drosophila, Apis, Anopheles, Tribolium, Bombyx or Saccharomyces - and also none from Danio rerio, while it does contain one from Xenopus.',
    verified_how: 'GET https://api.ncbi.nlm.nih.gov/datasets/v2alpha/gene/id/3150/orthologs?page_size=1000; the returned reports were counted (535), the distinct taxon names counted (535) and the distinct symbols printed, then each genus above was probed by substring against the taxon names and the hit count printed. Every probe listed as absent returned 0. The Danio rerio zero is reported because it is the reason this negative is not treated as exhaustive: a set that omits a gene where one is expected is not a census of the genomes.',
  }),
  ncbi_gene_dsup_absent: Object.freeze({
    record: 'No gene in NCBI Gene carries the locus symbol Dsup. Ramazzottius varieornatus has 37 records in NCBI Gene in total.',
    verified_how: 'eutils esearch db=gene for Dsup[sym] returned "count":"0" with an empty idlist. eutils esearch db=gene for "Ramazzottius varieornatus"[orgn] returned "count":"37". Both counts were read back from the JSON. This is why the orthology search for pair 2 is run through UniProtKB and InterPro rather than through a gene-centric resource: the donor gene is barely represented in one.',
  }),
  orthodb_attempted: Object.freeze({
    record: 'OrthoDB was queried and did not yield a usable membership statement for either side, so it is NOT counted in databases_searched for pair 2.',
    verified_how: 'GET https://data.orthodb.org/current/search?query=Dsup and the same with query=P0DOW4 both returned the single group 186647at2759 named "carboxylase", which is a fuzzy text match and not a hit on this protein. A search for HMGN1 returned 14 groups at the Metazoa level, the first being 2297565at33208 "high mobility group nucleosome binding domain 1", but GET https://data.orthodb.org/current/group?id=2297565at33208 returned no member-gene list that could be parsed for species membership. Recorded as attempted-and-inconclusive rather than as a negative, because a query shape that does not work is not evidence about the genomes.',
  }),
  method_note: Object.freeze({
    record: 'None of the biology in this file is this project\'s result. What is this file\'s own is the separation of what each record states from what each experiment measured, the four absences enumerated in the header, and the decision to let pair 2 assemble to zero present evidence kinds rather than to a flattering one.',
    verified_how: 'Not a citation. Stated so that a reader does not take the structure of the dossier for a finding.',
  }),
});

// =====================================================================================================
// THE PAIRS
// =====================================================================================================

export const PAIRS = Object.freeze([
  Object.freeze({
    id: 'ucp1-mouse-pig-knockin',
    a: { species: 'Mus musculus', name: 'Ucp1' },
    b: { species: 'Sus scrofa', name: 'UCP1 (disrupted locus)' },
    claim: 'functional-equivalence',
    note:
      'The pair where the experiment has already been done. Pigs carry a UCP1 locus with exons 3 to 5 removed by a deletion dated to about 20 million years ago, plus three further disrupting mutations in what remains, and piglets appear to lack brown adipose tissue and rely on shivering (Berg 2006). Zheng et al. 2017 put a mouse UCP1 cassette back in, at the porcine UCP1 locus, and the knock-in pigs held body temperature better through 4 h at 4 C and deposited 4.89% less fat. That is cross-species complementation of a natural loss, in the host, scored on the phenotype the loss is named for - and it is still not a clean substitution, for three reasons that are in the paper rather than in this commentary. The cassette is driven by an adiponectin promoter, so the protein is made in white adipose tissue and not in the brown depot it natively works in, which the host does not have. Physical activity and total daily energy expenditure were unchanged, so the whole-animal energetics the gene is supposed to govern did not move. And the fat effect is depot-dependent, mild in backfat and strong in inguinal fat (Pan 2019). ' +
      'The identity of the thing being rescued is also less settled than a one-line mapping suggests. NCBI Gene holds two live Sus scrofa records under the symbol UCP1 - one typed pseudo and out of the current annotation, one typed protein-coding and in it - and Ensembl REST has neither, returning "No valid lookup found for symbol UCP1" for a species whose UCP3 it returns normally. The orthology edge points at the protein-coding record, whose only protein model is 198 aa and carries the literal flag LOW QUALITY PROTEIN against a 307 aa mouse protein. So the automated annotation nominates a protein-coding orthologue for a locus the primary literature calls disrupted, and the disruption survives in the resources only as a flag, an exon count and a sentence quoted into a retired record.',
    developmental_context: {
      difference_stated: true,
      a: 'Mus musculus: Ucp1 is expressed in brown adipocytes, natively in interscapular brown adipose tissue, under its own regulation. The mouse loss-of-function comparison is an engineered germline knockout scored in the adult, and its authors report that UCP2 is induced in the brown fat of the knockout and propose it as a compensating paralogue (Enerback 1997) - a context difference that is also a compensation hazard of exactly the kind analogy.mjs flags.',
      b: 'Sus scrofa: there is no classical brown adipose tissue to express the gene in, which is why Zheng 2017 targeted white fat and used an adipose-specific adiponectin promoter rather than the native one; so the "same" gene acts in a different depot, in a different cell type, under a different promoter, in an animal whose thermogenic strategy has had 20 million years to be shivering instead. The pig side of the loss-of-function comparison is a natural lesion of that age with whatever compensatory physiology followed it, scored in neonates as cold susceptibility and mortality, and not an engineered knockout scored in an assay matched to the mouse one.',
      why_it_matters: 'The two losses are a knockout and a fossil, and the two expression contexts are a brown depot and a white one. Both differences are stated here so that the rescue is read as what it is: the donor gene doing the donor\'s job in a place the host improvised for it.',
    },
    databases_searched: ['NCBI Gene', 'NCBI Datasets ortholog sets', 'Ensembl REST', 'UniProtKB', 'InterPro'],
    analogue_search: {
      performed: true,
      what_was_asked: 'What, if anything, performs non-shivering thermogenesis in a pig without UCP1 - i.e. the function-first question, not the orthology lookup.',
      what_came_back: 'Berg 2006 states that piglets appear to lack brown adipose tissue and rely on shivering as the main mechanism for thermoregulation, and Zheng 2017 states that no classical brown adipose tissue was identified in pigs. So the literature\'s answer is that the function is not performed by another route, and the host compensates behaviourally and by shivering rather than by a substitute protein. That is a function-first answer rather than an absence of one.',
    },
    evidence: {
      'rescue': {
        present: true,
        direction: 'donor into host: a mouse UCP1 cassette into pig; the reverse was not attempted',
        what_was_introduced: 'a mouse UCP1 cDNA driven by the adipose-tissue-specific adiponectin promoter, inserted by a CRISPR/Cas9, homologous-recombination-independent method',
        into_what: 'the porcine endogenous UCP1 locus',
        assay: 'rectal temperature through 4 h at 4 C in 1-month-old piglets, n=6 per genotype, repeated at 6 months; plus fat deposition and carcass lean percentage',
        result: 'knock-in pigs maintained body temperature better during acute cold exposure; fat deposition fell by 4.89% (P<0.01) and carcass lean percentage rose (P<0.05), attributed to elevated lipolysis',
        what_was_NOT_rescued: 'physical activity levels and total daily energy expenditure were unchanged, so the whole-animal energetic phenotype did not move; no brown adipose tissue was created, and the paper states that no classical BAT exists in pigs; the expression is ectopic, in white adipose tissue under a foreign promoter, not at native dose from native regulation; and the effect on fat is depot-dependent, only mild in backfat (Pan 2019)',
        what_this_does_not_establish: 'that the pig locus could do the job - it cannot, and that is the premise of the experiment. A donor gene rescuing a host loss says the donor protein works in the host context; it says nothing about the host allele, and nothing about the reverse direction, which was not tested.',
        source: 'zheng_2017, pan_2019',
      },
      'sequence-orthology': {
        present: true,
        homology_type: 'one-to-one',
        homology_type_basis: 'NCBI\'s ortholog set for mouse Ucp1 (GeneID 22227, 583 genes) contains exactly one Sus scrofa gene, GeneID 106504722, in gene group 7350 by method "NCBI Ortholog". One gene on each side, so the relationship is one-to-one and not one of the ambiguous types; the UCP2 and UCP3 paralogues sit in their own groups and are not in this set.',
        identity: null,
        identity_not_stated_why: 'A pairwise identity would be computed against XP_084827257.1, the pig locus\'s only protein model, which is 198 aa to the mouse protein\'s 307 aa and carries the flag LOW QUALITY PROTEIN. Any number from that alignment would be a measurement of an automated model of a disrupted locus, and quoting it as the identity between two proteins would misdescribe what was aligned. So no identity is entered.',
        the_complication: 'The same symbol in the same species also names GeneID 751863, typed pseudo and flagged "not in current annotation release", whose commentary carries the exon 3-5 deletion; and Ensembl REST returns no sus_scrofa gene under the symbol at all. The orthology relationship is one-to-one; which record the single pig side denotes is resource-dependent.',
        source: 'ncbi_ortholog_ucp1, ncbi_gene_mouse_ucp1, ncbi_gene_pig_ucp1_coding, ncbi_gene_pig_ucp1_pseudo, ensembl_pig_ucp1_absent, refseq_proteins_ucp1',
      },
      'synteny': {
        present: true,
        what: 'the gene order TBC1D9 - UCP1 - ELMOD2 holds on chromosome 8 in both species, with UCP1 immediately between its two neighbours in each: mouse NC_000074.7 83.89-84.06 Mb, pig NC_139390.1 92.85-93.02 Mb',
        what_it_establishes_here: 'that the pig locus the cassette was knocked into is the locus corresponding to mouse Ucp1, independently of any annotation of what that locus encodes. This is the check that makes the one-to-one call about a position in a genome rather than about a protein model.',
        what_it_does_not_establish: 'nothing whatsoever about function, in either species. The neighbourhood is intact around a gene that does not work.',
        source: 'synteny_ucp1',
      },
      'lof-phenotype': {
        present: true,
        what: 'loss on each side perturbs cold tolerance. Mouse: targeted inactivation gives animals that consume less oxygen after a beta3-adrenergic agonist and are sensitive to cold, with defective thermoregulation (Enerback 1997). Pig: the natural disruption is offered as the genetic explanation for poor thermoregulation in piglets, cold susceptibility and neonatal mortality (Berg 2006; Zheng 2017).',
        caveat_the_two_losses_are_not_the_same_kind_of_object: 'One is a germline knockout scored in a laboratory assay; the other is a 20-million-year-old lesion scored as farm mortality, in an animal that has had that long to arrange its thermal biology around the absence. They are not the same experiment and the comparison is qualitative.',
        caveat_the_phenotypes_also_diverge: 'The mouse knockout is cold-sensitive but NOT obese on either a standard or a high-fat diet, while the pig side of the story is explicitly about fat accumulation. On the adiposity half of the phenotype the two sides disagree, and the mouse paper\'s own explanation is that UCP2 is induced in the knockout\'s brown fat and may compensate - a proposal about an absence, not a measurement of one.',
        what_it_does_not_establish: 'that either gene could do the other\'s job. This kind shows each is required for something comparable in its own species; sufficiency is the rescue slot and is answered there.',
        source: 'enerback_1997, berg_2006, zheng_2017',
      },
      'domain-architecture': {
        present: false,
        why: 'No comparison is available, because one side has no intact architecture to compare. InterPro assigns mouse UCP1 (P12242) ten entries, including the Pfam PF00153 mitochondrial-carrier repeat and the IPR018108 transmembrane repeat, i.e. the three-repeat carrier fold. The pig locus\'s only protein model, XP_084827257.1, is 198 aa against 307 and is flagged LOW QUALITY PROTEIN, and the deletion that defines the locus removes exons 3 to 5. Entering a domain match here would be comparing the mouse protein against an automated model of a broken gene and calling the result shared architecture.',
      },
      'expression-domain': {
        present: false,
        why: 'There is no corresponding tissue to compare. Mouse Ucp1 is expressed in brown adipose tissue; pigs have no classical brown adipose tissue (Berg 2006; Zheng 2017), so the native domain on the b side does not exist. What the resources do offer is not a substitute: the pig protein-coding record carries only the annotation note "Low expression observed in reference dataset", which is a statement about an annotation pipeline\'s expression support, not a tissue-matched measurement. And the knock-in\'s own expression is deliberately not the native domain - adiponectin promoter, white adipose tissue - so the rescue cannot be read back as evidence of an expression correspondence.',
      },
      'positional-correspondence': {
        present: false,
        why: 'Not applicable: this is a gene pair, not a structure pair. The genomic neighbourhood is in the synteny slot, which is a different claim.',
      },
    },
  }),
  Object.freeze({
    id: 'dsup-hmgn1-chromatin-shield',
    a: { species: 'Ramazzottius varieornatus', name: 'Dsup (damage suppressor protein, UniProt P0DOW4)' },
    b: { species: 'Homo sapiens', name: 'HMGN1 (NCBI Gene 3150, UniProt P05114)' },
    claim: 'convergent-analogy',
    note:
      'A foreign protein that works in a host cell, with no orthologue in the host and no experiment that compares it to anything. Hashimoto 2016 reported that Dsup expressed in human cultured cells suppresses X-ray-induced DNA damage by about 40%; Ricci 2021 reproduced resistance to UV-C and hydrogen peroxide in human cells in another laboratory; Aguilar 2025 showed the same protein reducing oxidative DNA damage and extending lifespan in Saccharomyces cerevisiae. So the function travels. ' +
      'A vertebrate counterpart can be nominated, and this dossier nominates the one the literature nominates: Chavez 2019 reports that "a conserved region in Dsup proteins exhibits sequence similarity to the nucleosome-binding domain of vertebrate HMGN proteins and is functionally important for nucleosome binding and hydroxyl radical protection", and Aguilar 2025 finds that the HMGN-like motif is required for chromatin binding and genome protection. HMGN1 is also independently a radioprotective chromatin protein in its own right: Hmgn1-/- fibroblasts are hypersensitive to ultraviolet light (Birger 2003) and to ionizing radiation (Birger 2005), and in both papers the hypersensitivity reverts with wild-type HMGN1 and not with HMGN mutants that cannot bind chromatin. The two proteins therefore do look like functional counterparts. ' +
      'And yet every one of the seven evidence kinds comes out absent, for reasons that are specific rather than for want of looking. There is no orthology: InterPro assigns P0DOW4 zero entries from any member database, UniProtKB\'s cross-reference list for it contains no family resource at all, NCBI Gene has no gene under the symbol Dsup, and NCBI\'s 535-gene ortholog set for HMGN1 contains no tardigrade, nematode, insect or yeast gene. There is no shared architecture: 445 largely disordered residues with one C-terminal motif, against a 100-residue protein that is essentially the domain, and no database that calls them the same family. And there is no functional comparison at all, because the decisive experiment has not been run: Dsup was ADDED to cells that already carried their full HMGN complement, which is a gain of function, not complementation of an absence. ' +
      'Two further qualifications belong on the record rather than in a footnote. Ricci 2021 found that Dsup alters host transcription-factor activation and the expression of endogenous apoptosis, survival and DNA-repair genes, so the mechanism may not be only physical shielding. And Escarcega 2023 found that in cortical neurons cultured from rat embryos, Dsup promotes neurotoxicity and DNA double-strand breaks and condenses chromatin, concluding that Dsup is a doubtful surrogate for DNA protection in neuronal cells. The protective claim is therefore cell-type-dependent, and the cell type in which it fails is one a design programme would care about.',
    developmental_context: {
      difference_stated: true,
      a: 'Ramazzottius varieornatus: Dsup is a nuclear, chromatin-associating protein of a microscopic animal whose tolerance phenotype is expressed in the desiccated state, and whose tolerance-related genes are reported as constitutively expressed rather than induced. No tardigrade tissue, stage or cell-type resolution is held here, and no loss of Dsup in a tardigrade has been reported.',
      b: 'Homo sapiens: HMGN1 is a ubiquitous nucleosome-binding protein of a somatic cell in a tissue, acting in a nucleus that already contains the whole HMGN family and the whole repair apparatus. Its loss-of-function evidence is in the mouse orthologue Hmgn1, in embryonic fibroblasts and in adult animals, which is a third context again.',
      why_it_matters: 'Dsup has only ever been scored as a construct in a foreign nucleus - human cells, yeast, rat neurons - and HMGN1 has only ever been scored at home. There is no shared context in which both have been measured, so there is no stage, tissue or cell type at which the two could be said to be doing the same job. The strongest claim available is that each protects chromatin in its own setting, and the settings do not meet.',
    },
    databases_searched: ['UniProtKB', 'InterPro', 'NCBI Gene', 'NCBI Datasets ortholog sets'],
    analogue_search: {
      performed: false,
      why: 'No function-first search has been run. The question a function-first search asks is: which vertebrate protein provides hydroxyl-radical shielding of chromatin of the kind Dsup provides - approached by assay, by phenotype or by expression, without going through sequence. HMGN1 was not reached that way. It was reached from Dsup\'s own sequence, through the HMGN-like motif Chavez 2019 identified, which is a sequence-first route running in the opposite direction; and no vertebrate protein has been shown to do what Dsup does. The candidate on side b is therefore a nomination from ancestry-shaped evidence, entered honestly as such, and the search that would test it is unrun.',
      what_would_be_run: 'A screen for host chromatin proteins whose loss sensitises cells to hydroxyl-radical-mediated DNA damage, scored in the same assay Dsup was scored in, with the HMGN family members included but not presupposed.',
    },
    evidence: {
      'rescue': {
        present: false,
        why: 'No complementation experiment exists in either direction, and the distinction matters more here than anywhere else in this file. Every Dsup experiment - human cells (Hashimoto 2016; Ricci 2021), yeast (Aguilar 2025), rat neurons (Escarcega 2023) - is an ADDITION of a foreign protein to a cell carrying its own full complement of chromatin proteins. A gain of function in a wild-type background is not complementation of an absence, and it cannot show that Dsup does HMGN1\'s job, because HMGN1 was present and doing it throughout. The reverse experiment, HMGN1 into a Dsup-less tardigrade, has no reported route: no loss of Dsup in any tardigrade has been reported.',
        the_experiment_that_would_fill_this_slot: 'Express Dsup in the Hmgn1-/- mouse embryonic fibroblasts of Birger 2003 and 2005 and ask whether the UV and ionizing-radiation hypersensitivity reverts. Those authors already built the assay and already used it as a rescue assay, reverting the phenotype with wild-type HMGN1 and failing to revert it with HMGN mutants that cannot bind chromatin, so the positive and negative controls exist. Until that is done, the pair has no direct functional test, and this is the single most informative absence in the dossier.',
      },
      'lof-phenotype': {
        present: false,
        why: 'One-sided, so the kind is not satisfied. The b side has a real loss-of-function phenotype, but in the mouse orthologue rather than in human HMGN1: Hmgn1-/- mouse embryonic fibroblasts are hypersensitive to ultraviolet light with slower removal of photoproducts from chromatin and an intact nucleotide-excision-repair pathway (Birger 2003), and Hmgn1-/- fibroblasts are hypersensitive to ionizing radiation with altered G2-M checkpoint activation, while irradiated Hmgn1-/- mice carry higher mortality and tumour burden (Birger 2005). The a side has nothing: no Dsup loss-of-function in any tardigrade is reported, and NCBI Gene holds only 37 records for Ramazzottius varieornatus in total. A comparison of loss phenotypes needs a loss on each side; there is one.',
        what_exists_instead_on_the_a_side: 'Within-protein deletions assayed in a foreign host: UniProt records mutagenesis 360-445 (M1) as losing nucleosome binding and reducing chromatin protection, and 363-367 (M2) as decreasing both. Those are structure-function mappings of Dsup in a human-cell or in vitro assay, not a loss of the gene in the organism whose phenotype is being explained, and they are not entered here as a loss-of-function phenotype.',
      },
      'sequence-orthology': {
        present: false,
        homology_type: 'none',
        why: 'Four resources, no orthology edge, and the negative is reported as a statement about ancestry only. (1) InterPro returns HTTP 204 with zero entries for P0DOW4 from any member database, while returning six for HMGN1 (P05114) including Pfam PF01101 and PANTHER PTHR23087 - so Dsup is in no family that HMGN1 is in, and in no family at all. (2) UniProtKB\'s complete cross-reference list for P0DOW4 is EMBL, AlphaFoldDB, Proteomes, GO and DisProt: no Pfam, no InterPro, no PANTHER, no OrthoDB, no eggNOG. (3) NCBI Gene has no gene under the symbol Dsup. (4) NCBI\'s 535-gene ortholog set for human HMGN1 contains no gene from Ramazzottius, Hypsibius, Caenorhabditis, Drosophila, Apis, Anopheles, Tribolium, Bombyx or Saccharomyces. The Chavez 2019 HMGN-like region is a local sequence similarity reported in a paper and confirmed functionally by mutagenesis; it is not an orthology assignment in any resource, and it is not entered as one.',
        how_strong_is_this_negative: 'Weaker than it looks, in a way worth stating. The same NCBI ortholog set also contains no Danio rerio gene, which it ought to, so the set is not a census of the genomes. The negative is therefore about four resources\' graphs and about a short motif found by hand, and even a perfect orthology negative would be a statement about ancestry while the claim at issue is about function.',
      },
      'synteny': {
        present: false,
        why: 'Not available and not meaningful. A synteny check needs two assemblies with comparable annotation at corresponding positions; there is no gene record for Dsup to locate, Ramazzottius varieornatus has 37 records in NCBI Gene in total, and at this phylogenetic distance a conserved neighbourhood would not be expected even if both loci were annotated. Nothing is lost by its absence: synteny is evidence about ancestry, and the pair\'s claim is about function.',
      },
      'expression-domain': {
        present: false,
        why: 'No tissue, stage or cell-type correspondence exists between a tardigrade and a human against which to compare. Both proteins are nuclear and chromatin-associated - Dsup\'s GO annotations are nucleus and DNA binding, and it binds nucleosomes with higher affinity than free DNA (Chavez 2019) - but that is subcellular co-localisation at the nucleosome, which is a different claim from the one this kind makes. No tissue-resolved expression comparison is held here, no tardigrade expression atlas is held here, and the only settings in which Dsup\'s localisation has been observed are foreign nuclei into which it was transfected.',
      },
      'domain-architecture': {
        present: false,
        why: 'The two proteins do not carry the same modules in the same order, and no domain database says otherwise. Dsup is 445 aa with disordered regions spanning 1-145 and 203-445 and zero InterPro entries; HMGN1 is 100 aa and is essentially one HMGN nucleosome-binding domain, with six InterPro entries naming it as such. What is shared is one local motif at Dsup\'s C-terminus: Chavez 2019 reports the sequence similarity to the HMGN nucleosome-binding domain and shows it is functionally important, Aguilar 2025 finds the HMGN-like motif required for chromatin binding and genome protection, and UniProt records region 360-445 as required for nucleosome binding with mutagenesis M1 and M2 confirming it. One shared motif inside a mostly disordered protein, found by alignment in a paper and absent from every domain database, is not a shared architecture, and entering it as one would be the inflation this slot exists to prevent. The finding is kept in the pair note where it can be read in full.',
      },
      'positional-correspondence': {
        present: false,
        why: 'Not applicable: two proteins, no body plan or organ in which either occupies a position. Nucleosome binding is biochemistry, not topology.',
      },
    },
  }),
]);

// =====================================================================================================
// SCORED - computed at import time, so the band is recorded rather than asserted by hand
// =====================================================================================================
//
// scoreAnalogy is called on each pair's own a, b and evidence. Nothing below writes a band, a label or a
// class by hand; everything is read out of the module's return value. If the module's intervals or
// weightings change, these change with them, which is the point.

export const SCORED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, scoreAnalogy(p.a, p.b, p.evidence)]),
));

export const CLASSIFIED = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, classify(p)]),
));

export const REFUSALS = Object.freeze(Object.fromEntries(
  PAIRS.map(p => [p.id, refuse(p)]),
));

/** Every `source` token used in an evidence slot, so a test can check each one resolves in SOURCES. */
export const SOURCE_TOKENS_USED = Object.freeze([...new Set(
  PAIRS.flatMap(p => EVIDENCE_IDS
    .map(k => p.evidence[k]?.source)
    .filter(s => typeof s === 'string')
    .flatMap(s => s.split(',').map(t => t.trim()))
    .filter(Boolean)),
)]);

/** What this file claims about itself, in words, for a reader who reads only one export. */
export const WHAT_THESE_TWO_SHOW = Object.freeze({
  pair_1:
  'The top rung of analogy.mjs\'s ladder is reachable by a real experiment, and reaching it changes less ' +
  'than the label suggests. The rescue is genuine - donor gene, host animal, the phenotype the loss is ' +
  'named for - and it was delivered through a foreign promoter into a depot the host improvised, left ' +
  'whole-animal energy expenditure unmoved, and restored no brown adipose tissue because the host has ' +
  'none. "Functional equivalent" is the class; "the donor\'s protein works where we put it" is the result.',
  pair_2:
  'A function that transfers into three foreign hosts, a counterpart that can be named, and zero evidence ' +
  'kinds that the pair satisfies. The module returns a refusal rather than a low score, which is correct: ' +
  'the gap is not that the evidence is weak but that the comparison has never been made. The dossier\'s ' +
  'deliverable is the experiment that would make it - Dsup into Hmgn1-null fibroblasts, in an assay whose ' +
  'positive and negative controls were published twenty years ago.',
  the_shared_lesson:
  'In both pairs the resources and the papers disagree about what the object on one side even is: a ' +
  'pseudogene or a protein-coding gene or no gene, a family member or a protein in no family at all. The ' +
  'mapping question cannot be answered before that is settled, and an orthology table answers it silently.',
});

// =====================================================================================================
const RUN_DIRECTLY = /(^|[\\/])ucp1-thermogenesis\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
  console.log('\nanalogues/combos/pairs/ucp1-thermogenesis.mjs\n');
  for (const p of PAIRS) {
    const s = SCORED[p.id], c = CLASSIFIED[p.id], r = REFUSALS[p.id];
    console.log(`  ${p.id}`);
    console.log(`    ${p.a.species}:${p.a.name}  vs  ${p.b.species}:${p.b.name}`);
    console.log(`    class              ${c.class}   (functional_equivalent ${c.functional_equivalent})`);
    console.log(`    homology_type      ${s.homology_type}`);
    console.log(`    present kinds      ${s.present_kinds.length ? s.present_kinds.join(', ') : '(none)'}`);
    console.log(`    strongest          ${s.strongest?.kind ?? '(none)'}${s.directly_tested ? '  [direct functional test]' : ''}`);
    console.log(`    band               ${s.confidence.lo}-${s.confidence.hi}  ${s.confidence.label}  [span ${s.confidence.label_span.join('/')}]`);
    console.log(`    alt weighting      ${s.confidence.under_alternative_weighting.lo}-${s.confidence.under_alternative_weighting.hi}  ${s.confidence.under_alternative_weighting.label}  (label robust: ${s.confidence.label_is_robust_to_weighting})`);
    console.log(`    gaps               ${s.gaps.length}`);
    console.log(`    refusals           ${r.refusals.length ? r.refusals.map(x => x.id).join(', ') : '(none)'}`);
    console.log(`    headline           ${s.headline}`);
    console.log('');
  }
  console.log(`  sources: ${Object.keys(SOURCES).length}; source tokens used in evidence: ${SOURCE_TOKENS_USED.length}`);
  console.log(`  ambiguous homology types in this file: ${PAIRS.filter(p => AMBIGUOUS_HOMOLOGY_TYPES.includes(p.evidence['sequence-orthology']?.homology_type)).length}`);
  console.log(`  homology types declared: ${PAIRS.map(p => p.evidence['sequence-orthology']?.homology_type).join(', ')} (all in HOMOLOGY_TYPES: ${PAIRS.every(p => HOMOLOGY_TYPES.includes(p.evidence['sequence-orthology']?.homology_type))})`);
  console.log(`\n  ${WHAT_THESE_TWO_SHOW.the_shared_lesson}\n`);
}
