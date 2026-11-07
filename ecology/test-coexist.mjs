#!/usr/bin/env node
// Tests for the two-resource coexistence criterion.
//
//   node ecology/test-coexist.mjs [--fail-once]
//
// Two things are checked harder than the arithmetic, because they are the two ways this module could do
// damage. The first is reporting FOUNDER CONTROL as coexistence: both are "both species can be there" in
// a one-line summary and they are opposite predictions, and only one of them is a claim about
// persistence. The second is producing any coexistence verdict at all from an unmeasured consumption
// vector - the number that decides the outcome and the one a design is least likely to have measured.
//
// --fail-once injects one fault into every assertion by inverting its predicate. Every line must then
// FAIL. An assertion that survives its own inversion is asserting nothing.
import * as C from './coexist.mjs';
import { WHAT_R_STAR_IGNORES } from './rstar.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const D = 0.1;
// Ks = R* * (mu_max - D) / D; with mu_max = 0.5 and D = 0.1 that is Ks = 4 * R*.
const ks = rstar => 4 * rstar;
const sp = (label, r1star, r2star, consumption, extra = {}) => ({
  label,
  kind: 'essential',
  R1: { mu_max: 0.5, Ks: ks(r1star) },
  R2: { mu_max: 0.5, Ks: ks(r2star) },
  consumption,
  consumption_source: 'illustrative, not a measurement',
  ...extra,
});

// A is the better competitor for R1 (R1* = 0.25 against 4) and the worse for R2 (4 against 0.25).
// B is the mirror image. Their L-shaped isoclines therefore cross, at E = (4, 4).
// Each consumes relatively more of the resource that limits it at the crossing: A more R2, B more R1.
const A = sp('A', 0.25, 4, [1, 3]);
const B = sp('B', 4, 0.25, [3, 1]);
// The same two species with their consumption vectors swapped: still crossed isoclines, still the same
// R* values, but now each consumes more of the resource it is ALREADY the better competitor for.
const A_crossed = sp('A', 0.25, 4, [3, 1]);
const B_crossed = sp('B', 4, 0.25, [1, 3]);

console.log(`\ncoexist: two-resource competition, D = ${D}\n`);

// ---------------------------------------------------------------------------------------------------
// 1. TWO IDENTICAL SPECIES NEVER STABLY COEXIST. The degenerate case, and the one a mutual-invasibility
// implementation gets wrong by default: two identical species "both invade" each other at a growth rate
// of exactly D, so a >= test reports coexistence. Their isoclines are the same line and never cross, so
// there is no two-species equilibrium to be stable about. It is neutral drift.
{
  const twin = { ...A, label: 'A-twin' };
  const v = C.coexistenceRegion(A, twin, [10, 10], { D });
  check('identical species are NOT reported as stable coexistence',
    f(v.outcome !== 'stable-coexistence', v.outcome === 'stable-coexistence'), `outcome ${v.outcome}`);
  check('identical species are flagged is_coexistence: false',
    f(v.is_coexistence === false, v.is_coexistence !== false), `is_coexistence ${v.is_coexistence}`);
  check('identical species are called out as indistinguishable, not as a prediction',
    f(v.outcome === 'neutral-indistinguishable', v.outcome !== 'neutral-indistinguishable'), `outcome ${v.outcome}`);
  check('the reason says the isoclines are the same and never cross',
    f(/SAME isocline/.test(v.why) && /never cross/.test(v.why), !(/SAME isocline/.test(v.why) && /never cross/.test(v.why))), v.why?.slice(0, 70));
  check('neutral drift is explicitly distinguished from coexistence',
    f(/not coexistence/i.test(v.why), !/not coexistence/i.test(v.why)), v.why?.slice(0, 70));
  // Identical in every respect except consumption: still no crossing, so still no coexistence.
  const w = C.coexistenceRegion(A, { ...A, label: 'A-twin', consumption: [3, 1] }, [10, 10], { D });
  check('identical isoclines with DIFFERENT consumption vectors still give no coexistence',
    f(w.outcome === 'neutral-indistinguishable', w.outcome !== 'neutral-indistinguishable'), `outcome ${w.outcome}`);
}

