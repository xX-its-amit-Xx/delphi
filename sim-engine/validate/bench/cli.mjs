#!/usr/bin/env node
// Print a bench package, or write its ordering files.
//
//   node sim-engine/validate/bench/cli.mjs --list
//   node sim-engine/validate/bench/cli.mjs --case kcnk5b-f0-finbud
//   node sim-engine/validate/bench/cli.mjs --case kcnk5b-alf-knockin --json
//   node sim-engine/validate/bench/cli.mjs --case kcnk5b-f0-finbud --out C:/Temp/order
//
// --out writes the portable requisition CSV and one quick-order file per vendor. Nothing is written into
// the repository by default and nothing is ever ordered: these are files for a human to check and submit.
import fs from 'node:fs';
import path from 'node:path';
import * as B from './bench.mjs';
import * as C from './cases.mjs';

const argv = process.argv.slice(2);
const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const money = n => n == null ? '       -' : ('$' + n.toFixed(2)).padStart(10);

if (argv.includes('--list') || (!val('case') && !argv.includes('--json'))) {
  console.log('\nCANDIDATE TESTS, ranked by what a PI trades off: readable in the injected generation, has a');
  console.log('published number to pass or fail against, fewest generations to an answer.\n');
  for (const c of C.rank()) {
    console.log(`  ${c.rank}. ${c.id}`);
    console.log(`     ${c.question}`);
    console.log(`     ${c.confidence} | readout: ${c.readout_stage} | scorable in injected generation: ${c.scorable_in_injected_generation ? 'YES' : 'no'}`);
    if (c.published_expectation?.numbers) console.log(`     expects: ${c.published_expectation.numbers}`);
    else if (c.published_expectation) console.log(`     expects: ${String(c.published_expectation.what).slice(0, 110)}`);
    console.log('');
  }
  console.log('  node sim-engine/validate/bench/cli.mjs --case <id>   for the full package\n');
  if (!val('case')) process.exit(0);
}

const pkg = B.benchPackage(val('case'), {});
if (pkg.refused) { console.error(pkg.why); process.exit(2); }
if (argv.includes('--json')) { console.log(JSON.stringify(pkg, null, 1)); process.exit(0); }

const bar = '='.repeat(100);
console.log(`\n${bar}\n BENCH PACKAGE: ${pkg.case.id}\n ${pkg.case.question}\n${bar}`);
console.log(`\n${pkg.scope}\n`);

console.log('-- WHAT THE LITERATURE ALREADY SAYS THE ANSWER IS ------------------------------------------');
console.log(`  ${pkg.case.published_expectation?.what ?? 'no published expectation'}`);
if (pkg.case.published_expectation?.caveat) console.log(`  CAVEAT: ${pkg.case.published_expectation.caveat}`);

console.log('\n-- CORRECTIONS TO THE EDIT PLAN ------------------------------------------------------------');
for (const a of pkg.allele_corrections) console.log(`  * ${a.id}\n      ${a.consequence}`);
console.log(`\n  ${pkg.knockouts_are_normal.headline}`);

console.log('\n-- CONDITIONS ------------------------------------------------------------------------------');
console.log(`  ${pkg.conditions.design}, ${pkg.conditions.n_arms} arms`);
for (const a of pkg.conditions.arms) console.log(`    ${a.id.padEnd(34)} ${a.value}`);
console.log('  deliberately NOT varied:');
for (const v of pkg.conditions.deliberately_not_varied) console.log(`    ${v.id.padEnd(22)} fixed at ${v.fixed_at}`);

console.log('\n-- CONTROLS --------------------------------------------------------------------------------');
if (pkg.controls.injection_control) {
  console.log(`  injection: ${pkg.controls.injection_control.id} (${pkg.controls.injection_control.penetrance}, ${pkg.controls.injection_control.earliest_stage})`);
  if (pkg.controls.readout_control) console.log(`  readout:   ${pkg.controls.readout_control.id} (${pkg.controls.readout_control.penetrance}, ${pkg.controls.readout_control.earliest_stage})`);
} else {
  console.log(`  ${pkg.controls.why}`);
  for (const c of pkg.controls.the_controls_are_in_the_design_instead ?? []) console.log(`    ${c.id.padEnd(26)} ${c.published_result}  -  ${c.proves}`);
  if (pkg.controls.what_is_still_missing) console.log(`  STILL MISSING: ${pkg.controls.what_is_still_missing}`);
}

