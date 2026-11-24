// Example 2: numbers in a README, and no proof assistant anywhere.
//
// github.com/ai/nanoid is a widely used JavaScript library (MIT). Its README makes two checkable
// claims in one line: a size in bytes, and "No dependencies". Neither is a theorem. This example shows
// the same five steps with laws that a script checks, and the records saying so on their face.
//
// Nothing in the checkout is installed or executed: the run reads README.md and package.json.

const REPO_URL = 'https://github.com/ai/nanoid';

export const meta = {
  name: 'nanoid',
  dir: 'nanoid',
  repo: REPO_URL,
  title: 'Numbers in a README, with no proof assistant',
  kind: 'README claims checked by scripts, no Lean',
  licence: 'MIT',
  needs: ['README.md', 'package.json'],
  clone: `git clone --depth 1 ${REPO_URL}`,
};

const CHECK = `// Does the manifest list as many runtime dependencies as the README claims? Inside when the counts
// are equal. devDependencies are not counted: they are not installed for a user of the package.
import fs from 'node:fs';

export default (values) => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const kinds = ['dependencies', 'peerDependencies', 'optionalDependencies'];
  const counts = kinds.map((k) => Object.keys(pkg[k] ?? {}).length);
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    result: total === values.dependencies_claimed ? 'inside' : 'outside',
    detail: \`package.json: \${kinds.map((k, i) => \`\${counts[i]} \${k}\`).join(', ')} against \${values.dependencies_claimed} claimed\`,
  };
};
`;

