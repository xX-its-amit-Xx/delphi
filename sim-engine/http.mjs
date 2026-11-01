#!/usr/bin/env node
// HTTP bridge to the sim-engine tools, for callers that do not speak MCP: the browser, a script, a
// collaborator's swarm that only has fetch.
//
//   node sim-engine/http.mjs                         127.0.0.1:7341, localhost only, no token
//   DELPHI_STUDIO_PORT=8000 node sim-engine/http.mjs
//   DELPHI_STUDIO_TOKEN=... node sim-engine/http.mjs  every request must send Authorization: Bearer ...
//
//   GET  /contract        the live contract: tool names, JSON Schemas, provenance kinds, envelope
//   GET  /health          { ok, tools }
//   POST /tool/<name>     body = the tool's arguments as JSON; response = the provenance envelope
//
// It calls the SAME tool list the MCP server exports (TOOLS in server.mjs), so a tool added there is
// available here with no change to this file, under the same schema, returning the same envelope.
// It ALSO discovers tool definitions exported by any module in sim-engine/tools/*.mjs, so a tool set
// written by another agent (e.g. tools/lean-tools.mjs) is callable as POST /tool/<name> before it is
// registered in server.mjs. A discovered tool is any export, or any element of an exported array,
// shaped { name: string, inputSchema: object, handler|run: function } (title, description optional).
// The MCP server's own definition wins on a name clash. GET /contract marks each tool's origin and
// lists the ones that are HTTP-only (not yet in the MCP server's tools/list). A definition with
// `local: true` is served only while the bridge is bound to loopback. Discovery runs once,
// at the first request: restart the bridge to pick up a new module.
//
// Security, in order of how much it matters:
//  - Binds 127.0.0.1 by default. Binding anything else without DELPHI_STUDIO_TOKEN set is refused.
//  - The token, if any, is read from the environment only. It is never written, logged or echoed.
//  - The Host header must be loopback when there is no token, so a DNS-rebinding page cannot reach
//    the bridge through a name that resolves to 127.0.0.1.
//  - A browser Origin is granted CORS only if it is localhost/127.0.0.1 or listed in
//    DELPHI_STUDIO_ORIGINS (comma-separated). Any other Origin is refused outright, because some
//    tools write session state and a page on another site must not be able to post to them.
//  - POST bodies must be application/json, which forces a CORS preflight for cross-site requests.
//
// Uses only node:http plus ajv, which the MCP SDK already installs; if ajv cannot be loaded a small
// built-in validator covers type, enum, required, min/max and array length.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { KINDS } from './lib/envelope.mjs';

const VERSION = '0.1.0';
const MAX_BODY = 1 << 20; // 1 MiB of arguments is far more than any schema here needs
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

// ── schema validation ─────────────────────────────────────────────────────────
let compileSchema;
try {
  const { default: Ajv } = await import('ajv');
  const ajv = new Ajv({ strict: false, allErrors: true, useDefaults: false });
  compileSchema = schema => {
    const v = ajv.compile(schema);
    return args => (v(args) ? null : v.errors.map(e => `${e.instancePath || '(root)'} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : ''}`).join('; '));
  };
} catch {
  compileSchema = schema => args => miniValidate(schema, args, '(root)').join('; ') || null;
}

function miniValidate(s, v, at) {
  const errs = [];
  if (!s || typeof s !== 'object') return errs;
  const t = s.type;
  const typeOk = !t || (t === 'integer' ? Number.isInteger(v)
    : t === 'number' ? typeof v === 'number' && Number.isFinite(v)
    : t === 'array' ? Array.isArray(v)
    : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
    : typeof v === t);
  if (!typeOk) return [`${at} must be ${t}`];
  if (s.enum && !s.enum.includes(v)) errs.push(`${at} must be one of (${s.enum.join(', ')})`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) errs.push(`${at} must be >= ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) errs.push(`${at} must be <= ${s.maximum}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errs.push(`${at} needs at least ${s.minItems} items`);
    if (s.maxItems !== undefined && v.length > s.maxItems) errs.push(`${at} allows at most ${s.maxItems} items`);
    if (s.items) v.forEach((x, i) => errs.push(...miniValidate(s.items, x, `${at}/${i}`)));
  }
  if (t === 'object') {
    for (const r of s.required || []) if (!(r in v)) errs.push(`${at} must have required property '${r}'`);
    for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) errs.push(...miniValidate(sub, v[k], `${at}/${k}`));
  }
  return errs;
}

// ── the envelope, checked on the way out ─────────────────────────────────────
// A tool that returns a number without scope or with an invented kind has broken the contract. The
// bridge reports that as a 502 instead of passing the number on, because a caller cannot tell an
// unlabelled number from a labelled one once it has left.
export function envelopeProblem(out) {
  if (!out || typeof out !== 'object') return 'tool returned no envelope object';
  if (typeof out.scope !== 'string' || !out.scope.trim()) return 'envelope has no scope (mandatory: what the result does not establish)';
  if (!Array.isArray(out.provenance)) return 'envelope has no provenance array';
  for (const q of out.provenance) {
    if (!q || !(q.kind in KINDS)) return `provenance kind "${q && q.kind}" is not one of ${Object.keys(KINDS).join(', ')}`;
  }
  return null;
}

