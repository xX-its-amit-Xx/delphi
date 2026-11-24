#!/usr/bin/env node
// Tests for the embeddable CLI, built the way the rest of this repo builds them: a baseline that must
// go through untouched, and then one deliberate fault at a time, every one of which must be caught.
//
//   node tracks/kernel/embed/test-embed.mjs              baseline + every injected fault
//   node tracks/kernel/embed/test-embed.mjs --fail-once  only the faults; a survivor is a failure
//
// These drive the real command line in a real temporary project, as a subprocess, because the thing
// being tested is the command line: a guard that holds inside kernel.mjs is no use if the CLI coerces
// a bad input into a good one before it gets there. One of the faults below exists precisely because
// an earlier draft turned "about sixteen" into NaN on its way in.
//
// No Lean toolchain is needed. Every law fault here is one the kernel refuses before it would start a
// prover, which is the point: the file has to ask for its own axioms to be printed, and that is a
// property of the file, not of the proof.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, 'delphi.mjs');
const FAIL_ONCE = process.argv.includes('--fail-once');
let passed = 0, failed = 0;
const survivors = [];

const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log(`  FAIL  ${what}`); } };

// ---------------------------------------------------------------------------------------------------

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-embed-'));
  const run = (...args) => {
    const r = spawnSync(process.execPath, [CLI, ...args.flat()], { cwd: dir, encoding: 'utf8', timeout: 120_000 });
    return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  };
  run('init', '--name', 'testproj');
  return { dir, run };
}

const COND = ['--condition', 'host=E. coli', '--condition', 'strain=DH5alpha', '--condition', 'medium=LB', '--condition', 'temperature_C=37'];

// The baseline chain, as flag lists, so a fault can replace exactly one argument and leave the rest
// valid. Anything a fault wants to change is named here rather than inlined below.
const GOOD = () => ({
  evidence: ['evidence', '--kind', 'doi', '--ref', '10.1038/nchembio.1411',
    '--quote', 'yielding outputs of 16 and 0.1 REU', '--where', 'Results, modelling the NAND circuit'],
  factOn: ['fact', '--statement', 'PhlF ON level', '--quantity', 'output_on_REU', '--value', '16', '--unit', 'REU', ...COND],
  factOff: ['fact', '--statement', 'PhlF OFF level', '--quantity', 'output_off_REU', '--value', '0.1', '--unit', 'REU', ...COND],
  factK: ['fact', '--statement', 'ButR threshold', '--quantity', 'threshold_REU', '--value', '1.3', '--unit', 'REU', ...COND],
  law: ['law', '--name', 'noise_margin', '--informal', 'the upstream OFF level must sit below the downstream threshold and its ON level above it', '--script', 'tools/margins.mjs'],
  verdict: ['verdict', '--requires', 'output_on_REU', '--requires', 'output_off_REU', '--requires', 'threshold_REU',
    '--expr', 'threshold_REU - output_off_REU > 0 && output_on_REU - threshold_REU > 0', '--label', 'PhlF -> ButR'],
  build: ['build', '--artifact', 'the construct'],
});

const idFrom = (out) => (out.match(/\b(k[0-9a-f]{16})\b/) ?? [])[1] ?? null;

// Drive the whole chain. Returns what each step did, so a fault can be checked at the step it belongs
// to rather than only at the end.
function chain(spec, { dir, run } = project()) {
  const r = { steps: {}, dir, run };
  const step = (name, args) => { const x = run(args); r.steps[name] = { ...x, id: idFrom(x.out) }; return r.steps[name]; };
  const ev = step('evidence', spec.evidence);
  const facts = [];
  for (const k of ['factOn', 'factOff', 'factK']) {
    const s = step(k, [...spec[k], ...(ev.id ? ['--evidence', ev.id] : [])]);
    if (s.id) facts.push(s.id);
  }
  const law = step('law', spec.law);
  const v = step('verdict', [...spec.verdict, ...(law.id ? ['--law', law.id] : []), ...facts.flatMap((f) => ['--fact', f])]);
  fs.writeFileSync(path.join(dir, 'out.txt'), 'the artifact\n');
  const b = step('build', [...spec.build, ...(v.id ? ['--verdict', v.id] : []), '--file', 'out.txt']);
  r.verdictResult = (v.out.match(/\b(INSIDE|OUTSIDE|CANNOT-ASSESS)\b/) ?? [])[1] ?? null;
  r.built = b.code === 0 && /^build\s/m.test(b.out);
  r.doctor = run(['doctor']);
  return r;
}

