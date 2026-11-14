#!/usr/bin/env node
// suite-gate.mjs — refuse a suite case that claims performance it has not earned. No dependencies.
//
//   node suite-gate.mjs <folder>              gate every *.case.json under <folder> (recursive); exit 1 on any error
//   node suite-gate.mjs --make-toy <folder>   write one good and one bad toy case, with evidence files, into <folder>
//   node suite-gate.mjs --fail-once           self-test: break a good case 27 ways; every break must be caught
//   node suite-gate.mjs --fail-once --sabotage P3   switch rule P3 off, then self-test: it MUST report survivors
//   add --json for machine-readable output
//
// The rules (same ids as x-gate-rules in suite-case.schema.json):
//   S1 all eight stages present        S2 status valid, non-done has a reason     S3 done => evidence exists, sha256 matches
//   P1 prereg hashed strictly before the performance number     P2 prereg file unchanged since it was hashed
//   P3 baseline (name, number, evidence)     P4 broken-input control that was run and FAILED
//   P5 a holdout "pass" needs holdout done, leak gate exit 0, n >= minimum     P6 no "pass" on in-sample data
//   P7 holdout frozen before the number     L1 Lean negative control rejected     W1 what_was_wrong filled in
//   N1 nanopub draft unsigned, and only after performance     P0 a number without status done     E1 empty folder     J1 bad JSON
// An empty folder FAILS: a gate that passes when it looked at nothing is a gate that cannot fail.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const STAGES = ['statement', 'lean', 'prereg', 'holdout', 'validation', 'performance', 'what_was_wrong', 'nanopub_draft'];
const STATUS = ['done', 'failed', 'not_done', 'not_applicable'];
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Is this file reference real? Returns null if fine, else the reason.
function fileProblem(ref, base) {
  if (!isObj(ref) || typeof ref.path !== 'string' || typeof ref.sha256 !== 'string') return 'no {path, sha256}';
  const p = path.resolve(base, ref.path);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return `file not found: ${ref.path}`;
  const h = sha(fs.readFileSync(p));
  return h === ref.sha256.toLowerCase() ? null : `sha256 mismatch for ${ref.path} (file is ${h.slice(0, 12)}…, case says ${ref.sha256.slice(0, 12)}…)`;
}
const time = (s) => (typeof s === 'string' && UTC.test(s) ? Date.parse(s) : NaN);

