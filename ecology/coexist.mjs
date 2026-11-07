// COULD IT COEXIST INSTEAD? The second resource, and the argument it is usually used to make.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// `rstar.mjs` lists, as the FIRST thing the single-resource criterion ignores, "more than one limiting
// resource - two species coexist stably on two resources and the single-resource conclusion lapses
// entirely". This module is that caveat, built out. It is the honest completion of the previous module,
// and it is also the module most likely to be misused, so the second point is made first:
//
//   TWO-RESOURCE COEXISTENCE IS THE FIRST THING A DEFENDER OF A LOSING DESIGN REACHES FOR.
//
// A design that is excluded on one resource may genuinely persist on a trade-off between two. That is
// real ecology, it is Tilman's result, and it is not a loophole. But it is also exactly the shape of
// argument that gets made AFTER a design has already failed an R* comparison - "ah, but there are two
// limiting resources" - and the argument is nearly always made without the extra measurements it
// requires. So this module is deliberately built to be harder to pass than `rstar.mjs`, not easier:
// going from one resource to two does not relax the evidential burden, it roughly doubles it. It asks
// for mu_max and Ks on BOTH resources, it asks whether the resources are essential or substitutable,
// and it asks for a CONSUMPTION VECTOR, which is a separate experiment that almost nobody has run. A
// design that cannot supply those does not get a coexistence verdict here; it gets an itemised bill.
//
// ============================== THE TWO-RESOURCE THEORY ==============================
// Tilman (1980, 1982). Work in the plane of the two resource concentrations (R1, R2).
//
// 1. THE ZERO NET GROWTH ISOCLINE (ZNGI). The set of (R1, R2) at which a species' growth exactly
//    balances its loss rate D. Its shape depends on what the resources ARE to that organism:
//
//    * ESSENTIAL resources (nitrogen and phosphorus; carbon and an electron acceptor). Each is needed
//      and neither can replace the other, so growth follows Liebig's law of the minimum:
//          mu = min( mu1(R1), mu2(R2) )
//      The ZNGI is L-SHAPED, with its corner at (R1*, R2*) - the two single-resource R* values from
//      `rstar.mjs`, one per resource. The vertical arm is R1 = R1*, the horizontal arm is R2 = R2*.
//
//    * SUBSTITUTABLE resources (two sugars; nitrate and ammonium). Either will do, so a shortfall in
//      one is made up by the other and the ZNGI is a LINE (perfectly substitutable) or a curve
//      (complementary, bowing toward the origin; antagonistic, bowing away). The perfectly
//      substitutable case is derivable:
//          mu = mu_max * (R1/Ks1 + R2/Ks2) / (1 + R1/Ks1 + R2/Ks2)
//      and setting mu = D gives the straight ZNGI  R1/R1* + R2/R2* = 1,  with the same R1*, R2*
//      intercepts as the essential case. Curvature is handled here phenomenologically, as
//          (R1/R1*)^p + (R2/R2*)^p = 1,     p = 1 linear, p < 1 complementary, p > 1 antagonistic
//      which is an interpolation, not a derivation, and is labelled as such.
//
//    THIS MODULE WILL NOT GUESS WHICH KIND THEY ARE. An essential/substitutable mix-up does not shade
//    the answer, it inverts it. The same measured R1* and R2* put a supply point BELOW an L-shaped
//    isocline - nothing grows, because the scarce resource is mandatory - and comfortably ABOVE the
//    straight isocline through the same two intercepts, because the abundant resource substitutes for
//    the scarce one. Same four numbers, "nothing persists" against "both do". The kind is a property of
//    the organism's biochemistry and it has to be stated.
//
// 2. THE CONSUMPTION VECTOR. How fast a species draws each resource down, as a ratio (c1 : c2). This is
//    a SEPARATE MEASUREMENT from the isoclines and it is the one that decides coexistence. Two species
//    can have perfectly crossed isoclines - each the better competitor for a different resource, which
//    is the textbook picture of coexistence - and still exclude one another, because each is consuming
//    the wrong resource. The isoclines say coexistence is possible. The consumption vectors say whether
//    it happens.
//
// 3. THE SUPPLY POINT. Where the environment would sit with no consumers, (S1, S2). Resources are
//    drawn from the supply point back along the consumption vectors.
//
// 4. THE RESULT. With essential resources and crossed isoclines there is one two-species equilibrium E,
//    at the isocline crossing, and at E each species is limited by the resource for which it is the
//    POORER competitor. Stable coexistence requires each species to consume relatively more of the
//    resource that more limits its own growth, and requires the supply point to lie in the wedge
//    between the two consumption vectors drawn out from E. Get the consumption ratios the other way
//    round and the same crossed isoclines give FOUNDER CONTROL instead: bistable, whoever arrives first
//    wins, and the loser cannot invade. Founder control is not coexistence, and reporting it as
//    coexistence would be the most consequential error this module could make.
//
// ============================== HOW THE VERDICT IS COMPUTED ==============================
// Rather than classifying supply points by wedge geometry - which is easy to get subtly wrong, and
// which silently misreports the bistable case - this module uses MUTUAL INVASIBILITY directly, which
// is what the geometry is a picture of:
//   * solve each species' single-species equilibrium, by walking from the supply point back along that
//     species' own consumption vector until it meets its own ZNGI;
//   * ask whether the other species' growth at that equilibrium exceeds its loss rate.
// Both can invade -> stable coexistence. Neither can -> founder control. Exactly one can -> that one
// wins. Neither can even establish alone -> nothing persists. Invasion growth rates of exactly zero
// both ways -> the two species are not distinguishable by this model, which is not coexistence either.
//
// ============================== WHAT IS STILL NOT MODELLED ==============================
// See WHAT_TWO_RESOURCES_STILL_IGNORE at the bottom. It is the previous module's list minus the one
// item this module addresses, plus the new assumptions two-resource theory brings with it. Fixing one
// caveat does not shorten the list by one; it trades a short list for a longer one.

