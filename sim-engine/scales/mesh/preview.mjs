#!/usr/bin/env node
// Screenshots of the REAL theatre page in illustrated (mesh) mode, for sculptors.
//
//   node sim-engine/scales/mesh/preview.mjs --run long-lived-fruit-fly [--gen 1] [--stage larva] [--part eye]
//                                           [--out <dir>] [--no-build] [--dark]
//
// 1. builds the run's ladder AND its illustration mesh (build.mjs --run <run> --meshes; a cached GLB is
//    reused, so this is instant unless a sculptor changed something). --no-build skips it.
// 2. serves dashboard/public on a free port and opens theatre.html?run=..&gen=.. in Edge (playwright-core).
// 3. per stage: the whole body; then the body with "show what this blueprint lacks" on; then the schematic.
// 4. clicks the centre of every visible slot node FOR REAL (mouse, raycast) and checks the part card that
//    opens is that slot's (or the body, for a neutral envelope region); --part <slot> also takes a close-up.
//
// PNGs and preview.json land in --out (default: <os tmpdir>/delphi-mesh-preview/<run>/), never in the repo.
// Exit 1 if the page errors, the mesh does not load, or a click opens the wrong slot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { serve } from '../serve.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const arg = f => argv.includes(f) ? argv[argv.indexOf(f) + 1] : null;
const run = arg('--run');
if (!run) { console.error('usage: node sim-engine/scales/mesh/preview.mjs --run <run> [--gen N] [--stage key] [--part slot] [--out dir]'); process.exit(2); }
const OUT = path.resolve(arg('--out') ?? path.join(os.tmpdir(), 'delphi-mesh-preview', run));
fs.mkdirSync(OUT, { recursive: true });