console.log('\n-- THE PLAN --------------------------------------------------------------------------------');
console.log(`  route: ${pkg.plan.route} - ${pkg.plan.why}`);
for (const s of pkg.plan.stages) {
  console.log(`    ${String(s.day ?? '').padStart(4)}  ${s.id.padEnd(18)} ${String(s.what).slice(0, 70)}`);
  if (s.gate) console.log(`          GATE: ${s.gate.must_hold} -- else ${s.gate.if_not}`);
}

console.log('\n-- HOW MANY ANIMALS ------------------------------------------------------------------------');
if (pkg.power.powerable) {
  console.log(`  ${pkg.power.n_per_arm_to_use} per arm, and that number counts ${pkg.power.and_now_the_part_that_bites.what_n_counts}`);
  console.log(`    primary      vs ${pkg.power.primary_comparison.label}: n=${pkg.power.primary_comparison.n_per_arm}`);
  console.log(`    specificity  vs ${pkg.power.specificity_comparison.label}: n=${pkg.power.specificity_comparison.n_per_arm}`);
  if (pkg.power.primary_comparison.use_an_exact_test) console.log(`    NOTE: ${pkg.power.primary_comparison.use_an_exact_test_because}`);
  for (const f of pkg.power.and_now_the_part_that_bites.two_unpublished_fractions_sit_between_them) console.log(`    UNPUBLISHED FRACTION: ${f}`);
} else {
  console.log(`  CANNOT BE POWERED YET. ${pkg.power.why}`);
  console.log(`    missing:    ${pkg.power.the_one_missing_quantity}`);
  console.log(`    from:       ${pkg.power.where_it_would_come_from}`);
  if (pkg.power.this_is_a_data_request_not_an_experiment) console.log('    this is a DATA REQUEST, not an experiment');
}

console.log('\n-- WHAT IT CONSUMES ------------------------------------------------------------------------');
console.log(`  ${pkg.consumption.the_shape_of_this_budget}`);

console.log('\n-- BILL OF MATERIALS -----------------------------------------------------------------------');
for (const l of pkg.bill_of_materials) {
  console.log(`  ${money(l.extended_price_usd)}  ${(l.catalogue_number ?? '(custom)').padEnd(14)} ${String(l.vendor).slice(0, 20).padEnd(21)} ${String(l.what).slice(0, 44)}${l.stock_item ? '   [lab stock]' : ''}`);
}

console.log('\n-- BUDGET ----------------------------------------------------------------------------------');
console.log(`  ${pkg.budget.which_number_to_quote}`);
console.log(`\n  ${pkg.budget.read_this_total_as}`);
console.log('\n  NOT included:');
for (const x of pkg.budget.what_is_not_in_this_total) console.log(`    - ${x}`);

console.log('\n-- ORDERING --------------------------------------------------------------------------------');
console.log(`  ${pkg.ordering.no_universal_format}`);
const qo = pkg.ordering.vendor_quick_orders;
console.log(`\n  quick-order files: ${Object.keys(qo.files).join(', ') || 'none'}`);
console.log(`  ${qo.unorderable.length} line(s) cannot go in a vendor file:`);
for (const u of qo.unorderable) console.log(`    - ${String(u.what).slice(0, 48).padEnd(50)} ${u.why}`);

const out = val('out');
if (out) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'requisition.csv'), pkg.ordering.requisition_csv);
  for (const [, f] of Object.entries(qo.files)) fs.writeFileSync(path.join(out, f.filename), f.csv);
  console.log(`\n  written to ${out}: requisition.csv + ${Object.keys(qo.files).length} vendor file(s)`);
}

console.log(`\n${bar}\n ${pkg.what_this_package_is_not}\n${bar}\n`);
