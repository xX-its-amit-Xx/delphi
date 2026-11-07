#!/usr/bin/env node
// space.mjs - THE DESIGN SPACE DELPHI CAN ACTUALLY BE ASKED ABOUT: HOSTS x FUNCTIONS, WITH THE
//             INADMISSIBLE COMBINATIONS REFUSED FOR STATED STRUCTURAL REASONS RATHER THAN SCORED.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// Upstream of here, a design request arrives as a pair: a BASE ORGANISM and a CAPABILITY to move into
// it. "Put the antifreeze protein in the medaka." "Give the pig brown-fat thermogenesis." "Make the
// cow emit less methane." The pipeline's instinct is to score such a pair - feasibility 0.62 - and
// rank the space. That instinct is wrong twice over, and this module is the correction.
//
// It is wrong first because MOST OF THE SPACE IS NOT DIFFICULT, IT IS MALFORMED. A request can fail
// not because the experiment is hard but because the sentence does not describe a possible edit:
//
//   1. THE TRAIT IS NOT IN THE ANIMAL'S GENOME AT ALL. Enteric methane is produced by archaea and
//      bacteria in the rumen, not by bovine cells. Difford et al. 2018 put the host's heritable share
//      of methane variation at 21% and the cumulative share of all measured bacteria and archaea at
//      13%, and reported the two as largely independent; Zhang et al. 2020, on a different herd and a
//      different model, got 24% and 7%. Those are real numbers and they are not a licence: no edit to
//      the bovine genome moves a trait of a community that is reacquired from the environment every
//      generation. "Engineer the cow" and "engineer the rumen" are different projects with different
//      containment problems, and a feasibility score silently merges them.
//
//   2. THE GENE BEING DELETED WAS NEVER THERE. Haemoglobin loss is a real and spectacular phenotype -
//      the channichthyid icefishes are the only vertebrates without functional haemoglobin genes or
//      red cells (Kim et al. 2019). It is also not an edit that can be applied to a nematode, a fly or
//      a yeast, because none of them carries haemoglobin-based oxygen transport to lose. A loss
//      request presupposes a possession, and a scorer that returns 0.1 instead of a refusal has
//      asserted that the edit is merely unlikely.
//
//   3. THE TRAIT IS QUANTITATIVE AND THE REQUEST IS A SINGLE EDIT. Diving capacity in mammals tracks
//      myoglobin net surface charge across a 130-species phylogeny (Mirceta et al. 2013) - a direction
//      of accumulated substitution, not an allele, and it sits on top of muscle mass, buffering
//      capacity, bradycardia and blood volume. "Add the dive gene" names nothing. Cavefish eye
//      regression is the same shape from the other side. Scoring these pairs mid-range is the worst
//      available answer, because mid-range reads as "ambitious but try it" when the correct answer is
//      "the request as written has no referent".
//
//   4. THE HOST CANNOT BE TRANSFORMED. There is no published germline route into Chaenocephalus
//      aceratus or Carassius carassius. Everything downstream of that fact is moot, and the fact is
//      cheap to check and almost never checked first.
//
// It is wrong second because A RANKED LIST HIDES ITS OWN REASONS. If this module returned an ordered
// table, the useful content - WHY a pair is out, and WHAT WOULD PUT IT BACK IN - would survive only as
// an ordering, and the ordering would be read as difficulty. So there is no score here, no ranking
// function, and no aggregate "space feasibility". There is a cross product, a verdict per cell drawn
// from a closed vocabulary, a sentence of reasons, and a sentence naming the one thing that would
// change the verdict. The refusals are the product. See WHY_NO_RANKING.
//
// ============================== WHAT A VERDICT IS AND IS NOT ==============================
// admissible(host, fn) returns { admissible, class, because, what_would_change_it }. ADMISSIBLE MEANS
// THE REQUEST IS WELL FORMED AND A GERMLINE ROUTE EXISTS. It does not mean the experiment will work,
// that the donor gene will function in the host, or that the phenotype will transfer. Kachroo et al.
// 2015 replaced 414 essential yeast genes with their human orthologues one at a time and 47% could do
// the job: that is the base rate for a single-gene swap under the most favourable conditions anyone
// has arranged, and it is roughly a coin flip. Admissible is the floor of this module, not its ceiling.
// The sibling module analogues/analogy.mjs judges whether the donor-host gene MAPPING is supported;
// this module only judges whether the REQUEST is a request.
//
// ============================== PROVENANCE AND NULLS ==============================
// Every numeric value below was retrieved in session from the source named beside it, and every source
// carries a `verified_how` saying exactly what was checked. Every genome accession was fetched live
// from the NCBI datasets API on 2026-11-07 and the organism and assembly name it returned are recorded
// verbatim; two of my first guesses (the pig and cattle accessions) came back wrong and were replaced
// by what the API actually served. Where a value could not be retrieved it is written as
// { value: null, null_reason, what_would_have_to_be_measured } and NOT guessed. Thirteen of the
// fourteen generation times in HOSTS are null for this reason: those figures are in every husbandry
// manual, but a husbandry manual is not a source I retrieved, and a number nobody checked is exactly
// the kind of number that becomes a citation later.
//
// Data-provenance note on comparative scope: where a source's dataset spans a wider range of animals
// than this repo compares, only the allowed rows are carried across. This repo's comparative scope is
// mammals, bony and cartilaginous fishes, amphibians, squamate reptiles, insects, nematodes and
// microbes, and the subsets taken below are confined to those groups.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). No member of it is named
// here, no datum is read from it, and nothing is substituted for it. Where it would have been the
// obvious donor for a capability, the honest statement is that the comparison is unavailable by
// design. Run `node holdout/check-leaks.mjs analogues` against this folder.
//
//   node analogues/combos/space.mjs          # print space()
//   node analogues/combos/test-space.mjs     # the tests

// =====================================================================================================
// 0. DEEP FREEZE
// =====================================================================================================

/** Recursive freeze. Exported constants here are data, and data that a caller can mutate is not data. */
function deepFreeze(o) {
  if (o && (typeof o === 'object') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.getOwnPropertyNames(o)) deepFreeze(o[k]);
  }
  return o;
}

/** The shape every unretrieved number takes. Never a zero, never an estimate, never a plausible guess. */
const unretrieved = (null_reason, what_would_have_to_be_measured) => ({
  value: null, null_reason, what_would_have_to_be_measured,
});

// =====================================================================================================
// 1. SOURCES
// =====================================================================================================
//
// Each entry: the citation, the identifier, what was checked to verify it, and - where this module
// quotes a number - the retrieved value and the sentence it came from. A source with no retrieved
// value is cited for a qualitative claim only, and says so.

