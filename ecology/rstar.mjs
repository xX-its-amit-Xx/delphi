// WOULD IT BE OUTCOMPETED? The question a designed organism usually fails, and the one a design
// pipeline is least likely to ask.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// "Engineer a bacterium that eats carbon" is a design problem. "Will that bacterium still be there in
// six weeks" is an ECOLOGY problem, and it has a different answer, because the designed organism is not
// introduced into an empty world. It is introduced into one already occupied by lineages that have been
// optimised on the same resource for a very long time, and the usual outcome of that meeting is that the
// designed organism is diluted out while the incumbents eat the substrate it needed.
//
// This is not a vague worry. It is one of the better-established results in ecology, and it is
// quantitative.
//
// ============================== R*, AND WHY IT IS THE RIGHT CRITERION ==============================
// For growth limited by a single resource, Monod (1949) describes specific growth rate as
//
//     mu(R) = mu_max * R / (Ks + R)
//
// In a chemostat - or any system with a steady loss term - a population persists only while mu(R)
// exceeds the loss rate D. Setting mu(R*) = D and solving gives the resource concentration at which a
// species exactly holds its own:
//
//     R* = Ks * D / (mu_max - D)        defined only while mu_max > D
//
// Tilman's result (1977, 1982) is that with ONE limiting resource and species competing for it at steady
// state, the species with the LOWEST R* draws the resource down below every other species' R* and
// competitively excludes them all. Not "does better": excludes. The loser's growth rate at the
// equilibrium resource concentration is below its loss rate, so it declines monotonically.
//
// That turns "will it be outcompeted" into an arithmetic question about three numbers per organism:
// mu_max, Ks, and the loss rate D they share. It also makes the honest answer available: THIS PROJECT
// HAS NONE OF THOSE NUMBERS FOR ANY DESIGNED ORGANISM, so the module computes the bar a design must
// clear and refuses to pretend it has cleared it.
//
// ============================== WHAT R* DOES NOT COVER ==============================
// Every one of these can reverse the prediction, and a design that passes an R* comparison has cleared
// one hurdle rather than the field:
//   * more than one limiting resource - two species can coexist stably on two resources (Tilman again),
//     and the whole single-resource conclusion lapses
//   * spatial structure, biofilms, aggregates: R* assumes a well-mixed system
//   * predation, phage, and grazing, which routinely keep the best competitor from dominating
//   * cross-feeding, where the "loser" lives on the winner's waste
//   * fluctuating supply, where a species with a worse R* but faster response can persist
//   * horizontal gene transfer moving the engineered function into an incumbent, after which the
//     designed strain is irrelevant and its function is not
//   * a containment or kill-switch design, which is a deliberate guarantee of LOSING the competition
// None of these are modelled here. They are listed because a module that computed a number and said
// nothing about them would be worse than no module.

export const CITATIONS = Object.freeze({
  monod: 'Monod, J. (1949) The growth of bacterial cultures. Annual Review of Microbiology 3:371-394',
  tilman_1977: 'Tilman, D. (1977) Resource competition between planktonic algae: an experimental and theoretical approach. Ecology 58:338-348',
  tilman_1982: 'Tilman, D. (1982) Resource Competition and Community Structure. Princeton University Press',
  note: 'the R* rule is textbook ecology, not a result of this project. What is new here is only the refusal to apply it without measured parameters.',
});

export const WHAT_THIS_IS =
  'The steady-state single-resource competition criterion, applied to a designed organism against named ' +
  'competitors. It computes R* from measured growth parameters, and refuses - loudly - when the design ' +
  'has none.';

/** Monod specific growth rate. */
export function mu(R, { mu_max, Ks }) {
  if (!(mu_max > 0) || !(Ks > 0) || !(R >= 0)) return { invalid: true, why: 'mu needs mu_max > 0, Ks > 0 and R >= 0' };
  return (mu_max * R) / (Ks + R);
}

/** R*: the resource concentration at which growth exactly balances loss. */
export function rStar({ mu_max, Ks, D, label = null, source = null }) {
  if (!(mu_max > 0)) return { ok: false, label, why: 'mu_max must be positive' };
  if (!(Ks > 0)) return { ok: false, label, why: 'Ks must be positive' };
  if (!(D > 0)) return { ok: false, label, why: 'the loss rate D must be positive. With no loss term every species persists and the comparison is empty.' };
  if (mu_max <= D) {
    return {
      ok: false, label, washes_out: true,
      why: `mu_max (${mu_max}) does not exceed the loss rate D (${D}), so this organism cannot hold its own at ANY resource concentration. R* is undefined and the organism washes out of the system regardless of competitors.`,
      what_this_means: 'no amount of resource saves it. The design fails before competition is even considered.',
    };
  }
  const r = (Ks * D) / (mu_max - D);
  return {
    ok: true, label, r_star: r, mu_max, Ks, D, source,
    units: 'the same concentration units as Ks',
    formula: 'R* = Ks * D / (mu_max - D)',
    reading: `at a steady-state resource concentration of ${r.toPrecision(3)}, this organism's growth exactly balances its loss.`,
  };
}

