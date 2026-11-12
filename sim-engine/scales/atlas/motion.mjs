// HOW THESE THINGS ACTUALLY MOVE, and the extrapolation that is not allowed to stand in for it.
//
// ============================== WHY THIS FILE EXISTS ==============================
// The atlas draws molecular machines at measured sizes in measured numbers, and then holds them
// perfectly still. Still is a claim, and it is false: at this scale everything is in violent thermal
// motion, and the motion is not decoration - it IS the mechanism. A ribosome does not travel to an
// mRNA, it collides with one. So the viewer has to move them, and the question is how fast.
//
// That question has a clean textbook answer and the textbook answer is wrong, in a way this file can
// quantify but not fix.
//
// ============================== THE CLEAN ANSWER ==============================
// Stokes-Einstein: D = kT / (6 pi eta r). Measure one probe, scale by radius, done. And there is a
// good probe: Swaminathan, Hoang & Verkman measured GFP by photobleaching recovery in both saline and
// cell cytoplasm, which gives an absolute D and a cytoplasmic slowdown in the same experiment.
//
// ============================== WHY IT IS WRONG ==============================
// That same paper contains the first warning, in its own numbers. GFP's slowdown in cytoplasm is 3.2x
// by TRANSLATION and 1.5x by ROTATION. A single viscosity cannot produce two numbers. Rotation
// samples a couple of nanometres and sees nearly water; translation crosses microns and sees
// obstacles. "The viscosity of cytoplasm" is not a quantity.
//
// The second warning is decisive. Delarue et al. tracked genetically encoded nanoparticles of defined
// size and found that the cytoplasm's resistance is SIZE-SPECIFIC: tuning ribosome concentration
// changes the effective diffusion coefficient of particles from 20 to 200 nm by more than twofold,
// "without any discernable effect on the motion of molecules <= 5 nm". GFP is about 5 nm. A ribosome
// is about 28 nm. Scaling from the first to the second is exactly the extrapolation their result says
// does not hold - and the crowder doing the hindering is the ribosome itself.
//
// So this file computes the Stokes-Einstein number, labels it an UPPER BOUND, and says what would
// replace it. The viewer animates at the upper bound and the panel says so. Drawing molecules frozen
// would be a worse lie than drawing them slightly too fast, but only slightly worse, and only because
// the direction of the error is known and stated.
//
// ============================== WHAT IS MEASURED AND ANIMATED EXACTLY ==============================
// Two things here are not bounds. The transient clustering of RNA polymerase II has a measured
// lifetime of 5.1 +/- 0.4 s, and GFP's photobleaching recovery in cytoplasm is 82 +/- 2 % complete,
// so a fifth of the population is not diffusing at all on that timescale. Both are drawn as measured.

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

export const CITATIONS = deepFreeze({
  swaminathan_1997:
    'Swaminathan, R., Hoang, C.P. & Verkman, A.S. (1997) Photobleaching recovery and anisotropy decay of '
    + 'green fluorescent protein GFP-S65T in solution and cells: cytoplasmic viscosity probed by green '
    + 'fluorescent protein translational and rotational diffusion. Biophys J 72:1900-1907. '
    + 'doi:10.1016/S0006-3495(97)78835-0, PMID 9083693, PMC1184383. Source of the absolute GFP diffusion '
    + 'coefficient, the translational and rotational cytoplasmic slowdowns, and the mobile fraction. '
    + 'Read as the PubMed abstract in this run; the full text was not retrieved.',
  delarue_2018:
    'Delarue, M. et al. (2018) mTORC1 Controls Phase Separation and the Biophysical Properties of the '
    + 'Cytoplasm by Tuning Crowding. Cell 174:338-349.e20. doi:10.1016/j.cell.2018.05.042, PMID 29937223, '
    + 'PMC10080728. Genetically encoded multimeric nanoparticles of defined size, tracked in HEK293 and '
    + 'yeast. The source of the size-specific result that rules out the Stokes-Einstein extrapolation '
    + 'used here. Full text read in this run; the diffusion coefficients themselves are in figures and '
    + 'were NOT recoverable from the text, so no number is taken from it.',
  cisse_2013:
    'Cisse, I.I. et al. (2013) Real-time dynamics of RNA polymerase II clustering in live human cells. '
    + 'Science 341:664-667. doi:10.1126/science.1239053, PMID 23828889. Pol II clusters form transiently '
    + 'with an average lifetime of 5.1 +/- 0.4 s, which refutes the idea that they are static '
    + 'substructures. Read as the PubMed abstract in this run.',
  weiss_2004:
    'Weiss, M., Elsner, M., Kartberg, F. & Nilsson, T. (2004) Anomalous subdiffusion is a measure for '
    + 'cytoplasmic crowding in living cells. Biophys J 87:3518-3524. doi:10.1529/biophysj.104.044263, '
    + 'PMID 15339818, PMC1304817. Establishes that mean square displacement in HeLa cytoplasm grows '
    + 'LESS than linearly in time and that the degree depends on the size and conformation of the '
    + 'particle. The PMC record returned an empty full text in this run, so no exponent is quoted.',
  machines_module:
    'sim-engine/scales/molecular/machines.mjs, for the principal extents measured from deposited '
    + 'coordinates. No size here is quoted from literature.',
});