export const SOURCES = deepFreeze({
  // ---- germline routes, one per host that has one -------------------------------------------------
  stuart_1988: {
    cite: 'Stuart, G.W., McMurray, J.V. & Westerfield, M. (1988) Replication, integration and stable germ-line transmission of foreign sequences injected into early zebrafish embryos. Development 103:403-412.',
    pmid: '2852096', doi: '10.1242/dev.103.2.403',
    verified_how: 'Retrieved by PMID through the PubMed MCP get_article_metadata tool; title, journal, volume, pages and DOI read from the returned record, and the retrieved figures below read from the returned abstract.',
    retrieved: {
      f0_retaining_dna_at_four_months: 'about 5% of fish analysed 4 months after injection retained foreign DNA in their fins',
      f1_inheritance: 'approximately 20% of F1 offspring from the germ-line-positive parent inherited the foreign DNA',
      f2_inheritance: '50% of F2 progeny from an identified F1 individual, as expected for a single heterozygous insert',
    },
  },
  rubin_spradling_1982: {
    cite: 'Rubin, G.M. & Spradling, A.C. (1982) Genetic transformation of Drosophila with transposable element vectors. Science 218:348-353.',
    pmid: '6289436', doi: '10.1126/science.6289436',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states the transformation frequency quoted below.',
    retrieved: { germline_transformation_rate: '20 to 50 percent of injected rosy mutant embryos had transformed germ line cells' },
  },
  mello_1991: {
    cite: 'Mello, C.C., Kramer, J.M., Stinchcomb, D. & Ambros, V. (1991) Efficient gene transfer in C. elegans: extrachromosomal maintenance and integration of transforming sequences. EMBO J 10:3959-3970.',
    pmid: '1935914', doi: '10.1002/j.1460-2075.1991.tb04966.x',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract confirms extrachromosomal array formation and that integration, though relatively rare, was reproducibly achieved.',
    retrieved: { no_numeric_value_quoted: 'cited for the method and for the qualitative statement that integration is rare but reproducible; no rate is quoted from it here' },
  },
  gordon_1980: {
    cite: 'Gordon, J.W., Scangos, G.A., Plotkin, D.J., Barbosa, J.A. & Ruddle, F.H. (1980) Genetic transformation of mouse embryos by microinjection of purified DNA. PNAS 77:7380-7384.',
    pmid: '6261253', doi: '10.1073/pnas.77.12.7380',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states the integration count quoted below.',
    retrieved: { first_report_yield: '2 of 78 mice in one series of injections showed clear homology to the injected plasmid' },
  },
  ansai_kinoshita_2014: {
    cite: 'Ansai, S. & Kinoshita, M. (2014) Targeted mutagenesis using CRISPR/Cas system in medaka. Biol Open 3:362-371.',
    pmid: '24728957', doi: '10.1242/bio.20148177',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract confirms heritable targeted mutations in Oryzias latipes and the PAM-density figure below.',
    retrieved: {
      heritability: 'somatic AND heritable mutations were induced at the targeted sequence',
      pam_density: 'an NGG protospacer adjacent motif occurs once every 8 bp',
      off_target: 'off-target alterations were induced at 2 genomic loci harbouring double mismatches in the 18-bp targeting sequence, and were reduced at lower sgRNA dose',
    },
  },
  elipot_2014: {
    cite: 'Elipot, Y., Legendre, L., Pere, S., Sohm, F. & Retaux, S. (2014) Astyanax transgenesis and husbandry: how cavefish enters the laboratory. Zebrafish 11:291-299.',
    pmid: '25004161', doi: '10.1089/zeb.2014.1005',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states all three figures below.',
    retrieved: {
      f0_mosaic_rate: 'about 40% mosaic transgenic fish in F0, for both I-SceI and Tol2 methods',
      f1_transmission: '16% transmission rate in F1 for the I-SceI method',
      stability: 'the transgene was stable up to the F3 generation',
    },
  },
  harel_2015: {
    cite: 'Harel, I., Benayoun, B.A., Machado, B., Singh, P.P., Hu, C.-K., Pech, M.F., Valenzano, D.R., Zhang, E., Sharp, S.C., Artandi, S.E. & Brunet, A. (2015) A platform for rapid exploration of aging and diseases in a naturally short-lived vertebrate. Cell 160:1013-1026.',
    pmid: '25684364', doi: '10.1016/j.cell.2015.01.038',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract confirms a de-novo genome plus CRISPR/Cas9 toolkit in Nothobranchius furzeri and the line-establishment time below.',
    retrieved: { line_establishment: 'stable lines produced within 2-3 months for a subset of mutated genes' },
  },
  hammer_1985: {
    cite: 'Hammer, R.E., Pursel, V.G., Rexroad, C.E., Wall, R.J., Bolt, D.J., Ebert, K.M., Palmiter, R.D. & Brinster, R.L. (1985) Production of transgenic rabbits, sheep and pigs by microinjection. Nature 315:680-683.',
    pmid: '3892305', doi: '10.1038/315680a0',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract reports integration in all three species and expression in two of them. Only the mammalian rows are relevant here and the comparative scope of this repo is mammals and fishes.',
    retrieved: { no_numeric_value_quoted: 'cited for the existence of a germline route into Sus scrofa; no efficiency figure is quoted from it here' },
  },
  krimpenfort_1991: {
    cite: "Krimpenfort, P., Rademakers, A., Eyestone, W., van der Schans, A., van den Broek, S., Kooiman, P., Kootwijk, E., Platenburg, G., Pieper, F. & Strijker, R. (1991) Generation of transgenic dairy cattle using 'in vitro' embryo production. Biotechnology (NY) 9:844-847.",
    pmid: '1367358', doi: '10.1038/nbt0991-844',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states the pregnancy, birth and integration counts below. Note the title in common circulation says "embryo culture"; the record says "embryo production".',
    retrieved: { yield: '21 pregnancies established, 19 calves born, and Southern blot proved integration in 2 cases' },
  },
  hinnen_1978: {
    cite: 'Hinnen, A., Hicks, J.B. & Fink, G.R. (1978) Transformation of yeast. PNAS 75:1929-1933.',
    pmid: '347451', doi: '10.1073/pnas.75.4.1929',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract confirms stable integration of transforming DNA into yeast chromosomes behaving as a Mendelian element.',
    retrieved: { no_numeric_value_quoted: 'cited for the method; no efficiency figure is quoted from it here' },
  },
  ishibashi_2012: {
    cite: 'Ishibashi, S., Love, N.R. & Amaya, E. (2012) A simple method of transgenesis using I-SceI meganuclease in Xenopus. Methods Mol Biol 917:205-218.',
    pmid: '22956090', doi: '10.1007/978-1-61779-992-1_12',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states the protocol is for Xenopus tropicalis, is suited to generating transgenic lines, and yields single-copy integration rather than tandem concatemers.',
    retrieved: { no_numeric_value_quoted: 'cited for the existence of a line-generating route; no efficiency figure is quoted from it here' },
  },
  rasys_2019: {
    cite: 'Rasys, A.M., Park, S., Ball, R.E., Alcala, A.J., Lauderdale, J.D. & Menke, D.B. (2019) CRISPR-Cas9 gene editing in lizards through microinjection of unfertilized oocytes. Cell Rep 28:2288-2292.e3.',
    pmid: '31461646', doi: '10.1016/j.celrep.2019.07.089',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states germline transmission and establishment of genetically modified strains in Anolis sagrei, and states plainly that there were no reptiles with effective targeted mutagenesis before it.',
    retrieved: { scope: 'monoallelic or biallelic mutations in F0 embryos and hatchlings, transmitted through the germline to establish strains' },
  },

  // ---- the capabilities --------------------------------------------------------------------------
  chen_1997: {
    cite: 'Chen, L., DeVries, A.L. & Cheng, C.-H.C. (1997) Convergent evolution of antifreeze glycoproteins in Antarctic notothenioid fish and Arctic cod. PNAS 94:3817-3822.',
    pmid: '9108061', doi: '10.1073/pnas.94.8.3817',
    verified_how: 'Retrieved by PMID through PubMed MCP. The page range returned by the record is 3817-3822; a sibling module in this repo cites the first page as 3811, and the record is what is used here. Abstract confirms the notothenioid AFGP origin from a pancreatic trypsinogen and that the gadid genes share no sequence identity with trypsinogen.',
    retrieved: {
      architecture: 'AFGPs in both groups are encoded by polyprotein genes, each encoding multiple AFGP molecules linked in tandem by small cleavable spacers',
      independence: 'different intron-exon organisation, different spacer sequences, and drastically different repetitive tripeptide coding sequences in the two groups',
    },
  },
  zhuang_2019: {
    cite: 'Zhuang, X., Yang, C., Murphy, K.R. & Cheng, C.-H.C. (2019) Molecular mechanism and history of non-sense to sense evolution of antifreeze glycoprotein gene in northern gadids. PNAS 116:4400-4405.',
    pmid: '30765531', doi: '10.1073/pnas.1817138116',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states the founder element size, the frameshift, and the experimental claim that all genic components originated from non-genic DNA.',
    retrieved: {
      founder_element: 'a nine-nucleotide element in a noncoding founder region supplied the codons for one Thr-Ala-Ala unit, from which the repetitive coding sequence arose by tandem duplication',
      frameshift: 'a 1-nt frameshift mutation joined the latent signal-peptide-coding exons and the 9-nt element into a single read-through open reading frame',
      claim: 'all genic components of the extant gadid gene were shown experimentally to have originated from entirely nongenic DNA',
    },
  },
  fagernes_2017: {
    cite: 'Fagernes, C.E., Stenslokken, K.-O., Rohr, A.K., Berenbrink, M., Ellefsen, S. & Nilsson, G.E. (2017) Extreme anoxia tolerance in crucian carp and goldfish through neofunctionalization of duplicated genes creating a new ethanol-producing pyruvate decarboxylase pathway. Scientific Reports 7:7884.',
    pmid: '28801642', doi: '10.1038/s41598-017-07385-4',
    verified_how: 'Retrieved by PubMed MCP search then confirmed by metadata fetch. A first guessed PMID for this paper returned an unrelated HIV microbiome article and was discarded; the record used here is the one whose title and abstract match. Abstract states all three claims below.',
    retrieved: {
      novelty: 'a pyruvate decarboxylase analogous to that of brewer\'s yeast, and the first described in vertebrates',
      mechanism: 'whole-genome duplication supplied extra copies of the pyruvate dehydrogenase multienzyme complex; some copies evolved into a pyruvate decarboxylase while others retained the parent function',
      hazard: 'the key molecular substitution in the duplicated pyruvate dehydrogenase genes is highly deleterious in humans',
    },
  },
  sugawara_2005: {
    cite: 'Sugawara, T., Terai, Y., Imai, H., Turner, G.F., Koblmuller, S., Sturmbauer, C., Shichida, Y. & Okada, N. (2005) Parallelism of amino acid changes at the RH1 affecting spectral sensitivity among deep-water cichlids from Lakes Tanganyika and Malawi. PNAS 102:5448-5453.',
    pmid: '15809435', doi: '10.1073/pnas.0405302102',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the sample sizes, the number of blue-shifted species, the number of causal replacements, and the repeated independent origin of A292S.',
    retrieved: {
      sample: 'RH1 sequences from 233 individual cichlids; pigments reconstructed with 11-cis-retinal from 28 sequences',
      effect: 'absorption spectra of the pigments of nine species were shifted toward blue, tuned by two particular amino acid replacements',
      parallelism: 'the replacement A292S evolved several times independently, inducing similar functional change',
    },
  },
  hague_2017: {
    cite: 'Hague, M.T.J., Feldman, C.R., Brodie, E.D. Jr & Brodie, E.D. III (2017) Convergent adaptation to dangerous prey proceeds through the same first-step mutation in the garter snake Thamnophis sirtalis. Evolution 71:1504-1518.',
    pmid: '28370004', doi: '10.1111/evo.13244',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the first-step mutation, its independent origin in two lineages, and that the larger-effect pore mutations always occur together with it.',
    retrieved: {
      first_step: 'resistance in both lineages began with the same isoleucine-to-valine mutation, I1561V, in the outer pore of the skeletal muscle sodium channel',
      order: 'other point mutations in the pore, conferring much greater resistance, accumulate later and always occur together with the initial I1561V change',
      count: 'the most extreme resistance phenotype is determined by four critical amino acid substitutions',
    },
  },
  hague_2018: {
    cite: 'Hague, M.T.J., Toledo, G., Geffeney, S.L., Hanifin, C.T., Brodie, E.D. Jr & Brodie, E.D. III (2018) Large-effect mutations generate trade-off between predatory and locomotor ability during arms race coevolution with deadly prey. Evolution Letters 2:406-416.',
    pmid: '30283691', doi: '10.1002/evl3.76',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states both halves of the trade-off below.',
    retrieved: {
      organismal_cost: 'snakes homozygous for the large-effect resistance allele had significantly reduced crawl speed compared with individuals carrying the ancestral sensitive channel',
      biophysical_cost: 'heterologous expression showed the same allele confers a dramatic increase in toxin resistance and a correlated decrease in overall channel excitability',
    },
  },
  gallant_2014: {
    cite: 'Gallant, J.R. et al. (2014) Genomic basis for the convergent evolution of electric organs. Science 344:1522-1525.',
    pmid: '24970089', doi: '10.1126/science.1254432',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the number of independent origins and the shared-machinery conclusion.',
    retrieved: {
      origins: 'the myogenic electric organ has evolved six times in fishes',
      convergence: 'independent lineages leveraged similar transcription factors and developmental and cellular pathways, despite large differences in electrocyte morphology',
    },
  },
  mirceta_2013: {
    cite: 'Mirceta, S., Signore, A.V., Burns, J.M., Cossins, A.R., Campbell, K.L. & Berenbrink, M. (2013) Evolution of mammalian diving capacity traced by myoglobin net surface charge. Science 340:1234192.',
    pmid: '23766330', doi: '10.1126/science.1234192',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the phylogeny size and the mechanistic link below. The study is mammal-only, which matches this repo\'s comparative scope without subsetting.',
    retrieved: {
      scope: 'ancestral sequence reconstruction across a 130-species mammalian phylogeny',
      signature: 'an adaptive molecular signature of elevated myoglobin net surface charge in diving species, mechanistically linked with maximal myoglobin concentration',
    },
  },
  zheng_2017: {
    cite: 'Zheng, Q. et al. (2017) Reconstitution of UCP1 using CRISPR/Cas9 in the white adipose tissue of pigs decreases fat deposition and improves thermogenic capacity. PNAS 114:E9474-E9482.',
    pmid: '29078316', doi: '10.1073/pnas.1707853114',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states that pigs lack a functional UCP1 gene, and states each measured outcome below with its reported significance.',
    retrieved: {
      host_absence: 'pigs lack a functional UCP1 gene, resulting in poor thermoregulation and susceptibility to cold',
      construct: 'mouse adiponectin-UCP1 inserted into the porcine endogenous locus by a CRISPR/Cas9-mediated, homologous-recombination-independent approach',
      fat_change: 'fat deposition decreased by 4.89% (P < 0.01), with a consequent increase in carcass lean percentage (P < 0.05)',
      what_did_not_change: 'no alteration in physical activity levels or total daily energy expenditure',
      thermal: 'improved ability to maintain body temperature during acute cold exposure',
    },
  },
  kim_2019: {
    cite: 'Kim, B.-M. et al. (2019) Antarctic blackfin icefish genome reveals adaptations to extreme environments. Nature Ecology & Evolution 3:469-478.',
    pmid: '30804520', doi: '10.1038/s41559-019-0812-7',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the uniqueness of the haemoglobin loss, the divergence date, the expanded gene families and the absent circadian regulators.',
    retrieved: {
      loss: 'icefishes are the only vertebrates that lack functional haemoglobin genes and red blood cells',
      divergence: 'notothenioids diverged from the stickleback lineage about 77 million years ago',
      expansions: 'genes involved in protection from ice damage, including antifreeze glycoprotein and zona pellucida proteins, are highly expanded',
      absences: 'crucial regulators of circadian homeostasis (cry and per genes) are absent from the genome',
    },
  },
  hu_2020: {
    cite: 'Hu, C.-K., Wang, W., Brind\'Amour, J., Singh, P.P., Reeves, G.A., Lorincz, M.C., Sanchez Alvarado, A. & Brunet, A. (2020) Vertebrate diapause preserves organisms long term through Polycomb complex members. Science 367:870-874.',
    pmid: '32079766', doi: '10.1126/science.aaw2601',
    verified_how: 'Retrieved by PMID through PubMed MCP; abstract states the no-trade-off result, the chromatin mark, and the functional requirement for CBX7.',
    retrieved: {
      preservation: 'diapause preserves the organism for extremely long periods without trade-offs for subsequent adult growth, fertility and life span',
      mechanism: 'Polycomb complex members are among the most up-regulated genes; H3K27me3 is maintained at key developmental genes; CBX7 mediates repression of metabolism and muscle genes',
      requirement: 'CBX7 is functionally required for muscle preservation and diapause maintenance',
      character: 'diapause is an active state with dynamic regulation of metabolism and organ development genes, not a passive arrest',
    },
  },
  hashimoto_2016: {
    cite: 'Hashimoto, T. et al. (2016) Extremotolerant tardigrade genome and improved radiotolerance of human cultured cells by tardigrade-unique protein. Nature Communications 7:12808.',
    pmid: '27649274', doi: '10.1038/ncomms12808',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch. A first search returned a 2017 review by the same author in Life; the primary paper used here is the Nature Communications record. Abstract states the effect size and the assay context below.',
    retrieved: {
      effect: 'a tardigrade-unique DNA-associating protein suppressed X-ray-induced DNA damage by about 40% and improved radiotolerance',
      assay_context: 'measured in HUMAN CULTURED CELLS, not in a whole transgenic animal',
      hgt_caveat: 'the genome carries a small proportion, 1.2% or less, of putative foreign genes - the earlier high horizontal-transfer estimate for tardigrades is not supported by this assembly',
    },
  },
  amsterdam_1996: {
    cite: 'Amsterdam, A., Lin, S., Moss, L.G. & Hopkins, N. (1996) Requirements for green fluorescent protein detection in transgenic zebrafish embryos. Gene 173:99-103.',
    pmid: '8707063', doi: '10.1016/0378-1119(95)00719-9',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract confirms stable transgenic zebrafish lines expressing a foreign fluorescent reporter with detectable whole-body fluorescence, and that the detection threshold was calibrated with purified protein.',
    retrieved: { no_numeric_value_quoted: 'cited for the existence of the capability by foreign addition; the concentration thresholds in the paper are not quoted here' },
  },
  difford_2018: {
    cite: 'Difford, G.F., Plichta, D.R., Lovendahl, P., Lassen, J., Noel, S.J., Hojberg, O., Wright, A.-D.G., Zhu, Z., Kristensen, L., Nielsen, H.B., Guldbrandtsen, B. & Sahana, G. (2018) Host genetics and the rumen microbiome jointly associate with methane emissions in dairy cows. PLoS Genetics 14:e1007580.',
    pmid: '30312316', doi: '10.1371/journal.pgen.1007580',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states each share below and the independence conclusion.',
    retrieved: {
      microbial_share: 'the cumulative effect of all bacteria and archaea on methane production was 13%',
      host_share: 'host genetic heritability of methane emission was 21%',
      independence: 'the two are largely independent; variation in methane emission is likely NOT modulated through cow genetic effects on the rumen microbiome',
      consequence_stated_by_the_authors: 'the rumen microbiome and the cow genome could be targeted independently',
    },
  },
  zhang_2020: {
    cite: 'Zhang, Q., Difford, G., Sahana, G., Lovendahl, P., Lassen, J., Lund, M.S., Guldbrandtsen, B. & Janss, L. (2020) Bayesian modeling reveals host genetics associated with rumen microbiota jointly influence methane emission in dairy cows. ISME Journal 14:2019-2033.',
    pmid: '32366970', doi: '10.1038/s41396-020-0663-x',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states each figure below, including that the taxon heritability estimates did not survive multiple-testing correction.',
    retrieved: {
      cohort: '750 dairy cows',
      host_share: 'host genetics explained 24% of the variation in host methane levels',
      microbiota_share: 'microbiota explained 7%',
      per_genus: 'one bacterial genus explained up to 1.6% of the total microbiota variance',
      taxon_heritabilities: 'highest estimates were 33% for a bacterial OTU, 26% for an archaeal OTU and 41% for a microbial genus - and after multiple-testing correction NONE remained significant',
    },
  },
  cornette_2010: {
    cite: 'Cornette, R. et al. (2010) Identification of anhydrobiosis-related genes from an expressed sequence tag database in the cryptobiotic midge Polypedilum vanderplanki. J Biol Chem 285:35889-35899.',
    pmid: '20833722', doi: '10.1074/jbc.M110.150623',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the database size and the gene classes induced by desiccation.',
    retrieved: {
      database: '15,056 ESTs distributed into 4,807 UniGene clusters, from larvae at 0, 12 and 36 h of desiccation',
      classes: 'antioxidants, late embryogenesis abundant (LEA) proteins and heat shock proteins were up-regulated, with trehalose metabolism genes and various transporters strongly induced',
    },
  },
  mazin_2018: {
    cite: 'Mazin, P.V. et al. (2018) Cooption of heat shock regulatory system for anhydrobiosis in the sleeping chironomid. PNAS 115:E2477-E2486.',
    pmid: '29463761', doi: '10.1073/pnas.1719493115',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the regulatory motif, the knockdown experiment and its effect size.',
    retrieved: {
      regulatory_basis: 'a TCTAGAA motif resembling the heat shock transcription activator binding site is enriched in the promoters of desiccation-induced genes, and is absent from the equivalent promoters of a congeneric desiccation-sensitive midge',
      knockdown: 'Hsf knockdown suppressed trehalose-induced activation of predicted targets and reduced the desiccation survival rate of Pv11 cells FIVEFOLD',
    },
  },
  vrtilek_2018: {
    cite: 'Vrtilek, M., Zak, J., Psenicka, M. & Reichard, M. (2018) Extremely rapid maturation of a wild African annual fish. Current Biology 28:R822-R824.',
    pmid: '30086311', doi: '10.1016/j.cub.2018.06.031',
    verified_how: 'Retrieved by PubMed MCP search then metadata fetch; abstract states the maturation time, the growth range, the ageing method (daily otolith increments plus gonad histology) and the pool-drying window.',
    retrieved: {
      maturation: 'Nothobranchius furzeri reached sexual maturity within 14 days after hatching, the fastest rate of sexual maturation recorded for a vertebrate to the authors\' knowledge',
      growth: 'growth from an initial length of 5 mm to 54 mm over a two-week period',
      method: 'age estimated by counting daily-deposited otolith increments with histological analysis of gonads',
      field_context: 'some pools were entirely desiccated 3-5 weeks after filling',
    },
  },
  kachroo_2015: {
    cite: 'Kachroo, A.H., Laurent, J.M., Yellman, C.M., Meyer, A.G., Wilke, C.O. & Marcotte, E.M. (2015) Systematic humanization of yeast genes reveals conserved functions and genetic modularity. Science 348:921-925.',
    pmid: '25999509', doi: '10.1126/science.aaa0769',
    verified_how: 'Retrieved by PMID through PubMed MCP. The title returned by the record is "reveals conserved functions and genetic modularity"; a sibling module in this repo renders it as "reveals ancient functional divergence", and the record is what is used here. Abstract states the gene count and the replaceability rate.',
    retrieved: {
      scale: '414 essential yeast genes replaced one at a time by their human orthologues',
      rate: 'nearly half, 47%, could be successfully humanized',
      structure: 'replaceability depended strongly on gene modules rather than on sequence similarity or expression: genes in the same process tended to be similarly replaceable or similarly not',
    },
  },

  // ---- assemblies ---------------------------------------------------------------------------------
  ncbi_datasets_live: {
    cite: 'NCBI Datasets API v2alpha, genome dataset_report endpoint.',
    doi: null, pmid: null,
    verified_how: 'Every accession in HOSTS was fetched live on 2026-11-07 from https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/{accession}/dataset_report, and the organism_name and assembly_name recorded in this file are the strings the API returned. Two guessed accessions were corrected by this check: GCF_000003025.6 (Sscrofa11.1) returned an empty report and was replaced with the reference the taxon query served, and the Bos taurus reference returned assembly name ARS-UCD2.0 rather than the ARS-UCD1.x that was guessed. One guessed notothenioid accession turned out to name a different species entirely and was discarded.',
    retrieved: { method_note: 'the API rate-limits unauthenticated clients at roughly five requests per second; the checks were serialised with a delay and every accession below returned a populated report' },
  },
});

