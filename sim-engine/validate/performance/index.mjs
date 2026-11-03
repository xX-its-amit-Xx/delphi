// THE PERFORMANCE LAYER: does the design do the job it was asked to do?
//
// Three runs asked for three things no layer could express, and each refusal was correct and useless:
//
//   "a fruit fly that lives longer"              -> no scenario measures time-to-death
//   "a xenobot that sweeps particles into piles" -> no check asks whether it can move anything
//   "a bacterium that eats carbon"               -> no check asks whether the carbon adds up
//
// None of them is a shape and none is a gait, so neither the blueprint layer nor the locomotion layer could
// take them. This is the layer for what the organism ACCOMPLISHES.
//
// The hard part of such a layer is that it is where a validation suite most wants to become a rubber stamp:
// "the design says it does X, therefore X". Every check here is built on something that cannot be argued
// with, and refuses rather than reaching past it:
//
//   lifespan      expected lifetime under a constant two-term hazard, E[T] = 1/(h_int + h_ext). The
//                 arithmetic is exact; the point it makes is a life-history one going back to Medawar and
//                 Williams -- when extrinsic mortality dominates, extending intrinsic lifespan buys almost
//                 nothing, and the check reports exactly how little.
//   manipulation  Stokes drag, F = 6*pi*mu*a*v. To move a particle through a fluid at low Reynolds number
//                 you must exceed that force; a design whose declared thrust does not is not slow at it.
//   mass_balance  conservation of mass. Carbon leaving as biomass plus carbon leaving as CO2 cannot exceed
//                 carbon taken in. A design claiming otherwise is not optimistic, it is impossible.
//
// Every quantity arrives as {value, source} or {min, max, source} and a bare number is refused by name, as
// everywhere else in this repository. What the layer never does is accept a declared OUTCOME: you may
// declare an uptake rate, and you may not declare that the organism works.
export const VERSION = '0.1.0';
export const SCOPE = 'What the design accomplishes, as distinct from its shape or its gait. Three checks, each resting on something that cannot be argued with -- a constant-hazard expectation, Stokes drag, and conservation of mass -- evaluated over quantities the caller declares with sources. It models no mechanism: it does not say HOW the organism would live longer, exert a force or fix carbon, only whether the numbers a designer states are consistent with each other and with physics. A design this layer does not contradict has not been shown to work.';

const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];

function readQ(name, v, unit, { required = true } = {}) {
  if (v == null) return required
    ? { ok: false, why: `${name} was not given, and cannot be defaulted: a hazard rate or a thrust chosen by this tool would be this tool's expectation reported as the organism's property.` }
    : { ok: true, absent: true };
  if (typeof v === 'number') return { ok: false, why: `${name} was given as a bare number (${v} ${unit}) with no source.` };
  const src = typeof v.source === 'string' && v.source.trim() ? v.source.trim() : null;
  if (!src) return { ok: false, why: `${name} has no \`source\`.` };
  const given = typeof v.kind === 'string' ? v.kind.trim() : '';
  if (given && !KINDS.includes(given)) return { ok: false, why: `${name} has kind "${given}", which is not one of ${KINDS.join(', ')}.` };
  const nums = typeof v.value === 'number' ? [v.value, v.value] : [v.min, v.max];
  if (!nums.every(x => typeof x === 'number' && Number.isFinite(x))) return { ok: false, why: `${name} needs a numeric \`value\`, or numeric \`min\` and \`max\`.` };
  if (nums[0] < 0 || nums[1] < nums[0]) return { ok: false, why: `${name} must satisfy 0 <= min <= max (got ${nums[0]}..${nums[1]} ${unit}).` };
  return { ok: true, min: nums[0], max: nums[1], point: nums[0] === nums[1], unit, kind: given || 'assumed', source: src };
}
const strip = q => ({ min: q.min, max: q.max, unit: q.unit, kind: q.kind, source: q.source });
const fmt = q => (q.point ? String(q.min) : `${q.min}-${q.max}`);
const sig = x => (!Number.isFinite(x) ? String(x) : Math.abs(x) >= 1000 || (Math.abs(x) < 0.01 && x !== 0) ? x.toExponential(2) : String(Math.round(x * 1000) / 1000));

export const CHECK_KINDS = {
  lifespan: 'Does the design actually live longer? Expected lifetime under a constant two-term hazard.',
  manipulation: 'Can it move what it was asked to move? Declared thrust against Stokes drag on the particle.',
  mass_balance: 'Does the carbon add up? Uptake against biomass plus respiration.',
};

