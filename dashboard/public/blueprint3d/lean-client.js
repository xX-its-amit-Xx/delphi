// lean-client.js: the ONE way a page gets Lean law metadata. Dependency-free ES module.
//
//   import { getLawset, getLaw, checkState, listLawsets, lawApiSource } from './lean-client.js';
//
// Where laws come from, in order:
//   1. A live sim-engine HTTP bridge, if configured: globalThis.DELPHI_LEAN_API, or <meta name="delphi-lean-api"
//      content="http://127.0.0.1:7341">, or localStorage 'delphi.leanApi'. Calls POST <base>/tool/lean_lawset_get
//      and /tool/lean_law_get (sim-engine/http.mjs) and reads `.result` of the provenance envelope.
//   2. Else the static mirror /api/lean/ (dashboard/build-lean-api.mjs, served by the site's static hosting).
// Both are generated from lib/lean-source.mjs, the loader the MCP tools use. Never hand-copy a law list into a
// page; lean/registry/check-exposed.mjs fails if the mirror is stale.
//
// checkState(state, lawset) evaluates with the bundled browser-check.mjs (floating point, NOT a kernel check) and
// takes law_id, version, kind and status from the lawset the API returned, never from the checker or the page.

const HERE = new URL('.', import.meta.url);
const STATIC = new URL('../api/lean/', HERE);

function liveBase() {
  try { if (globalThis.DELPHI_LEAN_API) return String(globalThis.DELPHI_LEAN_API); } catch { }
  try { const m = globalThis.document && document.querySelector('meta[name="delphi-lean-api"]'); if (m && m.content) return m.content; } catch { }
  try { const v = globalThis.localStorage && localStorage.getItem('delphi.leanApi'); if (v) return v; } catch { }
  return null;
}

export function lawApiSource() { const b = liveBase(); return b ? `live ${b}` : `static ${STATIC.pathname}`; }

async function live(tool, args) {
  const base = liveBase().replace(/\/+$/, '');
  const r = await fetch(`${base}/tool/${tool}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args || {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) throw new Error(`${tool}: ${(j && j.error) || r.status}`);
  return j.result ?? j;
}

const cache = new Map();
async function staticJson(rel) {
  if (!cache.has(rel)) cache.set(rel, fetch(new URL(rel, STATIC)).then(r => { if (!r.ok) throw new Error(`GET /api/lean/${rel}: ${r.status}`); return r.json(); }));
  return cache.get(rel);
}
const safe = id => String(id).replace(/[^A-Za-z0-9._-]/g, '_');

// Live first; if the configured live bridge fails, fall back to the static mirror and say so in `source`.
async function either(tool, args, rel) {
  if (liveBase()) {
    try { return { ...(await live(tool, args)), source: lawApiSource() }; }
    catch (e) { const s = await staticJson(rel); return { ...s, source: `static ${STATIC.pathname} (live bridge failed: ${e.message})` }; }
  }
  return { ...(await staticJson(rel)), source: lawApiSource() };
}

export async function getLawset(version = 'current') {
  const v = version || 'current';
  return either('lean_lawset_get', { version: v }, v === 'current' ? 'current.json' : `lawsets/${safe(v)}.json`);
}

export async function getLaw(id) {
  if (!id) throw new Error('getLaw(id): id is required');
  return either('lean_law_get', { id }, `laws/${safe(id)}.json`);
}

export async function listLawsets() {
  if (liveBase()) { try { const r = await live('lean_laws_list', {}); if (r && r.lawsets) return r.lawsets; } catch { } }
  const idx = await staticJson('index.json');
  return idx.lawsets || [];
}

let checkerP = null, scopeP = null;
const scopeRule = () => (scopeP ||= import(new URL('scope.mjs', STATIC).href));
const checker = () => (checkerP ||= import(new URL('browser-check.mjs', HERE).href));

// state: an SI-unit design/spec (fields at the top of browser-check.mjs). lawset: an object from getLawset, or a
// version string. Returns the checker's rows, each tagged with {law_id, version, kind, status, binding}; rows
// whose law is not in the lawset are dropped, and the array carries .lawset, .violations, .excluded.
export async function checkState(state, lawset = 'current') {
  const ls = typeof lawset === 'object' && lawset ? lawset : await getLawset(lawset);
  const byConstraint = {}, byId = {};
  for (const l of ls.laws || []) { byId[l.law_id] = l; for (const c of l.constraints || []) if (!byConstraint[c]) byConstraint[c] = l; }
  const m = await checker();
  // The out-of-scope rule from the API (a generated copy of lib/lean-scope.mjs), so verdicts match lean_check.
  const { outOfScope } = await scopeRule();
  const raw = (m.check || m.default)(state || {}, { lawset: ls.version, includeCandidates: true });
  const rows = [], excluded = [];
  for (const r of raw) {
    const law = (r.law && byId[r.law.law_id]) || byConstraint[r.id] || null;
    if (!law) { excluded.push({ constraint: r.id, why: `no law in lawset ${ls.version} backs this constraint` }); continue; }
    if (law.status === 'retired') { excluded.push({ constraint: r.id, law_id: law.law_id, why: 'retired' }); continue; }
    const oos = outOfScope(r, law, state || {});
    rows.push({ ...r, law_id: law.law_id, version: law.version, kind: law.kind, status: law.status, label: law.label,
                binding: law.status === 'accepted',
                ...(oos ? { verdict: 'out-of-scope', evaluator_verdict: r.verdict, scope_reason: oos.reason } : {}) });
  }
  rows.lawset = ls.version;
  rows.source = ls.source || lawApiSource();
  rows.excluded = excluded;
  rows.violations = rows.filter(r => /^viol|contested|candidate-violated/.test(r.verdict))
    .map(r => ({ law_id: r.law_id, version: r.version, kind: r.kind, status: r.status, constraint: r.id, binding: r.binding, inputs: r.numbers || null,
                 message: `${r.label || r.law_id}: ${r.relation || `constraint ${r.id}`} fails${r.note ? ` (${r.note})` : ''}${r.binding ? '' : ` [advisory: ${r.status}]`}` }));
  return rows;
}
