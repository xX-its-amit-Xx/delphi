#!/usr/bin/env node
// machines.mjs - THE MOLECULAR MACHINES THE VIEWER DRAWS, AND THE MEASUREMENTS THAT FIX THEM.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// The molecular scale of this viewer zooms from a whole embryo down to one machine sitting on a
// chromosome: a ribosome, an RNA polymerase, a replisome, a nucleosome. Every POSITION in that view is
// generated. No measurement says this ribosome is 412 nm from that one at this instant in this cell, and
// nothing in this repo computes one. The layout function puts each object somewhere, and wherever it puts
// it is a choice. The sibling module `provenance.mjs` exists to carry that distinction on each drawn
// element and to refuse a view that hides it.
//
// This module is the other half. It holds the NUMBERS - how big, how many, how fast - and every one of
// them is a measurement with a retrieved source, so that what the viewer gets right is separable from
// what it invents. There is no rendering code here, no geometry generator, and no layout.
//
// The division of labour matters, because the failure mode is specific. A viewer whose ribosome is the
// wrong size by a factor of three is not "stylised", it is wrong in the one respect a scale viewer exists
// to be right about. And a viewer whose ribosome is the right size but whose SOURCE for that size is a
// remembered textbook figure is wrong in a way nobody can detect downstream. So:
//
//   - Every size here is either read off a deposited structure that was fetched this session, or measured
//     by this session FROM the deposited coordinates, with the computation stated.
//   - Every count and every rate names the ORGANISM, the CELL TYPE and the GROWTH STATE it was measured
//     in. A number measured in a microbe is not a number about a mammal, and a count per cell in a fast-
//     growing culture is not a count per cell in a quiescent one. Where only one organism could be
//     sourced, the entry says which and does not generalise.
//   - A number that could not be retrieved is a null with a reason and a statement of what would resolve
//     it. There are several of those below. They are the honest parts of the file.
//   - Where the literature disagrees, both values are recorded with both sources. Nothing is averaged.
//     See DISAGREEMENTS. The largest is a threefold spread in ribosomes per cell WITHIN ONE SPECIES.
//
// ============================== THE LESSON THAT COST THE MOST ==============================
// See THE_ASYMMETRIC_UNIT_TRAP. In short: the first envelope this session measured for the nuclear pore
// complex came out at 83 nm across, which is wrong by a factor of two, because the deposited coordinate
// file for that entry contains ONE of the eight symmetry-related copies. The deposited file is not the
// biological object. The error was caught only because the entry's own assembly record says "808-meric"
// while the entry says 101 chains, and that check is now part of how any envelope in this file is taken.
//
// ============================== WHAT THIS FILE WILL NOT DO ==============================
// It will not emit a single fused "fidelity" or "confidence" number for a machine. A diameter measured to
// 0.1 nm from a 1.94 A crystal structure and a copy number known to within a factor of three are not two
// values of one quantity, and the weighting that would combine them is a modelling choice nobody can
// defend. sizeLadder() returns measured lengths and the ratios between them, which are arithmetic on two
// measurements, not a score.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). This module names no member
// of it. The molecular machines here are the universal ones, so the holdout costs this file nothing - but
// the gate is still run against it rather than assumed. Run:
//   node holdout/check-leaks.mjs sim-engine/scales/molecular
//
//   node sim-engine/scales/molecular/machines.mjs        # print worked()
//   node sim-engine/scales/molecular/test-machines.mjs   # the tests

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

/** A number that could not be retrieved. The shape is deliberately not a number, so arithmetic on it throws. */
const unretrieved = (units, null_reason, what_would_resolve_it) =>
  ({ value: null, units, null_reason, what_would_resolve_it });

// ---------------------------------------------------------------------------- when, and from where

export const RETRIEVED_ON = '2026-11-07';

/**
 * The services actually called while this file was written. Recorded as URL TEMPLATES, so a reader can
 * repeat the exact call rather than trust the readback.
 */
export const SERVICES_CALLED = deepFreeze({
  rcsb_entry: 'https://data.rcsb.org/rest/v1/core/entry/{PDB_ID}',
  rcsb_assembly: 'https://data.rcsb.org/rest/v1/core/assembly/{PDB_ID}/1',
  rcsb_graphql: 'https://data.rcsb.org/graphql  (entries -> struct.title, exptl.method, rcsb_entry_info, polymer_entities, rcsb_primary_citation)',
  rcsb_coordinates: 'https://files.rcsb.org/download/{pdb_id}.cif.gz',
  rcsb_assembly_coordinates: 'https://files.rcsb.org/download/{pdb_id}-assembly1.cif.gz',
  emdb_entry: 'https://www.ebi.ac.uk/emdb/api/entry/EMD-{NNNNN}',
  uniprot: 'https://rest.uniprot.org/uniprotkb/{ACC}.json',
  ensembl_assembly: 'https://rest.ensembl.org/info/assembly/homo_sapiens?content-type=application/json',
  pubmed: 'NCBI PubMed / PMC, via the PubMed MCP tools (search, metadata, full text)',
});

// ---------------------------------------------------------------------------- sources

/**
 * Every paper a number in this file came from. Each was retrieved this session; `read_back` is the
 * sentence or table value the number was taken from, not a paraphrase of what the paper is about.
 */
export const SOURCES = deepFreeze({
  khatter_2015: {
    cite: 'Khatter H, Myasnikov AG, Natchiar SK, Klaholz BP (2015) Structure of the human 80S ribosome. Nature 520:640-645.',
    doi: '10.1038/nature14427', pmid: '25901680',
    read_back: 'Primary citation of PDB 4UG0 as returned by data.rcsb.org (rcsb_primary_citation). Abstract retrieved from PubMed: "average resolution of 3.6 A, reaching 2.9 A resolution in the most stable regions".',
  },
  watson_2020: {
    cite: 'Watson ZL et al. (2020) Structure of the bacterial ribosome at 2 Angstrom resolution. eLife 9:e60482.',
    doi: '10.7554/eLife.60482', pmid: '32924932',
    read_back: 'Primary citation of PDB 7K00 as returned by data.rcsb.org. Author list beyond the first was not retrieved and is not asserted here.',
  },
  cramer_2001: {
    cite: 'Cramer P, Bushnell DA, Kornberg RD (2001) Structural basis of transcription: RNA polymerase II at 2.8 angstrom resolution. Science 292:1863-1876.',
    doi: '10.1126/science.1059493', pmid: '11313498',
    read_back: 'Primary citation of PDB 1I3Q as returned by data.rcsb.org. Note the entry title says 3.1 A for THIS crystal form; the paper title says 2.8 A for another. Both are recorded; neither is averaged.',
  },
  bernecky_2016: {
    cite: 'Bernecky C, Herzog F, Baumeister W, Plitzko JM, Cramer P (2016) Structure of transcribing mammalian RNA polymerase II. Nature 529:551-554.',
    doi: '10.1038/NATURE16482', pmid: '26789250',
    read_back: 'Primary citation of PDB 5FLM as returned by data.rcsb.org, with the DOI exactly as the service spells it (upper-case NATURE).',
  },
  jonkers_2014: {
    cite: 'Jonkers I, Kwak H, Lis JT (2014) Genome-wide dynamics of Pol II elongation and its interplay with promoter proximal pausing, chromatin, and exons. eLife 3:e02407.',
    doi: '10.7554/eLife.02407', pmid: '24843027',
    read_back: 'Full text from PMC3619942-adjacent record PMC4001325. Verbatim: "We directly measured 141 early (5-12.5 min), 938 mid (12.5-25 min), and 245 late (25-50 min) elongation rates, with average elongation rates of 0.5, 1.8 and 2.4 kb/min respectively." And: "we measured elongation rates ranging from 0.5 to 4 kb/min at ~1000 genes". And the acceleration model: "Pol II starts at 5 bp/s (300 bp/min) and accelerates to reach 40 bp/s (2.4 kb/min) at the 60 kb position and downstream."',
  },
  ingolia_2011: {
    cite: 'Ingolia NT, Lareau LF, Weissman JS (2011) Ribosome profiling of mouse embryonic stem cells reveals the complexity and dynamics of mammalian proteomes. Cell 147:789-802.',
    doi: '10.1016/j.cell.2011.10.002', pmid: '22056041',
    read_back: 'Full text from PMC3225288. Verbatim: "Following a delay of ~60 seconds, which presumably reflects the time required for engagement of harringtonine, ribosomes progress from the 5\' ends of transcripts at a rate of 5.6 amino acids per second". Also: "Based on a typical elongation rate of ~6 codons per second". Cell line named in the methods: E14 mESCs.',
  },
  young_bremer_1976: {
    cite: 'Young R, Bremer H (1976) Polypeptide-chain-elongation rate in Escherichia coli B/r as a function of growth rate. Biochem J 160:185-194.',
    doi: '10.1042/bj1600185', pmid: '795428',
    read_back: 'Abstract from PubMed. Verbatim: "the peptide-chain elongation rate for Escherichia coli B/r at three different growth rates (mu) was determined to be 17 amino acids/s for the fast-growing cells (mu equals 1.3 and 2.0 doublings/h) and 12 amino acids/s for slow-growing cells (mu equals 0.67 doublings/h)". Also: "the fraction of ribosomes engaged in protein synthesis is about 0.8 at all three growth rates."',
  },
  bakshi_2012: {
    cite: 'Bakshi S, Siryaporn A, Goulian M, Weisshaar JC (2012) Superresolution imaging of ribosomes and RNA polymerase in live Escherichia coli cells. Mol Microbiol 85:21-38.',
    doi: '10.1111/j.1365-2958.2012.08081.x', pmid: '22624875',
    read_back: 'Full text from PMC3383343. Verbatim: "the resulting estimated copy number ranges from ~30,000 to ~70,000 ribosomes per cell (42 cells"; "The mean number of ribosomes per cell is ~55,000."; "The average number of beta-prime-yGFP per cell is 4,600 (31 cells"; growth conditions "EZRDM at 30C" with "doubling times of 54 min" for the S2-YFP strain AFS55 and 43 min for the RNAP strain RLG7470. The paper also records the disagreement with earlier work; see DISAGREEMENTS.',
  },
  conti_2007: {
    cite: 'Conti C, Sacca B, Herrick J, Lalou C, Pommier Y, Bensimon A (2007) Replication fork velocities at adjacent replication origins are coordinately modified during DNA replication in human cells. Mol Biol Cell 18:3059-3067.',
    doi: '10.1091/mbc.E06-08-0689', pmid: '17522385',
    read_back: 'Fetched from PMC1949372. Normal primary keratinocytes pooled from three donors: "a mean fork velocity of 1.46 +/- 0.01 kb/min", median 1.30, SD 0.81, n = 5460, "with values ranging from 0.14 to 11.8 kb/min". Cancer IC1 keratinocyte line: mean 1.67 kb/min (SEM 0.03), median 1.54, SD 0.72, n = 657.',
  },
  zheng_2020_pold: {
    cite: 'Zheng F, Georgescu RE, Li H, O\'Donnell ME (2020) Structure of the processive human Pol delta holoenzyme. Nat Commun 11:1109.',
    doi: '10.1038/s41467-020-14898-6', pmid: '32111820',
    read_back: 'Primary citation of PDB 6TNY as returned by data.rcsb.org. The entry title read back was "Processive human polymerase delta holoenzyme".',
  },
  yuan_2020_pole: {
    cite: 'Yuan Z, Georgescu R, Schauer GD, O\'Donnell ME, Li H (2020) Structure of the polymerase epsilon holoenzyme and atomic model of the leading strand replisome. Nat Commun 11:3156.',
    doi: '10.1038/s41467-020-16910-5', pmid: null,
    read_back: 'Primary citation of PDB 6WJV as returned by data.rcsb.org. The service returned a DOI and journal/year but a NULL PubMed id for this entry, so no PMID is asserted here.',
  },
  luger_1997: {
    cite: 'Luger K, Mader AW, Richmond RK, Sargent DF, Richmond TJ (1997) Crystal structure of the nucleosome core particle at 2.8 A resolution. Nature 389:251-260.',
    doi: '10.1038/38444', pmid: '9305837',
    read_back: 'Primary citation of PDB 1AOI as returned by data.rcsb.org.',
  },
  davey_2002: {
    cite: 'Davey CA, Sargent DF, Luger K, Maeder AW, Richmond TJ (2002) Solvent mediated interactions in the structure of the nucleosome core particle at 1.9 A resolution. J Mol Biol 319:1097-1113.',
    doi: '10.1016/S0022-2836(02)00386-8', pmid: '12079350',
    read_back: 'Primary citation of PDB 1KX5 as returned by data.rcsb.org.',
  },
  woodcock_2006: {
    cite: 'Woodcock CL, Skoultchi AI, Fan Y (2006) Role of linker histone in chromatin structure and function: H1 stoichiometry and nucleosome repeat length. Chromosome Res 14:17-25.',
    doi: '10.1007/s10577-005-1024-3', pmid: '16506093',
    read_back: 'Abstract from PubMed. Verbatim: "One common feature of H1-depleted nuclei is a reduction in nucleosome repeat length (NRL). Moreover, there is a robust linear relationship between H1 stoichiometry and NRL". This is the source for the claim that the nucleosome repeat length is NOT a constant, which is why the nucleosome count per cell below is a null and not a number.',
  },
  xu_1997_groel: {
    cite: 'Xu Z, Horwich AL, Sigler PB (1997) The crystal structure of the asymmetric GroEL-GroES-(ADP)7 chaperonin complex. Nature 388:741-750.',
    doi: '10.1038/41944', pmid: '9285585',
    read_back: 'Primary citation of PDB 1AON as returned by data.rcsb.org.',
  },
  gestaut_2019_tric: {
    cite: 'Gestaut D et al. (2019) The chaperonin TRiC/CCT associates with prefoldin through a conserved electrostatic interface essential for cellular proteostasis. Cell 177:751-765.',
    doi: '10.1016/j.cell.2019.03.012', pmid: '30955883',
    read_back: 'Primary citation of PDB 6NR8 as returned by data.rcsb.org. Author list beyond the first was not retrieved and is not asserted.',
  },
  zhang_2017_spliceosome: {
    cite: 'Zhang X et al. (2017) An atomic structure of the human spliceosome. Cell 169:918-929.',
    doi: '10.1016/j.cell.2017.04.033', pmid: '28502770',
    read_back: 'Primary citation of PDB 5XJC as returned by data.rcsb.org. Entry title read back: "Cryo-EM structure of the human spliceosome just prior to exon ligation at 3.6 angstrom".',
  },
  ori_2013: {
    cite: 'Ori A et al. (2013) Cell type-specific nuclear pores: a case in point for context-dependent stoichiometry of molecular machines. Mol Syst Biol 9:648.',
    doi: '10.1038/msb.2013.4', pmid: '23511206',
    read_back: 'Fetched from PMC3619942. Verbatim: "we estimated an average number of 3376+/-1304 NPC per nucleus"; "Taken together with the number of molecules per nucleus, these data result in an average of 37+/-14 Nup107 copies per NPC"; and the adopted scaffold value of 32 copies. The Nup107 counts were made on HeLa nuclei; the paper does not name a cell line for the per-nucleus NPC estimate itself, which is recorded as a caveat here.',
  },
  mosalaganti_2022: {
    cite: 'Mosalaganti S et al. (2022) AI-based structure prediction empowers integrative structural analysis of human nuclear pores. Science 376:eabm9506.',
    doi: '10.1126/science.abm9506', pmid: '35679397',
    read_back: 'Primary citation of PDB 7R5J as returned by data.rcsb.org; structured abstract from PubMed. Verbatim: "With a molecular weight of ~120 MDa, the human NPC is one of the largest protein complexes. Its ~1000 proteins are taken in multiple copies from a set of about 30 distinct nucleoporins (NUPs)." And: "Our 70-MDa atomically resolved model covers >90% of the human NPC scaffold."',
  },
  bley_2022: {
    cite: 'Bley CJ et al. (2022) Architecture of the cytoplasmic face of the nuclear pore. Science 376:eabm9129.',
    doi: '10.1126/science.abm9129', pmid: '35679405',
    read_back: 'Primary citation of PDB 7TBL as returned by data.rcsb.org. Author list beyond the first was not retrieved and is not asserted.',
  },
  ensembl_grch38: {
    cite: 'Ensembl REST, info/assembly/homo_sapiens, release 116. Assembly GRCh38.p14, GCA_000001405.29.',
    doi: null, pmid: null,
    read_back: 'golden_path = 3,099,750,718 bp; the 25 primary chromosomes (1-22, X, Y, MT) sum to 3,088,286,401 bp; chromosomes 1-22 plus X sum to 3,031,042,417 bp. Ensembl release reported as 116 by info/data.',
  },
});