// ---------------------------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------------------------

export const PHYS = Object.freeze({
  boltzmann_J_per_K: 1.380649e-23,     // exact, SI definition since 2019
  water_viscosity_Pa_s: Object.freeze({
    at_23C: 9.321e-4,
    at_37C: 6.913e-4,
    note: 'pure water. The paper measured in "aqueous saline"; saline at these concentrations differs by well under a percent and that is far inside the other uncertainties here.',
  }),
});

/** THE TEMPERATURE THAT IS NOT STATED.
 *  Swaminathan's abstract does not give the temperature of the solution measurements, and the inferred
 *  hydrodynamic radius of GFP moves by about 40% between bench temperature and body temperature. Both
 *  are computed; neither is picked. */
export const TEMPERATURE = Object.freeze({
  not_established: true,
  why: 'the abstract read in this run does not state it, and the full text was not retrieved.',
  candidates: Object.freeze([
    { label: 'bench, 23 C', K: 296.15, eta_Pa_s: PHYS.water_viscosity_Pa_s.at_23C },
    { label: 'body, 37 C', K: 310.15, eta_Pa_s: PHYS.water_viscosity_Pa_s.at_37C },
  ]),
});

export const MEASURED = deepFreeze({
  gfp_diffusion_in_saline: {
    value: 87, units: 'um^2/s',
    as_published: '8.7e-7 cm^2/s',
    method: 'fluorescence recovery after photobleaching, 5 um diameter spot, half-time 30 +/- 2 ms',
    cite: 'swaminathan_1997',
  },
  cytoplasmic_slowdown_translational: {
    value: 3.2, units: 'x slower than saline',
    method: 'photobleaching recovery half-time of 83 +/- 6 ms in CHO cytoplasm against 30 +/- 2 ms in saline',
    cite: 'swaminathan_1997',
  },
  cytoplasmic_slowdown_rotational: {
    value: 1.5, units: 'x slower than saline',
    method: 'rotational correlation time of 36 +/- 3 ns in cytoplasm against 20 ns in solution',
    cite: 'swaminathan_1997',
    why_it_matters:
      'it disagrees with the translational figure by a factor of 2.1 in the SAME cells in the SAME '
      + 'paper. Rotation probes a couple of nanometres and sees nearly water; translation crosses microns '
      + 'and sees obstacles. There is no single number called the viscosity of cytoplasm.',
  },
  mobile_fraction: {
    value: 0.82, interval: [0.80, 0.84], units: 'fraction of GFP recovering after photobleaching',
    implies: 'about 18 % of the population is immobile on the timescale of the measurement',
    cite: 'swaminathan_1997',
  },
  pol2_cluster_lifetime: {
    value: 5.1, interval: [4.7, 5.5], units: 's',
    method: 'single-molecule-sensitive live-cell imaging in human cells',
    what_it_refutes: 'that Pol II "transcription factories" are statically assembled substructures',
    cite: 'cisse_2013',
  },
  size_specificity_of_crowding: {
    affected_range_nm: [20, 200],
    unaffected_at_or_below_nm: 5,
    effect: 'more than 2-fold change in effective diffusion coefficient, by tuning ribosome concentration alone',
    cell_type: 'HEK293 and budding yeast',
    cite: 'delarue_2018',
    what_it_rules_out:
      'using a <= 5 nm probe to predict the motion of a 20-200 nm machine by radius scaling. That is '
      + 'precisely the pair of sizes across which the measured behaviour differs.',
  },
  subdiffusion: {
    exponent: null,
    null_reason:
      'the mean square displacement in HeLa cytoplasm is established to grow less than linearly in time, '
      + 'with the degree depending on particle size and protein concentration, but the PMC full text '
      + 'returned empty in this run so no exponent is quoted. The viewer therefore animates NORMAL '
      + 'diffusion and says it is doing so.',
    direction_of_the_error:
      'subdiffusion means displacement grows more slowly than sqrt(t). Normal diffusion therefore '
      + 'OVERSTATES how far a machine gets, on top of the Stokes-Einstein overstatement. Both errors '
      + 'point the same way: the drawing is too fast.',
    cite: 'weiss_2004',
  },
});