// ---------------------------------------------------------------------------------------------------
// 2. THE WORKED EXAMPLE. Crossed isoclines, consumption vectors on the right side of the crossing,
// supply point in the wedge: stable coexistence, with every intermediate number checkable by hand.
{
  const v = C.coexistenceRegion(A, B, [10, 10], { D });
  check('crossed isoclines + correctly crossed consumption + central supply = stable coexistence',
    f(v.outcome === 'stable-coexistence', v.outcome !== 'stable-coexistence'), `outcome ${v.outcome}`);
  check('the two-species equilibrium is the isocline crossing E = (4, 4)',
    f(v.crossing.two_species_equilibrium[0] === 4 && v.crossing.two_species_equilibrium[1] === 4,
      !(v.crossing.two_species_equilibrium[0] === 4 && v.crossing.two_species_equilibrium[1] === 4)),
    JSON.stringify(v.crossing?.two_species_equilibrium));
  check('at the crossing each species is limited by the resource it is the POORER competitor for',
    f(v.crossing.limits_a === 'R2' && v.crossing.limits_b === 'R1',
      !(v.crossing.limits_a === 'R2' && v.crossing.limits_b === 'R1')),
    `A limited by ${v.crossing?.limits_a}, B by ${v.crossing?.limits_b}`);
  const eqA = v.single_species_equilibria['A'].resources, eqB = v.single_species_equilibria['B'].resources;
  check('A alone draws (10,10) down to (8,4), its own isocline, limited by R2',
    f(Math.abs(eqA[0] - 8) < 1e-9 && Math.abs(eqA[1] - 4) < 1e-9,
      !(Math.abs(eqA[0] - 8) < 1e-9 && Math.abs(eqA[1] - 4) < 1e-9)), JSON.stringify(eqA));
  check('B alone draws (10,10) down to (4,8), the mirror image',
    f(Math.abs(eqB[0] - 4) < 1e-9 && Math.abs(eqB[1] - 8) < 1e-9,
      !(Math.abs(eqB[0] - 4) < 1e-9 && Math.abs(eqB[1] - 8) < 1e-9)), JSON.stringify(eqB));
  // mu_B at (8,4) = min(0.5*8/24, 0.5*4/1) = min(1/6, 2) = 0.16667, against D = 0.1.
  const inv = v.invasion['B into A'].mu;
  check('B invades A\'s equilibrium at mu = 1/6, hand-computable and above D',
    f(Math.abs(inv - 1 / 6) < 1e-5 && inv > D, !(Math.abs(inv - 1 / 6) < 1e-5 && inv > D)), `mu ${inv}`);
  check('both invasion growth rates are positive - that is what stable coexistence means here',
    f(v.invasion['B into A'].can_invade && v.invasion['A into B'].can_invade,
      !(v.invasion['B into A'].can_invade && v.invasion['A into B'].can_invade)), JSON.stringify(v.invasion));
  check('the consumption condition is reported as met, separately from the isoclines',
    f(v.crossing.consumption_condition_met === true, v.crossing.consumption_condition_met !== true),
    `ratios ${v.crossing?.a_consumption_ratio_R1_per_R2} vs ${v.crossing?.b_consumption_ratio_R1_per_R2}`);
}

// ---------------------------------------------------------------------------------------------------
// 3. SWAPPING THE ARGUMENTS MIRRORS THE VERDICT. a-wins must become b-wins and nothing else may move.
// If the classifier has a left/right bias it shows up here and nowhere else.
{
  const better = sp('better', 0.25, 0.25, [3, 1]);
  const worse = sp('worse', 4, 4, [3, 1]);
  const fwd = C.coexistenceRegion(better, worse, [10, 10], { D });
  const rev = C.coexistenceRegion(worse, better, [10, 10], { D });
  check('a-wins forward becomes b-wins reversed',
    f(fwd.outcome === 'a-wins' && rev.outcome === 'b-wins', !(fwd.outcome === 'a-wins' && rev.outcome === 'b-wins')),
    `${fwd.outcome} / ${rev.outcome}`);
  const cf = C.coexistenceRegion(A, B, [10, 10], { D }), cr = C.coexistenceRegion(B, A, [10, 10], { D });
  check('stable coexistence is symmetric under the swap',
    f(cf.outcome === 'stable-coexistence' && cr.outcome === 'stable-coexistence',
      !(cf.outcome === 'stable-coexistence' && cr.outcome === 'stable-coexistence')), `${cf.outcome} / ${cr.outcome}`);
  check('the mirrored run mirrors the invasion rates too, it does not merely agree on the label',
    f(Math.abs(cf.invasion['B into A'].mu - cr.invasion['B into A'].mu) < 1e-12 &&
      Math.abs(cf.invasion['A into B'].mu - cr.invasion['A into B'].mu) < 1e-12,
      !(Math.abs(cf.invasion['B into A'].mu - cr.invasion['B into A'].mu) < 1e-12 &&
        Math.abs(cf.invasion['A into B'].mu - cr.invasion['A into B'].mu) < 1e-12)),
    `${cf.invasion['B into A'].mu} vs ${cr.invasion['B into A'].mu}`);
  const ff = C.coexistenceRegion(A_crossed, B_crossed, [10, 10], { D });
  const fr = C.coexistenceRegion(B_crossed, A_crossed, [10, 10], { D });
  check('founder control is symmetric under the swap as well',
    f(ff.outcome === 'founder-control' && fr.outcome === 'founder-control',
      !(ff.outcome === 'founder-control' && fr.outcome === 'founder-control')), `${ff.outcome} / ${fr.outcome}`);
}