import { rStar, mu as monod, WHAT_R_STAR_IGNORES, CITATIONS as R_STAR_CITATIONS } from './rstar.mjs';

export const CITATIONS = Object.freeze({
  tilman_1980: 'Tilman, D. (1980) Resources: a graphical-mechanistic approach to competition and predation. The American Naturalist 116:362-393',
  tilman_1982: 'Tilman, D. (1982) Resource Competition and Community Structure. Princeton University Press (chapters 2-4: the two-resource graphical theory, ZNGIs, consumption vectors, supply points)',
  leon_tumpson_1975: 'Leon, J.A. & Tumpson, D.B. (1975) Competition between two species for two complementary or substitutable resources. Journal of Theoretical Biology 50:185-201',
  liebig: "Liebig's law of the minimum, via Droop (1973) and Tilman (1982): for essential resources, growth is set by the single most limiting one",
  monod: 'Monod, J. (1949) The growth of bacterial cultures. Annual Review of Microbiology 3:371-394',
  note: 'all of the theory here is from the 1970s and 1980s and is not a result of this project. ' +
        'What is ours is only the refusal to run it on parameters nobody measured, and the insistence that ' +
        'the consumption vector is a measurement and not an assumption.',
});

export const WHAT_THIS_IS =
  'Tilman two-resource competition theory, applied to a designed organism against named incumbents. It ' +
  'builds each species\' zero net growth isocline, takes the consumption vectors as a separate and ' +
  'required measurement, and classifies the outcome at a stated supply point as exclusion, stable ' +
  'coexistence, founder control, or nothing persisting. It refuses when the resources are not measured ' +
  'on both axes, when nobody has said whether they are essential or substitutable, and when the ' +
  'consumption ratio is unsourced.';

export const RESOURCE_KINDS = Object.freeze(['essential', 'substitutable']);

export const OUTCOMES = Object.freeze([
  'a-wins',
  'b-wins',
  'stable-coexistence',
  'founder-control',
  'neither-persists',
  'neutral-indistinguishable',
]);

/** Classifications that must never be read as coexistence, however much a design would like them to be. */
export const NOT_COEXISTENCE = Object.freeze(['a-wins', 'b-wins', 'founder-control', 'neither-persists', 'neutral-indistinguishable']);

const TOL = 1e-9;

// ---------------------------------------------------------------------------------------------------
// Parameter plumbing.

function label(sp) { return sp?.label ?? '(unlabelled)'; }

function kindOf(sp) {
  const k = sp?.kind ?? null;
  if (!RESOURCE_KINDS.includes(k)) {
    return {
      ok: false,
      why: `the resource kind for ${label(sp)} is ${k === null ? 'not stated' : `"${k}", which is not one of ${RESOURCE_KINDS.join(' | ')}`}. ` +
        'Set `kind: "essential"` (Liebig minimum, L-shaped isocline) or `kind: "substitutable"` (one resource can stand in for the other, linear or curved isocline).',
      what_this_means:
        'this is not a formatting complaint. Essential and substitutable resources give isoclines of ' +
        'different SHAPE: L-shaped isoclines cross whenever each species is the better competitor for a ' +
        'different resource, and linear ones with the same intercepts do not cross at all. The same four ' +
        'measured numbers therefore predict stable coexistence under one reading and flat exclusion under ' +
        'the other. Guessing here would invert the verdict, not blur it.',
    };
  }
  return { ok: true, kind: k };
}

/** The two single-resource R* values that anchor an isocline. Reuses rstar.mjs rather than restating it. */
function stars(sp, D) {
  const missing = [];
  for (const axis of ['R1', 'R2']) {
    for (const k of ['mu_max', 'Ks']) if (!(sp?.[axis]?.[k] > 0)) missing.push(`${axis}.${k}`);
  }
  if (missing.length) {
    return {
      ok: false,
      missing,
      why: `${label(sp)} is missing measured growth parameters on both resource axes: ${missing.join(', ')}. ` +
        'Two-resource theory needs mu_max and Ks for EACH resource; one axis measured and one assumed is not a two-resource assessment.',
    };
  }
  const k = kindOf(sp);
  if (!k.ok) return { ok: false, missing: ['kind'], why: k.why, kind_problem: k };

  if (k.kind === 'substitutable') {
    const m1 = sp.R1.mu_max, m2 = sp.R2.mu_max;
    if (Math.abs(m1 - m2) > TOL * Math.max(m1, m2)) {
      return {
        ok: false,
        missing: [],
        why: `${label(sp)} is declared substitutable but has two different mu_max values (${m1} on R1, ${m2} on R2). ` +
          'If either resource can substitute for the other, growth approaches ONE maximum rate as either becomes ' +
          'abundant. Two different asymptotes describe partial substitution, which this module does not model. ' +
          'Either measure a single mu_max, or declare the resources essential and keep both.',
      };
    }
  }

  const s1 = rStar({ mu_max: sp.R1.mu_max, Ks: sp.R1.Ks, D, label: `${label(sp)}/R1` });
  const s2 = rStar({ mu_max: sp.R2.mu_max, Ks: sp.R2.Ks, D, label: `${label(sp)}/R2` });
  if (!s1.ok || !s2.ok) {
    const washes = (s1.washes_out ? ['R1'] : []).concat(s2.washes_out ? ['R2'] : []);
    return {
      ok: false,
      washes_out: washes.length > 0,
      missing: [],
      why: washes.length
        ? `${label(sp)} cannot hold its own on ${washes.join(' or ')} at ANY concentration: mu_max there does not exceed the loss rate D = ${D}. ` +
          (kindOf(sp).kind === 'essential'
            ? 'For essential resources that is fatal on its own - the organism washes out whatever the other resource does.'
            : 'For substitutable resources it means that resource alone cannot support it; the pair still might.')
        : (s1.ok ? s2.why : s1.why),
      detail: { R1: s1, R2: s2 },
    };
  }
  return { ok: true, kind: k.kind, R1_star: s1.r_star, R2_star: s2.r_star, mu_max: sp.R1.mu_max, detail: { R1: s1, R2: s2 } };
}

