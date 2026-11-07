#!/usr/bin/env node
// budget.mjs - HOW FULL IS A CELL? THE VOLUME AND CROWDING AUDIT THE VIEWER HAS TO OBEY.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// The molecular viewer this repo is building zooms from an embryo down to a single machine on a
// chromosome. The POSITIONS it draws are generated - a depiction, not a physics simulation - and the
// viewer says so on its face. This file is the other half of that bargain: every number that sets a
// SIZE, a COUNT, a SPACING or a FRACTION here is a measured value with a retrieved source, so a reader
// can separate what the picture gets right from what it invents.
//
// The specific failure this file exists to prevent is the one every textbook illustration commits:
// A CELL INTERIOR DRAWN AS MOSTLY EMPTY SPACE, with a dozen tidy organelles floating in clear fluid and
// visible gaps between them. That picture is not a simplification, it is wrong in a way that changes
// what a reader believes. Cytoplasm is a concentrated macromolecular solution. The measured numbers:
//
//   - Macromolecules in the cytoplasm of a microbe: 0.3 to 0.4 GRAMS PER MILLILITRE (Zimmerman & Trach
//     1991, by extraction with a sucrose-impermeability correction). Not milligrams. Grams.
//   - Protein in a mammalian cell: about 0.2 g/mL (compiled in Milo 2013), which by the specific volume
//     this file derives from a complete deposited structure means 9-19% of the cell volume is protein
//     before you have drawn a single ribosome, membrane, filament or RNA.
//   - Mean centre-to-centre spacing between protein molecules in a measured mammalian cytoplasm: about
//     EIGHT AND A HALF NANOMETRES (`MEAN_SPACING`, computed from 1.53e6 proteins/um^3 for one cell
//     line). A mid-sized globular protein is 4-6 nm across. The gap between neighbours averages roughly
//     one protein diameter. There is nowhere in a cell where you could draw clear fluid.
//
// The second failure is arithmetic, and this file was itself caught committing it. See THE_CUBE_TRAP.
//
// ============================== WHAT IT DELIBERATELY WILL NOT DO ==============================
// It renders nothing and imports nothing. It returns no single fused "crowding score": a volume
// fraction and a mass concentration are different quantities measured by different methods, and the
// conversion between them needs a specific volume that is itself uncertain by better than a factor of
// two (see `SPECIFIC_VOLUME`). So every occupancy here is reported as an INTERVAL with both ends
// labelled by the assumption that produced it, and a caller that wants one number has to pick an end
// and say so.
//
// It also does not average disagreeing sources. The count of ribosomes in one human cell line spans
// 3.3 to 9.5 million across two primary measurements twenty-eight years apart, and the figure most
// often quoted - four million - traces to a reagent vendor's web table, not to a measurement. All three
// are recorded, with that provenance attached. See RIBOSOME_COUNT_DISAGREEMENT.
//
// ============================== THE HOUSE EPISTEMIC RULES, APPLIED ==============================
//   - Every entry carries `verified_how`: exactly what was fetched this session and what was read back.
//   - A number that could not be retrieved is `{ value: null, units, null_reason, what_would_resolve_it }`.
//     There are several. A null with a reason is worth more than a plausible number.
//   - Organism and cell type are named on every count and every rate. A count per cell is not a property
//     of a species; it is a property of a cell type in a growth state. Where the cell type behind a
//     figure could not be established, the entry says so (`cell_type_established: false`).
//   - Where the geometry could be computed from coordinates rather than quoted, it was: the rise per base
//     pair of B-DNA, the occupied volume of a ribosome, of a nucleosome and of a transcription
//     pre-initiation complex were all measured here from deposited structures downloaded this session.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). Nothing in this file is
// drawn from it, and no member of it is named. Run `node holdout/check-leaks.mjs sim-engine/scales/molecular`.
//
//   node sim-engine/scales/molecular/budget.mjs       # print worked()
//   node sim-engine/scales/molecular/test-budget.mjs  # the tests

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

// ---------------------------------------------------------------------------- units, stated once

/**
 * The unit conversions, written down because getting one of them wrong is the single likeliest way this
 * file could produce a confident, catastrophic number. See THE_CUBE_TRAP: a linear factor of 1000
 * between nanometres and micrometres is a factor of 1e9 between their cubes, and an occupancy computed
 * with 1e3 instead of 1e9 comes out a million times too large and still looks like a percentage.
 */
export const UNITS = deepFreeze({
  nm3_per_um3: 1e9,            // (1000 nm / um)^3
  cm3_per_um3: 1e-12,
  A3_per_nm3: 1000,            // (10 A / nm)^3
  /**
   * Grams per dalton. NOT a measurement: since the 2019 SI redefinition the Avogadro constant is exactly
   * 6.02214076e23 mol^-1, so one dalton is exactly (1 g/mol) / N_A. Stated as a definition so that no
   * reader has to wonder whether it was retrieved.
   */
  avogadro_exact: 6.02214076e23,
  gram_per_dalton: 1 / 6.02214076e23,
});

// ---------------------------------------------------------------------------- citations