// ── the live contract ────────────────────────────────────────────────────────
// Same shape as `node server.mjs --dump-contract`, built from the running tool list rather than read
// from contract.json, so it cannot be staler than the code being called.
export function liveContract(tools, discoveryErrors = []) {
  const httpOnly = tools.filter(t => t.origin && t.origin !== 'server.mjs').map(t => t.name);
  return {
    server: 'delphisci-sim-engine',
    version: VERSION,
    transport: 'http',
    also_available_as: 'MCP over stdio: node sim-engine/server.mjs',
    http: {
      call: 'POST /tool/<name> with the arguments as a JSON object; Content-Type: application/json',
      ok: '200 with the envelope',
      errors: { 400: 'malformed JSON or arguments that fail the inputSchema', 401: 'token required and missing or wrong', 403: 'foreign Host or Origin', 404: 'unknown tool', 413: 'body over 1 MiB', 415: 'not application/json', 500: '{error, tool}: the tool failed; no number was produced', 502: 'the tool broke the envelope contract; its output was withheld' },
    },
    envelope: {
      result: 'tool-specific',
      provenance: '[{quantity, value, kind, source}]',
      scope: 'string, mandatory',
      weakest_input: 'the weakest kind among the provenance entries, or none',
      counts: '{kind: number of provenance entries}',
    },
    provenance_kinds: { ...KINDS },
    http_only_tools: httpOnly,
    http_only_note: httpOnly.length ? 'Discovered in sim-engine/tools/ but not registered in server.mjs, so MCP tools/list does not show them yet.' : undefined,
    discovery_errors: discoveryErrors.length ? discoveryErrors : undefined,
    tools: tools.map(({ name, title, description, inputSchema, origin, local }) => ({ name, title, description, inputSchema, ...(origin ? { origin } : {}), ...(local ? { local_only: true } : {}) })),
  };
}

// ── tool discovery ───────────────────────────────────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));

const isToolDef = x => x && typeof x === 'object' && !Array.isArray(x) && typeof x.name === 'string' &&
  x.inputSchema && typeof x.inputSchema === 'object' && (typeof x.handler === 'function' || typeof x.run === 'function');

export async function discoverTools({ base = null, toolsDir = path.join(HERE, 'tools') } = {}) {
  const baseList = base ?? (await import('./server.mjs')).TOOLS;
  const tools = baseList.map(t => ({ ...t, origin: t.origin || 'server.mjs' }));
  const errors = [];
  let files = [];
  try { files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.mjs')).sort(); }
  catch (e) { errors.push({ module: toolsDir, error: e.message }); }
  for (const f of files) {
    let mod;
    try { mod = await import(pathToFileURL(path.join(toolsDir, f)).href); }
    catch (e) { errors.push({ module: `tools/${f}`, error: e.message }); continue; }
    const found = [];
    for (const v of Object.values(mod)) {
      if (isToolDef(v)) found.push(v);
      else if (Array.isArray(v)) found.push(...v.filter(isToolDef));
    }
    for (const t of found) {
      if (tools.some(x => x.name === t.name)) continue; // the registered definition wins
      const fn = typeof t.handler === 'function' ? t.handler : t.run;
      tools.push({ name: t.name, title: t.title || t.name, description: t.description || '', inputSchema: t.inputSchema, handler: args => fn(args), origin: `tools/${f}`, ...(t.local ? { local: true } : {}) });
    }
  }
  return { tools, errors };
}

// ── policy helpers ───────────────────────────────────────────────────────────
export function assertSafeBind({ host, token }) {
  if (!LOOPBACK.has(host) && !token) {
    throw new Error(`refusing to bind ${host} without DELPHI_STUDIO_TOKEN set: off-loopback access needs a token`);
  }
}

function hostIsLoopback(hostHeader) {
  if (!hostHeader) return false;
  const h = hostHeader.startsWith('[') ? hostHeader.slice(1, hostHeader.indexOf(']')) : hostHeader.split(':')[0];
  return LOOPBACK.has(h.toLowerCase());
}

function originAllowed(origin, extra) {
  if (!origin) return true; // not a browser cross-origin request (curl, node, an MCP shim)
  if (extra.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOOPBACK.has(u.hostname.replace(/^\[|\]$/g, ''));
  } catch { return false; }
}

function tokenOk(header, token) {
  const m = /^Bearer\s+(.+)$/i.exec(header || '');
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1].trim()).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b);
}

