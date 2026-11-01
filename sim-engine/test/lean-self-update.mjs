// node sim-engine/test/lean-self-update.mjs   tests for the loader's runtime self-update (lib/lean-source.mjs,
// "remote source"): mode defaults, ETag/TTL caching, picking up a new lawset without a restart, rejecting a
// tampered or missing law file while keeping the last good set, the envelope's source fields, lean_changes, and
// the generated changes.json / changes.xml. Node only. The "remote" is an in-process HTTP server on 127.0.0.1
// serving the mirror that dashboard/build-lean-api.mjs would write; nothing is fetched from the internet.

import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
let pass = 0, fail = 0;
const ok = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.stack?.split('\n').slice(0, 3).join('\n          ') || e}`); fail++; }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// build-lean-api forces LEANBIO_REMOTE=off on import (it builds from the local tree), so generate first.
const mirror = await imp('dashboard/build-lean-api.mjs');
const FILES = new Map(Object.entries(mirror.generate()));
const src = await imp('lib/lean-source.mjs');
const { LEAN_TOOLS } = await imp('sim-engine/tools/lean-tools.mjs');
const T = Object.fromEntries(LEAN_TOOLS.map(t => [t.name, t.handler]));
const LOCAL = src.load({ fresh: true, local: true });

// ── the test mirror: serves FILES with strong ETags and honours If-None-Match ──
let mode500 = false;
const hits = [];
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/api\/lean\//, ''));
  hits.push(p);
  if (mode500) { res.writeHead(500); return res.end('boom'); }
  const body = FILES.get(p);
  if (body == null) { res.writeHead(404); return res.end('not found'); }
  const etag = `"${crypto.createHash('md5').update(body).digest('hex')}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.xml') ? 'application/atom+xml' : 'application/json', ETag: etag });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api/lean/`;
const getJ = f => JSON.parse(FILES.get(f));
const putJ = (f, o) => FILES.set(f, JSON.stringify(o, null, 1) + '\n');

const TTL_MS = 400;
const remoteEnv = () => Object.assign(process.env, { LEANBIO_REMOTE: 'mirror', LEANBIO_MIRROR_URL: BASE, LEANBIO_TTL_S: String(TTL_MS / 1000), LEANBIO_TIMEOUT_MS: '5000' });
const status = async () => (await T.lean_source_status({})).result;

console.log(`\nself-update (local lawset ${LOCAL.current}, test mirror ${BASE})`);

await ok('mode defaults: local dev is off (local files first), the hosted server is mirror, junk is off', () => {
  assert.equal(src.remoteConfig({}).mode, 'off');
  assert.equal(src.remoteConfig({ DELPHI_HTTP_PORT: '8080' }).mode, 'mirror');
  assert.equal(src.remoteConfig({ DELPHI_HTTP_PORT: '8080', LEANBIO_REMOTE: 'off' }).mode, 'off');
  assert.equal(src.remoteConfig({ LEANBIO_REMOTE: 'github', LEANBIO_REF: 'v1.5.0' }).url, `https://raw.githubusercontent.com/${src.DEFAULT_REPO}/v1.5.0/lean/registry/`);
  const bad = src.remoteConfig({ LEANBIO_REMOTE: 'yes-please' });
  assert.equal(bad.mode, 'off'); assert.equal(bad.invalid, 'yes-please');
});

await ok('local mode: every lean_* envelope says source "local", the lawset version and when it was loaded', async () => {
  delete process.env.LEANBIO_REMOTE; delete process.env.DELPHI_HTTP_PORT;
  for (const [name, args] of [['lean_laws_list', {}], ['lean_lawset_get', {}], ['lean_law_get', { id: LOCAL.laws[0].law_id }], ['lean_changes', {}], ['lean_source_status', {}]]) {
    const r = await T[name](args);
    assert.equal(r.source, 'local', name);
    assert.equal(r.lawset_version, LOCAL.current, name);
    assert.ok(!Number.isNaN(Date.parse(r.fetched_at)), `${name} fetched_at`);
  }
});