console.log('embedded CLI tests\n');

// ---------------------------------------------------------------------------------------------------
// the baseline

if (!FAIL_ONCE) {
  const P = project();
  const r = chain(GOOD(), P);
  for (const [name, s] of Object.entries(r.steps)) ok(s.code === 0, `baseline ${name} was accepted (exit ${s.code}: ${s.out.trim().split('\n')[0]})`);
  ok(r.verdictResult === 'INSIDE', `baseline verdict is inside (got ${r.verdictResult})`);
  ok(r.built, 'baseline artifact was built');
  ok(r.doctor.code === 0, `baseline doctor is clean (${r.doctor.out.trim()})`);
  ok(P.run(['verify']).code === 0, 'baseline store verifies');

  // init made what it said it made, and the store is plain appended text
  for (const f of ['config.json', 'BEST_PRACTICES.md', 'store/nodes.jsonl', 'graph/index.html', 'graph/graph.json', 'graph/graph.jsonld']) {
    ok(fs.existsSync(path.join(P.dir, '.delphi', f)), `init created .delphi/${f}`);
  }
  const lines = fs.readFileSync(path.join(P.dir, '.delphi/store/nodes.jsonl'), 'utf8').trim().split('\n');
  ok(lines.length === 7 && lines.every((l) => JSON.parse(l).id), `the store is 7 one-object-per-line records — one per call in the chain (got ${lines.length})`);

  // the graph is a serialisation, not a drawing: every edge must be a reference field in a record
  const g = JSON.parse(fs.readFileSync(path.join(P.dir, '.delphi/graph/graph.json'), 'utf8'));
  const byId = new Map(lines.map((l) => JSON.parse(l)).map((n) => [n.id, n]));
  const invented = g.edges.filter((e) => {
    const to = byId.get(e.to);
    const v = to?.[e.field];
    return !(Array.isArray(v) ? v.includes(e.from) : v === e.from);
  });
  ok(invented.length === 0, `every edge in the graph is a field in a record (${invented.length} invented)`);
  ok(g.nodes.length === lines.length, `the graph holds every node (${g.nodes.length} of ${lines.length})`);

  // the graph is private: nothing in it reaches out, and no machine path leaks into it
  const htmlText = fs.readFileSync(path.join(P.dir, '.delphi/graph/index.html'), 'utf8');
  ok(!/https?:\/\/(?!www\.w3\.org|example\.org)/.test(htmlText), 'the generated page loads nothing from the network');
  ok(!/[A-Z]:\\|\/Users\/|AppData/.test(htmlText + JSON.stringify(g)), 'no machine path leaked into the published graph');

  // the best-practice doc describes rules that still exist
  ok(spawnSync(process.execPath, [path.join(HERE, 'best-practices.mjs'), '--check'], { encoding: 'utf8' }).status === 0,
    'every rule in the best-practice doc still has a guard in the kernel');

  // a project is found from a subdirectory, the way git is
  fs.mkdirSync(path.join(P.dir, 'deep', 'deeper'), { recursive: true });
  const fromDeep = spawnSync(process.execPath, [CLI, 'summary'], { cwd: path.join(P.dir, 'deep', 'deeper'), encoding: 'utf8' });
  const deepOut = fromDeep.stdout.replace(/[ 	]+/g, ' ');
  ok(fromDeep.status === 0 && deepOut.includes('nodes 7'), `the store is found from a subdirectory (exit ${fromDeep.status}, out ${JSON.stringify(deepOut.trim())})`);

  console.log('');
}

// ---------------------------------------------------------------------------------------------------
// the faults. Each mutates the baseline in exactly one place.

const drop = (args, flag) => { const i = args.indexOf(flag); return i < 0 ? args : [...args.slice(0, i), ...args.slice(i + 2)]; };
const set = (args, flag, value) => { const i = args.indexOf(flag); return i < 0 ? [...args, flag, value] : args.map((a, j) => (j === i + 1 ? value : a)); };
// --condition is repeatable, so a fault that wants to change one condition has to find it by its key.
// An earlier draft used set() here and silently rewrote the FIRST condition instead, which made the
// fault test pass while testing nothing.
const setCond = (args, key, value) => {
  const i = args.findIndex((a, j) => args[j - 1] === '--condition' && String(a).startsWith(key + '='));
  if (i < 0) throw new Error(`no --condition ${key}= in ${JSON.stringify(args)}`);
  return args.map((a, j) => (j === i ? `${key}=${value}` : a));
};
const refusedAt = (step) => (r) => r.steps[step].code !== 0 && /REFUSED/.test(r.steps[step].out);

