#!/usr/bin/env node
// Tests for division.mjs
//
//   node sim-engine/scales/micro/test-division.mjs [--fail-once]
//
// Four things are checked harder than the rest, because they are the four ways an animation can look
// right and be a drawing of nothing.
//
//   1. THE CONSERVATION IS REAL AT EVERY INSTANT, not just at the ends. The whole point of solving for
//      the radius rather than interpolating it is that the union volume holds constant all the way
//      through. That is asserted across a sweep of t, to a tight tolerance, so an implementation that
//      merely matched the endpoints would fail.
//
//   2. THE GEOMETRY IS CHECKED AGAINST CLOSED FORMS. The lens volume has exact known values at d = 0
//      (a whole sphere) and d = 2r (zero), and the fully separated radius is exactly r0 * 2^(-1/3).
//      These are the only numbers here that are known independently of the code.
//
//   3. THE LINEAGE ASSIGNMENT IS CHECKED FOR THE CASE WHERE IT SHOULD FAIL. Nearest-centre pairing is a
//      guess. A fixture is constructed where the guess goes wrong - three daughters nearest one parent
//      - and the test asserts that `balanced` comes back FALSE with a reason. A pairing function that
//      always reports success is worse than none, because the drawing would invent a lineage.
//
//   4. THE REAL FILE IS USED, NOT A FIXTURE OF IT. The worked .life example is loaded from disk and its
//      five stages are run through the planner. If that file changes shape, this test fails rather than
//      the viewer silently drawing something else.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL; an assertion that survives its own fault asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './division.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

// ------------------------------------------------------------------ 2. closed forms
console.log('\nthe geometry, against closed forms');
{
  const r = 3;
  check('lens volume at d = 0 is a whole sphere', near(f(D.lensVolume(r, 0), D.lensVolume(r, 0) * 2), (4 / 3) * Math.PI * r ** 3, 1e-9),
    `${D.lensVolume(r, 0).toFixed(6)} vs ${((4 / 3) * Math.PI * 27).toFixed(6)}`);
  check('lens volume at d = 2r is zero', f(D.lensVolume(r, 2 * r) === 0, D.lensVolume(r, 2 * r) !== 0));
  check('lens volume beyond contact is zero, not negative', f(D.lensVolume(r, 10) === 0, D.lensVolume(r, 10) !== 0));
  check('union at d = 0 is one sphere', near(f(D.unionVolume(r, 0), D.unionVolume(r, 0) + 1), (4 / 3) * Math.PI * r ** 3, 1e-9));
  check('union at full separation is two spheres', near(f(D.unionVolume(r, 2 * r), 0), 2 * (4 / 3) * Math.PI * r ** 3, 1e-9));
  let threw = false; try { D.lensVolume(-1, 1); } catch { threw = true; }
  check('a negative radius is refused rather than returning a number', f(threw, !threw));

  const V = (4 / 3) * Math.PI * 40 ** 3;
  const rSep = D.radiusForUnion(V, 1e6);
  check('fully separated daughters have radius exactly r0 * 2^(-1/3)',
    near(f(rSep, rSep * 1.1), 40 * Math.pow(2, -1 / 3), 1e-9),
    `${rSep.toFixed(6)} vs ${(40 * Math.pow(2, -1 / 3)).toFixed(6)}`);
  check('coincident daughters have the parent radius', near(f(D.radiusForUnion(V, 0), 0), 40, 1e-6));
  check('the solved radius decreases monotonically as the daughters separate', f(
    [0, 10, 20, 30, 40, 60, 80].map(d => D.radiusForUnion(V, d)).every((v, i, a) => i === 0 || v <= a[i - 1] + 1e-12), false));
}

