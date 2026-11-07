#!/usr/bin/env node
// dynamics.mjs - THE RATES AND DURATIONS THAT MAKE A MOLECULAR ANIMATION HONEST ABOUT TIME.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// The viewer this module feeds zooms from a whole embryo down to a single machine on a chromosome: a
// ribosome, an RNA polymerase, a replisome, a nucleosome. The 3D POSITIONS in that view are generated.
// They are a depiction. Nothing here simulates physics, and the viewer must say so.
//
// But the moment the viewer MOVES a polymerase it has chosen a speed, and a speed is not a depiction.
// It is a claim with units. A viewer that draws a replisome sliding along DNA at an invented rate is
// telling the reader something false about the cell in exactly the register where readers trust
// pictures most: the register of "how fast does this actually happen". So this module is the evidence
// layer for every number the animation needs in order to put a clock on itself. It contains no
// rendering code and no geometry.
//
// The separation it exists to enforce:
//
//   INVENTED   where each molecule sits, which way it faces, how the DNA curves, what colour anything
//              is, how crowded the volume looks. All of it. The viewer labels this.
//   RETRIEVED  every rate, duration, count and spacing. Each one below carries the organism, the cell
//              type, the method, a DOI or PMID, and a `verified_how` saying what was fetched this
//              session and what was read back off it.
//   REFUSED    numbers that could not be retrieved. Those are written as nulls with a reason and with
//              what would resolve them. See NUMBERS_WE_DECLINED. A null with a reason is worth more
//              than a plausible number, because a plausible number is indistinguishable from a
//              retrieved one once it is inside a picture.
//
// ============================== THE THING THAT SURPRISED US ==============================
// See THE_SIXTY_HERTZ_COINCIDENCE at the bottom. The short version: we expected to find that molecular
// machines are far too fast to animate and would need heroic slow-motion. They are not. A mammalian
// ribosome adds about 5.6 amino acids a second, and a 60 Hz display shows 60 frames a second, so a
// chemically honest ribosome is about ten times too SLOW to give one residue per frame. The process
// that cannot be shown in real time is not the molecule. It is the cell cycle around it.
//
// ============================== ORGANISM DISCIPLINE ==============================
// A rate measured in a microbe is not a rate about a mouse, and a rate measured in cultured mouse stem
// cells is not a rate about a mouse liver. Every entry names its organism, its cell type and its growth
// state, and the bacterial entries are kept in a separate block labelled as a CONTRAST rather than mixed
// into the mammalian ones. Where two methods on the same question disagree, both are recorded with their
// sources and the disagreement is named. Nothing here is averaged across methods: see WHY_NOT_AVERAGED.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). This module names no
// member of it and reads no datum from it. Run `node holdout/check-leaks.mjs sim-engine/scales/molecular`.
//
//   node sim-engine/scales/molecular/dynamics.mjs       # print the worked figures
//   node sim-engine/scales/molecular/test-dynamics.mjs  # the tests

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

// ---------------------------------------------------------------------------- sources

/**
 * Every source actually retrieved in the session that wrote this file. `how` records the retrieval, not
 * the citation: a citation can be copied from another paper's reference list, a retrieval cannot.
 */
