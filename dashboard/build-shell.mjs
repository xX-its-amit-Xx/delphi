#!/usr/bin/env node
/* build-shell.mjs — put one shared header on every DELPHI dashboard page.
 *
 * Why a build step and not a script tag: the header is static HTML in every
 * page, so it is there before any JavaScript runs, the current page is marked
 * at build time, and every link is checked against the file system first. A
 * link that does not resolve is dropped and listed, so the nav never ships a
 * dead entry.
 *
 *   node dashboard/build-shell.mjs           write the header into every page
 *   node dashboard/build-shell.mjs --check   verify links only, change nothing
 *
 * Scope: this script only writes files this thread owns (see OWNED below). The
 * 3D viewer, the deck, the results page and the physics simulator belong to
 * other threads; their owners can adopt the shell by adding their page to
 * OWNED and re-running, or by pasting the block this script prints with
 * --emit <page>.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, 'public');

/* ------------------------------------------------------------------ nav model
 * Grouped by what a visitor wants, not by which thread built it.
 *
 *  - "The organism" is the 3D viewer. It gets its own row because it is the
 *    de-facto home of the site and because its nine modes used to be hidden
 *    behind a <select> inside the viewer, where the project lead could not find
 *    the flight simulator. Every mode is a direct link here.
 *  - "Results" is what we claim; "Evidence" is what backs it; "Threads" is how
 *    it was built, which is the only group organised by team; "About" is where
 *    a newcomer starts.
 */
const MODES = {
  label: 'The organism',
  items: [
    { key: 'v-anatomy',   href: 'blueprint3d/',                  text: 'Anatomy',           mode: null },
    { key: 'v-physio',    href: 'blueprint3d/?mode=physiology',  text: 'Circulation & gills', mode: 'physiology' },
    { key: 'v-tissue',    href: 'blueprint3d/?mode=tissue',      text: 'Tissue signals',    mode: 'tissue' },
    { key: 'v-cell',      href: 'blueprint3d/?mode=cell',        text: 'Cell interactions', mode: 'cell' },
    { key: 'v-physics',   href: 'blueprint3d/?mode=physics',     text: 'Flight simulator',  mode: 'physics' },
    { key: 'v-design',    href: 'blueprint3d/?mode=design',      text: 'Design studio',     mode: 'design' },
    { key: 'v-growth',    href: 'blueprint3d/?mode=growth',      text: 'Growth',            mode: 'growth' },
    { key: 'v-compare',   href: 'blueprint3d/?mode=compare',     text: 'Compare species',   mode: 'compare' },
    { key: 'v-seq',       href: 'blueprint3d/?mode=sequences',   text: 'Gene sequences',    mode: 'sequences' },
    { key: 'v-radial',    href: 'blueprint3d/?view=radial',      text: 'Radial map',        mode: null }
  ]
};

const GROUPS = [
  { key: 'results', label: 'Results', items: [
    { key: 'results',  href: 'results/',        text: 'Results' },
    { key: 'deck',     href: 'deck/',           text: 'Pitch deck' },
    { key: 'print',    href: 'print/',          text: 'Printable kit' },
    { key: 'evolve',   href: 'evolve/',         text: 'Enzymes' }
  ]},
  { key: 'evidence', label: 'Evidence', items: [
    { key: 'proofs',   href: 'proofs/',         text: 'Claim book' },
    { key: 'graph',    href: 'graph/',          text: 'Graph' },
    { key: 'figures',  href: 'figures/',        text: 'Figures' }
  ]},
  { key: 'threads', label: 'Threads', items: [
    { key: 'lean',     href: 't/lean/',         text: 'Lean proofs' },
    { key: 'claims',   href: 't/claims/',       text: 'Claim tests' },
    { key: 'genotype', href: 't/genotype/',     text: 'Genotype' },
    { key: 'physics',  href: 't/physics/',      text: 'Physics' },
    { key: 'sim',      href: 't/physics/sim/',  text: 'Simulator' },
    { key: 'organism', href: 't/organism/',     text: 'Organism' },
    { key: 'holdout',  href: 't/holdout/',      text: 'Holdout' },
    { key: 'swarm',    href: 't/swarm/',        text: 'Swarm' },
    { key: 'valid',    href: 't/validation/',   text: 'Validation' }
  ]},
  { key: 'about', label: 'About', items: [
    { key: 'start',    href: 'start/',          text: 'Start here' },
    { key: 'home',     href: 'index.html',      text: 'Mission control' }
  ]}
];

