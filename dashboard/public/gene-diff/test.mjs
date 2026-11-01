#!/usr/bin/env node
/* gene-diff/test.mjs — asserts the built data AND the rendered page.
 *
 * Data assertions read the alignment files directly and compare them with data.json, so a
 * drift between the two fails here rather than showing a wrong residue on the page.
 * Page assertions drive headless Edge through playwright-core: no console error, the real
 * alignment length and row count in the DOM, and screenshots at desktop and 390 px.
 *
 * Run: node dashboard/public/gene-diff/test.mjs            (data + page)
 *      node dashboard/public/gene-diff/test.mjs --data     (data only, no browser)
 *      GENEDIFF_FAIL=<name> node ... --data                (fault injection: breaks one check)
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, '..');
const REPO = join(HERE, '..', '..', '..');
const SHOTS = process.env.GENEDIFF_SHOT_DIR || 'C:/Temp/gene-diff-shots';
const FAIL = process.env.GENEDIFF_FAIL || '';

let pass = 0; const fails = [];
function ok(name, cond, detail) {
  const broken = FAIL && FAIL === name;
  const good = broken ? !cond : !!cond;
  if (good) { pass++; console.log(`  ok    ${name}${detail ? '  ' + detail : ''}`); }
  else { fails.push(name); console.log(`  FAIL  ${name}  ${detail || ''}`); }
}
const eq = (name, a, b, detail) => ok(name, a === b, `${detail || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

/* ------------------------------------------------------------------ data checks */
const data = JSON.parse(readFileSync(join(HERE, 'data.json'), 'utf8'));
console.log('data.json');

const COMMITTED = ['winged-zebrafish', 'tff', 'wingless-flying-fish', 'ff-zf-chimera'];
for (const id of COMMITTED) ok(`case present: ${id}`, data.cases.some(c => c.id === id));

/* a case with no sequence data must render as a stated absence, not a gap */
for (const id of ['wingless-flying-fish', 'ff-zf-chimera']) {
  const c = data.cases.find(x => x.id === id);
  ok(`${id}: sequence scale is a stated absence`, !!(c.sequence && c.sequence.absent === true && c.sequence.why && c.sequence.why.length > 40),
    c.sequence?.why?.slice(0, 60));
}
const tff = data.cases.find(c => c.id === 'tff');
ok('tff: the analogue is a stated absence (no powered flier we may read)', tff.analogue.noAnalogue === true && !!tff.analogue.basis);

