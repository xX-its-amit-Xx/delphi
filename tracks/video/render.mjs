#!/usr/bin/env node
// Render a feature video from a script in tracks/video/scripts/, locally and reproducibly.
//
//   node tracks/video/render.mjs kernel
//   node tracks/video/render.mjs kernel [--fps 20] [--out <dir>] [--no-audio] [--still <scene-id>]
//
// How it works, and why this way:
//   1. Every {{token}} in the script is filled from the feature's OWN run output (the `data` field of
//      the script). A token with no value stops the render. No number is typed into a narration line
//      by hand, so the video cannot drift from what the run decided.
//   2. Windows' speech synthesiser speaks each line to a WAV, offline, and reports its length.
//   3. The timeline is built FROM those lengths: the picture is cut to the voice.
//   4. A headless browser draws one frame per tick by calling scene.html's window.__draw(t), so the
//      frames are a function of the timeline and not of the machine's speed.
//   5. ffmpeg encodes the frames, with the narration and a .vtt caption track beside it.
//
// Nothing leaves the machine: no text, no audio, no telemetry. The caption file carries the narration,
// so the picture never displays the words being spoken.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = Number(arg('--fps', 20));
const PAD_MS = Number(arg('--pad', 340));          // breath between lines
const TAIL_MS = 900;                                // a moment to read the last frame
const NO_AUDIO = process.argv.includes('--no-audio');
const STILL = arg('--still', null);
const W = 1280, H = 720;

const FFMPEG = process.env.DELPHI_FFMPEG ?? 'C:/Temp/ffmpeg-install/node_modules/ffmpeg-static/ffmpeg.exe';
const PLAYWRIGHT = process.env.DELPHI_PLAYWRIGHT ?? 'file:///C:/Temp/partedit-deps/node_modules/playwright-core/index.mjs';

const id = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
if (!id) { console.error('usage: node tracks/video/render.mjs <script id>   (scripts in tracks/video/scripts/)'); process.exit(1); }
const script = JSON.parse(fs.readFileSync(path.join(HERE, 'scripts', `${id}.json`), 'utf8'));
const OUT = arg('--out', `C:/Temp/delphi-video/${id}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'audio'), { recursive: true });

// ---------------------------------------------------------------------------------------------------
// 1. the numbers, from the run's own output

const run = JSON.parse(fs.readFileSync(path.join(ROOT, script.data), 'utf8'));
const worst = (run.verdicts ?? []).filter((v) => /low margin/.test(v.detail ?? ''))
  .map((v) => ({ v, low: Number(/low margin (-?[\d.]+)/.exec(v.detail)[1]) }))
  .sort((a, b) => a.low - b.low)[0];
const model = (run.artifacts ?? []).find((a) => a.artifact === 'predictive model');
const values = {
  inside: run.tally?.inside, outside: run.tally?.outside, cannot: run.tally?.['cannot-assess'],
  slots_filled: run.slots?.filled, slots_total: run.slots?.total,
  gates: run.gates, cascades: run.cascades,
  drafts: model?.drafts?.length ?? null,
  worst_low_margin: worst ? (worst.low > 0 ? `+${worst.low.toFixed(1)}` : worst.low.toFixed(1)) : null,
};
const fill = (s) => String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (values[k] === null || values[k] === undefined) {
    console.error(`REFUSED: {{${k}}} has no value in ${script.data}. A number must come from the run, not from the script.`);
    process.exit(1);
  }
  return String(values[k]);
});

const scenes = script.scenes.map((s) => JSON.parse(fill(JSON.stringify(s))));
console.log(`script   ${id}: ${scenes.length} scene(s); numbers from ${script.data}`);
console.log(`values   ${Object.entries(values).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(', ')}`);

// ---------------------------------------------------------------------------------------------------
// 2. the voice, and therefore the timing

let durations;
if (NO_AUDIO) {
  // 165 words a minute is roughly a careful speaking pace; used only to preview without audio.
  durations = scenes.map((s) => ({ id: s.id, seconds: Math.max(2.4, s.narration.split(/\s+/).length / 165 * 60) }));
} else {
  const linesFile = path.join(OUT, 'lines.json');
  fs.writeFileSync(linesFile, JSON.stringify(scenes.map((s) => ({ id: s.id, text: s.narration })), null, 1));
  const r = spawnSync('powershell', ['-NoProfile', '-File', path.join(HERE, 'narrate.ps1'),
    '-Lines', linesFile, '-Out', path.join(OUT, 'audio'), '-Voice', script.voice, '-Rate', String(script.rate ?? 0)],
    { encoding: 'utf8', timeout: 600_000 });
  if (r.status !== 0) { console.error(`narration failed:\n${r.stderr || r.stdout}`); process.exit(1); }
  const spoken = JSON.parse(r.stdout.trim().split('\n').filter((l) => l.trim().startsWith('[') || l.trim().startsWith('{')).pop());
  durations = (Array.isArray(spoken) ? spoken : [spoken]).map((s) => ({ id: s.id, seconds: s.seconds, wav: s.wav }));
  console.log(`voice    ${script.voice}: ${durations.length} line(s), ${durations.reduce((a, b) => a + b.seconds, 0).toFixed(1)} s of speech`);
}

let t = 0;
const timeline = { id, link: script.link, scenes: [], total_ms: 0 };
for (const s of scenes) {
  const d = durations.find((x) => x.id === s.id);
  const dur_ms = Math.round(d.seconds * 1000) + PAD_MS;
  timeline.scenes.push({ ...s, narration: undefined, caption: s.narration, start_ms: t, dur_ms, speech_ms: Math.round(d.seconds * 1000) });
  t += dur_ms;
}
timeline.total_ms = t + TAIL_MS;
timeline.scenes[timeline.scenes.length - 1].dur_ms += TAIL_MS;
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 1));
console.log(`timeline ${(timeline.total_ms / 1000).toFixed(1)} s, ${Math.round(timeline.total_ms / 1000 * FPS)} frame(s) at ${FPS} fps`);

// captions: the narration, as a track rather than burnt into the picture
const vtt = ['WEBVTT', ''];
const stamp = (ms) => new Date(ms).toISOString().substr(11, 12);
for (const s of timeline.scenes) vtt.push(`${stamp(s.start_ms)} --> ${stamp(s.start_ms + s.speech_ms)}`, s.caption, '');
fs.writeFileSync(path.join(OUT, `${id}.vtt`), vtt.join('\n'));
fs.writeFileSync(path.join(OUT, `${id}-transcript.md`), [
  `# ${script.title}`, '', `${script.subtitle ?? ''}`, '',
  'Spoken narration, in order. Every number in it is filled from the run output, not typed here.', '',
  ...timeline.scenes.map((s) => `**${(s.start_ms / 1000).toFixed(1)}s — ${s.label ?? s.id}**\n\n${s.caption}\n`),
].join('\n'));

