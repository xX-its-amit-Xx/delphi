#!/usr/bin/env node
// Scans the tree for held-out organisms. A hit is not a verdict, it is a question:
// why does a file that should be blind to the held-out clade name one of its organisms?
//
//   node holdout/check-leaks.mjs            # scan every top-level folder except the exam itself and its inputs
//                                           # (EXCLUDED below, each with a reason), plus dashboard/public/t
//   node holdout/check-leaks.mjs <path>...  # scan these files or folders instead
//
// Three signals:
//   strong  scientific name, slug, NCBI taxid or GBIF key of a held-out taxon             -> hit, exit 1 unless allowlisted
//   claim   id of a claim whose inventory organisms are all held out (exam.json, side "holdout") -> hit, exit 1 unless allowlisted
//   weak    class-level words (Aves, bird, avian, AVONET) and ids of claims that mix held-out
//           and training organisms (side "mixed")                                        -> warning only
// Common names (ostrich, moa, pigeon) are not matched; the claim-id signal is what catches a file built on a bird claim
// that never writes a scientific name.
//
// holdout/leak-allowlist.json entries name a `file` or a path `prefix` and a `reason`, and optionally `pattern` (substring the
// line must contain), `taxa` (only these held-out names are tolerated), `claims` (only these claim ids are tolerated) and
// `committed_before` (tolerated only if the file's first git commit predates that time; an uncommitted file never is).
// An entry with neither `taxa` nor `claims` tolerates every signal under its path.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const split = JSON.parse(fs.readFileSync(path.join(root, 'holdout/split.json'), 'utf8'));
const exam = JSON.parse(fs.readFileSync(path.join(root, 'holdout/exam.json'), 'utf8'));
const held = split.taxa.filter(t => t.assignment === 'holdout');
const allowPath = path.join(root, 'holdout/leak-allowlist.json');
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, 'utf8')) : [];

// Not scanned by default, with the reason. Everything else at the top level is.
const EXCLUDED = {
  holdout: 'the exam itself: roster, rules, results and these records',
  organisms: 'the inventory the split is computed from; it names every taxon by construction',
  docs: 'docs/claims.json is an input to make-split.mjs and the claim pages are built from it',
  dashboard: 'site code and build output; the per-thread data copies under dashboard/public/t are scanned',
  node_modules: 'dependencies',
  assets: 'static site assets',
  '.git': 'history',
};
const JSON_OUT = process.argv.includes('--json');
const argPaths = process.argv.slice(2).filter(a => a !== '--json');
const targets = argPaths.length ? argPaths.map(p => path.resolve(p))
  : [...fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && !(d.name in EXCLUDED) && !d.name.startsWith('.')).map(d => path.join(root, d.name)),
    path.join(root, 'dashboard/public/t')].filter(fs.existsSync);
const SKIP = /node_modules|\.git\b|\.lake\b|\/holdout\//;
const EXT = /\.(json|jsonl|py|mjs|js|ts|csv|tsv|txt|md|yaml|yml|ipynb|trig|ttl|nt|nq|lean|toml)$/i;
const walk = p => fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).flatMap(n => walk(path.join(p, n))).filter(f => !SKIP.test(f.replace(/\\/g, '/')))
  : [p];
const files = targets.flatMap(walk).filter(f => EXT.test(f) && fs.statSync(f).size < 5_000_000);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strong = [];
for (const t of held) {
  if (t.rank === 'class') continue; // the class name itself is a weak signal (see `weak`): naming it is how a builder says it filtered it out
  strong.push({ kind: 'taxon', re: new RegExp(`\\b${esc(t.name)}\\b`, 'i'), what: `${t.name} (${t.rank})` });
  if (t.slug && t.slug.includes('-')) strong.push({ kind: 'taxon', re: new RegExp(`\\b${esc(t.slug)}\\b`, 'i'), what: `slug ${t.slug}` });
  if (t.ids.ncbi) strong.push({ kind: 'taxon', re: new RegExp(`(taxid|taxon|ncbi)[^\\n]{0,20}\\b${t.ids.ncbi}\\b`, 'i'), what: `NCBI taxid ${t.ids.ncbi} (${t.name})` });
  if (t.ids.gbif) strong.push({ kind: 'taxon', re: new RegExp(`(gbif|usageKey|taxonKey|taxon_key)[^\\n]{0,20}\\b${t.ids.gbif}\\b`, 'i'), what: `GBIF key ${t.ids.gbif} (${t.name})` });
}
const claimIds = { holdout: [], mixed: [] };
for (const c of exam.claims_mentioning_holdout || []) (claimIds[c.side] ||= []).push(c.id);
for (const id of claimIds.holdout) strong.push({ kind: 'claim', id, re: new RegExp(`\\b${esc(id)}\\b`), what: `claim ${id} (its inventory organisms are all held out)` });
const weak = [{ re: /\bAves\b/, what: 'class name Aves' }, { re: /\bbirds?\b/i, what: 'the word bird' }, { re: /\bavian\b/i, what: 'the word avian' }, { re: /\bAVONET\b/i, what: 'AVONET (a birds-only table)' },
  ...claimIds.mixed.map(id => ({ re: new RegExp(`\\b${esc(id)}\\b`), what: `claim ${id} (mixes held-out and training organisms)` }))];