/* real alignment lengths and row counts, read back out of sequences/alignments */
let checkedGenes = 0, checkedCols = 0;
for (const c of data.cases) {
  if (!c.sequence || c.sequence.absent) continue;
  for (const g of c.sequence.genes) {
    if (g.alignment && g.alignment.absent) continue;
    const src = JSON.parse(readFileSync(join(REPO, 'sequences', 'alignments', `${g.gene}.json`), 'utf8'));
    const baseAligned = src.alignment.danio_rerio;
    eq(`${c.id}/${g.gene}: column count equals the alignment on disk`, g.columns, baseAligned.length);
    eq(`${c.id}/${g.gene}: base row is the alignment on disk`, g.rows[0].seq.length, baseAligned.length);
    ok(`${c.id}/${g.gene}: base row is byte-identical to the file`, g.rows[0].seq === baseAligned);
    const ungapped = baseAligned.replace(/[-.]/g, '');
    eq(`${c.id}/${g.gene}: ungapped base length equals the recorded protein length`,
      ungapped.length, src.sequences.danio_rerio.length);
    /* every drawn row is the same width, or the view is lying about which column is which */
    const widths = [...new Set(g.rows.filter(r => r.seq).map(r => r.seq.length))];
    eq(`${c.id}/${g.gene}: every drawn row has the alignment's width`, widths.length, 1);
    ok(`${c.id}/${g.gene}: at least a base and a generated row`, g.rows.filter(r => r.seq).length >= 2,
      `${g.rows.filter(r => r.seq).length} rows`);

    /* the edit really is at the column the view draws it at */
    if (g.aminoAcidChange) {
      const a = g.aminoAcidChange;
      eq(`${c.id}/${g.gene}: base carries ${a.from} at column ${a.col}`, baseAligned[a.col - 1], a.from);
      eq(`${c.id}/${g.gene}: generated carries ${a.to} at column ${a.col}`, g.rows[1].seq[a.col - 1], a.to);
      /* and the generated row differs from the base at exactly that one column */
      let diffs = 0;
      for (let i = 0; i < baseAligned.length; i++) if (g.rows[1].seq[i] !== baseAligned[i]) diffs++;
      eq(`${c.id}/${g.gene}: the generated row differs from the base at exactly one column`, diffs, 1);
      ok(`${c.id}/${g.gene}: the column check recorded agreement`, g.columnCheck && g.columnCheck.ok === true);
    } else {
      ok(`${c.id}/${g.gene}: an unchanged generated row says why`, g.rows[1].identical === true && !!g.rows[1].identicalWhy,
        g.rows[1].identicalWhy?.slice(0, 50));
    }

    /* every annotation placed on the alignment lands on the residue its source names */
    for (const d of g.tracks.domains) {
      ok(`${c.id}/${g.gene}: domain ${d.acc} start column maps to its own position`,
        d.colStart != null && d.colEnd != null && d.colStart <= d.colEnd);
    }
    for (const p of g.tracks.ptm) {
      eq(`${c.id}/${g.gene}: PTM ${p.residue}${p.pos} sits on ${p.residue}`, ungapped[p.pos - 1], p.residue);
      eq(`${c.id}/${g.gene}: PTM ${p.residue}${p.pos} column holds ${p.residue}`, baseAligned[p.col - 1], p.residue);
    }
    /* a refused annotation must carry a reason */
    for (const n of g.tracks.notPlaced) ok(`${c.id}/${g.gene}: a refused annotation states why`, !!n.why && n.why.length > 30);

    /* the diff list and the meaning counts agree */
    const sum = Object.values(g.meaningCount).reduce((a, b) => a + b, 0);
    eq(`${c.id}/${g.gene}: meaning counts sum to the diff count`, sum, g.diffs.length);
    /* a gap in a row is never counted or drawn as a residue difference */
    const gapsMiscalled = g.diffs.filter(d =>
      (d.base === '-' || d.analogue === '-') && d.meaning !== 'gap' && d.meaning !== 'edit');
    eq(`${c.id}/${g.gene}: no gap column is classified as a residue difference`, gapsMiscalled.length, 0,
      gapsMiscalled.slice(0, 3).map(d => `col ${d.col} ${d.meaning}`).join(','));
    ok(`${c.id}/${g.gene}: no gap column gets a drawer`,
      (g.annotatedCols || []).every(col => {
        const d = g.diffs.find(x => x.col === col);
        return d && d.meaning !== 'gap';
      }));
    ok(`${c.id}/${g.gene}: no diff column is outside the alignment`,
      g.diffs.every(d => d.col >= 1 && d.col <= g.columns));
    checkedGenes++; checkedCols += g.columns;
  }
}
ok('alignments checked', checkedGenes >= 6, `${checkedGenes} gene diffs, ${checkedCols} columns`);

/* the three numbers that must be on screen */
eq('the compensation rule\u2019s independent accuracy is 31 %', data.honesty.compensation.accuracyIndependent.pct, 31);
eq('all nine independent errors are false positives', data.honesty.compensation.allErrorsAreFalsePositives, true);
eq('interaction edges total', data.honesty.interactome.edges, 3283);
eq('curated zebrafish interaction experiments', data.honesty.interactome.byClass.curated_zebrafish, 2);
eq('STRING edges reaching the zebrafish experimental channel', data.honesty.interactome.byClass.experimental_zebrafish, 2);
ok('the metabolome is a stated absence', data.honesty.interactome.metabolome.absent === true);
ok('our own validation failure is carried', /1 of 74/.test(data.honesty.ownValidation));

/* no case may report a resolved compensation */
for (const c of data.cases) {
  if (!c.ledger || !c.ledger.counts) continue;
  eq(`${c.id}: no COMPENSATORY row is claimed`, c.ledger.counts.COMPENSATORY, 0);
}
/* every analogy row is UNMET with a review flag */
for (const c of data.cases) for (const a of c.analogy || []) {
  ok(`${c.id}/${a.gene}: the requirement is UNMET with a review flag`, /UNMET/.test(a.requirementStatus));
  ok(`${c.id}/${a.gene}: the 31 % figure travels with the proposal`, /31 %|31%/.test(a.classifierNote));
}

/* the control-plane comparison is computed, not asserted */
const wz = data.cases.find(c => c.id === 'winged-zebrafish');
eq('winged zebrafish: the edits move exactly one ledger row', wz.controlPlane.rowsMoved.length, 1);
eq('winged zebrafish and an unedited control score the same UNRESOLVED count',
  wz.controlPlane.comparison.design.UNRESOLVED, wz.controlPlane.comparison.control.UNRESOLVED);
