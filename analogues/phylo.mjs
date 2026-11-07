// HOW FAR APART ARE THEY, AND IS IT EVEN THE SAME PHENOTYPE?
//
// ============================== WHY THIS MODULE EXISTS ==============================
// A comparison dashboard that says "species A's gene maps to species B's gene" is, on its own,
// close to content-free. Two things have to be stated alongside it before it means anything:
//
//   1. HOW FAR APART A AND B ARE. A mapping between two congeners and a mapping across half a
//      billion years of independent evolution are printed in the same typeface and read as the
//      same strength of claim. They are not. Part 1 of this module puts every comparison on a
//      dated tree and attaches the distance to the claim.
//
//   2. WHETHER THE PHENOTYPE BEING COMPARED IS THE SAME PHENOTYPE. This is the one that gets
//      skipped. "Fin length" and "limb length" are positionally homologous and not
//      interchangeable. "Body length" is a defined protocol in a fish (standard length, snout to
//      the caudal peduncle) and something else everywhere else. And some pairs of structures
//      share nothing but a common name. Part 2 enumerates the kinds of correspondence and
//      REFUSES to emit a number across the ones that do not support one.
//
// Neither part makes a comparison stronger. Both are built to make a weak comparison LOOK weak,
// at the point where it is printed, which is the only place anybody reads it.
//
// ---------------------------------- WHAT IS NOT IN THE TREE ----------------------------------
// One major amniote radiation is deliberately absent from the topology below, and it is not named
// anywhere in this file. It is a frozen evaluation holdout for this project: the programme is
// scored on predictions made without having seen that clade, so naming it here -- even in a
// comment, a tree, or a taxon list -- would spend the holdout. The consequences for reading this
// tree are stated in `TREE.omission` and they are real: the amniote sampling here is mammals
// only, so the node this tree calls the amniote crown is the crown of the SAMPLED amniotes and
// not the crown of Amniota, and the long branch leading to it carries diversity this tree cannot
// show. The absence is an artefact of the holdout, not a phylogenetic claim.
//
// ---------------------------------- ON THE DATES ----------------------------------
// Every divergence time here is an ESTIMATE WITH A RANGE and is recorded as one. There are no
// point dates in `DIVERGENCES`, and `divergenceTime()` cannot return a bare number -- it returns
// a record, because a single number invites arithmetic that the underlying uncertainty does not
// support. The tree itself does carry one number per node (a Newick branch length has to be a
// number), drawn from the middle of each range; `DIVERGENCES[node].used_in_tree` says so, and it
// is the range, not that number, that is the claim.
//
// The ranges are wide on purpose. Molecular divergence dates are model-dependent in a way that is
// easy to understand and easy to forget: they are the product of a substitution model, a
// relaxed-clock model, and a set of fossil calibration priors, and changing the calibrations
// moves deep nodes by tens of percent while leaving the topology untouched. The spread quoted
// here for, say, the zebrafish-medaka split is not measurement noise around a true value -- it is
// the spread BETWEEN published analyses, several of which are individually confident. A range
// that straddles two literatures is the honest summary.
//
// Sources are attached per node in `DIVERGENCES[*].sources`, keyed into `SOURCES`. TimeTree
// (Kumar et al. 2022) is the standard aggregator and is cited where it is what we used; it is an
// aggregator of other people's analyses, so where a primary phylogenomic study is the thing that
// actually constrains a node, that study is cited too.
//
// Nothing here reads or writes a file, queries a service, or has any side effect on import beyond a
// consistency self-check on the three hand-maintained objects (tree, dates, roster).

