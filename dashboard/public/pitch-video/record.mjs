#!/usr/bin/env node
// Records the self-playing pitch page to a real video file. Edge, 1920x1080, Playwright's video
// capture. The raw capture and the trimmed deliverables go to C:/Temp/pitch-video-out/ and never
// into the repository.
//
//   node dashboard/public/pitch-video/record.mjs
//
// Writes:
//   C:/Temp/pitch-video-out/pitch-2min.webm   trimmed to exactly 120 s, VP9
//   C:/Temp/pitch-video-out/pitch-2min.mp4    the same cut as H.264, for players that refuse webm
//   C:/Temp/pitch-video-out/record.json       what was recorded, how long it ran, and any page error
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from './shoot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..');
const OUT = process.env.PITCH_OUT || 'C:/Temp/pitch-video-out';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PITCH_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.PITCH_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FFMPEG = process.env.FFMPEG || 'C:/Temp/tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';

const DURATION = 120;          // the film's own length
const LEAD = 1.0;              // a beat of black before the clock starts, trimmed off again
const TAIL = 1.2;              // let the last frame settle before the context closes

fs.mkdirSync(OUT, { recursive: true });
const rawDir = path.join(OUT, 'raw', 'pitch');
fs.rmSync(rawDir, { recursive: true, force: true });

const server = await serve(pub);
const url = `http://127.0.0.1:${server.address().port}/pitch-video/index.html?rec=1`;
console.log('serving ' + url);

const browser = await chromium.launch({
  executablePath: EDGE,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
         '--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1']
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1, colorScheme: 'dark',
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } }
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message).slice(0, 240)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
// The page sets __pitch.ready only once facts.json, tree.json, the fonts and every clip are in.
await page.waitForFunction(() => window.__pitch && window.__pitch.ready, null, { timeout: 120000 });
// Hold at t=0 so the recording opens on a composed first frame rather than mid-fade.
await page.evaluate(() => { window.__pitch.playing = false; window.__pitch.seek(0); });
const started = Date.now();
await page.waitForTimeout(LEAD * 1000);
await page.evaluate(() => { window.__pitch.playing = true; });
await page.waitForTimeout((DURATION + TAIL) * 1000);
const endT = await page.evaluate(() => window.__pitch.t);
const wall = (Date.now() - started) / 1000;
console.log(`page clock ended at ${endT.toFixed(2)} s after ${wall.toFixed(2)} s of wall time`);

const videoPath = await page.video().path();
await ctx.close();                 // flushes the file
await browser.close();
server.close();

const raw = fs.existsSync(videoPath) ? videoPath
  : fs.readdirSync(rawDir).filter(f => f.endsWith('.webm')).map(f => path.join(rawDir, f))[0];
if (!raw) { console.error('no video was written'); process.exit(1); }

const ffprobe = FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe');
const rawDur = Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]).toString().trim());
console.log(`raw capture ${(fs.statSync(raw).size / 1048576).toFixed(1)} MB, ${rawDur.toFixed(2)} s`);

// Trim the lead-in and hold exactly DURATION seconds of film.
const webm = path.join(OUT, 'pitch-2min.webm');
const mp4  = path.join(OUT, 'pitch-2min.mp4');
execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(LEAD), '-i', raw, '-t', String(DURATION),
  '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-deadline', 'good',
  '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-r', '25', '-an', webm], { stdio: 'inherit' });
execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(LEAD), '-i', raw, '-t', String(DURATION),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25',
  '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });

const dur = f => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const report = {
  recorded: new Date().toISOString(),
  page: '/pitch-video/index.html?rec=1',
  size: '1920x1080', fps: 25, audio: 'none, by design',
  pageClockEnded: Number(endT.toFixed(2)), wallSeconds: Number(wall.toFixed(2)),
  raw: { path: raw, seconds: Number(rawDur.toFixed(2)), mb: +(fs.statSync(raw).size / 1048576).toFixed(1) },
  webm: { path: webm, seconds: Number(dur(webm).toFixed(2)), mb: +(fs.statSync(webm).size / 1048576).toFixed(1) },
  mp4:  { path: mp4,  seconds: Number(dur(mp4).toFixed(2)),  mb: +(fs.statSync(mp4).size / 1048576).toFixed(1) },
  pageErrors: errors
};
fs.writeFileSync(path.join(OUT, 'record.json'), JSON.stringify(report, null, 2));
console.log('\n' + JSON.stringify({ webm: report.webm, mp4: report.mp4, pageErrors: errors.length }, null, 2));
