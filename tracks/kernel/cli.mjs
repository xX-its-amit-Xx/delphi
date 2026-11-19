#!/usr/bin/env node
// Ask the kernel's store questions. Read-only: nothing here mints or changes a node.
//
//   node tracks/kernel/cli.mjs summary                what is in the store
//   node tracks/kernel/cli.mjs verify                 recompute every id and every chain link
//   node tracks/kernel/cli.mjs laws                   the laws, and what the Lean kernel said about each
//   node tracks/kernel/cli.mjs verdicts [inside|outside|cannot-assess]
//   node tracks/kernel/cli.mjs refusals               every artifact the kernel would not mint, and why
//   node tracks/kernel/cli.mjs builds                 every artifact it did mint, with file hashes
//   node tracks/kernel/cli.mjs trace <id>             walk one node back to the records under it
//   node tracks/kernel/cli.mjs why <substring>        the full justification of a build, by name
//
// add --json to any of them for the machine-readable form.

import path from 'node:path';
import Kernel, { ROOT } from './kernel.mjs';

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const args = argv.filter((a) => a !== '--json');
const cmd = args[0] ?? 'summary';
const K = new Kernel({ file: path.join(ROOT, 'tracks/kernel/store/nodes.jsonl') });
const out = (o, text) => { if (JSON_OUT) console.log(JSON.stringify(o, null, 1)); else text(); };
const short = (s, n = 110) => (s == null ? '' : String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

// walk a node back to the evidence underneath it
function trace(id, depth = 0, seen = new Set()) {
  const n = K.get(id);
  if (!n || seen.has(id)) return [];
  seen.add(id);
  const pad = '  '.repeat(depth);
  const lines = [];
  if (n.type === 'evidence') lines.push(`${pad}evidence ${n.id}  ${n.kind}:${n.ref}  "${short(n.quote, 80)}"  (${short(n.where, 50)})`);
  if (n.type === 'fact') lines.push(`${pad}fact     ${n.id}  ${n.quantity} = ${n.value} ${n.unit}  [${Object.entries(n.conditions ?? {}).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`).join(', ')}]`);
  if (n.type === 'law') lines.push(`${pad}law      ${n.id}  ${n.name}  ${n.lean_file ? `${n.lean_file} -> ${n.audit?.verdict} axioms[${(n.audit?.axioms ?? []).join(', ')}]` : `script: ${short(n.script, 60)}`}`);
  if (n.type === 'verdict') lines.push(`${pad}verdict  ${n.id}  ${n.result.toUpperCase()}  ${n.law_name} [${n.label ?? ''}]  ${short(n.detail, 90)}`);
  if (n.type === 'build') lines.push(`${pad}build    ${n.id}  ${n.artifact}  ${(n.emitted ?? []).length} file(s)`);
  if (n.type === 'refusal') lines.push(`${pad}refusal  ${n.id}  ${n.what}\n${pad}         because: ${n.because.map((b) => '\n' + pad + '           - ' + b).join('')}`);
  for (const key of ['verdicts', 'facts', 'evidence']) for (const r of n[key] ?? []) lines.push(...trace(r, depth + 1, seen));
  if (n.law) lines.push(...trace(n.law, depth + 1, seen));
  return lines;
}

switch (cmd) {
  case 'summary': {
    const s = K.summary();
    out(s, () => {
      console.log(`store    ${path.relative(ROOT, K.file).split(path.sep).join('/')}`);
      console.log(`nodes    ${s.nodes}  (${Object.entries(s.by_type).map(([k, v]) => `${v} ${k}`).join(', ')})`);
      console.log(`verdicts ${s.verdicts.inside} inside, ${s.verdicts.outside} outside, ${s.verdicts.cannot_assess} cannot-assess`);
      console.log(`builds   ${s.builds} minted, ${s.refusals} refused`);
      console.log(`chain    ${s.chain_problems === 0 ? 'every id and link recomputed clean' : s.chain_problems + ' PROBLEM(S) — run verify'}`);
    });
    break;
  }
  case 'verify': {
    const p = K.verify();
    out({ problems: p }, () => console.log(p.length ? p.map((x) => 'PROBLEM  ' + x).join('\n') : `verified ${K.lines.length} node(s): every id matches its content and every chain link holds`));
    process.exit(p.length ? 1 : 0);
  }
  case 'laws': {
    const laws = K.all('law');
    out(laws, () => laws.forEach((l) => {
      console.log(`${l.name}`);
      console.log(`  ${l.informal}`);
      if (l.lean_file) console.log(`  ${l.lean_file}  ${l.audit?.verdict}  ${l.audit?.audited ?? '?'} declaration(s) audited, axioms [${(l.audit?.axioms ?? []).join(', ')}], toolchain ${l.audit?.toolchain}`);
      if (l.script) console.log(`  checked by script, not by the Lean kernel: ${l.script}`);
      console.log('');
    }));
    break;
  }
  case 'verdicts': {
    const want = args[1];
    const vs = K.all('verdict').filter((v) => !want || v.result === want);
    out(vs, () => vs.forEach((v) => console.log(`${v.result.padEnd(13)} ${v.law_name.padEnd(30)} [${v.label ?? ''}]  ${short(v.detail, 120)}`)));
    break;
  }
  case 'refusals': {
    const rs = K.all('refusal');
    out(rs, () => rs.forEach((r) => { console.log(`REFUSED  ${r.what}`); r.because.forEach((b) => console.log(`         - ${b}`)); console.log(''); }));
    break;
  }
  case 'builds': {
    const bs = K.all('build');
    out(bs, () => bs.forEach((b) => { console.log(`BUILD    ${b.id}  ${b.artifact}`); (b.emitted ?? []).forEach((f) => console.log(`         ${f.sha256}  ${f.bytes.toString().padStart(8)}  ${f.path}`)); console.log(''); }));
    break;
  }
  case 'trace': {
    if (!args[1]) { console.error('trace needs a node id'); process.exit(2); }
    const lines = trace(args[1]);
    out({ id: args[1], trace: lines }, () => console.log(lines.length ? lines.join('\n') : `no node ${args[1]} in the store`));
    break;
  }
  case 'why': {
    const needle = (args[1] ?? '').toLowerCase();
    const hits = [...K.all('build'), ...K.all('refusal')].filter((n) => (n.artifact ?? n.what ?? '').toLowerCase().includes(needle));
    if (!hits.length) { console.error(`no build or refusal whose name contains "${args[1]}"`); process.exit(1); }
    out(hits.map((h) => ({ node: h, trace: trace(h.id) })), () => hits.forEach((h) => { console.log(trace(h.id).join('\n')); console.log(''); }));
    break;
  }
  default:
    console.error(`unknown command "${cmd}". Try: summary, verify, laws, verdicts, refusals, builds, trace <id>, why <substring>`);
    process.exit(2);
}
