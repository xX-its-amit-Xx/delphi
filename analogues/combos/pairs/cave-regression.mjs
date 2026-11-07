#!/usr/bin/env node
// cave-regression.mjs - TWO ANALOGY-PAIR DOSSIERS FOR EYE REGRESSION IN THE DARK.
//
//   node analogues/combos/pairs/cave-regression.mjs        # print the two verdicts
//   node analogues/combos/pairs/test-cave-regression.mjs [--fail-once]
//
// Schema: exactly the rows of analogues/analogy.mjs PAIRS, modelled on 'afgp-notothenioid-gadid'.
// `SCORED` is scoreAnalogy() run over each pair AT IMPORT TIME, so the band is a RECORD of what the
// module returned rather than a number anyone here typed. No band, label or class is asserted by hand.
//
// ============================== WHY THESE TWO PAIRS ==============================
// Pair 1 is the most controlled convergence available anywhere in this repo's set: ONE species, ONE gene
// pool, TWO independent colonisations of caves, the same outcome. Everything that usually confounds a
// convergence comparison - divergent genomes, non-corresponding cell types, incomparable staging series -
// is held constant by construction. If "did two lineages reach the same phenotype by the same loci?" is
// answerable anywhere, it is answerable here.
//
// Pair 2 is the same question at the greatest distance in the set: a teleost against a subterranean
// rodent. It is included because it FAILS in an instructive way, and the failure is recorded rather than
// decorated. The mammalian side's record is histological, ultrastructural and comparative-genomic; it is
// not experimental. Three of the seven evidence kinds are therefore marked absent with a stated reason,
// and the module bands the pair low. That is the correct output.
//
// ============================== WHAT THE LIVE RECORDS ACTUALLY SAID ==============================
// Three things turned up in the live lookups that were not expected, and all three are recorded below as
// evidence or as absences rather than smoothed into prose:
//
//   1. THE GENES THAT DRIVE CAVEFISH EYE LOSS ARE A DUPLICATE PAIR. The mechanism is expanded midline
//      hedgehog signalling, and the two ligands are shha (NCBI Gene 103046459, alias shh) and shhb
//      (NCBI Gene 103032897, alias twhh). The mammal has ONE Shh. Ensembl Compara, queried live, returns
//      both Astyanax genes for human SHH and types each one `ortholog_one2many`. So pair 2's mapping is
//      one-to-many at two independent resources, which under this module's rules bars it from functional
//      equivalence at any evidence level. See THE_ZEBRAFISH_PROBLEM: the shape is not specific to one
//      model organism, it is specific to having a duplication on one side of a comparison.
//
//   2. AN ORTHOLOGY RESOURCE QUERIED BY GENE SYMBOL RETURNED A CONFIDENT CALL FOR THE WRONG GENE.
//      Human RAX carries `RAX` as an alias of a second, unrelated gene (PRKRA; NCBI Gene 8575 lists RAX
//      among its aliases). Asking Ensembl's REST homology endpoint for `homo_sapiens/RAX` against
//      Astyanax returns TWO human genes: the real retinal homeobox gene (ENSG00000134438, chromosome 18,
//      HGNC:18662) with an EMPTY homology list, and a second human gene with a clean
//      `ortholog_one2one` call to ENSAMXG00000034602 - which resolves to `prkra`, a
//      double-stranded-RNA-dependent kinase activator. A symbol-keyed pipeline asking for "the Astyanax
//      orthologue of RAX" gets handed prkra with the strongest homology type the vocabulary has, while
//      the gene that CRISPR shows is required for eye formation returns nothing. Recorded as
//      SYMBOL_TRAP; it is the single clearest instance of this module's thesis found this session.
//
//   3. THE TWO SIDES OF PAIR 2 ARE NOT DOING THE SAME THING TO THE SAME ORGAN. In the cave populations
//      the lens undergoes massive apoptosis, the retina then degenerates, and the eye sinks into the
//      orbit. In the subterranean rodent the lens vesicle and optic cup start out normal, the lens
//      nucleus later becomes disorganised and vacuolated and the optic fissure never closes - but
//      retinal histogenesis proceeds relatively normally, opsin is present in the photoreceptors, and the
//      subcutaneous eye is retained as a working photoperiod organ. One lineage abolished an eye; the
//      other kept a reduced one and repurposed it. Calling both "eye regression" is two readouts sharing
//      a word, and the developmental_context block says so.
//
// ============================== HOUSE RULES OBSERVED HERE ==============================
// Every citation in SOURCES was retrieved in this session and carries `verified_how` naming what was
// fetched and read back. No DOI, PMID, gene symbol or accession below is from memory. Where an evidence
// kind could not be established FOR THE PAIR AS NAMED, it is present:false with a `why` that states what
// is missing - including the two cases where a near-miss experiment exists and does not count.
//
// `node holdout/check-leaks.mjs analogues` applies to this file as it does to the rest of the folder.

import { scoreAnalogy, HOMOLOGY_TYPES, AMBIGUOUS_HOMOLOGY_TYPES } from '../../analogy.mjs';

// =====================================================================================================
// SOURCES
// =====================================================================================================
// `verified_how` is the whole point of this block. A citation with no statement of what was fetched and
// what came back is a citation this project treats as unverified, whatever it says.