const FAULTS = [
  ['evidence with no quote', (s) => { s.evidence = drop(s.evidence, '--quote'); }, refusedAt('evidence')],
  ['evidence with no locator', (s) => { s.evidence = drop(s.evidence, '--where'); }, refusedAt('evidence')],
  ['evidence with no reference', (s) => { s.evidence = drop(s.evidence, '--ref'); }, refusedAt('evidence')],
  ['evidence of an unknown kind', (s) => { s.evidence = set(s.evidence, '--kind', 'hearsay'); }, refusedAt('evidence')],
  ['second-hand evidence (a review quoting another paper)', (s) => { s.evidence = [...s.evidence, '--not-primary']; },
    (r) => refusedAt('evidence')(r) && /not primary/.test(r.steps.evidence.out)],
  ['a fact with no unit', (s) => { s.factOn = drop(s.factOn, '--unit'); }, refusedAt('factOn')],
  ['a fact with no conditions', (s) => { s.factOn = s.factOn.filter((a, i, A) => a !== '--condition' && A[i - 1] !== '--condition'); }, refusedAt('factOn')],
  // the CLI's own fault, not the kernel's: a value that is not a number must arrive as what was typed
  ['a fact whose value is a phrase', (s) => { s.factOn = set(s.factOn, '--value', 'about sixteen'); },
    (r) => refusedAt('factOn')(r) && /about sixteen/.test(r.steps.factOn.out)],
  ['a fact citing a fact as its evidence', (s) => { s.factOff = [...s.factOff, '--evidence', 'kdeadbeefdeadbeef']; }, refusedAt('factOff')],
  ['a law with no plain-language statement', (s) => { s.law = drop(s.law, '--informal'); }, refusedAt('law')],
  ['a law with nothing to check at all', (s) => { s.law = drop(s.law, '--script'); }, refusedAt('law')],
  ['a law pointing at a proof file that does not exist', (s) => { s.law = [...drop(s.law, '--script'), '--lean', 'NoSuchFile.lean']; }, refusedAt('law')],
  ['a verdict with no check at all', (s) => { s.verdict = drop(s.verdict, '--expr'); },
    (r) => r.steps.verdict.code !== 0 && /needs a check/.test(r.steps.verdict.out)],
  ['a verdict whose expression is not a yes or a no', (s) => { s.verdict = set(s.verdict, '--expr', 'output_on_REU'); },
    (r) => r.verdictResult === 'CANNOT-ASSESS' && !r.built],
  ['a verdict whose expression fails', (s) => { s.verdict = set(s.verdict, '--expr', 'nope.nope > 1'); },
    (r) => r.verdictResult === 'CANNOT-ASSESS' && !r.built],
  ['a verdict missing one of the inputs its law requires', (s) => { s.verdict = [...s.verdict, '--requires', 'hill_coefficient']; },
    (r) => r.verdictResult === 'CANNOT-ASSESS' && !r.built && /missing input/.test(r.steps.verdict.out)],
  ['inputs measured in different strains', (s) => { s.factK = setCond(s.factK, 'strain', 'DH10B'); },
    (r) => r.verdictResult === 'CANNOT-ASSESS' && !r.built],
  ['inputs measured in different media', (s) => { s.factK = setCond(s.factK, 'medium', 'M9 + glucose'); },
    (r) => r.verdictResult === 'CANNOT-ASSESS' && !r.built],
  ['a threshold below the OFF level (no noise margin)', (s) => { s.factK = set(s.factK, '--value', '0.05'); },
    (r) => r.verdictResult === 'OUTSIDE' && !r.built],
  ['a build whose verdict could not be assessed', (s) => { s.verdict = [...s.verdict, '--requires', 'hill_coefficient']; },
    (r) => !r.built && /REFUSED/.test(r.steps.build.out) && /refusal is itself a record/.test(r.steps.build.out)],
  ['a build naming a file that was never written', (s) => { s.build = [...s.build, '--file', 'never-written.txt']; },
    (r) => !r.built && /does not exist/.test(r.steps.build.out)],
];

