// THE LOCOMOTION LAYER: not what the organism looks like, but how it moves.
//
// The blueprint layer answers "what parts does it have, and does the ontology allow them in this clade".
// That is a statement about one instant. An organism that is asked to swim, walk or fly is being asked for
// something the shape alone cannot settle: a cycle, repeated, that moves the body through a fluid. Two
// designs with identical part lists can differ in whether they go anywhere.
//
// WHAT CAN AND CANNOT BE SAID HERE, kept strictly apart, because they are different kinds of claim:
//
//   theorem      A result that holds for every organism obeying the stated conditions, with no fitted
//                parameter. The scallop theorem is the one this layer has: at Re -> 0 a swimmer whose
//                stroke is time-reversible returns to where it started, whatever it is made of. A design
//                that violates it is IMPOSSIBLE, and that verdict does not depend on any measurement of
//                any animal.
//   arithmetic   An inequality over quantities the caller declared. Distance per cycle times cycles per
//                second is a speed; if the declared speed is not that speed, the design contradicts
//                itself. No biology is involved and none is claimed.
//   regime       An empirical indicator -- Reynolds number, Froude number -- that says which physics
//                dominates and what comparable animals do. It is REPORTED AND NEVER FAILS A DESIGN.
//                Equal Froude number is a necessary condition for dynamic similarity and not a sufficient
//                one, and the literature is explicit that cursorial and non-cursorial mammals do not move
//                similarly at equal Fr. A threshold borrowed from one group and applied as a pass/fail to
//                another is the kind of thing this repository keeps finding and removing.
//
// Flight is not re-implemented here. It is a mode of locomotion and it delegates to flight-support.mjs, so
// there is ONE lift-coefficient policy in the repository rather than two that can drift.
//
// Every quantity arrives as {value, source} or {min, max, source}. A bare number is refused by name.
import fs from 'node:fs';
import path from 'node:path';
import { flightSupportCheck } from '../physics/flight-support.mjs';

export const VERSION = '0.1.0';
export const SCOPE = 'How a design moves, as distinct from what it is made of. One theorem (the scallop theorem, which can declare a design impossible), arithmetic over declared quantities, and empirical regime indicators that are reported and never fail anything. It models no muscle, no metabolism, no control and no energy budget: a design this layer does not contradict has not been shown to move, only shown not to be self-contradictory in the ways this layer can see.';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MEDIA = JSON.parse(fs.readFileSync(path.join(HERE, 'media.json'), 'utf8'));
const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];

export const MODES = {
  swim: { medium: 'water', what: 'propulsion through a liquid' },
  fly: { medium: 'air', what: 'powered flight through air' },
  glide: { medium: 'air', what: 'unpowered descent through air with lift' },
  walk: { medium: 'air', what: 'legged terrestrial locomotion with a duty factor above 0.5' },
  run: { medium: 'air', what: 'legged terrestrial locomotion with an aerial phase' },
  crawl: { medium: 'air', what: 'terrestrial locomotion with the body in contact with the substrate' },
  ciliary: { medium: 'water', what: 'propulsion by the coordinated beating of cilia' },
};

/** {value, source} | {min, max, source} -> a swept range, or a named refusal. */
function readQ(name, v, unit, { required = true } = {}) {
  if (v == null) return required
    ? { ok: false, why: `${name} was not given, and cannot be defaulted: a speed or a body length chosen by this tool would be this tool's opinion reported as the organism's property.` }
    : { ok: true, absent: true };
  if (typeof v === 'number') return { ok: false, why: `${name} was given as a bare number (${v} ${unit}) with no source. Every quantity here must arrive as {value, source} or {min, max, source}.` };
  const src = typeof v.source === 'string' && v.source.trim() ? v.source.trim() : null;
  if (!src) return { ok: false, why: `${name} has no \`source\`. Say where the number comes from, or that it is what the design is asking for.` };
  const given = typeof v.kind === 'string' ? v.kind.trim() : '';
  if (given && !KINDS.includes(given)) return { ok: false, why: `${name} has kind "${given}", which is not one of ${KINDS.join(', ')}.` };
  const kind = given || 'assumed';
  const nums = typeof v.value === 'number' ? [v.value, v.value] : [v.min, v.max];
  if (!nums.every(x => typeof x === 'number' && Number.isFinite(x))) return { ok: false, why: `${name} needs a numeric \`value\`, or numeric \`min\` and \`max\`.` };
  if (!(nums[0] > 0) || nums[1] < nums[0]) return { ok: false, why: `${name} must satisfy 0 < min <= max (got ${nums[0]}..${nums[1]} ${unit}).` };
  return { ok: true, min: nums[0], max: nums[1], point: nums[0] === nums[1], unit, kind, source: src };
}