export const SOURCES = Object.freeze({
  yamamoto_2004: Object.freeze({
    kind: 'literature',
    cite: 'Yamamoto, Y., Stock, D.W. & Jeffery, W.R. (2004) Hedgehog signalling controls eye degeneration in blind cavefish. Nature 431:844-847.',
    pmid: '15483612',
    doi: '10.1038/nature02864',
    peer_reviewed: true,
    what_it_establishes: 'shh and twhh expression is expanded along the anterior embryonic midline in cave populations; the expansion hyperactivates downstream genes, causes lens apoptosis, and arrests eye growth; a surface-fish embryonic lens transplanted into a cavefish optic cup restores a complete eye; twhh and/or shh overexpression in surface fish mimics the phenotype.',
    the_exact_phrase_about_populations: 'the abstract states the expansion is seen "in several different cavefish populations" and does NOT name them. That unnamed plurality is why the expression-domain slot in pair 1 is absent rather than present.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 15483612 this session; title, author list, journal, volume/pages and the full abstract read back, including the lens-transplantation sentence and the "several different cavefish populations" phrase quoted above.',
  }),
  alunni_2007: Object.freeze({
    kind: 'literature',
    cite: 'Alunni, A., Menuet, A., Candal, E., Penigault, J.-B., Jeffery, W.R. & Retaux, S. (2007) Developmental mechanisms for retinal degeneration in the blind cavefish Astyanax mexicanus. J Comp Neurol 505:221-233.',
    pmid: '17853442',
    doi: '10.1002/cne.21488',
    peer_reviewed: true,
    what_it_establishes: 'eye development is retarded in cave fish; early retinal proliferation is proportionately similar to surface fish; the retina then degenerates after massive apoptosis in the lens and widespread neuroretinal cell death; signalling, patterning and differentiation of retinal layers proceed almost normally, so the degeneration is not a retinal patterning defect. Consistent with lens apoptosis being the trigger.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 17853442 this session; full abstract read back, including the gene list assayed (Shh, Fgf8, Pax6, Lhx2, Lhx9, Vax1, GAD65) and the conclusion that patterning is not the defect.',
  }),
  bradic_2013: Object.freeze({
    kind: 'literature',
    cite: 'Bradic, M., Teotonio, H. & Borowsky, R.L. (2013) The population genomics of repeated evolution in the blind cavefish Astyanax mexicanus. Mol Biol Evol 30:2383-2400.',
    pmid: '23927992',
    pmc: 'PMC3808867',
    doi: '10.1093/molbev/mst136',
    peer_reviewed: true,
    what_it_establishes: '518 RAD-tag SNPs across seven cave and three surface population groups, the cave populations representing two distinct (old and new) lineages. 31 SNPs differentiated between surface and old-cave only, 2 between surface and new-cave only, and 44 differentiated in BOTH lineages. 25 differentiated SNPs co-map with previously described QTL, one of which contains an fgf8 gene implicated in eye development and lens size. The identity of many QTL-co-mapping SNPs was the same in independently derived cave populations, which the authors attribute to ancestral standing genetic variation.',
    why_it_matters_here: 'it is the independent, pre-2026 statement that repeatability at the genetic level is substantial - and it attributes that repeatability to SHARED STANDING VARIATION rather than to independent mutation. Parallelism from a common allele pool is a third thing, distinct from both "same mutation twice" and "different routes".',
    verified_how: 'PubMed MCP get_article_metadata on PMID 23927992 this session; full abstract read back including the SNP counts (31 / 2 / 44), the 25 co-mapping SNPs, the fgf8 mention and the standing-variation conclusion.',
  }),
  oquin_2015: Object.freeze({
    kind: 'literature',
    cite: "O'Quin, K.E., Doshi, P., Lyon, A., Hoenemeyer, E., Yoshizawa, M. & Jeffery, W.R. (2015) Complex evolutionary and genetic patterns characterize the loss of scleral ossification in the blind cavefish Astyanax mexicanus. PLoS ONE 10(12):e0142208.",
    pmid: '26649887',
    pmc: 'PMC4674125',
    doi: '10.1371/journal.pone.0142208',
    peer_reviewed: true,
    what_it_establishes: 'scleral ossicles generally fail to form in cave populations; ancestral character state reconstruction puts the loss at convergent on at least three occasions; F1 hybrid progeny of a cross between TWO DIFFERENT cave populations have wild-type ossified sclera, which the authors read as confirming convergence; a surface x cave F2 cross maps a single QTL for scleral ossicle number to Astyanax linkage group 1; the authors estimate at least three genetic factors set the threshold, factors which "may control the severity and onset of lens degeneration".',
    why_it_is_NOT_entered_as_rescue_in_pair_1: 'the complementation assay is scleral ossicle number, a skeletal consequence downstream of lens degeneration, not eye size or the eye-regression programme itself. Entering it in the rescue slot would be scoring a different phenotype under the pair\'s name. It is named in the rescue slot\'s `why` as the nearest thing that exists.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 26649887 this session; full abstract read back including the cave x cave F1 complementation result, the single linkage-group-1 QTL, the "at least three genetic factors" estimate and the lens-degeneration clause.',
  }),
  warren_2021: Object.freeze({
    kind: 'literature',
    cite: 'Warren, W.C., Boggs, T.E., Borowsky, R., Carlson, B.M., Ferrufino, E., Gross, J.B. et al. (2021) A chromosome-level genome of Astyanax mexicanus surface fish for comparing population-specific genetic differences contributing to trait evolution. Nat Commun 12:1447.',
    pmid: '33664263',
    pmc: 'PMC7933363',
    doi: '10.1038/s41467-021-21733-z',
    peer_reviewed: true,
    what_it_establishes: 'a chromosome-level surface-fish reference; QTL mapping that nominates new eye-loss candidates including dusp26; and CRISPR editing in A. mexicanus confirming that rx3, a gene inside an eye-size QTL, is required for eye formation. Also the first genome-wide evaluation of deletion variability across cave populations.',
    the_one_gene_level_perturbation: 'the rx3 knockout is the only gene-level loss-of-function for eye formation in this species that this session verified. It was done once, in one background, and is not a per-population comparison.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 33664263 this session; full abstract read back including the dusp26 candidate and the rx3 CRISPR confirmation.',
  }),
  richards_2026: Object.freeze({
    kind: 'literature',
    cite: 'Richards, E.J., Moran, R.L., Wiese, J., O\'Gorman, M., Hutton, P., Rastogi, A., North, O.W., Manning, A.E., Roback, E.Y., Kowalko, J.E., Rohner, N., Keene, A.C. & McGaugh, S.E. (2026) Cave evolution on repeat: reuse of the same genomic regions across lineages but not across traits. bioRxiv.',
    pmid: '41676532',
    pmc: 'PMC12889537',
    doi: '10.64898/2026.01.31.703033',
    peer_reviewed: false,
    preprint_warning: 'bioRxiv preprint, NOT peer reviewed. Every number below is from the PMC full text read this session and is reported as the preprint states it, including where the preprint does not agree with itself.',
    what_it_establishes: 'joint QTL mapping across three cave x surface F2 populations sharing ONE female surface grandparent. The cave morph "has independently evolved from at least two different surface lineages"; Lineage 1 is Molino and Lineage 2 is Tinaja and/or Pachon. Eye loss shows the highest genetic repeatability of the traits examined: nine eye-size QTL regions were associated with cave genotypes from BOTH lineages. Sleep QTL regions were 33% shared across lineages, feeding and adiposity less. Selective-sweep scans over 2,433 genes inside QTL regions found only TWO genes under selection in all three wild cave parent populations and not in surface populations - and both of those sit in lineage-unique, non-eye QTL.',
    the_number_does_not_reconcile_in_the_preprint: 'the abstract gives "~43% of QTL shared across lineages" for eye loss. The results text says "Nine of the 16 (43%) eye size QTLs regions were associated with cave genotypes from both Lineage 1 (Molino) and Lineage 2 (Tinaja and/or Pachon)" - and nine of sixteen is 56%, not 43%. The same paragraph separately states "up to 56% of the eye size QTL are regions of the genome that are likely repeatedly involved". An earlier sentence gives "15 distinct QTL regions associated with eye size", not 16; and 15 + 10 + 3 + 1 = 29 against a stated 31 distinct QTL regions. The COUNT (nine regions shared across lineages) is unambiguous in the text; the DENOMINATOR and the percentage are not. This file records the count and declines to pick a percentage.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 41676532, then get_full_text_article on PMC12889537 this session. The results paragraphs were read verbatim from the returned full text: the "Nine of the 16 (43%)" sentence, the "up to 56%" sentence, the "15 distinct QTL regions" sentence, the shared-female-surface-grandparent sentence, and the 2-of-2,433 sweep result were each located and read in the retrieved text.',
  }),
  jeffery_2005: Object.freeze({
    kind: 'literature',
    cite: 'Jeffery, W.R. (2005) Adaptive evolution of eye degeneration in the Mexican blind cavefish. J Hered 96:185-196.',
    pmid: '15653557',
    doi: '10.1093/jhered/esi028',
    peer_reviewed: true,
    what_it_establishes: 'a review stating that the key discovery is expanded hedgehog midline signalling inhibiting eye formation by inducing lens apoptosis, and proposing that eyes were lost BY DEFAULT as a pleiotropic consequence of selection for constructive traits that hedgehog positively regulates. Also that comparisons between different cave populations are among the clues.',
    why_it_matters_here: 'it is the reason the pair-1 claim is about a PROGRAMME and not about a trait under direct selection: on this account eye loss is a side effect, and two populations could share the side effect without sharing the selected target.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 15653557 this session; full abstract read back including the pleiotropy/adaptive-evolution conclusion.',
  }),
  sanyal_1990: Object.freeze({
    kind: 'literature',
    cite: 'Sanyal, S., Jansen, H.G., de Grip, W.J., Nevo, E. & de Jong, W.W. (1990) The eye of the blind mole rat, Spalax ehrenbergi. Rudiment with hidden function? Invest Ophthalmol Vis Sci 31:1398-1404.',
    pmid: '2142147',
    doi: null,
    doi_note: 'the PubMed record returned no DOI for this 1990 article. The PMID is the identifier; no DOI is invented here.',
    peer_reviewed: true,
    what_it_establishes: 'the developmental description of the reduced eye. In early embryos the presumptive eye regions - epithelium, lens vesicle, optic cup - appear initially NORMAL. Later the iris-ciliary body complex arises prematurely from the optic cup margin and grows rapidly and massively, remains attached to the corneal stroma, obliterates the anterior chamber and prevents formation of the corneal endothelium and Descemet\'s membrane. Lens-fibre elongation yields a rudimentary lens nucleus that becomes disorganised, vacuolated and eventually vascularised. The optic fissure fails to close, the eyes remain colobomatous, the optic disc is atrophic. In CONTRAST, retinal histogenesis progresses relatively normally, giving reduced but well-differentiated photoreceptor, neuronal and ganglion cell layers in the adult, and opsin is demonstrable immunohistochemically in the photoreceptors.',
    why_it_matters_here: 'this is the whole of pair 2\'s developmental contrast. The anterior segment is destroyed by overgrowth; the retina is largely spared. In the cave populations the lens dies and the retina follows. Same word, opposite tissue logic.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 2142147 this session; full abstract read back, including the "appear initially normal" clause, the iris-ciliary body overgrowth, the vacuolated lens nucleus, the failure of optic fissure closure and the relatively normal retinal histogenesis with opsin present.',
  }),
  davidgray_1999: Object.freeze({
    kind: 'literature',
    cite: "David-Gray, Z.K., Cooper, H.M., Janssen, J.W., Nevo, E. & Foster, R.G. (1999) Spectral tuning of a circadian photopigment in a subterranean 'blind' mammal (Spalax ehrenbergi). FEBS Lett 461:343-347.",
    pmid: '10567724',
    doi: '10.1016/s0014-5793(99)01455-6',
    peer_reviewed: true,
    what_it_establishes: 'the atrophied subcutaneous eyes express a long-wavelength-sensitive cone opsin that is spectrally tuned to the red light environment of the eye, which the authors argue shows it is a functional photopigment and not a residue of the pre-subterranean visual system. The eye\'s one known function is entrainment of circadian rhythms to environmental light.',
    why_it_matters_here: 'the reduced eye is under positive maintenance for a different job. "Regression" on this side does not mean the organ was abandoned.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 10567724 this session; full abstract read back including the spectral-tuning argument and the single remaining function.',
  }),
  esquiva_2016: Object.freeze({
    kind: 'literature',
    cite: 'Esquiva, G., Avivi, A. & Hannibal, J. (2016) Non-image forming light detection by melanopsin, rhodopsin, and long-middlewave (L/W) cone opsin in the subterranean blind mole rat, Spalax ehrenbergi. Front Neuroanat 10:61.',
    pmid: '27375437',
    pmc: 'PMC4899448',
    doi: '10.3389/fnana.2016.00061',
    peer_reviewed: true,
    what_it_establishes: 'the reduced retina retains a photoreceptor layer, outer and inner nuclear layers, outer and inner plexiform layers and a ganglion cell layer. It contains 890 +/- 62 retinal ganglion cells by RBPMS labelling, of which 87% (752 +/- 40) are melanopsin-positive. Rhodopsin- and long/middle-wave cone-opsin-bearing photoreceptors are present, with ribbon synapses in apposition to melanopsin dendrites.',
    why_it_matters_here: 'it quantifies how much retina survives, and the number is small but the circuitry is intact and wired for non-image light detection. A reduction, not an ablation.',
    verified_how: 'PubMed MCP get_article_metadata on PMID 27375437 this session; full abstract read back including the retinal layer list, the 890 +/- 62 ganglion cell count and the 87% / 752 +/- 40 melanopsin figures.',
  }),
  gene_astyanax_shha: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '103046459',
    symbol: 'shha',
    aliases: ['shh'],
    description: 'sonic hedgehog signaling molecule a',
    organism: 'Astyanax mexicanus',
    chromosome_as_reported: '8',
    verified_how: 'live NCBI E-utilities this session: esearch on db=gene with term `shh[sym] AND Astyanax mexicanus[orgn]` returned exactly one id, 103046459; esummary on that id returned name `shha`, description `sonic hedgehog signaling molecule a`, organism `Astyanax mexicanus`, otheraliases `shh`, chromosome `8`. Read back from the JSON.',
  }),
  gene_astyanax_shhb: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '103032897',
    symbol: 'shhb',
    aliases: ['twhh'],
    description: 'sonic hedgehog signaling molecule b',
    organism: 'Astyanax mexicanus',
    chromosome_as_reported: '4',
    verified_how: 'live NCBI E-utilities this session: esearch on db=gene with term `twhh[sym] AND Astyanax mexicanus[orgn]` returned exactly one id, 103032897; esummary returned name `shhb`, description `sonic hedgehog signaling molecule b`, otheraliases `twhh`, chromosome `4`. So the symbol the 2004 paper uses, twhh, is now an ALIAS and the current symbol is shhb - which is also the fact that makes the duplicate pair visible.',
  }),
  gene_astyanax_rax: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '103038458',
    symbol: 'rax',
    aliases: ['rx3'],
    description: 'retina and anterior neural fold homeobox',
    organism: 'Astyanax mexicanus',
    chromosome_as_reported: '17',
    verified_how: 'live NCBI E-utilities this session: esearch `rx3[sym] AND Astyanax mexicanus[orgn]` returned one id, 103038458; esummary returned name `rax`, otheraliases `rx3`, chromosome `17`. The gene the CRISPR experiment calls rx3 is carried under the symbol rax.',
  }),
  gene_astyanax_rx1_rx2: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accessions: ['103032969', '103040507'],
    symbols: ['rx1', 'rx2'],
    organism: 'Astyanax mexicanus',
    verified_how: 'live NCBI E-utilities this session: esearch for rax/rx1/rx2 symbols in Astyanax mexicanus returned three ids (103040507, 103032969, 103038458); esummary gave rx2 = `retinal homeobox gene 2`, chromosome 4 (id 103040507) and rx1 = `retinal homeobox gene 1`, chromosome 16 (id 103032969). So NCBI holds THREE retinal-homeobox genes in this fish against one in the mammal.',
  }),
  gene_astyanax_dusp26: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '103042694',
    symbol: 'LOC103042694',
    aliases: ['dusp26'],
    description: 'dual specificity phosphatase 26',
    organism: 'Astyanax mexicanus',
    chromosome_as_reported: '20',
    verified_how: 'live NCBI E-utilities this session: esearch `dusp26[sym] AND Astyanax mexicanus[orgn]` returned one id, 103042694; esummary returned the official name as `LOC103042694` with `dusp26` only as an alias. The eye-loss candidate therefore has no approved symbol in this genome, which is worth knowing before writing it into a mapping.',
  }),
  gene_human_shh: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '6469',
    symbol: 'SHH',
    organism: 'Homo sapiens',
    chromosome_as_reported: '7',
    verified_how: 'live NCBI E-utilities esummary this session on id 6469: name `SHH`, description `sonic hedgehog signaling molecule`, chromosome 7, aliases HHG1, HLP3, HPE3, MCOPCB5, SMMCI, ShhNC, TPT, TPTPS. One gene.',
  }),
  gene_human_rax: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '30062',
    symbol: 'RAX',
    organism: 'Homo sapiens',
    chromosome_as_reported: '18',
    verified_how: 'live NCBI E-utilities this session: esearch `RAX[sym] AND Homo sapiens[orgn]` returned TWO ids, 8575 and 30062. esummary showed 30062 = RAX, `retina and anterior neural fold homeobox`, chromosome 18; and 8575 = PRKRA, `protein activator of interferon induced protein kinase EIF2AK2`, chromosome 2, which carries RAX among its aliases. The symbol is ambiguous in the human record itself.',
  }),
  gene_spalax_shh: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '103745341',
    symbol: 'Shh',
    description: 'sonic hedgehog signaling molecule',
    organism: 'Nannospalax galili',
    chromosome_as_reported: 'Un',
    verified_how: 'live NCBI E-utilities this session: esearch `Shh[sym] AND Nannospalax galili[orgn]` returned one id, 103745341; esummary returned name `Shh`, no aliases, chromosome `Un` - i.e. the gene sits on an unplaced scaffold in this assembly, which is why no synteny statement is made for pair 2.',
  }),
  gene_spalax_rax: Object.freeze({
    kind: 'gene-record',
    resource: 'NCBI Gene',
    accession: '103739619',
    symbol: 'Rax',
    description: 'retina and anterior neural fold homeobox',
    organism: 'Nannospalax galili',
    chromosome_as_reported: 'Un',
    verified_how: 'live NCBI E-utilities esummary this session on id 103739619: name `Rax`, organism `Nannospalax galili`, chromosome `Un`. One gene, also unplaced.',
  }),
  taxonomy_spalax: Object.freeze({
    kind: 'taxonomy-record',
    resource: 'NCBI Taxonomy',
    accession: 'taxid 1026970',
    scientific_name: 'Nannospalax galili',
    common_name_as_reported: 'Upper Galilee mountains blind mole rat',
    synonyms_as_reported: ['Nannospalax ehrenbergi galili', 'Spalax galili'],
    lineage_tail_as_reported: 'Rodentia; Myomorpha; Muroidea; Spalacidae; Spalacinae; Nannospalax',
    why_this_matters: 'the ocular and developmental literature cited here is on the Spalax ehrenbergi superspecies; the genome and gene records are on Nannospalax galili. The taxonomy record lists `Nannospalax ehrenbergi galili` as a synonym of N. galili, which is what licenses putting the two bodies of evidence on the same side of a pair. It is a nomenclatural link, not a demonstration that the gene records describe the animals in the 1990 histology.',
    verified_how: 'live NCBI E-utilities this session: esearch db=taxonomy for `Nannospalax galili` returned taxid 1026970; efetch returned ScientificName `Nannospalax galili`, the lineage string quoted above, GenbankCommonName and both synonyms, read back from the XML.',
  }),
  ensembl_shh_orthologues: Object.freeze({
    kind: 'orthology-query',
    resource: 'Ensembl Compara (REST /homology/symbol)',
    query: '/homology/symbol/homo_sapiens/SHH?target_species=astyanax_mexicanus;type=orthologues;format=condensed',
    result_as_returned: 'two homology entries, BOTH typed `ortholog_one2many`: ENSAMXG00000034481 and ENSAMXG00000008367.',
    resolved: 'lookup/id on ENSAMXG00000034481 returned display_name `shha`, description `sonic hedgehog signaling molecule a [Source:NCBI gene (formerly Entrezgene);Acc:103046459]`, seq_region 16, assembly Astyanax_mexicanus-2.0. lookup/id on ENSAMXG00000008367 returned display_name `SHH`, description `sonic hedgehog signaling molecule [Source:HGNC Symbol;Acc:HGNC:10848]`, seq_region 17, same assembly.',
    two_honest_caveats: [
      'the second gene is displayed under the HUMAN symbol SHH with an HGNC accession, not under a fish symbol. A symbol-keyed pipeline looking for "SHH in the fish" would find this record and could treat it as THE orthologue. Nothing read this session established that ENSAMXG00000008367 is the same gene as NCBI 103032897 (shhb/twhh), so that equation is NOT asserted here.',
      'the seq_region numbers (16 and 17) do not match the NCBI chromosome assignments (shha chromosome 8, shhb chromosome 4). Ensembl is on Astyanax_mexicanus-2.0; the NCBI records are on a different assembly. The disagreement is recorded rather than resolved - and it is why no chromosome is used as evidence for anything below.',
    ],
    what_it_does_establish: 'TWO independent resources agree on the COUNT: there are two sonic-hedgehog genes in this fish against one in the mammal, and Ensembl types the relationship one-to-many in its own vocabulary.',
    verified_how: 'live HTTPS GET to rest.ensembl.org this session for the homology query and for each lookup/id; the JSON type strings, gene ids, display names, descriptions, seq_region names and assembly name were read back from the responses.',
  }),
  ensembl_rax_symbol_trap: Object.freeze({
    kind: 'orthology-query',
    resource: 'Ensembl Compara (REST /homology/symbol) and Ensembl /lookup/id',
    query: '/homology/symbol/homo_sapiens/RAX?target_species=astyanax_mexicanus&type=orthologues&format=condensed',
    result_as_returned: 'the response contained TWO human gene ids. ENSG00000134438 returned an EMPTY homologies array. The other id returned a single homology, typed `ortholog_one2one`, method_link_type ENSEMBL_ORTHOLOGUES, taxonomy_level Euteleostomi, to Astyanax gene ENSAMXG00000034602.',
    resolved: 'lookup/id on ENSG00000134438 returned display_name `RAX`, description `retina and anterior neural fold homeobox [Source:HGNC Symbol;Acc:HGNC:18662]`, seq_region 18, assembly GRCh38 - i.e. the real retinal homeobox gene, with NO Astyanax orthologue in this resource. lookup/id on ENSAMXG00000034602 returned display_name `prkra`, description `protein kinase, interferon-inducible double stranded RNA dependent activator [Source:ZFIN;Acc:ZDB-GENE-050309-206]`, seq_region 19, assembly Astyanax_mexicanus-2.0.',
    so: 'querying a live orthology resource by the symbol RAX hands back a confident one-to-one orthologue, and that orthologue is prkra. The gene a CRISPR experiment shows is required for eye formation returns nothing. The failure is silent: the response is well formed and carries the STRONGEST homology type the vocabulary has.',
    one_honest_caveat: 'the second human id was not resolved by lookup/id (the endpoint returned 503/500 on repeated attempts), so the statement that it is PRKRA is an inference from the NCBI record showing RAX as a PRKRA alias, not something read from Ensembl. What WAS read from Ensembl is the empty homology list for ENSG00000134438 and the one-to-one call to prkra.',
    verified_how: 'live HTTPS GET to rest.ensembl.org this session for the homology query and for lookup/id on ENSG00000134438 and ENSAMXG00000034602; the empty homologies array, the ortholog_one2one type string, and both display names and descriptions were read back from the JSON.',
  }),
  uniprot_hedgehog_domains: Object.freeze({
    kind: 'protein-record',
    resource: 'UniProtKB (REST search) and InterPro (Pfam entry API)',
    astyanax_entries_as_returned: [
      'A0A3B1J4Z1, Hedgehog protein, gene SHH, Pfam PF01085;PF01079, length 443',
      'W5KLY9, Hedgehog protein, gene SHH, Pfam PF01085;PF01079, length 419',
      'Q66PH6, Hedgehog protein, gene shh, Pfam PF01085;PF01079, length 429',
    ],
    spalax_entries_as_returned: [
      'A0A8C6S2V1, Hedgehog protein, gene Shh, Pfam PF01085;PF01079, length 452',
      'A0A8C6S2V2, Hedgehog protein, gene Shh, Pfam PF01085;PF01079, length 444',
    ],
    pfam_names_as_returned: 'PF01085 = `Hedgehog amino-terminal signalling domain` (short name HH_signal); PF01079 = `Hint module` (short name Hint).',
    three_honest_caveats: [
      'all five entries are unreviewed (TrEMBL-style accessions); none is a reviewed Swiss-Prot record.',
      'UniProt returned THREE Astyanax hedgehog entries under shh-family symbols where NCBI Gene lists two genes. The count does not match, and which entry corresponds to which gene was not established this session.',
      'identical domain architecture across a ligand family is the expected result and says nothing about which copy carries the midline function. It is entered as evidence of biochemical capability only, which is exactly what the module says this kind establishes.',
    ],
    verified_how: 'live HTTPS GET to rest.uniprot.org this session, querying organism_id 7994 (Astyanax mexicanus) and organism_id 1026970 (Nannospalax galili) for shh/shha/shhb/Shh gene symbols with xref_pfam and length in the returned fields; the accessions, gene names, Pfam strings and lengths above were read back from the TSV. Then live GET to www.ebi.ac.uk/interpro/api/entry/pfam/PF01085 and /PF01079, whose metadata gave the two Pfam names quoted.',
  }),
  pubmed_record_depth_counts: Object.freeze({
    kind: 'search-record',
    resource: 'PubMed (MCP search_articles)',
    what_was_counted: 'total_count for the query `Spalax eye` was 28; total_count for the query `Heterocephalus glaber eye` was 9.',
    what_it_justifies: 'the choice of the Spalacid subterranean rodent rather than Heterocephalus glaber for pair 2, as the side with the deeper record on eye reduction specifically.',
    what_it_does_NOT_justify: 'anything about the biology. A PubMed hit count is a crude proxy for depth of record, it is sensitive to the query translation PubMed chose, and it was not matched for query specificity between the two searches. It is recorded as the reason for a CHOICE, not as a finding.',
    verified_how: 'two PubMed MCP search_articles calls this session; the total_count fields (28 and 9) were read back from the responses.',
  }),
});

