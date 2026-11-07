#!/usr/bin/env node
// chromatin.mjs - THE PACKING HIERARCHY FROM THE DOUBLE HELIX TO A CHROMOSOME, AND WHICH RUNGS OF IT
//                 ARE MEASUREMENTS RATHER THAN DRAWINGS.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// A viewer that zooms from an embryo into a nucleus has to decide, at every zoom level, how thick to
// draw the thing it is drawing. Those thicknesses are the only part of such a viewer that can be right
// or wrong in the ordinary sense: the POSITIONS it generates are a depiction and everyone knows it, but
// a diameter, a count or a spacing is a claim about the world. This module holds those claims and
// nothing else. It renders nothing.
//
// The hierarchy as it is taught - 2 nm helix, 11 nm beads-on-a-string, 30 nm fibre, 300 nm looped
// domains, 700 nm condensed chromatid, 1400 nm chromosome - is a ladder of round numbers, and the
// round numbers do not all have the same standing. Some are crystallographic. One of them may not
// exist in a living nucleus at all. So every rung here carries a `firmness` from a closed vocabulary,
// and the rungs that are drawings are labelled as drawings.
//
// ============================== THE RUNG THAT IS THE POINT ==============================
// See THE_THIRTY_NANOMETRE_PROBLEM. Short version: regular 30 nm fibres are real, reproducible and
// structurally characterised IN VITRO, from reconstituted arrays with linker histone. Every attempt to
// find them in the bulk chromatin of an intact nucleus by a method that does not first dilute or
// extract the chromatin has failed to find them - cryo-EM of vitreous sections, small-angle X-ray
// scattering, and ChromEM tomography all report an irregular chain in the 5-24 nm range with no
// periodicity above about 11 nm. One focused-ion-beam study of a metaphase chromosome does find some
// fibres near 30 nm, but as a minority of a broad 5-25 nm distribution with no higher-order repeat.
//
// A viewer that draws a tidy solenoid at this zoom level is not simplifying. It is teaching a structure
// whose existence in vivo is not established, and it is teaching it at exactly the magnification where
// the user will believe it most, because by then the picture looks like a micrograph.
//
// ============================== WHAT IS AND IS NOT IN HERE ==============================
// IN:   diameters, rises, base-pair counts, linear densities, repeat lengths, domain sizes, assembly
//       figures - each with the service or paper it came from and what was read back from it.
// OUT:  anything about where a particular nucleosome sits, how fast a polymerase moves, or what a
//       chromosome looks like in motion. Positions and rates belong to other modules. There is no
//       fused "compaction score" anywhere here and there will not be one: a packing ratio is only
//       meaningful against a stated linear density, and most rungs of the ladder have never had one
//       measured, so most rungs honestly return null.
//
// ============================== ORGANISM DISCIPLINE ==============================
// Chromatin numbers are organism- and cell-type-specific and the literature is mostly not about mice.
// The nucleosome core particle is a crystal structure of recombinant histones. The nucleosome repeat
// length figures below ARE from mouse embryonic stem cells. Almost everything about the in-situ fibre
// is from cultured human cells. The 30 nm in-vitro work is on reconstitutions, which have no cell type
// at all. Every entry says which, and `organism_established: false` marks the ones that cannot.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). This module names no
// member of it and reads no datum from it. Run `node holdout/check-leaks.mjs sim-engine/scales/molecular`.
//
//   node sim-engine/scales/molecular/chromatin.mjs        # print worked()
//   node sim-engine/scales/molecular/test-chromatin.mjs   # the tests

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

// ---------------------------------------------------------------------------- the closed vocabulary

/**
 * How much weight a number on this ladder can carry. The distinction that matters most is the first
 * two against the third: a structure solved from a reconstitution is a real measurement OF THE
 * RECONSTITUTION, and whether it describes a nucleus is a separate question that the structure cannot
 * answer. TEXTBOOK_ONLY is not an insult - it means we went looking for the primary measurement behind
 * a famous figure in this session and did not retrieve one.
 */
export const FIRMNESS = deepFreeze({
  MEASURED_IN_VITRO: 'measured on purified or reconstituted material: a crystal, a cryo-EM reconstruction, a reconstituted array. Says nothing by itself about a nucleus.',
  MEASURED_IN_SITU: 'measured inside an intact cell or nucleus by a method that did not first extract, dilute or spread the chromatin.',
  MEASURED_IN_VIVO: 'measured in a living cell (no fixation, no freezing).',
  DERIVED: 'computed in this file from other entries by stated arithmetic. Carries the firmness of its weakest input.',
  INFERRED: 'a model fitted to measurements rather than a dimension read off one.',
  CONTESTED: 'primary measurements disagree about whether the object exists in the state being described, and both sides are cited on the entry.',
  TEXTBOOK_ONLY: 'a figure in wide circulation for which no primary measurement was retrieved in this session. Usable as a label, not as evidence.',
});

export const FIRMNESS_VALUES = deepFreeze(Object.keys(FIRMNESS));

// ---------------------------------------------------------------------------- sources

/**
 * Every entry here was fetched this session. `verified_how` on each LEVELS entry says what was fetched
 * and what came back; these are the bibliographic details for the things fetched.
 */