const CHECK = (id, label, o) => ({ id, label, kind: 'regime', verdict: 'reported', measured: null, unit: null, limiting_factor: null, ...o });
const fmt = q => (q.point ? String(q.min) : `${q.min}-${q.max}`);

/**
 * @param {object} a
 *   taxon            what this is about (used for the flight modes and carried into the result)
 *   mode             one of MODES
 *   medium           'water' | 'seawater' | 'air'; defaults to the mode's own medium, and says so
 *   body_length_m    {value|min,max, source}   the length along the direction of travel
 *   speed_m_s        {value|min,max, source}   the speed the design is asked to reach
 *   gait             { reciprocal: bool, degrees_of_freedom: n, cycle_hz: Q, distance_per_cycle_m: Q,
 *                      description: string, source: string }
 *   mass_kg, lifting_area_m2   for the flight modes, passed through to flight_support_check
 */
export function locomotionCheck(a = {}) {
  const base = { tool: 'locomotion_check', version: VERSION, taxon: a.taxon ?? null, mode: a.mode ?? null, ran: false, checks: [] };

  if (!a.mode || !MODES[a.mode]) {
    return { ...base, verdict: 'cannot-evaluate',
      reason: `mode must be one of ${Object.keys(MODES).join(', ')}${a.mode ? ` (got "${a.mode}")` : ''}. The layer is about HOW the organism moves, so there is nothing to check until that is stated.`,
      modes: MODES };
  }
  const mode = MODES[a.mode];
  const mediumKey = a.medium || mode.medium;
  const medium = MEDIA.media[mediumKey];
  if (!medium) return { ...base, verdict: 'cannot-evaluate', reason: `no properties for medium "${mediumKey}"; sim-engine/validate/locomotion/media.json has ${Object.keys(MEDIA.media).join(', ')}.` };

  const L = readQ('body_length_m', a.body_length_m, 'm');
  const V = readQ('speed_m_s', a.speed_m_s, 'm/s');
  const bad = [L, V].filter(x => !x.ok);
  if (bad.length) return { ...base, verdict: 'cannot-evaluate', reason: bad.map(x => x.why).join(' | '),
    what_is_missing: bad.map(x => x.why.split(' ')[0]) };

  const checks = [];
  const rho = medium.density_kg_m3, mu = medium.dynamic_viscosity_Pa_s;
  const re = (v, l) => (rho * v * l) / mu;
  const reLo = re(V.min, L.min), reHi = re(V.max, L.max);

  // ---------------------------------------------------------------- 1. Reynolds regime (REPORTED)
  const regimeOf = x => (x < MEDIA.regimes.creeping_below ? 'creeping (viscous forces dominate)'
    : x > MEDIA.regimes.inertial_above ? 'inertial (inertia dominates)' : 'intermediate (neither limit applies)');
  checks.push(CHECK('reynolds_regime', 'Which physics the motion happens in', {
    measured: reLo === reHi ? reLo : [reLo, reHi], unit: '1 (dimensionless)',
    detail: { regime_low: regimeOf(reLo), regime_high: regimeOf(reHi),
      formula: 'Re = rho v L / mu', medium: medium.label, density_kg_m3: rho, dynamic_viscosity_Pa_s: mu,
      medium_source: medium.source, medium_caveat: medium.caveat, boundaries: MEDIA.regimes.note },
    reading: reLo === reHi
      ? `Re = ${sig(reLo)} in ${medium.label}: ${regimeOf(reLo)}.`
      : `Re runs from ${sig(reLo)} to ${sig(reHi)} across the stated ranges: ${regimeOf(reLo)} at one end, ${regimeOf(reHi)} at the other.` }));

  // ---------------------------------------------------------------- 2. the scallop theorem (CAN FAIL)
  //
  // Purcell's result. In the Stokes limit the equations of motion have no time derivative, so the path
  // through configuration space determines the displacement and the RATE does not. A stroke that retraces
  // its own path -- a single hinge opening and closing, however fast or slow, however asymmetric in speed --
  // returns the body exactly where it began. This is why bacteria rotate helical flagella and why cilia beat
  // with a recovery stroke along a different path: both break the time-reversal symmetry. A design asking
  // for a reciprocal stroke at low Re is not inefficient. It does not move.
  const gait = a.gait ?? null;
  if (gait && (gait.reciprocal != null || gait.degrees_of_freedom != null)) {
    const gsrc = typeof gait.source === 'string' && gait.source.trim() ? gait.source.trim() : null;
    if (!gsrc) checks.push(CHECK('reciprocal_stroke_at_low_reynolds', 'Purcell scallop theorem', {
      kind: 'theorem', verdict: 'cannot-evaluate',
      limiting_factor: 'the gait has no `source`. Whether a stroke is time-reversible is a claim about the design and needs to be stated by someone, not inferred here.' }));
    else {
      const dof = gait.degrees_of_freedom ?? null;
      const reciprocal = gait.reciprocal === true || (dof != null && dof <= 1);
      const deepEnough = reHi < MEDIA.regimes.creeping_below;
      const nearLimit = reHi < 100;
      if (reciprocal && deepEnough) {
        checks.push(CHECK('reciprocal_stroke_at_low_reynolds', 'Purcell scallop theorem', {
          kind: 'theorem', verdict: 'impossible',
          limiting_factor: `the stroke is time-reversible (${gait.reciprocal === true ? 'declared reciprocal' : `${dof} degree(s) of freedom, which cannot trace a loop in configuration space`}) and Re <= ${sig(reHi)} everywhere in the stated ranges. In the Stokes limit the displacement over a cycle depends on the PATH through configuration space and not on the rate, so a path that retraces itself returns the body exactly where it started. Net displacement per cycle is zero, at any beat frequency.`,
          detail: { reynolds_max: reHi, degrees_of_freedom: dof, declared_reciprocal: gait.reciprocal ?? null,
            gait: gait.description ?? null, gait_source: gsrc,
            source: 'Purcell EM 1977, Life at low Reynolds number, Am J Phys 45(1):3-11', doi: '10.1119/1.10903',
            what_would_fix_it: 'break the time-reversal symmetry: a rotating helix, a travelling wave along a flagellum, or a cilium whose recovery stroke follows a different path from its power stroke. Two or more degrees of freedom moved out of phase trace a loop, and a loop encloses area, and enclosed area is displacement.' } }));
      } else if (reciprocal && nearLimit) {
        checks.push(CHECK('reciprocal_stroke_at_low_reynolds', 'Purcell scallop theorem', {
          kind: 'theorem', verdict: 'at-risk',
          limiting_factor: `the stroke is time-reversible and Re reaches ${sig(reHi)}, which is above the creeping threshold but not far above it. The theorem is a statement about the limit Re -> 0; at Re of order 1 to 100 inertia is present and a reciprocal stroke can produce some net motion, but the design is relying on exactly the inertia the theorem says it cannot count on in the limit.`,
          detail: { reynolds_max: reHi, degrees_of_freedom: dof, source: 'Purcell EM 1977, Am J Phys 45(1):3-11', doi: '10.1119/1.10903' } }));
      } else {
        checks.push(CHECK('reciprocal_stroke_at_low_reynolds', 'Purcell scallop theorem', {
          kind: 'theorem', verdict: 'holds',
          reading: reciprocal
            ? `the stroke is time-reversible, but Re reaches ${sig(reHi)}: this is an inertial swimmer and the theorem does not bind it. A scallop is a scallop because it is big enough to be one.`
            : `the stroke is declared non-reciprocal (${dof ?? 'unstated'} degrees of freedom), so the theorem does not forbid it at any Reynolds number.`,
          detail: { reynolds_max: reHi, degrees_of_freedom: dof, declared_reciprocal: gait.reciprocal ?? null, source: 'Purcell EM 1977, Am J Phys 45(1):3-11', doi: '10.1119/1.10903' } }));
      }
    }
  }

  // ---------------------------------------------------------------- 3. does the cycle produce the speed? (CAN FAIL)
  //
  // Pure arithmetic: distance per cycle x cycles per second is a speed. If the declared speed is not that
  // speed, the design contradicts itself, and that is true of a bacterium and an elephant alike.
  if (gait?.cycle_hz || gait?.distance_per_cycle_m) {
    const F = readQ('gait.cycle_hz', gait.cycle_hz, 'Hz');
    const D = readQ('gait.distance_per_cycle_m', gait.distance_per_cycle_m, 'm');
    if (!F.ok || !D.ok) checks.push(CHECK('cycle_produces_the_speed', 'Stride or beat produces the stated speed', {
      kind: 'arithmetic', verdict: 'cannot-evaluate', limiting_factor: [F, D].filter(x => !x.ok).map(x => x.why).join(' | ') }));
    else {
      const vLo = F.min * D.min, vHi = F.max * D.max;
      const overlaps = vHi >= V.min && vLo <= V.max;
      checks.push(CHECK('cycle_produces_the_speed', 'Stride or beat produces the stated speed', {
        kind: 'arithmetic', verdict: overlaps ? 'consistent' : 'contradicts',
        measured: vLo === vHi ? vLo : [vLo, vHi], unit: 'm/s',
        limiting_factor: overlaps ? null
          : vHi < V.min
            ? `the cycle cannot reach the speed: ${fmt(F)} Hz x ${fmt(D)} m is at most ${sig(vHi)} m/s, and the design asks for ${fmt(V)} m/s. It is short by a factor of ${sig(V.min / vHi)}.`
            : `the cycle overshoots the stated speed: ${fmt(F)} Hz x ${fmt(D)} m is at least ${sig(vLo)} m/s against the ${fmt(V)} m/s asked for. One of the three numbers is wrong.`,
        detail: { speed_from_cycle_m_s: [vLo, vHi], speed_declared_m_s: [V.min, V.max],
          cycle_hz: [F.min, F.max], cycle_hz_source: F.source, distance_per_cycle_m: [D.min, D.max], distance_per_cycle_source: D.source,
          note: 'Distance per cycle is NET displacement per cycle, not the path length the appendage travels. A stroke that sweeps far and returns the body nowhere has a large path and a distance per cycle of zero -- which is the scallop theorem restated as arithmetic.' } }));
    }
  }

  // ---------------------------------------------------------------- 4. Froude regime, terrestrial (REPORTED)
  if (['walk', 'run'].includes(a.mode)) {
    const g = MEDIA.gravity_m_s2.value;
    const frLo = (V.min * V.min) / (g * L.max), frHi = (V.max * V.max) / (g * L.min);
    checks.push(CHECK('froude_regime', 'Where this sits among legged animals', {
      measured: frLo === frHi ? frLo : [frLo, frHi], unit: '1 (dimensionless)',
      detail: { formula: 'Fr = v^2 / (g L), with L the characteristic length the caller supplied',
        gravity_m_s2: g, gravity_source: MEDIA.gravity_m_s2.source,
        source: 'Alexander RM, Jayes AS 1983, A dynamic similarity hypothesis for the gaits of quadrupedal mammals, J Zool (Lond) 201:135-152',
        why_this_is_not_a_verdict: 'Equal Froude number is a NECESSARY condition for two animals to move in a dynamically similar way, and later work is explicit that it is not sufficient -- cursorial and non-cursorial mammals do not move similarly at equal Fr. The widely quoted walk-to-run transition at Fr = 0.5 is a human result. Turning any of that into a pass or a fail for an arbitrary clade would be borrowing a threshold across exactly the gap this repository keeps finding and removing, so this check reports the number and stops.' },
      reading: `Fr = ${frLo === frHi ? sig(frLo) : `${sig(frLo)} to ${sig(frHi)}`}. This places the design among legged animals of its size and says nothing about whether it can do it.` }));
  }

  // ---------------------------------------------------------------- 5. flight delegates (CAN FAIL)
  let flight = null;
  if (['fly', 'glide'].includes(a.mode)) {
    flight = flightSupportCheck({ taxon: a.taxon, mass_kg: a.mass_kg, lifting_area_m2: a.lifting_area_m2,
      airspeed_m_s: a.speed_m_s, powered: a.mode === 'fly' ? true : a.powered, question: a.question });
    checks.push(CHECK('lift_carries_the_weight', 'Does the air hold it up?', {
      kind: flight.ran ? 'arithmetic' : 'regime',
      verdict: flight.verdict === 'carries' ? 'consistent' : flight.verdict === 'does-not-carry' ? 'contradicts' : flight.verdict,
      limiting_factor: flight.ran ? null : flight.reason,
      reading: flight.reading ?? null,
      detail: { delegated_to: 'flight_support_check (sim-engine/validate/physics/flight-support.mjs)', result: flight } }));
  }

  // ---------------------------------------------------------------- verdict
  const theorem = checks.find(c => c.verdict === 'impossible');
  const contradicts = checks.find(c => c.verdict === 'contradicts');
  const verdict = theorem ? 'impossible' : contradicts ? 'contradicts-itself'
    : checks.some(c => c.verdict === 'at-risk') ? 'at-risk'
      : checks.some(c => c.verdict === 'cannot-evaluate') ? 'partly-evaluated' : 'not-contradicted';

  return { ...base, ran: true, verdict, medium: { key: mediumKey, ...medium },
    inputs: { body_length_m: strip(L), speed_m_s: strip(V), ...(gait ? { gait: { ...gait } } : {}) },
    reynolds: { min: reLo, max: reHi }, checks, flight,
    reading: theorem
      ? `IMPOSSIBLE, by a theorem and not by a simulation: ${theorem.limiting_factor}`
      : contradicts
        ? `the design contradicts itself: ${contradicts.limiting_factor}`
        : verdict === 'at-risk'
          ? `not forbidden, but resting on something the theorem says it cannot rely on in the limit: ${checks.find(c => c.verdict === 'at-risk').limiting_factor}`
          : verdict === 'partly-evaluated'
            ? `PARTLY EVALUATED: ${checks.filter(c => c.verdict === 'cannot-evaluate').length} of the ${checks.length} checks could not be run at all -- ${checks.filter(c => c.verdict === 'cannot-evaluate').map(c => `${c.id} (${c.limiting_factor})`).join('; ')}. The checks that did run found no contradiction, and a check that did not run is not a check that passed.`
            : `nothing this layer can check contradicts the design. That is NOT a finding that it moves: there is no muscle here, no metabolism, no control and no energy budget, and ${checks.filter(c => c.kind === 'regime').length} of the ${checks.length} checks are regime indicators that never fail anything.`,
    what_this_layer_cannot_say: [
      'whether the organism can generate the forces its gait requires: there is no muscle model and no actuator model',
      'whether it can pay for the motion: no metabolic rate, no cost of transport, no energy budget',
      'whether it can control the motion or stay the right way up: no stability model',
      'whether the gait is one a nervous system could produce or a developmental program could build',
    ] };
}

const strip = q => ({ min: q.min, max: q.max, unit: q.unit, kind: q.kind, source: q.source });
function sig(x) {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return '0';
  const a = Math.abs(x);
  return a >= 1000 || a < 0.01 ? x.toExponential(2) : String(Math.round(x * 1000) / 1000);
}