// ---------------------------------------------------------------------------------------------
// the derivation, and its own refutation
// ---------------------------------------------------------------------------------------------

/** Stokes-Einstein. r in metres, eta in Pa s, T in K. Returns m^2/s. */
export function stokesEinstein(r_m, eta_Pa_s, T_K) {
  if (!(r_m > 0) || !(eta_Pa_s > 0) || !(T_K > 0)) throw new Error('stokesEinstein: positive r, eta, T required');
  return (PHYS.boltzmann_J_per_K * T_K) / (6 * Math.PI * eta_Pa_s * r_m);
}

/** The same relation solved for the radius: given a measured D, what sphere would that be? */
export function hydrodynamicRadius(D_m2_s, eta_Pa_s, T_K) {
  if (!(D_m2_s > 0)) throw new Error('hydrodynamicRadius: positive D required');
  return (PHYS.boltzmann_J_per_K * T_K) / (6 * Math.PI * eta_Pa_s * D_m2_s);
}

/** GFP's hydrodynamic radius, inferred from its measured D at each candidate temperature.
 *  This is a consistency check as much as an input: if the inferred radius came out nothing like a
 *  known protein size, the chain would be broken somewhere. */
export function gfpRadiusNm() {
  const D = MEASURED.gfp_diffusion_in_saline.value * 1e-12; // um^2/s -> m^2/s
  return TEMPERATURE.candidates.map((c) => ({
    label: c.label,
    radius_nm: hydrodynamicRadius(D, c.eta_Pa_s, c.K) * 1e9,
  }));
}

/** The equivalent-sphere radius of a machine, in nm, from its three measured principal extents.
 *  The geometric mean of the extents is the diameter of the sphere of the same volume. */
export function equivalentRadiusNm(principal_extents_nm) {
  const e = principal_extents_nm;
  if (!Array.isArray(e) || e.length !== 3 || e.some((x) => !(x > 0))) return null;
  return Math.cbrt(e[0] * e[1] * e[2]) / 2;
}

export const UPPER_BOUND = Object.freeze({
  what_it_is: 'the diffusion coefficient a machine would have if Stokes-Einstein held in cytoplasm',
  why_only_a_bound: MEASURED.size_specificity_of_crowding.what_it_rules_out,
  direction: 'too fast. Both known errors - the size-specific crowding and the subdiffusion - slow real machines relative to this number.',
  what_would_replace_it:
    'a measured diffusion coefficient for a ribosome-sized particle in mammalian cytoplasm. Delarue et '
    + 'al. measured exactly that for 40 nm nanoparticles in HEK293, but the values live in the figures '
    + 'and the full text as retrieved carries none of them. A table of D against particle diameter would '
    + 'settle it outright.',
});

/** Diffusion coefficient for a machine, as an UPPER BOUND, in um^2/s.
 *  Scales the measured GFP coefficient by radius and divides by the measured translational slowdown. */
export function diffusionUpperBound(radius_nm, { temperature = 'body, 37 C' } = {}) {
  const t = TEMPERATURE.candidates.find((c) => c.label === temperature) ?? TEMPERATURE.candidates[1];
  const gfp = gfpRadiusNm().find((g) => g.label === t.label);
  if (!(radius_nm > 0)) return null;
  const inSaline = MEASURED.gfp_diffusion_in_saline.value * (gfp.radius_nm / radius_nm);
  const inCytoplasm = inSaline / MEASURED.cytoplasmic_slowdown_translational.value;
  return Object.freeze({
    radius_nm,
    temperature: t.label,
    gfp_radius_nm: gfp.radius_nm,
    D_saline_um2_s: inSaline,
    D_cytoplasm_um2_s: inCytoplasm,
    is_upper_bound: true,
    why: UPPER_BOUND.why_only_a_bound,
  });
}

// ---------------------------------------------------------------------------------------------
// turning a diffusion coefficient into an animation
// ---------------------------------------------------------------------------------------------

/** Root-mean-square displacement in three dimensions after time t: sqrt(6 D t). */
export function rmsDisplacementUm(D_um2_s, t_s) {
  if (!(D_um2_s >= 0) || !(t_s >= 0)) throw new Error('rmsDisplacementUm: non-negative D and t required');
  return Math.sqrt(6 * D_um2_s * t_s);
}

