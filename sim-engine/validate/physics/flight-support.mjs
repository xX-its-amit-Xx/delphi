// CAN THE WINGS CARRY THE ANIMAL? -- the one aerodynamic question, for any clade, from declared inputs.
//
// Why this exists beside physics_check. physics_check runs the engine's scenario modules over a resolved
// STATE. STATE is age-scaled body-plan parameters, and the engine holds those for its own teleosts only, so
// for any other animal physics_check refuses before it reaches the aerodynamics -- and the aerodynamics is
// the part that does NOT depend on being a fish. Lift carrying weight is
//
//     L = 1/2 rho v^2 S C_L   >=   m g
//
// and nothing in it is clade-specific except C_L, which is a property of a particular wing and comes from
// lift-coefficients.json with its source. So the inequality can be asked of a mouse as readily as of a
// flying fish, PROVIDED somebody states the mass, the area and the speed and says where each came from.
//
// That proviso is the whole design of this module:
//   * every input must arrive with a source string, or it is refused. Not "defaults to 25 g" -- refused.
//   * the lift coefficient is never defaulted. No sourced coefficient for the clade means no number.
//   * an input stated as a RANGE is swept, and the verdict is reported for the range, because "a mouse
//     weighs 25 g" is a claim about a population and the answer can change inside it.
//   * a margin is not a prediction. The source behind the only mammal coefficient in this repository
//     measured gliding animals that were LOSING HEIGHT, so `caveat` is part of the result, not a footnote.
//
// What this does NOT do: powered flight. A wingbeat is a question about power, not about area, and this
// inequality cannot answer it. Asked for powered flight, it says so and stops.
import { liftCoefficientFor } from './standing.mjs';

export const VERSION = '0.1.0';
export const SCOPE = 'One inequality -- does lift at the stated speed carry the stated weight -- evaluated from inputs the caller declares, with a maximum lift coefficient taken by clade from a named measurement. It is a STEADY-STATE AREA CHECK. It says nothing about powered flight, nothing about control or stability, nothing about whether the animal can produce the speed, and nothing about whether what carries the weight for one second carries it for a minute.';

const G = 9.80665;
const RHO_SEA_LEVEL = 1.225; // ISA, 15 C, dry air at sea level

/** An input is {value, source} or {min, max, source}. Anything else is refused by name. */
function readInput(name, v, unit) {
  if (v == null) return { ok: false, why: `${name} was not given. It cannot be defaulted: a wing area or a mass picked by this tool would be this tool's opinion reported as the animal's property.` };
  if (typeof v === 'number') return { ok: false, why: `${name} was given as a bare number (${v} ${unit}) with no source. Every quantity here must arrive as {value, source} or {min, max, source}; a number with no provenance cannot be told apart from a guess once it is inside a result.` };
  const src = typeof v.source === 'string' && v.source.trim() ? v.source.trim() : null;
  if (!src) return { ok: false, why: `${name} has no \`source\`. State where the number comes from -- a measurement with its citation, or "design input: ..." if it is what the designer is asking for rather than something measured.` };
  // The repository's provenance vocabulary (lib/envelope.mjs) is closed: measured, measured-secondhand,
  // borrowed, derived, calibrated, assumed. A number the designer states is `assumed` in that vocabulary --
  // it is what the design asks for, not something anyone measured -- and the source string says so.
  const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];
  const given = typeof v.kind === 'string' ? v.kind.trim() : '';
  if (given && !KINDS.includes(given)) return { ok: false, why: `${name} has kind "${given}", which is not one of the repository's provenance kinds (${KINDS.join(', ')}). A quantity the designer is asking for is "assumed".` };
  const kind = given || 'assumed';
  if (typeof v.value === 'number' && Number.isFinite(v.value)) {
    if (v.value <= 0) return { ok: false, why: `${name} must be positive (got ${v.value} ${unit}).` };
    return { ok: true, min: v.value, max: v.value, point: true, unit, kind, source: src };
  }
  if (typeof v.min === 'number' && typeof v.max === 'number' && Number.isFinite(v.min) && Number.isFinite(v.max)) {
    if (!(v.min > 0) || !(v.max >= v.min)) return { ok: false, why: `${name} range must satisfy 0 < min <= max (got ${v.min}..${v.max} ${unit}).` };
    return { ok: true, min: v.min, max: v.max, point: v.min === v.max, unit, kind, source: src };
  }
  return { ok: false, why: `${name} must carry a numeric \`value\`, or a numeric \`min\` and \`max\`.` };
}