export const CITATIONS = deepFreeze({
  wang_1979: {
    cite: 'Wang, J.C. (1979) Helical repeat of DNA in solution. Proc Natl Acad Sci USA 76:200-203.',
    doi: '10.1073/pnas.76.1.200', pmid: '284332',
    gives: 'Topoisomer gel electrophoresis on covalently closed DNAs: 10.4 bp/turn in solution under physiological conditions, probable error +/-0.1. The paper itself states this is "significantly different from the value 10.0 base pairs per turn for the B form fiber structure".',
  },
  peck_wang_1981: {
    cite: 'Peck, L.J. & Wang, J.C. (1981) Sequence dependence of the helical repeat of DNA in solution. Nature 292:375-378.',
    doi: '10.1038/292375a0', pmid: '6265793',
    gives: 'That the solution helical repeat is sequence-dependent, i.e. that a single bp-per-turn figure is an average over sequence.',
  },
  drew_1981: {
    cite: 'Drew, H.R., Wing, R.M., Takano, T., Broka, C., Tanaka, S., Itakura, K. & Dickerson, R.E. (1981) Structure of a B-DNA dodecamer: conformation and dynamics. Proc Natl Acad Sci USA 78:2179-2183.',
    doi: '10.1073/pnas.78.4.2179', pdb: '1BNA',
    gives: 'The B-DNA dodecamer CGCGAATTCGCG at 1.9 A. The crystallographic B-form geometry used here for rise, twist and duplex width.',
  },
  luger_1997: {
    cite: 'Luger, K., Mader, A.W., Richmond, R.K., Sargent, D.F. & Richmond, T.J. (1997) Crystal structure of the nucleosome core particle at 2.8 A resolution. Nature 389:251-260.',
    doi: '10.1038/38444', pmid: '9305837', pdb: '1AOI',
    gives: 'The nucleosome core particle with 146 bp of DNA. The abstract also notes that "the lack of uniformity between multiple histone/DNA-binding sites causes the DNA to deviate from ideal superhelix geometry" - the wrapped DNA is not a clean superhelix.',
  },
  davey_2002: {
    cite: 'Davey, C.A., Sargent, D.F., Luger, K., Maeder, A.W. & Richmond, T.J. (2002) Solvent mediated interactions in the structure of the nucleosome core particle at 1.9 A resolution. J Mol Biol 319:1097-1113.',
    doi: '10.1016/S0022-2836(02)00386-8', pmid: '12079350', pdb: '1KX5',
    gives: 'NCP147: the 147 bp core particle at 1.94 A. One extra base pair over the 146 bp particle markedly improved the density, which is why 147 and not 146 is the number now quoted.',
  },
  finch_klug_1976: {
    cite: 'Finch, J.T. & Klug, A. (1976) Solenoidal model for superstructure in chromatin. Proc Natl Acad Sci USA 73:1897-1901.',
    doi: '10.1073/pnas.73.6.1897', pmid: '1064861',
    gives: 'The origin of the solenoid. Nuclease-digested, EDTA-extracted chromatin from rat gives ~100 A nucleofilaments; in 0.2 mM Mg2+ these condense into a solenoid of pitch ~110 A, correlated with a ~300 A thread seen by others. Note what is measured: a pitch of 110 A and a nucleofilament of 100 A, on extracted material, in a non-physiological ionic condition. The familiar "30 nm" is the ~300 A thread, which this paper correlates with rather than measures.',
  },
  robinson_2006: {
    cite: 'Robinson, P.J.J., Fairall, L., Huynh, V.A.T. & Rhodes, D. (2006) EM measurements define the dimensions of the "30-nm" chromatin fiber: evidence for a compact, interdigitated structure. Proc Natl Acad Sci USA 103:6506-6511.',
    doi: '10.1073/pnas.0601212103', pmid: '16617109',
    gives: 'The best linear densities anyone has for a regular 30 nm fibre. Reconstituted arrays with linker histone and defined linker lengths: 10-40 bp linker gives 33 nm diameter at 11 nucleosomes per 11 nm; 50-70 bp linker gives 44 nm at 15 nucleosomes per 11 nm. Two discrete classes, not a continuum, and the authors state this is "inconsistent with two-start helix models".',
  },
  schalch_2005: {
    cite: 'Schalch, T., Duda, S., Sargent, D.F. & Richmond, T.J. (2005) X-ray structure of a tetranucleosome and its implications for the chromatin fibre. Nature 436:138-141.',
    doi: '10.1038/nature03686', pdb: '1ZBB',
    gives: 'A tetranucleosome at 9.0 A, the structural basis of the two-start zigzag model of the fibre. Cited here because it DISAGREES with robinson_2006 about the architecture of the same in-vitro object.',
  },
  song_2014: {
    cite: 'Song, F., Chen, P., Sun, D., Wang, M., Dong, L., Liang, D., Xu, R.-M., Zhu, P. & Li, G. (2014) Cryo-EM study of the chromatin fiber reveals a double helix twisted by tetranucleosomal units. Science 344:376-380.',
    doi: '10.1126/science.1251413', pmid: '24763583',
    gives: '11 A cryo-EM reconstructions of reconstituted 30 nm fibres assembled WITH linker histone H1 at two repeat lengths: a left-handed twist of tetranucleosomal units with straight linker DNA, H1-dependent. The strongest in-vitro evidence that a regular 30 nm fibre has a definite structure.',
  },
  eltsov_2008: {
    cite: 'Eltsov, M., Maclellan, K.M., Maeshima, K., Frangakis, A.S. & Dubochet, J. (2008) Analysis of cryo-electron microscopy images does not support the existence of 30-nm chromatin fibers in mitotic chromosomes in situ. Proc Natl Acad Sci USA 105:19732-19737.',
    doi: '10.1073/pnas.0810057105', pmid: '19064912',
    gives: 'Cryo-EM of vitreous sections of high-pressure-frozen human cells, contrast-transfer-function corrected, no staining or chemical treatment. Mitotic chromosomes appear as a homogeneous grainy texture with no visible 30 nm fibres, and the power spectra give no indication of 30 nm folding.',
  },
  joti_2012: {
    cite: 'Joti, Y., Hikima, T., Nishino, Y., Kamada, F., Hihara, S., Takata, H., Ishikawa, T. & Maeshima, K. (2012) Chromosomes without a 30-nm chromatin fiber. Nucleus 3:404-410.',
    doi: '10.4161/nucl.21222', pmid: '22825571',
    gives: 'Small-angle X-ray scattering, which detects periodicity in non-crystalline material in solution. No structural feature larger than 11 nm was detected in human mitotic chromosomes even at a chromosome-diameter scale (~1 um); the same scattering pattern held in interphase nuclei up to ~275 nm. This is the argument that is hardest to answer by "the fibres were there but not visible".',
  },
  ou_2017: {
    cite: 'Ou, H.D., Phan, S., Deerinck, T.J., Thor, A., Ellisman, M.H. & O\'Shea, C.C. (2017) ChromEMT: Visualizing 3D chromatin structure and compaction in interphase and mitotic cells. Science 357:eaag0025.',
    doi: '10.1126/science.aag0025', pmid: '28751582', pmc: 'PMC5646685',
    gives: 'A DNA-binding dye polymerised into an osmiophilic deposit, then electron tomography: chromatin in situ is "a disordered 5- to 24-nanometer-diameter curvilinear chain". Per-image manual measurements span ~8-24 nm in interphase and ~8-21 nm in mitosis. Chromatin volume concentration 12-52%, mean 30 +/- 10% in interphase human small-airway epithelial cells; 35-47%, mean 42 +/- 2.5% in mitotic human U2OS cells.',
  },
  wako_2020: {
    cite: 'Wako, T., Yoshida, A., Kato, J., Otsuka, Y., Ogawa, S., Kaneyoshi, K., Takata, H. & Fukui, K. (2020) Human metaphase chromosome consists of randomly arranged chromatin fibres with up to 30-nm diameter. Scientific Reports 10:8948.',
    doi: '10.1038/s41598-020-65842-z', pmid: '32488088', pmc: 'PMC7265543',
    gives: 'Focused ion beam / SEM: a human metaphase chromosome dissected every 10 nm into 224 cross-sections. Mean chromatin fibre diameter 16.9 +/- 8.2 nm; the majority between 5 and 25 nm; fibres at 30 nm present but a minority; no higher-order periodical structure detected under the conditions used; chromatin fibres occupied 19% of the chromosome volume. The most even-handed single dataset on the question.',
  },
  maeshima_2014: {
    cite: 'Maeshima, K., Imai, R., Tamura, S. & Nozaki, T. (2014) Chromatin as dynamic 10-nm fibers. Chromosoma 123:225-237.',
    doi: '10.1007/s00412-014-0460-2', pmid: '24737122',
    gives: 'The review that states the revision plainly: chromatin is irregularly folded 10 nm fibres without 30 nm fibres, in interphase chromatin and in mitotic chromosomes.',
  },
  maeshima_2020: {
    cite: 'Maeshima, K., Tamura, S., Hansen, J.C. & Itoh, Y. (2020) Fluid-like chromatin: Toward understanding the real chromatin organization present in the cell. Current Opinion in Cell Biology 64:77-89.',
    doi: '10.1016/j.ceb.2020.02.016', pmid: '32283330',
    gives: 'The careful statement of the dispute from the in-situ side, including the key concession: chromatin "varies greatly depending on the surrounding environment (i.e. cations etc.): from an extended 10-nm fiber, to a folded 30-nm fiber, to chromatin condensates". The 30 nm fibre is not denied; its presence in the cell is.',
  },
  prieto_maeshima_2019: {
    cite: 'Prieto, E.I. & Maeshima, K. (2019) Dynamic chromatin organization in the cell. Essays in Biochemistry 63:133-145.',
    doi: '10.1042/EBC20180054', pmid: '30967477',
    gives: 'States explicitly that "no true consensus is currently reached regarding the exact mechanism of chromatin organization" - the sentence this module\'s CONTESTED label rests on.',
  },
  nozaki_2013: {
    cite: 'Nozaki, T., Kaizu, K., Pack, C.-G., Tamura, S., Tani, T., Hihara, S., Nagai, T., Takahashi, K. & Maeshima, K. (2013) Flexible and dynamic nucleosome fiber in living mammalian cells. Nucleus 4:349-356.',
    doi: '10.4161/nucl.26053', pmid: '23945462',
    gives: 'Single-nucleosome imaging in living mammalian cells: local nucleosome fluctuation of ~50 nm per 30 ms from Brownian motion. The only in-vivo number on this list, and the reason a still picture of chromatin is misleading whatever diameter it uses.',
  },
  teif_2012: {
    cite: 'Teif, V.B., Vainshtein, Y., Caudron-Herger, M., Mallm, J.-P., Marth, C., Hofer, T. & Rippe, K. (2012) Genome-wide nucleosome positioning during embryonic stem cell development. Nature Structural & Molecular Biology 19:1185-1192.',
    doi: '10.1038/nsmb.2419', pmid: '23085715',
    gives: 'Genome-wide nucleosome occupancy in mouse embryonic stem cells and their neural progenitor and embryonic fibroblast derivatives. The average nucleosome repeat length INCREASES by 5-7 bp during differentiation, with local variation - so a single repeat length is a property of a cell state, not of a genome.',
  },
  beshnova_2014: {
    cite: 'Beshnova, D.A., Cherstvy, A.G., Vainshtein, Y. & Teif, V.B. (2014) Regulation of the nucleosome repeat length in vivo by the DNA sequence, protein concentrations and long-range interactions. PLoS Computational Biology 10:e1003698.',
    doi: '10.1371/journal.pcbi.1003698', pmid: '24992723', pmc: 'PMC4081033',
    gives: 'Absolute experimental nucleosome repeat lengths for mouse embryonic stem cells, taken from the teif_2012 data: 183.4 bp over RNA-polymerase-bound regions and 177.5 bp around CTCF sites. Also, for contrast, a nucleosome repeat length of 154 bp in fission yeast, which leaves only 7 bp between neighbouring nucleosomes.',
  },
  dixon_2012: {
    cite: 'Dixon, J.R., Selvaraj, S., Yue, F., Kim, A., Li, Y., Shen, Y., Hu, M., Liu, J.S. & Ren, B. (2012) Topological domains in mammalian genomes identified by analysis of chromatin interactions. Nature 485:376-380.',
    doi: '10.1038/nature11082', pmid: '22495300', pmc: 'PMC3356448',
    gives: '2,200 topological domains in mouse embryonic stem cells with a median size of 880 kb, occupying ~91% of the genome. The mouse-specific domain figure.',
  },
  rao_2014: {
    cite: 'Rao, S.S.P., Huntley, M.H., Durand, N.C., Stamenova, E.K., Bochkov, I.D., Robinson, J.T., Sanborn, A.L., Machol, I., Omer, A.D., Lander, E.S. & Aiden, E.L. (2014) A 3D map of the human genome at kilobase resolution reveals principles of chromatin looping. Cell 159:1665-1680.',
    doi: '10.1016/j.cell.2014.11.021', pmid: '25497547',
    gives: 'In-situ Hi-C at 1 kb resolution, 4.9 billion contacts in human lymphoblastoid cells: contact domains of median length 185 kb and ~10,000 loops, with CTCF sites at loop anchors predominantly (>90%) convergent. The 185 kb median is NOT a refinement of dixon_2012\'s 880 kb - see the disagreement recorded on the loop_domain level.',
  },
  ncbi_datasets_grcm39: {
    cite: 'NCBI Datasets assembly report for GCF_000001635.27 (GRCm39), retrieved 2026-11-07.',
    url: 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000001635.27/dataset_report',
    gives: 'Mus musculus strain C57BL/6J; assembly name GRCm39; paired GenBank accession GCA_000001635.9; total_sequence_length 2728206152; total_ungapped_length 2654605538; total_number_of_chromosomes 21.',
  },
  ensembl_grcm39: {
    cite: 'Ensembl REST info/assembly/mus_musculus, retrieved 2026-11-07.',
    url: 'https://rest.ensembl.org/info/assembly/mus_musculus?content-type=application/json',
    gives: 'assembly_name GRCm39, assembly_accession GCA_000001635.9, assembly_date 2020-06; per-chromosome lengths, of which chromosome 1 at 195154279 bp is the longest and the mitochondrial sequence is 16299 bp.',
  },
  bionumbers_100442: {
    cite: 'BioNumbers ID 100442, "Nuclear volume", organism "Mammalian tissue culture cell", value 283 um^3 (range 66-500), reference given only as "Roskams and Rodgers, LabRef". Retrieved 2026-11-07.',
    url: 'https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100442',
    gives: 'A nuclear volume figure, and an object lesson: the record names no species, no cell type, no method and no primary paper. It is a laboratory reference book entry. It is carried here as TEXTBOOK_ONLY and used only to show what the comparison would look like, never as the mouse value.',
  },
});

