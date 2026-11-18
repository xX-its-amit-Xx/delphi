#!/usr/bin/env node
// Compare an independent second reading of a paper with the first one.
//
//   node tracks/watch/second.mjs [--from <folder with watch-second*.json>]
//
// A second reader extracts the same papers from scratch without seeing the first reading. Two records
// "agree" when they carry the same numbers: for a dose series the same quantity and the same list of
// values; for the other laws the same value for every input. Nothing here judges which reader is right.
// The result is written onto each paper in extractions.json as `second_reader`, and the second reading
// itself is kept in tracks/watch/second/ so the comparison can be re-run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const KEEP = path.join(HERE, 'second');
const from = arg('--from');
if (from) { fs.mkdirSync(KEEP, { recursive: true }); for (const f of fs.readdirSync(from).filter((x) => /^watch-second.*\.json$/.test(x))) fs.copyFileSync(path.join(from, f), path.join(KEEP, f)); }
const EXT = path.join(HERE, 'extractions.json');
const ext = JSON.parse(fs.readFileSync(EXT, 'utf8'));
const second = new Map();
for (const f of fs.existsSync(KEEP) ? fs.readdirSync(KEEP).filter((x) => x.endsWith('.json')) : []) for (const p of JSON.parse(fs.readFileSync(path.join(KEEP, f), 'utf8')).papers ?? []) second.set(p.key, p);

const sig = (r) => {
  const i = r.inputs ?? {};
  if (r.law === 'crosslink_direction') return `series|${/modulus/.test(i.quantity ?? '') ? 'modulus' : 'swelling'}|${(i.values ?? []).map(Number).join(',')}`;
  return `${String(r.law).replace(/^bilayer_.*/, 'bilayer')}|${Object.keys(i).sort().filter((k) => typeof i[k] === 'number').map((k) => `${k}=${i[k]}`).join(',')}`;
};
let n = 0;
for (const p of ext.papers) {
  const s = second.get(p.key);
  if (!s) continue;
  n++;
  if (s.outcome !== 'extracted') { p.second_reader = { agree: false, plain: `second reader could not extract (${String(s.outcome).replace(/_/g, ' ')})`, matched: 0, first_only: (p.records ?? []).map((r) => r.label), second_only: [] }; continue; }
  const a = new Map((p.records ?? []).map((r) => [sig(r), r.label])), b = new Map((s.records ?? []).map((r) => [sig(r), r.label]));
  const matched = [...a.keys()].filter((k) => b.has(k)), firstOnly = [...a.keys()].filter((k) => !b.has(k)).map((k) => a.get(k)), secondOnly = [...b.keys()].filter((k) => !a.has(k)).map((k) => b.get(k));
  p.second_reader = { agree: firstOnly.length === 0, matched: matched.length, first_records: a.size, second_records: b.size, first_only: firstOnly, second_only: secondOnly,
    plain: firstOnly.length === 0 ? `second reader agrees on all ${matched.length} records` : `second reader agrees on ${matched.length} of ${a.size} records` };
  console.log(`${p.key}: ${p.second_reader.plain}; the second reader also found ${secondOnly.length} records the first did not`);
  for (const x of firstOnly) console.log(`   first only:  ${x}`);
  for (const x of secondOnly) console.log(`   second only: ${x}`);
}
fs.writeFileSync(EXT, JSON.stringify(ext, null, 1) + '\n');
console.log(`${n} papers have a second reading`);