/** Per-axis standard deviation of the Gaussian step: sqrt(2 D t). Three independent draws of this
 *  give a 3D step whose RMS length is sqrt(6 D t), which is the identity the test checks. */
export function stepSigmaUm(D_um2_s, t_s) {
  return Math.sqrt(2 * D_um2_s * t_s);
}

/** THE REASON THE ANIMATION CANNOT RUN IN REAL TIME.
 *
 *  Given a box and a frame rate, how far does a machine move per frame at its real diffusion
 *  coefficient, and by what factor must time be slowed for the motion to be followable?
 *
 *  Displacement grows as the square root of time, so slowing time by k slows displacement by sqrt(k):
 *  the time factor needed is the SQUARE of the displacement factor. */
export function animationPlan({ D_um2_s, box_um, fps = 60, target_fraction_of_box = 0.005 }) {
  const dt = 1 / fps;
  const real = rmsDisplacementUm(D_um2_s, dt);
  const target = box_um * target_fraction_of_box;
  const slowdown = real <= target ? 1 : (real / target) ** 2;
  return Object.freeze({
    D_um2_s,
    box_um,
    fps,
    real_rms_per_frame_um: real,
    real_rms_as_fraction_of_box: real / box_um,
    target_rms_per_frame_um: target,
    time_slowdown_factor: slowdown,
    one_second_of_animation_is_s_of_real_time: 1 / slowdown,
    needs_slowing: slowdown > 1,
    why: real > box_um
      ? 'at real speed a machine crosses the whole box in a single frame, so real-time motion is not a picture of anything'
      : 'at real speed the motion is a blur rather than a trajectory',
  });
}

/** ONE CLOCK FOR THE WHOLE SCENE.
 *
 *  Every machine needs a different slowdown to be followable - a ribosome about 4,000x, a polymerase
 *  about 7,700x, because the small ones are the fast ones. Giving each its own factor would make every
 *  machine move at the same comfortable speed on screen, which destroys the one thing the motion is
 *  actually showing: that a polymerase explores the cell several times faster than a ribosome does.
 *
 *  So the scene takes a SINGLE time factor, the largest any member needs, and every machine is stepped
 *  with the same slowed dt. The ribosome then visibly lags, which is the measurement. */
export function sceneAnimationPlan(members, { box_um, fps = 60, target_fraction_of_box = 0.005 } = {}) {
  if (!Array.isArray(members) || !members.length) throw new Error('sceneAnimationPlan: members required');
  const plans = members.map((m) => ({
    machine: m.machine,
    radius_nm: m.radius_nm,
    D_um2_s: m.D_um2_s,
    own: animationPlan({ D_um2_s: m.D_um2_s, box_um, fps, target_fraction_of_box }),
  }));
  const slowdown = Math.max(...plans.map((p) => p.own.time_slowdown_factor));
  const slowest = plans.find((p) => p.own.time_slowdown_factor === slowdown);
  const dt = 1 / (fps * slowdown);
  return Object.freeze({
    time_slowdown_factor: slowdown,
    set_by: slowest.machine,
    why_set_by_the_fastest: 'the machine needing the most slowing is the one with the largest D, which is the smallest machine. Sizing the clock to it keeps every other machine inside the budget.',
    slowed_dt_s: dt,
    one_second_of_animation_is_s_of_real_time: 1 / slowdown,
    fps,
    box_um,
    members: Object.freeze(plans.map((p) => Object.freeze({
      machine: p.machine,
      radius_nm: p.radius_nm,
      D_um2_s: p.D_um2_s,
      step_sigma_um: stepSigmaUm(p.D_um2_s, dt),
      rms_per_frame_um: rmsDisplacementUm(p.D_um2_s, dt),
      rms_as_fraction_of_box: rmsDisplacementUm(p.D_um2_s, dt) / box_um,
      // the quantity the shared clock preserves
      speed_relative_to_slowest: Math.sqrt(p.D_um2_s / Math.min(...plans.map((q) => q.D_um2_s))),
    }))),
    what_this_preserves:
      'relative speeds. Displacement per frame scales as sqrt(D), so under one shared clock the ratio '
      + 'of any two machines on screen is the square root of the ratio of their diffusion coefficients, '
      + 'which is the ratio in the cell.',
  });
}

