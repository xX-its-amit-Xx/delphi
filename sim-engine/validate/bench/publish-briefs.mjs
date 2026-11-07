#!/usr/bin/env node
// Render every case's partner brief to the dashboard, and REFUSE to publish one that fails its own
// check. A brief is the only artefact in this package a stranger reads without context, so the gate
// between "generated" and "published" is the one place a bad sentence must not get through.
//
//   node sim-engine/validate/bench/publish-briefs.mjs [--out DIR] [--dry]
//
// Writes <id>.html and <id>.md per case plus an index.json. Exits non-zero if any brief violates.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as BR from './brief.mjs';
import * as C from './cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
const OUT = val('out') ?? path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/brief');
const DRY = argv.includes('--dry');

const cases = C.rank();
const index = [];
let violations = 0;

for (const c of cases) {
  const md = BR.brief(c.id);
  const chk = BR.checkBrief(md);
  if (!chk.ok) {
    violations++;
    console.error(`REFUSED  ${c.id}`);
    if (!chk.disclaimer_present) console.error(`    the required disclaimer is missing: ${chk.disclaimer_missing_why}`);
    for (const v of chk.violations) console.error(`    ${v.pattern}\n      ${v.why}`);
    continue;
  }
  console.log(`ok       rank ${c.rank}  ${c.id.padEnd(26)} ${String(md.length).padStart(5)} chars`);
  index.push({
    rank: c.rank, id: c.id, question: c.question,
    months_to_answer: c.months_to_answer ?? null,
    scorable_in_injected_generation: c.scorable_in_injected_generation,
    confidence: c.confidence,
    md_bytes: md.length,
  });
  if (!DRY) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${c.id}.html`), BR.renderHtml(md, { title: `DELPHI brief: ${c.id}` }));
    fs.writeFileSync(path.join(OUT, `${c.id}.md`), md);
  }
}

if (!DRY && !violations) {
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
    what_this_is: BR.WHAT_THIS_IS,
    generated_from: 'sim-engine/validate/bench/brief.mjs, at render time from benchPackage()',
    why_generated: 'a hand-written brief drifts from the package within a week. Every figure here is re-derived, so this cannot be newer or older than the thing it describes.',
    checked_against: `${BR.FORBIDDEN.length} forbidden claim shapes, plus the required disclaimer`,
    cases: index,
  }, null, 1));
}

console.log(`\n${index.length} published, ${violations} refused${DRY ? ' (dry run, nothing written)' : `, to ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`}`);
process.exit(violations ? 1 : 0);