export const SOURCE_IDS = deepFreeze(Object.keys(SOURCES));

// =====================================================================================================
// 2. CLOSED VOCABULARIES
// =====================================================================================================

/**
 * How reachable the host's germline is. This is a statement about the PUBLISHED RECORD, not about
 * biological possibility: NO_GERMLINE_METHOD means nobody has published a route, which is why the
 * refusal built on it names publication of a route as the thing that would change it.
 */
export const TRACTABILITY = deepFreeze({
  ROUTINE_TRANSGENESIS: {
    id: 'ROUTINE_TRANSGENESIS',
    means: 'germline transformation and targeted editing are standard practice in many laboratories, with reagents, protocols and stock centres',
    germline_route_exists: true,
  },
  ESTABLISHED_NOT_ROUTINE: {
    id: 'ESTABLISHED_NOT_ROUTINE',
    means: 'germline transformation is published and reproduced, but is held by few groups and is slow, expensive or low-yield enough that it constrains experimental design',
    germline_route_exists: true,
  },
  PUBLISHED_ONCE: {
    id: 'PUBLISHED_ONCE',
    means: 'germline modification has been demonstrated, in essentially one body of work, and has not yet become a method other laboratories run',
    germline_route_exists: true,
  },
  NO_GERMLINE_METHOD: {
    id: 'NO_GERMLINE_METHOD',
    means: 'no published route into the germline. Usually this travels with no closed life cycle in captivity, which is the deeper obstacle',
    germline_route_exists: false,
  },
});

export const TRACTABILITY_IDS = deepFreeze(Object.keys(TRACTABILITY));

/**
 * The shape of the genetic change a capability would require. This is the vocabulary the task of
 * design is actually conducted in, and the class is what decides whether the request is well formed.
 *
 * A limit worth stating: the vocabulary has no term for "swap one allele of a gene the host already
 * has". Spectral tuning and toxin resistance are both of that kind - a handful of coding substitutions
 * at one locus - and they are recorded here as SINGLE_GENE_ADDITION because that is the closest
 * available term and because the admissibility question they raise (one locus, host already has the
 * substrate) is the same. Where that matters, the function's own record says so.
 */
export const MECHANISM_CLASSES = deepFreeze({
  SINGLE_GENE_ADDITION: {
    id: 'SINGLE_GENE_ADDITION',
    means: 'one locus: add a donor coding sequence, or substitute a small number of residues in a gene the host already carries',
    single_locus: true,
    requires_donor_genome_edit: true,
  },
  REGULATORY_REWIRING: {
    id: 'REGULATORY_REWIRING',
    means: 'the host already has the parts; what differs is when, where and how much they are expressed. The edit is to regulation, and the target set is usually not fully known',
    single_locus: false,
    requires_donor_genome_edit: true,
  },
  POLYGENIC_QUANTITATIVE: {
    id: 'POLYGENIC_QUANTITATIVE',
    means: 'a continuous trait built from many loci of small effect, often with the causal variants unidentified. There is no edit that is "the" edit',
    single_locus: false,
    requires_donor_genome_edit: true,
  },
  GENE_LOSS: {
    id: 'GENE_LOSS',
    means: 'the capability consists in the ABSENCE of something the lineage once had. The edit is a deletion or inactivation, and it presupposes possession',
    single_locus: true,
    requires_donor_genome_edit: true,
    presupposes_possession: true,
  },
  PATHWAY_IMPORT: {
    id: 'PATHWAY_IMPORT',
    means: 'several genes acting together, with stoichiometry, compartment and flux to match. Importing a subset gives no partial phenotype and may give a toxic one',
    single_locus: false,
    requires_donor_genome_edit: true,
  },
  TRAIT_OF_ASSOCIATED_MICROBIOME: {
    id: 'TRAIT_OF_ASSOCIATED_MICROBIOME',
    means: 'the capability is performed by an associated microbial community, not by the animal\'s own cells. No edit to the animal genome moves it',
    single_locus: false,
    requires_donor_genome_edit: false,
    not_in_the_animal_genome: true,
  },
  STRUCTURAL_MATERIAL: {
    id: 'STRUCTURAL_MATERIAL',
    means: 'the product is an extracellular material whose function depends on how much is made, where it is deposited and how it assembles - so expressing the gene is the easy half',
    single_locus: false,
    requires_donor_genome_edit: true,
  },
});

export const MECHANISM_CLASS_IDS = deepFreeze(Object.keys(MECHANISM_CLASSES));

/**
 * Host systems a capability can require. Deliberately coarse and organ- or system-level, because that
 * is the level at which a request is malformed: the questions these answer are "is there a thing for
 * the edit to act on" and "is there a thing to delete", not "how good is it".
 */
export const SYSTEMS = deepFreeze({
  'haemoglobin-oxygen-carriage': 'circulating haemoglobin in dedicated cells, carrying oxygen between a respiratory surface and the tissues',
  'skeletal-muscle-myoglobin': 'myoglobin-containing striated skeletal muscle used for sustained aerobic work',
  'myogenic-excitable-organ-substrate': 'striated muscle that can be developmentally redirected into a non-contractile excitable tissue',
  'image-forming-eye': 'a lens-bearing, image-forming eye with a neural retina',
  'ciliary-opsin-photoreceptor': 'a ciliary photoreceptor expressing a vertebrate-type visual opsin',
  'voltage-gated-sodium-channel-nav': 'a voltage-gated sodium channel of the Nav family carrying the outer-pore residues that bind guanidinium toxins',
  'brown-adipose-or-adipose-depot': 'an adipose depot into which an uncoupling protein could be expressed',
  'endothermic-thermoregulation': 'metabolic heat production regulated against a set point',
  'forestomach-fermentation-chamber': 'a pre-gastric fermentation chamber housing an anaerobic microbial community',
  'extracellular-fluid-at-risk-of-freezing': 'a body fluid compartment that can be supercooled or seeded with ice, so that an ice-binding protein has something to act on',
  'embryonic-arrest-competence': 'an embryo that can hold at a defined stage rather than developing continuously to hatching',
  'nucleated-cells-with-chromatin': 'nucleated cells whose chromatin a DNA-associating protein could bind',
  'trehalose-metabolism': 'enzymatic capacity to synthesise and mobilise trehalose at the concentrations anhydrobiosis requires',
  'secretory-epithelium-for-export': 'a secretory epithelium able to export a processed protein into a body fluid or onto a surface',
});

export const SYSTEM_IDS = deepFreeze(Object.keys(SYSTEMS));

// =====================================================================================================
// 3. HOSTS
// =====================================================================================================
//
// `has` and `lacks` are the system-level facts admissibility turns on. They are deliberately short:
// a long list invites the reader to treat the absence of an entry as a denial, and the absence of an
// entry here means only that this module has not been asked about it. `lacks` is the asserted half,
// and every entry in it is a positive claim this module is prepared to defend.