export const CITATIONS = deepFreeze({
  zhao_2020: {
    cite: 'Zhao PA, Sasaki T, Gilbert DM (2020) High-resolution Repli-Seq defines the temporal choreography of initiation, elongation and termination of replication in mammalian cells. Genome Biology 21:76.',
    doi: '10.1186/s13059-020-01983-8', pmid: '32209126', pmcid: 'PMC7092589',
    how: 'PubMed MCP metadata for PMID 32209126, then a live fetch of the PMC article page, which returned the sentences "the median speed of fork progression for both human and mouse was between 1.7 and 1.8 kb/min" and "with the exception of HCT116, which has a median of 2 kb/min".',
  },
  jonkers_2014: {
    cite: 'Jonkers I, Kwak H, Lis JT (2014) Genome-wide dynamics of Pol II elongation and its interplay with promoter proximal pausing, chromatin, and exons. eLife 3:e02407.',
    doi: '10.7554/eLife.02407', pmid: '24843027', pmcid: 'PMC4001325',
    how: 'PubMed MCP full text of PMC4001325, which returned "average elongation rates of 0.5, 1.8 and 2.4 kb/min respectively", standard deviations "0.43 kb/min, 0.69 kb/min and 0.79 kb/min", and "On average, Pol II travels about 100 kb during 50 min of FP treatment. This corresponds to an elongation rate of about 2 kb/min".',
  },
  darzacq_2007: {
    cite: 'Darzacq X, Shav-Tal Y, de Turris V, Brody Y, Shenoy SM, Phair RD, Singer RH (2007) In vivo dynamics of RNA polymerase II transcription. Nature Structural & Molecular Biology 14:796-806.',
    doi: '10.1038/nsmb1280', pmid: '17676063', pmcid: 'PMC4942130',
    how: 'PubMed MCP metadata for PMID 17676063 plus a live fetch of the PMC page, which returned "Polymerases elongated at 4.3 kilobases min-1, much faster than previously documented" and identified the cell line as human U2OS clone 2-3-6 carrying about 200 integrated copies of a reporter cassette.',
  },
  singh_padgett_2009: {
    cite: 'Singh J, Padgett RA (2009) Rates of in situ transcription and splicing in large human genes. Nature Structural & Molecular Biology 16:1128-1133.',
    doi: '10.1038/nsmb.1666', pmid: '19820712', pmcid: 'PMC2783620',
    how: 'PubMed MCP metadata for PMID 19820712; the abstract states "the rate of RNA polymerase II transcription over long genomic distances is about 3.8 kb min(-1)".',
  },
  ingolia_2011: {
    cite: 'Ingolia NT, Lareau LF, Weissman JS (2011) Ribosome profiling of mouse embryonic stem cells reveals the complexity and dynamics of mammalian proteomes. Cell 147:789-802.',
    doi: '10.1016/j.cell.2011.10.002', pmid: '22056041', pmcid: 'PMC3225288',
    how: 'PubMed MCP full text of PMC3225288, which returned "ribosomes progress from the 5\' ends of transcripts at a rate of 5.6 amino acids per second", a stated ~60 s lag for harringtonine engagement, "a typical elongation rate of ~6 codons per second", and the cell line "E14 mESCs".',
  },
  pham_2013: {
    cite: 'Pham TM, Tan KW, Sakumura Y, Okumura K, Maki H, Akiyama MT (2013) A single-molecule approach to DNA replication in Escherichia coli cells demonstrated that DNA polymerase III is a major determinant of fork speed. Molecular Microbiology 90:584-596.',
    doi: '10.1111/mmi.12386', pmid: '23998701',
    how: 'PubMed MCP metadata for PMID 23998701; the abstract states "the speed of most replication forks in the cells to be within the narrow range of 550-750 nt s(-1) and the average speed to be 653 +/- 9 nt s(-1) (+/- SEM)", a dnaE173 mutant average of "264 +/- 9 nt s(-1)", and Pol III chain elongation rates of 300 and 900 nt/s for mutant and wild type.',
  },
  proshkin_2010: {
    cite: 'Proshkin S, Rahmouni AR, Mironov A, Nudler E (2010) Cooperation between translating ribosomes and RNA polymerase in transcription elongation. Science 328:504-508.',
    doi: '10.1126/science.1184939', pmid: '20413502', pmcid: 'PMC2930199',
    how: 'PubMed MCP metadata for PMID 20413502 plus a live fetch of the PMC page, which returned a transcription elongation rate of 42 nt/s with a matching translation elongation rate of 14 aa/s for E. coli MG1655 in exponential LB growth, and Table 1 values of 21 nt/s with 7 aa/s in stationary phase and 31 nt/s with 10 aa/s on glycerol.',
  },
  young_bremer_1976: {
    cite: 'Young R, Bremer H (1976) Polypeptide-chain-elongation rate in Escherichia coli B/r as a function of growth rate. Biochemical Journal 160:185-194.',
    doi: '10.1042/bj1600185', pmid: '795428', pmcid: 'PMC1164221',
    how: 'PubMed MCP metadata for PMID 795428; the abstract states "17 amino acids/s for the fast-growing cells (mu equals 1.3 and 2.0 doublings/h) and 12 amino acids/s for slow-growing cells (mu equals 0.67 doublings/h)".',
  },
  vogel_jensen_1994: {
    cite: 'Vogel U, Jensen KF (1994) The RNA chain elongation rate in Escherichia coli depends on the growth rate. Journal of Bacteriology 176:2807-2813.',
    doi: '10.1128/jb.176.10.2807-2813.1994', pmid: '7514589', pmcid: 'PMC205433',
    how: 'PubMed MCP metadata for PMID 7514589 and a PMC full-text request that returned an EMPTY body (this 1994 issue is scanned page images only), plus a live fetch of the PMC page that confirmed only the abstract is machine-readable. So the DIRECTION of the effect was retrieved - "The elongation rate for the transcripts decreased 40% when the growth rate decreased by a factor of 4" and the untranslated rRNA chain "was elongated nearly twice as fast" - and no absolute nt/s value was.',
  },
  huang_2023: {
    cite: 'Huang D, Johnson AE, Sim BS, Lo TW, Merrikh H, Wiggins PA (2023) The in vivo measurement of replication fork velocity and pausing by lag-time analysis. Nature Communications 14:1762.',
    doi: '10.1038/s41467-023-37456-2', pmid: '36997519', pmcid: 'PMC10063678',
    how: 'PubMed MCP full text of PMC10063678. The prose was retrieved but the PMC conversion had stripped the inline numeric values out of the result sentences, so only the qualitative findings were read back: fork velocity is both locus- and time-dependent in wild-type cells, oscillations of roughly 0.5 peak-to-peak relative amplitude with a period of 10 to 15 minutes appear in three bacterial species, and fork velocity falls as the number of active forks rises.',
  },
  chao_2019: {
    cite: 'Chao HX, Fakhreddin RI, Shimerov HK, Kedziora KM, Kumar RJ, Perez J, Limas JC, Grant GD, Cook JG, Gupta GP, Purvis JE (2019) Evidence that the human cell cycle is a series of uncoupled, memoryless phases. Molecular Systems Biology 15:e8604.',
    doi: '10.15252/msb.20188604', pmid: '30886052', pmcid: 'PMC6423720',
    how: 'PubMed MCP metadata for PMID 30886052 plus a live fetch of the PMC page, which returned phase durations across three human lines (hTERT RPE-1, U2OS, H9): G1 "ranging from 2.1 h in H9 to 7.9 h in RPE", "S (7.6-10.1 h)", "G2 (3.4-4.0 h)" and M "~ 0.5 h" / "~ 30 min". The fetch also reported that the per-line values live only in Figure 1B and that the Figure 1B legend describes the bars as means with standard deviation.',
  },
  foe_alberts_1983: {
    cite: 'Foe VE, Alberts BM (1983) Studies of nuclear and cytoplasmic behaviour during the five mitotic cycles that precede gastrulation in Drosophila embryogenesis. Journal of Cell Science 61:31-70.',
    doi: '10.1242/jcs.61.1.31', pmid: '6411748',
    how: 'PubMed MCP metadata for PMID 6411748; the abstract states "The average duration of nuclear cycles 10, 11, 12 and 13 is about 9, 10, 12 and 21 min, respectively (25 degrees C)", that the envelope-free portion of mitosis lasts "3, 3, 3 and 5 min", and that cycle 14 has "the shortest cycles being of 65 min duration".',
  },
  kane_kimmel_1993: {
    cite: 'Kane DA, Kimmel CB (1993) The zebrafish midblastula transition. Development 119:447-456.',
    doi: '10.1242/dev.119.2.447', pmid: '8287796',
    how: 'PubMed MCP metadata for PMID 8287796; the abstract states that the midblastula transition "begins at cycle 10" and supersedes "a 15 minute oscillator that controls the first nine cycles".',
  },
  newport_kirschner_1982: {
    cite: 'Newport J, Kirschner M (1982) A major developmental transition in early Xenopus embryos: I. characterization and timing of cellular changes at the midblastula stage. Cell 30:675-686.',
    doi: '10.1016/0092-8674(82)90272-0', pmid: '6183003',
    how: 'PubMed MCP metadata for PMID 6183003; the abstract states "The Xenopus embryo undergoes 12 rapid synchronous cleavages followed by a period of slower asynchronous divisions more typical of somatic cells" and gives NO per-cycle duration.',
  },
  farrell_ofarrell_2014: {
    cite: 'Farrell JA, O\'Farrell PH (2014) From egg to gastrula: how the cell cycle is remodeled during the Drosophila mid-blastula transition. Annual Review of Genetics 48:269-294. REVIEW, not a primary measurement.',
    doi: '10.1146/annurev-genet-111212-133531', pmid: '25195504', pmcid: 'PMC4484755',
    how: 'PubMed MCP metadata for PMID 25195504; the abstract states "Many, if not most, embryos begin development with extremely short cell cycles that exhibit unusually rapid DNA replication and no gap phases" and that the Drosophila changes "extend S phase and introduce a post-replicative gap phase, G2".',
  },
  sharova_2009: {
    cite: 'Sharova LV, Sharov AA, Nedorezov T, Piao Y, Shaik N, Ko MSH (2009) Database for mRNA half-life of 19 977 genes obtained by DNA microarray analysis of pluripotent and differentiating mouse embryonic stem cells. DNA Research 16:45-58.',
    doi: '10.1093/dnares/dsn030', pmid: '19001483', pmcid: 'PMC2644350',
    how: 'PubMed MCP metadata for PMID 19001483; the abstract states "Median estimated half-life was 7.1 h and only <100 genes ... showed half-life less than 1 h" for mouse embryonic stem cells.',
  },
  mathieson_2018: {
    cite: 'Mathieson T, Franken H, Kosinski J, Kurzawa N, Zinn N, Sweetman G, Poeckel D, Ratnu VS, Schramm M, Becher I, Steidel M, Noh K-M, Bergamini G, Beck M, Bantscheff M, Savitski MM (2018) Systematic analysis of protein turnover in primary cells. Nature Communications 9:689.',
    doi: '10.1038/s41467-018-03106-1', pmid: '29449567', pmcid: 'PMC5814408',
    how: 'PubMed MCP metadata for PMID 29449567 (abstract: "exact determination of protein half-lives ranging from 10 to >1000 h", non-dividing cell types) plus a live fetch of the PMC page asking specifically for a per-cell-type median, which came back NEGATIVE: the paper reports no proteome-wide median for any of its five cell types. The one median it does give is "the median half-life of the standard non-exchangeable 20S proteasome core complex subunits is 111 h", in mouse embryonic cortical neurons.',
  },
  schwanhausser_2011: {
    cite: 'Schwanhausser B, Busse D, Li N, Dittmar G, Schuchhardt J, Wolf J, Chen W, Selbach M (2011) Global quantification of mammalian gene expression control. Nature 473:337-342. WITH Corrigendum, Nature 495:126-127 (2013), doi 10.1038/nature11848, PMID 23407496.',
    doi: '10.1038/nature10098', pmid: '21593866', corrigendum_doi: '10.1038/nature11848', corrigendum_pmid: '23407496',
    how: 'PubMed MCP metadata for PMID 21593866 and for the corrigendum PMID 23407496. The corrigendum has NO abstract in PubMed and a live fetch of nature.com/articles/nature11848 returned a 303 redirect to an identity provider, so the corrected figures were not read. The abstract of the 2011 paper reports the DESIGN (parallel metabolic pulse labelling of mRNA and protein in mouse NIH3T3 cells, >5000 genes) and no median half-life. Hence the entries sourced here carry values of null.',
  },
  ensembl_grch38: {
    cite: 'Ensembl REST API, /info/assembly/homo_sapiens, assembly GRCh38.p14, INSDC accession GCA_000001405.29.',
    accession: 'GCA_000001405.29',
    how: 'Live GET https://rest.ensembl.org/info/assembly/homo_sapiens?content-type=application/json this session. Read back assembly_name "GRCh38.p14", assembly_accession "GCA_000001405.29", and per-chromosome top_level_region lengths; chromosome 1 is 248,956,422 bp, the mitochondrial sequence is 16,569 bp, and chromosomes 1-22 plus X plus Y sum to 3,088,269,832 bp.',
  },
  petryk_2016: {
    cite: 'Petryk N, Kahli M, d\'Aubenton-Carafa Y, Jaszczyszyn Y, Shen Y, Silvain M, Thermes C, Chen C-L, Hyrien O (2016) Replication landscape of the human genome. Nature Communications 7:10208.',
    doi: '10.1038/ncomms10208', pmid: '26751768', pmcid: 'PMC4729899',
    how: 'PubMed MCP metadata for PMID 26751768; the abstract states that replication "initiates stochastically, primarily within non-transcribed, broad (up to 150 kb) zones" and "terminates dispersively between them". Cited here for the EXISTENCE and breadth of initiation zones, not for any origin count.',
  },
});

// ---------------------------------------------------------------------------- unit helpers

/** kb/min to bp/s. Exact: 1 kb/min = 1000/60 bp/s. */
export function kbPerMinToBpPerS(kb_per_min) {
  if (!Number.isFinite(kb_per_min)) throw new Error(`kbPerMinToBpPerS needs a finite number, got ${kb_per_min}`);
  return (kb_per_min * 1000) / 60;
}

/** bp/s to kb/min. The inverse, written separately so a test can check round-tripping. */
export function bpPerSToKbPerMin(bp_per_s) {
  if (!Number.isFinite(bp_per_s)) throw new Error(`bpPerSToKbPerMin needs a finite number, got ${bp_per_s}`);
  return (bp_per_s * 60) / 1000;
}

