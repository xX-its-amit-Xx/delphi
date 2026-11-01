// node dashboard/test-studio-e2e.mjs [--only=1,3] [--live] [--watch[=minutes]] [--break=<path substring>] [--headed]
//
// End-to-end browser tests for the Design Studio's Perturb mode (blueprint3d/perturb.html + perturb.js, the engine
// bundle in blueprint3d/engine/, partedit.js, lean-client.js + /api/lean/, spec-box.js). Drives the installed Edge
// through playwright-core with SwiftShader WebGL. Serves dashboard/public from a local node http server (no files
// written); --live targets https://delphi-mission-control.ashenoy000.workers.dev instead.
//
// Flows (each a named test; a failure saves a screenshot to C:/Temp/studio-e2e/ and the run exits 1):
//   1 load        every organism in perturb.html's model menu loads with zero console errors, page errors, failed
//                 requests or HTTP >= 400 (and explode.html?mode=perturb too, once its hook is applied)
//   2 edit        click the pectoral fin on the canvas (part list fallback), span x1.5 with a reason, the mesh area
//                 changes (partedit.measurePart in page context), the edit is listed, undo restores the mesh
//   3 scenarios   every scenario for zebrafish (adult) and flying fish: every metric has a kind badge; null values and
//                 validity.inRange === false render grey, never red
//   4 timecourse  one point per stage; stages with a law newly violated carry a red marker, the others do not
//   5 lean        an edit that breaks a law (found with sim-engine/tools: flying-fish standard_length_m x10): the part
//                 glows red, the violation names the law id and the law-set version; an out-of-scope law is grey
//   6 optimiser   flat objective -> "no improvement"; impossible spec -> "no design meets the spec"
//   7 spec box    (if spec-box.js exists) a criteria sentence -> chips; unparsed text highlighted
//   8 mobile      390 px viewport: no horizontal scroll
//
// Watch mode re-runs on any mtime change under blueprint3d/ (perturb*, partedit.js, lean-client.js, spec-box.js,
// explode.html, engine/**) or api/lean/**, appending to C:/Temp/studio-e2e/log.txt and printing NEWFAIL / FIXED lines.
// Dependencies outside the repo: playwright-core (PW_CORE, default C:/Temp/partedit-deps/node_modules/playwright-core),
// Edge (EDGE_PATH). --break=<substr> makes the local server 404 every path containing <substr> (used to make the
// suite fail once on purpose, e.g. --break=flying-fish-dev.glb).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, 'public');
const OUT = process.env.STUDIO_E2E_OUT || 'C:/Temp/studio-e2e';
const PW = process.env.PW_CORE || 'C:/Temp/partedit-deps/node_modules/playwright-core';
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const LIVE = 'https://delphi-mission-control.ashenoy000.workers.dev';
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(path.join(PW, 'package.json'))('playwright-core');

const arg = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a == null ? null : a.includes('=') ? a.split('=').slice(1).join('=') : true; };
const ONLY = arg('only') ? String(arg('only')).split(',').map(Number) : null;
const BREAK = arg('break') || null;
const LOG = path.join(OUT, 'log.txt');
const log = s => { const line = `[${new Date().toISOString()}] ${s}`; console.log(line); fs.appendFileSync(LOG, line + '\n'); };

