#!/usr/bin/env node
// Screenshots of the project's own live pages, for the pitch deck. Every deck figure that shows a screen is taken
// from the real page on a local static server here -- never drawn, never mocked up. Writes deck/fig/page_<key>.png
// and appends to deck/fig/pages.json (url, what it shows, when, viewport, sha256, and any console/page errors).
//
// A page that throws, or renders blank, is NOT written. build-deck.mjs then leaves that slide's figure out and the
// slide greys itself, which is the point: a missing shot must never become a drawn one.
//
//   node dashboard/shot-pages.mjs            all pages
//   node dashboard/shot-pages.mjs graph      one page
//
// playwright-core is not a dependency of this repo. It is loaded from DECK_PW (default
// C:/Temp/partedit-deps/node_modules/playwright-core) and drives the installed Edge.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const outDir = path.join(pub, 'deck', 'fig');
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DECK_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.DECK_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// Each entry: the real route, what the slide claims the shot shows, and how long the page needs before it is settled.
// `settle` runs in the page and returns true when the page's own content has arrived -- never a bare timeout, so a
// page that failed to load cannot be photographed as if it had.
const PAGES = [
  {
    key: 'leanbio',
    route: '/leanbio/',
    shows: 'The LeanBio forum: claims distilled from the literature, grounded to ontology ids, ranked, and queued for Lean',
    viewport: { width: 1500, height: 1000 },
    settle: () => document.body.innerText.trim().length > 400,
  },
  {
    key: 'capability',
    route: '/leanbio/capability.html',
    shows: 'The capability map: personas, use cases, grand questions and ranked tool gaps, served as versioned JSON',
    viewport: { width: 1500, height: 1000 },
    settle: () => document.querySelectorAll('[data-persona], .persona, section').length > 3,
  },
  {
    key: 'validate',
    route: '/validate-show/',
    shows: 'The validation harness on the headline design, at the physics act: five named results side by side, each with its own gate',
    viewport: { width: 1500, height: 1000 },
    settle: () => /FAIL|PASS|CANNOT/.test(document.body.innerText),
    // Act 1 is an empty stage. Step to the physics act, which is the one that fails, so the deck shows the gate
    // rather than the title card.
    act: async page => {
      // The act strip's own wrapper sits over its labels, so a plain click never lands: dispatch on the label.
      const stepped = await page.evaluate(() => {
        const el = [...document.querySelectorAll('span,button,a,div')]
          .find(n => /^\s*6\.\s*physics\s*$/i.test(n.textContent || ''));
        if (!el) return false;
        (el.closest('[data-i],button,a') || el).click();
        return true;
      });
      if (stepped) await page.waitForTimeout(3500);
    },
  },
  {
    key: 'physics',
    route: '/t/physics/sim/',
    shows: 'The physics simulator: the glide run that the design has to survive',
    viewport: { width: 1500, height: 950 },
    settle: () => document.body.innerText.trim().length > 200,
  },
  {
    key: 'blueprint',
    route: '/blueprint3d/',
    shows: 'The organism blueprint in 3D: the anatomical part hierarchy the design studio writes into, each node with the query that produced it',
    viewport: { width: 1500, height: 950 },
    settle: () => (!!document.querySelector('canvas, svg') && document.body.innerText.trim().length > 200)
      && !/HTTP ERROR|can.t be found/i.test(document.body.innerText),
  },
  {
    key: 'graph',
    route: '/graph/',
    shows: 'The claim graph: the assertions distilled out of the primary sources, and what each one rests on',
    viewport: { width: 1500, height: 950 },
    settle: () => !!document.querySelector('svg, canvas') || document.body.innerText.trim().length > 200,
  },
];

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.txt': 'text/plain',
  '.md': 'text/markdown', '.csv': 'text/csv', '.trig': 'text/plain', '.woff2': 'font/woff2',
};
// The deployed site serves clean URLs (/blueprint3d/explode -> explode.html), and pages link to each other that
// way, so the local server has to do the same or a page redirects itself into a 404 and gets photographed blank.
const server = http.createServer((req, res) => {
  let p = path.join(pub, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  else if (!fs.existsSync(p) && fs.existsSync(p + '.html')) p += '.html';
  if (!p.startsWith(pub) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const wanted = only.length ? PAGES.filter(p => only.includes(p.key)) : PAGES;

const browser = await chromium.launch({
  executablePath: EDGE,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const written = [];
const refused = [];
try {
  for (const P of wanted) {
    const page = await browser.newPage({ viewport: P.viewport, colorScheme: 'light', deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    let ok = false, why = '';
    try {
      const r = await page.goto(base + P.route, { waitUntil: 'load', timeout: 60000 });
      if (!r || !r.ok()) throw new Error(`HTTP ${r ? r.status() : 'no response'}`);
      // wait for the page's own content, not for a clock
      await page.waitForFunction(P.settle, null, { timeout: 45000 });
      await page.waitForTimeout(2500); // let charts/fonts paint after the content arrives
      if (P.act) await P.act(page);    // drive the page to the view the slide is about
      const ink = await page.evaluate(() => document.body.innerText.replace(/\s+/g, '').length);
      if (ink < 60) throw new Error(`page rendered almost no text (${ink} chars): refusing to photograph a blank page`);
      ok = true;
    } catch (e) { why = e.message; }

    if (!ok) {
      refused.push({ key: P.key, route: P.route, why, errors });
      console.error(`REFUSED ${P.key} (${P.route}): ${why}`);
      await page.close();
      continue;
    }
    const file = `fig/page_${P.key}.png`;
    const abs = path.join(pub, 'deck', file);
    await page.screenshot({ path: abs, fullPage: false });
    const sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    written.push({
      file, shows: P.shows,
      provenance: `Screenshot of this project's own page ${P.route}, rendered headless in Edge at `
        + `${P.viewport.width}x${P.viewport.height} on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC `
        + `(dashboard/shot-pages.mjs). Not a mock-up.`,
      route: P.route, viewport: P.viewport, takenAt: new Date().toISOString(),
      consoleErrors: errors, sha256: sha,
    });
    console.log(`${file}  ${P.route}  ${errors.length} console error(s)`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

// Merge, so running one page does not drop the others.
const manifest = path.join(outDir, 'pages.json');
const prev = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : { pages: [], refused: [] };
const byKey = new Map((prev.pages || []).map(p => [p.file, p]));
for (const w of written) byKey.set(w.file, w);
for (const r of refused) byKey.delete(`fig/page_${r.key}.png`);
fs.writeFileSync(manifest, JSON.stringify({
  built: new Date().toISOString(),
  tool: 'dashboard/shot-pages.mjs',
  rule: 'Every entry is a screenshot of a real page on a local server. A page that threw, 404ed or rendered blank is '
      + 'in `refused` and has no image, so the slide that wanted it greys itself rather than showing a drawing.',
  pages: [...byKey.values()].sort((a, b) => a.file.localeCompare(b.file)),
  refused,
}, null, 1) + '\n');
console.log(`pages.json: ${byKey.size} shot(s), ${refused.length} refused`);
process.exit(refused.length && !written.length ? 1 : 0);
