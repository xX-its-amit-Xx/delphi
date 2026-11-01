/* DELPHI printable-kit assembly viewer.
 *
 * Reads print/parts.json (written by dashboard/build-print-view.mjs), which holds
 * one normalised record per kit: the 1:1 starter kit (default), the 120 mm
 * containment-hierarchy kit, and the superseded legacy 100-part set. A switcher
 * swaps between them; ?kit=<id> makes a kit linkable.
 *
 * For the chosen kit it loads every binary STL at its shared origin and drives
 * everything from ONE number:
 *
 *      T in [0,1]      0 = fully exploded      1 = assembled
 *
 * The explode slider shows 1-T, the assembly animation advances T, so scrubbing
 * seeks the animation. Each part has its own window [t0,t1] inside T, allocated
 * by the build script in the kit's own assembly order.
 *
 * Every verdict on this page (pass, fails a check, wall not established, do not
 * print) and every reason is read from the print manifest via parts.json. The
 * page states them; it computes none of them. The STL files are fetched
 * read-only.
 */
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mb = n => (n / 1048576).toFixed(n < 10485760 ? 2 : 1);
const kb = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 102400 ? 1 : 0) + ' KB' : mb(n) + ' MB';
const num = n => Number(n).toLocaleString('en-GB');
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ----------------------------------------------------------------- palettes
 * The two current kits are coloured by what a piece IS in the hierarchy; the
 * legacy set by its manifest layer. Status colours override both, so a part
 * that must not be printed is red whatever it is. The site accent is reserved
 * for the selected part. */
const PALETTE = {
  kind: {
    case:    { col: 0x8fa3c2, label: 'Body case (drawn translucent so the inside stays visible)' },
    carrier: { col: 0xc7b893, label: 'Organ-system carrier' },
    organ:   { col: 0x4e9ec0, label: 'Organ' },
    tissue:  { col: 0xc4616d, label: 'Tissue' }
  },
  layer: {
    skeleton: { col: 0xc7b893, label: 'Skeleton' },
    muscle:   { col: 0xc4616d, label: 'Muscle' },
    organ:    { col: 0x4e9ec0, label: 'Organ' },
    outer:    { col: 0x8fa3c2, label: 'Outer (skin, eyes, fin membranes)' }
  }
};
const STATUS = {
  pass:        { col: null,     chip: 'ok',   short: 'passes' },
  unverified:  { col: null,     chip: '',     short: 'wall not established' },
  fail:        { col: 0xe0a24a, chip: 'warn', short: 'fails a check' },
  unprintable: { col: 0xe0a24a, chip: 'warn', short: 'will not print' },
  donotprint:  { col: 0xd8453a, chip: 'bad',  short: 'DO NOT PRINT' }
};
const SEL_COL = 0x19c3cf;
const hex = n => '#' + n.toString(16).padStart(6, '0');

/* ----------------------------------------------------------------- the data */
let ROOT = null;                   // parts.json
let D = null;                      // the chosen kit
let P = [];                        // live part records for the chosen kit
let byId = new Map();
let selected = null;
let gen = 0;                       // bumps on every kit switch; stale loads drop out

/* -------------------------------------------------------------- the state */
let T = 0;
let playing = false;
let speed = 1;
let spin = false;
let autoFrame = true;
const DUR_MS = 10000;
let EXPLODE_MM = 92, ARC_MM = 9;

const easeOut = u => 1 - Math.pow(1 - u, 3);
const clamp01 = u => u < 0 ? 0 : u > 1 ? 1 : u;

boot();

