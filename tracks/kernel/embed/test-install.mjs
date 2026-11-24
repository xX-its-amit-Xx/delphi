#!/usr/bin/env node
// Does the package work once it has left this repository?
//
//   node tracks/kernel/embed/test-install.mjs           pack, install into an empty folder, drive the installed copy
//   node tracks/kernel/embed/test-install.mjs --keep     leave the install in place and print where it is
//   node tracks/kernel/embed/test-install.mjs --into <dir>   install there (the cookbook uses this)
//
// A tool that runs "by path from the repo" can lean on a file it forgot to ship and nobody finds out
// until a stranger installs it. So this packs the tarball exactly as `npm pack` would, installs it
// with `npm install` into a folder that has nothing else in it, and runs a whole chain through the
// installed command, from a project that is also outside this repository. Nothing here touches the
// network: the package has no dependencies, so the install is a file copy.
//
// The last check is the one that makes the rest mean something: one shipped file is deleted from the
// installed copy and the command must then fail. If it still ran, the test was not exercising the
// installed copy at all.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(HERE, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// one command string: npm is a .cmd on Windows and needs a shell, and these arguments are ours
const npm = (args, cwd) => spawnSync(`npm ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`, { cwd, encoding: 'utf8', shell: true, timeout: 300_000 });

// Pack and install. Returns where the installed command line is, and what was installed.
export function install(into) {
  fs.mkdirSync(into, { recursive: true });
  const p = npm(['pack', '--pack-destination', into, '--json'], PKG_DIR);
  if (p.status !== 0) throw new Error(`npm pack failed:\n${p.stdout}${p.stderr}`);
  const meta = JSON.parse(p.stdout)[0];
  const tarball = path.join(into, meta.filename);
  // an empty manifest, so npm installs into this folder and not into some project above it
  fs.writeFileSync(path.join(into, 'package.json'), JSON.stringify({ name: 'delphi-install-check', private: true }) + '\n');
  const i = npm(['install', '--no-audit', '--no-fund', '--offline', tarball], into);
  if (i.status !== 0) throw new Error(`npm install failed:\n${i.stdout}${i.stderr}`);
  const home = path.join(into, 'node_modules', ...pkg.name.split('/'));
  return {
    home, cli: path.join(home, pkg.bin.delphi), tarball,
    name: pkg.name, version: pkg.version, filename: meta.filename,
    files: meta.files.map((f) => f.path).sort(),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'),
  };
}

