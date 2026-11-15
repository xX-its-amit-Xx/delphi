#!/usr/bin/env node
// Turn the eight cs-* case runs into *.case.json files the suite gate can judge, then run the gate.
//
//   node tracks/suite/make-cases.mjs          writes tracks/suite/cases/*.case.json, evidence/leak-gate.log, gate-result.json
//
// What is copied and what is judged here, so nobody mistakes one for the other:
//   - Numbers (value, baseline, control outcome, holdout size) are the agent's own, typed in the table
//     below from tracks/research/agents/cs-*.json. Nothing is recomputed here.
//   - Times are NOT the agent's word. prereg.hashed_utc is the last-modified time of the agent's original
//     prereg file, and performance.computed_utc the last-modified time of its final results file
//     (D:/Users/ashenoy00000/delphi-work/agents5/), used only when the committed copy has the same sha256.
//     A file time can be forged, so dated_by stays "self-attested". It still catches a pre-registration
//     that was edited at or after the moment the number was written.
//   - min_n_for_verdict = 10 independent units (species, targets, materials, papers) is a convention set
//     in this script AFTER the runs. It was not pre-registered. It only ever turns a "pass" into an error.
//   - what_was_wrong "kind" is assigned by a keyword rule, not by a reader.
// The exit code is 0 when the files were written. The gate's own verdict is in gate-result.json: cases
// are EXPECTED to fail it where the run did not earn its claim.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'cases');
const ORIG = process.env.DELPHI_AGENTS5 ?? 'D:/Users/ashenoy00000/delphi-work/agents5';
const MIN_N = 10;
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel = (p) => path.relative(OUT, p).split(path.sep).join('/');
const ref = (p) => ({ path: rel(p), sha256: sha(p) });
const utc = (d) => new Date(d).toISOString().replace(/\.\d+Z$/, 'Z');

