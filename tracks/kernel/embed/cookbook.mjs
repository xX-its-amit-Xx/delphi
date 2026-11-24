#!/usr/bin/env node
// The cookbook, written by running it, on three public repositories that are not ours.
//
//   node tracks/kernel/embed/cookbook.mjs --run all              run every example for real, rewrite COOKBOOK.md
//   node tracks/kernel/embed/cookbook.mjs --run nanoid --repo <checkout>
//   node tracks/kernel/embed/cookbook.mjs --render               rewrite COOKBOOK.md from the recorded runs
//   node tracks/kernel/embed/cookbook.mjs --check                offline: the recorded runs are self-consistent
//
// A cookbook typed by hand shows the output its author expected. This one runs each command in a real
// checkout of a real public repository and pastes what came back, so a recipe cannot describe
// behaviour the tool does not have. The three examples double as validation cases: they were chosen
// to differ (a proof nobody could check, numbers in a README, a project that already audits itself),
// and the tool had to work on each without being changed for it.
//
// The commands are not run from this source tree. Each run first packs the npm package, installs it
// into an empty folder, and drives that installed copy, so a file the package forgot to ship fails the
// cookbook rather than a stranger's first try. The tarball's sha256 is recorded with the run, and
// --check fails if the package has changed since: a cookbook made by an older tool is a stale one.
//
// Nothing is pushed to any of these repositories and no issue or pull request is opened. A run writes
// only `.delphi/` and `delphi-audit/` inside the scratch checkout. Whether to offer a result upstream
// is a decision for a person.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Kernel from '../kernel.mjs';
import { install } from './test-install.mjs';
import * as morpholib from './examples/morpholib.mjs';
import * as nanoid from './examples/nanoid.mjs';
import * as wolstenholme from './examples/wolstenholme.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_MD = path.join(HERE, 'COOKBOOK.md');
const OUT_DIR = path.join(HERE, 'cookbook');
const SCRATCH = process.env.DELPHI_COOKBOOK_DIR ?? 'C:/Temp/delphi-cookbook';
const INSTALL_URL = 'https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/tracks/kernel/files/';
const EXAMPLES = [morpholib, nanoid, wolstenholme];
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf8'));

// How a command is shown. Single quotes wherever a shell would otherwise read into the argument, so a
// line copied from the cookbook does what the run did.
const q = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : a.includes("'") ? `"${a.replace(/(["`$\\])/g, '\\$1')}"` : `'${a}'`);

const loadRun = (name) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, name, 'run.json'), 'utf8'));
const haveRun = (name) => fs.existsSync(path.join(OUT_DIR, name, 'run.json'));

// ---------------------------------------------------------------------------------------------------
// one example, for real

