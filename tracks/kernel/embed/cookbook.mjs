#!/usr/bin/env node
// The cookbook, written by running it.
//
//   node tracks/kernel/embed/cookbook.mjs --repo <checkout>   run every recipe for real, rewrite COOKBOOK.md
//   node tracks/kernel/embed/cookbook.mjs --check             offline: the committed run is self-consistent
//
// A cookbook typed by hand shows the output its author expected. This one runs each command in a real
// checkout of a real public repository and pastes what came back, so a recipe cannot describe
// behaviour the tool does not have. The store the run produced is committed beside it
// (cookbook/nodes.jsonl), and --check recomputes every id and chain link in that store and confirms
// every node id printed in COOKBOOK.md is in it.
//
// The example project is github.com/fractastical/morpholib, a public repository this project works
// alongside. Its licence is not a standard open one, so nothing of it is redistributed here: the run
// reads three Lean files in a scratch checkout, and what is kept is counts, hashes, verdicts and the
// one line in each file that states the claim being checked, quoted with its line number. The
// audited copies stay in the checkout. Nothing is pushed to that repository, and no issue or pull
// request is opened: whether to offer the result upstream is a decision for a person.
//
// To get the checkout (about 13 MB instead of 2 GB):
//   git clone --filter=blob:none --no-checkout --depth 1 https://github.com/fractastical/morpholib
//   cd morpholib && git sparse-checkout init --no-cone && git sparse-checkout set '/morphoeval/lean/*' && git checkout

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Kernel from '../kernel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, 'delphi.mjs');
const OUT_MD = path.join(HERE, 'COOKBOOK.md');
const OUT_DIR = path.join(HERE, 'cookbook');
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const REPO_URL = 'https://github.com/fractastical/morpholib';
const FILES = ['MathOfBiology', 'Ruliobiology', 'LinearResource'];
const LEAN_DIR = 'morphoeval/lean';

// ---------------------------------------------------------------------------------------------------
// --check: nothing here needs the network, the checkout or a prover

if (process.argv.includes('--check')) {
  const problems = [];
  for (const f of [OUT_MD, path.join(OUT_DIR, 'run.json'), path.join(OUT_DIR, 'nodes.jsonl')]) if (!fs.existsSync(f)) problems.push(`missing ${path.relative(HERE, f)}`);
  if (!problems.length) {
    const K = new Kernel({ file: path.join(OUT_DIR, 'nodes.jsonl') });
    for (const p of K.verify()) problems.push(`store: ${p}`);
    const md = fs.readFileSync(OUT_MD, 'utf8');
    const run = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'run.json'), 'utf8'));
    const ids = [...new Set(md.match(/\bk[0-9a-f]{16}\b/g) ?? [])];
    const strangers = ids.filter((id) => !K.get(id));
    if (strangers.length) problems.push(`${strangers.length} node id(s) printed in COOKBOOK.md are not in its store: ${strangers.join(', ')}`);
    const unprinted = run.steps.filter((s) => !md.includes(s.shown));
    if (unprinted.length) problems.push(`${unprinted.length} command(s) in the recorded run are not in COOKBOOK.md`);
    if (/[A-Z]:\\|\/Users\/|AppData/.test(md + JSON.stringify(run))) problems.push('a machine path leaked into the cookbook');
    if (!problems.length) {
      console.log(`cookbook: ${run.steps.length} command(s) run against ${run.repo} at ${run.commit.slice(0, 8)}; ${K.lines.length} node(s) in its store, every id and chain link recomputed, all ${ids.length} node id(s) printed in the cookbook are in it`);
      process.exit(0);
    }
  }
  for (const p of problems) console.error(`PROBLEM  ${p}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------
// the run

const REPO = path.resolve(arg('--repo', 'C:/Temp/delphi-cookbook/morpholib'));
if (!fs.existsSync(path.join(REPO, LEAN_DIR))) { console.error(`no ${LEAN_DIR}/ under ${REPO}. See the clone commands at the top of this file.`); process.exit(2); }
const git = (...a) => spawnSync('git', a, { cwd: REPO, encoding: 'utf8' }).stdout.trim();
const commit = git('rev-parse', 'HEAD');
const committed = git('log', '-1', '--format=%cs');

// start clean: the run owns .delphi/ and delphi-audit/ in the checkout and nothing else
for (const d of ['.delphi', 'delphi-audit']) fs.rmSync(path.join(REPO, d), { recursive: true, force: true });

const steps = [];
const q = (a) => (/[\s"'`()<>&|=*;]/.test(a) && !/^--[\w-]+$/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
// Run one command for real. `expect` is the exit code a recipe relies on; anything else stops the run,
// because a cookbook whose commands did something unplanned is not a cookbook.
function run(recipe, args, { expect = 0 } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: REPO, encoding: 'utf8', timeout: 900_000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r/g, '').trimEnd();
  const shown = 'delphi ' + args.map(q).join(' ');
  if (r.status !== expect) { console.error(`recipe "${recipe}" expected exit ${expect} and got ${r.status}:\n$ ${shown}\n${out}`); process.exit(1); }
  const id = (out.match(/^(?:evidence|fact|law|verdict|build)\s+(k[0-9a-f]{16})/m) ?? [])[1] ?? (out.match(/record: (k[0-9a-f]{16})/) ?? [])[1] ?? null;
  // the graph line repeats after every mint; it is kept in the record and shown once in the document
  steps.push({ recipe, args, shown, exit: r.status, out, id });
  console.log(`  ${String(r.status).padStart(1)}  ${shown.slice(0, 110)}`);
  return { out, id };
}