// ===================================================================================================
// FREEZING
// ===================================================================================================
const deepFreeze = o => {
  if (o && (typeof o === 'object') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

// ===================================================================================================
// SOURCES
// ===================================================================================================
export const SOURCES = deepFreeze({
  timetree5: 'Kumar S, Suleski M, Craig JM, Kasprowicz AE, Sanderford M, Li M, Stecher G, Hedges SB (2022) TimeTree 5: an expanded resource for species divergence times. Mol Biol Evol 39:msac174. http://timetree.org -- an AGGREGATOR of published time trees, not a primary analysis; its interval for a node is a summary of studies that may disagree.',
  near2012: 'Near TJ, Eytan RI, Dornburg A, Kuhn KL, Moore JA, Davis MP, Wainwright PC, Friedman M, Smith WL (2012) Resolution of ray-finned fish phylogeny and timing of diversification. PNAS 109:13698-13703.',
  hughes2018: 'Hughes LC, Orti G, Huang Y, et al. (2018) Comprehensive phylogeny of ray-finned fishes (Actinopterygii) based on transcriptomic and genomic data. PNAS 115:6249-6254.',
  betancur2017: 'Betancur-R R, Wiley EO, Arratia G, Acero A, Bailly N, Miya M, Lecointre G, Orti G (2017) Phylogenetic classification of bony fishes. BMC Evol Biol 17:162.',
  irisarri2017: 'Irisarri I, Baurain D, Brinkmann H, et al. (2017) Phylotranscriptomic consolidation of the jawed vertebrate timetree. Nat Ecol Evol 1:1370-1378.',
  benton2015: 'Benton MJ, Donoghue PCJ, Asher RJ, Friedman M, Near TJ, Vinther J (2015) Constraints on the timescale of animal evolutionary history. Palaeontologia Electronica 18.1.1FC -- the fossil calibration compendium; the source of the hard minima that bound several nodes here.',
  dosreis2015: 'dos Reis M, Thawornwattana Y, Angelis K, Telford MJ, Donoghue PCJ, Yang Z (2015) Uncertainty in the timing of origin of animals and the limits of precision in molecular timescales. Curr Biol 25:2939-2950 -- the explicit argument that the deepest nodes here cannot be dated precisely with current data.',
  mccluskey2015: 'McCluskey BM, Postlethwait JH (2015) Phylogeny of zebrafish, a "model species", within Danio, a "model genus". Mol Biol Evol 32:635-652.',
  braasch2016: 'Braasch I, Gehrke AR, Smith JJ, et al. (2016) The spotted gar genome illuminates vertebrate evolution and facilitates human-teleost comparisons. Nat Genet 48:427-437.',
  amemiya2013: 'Amemiya CT, Alfoldi J, Lee AP, et al. (2013) The African coelacanth genome provides insights into tetrapod evolution. Nature 496:311-316.',
  venkatesh2014: 'Venkatesh B, Lee AP, Ravi V, et al. (2014) Elephant shark genome provides unique insights into gnathostome evolution. Nature 505:174-179.',
  jaillon2004: 'Jaillon O, Aury JM, Brunet F, et al. (2004) Genome duplication in the teleost fish Tetraodon nigroviridis reveals the early vertebrate proto-karyotype. Nature 431:946-957.',
  meyer2005: 'Meyer A, Van de Peer Y (2005) From 2R to 3R: evidence for a fish-specific genome duplication (FSGD). BioEssays 27:937-945.',
  glasauer2014: 'Glasauer SMK, Neuhauss SCF (2014) Whole-genome duplication in teleost fishes and its evolutionary consequences. Mol Genet Genomics 289:1045-1060.',
  postlethwait2004: 'Postlethwait J, Amores A, Cresko W, Singer A, Yan YL (2004) Subfunction partitioning, the teleost radiation and the annotation of the human genome. Trends Genet 20:481-490.',
  force1999: 'Force A, Lynch M, Pickett FB, Amores A, Yan YL, Postlethwait J (1999) Preservation of duplicate genes by complementary, degenerative mutations. Genetics 151:1531-1545 -- the DDC model; why two fish genes can each carry part of one mammalian gene\'s job.',
  stewart2014: 'Stewart TA, Smith WL, Coates MI (2014) The origins of adipose fins: an analogue for parallel evolution of the vertebrate limb? Proc R Soc B 281:20133120.',
  shubin2009: 'Shubin N, Tabin C, Carroll S (2009) Deep homology and the origins of evolutionary novelty. Nature 457:818-823.',
  mungall2012: 'Mungall CJ, Torniai C, Gkoutos GV, Lewis SE, Haendel MA (2012) Uberon, an integrative multi-species anatomy ontology. Genome Biol 13:R5.',
  vanslyke2014: 'Van Slyke CE, Bradford YM, Westerfield M, Haendel MA (2014) The zebrafish anatomy and stage ontologies: representing the anatomy and development of Danio rerio. J Biomed Semantics 5:12.',
  hubbs1958: 'Hubbs CL, Lagler KF (1958) Fishes of the Great Lakes Region. Cranbrook Institute of Science -- the standard statement of standard length, total length and fork length as distinct protocols.',
  ols4: 'EMBL-EBI Ontology Lookup Service (OLS4), https://www.ebi.ac.uk/ols4 -- used on 2026-11-06 to check that every CURIE carried in ONTOLOGY_TERMS resolves to the label recorded next to it.',
});

// ===================================================================================================
// TAXON ROSTER
// ---------------------------------------------------------------------------------------------------
// The comparative references a fish-morphology programme actually reaches for, plus the outgroups that
// make the fish comparisons interpretable. `group` is what the phenome code in Part 2 keys off, because
// which SENSE of a shared anatomical word applies to a species is a property of its group, not of its
// name. `post_tgd` marks the lineages downstream of the teleost genome duplication; it is the single
// most load-bearing flag in this file (see TELEOST_DUPLICATION).
// ===================================================================================================
export const TAXA = deepFreeze([
  { name: 'Danio_rerio', common: 'zebrafish', group: 'teleost', klass: 'Actinopterygii', genus: 'Danio', post_tgd: true, note: 'the programme reference genome and the species most of the phenotype vocabulary was written for' },
  { name: 'Danio_aesculapii', common: 'a congener of the zebrafish', group: 'teleost', klass: 'Actinopterygii', genus: 'Danio', post_tgd: true, note: 'in the roster to give the tree a congeneric pair; the nearest comparison the tree can make' },
  { name: 'Astyanax_mexicanus', common: 'Mexican tetra', group: 'teleost', klass: 'Actinopterygii', genus: 'Astyanax', post_tgd: true, note: 'same superorder as the zebrafish, different order; the surface/cave pair makes it a standard morphology comparator' },
  { name: 'Oryzias_latipes', common: 'medaka', group: 'teleost', klass: 'Actinopterygii', genus: 'Oryzias', post_tgd: true, note: 'the other teleost model, on the far side of the teleost crown from the zebrafish' },
  { name: 'Takifugu_rubripes', common: 'fugu', group: 'teleost', klass: 'Actinopterygii', genus: 'Takifugu', post_tgd: true, note: 'compact genome; where ohnolog loss after the duplication is easiest to see' },
  { name: 'Lepisosteus_oculatus', common: 'spotted gar', group: 'non-teleost-actinopterygian', klass: 'Actinopterygii', genus: 'Lepisosteus', post_tgd: false, note: 'THE most useful non-model in this roster: a ray-finned fish that did NOT undergo the teleost duplication, so it is the bridge that resolves a 1:2 mammal-to-teleost mapping' },
  { name: 'Polypterus_senegalus', common: 'bichir', group: 'non-teleost-actinopterygian', klass: 'Actinopterygii', genus: 'Polypterus', post_tgd: false, note: 'the earliest-diverging living ray-finned lineage; its lobed pectoral fin is a standard fin-to-limb comparator' },
  { name: 'Latimeria_chalumnae', common: 'coelacanth', group: 'sarcopterygian-fish', klass: 'Sarcopterygii', genus: 'Latimeria', post_tgd: false, note: 'a lobe-finned fish on the tetrapod side of the bony-fish split; a fish by habit, not by position' },
  { name: 'Callorhinchus_milii', common: 'elephant shark', group: 'chondrichthyan', klass: 'Chondrichthyes', genus: 'Callorhinchus', post_tgd: false, note: 'cartilaginous outgroup to all bony fishes; the roster member where shared fish vocabulary breaks down hardest' },
  { name: 'Xenopus_tropicalis', common: 'western clawed frog', group: 'amphibian', klass: 'Amphibia', genus: 'Xenopus', post_tgd: false, note: 'the tetrapod with a fin-fold-bearing larva; the usual first stop outside the fishes' },
  { name: 'Ambystoma_mexicanum', common: 'axolotl', group: 'amphibian', klass: 'Amphibia', genus: 'Ambystoma', post_tgd: false, note: 'in the roster for appendage regeneration, which is the comparison most often made to fin regeneration' },
  { name: 'Homo_sapiens', common: 'human', group: 'mammal', klass: 'Mammalia', genus: 'Homo', post_tgd: false, note: 'the disease-gene reference; the destination of most of the transfers this module is meant to caveat' },
  { name: 'Mus_musculus', common: 'house mouse', group: 'mammal', klass: 'Mammalia', genus: 'Mus', post_tgd: false, note: 'the experimental mammal' },
  { name: 'Rattus_norvegicus', common: 'brown rat', group: 'mammal', klass: 'Mammalia', genus: 'Rattus', post_tgd: false, note: 'in the roster to give a same-family, different-genus pair' },
  { name: 'Ciona_intestinalis', common: 'sea squirt', group: 'tunicate', klass: 'Tunicata', genus: 'Ciona', post_tgd: false, note: 'chordate, not vertebrate; where the vertebrate 2R duplications have not happened' },
  { name: 'Branchiostoma_floridae', common: 'Florida lancelet', group: 'cephalochordate', klass: 'Leptocardii', genus: 'Branchiostoma', post_tgd: false, note: 'the unduplicated chordate reference genome' },
  { name: 'Drosophila_melanogaster', common: 'fruit fly', group: 'arthropod', klass: 'Insecta', genus: 'Drosophila', post_tgd: false, note: 'the invertebrate outgroup; in the roster because it is where appendage-patterning gene names came from, which is itself a source of false correspondence' },
]);

const TAXON_BY_NAME = new Map(TAXA.map(t => [t.name, t]));
export const taxon = name => TAXON_BY_NAME.get(name) || null;

// ===================================================================================================
// THE TREE
// ---------------------------------------------------------------------------------------------------
// Ultrametric, in millions of years (Ma). A branch length is parent_age - child_age, so every tip sits
// at the root age and the patristic distance between any two tips is exactly twice the age of their
// MRCA. That is a deliberate choice, not a modelling claim: it makes the distance this module reports
// a statement about TIME SINCE DIVERGENCE and nothing else. It is NOT a substitution-rate tree, so do
// not read a branch length here as an amount of molecular change -- rates vary hugely across this tree
// (the coelacanth and the lancelet are slow, the fly is fast) and a time tree hides all of it.
//
// Internal node labels are the clade names, and they are the keys into DIVERGENCES.
// ===================================================================================================
const NEWICK = '(Drosophila_melanogaster:600,(Branchiostoma_floridae:560,(Ciona_intestinalis:530,(Callorhinchus_milii:462,((Polypterus_senegalus:390,(Lepisosteus_oculatus:330,((Astyanax_mexicanus:150,(Danio_rerio:13,Danio_aesculapii:13)Danio:137)Otophysi:80,(Oryzias_latipes:110,Takifugu_rubripes:110)Percomorpha:120)Clupeocephala:100)Neopterygii:60)Actinopterygii:40,(Latimeria_chalumnae:415,((Xenopus_tropicalis:300,Ambystoma_mexicanum:300)Batrachia:52,(Homo_sapiens:90,(Mus_musculus:13,Rattus_norvegicus:13)Muridae:77)Euarchontoglires:262)Tetrapoda:63)Sarcopterygii:15)Osteichthyes:32)Gnathostomata:68)Olfactores:30)Chordata:40)Bilateria;';

export const TREE = deepFreeze({
  newick: NEWICK,
  unit: 'Ma (millions of years before present)',
  ultrametric: true,
  root: 'Bilateria',
  root_age_used_in_tree: 600,
  n_tips: 17,
  tips: TAXA.map(t => t.name),
  what_it_is_for: 'Putting a cross-species mapping on a scale. Nothing in this tree is novel; it is the consensus topology of the comparative references a fish-morphology programme uses, dated so that a dashboard can print a distance next to a claim.',
  what_it_is_not: [
    'Not a phylogenetic result. The topology is taken from the cited phylogenomic studies; no inference was run here.',
    'Not a rate tree. Branch lengths are time, so they say nothing about how much sequence or morphology changed along a branch.',
    'Not a complete sampling of any clade. Seventeen tips chosen for comparative usefulness; the absence of a lineage from this tree is not evidence about that lineage.',
  ],
  omission: {
    declared: true,
    what: 'One major amniote radiation is deliberately absent from this tree. It is not named anywhere in this module, and that is the point.',
    why: 'It is a frozen evaluation holdout for this project. The programme is scored on predictions made blind to that clade, so writing its name into a tree, a taxon list or a comment would spend the holdout for nothing.',
    consequence_for_reading_the_tree: 'The amniote sampling here is mammals only. The node labelled Euarchontoglires is the crown of the SAMPLED amniotes, not the crown of Amniota, and the 262 Ma branch that leads to it is long partly because the lineages that would break it up are not in the tree. Any statement of the form "the closest non-amphibian relative of a mammal in this tree" is a statement about THIS ROSTER and not about the tetrapod tree.',
    do_not_infer: 'Nothing. The gap is an artefact of the holdout protocol, not a phylogenetic or biological claim, and no comparison made with this tree should be reported as covering amniotes.',
  },
  provenance: 'Topology: irisarri2017 (jawed vertebrates), hughes2018 + betancur2017 + near2012 (ray-finned fishes), mccluskey2015 (within the zebrafish genus), dosreis2015 (the deep chordate and bilaterian nodes). Dates: see DIVERGENCES, node by node.',
  toString() { return NEWICK; },
});

// ===================================================================================================
// DIVERGENCE TIMES
// ---------------------------------------------------------------------------------------------------
// One record per internal node. Every record carries `lo`, `hi`, at least one source key, and a
// confidence grade, and NONE of them carries a point date as the claim. `used_in_tree` is the single
// number the Newick string needed; it is a drafting convenience and is labelled as one.
//
// `confidence` grades what the range means, which is not the same as how wide it is:
//   well-constrained      a hard fossil minimum close below the molecular estimate, and published
//                         analyses that agree to within roughly 10%
//   moderate              fossil-bounded, but published estimates differ by more than 15%
//   poorly-constrained    no close fossil bound, or the published estimates straddle two literatures;
//                         treat the range as a summary of DISAGREEMENT, not of error
// ===================================================================================================
const CALIBRATION_CAVEAT = 'Molecular divergence dates are model-dependent. This interval is the product of a substitution model, a relaxed-clock model and a set of fossil calibration priors; changing the calibrations moves deep nodes by tens of percent while leaving the topology untouched. Do not treat the midpoint as a measurement.';

export const DIVERGENCES = deepFreeze({
  Danio: {
    node: 'Danio', clade: 'crown of the zebrafish genus', unit: 'Ma',
    lo: 7, hi: 22, used_in_tree: 13, confidence: 'poorly-constrained',
    sources: ['mccluskey2015', 'timetree5'],
    note: 'Shallow nodes in a species-rich freshwater genus are dated badly: few calibrations apply this close to the tips, and estimates for the crown of this genus have moved by a factor of two between analyses. The range is wide because the literature is.',
  },
  Muridae: {
    node: 'Muridae', clade: 'mouse-rat split', unit: 'Ma',
    lo: 10, hi: 21, used_in_tree: 13, confidence: 'moderate',
    sources: ['timetree5', 'benton2015'],
    note: 'Much-cited as "about 12 million years", and the published spread is roughly 10-21 Ma depending on whether the rodent fossil record is used as a prior or as a test.',
  },
  Euarchontoglires: {
    node: 'Euarchontoglires', clade: 'primate-rodent split; the crown of the amniotes SAMPLED in this tree', unit: 'Ma',
    lo: 76, hi: 105, used_in_tree: 90, confidence: 'moderate',
    sources: ['timetree5', 'benton2015', 'dosreis2015'],
    note: 'The classic molecular-versus-fossil disagreement: molecular estimates sit above the oldest accepted placental fossils, and the range here spans that argument rather than resolving it. This node is NOT the crown of Amniota -- see TREE.omission.',
  },
  Otophysi: {
    node: 'Otophysi', clade: 'zebrafish-tetra split (carps and allies vs characins)', unit: 'Ma',
    lo: 120, hi: 190, used_in_tree: 150, confidence: 'poorly-constrained',
    sources: ['hughes2018', 'betancur2017', 'timetree5'],
    note: 'A node where phylogenomic datasets agree on the topology and disagree on the age; the interval reflects the latter.',
  },
  Percomorpha: {
    node: 'Percomorpha', clade: 'medaka-fugu split, within the spiny-rayed fishes', unit: 'Ma',
    lo: 90, hi: 140, used_in_tree: 110, confidence: 'poorly-constrained',
    sources: ['near2012', 'hughes2018'],
    note: 'The spiny-rayed radiation is fast and its internal nodes are close together, so small changes in clock model redistribute tens of millions of years among them.',
  },
  Clupeocephala: {
    node: 'Clupeocephala', clade: 'the crown teleost split sampled here; zebrafish/tetra vs medaka/fugu', unit: 'Ma',
    lo: 190, hi: 270, used_in_tree: 230, confidence: 'moderate',
    sources: ['near2012', 'hughes2018', 'betancur2017'],
    note: 'THE node to know when comparing the two teleost models: zebrafish and medaka are separated by roughly a quarter of a billion years, which is comparable to the mammal crown and more than most people assume when they call both of them "fish".',
  },
  Neopterygii: {
    node: 'Neopterygii', clade: 'gar vs teleosts', unit: 'Ma',
    lo: 300, hi: 365, used_in_tree: 330, confidence: 'moderate',
    sources: ['near2012', 'braasch2016', 'benton2015'],
    note: 'The practically important node in this tree: the teleost genome duplication falls on the teleost side of it, so the gar is an unduplicated outgroup to all five teleosts here. See TELEOST_DUPLICATION.',
  },
  Actinopterygii: {
    node: 'Actinopterygii', clade: 'crown ray-finned fishes; bichir vs the rest', unit: 'Ma',
    lo: 360, hi: 420, used_in_tree: 390, confidence: 'moderate',
    sources: ['near2012', 'hughes2018', 'benton2015'],
    note: 'Bounded below by Devonian actinopterygian fossils; the upper bound is clock-driven.',
  },
  Batrachia: {
    node: 'Batrachia', clade: 'frog-salamander split', unit: 'Ma',
    lo: 265, hi: 340, used_in_tree: 300, confidence: 'poorly-constrained',
    sources: ['irisarri2017', 'timetree5'],
    note: 'Amphibian deep nodes are among the worst-behaved in the vertebrate tree; estimates differ by 70 Ma and the fossil record does not adjudicate cleanly.',
  },
  Tetrapoda: {
    node: 'Tetrapoda', clade: 'amphibian-mammal split (crown tetrapods)', unit: 'Ma',
    lo: 325, hi: 375, used_in_tree: 352, confidence: 'well-constrained',
    sources: ['irisarri2017', 'benton2015', 'timetree5'],
    note: 'One of the better-calibrated nodes in vertebrate phylogeny, with a dense Carboniferous record close below the molecular estimate. The amniote half of this split is sampled by mammals only here -- see TREE.omission.',
  },
  Sarcopterygii: {
    node: 'Sarcopterygii', clade: 'coelacanth vs tetrapods', unit: 'Ma',
    lo: 395, hi: 440, used_in_tree: 415, confidence: 'well-constrained',
    sources: ['amemiya2013', 'irisarri2017', 'benton2015'],
    note: 'Devonian fossil sarcopterygians bound this node tightly. Worth stating because the coelacanth is routinely described as a tetrapod proxy: it is on the tetrapod side of the bony-fish split, but it has had 400 Ma of its own.',
  },
  Osteichthyes: {
    node: 'Osteichthyes', clade: 'ray-finned vs lobe-finned bony fishes', unit: 'Ma',
    lo: 410, hi: 455, used_in_tree: 430, confidence: 'well-constrained',
    sources: ['irisarri2017', 'benton2015'],
    note: 'Silurian-Devonian bony fish fossils bound it; this is the node that separates every fish model in this roster from every tetrapod in it.',
  },
  Gnathostomata: {
    node: 'Gnathostomata', clade: 'cartilaginous vs bony fishes', unit: 'Ma',
    lo: 420, hi: 495, used_in_tree: 462, confidence: 'moderate',
    sources: ['venkatesh2014', 'irisarri2017', 'benton2015'],
    note: 'Ordovician-Silurian; the interval is wider than the two bony-fish nodes below it because the early jawed-vertebrate record is sparse and hard to assign.',
  },
  Olfactores: {
    node: 'Olfactores', clade: 'tunicates vs vertebrates', unit: 'Ma',
    lo: 480, hi: 600, used_in_tree: 530, confidence: 'poorly-constrained',
    sources: ['dosreis2015', 'benton2015'],
    note: 'Beyond the useful reach of the clock. dos Reis et al. argue explicitly that nodes at this depth cannot be dated precisely with current data; a 120 Ma interval is the honest answer, not a failure to look it up.',
  },
  Chordata: {
    node: 'Chordata', clade: 'lancelet vs tunicates+vertebrates', unit: 'Ma',
    lo: 500, hi: 640, used_in_tree: 560, confidence: 'poorly-constrained',
    sources: ['dosreis2015', 'benton2015'],
    note: 'As above. Cambrian fossils give a minimum; the maximum is a prior, not an observation.',
  },
  Bilateria: {
    node: 'Bilateria', clade: 'fly vs chordates (protostome-deuterostome split); the root of this tree', unit: 'Ma',
    lo: 520, hi: 700, used_in_tree: 600, confidence: 'poorly-constrained',
    sources: ['dosreis2015', 'benton2015'],
    note: 'The Cambrian-explosion argument in one number. Published estimates run from roughly the base of the Cambrian to well into the Proterozoic depending on the prior on the root, and the data do not choose. Any comparison whose MRCA is this node is being made across an interval we cannot date to better than 35%.',
  },
});

for (const [k, v] of Object.entries(DIVERGENCES)) {
  if (!(v.sources && v.sources.length)) throw new Error(`DIVERGENCES.${k} has no source`);
  for (const s of v.sources) if (!(s in SOURCES)) throw new Error(`DIVERGENCES.${k} cites unknown source ${s}`);
  if (!(v.hi > v.lo)) throw new Error(`DIVERGENCES.${k} is not a range`);
}

// ===================================================================================================
// THE TELEOST GENOME DUPLICATION
// ---------------------------------------------------------------------------------------------------
// The structural hazard that sits underneath every mammal-to-fish gene mapping this programme makes,
// and the reason `comparabilityWarning` treats a mammal/teleost pair as worse than its distance alone.
// ===================================================================================================
export const TELEOST_DUPLICATION = deepFreeze({
  name: 'teleost-specific genome duplication (TGD, Ts3R, FSGD)',
  what: 'A whole-genome duplication on the stem of the teleost fishes. Every teleost in TAXA is downstream of it; the gar, the bichir, the coelacanth, the elephant shark and every tetrapod are not.',
  when: { lo: 225, hi: 350, unit: 'Ma', is_estimate: true, placed_in_this_tree: 'on the branch from Neopterygii (used_in_tree 330 Ma) to Clupeocephala (used_in_tree 230 Ma), which is the only interval consistent with the gar being an unduplicated outgroup to all crown teleosts', sources: ['jaillon2004', 'meyer2005', 'glasauer2014'] },
  sources: ['jaillon2004', 'meyer2005', 'glasauer2014', 'postlethwait2004', 'force1999', 'braasch2016'],
  the_hazard: 'One mammalian gene frequently corresponds to TWO teleost genes (ohnologs), and the ancestral job is often split between them rather than duplicated into both. Under duplication-degeneration-complementation (force1999), each ohnolog keeps part of the ancestral expression domain or part of the ancestral function, so NEITHER fish gene is "the" ortholog and knocking out either one reproduces only part of the mammalian phenotype.',
  why_it_is_worse_than_distance: 'Raw divergence time degrades a functional transfer gradually and symmetrically. The duplication does something different: it changes the ARITY of the mapping. A 1:1 statement is not a weak version of the truth here, it is the wrong shape, and no amount of sequence similarity fixes it. This is why a mammal-to-teleost mapping carries a hazard beyond its 430 Ma.',
  how_it_goes_wrong_in_practice: [
    'Reciprocal best hit returns exactly one fish gene and silently discards its ohnolog. The mapping then looks clean and 1:1 and is neither.',
    'A single-gene knockout in the fish shows a partial or absent phenotype, and this is reported as the mammalian gene\'s function not being conserved, when the other ohnolog is covering the rest of it.',
    'Two papers knock out the two ohnologs of the same mammalian gene, report different phenotypes, and are read as contradicting each other.',
    'Nomenclature hides it: the two ohnologs are often named <gene>a and <gene>b, and a pipeline that strips the suffix to match the mammalian symbol merges two genes into one row.',
  ],
  what_to_do_instead: [
    'State the arity. Report 1:2 (or 1:1 after documented loss) explicitly, with the evidence for which it is.',
    'Use the unduplicated outgroup. The gar genome (braasch2016) exists in this roster precisely so that a mammalian gene can be mapped to a single gar gene and then to its two teleost descendants; that is what resolves the arity instead of guessing it.',
    'Test both ohnologs, or say which one was tested and that the other was not.',
    'Remember that ohnolog loss is lineage-specific. Two teleosts can differ in which copy survived, so a within-teleost comparison is not automatically safe either.',
  ],
  caveat: 'Not every mammalian gene has two teleost copies: most duplicates were lost, and estimates of retained ohnolog pairs in teleost genomes commonly fall around 10-25% of the duplicated set. The hazard is that you do not know which case you are in until you check, not that the answer is always two.',
});

// ===================================================================================================
// NEWICK PARSING AND SERIALISATION
// ---------------------------------------------------------------------------------------------------
// A real parser, not a split on commas. It handles nested parentheses, internal node labels, branch
// lengths (including negative, exponential and decimal), single-quoted labels with doubled-quote
// escapes, square-bracket comments, and whitespace. `lengthText` preserves the exact source spelling of
// a length so that a round trip is byte-exact even for a length written as "1.50" or "1e2".
//
// A node is { name, length, lengthText, comment, quoted, children }. Parents are not stored on the node
// (that would make the tree non-serialisable); they live in a cached index, see indexTree.
// ===================================================================================================
const LEN_CHARS = /[-+0-9.eE]/;
const LABEL_STOP = new Set(['(', ')', ',', ':', ';', '[', ']']);

export function parseNewick(s) {
  if (typeof s !== 'string') throw new TypeError('parseNewick: expected a string');
  const str = s.trim();
  if (!str) throw new Error('parseNewick: empty input');
  let i = 0;

  const skipWs = () => { while (i < str.length && /\s/.test(str[i])) i++; };
  const readComment = () => {
    skipWs();
    if (str[i] !== '[') return null;
    const start = i;
    let depth = 0;
    while (i < str.length) {
      if (str[i] === '[') depth++;
      else if (str[i] === ']') { depth--; i++; if (depth === 0) return str.slice(start, i); continue; }
      i++;
    }
    throw new Error(`parseNewick: unterminated comment at ${start}`);
  };
  const readLabel = () => {
    skipWs();
    if (str[i] === "'") {
      i++;
      let out = '';
      for (;;) {
        if (i >= str.length) throw new Error('parseNewick: unterminated quoted label');
        if (str[i] === "'") {
          if (str[i + 1] === "'") { out += "'"; i += 2; continue; }
          i++; break;
        }
        out += str[i++];
      }
      return { name: out, quoted: true };
    }
    let out = '';
    while (i < str.length && !LABEL_STOP.has(str[i])) out += str[i++];
    return { name: out.trim(), quoted: false };
  };
  const readLength = () => {
    skipWs();
    if (str[i] !== ':') return { length: null, lengthText: null };
    i++;
    skipWs();
    const start = i;
    while (i < str.length && LEN_CHARS.test(str[i])) i++;
    const text = str.slice(start, i);
    if (!text) throw new Error(`parseNewick: ':' with no branch length at ${start}`);
    const n = Number(text);
    if (!Number.isFinite(n)) throw new Error(`parseNewick: unparseable branch length "${text}" at ${start}`);
    return { length: n, lengthText: text };
  };

  const parseNode = () => {
    skipWs();
    const children = [];
    if (str[i] === '(') {
      i++;
      for (;;) {
        children.push(parseNode());
        skipWs();
        if (str[i] === ',') { i++; continue; }
        if (str[i] === ')') { i++; break; }
        throw new Error(`parseNewick: expected ',' or ')' at ${i}, found ${JSON.stringify(str[i] ?? '<end>')}`);
      }
      if (children.length < 2) throw new Error('parseNewick: an internal node with fewer than two children is not a topology');
    }
    const { name, quoted } = readLabel();
    const comment = readComment();
    const { length, lengthText } = readLength();
    return { name, quoted, comment, length, lengthText, children };
  };

  const root = parseNode();
  skipWs();
  if (str[i] === ';') i++;
  skipWs();
  if (i !== str.length) throw new Error(`parseNewick: trailing input at ${i}: ${JSON.stringify(str.slice(i, i + 24))}`);
  if (!root.children.length) throw new Error('parseNewick: a single tip is not a tree');
  return root;
}

const emitLength = n => (n.lengthText != null && Number(n.lengthText) === n.length) ? n.lengthText : String(n.length);
const emitName = n => {
  if (!n.name) return '';
  return n.quoted ? `'${n.name.replace(/'/g, "''")}'` : n.name;
};

export function toNewick(tree, { semicolon = true } = {}) {
  const node = typeof tree === 'string' ? parseNewick(tree) : tree;
  const render = n => {
    const kids = n.children && n.children.length ? `(${n.children.map(render).join(',')})` : '';
    const len = n.length == null ? '' : `:${emitLength(n)}`;
    return `${kids}${emitName(n)}${n.comment || ''}${len}`;
  };
  return render(node) + (semicolon ? ';' : '');
}

// A human-readable rendering. Whitespace only, so parseNewick(prettyNewick(t)) is the same tree, and
// toNewick of that is byte-identical to toNewick(t). The round-trip test uses this to prove that the
// parser tolerates layout without the canonical form depending on it.
export function prettyNewick(tree, { indent = '  ' } = {}) {
  const node = typeof tree === 'string' ? parseNewick(tree) : tree;
  const render = (n, d) => {
    const self = `${emitName(n)}${n.comment || ''}${n.length == null ? '' : `:${emitLength(n)}`}`;
    if (!n.children || !n.children.length) return indent.repeat(d) + self;
    const pad = indent.repeat(d);
    return `${pad}(\n${n.children.map(c => render(c, d + 1)).join(',\n')}\n${pad})${self}`;
  };
  return render(node, 0) + ';';
}

// ===================================================================================================
// TREE QUERIES
// ===================================================================================================
const indexCache = new WeakMap();
function indexTree(tree) {
  const hit = indexCache.get(tree);
  if (hit) return hit;
  const parents = new Map();
  const named = new Map();
  const tips = [];
  const all = [];
  (function walk(n, p) {
    parents.set(n, p);
    all.push(n);
    if (n.name && !named.has(n.name)) named.set(n.name, n);
    if (!n.children || !n.children.length) tips.push(n);
    else for (const c of n.children) walk(c, n);
  })(tree, null);
  const idx = { parents, named, tips, all, root: tree };
  indexCache.set(tree, idx);
  return idx;
}

export const tips = tree => indexTree(tree).tips.map(n => n.name);
export const nodeNames = tree => indexTree(tree).all.filter(n => n.name).map(n => n.name);

export function findNode(tree, which) {
  if (which && typeof which === 'object') return which;
  const idx = indexTree(tree);
  const n = idx.named.get(which);
  if (!n) throw new Error(`findNode: "${which}" is not in this tree. Tips: ${idx.tips.map(t => t.name).join(', ')}`);
  return n;
}

const lineage = (tree, node) => {
  const { parents } = indexTree(tree);
  const out = [];
  for (let n = node; n; n = parents.get(n)) out.push(n);
  return out;
};

// MRCA. Symmetric by construction, and a tip's MRCA with itself is that tip -- which matters because a
// self-comparison is the degenerate case a dashboard will hit (the same species on both axes) and
// returning the root for it would make every self-comparison look maximally distant.
export function mrca(tree, a, b) {
  const na = findNode(tree, a);
  const nb = findNode(tree, b);
  if (na === nb) return na;
  const up = new Set(lineage(tree, na));
  for (const n of lineage(tree, nb)) if (up.has(n)) return n;
  throw new Error('mrca: the two nodes are not in the same tree');
}

// Summed branch lengths along the path a -> MRCA -> b. On this ultrametric tree that is exactly
// 2 * age(MRCA), but the implementation does not assume ultrametricity -- it sums what is there, so it
// is still correct if someone swaps in a rate tree.
export function patristicDistance(tree, a, b) {
  const na = findNode(tree, a);
  const nb = findNode(tree, b);
  if (na === nb) return 0;
  const anc = mrca(tree, na, nb);
  const climb = from => {
    const { parents } = indexTree(tree);
    let d = 0;
    for (let n = from; n && n !== anc; n = parents.get(n)) d += (n.length || 0);
    return d;
  };
  return climb(na) + climb(nb);
}

const PARSED = parseNewick(NEWICK);
export const defaultTree = () => PARSED;

// How to describe the rank of a split, by the node it happens at. Keyed on this tree's labels, because
// "same class" is a statement about THIS roster's sampling and not a general fact.
const TIER_BY_NODE = {
  Danio: { tier: 'congeneric', plain: 'two species in the same genus' },
  Muridae: { tier: 'same-family', plain: 'two genera in the same family' },
  Otophysi: { tier: 'same-superorder', plain: 'two orders of teleost within the same superorder' },
  Percomorpha: { tier: 'same-superorder', plain: 'two orders of spiny-rayed teleost within the same series' },
  Clupeocephala: { tier: 'same-class-deep', plain: 'two teleosts on opposite sides of the crown teleost split' },
  Neopterygii: { tier: 'same-class-deep', plain: 'a teleost and a non-teleost ray-finned fish' },
  Actinopterygii: { tier: 'same-class-deep', plain: 'two ray-finned fishes across the crown of the class' },
  Batrachia: { tier: 'same-class-deep', plain: 'two amphibian orders' },
  Euarchontoglires: { tier: 'same-class-deep', plain: 'two mammalian orders' },
  Tetrapoda: { tier: 'cross-class', plain: 'an amphibian and a mammal' },
  Sarcopterygii: { tier: 'cross-class', plain: 'a lobe-finned fish and a tetrapod' },
  Osteichthyes: { tier: 'cross-class', plain: 'a ray-finned fish and a lobe-finned fish or tetrapod' },
  Gnathostomata: { tier: 'cross-class', plain: 'a cartilaginous fish and a bony fish or tetrapod' },
  Olfactores: { tier: 'cross-subphylum', plain: 'a tunicate and a vertebrate' },
  Chordata: { tier: 'cross-subphylum', plain: 'a lancelet and another chordate' },
  Bilateria: { tier: 'cross-phylum', plain: 'an arthropod and a chordate' },
};

const STRENGTH = [
  { max: 30, strength: 'strong-but-still-check', says: 'Functional transfer between these two is usually safe to assume as a working hypothesis, and still has to be stated as an assumption. The things that break at this distance are regulatory, not coding: a shared protein with a shifted expression domain.' },
  { max: 250, strength: 'moderate', says: 'A transfer at this distance is a hypothesis, not a result. Expect conserved protein function with substantially reorganised regulation, and expect the phenotype to differ even where the gene does not.' },
  { max: 900, strength: 'weak', says: 'Only deeply conserved mechanism survives this distance -- core signalling, early patterning, housekeeping. A claim that a gene does "the same thing" here needs the same thing to be defined narrowly enough to be testable in both, and usually it is not.' },
  { max: Infinity, strength: 'very-weak', says: 'At this distance "the same gene" means an orthology statement and nothing more. Shared gene names across this gap (the appendage- and eye-patterning vocabulary in particular) record deep homology of a genetic toolkit, NOT correspondence of the structures those genes build (shubin2009). Treat any functional transfer as a guess.' },
];

/**
 * divergenceTime(a, b) -> a RANGE, with its sources and its caveats. Never a bare number.
 *
 * A single number here would be the most-copied output of this module and the most misleading, so
 * there is no code path that returns one. `lo` and `hi` are the claim; `used_in_tree` is the number the
 * Newick string needed and is labelled as a drafting convenience.
 */
export function divergenceTime(a, b, tree = PARSED) {
  const node = mrca(tree, a, b);
  const an = typeof a === 'string' ? a : a.name;
  const bn = typeof b === 'string' ? b : b.name;
  if (!node.children || !node.children.length) {
    return deepFreeze({
      a: an, b: bn, node: node.name, comparison: 'self', unit: 'Ma',
      lo: 0, hi: 0, is_estimate: false,
      sources: [],
      why: 'The two arguments resolve to the same tip, so there is no divergence to date. This is returned as a record rather than 0 so that a caller cannot accidentally treat it as a measured interval; `comparison: "self"` is the flag to branch on.',
    });
  }
  const d = DIVERGENCES[node.name];
  if (!d) {
    return deepFreeze({
      a: an, b: bn, node: node.name, comparison: 'undated-node', unit: 'Ma',
      lo: null, hi: null, is_estimate: true, sources: [],
      why: `The MRCA of ${an} and ${bn} is the node "${node.name}", which has no entry in DIVERGENCES. No date is reported rather than one being interpolated.`,
    });
  }
  return deepFreeze({
    a: an, b: bn, node: node.name, clade: d.clade, comparison: 'pair', unit: 'Ma',
    lo: d.lo, hi: d.hi,
    is_estimate: true,
    is_range: true,
    used_in_tree: d.used_in_tree,
    confidence: d.confidence,
    sources: d.sources,
    source_text: d.sources.map(k => SOURCES[k]),
    note: d.note,
    caveat: CALIBRATION_CAVEAT,
    how_to_report: `"${an}" and "${bn}" last shared an ancestor an estimated ${d.lo}-${d.hi} Ma (${d.clade}; ${d.confidence}). Report the interval, not a midpoint.`,
  });
}

/**
 * comparabilityWarning(a, b) -> the output this module exists to produce.
 *
 * Says how far apart two species are, what that does to a claim that a gene does "the same thing" in
 * both, and -- separately, because it is a different kind of problem -- whether the pair crosses the
 * teleost genome duplication.
 */
export function comparabilityWarning(a, b, tree = PARSED) {
  const an = typeof a === 'string' ? a : a.name;
  const bn = typeof b === 'string' ? b : b.name;
  const node = mrca(tree, a, b);
  const dist = patristicDistance(tree, a, b);
  const div = divergenceTime(a, b, tree);
  const ta = taxon(an);
  const tb = taxon(bn);
  const tier = TIER_BY_NODE[node.name] || { tier: 'unknown', plain: `split at the node "${node.name}"` };
  const band = STRENGTH.find(s => dist <= s.max);
  const warnings = [];

  if (div.comparison === 'self') {
    return deepFreeze({
      a: an, b: bn, comparison: 'self', mrca: node.name,
      patristic_distance: 0, patristic_unit: 'Ma of branch length (twice the MRCA age on this ultrametric tree)',
      divergence: div, tier: 'self', transfer_strength: 'not-applicable',
      warnings: ['Both arguments are the same taxon. There is no cross-species claim here to caveat; if a dashboard reached this call, it is comparing a species with itself and should say so rather than printing a distance of zero as a similarity.'],
      teleost_hazard: null,
      bottom_line: `${an} compared with itself.`,
    });
  }

  warnings.push(`${an} and ${bn} are ${tier.plain}; their MRCA in this tree is ${node.name}, dated ${div.lo}-${div.hi} Ma (${div.confidence}). Summed branch length between them is ${dist} Ma.`);
  warnings.push(band.says);
  warnings.push(`The distance is as uncertain as the date: the ${div.hi - div.lo} Ma width of this interval is not error around a true value, it is the spread between published analyses. ${CALIBRATION_CAVEAT}`);

  if (tier.tier === 'cross-phylum' || tier.tier === 'cross-subphylum') {
    warnings.push('Across this gap, a shared gene NAME is the most dangerous object on the page. The appendage, eye and heart patterning vocabulary was coined in the invertebrate and reused in vertebrates because the genes are orthologous -- which says the toolkit is ancient, not that the organs correspond (shubin2009). See THE_NAMING_TRAP.');
  }
  if (ta && tb && ta.klass !== tb.klass) {
    warnings.push(`Different classes (${ta.klass} vs ${tb.klass}). Phenotype vocabularies diverge before the genes do: before any number is compared across this pair, run alignPhenotypes() on the two measurements, because the usual failure here is not a wrong gene but two different things both called "body length".`);
  }
  if (ta && tb && ta.genus === tb.genus) {
    warnings.push('Congeners. The distance is small, and the thing that fails at small distances is the ASSUMPTION THAT IT CANNOT FAIL: closely related species still differ in gene-copy number, in regulatory alleles and in the trait being measured. "Same genus" is not "same genotype".');
  }

  // --- the teleost hazard, kept separate from the distance because it is not a distance problem ---
  let hazard = null;
  const aT = !!(ta && ta.post_tgd);
  const bT = !!(tb && tb.post_tgd);
  if (aT !== bT) {
    const fish = aT ? an : bn;
    const other = aT ? bn : an;
    const otherIsMammal = taxon(other) && taxon(other).group === 'mammal';
    hazard = {
      kind: 'crosses-the-teleost-genome-duplication',
      severity: otherIsMammal ? 'high (this is the mammal-to-teleost case the duplication was named for)' : 'high',
      teleost: fish, non_teleost: other,
      expected_arity: `1 ${other} gene : 1 or 2 ${fish} genes. Which of the two it is is an empirical question about this gene family, not a default.`,
      summary: `${fish} is downstream of the teleost genome duplication and ${other} is not. A single ${other} gene therefore often corresponds to TWO ${fish} genes, and under duplication-degeneration-complementation the ancestral job is typically SPLIT between them rather than present in both (force1999, postlethwait2004). Neither copy is "the" ortholog, and a knockout of one reproduces part of the phenotype at most.`,
      why_beyond_distance: TELEOST_DUPLICATION.why_it_is_worse_than_distance,
      failure_modes: TELEOST_DUPLICATION.how_it_goes_wrong_in_practice,
      what_to_do: TELEOST_DUPLICATION.what_to_do_instead,
      the_outgroup_that_resolves_it: 'Lepisosteus_oculatus (and Polypterus_senegalus): ray-finned fishes that did not undergo the duplication. Mapping through one of them turns a guessed arity into a demonstrated one (braasch2016).',
      caveat: TELEOST_DUPLICATION.caveat,
      sources: TELEOST_DUPLICATION.sources,
    };
    warnings.push(`EXTRA, STRUCTURAL HAZARD BEYOND DISTANCE: this pair crosses the teleost genome duplication. ${hazard.summary}`);
  } else if (aT && bT) {
    hazard = {
      kind: 'both-post-duplication-but-loss-is-lineage-specific',
      severity: 'moderate',
      summary: `${an} and ${bn} are both teleosts, so the duplication is shared and the 1:2 arity problem does not arise between them. It is replaced by a smaller one: most duplicates were lost, and WHICH copy was lost differs between teleost lineages. Two teleosts can therefore each retain a single, differently-descended copy of the same ancestral gene, and a one-to-one match between them can still be comparing non-equivalent ohnologs.`,
      what_to_do: ['Check ohnolog identity, not just best hit, when the gene family has a retained pair in either species.', 'Note that the two teleost models in this roster are separated by a quarter of a billion years (Clupeocephala, 190-270 Ma), which is not a short time to lose copies in.'],
      sources: ['glasauer2014', 'postlethwait2004'],
    };
    warnings.push(hazard.summary);
  }

  return deepFreeze({
    a: an, b: bn, comparison: 'pair', mrca: node.name,
    patristic_distance: dist,
    patristic_unit: 'Ma of branch length (twice the MRCA age on this ultrametric tree)',
    divergence: div,
    tier: tier.tier, tier_plain: tier.plain,
    transfer_strength: band.strength,
    warnings,
    teleost_hazard: hazard,
    also_required: 'A distance is only half of a comparability check. Run alignPhenotypes() on the two PHENOTYPES before any number crosses between these species; the tree says nothing about whether the two measurements are the same measurement.',
    bottom_line: `${an} vs ${bn}: ${tier.plain}, MRCA ${div.lo}-${div.hi} Ma, functional transfer ${band.strength}${hazard && hazard.kind === 'crosses-the-teleost-genome-duplication' ? ', AND the pair crosses the teleost genome duplication so expect 1:2 not 1:1' : ''}.`,
  });
}

// ===================================================================================================
// PART 2 -- PHENOME ALIGNMENT
// ===================================================================================================
// ---------------------------------------------------------------------------------------------------
// ONTOLOGY TERMS
// Hand-curated. These CURIEs were looked up once, by hand, against the EMBL-EBI Ontology Lookup
// Service on 2026-11-06, and each `label` below is the label OLS returned for that id on that date.
// Nothing here is queried live, nothing is inferred from an ontology's axioms, and the set covers only
// the handful of terms this module actually uses. Carrying the id instead of the name is the entire
// point: "pectoral fin" is a string two people can disagree about, UBERON:0000151 is not.
//
// `ontology_relation` notes, where it matters, what the ontology ACTUALLY asserts between two of these
// terms -- which is often weaker than the shared name suggests.
// ---------------------------------------------------------------------------------------------------
export const ONTOLOGY_TERMS = deepFreeze({
  'pectoral fin': { curie: 'UBERON:0000151', label: 'pectoral fin', also: { 'ZFA:0001161': 'pectoral fin' }, ontology: 'UBERON (+ZFA for zebrafish)', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan'] },
  'pelvic fin': { curie: 'UBERON:0000152', label: 'pelvic fin', also: { 'ZFA:0001184': 'pelvic fin' }, ontology: 'UBERON (+ZFA)', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan'] },
  'paired fin': { curie: 'UBERON:0002534', label: 'paired fin', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan'] },
  'caudal fin': { curie: 'UBERON:4000164', label: 'caudal fin', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish'] },
  'adipose fin': { curie: 'UBERON:2000251', label: 'adipose fin', also: { 'UBERON:4300274': 'adipose fin ray' }, ontology: 'UBERON', applies_to: ['teleost'], warning: 'A single ontology term covering structures that are not all homologous to each other -- see THE_NAMING_TRAP.third_case. An id is only as good as the homology assertion behind it.' },
  'median fin fold': { curie: 'UBERON:2000040', label: 'median fin fold', also: { 'ZFA:0000040': 'median fin fold' }, ontology: 'UBERON (+ZFA)', applies_to: ['teleost', 'non-teleost-actinopterygian', 'amphibian'] },
  'lepidotrichium': { curie: 'UBERON:4000172', label: 'lepidotrichium', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish'], ontology_relation: 'UBERON puts lepidotrichium under dermal bone (UBERON:0008907) and bony fin ray (UBERON:4300037).' },
  'ceratotrichium': { curie: 'UBERON:4400001', label: 'ceratotrichium', ontology: 'UBERON', applies_to: ['chondrichthyan'], ontology_relation: 'UBERON puts ceratotrichium under elastoidin fin ray (UBERON:4400006) -- NOT under dermal bone, and not under bony fin ray. Its only common ancestor with lepidotrichium in the ontology is the grouping class fin ray (UBERON:4400005).' },
  'fin ray': { curie: 'UBERON:4400005', label: 'fin ray', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan'], warning: 'A GROUPING class. Resolving the common name "fin ray" to this id does not establish that two species\' fin rays are corresponding structures -- it establishes that both are fin rays in the loosest sense, which is what the grouping class is for. See THE_NAMING_TRAP.primary_case.' },
  'pectoral fin lepidotrichium': { curie: 'UBERON:4000175', label: 'pectoral fin lepidotrichium', also: { 'ZFA:0001551': 'pectoral fin lepidotrichium' }, ontology: 'UBERON (+ZFA)', applies_to: ['teleost'] },
  'pectoral appendage': { curie: 'UBERON:0004710', label: 'pectoral appendage', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan', 'amphibian', 'mammal'], note: 'The term that makes the fin/forelimb correspondence checkable: both a pectoral fin and a forelimb are pectoral appendages, which is a positional-homology statement and deliberately not a statement that they are the same organ.' },
  'forelimb': { curie: 'UBERON:0002102', label: 'forelimb', ontology: 'UBERON', applies_to: ['amphibian', 'mammal'] },
  'hindlimb': { curie: 'UBERON:0002103', label: 'hindlimb', ontology: 'UBERON', applies_to: ['amphibian', 'mammal'] },
  'limb': { curie: 'UBERON:0002101', label: 'limb', ontology: 'UBERON', applies_to: ['amphibian', 'mammal'] },
  'swim bladder': { curie: 'UBERON:0006860', label: 'swim bladder', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian'] },
  'lung': { curie: 'UBERON:0002048', label: 'lung', ontology: 'UBERON', applies_to: ['sarcopterygian-fish', 'amphibian', 'mammal', 'non-teleost-actinopterygian'] },
  'liver': { curie: 'UBERON:0002107', label: 'liver', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan', 'amphibian', 'mammal'] },
  'opercle': { curie: 'UBERON:2000250', label: 'opercle', ontology: 'UBERON', applies_to: ['teleost', 'non-teleost-actinopterygian'], note: 'The BONE. Distinct from the flap it supports, and distinct again from the bare word "operculum".' },
  'opercular flap': { curie: 'UBERON:2000555', label: 'opercular flap', also: { 'ZFA:0000555': 'opercular flap' }, ontology: 'UBERON (+ZFA)', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish'], note: 'The gill cover. This is the term a fish anatomist means by "operculum", and it is NOT what the bare string resolves to -- see ontologyBacked("operculum").' },
  'neuromast': { curie: 'UBERON:0008904', label: 'neuromast', also: { 'ZFA:0000243': 'neuromast' }, ontology: 'UBERON (+ZFA)', applies_to: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan', 'amphibian'], note: 'Lateral-line organ. Absent in amniotes, which is why some fish phenotypes have no correspondent at all rather than a poor one.' },
});

// Terms whose bare string does NOT resolve to one structure. ontologyBacked returns these as
// ambiguous, with the senses, instead of picking one -- picking one is how the naming trap is sprung.
const AMBIGUOUS_TERMS = deepFreeze({
  'operculum': {
    why: 'Three unrelated structures in this roster alone, and the bare string resolves in UBERON to none of the fish ones.',
    senses: [
      { sense: 'gill cover of a bony fish', curie: 'UBERON:2000555', label: 'opercular flap', groups: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish'] },
      { sense: 'the supporting bone of that cover', curie: 'UBERON:2000250', label: 'opercle', groups: ['teleost', 'non-teleost-actinopterygian'] },
      { sense: 'cortical operculum, a region of the mammalian cerebral cortex', curie: 'UBERON:0002947', label: 'frontal operculum', siblings: { 'UBERON:0002911': 'parietal operculum', 'UBERON:0002560': 'temporal operculum', 'UBERON:0002593': 'orbital operculum' }, groups: ['mammal'] },
      { sense: 'the middle-ear operculum of an amphibian, and separately the larval gill cover', curie: null, label: null, groups: ['amphibian'], note: 'Two further senses, neither carried here; the amphibian case is listed so that a caller cannot read the absence of a sense as the absence of a problem.' },
      { sense: 'absent', curie: null, label: null, groups: ['chondrichthyan'], note: 'Cartilaginous fishes have no operculum. "Operculum = 0" in such a species is not a measurement of a small operculum.' },
    ],
    the_tell: 'A plain-text search for "operculum" in UBERON returns the CORTICAL opercula first (frontal, parietal, temporal, orbital). A name-matching cross-species pipeline that trusts the first hit will quietly compare a fish gill cover with a patch of mammalian cerebral cortex, and nothing in the output will look wrong.',
  },
  'fin ray': {
    why: 'The name covers at least two non-homologous skeletal element types, built of different tissues in different lineages.',
    senses: [
      { sense: 'lepidotrichium, a dermal BONE', curie: 'UBERON:4000172', label: 'lepidotrichium', groups: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish'] },
      { sense: 'ceratotrichium, an unmineralised ELASTOIDIN rod', curie: 'UBERON:4400001', label: 'ceratotrichium', groups: ['chondrichthyan'] },
    ],
    the_tell: 'UBERON classifies lepidotrichium under dermal bone and bony fin ray, and ceratotrichium under elastoidin fin ray. They meet only at the grouping class fin ray (UBERON:4400005). The ontology is telling you they are not the same kind of thing; the common name is telling you they are.',
  },
  'body length': {
    why: 'Not an anatomical term at all but a measurement protocol, and the protocol differs by clade and by laboratory.',
    senses: [
      { sense: 'standard length: snout tip to the posterior end of the vertebral column / caudal peduncle, EXCLUDING the caudal fin', curie: null, label: 'standard length', groups: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish'], note: 'The default in fish morphology, and the one the zebrafish literature means (hubbs1958).' },
      { sense: 'total length: snout tip to the tip of the caudal fin', curie: null, label: 'total length', groups: ['teleost', 'non-teleost-actinopterygian', 'sarcopterygian-fish', 'chondrichthyan'] },
      { sense: 'snout-vent length', curie: null, label: 'snout-vent length', groups: ['amphibian'] },
      { sense: 'nose-to-anus or nose-to-tail-base, varying by protocol', curie: null, label: 'body length (mammal)', groups: ['mammal'] },
      { sense: 'height, in a bipedal mammal', curie: null, label: 'stature', groups: ['mammal'], note: 'Not a length along the same axis as any of the above.' },
    ],
    the_tell: 'Standard length and total length differ by 10-25% in a typical teleost, which is larger than most of the effects these measurements are used to detect. Two studies that both say "body length" can disagree by more than their reported effect sizes without either being wrong.',
  },
});

/**
 * ontologyBacked(term) -> the CURIE, so the correspondence is checkable rather than asserted by name.
 *
 * Returns { found, curie, label, ... } for an unambiguous term; { found: false, ambiguous: true, senses }
 * for a term whose bare string does not pick out one structure; { found: false } otherwise. It does NOT
 * guess, and it does not return the best match -- a best match is exactly what springs the naming trap.
 */
export function ontologyBacked(term) {
  const key = String(term || '').trim().toLowerCase();
  const base = { term, normalised: key, hand_curated: true, provenance: `Hand-curated. Checked once against ${SOURCES.ols4}`, not_a_live_query: true };
  if (!key) return deepFreeze({ ...base, found: false, curie: null, why: 'empty term' });
  const amb = AMBIGUOUS_TERMS[key];
  if (amb) {
    return deepFreeze({
      ...base, found: false, curie: null, ambiguous: true,
      why: amb.why, senses: amb.senses, the_tell: amb.the_tell,
      what_to_do: 'Do not resolve this string. Ask the caller which sense is meant, and carry the sense\'s CURIE from then on. If the two species sit in different `groups` above, the correspondence is named-the-same-but-unrelated and no numeric comparison follows.',
    });
  }
  const t = ONTOLOGY_TERMS[key];
  if (!t) {
    return deepFreeze({
      ...base, found: false, curie: null,
      why: `"${term}" is not in the hand-curated set. The set covers only the terms this module uses; absence here is absence of curation, not absence from UBERON or ZFA.`,
      what_to_do: 'Look it up in UBERON (structures) or ZFA (zebrafish), record the id and the label it resolved to, and add it here with the date it was checked.',
    });
  }
  return deepFreeze({ ...base, found: true, ...t, checkable: `Resolve ${t.curie} and compare its label with "${t.label}". If they disagree, this record is stale.` });
}

// ---------------------------------------------------------------------------------------------------
// PHENOTYPE SCALES -- the kinds of correspondence, frozen.
// ---------------------------------------------------------------------------------------------------
// Ordered by `rank`. The threshold that matters is rank 3: anything BELOW
// homologous-structure-different-measurement gets no numeric comparison without an explicitly stated
// conversion, and two of the kinds get none at all, because a conversion between non-corresponding
// structures is a category error rather than a missing coefficient.
// ---------------------------------------------------------------------------------------------------
export const PHENOTYPE_SCALES = deepFreeze({
  'same-measurement': {
    id: 'same-measurement', rank: 4,
    label: 'The same quantity, on the same structure, by the same protocol',
    definition: 'The two phenotypes are the same measurement: one structure with a single homology statement behind it, one measurand, one protocol, one unit.',
    numeric_comparison: 'permitted',
    requires_conversion: false,
    example: 'Standard length in mm in Danio_rerio against standard length in mm in Danio_aesculapii, both to the same protocol.',
    failure_mode: 'The commonest false positive in this whole scheme. Two measurements with the same NAME and the same UNIT are routinely assigned here when the protocol differs (standard vs total length) or the structure differs (see named-the-same-but-unrelated). Identical units are evidence of nothing; agreeing units is the easiest thing in the world for two incomparable measurements to do.',
    what_still_has_to_be_said: 'The phylogenetic distance. Same-measurement does not make a cross-species difference interpretable as the effect you care about -- see comparabilityWarning.',
  },
  'homologous-structure-different-measurement': {
    id: 'homologous-structure-different-measurement', rank: 3,
    label: 'Corresponding structures, non-corresponding measurements',
    definition: 'The two structures have a defensible homology or positional-homology statement behind them, but the quantities measured are not the same quantity -- different landmarks, different axes, different normalisation, or different units of a different kind.',
    numeric_comparison: 'conversion-required',
    requires_conversion: true,
    example: 'Pectoral fin length in Danio_rerio (UBERON:0000151) against forelimb length in Mus_musculus (UBERON:0002102). Both are pectoral appendages (UBERON:0004710); neither measurement is the other.',
    conversion_shape: 'A stated mapping from landmarks to landmarks, plus a size normalisation, plus a statement of what the normalisation assumes. Usually that is: define both as a proportion of a body-size measure that is itself aligned, and say which body-size measure.',
    failure_mode: 'The conversion is applied and then forgotten, so a ratio that depended on one normalisation choice is reported as a property of the animals. Or: the homology statement holds for the appendage as a whole and is silently extended to its parts, where it does not -- the distal fin and distal limb skeletons are not element-for-element correspondent, so "number of distal elements" is not a convertible quantity even though "appendage length" may be.',
    what_still_has_to_be_said: 'The conversion, in the output, next to the number.',
  },
  'analogous-function-non-homologous': {
    id: 'analogous-function-non-homologous', rank: 2,
    label: 'Same job, different organ',
    definition: 'The two structures do a comparable thing and are not corresponding structures. Convergent or independently derived solutions to one problem.',
    numeric_comparison: 'refused-without-explicit-stated-conversion',
    requires_conversion: true,
    example: 'Buoyancy control: the swim bladder of Danio_rerio (UBERON:0006860) against the lipid-rich liver of Callorhinchus_milii (UBERON:0002107). Both deliver static lift; they are not the same organ and share no relevant homology.',
    conversion_shape: 'Only a FUNCTIONAL conversion is available, and it has to be stated as one: define the shared functional quantity (here, static lift as a fraction of body weight, or density), measure that in both, and report the functional quantity -- not the organ measurement. The output is then a claim about the function, and must not be relabelled as a claim about the structures.',
    failure_mode: 'The structural measurements get compared directly (swim bladder volume against liver volume) and the comparison looks quantitative. Or the shared function licenses a transfer of MECHANISM: "the gene that builds this organ in species A should build the analogous organ in species B", which does not follow and is the characteristic error here.',
    what_still_has_to_be_said: 'That the correspondence is functional only, and that no structural or developmental inference follows from it.',
  },
  'named-the-same-but-unrelated': {
    id: 'named-the-same-but-unrelated', rank: 1,
    label: 'The trap: one word, two structures, no correspondence',
    definition: 'The same common name has been applied, in different species or different literatures, to structures that neither correspond nor share a function. Nothing links them but the string.',
    numeric_comparison: 'refused',
    refusal_is_final: true,
    requires_conversion: false,
    example: '"Operculum" meaning the gill cover of Danio_rerio (UBERON:2000555) against "operculum" meaning a region of the cerebral cortex of Homo_sapiens (UBERON:0002947).',
    why_no_conversion_helps: 'A conversion maps one quantity onto another. There is no quantity here to map -- the premise that there are two measurements of one thing is false, so supplying a coefficient would launder a category error into a number. This refusal is not liftable, and that is a deliberate departure from the rank-2 rule above.',
    failure_mode: 'This is the kind that produces confident, well-formatted, completely empty output, because every automated check passes: the term strings match, the units match, the statistics run. Nothing in the pipeline is looking at whether the two structures are the same structure, and the name is doing the work that a homology statement should be doing. See THE_NAMING_TRAP.',
    what_still_has_to_be_said: 'Which sense each species\' term is in, with a CURIE, and that the comparison was refused.',
  },
  'no-correspondence': {
    id: 'no-correspondence', rank: 0,
    label: 'One species has it and the other has nothing that stands in for it',
    definition: 'No homologous structure, no analogous function, and no defensible proxy. The phenotype simply does not exist in the other species.',
    numeric_comparison: 'refused',
    refusal_is_final: true,
    requires_conversion: false,
    example: 'Neuromast count in Danio_rerio (UBERON:0008904) against anything in Homo_sapiens. The lateral line is absent in amniotes; there is no mammalian number that belongs on the other side of that comparison.',
    why_no_conversion_helps: 'There is no second measurement. A zero entered for the absent structure is not a measurement of it, and treating absence as a low value is the standard way this becomes a silent error in a matrix.',
    failure_mode: 'A dashboard that must fill every cell fills this one with a zero, a blank that is later imputed, or a loosely-related proxy chosen for availability. All three turn "not comparable" into a datum. The honest cell is empty and labelled.',
    what_still_has_to_be_said: 'That the structure is absent in one species, and whether that absence is itself the finding -- it often is, and it is a presence/absence claim, not a quantitative one.',
  },
});

const SCALE_BY_RANK = Object.fromEntries(Object.values(PHENOTYPE_SCALES).map(s => [s.rank, s]));
export const NUMERIC_COMPARISON_FLOOR = 3; // rank of homologous-structure-different-measurement

// ---------------------------------------------------------------------------------------------------
// CURATED CORRESPONDENCES
// Unordered term pairs with a hand-curated verdict. Everything not in here falls through to the rules
// in alignPhenotypes, which are deliberately pessimistic: an unknown pair of different terms is
// no-correspondence, not a guess.
// ---------------------------------------------------------------------------------------------------
const pairKey = (x, y) => [x, y].map(s => String(s).trim().toLowerCase()).sort().join(' :: ');

const CORRESPONDENCES = deepFreeze({
  [pairKey('pectoral fin', 'forelimb')]: {
    scale: 'homologous-structure-different-measurement',
    shared: { curie: 'UBERON:0004710', label: 'pectoral appendage' },
    basis: 'Positional homology of the pectoral appendage, and shared appendage-patterning mechanism. Both resolve under UBERON:0004710.',
    limits: 'The homology is of the APPENDAGE and its proximal skeleton. Distal fin rays (lepidotrichia, dermal bone) and digits are not element-for-element correspondent, so part counts do not convert even where lengths do (shubin2009).',
    conversion_required: { kind: 'landmark-and-normalisation', needs: ['stated proximal and distal landmarks in both species', 'a body-size normaliser that is itself aligned across the two species (NOT "body length" -- see THE_NAMING_TRAP.measurement_case)', 'a statement of what the normalisation assumes about growth'] },
  },
  [pairKey('pectoral fin', 'limb')]: {
    scale: 'homologous-structure-different-measurement',
    shared: { curie: 'UBERON:0004710', label: 'pectoral appendage' },
    basis: 'As pectoral fin / forelimb, but "limb" is less specific; require the caller to say which limb before any number.',
    limits: 'Underspecified on the tetrapod side.',
    conversion_required: { kind: 'disambiguate-then-landmark', needs: ['which limb (forelimb UBERON:0002102 or hindlimb UBERON:0002103)', 'then the pectoral fin / forelimb conversion'] },
  },
  [pairKey('pelvic fin', 'hindlimb')]: {
    scale: 'homologous-structure-different-measurement',
    shared: { curie: 'UBERON:0002534', label: 'paired fin / pelvic appendage series' },
    basis: 'Positional homology of the pelvic appendage.',
    limits: 'Same distal caveat as the pectoral pair.',
    conversion_required: { kind: 'landmark-and-normalisation', needs: ['stated landmarks in both species', 'an aligned body-size normaliser'] },
  },
  [pairKey('swim bladder', 'lung')]: {
    scale: 'homologous-structure-different-measurement',
    shared: { curie: null, label: 'the same pharyngeal/foregut outgrowth' },
    basis: 'Homologous as organs: both derive from the same gas-filled outgrowth of the foregut in the bony-fish ancestor. This one is a genuine homology and is often mistaken for a mere analogy, which is the opposite error from the usual.',
    limits: 'Homologous structure, entirely different measurand. Volume for buoyancy is not volume for gas exchange; the physiological quantities do not convert into each other at all.',
    conversion_required: { kind: 'none-available-for-the-physiology', needs: ['a measurand that genuinely exists in both (e.g. volume as a fraction of body volume), and an explicit statement that a buoyancy quantity is NOT being compared with a respiratory one'] },
  },
  [pairKey('swim bladder', 'liver')]: {
    scale: 'analogous-function-non-homologous',
    shared: { curie: null, label: 'static lift (buoyancy control)' },
    basis: 'Convergent solutions to neutral buoyancy: a gas-filled bladder in the bony fishes, a large lipid-rich liver in the cartilaginous fishes. No relevant homology between the organs.',
    limits: 'The shared thing is a function, and only one function of two organs that do many other things.',
    conversion_required: { kind: 'functional-only', needs: ['define the shared functional quantity (static lift as a fraction of body weight, or whole-body density)', 'measure THAT in both species', 'report the functional quantity, and state that no structural or developmental inference follows'] },
  },
  [pairKey('lepidotrichium', 'ceratotrichium')]: {
    scale: 'named-the-same-but-unrelated',
    shared: { curie: 'UBERON:4400005', label: 'fin ray (a grouping class only)' },
    basis: 'Both are called fin rays. A lepidotrichium is a dermal bone; a ceratotrichium is an unmineralised elastoidin rod. UBERON places them under different parents and they meet only at the grouping class.',
    why_refused: 'They are not corresponding structures, so a count or a length in one is not a measurement of the other under a different protocol -- it is a measurement of something else.',
  },
  [pairKey('neuromast', 'hair cell')]: {
    scale: 'homologous-structure-different-measurement',
    shared: { curie: null, label: 'mechanosensory hair cell' },
    basis: 'The hair CELLS are homologous and well studied as such. Recorded here because the tempting comparison is between a neuromast (an organ) and a hair cell (a cell type), which is a level error on top of everything else.',
    limits: 'An organ count and a cell count are not the same measurement even when the cells inside are homologous.',
    conversion_required: { kind: 'level-alignment', needs: ['compare like levels: cells with cells, organs with organs', 'state that the lateral-line ORGAN has no amniote correspondent even though its cells do'] },
  },
});

/**
 * alignPhenotypes(aPheno, bPheno) -> the correspondence, and a refusal where one is due.
 *
 * Each argument is a descriptor:
 *   { species, term, measurement, unit, curie?, protocol?, conversion? }
 *
 * `species` should be a name from TAXA (it is what selects the SENSE of an ambiguous term, which is the
 * whole mechanism by which the naming trap is caught). A conversion may be supplied on either
 * descriptor or as opts.conversion; it lifts the refusal for rank 2 ONLY, and never for ranks 0-1.
 */
export function alignPhenotypes(aPheno, bPheno, opts = {}) {
  const norm = p => {
    if (!p || typeof p !== 'object') throw new TypeError('alignPhenotypes: each phenotype must be a descriptor object { species, term, measurement, unit }');
    return {
      species: p.species ?? null,
      term: String(p.term ?? '').trim(),
      key: String(p.term ?? '').trim().toLowerCase(),
      measurement: p.measurement ?? null,
      unit: p.unit ?? null,
      protocol: p.protocol ?? null,
      curie: p.curie ?? null,
      conversion: p.conversion ?? null,
    };
  };
  const A = norm(aPheno);
  const B = norm(bPheno);
  const conversion = opts.conversion ?? A.conversion ?? B.conversion ?? null;
  const gA = A.species && taxon(A.species) ? taxon(A.species).group : null;
  const gB = B.species && taxon(B.species) ? taxon(B.species).group : null;
  const notes = [];
  const unresolved = [];

  if (A.species && !taxon(A.species)) unresolved.push(`species "${A.species}" is not in TAXA; the sense of an ambiguous term cannot be resolved without it`);
  if (B.species && !taxon(B.species)) unresolved.push(`species "${B.species}" is not in TAXA; the sense of an ambiguous term cannot be resolved without it`);

  const ontA = ontologyBacked(A.term);
  const ontB = ontologyBacked(B.term);

  // --- sense resolution for terms whose bare string does not pick out one structure ---------------
  const senseOf = (key, group) => {
    const amb = AMBIGUOUS_TERMS[key];
    if (!amb || !group) return null;
    return amb.senses.find(s => s.groups.includes(group)) || null;
  };
  const sA = senseOf(A.key, gA);
  const sB = senseOf(B.key, gB);

  let scaleId = null;
  let basis = null;
  let shared = null;
  let limits = null;
  let conversionRequired = null;

  const curated = CORRESPONDENCES[pairKey(A.key, B.key)]
    || (sA && sB ? CORRESPONDENCES[pairKey(sA.label || sA.sense, sB.label || sB.sense)] : null);

  if (curated) {
    scaleId = curated.scale;
    basis = curated.basis;
    shared = curated.shared;
    limits = curated.limits ?? null;
    conversionRequired = curated.conversion_required ?? null;
    if (curated.why_refused) notes.push(curated.why_refused);
    notes.push('Classified from the hand-curated CORRESPONDENCES table, not inferred.');
  } else if (A.key && A.key === B.key) {
    const amb = AMBIGUOUS_TERMS[A.key];
    if (amb && sA && sB && (sA.sense !== sB.sense)) {
      scaleId = 'named-the-same-but-unrelated';
      basis = `Both descriptors say "${A.term}", and in these two species that word names different things: ${A.species} -> ${sA.sense}${sA.curie ? ` (${sA.curie})` : ''}; ${B.species} -> ${sB.sense}${sB.curie ? ` (${sB.curie})` : ''}.`;
      shared = { curie: null, label: 'nothing but the string' };
      notes.push(amb.the_tell);
      notes.push('Note what did NOT catch this: the term strings are identical, and the measurement and unit may be identical too. Only the species-specific sense lookup caught it.');
    } else if (amb && (!gA || !gB)) {
      scaleId = 'named-the-same-but-unrelated';
      basis = `"${A.term}" is an ambiguous term (${amb.why}) and the sense cannot be resolved for ${!gA ? A.species : B.species}. Treated as the trap rather than as a match, because the cost of the two errors is not symmetric.`;
      shared = { curie: null, label: 'unresolved' };
      unresolved.push(`sense of "${A.term}" unresolved; supply a species in TAXA, or a CURIE naming the sense`);
    } else if (amb) {
      // Same term, same sense, ambiguous word: fall through to measurement comparison but keep the flag.
      notes.push(`"${A.term}" is an ambiguous term, but both species resolve to the same sense (${sA.sense}${sA.curie ? `, ${sA.curie}` : ''}), so the correspondence stands on the sense rather than on the word.`);
      scaleId = (A.measurement && A.measurement === B.measurement && A.unit === B.unit && (A.protocol ?? null) === (B.protocol ?? null))
        ? 'same-measurement' : 'homologous-structure-different-measurement';
      shared = sA.curie ? { curie: sA.curie, label: sA.label } : { curie: null, label: sA.sense };
      basis = `Same term, same resolved sense in both species.`;
    } else {
      const sameMeasure = A.measurement && A.measurement === B.measurement && A.unit === B.unit;
      const sameProtocol = (A.protocol ?? null) === (B.protocol ?? null);
      const t = ONTOLOGY_TERMS[A.key];
      const appliesA = !t || !gA || t.applies_to.includes(gA);
      const appliesB = !t || !gB || t.applies_to.includes(gB);
      if (!appliesA || !appliesB) {
        scaleId = 'no-correspondence';
        basis = `"${A.term}"${t ? ` (${t.curie})` : ''} is not recorded as applying to the group "${!appliesA ? gA : gB}". One side of this comparison has no such structure.`;
        shared = { curie: null, label: 'absent in one species' };
        notes.push('Absence is a presence/absence finding, not a zero. Do not enter 0 for the absent side.');
      } else if (sameMeasure && sameProtocol) {
        scaleId = 'same-measurement';
        basis = `Same term${t ? ` (${t.curie})` : ''}, same measurand, same unit, same stated protocol.`;
        shared = t ? { curie: t.curie, label: t.label } : { curie: null, label: A.term };
      } else {
        scaleId = 'homologous-structure-different-measurement';
        basis = `Same structure${t ? ` (${t.curie})` : ''}, but ${!sameMeasure ? 'the measurand or unit differs' : 'the protocol differs or is unstated'}.`;
        shared = t ? { curie: t.curie, label: t.label } : { curie: null, label: A.term };
        conversionRequired = { kind: 'protocol-alignment', needs: ['state both protocols explicitly', !sameMeasure ? 'a stated mapping between the two measurands and units' : 'a demonstration that the protocols give the same number on the same specimen'].filter(Boolean) };
        if (sameMeasure && !sameProtocol) notes.push('Identical measurand and unit with different protocols is the commonest way a same-measurement verdict is wrongly awarded.');
      }
    }
  } else if (ontA.found && ontB.found && ontA.curie === ontB.curie) {
    const sameMeasure = A.measurement && A.measurement === B.measurement && A.unit === B.unit;
    scaleId = sameMeasure ? 'same-measurement' : 'homologous-structure-different-measurement';
    basis = `Different names, same ontology term (${ontA.curie}, "${ontA.label}").`;
    shared = { curie: ontA.curie, label: ontA.label };
    if (!sameMeasure) conversionRequired = { kind: 'measurand-alignment', needs: ['a stated mapping between the two measurands and units'] };
  } else {
    scaleId = 'no-correspondence';
    basis = `No curated correspondence between "${A.term}" and "${B.term}", and they do not resolve to a shared ontology term. Reported as no-correspondence rather than guessed: an unknown pair is not a weak match.`;
    shared = { curie: null, label: null };
    notes.push('If these two DO correspond, add the pair to CORRESPONDENCES with the homology or function statement that justifies it. The table is the place where a correspondence claim is made, and it is meant to be visible.');
  }

  const scale = PHENOTYPE_SCALES[scaleId];
  const final = scale.refusal_is_final === true;
  let permitted;
  let refusal = null;
  if (scale.rank >= NUMERIC_COMPARISON_FLOOR) {
    if (scale.requires_conversion && !conversion) {
      permitted = false;
      refusal = `Correspondence is "${scaleId}", which needs a stated conversion before any number crosses between ${A.species ?? 'A'} and ${B.species ?? 'B'}. None was supplied.`;
    } else {
      permitted = true;
    }
  } else if (final) {
    permitted = false;
    refusal = `Correspondence is "${scaleId}" (rank ${scale.rank}). ${scale.why_no_conversion_helps} No conversion lifts this refusal.`;
  } else if (conversion) {
    permitted = true;
    notes.push(`Correspondence is "${scaleId}" (rank ${scale.rank}, below the floor of ${NUMERIC_COMPARISON_FLOOR}), and a conversion WAS supplied, so a number is permitted -- as a claim about the converted quantity only. The conversion must be printed next to the number, and the structural comparison must not be reported.`);
  } else {
    permitted = false;
    refusal = `Correspondence is "${scaleId}" (rank ${scale.rank}), below the floor of ${NUMERIC_COMPARISON_FLOOR} (${SCALE_BY_RANK[NUMERIC_COMPARISON_FLOOR].id}). A numeric comparison is REFUSED unless an explicit conversion is stated. ${scale.conversion_shape ?? ''}`.trim();
  }
  if (unresolved.length && permitted) {
    permitted = false;
    refusal = `Unresolved inputs block the comparison: ${unresolved.join('; ')}.`;
  }

  return deepFreeze({
    a: { ...A, group: gA, resolved_sense: sA, ontology: ontA },
    b: { ...B, group: gB, resolved_sense: sB, ontology: ontB },
    correspondence: scaleId,
    correspondence_rank: scale.rank,
    correspondence_label: scale.label,
    shared_reference: shared,
    basis,
    limits,
    numeric_comparison_permitted: permitted,
    refusal_reason: refusal,
    refusal_is_final: final,
    conversion_supplied: conversion ?? null,
    conversion_required: conversionRequired ?? (scale.requires_conversion ? { kind: 'see-scale', needs: [scale.conversion_shape] } : null),
    conversion_shape: scale.conversion_shape ?? null,
    unresolved,
    notes: [...notes, scale.what_still_has_to_be_said].filter(Boolean),
    failure_mode_to_watch: scale.failure_mode,
    also_required: 'alignPhenotypes says nothing about how far apart the two species are. Run comparabilityWarning() as well; a correctly aligned measurement across 430 Ma is still a weak comparison.',
  });
}

// ---------------------------------------------------------------------------------------------------
// THE NAMING TRAP -- frozen, with concrete cases.
// ---------------------------------------------------------------------------------------------------
export const THE_NAMING_TRAP = deepFreeze({
  headline: 'Two structures can carry the same common name in two species and not correspond at all. The name is doing work that only a homology statement can do, and every automated check in the pipeline passes anyway.',
  why_it_is_the_worst_case: 'The other failure modes leave a trace. A missing conversion leaves mismatched units; an absent structure leaves a hole in the matrix. This one leaves a clean, well-formatted, statistically significant row. The term strings match, the units match, the test runs, the plot renders. Nothing is looking at whether the two structures are the same structure.',

  primary_case: {
    name: 'fin ray',
    species_a: 'Danio_rerio (teleost)',
    structure_a: { name: 'lepidotrichium', curie: 'UBERON:4000172', what: 'a paired dermal BONE; UBERON places it under dermal bone (UBERON:0008907) and bony fin ray (UBERON:4300037)' },
    species_b: 'Callorhinchus_milii (cartilaginous fish)',
    structure_b: { name: 'ceratotrichium', curie: 'UBERON:4400001', what: 'an unmineralised ELASTOIDIN rod; UBERON places it under elastoidin fin ray (UBERON:4400006), not under bone at all' },
    what_they_share: 'The common name "fin ray", and the UBERON grouping class fin ray (UBERON:4400005), which is where their classifications first meet and which is a grouping class precisely because the things under it are not all the same kind of thing.',
    what_they_do_not_share: 'Tissue type, mineralisation, developmental origin, and any element-for-element correspondence. A ceratotrichium is not a lepidotrichium that failed to ossify.',
    what_going_wrong_looks_like: [
      'A cross-species table with a "fin ray count" column for both species. The numbers are comparable-looking integers and they are counts of two different kinds of object.',
      'A gene implicated in lepidotrichium patterning in the zebrafish is reported as a "fin ray gene", its ortholog is found in the cartilaginous fish, and the absence of an effect on ceratotrichia is written up as loss of function. The gene never had that function in that structure.',
      'A regeneration study: teleost lepidotrichia regenerate from a blastema with well-characterised segment-level patterning. "Fin ray regeneration" is then compared across the two lineages as though one rate were comparable with the other.',
      'A morphometric pipeline that measures "fin ray length" in both and reports a ratio. The ratio is a number about two unrelated objects and there is no way to tell from the output.',
    ],
    the_tell: 'The ontology disagrees with the name. Resolve both to CURIEs and the shared parent is a grouping class, with the specific terms sitting under different tissue types. If the most specific common ancestor of two terms is a grouping class, the common name is not evidence of correspondence.',
    sources: ['mungall2012', 'ols4'],
  },

  second_case: {
    name: 'operculum',
    species_a: 'Danio_rerio',
    structure_a: { name: 'opercular flap (the gill cover)', curie: 'UBERON:2000555', what: 'the bony flap covering the gill chamber; the bone is the opercle, UBERON:2000250' },
    species_b: 'Homo_sapiens',
    structure_b: { name: 'cortical operculum', curie: 'UBERON:0002947', what: 'frontal operculum, a region of the cerebral cortex; with parietal (UBERON:0002911), temporal (UBERON:0002560) and orbital (UBERON:0002593) opercula alongside it' },
    what_they_share: 'A Latin word meaning "little lid", applied independently in two anatomical traditions.',
    what_they_do_not_share: 'Anything. Different germ layer, different organ system, different body region.',
    what_going_wrong_looks_like: [
      'A plain-text search for "operculum" in UBERON returns the CORTICAL opercula first, because there is no bare "operculum" term for the fish structure -- the fish terms are "opercular flap" and "opercle". A name-matching pipeline that takes the top hit silently pairs a fish gill cover with a patch of mammalian cerebral cortex.',
      'Nothing downstream looks wrong. Both are real UBERON terms, both have real annotations, and a term-overlap score between the two annotation sets will be non-zero and reportable.',
      'The same word has at least two further senses inside this roster: the amphibian middle-ear operculum, and the larval amphibian gill cover. A pipeline that resolves one sense per word gets three of these wrong.',
      'And in the cartilaginous fish the structure is ABSENT, so "operculum" there is not a small operculum but no operculum. That is a no-correspondence case wearing the same label.',
    ],
    the_tell: 'The bare word does not resolve to a single term in the ontology. When the name alone is ambiguous in the ontology, the name alone must not be used to match, and `ontologyBacked()` returns ambiguous rather than a best guess for exactly this reason.',
    sources: ['mungall2012', 'vanslyke2014', 'ols4'],
  },

  third_case: {
    name: 'adipose fin',
    note: 'The hardest version, because it is WITHIN the teleosts, both structures are genuinely fins, and a single ontology term (UBERON:2000251) covers both.',
    lineages: 'The adipose fin of the characiform fishes and the adipose fin of the salmonid fishes.',
    what_is_reported: 'Adipose fins are not a single homologous structure across the teleosts: they arose more than once, and the lineages differ in developmental route (derivation from the larval median fin fold versus de novo appearance later in ontogeny) and in skeletal support (presence or absence of ray-like elements). Stewart, Smith & Coates (2014) is the analysis.',
    deliberately_not_asserted_here: 'Which lineage takes which developmental route. The published asymmetry is the point being carried; assigning the routes from memory is how a record like this becomes wrong, so the assignment is left to the source.',
    why_it_matters_here: 'A single UBERON id is NOT by itself a homology guarantee. An ontology term is a curated assertion, and for a structure that evolved repeatedly the term can be a convenience grouping. Carrying a CURIE makes a correspondence CHECKABLE; it does not make it true.',
    what_going_wrong_looks_like: [
      'Two adipose-fin studies in different teleost lineages pooled on the strength of the shared term, and a developmental mechanism transferred between them.',
      'An "adipose fin present/absent" character scored across a teleost tree and treated as one character, when it is at least two.',
    ],
    sources: ['stewart2014'],
  },

  measurement_case: {
    name: 'body length',
    what: 'The same trap, one level down, in the MEASUREMENT rather than the structure, and the one most likely to be in a real dataset.',
    senses: 'Standard length (snout to the end of the vertebral column, excluding the caudal fin) is the fish-morphology default and is what the zebrafish literature means. Total length includes the caudal fin. Amphibian work often uses snout-vent length. Mammalian "body length" varies by protocol, and in a bipedal mammal the comparable-sounding number is stature, measured along a different axis entirely.',
    size_of_the_error: 'Standard and total length differ by roughly 10-25% in a typical teleost -- larger than most of the effects these measurements are used to detect. Two studies that both say "body length" can disagree by more than their reported effect sizes without either being wrong.',
    why_it_is_dangerous_beyond_itself: 'Body length is the usual NORMALISER. A fin length as a fraction of body length inherits the ambiguity, so the error propagates into every normalised trait in the table rather than staying in one column.',
    sources: ['hubbs1958'],
  },

  how_to_not_fall_in: [
    'Match on CURIEs, never on names. A name match is a hypothesis about correspondence; a shared CURIE is at least a curated assertion that can be looked up and disputed.',
    'Check what the most specific shared ancestor of the two terms actually is. If it is a grouping class, the comparison has no homology behind it.',
    'Resolve the SENSE per species before resolving the term. Which sense of a word applies is a property of the organism, which is why alignPhenotypes needs `species` and treats an unresolvable sense as the trap rather than as a match.',
    'Treat identical units as zero evidence. Two incomparable measurements agree on units all the time.',
    'Record the protocol, not just the measurand. "Body length, mm" is not a measurement; "standard length per hubbs1958, mm" is.',
    'Remember that a CURIE bounds the error without eliminating it: a term can group structures that evolved independently (see third_case).',
  ],
});

// ===================================================================================================
// A SMALL SELF-CHECK ON LOAD
// The tree, the dates and the roster are three hand-maintained objects that have to agree. Catching a
// disagreement at import is better than reporting a distance computed from a tree whose tips are not
// the roster.
// ===================================================================================================
{
  const t = tips(PARSED);
  if (t.length !== TAXA.length) throw new Error(`TREE has ${t.length} tips but TAXA has ${TAXA.length} entries`);
  for (const n of t) if (!TAXON_BY_NAME.has(n)) throw new Error(`tip "${n}" is not in TAXA`);
  for (const n of nodeNames(PARSED)) {
    if (TAXON_BY_NAME.has(n)) continue;
    if (!(n in DIVERGENCES)) throw new Error(`internal node "${n}" has no DIVERGENCES entry`);
  }
  if (toNewick(PARSED) !== NEWICK) throw new Error('TREE.newick does not round-trip through parseNewick/toNewick');
}

// ===================================================================================================
// A ONE-SHOT REPORT, for a human reading the module rather than calling it.
//   node analogues/phylo.mjs            # the tree, the dates, the sources
//   node analogues/phylo.mjs A B        # the comparability warning for one pair
// ===================================================================================================
const invokedDirectly = (() => {
  const arg = process.argv[1];
  if (!arg) return false;
  return import.meta.url.replace(/\\/g, '/').endsWith(arg.replace(/\\/g, '/').replace(/^[A-Za-z]:/, ''));
})();
if (invokedDirectly) {
  const [, , a, b] = process.argv;
  if (a && b) {
    const w = comparabilityWarning(a, b);
    console.log(`\n${w.bottom_line}\n`);
    for (const s of w.warnings) console.log(`  - ${s}`);
    if (w.teleost_hazard) console.log(`\n  hazard: ${w.teleost_hazard.kind}\n          expected arity ${w.teleost_hazard.expected_arity ?? 'n/a'}`);
    console.log(`\n  ${w.also_required}\n`);
  } else {
    console.log('\n' + prettyNewick(PARSED) + '\n');
    console.log(`${TREE.n_tips} tips. ${TREE.omission.what}\n`);
    const rows = Object.values(DIVERGENCES).map(d => [d.node, `${d.lo}-${d.hi} Ma`, d.confidence, d.sources.join(', ')]);
    const w0 = Math.max(...rows.map(r => r[0].length));
    const w1 = Math.max(...rows.map(r => r[1].length));
    const w2 = Math.max(...rows.map(r => r[2].length));
    for (const r of rows) console.log(`  ${r[0].padEnd(w0)}  ${r[1].padEnd(w1)}  ${r[2].padEnd(w2)}  ${r[3]}`);
    console.log(`\n  every date above is an ESTIMATE WITH A RANGE. ${CALIBRATION_CAVEAT}\n`);
  }
}
