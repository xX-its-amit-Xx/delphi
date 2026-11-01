#!/usr/bin/env node
// Screen-records this repo's own live pages while a script drives them, so the pitch film shows the
// real product moving rather than a still of it. Playwright writes one .webm per page; ffmpeg then
// trims each to its useful window and re-encodes it small enough to live beside the page
// (960x540 VP9, no audio). Output goes to pitch-video/clips/ plus clips/manifest.json.
//
//   node dashboard/public/pitch-video/clips.mjs              all clips
//   node dashboard/public/pitch-video/clips.mjs sim gene      only these ids
//
// Raw captures land in C:/Temp/pitch-video-out/raw/ and are never copied into the repository.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from './shoot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..');
const outDir = path.join(here, 'clips');
const rawDir = 'C:/Temp/pitch-video-out/raw';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PITCH_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.PITCH_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FFMPEG = process.env.FFMPEG || 'C:/Temp/tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';

const W = 1280, H = 720;
const wait = (p, ms) => p.waitForTimeout(ms);

const CLIPS = [
  {
    id: 'assembly', url: '/print/', keep: 16,
    // The 100 STL parts assembling in anatomical order, played by the page's own animation.
    // This is the real print kit coming together, not a rendering of one - which is why the
    // Design Studio tab shows it beside the STL downloads.
    drive: async (p) => {
      await wait(p, 5000);
      const replay = p.locator('#replayBtn');
      if (await replay.count()) await replay.click();
      await wait(p, 16000);
    }
  },
  {
    id: 'leanbio', url: '/leanbio/', keep: 13,
    // The LeanBio repo: claims arriving, grounded, queued, and the ones that do not make it.
    // Added for the product report's LeanBio tab, which otherwise had no moving footage of its
    // own product and was borrowing a still.
    drive: async (p) => {
      await wait(p, 3500);
      for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 430); await wait(p, 1200); }
    }
  },
  {
    id: 'mcp', url: '/studio-api/', keep: 13,
    // The API surface a caller actually reads before calling it.
    drive: async (p) => {
      await wait(p, 3000);
      for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 420); await wait(p, 1200); }
    }
  },
  {
    id: 'validate', url: '/validate-show/', keep: 15,
    // The 7-act walkthrough, played by its own Play button.
    drive: async (p) => {
      await wait(p, 5000);
      const play = p.locator('button:has-text("Play")').first();
      if (await play.count()) await play.click();
      await wait(p, 15000);
    }
  },
  {
    id: 'sim-ff', url: '/t/physics/sim/', keep: 12, scroll: 420,
    // The real flying fish, flown by the solver on the page.
    drive: async (p) => { await wait(p, 9000); await wait(p, 12500); }
  },
  {
    id: 'sim-wz', url: '/t/physics/sim/', keep: 12, scroll: 420,
    // The same solver, same page, with the winged zebrafish selected instead.
    drive: async (p) => {
      await wait(p, 9000);
      const sel = p.locator('select').filter({ hasText: /flying fish|zebrafish|design/i }).first();
      const all = p.locator('select');
      const n = await all.count();
      for (let i = 0; i < n; i++) {
        const opts = await all.nth(i).locator('option').allTextContents();
        const hit = opts.findIndex(o => /winged|zebrafish/i.test(o));
        if (hit >= 0) { await all.nth(i).selectOption({ index: hit }); break; }
      }
      await wait(p, 12500);
    }
  },
  {
    id: 'gene', url: '/gene-diff/', keep: 13,
    // The alignment, expanded outward through every scale the page holds.
    drive: async (p) => {
      await wait(p, 3500);
      for (let i = 0; i < 9; i++) {
        await p.mouse.wheel(0, 460);
        await wait(p, 1100);
      }
      await wait(p, 2500);
    }
  },
  {
    id: 'graph', url: '/graph/', keep: 12,
    // The force layout settling, then a node opened.
    drive: async (p) => {
      await wait(p, 2000);
      const box = { x: W * 0.42, y: H * 0.5 };
      await wait(p, 7000);
      await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + 180, box.y - 90, { steps: 40 }); await p.mouse.up();
      await wait(p, 4500);
    }
  },
  {
    id: 'blueprint', url: '/blueprint3d/', keep: 14,
    // Orbit the organism, then step the peel stages.
    drive: async (p) => {
      await wait(p, 11000);
      await p.mouse.move(W * 0.4, H * 0.5); await p.mouse.down();
      await p.mouse.move(W * 0.62, H * 0.46, { steps: 60 }); await p.mouse.up();
      await wait(p, 1800);
      for (const label of ['2 split', '3 skin off', '4 muscle off', '5 organs']) {
        const b = p.locator(`button:has-text("${label}")`).first();
        if (await b.count()) { await b.click(); await wait(p, 2600); }
      }
      await wait(p, 1500);
    }
  },
  {
    id: 'studio', url: '/blueprint3d/perturb.html', keep: 12,
    // Typing a specification and watching the harness parse it into criteria.
    drive: async (p) => {
      await wait(p, 9000);
      const ta = p.locator('#panel textarea').first();
      if (await ta.count()) {
        await ta.click();
        await ta.type('a fish, with wings: a zebrafish that glides at least 5 m from 1 m height', { delay: 55 });
        await wait(p, 700);
        const btn = p.locator('#panel button:has-text("Read")').first();
        if (await btn.count()) { await btn.click(); }
      }
      await wait(p, 5000);
    }
  },
];