if (process.argv[1] && path.basename(process.argv[1]) === 'test-install.mjs') {
  let passed = 0, failed = 0;
  const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log(`  FAIL  ${what}`); } };

  const into = arg('--into') ? path.resolve(arg('--into')) : fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-install-'));
  if (arg('--into')) fs.rmSync(path.join(into, 'node_modules'), { recursive: true, force: true });
  const I = install(into);

  // 1. what was installed is what the manifest says ships, and nothing that reaches back here
  const shipped = new Set([...pkg.files, 'package.json', 'README.md']);
  ok(I.files.every((f) => shipped.has(f)), `the tarball holds only declared files (${I.files.filter((f) => !shipped.has(f)).join(', ')})`);
  ok(pkg.files.every((f) => fs.existsSync(path.join(I.home, f))), 'every declared file is in the installed copy');
  ok(!fs.existsSync(path.join(I.home, 'node_modules')), 'the package brought no dependency with it');
  const bin = path.join(into, 'node_modules', '.bin', process.platform === 'win32' ? 'delphi.cmd' : 'delphi');
  ok(fs.existsSync(bin), 'npm linked a `delphi` command');
  const outside = (p) => { const rel = path.relative(PKG_DIR, p); return rel.startsWith('..') || path.isAbsolute(rel); };
  ok(outside(I.home), 'the installed copy is outside this repository');
  for (const f of pkg.files.filter((f) => f.endsWith('.mjs'))) {
    const src = fs.readFileSync(path.join(I.home, f), 'utf8');
    const reaches = [...src.matchAll(/from '(\.[^']+)'/g)].map((m) => path.resolve(path.dirname(path.join(I.home, f)), m[1])).filter((t) => !fs.existsSync(t));
    ok(!reaches.length, `${f} imports only files that were shipped (${reaches.map((r) => path.basename(r)).join(', ')})`);
  }

  // 2. a whole chain, through the linked command, in a project that is also outside the repository
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-install-proj-'));
  // The linked command is called once, for `version`, to show npm wired it up. The rest goes to the
  // file that link points at, with node, because a Windows .cmd shim needs a shell and a shell would
  // read the `>` in an expression as a redirect.
  const via = (cmd, a, shell) => { const r = spawnSync(cmd, a, { cwd: proj, encoding: 'utf8', shell, timeout: 120_000 }); return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }; };
  const run = (...a) => (a[0] === 'version' ? via(bin, a, process.platform === 'win32') : via(process.execPath, [I.cli, ...a], false));
  const id = (o) => (o.out.match(/\b(k[0-9a-f]{16})\b/) ?? [])[1];
  let commands = 0;
  const step = (expect, what, ...a) => { const r = run(...a); commands++; ok(r.code === expect, `${what}: exit ${r.code}, wanted ${expect}\n${r.out}`); return r; };

  const v = step(0, 'version', 'version');
  ok(v.out.includes(pkg.version), `the installed command reports version ${pkg.version}`);
  step(0, 'init', 'init', '--name', 'elsewhere');
  ok(fs.existsSync(path.join(proj, '.delphi', 'BEST_PRACTICES.md')), 'init wrote the method document from the installed kernel');
  const e = step(0, 'evidence', 'evidence', '--kind', 'file', '--ref', 'NOTES.md', '--quote', 'twelve samples', '--where', 'line 1');
  step(1, 'evidence with no quote is refused', 'evidence', '--kind', 'file', '--ref', 'NOTES.md');
  const f = step(0, 'fact', 'fact', '--statement', 'samples', '--quantity', 'n', '--value', '12', '--unit', 'count', '--condition', 'file=NOTES.md', '--evidence', id(e));
  const l = step(0, 'law', 'law', '--name', 'enough', '--informal', 'at least ten samples', '--script', 'check.mjs');
  const vd = step(0, 'verdict', 'verdict', '--law', id(l), '--fact', id(f), '--requires', 'n', '--expr', 'n >= 10');
  ok(/INSIDE/.test(vd.out), 'the verdict is inside');
  const st = step(0, 'verdict with a missing input', 'verdict', '--law', id(l), '--fact', id(f), '--requires', 'm', '--expr', 'm >= 10');
  ok(/CANNOT-ASSESS/.test(st.out), 'a missing input is cannot-assess, not a pass');
  step(1, 'build on cannot-assess is refused', 'build', '--artifact', 'a', '--verdict', id(st));
  step(0, 'build', 'build', '--artifact', 'b', '--verdict', id(vd));
  ok(/every id matches/.test(step(0, 'verify', 'verify').out), 'verify recomputes the store');
  fs.writeFileSync(path.join(proj, 'NOTES.md'), 'twelve samples\n');
  step(0, 'doctor', 'doctor');
  ok(fs.existsSync(path.join(proj, '.delphi', 'graph', 'index.html')), 'the graph page was written into the project');
  // a Lean file with no audit line is refused before any prover starts, so this needs no toolchain
  fs.writeFileSync(path.join(proj, '.delphi', 'laws', 'A.lean'), 'theorem a : 1 = 1 := rfl\n');
  ok(/no "#print axioms" line/.test(step(1, 'unaudited Lean file', 'law', '--name', 'a', '--informal', 'one is one', '--lean', 'A.lean').out), 'a Lean file that asks for no audit is refused');

  // 3. make it fail once: remove one shipped file from the installed copy
  fs.rmSync(path.join(I.home, 'embed', 'graph.mjs'));
  ok(run('summary').code !== 0, 'with one shipped file deleted from the installed copy, the command fails: so the installed copy is what ran');

  fs.rmSync(proj, { recursive: true, force: true });
  if (process.argv.includes('--keep') || arg('--into')) { install(into); console.log(`kept     ${into}`); } else fs.rmSync(into, { recursive: true, force: true });

  console.log(`install: ${I.filename} (${I.files.length} files, sha256 ${I.sha256.slice(0, 16)}) installed into an empty folder; ${commands} command(s) run through the installed copy, outside this repository`);
  console.log(`         ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
