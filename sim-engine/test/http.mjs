// node test/http.mjs
//
// Tests for the HTTP bridge (http.mjs). Every check runs offline: the bridge is started on an
// ephemeral loopback port, once over the real tool list and once over small fake tools that break
// the contract on purpose, so the bridge's own guards are tested rather than the science.

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const okAsync = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};

// A raw request, so the Host and Origin headers can be set to hostile values (fetch forbids that).
function req(port, method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({
      host: '127.0.0.1', port, method, path,
      headers: { ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...headers },
    }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => (buf += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, json, text: buf });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const bridge = await import('../http.mjs');
const { KINDS } = await import('../lib/envelope.mjs');
const { TOOLS } = await import('../server.mjs');

const listen = srv => new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv.address().port)));
const close = srv => new Promise(res => srv.close(() => res()));

// ── over the real tools ──────────────────────────────────────────────────────
console.log('\nhttp bridge, real tools, no token');
{
  const srv = bridge.createBridge({ token: null });
  const port = await listen(srv);

  await okAsync('GET /contract lists every tool the MCP server lists, first and in order', async () => {
    const r = await req(port, 'GET', '/contract');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.tools.slice(0, TOOLS.length).map(t => t.name), TOOLS.map(t => t.name));
    const extra = r.json.tools.slice(TOOLS.length);
    assert.deepEqual(extra.map(t => t.name), r.json.http_only_tools, 'every tool beyond the MCP list must be flagged http-only');
    for (const t of extra) assert.match(t.origin, /^tools\//);
    assert.deepEqual(Object.keys(r.json.provenance_kinds), Object.keys(KINDS));
    for (const t of r.json.tools) assert.ok(t.inputSchema && t.inputSchema.type === 'object', `${t.name} has no object inputSchema`);
  });

  await okAsync('POST /tool/morphogen_diffusion returns the provenance envelope', async () => {
    const r = await req(port, 'POST', '/tool/morphogen_diffusion', { body: { morphogen: 'fgf', dims: [12, 12] } });
    assert.equal(r.status, 200, r.text.slice(0, 300));
    assert.ok(r.json.result, 'no result');
    assert.ok(typeof r.json.scope === 'string' && r.json.scope.length > 0, 'no scope');
    assert.ok(Array.isArray(r.json.provenance) && r.json.provenance.length > 0, 'no provenance');
    for (const q of r.json.provenance) assert.ok(q.kind in KINDS, `unknown kind ${q.kind}`);
    assert.ok(r.json.weakest_input in KINDS || r.json.weakest_input === 'none');
  });

  await okAsync('a Shh request stays labelled borrowed over HTTP', async () => {
    const r = await req(port, 'POST', '/tool/morphogen_diffusion', { body: { morphogen: 'shh', dims: [12, 12] } });
    assert.equal(r.status, 200);
    assert.ok(r.json.provenance.some(q => q.kind === 'borrowed'), 'the borrowing was lost in transit');
  });

  await okAsync('an unknown tool is 404, not a silent empty result', async () => {
    const r = await req(port, 'POST', '/tool/flight_sim', { body: {} });
    assert.equal(r.status, 404);
    assert.match(r.json.error, /unknown tool/);
  });

  await okAsync('arguments that violate the JSON Schema are 400 with the schema error', async () => {
    const r = await req(port, 'POST', '/tool/morphogen_diffusion', { body: { morphogen: 'bmp' } });
    assert.equal(r.status, 400, r.text);
    assert.match(r.json.error, /schema/i);
  });

  await okAsync('a missing required argument is 400', async () => {
    const r = await req(port, 'POST', '/tool/protein_structure', { body: {} });
    assert.equal(r.status, 400, r.text);
  });

  await okAsync('malformed JSON is 400', async () => {
    const r = await req(port, 'POST', '/tool/morphogen_diffusion', { body: '{not json' });
    assert.equal(r.status, 400);
  });

  await okAsync('a non-JSON content type is 415 (forces a CORS preflight on cross-site posts)', async () => {
    const r = await req(port, 'POST', '/tool/morphogen_diffusion', { body: '{}', headers: { 'content-type': 'text/plain' } });
    assert.equal(r.status, 415);
  });

  await okAsync('a foreign Host header is refused (DNS rebinding)', async () => {
    const r = await req(port, 'GET', '/contract', { headers: { host: 'attacker.example' } });
    assert.equal(r.status, 403);
  });

  await okAsync('a foreign Origin is refused and gets no CORS grant', async () => {
    const r = await req(port, 'POST', '/tool/morphogen_diffusion', { body: { dims: [12, 12] }, headers: { origin: 'https://attacker.example' } });
    assert.equal(r.status, 403);
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  });

  await okAsync('a localhost Origin gets the CORS grant', async () => {
    const r = await req(port, 'OPTIONS', '/tool/morphogen_diffusion', { headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' } });
    assert.equal(r.status, 204);
    assert.equal(r.headers['access-control-allow-origin'], 'http://localhost:5173');
  });

  await okAsync('GET on a tool path is 405', async () => {
    const r = await req(port, 'GET', '/tool/morphogen_diffusion');
    assert.equal(r.status, 405);
  });

  await close(srv);
}

// ── token mode ───────────────────────────────────────────────────────────────
console.log('\nhttp bridge, token from the environment');
{
  const token = 'test-' + Math.random().toString(36).slice(2);
  const srv = bridge.createBridge({ token });
  const port = await listen(srv);

  await okAsync('no bearer is 401', async () => {
    const r = await req(port, 'GET', '/contract');
    assert.equal(r.status, 401);
  });
  await okAsync('a wrong bearer is 401', async () => {
    const r = await req(port, 'GET', '/contract', { headers: { authorization: 'Bearer nope' } });
    assert.equal(r.status, 401);
  });
  await okAsync('the right bearer is 200', async () => {
    const r = await req(port, 'GET', '/contract', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(r.status, 200);
  });
  await okAsync('the token never appears in a response body', async () => {
    const r = await req(port, 'GET', '/contract', { headers: { authorization: `Bearer ${token}` } });
    assert.ok(!r.text.includes(token));
    const r2 = await req(port, 'GET', '/contract', { headers: { authorization: 'Bearer nope' } });
    assert.ok(!r2.text.includes(token));
  });
  await close(srv);
}

// ── binding policy ───────────────────────────────────────────────────────────
console.log('\nhttp bridge, binding policy');
await okAsync('refuses to bind a non-loopback address without a token', async () => {
  assert.throws(() => bridge.assertSafeBind({ host: '0.0.0.0', token: null }), /token/);
  assert.doesNotThrow(() => bridge.assertSafeBind({ host: '127.0.0.1', token: null }));
  assert.doesNotThrow(() => bridge.assertSafeBind({ host: '0.0.0.0', token: 'x' }));
});

// ── contract guards, over fake tools ────────────────────────────────────────
console.log('\nhttp bridge, contract guards');
{
  const fake = [
    { name: 'no_scope', title: 't', description: 'd', inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ result: 1, provenance: [] }) },
    { name: 'bad_kind', title: 't', description: 'd', inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ result: 1, provenance: [{ quantity: 'q', value: 1, kind: 'trust-me', source: 's' }], scope: 's' }) },
    { name: 'throws', title: 't', description: 'd', inputSchema: { type: 'object', properties: {} },
      handler: async () => { throw new Error('upstream endpoint down'); } },
  ];
  const srv = bridge.createBridge({ token: null, tools: fake });
  const port = await listen(srv);

  await okAsync('a tool that drops scope is reported as a contract violation, not passed through', async () => {
    const r = await req(port, 'POST', '/tool/no_scope', { body: {} });
    assert.equal(r.status, 502);
    assert.match(r.json.error, /scope/);
  });
  await okAsync('a tool that invents a provenance kind is reported as a contract violation', async () => {
    const r = await req(port, 'POST', '/tool/bad_kind', { body: {} });
    assert.equal(r.status, 502);
    assert.match(r.json.error, /kind/);
  });
  await okAsync('a tool that throws reports {error, tool} rather than a number', async () => {
    const r = await req(port, 'POST', '/tool/throws', { body: {} });
    assert.equal(r.status, 500);
    assert.deepEqual(r.json, { error: 'upstream endpoint down', tool: 'throws' });
  });
  await close(srv);
}

