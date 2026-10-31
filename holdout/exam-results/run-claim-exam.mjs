#!/usr/bin/env node
// Runs the held-out exam for one completed claim test, following holdout/EXAM.md.
//
//   node holdout/exam-results/run-claim-exam.mjs claim-tests/<project>/<id> [--python py]
//
// What it does, in order: checks the frozen split, runs the leak check on the test folder, copies the
// folder to a scratch directory (so the builder's committed derived/ files are not touched), runs
// `analysis.py --exam` there, reads derived/summary.json's holdout_aves block, applies the builder's
// own pre-registered rule to the bird rows alone, and writes holdout/exam-results/<project>/<id>/result.json.
// The rule for each test is encoded in RULES below, copied from the builder's result.json prose; the
// builder's minimum sample size is applied unchanged, so a small bird set yields `inconclusive`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RULES } from './rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const python = opt('--python', process.platform === 'win32' ? 'py' : 'python3');
if (!target) { console.error('usage: run-claim-exam.mjs claim-tests/<project>/<id>'); process.exit(2); }
const testDir = path.resolve(root, target);
const rel = path.relative(root, testDir).replace(/\\/g, '/');
const [, project, id] = rel.split('/');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// The builders' pre-registered rules live in rules.mjs (shared with holdout/power-analysis.mjs).
const rule = RULES[id];
if (!rule) { console.error(`no rule encoded for ${id}; add it to RULES from the builder's result.json before running`); process.exit(2); }

// ---- preconditions -----------------------------------------------------------------------------
const verify = spawnSync(process.execPath, [path.join(root, 'holdout/make-split.mjs'), '--verify'], { cwd: root, encoding: 'utf8' });
if (verify.status !== 0) { console.error(verify.stdout); process.exit(1); }
const leaks = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), testDir], { cwd: root, encoding: 'utf8' });
const builder = JSON.parse(fs.readFileSync(path.join(testDir, 'result.json'), 'utf8'));
if (builder.status !== 'complete') { console.error(`builder status is ${builder.status}, not complete; the exam waits`); process.exit(1); }
const sums = JSON.parse(fs.readFileSync(path.join(root, 'holdout/CHECKSUMS.json'), 'utf8'));

// ---- run analysis.py --exam on a scratch copy ----------------------------------------------------
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `delphi-exam-${id}-`));
fs.cpSync(testDir, scratch, { recursive: true });
const t0 = Date.now();
const run = spawnSync(python, ['analysis.py', '--exam'], { cwd: scratch, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (run.status !== 0) { console.error(run.stderr.slice(-2000)); console.error(`analysis.py --exam failed in ${scratch}`); process.exit(1); }
const summary = JSON.parse(fs.readFileSync(path.join(scratch, 'derived/summary.json'), 'utf8'));
const h = summary.holdout_aves;
if (!h) { console.error('summary.json has no holdout_aves block'); process.exit(1); }
const { measured, verdict, reason } = rule.evaluate(h, summary.main || {});

const result = {
  claim_id: builder.claim_id || id,
  builder_result: `${rel}/result.json`,
  builder_verdict: builder.verdict,
  builder_measured: builder.measured,
  exam_clade: 'Aves',
  exam_roster_sha256: sums.outputs['exam.json'].sha256,
  preconditions: { split_verified: true, leak_check_exit: leaks.status, builder_status: builder.status, analysis_sha256: sha256(fs.readFileSync(path.join(testDir, 'analysis.py'))), data_manifest: fs.existsSync(path.join(testDir, 'data/manifest.json')) ? JSON.parse(fs.readFileSync(path.join(testDir, 'data/manifest.json'), 'utf8')) : null },
  command: `${python} analysis.py --exam  (run in a scratch copy of ${rel}; ${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  exam_measured: measured,
  pass_criterion: builder.pass_criterion,
  fail_criterion: builder.fail_criterion,
  exam_verdict: verdict,
  exam_verdict_reason: reason,
  agrees_with_builder: verdict === 'inconclusive' ? null : verdict === builder.verdict,
  bird_rows: h.bird_species || [],
  caveats: [
    'The builder disclosed that the first, pre-gate run of analysis.py printed one aggregate bird number; no model or threshold was changed afterwards (see the builder’s result.json caveats).',
    'The held-out class is small in these public tables, so the builder’s own minimum sample size makes the exam underpowered; the measured values are reported for the record, not as a verdict.'
  ],
  assessor: { kind: 'session', id: 'scienceclaw-93', model: opt('--assessor-model', 'claude-fable-5-1'), date: new Date().toISOString().slice(0, 10), scratch_copy_deleted: true }
};
fs.rmSync(scratch, { recursive: true, force: true });
const outDir = path.join(here, project, id);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'result.json');
if (fs.existsSync(outPath)) { console.error(`${outPath} exists; the exam is run once. Write a new file with a suffix and a stated reason instead.`); process.exit(1); }
fs.writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
console.log(`${id}: builder ${builder.verdict} -> exam on birds ${verdict} (${reason}); measured ${JSON.stringify(measured.value)} n=${measured.n}; wrote ${path.relative(root, outPath)}`);
