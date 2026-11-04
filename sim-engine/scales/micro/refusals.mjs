// WHAT THIS VIEW MAY NOT CLAIM. Each refusal names a published limit, and says what would be needed.
//
// ============================== WHY REFUSALS ARE A FEATURE ==============================
// Every one of these is something the view can still SHOW. The refusal is not about the picture, it is
// about the caption. The pattern throughout: render it, label it as drawn, and say which method would be
// required to compute it and what that method's ceiling is. A labelled drawing is honest and useful. The
// same drawing captioned "simulation" is not.
//
// ============================== THE ONE MOST LIKELY TO BE BROKEN ==============================
// "A molecular dynamics simulation of a cell" has never been run by anyone. The largest coarse-grained
// whole-cell model - 561 million particles - was BUILT AND NEVER INTEGRATED; its own paper says that
// performing an actual simulation "proved to be non-trivial" and that "on the scale of an entire cell, we
// will not be able to equilibrate our system". A model that was constructed is not a model that was run,
// and that distinction is the easiest one in this whole project to lose.

export const PATTERN = 'Render it. Label it as drawn. Say which method would be needed, and that method\'s ceiling.';

export const REFUSALS = [
  {
    id: 'md-of-a-cell',
    refuse: 'calling anything here "a molecular dynamics simulation of a cell"',
    because: 'no all-atom MD of a complete cell has ever been run. The nearest attempt covered about one tenth of a small bacterium - 103,708,785 atoms for 20 ns - with no DNA, no membrane and no cytoskeleton, built from homology models. Its authors observed essentially nothing happen: diffusion "largely limited to motion within a local environment without enough time to trade places with other macromolecules".',
    citations: ['Yu et al. 2016, eLife, doi 10.7554/eLife.19274', 'Stevens et al. 2023, Front Chem, doi 10.3389/fchem.2023.1106495'],
    risk: 'HIGHEST. This is the most attractive sentence available to us and it is false.',
  },
  {
    id: 'atoms-above-the-molecule-scale',
    refuse: 'any atom-resolution view of an embryo, a cell, or even a cubic micron, presented as physics',
    because: 'a single cubic micron of cytoplasm holds about 1e11 atoms - roughly a hundred times MORE than the largest all-atom simulation ever published, which itself bought only 2.42 ns. An 8-cell blastomere is about 1e17 atoms; the whole embryo about 2e19.',
    the_time_side: 'one early blastomere cycle is about 15 minutes, or 9e11 ns. The longest MD trajectory ever published is 1.03 ms - about 1e6 ns - for a 58-residue protein. That is a million times too short, for a system a hundred trillion times too small.',
    citations: ['Dommer et al. 2023, doi 10.1177/10943420221128233', 'Shaw et al. 2010'],
    so: 'everything above the molecule scale in this zoom is measured or drawn, and the screen says which.',
  },
  {
    id: 'covalent-bonds',
    refuse: 'showing a covalent bond forming or breaking anywhere a classical trajectory is playing',
    because: 'a classical force field holds bonds as HARMONIC springs with fixed connectivity, fixed atom types and fixed partial charges. A harmonic bond never dissociates. The topology is an input, not an outcome.',
    this_explicitly_includes: ['enzyme catalysis', 'peptide bond formation', 'ATP hydrolysis', 'phosphorylation', 'protonation and deprotonation', 'disulfide formation or reduction'],
    what_would_be_needed: [
      { method: 'QM/MM', ceiling: 'a quantum region of 400-800 atoms for converged properties; a few hundred picoseconds at density-functional level, about a hundred times longer semi-empirical' },
      { method: 'density-functional ab initio MD', ceiling: 'a few hundred atoms and tens to thousands of picoseconds, even on state-of-the-art supercomputers; about 100 atoms and 10 ps on a desktop' },
      { method: 'wavefunction ab initio MD', ceiling: '1,496 atoms at 25 ps/day on 4,096 GPUs - the 2024 Gordon Bell result simulated 100 femtoseconds in total' },
      { method: 'ReaxFF', ceiling: '16.6 million atoms demonstrated; its brute-force timescale is UNSOURCED, and the microsecond figures quoted for it are ACCELERATED dynamics, not brute force' },
      { method: 'machine-learned potentials', ceiling: 'a billion atoms for 1 ns - but equilibrium-trained models are NOT reactive: "ML models cannot learn features in transition state regions solely by training on hitherto popular benchmark datasets"' },
    ],
    the_price: 'classical to machine-learned potential is about 1e3 to 1e4 times the cost; to wavefunction quantum MD about 1e9 times.',
  },
  {
    id: 'electrons',
    refuse: 'electron transfer, redox chemistry, oxidation-state change or light absorption, as simulated',
    because: 'a classical force field has NO electronic degree of freedom at all. There is nothing in the Hamiltonian that could change an oxidation state.',
    this_rules_out: ['the electron transport chain', 'photosynthetic charge separation', 'metal-centre redox', 'radical chemistry', 'any photochemistry'],
    the_instructive_precedent: 'the largest photosynthesis simulation ever run - a 136.8-million-atom chromatophore - was CLASSICAL MD. Its quantum-chemistry results came from separate calculations on extracted snapshots, not from the trajectory.',
    citations: ['Blumberger 2015, Chem Rev 115:11191-11238, doi 10.1021/acs.chemrev.5b00298', 'Singharoy et al. 2019, Cell 179:1098-1111.e23'],
  },
  {
    id: 'hydrogen-bond-energies',
    refuse: 'saying the simulation "computes hydrogen bond energies"',
    because: 'classical force fields contain NO explicit hydrogen-bond term. Hydrogen bonds are emergent from point charges plus Lennard-Jones repulsion. Explicit directional H-bond terms were removed from the major force fields in the 1990s.',
    what_may_be_said: 'that hydrogen bonds appear because of the charges and the repulsion - which is true, and is a better sentence anyway.',
    also_missing: 'electronic polarizability, charge transfer, explicit lone pairs and sigma holes. Fixed charges cannot represent them; polarizable force fields can, at no more than about twice the cost in the extended-Lagrangian implementation, or about an order of magnitude for the self-consistent one.',
    a_folklore_warning: 'the widely repeated "3-10x slowdown for polarizable force fields" could not be sourced. Use the two figures that can be: no more than 2x, or about an order of magnitude, depending on the method.',
  },
  {
    id: 'coarse-grained-as-atomic',
    refuse: 'presenting a coarse-grained run as atomic, or multiplying its clock by four and calling the result a duration',
    because: 'a coarse-grained bead is about four heavy atoms, and the water bead is four water molecules in one isotropic site that "will certainly not capture any of the higher order structural correlations of real water". Secondary structure is an INPUT held fixed for the run. Protein-protein interactions are documented as too sticky, producing clusters whose formation is essentially irreversible.',
    the_time_factor: 'the speed-up factor is defined only for water diffusion. The developers quote 3 to 8; one systematic study found 1.2 to 22. Multiplying by exactly 4 turns a property into a clock, which it is not.',
    the_sobering_precedent: 'the largest such run - 83 million particles for a whole mitochondrion - was simulated for 2 ns, after which the authors reported they "did not observe a significant configurational change".',
  },
  {
    id: 'whole-cell-models-are-not-molecular',
    refuse: 'calling the published whole-cell models "molecular" or "spatially atomic"',
    because: 'they are reaction-diffusion and kinetic models. In the leading one each protein is a labelled POINT PARTICLE with a diffusion coefficient on an 8-nanometre lattice, metabolism is a well-stirred set of differential equations in which metabolites have no position at all, and DNA is 46,188 particles of about 12 base pairs each. Another has no space and no molecular structure anywhere.',
    the_authors_own_framing_is_the_line_to_use: 'atomic-resolution models capture structure and short-timescale interactions but cannot simulate what happens over minutes to hours; kinetic models lack the physical accuracy of molecular dynamics. Resolution and timescale are a strict trade-off, and no published model has both.',
    and_for_eukaryotes: 'there is no published whole-cell model of a eukaryotic cell at the completeness of the bacterial ones. If this zoom passes through a eukaryotic cell interior, NOTHING at that level is simulated.',
  },
  {
    id: 'dilute-solution-speed',
    refuse: 'showing molecules travelling at dilute-solution speed inside a cell',
    because: 'translational diffusion in cytoplasm is hindered three to eleven times. A fluorescent protein measures 27 against 87 square microns per second in a eukaryotic cell, and 7.7 against 87 in a bacterium. A ribosome-sized particle manages about 0.04.',
    the_subtlety_worth_showing: 'ROTATION is barely hindered - about 1.3 to 1.5 times - while TRANSLATION is hindered 3 to 11 times. So a molecule shown tumbling is roughly honest; the same molecule shown crossing a cell at dilute-solution speed is not.',
    an_unresolved_disagreement: 'two careful studies on the same cell line disagree about sevenfold on whether the hindrance depends on particle size. Show the range, not a number. They DO agree that mobility collapses above a radius of roughly 30 nanometres.',
    and_above_that_size: 'particles larger than about 30 nm may be entirely immobile in cytoplasm - including most endosomes, polyribosomes and the larger enzyme complexes.',
  },
  {
    id: 'thermostat-dynamics-as-real-dynamics',
    refuse: 'reading timings off a Langevin trajectory as if they were measured kinetics',
    because: 'Langevin dynamics is stochastic, and its own documentation is blunt: when the friction is strong relative to the system\'s own timescales "the dynamics will be completely different from MD, but the sampling is still correct", and "any processes that take longer than 1/gamma, e.g. hydrodynamics, will be dampened".',
    measured_consequences: 'isomerization rates peak near a friction of 2 per picosecond and become diffusive above 10; diffusion, viscosity and polymer dynamics are all significantly dampened by velocity-randomising thermostats.',
    the_summary: 'correct thermodynamics, wrong dynamics.',
    even_numerical_tricks_do_this: 'hydrogen-mass repartitioning, a purely numerical device for taking longer timesteps, has been measured to change ligand binding kinetics enough to cancel its own speed-up - the ligand took LONGER to find its site in wall-clock terms. Two papers directly contradict each other on whether it is kinetically safe; quote both or neither.',
  },
  {
    id: 'sub-second-cell-biology-as-continuous-simulation',
    refuse: 'showing molecular recognition, assembly or turnover inside a cell and attributing it to simulation',
    because: 'in the single published atomic-resolution cytoplasm run, the authors recorded that tRNA binding, protein oligomerization and metabolite binding were "none of which we observed in the course of our simulations". Twenty nanoseconds is not long enough for a molecule to change neighbours.',
    risk: 'this is the quietest error available, because the picture looks exactly right.',
  },
];