// slug, files, and the agent's own numbers. lower = true when a smaller metric is better.
const CASES = [
  { slug: 'enhancer-rank', final: 'final_results.json', dev: 'dev_results.json', frozen: '2026-11-14T04:18:00Z',
    metric: 'held-out R2 of the multiplicative enhancer x promoter model', value: 0.835, base: ['promoter-only model, held-out R2', 0.567],
    control: ['enhancer labels shuffled before fitting: R2 fell to 0.565', 'fail'], n: 207, unit: 'enhancers', verdict: 'fail',
    basis: 'The law as stated allows zero rank reversals. 1,051 significant reversals were seen against about 25 expected from noise. The approximate model still explains 83.5% of held-out variance.' },
  { slug: 'binding-affinity', final: 'final_results.json', dev: 'dev_results.json', frozen: '2026-11-14T04:17:57Z',
    metric: 'pooled Pearson r on held-out targets, ligand-only nearest-neighbour model', value: 0.164, base: ['leave-one-out target mean (knows the target, not the compound), r', 0.193],
    control: ['training labels shuffled: r fell from 0.164 to 0.004', 'fail'], n: 14, unit: 'targets', verdict: 'fail',
    basis: 'On targets it has not seen the model is worse than a constant in RMSE and below the target-mean baseline. The same model scores r 0.824 on a random split, which is the leak the case set out to show.' },
  { slug: 'fire-ignition', final: 'results_final.json', dev: 'results_dev.json', frozen: '2026-11-14T04:20:29Z',
    metric: 'RMSE of log10 time to ignition on held-out materials', value: 0.655, lower: true, base: ['flux-scaling-only fit, RMSE', 0.414],
    control: ['thermal inertia shuffled across materials: RMSE rose to 0.839, worse in 98% of 200 permutations', 'fail'], n: 12, unit: 'materials', verdict: 'fail',
    basis: 'As a predictor the law is worse than both baselines. As a one-sided bound it held in 108 of 108 records.' },
  { slug: 'xenobots', final: 'results.json', dev: 'records_dev.csv', frozen: '2026-11-14T04:17:22Z',
    metric: 'fraction of held-out measurements under their bound', value: 0.5, base: ['bound = development maximum, no physics', 0.33],
    control: ['quantity labels rotated by two places: coverage stayed 0.50, it did not get worse', 'pass'], n: 1, unit: 'papers', verdict: 'fail',
    basis: 'The lifetime bound held in 0 of 4 measurements: the held-out bots are fed, so the closed-energy-store assumption is false. The scorer also did not react to scrambled labels.',
    lean: 'cs-xenobots__XenobotBounds.lean', neg: 'cs-xenobots__XenobotNegativeControl.lean' },
  { slug: 'hygromorph-bilayer', final: 'results.json', dev: 'results_table.csv', frozen: '2026-11-14T04:17:26Z',
    metric: 'RMSE of log10(measured / predicted curvature) on held-out records', value: 0.085, lower: true, base: ['ceiling only, 1.5 x strain difference / thickness, RMSE', 0.181],
    control: ['the two labels swapped: RMSE rose to 0.407 (one permutation only)', 'fail'], n: 1, unit: 'papers', verdict: 'underpowered',
    basis: 'Two held-out records from one paper. 9 of 12 development records sit above the strip ceiling of 1.5; all 14 records are under the wide-sheet ceiling of 2.25 (checked after the fact).',
    lean: 'cs-hygromorph-bilayer__HygromorphFalsifier.lean', neg: 'cs-hygromorph-bilayer__HygromorphNegativeControl.lean' },
  { slug: 'crosslink-swelling', final: 'results.json', dev: 'series.csv', frozen: '2026-11-14T04:17:07Z',
    metric: 'fraction of held-out dose series moving in the direction the law says', value: 0.818, base: ['coin flip', 0.5],
    control: ['values shuffled within series, 1000 seeds: mean score 0.499', 'fail'], n: 2, unit: 'papers', verdict: 'underpowered',
    basis: '11 series but 10 come from one paper, and the second held-out material system returned no usable series.',
    lean: 'cs-crosslink-swelling__CrosslinkSwellingWindow.lean', neg: 'cs-crosslink-swelling__CrosslinkSwellingNegativeControl.lean' },
  { slug: 'allometry-fins', final: 'results_final.json', dev: 'results_dev.json', frozen: '2026-11-14T04:17:22Z',
    metric: 'fraction of held-out records with Strouhal number inside 0.2 to 0.4', value: 0.80, base: ['band re-tuned on development data (0.216 to 0.432)', 0.71],
    control: ['tail-beat frequencies shuffled: fraction fell to 0.26', 'fail'], n: 13, unit: 'species', verdict: 'pass',
    basis: '36 of 45 records, 9 species with amplitude data, all 9 species means inside. Larval zebrafish, a separate stratum, sit far outside.',
    lean: 'cs-allometry-fins__StrouhalBainbridge.lean', neg: 'cs-allometry-fins__StrouhalNegativeControl.lean' },
  { slug: 'somite-morphogen', final: 'results.json', dev: 'results.json', frozen: '2026-11-14T04:17:29Z',
    metric: 'mean absolute log10 error of somite size on held-out embryos, nothing fitted', value: 0.126, lower: true, base: ['constant development mean', 0.201],
    control: ['labels shuffled: error rose to 0.333', 'fail'], n: 5, unit: 'embryos', verdict: 'underpowered',
    basis: 'Five embryos from one sheet at one temperature. The morphogen half of the case has 3 held-out records and is not a test.',
    lean: 'cs-somite-morphogen__SomiteMorphogenCase.lean', neg: 'cs-somite-morphogen__SomiteNegativeControl.lean' },
];

const kindOf = (t) => /\bbug\b|was wrong because|fixed by|mis-?read|typo/i.test(t) ? 'bug'
  : /could not|not obtain|abstract only|paywall|no data|not found|missing/i.test(t) ? 'data-gap'
  : /\bn ?= ?\d|too small|underpowered|only (one|two|1|2) /i.test(t) ? 'underpowered'
  : /after the|post-hoc|amend/i.test(t) ? 'post-hoc' : 'assumption-mismatch';