// ---------------------------------------------------------------------------------------------------
// 4. LOWER R* ON BOTH RESOURCES WINS OUTRIGHT, WHATEVER THE CONSUMPTION VECTORS. Uncrossed isoclines
// mean no coexistence equilibrium exists, so the consumption vectors have nothing to decide. This is the
// single-resource result surviving into two dimensions, and it is the answer to "but there are two
// limiting resources" when the design is simply worse at both.
{
  const vectors = [[1, 1], [1, 9], [9, 1], [1, 3], [3, 1], [5, 2], [2, 5]];
  const bad = [];
  for (const ca of vectors) for (const cb of vectors) {
    const better = sp('better', 0.25, 0.25, ca);
    const worse = sp('worse', 4, 4, cb);
    const v = C.coexistenceRegion(better, worse, [10, 10], { D });
    if (v.outcome !== 'a-wins') bad.push(`c_better=${ca} c_worse=${cb} -> ${v.outcome}`);
  }
  check(`lower R* on BOTH resources wins across all ${vectors.length ** 2} consumption-vector pairs`,
    f(bad.length === 0, bad.length !== 0), bad.length ? bad[0] : `${vectors.length ** 2} pairs, all a-wins`);
  const v = C.coexistenceRegion(sp('better', 0.25, 0.25, [1, 9]), sp('worse', 4, 4, [9, 1]), [10, 10], { D });
  check('and the isoclines are correctly reported as NOT crossing in that case',
    f(v.isoclines_cross === false && v.crossing === null, !(v.isoclines_cross === false && v.crossing === null)),
    `cross ${v.isoclines_cross}`);
}

// ---------------------------------------------------------------------------------------------------
// 5. CROSSED CONSUMPTION VECTORS GIVE FOUNDER CONTROL, NOT COEXISTENCE. The dangerous confusion. Same
// four R* values as the worked example - the textbook picture of coexistence - and only the consumption
// ratios reversed. Each species now depletes the resource it is already good at, each drives itself to
// the resource it cannot tolerate, and neither can invade the other from rarity.
{
  const v = C.coexistenceRegion(A_crossed, B_crossed, [10, 10], { D });
  check('reversed consumption vectors give founder-control',
    f(v.outcome === 'founder-control', v.outcome !== 'founder-control'), `outcome ${v.outcome}`);
  check('founder control is NOT reported as coexistence - the whole point',
    f(v.outcome !== 'stable-coexistence' && v.is_coexistence === false,
      !(v.outcome !== 'stable-coexistence' && v.is_coexistence === false)),
    `outcome ${v.outcome}, is_coexistence ${v.is_coexistence}`);
  check('neither species can invade the other, which is what makes it bistable',
    f(v.invasion['B into A'].can_invade === false && v.invasion['A into B'].can_invade === false,
      !(v.invasion['B into A'].can_invade === false && v.invasion['A into B'].can_invade === false)),
    JSON.stringify(v.invasion));
  check('the isoclines still cross - the R* values are identical to the coexisting case',
    f(v.isoclines_cross === true && v.crossing.two_species_equilibrium[0] === 4,
      !(v.isoclines_cross === true && v.crossing.two_species_equilibrium[0] === 4)),
    `cross ${v.isoclines_cross}`);
  check('so the ONLY thing that changed is the consumption condition',
    f(v.crossing.consumption_condition_met === false, v.crossing.consumption_condition_met !== false),
    `condition met ${v.crossing?.consumption_condition_met}`);
  check('the verdict says out loud that arriving first is not persistence',
    f(/arrival order/.test(v.why) && /NOT coexistence/.test(v.why), !(/arrival order/.test(v.why) && /NOT coexistence/.test(v.why))),
    v.why?.slice(0, 80));
  check('founder-control is listed among the outcomes that must never be read as coexistence',
    f(C.NOT_COEXISTENCE.includes('founder-control') && !C.NOT_COEXISTENCE.includes('stable-coexistence'),
      !(C.NOT_COEXISTENCE.includes('founder-control') && !C.NOT_COEXISTENCE.includes('stable-coexistence'))),
    C.NOT_COEXISTENCE.join(','));
}