// ------------------------------------------------------------------ 1. conservation at every instant
console.log('\nconservation, across the whole division and not just at its ends');
{
  const parent = { centre: [0, 0, 0], radius: 40 };
  const a = { centre: [31.748, 0, 0], radius: 31.748 };
  const b = { centre: [-31.748, 0, 0], radius: 31.748 };
  const V = (4 / 3) * Math.PI * 40 ** 3;
  const ts = Array.from({ length: 41 }, (_, i) => i / 40);
  const frames = ts.map(t => D.divisionFrame(parent, a, b, t));
  const worst = Math.max(...frames.map(fr => Math.abs(fr.union_volume / V - 1)));
  check('union volume is constant across 41 frames to 1 part in 10^9', f(worst < 1e-9, false),
    `worst relative error ${worst.toExponential(2)}`);
  check('every frame reports its own parent volume unchanged', f(frames.every(fr => near(fr.parent_volume, V, 1e-9)), false));
  check('the two daughters are the same size as each other at every t', f(frames.every(fr => fr.a.radius === fr.b.radius), false));
  check('radius at t=0 is the parent radius', near(f(frames[0].radius, 0), 40, 1e-6), `${frames[0].radius.toFixed(4)}`);
  check('radius at t=1 is the cleavage radius', near(f(frames[40].radius, 40), 40 * Math.pow(2, -1 / 3), 1e-6), `${frames[40].radius.toFixed(4)}`);
  check('separation grows monotonically', f(frames.every((fr, i) => i === 0 || fr.separation >= frames[i - 1].separation), false));
  check('the furrow is absent at the start and present at the end', f(frames[0].furrow === 0 && frames[40].furrow > 0.2, false),
    `furrow ${frames[0].furrow.toFixed(3)} -> ${frames[40].furrow.toFixed(3)}`);
  check('both daughters start at the parent centre', f(
    frames[0].a.centre.every((v, i) => near(v, parent.centre[i], 1e-9)) &&
    frames[0].b.centre.every((v, i) => near(v, parent.centre[i], 1e-9)), false));
  check('both daughters end where the next stage puts them', f(
    frames[40].a.centre.every((v, i) => near(v, a.centre[i], 1e-6)) &&
    frames[40].b.centre.every((v, i) => near(v, b.centre[i], 1e-6)), false));
  let threw = false; try { D.divisionFrame(parent, a, b, 1.5); } catch { threw = true; }
  check('t outside [0,1] is refused', f(threw, !threw));
  // An easing function must not be able to break conservation - it reparameterises time, nothing else.
  const eased = ts.map(t => D.divisionFrame(parent, a, b, t, { ease: x => x * x * (3 - 2 * x) }));
  check('conservation survives an easing function', f(
    Math.max(...eased.map(fr => Math.abs(fr.union_volume / V - 1))) < 1e-9, false));
}

// ------------------------------------------------------------------ 3. the pairing, including its failure
console.log('\nlineage assignment, including the case where the guess is wrong');
{
  const parents = [{ centre: [0, 0, 0], radius: 10 }, { centre: [100, 0, 0], radius: 10 }];
  const good = [
    { centre: [-8, 0, 0], radius: 8 }, { centre: [8, 0, 0], radius: 8 },
    { centre: [92, 0, 0], radius: 8 }, { centre: [108, 0, 0], radius: 8 },
  ];
  const okPair = D.pairDaughters(parents, good);
  check('a clean two-to-one split is reported balanced', f(okPair.balanced, !okPair.balanced), JSON.stringify(okPair.counts));
  check('each parent gets exactly its own two daughters', f(
    okPair.pairs[0].daughters.join(',') === '0,1' && okPair.pairs[1].daughters.join(',') === '2,3', false),
    JSON.stringify(okPair.pairs.map(p => p.daughters)));
  check('a balanced pairing carries no complaint', f(okPair.why_not === null, okPair.why_not !== null));

  // Three daughters sit nearest the first parent: the guess fails, and it must SAY so.
  const bad = [
    { centre: [-8, 0, 0], radius: 8 }, { centre: [8, 0, 0], radius: 8 }, { centre: [20, 0, 0], radius: 8 },
    { centre: [108, 0, 0], radius: 8 },
  ];
  const badPair = D.pairDaughters(parents, bad);
  check('a pairing that is not two-to-one is reported UNbalanced', f(!badPair.balanced, badPair.balanced), JSON.stringify(badPair.counts));
  check('and it says why, naming the counts', f(
    typeof badPair.why_not === 'string' && /lineage/.test(badPair.why_not) && /3/.test(badPair.why_not), false), badPair.why_not ?? 'no reason given');
  check('the rule used is stated rather than implied', f(/nearest/.test(okPair.rule) && /not a lineage/.test(okPair.rule), false));
}

