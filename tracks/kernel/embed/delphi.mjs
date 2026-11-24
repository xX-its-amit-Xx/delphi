#!/usr/bin/env node
// delphi — put the DELPHI method inside a project that already exists.
//
//   delphi init                     make a .delphi/ store, a best-practice doc and a laws/ folder here
//   delphi evidence …               record a source and the words read in it
//   delphi fact …                   record a measured number, under that evidence
//   delphi audit <file.lean>        copy a Lean file into laws/ with one axiom-audit line per theorem
//   delphi law …                    record a statement a prover accepted, with its axiom audit
//   delphi verdict …                apply a law to facts: inside | outside | cannot-assess
//   delphi build …                  mint an artifact, or get a refusal naming what was missing
//   delphi verify                   recompute every id and every chain link
//   delphi doctor                   is this project's record still sound: files, hashes, proofs, stalls
//   delphi log | summary            what is in the store
//   delphi trace <id> | why <text>  walk anything back to the quotes underneath it
//   delphi graph                    rewrite the project's private knowledge graph
//   delphi best-practices           print the generated method document
//
//   --json on any read command; --project <dir> to work on a store that is not above the cwd.
//
// One design decision worth stating: every command that mints a node rewrites the project's knowledge
// graph before it exits. That is what "published immediately" means here — published into the project,
// in a directory the project owns, with no socket opened and no registry contacted. Publishing to an
// outside registry stays a human decision, because it is irreversible and it needs the signing key's
// owner.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Kernel, { Refused } from '../kernel.mjs';
import { publish as publishGraph } from './graph.mjs';
import { doc as bestPracticeDoc, check as bestPracticeCheck } from './best-practices.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// ---------------------------------------------------------------------------------------------------
// arguments: --flag value, repeatable. Nothing clever, and no dependency.

function parse(argv) {
  const flags = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split(/=(.*)/s);
      const v = inline !== undefined ? inline : (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true);
      if (flags[k] === undefined) flags[k] = v;
      else flags[k] = [].concat(flags[k], v);
    } else rest.push(a);
  }
  return { flags, rest };
}
const list = (v) => (v === undefined ? [] : [].concat(v));
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };

// ---------------------------------------------------------------------------------------------------
// finding the project

const CONFIG = 'config.json';

