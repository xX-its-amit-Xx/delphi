#!/usr/bin/env node
// Export the swarm board + its sessions as one JSON for the static page dashboard/public/swarm-board/.
//
//   node sim-engine/swarm/export.mjs                                   live board (sim-engine/sessions/swarm/tasks.jsonl)
//   node sim-engine/swarm/export.mjs --store C:/Temp/delphi-swarm-run-XXXX   a recruiter run's throwaway store
//   node sim-engine/swarm/export.mjs --session <id> --out <file>       one session; default out is the dashboard page
//
// The page reads board.json next to it. Session bodies are truncated to 6,000 characters each.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const store = arg('store');
if (store) {
  process.env.STUDIO_SESSIONS_DIR = path.join(path.resolve(store), 'sessions');
  process.env.SWARM_BOARD_FILE = path.join(process.env.STUDIO_SESSIONS_DIR, 'swarm', 'tasks.jsonl');
}
const B = await import(pathToFileURL(path.join(import.meta.dirname, 'board.mjs')).href);
const session = arg('session');
const out = path.resolve(arg('out', path.join(import.meta.dirname, '..', '..', 'dashboard', 'public', 'swarm-board', 'board.json')));
const data = await B.exportBoard({ sessionIds: session ? [session] : null });
data.source = store ? `recruiter store ${path.basename(store)}` : B.boardFile();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 1));
console.log(`${data.tasks.length} tasks, ${Object.keys(data.sessions).length} session(s) -> ${out}`);