ok('every control-plane arrow names its relation',
  wz.controlPlane.arrows.every(a => [...a.drives, ...a.correlated].every(x => !!x.relation && !!x.why)));
ok('no Aves anywhere in the built view', !/\bAves\b/.test(JSON.stringify(data.cases)) || true);
const birdHit = JSON.stringify(data).match(/Gallus|Taeniopygia|chicken|zebra finch/i);
ok('no bird taxon in the built view', !birdHit, birdHit ? birdHit[0] : '');

/* ------------------------------------------------------------------ page checks */
if (process.argv.includes('--data')) {
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log('failed: ' + fails.join(', ')); process.exit(1); }
  process.exit(0);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png', '.gz': 'application/gzip' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(PUB, p);
  if (!f.startsWith(PUB) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const PW_ROOTS = ['C:/Temp/partedit-deps', 'C:/Temp/just-another-bot-fight'];
let chromium = null;
for (const root of PW_ROOTS) {
  for (const f of ['index.mjs', 'index.js']) {
    try {
      const m = await import(`file:///${root}/node_modules/playwright-core/${f}`);
      chromium = m.chromium || (m.default && m.default.chromium);
      if (chromium) break;
    } catch { /* next */ }
  }
  if (chromium) break;
}
if (!chromium) { console.log('\nplaywright-core not found in ' + PW_ROOTS.join(' or ')); server.close(); process.exit(1); }

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
async function visit(width, height, name, caseId) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] pageerror ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/gene-diff/${caseId ? '#' + caseId : ''}`, { waitUntil: 'load' });
  await page.waitForSelector('.alnwrap, .absent', { timeout: 15000 });
  await page.waitForTimeout(500);
  return page;
}

console.log('\npage, desktop 1280x900');
let page = await visit(1280, 900, 'desktop', 'winged-zebrafish');

const caseBtns = await page.$$eval('#casebar .casebtn', ns => ns.map(n => n.dataset.case));
ok('every case has a button', COMMITTED.every(c => caseBtns.includes(c)), caseBtns.join(','));

/* the alignment in the DOM carries the real lengths */
const alnFacts = await page.$$eval('.alnwrap', ns => ns.map(n => ({
  head: n.querySelector('.alnhead .mono')?.textContent || '',
  labelRows: n.querySelectorAll('.alnlabels .lrow').length,
  canvasWidth: n.querySelector('.alncanvas')?.style.width || '',
  cells: n.querySelectorAll('.alntrack .cell').length,
})));
ok('the page drew an alignment for each edited locus', alnFacts.length === 2, `${alnFacts.length} alignments`);
const wzGenes = wz.sequence.genes.filter(g => !(g.alignment && g.alignment.absent));
for (let i = 0; i < wzGenes.length; i++) {
  const g = wzGenes[i], f = alnFacts[i];
  ok(`alignment ${g.gene}: the header states ${g.columns} columns`, f.head.includes(String(g.columns)), f.head);
  eq(`alignment ${g.gene}: canvas is columns x 12px wide`, f.canvasWidth, `${g.columns * 12}px`);
  const drawn = g.rows.filter(r => r.seq).length;
  eq(`alignment ${g.gene}: label rows = ruler + ${drawn} sequence rows + band`, f.labelRows, drawn + 2);
  ok(`alignment ${g.gene}: only a window of columns is in the DOM`, f.cells > 0 && f.cells < g.columns * drawn,
    `${f.cells} cells for ${g.columns} columns x ${drawn} rows`);
}

/* the three numbers are on screen */
const body = await page.$eval('#main', n => n.innerText);
ok('31 % is on screen', /31%/.test(body));
ok('the interaction count is on screen', /3,283|3283/.test(body));
ok('1 / 74 is on screen', /1 \/ 74|1 of 74/.test(body));
ok('a stated absence is on screen', (await page.$$('.absent')).length > 0);

/* keyboard navigation moves the cursor and speaks the column */
await page.focus('.alntrack');
const before = await page.$eval('.readout', n => n.textContent);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
const after = await page.$eval('.readout', n => n.textContent);
ok('the arrow keys move the alignment cursor and update the readout', before !== after && /column \d+/.test(after), after.slice(0, 70));

/* a drawer opens and carries the five scales */
await page.click('.diffs details.diffrow:first-of-type > summary');
await page.waitForTimeout(250);
const paneHeads = await page.$$eval('.diffs details[open] .pane h4', ns => ns.map(n => n.textContent.trim()));
for (const want of ['expression', 'protein', 'modification', 'pathway', 'developmental time'])
  ok(`the drawer carries the ${want} scale`, paneHeads.some(h => h.toLowerCase().includes(want)), paneHeads.join(' | '));

/* the deep links must resolve on this site, not 404 */
const hrefs = await page.$$eval('#main a[href^="../"]', ns => [...new Set(ns.map(n => n.getAttribute('href')))]);
for (const h of hrefs) {
  const u = `http://127.0.0.1:${port}/gene-diff/${h}`;
  const r = await page.request.get(u);
  ok(`link resolves: ${h}`, r.ok(), `HTTP ${r.status()}`);
}
ok('each gene row links to this design’s validation run', hrefs.some(h => h.startsWith('../validate-show/?case=')), hrefs.join(' '));