function exponentOf(sp) {
  const p = sp?.substitution_exponent ?? 1;
  return p > 0 ? p : 1;
}

// ---------------------------------------------------------------------------------------------------
// 1. ISOCLINES.

/**
 * The zero net growth isocline for each species, in (R1, R2) space.
 *
 * Accepts one species or an array of them. Refuses - per species - when the two resource axes are not
 * both measured, and refuses when the caller has not said whether the resources are essential or
 * substitutable. The caller says which; this function will not infer it.
 */
export function zeroNetGrowthIsoclines(species, D) {
  const list = Array.isArray(species) ? species : [species];
  if (!(D > 0)) {
    return {
      ok: false,
      refused: true,
      why: 'the loss rate D must be positive. An isocline is the set of resource concentrations at which growth balances LOSS; with no loss term there is nothing to balance and every point in the plane qualifies.',
      citations: CITATIONS,
    };
  }

  const isoclines = list.map(sp => {
    const s = stars(sp, D);
    if (!s.ok) return { label: label(sp), ok: false, refused: true, why: s.why, missing: s.missing ?? [], washes_out: Boolean(s.washes_out) };

    const { R1_star, R2_star } = s;
    if (s.kind === 'essential') {
      return {
        label: label(sp),
        ok: true,
        kind: 'essential',
        shape: 'L-shaped (Liebig minimum)',
        growth_law: 'mu = min( mu1(R1), mu2(R2) )',
        corner: [+R1_star.toPrecision(6), +R2_star.toPrecision(6)],
        arms: {
          vertical: { R1: +R1_star.toPrecision(6), valid_for: `R2 >= ${R2_star.toPrecision(4)}`, meaning: 'here R1 is the limiting resource' },
          horizontal: { R2: +R2_star.toPrecision(6), valid_for: `R1 >= ${R1_star.toPrecision(4)}`, meaning: 'here R2 is the limiting resource' },
        },
        corner_meaning: 'at the corner both resources limit growth equally; that is the only point on the isocline where neither is in excess.',
        formula: 'R1* = Ks1 * D / (mu_max1 - D),  R2* = Ks2 * D / (mu_max2 - D); the isocline is the boundary of the quadrant above and right of (R1*, R2*)',
        persists_where: `R1 > ${R1_star.toPrecision(4)} AND R2 > ${R2_star.toPrecision(4)} - both, because the resources are essential`,
        source: sp.source ?? null,
      };
    }

    const p = exponentOf(sp);
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * R1_star;
      const rem = 1 - Math.pow(x / R1_star, p);
      pts.push([+x.toPrecision(6), +(R2_star * Math.pow(Math.max(rem, 0), 1 / p)).toPrecision(6)]);
    }
    return {
      label: label(sp),
      ok: true,
      kind: 'substitutable',
      shape: p === 1 ? 'linear (perfectly substitutable)' : p < 1 ? 'curved, bowing toward the origin (complementary)' : 'curved, bowing away from the origin (antagonistic)',
      growth_law: p === 1
        ? 'mu = mu_max * (R1/Ks1 + R2/Ks2) / (1 + R1/Ks1 + R2/Ks2) - derived, and its isocline is exactly the straight line below'
        : `phenomenological interpolation with exponent p = ${p}; only p = 1 is derived from a growth law here, and curvature should be fitted, not chosen`,
      intercepts: { R1_axis: +R1_star.toPrecision(6), R2_axis: +R2_star.toPrecision(6) },
      equation: p === 1 ? 'R1/R1* + R2/R2* = 1' : `(R1/R1*)^${p} + (R2/R2*)^${p} = 1`,
      substitution_exponent: p,
      points: pts,
      persists_where: p === 1
        ? `R1/${R1_star.toPrecision(4)} + R2/${R2_star.toPrecision(4)} > 1 - either resource alone can get it there`
        : 'above the curve; either resource alone can get it there',
      no_corner:
        'a substitutable isocline has no corner, so no point on it has both resources limiting equally, and ' +
        'nothing is ever absolutely required: either resource alone can carry the organism past the isocline. ' +
        'That is the structural difference from the essential case and it is why the kind cannot be guessed - ' +
        'the SAME measured R1* and R2* can leave a supply point below an L-shaped isocline (nothing grows, ' +
        'because the scarce resource is mandatory) and well above the straight one through the same two ' +
        'intercepts (growth is fine, because the abundant resource substitutes).',
      source: sp.source ?? null,
    };
  });

  const bad = isoclines.filter(i => !i.ok);
  return {
    ok: bad.length === 0,
    refused: bad.length > 0,
    loss_rate_D: D,
    caller_stated_kinds: list.map(sp => ({ label: label(sp), kind: sp?.kind ?? null })),
    isoclines,
    why: bad.length ? `${bad.length} of ${isoclines.length} species could not be given an isocline: ${bad.map(b => b.why).join(' | ')}` : undefined,
    kind_is_the_caller_s_to_state:
      'essential vs substitutable is a fact about the organism\'s biochemistry, not something recoverable ' +
      'from mu_max and Ks. The caller states it; this module will not infer it. It is required input.',
    citations: CITATIONS,
  };
}

// ---------------------------------------------------------------------------------------------------
// 2. CONSUMPTION VECTORS. The separate measurement, and the one that decides the answer.

/**
 * The ratio in which a species consumes the two resources.
 *
 * This is NOT derivable from the isoclines. mu_max and Ks say how fast a species grows at a given
 * resource concentration; they say nothing about how much of each resource that growth removes from the
 * medium. A species can have exactly the right isoclines for coexistence and still drive the other
 * extinct because it consumes in the wrong proportion. So this is a second experiment, and the module
 * treats a missing consumption vector as a missing measurement rather than something to fill in.
 */
