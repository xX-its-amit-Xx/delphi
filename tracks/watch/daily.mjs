#!/usr/bin/env node
// The daily run of the paper watcher, start to finish. Safe to run twice: every step skips what is done.
//
//   node tracks/watch/daily.mjs [--deploy] [--no-read] [--max-read 25]
//
// Steps: 1 machine headroom  2 search (arXiv + Europe PMC)  3 read new papers (a headless reader, public
// pages only)  4 Lean-check every record  5 community files  6 dashboard bundle  7 holdout gates
// 8 deploy (only with --deploy, and only if every earlier step and both gates passed).
// It never commits, pushes, posts or emails. One line per run is appended to tracks/watch/daily-log.jsonl.
//
// Environment (set by the scheduler wrapper, never written here):
//   WATCH_SCRATCH   folder for the day's slice and reader output (default C:/Temp/delphi-watch-daily)
//   WATCH_GUARD     path of the machine's resource-guard script; skipped if unset
//   WATCH_READER    reader command, default "claude"; the reader gets only Read, Write and WebFetch
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const has = (k) => process.argv.includes(k);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const day = new Date().toISOString().slice(0, 10);
const SCRATCH = path.join(process.env.WATCH_SCRATCH ?? 'C:/Temp/delphi-watch-daily', day);
const LOCK = path.join(HERE, '.daily.lock');
const log = { day, started: new Date().toISOString(), steps: [] };
const step = (name, ok, note) => { log.steps.push({ name, ok, note: String(note ?? '').slice(0, 300) }); console.log(`${ok ? 'ok    ' : 'FAILED'} ${name}${note ? '  ' + String(note).slice(0, 160) : ''}`); return ok; };
const sh = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 1_800_000, shell: process.platform === 'win32' && !/\.exe$/i.test(cmd) && cmd !== process.execPath, ...opt }); return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }; };
const node = (script, ...a) => sh(process.execPath, [path.join(ROOT, script), ...a]);
const last = (s) => s.trim().split('\n').filter(Boolean).slice(-1)[0] ?? '';
const finish = (code) => { log.finished = new Date().toISOString(); log.ok = code === 0; fs.appendFileSync(path.join(HERE, 'daily-log.jsonl'), JSON.stringify(log) + '\n'); try { fs.rmSync(LOCK); } catch {} process.exit(code); };

// one run at a time; a lock older than three hours is a crashed run
if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 3 * 3600_000) { console.log('another daily run holds the lock; exiting'); process.exit(0); }
fs.writeFileSync(LOCK, String(process.pid));

// 1. headroom: about thirty sessions share this machine
if (process.env.WATCH_GUARD) {
  const g = sh('powershell', ['-NoProfile', '-File', process.env.WATCH_GUARD]);
  const word = (g.out.match(/^(OK|WARN|HALT)/m) ?? [])[1] ?? 'unknown';
  if (!step('machine headroom', word === 'OK' || word === 'WARN', word) ) finish(0); // HALT: do nothing today, not an error
}
// 2. search
const w = node('tracks/watch/watch.mjs', '--max', '40');
step('search arXiv and Europe PMC', w.ok || /added \d+ papers/.test(w.out), last(w.out)); // one source failing does not stop the day
// 3. read
let readOk = true;
if (!has('--no-read')) {
  const s = node('tracks/watch/slice.mjs', SCRATCH, '--n', '1', '--max', arg('--max-read', '25'));
  if (/nothing unread/.test(s.out)) step('read new papers', true, 'nothing unread');
  else if (!s.ok) readOk = step('read new papers', false, last(s.out));
  else {
    fs.copyFileSync(path.join(HERE, 'reader-prompt.md'), path.join(SCRATCH, 'reader-prompt.md'));
    fs.mkdirSync(path.join(SCRATCH, 'holdout'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'holdout/split.json'), path.join(SCRATCH, 'holdout/split.json'));
    const out = path.join(SCRATCH, 'watch-a.json');
    if (!fs.existsSync(out)) {
      // the task goes in a file so that nothing but a plain sentence crosses the shell
      fs.writeFileSync(path.join(SCRATCH, 'reader-task.md'), 'You are a paper reader. Read reader-prompt.md in the current folder and follow it exactly. The sealed-organism roster is holdout/split.json in the current folder. Your slice file is slice-a.jsonl. Your ONE output file is watch-a.json in the current folder, with "slice": "a". Write nothing else. Every paper in the slice gets exactly one entry. When done, reply with one line: how many papers per outcome.\n');
      const r = sh(process.env.WATCH_READER ?? 'claude', ['-p', '"Read the file reader-task.md in the current folder and do exactly what it says."', '--tools', 'Read', 'Write', 'WebFetch', '--allowedTools', 'Read', 'Write', 'WebFetch', '--model', 'claude-sonnet-5-5'], { cwd: SCRATCH, timeout: 3_000_000 });
      fs.writeFileSync(path.join(SCRATCH, 'reader.log'), r.out);
    }
    let n = null; try { n = JSON.parse(fs.readFileSync(out, 'utf8')).papers.length; } catch {}
    readOk = step('read new papers', n !== null, n !== null ? `${n} papers read` : 'the reader wrote no valid output; they stay unread and are tried again tomorrow');
  }
}
// 4. check
const v = node('tracks/watch/verify.mjs', ...(fs.existsSync(path.join(SCRATCH, 'watch-a.json')) && readOk ? ['--from', SCRATCH] : []));
const vOk = step('Lean-check every record', v.ok, v.out.split('\n')[0]);
const s2 = node('tracks/watch/second.mjs'); step('second-reader comparison', s2.ok, last(s2.out));
// 5-7
const c = node('tracks/watch/community.mjs'); const cOk = step('community files', c.ok, last(c.out));
const b = node('tracks/build.mjs'); const bOk = step('dashboard bundle', b.ok && /wrote dashboard/.test(b.out), last(b.out));
const g1 = node('holdout/check-leaks.mjs', 'tracks'); const g1Ok = step('holdout gate on tracks/', g1.ok && /no held-out organism named/.test(g1.out), last(g1.out));
const g2 = node('sim-engine/scales/atlas/holdout-html-scan.mjs'); const g2Ok = step('holdout scan of pages and bundle', g2.ok && /0 hits/.test(g2.out), last(g2.out));
const good = vOk && cOk && bOk && g1Ok && g2Ok;
// 8. deploy
if (has('--deploy')) {
  if (!good) step('deploy', false, 'skipped: an earlier step failed, so nothing new goes public');
  else { const d = sh('npx', ['wrangler', 'deploy'], { cwd: path.join(ROOT, 'dashboard') }); step('deploy', d.ok, (d.out.match(/Current Version ID: \S+/) ?? [last(d.out)])[0]); }
}
finish(good ? 0 : 1);
