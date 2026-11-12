#!/usr/bin/env node
// Render a dashboard page headless, click through its levels, and report what a reader would hit:
// console errors, failed requests, horizontal overflow at desktop and phone width, and whether
// playback actually changes the picture.
//
//   node sim-engine/scales/atlas/shoot.mjs                       local build, atlas page
//   node sim-engine/scales/atlas/shoot.mjs --live                the deployed site
//   node sim-engine/scales/atlas/shoot.mjs --page tracks/        another page under studio-live/
//   node sim-engine/scales/atlas/shoot.mjs --out C:/Temp/delphi/shots
//
// Starts its own static server on a free port and stops it on exit, so nothing is left listening.
// Exit code is 1 if there is a console error, a failed request or any overflow.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const PUBLIC = path.join(ROOT, 'dashboard/public');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIVE = process.argv.includes('--live');
const PAGE = arg('--page', 'atlas/');
const OUT = arg('--out', 'C:/Temp/delphi/shots');
const PLAYWRIGHT = process.env.DELPHI_PLAYWRIGHT
  ?? 'file:///C:/Temp/partedit-deps/node_modules/playwright-core/index.mjs';

fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.f16': 'application/octet-stream', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };

let server = null, base;
if (LIVE) {
  base = `https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/${PAGE}`;
} else {
  server = http.createServer((rq, rs) => {
    let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(PUBLIC, p);
    if (!f.startsWith(PUBLIC)) { rs.writeHead(403); rs.end(); return; }
    fs.readFile(f, (e, d) => {
      if (e) { rs.writeHead(404); rs.end('404'); return; }
      rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
      rs.end(d);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/blueprint3d/studio-live/${PAGE}`;
}

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const issues = [];
// "Failed to load resource" console lines carry no URL, and every failed request is already reported
// WITH its URL by the response handler below - so the anonymous console copy is dropped. A browser
// also asks for /favicon.ico on its own; the page does not need one, so that miss is not an issue.
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/^Failed to load resource/.test(m.text())) return;
  issues.push(`[console] ${m.text().slice(0, 220)}`);
});
page.on('pageerror', (e) => issues.push(`[pageerror] ${String(e.message).slice(0, 220)}`));
page.on('requestfailed', (r) => issues.push(`[requestfailed] ${r.url().slice(-80)} ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.status() < 400 || /favicon\.ico$/.test(r.url())) return;
  issues.push(`[http ${r.status()}] ${r.url().slice(-80)}`);
});

let overflowed = false;
try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);
  const slug = PAGE.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page';
  const ticks = await page.$$eval('.tick', (els) => els.map((e) => e.dataset.id));
  console.log(`${base}\nlevels: ${ticks.length ? ticks.join(', ') : '(page has no level rail)'}`);

  if (!ticks.length) {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (o > 0) overflowed = true;
    console.log(`  overflow ${o}`);
    await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: true });
  }
  for (const id of ticks) {
    await page.click(`.tick[data-id="${id}"]`);
    await page.waitForTimeout(1500);
    const s = await page.evaluate(() => ({
      label: document.querySelector('#now h2')?.textContent,
      sections: document.querySelectorAll('details.sec').length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    if (s.overflow > 0) overflowed = true;
    // does playback change the picture? a level that does not animate reports 0 and that is fine
    const a = await page.screenshot();
    const play = await page.$('#play');
    let moved = null;
    if (play) {
      await play.click(); await page.waitForTimeout(1600);
      const b = await page.screenshot();
      await play.click();
      let n = 0; const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) if (a[i] !== b[i]) n++;
      moved = n / len;
    }
    await page.screenshot({ path: `${OUT}/${slug}-${id}.png` });
    console.log(`  ${id.padEnd(20)} "${s.label}"  sections ${s.sections}  overflow ${s.overflow}`
      + (moved === null ? '' : `  playback changes ${(100 * moved).toFixed(0)}% of bytes`));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  const phone = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (phone > 0) overflowed = true;
  console.log(`  phone width overflow ${phone}`);
  await page.screenshot({ path: `${OUT}/${slug}-phone.png` });
} finally {
  await browser.close();
  if (server) server.close();
}

const uniq = [...new Set(issues)];
console.log(`issues: ${uniq.length}`);
for (const i of uniq.slice(0, 20)) console.log('  ' + i);
console.log(`screenshots in ${OUT}`);
process.exit(uniq.length || overflowed ? 1 : 0);