// ------------------------------------------------------------------ static server
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain', '.woff2': 'font/woff2' };
function serve() {
  const srv = http.createServer((q, r) => {
    let p; try { p = decodeURIComponent(new URL(q.url, 'http://x').pathname); } catch { r.writeHead(400); return r.end(); }
    if (BREAK && p.includes(BREAK)) { r.writeHead(404); return r.end('broken on purpose (--break)'); }
    let f = path.normalize(path.join(PUBLIC, p)); if (!f.startsWith(PUBLIC)) { r.writeHead(403); return r.end(); }
    try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch { }
    fs.readFile(f, (e, buf) => { if (e) { r.writeHead(404); return r.end('not found'); } r.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(buf); });
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}

// ------------------------------------------------------------------ harness
class Fail extends Error { constructor(msg, file) { super(msg); this.file = file || null; } }
const must = (cond, msg, file) => { if (!cond) throw new Fail(msg, file); };
const BP = 'dashboard/public/blueprint3d/';

async function newPage(browser, base, { width = 1400, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}${m.location()?.url ? ' @ ' + m.location().url + ':' + m.location().lineNumber : ''}`); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}${e.stack ? ' | ' + e.stack.split('\n').slice(1, 3).join(' ').trim() : ''}`));
  page.on('requestfailed', r => { const t = r.failure()?.errorText || ''; if (/ERR_ABORTED/.test(t) && /\.glb$|fonts\./.test(r.url())) return; errors.push(`request failed: ${r.url()} (${t})`); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('dialog', d => d.dismiss().catch(() => { }));
  page.errors = errors; page.ctx = ctx; page.base = base;
  return page;
}
const harness = (base, model) => `${base}/blueprint3d/perturb.html?model=${encodeURIComponent(model)}`;

// wait until the panel booted (doc built) and the compute chain has gone quiet
async function settle(page, { timeout = 90000, quiet = 1200 } = {}) {
  await page.waitForFunction(() => { const S = window.__pt && window.__pt.api && window.__pt.api.state; return !!(S && S.doc && (S.now || !S.engine || !S.scenarioKey)); }, null, { timeout, polling: 250 })
    .catch(async () => { const eng = await page.evaluate(() => document.querySelector('#ptEng')?.innerText || document.querySelector('#panel')?.innerText?.slice(0, 300) || '(no panel)').catch(() => '?'); throw new Fail(`perturb panel never finished booting within ${timeout / 1000}s; panel says: ${eng.replace(/\s+/g, ' ').slice(0, 300)}`, BP + 'perturb.js'); });
  const t0 = Date.now(); let last = null, since = Date.now();
  while (Date.now() - t0 < timeout) {
    const snap = await page.evaluate(() => { const S = window.__pt.api.state; const q = id => document.getElementById(id)?.innerHTML || ''; return S.runSeq + '|' + (S.opt && S.opt.running ? 'R' : '') + '|' + q('ptRes').length + '|' + q('ptLaw').length + '|' + q('ptTc').length + '|' + /running…/.test(q('ptRes')); });
    if (snap !== last) { last = snap; since = Date.now(); } else if (Date.now() - since > quiet && !snap.endsWith('true') && !snap.includes('|R|')) return;
    await page.waitForTimeout(200);
  }
  throw new Fail('perturb panel never went quiet (compute kept re-running)', BP + 'perturb.js');
}
async function shot(page, name, sel) {
  const file = path.join(OUT, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  try { if (sel) await page.evaluate(s => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel); await page.screenshot({ path: file }); return file; } catch (e) { return `(screenshot failed: ${e.message})`; }
}
const noErrors = (page, where, file) => must(page.errors.length === 0, `${where}: ${page.errors.length} error(s):\n      ` + [...new Set(page.errors)].slice(0, 12).join('\n      '), file || guessFile(page.errors));
function guessFile(errs) {
  const s = errs.join(' ');
  const m = /blueprint3d\/([\w./-]+\.(?:m?js|html|json|glb))/.exec(s); if (m) return BP + m[1];
  const a = /\/api\/lean\/([\w./-]+)/.exec(s); if (a) return 'dashboard/public/api/lean/' + a[1];
  return BP + 'perturb.js';
}

// in-page helpers
const reddish = `(el) => { const rgb = s => { const m = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/.exec(s || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] } : null; };
  const red = c => c && c.a > 0.05 && c.r > 120 && c.r > c.g + 50 && c.r > c.b + 50;
  const cs = getComputedStyle(el); const hits = [];
  for (const k of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor']) { const c = rgb(cs[k]); if (red(c) && !(k.startsWith('border') && parseFloat(cs[k.replace('Color', 'Width')]) === 0)) hits.push(k + '=' + cs[k]); }
  return hits; }`;

// ------------------------------------------------------------------ flows
const TESTS = [];
const test = (n, name, fn) => TESTS.push({ n, name, fn });

test(1, 'load: every organism in the menu, zero errors', async (browser, base) => {
  const probe = await newPage(browser, base);
  await probe.goto(harness(base, 'flying-fish-dev'), { waitUntil: 'domcontentloaded' });
  const models = await probe.$$eval('#modelSel option', os => os.map(o => ({ value: o.value, label: o.textContent.trim() })));
  await probe.ctx.close();
  must(models.length > 0, 'perturb.html has no #modelSel options', BP + 'perturb.html');
  const bad = [];
  for (const m of models) {
    const page = await newPage(browser, base);
    try {
      await page.goto(harness(base, m.value), { waitUntil: 'load', timeout: 60000 });
      await settle(page);
      const st = await page.evaluate(() => ({ objs: +document.querySelector('#stage').dataset.objs || 0, eng: window.__pt.api.state.engine ? (window.__pt.api.state.engine.real ? 'real' : 'mock') : 'none', fail: document.querySelector('#ptEng .fail')?.innerText || null }));
      if (!st.objs) page.errors.push('no meshes loaded (#stage data-objs is 0)');
      if (st.fail) page.errors.push('panel shows: ' + st.fail);
      if (st.eng !== 'real') page.errors.push(`engine is ${st.eng}, not the real engine/ bundle`);
      await page.waitForTimeout(500);
      if (page.errors.length) bad.push({ m, errs: [...new Set(page.errors)], shot: await shot(page, `flow1-${m.value}`) });
    } catch (e) { bad.push({ m, errs: [e.message, ...page.errors], shot: await shot(page, `flow1-${m.value}`) }); }
    await page.ctx.close();
  }
  // explode.html: only once the Perturb hook (PERTURB-HOOK.md) is applied
  const ex = fs.existsSync(path.join(PUBLIC, 'blueprint3d/explode.html')) ? fs.readFileSync(path.join(PUBLIC, 'blueprint3d/explode.html'), 'utf8') : '';
  let exNote = 'explode.html: Perturb hook not applied yet (skipped)';
  if (/value="perturb"/.test(ex)) {
    const page = await newPage(browser, base);
    try {
      await page.goto(`${base}/blueprint3d/explode.html?mode=perturb`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('#pt', { timeout: 60000 });
      await page.waitForTimeout(4000);
      exNote = 'explode.html?mode=perturb loaded';
      if (page.errors.length) bad.push({ m: { value: 'explode.html?mode=perturb' }, errs: [...new Set(page.errors)], shot: await shot(page, 'flow1-explode') });
    } catch (e) { bad.push({ m: { value: 'explode.html?mode=perturb' }, errs: [e.message, ...page.errors], shot: await shot(page, 'flow1-explode') }); }
    await page.ctx.close();
  }
  if (bad.length) { const e = new Fail(bad.map(b => `${b.m.value}: ${b.errs.slice(0, 8).join(' || ')}`).join('\n    '), guessFile(bad.flatMap(b => b.errs))); e.shot = bad.map(b => b.shot).join(', '); throw e; }
  return `${models.length} organisms (${models.map(m => m.value).join(', ')}) clean; ${exNote}`;
});

// select a part by hovering the canvas until the harness tooltip names it, then clicking there
async function clickPart(page, want) {
  const box = await page.$eval('#c', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  for (const [nx, ny] of [[28, 16], [44, 24]]) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const x = box.x + box.w * i / nx, y = box.y + box.h * j / ny;
    await page.mouse.move(x, y);
    const tip = await page.$eval('#tip', t => t.style.display === 'block' ? t.textContent : '');
    if (want.test(tip)) { await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200); const sel = await page.$eval('#stage', s => s.dataset.sel || ''); if (sel) return { sel, how: `canvas click at (${Math.round(x)},${Math.round(y)}) on "${tip}"` }; }
  }
  return null;
}
async function measure(page, part) {
  return page.evaluate(async part => {
    const S = window.__pt.api.state; const pe = await import(new URL('partedit.js', location.href).href);
    const o = S.piece || window.__pt.api.state.piece; let root = o.mesh; while (root.parent && root.parent.type !== 'Scene') root = root.parent;
    const key = new URLSearchParams(location.search).get('model') || 'flying-fish-dev';
    const mf = await fetch(key === 'flying-fish' ? 'model/manifest.json' : `model/${key}-manifest.json`).then(r => r.json());
    const m = pe.measurePart(root, part, mf); const f = (m.fins || []).find(x => x.part === part) || (m.fins || [])[0] || {};
    return { area: m.surface_area_m2 ?? m.surface_area_units2, span: f.length_m ?? null, raw: { ...m, bbox: undefined } };
  }, part);
}
async function applyEdit(page, labelRe, { op, value, why }) {
  const rows = await page.$$eval('#ptSel .prow', rs => rs.map(r => ({ k: r.dataset.k, label: r.querySelector('label')?.textContent.replace(/\s+/g, ' ').trim() || '', ops: [...r.querySelectorAll('select[data-op] option')].map(o => o.value) })));
  const row = rows.find(r => labelRe.test(r.label));
  must(row, `no editable parameter matching ${labelRe} in the selection panel; offered: ${rows.map(r => r.label).join(' | ') || '(none)'}`, BP + 'perturb.js');
  if (op) { must(row.ops.includes(op), `parameter "${row.label}" offers ops ${row.ops.join('/')}, not ${op}`, BP + 'perturb.js'); await page.selectOption(`#ptSel select[data-op="${row.k}"]`, op); }
  await page.fill(`#ptSel input[data-num="${row.k}"]`, String(value));
  await page.fill(`#ptSel [data-why="${row.k}"]`, why);
  await page.click(`#ptSel [data-apply="${row.k}"]`);
  return row;
}

test(2, 'edit: select the fin, span x1.5 with a reason, mesh changes, listed, undo restores', async (browser, base) => {
  const page = await newPage(browser, base);
  try {
    await page.goto(harness(base, 'flying-fish-dev'), { waitUntil: 'load' }); await settle(page);
    let how = (await clickPart(page, /pectoral fin(?! ray)/i));
    let note = '';
    if (!how || !/^pectoral_fin_[LR]$/.test(how.sel)) { note = ` (canvas pick ${how ? 'hit ' + how.sel : 'found no fin'}; used the part API)`; await page.evaluate(() => window.__pt.selectByName('pectoral_fin_L')); how = { sel: 'pectoral_fin_L', how: 'window.__pt.selectByName' }; }
    await settle(page);
    const part = how.sel;
    const head = await page.$eval('#ptSel', e => e.innerText);
    must(/pectoral fin/i.test(head), `selection panel does not name the pectoral fin after selecting ${part}: "${head.slice(0, 160)}"`, BP + 'perturb.js');
    const a0 = await measure(page, part);
    must(a0.area > 0, `partedit.measurePart(${part}) gave no area: ${JSON.stringify(a0.raw)}`, BP + 'partedit.js');
    const nBefore = await page.$$eval('#ptSel .edit', e => e.length);
    const row = await applyEdit(page, /^span\b/i, { op: 'scale', value: 1.5, why: 'e2e: longer fin span' });
    await settle(page);
    const msg = await page.$eval('#ptSelMsg', e => e.innerText).catch(() => '');
    must(!msg.trim(), `the edit was refused: ${msg}`, BP + 'perturb.js');
    const a1 = await measure(page, part);
    const edits = await page.$$eval('#ptSel .edit', es => es.map(e => e.innerText.replace(/\s+/g, ' ')));
    must(edits.length === nBefore + 1 && edits.some(t => /span/.test(t) && /1\.5/.test(t) && /longer fin span/.test(t)), `edit list does not show "span × 1.5 — e2e: longer fin span"; it shows: ${JSON.stringify(edits)}`, BP + 'perturb.js');
    must(a0.span > 0, `partedit.measurePart(${part}) gave no fin span (fins[].length_m): ${JSON.stringify(a0.raw).slice(0, 300)}`, BP + 'partedit.js');
    const ratio = a1.span / a0.span, aRatio = a1.area / a0.area;
    must(Math.abs(ratio - 1.5) < 0.08, `fin span did not scale by 1.5 (span ${a0.span.toPrecision(4)} m -> ${a1.span.toPrecision(4)} m, ratio ${ratio.toFixed(3)}; area ratio ${aRatio.toFixed(3)})`, BP + 'partedit.js');
    await page.click('#ptUndo'); await settle(page);
    const a2 = await measure(page, part);
    const after = await page.$$eval('#ptSel .edit', e => e.length);
    must(Math.abs(a2.area - a0.area) <= 1e-6 * a0.area && Math.abs(a2.span - a0.span) <= 1e-6 * a0.span, `undo did not restore the mesh: span ${a0.span} -> ${a1.span} -> after undo ${a2.span} m; area ${a0.area} -> ${a1.area} -> ${a2.area} m2`, BP + 'perturb.js');
    must(after === nBefore, `undo left ${after} edit(s) in the list (expected ${nBefore})`, BP + 'perturb.js');
    noErrors(page, 'edit flow');
    return `${how.how}${note}; "${row.label}" scale 1.5 on ${part}: span ×${ratio.toFixed(3)} (area ×${aRatio.toFixed(3)}), listed, undo restored`;
  } catch (e) { e.shot = await shot(page, 'flow2', '#ptSel'); throw e; } finally { await page.ctx.close(); }
});

test(3, 'scenarios: every metric badged; null and out-of-range grey, not red', async (browser, base) => {
  const out = [], bad = [];
  for (const model of ['zebrafish-dev', 'flying-fish-dev']) {
    const page = await newPage(browser, base);
    try {
      await page.goto(harness(base, model), { waitUntil: 'load' }); await settle(page);
      const keys = await page.$$eval('#ptScnSel option', os => os.map(o => o.value));
      must(keys.length > 0, `${model}: no scenarios in #ptScnSel`, BP + 'perturb.js');
      let nNull = 0, nOut = 0, nMetrics = 0, notRun = [];
      for (const k of keys) {
        await page.selectOption('#ptScnSel', k); await settle(page);
        const r = await page.evaluate(new Function('k', `const reddish = ${reddish};
          const S = window.__pt.api.state; const R = S.now && S.now.res; if (S.scenarioKey !== k) return { err: 'scenario did not switch to ' + k };
          const tab = document.querySelector('#ptRes table'); const rows = tab ? [...tab.querySelectorAll('tr')].slice(1) : [];
          const out = { metrics: (R && R.metrics || []).length, rows: rows.length, notRun: R && R.notRun ? (R.error || 'not run') : null, problems: [], nNull: 0, nOut: 0 };
          if (out.metrics !== out.rows) out.problems.push('metrics ' + out.metrics + ' but table rows ' + out.rows);
          rows.forEach((tr, i) => { const name = tr.cells[0]?.innerText.split('\\n')[0];
            if (!tr.cells[2] || !tr.cells[2].querySelector('.badge') || !tr.cells[2].querySelector('.badge').textContent.trim()) out.problems.push('metric "' + name + '" has no kind badge');
            const m = R.metrics[i]; const nul = m.value == null || !isFinite(m.value);
            if (nul) { out.nNull++; const h = [...reddish(tr), ...reddish(tr.cells[1])]; if (h.length) out.problems.push('null metric "' + name + '" renders red: ' + h.join(', '));
              if (!/no value/.test(tr.cells[1].innerText)) out.problems.push('null metric "' + name + '" shows "' + tr.cells[1].innerText + '" not "no value"'); } });
          if (R && R.validity && R.validity.inRange === false) { out.nOut++;
            const wrap = document.querySelector('#ptRes .res'); const cs = wrap && getComputedStyle(wrap);
            if (!wrap || !wrap.classList.contains('out') || !(parseFloat(cs.opacity) < 1 || /grayscale/.test(cs.filter))) out.problems.push('validity.inRange=false but the result table is not greyed (class/opacity/filter)');
            const note = document.querySelector('#ptRes .outnote'); if (!note) out.problems.push('validity.inRange=false but no out-of-range note'); else if (reddish(note).length) out.problems.push('out-of-range note renders red: ' + reddish(note).join(', '));
            for (const tr of rows) for (const td of tr.cells) if (reddish(td).length && !(R.survives === false)) out.problems.push('out-of-range cell renders red: ' + td.innerText.slice(0, 40));
            if (document.querySelector('#ptRes .fail') && R.survives !== false && !R.error) out.problems.push('out-of-range result shows a red .fail box'); }
          return out;`), k);
        if (r.err) { bad.push(`${model}/${k}: ${r.err}`); continue; }
        nMetrics += r.metrics; nNull += r.nNull; nOut += r.nOut; if (r.notRun) notRun.push(`${k} (${r.notRun.slice(0, 80)})`);
        for (const p of r.problems) bad.push(`${model}/${k}: ${p}`);
      }
      noErrors(page, `${model} scenarios`);
      out.push(`${model}: ${keys.length} scenarios, ${nMetrics} metrics, ${nNull} null, ${nOut} out of range${notRun.length ? '; not run: ' + notRun.join(', ') : ''}`);
      if (bad.length) { const e = new Fail(bad.slice(0, 15).join('\n    '), BP + 'perturb.js'); e.shot = await shot(page, 'flow3-' + model, '#ptRes'); throw e; }
    } catch (e) { if (!e.shot) e.shot = await shot(page, 'flow3-' + model, '#ptRes'); await page.ctx.close(); throw e; }
    await page.ctx.close();
  }
  return out.join(' | ');
});

// the edit known to break accepted laws, found with sim-engine/tools/studio.mjs organismEdit (see findLawBreaker)
const BREAKER = { model: 'flying-fish-dev', organism: 'flying-fish', param: /^standard length\b|^standard_length_m\b/i, op: 'scale', value: 10, why: 'e2e: ten times longer body (breaks size-scaling laws)' };
async function findLawBreaker() {
  try {
    const T = await import(new URL('file:///' + path.join(here, '..', 'sim-engine', 'tools', 'studio.mjs').replace(/\\/g, '/')).href);
    const r = await T.organismEdit({ organism: BREAKER.organism, edit: { target: { level: 'body' }, param: 'standard_length_m', op: BREAKER.op, value: BREAKER.value, author: 'human', reason: 'e2e probe' } });
    const R = r.result || r; return { ids: (R.new_binding_violations || R.violations || []).map(v => v.law_id), lawset: R.lawset_version };
  } catch (e) { return { ids: [], err: e.message }; }
}

test(4, 'timecourse: one point per stage; violated stages red', async (browser, base) => {
  const page = await newPage(browser, base);
  try {
    await page.goto(harness(base, BREAKER.model), { waitUntil: 'load' }); await settle(page);
    const check = new Function(`const S = window.__pt.api.state; const svg = document.querySelector('#ptChart svg'); if (!svg) return { err: 'no chart svg in #ptTc' };
      const pts = [...svg.querySelectorAll('circle[r="4.5"]')].map(c => +c.getAttribute('cx')).concat([...svg.querySelectorAll('text')].filter(t => t.textContent === '×').map(t => +t.getAttribute('x'))).sort((a, b) => a - b);
      const reds = [...svg.querySelectorAll('path')].filter(p => p.getAttribute('fill') === 'var(--bad)' && /^M/.test(p.getAttribute('d') || '')).map(p => +/^M([\\d.-]+)/.exec(p.getAttribute('d'))[1] + 5);
      const viol = S.tc.map(r => (r.judged && r.judged.rows || []).filter(x => x.verdict === 'violated' && x.severity === 'accepted' && !x.inherited).map(x => x.id));
      const table = document.querySelectorAll('#ptTable tr').length - 1;
      return { stages: S.stages.length, tc: S.tc.length, pts, reds, viol, table, labels: S.stages.map(s => s.label) };`);
    const verify = (r, tag) => {
      must(!r.err, `${tag}: ${r.err}`, BP + 'perturb.js');
      must(r.tc === r.stages, `${tag}: timecourse has ${r.tc} rows for ${r.stages} stages`, BP + 'perturb.js');
      must(r.pts.length === r.stages, `${tag}: chart draws ${r.pts.length} points for ${r.stages} stages (${r.labels.join('; ')})`, BP + 'perturb.js');
      must(r.table === r.stages, `${tag}: table view has ${r.table} rows for ${r.stages} stages`, BP + 'perturb.js');
      const want = r.viol.map((v, i) => v.length ? i : -1).filter(i => i >= 0);
      const got = r.reds.map(x => r.pts.findIndex(p => Math.abs(p - x) < 1.5));
      must(want.length === got.length && want.every(i => got.includes(i)), `${tag}: stages with a newly violated accepted law ${JSON.stringify(want)} (${want.map(i => r.viol[i].join('+')).join('; ')}) but red markers at stages ${JSON.stringify(got)}`, BP + 'perturb.js');
      return want;
    };
    const base0 = verify(await page.evaluate(check), 'unedited');
    await applyEdit(page, BREAKER.param, BREAKER); await settle(page);
    const r = await page.evaluate(check); const red = verify(r, 'after standard_length x10');
    must(red.length > 0, `after the law-breaking edit no stage is marked violated (laws per stage: ${JSON.stringify(r.viol)})`, BP + 'perturb.js');
    noErrors(page, 'timecourse');
    return `${r.stages} stages, ${r.pts.length} points; unedited red stages ${JSON.stringify(base0)}; after edit red at ${JSON.stringify(red)} (${[...new Set(red.flatMap(i => r.viol[i]))].join(', ')})`;
  } catch (e) { e.shot = await shot(page, 'flow4', '#ptTc'); throw e; } finally { await page.ctx.close(); }
});

test(5, 'lean: a law-breaking edit glows red, names law id + lawset version; out-of-scope law grey', async (browser, base) => {
  const cli = await findLawBreaker();
  must(cli.ids.length, `sim-engine organismEdit found no law broken by flying-fish standard_length_m x10 any more (${cli.err || 'no violations'}): the e2e breaker needs a new edit`, 'sim-engine/tools/studio.mjs');
  const current = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'api/lean/current.json'), 'utf8')).version;
  const page = await newPage(browser, base);
  try {
    await page.goto(harness(base, BREAKER.model), { waitUntil: 'load' }); await settle(page);
    // select a part first (gives the test a handle on the scene graph), then go back to the body crumb to edit
    await page.evaluate(() => window.__pt.selectByName('skin_L')); await settle(page);
    await page.click('#ptSel .crumbs button[data-lv="body"]'); await settle(page);
    await applyEdit(page, BREAKER.param, BREAKER); await settle(page); await page.waitForTimeout(600);
    const r = await page.evaluate(new Function(`const reddish = ${reddish}; const S = window.__pt.api.state;
      const head = document.querySelector('#ptLaw h4')?.textContent || '';
      const viols = [...document.querySelectorAll('#ptLaw .viol')].filter(v => !v.classList.contains('inherited') && !v.classList.contains('contested') && !v.classList.contains('candidate')).map(v => ({ text: v.innerText.replace(/\s+/g, ' '), red: reddish(v).length > 0, lid: v.querySelector('.lid')?.innerText || '' }));
      return { head, viols };`));
    // sample every mesh's emissive colour across the pulse; red = r dominates
    const glowing = await page.evaluate(() => new Promise(res => {
      const S = window.__pt.api.state; let scene = S.piece && S.piece.mesh; while (scene && scene.parent) scene = scene.parent;
      if (!scene) return res([]); const names = new Set(); let n = 0;
      const tick = () => { scene.traverse(m => { if (m.isMesh && m.material && m.material.emissive && m.material.emissiveIntensity > 0.05) { const c = m.material.emissive; if (c.r > 0.3 && c.r > c.g * 1.8 && c.r > c.b * 1.8) names.add(m.userData.obj || m.name); } }); if (++n < 6) setTimeout(tick, 120); else res([...names]); };
      tick();
    }));
    must(r.viols.length > 0, `no violation listed in #ptLaw after ${BREAKER.param} x${BREAKER.value} on ${BREAKER.organism}; the engine (sim-engine) says it breaks ${cli.ids.join(', ')}`, BP + 'perturb.js');
    const named = cli.ids.filter(id => r.viols.some(v => v.text.includes(id)));
    must(named.length > 0, `the violations list does not name any of the law ids the engine reports (${cli.ids.join(', ')}); it shows: ${r.viols.map(v => v.lid).join(' | ')}`, BP + 'perturb.js');
    must(r.viols.every(v => v.red), `a violation of an accepted law does not render red: ${r.viols.filter(v => !v.red).map(v => v.lid).join(', ')}`, BP + 'perturb.js');
    must(new RegExp('v' + current.replace(/\./g, '\\.')).test(r.head), `the law panel does not name law set v${current} (api/lean/current.json); header: "${r.head}"`, BP + 'perturb.js');
    must(glowing.length > 0, `no part glows red after the law-breaking edit (violations: ${r.viols.map(v => v.lid).join(', ')})`, BP + 'perturb.js');
    // out-of-scope: a flying-fish-calibrated law judged on zebrafish, or any row the scope rule excludes
    let scopeNote = null;
    for (const model of [BREAKER.model, 'zebrafish-dev']) {
      const p2 = model === BREAKER.model ? page : await newPage(browser, base);
      if (p2 !== page) { await p2.goto(harness(base, model), { waitUntil: 'load' }); await settle(p2); }
      const g = await p2.evaluate(new Function(`const reddish = ${reddish}; const gl = document.querySelector('#ptLaw .greylist'); if (!gl) return null;
        gl.open = true; const lines = [...gl.querySelectorAll('div')].filter(d => /out of scope/.test(d.innerText));
        return { n: lines.length, first: lines[0] ? lines[0].innerText : null, red: lines.some(d => reddish(d).length) || reddish(gl).length > 0, colour: lines[0] ? getComputedStyle(lines[0]).color : null };`));
      if (p2 !== page) await p2.ctx.close();
      if (g && g.n) { must(!g.red, `${model}: out-of-scope law renders red: ${g.first}`, BP + 'perturb.js'); scopeNote = `${model}: ${g.n} out-of-scope, grey (${g.colour}), e.g. "${g.first}"`; break; }
    }
    must(scopeNote, 'no out-of-scope law is shown (grey list) for flying fish or zebrafish: cannot confirm out-of-scope renders grey', BP + 'perturb.js');
    noErrors(page, 'lean flow');
    return `violations named: ${named.join(', ')} (red); header "${r.head.replace(/\s+/g, ' ').slice(0, 60)}"; glowing red: ${glowing.slice(0, 4).join(', ')}${glowing.length > 4 ? ' +' + (glowing.length - 4) : ''}; ${scopeNote}`;
  } catch (e) { e.shot = await shot(page, 'flow5', '#ptLaw'); throw e; } finally { await page.ctx.close().catch(() => { }); }
});