export function checkCase(c, base, off = new Set()) {
  const errors = [], warnings = [];
  const err = (rule, msg) => { if (!off.has(rule)) errors.push({ rule, msg }); };
  if (!isObj(c) || !isObj(c.stages)) { err('S1', 'no "stages" object'); return { errors, warnings }; }
  const st = c.stages;
  if (c.toy) warnings.push({ rule: 'WARN-T1', msg: 'toy case: never count it in a suite total' });

  for (const name of STAGES) {
    const s = st[name];
    if (!isObj(s)) { err('S1', `stage "${name}" is missing (a skipped stage must be written as not_done with a reason)`); continue; }
    if (!STATUS.includes(s.status)) { err('S2', `stage "${name}" has status ${JSON.stringify(s.status)}; allowed: ${STATUS.join(', ')}`); continue; }
    if (s.status !== 'done' && !(typeof s.reason === 'string' && s.reason.trim().length >= 15)) err('S2', `stage "${name}" is ${s.status} without a reason of 15+ characters`);
    if (s.status === 'done') { const why = fileProblem(s.evidence, base); if (why) err('S3', `stage "${name}" evidence: ${why}`); }
  }
  const done = (n) => isObj(st[n]) && st[n].status === 'done';
  const perf = isObj(st.performance) ? st.performance : {}, pre = isObj(st.prereg) ? st.prereg : {}, hold = isObj(st.holdout) ? st.holdout : {};

  if (!done('performance') && (typeof perf.value === 'number' || perf.verdict === 'pass'))
    err('P0', 'performance carries a number or a "pass" but its status is not done: either claim it and face the rules, or remove it');

  if (done('performance')) {
    const tPre = time(pre.hashed_utc), tPerf = time(perf.computed_utc);
    if (!done('prereg')) err('P1', 'performance is claimed but the prereg stage is not done');
    else if (Number.isNaN(tPre) || Number.isNaN(tPerf)) err('P1', `prereg.hashed_utc (${pre.hashed_utc}) and performance.computed_utc (${perf.computed_utc}) must both be UTC like 2026-11-13T09:00:00Z`);
    else if (!(tPre < tPerf)) err('P1', `prereg was hashed at ${pre.hashed_utc}, not before the number computed at ${perf.computed_utc}`);
    if (done('prereg')) {
      const why = fileProblem(pre.evidence, base);
      if (why) err('P2', `the prereg file is not the file that was hashed: ${why}`);
      if (pre.dated_by === 'self-attested' || !pre.dated_by) warnings.push({ rule: 'WARN-D1', msg: 'prereg date is self-attested: nothing outside the case vouches that it came first' });
      else if (!(typeof pre.date_proof === 'string' && pre.date_proof.length >= 7)) err('P1', `prereg.dated_by is ${pre.dated_by} but date_proof is missing`);
    }
    const b = perf.baseline;
    if (!isObj(b)) err('P3', 'performance is claimed with no baseline');
    else {
      if (typeof b.name !== 'string' || !b.name.trim()) err('P3', 'baseline has no name');
      if (typeof b.value !== 'number' || !Number.isFinite(b.value)) err('P3', `baseline value must be a number, got ${JSON.stringify(b.value)}`);
      const why = fileProblem(b.evidence, base); if (why) err('P3', `baseline evidence: ${why}`);
    }
    const k = perf.broken_input_control;
    if (!isObj(k)) err('P4', 'performance is claimed with no broken-input control');
    else {
      if (k.observed !== 'fail') err('P4', `broken-input control observed "${k.observed}"; it must have been run and must have FAILED`);
      const why = fileProblem(k.evidence, base); if (why) err('P4', `broken-input control evidence: ${why}`);
    }
    if (typeof perf.value !== 'number') err('P3', 'performance is done but has no numeric value to compare with the baseline');
    if (perf.verdict === 'pass') {
      if (perf.evaluated_on === 'holdout') {
        if (!done('holdout')) err('P5', 'a pass "on holdout" with the holdout stage not done');
        else {
          if (hold.leak_gate_exit !== 0) err('P5', `leak gate exit is ${JSON.stringify(hold.leak_gate_exit)}, must be 0`);
          if (!(Number.isInteger(hold.n_holdout) && Number.isInteger(hold.min_n_for_verdict) && hold.n_holdout >= hold.min_n_for_verdict))
            err('P5', `holdout n=${hold.n_holdout} is below the minimum for a verdict (${hold.min_n_for_verdict}): say "underpowered", not "pass"`);
        }
      } else if (perf.evaluated_on === 'simulation') {
        warnings.push({ rule: 'WARN-SIM', msg: 'pass is on a simulation of the model, not on real data' });
      } else err('P6', `verdict "pass" with evaluated_on=${JSON.stringify(perf.evaluated_on)}: only a held-out evaluation (or a labelled simulation) may pass`);
    }
    if (done('holdout')) {
      const tF = time(hold.frozen_before_utc);
      if (Number.isNaN(tF) || Number.isNaN(tPerf) || !(tF < tPerf)) err('P7', `holdout frozen at ${hold.frozen_before_utc}, not before the number at ${perf.computed_utc}`);
    }
    const w = st.what_was_wrong;
    if (!done('what_was_wrong') || !Array.isArray(w.items) || w.items.length === 0 || w.items.some((i) => !isObj(i) || typeof i.what !== 'string' || i.what.trim().length < 15))
      err('W1', 'performance is claimed but what_was_wrong is empty (write "none found after search" and what was searched, if so)');
  }
  if (done('lean')) {
    const l = st.lean;
    if (!Array.isArray(l.theorems) || l.theorems.length === 0) err('L1', 'lean is done but names no theorem');
    if (!isObj(l.negative_control) || l.negative_control.observed !== 'fail') err('L1', 'lean is done without a negative control that the kernel rejected');
    else { const why = fileProblem(l.negative_control.evidence, base); if (why) err('L1', `lean negative control evidence: ${why}`); }
  }
  if (done('nanopub_draft')) {
    if (st.nanopub_draft.signed !== false) err('N1', 'nanopub_draft must say signed: false');
    if (!done('performance')) err('N1', 'a nanopub draft exists for a case whose performance stage is not done');
  }
  return { errors, warnings };
}

function findCases(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findCases(p)); else if (e.name.endsWith('.case.json')) out.push(p);
  }
  return out.sort();
}