export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;
/** Julian year. Stated because "a year" is otherwise three different numbers. */
export const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

// ---------------------------------------------------------------------------- rates

/**
 * Why no entry here is an average of its sources.
 *
 * Averaging two methods that disagree produces a number that neither method measured and that no paper
 * supports, and it destroys the only information a reader downstream could have used - the size of the
 * disagreement. For Pol II elongation the retrieved values span roughly nine-fold. The mean of that
 * span is not a better estimate of the truth; it is a new, unsourced quantity wearing the authority of
 * two real ones. Where sources disagree, this module reports a RANGE with both endpoints attributed.
 */
export const WHY_NOT_AVERAGED = deepFreeze({
  rule: 'Record the disagreement as a range with both sources. Never average across methods.',
  worked_example: 'Pol II elongation in mammalian cells: 0.5 kb/min (Jonkers 2014, early gene body, mouse ES, GRO-seq) to 4.3 kb/min (Darzacq 2007, reporter array, human U2OS, live imaging). The ratio is about 8.6. An average of 2.4 kb/min would hide that ratio and would match no measurement in either paper.',
  what_a_viewer_should_do: 'Animate at one endpoint, name it, and offer the other endpoint as a switch. Do not animate at the midpoint.',
});

export const RATES = deepFreeze({

  // ---- mammalian ----

  replication_fork_mammal: {
    quantity: 'rate of DNA synthesis per replication fork',
    range: { lo: 1.7, hi: 1.8 },
    units: 'kb/min',
    range_bp_s: { lo: kbPerMinToBpPerS(1.7), hi: kbPerMinToBpPerS(1.8) },
    also: { value: 2.0, units: 'kb/min', organism: 'human', cell_type: 'HCT116 colon carcinoma line', note: 'the one line in the study with a higher median' },
    organism: 'human and mouse',
    cell_type: 'H1 and H9 human embryonic stem cell lines; mouse embryonic stem cells and mouse neural progenitors, both from the F121-9 line',
    growth_state: 'proliferating culture, S phase',
    method: 'high-resolution Repli-Seq: the median was INFERRED by dividing the size of breakage-free timing transition regions by the fraction of S phase they span, assuming a 10 h S phase. It is not a single-molecule measurement of a fork.',
    source: 'zhao_2020',
    doi: '10.1186/s13059-020-01983-8', pmid: '32209126',
    verified_how: CITATIONS.zhao_2020.how,
    caveats: [
      'Inferred from replication-timing slopes, not measured on a fork. The paper states the values agree with DNA fibre measurements elsewhere, which is corroboration and not independence.',
      'The inference assumes a 10 h S phase. That assumption is inside the number, so a cell type with a different S phase would get a different inferred rate from the same data.',
      'The Methods separately ASSUME 1.8 kb/min when stating a resolution limit; that assumption must not be read back as a second measurement of the same quantity.',
    ],
  },

  transcription_pol2_mammal: {
    quantity: 'RNA polymerase II elongation rate',
    disagreement: 'Reported values differ by roughly nine-fold between methods, and the spread is larger than the spread within any one method. This is the single least settled number in this module.',
    range: { lo: 0.5, hi: 4.3 },
    units: 'kb/min',
    range_bp_s: { lo: kbPerMinToBpPerS(0.5), hi: kbPerMinToBpPerS(4.3) },
    measurements: [
      {
        value: 0.5, units: 'kb/min', sd: 0.43, n_genes: 141,
        organism: 'mouse', cell_type: 'embryonic stem cells', window: 'early, 5 to 12.5 min after flavopiridol',
        method: 'GRO-seq tracking of the Pol II inhibition wave after flavopiridol or triptolide',
        source: 'jonkers_2014', doi: '10.7554/eLife.02407', pmid: '24843027',
      },
      {
        value: 1.8, units: 'kb/min', sd: 0.69, n_genes: 938,
        organism: 'mouse', cell_type: 'embryonic stem cells', window: 'mid, 12.5 to 25 min',
        method: 'GRO-seq tracking of the Pol II inhibition wave',
        source: 'jonkers_2014', doi: '10.7554/eLife.02407', pmid: '24843027',
      },
      {
        value: 2.4, units: 'kb/min', sd: 0.79, n_genes: 245,
        organism: 'mouse', cell_type: 'embryonic stem cells', window: 'late, 25 to 50 min',
        method: 'GRO-seq tracking of the Pol II inhibition wave',
        source: 'jonkers_2014', doi: '10.7554/eLife.02407', pmid: '24843027',
      },
      {
        value: 3.8, units: 'kb/min',
        organism: 'human', cell_type: 'cultured cells, long genes', window: 'over hundreds of kb',
        method: 'reversible transcription block with DRB, release, then quantitative RT-PCR at positions along the gene',
        source: 'singh_padgett_2009', doi: '10.1038/nsmb.1666', pmid: '19820712',
      },
      {
        value: 4.3, units: 'kb/min',
        organism: 'human', cell_type: 'U2OS osteosarcoma line, clone 2-3-6, carrying about 200 integrated copies of a reporter cassette',
        method: 'photobleaching and photoactivation of MS2-tagged nascent mRNA in living cells, fitted to a kinetic model',
        source: 'darzacq_2007', doi: '10.1038/nsmb1280', pmid: '17676063',
        caveat: 'A multi-copy reporter array is not an endogenous gene in its own chromatin. This is the fastest value and the least native template.',
      },
    ],
    structural_finding: 'Jonkers 2014 reports that Pol II ACCELERATES through a gene: 0.5 kb/min in the first window, 1.8 and then 2.4 kb/min later. So "the elongation rate" is not one number even within one cell type and one method, and an animation that uses a constant speed is wrong in a way the data can name.',
    organism: 'mouse and human',
    cell_type: 'see each measurement',
    growth_state: 'proliferating culture',
    source: ['jonkers_2014', 'singh_padgett_2009', 'darzacq_2007'],
    verified_how: `${CITATIONS.jonkers_2014.how} ${CITATIONS.singh_padgett_2009.how} ${CITATIONS.darzacq_2007.how}`,
    caveats: [
      'Every value listed depends on a drug (flavopiridol, triptolide, DRB) or on a transgene array. There is no drug-free, native-locus mammalian number in this set.',
      'Jonkers 2014 also notes that single-gene studies in various organisms had previously reported 1 to 4 kb/min, which brackets but does not resolve the spread.',
    ],
  },

  translation_mammal: {
    quantity: 'translation elongation rate per ribosome',
    value: 5.6,
    units: 'amino acids per second',
    organism: 'mouse',
    cell_type: 'E14 embryonic stem cells',
    growth_state: 'proliferating, feeder-free culture',
    method: 'ribosome profiling of harringtonine run-off: initiation is blocked, elongating ribosomes run off the 5\' end, and the position of the depletion front is followed over time',
    source: 'ingolia_2011',
    doi: '10.1016/j.cell.2011.10.002', pmid: '22056041',
    verified_how: CITATIONS.ingolia_2011.how,
    uniformity: 'The same paper reports the rate to be independent of transcript length, protein abundance, secretion status and codon usage, which is the strongest argument in this module for a single animation speed being defensible at all.',
    caveats: [
      'The measurement subtracts a lag of about 60 s attributed to harringtonine engagement. That lag is a model choice inside the number.',
      'The same paper elsewhere describes "a typical elongation rate of ~6 codons per second" when reasoning about pause durations. 5.6 is the measured figure; ~6 is a rounding used in prose, and the two must not be stacked as independent values.',
      'Local rate is far from uniform: the paper finds pause sites with 25-fold or greater ribosome density, lasting seconds. An animation at a constant 5.6 aa/s depicts the mean and erases the pauses.',
    ],
  },

  mrna_half_life_mammal: {
    quantity: 'mRNA half-life, population median and spread',
    median: { value: 7.1, units: 'h' },
    organism: 'mouse',
    cell_type: 'embryonic stem cells',
    growth_state: 'pluripotent and differentiating',
    n_genes: 19977,
    method: 'microarray time course of transcript decay. The specific transcription-block agent was not in the record retrieved, so it is not stated here.',
    source: 'sharova_2009',
    doi: '10.1093/dnares/dsn030', pmid: '19001483',
    verified_how: CITATIONS.sharova_2009.how,
    tail: 'Fewer than 100 of the 19 977 genes had a half-life under 1 h, so the fast tail is a small minority rather than the typical case.',
    medians_differ_by_dataset: 'This is ONE dataset, in ONE cell type, in ONE organism. The other widely quoted mammalian median comes from a different design in mouse NIH3T3 fibroblasts and could not be retrieved this session - see NUMBERS_WE_DECLINED.mrna_half_life_parallel_labelling. Treat 7.1 h as "the median of this dataset", never as "the half-life of an mRNA".',
    caveats: [
      'Half-lives estimated from a decay time course after a global transcription block are confounded by the block itself, which perturbs the cell it is measuring.',
      'A median over 19 977 genes is not the half-life of any gene a viewer might be animating.',
    ],
  },

  protein_half_life_mammal: {
    quantity: 'protein half-life, measured spread',
    median: {
      value: null, units: 'h',
      null_reason: 'A proteome-wide median was sought in the dataset with the widest cell-type coverage and the paper does not report one; a live fetch of its full text asking for exactly that came back negative. The other commonly quoted median could not be retrieved either (see NUMBERS_WE_DECLINED).',
      what_would_resolve_it: 'Download the supplementary half-life tables of Mathieson et al. 2018 (Nature Communications 9:689) and compute the median per cell type ourselves, recording that it is our computation and not theirs.',
    },
    range: { lo: 10, hi: 1000, hi_is_a_floor: true },
    units: 'h',
    organism: 'human, and mouse for the neurons',
    cell_type: 'non-dividing primary cells: human B cells, natural killer cells, monocytes and hepatocytes; mouse embryonic cortical neurons',
    growth_state: 'non-dividing',
    method: 'dynamic SILAC proteomics with improved peptide ion intensity quantification',
    source: 'mathieson_2018',
    doi: '10.1038/s41467-018-03106-1', pmid: '29449567',
    verified_how: CITATIONS.mathieson_2018.how,
    one_real_median: { value: 111, units: 'h', what: '20S proteasome core complex subunits, standard non-exchangeable', organism: 'mouse', cell_type: 'embryonic cortical neurons' },
    cell_type_matters: 'The paper reports similar half-lives across B cells, natural killer cells and monocytes but SUBSTANTIAL differences in hepatocytes and mouse embryonic neurons. A single "protein half-life" for a mammal does not exist in this data.',
    caveats: [
      'Measured in NON-DIVIDING cells on purpose: in a dividing cell, dilution by growth competes with degradation and the two cannot be separated without modelling.',
      'The upper end is written as "greater than 1000 h" in the source. It is a floor on the method\'s reach, not a measured maximum.',
    ],
  },

  // ---- bacterial, kept apart on purpose ----

  bacterial_contrast_note: 'THESE ARE A DIFFERENT ORGANISM. The three entries below are microbial and are here only as a contrast: they are roughly an order of magnitude faster than their mammalian counterparts, which is the reason a viewer cannot reuse one animation speed for both. Do not mix them into the mammalian ranges.',

  replication_fork_bacteria: {
    quantity: 'rate of DNA synthesis per replication fork',
    value: 653,
    uncertainty: { sem: 9 },
    units: 'nucleotides per second',
    observed_range: { lo: 550, hi: 750, units: 'nucleotides per second', note: 'the range into which most forks fell' },
    organism: 'Escherichia coli',
    cell_type: 'single-celled; strain eCOMB, a thymidine-requiring strain built for the assay',
    growth_state: 'growing culture, pulse-labelled with thymidine analogues',
    method: 'DNA combing: single-molecule measurement of labelled tract lengths',
    source: 'pham_2013',
    doi: '10.1111/mmi.12386', pmid: '23998701',
    verified_how: CITATIONS.pham_2013.how,
    mechanistic_anchor: 'The same paper reports a dnaE173 mutant fork at 264 +/- 9 nt/s, with that mutant Pol III elongating at 300 nt/s against 900 nt/s for wild-type Pol III. So the fork runs at roughly two thirds of the bare polymerase rate, and the polymerase is the rate-determining part.',
    contrast_with_mammal: 'About 22-fold faster than the mammalian fork figure above (653 vs about 30 bp/s). An animation tuned to one is wrong for the other by more than an order of magnitude.',
    caveats: [
      'A purpose-built thymidine-requiring strain is not wild-type E. coli, and analogue incorporation is the premise of the assay rather than a control for it.',
      'Fork velocity in bacteria is neither constant along the chromosome nor constant in time: Huang et al. 2023 report locus-dependent velocity, brief pauses at ribosomal DNA loci in wild-type cells, and temporal oscillations of roughly 0.5 peak-to-peak relative amplitude with a 10 to 15 min period in three species. A single value is a mean over that structure.',
    ],
  },

  transcription_bacteria: {
    quantity: 'RNA polymerase elongation rate',
    value: 42,
    units: 'nucleotides per second',
    by_condition: [
      { value: 42, units: 'nt/s', condition: 'exponential growth in LB' },
      { value: 31, units: 'nt/s', condition: 'growth on glycerol' },
      { value: 21, units: 'nt/s', condition: 'stationary phase' },
    ],
    organism: 'Escherichia coli',
    cell_type: 'single-celled; strain MG1655',
    growth_state: 'exponential phase in LB, about OD600 0.4, reporter induced with IPTG',
    method: 'in vivo timing on a plasmid-borne lacZ reporter under a T7 A1 promoter; Table 1',
    source: 'proshkin_2010',
    doi: '10.1126/science.1184939', pmid: '20413502',
    verified_how: CITATIONS.proshkin_2010.how,
    coupling: 'In the same experiment the transcription rate TRACKS the translation rate condition by condition: 42 with 14, 31 with 10, 21 with 7. The paper\'s claim is that the trailing ribosome sets the polymerase\'s pace by preventing backtracking. For an animation this means the bacterial polymerase and the bacterial ribosome are not independently tunable.',
    corroborating_direction: 'Vogel and Jensen 1994 independently found the E. coli RNA chain elongation rate to fall by 40% when growth rate fell four-fold, and always to correlate with translation elongation - the same direction, from a different lab and method. Their absolute nt/s values could not be read (the 1994 issue is page images in PMC), so only the direction is claimed from them.',
    caveats: [
      'A plasmid reporter under a phage promoter is not a chromosomal gene.',
      'Vogel and Jensen 1994 also report that an untranslated ribosomal RNA chain elongates nearly twice as fast as mRNA, so "the bacterial transcription rate" depends on whether the transcript is being translated at all.',
    ],
  },

  translation_bacteria: {
    quantity: 'translation elongation rate per ribosome',
    range: { lo: 7, hi: 17 },
    units: 'amino acids per second',
    measurements: [
      { value: 14, units: 'aa/s', organism: 'Escherichia coli', cell_type: 'strain MG1655', growth_state: 'exponential in LB', method: 'beta-galactosidase induction lag', source: 'proshkin_2010', doi: '10.1126/science.1184939', pmid: '20413502' },
      { value: 10, units: 'aa/s', organism: 'Escherichia coli', cell_type: 'strain MG1655', growth_state: 'growth on glycerol', method: 'beta-galactosidase induction lag', source: 'proshkin_2010', doi: '10.1126/science.1184939', pmid: '20413502' },
      { value: 7, units: 'aa/s', organism: 'Escherichia coli', cell_type: 'strain MG1655', growth_state: 'stationary phase', method: 'beta-galactosidase induction lag', source: 'proshkin_2010', doi: '10.1126/science.1184939', pmid: '20413502' },
      { value: 17, units: 'aa/s', organism: 'Escherichia coli', cell_type: 'strain B/r', growth_state: 'fast growth, 1.3 and 2.0 doublings/h', method: 'kinetics of radioactive labelling of nascent and finished polypeptides', source: 'young_bremer_1976', doi: '10.1042/bj1600185', pmid: '795428' },
      { value: 12, units: 'aa/s', organism: 'Escherichia coli', cell_type: 'strain B/r', growth_state: 'slow growth, 0.67 doublings/h', method: 'kinetics of radioactive labelling of nascent and finished polypeptides', source: 'young_bremer_1976', doi: '10.1042/bj1600185', pmid: '795428' },
    ],
    organism: 'Escherichia coli',
    cell_type: 'single-celled; strains MG1655 and B/r',
    growth_state: 'see each measurement; the rate is strongly growth-rate dependent',
    source: ['proshkin_2010', 'young_bremer_1976'],
    verified_how: `${CITATIONS.proshkin_2010.how} ${CITATIONS.young_bremer_1976.how}`,
    contrast_with_mammal: 'The fast end, 17 aa/s, is about 3-fold the mammalian figure of 5.6 aa/s. The slow end, 7 aa/s in stationary phase, is close to it - so the bacterium-versus-mammal contrast for translation is smaller than for replication, and it disappears entirely if the bacterium is starving.',
    caveats: [
      'The spread here is not method disagreement so much as growth-state dependence, which is why growth state is recorded on every row. Two numbers from the same strain and the same lab differ two-fold between LB and stationary phase.',
      'Two different strains, two different decades, two different methods. The agreement at fast growth (14 against 17) is reassuring and is not a replication.',
    ],
  },
});

