/* DELPHI printable-kit assembly viewer.
 *
 * Reads print/parts.json (written by dashboard/build-print-view.mjs), loads the
 * 100 binary STL part files from blueprint3d/print/parts/ at their shared
 * origin, and drives everything from ONE number:
 *
 *      T in [0,1]      0 = fully exploded      1 = assembled
 *
 * The explode slider shows 1-T, the assembly animation advances T, and both
 * are the same state, so scrubbing seeks the animation and there is nothing to
 * keep in sync. Each part has its own window [t0,t1] inside T, allocated in the
 * build script from the manifest's `layer` field, so the parts arrive in
 * anatomical order rather than all at once.
 *
 * Nothing under blueprint3d/ is written; the STL files are fetched read-only.
 */
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mb = n => (n / 1048576).toFixed(2);
const kb = n => n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 102400 ? 1 : 0) + ' KB';
const num = n => Number(n).toLocaleString('en-GB');
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ------------------------------------------------------------ layer palette
 * One colour per manifest layer, plus one distinct colour for the parts that
 * cannot be printed. Deliberately not the site accent, which is reserved for
 * the selected part. */
const LAYER = {
  skeleton: { col: 0xc7b893, label: 'Skeleton' },
  muscle:   { col: 0xc4616d, label: 'Muscle' },
  organ:    { col: 0x4e9ec0, label: 'Organ' },
  outer:    { col: 0x8fa3c2, label: 'Outer (skin, eyes, fin membranes)' }
};
const FLAG_COL = 0xe0a24a;        // the 11 zero-thickness sheets
const SEL_COL  = 0x19c3cf;        // the selected part
const hex = n => '#' + n.toString(16).padStart(6, '0');

/* ----------------------------------------------------------------- the data */
let D = null;                      // parts.json
const P = [];                      // live part records
const byObj = new Map();
let selected = null;

/* -------------------------------------------------------------- the state */
let T = 0;                         // 0 exploded .. 1 assembled
let playing = false;
let speed = 1;
let spin = false;
let autoFrame = true;
const DUR_MS = 10000;              // the lead asked for 8-12 s end to end
const EXPLODE_MM = 92;             // how far a unit offset travels at T=0
const ARC_MM = 9;                  // sideways bow on the flight path

const easeOut = u => 1 - Math.pow(1 - u, 3);
const clamp01 = u => u < 0 ? 0 : u > 1 ? 1 : u;

boot();