async function runOpt(page, { objective, n = 12 } = {}) {
  if (objective) await page.selectOption('#ptObj', objective);
  await page.fill('#ptN', String(n)); await page.fill('#ptSeed', '1');
  await page.click('#ptGo');
  await page.waitForFunction(() => { const O = window.__pt.api.state.opt; return O && !O.running && (O.trace.length || O.error); }, null, { timeout: 120000, polling: 300 });
  await page.waitForTimeout(300);
  return page.evaluate(() => { const O = window.__pt.api.state.opt; return { text: document.querySelector('#ptOptOut')?.innerText || '', err: O.error, vals: O.trace.map(c => c.value), rejected: O.rejected.length, best: O.best && O.best.value }; });
}

test(6, 'optimiser: flat objective -> "no improvement"; impossible spec -> "no design meets the spec"', async (browser, base) => {
  const page = await newPage(browser, base);
  try {
    await page.goto(harness(base, 'zebrafish-dev'), { waitUntil: 'load' }); await settle(page);
    // flat: vary the dorsal fin's size while optimising a metric of a scenario that never reads it (pressure / depth)
    await page.evaluate(() => window.__pt.selectByName('dorsal_fin')); await settle(page);
    await applyEdit(page, /^scale\b|^span\b|^area\b|^length\b/i, { op: 'scale', value: 1.1, why: 'e2e: flat-objective probe' }); await settle(page);
    const scen = await page.$$eval('#ptScnSel option', os => os.map(o => o.value));
    let flat = null, tried = [];
    for (const k of ['temperature', 'pressure', 'altitude', 'daynight', 'sleep'].filter(k => scen.includes(k))) {
      await page.selectOption('#ptScnSel', k); await settle(page);
      const objs = await page.$$eval('#ptObj option', os => os.map(o => o.value));
      for (const o of objs) { const r = await runOpt(page, { objective: o, n: 8 }); const fin = r.vals.filter(v => v != null && isFinite(v));
        tried.push(`${k}/${o}: ${fin.length ? (Math.max(...fin) - Math.min(...fin)).toExponential(1) : 'no values'}`);
        if (fin.length >= 4 && Math.max(...fin) - Math.min(...fin) <= 1e-12 * Math.max(1, Math.abs(fin[0]))) { flat = { k, o, r }; break; } }
      if (flat) break;
    }
    must(flat, `test setup: found no flat objective for a dorsal-fin edit on zebrafish (spread per objective: ${tried.join('; ')})`, BP + 'perturb.js');
    const problems = [];
    if (!/no improvement/i.test(flat.r.text)) problems.push(`flat objective (${flat.k}/${flat.o}, all ${flat.r.vals.length} evaluations = ${flat.r.vals[0]}) did not say "no improvement"; the optimiser panel says: "${flat.r.text.replace(/\s+/g, ' ').slice(0, 220)}"`);
    // impossible: the typed spec "glides at least 10 km", or an impossible bound if the spec box is absent
    let imp = null;
    if (await page.$('#ptSpec textarea')) {
      await page.fill('#ptSpec textarea', 'a zebrafish that glides at least 10000 m from 1 m height');
      await page.click('#ptSpec button:has-text("Read")'); await page.waitForTimeout(1500);
      const useBtn = page.locator('#ptSpec button.primary');
      if (await useBtn.isEnabled()) {
        await useBtn.click();
        await page.waitForFunction(() => { const O = window.__pt.api.state.opt; return O && O.trace && O.trace.length && !O.running; }, null, { timeout: 120000, polling: 300 }).catch(() => { });
        await page.waitForTimeout(400);
        imp = await page.evaluate(() => ({ text: document.querySelector('#ptOptOut')?.innerText || document.querySelector('#ptOpt')?.innerText || '', ran: !!(window.__pt.api.state.opt && window.__pt.api.state.opt.trace.length) }));
        if (!imp.ran) problems.push('the impossible spec ("glides at least 10000 m from 1 m height") did not start the optimiser');
      } else problems.push(`spec box would not accept "a zebrafish that glides at least 10000 m from 1 m height": ${(await page.$eval('#ptSpec', e => e.innerText)).replace(/\s+/g, ' ').slice(0, 200)}`);
    } else problems.push('no spec box mounted, so no impossible spec can be typed');
    if (imp && imp.ran && !/no design meets the spec/i.test(imp.text)) problems.push(`impossible spec (glide >= 10000 m) did not say "no design meets the spec"; the optimiser panel says: "${imp.text.replace(/\s+/g, ' ').slice(0, 220)}"`);
    if (problems.length) throw new Fail(problems.join('\n    '), BP + 'perturb.js');
    noErrors(page, 'optimiser');
    return `flat ${flat.k}/${flat.o} -> "no improvement"; impossible spec -> "no design meets the spec"`;
  } catch (e) { e.shot = await shot(page, 'flow6', '#ptOpt'); throw e; } finally { await page.ctx.close(); }
});

