#!/usr/bin/env node
// Tests for the kernel, built the way the rest of this repo builds them: a baseline that must pass,
// and then one deliberate fault at a time, every one of which must be caught.
//
//   node tracks/kernel/test-kernel.mjs                 baseline + every injected fault
//   node tracks/kernel/test-kernel.mjs --fail-once      only the faults; a survivor is a failure
//   node tracks/kernel/test-kernel.mjs --with-lean      also run the real Lean checker (slow)
//
// Why faults and not just assertions: a guard that refuses everything passes every "must refuse"
// test. So the baseline has to go through untouched, and each fault has to be caught ALONE, with
// everything else about the input left valid.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Kernel, { Refused, canon, nodeId, incompatible, realLeanCheck, ROOT } from './kernel.mjs';

const FAIL_ONCE = process.argv.includes('--fail-once');
const WITH_LEAN = process.argv.includes('--with-lean');
let passed = 0, failed = 0, survivors = [];
const ok = (cond, what) => { if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${what}`); } };

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-kernel-')), 'nodes.jsonl');

// A Lean checker that does not start Lean. The real one is exercised separately, once.
const fakeLean = (verdict = 'CHECKED', axioms = ['propext', 'Classical.choice', 'Quot.sound']) =>
  () => ({ tool: 'fake', toolchain: 'fake', verdict, detail: null, axioms, audited: 2, at: new Date().toISOString() });

// ---------------------------------------------------------------------------------------------------
// the baseline: a valid evidence -> fact -> law -> verdict -> build chain, which must go through

const GOOD = {
  evidence: { kind: 'doi', ref: '10.1038/nchembio.1411', quote: 'yielding outputs of 16 and 0.1 REU', where: 'Results, modelling the NAND circuit', primary: true },
  factOn: { statement: 'PhlF ON', quantity: 'output_on_REU', value: 16, unit: 'REU', conditions: { host: 'E. coli', strain: 'DH5alpha', medium: 'LB', temperature_C: 37 } },
  factOff: { statement: 'PhlF OFF', quantity: 'output_off_REU', value: 0.1, unit: 'REU', conditions: { host: 'E. coli', strain: 'DH5alpha', medium: 'LB', temperature_C: 37 } },
  factK: { statement: 'threshold', quantity: 'threshold_REU', value: 1.3, unit: 'REU', conditions: { host: 'E. coli', strain: 'DH5alpha', medium: 'LB', temperature_C: 37 } },
  law: { name: 'test_margin', informal: 'the upstream OFF must sit below the downstream threshold and the ON above it', lean_file: 'tracks/kernel/lean/CircuitLaws.lean', lean_decls: ['Delphi.Circuit.margins_pos'] },
};
const MARGIN = {
  requires: ['output_off_REU', 'output_on_REU', 'threshold_REU'],
  apply: (v) => {
    const low = v.threshold_REU - v.output_off_REU, high = v.output_on_REU - v.threshold_REU;
    return { result: low > 0 && high > 0 ? 'inside' : 'outside', detail: `low ${low}, high ${high}` };
  },
};

// Build the chain from a (possibly mutated) copy of GOOD. Returns what happened at each step.
function chain(spec, { leanCheck = fakeLean() } = {}) {
  const K = new Kernel({ file: tmp(), leanCheck });
  const out = { refusals: [] };
  const step = (name, fn) => { try { return (out[name] = fn()); } catch (e) { if (!(e instanceof Refused)) throw e; out.refusals.push({ step: name, because: e.because }); return null; } };
  const ev = step('evidence', () => K.evidence(spec.evidence));
  const facts = [];
  for (const f of ['factOn', 'factOff', 'factK']) {
    const n = step(f, () => K.fact({ ...spec[f], evidence: ev ? [ev.id] : [] }));
    if (n) facts.push(n.id);
  }
  const law = step('law', () => K.law(spec.law));
  const v = law && facts.length ? step('verdict', () => K.verdict({ law: law.id, facts, ...MARGIN })) : null;
  const b = v ? step('build', () => K.build({ artifact: 'test artifact', verdicts: [v.id], emit: () => [] })) : null;
  out.kernel = K;
  out.verdictResult = v?.result ?? null;
  out.built = !!b;
  return out;
}

console.log('kernel tests\n');

if (!FAIL_ONCE) {
  const base = chain(structuredClone(GOOD), { leanCheck: fakeLean() });
  ok(base.refusals.length === 0, `baseline chain refused nothing (got ${JSON.stringify(base.refusals)})`);
  ok(base.verdictResult === 'inside', `baseline verdict is inside (got ${base.verdictResult})`);
  ok(base.built === true, 'baseline artifact was built');
  ok(base.kernel.verify().length === 0, 'baseline store verifies');
  ok(base.kernel.all('evidence').length === 1 && base.kernel.all('fact').length === 3, 'baseline minted 1 evidence and 3 facts');

  // saying the same thing twice is not two facts
  const K2 = new Kernel({ file: tmp(), leanCheck: fakeLean() });
  const e2 = K2.evidence(GOOD.evidence);
  const a = K2.fact({ ...GOOD.factOn, evidence: [e2.id] });
  const b2 = K2.fact({ ...GOOD.factOn, evidence: [e2.id] });
  ok(a.id === b2.id && K2.all('fact').length === 1, 'the same fact minted twice is one node');
  ok(nodeId({ type: 'x', a: 1, at: 'now' }) === nodeId({ type: 'x', a: 1, at: 'later' }), 'the timestamp is not part of a node id');
  ok(canon({ b: 1, a: 2 }) === canon({ a: 2, b: 1 }), 'canonical form is key-order independent');

  // cannot-assess is not a pass
  const K3 = new Kernel({ file: tmp(), leanCheck: fakeLean() });
  const e3 = K3.evidence(GOOD.evidence);
  const f3 = K3.fact({ ...GOOD.factOn, evidence: [e3.id] });
  const l3 = K3.law(GOOD.law);
  const v3 = K3.verdict({ law: l3.id, facts: [f3.id], ...MARGIN });
  ok(v3.result === 'cannot-assess', `a verdict missing two inputs is cannot-assess (got ${v3.result})`);
  let refusedBuild = false;
  try { K3.build({ artifact: 'x', verdicts: [v3.id], emit: () => [] }); } catch (e) { refusedBuild = e instanceof Refused; }
  ok(refusedBuild, 'a build resting on cannot-assess is refused');
  ok(K3.all('refusal').length === 1, 'the refusal was itself recorded as a node');

  if (WITH_LEAN) {
    const real = chain(structuredClone(GOOD), { leanCheck: realLeanCheck });
    ok(real.refusals.length === 0 && real.built, 'the real Lean checker accepts CircuitLaws.lean and the chain builds');
    ok((real.law?.audit?.axioms ?? []).every((a) => ['propext', 'Classical.choice', 'Quot.sound'].includes(a)), 'the audited axioms are the three standard ones');
    const K4 = new Kernel({ file: tmp(), leanCheck: realLeanCheck });
    let why = null;
    try { K4.law({ ...GOOD.law, lean_file: 'tracks/lean/probes/ProbeSorryNoPrint.lean', lean_decls: [] }); } catch (e) { why = e.because; }
    ok(why && why.some((w) => /no "#print axioms" line/.test(w)), `a Lean file with no axiom audit is refused (got ${JSON.stringify(why)})`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------------------------------
// the faults. Each one mutates the baseline in exactly one place and must be caught.

const FAULTS = [
  ['evidence with no quote', (s) => { delete s.evidence.quote; }, (r) => r.refusals.some((x) => x.step === 'evidence' && x.because.some((b) => /no quote/.test(b)))],
  ['evidence with no locator', (s) => { delete s.evidence.where; }, (r) => r.refusals.some((x) => x.step === 'evidence' && x.because.some((b) => /no locator/.test(b)))],
  ['evidence with no reference', (s) => { delete s.evidence.ref; }, (r) => r.refusals.some((x) => x.step === 'evidence')],
  ['evidence of an unknown kind', (s) => { s.evidence.kind = 'hearsay'; }, (r) => r.refusals.some((x) => x.step === 'evidence' && x.because.some((b) => /unknown evidence kind/.test(b)))],
  ['second-hand evidence (a review quoting another paper)', (s) => { s.evidence.primary = false; }, (r) => r.refusals.some((x) => x.step === 'evidence' && x.because.some((b) => /not primary/.test(b)))],
  ['a fact with no unit', (s) => { delete s.factOn.unit; }, (r) => r.refusals.some((x) => x.step === 'factOn' && x.because.some((b) => /no unit/.test(b)))],
  ['a fact with no conditions', (s) => { s.factOn.conditions = {}; }, (r) => r.refusals.some((x) => x.step === 'factOn' && x.because.some((b) => /no conditions/.test(b)))],
  ['a fact whose value is not a number', (s) => { s.factOn.value = 'about sixteen'; }, (r) => r.refusals.some((x) => x.step === 'factOn' && x.because.some((b) => /no finite value/.test(b)))],
  ['a fact whose value is NaN', (s) => { s.factOn.value = NaN; }, (r) => r.refusals.some((x) => x.step === 'factOn')],
  ['a law with no plain-language statement', (s) => { delete s.law.informal; }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /no plain statement/.test(b)))],
  ['a law naming a declaration that is not in the file', (s) => { s.law.lean_decls = ['Delphi.Circuit.not_a_theorem']; }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /is not a theorem/.test(b)))],
  ['a law pointing at a file that does not exist', (s) => { s.law.lean_file = 'tracks/kernel/lean/NoSuchFile.lean'; }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /not found/.test(b)))],
  ['a law with nothing to check at all', (s) => { delete s.law.lean_file; delete s.law.lean_decls; }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /nothing to check/.test(b)))],
  ['inputs measured in different strains', (s) => { s.factK.conditions.strain = 'DH10B'; }, (r) => r.verdictResult === 'cannot-assess' && !r.built],
  ['inputs measured in different media', (s) => { s.factK.conditions.medium = 'M9 + glucose'; }, (r) => r.verdictResult === 'cannot-assess' && !r.built],
  ['inputs measured at different temperatures', (s) => { s.factK.conditions.temperature_C = 30; }, (r) => r.verdictResult === 'cannot-assess' && !r.built],
  ['inputs measured against different reference standards', (s) => { s.factOn.conditions.reference_standard = 'RPU vs J23101'; s.factK.conditions.reference_standard = 'REU vs pJ23101-YFP'; }, (r) => r.verdictResult === 'cannot-assess' && !r.built],
  ['a threshold below the OFF level (no noise margin)', (s) => { s.factK.value = 0.05; }, (r) => r.verdictResult === 'outside' && !r.built],
  ['a threshold above the ON level', (s) => { s.factK.value = 99; }, (r) => r.verdictResult === 'outside' && !r.built],
  ['the Lean kernel rejecting the file', (s) => { s.__lean = fakeLean('REJECTED'); }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /did not accept/.test(b)))],
  ['no Lean toolchain at all (nothing was checked)', (s) => { s.__lean = fakeLean('NO-TOOLCHAIN'); }, (r) => r.refusals.some((x) => x.step === 'law')],
  ['a proof resting on a hand-written axiom', (s) => { s.__lean = fakeLean('CHECKED', ['propext', 'myAssumption']); }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /non-standard axioms/.test(b)))],
  ['a proof resting on sorryAx', (s) => { s.__lean = fakeLean('CHECKED', ['sorryAx']); }, (r) => r.refusals.some((x) => x.step === 'law' && x.because.some((b) => /non-standard axioms/.test(b)))],
];

for (const [name, mutate, caught] of FAULTS) {
  const spec = structuredClone(GOOD);
  mutate(spec);
  const r = chain(spec, { leanCheck: spec.__lean ?? fakeLean() });
  if (caught(r)) { passed++; } else { failed++; survivors.push(name); console.log(`  SURVIVOR  ${name}  -> verdict=${r.verdictResult} built=${r.built} refusals=${JSON.stringify(r.refusals)}`); }
}

// faults in the store itself, which no input check can catch
{
  const file = tmp();
  const K = new Kernel({ file, leanCheck: fakeLean() });
  const e = K.evidence(GOOD.evidence);
  K.fact({ ...GOOD.factOn, evidence: [e.id] });
  K.fact({ ...GOOD.factOff, evidence: [e.id] });

  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const edited = JSON.parse(lines[1]); edited.value = 9999;
  fs.writeFileSync(file, [lines[0], JSON.stringify(edited), lines[2]].join('\n') + '\n');
  const bad = new Kernel({ file, leanCheck: fakeLean() }).verify();
  if (bad.some((p) => /does not match its content/.test(p))) passed++; else { failed++; survivors.push('a number edited in the store after the fact'); console.log('  SURVIVOR  a number edited in the store after the fact'); }

  fs.writeFileSync(file, [lines[0], lines[2]].join('\n') + '\n');
  const broken = new Kernel({ file, leanCheck: fakeLean() }).verify();
  if (broken.some((p) => /chain broken/.test(p))) passed++; else { failed++; survivors.push('a line removed from the middle of the store'); console.log('  SURVIVOR  a line removed from the middle of the store'); }
}

// the condition comparison on its own
{
  const f = (c) => ({ conditions: c });
  if (incompatible([f({ strain: 'DH10B' }), f({ strain: 'DH5alpha' })])) passed++; else { failed++; survivors.push('incompatible() missed two strains'); }
  if (!incompatible([f({ strain: 'DH10B' }), f({ medium: 'LB' })])) passed++; else { failed++; survivors.push('incompatible() complained about a condition only one side states'); }
  if (!incompatible([f({ strain: 'DH10B' }), f({ strain: 'DH10B' })])) passed++; else { failed++; survivors.push('incompatible() complained about two identical conditions'); }
}

console.log(`\n${passed} passed, ${failed} failed, ${FAULTS.length + 5} fault(s) injected, ${survivors.length} survived`);
if (survivors.length) console.log(`survivors: ${survivors.join('; ')}`);
process.exit(failed ? 1 : 0);
