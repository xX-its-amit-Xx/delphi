#!/usr/bin/env node
// Lean laws from the command line: the same handlers as the MCP tools, JSON out.
//
//   node sim-engine/lean-cli.mjs laws [--kind biological] [--status accepted] [--scope genotype] [--lawset current] [--text fixation]
//   node sim-engine/lean-cli.mjs law <law_id>
//   node sim-engine/lean-cli.mjs lawset [current|<semver>]
//   node sim-engine/lean-cli.mjs check <design.json> [--lawset 1.2.0]
//   node sim-engine/lean-cli.mjs propose <file.lean> --meta meta.json
//   node sim-engine/lean-cli.mjs verify
//
// Add --result to print only the `result` part of the envelope. Exit 1 on error; `verify` exits 2 on drift.

import fs from 'node:fs';
import { LEAN_TOOLS } from './tools/lean-tools.mjs';

const T = Object.fromEntries(LEAN_TOOLS.map(t => [t.name, t.handler]));

export function parseArgs(argv) {
  const opts = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) opts[k] = true; else { opts[k] = n; i++; }
  }
  return { opts, pos };
}

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

export const COMMANDS = {
  laws: ({ opts }) => T.lean_laws_list({ kind: opts.kind, status: opts.status, scope: opts.scope, lawset: opts.lawset, text: opts.text }),
  law: ({ pos, opts }) => T.lean_law_get({ id: pos[0] ?? opts.id }),
  lawset: ({ pos, opts }) => T.lean_lawset_get({ version: pos[0] ?? opts.version ?? 'current' }),
  check: ({ pos, opts }) => {
    if (!pos[0]) throw new Error('usage: check <design.json> [--lawset <semver|current>]');
    return T.lean_check({ design: readJson(pos[0]), lawset: opts.lawset ?? 'current' });
  },
  propose: ({ pos, opts }) => {
    if (!pos[0]) throw new Error('usage: propose <file.lean> --meta meta.json');
    return T.lean_propose({ file: pos[0], meta: opts.meta ? readJson(opts.meta) : {} });
  },
  verify: () => T.lean_verify({}),
};

export async function run(argv) {
  const [cmd, ...rest] = argv;
  if (!COMMANDS[cmd]) throw Object.assign(new Error(`usage: node sim-engine/lean-cli.mjs <${Object.keys(COMMANDS).join('|')}> [args]`), { usage: true });
  const a = parseArgs(rest);
  const out = await COMMANDS[cmd](a);
  return { cmd, out: a.opts.result ? out.result : out };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { cmd, out } = await run(process.argv.slice(2));
    console.log(JSON.stringify(out, null, 1));
    if (cmd === 'verify' && (out.result ?? out).ok === false) process.exit(2);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