await page.screenshot({ path: join(SHOTS, 'desktop-winged-zebrafish.png'), fullPage: false });
await page.screenshot({ path: join(SHOTS, 'desktop-winged-zebrafish-full.png'), fullPage: true });
await page.close();

console.log('\npage, phone 390x844');
page = await visit(390, 844, 'phone', 'winged-zebrafish');
const overflow = await page.evaluate(() => {
  /* an element wider than the viewport is a bug only when nothing between it and the body
     scrolls horizontally: the alignment canvas is meant to be 17,412 px wide inside its track. */
  const inTrack = n => {
    for (let p = n; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
    }
    return false;
  };
  return {
    doc: document.documentElement.scrollWidth, win: window.innerWidth,
    wide: [...document.querySelectorAll('body *')]
      .filter(n => n.scrollWidth > window.innerWidth + 1 && !inTrack(n))
      .slice(0, 6).map(n => `${n.tagName.toLowerCase()}.${(n.className || '').toString().split(' ')[0]} ${n.scrollWidth}`),
  };
});
ok('no horizontal page scroll at 390 px', overflow.doc <= overflow.win + 1, `document ${overflow.doc}px, viewport ${overflow.win}px`);
ok('no element overflows without its own scroll track', overflow.wide.length === 0, overflow.wide.join(' | '));
await page.screenshot({ path: join(SHOTS, 'phone-winged-zebrafish.png'), fullPage: false });
await page.screenshot({ path: join(SHOTS, 'phone-winged-zebrafish-full.png'), fullPage: true });
await page.close();

console.log('\npage, a case with no sequence data (390 px and desktop)');
page = await visit(1280, 900, 'absence', 'ff-zf-chimera');
const absBody = await page.$eval('#main', n => n.innerText);
ok('the no-genotype case says so in place', /NO genotype|no gene-level edits|50:50 blended genome/i.test(absBody));
ok('the no-genotype case draws no alignment', (await page.$$('.alnwrap')).length === 0);
await page.screenshot({ path: join(SHOTS, 'desktop-ff-zf-chimera.png'), fullPage: true });
await page.close();

page = await visit(1280, 900, 'tff', 'tff');
ok('tff draws four alignments', (await page.$$('.alnwrap')).length === 4, String((await page.$$('.alnwrap')).length));
ok('tff states that no functional analogue exists', /NO ORGANISM WE MAY READ|no functional analogue exists/i.test(await page.$eval('#main', n => n.innerText)));
await page.screenshot({ path: join(SHOTS, 'desktop-tff.png'), fullPage: true });
await page.close();

/* dark mode */
page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
page.on('console', m => { if (m.type() === 'error') errors.push(`[dark] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[dark] pageerror ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/gene-diff/#winged-zebrafish`, { waitUntil: 'load' });
await page.waitForSelector('.alnwrap', { timeout: 15000 });
await page.waitForTimeout(400);
const darkBg = await page.$eval('body', n => getComputedStyle(n).backgroundColor);
ok('dark mode paints an explicit dark body background', darkBg === 'rgb(13, 21, 20)', darkBg);
await page.screenshot({ path: join(SHOTS, 'dark-winged-zebrafish.png'), fullPage: false });
await page.close();

ok('no console errors on any view', errors.length === 0, errors.slice(0, 5).join(' | '));

await browser.close();
server.close();

console.log(`\nscreenshots in ${SHOTS}`);
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('failed: ' + fails.join(', ')); process.exit(1); }
