#!/usr/bin/env node
// Captures the real dashboard pages that the pitch video shows, so every screen in the video is a
// screenshot of this repo's own live page and never a mock-up. Writes JPEGs into
// pitch-video/shots/ plus shots/manifest.json recording what was shot, from which URL, and whether
// the page reported script errors (a page that errored is still written, but the manifest says so,
// so a broken screen cannot be passed off as a working one).
//
//   node dashboard/public/pitch-video/shoot.mjs
//   node dashboard/public/pitch-video/shoot.mjs graph scorer      # only these ids
//
// playwright-core is not a dependency of this repo: it is loaded from PITCH_PW (default
// C:/Temp/partedit-deps/node_modules/playwright-core), driving the installed Edge.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..');
const outDir = path.join(here, 'shots');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PITCH_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.PITCH_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// Every shot is one real page. `settle` is how long the page gets after networkidle (3D and
// simulation pages need the engine to draw a frame); `act` runs in the page before the shot.
const SHOTS = [
  { id: 'validate-show', url: '/validate-show/', settle: 6000 },
  { id: 'validate-gate', url: '/validate-show/', settle: 6000, scrollTo: /does not do what was asked|FAIL/i },
  { id: 'physics-sim', url: '/t/physics/sim/', settle: 9000 },
  { id: 'blueprint3d', url: '/blueprint3d/', settle: 11000 },
  { id: 'studio', url: '/blueprint3d/perturb.html', settle: 9000, act: async (page) => {
      const ta = page.locator('#panel textarea').first();
      if (await ta.count()) {
        await ta.fill('a zebrafish that glides at least 5 m from 1 m height and survives 10 \u00b0C to 30 \u00b0C as an adult');
        const btn = page.locator('#panel button:has-text("Read")').first();
        if (await btn.count()) { await btn.click(); await page.waitForTimeout(2500); }
      }
    } },
  { id: 'leanbio', url: '/leanbio/', settle: 4000 },
  { id: 'leanbio-capability', url: '/leanbio/capability.html', settle: 4000 },
  { id: 'graph', url: '/graph/', settle: 9000 },
  { id: 'scorer', url: '/scorer/', settle: 4000 },
  { id: 'gene-diff', url: '/gene-diff/', settle: 4000 },
  { id: 'swarm-board', url: '/swarm-board/', settle: 4000 },
  { id: 'lean-thread', url: '/t/lean/', settle: 4000 },
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.csv': 'text/csv', '.woff2': 'font/woff2', '.trig': 'text/plain' };

export function serve(root) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    let p = path.join(root, rel);
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    // Extensionless routes (blueprint3d redirects to "explode") resolve to the .html file.
    if (!fs.existsSync(p) && !path.extname(p) && fs.existsSync(p + '.html')) p += '.html';
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('shoot.mjs')) {
  const only = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve(pub);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const manifest = { shot: new Date().toISOString(), base: 'dashboard/public (served locally)', shots: [] };
  try {
    for (const s of SHOTS) {
      if (only.length && !only.includes(s.id)) continue;
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
      // These pages all carry a dark palette under prefers-color-scheme and a [data-theme] override;
      // the attribute is set too so a page that only honours the explicit toggle still comes out dark.
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', 'dark'));
        try { localStorage.setItem('theme', 'dark'); } catch {}
      });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
      let note = null;
      try {
        await page.goto(base + s.url, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForTimeout(s.settle);
        if (s.act) await s.act(page);
        if (s.scrollTo) {
          const y = await page.evaluate((src) => {
            const re = new RegExp(src.source, src.flags.replace('g', ''));
            const all = [...document.querySelectorAll('h1,h2,h3,p,div,span,td,li,pre')];
            const hit = all.reverse().find(el => el.children.length < 4 && re.test(el.textContent || ''));
            if (!hit) return null;
            const top = hit.getBoundingClientRect().top + window.scrollY;
            window.scrollTo(0, Math.max(0, top - 120));
            return Math.max(0, top - 120);
          }, { source: s.scrollTo.source, flags: s.scrollTo.flags });
          note = y == null ? 'scrollTo pattern not found; shot is the top of the page' : `scrolled to y=${Math.round(y)}`;
          await page.waitForTimeout(900);
        }
        const file = path.join(outDir, s.id + '.jpg');
        await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
        const kb = Math.round(fs.statSync(file).size / 1024);
        manifest.shots.push({ id: s.id, url: s.url, file: 'shots/' + s.id + '.jpg', kb, title: await page.title(), pageErrors: errors, note });
        console.log(`${errors.length ? 'WARN' : 'ok  '} ${s.id.padEnd(20)} ${String(kb).padStart(4)} KB  ${s.url}${errors.length ? '  errors: ' + errors[0] : ''}${note ? '  (' + note + ')' : ''}`);
      } catch (e) {
        manifest.shots.push({ id: s.id, url: s.url, file: null, error: String(e.message).slice(0, 300), pageErrors: errors });
        console.log(`FAIL ${s.id.padEnd(20)}      ${s.url}  ${e.message.split('\n')[0]}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nwrote ' + path.join(outDir, 'manifest.json'));
}
