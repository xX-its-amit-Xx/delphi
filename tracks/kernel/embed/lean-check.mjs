#!/usr/bin/env node
// The Lean check, with nothing borrowed from the repository this tool was written in.
//
//   import { leanCheck, findLeanProject } from './lean-check.mjs'
//   node lean-check.mjs --probes        four deliberately bad files must be rejected, one good one accepted
//
// It runs Lean on one file and FAILS on anything that is not an audited proof. "It compiled" is not
// the test: Lean reports a proof with a hole in it as depending on `sorryAx`, and a `#print axioms`
// line then prints without complaint. Each of these is a rejection:
//   A. no toolchain: nothing ran, so nothing was checked
//   B. `sorry` anywhere, with or without a `#print axioms` line
//   C. a result assumed with a hand-written `axiom` (anything outside Lean's three standard axioms)
//   D. an empty file, or one with no `#print axioms` line at all (0 asked = 0 printed)
//   E. any error, a non-zero exit, or an audit line that did not print
// NOT caught, by this or any script: a theorem whose hypotheses contradict each other is accepted by
// Lean and says nothing. That needs a reader.
//
// Where it runs. A Lean file is checked inside a Lake project, because that is what supplies its
// toolchain and its libraries. In order:
//   1. the project named by the caller (`lean_project` in .delphi/config.json, or DELPHI_LEAN_PROJECT)
//   2. the nearest folder above the file that has a lakefile: the repository's own project
//   3. no project: plain `lean`, which is enough for a file that imports nothing outside core
// The record says which of the three it was.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const ALLOWED = ['propext', 'Classical.choice', 'Quot.sound'];
const LAKEFILES = ['lakefile.toml', 'lakefile.lean'];

export function findLeanProject(absFile, { override = null } = {}) {
  if (override) return { dir: path.resolve(override), how: 'named' };
  let dir = path.dirname(path.resolve(absFile));
  for (;;) {
    if (LAKEFILES.some((f) => fs.existsSync(path.join(dir, f)))) return { dir, how: 'own' };
    const up = path.dirname(dir);
    if (up === dir) return { dir: null, how: 'none' };
    dir = up;
  }
}

// elan installs to a folder that is often not on PATH in a non-login shell; look there too.
function envWithElan() {
  const env = { ...process.env };
  const extra = [process.env.ELAN_HOME && path.join(process.env.ELAN_HOME, 'bin'), path.join(os.homedir(), '.elan', 'bin')].filter((d) => d && fs.existsSync(d));
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  if (extra.length) env[key] = [...extra, env[key] ?? ''].join(path.delimiter);
  return env;
}