test(7, 'spec box: criteria sentence -> chips; unparsed text highlighted', async (browser, base) => {
  if (!fs.existsSync(path.join(PUBLIC, 'blueprint3d/spec-box.js')) && !arg('live')) return 'SKIP: spec-box.js does not exist';
  const page = await newPage(browser, base);
  try {
    await page.goto(harness(base, 'zebrafish-dev'), { waitUntil: 'load' }); await settle(page);
    const ta = await page.waitForSelector('#ptSpec textarea', { timeout: 15000 }).catch(() => null);
    must(ta, 'spec-box.js exists but no spec box textarea is mounted in #ptSpec', BP + 'spec-box.js');
    const junk = 'and it must sing opera on tuesdays';
    await page.fill('#ptSpec textarea', `a zebrafish that glides at least 30 m from 1 m height, survives 4 °C to 32 °C, ${junk}`);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#ptSpec .chip.crit')].map(c => c.innerText.replace(/\s+/g, ' ')), org: [...document.querySelectorAll('#ptSpec .chip.org')].map(c => c.innerText), marks: [...document.querySelectorAll('#ptSpec .unparsed mark')].map(m => ({ t: m.textContent, bg: getComputedStyle(m).backgroundColor })), text: document.querySelector('#ptSpec').innerText.slice(0, 400) }));
    must(r.chips.length >= 2, `expected >= 2 criterion chips (glide, temperature); got ${r.chips.length}: ${JSON.stringify(r.chips)}; box: ${r.text.replace(/\s+/g, ' ')}`, BP + 'spec-box.js');
    must(r.org.some(o => /zebrafish/.test(o)), `no organism chip for zebrafish: ${JSON.stringify(r.org)}`, BP + 'spec-box.js');
    must(r.marks.some(m => /opera/.test(m.t)), `the unparsed text "${junk}" is not highlighted; marks: ${JSON.stringify(r.marks)}`, BP + 'spec-box.js');
    must(r.marks.every(m => !/rgba\(0, 0, 0, 0\)|transparent/.test(m.bg)), `unparsed mark has no highlight background: ${JSON.stringify(r.marks)}`, BP + 'spec-box.js');
    noErrors(page, 'spec box');
    return `${r.chips.length} criterion chips (${r.chips.join(' ; ')}), organism ${r.org.join(',')}, highlighted: "${r.marks.map(m => m.t).join('" "')}"`;
  } catch (e) { e.shot = await shot(page, 'flow7', '#ptSpec'); throw e; } finally { await page.ctx.close(); }
});

