#!/usr/bin/env node
// Re-run the compiler and require the recorded verdicts. A silent change in EITHER direction fails:
// a cascade that starts passing matters as much as one that starts failing, because the only way a
// cannot-assess becomes an inside is if someone changed what the records are taken to say.
//
//   node tracks/kernel/compile/expect.mjs            compare against expected.json
//   node tracks/kernel/compile/expect.mjs --record    write expected.json from this run
//
// It runs against the committed store on purpose. Every node is content-addressed, so a run that
// decides the same things mints nothing new — and the node count not moving is itself a check that
// the pipeline is deterministic.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const RECORD = process.argv.includes('--record');
const EXPECTED = path.join(HERE, 'expected.json');

const before = countNodes();
const r = spawnSync('node', ['tracks/kernel/compile/compile.mjs', 'tracks/kernel/compile/designs/and2.v', '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 900_000, maxBuffer: 32 * 1024 * 1024 });
if (r.status !== 0) { console.error(`the compiler exited ${r.status}\n${r.stderr ?? ''}`); process.exit(1); }

let got;
try { got = JSON.parse(r.stdout); } catch { console.error(`the compiler did not print a JSON summary:\n${r.stdout.slice(0, 2000)}`); process.exit(1); }
const after = countNodes();

// What is compared: the shape of the answer, not the node ids (which are hashes) or file sizes.
const shape = {
  module: got.module,
  gates: got.gates,
  cascades: got.cascades,
  mapping: got.mapping,
  slots: got.slots,
  tally: got.tally,
  verdicts: got.verdicts.map((v) => ({ law: v.law, label: v.label, result: v.result })),
  artifacts: got.artifacts.map((a) => ({ artifact: a.artifact, built: !!a.minted, refused: a.refused ? a.refused.length : 0, drafts: a.drafts ? a.drafts.length : 0 })),
};

if (RECORD) {
  fs.writeFileSync(EXPECTED, JSON.stringify(shape, null, 1) + '\n');
  console.log(`recorded ${EXPECTED}`);
  process.exit(0);
}

const want = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
const diffs = [];
walk(want, shape, '', diffs);
if (before !== null && after !== null && before !== after) diffs.push(`the store grew from ${before} to ${after} nodes: a run that decides the same things should mint nothing new`);

if (diffs.length) {
  console.log(`MISMATCH (${diffs.length}):`);
  for (const d of diffs) console.log(`  ${d}`);
  process.exit(1);
}
console.log(`${shape.verdicts.length} verdict(s) (${shape.tally.inside} inside, ${shape.tally.outside} outside, ${shape.tally['cannot-assess']} cannot-assess), ${shape.artifacts.filter((a) => a.built).length} artifact(s) built, ${shape.artifacts.filter((a) => a.refused).length} refused, ${shape.slots.filled} of ${shape.slots.total} slots filled: all as recorded`);

function walk(w, g, at, out) {
  if (w === null || typeof w !== 'object') { if (JSON.stringify(w) !== JSON.stringify(g)) out.push(`${at || 'value'}: recorded ${JSON.stringify(w)}, got ${JSON.stringify(g)}`); return; }
  if (Array.isArray(w)) {
    if (!Array.isArray(g) || g.length !== w.length) { out.push(`${at}: recorded ${w.length} item(s), got ${Array.isArray(g) ? g.length : typeof g}`); return; }
    w.forEach((x, i) => walk(x, g[i], `${at}[${i}]`, out));
    return;
  }
  for (const k of Object.keys(w)) walk(w[k], g?.[k], at ? `${at}.${k}` : k, out);
}

function countNodes() {
  const f = path.join(ROOT, 'tracks/kernel/store/nodes.jsonl');
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).length;
}