/** Specific numbers that must never be rendered as measured facts about the inside of a cell. */
export const NUMBERS_NOT_TO_RENDER = [
  { wrong: 'water at 55 M inside the cell', right: 'that is PURE water. The measured intracellular quantity is the volume fraction, about 70 %. The molarity, about 39 M, is derived - and 18 to 20 % of that water is hydration water with different physics.' },
  { wrong: 'glucose at 5 mM inside the cell', right: 'that is BLOOD. Measured intracellular free glucose in human muscle is about 0.11 mM - roughly fifty times lower. The abundant intracellular species is glucose-6-phosphate, not glucose.', risk: 'the single most likely error in a subcellular view.' },
  { wrong: 'a single mitochondrial volume fraction', right: 'it spans about 1 % in yeast, 11 % in one human line, 22 % in liver and 36 % in heart muscle. That twenty-fold spread is genuine cell-type variation, not measurement disagreement. Name the cell type or show no number.' },
  { wrong: 'a single ribosome count per cell', right: 'two primary measurements of the SAME human cell line differ by 2.9 times, and the bacterial count varies more than tenfold with growth rate. Never quote a bacterial ribosome count without the growth rate.' },
  { wrong: 'a generic 10 % nucleus in an early embryo', right: 'the measured zebrafish nucleus-to-cell volume ratio at the 8-cell stage is about 0.1 to 0.2 % - two orders of magnitude lower - and it RISES through cleavage. Early blastomeres are enormous relative to their nuclei.' },
  { wrong: 'one number for an 8-cell blastomere volume', right: 'two primary measurements disagree four- to sixfold (about 1.1 against 4.0-6.5 nanolitres) because one measured a 2D axis in a confocal section and the other segmented 3D membranes. Quote the range.' },
  { wrong: 'a typical-mammalian-cell ion table presented as measurement', right: 'the familiar table is a textbook composite, not a primary measurement. Keep free and total separate - free magnesium is 1-2 mM against 20-100 mM total, and free calcium is about 50-100 NANOmolar against millimolar outside.' },
];

