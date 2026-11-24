#!/usr/bin/env node
// The best-practice document, generated from the kernel's own refusals.
//
//   node tracks/kernel/embed/best-practices.mjs            print it
//   node tracks/kernel/embed/best-practices.mjs --check     every rule still has a guard behind it
//
// A best-practice document that is written by hand drifts away from the code within a month, and then
// it is worse than nothing: it tells a reader a rule is enforced when it is not. So every rule below
// names the line in kernel.mjs that enforces it, and `--check` reads kernel.mjs and fails if that line
// has gone. A rule nobody can point at a guard for belongs in the "asks of you" section instead, where
// it is marked as a habit and not as something the machine will catch.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KERNEL = path.join(HERE, '..', 'kernel.mjs');

// Each rule: what to do, why, and the exact text in kernel.mjs that makes it true. The `guard` string
// is matched literally against kernel.mjs, so a refactor that removes the check fails --check.
export const RULES = [
  {
    primitive: 'evidence',
    rule: 'Record the words the source itself prints, and where they are printed.',
    why: 'A number retyped from memory, or from another paper quoting the first, is the failure that is hardest to find later: it looks identical to a good one. The quote and the locator are what let a reader check it in ten seconds.',
    guard: "why.push('no quote: evidence must carry the words the record itself prints')",
  },
  {
    primitive: 'evidence',
    rule: 'Cite the record that measured it, never a record that quotes the measurement.',
    why: "A review's restatement of someone else's number drops the conditions and sometimes the meaning. This is a rule the paper watcher in this repo learned by getting it wrong.",
    guard: "why.push('not primary: a record quoting another record is not evidence; cite the record that measured it')",
  },
  {
    primitive: 'fact',
    rule: 'A measurement is a finite number with a unit.',
    why: '"about sixteen" reached a verdict as NaN here once, and NaN compares false against everything, so the check silently passed.',
    guard: 'why.push(`no finite value (got ${JSON.stringify(value)})`)',
  },
  {
    primitive: 'fact',
    rule: 'State the conditions the number was measured in, or state that they are unknown.',
    why: 'Conditions are what decide whether two numbers may appear in the same inequality. A number without them cannot be filtered for compatibility later, which is the whole reason for keeping provenance at all.',
    guard: "why.push('no conditions: say the host, medium and temperature the number was measured in, or {unknown:true} and say so')",
  },
  {
    primitive: 'fact',
    rule: 'No fact without evidence under it.',
    why: 'This is the link that makes every later number traceable to a page in a paper.',
    guard: "why.push('no evidence: a fact cannot exist without a primary record')",
  },
  {
    primitive: 'law',
    rule: 'A formal claim must ask for its own axioms to be printed.',
    why: '"Machine-checked, 0 sorry" is not checkable from a file that never asks the prover to print what it depended on. Three different things can be true of such a file, and one of them is a hand-written axiom that passes every grep for `sorry`.',
    guard: 'has ${thms.length} theorem(s) and no "#print axioms" line',
  },
  {
    primitive: 'law',
    rule: 'The proof must rest on the standard axioms only.',
    why: 'An `axiom` line assumes the result. It is the quietest way to have a theorem that says nothing.',
    guard: 'why.push(`proof rests on non-standard axioms: ${extra.join(\', \')}`)',
  },
  {
    primitive: 'law',
    rule: 'Write the law in a sentence a person can read before writing it in a prover.',
    why: 'A law nobody can state in plain words cannot be applied honestly, and cannot be argued with by the person who knows the subject.',
    guard: "why.push('no plain statement: a law nobody can read in a sentence cannot be applied honestly')",
  },
  {
    primitive: 'verdict',
    rule: 'A missing input is `cannot-assess`, never a pass.',
    why: 'This is the bug the whole kernel exists for. A check whose input is absent returns true in almost every codebase written without thinking about it.',
    guard: "result = 'cannot-assess'; detail = `missing input(s): ${missing.join(', ')}`",
  },
  {
    primitive: 'verdict',
    rule: 'Numbers measured under different conditions are not put in one inequality.',
    why: 'Two correct numbers and one correct theorem still give a wrong answer if the numbers come from different hosts or standards.',
    guard: 'return `inputs were measured under different ${key}',
  },
  {
    primitive: 'build',
    rule: 'No artifact unless every verdict under it is `inside`. The refusal is itself a record.',
    why: 'The refusal is usually the useful output: it is the shortest list of things that would have to be measured for the artifact to be honest.',
    guard: "why.push('no verdicts: an artifact with nothing checked about it is not a build')",
  },
  {
    primitive: 'store',
    rule: 'Append only, and name every record by the hash of its own content.',
    why: 'A number edited after the fact changes its name; a line removed breaks the chain. Both are then findable by a command instead of by luck.',
    guard: "problems.push(`line ${i + 1}: id ${rec.id} does not match its content (edited after writing)`)",
  },
];

// Habits the kernel cannot check. They are listed separately and marked, so nobody reads them as
// guarantees.
export const HABITS = [
  ['Say how you read the source.', 'Full text, named sections, the abstract, or a figure read by eye. A finding about one paper can never be stronger than the read of that paper. A settled fact resting on an abstract wants a better citation, not a weaker claim.'],
  ['A negative result needs its measure named.', '"0 of 950 by scaffold match" is a finding. "No prior work exists" is usually an artifact of the one measure you tried. Test a second way that could have found it.'],
  ['Your own reports are not sources.', 'Citing your own brief turns one early mistake into a consensus and hides it from correction. Open the record the brief cites and cite that.'],
  ['Make the check fail once.', 'A guard that refuses everything passes every "must refuse" test. Inject one deliberate fault at a time and confirm each is caught alone, with everything else left valid.'],
  ['A law that is kernel-valid can still say nothing.', 'Contradictory hypotheses prove anything, and no script catches that. A formal statement matching the biology it is named after needs a reader.'],
];