export function performanceCheck(a = {}) {
  const base = { tool: 'performance_check', version: VERSION, kind: a.kind ?? null, taxon: a.taxon ?? null, ran: false };
  if (!a.kind || !CHECK_KINDS[a.kind]) {
    return { ...base, verdict: 'cannot-evaluate',
      reason: `kind must be one of ${Object.keys(CHECK_KINDS).join(', ')}${a.kind ? ` (got "${a.kind}")` : ''}.`, kinds: CHECK_KINDS };
  }
  if (a.kind === 'lifespan') return lifespan(a, base);
  if (a.kind === 'manipulation') return manipulation(a, base);
  return massBalance(a, base);
}

// ---------------------------------------------------------------- lifespan
//
// Under a constant hazard h the lifetime is exponential and E[T] = 1/h. Split the hazard in two -- what
// kills the animal from the inside and what kills it from the outside -- and the expectation is
// 1/(h_int + h_ext). That is all the arithmetic there is, and it carries the entire life-history point: an
// organism with a high extrinsic hazard gets almost nothing from a longer intrinsic lifespan, because it
// was never going to reach it. Medawar's and Williams's argument for why senescence evolves at all is this
// inequality read in the other direction.
//
// The check is honest about what a constant hazard is NOT: real survival curves are not exponential, real
// hazards rise with age, and a Gompertz or Weibull fit would need data this repository does not have for
// any organism. So it reports the expectation, the fold change the design actually buys, and the fact that
// the shape of the curve was assumed rather than fitted.
function lifespan(a, base) {
  const I0 = readQ('intrinsic_hazard_per_day', a.intrinsic_hazard_per_day, '1/day');
  const Id = readQ('designed_intrinsic_hazard_per_day', a.designed_intrinsic_hazard_per_day, '1/day');
  const E = readQ('extrinsic_hazard_per_day', a.extrinsic_hazard_per_day, '1/day');
  const bad = [I0, Id, E].filter(x => !x.ok);
  if (bad.length) return { ...base, verdict: 'cannot-evaluate', reason: bad.map(x => x.why).join(' | '),
    what_is_missing: bad.map(x => x.why.split(' ')[0]),
    how_to_get_them: 'An intrinsic hazard can be taken as 1/(mean lifespan in protection, in days) for the baseline organism. An extrinsic hazard is the one the ecology layer bears on: ecology_check names the taxa recorded as eating this clade and the ones recorded in the place you asked about, and turning that into a rate is a judgement somebody has to make and state.' };

  // Worst case for the design: highest hazards. Best case: lowest.
  const E_of = (hi, he) => 1 / (hi + he);
  const baseLo = E_of(I0.max, E.max), baseHi = E_of(I0.min, E.min);
  const desLo = E_of(Id.max, E.max), desHi = E_of(Id.min, E.min);
  // The honest headline: what the change to the INTRINSIC term buys, with the extrinsic term held where it is.
  const atWorst = E_of(Id.max, E.max) / E_of(I0.max, E.max);
  const atBest = E_of(Id.min, E.min) / E_of(I0.min, E.min);
  const intrinsicFold = (1 / Id.max) / (1 / I0.max);
  const ceiling = 1 / E.max; // the expectation if intrinsic mortality were abolished entirely
  const headroom = ceiling / baseLo;
  const gain = Math.min(atWorst, atBest);
  const verdict = gain >= 1.5 ? 'longer' : gain > 1.05 ? 'marginally-longer' : gain > 0.95 ? 'no-real-change' : 'shorter';
  return { ...base, ran: true, verdict,
    expected_lifetime_days: { baseline: [baseLo, baseHi], designed: [desLo, desHi] },
    fold_change: { worst_case: atWorst, best_case: atBest },
    intrinsic_fold_change_asked_for: intrinsicFold,
    extrinsic_ceiling_days: ceiling,
    headroom_above_baseline: headroom,
    reading: `The design changes the INTRINSIC hazard by a factor of ${sig(1 / intrinsicFold)} -- a ${sig(intrinsicFold)}x longer intrinsic lifespan. With the extrinsic hazard at ${fmt(E)} /day, expected lifetime goes from ${sig(baseLo)}-${sig(baseHi)} days to ${sig(desLo)}-${sig(desHi)} days: a factor of ${sig(atWorst)} to ${sig(atBest)}. `
      + (headroom < 1.5
        ? `Extrinsic mortality dominates. Abolishing intrinsic mortality ENTIRELY would give ${sig(ceiling)} days, only ${sig(headroom)}x the baseline, so no change to the intrinsic term can buy much here: the animal is not dying of being old.`
        : `There is headroom: with intrinsic mortality abolished entirely the expectation would be ${sig(ceiling)} days, ${sig(headroom)}x the baseline, so the intrinsic term is worth working on in this environment.`),
    inputs: { intrinsic_hazard_per_day: strip(I0), designed_intrinsic_hazard_per_day: strip(Id), extrinsic_hazard_per_day: strip(E) },
    model: 'Constant two-term hazard, E[T] = 1/(h_intrinsic + h_extrinsic). Exact arithmetic over the declared rates.',
    model_caveat: 'A CONSTANT hazard makes the lifetime exponential, and real survival curves are not: hazards rise with age, which is what senescence IS, and a Gompertz or Weibull form would capture that. Fitting one needs survival data this repository holds for no organism. So the shape here is assumed, not fitted, and the expectation is a first-order statement that is most wrong exactly where senescence matters most -- at the old end of the curve.',
    what_this_cannot_say: [
      'HOW the design would live longer: no pathway, no gene, no mechanism is represented anywhere in this repository',
      'whether the intrinsic hazard the design claims is achievable at all',
      'what the change costs: life-history theory expects a longer-lived design to pay in fecundity or growth, and nothing here prices that',
      'whether the extrinsic hazard stays put: an organism that lives longer is exposed longer, and may be exposed differently',
    ] };
}