// ---------------------------------------------------------------------------- durations

export const DURATIONS = deepFreeze({

  cultured_mammalian_cell_cycle: {
    what: 'durations of the four cell-cycle phases in cultured mammalian cells',
    organism: 'human',
    cell_lines: ['hTERT RPE-1, non-transformed retinal pigment epithelial', 'U2OS, osteosarcoma', 'H9, embryonic stem cell line'],
    phases: {
      G1: { range: { lo: 2.1, hi: 7.9 }, units: 'h', attributed: 'low end in H9, high end in hTERT RPE-1' },
      S: { range: { lo: 7.6, hi: 10.1 }, units: 'h', attributed: null, attribution_note: 'the source text gives the range across the three lines without saying which line sits where' },
      G2: { range: { lo: 3.4, hi: 4.0 }, units: 'h', attributed: null, attribution_note: 'as for S' },
      M: { value: 0.5, units: 'h', also_written_as: '~30 min' },
    },
    statistic: 'The retrieved page describes the Figure 1B bars as means with standard deviation, so these are most likely means. The running text does not say mean or median, and this module does not decide for it.',
    method: 'time-lapse microscopy of single cells with cell-cycle phase reporters; each phase duration was found to follow an Erlang distribution and to be statistically independent of the others',
    source: 'chao_2019',
    doi: '10.15252/msb.20188604', pmid: '30886052',
    verified_how: CITATIONS.chao_2019.how,
    why_no_single_cycle_is_given:
      'The ranges are across three cell lines and the per-line values live only in a figure. Adding the low ends together, or the high ends, produces a BOUND on a cycle, not a cycle: no single cell line is claimed to have all four low values. `totalCycleBounds()` computes those bounds and labels them as bounds.',
    caveats: [
      'Three immortalised or stem-cell lines in culture. Not a tissue, not an organism, not a cell doing a job.',
      'The paper\'s own finding is that phase durations vary cell to cell and stay uncoupled. Any single quartet of numbers is a summary of a distribution that the source went out of its way to show is wide.',
    ],
  },

  cleavage_stage_embryo_cycles: {
    what: 'cycle durations during the rapid cleavage divisions of an early embryo, before the midblastula transition',
    the_structural_point: 'These cycles are short and lack gap phases: the cycle is replication and division with little or nothing between them. Farrell and O\'Farrell 2014 (a REVIEW) states that many embryos "begin development with extremely short cell cycles that exhibit unusually rapid DNA replication and no gap phases", and that the slowdown at the midblastula transition works by extending S phase and introducing a post-replicative G2. That is the reason the cultured-cell quartet above cannot be reused for an embryo.',
    structural_source: 'farrell_ofarrell_2014',
    structural_source_is_a_review: true,
    organisms: {
      insect: {
        organism: 'Drosophila melanogaster',
        stage: 'syncytial blastoderm, nuclear cycles 10 to 14',
        cycles: [
          { cycle: 10, duration: 9, units: 'min', mitosis_without_nuclear_envelope: 3 },
          { cycle: 11, duration: 10, units: 'min', mitosis_without_nuclear_envelope: 3 },
          { cycle: 12, duration: 12, units: 'min', mitosis_without_nuclear_envelope: 3 },
          { cycle: 13, duration: 21, units: 'min', mitosis_without_nuclear_envelope: 5 },
          { cycle: 14, duration: 65, units: 'min', duration_is_a_minimum: true, note: 'cycle 14 varies in a position-specific manner across the embryo; 65 min is the SHORTEST, not the average' },
        ],
        temperature: { value: 25, units: 'C' },
        method: 'differential interference contrast optics with cinematography of living embryos, supplemented with fixed stained whole embryos',
        source: 'foe_alberts_1983',
        doi: '10.1242/jcs.61.1.31', pmid: '6411748',
        verified_how: CITATIONS.foe_alberts_1983.how,
      },
      fish: {
        organism: 'zebrafish, Danio rerio',
        stage: 'cleavage and early blastula, cycles 1 to 9',
        cycle_period: { value: 15, units: 'min' },
        description: 'the source describes "a 15 minute oscillator that controls the first nine cycles"; the midblastula transition begins at cycle 10, after which cycle length comes under nucleocytoplasmic control and correlates with the reciprocal of blastomere volume',
        temperature: { value: null, units: 'C', null_reason: 'the abstract retrieved does not state the rearing temperature, and zebrafish cycle timing is strongly temperature dependent', what_would_resolve_it: 'read the Methods of Kane and Kimmel 1993 (Development 119:447-456) for the stated rearing temperature' },
        method: 'time-lapse observation and clonal labelling of blastomeres',
        source: 'kane_kimmel_1993',
        doi: '10.1242/dev.119.2.447', pmid: '8287796',
        verified_how: CITATIONS.kane_kimmel_1993.how,
      },
      amphibian: {
        organism: 'Xenopus laevis',
        stage: 'cleavage, the first twelve divisions',
        n_rapid_synchronous_cleavages: 12,
        cycle_period: {
          value: null, units: 'min',
          null_reason: 'the retrieved abstract establishes the STRUCTURE - "12 rapid synchronous cleavages followed by a period of slower asynchronous divisions" - and gives no per-cycle duration. The commonly quoted figure of about half an hour was not retrieved and is therefore not written here.',
          what_would_resolve_it: 'read the body of Newport and Kirschner 1982 (Cell 30:675-686) or its companion paper for the measured cycle interval and the temperature it was measured at',
        },
        method: 'observation and manipulation of cleaving embryos; the timing of the transition was shown to depend on the nucleus-to-cytoplasm ratio rather than on time since fertilisation or on division count',
        source: 'newport_kirschner_1982',
        doi: '10.1016/0092-8674(82)90272-0', pmid: '6183003',
        verified_how: CITATIONS.newport_kirschner_1982.how,
      },
    },
    how_much_shorter: 'The shortest well-sourced cleavage cycle here is 9 min. The shortest S phase alone in the cultured human lines above is 7.6 h, which is about 50 times longer than that entire embryonic cycle. `cleavageContrast()` computes that ratio from the two sourced figures rather than asserting it.',
    caveats: [
      'Three organisms, three temperatures, three methods, three different definitions of "cycle". A nuclear cycle in a syncytium is not a cell cycle.',
      'None of these is a mammal. No mammalian cleavage-stage cycle duration was retrieved this session, and none is asserted: mammalian cleavage is slow compared with these embryos, so borrowing an insect or fish figure for a mammalian embryo would be wrong by a large factor in the opposite direction from the cultured-cell figures.',
    ],
  },
});