export function consumptionVector(sp) {
  const raw = sp?.consumption ?? null;
  const c1 = Array.isArray(raw) ? raw[0] : raw?.R1;
  const c2 = Array.isArray(raw) ? raw[1] : raw?.R2;

  if (!(c1 >= 0) || !(c2 >= 0) || !(c1 + c2 > 0)) {
    return {
      ok: false,
      refused: true,
      label: label(sp),
      why: `the consumption vector for ${label(sp)} is not measured (expected \`consumption: [c1, c2]\`, both >= 0 and not both zero; got ${JSON.stringify(raw)}).`,
      what_is_needed:
        'the rate at which this strain removes each resource from the medium per unit of growth - resource ' +
        'quotas, or drawdown slopes from a batch culture sampled on both resources. A ratio is enough; the ' +
        'magnitude cancels out of the outcome.',
      why_it_cannot_be_inferred:
        'mu_max and Ks describe the growth RESPONSE to resource concentration. The consumption vector ' +
        'describes the EFFECT of growth on resource concentration. They are different measurements on ' +
        'different sides of the same interaction, and nothing in Monod\'s equation contains the second. ' +
        'This is the number that decides coexistence, and it is the number designs are least likely to have.',
      citations: CITATIONS,
    };
  }

  const n = Math.hypot(c1, c2);
  const ratio = c2 > 0 ? c1 / c2 : Infinity;
  return {
    ok: true,
    label: label(sp),
    c1, c2,
    ratio_R1_per_R2: Number.isFinite(ratio) ? +ratio.toPrecision(6) : Infinity,
    unit_vector: [+(c1 / n).toPrecision(6), +(c2 / n).toPrecision(6)],
    weighted_toward: Math.abs(c1 - c2) <= TOL * Math.max(c1, c2) ? 'neither - consumed in equal proportion' : (c1 > c2 ? 'R1' : 'R2'),
    source: sp?.consumption_source ?? null,
    sourced: Boolean(sp?.consumption_source),
    reading: `for every ${c1} units of R1 removed from the medium this species removes ${c2} units of R2. ` +
      'Resources are drawn from the supply point back along this direction.',
    caveat:
      'the consumption vector is very often ASSUMED proportional to the growth response rather than measured. ' +
      'That assumption is what the geometry of coexistence rests on, and it is rarely tested.',
  };
}

// ---------------------------------------------------------------------------------------------------
// Growth at a point, and single-species equilibria.

/** Specific growth rate at (R1, R2), given the stated resource kind. */
export function growthAt(sp, R1, R2, D) {
  const s = stars(sp, D);
  if (!s.ok) return { ok: false, why: s.why };
  if (!(R1 >= 0) || !(R2 >= 0)) return { ok: false, why: 'resource concentrations must be >= 0' };

  if (s.kind === 'essential') {
    const m1 = monod(R1, sp.R1), m2 = monod(R2, sp.R2);
    if (typeof m1 !== 'number' || typeof m2 !== 'number') return { ok: false, why: 'Monod evaluation failed' };
    const m = Math.min(m1, m2);
    return {
      ok: true, mu: m, net: m - D, above_isocline: m > D + TOL * D,
      limiting_resource: Math.abs(m1 - m2) <= TOL * Math.max(m1, m2) ? 'both equally' : (m1 < m2 ? 'R1' : 'R2'),
      per_resource: { R1: m1, R2: m2 },
    };
  }

  const p = exponentOf(sp);
  const g = Math.pow(Math.pow(R1 / s.R1_star, p) + Math.pow(R2 / s.R2_star, p), 1 / p);
  const G = (g * D) / (s.mu_max - D);
  const m = (s.mu_max * G) / (1 + G);
  return {
    ok: true, mu: m, net: m - D, above_isocline: g > 1 + TOL,
    isocline_value: +g.toPrecision(8),
    limiting_resource: 'neither alone - the resources substitute, so only the weighted sum limits growth',
  };
}

/**
 * Where the resources settle with this species alone at the stated supply point.
 *
 * At a single-species equilibrium, supply of each resource is exactly matched by consumption, so the
 * resource point sits at S - t*C for some t > 0, on the species' own ZNGI. Walk out from the supply
 * point along the species' own consumption direction until the isocline is met.
 */
export function equilibriumAlone(sp, D, supply) {
  const S = Array.isArray(supply) ? supply : [supply?.R1, supply?.R2];
  if (!(S[0] >= 0) || !(S[1] >= 0)) return { ok: false, why: 'the supply point must be two concentrations >= 0' };

  const s = stars(sp, D);
  if (!s.ok) return { ok: false, why: s.why, cannot_establish: true };
  const c = consumptionVector(sp);
  if (!c.ok) return { ok: false, why: c.why, refused: true };

  const g0 = growthAt(sp, S[0], S[1], D);
  if (!g0.ok) return { ok: false, why: g0.why };
  if (!g0.above_isocline) {
    return {
      ok: false,
      cannot_establish: true,
      label: label(sp),
      why: `${label(sp)} cannot grow even at the undepleted supply point (${S[0]}, ${S[1]}): its growth there is ${g0.mu.toPrecision(4)} against a loss rate of ${D}. The supply point is on or below its isocline.`,
      mu_at_supply: +g0.mu.toPrecision(6),
    };
  }

  // The largest step before a resource it consumes would go negative.
  let tMax = Infinity;
  if (c.c1 > 0) tMax = Math.min(tMax, S[0] / c.c1);
  if (c.c2 > 0) tMax = Math.min(tMax, S[1] / c.c2);

  let t, boundary = false;
  if (s.kind === 'essential') {
    const t1 = c.c1 > 0 ? (S[0] - s.R1_star) / c.c1 : Infinity;
    const t2 = c.c2 > 0 ? (S[1] - s.R2_star) / c.c2 : Infinity;
    t = Math.min(t1, t2);
    if (!Number.isFinite(t)) {
      return {
        ok: false, label: label(sp), why:
          `${label(sp)} consumes none of the resource that limits it, so it never draws itself down to its own isocline and this model has no equilibrium for it. Check the consumption vector.`,
      };
    }
  } else {
    const net = u => growthAt(sp, Math.max(S[0] - u * c.c1, 0), Math.max(S[1] - u * c.c2, 0), D).net;
    if (net(tMax) > 0) { t = tMax; boundary = true; }
    else {
      let lo = 0, hi = tMax;
      for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (net(mid) > 0) lo = mid; else hi = mid; }
      t = (lo + hi) / 2;
    }
  }

  const R = [Math.max(S[0] - t * c.c1, 0), Math.max(S[1] - t * c.c2, 0)];
  const at = growthAt(sp, R[0], R[1], D);
  return {
    ok: true,
    label: label(sp),
    resources: [+R[0].toPrecision(8), +R[1].toPrecision(8)],
    drawn_down_from: [S[0], S[1]],
    along: c.unit_vector,
    limiting_resource: at.limiting_resource,
    mu_here: +at.mu.toPrecision(8),
    on_its_own_isocline: Math.abs(at.mu - D) <= 1e-6 * D,
    boundary,
    note: boundary
      ? 'the trajectory ran a resource to zero before reaching the isocline, so this is a boundary equilibrium rather than an interior one, and the classification below is weaker than usual.'
      : undefined,
  };
}

