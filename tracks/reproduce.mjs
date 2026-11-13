#!/usr/bin/env node
// Re-run every check this work depends on, from the committed files, and print one table.
//
//   node tracks/reproduce.mjs            offline checks (no network, no downloads)
//   node tracks/reproduce.mjs --online   also re-resolve every citation against Crossref/DataCite/arXiv
//   node tracks/reproduce.mjs --only lean,tests
//
// "Everything reproducible" is a promise a script can keep or break, so this is the script. Each row is
// a check that can fail. A row that cannot be run here (no Lean toolchain, no network) is reported as
// SKIPPED with the reason, never as passed. Exit code is 1 if any row FAILED.
//
// What it does NOT reproduce, stated so nobody assumes otherwise:
//   - the agents' literature searches. Their outputs are committed under tracks/research/agents/ with the
//     prompts that produced them (tracks/workflows/); the model's answers to those prompts are not
//     deterministic, so what is reproducible is the CHECKING of what they returned, not the returning.
//   - downloads of third-party data. Each agent recorded URL, date, size and sha256; the files themselves
//     are not committed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLINE = process.argv.includes('--online');
const ONLY = (arg('--only') ?? '').split(',').filter(Boolean);

const rows = [];
function run(group, name, cmd, args, { skipIf = null, expect = null, timeout = 1_500_000 } = {}) {
  if (ONLY.length && !ONLY.includes(group)) return;
  if (skipIf) { rows.push({ group, name, status: 'SKIPPED', why: skipIf }); console.log(`  SKIPPED  ${group.padEnd(9)} ${name}  (${skipIf})`); return; }
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const ok = r.status === 0 && (!expect || expect.test(out));
  const last = out.trim().split('\n').filter(Boolean).slice(-1)[0] ?? '';
  rows.push({ group, name, status: ok ? 'PASSED' : 'FAILED', secs: (Date.now() - t0) / 1000, detail: last.slice(0, 110) });
  console.log(`  ${ok ? 'PASSED ' : 'FAILED '} ${group.padEnd(9)} ${name.padEnd(46)} ${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${last.slice(0, 70)}`);
  if (!ok) console.log(out.split('\n').slice(-12).map((l) => '      | ' + l).join('\n'));
}

const have = (p) => fs.existsSync(path.join(ROOT, p));
const bash = spawnSync('bash', ['--version'], { encoding: 'utf8' }).status === 0;
const lean = fs.existsSync('C:/Temp/elan/bin/lake.exe') || fs.existsSync('C:/Temp/elan/bin/lake');
const py = spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0;

console.log(`reproduce: ${ROOT}\n`);

// 1. the formal claim, checked by the kernel
run('lean', 'Timoshenko ceiling, Lean kernel + axiom audit', 'bash', ['tracks/lean/check.sh'],
  { skipIf: !bash ? 'bash not found' : !lean ? 'no Lean toolchain at C:/Temp/elan' : null, expect: /ALL CHECKED/ });
// every checkable file the research agents produced and the build kept
const allLean = fs.existsSync(path.join(ROOT, 'tracks/research/lean'))
  ? fs.readdirSync(path.join(ROOT, 'tracks/research/lean')).filter((f) => f.endsWith('.lean')).map((f) => `tracks/research/lean/${f}`) : [];
// a negative control is a file that MUST fail; it is checked separately so a pass there is a failure here
const agentLean = allLean.filter((f) => !/NegativeControl/.test(f)), controls = allLean.filter((f) => /NegativeControl/.test(f));
if (agentLean.length) run('lean', `${agentLean.length} agent-written Lean files`, 'bash', ['tracks/lean/check.sh', ...agentLean],
  { skipIf: !bash || !lean ? 'no Lean toolchain' : null, expect: /ALL CHECKED/ });
for (const c of controls) run('lean', `negative control must be REJECTED: ${path.basename(c)}`, 'bash', ['-c', `! bash tracks/lean/check.sh ${c} >/dev/null`],
  { skipIf: !bash || !lean ? 'no Lean toolchain' : null });

// 2. the same claim, numerically and independently
run('numeric', 'Timoshenko ceiling: grid, exact, 4000 climbs', 'python', ['tracks/scripts/check-timoshenko-ceiling.py'],
  { skipIf: py ? null : 'python not found', expect: /the ceiling holds in every check/ });

// 3. the checkers and the models
for (const t of ['tracks/scripts/test-readability.mjs', 'sim-engine/scales/atlas/test-counts.mjs', 'sim-engine/scales/atlas/test-embryo-divisions.mjs',
  'sim-engine/scales/atlas/test-motion.mjs', 'sim-engine/scales/micro/test-division.mjs']) {
  if (!have(t)) continue;
  run('tests', `${path.basename(t)}`, 'node', [t], { expect: /(\d+) passed, 0 failed|0 failed/ });
  run('tests', `${path.basename(t)} --fail-once (no survivors)`, 'node', [t, '--fail-once'], { expect: /0 passed|no survivors/ });
}

// 4. what the law set looks like now, and that the diff tool still works
run('laws', 'law set 1.6.0 -> 1.8.1 diff', 'python', ['tracks/scripts/lawset-diff.py', '1.6.0', '1.8.1'],
  { skipIf: have('lean/registry/lawsets/lawset-1.8.1.json') ? null : 'law set files not present', expect: /ADDED in 1\.8\.1/ });

// 5. the corpus and the bundle are consistent with their sources
run('bundle', 'rebuild tracks bundle from committed inputs', 'node', ['tracks/build.mjs'], { expect: /wrote dashboard/ });

// 6. the holdout
run('holdout', 'leak gate on tracks/', 'node', ['holdout/check-leaks.mjs', 'tracks'], { expect: /no held-out organism named/ });
run('holdout', 'page and bundle scan (files the gate skips)', 'node', ['sim-engine/scales/atlas/holdout-html-scan.mjs'], { expect: /0 hits/ });

// 7. citations, against the live registries
run('online', 'every citation resolves with a matching title', 'python', ['tracks/scripts/verify-dois.py'],
  { skipIf: ONLINE ? null : 'offline run; add --online', expect: /"failed": 0/ });

const c = (s) => rows.filter((r) => r.status === s).length;
console.log(`\n${c('PASSED')} passed, ${c('FAILED')} failed, ${c('SKIPPED')} skipped`);
fs.mkdirSync(path.join(ROOT, 'tracks/research'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tracks/research/reproduce-last-run.json'), JSON.stringify({ ran: new Date().toISOString(), online: ONLINE, rows }, null, 1));
process.exit(c('FAILED') ? 1 : 0);
