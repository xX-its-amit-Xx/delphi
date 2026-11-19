#!/usr/bin/env node
// Build the public page's data from the kernel store itself, and copy the emitted artifacts next to
// it so a reader can download what the run produced.
//
//   node tracks/kernel/page.mjs
//
// Nothing is written by hand: every number on the page comes from a node in the store, so the page
// cannot drift from what the kernel decided. Machine paths are stripped — the published data names
// repo-relative paths only.

import fs from 'node:fs';
import path from 'node:path';
import Kernel, { ROOT } from './kernel.mjs';

const PUB = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/tracks/kernel');
const OUT = path.join(ROOT, 'tracks/kernel/compile/out');
const K = new Kernel({ file: path.join(ROOT, 'tracks/kernel/store/nodes.jsonl') });
const run = JSON.parse(fs.readFileSync(path.join(OUT, 'last-run.json'), 'utf8'));
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tracks/kernel/compile/parts.json'), 'utf8'));

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// copy the artifacts the run emitted, and the design and laws they came from
fs.mkdirSync(path.join(PUB, 'files'), { recursive: true });
const copied = [];
for (const [src, as] of [
  [path.join(OUT, `${run.module}.gb`), `${run.module}.gb`],
  [path.join(OUT, `${run.module}-golden-gate.opentrons.py`), `${run.module}-golden-gate.opentrons.py`],
  [path.join(OUT, `${run.module}-golden-gate.autoprotocol.json`), `${run.module}-golden-gate.autoprotocol.json`],
  [path.join(OUT, `${run.module}-justification.jsonld`), `${run.module}-justification.jsonld`],
  [path.join(ROOT, 'tracks/kernel/compile/designs/and2.v'), 'and2.v'],
  [path.join(ROOT, 'tracks/kernel/lean/CircuitLaws.lean'), 'CircuitLaws.lean'],
  [path.join(ROOT, 'tracks/kernel/compile/parts.json'), 'parts.json'],
]) {
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(PUB, 'files', as));
  copied.push({ file: as, bytes: fs.statSync(src).size, from: rel(src) });
}
const draftDir = path.join(OUT, 'nanopub-drafts');
const drafts = [];
if (fs.existsSync(draftDir)) {
  fs.mkdirSync(path.join(PUB, 'files', 'nanopub-drafts'), { recursive: true });
  for (const f of fs.readdirSync(draftDir)) {
    fs.copyFileSync(path.join(draftDir, f), path.join(PUB, 'files', 'nanopub-drafts', f));
    drafts.push({ file: `nanopub-drafts/${f}`, bytes: fs.statSync(path.join(draftDir, f)).size });
  }
}

// one trace per refusal: the quotes underneath it
const quoteOf = (factId) => {
  const f = K.get(factId);
  if (!f) return null;
  const ev = (f.evidence ?? []).map((e) => K.get(e)).filter(Boolean)[0];
  return { quantity: f.quantity, value: f.value, unit: f.unit, conditions: f.conditions, doi: ev?.ref ?? null, quote: ev?.quote ?? null, where: ev?.where ?? null };
};

const data = {
  built: new Date().toISOString().slice(0, 10),
  kernel_version: K.all('law')[0]?.kernel ?? null,
  store: K.summary(),
  run: { module: run.module, host: run.host, gates: run.gates, cascades: run.cascades, mapping: run.mapping, slots: run.slots, tally: run.tally, design_file: run.design },
  laws: K.all('law').map((l) => ({
    name: l.name, informal: l.informal, lean_file: l.lean_file, script: l.script,
    verdict: l.audit?.verdict ?? null, toolchain: l.audit?.toolchain ?? null,
    audited: l.audit?.audited ?? null, axioms: l.audit?.axioms ?? [], axioms_are: l.audit?.axioms_are ?? null,
    checked_by: l.lean_file ? 'the Lean kernel, with an axiom audit' : 'a script, not the Lean kernel',
  })),
  verdicts: K.all('verdict').map((v) => ({
    law: v.law_name, label: v.label, result: v.result, detail: v.detail, by: v.by,
    inputs: (v.facts ?? []).map(quoteOf).filter(Boolean),
  })),
  builds: K.all('build').map((b) => ({ artifact: b.artifact, id: b.id, files: (b.emitted ?? []).map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes })) })),
  refusals: K.all('refusal').map((r) => ({ what: r.what, because: r.because })),
  missing_measurements: (run.artifacts.find((a) => a.artifact === 'predictive model')?.drafts ?? []).map((d) => ({ draft: d.split('/').pop() })),
  sources: Object.entries(reg.sources).map(([k, s]) => ({ key: k, doi: s.doi, pmcid: s.pmcid, citation: s.citation, read: s.read, retrieved: s.retrieved })),
  source_defects: reg.known_defects_in_the_sources,
  scope_limit: reg.scope_limit,
  files: copied.map((c) => ({ ...c, from: undefined })).map((c) => ({ file: c.file, bytes: c.bytes })),
  drafts,
};

fs.writeFileSync(path.join(PUB, 'data.json'), JSON.stringify(data, null, 1) + '\n');

// a machine path anywhere in the published data would be a leak of this box's layout
const text = fs.readFileSync(path.join(PUB, 'data.json'), 'utf8');
const bad = text.match(/[A-Z]:\\\\|[A-Z]:\/|\/Users\/|ashenoy/gi);
if (bad) { console.error(`REFUSED to publish: ${bad.length} machine path(s) in data.json (${[...new Set(bad)].join(', ')})`); process.exit(1); }

console.log(`kernel page: ${data.verdicts.length} verdict(s), ${data.laws.length} law(s), ${data.builds.length} build(s), ${data.refusals.length} refusal(s), ${copied.length + drafts.length} file(s) published`);
console.log(`             ${rel(path.join(PUB, 'data.json'))}`);