async function boot() {
  try {
    const r = await fetch('parts.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('parts.json ' + r.status);
    ROOT = await r.json();
    if (!Array.isArray(ROOT.kits) || !ROOT.kits.length) throw new Error('parts.json has no kits');
  } catch (e) {
    $('loadLine').textContent = 'Could not read parts.json: ' + e.message + '. Run node dashboard/build-print-view.mjs.';
    $('loadOver').hidden = true;
    return;
  }
  const sel = $('kitSel');
  for (const k of ROOT.kits) {
    const o = document.createElement('option');
    o.value = k.id; o.textContent = k.menu;
    sel.appendChild(o);
  }
  const want = new URLSearchParams(location.search).get('kit');
  const first = ROOT.kits.find(k => k.id === want) || ROOT.kits.find(k => k.id === ROOT.default_kit) || ROOT.kits[0];
  sel.value = first.id;
  sel.onchange = () => switchKit(sel.value, true);
  $('notList').innerHTML = (ROOT.what_this_is_not || []).map(s => `<li>${esc(s)}</li>`).join('');
  $('genLine').textContent = 'Data generated ' + ROOT.generated + '.';
  wireControls();
  try { startGL(); } catch (e) { glFailed(e); }
  switchKit(first.id, false);
}

function switchKit(id, fromUser) {
  const k = ROOT.kits.find(x => x.id === id);
  if (!k) return;
  gen++;
  D = k;
  if (fromUser) {
    const u = new URL(location.href);
    if (id === ROOT.default_kit) u.searchParams.delete('kit'); else u.searchParams.set('kit', id);
    history.replaceState(null, '', u);
  }
  clearScene();
  selected = null;
  $('selBox').hidden = true;
  $('search').value = '';
  fillProse();
  buildGroupModes();
  buildIsolate();
  renderList();
  $('list').scrollTop = 0;
  if (renderer) startKitGL();
}

/* ======================================================= the prose and tables
 * Everything below is assembled out of parts.json, which quotes the print
 * manifest (or, for the legacy set, parts-INFO and the GLB manifest). */
const statusChip = st => {
  const s = STATUS[st] || STATUS.pass;
  return `<span class="chip ${s.chip}">${esc(s.short)}</span>`;
};

function fillProse() {
  const t = D.totals;
  document.title = 'DELPHI printable kit — ' + D.title;
  $('kitTitle').textContent = D.title;
  $('kitScale').textContent = D.scale_line || '';
  const des = D.design || {};
  $('kitLede').innerHTML = `<b>${t.parts} binary STL files</b>, ${mb(t.bytes)} MB, ${num(t.triangles)} triangles, all exported about a `
    + `<b>single shared origin</b>: loaded at <code>0,&nbsp;0,&nbsp;0</code> they reassemble the kit, and the view below does that in the kit&rsquo;s own assembly order. `
    + `Design <code>${esc(des.id || '?')}</code>, <code>pectoral_len_over_SL</code> = <b>${esc(des.pectoral_len_over_SL ?? '?')}</b> (${esc(des.basis || '')}). `
    + (D.current ? '' : '<b class="bad">This set is superseded.</b> ')
    + 'Every verdict here is read from the kit&rsquo;s manifest by <code>dashboard/build-print-view.mjs</code>.';

  $('bannerGrid').innerHTML = (D.banner || []).map(b =>
    `<div class="fg"><b class="${esc(b.cls)}">${esc(b.head)}</b> <span class="mute">${esc(b.text)}</span>`
    + (b.link ? ` <a class="chip ok" href="${esc(b.link.href)}" download>${esc(b.link.text)}</a>` : '') + '</div>').join('');

  $('overNote').innerHTML = (D.pills || []).map(p => `<span class="pill ${esc(p.cls)}">${esc(p.text)}</span>`).join('');
  $('loadTitle').textContent = `Loading ${t.parts} part files`;

  // ---- what fails
  const bad = D.parts.filter(p => p.status !== 'pass');
  $('failHead').textContent = bad.length ? `What fails: ${bad.length} of ${t.parts}` : `What fails: nothing — all ${t.parts} pass`;
  const counts = Object.keys(STATUS).filter(k => k !== 'pass' && t[k]).map(k => `<b>${t[k]}</b> ${esc(ROOT.status_labels[k].toLowerCase())}`);
  $('failLine').innerHTML = bad.length
    ? `${counts.join(' &middot; ')}. Nothing has been dropped: every part below is a real file in the list and the downloads, with the reason the manifest gives. `
      + (t.donotprint ? '<b class="bad">The parts marked DO NOT PRINT failed the volume cross-check &mdash; the signature of a shell wound inside out &mdash; and must be inspected before printing.</b>' : '')
    : `Every part is watertight, has its normals out, passes the volume cross-check and clears the minimum wall. The checks are described in <code>anatomy-model/print/README.md</code>.`;
  const order = { donotprint: 0, fail: 1, unprintable: 1, unverified: 2 };
  $('failTable').innerHTML = bad.length
    ? '<thead><tr><th>Part</th><th>Verdict</th><th>Reason</th><th>File</th></tr></thead><tbody>'
      + bad.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.label.localeCompare(b.label)).map(p =>
        `<tr class="st-${esc(p.status)}"><td>${esc(p.label)}<div class="mono small mute">${esc(p.id)}</div></td><td>${statusChip(p.status)}</td>`
        + `<td class="small">${(p.reasons || []).map(esc).join('<br>')}</td>`
        + `<td><a href="${esc(D.stl_base + p.file)}" download>${kb(p.bytes)}</a></td></tr>`).join('') + '</tbody>'
    : '';

  // ---- related one-piece files
  $('relCards').innerHTML = (D.related || []).map(o => `<div class="card">
      <h3>${esc(o.title)}</h3>
      <p class="small mute m0">${esc(o.note)}</p>
      <table style="margin-top:10px"><tbody>
        <tr><th>File</th><td class="mono">${esc(o.file)}</td></tr>
        <tr><th>Size</th><td>${mb(o.bytes)} MB &middot; ${num(o.triangles)} triangles</td></tr>
        <tr><th>Bounding box</th><td>${o.bbox.size.map(n => n.toFixed(1)).join(' &times; ')} mm</td></tr>
      </tbody></table>
      <p class="m0" style="margin-top:10px"><a class="chip ok" href="${esc(o.href)}" download>Download ${esc(o.file)}</a></p>
    </div>`).join('') || '<p class="small mute">No related one-piece files for this kit.</p>';

  // ---- about
  $('aboutHead').textContent = 'About the ' + D.title.replace(/^./, c => c.toLowerCase());
  $('aboutCards').innerHTML = (D.about || []).map(c => `<div class="card"><h3>${esc(c.title)}</h3>
      ${c.rows?.length ? '<table><tbody>' + c.rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('') + '</tbody></table>' : ''}
      ${(c.paras || []).map(x => `<p class="small" style="margin-top:10px">${esc(x)}</p>`).join('')}</div>`).join('');

  $('loadLine').innerHTML = `${t.parts} part files, ${mb(t.bytes)} MB, ${num(t.triangles)} triangles in all. <span id="loadStat" class="mute">fetching&hellip;</span>`;

  // ---- legend
  const pal = PALETTE[D.color_by] || PALETTE.kind;
  const keyOf = p => D.color_by === 'layer' ? p.layer : p.kind;
  const statusKeys = Object.keys(STATUS).filter(k => STATUS[k].col !== null && D.parts.some(p => p.status === k));
  $('legend').innerHTML = Object.entries(pal).filter(([k]) => D.parts.some(p => keyOf(p) === k)).map(([k, v]) =>
      `<span class="lkey"><i class="lsw" style="background:${hex(v.col)}"></i>${esc(v.label)} <span class="mute">${D.parts.filter(p => keyOf(p) === k).length}</span></span>`).join('')
    + statusKeys.map(k => `<span class="lkey"><i class="lsw" style="background:${hex(STATUS[k].col)}"></i><b class="${STATUS[k].chip}">${esc(ROOT.status_labels[k])}</b> <span class="mute">${t[k]}</span></span>`).join('')
    + `<span class="lkey"><i class="lsw" style="background:${hex(SEL_COL)}"></i>Selected</span>`;
}

