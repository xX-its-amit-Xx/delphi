#!/usr/bin/env node
// Screenshots of the scale theatre, from the real page on a local server: the body, a part's pop-out panel,
// and the Lean proof behind one of that part's law chips.
//
//   node sim-engine/scales/shoot.mjs                      # every run in the index
//   node sim-engine/scales/shoot.mjs --run xenobot --part cilia
//
// Writes dashboard/public/figures/theatre/<run>-{body,part,proof}.png and shots.json. If the page does not
// render, nothing is written and the reason is printed: a missing screenshot is information.
//
// playwright-core is not a dependency of this repository. It is loaded from STUDIO_PW (default
// C:/Temp/partedit-deps/node_modules/playwright-core) and drives the installed Edge, the same way
// dashboard/shot-studio.mjs and runs/_lib/shoot.mjs do.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = f => argv.includes(f) ? argv[argv.indexOf(f) + 1] : null;
const FIG = path.join(ROOT, 'dashboard', 'public', 'figures', 'theatre');
fs.mkdirSync(FIG, { recursive: true });

const INDEX = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'scales', 'index.json');
if (!fs.existsSync(INDEX)) { console.error('no studio-live/scales/index.json — run node sim-engine/scales/build.mjs first'); process.exit(1); }
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));

// The part each run is worth opening on: the one the design is actually about.
const INTEREST = {
  'flying-mouse': ['patagium', 'interdigital region', 'wing'],
  'long-lived-fruit-fly': ['adult fat body', 'fat body', 'wing'],
  'carbon-eating-bacterium': ['polyhydroxyalkanoate granule', 'bacterial-type flagellum', 'cell'],
  xenobot: ['skin epidermis', 'multiciliated epithelial cell', 'cilia'],
};

// The generation each run is worth opening on: the last one, where the design has been through every layer.
const GEN = { 'flying-mouse': 4, 'long-lived-fruit-fly': 1, 'carbon-eating-bacterium': 5, xenobot: 3 };

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STUDIO_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.STUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const { server, port } = await serve(0);
const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = [];
let code = 0;
try {
  const only = arg('--run');
  for (const row of (index.runs ?? []).filter(r => !only || r.run === only)) {
    const page = await browser.newPage({ viewport: { width: 1480, height: 1020 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    const url = `http://127.0.0.1:${port}/blueprint3d/studio-live/theatre.html?run=${encodeURIComponent(row.run)}${GEN[row.run] != null ? `&gen=${GEN[row.run]}` : ''}`;
    const rec = { run: row.run, url, errors, shots: {} };
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForFunction('window.THEATRE && window.THEATRE.state().parts >= 0', null, { timeout: 30000 });
      await page.evaluate('window.THEATRE.stopSpin()');
      await page.waitForTimeout(900);
      rec.state = await page.evaluate('window.THEATRE.state()');

      const body = path.join(FIG, `${row.run}-body.png`);
      await page.screenshot({ path: body });
      rec.shots.body = path.relative(ROOT, body).replace(/\\/g, '/');

      // Open the part this design is about, and shoot the pop-out panel.
      let sel = null;
      for (const want of (INTEREST[row.run] ?? [])) {
        sel = await page.evaluate(`window.THEATRE.select(${JSON.stringify(want)})`);
        if (sel) break;
      }
      if (!sel) sel = await page.evaluate('window.THEATRE.select("body")');
      rec.selected = sel;
      if (sel) {
        await page.waitForTimeout(600);
        const part = path.join(FIG, `${row.run}-part.png`);
        await page.screenshot({ path: part });
        rec.shots.part = path.relative(ROOT, part).replace(/\\/g, '/');

        // And the law chips. TWO of them, deliberately: one whose law has a kernel-checked theorem and one
        // whose law is not formalised. The distinction between "here is the proof" and "there is no proof"
        // is the single most important thing this view asserts, so a screenshot run that only ever captured
        // the first would be evidence of nothing.
        await page.evaluate('document.querySelectorAll("#panel details").forEach(d => d.open = true)');
        await page.waitForTimeout(250);
        const chips = await page.$$('#panel .chip.law');
        // Which laws carry a theorem is in the bundle, so ask the page for it rather than guessing.
        const proved = new Set(await page.evaluate(`(async () => {
          const i = await (await fetch('scales/index.json')).json();
          const row = i.runs.find(r => r.run === ${JSON.stringify(row.run)});
          const b = await (await fetch('scales/' + row.file)).json();
          return Object.entries(b.laws ?? {}).filter(([, v]) => v.theorem).map(([k]) => k);
        })()`));
        for (const target of [{ key: 'proof', want: true }, { key: 'noproof', want: false }]) {
          const pickChip = [];
          for (const c of chips) { const id = await c.evaluate(n => n.dataset.law); if (proved.has(id) === target.want) pickChip.push({ c, id }); }
          if (!pickChip.length) { rec[`${target.key}_law`] = null; continue; }
          const { c, id } = pickChip[0];
          rec[`${target.key}_law`] = id;
          await c.click();
          await page.waitForFunction('!document.querySelector("#lawdetail")?.textContent.includes("loading the proof")', null, { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(300);
          const d = await page.$('#lawdetail .card');
          const f = path.join(FIG, `${row.run}-${target.key}.png`);
          if (d) await d.screenshot({ path: f }); else await page.screenshot({ path: f });
          rec.shots[target.key] = path.relative(ROOT, f).replace(/\\/g, '/');
          rec[`${target.key}_has_lean_source`] = await page.evaluate('Boolean(document.querySelector("#lawdetail pre"))');
        }
      }
      console.log(`${row.run}: ${rec.state?.parts} parts drawn, selected ${sel?.label ?? 'nothing'} (${sel?.laws ?? 0} law chips, ${sel?.chain_links ?? 0} chain links)${errors.length ? ` -- ${errors.length} console error(s)` : ''}`);
      if (errors.length) { code = 1; for (const e of errors.slice(0, 4)) console.log(`   ! ${e.slice(0, 220)}`); }
    } catch (e) {
      rec.failed = String(e?.message ?? e);
      code = 1;
      console.log(`${row.run}: FAILED -- ${rec.failed.slice(0, 300)}`);
    }
    shots.push(rec);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(FIG, 'shots.json'), JSON.stringify({
  what: 'Screenshots of the scale theatre, taken from the real page on a local server.',
  built: new Date().toISOString(), runs: shots }, null, 1));
console.log(`\n${shots.filter(s => s.shots.body).length}/${shots.length} runs shot -> dashboard/public/figures/theatre/`);
process.exit(code);