export const CITATIONS = deepFreeze({
  zimmerman_trach_1991:
    'Zimmerman, S.B. & Trach, S.O. (1991) Estimation of macromolecule concentrations and excluded volume ' +
    'effects for the cytoplasm of Escherichia coli. J Mol Biol 222:599-620. doi:10.1016/0022-2836(91)90499-v ' +
    '(PMID 1748995). Macromolecule concentration in the cytoplasm measured at 0.3-0.4 g/mL, exponential or ' +
    'stationary phase, with the extraction dilution corrected using the known sucrose-impermeability of the ' +
    'cytoplasmic volume.',
  luby_phelps_2000:
    'Luby-Phelps, K. (2000) Cytoarchitecture and physical properties of cytoplasm: volume, viscosity, ' +
    'diffusion, intracellular surface area. Int Rev Cytol 192:189-221. doi:10.1016/s0074-7696(08)60527-6 ' +
    '(PMID 10553280). Review; its abstract states that the aqueous phase of cytoplasm "is crowded rather ' +
    'than dilute" and that as much as half the cellular protein may be in a solid phase.',
  milo_2013:
    'Milo, R. (2013) What is the total number of protein molecules per cell volume? A call to rethink some ' +
    'published values. BioEssays 35:1050-1055. doi:10.1002/bies.201300066 (PMID 24114984, PMC3910158). ' +
    'Estimates 2-4 million proteins per cubic micron for microbes, yeast and mammalian cells; reports a ' +
    'mammalian protein density of about 0.2 g/mL and mammalian cell-line volumes of 2,000-4,000 um^3; ' +
    'finds measured proteomics values for mammalian cells 3-10x LOWER than the estimate and says so.',
  chen_2023:
    'Chen, Y., Hulsmann, J.E., et al. (2023) Estimating Total Quantitative Protein Content in Escherichia ' +
    'coli, Saccharomyces cerevisiae, and HeLa Cells. Int J Mol Sci 24:2081. (PMC9916689). Compiles total ' +
    'protein copies per cell from eight independent proteomics studies of one human cell line (2.0e9 to ' +
    '8.2e9), adopts a cell volume of 2425 um^3 for it, and reports 1,525,243 protein copies per um^3. Also ' +
    'the source of the three ribosome counts and their provenance.',
  zlotek_zlotkiewicz_2015:
    'Zlotek-Zlotkiewicz, E., Monnier, S., Cappello, G., Le Berre, M. & Piel, M. (2015) Optical volume and ' +
    'mass measurements show that mammalian cells swell during mitosis. J Cell Biol 211:765-774. ' +
    'doi:10.1083/jcb.201505056 (PMID 26598614, PMC4657168). Adherent cells of one human line increase ' +
    'volume 20.7 +/- 0.7% (n=60) at mitotic onset; prerounded cells of the same line 17.5 +/- 0.8% (n=14).',
  deviri_safran_2022:
    'Deviri, D. & Safran, S.A. (2022) Balance of osmotic pressures determines the nuclear-to-cytoplasmic ' +
    'volume ratio of the cell. Proc Natl Acad Sci USA 119:e2118301119. doi:10.1073/pnas.2118301119 ' +
    '(PMID 35580183, PMC9173802). Uses a human nuclear volume of ~1,000 um^3 and computes the ' +
    'corresponding spherical radius of 6.2 um; attributes the volume to Guo et al. 2017.',
  guo_2017:
    'Guo, M. et al. (2017) Cell volume change through water efflux impacts cell stiffness and stem cell ' +
    'fate. Proc Natl Acad Sci USA 114:E8618-E8627. doi:10.1073/pnas.1705179114 (PMID 28973866). The ' +
    'source Deviri & Safran cite for the ~1,000 um^3 nuclear volume. NOT open access; could not be read ' +
    'this session, so the cell type behind that figure is not established here.',
  duncan_hershey_1983:
    'Duncan, R. & Hershey, J.W. (1983) Identification and quantitation of levels of protein synthesis ' +
    'initiation factors in crude HeLa cell lysates by two-dimensional polyacrylamide gel electrophoresis. ' +
    'J Biol Chem 258:7228-7235 (PMID 6853516). Initiation-factor abundances of 1.1-9.8 million molecules ' +
    'per cell with factor-to-ribosome ratios of 0.8 (eIF-2), ~0.6 (eIF-3) and 3.0 (eIF-4A); the implied ' +
    'ribosome count, 3.3 million per cell, is the figure later compilations attribute to this paper.',
  wolf_schlessinger_1977:
    'Wolf, S.F. & Schlessinger, D. (1977) Nuclear metabolism of ribosomal RNA in growing, ' +
    'methionine-limited, and ethionine-treated HeLa cells. Biochemistry 16:2783-2791. ' +
    'doi:10.1021/bi00631a031 (PMID 889788). The source of the 9.5 million ribosomes per cell figure. ' +
    'PubMed carries no abstract for this entry and the full text was not retrievable this session, so the ' +
    'count was read from the compilation in Chen 2023, not from the paper.',
  bakshi_2012:
    'Bakshi, S., Siryaporn, A., Goulian, M. & Weisshaar, J.C. (2012) Superresolution imaging of ribosomes ' +
    'and RNA polymerase in live Escherichia coli cells. Mol Microbiol 85:21-38. ' +
    'doi:10.1111/j.1365-2958.2012.08081.x (PMID 22624875). Mean copy numbers per cell of 55,000 ribosomes ' +
    'and 4,600 RNA polymerases, counted by superresolution fluorescence in LIVE cells; 27,000 ribosomes ' +
    'per um^3 in rich medium at growth rate 1.11/h.',
  khatter_2015:
    'Khatter, H., Myasnikov, A.G., Natchiar, S.K. & Klaholz, B.P. (2015) Structure of the human 80S ' +
    'ribosome. Nature 520:640-645. doi:10.1038/nature14427 (PMID 25901680). PDB 4UG0, cryo-EM, average ' +
    'resolution 3.6 A (2.9 A in the most stable regions).',
  davey_2002:
    'Davey, C.A., Sargent, D.F., Luger, K., Maeder, A.W. & Richmond, T.J. (2002) Solvent mediated ' +
    'interactions in the structure of the nucleosome core particle at 1.9 A resolution. J Mol Biol ' +
    '319:1097-1113. doi:10.1016/S0022-2836(02)00386-8 (PMID 12079350). PDB 1KX5, a 147 base-pair ' +
    'nucleosome core particle.',
  drew_1981:
    'Drew, H.R., Wing, R.M., Takano, T., Broka, C., Tanaka, S., Itakura, K. & Dickerson, R.E. (1981) ' +
    'Structure of a B-DNA dodecamer: conformation and dynamics. Proc Natl Acad Sci USA 78:2179-2183. ' +
    'doi:10.1073/pnas.78.4.2179 (PMID 6941276). PDB 1BNA, 1.9 A. Reports a 19 degree bend in the helix ' +
    'axis over the 11 base-pair steps, and a mean 36.9 degrees of rotation per step (9.8 bp/turn) in the ' +
    'centre of the molecule where the perturbation is least.',
  he_2016:
    'He, Y., Yan, C., Fang, J., Inouye, C., Tjian, R., Ivanov, I. & Nogales, E. (2016) Near-atomic ' +
    'resolution visualization of human transcription promoter opening. Nature 533:359-365. PDB 5IYA, the ' +
    'human core pre-initiation complex in the closed state, cryo-EM at 5.4 A.',
  valouev_2011:
    'Valouev, A. et al. (2011) Determinants of nucleosome organization in primary human cells. Nature ' +
    '473:193-197. doi:10.1038/nature10002 (PMID 21602827, PMC3212987). Genome-average internucleosome ' +
    'spacing measured by phasogram in PRIMARY human cells: 193 bp in granulocytes (linker 46 bp) and ' +
    '10 bp wider in both T-cell types (linker 56 bp). Within-genome range: 178-187 bp at active ' +
    'promoters, 190-195 bp in active gene bodies, 205 bp in heterochromatin, 206 bp in silent genes.',
  adey_2013:
    'Adey, A. et al. (2013) The haplotype-resolved genome and epigenome of the aneuploid HeLa cancer cell ' +
    'line. Nature 500:207-211. doi:10.1038/nature12064 (PMID 23925245, PMC3740412). 61% of the genome of ' +
    'the CCL-2 strain sits at copy number three, with only 3% at CN>4 or CN<2: the line is hypertriploid, ' +
    'so a diploid genome length is the wrong input for it.',
  grch38p14:
    'GRCh38.p14, assembly accession GCF_000001405.40, Homo sapiens. NCBI Datasets dataset_report: ' +
    'total_sequence_length 3,099,441,038 bp; total_ungapped_length 2,948,318,359 bp; 24 chromosomes; ' +
    'GC 41%.',
  rcsb_4ug0: 'RCSB PDB entry 4UG0 (data.rcsb.org/rest/v1/core/entry/4UG0) and the coordinate file 4UG0.cif.gz.',
  rcsb_1kx5: 'RCSB PDB entry 1KX5 (data.rcsb.org/rest/v1/core/entry/1KX5) and the coordinate file 1KX5.pdb.',
  rcsb_1bna: 'RCSB PDB entry 1BNA (data.rcsb.org/rest/v1/core/entry/1BNA) and the coordinate file 1BNA.pdb.',
  rcsb_5iya: 'RCSB PDB entry 5IYA (data.rcsb.org/rest/v1/core/entry/5IYA) and the coordinate file 5IYA.cif.gz.',
  bondi_1964: 'Bondi, A. (1964) van der Waals volumes and radii. J Phys Chem 68:441-451. The radii used for every volume computed in this file; the same set this repo already uses in benchmarks/retro-validation/structure.mjs.',
  shrake_rupley_1973: 'Shrake, A. & Rupley, J.A. (1973) Environment and exposure to solvent of protein atoms. J Mol Biol 79:351-371. Source of the 1.4 A water probe radius used for the dilated-union volumes.',
});

// ---------------------------------------------------------------------------- how the volumes were got

/**
 * HOW EVERY STRUCTURE VOLUME IN THIS FILE WAS COMPUTED, and why it is an interval rather than a number.
 *
 * Deposited coordinate files were downloaded this session and the occupied volume computed twice, by
 * marking a regular grid inside the union of per-atom spheres:
 *
 *   vdw_union_nm3      spheres at the Bondi van der Waals radius. This UNDERESTIMATES, for two reasons
 *                      that both point the same way: the models carry no hydrogens, and any residue the
 *                      depositors could not model contributes no atoms at all.
 *   dilated_union_nm3  the same spheres grown by the 1.4 A water probe. This is the volume swept by the
 *                      CENTRE of a rolling water molecule, which is strictly larger than the molecular
 *                      (solvent-excluded) volume, so it OVERESTIMATES.
 *
 * The quantity a crowding calculation wants - the excluded volume of the particle - lies between them.
 * Nothing here pretends to know where, so `occupancy` is evaluated at both ends and both are reported.
 *
 * `daltons_per_deposited_atom` is a completeness diagnostic computed here, not a literature value. A
 * complete all-heavy-atom model of protein and nucleic acid lands near 14-15 Da per deposited atom. A
 * value well above that means the entry's formula weight counts residues whose coordinates are absent,
 * so a volume inferred from that MASS would be wrong while the volume computed from the COORDINATES is
 * merely incomplete. The 1.9 A crystal structure of the nucleosome scores 14.7; the 3.6 A ribosome
 * scores 17.5 and the 5.4 A pre-initiation complex 18.9. That is why no volume in this file is derived
 * from a deposited molecular weight.
 */
export const VOLUME_METHOD = deepFreeze({
  radii: 'Bondi (1964) van der Waals radii: C 1.70, N 1.55, O 1.52, S 1.80, P 1.80, MG 1.73, ZN 1.39 A.',
  probe: '1.4 A (water), after Shrake & Rupley (1973).',
  grid: '1.0 A cubic grid for 4UG0 and 5IYA; 0.8 A for 1KX5. A grid cell is counted if its corner lies inside any sphere.',
  what_is_excluded: 'Water molecules and other solvent in the deposited files were dropped. Bound metals were kept.',
  why_an_interval: 'The van der Waals union underestimates (no hydrogens, unmodelled residues); the 1.4 A dilated union overestimates (it is the probe-centre volume, not the molecular volume). The excluded volume lies between.',
  completeness_diagnostic: 'daltons_per_deposited_atom; a complete heavy-atom model of protein plus nucleic acid lands near 14-15.',
  not_derived_from_mass: 'No volume here is converted from a deposited molecular weight, because for two of the three entries that weight counts unmodelled residues.',
});

// ---------------------------------------------------------------------------- the reference cell

/**
 * A reference mammalian cell. The cell type is named because none of these numbers is a property of a
 * species: a cultured epithelial line in exponential growth is not a hepatocyte and is not a lymphocyte.
 *
 * The volume and the nuclear volume here come from DIFFERENT sources and DO NOT FIT TOGETHER. A 1,000
 * um^3 nucleus inside a 2,425 um^3 cell would be 41% of the cell, which is far above the nuclear
 * fraction such a cell is ever drawn or described with. `nuclear_volume.inconsistency` says so instead
 * of quietly rescaling one of them, and `self_consistent` is false so a caller cannot use the pair
 * without noticing.
 */