/* ================================================================= the list */
function buildGroupModes() {
  const sel = $('groupSel');
  sel.innerHTML = D.group_modes.map(m => `<option value="${esc(m.key)}">${esc(m.label)}</option>`).join('');
  sel.value = D.group_modes[0].key;
}

function buildIsolate() {
  const sel = $('isoSel');
  sel.innerHTML = `<option value="">Nothing &mdash; show all ${D.totals.parts}</option>`;
  for (const m of D.group_modes) {
    const g = document.createElement('optgroup'); g.label = m.label;
    const heads = new Map(), subs = new Map();
    for (const p of D.parts) {
      const [h, s] = p.g[m.key] || [];
      if (h == null) continue;
      heads.set(h, (heads.get(h) || 0) + 1);
      if (s != null) subs.set(h + '\u0001' + s, (subs.get(h + '\u0001' + s) || 0) + 1);
    }
    for (const [h, n] of sortHeads(m.key, heads)) {
      const o = document.createElement('option');
      o.value = m.key + '\u0000' + h; o.textContent = `${h}  (${n})`;
      g.appendChild(o);
      for (const [k, n2] of [...subs].filter(([k]) => k.startsWith(h + '\u0001')).sort()) {
        const o2 = document.createElement('option');
        o2.value = m.key + '\u0000' + k; o2.textContent = `   ${k.split('\u0001')[1]}  (${n2})`;
        g.appendChild(o2);
      }
    }
    sel.appendChild(g);
  }
}

function sortHeads(mode, map) {
  const ord = D.group_order?.[mode];
  return [...map].sort((a, b) => {
    if (ord) {
      const ia = ord.indexOf(a[0]), ib = ord.indexOf(b[0]);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }
    return b[1] - a[1] || String(a[0]).localeCompare(String(b[0]));
  });
}

function isoTest(iso) {
  if (!iso) return () => true;
  const [mode, key] = iso.split('\u0000');
  const [h, s] = key.split('\u0001');
  return p => { const g = p.g[mode] || []; return g[0] === h && (s === undefined || g[1] === s); };
}

function visibleSet() {
  const q = $('search').value.trim().toLowerCase();
  const iso = isoTest($('isoSel').value);
  const hay = p => [p.label, p.id, p.file, p.ontology_id, p.ontology_label, p.organ, p.system, p.kind, p.level, p.status, ...(p.reasons || [])]
    .filter(Boolean).join(' ').toLowerCase();
  const out = new Set();
  for (const p of D.parts) if (iso(p) && (!q || hay(p).includes(q))) out.add(p.id);
  return out;
}

function groupsFor(mode, keep) {
  const parts = D.parts.filter(p => keep.has(p.id));
  const order = new Map(D.parts.map((p, i) => [p.id, (p.t0 ?? 0) * 1e4 + i]));
  const top = new Map();
  for (const p of parts) {
    const [h, s] = p.g[mode] || ['(ungrouped)', null];
    if (!top.has(h)) top.set(h, new Map());
    const k = s ?? '\u0000';
    if (!top.get(h).has(k)) top.get(h).set(k, []);
    top.get(h).get(k).push(p);
  }
  const counts = new Map([...top].map(([h, m]) => [h, [...m.values()].reduce((n, v) => n + v.length, 0)]));
  return sortHeads(mode, counts).map(([h, n]) => ({
    head: h, n,
    subs: [...top.get(h)].sort((a, b) => a[0] === '\u0000' ? -1 : b[0] === '\u0000' ? 1 : a[0].localeCompare(b[0]))
      .map(([s, ps]) => ({ head: s === '\u0000' ? null : s, parts: ps.sort((a, b) => order.get(a.id) - order.get(b.id)) }))
  }));
}

