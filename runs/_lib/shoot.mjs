#!/usr/bin/env node
// Screenshots of the live Design Studio page for one run, one frame per generation, from the real page on a
// local static server -- never mocked up.
//
//   node runs/_lib/shoot.mjs --run carbon-eating-bacterium
//
// Writes runs/<run>/fig/gen-<n>.png (the 3D view and the panels for that generation), fig/page.png,
// fig/generations.png and fig/shots.json (what was captured, the node count the page reported, and any
// console error). If the page does not render, nothing is written and the reason is printed: a missing
// screenshot is information.
//
// playwright-core is not a dependency of this repository. It is loaded from STUDIO_PW (default
// C:/Temp/partedit-deps/node_modules/playwright-core) and drives the installed Edge, the same way
// dashboard/shot-studio.mjs does.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const run = argv.includes('--run') ? argv[argv.indexOf('--run') + 1] : 'flying-mouse';
const RUN = path.join(ROOT, 'runs', run);
if (!fs.existsSync(path.join(RUN, 'summary.json'))) { console.error(`no run with a summary.json at runs/${run}`); process.exit(1); }
const PUB = path.join(ROOT, 'dashboard', 'public');
const FIG = path.join(RUN, 'fig');
fs.mkdirSync(FIG, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STUDIO_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.STUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const p = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(PUB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/blueprint3d/studio-live.html?run=${encodeURIComponent(run)}`;

const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = [];
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1480, height: 1100 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.gcard', { timeout: 15000 });
  await page.waitForTimeout(1500); // three.js, fonts, first frames

  const shown = await page.evaluate(() => (document.querySelector('#runsel') || {}).value || null);
  if (shown && shown !== run) throw new Error(`the page is showing run "${shown}", not "${run}"`);

  const cards = await page.$$('.gcard');
  if (!cards.length) throw new Error('the page rendered no generation cards; the baked replay is probably missing');

  await page.screenshot({ path: path.join(FIG, 'page.png'), fullPage: true });
  shots.push({ file: 'fig/page.png', shows: 'the whole page: the generation strip, the studio feed and the panels' });

  for (let i = 0; i < cards.length; i++) {
    await cards[i].click();
    await page.waitForTimeout(1400);
    const info = await page.evaluate(() => ({
      gen: document.querySelector('#gsel').textContent,
      nodes: (document.querySelector('#legend').textContent.match(/(\d+) nodes/) || [])[1] || null,
      taught: (document.querySelector('#pheno tr:last-child td') || {}).textContent || '',
    }));
    const file = `fig/gen-${info.gen}.png`;
    await page.locator('main > section:nth-child(2)').screenshot({ path: path.join(FIG, path.basename(file)) });
    shots.push({ file, generation: Number(info.gen), hierarchy_nodes: info.nodes ? Number(info.nodes) : null, what_it_taught: info.taught.slice(0, 400) });
    console.log(`${file}  generation ${info.gen}, ${info.nodes ?? 'no'} nodes`);
  }

  await (await page.locator('#strip')).screenshot({ path: path.join(FIG, 'generations.png') });
  shots.push({ file: 'fig/generations.png', shows: 'the generations side by side with the gate verdicts of each' });

  fs.writeFileSync(path.join(FIG, 'shots.json'), JSON.stringify({
    what: `Screenshots of dashboard/public/blueprint3d/studio-live.html?run=${run}, taken from the real page on a local static server.`,
    run, taken: new Date().toISOString(), viewport: '1480x1100 @2x, light',
    browser: 'Edge via playwright-core, ANGLE/SwiftShader software GL',
    console_errors: errors,
    not_a_mesh: 'Every 3D frame here is the ONTOLOGY HIERARCHY of that generation, not a surface mesh. No .glb exists for any of these subjects: the mesh builder is a parametric teleost builder and Blender is not installed on this machine.',
    shots,
  }, null, 1));
  if (errors.length) { console.log(`\n${errors.length} console error(s), recorded in fig/shots.json (the live-studio poll failing is expected when no studio server is running):`); for (const e of errors.slice(0, 4)) console.log('  ' + e.slice(0, 200)); }
} catch (e) {
  code = 1;
  console.error(`no screenshots written for ${run}: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}
process.exit(code);
