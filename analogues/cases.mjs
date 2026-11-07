// The three worked requests, carried to an honest verdict.
//
// ============================== WHY THESE THREE ==============================
// The project lead chose this set because the three requests FAIL IN THREE DIFFERENT WAYS, and that is
// the point of the set. Only ONE of them is a genome-editing problem in the shape the pipeline assumes:
//
//   glowing-fly      not a mapping problem      -- a foreign function is ADDED; there is no orthologue
//                                                  to map onto, and none is needed
//   protein-worm     not a single-edit problem  -- a quantitative, polygenic, whole-organism composition
//                                                  trait, already near its own ceiling
//   low-methane-cow  not about the named organism -- the methane is made by archaea in the rumen; the
//                                                  cow genome encodes no methanogenesis pathway at all
//
// A system that silently emitted a CRISPR cassette for all three would be wrong three times, in three
// different ways, and would look equally confident each time. See THE_SHARED_LESSON at the bottom.
//
// ============================== THE SOURCE RULE ==============================
// Every citation below was retrieved and its identifiers read back from the record; see `verified_how`
// on each source. A FABRICATED DOI IS WORSE THAN NONE, so where a number was wanted and could not be
// traced to a source this file could check, the source is `{ doi: null, pmid: null, null_reason: ... }`
// and the claim it would have supported is demoted to `what_would_have_to_be_measured`.
//
// Article metadata and abstracts were obtained from PubMed. DOI links accompany every article cited.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Recursive freeze, so a consumer cannot quietly rewrite a verdict or drop a caveat. */
const deepFreeze = (o) => {
  if (o && (typeof o === 'object') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

/** The closed verdict vocabulary. A verdict outside this set is a bug, not a nuance. */
export const VERDICTS = deepFreeze({
  ADDABLE: 'addable',
  POLYGENIC: 'polygenic-not-a-single-edit',
  WRONG_ORGANISM: 'wrong-organism',
  NEEDS_MEASUREMENT: 'needs-measurement-first',
});

/** How a request maps onto the analogy vocabulary -- including the two ways it maps onto nothing. */
export const ANALOGY_CLASSES = deepFreeze({
  FOREIGN_ADDITION: 'foreign-addition-no-orthologue',
  POLYGENIC_QUANTITATIVE: 'polygenic-quantitative-trait',
  ASSOCIATED_COMMUNITY: 'trait-of-an-associated-community-not-the-organism',
  ONE_TO_ONE: 'one-to-one-orthologue-transfer',
});

// ---------------------------------------------------------------------------------------------------
// Sources. Each entry was pulled from the live record; `verified_how` says what was actually checked.
// ---------------------------------------------------------------------------------------------------

const S = {
  heim1994: {
    key: 'heim1994',
    citation: 'Heim R, Prasher DC, Tsien RY. Wavelength mutations and posttranslational autoxidation of ' +
      'green fluorescent protein. Proc Natl Acad Sci U S A. 1994;91(26):12501-4.',
    doi: '10.1073/pnas.91.26.12501',
    pmid: '7809066',
    supports: 'Chromophore maturation requires MOLECULAR OXYGEN and takes hours: the abstract reports a ' +
      'time constant of approximately 4 h at 22 C and atmospheric pO2, independent of dilution, implying ' +
      'no enzyme or cofactor is needed. The chromophore is formed by cyclization and oxidation of the ' +
      'protein\'s own Ser-Tyr-Gly at positions 65-67.',
    verified_how: 'PubMed record fetched by title/author search; DOI and PMID read back from the record, ' +
      'and the oxygen requirement and the ~4 h figure quoted from the retrieved abstract.',
  },
  yeh1995: {
    key: 'yeh1995',
    citation: 'Yeh E, Gustafson K, Boulianne GL. Green fluorescent protein as a vital marker and reporter ' +
      'of gene expression in Drosophila. Proc Natl Acad Sci U S A. 1995;92(15):7036-40.',
    doi: '10.1073/pnas.92.15.7036',
    pmid: '7624365',
    supports: 'GFP from the jellyfish Aequorea victoria expressed in Drosophila melanogaster under GAL4/UAS ' +
      'control, detected in ovaries, imaginal discs and larval nervous system WITHOUT fixation, antibodies ' +
      'or added substrates. This is the canonical demonstration that the glow needs no fly gene and no ' +
      'supplied chemistry -- only light to excite it.',
    verified_how: 'PubMed record fetched; author list corrected against the record (Boulianne, not Rubin, ' +
      'which is what the half-remembered citation said); DOI and PMID read back from the record.',
  },
  davis1995: {
    key: 'davis1995',
    citation: 'Davis I, Girdham CH, O\'Farrell PH. A nuclear GFP that marks nuclei in living Drosophila ' +
      'embryos; maternal supply overcomes a delay in the appearance of zygotic fluorescence. Dev Biol. ' +
      '1995;170(2):726-9.',
    doi: '10.1006/dbio.1995.1251',
    pmid: '7649398',
    supports: 'The maturation lag measured IN THE FLY: a long delay between zygotic expression and the ' +
      'appearance of fluorescence, so that GFP is "an excellent marker for the expression of stable gene ' +
      'products, but a poor reporter for dynamic zygotic gene expression in early Drosophila embryos".',
    verified_how: 'PubMed record fetched; DOI and PMID read back; the quoted conclusion is from the ' +
      'retrieved abstract.',
  },
  rubin1982: {
    key: 'rubin1982',
    citation: 'Rubin GM, Spradling AC. Genetic transformation of Drosophila with transposable element ' +
      'vectors. Science. 1982;218(4570):348-53.',
    doi: '10.1126/science.6289436',
    pmid: '6289436',
    supports: 'The original germline transgenesis route: a P transposable element carrying exogenous DNA, ' +
      'transforming 20-50% of injected embryos, stably inherited. This -- not genome editing -- is the ' +
      'tool the glowing-fly request actually calls for.',
    verified_how: 'PubMed record fetched; DOI and PMID read back from the record.',
  },
  groth2004: {
    key: 'groth2004',
    citation: 'Groth AC, Fish M, Nusse R, Calos MP. Construction of transgenic Drosophila by using the ' +
      'site-specific integrase from phage phiC31. Genetics. 2004;166(4):1775-82.',
    doi: '10.1093/genetics/166.4.1775',
    pmid: '15126397',
    supports: 'Site-specific integration into a genomic attP docking site in Drosophila: up to 55% of ' +
      'fertile injected adults produced transgenic offspring, and 100% of those progeny carried a precise ' +
      'integration at the genomic attP site. The modern default for putting a cassette at a chosen, ' +
      'characterised position without cutting an endogenous gene.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; the 55% and 100% figures are from the ' +
      'retrieved abstract.',
  },
  brandes1996: {
    key: 'brandes1996',
    citation: 'Brandes C, Plautz JD, Stanewsky R, Jamison CF, Straume M, Wood KV, Kay SA, Hall JC. Novel ' +
      'features of Drosophila period transcription revealed by real-time luciferase reporting. Neuron. ' +
      '1996;16(4):687-92.',
    doi: '10.1016/s0896-6273(00)80088-4',
    pmid: '8607986',
    supports: 'BIOLUMINESCENCE in Drosophila: a luciferase transgene producing light from living adults ' +
      'over days. The light is real, and it is enzymatic turnover of a substrate, not a property of the ' +
      'protein alone -- which is exactly the difference from GFP.',
    verified_how: 'PubMed record fetched; DOI and PMID read back from the record.',
  },
  ito2023: {
    key: 'ito2023',
    citation: 'Ito A, Matsuda N, Ukita Y, Okumura M, Chihara T. Akaluc/AkaLumine bioluminescence system ' +
      'enables highly sensitive, non-invasive and temporal monitoring of gene expression in Drosophila. ' +
      'Commun Biol. 2023;6(1):1270.',
    doi: '10.1038/s42003-023-05628-x',
    pmid: '38097812',
    supports: 'The substrate dependency, stated as a method: "oral administration of AkaLumine to flies ' +
      'expressing Akaluc" is how the light is obtained. The fly is fed its luciferin. It does not make it.',
    verified_how: 'PubMed record fetched by title search; DOI and PMID read back; the oral-administration ' +
      'wording is quoted from the retrieved abstract.',
  },

  zecic2019: {
    key: 'zecic2019',
    citation: 'Zecic A, Dhondt I, Braeckman BP. The nutritional requirements of Caenorhabditis elegans. ' +
      'Genes Nutr. 2019;14:15.',
    doi: '10.1186/s12263-019-0637-7',
    pmid: '31080524',
    supports: 'THE BASELINE, with its own caveat attached. Verbatim from the full text: "Biomass ' +
      'composition of [C. elegans] has not yet been characterised in detail. Worm dry biomass consists of ' +
      'roughly 60% protein, 20% lipids, 6.5% nucleic acids and 6% carbohydrates" -- compiled from earlier ' +
      'studies, not one measurement. Same source, same section, for the food: the average E. coli cell is ' +
      '"approximately 55% protein, 23% nucleic acids (20% RNA and 3% DNA), 7-9% lipids and 6% ' +
      'carbohydrates", and the authors note that "overall protein and carbohydrate content seem to be ' +
      'similar in [C. elegans] and its [E. coli] food, as well as in mammals" (mammalian cells ~60% ' +
      'protein). Also the source for: the 10 dietary essential amino acids (arginine, histidine, lysine, ' +
      'tryptophan, phenylalanine, methionine, threonine, leucine, isoleucine, valine -- the same set as ' +
      'rat and human except for arginine); heme auxotrophy; sterol auxotrophy; and that the 54-component ' +
      'defined maintenance medium is "costly and time-consuming".',
    verified_how: 'PubMed record fetched, then the PMC full text (PMC6501307) retrieved and the ' +
      'composition sentences, the E. coli figures, the essential-amino-acid list and the auxotrophies ' +
      'read directly out of it. DOI and PMID read back from the record.',
  },
  perez2019: {
    key: 'perez2019',
    citation: 'Perez MF, Lehner B. Vitellogenins - yolk gene function and regulation in Caenorhabditis ' +
      'elegans. Front Physiol. 2019;10:1067.',
    doi: '10.3389/fphys.2019.01067',
    pmid: '31551797',
    supports: 'Where the worm\'s protein mass actually sits: the six vitellogenins "are among the most ' +
      'highly expressed genes in the adult hermaphrodite intestine, which produces copious yolk to ' +
      'provision eggs". Any real change in total protein has to go through this, and vitellogenin ' +
      'provisioning is itself developmentally and maternally regulated rather than set by one switch.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; the quoted phrase is from the retrieved ' +
      'abstract.',
  },
  page2007: {
    key: 'page2007',
    citation: 'Page AP, Johnstone IL. The cuticle. WormBook. 2007:1-15.',
    doi: '10.1895/wormbook.1.138.1',
    pmid: '18050497',
    supports: 'The digestibility question, structurally: the nematode cuticle is "a highly structured ' +
      'extra-cellular matrix (ECM), composed predominantly of cross-linked collagens, additional ' +
      'insoluble proteins termed cuticlins, associated glycoproteins and lipids". INSOLUBLE and ' +
      'CROSS-LINKED is the property that decides whether protein content is available to an eater.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; the quoted description is from the ' +
      'retrieved abstract.',
  },
  thein2009: {
    key: 'thein2009',
    citation: 'Thein MC, Winter AD, Stepek G, McCormack G, Stapleton G, Johnstone IL, Page AP. Combined ' +
      'extracellular matrix cross-linking activity of the peroxidase MLT-7 and the dual oxidase BLI-3 is ' +
      'critical for post-embryonic viability in Caenorhabditis elegans. J Biol Chem. 2009;284(26):17549-63.',
    doi: '10.1074/jbc.M900831200',
    pmid: '19406744',
    supports: 'The cross-links are di-tyrosine and enzymatically made: disrupting mlt-7 leaves a cuticle ' +
      'that "lacks di-tyrosine cross-links, becomes permeable to dye and accessible to tyrosine ' +
      'iodination". So cuticle digestibility is itself an editable property -- a different edit from any ' +
      'that raises protein content, aimed at a different limiting factor.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; the quoted phrase is from the retrieved ' +
      'abstract.',
  },

  thauer2008: {
    key: 'thauer2008',
    citation: 'Thauer RK, Kaster AK, Seedorf H, Buckel W, Hedderich R. Methanogenic archaea: ecologically ' +
      'relevant differences in energy conservation. Nat Rev Microbiol. 2008;6(8):579-91.',
    doi: '10.1038/nrmicro1931',
    pmid: '18587410',
    supports: 'Methanogenesis is an ARCHAEAL energy metabolism: methanogens reduce CO2 with H2 to methane ' +
      'and conserve energy from it. It is their way of making a living, not a side reaction of a host. ' +
      'This is why there is nothing in a cow to switch off.',
    verified_how: 'PubMed record fetched by title/author search; DOI and PMID read back from the record.',
  },
  duin2016: {
    key: 'duin2016',
    citation: 'Duin EC, Wagner T, Shima S, Prakash D, Cronin B, Yanez-Ruiz DR, Duval S, Rumbeli R, ' +
      'Stemmler RT, Thauer RK, Kindermann M. Mode of action uncovered for the specific reduction of methane ' +
      'emissions from ruminants by the small molecule 3-nitrooxypropanol. Proc Natl Acad Sci U S A. ' +
      '2016;113(22):6172-7.',
    doi: '10.1073/pnas.1600298113',
    pmid: '27140643',
    supports: 'THE DECISIVE MECHANISM. 3-NOP "specifically targets methyl-coenzyme M reductase (MCR)", a ' +
      'nickel enzyme "only active when its Ni ion is in the +1 oxidation state", which "catalyzes the ' +
      'methane-forming step in the rumen fermentation". 3-NOP inactivates MCR at micromolar ' +
      'concentrations by oxidising its active-site Ni(I), and "inhibit[s] growth of methanogenic archaea ' +
      'at concentrations that do not affect the growth of nonmethanogenic bacteria in the rumen". The ' +
      'target enzyme is one the cow does not possess. Also the source for: up to 12% of the gross energy ' +
      'content of the feedstock is lost along with the methane.',
    verified_how: 'PubMed record fetched by title/author search; DOI and PMID read back; every quoted ' +
      'phrase is from the retrieved abstract.',
  },
  hristov2015: {
    key: 'hristov2015',
    citation: 'Hristov AN, Oh J, Giallongo F, Frederick TW, Harper MT, Weeks HL, Branco AF, Moate PJ, ' +
      'Deighton MH, Williams SRO, Kindermann M, Duval S. An inhibitor persistently decreased enteric ' +
      'methane emission from dairy cows with no negative effect on milk production. Proc Natl Acad Sci U S ' +
      'A. 2015;112(34):10663-8.',
    doi: '10.1073/pnas.1504124112',
    pmid: '26229078',
    supports: 'The in-vivo effect size for 3-NOP: 48 lactating Holstein cows, 12-week data collection, ' +
      '3-NOP at 40-80 mg/kg feed dry matter. Methane emission "averaging about 30% lower than the ' +
      'control", also ~30% lower per unit dry-matter intake and per unit energy-corrected milk, with feed ' +
      'intake, milk production and fibre digestibility unaffected, milk protein and lactose yields ' +
      'increased, and body-weight gain 80% greater than controls. The effect persisted over 12 weeks.',
    verified_how: 'Resolved by citation lookup (journal/year/volume/first page/author) to PMID 26229078, ' +
      'then the record fetched and the DOI read back. All figures quoted from the retrieved abstract.',
  },
  kebreab2022: {
    key: 'kebreab2022',
    citation: 'Kebreab E, Bannink A, Pressman EM, Walker N, Karagiannis A, van Gastelen S, Dijkstra J. A ' +
      'meta-analysis of effects of 3-nitrooxypropanol on methane production, yield, and intensity in dairy ' +
      'cattle. J Dairy Sci. 2023;106(2):927-36.',
    doi: '10.3168/jds.2022-22211',
    pmid: '36494226',
    supports: 'The pooled effect, and its DIET DEPENDENCE. 13 articles / 14 experiments / 48 treatment ' +
      'means: at a mean dose of 70.5 mg 3-NOP per kg dry matter, reductions of 32.7% (production, g/d), ' +
      '30.9% (yield, g/kg DMI) and 32.6% (intensity, g/kg energy-corrected milk). Efficacy FALLS as ' +
      'dietary neutral detergent fibre and crude fat rise: a 10 g/kg DM rise in NDF from its 329 g/kg mean ' +
      'impairs the effect on production by 0.633%, and a 10 g/kg DM fall in crude fat enhances it by ' +
      '3.080%. An additive is therefore a ration-specific intervention, not a fixed 30%.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; every percentage quoted from the ' +
      'retrieved abstract.',
  },
  lean2021: {
    key: 'lean2021',
    citation: 'Lean IJ, Golder HM, Grant TMD, Moate PJ. A meta-analysis of effects of dietary seaweed on ' +
      'beef and dairy cattle performance and methane yield. PLoS One. 2021;16(7):e0249053.',
    doi: '10.1371/journal.pone.0249053',
    pmid: '34252114',
    supports: 'The seaweed route, reported honestly. 14 experiments, 23 comparisons; dietary seaweed ' +
      '(predominantly Asparagopsis taxiformis and Ascophyllum nodosum) "produced a significant and ' +
      'substantial reduction in methane yield by 5.28 +/- 3.5 g/kg DMI (P = 0.003)"; "in one comparison, ' +
      'methane yield was reduced by 97%"; but "there was marked heterogeneity in the results (I2 > 80%)", ' +
      'no effect on average daily gain or dry-matter intake, and the authors conclude more in-vivo work is ' +
      'needed. The headline 80-97% numbers are the tail of a very dispersed distribution.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; every figure and the heterogeneity ' +
      'caveat quoted from the retrieved abstract.',
  },
  difford2018: {
    key: 'difford2018',
    citation: 'Difford GF, Plichta DR, Lovendahl P, Lassen J, Noel SJ, Hojberg O, Wright ADG, Zhu Z, ' +
      'Kristensen L, Nielsen HB, Guldbrandtsen B, Sahana G. Host genetics and the rumen microbiome jointly ' +
      'associate with methane emissions in dairy cows. PLoS Genet. 2018;14(10):e1007580.',
    doi: '10.1371/journal.pgen.1007580',
    pmid: '30312316',
    supports: 'THE HERITABILITY FIGURE, and the reason it is a selection target rather than an edit ' +
      'target. "The cumulative effect of all bacteria and archaea on CH4 production was 13%, the host ' +
      'genetics (heritability) was 21% and the two are largely independent." The authors draw the ' +
      'conclusion explicitly: "variation in CH4 emission is likely not modulated through cow genetic ' +
      'effects on the rumen microbiome", so "the rumen microbiome and cow genome could be targeted ' +
      'independently". Non-zero, modest, population-level, no causal variant named.',
    verified_how: 'PubMed record fetched by author/title search; DOI and PMID read back; every figure and ' +
      'quotation from the retrieved abstract.',
  },
  saedi2026: {
    key: 'saedi2026',
    citation: 'Saedi N, Zhang S, Sahana G, Villumsen TM, Stephansen RB, Lund MS, Cai Z, Karaman E. ' +
      'Comparison of 16S rRNA sequencing and shotgun metagenome sequencing for estimating genotypic and ' +
      'phenotypic parameters of enteric methane emission in dairy cattle. J Dairy Sci. 2026;109(8):8493-504.',
    doi: '10.3168/jds.2025-28157',
    pmid: '42114750',
    supports: 'A lower, more recent heritability bracket, and the environmental verdict on the microbiome. ' +
      '"The heritability of methane ranged from 0.08 to 0.14"; 16S genus-level features "explained 28% of ' +
      'phenotypic variation in methane"; and "the microbiota in the rumen is primarily determined by ' +
      'environmental factors, whereas host genetics has a significant impact on the abundance of certain ' +
      'functionally important microbes". Individual microbial features can be strongly heritable (up to ' +
      '0.95-0.98 for particular taxa) even while the community as a whole is environmentally set.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; every figure quoted from the retrieved ' +
      'abstract.',
  },
  gonzalezRecio2023: {
    key: 'gonzalezRecio2023',
    citation: 'Gonzalez-Recio O, Scrobota N, Lopez-Paredes J, Saborio-Montero A, Fernandez A, Lopez de ' +
      'Maturana E, Villanueva B, Goiri I, Atxaerandio R, Garcia-Rodriguez A. Review: Diving into the cow ' +
      'hologenome to reduce methane emissions and increase sustainability. Animal. 2023;17 Suppl 2:100780.',
    doi: '10.1016/j.animal.2023.100780',
    pmid: '37032282',
    supports: 'The heritability of the MICROBIOME ITSELF, which is the quantity a host-genetic strategy ' +
      'would have to act through: "Heritability estimates for the rumen microbiota composition range ' +
      'between 0.05 and 0.40 in the literature, depending on the taxonomical group or microbial gene ' +
      'function." The review also notes that incorporation of methane traits into actual breeding ' +
      'programmes "is still scarce".',
    verified_how: 'PubMed record fetched; DOI and PMID read back; range and quotation from the retrieved ' +
      'abstract.',
  },
  hristovMelgar2020: {
    key: 'hristovMelgar2020',
    citation: 'Hristov AN, Melgar A. Short communication: Relationship of dry matter intake with enteric ' +
      'methane emission measured with the GreenFeed system in dairy cows receiving a diet without or with ' +
      '3-nitrooxypropanol. Animal. 2020;14(S3):s484-90.',
    doi: '10.1017/S1751731120001731',
    pmid: '32720629',
    supports: 'THE MEASUREMENT TRAP. With spot sampling, the apparent effect depends on when you sample ' +
      'relative to feeding: the 3-NOP mitigation effect "was highest (45%) immediately after feed ' +
      'provision, persisted at around 32% to 39% within 10 h after feed provision, and decreased to 13%, ' +
      '4 h before feeding", with no effect in the 2 h before feeding. The overall 24 h intake/emission ' +
      'relationship was poor (R2 = 0.01). Any methane phenotype -- for an additive trial OR for a ' +
      'heritability estimate -- is only as good as its sampling coverage.',
    verified_how: 'PubMed record fetched; DOI and PMID read back; every figure quoted from the retrieved ' +
      'abstract.',
  },

  // ---- Deliberate nulls. A number was wanted here and no source was found that this file could check. ----
  flyGfpFitnessCost: {
    key: 'flyGfpFitnessCost',
    citation: 'No source identified for a measured fitness/energetic cost of GFP expression in ' +
      'Drosophila melanogaster against an insertion-site-matched, non-expressing control.',
    doi: null,
    pmid: null,
    null_reason: 'Searched and did not find a study that isolates the cost of the GFP protein itself from ' +
      'the cost of the driver, the insertion site and the genetic background. Rather than attach a ' +
      'plausible-looking DOI to a number, the cost is listed under what_would_have_to_be_measured. A ' +
      'fabricated DOI is worse than none.',
    verified_how: 'Not applicable: deliberately null. The absence is the finding.',
  },
  wormAminoAcidProfile: {
    key: 'wormAminoAcidProfile',
    citation: 'No verified source for a measured whole-body amino-acid profile of Caenorhabditis elegans ' +
      'expressed per gram of worm protein.',
    doi: null,
    pmid: null,
    null_reason: 'Zecic 2019 gives the worm\'s dietary ESSENTIAL amino acids (what it must eat) which is a ' +
      'different quantity from the composition of its own protein (what an eater of worms would get). No ' +
      'source for the latter was found and checked, so the amino-acid sub-route carries no numbers.',
    verified_how: 'Not applicable: deliberately null. The absence is why sub-route (c) is unresolved.',
  },
  cowMethanogenesisGeneAbsence: {
    key: 'cowMethanogenesisGeneAbsence',
    citation: 'No single citation asserting, as its result, that the Bos taurus genome encodes no ' +
      'methanogenesis pathway.',
    doi: null,
    pmid: null,
    null_reason: 'The claim is true and is treated as settled background rather than a result: ' +
      'methanogenesis, and methyl-coenzyme M reductase in particular, is an archaeal energy metabolism ' +
      '(thauer2008), and 3-NOP works precisely because it inhibits methanogenic archaea without touching ' +
      'non-methanogenic rumen bacteria or the host (duin2016). The honest statement of evidence is that ' +
      'pair plus the absence of any report of a host methanogenesis gene -- not a citation that does not ' +
      'exist. The direct check is cheap and is listed under what_would_have_to_be_measured: search the ' +
      'cow reference proteome for mcrABG homologues and expect none.',
    verified_how: 'Not applicable: deliberately null, with the inference it rests on named explicitly.',
  },
};

const src = (...keys) => keys.map((k) => {
  if (!S[k]) throw new Error(`unknown source key: ${k}`);
  return S[k];
});

// ---------------------------------------------------------------------------------------------------
// CASES
// ---------------------------------------------------------------------------------------------------

export const CASES = deepFreeze([
  {
    id: 'glowing-fly',
    request: 'A fruit fly that glows',
    what_is_actually_being_asked:
      'Two different things, and the request does not say which. (1) FLUORESCENCE: a protein that absorbs ' +
      'photons at one wavelength and re-emits them at a longer one. It needs an excitation source, so a ' +
      'fluorescent fly is dark in a dark room. (2) BIOLUMINESCENCE: an enzyme that oxidises a substrate ' +
      'and emits a photon from the chemistry itself. That one glows in the dark. Most people asking for a ' +
      'fly that glows mean (2); the obvious route (GFP) delivers (1). THIS DISTINCTION IS THE SINGLE MOST ' +
      'IMPORTANT THING IN THIS CASE, and a pipeline that resolves "glows" to GFP without asking has ' +
      'answered a question nobody asked.',
    the_distinction_that_decides_the_case: {
      fluorescence: {
        what_it_is: 'photon in, longer-wavelength photon out, by a chromophore inside a folded protein',
        example: 'GFP from the jellyfish Aequorea victoria',
        glows_in_the_dark: false,
        needs_excitation_light: true,
        needs_a_supplied_substrate: false,
        why: 'the chromophore is made from the protein\'s own Ser-Tyr-Gly tripeptide by cyclization and ' +
          'oxidation, so once matured the protein is self-contained (heim1994)',
      },
      bioluminescence: {
        what_it_is: 'chemical energy from substrate oxidation emitted as light, catalysed by a luciferase',
        example: 'beetle luciferase with D-luciferin; Akaluc with AkaLumine',
        glows_in_the_dark: true,
        needs_excitation_light: false,
        needs_a_supplied_substrate: true,
        why: 'Drosophila melanogaster has no luciferin biosynthesis pathway. The substrate is fed to the ' +
          'fly -- Ito 2023 obtained signal by "oral administration of AkaLumine to flies expressing ' +
          'Akaluc" -- so the fly glows while you feed it and stops when you do not. That makes it a ' +
          'reporter assay, not a heritable trait of the animal.',
      },
      the_trap: 'The requester most likely wants bioluminescence. Bioluminescence is addable but NOT ' +
        'autonomous. So the honest answer is neither "yes" nor "no" but: you can have a fly that emits ' +
        'light under a lamp (fluorescence, autonomous), or one that emits light in the dark only while ' +
        'eating a chemical it cannot make (bioluminescence, substrate-dependent). Nobody can have a fly ' +
        'that glows in the dark on its own without also engineering a luciferin biosynthesis pathway, ' +
        'which is a far larger project than the request implies.',
    },
    target_organism: 'Drosophila melanogaster',
    is_the_target_organism_the_right_one: true,
    why_the_target_is_or_is_not_right:
      'Right. The trait is to be expressed by the fly\'s own cells, so the fly is the organism to modify. ' +
      'This is the only one of the three cases where the named organism is also the one that has to change.',
    route:
      'A transgene, not an edit. Concretely: an enhancer/promoter + a codon-adapted coding sequence for ' +
      'the foreign protein + a 3\' UTR/polyadenylation signal + a selectable or screenable marker, ' +
      'integrated into the germ line. The promoter is the design decision that decides WHERE and WHEN the ' +
      'fly glows -- a ubiquitous driver (Act5C, alpha-tubulin) for a whole glowing fly; a GAL4/UAS pair ' +
      'for tissue-restricted or inducible expression, which is how Yeh 1995 obtained signal in ovaries, ' +
      'imaginal discs and larval nervous system. Delivery has three historical layers: P-element ' +
      'transposition (rubin1982), phiC31 integrase into a characterised genomic attP docking site ' +
      '(groth2004, which is the modern default because it gives single-copy insertion at a known ' +
      'position), or CRISPR-mediated knock-in at a safe harbour. NO ENDOGENOUS FLY GENE IS ALTERED, ' +
      'REPLACED OR REPAIRED in any version of this.',
    analogy_class: ANALOGY_CLASSES.FOREIGN_ADDITION,
    why_that_analogy_class:
      'This is NOT AN ANALOGY MAPPING AT ALL, and saying so is the finding. An analogy mapping assumes a ' +
      'source gene in one organism and a counterpart in the target whose sequence, position or regulation ' +
      'is to be brought into correspondence. Here there is no fly counterpart: GFP-family proteins are ' +
      'known from cnidarians and a scattering of other marine lineages, and no insect genome is reported ' +
      'to encode one. Nor is a counterpart NEEDED -- the function is being ADDED, not transferred, and ' +
      'the chromophore forms spontaneously wherever the protein folds in the presence of oxygen, which is ' +
      'why heterologous expression works across such distant hosts (heim1994). An orthology search run on ' +
      'this request returns nothing, and a pipeline that reads "no orthologue" as "not feasible" has ' +
      'inverted the answer.',
    what_would_have_to_be_measured: [
      'WHICH PHENOMENON WAS DELIVERED: excitation and emission spectra in situ, and then the decisive ' +
        'observation -- photograph the fly in a dark room with no illumination. Fluorescence yields a ' +
        'black frame.',
      'Chromophore maturation lag, in the tissue of interest: heim1994 measured a time constant of ~4 h ' +
        'at 22 C in vitro, and davis1995 saw a long delay in Drosophila embryos between zygotic ' +
        'transcription and visible fluorescence. A reporter read faster than its own maturation reads as ' +
        'a false negative.',
      'Oxygen tension where the protein is expressed. Maturation requires molecular oxygen (heim1994), so ' +
        'hypoxic or anoxic tissue will hold unmatured, non-fluorescent protein.',
      'Expression level AND fitness cost, separately: larval-to-adult viability, fecundity and lifespan ' +
        'against a control carrying a non-expressing cassette AT THE SAME INSERTION SITE, so that ' +
        'position effects and driver toxicity are not scored as the cost of the protein itself. No source ' +
        'was found that does this isolation (see flyGfpFitnessCost), so this number does not exist here.',
      'Protein load and folding burden at the chosen expression level: fraction of total soluble protein, ' +
        'and any unfolded-protein-response or aggregation signature.',
      'For a luciferase build instead: substrate pharmacokinetics. Does the fed luciferin reach the ' +
        'expressing tissue, at what dose, and how fast does signal decay after withdrawal (ito2023)?',
      'For a fusion build: whether tagging displaced or destabilised the partner protein, which is a ' +
        'separate question from whether the tag is visible.',
    ],
    verdict: VERDICTS.ADDABLE,
    verdict_reasoning:
      'Addable, and routinely added since 1995 (yeh1995) -- with the caveat that what is addable is ' +
      'FLUORESCENCE, which is probably not what was asked for. Bioluminescence is also addable ' +
      '(brandes1996, ito2023) but carries a substrate dependency the request does not anticipate. The ' +
      'verdict is "addable" rather than "needs-measurement-first" because the construct and the outcome ' +
      'are both well characterised; the open question is which outcome the requester wanted, and that is ' +
      'a question for the requester, not an experiment.',
    how_it_could_fail: [
      'THE DELIVERABLE IS WRONG, not the construct. A fluorescent fly is handed to someone who wanted a ' +
        'fly that glows in the dark, and the project is declared a success by everyone except the user.',
      'A bioluminescent fly is built instead, and stops glowing the moment the luciferin is withdrawn. ' +
        'The "trait" turns out to be a consumable.',
      'Chromophore maturation needs oxygen and hours (heim1994, davis1995), so a fast or hypoxic readout ' +
        'scores an expressing fly as negative.',
      'Position effects: a randomly inserted P-element lands in a silenced or enhancer-adjacent region ' +
        'and the expression pattern is the insertion site\'s, not the promoter\'s. This is precisely what ' +
        'site-specific integration was introduced to remove (groth2004).',
      'Driver toxicity: strong GAL4/UAS overexpression imposes a cost that is attributed to the ' +
        'fluorescent protein. Without an insertion-matched non-expressing control the two are not ' +
        'separable.',
      'The marker is read as the phenotype: a line is scored as "glowing" from the screening marker ' +
        'rather than from the intended reporter.',
    ],
    sources: src('heim1994', 'yeh1995', 'davis1995', 'rubin1982', 'groth2004', 'brandes1996', 'ito2023',
      'flyGfpFitnessCost'),
  },

  {
    id: 'protein-worm',
    request: 'C. elegans higher in protein when eaten',
    what_is_actually_being_asked:
      'A quantitative, polygenic, whole-organism composition trait -- and the phrase hides three ' +
      'different targets with three different verdicts. "Higher in protein" can mean (a) more total ' +
      'protein per worm, (b) a higher protein:lipid ratio, i.e. a higher protein PERCENTAGE, or (c) a ' +
      'better amino-acid profile per gram of protein. These are not degrees of the same request; they are ' +
      'three requests, and (b) is satisfiable by making the worm WORSE food in every other respect. The ' +
      'clause "when eaten" also smuggles in the question that actually decides the use case: protein for ' +
      'whom, and is content even the limiting factor?',
    target_organism: 'Caenorhabditis elegans',
    is_the_target_organism_the_right_one: true,
    why_the_target_is_or_is_not_right:
      'Right, but only just, and worth stating carefully. The composition to be changed is the worm\'s, ' +
      'so the worm is the organism. But plate-grown worms carry Escherichia coli in the gut lumen and on ' +
      'the cuticle, and that food is itself roughly 55% protein by dry mass (zecic2019). Any measured ' +
      '"worm protein" that was not made on gut-cleared or axenic animals is partly a measurement of the ' +
      'bacterium. The right organism, measured wrongly, gives the wrong answer.',
    route:
      'There is no single route, because there are three targets. Each is spelled out in sub_routes with ' +
      'its own verdict. In outline: (a) total protein tracks body size and reproductive provisioning, so ' +
      'the levers are growth and body-size signalling and the vitellogenin genes -- many loci, each with ' +
      'pleiotropic costs; (b) protein PERCENTAGE is movable by single loss-of-function edits in fatty-acid ' +
      'desaturation and fat storage, which is a real single edit that raises the ratio BY REMOVING LIPID; ' +
      '(c) amino-acid profile is set by which proteins dominate the mass -- the vitellogenins and the ' +
      'cuticle collagens -- so changing it means reweighting the proteome, not flipping a regulator.',
    sub_routes: [
      {
        label: '(a) raise TOTAL protein per worm',
        mechanism:
          'Protein mass scales with body size and with reproductive provisioning. The six vitellogenins ' +
          'are among the most highly expressed genes in the adult hermaphrodite intestine (perez2019), so ' +
          'total protein runs largely through yolk production, which is developmentally and maternally ' +
          'regulated. The available levers -- body-size signalling, insulin-like signalling, germline ' +
          'proliferation -- are many, each pleiotropic, and none is a protein-content gene.',
        is_a_single_edit: false,
        sub_verdict: VERDICTS.POLYGENIC,
        the_catch:
          'A bigger worm contains more protein AND more of everything else. Unless the protein FRACTION ' +
          'rises, this is a yield improvement dressed as a composition improvement -- and yield is ' +
          'better bought with culture conditions than with genetics.',
      },
      {
        label: '(b) raise the protein:lipid RATIO (the protein percentage)',
        mechanism:
          'Lipid is roughly 20% of worm dry mass against protein\'s ~60% (zecic2019). Removing lipid ' +
          'therefore raises the protein percentage arithmetically. Single loss-of-function edits in ' +
          'fatty-acid desaturation and fat storage do reduce stored lipid, and CRISPR in C. elegans is ' +
          'entirely capable of making them.',
        is_a_single_edit: true,
        sub_verdict: VERDICTS.POLYGENIC,
        the_catch:
          'THIS IS THE SUB-ROUTE THAT LOOKS LIKE A WIN AND IS NOT. The protein percentage rises because ' +
          'the denominator shrank. Total protein does not increase; energy density falls; and the worm is ' +
          'now short of the lipid it needs. C. elegans must obtain sterols exogenously and synthesises ' +
          'its own long-chain polyunsaturated and monomethyl branched-chain fatty acids because they are ' +
          'required for growth and development (zecic2019); stored triglyceride and glycogen are what ' +
          'carry dauer larvae through starvation. "Higher in protein" delivered this way means leaner, ' +
          'not more nourishing. The sub-verdict is recorded as polygenic-not-a-single-edit DESPITE the ' +
          'edit being single, because the requested TRAIT is not what the single edit delivers. Calling ' +
          'it feasible would be the flattery this case exists to refuse.',
      },
      {
        label: '(c) improve the amino-acid profile per gram of protein',
        mechanism:
          'The profile of the worm\'s own protein is a weighted average over its proteome, dominated by ' +
          'the vitellogenins (perez2019) and the cuticle collagens (page2007). To change it you must ' +
          'change which proteins constitute the mass, or introduce a high-abundance protein of designed ' +
          'composition -- which is a foreign-addition problem bolted onto a composition problem.',
        is_a_single_edit: false,
        sub_verdict: VERDICTS.NEEDS_MEASUREMENT,
        the_catch:
          'The baseline is missing. zecic2019 gives the worm\'s DIETARY essential amino acids -- ' +
          'arginine, histidine, lysine, tryptophan, phenylalanine, methionine, threonine, leucine, ' +
          'isoleucine, valine, the same set as rat and human except arginine -- but what the worm must ' +
          'EAT is a different quantity from what an eater of worms would GET. No verified source for the ' +
          'latter was found (wormAminoAcidProfile). You cannot improve a profile you have not measured, ' +
          'so this sub-route is needs-measurement-first and carries no numbers.',
      },
    ],
    analogy_class: ANALOGY_CLASSES.POLYGENIC_QUANTITATIVE,
    why_that_analogy_class:
      'Composition is an emergent property of the whole organism\'s allocation of carbon and nitrogen ' +
      'across structure, storage and reproduction. There is no source organism with "more protein" whose ' +
      'allele could be mapped across, and no locus whose variants index the trait. The analogy vocabulary ' +
      'has nothing to bind to on either side: no source gene, no target orthologue, no measurable ' +
      'correspondence. What the request needs is a quantitative-genetics answer -- what is the heritable ' +
      'variance, which loci contribute, what are the correlated responses -- not a mapping.',
    the_question_that_decides_the_use_case: {
      question: 'Protein for whom?',
      answer:
        'It matters completely, and in the two plausible answers the content number is not the ' +
        'bottleneck. If the eater is a model organism or an aquaculture/insect feed, the limiting factors ' +
        'are DIGESTIBILITY and PRODUCTION COST, not content. If the eater is a human, the dossier is ' +
        'regulatory and allergenic long before it is compositional.',
      why_content_is_not_the_limiting_factor:
        'The worm is ALREADY roughly 60% protein by dry mass, and the bacteria it eats are already ' +
        'roughly 55% (zecic2019), which the same authors note is also about the protein fraction of ' +
        'mammalian cells. The trophic step from bacterium to worm therefore costs you most of the mass ' +
        'and buys you about five percentage points of protein fraction. There is very little headroom ' +
        'above 60% in any case: the remainder is membrane lipid, nucleic acid and the cuticle, none of ' +
        'which is optional. Raising a number that is already near its ceiling is the least valuable thing ' +
        'that could be done to this organism.',
      the_actual_limiting_factors: [
        'DIGESTIBILITY. The nematode cuticle is "composed predominantly of cross-linked collagens, ' +
          'additional insoluble proteins termed cuticlins, associated glycoproteins and lipids" ' +
          '(page2007). Insoluble and cross-linked is precisely the property that makes protein ' +
          'unavailable to a gut. The cross-links are enzymatically made di-tyrosine bonds, and ' +
          'disrupting the peroxidase that makes them yields a cuticle that loses those cross-links and ' +
          'becomes dye-permeable (thein2009) -- so cuticle digestibility is itself an editable property, ' +
          'and it is a DIFFERENT EDIT from anything that raises protein content, aimed at the factor ' +
          'that is actually limiting.',
        'PRODUCTION COST. C. elegans is a heme auxotroph and a sterol auxotroph, so axenic mass culture ' +
          'needs both supplied; the defined maintenance medium runs to 54 components and is "costly and ' +
          'time-consuming" (zecic2019). Growing worms on bacteria instead means the protein you are ' +
          'really producing is bacterial, with a trophic conversion loss on top. No edit to the worm ' +
          'moves this.',
      ],
      consequence:
        'If digestibility or cost is limiting, then a successful content edit delivers nothing ' +
        'measurable in the use case. This is the failure mode where the pipeline does exactly what it was ' +
        'asked and the result is worthless.',
    },
    what_would_have_to_be_measured: [
      'THE BASELINE, properly: macronutrient fractions of dry mass on gut-cleared or axenically grown ' +
        'worms, by a stated method, with the bacterial contribution excluded. The figure to beat is ' +
        'zecic2019: roughly 60% protein, 20% lipid, 6.5% nucleic acid, 6% carbohydrate -- and those ' +
        'authors state plainly that the biomass composition "has not yet been characterised in detail" ' +
        'and that their numbers are compiled from several earlier studies. The baseline for this request ' +
        'is a compilation, not a measurement, and that is the first thing to fix.',
      'TOTAL protein per worm as well as the fraction, plus energy density, so that a percentage gain ' +
        'achieved by losing lipid cannot be reported as a protein gain.',
      'Amino-acid profile of worm protein by hydrolysis and chromatography, compared against the ' +
        'requirement pattern of the intended consumer. This does not currently exist in this dossier ' +
        '(wormAminoAcidProfile).',
      'Digestibility of the worm, and separately of its cuticle fraction: in-vitro proteolysis, then ' +
        'in-vivo apparent digestibility in the intended consumer. Content times digestibility is the ' +
        'quantity the use case cares about; content alone is not.',
      'Anti-nutritional and safety screen appropriate to the consumer: residual bacterial endotoxin from ' +
        'the culture, and allergenicity, which for an invertebrate feed ingredient is a known class of ' +
        'concern rather than a worm-specific finding.',
      'Fitness and yield of any edited line under production conditions: brood size, generation time, ' +
        'biomass per litre, starvation and dauer survival. A lipid-depleted worm that yields half as much ' +
        'biomass has made the product worse.',
      'Correlated responses across the whole composition, not just the one number being optimised.',
    ],
    verdict: VERDICTS.POLYGENIC,
    verdict_reasoning:
      'Polygenic, not a single edit -- and the sharper statement is that the one sub-route that IS a ' +
      'single edit (lowering lipid) does not deliver the requested trait. Total protein is a whole-organism ' +
      'allocation outcome with no indexing locus; amino-acid profile has no measured baseline to improve ' +
      'on; and protein percentage is movable only by subtraction. On top of all three, the worm sits at ' +
      '~60% protein against food at ~55% and mammalian cells at ~60%, so the headroom is small and the ' +
      'binding constraints are digestibility and production cost. The honest verdict is that the request ' +
      'is pointed at the wrong variable of the right organism.',
    how_it_could_fail: [
      'THE NUMBER GOES UP BECAUSE LIPID WENT DOWN. The protein percentage rises, total protein does not, ' +
        'energy density falls, and the deliverable is leaner food reported as richer food.',
      'The measured gain is bacterial protein in the gut lumen and on the cuticle, because the assay was ' +
        'run on plate-grown worms and the food is itself ~55% protein (zecic2019).',
      'The edited line is sick: lipid, sterol and branched-chain fatty acids are required for growth, ' +
        'development and starvation survival (zecic2019), so a fat-depleted worm may lose brood size, ' +
        'dauer survival or viability -- costs that show up in yield, not in the composition assay.',
      'Total protein rises but the amino-acid profile is unchanged, so nutritional value per gram of ' +
        'protein is unchanged and the use case sees nothing.',
      'DIGESTIBILITY WAS LIMITING ALL ALONG. The cross-linked cuticle (page2007, thein2009) keeps the ' +
        'extra protein unavailable, and a real content gain yields no measurable nutritional gain.',
      'The baseline is taken from a compilation and treated as a measurement, so a change of a few ' +
        'percentage points is claimed against a figure whose own authors say the composition "has not yet ' +
        'been characterised in detail".',
      'Nobody asked who was going to eat it, so the project optimises a number with no consumer attached.',
    ],
    sources: src('zecic2019', 'perez2019', 'page2007', 'thein2009', 'wormAminoAcidProfile'),
  },

  {
    id: 'low-methane-cow',
    request: 'Cows that produce less methane',
    what_is_actually_being_asked:
      'Reduce enteric methane emission from cattle. The request names the cow because the cow is what ' +
      'belches, and that is the error. THE DECISIVE FACT: enteric methane is produced by METHANOGENIC ' +
      'ARCHAEA in the rumen, not by the cow. Methanogenesis is those archaea\'s energy metabolism ' +
      '(thauer2008), and its terminal, methane-forming step is catalysed by methyl-coenzyme M reductase, ' +
      'a nickel enzyme active only with Ni(I) (duin2016). The cow genome encodes no methanogenesis ' +
      'pathway and no MCR. There is nothing in the cow to knock out. Editing the cow is editing the wrong ' +
      'organism, and that is the finding, not a caveat on the finding.',
    target_organism: 'Bos taurus (as named in the request)',
    is_the_target_organism_the_right_one: false,
    why_the_target_is_or_is_not_right:
      'NO. The organism that performs the reaction is a methanogenic archaeon living in the cow, and the ' +
      'cow contributes the fermenter, the substrate supply and the hydrogen -- not the catalysis. The ' +
      'correct targets are (i) the rumen microbial community, (ii) the feed, where 3-NOP and halogenated ' +
      'seaweed compounds have real measured effects, and (iii) over generations, the cow\'s GENOME AS A ' +
      'SELECTION TARGET, which is a different thing from an edit target. The strongest evidence that the ' +
      'cow is the wrong organism to edit is the mechanism of the thing that works: 3-NOP reduces methane ' +
      'by inhibiting an enzyme the cow does not have, at concentrations that leave non-methanogenic rumen ' +
      'bacteria alone (duin2016).',
    route:
      'Three real routes, none of which is a cow edit.\n' +
      '  FEED ADDITIVE (best measured). 3-NOP binds the MCR active site and oxidises its Ni(I), ' +
      'inactivating the enzyme at micromolar concentrations and inhibiting methanogenic archaea ' +
      'selectively (duin2016). In vivo: ~30% lower methane across 12 weeks in 48 lactating Holstein cows ' +
      'at 40-80 mg/kg feed dry matter, with no loss of intake or milk yield and 80% greater body-weight ' +
      'gain than controls (hristov2015). Pooled across 14 experiments: 32.7% (production), 30.9% (yield), ' +
      '32.6% (intensity) at a mean 70.5 mg/kg DM, with efficacy declining as dietary NDF and crude fat ' +
      'rise (kebreab2022). Halogenated-compound seaweeds are the other additive class: methane yield down ' +
      '5.28 +/- 3.5 g/kg DMI pooled, one comparison at 97%, but I2 > 80% -- real and very dispersed ' +
      '(lean2021).\n' +
      '  MICROBIOME. The community is the actual site of action, but it is mostly environmentally set: ' +
      'saedi2026 concludes "the microbiota in the rumen is primarily determined by environmental factors, ' +
      'whereas host genetics has a significant impact on the abundance of certain functionally important ' +
      'microbes". Engineering a methanogen is conceivable and faces a hard ecological problem: the rumen ' +
      'is an open, continuously reinoculated chemostat, so an introduced strain must out-compete residents ' +
      'indefinitely with no selection applied.\n' +
      '  SELECTION, not editing. Difford 2018 partitioned individual variation in methane production as ' +
      '21% host heritability and 13% cumulative bacterial-plus-archaeal effect, "largely independent" ' +
      '(difford2018). A breeding programme can act on that. A cassette cannot.',
    analogy_class: ANALOGY_CLASSES.ASSOCIATED_COMMUNITY,
    why_that_analogy_class:
      'The trait belongs to an associated microbial community, not to the organism named in the request. ' +
      'This breaks the analogy vocabulary at the root: a mapping needs a source gene and a target ' +
      'orthologue IN THE SAME ORGANISM AS THE PHENOTYPE, and here the phenotype is measured on the cow ' +
      'while the genes that produce it are in archaea with no cow counterpart -- nor should they have ' +
      'one. An orthology search of the cow genome against a methanogenesis pathway returns nothing, and ' +
      'that empty result is the correct and complete answer to the request as phrased.',
    heritable_is_not_editable: {
      the_distinction:
        'HERITABLE means some of the variance between individuals in a population tracks their genotypes, ' +
        'so selecting parents shifts the offspring mean. EDITABLE means a known variant at a known locus ' +
        'causes a known change, so one animal can be changed on purpose. Methane yield is the first and ' +
        'not the second. Heritability is a variance ratio in a population under a particular management ' +
        'and diet; it is not a promise that a gene exists to cut.',
      the_figures: [
        { quantity: 'heritability of methane production', value: 0.21,
          note: 'with a cumulative bacterial + archaeal contribution of 0.13, and the two "largely ' +
            'independent", so breeding the cow does not work by reshaping its methanogens',
          source: 'difford2018' },
        { quantity: 'heritability of methane', value: '0.08 to 0.14',
          note: 'more recent, lower bracket; 16S genus-level features separately explained 28% of ' +
            'phenotypic variation in methane',
          source: 'saedi2026' },
        { quantity: 'heritability of rumen microbiota composition', value: '0.05 to 0.40',
          note: 'depending on taxonomic group or microbial gene function; the review also notes that ' +
            'incorporation of methane traits into breeding programmes "is still scarce"',
          source: 'gonzalezRecio2023' },
        { quantity: 'heritability of individual microbial features', value: 'up to 0.95-0.98 for specific taxa',
          note: 'a minority of features are strongly host-controlled even though the community overall is ' +
            'environmentally determined -- which is what makes microbiome-informed breeding a live idea ' +
            'and not a contradiction',
          source: 'saedi2026' },
      ],
      what_follows:
        'Non-zero but modest, and population-level. No causal variant of large effect has been named, so ' +
        'there is no edit to propose. Genomic selection on a measured methane phenotype is the actionable ' +
        'genetic route, it acts over generations, and it competes for index weight against production ' +
        'traits. A design system that reads h2 = 0.21 as "a gene to edit" has made the central error this ' +
        'case exists to expose.',
    },
    what_would_have_to_be_measured: [
      'The cheap, decisive negative control FIRST: search the cow reference genome and proteome for ' +
        'methyl-coenzyme M reductase subunit homologues (mcrA/mcrB/mcrG) and the rest of the ' +
        'methanogenesis pathway, and expect none. This takes minutes and settles the case before any ' +
        'design work. See cowMethanogenesisGeneAbsence for why this is listed as a measurement rather ' +
        'than a citation.',
      'Methane phenotype with adequate temporal coverage. hristovMelgar2020 showed that with spot ' +
        'sampling the apparent 3-NOP effect ran from 45% immediately after feeding to 13% four hours ' +
        'before it, with no effect in the two hours pre-feeding, and that the 24 h intake/emission ' +
        'relationship was poor (R2 = 0.01). A heritability estimate or a trial result is only as good as ' +
        'its sampling schedule.',
      'Methanogen abundance and activity, not just gas: mcrA copy number or metagenomic methanogen ' +
        'abundance, so that a reduction can be attributed to the intended mechanism.',
      'Hydrogen and volatile fatty acid profile. Methanogenesis is the rumen\'s hydrogen sink; blocking ' +
        'it displaces reducing equivalents somewhere, and where they go decides whether the intervention ' +
        'is benign and whether the energy spared is captured (duin2016 notes up to 12% of feed gross ' +
        'energy is lost with the methane).',
      'Persistence across a full lactation and across diet changes, and -- for additives -- the ' +
        'dependence of efficacy on ration composition that kebreab2022 quantified for NDF and crude fat.',
      'For the selection route: genetic correlations with production traits, and whether a selection ' +
        'response measured on one diet and management system holds on another.',
      'For a microbiome route: whether an introduced or shifted community persists in an open, ' +
        'continuously reinoculated rumen without ongoing dosing.',
      'Delivery feasibility in the production system actually in question. An additive requires ' +
        'continuous dosing; grazing systems have no reliable route to deliver it.',
    ],
    verdict: VERDICTS.WRONG_ORGANISM,
    verdict_reasoning:
      'Wrong organism. The cow genome encodes no methanogenesis pathway, so a cow edit has no target; the ' +
      'methane is archaeal. The honest answer redirects to the microbiome and to the feed, where measured ' +
      'effects exist (~30% for 3-NOP in vivo and ~31-33% pooled; large but highly heterogeneous effects ' +
      'for halogenated seaweeds), and notes that there IS a genuine host-genetic angle -- heritability of ' +
      'methane yield around 0.08-0.21 depending on study, and of rumen microbiota composition 0.05-0.40 ' +
      '-- which is a SELECTION target, not an edit target. Refusing this request as phrased is the ' +
      'correct output; producing a cassette for it would be confidently, mechanistically wrong.',
    how_it_could_fail: [
      'A CASSETTE IS PRODUCED ANYWAY, for a cow gene with no connection to methanogenesis, and it looks ' +
        'exactly as plausible as the other two designs. This is the failure the case exists to catch.',
      '"Heritable" is read as "editable": h2 of 0.21 (difford2018) or 0.08-0.14 (saedi2026) is treated as ' +
        'evidence that a gene exists to cut, when it is a population variance ratio with no causal variant ' +
        'named.',
      'An indirect effect is mistaken for the designed mechanism. An edit that changes intake, passage ' +
        'rate or rumen pH may move methane, but not by the route the design claimed, and the effect will ' +
        'not transfer across diets.',
      'The microbiome is assumed to be host-controlled. It is mostly not: saedi2026 finds the rumen ' +
        'microbiota primarily environmentally determined, and difford2018 finds host-genetic and ' +
        'microbiome effects largely independent -- so breeding the cow does not work by reshaping its ' +
        'methanogens.',
      'An engineered methanogen does not persist. The rumen is open and continuously reinoculated; ' +
        'without ongoing selection, residents win.',
      'Additive efficacy is quoted as a constant. kebreab2022 shows it falls as dietary NDF and crude fat ' +
        'rise, so a ~32% figure from a mixed ration does not transfer to a high-forage diet.',
      'The seaweed headline is quoted from the tail. lean2021 reports a pooled reduction of 5.28 +/- 3.5 ' +
        'g/kg DMI with I2 > 80%; the single 97% comparison is not the expected effect.',
      'The phenotype is mis-measured. With spot sampling, the same intervention reads anywhere from 45% ' +
        'to 13% depending on time since feeding (hristovMelgar2020), so a trial or a heritability estimate ' +
        'can be an artefact of its schedule.',
      'Displaced hydrogen goes somewhere unaccounted for, and the intervention has effects nobody measured.',
      'The intervention has no delivery route in the target production system, so a result from housed, ' +
        'ration-fed cows is claimed for grazing ones.',
    ],
    sources: src('thauer2008', 'duin2016', 'hristov2015', 'kebreab2022', 'lean2021', 'difford2018',
      'saedi2026', 'gonzalezRecio2023', 'hristovMelgar2020', 'cowMethanogenesisGeneAbsence'),
  },
]);

// ---------------------------------------------------------------------------------------------------
// CRISPR_RELEVANCE -- is a CRISPR cassette even the right tool?
// ---------------------------------------------------------------------------------------------------

export const CRISPR_RELEVANCE = deepFreeze([
  {
    case_id: 'glowing-fly',
    is_crispr_the_right_tool: false,
    why:
      'The function is being ADDED, not altered, so there is no endogenous fly locus whose sequence needs ' +
      'changing -- and CRISPR\'s distinctive capability is making a specified change at a specified ' +
      'existing site. The classic and still-standard route is germline TRANSGENESIS: P-element ' +
      'transposition (rubin1982), piggyBac, or -- the modern default -- phiC31 integrase recombination ' +
      'into a characterised genomic attP docking site, which gave precise single-site integration in 100% ' +
      'of transgenic progeny (groth2004). CRISPR-mediated knock-in at a safe harbour is entirely possible ' +
      'and is sometimes preferable, but note what it buys: single copy at a defined position, i.e. ' +
      'POSITION CONTROL. It does not help with the function, because the function needs no fly gene.',
    crispr_is_possible_but_not_required: true,
    when_crispr_would_be_the_better_choice:
      'When the cassette must sit at a specific locus under endogenous regulation -- a knock-in ' +
      'fluorescent tag on a native gene, reporting that gene\'s own expression at its own level -- or ' +
      'when no characterised attP landing site exists in the strain of interest. For a plain ubiquitous ' +
      'reporter, transgenesis is simpler, older and better characterised.',
    preferred_tool: 'phiC31 site-specific integration at a characterised attP landing site; ' +
      'P-element or piggyBac transposition where a landing site is unavailable',
    right_tool_wrong_target: false,
  },
  {
    case_id: 'protein-worm',
    is_crispr_the_right_tool: false,
    why:
      'RIGHT TOOL, WRONG TARGET -- and this is the subtlest of the three. CRISPR-Cas9 editing in ' +
      'Caenorhabditis elegans is routine and precise, so the tool is not the obstacle. The obstacle is ' +
      'that no single locus maps onto the requested trait. Total protein is a whole-organism allocation ' +
      'outcome; amino-acid profile is a proteome-wide weighted average with no measured baseline ' +
      '(wormAminoAcidProfile); and the one sub-route a single edit CAN serve -- knocking out a ' +
      'fatty-acid desaturase or a fat-storage gene to raise the protein PERCENTAGE -- raises the ' +
      'percentage by removing lipid, delivering a leaner worm rather than a higher-protein one. Issuing a ' +
      'cassette here would be technically sound and substantively wrong, which is the most dangerous ' +
      'combination a design system can produce.',
    crispr_is_possible_but_not_required: true,
    when_crispr_would_be_the_better_choice:
      'For the limiting factor rather than the requested one. If digestibility is what actually binds, ' +
      'then editing cuticle cross-linking is a genuine single-locus CRISPR target with a mechanistic ' +
      'rationale: disrupting the peroxidase MLT-7 yields a cuticle lacking di-tyrosine cross-links and ' +
      'permeable to dye (thein2009). That is a defensible cassette -- for a different question than the ' +
      'one asked, and it comes with a viability cost that would have to be measured.',
    preferred_tool: 'quantitative genetics first (measure the heritable variance and the baseline ' +
      'properly), then CRISPR only if a locus with a causal, measured effect on the SPECIFIC composition ' +
      'variable is identified',
    right_tool_wrong_target: true,
  },
  {
    case_id: 'low-methane-cow',
    is_crispr_the_right_tool: false,
    why:
      'CRISPR ON THE COW IS BESIDE THE POINT. The cow genome encodes no methanogenesis pathway and no ' +
      'methyl-coenzyme M reductase, so there is no sequence to cut: the methane is made by archaea ' +
      '(thauer2008), and the one intervention whose mechanism is nailed down works by inhibiting that ' +
      'archaeal enzyme while leaving non-methanogenic rumen bacteria and the host untouched (duin2016). ' +
      'Editing the methanogens is at least aimed at the right genomes, but the rumen is an open, ' +
      'continuously reinoculated community, so an edited strain must out-compete residents indefinitely ' +
      'with no selection applied -- an ecological problem, not an editing one. The tools that do work are ' +
      'a feed additive (hristov2015, kebreab2022, lean2021) and, over generations, genomic selection on a ' +
      'measured methane phenotype (difford2018, saedi2026).',
    crispr_is_possible_but_not_required: false,
    when_crispr_would_be_the_better_choice:
      'Never, for this request as phrased. The honest output is a refusal plus a redirect. If the goal is ' +
      'restated as "reduce methane from a herd", the answer is an additive now and selection over ' +
      'generations; neither is a cassette.',
    preferred_tool: 'feed additive (3-NOP; halogenated-compound seaweed, with its heterogeneity ' +
      'acknowledged) plus genomic selection on a well-measured methane phenotype',
    right_tool_wrong_target: false,
  },
]);

/** The warning this table exists to deliver. */
export const THE_HAMMER = deepFreeze({
  statement: 'A design system that answers "CRISPR cassette" to every request is a hammer.',
  evidence_from_this_set:
    'Of three requests chosen by the project lead, CRISPR is the right tool for NONE of them as phrased. ' +
    'Case 1 wants transgenesis, because the function is added rather than altered. Case 2 is the right ' +
    'tool pointed at the wrong target -- editing is easy in the worm and no single locus delivers the ' +
    'trait. Case 3 has no target in the named organism at all. The tool was never the scarce thing.',
  the_discipline:
    'Name the mechanism before naming the tool, and name the organism that performs the mechanism before ' +
    'naming the organism in the request. Both checks are cheap, and each one of them catches a different ' +
    'case in this set.',
});

// ---------------------------------------------------------------------------------------------------
// THE_SHARED_LESSON
// ---------------------------------------------------------------------------------------------------

export const THE_SHARED_LESSON = deepFreeze({
  statement:
    'These three requests fail in three different ways: one is not a mapping problem, one is not a ' +
    'single-edit problem, and one is not about the named organism at all. ONLY ONE OF THE THREE IS A ' +
    'GENOME-EDITING PROBLEM IN THE SHAPE THE PIPELINE ASSUMES, and a system that silently produced a ' +
    'cassette for all three would be wrong three times in three different ways.',

  only_one_is_a_genome_editing_problem: 'glowing-fly',
  and_even_that_one:
    'is not a CRISPR problem but a transgenesis problem, and the deliverable is probably not what was ' +
    'asked for: fluorescence needs excitation light, so the fly does not glow in the dark.',

  three_distinct_failure_modes: [
    {
      case_id: 'glowing-fly',
      not_a: 'mapping problem',
      because:
        'the function is ADDED, not transferred. There is no fly orthologue of GFP and none is needed; ' +
        'the chromophore forms spontaneously from the protein\'s own residues given oxygen (heim1994), ' +
        'which is why the same gene works in hosts as distant as a jellyfish and a fly. An orthology ' +
        'search returns nothing, and that empty result is not evidence against the design.',
      what_the_pipeline_would_get_wrong:
        'It would run an orthologue search, find nothing, and either refuse a feasible design or invent ' +
        'a correspondence that does not exist. Then it would resolve "glows" to GFP and hand back ' +
        'fluorescence to someone who wanted bioluminescence.',
      verdict: VERDICTS.ADDABLE,
    },
    {
      case_id: 'protein-worm',
      not_a: 'single-edit problem',
      because:
        'composition is a quantitative, polygenic, whole-organism allocation outcome with no indexing ' +
        'locus. The worm is already ~60% protein by dry mass against bacterial food at ~55% and ' +
        'mammalian cells at ~60% (zecic2019), so the headroom is small; and the request hides three ' +
        'different targets -- total protein, protein:lipid ratio, amino-acid profile -- with three ' +
        'different verdicts.',
      what_the_pipeline_would_get_wrong:
        'It would find the one sub-route a single edit can serve (knock out a desaturase, raise the ' +
        'protein PERCENTAGE), emit a technically correct cassette, and report a composition win that is ' +
        'really a lipid loss. Meanwhile the factors that actually bind the use case -- digestibility of ' +
        'the cross-linked cuticle, and the cost of producing worm biomass at all -- would never be ' +
        'mentioned, because nothing in the request pointed at them.',
      verdict: VERDICTS.POLYGENIC,
    },
    {
      case_id: 'low-methane-cow',
      not_a: 'problem about the named organism',
      because:
        'enteric methane is produced by methanogenic archaea in the rumen. Methanogenesis is their ' +
        'energy metabolism (thauer2008) and the cow genome encodes none of it -- which is exactly why ' +
        '3-NOP works: it inhibits an archaeal enzyme the cow does not have (duin2016). The genuine ' +
        'host-genetic angle is real and modest (h2 ~0.21 in difford2018, 0.08-0.14 in saedi2026; rumen ' +
        'microbiota composition 0.05-0.40 in gonzalezRecio2023) and it is a SELECTION target, not an ' +
        'edit target.',
      what_the_pipeline_would_get_wrong:
        'It would read a non-zero heritability as a gene to cut, and emit a cow cassette with the same ' +
        'confidence as the other two. Nothing downstream would catch it, because the cassette would be ' +
        'well-formed; it would simply have no mechanism.',
      verdict: VERDICTS.WRONG_ORGANISM,
    },
  ],

  the_three_checks_that_catch_them: [
    'Is the function being ADDED or TRANSFERRED? If added, orthology is irrelevant and "no orthologue ' +
      'found" is not a refusal. (Catches case 1.)',
    'Is the trait a single-locus property or a whole-organism quantitative one? If quantitative, ask ' +
      'what the heritable variance is and what the baseline measurement actually is before proposing any ' +
      'edit -- and check whether the requested variable is the limiting one. (Catches case 2.)',
    'WHICH ORGANISM PERFORMS THE MECHANISM? Not which organism displays the phenotype. If the answer is ' +
      'not the organism in the request, stop. (Catches case 3.)',
  ],

  what_a_silent_pipeline_would_have_produced:
    'Three well-formed CRISPR cassettes, indistinguishable in presentation, each confidently wrong in a ' +
    'different way: one unnecessary (the function needed no edit), one technically correct and ' +
    'substantively empty (the right tool on the wrong variable), and one with no target in the genome it ' +
    'addressed. The uniformity of the output would be the tell, and nothing in the output would show it.',

  why_the_set_is_three_and_not_one:
    'A single failing case teaches a pipeline to handle that case. Three cases failing in three ' +
    'DIFFERENT ways cannot be absorbed by a special-case rule; they force the three checks above to be ' +
    'run on every request. That is the point of the set.',

  the_honesty_rule:
    'None of these three verdicts is the one the requester wanted. Case 1 delivers less than it sounds ' +
    'like; case 2 delivers a number that does not mean what it says; case 3 delivers a refusal. A ' +
    'system that could not return any of those three answers would have no way to be useful on the ' +
    'requests where the answer is genuinely yes.',
});

/**
 * Cross-check our analogy_class strings against the shared vocabulary in ./analogy.mjs, IF that module
 * exists yet. A sibling thread owns it; this file must build, test and report without it.
 *
 * Returns { available, module_error, classes_used, recognised, unrecognised, vocabulary_source }.
 * Never throws: an absent or broken sibling degrades to `available: false`.
 */
export async function crossCheckAnalogyVocabulary() {
  const classesUsed = [...new Set(CASES.map((c) => c.analogy_class))];
  let mod = null, moduleError = null;
  try {
    mod = await import('./analogy.mjs');
  } catch (e) {
    moduleError = String(e && e.message ? e.message : e);
  }
  if (!mod) {
    return deepFreeze({
      available: false,
      module_error: moduleError,
      classes_used: classesUsed,
      recognised: [],
      unrecognised: [],
      vocabulary_source: null,
      note: 'analogues/analogy.mjs is not importable yet; the local vocabulary in ANALOGY_CLASSES stands ' +
        'on its own and no cross-check was performed. This is not a failure.',
    });
  }
  // Accept any of several plausible export shapes rather than guessing one and breaking on it.
  let vocab = null, source = null;
  for (const name of ['ANALOGY_CLASSES', 'ANALOGY_CLASS', 'CLASSES', 'VOCABULARY', 'ANALOGY_VOCABULARY']) {
    const v = mod[name];
    if (!v) continue;
    const vals = Array.isArray(v) ? v : Object.values(v);
    const flat = vals.map((x) => (typeof x === 'string' ? x : (x && (x.id || x.name || x.class)) || null))
      .filter((x) => typeof x === 'string');
    if (flat.length) { vocab = flat; source = name; break; }
  }
  if (!vocab) {
    return deepFreeze({
      available: false,
      module_error: 'analogy.mjs imported but exported no recognisable class vocabulary',
      classes_used: classesUsed,
      recognised: [],
      unrecognised: [],
      vocabulary_source: null,
      note: 'The sibling module exists but its vocabulary export was not found under any expected name. ' +
        'Reporting that rather than silently passing.',
    });
  }
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const known = new Set(vocab.map(norm));
  const unrecognised = classesUsed.filter((c) => !known.has(norm(c)));
  return deepFreeze({
    available: true,
    module_error: null,
    classes_used: classesUsed,
    recognised: classesUsed.filter((c) => known.has(norm(c))),
    unrecognised,
    vocabulary_source: source,
    sibling_vocabulary: vocab,
    axes_differ: unrecognised.length === classesUsed.length,
    interpretation:
      'The two vocabularies measure DIFFERENT AXES, so a total mismatch here is expected and is not an ' +
      'error. The sibling vocabulary is a ladder of ORTHOLOGY EVIDENCE -- does a one-to-one orthologue ' +
      'exist, and has its function been tested -- which answers "how good is this correspondence". ' +
      'ANALOGY_CLASSES in this file answers the prior question, "is there a correspondence to grade at ' +
      'all", and its three values are the three ways this set answers no. The cases interact rather than ' +
      'conflict: run the sibling ladder on the glowing-fly case and it must return its bottom rung ' +
      '(no basis for an orthology claim), which is CORRECT and MISLEADING at the same time -- there is ' +
      'no basis because the function is being added, not transferred, so the bottom rung is a reason to ' +
      'proceed rather than a reason to refuse. Reconciling the names would hide that; recording the ' +
      'orthogonality keeps it visible.',
    note: 'Unrecognised classes here are an axis difference, not a naming error to be papered over, and ' +
      'not an error in these verdicts.',
  });
}

/** Every source referenced by any case, deduplicated by key. */
export const ALL_SOURCES = deepFreeze(
  Object.values(S).filter((s) => CASES.some((c) => c.sources.includes(s))),
);

/** Sources that deliberately carry no identifier, with the reason. The absence is part of the record. */
export const NULL_SOURCES = deepFreeze(ALL_SOURCES.filter((s) => s.doi === null && s.pmid === null));

export const PROVENANCE = deepFreeze({
  dir: HERE,
  attribution: 'Article metadata, abstracts and one full text were retrieved from PubMed (including PMC ' +
    'for PMC6501307). Per the PubMed terms, PubMed-derived information is attributed here and a DOI is ' +
    'given for every article cited.',
  doi_base: 'https://doi.org/',
  how_each_citation_was_checked: 'Each source carries a `verified_how` field naming what was actually ' +
    'read back from the record. Where a wanted number had no checkable source, the entry is null with a ' +
    '`null_reason`: a fabricated DOI is worse than none.',
  doi_resolution_check: 'Independently of the PubMed records, all 20 non-null DOIs were resolved against ' +
    'api.crossref.org on 2026-11-06 and every one returned a work whose title and year matched the ' +
    'citation recorded here. Two checks, not one: PubMed paired each DOI with its PMID and abstract, and ' +
    'Crossref confirmed each DOI resolves to the article named. (Five of the twenty first returned HTTP ' +
    '429 and resolved on retry with backoff; a rate limit is not a bad identifier, and treating it as ' +
    'one would have been the easy wrong conclusion.)',
  doi_resolution_checked_at: '2026-11-06',
  null_source_count: NULL_SOURCES.length,
});

export default deepFreeze({ CASES, CRISPR_RELEVANCE, THE_SHARED_LESSON, THE_HAMMER, VERDICTS,
  ANALOGY_CLASSES, ALL_SOURCES, NULL_SOURCES, PROVENANCE });