let first;
await ok('mirror mode: first call fetches, verifies every pinned law, and serves the remote lawset', async () => {
  remoteEnv();
  const r = await T.lean_lawset_get({});
  assert.equal(r.source, 'remote:mirror');
  assert.equal(r.lawset_version, LOCAL.current);
  assert.equal(r.result.version, LOCAL.current);
  assert.match(r.source_detail.integrity, /^verified: \d+ law files/);
  first = await status();
  assert.equal(first.remote.laws_verified, LOCAL.laws.length + Object.keys(LOCAL.versions || {}).length);
  assert.equal(first.remote.last_error, null);
  assert.ok(first.remote.stats.requests > LOCAL.laws.length);
  assert.ok(r.provenance.some(p => p.value === BASE), 'provenance names the remote URL');
});

await ok('within the TTL nothing is re-fetched', async () => {
  const n = hits.length;
  await T.lean_laws_list({}); await T.lean_law_get({ id: LOCAL.laws[0].law_id });
  assert.equal(hits.length, n);
});

await ok('after the TTL the check is conditional: 304s, fetched_at unchanged, checked_at advances', async () => {
  await sleep(TTL_MS + 100);
  const r = await T.lean_lawset_get({});
  const s = await status();
  assert.ok(s.remote.stats.not_modified >= LOCAL.laws.length, `304s: ${s.remote.stats.not_modified}`);
  assert.equal(r.fetched_at, first.fetched_at);
  assert.ok(Date.parse(s.remote.checked_at) > Date.parse(first.remote.checked_at));
  assert.equal(s.remote.stats.swaps, 1);
});

// A new release on the mirror: lawset 9.0.0 = current + one status change, plus its changelog entry.
const NEW = '9.0.0';
const target = getJ('current.json').laws.find(x => x.status !== 'accepted' && x.status !== 'retired') || getJ('current.json').laws[0];
const newStatus = target.status === 'accepted' ? 'contested' : 'accepted';
await ok('a new lawset published on the mirror is picked up after the TTL, without a restart', async () => {
  const cur = getJ('current.json');
  const ls = { ...cur, version: NEW, previous: cur.version, note: `test release: ${target.law_id} ${target.status} -> ${newStatus}`,
               laws: cur.laws.map(x => (x.law_id === target.law_id ? { ...x, status: newStatus } : x)) };
  putJ(`lawsets/${NEW}.json`, ls); putJ('current.json', ls);
  const idx = getJ('index.json'); putJ('index.json', { ...idx, current_lawset: NEW, lawsets: [...idx.lawsets, NEW] });
  const feed = getJ('changes.json');
  putJ('changes.json', { ...feed, current_lawset: NEW, entries: [{ version: NEW, date: '2026-11-01', previous: cur.version, title: 'test release', summary: ls.note,
    changes: [], diff: { added: [], removed: [], version: [], status: [{ law_id: target.law_id, from: target.status, to: newStatus }] }, href: `lawsets/${NEW}.json` }, ...feed.entries] });
  // still inside the TTL of the last check? then the old set is served
  await sleep(TTL_MS + 100);
  const r = await T.lean_lawset_get({});
  assert.equal(r.lawset_version, NEW);
  assert.equal(r.result.version, NEW);
  assert.equal(r.result.laws.find(x => x.law_id === target.law_id).status, newStatus);
  const s = await status();
  assert.equal(s.remote.previous_lawset_version, LOCAL.current);
  assert.equal(s.remote.stats.swaps, 2);
  assert.notEqual(r.fetched_at, first.fetched_at);
});

await ok('lean_changes(since_version) reports the new release with its diff; since=current is up to date', async () => {
  const c = (await T.lean_changes({ since_version: LOCAL.current })).result;
  assert.equal(c.count, 1); assert.equal(c.entries[0].version, NEW);
  assert.deepEqual(c.entries[0].diff.status, [{ law_id: target.law_id, from: target.status, to: newStatus }]);
  assert.equal((await T.lean_changes({ since_version: 'current' })).result.up_to_date, true);
  await assert.rejects(() => T.lean_changes({ since_version: 'latest-please' }), /since must be a lawset version/);
});

const victim = getJ('current.json').laws[0].law_id;
const original = FILES.get(`laws/${victim}.json`);
await ok('a tampered law file (content hash mismatch) is rejected and the last good set kept', async () => {
  const doc = JSON.parse(original);
  putJ(`laws/${victim}.json`, { ...doc, statement_en: 'TAMPERED: ' + doc.statement_en });
  await sleep(TTL_MS + 100);
  const r = await T.lean_law_get({ id: victim });
  assert.equal(r.lawset_version, NEW, 'still the last good lawset');
  assert.ok(!String(r.result.statement_en).startsWith('TAMPERED'), 'the tampered text is not served');
  const s = await status();
  assert.equal(s.remote.stats.rejected, 1);
  assert.equal(s.remote.last_rejection.law_id, victim);
  assert.match(s.remote.last_rejection.reason, /content hash mismatch/);
  assert.match(r.source_detail.remote_error, /content hash mismatch/);
});