export const CELL = deepFreeze({
  organism: 'Homo sapiens',
  cell_type: 'HeLa (CCL-2 lineage), cultured cervical adenocarcinoma epithelial line, adherent, interphase, exponential growth',
  why_this_one: 'It is the cell type for which the ribosome count, the total protein count and the cell volume have all been measured, so an inventory can be assembled without mixing cell types. It is also aneuploid - see ploidy - which matters for any DNA arithmetic.',

  volume: {
    value: 2425,
    range: [2000, 4000],
    units: 'um^3',
    what_the_range_is: 'The point value is the figure adopted for this line in Chen 2023. The range is the span of cultured human cell-line volumes compiled in Milo 2013 (this line near 2,000; a second line near 4,000). These are not error bars; they are different cells.',
    source: [CITATIONS.chen_2023, CITATIONS.milo_2013],
    verified_how:
      'Read in the full text of PMC9916689 (fetched from Europe PMC): "the measurements of cell volume for ' +
      'S. cerevisiae (42 um^3) and for HeLa cells (2425 um^3) are fairly consistent in the available ' +
      'literature". Read in the full text of PMC3910158 (fetched via the PubMed full-text tool): "cell ' +
      'lines with characteristic volumes of 2,000-4,000 um^3".',
    chain_of_custody_warning:
      'Chen 2023 attributes 2425 um^3 to Zhao et al. 2008 NMR Biomed 21:159-164 (doi:10.1002/nbm.1173, ' +
      'PMID 17461436). That paper was fetched: its abstract and its PMC record (PMC2700831) report an ' +
      'intracellular water exchange lifetime of 119 +/- 14 ms and contain NO cell volume. PMC holds no ' +
      'full text for it. So 2425 um^3 could not be confirmed at the primary source and is recorded here ' +
      'as a compiled value, not a measurement this file has seen.',
    cell_cycle_dependence: {
      value: 20.7,
      sd: 0.7,
      n: 60,
      units: 'percent increase in volume at mitotic onset',
      source: CITATIONS.zlotek_zlotkiewicz_2015,
      verified_how: 'Read in the full text of PMC4657168 (fetched from Europe PMC): "a sharp increase at mitotic onset (20.7 +/- 0.7%, n = 60)"; prerounded cells of the same line gave 17.5% +/- 0.8% (n = 14).',
      what_it_means_for_the_viewer: 'There is no single cell volume. A viewer that animates division must change the volume by about a fifth across mitosis, or state that it does not.',
    },
  },

  nuclear_volume: {
    value: 1000,
    units: 'um^3',
    organism: 'Homo sapiens',
    cell_type_established: false,
    source: [CITATIONS.deviri_safran_2022, CITATIONS.guo_2017],
    verified_how:
      'Read in the full text of PMC9173802 (fetched from Europe PMC): "nuclear radii of 6.2 um and 1.6 ' +
      'um, calculated from respective nuclear volumes of V ~ 1,000 um^3 and V ~ 17 um^3 for idealized ' +
      'spherical nuclei". Its reference list, also read, gives the source of the 1,000 um^3 as Guo et al. ' +
      '2017 PNAS 114:E8618. Guo et al. was located (PMID 28973866, PMC5642688) but is not open access ' +
      'and Europe PMC returned no full text, so the cell type was not established.',
    inconsistency:
      'This nuclear volume and the cell volume above are from different papers about different cells. ' +
      '1,000 / 2,425 = 0.41, i.e. a nucleus filling two fifths of the cell. Use them as a pair only if ' +
      'you intend that.',
    self_consistent_with_cell_volume: false,
    what_would_resolve_it: 'One study measuring cell volume and nuclear volume in the same cells of a named type, by one method, reported in um^3.',
  },

  // Derived here, not quoted: the diameter of the sphere of that volume. Deviri & Safran perform the
  // same conversion and report 6.2 um of radius, which this reproduces - a cross-check, not a source.
  nuclear_diameter: {
    get value() { return Math.cbrt((6 * 1000) / Math.PI); },
    units: 'um',
    derived_from: 'nuclear_volume = 1000 um^3, as the diameter of the equal-volume sphere: d = (6V/pi)^(1/3).',
    cross_check: 'Deviri & Safran 2022 state a radius of 6.2 um for the same volume; d/2 here is 6.203 um.',
    caveat: 'Nuclei of this line are flattened discs when adherent, not spheres. An equal-volume sphere diameter is a scale, not a shape, and the compaction factor computed from it is a scale too.',
  },

  ploidy: {
    statement: 'Hypertriploid. 61% of the genome is at copy number three; only 3% is at CN>4 or CN<2.',
    source: CITATIONS.adey_2013,
    verified_how: 'Read in the full text of PMC3740412 (fetched from Europe PMC): "61% of the genome is at a baseline copy number (CN) of three, with only a small minority (3%) at CN>4 or CN<2"; and "consistent with published karyotypes of various HeLa strains, suggesting that the hypertriploid state arose either during tumorigenesis or early in the establishment of the HeLa cell line".',
    consequence: 'Any DNA length for THIS cell is about 3x the haploid genome, not 2x. DNA_IN_THE_NUCLEUS reports the diploid case as the general one and this case separately, and never silently uses one for the other.',
  },

  protein_copies: {
    per_cell_range: [2.0e9, 8.2e9],
    per_um3: 1525243,
    units: 'molecules',
    source: CITATIONS.chen_2023,
    verified_how:
      'Read in the full text of PMC9916689: the per-study table for this line gives 2,007,666,667 ' +
      '(Nagaraj 2011), 8,236,921,797 (Wisniewski 2012), 2,982,812,197 (Kulak 2014), 2,916,903,614 (Hein ' +
      '2015), 7,837,554,944 (Itzhak 2016), 4,077,816,932 (Bekker-Jensen 2017) and 4,883,462,397 ' +
      '(Morgenstern 2021); the paper\'s own consensus is "around 3.4 billion protein copies" and ' +
      '"1,525,243 protein copies per um^3".',
    disagreement_retained:
      'A fourfold spread across seven mass-spectrometry studies of ONE cell line. Milo 2013 independently ' +
      'estimates 2-4 million proteins per um^3 from cell density, water content and protein mass ' +
      'fraction, i.e. 1.3-2.6x above the 1.53 million measured here, and argues in print that the ' +
      'measured values are the ones to re-examine. Both are kept. Neither is averaged in.',
  },
});

// ---------------------------------------------------------------------------- crowding

/**
 * SPECIFIC_VOLUME - the bridge between a measured mass concentration (g/mL) and a volume fraction.
 *
 * This is the quantity that makes crowding arithmetic hard, and the one place where it would have been
 * easiest to type a remembered textbook constant. Instead it is derived here from a structure whose
 * model is complete: the 1.9 A nucleosome core particle, 200.28 kDa over 13,625 deposited heavy atoms
 * (14.70 Da/atom, so essentially nothing is missing). Its two computed volumes divided by its mass give
 * the interval below. The conventional anhydrous protein figure near 0.73 cm^3/g sits inside it - which
 * is a consistency check on the method, NOT a source, and 0.73 is deliberately not written as a value
 * anywhere in this file because it was not retrieved this session.
 */
export const SPECIFIC_VOLUME = deepFreeze({
  units: 'cm^3/g',
  get lo() { return (142872 / UNITS.A3_per_nm3) * 1e-21 / (200280 * UNITS.gram_per_dalton); },
  get hi() { return (317247 / UNITS.A3_per_nm3) * 1e-21 / (200280 * UNITS.gram_per_dalton); },
  derived_from: 'PDB 1KX5: deposited molecular weight 200.28 kDa; van der Waals union 142,872 A^3; 1.4 A dilated union 317,247 A^3. Both volumes computed here from the coordinate file.',
  source: [CITATIONS.rcsb_1kx5, CITATIONS.davey_2002, CITATIONS.bondi_1964],
  verified_how: 'Fetched https://data.rcsb.org/rest/v1/core/entry/1KX5 (molecular_weight 200.28, deposited_atom_count 16,755) and https://files.rcsb.org/download/1KX5.pdb, then counted 13,625 non-water heavy atoms and marked a 0.8 A grid inside the sphere unions.',
  consistency_check: 'The conventional anhydrous protein partial specific volume lies between these bounds. That the interval contains it is evidence the method is not broken; it is not a citation.',
  caveat: 'One particle, half DNA by mass. A cytoplasm is mostly protein, whose specific volume differs from nucleic acid. The interval is wide enough to cover that, which is the point of using an interval.',
});

/**
 * CROWDING - the measured macromolecular content of cytoplasm. This is the number that makes the case.
 *
 * The two mass concentrations below were measured in different organisms by different methods and are
 * reported separately. There is no mammalian equivalent of the Zimmerman & Trach measurement that could
 * be retrieved this session: the microbial figure is a direct measurement of TOTAL macromolecules, while
 * the mammalian figure is a compiled PROTEIN density. They are not interchangeable and are not merged.
 */
export const CROWDING = deepFreeze({
  microbe: {
    organism: 'Escherichia coli',
    growth_state: 'exponential or stationary phase',
    quantity: 'total macromolecules (protein and nucleic acid) per volume of cytoplasm',
    mass_concentration: { range: [0.3, 0.4], units: 'g/mL' },
    source: CITATIONS.zimmerman_trach_1991,
    verified_how: 'Fetched the PubMed record for PMID 1748995 and read the abstract: "Macromolecule concentrations in the cytoplasm of E. coli in either exponential or stationary growth phase are estimated to be approximately 0.3 to 0.4 g/ml."',
    volume_fraction_derived: true,
  },
  mammalian: {
    organism: 'mammalian cells (the compiled figure is not resolved to one cell type)',
    cell_type_established: false,
    quantity: 'PROTEIN per volume of cell - not total macromolecules',
    mass_concentration: { value: 0.2, units: 'g/mL' },
    source: CITATIONS.milo_2013,
    verified_how: 'Read in the full text of PMC3910158: "For mammalian cells, a value for protein density of ~0.2 g/mL was reported". The same text records an outlier of 60 mg/mL in the literature and states it is not considered representative.',
    what_is_missing_from_it: 'RNA, DNA, lipid and the glycan mass. A total-macromolecule figure for a mammalian cytoplasm would be higher than 0.2 g/mL by an amount this file cannot quantify.',
    volume_fraction_derived: true,
  },
  total_macromolecule_mass_concentration_mammalian: {
    value: null,
    units: 'g/mL',
    null_reason: 'No measurement of TOTAL macromolecule concentration in a mammalian cytoplasm, comparable to Zimmerman & Trach 1991 for a microbe, was retrieved this session. The 0.2 g/mL above is protein only.',
    what_would_resolve_it: 'A quantitative dry-mass or refractive-index measurement on a named mammalian cell type reporting total macromolecule mass per cell volume, or the Zimmerman-Trach extraction protocol applied to one.',
  },
  qualitative_corroboration: {
    statement: 'The aqueous phase of cytoplasm is crowded rather than dilute, and as much as half the cellular protein may be in a solid phase.',
    source: CITATIONS.luby_phelps_2000,
    verified_how: 'Fetched the PubMed record for PMID 10553280 and read the abstract.',
    why_only_qualitative: 'A review abstract. It corroborates the direction and supplies no number this file could use.',
  },
});