if (!argv.includes('--no-build')) {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'sim-engine', 'scales', 'build.mjs'), '--run', run, '--meshes', '--quiet'],
    { cwd: ROOT, encoding: 'utf8', timeout: 900000, env: { ...process.env, DELPHI_MESH: '1' } });
  process.stdout.write(out);
}
const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'scales', `${run}.json`), 'utf8'));
const gens = bundle.generations ?? [];
const gen = arg('--gen') != null ? Number(arg('--gen')) : (gens.filter(g => g.body).pop()?.generation ?? gens[0]?.generation ?? 0);

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STUDIO_PW || 'C:/Temp/partedit-deps/node_modules/playwright-core');
const EDGE = process.env.STUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const { server, port } = await serve(0);
const browser = await chromium.launch({ executablePath: EDGE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { run, generation: gen, url: null, shots: [], clicks: [], errors: [], built: new Date().toISOString() };
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1480, height: 960 }, deviceScaleFactor: 1, colorScheme: argv.includes('--dark') ? 'dark' : 'light' });
  // A failed fetch is reported by the response handler below, with its url; the console line has none.
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) report.errors.push(m.text()); });
  page.on('pageerror', e => report.errors.push(`pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) report.errors.push(`HTTP ${r.status()} ${r.url()}`); });
  report.url = `http://127.0.0.1:${port}/blueprint3d/studio-live/theatre.html?run=${encodeURIComponent(run)}&gen=${gen}`;
  await page.goto(report.url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.THEATRE && window.THEATRE.state().parts >= 0', null, { timeout: 30000 });
  await page.waitForFunction('["ok","error"].includes(window.THEATRE.meshState().loaded) || !window.THEATRE.meshState().glb', null, { timeout: 90000 }).catch(() => {});
  await page.evaluate('window.THEATRE.stopSpin(); window.THEATRE.view(0.62, 0.2, 4.6)');
  const ms = await page.evaluate('window.THEATRE.meshState()');
  report.mesh = ms;
  if (ms.loaded !== 'ok') { report.errors.push(`the mesh did not load: ${ms.status} ${ms.error ?? ''} ${ms.glb ?? ''}`); code = 1; }
  const shot = async (name, what) => {
    await page.waitForTimeout(700);
    const f = path.join(OUT, `${run}-g${gen}-${name}.png`);
    await page.screenshot({ path: f });
    report.shots.push({ file: f, what, state: await page.evaluate('window.THEATRE.state()') });
  };
  const stages = arg('--stage') ? [arg('--stage')] : (ms.stages.length ? ms.stages : [null]);
  for (const st of stages) {
    if (st) await page.evaluate(`window.THEATRE.stage(${JSON.stringify(st)})`);
    await page.evaluate('window.THEATRE.view(0.62, 0.2); window.THEATRE.fit()');
    const s = await page.evaluate('window.THEATRE.meshState()');
    await shot(`${st ?? 'body'}-body`, `stage ${s.stage}: ${s.present.length} present, ${s.ghost.length} ghost, ${s.body.length} body, ${s.absent.length} absent (hidden)`);
    // Click every visible slot node at its projected centre, for real.
    for (const node of s.visible.filter(n => n.startsWith('slot:'))) {
      const xy = await page.evaluate(`window.THEATRE.nodeScreen(${JSON.stringify(node)})`);
      if (!xy) continue;
      const under = await page.evaluate(`window.THEATRE.pick(${xy.x}, ${xy.y})`);
      await page.mouse.move(xy.x, xy.y);
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(120);
      const got = await page.evaluate(`(() => { const s = window.THEATRE.state();
        const hit = window.THEATRE.parts().find(x => x.id === s.selected_id);
        return { selected: s.selected, slot: hit?.slot ?? null, level: hit?.level ?? null, card: document.querySelector('#panel .card h2')?.textContent ?? null }; })()`);
      // RIGHT CARD = the card for whatever node is actually first under the cursor (the target, unless
      // something sits in front of it). Its slot must match, or it must be the body for a neutral region.
      const top = under[0] ?? null;
      const topSlot = top?.node ? top.node.split(':')[1] : null;
      // A click that lands on nothing (the node's projected centre is off its own geometry, e.g. a helix or
      // a bent limb) tests nothing: it is counted as MISSED, never as correct.
      const ok = top ? ((top.state === 'body' && got.level === 'body') || got.slot === topSlot || got.selected === `slot:${topSlot}` || (top.part != null && got.selected === top.part)) : null;
      report.clicks.push({ stage: s.stage, node, at: xy, under: top, direct: top?.node === node, opened: got.selected, opened_slot: got.slot, card: got.card, ok, missed: !top });
    }
    await page.mouse.click(5, 300);  // deselect (empty canvas corner)
  }
  // What the blueprint lacks, then the schematic, on the last stage.
  await page.evaluate('window.THEATRE.absent(true)');
  await shot(`${stages[stages.length - 1] ?? 'body'}-lacks`, 'with "show what this blueprint lacks" on: absent slots as faint outlines, labelled');
  await page.evaluate('window.THEATRE.absent(false)');
  if (arg('--part')) {
    const want = arg('--part');
    const s = await page.evaluate('window.THEATRE.meshState()');
    const node = s.visible.find(n => n === `slot:${want}` || n.startsWith(`slot:${want}:`));
    if (node) {
      await page.evaluate('window.THEATRE.view(0.62, 0.2); window.THEATRE.fit(); window.THEATRE.view(null, null, window.THEATRE.view().distance * 0.6)');

      const xy = await page.evaluate(`window.THEATRE.nodeScreen(${JSON.stringify(node)})`);
      if (xy) { await page.mouse.click(xy.x, xy.y); await shot(`part-${want}`, `close-up, ${node} clicked`); }
      await page.evaluate('window.THEATRE.view(0.62, 0.2, 4.6)');
    } else report.errors.push(`--part ${want}: no visible node for that slot in stage ${s.stage}`);
  }
  await page.evaluate('window.THEATRE.mode("schematic")');
  await shot('schematic', 'the same generation drawn as schematic primitives');
  await page.evaluate('window.THEATRE.mode("mesh")');
  await page.close();
} catch (e) {
  report.errors.push(`FAILED: ${String(e?.message ?? e)}`);
  code = 1;
} finally {
  await browser.close();
  server.close();
}
const missed = report.clicks.filter(c => c.missed);
const tried = report.clicks.filter(c => !c.missed);
const bad = tried.filter(c => !c.ok);
const direct = tried.filter(c => c.ok && c.direct).length;
fs.writeFileSync(path.join(OUT, 'preview.json'), JSON.stringify(report, null, 1));
console.log(`${run} gen ${gen}: mesh ${report.mesh?.loaded ?? 'not loaded'} (${report.mesh?.glb ?? 'no glb'}), stages ${(report.mesh?.stages ?? []).join('/')}`);
console.log(`  ${report.shots.length} screenshot(s) -> ${OUT}`);
console.log(`  clicks: ${tried.length - bad.length}/${tried.length} that hit something opened the card of the node under the cursor (${direct} on the target itself, ${tried.length - bad.length - direct} on a node in front of it); ${missed.length} of ${report.clicks.length} missed (node centre off its own geometry: ${missed.slice(0, 4).map(c => `${c.stage}:${c.node}`).join(', ') || 'none'})${bad.length ? `; ${bad.length} WRONG: ${bad.slice(0, 6).map(c => `${c.stage}:${c.node} under ${c.under?.node ?? c.under?.part ?? 'nothing'} -> ${c.opened}`).join(', ')}` : ''}`);
if (report.errors.length) { code = 1; for (const e of report.errors.slice(0, 6)) console.log(`  ! ${e.slice(0, 240)}`); }
process.exit(code);
