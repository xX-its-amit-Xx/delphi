#!/usr/bin/env node
// Scans the builders' folders for held-out organisms. A hit is not a verdict, it is a question:
// why does a file that should be blind to the held-out clade name one of its organisms?
//
//   node holdout/check-leaks.mjs            # scan claim-tests/, organism-design/, swarm/ (whatever exists)
//   node holdout/check-leaks.mjs <path>...  # scan these files or folders instead
//
// Exit 1 when a scientific name, slug or identifier of a held-out taxon appears outside
// holdout/leak-allowlist.json. An allowlist entry names a `file` or a path `prefix`, a `reason`, and
// optionally `pattern` (substring the line must contain) and `taxa` (only these held-out names are tolerated). Class-level words (Aves, bird, avian) are reported as warnings only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const split = JSON.parse(fs.readFileSync(path.join(root, 'holdout/split.json'), 'utf8'));
const held = split.taxa.filter(t => t.assignment === 'holdout');
const allowPath = path.join(root, 'holdout/leak-allowlist.json');
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, 'utf8')) : [];

const JSON_OUT = process.argv.includes('--json');
const argPaths = process.argv.slice(2).filter(a => a !== '--json');
const targets = argPaths.length ? argPaths.map(p => path.resolve(p))
  : ['claim-tests', 'organism-design', 'swarm'].map(d => path.join(root, d)).filter(fs.existsSync);
const SKIP = /node_modules|\.git|\/holdout\//;
const EXT = /\.(json|py|mjs|js|ts|csv|tsv|txt|md|yaml|yml|ipynb)$/i;
const walk = p => fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).flatMap(n => walk(path.join(p, n))).filter(f => !SKIP.test(f.replace(/\\/g, '/')))
  : [p];
const files = targets.flatMap(walk).filter(f => EXT.test(f) && fs.statSync(f).size < 5_000_000);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strong = [];
for (const t of held) {
  if (t.rank === 'class') continue; // the class name itself is a weak signal (see `weak`): naming it is how a builder says it filtered it out
  strong.push({ re: new RegExp(`\\b${esc(t.name)}\\b`, 'i'), what: `${t.name} (${t.rank})` });
  if (t.slug && t.slug.includes('-')) strong.push({ re: new RegExp(`\\b${esc(t.slug)}\\b`, 'i'), what: `slug ${t.slug}` });
  if (t.ids.ncbi) strong.push({ re: new RegExp(`(taxid|taxon|ncbi)[^\\n]{0,20}\\b${t.ids.ncbi}\\b`, 'i'), what: `NCBI taxid ${t.ids.ncbi} (${t.name})` });
  if (t.ids.gbif) strong.push({ re: new RegExp(`(gbif|usageKey|taxonKey|taxon_key)[^\\n]{0,20}\\b${t.ids.gbif}\\b`, 'i'), what: `GBIF key ${t.ids.gbif} (${t.name})` });
}
const weak = [{ re: /\bAves\b/, what: 'class name Aves' }, { re: /\bbirds?\b/i, what: 'the word bird' }, { re: /\bavian\b/i, what: 'the word avian' }, { re: /\bAVONET\b/i, what: 'AVONET (a birds-only table)' }];

const hits = [], warns = [];
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of strong) if (p.re.test(line)) {
      const ok = allow.find(a => (a.file === rel || (a.prefix && rel.startsWith(a.prefix))) && (!a.pattern || line.includes(a.pattern)) && (!a.taxa || a.taxa.some(n => p.what.toLowerCase().includes(n.toLowerCase()))));
      (ok ? warns : hits).push({ file: rel, line: i + 1, what: p.what, text: line.trim().slice(0, 140), allowed: ok?.reason });
    }
    for (const p of weak) if (p.re.test(line)) warns.push({ file: rel, line: i + 1, what: p.what, text: line.trim().slice(0, 140) });
  });
}
if (JSON_OUT) { console.log(JSON.stringify({ scanned_at: new Date().toISOString(), files: files.length, targets: targets.map(t => path.relative(root, t).split(path.sep).join('/')), clade: split.clade, hits, warns: warns.length })); process.exit(hits.length ? 1 : 0); }
console.log(`scanned ${files.length} files under ${targets.map(t => path.relative(root, t) || '.').join(', ')} for ${held.length} held-out taxa (${split.clade})`);
for (const h of hits) console.log(`LEAK  ${h.file}:${h.line}  ${h.what}\n      ${h.text}`);
for (const w of warns) console.log(`warn  ${w.file}:${w.line}  ${w.what}${w.allowed ? ` (allowed: ${w.allowed})` : ''}\n      ${w.text}`);
console.log(hits.length ? `${hits.length} possible leak(s); add a justified entry to holdout/leak-allowlist.json only if the file filters the clade out.` : `no held-out organism named; ${warns.length} warning(s).`);
process.exit(hits.length ? 1 : 0);
