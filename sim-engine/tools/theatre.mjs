// Launching the theatre from inside the suite.
//
// The point of this module is that a person who runs a simulation does not have to know the dashboard
// exists. Opening a Design Studio session builds the scale ladder for whatever run is writing and hands back
// a URL -- and, when the caller is a person at a terminal rather than a test, opens it.
//
// WHEN IT OPENS A BROWSER. Only when `DELPHI_OPEN` is set to something other than "0". The run harness and
// the interactive CLI set it; the test suite does not, and nothing else does. A test that silently launched
// a browser on a build machine would be a bug in this file, so the default is to do nothing and say so.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
const LOCKFILE = path.join(os.tmpdir(), 'delphi-theatre.json');
const SERVE = path.join(ROOT, 'sim-engine', 'scales', 'serve.mjs');
const BUILD = path.join(ROOT, 'sim-engine', 'scales', 'build.mjs');

export const PAGE = 'blueprint3d/studio-live/theatre.html';

export function theatreUrl({ port, run = null, generation = null, live = true } = {}) {
  const q = new URLSearchParams();
  if (run) q.set('run', run);
  if (generation != null) q.set('gen', String(generation));
  if (live) q.set('live', '1');
  return `http://127.0.0.1:${port}/${PAGE}${q.size ? `?${q}` : ''}`;
}

function probe(port, ms = 700) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/healthz', timeout: ms }, r => { r.resume(); resolve(r.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/** A server that is already up, or null. Never starts one. */
export async function runningServer() {
  if (!fs.existsSync(LOCKFILE)) return null;
  try { const l = JSON.parse(fs.readFileSync(LOCKFILE, 'utf8')); return (await probe(l.port)) ? { port: l.port, pid: l.pid } : null; }
  catch { return null; }
}

/** The server, reused if one is already up. Detached, so it outlives the run that started it. */
export async function ensureServer() {
  if (fs.existsSync(LOCKFILE)) {
    try {
      const l = JSON.parse(fs.readFileSync(LOCKFILE, 'utf8'));
      if (await probe(l.port)) return { port: l.port, started: false, pid: l.pid };
    } catch {}
  }
  const child = spawn(process.execPath, [SERVE], { cwd: ROOT, detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 120));
    if (!fs.existsSync(LOCKFILE)) continue;
    try {
      const l = JSON.parse(fs.readFileSync(LOCKFILE, 'utf8'));
      if (await probe(l.port)) return { port: l.port, started: true, pid: l.pid };
    } catch {}
  }
  throw new Error(`the static server did not come up within 5 s. Start it yourself with: node sim-engine/scales/serve.mjs`);
}

function openInBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); return { opened: true }; }
  catch (e) { return { opened: false, why: String(e?.message ?? e) }; }
}

/** Rebuild the ladder for one run, so the page shows what just happened rather than the last bake. */
export function rebuild(run) {
  try {
    execFileSync(process.execPath, [BUILD, ...(run ? ['--run', run] : []), '--quiet'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    return { rebuilt: true, run: run ?? 'all' };
  } catch (e) { return { rebuilt: false, why: String(e?.stderr ?? e?.message ?? e).slice(0, 500) }; }
}

/**
 * The whole thing: rebuild, serve, open.
 *
 * It never throws into a caller's happy path. A session opening is not the place to fail because a browser
 * is missing, so every failure comes back as a field saying what did not happen and how to do it by hand.
 */
export async function launch({ run = null, generation = null, open = null, rebuild: wantRebuild = true } = {}) {
  const wanted = open == null ? (process.env.DELPHI_OPEN ?? '0') !== '0' : open;
  const out = { page: PAGE, run, generation, launched: false };

  // NOT WANTED MEANS NO SIDE EFFECTS AT ALL. No rebuild, no server, no process left behind. An earlier
  // version started a detached server here even when it then declined to open a browser, so every test that
  // opened a Design Studio session left a node process running on the machine. If a server is already up its
  // url is reported, because that costs nothing; otherwise the caller is told the one command to run.
  if (!wanted) {
    const running = await runningServer();
    if (running) { out.port = running.port; out.url = theatreUrl({ port: running.port, run, generation, live: true }); }
    out.why_not = 'DELPHI_OPEN is not set, so nothing was built, served or opened. Set DELPHI_OPEN=1 to have a run open the theatre, or call studio_theatre.';
    out.how_to_open = out.url ? `open ${out.url}` : `node sim-engine/scales/build.mjs${run ? ` --run ${run}` : ''} && node sim-engine/scales/serve.mjs`;
    return out;
  }

  if (wantRebuild && run) out.build = rebuild(run);
  try {
    const s = await ensureServer();
    out.port = s.port; out.server_started_now = s.started; out.server_pid = s.pid;
    out.url = theatreUrl({ port: s.port, run, generation, live: true });
    out.how_to_open = `open ${out.url}`;
    const o = openInBrowser(out.url);
    out.launched = o.opened;
    if (!o.opened) out.why_not = `could not start a browser: ${o.why}. The url above still works.`;
  } catch (e) {
    out.why_not = String(e?.message ?? e);
    out.how_to_open = 'node sim-engine/scales/serve.mjs   then open the theatre url it prints';
  }
  return out;
}
