// node sim-engine/test/lean-tools.mjs     tests for the Lean law tools, the shared loader, the CLI, the static
//                                        mirror, the browser client and the hosted mcp/ server's lean_* tools.
// Node only; no Lean toolchain. lean_propose's Lean build is not exercised here (lean/registry/test.mjs owns it).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
let pass = 0, fail = 0;
const ok = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.stack?.split('\n').slice(0, 3).join('\n          ') || e}`); fail++; }
};

const src = await imp('lib/lean-source.mjs');
const { LEAN_TOOLS } = await imp('sim-engine/tools/lean-tools.mjs');
const T = Object.fromEntries(LEAN_TOOLS.map(t => [t.name, t.handler]));
const reg = src.load({ fresh: true });
const DESIGN = { SL_m: 0.2, mass_kg: 0.06, finArea_m2: 0.01, CLmax: 0.8, airspeed_m_s: 3 };

console.log(`\nloader (${reg.origin}, ${reg.laws.length} laws, current lawset ${reg.current})`);
await ok('sim-engine/lib/lean-source.mjs re-exports the one root loader', async () => {
  const local = await imp('sim-engine/lib/lean-source.mjs');
  assert.equal(local.load, src.load);
});
await ok('every law has law_id, semver version, kind and a registry status', () => {
  for (const l of reg.laws) {
    assert.ok(l.law_id, 'law_id');
    assert.match(l.version, /^\d+\.\d+\.\d+/, `${l.law_id} version`);
    assert.ok(['physical', 'biological'].includes(l.kind), `${l.law_id} kind ${l.kind}`);
    assert.ok(['proposed', 'candidate', 'accepted', 'contested', 'retired'].includes(l.status), `${l.law_id} status ${l.status}`);
  }
});
await ok('law_ids are unique', () => assert.equal(new Set(reg.laws.map(l => l.law_id)).size, reg.laws.length));
await ok('every constraint in lean/constraints.json maps to a law', () => {
  const idx = src.constraintIndex();
  for (const c of reg.constraints) assert.ok(idx[c.id], `${c.id} unmapped`);
});
await ok('a changed statement is reported as drift (pinStatus)', () => {
  const l = reg.laws.find(x => x.lean_ref?.statement_sha256) || reg.laws.find(x => x.lean_ref?.module);
  const forged = { ...l, lean_ref: { ...l.lean_ref, statement_sha256: '0'.repeat(64) } };
  const ps = src.pinStatus(forged);
  if (reg.origin === 'registry') assert.equal(ps.status, 'drift');
  else assert.ok(['unpinned', 'drift'].includes(ps.status));
});
await ok('a law naming a theorem that does not exist is caught (findDecl)', () => {
  assert.equal(src.findDecl('Delphi.no_such_theorem_xyz', 'lean/Delphi/Kimura.lean'), null);
  assert.ok(src.findDecl('Delphi.neutral_substitution_rate', 'lean/Delphi/Kimura.lean'));
});

console.log('\nlean_* handlers');
await ok('every tool returns the provenance envelope with a non-empty scope', async () => {
  const id = reg.laws[0].law_id;
  for (const [name, args] of [['lean_laws_list', {}], ['lean_law_get', { id }], ['lean_lawset_get', {}], ['lean_check', { design: DESIGN }], ['lean_verify', {}]]) {
    const o = await T[name](args);
    assert.ok(o.result && Array.isArray(o.provenance) && typeof o.scope === 'string' && o.scope.length > 40, name);
  }
});
await ok('lean_laws_list returns every law and filters by kind, status and lawset', async () => {
  const all = (await T.lean_laws_list({})).result;
  assert.equal(all.count, reg.laws.length);
  const bio = (await T.lean_laws_list({ kind: 'biological', status: 'accepted' })).result.laws;
  assert.ok(bio.length > 0 && bio.every(l => l.kind === 'biological' && l.status === 'accepted'));
  const multi = (await T.lean_laws_list({ status: ['contested', 'candidate'] })).result.laws;
  assert.ok(multi.every(l => ['contested', 'candidate'].includes(l.status)));
  const inSet = (await T.lean_laws_list({ lawset: 'current' })).result.laws;
  const ls = src.resolveLawset('current');
  assert.equal(inSet.length, ls.laws.length);
});
await ok('lean_law_get returns the Lean source text of the theorem', async () => {
  const r = (await T.lean_law_get({ id: 'kimura-substitution-rate' })).result;
  assert.match(r.lean.source, /theorem neutral_substitution_rate/);
  assert.ok(r.pin && r.pin.module === 'lean/Delphi/Kimura.lean');
  assert.ok(Array.isArray(r.history) && r.history.length >= 1);
  assert.ok(Array.isArray(r.constraint_details) && r.constraint_details.some(c => c.id === 'C1' && /kimura_rate_rules_out/.test(c.lemma_source || '')));
});
await ok('an older lawset resolves its pinned (archived) law version, not the current file', async () => {
  const pins = reg.lawsets.flatMap(ls => ls.laws.map(x => ({ ls: ls.version, ...x })));
  const old = pins.find(x => { const cur = reg.laws.find(l => l.law_id === x.law_id); return cur && x.version && x.version !== cur.version; });
  if (!old) return; // no superseded law yet
  const inSet = (await T.lean_lawset_get({ version: old.ls })).result.laws.find(l => l.law_id === old.law_id);
  assert.equal(inSet.version, old.version);
  assert.equal((await T.lean_law_get({ id: old.law_id, version: old.version })).result.version, old.version);
  assert.equal((await T.lean_laws_list({ lawset: old.ls })).result.laws.find(l => l.law_id === old.law_id).version, old.version);
});
await ok('lean_law_get on an unknown id fails loudly', async () => {
  await assert.rejects(() => T.lean_law_get({ id: 'no-such-law' }), /no law "no-such-law"/);
});
await ok('lean_lawset_get current resolves to the registry current lawset', async () => {
  const r = (await T.lean_lawset_get({ version: 'current' })).result;
  assert.equal(r.version, reg.current);
  assert.equal(r.is_current, true);
  await assert.rejects(() => T.lean_lawset_get({ version: '99.99.99' }), /no lawset/);
});
await ok('lean_check: violations carry law_id, version, kind, status, inputs, message', async () => {
  const r = (await T.lean_check({ design: DESIGN })).result;
  assert.ok(r.violations.length > 0, 'the below-v_min design must violate something');
  for (const v of r.violations) for (const k of ['law_id', 'version', 'kind', 'status', 'inputs', 'message']) assert.ok(k in v, `${k} missing`);
  assert.ok(r.violations.every(v => v.binding === (v.status === 'accepted')));
  assert.match(r.kernel, /not a kernel check/);
});
await ok('lean_check: reference-specimen rows are out-of-scope for a zebrafish, evaluated for a flying fish', async () => {
  const zf = (await T.lean_check({ design: { ...DESIGN, taxon: 'Danio rerio' } })).result;
  const ff = (await T.lean_check({ design: { ...DESIGN, taxon: 'Cypselurus hiraii' } })).result;
  const v = (r, c) => r.verdicts.find(x => x.constraint === c)?.verdict;
  assert.equal(v(zf, 'C7b'), 'out-of-scope');
  assert.ok(zf.verdicts.find(x => x.constraint === 'C7b').scope_reason.includes('Exocoetidae'));
  assert.equal(v(ff, 'C7b'), 'violated');
  assert.ok(!zf.violations.some(x => x.constraint === 'C7b'), 'out-of-scope rows are never violations');
  assert.equal(v(zf, 'C9'), 'violated', 'a taxon-free law still applies to the zebrafish');
  assert.equal(zf.summary.out_of_scope, zf.verdicts.filter(x => x.verdict === 'out-of-scope').length);
});
await ok('no violation message or law label contains "null" or "undefined" (every constraint forced to fire)', async () => {
  // Designs chosen to make as many constraints as possible fire, across the flying-fish and zebrafish scopes.
  const designs = [
    DESIGN, { ...DESIGN, taxon: 'Cypselurus hiraii' }, { ...DESIGN, taxon: 'Danio rerio' },
    { taxon: 'Cypselurus hiraii', SL_m: 2, mass_kg: 50, finArea_m2: 0.001, CLmax: 0.5, LD_max: 1, airspeed_m_s: 1,
      glideHeight_m: 1, glideDistance_m: 1000, climbRate_m_s: 50, powerAvailable_W: 0.001,
      efficiency: 0.2, oxycaloric_J_per_unit_O2: 20, cardiacOutput: 1e-9, arterialO2: 1e-9,
      mass_exponent: 5, o2_store_ml: 0.001, flight_duration_s: 1000, lethality: { death_hpf: 10, scored_hpf: 100 } },
  ];
  let seen = 0;
  for (const d of designs) for (const lawset of src.load().lawsets.map(s => s.version)) {
    const r = (await T.lean_check({ design: d, lawset })).result;
    for (const v of r.violations) { seen++; assert.ok(!/\b(null|undefined)\b/.test(v.message), `${v.constraint} (${lawset}): ${v.message.slice(0, 120)}`); }
  }
  assert.ok(seen > 5, `only ${seen} violations exercised`);
  for (const l of (await T.lean_laws_list({})).result.laws) assert.ok(l.label && !/^(null|undefined)$/.test(String(l.label)), `${l.law_id} has no label`);
});
await ok('lean_check accepts the v1 {spec} argument', async () => {
  const a = (await T.lean_check({ design: DESIGN })).result, b = (await T.lean_check({ spec: DESIGN })).result;
  assert.deepEqual(a.violations.map(v => v.constraint), b.violations.map(v => v.constraint));
});
await ok('lean_check with an empty design holds nothing and violates nothing', async () => {
  const r = (await T.lean_check({ design: {} })).result;
  assert.equal(r.summary.violated, 0);
});
await ok('lean_propose is marked local (withheld from hosted/exposed servers)', () => {
  assert.equal(LEAN_TOOLS.find(t => t.name === 'lean_propose').local, true);
  assert.ok(LEAN_TOOLS.filter(t => t.name !== 'lean_propose').every(t => !t.local));
});
await ok('lean_verify reports per-law pin status', async () => {
  const r = (await T.lean_verify({})).result;
  assert.ok(Array.isArray(r.laws) && r.laws.length > 0);
  assert.ok(typeof r.ok === 'boolean');
});

console.log('\nCLI');
const cli = await imp('sim-engine/lean-cli.mjs');
await ok('lean-cli laws/law/lawset give the handler results', async () => {
  const a = (await cli.run(['laws', '--kind', 'physical', '--result'])).out;
  const b = (await T.lean_laws_list({ kind: 'physical' })).result;
  assert.deepEqual(a, b);
  assert.equal((await cli.run(['law', 'fisher-ftns', '--result'])).out.law_id, 'fisher-ftns');
  assert.equal((await cli.run(['lawset', 'current', '--result'])).out.version, reg.current);
});
await ok('lean-cli check reads a design file and keeps "1.0.0" a string', async () => {
  const f = path.join(process.env.TEMP || '/tmp', `lean-design-${process.pid}.json`);
  fs.writeFileSync(f, JSON.stringify(DESIGN));
  try {
    const out = (await cli.run(['check', f, '--lawset', reg.current, '--result'])).out;
    assert.equal(out.lawset, reg.current);
    assert.ok(out.violations.length > 0);
  } finally { fs.rmSync(f, { force: true }); }
});

console.log('\nstatic mirror + browser client');
await ok('dashboard/public/api/lean/ is up to date with the sources', async () => {
  const m = await imp('dashboard/build-lean-api.mjs');
  const d = m.diff();
  assert.equal(d.length, 0, `stale: ${d.slice(0, 5).map(x => x.file + ' ' + x.why).join(', ')} (run node dashboard/build-lean-api.mjs)`);
});
await ok('lean-client.js checkState agrees with lean_check on the same lawset', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async u => { const p = fileURLToPath(u); return fs.existsSync(p) ? { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) } : { ok: false, status: 404, json: async () => null }; };
  try {
    const c = await imp('dashboard/public/blueprint3d/lean-client.js');
    const ls = await c.getLawset('current');
    assert.equal(ls.version, reg.current);
    assert.equal((await c.getLaw('fisher-ftns')).law_id, 'fisher-ftns');
    const rows = await c.checkState(DESIGN, ls);
    const server = (await T.lean_check({ design: DESIGN })).result;
    assert.deepEqual(rows.violations.map(v => v.law_id).sort(), server.violations.map(v => v.law_id).sort());
    const zf = { ...DESIGN, taxon: 'Danio rerio' };
    const crow = (await c.checkState(zf, ls)).filter(r => r.verdict === 'out-of-scope').map(r => r.id).sort();
    const srow = (await T.lean_check({ design: zf })).result.verdicts.filter(v => v.verdict === 'out-of-scope').map(v => v.constraint).sort();
    assert.deepEqual(crow, srow, 'browser and server must agree on out-of-scope');
  } finally { globalThis.fetch = realFetch; }
});

console.log('\nhosted mcp/ server');
async function mcpStdio() {
  const { Client } = await imp('node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
  const { StdioClientTransport } = await imp('node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
  const env = { ...process.env }; delete env.DELPHI_HTTP_PORT;
  const client = new Client({ name: 'lean-tools-test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'mcp/server.mjs')], cwd: ROOT, env, stderr: 'pipe' }));
  return client;
}
await ok('mcp/server.mjs (stdio) offers all six lean_* tools and lean_laws_list returns every law', async () => {
  const c = await mcpStdio();
  try {
    const names = (await c.listTools()).tools.map(t => t.name);
    for (const t of LEAN_TOOLS) assert.ok(names.includes(t.name), t.name);
    const r = JSON.parse((await c.callTool({ name: 'lean_laws_list', arguments: { kind: 'biological' } })).content[0].text);
    assert.deepEqual(r.result, (await T.lean_laws_list({ kind: 'biological' })).result);
  } finally { await c.close(); }
});
await ok('mcp/server.mjs in HTTP mode serves lean_* but never lean_propose', async () => {
  const port = 18000 + (process.pid % 1000);
  const child = spawn(process.execPath, [path.join(ROOT, 'mcp/server.mjs')], { cwd: ROOT, env: { ...process.env, DELPHI_HTTP_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/healthz`)).ok; } catch { await new Promise(r => setTimeout(r, 250)); } }
    assert.ok(up, 'HTTP server did not come up');
    const call = body => fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }).then(r => r.json());
    const names = (await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools.map(t => t.name);
    assert.ok(names.includes('lean_laws_list') && names.includes('lean_check'));
    assert.ok(!names.includes('lean_propose'), 'lean_propose must not be on the hosted server');
    const r = await call({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'lean_laws_list', arguments: {} } });
    assert.equal(JSON.parse(r.result.content[0].text).result.count, reg.laws.length);
  } finally { const gone = new Promise(r => child.once('exit', r)); child.kill(); await gone; }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