export const HOSTS = deepFreeze([
  {
    id: 'danio-rerio',
    latin: 'Danio rerio',
    clade: 'bony fish',
    why_a_plausible_base: 'External fertilisation, transparent embryos, hundreds of eggs per clutch, and the first stable germline transgenic lines in any fish (Stuart 1988). The whole apparatus of this repo is built around it. Its specific liability is also well known here: the teleost whole-genome duplication leaves many genes as a duplicate pair, so a one-to-many mapping is the default rather than the exception - see analogues/analogy.mjs THE_ZEBRAFISH_PROBLEM.',
    germline_citation: 'stuart_1988',
    assembly: { accession: 'GCF_000002035.6', organism_returned: 'Danio rerio', assembly_name_returned: 'GRCz11', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species. The figure is in every husbandry manual, and a husbandry manual is not a source that was fetched here.',
      'Time from fertilisation to first fertile clutch, in a stated strain at a stated temperature and density, with the rearing protocol given - all three materially change it.'),
    knock_in_published: { value: true, what: 'targeted knock-in is standard in this species', source: null, verified_how: 'NOT separately verified by a retrieved citation in this session; recorded as the field value with that caveat attached rather than attributed to a paper.' },
    tractability: 'ROUTINE_TRANSGENESIS',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'extracellular-fluid-at-risk-of-freezing', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence', 'trehalose-metabolism'],
  },
  {
    id: 'drosophila-melanogaster',
    latin: 'Drosophila melanogaster',
    clade: 'insect',
    why_a_plausible_base: 'The first animal in which germline transformation was made routine, by transposon vector (Rubin & Spradling 1982), with a century of genetic infrastructure on top. Its limitation as a base for the capabilities below is anatomical rather than technical: it has an open circulation with no respiratory pigment, so a whole family of oxygen-transport requests has no substrate in it.',
    germline_citation: 'rubin_spradling_1982',
    assembly: { accession: 'GCF_000001215.4', organism_returned: 'Drosophila melanogaster', assembly_name_returned: 'Release 6 plus ISO1 MT', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Egg-to-egg time at a stated temperature, since it is strongly temperature-dependent and a single number without the temperature is not a measurement.'),
    knock_in_published: { value: true, what: 'targeted integration and editing are standard in this species', source: null, verified_how: 'NOT separately verified by a retrieved citation in this session.' },
    tractability: 'ROUTINE_TRANSGENESIS',
    has: ['image-forming-eye', 'voltage-gated-sodium-channel-nav', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export', 'trehalose-metabolism'],
    lacks: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'ciliary-opsin-photoreceptor', 'forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation'],
  },
  {
    id: 'caenorhabditis-elegans',
    latin: 'Caenorhabditis elegans',
    clade: 'nematode',
    why_a_plausible_base: 'Transformation by microinjection with extrachromosomal array formation and reproducible, if rare, integration (Mello 1991); a complete cell lineage and connectome; a three-day life cycle. As a base for borrowed physiology it is the most constrained host here: 959 somatic cells, no circulatory system, no striated skeletal musculature of the vertebrate kind.',
    germline_citation: 'mello_1991',
    assembly: { accession: 'GCF_000002985.6', organism_returned: 'Caenorhabditis elegans', assembly_name_returned: 'WBcel235', level: 'Complete Genome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Hatch-to-first-egg time at a stated temperature, on a stated food source, for a stated strain.'),
    knock_in_published: { value: true, what: 'targeted knock-in is standard in this species', source: null, verified_how: 'NOT separately verified by a retrieved citation in this session.' },
    tractability: 'ROUTINE_TRANSGENESIS',
    has: ['nucleated-cells-with-chromatin', 'trehalose-metabolism', 'secretory-epithelium-for-export'],
    lacks: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'extracellular-fluid-at-risk-of-freezing'],
    note_on_sodium_channels: unretrieved(
      'This species is widely reported to lack voltage-gated sodium channels of the Nav family, which would make it inadmissible for any request that edits the Nav outer pore. No primary source for that absence was retrieved in this session, so the claim is NOT asserted and `voltage-gated-sodium-channel-nav` appears in neither `has` nor `lacks` - the admissibility functions therefore treat it as unknown rather than absent, and say so.',
      'A genome-wide search of the current assembly for Nav-family channels, reported as a presence/absence with the search method and thresholds stated, plus the electrophysiological result that the field relies on.'),
  },
  {
    id: 'mus-musculus',
    latin: 'Mus musculus',
    clade: 'mammal',
    why_a_plausible_base: 'The first transgenic vertebrate (Gordon 1980, 2 of 78 mice) and the host with the deepest reagent base of any mammal. For the thermal and oxygen-transport capabilities below it is the only host here that already has functional non-shivering thermogenesis, which makes it a control rather than a target for several of them.',
    germline_citation: 'gordon_1980',
    assembly: { accession: 'GCF_000001635.27', organism_returned: 'Mus musculus', assembly_name_returned: 'GRCm39', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Age at first litter for a named strain under stated housing, which differs enough between strains that an unqualified figure is not usable.'),
    knock_in_published: { value: true, what: 'targeted knock-in is standard in this species', source: null, verified_how: 'NOT separately verified by a retrieved citation in this session.' },
    tractability: 'ROUTINE_TRANSGENESIS',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'extracellular-fluid-at-risk-of-freezing', 'embryonic-arrest-competence', 'trehalose-metabolism'],
  },
  {
    id: 'oryzias-latipes',
    latin: 'Oryzias latipes',
    clade: 'bony fish',
    why_a_plausible_base: 'Heritable targeted mutagenesis is published and efficient (Ansai & Kinoshita 2014), the embryos are robust, and inbred strains exist - which zebrafish largely lack. It did not go through the teleost duplication with the same consequences for every gene family, so for some loci the one-to-many mapping problem that dogs zebrafish is absent, and that is a reason to choose it as a base rather than a detail.',
    germline_citation: 'ansai_kinoshita_2014',
    assembly: { accession: 'GCF_002234675.1', organism_returned: 'Oryzias latipes', assembly_name_returned: 'ASM223467v1', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Hatch-to-first-spawning time at a stated temperature and photoperiod; this species is photoperiod-sensitive, so a figure without the light cycle is incomplete.'),
    knock_in_published: { value: null, null_reason: 'Ansai & Kinoshita 2014, the source retrieved here, reports targeted MUTAGENESIS with heritable transmission, not a knock-in. No knock-in paper for this species was retrieved in session.', what_would_have_to_be_measured: 'A published targeted insertion at a defined locus with germline transmission demonstrated.' },
    tractability: 'ROUTINE_TRANSGENESIS',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'extracellular-fluid-at-risk-of-freezing', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence', 'trehalose-metabolism'],
  },
  {
    id: 'astyanax-mexicanus',
    latin: 'Astyanax mexicanus',
    clade: 'bony fish',
    why_a_plausible_base: 'Two interfertile morphs of one species, one with eyes and one without, which makes it the rare host where a loss phenotype can be studied against its own sighted control rather than against another species. Transgenesis is published with stability demonstrated to F3 (Elipot 2014). Transmission is low: about 40% mosaic F0, 16% F1 transmission.',
    germline_citation: 'elipot_2014',
    assembly: { accession: 'GCF_023375975.1', organism_returned: 'Astyanax mexicanus', assembly_name_returned: 'AstMex3_surface', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07; returned refseq_category "reference genome". Note the reference assembly is from the SURFACE morph, so a cave-morph design reads its reference from the morph it is not using.' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Time to first spawning for each morph separately, since the comparison between morphs is the point and a pooled figure would hide a difference.'),
    knock_in_published: { value: null, null_reason: 'Elipot 2014 reports transgene integration by meganuclease and transposase, not targeted knock-in. No knock-in paper for this species was retrieved in session.', what_would_have_to_be_measured: 'A published targeted insertion at a defined locus with germline transmission.' },
    tractability: 'ESTABLISHED_NOT_ROUTINE',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'extracellular-fluid-at-risk-of-freezing', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence', 'trehalose-metabolism'],
    morph_caveat: 'The surface morph has an image-forming eye; the cave morphs do not. `has` here describes the surface morph, which is the reference assembly\'s morph. Any request about eyes must name the morph, and a request to give the cave morph eye regression is a request to give it something it has.',
  },
  {
    id: 'nothobranchius-furzeri',
    latin: 'Nothobranchius furzeri',
    clade: 'bony fish',
    why_a_plausible_base: 'The fastest-maturing vertebrate measured: sexual maturity within 14 days of hatching in the wild, growing from 5 mm to 54 mm in two weeks (Vrtilek 2018). A genome and a CRISPR toolkit exist with stable lines in 2-3 months (Harel 2015). For any design that needs generations rather than individuals - selection, suppression, a cross - this is the host where the clock is cheapest, and it is the only host in this table whose generation time is a number this module actually retrieved.',
    germline_citation: 'harel_2015',
    assembly: { accession: 'GCF_001465895.1', organism_returned: 'Nothobranchius furzeri', assembly_name_returned: 'Nfu_20140520', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07' },
    generation_time: {
      value: 14, units: 'days from hatching to sexual maturity',
      source: 'vrtilek_2018',
      measured_in: 'wild populations in Mozambique, aged by daily otolith increments with gonad histology',
      verified_how: 'Retrieved from the abstract of PMID 30086311 through the PubMed MCP metadata tool; the abstract states maturity within 14 days after hatching and calls it the fastest rate of sexual maturation recorded for a vertebrate.',
      not_the_same_as: 'This is time to maturity in the WILD, which the authors note is faster than the captive rate - so it is a lower bound on a laboratory generation interval, not the laboratory interval itself.',
    },
    knock_in_published: { value: null, null_reason: 'Harel 2015 reports mutation of many genes and stable mutant lines; a targeted knock-in in this species was not retrieved in session.', what_would_have_to_be_measured: 'A published targeted insertion at a defined locus with germline transmission.' },
    tractability: 'ESTABLISHED_NOT_ROUTINE',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'extracellular-fluid-at-risk-of-freezing', 'embryonic-arrest-competence', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'trehalose-metabolism'],
  },
  {
    id: 'sus-scrofa',
    latin: 'Sus scrofa',
    clade: 'mammal',
    why_a_plausible_base: 'A germline route has existed since 1985 (Hammer 1985) and this is the one host in this table with a published, phenotyped knock-in of a capability the species had lost: UCP1 reconstituted at the endogenous locus, with fat deposition down 4.89% and improved defence of body temperature in acute cold (Zheng 2017). That makes it the worked example for the whole exercise, and also the warning: the same paper reports no change in physical activity or total daily energy expenditure, so the thermal phenotype arrived and the energetic one did not.',
    germline_citation: 'hammer_1985',
    assembly: { accession: 'GCF_054392235.1', organism_returned: 'Sus scrofa', assembly_name_returned: 'Sscrofa_HxYL_maternal_Yorkshire_Landrace_v2.0', level: 'Chromosome', verified_how: 'live NCBI datasets taxon query, 2026-11-07, returning refseq_category "reference genome". The accession first guessed for this species, GCF_000003025.6 (Sscrofa11.1), returned an EMPTY report from the accession endpoint on that date and is not used.' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Age at first farrowing for a named breed under stated husbandry.'),
    knock_in_published: { value: true, what: 'mouse adiponectin-UCP1 inserted into the porcine endogenous UCP1 locus', source: 'zheng_2017', verified_how: 'Retrieved from the abstract of PMID 29078316; the construct, the insertion strategy and the measured outcomes are stated there.' },
    tractability: 'ESTABLISHED_NOT_ROUTINE',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'extracellular-fluid-at-risk-of-freezing', 'embryonic-arrest-competence', 'trehalose-metabolism'],
    lacks_specific_gene: ['UCP1'],
    lacks_specific_gene_source: 'zheng_2017',
  },
  {
    id: 'bos-taurus',
    latin: 'Bos taurus',
    clade: 'mammal',
    why_a_plausible_base: 'A germline route is published, and its yield is the honest argument against using this host for anything exploratory: 21 pregnancies produced 19 calves and integration in 2 (Krimpenfort 1991). It is in this table mainly because it is the host most often ASKED about - methane - and the request that arrives is the one this module refuses.',
    germline_citation: 'krimpenfort_1991',
    assembly: { accession: 'GCF_002263795.3', organism_returned: 'Bos taurus', assembly_name_returned: 'ARS-UCD2.0', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07, returning refseq_category "reference genome". The assembly name was guessed as an ARS-UCD1.x and the API returned ARS-UCD2.0; the returned string is what is recorded.' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Age at first calving for a named breed under stated management.'),
    knock_in_published: { value: null, null_reason: 'Krimpenfort 1991, the source retrieved here, reports random integration by microinjection, not a targeted knock-in. No cattle knock-in paper was retrieved in session, and published examples are believed to exist - which is a reason to go and get one, not a reason to write true here.', what_would_have_to_be_measured: 'A published targeted insertion at a defined bovine locus with germline transmission.' },
    tractability: 'ESTABLISHED_NOT_ROUTINE',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'forestomach-fermentation-chamber', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['extracellular-fluid-at-risk-of-freezing', 'embryonic-arrest-competence', 'trehalose-metabolism'],
  },
  {
    id: 'saccharomyces-cerevisiae',
    latin: 'Saccharomyces cerevisiae',
    clade: 'microbe',
    why_a_plausible_base: 'Transformation with stable chromosomal integration behaving as a Mendelian element has been available since 1978 (Hinnen 1978), and it is the only host here where a cross-kingdom functional test is cheap: Kachroo 2015 ran 414 of them. As a base for animal physiology it is almost entirely inadmissible, and that is why it is in the table - a space with no inadmissible hosts in it is not describing the problem.',
    germline_citation: 'hinnen_1978',
    assembly: { accession: 'GCF_000146045.2', organism_returned: 'Saccharomyces cerevisiae S288C', assembly_name_returned: 'R64', level: 'Complete Genome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No doubling-time measurement was retrieved in session for this organism.',
      'Doubling time on a stated carbon source at a stated temperature; "generation time" for a unicellular organism is a growth-condition measurement, not a species constant.'),
    knock_in_published: { value: true, what: 'one-step targeted integration at a chosen locus is the standard method in this organism', source: 'hinnen_1978', verified_how: 'Hinnen 1978, retrieved here, demonstrates integration into the yeast chromosomes including at the leu2 region; the modern one-step methods are not separately cited.' },
    tractability: 'ROUTINE_TRANSGENESIS',
    has: ['nucleated-cells-with-chromatin', 'trehalose-metabolism'],
    lacks: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'forestomach-fermentation-chamber', 'extracellular-fluid-at-risk-of-freezing', 'embryonic-arrest-competence', 'secretory-epithelium-for-export'],
  },
  {
    id: 'xenopus-tropicalis',
    latin: 'Xenopus tropicalis',
    clade: 'amphibian',
    why_a_plausible_base: 'A diploid amphibian with a line-generating transgenesis route that yields single-copy integrations rather than tandem concatemers (Ishibashi 2012), and embryos large enough for surgery and explant work that is impractical in fish. It is the only amphibian in this table, and the only host that is neither a fish, a mammal, an insect, a nematode nor a microbe.',
    germline_citation: 'ishibashi_2012',
    assembly: { accession: 'GCF_000004195.4', organism_returned: 'Xenopus tropicalis', assembly_name_returned: 'UCB_Xtro_10.0', level: 'Chromosome', verified_how: 'live NCBI datasets accession fetch, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Time from fertilisation to first fertile spawning at a stated temperature; this is the figure that decides whether a two-generation experiment is possible.'),
    knock_in_published: { value: null, null_reason: 'Ishibashi 2012 reports meganuclease-mediated integration, not targeted knock-in. No knock-in paper for this species was retrieved in session.', what_would_have_to_be_measured: 'A published targeted insertion at a defined locus with germline transmission.' },
    tractability: 'ESTABLISHED_NOT_ROUTINE',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence', 'trehalose-metabolism', 'extracellular-fluid-at-risk-of-freezing'],
  },
  {
    id: 'anolis-sagrei',
    latin: 'Anolis sagrei',
    clade: 'squamate reptile',
    why_a_plausible_base: 'The only squamate with germline gene editing: microinjection of immature oocytes within the ovary, with monoallelic and biallelic F0 mutants transmitted through the germline to establish strains (Rasys 2019). That paper states plainly that before it there were no reptiles with effective targeted mutagenesis, which is why this host sits at PUBLISHED_ONCE and why every admissible verdict against it carries a prerequisite rather than a green light.',
    germline_citation: 'rasys_2019',
    assembly: { accession: 'GCF_037176765.1', organism_returned: 'Anolis sagrei', assembly_name_returned: 'rAnoSag1.mat', level: 'Chromosome', verified_how: 'live NCBI datasets taxon query, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Hatch-to-first-clutch time under stated husbandry. For a host whose transgenesis is published once, this figure decides whether a line can be maintained at all.'),
    knock_in_published: { value: null, null_reason: 'Rasys 2019 reports targeted mutagenesis with germline transmission, not a knock-in. No knock-in in any squamate was retrieved in session.', what_would_have_to_be_measured: 'A published targeted insertion at a defined locus in a squamate with germline transmission.' },
    tractability: 'PUBLISHED_ONCE',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence', 'trehalose-metabolism', 'extracellular-fluid-at-risk-of-freezing'],
  },
  {
    id: 'chaenocephalus-aceratus',
    latin: 'Chaenocephalus aceratus',
    clade: 'bony fish',
    why_a_plausible_base: 'It is not one, and that is the point of including it. This is the organism that HAS several of the capabilities below - the only vertebrates without functional haemoglobin genes or red cells, with expanded antifreeze glycoprotein and zona pellucida gene families (Kim 2019) - and it is unavailable as a base. There is no published germline route and no closed life cycle in captivity. A space that lists only tractable hosts quietly implies the interesting organisms are available.',
    germline_citation: null,
    germline_status: 'No published germline transformation or editing method was retrieved for this species, or for any channichthyid, in this session. The deeper obstacle is husbandry: the animals are collected, not bred.',
    assembly: { accession: 'GCA_023974075.1', organism_returned: 'Chaenocephalus aceratus', assembly_name_returned: 'KU_Ca_2.0', level: 'Chromosome', verified_how: 'live NCBI datasets taxon query then accession re-fetch, 2026-11-07; returned refseq_category "reference genome". This is a GCA (GenBank) accession, not a GCF: there is no RefSeq annotation release for it in the report returned, which is itself a usable fact about how much downstream tooling will work.' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session, and for an animal that has not been bred in captivity the figure may not exist.',
      'Age at first reproduction from a wild population, aged by a validated method - which for this group would be the measurement, not a lookup.'),
    knock_in_published: { value: false, what: 'no germline modification of any kind has been published in this species', source: null, verified_how: 'Recorded as false on the basis that no such paper was found in the PubMed searches run here; this is an argument from absence of search result and is weaker than the other entries in this column.' },
    tractability: 'NO_GERMLINE_METHOD',
    has: ['skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'extracellular-fluid-at-risk-of-freezing', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['haemoglobin-oxygen-carriage', 'forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence', 'trehalose-metabolism'],
    lacks_source: 'kim_2019',
  },
  {
    id: 'carassius-carassius',
    latin: 'Carassius carassius',
    clade: 'bony fish',
    why_a_plausible_base: 'Also not one. It is the donor for ethanolic anoxia tolerance (Fagernes 2017) and has a chromosome-level reference assembly, but no published germline route was retrieved. It is here as the second inadmissible host, so that NO_GERMLINE_METHOD is not represented by a single species whose removal would make the category disappear.',
    germline_citation: null,
    germline_status: 'No published germline transformation or editing method was retrieved for this species in this session. Note that its congener the goldfish, which shares the ethanol pathway per Fagernes 2017, is a different species and no claim is made here about routes into it.',
    assembly: { accession: 'GCF_963082965.1', organism_returned: 'Carassius carassius', assembly_name_returned: 'fCarCar2.1', level: 'Chromosome', verified_how: 'live NCBI datasets taxon query, 2026-11-07; returned refseq_category "reference genome"' },
    generation_time: unretrieved(
      'No generation-time measurement was retrieved in session for this species.',
      'Age at first spawning in a stated population; this species is also strongly phenotypically plastic, so a single figure would need the rearing density stated.'),
    knock_in_published: { value: false, what: 'no germline modification of this species was found', source: null, verified_how: 'Recorded as false on the basis that no such paper was found in the PubMed searches run here; an argument from absence of search result.' },
    tractability: 'NO_GERMLINE_METHOD',
    has: ['haemoglobin-oxygen-carriage', 'skeletal-muscle-myoglobin', 'myogenic-excitable-organ-substrate', 'image-forming-eye', 'ciliary-opsin-photoreceptor', 'voltage-gated-sodium-channel-nav', 'extracellular-fluid-at-risk-of-freezing', 'nucleated-cells-with-chromatin', 'secretory-epithelium-for-export'],
    lacks: ['forestomach-fermentation-chamber', 'brown-adipose-or-adipose-depot', 'endothermic-thermoregulation', 'embryonic-arrest-competence'],
  },
]);

export const HOST_IDS = deepFreeze(HOSTS.map(h => h.id));
export const hostById = id => HOSTS.find(h => h.id === id) ?? null;

// =====================================================================================================
// 4. FUNCTIONS
// =====================================================================================================
//
// `genetic_basis.firmness` is a four-term closed vocabulary. It is a statement about the EVIDENCE for
// the causal claim, not about how interesting the biology is:
//
//   DEMONSTRATED_BY_TRANSFER  the change has been made and the phenotype followed
//   CAUSAL_VARIANTS_IDENTIFIED  specific variants are known and functionally tested in vitro
//   ARCHITECTURE_KNOWN_VARIANTS_NOT  the shape of the genetics is known; the causal variants are not
//   CORRELATIVE_ONLY  association, expression or comparative pattern, with no causal test

export const BASIS_FIRMNESS = deepFreeze(['DEMONSTRATED_BY_TRANSFER', 'CAUSAL_VARIANTS_IDENTIFIED', 'ARCHITECTURE_KNOWN_VARIANTS_NOT', 'CORRELATIVE_ONLY']);

export const FUNCTIONS = deepFreeze([
  {
    id: 'afgp-notothenioid',
    label: 'antifreeze glycoprotein, notothenioid origin',
    what_it_is: 'A glycotripeptide polymer secreted into the body fluids, which binds to nascent ice crystals and arrests their growth, so that the animal remains unfrozen in water below the colligative freezing point of its blood.',
    donor_lineage: 'Antarctic notothenioid fishes (bony fishes)',
    genetic_basis: {
      summary: 'A family of polyprotein genes, each encoding multiple AFGP molecules in tandem separated by small cleavable spacers, derived from a pancreatic trypsinogen (Chen 1997). The gene family is highly expanded in the channichthyid genome (Kim 2019).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['chen_1997', 'kim_2019'],
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    requires_host_systems: ['extracellular-fluid-at-risk-of-freezing', 'secretory-epithelium-for-export'],
    already_present_in: ['chaenocephalus-aceratus'],
    hazard: 'Dose and localisation are the whole phenotype: an ice-binding protein at insufficient concentration does not partially protect, and in the wrong compartment it does nothing. Expression is the easy half.',
  },
  {
    id: 'afgp-gadid',
    label: 'antifreeze glycoprotein, gadid origin (the independent one)',
    what_it_is: 'The same chemistry and the same job as the notothenioid protein, in an unrelated lineage - near-identical glycotripeptide polymers arrived at by a different genomic route.',
    donor_lineage: 'northern gadid fishes (bony fishes)',
    genetic_basis: {
      summary: 'De novo from non-coding sequence: a nine-nucleotide element supplied one Thr-Ala-Ala unit, tandem duplication built the repetitive coding sequence, a 1-nt frameshift joined it to latent signal-peptide exons in one read-through ORF, and a translocation supplied the promoter. All genic components were shown experimentally to come from entirely non-genic DNA (Zhuang 2019). The two origins are independent: different intron-exon organisation, different spacers, drastically different repeat coding sequences, and no trypsinogen ancestry on the gadid side (Chen 1997).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['zhuang_2019', 'chen_1997'],
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    requires_host_systems: ['extracellular-fluid-at-risk-of-freezing', 'secretory-epithelium-for-export'],
    already_present_in: [],
    hazard: 'The same dose-and-compartment problem as the notothenioid protein, plus one the independence creates: the two proteins are chemically near-identical and genomically unrelated, so a design that reaches for "the AFGP gene" has two different constructs to choose between, with different codon composition, different signal peptides and different repeat lengths, and no basis in the function for preferring either.',
    why_it_is_listed_separately: 'Because an orthology search cannot see it. These two genes have zero orthology to each other and are the strongest functional analogues in this table - the case analogues/analogy.mjs classifies as convergent-analogue. Listing one AFGP would make the space look like it had one solution to this problem when it has two, built from different parts, with different things that can go wrong.',
  },
  {
    id: 'ethanolic-anoxia-tolerance',
    label: 'ethanol-producing anoxia tolerance',
    what_it_is: 'Survival of days to months without oxygen by running glycolysis to ethanol instead of lactate, and excreting the ethanol across the gills - which removes the end-product rather than accumulating an acid load.',
    donor_lineage: 'Carassius fishes (bony fishes)',
    genetic_basis: {
      summary: 'Whole-genome duplication supplied extra copies of the pyruvate dehydrogenase multienzyme complex; some copies neofunctionalised into a pyruvate decarboxylase - analogous to the yeast enzyme and the first described in a vertebrate - while others retained the parent function, alongside a specialised alcohol dehydrogenase (Fagernes 2017).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['fagernes_2017'],
    },
    mechanism_class: 'PATHWAY_IMPORT',
    requires_host_systems: ['skeletal-muscle-myoglobin'],
    already_present_in: ['carassius-carassius'],
    hazard: 'Fagernes 2017 states that the key molecular substitution in the duplicated pyruvate dehydrogenase genes is HIGHLY DELETERIOUS IN HUMANS. The donor tolerates it because the substitution sits in a duplicate while the parent copies keep doing the essential job. Importing the substitution without the duplication is importing the disease allele, and that distinction is the whole design.',
  },
  {
    id: 'rhodopsin-spectral-tuning',
    label: 'rhodopsin spectral tuning',
    what_it_is: 'Shifting the wavelength of peak absorbance of the rod visual pigment, so that vision is matched to the light that is actually present - blue-shifted for deep water, where the surviving light is narrow and short.',
    donor_lineage: 'deep-water cichlids and many other fishes (bony fishes)',
    genetic_basis: {
      summary: 'Two amino acid replacements in RH1 account for the blue shift in nine species; reconstructed pigments from 28 sequences out of 233 individuals sequenced; the replacement A292S arose several times independently with the same functional effect (Sugawara 2005).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['sugawara_2005'],
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    vocabulary_caveat: 'This is an allele swap in a gene the host already has, not an addition. MECHANISM_CLASSES has no term for that, so it is filed under SINGLE_GENE_ADDITION on the grounds that it is one locus and the host supplies the substrate. See the note in MECHANISM_CLASSES.',
    requires_host_systems: ['ciliary-opsin-photoreceptor'],
    already_present_in: [],
    hazard: 'A spectral shift is measured on reconstituted pigment in a cuvette. Whether a shifted pigment improves behaviour depends on the retina around it, the lens transmittance in front of it, and the light the animal lives in - none of which the substitution changes.',
  },
  {
    id: 'ttx-resistance',
    label: 'tetrodotoxin resistance',
    what_it_is: 'A skeletal muscle sodium channel that keeps conducting in the presence of a guanidinium toxin that blocks the ancestral channel at nanomolar concentrations, so the animal can eat toxic prey.',
    donor_lineage: 'Thamnophis sirtalis (squamate reptiles)',
    genetic_basis: {
      summary: 'Substitutions in the outer pore of the skeletal muscle sodium channel. Resistance in two independent lineages began with the same I1561V change; the larger-effect pore mutations accumulate later and always occur together with it; the most extreme phenotype is determined by four critical substitutions (Hague 2017).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['hague_2017', 'hague_2018'],
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    vocabulary_caveat: 'Again an allele swap rather than an addition: four substitutions in one gene the host already carries.',
    requires_host_systems: ['voltage-gated-sodium-channel-nav', 'skeletal-muscle-myoglobin'],
    already_present_in: [],
    hazard: 'The trade-off is measured, not hypothetical. Snakes homozygous for the large-effect allele had significantly reduced crawl speed, and heterologous expression showed a correlated decrease in overall channel excitability (Hague 2018). The resistance and the cost are the same substitution, so this is not an engineering problem to be optimised away.',
  },
  {
    id: 'electric-organ',
    label: 'myogenic electric organ',
    what_it_is: 'A tissue of large, non-contractile, polarised cells derived from muscle, whose synchronised discharge projects an electric field into the water for communication, navigation, predation or defence.',
    donor_lineage: 'electric fishes - gymnotiforms and others (bony fishes); electric rays also have one (cartilaginous fishes)',
    genetic_basis: {
      summary: 'Independently evolved six times in fishes, and the independent lineages leveraged SIMILAR transcription factors and developmental and cellular pathways despite large differences in electrocyte morphology (Gallant 2014). The shared machinery is a transcriptional programme, not a gene to add.',
      firmness: 'ARCHITECTURE_KNOWN_VARIANTS_NOT',
      sources: ['gallant_2014'],
    },
    mechanism_class: 'REGULATORY_REWIRING',
    requires_host_systems: ['myogenic-excitable-organ-substrate', 'voltage-gated-sodium-channel-nav'],
    already_present_in: [],
    hazard: 'Six independent origins is the encouraging fact and the discouraging one at once: the route is evidently reachable from a muscle substrate, and no lineage got there by acquiring a gene. The design question is which regulators, in what order, in what tissue - and Gallant 2014 identifies the shared pathways without identifying an edit.',
  },
  {
    id: 'myoglobin-dive-capacity',
    label: 'myoglobin-based dive capacity',
    what_it_is: 'Extended breath-hold endurance supported by a large muscle oxygen store, which requires myoglobin at concentrations far above the mammalian norm without the protein aggregating.',
    donor_lineage: 'diving mammals',
    genetic_basis: {
      summary: 'Elevated myoglobin NET SURFACE CHARGE is an adaptive molecular signature in diving species, traced by ancestral reconstruction across a 130-species mammalian phylogeny, and is mechanistically linked with maximal myoglobin concentration (Mirceta 2013). Net surface charge is a property of many residues at once, and it sits on top of muscle mass, blood volume, buffering capacity and the dive response.',
      firmness: 'ARCHITECTURE_KNOWN_VARIANTS_NOT',
      sources: ['mirceta_2013'],
    },
    mechanism_class: 'POLYGENIC_QUANTITATIVE',
    requires_host_systems: ['skeletal-muscle-myoglobin', 'haemoglobin-oxygen-carriage'],
    already_present_in: [],
    hazard: 'This is the capability most often requested as a single edit and least capable of being one. "Raise the net surface charge of myoglobin" is a direction in a high-dimensional sequence space, not an allele, and the phenotype it supports is a whole-organism physiology.',
  },
  {
    id: 'ucp1-thermogenesis',
    label: 'functional UCP1 non-shivering thermogenesis',
    what_it_is: 'Heat generated by uncoupling proton transit across the inner mitochondrial membrane from ATP synthesis, giving defence of body temperature in the cold without shivering.',
    donor_lineage: 'mammals with a functional UCP1 gene',
    genetic_basis: {
      summary: 'One gene at one locus, and the only capability in this table whose transfer has been done and phenotyped: mouse adiponectin-UCP1 inserted into the porcine endogenous locus gave improved defence of body temperature in acute cold and decreased fat deposition by 4.89% (P < 0.01) with increased carcass lean percentage (P < 0.05) - and no change in physical activity or total daily energy expenditure (Zheng 2017). Pigs lack a functional UCP1 gene, which is the absence the experiment filled.',
      firmness: 'DEMONSTRATED_BY_TRANSFER',
      sources: ['zheng_2017'],
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    requires_host_systems: ['brown-adipose-or-adipose-depot', 'endothermic-thermoregulation'],
    already_present_in: ['mus-musculus', 'bos-taurus'],
    requires_host_to_lack_gene: 'UCP1',
    hazard: 'The worked example also shows what a successful transfer does not buy. The thermal phenotype appeared; the energetic phenotype, measured as total daily energy expenditure, did not move. A design that assumed uncoupling protein means raised energy expenditure would have been contradicted by its own success.',
  },
  {
    id: 'haemoglobin-loss',
    label: 'loss of haemoglobin and red cells',
    what_it_is: 'Oxygen carried in physical solution in the plasma rather than bound to a pigment, with no red cells - viable only in cold, oxygen-rich water and at the cost of a greatly enlarged heart and blood volume.',
    donor_lineage: 'channichthyid icefishes (bony fishes)',
    genetic_basis: {
      summary: 'The icefishes are the only vertebrates that lack functional haemoglobin genes and red blood cells (Kim 2019). As an edit it is a deletion, and it presupposes that the host has the genes to delete.',
      firmness: 'ARCHITECTURE_KNOWN_VARIANTS_NOT',
      sources: ['kim_2019'],
    },
    mechanism_class: 'GENE_LOSS',
    requires_host_systems: ['haemoglobin-oxygen-carriage'],
    already_present_in: ['chaenocephalus-aceratus'],
    hazard: 'The loss is survivable only inside an environment and a cardiovascular remodelling that came with it. Deleting the genes in a temperate host at normal temperature is not a reduced version of the phenotype; it is anaemia.',
  },
  {
    id: 'eye-regression',
    label: 'eye regression',
    what_it_is: 'Progressive developmental loss of the image-forming eye in a lineage whose ancestors had one - the eye forms and then degenerates, rather than never being specified.',
    donor_lineage: 'cave morphs of Astyanax mexicanus (bony fishes)',
    genetic_basis: {
      summary: unretrieved(
        'The literature attributes cave-morph eye loss to expanded midline signalling causing lens apoptosis, under polygenic control with multiple contributing loci. No primary source for that mechanism was retrieved in this session, so neither the gene nor the number of loci is asserted here.',
        'The mapped loci with their effect sizes, in one cross, with the lens-apoptosis mechanism tested by manipulation rather than inferred from expression.').null_reason,
      what_would_make_it_firm: 'Mapped loci with effect sizes from a single cross, plus a manipulation that reproduces the degeneration in the surface morph and rescues it in the cave morph.',
      firmness: 'CORRELATIVE_ONLY',
      sources: [],
      source_note: 'Deliberately empty. The mechanism is well known in the field and was not verified here, and an unverified citation is worse than none.',
    },
    mechanism_class: 'POLYGENIC_QUANTITATIVE',
    requires_host_systems: ['image-forming-eye'],
    already_present_in: [],
    hazard: 'An eye that has degenerated is not an eye that was never built, and the two are reached by different genetics. A request for "no eyes" that is satisfied by failing to specify the eye has produced a different animal from the one the donor is.',
  },
  {
    id: 'embryonic-diapause',
    label: 'embryonic diapause',
    what_it_is: 'A reversible arrest of development at a defined embryonic stage, held for far longer than the active embryonic period, from which development resumes without apparent cost.',
    donor_lineage: 'annual killifishes (bony fishes)',
    genetic_basis: {
      summary: 'An ACTIVE state, not a passive arrest: Polycomb complex members are among the most up-regulated genes, H3K27me3 is maintained at key developmental genes, CBX7 mediates repression of metabolism and muscle genes, and CBX7 is functionally required for muscle preservation and diapause maintenance. Diapause preserved the organism without trade-offs for subsequent adult growth, fertility or life span (Hu 2020).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['hu_2020'],
    },
    mechanism_class: 'REGULATORY_REWIRING',
    requires_host_systems: ['embryonic-arrest-competence', 'nucleated-cells-with-chromatin'],
    already_present_in: ['nothobranchius-furzeri'],
    hazard: 'The CBX7 result is a REQUIREMENT, shown by loss. Requirement is not sufficiency: expressing CBX7 in an embryo with no arrest competence gives a repressed transcriptome, not a diapause.',
  },
  {
    id: 'dsup-radioprotection',
    label: 'Dsup-mediated radioprotection',
    what_it_is: 'A chromatin-associating protein that reduces the DNA damage a given dose of ionising radiation inflicts, rather than repairing damage after the fact.',
    donor_lineage: 'Ramazzottius varieornatus, a tardigrade',
    genetic_basis: {
      summary: 'A single tardigrade-unique DNA-associating protein suppressed X-ray-induced DNA damage by about 40% and improved radiotolerance when expressed in human cultured cells (Hashimoto 2016). One gene, one measured effect.',
      firmness: 'DEMONSTRATED_BY_TRANSFER',
      sources: ['hashimoto_2016'],
      transfer_caveat: 'The transfer was into HUMAN CULTURED CELLS, not into a whole animal. "Demonstrated by transfer" here means the gene moved and the effect followed in cells; a whole-organism radiotolerance phenotype in any host is a different claim and was not retrieved.',
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    requires_host_systems: ['nucleated-cells-with-chromatin'],
    already_present_in: [],
    hazard: 'A protein that coats DNA to shield it is a protein that sits between DNA and everything that reads DNA. The cultured-cell result is about damage after a dose; it says nothing about development, replication timing or transcription in an organism that has to grow.',
  },
  {
    id: 'bioluminescence-by-foreign-addition',
    label: 'light emission by foreign addition (reporter case)',
    what_it_is: 'Visible light from an animal that has no such capability, by adding a foreign protein - the simplest possible case of moving a capability between lineages, and the reason it is in this table.',
    donor_lineage: 'fluorescent proteins from marine invertebrates; luciferases from insects and microbes',
    genetic_basis: {
      summary: 'One transgene. Stable transgenic fish lines expressing a foreign fluorescent protein under a heterologous promoter show detectable whole-body fluorescence, with the detection threshold calibrated against purified protein (Amsterdam 1996).',
      firmness: 'DEMONSTRATED_BY_TRANSFER',
      sources: ['amsterdam_1996'],
    },
    mechanism_class: 'SINGLE_GENE_ADDITION',
    requires_host_systems: ['nucleated-cells-with-chromatin'],
    already_present_in: [],
    naming_correction: 'A fluorescent protein is not bioluminescence. Fluorescence re-emits absorbed light and needs an excitation source; bioluminescence generates light chemically from a luciferase and its substrate. The two are routinely collapsed under "glowing", and the collapse matters here because the luciferase case needs the SUBSTRATE supplied or synthesised and the fluorescence case does not. The verified transfer below is the fluorescence case.',
    hazard: 'This is the easy case and it is in the table as a calibration: if a space says this is as hard as importing a metabolic pathway, the space is not measuring anything.',
  },
  {
    id: 'rumen-methane-output',
    label: 'enteric methane output',
    what_it_is: 'Methane produced by anaerobic fermentation in a pre-gastric chamber and released by the animal - a trait of the animal in the sense that the animal emits it, and of the microbial community in the sense that the community makes it.',
    donor_lineage: 'not a donor trait: this is a trait of the associated microbial community of a ruminant host',
    genetic_basis: {
      summary: 'Difford 2018: the cumulative effect of all measured bacteria and archaea on methane production was 13%, host genetic heritability was 21%, and the two were largely independent - the authors state that methane variation is likely NOT modulated through host genetic effects on the rumen microbiome, and that the genome and the microbiome could be targeted independently. Zhang 2020, on 750 cows with a Bayesian model: host genetics 24%, microbiota 7%, one bacterial genus up to 1.6% of total microbiota variance; the highest taxon heritability estimates were 33%, 26% and 41%, and after multiple-testing correction NONE remained significant.',
      firmness: 'CORRELATIVE_ONLY',
      sources: ['difford_2018', 'zhang_2020'],
      why_correlative: 'Both studies are variance decompositions in observational herds. A variance component is not a causal pathway, and the non-significant taxon heritabilities in Zhang 2020 are explicitly reported as not surviving correction - which is the kind of detail that disappears when a number is quoted without its test.',
    },
    mechanism_class: 'TRAIT_OF_ASSOCIATED_MICROBIOME',
    requires_host_systems: ['forestomach-fermentation-chamber'],
    already_present_in: [],
    hazard: 'The honest reading is that there IS a host-genetic handle on emitted methane - a fifth to a quarter of the variance - and that it is not a handle on the microbial trait. Breeding lower-emitting animals and editing the methanogens are different interventions with different containment questions, and the single phrase "reduce methane in cattle" covers both. This module refuses the request as an edit to the animal genome and names the two projects it could be instead.',
  },
  {
    id: 'anhydrobiosis-desiccation-tolerance',
    label: 'anhydrobiosis (desiccation tolerance)',
    what_it_is: 'Survival of the loss of almost all body water, in a quiescent state, with resumption of life on rehydration.',
    donor_lineage: 'Polypedilum vanderplanki, a chironomid midge (insects); also tardigrades and some nematodes',
    genetic_basis: {
      summary: 'A coordinated multi-gene programme: antioxidants, late embryogenesis abundant proteins and heat shock proteins up-regulated, with trehalose metabolism genes and transporters strongly induced (Cornette 2010, from 15,056 ESTs in 4,807 clusters). The regulation has been identified and tested: a heat-shock-factor-like motif is enriched in the promoters of desiccation-induced genes and absent from the equivalent promoters of a desiccation-sensitive congener, and Hsf knockdown reduced the desiccation survival of a cell line from this species FIVEFOLD (Mazin 2018).',
      firmness: 'CAUSAL_VARIANTS_IDENTIFIED',
      sources: ['cornette_2010', 'mazin_2018'],
    },
    mechanism_class: 'PATHWAY_IMPORT',
    requires_host_systems: ['trehalose-metabolism', 'nucleated-cells-with-chromatin'],
    already_present_in: [],
    hazard: 'The fivefold knockdown result is a demonstration that the regulator is REQUIRED in the donor. Transferring a transcription factor into a host with none of the target genes transfers nothing, and transferring the target genes without the trehalose flux to vitrify around them transfers a cost.',
  },
  {
    id: 'ice-barrier-structural-proteins',
    label: 'extracellular ice-barrier structural material',
    what_it_is: 'Structural proteins deposited in an extracellular envelope that physically impede ice propagation into the organism, as distinct from a soluble protein that binds ice crystal faces.',
    donor_lineage: 'channichthyid icefishes (bony fishes)',
    genetic_basis: {
      summary: 'Kim 2019 reports that genes involved in protection from ice damage, including antifreeze glycoprotein AND zona pellucida proteins, are highly expanded in the icefish genome. The zona pellucida expansion is the structural half; the functional attribution rests on the expansion and its context, not on a manipulation.',
      firmness: 'CORRELATIVE_ONLY',
      sources: ['kim_2019'],
      why_correlative: 'A gene family expansion in a cold-adapted genome is an association. The protective function of the expanded zona pellucida proteins was not demonstrated by manipulation in the source retrieved here.',
    },
    mechanism_class: 'STRUCTURAL_MATERIAL',
    requires_host_systems: ['secretory-epithelium-for-export', 'extracellular-fluid-at-risk-of-freezing'],
    already_present_in: ['chaenocephalus-aceratus'],
    hazard: 'A structural material\'s function is in its deposition: how much, where, in what order, assembled against what. Expressing the gene produces protein, and protein is not an envelope. This is the mechanism class where "the gene is expressed" is furthest from "the capability is present".',
  },
]);

export const FUNCTION_IDS = deepFreeze(FUNCTIONS.map(f => f.id));
export const functionById = id => FUNCTIONS.find(f => f.id === id) ?? null;

// =====================================================================================================
// 5. THE VERDICT CLASSES
// =====================================================================================================

export const VERDICT_CLASSES = deepFreeze({
  ADMISSIBLE_SINGLE_LOCUS: {
    id: 'ADMISSIBLE_SINGLE_LOCUS',
    admissible: true,
    means: 'the request names one locus, the host has the system the edit acts on, and a germline route into the host is published and routine or established. The request is well formed',
    and_does_not_mean: 'that it will work. Kachroo 2015 found 47% of 414 single-gene human-for-yeast replacements could do the job, under the most favourable conditions anyone has arranged. Admissible is a statement about the sentence, not a prediction about the bench',
  },
  ADMISSIBLE_PENDING_PREREQUISITE: {
    id: 'ADMISSIBLE_PENDING_PREREQUISITE',
    admissible: true,
    means: 'the request is well formed and nothing structural refuses it, but something named has to exist first: a germline method that has been published once rather than adopted, or a multi-locus target set that has not been enumerated',
    and_does_not_mean: 'that the prerequisite is a formality. A method published once is a method one laboratory has; an unenumerated target set is a research programme standing in for an edit',
  },
  REFUSED_NO_GERMLINE_ROUTE: {
    id: 'REFUSED_NO_GERMLINE_ROUTE',
    admissible: false,
    is_refusal: true,
    means: 'no published route into this host\'s germline. Nothing downstream of that fact can be attempted, whatever the request',
    about: 'the host',
  },
  REFUSED_WRONG_GENOME: {
    id: 'REFUSED_WRONG_GENOME',
    admissible: false,
    is_refusal: true,
    means: 'the capability belongs to an associated microbial community rather than to the animal\'s own cells, and is being requested as an edit to the animal genome. No such edit exists, because the trait is not encoded there',
    about: 'the request',
  },
  REFUSED_NO_GENE_TO_LOSE: {
    id: 'REFUSED_NO_GENE_TO_LOSE',
    admissible: false,
    is_refusal: true,
    means: 'a gene-loss capability is being requested of a host whose lineage never had the system being lost. A deletion presupposes a possession',
    about: 'the pairing',
  },
  REFUSED_NO_SUBSTRATE: {
    id: 'REFUSED_NO_SUBSTRATE',
    admissible: false,
    is_refusal: true,
    means: 'the host lacks an organ, tissue, cell type or metabolic capacity that the capability acts on or through. The edit would be made into nothing',
    about: 'the pairing',
  },
  REFUSED_POLYGENIC_AS_SINGLE_EDIT: {
    id: 'REFUSED_POLYGENIC_AS_SINGLE_EDIT',
    admissible: false,
    is_refusal: true,
    means: 'the capability is a quantitative trait built from many loci whose causal variants are largely unidentified, and it has arrived as a request for an edit. There is no edit for the request to denote',
    about: 'the request',
  },
  REFUSED_ALREADY_PRESENT: {
    id: 'REFUSED_ALREADY_PRESENT',
    admissible: false,
    is_refusal: true,
    means: 'the host already has the capability. Nothing is being moved, and the request is a misreading of the host rather than a hard experiment',
    about: 'the pairing',
  },
});

export const VERDICT_CLASS_IDS = deepFreeze(Object.keys(VERDICT_CLASSES));
export const REFUSAL_CLASS_IDS = deepFreeze(VERDICT_CLASS_IDS.filter(c => VERDICT_CLASSES[c].is_refusal === true));
export const ADMISSIBLE_CLASS_IDS = deepFreeze(VERDICT_CLASS_IDS.filter(c => VERDICT_CLASSES[c].admissible === true));

/**
 * The order in which reasons are applied to produce the ONE class a verdict reports. Order matters and
 * is therefore exported, and reasons() returns every reason that applies so the precedence can be
 * audited rather than taken on trust.
 *
 * Germline route is first because it is the cheapest decisive fact and the one most often checked last:
 * if there is no way in, the shape of the request is beside the point. Then the request-level errors,
 * then the pairing-level ones, then the admissible tiers.
 */
export const ADMISSIBILITY_ORDER = deepFreeze([
  'REFUSED_NO_GERMLINE_ROUTE',
  'REFUSED_WRONG_GENOME',
  'REFUSED_ALREADY_PRESENT',
  'REFUSED_NO_GENE_TO_LOSE',
  'REFUSED_NO_SUBSTRATE',
  'REFUSED_POLYGENIC_AS_SINGLE_EDIT',
  'ADMISSIBLE_PENDING_PREREQUISITE',
  'ADMISSIBLE_SINGLE_LOCUS',
]);

// =====================================================================================================
// 6. ADMISSIBILITY
// =====================================================================================================

const resolveHost = h => (typeof h === 'string' ? hostById(h) : h);
const resolveFn = f => (typeof f === 'string' ? functionById(f) : f);

/**
 * Which host systems a function needs that the host DOES NOT HAVE, split into the three epistemic
 * states that matter. An unknown is not an absence: the C. elegans sodium-channel case is recorded as
 * unknown precisely so that it cannot be spent as a refusal.
 */
export function systemCheck(host, fn) {
  const H = resolveHost(host), F = resolveFn(fn);
  const need = F.requires_host_systems ?? [];
  const has = need.filter(s => (H.has ?? []).includes(s));
  const missing = need.filter(s => (H.lacks ?? []).includes(s));
  const unknown = need.filter(s => !(H.has ?? []).includes(s) && !(H.lacks ?? []).includes(s));
  return Object.freeze({
    required: Object.freeze(need), present: Object.freeze(has),
    asserted_absent: Object.freeze(missing), unknown: Object.freeze(unknown),
    unknown_is_not_absent: 'A system in `unknown` is one this module has not been asked about for this host. It does not license a refusal and it does not license an admission; it is reported in the verdict so the gap is visible.',
  });
}

/**
 * EVERY reason that applies to this pair, in ADMISSIBILITY_ORDER, each with its own `because`. The
 * verdict reports the first; this reports all of them, which is what makes the precedence auditable.
 */
export function reasons(host, fn) {
  const H = resolveHost(host), F = resolveFn(fn);
  if (!H) throw new Error('space.reasons: unknown host');
  if (!F) throw new Error('space.reasons: unknown function');
  const T = TRACTABILITY[H.tractability];
  const M = MECHANISM_CLASSES[F.mechanism_class];
  const sys = systemCheck(H, F);
  const out = [];

  if (T.germline_route_exists === false) {
    out.push({
      class: 'REFUSED_NO_GERMLINE_ROUTE',
      because: `${H.latin} has no published germline transformation or editing method (tractability ${H.tractability}). ${H.germline_status ?? ''}`.trim(),
      what_would_change_it: `A published germline modification in ${H.latin} with transmission to a subsequent generation demonstrated - or, before that, a closed life cycle in captivity, which is usually the actual obstacle.`,
    });
  }
  if (M.not_in_the_animal_genome === true) {
    out.push({
      class: 'REFUSED_WRONG_GENOME',
      because: `${F.label} is performed by an associated microbial community, not by ${H.latin}'s own cells, so no edit to its genome moves the trait. ${F.genetic_basis.summary}`,
      what_would_change_it: 'Splitting the request into the two projects it actually contains: a host-genetic selection or edit against the measured host-genetic share of the emitted phenotype, or an intervention on the microbial community itself. Each has its own containment question and neither is the other.',
    });
  }
  if ((F.already_present_in ?? []).includes(H.id)) {
    out.push({
      class: 'REFUSED_ALREADY_PRESENT',
      because: `${H.latin} already has ${F.label}, so nothing is being moved into it.`,
      what_would_change_it: 'Restating the request. If what is wanted is more of the capability, or it in a different tissue, or its removal, those are different requests with different mechanism classes - and if what is wanted is the capability in a different host, name that host.',
    });
  }
  if (M.presupposes_possession === true && sys.asserted_absent.length > 0) {
    out.push({
      class: 'REFUSED_NO_GENE_TO_LOSE',
      because: `${F.label} is a loss, and ${H.latin} is recorded as lacking ${sys.asserted_absent.join(', ')} - so there is nothing in this host to delete. A deletion presupposes a possession.`,
      what_would_change_it: 'Nothing about this host. The request is admissible only against a host that has the system: for this capability, see the hosts whose `has` includes it.',
    });
  }
  if (M.presupposes_possession !== true && sys.asserted_absent.length > 0) {
    out.push({
      class: 'REFUSED_NO_SUBSTRATE',
      because: `${F.label} acts on or through ${sys.asserted_absent.join(', ')}, and ${H.latin} is recorded as lacking ${sys.asserted_absent.length === 1 ? 'it' : 'them'}. The edit would be made into nothing.`,
      what_would_change_it: `Building the substrate first, which is a larger design than the one requested, or choosing a host that has it. Either way the request as written stays inadmissible against ${H.latin}.`,
    });
  }
  if (F.mechanism_class === 'POLYGENIC_QUANTITATIVE') {
    out.push({
      class: 'REFUSED_POLYGENIC_AS_SINGLE_EDIT',
      because: `${F.label} is a quantitative trait over many loci (${MECHANISM_CLASSES.POLYGENIC_QUANTITATIVE.means}), and the evidence for its genetic basis stands at ${F.genetic_basis.firmness}. A request to install it is a request for an edit that has no referent.`,
      what_would_change_it: F.genetic_basis.what_would_make_it_firm ?? 'Identified causal variants with effect sizes from a single mapping population, at which point a defined subset becomes a different, admissible request - about those variants, not about the trait.',
    });
  }
  // An ADMISSIBLE reason may be listed only when NO refusal applies. Otherwise its own `because` -
  // "the host has the systems the edit acts on", "a germline route is published" - would be a false
  // sentence sitting in the audit trail underneath a correct verdict, and the audit trail is the
  // thing this module is for. `clear` is that gate, and it is the negation of every refusal above.
  const clear = sys.asserted_absent.length === 0
    && T.germline_route_exists === true
    && M.not_in_the_animal_genome !== true
    && !(F.already_present_in ?? []).includes(H.id)
    && F.mechanism_class !== 'POLYGENIC_QUANTITATIVE';

  if (clear && H.tractability === 'PUBLISHED_ONCE') {
    out.push({
      class: 'ADMISSIBLE_PENDING_PREREQUISITE',
      because: `Nothing structural refuses this pair, but germline modification of ${H.latin} has been published essentially once (${H.tractability}) and is not yet a method other laboratories run.`,
      what_would_change_it: `Independent replication of germline modification in ${H.latin}, in a second laboratory, with a line maintained through at least two generations.`,
    });
  }
  if (clear && M.single_locus !== true) {
    out.push({
      class: 'ADMISSIBLE_PENDING_PREREQUISITE',
      because: `${F.label} is ${F.mechanism_class}, which is not one locus: ${M.means}. The request is well formed but the target set has to be enumerated before there is an edit to make.`,
      what_would_change_it: 'An enumerated target set - which genes, at what dose, in what tissue, in what order - written down before any injection, so that a partial result can be told apart from a failed one.',
    });
  }
  if (clear && M.single_locus === true) {
    out.push({
      class: 'ADMISSIBLE_SINGLE_LOCUS',
      because: `One locus, the host has ${sys.present.length === sys.required.length ? 'every system' : 'the systems'} the edit acts on (${sys.present.join(', ') || 'none required'}), and a germline route into ${H.latin} is published (${H.tractability}).`,
      what_would_change_it: 'Nothing is being refused, so nothing has to change. What would make it a GOOD idea rather than a well-formed one is a functional test of the donor-host mapping: see analogues/analogy.mjs, which judges the mapping this module only accepts as stated.',
    });
  }

  const ordered = ADMISSIBILITY_ORDER.flatMap(c => out.filter(r => r.class === c));
  return deepFreeze({
    host: H.id, function: F.id, systems: sys,
    all_reasons: ordered,
    n_reasons: ordered.length,
    note: 'Ordered by ADMISSIBILITY_ORDER. admissible() reports the first of these and only the first; this list exists so that choice is visible rather than implicit.',
  });
}

/**
 * The verdict for one pair. A structured object, never a bare boolean and never a score.
 *
 * @param {string|object} host  a HOSTS entry or its id
 * @param {string|object} fn    a FUNCTIONS entry or its id
 */
export function admissible(host, fn) {
  const r = reasons(host, fn);
  const first = r.all_reasons[0];
  if (!first) throw new Error(`space.admissible: no reason produced for ${r.host} x ${r.function} - the reason set is not exhaustive, which is a bug in this module and not a property of the pair`);
  const C = VERDICT_CLASSES[first.class];
  return deepFreeze({
    admissible: C.admissible === true,
    class: first.class,
    because: first.because,
    what_would_change_it: first.what_would_change_it,
    host: r.host,
    function: r.function,
    class_means: C.means,
    class_does_not_mean: C.and_does_not_mean ?? null,
    other_reasons_that_also_apply: r.all_reasons.slice(1).map(x => x.class),
    unknown_systems: r.systems.unknown,
    score: null,
    feasibility: null,
    no_score_is_offered: 'There is no number here and there is not one available. A verdict is a class plus two sentences. See WHY_NO_RANKING.',
  });
}

// =====================================================================================================
// 7. THE SPACE
// =====================================================================================================

/** The full cross product, with counts by class and by refusal reason. No ordering, no ranking. */
export function space() {
  const cells = [];
  for (const h of HOSTS) for (const f of FUNCTIONS) {
    const v = admissible(h, f);
    cells.push(Object.freeze({ host: h.id, function: f.id, admissible: v.admissible, class: v.class, because: v.because, what_would_change_it: v.what_would_change_it }));
  }
  const byClass = Object.fromEntries(VERDICT_CLASS_IDS.map(c => [c, cells.filter(x => x.class === c).length]));
  const refused = cells.filter(x => !x.admissible);
  const byRefusal = Object.fromEntries(REFUSAL_CLASS_IDS.map(c => [c, refused.filter(x => x.class === c).length]));
  const unreached = VERDICT_CLASS_IDS.filter(c => byClass[c] === 0);

  return deepFreeze({
    n_hosts: HOSTS.length,
    n_functions: FUNCTIONS.length,
    n_cells: cells.length,
    n_admissible: cells.filter(x => x.admissible).length,
    n_refused: refused.length,
    by_class: byClass,
    refused_by_reason: byRefusal,
    classes_unreached: unreached,
    cells,
    what_this_is_not: 'Not a ranking, not a search result, and not a base rate. The proportion refused is a property of WHICH hosts and WHICH capabilities were written down here, and both lists were chosen - partly to cover every mechanism class and every verdict class. Reading the refusal fraction as "most designs are impossible" would be reading this module\'s table of contents as a finding.',
    what_it_is_for: 'Reading a column to see which hosts a capability can even be asked of, and reading a row to see which capabilities a host can even be asked for - with the reason attached to every cell that is out, so that a refusal can be argued with rather than only obeyed.',
    the_uncomfortable_cells: 'The two NO_GERMLINE_METHOD hosts are the organisms that actually HAVE several of these capabilities. Every cell in their rows is refused, and the refusal is about our access, not their biology. That is the shape of the whole problem: the lineages worth borrowing from are disproportionately the ones nobody can breed.',
  });
}

// =====================================================================================================
// 8. WHY THERE IS NO RANKING
// =====================================================================================================

export const WHY_NO_RANKING = deepFreeze({
  headline: 'Ranking this space would convert its content - the reasons - into an ordering, and an ordering over heterogeneous failures reads as difficulty when most of the failures are not difficulty at all.',
  the_argument: [
    'The refusals here are not degrees of the same thing. "No published germline route" is a fact about the literature. "The trait is in the microbiome" is a fact about where the genes are. "The host never had the gene you want deleted" is a fact about the host lineage. "The trait is polygenic and you asked for an edit" is a fact about the request. A single axis cannot order four kinds of being wrong, and a number that tries will be read as the one kind the reader already had in mind.',
    'A malformed request scored mid-range is worse than one refused. Mid-range reads as "ambitious, try it", and the pairs most likely to land mid-range on any sensible weighting are exactly the polygenic ones, where the correct answer is that the request has no referent. The scoring failure is not noise; it is biased towards the most expensive mistake.',
    'What a designer needs from this module is the second sentence, not the first. "Inadmissible" is the cheap half; "and here is the one thing that would change it" is why the module exists. A rank has nowhere to put the second sentence, so the second sentence is what a rank deletes.',
    'The refusal classes are reportable and arguable. Someone can read REFUSED_NO_SUBSTRATE on a cell, disagree with the `lacks` entry it rests on, and say so - and be right, and the table improves. Nobody can disagree with a 0.41.',
    'The admissible cells are not ordered among themselves either, and that is deliberate. ADMISSIBLE_SINGLE_LOCUS does not mean easier than ADMISSIBLE_PENDING_PREREQUISITE; it means fewer things are known to be missing. Kachroo 2015\'s 47% is the reminder that a well-formed single-locus request is still about a coin flip at the bench.',
  ],
  what_is_returned_instead: 'a class from a closed vocabulary, the reason in a sentence, the one thing that would change it, every other reason that also applied, and the list of systems whose status is unknown for that pair.',
  if_you_need_to_prioritise: 'Then prioritise on something you can defend out loud - cost, time to a generation, whether a null result would be interpretable - and state it where the decision is made. Do not ask this module to fold it into a number on your behalf, because the fold is the part that would need defending and the number is the part that would travel.',
});

export const WHAT_THIS_IS =
  'The HOSTS x FUNCTIONS space DELPHI can be asked about, with an admissibility filter that refuses ' +
  'combinations for stated structural reasons rather than scoring them. It refuses a trait of an ' +
  'associated microbial community requested as an edit to the animal genome; a gene-loss request ' +
  'against a host whose lineage never had the gene; a polygenic quantitative trait requested as a ' +
  'single edit; a capability requested of a host that already has it; a capability whose substrate ' +
  'the host lacks; and any request at all against a host with no published germline route. Admissible ' +
  'means the request is well formed and a route exists - not that the experiment will work.';

// =====================================================================================================

const isMain = (() => {
  try { return process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()); }
  catch { return false; }
})();

if (isMain) {
  const s = space();
  console.log(`\n${WHAT_THIS_IS}\n`);
  console.log(`${s.n_hosts} hosts x ${s.n_functions} functions = ${s.n_cells} cells: ${s.n_admissible} admissible, ${s.n_refused} refused.\n`);
  console.log('by class:');
  for (const [c, n] of Object.entries(s.by_class)) console.log(`  ${String(n).padStart(4)}  ${c}`);
  if (s.classes_unreached.length) console.log(`\nclasses unreached: ${s.classes_unreached.join(', ')}`);
  console.log(`\n${s.the_uncomfortable_cells}\n`);
  const show = [
    ['bos-taurus', 'rumen-methane-output'],
    ['caenorhabditis-elegans', 'haemoglobin-loss'],
    ['mus-musculus', 'myoglobin-dive-capacity'],
    ['chaenocephalus-aceratus', 'afgp-notothenioid'],
    ['sus-scrofa', 'ucp1-thermogenesis'],
    ['mus-musculus', 'ucp1-thermogenesis'],
    ['anolis-sagrei', 'dsup-radioprotection'],
    ['danio-rerio', 'afgp-gadid'],
  ];
  for (const [h, f] of show) {
    const v = admissible(h, f);
    console.log(`${h} x ${f}\n  -> ${v.class}${v.other_reasons_that_also_apply.length ? ` (also: ${v.other_reasons_that_also_apply.join(', ')})` : ''}\n     ${v.because}\n     would change it: ${v.what_would_change_it}\n`);
  }
  console.log(`${WHY_NO_RANKING.headline}\n`);
}