function renderList() {
  const keep = visibleSet();
  const mode = $('groupSel').value;
  const html = [];
  for (const g of groupsFor(mode, keep)) {
    html.push(`<div class="gh">${esc(g.head)}<span class="n">${g.n}</span></div>`);
    for (const s of g.subs) {
      if (s.head !== null) html.push(`<div class="gh sub">${esc(s.head)}<span class="n">${s.parts.length}</span></div>`);
      for (const p of s.parts) html.push(row(p));
    }
  }
  $('list').innerHTML = html.join('') || '<div class="row" style="cursor:default"><span></span><span class="nm mute">Nothing matches that search.</span><span></span></div>';
  $('listCount').textContent = keep.size + ' of ' + D.totals.parts + ' shown';
  const iso = $('isoSel').value;
  $('isoNote').innerHTML = iso
    ? `Isolated: <b>${esc($('isoSel').selectedOptions[0].textContent.trim())}</b>. The other parts stay in the 3D view, ${$('hideChk').checked ? 'hidden' : 'faded'}, so you can see where the group sits.`
    : (D.id === 'legacy'
        ? 'Organ system is the GLB manifest&rsquo;s field; the organ tier is <b>derived</b> from the object name.'
        : 'Every grouping, parent and verdict is read from <code>anatomy-model/print/manifest.json</code>.');
  applyVisibility(keep);
  if (selected) markSelected(selected, false);
}

function baseCol(p) {
  const pal = PALETTE[D.color_by] || PALETTE.kind;
  return (pal[D.color_by === 'layer' ? p.layer : p.kind]?.col) ?? 0x9aa39f;
}
function partCol(p) { return STATUS[p.status]?.col ?? baseCol(p); }

function row(p) {
  const cls = ['row', 'st-' + p.status];
  const ont = p.ontology_id
    ? `<span title="${esc(p.ontology_label || '')}">${esc(p.ontology_id)}</span>`
    : '';
  const why = p.status !== 'pass' && p.reasons?.length ? `<span class="why">${esc(p.reasons[0])}</span>` : '';
  return `<div class="${cls.join(' ')}" role="option" tabindex="0" data-id="${esc(p.id)}" aria-selected="false">
    <i class="sw" style="background:${hex(partCol(p))}"></i>
    <span class="nm">${esc(p.label)}<span class="obj">${esc(p.file)}</span>
      <span class="meta">${statusChip(p.status)}${ont}${p.merge ? `<span title="merged from ${p.source_count} source objects">merged ${esc(p.merge.split(',')[0])}</span>` : ''}<span>${num(p.triangles)} tri</span><span>${kb(p.bytes)}</span>${p.level === 'tissue' ? '<span class="chip">tissue</span>' : ''}</span>${why}</span>
    <a class="dl" href="${esc(D.stl_base + p.file)}" download title="Download ${esc(p.file)}">STL</a>
  </div>`;
}