// ---------------------------------------------------------------------------- B-form geometry

/**
 * B-DNA geometry computed in this session from the deposited coordinates of PDB 1BNA, not quoted.
 *
 * Method, so it can be repeated: download https://files.rcsb.org/download/1BNA.cif; take base-ring
 * atoms of each residue; form base-pair centres by pairing residue k of chain A with the complementary
 * residue of chain B; take the helix axis as the principal direction of those twelve centres; fit the
 * rise as the slope of axial coordinate against base-pair index; take the twist per step as the change
 * in azimuth of the C1'-C1' vector about that axis; take the duplex width as twice the largest radial
 * distance of a heavy atom from the axis.
 *
 * The retrieved sequence of 1BNA is CGCGAATTCGCG on both chains, 12 residues each, which is the
 * Drew-Dickerson dodecamer and confirms the right entry was read.
 */
export const B_DNA = deepFreeze({
  rise_per_bp_angstrom: {
    value: 3.341, units: 'A', firmness: FIRMNESS_VALUES[0],
    alternatives: { end_to_end_over_11_steps: 3.350, textbook_round_figure: 3.4 },
    source: 'drew_1981',
    verified_how: 'Fetched files.rcsb.org/download/1BNA.cif and fitted the axial coordinate of 12 base-pair centres against base-pair index by least squares: slope 3.341 A/bp; the end-to-end distance divided by 11 steps gives 3.350 A/bp. The 3.4 A figure in general circulation is 2% larger than either.',
    note: 'The viewer should use ONE of these and say which. The difference is 2%, which is invisible at any single zoom level and is 18 mm over a mouse genome.',
  },
  bp_per_turn_crystal: {
    value: 10.06, units: 'bp/turn', firmness: FIRMNESS_VALUES[0], source: 'drew_1981',
    verified_how: 'Computed from the same 1BNA coordinates: mean twist 35.79 deg per step over 11 steps, so 360/35.79 = 10.06 bp per turn.',
    per_step_twist_deg: [39.3, 37.7, 27.4, 36.6, 37.6, 32.1, 35.7, 40.5, 30.2, 39.8, 36.8],
    note: 'The per-step twists span 27.4 to 40.5 degrees in a single twelve-base-pair crystal. A uniform helix is already a smoothing at the smallest scale on this ladder.',
  },
  bp_per_turn_solution: {
    value: 10.4, uncertainty: 0.1, units: 'bp/turn', firmness: FIRMNESS_VALUES[1], source: 'wang_1979',
    verified_how: 'PubMed abstract of PMID 284332 read back: "the DNA helix repeat in solution as 10.4 base pairs per turn under physiological conditions, with an estimated probable error of +/- 0.1", and the same abstract states the value is "significantly different from the value 10.0 base pairs per turn for the B form fiber structure".',
  },
  helical_repeat_disagreement: {
    what: 'The helical repeat of B-DNA is 10.0-10.06 bp/turn as a crystal or fibre and 10.4 bp/turn in solution.',
    both_sources: ['drew_1981', 'wang_1979'],
    also: 'peck_wang_1981',
    resolution: 'NOT averaged. They are measurements of different states of the same molecule, and the 1979 paper draws the contrast itself. A viewer depicting DNA in a nucleus is depicting the solution state, so 10.4 is the better choice there - but the atomic model it draws from will be a crystal structure at 10.06, and the mismatch will accumulate visibly over a few hundred base pairs.',
  },
  duplex_width_angstrom: {
    value: 22.8, units: 'A', firmness: FIRMNESS_VALUES[0], source: 'drew_1981',
    verified_how: 'Computed from 1BNA coordinates: largest heavy-atom radial distance from the fitted helix axis 11.39 A, so 22.8 A across. The phosphorus-to-phosphorus width is narrower: largest P radius 10.18 A, so 20.4 A.',
    note: 'The famous "2 nm" is the phosphate-to-phosphate figure (20.4 A here). The van der Waals envelope is nearer 2.3 nm before adding atomic radii. A viewer that draws a 2 nm cylinder is drawing the backbone spacing, not the molecule.',
  },
  phosphate_width_angstrom: { value: 20.4, units: 'A', firmness: FIRMNESS_VALUES[0], source: 'drew_1981' },
});

export const RISE_PER_BP_M = 3.341e-10;
export const RISE_PER_BP_ALTERNATIVES_M = deepFreeze({ least_squares_1bna: 3.341e-10, end_to_end_1bna: 3.350e-10, textbook: 3.4e-10 });

// ---------------------------------------------------------------------------- the ladder

/**
 * The hierarchy, in order, smallest first. Each level carries:
 *
 *   id, name            - stable identifier and a plain name
 *   dimension           - the characteristic diameter or width, with units, or a null with a reason
 *   bp_per_nm           - base pairs of B-DNA held per nanometre ALONG THE AXIS of this level, which is
 *                         the only quantity from which a packing ratio can be computed. Most levels
 *                         have never had one measured and are null here. That is the honest state of
 *                         this field, not a gap in the research.
 *   organism, cell_type - of the measurement, not of the concept
 *   evidence            - what was actually observed
 *   source              - a key into CITATIONS
 *   firmness            - a key of FIRMNESS
 *   verified_how        - what was fetched and what was read back
 */