/**
 * Macromolecular volume fraction from a mass concentration, at both ends of the specific-volume
 * interval. phi = c * v_bar, with c in g/mL and v_bar in cm^3/g (1 mL = 1 cm^3, so the product is
 * dimensionless). No single number is returned.
 */
export function volumeFraction(g_per_mL) {
  if (!Number.isFinite(g_per_mL) || g_per_mL < 0) throw new Error(`volumeFraction needs a non-negative finite g/mL, got ${g_per_mL}`);
  return {
    g_per_mL,
    lo: g_per_mL * SPECIFIC_VOLUME.lo,
    hi: g_per_mL * SPECIFIC_VOLUME.hi,
    using: 'specific volume interval derived in SPECIFIC_VOLUME',
  };
}

/** The measured crowding figures, carried through volumeFraction. Computed, so it cannot drift from its inputs. */
export const CROWDING_AS_VOLUME_FRACTION = deepFreeze({
  microbe_total_macromolecules: {
    lo: volumeFraction(CROWDING.microbe.mass_concentration.range[0]).lo,
    hi: volumeFraction(CROWDING.microbe.mass_concentration.range[1]).hi,
    note: 'Low end: 0.3 g/mL at the small specific volume. High end: 0.4 g/mL at the large one. The interval is wide because both the concentration and the conversion are.',
  },
  mammalian_protein_only: {
    lo: volumeFraction(CROWDING.mammalian.mass_concentration.value).lo,
    hi: volumeFraction(CROWDING.mammalian.mass_concentration.value).hi,
    note: 'PROTEIN only. The true macromolecular fraction of a mammalian cell is above this and is not quantified here.',
  },
});

// ---------------------------------------------------------------------------- the machines

/** Mean centre-to-centre spacing for n particles per um^3, as the cube root of the volume each one has. */
export function MEAN_SPACING(per_um3) {
  if (!Number.isFinite(per_um3) || per_um3 <= 0) throw new Error(`MEAN_SPACING needs a positive finite number per um^3, got ${per_um3}`);
  return { per_um3, nm: Math.cbrt(UNITS.nm3_per_um3 / per_um3), method: 'cube root of the volume per particle; a lattice idealisation, not a measurement' };
}