/** The competition. Lowest R* excludes the rest - with every caveat attached. */
export function compete(organisms, { D, resource = 'the limiting resource' } = {}) {
  const scored = organisms.map(o => ({ ...o, result: rStar({ ...o, D }) }));
  const viable = scored.filter(s => s.result.ok);
  const washouts = scored.filter(s => s.result.washes_out);
  const broken = scored.filter(s => !s.result.ok && !s.result.washes_out);

  if (!viable.length) {
    return {
      resolved: false,
      why: 'no organism has mu_max above the loss rate, so the system supports none of them.',
      washouts: washouts.map(w => ({ label: w.label, why: w.result.why })),
      broken: broken.map(b => ({ label: b.label, why: b.result.why })),
    };
  }
  const ranked = [...viable].sort((a, b) => a.result.r_star - b.result.r_star);
  const winner = ranked[0];
  const designs = ranked.filter(r => r.is_design);
  const design = designs[0] ?? null;

  return {
    resolved: true,
    resource,
    loss_rate_D: D,
    ranking: ranked.map((r, i) => ({ rank: i + 1, label: r.label, r_star: +r.result.r_star.toPrecision(4), is_design: Boolean(r.is_design), source: r.source ?? null })),
    winner: winner.label,
    washouts: washouts.map(w => ({ label: w.label, why: w.result.why })),
    the_design: design
      ? {
          label: design.label,
          r_star: +design.result.r_star.toPrecision(4),
          rank: ranked.indexOf(design) + 1,
          of: ranked.length,
          persists: design === winner,
          verdict: design === winner
            ? 'the design has the lowest R* among the organisms given, so at steady state on this one resource it excludes them.'
            : `the design is EXCLUDED. ${winner.label} draws the resource down to ${winner.result.r_star.toPrecision(3)}, which is below the design's R* of ${design.result.r_star.toPrecision(3)}, so the design's growth is below its loss rate and it declines to extinction.`,
          the_bar_to_clear: +winner.result.r_star.toPrecision(4),
          how_much_better_it_must_be: design === winner ? null : +(design.result.r_star / winner.result.r_star).toPrecision(3),
        }
      : { label: null, note: 'no organism was flagged `is_design: true`, so this is a comparison among incumbents only.' },
    what_this_does_not_model: WHAT_R_STAR_IGNORES,
    citations: CITATIONS,
  };
}

export const WHAT_R_STAR_IGNORES = Object.freeze([
  'more than one limiting resource - two species coexist stably on two. CORRECTED by ecology/coexist.mjs: the single-resource conclusion does not lapse ENTIRELY, it generalises. A species with the lower R* on BOTH resources excludes the other outright at every supply point and for all 49 consumption-vector pairs the test sweeps, because uncrossed isoclines admit no coexistence equilibrium. It lapses only where the isoclines CROSS, i.e. where there is a real trade-off.',
  'spatial structure, biofilms and aggregates; R* assumes a well-mixed system',
  'predation, phage and grazing, which routinely stop the best competitor dominating',
  'cross-feeding, where the loser lives on the winner\'s waste',
  'fluctuating supply, where a worse R* with a faster response can persist',
  'horizontal gene transfer moving the engineered function into an incumbent, after which the designed strain is irrelevant and its function is not',
  'evolution of any party during the experiment',
  'a deliberate containment or kill-switch design, which is an intentional guarantee of losing',
]);

/** The honest entry point for a design with no measured parameters. */
export function assessDesign({ design, competitors = [], D = null, resource = 'the limiting resource' } = {}) {
  const missing = [];
  for (const k of ['mu_max', 'Ks']) if (!(design?.[k] > 0)) missing.push(k);
  if (!(D > 0)) missing.push('D (the loss or dilution rate of the system it enters)');

  if (missing.length) {
    const bar = competitors.filter(c => c.mu_max > 0 && c.Ks > 0 && D > 0).map(c => rStar({ ...c, D })).filter(r => r.ok);
    bar.sort((a, b) => a.r_star - b.r_star);
    return {
      refused: true,
      why: `cannot assess competition: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not measured for this design.`,
      what_is_needed: {
        mu_max: 'the maximum specific growth rate, per hour, measured for THIS strain on THIS substrate. Not the parent strain, and not a related species: an engineered pathway usually costs growth rate, and that cost is the whole question.',
        Ks: 'the half-saturation constant for the limiting resource, in concentration units, measured for this strain. Low-substrate affinity is what decides the outcome and it is rarely what a design optimises.',
        D: 'the loss rate of the environment it is released into - dilution, washout, grazing, death. Set by the environment, not the organism.',
      },
      how_to_get_them: 'a chemostat series at several dilution rates, or a batch growth curve fitted to Monod. Days of work, not months, and it is the cheapest experiment that can refute a release plan.',
      the_bar_it_would_have_to_clear: bar.length
        ? { r_star: +bar[0].r_star.toPrecision(4), set_by: bar[0].label, source: bar[0].source, meaning: `the design's R* must be BELOW ${bar[0].r_star.toPrecision(3)} or it is excluded at steady state on this resource.` }
        : { r_star: null, note: 'no competitor with measured parameters was supplied either, so not even the bar can be computed.' },
      what_we_refuse_to_do:
        'substitute a plausible mu_max and Ks to produce a verdict. A competition outcome computed from ' +
        'invented growth parameters would look exactly like one computed from measurements, and it would ' +
        'be the most confident wrong number in the whole system.',
      citations: CITATIONS,
    };
  }
  return compete([{ ...design, is_design: true }, ...competitors], { D, resource });
}