const corner = (m, S, v, CL, rho) => {
  const W = m * G, L = 0.5 * rho * v * v * S * CL;
  return { mass_kg: m, lifting_area_m2: S, airspeed_m_s: v, weight_N: W, lift_N: L,
    lift_over_weight: L / W, carries: L >= W,
    wing_loading_N_m2: W / S, wing_loading_limit_N_m2: 0.5 * rho * v * v * CL,
    area_required_m2: W / (0.5 * rho * v * v * CL),
    min_airspeed_m_s: Math.sqrt((2 * W) / (rho * S * CL)) };
};

/**
 * @param {object} a
 *   taxon               the animal this is about; decides the lift coefficient
 *   mass_kg             {value|min,max, source}
 *   lifting_area_m2     {value|min,max, source}
 *   airspeed_m_s        {value|min,max, source}   the speed at which it is asked to be flying
 *   air_density_kg_m3   optional {value, source}; ISA sea level if omitted, and said to be
 *   powered             true if the question is about powered flight -- which this cannot answer
 */
export function flightSupportCheck(a = {}) {
  const base = { tool: 'flight_support_check', version: VERSION, taxon: a.taxon ?? null, ran: false };

  if (a.powered === true || /powered|flap/i.test(String(a.question ?? ''))) {
    return { ...base, verdict: 'cannot-evaluate',
      reason: 'the question asked is about POWERED flight, and this check cannot answer it. It compares lift with weight at a given airspeed, which is an area question; powered flight is a power question -- whether the flight muscle can supply the induced and profile power through a wingbeat, continuously, at that animal\'s mass. That needs a coefficient measured through a wingbeat and a muscle power density for the clade, and this repository has neither.',
      what_is_missing: ['a lift coefficient measured through a wingbeat cycle, not in a steady glide',
        'a mass-specific mechanical power output for the flight muscle of this clade',
        'a wingbeat frequency and amplitude, or a measurement to fix them'],
      what_this_can_answer: 'whether lift carries weight at a stated airspeed, which is a necessary condition for flight of any kind, and so a lower bound on the question asked.' };
  }

  const cl = liftCoefficientFor(a.taxon);
  const inputs = {
    mass_kg: readInput('mass_kg', a.mass_kg, 'kg'),
    lifting_area_m2: readInput('lifting_area_m2', a.lifting_area_m2, 'm2'),
    airspeed_m_s: readInput('airspeed_m_s', a.airspeed_m_s, 'm/s'),
  };
  const bad = Object.entries(inputs).filter(([, v]) => !v.ok);
  if (!cl.ok || bad.length) {
    return { ...base, verdict: 'cannot-evaluate',
      reason: [!cl.ok ? `no lift coefficient: ${cl.reason}` : null, ...bad.map(([k, v]) => `${k}: ${v.why}`)].filter(Boolean).join(' | '),
      lift_coefficient: cl.ok ? { C_Lmax: cl.C_Lmax, kind: cl.kind, note: cl.note } : { available: null, reason: cl.reason },
      inputs_accepted: Object.fromEntries(Object.entries(inputs).filter(([, v]) => v.ok).map(([k, v]) => [k, { min: v.min, max: v.max, source: v.source }])),
      what_is_missing: [...(!cl.ok ? ['a maximum lift coefficient covering this clade, in sim-engine/validate/physics/lift-coefficients.json'] : []), ...bad.map(([k]) => `${k}, with a source`)] };
  }

  const rhoIn = a.air_density_kg_m3;
  const rho = typeof rhoIn?.value === 'number' ? rhoIn.value : RHO_SEA_LEVEL;
  const rhoSrc = typeof rhoIn?.value === 'number' ? String(rhoIn.source ?? 'supplied without a source') : 'ISA sea level, 15 C dry air (1.225 kg/m3); not supplied by the caller';

  // Every corner of the stated ranges. The worst corner decides, because a design that flies only at the
  // light end of its own mass range does not fly.
  const I = inputs, corners = [];
  for (const m of [I.mass_kg.min, I.mass_kg.max]) for (const S of [I.lifting_area_m2.min, I.lifting_area_m2.max]) for (const v of [I.airspeed_m_s.min, I.airspeed_m_s.max]) corners.push(corner(m, S, v, cl.C_Lmax, rho));
  const uniq = [...new Map(corners.map(c => [`${c.mass_kg}|${c.lifting_area_m2}|${c.airspeed_m_s}`, c])).values()];
  const ratios = uniq.map(c => c.lift_over_weight);
  const worst = uniq[ratios.indexOf(Math.min(...ratios))], best = uniq[ratios.indexOf(Math.max(...ratios))];
  const all = uniq.every(c => c.carries), none = uniq.every(c => !c.carries);
  const verdict = all ? 'carries' : none ? 'does-not-carry' : 'carries-only-in-part-of-the-stated-range';

  return { ...base, ran: true, verdict,
    reading: all
      ? `At every corner of the stated ranges, lift at ${fmtRange(I.airspeed_m_s)} m/s on ${fmtRange(I.lifting_area_m2)} m2 reaches ${worst.lift_over_weight.toFixed(2)}x to ${best.lift_over_weight.toFixed(2)}x the weight of ${fmtRange(I.mass_kg)} kg. The inequality is satisfied.`
      : none
        ? `At no corner of the stated ranges does lift reach the weight: the best case is ${best.lift_over_weight.toFixed(3)}x, which is short by a factor of ${(1 / best.lift_over_weight).toFixed(2)}. To carry ${fmtRange(I.mass_kg)} kg at ${fmtRange(I.airspeed_m_s)} m/s the area needed is ${(best.area_required_m2 * 1e4).toFixed(1)} cm2 against the ${(I.lifting_area_m2.max * 1e4).toFixed(1)} cm2 stated; equivalently the speed needed at the stated area is ${best.min_airspeed_m_s.toFixed(2)} m/s.`
        : `The answer changes inside the stated ranges: ${worst.lift_over_weight.toFixed(2)}x the weight at the worst corner (${worst.mass_kg} kg, ${worst.lifting_area_m2} m2, ${worst.airspeed_m_s} m/s) and ${best.lift_over_weight.toFixed(2)}x at the best. A design whose own range contains both answers has not been shown to fly; narrow an input and ask again.`,
    lift_over_weight: { worst: worst.lift_over_weight, best: best.lift_over_weight },
    worst_corner: worst, best_corner: best, corners: uniq,
    minimum_airspeed_m_s: { at_max_mass_min_area: Math.max(...uniq.map(c => c.min_airspeed_m_s)), at_min_mass_max_area: Math.min(...uniq.map(c => c.min_airspeed_m_s)) },
    lift_coefficient: { C_Lmax: cl.C_Lmax, sd: cl.sd, kind: cl.kind, clade: cl.clade, note: cl.note, caveat: cl.caveat, source: cl.entry.source, doi: cl.entry.doi ?? null, area_convention: cl.area_convention },
    air_density_kg_m3: { value: rho, source: rhoSrc },
    inputs: Object.fromEntries(Object.entries(I).map(([k, v]) => [k, { min: v.min, max: v.max, unit: v.unit, kind: v.kind, source: v.source }])),
    weakest_input: weakest(I, cl),
    caveats: [
      cl.caveat,
      `The coefficient is referred to ${cl.area_convention}. The area supplied here must be measured the same way or the result is wrong by the ratio of the two conventions, and this check cannot tell which convention the supplied area used.`,
      'Steady state at one instant. Lift reaching weight at a speed says nothing about reaching that speed, holding it, or staying the right way up: there is no control model, no stability margin and no power budget here.',
      a.powered === undefined ? 'Read as a GLIDE condition unless the caller says otherwise. For powered flight this is a necessary condition only, and a weak one.' : null,
    ].filter(Boolean) };
}

const fmtRange = i => (i.point ? String(i.min) : `${i.min}-${i.max}`);

/** The input that most limits what this result can be read as. */
function weakest(I, cl) {
  const rank = { assumed: 0, borrowed: 1, calibrated: 2, derived: 3, 'measured-secondhand': 4, measured: 5 };
  const rows = [...Object.entries(I).map(([k, v]) => ({ what: k, kind: v.kind, source: v.source })),
    { what: 'C_Lmax', kind: cl.kind, source: cl.entry.source }];
  rows.sort((a, b) => (rank[a.kind] ?? 0) - (rank[b.kind] ?? 0));
  return { what: rows[0].what, kind: rows[0].kind, source: rows[0].source,
    note: 'The result is no stronger than this input. A verdict resting on a supplied or borrowed quantity is a statement about that quantity as much as about the animal.' };
}