// ---------------------------------------------------------------------------------------------------
// 3. THE OUTCOME.

/**
 * Classify the two-species outcome at a stated supply point.
 *
 * Returns one of OUTCOMES. The decision is made by mutual invasibility - can each species grow at the
 * resource concentrations the other leaves behind - because that is the definition the wedge geometry
 * is a picture of, and because it does not quietly collapse founder control into coexistence.
 *
 * D is taken from opts.D, else supply.D, else either species.
 */
export function coexistenceRegion(a, b, supply, opts = {}) {
  const S = Array.isArray(supply) ? supply : [supply?.R1, supply?.R2];
  const D = opts.D ?? (Array.isArray(supply) ? undefined : supply?.D) ?? a?.D ?? b?.D;

  if (!(D > 0)) {
    return { refused: true, why: 'the loss rate D must be positive and was not supplied (pass it as opts.D, supply.D, or on either species).', citations: CITATIONS };
  }
  if (!(S[0] >= 0) || !(S[1] >= 0)) {
    return {
      refused: true,
      why: `the supply point must be two resource concentrations >= 0; got ${JSON.stringify(supply)}.`,
      what_a_supply_point_is:
        'the concentrations the environment would hold with no consumers in it. It is a model of the ' +
        'environment, not a measurement of one, and the verdict depends on it.',
      citations: CITATIONS,
    };
  }

  const sa = stars(a, D), sb = stars(b, D);
  const ca = consumptionVector(a), cb = consumptionVector(b);
  const blockers = [];
  if (!sa.ok) blockers.push(sa.why);
  if (!sb.ok) blockers.push(sb.why);
  if (!ca.ok) blockers.push(ca.why);
  if (!cb.ok) blockers.push(cb.why);

  // A species that washes out on an essential resource is a resolved fact, not a missing measurement.
  const aWashes = Boolean(sa.washes_out) && kindOf(a).kind === 'essential';
  const bWashes = Boolean(sb.washes_out) && kindOf(b).kind === 'essential';
  if (aWashes || bWashes) {
    const outcome = aWashes && bWashes ? 'neither-persists' : (aWashes ? 'b-wins' : 'a-wins');
    return {
      resolved: true,
      outcome,
      supply_point: [S[0], S[1]],
      loss_rate_D: D,
      why: `${aWashes && bWashes ? 'both species' : (aWashes ? label(a) : label(b))} cannot exceed the loss rate on an essential resource at any concentration, so no supply point helps.`,
      is_coexistence: false,
      what_this_does_not_model: WHAT_TWO_RESOURCES_STILL_IGNORE,
      citations: CITATIONS,
    };
  }
  if (blockers.length) {
    return {
      refused: true,
      why: `cannot classify the outcome: ${blockers.join(' | ')}`,
      what_we_refuse_to_do:
        'produce a coexistence verdict from a guessed consumption vector or an assumed resource kind. ' +
        'Both are single numbers or single words that flip the answer, and a verdict built on them would ' +
        'be indistinguishable from one built on measurements.',
      citations: CITATIONS,
    };
  }

  // Structural degeneracy: identical isoclines never cross, so there is no coexistence equilibrium at
  // all, whatever the consumption vectors do. This is the case naive implementations report as
  // coexistence, because two identical species of course "both invade" to a growth rate of exactly D.
  const sameIsocline =
    sa.kind === sb.kind &&
    Math.abs(sa.R1_star - sb.R1_star) <= TOL * Math.max(sa.R1_star, sb.R1_star, TOL) &&
    Math.abs(sa.R2_star - sb.R2_star) <= TOL * Math.max(sa.R2_star, sb.R2_star, TOL);

  const eqA = equilibriumAlone(a, D, S);
  const eqB = equilibriumAlone(b, D, S);

  if (!eqA.ok && !eqB.ok) {
    return {
      resolved: true,
      outcome: 'neither-persists',
      supply_point: [S[0], S[1]],
      loss_rate_D: D,
      isocline_corners: { [label(a)]: [+sa.R1_star.toPrecision(6), +sa.R2_star.toPrecision(6)], [label(b)]: [+sb.R1_star.toPrecision(6), +sb.R2_star.toPrecision(6)] },
      why: `neither species can grow at the supply point (${S[0]}, ${S[1]}): it lies on or below both isoclines. ${eqA.why} ${eqB.why}`,
      is_coexistence: false,
      what_this_does_not_model: WHAT_TWO_RESOURCES_STILL_IGNORE,
      citations: CITATIONS,
    };
  }
  if (!eqA.ok || !eqB.ok) {
    const winner = eqA.ok ? 'a' : 'b';
    const loser = eqA.ok ? b : a;
    return {
      resolved: true,
      outcome: `${winner}-wins`,
      supply_point: [S[0], S[1]],
      loss_rate_D: D,
      why: `${label(loser)} cannot establish even on its own at this supply point, so there is nothing for it to coexist with: ${(eqA.ok ? eqB : eqA).why}`,
      equilibrium: eqA.ok ? eqA.resources : eqB.resources,
      is_coexistence: false,
      what_this_does_not_model: WHAT_TWO_RESOURCES_STILL_IGNORE,
      citations: CITATIONS,
    };
  }

  const bIntoA = growthAt(b, eqA.resources[0], eqA.resources[1], D);
  const aIntoB = growthAt(a, eqB.resources[0], eqB.resources[1], D);
  const tol = 1e-7 * D;
  const bCanInvade = bIntoA.net > tol;
  const aCanInvade = aIntoB.net > tol;
  const neutral = sameIsocline || (Math.abs(bIntoA.net) <= tol && Math.abs(aIntoB.net) <= tol);

  // Which resource limits each species at the isocline crossing, and therefore which resource it must
  // consume relatively more of. Only meaningful for crossed essential isoclines.
  const crossed = sa.kind === 'essential' && sb.kind === 'essential' && !sameIsocline &&
    ((sa.R1_star < sb.R1_star && sa.R2_star > sb.R2_star) || (sa.R1_star > sb.R1_star && sa.R2_star < sb.R2_star));
  let crossing = null;
  if (crossed) {
    const E = [Math.max(sa.R1_star, sb.R1_star), Math.max(sa.R2_star, sb.R2_star)];
    const aLimited = sa.R1_star > sb.R1_star ? 'R1' : 'R2';
    const bLimited = aLimited === 'R1' ? 'R2' : 'R1';
    crossing = {
      two_species_equilibrium: [+E[0].toPrecision(6), +E[1].toPrecision(6)],
      limits_a: aLimited,
      limits_b: bLimited,
      reading: `at the crossing each species is limited by the resource it is the POORER competitor for: ${label(a)} by ${aLimited}, ${label(b)} by ${bLimited}.`,
      stability_rule: `stable coexistence needs ${label(a)} to consume relatively more ${aLimited} and ${label(b)} relatively more ${bLimited}; the reverse gives founder control.`,
      a_consumption_ratio_R1_per_R2: ca.ratio_R1_per_R2,
      b_consumption_ratio_R1_per_R2: cb.ratio_R1_per_R2,
      consumption_condition_met: aLimited === 'R2' ? ca.ratio_R1_per_R2 < cb.ratio_R1_per_R2 : ca.ratio_R1_per_R2 > cb.ratio_R1_per_R2,
    };
  }

  let outcome, why;
  if (neutral) {
    outcome = 'neutral-indistinguishable';
    why = sameIsocline
      ? `${label(a)} and ${label(b)} have the SAME isocline (R1* = ${sa.R1_star.toPrecision(4)}, R2* = ${sa.R2_star.toPrecision(4)} for both), so the isoclines never cross and there is no two-species equilibrium. ` +
        'Each invades the other at a growth rate of exactly zero. This is neutral drift, not coexistence: the model does not distinguish the two species, so it cannot predict that both stay.'
      : 'both invasion growth rates are indistinguishable from zero, so this model cannot tell the two species apart at this supply point. That is a failure to discriminate, not a prediction of coexistence.';
  } else if (bCanInvade && aCanInvade) {
    outcome = 'stable-coexistence';
    why = `each species can invade the other's equilibrium: ${label(b)} grows at ${bIntoA.mu.toPrecision(4)} against D = ${D} in the resources ${label(a)} leaves (${eqA.resources.join(', ')}), and ${label(a)} grows at ${aIntoB.mu.toPrecision(4)} in those ${label(b)} leaves (${eqB.resources.join(', ')}). Mutual invasibility at this supply point means the two-species equilibrium is stable and either species recovers from rarity.`;
  } else if (!bCanInvade && !aCanInvade) {
    outcome = 'founder-control';
    why = `NEITHER species can invade the other's equilibrium (${label(b)} would grow at ${bIntoA.mu.toPrecision(4)}, ${label(a)} at ${aIntoB.mu.toPrecision(4)}, both below D = ${D}). The system is bistable: whichever establishes first excludes the other, and the outcome is set by arrival order and initial density rather than by the parameters. This is NOT coexistence - a design that depends on arriving first has no claim to persistence.`;
  } else if (aCanInvade) {
    outcome = 'a-wins';
    why = `${label(a)} invades ${label(b)}'s equilibrium (growing at ${aIntoB.mu.toPrecision(4)} against D = ${D}) but ${label(b)} cannot invade ${label(a)}'s (only ${bIntoA.mu.toPrecision(4)}). ${label(b)} is excluded.`;
  } else {
    outcome = 'b-wins';
    why = `${label(b)} invades ${label(a)}'s equilibrium (growing at ${bIntoA.mu.toPrecision(4)} against D = ${D}) but ${label(a)} cannot invade ${label(b)}'s (only ${aIntoB.mu.toPrecision(4)}). ${label(a)} is excluded.`;
  }

  return {
    resolved: true,
    outcome,
    is_coexistence: outcome === 'stable-coexistence',
    why,
    supply_point: [S[0], S[1]],
    loss_rate_D: D,
    resource_kinds: { [label(a)]: sa.kind, [label(b)]: sb.kind },
    isocline_corners: {
      [label(a)]: { R1_star: +sa.R1_star.toPrecision(6), R2_star: +sa.R2_star.toPrecision(6) },
      [label(b)]: { R1_star: +sb.R1_star.toPrecision(6), R2_star: +sb.R2_star.toPrecision(6) },
    },
    consumption_vectors: {
      [label(a)]: { c: [ca.c1, ca.c2], ratio_R1_per_R2: ca.ratio_R1_per_R2, sourced: ca.sourced, source: ca.source },
      [label(b)]: { c: [cb.c1, cb.c2], ratio_R1_per_R2: cb.ratio_R1_per_R2, sourced: cb.sourced, source: cb.source },
    },
    single_species_equilibria: {
      [label(a)]: { resources: eqA.resources, limited_by: eqA.limiting_resource, boundary: eqA.boundary },
      [label(b)]: { resources: eqB.resources, limited_by: eqB.limiting_resource, boundary: eqB.boundary },
    },
    invasion: {
      [`${label(b)} into ${label(a)}`]: { mu: +bIntoA.mu.toPrecision(6), net: +bIntoA.net.toPrecision(6), can_invade: bCanInvade },
      [`${label(a)} into ${label(b)}`]: { mu: +aIntoB.mu.toPrecision(6), net: +aIntoB.net.toPrecision(6), can_invade: aCanInvade },
    },
    isoclines_cross: crossed,
    crossing,
    founder_control_is_not_coexistence:
      'founder-control and stable-coexistence are both "both species can persist" in casual summary and ' +
      'are opposite predictions. Under founder control a rare invader declines; the design persists only ' +
      'if it got there first and in numbers. Never report it as coexistence.',
    supply_point_is_a_model:
      'the supply point above is a model of the environment, not a measurement of one. Move it and the ' +
      'verdict can change from coexistence to exclusion without any parameter of either organism changing, ' +
      'so it should be stated as a range and the verdict re-checked across it.',
    what_this_does_not_model: WHAT_TWO_RESOURCES_STILL_IGNORE,
    citations: CITATIONS,
  };
}