export function run({ commit, committed, run, readLines, writeFile, store }) {
  const at = ['--condition', `commit=${commit.slice(0, 8)}`];

  // 1. adopt
  run('adopt', ['init', '--name', 'nanoid']);

  // 2. the README's line, found by this script and quoted with its line number
  const readme = readLines('README.md');
  const i = readme.findIndex((l) => /bytes \(minified and brotlied\)/.test(l));
  if (i < 0) throw new Error('README.md no longer states a minified-and-brotlied size; the recipe has nothing to check');
  const quote = readme[i].trim();
  const claimedBytes = Number((quote.match(/(\d+) bytes/) ?? [])[1]);
  // the README writes this with a non-breaking space; the quote keeps the bytes as published
  if (!/No\s+dependencies/.test(quote)) throw new Error('the README line no longer says "No dependencies"');
  const evReadme = run('record', ['evidence', '--kind', 'file', '--ref', 'README.md', '--quote', quote, '--where', `line ${i + 1}, the feature list`, '--retrieved', committed]).id;
  const fDeps = run('record', ['fact', '--statement', 'The README says the package has no dependencies', '--quantity', 'dependencies_claimed', '--value', '0', '--unit', 'count',
    '--condition', 'file=README.md', ...at, '--evidence', evReadme]).id;
  const fSize = run('record', ['fact', '--statement', 'The README gives the size of the nanoid import, minified and brotlied', '--quantity', 'size_claimed_bytes', '--value', String(claimedBytes), '--unit', 'bytes',
    '--condition', 'file=README.md', ...at, '--evidence', evReadme]).id;

  //    the limit the project's own size check enforces, from its manifest
  const manifest = readLines('package.json');
  const s = manifest.findIndex((l) => /"size-limit": \[/.test(l));
  const j = manifest.findIndex((l, n) => n > s && /"limit":/.test(l));
  if (s < 0 || j < 0) throw new Error('package.json no longer configures a size limit');
  const limitQuote = manifest[j].trim();
  const limitBytes = Number((limitQuote.match(/(\d+) B/) ?? [])[1]);
  const evLimit = run('record', ['evidence', '--kind', 'file', '--ref', 'package.json', '--quote', limitQuote, '--where', `line ${j + 1}, the first size-limit entry (import { nanoid })`, '--retrieved', committed]).id;
  const fLimit = run('record', ['fact', '--statement', 'The limit the project\'s own size check enforces on the nanoid import', '--quantity', 'size_limit_bytes', '--value', String(limitBytes), '--unit', 'bytes',
    '--condition', 'file=package.json', ...at, '--evidence', evLimit]).id;

  // 3. laws. A statement with nothing to check it is refused; a script law is accepted and labelled.
  run('no-check', ['law', '--name', 'no_runtime_dependencies', '--informal', 'A package has no runtime dependencies when its manifest lists none.'], { expect: 1 });
  writeFile('.delphi/checks/manifest-dependencies.mjs', CHECK);
  const lDeps = run('law', ['law', '--name', 'no_runtime_dependencies', '--informal', 'A package has no runtime dependencies when its manifest lists none under dependencies, peerDependencies or optionalDependencies.', '--script', '.delphi/checks/manifest-dependencies.mjs']).id;
  const lLimit = run('law', ['law', '--name', 'readme_matches_enforced_limit', '--informal', 'A size printed in a README is the size the project holds itself to when it equals the limit its own size check is configured with.', '--script', 'the expression recorded in each verdict']).id;
  const lMeasured = run('law', ['law', '--name', 'size_within_claim', '--informal', 'A published size holds when the size measured the way the claim says is no larger than the claim.', '--script', 'the expression recorded in each verdict']).id;

  // 4. verdicts
  const vDeps = run('verdict', ['verdict', '--law', lDeps, '--fact', fDeps, '--requires', 'dependencies_claimed', '--check', '.delphi/checks/manifest-dependencies.mjs', '--label', 'README: no dependencies']).id;
  const vLimit = run('verdict', ['verdict', '--law', lLimit, '--fact', fSize, '--fact', fLimit, '--requires', 'size_claimed_bytes', '--requires', 'size_limit_bytes', '--expr', 'size_claimed_bytes === size_limit_bytes', '--label', 'README size against the enforced limit']).id;
  // the size itself: nobody here ran the minifier, so there is no measured number to apply the law to
  const stalled = run('verdict', ['verdict', '--law', lMeasured, '--fact', fSize, '--requires', 'size_claimed_bytes', '--requires', 'size_measured_bytes', '--expr', 'size_measured_bytes <= size_claimed_bytes', '--label', 'README size, measured']).id;

  // 5. artifacts
  run('build', ['build', '--artifact', `a "${claimedBytes} bytes, measured" badge`, '--verdict', stalled], { expect: 1 });
  const K = store();
  const d = K.get(vDeps), l = K.get(vLimit);
  const report = [
    '# Two README claims, checked against the repository', '',
    `Repository ${REPO_URL}, commit \`${commit}\` (${committed}).`, '',
    '| claim in README.md | checked against | result | detail |',
    '|---|---|---|---|',
    `| No dependencies | package.json | ${d.result} | ${d.detail} |`,
    `| ${claimedBytes} bytes (minified and brotlied) | the size limit in package.json | ${l.result} | README ${claimedBytes}, enforced limit ${limitBytes} |`,
    `| ${claimedBytes} bytes, as a measurement | nothing: no measurement was recorded | cannot-assess | the run did not install or execute the project's build tools |`, '',
    'Both laws here are checked by a script, not by a proof assistant, and each record says so.', '',
  ].join('\n');
  writeFile('delphi-audit/REPORT.md', report);
  run('build', ['build', '--artifact', 'README claims report', '--verdict', vDeps, '--verdict', vLimit, '--file', 'delphi-audit/REPORT.md']);

  // 6. reading it back
  run('read', ['why', 'badge']);
  run('read', ['summary']);
  run('ci', ['verify']);
  run('ci', ['doctor']);

  return { report, check: CHECK, claimed_bytes: claimedBytes, limit_bytes: limitBytes, readme_line: i + 1, manifest_line: j + 1 };
}

export function render(run, { one, all }) {
  const x = run.extra;
  return `**The question:** the README says the library is ${x.claimed_bytes} bytes and has no dependencies. Does the
repository agree with its own README?

**What the run found:** on both counts that can be checked from the files, yes. The manifest lists no
runtime dependency, and the ${x.claimed_bytes} bytes in the README is exactly the limit the project's own size check
enforces. Whether the code *measures* ${x.claimed_bytes} bytes is not something this run can say: it did not install
or run the project's build tools, so that verdict is \`cannot-assess\` and the badge resting on it was refused.

There is no Lean here. Every law is checked by a script, and every record says so.

### 1. Adopt it

${one('adopt')}

### 2. Record the claim and what it will be checked against

One line of the README carries both claims, so one piece of evidence carries two facts:

${all('record', 0, 3)}

The other side of the comparison is a number too, with its own source:

${all('record', 3)}

### 3. State the law, and say what checks it

A statement with nothing behind it is refused:

${one('no-check')}

Given a script, it is accepted, and the record says a script checked it:

${all('law')}

The script for the first one, in full:

\`\`\`js
${x.check.trimEnd()}
\`\`\`

### 4. Apply each law

${all('verdict', 0, 2)}

And the claim nobody here measured:

${one('verdict', 2)}

### 5. Build something, or be told exactly why not

${all('build')}

### 6. Read it back

${all('read')}

${all('ci')}

**Notice:** \`doctor\` lists the three script laws as a note. That is the tool being plain about how much
weight they carry: a script law is only as good as its script.`;
}