console.log(`cookbook run against ${REPO_URL} at ${commit.slice(0, 8)} (${committed})\n`);

// 1. adopt
run('adopt', ['init', '--name', 'morpholib']);

// 2. what each file says about itself. The quote is taken from the file by this script, not typed:
//    the first line near the top that mentions `sorry` is the claim, and it is recorded with its line.
const claims = {};
for (const f of FILES) {
  const rel = `${LEAN_DIR}/${f}.lean`;
  const lines = fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r/g, '').split('\n');
  const i = lines.findIndex((l, n) => n < 80 && /sorry/i.test(l));
  if (i < 0) { console.error(`${rel} states no sorry claim in its first 80 lines; the recipe has nothing to check`); process.exit(1); }
  claims[f] = { rel, quote: lines[i].trim(), where: `line ${i + 1}, the file's header comment` };
}
const ev = {}, fact = {};
for (const f of FILES) {
  ev[f] = run('record', ['evidence', '--kind', 'file', '--ref', claims[f].rel, '--quote', claims[f].quote, '--where', claims[f].where, '--retrieved', committed]).id;
  fact[f] = run('record', ['fact', '--statement', `${f}.lean states that it contains no sorry`, '--quantity', 'sorry_claimed', '--value', '0', '--unit', 'count',
    '--condition', `file=${claims[f].rel}`, '--condition', `commit=${commit.slice(0, 8)}`, '--evidence', ev[f]]).id;
}

// 3. the claim, as published: refused, because the file never asks for its axioms
for (const f of FILES) {
  run('as-published', ['law', '--name', `${f}_as_published`, '--informal', 'Every theorem in this file is accepted by the Lean kernel with no sorry and no added axiom.', '--lean', claims[f].rel], { expect: 1 });
}

// 4. make it checkable without touching it, then check it
const law = {};
for (const f of FILES) {
  run('audit', ['audit', claims[f].rel]);
  law[f] = run('audit', ['law', '--name', `${f}_audited`, '--informal', 'Every theorem and lemma in this file is accepted by the Lean kernel on its three standard axioms, with no sorry and no hand-written axiom.', '--lean', `${f}.Audited.lean`]).id;
}

// 5. apply the law to the claim. The check is a script in the project, shown in full in the cookbook.
const CHECK = `// Is the file's own claim true of the file? Inside when the code holds exactly as many \`sorry\` as it
// claims and no hand-written axiom. The Lean kernel's acceptance is the law this is applied under;
// this script only counts, so that the verdict names numbers a reader can recount.
import fs from 'node:fs';

export default (values, facts) => {
  const file = facts[0].conditions.file;
  const src = fs.readFileSync(file, 'utf8');
  const code = src.replace(/\\/-[\\s\\S]*?-\\//g, ' ').replace(/--[^\\n]*/g, ' ');
  const sorry = (code.match(/\\bsorry\\b/g) ?? []).length;
  const axioms = (code.match(/^\\s*axiom\\s+/gm) ?? []).length;
  return {
    result: sorry === values.sorry_claimed && axioms === 0 ? 'inside' : 'outside',
    detail: \`\${file}: \${sorry} sorry in code against \${values.sorry_claimed} claimed, \${axioms} hand-written axiom(s)\`,
  };
};
`;
fs.mkdirSync(path.join(REPO, '.delphi', 'checks'), { recursive: true });
fs.writeFileSync(path.join(REPO, '.delphi', 'checks', 'claim-matches-file.mjs'), CHECK);
const verdict = {};
for (const f of FILES) {
  verdict[f] = run('verdict', ['verdict', '--law', law[f], '--fact', fact[f], '--requires', 'sorry_claimed', '--check', '.delphi/checks/claim-matches-file.mjs', '--label', `${f}: the zero-sorry claim`]).id;
}
// one claim nobody measured: the first file also says its kernel check is sub-second
const stalled = run('verdict', ['verdict', '--law', law[FILES[0]], '--fact', fact[FILES[0]], '--requires', 'kernel_check_seconds', '--expr', 'kernel_check_seconds < 1', '--label', `${FILES[0]}: the sub-second claim`], { expect: 0 }).id;