export const MACHINES = deepFreeze({
  ribosome: {
    what: 'cytoplasmic 80S ribosome',
    organism: 'Homo sapiens',
    structure: { pdb: '4UG0', method: 'cryo-EM single particle', resolution_A: 3.6, source: [CITATIONS.khatter_2015, CITATIONS.rcsb_4ug0] },
    deposited_atoms: 218776,
    deposited_molecular_weight_kDa: 3835.52,
    daltons_per_deposited_atom: 3835520 / 218776,
    model_is_complete: false,
    bounding_box_A: [282.4, 297.1, 282.0],
    radius_of_gyration_A: 96.69,
    farthest_atom_from_centroid_A: 165.58,
    vdw_union_nm3: 2247.712,
    dilated_union_nm3: 4926.823,
    rrna_lengths_nt: { '28S': 5070, '5.8S': 157, '5S': 121 },
    verified_how:
      'Fetched https://data.rcsb.org/rest/v1/core/entry/4UG0 and read back: title "STRUCTURE OF THE HUMAN ' +
      '80S RIBOSOME", 81 polymer entities (76 protein, 5 RNA), molecular_weight 3835.52, ' +
      'deposited_atom_count 218,776, EM at 3.6 A, primary citation doi 10.1038/nature14427. Fetched ' +
      'polymer_entity 4UG0/1,2,3 for the 28S (5,070 nt), 5S (121 nt) and 5.8S (157 nt) rRNA lengths and ' +
      'source organism Homo sapiens. Downloaded 4UG0.cif.gz (5,569,915 bytes), parsed 218,776 atoms ' +
      '(C 114,849, O 56,718, N 40,675, P 5,864, S 425, MG 239, ZN 6 - no hydrogens), and computed the ' +
      'bounding box, radius of gyration and both sphere-union volumes on a 1.0 A grid.',
    caveat: '17.5 Da per deposited atom means the entry\'s formula weight counts residues whose coordinates are absent at this resolution. The van der Waals union is therefore an underestimate by more than the missing-hydrogen amount alone.',
    counts: {
      human_cell_line: {
        range: [3.3e6, 9.5e6],
        organism: 'Homo sapiens',
        cell_type: 'HeLa',
        units: 'ribosomes per cell',
        source: [CITATIONS.chen_2023, CITATIONS.duncan_hershey_1983, CITATIONS.wolf_schlessinger_1977],
        verified_how: 'Read in the full text of PMC9916689: "for HeLa cells, differing values have been reported: 3.3 million [47], 4 million [37], and 9.5 million [48]. We selected a median of these values." Its reference list, also read, resolves [47] to Duncan & Hershey 1983 JBC, [48] to Wolf & Schlessinger 1977 Biochemistry, and [37] to a reagent-vendor web page.',
      },
      microbe: {
        value: 55000,
        organism: 'Escherichia coli',
        growth_state: 'moderate growth; the same paper reports 27,000 ribosomes per um^3 in rich medium at growth rate 1.11/h',
        units: 'ribosomes per cell',
        source: CITATIONS.bakshi_2012,
        verified_how: 'Fetched the Europe PMC record for doi 10.1111/j.1365-2958.2012.08081.x and read the abstract: "The mean copy numbers per cell are 4600 RNAPs and 55,000 ribosomes." Counted by superresolution fluorescence microscopy in live cells.',
      },
    },
  },

  nucleosome: {
    what: 'nucleosome core particle, 147 base pairs of DNA on a histone octamer',
    organism: 'the 147 bp DNA is human alpha-satellite; the histones in this entry are recombinant and their source organism was not checked this session',
    structure: { pdb: '1KX5', method: 'X-ray diffraction', resolution_A: 1.94, source: [CITATIONS.davey_2002, CITATIONS.rcsb_1kx5] },
    deposited_atoms_including_solvent: 16755,
    heavy_atoms_excluding_water: 13625,
    deposited_molecular_weight_kDa: 200.28,
    daltons_per_deposited_atom: 200280 / 13625,
    model_is_complete: true,
    bounding_box_A: [122.2, 155.5, 72.2],
    vdw_union_nm3: 142.872,
    dilated_union_nm3: 317.247,
    dna_bp: 147,
    verified_how:
      'Fetched https://data.rcsb.org/rest/v1/core/entry/1KX5 and read back: title "X-Ray Structure of the ' +
      'Nucleosome Core Particle, NCP147, at 1.9 A Resolution", molecular_weight 200.28, ' +
      'deposited_atom_count 16,755, 6 polymer entities, 1.94 A, citation doi ' +
      '10.1016/S0022-2836(02)00386-8. Fetched polymer_entity 1KX5/1 and 1KX5/2: both are 147-nucleotide ' +
      'DNA strands with source organism Homo sapiens (taxid 9606), expressed in a microbial host. ' +
      'Downloaded 1KX5.pdb, dropped HOH, counted 13,625 heavy atoms (C 7,614, O 3,098, N 2,591, P 292, ' +
      'MN 14, S 12, CL 4) and computed both sphere-union volumes on a 0.8 A grid.',
    caveat: 'The 155 A bounding-box extent is set by the extended histone tails, which are fully ordered in this entry and are NOT part of the ~110 A disc a depiction usually draws. A viewer drawing the disc alone is drawing a different object from the one measured here.',
    spacing: {
      nucleosome_repeat_length_bp: { range: [193, 203], units: 'bp' },
      within_genome_range_bp: { range: [178, 206], units: 'bp' },
      linker_bp: { range: [46, 56], units: 'bp' },
      organism: 'Homo sapiens',
      cell_type: 'primary granulocytes (193 bp, linker 46 bp) and primary CD4+/CD8+ T cells (10 bp wider, linker 56 bp)',
      source: CITATIONS.valouev_2011,
      verified_how: 'Read in the full text of PMC3212987 (fetched from Europe PMC): "In granulocytes, the wave peaks are 193 bp apart ... which, given a core fragment length of 147 bp, indicates an internucleosome linker length of 46 bps. By contrast, the phasograms of both types of T-cells have spacing that is wider by 10 bp ... equivalent to a 56 bp average linker length"; and within one genome "the shortest spacing of 178-187 bp" at active promoters, "190-195 bp within the body of active genes", "heterochromatin spacing was largest at 205 bp", 206 bp in silent genes.',
      what_it_means_for_the_viewer: 'The repeat length is not a constant. It differs by 10 bp between two primary cell types of the same organism and by 28 bp between chromatin states within one nucleus. A viewer that draws one spacing everywhere is drawing an average, and should say which.',
    },
  },

  rna_polymerase: {
    what: 'human core transcription pre-initiation complex in the closed state - RNA polymerase II together with its general factors and promoter DNA, NOT the polymerase alone',
    organism: 'Homo sapiens',
    structure: { pdb: '5IYA', method: 'cryo-EM', resolution_A: 5.4, source: [CITATIONS.he_2016, CITATIONS.rcsb_5iya] },
    deposited_atoms: 46697,
    deposited_molecular_weight_kDa: 884.56,
    daltons_per_deposited_atom: 884560 / 46697,
    model_is_complete: false,
    polymer_entities: 23,
    bounding_box_A: [180.4, 198.4, 165.1],
    vdw_union_nm3: 501.869,
    dilated_union_nm3: 1103.248,
    verified_how:
      'Fetched https://data.rcsb.org/rest/v1/core/entry/5IYA and read back: title "Human core-PIC in the ' +
      'closed state", molecular_weight 884.56, deposited_atom_count 46,697, 23 polymer entities, EM at ' +
      '5.4 A, citation "Near-atomic resolution visualization of human transcription promoter opening", ' +
      'Nature 2016. Downloaded 5IYA.cif.gz, parsed 46,697 atoms (C 29,059, O 9,022, N 8,218, S 269, ' +
      'P 116, ZN 11, MG 2) and computed both sphere-union volumes on a 1.0 A grid.',
    caveat: '5.4 A and 18.9 Da per deposited atom: many side chains are not modelled, so the van der Waals union is a substantial underestimate. This is also a COMPLEX, not a polymerase - a viewer that labels it "RNA polymerase" is mislabelling it.',
    counts: {
      microbe: {
        value: 4600,
        organism: 'Escherichia coli',
        units: 'RNA polymerase molecules per cell',
        source: CITATIONS.bakshi_2012,
        verified_how: 'Read in the Europe PMC abstract for doi 10.1111/j.1365-2958.2012.08081.x: "The mean copy numbers per cell are 4600 RNAPs and 55,000 ribosomes."',
      },
      mammalian: {
        value: null,
        units: 'RNA polymerase II molecules per cell',
        null_reason: 'No measured per-cell RNA polymerase II count for a named mammalian cell type was retrieved this session.',
        what_would_resolve_it: 'An absolute quantification (calibrated mass spectrometry, or single-molecule counting as Bakshi et al. did for the microbe) of POLR2A copies per cell in a named mammalian cell type and growth state.',
      },
    },
  },

  dna_polymerase: {
    what: 'replicative DNA polymerase',
    size: {
      value: null,
      units: 'nm^3',
      null_reason: 'No structure was fetched for a replicative DNA polymerase holoenzyme this session, so no volume was computed. Writing one from memory is the thing this file exists to refuse.',
      what_would_resolve_it: 'Pick a deposited holoenzyme structure, fetch its coordinates and run the same sphere-union computation the other three machines went through.',
    },
    counts: {
      mammalian: {
        value: null,
        units: 'molecules per cell',
        null_reason: 'Not retrieved. A per-cell count would also be close to meaningless without a cell-cycle phase: the number of polymerases engaged at replication forks in S phase is not the number present in G1.',
        what_would_resolve_it: 'An absolute quantification in a named cell type resolved by cell-cycle phase, together with a separate count of active replication forks.',
      },
    },
  },

  b_dna: {
    what: 'B-form DNA duplex',
    structure: { pdb: '1BNA', sequence: 'd(CGCGAATTCGCG), self-complementary dodecamer', method: 'X-ray diffraction', resolution_A: 1.9, source: [CITATIONS.drew_1981, CITATIONS.rcsb_1bna] },
    rise_per_bp_nm: {
      straight_axis_fit: 0.33337,
      bend_corrected: 0.33490,
      per_step_range_nm: [0.2817, 0.4017],
      units: 'nm per base pair',
      how_it_was_computed:
        'Downloaded 1BNA.pdb (76,464 bytes), took the C1\' atoms of the 12 Watson-Crick pairs (chain A ' +
        'residue i paired with chain B residue 25-i), used each pair\'s C1\' midpoint as the base-pair ' +
        'centre, fitted the principal axis of those 12 centres by power iteration on their covariance, ' +
        'and divided the axial extent from base pair 1 to base pair 12 (36.670 A) by the 11 steps between ' +
        'them: 3.3337 A.',
      bend_correction:
        'Drew et al. report a 19 degree bend in the helix axis across these 11 steps, so a straight-line ' +
        'fit measures a chord and underestimates the contour rise. The arc-to-chord ratio for a 19 degree ' +
        'turn is (theta/2)/sin(theta/2) = 1.0046, giving 3.3490 A per base pair. Both are reported; the ' +
        'correction is 0.46% and changes no conclusion here.',
      verified_how: 'Fetched https://data.rcsb.org/rest/v1/core/entry/1BNA (title "STRUCTURE OF A B-DNA DODECAMER. CONFORMATION AND DYNAMICS", 1.9 A, 566 deposited atoms, citation doi 10.1073/pnas.78.4.2179) and the PubMed record for PMID 6941276, whose abstract supplies the 19 degree bend and the 36.9 degrees per step in the molecule centre. Then computed the rise from the downloaded coordinates as described.',
      honest_caveat:
        'The per-step rise in this one crystal structure ranges from 2.817 to 4.017 A - a 43% spread ' +
        'across eleven steps of a single molecule. "0.34 nm per base pair" is a mean, not a constant, and ' +
        'a viewer that draws a perfectly regular helix is drawing the mean.',
    },
    diameter_nm: {
      measured_atom_centre_span: 2.3888,
      how_it_was_computed: 'Largest perpendicular distance of any atom from the fitted helix axis (11.944 A), doubled.',
      why_it_exceeds_the_conventional_2_nm:
        'Two reasons, both inflating it: it is an atom-CENTRE span with no van der Waals radii subtracted ' +
        'or added, and the 19 degree bend means a straight fitted axis runs off-centre at the ends. The ' +
        'conventional 2.0 nm B-DNA diameter is not written here as a sourced value because it was not ' +
        'retrieved this session; the range 2.0-2.4 nm is carried through DNA_IN_THE_NUCLEUS instead.',
    },
    genome: {
      haploid_bp: 3099441038,
      ungapped_bp: 2948318359,
      assembly: 'GRCh38.p14 (GCF_000001405.40)',
      organism: 'Homo sapiens',
      source: CITATIONS.grch38p14,
      verified_how: 'Fetched https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000001405.40/dataset_report and read back assembly_stats: total_sequence_length 3,099,441,038; total_ungapped_length 2,948,318,359; 24 chromosomes; gc_percent 41.',
      which_to_use: 'total_sequence_length includes assembly gaps (151 Mb of them), which are placeholder N runs, not DNA. The ungapped length is the better input for a contour length; both are carried so the choice is visible. The difference is 4.9%.',
    },
  },
});

/** Mean protein spacing in the measured cytoplasm of the reference cell. Computed, not quoted. */
export const PROTEIN_SPACING = deepFreeze(MEAN_SPACING(CELL.protein_copies.per_um3));

// ---------------------------------------------------------------------------- occupancy

/**
 * What fraction of a volume does an inventory of machines occupy?
 *
 * `counts` maps a machine name to a count (a number, or a [lo, hi] pair where sources disagree).
 * `volumes` maps the same names to a per-machine volume in nm^3 (a number, or a [lo, hi] pair).
 * `container_um3` is the volume they sit in.
 *
 * Returns an INTERVAL, and per-item intervals, because both the counts and the volumes are intervals.
 * It returns no single number, and it will refuse a name that appears in one map and not the other
 * rather than treating a missing volume as zero - silently scoring a machine at zero volume is exactly
 * how an inventory comes out looking complete when it is not.
 */
export function occupancy({ counts, volumes, container_um3 = CELL.volume.value } = {}) {
  if (!counts || typeof counts !== 'object') throw new Error('occupancy needs { counts } as an object of name -> count');
  if (!volumes || typeof volumes !== 'object') throw new Error('occupancy needs { volumes } as an object of name -> nm^3');
  if (!Number.isFinite(container_um3) || container_um3 <= 0) throw new Error(`occupancy needs a positive finite container_um3, got ${container_um3}`);

  const pair = (v, what, name) => {
    if (Array.isArray(v)) {
      if (v.length !== 2 || !v.every(Number.isFinite)) throw new Error(`${what} for "${name}" must be two finite numbers, got ${JSON.stringify(v)}`);
      return [Math.min(...v), Math.max(...v)];
    }
    if (!Number.isFinite(v)) throw new Error(`${what} for "${name}" must be a finite number or a [lo, hi] pair, got ${JSON.stringify(v)}`);
    return [v, v];
  };

  const missing_volume = Object.keys(counts).filter(k => !(k in volumes));
  const missing_count = Object.keys(volumes).filter(k => !(k in counts));
  if (missing_volume.length) throw new Error(`occupancy refuses to score a machine with no volume: ${missing_volume.join(', ')}. Give it a volume, or drop it from counts and say why.`);

  const container_nm3 = container_um3 * UNITS.nm3_per_um3;
  const items = {};
  let lo = 0, hi = 0;
  for (const name of Object.keys(counts)) {
    const [cLo, cHi] = pair(counts[name], 'count', name);
    const [vLo, vHi] = pair(volumes[name], 'volume (nm^3)', name);
    const itemLo = cLo * vLo, itemHi = cHi * vHi;
    lo += itemLo; hi += itemHi;
    items[name] = {
      count: [cLo, cHi],
      volume_each_nm3: [vLo, vHi],
      volume_total_nm3: [itemLo, itemHi],
      volume_total_um3: [itemLo / UNITS.nm3_per_um3, itemHi / UNITS.nm3_per_um3],
      fraction: [itemLo / container_nm3, itemHi / container_nm3],
      mean_spacing_nm: [MEAN_SPACING(cLo / container_um3).nm, MEAN_SPACING(cHi / container_um3).nm],
    };
  }
  return {
    container_um3,
    container_nm3,
    items,
    total_volume_nm3: [lo, hi],
    total_volume_um3: [lo / UNITS.nm3_per_um3, hi / UNITS.nm3_per_um3],
    fraction: [lo / container_nm3, hi / container_nm3],
    machines_with_no_count: missing_count,
    is_a_single_number: false,
  };
}

