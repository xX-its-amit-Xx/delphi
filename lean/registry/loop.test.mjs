#!/usr/bin/env node
// loop.test: the law -> every-surface chain fails when a link is broken.
//
//   node lean/registry/loop.test.mjs
//
// Two assertions, each of which FAILED before the guards in check-exposed.mjs existed (that is the point:
// a guard nobody has seen fail is a guard nobody should trust):
//
//   1. A law added to the registry but missing from a surface must FAIL check-exposed. The surface used here is
//      the static /api/lean/ mirror, because it is the one a law reaches last and the one a release can forget.
//   2. An ACCEPTED law that produces no row in the generated evaluator must FAIL check-exposed (`bind:accepted`).
//      This is the quiet failure: every surface reports the design as checked against the law while no
//      arithmetic ran, which is false assurance and worse than having no law.
//
// HOW IT RUNS. The test writes two temporary law files into lean/registry/laws/, runs check-exposed --fast
// --json once, and deletes them again in a finally block. It therefore touches the shared tree for the length
// of one check-exposed run. It never runs a generator, so nothing else is rewritten; if a concurrent agent
// rebuilds the mirror inside that window, the temporary laws would be baked into it, so the cleanup checks for
// that and says what to run. Nothing here runs Lean or lake.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REG = import.meta.dirname;
const ROOT = path.resolve(REG, '..', '..');
const LAWS = path.join(REG, 'laws');
const { contentHash } = await import(pathToFileURL(path.join(REG, 'registry-lib.mjs')).href);

let failed = 0;
const ok = (name, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? `\n       ${detail}` : ''}`); if (!cond) failed++; };

const BASE = {
  version: '1.0.0', kind: 'physical', class: 'convention', level: 'body',
  lean_ref: { module: null, theorem: null, commit: null, statement_sha256: null, content_hash: null },
  hypotheses: [], scope: { taxa: ['Teleostei'], life_stages: [], ranges: {}, basis: 'a temporary fixture of lean/registry/loop.test.mjs', kernelChecked: [], assumed: [] },
  constraint_scopes: {}, shared_scope: null,
  evidence: { sources: [], observations: [], n_organisms: null, n_observations: null }, sources: [],
  non_vacuity_witness: { lean: null, statement: 'a test fixture; it witnesses nothing', file: 'lean/registry/loop.test.mjs' },
  introduced_in: null, supersedes: null, superseded_by: null, retired_reason: null, contested_with: [],
  origin: { by_role: 'lean-api-thread', kind: 'agent', from: 'lean/registry/loop.test.mjs fixture; deleted when the test ends' },
  history: [{ version: '1.0.0', date: new Date().toISOString().slice(0, 10), change: 'temporary fixture written by lean/registry/loop.test.mjs' }],
};

// 1. in the registry, in no law set, in no mirror: must fail the mirror surface.
const MISSING = { ...BASE, law_id: 'zz-loop-test-missing-from-surfaces',
  label: 'FIXTURE (lean/registry/loop.test.mjs): a law that reaches no surface', status: 'candidate', approval: null,
  statement_en: 'A temporary fixture: a law present in lean/registry/laws/ and nowhere else. It exists for the length of one check-exposed run.',
  constraints: [] };
// 2. accepted, approved, and binding nothing: must fail bind:accepted.
const SILENT = { ...BASE, law_id: 'zz-loop-test-accepted-binds-nothing',
  label: 'FIXTURE (lean/registry/loop.test.mjs): an accepted law that evaluates nothing', status: 'accepted',
  approval: { approved_by_role: 'test-fixture', date: new Date().toISOString().slice(0, 10), basis: 'a fixture of lean/registry/loop.test.mjs; it is deleted when the test ends and is never released' },
  statement_en: 'A temporary fixture: an accepted law whose constraint has no formula anywhere, so no surface can evaluate it while every surface reports it.',
  constraints: ['ZZLOOPTEST'] };

const files = [];
const write = l => { const p = path.join(LAWS, l.law_id + '.json'); fs.writeFileSync(p, JSON.stringify({ ...l, content_hash: contentHash(l) }, null, 2) + '\n'); files.push(p); return p; };

let report = null;
try {
  write(MISSING);
  write(SILENT);
  // The fixtures are in the registry and in no law set, so they cannot be pinned; the ACCEPTED one would need a
  // release to be pinned at all, which is why bind:accepted also has to look at laws outside the current set.
  const r = spawnSync(process.execPath, [path.join(REG, 'check-exposed.mjs'), '--fast', '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 600_000, maxBuffer: 256 << 20, env: { ...process.env, LEANBIO_REMOTE: 'off' } });
  try { report = JSON.parse(r.stdout); } catch { }
  if (!report) { console.error(`check-exposed --json did not produce JSON (exit ${r.status}):\n${(r.stdout || '').slice(-800)}\n${(r.stderr || '').slice(-800)}`); process.exit(1); }
} finally {
  for (const p of files) { try { fs.rmSync(p); } catch { } }
  const mir = path.join(ROOT, 'dashboard', 'public', 'api', 'lean', 'index.json');
  if (fs.existsSync(mir) && /zz-loop-test-/.test(fs.readFileSync(mir, 'utf8')))
    console.error('WARNING: a concurrent build baked the fixtures into dashboard/public/api/lean/; run `node dashboard/build-lean-api.mjs` to clean it.');
}

const of = check => report.failures.filter(f => f.check === check);
const about = id => report.failures.filter(f => f.item === id || (f.msg || '').includes(id));

ok('a law in the registry and in no law set is reported as not pinned by any release',
  about('zz-loop-test-missing-from-surfaces').length > 0,
  `failures naming it: ${about('zz-loop-test-missing-from-surfaces').map(f => f.check).join(', ') || 'NONE — check-exposed did not notice a law that reaches no surface'}`);

ok('a law missing from the static /api/lean/ mirror FAILS check-exposed (surface c)',
  of('c:mirror').some(f => /zz-loop-test-/.test(f.item + f.msg)) && of('stale:mirror').length > 0,
  `c:mirror failures: ${of('c:mirror').map(f => f.item).join(', ') || 'none'}; stale:mirror: ${of('stale:mirror').length}`);

ok('an ACCEPTED law that produces no row in the generated evaluator FAILS bind:accepted',
  of('bind:accepted').some(f => f.item === 'zz-loop-test-accepted-binds-nothing'),
  `bind:accepted failures: ${of('bind:accepted').map(f => f.item).join(', ') || 'none'}`);

ok('the bind:accepted message names the reason the law evaluates nothing, not just that it does',
  of('bind:accepted').some(f => f.item === 'zz-loop-test-accepted-binds-nothing' && /ZZLOOPTEST: the evaluator emits no row for it/.test(f.msg)),
  of('bind:accepted').find(f => f.item === 'zz-loop-test-accepted-binds-nothing')?.msg?.slice(0, 200) || 'no such failure');

ok('check-exposed as a whole is RED while a law is missing from a surface',
  report.ok === false, `report.ok = ${report.ok}`);

console.log(failed ? `\n${failed} assertion(s) failed.` : `\nall assertions passed (${report.failures.length} failures in the run, as intended).`);
process.exit(failed ? 1 : 0);
