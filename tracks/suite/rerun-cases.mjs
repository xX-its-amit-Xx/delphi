#!/usr/bin/env node
// Re-run the case scripts from the committed copies and compare every number with the committed results.
//
//   node tracks/suite/rerun-cases.mjs [--only xenobots,fire-ignition]
//
// Each case folder is copied to a scratch folder first ($DELPHI_RERUN, default C:/Temp/delphi-sprint/rerun),
// because the scripts write their results next to themselves. The committed files are never written.
// This is a re-execution: same code, same inputs, a second process. It shows the numbers were not typed
// in by hand and are stable. It is NOT an independent replication (different code, different reader).
// A case whose raw download is not on this machine is reported as SKIPPED, never as matched.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'tracks/research/agent-scripts');
const TMP = process.env.DELPHI_RERUN ?? 'C:/Temp/delphi-sprint/rerun';
const RAW = process.env.DELPHI_SPRINT ?? 'C:/Temp/delphi-sprint';
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const TOL = 1e-6;

// slug, command (run inside the scratch copy), result files to compare, raw data that must already exist
const CASES = [
  { slug: 'hygromorph-bilayer', cmd: ['python', ['-I', 'evaluate.py']], files: ['results.json'] },
  { slug: 'crosslink-swelling', cmd: ['python', ['-I', 'evaluate.py']], files: ['results.json'] },
  { slug: 'xenobots', cmd: ['python', ['-I', 'score.py']], files: ['results.json'] },
  { slug: 'fire-ignition', cmd: ['python', ['-I', 'analyze.py', 'final']], files: ['results_final.json'], needs: 'cs-fire-ignition/raw/files/01_Data' },
  { slug: 'somite-morphogen', cmd: ['python', ['-I', 'run.py']], files: ['results.json'], needs: 'cs-somite-morphogen/raw' },
  { slug: 'allometry-fins', cmd: ['python', ['-P', '-E', 'run.py', '--stage', 'all']], files: ['results_dev.json', 'results_final.json'], needs: 'cs-allometry-fins' },
];

// every numeric leaf that differs by more than TOL (relative), every other leaf that differs at all
function diff(a, b, at = '', out = []) {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > TOL * Math.max(1, Math.abs(a), Math.abs(b))) out.push(`${at}: committed ${a}, re-run ${b}`); }
  else if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], at ? `${at}.${k}` : k, out); }
  else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${at}: committed ${JSON.stringify(a)?.slice(0, 60)}, re-run ${JSON.stringify(b)?.slice(0, 60)}`);
  return out;
}
const leaves = (x) => (x && typeof x === 'object' ? Object.values(x).reduce((n, v) => n + leaves(v), 0) : typeof x === 'number' ? 1 : 0);

const rows = [];
for (const k of CASES) {
  if (only && !only.includes(k.slug)) continue;
  const src = path.join(SRC, `cs-${k.slug}`), dst = path.join(TMP, `cs-${k.slug}`);
  if (k.needs && !fs.existsSync(path.join(RAW, k.needs))) { rows.push({ slug: k.slug, status: 'SKIPPED', why: `raw data not on this machine: ${k.needs}` }); continue; }
  fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true });
  for (const f of k.files) fs.rmSync(path.join(dst, f), { force: true }); // the re-run must write them itself
  const r = spawnSync(k.cmd[0], k.cmd[1], { cwd: dst, encoding: 'utf8', timeout: 900_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) { rows.push({ slug: k.slug, status: 'ERROR', why: `${(r.stderr ?? '').trim().split('\n').slice(-2).join(' | ').slice(0, 300)}` }); continue; }
  const diffs = []; let n = 0;
  for (const f of k.files) {
    if (!fs.existsSync(path.join(dst, f))) { diffs.push(`${f}: the re-run did not write it`); continue; }
    const a = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')), b = JSON.parse(fs.readFileSync(path.join(dst, f), 'utf8'));
    n += leaves(a); diffs.push(...diff(a, b).map((d) => `${f} ${d}`));
  }
  rows.push({ slug: k.slug, status: diffs.length ? 'DIFFERS' : 'MATCH', numbers_compared: n, diffs: diffs.slice(0, 12), n_diffs: diffs.length });
}
for (const r of rows) console.log(`${r.status.padEnd(8)} ${r.slug.padEnd(20)} ${r.status === 'MATCH' ? `${r.numbers_compared} numbers identical` : r.why ?? `${r.n_diffs} differ\n   ` + r.diffs.join('\n   ')}`);
fs.writeFileSync(path.join(ROOT, 'tracks/suite/cases/rerun-result.json'), JSON.stringify({ what: 're-execution of committed scripts in a scratch copy; not an independent replication', tolerance_relative: TOL, rows }, null, 1) + '\n');
const bad = rows.filter((r) => r.status === 'DIFFERS' || r.status === 'ERROR').length;
console.log(`\n${rows.filter((r) => r.status === 'MATCH').length} match, ${bad} differ or error, ${rows.filter((r) => r.status === 'SKIPPED').length} skipped`);
process.exit(bad ? 1 : 0);