export const LEVELS = deepFreeze([
  {
    id: 'b_dna',
    name: 'B-form double helix',
    dimension: { value: 22.8, lo: 20.4, hi: 22.8, units: 'A', what: 'duplex width; the low end is phosphate-to-phosphate, the high end the heavy-atom envelope' },
    bp_per_nm: { value: 1 / 0.3341, units: 'bp/nm', what: 'along the helix axis, from the fitted rise of 3.341 A/bp' },
    rise_per_bp_angstrom: 3.341,
    bp_per_turn: { crystal: 10.06, solution: 10.4, note: 'see B_DNA.helical_repeat_disagreement; these are not averaged' },
    organism: 'none - a synthetic oligonucleotide crystal',
    organism_established: true,
    cell_type: null,
    evidence: 'A 1.9 A single-crystal X-ray structure of the dodecamer CGCGAATTCGCG, from which the rise, the twist and the width were computed directly.',
    source: 'drew_1981',
    firmness: 'MEASURED_IN_VITRO',
    verified_how: 'Fetched data.rcsb.org/rest/v1/core/entry/1BNA (title "STRUCTURE OF A B-DNA DODECAMER. CONFORMATION AND DYNAMICS", 1.9 A, X-ray, released 1981, primary citation Drew et al. PNAS 78:2179) and files.rcsb.org/download/1BNA.cif. Read back: two chains of 12 residues, sequence CGCGAATTCGCG each. Computed rise 3.341 A/bp, mean twist 35.79 deg/step, heavy-atom width 22.8 A.',
    what_a_viewer_gets_right_here: 'Essentially everything. This is the one rung of the ladder that is settled to better than a tenth of an angstrom.',
  },
  {
    id: 'nucleosome_core_particle',
    name: 'nucleosome core particle',
    dimension: { value: 104, lo: 84.4, hi: 121.8, units: 'A', what: 'disc diameter. 84.4 A is the DNA superhelix measured centre-to-centre at the phosphates; 104 A adds one duplex width to give the outer face; 121.8 A is the widest point including the flared entering and exiting DNA.' },
    height_angstrom: { value: 51.5, lo: 51.5, hi: 51.8, units: 'A', what: 'axial extent of the DNA phosphates; the basis of the ~5.5 nm disc thickness in circulation' },
    bp_wrapped: { value: 147, units: 'bp', also: 146, note: '146 bp in the 1997 particle and 147 bp in the 1.9 A particle. The extra base pair is the reason 147 is now the quoted number, not a correction of a count.' },
    superhelical_turns: {
      value: 1.81, units: 'turns', what: 'azimuthal turns swept by one DNA strand about the fitted superhelical axis',
      the_textbook_figure: 1.65,
      disagreement: 'The widely quoted figure is 1.65 turns. Computing the azimuth of one strand about the best-fit axis of the deposited coordinates gives 1.81 turns in 1AOI and 1.805 in 1KX5. These are almost certainly different definitions - a superhelical parameter fitted to the tightly bound core versus a total azimuthal sweep that includes the flared ends - but no primary sentence defining the 1.65 figure was retrieved in this session, so it is not asserted here as a measurement. The computed 1.81 is.',
    },
    bp_per_nm: { value: null, units: 'bp/nm', null_reason: 'A single particle has no axis along which base pairs per nanometre is defined. The quantity only exists for a fibre.', what_would_resolve_it: 'nothing - the question does not apply at this level' },
    organism: 'none - recombinant histones on defined-sequence DNA',
    organism_established: true,
    cell_type: null,
    evidence: 'Two X-ray crystal structures of the core particle, at 2.8 A with 146 bp and at 1.94 A with 147 bp. All dimensions here were computed from the deposited coordinates rather than quoted.',
    source: 'davey_2002',
    also_sources: ['luger_1997'],
    firmness: 'MEASURED_IN_VITRO',
    verified_how: 'Fetched data.rcsb.org/rest/v1/core/entry/1AOI (2.8 A, "COMPLEX BETWEEN NUCLEOSOME CORE PARTICLE (H3,H4,H2A,H2B) AND 146 BP LONG DNA FRAGMENT", Luger et al. 1997, DOI 10.1038/38444) and /1KX5 ("X-Ray Structure of the Nucleosome Core Particle, NCP147, at 1.9 A Resolution", 1.94 A, Davey et al. 2002, DOI 10.1016/S0022-2836(02)00386-8), plus both .cif coordinate files. Read back from the coordinates: 1AOI has two DNA chains of 146 residues, 1KX5 two of 147. Computed in both: mean phosphate superhelical radius 42.18 A and 42.22 A, axial extent of phosphates 51.81 A and 51.48 A, azimuthal turns 1.810 and 1.805.',
    what_a_viewer_gets_right_here: 'The disc, its thickness, the number of base pairs on it, and the left-handed wrap. What it should not imply is regularity: the 1997 abstract states that the non-uniformity of the histone-DNA contacts makes the DNA "deviate from ideal superhelix geometry".',
  },
  {
    id: 'linker_and_repeat',
    name: 'linker DNA and the nucleosome repeat length',
    dimension: { value: null, units: 'A', null_reason: 'A linker is a length of DNA, not an object with a diameter; its width is the B-DNA duplex width.', what_would_resolve_it: 'nothing - use the b_dna width' },
    nucleosome_repeat_length_bp: {
      value: 183.4, units: 'bp', what: 'centre-to-centre spacing over RNA-polymerase-bound regions in mouse embryonic stem cells',
      also_measured: { around_ctcf_sites_mouse_es: 177.5, fission_yeast_whole_genome: 154 },
      variability: 'Not a constant of the genome. It rises by 5-7 bp as mouse embryonic stem cells differentiate into neural progenitors or embryonic fibroblasts, and it differs between genomic contexts within one cell: 183.4 bp over polymerase-bound regions against 177.5 bp around CTCF sites in the same cells.',
    },
    linker_bp: { value: 36.4, units: 'bp', what: 'repeat length minus the 147 bp wrapped on the core particle', firmness_of_this_arithmetic: 'DERIVED', range_across_contexts: [30.5, 36.4], note: 'In fission yeast the same subtraction leaves 7 bp, which is too short to accommodate any regular higher-order fibre - one reason the 30 nm fibre cannot be a universal level of the hierarchy.' },
    bp_per_nm: { value: null, units: 'bp/nm', null_reason: 'A repeat length is a spacing along the DNA, not along a fibre axis; converting it needs a measured axial advance per nucleosome, which belongs to the fibre levels below.', what_would_resolve_it: 'a measured axial rise per nucleosome in the state being drawn' },
    organism: 'Mus musculus (and, for contrast, Schizosaccharomyces pombe)',
    organism_established: true,
    cell_type: 'mouse embryonic stem cells, with neural progenitor and embryonic fibroblast derivatives for the differentiation trend',
    evidence: 'Genome-wide nucleosome occupancy mapping in mouse embryonic stem cells and two differentiated derivatives, with absolute repeat lengths extracted per genomic context.',
    source: 'beshnova_2014',
    also_sources: ['teif_2012'],
    firmness: 'MEASURED_IN_VIVO',
    verified_how: 'Fetched PubMed metadata for PMID 23085715 (Teif et al. 2012 NSMB, DOI 10.1038/nsmb.2419), whose abstract states "the average nucleosome repeat length increased during differentiation by 5-7 base pairs, with local variations for specific regions" in mouse embryonic stem cells, neural progenitors and embryonic fibroblasts. The abstract gives no absolute value, so fetched the open full text of PMC4081033 (Beshnova et al. 2014) and read back the experimental figures "the NRL found experimentally for these regions (183.4 bp)" for polymerase-bound regions, "the NRL around CTCF sites observed in the experiment (177.5 bp)", and for fission yeast "which has NRL = 154 bp, leaving only 7 bp between neighboring nucleosomes".',
    what_a_viewer_gets_right_here: 'That linkers are short and uneven. What it must not do is draw one linker length: a viewer showing a fixed 36 bp linker is showing one genomic context of one cell state of one organism.',
  },
  {
    id: 'ten_nm_fibre',
    name: '10 nm fibre ("beads on a string")',
    dimension: { value: 10, lo: 5, hi: 24, units: 'nm', what: 'the nominal 10 nm is the core-particle disc seen edge-on. The 5-24 nm range is what is actually measured in situ, where the chain is irregular and the "10 nm fibre" and the "30 nm fibre" are not two populations but one broad one.' },
    bp_per_nm: { value: null, units: 'bp/nm', null_reason: 'No measured axial advance per nucleosome for an extended beads-on-a-string chain was retrieved. The level is defined by the absence of regular folding, so it has no reproducible linear density to measure.', what_would_resolve_it: 'an in-situ measurement of contour length per nucleosome along an identified decompacted chain - the ChromEMT data could in principle yield one, but no such figure was retrieved' },
    organism: 'Rattus (for the extracted nucleofilament) and Homo sapiens (for the in-situ chain)',
    organism_established: true,
    cell_type: 'nuclei digested with micrococcal nuclease and EDTA-extracted, for the 100 A nucleofilament; human small-airway epithelial cells in interphase and human U2OS cells in mitosis, for the in-situ 5-24 nm chain',
    evidence: 'Electron microscopy of extracted chromatin gives filaments of about 100 A that coil loosely. Electron tomography of dye-stained chromatin inside intact cells gives a disordered curvilinear chain of 5-24 nm diameter, with per-image manual measurements spanning ~8-24 nm in interphase and ~8-21 nm in mitosis.',
    source: 'ou_2017',
    also_sources: ['finch_klug_1976', 'maeshima_2014'],
    firmness: 'MEASURED_IN_SITU',
    verified_how: 'Fetched PubMed metadata for PMID 28751582 and read the abstract back: "chromatin is a disordered 5- to 24-nanometer-diameter curvilinear chain". Fetched PMC5646685 full text and read back "manual measurements in a single TS image indicate that chromatin diameters vary between ~8 and 24 nm" for interphase and "Manual measurements indicate that chromatin diameter ranges are ~8 to 21 nm" for mitosis, with the cell identities "Human small-airway epithelial cells (SAECs)" and "U2OS cells are a human osteosarcoma cell line". Fetched PubMed metadata for PMID 1064861 and read back "filaments of about 100 A diameter which coil loosely".',
    what_a_viewer_gets_right_here: 'The beads, and roughly their spacing. What it gets wrong is the string: in a cell the chain is not of one thickness, and it is moving about 50 nm every 30 ms (see nozaki_2013), so a smooth static strand of constant width is wrong in both respects.',
  },
  {
    id: 'thirty_nm_fibre',
    name: '30 nm fibre',
    dimension: {
      value: null, units: 'nm',
      null_reason: 'There is no single diameter to report, because the in-vitro object and the in-situ object are not the same object. In vitro the measured diameters are two discrete classes, 33 nm and 44 nm, depending on linker length. In situ no periodicity above ~11 nm is detectable at all, and the measured fibre diameters form one broad distribution centred near 17 nm. Reporting "30 nm" would be reporting neither.',
      what_would_resolve_it: 'an in-situ method that resolves individual fibres in unperturbed nuclei AND detects a 30 nm periodicity. ChromEM tomography is the closest existing method and it reports the opposite.',
      measured_in_vitro: { class_a_nm: 33, class_a_linker_bp: [10, 40], class_b_nm: 44, class_b_linker_bp: [50, 70] },
      measured_in_situ_mean_nm: 16.9, measured_in_situ_sd_nm: 8.2,
    },
    bp_per_nm: {
      value: 183.4, units: 'bp/nm', firmness_of_this_arithmetic: 'DERIVED',
      what: 'For the in-vitro 33 nm class only: 11 nucleosomes per 11 nm is exactly one nucleosome per nanometre of fibre axis, so the base pairs per nanometre equal the nucleosome repeat length. Combined with the mouse embryonic stem cell repeat length of 183.4 bp this gives 183.4 bp/nm.',
      inputs: ['robinson_2006 (11 nucleosomes per 11 nm)', 'beshnova_2014 (183.4 bp repeat length)'],
      the_splice_is_the_weakness: 'The linear density was measured on a reconstitution with defined linkers; the repeat length was measured in mouse embryonic stem cells. Multiplying them assumes the fibre in the cell has the reconstitution\'s linear density, which is the very thing in dispute. Use this number to show what the textbook fibre WOULD compact to, never as a property of a nucleus.',
      also_in_vitro: { class_b_nucleosomes_per_nm: 15 / 11, class_b_bp_per_nm_at_mouse_repeat: (15 / 11) * 183.4 },
    },
    organism: 'none for the in-vitro structures - reconstituted arrays. Homo sapiens for every in-situ test.',
    organism_established: false,
    organism_note: 'A reconstituted array has no cell type, no growth state and no genome. The histone preparation behind the best linear-density measurement is not mammalian, and a mammalian reconstitution is a different experiment. This is the entry on the ladder where "which organism" has no answer, and that is itself part of the problem.',
    cell_type: 'not applicable in vitro; human mitotic chromosomes and interphase nuclei in situ',
    evidence: 'IN VITRO: long regularly folded fibres reconstituted from nucleosome arrays with linker histone give two discrete diameter classes with unexpectedly high nucleosome density, and an 11 A cryo-EM reconstruction of such a fibre shows a histone-H1-dependent left-handed twist of tetranucleosomal units. IN SITU: cryo-EM of vitreous sections shows no 30 nm fibres and no 30 nm signal in the power spectra; small-angle X-ray scattering detects no structural feature larger than 11 nm; electron tomography inside cells shows a disordered 5-24 nm chain. MIXED: focused-ion-beam dissection of a metaphase chromosome finds fibres up to 30 nm present but in the minority of a 5-25 nm distribution, with no higher-order periodicity.',
    source: 'robinson_2006',
    also_sources: ['song_2014', 'schalch_2005', 'eltsov_2008', 'joti_2012', 'ou_2017', 'wako_2020', 'maeshima_2014', 'maeshima_2020', 'prieto_maeshima_2019'],
    firmness: 'CONTESTED',
    contested_sides: {
      exists_as_a_regular_fibre: ['robinson_2006', 'song_2014', 'schalch_2005', 'finch_klug_1976'],
      not_present_in_bulk_chromatin_in_cells: ['eltsov_2008', 'joti_2012', 'ou_2017', 'maeshima_2014', 'maeshima_2020'],
      present_but_a_minority_with_no_higher_order_repeat: ['wako_2020'],
      and_the_in_vitro_side_disagrees_with_itself: 'robinson_2006 states its measurements are "inconsistent with two-start helix models", which is what schalch_2005 and song_2014 describe. So the in-vitro architecture is disputed even before anyone asks about cells.',
    },
    verified_how: 'Fetched PubMed metadata for PMID 16617109 and read the abstract back: "arrays with 10 to 40 bp of linker DNA all produce fibers with a diameter of 33 nm and 11 nucleosomes per 11 nm, whereas arrays with 50 to 70 bp of linker DNA all produce 44-nm-wide fibers with 15 nucleosomes per 11 nm", and "a finding that is inconsistent with two-start helix models". Fetched PMID 24763583 (Song et al. 2014, "11-angstrom-resolution ... histone H1-dependent left-handed twist of the repeating tetranucleosomal structural units"). Fetched data.rcsb.org/rest/v1/core/entry/1ZBB (9.0 A tetranucleosome, Schalch et al. 2005, DOI 10.1038/nature03686). Fetched PMID 19064912 and read back "there were no visible 30-nm fibers" and "Power spectra of the chromosome images also gave no indication of 30-nm chromatin folding". Fetched PMID 22825571 and read back "no structural feature larger than 11 nm was detected, even at a chromosome-diameter scale (~1 um)". Fetched PMID 32488088 and read back "the chromosome consisted of chromatin fibres of an average diameter of 16.9-nm ... the majority of the chromatin fibres had diameters between 5 and 25-nm, while those with 30-nm were in the minority" and "the higher-order periodical structure could not be detected under the conditions employed"; the 16.9 +/- 8.2 nm standard deviation was read from the PMC7265543 full text.',
    what_a_viewer_gets_right_here: 'Nothing, if it draws a solenoid. See THE_THIRTY_NANOMETRE_PROBLEM for what to draw instead.',
  },
  {
    id: 'loop_domain',
    name: 'loop domains and topologically associating domains',
    dimension: { value: null, units: 'nm', null_reason: 'A domain is defined by contact frequency in a sequencing assay, not by a diameter in an image. It has a size in base pairs; it does not have a measured physical thickness.', what_would_resolve_it: 'an imaging method that identifies the same domains it measures the dimensions of; sequencing-defined domains and image-defined structures have not been shown to be the same objects' },
    size_bp: {
      mouse_topological_domain_median: 880000,
      mouse_domain_count: 2200,
      mouse_genome_fraction: 0.91,
      human_contact_domain_median: 185000,
      human_loop_count: 10000,
      units: 'bp',
      disagreement: 'The median domain size is 880 kb in mouse embryonic stem cells and 185 kb in human lymphoblastoid cells. This is NOT averaged to a single figure, and it is not a species difference. The two studies used different assays at different resolutions (Hi-C at tens of kilobases, against in-situ Hi-C at 1 kb with 4.9 billion contacts) and segmented them with different algorithms, so "topological domain" and "contact domain" do not denote the same object. A viewer that draws "the average TAD" is drawing an artefact of a segmentation choice.',
      both_sources: ['dixon_2012', 'rao_2014'],
    },
    bp_per_nm: { value: null, units: 'bp/nm', null_reason: 'Requires a physical length for a domain, which no retrieved study provides.', what_would_resolve_it: 'a measured contour length or radius of gyration for identified domains in situ' },
    organism: 'Mus musculus for the 880 kb median; Homo sapiens for the 185 kb median and the loop count',
    organism_established: true,
    cell_type: 'mouse embryonic stem cells; human lymphoblastoid cells',
    evidence: 'Chromatin interaction frequency measured genome-wide and segmented into self-interacting intervals. Loop anchors coincide with domain boundaries and bind CTCF, with the CTCF motifs predominantly (>90%) convergent - which is a fact about orientation, and a strong one, independent of any domain size.',
    source: 'dixon_2012',
    also_sources: ['rao_2014'],
    firmness: 'INFERRED',
    verified_how: 'Fetched PMC3356448 full text and read back "identified 2,200 topological domains in mESCs with a median size of 880kb" and that the domains "occupy ~91% of the genome". Fetched PubMed metadata for PMID 25497547 and read back "genomes are partitioned into contact domains (median length, 185 kb)", "We identify ~10,000 loops", and "CTCF sites at loop anchors occur predominantly (>90%) in a convergent orientation".',
    what_a_viewer_gets_right_here: 'That the genome is partitioned into self-interacting neighbourhoods with CTCF-marked boundaries, and that the boundaries are oriented. What it cannot get right is the shape or thickness of a loop, because contact frequency is not geometry.',
  },
  {
    id: 'mitotic_chromosome',
    name: 'mitotic chromosome',
    dimension: {
      value: null, units: 'nm',
      null_reason: 'No measured overall chromosome width or chromatid diameter was retrieved. The one study that dissected a whole metaphase chromosome at 10 nm reports its chromosome length and index only in a supplementary figure that was not retrieved, and reports no width in its text.',
      what_would_resolve_it: 'the supplementary measurements of wako_2020, or any imaging study reporting metaphase chromatid width in a named organism and cell type',
      what_is_measurable_from_what_was_retrieved: '224 serial cross-sections at a 10 nm step span 2.24 um along the dissection direction. That is a fact about the dataset, not a stated chromosome dimension, and is not offered here as one.',
    },
    chromatin_volume_fraction: {
      value: 0.19, units: 'fraction of chromosome volume occupied by chromatin fibres', source: 'wako_2020',
      and_an_independent_estimate: { value: 0.42, uncertainty: 0.025, range: [0.35, 0.47], source: 'ou_2017', what: 'chromatin volume concentration in mitotic human U2OS cells by electron tomography' },
      disagreement: '19% by focused-ion-beam SEM against 42 +/- 2.5% by ChromEM tomography, both on human metaphase chromatin. Not averaged: they are different stains, different preparations and different definitions of what counts as the fibre boundary. Keep both. The factor of two between them is the honest uncertainty on how full a mitotic chromosome is.',
    },
    bp_per_nm: { value: null, units: 'bp/nm', null_reason: 'Requires a chromosome length paired with its DNA content in the same preparation; neither retrieved study provides the pair.', what_would_resolve_it: 'a metaphase chromosome length for a named mouse chromosome, which would pair with the GENOME lengths below to give a linear density directly' },
    organism: 'Homo sapiens',
    organism_established: true,
    cell_type: 'HeLa cells for the focused-ion-beam dissection; U2OS cells for the tomography',
    evidence: 'A single metaphase chromosome dissected into 224 cross-sections at 10 nm intervals and imaged by SEM, giving a fibre diameter distribution and a chromatin volume fraction; and electron tomography of mitotic cells giving a chromatin volume concentration.',
    source: 'wako_2020',
    also_sources: ['ou_2017', 'eltsov_2008'],
    firmness: 'MEASURED_IN_SITU',
    verified_how: 'Fetched PubMed metadata for PMID 32488088 and PMC7265543 full text; read back "the mean value of diameters of the chromatin fibres was 16.9 +/- 8.2 nm", "The chromatin fibres occupied 19% of the chromosome volume", "We directly dissected the chromosome every 10-nm and observed 224 cross-section SEM images", and that the only dimension statement in the text is "Both the chromosome index and chromosome length measured (Suppl. Fig. 1) were the closest to those of human chromosome 20" - the measurement itself being in a supplementary figure that was not retrieved. Fetched PMC5646685 and read back "In mitotic chromosomes, CVCs range from 35% (E2) to 47% (D4), with a mean of 42 +/- 2.5%".',
    what_a_viewer_gets_right_here: 'That a metaphase chromosome is a dense, disordered mass of short irregular fibres, roughly a fifth to two fifths chromatin by volume, with no visible repeating architecture. What it should not draw is a coiled hierarchy of helices of helices; the one study that looked for higher-order periodicity in such a chromosome at 10 nm resolution did not find any.',
  },
]);