// ---------------------------------------------------------------- manipulation
//
// To move a particle through a fluid you must overcome the drag on it. At low Reynolds number that force is
// Stokes' law, F = 6*pi*mu*a*v for a sphere of radius a at relative speed v, which is exact for a sphere in
// the creeping limit and the right order of magnitude for anything else. A design whose declared thrust is
// below it does not push the particle slowly: it does not push it.
function manipulation(a, base) {
  const MU = { water: 0.001002, seawater: 0.00108, air: 0.00001789 };
  const medium = a.medium ?? 'water';
  const mu = MU[medium];
  if (!mu) return { ...base, verdict: 'cannot-evaluate', reason: `no viscosity for medium "${medium}"; have ${Object.keys(MU).join(', ')}.` };
  const R = readQ('particle_radius_m', a.particle_radius_m, 'm');
  const V = readQ('transport_speed_m_s', a.transport_speed_m_s, 'm/s');
  const T = readQ('available_thrust_N', a.available_thrust_N, 'N');
  const N = readQ('particles_per_pile', a.particles_per_pile, '1', { required: false });
  const bad = [R, V, T].filter(x => !x.ok);
  if (bad.length) return { ...base, verdict: 'cannot-evaluate', reason: bad.map(x => x.why).join(' | '),
    what_is_missing: bad.map(x => x.why.split(' ')[0]),
    how_to_get_them: 'A thrust for a ciliated or flagellated swimmer is not in this repository and has to be declared or measured. The particle radius and the speed are properties of the task, which is to say of the request.' };

  const drag = (r, v) => 6 * Math.PI * mu * r * v;
  const worst = drag(R.max, V.max), best = drag(R.min, V.min);
  const nMax = N.ok && !N.absent ? N.max : 1;
  const needWorst = worst * nMax, needBest = best * (N.ok && !N.absent ? N.min : 1);
  const canWorst = T.min, canBest = T.max;
  const ratioWorst = canWorst / needWorst, ratioBest = canBest / needBest;
  const verdict = ratioWorst >= 1 ? 'can-move-it' : ratioBest >= 1 ? 'only-in-part-of-the-stated-range' : 'cannot-move-it';
  return { ...base, ran: true, verdict,
    drag_per_particle_N: [best, worst], force_needed_N: [needBest, needWorst], thrust_available_N: [canWorst, canBest],
    margin: { worst: ratioWorst, best: ratioBest },
    reading: verdict === 'can-move-it'
      ? `At every corner of the stated ranges the declared thrust exceeds the drag: ${sig(canWorst)} N against the ${sig(needWorst)} N needed to move ${nMax === 1 ? 'a particle' : `${nMax} particles`} of radius ${fmt(R)} m at ${fmt(V)} m/s through ${medium}. Margin ${sig(ratioWorst)}x to ${sig(ratioBest)}x.`
      : verdict === 'cannot-move-it'
        ? `The declared thrust is below the drag at every corner: ${sig(canBest)} N against ${sig(needBest)} N needed, short by a factor of ${sig(needBest / canBest)}. The design does not move the particle slowly; it does not move it.`
        : `The answer changes inside the stated ranges: ${sig(ratioWorst)}x the force needed at the worst corner and ${sig(ratioBest)}x at the best. Narrow an input and ask again.`,
    inputs: { particle_radius_m: strip(R), transport_speed_m_s: strip(V), available_thrust_N: strip(T), ...(N.ok && !N.absent ? { particles_per_pile: strip(N) } : {}) },
    medium: { key: medium, dynamic_viscosity_Pa_s: mu, source: 'standard reference value at 20 C (fresh water, seawater) or ISA sea level (air); the same values sim-engine/validate/locomotion/media.json carries, with the same caveat that mucus, biofilm and sediment pore water are far more viscous' },
    model: 'Stokes drag, F = 6*pi*mu*a*v. Exact for a sphere in the creeping limit.',
    model_caveat: 'Drag on an isolated sphere in an unbounded fluid. A particle resting on a surface also has friction and adhesion, which are often LARGER than the drag and are not modelled here; particles in a pile shield one another, which this does not model either; and a non-spherical particle has a different coefficient. Treat the force here as a lower bound on what the task needs.',
    what_this_cannot_say: [
      'whether the design can GET to the particle, aim at it, or hold on to it: there is no control model',
      'whether a pile forms: moving particles and accumulating them are different problems, and the second is about where they are released',
      'how long it would take, or whether the organism can pay for it',
    ] };
}

