#!/usr/bin/env node
// Screenshots every slide of the pitch deck at 1920x1080 and at 390 px, so the deck can be looked at rather
// than assumed. Also fails on any console or page error, and reports any slide whose content overflows its
// frame or scrolls the page sideways -- the two faults a deck of full-bleed slides actually gets.
//
//   node dashboard/shot-deck.mjs                 -> C:/Temp/deck-shots/<w>/NN-<id>.png
//   node dashboard/shot-deck.mjs --out <dir>
//
// Not committed and not deployed: the output directory is outside the repository on purpose.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DECK_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.DECK_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const argOut = process.argv.indexOf('--out');
const OUT = argOut > 0 ? process.argv[argOut + 1] : 'C:/Temp/deck-shots';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pptx':
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  let p = path.join(pub, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  else if (!fs.existsSync(p) && fs.existsSync(p + '.html')) p += '.html';
  if (!p.startsWith(pub) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
// still=1 settles every bar, counter and route without waiting for the scroll observer, which does not fire
// reliably under a headless virtual clock. A deck screenshotted without it is a deck full of zeros.
const url = `http://127.0.0.1:${server.address().port}/deck/?still=1`;

const WIDTHS = [{ w: 1920, h: 1080 }, { w: 390, h: 844 }];
const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
let shots = 0, ids = [];
try {
  for (const { w, h } of WIDTHS) {
    const dir = path.join(OUT, String(w));
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: 'light', deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.slide[data-id]').length > 1, null, { timeout: 30000 });
    await page.waitForTimeout(3500);

    ids = await page.$$eval('.slide[data-id]', els => els.map(e => e.dataset.id));
    // the page scrolling sideways at all is a fault, at either width
    const bodyWide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (bodyWide) problems.push(`${w}px: the page scrolls horizontally`);

    for (let i = 0; i < ids.length; i++) {
      await page.evaluate(n => document.querySelectorAll('.slide')[n].scrollIntoView({ behavior: 'instant', block: 'start' }), i);
      await page.waitForTimeout(260);
      // does this slide's content fit the frame it is given?
      const over = await page.evaluate(n => {
        const sl = document.querySelectorAll('.slide')[n];
        const r = sl.getBoundingClientRect();
        let worstY = 0, worstX = 0, who = '';
        for (const el of sl.querySelectorAll('*')) {
          const b = el.getBoundingClientRect();
          if (!b.width && !b.height) continue;
          const dy = b.bottom - r.bottom, dx = b.right - r.right;
          if (dy > worstY) { worstY = dy; who = el.className || el.tagName; }
          if (dx > worstX) worstX = dx;
        }
        return { y: Math.round(worstY), x: Math.round(worstX), who: String(who).slice(0, 40), h: Math.round(sl.scrollHeight - sl.clientHeight) };
      }, i);
      // the HUD bar occupies the bottom ~48px, so anything past that is genuinely hidden
      if (over.y > 10) problems.push(`${w}px · ${ids[i]}: content runs ${over.y}px past the bottom of the slide (${over.who})`);
      if (over.x > 2) problems.push(`${w}px · ${ids[i]}: content runs ${over.x}px past the right edge`);
      await page.screenshot({ path: path.join(dir, `${String(i).padStart(2, '0')}-${ids[i]}.png`) });
      shots++;
    }
    if (errs.length) problems.push(...errs.map(e => `${w}px: ${e}`));
    await page.close();
  }
} finally { await browser.close(); server.close(); }

console.log(`${shots} screenshots of ${ids.length} slides -> ${OUT}`);
console.log(ids.map((id, i) => `${String(i).padStart(2, '0')} ${id}`).join('\n'));
if (problems.length) {
  console.error(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\nno console errors, nothing overflowing, no horizontal scroll.');
