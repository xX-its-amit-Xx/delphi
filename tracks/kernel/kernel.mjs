#!/usr/bin/env node
// DELPHI kernel — the small trusted core. Everything else in this repo is a client of it.
//
// The idea is the one a microkernel uses: make the trusted part tiny and make everyone go through it.
// The kernel does not search literature, design organisms, compile DNA or render pages. It does five
// things, and refuses the rest:
//
//   1. evidence(...)  records a primary record plus the exact words read in it. No quote, no evidence.
//   2. fact(...)      a measured quantity, which cannot exist without evidence.
//   3. law(...)       a statement whose Lean proof THIS kernel watched the Lean kernel accept, with the
//                     axioms it printed. A claim of "0 sorry" is not a law; an audited run is.
//   4. verdict(...)   a law applied to facts: inside | outside | cannot-assess. cannot-assess is a
//                     result, never a pass, and carries the reason.
//   5. build(...)     an artifact. Minted ONLY if every verdict it rests on is `inside`. Otherwise the
//                     kernel mints a `refusal` naming what was missing, and no artifact is produced.
//
// Store: tracks/kernel/store/nodes.jsonl, append-only, each line hash-chained to the previous one.
// A node's id is the sha256 of its own content, so a node cannot be edited without changing its name,
// and `verify` recomputes every id and every link.
//
// Why bother: in this repo the recurring failure is not a wrong number, it is a true claim nobody can
// check — a theorem with no axiom audit, a figure whose inputs were inferred, a verdict that quietly
// became a pass because an input was missing. Those are all the same bug: an artifact that outlived
// its justification. The kernel makes the justification the only way to get the artifact.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const KERNEL_VERSION = '0.2.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_STORE = path.join(HERE, 'store', 'nodes.jsonl');

// The three axioms Lean's own standard library rests on. Anything else is someone's assumption.
const ALLOWED_AXIOMS = ['propext', 'Classical.choice', 'Quot.sound'];

// ---------------------------------------------------------------------------------------------------
// canonical form and hashing

// Stable JSON: keys sorted at every depth, so the same content always hashes the same.
export function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// Fields that say WHEN something was done, not WHAT was decided. They are stored but not hashed, so
// re-running the same work does not mint a second node saying the same thing. `audit` is excluded for
// the same reason and is safe to exclude because `lean_sha` — the bytes the kernel actually checked —
// IS hashed: a different file is a different law, and the same file re-checked is the same law.
const VOLATILE = new Set(['prev', 'kernel', 'at', 'retrieved', 'audit', 'id']);
const hashable = (content) => Object.fromEntries(Object.entries(content).filter(([k]) => !VOLATILE.has(k)));
export const nodeId = (content) => 'k' + sha(canon(hashable(content))).slice(0, 16);

export class Refused extends Error {
  constructor(what, because) {
    super(`kernel refused to mint ${what}: ${because.join(' | ')}`);
    this.what = what;
    this.because = because;
  }
}

// ---------------------------------------------------------------------------------------------------
// the store

export class Kernel {
  constructor({ file = DEFAULT_STORE, leanCheck = realLeanCheck, root = ROOT } = {}) {
    this.file = file;
    // The directory relative paths are read against. It is this repo by default; a project that
    // embeds the kernel (tracks/kernel/delphi.mjs init) passes its own, so paths in its nodes are
    // relative to that project and mean the same thing on every machine that checks it out.
    this.root = root;
    // Memoised by the bytes checked, not by the file's name or the law's: identical bytes give the
    // Lean kernel nothing new to decide, and several laws proved in one file would otherwise start the
    // whole toolchain once each. The memo lives for this process only, so a changed file is rechecked.
    const seen = new Map();
    this.leanCheck = (abs) => {
      const key = sha(fs.readFileSync(abs, 'utf8'));
      if (!seen.has(key)) seen.set(key, leanCheck(abs));
      return seen.get(key);
    };
    this.nodes = new Map();
    this.lines = [];
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    const raw = fs.readFileSync(this.file, 'utf8').split('\n').filter((l) => l.trim());
    for (const l of raw) {
      const rec = JSON.parse(l);
      this.nodes.set(rec.id, rec);
      this.lines.push(rec);
    }
  }

  get(id) { return this.nodes.get(id); }
  all(type) { return this.lines.filter((n) => !type || n.type === type); }