async function boot() {
  try {
    const r = await fetch('parts.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('parts.json ' + r.status);
    D = await r.json();
  } catch (e) {
    $('loadLine').textContent = 'Could not read parts.json: ' + e.message + '. Run node dashboard/build-print-view.mjs.';
    $('loadOver').hidden = true;
    return;
  }
  fillProse();
  buildIsolate();
  renderList();
  wireControls();
  try { startGL(); } catch (e) { glFailed(e); }
}

/* ======================================================= the prose and tables
 * Every sentence below is assembled out of parts.json, which in turn quotes the
 * manifest and parts-INFO. The page states these facts; it never computes a
 * correction for them. */
function fillProse() {
  const h = D.honesty, u = h.undersize, ev = h.evidence_backed_proportion;

  // The banner carries the short form of each fact; the long form, with its
  // source, is in the sections at the foot of the page that these link to.
  $('hypNote').innerHTML = 'It belongs to a design, not to any described animal, and was generated from a parameter set rather than observed. '
    + 'All 100 parts carry that note. Morphological interpolation, not genetic hybridisation. <a href="#honest">Detail.</a>';
  $('hypNote').title = (h.hypothetical_note || '') + ' ' + (h.morphological_not_genetic || '');

  $('schemNote').innerHTML = 'Only the pectoral fin has evidence behind it: the flying fish&rsquo;s measured median fin length is '
    + `<b>${ev.measured_value}</b> of standard length (Daane et&nbsp;al. 2021). This design uses <b>${ev.design_value}</b>, an assumed delta. `
    + '<a href="#honest">Provenance.</a>';

  $('sizeNote').innerHTML = u
    ? `Measured: the whole-fish bounding box is <b>${u.axis_ratio.map(x => ((x - 1) * 100).toFixed(1) + '%').join(' / ')}</b> larger in X&nbsp;/&nbsp;Y&nbsp;/&nbsp;Z, a mean of <b>${u.parts_smaller_by_percent.toFixed(1)}&nbsp;%</b>; the parts were measured to the skin tip, not the tail&rsquo;s structural base. `
      + '<b>Nothing has been rescaled.</b> <a href="#honest">Why.</a>'
    : 'The whole-fish file could not be measured, so the comparison is missing.';

  $('flagNote').innerHTML = 'They are zero-thickness sheets &mdash; a slicer has nothing to fill &mdash; so each needs a solidify pass of about 0.8&ndash;1.2&nbsp;mm first. '
    + 'They are flagged in amber here, never hidden. <a href="#printability">Which eleven.</a>';
  $('flagNote').title = D.printability.one_line;

  // ---- printability
  $('printLine').innerHTML = `<b>${D.printability.flagged_count} of ${D.totals.parts}</b> parts are zero-thickness single-layer sheets. `
    + `The other <b>${D.printability.closed_manifold ?? D.totals.watertight}</b> are closed manifold solids and print as they stand. `
    + 'The eleven are shown in the 3D view in amber and labelled there, and they are <b>not hidden</b> from the list or the downloads &mdash; they are real files, they just need a thickening pass first.';
  $('printDef').textContent = D.printability.one_line;
  $('printDetail').textContent = D.printability.definition ? 'Definition used: ' + D.printability.definition + ' ' + (D.printability.detail || '') : '';

  const flagged = D.parts.filter(p => p.zero_thickness);
  $('flagTable').innerHTML = '<thead><tr><th>Part</th><th>Object</th>'
    + '<th title="Euler characteristic. 1 means a single-layer disk, i.e. a sheet with no interior.">Euler &chi;</th>'
    + '<th>Open edges</th><th>File</th></tr></thead><tbody>'
    + flagged.map(p => `<tr><td>${esc(p.label)}</td><td class="mono">${esc(p.object)}</td><td>${p.euler ?? '&mdash;'}</td><td>${num(p.boundary_edges ?? 0)}</td>`
      + `<td><a href="${esc(D.stl_base + p.file)}" download>${kb(p.bytes)}</a></td></tr>`).join('')
    + '</tbody>';

  $('notDone').innerHTML = (D.printability.not_done || []).map(s => `<li>${esc(s)}</li>`).join('');
  $('warnList').innerHTML = (D.printability.warnings || []).map(s => `<li>${esc(s)}</li>`).join('');

  // ---- one-piece files
  $('opNote').innerHTML = esc(h.one_piece_note);
  $('opCards').innerHTML = (D.one_piece || []).map(o => `<div class="card">
      <h3>${esc(o.title)}</h3>
      <p class="small mute m0">${esc(o.note)}</p>
      <table style="margin-top:10px"><tbody>
        <tr><th>File</th><td class="mono">${esc(o.file)}</td></tr>
        <tr><th>Size</th><td>${mb(o.bytes)} MB &middot; ${num(o.triangles)} triangles</td></tr>
        <tr><th>Bounding box</th><td>${o.bbox.size.map(n => n.toFixed(1)).join(' &times; ')} mm</td></tr>
      </tbody></table>
      <p class="m0" style="margin-top:10px"><a class="chip ok" href="${esc(D.stl_base + o.file)}" download>Download ${esc(o.file)}</a></p>
    </div>`).join('');

  // ---- the honest detail
  $('sizeBody').innerHTML = u ? `<table><tbody>
      <tr><th>Reassembled kit</th><td>${u.kit_bbox_mm.map(n => n.toFixed(1)).join(' &times; ')} mm</td></tr>
      <tr><th>Whole-fish file</th><td>${u.whole_bbox_mm.map(n => n.toFixed(1)).join(' &times; ')} mm</td></tr>
      <tr><th>Ratio per axis</th><td class="mono">${u.axis_ratio.join(' &middot; ')}</td></tr>
      <tr><th>Mean</th><td><b class="bad">the parts are ${u.parts_smaller_by_percent.toFixed(1)} % smaller</b></td></tr>
    </tbody></table>
    <p class="small" style="margin-top:10px">${esc(u.why)}</p>
    <p class="small"><b>${esc(u.consequence)}</b></p>
    <p class="small mute m0">${esc(u.not_done)}</p>`
    : '<p class="small">The whole-fish file could not be measured.</p>';

  const kindChip = k => `<span class="chip ${k === 'measured' ? 'ok' : k === 'hypothetical' ? 'viol' : 'warn'}">${esc(k)}</span>`;
  $('evBody').innerHTML = `<table><tbody>
      <tr><th>Parameter</th><td class="mono">${esc(ev.parameter)}</td></tr>
      <tr><th>Flying fish, measured</th><td><b>${ev.measured_value}</b> ${kindChip('measured')}</td></tr>
      <tr><th>Zebrafish placeholder</th><td>${ev.zebrafish_placeholder} ${kindChip('assumed')}</td></tr>
      <tr><th>This design uses</th><td><b>${ev.design_value}</b> ${kindChip(ev.design_kind || 'hypothetical')}</td></tr>
      <tr><th>Delta applied</th><td>${esc(ev.delta_applied || '&mdash;')}</td></tr>
    </tbody></table>
    <p class="small" style="margin-top:10px"><b>Why 0.35 and not 0.687:</b> ${esc(ev.delta_reason)}</p>
    <p class="small mute m0">Source of the measured median: ${esc(ev.measured_source)}</p>
    <p class="small mute m0" style="margin-top:6px">So the printed fins are roughly half the length the real flying fish&rsquo;s fins are, and that choice is recorded as hypothetical, not as a measurement.</p>`;

  const hi = D.hierarchy;
  $('hierBody').innerHTML = `<p class="small m0">The kit expresses <b>${esc(hi.tiers)}</b>. Of those tiers, two are manifest fields and one is not:</p>
    <table style="margin-top:10px"><tbody>
      <tr><th>Organ system</th><td>${esc(hi.organ_system_from)}</td></tr>
      <tr><th>Organ</th><td class="warn">${esc(hi.organ_from)}</td></tr>
      <tr><th>Level</th><td>${esc(hi.level_from)}</td></tr>
      <tr><th>Layer</th><td>${esc(hi.layer_from)}</td></tr>
    </tbody></table>
    <p class="small" style="margin-top:10px">${esc(hi.no_system_node)}</p>
    <p class="small mute m0">Assembly order: ${esc(D.animation.order)}. Explode direction: each part moves along a fixed unit vector &mdash; outward from the body axis, with the left half gaining +Y and the right half &minus;Y so the two sides separate, a smaller push along the body axis so the 32 vertebrae and the 24 fin rays string out, and a fan of up to &plusmn;0.5 rad within an organ group so no two of a fin&rsquo;s rays sit on the same line.</p>`;

  $('provBody').innerHTML = `<table><tbody>
      <tr><th>Geometry facts</th><td class="mono">${esc(D.sources.geometry)}</td></tr>
      <tr><th>Anatomy facts</th><td class="mono">${esc(D.sources.anatomy)}</td></tr>
      <tr><th>STL files</th><td class="mono">${esc(D.sources.stl_dir)}</td></tr>
      <tr><th>Bounding boxes</th><td>${esc(D.sources.measured_here)}</td></tr>
      <tr><th>Frame</th><td>${esc(D.frame.axes)}</td></tr>
      <tr><th>Shared origin</th><td>${esc(D.frame.origin || '&mdash;')}</td></tr>
      <tr><th>Units</th><td>${esc(D.units)}</td></tr>
      <tr><th>Kit totals</th><td>${D.totals.parts} parts &middot; ${mb(D.totals.bytes)} MB &middot; ${num(D.totals.triangles)} triangles</td></tr>
    </tbody></table>`;

  $('genLine').textContent = 'Data generated ' + D.generated + '.';
  $('loadLine').innerHTML = `${D.totals.parts} part files, ${mb(D.totals.bytes)} MB, ${num(D.totals.triangles)} triangles in all. `
    + `<span id="loadStat" class="mute">fetching&hellip;</span>`;

  // legend under the transport
  $('legend').innerHTML = Object.entries(LAYER).map(([k, v]) =>
      `<span class="lkey"><i class="lsw" style="background:${hex(v.col)}"></i>${esc(v.label)} <span class="mute">${D.parts.filter(p => p.layer === k).length}</span></span>`).join('')
    + `<span class="lkey"><i class="lsw" style="background:${hex(FLAG_COL)}"></i><b class="warn">Will not print &mdash; zero thickness</b> <span class="mute">${D.printability.flagged_count}</span></span>`
    + `<span class="lkey"><i class="lsw" style="background:${hex(SEL_COL)}"></i>Selected</span>`;
}

/* ================================================================= the list */
function buildIsolate() {
  const sel = $('isoSel');
  const sys = new Map(), org = new Map();
  for (const p of D.parts) {
    const s = p.organ_system === null ? null : p.organ_system;
    sys.set(s, (sys.get(s) || 0) + 1);
    const k = (s === null ? '(organ system not stated)' : s) + ' — ' + (p.organ || '(no organ family)');
    org.set(k, (org.get(k) || 0) + 1);
  }
  const g1 = document.createElement('optgroup'); g1.label = 'One organ system';
  for (const [k, v] of [...sys].sort((a, b) => b[1] - a[1])) {
    const o = document.createElement('option');
    o.value = 'system:' + (k === null ? '\u0000null' : k);
    o.textContent = (k === null ? 'organ system not stated in the manifest' : k) + '  (' + v + ')';
    g1.appendChild(o);
  }
  const g2 = document.createElement('optgroup'); g2.label = 'One organ';
  for (const [k, v] of [...org].sort()) {
    const o = document.createElement('option');
    o.value = 'organ:' + k.split(' — ')[1];
    o.textContent = k + '  (' + v + ')';
    g2.appendChild(o);
  }
  const g3 = document.createElement('optgroup'); g3.label = 'One layer';
  for (const s of D.stages) {
    const o = document.createElement('option');
    o.value = 'layer:' + s.layer;
    o.textContent = s.label + '  (' + s.count + ')';
    g3.appendChild(o);
  }
  const g4 = document.createElement('optgroup'); g4.label = 'Printability';
  for (const [v, t] of [['print:flagged', 'The ' + D.printability.flagged_count + ' that will not print'], ['print:ok', 'The ' + D.totals.watertight + ' watertight solids']]) {
    const o = document.createElement('option'); o.value = v; o.textContent = t; g4.appendChild(o);
  }
  sel.append(g1, g2, g3, g4);
}

function isoTest(iso) {
  if (!iso) return () => true;
  const [k, v] = [iso.slice(0, iso.indexOf(':')), iso.slice(iso.indexOf(':') + 1)];
  if (k === 'system') return p => (v === '\u0000null' ? p.organ_system === null : p.organ_system === v);
  if (k === 'organ') return p => (p.organ || '(no organ family)') === v;
  if (k === 'layer') return p => p.layer === v;
  if (k === 'print') return p => (v === 'flagged' ? p.zero_thickness : !p.zero_thickness);
  return () => true;
}

function visibleSet() {
  const q = $('search').value.trim().toLowerCase();
  const iso = isoTest($('isoSel').value);
  const hay = p => [p.label, p.object, p.ontology_id, p.ontology_label, p.organ, p.organ_system, p.layer, p.level, p.nearest_ancestor]
    .filter(Boolean).join(' ').toLowerCase();
  const out = new Set();
  for (const p of D.parts) if (iso(p) && (!q || hay(p).includes(q))) out.add(p.object);
  return out;
}

function groupsFor(mode, keep) {
  const parts = D.parts.filter(p => keep.has(p.object));
  const order = new Map(D.parts.map((p, i) => [p.object, i]));
  if (mode === 'system') {
    const top = new Map();
    for (const p of parts) {
      const s = p.organ_system === null ? '(organ system not stated in the manifest)' : p.organ_system;
      if (!top.has(s)) top.set(s, new Map());
      const o = p.organ || '(no organ family)';
      if (!top.get(s).has(o)) top.get(s).set(o, []);
      top.get(s).get(o).push(p);
    }
    return [...top].sort((a, b) => count(b[1]) - count(a[1]) || a[0].localeCompare(b[0]))
      .map(([s, organs]) => ({ head: s, n: count(organs), subs: [...organs].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([o, ps]) => ({ head: o, parts: sortp(ps) })) }));
  }
  const key = mode === 'organ' ? (p => p.organ || '(no organ family)')
            : mode === 'layer' ? (p => (LAYER[p.layer]?.label || p.layer || '(no layer)'))
            : (p => p.zero_thickness ? 'Will not print — zero-thickness sheet' : 'Watertight closed solid');
  const m = new Map();
  for (const p of parts) { const k = key(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  let list = [...m];
  if (mode === 'layer') {
    const rank = new Map(D.stages.map((s, i) => [LAYER[s.layer]?.label || s.layer, i]));
    list.sort((a, b) => (rank.get(a[0]) ?? 9) - (rank.get(b[0]) ?? 9));
  } else list.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  return list.map(([k, ps]) => ({ head: k, n: ps.length, subs: [{ head: null, parts: sortp(ps) }] }));

  function count(mm) { let n = 0; for (const v of mm.values()) n += v.length; return n; }
  function sortp(ps) { return ps.sort((a, b) => order.get(a.object) - order.get(b.object)); }
}

function renderList() {
  const keep = visibleSet();
  const mode = $('groupSel').value;
  const groups = groupsFor(mode, keep);
  const html = [];
  for (const g of groups) {
    html.push(`<div class="gh">${esc(g.head)}<span class="n">${g.n}</span></div>`);
    for (const s of g.subs) {
      if (s.head !== null && g.subs.length >= 1 && mode === 'system')
        html.push(`<div class="gh sub">${esc(s.head)}<span class="n">${s.parts.length}</span></div>`);
      for (const p of s.parts) html.push(row(p));
    }
  }
  $('list').innerHTML = html.join('') || '<div class="row" style="cursor:default"><span></span><span class="nm mute">Nothing matches that search.</span><span></span></div>';
  $('listCount').textContent = keep.size + ' of ' + D.totals.parts + ' shown';

  // say where each grouping came from, so a derived tier is never passed off
  // as something the manifest states
  const WHERE = {
    system: 'Grouped by the manifest&rsquo;s <code>organ_system</code>, then by an organ family <b>derived</b> from the object name &mdash; the manifest has no organ-parent field.',
    organ:  'Grouped by an organ family <b>derived</b> from the object name (<code>build-print-view.mjs</code>); the manifest has no organ-parent field.',
    layer:  'Grouped by the manifest&rsquo;s <code>layer</code> field, in the order the animation assembles them.',
    print:  'Grouped by what the geometry is: a closed manifold solid, or a zero-thickness sheet that will not print.'
  };
  const iso = $('isoSel').value;
  $('isoNote').innerHTML = iso
    ? `Isolated: <b>${esc($('isoSel').selectedOptions[0].textContent.trim())}</b>. The other parts stay in the 3D view, ${$('hideChk').checked ? 'hidden' : 'faded'}, so you can see where the group sits.`
    : (WHERE[mode] || '') + ' Greyed text is metadata the manifest does not carry.';
  applyVisibility(keep);
  if (selected) markSelected(selected, false);
}

function row(p) {
  const cls = ['row'];
  if (p.zero_thickness) cls.push('flagged');
  if (!p.ontology_id) cls.push('unev');
  const sw = p.zero_thickness ? FLAG_COL : (LAYER[p.layer]?.col ?? 0x999999);
  const ont = p.ontology_id
    ? `<span title="${esc(p.ontology_label || '')}">${esc(p.ontology_id)}</span>`
    : `<span class="mute" title="${esc(p.ontology_note || 'no ontology id in the manifest')}">no ontology id${p.nearest_ancestor ? ' &middot; nearest: ' + esc(p.nearest_ancestor.split(' ')[0]) : ''}</span>`;
  return `<div class="${cls.join(' ')}" role="option" tabindex="0" data-obj="${esc(p.object)}" aria-selected="false">
    <i class="sw" style="background:${hex(sw)}"></i>
    <span class="nm">${esc(p.label)}<span class="obj">${esc(p.object)}</span>
      <span class="meta">${ont}<span>${num(p.triangles)} tri</span><span>${kb(p.bytes)}</span>${p.level === 'tissue' ? '<span class="chip">tissue</span>' : ''}${p.zero_thickness ? '<span class="chip warn">will not print</span>' : ''}</span></span>
    <a class="dl" href="${esc(D.stl_base + p.file)}" download title="Download ${esc(p.object)}.stl">STL</a>
  </div>`;
}

/* ------------------------------------------------------------- the selection */
function markSelected(obj, scroll) {
  selected = obj;
  for (const el of $('list').querySelectorAll('.row')) {
    const on = el.dataset.obj === obj;
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  for (const p of P) if (p.mesh) paint(p);
  const d = D.parts.find(p => p.object === obj);
  const box = $('selBox');
  if (!d) { box.hidden = true; return; }
  box.hidden = false;
  // a signed-tetrahedron volume means nothing for an open sheet, and comes out
  // negative for some of them, so it is only shown for the closed solids
  const vol = d.watertight && d.volume_mm3
    ? ' &middot; ' + d.volume_mm3.toFixed(1) + ' mm&sup3;'
    : ' <span class="mute">&middot; no enclosed volume (open shell)</span>';
  box.innerHTML = `<button class="close" id="selClose" type="button">Clear</button>
    <h4>${esc(d.label)} ${d.zero_thickness ? '<span class="chip warn">will not print</span>' : ''}</h4>
    <dl>
      <dt>Object</dt><dd class="mono">${esc(d.object)}</dd>
      <dt>Hierarchy</dt><dd>${esc(d.organ_system === null ? 'organ system not stated' : d.organ_system)} &rarr; ${esc(d.organ || 'no organ family')} &rarr; ${esc(d.level || '?')}</dd>
      <dt>Layer / side</dt><dd>${esc(LAYER[d.layer]?.label || d.layer)} &middot; ${esc({ L: 'left', R: 'right', mid: 'midline' }[d.side] || d.side || '?')}</dd>
      <dt>Ontology</dt><dd>${d.ontology_id ? esc(d.ontology_id) + ' ' + esc(d.ontology_label || '') : '<span class="mute">none in the manifest' + (d.nearest_ancestor ? '; nearest ancestor ' + esc(d.nearest_ancestor) : '') + '</span>'}</dd>
      <dt>Mesh</dt><dd>${num(d.triangles)} triangles &middot; ${kb(d.bytes)} &middot; ${d.watertight ? '<span class="ok">watertight</span>' : '<span class="warn">open, &chi; = ' + d.euler + ', ' + num(d.boundary_edges) + ' boundary edges</span>'}</dd>
      <dt>Size</dt><dd>${d.bbox.size.map(n => n.toFixed(1)).join(' &times; ')} mm${vol}</dd>
      <dt>Basis</dt><dd class="mute">${esc(d.geometry_basis || 'not stated')}</dd>
      ${d.note ? `<dt>Note</dt><dd class="mute">${esc(d.note)}</dd>` : ''}
      ${d.driven_by.length ? `<dt>Driven by</dt><dd class="mono mute">${d.driven_by.map(esc).join(', ')}</dd>` : ''}
    </dl>
    <p class="m0" style="margin-top:8px"><a class="chip ok" href="${esc(D.stl_base + d.file)}" download>Download ${esc(d.object)}.stl</a></p>`;
  $('selClose').onclick = () => { selected = null; markSelected(null, false); };

  /* Scroll the list itself, not the page: picking a part in 3D must not jerk
     the view you are looking at out from under you, which scrollIntoView does.
     Done last, because opening this panel shortens the list it scrolls in. */
  if (!scroll) return;
  const el = $('list').querySelector(`.row[data-obj="${CSS.escape(obj)}"]`);
  if (!el) return;
  const list = $('list'), br = list.getBoundingClientRect(), er = el.getBoundingClientRect();
  const HEAD = 30;                                  // room for the sticky group heading
  if (er.top < br.top + HEAD || er.bottom > br.bottom - 6) {
    list.scrollTop += (er.top - br.top) - Math.max(HEAD, (list.clientHeight - er.height) / 2);
  }
}

/* ================================================================ the 3D view */
let renderer, scene, camera, controls, group, raycaster, labelHost;

function glFailed(e) {
  console.warn('[print] 3D view unavailable:', e);
  $('glFail').hidden = false;
  $('loadOver').hidden = true;
  $('caption').hidden = true;
}

function startGL() {
  const canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearAlpha(0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 1, 6000);

  // Lighting: the STLs carry face normals and no colour, so the shape has to be
  // read entirely off the shading. A hemisphere fill plus two directionals.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a58, 0.85));
  const k = new THREE.DirectionalLight(0xffffff, 1.15); k.position.set(1.1, 1.5, 1.6); scene.add(k);
  const f = new THREE.DirectionalLight(0xffffff, 0.45); f.position.set(-1.3, -0.6, -1.0); scene.add(f);

  group = new THREE.Group();
  // the kit's shared origin is not its centre, so shift it to orbit sensibly
  const c = D.frame.kit_centre_mm;
  group.position.set(-c[0], -c[1], -c[2]);
  const pivot = new THREE.Group();        // carries the rest-state spin
  pivot.add(group);
  // print frame is Z-up; three.js is Y-up, so stand the fish upright
  pivot.rotation.x = -Math.PI / 2;
  const spinner = new THREE.Group();
  spinner.add(pivot);
  scene.add(spinner);
  scene.userData.spinner = spinner;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 60;
  controls.maxDistance = 2200;

  raycaster = new THREE.Raycaster();
  labelHost = $('labels');

  /* Framing. A bounding sphere overshoots badly here: the kit is 132 mm long
     and 47 mm deep, and the exploded cloud is wider still, so fitting a sphere
     leaves the fish small in a wide canvas. Instead keep the eight corners of
     the assembled box and of the exploded cloud, and solve for the camera
     distance that puts them inside the real frustum, horizontal and vertical. */
  camera.position.set(0.58, 0.40, 1).normalize().multiplyScalar(600);

  resize();
  new ResizeObserver(resize).observe($('canvasWrap'));
  wireCanvas();

  T = REDUCED ? 1 : 0;
  playing = false;
  setSlider();
  renderer.setAnimationLoop(frame);
  loadAll();
}

/* ------------------------------------------------------------------- framing
 * Fitting a bounding sphere, or even the eight corners of the union box, leaves
 * the kit small: a 3/4 view of a 132 x 76 x 47 mm cloud is nothing like a
 * sphere, and the union box has corners no part occupies. So measure the real
 * screen-space extent instead: project each part's own box onto the camera's
 * right/up/forward axes and take the envelope. For an axis-aligned box the
 * extreme of a linear functional is exact and costs three multiplies, so this
 * is 100 parts x 3 axes once a frame, no allocation and no 800-point loop.
 *
 * It returns both the distance that just contains everything and the offset
 * that centres it, so the view neither clips a flying part nor drifts.
 */
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _c = new THREE.Vector3();
const _inv = new THREE.Matrix4(), _tl = new THREE.Vector3();
const _fit = { dist: 600, dr: 0, du: 0, ok: false };

const isolating = () => P.some(p => p.ghost);

function measureFrame(boxesOnly) {
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanX = tanY * camera.aspect;
  // camera basis, in world space
  _f.copy(camera.position).sub(controls.target);
  if (_f.lengthSq() < 1e-8) _f.set(0.58, 0.40, 1);
  _f.normalize();
  _r.set(0, 1, 0).cross(_f);
  if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
  _r.normalize();
  _u.copy(_f).cross(_r).normalize();

  // the same basis and the orbit target, expressed in the print frame, so the
  // per-part arithmetic below can stay in the coordinates the data is already in
  _inv.copy(group.matrixWorld).invert();
  _tl.copy(controls.target).applyMatrix4(_inv);
  const fx = _f.x, fy = _f.y, fz = _f.z, rx = _r.x, ry = _r.y, rz = _r.z, ux = _u.x, uy = _u.y, uz = _u.z;
  _f.transformDirection(_inv); _r.transformDirection(_inv); _u.transformDirection(_inv);
  const Fx = _f.x, Fy = _f.y, Fz = _f.z, Rx = _r.x, Ry = _r.y, Rz = _r.z, Ux = _u.x, Uy = _u.y, Uz = _u.z;
  _f.set(fx, fy, fz); _r.set(rx, ry, rz); _u.set(ux, uy, uz);   // restore the world basis

  let rmin = Infinity, rmax = -Infinity, umin = Infinity, umax = -Infinity, fmax = -Infinity, any = false;
  const take = (lx, ly, lz, hx, hy, hz) => {
    any = true;
    // max of v.d over the box = sum over axes of (d>0 ? hi : lo) * d
    const rM = (Rx > 0 ? hx : lx) * Rx + (Ry > 0 ? hy : ly) * Ry + (Rz > 0 ? hz : lz) * Rz;
    const rm = (Rx > 0 ? lx : hx) * Rx + (Ry > 0 ? ly : hy) * Ry + (Rz > 0 ? lz : hz) * Rz;
    const uM = (Ux > 0 ? hx : lx) * Ux + (Uy > 0 ? hy : ly) * Uy + (Uz > 0 ? hz : lz) * Uz;
    const um = (Ux > 0 ? lx : hx) * Ux + (Uy > 0 ? ly : hy) * Uy + (Uz > 0 ? lz : hz) * Uz;
    const fM = (Fx > 0 ? hx : lx) * Fx + (Fy > 0 ? hy : ly) * Fy + (Fz > 0 ? hz : lz) * Fz;
    if (rm < rmin) rmin = rm;
    if (rM > rmax) rmax = rM;
    if (um < umin) umin = um;
    if (uM > umax) umax = uM;
    if (fM > fmax) fmax = fM;
  };

  if (boxesOnly || !P.length) {
    const bb = D.frame.kit_bbox_mm;
    take(bb.min[0] - _tl.x, bb.min[1] - _tl.y, bb.min[2] - _tl.z,
         bb.max[0] - _tl.x, bb.max[1] - _tl.y, bb.max[2] - _tl.z);
  } else {
    for (const p of P) {
      // faded parts are context, not subject: isolating a group frames that
      // group, and the rest of the kit stays behind it as a ghost
      if (!p.mesh.visible || p.ghost) continue;
      const q = p.mesh.position, b = p.d.bbox;
      take(b.min[0] + q.x - _tl.x, b.min[1] + q.y - _tl.y, b.min[2] + q.z - _tl.z,
           b.max[0] + q.x - _tl.x, b.max[1] + q.y - _tl.y, b.max[2] + q.z - _tl.z);
    }
  }
  if (!any) { _fit.ok = false; return _fit; }

  const halfW = (rmax - rmin) / 2, halfH = (umax - umin) / 2;
  _fit.dr = (rmax + rmin) / 2;          // how far the cloud sits off-centre
  _fit.du = (umax + umin) / 2;
  // a wider margin when a group is isolated, so the ghost kit around it still reads
  const margin = isolating() ? 1.5 : 1.08;
  _fit.dist = Math.max(halfW / tanX, halfH / tanY) * margin + Math.max(0, fmax);
  _fit.ok = true;
  return _fit;
}

function resize() {
  const w = $('canvasWrap').clientWidth, h = $('canvasWrap').clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------- loading pool
 * 100 requests for 2.9 MB. Fetched in assembly order, eight at a time, so the
 * skeleton is in first and the animation has something true to show early.
 * Progress is by bytes, using the sizes already measured at build time. */
async function loadAll() {
  const loader = new STLLoader();
  const order = D.stages.flatMap(s => s.parts);
  const queue = order.map(o => D.parts.find(p => p.object === o)).filter(Boolean);
  for (const p of D.parts) if (!queue.includes(p)) queue.push(p);   // safety net

  const t0 = performance.now();
  let done = 0, bytes = 0, started = false;
  const total = D.totals.parts, totalBytes = D.totals.bytes;
  const bar = $('loadBar'), numEl = $('loadNum');

  const tick = () => {
    bar.style.width = (100 * bytes / totalBytes).toFixed(1) + '%';
    numEl.textContent = `${done} / ${total} parts · ${mb(bytes)} / ${mb(totalBytes)} MB`;
  };
  tick();

  // start moving as soon as there is something to move, without waiting for 100
  const kick = () => {
    if (started || REDUCED) return;
    started = true;
    playing = true;
    $('playBtn').textContent = 'Pause';
  };
  const kickTimer = setTimeout(kick, 900);

  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const p = queue[next++];
      try {
        const r = await fetch(D.stl_base + p.file, { cache: 'force-cache' });
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        const buf = await r.arrayBuffer();
        addPart(p, loader.parse(buf));
      } catch (e) {
        console.warn('[print] could not load ' + p.file + ': ' + e.message);
      }
      done++; bytes += p.bytes; tick();
      if (done >= Math.min(8, total)) kick();
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  clearTimeout(kickTimer);

  const secs = (performance.now() - t0) / 1000;
  $('loadOver').classList.add('done');
  const stat = $('loadStat');
  if (stat) stat.innerHTML = `<b>${P.length} of ${total}</b> loaded in <b>${secs.toFixed(1)} s</b> over ${total} requests `
    + `(${mb(bytes)} MB). All at the shared origin, so no part had to be positioned by hand.`;
  if (P.length < total) console.warn('[print] only ' + P.length + ' of ' + total + ' parts loaded');
  kick();
  if (REDUCED) { T = 1; setSlider(); $('playBtn').textContent = 'Play'; }
  fitNow();
}

function addPart(d, geom) {
  geom.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    color: d.zero_thickness ? FLAG_COL : (LAYER[d.layer]?.col ?? 0x9aa39f),
    roughness: d.zero_thickness ? 0.85 : 0.52,
    metalness: 0.03,
    flatShading: false,
    side: d.zero_thickness ? THREE.DoubleSide : THREE.FrontSide,
    transparent: true,
    // The eleven sheets are the outermost pieces, so opaque they would hide the
    // whole kit behind them. Held translucent: the flag stays visible, and so
    // does what it wraps. Their real wall thickness is zero, which is the point.
    opacity: d.zero_thickness ? 0.5 : 1
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = d.zero_thickness ? 2 : 1;
  group.add(mesh);

  const off = new THREE.Vector3(...d.offset);
  // a short bow across the flight path, so a part arcs in rather than sliding
  const arc = new THREE.Vector3().crossVectors(off, new THREE.Vector3(0, 0, 1));
  if (arc.lengthSq() < 1e-6) arc.set(1, 0, 0);
  arc.normalize().multiplyScalar(ARC_MM);

  const p = {
    d, mesh, mat, off, arc,
    t0: d.t0, t1: Math.max(d.t1, d.t0 + 0.04),
    local: null,
    centre: new THREE.Vector3(...d.centre_mm)
  };
  // a part that arrives after its own window has opened flies in from where it
  // is now, over half a second of real time, rather than popping into place
  if (T > p.t0 + 1e-6) p.local = { start: performance.now(), dur: 520 };
  P.push(p);
  byObj.set(d.object, p);
  place(p, performance.now());
  paint(p);
  applyVisibility(lastVisible);
}

/* ----------------------------------------------------- position and material */
function baseFactor(p) { return 1 - easeOut(clamp01((T - p.t0) / (p.t1 - p.t0))); }

function place(p, now) {
  let f = baseFactor(p);
  if (p.local) {
    const u = (now - p.local.start) / p.local.dur;
    if (u >= 1) p.local = null;
    else f = f + (1 - f) * (1 - easeOut(u));      // blend from fully out to its T position
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
    const inSet = lastVisible.has(p.d.object);
    p.ghost = !all && !inSet;
    p.mesh.visible = inSet || !hide || !!all;
    paint(p);
  }
}

function paint(p) {
  const sel = selected === p.d.object;
  const m = p.mat;
  if (sel) { m.color.setHex(SEL_COL); m.emissive.setHex(SEL_COL); m.emissiveIntensity = 0.5; }
  else {
    m.color.setHex(p.d.zero_thickness ? FLAG_COL : (LAYER[p.d.layer]?.col ?? 0x9aa39f));
    m.emissive.setHex(0x000000); m.emissiveIntensity = 0;
  }
  const base = p.d.zero_thickness ? 0.5 : 1;
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

  if (playing && P.length) {
    T += (dt / (DUR_MS / speed));
    if (T >= 1) { T = 1; playing = false; $('playBtn').textContent = 'Play'; if (!REDUCED) setSpin(true); }
    setSlider();
  }

  for (const p of P) place(p, now);

  // rest-state spin, about the dorsoventral axis
  const spinner = scene.userData.spinner;
  if (spin && !playing) spinner.rotation.y += dt * 0.00016;

  /* The camera pulls in as the kit assembles, unless the viewer has zoomed.
     Fitted to where the parts actually are this frame, not to an interpolation
     between the assembled and exploded extremes: the cloud is not halfway out
     at T = 0.5, so interpolating clips pieces off the edge of the view. */
  if (autoFrame) applyFit(0.14);

  controls.update();
  renderer.render(scene, camera);
  caption();
  labels();
}

function setSlider() {
  const v = Math.round((1 - T) * 1000);
  $('explode').value = v;
  $('explodeOut').textContent = (v / 10).toFixed(v % 10 ? 1 : 0) + ' %';
}

function setSpin(on) { spin = on && !REDUCED; $('spinChk').checked = spin; }

/* ---------------------------------------------------------- the stage caption
 * Which layer is arriving, and how many parts are already seated. */
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
  const cap = head + '|' + seated;
  if (cap === lastCap) return;
  lastCap = cap;
  $('capStage').textContent = head;
  const s2 = stage ? ` · ${stage.label}: ${stage.count} parts` : '';
  $('capCount').textContent = T >= 1
    ? `${seated} of ${D.totals.parts} parts in place${P.length < D.totals.parts ? ` (${D.totals.parts - P.length} still loading)` : ''}`
    : `${seated} of ${D.totals.parts} in place${s2}`;
}

/* -------------------------------------------------------- the 3D labels
 * The eleven unprintable sheets stay labelled through the animation, not only
 * at rest. Labels that would overlap an already-placed one are dropped, so the
 * cluster at full assembly stays readable. */
const labelEls = new Map();
function labels() {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  const want = P.filter(p => (p.d.zero_thickness || selected === p.d.object) && p.mesh.visible && p.mat.opacity > 0.25);
  const placed = [];
  const seen = new Set();
  const cand = [];
  for (const p of want) {
    vproj.copy(p.centre); p.mesh.localToWorld(vproj); vproj.project(camera);
    if (vproj.z > 1 || vproj.z < -1) continue;
    // sit the label just above the part rather than on top of it
    cand.push({ p, x: (vproj.x * 0.5 + 0.5) * w, y: (-vproj.y * 0.5 + 0.5) * h - 15, z: vproj.z });
  }
  cand.sort((a, b) => (selected === b.p.d.object ? 1 : 0) - (selected === a.p.d.object ? 1 : 0) || a.z - b.z);
  for (const c of cand) {
    if (c.x < 2 || c.x > w - 2 || c.y < 2 || c.y > h - 2) continue;
    const bw = 8 + 5.6 * shortName(c.p.d).length, bh = 15;
    if (placed.some(q => Math.abs(q.x - c.x) < (q.bw + bw) / 2 && Math.abs(q.y - c.y) < (q.bh + bh) / 2 + 2)) continue;
    placed.push({ x: c.x, y: c.y, bw, bh });
    let el = labelEls.get(c.p.d.object);
    if (!el) { el = document.createElement('div'); labelEls.set(c.p.d.object, el); labelHost.appendChild(el); }
    el.className = 'lab3d' + (selected === c.p.d.object ? ' sel' : '');
    el.textContent = shortName(c.p.d);
    el.style.left = c.x.toFixed(0) + 'px';
    el.style.top = c.y.toFixed(0) + 'px';
    el.style.display = '';
    seen.add(c.p.d.object);
  }
  for (const [k, el] of labelEls) if (!seen.has(k)) el.style.display = 'none';
}
function shortName(d) {
  return d.object.replace(/_/g, ' ') + (d.zero_thickness ? ' — 0 mm wall' : '');
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

  const sl = $('explode');
  const onScrub = () => {
    T = 1 - sl.value / 1000;
    playing = false; setSpin(false);
    for (const p of P) p.local = null;         // scrubbing is deterministic
    $('playBtn').textContent = 'Play';
    setSlider();
  };
  sl.addEventListener('input', onScrub);

  $('search').addEventListener('input', renderList);
  // changing what the list is grouped by, or what is isolated, starts a new
  // reading of it, so send the scroller back to the top
  $('groupSel').onchange = () => { renderList(); $('list').scrollTop = 0; };
  $('isoSel').onchange = () => { renderList(); $('list').scrollTop = 0; autoFrame = true; };
  $('hideChk').onchange = renderList;

  $('list').addEventListener('click', e => {
    const a = e.target.closest('a'); if (a) return;          // let a download be a download
    const r = e.target.closest('.row'); if (!r || !r.dataset.obj) return;
    markSelected(r.dataset.obj === selected ? null : r.dataset.obj, false);
  });
  $('list').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const r = e.target.closest('.row'); if (!r || !r.dataset.obj) return;
    e.preventDefault();
    markSelected(r.dataset.obj === selected ? null : r.dataset.obj, false);
  });

  if (REDUCED) { $('playBtn').textContent = 'Play'; $('capStage').textContent = 'Assembled'; }
}

function wireCanvas() {
  const el = renderer.domElement;
  let dx = 0, dy = 0, px = 0, py = 0, down = false;
  el.addEventListener('pointerdown', e => { down = true; dx = px = e.clientX; dy = py = e.clientY; setSpin(false); });
  el.addEventListener('pointermove', e => { if (down) { px = e.clientX; py = e.clientY; } });
  el.addEventListener('pointerup', e => {
    down = false;
    if (Math.hypot(px - dx, py - dy) > 6) return;            // that was a drag
    pick(e);
  });
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
  if (p) markSelected(p.d.object === selected ? null : p.d.object, true);
}

/* Pull the camera toward the distance and centre that `measureFrame` asked for.
   `k` is how much of the correction to take this frame: a fraction while the
   assembly plays, 1 for the Reframe button. */
function applyFit(k) {
  if (!renderer) return;
  group.updateWorldMatrix(true, false);
  const fit = measureFrame(false);
  if (!fit.ok) return;
  // slide the orbit target sideways and up until the cloud is screen-centred
  controls.target.addScaledVector(_r, fit.dr * k).addScaledVector(_u, fit.du * k);
  _c.copy(camera.position).sub(controls.target);
  const len = _c.length() || 1;
  _c.multiplyScalar((len + (fit.dist - len) * k) / len);
  camera.position.copy(controls.target).add(_c);
}
function fitNow() { applyFit(1); applyFit(1); }   // twice: the basis moves with the target

/* keep the labels' colours in step with a theme switch (they use CSS vars, so
   nothing to do) and re-measure the canvas, which the shell's bar can shift */
document.addEventListener('delphi:theme', () => { if (renderer) resize(); });