// ---------------------------------------------------------------------------------------------------
// 6. A SUPPLY POINT BELOW BOTH ISOCLINES SUPPORTS NOTHING. (3,3) sits below A's corner (0.25,4) on the
// R2 axis and below B's corner (4,0.25) on the R1 axis. Both resources are essential, so each species
// is short of the one it needs most.
{
  const v = C.coexistenceRegion(A, B, [3, 3], { D });
  check('a supply point below both isoclines gives neither-persists',
    f(v.outcome === 'neither-persists', v.outcome !== 'neither-persists'), `outcome ${v.outcome}`);
  check('it is not quietly reported as coexistence or as a win',
    f(v.is_coexistence === false && !/wins/.test(v.outcome), !(v.is_coexistence === false && !/wins/.test(v.outcome))),
    `outcome ${v.outcome}`);
  check('the reason names the supply point rather than just the label',
    f(/on or below both isoclines/.test(v.why) && /3/.test(v.why), !(/on or below both isoclines/.test(v.why) && /3/.test(v.why))),
    v.why?.slice(0, 80));
  // One species over its isocline and the other not: that species wins by default, not by competition.
  const one = C.coexistenceRegion(A, B, [10, 1], { D });
  check('a supply point above only B\'s isocline gives b-wins, by failure to establish rather than by competition',
    f(one.outcome === 'b-wins' && /cannot establish/.test(one.why), !(one.outcome === 'b-wins' && /cannot establish/.test(one.why))),
    `${one.outcome}: ${one.why?.slice(0, 60)}`);
}