export function refusal(id) { return REFUSALS.find(r => r.id === id) ?? null; }

/** Does a proposed caption overstate what the level can support? */
export function checkCaption(levelId, caption) {
  const text = String(caption).toLowerCase();
  const hits = [];
  // NOT /\b(simulat|...)\b/ - a trailing word boundary after "simulat" can never match "simulation",
  // so the first version of this checker passed every caption containing the word it exists to catch.
  const simulationWords = /\b(?:simulat\w*|molecular dynamics|comput\w*|physics engine|solv\w*)\b/;
  const drawnLevels = ['embryo', 'cell-population', 'cell', 'organelle'];
  if (drawnLevels.includes(levelId) && simulationWords.test(text)) {
    hits.push({ refusal: 'atoms-above-the-molecule-scale', why: `"${levelId}" is measured or drawn, not computed. A caption claiming simulation at this level overstates by many orders of magnitude.` });
  }
  if (/\b(bond|covalent)\b/.test(text) && /\b(break|breaking|form|forming)\b/.test(text) && simulationWords.test(text)) {
    hits.push({ refusal: 'covalent-bonds', why: 'a classical trajectory cannot contain this event.' });
  }
  if (/\b(electron|redox|oxidation|photon|light absorption)\b/.test(text) && simulationWords.test(text)) {
    hits.push({ refusal: 'electrons', why: 'there is no electronic degree of freedom in a classical force field.' });
  }
  if (/\bhydrogen bond\b/.test(text) && /\b(energ|comput|calculat)/.test(text)) {
    hits.push({ refusal: 'hydrogen-bond-energies', why: 'there is no explicit hydrogen-bond term; it is emergent.' });
  }
  return { ok: hits.length === 0, hits, pattern: PATTERN };
}