// ── discovery of exported tool sets in tools/ ────────────────────────────────
console.log('\nhttp bridge, tool discovery');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-http-fixture-'));
  const env = 'return { result: { got: args }, provenance: [{ quantity: "q", value: 1, kind: "assumed", source: "fixture" }], scope: "fixture only" };';
  fs.writeFileSync(path.join(dir, 'set.mjs'),
    `export const TOOLS = [{ name: 'fx_one', inputSchema: { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] }, handler: async args => { ${env} } }];\n` +
    `export const fxTwo = { name: 'fx_two', title: 'two', inputSchema: { type: 'object' }, run: async args => { ${env} } };\n` +
    `export const clash = { name: 'base_tool', inputSchema: { type: 'object' }, handler: async () => { throw new Error('the discovered copy must not win'); } };\n` +
    `export const notATool = { name: 'x' };\n`);
  fs.writeFileSync(path.join(dir, 'broken.mjs'), 'export const = ;\n');
  const base = [{ name: 'base_tool', title: 'b', description: 'd', inputSchema: { type: 'object' }, handler: async () => ({ result: 'base', provenance: [], scope: 'base' }) }];
  const { tools, errors } = await bridge.discoverTools({ base, toolsDir: dir });

  await okAsync('exported arrays and single exported definitions are both discovered', async () => {
    assert.deepEqual(tools.map(t => t.name), ['base_tool', 'fx_one', 'fx_two']);
  });
  await okAsync('a broken module is reported, not fatal', async () => {
    assert.equal(errors.length, 1);
    assert.match(errors[0].module, /broken\.mjs/);
  });
  const srv = bridge.createBridge({ token: null, tools });
  const port = await listen(srv);
  await okAsync('a discovered tool is callable at POST /tool/<name> with its schema enforced', async () => {
    const r = await req(port, 'POST', '/tool/fx_one', { body: { n: 3 } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json.result, { got: { n: 3 } });
    const bad = await req(port, 'POST', '/tool/fx_one', { body: { n: 'three' } });
    assert.equal(bad.status, 400);
  });
  await okAsync('on a name clash the registered server.mjs definition wins', async () => {
    const r = await req(port, 'POST', '/tool/base_tool', { body: {} });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.result, 'base');
  });
  await okAsync('the contract marks discovered tools http-only with their module', async () => {
    const r = await req(port, 'GET', '/contract');
    assert.deepEqual(r.json.http_only_tools, ['fx_one', 'fx_two']);
    assert.equal(r.json.tools.find(t => t.name === 'fx_two').origin, 'tools/set.mjs');
  });
  await close(srv);

  const localTools = [...tools, { name: 'fx_local', title: 'l', description: 'd', inputSchema: { type: 'object' }, local: true,
    handler: async () => ({ result: 'ran', provenance: [], scope: 's' }) }];
  const exposedOpen = bridge.createBridge({ token: null, tools: localTools, exposed: true });
  const oPort = await listen(exposedOpen);
  await okAsync('exposed: local-only tool is 404 and absent from the contract', async () => {
    const r = await req(oPort, 'POST', '/tool/fx_local', { body: {} });
    assert.equal(r.status, 404);
    const c = await req(oPort, 'GET', '/contract');
    assert.ok(!c.json.tools.some(t => t.name === 'fx_local'));
  });
  await close(exposedOpen);
  const loop = bridge.createBridge({ token: null, tools: localTools });
  const lPort = await listen(loop);
  await okAsync('on loopback the local-only tool is served and flagged local_only', async () => {
    const r = await req(lPort, 'POST', '/tool/fx_local', { body: {} });
    assert.equal(r.status, 200, r.text);
    const c = await req(lPort, 'GET', '/contract');
    assert.equal(c.json.tools.find(t => t.name === 'fx_local').local_only, true);
  });
  await close(loop);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── the real tools/ directory ───────────────────────────────────────────────
console.log('\nhttp bridge, real tools/ discovery');
{
  const { tools, errors } = await bridge.discoverTools();
  await okAsync('no module in sim-engine/tools/ fails to load', async () => {
    assert.deepEqual(errors, []);
  });
  await okAsync('every MCP-registered tool is present and keeps its server.mjs definition', async () => {
    for (const t of TOOLS) {
      const d = tools.find(x => x.name === t.name);
      assert.ok(d, `${t.name} missing`);
      assert.equal(d.origin, 'server.mjs');
    }
  });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