export const LEVEL_IDS = deepFreeze(LEVELS.map(l => l.id));

// ---------------------------------------------------------------------------- the thirty-nanometre problem

export const THE_THIRTY_NANOMETRE_PROBLEM = deepFreeze({
  one_sentence:
    'Regular 30 nm chromatin fibres are a reproducible, structurally solved property of reconstituted ' +
    'nucleosome arrays, and no method that looks inside an undisturbed nucleus has found them in bulk ' +
    'chromatin; so a viewer that draws a solenoid between the beads-on-a-string and the chromosome is ' +
    'drawing an in-vitro object in an in-vivo place.',

  what_is_not_in_dispute:
    'Four things. (1) Nucleosomes exist, wrap about 147 bp, and are spaced by short linkers. (2) Under ' +
    'low ionic strength and with linker histone present, purified nucleosome arrays fold into regular ' +
    'fibres whose diameter has been measured and whose structure has been reconstructed by cryo-EM. ' +
    '(3) Inside a cell, chromatin is dense - between about a fifth and a half of the local volume - and ' +
    'irregular. (4) Chromatin is not static: single nucleosomes in living mammalian cells move about ' +
    '50 nm every 30 ms. No side of the argument disputes any of these.',

  what_is_actually_in_dispute:
    'Whether the regular fibre is a LEVEL OF ORGANISATION in a nucleus, or a state that purified ' +
    'chromatin adopts when it is diluted enough to have room to adopt it. The in-situ side does not ' +
    'claim the 30 nm fibre is a crystallographic error; the Maeshima reviews say explicitly that ' +
    'chromatin ranges "from an extended 10-nm fiber, to a folded 30-nm fiber, to chromatin ' +
    'condensates" depending on the ionic environment. The claim is narrower and harder to escape: in a ' +
    'nucleus at physiological crowding, the 10 nm chain is interdigitated with its neighbours rather ' +
    'than folded on itself, so there is no 30 nm repeat to find.',

  the_evidence_for_the_fibre:
    'Finch and Klug 1976 saw extracted nucleofilaments of about 100 A condense, in 0.2 mM magnesium, ' +
    'into a solenoid of pitch about 110 A, and correlated it with a 300 A thread reported by others - ' +
    'note that the famous 30 nm is the correlated thread, not the measured pitch. Robinson and ' +
    'colleagues in 2006 reconstituted long regular fibres with defined linkers and measured two ' +
    'discrete diameter classes, 33 nm and 44 nm, at unexpectedly high nucleosome densities of 11 and ' +
    '15 nucleosomes per 11 nm. Schalch and colleagues solved a tetranucleosome at 9 A, and Song and ' +
    'colleagues reconstructed a whole fibre at 11 A showing a linker-histone-dependent left-handed ' +
    'twist of tetranucleosomal units. These are real measurements of a real object.',

  the_evidence_against_it_being_in_cells:
    'Eltsov and colleagues in 2008 imaged high-pressure-frozen human mitotic cells by cryo-electron ' +
    'microscopy of vitreous sections, with no stain, no fixative and the contrast transfer function ' +
    'computationally corrected, and found a homogeneous grainy texture with no visible 30 nm fibres ' +
    'and no 30 nm signal in the power spectra. Joti and colleagues in 2012 applied small-angle X-ray ' +
    'scattering, which detects periodicity in non-crystalline material without imaging it at all, and ' +
    'found no structural feature larger than 11 nm anywhere up to a chromosome-diameter scale of about ' +
    'a micrometre, with the same result in interphase nuclei up to about 275 nm. Ou and colleagues in ' +
    '2017 stained DNA with a dye that polymerises into an electron-dense deposit and did tomography on ' +
    'intact cells, and found a disordered curvilinear chain of 5 to 24 nm. Three methods with ' +
    'different failure modes agree.',

  the_study_that_splits_the_difference:
    'Wako and colleagues in 2020 dissected a single human metaphase chromosome every 10 nm into 224 ' +
    'cross-sections by focused ion beam and SEM. They found both 11 nm and 30 nm fibres. But the mean ' +
    'diameter was 16.9 nm with a standard deviation of 8.2 nm, the majority lay between 5 and 25 nm, ' +
    'fibres at 30 nm were a minority, and no higher-order periodical structure was detectable. The ' +
    'title is the fairest summary anyone has written: a chromosome of randomly arranged fibres with UP ' +
    'TO 30 nm diameter. "Up to" is not "of".',

  why_the_textbook_figure_persists:
    'Because it is the only level of the hierarchy that explains how you get from a 10 nm chain to a ' +
    'micrometre-scale chromosome in a tidy number of steps, and because a diagram needs a step there. ' +
    'The in-situ answer - that the chain is irregular, interdigitated, locally fluid and compacted by ' +
    'crowding rather than by folding - is correct and undrawable. The 30 nm solenoid survives because ' +
    'it is illustratable, which is exactly the wrong reason for a viewer to adopt it.',

  what_a_viewer_should_therefore_draw: [
    'Draw a chain of nucleosomes whose apparent thickness VARIES along its length within 5-24 nm, not a fibre of one diameter.',
    'Do not draw a solenoid, a zigzag, or any repeating higher-order coil in a nucleus. There is no measured periodicity above about 11 nm in situ to justify one.',
    'Compact by crowding: let neighbouring chains interdigitate and fill the volume, rather than by winding one chain onto itself. That is the in-situ picture and it is also easier to generate.',
    'Target a chromatin volume fraction, which IS measured: about 30% (range 12-52%) in an interphase nucleus and about 42% (range 35-47%) in a mitotic chromosome.',
    'If the regular 30 nm fibre is shown at all, show it as a labelled in-vitro inset - a reconstitution in a test tube - at 33 nm or 44 nm according to linker length, never as a rung of the in-vivo ladder.',
    'Animate it. A still frame of chromatin at any diameter implies a rigidity that single-nucleosome tracking in living cells contradicts at about 50 nm per 30 ms.',
    'Say on the screen which rungs are measured and which are generated. The whole purpose of separating this module from the renderer is that the answer can be shown rather than assumed.',
  ],

  what_would_settle_it:
    'A method that resolves individual chromatin fibres in an unperturbed nucleus AND tests for a 30 nm ' +
    'periodicity in the same data, over a volume large enough to contain many repeats. ChromEM ' +
    'tomography is the closest existing instrument and it reports against. A positive result from a ' +
    'method with different artefacts - not another reconstitution - is what would move this entry off ' +
    'CONTESTED.',

  sources_for_the_fibre: deepFreeze(['finch_klug_1976', 'robinson_2006', 'schalch_2005', 'song_2014']),
  sources_against_it_in_cells: deepFreeze(['eltsov_2008', 'joti_2012', 'ou_2017', 'maeshima_2014', 'maeshima_2020', 'prieto_maeshima_2019']),
  source_in_between: 'wako_2020',
  source_for_the_motion: 'nozaki_2013',
});