// ---------------------------------------------------------------------------------------------------
// 7. AN UNMEASURED CONSUMPTION VECTOR IS REFUSED. The consumption ratio is a separate experiment from
// the growth curves, it is what decides the outcome, and it is the number a design is least likely to
// have. A design may not claim coexistence on it.
{
  const noCons = { label: 'design', kind: 'essential', R1: { mu_max: 0.5, Ks: 1 }, R2: { mu_max: 0.5, Ks: 16 } };
  const r = C.assessDesign(noCons, [B], [10, 10], { D });
  check('a design with no measured consumption vector is REFUSED',
    f(r.refused === true && /consumption vector is not measured/.test(r.why),
      !(r.refused === true && /consumption vector is not measured/.test(r.why))), r.why?.slice(0, 80));
  check('the refusal explains why consumption cannot be inferred from mu_max and Ks',
    f(/different measurements/.test(C.consumptionVector(noCons).why_it_cannot_be_inferred),
      !/different measurements/.test(C.consumptionVector(noCons).why_it_cannot_be_inferred ?? '')), 'stated');
  check('consumptionVector itself refuses rather than defaulting to (1,1)',
    f(C.consumptionVector(noCons).ok === false && C.consumptionVector(noCons).c1 === undefined,
      !(C.consumptionVector(noCons).ok === false && C.consumptionVector(noCons).c1 === undefined)),
    JSON.stringify(C.consumptionVector(noCons).ok));
  // Numbers with no provenance are refused too: this is the easiest number in the model to invent.
  const unsourced = { ...noCons, consumption: [1, 3] };
  const u = C.assessDesign(unsourced, [B], [10, 10], { D });
  check('a consumption vector with no stated source is refused as well',
    f(u.refused === true && /no stated source/.test(u.why), !(u.refused === true && /no stated source/.test(u.why))),
    u.why?.slice(0, 80));
  check('the refusal names the extra measurements two resources demand, not just the missing one',
    f(r.the_extra_measurements_two_resources_demand.length >= 5 &&
      r.the_extra_measurements_two_resources_demand.some(s => /consumption vector of each incumbent/.test(s)),
      !(r.the_extra_measurements_two_resources_demand.length >= 5 &&
        r.the_extra_measurements_two_resources_demand.some(s => /consumption vector of each incumbent/.test(s)))),
    `${r.the_extra_measurements_two_resources_demand?.length} items`);
  check('the refusal says it will not assume consumption proportional to growth',
    f(/assume a consumption vector proportional to the growth response/.test(r.what_we_refuse_to_do),
      !/assume a consumption vector proportional to the growth response/.test(r.what_we_refuse_to_do ?? '')), 'stated');
  check('the refusal names the argument it is blocking - the post-hoc rescue of a losing design',
    f(/already lost an \n?R\* comparison|already lost an R\* comparison/.test(r.the_argument_this_refusal_blocks.replace(/\s+/g, ' ')),
      !/already lost an R\* comparison/.test(r.the_argument_this_refusal_blocks.replace(/\s+/g, ' '))), 'stated');
  check('and it still computes the bar the design would have to clear',
    f(Array.isArray(r.the_bar_it_would_have_to_clear) && r.the_bar_it_would_have_to_clear[0].its_R1_star === 4,
      !(Array.isArray(r.the_bar_it_would_have_to_clear) && r.the_bar_it_would_have_to_clear[0].its_R1_star === 4)),
    JSON.stringify(r.the_bar_it_would_have_to_clear?.[0]?.its_R1_star));
  check('the bar states all three tests, including the founder-control trap',
    f(/BETTER competitor for exactly one/.test(r.the_bar_it_would_have_to_clear[0].test_1_isoclines_must_cross) &&
      /FOUNDER CONTROL/.test(r.the_bar_it_would_have_to_clear[0].and_if_it_fails_test_2),
      !(/BETTER competitor for exactly one/.test(r.the_bar_it_would_have_to_clear[0].test_1_isoclines_must_cross) &&
        /FOUNDER CONTROL/.test(r.the_bar_it_would_have_to_clear[0].and_if_it_fails_test_2))), 'three tests stated');
}

// ---------------------------------------------------------------------------------------------------
// 8. AN UNSTATED RESOURCE KIND IS REFUSED, AND THE MIX-UP IS SHOWN TO MATTER. Same four R* values, same
// consumption vectors, same supply point (3,3): essential says nothing persists, substitutable says both
// do. That is not a shaded answer, it is an inverted one, so the kind cannot be defaulted.
{
  const noKind = { label: 'design', R1: { mu_max: 0.5, Ks: 1 }, R2: { mu_max: 0.5, Ks: 16 }, consumption: [1, 3], consumption_source: 'measured' };
  const r = C.assessDesign(noKind, [B], [10, 10], { D });
  check('a design with no stated resource kind is REFUSED',
    f(r.refused === true && /resource kind \(essential or substitutable\) is not stated/.test(r.why),
      !(r.refused === true && /resource kind \(essential or substitutable\) is not stated/.test(r.why))), r.why?.slice(0, 80));
  const iso = C.zeroNetGrowthIsoclines(noKind, D);
  check('zeroNetGrowthIsoclines refuses too, rather than picking a shape',
    f(iso.refused === true && iso.isoclines[0].ok === false, !(iso.refused === true && iso.isoclines[0].ok === false)),
    `refused ${iso.refused}`);
  check('the refusal requires the CALLER to say which kind, and says so',
    f(/caller/.test(iso.kind_is_the_caller_s_to_state) && /required input/.test(iso.kind_is_the_caller_s_to_state),
      !(/caller/.test(iso.kind_is_the_caller_s_to_state) && /required input/.test(iso.kind_is_the_caller_s_to_state))), 'stated');
  const subA = { ...A, kind: 'substitutable', R2: { mu_max: 0.5, Ks: ks(4) } };
  const subB = { ...B, kind: 'substitutable' };
  const ess = C.coexistenceRegion(A, B, [3, 3], { D });
  const sub = C.coexistenceRegion(subA, subB, [3, 3], { D });
  check('the mix-up INVERTS the verdict: essential gives neither-persists, substitutable does not',
    f(ess.outcome === 'neither-persists' && sub.outcome !== 'neither-persists',
      !(ess.outcome === 'neither-persists' && sub.outcome !== 'neither-persists')),
    `essential ${ess.outcome} / substitutable ${sub.outcome}`);
  check('a declared-substitutable species with two different mu_max values is refused',
    f(C.zeroNetGrowthIsoclines({ ...subA, R2: { mu_max: 0.3, Ks: 16 } }, D).isoclines[0].ok === false,
      C.zeroNetGrowthIsoclines({ ...subA, R2: { mu_max: 0.3, Ks: 16 } }, D).isoclines[0].ok !== false), 'refused');
}