export function gateFolder(dir, off = new Set()) {
  const results = [];
  if (!fs.existsSync(dir)) return { results, folderErrors: [{ rule: 'E1', msg: `folder not found: ${dir}` }] };
  const files = findCases(dir);
  const folderErrors = files.length === 0 && !off.has('E1') ? [{ rule: 'E1', msg: `no *.case.json under ${dir}: nothing was gated, so nothing passes` }] : [];
  for (const f of files) {
    let c;
    try { c = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { results.push({ file: f, errors: off.has('J1') ? [] : [{ rule: 'J1', msg: `not valid JSON: ${e.message}` }], warnings: [] }); continue; }
    results.push({ file: f, id: c.case_id, ...checkCase(c, path.dirname(f), off) });
  }
  return { results, folderErrors };
}

// ---------- toy cases ----------
function writeToy(dir, { bad = false } = {}) {
  fs.mkdirSync(path.join(dir, 'evidence'), { recursive: true });
  const put = (name, text) => { const p = path.join(dir, 'evidence', name); fs.writeFileSync(p, text); return { path: `evidence/${name}`, sha256: sha(Buffer.from(text)) }; };
  const T = 'TOY FIXTURE, not a result. ';
  const ev = {
    statement: put('statement.md', T + 'Claim: a strip twice as thick bends half as far under the same swelling mismatch. Source quoted here.\n'),
    leanlog: put('lean-check.log', T + 'toy.strip_curvature_bound does not depend on any axioms\nALL CHECKED: no errors, no sorryAx\n'),
    leanneg: put('lean-negative-control.log', T + "'toy.strip_bound_wrong_sign' depends on axioms: [sorryAx]\nFAILED\n"),
    prereg: put('PREREG.md', T + 'Metric: mean absolute error of predicted curvature. Pass: MAE below the baseline MAE by 20% or more on the held-out strips.\n'),
    holdout: put('leak-gate.log', T + 'no held-out item named in 14 files\n'),
    validation: put('results.json', JSON.stringify({ toy: true, mae: 0.11, baseline_mae: 0.3, n: 24 }) + '\n'),
    failonce: put('fail-once.log', T + 'thickness column shuffled: 0 passed, 6 failed\n'),
    baseline: put('baseline.json', JSON.stringify({ toy: true, model: 'predict the training mean', mae: 0.3 }) + '\n'),
    broken: put('broken-input.json', JSON.stringify({ toy: true, input: 'labels permuted', mae: 0.41, verdict: 'fail' }) + '\n'),
    runs: put('RUNS.md', T + 'Run 1: units bug (mm read as m) found by the baseline being better than the model; fixed, rerun kept beside the original.\n'),
    nanopub: put('nanopub-draft.trig', '# ' + T + 'unsigned draft\n'),
  };
  const good = {
    schema_version: '1.0.0', case_id: 'toy-strip-curvature', title: 'TOY: bilayer strip curvature against thickness', owner_thread: 'cs-suite-audit', toy: true,
    stages: {
      statement: { status: 'done', evidence: ev.statement, text: 'A strip twice as thick bends half as far under the same swelling mismatch.', source: 'toy fixture, no real source' },
      lean: { status: 'done', evidence: ev.leanlog, lean_file: ev.leanlog, theorems: ['toy.strip_curvature_bound'], axioms_allowed: ['propext', 'Classical.choice', 'Quot.sound'],
        negative_control: { description: 'the same bound with the inequality reversed', expected: 'fail', observed: 'fail', evidence: ev.leanneg }, named_hypotheses: [] },
      prereg: { status: 'done', evidence: ev.prereg, hashed_utc: '2026-11-10T09:00:00Z', dated_by: 'git-commit', date_proof: '0000000toy', thresholds_named: 1 },
      holdout: { status: 'done', evidence: ev.holdout, holdout_set: 'strips 25 to 48, set aside by serial number before any fit', frozen_before_utc: '2026-11-09T12:00:00Z', n_holdout: 24, min_n_for_verdict: 20, leak_gate_exit: 0 },
      validation: { status: 'done', evidence: ev.validation, command: 'node toy.mjs', data_used: [],
        fail_once: { description: 'thickness column shuffled before the fit', expected: 'fail', observed: 'fail', evidence: ev.failonce } },
      performance: { status: 'done', evidence: ev.validation, metric: 'mean absolute error of curvature (1/mm)', value: 0.11, computed_utc: '2026-11-11T15:30:00Z', evaluated_on: 'holdout', verdict: 'pass',
        baseline: { name: 'predict the training mean', value: 0.3, evidence: ev.baseline },
        broken_input_control: { description: 'thickness labels permuted across strips', expected: 'fail', observed: 'fail', evidence: ev.broken } },
      what_was_wrong: { status: 'done', evidence: ev.runs, items: [{ what: 'units bug: millimetres read as metres in run 1', kind: 'bug', fixed: true }] },
      nanopub_draft: { status: 'done', evidence: ev.nanopub, signed: false, quotable_line: 'TOY: on 24 held-out strips the bound held; this is a fixture, not a finding.' },
    },
  };
  if (!bad) { fs.writeFileSync(path.join(dir, 'good.case.json'), JSON.stringify(good, null, 1) + '\n'); return good; }
  // The bad case is the pattern the audit found in the repo: a number and a "pass", the prereg hashed in the
  // same minute as (here: after) the result, no baseline, a control that was never run, the holdout stage simply absent.
  const b = JSON.parse(JSON.stringify(good));
  b.case_id = 'toy-strip-curvature-overclaimed'; b.title = 'TOY: the same case, overclaimed';
  b.stages.prereg.hashed_utc = '2026-11-11T15:31:00Z'; b.stages.prereg.dated_by = 'self-attested'; delete b.stages.prereg.date_proof;
  delete b.stages.performance.baseline;
  b.stages.performance.broken_input_control.observed = 'not-run';
  delete b.stages.holdout;
  b.stages.what_was_wrong = { status: 'not_applicable', reason: 'all checks passed' };
  fs.writeFileSync(path.join(dir, 'bad.case.json'), JSON.stringify(b, null, 1) + '\n');
  return b;
}

// ---------- self-test: every mutation of the good case must be caught by the rule it targets ----------
function selfTest(off) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-gate-'));
  const M = [
    ['S1', 'delete the holdout stage', (c) => { delete c.stages.holdout; }],
    ['S1', 'delete what_was_wrong', (c) => { delete c.stages.what_was_wrong; }],
    ['S2', 'status "skipped"', (c) => { c.stages.validation.status = 'skipped'; }],
    ['S2', 'not_applicable with no reason', (c) => { c.stages.lean = { status: 'not_applicable' }; }],
    ['S3', 'evidence hash altered', (c) => { c.stages.statement.evidence.sha256 = '0'.repeat(64); }],
    ['S3', 'evidence file missing', (c) => { c.stages.validation.evidence.path = 'evidence/nope.json'; }],
    ['P1', 'prereg hashed after the number', (c) => { c.stages.prereg.hashed_utc = '2026-11-12T00:00:00Z'; }],
    ['P1', 'prereg hashed in the same second', (c) => { c.stages.prereg.hashed_utc = c.stages.performance.computed_utc; }],
    ['P1', 'prereg stage not done', (c) => { c.stages.prereg = { status: 'not_done', reason: 'will be written up later on' }; }],
    ['P1', 'prereg date not a UTC timestamp', (c) => { c.stages.prereg.hashed_utc = 'about 18:25 UTC'; }],
    ['P1', 'git-dated prereg with no commit', (c) => { delete c.stages.prereg.date_proof; }],
    ['P2', 'prereg file edited after hashing', (c, d) => { fs.appendFileSync(path.join(d, 'evidence/PREREG.md'), 'threshold relaxed to 5%\n'); }],
    ['P3', 'no baseline', (c) => { delete c.stages.performance.baseline; }],
    ['P3', 'baseline value is text', (c) => { c.stages.performance.baseline.value = 'n/a'; }],
    ['P3', 'baseline evidence missing', (c) => { c.stages.performance.baseline.evidence.path = 'evidence/gone.json'; }],
    ['P4', 'no broken-input control', (c) => { delete c.stages.performance.broken_input_control; }],
    ['P4', 'broken-input control PASSED', (c) => { c.stages.performance.broken_input_control.observed = 'pass'; }],
    ['P4', 'broken-input control never run', (c) => { c.stages.performance.broken_input_control.observed = 'not-run'; }],
    ['P5', 'pass on holdout, holdout not done', (c) => { c.stages.holdout = { status: 'not_done', reason: 'no held-out data was available' }; }],
    ['P5', 'leak gate exit 1', (c) => { c.stages.holdout.leak_gate_exit = 1; }],
    ['P5', 'holdout smaller than the power minimum', (c) => { c.stages.holdout.n_holdout = 8; }],
    ['P6', 'pass on in-sample data', (c) => { c.stages.performance.evaluated_on = 'in-sample'; }],
    ['P7', 'holdout frozen after the number', (c) => { c.stages.holdout.frozen_before_utc = '2026-11-12T00:00:00Z'; }],
    ['L1', 'Lean negative control accepted', (c) => { c.stages.lean.negative_control.observed = 'pass'; }],
    ['W1', 'what_was_wrong has no items', (c) => { c.stages.what_was_wrong.items = []; }],
    ['N1', 'nanopub draft marked signed', (c) => { c.stages.nanopub_draft.signed = true; }],
    ['P0', 'number kept, status not_done', (c) => { c.stages.performance.status = 'not_done'; c.stages.performance.reason = 'not finished, number is provisional'; c.stages.nanopub_draft = { status: 'not_done', reason: 'waiting for the performance stage' }; }],
  ];
  let survivors = 0;
  const g = path.join(tmp, 'good'); writeToy(g);
  const r0 = gateFolder(g, off);
  const goodOk = r0.results.length === 1 && r0.results[0].errors.length === 0 && r0.folderErrors.length === 0;
  console.log(`  ${goodOk ? 'ok      ' : 'SURVIVOR'} control: the untouched good case passes${goodOk ? '' : '  <- ' + JSON.stringify(r0.results[0]?.errors)}`);
  if (!goodOk) survivors++;
  M.forEach(([rule, what, mutate], i) => {
    const d = path.join(tmp, `m${i}`); const c = writeToy(d); mutate(c, d);
    fs.writeFileSync(path.join(d, 'good.case.json'), JSON.stringify(c));
    const r = gateFolder(d, off).results[0];
    const caught = r.errors.some((e) => e.rule === rule);
    if (!caught) survivors++;
    console.log(`  ${caught ? 'caught  ' : 'SURVIVOR'} ${rule.padEnd(3)} ${what}${caught ? '' : `  <- gate said: ${r.errors.map((e) => e.rule).join(',') || 'PASS'}`}`);
  });
  // two folder-level faults
  const e = path.join(tmp, 'empty'); fs.mkdirSync(e);
  const eCaught = gateFolder(e, off).folderErrors.some((x) => x.rule === 'E1'); if (!eCaught) survivors++;
  console.log(`  ${eCaught ? 'caught  ' : 'SURVIVOR'} E1  empty folder`);
  const j = path.join(tmp, 'json'); fs.mkdirSync(j); fs.writeFileSync(path.join(j, 'x.case.json'), '{ "stages": ');
  const jCaught = gateFolder(j, off).results[0].errors.some((x) => x.rule === 'J1'); if (!jCaught) survivors++;
  console.log(`  ${jCaught ? 'caught  ' : 'SURVIVOR'} J1  truncated JSON`);
  fs.rmSync(tmp, { recursive: true, force: true });
  const n = M.length + 2;
  console.log(`\n--fail-once: ${n - survivors + (goodOk ? 0 : 1)} of ${n} faults caught, ${survivors} survivor(s)${off.size ? `  [rule(s) switched off: ${[...off].join(',')}]` : ''}`);
  console.log(survivors ? 'SELF-TEST FAILED: the gate let a broken case through' : 'no survivors');
  return survivors ? 1 : 0;
}

