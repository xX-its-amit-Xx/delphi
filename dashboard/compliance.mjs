#!/usr/bin/env node
// Measures whether the roles AGENTS.md specifies actually produced their contracted output files.
// Written after a meta-critique found four role contracts with no artifact anywhere in the repo.
// Every row is counted from the tree; nothing here is asserted.
//   node dashboard/compliance.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sh = c => { try { return execSync(c, { cwd: root, maxBuffer: 1 << 28 }).toString(); } catch { return ''; } };

const walk = (dir, hit, acc = []) => {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (['.git', 'node_modules', '.lake', '__pycache__', 'venv', '.venv'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, hit, acc);
    else if (hit(path.relative(root, p).replace(/\\/g, '/'), e.name)) acc.push(path.relative(root, p).replace(/\\/g, '/'));
  }
  return acc;
};

// The contract each role owes, from AGENTS.md. required=false means the role is explicitly optional or not yet due.
const ROLES = [
  { id: 'A1', name: 'Claim scribe', owes: 'a plain-language headline per claim', match: f => /headline\.json$/.test(f) },
  { id: 'A2', name: 'Source attestor', owes: 'sources.json, and an OpenResearch run id per claim', match: f => /sources\.json$/.test(f),
    extra: () => ({ label: 'OpenResearch runs recorded', n: (sh('git grep -ril "openresearch\\|alphaxiv" -- . ":(exclude)AGENTS.md"').trim().split('\n').filter(Boolean)).length }) },
  { id: 'A3', name: 'Taxon extractor', owes: 'taxa per claim', match: f => /\/taxa\//.test(f) && f.endsWith('.json') },
  { id: 'A4', name: 'Dataset scout', owes: 'candidate datasets per claim', match: f => /\/datasets\//.test(f) && f.endsWith('.json') },
  { id: 'A5', name: 'Inventory keeper', owes: 'one merged taxon inventory', match: f => /^organisms\/merged\/taxa\.json$/.test(f) },
  { id: 'A6', name: 'Scale auditor', owes: 'organisms/scales.json', match: f => /^organisms\/scales\.json$/.test(f) },
  { id: 'A7', name: 'Formalizer', owes: 'model.md per formalized claim', match: f => /claim-tests\/.*\/model\.md$/.test(f) },
  { id: 'A8', name: 'Experimenter', owes: 'a pre-registered result.json', match: f => /claim-tests\/.*\/result\.json$/.test(f) },
  { id: 'A9', name: 'Faithfulness assessor', owes: 'faithfulness.json per data test', match: f => /faithfulness\.json$/.test(f) },
  { id: 'A10', name: 'Publisher', owes: 'nanopub records', match: f => /nanopubs\/.*\.trig$/.test(f) },
  { id: 'A11', name: 'Holdout warden', owes: 'a frozen exam with checksums', match: f => /^holdout\/(exam|split|CHECKSUMS)\.json$/.test(f) },
  { id: 'A12', name: 'Red team', owes: 'verify.json beside what it checked', match: f => /verify\.json$/.test(f) },
  { id: 'A13', name: 'Debate and tournament', owes: 'debates/<claim>/<interpretation>.json', match: f => /^debates\//.test(f), declaredNotBuilt: true }
];

const all = walk(root, () => true);
const rows = ROLES.map(r => {
  const files = all.filter(f => r.match(f));
  return {
    id: r.id, name: r.name, owes: r.owes, files: files.length,
    examples: files.slice(0, 3),
    extra: r.extra ? r.extra() : null,
    declaredNotBuilt: !!r.declaredNotBuilt,
    state: files.length ? 'has output' : (r.declaredNotBuilt ? 'declared, not built' : 'NO OUTPUT')
  };
});

// durability: AGENTS.md's channel table claims files are "durable? yes, versioned". Measure it.
const porcelain = sh('git status --porcelain').trim().split('\n').filter(Boolean);
const untrackedDirs = [...new Set(porcelain.filter(l => l.startsWith('??')).map(l => l.slice(3).split('/')[0]))];
const ahead = +sh('git rev-list --count origin/main..HEAD').trim() || 0;
const behind = +sh('git rev-list --count HEAD..origin/main').trim() || 0;
const pushed = sh('git branch -r --contains HEAD 2>/dev/null').trim().length > 0;

const out = {
  measuredAt: new Date().toISOString(),
  note: 'Counted from the working tree by dashboard/compliance.mjs. A role with no output file did not run, whatever the specification says.',
  roles: rows,
  rolesWithOutput: rows.filter(r => r.files).length,
  rolesWithNoOutput: rows.filter(r => !r.files).map(r => r.id),
  durability: {
    claimInAgentsMd: 'files are "durable? yes, versioned"',
    measured: {
      uncommittedEntries: porcelain.length,
      untrackedTopLevel: untrackedDirs,
      commitsAhead: ahead, commitsBehind: behind,
      anyCommitPushed: pushed
    },
    verdict: porcelain.length || !pushed
      ? 'FALSE as written: work that is uncommitted or unpushed is not durable and not shared'
      : 'holds'
  }
};
fs.writeFileSync(path.join(here, 'public/compliance.json'), JSON.stringify(out, null, 1));
console.log(`compliance.json: ${out.rolesWithOutput}/${rows.length} roles produced their contracted file`);
console.log(`  no output: ${out.rolesWithNoOutput.join(', ') || 'none'}`);
console.log(`  uncommitted entries ${porcelain.length}, untracked top-level: ${untrackedDirs.join(' ') || 'none'}`);
console.log(`  ahead ${ahead}, behind ${behind}, pushed: ${pushed}`);