// ---------------------------------------------------------------- mass balance
//
// Conservation of mass. Whatever carbon enters leaves as biomass or as CO2, and cannot do both twice.
// A design that claims to fix more carbon into biomass than it takes in is not ambitious; it is impossible,
// and the check says so in those terms.
function massBalance(a, base) {
  const IN = readQ('carbon_uptake_mol_per_day', a.carbon_uptake_mol_per_day, 'mol C/day');
  const BIO = readQ('carbon_into_biomass_mol_per_day', a.carbon_into_biomass_mol_per_day, 'mol C/day');
  const RESP = readQ('carbon_respired_mol_per_day', a.carbon_respired_mol_per_day, 'mol C/day', { required: false });
  const bad = [IN, BIO].filter(x => !x.ok);
  if (bad.length) return { ...base, verdict: 'cannot-evaluate', reason: bad.map(x => x.why).join(' | '), what_is_missing: bad.map(x => x.why.split(' ')[0]) };

  const resLo = RESP.ok && !RESP.absent ? RESP.min : 0, resHi = RESP.ok && !RESP.absent ? RESP.max : 0;
  const outLo = BIO.min + resLo, outHi = BIO.max + resHi;
  const balancedAtWorst = IN.min >= outHi, balancedAtBest = IN.max >= outLo;
  const verdict = balancedAtWorst ? 'balances' : balancedAtBest ? 'balances-only-in-part-of-the-stated-range' : 'violates-conservation';
  const yieldLo = BIO.min / IN.max, yieldHi = BIO.max / IN.min;
  return { ...base, ran: true, verdict,
    carbon_in_mol_per_day: [IN.min, IN.max], carbon_out_mol_per_day: [outLo, outHi],
    biomass_yield_C_per_C: [yieldLo, yieldHi],
    reading: verdict === 'violates-conservation'
      ? `Carbon leaving exceeds carbon entering at every corner of the stated ranges: ${sig(outLo)}-${sig(outHi)} mol C/day out against ${fmt(IN)} mol C/day in. That is not an optimistic design, it is an impossible one -- the shortfall has to come from somewhere, and there is nowhere.`
      : verdict === 'balances'
        ? `The carbon adds up at every corner: ${fmt(IN)} mol C/day in against ${sig(outLo)}-${sig(outHi)} mol C/day out, a biomass yield of ${sig(yieldLo)}-${sig(yieldHi)} mol C per mol C taken up.${resHi === 0 ? ' NOTE: no respiration was declared, so the balance assumes every atom taken up becomes biomass, which no organism does -- declare carbon_respired_mol_per_day to make this a real check rather than a trivially satisfiable one.' : ''}`
        : `The balance holds in part of the stated ranges and not all of it: in at ${fmt(IN)}, out at ${sig(outLo)}-${sig(outHi)}. A design whose own range contains an impossible corner has not been shown to work.`,
    inputs: { carbon_uptake_mol_per_day: strip(IN), carbon_into_biomass_mol_per_day: strip(BIO), ...(RESP.ok && !RESP.absent ? { carbon_respired_mol_per_day: strip(RESP) } : {}) },
    model: 'Conservation of mass on the carbon: uptake >= biomass + respired.',
    model_caveat: 'A steady-state balance over one day on ONE element. It says nothing about the energy budget, which is where carbon fixation is actually expensive -- the Calvin cycle costs ATP and reducing equivalents, and an organism can be in carbon balance and nowhere near energy balance. It says nothing about nitrogen, phosphorus or any other limiting element, nothing about whether the uptake rate is achievable by any transporter, and nothing about rate: a balance that holds per day may be unreachable per second.',
    what_this_cannot_say: [
      'whether the organism can achieve the declared uptake rate: no transporter kinetics, no surface-area limit, no diffusion model',
      'whether the energy to fix that carbon is available',
      'whether any other element balances',
    ] };
}