export function doc({ project = 'your project', cmd = 'delphi' } = {}) {
  const L = [];
  L.push('# Embedding the DELPHI method');
  L.push('');
  L.push('This document is generated. Every rule in the first table names the guard in the kernel that');
  L.push('enforces it, and `best-practices.mjs --check` fails if that guard is removed, so this file cannot');
  L.push('quietly become a description of a rule nobody enforces any more.');
  L.push('');
  L.push('## The one idea');
  L.push('');
  L.push('The recurring failure in research code is not a wrong number. It is a **true claim nobody can');
  L.push('check** — a theorem with no axiom audit, a figure whose input was inferred rather than read, a');
  L.push('check that quietly became a pass because an input was missing. Those are one bug: an artifact that');
  L.push('outlived its justification.');
  L.push('');
  L.push('The method is to make the justification the only route to the artifact. Five calls, in order:');
  L.push('');
  L.push('```');
  L.push('  evidence ──► fact ──┐');
  L.push('                      ├──► verdict ──► build ──► your files');
  L.push('  law ────────────────┘        │');
  L.push('                               └──► refusal (and no files)');
  L.push('```');
  L.push('');
  L.push('Nothing else is trusted. The kernel does not search literature, fit a model or render a page; it');
  L.push(`refuses those. ${project} keeps doing all of that — it just cannot emit a result without passing`);
  L.push('through the five calls above.');
  L.push('');
  L.push('## The rules the kernel enforces');
  L.push('');
  L.push('| at | rule | why |');
  L.push('|---|---|---|');
  for (const r of RULES) L.push(`| \`${r.primitive}\` | ${r.rule} | ${r.why} |`);
  L.push('');
  L.push('## The habits it cannot enforce');
  L.push('');
  L.push('These are not checked by anything. They are here because every one of them was learned by getting');
  L.push('it wrong, and a reader of this file should know which half is machinery and which half is care.');
  L.push('');
  for (const [h, why] of HABITS) L.push(`- **${h}** ${why}`);
  L.push('');
  L.push('## Working in it');
  L.push('');
  L.push('```bash');
  L.push(`${cmd} evidence --kind doi --ref 10.1038/nchembio.1411 \\`);
  L.push('    --quote "yielding outputs of 16 and 0.1 REU" \\');
  L.push('    --where "Results, modelling the NAND circuit"');
  L.push('');
  L.push(`${cmd} fact --statement "PhlF ON level" --quantity output_on_REU --value 16 --unit REU \\`);
  L.push('    --condition host="E. coli" --condition strain=DH5alpha --evidence k1a2b3c4d');
  L.push('');
  L.push(`${cmd} law --name noise_margin --informal "the upstream OFF must sit below the downstream threshold" \\`);
  L.push('    --lean laws/Margins.lean --decl Delphi.margins_pos');
  L.push('');
  L.push(`${cmd} verdict --law kaaa --fact kbbb --fact kccc \\`);
  L.push('    --requires output_off_REU --requires threshold_REU \\');
  L.push('    --expr "threshold_REU - output_off_REU > 0" --label "PhlF -> ButR"');
  L.push('');
  L.push(`${cmd} build --artifact "the construct" --verdict kddd --file out/design.gb`);
  L.push('');
  L.push(`${cmd} verify        # recompute every id and every chain link`);
  L.push(`${cmd} why construct # the artifact, or the refusal, traced back to the quotes`);
  L.push(`${cmd} graph         # the whole store as a knowledge graph you can open`);
  L.push(`${cmd} doctor        # is this project's setup still sound`);
  L.push('```');
  L.push('');
  L.push('## Three things worth doing on day one');
  L.push('');
  L.push(`1. **Put \`${cmd} verify\` and \`${cmd} doctor\` in CI.** They are fast and they catch an edited store,`);
  L.push('   a missing source file and a law whose proof no longer checks.');
  L.push('2. **Make your refusals visible.** The list of things the kernel would not build is the most useful');
  L.push('   page you can publish: it is the shortest set of measurements that would unblock the work.');
  L.push('3. **Keep the store in version control.** It is append-only text, one JSON object per line, and a');
  L.push('   diff on it reads as a history of what was decided and on what grounds.');
  L.push('');
  return L.join('\n') + '\n';
}

// Every rule must still have its guard in kernel.mjs.
export function check() {
  const src = fs.readFileSync(KERNEL, 'utf8');
  const missing = RULES.filter((r) => !src.includes(r.guard));
  return { total: RULES.length, missing };
}

// Run as a command only when this file IS the entry point. `node -e` leaves argv[1] undefined, and
// an earlier version read it without checking, so importing RULES from another script crashed.
if (process.argv[1] && path.basename(process.argv[1]) === 'best-practices.mjs') {
  if (process.argv.includes('--check')) {
    const { total, missing } = check();
    if (missing.length) {
      for (const m of missing) console.error(`MISSING GUARD  ${m.primitive}: ${m.rule}\n               expected in kernel.mjs: ${m.guard}`);
      console.error(`${missing.length} of ${total} rule(s) in the best-practice doc have no guard behind them any more`);
      process.exit(1);
    }
    console.log(`best practices: all ${total} rule(s) still enforced by a guard in kernel.mjs, ${HABITS.length} habit(s) marked as unenforced`);
  } else {
    process.stdout.write(doc());
  }
}