// ---------------------------------------------------------------------------------------------------
// 9. THE ISOCLINES THEMSELVES. The L-shaped corner must be exactly the two single-resource R* values
// from rstar.mjs, and the straight isocline must hit the axes at those same two values.
{
  const iso = C.zeroNetGrowthIsoclines([A, B], D);
  check('both isoclines are built and the shapes are named for the caller',
    f(iso.ok === true && iso.isoclines[0].shape === 'L-shaped (Liebig minimum)',
      !(iso.ok === true && iso.isoclines[0].shape === 'L-shaped (Liebig minimum)')), iso.isoclines?.[0]?.shape);
  check('the L-shaped corner is exactly (R1*, R2*) = (0.25, 4) from Ks*D/(mu_max-D)',
    f(iso.isoclines[0].corner[0] === 0.25 && iso.isoclines[0].corner[1] === 4,
      !(iso.isoclines[0].corner[0] === 0.25 && iso.isoclines[0].corner[1] === 4)), JSON.stringify(iso.isoclines[0].corner));
  check('the essential isocline states that BOTH resources must be exceeded',
    f(/AND/.test(iso.isoclines[0].persists_where) && /essential/.test(iso.isoclines[0].persists_where),
      !(/AND/.test(iso.isoclines[0].persists_where) && /essential/.test(iso.isoclines[0].persists_where))),
    iso.isoclines[0].persists_where);
  const sub = C.zeroNetGrowthIsoclines({ ...A, kind: 'substitutable', R2: { mu_max: 0.5, Ks: ks(4) } }, D);
  const si = sub.isoclines[0];
  check('the substitutable isocline is linear and hits the axes at the same R1*, R2*',
    f(si.shape === 'linear (perfectly substitutable)' && si.intercepts.R1_axis === 0.25 && si.intercepts.R2_axis === 4,
      !(si.shape === 'linear (perfectly substitutable)' && si.intercepts.R1_axis === 0.25 && si.intercepts.R2_axis === 4)),
    `${si.shape} ${JSON.stringify(si.intercepts)}`);
  const onIso = si.points.every(([r1, r2]) => Math.abs(r1 / 0.25 + r2 / 4 - 1) < 1e-6);
  check('every sampled point on the straight isocline satisfies R1/R1* + R2/R2* = 1',
    f(onIso, !onIso), `${si.points.length} points`);
  // Growth exactly on the isocline equals the loss rate; that is the definition of the thing.
  const g = C.growthAt(A, 0.25, 4, D);
  check('growth at the L-shaped corner equals the loss rate exactly, both resources limiting',
    f(Math.abs(g.mu - D) < 1e-12 && g.limiting_resource === 'both equally',
      !(Math.abs(g.mu - D) < 1e-12 && g.limiting_resource === 'both equally')), `mu ${g.mu}, limited by ${g.limiting_resource}`);
  check('a zero or negative loss rate is refused rather than making every point an isocline',
    f(C.zeroNetGrowthIsoclines([A], 0).refused === true, C.zeroNetGrowthIsoclines([A], 0).refused !== true), 'refused');
}