// ---------------------------------------------------------------------------- structures, as the service returned them

/**
 * The raw readback for every structure cited below. Each was fetched this session from
 * SERVICES_CALLED.rcsb_entry and, where an EMDB id was present, from SERVICES_CALLED.emdb_entry.
 *
 * `deposited_polymer_chains` and `assembly1_polymer_chains` are both recorded, because when they differ
 * the coordinate file is NOT the biological object. See THE_ASYMMETRIC_UNIT_TRAP.
 */
export const STRUCTURES_VERIFIED = deepFreeze({
  '4UG0': {
    title_read_back: 'STRUCTURE OF THE HUMAN 80S RIBOSOME',
    method: 'ELECTRON MICROSCOPY', resolution_A: 3.6,
    deposited_model_mass_kDa: 3835.52, deposited_polymer_chains: 81, assembly1_polymer_chains: 81,
    assembly1_oligomeric_details: '89-meric',
    source_organisms: ['Homo sapiens'],
    emdb: null, primary_citation: 'khatter_2015',
  },
  '7K00': {
    title_read_back: 'Structure of the Bacterial Ribosome at 2 Angstrom Resolution',
    method: 'ELECTRON MICROSCOPY', resolution_A: 1.98,
    deposited_model_mass_kDa: 2209.99, deposited_polymer_chains: 56, assembly1_polymer_chains: 56,
    assembly1_oligomeric_details: '56-meric',
    source_organisms: ['Escherichia coli'],
    emdb: { id: 'EMD-22586', title_read_back: 'Structure of the Bacterial Ribosome at 2 Angstrom Resolution (composite structure)', method: 'singleParticle', resolution_A: 1.98, resolution_type: 'BY AUTHOR' },
    primary_citation: 'watson_2020',
  },
  '1I3Q': {
    title_read_back: 'RNA POLYMERASE II CRYSTAL FORM I AT 3.1 A RESOLUTION',
    method: 'X-RAY DIFFRACTION', resolution_A: 3.1,
    deposited_model_mass_kDa: 470.17, deposited_polymer_chains: 10, assembly1_polymer_chains: 10,
    assembly1_oligomeric_details: 'decameric',
    source_organisms: ['Saccharomyces cerevisiae'],
    emdb: null, primary_citation: 'cramer_2001',
  },
  '5FLM': {
    title_read_back: 'Structure of transcribing mammalian RNA polymerase II',
    method: 'ELECTRON MICROSCOPY', resolution_A: 3.4,
    deposited_model_mass_kDa: 548.25, deposited_polymer_chains: 15, assembly1_polymer_chains: 15,
    assembly1_oligomeric_details: 'pentadecameric',
    source_organisms: ['Bos taurus', 'synthetic construct'],
    emdb: { id: 'EMD-3218', title_read_back: null, method: null, resolution_A: null, resolution_type: null },
    primary_citation: 'bernecky_2016',
  },
  '6TNY': {
    title_read_back: 'Processive human polymerase delta holoenzyme',
    method: 'ELECTRON MICROSCOPY', resolution_A: 3.08,
    deposited_model_mass_kDa: 351.43, deposited_polymer_chains: 9, assembly1_polymer_chains: 9,
    assembly1_oligomeric_details: 'nonameric',
    source_organisms: ['Homo sapiens', 'synthetic construct'],
    chain_inventory_read_back: 'DNA polymerase delta catalytic subunit (1107 aa) x1; POLD2 (469 aa) x1; POLD3 (474 aa) x1; POLD4 (137 aa) x1; proliferating cell nuclear antigen (264 aa) x3; DNA template 38 nt x1; DNA primer 25 nt x1',
    emdb: { id: 'EMD-10539', title_read_back: null, method: null, resolution_A: null, resolution_type: null },
    primary_citation: 'zheng_2020_pold',
  },
  '6WJV': {
    title_read_back: 'Structure of the Saccharomyces cerevisiae polymerase epsilon holoenzyme',
    method: 'ELECTRON MICROSCOPY', resolution_A: 3.5,
    deposited_model_mass_kDa: 379.21, deposited_polymer_chains: 4, assembly1_polymer_chains: 4,
    assembly1_oligomeric_details: 'tetrameric',
    source_organisms: ['Saccharomyces cerevisiae S288C'],
    chain_inventory_read_back: 'DNA polymerase epsilon catalytic subunit A (2222 aa modelled) x1; subunit B (689 aa) x1; subunit C (201 aa) x1; subunit D (196 aa) x1',
    emdb: { id: 'EMD-21701', title_read_back: null, method: null, resolution_A: null, resolution_type: null },
    primary_citation: 'yuan_2020_pole',
  },
  '1KX5': {
    title_read_back: 'X-Ray Structure of the Nucleosome Core Particle, NCP147, at 1.9 A Resolution',
    method: 'X-RAY DIFFRACTION', resolution_A: 1.94,
    deposited_model_mass_kDa: 200.28, deposited_polymer_chains: 10, assembly1_polymer_chains: 10,
    assembly1_oligomeric_details: 'decameric',
    source_organisms: ['Xenopus laevis', 'Homo sapiens'],
    chain_inventory_read_back: 'histone H3 (135 aa) x2; H4 (102 aa) x2; H2A.1 (128 aa) x2; H2B.2 (125 aa) x2; two DNA strands of 147 nt each',
    emdb: null, primary_citation: 'davey_2002',
  },
  '1AOI': {
    title_read_back: 'COMPLEX BETWEEN NUCLEOSOME CORE PARTICLE (H3,H4,H2A,H2B) AND 146 BP LONG DNA FRAGMENT',
    method: 'X-RAY DIFFRACTION', resolution_A: 2.8,
    deposited_model_mass_kDa: 184.55, deposited_polymer_chains: 10, assembly1_polymer_chains: 10,
    assembly1_oligomeric_details: 'decameric',
    source_organisms: ['Xenopus laevis'],
    chain_inventory_read_back: 'histones H2B (99 aa) x2, H2A (116 aa) x2, H4 (87 aa) x2, H3 (116 aa) x2; "PALINDROMIC 146 BP DNA REPEAT 8/9 FROM HUMAN X-CHROMOSOME ALPHA SATELLITE DNA" 146 nt x2',
    emdb: null, primary_citation: 'luger_1997',
  },
  '5XJC': {
    title_read_back: 'Cryo-EM structure of the human spliceosome just prior to exon ligation at 3.6 angstrom',
    method: 'ELECTRON MICROSCOPY', resolution_A: 3.6,
    deposited_model_mass_kDa: 2962.08, deposited_polymer_chains: 50, assembly1_polymer_chains: 50,
    assembly1_oligomeric_details: '50-meric',
    source_organisms: ['Homo sapiens', 'a viral construct chain also listed by the service'],
    emdb: { id: 'EMD-6721', title_read_back: null, method: null, resolution_A: null, resolution_type: null },
    primary_citation: 'zhang_2017_spliceosome',
  },
  '1AON': {
    title_read_back: 'CRYSTAL STRUCTURE OF THE ASYMMETRIC CHAPERONIN COMPLEX GROEL/GROES/(ADP)7',
    method: 'X-RAY DIFFRACTION', resolution_A: 3.0,
    deposited_model_mass_kDa: 877.61, deposited_polymer_chains: 21, assembly1_polymer_chains: 21,
    assembly1_oligomeric_details: '21-meric',
    source_organisms: ['Escherichia coli'],
    chain_inventory_read_back: 'GROEL (547 aa) x14; GROES (97 aa) x7 - the 14 + 7 stoichiometry read straight off the deposition',
    emdb: null, primary_citation: 'xu_1997_groel',
  },
  '6NR8': {
    title_read_back: 'hTRiC-hPFD Class6',
    method: 'ELECTRON MICROSCOPY', resolution_A: 7.8,
    deposited_model_mass_kDa: 981.46, deposited_polymer_chains: 22, assembly1_polymer_chains: 22,
    assembly1_oligomeric_details: '22-meric',
    source_organisms: ['Homo sapiens'],
    emdb: { id: 'EMD-0490', title_read_back: null, method: null, resolution_A: null, resolution_type: null },
    primary_citation: 'gestaut_2019_tric',
  },
  '7R5J': {
    title_read_back: 'Human nuclear pore complex (dilated)',
    method: 'ELECTRON MICROSCOPY', resolution_A: 50,
    deposited_model_mass_kDa: 12078.34, deposited_polymer_chains: 101, assembly1_polymer_chains: 808,
    assembly1_oligomeric_details: '808-meric',
    assembly1_symmetry_read_back: 'Global Symmetry C8, Cyclic, "Hetero 808-mer"',
    source_organisms: ['Homo sapiens'],
    emdb: { id: 'EMD-14321', title_read_back: 'Human nuclear pore complex (dilated)', method: 'subtomogramAveraging', resolution_A: 50.0, resolution_type: 'BY AUTHOR' },
    primary_citation: 'mosalaganti_2022',
  },
  '7TBL': {
    title_read_back: 'Composite structure of the human nuclear pore complex (NPC) cytoplasmic face generated with a 12A cryo-ET map of the purified HeLa cell NPC',
    method: 'ELECTRON MICROSCOPY', resolution_A: 23,
    deposited_model_mass_kDa: 6611.25, deposited_polymer_chains: 141, assembly1_polymer_chains: 1128,
    assembly1_oligomeric_details: '1128-meric',
    assembly1_symmetry_read_back: 'Global Symmetry C8, "Hetero 1088-mer"; Pseudo Symmetry C1. Note that the service reports 1128 polymer instances in assembly 1 while naming the symmetry oligomer as 1088 - the two differ by 40 and no attempt is made here to reconcile them.',
    source_organisms: ['Homo sapiens'],
    emdb: { id: 'EMD-14322', title_read_back: 'Human nuclear pore complex (constricted)', method: 'subtomogramAveraging', resolution_A: 12.0, resolution_type: 'BY AUTHOR' },
    primary_citation: 'bley_2022',
    note: 'Carried as the CONSTRICTED counterpart to 7R5J, for contrast only. It is the SECOND asymmetric-unit deposition in this file: 141 deposited chains against 1128 in the C8 assembly. No envelope is measured from it - neither from the deposited file, which would repeat the mistake in THE_ASYMMETRIC_UNIT_TRAP, nor from the expanded assembly, which was not downloaded. So the constricted state has a verified accession and no geometry.',
  },
});