// ------------------------------------------------------------------ 4. the real file
console.log('\nthe worked .life example, loaded from disk');
{
  const p = path.join(root, 'organism-format/life/examples/mouse-preimplantation.life');
  const life = JSON.parse(fs.readFileSync(p, 'utf8'));
  const stages = life.timeline.stages.map(s => ({
    id: s.id, time: s.time, time_unit: s.time_unit,
    provenance: s.geometry?.provenance?.kind ?? null,
    cells: s.geometry.cells.map(c => ({ centre: c.channels.geometry.centre, radius: c.channels.geometry.radius })),
  }));
  check('the example still has five stages', f(stages.length === 5, stages.length !== 5), `${stages.length}`);
  check('the cell counts still double: 1, 2, 4, 8, 16', f(
    stages.map(s => s.cells.length).join(',') === '1,2,4,8,16', false), stages.map(s => s.cells.length).join(','));
  check('its geometry is still marked depicted, so nothing here may call it measured', f(
    stages.every(s => s.provenance === 'depicted'), false), [...new Set(stages.map(s => s.provenance))].join(','));

  const pl = D.plan(stages);
  check('the plan has four divisions for five stages', f(pl.steps.length === 4, pl.steps.length !== 4));
  // Nearest-centre pairing succeeds for the first three divisions and FAILS for 8 -> 16. That is the
  // honest result, not a bug to be tuned away: by the morula the cells are packed closely enough that
  // a daughter's nearest parent centre is not its parent. The viewer must not animate lineage there.
  check('the first three divisions pair two-to-one on the real geometry', f(
    pl.steps.slice(0, 3).every(s => s.pairing.balanced), false),
    pl.steps.map(s => `${s.from}->${s.to}:${s.pairing.balanced}`).join(' '));
  check('the 8-to-16 division does NOT, and the plan names it rather than animating it anyway', f(
    !pl.all_balanced && pl.unbalanced_steps.length === 1 && /eight-cell/.test(pl.unbalanced_steps[0]), false),
    pl.unbalanced_steps.join('; ') || 'none reported');
  check('the plan tells a caller which transitions it may animate as lineage', f(
    pl.lineage_animatable.length === 4 && pl.lineage_animatable.filter(x => x.ok).length === 3, false),
    pl.lineage_animatable.map(x => `${x.ok ? 'y' : 'n'}`).join(''));
  check('total volume is conserved across every division in the file', f(pl.all_volume_conserved, !pl.all_volume_conserved),
    pl.steps.map(s => s.volume_ratio.toFixed(5)).join(', '));
  const ratios = pl.steps.map(s => s.volume_ratio);
  check('and conserved to better than one part in 10^4, not merely roughly', f(
    ratios.every(r => Math.abs(r - 1) < 1e-4), false), `worst |ratio-1| = ${Math.max(...ratios.map(r => Math.abs(r - 1))).toExponential(2)}`);
  check('each step carries the stage times from the file', f(
    pl.steps.every(s => s.from_time !== null && s.to_time !== null && s.time_unit), false),
    pl.steps.map(s => `${s.from_time}->${s.to_time} ${s.time_unit}`).join(' | '));

  // THE DISCREPANCY THAT MATTERS, asserted rather than smoothed over.
  //
  // The file conserves SUMMED volume: the daughters' sphere volumes add up to the parent's. It does not
  // conserve UNION volume, because its cells interpenetrate - at the two-cell stage the centres are
  // 16.5 um apart while each radius is 31.75 um, so the two spheres are almost inside one another and
  // their union is about 31% smaller than the zygote.
  //
  // A union-conserving animation therefore CANNOT land on the file's stored radius, and the right
  // response is to say so rather than to retune the constraint until the number matches.
  const s0 = stages[0], s1 = stages[1];
  const fr = D.divisionFrame(s0.cells[0], s1.cells[0], s1.cells[1], 1);
  const storedR = s1.cells[0].radius;
  check('the union-conserving animation does NOT land on the file\'s stored radius', f(
    Math.abs(fr.radius - storedR) > 1, false), `solved ${fr.radius.toFixed(3)} vs stored ${storedR}`);
  check('and it lands HIGHER, because the stored cells overlap and so enclose less volume', f(
    fr.radius > storedR, fr.radius <= storedR), `${fr.radius.toFixed(3)} > ${storedR}`);

  const pk = D.packingCheck(s1.cells);
  check('the two-cell stage is measured as interpenetrating', f(pk.interpenetrating, !pk.interpenetrating),
    `${pk.overlapping}/${pk.pairs} pairs overlap, worst ${(100 * pk.worst_overlap_fraction).toFixed(0)}%`);
  check('every pair at the four-cell stage overlaps', f(
    D.packingCheck(stages[2].cells).fraction_of_pairs_overlapping === 1, false),
    `${(100 * D.packingCheck(stages[2].cells).fraction_of_pairs_overlapping).toFixed(0)}% of pairs`);
  check('the plan reports interpenetration rather than leaving it to be seen on screen', f(
    pl.any_interpenetration, !pl.any_interpenetration));
  const unionTwoCell = D.unionVolume(storedR, pk.min_centre_separation);
  const zygoteV = D.SPHERE.volume(stages[0].cells[0].radius);
  check('the stored two-cell union is at least a quarter smaller than the zygote', f(
    unionTwoCell / zygoteV < 0.75, false), `union/zygote = ${(unionTwoCell / zygoteV).toFixed(3)}`);
}