/** The single clearest instance of this module's thesis found this session. Tests assert against it. */
export const SYMBOL_TRAP = Object.freeze({
  headline: 'A live orthology resource, queried by gene symbol, returned a confident one-to-one orthologue for the wrong gene.',
  the_query: 'Ensembl REST /homology/symbol/homo_sapiens/RAX against astyanax_mexicanus, type=orthologues.',
  what_came_back: 'the real human retinal homeobox gene (ENSG00000134438, HGNC:18662, chromosome 18) returned an EMPTY homology list. A second human gene sharing the symbol RAX as an alias returned a clean `ortholog_one2one` call to ENSAMXG00000034602.',
  what_that_gene_is: 'prkra - protein kinase, interferon-inducible double stranded RNA dependent activator.',
  why_it_is_the_worst_kind_of_error: 'the response is well formed, the homology type is the strongest in the vocabulary, and nothing in it is flagged. A pipeline that resolves a symbol to an orthologue would substitute a kinase activator for the eye-field homeobox gene and report high confidence while doing it.',
  the_gene_it_should_have_found: 'rax in Astyanax mexicanus, NCBI Gene 103038458, alias rx3 - the gene whose CRISPR knockout confirms it is required for eye formation (Warren 2021, PMID 33664263).',
  the_defence: 'query by stable identifier, never by symbol; and check the number of returned human genes, because more than one means the symbol was ambiguous before the orthology step even ran.',
  source: 'ensembl_rax_symbol_trap, gene_human_rax, gene_astyanax_rax, warren_2021',
});

