// THE SCALE LADDER: at every zoom level, what is being computed, what is being drawn, and the arithmetic
// that decides which.
//
// ============================== WHY THIS FILE EXISTS BEFORE ANY GEOMETRY ==============================
// The ask is a continuous zoom from a developing embryo down to individual atoms, with every water
// molecule visible and real physics underneath. The first half of that is achievable. The second half is
// achievable ONLY inside a very small window, and the window's size is not a matter of engineering
// effort - it is set by how many atoms exist in a given volume, which is arithmetic.
//
// A zebrafish egg holds about 6e18 water molecules. The largest all-atom molecular dynamics runs ever
// published are of order 1e9 to 1e10 atoms, for nanoseconds. The egg is therefore roughly a BILLION times
// too large to simulate atom by atom, and no hardware roadmap closes a gap of that size.
//
// So this cannot be one simulation. It is a stack of engines, and the only honest product is one where
// the screen always says which engine you are inside and what that engine cannot do. This file computes
// that boundary rather than asserting it, so when the ceilings are updated the verdicts move by
// themselves and nobody has to remember to revise a sentence.
//
// ============================== WHAT "SIMULATED" IS ALLOWED TO MEAN ==============================
//   computed    a solver ran and produced these positions. The equations are shown and the cost is counted.
//   measured    these positions came from published experimental data. Nothing was solved; this is a
//               recording. (The embryo level is this, and it is the STRONGEST kind of evidence here, not
//               the weakest - real cells divided in a real microscope.)
//   depicted    nothing was solved and nothing was measured at this scale. The arrangement is chosen for
//               legibility. This is not a failure state; it is most of any cell picture ever published.
//               It is only a failure when it is not labelled.
//
// Danio rerio. Nothing here spawns a solver; this module is arithmetic and declarations only.

export const NA = 6.02214076e23;                 // Avogadro, exact by definition since 2019

/** Water content. Pure water is 55.5 M; cytoplasm is less, because macromolecules take up room. */
export const WATER = {
  pure_molarity_M: 55.5,
  pure_per_m3: 55.5 * 1000 * NA,                 // 3.342e28 molecules per cubic metre
  cytoplasm_volume_fraction: { value: 0.7, kind: 'APPROXIMATION - PENDING SOURCE', why: 'cytoplasm is widely quoted as roughly 70 % water by volume, with macromolecules occupying the rest. A sourced value is being collected; until it lands this is labelled and the ladder reports both the pure-water and the crowded figure.' },
  atoms_per_molecule: 3,
};

/** What a molecular-dynamics engine can actually reach. These are CEILINGS, not targets, and a run at the
 *  ceiling is a supercomputer campaign rather than something a workstation does.
 *  Each carries its sourcing state, because the verdicts below are computed from them. */
export const MD_CEILINGS = {
  routine_workstation_atoms: { value: 1e6, kind: 'ORDER OF MAGNITUDE - PENDING SOURCE', why: 'a system a single modern GPU can integrate for a useful length of time. Being sourced against published engine benchmarks.' },
  heroic_atoms: { value: 1e9, kind: 'ORDER OF MAGNITUDE - PENDING SOURCE', why: 'the scale of the largest published all-atom runs, achieved on leadership-class machines for very short simulated times. The "largest system" record and the "longest time" record are DIFFERENT runs and must never be quoted as one capability.' },
  note: 'System size and simulated time trade against each other. A ceiling expressed in atoms alone is only half a statement, and every verdict below that uses one says so.',
};

const sphereVolume = d => (4 / 3) * Math.PI * Math.pow(d / 2, 3);

/** The levels, largest to smallest. `size_m` is a characteristic length; `volume_m3` overrides it where a
 *  level is a box rather than a sphere. */
export const LEVELS = [
  { id: 'embryo', what: 'the whole embryo, cells dividing and moving', size_m: 0.7e-3,
    engine: 'measured', basis: 'published 4D light-sheet microscopy with tracked nuclei',
    why_not_computed: 'nothing needs to be computed here, and computing it would be worse. Real tracked nuclei from a real microscope are evidence; a cell-mechanics model of the same thing would be a hypothesis wearing the same picture.',
    asynchrony: 'cells divide out of step after the midblastula transition because the DATA does, not because a random number generator was asked to make it look alive.' },
  { id: 'cell-population', what: 'a patch of neighbouring cells, membranes in contact', size_m: 2.5e-4,
    engine: 'depicted', basis: 'cell positions from the same measured tracks; membranes and shapes drawn',
    size_note: 'a patch spanning several blastomeres - deliberately larger than the single-cell level below it, which an earlier version of this table got backwards.' },
  { id: 'cell', what: 'one blastomere, nucleus and cytoplasm distinguished', size_m: 0.7e-3 / Math.cbrt(512),
    engine: 'depicted', basis: 'measured dimensions, drawn geometry' },
  { id: 'organelle', what: 'a mitochondrion, the nuclear envelope, ribosomes', size_m: 1e-6,
    engine: 'depicted', basis: 'morphology from published cryo-electron tomography; counts from measured concentrations' },
  { id: 'crowded-cytoplasm', what: 'a box of cytoplasm with its real complement of protein, water and metabolites', volume_m3: 1e-21,
    engine: 'computed-or-depicted', basis: 'a 100 nm box is at the edge of the largest runs ever done; a smaller box is genuinely integrable' },
  { id: 'macromolecule', what: 'a ribosome, a tRNA, a membrane patch, with surrounding water', size_m: 25e-9,
    engine: 'computed', basis: 'classical molecular dynamics from a published structure and a published force field' },
  { id: 'atomistic', what: 'individual atoms, hydrogen bonds forming and breaking, van der Waals contact', size_m: 5e-9,
    engine: 'computed', basis: 'the same trajectory, read at single-atom resolution' },
  { id: 'electronic', what: 'covalent bonds made and broken, electrons moving, oxidation state changing', size_m: 1e-9,
    engine: 'REFUSED-BY-CLASSICAL-MD', basis: 'not representable in a classical force field at all',
    refusal: 'A classical force field holds covalent bonds as springs with fixed connectivity. It CANNOT break or form one, and it has no electrons to move. Showing a bond breaking on top of a classical trajectory would be an animation drawn over physics that does not contain the event. This level is therefore either computed by a quantum method on a handful of atoms, or it is explicitly drawn and labelled - never silently blended into the trajectory above it.' },
];

