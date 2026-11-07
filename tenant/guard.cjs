// THE RUNTIME EGRESS GUARD. Preload this and the process can only reach hosts you named.
//
//   DELPHI_EGRESS_ALLOW=registry.example-tenant.internal \
//   DELPHI_EGRESS_LOG=C:/tmp/egress.log \
//   node --require ./tenant/guard.cjs <script> [args...]
//
// ============================== WHY A PRELOAD AND NOT A CODE CHANGE ==============================
// The nanopub publish path is three byte-identical scripts plus two more, each with the registry host as
// a hardcoded constant. A tenant deployment has to guarantee that no record reaches a public host, and a
// guarantee that depends on every one of those files staying correct is not a guarantee - it is a habit.
//
// A preload intercepts at the only place egress can actually happen: the socket. It does not care how
// many publish scripts exist, whether a new one is added, whether a dependency opens its own connection,
// or whether the host came from a constant, an environment variable or a string built at runtime. It is
// also exactly how this would be enforced in production, so the gate and the control are the same thing.
//
// ============================== WHAT IT CANNOT DO ==============================
// It is a guard inside ONE process. It cannot stop a child process that is not also preloaded (so it
// propagates itself through NODE_OPTIONS to children), it cannot stop a native addon that opens its own
// socket, and it is not a sandbox. A real tenant deployment puts a deny-by-default network policy outside
// the process as well. This is the half that can live in the repository and be tested.
//
// ============================== THE RULE ==============================
// DENY BY DEFAULT. An empty or absent DELPHI_EGRESS_ALLOW blocks every host, including localhost: a guard
// that defaults to permitting is the failure mode this exists to prevent. Every blocked attempt throws
// AND is appended to the log, because a silent block looks exactly like a network error and would be
// debugged as one.

'use strict';
const fs = require('fs');
const net = require('net');
const tls = require('tls');
const http = require('http');
const https = require('https');

const ALLOW = String(process.env.DELPHI_EGRESS_ALLOW || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const LOG = process.env.DELPHI_EGRESS_LOG || null;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0']);
const ALLOW_LOOPBACK = process.env.DELPHI_EGRESS_ALLOW_LOOPBACK === '1';

function record(event, host, port, extra) {
  const line = JSON.stringify({ at: new Date().toISOString(), event, host: host ?? null, port: port ?? null, pid: process.pid, ...extra }) + '\n';
  if (LOG) { try { fs.appendFileSync(LOG, line); } catch { /* a guard must not crash on a log failure */ } }
  if (process.env.DELPHI_EGRESS_VERBOSE === '1') process.stderr.write(`[egress] ${line}`);
}

/** Is this host permitted? Exact match, or a leading-dot suffix match for a whole domain. */
function permitted(host) {
  const h = String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (LOOPBACK.has(h)) return ALLOW_LOOPBACK;
  for (const a of ALLOW) {
    if (a === h) return true;
    if (a.startsWith('.') && (h === a.slice(1) || h.endsWith(a))) return true;
  }
  return false;
}

class EgressBlocked extends Error {
  constructor(host, port) {
    super(`EGRESS BLOCKED: ${host}${port ? ':' + port : ''} is not in DELPHI_EGRESS_ALLOW (${ALLOW.length ? ALLOW.join(', ') : 'EMPTY - everything is blocked by default'})`);
    this.name = 'EgressBlocked';
    this.host = host; this.port = port;
    this.code = 'EGRESS_BLOCKED';
  }
}

function check(host, port, via) {
  if (permitted(host)) { record('allowed', host, port, { via }); return; }
  record('blocked', host, port, { via });
  throw new EgressBlocked(host, port);
}

// --- sockets ---------------------------------------------------------------------------------------
const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const o = args[0];
  const host = (o && typeof o === 'object') ? (o.host ?? o.hostname) : (typeof args[1] === 'string' ? args[1] : null);
  const port = (o && typeof o === 'object') ? o.port : (typeof args[0] === 'number' ? args[0] : null);
  if (host != null || port != null) check(host ?? '(unix socket or unnamed)', port, 'net.Socket.connect');
  return origConnect.apply(this, args);
};
for (const [mod, name] of [[net, 'connect'], [net, 'createConnection'], [tls, 'connect']]) {
  const orig = mod[name].bind(mod);
  mod[name] = function (...args) {
    const o = args[0];
    const host = (o && typeof o === 'object') ? (o.host ?? o.hostname ?? o.servername) : (typeof args[1] === 'string' ? args[1] : null);
    const port = (o && typeof o === 'object') ? o.port : (typeof args[0] === 'number' ? args[0] : null);
    check(host ?? '(unnamed)', port, `${mod === net ? 'net' : 'tls'}.${name}`);
    return orig(...args);
  };
}

// --- http(s) ---------------------------------------------------------------------------------------
for (const [mod, label] of [[http, 'http'], [https, 'https']]) {
  for (const name of ['request', 'get']) {
    const orig = mod[name].bind(mod);
    mod[name] = function (...args) {
      let host = null, port = null;
      const first = args[0];
      if (typeof first === 'string') { try { const u = new URL(first); host = u.hostname; port = u.port; } catch { host = first; } }
      else if (first instanceof URL) { host = first.hostname; port = first.port; }
      else if (first && typeof first === 'object') { host = first.host ?? first.hostname; port = first.port; }
      check(host ?? '(unnamed)', port, `${label}.${name}`);
      return orig(...args);
    };
  }
}

// --- fetch / undici --------------------------------------------------------------------------------
if (typeof globalThis.fetch === 'function') {
  const origFetch = globalThis.fetch;
  globalThis.fetch = function (input, init) {
    let host = null, port = null;
    try {
      const url = new URL(typeof input === 'string' ? input : (input && input.url) ? input.url : String(input));
      host = url.hostname; port = url.port;
    } catch { host = '(unparseable url)'; }
    check(host, port, 'fetch');
    return origFetch.call(this, input, init);
  };
}

// --- propagate to children -------------------------------------------------------------------------
// A publish script that shells out to a jar or a python process would otherwise escape the guard.
const here = require('path').resolve(__filename);
const req = `--require ${JSON.stringify(here)}`;
if (!String(process.env.NODE_OPTIONS || '').includes(here)) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${req}`.trim();
}

record('guard-installed', null, null, { allow: ALLOW, allow_loopback: ALLOW_LOOPBACK, argv: process.argv.slice(1, 3) });

module.exports = { permitted, EgressBlocked, ALLOW };