function runExample(ex, repoDir, tool) {
  const REPO = path.resolve(repoDir ?? path.join(SCRATCH, ex.meta.dir));
  const missing = ex.meta.needs.filter((f) => !fs.existsSync(path.join(REPO, f)));
  if (missing.length) { console.error(`no ${missing.join(', ')} under ${REPO}.\nTo get the checkout:\n${ex.meta.clone}`); process.exit(2); }
  const git = (...a) => spawnSync('git', a, { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  const commit = git('rev-parse', 'HEAD');
  const committed = git('log', '-1', '--format=%cs');

  // start clean: the run owns .delphi/ and delphi-audit/ in the checkout and nothing else
  for (const d of ['.delphi', 'delphi-audit']) fs.rmSync(path.join(REPO, d), { recursive: true, force: true });

  const steps = [];
  // Run one command for real. `expect` is the exit code a recipe relies on; anything else stops the
  // run, because a cookbook whose commands did something unplanned is not a cookbook.
  const run = (recipe, args, { expect = 0, env = {} } = {}) => {
    const r = spawnSync(process.execPath, [tool.cli, ...args], { cwd: REPO, encoding: 'utf8', timeout: 900_000, env: { ...process.env, ...env } });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r/g, '').trimEnd();
    const shown = 'delphi ' + args.map(q).join(' ');
    if (r.status !== expect) { console.error(`recipe "${recipe}" expected exit ${expect} and got ${r.status}:\n$ ${shown}\n${out}`); process.exit(1); }
    const id = (out.match(/^(?:evidence|fact|law|verdict|build)\s+(k[0-9a-f]{16})/m) ?? [])[1] ?? (out.match(/record: (k[0-9a-f]{16})/) ?? [])[1] ?? null;
    steps.push({ recipe, args, shown, exit: r.status, out, id });
    console.log(`  ${r.status}  ${shown.slice(0, 110)}`);
    return { out, id };
  };
  const readLines = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r/g, '').split('\n');
  const writeFile = (rel, text) => { fs.mkdirSync(path.dirname(path.join(REPO, rel)), { recursive: true }); fs.writeFileSync(path.join(REPO, rel), text); };
  const store = () => new Kernel({ file: path.join(REPO, '.delphi/store/nodes.jsonl'), root: REPO });

  console.log(`\n${ex.meta.name}: ${ex.meta.repo} at ${commit.slice(0, 8)} (${committed})`);
  const extra = ex.run({ REPO, commit, committed, run, readLines, writeFile, store });

  const dir = path.join(OUT_DIR, ex.meta.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(REPO, '.delphi/store/nodes.jsonl'), path.join(dir, 'nodes.jsonl'));
  fs.copyFileSync(path.join(REPO, '.delphi/graph/graph.json'), path.join(dir, 'graph.json'));
  fs.copyFileSync(path.join(REPO, '.delphi/graph/index.html'), path.join(dir, 'graph.html'));
  fs.writeFileSync(path.join(dir, 'REPORT.md'), extra.report);
  const K = new Kernel({ file: path.join(dir, 'nodes.jsonl') });
  const sum = K.summary();
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
    example: ex.meta.name, repo: ex.meta.repo, commit, committed, kind: ex.meta.kind, licence: ex.meta.licence,
    tool: { name: tool.name, version: tool.version, tarball: tool.filename, sha256: tool.sha256 },
    summary: sum, extra,
    steps: steps.map((s) => ({ recipe: s.recipe, shown: s.shown, exit: s.exit, id: s.id, out: s.out })),
  }, null, 1) + '\n');
  console.log(`  -> ${steps.length} commands, ${K.lines.length} nodes; ${sum.verdicts.inside} inside, ${sum.verdicts.outside} outside, ${sum.verdicts.cannot_assess} cannot-assess; ${sum.builds} built, ${sum.refusals} refused`);
}

// ---------------------------------------------------------------------------------------------------
// the document, from the recorded runs alone

// output as shown: the graph line repeats after every mint, so it is shown once per example
export function blocks(run) {
  let graphShown = false;
  const block = (s) => {
    const out = s.out.split('\n').filter((l) => { if (!/^graph\s/.test(l)) return true; if (graphShown) return false; graphShown = true; return true; }).join('\n');
    return '```console\n$ ' + s.shown + '\n' + out + '\n```';
  };
  const of = (recipe) => run.steps.filter((s) => s.recipe === recipe);
  return { block, of, one: (recipe, i = 0) => block(of(recipe)[i]), all: (recipe, from = 0, to = undefined) => of(recipe).slice(from, to).map(block).join('\n\n') };
}

function render() {
  const runs = EXAMPLES.map((ex) => ({ ex, run: loadRun(ex.meta.name) }));
  const tool = runs[0].run.tool;
  const short = (r) => `[${r.repo.replace('https://github.com/', '')}](${r.repo})`;
  const tally = (s) => `${s.verdicts.inside} inside, ${s.verdicts.outside} outside, ${s.verdicts.cannot_assess} cannot-assess; ${s.builds} built, ${s.refusals} refused`;
  const M = [];
  M.push(`# Cookbook: using \`delphi\` on repositories that already exist

**This file is generated by running it.** \`cookbook.mjs\` ran every command below in a checkout of a
public repository that is not ours, and pasted what came back. There are three, chosen to differ:

| | repository | at commit | what it tests | commands | records | result |
|---|---|---|---|---|---|---|
${runs.map(({ ex, run }, i) => `| ${i + 1} | ${short(run)} | \`${run.commit.slice(0, 8)}\` (${run.committed}) | ${ex.meta.kind} | ${run.steps.length} | ${run.summary.nodes} | ${tally(run.summary)} |`).join('\n')}