// ── the server ───────────────────────────────────────────────────────────────
// `exposed`: the bridge is reachable off loopback. Tools marked `local: true` (e.g. lean_propose, which runs a
// Lean build on a submitted file) are then withheld: not listed, and 404 if called.
export function createBridge({ token = process.env.DELPHI_STUDIO_TOKEN || null, tools = null, toolsDir, origins = null, exposed = false, log = () => {} } = {}) {
  const extraOrigins = origins ?? (process.env.DELPHI_STUDIO_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  // `tools` given: serve exactly that list (tests). Otherwise server.mjs TOOLS plus tools/ discovery.
  let discovered = tools ? { tools, errors: [] } : null;
  let pending = null;
  const getDiscovery = async () => discovered ?? (discovered = await (pending ??= discoverTools({ toolsDir })));
  const getTools = async () => (await getDiscovery()).tools.filter(t => !(exposed && t.local));
  const validators = new Map();
  const validatorFor = tool => {
    if (!validators.has(tool.name)) validators.set(tool.name, compileSchema(tool.inputSchema || { type: 'object' }));
    return validators.get(tool.name);
  };

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const send = (status, body, extraHeaders = {}) => {
      const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extraHeaders };
      if (origin && originAllowed(origin, extraOrigins)) {
        headers['access-control-allow-origin'] = origin;
        headers.vary = 'Origin';
      }
      res.writeHead(status, headers);
      res.end(body === null ? '' : JSON.stringify(body, null, 1));
      log(`${req.method} ${req.url} ${status}`);
    };

    try {
      if (!token && !hostIsLoopback(req.headers.host)) return send(403, { error: 'Host must be localhost or 127.0.0.1 when no token is configured' });
      if (!originAllowed(origin, extraOrigins)) return send(403, { error: 'Origin not allowed; add it to DELPHI_STUDIO_ORIGINS to grant it' });

      if (req.method === 'OPTIONS') {
        return send(204, null, {
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
          'access-control-max-age': '600',
          // Chrome's Private Network Access: a public page (e.g. the deployed dashboard, once listed in
          // DELPHI_STUDIO_ORIGINS) may only reach 127.0.0.1 if the preflight says so.
          ...(req.headers['access-control-request-private-network'] === 'true' ? { 'access-control-allow-private-network': 'true' } : {}),
        });
      }

      if (token && !tokenOk(req.headers.authorization, token)) {
        return send(401, { error: 'missing or wrong bearer token' }, { 'www-authenticate': 'Bearer' });
      }

      const url = new URL(req.url, 'http://127.0.0.1');
      const list = await getTools();

      if (url.pathname === '/contract' || url.pathname === '/contract.json') {
        if (req.method !== 'GET') return send(405, { error: 'use GET' }, { allow: 'GET' });
        return send(200, liveContract(list, (await getDiscovery()).errors));
      }
      if (url.pathname === '/health') {
        return send(200, { ok: true, server: 'delphisci-sim-engine', version: VERSION, tools: list.map(t => t.name) });
      }

      const m = /^\/tool\/([A-Za-z0-9_.-]+)$/.exec(url.pathname);
      if (!m) return send(404, { error: 'not found; try GET /contract or POST /tool/<name>' });
      const tool = list.find(t => t.name === m[1]);
      if (!tool) return send(404, { error: `unknown tool: ${m[1]}`, tools: list.map(t => t.name) });
      if (req.method !== 'POST') return send(405, { error: 'use POST with the arguments as a JSON body' }, { allow: 'POST' });

      const ctype = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (ctype !== 'application/json') return send(415, { error: 'Content-Type must be application/json' });

      let raw = '';
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return send(413, { error: 'body over 1 MiB' });
        raw += chunk;
      }
      let args;
      try { args = raw.trim() ? JSON.parse(raw) : {}; }
      catch (e) { return send(400, { error: `malformed JSON: ${e.message}` }); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) return send(400, { error: 'arguments must be a JSON object' });

      const bad = validatorFor(tool)(args);
      if (bad) return send(400, { error: `arguments fail the ${tool.name} inputSchema: ${bad}`, tool: tool.name });

      let out;
      try { out = await tool.handler(args); }
      catch (e) {
        // Same as the MCP server: a failure is reported as a failure, never as a number.
        return send(500, { error: e.message, tool: tool.name });
      }
      const problem = envelopeProblem(out);
      if (problem) return send(502, { error: `contract violation by ${tool.name}: ${problem}. Output withheld.`, tool: tool.name });
      return send(200, out);
    } catch (e) {
      return send(500, { error: `bridge error: ${e.message}` });
    }
  });
}

// ── run as a program ─────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}`).href;
if (isMain) {
  const host = process.env.DELPHI_STUDIO_HOST || '127.0.0.1';
  const port = Number(process.env.DELPHI_STUDIO_PORT || 7341);
  const token = process.env.DELPHI_STUDIO_TOKEN || null;
  try { assertSafeBind({ host, token }); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exit(2); }
  const srv = createBridge({ token, exposed: !LOOPBACK.has(host), log: line => process.stderr.write(line + '\n') });
  srv.listen(port, host, () => {
    process.stderr.write(`delphisci-sim-engine HTTP bridge on http://${host}:${port}  (${token ? 'bearer token required' : 'localhost only, no token'})\n`);
  });
}