/* ------------------------------------------------- pages this thread may write
 * value = the nav key for the page, so the shell can mark it as current. */
const OWNED = {
  'index.html':          'home',
  'start/index.html':    'start',
  'proofs/index.html':   'proofs',
  'graph/index.html':    'graph',
  'figures/index.html':  'figures',
  't/lean/index.html':      'lean',
  't/claims/index.html':    'claims',
  't/genotype/index.html':  'genotype',
  't/holdout/index.html':   'holdout',
  't/organism/index.html':  'organism',
  't/physics/index.html':   'physics',
  't/swarm/index.html':     'swarm',
  't/validation/index.html':'valid'
};

/* ------------------------------------------------------------- link verifying */
const notes = [];

function resolvesOnDisk(href) {
  const path = href.split('?')[0].split('#')[0];
  if (!path) return false;
  const target = path.endsWith('/') ? join(PUB, path, 'index.html') : join(PUB, path);
  return existsSync(target);
}

// the viewer's own accepted mode list, read out of its source rather than assumed
let viewerModes = null, viewerRadial = false;
try {
  const src = readFileSync(join(PUB, 'blueprint3d', 'explode.html'), 'utf8');
  const m = src.match(/const mode=params\.get\('mode'\);if\(mode&&\[([^\]]*)\]/);
  if (m) viewerModes = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
} catch { /* reported below */ }
try {
  viewerRadial = /view'\)!=='radial'/.test(readFileSync(join(PUB, 'blueprint3d', 'index.html'), 'utf8'));
} catch { /* reported below */ }

function verify(item) {
  if (!resolvesOnDisk(item.href)) { notes.push(`DROPPED  ${item.href}  (no file on disk)`); return false; }
  if (item.mode) {
    if (!viewerModes) { notes.push(`KEPT     ${item.href}  (could not read the viewer's mode list to confirm)`); return true; }
    if (!viewerModes.includes(item.mode)) { notes.push(`DROPPED  ${item.href}  (the viewer does not accept mode=${item.mode})`); return false; }
  }
  if (item.key === 'v-radial' && !viewerRadial) { notes.push(`DROPPED  ${item.href}  (the viewer no longer honours view=radial)`); return false; }
  notes.push(`ok       ${item.href}`);
  return true;
}

const modes = { ...MODES, items: MODES.items.filter(verify) };
const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(verify) })).filter(g => g.items.length);

/* --------------------------------------------------------------- the markup */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FISH = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0e7c86"/><path d="M5 16c5-7 14-9 22-4-3 2-6 3-8 4 2 1 5 2 8 4-8 5-17 3-22-4z" fill="#fff"/></svg>';

function link(item, prefix, cur) {
  const here = item.key === cur;
  return `<a class="dsh-link" href="${esc(prefix + item.href)}"${here ? ' aria-current="page"' : ''}>${esc(item.text)}</a>`;
}

function shellFor(prefix, cur) {
  // on the hub itself the project name is the "you are here", so no nav pill is
  // marked: marking the last group would scroll the nav past its first groups
  const home = cur === 'home';
  if (home) cur = null;
  const curGroup = groups.find(g => g.items.some(i => i.key === cur));
  const row1 = groups.map(g =>
    `<span class="dsh-grp"${g === curGroup ? ' data-cur' : ''}><span class="dsh-lab">${esc(g.label)}</span>` +
    g.items.map(i => link(i, prefix, cur)).join('') + '</span>'
  ).join('');
  const row2 = `<span class="dsh-lab">${esc(modes.label)}</span>` + modes.items.map(i => link(i, prefix, cur)).join('');
  return [
    '<!-- delphi-shell:start  generated by dashboard/build-shell.mjs - do not edit by hand -->',
    '<a class="dsh-skip" href="#dsh-content">Skip the navigation</a>',
    '<header class="dsh">',
    `  <div class="dsh-bar"><a class="dsh-brand" href="${esc(prefix + 'index.html')}"${home ? ' aria-current="page"' : ''}>${FISH}DELPHI<span class="sub">laws of biology</span></a>`,
    `    <nav class="dsh-nav" aria-label="Primary">${row1}</nav>`,
    '    <button class="dsh-theme" id="themeBtn" data-dsh-theme type="button" title="Toggle light or dark">Theme</button></div>',
    `  <nav class="dsh-modes" aria-label="The 3D organism viewer">${row2}</nav>`,
    '</header>',
    '<span id="dsh-content"></span>',
    '<!-- delphi-shell:end -->'
  ].join('\n');
}