export function leanCheck(absFile, { project = null, timeout = 900_000 } = {}) {
  const at = new Date().toISOString();
  const P = findLeanProject(absFile, { override: project });
  const base = { tool: 'delphi lean-check', lean_project: P.how, at };
  if (P.dir && !fs.existsSync(P.dir)) return { ...base, toolchain: null, verdict: 'NO-TOOLCHAIN', detail: 'the Lean project named for this check does not exist', axioms: [], audited: null };

  const [cmd, args] = P.dir ? ['lake', ['env', 'lean', absFile]] : ['lean', [absFile]];
  const r = spawnSync(cmd, args, { cwd: P.dir ?? path.dirname(absFile), encoding: 'utf8', timeout, env: envWithElan(), maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    const none = r.error.code === 'ENOENT';
    return { ...base, toolchain: null, verdict: none ? 'NO-TOOLCHAIN' : 'REJECTED', detail: none ? `no Lean toolchain (\`${cmd}\` is not on PATH). Nothing was checked.` : `Lean did not finish: ${r.error.code ?? r.error.message}`, axioms: [], audited: null };
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r/g, '');
  // elan is installed but has no toolchain to run outside a project: Lean never started
  if (/no default toolchain configured/.test(out)) {
    return { ...base, toolchain: null, verdict: 'NO-TOOLCHAIN', detail: 'no default Lean toolchain outside a Lake project. Nothing was checked. Name a project (DELPHI_LEAN_PROJECT) or run `elan default stable`.', axioms: [], audited: null };
  }
  const src = fs.readFileSync(absFile, 'utf8');
  const tcFile = P.dir ? path.join(P.dir, 'lean-toolchain') : null;
  const toolchain = tcFile && fs.existsSync(tcFile) ? fs.readFileSync(tcFile, 'utf8').trim() : null;

  const asked = (src.match(/^#print axioms/gm) ?? []).length;
  // Lean wraps a long axiom list over several lines, so the output is read with newlines folded
  const flat = out.replace(/\n\s*/g, ' ');
  const lists = [...flat.matchAll(/depends on axioms: \[([^\]]*)\]/g)].map((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
  const printed = lists.length + (flat.match(/does not depend on any axioms/g) ?? []).length;
  const axioms = [...new Set(lists.flat())].sort();
  const extra = axioms.filter((a) => !ALLOWED.includes(a) && a !== 'sorryAx');

  const why = [];
  if (r.status !== 0) why.push(`lean exit ${r.status}`);
  // Lean writes "file:line:col: error: …" or "error(code): …". A bare word match would reject a
  // valid theorem that merely has "error" in its name.
  if (/(^|: )error[:(]/m.test(out)) why.push('error');
  if (/sorryAx|declaration uses/.test(out)) why.push('sorry');
  if (asked === 0) why.push('no axiom audit');
  if (asked !== printed) why.push(`${printed} of ${asked} audit line(s) printed`);
  if (extra.length) why.push(`axioms outside the standard three: ${extra.join(', ')}`);

  const firstError = out.split('\n').find((l) => /(^|: )error[:(]|sorryAx|declaration uses/.test(l));
  return {
    ...base, toolchain,
    verdict: why.length ? 'REJECTED' : 'CHECKED',
    // the file's own directory is machine-specific and is not part of what was decided
    detail: why.length ? `${why.join('; ')}${firstError ? ` — ${firstError.replace(absFile, path.basename(absFile)).trim().slice(0, 200)}` : ''}` : null,
    axioms,
    axioms_are: 'the axioms each audited theorem printed',
    audited: asked,
  };
}

// ---------------------------------------------------------------------------------------------------
// --probes: the checker checked. Core Lean only, so it needs a toolchain and no library.

const PROBES = [
  ['SorryNoPrint', false, 'theorem probe_false_claim (a b : Nat) : a + b = a * b := by sorry\n'],
  ['CustomAxiom', false, 'axiom probe_assumed : ∀ a b : Nat, a + b = a * b\ntheorem probe_from_axiom (a b : Nat) : a + b = a * b := probe_assumed a b\n#print axioms probe_from_axiom\n'],
  ['Empty', false, '-- no theorem at all\n'],
  ['HonestSorry', false, 'theorem probe_sorry_printed (a b : Nat) : a + b = a * b := by sorry\n#print axioms probe_sorry_printed\n'],
  ['Broken', false, 'theorem probe_broken (a b : Nat) : a + b = b + a := by exact rfl\n#print axioms probe_broken\n'],
  ['Good', true, 'theorem probe_good (a b : Nat) : a + b = b + a := Nat.add_comm a b\n#print axioms probe_good\n'],
];

if (process.argv[1] && path.basename(process.argv[1]) === 'lean-check.mjs') {
  if (!process.argv.includes('--probes')) {
    const f = process.argv[2];
    if (!f) { console.error('usage: lean-check.mjs <file.lean> | --probes'); process.exit(2); }
    const r = leanCheck(path.resolve(f), { project: process.env.DELPHI_LEAN_PROJECT ?? null });
    console.log(`${r.verdict}  ${path.basename(f)}  audited=${r.audited}  axioms [${r.axioms.join(', ')}]${r.detail ? `  ${r.detail}` : ''}`);
    process.exit(r.verdict === 'CHECKED' ? 0 : 1);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-probes-'));
  let wrong = 0, rejected = 0, toolchain = true;
  for (const [name, good, src] of PROBES) {
    const f = path.join(dir, `Probe${name}.lean`);
    fs.writeFileSync(f, src);
    const r = leanCheck(f, { project: process.env.DELPHI_LEAN_PROJECT ?? null });
    if (r.verdict === 'NO-TOOLCHAIN') { toolchain = false; break; }
    const ok = good ? r.verdict === 'CHECKED' : r.verdict === 'REJECTED';
    if (!ok) wrong++;
    if (!good && ok) rejected++;
    console.log(`${ok ? 'ok      ' : 'WRONG   '} Probe${name}: ${r.verdict}${r.detail ? ` (${r.detail.split(' — ')[0]})` : ''}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  if (!toolchain) { console.log('SKIPPED: no Lean toolchain on this machine, so the checker could not be probed. That is not a pass.'); process.exit(3); }
  const bad = PROBES.filter((p) => !p[1]).length;
  console.log(wrong ? `PROBES FAILED: ${wrong} wrong` : `lean-check probes: ${rejected} of ${bad} bad file(s) rejected, the good one accepted`);
  process.exit(wrong ? 1 : 0);
}
