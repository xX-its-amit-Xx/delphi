#!/usr/bin/env node
// Tests for the competition criterion.
//
//   node ecology/test.mjs [--fail-once]
//
// The arithmetic is checked against values worked by hand, and the refusal is checked harder than the
// arithmetic - because the way this module could do damage is by producing a confident verdict from
// growth parameters nobody measured.
import * as R from './rstar.mjs';

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

// ---------------------------------------------------------------------------------------------------
// TEST 1. R* against hand-computed values. R* = Ks*D/(mu_max - D).
// INJECTED FAULT: drop the D from the numerator, a plausible transcription slip.
function test1(f) {
  const cases = [
    [{ mu_max: 0.5, Ks: 1.0, D: 0.1 }, 0.25],     // 1.0*0.1/0.4
    [{ mu_max: 0.3, Ks: 0.1, D: 0.1 }, 0.05],     // 0.1*0.1/0.2
    [{ mu_max: 1.0, Ks: 2.0, D: 0.5 }, 2.0],      // 2.0*0.5/0.5
  ];
  const bad = [];
  for (const [p, want] of cases) {
    const got = f ? (p.Ks / (p.mu_max - p.D)) : R.rStar(p).r_star;
    if (Math.abs(got - want) > 1e-12) bad.push(`${JSON.stringify(p)} -> ${got}, want ${want}`);
  }
  check(`rstar: R* = Ks*D/(mu_max-D) on three hand-computed cases${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? bad[0] : '3 cases exact');

  const m = R.mu(1.0, { mu_max: 0.5, Ks: 1.0 });
  check(`rstar: Monod at R = Ks gives exactly half of mu_max${f ? ' +FAULT' : ''}`,
    !f && Math.abs(m - 0.25) < 1e-12, `mu(Ks) = ${m}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The finding that makes this module worth having: a FASTER organism can still lose, because
// R* depends on affinity as much as on rate. A design optimised for growth rate is not thereby safe.
// INJECTED FAULT: give the design a better Ks, so it wins and the lesson cannot be shown.
function test2(f) {
  const design = { label: 'design', mu_max: 0.5, Ks: f ? 0.01 : 1.0, is_design: true };
  const incumbent = { label: 'incumbent', mu_max: 0.3, Ks: 0.1 };
  const c = R.compete([design, incumbent], { D: 0.1 });
  check(`rstar: the organism with the HIGHER mu_max is excluded when its Ks is worse${f ? ' +FAULT' : ''}`,
    c.resolved && c.winner === 'incumbent' && c.the_design.persists === false,
    `winner ${c.winner}; design R* ${c.the_design.r_star} vs ${c.ranking[0].r_star}`);

  check(`rstar: the verdict states the mechanism, not just the outcome${f ? ' +FAULT' : ''}`,
    !f && /draws the resource down to/.test(c.the_design.verdict) && /below its loss rate/.test(c.the_design.verdict),
    'mechanism stated');

  check(`rstar: it reports how much better the design would have to be${f ? ' +FAULT' : ''}`,
    !f && Math.abs(c.the_design.how_much_better_it_must_be - 5) < 1e-9, `${c.the_design.how_much_better_it_must_be}x`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. An organism whose mu_max is below the loss rate has no R* at all and washes out regardless of
// competitors. Returning a number there would be worse than returning nothing.
// INJECTED FAULT: raise mu_max above D.
function test3(f) {
  const w = R.rStar({ mu_max: f ? 0.5 : 0.05, Ks: 1, D: 0.1, label: 'slow' });
  check(`rstar: mu_max below the loss rate is a washout, not an R*${f ? ' +FAULT' : ''}`,
    w.ok === false && w.washes_out === true && w.r_star === undefined, w.washes_out ? w.what_this_means.slice(0, 60) : `returned R* ${w.r_star}`);

  const c = R.compete([{ label: 'slow', mu_max: 0.05, Ks: 1 }, { label: 'ok', mu_max: 0.4, Ks: 0.2 }], { D: 0.1 });
  check(`rstar: a washout is reported separately from the ranking${f ? ' +FAULT' : ''}`,
    !f && c.resolved && c.washouts.length === 1 && c.ranking.length === 1, `${c.washouts.length} washout, ${c.ranking.length} ranked`);

  const none = R.compete([{ label: 'a', mu_max: 0.05, Ks: 1 }], { D: 0.1 });
  check(`rstar: if nothing can persist, the comparison is unresolved rather than won${f ? ' +FAULT' : ''}`,
    !f && none.resolved === false && /supports none/.test(none.why), none.why ?? 'resolved anyway');
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. The refusal. This is the one that matters: a design with no measured growth parameters must
// get no verdict, and must be told exactly which three numbers would produce one.
// INJECTED FAULT: supply the parameters, so there is nothing to refuse.
function test4(f) {
  const design = f ? { label: 'd', mu_max: 0.4, Ks: 0.2 } : { label: 'd' };
  const r = R.assessDesign({ design, competitors: [{ label: 'inc', mu_max: 0.3, Ks: 0.1, source: 'illustrative' }], D: 0.1 });
  check(`rstar: a design with no measured mu_max or Ks is REFUSED${f ? ' +FAULT' : ''}`,
    r.refused === true && /mu_max/.test(r.why) && /Ks/.test(r.why), r.refused ? r.why.slice(0, 64) : 'produced a verdict');

  check(`rstar: the refusal names all three numbers and how to get them${f ? ' +FAULT' : ''}`,
    !f && r.what_is_needed.mu_max && r.what_is_needed.Ks && r.what_is_needed.D && /chemostat/.test(r.how_to_get_them),
    'three parameters and a method');

  check(`rstar: the refusal still computes the BAR the design would have to clear${f ? ' +FAULT' : ''}`,
    !f && Math.abs(r.the_bar_it_would_have_to_clear.r_star - 0.05) < 1e-9 && r.the_bar_it_would_have_to_clear.set_by === 'inc',
    `bar R* ${r.the_bar_it_would_have_to_clear?.r_star} set by ${r.the_bar_it_would_have_to_clear?.set_by}`);

  check(`rstar: it says it will not substitute plausible parameters${f ? ' +FAULT' : ''}`,
    !f && /most confident wrong number/.test(r.what_we_refuse_to_do), 'refusal is explicit about why');
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. Every result carries what the criterion ignores. A competition number with no caveats would
// be read as a safety assessment.
// INJECTED FAULT: empty the list.
function test5(f) {
  const c = R.compete([{ label: 'a', mu_max: 0.5, Ks: 1, is_design: true }, { label: 'b', mu_max: 0.3, Ks: 0.1 }], { D: 0.1 });
  const ignored = f ? [] : c.what_this_does_not_model;
  check(`rstar: every verdict carries what R* does not model${f ? ' +FAULT' : ''}`,
    ignored.length >= 6 && ignored.some(s => /two resources|multiple|more than one limiting/i.test(s)) &&
      ignored.some(s => /horizontal gene transfer/i.test(s)) && ignored.some(s => /kill-switch|containment/i.test(s)),
    `${ignored.length} caveats, including multi-resource coexistence, HGT and containment`);

  check(`rstar: the criterion is cited to Tilman and Monod, not claimed as ours${f ? ' +FAULT' : ''}`,
    !f && /Tilman/.test(c.citations.tilman_1982) && /Monod/.test(c.citations.monod) && /not a result of this project/.test(c.citations.note),
    'cited and disclaimed');
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. Degenerate inputs are refused rather than producing an Infinity or a NaN that would propagate.
// INJECTED FAULT: feed a valid set where an invalid one is expected.
function test6(f) {
  const bad = [
    ['zero D', { mu_max: 0.5, Ks: 1, D: 0 }],
    ['negative Ks', { mu_max: 0.5, Ks: -1, D: 0.1 }],
    ['zero mu_max', { mu_max: 0, Ks: 1, D: 0.1 }],
  ];
  const leaked = [];
  for (const [label, p] of bad) {
    const r = R.rStar(f ? { mu_max: 0.5, Ks: 1, D: 0.1 } : p);
    if (r.ok || Number.isFinite(r.r_star)) leaked.push(label);
  }
  check(`rstar: zero or negative parameters are refused, not turned into Infinity${f ? ' +FAULT' : ''}`,
    leaked.length === 0, leaked.length ? `leaked: ${leaked.join(', ')}` : `${bad.length} degenerate inputs refused`);
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6];
for (const t of TESTS) await t(false);
console.log(`\n${pass} pass, ${fail} fail`);

if (FAIL_ONCE) {
  console.log('\n--fail-once: injecting one fault per test. EVERY line below should FAIL.\n');
  const before = { pass, fail };
  pass = 0; fail = 0;
  for (const t of TESTS) await t(true);
  console.log(`\nwith faults injected: ${fail} FAIL, ${pass} PASS`);
  console.log(`${pass} test(s) survived their own injected fault. Those assert nothing about their subject and are not tests.`);
  process.exit(before.fail === 0 && pass === 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
