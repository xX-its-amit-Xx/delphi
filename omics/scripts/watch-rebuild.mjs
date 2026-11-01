// Polls omics/<layer>/MANIFEST.json and annotations.jsonl.gz every 60 s; when any changes, waits until the files have
// stopped changing, then re-runs omics/build-index.mjs. Stops at --until (ISO time) or once all five layers say "done"
// and the index has been rebuilt after that. Log: C:/Temp/omics-cache/watch-rebuild.log
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LAYERS = ['genomic', 'transcriptomic', 'proteomic', 'pathway', 'ptm'];
const i = process.argv.indexOf('--until'); const UNTIL = i > 0 ? Date.parse(process.argv[i + 1]) : Date.now() + 100 * 60e3;
const LOG = (process.env.OMICS_CACHE || 'C:/Temp/omics-cache') + '/watch-rebuild.log';
const log = m => fs.appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`);
const stamp = () => LAYERS.map(l => ['MANIFEST.json', 'annotations.jsonl.gz'].map(f => { try { const s = fs.statSync(path.join(ROOT, 'omics', l, f)); return s.mtimeMs + ':' + s.size; } catch { return '-'; } }).join(',')).join('|');
const status = () => Object.fromEntries(LAYERS.map(l => { try { return [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'omics', l, 'MANIFEST.json'), 'utf8')).status]; } catch { return [l, 'missing']; } }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = stamp();
log('watching; until ' + new Date(UNTIL).toISOString() + ' ' + JSON.stringify(status()));
while (Date.now() < UNTIL) {
  await sleep(60e3);
  let now = stamp(); if (now === last) continue;
  do { await sleep(30e3); last = now; now = stamp(); } while (now !== last); // settle
  const st = status();
  try {
    const out = execFileSync(process.execPath, ['--max-old-space-size=8000', path.join(ROOT, 'omics/build-index.mjs')], { cwd: ROOT, encoding: 'utf8' });
    log('rebuilt ' + JSON.stringify(st) + ' :: ' + out.trim().split('\n').pop());
  } catch (e) { log('build failed: ' + e.message.slice(0, 400)); }
  if (Object.values(st).every(s => s === 'done')) { log('all layers done; stopping'); break; }
}
log('stopped');