/**
 * Accessions that were tried and did not resolve. Recorded rather than quietly replaced, because the
 * reason a famous accession 404s is itself information.
 */
export const STRUCTURES_REJECTED = deepFreeze([
  {
    id: '6EK0', wanted_for: 'the high-resolution human 80S ribosome with visualised rRNA modifications',
    what_happened: 'GET https://data.rcsb.org/rest/v1/core/entry/6EK0 returned HTTP 404 with body {"status":404,"message":"No data found for entryId: 6EK0"}.',
    what_was_used_instead: '4UG0, the human 80S at 3.6 A, which resolved and whose title and method were read back.',
    note: 'The paper this accession is associated with (Natchiar SK et al. 2017, Visualization of chemical modifications in the human 80S ribosome structure, Nature 551:472-477, doi 10.1038/nature24482, PMID 29143818) WAS retrieved from PubMed and is real. It is the accession, not the paper, that did not resolve. No replacement accession is asserted for it.',
  },
]);

// ---------------------------------------------------------------------------- how the envelopes were measured

/**
 * The envelopes in MACHINES were not copied from a paper. They were computed this session from the
 * deposited coordinates, by the procedure recorded here, so that the number and its derivation travel
 * together and either can be re-run.
 */
export const ENVELOPE_METHOD = deepFreeze({
  input: 'The mmCIF coordinate file from SERVICES_CALLED.rcsb_coordinates, gunzipped and parsed for the _atom_site loop.',
  atoms_included: 'ATOM and HETATM records, model 1 only. Hydrogens are included where the deposition has them (the 1.94 A nucleosome does); most do not.',
  assembly_rule:
    'If assembly1_polymer_chains differs from deposited_polymer_chains, the deposited file is one asymmetric unit and the envelope is measured from SERVICES_CALLED.rcsb_assembly_coordinates instead. This rule exists because it was broken once; see THE_ASYMMETRIC_UNIT_TRAP.',
  principal_extents:
    'Centroid, then the 3x3 covariance of atom positions, diagonalised by cyclic Jacobi rotations; the extent along each eigenvector is max minus min of the projected coordinate. Reported sorted descending. This is an oriented bounding box, not an axis-aligned one, so it does not depend on how the depositor happened to place the molecule in the cell.',
  max_atom_pair_distance:
    'Two-pass farthest-point search: the atom farthest from the centroid, then the atom farthest from that. For a convex-ish body this is the diameter; for a strongly concave one it is a lower bound on it. Used as the single sort key in sizeLadder() because it is one measured length with one definition.',
  radius_of_gyration: 'Root mean square distance of atoms from the centroid. Reported because it is far less sensitive to a single disordered tail than any extent is.',
  what_this_is_not:
    'It is not a molecular surface, a solvent-excluded volume, or a hydrodynamic radius. It is the extent of the MODELLED ATOMS. A disordered tail that was modelled inflates it; a disordered tail that was not modelled deflates it. The nucleosome below is an instructive case of the first and the pore complex of the second.',
});

// ---------------------------------------------------------------------------- the machines

/**
 * One entry per machine the viewer draws.
 *
 * Field contract:
 *   id, name, what_it_does      - what_it_does is one sentence for someone who is not a molecular biologist.
 *   dimensions_nm               - { from, principal_extents_nm, max_extent_nm, radius_of_gyration_nm, atoms_measured, shape_note }
 *                                 `from` names the accession the geometry came from and whether it was the
 *                                 deposited file or the expanded biological assembly.
 *   mass_MDa                    - { deposited_model, biological_object } ; either may be a null with a reason.
 *                                 These two are NOT the same quantity and are never merged.
 *   structure                   - the accession(s), keyed into STRUCTURES_VERIFIED.
 *   copies_per_cell             - an ARRAY. Each element names organism, cell type and growth state. A single
 *                                 number with no organism attached would be the worst field in this file.
 *   rate                        - an ARRAY. Each element carries its own units, conditions and source.
 *   verified_how                - exactly what was fetched and what was read back.
 */