/** The human assembly figures that the origin argument needs, retrieved live rather than recalled. */
export const GENOME = deepFreeze({
  organism: 'human',
  assembly: 'GRCh38.p14',
  accession: 'GCA_000001405.29',
  chromosome_1_bp: 248956422,
  nuclear_haploid_bp: 3088269832,
  nuclear_haploid_composition: 'sum of the top-level chromosome lengths 1-22, X and Y',
  mitochondrial_bp: 16569,
  source: 'ensembl_grch38',
  verified_how: CITATIONS.ensembl_grch38.how,
  caveats: [
    'An assembly length is not the DNA content of a cell. A G1 diploid cell holds about twice the haploid figure, plus many copies of the mitochondrial sequence, and an assembly still contains gaps.',
    'Chromosomes X and Y are both included in the sum, so this is not the complement of any single cell.',
  ],
});

// ---------------------------------------------------------------------------- arithmetic

/**
 * How long a stretch of DNA takes to replicate from a given number of origins.
 *
 * Each origin is bidirectional, so `origins` origins give `2 * origins` forks, and each fork copies an
 * equal share. This is the most generous possible accounting: every origin fires at time zero, no fork
 * ever stalls, and no fork finishes early while another is still working. The real process satisfies
 * none of those, so the time returned is a LOWER BOUND on the real time - which is what makes it usable
 * as a constraint.
 */
export function replicationTime({ genome_bp, fork_rate_bp_s, origins }) {
  if (!Number.isFinite(genome_bp) || genome_bp <= 0) throw new Error(`genome_bp must be a positive finite number, got ${genome_bp}`);
  if (!Number.isFinite(fork_rate_bp_s) || fork_rate_bp_s <= 0) throw new Error(`fork_rate_bp_s must be a positive finite number, got ${fork_rate_bp_s}`);
  if (!Number.isInteger(origins) || origins < 1) throw new Error(`origins must be an integer >= 1, got ${origins}`);
  const forks = 2 * origins;
  const bp_per_fork = genome_bp / forks;
  const seconds = bp_per_fork / fork_rate_bp_s;
  return {
    genome_bp, fork_rate_bp_s, origins, forks, bp_per_fork,
    seconds,
    minutes: seconds / 60,
    hours: seconds / SECONDS_PER_HOUR,
    days: seconds / SECONDS_PER_DAY,
    years: seconds / SECONDS_PER_YEAR,
    is_a_lower_bound: true,
    assumptions: [
      'every origin fires simultaneously at time zero',
      'each origin is bidirectional, giving two forks',
      'the DNA is divided equally among the forks',
      'no fork stalls, pauses, collapses or terminates early',
      'the fork rate is constant, which the sources for these rates explicitly say it is not',
    ],
  };
}

