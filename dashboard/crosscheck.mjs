#!/usr/bin/env node
// Compares this tree's claim tests against the collaborator's (origin/main, Joel Dietz's Cursor-agent swarm)
// for the claims BOTH swarms tested independently. Writes dashboard/public/crosscheck.json.
//
// This is the cross-check the project needs most: two independent agent swarms, same claims, different
// operationalisations. Agreement is evidence; disagreement is a finding, and we report which it is.
//   git fetch origin && node dashboard/crosscheck.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const git = a => execSync(`git -C "${root}" ${a}`, { maxBuffer: 1 << 28 }).toString();
const show = (ref, p) => { try { return JSON.parse(git(`show ${ref}:${p}`)); } catch { return null; } };
const list = ref => git(`ls-tree -r --name-only ${ref}`).split(/\r?\n/)
  .filter(l => /^claim-tests\/.+\/result\.json$/.test(l));

const ours = list('HEAD'), theirs = list('origin/main');
const id = p => p.replace(/^claim-tests\//, '').replace(/\/result\.json$/, '');
const ourIds = new Set(ours.map(id)), theirIds = new Set(theirs.map(id));
const both = [...ourIds].filter(x => theirIds.has(x)).sort();

const norm = v => {
  const s = String(v ?? '').toLowerCase();
  if (/^support/.test(s)) return 'supports';
  if (/^refut/.test(s)) return 'refutes';
  if (/^mixed|partial/.test(s)) return 'mixed';
  if (/inconclusive/.test(s)) return 'inconclusive';
  return s || 'unknown';
};
const brief = d => d ? {
  verdict: norm(d.verdict),
  hypothesis: (d.hypothesis || '').slice(0, 300),
  passCriterion: (d.pass_criterion || '').slice(0, 400),
  measured: d.measured ? {
    value: d.measured.value, unit: (d.measured.unit || '').slice(0, 220),
    n: d.measured.n, uncertainty: (d.measured.uncertainty || '').slice(0, 200)
  } : null,
  datasets: (d.datasets || []).map(x => x.id || x.name).filter(Boolean).slice(0, 4),
  agent: typeof d.agent === 'string' ? d.agent : (d.agent?.name || null)
} : null;

const comparisons = both.map(k => {
  const a = brief(show('HEAD', `claim-tests/${k}/result.json`));
  const b = brief(show('origin/main', `claim-tests/${k}/result.json`));
  const sameDatasets = a && b && a.datasets.length && b.datasets.length
    && a.datasets.some(d => b.datasets.some(e => e.split('-')[0] === d.split('-')[0]));
  return {
    claim: k, ours: a, theirs: b,
    agree: !!(a && b && a.verdict === b.verdict),
    sameDatasetFamily: !!sameDatasets,
    // a disagreement matters differently depending on whether the two tested the same thing
    kind: !a || !b ? 'incomparable'
      : a.verdict === b.verdict ? 'agreement'
      : sameDatasets ? 'same-data-different-analysis'
      : 'different-operationalisation'
  };
});

const upstreamVerdicts = {};
for (const p of theirs) {
  const d = show('origin/main', p); if (!d) continue;
  const v = norm(d.verdict); upstreamVerdicts[v] = (upstreamVerdicts[v] || 0) + 1;
}
const ourVerdicts = {};
for (const p of ours) {
  const d = show('HEAD', p); if (!d) continue;
  const v = norm(d.verdict); ourVerdicts[v] = (ourVerdicts[v] || 0) + 1;
}

const out = {
  builtAt: new Date().toISOString(),
  method: 'Verdicts compared from result.json at HEAD (this swarm) and origin/main (the collaborator swarm). No file was merged or modified to make this comparison.',
  refs: {
    ours: git('rev-parse HEAD').trim(),
    theirs: git('rev-parse origin/main').trim(),
    theirsDate: git('log -1 --format=%cI origin/main').trim(),
    behind: +git('rev-list --count HEAD..origin/main').trim(),
    ahead: +git('rev-list --count origin/main..HEAD').trim()
  },
  counts: {
    ourTests: ours.length, theirTests: theirs.length,
    overlapping: both.length,
    ourVerdicts, upstreamVerdicts,
    agreements: comparisons.filter(c => c.agree).length,
    disagreements: comparisons.filter(c => !c.agree).length
  },
  comparisons
};
fs.mkdirSync(path.join(here, 'public'), { recursive: true });
fs.writeFileSync(path.join(here, 'public/crosscheck.json'), JSON.stringify(out, null, 1));
console.log(`crosscheck.json: ${both.length} claims tested by both swarms, ${out.counts.agreements} agree, ${out.counts.disagreements} differ`);
console.log(`  ours ${ours.length} tests ${JSON.stringify(ourVerdicts)}`);
console.log(`  theirs ${theirs.length} tests ${JSON.stringify(upstreamVerdicts)} (behind by ${out.refs.behind} commits)`);
for (const c of comparisons.filter(x => !x.agree)) console.log(`  DIFFER ${c.claim}: ours ${c.ours?.verdict} vs theirs ${c.theirs?.verdict} [${c.kind}]`);
