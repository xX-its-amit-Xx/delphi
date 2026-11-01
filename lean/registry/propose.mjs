#!/usr/bin/env node
// The lifecycle for a NEW law, from a person, an agent or an observation.
//
//   node lean/registry/propose.mjs <law.lean> --meta <meta.json> [--write] [--lawset <semver>] [--no-mutants]
//   import { propose } from './propose.mjs'; const result = await propose(file, meta, { write: false });
//
// Prints (CLI) or returns (import) one JSON object: {law_id, status, steps:{build, forbidden, axioms, witness,
// bridge, joint, mutants}, law, reasons}. Steps, each of which must pass for status 'candidate':
//   (a) build: the file compiles with `lake env lean` inside lean/ (it may import Mathlib and Delphi.*).
//   (b) forbidden: no `sorry`, `admit`, `axiom`, `unsafe` or `native_decide` outside comments; `#print axioms`
//       for the declared theorem/witness names only propext, Classical.choice, Quot.sound.
//   (c) witness: meta.lean.witness names a declaration in the file that compiles: a non-vacuity witness (an
//       instance of the hypothesis structure, or `Nonempty`/`∃` of it). A law nothing can satisfy is refused.
//   (d) joint: there is ONE assignment of the shared quantities satisfying every accepted law of the chosen law
//       set whose scope overlaps the proposal's AND the proposal (a Lean `theorem` constructing it). If instead
//       a contradiction with an accepted law is PROVED in Lean (linarith over the atoms), the proposal becomes
//       'contested' with both law ids; the accepted law is not replaced, and is not demoted automatically (its
//       file gets an `open_conflicts` entry for a human). If neither is proved, the proposal stays 'proposed'.
//       The shared-scope atoms are first proved EQUIVALENT to the proposal's Lean structure (bridge), so the
//       check is about the hypothesis itself, not a paraphrase.
//   (e) mutants: each relation in the structure/theorem statement is flipped (<= to >, < to >=, = to !=) in a
//       copy; every mutant must be rejected by the compiler.
//   (f) status 'candidate' (with --write: lean/registry/laws/<law_id>.json and the Lean file copied to
//       lean/registry/proposals/<law_id>/law.lean). Promotion to 'accepted' is NEVER done here: a person sets
//       approval.approved_by_role (a role, never a personal identifier) and cuts a law set with release.mjs.
//
// meta.json: {law_id, kind:'physical'|'biological', class, statement_en,
//   lean:{structure?, theorem?, witness, fields?:{<structure field>: <shared quantity>}},
//   shared_scope?:{atoms:[Lean Prop over q.<quantity>], quantities:{name:{unit,description}}, witness_values:{name:"decimal"}},
//   hypotheses:[], scope:{taxa:[], life_stages:[], ranges:{}}, evidence:{sources:[], observations:[], n_organisms?, n_observations?},
//   sources:[], origin:{by_role, kind:'human'|'agent'|'observation'|'machine-discovery'}}
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REG, ROOT, LAWS_DIR, STANDARD_AXIOMS, readJson, writeJson, loadLaws, loadLawset, contentHash, statementText, stripLeanComments, scratchDir, leanCheckAsync, parseAxioms, errorLines, scopesOverlap, sha256, gitHead } from './registry-lib.mjs';

const FORBIDDEN = [['sorry', /\bsorry\b/], ['admit', /\badmit\b/], ['axiom', /(^|\n)\s*(private\s+)?axiom\b/], ['unsafe', /\bunsafe\b/], ['native_decide', /\bnative_decide\b/]];