// 6. artifacts: one refused, one minted
run('build', ['build', '--artifact', 'a "checks in under a second" badge', '--verdict', stalled], { expect: 1 });

const K0 = new Kernel({ file: path.join(REPO, '.delphi/store/nodes.jsonl'), root: REPO });
const report = [
  '# Axiom audit of three Lean files', '',
  `Repository ${REPO_URL}, commit \`${commit}\` (${committed}).`, '',
  '| file | declarations | audit lines as published | as published | with audit lines added | axioms |',
  '|---|---|---|---|---|---|',
  ...FILES.map((f) => {
    const l = K0.get(law[f]);
    const src = fs.readFileSync(path.join(REPO, claims[f].rel), 'utf8');
    return `| \`${claims[f].rel}\` | ${l.audit.audited} | ${(src.match(/^#print axioms/gm) ?? []).length} | refused: nothing to audit | ${l.audit.verdict} | ${l.audit.axioms.join(', ')} |`;
  }), '',
  'The claims are true. They were not checkable from the files as published, because no file asks Lean to',
  'print the axioms its theorems depend on. One `#print axioms` line per theorem makes each file checkable.', '',
  'This says nothing about whether the theorems are the right theorems, or match the biology they are named',
  'after. That needs a reader.', '',
].join('\n');
fs.mkdirSync(path.join(REPO, 'delphi-audit'), { recursive: true });
fs.writeFileSync(path.join(REPO, 'delphi-audit', 'REPORT.md'), report);
run('build', ['build', '--artifact', 'axiom audit report', ...FILES.flatMap((f) => ['--verdict', verdict[f]]), '--file', 'delphi-audit/REPORT.md']);

// 7. reading it back
run('read', ['why', 'badge']);
run('read', ['summary']);
run('ci', ['verify']);
run('ci', ['doctor']);

// ---------------------------------------------------------------------------------------------------
// keep the store and the graph the run made; write the document

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(path.join(REPO, '.delphi/store/nodes.jsonl'), path.join(OUT_DIR, 'nodes.jsonl'));
fs.copyFileSync(path.join(REPO, '.delphi/graph/graph.json'), path.join(OUT_DIR, 'graph.json'));
fs.copyFileSync(path.join(REPO, '.delphi/graph/index.html'), path.join(OUT_DIR, 'graph.html'));
fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), report);
const K = new Kernel({ file: path.join(OUT_DIR, 'nodes.jsonl') });
const sum = K.summary();
const totalDecls = FILES.reduce((a, f) => a + K.get(law[f]).audit.audited, 0);
fs.writeFileSync(path.join(OUT_DIR, 'run.json'), JSON.stringify({
  repo: REPO_URL, commit, committed, files: FILES.map((f) => claims[f].rel),
  declarations_audited: totalDecls, summary: sum,
  steps: steps.map((s) => ({ recipe: s.recipe, shown: s.shown, exit: s.exit, id: s.id, out: s.out })),
}, null, 1) + '\n');