// ---------------------------------------------------------------------------- the mouse genome

export const GENOME = deepFreeze({
  organism: 'Mus musculus',
  strain: 'C57BL/6J',
  assembly_name: 'GRCm39',
  accession_refseq: 'GCF_000001635.27',
  accession_genbank: 'GCA_000001635.9',
  assembly_date: '2020-06',

  total_length_bp: { value: 2728206152, units: 'bp', what: 'total_sequence_length of the assembly, including gaps' },
  total_ungapped_length_bp: { value: 2654605538, units: 'bp', what: 'total_ungapped_length: 73,600,614 bp of the assembly is gap, i.e. 2.70% of it is not sequence' },

  chromosome_sequences_in_assembly: {
    value: 21, units: 'sequences',
    what: 'total_number_of_chromosomes as the assembly report states it: 19 autosomes plus both X and Y, because the reference carries both sex chromosomes.',
    not_the_same_as: 'the haploid chromosome number of an individual, which is 20 (19 autosomes plus one sex chromosome). A viewer that draws 21 chromosomes in a nucleus is drawing the assembly, not a cell.',
    mitochondrial_sequence_counted_separately: true,
  },

  longest_chromosome: { name: '1', length_bp: 195154279, units: 'bp' },
  second_longest_chromosome: { name: '2', length_bp: 181755017, units: 'bp' },
  x_chromosome_length_bp: 169476592,
  mitochondrial_length_bp: 16299,

  firmness: 'MEASURED_IN_VITRO',
  firmness_note: 'A genome assembly is a sequencing measurement, not a structural one. The length is as firm as the assembly, and 2.70% of it is gap.',
  verified_how:
    'Fetched https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000001635.27/dataset_report ' +
    'and read back: assembly name GRCm39, accession GCF_000001635.27 paired with GCA_000001635.9, organism ' +
    'Mus musculus (house mouse) strain C57BL/6J, total_sequence_length "2728206152", total_ungapped_length ' +
    '"2654605538", total_number_of_chromosomes 21. That report carries no per-chromosome lengths, so also ' +
    'fetched https://rest.ensembl.org/info/assembly/mus_musculus and read back assembly_name GRCm39, ' +
    'assembly_accession GCA_000001635.9, assembly_date 2020-06, and the top-level lengths, of which ' +
    'chromosome 1 at 195154279 bp is the longest, chromosome 2 at 181755017 bp the second, X at 169476592 bp ' +
    'and MT at 16299 bp. The two services agree on the assembly identity.',
  sources: deepFreeze(['ncbi_datasets_grcm39', 'ensembl_grcm39']),
});

// ---------------------------------------------------------------------------- the nucleus to fit it into

export const NUCLEAR_SPACE = deepFreeze({
  mouse_nuclear_diameter: {
    value: null, units: 'um',
    null_reason: 'No primary measurement of nuclear diameter or nuclear volume for a named Mus musculus cell type was retrieved in this session. Searches of PubMed for nuclear volume or nuclear size in mouse embryonic stem cells and fibroblasts returned nothing usable, and the one BioNumbers record found for a mammalian nucleus names no species, no cell type and no primary paper.',
    what_would_resolve_it: 'a light- or electron-microscopy study reporting nuclear volume or diameter for a stated mouse cell type with a stated method; mouse embryonic stem cells would be the right cell type, since the repeat-length and domain-size figures above are from them.',
    why_it_matters: 'It is the denominator of the headline comparison a viewer wants to make. Leaving it null means the comparison below is made with a borrowed, species-less figure and is labelled as such, rather than made with a confident number that is about nothing in particular.',
  },

  mammalian_tissue_culture_nuclear_volume: {
    value: 283, lo: 66, hi: 500, units: 'um^3',
    organism: null, organism_established: false,
    organism_note: 'The record says "Mammalian tissue culture cell". No species. No cell line. No method. The range spans a factor of 7.6.',
    firmness: 'TEXTBOOK_ONLY',
    source: 'bionumbers_100442',
    verified_how: 'Fetched https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100442 and read back: property "Nuclear volume", organism "Mammalian tissue culture cell", value 283 um^3, range 66-500 um^3, reference "Roskams and Rodgers, LabRef", no method listed, no comments. A laboratory reference book is a textbook.',
    use_only_for: 'showing the SHAPE of the packing comparison. Not for any number a viewer displays as a fact about a mouse.',
  },

  interphase_chromatin_volume_concentration: {
    value: 0.30, uncertainty: 0.10, lo: 0.12, hi: 0.52, units: 'fraction of nuclear volume occupied by chromatin',
    organism: 'Homo sapiens', organism_established: true, cell_type: 'small-airway epithelial cells, interphase',
    firmness: 'MEASURED_IN_SITU',
    source: 'ou_2017',
    verified_how: 'Read back from PMC5646685: "In interphase SAECs, CVCs range from 12% (D7) to 52% (B1), with a mean value of 30 +/- 10%."',
    why_this_is_the_better_denominator: 'It is a measured occupancy rather than a geometric assumption, it comes from the same technique as the fibre diameters above, and it is the quantity a generated depiction can actually be tuned to match.',
  },

  mitotic_chromatin_volume_concentration: {
    value: 0.42, uncertainty: 0.025, lo: 0.35, hi: 0.47, units: 'fraction of chromosome volume occupied by chromatin',
    organism: 'Homo sapiens', organism_established: true, cell_type: 'U2OS osteosarcoma cells, mitotic',
    firmness: 'MEASURED_IN_SITU',
    source: 'ou_2017',
    verified_how: 'Read back from PMC5646685: "In mitotic chromosomes, CVCs range from 35% (E2) to 47% (D4), with a mean of 42 +/- 2.5%".',
    disagrees_with: 'wako_2020, which reports 19% for the same quantity in a human metaphase chromosome by a different method. Both are kept; see LEVELS mitotic_chromosome.',
  },

  nucleosome_motion_in_living_cells: {
    value: 50, units: 'nm per 30 ms',
    organism: 'mammalian cells, species not stated in the abstract', organism_established: false,
    firmness: 'MEASURED_IN_VIVO',
    source: 'nozaki_2013',
    verified_how: 'Read back from the PubMed abstract of PMID 23945462: "We observed local nucleosome fluctuation (~50 nm movement/30 ms) caused by Brownian motion" in living mammalian cells. The abstract does not name the species, so the organism is marked unestablished.',
    what_it_means_for_a_viewer: 'A nucleosome sweeps a distance comparable to a 30 nm fibre diameter in the time between two frames at 30 fps. Any still depiction of chromatin architecture is a time average that nothing in the cell ever looks like.',
  },
});