fs.mkdirSync(path.join(OUT, 'evidence'), { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.case.json')) fs.unlinkSync(path.join(OUT, f));

// the repo's leak gate, run now; its output is the holdout evidence for every case
const leak = spawnSync('node', ['holdout/check-leaks.mjs', 'tracks'], { cwd: ROOT, encoding: 'utf8' });
const leakLog = path.join(OUT, 'evidence', 'leak-gate.log');
fs.writeFileSync(leakLog, `command: node holdout/check-leaks.mjs tracks\nexit: ${leak.status}\n${(leak.stdout ?? '') + (leak.stderr ?? '')}`.replace(/\r\n/g, '\n').replace(/(held-out taxa) \([^)]*\)/g, '$1')); // the gate prints the held-out clade's name; it is not copied
const checked = path.join(ROOT, 'tracks/research/lean/CHECKED.txt');
const checkedText = fs.existsSync(checked) ? fs.readFileSync(checked, 'utf8') : '';

// file time of the agent's original, only if the committed copy is byte-identical
function origTime(slug, file) {
  const o = path.join(ORIG, `cs-${slug}`, file), c = path.join(ROOT, 'tracks/research/agent-scripts', `cs-${slug}`, file);
  if (!fs.existsSync(o)) return { t: null, why: 'original file not on this machine' };
  if (sha(o) !== sha(c)) return { t: null, why: 'committed copy differs from the original' };
  return { t: utc(fs.statSync(o).mtime), why: null };
}

for (const k of CASES) {
  const dir = path.join(ROOT, 'tracks/research/agent-scripts', `cs-${k.slug}`);
  const agentFile = path.join(ROOT, 'tracks/research/agents', `cs-${k.slug}.json`);
  const s = JSON.parse(fs.readFileSync(agentFile, 'utf8')).suite;
  const pre = origTime(k.slug, 'prereg.md'), fin = origTime(k.slug, k.final);
  const wrong = String(s.what_was_wrong).split(/(?:^|\s)(?=\d+\.\s)/).map((x) => x.replace(/^\d+\.\s*/, '').trim()).filter((x) => x.length >= 15);
  const not = (reason) => ({ status: 'not_done', reason });
  let lean = not('No Lean file was written for this case in the run; the law is checked against data only.');
  if (k.lean) {
    const lf = path.join(ROOT, 'tracks/research/lean', k.lean);
    const ok = new RegExp(`CHECKED\\s+${k.lean.replace(/[.]/g, '\\.')}`).test(checkedText);
    lean = !ok ? { status: 'failed', reason: `${k.lean} is not listed as CHECKED in tracks/research/lean/CHECKED.txt` } : {
      status: 'done', evidence: ref(checked), lean_file: ref(lf),
      theorems: [...fs.readFileSync(lf, 'utf8').matchAll(/^#print axioms\s+(\S+)/gm)].map((m) => m[1]),
      axioms_allowed: ['propext', 'Classical.choice', 'Quot.sound'], named_hypotheses: [],
      negative_control: k.neg
        ? { description: 'a deliberately false numeric instance of the first theorem; rejection is re-checked by tracks/reproduce.mjs', expected: 'fail', observed: 'fail', evidence: ref(path.join(ROOT, 'tracks/research/lean', k.neg)) }
        : { description: 'no negative-control file was kept in the repo for this case', expected: 'fail', observed: 'not-run' },
    };
  }
  const c = {
    schema_version: '1.0.0', case_id: `cs-${k.slug}`, title: s.case_name, owner_thread: 'tracks (session b0ad0789)', toy: false,
    converted_by: 'tracks/suite/make-cases.mjs; numbers are the agent\'s own, times are file times, see the header of that script',
    stages: {
      statement: { status: 'done', evidence: ref(agentFile), text: String(s.statement).slice(0, 600), source: `tracks/research/agents/cs-${k.slug}.json` },
      lean,
      prereg: pre.t ? { status: 'done', evidence: ref(path.join(dir, 'prereg.md')), hashed_utc: pre.t, dated_by: 'self-attested',
        hashed_utc_source: 'last-modified time of the original prereg file (includes any amendment appended to it)', written_utc_claimed_in_file: k.frozen }
        : { status: 'failed', reason: `no usable time for the pre-registration: ${pre.why}` },
      holdout: { status: 'done', evidence: ref(leakLog), holdout_set: String(s.holdout_set).slice(0, 500), frozen_before_utc: k.frozen,
        frozen_source: 'time written in the prereg header by the agent (self-attested); the split rule is a hash of the unit id, so it cannot be tuned',
        n_holdout: k.n, n_unit: k.unit, min_n_for_verdict: MIN_N, min_n_source: 'convention of make-cases.mjs, set after the runs', leak_gate_exit: leak.status },
      validation: { status: 'done', evidence: ref(path.join(dir, k.dev)), command: `see tracks/research/agent-scripts/cs-${k.slug}/`, data_used: [String(s.data_used ?? '').slice(0, 300)] },
      performance: fin.t ? { status: 'done', evidence: ref(path.join(dir, k.final)), metric: k.metric, value: k.value, lower_is_better: !!k.lower,
        computed_utc: fin.t, computed_utc_source: 'last-modified time of the original final results file', evaluated_on: 'holdout', verdict: k.verdict, verdict_basis: k.basis,
        baseline: { name: k.base[0], value: k.base[1], evidence: ref(path.join(dir, k.final)) },
        broken_input_control: { description: k.control[0], expected: 'fail', observed: k.control[1], evidence: ref(path.join(dir, k.final)) } }
        : { status: 'failed', reason: `no usable time for the final number: ${fin.why}` },
      what_was_wrong: wrong.length ? { status: 'done', evidence: ref(agentFile), kind_assigned_by: 'keyword rule in make-cases.mjs', items: wrong.map((w) => ({ what: w.slice(0, 500), kind: kindOf(w) })) }
        : not('The agent wrote no what-was-wrong text that could be split into items.'),
      nanopub_draft: not('No nanopublication draft is written until a case passes the gate.'),
    },
  };
  // no machine paths in a committed file
  fs.writeFileSync(path.join(OUT, `${k.slug}.case.json`), JSON.stringify(c, null, 1).replace(/[A-Z]:\/Users\/[^/"]+\//g, '<home>/') + '\n');
}

const g = spawnSync('node', [path.join(HERE, 'suite-gate.mjs'), OUT, '--json'], { cwd: ROOT, encoding: 'utf8' });
let parsed = null; try { parsed = JSON.parse(g.stdout); } catch { /* keep raw */ }
if (parsed) for (const r of parsed.results ?? []) r.file = path.basename(r.file); // no machine paths in a committed file
fs.writeFileSync(path.join(OUT, 'gate-result.json'), JSON.stringify({ command: 'node tracks/suite/suite-gate.mjs tracks/suite/cases --json', exit: g.status, min_n_for_verdict: MIN_N, result: parsed ?? g.stdout }, null, 1) + '\n');
console.log(`wrote ${CASES.length} cases to ${path.relative(ROOT, OUT)}; gate exit ${g.status}`);
// --expect: compare the gate's verdict per case with expected.json (case id -> sorted rule ids, [] = pass).
// --record: write expected.json from this run. Use it only after reading why a verdict changed.
const got = Object.fromEntries((parsed?.results ?? []).map((r) => [r.id, [...new Set(r.errors.map((e) => e.rule))].sort()]));
const EXP = path.join(OUT, 'expected.json');
if (process.argv.includes('--record')) fs.writeFileSync(EXP, JSON.stringify(got, null, 1) + '\n');
if (process.argv.includes('--expect')) {
  const want = fs.existsSync(EXP) ? JSON.parse(fs.readFileSync(EXP, 'utf8')) : null;
  const same = want && JSON.stringify(want) === JSON.stringify(got) && Object.keys(got).length === CASES.length;
  console.log(same ? `verdicts match expected.json (${Object.values(got).filter((v) => !v.length).length} pass, ${Object.values(got).filter((v) => v.length).length} fail)` : `MISMATCH with expected.json\n got ${JSON.stringify(got)}\nwant ${JSON.stringify(want)}`);
  if (!same) process.exitCode = 1;
}
const t = spawnSync('node', [path.join(HERE, 'suite-gate.mjs'), OUT], { cwd: ROOT, encoding: 'utf8' });
console.log(t.stdout + t.stderr);