// ---------------------------------------------------------------------------------------------------
// 10. THE CAVEAT LIST. It must be the previous module's list minus exactly the one item this module
// discharges, plus the assumptions two-resource theory brings with it. Built from the import so it
// cannot silently drift, and checked here so it cannot silently shrink.
{
  const L = C.WHAT_TWO_RESOURCES_STILL_IGNORE;
  check('the list is frozen',
    f(Object.isFrozen(L) === true, Object.isFrozen(L) !== true), `frozen ${Object.isFrozen(L)}`);
  check('the one caveat this module discharges is the multi-resource one, and it is gone',
    f(/more than one limiting resource/.test(C.CAVEAT_THIS_MODULE_ADDRESSES) &&
      !L.some(s => /more than one limiting resource/.test(s)),
      !(/more than one limiting resource/.test(C.CAVEAT_THIS_MODULE_ADDRESSES ?? '') &&
        !L.some(s => /more than one limiting resource/.test(s)))),
    `${C.CAVEAT_THIS_MODULE_ADDRESSES?.slice(0, 40)}...`);
  check('EVERY other single-resource caveat is carried forward verbatim',
    f(WHAT_R_STAR_IGNORES.filter(s => !/more than one limiting resource/.test(s)).every(s => L.includes(s)) &&
      C.INHERITED_FROM_R_STAR.length === WHAT_R_STAR_IGNORES.length - 1,
      !(WHAT_R_STAR_IGNORES.filter(s => !/more than one limiting resource/.test(s)).every(s => L.includes(s)) &&
        C.INHERITED_FROM_R_STAR.length === WHAT_R_STAR_IGNORES.length - 1)),
    `${C.INHERITED_FROM_R_STAR.length} inherited of ${WHAT_R_STAR_IGNORES.length}`);
  check('horizontal gene transfer and the kill-switch caveat survive the move to two resources',
    f(L.some(s => /horizontal gene transfer/.test(s)) && L.some(s => /kill-switch|containment/.test(s)),
      !(L.some(s => /horizontal gene transfer/.test(s)) && L.some(s => /kill-switch|containment/.test(s)))), 'both present');
  const wanted = [/equilibrium and a well-mixed system/, /three or more resources/, /proportional to the growth response/, /model of the environment/];
  check('all four new two-resource assumptions are listed',
    f(wanted.every(re => C.NEW_WITH_TWO_RESOURCES.some(s => re.test(s))) && C.NEW_WITH_TWO_RESOURCES.length === 4,
      !(wanted.every(re => C.NEW_WITH_TWO_RESOURCES.some(s => re.test(s))) && C.NEW_WITH_TWO_RESOURCES.length === 4)),
    `${C.NEW_WITH_TWO_RESOURCES.length} new`);
  check('the list got LONGER, not shorter, by fixing one caveat',
    f(L.length === WHAT_R_STAR_IGNORES.length + 3 && L.length > WHAT_R_STAR_IGNORES.length,
      !(L.length === WHAT_R_STAR_IGNORES.length + 3 && L.length > WHAT_R_STAR_IGNORES.length)),
    `${WHAT_R_STAR_IGNORES.length} -> ${L.length}`);
  check('the honest framing says so in one sentence',
    f(/discharges exactly one caveat and introduces four/.test(C.THE_HONEST_FRAMING),
      !/discharges exactly one caveat and introduces four/.test(C.THE_HONEST_FRAMING)), 'stated');
  const v = C.coexistenceRegion(A, B, [10, 10], { D });
  check('every verdict carries the list and cites Tilman rather than claiming the theory',
    f(v.what_this_does_not_model === L && /Tilman/.test(v.citations.tilman_1982) && /not a result of this project/.test(v.citations.note),
      !(v.what_this_does_not_model === L && /Tilman/.test(v.citations.tilman_1982) && /not a result of this project/.test(v.citations.note))),
    'attached and cited');
  check('and every verdict says the supply point is an assumption about the environment',
    f(/model of the environment/.test(v.supply_point_is_a_model), !/model of the environment/.test(v.supply_point_is_a_model ?? '')), 'stated');
}