/**
 * The inverse: the fewest origins that could finish a stretch of DNA inside a given time, under the same
 * generous assumptions. A real cell needs more, because origins fire throughout S phase rather than all
 * at once and because forks terminate when they meet. So this is a FLOOR on an origin count, not an
 * estimate of one.
 */
export function originsNeeded({ genome_bp, fork_rate_bp_s, seconds }) {
  if (!Number.isFinite(genome_bp) || genome_bp <= 0) throw new Error(`genome_bp must be a positive finite number, got ${genome_bp}`);
  if (!Number.isFinite(fork_rate_bp_s) || fork_rate_bp_s <= 0) throw new Error(`fork_rate_bp_s must be a positive finite number, got ${fork_rate_bp_s}`);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`seconds must be a positive finite number, got ${seconds}`);
  const exact = genome_bp / (2 * fork_rate_bp_s * seconds);
  return { exact, integer: Math.ceil(exact), is_a_floor: true };
}

/** Bounds on a whole cultured-cell cycle from the per-phase ranges. Labelled as bounds, not a cycle. */
export function totalCycleBounds() {
  const p = DURATIONS.cultured_mammalian_cell_cycle.phases;
  const lo = p.G1.range.lo + p.S.range.lo + p.G2.range.lo + p.M.value;
  const hi = p.G1.range.hi + p.S.range.hi + p.G2.range.hi + p.M.value;
  return {
    lo_hours: lo, hi_hours: hi, units: 'h',
    these_are_bounds_not_cells: 'The low bound sums the shortest reported value of each phase across three different cell lines. No cell line is claimed to have all four.',
  };
}

/** The cleavage-versus-cultured contrast, computed from the two sourced figures. */
export function cleavageContrast() {
  const shortest_cleavage_min = DURATIONS.cleavage_stage_embryo_cycles.organisms.insect.cycles[0].duration;
  const shortest_cultured_S_h = DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.lo;
  const shortest_cultured_S_min = shortest_cultured_S_h * 60;
  return {
    shortest_cleavage_cycle_min: shortest_cleavage_min,
    shortest_cultured_S_phase_min: shortest_cultured_S_min,
    ratio: shortest_cultured_S_min / shortest_cleavage_min,
    reading: 'An entire nuclear cycle in the insect embryo is shorter than the S phase alone of the cultured human lines by this factor.',
    not_the_same_organism: 'Insect embryo against human cell lines. The comparison is between developmental modes, not between species.',
  };
}

// ---------------------------------------------------------------------------- the origin argument

const FORK_LO = kbPerMinToBpPerS(RATES.replication_fork_mammal.range.lo);
const FORK_HI = kbPerMinToBpPerS(RATES.replication_fork_mammal.range.hi);
const S_PHASE_LONGEST_S = DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.hi * SECONDS_PER_HOUR;
const S_PHASE_SHORTEST_S = DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.lo * SECONDS_PER_HOUR;

/**
 * THE ONE-ORIGIN CONSTRAINT.
 *
 * Interesting not because it yields a pretty number but because it yields an impossibility. Take the
 * two numbers above - a fork rate and an observed S phase, each with a source - and ask how long one
 * origin would need. The answer is longer than a human S phase by three orders of magnitude, and longer
 * than a human lifetime's worth of S phases. The inequality, not the quotient, is the finding: firing
 * one origin is not a slow way to replicate a mammalian genome, it is not a way to replicate one.
 *
 * The honest second half: the floor this argument puts on the origin count is of order a thousand, not
 * the tens of thousands a cell actually fires. That gap is not a failure of the arithmetic, it is what
 * the arithmetic leaves out - origins fire across the whole of S rather than simultaneously, and forks
 * stop when they meet a neighbour's fork. This module reports the floor it can derive and declines to
 * assert the real count, which it did not retrieve.
 */
export const THE_ORIGIN_ARGUMENT = deepFreeze({
  question: 'If a mammalian genome were replicated from a single bidirectional origin, how long would it take, and how does that compare with an observed S phase?',

  inputs: {
    genome_bp: {
      value: GENOME.nuclear_haploid_bp, units: 'bp',
      what: 'sum of human top-level chromosomes 1-22, X and Y in GRCh38.p14',
      source: 'ensembl_grch38', verified_how: CITATIONS.ensembl_grch38.how,
    },
    chromosome_1_bp: {
      value: GENOME.chromosome_1_bp, units: 'bp',
      what: 'the largest single DNA molecule in the set, used for the per-molecule version of the argument',
      source: 'ensembl_grch38', verified_how: CITATIONS.ensembl_grch38.how,
    },
    fork_rate_bp_s: {
      range: { lo: FORK_LO, hi: FORK_HI }, units: 'bp/s',
      from: '1.7 to 1.8 kb/min, median fork progression speed',
      organism: 'human and mouse embryonic stem cells and mouse neural progenitors',
      source: 'zhao_2020', verified_how: CITATIONS.zhao_2020.how,
    },
    observed_S_phase_s: {
      range: { lo: S_PHASE_SHORTEST_S, hi: S_PHASE_LONGEST_S }, units: 's',
      from: '7.6 to 10.1 h across hTERT RPE-1, U2OS and H9',
      organism: 'human',
      source: 'chao_2019', verified_how: CITATIONS.chao_2019.how,
      circularity_warning: 'The fork rate above was itself inferred assuming a 10 h S phase. The two inputs are therefore NOT independent, and the comparison below is a self-consistency check on a 10 h S phase as much as a test of it. The conclusion survives this because the gap is three orders of magnitude and the circularity is worth a factor of order one.',
    },
  },

  whole_genome_one_origin: (() => {
    const slow = replicationTime({ genome_bp: GENOME.nuclear_haploid_bp, fork_rate_bp_s: FORK_LO, origins: 1 });
    const fast = replicationTime({ genome_bp: GENOME.nuclear_haploid_bp, fork_rate_bp_s: FORK_HI, origins: 1 });
    return {
      at_slow_fork: { hours: slow.hours, days: slow.days, years: slow.years },
      at_fast_fork: { hours: fast.hours, days: fast.days, years: fast.years },
      caveat: 'A genome is not one molecule, so one origin for a whole genome is not even geometrically possible. This figure is the scale of the problem, not a scenario.',
    };
  })(),

  chromosome_1_one_origin: (() => {
    const slow = replicationTime({ genome_bp: GENOME.chromosome_1_bp, fork_rate_bp_s: FORK_LO, origins: 1 });
    const fast = replicationTime({ genome_bp: GENOME.chromosome_1_bp, fork_rate_bp_s: FORK_HI, origins: 1 });
    return {
      at_slow_fork: { hours: slow.hours, days: slow.days },
      at_fast_fork: { hours: fast.hours, days: fast.days },
      why_this_is_the_fair_version: 'Chromosome 1 IS one DNA molecule, so a single origin on it is a scenario that could physically obtain. Two forks, each copying half of 248,956,422 bp.',
    };
  })(),

  the_inequality: (() => {
    const t = replicationTime({ genome_bp: GENOME.nuclear_haploid_bp, fork_rate_bp_s: FORK_HI, origins: 1 });
    const c = replicationTime({ genome_bp: GENOME.chromosome_1_bp, fork_rate_bp_s: FORK_HI, origins: 1 });
    return {
      one_origin_whole_genome_over_longest_S: t.seconds / S_PHASE_LONGEST_S,
      one_origin_chromosome_1_over_longest_S: c.seconds / S_PHASE_LONGEST_S,
      statement: 'Both ratios are far greater than 1. That is the whole argument. The fastest retrieved fork rate and the longest retrieved S phase - the pairing most favourable to a single origin - still leave it short by orders of magnitude.',
      asserted_as: 'an inequality, not a quotient',
    };
  })(),

  floor_on_the_origin_count: (() => {
    const genome = originsNeeded({ genome_bp: GENOME.nuclear_haploid_bp, fork_rate_bp_s: FORK_HI, seconds: S_PHASE_LONGEST_S });
    const chr1 = originsNeeded({ genome_bp: GENOME.chromosome_1_bp, fork_rate_bp_s: FORK_HI, seconds: S_PHASE_LONGEST_S });
    return {
      genome_wide: genome,
      chromosome_1: chr1,
      what_it_is: 'The fewest origins that could finish inside the longest observed S phase if all of them fired at once and no fork ever stopped.',
      what_it_is_not: 'An estimate of how many origins a cell fires. A cell fires more, because origins fire throughout S rather than simultaneously and because forks terminate on meeting. Petryk et al. 2016 showed that initiation in the human genome is stochastic within broad zones up to 150 kb wide rather than at a fixed set of points, so "the number of origins" is not even a single well-defined quantity.',
      count_we_decline_to_assert: 'the actual number of origins fired per human S phase. Not retrieved this session.',
      petryk_source: 'petryk_2016',
    };
  })(),

  what_this_licenses_in_the_viewer: [
    'Showing many replisomes at once rather than one, because one is excluded by arithmetic the viewer can display.',
    'Putting a clock on the zoomed-in view: at 1.8 kb/min a fork advances 30 bp a second, which is a visible, checkable rate.',
    'Refusing to animate a count of origins, and instead showing the floor with its derivation.',
  ],
});

