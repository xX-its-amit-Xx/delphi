#!/usr/bin/env node
// Copies the comparison's data files next to the sub-dashboard (dashboard/public/t/swarm/) so every number on it
// is read from a file. Run after metrics.mjs. Usage: node swarm/compare/publish.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const dest = path.join(root, 'dashboard', 'public', 't', 'swarm');
fs.mkdirSync(path.join(dest, 'runs'), { recursive: true });
const cp = (from, to) => { if (fs.existsSync(from)) { fs.copyFileSync(from, to); console.log('copied', path.relative(root, to)); } };
cp(path.join(here, 'results.json'), path.join(dest, 'results.json'));
cp(path.join(here, '..', 'metrics.json'), path.join(dest, 'metrics.json'));
cp(path.join(here, '..', 'state.json'), path.join(dest, 'state.json'));
cp(path.join(here, '..', 'PREREG.md'), path.join(dest, 'PREREG.md'));
cp(path.join(here, 'claims.json'), path.join(dest, 'claims.json'));
cp(path.join(here, 'claims2.json'), path.join(dest, 'claims2.json'));
cp(path.join(here, 'results2.json'), path.join(dest, 'results2.json'));
cp(path.join(here, 'prompt2.md'), path.join(dest, 'prompt2.md'));
cp(path.join(here, 'briefs.json'), path.join(dest, 'briefs.json'));
cp(path.join(here, 'DEVIATIONS.md'), path.join(dest, 'DEVIATIONS.md'));
for (const [resFile, runsName] of [['results.json', 'runs'], ['results2.json', 'runs2']]) if (fs.existsSync(path.join(here, resFile))) {
  const r = JSON.parse(fs.readFileSync(path.join(here, resFile), 'utf8'));
  for (const [arm, v] of Object.entries(r.arms)) {
    const rd = path.join(root, v.primary.run_dir); const d = path.join(dest, runsName, arm); fs.mkdirSync(d, { recursive: true });
    cp(path.join(rd, 'log.jsonl'), path.join(d, 'log.jsonl'));
    cp(path.join(rd, 'board.json'), path.join(d, 'board.json'));
    cp(path.join(rd, 'summary.json'), path.join(d, 'summary.json'));
    // the plans themselves, so a reader can open any cell of the matrix
    const pd = path.join(d, 'plans'); fs.mkdirSync(pd, { recursive: true });
    for (const f of fs.readdirSync(path.join(rd, 'plans'))) fs.copyFileSync(path.join(rd, 'plans', f), path.join(pd, f));
    const vd = path.join(d, 'verify'); fs.mkdirSync(vd, { recursive: true });
    for (const f of fs.readdirSync(path.join(rd, 'verify'))) fs.copyFileSync(path.join(rd, 'verify', f), path.join(vd, f));
    const idx = {}; for (const f of fs.readdirSync(path.join(rd, 'verify')).sort()) { const [cid, att] = f.replace('.json', '').split('.'); (idx[cid] ||= []).push(att); }
    fs.writeFileSync(path.join(d, 'index.json'), JSON.stringify(idx, null, 1));
  }
}
console.log('published to', path.relative(root, dest));

// Unsigned nanopub drafts (swarm/nanopubs): TriG files, manifest and README, so reviewers can read them without the repo.
{
  const nd = path.join(root, 'swarm', 'nanopubs'), out = path.join(dest, 'nanopubs');
  if (fs.existsSync(nd)) {
    fs.mkdirSync(path.join(out, 'unsigned'), { recursive: true });
    for (const f of ['manifest.json', 'README.md', 'DECISIONS.md', 'build.mjs', 'check.mjs', 'check-report.json']) cp(path.join(nd, f), path.join(out, f));
    fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
    if (fs.existsSync(path.join(nd, 'evidence'))) for (const f of fs.readdirSync(path.join(nd, 'evidence'))) cp(path.join(nd, 'evidence', f), path.join(out, 'evidence', f));
    for (const f of fs.readdirSync(path.join(nd, 'unsigned'))) if (f.endsWith('.trig')) cp(path.join(nd, 'unsigned', f), path.join(out, 'unsigned', f));
  }
}

// The harness code the concept record points at (swarm/compare/*.mjs, swarm/emperor.mjs), served read-only under /code/.
{
  const out = path.join(dest, 'code'); fs.mkdirSync(out, { recursive: true });
  for (const f of ['run.mjs', 'verify.mjs', 'metrics.mjs', 'publish.mjs', 'figure.mjs']) cp(path.join(here, f), path.join(out, f));
  cp(path.join(root, 'swarm', 'emperor.mjs'), path.join(out, 'emperor.mjs'));
}