// A dry run stops here: it proves every {{token}} in the script still resolves against the current run
// output, without starting a browser or the synthesiser. That is the part that silently rots.
if (process.argv.includes('--dry')) {
  console.log(`dry run: ${scenes.length} scene(s), every token resolved, nothing rendered`);
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------
// 3. the frames

const server = http.createServer((rq, rs) => {
  const p = new URL(rq.url, 'http://x').pathname;
  const f = p === '/' ? path.join(HERE, 'scene.html') : p === '/timeline.json' ? path.join(OUT, 'timeline.json') : null;
  if (!f || !fs.existsSync(f)) { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'content-type': p.endsWith('.json') ? 'application/json' : 'text/html' });
  rs.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const pw = await import(PLAYWRIGHT);
const browser = await pw.chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error(`page error: ${m.text()}`); });
await page.goto(base, { waitUntil: 'load' });
await page.evaluate((u) => window.__load(u), `${base}/timeline.json`);

if (STILL) {
  const sc = timeline.scenes.find((s) => s.id === STILL);
  if (!sc) { console.error(`no scene "${STILL}"`); process.exit(1); }
  await page.evaluate((ms) => window.__draw(ms), sc.start_ms + sc.dur_ms * 0.85);
  const f = path.join(OUT, `still-${STILL}.png`);
  await page.screenshot({ path: f });
  await browser.close(); server.close();
  console.log(`still    ${f}`);
  process.exit(0);
}

const nFrames = Math.round(timeline.total_ms / 1000 * FPS);
const t0 = Date.now();
for (let i = 0; i < nFrames; i++) {
  const ms = i / FPS * 1000;
  await page.evaluate((x) => window.__draw(x), ms);
  await page.screenshot({ path: path.join(OUT, 'frames', `f${String(i).padStart(5, '0')}.png`) });
  if (i % 200 === 0) process.stdout.write(`\rframes   ${i}/${nFrames}`);
}
console.log(`\rframes   ${nFrames}/${nFrames} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await page.evaluate((ms) => window.__draw(ms), timeline.scenes[0].dur_ms * 0.9);
await page.screenshot({ path: path.join(OUT, `${id}-poster.png`) });
await browser.close();
server.close();

// ---------------------------------------------------------------------------------------------------
// 4. the encode

const run2 = (args, label) => {
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8', timeout: 900_000 });
  if (r.status !== 0) { console.error(`${label} failed:\n${(r.stderr ?? '').split('\n').slice(-12).join('\n')}`); process.exit(1); }
};

const mp4 = path.join(OUT, `${id}.mp4`);
if (NO_AUDIO) {
  run2(['-y', '-framerate', String(FPS), '-i', path.join(OUT, 'frames', 'f%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], 'encode');
} else {
  // one silence file at the same format, so the concat list is uniform and the timing is exact
  const sil = path.join(OUT, 'audio', '_pad.wav');
  run2(['-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${(PAD_MS / 1000).toFixed(3)}`, '-c:a', 'pcm_s16le', sil], 'silence');
  const list = path.join(OUT, 'audio', 'concat.txt');
  const q = (p) => p.split(path.sep).join('/').replace(/'/g, "'\\''");
  fs.writeFileSync(list, durations.flatMap((d) => [`file '${q(d.wav)}'`, `file '${q(sil)}'`]).join('\n') + '\n');
  const voice = path.join(OUT, 'audio', 'voice.wav');
  run2(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', voice], 'concat');
  run2(['-y', '-framerate', String(FPS), '-i', path.join(OUT, 'frames', 'f%05d.png'), '-i', voice,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', mp4], 'mux');
}

const bytes = fs.statSync(mp4).size;
console.log(`video    ${mp4} (${(bytes / 1e6).toFixed(2)} MB, ${(timeline.total_ms / 1000).toFixed(1)} s, ${W}x${H})`);
console.log(`captions ${path.join(OUT, `${id}.vtt`)}`);
console.log(`poster   ${path.join(OUT, `${id}-poster.png`)}`);
fs.rmSync(path.join(OUT, 'frames'), { recursive: true, force: true });
