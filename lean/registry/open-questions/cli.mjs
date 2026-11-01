#!/usr/bin/env node
// CLI for the open questions, failed theorems and the guard. Same handlers as the MCP tools (openq-tools.mjs),
// so the CLI and the tools can never disagree.
//
//   node lean/registry/open-questions/cli.mjs questions [--status open] [--formalised] [--touches <id>] [--text <s>]
//   node lean/registry/open-questions/cli.mjs question <id> [--recompute]
//   node lean/registry/open-questions/cli.mjs failed
//   node lean/registry/open-questions/cli.mjs guard --statement "<plain-English law statement>" [--law-id <id>]
//   node lean/registry/open-questions/cli.mjs check          validate every record + run the guard over the registry
//
// The same subcommands are proposed for mcp/cli.mjs and sim-engine/lean-cli.mjs in sim-engine/tools/OPENQ-REGISTER.md.
import { OPENQ_TOOLS } from './openq-tools.mjs';
import { load, summary, validateRecord, guardAllLaws, openQuestions, disputeDrift, armDrift } from './openq-lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
const bool = n => argv.includes('--' + n);
const J = v => process.stdout.write(JSON.stringify(v, null, 2) + '\n');
const call = async (name, args) => J((await OPENQ_TOOLS.find(t => t.name === name).handler(args)));

if (cmd === 'questions') {
  await call('lean_open_questions', { status: flag('status'), formalised: bool('formalised') || undefined, touches: flag('touches'), text: flag('text'), include_failed: !bool('no-failed') });
} else if (cmd === 'question') {
  if (!argv[1]) { console.error('usage: cli.mjs question <id> [--recompute]'); process.exit(2); }
  await call('lean_open_question', { id: argv[1], recompute: bool('recompute') });
} else if (cmd === 'failed') {
  J(load().failed);
} else if (cmd === 'guard') {
  const s = flag('statement');
  if (!s) { console.error('usage: cli.mjs guard --statement "<text>" [--law-id <id>] [--theorem <name>]'); process.exit(2); }
  const r = await OPENQ_TOOLS.find(t => t.name === 'lean_open_question_guard').handler({ statement_en: s, law_id: flag('law-id'), lean_theorem: flag('theorem'), lean_structure: flag('structure') });
  J(r);
  process.exit(r.result.would_be_refused ? 1 : 0);
} else if (cmd === 'check') {
  const reg = load();
  const errs = [];
  for (const rec of reg.all) errs.push(...validateRecord(rec));
  errs.push(...disputeDrift({ reg }), ...armDrift({ reg }));
  for (const b of guardAllLaws({ questions: openQuestions(reg) })) for (const v of b.violations) errs.push(`GUARD: law ${b.law_id} (${b.status}) asserts ${v.question_id}/${v.arm_id}`);
  if (errs.length) { errs.forEach(e => console.error('FAIL ' + e)); process.exit(1); }
  const s = summary({ reg });
  console.log(`ok: ${s.counts.questions} questions (${s.counts.open} open), ${s.counts.failed_theorems} failed theorems, ${s.counts.requirements} requirement records; no law asserts an open arm.`);
} else {
  console.error(`usage: node lean/registry/open-questions/cli.mjs <command>

  questions [--status open|settled|abandoned] [--formalised] [--touches <id>] [--text <s>] [--no-failed]
  question <id> [--recompute]      one full record (oq-*, ft-* or cr-*)
  failed                           every failed-theorem record
  guard --statement "<text>"       would this law be refused for asserting an open arm? exit 1 if yes
  check                            validate every record and run the guard over the registry`);
  process.exit(2);
}
