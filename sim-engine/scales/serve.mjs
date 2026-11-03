#!/usr/bin/env node
// A static server for the dashboard, so the theatre view can be opened from a run.
//
//   node sim-engine/scales/serve.mjs [--port 8787] [--once]
//
// The theatre is a page that fetches JSON, and fetch() does not work from file:// -- so running a simulation
// and being handed a path would hand the reader a page that cannot load its own data. This serves
// dashboard/public on a port and records where it is, in the OS temp directory rather than in the repository,
// so nothing about a developer's machine ends up in a commit.
//
// It serves files and nothing else: no upload, no write, no exec, no directory outside dashboard/public, and
// it refuses a path that escapes the root after resolution.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
const PUBLIC = path.join(ROOT, 'dashboard', 'public');
export const LOCKFILE = path.join(os.tmpdir(), 'delphi-theatre.json');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2', '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.gz': 'application/gzip' };

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch { res.writeHead(400).end('bad path'); return; }
    if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, root: 'dashboard/public' })); return; }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.resolve(PUBLIC, '.' + p);
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end('outside the served root'); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`not found: ${p}`); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('serve.mjs')) {
  const i = process.argv.indexOf('--port');
  const { server, port } = await serve(i > -1 ? Number(process.argv[i + 1]) : 0);
  fs.writeFileSync(LOCKFILE, JSON.stringify({ port, pid: process.pid, started: new Date().toISOString(), root: PUBLIC }, null, 1));
  const url = `http://127.0.0.1:${port}/blueprint3d/studio-live/theatre.html`;
  console.log(`serving dashboard/public on http://127.0.0.1:${port}`);
  console.log(`theatre: ${url}`);
  const bye = () => { try { fs.unlinkSync(LOCKFILE); } catch {} server.close(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