const only = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(rawDir, { recursive: true });
const server = await serve(pub);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const manifest = { recorded: new Date().toISOString(), size: `${W}x${H} captured, 960x540 delivered`, clips: [] };

for (const c of CLIPS) {
  if (only.length && !only.includes(c.id)) continue;
  const dir = path.join(rawDir, c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: W, height: H } }
  });
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', 'dark'));
    try { localStorage.setItem('theme', 'dark'); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  let err = null;
  try {
    await page.goto(base + c.url, { waitUntil: 'networkidle', timeout: 90000 });
    if (c.scroll) await page.evaluate(y => window.scrollTo(0, y), c.scroll);
    await c.drive(page);
  } catch (e) { err = String(e.message).split('\n')[0]; }
  await ctx.close();                       // flushes the video

  const raw = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.webm')).map(f => path.join(dir, f))[0] : null;
  let out = null, kb = null;
  // A clip that fails to encode must not take the rest of the run down with it: the film falls
  // back to that page's still and the manifest records which one did.
  try {
    if (raw) {
      out = path.join(outDir, c.id + '.webm');
      // Keep the last `keep` seconds (the page has settled by then), scale to 960 wide, VP9 CRF 40.
      const dur = Number(execFileSync(FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe'),
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]).toString().trim()) || c.keep;
      const ss = Math.max(0, dur - c.keep);
      execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(ss), '-i', raw,
        '-vf', 'scale=960:-2,fps=24', '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0',
        '-row-mt', '1', '-an', out]);
      kb = Math.round(fs.statSync(out).size / 1024);
    }
  } catch (e) {
    err = (err ? err + ' | ' : '') + 'encode: ' + String(e.message).split('\n')[0];
    out = null;
  }
  manifest.clips.push({ id: c.id, url: c.url, file: out ? 'clips/' + c.id + '.webm' : null, kb, seconds: c.keep, pageErrors: errors, error: err });
  console.log(`${err ? 'FAIL' : out ? 'ok  ' : 'NONE'} ${c.id.padEnd(10)} ${String(kb ?? '').padStart(5)} KB  ${c.url}${err ? '  ' + err : ''}${errors.length ? '  pageErrors:' + errors.length : ''}`);
}

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nwrote ' + path.join(outDir, 'manifest.json'));
