// Example 1: a claim that was true and could not be checked.
//
// github.com/fractastical/morpholib is a public repository this project works alongside. Its licence
// is not a standard open one, so nothing of it is redistributed: the run reads three Lean files in a
// scratch checkout, and what is kept is counts, hashes, verdicts and the one line in each file that
// states the claim being checked, quoted with its line number. The audited copies stay in the checkout.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_URL = 'https://github.com/fractastical/morpholib';
const FILES = ['MathOfBiology', 'Ruliobiology', 'LinearResource'];
const LEAN_DIR = 'morphoeval/lean';
// This sparse checkout has no built Mathlib of its own, so the Lean check is pointed at a Lake project
// that has one. That is the one piece of setup the run needs, and the law records say so.
const LEAN_PROJECT = process.env.DELPHI_LEAN_PROJECT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../lean');

export const meta = {
  name: 'morpholib',
  dir: 'morpholib',
  repo: REPO_URL,
  title: 'A claim that was true and could not be checked',
  kind: 'Lean proofs that publish no axiom audit',
  licence: 'non-standard: only counts, hashes and one claim line per file are kept',
  needs: [LEAN_DIR],
  clone: `git clone --filter=blob:none --no-checkout --depth 1 ${REPO_URL} && (cd morpholib && git sparse-checkout init --no-cone && git sparse-checkout set '/morphoeval/lean/*' && git checkout)`,
};

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

