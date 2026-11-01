#!/usr/bin/env node
// Pulls a frame out of the FINISHED video at every beat time, plus a mid-beat frame, so the cut can
// be looked at rather than assumed. Frames go to C:/Temp/pitch-video-out/frames/.
//
//   node dashboard/public/pitch-video/frames.mjs                from the recorded video
//   node dashboard/public/pitch-video/frames.mjs --page         from the live page instead
//
// The --page mode drives the page with ?t= and screenshots it; use it when no video exists yet.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from './shoot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..');
const OUT = process.env.PITCH_OUT || 'C:/Temp/pitch-video-out';
const framesDir = path.join(OUT, 'frames');
const FFMPEG = process.env.FFMPEG || 'C:/Temp/tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';

// Must match the BEATS array in index.html; read from the page so the two cannot drift.
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const m = src.match(/var BEATS = \[([\s\S]*?)\];/);
if (!m) { console.error('could not read the beat list out of index.html'); process.exit(1); }
const BEATS = [...m[1].matchAll(/\{id:'(\w+)',\s*t:(\d+),\s*d:(\d+)\}/g)]
  .map(x => ({ id: x[1], t: +x[2], d: +x[3] }));
const total = BEATS.reduce((a, b) => a + b.d, 0);
console.log(`${BEATS.length} beats, ${total} s total` + (total === 120 ? '  (exactly 2:00)' : '  *** NOT 120 s ***'));

// One frame just after each cut, one in the middle of each beat, and the last frame of the film.
const times = [];
for (const b of BEATS) { times.push({ t: b.t + 0.7, tag: b.id + '-in' }); times.push({ t: b.t + b.d / 2, tag: b.id + '-mid' }); }
times.push({ t: total - 0.4, tag: 'end' });

fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

if (process.argv.includes('--page')) {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PITCH_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
  const EDGE = process.env.PITCH_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const server = await serve(pub);
  const base = `http://127.0.0.1:${server.address().port}/pitch-video/index.html?rec=1&paused=1&t=`;
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
  for (const { t, tag } of times) {
    await page.goto(base + t.toFixed(2), { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction(() => window.__pitch && window.__pitch.ready, null, { timeout: 60000 });
    await page.waitForTimeout(1200);              // let the paused CSS animations land on their frame
    const f = path.join(framesDir, `${String(Math.round(t * 10)).padStart(4, '0')}-${tag}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 86 });
    console.log(`${tag.padEnd(12)} t=${t.toFixed(1).padStart(5)}  ${path.basename(f)}`);
  }
  await browser.close(); server.close();
  if (errors.length) console.log('\nPAGE ERRORS:\n  ' + [...new Set(errors)].join('\n  '));
} else {
  const video = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(OUT, 'pitch-2min.mp4');
  if (!fs.existsSync(video)) { console.error('no video at ' + video + ' \u2014 run record.mjs, or pass --page'); process.exit(1); }
  for (const { t, tag } of times) {
    const f = path.join(framesDir, `${String(Math.round(t * 10)).padStart(4, '0')}-${tag}.jpg`);
    execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', video, '-frames:v', '1', '-q:v', '3', f]);
    console.log(`${tag.padEnd(12)} t=${t.toFixed(1).padStart(5)}  ${path.basename(f)}`);
  }
}
console.log('\nframes in ' + framesDir);