/** Numbers read from the live records, kept separate from the evidence slots so they can be audited. */
export const WHAT_THE_RECORDS_SAID = Object.freeze({
  eye_qtl_regions_shared_across_lineages: Object.freeze({
    count: 9,
    denominator_as_stated_in_the_preprint: Object.freeze([15, 16]),
    percentage_as_stated: Object.freeze(['~43% (abstract)', '43% (results, where nine of sixteen is 56%)', 'up to 56% (same results paragraph)']),
    this_file_reports: 'the count, 9 regions. The denominator and the percentage are not reconciled in the preprint text retrieved, so no single percentage is recorded as fact.',
    source: 'richards_2026',
  }),
  genes_under_selection_in_all_three_wild_cave_populations: Object.freeze({
    count: 2,
    out_of_genes_inside_qtl_regions: 2433,
    and: 'both of the two sit in lineage-UNIQUE QTL regions, and neither is in an eye QTL. Widening to genes under selection in at least one population from each lineage raises the tally to 30, of which 11 fall inside three shared eye-size QTL and two shared sleep QTL.',
    so: 'shared QTL REGIONS did not resolve into shared GENES under selection for eye loss. The region-level repeatability is real; the gene-level question is open.',
    source: 'richards_2026',
  }),
  snps_differentiated_in_both_cave_lineages: Object.freeze({
    both_lineages: 44, old_lineage_only: 31, new_lineage_only: 2,
    attributed_to: 'ancestral standing genetic variation rather than independent mutation',
    source: 'bradic_2013',
  }),
  surviving_retinal_ganglion_cells_in_the_rodent: Object.freeze({
    total: '890 +/- 62', melanopsin_positive: '752 +/- 40 (87%)',
    source: 'esquiva_2016',
  }),
  sonic_hedgehog_gene_count: Object.freeze({
    teleost_side: 2, mammal_side: 1,
    agreed_by: ['NCBI Gene', 'Ensembl Compara'],
    ensembl_type_string: 'ortholog_one2many',
    source: 'gene_astyanax_shha, gene_astyanax_shhb, gene_human_shh, gene_spalax_shh, ensembl_shh_orthologues',
  }),
  retinal_homeobox_gene_count: Object.freeze({
    teleost_side: 3, mammal_side: 1,
    teleost_symbols: Object.freeze(['rx1', 'rx2', 'rax (alias rx3)']),
    and_the_disagreement: 'Ensembl Compara returned NO Astyanax orthologue for the real human RAX gene, while NCBI Gene holds three retinal-homeobox genes in that fish. The resources do not agree, which is Altenhoff 2016\'s point arriving in the one lookup this pair most needed.',
    source: 'gene_astyanax_rax, gene_astyanax_rx1_rx2, gene_human_rax, gene_spalax_rax, ensembl_rax_symbol_trap',
  }),
});

