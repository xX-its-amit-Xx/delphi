#!/usr/bin/env node
// Split the unread part of the queue into slice files for the readers.
//   node tracks/watch/slice.mjs <out folder> [--n 3] [--max 60]
// Prints the slice paths, one per line. Writes nothing if every queued paper has been read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = process.argv[2];
if (!out || out.startsWith('--')) { console.error('usage: slice.mjs <out folder> [--n 3] [--max 60]'); process.exit(2); }
const queue = fs.readFileSync(path.join(HERE, 'queue.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const EXT = path.join(HERE, 'extractions.json');
const read = new Set(fs.existsSync(EXT) ? JSON.parse(fs.readFileSync(EXT, 'utf8')).papers.map((p) => p.key) : []);
const todo = queue.filter((q) => q.status !== 'seed' && !read.has(q.key)).slice(0, Number(arg('--max', 60)));
if (!todo.length) { console.log('nothing unread'); process.exit(0); }
const n = Math.min(Number(arg('--n', 3)), todo.length);
fs.mkdirSync(out, { recursive: true });
for (let i = 0; i < n; i++) {
  const part = todo.filter((_, j) => j % n === i).map(({ key, usecase, laws, doi, pmcid, arxiv_id, title, open_access }) => ({ key, usecase, laws, doi, pmcid, arxiv_id: arxiv_id ?? null, title, open_access }));
  const f = path.join(out, `slice-${String.fromCharCode(97 + i)}.jsonl`);
  fs.writeFileSync(f, part.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(f.replace(/\\/g, '/'));
}