/* ------------------------------------------------------------- the selection */
function markSelected(id, scroll) {
  selected = id;
  for (const el of $('list').querySelectorAll('.row')) el.setAttribute('aria-selected', el.dataset.id === id ? 'true' : 'false');
  for (const p of P) paint(p);
  const d = D.parts.find(p => p.id === id);
  const box = $('selBox');
  if (!d) { box.hidden = true; return; }
  box.hidden = false;
  const parent = d.seats_into ? (D.parts.find(p => p.id === d.seats_into)?.label || d.seats_into) : null;
  const wall = d.wall && d.wall.samples
    ? `p05 ${d.wall.p05} mm &middot; median ${d.wall.median} mm <span class="mute">(${num(d.wall.samples)} samples)</span>` : null;
  box.innerHTML = `<button class="close" id="selClose" type="button">Clear</button>
    <h4>${esc(d.label)} ${statusChip(d.status)}</h4>
    <dl>
      <dt>File</dt><dd class="mono">${esc(d.file)}</dd>
      ${d.reasons?.length ? `<dt>Why</dt><dd class="${d.status === 'donotprint' ? 'bad' : 'warn'}">${d.reasons.map(esc).join('<br>')}</dd>` : ''}
      <dt>Hierarchy</dt><dd>${esc(d.system || '?')} &rarr; ${esc(d.organ || '?')} &rarr; ${esc(d.level || '?')}${d.kind ? ' &middot; ' + esc(d.kind) : ''}</dd>
      ${parent ? `<dt>Seats into</dt><dd>${esc(parent)}</dd>` : ''}
      ${d.holds?.length ? `<dt>Holds</dt><dd>${d.holds.length} part${d.holds.length > 1 ? 's' : ''}</dd>` : ''}
      <dt>Side</dt><dd>${esc({ L: 'left', R: 'right', mid: 'midline' }[d.side] || d.side || '?')}</dd>
      ${d.ontology_id ? `<dt>Ontology</dt><dd>${esc(d.ontology_id)} ${esc(d.ontology_label || '')}</dd>` : ''}
      ${d.merge ? `<dt>Merged</dt><dd>${esc(d.merge)} &middot; ${d.sources.slice(0, 8).map(esc).join(', ')}${d.sources.length > 8 ? ' &hellip;' : ''}</dd>` : ''}
      <dt>Mesh</dt><dd>${num(d.triangles)} triangles &middot; ${kb(d.bytes)}</dd>
      <dt>Size</dt><dd>${d.bbox.size.map(n => n.toFixed(1)).join(' &times; ')} mm</dd>
      ${wall ? `<dt>Wall</dt><dd>${wall}</dd>` : ''}
      ${d.deviations?.length ? `<dt>Altered</dt><dd class="mute">${d.deviations.map(x => esc(x.change) + (x.amount_mm != null ? ' (' + x.amount_mm + ' mm)' : '')).join('; ')}</dd>` : ''}
      ${d.notes?.length ? `<dt>Notes</dt><dd class="mute">${d.notes.map(esc).join(' ')}</dd>` : ''}
    </dl>
    <p class="m0" style="margin-top:8px"><a class="chip ok" href="${esc(D.stl_base + d.file)}" download>Download ${esc(d.file)}</a></p>`;
  $('selClose').onclick = () => markSelected(null, false);
  if (!scroll) return;
  const el = $('list').querySelector(`.row[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  const list = $('list'), br = list.getBoundingClientRect(), er = el.getBoundingClientRect();
  const HEAD = 30;
  if (er.top < br.top + HEAD || er.bottom > br.bottom - 6) list.scrollTop += (er.top - br.top) - Math.max(HEAD, (list.clientHeight - er.height) / 2);
}

/* ================================================================ the 3D view */
let renderer, scene, camera, controls, group, raycaster, labelHost, spinner;

function glFailed(e) {
  console.warn('[print] 3D view unavailable:', e);
  renderer = null;
  $('glFail').hidden = false;
  $('loadOver').hidden = true;
  $('caption').hidden = true;
}

function startGL() {
  const canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearAlpha(0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.5, 8000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a58, 0.85));
  const k = new THREE.DirectionalLight(0xffffff, 1.15); k.position.set(1.1, 1.5, 1.6); scene.add(k);
  const f = new THREE.DirectionalLight(0xffffff, 0.45); f.position.set(-1.3, -0.6, -1.0); scene.add(f);

  group = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.add(group);
  pivot.rotation.x = -Math.PI / 2;           // print frame is Z-up; three.js is Y-up
  spinner = new THREE.Group();
  spinner.add(pivot);
  scene.add(spinner);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  raycaster = new THREE.Raycaster();
  labelHost = $('labels');
  resize();
  new ResizeObserver(resize).observe($('canvasWrap'));
  wireCanvas();
  renderer.setAnimationLoop(frame);
}

/* called on every kit switch, after clearScene */
function startKitGL() {
  const c = D.frame.kit_centre_mm;
  group.position.set(-c[0], -c[1], -c[2]);
  const L = Math.max(...D.frame.kit_bbox_mm.size);
  EXPLODE_MM = D.explode_mm || L * 0.7;
  ARC_MM = L * 0.07;
  controls.target.set(0, 0, 0);
  controls.minDistance = L * 0.35;
  controls.maxDistance = L * 18;
  camera.position.set(0.58, 0.40, 1).normalize().multiplyScalar(L * 4.5);
  spinner.rotation.set(0, 0, 0);
  autoFrame = true;
  $('loadOver').classList.remove('done');
  $('loadOver').hidden = false;
  $('caption').hidden = false;
  T = REDUCED ? 1 : 0;
  playing = false;
  setSpin(false);
  setSlider();
  lastCap = '';
  loadAll(gen);
}

function clearScene() {
  for (const p of P) {
    group.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mat.dispose();
  }
  P = [];
  byId = new Map();
  lastVisible = null;
  for (const el of labelEls.values()) el.remove();
  labelEls.clear();
}

/* ------------------------------------------------------------------- framing
 * Project each part's own box onto the camera's right/up/forward axes and take
 * the envelope: exact for axis-aligned boxes, and it frames what is really on
 * screen rather than a bounding sphere. */
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _c = new THREE.Vector3();
const _inv = new THREE.Matrix4(), _tl = new THREE.Vector3();
const _fit = { dist: 600, dr: 0, du: 0, ok: false };
const isolating = () => P.some(p => p.ghost);

function measureFrame() {
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanX = tanY * camera.aspect;
  _f.copy(camera.position).sub(controls.target);
  if (_f.lengthSq() < 1e-8) _f.set(0.58, 0.40, 1);
  _f.normalize();
  _r.set(0, 1, 0).cross(_f);
  if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
  _r.normalize();
  _u.copy(_f).cross(_r).normalize();
  _inv.copy(group.matrixWorld).invert();
  _tl.copy(controls.target).applyMatrix4(_inv);
  const fx = _f.x, fy = _f.y, fz = _f.z, rx = _r.x, ry = _r.y, rz = _r.z, ux = _u.x, uy = _u.y, uz = _u.z;
  _f.transformDirection(_inv); _r.transformDirection(_inv); _u.transformDirection(_inv);
  const Fx = _f.x, Fy = _f.y, Fz = _f.z, Rx = _r.x, Ry = _r.y, Rz = _r.z, Ux = _u.x, Uy = _u.y, Uz = _u.z;
  _f.set(fx, fy, fz); _r.set(rx, ry, rz); _u.set(ux, uy, uz);

  let rmin = Infinity, rmax = -Infinity, umin = Infinity, umax = -Infinity, fmax = -Infinity, any = false;
  const take = (lx, ly, lz, hx, hy, hz) => {
    any = true;
    const rM = (Rx > 0 ? hx : lx) * Rx + (Ry > 0 ? hy : ly) * Ry + (Rz > 0 ? hz : lz) * Rz;
    const rm = (Rx > 0 ? lx : hx) * Rx + (Ry > 0 ? ly : hy) * Ry + (Rz > 0 ? lz : hz) * Rz;
    const uM = (Ux > 0 ? hx : lx) * Ux + (Uy > 0 ? hy : ly) * Uy + (Uz > 0 ? hz : lz) * Uz;
    const um = (Ux > 0 ? lx : hx) * Ux + (Uy > 0 ? ly : hy) * Uy + (Uz > 0 ? lz : hz) * Uz;
    const fM = (Fx > 0 ? hx : lx) * Fx + (Fy > 0 ? hy : ly) * Fy + (Fz > 0 ? hz : lz) * Fz;
    if (rm < rmin) rmin = rm; if (rM > rmax) rmax = rM;
    if (um < umin) umin = um; if (uM > umax) umax = uM;
    if (fM > fmax) fmax = fM;
  };
  if (!P.length) {
    const bb = D.frame.kit_bbox_mm;
    take(bb.min[0] - _tl.x, bb.min[1] - _tl.y, bb.min[2] - _tl.z, bb.max[0] - _tl.x, bb.max[1] - _tl.y, bb.max[2] - _tl.z);
  } else {
    for (const p of P) {
      if (!p.mesh.visible || p.ghost) continue;
      const q = p.mesh.position, b = p.d.bbox;
      take(b.min[0] + q.x - _tl.x, b.min[1] + q.y - _tl.y, b.min[2] + q.z - _tl.z,
           b.max[0] + q.x - _tl.x, b.max[1] + q.y - _tl.y, b.max[2] + q.z - _tl.z);
    }
  }
  if (!any) { _fit.ok = false; return _fit; }
  const halfW = (rmax - rmin) / 2, halfH = (umax - umin) / 2;
  _fit.dr = (rmax + rmin) / 2;
  _fit.du = (umax + umin) / 2;
  const margin = isolating() ? 1.5 : 1.08;
  _fit.dist = Math.max(halfW / tanX, halfH / tanY) * margin + Math.max(0, fmax);
  _fit.ok = true;
  return _fit;
}

function resize() {
  if (!renderer) return;
  const w = $('canvasWrap').clientWidth, h = $('canvasWrap').clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------- loading pool
 * Fetched in assembly order, eight at a time, so the first stage is in first.
 * Progress by bytes, using the sizes measured at build time. A kit switch bumps
 * `gen`, and every worker of the old kit stops at its next await. */
async function loadAll(myGen) {
  const loader = new STLLoader();
  const order = D.stages.flatMap(s => s.parts);
  const queue = order.map(id => D.parts.find(p => p.id === id)).filter(Boolean);
  for (const p of D.parts) if (!queue.includes(p)) queue.push(p);
  const t0 = performance.now();
  let done = 0, bytes = 0, started = false, failed = 0;
  const total = D.totals.parts, totalBytes = D.totals.bytes;
  const tick = () => {
    $('loadBar').style.width = (100 * bytes / totalBytes).toFixed(1) + '%';
    $('loadNum').textContent = `${done} / ${total} parts · ${mb(bytes)} / ${mb(totalBytes)} MB`;
  };
  tick();
  const kick = () => {
    if (started || REDUCED || myGen !== gen) return;
    started = true; playing = true; $('playBtn').textContent = 'Pause';
  };
  const kickTimer = setTimeout(kick, 900);
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      if (myGen !== gen) return;
      const p = queue[next++];
      try {
        const r = await fetch(D.stl_base + p.file, { cache: 'force-cache' });
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        const buf = await r.arrayBuffer();
        if (myGen !== gen) return;
        addPart(p, loader.parse(buf));
      } catch (e) {
        if (myGen !== gen) return;
        failed++;
        console.warn('[print] could not load ' + p.file + ': ' + e.message);
      }
      done++; bytes += p.bytes; tick();
      if (done >= Math.min(4, total)) kick();
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  clearTimeout(kickTimer);
  if (myGen !== gen) return;
  const secs = (performance.now() - t0) / 1000;
  $('loadOver').classList.add('done');
  const stat = $('loadStat');
  if (stat) stat.innerHTML = `<b>${P.length} of ${total}</b> loaded in <b>${secs.toFixed(1)} s</b> (${mb(bytes)} MB)`
    + (failed ? ` &middot; <b class="bad">${failed} failed to load</b>` : '') + '. All at the shared origin, so no part had to be positioned by hand.';
  if (P.length < total) console.warn('[print] only ' + P.length + ' of ' + total + ' parts loaded');
  kick();
  if (REDUCED) { T = 1; setSlider(); $('playBtn').textContent = 'Play'; }
  fitNow();
}

function addPart(d, geom) {
  geom.computeBoundingSphere();
  const shell = d.kind === 'case' || d.status === 'unprintable';
  const mat = new THREE.MeshStandardMaterial({
    color: partCol(d), roughness: 0.55, metalness: 0.03,
    side: shell ? THREE.DoubleSide : THREE.FrontSide,
    transparent: true, opacity: shell ? 0.42 : 1
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = shell ? 2 : 1;
  group.add(mesh);
  const off = new THREE.Vector3(...d.offset);
  const arc = new THREE.Vector3().crossVectors(off, new THREE.Vector3(0, 0, 1));
  if (arc.lengthSq() < 1e-6) arc.set(1, 0, 0);
  arc.normalize().multiplyScalar(ARC_MM);
  const p = { d, mesh, mat, off, arc, shell, t0: d.t0, t1: Math.max(d.t1, d.t0 + 0.04), local: null, centre: new THREE.Vector3(...d.centre_mm) };
  if (T > p.t0 + 1e-6) p.local = { start: performance.now(), dur: 520 };
  P.push(p);
  byId.set(d.id, p);
  place(p, performance.now());
  paint(p);
  applyVisibility(lastVisible);
}

function baseFactor(p) { return 1 - easeOut(clamp01((T - p.t0) / (p.t1 - p.t0))); }
function place(p, now) {
  let f = baseFactor(p);
  if (p.local) {
    const u = (now - p.local.start) / p.local.dur;
    if (u >= 1) p.local = null;
    else f = f + (1 - f) * (1 - easeOut(u));
  }
  const bow = Math.sin(Math.PI * clamp01(1 - f));
  p.mesh.position.copy(p.off).multiplyScalar(f * EXPLODE_MM).addScaledVector(p.arc, bow);
  p.f = f;
}

let lastVisible = null;
function applyVisibility(keep) {
  lastVisible = keep || lastVisible;
  if (!lastVisible) return;
  const hide = $('hideChk').checked;
  const all = lastVisible.size === D.totals.parts;
  for (const p of P) {
    const inSet = lastVisible.has(p.d.id);
    p.ghost = !all && !inSet;
    p.mesh.visible = inSet || !hide || all;
    paint(p);
  }
}

function paint(p) {
  const sel = selected === p.d.id;
  const m = p.mat;
  if (sel) { m.color.setHex(SEL_COL); m.emissive.setHex(SEL_COL); m.emissiveIntensity = 0.5; }
  else { m.color.setHex(partCol(p.d)); m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
  const base = p.shell ? 0.42 : 1;
  const dim = p.ghost && !sel;
  m.opacity = sel ? 1 : dim ? 0.08 : (selected ? base * 0.3 : base);
  m.depthWrite = m.opacity > 0.9;
  m.needsUpdate = true;
}

/* ---------------------------------------------------------------- the frame */
let prev = performance.now();
const vproj = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(80, now - prev); prev = now;
  if (!D) return;
  if (playing && P.length) {
    T += dt / (DUR_MS / speed);
    if (T >= 1) { T = 1; playing = false; $('playBtn').textContent = 'Play'; if (!REDUCED) setSpin(true); }
    setSlider();
  }
  for (const p of P) place(p, now);
  if (spin && !playing) spinner.rotation.y += dt * 0.00016;
  if (autoFrame) applyFit(0.14);
  controls.update();
  renderer.render(scene, camera);
  caption();
  labels();
}

function setSlider() {
  const v = Math.round((1 - T) * 1000);
  $('explode').value = v;
  $('explodeOut').textContent = (v / 10).toFixed(v % 10 ? 1 : 0) + ' %';
}
function setSpin(on) { spin = on && !REDUCED; $('spinChk').checked = spin; }

let lastCap = '';
function caption() {
  let stage = null;
  for (const s of D.stages) if (T >= s.window[0] - 1e-9 && T < s.window[1]) stage = s;
  let head;
  if (!P.length) head = 'Loading';
  else if (T >= 1) head = 'Assembled';
  else if (T <= 0.0001 && !playing) head = 'Fully exploded';
  else head = (stage || D.stages[D.stages.length - 1]).caption;
  const seated = P.reduce((n, p) => n + (p.f < 0.02 ? 1 : 0), 0);
  const c = head + '|' + seated + '|' + D.id;
  if (c === lastCap) return;
  lastCap = c;
  $('capStage').textContent = head;
  const s2 = stage ? ` · ${stage.label}: ${stage.count}` : '';
  $('capCount').textContent = T >= 1
    ? `${seated} of ${D.totals.parts} parts in place${P.length < D.totals.parts ? ` (${D.totals.parts - P.length} still loading)` : ''}`
    : `${seated} of ${D.totals.parts} in place${s2}`;
}

/* The do-not-print parts (and the legacy unprintable sheets) stay labelled in 3D
   through the animation; labels that would overlap are dropped. */
const labelEls = new Map();
function labels() {
  if (!labelHost) return;
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  const want = P.filter(p => (p.d.status === 'donotprint' || p.d.status === 'unprintable' || selected === p.d.id) && p.mesh.visible && p.mat.opacity > 0.25);
  const placed = [], seen = new Set(), cand = [];
  for (const p of want) {
    vproj.copy(p.centre); p.mesh.localToWorld(vproj); vproj.project(camera);
    if (vproj.z > 1 || vproj.z < -1) continue;
    cand.push({ p, x: (vproj.x * 0.5 + 0.5) * w, y: (-vproj.y * 0.5 + 0.5) * h - 15, z: vproj.z });
  }
  cand.sort((a, b) => (selected === b.p.d.id ? 1 : 0) - (selected === a.p.d.id ? 1 : 0) || (a.p.d.status === 'donotprint' ? -1 : 0) || a.z - b.z);
  for (const c of cand) {
    if (c.x < 2 || c.x > w - 2 || c.y < 2 || c.y > h - 2) continue;
    const txt = shortName(c.p.d);
    const bw = 8 + 5.6 * txt.length, bh = 15;
    if (placed.some(q => Math.abs(q.x - c.x) < (q.bw + bw) / 2 && Math.abs(q.y - c.y) < (q.bh + bh) / 2 + 2)) continue;
    placed.push({ x: c.x, y: c.y, bw, bh });
    let el = labelEls.get(c.p.d.id);
    if (!el) { el = document.createElement('div'); labelEls.set(c.p.d.id, el); labelHost.appendChild(el); }
    el.className = 'lab3d' + (selected === c.p.d.id ? ' sel' : c.p.d.status === 'donotprint' ? ' dnp' : '');
    el.textContent = txt;
    el.style.left = c.x.toFixed(0) + 'px';
    el.style.top = c.y.toFixed(0) + 'px';
    el.style.display = '';
    seen.add(c.p.d.id);
  }
  for (const [k, el] of labelEls) if (!seen.has(k)) el.style.display = 'none';
}
function shortName(d) {
  return d.label + (d.status === 'donotprint' ? ' — DO NOT PRINT' : d.status === 'unprintable' ? ' — 0 mm wall' : '');
}

/* ================================================================== controls */
function wireControls() {
  $('playBtn').onclick = () => {
    if (T >= 1) { T = 0; for (const p of P) p.local = null; setSpin(false); playing = true; }
    else playing = !playing;
    if (playing) setSpin(false);
    $('playBtn').textContent = playing ? 'Pause' : 'Play';
  };
  $('replayBtn').onclick = () => { T = 0; for (const p of P) p.local = null; setSpin(false); playing = true; $('playBtn').textContent = 'Pause'; setSlider(); };
  $('speedSel').onchange = e => { speed = parseFloat(e.target.value); };
  $('spinChk').onchange = e => { spin = e.target.checked && !REDUCED; };
  $('fitBtn').onclick = () => { autoFrame = true; fitNow(); };
  $('explode').addEventListener('input', e => {
    T = 1 - e.target.value / 1000;
    playing = false; setSpin(false);
    for (const p of P) p.local = null;
    $('playBtn').textContent = 'Play';
    setSlider();
  });
  $('search').addEventListener('input', renderList);
  $('groupSel').onchange = () => { renderList(); $('list').scrollTop = 0; };
  $('isoSel').onchange = () => { renderList(); $('list').scrollTop = 0; autoFrame = true; };
  $('hideChk').onchange = renderList;
  const pickRow = e => {
    const r = e.target.closest('.row'); if (!r || !r.dataset.id) return;
    markSelected(r.dataset.id === selected ? null : r.dataset.id, false);
  };
  $('list').addEventListener('click', e => { if (e.target.closest('a')) return; pickRow(e); });
  $('list').addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); pickRow(e); });
  if (REDUCED) { $('playBtn').textContent = 'Play'; $('capStage').textContent = 'Assembled'; }
}

function wireCanvas() {
  const el = renderer.domElement;
  let dx = 0, dy = 0, px = 0, py = 0, down = false;
  el.addEventListener('pointerdown', e => { down = true; dx = px = e.clientX; dy = py = e.clientY; setSpin(false); });
  el.addEventListener('pointermove', e => { if (down) { px = e.clientX; py = e.clientY; } });
  el.addEventListener('pointerup', e => { down = false; if (Math.hypot(px - dx, py - dy) > 6) return; pick(e); });
  el.addEventListener('wheel', () => { autoFrame = false; }, { passive: true });
  el.addEventListener('touchstart', e => { if (e.touches.length > 1) autoFrame = false; }, { passive: true });
}

function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(m, camera);
  const hits = raycaster.intersectObjects(P.filter(p => p.mesh.visible && p.mat.opacity > 0.25).map(p => p.mesh), false);
  if (!hits.length) { markSelected(null, false); return; }
  const p = P.find(q => q.mesh === hits[0].object);
  if (p) markSelected(p.d.id === selected ? null : p.d.id, true);
}

function applyFit(k) {
  if (!renderer || !D) return;
  group.updateWorldMatrix(true, false);
  const fit = measureFrame();
  if (!fit.ok) return;
  controls.target.addScaledVector(_r, fit.dr * k).addScaledVector(_u, fit.du * k);
  _c.copy(camera.position).sub(controls.target);
  const len = _c.length() || 1;
  _c.multiplyScalar((len + (fit.dist - len) * k) / len);
  camera.position.copy(controls.target).add(_c);
}
function fitNow() { applyFit(1); applyFit(1); }

document.addEventListener('delphi:theme', () => { if (renderer) resize(); });

/* test hook for the headless check: which kit is showing and how far it got */
window.__printViewer = () => ({ kit: D?.id, parts: D?.totals.parts, loaded: P.length, T, rows: $('list').querySelectorAll('.row[data-id]').length,
  dnp: [...$('list').querySelectorAll('.row.st-donotprint')].map(r => r.dataset.id), failRows: $('failTable').querySelectorAll('tbody tr').length,
  banner: $('bannerGrid').textContent.slice(0, 2000) });