export const MACHINES = deepFreeze([

  // ------------------------------------------------------------------ 80S ribosome
  {
    id: 'ribosome_80S',
    name: 'Eukaryotic ribosome (80S)',
    what_it_does: 'Reads a messenger RNA three letters at a time and joins the matching amino acids into a protein chain.',
    structure: { primary: '4UG0', also: [] },
    dimensions_nm: {
      from: '4UG0, deposited coordinates (deposited chains 81 = assembly 1 chains 81, so no expansion needed)',
      principal_extents_nm: [30.2, 27.3, 26.1],
      max_extent_nm: 31.0,
      radius_of_gyration_nm: 9.67,
      atoms_measured: 218776,
      shape_note: 'Nearly isotropic: the longest and shortest principal extents differ by only about 15%. Drawing it as a lumpy sphere about 30 nm across is defensible; drawing it as an elongated object is not.',
    },
    mass_MDa: {
      deposited_model: { value: 3.836, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 4UG0 = 3835.52 kDa' },
      biological_object: unretrieved('MDa',
        'No independent mass measurement (analytical ultracentrifugation or native mass spectrometry) for the human 80S was retrieved this session.',
        'A native-MS or sedimentation-equilibrium mass for the intact human 80S, which would also say which associated factors were counted.'),
    },
    copies_per_cell: [
      unretrieved('ribosomes per cell',
        'No primary measurement of ribosomes per cell for any mammalian cell type was retrieved this session. Several searches returned nothing usable, and the commonly repeated "about ten million per mammalian cell" was not traced to a measurement.',
        'An absolute quantification in a named cell line - rRNA mass per cell divided by rRNA mass per ribosome, or a calibrated ribosome-protein copy number - reported for a stated growth state. It must name the cell type: a ribosome count is a function of how fast the cell is growing.'),
    ],
    rate: [
      {
        quantity: 'peptide chain elongation', value: 5.6, units: 'amino acids per second per ribosome',
        organism: 'Mus musculus', cell_type: 'embryonic stem cells, line E14',
        conditions: 'in vivo; harringtonine block of initiation followed by ribosome run-off, tracked by ribosome profiling; a ~60 s delay for drug engagement was subtracted',
        source: 'ingolia_2011',
        caveat: 'A population average over thousands of genes. The same paper reports more than a thousand sites where local ribosome density is 25-fold above the gene median, i.e. pauses of several seconds. The average is not what any one ribosome is doing at any one codon.',
      },
    ],
    verified_how:
      'Fetched https://data.rcsb.org/rest/v1/core/entry/4UG0 and read back title "STRUCTURE OF THE HUMAN 80S RIBOSOME", method ELECTRON MICROSCOPY, resolution_combined [3.6], molecular_weight 3835.52 kDa, 81 polymer entity instances, and source organism Homo sapiens from the polymer entities. Fetched assembly 1 and read back 81 polymer instances, so the deposited file is the whole particle. Downloaded 4ug0.cif.gz and measured 218,776 atoms. Fetched rcsb_primary_citation and read back DOI 10.1038/nature14427, PMID 25901680. Rate from the PMC full text of Ingolia 2011, quoted verbatim in SOURCES.',
  },

  // ------------------------------------------------------------------ 70S ribosome
  {
    id: 'ribosome_70S',
    name: 'Bacterial ribosome (70S)',
    what_it_does: 'The same job as the eukaryotic ribosome - turning a messenger RNA into a protein - in a smaller machine with fewer parts.',
    structure: { primary: '7K00', also: [] },
    dimensions_nm: {
      from: '7K00, deposited coordinates (deposited chains 56 = assembly 1 chains 56)',
      principal_extents_nm: [26.9, 24.4, 20.5],
      max_extent_nm: 27.9,
      radius_of_gyration_nm: 8.30,
      atoms_measured: 149338,
      shape_note: 'Smaller than the 80S in every principal direction, but only by about 11% on the longest axis. The two ribosomes are not dramatically different in size, which is the point of carrying both: a viewer that draws the bacterial one as half the size is wrong.',
    },
    mass_MDa: {
      deposited_model: { value: 2.210, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 7K00 = 2209.99 kDa' },
      biological_object: unretrieved('MDa',
        'No independent mass measurement retrieved this session.',
        'A native-MS or sedimentation mass for the intact 70S, with the associated factors it counted stated.'),
    },
    copies_per_cell: [
      {
        organism: 'Escherichia coli', strain: 'K-12 derivative AFS55, chromosomal S2-YFP replacing S2',
        cell_type: 'whole cell', growth_state: 'EZ rich defined medium, 30 C, bulk doubling time 54 min',
        value: 55000, range: [30000, 70000], units: 'ribosomes per cell', n_cells: 42,
        counts: '30S subunits plus complete 70S ribosomes, because the label is on a small-subunit protein',
        method: 'total pre-bleach YFP intensity scaled to the intensity of a single YFP molecule',
        source: 'bakshi_2012',
        caveat: 'Increases monotonically with cell volume within the same culture. A single number per species does not exist; this one belongs to this strain in this medium at this temperature.',
      },
      {
        organism: 'Escherichia coli', strain: 'B/r', cell_type: 'whole cell',
        growth_state: '37 C, interpolated between 40 min and 60 min doubling times',
        value: 18000, units: 'ribosomes per cell',
        method: 'earlier bulk measurement, reported second-hand by bakshi_2012 as the value their result disagrees with',
        source: 'bakshi_2012',
        caveat: 'THIS IS A SECOND-HAND NUMBER. It is recorded because the disagreement is threefold and real, not because the original was retrieved. The original measurement was not fetched this session. See DISAGREEMENTS.',
      },
    ],
    rate: [
      {
        quantity: 'peptide chain elongation', value: 17, units: 'amino acids per second per ribosome',
        organism: 'Escherichia coli', strain: 'B/r', cell_type: 'whole cell',
        conditions: 'fast growth, mu = 1.3 and 2.0 doublings per hour; kinetics of radioactive labelling of nascent and finished polypeptides',
        source: 'young_bremer_1976',
      },
      {
        quantity: 'peptide chain elongation', value: 12, units: 'amino acids per second per ribosome',
        organism: 'Escherichia coli', strain: 'B/r', cell_type: 'whole cell',
        conditions: 'slow growth, mu = 0.67 doublings per hour; same method',
        source: 'young_bremer_1976',
        caveat: 'The rate is a function of growth rate, so a viewer that animates one speed is animating one growth condition. The same paper puts the engaged fraction of ribosomes at about 0.8 across all three growth rates, so roughly one ribosome in five is doing nothing at any instant.',
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 7K00 and read back title "Structure of the Bacterial Ribosome at 2 Angstrom Resolution", method ELECTRON MICROSCOPY, resolution_combined [1.98], molecular_weight 2209.99 kDa, 56 polymer instances, source organism Escherichia coli, and EMDB id EMD-22586. Fetched https://www.ebi.ac.uk/emdb/api/entry/EMD-22586 and read back title "Structure of the Bacterial Ribosome at 2 Angstrom Resolution (composite structure)", method singleParticle, resolution 1.98 A reported BY AUTHOR. Fetched assembly 1: 56 polymer instances, so no expansion. Downloaded 7k00.cif.gz and measured 149,338 atoms. Primary citation read back as DOI 10.7554/eLife.60482, PMID 32924932. Counts from the PMC full text of Bakshi 2012; rates from the PubMed abstract of Young & Bremer 1976, both quoted verbatim in SOURCES.',
  },

  // ------------------------------------------------------------------ RNA polymerase II
  {
    id: 'rna_polymerase_II',
    name: 'RNA polymerase II',
    what_it_does: 'Opens the DNA double helix and copies a gene into a messenger RNA, one nucleotide at a time.',
    structure: { primary: '5FLM', also: ['1I3Q'] },
    dimensions_nm: {
      from: '5FLM, deposited coordinates (transcribing mammalian Pol II; deposited chains 15 = assembly 1 chains 15)',
      principal_extents_nm: [16.2, 14.8, 14.6],
      max_extent_nm: 16.7,
      radius_of_gyration_nm: 5.06,
      atoms_measured: 32712,
      shape_note: 'Compact and close to isotropic at this resolution. The 10-subunit yeast crystal form 1I3Q measures 14.9 x 13.2 x 12.8 nm with a 15.1 nm maximum extent over 28,161 atoms - smaller, because it has five fewer chains and no nucleic acid, not because the enzyme is smaller in that organism.',
      second_structure_note: 'Both numbers are kept. Choosing one and calling it "the" size of Pol II would hide the fact that the difference is a difference in what was crystallised.',
    },
    mass_MDa: {
      deposited_model: { value: 0.548, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 5FLM = 548.25 kDa; for 1I3Q it is 470.17 kDa' },
      biological_object: unretrieved('MDa',
        'No independent mass measurement of an intact Pol II elongation complex was retrieved this session.',
        'A native-MS mass for a defined elongation complex, stating which subunits and nucleic acids were present.'),
    },
    copies_per_cell: [
      unretrieved('RNA polymerase II molecules per nucleus',
        'No primary measurement of Pol II copy number for any mammalian or fungal cell was retrieved this session.',
        'A calibrated single-molecule count or absolute proteomic quantification of RPB1 in a named cell line and growth state. Note that the useful number is the number ENGAGED, not the number present, and those differ.'),
      {
        organism: 'Escherichia coli', strain: 'K-12 derivative RLG7470, beta-prime-yGFP',
        cell_type: 'whole cell', growth_state: 'EZ rich defined medium, 30 C, doubling time 43 min',
        value: 4600, range: [2000, 10000], units: 'RNA polymerase molecules per cell', n_cells: 31,
        method: 'total pre-bleach GFP intensity scaled to a single GFP molecule',
        source: 'bakshi_2012',
        caveat: 'THIS IS THE BACTERIAL ENZYME, NOT POL II. Bacteria have one multisubunit RNA polymerase; eukaryotes have three, of which Pol II makes messenger RNA. The number is carried here as the only polymerase count that was actually retrieved, and it is explicitly not a Pol II number.',
      },
    ],
    rate: [
      {
        quantity: 'transcription elongation', value: 2.4, units: 'kb per minute',
        value_nt_per_s: 40,
        organism: 'Mus musculus', cell_type: 'embryonic stem cells',
        conditions: 'late gene body, 25-50 min after release from a flavopiridol pause block, tracked by GRO-seq; average over 245 measured rates, SD 0.79 kb/min',
        source: 'jonkers_2014',
      },
      {
        quantity: 'transcription elongation', value: 1.8, units: 'kb per minute',
        organism: 'Mus musculus', cell_type: 'embryonic stem cells',
        conditions: 'mid gene body, 12.5-25 min window; average over 938 measured rates, SD 0.69 kb/min',
        source: 'jonkers_2014',
      },
      {
        quantity: 'transcription elongation', value: 0.5, units: 'kb per minute',
        value_nt_per_s: 8.3,
        organism: 'Mus musculus', cell_type: 'embryonic stem cells',
        conditions: 'early gene body, 5-12.5 min window; average over 141 measured rates, SD 0.43 kb/min',
        source: 'jonkers_2014',
        caveat: 'The polymerase ACCELERATES through a gene. The same paper fits a model running from 5 bp/s at the start site to 40 bp/s by 60 kb in - an eightfold change within one transcript. Any animation that moves a polymerase at a constant speed is showing something that was measured not to happen.',
      },
      {
        quantity: 'transcription elongation, full observed spread', value: null, range: [0.5, 4.0], units: 'kb per minute',
        organism: 'Mus musculus', cell_type: 'embryonic stem cells',
        conditions: 'across approximately 1000 genes and across regions within genes',
        source: 'jonkers_2014',
        caveat: 'The same paper notes that earlier single-gene work across various organisms gave 1 to 4 kb/min, so the spread is not an artefact of one method.',
      },
    ],
    verified_how:
      'Fetched the RCSB entries for 5FLM and 1I3Q. Read back for 5FLM: title "Structure of transcribing mammalian RNA polymerase II", method ELECTRON MICROSCOPY, resolution [3.4], 548.25 kDa, 15 polymer instances, source organisms Bos taurus and synthetic construct, EMDB EMD-3218, primary citation DOI 10.1038/NATURE16482 / PMID 26789250. For 1I3Q: title "RNA POLYMERASE II CRYSTAL FORM I AT 3.1 A RESOLUTION", X-RAY DIFFRACTION, resolution [3.1], 470.17 kDa, 10 polymer instances, Saccharomyces cerevisiae, DOI 10.1126/science.1059493 / PMID 11313498. Both assemblies match their deposited chain counts. Downloaded both coordinate files and measured them. Rates from the PMC full text of Jonkers 2014, quoted verbatim in SOURCES.',
  },

  // ------------------------------------------------------------------ replisome: Pol delta
  {
    id: 'dna_polymerase_delta_holoenzyme',
    name: 'DNA polymerase delta holoenzyme (lagging strand)',
    what_it_does: 'Copies one of the two DNA strands during cell division, clamped onto the DNA by a ring that stops it falling off.',
    which_polymerase:
      'Pol delta. The leading and lagging strands are copied by DIFFERENT enzymes and this matters for a viewer that draws a replication fork: Pol epsilon is generally assigned to the leading strand and Pol delta to the lagging strand. A fork drawn with the same enzyme on both sides is drawing a model nobody holds. The separate entry dna_polymerase_epsilon_holoenzyme carries the other one.',
    structure: { primary: '6TNY', also: [] },
    dimensions_nm: {
      from: '6TNY, deposited coordinates (deposited chains 9 = assembly 1 chains 9)',
      principal_extents_nm: [15.8, 14.0, 10.5],
      max_extent_nm: 16.8,
      radius_of_gyration_nm: 5.04,
      atoms_measured: 19726,
      shape_note: 'Distinctly flattened: the shortest principal extent is two thirds of the longest. The particle is the four-subunit polymerase sitting on the trimeric sliding clamp, with a primer-template duplex threaded through - so the envelope includes DNA, not just protein.',
    },
    mass_MDa: {
      deposited_model: { value: 0.351, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 6TNY = 351.43 kDa' },
      biological_object: unretrieved('MDa',
        'No independent mass measurement of a Pol delta holoenzyme was retrieved this session.',
        'A native-MS mass for the assembled holoenzyme, stating whether the clamp and the primer-template were counted.'),
    },
    copies_per_cell: [
      unretrieved('Pol delta molecules per cell',
        'No primary measurement retrieved this session.',
        'An absolute quantification of POLD1 in a named cell line, with the cell cycle phase stated - the number in a cell that is not replicating its DNA is not the number in one that is.'),
    ],
    rate: [
      {
        quantity: 'replication fork progression', value: 1.46, uncertainty: '+/- 0.01 (SEM)', units: 'kb per minute',
        value_nt_per_s: 24.3,
        median: 1.30, sd: 0.81, n_forks: 5460, range: [0.14, 11.8],
        organism: 'Homo sapiens', cell_type: 'normal primary keratinocytes pooled from three donors',
        conditions: 'single-molecule DNA combing of pulse-labelled replication tracks; the velocity is of the FORK, i.e. of a polymerase pair with its helicase, not of an isolated enzyme',
        source: 'conti_2007',
        caveat: 'The distribution is wide and right-skewed: the extremes span almost two orders of magnitude, so the mean is a poor summary and is reported here with the median, the SD and the range rather than alone.',
      },
      {
        quantity: 'replication fork progression', value: 1.67, uncertainty: '+/- 0.03 (SEM)', units: 'kb per minute',
        median: 1.54, sd: 0.72, n_forks: 657,
        organism: 'Homo sapiens', cell_type: 'cancer IC1 keratinocyte line',
        conditions: 'same method, same study',
        source: 'conti_2007',
        caveat: 'Faster than the primary cells in the same experiment, significantly so by the authors\' own t test. A transformed line is not a normal cell for this purpose.',
      },
      {
        quantity: 'nucleotide incorporation by the isolated enzyme', ...unretrieved('nucleotides per second',
          'No in vitro turnover number for human Pol delta was retrieved this session.',
          'A steady-state or single-turnover kinetic measurement on the purified holoenzyme, with the template, salt and temperature stated. It will not equal the in vivo fork rate, and the gap between the two is itself worth showing.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 6TNY and read back title "Processive human polymerase delta holoenzyme", method ELECTRON MICROSCOPY, resolution [3.08], 351.43 kDa, 9 polymer instances, source organisms Homo sapiens and synthetic construct, EMDB EMD-10539, primary citation DOI 10.1038/s41467-020-14898-6 / PMID 32111820. Fetched the polymer entities and read back the chain inventory recorded in STRUCTURES_VERIFIED, including a catalytic subunit of exactly 1107 residues. Cross-checked that against https://rest.uniprot.org/uniprotkb/P28340.json, which returned DPOD1_HUMAN "DNA polymerase delta catalytic subunit", Homo sapiens, sequence length 1107, mass 123,631 Da - the deposition models the full-length catalytic subunit. Assembly 1 matches the deposited chain count. Downloaded 6tny.cif.gz and measured 19,726 atoms. Fork rates from the PMC record of Conti 2007, quoted verbatim in SOURCES.',
  },

  // ------------------------------------------------------------------ replisome: Pol epsilon
  {
    id: 'dna_polymerase_epsilon_holoenzyme',
    name: 'DNA polymerase epsilon holoenzyme (leading strand)',
    what_it_does: 'Copies the other DNA strand during cell division, travelling continuously behind the machine that unzips the double helix.',
    which_polymerase:
      'Pol epsilon, the four-subunit holoenzyme. The only structure retrieved for it is from a microbe, not a mammal; see the organism caveat on dimensions.',
    structure: { primary: '6WJV', also: [] },
    dimensions_nm: {
      from: '6WJV, deposited coordinates (deposited chains 4 = assembly 1 chains 4)',
      principal_extents_nm: [18.4, 10.7, 8.5],
      max_extent_nm: 18.5,
      radius_of_gyration_nm: 5.10,
      atoms_measured: 19593,
      shape_note: 'The most elongated machine in this file: the longest principal extent is more than twice the shortest. Drawing it as a blob loses the one thing its shape says.',
      organism_caveat:
        'THIS GEOMETRY IS FROM A MICROBE (Saccharomyces cerevisiae S288C), not from a mammal. The Pol delta entry beside it is human. A viewer that places these two side by side at a mammalian replication fork is mixing organisms, and that mixing has to be on the label, not in a footnote. The 2222 modelled residues of the catalytic subunit belong to the yeast protein; no claim is made here that the mammalian enzyme has the same dimensions.',
    },
    mass_MDa: {
      deposited_model: { value: 0.379, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 6WJV = 379.21 kDa' },
      biological_object: unretrieved('MDa', 'No independent mass measurement retrieved this session.',
        'A native-MS mass for the assembled four-subunit holoenzyme.'),
    },
    copies_per_cell: [
      unretrieved('Pol epsilon molecules per cell',
        'No primary measurement retrieved this session, for either the fungal or the mammalian enzyme.',
        'An absolute quantification of the catalytic subunit in a named organism, cell type and cell cycle phase.'),
    ],
    rate: [
      {
        quantity: 'replication fork progression',
        note: 'The fork rates on dna_polymerase_delta_holoenzyme are FORK rates and belong to both strands of the same fork. They are not duplicated here, because repeating a number in two places is how a single measurement gets counted twice downstream.',
        see: 'dna_polymerase_delta_holoenzyme.rate',
      },
      {
        quantity: 'leading-strand synthesis by the isolated holoenzyme', ...unretrieved('nucleotides per second',
          'No in vitro turnover number for Pol epsilon was retrieved this session, in any organism.',
          'A kinetic measurement on the purified holoenzyme with the template, salt and temperature stated, ideally alongside the same measurement on Pol delta so the two strands can be compared on one axis.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 6WJV and read back title "Structure of the Saccharomyces cerevisiae polymerase epsilon holoenzyme", method ELECTRON MICROSCOPY, resolution [3.5], 379.21 kDa, 4 polymer instances, source organism Saccharomyces cerevisiae S288C, EMDB EMD-21701. The primary citation came back with DOI 10.1038/s41467-020-16910-5 and journal/year Nat Commun 2020 but a NULL PubMed id, so no PMID is recorded. Read back the four-chain inventory including a 2222-residue catalytic subunit A. Assembly 1 matches the deposited chain count. Downloaded 6wjv.cif.gz and measured 19,593 atoms. For contrast, fetched https://rest.uniprot.org/uniprotkb/Q07864.json, which returned DPOE1_HUMAN, 2286 residues, 261,518 Da - the HUMAN catalytic subunit, confirming that the structure above is not the human protein.',
  },

  // ------------------------------------------------------------------ nucleosome
  {
    id: 'nucleosome_core_particle',
    name: 'Nucleosome core particle',
    what_it_does: 'A spool of eight histone proteins with about 147 base pairs of DNA wound round it, the unit that packs the genome and controls what can be read.',
    structure: { primary: '1KX5', also: ['1AOI'] },
    dimensions_nm: {
      from: '1KX5, deposited coordinates (deposited chains 10 = assembly 1 chains 10)',
      principal_extents_nm: [14.4, 12.2, 7.0],
      max_extent_nm: 17.4,
      radius_of_gyration_nm: 4.00,
      atoms_measured: 16755,
      shape_note: 'A flattened disc: two comparable extents and a third half their size. This is the one machine in the file whose shape a viewer must get right, because the disc axis is what makes a chromatin fibre a fibre.',
      tails_caveat:
        'These numbers INCLUDE the histone tails, which 1KX5 models at 1.94 A. The tails stick out well past the DNA gyres, which is why the maximum atom-pair distance (17.4 nm) is so much larger than the largest principal extent (14.4 nm). The lower-resolution 1AOI, with shorter modelled histone constructs, measures 13.6 x 11.5 x 7.0 nm with a 14.5 nm maximum over 12,385 atoms. The ordered core is smaller than either. Any single "nucleosome diameter" is answering a question about which atoms were modelled, not only about the particle.',
      textbook_figure_not_retrieved:
        'The widely quoted disc diameter of about 10-11 nm was NOT traced to a primary measurement this session, so it is not asserted. What can be asserted is the envelope of the deposited coordinates above, and that it is larger than the quoted figure because it includes the tails. See TEXTBOOK_ONLY.',
    },
    mass_MDa: {
      deposited_model: { value: 0.200, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 1KX5 = 200.28 kDa; for 1AOI it is 184.55 kDa' },
      biological_object: unretrieved('MDa', 'No independent mass measurement retrieved this session.',
        'A native-MS mass for a reconstituted core particle, stating the DNA length used.'),
    },
    dna_wrapped_bp: {
      value: 147, units: 'base pairs',
      source: 'Read off the 1KX5 deposition: two polydeoxyribonucleotide entities of 147 nucleotides each, one per strand.',
      also: { value: 146, structure: '1AOI', note: 'The 1997 structure used a 146 bp palindromic fragment, described by the deposition as "PALINDROMIC 146 BP DNA REPEAT 8/9 FROM HUMAN X-CHROMOSOME ALPHA SATELLITE DNA". 146 and 147 are both real: they are two different constructs, not two estimates of one quantity.' },
    },
    histone_stoichiometry: {
      value: 8, units: 'histone chains per particle',
      read_back: 'From the 1KX5 polymer entities: H3 x2, H4 x2, H2A.1 x2, H2B.2 x2. The octamer is read off the deposition, not assumed.',
      organism_note: 'The histones in both 1KX5 and 1AOI are from an amphibian (Xenopus laevis); the DNA in 1AOI is a human alpha-satellite sequence. The particle a mammalian viewer draws is therefore being drawn from a cross-organism reconstitution, which is standard practice and is still a mixing that belongs on the label.',
    },
    copies_per_cell: [
      {
        ...unretrieved('nucleosomes per cell',
          'This cannot be computed without a nucleosome repeat length, and the repeat length is NOT A CONSTANT. Woodcock, Skoultchi & Fan 2006 report "a robust linear relationship between H1 stoichiometry and NRL" and that repeat length falls in H1-depleted nuclei, varying by cell type and organism. A single nucleosome count per cell would be asserting a repeat length nobody measured for that cell.',
          'A measured nucleosome repeat length for the specific cell type being drawn, from micrococcal nuclease ladder spacing or an equivalent assay. With that, the count follows from the genome size below.'),
        source: 'woodcock_2006',
        what_is_known: {
          diploid_genome_bp: 6176572802,
          genome_source: 'ensembl_grch38',
          genome_note: 'Twice the sum of the 25 primary GRCh38.p14 chromosomes (3,088,286,401 bp), read from Ensembl REST release 116. Using the golden path length of 3,099,750,718 bp instead gives 6,199,501,436 bp. Both are recorded; the difference between them is under 0.4% and is swamped by the repeat-length uncertainty.',
          hard_upper_bound: 42017502,
          hard_upper_bound_note:
            'Diploid genome divided by the 147 bp core wrap. This is the number of nucleosomes there would be if there were NO linker DNA at all, so it is a strict upper bound and not an estimate. The true count is lower by whatever the linker is, which is the quantity that was not retrieved. Stating the bound is not the same as stating the count, and this field must not be read as one.',
        },
        organism: 'Homo sapiens', cell_type: 'any diploid somatic cell',
      },
    ],
    rate: [
      {
        quantity: 'nucleosome turnover or sliding rate',
        ...unretrieved('events per second',
          'No measurement of nucleosome turnover, unwrapping or remodeller-driven sliding rate was retrieved this session.',
          'A single-molecule unwrapping or FRAP-based turnover measurement in a named cell type. Note that a nucleosome is not a catalyst, so "rate" here means how fast it moves or comes apart, not how fast it converts a substrate.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entries for 1KX5 and 1AOI. Read back for 1KX5: title "X-Ray Structure of the Nucleosome Core Particle, NCP147, at 1.9 A Resolution", X-RAY DIFFRACTION, resolution_combined [1.94], 200.28 kDa, 10 polymer instances, source organisms Xenopus laevis and Homo sapiens, primary citation DOI 10.1016/S0022-2836(02)00386-8 / PMID 12079350. For 1AOI: title "COMPLEX BETWEEN NUCLEOSOME CORE PARTICLE (H3,H4,H2A,H2B) AND 146 BP LONG DNA FRAGMENT", resolution [2.8], 184.55 kDa, Xenopus laevis, DOI 10.1038/38444 / PMID 9305837. Fetched the polymer entities of both and read back the chain-by-chain inventories in STRUCTURES_VERIFIED, from which the 147 bp wrap and the histone octamer are taken directly. Both assemblies match their deposited chain counts. Downloaded both coordinate files and measured them. Genome size from https://rest.ensembl.org/info/assembly/homo_sapiens, reading back assembly_name GRCh38.p14, accession GCA_000001405.29 and golden_path 3,099,750,718, with the per-chromosome lengths summed locally. Repeat-length caveat from the PubMed abstract of Woodcock 2006, quoted verbatim in SOURCES. Also fetched https://rest.uniprot.org/uniprotkb/P62805.json, which returned H4_HUMAN "Histone H4", 103 residues, 11,367 Da, against the 102 residues modelled for H4 in 1KX5.',
  },

  // ------------------------------------------------------------------ nuclear pore complex
  {
    id: 'nuclear_pore_complex',
    name: 'Nuclear pore complex',
    what_it_does: 'A gateway through the double membrane around the nucleus that lets the right molecules in and out and keeps everything else where it belongs.',
    structure: { primary: '7R5J', also: ['7TBL'] },
    dimensions_nm: {
      from: '7R5J, EXPANDED BIOLOGICAL ASSEMBLY 1 (C8, 808 polymer chains, 4,937,064 atoms). The deposited file holds 101 chains, one eighth of the ring, and must not be measured directly.',
      outer_diameter_nm: 159.7,
      outer_diameter_method: 'Twice the largest in-plane distance of any atom from the ring axis (largest radius 79.8 nm). The axis was taken as the shortest bounding-box direction, which for a C8 ring is the symmetry axis.',
      axial_height_nm: 76.5,
      bounding_box_nm: [159.4, 159.4, 76.5],
      bounding_box_note: 'Axis-aligned, which for this deposition is already the ring frame: the two in-plane extents agree to 0.1 nm, as an eightfold-symmetric ring measured in its own frame should. The agreement is a check on the arithmetic, not a finding.',
      max_extent_nm: 159.7,
      max_extent_note: 'Greatest distance between any two modelled atoms, by the same two-pass farthest-point search used for every other entry, over all 4,937,064 atoms. It coincides with twice the largest in-plane radius to within the reported precision, which says the two extreme atoms lie in nearly the same plane - the pore is widest across its equator, not corner to corner.',
      radius_of_gyration_nm: 56.06,
      atoms_measured: 4937064,
      scaffold_channel_diameter_nm: 53.1,
      scaffold_channel_method: 'Twice the SMALLEST in-plane radius of any atom (26.5 nm). This is the aperture of the modelled scaffold, not the functional aperture; the disordered nucleoporins that fill the channel are not in the model.',
      median_atom_radius_nm: 50.0,
      principal_extents_of_one_spoke_nm: [82.9, 77.2, 52.5],
      spoke_note: 'The single asymmetric unit measures 82.9 x 77.2 x 52.5 nm with a 92.4 nm maximum atom-pair distance over 617,133 atoms. Those numbers describe one eighth of the pore and are recorded only so the mistake of using them is visible.',
      conformational_state: 'DILATED. 7R5J is the dilated state; the constricted state is a separate deposition (7TBL / EMD-14322, read back as "Human nuclear pore complex (constricted)" at 12 A). The pore breathes, so "the diameter of the nuclear pore" is not one number.',
      disagreement_note: 'The 159.7 nm measured here is larger than the figure commonly quoted for this complex. See DISAGREEMENTS; the quoted figure was not traced to a primary measurement this session and is therefore not written down as a rival number.',
    },
    mass_MDa: {
      deposited_model: { value: 12.078, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 7R5J = 12078.34 kDa - the ONE asymmetric unit that the file contains, not the ring.' },
      biological_object: { value: 120, units: 'MDa', approximate: true, source: 'mosalaganti_2022', read_back: 'From the retrieved abstract: "With a molecular weight of ~120 MDa, the human NPC is one of the largest protein complexes."' },
      atomic_model_coverage: { value: 70, units: 'MDa', source: 'mosalaganti_2022', read_back: '"Our 70-MDa atomically resolved model covers >90% of the human NPC scaffold." So roughly 50 MDa of the complex is not in any atomic model - it is the disordered part.' },
      why_three_numbers: 'The deposited file, the atomic scaffold model and the biological complex are three different objects. Reporting one of them as "the mass of the nuclear pore complex" would be wrong whichever one was chosen.',
    },
    composition: {
      distinct_nucleoporins: { value: 30, approximate: true, source: 'mosalaganti_2022', read_back: '"a set of about 30 distinct nucleoporins (NUPs)"' },
      total_protein_chains: { value: 1000, approximate: true, source: 'mosalaganti_2022', read_back: '"Its ~1000 proteins are taken in multiple copies"' },
      scaffold_copies_per_pore: { value: 32, units: 'Nup107 copies per NPC', source: 'ori_2013', read_back: 'Calibration gave "an average of 37+/-14 Nup107 copies per NPC"; simulations favoured 32, which the authors adopt for the major scaffold module. Both are recorded; the 37 +/- 14 is the measurement and the 32 is the interpretation.' },
    },
    copies_per_cell: [
      {
        organism: 'Homo sapiens', cell_type: 'HeLa (the Nup107 copy-number measurements were made on HeLa nuclei)',
        growth_state: 'cultured, not otherwise specified',
        value: 3376, uncertainty: '+/- 1304', units: 'nuclear pore complexes per nucleus',
        method: 'targeted proteomics for absolute Nup107 molecules per nucleus, combined with super-resolution counting of pores',
        source: 'ori_2013',
        caveat: 'The uncertainty is nearly 40% of the value, so this is a number good to within a factor of about 1.5 and no better. The paper itself does not name a cell line for the per-nucleus estimate; HeLa is inferred from the context of the Nup107 measurements, and that inference is recorded rather than hidden. The same paper\'s point is that pore STOICHIOMETRY varies between cell types, so a single pore count across cell types should not be expected either.',
      },
    ],
    rate: [
      {
        quantity: 'nucleocytoplasmic transport throughput',
        ...unretrieved('molecules translocated per second per pore',
          'No primary measurement of per-pore transport throughput was retrieved this session; the searches attempted returned nothing usable.',
          'A single-molecule or bulk-flux measurement with the cargo identity and size stated. Throughput depends strongly on the cargo, so one number would need a named substrate to mean anything.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 7R5J and read back title "Human nuclear pore complex (dilated)", method ELECTRON MICROSCOPY, resolution_combined [50], molecular_weight 12078.34 kDa, 101 deposited polymer chains, source organism Homo sapiens, EMDB EMD-14321, primary citation DOI 10.1126/science.abm9506 / PMID 35679397. Fetched https://data.rcsb.org/rest/v1/core/assembly/7R5J/1 and read back 808 polymer instances, oligomeric_details "808-meric", and Global Symmetry C8 Cyclic "Hetero 808-mer" - which is how the asymmetric-unit error was caught. Downloaded 7r5j-assembly1.cif.gz (109 MB) and measured 4,937,064 atoms by streaming the file. Fetched https://www.ebi.ac.uk/emdb/api/entry/EMD-14321 and read back title "Human nuclear pore complex (dilated)", subtomogramAveraging, 50.0 A BY AUTHOR; and EMD-14322, read back as "Human nuclear pore complex (constricted)", subtomogramAveraging, 12.0 A BY AUTHOR. Mass, composition and coverage figures from the retrieved PubMed abstract of Mosalaganti 2022, quoted verbatim in SOURCES. Pore counts from the PMC record of Ori 2013, also quoted verbatim.',
  },

  // ------------------------------------------------------------------ spliceosome
  {
    id: 'spliceosome',
    name: 'Spliceosome',
    what_it_does: 'Cuts the unused stretches out of a freshly made RNA and stitches the remaining pieces together before it is read as a protein.',
    structure: { primary: '5XJC', also: [] },
    dimensions_nm: {
      from: '5XJC, deposited coordinates (deposited chains 50 = assembly 1 chains 50)',
      principal_extents_nm: [34.5, 29.0, 22.9],
      max_extent_nm: 37.0,
      radius_of_gyration_nm: 10.45,
      atoms_measured: 116421,
      shape_note: 'The largest machine in this file apart from the nuclear pore - longer than the 80S ribosome on its longest axis (34.5 nm against 30.2 nm) and markedly less isotropic. A viewer that draws the spliceosome as small relative to the ribosome has it backwards.',
      state_caveat:
        'This is ONE CATALYTIC STATE, read back from the title as "just prior to exon ligation". The spliceosome assembles, rearranges and disassembles on every intron; its subunit composition and therefore its size change as it goes. A second state, the post-catalytic P complex (6QDV, 3.3 A, 2322.14 kDa, 44 polymer entities, title read back as "Human post-catalytic P complex spliceosome"), was also confirmed to resolve at RCSB this session but was not measured, so no envelope for it is asserted. One static shape for the spliceosome is the single biggest simplification in this file.',
    },
    mass_MDa: {
      deposited_model: { value: 2.962, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 5XJC = 2962.08 kDa' },
      biological_object: unretrieved('MDa', 'No independent mass measurement retrieved this session.',
        'A native-MS mass for a defined spliceosomal complex, with the state named - the mass is state-dependent, so a single figure would need a state attached.'),
    },
    copies_per_cell: [
      unretrieved('spliceosomes per nucleus',
        'No primary measurement retrieved this session. The question is also ill-posed as asked: the spliceosome is not a standing pool of complete machines but an assembly that forms on each substrate from snRNP parts, so "how many spliceosomes" depends on whether assembled complexes or available snRNPs are being counted.',
        'An absolute quantification of the individual snRNPs in a named cell type, plus a statement of which species is being counted. A count of assembled catalytic complexes would additionally need a measurement of how long each one persists.'),
    ],
    rate: [
      {
        quantity: 'splicing of one intron',
        ...unretrieved('seconds per intron, or introns per second',
          'No primary measurement of splicing kinetics was retrieved this session.',
          'A nascent-RNA or single-molecule measurement of the time from intron synthesis to exon ligation, in a named cell type, with the intron identified - rates differ between introns.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 5XJC and read back title "Cryo-EM structure of the human spliceosome just prior to exon ligation at 3.6 angstrom", method ELECTRON MICROSCOPY, resolution_combined [3.6], molecular_weight 2962.08 kDa, 50 polymer instances, source organisms including Homo sapiens, EMDB EMD-6721, primary citation DOI 10.1016/j.cell.2017.04.033 / PMID 28502770. Assembly 1 read back as 50 polymer instances, so no expansion. Downloaded 5xjc.cif.gz and measured 116,421 atoms. Separately fetched the entry for 6QDV and read back title "Human post-catalytic P complex spliceosome", ELECTRON MICROSCOPY, [3.3], 2322.14 kDa, 44 polymer entities, EMD-4525 - confirmed to exist but not measured.',
  },

  // ------------------------------------------------------------------ chaperonin, bacterial
  {
    id: 'chaperonin_groel_groes',
    name: 'Chaperonin GroEL with its lid GroES',
    what_it_does: 'A barrel that takes in a half-folded protein, closes a lid over it, and gives it a quiet chamber in which to fold properly.',
    size_landmark_role:
      'Carried as a SIZE LANDMARK. It is one of the best-determined large complexes in structural biology, its subunit count is exact rather than estimated, and it sits conveniently between a polymerase and a ribosome - so it is the natural ruler against which the less certain envelopes in this file can be judged.',
    structure: { primary: '1AON', also: [] },
    dimensions_nm: {
      from: '1AON, deposited coordinates (deposited chains 21 = assembly 1 chains 21)',
      principal_extents_nm: [19.8, 14.3, 14.3],
      max_extent_nm: 20.7,
      radius_of_gyration_nm: 6.85,
      atoms_measured: 58870,
      shape_note: 'A cylinder, and measurably so: one long axis of 19.8 nm and two equal cross-axes of 14.3 nm each, exactly as a sevenfold-symmetric double ring with a lid on one end should measure. The agreement between the two short axes to within 0.1 nm is a useful check that the envelope method is not inventing anisotropy.',
    },
    mass_MDa: {
      deposited_model: { value: 0.878, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 1AON = 877.61 kDa' },
      biological_object: unretrieved('MDa', 'No independent mass measurement retrieved this session.',
        'A native-MS mass for the GroEL14-GroES7 complex, which for this system would be an unusually clean measurement to find.'),
    },
    subunit_stoichiometry: {
      groEL_chains: 14, groES_chains: 7,
      read_back: 'From the 1AON polymer entities: "GROEL" 547 residues x14 and "GROEL/GROES COMPLEX" 97 residues x7. The 14 + 7 asymmetry is read straight off the deposition and is the reason the complex is called asymmetric in its own title.',
      subunit_cross_check: 'https://rest.uniprot.org/uniprotkb/P0A6F5.json returned CH60_ECOLI "Chaperonin GroEL", Escherichia coli (strain K12), 548 residues, 57,329 Da - one more residue than the 547 modelled, consistent with an unmodelled terminal residue.',
    },
    copies_per_cell: [
      unretrieved('GroEL molecules per cell',
        'No per-cell GroEL count was retrieved this session. A condition-resolved absolute proteome for this organism exists (Schmidt A et al. 2016, The quantitative and condition-dependent Escherichia coli proteome, Nat Biotechnol 34:104-110, doi 10.1038/nbt.3418, PMID 26641532, abstract retrieved) but the per-protein values live in supplementary tables that were not fetched and parsed, so no number is written here.',
        'The GroEL row of that paper\'s supplementary abundance table, read for a named growth condition. GroEL is heat-shock inducible, so the condition is not optional.'),
    ],
    rate: [
      {
        quantity: 'folding cycle time',
        ...unretrieved('seconds per cycle',
          'No primary measurement of the GroEL reaction cycle period was retrieved this session.',
          'A stopped-flow or single-molecule measurement of the ATP-driven cycle with the substrate, temperature and nucleotide concentration stated.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 1AON and read back title "CRYSTAL STRUCTURE OF THE ASYMMETRIC CHAPERONIN COMPLEX GROEL/GROES/(ADP)7", method X-RAY DIFFRACTION, resolution_combined [3], molecular_weight 877.61 kDa, 21 polymer instances, source organism Escherichia coli, primary citation DOI 10.1038/41944 / PMID 9285585. Fetched the polymer entities and read back 14 copies of a 547-residue chain and 7 of a 97-residue chain. Assembly 1 read back as 21 polymer instances, so no expansion. Downloaded 1aon.cif.gz and measured 58,870 atoms. Cross-checked the subunit against UniProt P0A6F5 as recorded above.',
  },

  // ------------------------------------------------------------------ chaperonin, eukaryotic
  {
    id: 'chaperonin_tric_cct',
    name: 'Chaperonin TRiC/CCT',
    what_it_does: 'The eukaryotic version of the folding barrel, built from eight different subunits instead of one repeated subunit.',
    size_landmark_role:
      'The eukaryotic counterpart to GroEL, carried so the pair can be compared. Note the resolution: 7.8 A against 3.0 A for GroEL. At 7.8 A the envelope is reliable and the side chains are not, which is a useful thing for a viewer to be able to say about one object and not another.',
    structure: { primary: '6NR8', also: [] },
    dimensions_nm: {
      from: '6NR8, deposited coordinates (deposited chains 22 = assembly 1 chains 22)',
      principal_extents_nm: [21.6, 16.9, 16.4],
      max_extent_nm: 22.5,
      radius_of_gyration_nm: 7.32,
      atoms_measured: 68284,
      shape_note: 'Larger than the bacterial barrel in every direction - 21.6 against 19.8 nm on the long axis - and again cylindrical, with two near-equal cross-axes. The deposition is a complex with a co-chaperone (the title reads "hTRiC-hPFD Class6"), so part of the extra extent is the partner, not the barrel.',
      caveat: 'At 7.8 A nominal resolution the atom positions carry much less information than the 1.94 A nucleosome or the 3.0 A bacterial barrel. The envelope is still a measurement; it is a measurement of a lower-resolution model.',
    },
    mass_MDa: {
      deposited_model: { value: 0.981, units: 'MDa', source: 'rcsb_entry_info.molecular_weight for 6NR8 = 981.46 kDa, including the co-chaperone chains' },
      biological_object: unretrieved('MDa', 'No independent mass measurement retrieved this session.',
        'A native-MS mass for the hexadecameric barrel alone, so it can be separated from the co-chaperone complex above.'),
    },
    copies_per_cell: [
      unretrieved('TRiC/CCT complexes per cell',
        'No primary measurement retrieved this session.',
        'An absolute quantification of the CCT subunits in a named cell line, with the caveat that eight distinct subunits give eight counts that need not agree.'),
    ],
    rate: [
      {
        quantity: 'folding cycle time',
        ...unretrieved('seconds per cycle', 'No primary measurement retrieved this session.',
          'A kinetic measurement with substrate and nucleotide conditions stated.'),
      },
    ],
    verified_how:
      'Fetched the RCSB entry for 6NR8 and read back title "hTRiC-hPFD Class6", method ELECTRON MICROSCOPY, resolution_combined [7.8], molecular_weight 981.46 kDa, 22 polymer instances, source organism Homo sapiens, EMDB EMD-0490, primary citation DOI 10.1016/j.cell.2019.03.012 / PMID 30955883. Assembly 1 read back as 22 polymer instances, so no expansion. Downloaded 6nr8.cif.gz and measured 68,284 atoms.',
  },
]);

// ---------------------------------------------------------------------------- the ladder

/**
 * The machines sorted by size, with the ratio between neighbours.
 *
 * The sort key is ONE measured length with ONE definition: `max_extent_nm`, the greatest distance between
 * any two modelled atoms (see ENVELOPE_METHOD). Using a single key matters, because sorting by "size" when
 * some entries contribute a diameter and others a height produces a ladder that is partly an artefact of
 * which field each entry happened to fill.
 *
 * The ratio is the next machine's length divided by this one's: arithmetic on two measurements, with both
 * operands returned alongside it. It is not a score, and nothing here is fused.
 *
 * Entries whose envelope could not be measured are returned in `unmeasured` rather than sorted into the
 * ladder at a guessed position.
 */
export function sizeLadder() {
  const measured = [], unmeasured = [];
  for (const m of MACHINES) {
    const d = m.dimensions_nm ?? {};
    const L = typeof d.max_extent_nm === 'number' ? d.max_extent_nm : null;
    if (L === null) { unmeasured.push({ id: m.id, name: m.name, why: 'no max_extent_nm measured for this entry' }); continue; }
    measured.push({
      id: m.id, name: m.name,
      max_extent_nm: L,
      principal_extents_nm: d.principal_extents_nm ?? null,
      radius_of_gyration_nm: d.radius_of_gyration_nm ?? null,
      measured_from: d.from ?? null,
      structure: m.structure?.primary ?? null,
    });
  }
  measured.sort((a, b) => a.max_extent_nm - b.max_extent_nm);
  const rungs = measured.map((row, i) => {
    const next = measured[i + 1];
    return {
      ...row,
      ratio_to_next: next ? { next_id: next.id, this_nm: row.max_extent_nm, next_nm: next.max_extent_nm, ratio: +(next.max_extent_nm / row.max_extent_nm).toFixed(3) } : null,
    };
  });
  const smallest = measured[0], largest = measured[measured.length - 1];
  return {
    sort_key: 'max_extent_nm - greatest distance between any two modelled atoms, defined in ENVELOPE_METHOD',
    rungs,
    unmeasured,
    span: smallest && largest ? {
      smallest_id: smallest.id, smallest_nm: smallest.max_extent_nm,
      largest_id: largest.id, largest_nm: largest.max_extent_nm,
      ratio: +(largest.max_extent_nm / smallest.max_extent_nm).toFixed(3),
      note: 'The whole molecular scale this viewer draws spans this one factor - just under a single order of magnitude. And it is not spread evenly: every machine except the nuclear pore falls inside a factor of 2.2 of every other, and then there is one gap of more than fourfold to the pore. So the honest picture is a tight cluster and one outlier, not a ladder with even rungs. A viewer that spaces these objects evenly for legibility is inventing the spacing.',
    } : null,
    not_a_score: 'Every number returned here is a length in nanometres or a ratio of two such lengths. There is no fused quality, confidence or fidelity value anywhere in this return.',
  };
}

// ---------------------------------------------------------------------------- what the drawing cannot show

export const WHAT_A_DEPICTION_CANNOT_SHOW = deepFreeze({
  headline:
    'Everything below is true of every molecular illustration ever published, including this one. It is listed because a viewer that zooms smoothly from an embryo to a ribosome invites a reader to believe they are looking through a microscope, and they are not.',

  it_is_not_a_static_object:
    'A drawn machine has one shape. A real one does not. The ribosome ratchets between conformations on every elongation cycle; the polymerase opens and closes its clamp; the spliceosome rebuilds its own catalytic core partway through the reaction it is catalysing, which is why the entry above has to name a state. The single most honest thing a drawing of a molecular machine can do is say WHICH STATE it is drawing, and the second most honest is to admit that the machine spends only part of its time there. Where this file could name the state, it did (the spliceosome "just prior to exon ligation"; the nuclear pore "dilated"). Where it could not, the omission is the limitation.',

  the_surface_is_a_threshold_not_a_boundary:
    'A cryo-EM structure is a three-dimensional map of electron scattering density. It has no surface. The surface you see in any rendering is an ISOSURFACE: the locus of points where that density equals a number somebody chose. Raise the threshold and the molecule shrinks; lower it and it grows and sprouts features. For a crystal structure the situation is different but not better: the atoms have positions, and the "surface" is then a set of spheres of chosen radii rolled over with a probe of chosen size. In neither case is there a line in nature where the molecule stops. The envelopes in this file are extents of MODELLED ATOM CENTRES, which at least has an unambiguous definition, and are therefore slightly smaller than any rendered surface of the same structure.',

  what_is_modelled_is_not_what_is_there:
    'A structure contains only the parts that held still enough to be resolved. The nuclear pore above is the clearest case: the atomic model covers roughly 70 of about 120 MDa, and the missing 50 MDa is not missing from the cell - it is the disordered nucleoporin mesh that fills the channel and does the actual gatekeeping. A drawing faithful to the coordinates shows an open hole where the functional part of the machine is. The opposite error appears in the nucleosome, where the 1.94 A structure DOES model the histone tails, so its envelope is larger than the particle a lower-resolution structure would give. In both directions, the drawing inherits the experiment\'s blind spots and calls them geometry.',

  it_diffuses:
    'At this scale thermal motion dominates. A ribosome in the cytoplasm is not parked; it is being battered from every side and wandering. One of the few numbers retrieved here that bears on this is a measured diffusion coefficient of about 0.04 square micrometres per second for ribosomes in a live microbial cell (Bakshi et al. 2012, attributed by the authors to free messenger RNA being translated by one or more ribosomes). A viewer that holds its machines still for the reader to look at is removing the single most prominent feature of their actual behaviour. A viewer that animates them as gliding smoothly along a track is worse, because smooth gliding is what thermal motion is not.',

  it_is_crowded:
    'Illustrations place machines in empty space because machines in a crowd are unreadable. The cell is the crowd. The same superresolution study puts about 55,000 ribosomes in one microbial cell and finds them packed densely enough in the ribosome-rich regions that the authors discuss the biopolymer volume fraction; it also finds the ribosomes and the DNA strongly segregated, so even the emptiness is structured rather than uniform. Every number in this file was measured on a purified, isolated complex. None of them was measured in the crowd the drawing leaves out.',

  the_positions_are_invented:
    'Nothing in this module says where anything is. The viewer must put each object somewhere, and every such placement is generated. That is not a defect to be fixed by better data; there is no measurement of the instantaneous arrangement of machines in a particular cell to fix it with. The requirement is that the placement be LABELLED as generated while the size beside it is labelled as measured, which is what the sibling module provenance.mjs exists to enforce.',

  rates_are_averages_over_populations:
    'Every rate in this file is a population average, and in each case the paper it came from reports a distribution wide enough that the average misleads. Translation elongation averages 5.6 amino acids per second in one mammalian cell type, with more than a thousand sites where the ribosome pauses for seconds. Replication forks average 1.46 kb/min with individual forks from 0.14 to 11.8 kb/min, a spread of nearly two orders of magnitude. Transcription accelerates eightfold within a single gene. An animation playing at the mean speed is showing a motion that no individual machine performs.',

  one_organism_is_not_another:
    'The entries above are drawn from a mammal, two microbes and an amphibian, and the reason is availability, not biology. The leading-strand polymerase in this file is a fungal structure sitting next to a human lagging-strand polymerase at a notional mammalian fork. The nucleosome is amphibian histones on human satellite DNA. These are the standard reagents of structural biology and the structures are good; the mixing is still a mixing, and a viewer that presents the assembled scene as one organism\'s chromosome is asserting something no experiment did.',
});

// ---------------------------------------------------------------------------- disagreements, kept as disagreements

export const DISAGREEMENTS = deepFreeze([
  {
    quantity: 'ribosomes per cell in one microbial species',
    values: [
      { value: 55000, conditions: 'K-12 derivative AFS55, EZ rich defined medium, 30 C, 54 min doubling; single-molecule YFP counting, 42 cells', source: 'bakshi_2012' },
      { value: 18000, conditions: 'strain B/r, 37 C, interpolated between 40 and 60 min doubling times; earlier bulk method', source: 'bakshi_2012, reporting the earlier value it disagrees with' },
    ],
    spread: 'about threefold',
    why_not_averaged:
      'The two numbers differ in strain, temperature, medium, growth rate and method. An average of them is a number about no experiment. The authors of the newer measurement state the comparison explicitly - "about three times larger than the earlier value of 18,000" - rather than reconciling it, and that is the right treatment here too.',
    what_would_resolve_it: 'The two methods applied to the same strain in the same medium at the same temperature. Until then the honest statement is that ribosomes per cell in this organism is known to within a factor of about three.',
    second_hand_warning: 'The 18,000 figure was NOT retrieved from its own publication this session. It is recorded as the newer paper reports it, and is flagged as second-hand wherever it appears.',
  },
  {
    quantity: 'RNA polymerase molecules per cell in the same species',
    values: [
      { value: 4600, conditions: 'strain RLG7470, beta-prime-yGFP, EZRDM, 30 C, 43 min doubling, 31 cells', source: 'bakshi_2012' },
      { value: 4000, conditions: 'earlier work on strain B/r, interpolated between 40 and 60 min doubling times', source: 'bakshi_2012, reporting the earlier value' },
    ],
    spread: 'about 15%',
    why_recorded:
      'Recorded alongside the ribosome disagreement precisely BECAUSE it is small. Two independent methods agreeing to 15% on the polymerase while disagreeing threefold on the ribosome in the same pair of studies says the discrepancy is specific to the ribosome measurement, not a general calibration offset. A reader who saw only the ribosome disagreement would draw the wrong conclusion about both.',
    what_would_resolve_it: 'Nothing needs resolving; the agreement is the finding.',
  },
  {
    quantity: 'resolution of one RNA polymerase II structure',
    values: [
      { value: 3.1, units: 'A', conditions: 'PDB entry 1I3Q title and rcsb_entry_info.resolution_combined, read back this session: "RNA POLYMERASE II CRYSTAL FORM I AT 3.1 A RESOLUTION"' },
      { value: 2.8, units: 'A', conditions: 'the title of the primary publication linked to that entry: "Structural basis of transcription: RNA polymerase II at 2.8 angstrom resolution"' },
    ],
    spread: '0.3 A',
    why_not_averaged:
      'These are not two estimates of one number. The paper reports more than one crystal form; the entry is form I. Taking either as "the" resolution of Cramer 2001 would be wrong, and averaging them would be meaningless. The lesson generalises: a paper title is not a property of a deposition, and the habit of citing a structure by its paper\'s headline resolution puts a wrong number in a caption.',
    what_would_resolve_it: 'Nothing. Both are correct about different objects. The entry value is the one used for 1I3Q in this file.',
  },
  {
    quantity: 'outer diameter of the nuclear pore complex',
    values: [
      { value: 159.7, units: 'nm', conditions: 'measured this session from the expanded C8 biological assembly of 7R5J (dilated state), as twice the largest in-plane atom radius over 4,937,064 atoms' },
      { value: null, units: 'nm', conditions: 'the figure around 120 nm that is commonly quoted for this complex was NOT traced to a primary measurement this session, so no rival number is written here' },
    ],
    spread: 'unknown, because only one side of it could be sourced',
    why_recorded:
      'Because the discrepancy is real and a reader who knows the quoted figure will notice it. Three things could each explain some of it and none was checked: this is the DILATED state and the quoted figure may be the constricted one; the measurement here includes every modelled atom, including peripheral arms that a scaffold-ring diameter would exclude; and "outer diameter" may be defined differently in the two cases. The null is deliberate - inventing the 120 nm as a cited rival value would be exactly the fabrication this file exists to avoid.',
    what_would_resolve_it:
      'The measured outer diameter as the primary publications state it, for BOTH conformational states, with the definition they use. Then the same quantity can be computed from the coordinates under that definition and the two compared.',
  },
  {
    quantity: 'mass of the nuclear pore complex',
    values: [
      { value: 12.078, units: 'MDa', conditions: 'rcsb_entry_info.molecular_weight for 7R5J - the deposited asymmetric unit, one eighth of the ring' },
      { value: 70, units: 'MDa', conditions: 'the atomically resolved scaffold model, per the retrieved abstract of mosalaganti_2022' },
      { value: 120, units: 'MDa', conditions: 'the biological complex, approximate, per the same abstract' },
    ],
    spread: 'tenfold between the smallest and largest',
    why_not_averaged:
      'These are three different objects, not three estimates. Eight times 12.078 is 96.6 MDa, which is neither of the other two, so even the symmetry expansion does not reconcile them - because the deposited file models only part of what it models eight copies of. A viewer or caption that quotes any one of these as "the mass of the nuclear pore complex" is wrong in a way that is invisible unless all three are on the page.',
    what_would_resolve_it: 'Nothing needs resolving. All three are correct about their own object and the fix is to name the object every time.',
  },
  {
    quantity: 'nucleosome core particle diameter',
    values: [
      { value: 14.4, units: 'nm', conditions: 'largest principal extent of 1KX5 at 1.94 A, histone tails modelled and included' },
      { value: 13.6, units: 'nm', conditions: 'largest principal extent of 1AOI at 2.8 A, with shorter modelled histone constructs' },
      { value: 17.4, units: 'nm', conditions: 'largest atom-pair distance in 1KX5, which a tail reaches' },
    ],
    spread: 'about 28% across these three definitions of one particle',
    why_not_averaged:
      'The three numbers differ because of what was modelled and how the extent was defined, not because of measurement error. Averaging them would produce a number that answers no question. The practical consequence for a viewer is that the nucleosome is the machine in this file whose apparent size depends most on an invisible choice, so it is the one whose number most needs its definition attached.',
    what_would_resolve_it: 'Nothing resolves it; it is not a disagreement about the world. It is a demonstration that "diameter" is underspecified for a molecule with disordered tails.',
  },
]);

// ---------------------------------------------------------------------------- figures this file would not write down

export const TEXTBOOK_ONLY = deepFreeze([
  {
    figure: 'the nucleosome core particle is a disc about 10-11 nm across and about 5.5-6 nm thick',
    status: 'NOT RETRIEVED this session from any primary measurement.',
    what_is_asserted_instead: 'The envelope of the deposited coordinates, reported with the definition used and the structure it came from. It is larger than the quoted disc, and the reason - modelled histone tails - is stated.',
    why_it_matters: 'This is the single most reproduced number in chromatin biology. It is almost certainly defensible for the ordered core at some threshold; the point is that this file could not say which core, which threshold or which paper, and a number whose definition cannot be stated cannot be put in a scale viewer.',
  },
  {
    figure: 'a mammalian cell contains about ten million ribosomes',
    status: 'NOT RETRIEVED. Several searches for an absolute ribosome count in a named mammalian cell type returned nothing usable.',
    what_is_asserted_instead: 'A null with a reason, on the 80S entry. The microbial count beside it was retrieved and is attached to a strain, a medium, a temperature and a doubling time, which is what a usable count looks like.',
    why_it_matters: 'The number is repeated constantly and the quantity it names is not well defined without a cell type and a growth state, since ribosome content tracks growth rate in every organism where it has been measured.',
  },
  {
    figure: 'the nucleosome repeat length is about 200 base pairs',
    status: 'NOT RETRIEVED as a measurement, and positively contradicted as a constant.',
    what_is_asserted_instead: 'The 147 bp core wrap, read off a deposition, plus a null for the repeat length citing Woodcock 2006 for the finding that repeat length varies linearly with linker histone stoichiometry and differs between cell types and organisms.',
    why_it_matters: 'The nucleosome count per cell is often quoted as thirty million or so, and that figure is this unretrieved 200 bp divided into a genome. Replacing it with a strict upper bound computed from the retrieved 147 bp and the retrieved genome length costs a reader nothing and asserts nothing false.',
  },
  {
    figure: 'the bacterial replication fork moves at about 1000 nucleotides per second',
    status: 'NOT RETRIEVED. No primary in vivo measurement of bacterial fork velocity was obtained this session.',
    what_is_asserted_instead: 'Nothing. The only fork rates in this file are the mammalian single-molecule measurements, and they are labelled as such.',
    why_it_matters: 'The microbe-versus-mammal contrast in fork speed is roughly fortyfold and would be one of the more striking things a scale viewer could show. It is left unshown rather than shown from memory.',
  },
]);

// ---------------------------------------------------------------------------- what we got wrong

export const THE_ASYMMETRIC_UNIT_TRAP = deepFreeze({
  what_happened:
    'The first envelope measured for the nuclear pore complex in this session came out at 82.9 x 77.2 x 52.5 nm, with a 92.4 nm greatest atom-pair distance, from 617,133 atoms in the coordinate file for entry 7R5J. That looked plausible. It is wrong by a factor of close to two in diameter and by a factor of eight in content.',
  why_it_was_wrong:
    'The nuclear pore complex has eightfold rotational symmetry, and depositors are not required to deposit the whole ring. The coordinate file for 7R5J contains ONE asymmetric unit: 101 polymer chains. The biological assembly, which the same service will describe if asked, is a C8 cyclic hetero-808-mer. The file is one spoke. Measuring it and calling the result a pore diameter is measuring a slice of a doughnut and reporting it as the doughnut.',
  why_it_was_plausible:
    'That is the dangerous part. A single spoke spans the full radial width of the pore, so its extents are of the right order and it is not obviously a fragment. Nothing about 83 nm looks like a mistake. Had the measurement come out at 10 nm it would have been caught immediately.',
  how_it_was_caught:
    'Not by looking at the number. The entry record reports deposited_polymer_entity_instance_count = 101 while the assembly record reports polymer_entity_instance_count = 808 and oligomeric_details "808-meric". The two were being fetched anyway, for different reasons, and the mismatch was visible side by side. Every other structure in this file was then checked the same way: eleven matched, and ONE MORE did not - the constricted pore deposition 7TBL, 141 deposited chains against 1128 in its assembly. That second case was found only because the check was made systematic rather than made once, and it would have been the next thing to get wrong.',
  the_corrected_measurement:
    'Downloaded the expanded assembly file (7r5j-assembly1.cif.gz, 109 MB compressed), streamed it rather than reading it into one string, and measured 4,937,064 atoms: outer diameter 159.7 nm, axial height 76.5 nm, narrowest scaffold radius 26.5 nm giving a 53.1 nm scaffold aperture. The spoke numbers are retained in the entry, labelled as one eighth, so that the error cannot be made silently again.',
  the_general_lesson:
    'A DEPOSITED COORDINATE FILE IS NOT THE BIOLOGICAL OBJECT. For any symmetric assembly - and most large machines are symmetric - the deposited chain count must be compared against the biological assembly chain count BEFORE any geometry is computed. This is not a rare edge case: it is the normal practice for ring-shaped complexes, and the bigger and more impressive the machine, the more likely it is to apply.',
  what_changed_in_the_code:
    'ENVELOPE_METHOD.assembly_rule now states the comparison as a precondition of measuring anything, STRUCTURES_VERIFIED carries both chain counts for every entry so the check is auditable from the data rather than from this note, and the test asserts that no envelope in MACHINES was measured from a deposited file whose chain count disagrees with its assembly.',
});

export const KNOWN_LIMITATIONS = deepFreeze([
  'Nine of the fields in MACHINES are nulls with reasons: no mammalian ribosome count, no Pol II copy number, no polymerase turnover numbers for either replicative polymerase, no spliceosome count or splicing rate, no per-pore transport throughput, no chaperonin cycle times, no GroEL abundance, and no nucleosome repeat length. Coverage was traded for sourcing, deliberately. Every one of them names what would resolve it.',
  'Envelopes are extents of modelled atom centres, not molecular surfaces. They are systematically SMALLER than any rendered isosurface of the same structure, and the difference is roughly the van der Waals radius plus whatever probe a renderer uses - about 0.3 nm on each side, which matters for the small machines and not for the pore.',
  'Hydrogen atoms are included where the deposition has them. Only the 1.94 A nucleosome does, so its atom count is not comparable with the others and its envelope is very slightly larger for that reason alone.',
  'The leading-strand polymerase is a fungal structure and the lagging-strand polymerase is human. Any fork the viewer assembles from these two is a composite across organisms. The caveat is on the entry; it cannot be fixed from within this file.',
  'The spliceosome is represented by one catalytic state. Its composition and size change through the splicing cycle, so a single envelope for it is a larger simplification than for any other entry here. A second state was confirmed to exist at RCSB but was not measured.',
  'The nuclear pore is represented by the dilated state only. The constricted counterpart deposition was confirmed and read back but not measured, so the viewer has no second state to interpolate between and must not pretend to.',
  'Masses labelled deposited_model come from one service field (rcsb_entry_info.molecular_weight) and are masses of the MODEL. Where a mass of the biological object was retrievable it is reported separately and never merged with the model mass. For every machine but the nuclear pore, the biological mass is a null.',
  'The second-hand ribosome and polymerase counts in DISAGREEMENTS were read from a paper reporting them, not from their own publications. They are flagged at every appearance, but a second-hand number is weaker evidence than a retrieved one and should be re-sourced before anything is built on it.',
  'No diffusion coefficients, binding constants, residence times or crowding fractions are exported. WHAT_A_DEPICTION_CANNOT_SHOW mentions one measured diffusion coefficient in prose, from a source cited here, but this module exports no dynamics and a viewer that animates motion is not getting its speeds from this file.',
  'Rates are population averages and each entry says so. None of them should be used to animate an individual machine without also showing the distribution the paper reported.',
]);

// ---------------------------------------------------------------------------- worked example

export function worked() {
  const ladder = sizeLadder();
  const lines = [];
  lines.push(`machines.mjs - ${MACHINES.length} machines, measurements retrieved ${RETRIEVED_ON}`);
  lines.push('');
  lines.push('SIZE LADDER (sort key: greatest distance between any two modelled atoms)');
  for (const r of ladder.rungs) {
    const ratio = r.ratio_to_next ? `  x${r.ratio_to_next.ratio} -> ${r.ratio_to_next.next_id}` : '';
    lines.push(`  ${String(r.max_extent_nm).padStart(6)} nm  ${r.id.padEnd(36)} [${r.structure}]${ratio}`);
  }
  if (ladder.span) lines.push(`  span: ${ladder.span.smallest_nm} nm to ${ladder.span.largest_nm} nm, a factor of ${ladder.span.ratio}`);
  for (const u of ladder.unmeasured) lines.push(`  (not on the ladder) ${u.id} - ${u.why}`);
  lines.push('');
  lines.push('WHAT IS AND IS NOT KNOWN');
  for (const m of MACHINES) {
    const counts = m.copies_per_cell ?? [];
    const got = counts.filter(c => typeof c.value === 'number');
    const rates = (m.rate ?? []).filter(r => typeof r.value === 'number');
    lines.push(`  ${m.id}`);
    lines.push(`      counts: ${got.length ? got.map(c => `${c.value} per cell (${c.organism})`).join('; ') : 'NOT RETRIEVED - ' + (counts[0]?.null_reason ?? 'no reason recorded').slice(0, 80)}`);
    lines.push(`      rates : ${rates.length ? rates.map(r => `${r.value} ${r.units} (${r.organism})`).join('; ') : 'NOT RETRIEVED'}`);
  }
  lines.push('');
  lines.push(`DISAGREEMENTS KEPT: ${DISAGREEMENTS.length}`);
  for (const d of DISAGREEMENTS) lines.push(`  ${d.quantity} - spread ${d.spread}`);
  lines.push('');
  lines.push(`FIGURES REFUSED (textbook-only): ${TEXTBOOK_ONLY.length}`);
  for (const t of TEXTBOOK_ONLY) lines.push(`  ${t.figure}`);
  lines.push('');
  lines.push(`STRUCTURES REJECTED: ${STRUCTURES_REJECTED.length}`);
  for (const s of STRUCTURES_REJECTED) lines.push(`  ${s.id} - ${s.what_happened.slice(0, 90)}`);
  return lines.join('\n');
}

// Run worked() only when THIS file is the entry point. The first version of this guard used
// endsWith('machines.mjs'), which is also true of 'test-machines.mjs' - so importing the module from its
// own test printed the whole worked() output above the test results. Compare the basename exactly.
{
  const entry = (process.argv[1] ?? '').replace(/\\/g, '/').split('/').pop();
  if (entry === 'machines.mjs') console.log(worked());
}