/** Nucleosomes per nucleus, from a sourced genome size and a sourced repeat length. Derived, not quoted. */
export function nucleosomeCount({ bp = MACHINES.b_dna.genome.ungapped_bp, copies = 2, nrl_bp = MACHINES.nucleosome.spacing.nucleosome_repeat_length_bp.range } = {}) {
  const [a, b] = Array.isArray(nrl_bp) ? nrl_bp : [nrl_bp, nrl_bp];
  const total = bp * copies;
  return {
    genome_bp: bp, genome_copies: copies, total_bp: total, nrl_bp: [Math.min(a, b), Math.max(a, b)],
    count: [total / Math.max(a, b), total / Math.min(a, b)],
    note: 'A ceiling, not a census: it assumes every base pair is in a regular array. Measured nucleosome occupancy is below 100% at promoters and at bound transcription-factor sites, where Valouev et al. report extra linker space.',
  };
}

/**
 * THE WORKED INVENTORY for the reference cell, built from the counts and volumes above. It is
 * deliberately incomplete - and the comparison against measured crowding is the point of it.
 */
export const WORKED_INVENTORY = deepFreeze((() => {
  const nuc = nucleosomeCount({});
  const counts = {
    ribosome: MACHINES.ribosome.counts.human_cell_line.range,
    nucleosome: nuc.count,
  };
  const volumes = {
    ribosome: [MACHINES.ribosome.vdw_union_nm3, MACHINES.ribosome.dilated_union_nm3],
    nucleosome: [MACHINES.nucleosome.vdw_union_nm3, MACHINES.nucleosome.dilated_union_nm3],
  };
  const inCell = occupancy({ counts, volumes, container_um3: CELL.volume.value });
  const nucleosomesInNucleus = occupancy({
    counts: { nucleosome: nuc.count },
    volumes: { nucleosome: volumes.nucleosome },
    container_um3: CELL.nuclear_volume.value,
  });
  const crowd = CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only;
  return {
    nucleosome_count: nuc,
    in_the_whole_cell: inCell,
    nucleosomes_against_the_nuclear_volume: nucleosomesInNucleus,
    compared_with_measured_crowding: {
      measured_protein_volume_fraction: [crowd.lo, crowd.hi],
      inventory_volume_fraction: inCell.fraction,
      inventory_as_share_of_measured: [inCell.fraction[0] / crowd.hi, inCell.fraction[1] / crowd.lo],
      the_honest_statement:
        'This inventory of two machine types accounts for a few per cent of the cell volume, against a ' +
        'measured PROTEIN volume fraction of roughly a tenth to a fifth. So the inventory covers only a ' +
        'minority of the measured crowding - the exact share depends on which end of three separate ' +
        'intervals you take, which is why it is reported as an interval and not as a percentage.',
      what_is_missing_and_why_it_must_be:
        'Two machine types out of a proteome of roughly ten thousand expressed species. Absent entirely: ' +
        'the cytoskeleton, every membrane and the organelles they bound, the mitochondrial content, the ' +
        'spliceosome and every other nuclear machine, chaperones, the proteasome, all metabolic enzymes ' +
        '(which dominate protein copy number), mRNA and tRNA, and the glycogen and lipid stores. The ' +
        'inventory CANNOT match the measured crowding, and if it did that would be evidence of an error, ' +
        'not of completeness.',
      direction_of_every_bias:
        'Counts: the ribosome count is an interval spanning a factor of 2.9 between two primary ' +
        'measurements. Volumes: the van der Waals end underestimates (no hydrogens, unmodelled residues ' +
        'at 3.6 A) and the dilated end overestimates (probe-centre volume). Container: the cell volume is ' +
        'a compiled figure that could not be confirmed at its primary source, and it changes by a fifth ' +
        'across mitosis. Ploidy: this line is hypertriploid, so the nucleosome count computed for a ' +
        'diploid genome is about a third too low FOR THIS CELL.',
    },
  };
})());

// ---------------------------------------------------------------------------- DNA in the nucleus

/**
 * The classic constraint, computed from sourced inputs rather than quoted: a genome's contour length as
 * B-DNA against the size of the nucleus that has to hold it.
 *
 * Two results come out, and they point in opposite directions, which is why both belong here:
 *
 *   1. The LENGTH problem is real and enormous. About a metre of double helix per haploid genome copy
 *      has to fit across a nucleus of order ten micrometres: a linear compaction of order 1e5.
 *   2. The VOLUME problem does not exist. That same DNA, as a cylinder of its measured diameter,
 *      occupies well under one per cent of the nuclear volume. A nucleus is not full of DNA.
 *
 * Both of the depictions this rules out are common. One draws the nucleus stuffed solid with chromatin;
 * the other draws chromosomes as tidy objects floating in clear nucleoplasm. The first contradicts (2),
 * the second contradicts what CROWDING says about any cellular compartment.
 */
export const DNA_IN_THE_NUCLEUS = deepFreeze((() => {
  const rise_lo = MACHINES.b_dna.rise_per_bp_nm.straight_axis_fit;   // nm/bp, chord fit
  const rise_hi = MACHINES.b_dna.rise_per_bp_nm.bend_corrected;      // nm/bp, bend-corrected
  const bp_gapped = MACHINES.b_dna.genome.haploid_bp;
  const bp_ungapped = MACHINES.b_dna.genome.ungapped_bp;
  const d_nuc_um = CELL.nuclear_diameter.value;

  const len_m = (bp, copies, rise_nm) => bp * copies * rise_nm * 1e-9;
  const haploid = [len_m(bp_ungapped, 1, rise_lo), len_m(bp_gapped, 1, rise_hi)];
  const diploid = [len_m(bp_ungapped, 2, rise_lo), len_m(bp_gapped, 2, rise_hi)];
  const hypertriploid = [len_m(bp_ungapped, 3, rise_lo), len_m(bp_gapped, 3, rise_hi)];

  // Volume of the duplex as a cylinder, at both ends of the diameter bracket.
  const cylinder_um3 = (len_metres, d_nm) => {
    const L_nm = len_metres * 1e9;
    return (Math.PI * (d_nm / 2) ** 2 * L_nm) / UNITS.nm3_per_um3;
  };
  const d_lo = 2.0, d_hi = MACHINES.b_dna.diameter_nm.measured_atom_centre_span;
  const dna_volume_um3 = [cylinder_um3(diploid[0], d_lo), cylinder_um3(diploid[1], d_hi)];

  return {
    inputs: {
      rise_per_bp_nm: { lo: rise_lo, hi: rise_hi, source: 'computed here from PDB 1BNA coordinates; see MACHINES.b_dna.rise_per_bp_nm', citation: CITATIONS.drew_1981 },
      genome_bp: { with_assembly_gaps: bp_gapped, ungapped: bp_ungapped, source: CITATIONS.grch38p14 },
      nuclear_diameter_um: { value: d_nuc_um, source: 'derived in CELL.nuclear_diameter from the 1,000 um^3 nuclear volume', citation: CITATIONS.deviri_safran_2022 },
      duplex_diameter_nm: { lo: d_lo, hi: d_hi, note: 'Low end is the conventional 2.0 nm, which this file does not claim as a retrieved value; high end is the atom-centre span measured from 1BNA. Carried as a bracket for exactly that reason.' },
    },
    contour_length_m: { haploid, diploid, hypertriploid_this_cell_line: hypertriploid },
    compaction_factor: {
      diploid_against_nuclear_diameter: [diploid[0] / (d_nuc_um * 1e-6), diploid[1] / (d_nuc_um * 1e-6)],
      what_it_means: 'The length of double helix that has to be folded into one nuclear diameter. It is a ratio of a length to a length, not a packing density, and it says nothing about how the folding is done.',
    },
    dna_volume_in_the_nucleus: {
      volume_um3: dna_volume_um3,
      fraction_of_nuclear_volume: [dna_volume_um3[0] / CELL.nuclear_volume.value, dna_volume_um3[1] / CELL.nuclear_volume.value],
      the_point:
        'Under one per cent. The compaction problem is a problem about LENGTH and topology, not about ' +
        'volume. There is no volume crisis in the nucleus, and a depiction that fills the nucleus solid ' +
        'with visible DNA is wrong by two orders of magnitude.',
    },
    nucleosome_spacing_in_the_nucleus: {
      count: WORKED_INVENTORY.nucleosome_count.count,
      mean_centre_to_centre_nm: [
        MEAN_SPACING(WORKED_INVENTORY.nucleosome_count.count[1] / CELL.nuclear_volume.value).nm,
        MEAN_SPACING(WORKED_INVENTORY.nucleosome_count.count[0] / CELL.nuclear_volume.value).nm,
      ],
      against_a_nucleosome_diameter_of_nm: 11,
      the_point:
        'Nucleosomes sit roughly three of their own diameters apart on average. So the nucleus is neither ' +
        'solid chromatin nor empty between the fibres: the ~20 nm gaps are filled by linker DNA, linker ' +
        'histone and nucleoplasmic protein, none of which this file has a measured concentration for.',
      caveat: 'The 11 nm figure is the conventional disc diameter of a nucleosome core particle, which was NOT retrieved this session; the measured bounding box of 1KX5 is 12.2 x 15.5 x 7.2 nm including the extended histone tails. It is used only as a scale for the comparison.',
    },
    what_was_not_computed: {
      value: null,
      units: 'chromatin volume fraction in the nucleus',
      null_reason: 'Chromatin is not naked DNA. Its volume includes histones, linker histone, every chromatin-associated protein and the hydration shell, and no measured nucleoplasmic macromolecule concentration was retrieved this session.',
      what_would_resolve_it: 'A cryo-electron-tomography or quantitative-phase measurement of macromolecular mass density inside the nucleus of a named mammalian cell type, in g/mL.',
    },
  };
})());