function findProject(from) {
  let dir = path.resolve(from);
  for (;;) {
    const c = path.join(dir, '.delphi', CONFIG);
    if (fs.existsSync(c)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function open(flags) {
  const root = flags.project ? path.resolve(String(flags.project)) : findProject(process.cwd());
  if (!root) die('no .delphi/ in this directory or any above it. Run `delphi init` first, or pass --project <dir>.');
  const cfg = JSON.parse(fs.readFileSync(path.join(root, '.delphi', CONFIG), 'utf8'));
  const K = new Kernel({ file: path.join(root, '.delphi', 'store', 'nodes.jsonl'), root });
  return { root, cfg, K, dir: path.join(root, '.delphi') };
}

// Rewrite the graph. Called after every mint, so the project's own record is never behind the store.
function regraph(root, cfg, K, { quiet = false } = {}) {
  const r = publishGraph(K.lines, path.join(root, '.delphi', cfg.graph_dir ?? 'graph'), {
    title: cfg.title ?? `What ${cfg.project} has checked`,
    base: cfg.namespace,
  });
  if (!quiet) console.log(`graph    ${r.nodes} node(s), ${r.edges} edge(s) -> ${path.relative(root, r.dir).split(path.sep).join('/')}/ (index.html, graph.json, graph.jsonld)`);
  return r;
}

const show = (flags, obj, text) => { if (flags.json) console.log(JSON.stringify(obj, null, 1)); else text(); };
const short = (s, n = 110) => (s == null ? '' : String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

function refused(e) {
  if (!(e instanceof Refused)) throw e;
  console.error(`REFUSED  ${e.what}`);
  for (const b of e.because) console.error(`         - ${b}`);
  if (e.refusal) console.error(`\nThe refusal is itself a record: ${e.refusal}. It is the shortest list of what would have to\nbe true for this artifact to be honest, so it is worth publishing rather than hiding.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------
// init

const GITIGNORE = `# The store, the laws and the generated graph are the project's record: keep them in version
# control. A diff on nodes.jsonl reads as a history of what was decided and on what grounds.
# Nothing in .delphi/ is a secret, and nothing in it is sent anywhere.
`;

function cmdInit(flags) {
  const root = path.resolve(String(flags.project ?? flags.dir ?? process.cwd()));
  const dir = path.join(root, '.delphi');
  const existing = findProject(root);
  if (fs.existsSync(path.join(dir, CONFIG)) && !flags.force) die(`${path.relative(process.cwd(), dir) || '.delphi'} already exists. Nothing was changed; pass --force to rewrite its config and docs.`);
  if (existing && existing !== root && !flags.force) die(`there is already a DELPHI project at ${existing}. Nothing was changed; a store per repository is usually what you want. Pass --force to make a second one here.`);

  const project = String(flags.name ?? path.basename(root));
  const cfg = {
    project,
    created: new Date().toISOString().slice(0, 10),
    kernel: 'delphi kernel, five primitives: evidence -> fact -> law -> verdict -> build',
    store: 'store/nodes.jsonl',
    graph_dir: 'graph',
    laws_dir: 'laws',
    // Identifiers in the generated JSON-LD. Local by default: the graph names nodes under the
    // project's own namespace rather than claiming identifiers in anybody else's.
    namespace: String(flags.namespace ?? `https://example.org/${project.replace(/[^\w-]/g, '-').toLowerCase()}/delphi/`),
    title: flags.title ? String(flags.title) : null,
  };
  for (const d of ['store', cfg.graph_dir, cfg.laws_dir]) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify(cfg, null, 1) + '\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), GITIGNORE);
  const store = path.join(dir, 'store', 'nodes.jsonl');
  if (!fs.existsSync(store)) fs.writeFileSync(store, '');
  fs.writeFileSync(path.join(dir, 'BEST_PRACTICES.md'), bestPracticeDoc({ project, cmd: 'delphi' }));
  const K = new Kernel({ file: store, root });
  regraph(root, cfg, K, { quiet: true });

  console.log(`initialised  ${path.relative(process.cwd(), dir) || '.delphi'}`);
  console.log(`project      ${project}`);
  console.log(`store        .delphi/store/nodes.jsonl  (append-only, one record per line, commit it)`);
  console.log(`method       .delphi/BEST_PRACTICES.md  (generated; regenerate with \`delphi best-practices\`)`);
  console.log(`graph        .delphi/graph/index.html   (rewritten after every mint, private to this project)`);
  console.log(`laws         .delphi/laws/              (put your Lean files here)`);
  console.log('');
  console.log('Next: record the source of one number you already rely on.');
  console.log('  delphi evidence --kind doi --ref <doi> --quote "<the words it prints>" --where "<table or section>"');
  console.log('');
  console.log('Lean files are checked by the checker that ships beside the kernel, which needs a Lean 4');
  console.log('toolchain on this machine. Without one, `delphi law --lean` is refused as unchecked, never');
  console.log('passed. A law given with --script instead says on its record that a script checked it.');
}

// ---------------------------------------------------------------------------------------------------
// minting

function cmdEvidence(flags, { root, cfg, K }) {
  try {
    const n = K.evidence({
      kind: String(flags.kind ?? ''),
      ref: flags.ref === undefined ? null : String(flags.ref),
      quote: flags.quote === undefined ? null : String(flags.quote),
      where: flags.where === undefined ? null : String(flags.where),
      primary: flags['not-primary'] ? false : true,
      retrieved: flags.retrieved ? String(flags.retrieved) : null,
      note: flags.note ? String(flags.note) : null,
    });
    console.log(`evidence ${n.id}  ${n.kind}:${n.ref}`);
    regraph(root, cfg, K);
    return n;
  } catch (e) { refused(e); }
}

function conditionsFrom(flags) {
  const c = {};
  for (const kv of list(flags.condition)) {
    const [k, ...v] = String(kv).split('=');
    if (!v.length) die(`--condition wants key=value, got ${JSON.stringify(String(kv))}`);
    const raw = v.join('=');
    c[k] = raw === 'true' ? true : raw === 'false' ? false : raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  }
  if (flags['conditions-unknown']) c.unknown = true;
  return c;
}

function cmdFact(flags, { root, cfg, K }) {
  try {
    const n = K.fact({
      statement: flags.statement === undefined ? null : String(flags.statement),
      quantity: flags.quantity === undefined ? null : String(flags.quantity),
      // Pass a non-numeric value through as the text it was, so the refusal names what was typed.
      // Coercing it to NaN first makes the kernel report "got null", which hides the user's own input.
      value: flags.value === undefined ? undefined : Number.isNaN(Number(flags.value)) ? String(flags.value) : Number(flags.value),
      unit: flags.unit === undefined ? null : String(flags.unit),
      conditions: conditionsFrom(flags),
      evidence: list(flags.evidence).map(String),
      note: flags.note ? String(flags.note) : null,
    });
    console.log(`fact     ${n.id}  ${n.quantity} = ${n.value} ${n.unit}`);
    regraph(root, cfg, K);
    return n;
  } catch (e) { refused(e); }
}

function cmdLaw(flags, { root, cfg, K, dir }) {
  // A law file given as a bare name is looked for in the project's laws/ folder, so the usual case is
  // `--lean Margins.lean`.
  let lean = flags.lean ? String(flags.lean) : null;
  if (lean) {
    const asGiven = path.isAbsolute(lean) ? lean : path.join(root, lean);
    const inLaws = path.join(dir, cfg.laws_dir ?? 'laws', lean);
    if (!fs.existsSync(asGiven) && fs.existsSync(inLaws)) lean = path.relative(root, inLaws).split(path.sep).join('/');
  }
  try {
    const n = K.law({
      name: flags.name === undefined ? null : String(flags.name),
      informal: flags.informal === undefined ? null : String(flags.informal),
      lean_file: lean,
      lean_decls: list(flags.decl).map(String),
      script: flags.script ? String(flags.script) : null,
    });
    console.log(`law      ${n.id}  ${n.name}`);
    if (n.lean_file) console.log(`         ${n.lean_file}  ${n.audit?.verdict}  axioms [${(n.audit?.axioms ?? []).join(', ')}]  ${n.audit?.audited ?? '?'} declaration(s) audited`);
    if (n.script && !n.lean_file) console.log(`         checked by a script, NOT by a proof assistant: ${n.script}`);
    regraph(root, cfg, K);
    return n;
  } catch (e) { refused(e); }
}

// audit — make somebody's Lean file checkable without touching it. "0 sorry" cannot be confirmed from
// a file that never asks the prover to print its axioms, so this writes a COPY into the project's
// laws/ folder with one `#print axioms` line appended per theorem. The original is only read. What is
// printed is counts and a hash: no line of the audited file is echoed.
function cmdAudit(flags, rest, { root, cfg, dir }) {
  if (!rest[1]) die('audit needs a Lean file');
  const abs = path.isAbsolute(rest[1]) ? rest[1] : path.join(root, rest[1]);
  if (!fs.existsSync(abs)) die(`no such file: ${rest[1]}`);
  const src = fs.readFileSync(abs, 'utf8');
  const names = [...new Set([...src.matchAll(/^\s*(?:private\s+|protected\s+)?(?:theorem|lemma)\s+([A-Za-z_][\w'!?]*)/gm)].map((m) => m[1]))];
  const ns = [...src.matchAll(/^namespace\s+([A-Za-z_][\w.]*)/gm)].map((m) => m[1]);
  const prefix = ns.length ? ns.join('.') + '.' : '';
  const code = src.replace(/\/-[\s\S]*?-\//g, ' ').replace(/--[^\n]*/g, ' ');
  const counts = {
    declarations: names.length,
    audit_lines_as_published: (src.match(/^#print axioms/gm) ?? []).length,
    sorry_in_code: (code.match(/\bsorry\b/g) ?? []).length,
    hand_written_axioms: (src.match(/^\s*axiom\s+/gm) ?? []).length,
    imports: new Set([...src.matchAll(/^import\s+(\S+)/gm)].map((m) => m[1])).size,
  };
  const out = path.join(dir, cfg.laws_dir ?? 'laws', path.basename(abs).replace(/\.lean$/, '') + '.Audited.lean');
  const lines = names.map((n) => `#print axioms ${prefix}${n}`).join('\n');
  fs.writeFileSync(out, `${src}\n\n-- ===== ${names.length} axiom-audit line(s) appended by \`delphi audit\`. Not in the original. =====\n${lines}\n`);
  const relOut = path.relative(root, out).split(path.sep).join('/');
  show(flags, { file: rest[1], sha256: sha(src).slice(0, 16), counts, audited_copy: relOut }, () => {
    console.log(`audit    ${path.relative(root, abs).split(path.sep).join('/')}  sha256 ${sha(src).slice(0, 16)}`);
    console.log(`         ${counts.declarations} theorem(s) and lemma(s), ${counts.audit_lines_as_published} axiom-audit line(s) as published, ${counts.sorry_in_code} sorry in code, ${counts.hand_written_axioms} hand-written axiom(s), ${counts.imports} import(s)`);
    console.log(`         copy with ${names.length} audit line(s) appended -> ${relOut}  (the original was only read)`);
  });
}

// The check a verdict applies. Two honest ways to give it, and both end up in the record:
//   --expr "<javascript over the quantity names>"   recorded verbatim in the verdict's `by` field
//   --check <file.mjs>                              default export (values, facts) => {result, detail}
// An expression is evaluated with ONLY the quantities in scope — no require, no process, no globals
// reachable by name — because it comes from a command line and lands in a permanent record.
async function applyFrom(flags, root) {
  if (flags.expr) {
    const expr = String(flags.expr);
    return (values) => {
      const names = Object.keys(values);
      let fn;
      try { fn = new Function(...names, `"use strict"; return (${expr});`); }
      catch (e) { return { result: 'cannot-assess', detail: `the expression did not parse: ${e.message}` }; }
      let r;
      try { r = fn(...names.map((k) => values[k])); }
      catch (e) { return { result: 'cannot-assess', detail: `the expression failed: ${e.message}` }; }
      if (typeof r !== 'boolean') return { result: 'cannot-assess', detail: `the expression returned ${JSON.stringify(r)}, which is not true or false. A verdict needs a yes or a no.` };
      return { result: r ? 'inside' : 'outside', detail: `${expr}  with ${names.map((k) => `${k}=${values[k]}`).join(', ')}`, by: `expression: ${expr}` };
    };
  }
  if (flags.check) {
    const file = path.isAbsolute(String(flags.check)) ? String(flags.check) : path.join(root, String(flags.check));
    if (!fs.existsSync(file)) die(`--check file not found: ${flags.check}`);
    const mod = await import(`file://${file.split(path.sep).join('/')}`);
    const fn = mod.default ?? mod.apply;
    if (typeof fn !== 'function') die(`${flags.check} has no default export that is a function (values, facts) => {result, detail}`);
    const rel = path.relative(root, file).split(path.sep).join('/');
    return (values, facts) => ({ by: `script: ${rel}`, ...fn(values, facts) });
  }
  die('a verdict needs a check: --expr "<javascript over the quantity names>" or --check <file.mjs>');
}

async function cmdVerdict(flags, { root, cfg, K }) {
  if (!flags.law) die('--law <id> is required');
  const apply = await applyFrom(flags, root);
  try {
    const n = K.verdict({
      law: String(flags.law),
      facts: list(flags.fact).map(String),
      requires: list(flags.requires).map(String),
      label: flags.label ? String(flags.label) : null,
      apply,
    });
    console.log(`verdict  ${n.id}  ${n.result.toUpperCase()}  ${n.law_name}${n.label ? ` [${n.label}]` : ''}`);
    if (n.detail) console.log(`         ${n.detail}`);
    if (n.result === 'cannot-assess') console.log('         cannot-assess is not a pass. A build resting on this will be refused.');
    regraph(root, cfg, K);
    return n;
  } catch (e) { refused(e); }
}

function cmdBuild(flags, { root, cfg, K }) {
  const files = list(flags.file).map(String);
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.join(root, f);
    if (!fs.existsSync(abs)) die(`--file ${f} does not exist. Write the artifact first; build() records the hash of what is on disk.`);
  }
  try {
    const n = K.build({
      artifact: flags.artifact === undefined ? null : String(flags.artifact),
      verdicts: list(flags.verdict).map(String),
      facts: list(flags.fact).map(String),
      note: flags.note ? String(flags.note) : null,
      emit: () => files.map((f) => ({ path: f })),
    });
    console.log(`build    ${n.id}  ${n.artifact}`);
    for (const f of n.emitted ?? []) console.log(`         ${f.sha256}  ${String(f.bytes).padStart(8)}  ${f.path}`);
    regraph(root, cfg, K);
    return n;
  } catch (e) { refused(e); }
}

// ---------------------------------------------------------------------------------------------------
// reading

function trace(K, id, depth = 0, seen = new Set()) {
  const n = K.get(id);
  if (!n || seen.has(id)) return [];
  seen.add(id);
  const pad = '  '.repeat(depth);
  const out = [];
  if (n.type === 'evidence') out.push(`${pad}evidence ${n.id}  ${n.kind}:${n.ref}  "${short(n.quote, 80)}"  (${short(n.where, 50)})`);
  if (n.type === 'fact') out.push(`${pad}fact     ${n.id}  ${n.quantity} = ${n.value} ${n.unit}  [${Object.entries(n.conditions ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')}]`);
  if (n.type === 'law') out.push(`${pad}law      ${n.id}  ${n.name}  ${n.lean_file ? `${n.lean_file} -> ${n.audit?.verdict} axioms[${(n.audit?.axioms ?? []).join(', ')}]` : `script: ${short(n.script, 60)}`}`);
  if (n.type === 'verdict') out.push(`${pad}verdict  ${n.id}  ${n.result.toUpperCase()}  ${n.law_name}${n.label ? ` [${n.label}]` : ''}  ${short(n.detail, 90)}`);
  if (n.type === 'build') out.push(`${pad}build    ${n.id}  ${n.artifact}  ${(n.emitted ?? []).length} file(s)`);
  if (n.type === 'refusal') out.push(`${pad}refusal  ${n.id}  ${n.what}${n.because.map((b) => `\n${pad}         - ${b}`).join('')}`);
  for (const key of ['verdicts', 'facts', 'evidence']) for (const r of n[key] ?? []) out.push(...trace(K, r, depth + 1, seen));
  if (n.law) out.push(...trace(K, n.law, depth + 1, seen));
  return out;
}

function cmdSummary(flags, { K, root }) {
  const s = K.summary();
  show(flags, s, () => {
    console.log(`store    ${path.relative(root, K.file).split(path.sep).join('/')}`);
    console.log(`nodes    ${s.nodes}${s.nodes ? `  (${Object.entries(s.by_type).map(([k, v]) => `${v} ${k}`).join(', ')})` : '  — nothing recorded yet'}`);
    console.log(`verdicts ${s.verdicts.inside} inside, ${s.verdicts.outside} outside, ${s.verdicts.cannot_assess} cannot-assess`);
    console.log(`builds   ${s.builds} minted, ${s.refusals} refused`);
    console.log(`chain    ${s.chain_problems === 0 ? 'every id and link recomputed clean' : s.chain_problems + ' PROBLEM(S) — run `delphi verify`'}`);
  });
}

function cmdLog(flags, { K }) {
  const want = flags.type ? String(flags.type) : null;
  const rows = K.all(want).slice(flags.tail ? -Number(flags.tail) : 0);
  show(flags, rows, () => rows.forEach((n) => console.log(trace(K, n.id).slice(0, 1).join('') || `${n.type}  ${n.id}`)));
}

function cmdVerify(flags, { K }) {
  const p = K.verify();
  show(flags, { problems: p }, () => console.log(p.length ? p.map((x) => 'PROBLEM  ' + x).join('\n') : `verified ${K.lines.length} node(s): every id matches its content and every chain link holds`));
  process.exit(p.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------
// doctor — the check worth putting in CI. Everything here can go wrong without anyone touching the
// store: a source file moved, an artifact regenerated, a proof file edited after it was accepted.

function cmdDoctor(flags, { root, K, cfg }) {
  const problems = [], notes = [];
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(root, p));

  for (const p of K.verify()) problems.push(`store: ${p}`);

  // evidence of kind `file` points at something in this project; it should still be there
  for (const e of K.all('evidence').filter((n) => n.kind === 'file')) {
    if (!fs.existsSync(abs(e.ref))) problems.push(`evidence ${e.id} cites the file ${e.ref}, which is not there any more`);
  }

  // a law's proof file must still exist and still be the bytes that were accepted
  for (const l of K.all('law').filter((n) => n.lean_file)) {
    if (!fs.existsSync(abs(l.lean_file))) { problems.push(`law ${l.name} (${l.id}) was proved from ${l.lean_file}, which is gone`); continue; }
    const now = sha(fs.readFileSync(abs(l.lean_file), 'utf8')).slice(0, 16);
    if (l.lean_sha && now !== l.lean_sha) problems.push(`law ${l.name} (${l.id}) was accepted from ${l.lean_file} at ${l.lean_sha}; the file is now ${now}. Re-run \`delphi law\` so the record names the bytes that were checked.`);
  }

  // an artifact's files must still be the bytes the build hashed
  for (const b of K.all('build')) {
    for (const f of b.emitted ?? []) {
      if (!fs.existsSync(abs(f.path))) { problems.push(`build ${b.artifact} (${b.id}) emitted ${f.path}, which is gone`); continue; }
      const now = sha(fs.readFileSync(abs(f.path), 'utf8')).slice(0, 16);
      if (now !== f.sha256) problems.push(`build ${b.artifact} (${b.id}) recorded ${f.path} at ${f.sha256}; the file on disk is ${now}. Either it was regenerated without a new build, or it was edited by hand.`);
    }
  }

  // the repair cap. A check that answers nothing twice over is not a check that needs running a third
  // time; it needs a person. This is the one rule the kernel does not enforce on its own, so the
  // doctor raises it rather than leaving it to be noticed.
  const stalls = new Map();
  for (const v of K.all('verdict').filter((n) => n.result === 'cannot-assess')) {
    const key = `${v.law_name}${v.label ? ` [${v.label}]` : ''}`;
    stalls.set(key, [...(stalls.get(key) ?? []), v]);
  }
  for (const [key, vs] of stalls) {
    if (vs.length >= 2) notes.push(`${key} has answered nothing ${vs.length} times (${vs.map((v) => v.id).join(', ')}). Two runs that assess nothing is the point to stop re-running and ask a person: ${short(vs[vs.length - 1].detail, 120)}`);
  }

  // a law checked by a script is not a law checked by a prover, and the record says so; surface it
  const scripted = K.all('law').filter((n) => n.script && !n.lean_file);
  if (scripted.length) notes.push(`${scripted.length} law(s) are checked by a script, not by a proof assistant: ${scripted.map((l) => l.name).join(', ')}. Each record says so; this is a note, not a problem.`);

  const refusals = K.all('refusal');
  if (refusals.length) notes.push(`${refusals.length} refusal(s) on record. These are the most useful thing in the store to publish: \`delphi why <name>\` prints what each one was missing.`);

  show(flags, { problems, notes }, () => {
    for (const p of problems) console.log(`PROBLEM  ${p}`);
    for (const n of notes) console.log(`note     ${n}`);
    console.log(problems.length
      ? `\ndoctor: ${problems.length} problem(s), ${notes.length} note(s)`
      : `doctor: ${K.lines.length} node(s) sound — store chain, ${K.all('law').filter((l) => l.lean_file).length} proof file(s), ${K.all('build').reduce((a, b) => a + (b.emitted?.length ?? 0), 0)} artifact file(s) all match their recorded hashes; ${notes.length} note(s)`);
  });
  process.exit(problems.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------

async function main() {
  const { flags, rest } = parse(process.argv.slice(2));
  const cmd = rest[0] ?? 'summary';

  if (cmd === 'help' || flags.help) {
    console.log(fs.readFileSync(path.join(HERE, 'delphi.mjs'), 'utf8').split('\n').slice(1).filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  if (cmd === 'init') return cmdInit(flags);
  if (cmd === 'best-practices') {
    if (flags.check) {
      const { total, missing } = bestPracticeCheck();
      if (missing.length) { missing.forEach((m) => console.error(`MISSING GUARD  ${m.rule}`)); process.exit(1); }
      console.log(`best practices: all ${total} rule(s) still enforced by a guard in the kernel`);
      return;
    }
    const P = flags.project || findProject(process.cwd()) ? open(flags) : null;
    const text = bestPracticeDoc(P ? { project: P.cfg.project } : {});
    if (flags.write && P) {
      fs.writeFileSync(path.join(P.dir, 'BEST_PRACTICES.md'), text);
      console.log(`wrote    .delphi/BEST_PRACTICES.md  (${Buffer.byteLength(text)} bytes, generated from the kernel's own guards)`);
    } else process.stdout.write(text);
    return;
  }

  const P = open(flags);
  switch (cmd) {
    case 'evidence': return void cmdEvidence(flags, P);
    case 'fact': return void cmdFact(flags, P);
    case 'audit': return void cmdAudit(flags, rest, P);
    case 'law': return void cmdLaw(flags, P);
    case 'verdict': return void (await cmdVerdict(flags, P));
    case 'build': return void cmdBuild(flags, P);
    case 'verify': return cmdVerify(flags, P);
    case 'doctor': return cmdDoctor(flags, P);
    case 'summary': return cmdSummary(flags, P);
    case 'log': return cmdLog(flags, P);
    case 'graph': return void regraph(P.root, P.cfg, P.K);
    case 'trace': {
      if (!rest[1]) die('trace needs a node id');
      const lines = trace(P.K, rest[1]);
      return show(flags, { id: rest[1], trace: lines }, () => console.log(lines.length ? lines.join('\n') : `no node ${rest[1]} in the store`));
    }
    case 'why': {
      const needle = (rest[1] ?? '').toLowerCase();
      const hits = [...P.K.all('build'), ...P.K.all('refusal')].filter((n) => (n.artifact ?? n.what ?? '').toLowerCase().includes(needle));
      if (!hits.length) die(`no build or refusal whose name contains "${rest[1] ?? ''}"`, 1);
      return show(flags, hits.map((h) => ({ node: h, trace: trace(P.K, h.id) })), () => hits.forEach((h) => { console.log(trace(P.K, h.id).join('\n')); console.log(''); }));
    }
    default:
      die(`unknown command "${cmd}". Try: init, evidence, fact, audit, law, verdict, build, verify, doctor, summary, log, trace, why, graph, best-practices, help`);
  }
}

main().catch((e) => { console.error(e?.stack ?? String(e)); process.exit(1); });
