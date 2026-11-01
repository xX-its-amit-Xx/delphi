#!/usr/bin/env node
// Screenshot of the Design Studio (blueprint3d/perturb.html) for the pitch deck, taken from the real page on a local
// static server, never mocked up. Writes deck/fig/studio_spec.png and deck/fig/studio_spec.json (what was typed, when,
// which engine bundle the page reported, and whether the harness fell back to its MOCK engine). If the page does not
// render, nothing is written and build-deck.mjs greys the studio slide.
//
//   node dashboard/shot-studio.mjs        then  node dashboard/build-deck.mjs && python dashboard/make-pptx.py
//
// playwright-core is not a dependency of this repo: it is loaded from STUDIO_PW (default
// C:/Temp/partedit-deps/node_modules/playwright-core), driving the installed Edge.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const outDir = path.join(pub, 'deck', 'fig');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STUDIO_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.STUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const SPEC = 'a zebrafish that glides at least 5 m from 1 m height and survives 10 °C to 30 °C as an adult';
const MODEL = 'zebrafish-dev';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const p = path.join(pub, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(pub) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/blueprint3d/perturb.html`;

const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(5000);
  await page.selectOption('#modelSel', MODEL);
  await page.waitForTimeout(6000);
  await page.fill('#panel textarea', SPEC);
  await page.click('#panel button:has-text("Read")');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const mock = document.getElementById('mockflag');
    const panel = document.getElementById('panel')?.innerText || '';
    return {
      mock: !!mock && getComputedStyle(mock).display !== 'none',
      engineLine: (panel.match(/Engine:[^\n]*/) || [null])[0],
      valid: /Valid against the engine/.test(panel),
      criteria: (panel.match(/CRITERIA \((\d+)\)/) || [])[1] || null
    };
  });
  if (info.mock || !info.engineLine || errors.length) {
    console.error('studio did not render on the real engine; nothing written', info, errors);
    code = 1;
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    const png = path.join(outDir, 'studio_spec.png');
    await page.screenshot({ path: png });
    const meta = {
      file: 'fig/studio_spec.png',
      page: 'dashboard/public/blueprint3d/perturb.html (served locally, headless Edge, 1440x810)',
      typed: SPEC, model: MODEL, ...info,
      takenAt: new Date().toISOString(),
      sha256: crypto.createHash('sha256').update(fs.readFileSync(png)).digest('hex'),
      by: 'dashboard/shot-studio.mjs'
    };
    fs.writeFileSync(path.join(outDir, 'studio_spec.json'), JSON.stringify(meta, null, 1));
    console.log('wrote deck/fig/studio_spec.png', meta.engineLine, 'criteria', meta.criteria, 'valid', meta.valid);
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(code);