for (const [name, mutate, caught] of FAULTS) {
  const spec = GOOD();
  mutate(spec);
  const r = chain(spec);
  if (caught(r)) passed++;
  else { failed++; survivors.push(name); console.log(`  SURVIVOR  ${name}  -> verdict=${r.verdictResult} built=${r.built}\n            ${JSON.stringify(Object.fromEntries(Object.entries(r.steps).map(([k, s]) => [k, s.code])))}`); }
}

// ---------------------------------------------------------------------------------------------------
// faults no input check can catch: the store, the files, and a stall nobody looked at

function faultCaught(name, fn) {
  if (fn()) passed++;
  else { failed++; survivors.push(name); console.log(`  SURVIVOR  ${name}`); }
}

// an artifact regenerated or edited without a new build
faultCaught('an artifact edited after it was hashed', () => {
  const r = chain(GOOD());
  fs.writeFileSync(path.join(r.dir, 'out.txt'), 'tampered\n');
  const d = r.run(['doctor']);
  return d.code !== 0 && /edited by hand|regenerated/.test(d.out);
});

// a proof file edited after the kernel accepted it. No prover needed: the file is refused for having
// no axiom audit, so this case is built from a law that WAS accepted — a script law has no file, so
// the Lean-file branch is exercised with a file that asks for its axioms and a stubbed checker is not
// available here. Instead: a law whose Lean file has theorems and no `#print axioms` must be refused.
faultCaught('a proof file with no axiom audit', () => {
  const P = project();
  fs.writeFileSync(path.join(P.dir, '.delphi/laws/Margins.lean'),
    'theorem margins_pos (a b : Nat) : a + b = b + a := Nat.add_comm a b\n');
  const r = P.run(['law', '--name', 'm', '--informal', 'addition commutes', '--lean', 'Margins.lean']);
  return r.code !== 0 && /#print axioms/.test(r.out);
});

// a number edited in the store after the fact
faultCaught('a number edited in the store after the fact', () => {
  const r = chain(GOOD());
  const f = path.join(r.dir, '.delphi/store/nodes.jsonl');
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  const n = JSON.parse(lines[1]); n.value = 9999;
  fs.writeFileSync(f, [lines[0], JSON.stringify(n), ...lines.slice(2)].join('\n') + '\n');
  const v = r.run(['verify']);
  return v.code !== 0 && /does not match its content/.test(v.out);
});

// a line removed from the middle of the store
faultCaught('a line removed from the middle of the store', () => {
  const r = chain(GOOD());
  const f = path.join(r.dir, '.delphi/store/nodes.jsonl');
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  fs.writeFileSync(f, [lines[0], ...lines.slice(2)].join('\n') + '\n');
  const v = r.run(['verify']);
  return v.code !== 0 && /chain broken/.test(v.out);
});

// the repair cap: a check that answers nothing twice is not a check to run a third time
faultCaught('two runs that assessed nothing, with nobody asked', () => {
  const spec = GOOD();
  spec.verdict = [...spec.verdict, '--requires', 'hill_coefficient'];
  const r = chain(spec);
  // the same law and label stalling a second time, from a second run
  const law = r.steps.law.id;
  const facts = [r.steps.factOn.id];
  r.run(['verdict', '--law', law, ...facts.flatMap((f) => ['--fact', f]), '--requires', 'hill_coefficient',
    '--expr', 'output_on_REU > 0', '--label', 'PhlF -> ButR', '--note', 'second attempt']);
  const d = r.run(['doctor']);
  return /answered nothing 2 times|ask a person/.test(d.out);
});

// working with no project at all must say so rather than inventing one
faultCaught('a command run outside any project', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-bare-'));
  const r = spawnSync(process.execPath, [CLI, 'summary'], { cwd: dir, encoding: 'utf8' });
  return r.status !== 0 && /no \.delphi/.test(`${r.stdout}${r.stderr}`);
});

// a second init over an existing project must not quietly rewrite it
faultCaught('init run twice without --force', () => {
  const P = project();
  const r = P.run(['init', '--name', 'other']);
  return r.code !== 0 && /already exists/.test(r.out) && JSON.parse(fs.readFileSync(path.join(P.dir, '.delphi/config.json'), 'utf8')).project === 'testproj';
});

console.log(`\n${passed} passed, ${failed} failed, ${FAULTS.length + 7} fault(s) injected, ${survivors.length} survived`);
if (survivors.length) console.log(`survivors: ${survivors.join('; ')}`);
process.exit(failed ? 1 : 0);