/** Fields of a Lean structure: [{name, type, data}] where data fields have type ℝ. */
export function structureFields(src, fq) {
  const txt = statementText(src, fq);
  if (!txt) return null;
  const code = stripLeanComments(src);
  const last = fq.split('.').pop();
  const m = new RegExp(`structure\\s+${last}[^\\n]*where\\n([\\s\\S]*?)(\\n\\s*\\n|$)`).exec(code);
  if (!m) return null;
  return m[1].split('\n').map(l => /^\s+([A-Za-z_][\w']*)\s*:\s*(.+?)\s*$/.exec(l)).filter(Boolean).map(x => ({ name: x[1], type: x[2], data: x[2] === 'ℝ' }));
}

const subst = (atom, map) => atom.replace(/\bq\.([A-Za-z_]\w*)/g, (_, k) => map[k] ?? `q.${k}`);
const lit = v => { const s = String(v); return /^-/.test(s) ? `(${s} : ℝ)` : `(${s} : ℝ)`; };

function mutantsOf(src, decl) {
  // Flip each relation symbol inside the declaration's statement (not the proof), one at a time.
  const code = src; const out = [];
  const last = decl.split('.').pop();
  const start = code.search(new RegExp(`(theorem|lemma|structure|def)\\s+${last}\\b`));
  if (start < 0) return out;
  const isStruct = /^structure/.test(code.slice(start));
  let end;
  if (isStruct) { end = code.indexOf('\n', start); const re2 = /\r?\n([ \t]+\S[^\n]*)/y; re2.lastIndex = end; while (re2.exec(code)) end = re2.lastIndex; }
  else { end = code.indexOf(':=', start); if (end < 0) end = code.length; }
  const FLIP = { '≤': '>', '<': '≥', '≥': '<', '>': '≤' };
  for (let i = start; i < end; i++) {
    const ch = code[i];
    if (FLIP[ch] && !(ch === '<' && code[i + 1] === '|') && !(ch === '>' && code[i - 1] === '=' ) && !(ch === '>' && code[i - 1] === '-')) {
      out.push({ at: i, from: ch, to: FLIP[ch], src: code.slice(0, i) + FLIP[ch] + code.slice(i + 1) });
    }
  }
  return out.slice(0, 8);
}

export async function propose(file, meta, opts = {}) {
  const { write = false, lawsetVersion = null, mutants: runMutants = true, lawsDir = LAWS_DIR } = opts;
  const reasons = [];
  const steps = {};
  const src = fs.readFileSync(file, 'utf8');
  const code = stripLeanComments(src);
  const id = meta.law_id;
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new Error('meta.law_id missing or malformed');
  const L = meta.lean || {};
  const decl = L.structure || L.theorem;
  const work = scratchDir('propose-' + id);

  // (b) forbidden tokens, before spending a compile
  const found = FORBIDDEN.filter(([, re]) => re.test(code)).map(([n]) => n);
  steps.forbidden = { ok: found.length === 0, found };
  if (found.length) reasons.push('forbidden in the Lean source: ' + found.join(', '));

  // (a) build with #print axioms for the declared names
  const names = [L.theorem, L.witness_file ? null : L.witness].filter(Boolean);
  const main = path.join(work, 'Proposal.lean');
  fs.writeFileSync(main, src + '\n' + names.map(n => `#print axioms ${n}`).join('\n') + '\n');
  const b = found.length ? { ok: false, out: 'skipped: forbidden tokens' } : await leanCheckAsync(main);
  steps.build = { ok: b.ok, output: b.out.slice(0, 4000) };
  if (!b.ok) reasons.push('does not build');
  const ax = parseAxioms(b.out);
  steps.axioms = { ok: b.ok && names.every(n => ax[n] && ax[n].every(a => STANDARD_AXIOMS.includes(a))), printed: ax };
  if (b.ok && !steps.axioms.ok) reasons.push('non-standard axioms or missing #print axioms output: ' + JSON.stringify(ax));

  // (c) witness
  // A witness may live in another file (meta.lean.witness_file, repo-relative) when the law's hypotheses are plain
  // inequalities with no structure to instantiate; that file is compiled and its axioms checked too.
  let witnessSrc = src, extWitness = null;
  if (L.witness_file) {
    const wf = path.join(ROOT, L.witness_file);
    witnessSrc = fs.readFileSync(wf, 'utf8');
    const wcopy = path.join(work, 'Witness.lean');
    fs.writeFileSync(wcopy, [witnessSrc, '#print axioms ' + L.witness, ''].join(String.fromCharCode(10)));
    const wr = await leanCheckAsync(wcopy);
    const wax = parseAxioms(wr.out)[L.witness];
    extWitness = { file: L.witness_file, ok: wr.ok && !!wax && wax.every(x => STANDARD_AXIOMS.includes(x)), axioms: wax || null };
  }
  const witnessDeclared = L.witness && statementText(witnessSrc, L.witness) && (!extWitness || extWitness.ok) ? statementText(witnessSrc, L.witness) : null;
  // The witness must be about this law: it names the structure/theorem, or (for a theorem) it is a bundle
  // structure (e.g. `Nonempty Record`) one of whose fields has a hypothesis type named in the theorem statement.
  const declStmt = decl ? statementText(src, decl) || '' : '';
  let witnessMentions = !!(witnessDeclared && decl && witnessDeclared.includes(decl.split('.').pop()));
  let witnessVia = witnessMentions ? 'names the declaration' : null;
  if (extWitness && witnessDeclared) { witnessMentions = true; witnessVia = `external witness of the model hypotheses in ${extWitness.file}`; }
  if (witnessDeclared && !witnessMentions) {
    for (const bundle of witnessDeclared.match(/[A-Z][\w']*/g) || []) {
      const bt = statementText(src, bundle);
      if (!bt || !/^structure/.test(bt)) continue;
      const fieldTypes = [...bt.matchAll(/\b(\w+) : ([A-Z][\w.']*)/g)].map(m => m[2].split('.').pop());
      const words = declStmt.split(/[^A-Za-z0-9_']+/); const hit = fieldTypes.find(t => words.includes(t));
      if (hit) { witnessMentions = true; witnessVia = `bundle ${bundle} has a field of type ${hit}, a hypothesis of ${decl}`; break; }
    }
  }
  steps.witness = { ok: !!(b.ok && witnessDeclared && witnessMentions), name: L.witness || null, statement: witnessDeclared || null, via: witnessVia };
  if (!steps.witness.ok) reasons.push(!L.witness ? 'no non-vacuity witness named (meta.lean.witness)' : !witnessDeclared ? `witness ${L.witness} not found in the file` : !witnessMentions ? `witness ${L.witness} does not mention ${decl}` : 'witness does not compile');

  // Load the law set to judge against
  const cur = readJson(path.join(REG, 'lawsets/current.json'));
  const lawset = loadLawset(lawsetVersion || cur.version);
  const byId = new Map(loadLaws(lawsDir).map(l => [l.law_id, l]));
  const accepted = lawset.laws.filter(x => x.status === 'accepted').map(x => byId.get(x.law_id)).filter(Boolean);
  const peers = accepted.filter(l => l.shared_scope && l.shared_scope.atoms && l.shared_scope.atoms.length && scopesOverlap(l.scope, meta.scope));

  // (d) bridge + joint consistency, in one generated file; errors are attributed to declarations by line.
  const ss = meta.shared_scope;
  steps.joint = { ok: false, lawset: lawset.version, peers: peers.map(l => l.law_id), outcome: 'not-run' };
  steps.bridge = { ok: false };
  let contested = [];
  if (b.ok && ss && ss.atoms && ss.atoms.length && L.structure) {
    const fields = structureFields(src, L.structure) || [];
    const fmap = L.fields || {};
    const dataFields = fields.filter(f => f.data);
    const missing = dataFields.filter(f => !fmap[f.name]).map(f => f.name);
    const quantities = new Set();
    for (const l of [...peers, { shared_scope: ss }]) for (const a of l.shared_scope.atoms) for (const m of a.matchAll(/\bq\.([A-Za-z_]\w*)/g)) quantities.add(m[1]);
    const Q = [...quantities].sort();
    if (missing.length) { steps.bridge = { ok: false, error: 'structure data fields without a shared quantity in meta.lean.fields: ' + missing.join(', ') }; reasons.push(steps.bridge.error); }
    else {
      const lines = [];
      const decls = []; // {name, startLine, endLine}
      const push = (name, text) => { const start = lines.length + 1; lines.push(...text.split('\n')); decls.push({ name, start, end: lines.length }); };
      const header = src.split('\n').filter(l => /^\s*import\s/.test(l));
      if (!header.some(l => /Mathlib/.test(l))) header.unshift('import Mathlib');
      lines.push(...header, '', `-- generated by lean/registry/propose.mjs for ${id} against lawset ${lawset.version}`, '');
      // Restate the proposal (without imports) so the bridge can refer to its structure.
      push('proposal', src.split('\n').filter(l => !/^\s*import\s/.test(l)).join('\n'));
      push('Q', `namespace Delphi.RegistryCheck\nstructure Q where\n${Q.map(k => `  ${k} : ℝ`).join('\n')}`);
      const S = L.structure;
      const varOf = Object.fromEntries(Object.entries(fmap).map(([f, q]) => [q, `x_${q}`]));
      const qAtoms = ss.atoms;
      // bridge forward: every instance satisfies the atoms
      const fwdMap = Object.fromEntries(Object.entries(fmap).map(([f, q]) => [q, `S.${f}`]));
      const conj = xs => xs.length === 1 ? xs[0] : xs.map(x => `(${x})`).join(' ∧ ');
      push('bridge_fwd', `theorem bridge_fwd (S : ${S}) : ${conj(qAtoms.map(a => subst(a, fwdMap)))} := by\n  cases S\n  ${qAtoms.length > 1 ? `refine ⟨${qAtoms.map(() => '?_').join(', ')}⟩ <;> ` : ''}first | assumption | linarith | (norm_num at *; linarith)`);
      // bridge backward: any values satisfying the atoms give an instance with those values
      const vars = Object.entries(fmap).map(([f, q]) => `(${varOf[q]} : ℝ)`).join(' ');
      const hyps = qAtoms.map((a, i) => `(h${i} : ${subst(a, varOf)})`).join(' ');
      const inst = fields.map(f => f.data ? `${f.name} := ${varOf[fmap[f.name]]}` : `${f.name} := by first | assumption | linarith | (norm_num at *; linarith)`).join(', ');
      const eqs = Object.entries(fmap).map(([f, q]) => `S.${f} = ${varOf[q]}`);
      push('bridge_bwd', `theorem bridge_bwd ${vars} ${hyps} : ∃ S : ${S}, ${conj(eqs)} :=\n  ⟨{ ${inst} }, ${eqs.map(() => 'rfl').join(', ')}⟩`);
      // predicates
      const pname = l => 'P_' + l.law_id.replace(/[^A-Za-z0-9]/g, '_');
      for (const l of peers) push(pname(l), `def ${pname(l)} (q : Q) : Prop := ${conj(l.shared_scope.atoms)}`);
      push('P_new', `def P_new (q : Q) : Prop := ${conj(qAtoms)}`);
      // joint witness attempts: proposal's values first, then the accepted laws' values
      const accVals = Object.assign({}, ...peers.map(l => l.shared_scope.witness_values || {}));
      const newVals = ss.witness_values || {};
      const tries = [Object.assign({}, accVals, newVals), Object.assign({}, newVals, accVals)];
      const allP = [...peers.map(pname), 'P_new'];
      tries.forEach((vals, i) => {
        const missingV = Q.filter(k => vals[k] === undefined);
        if (missingV.length) return;
        push(`joint_${i}`, `theorem joint_${i} : ∃ q : Q, ${allP.map(p => `${p} q`).join(' ∧ ')} :=\n  ⟨{ ${Q.map(k => `${k} := ${lit(vals[k])}`).join(', ')} }, by norm_num [${allP.join(', ')}]⟩`);
      });
      // contradiction attempts: pairwise, then with all peers at once
      const hypsOf = (atoms, tag) => atoms.map((a, i) => `(${tag}${i} : ${a})`).join(' ');
      for (const l of peers) push(`contra_${pname(l)}`, `theorem contra_${pname(l)} (q : Q) ${hypsOf(l.shared_scope.atoms, 'a')} ${hypsOf(qAtoms, 'n')} : False := by\n  first | linarith | nlinarith`);
      if (peers.length > 1) push('contra_all', `theorem contra_all (q : Q) ${peers.map((l, j) => hypsOf(l.shared_scope.atoms, `a${j}_`)).join(' ')} ${hypsOf(qAtoms, 'n')} : False := by\n  first | linarith | nlinarith`);
      lines.push('', 'end Delphi.RegistryCheck');
      for (const d of decls.filter(d => /^(bridge|joint|contra)/.test(d.name))) lines.push(`#print axioms Delphi.RegistryCheck.${d.name}`);
      const jf = path.join(work, 'Joint.lean');
      fs.writeFileSync(jf, lines.join('\n') + '\n');
      const r = await leanCheckAsync(jf);
      const errs = errorLines(r.out);
      const failed = new Set(decls.filter(d => errs.some(e => e >= d.start && e <= d.end)).map(d => d.name));
      const jax = parseAxioms(r.out);
      const proved = n => decls.some(d => d.name === n) && !failed.has(n) && (jax['Delphi.RegistryCheck.' + n] || []).every(a => STANDARD_AXIOMS.includes(a)) && ('Delphi.RegistryCheck.' + n) in jax;
      const structural = ['proposal', 'Q', ...peers.map(pname), 'P_new'].filter(n => failed.has(n));
      steps.bridge = { ok: proved('bridge_fwd') && proved('bridge_bwd'), forward: proved('bridge_fwd'), backward: proved('bridge_bwd') };
      if (!steps.bridge.ok) reasons.push('shared-scope atoms not proved equivalent to ' + S + ' (bridge ' + (steps.bridge.forward ? 'backward' : 'forward') + ' failed)');
      const jointOk = decls.some(d => /^joint_/.test(d.name) && proved(d.name));
      contested = peers.filter(l => proved(`contra_${pname(l)}`)).map(l => l.law_id);
      if (!contested.length && proved('contra_all')) contested = peers.filter(l => l.shared_scope.atoms.some(a => [...a.matchAll(/\bq\.(\w+)/g)].some(m => qAtoms.join(' ').includes('q.' + m[1])))).map(l => l.law_id);
      steps.joint = { ok: jointOk && !contested.length, lawset: lawset.version, peers: peers.map(l => l.law_id), quantities: Q,
        outcome: structural.length ? 'generated file failed to elaborate: ' + structural.join(', ') : jointOk ? 'jointly consistent (witness constructed)' : contested.length ? 'contradiction proved' : 'undecided (no joint witness and no contradiction proved)',
        witness: decls.filter(d => /^joint_/.test(d.name) && proved(d.name)).map(d => d.name), contradicts: contested, file_sha256: sha256(lines.join('\n')), output: r.out.slice(0, 3000) };
      fs.mkdirSync(path.join(work), { recursive: true });
      steps.joint.lean = lines.join('\n');
      if (!jointOk && !contested.length) reasons.push('joint consistency with the accepted laws not established: ' + steps.joint.outcome);
    }
  } else if (b.ok && !(ss && ss.atoms && ss.atoms.length)) {
    // A theorem from standard axioms with no shared-scope atoms cannot contradict a satisfiable hypothesis set:
    // any contradiction would be a proof of False from standard axioms.
    if (L.structure) { reasons.push('a hypothesis structure must declare shared_scope.atoms so joint consistency can be checked'); steps.joint.outcome = 'missing shared_scope'; }
    else { steps.joint = { ok: true, lawset: lawset.version, peers: [], outcome: 'theorem from standard axioms with no shared-scope hypotheses: consistent with every satisfiable law set' }; steps.bridge = { ok: true, note: 'no structure' }; }
  }

  // (e) statement-level mutants
  steps.mutants = { ok: false, results: [] };
  if (b.ok && runMutants && decl) {
    const ms = mutantsOf(src, decl);
    const res = await Promise.all(ms.map(async (m, i) => { const f = path.join(work, `Mutant${i}.lean`); fs.writeFileSync(f, m.src); const r = await leanCheckAsync(f); return { at: m.at, line: src.slice(0, m.at).split('\n').length, from: m.from, to: m.to, rejected: !r.ok }; }));
    steps.mutants = { ok: res.length > 0 && res.every(r => r.rejected), results: res };
    if (!res.length) reasons.push('no relation in the statement to mutate');
    else if (!steps.mutants.ok) reasons.push('surviving mutants: ' + res.filter(r => !r.rejected).map(r => `line ${r.line} ${r.from}->${r.to}`).join(', '));
  } else if (!runMutants) steps.mutants = { ok: true, skipped: true };

  // (f) status
  const passedAllButJoint = steps.forbidden.ok && steps.build.ok && steps.axioms.ok && steps.witness.ok && steps.bridge.ok && steps.mutants.ok;
  const status = contested.length && passedAllButJoint ? 'contested' : passedAllButJoint && steps.joint.ok ? 'candidate' : 'proposed';
  const today = new Date().toISOString().slice(0, 10);
  // A law stated in a library module (lean/Delphi/...) is referenced there; any other file is copied into the proposal.
  const inLib = path.resolve(file).toLowerCase().startsWith(path.resolve(ROOT, 'lean', 'Delphi').toLowerCase() + path.sep.toLowerCase());
  const relModule = (inLib ? path.relative(ROOT, path.resolve(file)) : path.relative(ROOT, path.join(REG, 'proposals', id, 'law.lean'))).split(path.sep).join('/');
  const stmt = decl ? statementText(src, decl) : null;
  const law = {
    law_id: id, version: meta.version || '1.0.0', kind: meta.kind, class: meta.class || (L.structure ? 'named-hypothesis' : 'theorem'), status,
    label: meta.label || null, level: meta.level || null,
    lean_ref: { module: relModule, theorem: L.theorem || null, structure: L.structure || null, commit: gitHead(), statement_sha256: stmt ? sha256(stmt) : null, content_hash: null },
    statement_en: meta.statement_en, hypotheses: meta.hypotheses || [], scope: meta.scope || { taxa: ['any'] },
    shared_scope: ss ? { atoms: ss.atoms, quantities: ss.quantities || {}, bridge: `${id}: bridge_fwd/bridge_bwd (generated by propose.mjs)`, witness_values: ss.witness_values || {} } : null,
    evidence: meta.evidence || { sources: meta.sources || [] }, sources: meta.sources || (meta.evidence && meta.evidence.sources) || [],
    non_vacuity_witness: L.witness ? { lean: L.witness, statement: witnessDeclared || '', file: L.witness_file || relModule } : null,
    constraints: meta.constraints || [], introduced_in: null, supersedes: meta.supersedes || null, superseded_by: null, retired_reason: null,
    contested_with: contested.map(c => ({ law_id: c, reason: `contradiction proved in Lean against lawset ${lawset.version} (theorem contra_P_${c.replace(/[^A-Za-z0-9]/g, '_')} in the generated joint file)` })),
    approval: null, origin: meta.origin || { by_role: 'unknown', kind: 'agent' },
    machine_proposed: meta.origin && meta.origin.kind === 'machine-discovery' ? true : undefined,
    history: [{ version: meta.version || '1.0.0', date: today, change: `propose.mjs against lawset ${lawset.version}: ${status}${reasons.length ? ' (' + reasons.join('; ') + ')' : ''}` }],
    content_hash: null,
  };
  law.content_hash = contentHash(law); law.lean_ref.content_hash = law.content_hash;
  const result = { law_id: id, status, lawset: lawset.version, steps, reasons, law, checked_at: new Date().toISOString(), scratch: work };

  if (write) {
    const existing = byId.get(id);
    if (existing && ['accepted', 'candidate', 'contested', 'retired'].includes(existing.status) && existing.version === law.version) throw new Error(`${id} ${existing.version} already exists with status ${existing.status}; bump meta.version to propose a new version (laws are never overwritten)`);
    const pdir = path.join(REG, 'proposals', id);
    fs.mkdirSync(pdir, { recursive: true });
    if (!inLib && path.resolve(file) !== path.resolve(pdir, 'law.lean')) fs.copyFileSync(file, path.join(pdir, 'law.lean'));
    writeJson(path.join(pdir, 'meta.json'), meta);
    if (steps.joint.lean) fs.writeFileSync(path.join(pdir, 'joint-check.lean'), steps.joint.lean + '\n');
    const slim = JSON.parse(JSON.stringify(result)); if (slim.steps.joint) delete slim.steps.joint.lean; delete slim.scratch;
    writeJson(path.join(pdir, 'result.json'), slim);
    if (status !== 'proposed') {
      if (existing) { law.supersedes = law.supersedes || null; law.history = [...(existing.history || []), ...law.history]; }
      writeJson(path.join(lawsDir, id + '.json'), law);
      for (const c of contested) { // record the conflict on the accepted law WITHOUT changing its status
        const f = path.join(lawsDir, c + '.json'); const al = readJson(f);
        al.open_conflicts = [...(al.open_conflicts || []).filter(x => x.law_id !== id), { law_id: id, recorded: today, by: 'propose.mjs', note: 'contradiction proved in Lean; a human decides which law to contest or retire' }];
        writeJson(f, al); // open_conflicts is not a hashed field
      }
    }
  }
  if (result.steps.joint) delete result.steps.joint.lean;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const file = args.find(a => a.endsWith('.lean'));
  const mi = args.indexOf('--meta');
  const li = args.indexOf('--lawset');
  if (!file || mi < 0) { console.error('usage: node lean/registry/propose.mjs <law.lean> --meta <meta.json> [--write] [--lawset <semver>] [--no-mutants]'); process.exit(2); }
  const meta = readJson(args[mi + 1]);
  propose(file, meta, { write: args.includes('--write'), lawsetVersion: li >= 0 ? args[li + 1] : null, mutants: !args.includes('--no-mutants') })
    .then(r => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); process.exit(r.status === 'proposed' ? 1 : 0); })
    .catch(e => { console.error(e.stack || e.message); process.exit(2); });
}