One installed package ran all three, with no change between them. The commands were not run from our source tree: each
run packed the npm package, installed it into an empty folder and used that copy
(\`${tool.tarball}\`, sha256 \`${tool.sha256.slice(0, 16)}\`). The store each run produced is kept beside this
file, and \`node tracks/kernel/embed/cookbook.mjs --check\` recomputes all three and confirms every record
id printed here is in one of them.

Nothing was pushed to any of these repositories. A run writes only \`.delphi/\` and \`delphi-audit/\` in
a scratch checkout.

## Install

\`\`\`bash
npm install --save-dev ${INSTALL_URL}${tool.tarball}
npx delphi init
\`\`\`

It needs Node 20 or later and has no dependencies. It is not on the npm registry: the address above is
the same tarball these runs used. In the commands below, \`delphi\` is that installed command.

To check a Lean file, \`delphi\` runs Lean inside the nearest Lake project above the file, so it sees
your toolchain and your libraries. No Lean on the machine means a Lean law is refused as unchecked. It
is never passed. Laws checked by a script need no Lean at all (example 2).
`);
  runs.forEach(({ ex, run }, i) => M.push(`\n---\n\n## Example ${i + 1}. ${ex.meta.title}\n\n${ex.render(run, blocks(run)).trim()}\n\nThe graph this run produced, as a page: [\`cookbook/${ex.meta.name}/graph.html\`](cookbook/${ex.meta.name}/graph.html). Its store: [\`cookbook/${ex.meta.name}/nodes.jsonl\`](cookbook/${ex.meta.name}/nodes.jsonl).\n`));
  M.push(`
---

## Put two commands in CI

\`verify\` recomputes every id and chain link. \`doctor\` checks what can rot without anyone touching the
store: a proof file edited after it was accepted, an artifact regenerated without a new build, a check
that has answered nothing twice.

\`\`\`yaml
# .github/workflows/delphi.yml
on: [push, pull_request]
jobs:
  record:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx delphi verify
      - run: npx delphi doctor
\`\`\`

## What these runs do not say

- They do not say a theorem is the **right** theorem. A statement can be accepted by Lean and say
  nothing: contradictory hypotheses prove anything. That needs a reader.
- They do not say a formal statement matches the science it is named after.
- A law checked by a script is only as good as the script. Its record says a script checked it, and
  the script is printed in full above so it can be read.
- Each was run once, on one commit, on one machine. The commit is named so the run can be repeated.
- None of the three returned \`outside\`: every claim that could be checked held. So these runs show
  the tool refusing what cannot be checked. They do not show it catching a claim that is false; the
  fault suite covers that, with made-up inputs.
- Three repositories is three. They show the tool is not fitted to one project. They do not show it
  fits every project.

## Run them yourself

\`\`\`bash
${EXAMPLES.map((ex) => ex.meta.clone).join('\n')}
node tracks/kernel/embed/cookbook.mjs --run all     # examples 1 and 3 need a Lean 4 toolchain
node tracks/kernel/embed/cookbook.mjs --check       # needs nothing
\`\`\`
`);
  fs.writeFileSync(OUT_MD, M.join('\n'));
  return M.join('\n');
}

// ---------------------------------------------------------------------------------------------------
// --check: nothing here needs the network, a checkout or a prover