/** A reproducible uniform generator that is actually uniform.
 *
 *  The first version of this - and of the viewer's instance placement - was the textbook LCG
 *  `s = (s * 1103515245 + 12345) & 0x7fffffff`. In JavaScript that is broken: numbers are float64 with
 *  53 bits of integer precision, and s * 1103515245 reaches about 2.4e18, which is 2^61. The low bits
 *  are silently lost before the mask ever runs, so the sequence is biased.
 *
 *  It was caught by the statistical assertion in the test, not by reading the code: stepping 100,000
 *  walkers reproduced sqrt(6 D t) to 1.04 % when it should land inside 0.2 %. A biased generator is
 *  invisible in a still frame and invisible in a code review, and shows up only when something
 *  measures the distribution it produces.
 *
 *  mulberry32 instead, which keeps every operation in 32-bit integer space via Math.imul. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller, so the step is Gaussian rather than uniform. A uniform step gives the wrong
 *  displacement distribution and, over many steps, visibly the wrong exploration of the box. */
export function gaussianPair(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

export const WHAT_THE_VIEWER_DRAWS = deepFreeze({
  brownian_step:
    'each machine takes an independent Gaussian step per frame with per-axis sigma = sqrt(2 D dt), at '
    + 'the slowed dt from animationPlan. That is normal diffusion, which the subdiffusion record above '
    + 'says is the wrong model, in a stated direction.',
  immobile_fraction: {
    value: 1 - MEASURED.mobile_fraction.value,
    drawn_as: 'a fixed share of each population does not move at all',
    source: 'the 82 +/- 2 % mobile fraction measured by photobleaching recovery',
    honesty:
      'the measurement says a fifth of GFP does not recover on that timescale. It does NOT say which '
      + 'fifth, or why, or that the same share applies to a ribosome. Drawing a fixed immobile share is '
      + 'the simplest depiction consistent with the number and is not more than that.',
  },
  pol2_clustering: {
    lifetime_s: MEASURED.pol2_cluster_lifetime.value,
    drawn_as: 'polymerase instances gather into transient clusters that dissolve on the measured timescale',
    honesty:
      'the lifetime is measured. The cluster SIZE, the number of molecules in one, and the mechanism '
      + 'that gathers them are not taken from anywhere and are depicted.',
  },
  no_collisions:
    'machines pass through one another. At the measured occupancy this is visibly wrong, and excluded '
    + 'volume is the single largest missing piece of physics here - it is also what makes the real '
    + 'motion subdiffusive, so the two omissions are the same omission.',
});

export const WHAT_THIS_DOES_NOT_MODEL = Object.freeze([
  'excluded volume. Machines overlap freely, which is the main reason the real motion is subdiffusive and this is not.',
  'hydrodynamic interaction between neighbours, which at this density is not a small correction.',
  'binding. Almost every machine here spends much of its life attached to something - a ribosome to an mRNA, a polymerase to DNA - and attachment, not diffusion, dominates where it is.',
  'active transport. Motors move cargo along filaments at rates that have nothing to do with diffusion.',
  'the cytoskeleton, which is both an obstacle and a track, and is not drawn at all.',
  'any dependence on position. The cytoplasm is treated as uniform, and it is not: the nucleus, organelles and condensates all have their own environments.',
  'temperature, beyond picking one of two candidates for a value the source does not state.',
]);

export function worked() {
  const lines = [];
  const gfp = gfpRadiusNm();
  lines.push('GFP hydrodynamic radius inferred from its measured D of 87 um^2/s:');
  for (const g of gfp) lines.push(`  ${g.label}: ${g.radius_nm.toFixed(2)} nm`);
  lines.push(`  the larger is ${(gfp[1].radius_nm / gfp[0].radius_nm).toFixed(2)}x the smaller, and the source does not state which applies`);
  lines.push('');
  const rib = equivalentRadiusNm([30.2, 27.3, 26.1]);
  const d = diffusionUpperBound(rib);
  lines.push(`ribosome equivalent radius from measured extents: ${rib.toFixed(2)} nm`);
  lines.push(`  upper-bound D in cytoplasm: ${d.D_cytoplasm_um2_s.toFixed(2)} um^2/s`);
  const plan = animationPlan({ D_um2_s: d.D_cytoplasm_um2_s, box_um: 2.702 });
  lines.push(`  at 60 fps it would move ${plan.real_rms_per_frame_um.toFixed(3)} um per frame, which is `
    + `${(100 * plan.real_rms_as_fraction_of_box).toFixed(1)} % of the 2.702 um box`);
  lines.push(`  so the animation runs ${Math.round(plan.time_slowdown_factor).toLocaleString('en-GB')}x slower than real time:`);
  lines.push(`  one second on screen is ${(plan.one_second_of_animation_is_s_of_real_time * 1e6).toFixed(0)} microseconds of cell time`);
  return lines.join('\n');
}