// ------------------------------------------------------------------ why no file of this kind can avoid it
console.log('\nthe packing impossibility');
{
  const T = D.THE_PACKING_IMPOSSIBILITY;
  check('the maximum packing fraction is the Kepler value, not a rounded one', near(
    f(T.max_packing_fraction_infinite, 1.0), Math.PI / (3 * Math.SQRT2), 1e-12),
    `${T.max_packing_fraction_infinite}`);
  check('it is attributed to the proof rather than asserted', f(/Hales|Kepler/.test(T.max_packing_fraction_source), false));
  check('the envelope would have to grow by about 10.5% in radius', near(
    f(T.envelope_growth_required(2), 1.0), 1.1047, 1e-3), `${T.envelope_growth_required(2).toFixed(4)}`);
  check('all three options are stated, including the one the format cannot take', f(
    T.the_three_options.length === 3 && T.the_three_options.some(o => /not available to a format/.test(o)), false));
  check('and the biology is named: the cells flatten, which spheres cannot show', f(
    /compact/.test(T.what_the_embryo_actually_does) && /shape/.test(T.what_the_embryo_actually_does), false));
  check('the impossibility block is frozen', f(Object.isFrozen(T), false));
}

// ------------------------------------------------------------------ provenance is propagated, not laundered
console.log('\nprovenance');
{
  const p = D.provenanceOf();
  check('positions and radii are listed as depicted, not measured', f(
    p.depicted.some(x => /centre/.test(x)) && p.depicted.some(x => /radius/.test(x)), false));
  check('the lineage assignment is listed as depicted too', f(p.depicted.some(x => /lineage/.test(x)), false));
  check('only the stage sequence and timing are measured-secondhand', f(
    p.measured_secondhand.length === 3 && p.measured_secondhand.every(x => /stage|count|time/.test(x)), false));
  check('the summary sentence refuses to call the drawing a measurement', f(
    /diagram of cleavage, not a measurement/.test(p.the_sentence), false));
  check('what is not modelled names cytokinesis, timing, asynchrony and shape', f(
    ['cytokinesis', 'WITHIN a division', 'asynchron', 'shape'].every(k => D.WHAT_THIS_DOES_NOT_MODEL.some(s => s.includes(k))), false),
    `${D.WHAT_THIS_DOES_NOT_MODEL.length} items`);
  check('and it admits compaction cannot be shown by spheres', f(
    D.WHAT_THIS_DOES_NOT_MODEL.some(s => /compaction/.test(s)), false));
  check('exported constants are frozen', f(Object.isFrozen(D.PROVENANCE) && Object.isFrozen(D.WHAT_THIS_DOES_NOT_MODEL), false));
}

// ------------------------------------------------------------------ the holdout
console.log('\nthe holdout');
{
  const split = JSON.parse(fs.readFileSync(path.join(root, 'holdout/split.json'), 'utf8'));
  const terms = [...new Set((split.taxa ?? []).filter(t => t.assignment === 'holdout')
    .flatMap(t => [t.name, t.latin, t.scientific_name, t.common_name, t.taxon].filter(x => typeof x === 'string'))
    .map(s => s.toLowerCase()))];
  const src = (fs.readFileSync(path.join(here, 'division.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-division.mjs'), 'utf8')).toLowerCase();
  const hits = terms.filter(t => t.length > 4 && src.includes(t));
  check('the held-out roster was read from the project\'s own split file', f(terms.length > 20, terms.length === 0), `${terms.length} names`);
  check('no held-out taxon name appears in this module or its test', f(hits.length === 0 && terms.length > 20, false),
    hits.length ? hits.slice(0, 3).join(', ') : `${terms.length} names checked`);
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should have failed)' : ''}`);
if (FAULT) console.log(fail === pass + fail ? `all ${fail} assertions failed under their own fault: no survivors`
  : `SURVIVORS: ${pass} assertion(s) still passed with a fault injected - those assert nothing`);
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