// ---------------------------------------------------------------------------- what the numbers forbid

/**
 * Each item names the depiction, the number that forbids it, and the margin. These are constraints on a
 * PICTURE, which is the only thing this evidence layer can constrain - it cannot tell a renderer where
 * to put anything, only what it may not draw.
 */
export const WHAT_THIS_RULES_OUT = deepFreeze([
  {
    depiction: 'A sparse cytoplasm: machines drawn as separate objects with clear fluid visible between them.',
    forbidden_by: 'CROWDING.microbe (0.3-0.4 g/mL of total macromolecules, measured) and CROWDING.mammalian (0.2 g/mL of protein alone, compiled), converted by SPECIFIC_VOLUME.',
    the_number: () => `macromolecular volume fraction ${(CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.lo * 100).toFixed(0)}-${(CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.hi * 100).toFixed(0)}% in a microbe; ${(CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.lo * 100).toFixed(0)}-${(CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.hi * 100).toFixed(0)}% from mammalian protein alone`,
    the_sharper_number: () => `mean protein centre-to-centre spacing ${PROTEIN_SPACING.nm.toFixed(1)} nm at the measured ${CELL.protein_copies.per_um3.toLocaleString('en-US')} proteins/um^3`,
    why_it_bites: 'A mid-sized globular protein is 4-6 nm across and its nearest neighbour\'s centre is about 8.7 nm away. The average gap is roughly one protein diameter. There is no scale at which clear fluid is the right thing to draw between macromolecules.',
    what_the_viewer_must_do_instead: 'Fill the volume to the stated fraction with unlabelled background macromolecules, and label that background as generated rather than placed - it is the honest way to be wrong.',
  },
  {
    depiction: 'A nucleus with free space around the chromosomes - chromatin as discrete objects in clear nucleoplasm.',
    forbidden_by: 'DNA_IN_THE_NUCLEUS.nucleosome_spacing_in_the_nucleus, together with the absence of any void in CROWDING.',
    the_number: () => `${(WORKED_INVENTORY.nucleosome_count.count[0] / 1e6).toFixed(1)}-${(WORKED_INVENTORY.nucleosome_count.count[1] / 1e6).toFixed(1)} million nucleosomes in ${CELL.nuclear_volume.value} um^3, i.e. a mean centre-to-centre spacing of ${DNA_IN_THE_NUCLEUS.nucleosome_spacing_in_the_nucleus.mean_centre_to_centre_nm[0].toFixed(0)}-${DNA_IN_THE_NUCLEUS.nucleosome_spacing_in_the_nucleus.mean_centre_to_centre_nm[1].toFixed(0)} nm between 11 nm particles`,
    why_it_bites: 'Three diameters of mean separation is not free space, it is a crowded gel. And nothing in the nucleus is less crowded than the cytoplasm by any measurement retrieved here.',
    the_opposite_error_is_also_ruled_out: () => `DNA itself occupies only ${(DNA_IN_THE_NUCLEUS.dna_volume_in_the_nucleus.fraction_of_nuclear_volume[0] * 100).toFixed(2)}-${(DNA_IN_THE_NUCLEUS.dna_volume_in_the_nucleus.fraction_of_nuclear_volume[1] * 100).toFixed(2)}% of the nuclear volume, so a nucleus drawn stuffed solid with visible DNA is wrong by about two orders of magnitude in the other direction`,
    what_the_viewer_must_do_instead: 'Draw chromatin at the measured spacing and fill the remainder with background macromolecules, saying that the non-DNA nuclear content has no retrieved concentration behind it.',
  },
  {
    depiction: 'A ribosome drawn at whatever size makes it visible.',
    forbidden_by: 'MACHINES.ribosome (measured bounding box and occupied volume) against MACHINES.ribosome.counts.human_cell_line and CELL.volume.',
    the_number: () => {
      const n = MACHINES.ribosome.counts.human_cell_line.range[1];
      const share_nm3 = (CELL.volume.value * UNITS.nm3_per_um3) / n;
      const budget_nm3 = CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.hi * share_nm3;
      return `at ${(n / 1e6).toFixed(1)} million ribosomes in ${CELL.volume.value} um^3, each has ${Math.round(share_nm3).toLocaleString('en-US')} nm^3 of cell to itself - a ${Math.cbrt(share_nm3).toFixed(0)} nm cube. If ribosomes alone were allowed the whole measured protein volume fraction, the largest they could be drawn is a sphere of ${Math.cbrt((6 * budget_nm3) / Math.PI).toFixed(0)} nm diameter. The measured particle is ${(MACHINES.ribosome.bounding_box_A[0] / 10).toFixed(0)}-${(MACHINES.ribosome.bounding_box_A[1] / 10).toFixed(0)} nm across.`;
    },
    why_it_bites: 'The headroom is under a factor of two in diameter, and it is only that large because the calculation generously gives ribosomes the entire protein volume budget. Enlarge a ribosome to make it legible and you have drawn a cell that is full of ribosomes and nothing else.',
    what_the_viewer_must_do_instead: 'Keep the ribosome at its measured size and solve legibility with camera, colour and labelling, not with scale. If any object is drawn out of scale, say which and by how much.',
  },
  {
    depiction: 'One nucleosome spacing drawn everywhere, and one rise per base pair.',
    forbidden_by: 'MACHINES.nucleosome.spacing (193 bp in one primary cell type, 203 bp in another, 178-206 bp across chromatin states within one genome) and MACHINES.b_dna.rise_per_bp_nm.per_step_range_nm (2.817-4.017 A across eleven steps of one crystal structure).',
    the_number: () => `nucleosome repeat length ${MACHINES.nucleosome.spacing.within_genome_range_bp.range.join('-')} bp within one genome; rise per base pair ${MACHINES.b_dna.rise_per_bp_nm.per_step_range_nm.map(v => (v * 10).toFixed(2)).join('-')} A across one dodecamer`,
    why_it_bites: 'These are not measurement error, they are biology. A single regular helix with evenly spaced beads depicts an average that no stretch of real chromatin equals.',
    what_the_viewer_must_do_instead: 'Either vary the spacing within the measured range and say the variation is generated, or draw the average and label it as the average.',
  },
  {
    depiction: 'A labelled "RNA polymerase" copied from the structure cited here.',
    forbidden_by: 'MACHINES.rna_polymerase: PDB 5IYA is a 23-entity pre-initiation COMPLEX at 5.4 A, not a polymerase.',
    the_number: () => `${MACHINES.rna_polymerase.polymer_entities} polymer entities, ${MACHINES.rna_polymerase.deposited_molecular_weight_kDa} kDa, ${MACHINES.rna_polymerase.daltons_per_deposited_atom.toFixed(1)} Da per deposited atom`,
    why_it_bites: 'The viewer\'s whole claim is that its numbers are traceable. A mislabelled object breaks that claim more cheaply than a wrong number does, because nobody will check it.',
    what_the_viewer_must_do_instead: 'Label it as the pre-initiation complex, or fetch a structure of the polymerase alone and run the same volume computation on it.',
  },
]);

// ---------------------------------------------------------------------------- what we got wrong

export const THE_CUBE_TRAP = deepFreeze({
  what_happened:
    'While assembling the worked inventory, the ribosome occupancy of the reference cell was first ' +
    'computed by dividing a total ribosome volume in nm^3 by a cell volume written as 2.425e9 nm^3. The ' +
    'answer came out as 306% of the cell at the low end of the ribosome count, and as nearly 2,000% at ' +
    'the high end.',
  why_it_was_wrong:
    'The cell volume is 2,425 um^3, and one cubic micrometre is 1e9 cubic nanometres, not 1e3. The ' +
    'correct container is 2.425e12 nm^3. The error was a factor of a thousand, from carrying the LINEAR ' +
    'conversion between nanometres and micrometres into a VOLUME.',
  why_it_nearly_survived:
    'It produced a number that still looked like an occupancy. "306%" reads as a slightly broken ' +
    'calculation, not as a thousandfold unit error, and the obvious next move is to suspect the ribosome ' +
    'count or the ribosome volume - both of which are genuinely uncertain, both of which were under ' +
    'discussion at that moment, and neither of which was at fault. A plausible-looking wrong answer ' +
    'recruits the real uncertainties as cover.',
  how_it_was_caught:
    'Not by the occupancy arithmetic, which has no way to notice. It was caught by an independent route ' +
    'to the same quantity: total ribosome MASS (count times molecular weight) as a fraction of total ' +
    'protein mass per cell comes to about 10% of the proteome by ribosomal-protein mass, which is the ' +
    'right order for a mammalian cell. A machine type that is a tenth of the protein mass cannot be ' +
    'three times the cell volume. The two routes disagreed by exactly 1e3 and the exponent was the ' +
    'difference.',
  the_general_lesson:
    'EVERY UNIT CONVERSION IN A VOLUME CALCULATION IS CUBED, and an occupancy is the one kind of result ' +
    'whose plausible range (a few per cent) is close enough to a thousandfold error (a few hundred per ' +
    'cent) that the error does not announce itself. A volume budget needs a second, dimensionally ' +
    'different route to the same answer - here, mass fraction - before any of it is believed.',
  what_changed_in_the_code:
    'The conversions are now named constants in UNITS with the cube written out in a comment; occupancy ' +
    'takes its container in um^3 and does the single conversion itself, so no caller can supply a ' +
    'container already in the wrong unit; and the tests hand-work both the nm^3-per-um^3 factor and an ' +
    'order-of-magnitude bound on the occupancy independently of this module.',
});