export function run({ REPO, commit, committed, run, readLines, writeFile, store }) {
  const env = { DELPHI_LEAN_PROJECT: LEAN_PROJECT };

  // 1. adopt
  run('adopt', ['init', '--name', 'morpholib']);

  // 2. what each file says about itself. The quote is taken from the file by this script, not typed:
  //    the first line near the top that mentions `sorry` is the claim, and it is recorded with its line.
  const claims = {};
  for (const f of FILES) {
    const rel = `${LEAN_DIR}/${f}.lean`;
    const lines = readLines(rel);
    const i = lines.findIndex((l, n) => n < 80 && /sorry/i.test(l));
    if (i < 0) throw new Error(`${rel} states no sorry claim in its first 80 lines; the recipe has nothing to check`);
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
    run('as-published', ['law', '--name', `${f}_as_published`, '--informal', 'Every theorem in this file is accepted by the Lean kernel with no sorry and no added axiom.', '--lean', claims[f].rel], { expect: 1, env });
  }

  // 4. make it checkable without touching it, then check it
  const law = {};
  for (const f of FILES) {
    run('audit', ['audit', claims[f].rel]);
    law[f] = run('audit', ['law', '--name', `${f}_audited`, '--informal', 'Every theorem and lemma in this file is accepted by the Lean kernel on its three standard axioms, with no sorry and no hand-written axiom.', '--lean', `${f}.Audited.lean`], { env }).id;
  }

  // 5. apply the law to the claim. The check is a script in the project, shown in full in the cookbook.
  writeFile('.delphi/checks/claim-matches-file.mjs', CHECK);
  const verdict = {};
  for (const f of FILES) {
    verdict[f] = run('verdict', ['verdict', '--law', law[f], '--fact', fact[f], '--requires', 'sorry_claimed', '--check', '.delphi/checks/claim-matches-file.mjs', '--label', `${f}: the zero-sorry claim`]).id;
  }
  // one claim nobody measured: the first file also says its kernel check is sub-second
  const stalled = run('verdict', ['verdict', '--law', law[FILES[0]], '--fact', fact[FILES[0]], '--requires', 'kernel_check_seconds', '--expr', 'kernel_check_seconds < 1', '--label', `${FILES[0]}: the sub-second claim`]).id;

  // 6. artifacts: one refused, one minted
  run('build', ['build', '--artifact', 'a "checks in under a second" badge', '--verdict', stalled], { expect: 1 });

  const K = store();
  const rows = FILES.map((f) => {
    const l = K.get(law[f]);
    const src = fs.readFileSync(path.join(REPO, claims[f].rel), 'utf8');
    return { file: claims[f].rel, declarations: l.audit.audited, audit_lines_as_published: (src.match(/^#print axioms/gm) ?? []).length, verdict: l.audit.verdict, axioms: l.audit.axioms };
  });
  const report = [
    '# Axiom audit of three Lean files', '',
    `Repository ${REPO_URL}, commit \`${commit}\` (${committed}).`, '',
    '| file | declarations | audit lines as published | as published | with audit lines added | axioms |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| \`${r.file}\` | ${r.declarations} | ${r.audit_lines_as_published} | refused: nothing to audit | ${r.verdict} | ${r.axioms.join(', ')} |`), '',
    'The claims are true. They were not checkable from the files as published, because no file asks Lean to',
    'print the axioms its theorems depend on. One `#print axioms` line per theorem makes each file checkable.', '',
    'This says nothing about whether the theorems are the right theorems, or match the biology they are named',
    'after. That needs a reader.', '',
  ].join('\n');
  writeFile('delphi-audit/REPORT.md', report);
  run('build', ['build', '--artifact', 'axiom audit report', ...FILES.flatMap((f) => ['--verdict', verdict[f]]), '--file', 'delphi-audit/REPORT.md']);

  // 7. reading it back
  run('read', ['why', 'badge']);
  run('read', ['summary']);
  run('ci', ['verify']);
  run('ci', ['doctor']);

  return { report, rows, check: CHECK, declarations_audited: rows.reduce((a, r) => a + r.declarations, 0), files: FILES.map((f) => claims[f].rel) };
}

export function render(run, { one, all }) {
  return `**The question:** three Lean files in this repository each say they contain no \`sorry\`. Is that
true, and could a stranger have checked it from the files?

**What the run found:** yes, and no. All ${run.extra.declarations_audited} theorems and lemmas are accepted by the Lean kernel on its
three standard axioms. None of the three files could show that as published, because none asks Lean to
print the axioms its theorems depend on. One line per theorem fixes it.

Nothing of that repository is redistributed here beyond the one line in each file that states the claim.

### 1. Adopt it

One command, run at the top of the existing repository. It adds a \`.delphi/\` folder and changes nothing else.

${one('adopt')}

### 2. Record what the project claims, in its own words

Evidence is a source and the exact words read in it. Here the source is a file in the repository
itself, and the words are the line where it states its claim. A fact is the number in that sentence,
filed under that evidence, with the conditions that pin it down: which file, at which commit.

${one('record', 0)}

${one('record', 1)}

The other two files are recorded the same way:

${all('record', 2)}

**Notice:** try leaving out \`--quote\`, or \`--condition\`. The command refuses and says which rule it
broke. That refusal is the method working, not the tool being awkward.

### 3. Ask the kernel to accept the claim as published

${one('as-published', 0)}

The same for the other two:

${all('as-published', 1)}

**Notice:** this is not a failed proof. The kernel refused before starting Lean, because a file with
no \`#print axioms\` line gives nothing to audit: a hand-written \`axiom\` would pass every search for
\`sorry\`. "Zero sorry" was true here and unverifiable, which is the common case.

### 4. Make it checkable without touching it

\`delphi audit\` copies the file into \`.delphi/laws/\` and appends one audit line per theorem. The
original is only read. Then \`delphi law\` runs Lean on the copy and records what it printed.

This sparse checkout has no built Mathlib of its own, so for this run \`DELPHI_LEAN_PROJECT\` named a
Lake project that has one. Each law record says so ("the Lake project named for this check").

${all('audit')}

**Notice:** each law record carries the hash of the exact bytes Lean checked. Edit the file afterwards
and \`delphi doctor\` will say the record no longer matches.

### 5. Apply the law to the claim

A verdict is a law applied to facts. The check here is a short script kept in the project, so
anyone can read what "inside" meant:

\`\`\`js
${run.extra.check.trimEnd()}
\`\`\`

${all('verdict', 0, 3)}

The first file's header also says its kernel check is sub-second. Nobody has recorded a timing, so
the honest answer is neither yes nor no:

${one('verdict', 3)}

**Notice:** \`cannot-assess\` is a result, never a pass. In most codebases a check with a missing input
returns true.

### 6. Build something, or be told exactly why not

An artifact resting on the unassessed claim is refused, and the refusal is itself recorded:

${one('build', 0)}

An artifact resting on the three verdicts that held is minted, and its file is hashed into the record:

${one('build', 1)}

### 7. Read it back

Anything in the store can be walked back to the words it rests on:

${one('read', 0)}

${one('read', 1)}

### 8. The two commands for CI

${all('ci')}

The axioms listed for each file are the union of what its audited theorems printed.`;
}