// ---------------------------------------------------------------------------------------------------
// 4. THE ENTRY POINT. Same discipline as rstar.mjs assessDesign, with more to refuse on.

/**
 * The honest entry point. Mirrors rstar.mjs's assessDesign, and is strictly harder to satisfy:
 * two resources need mu_max and Ks on BOTH axes, a stated resource kind, and a SOURCED consumption
 * vector. Returns the bar the design would have to clear and the experiments that would settle it.
 */
export function assessDesign(design, incumbents = [], supply = null, opts = {}) {
  const D = opts.D ?? (Array.isArray(supply) ? undefined : supply?.D) ?? design?.D ?? null;
  const S = Array.isArray(supply) ? supply : (supply ? [supply.R1, supply.R2] : [undefined, undefined]);
  const list = Array.isArray(incumbents) ? incumbents : [incumbents];

  const missing = [];
  for (const axis of ['R1', 'R2']) {
    for (const k of ['mu_max', 'Ks']) if (!(design?.[axis]?.[k] > 0)) missing.push(`${axis}.${k}`);
  }
  const kindCheck = kindOf(design);
  const kindMissing = !kindCheck.ok;
  const cons = consumptionVector(design);
  const consMissing = !cons.ok;
  const consUnsourced = cons.ok && !cons.sourced;
  const supplyMissing = !(S[0] >= 0) || !(S[1] >= 0);
  const dMissing = !(D > 0);

  if (missing.length || kindMissing || consMissing || consUnsourced || supplyMissing || dMissing) {
    const reasons = [];
    if (missing.length) reasons.push(`growth parameters are not measured on both resource axes (${missing.join(', ')})`);
    if (kindMissing) reasons.push('the resource kind (essential or substitutable) is not stated');
    if (consMissing) reasons.push('the consumption vector is not measured');
    if (consUnsourced) reasons.push('the consumption vector has no stated source, so it is a number rather than a measurement');
    if (dMissing) reasons.push('the loss rate D of the system it enters is not given');
    if (supplyMissing) reasons.push('no resource supply point is stated for the environment');

    const bar = [];
    if (D > 0) {
      for (const inc of list) {
        const si = stars(inc, D);
        const ci = consumptionVector(inc);
        if (!si.ok) { bar.push({ incumbent: label(inc), computable: false, why: si.why }); continue; }
        bar.push({
          incumbent: label(inc),
          computable: true,
          kind: si.kind,
          its_R1_star: +si.R1_star.toPrecision(6),
          its_R2_star: +si.R2_star.toPrecision(6),
          its_consumption_ratio_R1_per_R2: ci.ok ? ci.ratio_R1_per_R2 : null,
          source: inc.source ?? null,
          test_1_isoclines_must_cross:
            `the design must be strictly the BETTER competitor for exactly one resource: R1* below ${si.R1_star.toPrecision(4)} with R2* above ${si.R2_star.toPrecision(4)}, or R2* below ${si.R2_star.toPrecision(4)} with R1* above ${si.R1_star.toPrecision(4)}. ` +
            `Better on both is not coexistence, it is the design winning outright; worse on both is exclusion with no coexistence available at any supply point.`,
          test_2_consumption_must_be_crossed_the_right_way:
            'the design must consume relatively MORE of the resource that limits it at the crossing - that is, more of the resource it is the worse competitor for. ' +
            (ci.ok
              ? `The incumbent's measured ratio is c1/c2 = ${ci.ratio_R1_per_R2}; the design's must fall on the correct side of it, which side depending on which resource each is the poorer competitor for.`
              : 'The incumbent\'s consumption vector is not measured either, so this test cannot even be stated numerically yet.'),
          test_3_the_supply_point_must_cooperate:
            'the stated supply point must lie between the two consumption vectors drawn out from the crossing. Outside that wedge, crossed isoclines and correct consumption ratios still give exclusion.',
          and_if_it_fails_test_2:
            'crossed isoclines with reversed consumption give FOUNDER CONTROL, which looks like coexistence in a summary and is the opposite prediction: the design persists only if it arrives first and abundant.',
        });
      }
    }

    return {
      refused: true,
      why: `cannot assess two-resource coexistence: ${reasons.join('; ')}.`,
      the_argument_this_refusal_blocks:
        'that a design excluded on one resource will persist on a trade-off between two. That argument is ' +
        'sometimes right. It is also the standard move for rescuing a design after it has already lost an ' +
        'R* comparison, and it is almost always made without the extra measurements it needs. Two ' +
        'resources is not a weaker test than one; it is the same test twice plus a consumption experiment.',
      what_is_needed: {
        'R1.mu_max, R1.Ks': 'Monod parameters for resource 1, measured for THIS strain on THIS resource. Not the parent, not a relative.',
        'R2.mu_max, R2.Ks': 'the same for resource 2. One axis measured and the other assumed is a single-resource assessment wearing a two-resource label.',
        kind: 'whether the two resources are ESSENTIAL (each needed, Liebig minimum, L-shaped isocline) or SUBSTITUTABLE (either will do, linear or curved isocline). A fact about the organism\'s biochemistry. Getting it wrong inverts the prediction rather than blurring it.',
        consumption: 'the ratio in which this strain draws the two resources down, [c1, c2], with a stated source. This is a SEPARATE experiment from the growth curves and it is the measurement that decides coexistence.',
        D: 'the loss or dilution rate of the environment entered. Set by the environment, not the organism.',
        supply: 'the resource supply point (S1, S2) the environment would hold with no consumers. Honestly, a model of the environment rather than a measurement of one - so it should be stated as a range and the verdict checked across it.',
      },
      how_to_get_them:
        'two chemostat series, one limited by each resource, at several dilution rates - that gives mu_max ' +
        'and Ks on both axes. Essential vs substitutable comes from the pathway, or from a single growth ' +
        'experiment with one resource withheld. The consumption vector comes from measuring BOTH resource ' +
        'concentrations through a growth curve and taking the ratio of the drawdown slopes, or from cell ' +
        'quotas. Weeks of work, and still the cheapest thing that can refute a coexistence claim.',
      the_extra_measurements_two_resources_demand: Object.freeze([
        'mu_max and Ks on the second resource, not just the first',
        'whether the resources are essential or substitutable',
        'the consumption vector of the design',
        'the consumption vector of each incumbent it is claimed to coexist with',
        'a supply point, stated explicitly, and the verdict re-checked as it moves',
      ]),
      the_bar_it_would_have_to_clear: bar.length ? bar : { note: 'no incumbent with measured parameters was supplied either, so not even the bar can be stated.' },
      what_we_refuse_to_do:
        'assume a consumption vector proportional to the growth response and report the coexistence that ' +
        'follows. That assumption is conventional, untested in most systems, and sufficient on its own to ' +
        'turn founder control into "stable coexistence" in the output. It would be the most confident ' +
        'wrong verdict in the whole system, and unlike a wrong R* it would be a wrong verdict in the ' +
        'design\'s favour.',
      what_this_does_not_model: WHAT_TWO_RESOURCES_STILL_IGNORE,
      citations: CITATIONS,
    };
  }

  const d = { ...design, is_design: true };
  const per = list.map(inc => ({
    incumbent: label(inc),
    verdict: coexistenceRegion(d, inc, S, { D }),
  }));
  const resolved = per.filter(p => p.verdict.resolved);
  const coexisting = resolved.filter(p => p.verdict.outcome === 'stable-coexistence');
  const excluded = resolved.filter(p => p.verdict.outcome === 'b-wins');
  const founder = resolved.filter(p => p.verdict.outcome === 'founder-control');

  return {
    refused: false,
    design: label(design),
    supply_point: [S[0], S[1]],
    loss_rate_D: D,
    per_incumbent: per,
    summary: {
      persists_against_all: resolved.length > 0 && resolved.every(p => ['stable-coexistence', 'a-wins'].includes(p.verdict.outcome)),
      stable_coexistence_with: coexisting.map(p => p.incumbent),
      excluded_by: excluded.map(p => p.incumbent),
      founder_control_with: founder.map(p => p.incumbent),
      unresolved: per.filter(p => !p.verdict.resolved).map(p => ({ incumbent: p.incumbent, why: p.verdict.why })),
    },
    pairwise_only:
      'every verdict above is a two-species comparison. Pairwise coexistence does not compose: three ' +
      'species on two resources cannot all coexist at equilibrium, so a design that coexists with each ' +
      'incumbent separately may still be excluded by the assembled community.',
    what_this_does_not_model: WHAT_TWO_RESOURCES_STILL_IGNORE,
    citations: CITATIONS,
  };
}