test(8, 'mobile: 390 px viewport, no horizontal scroll', async (browser, base) => {
  const pages = [['perturb.html', harness(base, 'flying-fish-dev')]];
  const ex = fs.existsSync(path.join(PUBLIC, 'blueprint3d/explode.html')) ? fs.readFileSync(path.join(PUBLIC, 'blueprint3d/explode.html'), 'utf8') : '';
  if (/value="perturb"/.test(ex)) pages.push(['explode.html?mode=perturb', `${base}/blueprint3d/explode.html?mode=perturb`]);
  const res = [];
  for (const [name, url] of pages) {
    const page = await newPage(browser, base, { width: 390, height: 844 });
    try {
      await page.goto(url, { waitUntil: 'load' });
      if (name.startsWith('perturb')) { await settle(page); await page.evaluate(() => window.__pt.selectByName('pectoral_fin_L')); await settle(page); }
      else await page.waitForTimeout(5000);
      const r = await page.evaluate(() => { const d = document.documentElement; const vw = d.clientWidth; const wide = [];
        for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.width && b.right > vw + 1 && getComputedStyle(el).position !== 'fixed') { let p = el.parentElement, clipped = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'hidden' || o === 'scroll' || o === 'clip') { clipped = p.getBoundingClientRect().right <= vw + 1; if (clipped) break; } p = p.parentElement; } if (!clipped) wide.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + ' right=' + Math.round(b.right)); } }
        window.scrollTo(400, 0); const sx = window.scrollX; window.scrollTo(0, 0);
        return { sw: d.scrollWidth, bw: document.body.scrollWidth, vw, sx, wide: wide.slice(0, 8) }; });
      must(r.sw <= r.vw + 1 && r.sx === 0, `${name} at 390 px scrolls horizontally: scrollWidth ${r.sw} > ${r.vw} (window.scrollX after scrollTo(400) = ${r.sx}); overflowing: ${r.wide.join(', ')}`, BP + (name.startsWith('perturb') ? 'perturb.html' : 'explode.html'));
      if (r.wide.length) res.push(`${name}: no page scroll, but ${r.wide.length} element(s) overflow a clipped area`);
      else res.push(`${name}: scrollWidth ${r.sw} = ${r.vw}`);
      noErrors(page, `${name} at 390 px`);
    } catch (e) { e.shot = await shot(page, 'flow8'); await page.ctx.close(); throw e; }
    await page.ctx.close();
  }
  return res.join('; ') + (pages.length === 1 ? ' (explode.html hook not applied yet)' : '');
});

