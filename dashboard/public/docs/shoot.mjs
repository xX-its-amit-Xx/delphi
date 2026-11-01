// Screenshot the product report and record every console error and failed request.
//
//   node dashboard/public/docs/shoot.mjs [outDir]
//
// Needs the dashboard served locally on :8231. A page that errors is still shot, but the run
// prints the errors, so a broken page cannot be passed off as a working one. This exists because
// the product report shipped without ever having been console-tested, which is how its /favicon.ico
// 404 survived - every other page on the site already carried an inline icon link.
import { createRequire } from 'node:module';
const PW = process.env.PITCH_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core';
const { chromium } = createRequire(import.meta.url)(PW);
import fs from 'node:fs';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.argv[2] || 'C:/Temp/docs-shots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: EDGE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [], failed = [];
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
pg.on('requestfailed', r => failed.push(`${r.failure()?.errorText} ${r.url()}`));
pg.on('response', r => { if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url()}`); });
pg.on('request', r => {});
pg.on('requestfinished', async r => { const resp = await r.response(); if (resp && resp.status() >= 400) failed.push(`HTTP ${resp.status()} ${r.url()}`); });
await pg.goto('http://localhost:8231/docs/', { waitUntil: 'networkidle', timeout: 60000 });
await pg.waitForTimeout(3500);
await pg.screenshot({ path: `${OUT}/01-hero.jpg`, quality: 86, type: 'jpeg' });
// walk the five product tabs: click each, wait for its panel, shoot it
const tabIds = await pg.$$eval('.tab', ts => ts.map(t => t.dataset.tab));
if (!tabIds.length) throw new Error('no product tabs found - the page structure changed');
for (const id of tabIds) {
  await pg.click(`#tab-${id}`);
  await pg.waitForSelector(`#panel-${id}:not([hidden])`, { timeout: 10000 });
  await pg.evaluate(() => document.querySelector('.tabwrap')?.scrollIntoView());
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `${OUT}/tab-${id}.jpg`, quality: 86, type: 'jpeg' });
  // and the benchmark strip for that product, which is the part that must be legible
  const bench = await pg.$(`#panel-${id} .bench`);
  if (bench) { await bench.scrollIntoViewIfNeeded(); await pg.waitForTimeout(700);
    await pg.screenshot({ path: `${OUT}/bench-${id}.jpg`, quality: 86, type: 'jpeg' }); }
}
console.error(`tabs shot: ${tabIds.join(', ')}`);
// agent mode
await pg.click('#mAgent');
await pg.evaluate(() => document.getElementById('overview')?.scrollIntoView());
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${OUT}/agent-mode.jpg`, quality: 86, type: 'jpeg' });
// full page
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${OUT}/full.jpg`, quality: 80, type: 'jpeg', fullPage: true });
console.log(JSON.stringify({ errors, failed, shots: fs.readdirSync(OUT) }, null, 1));
await b.close();