// output as shown: the repeated graph line is dropped after its first appearance
let graphShown = false;
const block = (s) => {
  const out = s.out.split('\n').filter((l) => { if (!/^graph\s/.test(l)) return true; if (graphShown) return false; graphShown = true; return true; }).join('\n');
  return '```console\n$ ' + s.shown + '\n' + out + '\n```';
};
const of = (recipe) => steps.filter((s) => s.recipe === recipe);
const one = (recipe, i = 0) => block(of(recipe)[i]);
const M = [];
M.push(`# Cookbook: using \`delphi\` on a repository that already exists

**This file is generated by running it.** \`cookbook.mjs\` ran every command below in a checkout of
[${REPO_URL.replace('https://', '')}](${REPO_URL}) at commit \`${commit.slice(0, 8)}\` (${committed}) and pasted what
came back. The store that run produced is in [\`cookbook/nodes.jsonl\`](cookbook/nodes.jsonl), and
\`node tracks/kernel/embed/cookbook.mjs --check\` recomputes it and confirms every node id printed here is in it.

**The question the recipes answer:** three Lean files in that repository each say they contain no
\`sorry\`. Is that true, and could a stranger have checked it from the files?

**What the run found:** yes, and no. All ${totalDecls} theorems and lemmas are accepted by the Lean kernel on its
three standard axioms. None of the three files could show that as published, because none asks Lean to
print the axioms its theorems depend on. One line per theorem fixes it.

Nothing was pushed to that repository and nothing of it is redistributed here beyond the one line in
each file that states the claim. In the commands below, \`delphi\` is \`node tracks/kernel/embed/delphi.mjs\`.

## 1. Adopt it

One command, run at the top of the existing repository. It adds a \`.delphi/\` folder and changes nothing else.

${one('adopt')}

## 2. Record what the project claims, in its own words

Evidence is a source and the exact words read in it. Here the source is a file in the repository
itself, and the words are the line where it states its claim. A fact is the number in that sentence,
filed under that evidence, with the conditions that pin it down: which file, at which commit.

${one('record', 0)}

${one('record', 1)}

The other two files are recorded the same way:

${of('record').slice(2).map(block).join('\n\n')}

**Notice:** try leaving out \`--quote\`, or \`--condition\`. The command refuses and says which rule it
broke. That refusal is the method working, not the tool being awkward.

## 3. Ask the kernel to accept the claim as published

${one('as-published', 0)}

The same for the other two:

${of('as-published').slice(1).map(block).join('\n\n')}

**Notice:** this is not a failed proof. The kernel refused before starting Lean, because a file with
no \`#print axioms\` line gives nothing to audit: a hand-written \`axiom\` would pass every search for
\`sorry\`. "Zero sorry" was true here and unverifiable, which is the common case.

## 4. Make it checkable without touching it

\`delphi audit\` copies the file into \`.delphi/laws/\` and appends one audit line per theorem. The
original is only read. Then \`delphi law\` runs Lean on the copy and records what it printed.

${of('audit').map(block).join('\n\n')}

**Notice:** each law record carries the hash of the exact bytes Lean checked. Edit the file afterwards
and \`delphi doctor\` will say the record no longer matches.

## 5. Apply the law to the claim

A verdict is a law applied to facts. The check here is a twelve-line script kept in the project, so
anyone can read what "inside" meant:

\`\`\`js
${CHECK.trimEnd()}
\`\`\`

${of('verdict').slice(0, 3).map(block).join('\n\n')}

The first file's header also says its kernel check is sub-second. Nobody has recorded a timing, so
the honest answer is neither yes nor no:

${one('verdict', 3)}

**Notice:** \`cannot-assess\` is a result, never a pass. In most codebases a check with a missing input
returns true.

## 6. Build something, or be told exactly why not

An artifact resting on the unassessed claim is refused, and the refusal is itself recorded:

${one('build', 0)}

An artifact resting on the three verdicts that held is minted, and its file is hashed into the record:

${one('build', 1)}

## 7. Read it back

Anything in the store can be walked back to the words it rests on:

${one('read', 0)}

${one('read', 1)}

## 8. Put two commands in CI

\`verify\` recomputes every id and chain link. \`doctor\` checks what can rot without anyone touching the
store: a proof file edited after it was accepted, an artifact regenerated without a new build, a check
that has answered nothing twice.

${of('ci').map(block).join('\n\n')}

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
      - run: node path/to/delphi.mjs verify
      - run: node path/to/delphi.mjs doctor
\`\`\`

## What this run does not say

- It does not say the theorems are the **right** theorems. A statement can be accepted by the kernel
  and say nothing: contradictory hypotheses prove anything. That needs a reader.
- It does not say a formal statement matches the biology it is named after.
- The axioms listed are the bound every audited theorem was confirmed to be within, which is what the
  checker reports, not a per-theorem list.
- It was run once, on one commit. The commit is named above so the run can be repeated against it.

## Run it yourself

\`\`\`bash
git clone --filter=blob:none --no-checkout --depth 1 ${REPO_URL}
cd morpholib && git sparse-checkout init --no-cone && git sparse-checkout set '/morphoeval/lean/*' && git checkout
node tracks/kernel/embed/cookbook.mjs --repo /path/to/morpholib   # needs a Lean 4 toolchain
node tracks/kernel/embed/cookbook.mjs --check                     # needs nothing
\`\`\`

The graph this run produced, as a page: [\`cookbook/graph.html\`](cookbook/graph.html).
`);
fs.writeFileSync(OUT_MD, M.join('\n'));
console.log(`\nwrote    ${path.relative(process.cwd(), OUT_MD)}  (${steps.length} commands, ${K.lines.length} nodes, ${totalDecls} declarations audited)`);
console.log(`store    ${sum.verdicts.inside} inside, ${sum.verdicts.outside} outside, ${sum.verdicts.cannot_assess} cannot-assess; ${sum.builds} built, ${sum.refusals} refused`);