// ---------------------------------------------------------------------------------------------------
// 11. A FULLY MEASURED DESIGN DOES GET A VERDICT, AND THE VERDICT STAYS HEDGED. The refusals above are
// worth nothing if the module cannot also answer, and the answer must not overstate itself: pairwise
// coexistence does not compose into community coexistence.
{
  const design = { ...A, label: 'design', is_design: true, consumption_source: 'drawdown slopes, both resources, triplicate' };
  const r = C.assessDesign(design, [B], [10, 10], { D });
  check('a design measured on both axes, with a kind and a sourced consumption vector, is assessed',
    f(r.refused === false && r.per_incumbent[0].verdict.outcome === 'stable-coexistence',
      !(r.refused === false && r.per_incumbent[0].verdict.outcome === 'stable-coexistence')),
    `refused ${r.refused}, outcome ${r.per_incumbent?.[0]?.verdict?.outcome}`);
  check('it names the incumbent it coexists with rather than reporting a bare boolean',
    f(r.summary.stable_coexistence_with.length === 1 && r.summary.stable_coexistence_with[0] === 'B',
      !(r.summary.stable_coexistence_with.length === 1 && r.summary.stable_coexistence_with[0] === 'B')),
    JSON.stringify(r.summary.stable_coexistence_with));
  check('the answer warns that pairwise coexistence does not compose over a community',
    f(/does not compose/.test(r.pairwise_only) && /three/.test(r.pairwise_only),
      !(/does not compose/.test(r.pairwise_only) && /three/.test(r.pairwise_only))), 'stated');
  // And the same design against an incumbent that is better on both resources is excluded, not rescued.
  const r2 = C.assessDesign(design, [sp('superior', 0.1, 0.1, [1, 1])], [10, 10], { D });
  check('a design worse on both resources is excluded, and two resources do not rescue it',
    f(r2.summary.excluded_by.length === 1 && r2.summary.persists_against_all === false,
      !(r2.summary.excluded_by.length === 1 && r2.summary.persists_against_all === false)),
    `excluded by ${JSON.stringify(r2.summary.excluded_by)}`);
  check('founder control is reported in its own bucket, never folded into the coexistence bucket',
    f(C.assessDesign({ ...A_crossed, label: 'design', consumption_source: 'measured' }, [B_crossed], [10, 10], { D })
      .summary.founder_control_with.length === 1,
      C.assessDesign({ ...A_crossed, label: 'design', consumption_source: 'measured' }, [B_crossed], [10, 10], { D })
        .summary.founder_control_with.length !== 1), 'separate bucket');
}

// ---------------------------------------------------------------------------------------------------
// 12. DEGENERATE INPUTS. A species that cannot beat the loss rate on an essential resource washes out
// whatever the other resource does, and a missing supply point or loss rate is refused rather than
// defaulted.
{
  const slow = { label: 'slow', kind: 'essential', R1: { mu_max: 0.05, Ks: 1 }, R2: { mu_max: 0.5, Ks: 1 }, consumption: [1, 1], consumption_source: 'x' };
  const v = C.coexistenceRegion(slow, B, [10, 10], { D });
  check('mu_max below the loss rate on an ESSENTIAL resource is a washout at any supply point',
    f(v.outcome === 'b-wins' && /at any concentration/.test(v.why), !(v.outcome === 'b-wins' && /at any concentration/.test(v.why))),
    `${v.outcome}: ${v.why?.slice(0, 60)}`);
  check('both washing out gives neither-persists, not a coin flip',
    f(C.coexistenceRegion(slow, { ...slow, label: 'slow2' }, [10, 10], { D }).outcome === 'neither-persists',
      C.coexistenceRegion(slow, { ...slow, label: 'slow2' }, [10, 10], { D }).outcome !== 'neither-persists'), 'neither-persists');
  check('a missing loss rate is refused, not defaulted',
    f(C.coexistenceRegion(A, B, [10, 10], {}).refused === true, C.coexistenceRegion(A, B, [10, 10], {}).refused !== true),
    JSON.stringify(C.coexistenceRegion(A, B, [10, 10], {}).why?.slice(0, 50)));
  check('a missing supply point is refused, with a note on what a supply point actually is',
    f(C.coexistenceRegion(A, B, null, { D }).refused === true && /not a measurement of one/.test(C.coexistenceRegion(A, B, null, { D }).what_a_supply_point_is),
      !(C.coexistenceRegion(A, B, null, { D }).refused === true && /not a measurement of one/.test(C.coexistenceRegion(A, B, null, { D }).what_a_supply_point_is ?? ''))),
    'refused');
  const zero = C.consumptionVector({ label: 'z', consumption: [0, 0] });
  check('a zero consumption vector is refused rather than producing NaN directions',
    f(zero.ok === false && zero.refused === true, !(zero.ok === false && zero.refused === true)), `ok ${zero.ok}`);
  const neg = C.coexistenceRegion(A, B, [-1, 10], { D });
  check('a negative supply concentration is refused rather than propagating',
    f(neg.refused === true, neg.refused !== true), `refused ${neg.refused}`);
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