// ---------------------------------------------------------------------------- arithmetic

/**
 * The physical length of `bp` base pairs of B-DNA, in METRES.
 *
 * Default rise is the least-squares value fitted to the 1BNA coordinates in this session, 3.341 A/bp.
 * Pass `rise_m` to use another of RISE_PER_BP_ALTERNATIVES_M; the textbook 3.4 A gives answers 1.8%
 * larger, which over a mouse genome is 16 mm.
 */
export function contourLength(bp, { rise_m = RISE_PER_BP_M } = {}) {
  if (typeof bp !== 'number' || !Number.isFinite(bp) || bp < 0) {
    throw new Error(`contourLength needs a finite non-negative base-pair count, got ${typeof bp === 'number' ? bp : typeof bp}`);
  }
  if (typeof rise_m !== 'number' || !Number.isFinite(rise_m) || rise_m <= 0) {
    throw new Error(`rise_m must be a positive finite length in metres, got ${rise_m}`);
  }
  return bp * rise_m;
}

/** The same length across every retrieved rise value, so the choice is visible instead of hidden. */
export function contourLengthRange(bp) {
  const out = {};
  for (const [k, v] of Object.entries(RISE_PER_BP_ALTERNATIVES_M)) out[k] = contourLength(bp, { rise_m: v });
  const vals = Object.values(out);
  return { metres: out, lo: Math.min(...vals), hi: Math.max(...vals), spread_fraction: (Math.max(...vals) - Math.min(...vals)) / Math.min(...vals) };
}

/**
 * The volume a given number of base pairs occupies as a bare B-DNA cylinder, in cubic metres.
 * Radius is half the PHOSPHATE width (20.4 A / 2), which is the narrower of the two retrieved widths
 * and therefore the conservative choice for a "DNA alone takes up this little room" argument.
 */
export function bareDnaVolume(bp, { radius_m = (B_DNA.phosphate_width_angstrom.value / 2) * 1e-10, rise_m = RISE_PER_BP_M } = {}) {
  if (typeof bp !== 'number' || !Number.isFinite(bp) || bp < 0) throw new Error(`bareDnaVolume needs a finite non-negative base-pair count, got ${bp}`);
  return bp * Math.PI * radius_m * radius_m * rise_m;
}

/**
 * Packing ratio of a level: the contour length of B-DNA held per unit length of that level's own axis.
 *
 * This is DIVISION, not a score, and it exists for exactly the levels that have a measured linear
 * density. Most do not, and those return `{ value: null, null_reason, what_would_resolve_it }` rather
 * than a plausible figure. Refusing five of seven rungs is the correct behaviour of this function and
 * not a deficiency to be filled in later with something from a diagram.
 */
export function packingRatio(level) {
  const L = typeof level === 'string' ? LEVELS.find(l => l.id === level) : level;
  if (!L) return { level: typeof level === 'string' ? level : null, value: null, null_reason: `no level with id "${level}"; ids are ${LEVEL_IDS.join(', ')}`, what_would_resolve_it: 'use one of the listed ids' };

  const d = L.bp_per_nm;
  if (!d || d.value === null || d.value === undefined) {
    return {
      level: L.id, value: null, units: 'dimensionless',
      null_reason: d?.null_reason ?? 'this level records no base pairs per nanometre',
      what_would_resolve_it: d?.what_would_resolve_it ?? 'a measured linear density for this level',
      firmness: L.firmness,
    };
  }

  // contour length of the DNA in one nanometre of this level's axis, divided by that one nanometre
  const value = d.value * (RISE_PER_BP_M / 1e-9);
  return {
    level: L.id,
    value,
    units: 'dimensionless (contour length of B-DNA per unit length of this level)',
    bp_per_nm: d.value,
    how: `${d.value} bp/nm x ${B_DNA.rise_per_bp_angstrom.value} A/bp = ${value.toFixed(2)}-fold compaction of contour length`,
    firmness: L.id === 'b_dna' ? L.firmness : 'DERIVED',
    carries_the_weakness_of: d.the_splice_is_the_weakness ?? d.what ?? null,
  };
}

/** Compaction of the DNA wrapped on one core particle against the disc thickness. A single particle, so stated separately from packingRatio. */
export function coreParticleCompaction() {
  const ncp = LEVELS.find(l => l.id === 'nucleosome_core_particle');
  const wrapped_m = contourLength(ncp.bp_wrapped.value);
  const height_m = ncp.height_angstrom.value * 1e-10;
  return {
    wrapped_bp: ncp.bp_wrapped.value,
    wrapped_contour_nm: wrapped_m * 1e9,
    disc_height_nm: height_m * 1e9,
    compaction: wrapped_m / height_m,
    how: '147 bp of B-DNA at 3.341 A/bp is 49.11 nm of contour, held within a disc 5.15 nm thick.',
    firmness: 'DERIVED',
    caution: 'This is compaction measured ACROSS the disc, which is not the same quantity as a fibre packing ratio and must not be compared with one. The figure near 6 that circulates for "the nucleosome" uses a different denominator.',
  };
}

/**
 * The hand-worked case: the mouse genome as naked B-DNA, against the space it has to fit into.
 * Every input is an entry above, and the borrowed nuclear volume is flagged on the way through.
 */
export function mouseGenomeVsNucleus() {
  const bp = GENOME.total_length_bp.value;
  const haploid_m = contourLength(bp);
  const diploid_m = haploid_m * 2;
  const range = contourLengthRange(bp);

  const nucVol_um3 = NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.value;
  const nucVol_m3 = nucVol_um3 * 1e-18;
  const sphere_equiv_diameter_m = Math.cbrt((6 * nucVol_m3) / Math.PI);

  const haploid_dna_m3 = bareDnaVolume(bp);
  const diploid_dna_m3 = haploid_dna_m3 * 2;
  const diploid_fill = diploid_dna_m3 / nucVol_m3;

  const cvc = NUCLEAR_SPACE.interphase_chromatin_volume_concentration.value;
  const nrl = LEVELS.find(l => l.id === 'linker_and_repeat').nucleosome_repeat_length_bp.value;

  return {
    genome: { assembly: GENOME.assembly_name, accession: GENOME.accession_refseq, bp },

    contour_length: {
      haploid_m, diploid_m,
      haploid_m_stated: `${haploid_m.toFixed(4)} m`,
      across_rise_values: range,
      firmness: 'DERIVED',
      inputs: ['GENOME.total_length_bp (NCBI Datasets)', 'B_DNA.rise_per_bp_angstrom (computed from PDB 1BNA)'],
    },

    longest_chromosome_contour: {
      chromosome: GENOME.longest_chromosome.name,
      bp: GENOME.longest_chromosome.length_bp,
      metres: contourLength(GENOME.longest_chromosome.length_bp),
      stated: `${(contourLength(GENOME.longest_chromosome.length_bp) * 1000).toFixed(2)} mm`,
    },

    the_container: {
      volume_um3: nucVol_um3,
      sphere_equivalent_diameter_um: sphere_equiv_diameter_m * 1e6,
      BORROWED: true,
      caveat: NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.organism_note,
      firmness: 'TEXTBOOK_ONLY',
      and_the_mouse_value_is: NUCLEAR_SPACE.mouse_nuclear_diameter.null_reason,
    },

    linear_comparison: {
      ratio: haploid_m / sphere_equiv_diameter_m,
      stated: `a haploid mouse genome stretched out is about ${Math.round(haploid_m / sphere_equiv_diameter_m / 1000)} thousand times the width of the nucleus it sits in`,
      firmness: 'DERIVED',
      honesty: 'The nuclear width here is species-less. The ratio is the right order of magnitude and should be quoted as such, not to three figures.',
    },

    volume_comparison: {
      diploid_bare_dna_um3: diploid_dna_m3 * 1e18,
      nuclear_volume_um3: nucVol_um3,
      fraction_of_nucleus_as_bare_dna: diploid_fill,
      measured_chromatin_volume_concentration: cvc,
      ratio_chromatin_to_bare_dna: cvc / diploid_fill,
      the_point:
        'Bare DNA cylinders for a diploid mouse genome come to about ' + (diploid_dna_m3 * 1e18).toFixed(1) +
        ' um^3, roughly ' + (diploid_fill * 100).toFixed(1) + '% of a nucleus of this volume. But chromatin is ' +
        'measured to occupy about ' + (cvc * 100).toFixed(0) + '% of an interphase nucleus - something like ' +
        (cvc / diploid_fill).toFixed(0) + ' times more volume than the DNA itself. The nucleus is not a box ' +
        'crammed to bursting with thread; it is mostly protein, water and space, with the thread taking up a ' +
        'few per cent of it. A viewer that fills the nucleus with tightly packed DNA to convey "how much there ' +
        'is" overstates the crowding by an order of magnitude, and a viewer that draws it sparse understates it. ' +
        'The measured 30% is the target.',
      firmness: 'DERIVED',
      inputs: ['GENOME.total_length_bp', 'B_DNA.phosphate_width_angstrom', 'B_DNA.rise_per_bp_angstrom', 'NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume (TEXTBOOK_ONLY)', 'NUCLEAR_SPACE.interphase_chromatin_volume_concentration (MEASURED_IN_SITU)'],
    },

    nucleosome_count: {
      diploid: (2 * bp) / nrl,
      repeat_length_bp: nrl,
      organism: 'Mus musculus, embryonic stem cells, over polymerase-bound regions',
      firmness: 'DERIVED',
      caution: 'A repeat length measured over one class of genomic region, applied to a whole genome. It shifts by 5-7 bp on differentiation, so this count is good to a few per cent at best and is a property of a cell state.',
    },
  };
}

