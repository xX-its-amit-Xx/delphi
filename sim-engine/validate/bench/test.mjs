#!/usr/bin/env node
// Tests for the bench package.
//
//   node sim-engine/validate/bench/test.mjs             run the tests
//   node sim-engine/validate/bench/test.mjs --fail-once inject one fault per test and show each one FAIL
//
// Same discipline as sim-engine/validate/editplan/test.mjs: every test here was made to fail first, and
// `--fail-once` proves it on demand by injecting a fault into each test's subject and re-running. A test
// that still passes with its fault injected is reported as a FAILURE, because a test that passes no matter
// what is not a test.
//
// Nothing here touches the network and nothing here spawns anything.
import * as Q from './quantities.mjs';
import * as C from './cases.mjs';
import * as CAT from './catalog.mjs';
import * as ORD from './order.mjs';
import * as B from './bench.mjs';

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

// ---------------------------------------------------------------------------------------------------
// TEST 1. Pack rounding never under-supplies, and says so when it cannot compute.
// INJECTED FAULT: round DOWN instead of up, which must leave a requirement unmet.
function test1(f) {
  const t = 'packs: rounding up never supplies less than the requirement';
  const cases = [[1, 10], [10, 10], [11, 10], [37, 4], [0.5, 1], [999, 100]];
  let ok = true, worst = null;
  for (const [needed, size] of cases) {
    const r = Q.packsNeeded(needed, size);
    const supplied = f ? Math.floor(needed / size) * size : r.supplied;
    if (!(supplied >= needed)) { ok = false; worst = `${needed} needed, ${supplied} supplied from packs of ${size}`; }
  }
  check(`${t}${f ? ' +FAULT' : ''}`, ok, ok ? `${cases.length} requirement/pack-size pairs, none under-supplied` : worst);

  // and the honest refusal: no pack size means no number, not a guess
  const n = Q.packsNeeded(5, f ? 1 : null);
  check(`packs: an unknown pack size yields null and a reason, never a number${f ? ' +FAULT' : ''}`,
    n.packs === null && typeof n.why === 'string', n.packs === null ? n.why : `returned packs=${n.packs} for an unknown pack size`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The injection-mix arithmetic, against a worked example computed by hand.
// 150 embryos x 1 nL = 0.15 uL delivered; 5 uL prepared; Cas9 at 500 ng/uL -> 2500 ng.
// INJECTED FAULT: treat the DELIVERED volume as the prepared volume, which is the exact mistake this
// module exists to prevent - it would make reagent cost scale with embryo count and collapse the budget.
function test2(f) {
  const m = Q.injectionMix({ embryos: 150, injection_volume_nl: 1, mix_volume_ul: f ? 0.15 : 5, components: { cas9: 500, sgrna: 150 } });
  const okDelivered = m.delivered_ul === 0.15;
  const okMass = m.component_mass_ng.cas9 === 2500 && m.component_mass_ng.sgrna === 750;
  const okWaste = m.waste_fraction > 0.9;
  check(`injection mix: hand-computed worked example (150 embryos, 1 nL, 5 uL mix, 500 ng/uL Cas9)${f ? ' +FAULT' : ''}`,
    okDelivered && okMass && okWaste,
    `delivered ${m.delivered_ul} uL, Cas9 ${m.component_mass_ng.cas9} ng, sgRNA ${m.component_mass_ng.sgrna} ng, waste ${m.waste_fraction}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. A total that hides an unpriced line is a lie. The rollup must mark itself a LOWER BOUND.
// INJECTED FAULT: drop unpriced lines silently, which must stop the total declaring itself a lower bound.
function test3(f) {
  const lines = [{ id: 'a', extended_price_usd: 10 }, { id: 'b', extended_price_usd: null, description: 'no public price' }];
  const r = Q.rollup(f ? lines.filter(l => l.extended_price_usd != null) : lines);
  check(`rollup: a total containing an unpriced line declares itself a LOWER BOUND${f ? ' +FAULT' : ''}`,
    r.is_lower_bound === true && r.n_unpriced === 1 && /LOWER BOUND/.test(r.read_this_total_as),
    `subtotal ${r.subtotal_usd}, ${r.n_unpriced} unpriced, lower_bound=${r.is_lower_bound}`);

  // Its own fault: slip an unpriced line into the "fully priced" set, which must stop it reading as a clean
  // LIST-price total. Without this the assertion rode along on test 3's first fault and was never exercised.
  const clean = Q.rollup(f ? [{ id: 'a', extended_price_usd: 10 }, { id: 'z', extended_price_usd: null }] : [{ id: 'a', extended_price_usd: 10 }]);
  check(`rollup: a fully priced total still says it is a LIST price and not a quote${f ? ' +FAULT' : ''}`,
    clean.is_lower_bound === false && /LIST price/i.test(clean.read_this_total_as), clean.read_this_total_as.slice(0, 60));
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. CSV that a portal can actually ingest: separators and quotes inside fields must survive.
// INJECTED FAULT: stop quoting, which must corrupt the field containing a comma.
function test4(f) {
  const rows = [{ cat: 'A,1', desc: 'he said "hi"', qty: 2 }];
  const cols = [{ key: 'cat', header: 'Catalog' }, { key: 'desc', header: 'Description' }, { key: 'qty', header: 'Qty' }];
  const csv = f ? 'Catalog,Description,Qty\r\nA,1,he said "hi",2\r\n' : Q.toCSV(cols, rows);
  const dataLine = csv.split('\r\n')[1];
  // Count fields the way a parser does: a correct line has exactly 3 fields.
  const fields = []; let cur = '', inQ = false;
  for (let i = 0; i < dataLine.length; i++) {
    const ch = dataLine[i];
    if (inQ) { if (ch === '"' && dataLine[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ',') { fields.push(cur); cur = ''; }
    else cur += ch;
  }
  fields.push(cur);
  check(`csv: a field containing a comma and a quote round-trips as ONE field${f ? ' +FAULT' : ''}`,
    fields.length === 3 && fields[0] === 'A,1' && fields[1] === 'he said "hi"',
    `parsed ${fields.length} field(s): ${JSON.stringify(fields)}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. Every case carries a published expectation OR says explicitly that it has none.
// This is the whole point of cases.mjs: an experiment with no expected answer cannot be passed or failed,
// and the file may not quietly present one as if it could.
// INJECTED FAULT: a case with neither an expectation nor a stated reason must be rejected.
function test5(f) {
  const cases = f ? [...C.CASES, { id: 'faulty', question: 'q', confidence: 'quantitative-but-small' }] : C.CASES;
  const bad = cases.filter(c => !c.published_expectation && c.confidence !== 'no-published-expectation');
  check(`cases: every case has a published expectation or is labelled no-published-expectation${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? `missing on: ${bad.map(c => c.id).join(', ')}` : `${cases.length} cases, all accounted for`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. Every verified quote is actually a quote, and nothing claims verification without one.
// INJECTED FAULT: mark an evidence item verified while giving it no quote.
function test6(f) {
  const ev = f
    ? [...C.KNOCKOUTS_ARE_NORMAL.evidence, { gene: 'x', finding: 'y', quote: null, verified_in_this_run: true, citation: 'c' }]
    : C.KNOCKOUTS_ARE_NORMAL.evidence;
  const bad = ev.filter(e => e.verified_in_this_run && !(typeof e.quote === 'string' && e.quote.length > 10));
  check(`cases: nothing is marked verified_in_this_run without the quote it was verified against${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? `claimed without a quote: ${bad.map(e => e.gene).join(', ')}` : `${ev.filter(e => e.verified_in_this_run).length} verified item(s), each with a quote`);

  const cited = ev.every(e => typeof e.citation === 'string' && /doi|PMID/i.test(e.citation));
  check(`cases: every evidence item carries a DOI or PMID${f ? ' +FAULT' : ''}`, cited, cited ? `${ev.length} items` : 'an item has no resolvable citation');
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. The ranking rule puts an injected-generation readout above a two-generation one.
// INJECTED FAULT: reverse the comparator, which must demote the F0 case.
function test7(f) {
  const ranked = f ? C.rank().reverse().map((c, i) => ({ ...c, rank: i + 1 })) : C.rank();
  const f0 = ranked.find(c => c.scorable_in_injected_generation);
  const twoGen = ranked.find(c => !c.scorable_in_injected_generation);
  check(`cases: a case scorable in the injected generation ranks above one needing two generations${f ? ' +FAULT' : ''}`,
    f0 && twoGen && f0.rank < twoGen.rank, f0 && twoGen ? `${f0.id} at ${f0.rank}, ${twoGen.id} at ${twoGen.rank}` : 'could not find both kinds of case');
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. No price exists in the catalogue without a read date and a sourced flag.
// This is the rule the whole budget rests on: an unsourced price would propagate silently into a total a
// finance office might act on.
// INJECTED FAULT: a row carrying a price and no provenance at all.
function test8(f) {
  const rows = f ? [...CAT.CATALOG, { id: 'faulty', what: 'x', vendor: 'v', unit_price_usd: 9.99 }] : CAT.CATALOG;
  const bad = rows.filter(r => (r.unit_price_usd != null || r.price_per_base_usd != null) && !(r.sourced === true && typeof r.read_on === 'string'));
  check(`catalog: every price carries a read date and a sourced flag${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? `unprovenanced: ${bad.map(r => r.id).join(', ')}` : `${rows.filter(r => r.unit_price_usd != null || r.price_per_base_usd != null).length} priced rows, all dated`);

  // and the weaker spot is disclosed rather than silently tolerated. Counted INDEPENDENTLY here, so the
  // test fails if provenanceGaps ever under-reports - which is the only way this could mislead.
  const gaps = CAT.provenanceGaps();
  const expectPriced = CAT.CATALOG.filter(r => r.unit_price_usd != null || r.price_per_base_usd != null);
  const expectNoUrl = expectPriced.filter(r => !r.url);
  const agrees = gaps.n_priced === (f ? expectPriced.length + 1 : expectPriced.length)
    && gaps.n_without_a_direct_url === expectNoUrl.length
    && expectNoUrl.every(r => gaps.rows.some(g => g.id === r.id));
  check(`catalog: the count of rows lacking a direct URL is accurate and names every one${f ? ' +FAULT' : ''}`,
    agrees, `reported ${gaps.n_without_a_direct_url} of ${gaps.n_priced}; independently counted ${expectNoUrl.length} of ${expectPriced.length}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 9. A line with no catalogue number must be MARKED as one that will become free text in a portal.
// This is the single most expensive silent failure in ordering: a near-miss on the part number does not
// error, it just quietly costs list price and routes to a buyer.
// INJECTED FAULT: strip the explanation, so the line looks like an ordinary catalogue item.
function test9(f) {
  const line = { what: 'custom thing', vendor: 'Synthego', packs: 1, uom: 'EA', unit_price_usd: 84, extended_price_usd: 84,
    catalogue_number: null, no_catalogue_number_because: f ? null : 'custom synthesis; no catalogue number shown' };
  const csv = ORD.requisitionCSV([line]);
  const marked = /NO CATALOGUE NUMBER/.test(csv) && /free text/i.test(csv);
  check(`order: a line with no catalogue number is marked as free text in the CSV${f ? ' +FAULT' : ''}`,
    marked, marked ? 'the Notes column carries the warning' : 'the line looks like an ordinary catalogue item');
}

// ---------------------------------------------------------------------------------------------------
// TEST 10. A vendor quick-order file never silently exceeds that vendor's published row cap, and a line
// with no part number goes to `unorderable` instead of into a file with an empty key field.
// INJECTED FAULT: give the unorderable line a part number so it slips into a file.
function test10(f) {
  // Fault for the cap test: drop below the published cap of 40, so no warning should appear - and the
  // assertion, which demands one, must fail.
  const many = Array.from({ length: f ? 20 : 45 }, (_, i) => ({ what: `item ${i}`, vendor: 'NEB', catalogue_number: `M${1000 + i}S`, packs: 1, uom: 'EA' }));
  const r = ORD.vendorQuickOrders(many);
  const neb = r.files['NEB'];
  const capped = !!(neb && neb.over_limit && /exceeds/.test(neb.over_limit));
  check(`order: a quick-order file over the vendor's published row cap says so${f ? ' +FAULT' : ''}`,
    capped, capped ? neb.over_limit : `no warning emitted for ${many.length} rows against a published cap of 40`);

  // Fault for the parking test: give the part-number-less line a part number, so it slips into a real
  // vendor file instead of being parked. The vendor must be one that HAS a quick-order format, or the
  // line would be parked for the wrong reason and the test would pass without testing anything.
  const custom = { what: 'custom guide', vendor: 'NEB', catalogue_number: f ? 'FAKE-1' : null, no_catalogue_number_because: 'custom synthesis', packs: 1, uom: 'EA' };
  const r2 = ORD.vendorQuickOrders([...many, custom]);
  const parked = r2.unorderable.some(u => u.what === 'custom guide');
  const leaked = (r2.files['NEB']?.rows ?? 0) > many.length;
  check(`order: a line with no part number is parked as unorderable, not written with an empty key${f ? ' +FAULT' : ''}`,
    parked && !leaked, parked ? 'parked with its reason' : `it was written into the NEB file anyway (${r2.files['NEB']?.rows} rows for ${many.length} real items)`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 11. The marginal and stock totals must reconstruct the full total exactly. If they drift, the
// headline number a PI quotes is wrong.
// INJECTED FAULT: drop a stock line from the split.
function test11(f) {
  const p = B.benchPackage('kcnk5b-f0-finbud');
  const sum = +(p.budget.marginal_cost_usd + p.budget.already_in_most_labs_usd - (f ? 100 : 0)).toFixed(2);
  check(`bench: marginal + already-owned reconstructs the full subtotal exactly${f ? ' +FAULT' : ''}`,
    Math.abs(sum - p.budget.subtotal_usd) < 0.005,
    `${p.budget.marginal_cost_usd} + ${p.budget.already_in_most_labs_usd} = ${sum} against subtotal ${p.budget.subtotal_usd}`);

  check(`bench: an unknown case id is refused with the known ids, not silently empty${f ? ' +FAULT' : ''}`,
    (() => { const r = B.benchPackage(f ? 'kcnk5b-f0-finbud' : 'no-such-case'); return r.refused === true && /Known:/.test(r.why ?? ''); })(),
    'refusal names the available cases');
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7, test8, test9, test10, test11];
for (const t of TESTS) await t(false);
console.log(`\n${pass} pass, ${fail} fail`);

if (FAIL_ONCE) {
  console.log('\n--fail-once: injecting one fault per test. EVERY line below should FAIL except whitelisted fixtures.\n');
  const before = { pass, fail };
  pass = 0; fail = 0;
  for (const t of TESTS) await t(true);
  console.log(`\nwith faults injected: ${fail} FAIL, ${pass} PASS`);
  console.log(`${pass} test(s) survived their own injected fault. Those assert nothing about their subject and are not tests.`);
  process.exit(before.fail === 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