// ---------------------------------------------------------------------------- animation honesty

/**
 * How a real rate maps onto frames.
 *
 * `steps_per_second` is the real-world rate of a discrete event: an amino acid added, a base pair
 * copied, a nucleotide transcribed. At `fps` frames per second a viewer running in real time shows
 * `steps_per_second / fps` steps per frame. The `factor` is what the playback rate must be multiplied by
 * to land on `steps_per_frame_target`, so a factor above 1 is a speed-up and below 1 is a slow-down.
 *
 * 60 fps is a DISPLAY convention, not a property of a human eye. No measurement of human temporal
 * resolution was retrieved for this module - see NUMBERS_WE_DECLINED.human_flicker_fusion - so the
 * criterion here is stated rather than claimed to be perceptual.
 */
export function realTimeFactor({ steps_per_second, fps = 60, steps_per_frame_target = 1 }) {
  if (!Number.isFinite(steps_per_second) || steps_per_second <= 0) throw new Error(`steps_per_second must be a positive finite number, got ${steps_per_second}`);
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`fps must be a positive finite number, got ${fps}`);
  if (!Number.isFinite(steps_per_frame_target) || steps_per_frame_target <= 0) throw new Error(`steps_per_frame_target must be a positive finite number, got ${steps_per_frame_target}`);
  const steps_per_frame_at_real_time = steps_per_second / fps;
  const factor = steps_per_frame_target / steps_per_frame_at_real_time;
  return {
    steps_per_second, fps, steps_per_frame_target,
    steps_per_frame_at_real_time,
    frames_per_step_at_real_time: fps / steps_per_second,
    factor,
    direction: factor > 1 ? 'speed up' : factor < 1 ? 'slow down' : 'real time',
    criterion_is_a_convention: '60 fps and one step per frame are both stated conventions. Neither is a retrieved property of human vision.',
  };
}

const POL2_MID_BP_S = kbPerMinToBpPerS(1.8);

export const ANIMATION_HONESTY = deepFreeze({
  criterion: 'A process is called "resolvable" here when the animation shows one discrete molecular step per frame. The frame rate is taken as 60 per second, a display convention.',

  per_process: {
    ribosome_mammal: {
      label: 'mammalian ribosome adding amino acids',
      steps_per_second: RATES.translation_mammal.value, step: 'one amino acid',
      organism: 'mouse embryonic stem cells', source: 'ingolia_2011',
      ...realTimeFactor({ steps_per_second: RATES.translation_mammal.value }),
    },
    ribosome_bacteria_fast: {
      label: 'bacterial ribosome at fast growth',
      steps_per_second: 17, step: 'one amino acid',
      organism: 'Escherichia coli B/r', source: 'young_bremer_1976',
      ...realTimeFactor({ steps_per_second: 17 }),
    },
    pol2_mammal: {
      label: 'RNA polymerase II in the gene body',
      steps_per_second: POL2_MID_BP_S, step: 'one nucleotide',
      organism: 'mouse embryonic stem cells', source: 'jonkers_2014',
      note: 'from the mid-window 1.8 kb/min. The early-window 0.5 and the live-imaging 4.3 give factors differing by about nine-fold; the range below carries that.',
      ...realTimeFactor({ steps_per_second: POL2_MID_BP_S }),
    },
    replication_fork_mammal: {
      label: 'mammalian replication fork',
      steps_per_second: FORK_HI, step: 'one base pair',
      organism: 'human and mouse stem cells', source: 'zhao_2020',
      ...realTimeFactor({ steps_per_second: FORK_HI }),
    },
    replication_fork_bacteria: {
      label: 'bacterial replication fork',
      steps_per_second: RATES.replication_fork_bacteria.value, step: 'one nucleotide',
      organism: 'Escherichia coli', source: 'pham_2013',
      ...realTimeFactor({ steps_per_second: RATES.replication_fork_bacteria.value }),
    },
    pol3_bacteria_isolated: {
      label: 'bacterial DNA polymerase III chain elongation, the bare polymerase rate',
      steps_per_second: 900, step: 'one nucleotide',
      organism: 'Escherichia coli', source: 'pham_2013',
      note: 'the fastest process in this module and the only one that needs serious slow motion',
      ...realTimeFactor({ steps_per_second: 900 }),
    },
  },

  whole_process_at_real_time: {
    longest_observed_S_phase: {
      hours: DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.hi,
      seconds: S_PHASE_LONGEST_S,
      frames_at_60fps: S_PHASE_LONGEST_S * 60,
      source: 'chao_2019',
    },
    shortest_sourced_cleavage_cycle: {
      minutes: DURATIONS.cleavage_stage_embryo_cycles.organisms.insect.cycles[0].duration,
      seconds: DURATIONS.cleavage_stage_embryo_cycles.organisms.insect.cycles[0].duration * 60,
      frames_at_60fps: DURATIONS.cleavage_stage_embryo_cycles.organisms.insect.cycles[0].duration * 60 * 60,
      organism: 'Drosophila melanogaster',
      source: 'foe_alberts_1983',
    },
    reading: 'The molecules are nearly real-time-animatable. The processes they belong to are not: one S phase in real time is millions of frames, and even the shortest sourced embryonic nuclear cycle is tens of thousands. So a viewer that zooms from embryo to chromosome crosses a boundary where the time axis must be cut, and the honest design is to show the molecular speed truthfully and to state the compression factor on the cell-scale view rather than to pick one rate for both.',
  },

  what_a_viewer_must_display: [
    'the real rate, with its units and its organism, next to whatever is moving',
    'the playback factor currently applied, as a number',
    'that the positions are a depiction and the rates are not',
  ],
});

// ---------------------------------------------------------------------------- refusals

export const NUMBERS_WE_DECLINED = deepFreeze({
  mrna_half_life_parallel_labelling: {
    wanted: 'median mRNA half-life and median protein half-life from the parallel metabolic pulse-labelling study in mouse NIH3T3 cells',
    value: null,
    null_reason: 'The 2011 paper is paywalled and does not state the medians in its abstract. It also carries a 2013 Corrigendum in Nature, whose abstract is absent from PubMed and whose page returned a 303 redirect to an identity provider on a live fetch. Since the corrigendum revises the paper, the widely quoted figures from the 2011 version may be superseded, and writing them from memory would risk publishing a number the authors themselves corrected.',
    what_would_resolve_it: 'read the corrigendum (Nature 495:126-127, doi 10.1038/nature11848) through an institutional subscription and record the corrected medians with the original ones alongside',
    why_this_matters: 'These are among the most quoted numbers in quantitative cell biology. Quoting a corrected number is the exact failure mode this project exists to avoid.',
  },
  textbook_cell_cycle_quartet: {
    wanted: 'the canonical cultured-mammalian-cell quartet of roughly G1 11 h, S 8 h, G2 4 h, M 1 h',
    value: null,
    null_reason: 'No primary measurement of that specific quartet was retrieved. The single-cell time-lapse study that was retrieved gives G1 2.1 to 7.9 h, S 7.6 to 10.1 h, G2 3.4 to 4.0 h and M about 0.5 h across three human lines - overlapping but not matching, and with a G1 and an M that are both shorter. The familiar quartet appears to be a textbook summary rather than a measurement of any cell.',
    what_would_resolve_it: 'find and retrieve the primary flow-cytometry or autoradiography study the quartet descends from, with its cell line and its conditions, or stop quoting it',
    use_instead: 'DURATIONS.cultured_mammalian_cell_cycle, which names its lines and its method',
  },
  bacterial_transcription_absolute_1994: {
    wanted: 'the absolute nt/s RNA chain elongation rates in Vogel and Jensen 1994',
    value: null,
    null_reason: 'PMC holds that 1994 Journal of Bacteriology issue as scanned page images. The full-text request returned an empty body and a live fetch of the article page confirmed only the abstract is machine-readable. The direction of the effect was retrieved; the digits were not.',
    what_would_resolve_it: 'read the PDF at PMC205433 (jbacter00028-0045.pdf) and transcribe the table',
    use_instead: 'RATES.transcription_bacteria, whose absolute values come from Proshkin et al. 2010',
  },
  bacterial_fork_velocity_oscillation_values: {
    wanted: 'the locus-specific kb/s fork velocities and pause durations measured by lag-time analysis',
    value: null,
    null_reason: 'The full text was retrieved but the PMC conversion had stripped every inline numeric result out of the sentences that carried them (for example "the measured lag time is" followed by nothing). The qualitative findings survived the conversion; the numbers did not.',
    what_would_resolve_it: 'read Supplementary Data 1 of Huang et al. 2023 (doi 10.1038/s41467-023-37456-2), which the paper says holds the tabulated velocities',
  },
  human_flicker_fusion: {
    wanted: 'a measured threshold for human temporal resolution, to justify the frame-rate criterion in ANIMATION_HONESTY perceptually rather than by convention',
    value: null,
    null_reason: 'not searched for or retrieved this session; the animation criterion was therefore stated as a display convention instead of claimed as a perceptual limit',
    what_would_resolve_it: 'retrieve a primary psychophysics measurement of critical flicker fusion frequency with its luminance and eccentricity conditions, both of which change the answer substantially',
  },
  mammalian_cleavage_cycle_duration: {
    wanted: 'cleavage-stage cycle duration for a mammalian embryo',
    value: null,
    null_reason: 'not retrieved. The cleavage figures in DURATIONS are from an insect, a fish and an amphibian, and mammalian cleavage is much slower than any of them, so substituting one would be wrong by a large factor.',
    what_would_resolve_it: 'retrieve a time-lapse study of mammalian preimplantation development reporting interval between the first few divisions, with the species and culture conditions',
  },
  origins_fired_per_human_s_phase: {
    wanted: 'the number of replication origins a human cell actually fires in one S phase',
    value: null,
    null_reason: 'not retrieved. THE_ORIGIN_ARGUMENT derives a FLOOR on this count from retrieved inputs and stops there. The often-quoted "tens of thousands" is not in this file as a number.',
    what_would_resolve_it: 'retrieve a genome-wide initiation-site study that reports a per-cell-cycle firing count, together with how it handles stochastic firing within broad initiation zones',
  },
});