// ------------------------------------------------------------------ runner
async function runAll() {
  const srv = arg('live') ? null : await serve();
  const base = arg('live') ? LIVE : `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ executablePath: EDGE, headless: !arg('headed'), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  log(`run start: ${base}${BREAK ? ' (BREAK ' + BREAK + ')' : ''}`);
  for (const t of TESTS) {
    if (ONLY && !ONLY.includes(t.n)) continue;
    const t0 = Date.now();
    try { const note = await t.fn(browser, base); results.push({ n: t.n, name: t.name, ok: true, note, ms: Date.now() - t0 }); log(`PASS ${t.n} ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)}s): ${note}`); }
    catch (e) { results.push({ n: t.n, name: t.name, ok: false, error: e.message, file: e.file || null, shot: e.shot || null, ms: Date.now() - t0 }); log(`FAIL ${t.n} ${t.name}: ${e.message}\n    file: ${e.file || '?'}\n    screenshot: ${e.shot || '(none)'}${e instanceof Fail ? '' : '\n    ' + (e.stack || '').split('\n').slice(1, 4).join('\n    ')}`); }
  }
  await browser.close(); if (srv) srv.close();
  const nf = results.filter(r => !r.ok).length;
  log(`run end: ${results.length - nf}/${results.length} pass`);
  fs.writeFileSync(path.join(OUT, 'last.json'), JSON.stringify({ at: new Date().toISOString(), base, results }, null, 1));
  return results;
}

const WATCH = [/^blueprint3d[\\/](perturb[\w.-]*|partedit\.js|lean-client\.js|spec-box\.js|explode\.html|browser-check\.mjs|design\.js)$/, /^blueprint3d[\\/]engine[\\/]/, /^api[\\/]lean[\\/]/];
function fingerprint() {
  const out = []; const walk = d => { for (const e of fs.readdirSync(path.join(PUBLIC, d), { withFileTypes: true })) { const rel = path.join(d, e.name); if (e.isDirectory()) { if (/^(blueprint3d|api)$|blueprint3d[\\/]engine|api[\\/]lean/.test(rel)) walk(rel); } else if (WATCH.some(re => re.test(rel))) out.push(rel + ':' + fs.statSync(path.join(PUBLIC, rel)).mtimeMs); } };
  walk('blueprint3d'); walk('api'); return out.sort().join('\n');
}

if (arg('watch')) {
  const until = Date.now() + (Number(arg('watch')) > 0 ? Number(arg('watch')) : 120) * 60000;
  let prev = null, fp = null;
  while (Date.now() < until) {
    const now = fingerprint();
    if (now !== fp) {
      if (fp) { const a = new Set(fp.split('\n')), b = now.split('\n').filter(x => !a.has(x)).map(x => x.split(':')[0]); log(`change: ${b.join(', ') || '(file removed)'}`); await new Promise(r => setTimeout(r, 4000)); }
      fp = fingerprint();
      const res = await runAll().catch(e => { log('runner crashed: ' + e.stack); return null; });
      if (res) {
        for (const r of res) { const p = prev && prev.find(x => x.n === r.n);
          if (!r.ok && (!p || p.ok || p.error.split('\n')[0] !== r.error.split('\n')[0])) log(`NEWFAIL ${r.n} ${r.name} :: ${r.error.replace(/\n\s*/g, ' / ')} :: file ${r.file} :: screenshot ${r.shot}`);
          if (r.ok && p && !p.ok) log(`FIXED ${r.n} ${r.name}`); }
        prev = res;
      }
    }
    await new Promise(r => setTimeout(r, 15000));
  }
  log('watch end');
} else {
  const res = await runAll();
  console.log('\nsummary:\n' + res.map(r => `  ${r.ok ? 'PASS' : 'FAIL'} ${r.n} ${r.name}${r.ok ? '' : '\n       ' + r.error.split('\n')[0] + '\n       file: ' + r.file + '\n       screenshot: ' + r.shot}`).join('\n'));
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