/** How many water molecules, and how many atoms, fit in a level. */
export function occupancy(level, { crowded = true } = {}) {
  const V = level.volume_m3 ?? sphereVolume(level.size_m);
  const frac = crowded ? WATER.cytoplasm_volume_fraction.value : 1;
  const water = V * WATER.pure_per_m3 * frac;
  return {
    volume_m3: +V.toPrecision(3),
    water_molecules: +water.toPrecision(3),
    atoms_of_water: +(water * WATER.atoms_per_molecule).toPrecision(3),
    water_basis: crowded
      ? `${frac} of the volume taken as water (${WATER.cytoplasm_volume_fraction.kind})`
      : 'pure water, no macromolecular crowding',
    note: 'water alone. Protein, lipid and nucleic acid atoms are additional, so every atom count here is a LOWER bound on what a full all-atom model would hold.',
  };
}

/** Can this level be integrated atom by atom? Computed from the ceilings, not asserted. */
export function verdict(level) {
  if (level.engine === 'REFUSED-BY-CLASSICAL-MD') return { simulatable: false, reason: level.refusal, kind: 'refusal' };
  const occ = occupancy(level);
  const atoms = occ.atoms_of_water;
  const routine = MD_CEILINGS.routine_workstation_atoms.value;
  const heroic = MD_CEILINGS.heroic_atoms.value;
  if (atoms <= routine) return { simulatable: true, tier: 'routine', atoms, ratio_to_routine_ceiling: +(atoms / routine).toPrecision(3),
    reason: `about ${atoms.toExponential(2)} atoms of water, at or under the ~${routine.toExponential(0)} a single machine can integrate usefully. This level can genuinely be computed.` };
  if (atoms <= heroic) return { simulatable: 'only-at-heroic-scale', tier: 'heroic', atoms, ratio_to_routine_ceiling: +(atoms / routine).toPrecision(3),
    reason: `about ${atoms.toExponential(2)} atoms of water - beyond a workstation by ${(atoms / routine).toExponential(1)}x, but within the scale of the largest published runs, which reached nanoseconds on leadership-class machines. Computable in principle; not computable here.` };
  return { simulatable: false, tier: 'beyond', atoms, times_beyond_heroic_ceiling: +(atoms / heroic).toPrecision(3),
    reason: `about ${atoms.toExponential(2)} atoms of water, roughly ${(atoms / heroic).toExponential(1)}x beyond the largest all-atom run ever published. This level cannot be computed atom by atom by anyone, and anything shown at it is measured or drawn.` };
}

/** The whole ladder, with the boundary located rather than assumed. */
export function ladder(opts = {}) {
  const levels = LEVELS.map(l => ({ ...l, occupancy: l.engine === 'REFUSED-BY-CLASSICAL-MD' ? null : occupancy(l, opts), verdict: verdict(l) }));
  // The boundary sits BETWEEN two adjacent levels, so both sides must be the ones nearest it: the largest
  // level that can still be computed, and the smallest that cannot. Taking the first non-computable level
  // in list order returns the embryo, which is true but useless - it names the far end of the ladder
  // rather than the edge the zoom actually crosses.
  const computable = levels.filter(l => l.verdict.simulatable === true);
  const notComputable = levels.filter(l => l.verdict.simulatable === false && l.verdict.kind !== 'refusal');
  const deepestComputable = computable[0] ?? null;                              // largest computable
  const shallowestDrawn = notComputable[notComputable.length - 1] ?? null;      // smallest not computable
  return {
    levels,
    the_boundary: {
      largest_level_that_can_genuinely_be_computed: deepestComputable?.id ?? null,
      smallest_level_that_cannot: shallowestDrawn?.id ?? null,
      statement: deepestComputable && shallowestDrawn
        ? `Everything at "${deepestComputable.id}" and below can be computed atom by atom. Everything at "${shallowestDrawn.id}" and above is measured or drawn. The zoom crosses that line, and the screen must say so when it does.`
        : 'the boundary could not be located from the current ceilings',
      why_it_is_not_an_engineering_problem:
        'The gap is set by how many atoms occupy a volume. Between a cell and a molecule it is eight or ' +
        'nine orders of magnitude. No amount of optimisation crosses that, which is why the architecture ' +
        'is a stack of engines with labelled seams rather than one simulation that quietly degrades.',
    },
    ceilings: MD_CEILINGS,
    what_the_engine_labels_mean: {
      computed: 'a solver ran. Equations shown, cost counted.',
      measured: 'published experimental data. Nothing solved - a recording.',
      depicted: 'neither solved nor measured at this scale; arranged for legibility. Most published cell illustrations are this. It is only dishonest when unlabelled.',
      'computed-or-depicted': 'depends on the box size chosen at run time; the verdict above says which side of the ceiling it falls on.',
      'REFUSED-BY-CLASSICAL-MD': 'the physics being asked for is not in the model at all. See the level\'s refusal text.',
    },
  };
}
