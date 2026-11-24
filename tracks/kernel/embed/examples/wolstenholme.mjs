// Example 3: a repository that already publishes its own axiom audit.
//
// github.com/fahad-96/wolstenholme-zolotarev (Apache-2.0) proves two classical results in number
// theory in Lean 4 on Mathlib, and ships a Checks.lean that restates each headline theorem and asks
// Lean to print its axioms. So here the claim is checkable as published, with no copy and no added
// line: the opposite of example 1. The Lean check runs in the repository's own Lake project.
//
// Before the run the project was built the way its README says (`lake build`).

import fs from 'node:fs';
import path from 'node:path';

const REPO_URL = 'https://github.com/fahad-96/wolstenholme-zolotarev';

export const meta = {
  name: 'wolstenholme',
  dir: 'wolstenholme-zolotarev',
  repo: REPO_URL,
  title: 'A repository that already publishes its audit',
  kind: 'Lean proofs checked as published, in the project\'s own Lake environment',
  licence: 'Apache-2.0',
  needs: ['Checks.lean', 'lakefile.toml'],
  clone: `git clone --depth 1 ${REPO_URL} && (cd wolstenholme-zolotarev && lake exe cache get && lake build)`,
};

const CHECK = `// Do the Lean sources hold as many forbidden constructs as the README claims (none)? Counts are
// taken over code only: comments and doc-comments are removed first, because a file may talk about
// \`sorry\` without using it. Folders that are not the project's own source are skipped.
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['.lake', '.delphi', '.git', 'node_modules']);
const leanFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (SKIP.has(e.name) ? [] : leanFiles(path.join(dir, e.name))) : e.name.endsWith('.lean') ? [path.join(dir, e.name)] : []);

export default (values) => {
  const files = leanFiles('.');
  const count = { sorry: 0, admit: 0, native_decide: 0, set_option: 0, axiom: 0 };
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8').replace(/\\/-[\\s\\S]*?-\\//g, ' ').replace(/--[^\\n]*/g, ' ');
    count.sorry += (code.match(/\\bsorry\\b/g) ?? []).length;
    count.admit += (code.match(/\\badmit\\b/g) ?? []).length;
    count.native_decide += (code.match(/\\bnative_decide\\b/g) ?? []).length;
    count.set_option += (code.match(/\\bset_option\\b/g) ?? []).length;
    count.axiom += (code.match(/^\\s*axiom\\s+/gm) ?? []).length;
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  return {
    result: total === values.forbidden_constructs_claimed ? 'inside' : 'outside',
    detail: \`\${files.length} Lean file(s): \${Object.entries(count).map(([k, v]) => \`\${v} \${k}\`).join(', ')} against \${values.forbidden_constructs_claimed} claimed\`,
  };
};
`;