// ---------------------------------------------------------------------------- what we got wrong

export const WHAT_WE_GOT_WRONG = deepFreeze({
  what_happened:
    'The first draft of this module recorded the nucleosome as wrapping its DNA in 1.65 superhelical ' +
    'turns, because that is the figure in every account of the structure and it was going to be used to ' +
    'generate the wrap in the viewer. To check it rather than copy it, the deposited coordinates of ' +
    'both core-particle structures were downloaded and the azimuth of one DNA strand about the fitted ' +
    'superhelical axis was integrated. The answer was 1.810 turns in the 146 bp particle and 1.805 in ' +
    'the 147 bp one - a 9% discrepancy, consistent between two independent crystals.',
  why_it_mattered:
    'A 9% error in turn count is a visible error in a rendered wrap, and more importantly the direction ' +
    'of the discrepancy was not obvious: it could have meant our axis fit was wrong, or that the 1.65 ' +
    'figure referred to something else.',
  what_the_resolution_probably_is:
    'Different definitions. The published figure describes the DNA tightly bound against the octamer; ' +
    'the integrated azimuth includes the entering and exiting segments, which flare away from the ' +
    'particle - the largest phosphate radius is 60.9 A against a mean of 42.2 A - while still sweeping ' +
    'azimuth about the axis. The two numbers are probably both right about different arcs of the same ' +
    'DNA.',
  what_we_did_about_it:
    'Not averaged them, not quietly adopted the famous one, and not asserted a reconciliation we did ' +
    'not verify. No primary sentence defining the 1.65 figure was retrieved in this session, so the ' +
    'entry asserts the computed 1.81 as a measurement, records 1.65 as the textbook figure, and states ' +
    'in the entry that the definitional difference is the likely explanation and was not confirmed.',
  the_general_lesson:
    'A number that is in every textbook is the kind most likely to be copied without a definition ' +
    'attached, and a definition is what makes a geometric figure reproducible. Recomputing from ' +
    'coordinates cost twenty minutes and turned one borrowed number into one measured number plus one ' +
    'honest open question. The borrowed number would have rendered a wrap that was wrong by a tenth of ' +
    'a turn and nobody would ever have found out.',
  the_second_lesson:
    'The same recomputation caught two smaller things that would each have gone into a viewer unchecked. ' +
    'The rise per base pair is 3.341 A, not 3.4 A - 1.8% low, which is 16 mm over a mouse genome. And ' +
    'the "2 nm" duplex width is the phosphate-to-phosphate spacing, 20.4 A; the heavy-atom envelope is ' +
    '22.8 A. Both are small. Both are the kind of small that a zoomable viewer accumulates.',
});

export const KNOWN_LIMITATIONS = deepFreeze([
  'Five of the seven levels have no measured base pairs per nanometre, so packingRatio() refuses five of ' +
  'seven rungs. The classical packing ratios for those rungs exist only as diagram arithmetic, and ' +
  'reproducing them here would have meant inventing the linear densities they were computed from.',
  'There is no measured nuclear diameter or nuclear volume for any named mouse cell type in this module. ' +
  'The packing comparison therefore runs on a species-less laboratory-reference figure of 283 um^3, ' +
  'flagged TEXTBOOK_ONLY and flagged again inside the result. Every ratio that depends on it should be ' +
  'quoted to one significant figure.',
  'The 30 nm fibre linear density spliced into bp_per_nm multiplies an in-vitro nucleosome density by an ' +
  'in-vivo repeat length. The splice is named on the entry. It describes what the textbook fibre WOULD ' +
  'compact to if it were in a mouse nucleus, which is not a claim that it is.',
  'Almost every in-situ measurement here is from cultured human cells - small-airway epithelial, ' +
  'osteosarcoma, HeLa, lymphoblastoid. Transformed and immortalised lines are not ordinary cells and ' +
  'their chromatin need not be ordinary either. A mouse-specific in-situ fibre diameter would be worth ' +
  'more than any of them for this repo and does not appear to exist.',
  'Every in-vitro 30 nm structure here is a reconstitution. A reconstitution has no cell type, no ' +
  'growth state and no genome, and the best linear-density measurement among them was made on a ' +
  'non-mammalian histone preparation. The organism field for that level is marked unestablished rather ' +
  'than guessed.',
  'The mitotic chromosome has no dimension in this module at all. The one study that dissected a whole ' +
  'metaphase chromosome at 10 nm resolution reports its length only in a supplementary figure that was ' +
  'not retrieved, and its text states no width. The 224-slice stack spans 2.24 um, which is a fact ' +
  'about the dataset and is deliberately not offered as a chromosome diameter.',
  'Domain sizes are sequencing-derived. "Topological domain" at 880 kb and "contact domain" at 185 kb ' +
  'are different segmentations of different assays and are kept as a disagreement, not reconciled. ' +
  'Neither has a physical thickness, so neither can be drawn to scale without an assumption this ' +
  'module does not supply.',
  'The chromatin volume fraction of a mitotic chromosome is 19% by one method and 42 +/- 2.5% by ' +
  'another, both in human cells. The factor of two is unresolved and both are carried.',
  'Nothing here is dynamic. Chromatin in a living cell moves ~50 nm per 30 ms; this module records that ' +
  'one number and otherwise describes time-averaged structure. A viewer built only on these numbers ' +
  'will be a correct picture of something that never holds still.',
]);

// ---------------------------------------------------------------------------- the printout

export function worked() {
  const w = mouseGenomeVsNucleus();
  const lines = [];
  lines.push('chromatin.mjs - the packing hierarchy, with its firmness attached');
  lines.push('');
  lines.push('LEVELS');
  for (const L of LEVELS) {
    const d = L.dimension.value === null ? `null (${L.dimension.null_reason.slice(0, 70)}...)` : `${L.dimension.value} ${L.dimension.units}`;
    lines.push(`  ${L.id.padEnd(26)} ${String(d).padEnd(46)} ${L.firmness}`);
    const pr = packingRatio(L);
    lines.push(`    packing ratio: ${pr.value === null ? `refused - ${pr.null_reason.slice(0, 80)}` : pr.value.toFixed(1) + 'x'}`);
  }
  lines.push('');
  lines.push('THE THIRTY NANOMETRE PROBLEM');
  lines.push('  ' + THE_THIRTY_NANOMETRE_PROBLEM.one_sentence.replace(/\s+/g, ' '));
  lines.push('');
  lines.push(`GENOME  ${GENOME.organism} ${GENOME.strain}  ${GENOME.assembly_name} (${GENOME.accession_refseq})`);
  lines.push(`  ${GENOME.total_length_bp.value.toLocaleString()} bp total, ${GENOME.total_ungapped_length_bp.value.toLocaleString()} bp ungapped`);
  lines.push(`  ${GENOME.chromosome_sequences_in_assembly.value} chromosome sequences in the assembly; longest is chromosome ${GENOME.longest_chromosome.name} at ${GENOME.longest_chromosome.length_bp.toLocaleString()} bp`);
  lines.push('');
  lines.push('THE HAND-WORKED CASE');
  lines.push(`  haploid genome as naked B-DNA        ${w.contour_length.haploid_m.toFixed(4)} m`);
  lines.push(`  diploid                              ${w.contour_length.diploid_m.toFixed(4)} m`);
  lines.push(`  across the three retrieved rises     ${w.contour_length.across_rise_values.lo.toFixed(4)} - ${w.contour_length.across_rise_values.hi.toFixed(4)} m`);
  lines.push(`  chromosome ${GENOME.longest_chromosome.name} alone                    ${w.longest_chromosome_contour.stated}`);
  lines.push(`  nucleus (BORROWED, species-less)     ${w.the_container.volume_um3} um^3 -> ${w.the_container.sphere_equivalent_diameter_um.toFixed(2)} um sphere-equivalent`);
  lines.push(`  linear ratio                         ~${Math.round(w.linear_comparison.ratio / 1000)}e3 x`);
  lines.push(`  diploid bare DNA volume              ${w.volume_comparison.diploid_bare_dna_um3.toFixed(2)} um^3 = ${(w.volume_comparison.fraction_of_nucleus_as_bare_dna * 100).toFixed(1)}% of that nucleus`);
  lines.push(`  measured chromatin occupancy         ${(w.volume_comparison.measured_chromatin_volume_concentration * 100).toFixed(0)}% - i.e. ${w.volume_comparison.ratio_chromatin_to_bare_dna.toFixed(0)}x the DNA's own volume`);
  lines.push(`  nucleosomes, diploid                 ${(w.nucleosome_count.diploid / 1e6).toFixed(1)} million at a ${w.nucleosome_count.repeat_length_bp} bp repeat`);
  lines.push('');
  lines.push('WHAT A VIEWER SHOULD DRAW');
  for (const s of THE_THIRTY_NANOMETRE_PROBLEM.what_a_viewer_should_therefore_draw) lines.push(`  - ${s}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('chromatin.mjs')) {
  console.log(worked());
}