function check() {
  const problems = [];
  const have = EXAMPLES.filter((ex) => haveRun(ex.meta.name));
  for (const ex of EXAMPLES) if (!haveRun(ex.meta.name)) problems.push(`no recorded run for ${ex.meta.name}`);
  if (!fs.existsSync(OUT_MD)) problems.push('missing COOKBOOK.md');
  if (problems.length) return problems;

  const md = fs.readFileSync(OUT_MD, 'utf8');
  const known = new Set();
  let commands = 0, nodes = 0;
  for (const ex of have) {
    const run = loadRun(ex.meta.name);
    const K = new Kernel({ file: path.join(OUT_DIR, ex.meta.name, 'nodes.jsonl') });
    for (const p of K.verify()) problems.push(`${ex.meta.name} store: ${p}`);
    K.lines.forEach((n) => known.add(n.id));
    commands += run.steps.length; nodes += K.lines.length;
    const unprinted = run.steps.filter((s) => !md.includes(s.shown));
    if (unprinted.length) problems.push(`${ex.meta.name}: ${unprinted.length} command(s) in the recorded run are not in COOKBOOK.md (${unprinted[0].shown.slice(0, 60)}…)`);
    const s = K.summary();
    if (JSON.stringify(s.verdicts) !== JSON.stringify(run.summary.verdicts) || s.nodes !== run.summary.nodes) problems.push(`${ex.meta.name}: the store no longer gives the tally the run recorded`);
    if (/[A-Z]:\\|[A-Z]:\/|\/Users\/|AppData/.test(JSON.stringify(run))) problems.push(`${ex.meta.name}: a machine path leaked into the recorded run`);
  }
  const ids = [...new Set(md.match(/\bk[0-9a-f]{16}\b/g) ?? [])];
  const strangers = ids.filter((id) => !known.has(id));
  if (strangers.length) problems.push(`${strangers.length} record id(s) printed in COOKBOOK.md are in none of the stores: ${strangers.join(', ')}`);
  if (/[A-Z]:\\|\/Users\/|AppData/.test(md)) problems.push('a machine path leaked into the cookbook');
  // the document is a function of the recorded runs, so it must be exactly what they render to
  const again = (() => { const keep = fs.readFileSync(OUT_MD); const t = render(); fs.writeFileSync(OUT_MD, keep); return t; })();
  if (again !== md) problems.push('COOKBOOK.md is not what the recorded runs render to: it was edited by hand, or a run changed without --render');
  // the package these runs used must be the package as it is now
  const tools = new Set(have.map((ex) => loadRun(ex.meta.name).tool.sha256));
  if (tools.size > 1) problems.push('the examples were run with different builds of the package');
  const recorded = loadRun(have[0].meta.name).tool;
  if (packSha() !== recorded.sha256) problems.push(`the package has changed since the cookbook was run (${recorded.tarball} was ${recorded.sha256.slice(0, 16)}). Re-run: cookbook.mjs --run all`);
  if (!problems.length) console.log(`cookbook: ${commands} command(s) run against ${have.length} public repositories with ${recorded.name}@${recorded.version} as installed; ${nodes} record(s) in their stores, every id and chain link recomputed, all ${ids.length} id(s) printed in the cookbook are in them`);
  return problems;
}

// the sha256 of the tarball `npm pack` makes now. npm writes fixed timestamps, so the same files give
// the same bytes.
function packSha() {
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'delphi-pack-'));
  const p = spawnSync(`npm pack --pack-destination "${tmp}" --json`, { cwd: path.join(HERE, '..'), encoding: 'utf8', shell: true });
  const file = path.join(tmp, JSON.parse(p.stdout)[0].filename);
  const h = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.rmSync(tmp, { recursive: true, force: true });
  return h;
}

// ---------------------------------------------------------------------------------------------------

if (process.argv.includes('--check')) {
  const problems = check();
  for (const p of problems) console.error(`PROBLEM  ${p}`);
  process.exit(problems.length ? 1 : 0);
} else if (process.argv.includes('--render')) {
  render();
  console.log(`wrote    ${path.relative(process.cwd(), OUT_MD)}`);
} else if (arg('--run')) {
  const want = arg('--run');
  const todo = EXAMPLES.filter((ex) => want === 'all' || ex.meta.name === want);
  if (!todo.length) { console.error(`no example "${want}". There are: ${EXAMPLES.map((e) => e.meta.name).join(', ')}, all`); process.exit(2); }
  const into = path.join(SCRATCH, '_tool');
  fs.rmSync(into, { recursive: true, force: true });
  const tool = install(into);
  console.log(`installed ${tool.name}@${tool.version} (${tool.filename}, sha256 ${tool.sha256.slice(0, 16)}) into an empty folder; every command below runs that copy`);
  for (const ex of todo) runExample(ex, todo.length === 1 ? arg('--repo') : null, tool);
  if (EXAMPLES.every((ex) => haveRun(ex.meta.name))) { render(); console.log(`\nwrote    ${path.relative(process.cwd(), OUT_MD)}`); }
} else {
  console.log('usage: cookbook.mjs --run <all|' + EXAMPLES.map((e) => e.meta.name).join('|') + '> [--repo <checkout>] | --render | --check');
}