// ---------------------------------------------------------------------------- what we got wrong

export const THE_SIXTY_HERTZ_COINCIDENCE = deepFreeze({
  what_we_expected:
    'That the molecular machines would be far too fast to animate honestly, and that the module would end up being a table of slow-motion factors - a ribosome shown at a thousandth of real time, a polymerase at a ten-thousandth. The brief talks about making processes "visible to a human eye", which presumes they are currently too fast to see.',
  what_the_numbers_said:
    'The opposite, for the mammalian machines. A mouse embryonic stem cell ribosome adds 5.6 amino acids a second. A 60 Hz display has 60 frames a second. So in real time that ribosome adds one residue every 10.7 frames: it is about ten times too SLOW to give one step per frame, and a chemically honest animation of it would need SPEEDING UP, not slowing down. The mammalian fork and Pol II, both near 30 steps a second, are within a factor of two of one step per frame. Only the bacterial machines need slow motion at all, and only by one order of magnitude.',
  why_we_had_it_backwards:
    'We were conflating two different smallness. Molecular machines are small in SPACE by a factor of about a billion against a body, and that is what makes them invisible. In TIME they are not extreme at all: a few tens of chemical steps a second is a human-scale tempo, close to a fast drum roll. The intuition that "molecules are too fast to see" borrows the spatial factor and applies it to the time axis, where it does not belong.',
  what_actually_needs_compressing:
    'The cell, not the molecule. The longest S phase retrieved is 10.1 h, which at 60 fps is over two million frames of real time. The shortest well-sourced embryonic nuclear cycle is 9 min, which is still over thirty thousand frames. So a zoom from embryo to chromosome crosses a point where the time axis has to be cut by six orders of magnitude, and the cut belongs at the cell scale - where the viewer can label it - rather than being smeared across the molecular scale where it would corrupt the one set of rates this module can defend.',
  what_changed_in_the_design:
    'ANIMATION_HONESTY computes a factor per process rather than reporting one global slow-motion number, reports the direction (speed up or slow down) rather than assuming it, and carries whole_process_at_real_time so that the cell-scale frame counts sit next to the molecular factors instead of being inferred from them.',
  the_general_lesson:
    'When a brief contains a presupposition about magnitude - "too fast to see", "too small to matter", "negligible" - compute it before building the thing that depends on it. The presupposition here was wrong by two orders of magnitude and in the wrong direction, and it would have been invisible in the output: nobody watching a ribosome in slow motion would have known it was already slower than the frame rate.',
});

export const KNOWN_LIMITATIONS = deepFreeze([
  'Every mammalian rate here is from a cultured cell line or a cultured stem cell, not from a tissue. A rate measured in mouse embryonic stem cells in feeder-free culture is not a rate about a mouse, and the module says so on each entry rather than once at the top.',
  'Every mammalian Pol II value depends on a drug or a transgene array. There is no drug-free, native-locus measurement in the set, so the spread between methods cannot be cleanly separated from the perturbations the methods require.',
  'The mammalian fork rate is INFERRED from replication-timing slopes under an assumed 10 h S phase, and THE_ORIGIN_ARGUMENT then compares it against an observed S phase. That circularity is named inside the argument. It is worth a factor of order one and the argument turns on three orders of magnitude, but it is not nothing.',
  'Several rates that an atomistic viewer would want are absent entirely because nothing was retrieved for them: nucleosome unwrapping and rewrapping kinetics, the residence time of a transcription factor, the stepping rate of a helicase separate from the polymerase, and the time a ribosome spends at a pause site. The module holds no placeholder for them.',
  'Half-lives appear here as a mammalian median in one cell type and a measured spread in another, with no shared design. They are the weakest pair of entries in the file and should not be read as a range of one quantity.',
  'The frame-rate criterion in ANIMATION_HONESTY is a display convention. No measurement of human temporal resolution backs it, which is recorded as a refusal rather than smoothed over.',
  'Nothing here is a simulation. The module supplies no positions, no forces, no stoichiometry and no geometry, and a viewer that uses these rates to move invented coordinates is still showing a depiction - a depiction with an honest clock on it.',
]);

// ---------------------------------------------------------------------------- worked output

export function worked() {
  const t = THE_ORIGIN_ARGUMENT;
  const lines = [];
  lines.push('THE ONE-ORIGIN CONSTRAINT');
  lines.push(`  human nuclear haploid assembly   ${GENOME.nuclear_haploid_bp.toLocaleString('en-US')} bp  (${GENOME.assembly}, ${GENOME.accession})`);
  lines.push(`  chromosome 1                     ${GENOME.chromosome_1_bp.toLocaleString('en-US')} bp`);
  lines.push(`  fork rate                        ${FORK_LO.toFixed(2)} to ${FORK_HI.toFixed(2)} bp/s  (1.7 to 1.8 kb/min, PMID ${RATES.replication_fork_mammal.pmid})`);
  lines.push(`  observed S phase                 ${DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.lo} to ${DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.hi} h  (PMID ${DURATIONS.cultured_mammalian_cell_cycle.pmid})`);
  lines.push('');
  lines.push(`  whole genome, one origin         ${t.whole_genome_one_origin.at_fast_fork.days.toFixed(1)} days (${t.whole_genome_one_origin.at_fast_fork.years.toFixed(2)} years) at the FASTEST fork`);
  lines.push(`  chromosome 1, one origin         ${t.chromosome_1_one_origin.at_fast_fork.days.toFixed(1)} days at the fastest fork`);
  lines.push(`  ratio to the LONGEST S phase     ${t.the_inequality.one_origin_whole_genome_over_longest_S.toFixed(0)}x (genome), ${t.the_inequality.one_origin_chromosome_1_over_longest_S.toFixed(0)}x (chromosome 1)`);
  lines.push(`  floor on origins, genome-wide    ${t.floor_on_the_origin_count.genome_wide.integer} (a FLOOR; the real count was not retrieved)`);
  lines.push('');
  lines.push('ANIMATION HONESTY  (one molecular step per frame at 60 fps)');
  for (const [k, v] of Object.entries(ANIMATION_HONESTY.per_process)) {
    lines.push(`  ${k.padEnd(28)} ${v.steps_per_second.toFixed(1).padStart(7)} ${v.step.padEnd(16)} ${v.steps_per_frame_at_real_time.toFixed(3).padStart(8)} steps/frame  ->  ${v.direction} x${v.factor < 1 ? (1 / v.factor).toFixed(1) : v.factor.toFixed(1)}${v.factor < 1 ? ' (slower)' : ''}`);
  }
  lines.push('');
  lines.push(`  one S phase in real time         ${ANIMATION_HONESTY.whole_process_at_real_time.longest_observed_S_phase.frames_at_60fps.toLocaleString('en-US')} frames`);
  lines.push('');
  lines.push(`REFUSED: ${Object.keys(NUMBERS_WE_DECLINED).length} numbers, each with a reason and a resolution path.`);
  return lines.join('\n');
}

// Run as a script, print the worked figures. IMPORTED (including by test-dynamics.mjs), print nothing.
// An earlier version of this guard tested `process.argv[1].endsWith('dynamics.mjs')`, which is also true
// of 'test-dynamics.mjs' - so the table printed itself above the test output every run. Compare paths.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  console.log(worked());
}