// ---------- command line ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const a = process.argv.slice(2);
  const opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const off = new Set((opt('--sabotage') ?? '').split(',').filter(Boolean));
  if (a.includes('--fail-once')) process.exit(selfTest(off));
  if (a.includes('--make-toy')) {
    const d = path.resolve(opt('--make-toy')); writeToy(path.join(d, 'good')); writeToy(path.join(d, 'bad'), { bad: true });
    console.log(`wrote ${path.join(d, 'good', 'good.case.json')} and ${path.join(d, 'bad', 'bad.case.json')}`); process.exit(0);
  }
  const dir = a.find((x) => !x.startsWith('--'));
  if (!dir) { console.error('usage: node suite-gate.mjs <folder> | --make-toy <folder> | --fail-once [--sabotage RULE]'); process.exit(2); }
  const { results, folderErrors } = gateFolder(path.resolve(dir));
  if (a.includes('--json')) console.log(JSON.stringify({ folderErrors, results }, null, 1));
  else {
    for (const x of folderErrors) console.log(`FAIL  ${x.rule}  ${x.msg}`);
    for (const r of results) {
      console.log(`${r.errors.length ? 'FAIL' : 'PASS'}  ${path.relative(path.resolve(dir), r.file)}${r.id ? `  (${r.id})` : ''}`);
      for (const x of r.errors) console.log(`      ${x.rule.padEnd(3)} ${x.msg}`);
      for (const x of r.warnings) console.log(`      warn ${x.rule}: ${x.msg}`);
    }
    const bad = results.filter((r) => r.errors.length).length;
    console.log(`\n${results.length} case(s): ${results.length - bad} pass, ${bad} fail${folderErrors.length ? ', folder error' : ''}`);
  }
  process.exit(folderErrors.length || results.some((r) => r.errors.length) ? 1 : 0);
}