// ---------------------------------------------------------------------------------------------------
// 5. THE LIST. Built from rstar.mjs's list so that the one caveat this module addresses is removed by
// construction rather than by hand, and the rest are carried forward unchanged.

/** The single-resource caveat this module exists to discharge. Removed from the inherited list below. */
export const CAVEAT_THIS_MODULE_ADDRESSES =
  WHAT_R_STAR_IGNORES.find(s => /more than one limiting resource/i.test(s));

export const INHERITED_FROM_R_STAR = Object.freeze(
  WHAT_R_STAR_IGNORES.filter(s => s !== CAVEAT_THIS_MODULE_ADDRESSES)
);

export const NEW_WITH_TWO_RESOURCES = Object.freeze([
  'equilibrium and a well-mixed system are still assumed: every verdict here is about where the system settles, and nothing in it says how long that takes or whether a fluctuating, structured environment ever gets there',
  'three or more resources are not a simple extension of this: the graphical theory does not generalise, at most two species coexist on two resources at equilibrium, and adding a third resource changes the structure of the problem rather than its arity',
  'the consumption vector is usually assumed proportional to the growth response rather than measured, and that assumption - which is what the whole coexistence geometry rests on - is rarely tested in the system being modelled',
  'a supply point is itself a model of the environment, not a measurement of one; moving it can turn coexistence into exclusion with no change to either organism',
]);

export const WHAT_TWO_RESOURCES_STILL_IGNORE = Object.freeze([
  ...INHERITED_FROM_R_STAR,
  ...NEW_WITH_TWO_RESOURCES,
]);

/** Said plainly, because the list above is long and the point of it is short. */
export const THE_HONEST_FRAMING =
  'Going from one resource to two discharges exactly one caveat and introduces four. It is the right ' +
  'model more often than the single-resource one, and it is also the model a losing design gets defended ' +
  'with, so the extra measurements it requires are the whole point and are not optional.';
