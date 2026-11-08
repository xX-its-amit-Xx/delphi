#!/usr/bin/env node
// THE FILES THE GATE DOES NOT READ.
//
//   node sim-engine/scales/atlas/holdout-html-scan.mjs
//
// holdout/check-leaks.mjs is the project's leak gate, and it does not scan dashboard/ or .html files.
// The atlas viewer is a thousand-line .html carrying every sentence the page shows, and its bundle is
// a .json the gate also skips, so both sit outside the gate by construction. This scans them by hand
// against the same roster, and lives here rather than in holdout/ because holdout/ belongs to another
// thread. It does NOT replace check-leaks.mjs: run that on every .mjs, and this on the page and bundle.
//
// ============================== TWO THINGS THIS FILE GOT WRONG FIRST ==============================
//
// 1. IT SCANNED FOR NOTHING. The first version took the roster as
//    `Object.values(split).find(Array.isArray)`, which matched `rule` - five sentences of prose - and
//    then printed a confident summary over ZERO held-out rows. This project has caught one vacuous
//    holdout scan before. So the path is NAMED, and an empty roster is a refusal with exit code 2
//    rather than a pass. Breaking the path on purpose is how that was checked.
//
// 2. IT WROTE THE VOCABULARY IT WAS LOOKING FOR. The second version carried a hand-written list of
//    about fifty common names and body-covering words, to catch terms the roster's scientific names
//    would miss. Running the leak gate on this very file then reported warnings for two of those
//    words - correctly, because the standing rule is that the clade's name, class name and
//    body-covering words appear in NO file. A scanner that breaks the rule it enforces is not a
//    scanner, and allowlisting it would have been worse: allowlist entries are the holdout thread's
//    to make, not this one's.
//
//    So every term comes from the roster and none from here. That is a real loss of coverage - an
//    English common name absent from the roster will not be caught - and the right place to fix it is
//    the roster, which is the holdout thread's file. REPORTED, not patched around.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const split = JSON.parse(readFileSync(`${ROOT}/holdout/split.json`, 'utf8'));

const rows = split.taxa;
if (!Array.isArray(rows) || rows.length < 100) {
  console.log(`REFUSED: split.taxa is not a roster (${Array.isArray(rows) ? rows.length : typeof rows}). A scan with no roster scans for nothing.`);
  process.exit(2);
}
const held = rows.filter((r) => r && r.assignment === 'holdout');
if (!held.length) { console.log('REFUSED: zero held-out rows extracted from split.taxa.'); process.exit(2); }

// Name-bearing fields only. Scanning every string value would sweep in accession numbers and dates and
// turn the scan into noise.
const NAME_FIELDS = ['name', 'slug', 'class', 'order', 'family'];
const terms = new Set();
for (const r of held) {
  for (const k of NAME_FIELDS) {
    const v = r[k];
    if (typeof v === 'string' && v.length > 3) terms.add(v.toLowerCase());
  }
}
if (terms.size < 50) { console.log(`REFUSED: only ${terms.size} terms extracted; the roster shape has changed.`); process.exit(2); }

export const FILES = [
  'dashboard/public/blueprint3d/studio-live/atlas/index.html',
  'dashboard/public/blueprint3d/studio-live/atlas/atlas.json',
  'dashboard/public/blueprint3d/studio-live/embryo/embryo-divisions.json',
  'dashboard/public/blueprint3d/studio-live/embryo/embryo-manifest.json',
  'sim-engine/scales/atlas/counts.json',
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const found = [];
for (const f of FILES) {
  let text;
  try { text = readFileSync(`${ROOT}/${f}`, 'utf8').toLowerCase(); }
  catch { console.log(`MISSING ${f}`); continue; }
  const lines = text.split('\n');
  for (const term of terms) {
    const re = new RegExp(`\\b${esc(term)}\\b`);
    if (!re.test(text)) continue;
    found.push({ file: f, term, line: (lines.find((l) => re.test(l)) ?? '').trim() });
  }
}

console.log(`scanned ${FILES.length} files against ${terms.size} roster terms from ${held.length} held-out rows`);
console.log(`coverage note: the terms are the roster's scientific names, slugs and ranks only. Common names absent from the roster are NOT covered here, deliberately - see the header.`);
console.log(found.length ? `${found.length} HIT(S):` : '0 hits');
for (const f of found) console.log(`  HIT ${f.file} <- "${f.term}" :: ${f.line.slice(0, 140)}`);
process.exit(found.length ? 1 : 0);
