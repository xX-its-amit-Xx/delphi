// Run every worked example against the current code, then rewrite examples/README.md from their output.json.
//   node sim-engine/examples/run-all.mjs
// Exit code 1 if any example reported an unexpected result: the examples double as a regression test.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = import.meta.dirname;
const EXAMPLES = [
  ['a-text-to-design', 'Text to design: a sentence becomes a spec, then a design, judged criterion by criterion'],
  ['b-impossible-spec', 'The same request made impossible: "no design meets the spec", and the laws that rule it out'],
  ['c-current-timecourse', 'Winged zebrafish vs flying fish against a 0.3 m/s current at every life stage'],
  ['d-altitude', 'TFF vs flying fish from 0 to 5 km, checked against the Lean altitude law'],
  ['e-predator', 'Which organisms can escape a predator by air'],
  ['codesign-demo', 'A live co-design session over MCP stdio: physics proposes, genotype comments, a human approves, lean_check'],
];
const rows = [];
let failed = 0;
for (const [dir, what] of EXAMPLES) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(HERE, dir, 'run.mjs')], { encoding: 'utf8', cwd: path.resolve(HERE, '..', '..') });
  process.stdout.write(r.stdout); if (r.status !== 0 && r.stderr) process.stderr.write(r.stderr);
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(path.join(HERE, dir, 'output.json'), 'utf8')).meta; } catch {}
  const nFail = meta ? meta.checks.filter(c => !c.pass).length : null;
  if (r.status !== 0) failed++;
  rows.push({ dir, what, status: r.status, secs: ((Date.now() - t) / 1000).toFixed(1), headline: meta?.headline ?? `(no output: ${r.stderr?.split('\n')[0]})`, checks: meta ? `${meta.checks.length - nFail}/${meta.checks.length}` : '-', ran_at: meta?.ran_at });
}
const md = `# Worked examples: the Design Studio, end to end

Six scripted walkthroughs. Each one calls the studio's exported handlers (or, for the co-design demo, the MCP server over stdio), writes everything it got back to \`output.json\`, and generates its own README from those JSON values. So every number quoted in an example README is copied from its output.json together with its provenance kind.
Each script also checks its result against what its README claims, and exits non-zero on anything unexpected, so the set doubles as a regression test.

\`\`\`bash
node sim-engine/examples/run-all.mjs          # all six; rewrites this file
node sim-engine/examples/d-altitude/run.mjs   # or one at a time
\`\`\`

## Last run

| example | what it shows | headline (copied from output.json) | checks passed | exit |
|---|---|---|---|---|
${rows.map(r => `| [${r.dir}](${r.dir}/README.md) | ${r.what} | ${r.headline.replace(/\|/g, '\\|')} | ${r.checks} | ${r.status === 0 ? 'ok' : '**' + r.status + '**'} |`).join('\n')}

Run at ${new Date().toISOString()} on ${process.version}. ${failed ? `**${failed} example(s) reported an unexpected result.** Each one's README starts with the failed checks and keeps them visible; they are studio defects reported to the hub, not worked around.` : 'Every check passed.'}

## Ground rules the examples follow

- Read \`weakest_input\` / the provenance \`kind\` before the number. **calibrated** numbers (tuned to reproduce one observation) are never presented as results, and **assumed** inputs (including every what-if) are labelled where they are used.
- Lean verdicts are floating-point evaluations of Lean-backed formulas, not kernel proofs.
- Organism edits are morphology (a shape), not genetics. Nothing here claims a genotype, a viable animal or a breedable one.
- No Aves (bird) data anywhere: Aves is DELPHI's frozen holdout. No credentials. Example scripts write only inside their own folder. The co-design demo points the server's session store at a temp folder.
`;
fs.writeFileSync(path.join(HERE, 'README.md'), md);
console.log(`\n${rows.length - failed}/${rows.length} examples as expected`);
process.exitCode = failed ? 1 : 0;