// =====================================================================================================
// THE PAIRS
// =====================================================================================================

export const PAIRS = Object.freeze([

  // ---------------------------------------------------------------------------------------------------
  // PAIR 1. The same species, twice. The most controlled convergence in the set.
  // ---------------------------------------------------------------------------------------------------
  Object.freeze({
    id: 'cave-eye-regression-pachon-molino',
    a: { species: 'Astyanax mexicanus (Pachon cave population, Lineage 2)', name: 'eye-regression developmental programme' },
    b: { species: 'Astyanax mexicanus (Molino cave population, Lineage 1)', name: 'eye-regression developmental programme' },
    claim: 'convergent-analogy',
    note: 'Convergence WITHIN one species: same genome, same gene pool, two colonisations of caves from at least two different surface lineages (Richards 2026, PMID 41676532), the same outcome. Every confound that usually wrecks a convergence comparison is held constant by construction, so this is the cleanest place in the repo to ask whether two lineages used the same loci. The live records answer partly: NINE eye-size QTL regions are associated with cave genotypes from both lineages, which is the highest genetic repeatability among the traits examined - and a selective-sweep scan over 2,433 genes inside QTL regions found only TWO genes under selection in all three wild cave populations, both of them in lineage-unique, non-eye QTL. So the question is settled at the level of REGIONS and open at the level of GENES. Bradic 2013 (PMID 23927992) adds a third possibility that neither "same mutation" nor "different route" covers: 44 SNPs differentiated in both cave lineages, attributed to shared ancestral standing variation, which would make this parallelism from a common allele pool rather than independent invention.',
    the_vocabulary_problem_this_pair_exposes:
      'This module\'s HOMOLOGY_TYPES has no term for the relationship between corresponding loci in two conspecific populations. That relationship is ALLELIC, not orthologous - Fitch 1970 defines orthology by speciation, and no speciation separates these two populations. Recording it as "one-to-one" would be convenient and would make the module name sequence orthology as the strongest evidence for a pair whose entire interest is that ancestry is held CONSTANT. Recording it as "none" would deny shared ancestry that plainly exists. So the slot is marked absent with the reason stated, and the consequence is accepted: classify() then reports homology_type "none" for this pair, which is wrong in a way worth writing down. The vocabulary is built for cross-species pairs and this pair is not one.',
    developmental_context: {
      difference_stated: true,
      a: 'Pachon, Lineage 2 (with Tinaja). Eye-size QTL mapped in a Pachon x surface F2 cross sharing one female surface grandparent with the other crosses (Richards 2026). Pachon is the population most of the single-population developmental work in this system has used, per the same preprint\'s remark that work in this system has largely been done with only a single cave population.',
      b: 'Molino, Lineage 1: a separate colonisation from a different surface lineage, mapped in its own F2 cross against the SAME female surface grandparent. Richards 2026 records that individual cave populations differ in trait shifts including early eye morphology, so the two sides are not assumed to be developmentally identical - the difference is the reason the comparison is informative.',
      the_difference_that_matters: 'both sides are scored as eye size in F2 hybrids against one shared surface reference genotype, which is an unusually tight context match. What differs is the timing and severity of early eye morphology between populations, and that difference is stated rather than averaged away.',
    },
    databases_searched: ['NCBI Gene (Astyanax mexicanus)', 'Ensembl Compara REST (astyanax_mexicanus)', 'UniProtKB (organism_id 7994)', 'PubMed / PMC'],
    analogue_search: { performed: true, how: 'function-first: the literature was searched for WHICH loci drive eye regression in each population, by QTL mapping and by expression, rather than by looking up an orthologue. Richards 2026, Bradic 2013, Warren 2021 and O\'Quin 2015 were all reached that way.' },
    evidence: {
      'lof-phenotype': {
        present: true,
        what: 'eye size is reduced in both populations and was QTL-mapped in both lineages in the SAME assay against the SAME female surface grandparent (Richards 2026). Nine eye-size QTL regions are associated with cave genotypes from both lineages. One gene inside an eye-size QTL, rax (NCBI Gene 103038458, alias rx3), has been knocked out by CRISPR in this species and is required for eye formation (Warren 2021).',
        caveat: 'this is a standing-phenotype comparison between populations, not a gene-level perturbation performed separately in each population. The rax knockout was done once, in one background, and establishes requirement for eye formation in the species - not that the two populations lost the eye through that gene. Richards 2026 is a preprint and is not peer reviewed.',
        source: 'richards_2026, warren_2021, gene_astyanax_rax',
      },
      'positional-correspondence': {
        present: true,
        what: 'the two structures are the same organ in the same position of the same body plan: the paired eye of one species.',
        caveat: 'trivially true, and therefore close to uninformative. Within one species positional correspondence is the baseline rather than a finding. It is entered because it is true, and the module\'s own text says this kind is the most liable to circularity of the seven - here it is not circular, it is simply empty.',
        source: 'not applicable: this follows from the two sides being conspecific populations',
      },
      'expression-domain': {
        present: false,
        why: 'Yamamoto 2004 (PMID 15483612) reports expanded shh and twhh expression along the anterior embryonic midline "in several different cavefish populations" - that phrase, verbatim from the abstract read this session. The abstract does NOT name the populations, and nothing retrieved this session shows the midline measurement in BOTH Pachon and Molino. A shared expression change reported across an unnamed plurality of populations is not a shared expression domain established for the two populations this pair names. Marking it present would be scoring a different comparison under this pair\'s name.',
        what_would_establish_it: 'in-situ or quantitative measurement of shha and shhb midline expression in Pachon and Molino embryos at matched stages, in one study, with the surface reference in the same batch.',
        source: 'yamamoto_2004',
      },
      'rescue': {
        present: false,
        why: 'no complementation between these two cave populations for eye regression is recorded here. Two near-misses exist and neither counts. (a) Yamamoto 2004 transplanted a surface-fish embryonic lens into a cavefish optic cup and restored a complete eye - a genuine rescue, but surface-into-cave, which tests neither side of this pair against the other. (b) O\'Quin 2015 (PMID 26649887) DID run a genetic complementation test between two different cave populations and found wild-type ossified sclera in the F1 - but the assay is scleral ossicle number, a skeletal consequence downstream of lens degeneration, not eye size or the regression programme. Scoring it here would be two readouts sharing a word.',
        what_would_establish_it: 'a Pachon x Molino F1 scored for EYE SIZE against both parental populations and the surface reference in one batch. That is a cross anyone with both stocks could run, and it is the single experiment that would move this pair.',
        and_note_the_direction: 'if such an F1 had larger eyes, that would be a complementation result arguing the two populations\' causal lesions are at DIFFERENT loci - which supports convergence and argues against the loci being the same. A rescue here would weaken the identity claim, not strengthen it. The evidence kind and the claim pull in opposite directions, which is worth saying out loud.',
        source: 'yamamoto_2004, oquin_2015',
      },
      'sequence-orthology': {
        present: false,
        why: 'the two sides are conspecific populations. The relationship between corresponding loci is ALLELIC, not orthologous: Fitch 1970 defines orthology by speciation and no speciation separates Pachon from Molino. None of HOMOLOGY_TYPES describes "same locus, different alleles, one species", so the slot is left absent rather than filled with the convenient "one-to-one". See the_vocabulary_problem_this_pair_exposes. The cost is that classify() reports homology_type "none" for a pair whose two sides share a genome, and that is a defect of the vocabulary being exercised, not a claim about the biology.',
        source: 'not applicable',
      },
      'synteny': {
        present: false,
        why: 'not a finding within one species. The genomic neighbourhood is identical by construction, and the QTL on both sides are expressed in one coordinate system - the chromosome-level surface-fish reference (Warren 2021). There is nothing for a synteny check to establish.',
        source: 'warren_2021',
      },
      'domain-architecture': {
        present: false,
        why: 'not applicable: the two sides are developmental programmes in one species, so there is no protein pair to compare. The proteins are the same proteins.',
        source: 'not applicable',
      },
    },
  }),

  // ---------------------------------------------------------------------------------------------------
  // PAIR 2. The greatest distance in the set, and the pair that fails instructively.
  // ---------------------------------------------------------------------------------------------------
  Object.freeze({
    id: 'cave-eye-regression-vs-spalax',
    a: { species: 'Astyanax mexicanus (Pachon cave population)', name: 'eye-regression programme: expanded midline shha/shhb signalling driving lens apoptosis' },
    b: { species: 'Nannospalax galili / Spalax ehrenbergi superspecies', name: 'subcutaneous rudimentary eye' },
    claim: 'convergent-analogy',
    note: 'Both lineages reduced an eye in the dark, and that is where the similarity stops. The Spalacid rodent was chosen over Heterocephalus glaber on record depth measured live - PubMed returned 28 records for `Spalax eye` and 9 for `Heterocephalus glaber eye` - and that is a reason for a CHOICE, not a finding. The ocular literature is on the Spalax ehrenbergi superspecies; the gene records are on Nannospalax galili, which NCBI Taxonomy (taxid 1026970) lists under the synonym Nannospalax ehrenbergi galili, and that nomenclatural link is all that joins the two bodies of evidence on this side. The mammalian side is histological, ultrastructural and comparative-genomic. There is no gene knockout, no embryonic signalling-domain comparison against a sighted relative, and no complementation. Three evidence kinds are therefore absent, the module bands the pair low, and the band is the honest output. Separately and decisively: the fish side runs on TWO sonic-hedgehog genes where the mammal has one, so the mapping is ONE-TO-MANY and no functional-equivalence statement is available for this pair at any evidence level.',
    the_two_regressions_are_not_the_same_regression:
      'In the cave populations the embryonic lens undergoes massive apoptosis, the retina degenerates after it, patterning and differentiation of the retinal layers proceed almost normally beforehand (Alunni 2007), and the eye arrests and sinks into the orbit with no visual or photic function recorded. In the subterranean rodent the lens vesicle and optic cup appear INITIALLY NORMAL; the iris-ciliary body complex then arises prematurely and overgrows, obliterating the anterior chamber; the lens nucleus becomes disorganised, vacuolated and vascularised; the optic fissure never closes (Sanyal 1990). But retinal histogenesis proceeds relatively normally, opsin is present in the photoreceptors, 890 +/- 62 retinal ganglion cells survive of which 87% are melanopsin-positive with intact ribbon-synapse circuitry (Esquiva 2016), and the long-wavelength cone opsin is spectrally tuned to the red light inside the closed eye, which argues it is a maintained photopigment rather than a residue (David-Gray 1999). One lineage abolished an eye. The other kept a reduced one and runs it as a photoperiod organ. Both are called "eye regression" and that is two readouts sharing a word.',
    developmental_context: {
      difference_stated: true,
      a: 'teleost embryo. Hedgehog expansion at the anterior midline from early embryogenesis; lens apoptosis is the trigger; the eye arrests, degenerates and sinks into the orbit. Staged on a teleost series in hours and days post-fertilisation.',
      b: 'subterranean rodent embryo and adult. Eye primordia initially normal; the lesion is a premature and massive overgrowth of the iris-ciliary body complex destroying the anterior segment, plus a disorganised lens nucleus and a failure of optic fissure closure. Retina largely spared and retained as a functioning non-image photoreceptive organ under the skin.',
      the_differences_that_matter: [
        'the tissue that fails is different: lens-then-retina on one side, anterior segment with retina spared on the other.',
        'the outcome is different: a lost organ versus a reduced organ kept for a different job. The function being compared does not survive the comparison intact.',
        'the timing is different and there is no stage correspondence between a teleost hours-post-fertilisation series and a rodent gestational series beyond coarse landmarks.',
        'the paralogue complement is different, and this is the one that bites: the fish mechanism needs two hedgehog ligands and the mammal has one. Any transfer of a phenotype across this pair would have to say which copy of a duplicate pair it means, and there is no answer.',
        'the assays are different: QTL mapping, in-situ hybridisation, apoptosis labelling and CRISPR on one side; histology, ultrastructure, immunohistochemistry and cell counts on the other. No phenotype was scored in the same assay on both sides.',
      ],
    },
    databases_searched: ['NCBI Gene (Astyanax mexicanus, Nannospalax galili, Homo sapiens)', 'Ensembl Compara REST (homology/symbol, homo_sapiens vs astyanax_mexicanus)', 'UniProtKB (organism_id 7994 and 1026970)', 'NCBI Taxonomy', 'PubMed / PMC'],
    analogue_search: { performed: true, how: 'function-first: PubMed was searched for what performs or fails in eye reduction on the mammalian side - by histology, by opsin immunohistochemistry, by retinal cell counts and by circadian function - without going through orthology. The result of that search is the three absences below, which is a real result and not a gap.' },
    evidence: {
      'sequence-orthology': {
        present: true,
        homology_type: 'one-to-many',
        direction: 'one mammalian Shh corresponds to TWO teleost genes. Side a is the many side.',
        n_on_a_side: 2,
        members_on_a_side: ['shha (NCBI Gene 103046459, alias shh)', 'shhb (NCBI Gene 103032897, alias twhh)'],
        member_on_b_side: 'Shh (NCBI Gene 103745341, Nannospalax galili); human SHH is likewise a single gene (NCBI Gene 6469)',
        what: 'the cavefish mechanism is the coordinated midline expansion of BOTH hedgehog ligands, shh and twhh in the 2004 nomenclature, which the current records carry as shha and shhb. The mammal has one Shh. Ensembl Compara, queried live, returns both Astyanax genes for human SHH and types each `ortholog_one2many`. The same shape appears on the eye-field homeobox axis: NCBI holds rx1, rx2 and rax (alias rx3) in the fish against the single mammalian Rax.',
        why_this_is_the_most_valuable_thing_in_this_pair: 'under this module\'s rules, a one-to-many relationship means "the orthologue" does not denote, so no functional-equivalence statement is available for this pair whatever else is present. That refusal does not weaken with more evidence. And it is not a technicality: the fish phenotype is produced by two ligands acting together, so there is no single mammalian counterpart for the mechanism even in principle. See THE_ZEBRAFISH_PROBLEM - the shape belongs to having a duplication on one side, not to any one model organism.',
        no_identity_value_is_given: 'no pairwise identity was computed this session, so none is recorded. An invented identity would be worse than its absence.',
        source: 'gene_astyanax_shha, gene_astyanax_shhb, gene_human_shh, gene_spalax_shh, gene_astyanax_rax, gene_astyanax_rx1_rx2, gene_spalax_rax, ensembl_shh_orthologues',
      },
      'domain-architecture': {
        present: true,
        what: 'the hedgehog ligands on both sides carry the same two Pfam modules in the same order: PF01085 (Hedgehog amino-terminal signalling domain) and PF01079 (Hint module). Read from UniProtKB for Astyanax mexicanus entries A0A3B1J4Z1, W5KLY9 and Q66PH6, and for Nannospalax galili entries A0A8C6S2V1 and A0A8C6S2V2. Pfam names read from the InterPro entry API.',
        caveat: 'all five UniProt entries are unreviewed. Identical architecture across a ligand family is the expected result and establishes biochemical capability only - it says nothing about which of the two fish copies carries the midline function, which is the question that matters here and the one the one-to-many relationship makes unanswerable.',
        source: 'uniprot_hedgehog_domains',
      },
      'positional-correspondence': {
        present: true,
        what: 'both structures are the paired camera eye, in corresponding positions of the head.',
        the_honest_complication: 'the EYE is homologous between these two lineages - this is the one slot in this pair where ancestry is genuinely shared. The convergence claim is not about the organ, it is about the degenerative programme that reduced it. Position therefore supports the comparison being well formed and contributes nothing to the convergence claim itself.',
        source: 'sanyal_1990, alunni_2007',
      },
      'expression-domain': {
        present: false,
        why: 'no comparable measurement exists on the mammalian side. On the fish side the midline hedgehog expansion is mapped in embryos by in-situ hybridisation (Yamamoto 2004) and the eye-patterning gene expression is characterised through development (Alunni 2007). On the mammalian side the record retrieved this session is adult histology and ultrastructure with opsin shown immunohistochemically (Sanyal 1990), adult retinal immunohistochemistry and cell counts (Esquiva 2016), and an adult opsin spectral-tuning argument (David-Gray 1999). A protein localisation in an adult eye is not an embryonic signalling-domain comparison, and no embryonic Shh midline comparison against a sighted relative was found.',
        what_would_establish_it: 'Shh expression in subterranean-rodent embryos at eye-field stages, measured against a surface-dwelling relative in the same study. Until then there is nothing to compare the fish measurement to.',
        source: 'yamamoto_2004, alunni_2007, sanyal_1990, esquiva_2016, davidgray_1999',
      },
      'lof-phenotype': {
        present: false,
        why: 'THIS IS THE ABSENCE THAT DEFINES THE PAIR. On the fish side a loss of function exists: rax (alias rx3) knocked out by CRISPR is required for eye formation (Warren 2021), and eye size is QTL-mapped across populations. On the mammalian side there is no gene knockout for eye reduction and no genetic perturbation of any kind in the record retrieved this session - the evidence is descriptive and comparative. So there is no matched loss-of-function comparison, and asserting one would be the overstatement this pair was built to avoid.',
        what_would_establish_it: 'a perturbation in the subterranean rodent, or in a tractable sighted relative, that reproduces or reverses part of the eye reduction. Nothing short of that makes the mammalian side experimental.',
        source: 'warren_2021, gene_astyanax_rax, sanyal_1990',
      },
      'rescue': {
        present: false,
        why: 'no complementation in either direction, and none is plausible at this distance for a developmental programme. The only eye restoration in this system is the within-species surface-lens transplant into a cavefish optic cup (Yamamoto 2004), which says nothing about the mammal. Note also that failure to rescue would be weak evidence against analogy anyway - the module\'s own text lists the reasons - so the absence here is a statement about what has been done, not about what is true.',
        source: 'yamamoto_2004',
      },
      'synteny': {
        present: false,
        why: 'not available from the records read. The Nannospalax galili Shh record (NCBI Gene 103745341) and Rax record (103739619) both report chromosome "Un" - unplaced scaffolds in that assembly - so there is no neighbourhood to compare. On the fish side Ensembl places shha on seq_region 16 of Astyanax_mexicanus-2.0 while the NCBI record gives chromosome 8, so the two resources do not even agree on the fish coordinates. A synteny check would be exactly what distinguishes shha and shhb as a genuine duplicate pair from a later local duplication, and it has not been run here.',
        source: 'gene_spalax_shh, gene_spalax_rax, gene_astyanax_shha, ensembl_shh_orthologues',
      },
    },
  }),
]);