export const RIBOSOME_COUNT_DISAGREEMENT = deepFreeze({
  the_values: [
    { count: 3.3e6, source: CITATIONS.duncan_hershey_1983, kind: 'primary measurement, 1983, two-dimensional gel quantification of initiation factors with factor-to-ribosome ratios' },
    { count: 4.0e6, source: 'A reagent vendor\'s web page, "Macromolecular Components of E. coli and HeLa Cells", cited as reference [37] of Chen 2023 (PMC9916689).', kind: 'NOT a measurement: a vendor reference table with no primary citation reachable from it' },
    { count: 9.5e6, source: CITATIONS.wolf_schlessinger_1977, kind: 'primary measurement, 1977, nuclear ribosomal RNA metabolism' },
  ],
  the_span: 'A factor of 2.9 between the two primary measurements.',
  what_was_not_done: 'They were not averaged, and the median was not taken, although the compilation that reports all three does take the median. The interval is carried through every occupancy in this file.',
  why_the_middle_value_is_the_dangerous_one:
    'Four million is the roundest of the three, sits between the other two, and is the one most likely to ' +
    'be quoted onward - and it is the only one of the three that is not a measurement. A number\'s ' +
    'roundness and its centrality are not evidence. This is the textbook-only figure in this subject ' +
    'area, and it is textbook-only in the most literal sense: it is a table in a catalogue.',
  what_would_resolve_it:
    'An absolute ribosome count in a named mammalian cell type by a modern method - calibrated ' +
    'mass spectrometry of ribosomal proteins, or the single-molecule counting that has been done in a ' +
    'microbe - reported with the cell volume measured in the same cells.',
});

export const KNOWN_LIMITATIONS = deepFreeze([
  'The cell volume of the reference cell (2,425 um^3) could not be confirmed at its primary source: the ' +
  'paper it is attributed to reports a water exchange lifetime and no volume, and PMC holds no full text ' +
  'for it. Everything scaled to the cell volume inherits that.',
  'The cell volume and the nuclear volume are from different papers about different cells and do not fit ' +
  'together: their ratio is 0.41, which is far above what such a cell is ever described with. ' +
  'CELL.nuclear_volume.self_consistent_with_cell_volume is false for this reason, and every compaction ' +
  'and nuclear-fraction result is as wrong as that pair is.',
  'The specific volume that converts mass concentration to volume fraction is derived from ONE deposited ' +
  'structure that is about half nucleic acid by mass, and is applied to a cytoplasm that is mostly ' +
  'protein. The interval is wide enough to cover the difference, which is why it is an interval; it is ' +
  'not a measured partial specific volume of cytoplasm.',
  'Every structure volume is a sphere-union volume on a grid, bracketed between a van der Waals union ' +
  'that underestimates and a probe-dilated union that overestimates. The true excluded volume is ' +
  'somewhere inside, and nothing here locates it. Two of the three structures also have substantial ' +
  'unmodelled mass (17.5 and 18.9 Da per deposited atom), so their low ends are further low than the ' +
  'missing hydrogens alone would make them.',
  'There is no retrieved mammalian measurement of TOTAL macromolecule concentration, only of protein. ' +
  'Every mammalian volume fraction in this file is therefore a lower bound on the real crowding.',
  'The mammalian RNA polymerase II count, the DNA polymerase count and the DNA polymerase volume are all ' +
  'null with reasons. A viewer that draws replication forks is drawing objects this file has no count ' +
  'and no size for, and must say so.',
  'The nucleosome count is a ceiling: it divides a genome length by a repeat length and assumes regular ' +
  'arrays everywhere. Measured occupancy is below that at promoters and at bound factor sites.',
  'The reference cell line is hypertriploid. The diploid genome arithmetic reported as the general case ' +
  'is the wrong input for this particular cell by about a third, and both are given rather than one ' +
  'being quietly substituted for the other.',
  'Nothing here is a rate. The viewer will want elongation rates, replication fork speeds and diffusion ' +
  'coefficients, and this file contains none: no rate was retrieved this session, and a rate written ' +
  'from memory would be the worst thing in the file.',
]);

// ---------------------------------------------------------------------------- worked example

export function worked() {
  const w = WORKED_INVENTORY;
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  const lines = [];
  lines.push('budget.mjs - volume and crowding audit');
  lines.push(`  cell: ${CELL.cell_type}`);
  lines.push(`    volume ${CELL.volume.value} um^3 (compiled; range across lines ${CELL.volume.range.join('-')}), +${CELL.volume.cell_cycle_dependence.value}% at mitotic onset`);
  lines.push(`    nucleus ${CELL.nuclear_volume.value} um^3 -> equal-volume sphere diameter ${CELL.nuclear_diameter.value.toFixed(2)} um  [NOT self-consistent with the cell volume]`);
  lines.push('');
  lines.push('  crowding, measured:');
  lines.push(`    microbe, total macromolecules ${CROWDING.microbe.mass_concentration.range.join('-')} g/mL -> ${pct(CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.lo)}-${pct(CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.hi)} of volume`);
  lines.push(`    mammalian, protein only  ${CROWDING.mammalian.mass_concentration.value} g/mL -> ${pct(CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.lo)}-${pct(CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.hi)} of volume`);
  lines.push(`    mean protein centre-to-centre spacing: ${PROTEIN_SPACING.nm.toFixed(2)} nm`);
  lines.push(`    specific volume used: ${SPECIFIC_VOLUME.lo.toFixed(3)}-${SPECIFIC_VOLUME.hi.toFixed(3)} cm^3/g (derived from PDB 1KX5)`);
  lines.push('');
  lines.push('  worked inventory (deliberately incomplete):');
  for (const [name, it] of Object.entries(w.in_the_whole_cell.items)) {
    lines.push(`    ${name.padEnd(11)} n=${it.count.map(c => c.toExponential(2)).join(' .. ')}  V=${it.volume_each_nm3.map(v => v.toFixed(0)).join(' .. ')} nm^3  -> ${pct(it.fraction[0])} .. ${pct(it.fraction[1])} of the cell`);
  }
  lines.push(`    TOTAL ${pct(w.in_the_whole_cell.fraction[0])} .. ${pct(w.in_the_whole_cell.fraction[1])} of the cell, against a measured protein fraction of ${pct(w.compared_with_measured_crowding.measured_protein_volume_fraction[0])} .. ${pct(w.compared_with_measured_crowding.measured_protein_volume_fraction[1])}`);
  lines.push(`    i.e. the inventory accounts for ${pct(w.compared_with_measured_crowding.inventory_as_share_of_measured[0])} .. ${pct(w.compared_with_measured_crowding.inventory_as_share_of_measured[1])} of measured crowding - the rest is listed in what_is_missing_and_why_it_must_be`);
  lines.push('');
  const d = DNA_IN_THE_NUCLEUS;
  lines.push('  DNA in the nucleus, computed:');
  lines.push(`    rise per bp ${d.inputs.rise_per_bp_nm.lo} - ${d.inputs.rise_per_bp_nm.hi} nm (from PDB 1BNA coordinates)`);
  lines.push(`    haploid contour length ${d.contour_length_m.haploid.map(v => v.toFixed(3)).join(' .. ')} m; diploid ${d.contour_length_m.diploid.map(v => v.toFixed(3)).join(' .. ')} m`);
  lines.push(`    compaction against a ${CELL.nuclear_diameter.value.toFixed(2)} um nucleus: ${d.compaction_factor.diploid_against_nuclear_diameter.map(v => v.toExponential(2)).join(' .. ')}`);
  lines.push(`    but the DNA itself is only ${pct(d.dna_volume_in_the_nucleus.fraction_of_nuclear_volume[0])} .. ${pct(d.dna_volume_in_the_nucleus.fraction_of_nuclear_volume[1])} of the nuclear volume`);
  lines.push(`    nucleosomes ${d.nucleosome_spacing_in_the_nucleus.mean_centre_to_centre_nm.map(v => v.toFixed(1)).join(' .. ')} nm apart, centre to centre, for 11 nm particles`);
  lines.push('');
  lines.push(`  ${WHAT_THIS_RULES_OUT.length} depictions ruled out; ${KNOWN_LIMITATIONS.length} known limitations; nulls with reasons: ${nullsWithReasons().length}`);
  return lines.join('\n');
}

/** Every value in this file that is null, with its reason. Enumerated so the gaps are countable. */
export function nullsWithReasons() {
  const out = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Object.hasOwn(node, 'value') && node.value === null && typeof node.null_reason === 'string') {
      out.push({ at: path, units: node.units ?? null, null_reason: node.null_reason, what_would_resolve_it: node.what_would_resolve_it ?? null });
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'value' || typeof v !== 'object' || v === null) continue;
      walk(v, `${path}.${k}`);
    }
  };
  walk(CROWDING, 'CROWDING');
  walk(MACHINES, 'MACHINES');
  walk(DNA_IN_THE_NUCLEUS, 'DNA_IN_THE_NUCLEUS');
  return out;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('budget.mjs')) {
  console.log(worked());
}