export function run({ REPO, commit, committed, run, readLines, writeFile, store }) {
  const at = ['--condition', 'file=README.md', '--condition', `commit=${commit.slice(0, 8)}`];

  // 1. adopt
  run('adopt', ['init', '--name', 'wolstenholme-zolotarev']);

  // 2. the README's sentence, found by this script. It runs over two lines, so both are quoted.
  const readme = readLines('README.md');
  const i = readme.findIndex((l) => /There is no `sorry`/.test(l));
  if (i < 0) throw new Error('README.md no longer states its no-sorry claim; the recipe has nothing to check');
  const sentence = `${readme[i]} ${readme[i + 1]}`.replace(/\s+/g, ' ').trim();
  const quote = (sentence.match(/There is no `sorry`[^.]*\./) ?? [])[0];
  if (!quote) throw new Error('could not read the no-sorry sentence from the README');
  const ev = run('record', ['evidence', '--kind', 'file', '--ref', 'README.md', '--quote', quote, '--where', `lines ${i + 1} to ${i + 2}, the opening section`, '--retrieved', committed]).id;
  const fClean = run('record', ['fact', '--statement', 'The README says the Lean sources use no sorry, admit, native_decide, set_option or new axiom', '--quantity', 'forbidden_constructs_claimed', '--value', '0', '--unit', 'count', ...at, '--evidence', ev]).id;

  const k = readme.findIndex((l) => /Neither result is in Mathlib yet/.test(l));
  if (k < 0) throw new Error('README.md no longer says the results are new to Mathlib');
  const evNew = run('record', ['evidence', '--kind', 'file', '--ref', 'README.md', '--quote', 'Neither result is in Mathlib yet.', '--where', `line ${k + 1}, the opening paragraph`, '--retrieved', committed]).id;
  const fNew = run('record', ['fact', '--statement', 'The README says Mathlib has no proof of either result', '--quantity', 'mathlib_proofs_claimed', '--value', '0', '--unit', 'count', ...at, '--evidence', evNew]).id;

  // 3. the claim, as published. Checks.lean asks for its own axioms, so nothing has to be added.
  const law = run('as-published', ['law', '--name', 'headline_theorems_audited', '--informal', 'Each headline theorem restated in Checks.lean is accepted by the Lean kernel on its three standard axioms, with no sorry.', '--lean', 'Checks.lean']).id;
  const lNew = run('law', ['law', '--name', 'absent_upstream', '--informal', 'A result is new to a library when a search of that library at a named commit finds no proof of it.', '--script', 'a search of Mathlib that nobody has recorded here']).id;

  // 4. verdicts
  writeFile('.delphi/checks/no-forbidden-constructs.mjs', CHECK);
  const vClean = run('verdict', ['verdict', '--law', law, '--fact', fClean, '--requires', 'forbidden_constructs_claimed', '--check', '.delphi/checks/no-forbidden-constructs.mjs', '--label', 'README: no sorry, admit, native_decide, set_option or new axiom']).id;
  // "not in Mathlib yet" cannot be settled from this checkout: it needs a search of another repository
  const stalled = run('verdict', ['verdict', '--law', lNew, '--fact', fNew, '--requires', 'mathlib_proofs_claimed', '--requires', 'mathlib_proofs_found', '--expr', 'mathlib_proofs_found === mathlib_proofs_claimed', '--label', 'README: not in Mathlib yet']).id;

  // 5. artifacts
  run('build', ['build', '--artifact', 'a "new to Mathlib" badge', '--verdict', stalled], { expect: 1 });
  const K = store();
  const L = K.get(law), V = K.get(vClean);
  const asked = (fs.readFileSync(path.join(REPO, 'Checks.lean'), 'utf8').match(/^#print axioms/gm) ?? []).length;
  const report = [
    '# The repository\'s own audit, re-run and recorded', '',
    `Repository ${REPO_URL}, commit \`${commit}\` (${committed}).`, '',
    '| claim in README.md | checked by | result | detail |',
    '|---|---|---|---|',
    `| Every proof is complete, on standard axioms | Lean, on \`Checks.lean\` as published (${L.audit.toolchain}) | ${L.audit.verdict} | ${L.audit.audited} theorem(s) audited; axioms ${L.audit.axioms.join(', ')} |`,
    `| No sorry, admit, native_decide, set_option or new axiom | a count over the Lean sources | ${V.result} | ${V.detail} |`,
    '| Neither result is in Mathlib yet | nothing: no search of Mathlib was recorded | cannot-assess | not decidable from this repository alone |', '',
    'Nothing had to be added to check the first claim: the repository asks Lean to print its axioms itself.', '',
    'This says nothing about whether the Lean statements are the classical theorems they are named after.',
    'That needs a reader, and the repository restates each one in `Checks.lean` so a reader can.', '',
  ].join('\n');
  writeFile('delphi-audit/REPORT.md', report);
  run('build', ['build', '--artifact', 'audit record', '--verdict', vClean, '--file', 'delphi-audit/REPORT.md']);

  // 6. reading it back
  run('read', ['why', 'badge']);
  run('read', ['summary']);
  run('ci', ['verify']);
  run('ci', ['doctor']);

  return { report, check: CHECK, audited: L.audit.audited, asked, toolchain: L.audit.toolchain, axioms: L.audit.axioms, lean_project: L.audit.lean_project };
}

export function render(run, { one, all }) {
  const x = run.extra;
  return `**The question:** the README says every proof is complete, with no \`sorry\` and no new axiom. Can a
stranger confirm that from the repository as published?

**What the run found:** yes, with nothing added. The repository ships a \`Checks.lean\` that restates its
${x.audited} headline theorems and asks Lean to print the axioms under each. \`delphi law\` accepted that file as it
stands, in the repository's own Lake project (${x.toolchain}). A count over the sources agrees with the
README. One claim cannot be settled from this repository at all, that the results are new to Mathlib, so
it is recorded as \`cannot-assess\`.

This is the opposite of example 1. There the claim was true and uncheckable. Here the authors made it
checkable, and the tool's job is only to record that it was checked, by what, on which bytes.

Before the run, the project was built the way its README says (\`lake build\`).

### 1. Adopt it

${one('adopt')}

### 2. Record what the README claims

${all('record')}

### 3. Ask the kernel to accept the claim as published

${one('as-published')}

**Notice:** no \`delphi audit\` step and no copy. The file asks for its own axioms, so there is
something to audit. The record names the Lake project the check ran in: this repository's own.

The second claim is about another repository. Its law is a statement with no check behind it yet, and
the record says exactly that:

${one('law')}

### 4. Apply each law

The count, as a script anyone can read:

\`\`\`js
${x.check.trimEnd()}
\`\`\`

${all('verdict')}

### 5. Build something, or be told exactly why not

${all('build')}

### 6. Read it back

${all('read')}

${all('ci')}`;
}