/* ------------------------------------------------------------------- writing */
const START = '<!-- delphi-shell:start', END = '<!-- delphi-shell:end -->';

function applyTo(rel, cur, write) {
  const file = join(PUB, rel);
  if (!existsSync(file)) return `missing   ${rel}`;
  const depth = rel.split('/').length - 1;
  const prefix = '../'.repeat(depth);
  let html = readFileSync(file, 'utf8');
  const before = html;

  // head, early: the shell's stylesheet and behaviour, before the page's own
  // <style>, so a page keeps its own palette and background and the shell only
  // supplies defaults. The script is a plain one so the stored theme is applied
  // before the first paint.
  const cssTag = `<link rel="stylesheet" href="${prefix}shared/shell.css">`;
  const jsTag = `<script src="${prefix}shared/shell.js"></script>`;
  // head, late: narrow-screen repairs that have to beat the page's own rules.
  // Wide tables scroll inside their box instead of pushing the page sideways —
  // the same thing the 3D viewer does to its panel tables under 880px.
  const fitTag = `<style id="dsh-fit">@media (max-width:720px){` +
    `body{overflow-wrap:break-word}` +
    `main table,section table,.card table,.in table,.scroll table{display:block;overflow-x:auto;max-width:100%}` +
    `code,pre,.mono{overflow-wrap:anywhere}}</style>`;
  html = html.replace(/[ \t]*<link rel="stylesheet" href="[^"]*shared\/shell\.css">\r?\n?/g, '')
             .replace(/[ \t]*<script src="[^"]*shared\/shell\.js"><\/script>\r?\n?/g, '')
             .replace(/[ \t]*<style id="dsh-fit">[\s\S]*?<\/style>\r?\n?/g, '');
  if (!/<\/head>/.test(html)) return `no <head>  ${rel}`;
  const vp = html.match(/<meta name="viewport"[^>]*>/) || html.match(/<head[^>]*>/);
  if (!vp) return `no place for the head tags  ${rel}`;
  html = html.replace(vp[0], `${vp[0]}\n${cssTag}\n${jsTag}`)
             .replace('</head>', `${fitTag}\n</head>`);

  // body: the shell block, replacing any previous one
  const block = shellFor(prefix, cur);
  const s = html.indexOf(START);
  if (s !== -1) {
    const e = html.indexOf(END, s);
    if (e === -1) return `broken markers  ${rel}`;
    html = html.slice(0, s) + block + html.slice(e + END.length);
  } else {
    const m = html.match(/<body[^>]*>/);
    if (!m) return `no <body>  ${rel}`;
    html = html.replace(m[0], m[0] + '\n' + block);
  }

  if (html === before) return `unchanged ${rel}`;
  if (write) writeFileSync(file, html);
  return `${write ? 'wrote' : 'would write'}     ${rel}  (current: ${cur})`;
}

/* --emit <page> prints what another thread's page needs, without touching it:
 *   node dashboard/build-shell.mjs --emit deck/index.html
 * The two head tags go in <head>, the block goes straight after <body>, and the
 * page's own brand, back-link and theme button come out of its own header. The
 * shell's button keeps id="themeBtn", so a page that already binds a handler
 * there (the viewer repaints its palette) needs no change to its script. */
const emitAt = process.argv.indexOf('--emit');
if (emitAt !== -1) {
  const rel = process.argv[emitAt + 1];
  if (!rel) { console.error('--emit needs a page path relative to dashboard/public'); process.exit(1); }
  const depth = rel.split('/').length - 1, prefix = '../'.repeat(depth);
  const key = OWNED[rel] || GROUPS.flatMap(g => g.items).concat(MODES.items)
    .find(i => i.href === rel.replace(/index\.html$/, '') || i.href === rel)?.key || null;
  console.log(`<!-- in <head> -->\n<link rel="stylesheet" href="${prefix}shared/shell.css">\n<script src="${prefix}shared/shell.js"></script>\n`);
  console.log(`<!-- straight after <body>, current page = ${key || 'none matched'} -->`);
  console.log(shellFor(prefix, key));
  process.exit(0);
}

const check = process.argv.includes('--check');
console.log('link check');
for (const n of notes) console.log('  ' + n);
const dropped = notes.filter(n => n.startsWith('DROPPED')).length;
console.log(`  ${notes.length - dropped} link(s) resolve, ${dropped} dropped\n`);
console.log(check ? 'pages (dry run)' : 'pages');
for (const [rel, cur] of Object.entries(OWNED)) console.log('  ' + applyTo(rel, cur, !check));