// =====================================================================================================
// SCORED - the band as a RECORD, computed at import time
// =====================================================================================================
// Nothing above states a band, a label or a class. These are whatever scoreAnalogy() returns for the
// evidence as written. If the evidence changes, these change, and no hand-written number goes stale.

export const SCORED = Object.freeze(PAIRS.map(p => scoreAnalogy(p.a, p.b, p.evidence)));

/** Convenience index, so a consumer does not have to know the array order. */
export const SCORED_BY_ID = Object.freeze(Object.fromEntries(PAIRS.map((p, i) => [p.id, SCORED[i]])));

export const HOMOLOGY_VOCABULARY_USED = Object.freeze({
  available: HOMOLOGY_TYPES,
  ambiguous: AMBIGUOUS_HOMOLOGY_TYPES,
  what_pair_1_needed_and_did_not_find: 'a term for "same locus, different alleles, conspecific populations". It is not in the list, and the consequence is recorded in pair 1 rather than papered over.',
  what_pair_2_used: 'one-to-many, which is in AMBIGUOUS_HOMOLOGY_TYPES, which is why that pair can never reach functional equivalence here.',
});

const RUN_DIRECTLY = /(^|[\\/])cave-regression\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
  console.log('\nanalogues/combos/pairs/cave-regression.mjs - 2 pairs, bands as returned by scoreAnalogy()\n');
  for (let i = 0; i < PAIRS.length; i++) {
    const v = SCORED[i];
    console.log(`  ${PAIRS[i].id}`);
    console.log(`    present : ${v.present_kinds.join(', ') || '(none)'}`);
    console.log(`    strongest: ${v.strongest?.kind ?? '(none)'}${v.strongest?.directly_tests_function ? ' [direct test]' : ''}`);
    console.log(`    band    : ${v.confidence.lo}-${v.confidence.hi} (${v.confidence.label}), span ${v.confidence.label_span.join('/')}`);
    console.log(`    alt     : ${v.confidence.under_alternative_weighting.lo}-${v.confidence.under_alternative_weighting.hi} (${v.confidence.under_alternative_weighting.label}), robust ${v.confidence.label_is_robust_to_weighting}`);
    console.log(`    homology: ${v.homology_type}`);
    console.log(`    gaps    : ${v.gaps.length}`);
    console.log('');
  }
  console.log(`  ${SYMBOL_TRAP.headline}\n  -> ${SYMBOL_TRAP.what_that_gene_is}\n`);
}