  // Append a node. `prev` chains it to the line before, so a deletion or reorder is detectable.
  // A node whose content the store already holds is returned unchanged: saying the same thing twice
  // is not two facts.
  append(content) {
    const id = nodeId(content);
    if (this.nodes.has(id)) return this.nodes.get(id);
    const prev = this.lines.length ? this.lines[this.lines.length - 1].id : null;
    const body = { ...content, prev, kernel: KERNEL_VERSION };
    const rec = { id, ...body };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(rec) + '\n');
    this.nodes.set(id, rec);
    this.lines.push(rec);
    return rec;
  }

  // ------------------------------------------------------------------------------------------------
  // 1. evidence — a primary record and the words actually read in it

  evidence({ kind, ref, quote, where, primary = true, retrieved = null, note = null }) {
    const why = [];
    if (!kind || !['doi', 'pmcid', 'arxiv', 'nanopub', 'url', 'dataset', 'file'].includes(kind)) why.push(`unknown evidence kind ${JSON.stringify(kind)}`);
    if (!ref) why.push('no reference (a doi, pmcid, arxiv id, nanopub uri, url or file path)');
    if (!quote || !String(quote).trim()) why.push('no quote: evidence must carry the words the record itself prints');
    if (!where || !String(where).trim()) why.push('no locator: say where in the record the quote is (table, section, line)');
    // The rule the paper watcher learned the hard way: a number quoted by a review from someone else's
    // paper is not evidence from this record.
    if (primary !== true) why.push('not primary: a record quoting another record is not evidence; cite the record that measured it');
    if (why.length) throw new Refused('evidence', why);
    return this.append({ type: 'evidence', kind, ref, quote: String(quote).trim(), where, primary, retrieved, note });
  }

  // ------------------------------------------------------------------------------------------------
  // 2. fact — a measured quantity. Conditions are mandatory: a number without its conditions cannot
  //    be filtered for compatibility later, which is the whole reason provenance is kept.

  fact({ statement, quantity, value, unit, conditions = {}, evidence = [], note = null }) {
    const why = [];
    if (!statement) why.push('no statement');
    if (!quantity) why.push('no quantity name');
    // A measurement is a number. "about sixteen" is a sentence, and it reached a verdict as NaN
    // before this line required the type as well as the finiteness.
    if (typeof value !== 'number' || !Number.isFinite(value)) why.push(`no finite value (got ${JSON.stringify(value)})`);
    if (!unit) why.push('no unit (write "dimensionless" if it has none)');
    if (!evidence.length) why.push('no evidence: a fact cannot exist without a primary record');
    for (const e of evidence) {
      const n = this.get(e);
      if (!n) why.push(`evidence ${e} is not in the store`);
      else if (n.type !== 'evidence') why.push(`${e} is a ${n.type}, not evidence`);
    }
    if (!Object.keys(conditions).length) why.push('no conditions: say the host, medium and temperature the number was measured in, or {unknown:true} and say so');
    if (why.length) throw new Refused('fact', why);
    return this.append({ type: 'fact', statement, quantity, value, unit, conditions, evidence, note });
  }

  // ------------------------------------------------------------------------------------------------
  // 3. law — a statement the Lean kernel accepted, under audit, in front of this kernel.

  law({ name, informal, lean_file, lean_decls = [], script = null }) {
    const why = [];
    if (!name) why.push('no name');
    if (!informal) why.push('no plain statement: a law nobody can read in a sentence cannot be applied honestly');
    if (!lean_file && !script) why.push('no Lean file and no script: nothing to check');

    let audit = null, lean_sha = null;
    if (lean_file) {
      const abs = path.isAbsolute(lean_file) ? lean_file : path.join(this.root, lean_file);
      if (!fs.existsSync(abs)) why.push(`Lean file not found: ${lean_file}`);
      else {
        const src = fs.readFileSync(abs, 'utf8');
        lean_sha = sha(src).slice(0, 16);
        // If this exact file, under this exact name, has already been checked and accepted, do not
        // start the Lean toolchain again: the bytes are the same, so the kernel's answer is the same.
        const known = this.get(nodeId({ type: 'law', name, informal, lean_file, lean_sha, lean_decls, script }));
        if (known) return known;
        // Refuse before even running: the file must ask for its own axioms to be printed. This is the
        // hole that let a tidy-up turn a theorem into a placeholder here, and the hole that makes a
        // third party's "0 sorry" unverifiable from the file they published.
        const asked = [...src.matchAll(/^#print axioms\s+(\S+)/gm)].map((m) => m[1]);
        const thms = [...src.matchAll(/^\s*(?:private\s+|protected\s+)?(?:theorem|lemma)\s+([A-Za-z_][\w'!?]*)/gm)].map((m) => m[1]);
        if (!asked.length) why.push(`${lean_file} has ${thms.length} theorem(s) and no "#print axioms" line: nothing in it can be audited`);
        for (const d of lean_decls) {
          if (!thms.includes(d.split('.').pop())) why.push(`declaration ${d} is not a theorem in ${lean_file}`);
          if (!asked.some((a) => a === d || a.endsWith('.' + d.split('.').pop()))) why.push(`declaration ${d} has no "#print axioms" line`);
        }
        if (!why.length) {
          audit = this.leanCheck(abs);
          if (audit.verdict !== 'CHECKED') why.push(`the Lean kernel did not accept ${lean_file}: ${audit.verdict} ${audit.detail ?? ''}`.trim());
          else {
            const extra = (audit.axioms ?? []).filter((a) => !ALLOWED_AXIOMS.includes(a));
            if (extra.length) why.push(`proof rests on non-standard axioms: ${extra.join(', ')}`);
          }
        }
      }
    }
    if (why.length) throw new Refused(`law ${name}`, why);
    return this.append({ type: 'law', name, informal, lean_file, lean_sha, lean_decls, script, audit });
  }

  // ------------------------------------------------------------------------------------------------
  // 4. verdict — a law applied to facts.
  //
  // `apply` is the client's arithmetic; the kernel's job is to check that the inputs exist, that their
  // measurement conditions are compatible, and that a missing input becomes `cannot-assess` rather
  // than silently becoming a pass.

  verdict({ law, facts = [], apply, requires = [], label = null }) {
    const why = [];
    const lawNode = this.get(law);
    if (!lawNode) why.push(`law ${law} is not in the store`);
    else if (lawNode.type !== 'law') why.push(`${law} is a ${lawNode.type}, not a law`);
    if (!facts.length) why.push('no facts');
    const factNodes = [];
    for (const f of facts) {
      const n = this.get(f);
      if (!n) why.push(`fact ${f} is not in the store`);
      else if (n.type !== 'fact') why.push(`${f} is a ${n.type}, not a fact`);
      else factNodes.push(n);
    }
    if (why.length) throw new Refused('verdict', why);

    // every quantity the law needs must be present
    const have = new Set(factNodes.map((f) => f.quantity));
    const missing = requires.filter((q) => !have.has(q));

    // provenance compatibility: numbers measured in different hosts or media are not interchangeable
    const clash = incompatible(factNodes);

    let result, detail, by = 'kernel';
    if (missing.length) { result = 'cannot-assess'; detail = `missing input(s): ${missing.join(', ')}`; }
    else if (clash) { result = 'cannot-assess'; detail = clash; }
    else {
      const r = apply(Object.fromEntries(factNodes.map((f) => [f.quantity, f.value])), factNodes);
      if (!r || !['inside', 'outside'].includes(r.result)) { result = 'cannot-assess'; detail = r?.detail ?? 'the check returned no verdict'; }
      else { result = r.result; detail = r.detail ?? null; by = r.by ?? 'kernel'; }
    }
    return this.append({ type: 'verdict', law, law_name: lawNode.name, facts, label, result, detail, by });
  }

  // ------------------------------------------------------------------------------------------------
  // 5. build — the only way to get an artifact, and only if everything holds.

  build({ artifact, verdicts = [], facts = [], emit, note = null }) {
    const why = [];
    const vs = [];
    for (const v of verdicts) {
      const n = this.get(v);
      if (!n) why.push(`verdict ${v} is not in the store`);
      else if (n.type !== 'verdict') why.push(`${v} is a ${n.type}, not a verdict`);
      else vs.push(n);
    }
    for (const f of facts) {
      const n = this.get(f);
      if (!n) why.push(`fact ${f} is not in the store`);
      else if (n.type !== 'fact') why.push(`${f} is a ${n.type}, not a fact`);
    }
    if (!vs.length && !why.length) why.push('no verdicts: an artifact with nothing checked about it is not a build');
    for (const v of vs) {
      if (v.result === 'outside') why.push(`${v.law_name}${v.label ? ' (' + v.label + ')' : ''}: outside the law — ${v.detail ?? ''}`.trim());
      if (v.result === 'cannot-assess') why.push(`${v.law_name}${v.label ? ' (' + v.label + ')' : ''}: could not be assessed — ${v.detail ?? ''}`.trim());
    }
    if (why.length) {
      const refusal = this.append({ type: 'refusal', what: artifact, because: why, verdicts, facts });
      throw Object.assign(new Refused(artifact, why), { refusal: refusal.id });
    }
    // emit() writes the files and returns [{path, bytes}]; the kernel records their hashes so the
    // artifact on disk can be tied to this justification later.
    const written = (emit ? emit() : []).map((f) => {
      const abs = path.isAbsolute(f.path) ? f.path : path.join(this.root, f.path);
      return { path: path.relative(this.root, abs).split(path.sep).join('/'), sha256: sha(fs.readFileSync(abs, 'utf8')).slice(0, 16), bytes: fs.statSync(abs).size };
    });
    return this.append({ type: 'build', artifact, verdicts, facts, emitted: written, note });
  }

  // ------------------------------------------------------------------------------------------------
  // verify — recompute every id, every chain link, every reference.

  verify() {
    const problems = [];
    let prev = null;
    for (const [i, rec] of this.lines.entries()) {
      if (nodeId(rec) !== rec.id) problems.push(`line ${i + 1}: id ${rec.id} does not match its content (edited after writing)`);
      if (rec.prev !== prev) problems.push(`line ${i + 1}: chain broken (says prev=${rec.prev}, previous line is ${prev})`);
      for (const key of ['evidence', 'facts', 'verdicts']) {
        for (const ref of rec[key] ?? []) if (!this.nodes.has(ref)) problems.push(`line ${i + 1}: refers to ${ref}, which is not in the store`);
      }
      if (rec.type === 'law' && !this.nodes.has(rec.prev) && i > 0) problems.push(`line ${i + 1}: law chained to a missing node`);
      prev = rec.id;
    }
    return problems;
  }

  summary() {
    const by = {};
    for (const n of this.lines) by[n.type] = (by[n.type] ?? 0) + 1;
    const vs = this.all('verdict');
    return {
      nodes: this.lines.length,
      by_type: by,
      verdicts: { inside: vs.filter((v) => v.result === 'inside').length, outside: vs.filter((v) => v.result === 'outside').length, cannot_assess: vs.filter((v) => v.result === 'cannot-assess').length },
      builds: this.all('build').length,
      refusals: this.all('refusal').length,
      chain_problems: this.verify().length,
    };
  }
}

// ---------------------------------------------------------------------------------------------------
// conditions: when can two numbers be used in the same check?

// Two facts clash if they state the same condition differently. Unknown on one side is not a clash,
// it is a weaker claim, and it is reported in the verdict's detail by the caller.
const COMPARE = ['host', 'strain', 'medium', 'temperature_C', 'reference_standard'];
export function incompatible(facts) {
  for (const key of COMPARE) {
    const vals = [...new Set(facts.map((f) => f.conditions?.[key]).filter((v) => v !== undefined && v !== null))];
    if (vals.length > 1) {
      return `inputs were measured under different ${key}: ${vals.map((v) => JSON.stringify(v)).join(' vs ')}. A law applied across them would compare numbers that are not comparable.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------
// the real Lean check: run the repo's own checker and read what the kernel printed.

export function realLeanCheck(absFile) {
  const r = spawnSync('bash', [path.join(ROOT, 'tracks/lean/check.sh'), absFile], { cwd: ROOT, encoding: 'utf8', timeout: 900_000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const toolchain = (out.match(/toolchain:\s*(\S+)/) ?? [])[1] ?? null;
  const verdict = /ALL CHECKED/.test(out) ? 'CHECKED' : /no Lean toolchain/.test(out) ? 'NO-TOOLCHAIN' : 'REJECTED';
  const detail = (out.split('\n').find((l) => /^REJECTED|FAILED:/.test(l)) ?? '').trim() || null;
  // check.sh does not echo each theorem's own axiom line; on success it states the bound every
  // audited theorem was found to be within, and it FAILS the file if any theorem exceeds that bound
  // (its --probes mode exists to prove it does). So a CHECKED verdict is what licenses the bound,
  // and the kernel records which it is rather than re-deriving it.
  const bound = (out.match(/axioms within \[([^\]]*)\]/) ?? [])[1];
  const axioms = bound ? bound.split('|').map((s) => s.trim()).filter(Boolean) : [];
  const perTheorem = [...out.matchAll(/depends on axioms: \[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())).filter(Boolean);
  return {
    tool: 'tracks/lean/check.sh', toolchain, verdict, detail,
    axioms: [...new Set(perTheorem.length ? perTheorem : axioms)].sort(),
    axioms_are: perTheorem.length ? 'the axioms each audited theorem printed' : 'the bound check.sh confirmed every audited theorem was within',
    audited: (out.match(/audited=(\d+)/) ?? [])[1] ? Number((out.match(/audited=(\d+)/) ?? [])[1]) : null,
    at: new Date().toISOString(),
  };
}

export default Kernel;