await ok('a lawset pinning a law the mirror does not serve is rejected too', async () => {
  FILES.set(`laws/${victim}.json`, original);
  FILES.delete(`laws/${victim}.json`);
  await sleep(TTL_MS + 100);
  const r = await T.lean_lawset_get({});
  assert.equal(r.lawset_version, NEW);
  assert.match((await status()).remote.last_rejection.reason, /does not serve/);
});

await ok('a server error keeps the last good set and is reported', async () => {
  FILES.set(`laws/${victim}.json`, original);
  mode500 = true;
  await sleep(TTL_MS + 100);
  const r = await T.lean_laws_list({});
  assert.equal(r.source, 'remote:mirror'); assert.equal(r.lawset_version, NEW);
  const s = await status();
  assert.match(s.remote.last_error.message, /HTTP 500/);
  assert.ok(s.remote.stats.failed >= 1);
  mode500 = false;
});

await ok('once the mirror is consistent again the next check succeeds and clears the error', async () => {
  await sleep(TTL_MS + 100);
  const r = await T.lean_law_get({ id: victim });
  assert.equal(r.result.statement_en, JSON.parse(original).statement_en);
  assert.equal((await status()).remote.last_error, null);
});

await ok('remote unreachable from the start: falls back to the local files, says so', async () => {
  Object.assign(process.env, { LEANBIO_MIRROR_URL: 'http://127.0.0.1:9/api/lean/', LEANBIO_TIMEOUT_MS: '1500' });
  const r = await T.lean_lawset_get({});
  assert.equal(r.source, 'local-fallback');
  assert.equal(r.lawset_version, LOCAL.current);
  assert.ok(r.source_detail.remote_error);
  remoteEnv();
});

await ok('changes.json covers every lawset and changes.xml is well-formed Atom', async () => {
  const feed = JSON.parse(mirror.generate()['changes.json']);
  assert.deepEqual(feed.entries.map(e => e.version).sort(), LOCAL.lawsets.map(s => s.version).sort());
  const xml = mirror.generate()['changes.xml'];
  assert.match(xml, /^<\?xml version="1.0" encoding="utf-8"\?>/);
  assert.equal((xml.match(/<entry>/g) || []).length, LOCAL.lawsets.length);
  assert.equal((xml.match(/<entry>/g) || []).length, (xml.match(/<\/entry>/g) || []).length);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;)/.test(xml), 'every & is escaped');
});

await ok('github mode (raw lean/registry/ files, lawsets found by walking previous) verifies and serves the same laws', async () => {
  const fs = await import('node:fs');
  const gh = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const f = path.join(src.REGISTRY_DIR, rel);
    if (!f.startsWith(src.REGISTRY_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200); res.end(fs.readFileSync(f));
  });
  await new Promise(r => gh.listen(0, '127.0.0.1', r));
  try {
    Object.assign(process.env, { LEANBIO_REMOTE: 'github', LEANBIO_GITHUB_URL: `http://127.0.0.1:${gh.address().port}/` });
    const r = await T.lean_lawset_get({});
    assert.equal(r.source, 'remote:github');
    assert.equal(r.lawset_version, LOCAL.current);
    const st = await status();
    assert.deepEqual(st.remote.lawsets, LOCAL.lawsets.map(x => x.version));
    assert.equal(st.remote.last_error, null);
    const l = (await T.lean_law_get({ id: LOCAL.laws[0].law_id })).result;
    assert.equal(l.law_id, LOCAL.laws[0].law_id);
    assert.ok(l.lean, 'law_get computes the Lean source locally in github mode');
    const c = (await T.lean_changes({ since_version: LOCAL.lawsets[0].version })).result;
    assert.equal(c.count, LOCAL.lawsets.length - 1);
    assert.ok(c.entries[0].summary, 'CHANGELOG.md prose fetched and parsed');
  } finally { gh.close(); delete process.env.LEANBIO_GITHUB_URL; remoteEnv(); }
});

server.close();
delete process.env.LEANBIO_REMOTE;
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
