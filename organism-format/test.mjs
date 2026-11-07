#!/usr/bin/env node
// Tests for the .organism format.
//
//   node organism-format/test.mjs [--fail-once]
//
// A format is only as honest as its strictest reader, so most of these check that the reader REFUSES
// things - including one that a lenient reader would happily accept and that would quietly turn a guess
// into a fact downstream.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SPEC from './spec.mjs';
import { read, usableFor } from './read.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, 'examples/winged-zebrafish.organism');

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

const example = fs.existsSync(EXAMPLE) ? JSON.parse(fs.readFileSync(EXAMPLE, 'utf8')) : null;
const clone = o => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------------------------------
// TEST 1. The committed example reads cleanly, and its composition is the finding.
// INJECTED FAULT: strip the kind off one value.
function test1(f) {
  if (!example) return check('format: the example reads', false, 'example missing; run organism-format/write.mjs');
  const doc = clone(example);
  // the fault strips the kind off a MEASURED value - deleting it from an unknown leaves `unknown: true`,
  // which is still a complete declaration and would not be caught.
  if (f) {
    const t = doc.phenotype.stages[1].traits;
    const measured = Object.keys(t).find(k => t[k].kind === 'measured');
    delete t[measured].kind;
  }
  const r = read(doc, { source: 'example' });
  check(`format: the committed example reads without refusal or degradation${f ? ' +FAULT' : ''}`,
    r.ok === true, r.summary);

  const k = read(example).values_by_kind;
  check(`format: most of the example is not-established, which is the finding${f ? ' +FAULT' : ''}`,
    !f && k['not-established'] >= 9 && (k.measured ?? 0) <= 3,
    JSON.stringify(k));
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. A value with no kind, no scope, or a measured claim with no source is REFUSED or DEGRADED.
// These three are the whole point of the format.
// INJECTED FAULT: leave the value intact, so nothing can be caught.
function test2(f) {
  const base = clone(example);
  const mk = mutate => { const d = clone(base); mutate(d.phenotype.stages[1].traits); return read(d); };
  // target a REAL value, not an unknown: deleting `kind` from an unknown leaves `unknown: true`, which
  // is still a complete declaration. The first version of this test aimed at an unknown and passed for
  // the wrong reason.
  const target = Object.keys(base.phenotype.stages[1].traits).find(k => base.phenotype.stages[1].traits[k].kind === 'measured');

  const noKind = mk(t => { if (!f) delete t[target].kind; });
  check(`format: a value with no kind is unusable${f ? ' +FAULT' : ''}`,
    noKind.degraded || noKind.refused, `${target}: ${noKind.summary.slice(0, 56)}`);

  // and the hole that test found: an "unknown" that still carries a number
  const smuggled = mk(t => { t['smuggled'] = { v: f ? null : 0.31, unknown: true, why: 'a perfectly adequate reason', scope: 'a proper scope sentence here' }; });
  check(`format: a value marked unknown that still carries a number is caught${f ? ' +FAULT' : ''}`,
    smuggled.degraded || smuggled.refused, smuggled.summary.slice(0, 70));

  const noScope = mk(t => { t['new trait'] = { v: 1, unit: 'mm', kind: 'measured', source: 'x', ...(f ? { scope: 'a proper scope sentence here' } : {}) }; });
  check(`format: a value with no scope is unusable${f ? ' +FAULT' : ''}`,
    noScope.degraded || noScope.refused, noScope.summary.slice(0, 70));

  const measuredNoSource = mk(t => { t['new trait'] = { v: 1, unit: 'mm', kind: 'measured', scope: 'says nothing about anything else at all', ...(f ? { source: 'a real source' } : {}) }; });
  check(`format: a "measured" value with no source is unusable${f ? ' +FAULT' : ''}`,
    measuredNoSource.degraded || measuredNoSource.refused, measuredNoSource.summary.slice(0, 70));
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. The declared-and-unknown value is first class: it needs a reason, and it is counted.
// INJECTED FAULT: give the unknown a reason, so the missing-reason check cannot fire.
function test3(f) {
  const good = SPEC.unknown({ why: 'no fetched source reports this value for a wild-type adult', scope: 'nothing follows about any other axis' });
  check(`format: a well-formed unknown is a value, not an absence${f ? ' +FAULT' : ''}`,
    !f && good.unknown === true && good.v === null && good.kind === 'not-established', JSON.stringify(good).slice(0, 70));

  const bad = SPEC.unknown({ why: f ? 'a perfectly adequate reason goes here' : 'x', scope: 'nothing follows about any other axis' });
  check(`format: an unknown with no reason is rejected at construction${f ? ' +FAULT' : ''}`,
    bad.invalid === true, bad.invalid ? bad.why.slice(0, 60) : 'accepted a reasonless null');

  const d = clone(example);
  d.phenotype.stages[1].traits['bad unknown'] = { v: null, unknown: true, kind: 'not-established', scope: 'a proper scope sentence', ...(f ? { why: 'a proper reason sentence' } : {}) };
  const r = read(d);
  check(`format: the reader catches a reasonless unknown too${f ? ' +FAULT' : ''}`,
    r.degraded || r.refused, r.summary.slice(0, 70));
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. The structural refusals: the four minimum not_established entries, a stage with no
// temperature, and a missing validation block.
// INJECTED FAULT: repair the thing that was broken.
function test4(f) {
  const noNE = clone(example);
  noNE.not_established = f ? noNE.not_established : ['that it is pretty'];
  const r1 = read(noNE);
  check(`format: a file missing the minimum not_established entries is REFUSED${f ? ' +FAULT' : ''}`,
    r1.refused === true && r1.problems.some(p => p.field === 'not_established'), r1.summary.slice(0, 68));

  const noTemp = clone(example);
  if (!f) delete noTemp.phenotype.stages[0].temperature_C;
  const r2 = read(noTemp);
  check(`format: a developmental stage with no temperature is REFUSED${f ? ' +FAULT' : ''}`,
    r2.refused === true && r2.problems.some(p => /temperature/.test(p.field)), r2.summary.slice(0, 68));

  const noVal = clone(example);
  if (!f) delete noVal.validation;
  const r3 = read(noVal);
  check(`format: a file with no validation block is REFUSED, because absence reads as irrelevance${f ? ' +FAULT' : ''}`,
    r3.refused === true && r3.problems.some(p => p.field === 'validation'), r3.summary.slice(0, 68));
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. usableFor is the question the format exists to answer, and the answer for this design is
// uncomfortable: a simulator may use 2 of 15 values.
// INJECTED FAULT: ask for a purpose that does not exist.
function test5(f) {
  const r = read(example);
  const sim = usableFor(r, f ? 'do-whatever' : 'simulate');
  check(`format: a simulator is told which kinds it may not consume${f ? ' +FAULT' : ''}`,
    sim.allowed === true && sim.excluded_kinds.includes('not-established') && sim.excluded_kinds.includes('assumed'),
    sim.allowed ? `excludes ${sim.n_excluded} of ${Object.values(r.values_by_kind).reduce((a, b) => a + b, 0)}` : sim.why);

  const pub = usableFor(r, 'publish_a_number');
  check(`format: publishing a number is restricted to measured values alone${f ? ' +FAULT' : ''}`,
    !f && pub.usable_kinds.length === 1 && pub.usable_kinds[0] === 'measured', JSON.stringify(pub.usable_kinds));

  const render = usableFor(r, 'render');
  check(`format: rendering may use anything except what was never established${f ? ' +FAULT' : ''}`,
    !f && render.usable_kinds.includes('depicted') && render.excluded_kinds.includes('not-established'),
    `render excludes ${render.n_excluded}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. The genome is an edit list, not a genome. A file that inlines a whole assembly is warned about.
// INJECTED FAULT: declare a representation the format does not have.
function test6(f) {
  const d = clone(example);
  if (f) d.genome.representation = 'a-big-fasta';
  const r = read(d);
  check(`format: the example carries an edit list against a named assembly${f ? ' +FAULT' : ''}`,
    !r.refused && d.genome.representation === 'edit-list' && d.genome.assembly === 'GRCz11' && d.genome.edits.length > 0,
    `${d.genome.edits?.length} edit(s) against ${d.genome.assembly}`);

  const noAsm = clone(example);
  if (!f) delete noAsm.genome.assembly;
  const r2 = read(noAsm);
  check(`format: an edit list with no named assembly is REFUSED${f ? ' +FAULT' : ''}`,
    r2.refused === true, r2.summary.slice(0, 60));

  const big = clone(example);
  big.genome.inline_sequences = { chr1: 'A'.repeat(120_000) };
  const r3 = read(big);
  check(`format: a large inline sequence is warned about rather than silently accepted${f ? ' +FAULT' : ''}`,
    !f && r3.warnings.some(w => /inline_sequences/.test(w.field)), `${r3.warnings.length} warning(s)`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. value() refuses at construction, so a bad value never reaches a file.
// INJECTED FAULT: supply the missing piece.
function test7(f) {
  const noKind = SPEC.value({ v: 1, kind: f ? 'measured' : 'vibes', source: 's', scope: 'a proper scope sentence here' });
  check(`format: value() refuses a kind outside the vocabulary${f ? ' +FAULT' : ''}`,
    noKind.invalid === true, noKind.invalid ? noKind.why.slice(0, 56) : 'accepted an invented kind');

  const noScope = SPEC.value({ v: 1, kind: 'measured', source: 's', scope: f ? 'a proper scope sentence here' : 'short' });
  check(`format: value() refuses a scope too short to say anything${f ? ' +FAULT' : ''}`,
    noScope.invalid === true, noScope.invalid ? 'refused' : 'accepted a one-word scope');

  const assumedOk = SPEC.value({ v: 1, kind: 'assumed', scope: 'a proper scope sentence here' });
  check(`format: an ASSUMED value may have no source, and only assumed and depicted may${f ? ' +FAULT' : ''}`,
    !f && !assumedOk.invalid && SPEC.value({ v: 1, kind: 'borrowed', scope: 'a proper scope sentence here' }).invalid === true,
    'assumed passes without a source; borrowed does not');
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7];
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