// First commit of a file, for `committed_before` entries. null when the file is not in git.
const firstCommitCache = new Map();
const firstCommit = rel => {
  if (!firstCommitCache.has(rel)) {
    const r = spawnSync('git', ['-C', root, 'log', '--diff-filter=A', '--format=%aI', '--reverse', '--', rel], { encoding: 'utf8' });
    firstCommitCache.set(rel, ((r.stdout || '').trim().split(/\r?\n/)[0]) || null);
  }
  return firstCommitCache.get(rel);
};
const tolerates = (a, rel, line, p) => {
  if (!(a.file === rel || (a.prefix && rel.startsWith(a.prefix)))) return false;
  if (a.pattern && !line.includes(a.pattern)) return false;
  const scoped = a.taxa || a.claims;
  if (p.kind === 'claim') { if (scoped && !(a.claims || []).includes(p.id)) return false; }
  else if (scoped && !(a.taxa || []).some(n => p.what.toLowerCase().includes(n.toLowerCase()))) return false;
  if (a.committed_before) { const c = firstCommit(rel); if (!c || !(new Date(c) < new Date(a.committed_before))) return false; }
  return true;
};

const hits = [], warns = [];
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of strong) if (p.re.test(line)) {
      const ok = allow.find(a => tolerates(a, rel, line, p));
      (ok ? warns : hits).push({ file: rel, line: i + 1, kind: p.kind, what: p.what, text: line.trim().slice(0, 140), allowed: ok?.reason });
    }
    for (const p of weak) if (p.re.test(line)) warns.push({ file: rel, line: i + 1, kind: 'weak', what: p.what, text: line.trim().slice(0, 140) });
  });
}
const relTargets = targets.map(t => path.relative(root, t).split(path.sep).join('/') || '.');
const signals = { held_out_taxa: held.length, holdout_claim_ids: claimIds.holdout.length, mixed_claim_ids: claimIds.mixed.length };
// Tolerated hits, aggregated per file with the reason, so a reader can see what the allowlist is carrying.
const allowedFiles = {};
for (const w of warns) if (w.allowed) { const a = allowedFiles[w.file] ||= { file: w.file, n: 0, kinds: new Set(), what: new Set(), reason: w.allowed }; a.n++; a.kinds.add(w.kind); a.what.add(w.what.replace(/ \(.*$/, '')); }
const allowedList = Object.values(allowedFiles).map(a => ({ ...a, kinds: [...a.kinds], what: [...a.what].slice(0, 6), what_distinct: a.what.size })).sort((a, b) => b.n - a.n);
if (JSON_OUT) { console.log(JSON.stringify({ scanned_at: new Date().toISOString(), files: files.length, targets: relTargets, excluded: argPaths.length ? null : EXCLUDED, signals, clade: split.clade, hits, warns: warns.length, allowed: warns.filter(w => w.allowed).length, allowed_files: allowedList, allowlist_entries: allow.length })); process.exit(hits.length ? 1 : 0); }
console.log(`scanned ${files.length} files under ${relTargets.join(', ')} for ${held.length} held-out taxa (${split.clade}) and ${claimIds.holdout.length} claim ids whose organisms are all held out`);
if (!argPaths.length) console.log(`not scanned: ${Object.entries(EXCLUDED).map(([k, v]) => `${k} (${v})`).join('; ')}`);
for (const h of hits) console.log(`LEAK  ${h.file}:${h.line}  ${h.what}\n      ${h.text}`);
for (const w of warns) console.log(`warn  ${w.file}:${w.line}  ${w.what}${w.allowed ? ` (allowed: ${w.allowed})` : ''}\n      ${w.text}`);
console.log(hits.length ? `${hits.length} possible leak(s); add a justified entry to holdout/leak-allowlist.json only if the file filters the clade out.` : `no held-out organism named; ${warns.length} warning(s), of which ${warns.filter(w => w.allowed).length} allowlisted with a reason.`);
process.exit(hits.length ? 1 : 0);
