/* gene-diff/app.js — renders dashboard/public/gene-diff/data.json as five expanding scales.
 *
 * It renders values; it never computes a biological one. Where data.json carries an
 * {absent:true, what, why, source} object, this file draws a stated absence in place of the
 * thing, because a gap that renders as blank reads as identity.
 *
 * Nothing about a gene, an organism or a part is hardcoded: every case, gene and row comes
 * out of data.json, so a new case with no sequence data renders as a stated absence without
 * a line changing here.
 */
'use strict';

/* ------------------------------------------------------------------- small dom */
const el = (tag, attrs, kids) => {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of [].concat(kids || [])) {
    if (k == null || k === false) continue;
    n.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return n;
};
const frag = kids => { const f = document.createDocumentFragment(); for (const k of [].concat(kids || [])) if (k) f.appendChild(k); return f; };
const num = n => (n == null ? '—' : typeof n === 'number' ? n.toLocaleString('en-GB', { maximumFractionDigits: 4 }) : String(n));
const pct = n => (n == null ? '—' : `${n}%`);

/* a stated absence — the single most important component on this page */
function absent(a) {
  if (!a) return null;
  return el('div', { class: 'absent' }, [
    el('b', { text: `not here: ${a.what || 'this'}` }),
    el('p', { text: a.why || 'no reason recorded' }),
    a.source ? el('span', { class: 'src', text: a.source }) : null,
  ]);
}
const isAbsent = v => !!(v && v.absent);

function chips(list) {
  const kids = list.filter(Boolean).map(([t, cls]) => el('span', { class: 'chip' + (cls ? ' ' + cls : ''), text: t }));
  return kids.length ? el('div', { class: 'chips' }, kids) : null;
}

function kvTable(rows, head) {
  const body = rows.filter(r => r && r[1] != null && r[1] !== '').map(([k, v, cls]) =>
    el('tr', null, [el('th', { text: k }), el('td', { class: cls || null, text: String(v) })]));
  if (!body.length) return null;
  return el('div', { class: 'scroll' }, el('table', { class: 'kv' }, frag([
    head ? el('caption', { class: 'tiny mute', style: 'text-align:left;padding-bottom:4px', text: head }) : null,
    el('tbody', null, frag(body)),
  ])));
}

/* ------------------------------------------------------------------ the legend */
const MEANING = {
  edit: { label: 'the edit', glyph: '▲', cls: 'sw-edit' },
  allele: { label: 'known allele or convergent site', glyph: '◆', cls: 'sw-allele' },
  ptm: { label: 'modification site', glyph: '●', cls: 'sw-ptm' },
  domain: { label: 'inside an annotated domain', glyph: '▬', cls: 'sw-domain' },
  silent: { label: 'no amino-acid change', glyph: '○', cls: 'sw-silent' },
  unannotated: { label: 'difference with no annotation at that site', glyph: '·', cls: 'sw-unann' },
  gap: { label: 'no residue in one row — a gap, not a difference', glyph: '–', cls: 'sw-gap' },
};
function legend(counts) {
  const kids = Object.entries(MEANING).map(([k, m]) => {
    const n = counts ? counts[k] : null;
    return el('span', null, [
      el('i', { class: 'swatch ' + m.cls, text: m.glyph, 'aria-hidden': 'true' }),
      `${m.label}${n != null ? ` (${n})` : ''}`,
    ]);
  });
  kids.push(el('span', { class: 'tiny', style: 'flex-basis:100%', text:
    'Colour marks what kind of site a difference falls on, never which residue it is, and it always carries a glyph and a word. A column is counted as differing when the base, the generated protein or the analogue orthologue disagree; the proxy row is context and takes no part in that.' }));
  return el('div', { class: 'legend', role: 'list' }, frag(kids));
}

/* ========================================================== the alignment view
 * Virtualised: only the visible column window is in the DOM, so a 1,451-column
 * alignment costs the same as a 400-column one. Keyboard: the track takes focus,
 * arrow keys walk columns and the readout below speaks the column.
 */
function alignmentView(g, onOpenColumn) {
  const CELL = 12;
  const cols = g.columns;
  const rows = g.rows.filter(r => !isAbsent(r) && r.seq);
  const meaningByCol = new Map(g.diffs.map(d => [d.col, d]));
  const annotatedSet = new Set(g.annotatedCols || []);

  /* domain bands and PTM pins, as a band row under the sequences */
  const domainAt = new Array(cols + 2).fill(null);
  for (const d of g.tracks.domains) for (let c = d.colStart; c <= d.colEnd; c++) domainAt[c] = d;
  const ptmAt = new Map(g.tracks.ptm.filter(p => p.col).map(p => [p.col, p]));

  const labels = el('div', { class: 'alnlabels' });
  labels.appendChild(el('div', { class: 'lrow r-ruler' }, el('span', { class: 'rl', text: 'column' })));
  for (const r of rows) {
    labels.appendChild(el('div', { class: 'lrow r-' + r.role, title: `${r.species} ${r.proteinId || ''}` }, [
      el('span', { class: 'rl', text: r.label }),
      el('span', { class: 'mute tiny', text: r.common || '' }),
    ]));
  }
  labels.appendChild(el('div', { class: 'lrow r-ann' }, el('span', { class: 'rl', text: 'domain / site' })));

  const canvas = el('div', { class: 'alncanvas' });
  canvas.style.width = cols * CELL + 'px';
  const rowCount = rows.length + 2;
  canvas.style.setProperty('--aln-h', rowCount * 20 + 'px');
  canvas.style.height = rowCount * 20 + 'px';

  const track = el('div', { class: 'alntrack', tabindex: '0', role: 'application',
    'aria-label': `Alignment of ${g.gene}: ${cols} columns, ${rows.length} rows. Use the left and right arrow keys to walk columns, Enter to expand the site.` },
    canvas);
  const readout = el('div', { class: 'readout', id: `ro-${g.gene}`, role: 'status', 'aria-live': 'polite' });

  const rowDivs = [el('div', { class: 'arow', style: 'top:0px' })];
  for (let i = 0; i < rows.length; i++) rowDivs.push(el('div', { class: 'arow', style: `top:${(i + 1) * 20}px` }));
  rowDivs.push(el('div', { class: 'arow', style: `top:${(rows.length + 1) * 20}px` }));
  for (const d of rowDivs) canvas.appendChild(d);

  let cursor = (g.annotatedCols && g.annotatedCols.length) ? g.annotatedCols[0] : 1;
  let winFrom = 1, winTo = 0;

  function paint() {
    const w = track.clientWidth || 360;
    const first = Math.max(1, Math.floor(track.scrollLeft / CELL) - 8);
    const last = Math.min(cols, first + Math.ceil(w / CELL) + 16);
    if (first === winFrom && last === winTo) return;
    winFrom = first; winTo = last;
    const off = (first - 1) * CELL;

    /* ruler */
    const ruler = rowDivs[0];
    ruler.textContent = ''; ruler.style.transform = `translateX(${off}px)`;
    for (let c = first; c <= last; c++) {
      const tick = c % 10 === 0;
      ruler.appendChild(el('span', { class: 'rulecell' + (tick ? ' tick' : ''), text: tick ? String(c) : '' }));
    }
    /* sequence rows */
    for (let i = 0; i < rows.length; i++) {
      const div = rowDivs[i + 1], r = rows[i];
      div.textContent = ''; div.style.transform = `translateX(${off}px)`;
      for (let c = first; c <= last; c++) {
        const ch = r.seq[c - 1] || ' ';
        const d = meaningByCol.get(c);
        let cls = 'cell';
        if (ch === '-' || ch === '.') cls += ' gap';
        if (d) {
          /* a gap column marks only the row that is missing a residue; the row that has one
             is not divergent there and must not be dimmed as though it were */
          const differsHere = d.meaning === 'gap'
            ? (ch === '-' || ch === '.')
            : (r.role === 'generated' && d.genDiff) ||
              (r.role === 'analogue' && d.anaDiff) ||
              (r.role === 'base' && (d.genDiff || d.anaDiff));
          if (differsHere) cls += ' d m-' + d.meaning;
        }
        if (c === cursor) cls += ' cursor';
        div.appendChild(el('span', { class: cls, text: ch }));
      }
    }
    /* domain / site band */
    const band = rowDivs[rows.length + 1];
    band.textContent = ''; band.style.transform = `translateX(${off}px)`;
    for (let c = first; c <= last; c++) {
      const p = ptmAt.get(c);
      band.appendChild(el('span', {
        class: 'anncell' + (p ? ' ptm' : domainAt[c] ? ' has' : ''),
        title: p ? `${p.residue}${p.pos} ${p.modification}` : domainAt[c] ? domainAt[c].name : '',
      }));
    }
  }

  function describe(c) {
    const d = meaningByCol.get(c);
    const bits = [el('span', { class: 'k', text: `column ${c}` })];
    const basePos = d ? d.pos : null;
    const parts = [];
    for (const r of rows) parts.push(`${r.label} ${r.seq[c - 1] || ' '}`);
    bits.push(document.createTextNode(` · ${parts.join('  ')}`));
    if (basePos) bits.push(document.createTextNode(` · base position ${basePos}`));
    if (d) {
      const m = MEANING[d.meaning];
      bits.push(el('b', { text: ` · ${m.glyph} ${m.label}` }));
      if (d.edit) bits.push(document.createTextNode(` — the edit: ${d.edit.from}${d.edit.pos}${d.edit.to}`));
      if (d.allele) bits.push(document.createTextNode(` — ${d.allele.id}: ${d.allele.what}`));
      if (d.ptm) bits.push(document.createTextNode(` — ${d.ptm.residue}${d.ptm.pos} ${d.ptm.modification}, conservation ${d.ptm.conservation || 'not recorded'}${d.ptm.borrowedFrom ? `, borrowed from ${d.ptm.borrowedFrom}` : ''}`));
      if (d.domain) bits.push(document.createTextNode(` — in ${d.domain.name} (${d.domain.db} ${d.domain.acc}, ${d.domain.posStart}–${d.domain.posEnd})`));
      if (annotatedSet.has(c)) bits.push(el('span', { class: 'mute tiny', text: '  press Enter to expand this site' }));
    } else {
      bits.push(el('span', { class: 'mute', text: ' · all drawn rows carry the same residue here' }));
    }
    readout.textContent = ''; readout.appendChild(frag(bits));
  }

  function moveTo(c, { scroll = true } = {}) {
    cursor = Math.min(cols, Math.max(1, c));
    if (scroll) {
      const x = (cursor - 1) * CELL;
      const w = track.clientWidth;
      if (x < track.scrollLeft + CELL * 2) track.scrollLeft = Math.max(0, x - CELL * 4);
      else if (x > track.scrollLeft + w - CELL * 3) track.scrollLeft = x - w + CELL * 5;
    }
    winFrom = 1; winTo = 0; paint(); describe(cursor);
  }
  const nextAnnotated = dir => {
    const list = g.annotatedCols || [];
    if (!list.length) return null;
    if (dir > 0) return list.find(c => c > cursor) ?? list[0];
    const before = list.filter(c => c < cursor);
    return before.length ? before[before.length - 1] : list[list.length - 1];
  };

  track.addEventListener('scroll', paint, { passive: true });
  track.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight') { moveTo(cursor + step); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { moveTo(cursor - step); e.preventDefault(); }
    else if (e.key === 'Home') { moveTo(1); e.preventDefault(); }
    else if (e.key === 'End') { moveTo(cols); e.preventDefault(); }
    else if (e.key === 'PageDown') { moveTo(cursor + 40); e.preventDefault(); }
    else if (e.key === 'PageUp') { moveTo(cursor - 40); e.preventDefault(); }
    else if (e.key === 'n' || e.key === 'N') { const c = nextAnnotated(1); if (c) moveTo(c); e.preventDefault(); }
    else if (e.key === 'p' || e.key === 'P') { const c = nextAnnotated(-1); if (c) moveTo(c); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { if (annotatedSet.has(cursor)) onOpenColumn(cursor); e.preventDefault(); }
  });

  const head = el('div', { class: 'alnhead' }, [
    el('span', { class: 'mono', text: `${cols} alignment columns` }),
    el('span', { class: 'mute tiny grow', text: `${g.diffs.length} differ across the drawn rows · ${(g.annotatedCols || []).length} with an annotation at the site`
      + (g.anaGapCols ? ` · ${g.anaGapCols} of those are a gap, not a different residue` : '') }),
    el('button', { class: 'jump', type: 'button', onclick: () => { const c = nextAnnotated(-1); if (c) { track.focus(); moveTo(c); } } }, 'Previous site'),
    el('button', { class: 'jump', type: 'button', onclick: () => { const c = nextAnnotated(1); if (c) { track.focus(); moveTo(c); } } }, 'Next site'),
  ]);

  const wrap = el('div', { class: 'alnwrap' }, [head, el('div', { class: 'alnbody' }, [labels, track]), readout]);
  /* paint once the element has a width */
  requestAnimationFrame(() => { moveTo(cursor, { scroll: true }); });
  window.addEventListener('resize', () => { winFrom = 1; winTo = 0; paint(); }, { passive: true });
  return { wrap, moveTo, focus: () => track.focus() };
}

/* ===================================================== scale 2: the per-diff drawers */
function paneExpression(x, D) {
  if (isAbsent(x)) return el('div', { class: 'pane' }, [el('h4', { text: 'expression' }), absent(x)]);
  const byStage = new Map();
  for (const c of x.cells) {
    const k = c.stage ? `${c.stage.id} ${c.stage.label}` : 'stage not recorded';
    if (!byStage.has(k)) byStage.set(k, []);
    byStage.get(k).push(c);
  }
  const stageRows = [...byStage.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8).map(([stage, list]) => {
    const names = list.slice(0, 6).map(c => (c.anatomy ? c.anatomy.label : 'anatomy not recorded')
      + (c.absent ? ' (asserted absent)' : '')).join(', ');
    return el('tr', null, [
      el('th', { text: stage }),
      el('td', null, [
        document.createTextNode(names + (list.length > 6 ? ` +${list.length - 6} more` : '')),
        el('div', { class: 'tiny mute', text: 'sources: ' + [...new Set(list.flatMap(c => Object.keys(c.dbs)))].join(', ') }),
      ]),
    ]);
  });
  return el('div', { class: 'pane' }, [
    el('h4', { text: 'expression — anatomy × stage' }),
    el('p', { class: 'tiny mute', text: `${num(x.rows)} rows, ${num(x.cellsTotal)} anatomy × stage cells; ${Math.min(8, byStage.size)} of ${byStage.size} stages shown.` }),
    el('div', { class: 'scroll' }, el('table', null, el('tbody', null, frag(stageRows)))),
    el('p', { class: 'tiny mute', text: 'by source: ' + Object.entries(x.bySource).map(([k, v]) => `${k} ${v}`).join(' · ') }),
    x.nonIndependence ? el('div', { class: 'absent' }, [el('b', { text: 'not two independent sources' }), el('p', { text: x.nonIndependence })]) : null,
    el('p', { class: 'tiny mute', text: x.stageOrderCaveat }),
  ]);
}

function paneProteomic(x) {
  if (isAbsent(x)) return el('div', { class: 'pane' }, [el('h4', { text: 'protein' }), absent(x)]);
  const s = x.structure;
  return el('div', { class: 'pane' }, [
    el('h4', { text: 'protein — domain, structure confidence, detection' }),
    x.domains.length
      ? el('div', { class: 'scroll' }, el('table', null, frag([
          el('thead', null, el('tr', null, frag([el('th', { text: 'domain hit' }), el('th', { text: 'positions' }), el('th', { text: 'source' })]))),
          el('tbody', null, frag(x.domains.slice(0, 10).map(d => el('tr', null, [
            el('td', null, el('a', { href: d.url, rel: 'noreferrer', text: d.name })),
            el('td', { class: 'n', text: (d.positions || []).map(p => `${p.start}–${p.end}`).join(', ') || '—' }),
            el('td', { class: 'tiny', text: `${d.db} ${d.acc || ''} (${d.kind})` }),
          ])))),
        ])))
      : absent({ what: 'any domain hit for this protein', why: 'the proteomic layer records no domain, region, motif or zinc-finger row for this gene, only the broader superfamily where one exists', source: 'omics/proteomic' }),
    s ? kvTable([
      ['AlphaFold model', s.model],
      ['mean pLDDT', s.mean_plddt],
      ['residues pLDDT > 70', s.fraction_plddt_gt70 != null ? `${(s.fraction_plddt_gt70 * 100).toFixed(1)}%` : null],
      ['residues pLDDT > 90', s.fraction_plddt_gt90 != null ? `${(s.fraction_plddt_gt90 * 100).toFixed(1)}%` : null],
      ['residues pLDDT < 50', s.fraction_plddt_lt50 != null ? `${(s.fraction_plddt_lt50 * 100).toFixed(1)}%` : null],
      ['kind', s.kind],
    ], 'structure confidence — a prediction, not a measured structure') : absent(x.structureAbsence),
    x.detection.length
      ? el('p', { class: 'tiny' }, `mass-spectrometry: detected (${x.detection.map(d => d.db).join(', ')})`)
      : absent(x.detectionAbsence),
    x.abundance.length ? el('p', { class: 'tiny mute', text: 'abundance measured in: ' + x.abundance.map(a => (a.anatomy ? a.anatomy.label : 'tissue not recorded') + ` ${a.value} ${a.unit || ''}`).join(' · ') }) : null,
    el('div', { class: 'absent' }, [el('b', { text: 'no fin tissue anywhere in the protein layer' }), el('p', { text: x.noFinTissue }), el('p', { class: 'tiny', text: x.noFlyingFishProteome })]),
  ]);
}

function panePtm(x, col) {
  if (isAbsent(x)) return el('div', { class: 'pane' }, [el('h4', { text: 'modification sites' }), absent(x)]);
  const sites = x.sites.filter(s => s.pos != null);
  const seen = new Set();
  const uniq = sites.filter(s => { const k = `${s.residue}${s.pos}|${s.modification}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return el('div', { class: 'pane' }, [
    el('h4', { text: 'modification — site, conservation, borrowed status' }),
    el('p', { class: 'tiny mute', text: `${num(x.sitesTotal)} rows; ${x.borrowed} are borrowed from an orthologue, not measured in zebrafish.` }),
    el('div', { class: 'scroll' }, el('table', null, frag([
      el('thead', null, el('tr', null, frag([el('th', { text: 'site' }), el('th', { text: 'modification' }), el('th', { text: 'conservation' }), el('th', { text: 'measured in' })]))),
      el('tbody', null, frag(uniq.slice(0, 12).map(s => el('tr', null, [
        el('td', { class: 'n mono', text: `${s.residue || '?'}${s.pos}` }),
        el('td', { class: 'tiny', text: s.modification }),
        el('td', { class: 'tiny', text: s.conservation || 'not recorded' }),
        el('td', { class: 'tiny', text: s.borrowedFrom ? `${s.borrowedFrom} — borrowed` : 'Danio rerio' }),
      ])))),
    ]))),
    Object.keys(x.conservation).length ? el('p', { class: 'tiny mute', text: 'conservation calls: ' + Object.entries(x.conservation).map(([k, v]) => `${k} ${v}`).join(' · ') }) : null,
    el('p', { class: 'tiny mute', text: x.borrowedRule }),
  ]);
}

function panePathway(x) {
  if (isAbsent(x)) return el('div', { class: 'pane' }, [el('h4', { text: 'pathway' }), absent(x)]);
  const seen = new Set();
  const uniq = x.members.filter(m => { if (seen.has(m.acc)) return false; seen.add(m.acc); return true; });
  const conc = x.cardConcordance || {};
  return el('div', { class: 'pane' }, [
    el('h4', { text: 'pathway — membership and cross-source concordance' }),
    el('div', { class: 'scroll' }, el('table', null, frag([
      el('thead', null, el('tr', null, frag([el('th', { text: 'set' }), el('th', { text: 'source' }), el('th', { text: 'kind' })]))),
      el('tbody', null, frag(uniq.slice(0, 10).map(m => el('tr', null, [
        el('td', null, el('a', { href: m.url, rel: 'noreferrer', text: m.name })),
        el('td', { class: 'tiny', text: `${m.db} ${m.acc || ''}` }),
        el('td', { class: 'tiny', text: m.kind }),
      ])))),
    ]))),
    Object.keys(conc).length
      ? el('p', { class: 'tiny mute', text: 'concordance: ' + Object.entries(conc).map(([f, v]) => `${f} — ${v.nDistinct} distinct values, ${v.nMultiSource} backed by more than one source`).join(' · ') })
      : null,
    x.conflicts && x.conflicts.length
      ? el('p', { class: 'tiny', style: 'color:var(--bad)', text: `${x.conflicts.length} recorded conflict(s) between sources on this gene's card.` })
      : null,
    el('p', { class: 'tiny mute', text: x.crosswalkNote }),
    el('p', { class: 'tiny mute', text: x.keggCaveat }),
  ]);
}

/* developmental time, as a small multiple over the ontogeny stages */
function paneDevelopment(D, expr) {
  const o = D.ontogeny.zebrafish;
  if (isAbsent(o)) return el('div', { class: 'pane' }, [el('h4', { text: 'developmental time' }), absent(o)]);
  const FIELDS = ['SL_m', 'pectoral_span_m', 'pectoral_area_both_m2', 'mass_kg'];
  const mults = FIELDS.map(f => {
    const series = o.stages.map(s => s.fields[f] || null);
    if (!series.some(v => v && v.value != null)) return null;
    const vals = series.map(v => (v && typeof v.value === 'number' ? v.value : (v && Array.isArray(v.value) ? v.value[1] : null)));
    const max = Math.max(...vals.filter(v => v != null));
    const kinds = [...new Set(series.filter(Boolean).map(v => v.kind))];
    return el('div', { class: 'mult' }, [
      el('div', { class: 't' }, [el('span', { text: f }), el('span', { class: 'mono', text: kinds.join('/') })]),
      el('div', { class: 'bars', role: 'img', 'aria-label': `${f} across ${o.stages.length} stages: ` + o.stages.map((s, i) => `${s.label} ${vals[i] == null ? 'not found' : vals[i]}`).join('; ') },
        frag(vals.map(v => el('i', { 'data-null': v == null ? '1' : null, style: v == null ? 'height:4px' : `height:${Math.max(4, (v / max) * 100)}%`, title: v == null ? 'not found' : String(v) })))),
      el('div', { class: 'barlabels' }, frag(o.stages.map(s => el('b', { text: s.dpf != null ? `${s.dpf}d` : `${s.ageDays}d` })))),
    ]);
  }).filter(Boolean);

  const stageList = !isAbsent(expr) && expr.stageIds && expr.stageIds.length
    ? el('p', { class: 'tiny' }, `this gene's recorded expression stages: ${expr.stageIds.join(', ')}`)
    : absent({ what: 'a stage for this gene’s expression', why: 'no expression row for this gene carries a developmental stage', source: 'omics/transcriptomic' });

  return el('div', { class: 'pane' }, [
    el('h4', { text: 'developmental time — the stage series' }),
    el('p', { class: 'tiny mute', text: `${o.taxon}. ${o.ageAxis}` }),
    el('div', { class: 'multiples' }, frag(mults)),
    stageList,
    el('div', { class: 'absent' }, [
      el('b', { text: 'the two axes are not joined' }),
      el('p', { text: 'The bars are organism-level staged values; the stage list is the gene’s own expression record. No developmental ordering of ZFS stages is sourced anywhere in this repository, so a gene’s stages are NOT placed on the organism’s age axis here, and nothing on this panel says the edit changes any of these numbers.' }),
      el('span', { class: 'src', text: 'sim-engine/params/ontogeny.json + omics/transcriptomic' }),
    ]),
    el('p', { class: 'tiny mute', text: o.nullRule }),
  ]);
}

/* ================================================= scale 1 + 2: one gene's diff */
function geneBlock(g, D, caseId) {
  const G = D.genes[g.gene] || {};
  const ed = g.edit || {};
  const box = el('div', { class: 'card' });

  box.appendChild(el('h3', null, [
    el('span', { class: 'mono', text: g.gene }),
    document.createTextNode('  '),
    el('span', { text: ed.raw || ed.kind || 'edit' }),
  ]));
  box.appendChild(chips([
    [ed.kind, 'k'],
    ed.zygosity ? [ed.zygosity] : null,
    ed.allele ? [ed.allele] : null,
    [`evidence: ${ed.kind_of_evidence || 'not recorded'}`, 'k'],
    G.chain && !isAbsent(G.chain) ? [`chain weakest link: ${G.chain.chainStrength}`] : null,
  ]));
  if (ed.note) box.appendChild(el('p', { class: 'small', text: ed.note }));
  if (ed.source) box.appendChild(el('p', { class: 'tiny mute mono', text: ed.source }));

  if (isAbsent(g.alignment)) { box.appendChild(absent(g.alignment)); return box; }

  /* the exact genomic change, from the editing plan */
  const ep = g.editplan;
  if (isAbsent(ep)) box.appendChild(absent(ep));
  else if (ep.refused) box.appendChild(el('div', { class: 'absent' }, [
    el('b', { text: 'the editing planner refused this change' }),
    el('p', { text: ep.refusal || 'refused' }),
    el('span', { class: 'src', text: 'sim-engine/validate/editplan/RESULTS.md section 0b' }),
  ]));
  else {
    const t = kvTable([
      ['gene', ep.gene], ['transcript', ep['canonical transcript']], ['protein', ep.protein],
      ['chromosome / strand', ep['chromosome / strand']], ['CDS positions', ep['CDS positions']],
      ['reference codon', ep['reference codon']], ['desired codon', ep['desired codon']],
      ['genomic coordinates', ep['genomic coordinates']], ['nucleotide change', ep['nucleotide change']],
      ['transition or transversion', ep['transition or transversion']],
      ['genome vs CDS', ep['genome vs CDS']],
      ['codon usage of the new codon', ep['codon usage of the new codon']],
    ], 'exact GRCz11 change — sim-engine/validate/editplan/RESULTS.md');
    if (t) box.appendChild(t);
    if (ep.quote) box.appendChild(el('p', { class: 'tiny mute', text: ep.quote }));
  }

  /* the column check: the alignment column, the recorded residue, and whether they agree */
  if (g.columnCheck) {
    const c = g.columnCheck;
    box.appendChild(el('p', { class: 'tiny mono', style: `color:var(--${c.ok ? 'ok' : 'bad'})` },
      `column check: alignment column ${c.col} carries ${c.found} at own-protein position ${c.posFromColumn}; the record says ${c.expected}${c.posRecorded}. ${c.ok ? 'agree' : 'DISAGREE — the generated row was not written'}`));
  }

  box.appendChild(legend(g.meaningCount));

  /* the rows that will be drawn, each with its provenance, and each absence stated */
  const rowNotes = [];
  for (const r of g.rows) {
    if (isAbsent(r)) { rowNotes.push(absent(r)); continue; }
    const bits = [el('b', { text: r.label }), document.createTextNode(` — ${r.species}`)];
    if (r.common) bits.push(el('span', { class: 'mute', text: ` (${r.common})` }));
    if (r.proteinId) bits.push(el('span', { class: 'mono tiny', text: `  ${r.proteinId}` }));
    if (r.length) bits.push(el('span', { class: 'mute tiny', text: `  ${r.length} aa` }));
    rowNotes.push(el('p', { class: 'small', style: 'margin:0 0 3px' }, frag(bits)));
    if (r.identical && r.identicalWhy) rowNotes.push(el('div', { class: 'absent' }, [
      el('b', null, [el('i', { class: 'swatch sw-silent', text: MEANING.silent.glyph, 'aria-hidden': 'true' }), ' no amino-acid change']),
      el('p', { text: r.identicalWhy }),
    ]));
    if (r.projection) rowNotes.push(el('div', { class: 'absent' }, [
      el('b', { text: 'this is not an orthologue call' }),
      el('p', { text: r.projectionWhy || 'the reciprocal best hit failed for this gene' }),
      el('span', { class: 'src', text: 'genotype/sequence-layer.json orthologues_not_resolved' }),
    ]));
    if (r.caveat) rowNotes.push(el('p', { class: 'tiny mute', text: r.caveat }));
    if (r.why) rowNotes.push(el('p', { class: 'tiny mute', text: r.why }));
  }
  box.appendChild(el('div', null, frag(rowNotes)));

  /* annotations the build could NOT place, stated rather than dropped */
  if (g.tracks.notPlaced.length) {
    const det = el('details', { class: 'diffrow' }, [
      el('summary', null, [
        el('span', { class: 'verdict v-UNRESOLVED', text: 'not placed' }),
        el('span', { text: `${g.tracks.notPlaced.length} annotation(s) exist for ${g.gene} but could not be put on this alignment` }),
      ]),
      el('div', { class: 'drawer' }, el('div', { class: 'pane' }, [
        el('h4', { text: 'annotations not placed' }),
        el('div', { class: 'scroll' }, el('table', null, frag([
          el('thead', null, el('tr', null, frag([el('th', { text: 'annotation' }), el('th', { text: 'why not placed' })]))),
          el('tbody', null, frag(g.tracks.notPlaced.slice(0, 20).map(n => el('tr', null, [
            el('td', { class: 'tiny', text: n.name || `${n.residue || ''}${n.pos || ''} ${n.modification || ''}` }),
            el('td', { class: 'tiny', text: n.why }),
          ])))),
        ]))),
        el('p', { class: 'tiny mute', text: 'Three layers of this repository number the same gene on different proteins. An annotation whose position cannot be checked against the aligned residue is refused here rather than drawn in the wrong place.' }),
      ])),
    ]);
    box.appendChild(det);
  }

  /* the alignment itself */
  const diffList = el('div', { class: 'diffs' });
  const drawers = new Map();
  const aln = alignmentView(g, col => {
    const d = drawers.get(col);
    if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); }
  });
  box.appendChild(aln.wrap);
  box.appendChild(el('p', { class: 'tiny mute' }, `aligner: ${g.aligner}. ${g.coordinateSystem}`));

  /* per-diff rows, each a drawer */
  const anno = (g.annotatedCols || []).map(c => g.diffs.find(d => d.col === c)).filter(Boolean);
  diffList.appendChild(el('h4', { class: 'eyebrow', text: `${anno.length} annotated difference${anno.length === 1 ? '' : 's'} — expand any of them` }));
  for (const d of anno) {
    const m = MEANING[d.meaning];
    const det = el('details', { class: 'diffrow' });
    const sum = el('summary', null, [
      el('i', { class: 'swatch ' + m.cls, text: m.glyph, 'aria-hidden': 'true' }),
      el('span', { class: 'at', text: d.pos ? `${d.base}${d.pos}` : `column ${d.col}` }),
      el('span', { class: 'mono tiny mute', text: `col ${d.col}` }),
      el('span', { text: m.label }),
      el('span', { class: 'mono tiny' }, `base ${d.base} · generated ${d.generated}${d.analogue != null ? ` · analogue ${d.analogue}` : ''}`),
    ]);
    det.appendChild(sum);
    let built = false;
    det.addEventListener('toggle', () => {
      if (!det.open || built) return;
      built = true;
      const site = [];
      if (d.edit) site.push(['the edit', `${d.edit.from}${d.edit.pos}${d.edit.to} at alignment column ${d.edit.col}`]);
      if (d.allele) site.push(['known allele / convergent site', `${d.allele.id} — ${d.allele.what}`],
        ['numbered on', d.allele.coordSpecies],
        ['reference residue matches the Ensembl 116 protein', d.allele.refMatches == null ? 'not recorded' : String(d.allele.refMatches)],
        ['source', d.allele.source]);
      if (d.ptm) site.push(['modification', `${d.ptm.residue}${d.ptm.pos} ${d.ptm.modification}`],
        ['conservation', d.ptm.conservation || 'not recorded'],
        ['measured in', d.ptm.borrowedFrom ? `${d.ptm.borrowedFrom} — borrowed onto the zebrafish protein by alignment` : 'Danio rerio'],
        ['source', `${d.ptm.db}${d.ptm.licence ? ` (${d.ptm.licence})` : ''}`],
        d.ptm.flyingFish ? ['the analogue carries', `${d.ptm.flyingFish.residue} — ${d.ptm.flyingFish.state}. ${d.ptm.flyingFish.caveat}`] : null);
      if (d.domain) site.push(['domain', `${d.domain.name} (${d.domain.db} ${d.domain.acc})`],
        ['domain positions', `${d.domain.posStart}–${d.domain.posEnd}`]);
      const panes = [
        el('div', { class: 'pane' }, [el('h4', { text: 'this site' }), kvTable(site.filter(Boolean)) || el('p', { class: 'tiny mute', text: 'no site-level annotation' }),
          el('p', { class: 'tiny' }, el('a', { href: '#aln-' + g.gene, onclick: e => { e.preventDefault(); aln.focus(); aln.moveTo(d.col); } }, 'show this column in the alignment'))]),
        paneExpression(G.expression, D),
        paneProteomic(G.proteomic),
        panePtm(G.ptm, d.col),
        panePathway(G.pathway),
        paneDevelopment(D, G.expression),
      ];
      det.appendChild(el('div', { class: 'drawer' }, frag(panes)));
    });
    drawers.set(d.col, det);
    diffList.appendChild(det);
  }
  const unann = g.meaningCount.unannotated || 0;
  if (unann) diffList.appendChild(el('p', { class: 'tiny mute' },
    `${num(unann)} further column(s) differ with no annotation at that site. They are drawn in the alignment and counted here, and are not listed: an unannotated difference is a difference we cannot say anything else about.`));
  if (g.gapNote) diffList.appendChild(el('div', { class: 'absent' }, [
    el('b', null, [el('i', { class: 'swatch sw-gap', text: MEANING.gap.glyph, 'aria-hidden': 'true' }), ' a gap is not a difference']),
    el('p', { text: g.gapNote }),
    el('span', { class: 'src', text: 'counted by dashboard/public/gene-diff/build.mjs from the aligned rows' }),
  ]));

  box.appendChild(diffList);

  /* identity, as the engineered diff recorded it */
  if (g.identityToReference || g.percentIdentity != null) {
    box.appendChild(kvTable([
      g.identityToReference ? ['identity to the unedited reference, before', pct(g.identityToReference.before)] : null,
      g.identityToReference ? ['identity to the unedited reference, after', pct(g.identityToReference.after)] : null,
      g.identityToReference ? ['fraction of the reference protein retained', g.identityToReference.fraction_of_reference_protein_retained] : null,
      g.percentIdentity != null ? ['identity of the base to the analogue orthologue', pct(g.percentIdentity)] : null,
    ].filter(Boolean), 'identity — sequences/engineered-diff.json and the alignment’s own matrix'));
  }
  box.appendChild(el('p', { class: 'tiny' }, frag([
    el('a', { href: `../validate-show/?case=${encodeURIComponent(caseId)}`, text: 'this design’s validation run' }),
    document.createTextNode(' · '),
    el('a', { href: '../t/genotype/', text: 'genotype thread' }),
    G.links && G.links.zfin ? document.createTextNode(' · ') : null,
    G.links && G.links.zfin ? el('a', { href: G.links.zfin, rel: 'noreferrer', text: 'ZFIN' }) : null,
    G.links && G.links.ensembl ? document.createTextNode(' · ') : null,
    G.links && G.links.ensembl ? el('a', { href: G.links.ensembl, rel: 'noreferrer', text: 'Ensembl' }) : null,
    G.links && G.links.uniprot ? document.createTextNode(' · ') : null,
    G.links && G.links.uniprot ? el('a', { href: G.links.uniprot, rel: 'noreferrer', text: 'UniProt' }) : null,
  ].filter(Boolean))));
  box.appendChild(isAbsent(G.card)
    ? absent(G.card)
    : el('p', { class: 'tiny mute mono', text: `omics card: omics/index/genes/${g.gene}.json.gz · ${G.card.zfinId} · built ${G.card.built} · rows by layer: `
        + Object.entries(G.card.summary || {}).map(([k, v]) => `${k} ${v.rows}`).join(', ')
        + (G.card.conflicts && G.card.conflicts.length ? ` · ${G.card.conflicts.length} recorded conflict(s)` : '') }));
  return box;
}

/* =============================================== scale 3: compensation and analogy */
function analogySection(c, D) {
  const comp = D.honesty.compensation;
  const s = el('section', { class: 'scale' }, [
    el('p', { class: 'eyebrow', text: 'scale 3' }),
    el('h2', { text: 'What is proposed as analogous or supplementary' }),
    el('p', { class: 'lede small', text: 'For every row the ledger could not resolve, and every row it resolved as a paralogue or an analogous set: which pathway or gene set is proposed, drawn from the real pathway crosswalk, with the verdict class carried verbatim.' }),
  ]);
  s.appendChild(el('div', { class: 'alarm' }, [
    el('div', null, [el('b', { text: '4 / 13 — 31%' }), el('span', { text: 'The compensation rule’s accuracy on cases independent of the papers it was built from. All nine errors are false positives: it predicted a compensation response where none was published.' })]),
    el('div', null, [el('b', { text: 'UNMET' }), el('span', { text: '"Plausible-by-rule" is an unmet requirement with a review flag. A requirement is met by compensation only on class "documented" AND functional_rescue true.' })]),
    el('div', null, [el('b', { text: `${(c.ledger.counts || {}).COMPENSATORY ?? 0} compensations` }), el('span', { text: 'The classifier returned no COMPENSATORY row for this case. Nothing below is a compensation finding.' })]),
  ]));
  if (comp.verdict) s.appendChild(el('p', { class: 'small', style: 'color:var(--bad)', text: comp.verdict.split('\n')[0] }));
  s.appendChild(el('p', { class: 'tiny mute', text: comp.renderRule }));
  if (comp.scoringRule) s.appendChild(el('p', { class: 'tiny mono mute', text: comp.scoringRule }));

  if (!c.analogy.length) {
    s.appendChild(absent({ what: 'any unresolved or analogous-set row for this case',
      why: c.ledger.ran === false ? 'the ledger did not run for this case' : (c.ledger.headline || 'the ledger holds no row of those classes'),
      source: 'sim-engine/validate/functional/results.json' }));
    return s;
  }
  for (const a of c.analogy) {
    const det = el('details', { class: 'diffrow' }, [
      el('summary', null, [
        el('span', { class: 'verdict v-' + a.verdictClass, text: a.verdictClass }),
        el('span', { class: 'at mono', text: a.gene }),
        el('span', { class: 'chip', text: `search: ${a.searchDepth}` }),
        el('span', { class: 'chip', style: 'border-color:var(--bad);color:var(--bad)', text: a.requirementStatus }),
      ]),
    ]);
    const panes = [
      el('div', { class: 'pane' }, [
        el('h4', { text: 'the requirement and the verdict, verbatim' }),
        el('p', { class: 'small', text: a.requirement }),
        el('p', { class: 'small', text: a.verdictVerbatim }),
        a.unresolvedCaveat ? el('p', { class: 'tiny', style: 'color:var(--warn)', text: a.unresolvedCaveat }) : null,
        a.hypothesis ? el('p', { class: 'tiny', style: 'color:var(--warn)', text: 'This resolution is a HYPOTHESIS, not evidence. ' + (a.hypothesisWhy || '') }) : null,
      ]),
      el('div', { class: 'pane' }, [
        el('h4', { text: 'proposed analogous or supplementary sets' }),
        a.proposals.length
          ? frag(a.proposals.map(p => el('div', { style: 'margin-bottom:7px' }, [
              el('p', { class: 'small', style: 'margin:0' }, el('a', { href: p.url, rel: 'noreferrer', text: p.set })),
              el('p', { class: 'tiny mute', style: 'margin:0', text: `${p.db} ${p.acc || ''} · ${p.kind}` }),
              p.crosswalk && p.crosswalk.matches.length
                ? el('p', { class: 'tiny mute', style: 'margin:0', text: 'nearest set in other sources: ' + p.crosswalk.matches.map(m => `${m.source} ${m.name} (Jaccard ${m.jaccard})`).join(' · ') })
                : null,
            ])))
          : absent(a.pathwayAbsence || { what: 'any proposed set', why: 'no pathway or GO membership is recorded for this gene', source: 'omics/pathway' }),
      ]),
      el('div', { class: 'pane' }, [
        el('h4', { text: 'what this is not' }),
        el('p', { class: 'small', text: a.proposals.length ? a.proposals[0].whatThisIs : 'There is no proposal to qualify.' }),
        el('div', { class: 'absent' }, [el('b', { text: 'not a rescue' }), el('p', { text: a.classifierNote })]),
      ]),
    ];
    det.appendChild(el('div', { class: 'drawer' }, frag(panes.filter(Boolean))));
    s.appendChild(det);
  }
  return s;
}

/* ================================================= scale 4: interactome, metabolome */
function interactomeSection(c, D) {
  const G = D.honesty.interactome;
  const s = el('section', { class: 'scale' }, [
    el('p', { class: 'eyebrow', text: 'scale 4' }),
    el('h2', { text: 'The interaction neighbourhood, by evidence class' }),
    el('p', { class: 'lede small', text: 'Each class is drawn differently and named. An undifferentiated network of these edges would be the most misleading picture in this project.' }),
  ]);
  const CLS = [
    ['curated_zebrafish', 'cl-exp'], ['experimental_zebrafish', 'cl-exp'],
    ['experimental_transferred', 'cl-tr'], ['curated_pathway_database', 'cl-db'], ['predicted', 'cl-pr'],
  ];
  const max = Math.max(...Object.values(G.byClass));
  s.appendChild(el('div', { class: 'alarm' }, [
    el('div', null, [el('b', { text: `2 of ${num(G.edges)}` }), el('span', { text: 'Of all interaction edges in our pack, two are curated zebrafish experiments (IntAct). Two more are STRING edges whose zebrafish experimental channel reaches 0.4.' })]),
    el('div', null, [el('b', { text: 'the rest' }), el('span', { text: `${num(G.byClass.experimental_transferred)} transferred from another species, ${num(G.byClass.curated_pathway_database)} pathway-database assertions, ${num(G.byClass.predicted)} text-mining or co-expression predictions.` })]),
  ]));
  const bar = el('div', { class: 'classbar' });
  for (const [k, cls] of CLS) {
    const n = G.byClass[k] || 0;
    bar.appendChild(el('div', { class: 'cl ' + cls }, [
      el('div', { class: 'nm' }, [el('span', { text: G.classNames[k] || k }), el('b', { text: num(n) })]),
      el('div', { class: 'tr' }, el('i', { style: `width:${Math.max(0.4, (n / max) * 100)}%` })),
    ]));
  }
  s.appendChild(bar);
  s.appendChild(el('p', { class: 'tiny mute', text: G.honesty }));
  s.appendChild(el('p', { class: 'tiny mute mono', text: G.source }));

  /* per-gene neighbourhood for the genes this case edits */
  const genes = (c.sequence && c.sequence.genes ? c.sequence.genes : []).map(g => g.gene);
  for (const gene of genes) {
    const ix = (D.genes[gene] || {}).interactions;
    if (!ix) continue;
    const card = el('div', { class: 'card flat' }, el('h3', null, [el('span', { class: 'mono', text: gene }), ` — ${num(ix.total)} edge(s)`]));
    if (ix.absence) card.appendChild(absent(ix.absence));
    else {
      const mx = Math.max(...Object.values(ix.byClass).map(v => v.n));
      const b = el('div', { class: 'classbar' });
      for (const [name, v] of Object.entries(ix.byClass)) {
        const cls = /zebrafish/.test(name) ? 'cl-exp' : /transferred/.test(name) ? 'cl-tr' : /curated pathway/.test(name) ? 'cl-db' : 'cl-pr';
        b.appendChild(el('div', { class: 'cl ' + cls }, [
          el('div', { class: 'nm' }, [el('span', { text: name }), el('b', { text: num(v.n) })]),
          el('div', { class: 'tr' }, el('i', { style: `width:${Math.max(0.4, (v.n / mx) * 100)}%` })),
          el('div', { class: 'tiny mute', text: 'e.g. ' + v.partners.slice(0, 8).map(p => p.partner).join(', ') }),
        ]));
      }
      card.appendChild(b);
      if (ix.partnerCount) card.appendChild(el('p', { class: 'tiny mute', text: `partner count as the source reports it: ${ix.partnerCount.value} (${ix.partnerCount.db}, ${ix.partnerCount.evidence})` }));
    }
    s.appendChild(card);
  }
  s.appendChild(el('h3', { text: 'Metabolome' }));
  s.appendChild(absent(G.metabolome));
  return s;
}

/* ================================== scale 5: driving the control plane at genome level */
function controlPlaneSection(c, D) {
  const cp = c.controlPlane;
  const s = el('section', { class: 'scale' }, [
    el('p', { class: 'eyebrow', text: 'scale 5' }),
    el('h2', { text: 'What the edit drives, and what is merely annotated nearby' }),
    el('p', { class: 'lede small', text: 'Every arrow below says which it is. An edit drives a sequence state at a coordinate. Everything else on this page is an annotation of the wild-type gene, and nothing in our sources measured any of it in the edited animal.' }),
  ]);
  if (!cp) { s.appendChild(absent({ what: 'a causal direction for this case', why: 'the case has neither an edit nor a ledger row, so there is nothing to point from', source: 'sim-engine/validate/functional/results.json' })); return s; }

  s.appendChild(el('div', { class: 'alarm' }, [
    el('div', null, [el('b', { text: cp.ownValidation.number }), el('span', { text: `${cp.ownValidation.headline} ${cp.ownValidation.quote}` })]),
    cp.comparison ? el('div', null, [el('b', { text: `${cp.rowsMoved.length} row${cp.rowsMoved.length === 1 ? '' : 's'} moved` }), el('span', { text: cp.comparison.statement })]) : null,
  ].filter(Boolean)));

  for (const a of cp.arrows) {
    const card = el('div', { class: 'card flat' }, el('h3', null, [el('span', { class: 'mono', text: a.gene }), `  ${a.edit.raw || a.edit.kind}`]));
    const arrows = el('div', { class: 'arrows' });
    for (const d of [...a.drives, ...a.correlated]) {
      const cls = d.relation === 'DRIVES' ? 'rel-DRIVES' : d.relation === 'REFUSED' ? 'rel-REFUSED'
        : d.relation.startsWith('EXPERIMENTALLY') ? 'rel-EXP' : 'rel-ANN';
      arrows.appendChild(el('div', { class: 'arrow' }, [
        el('span', { class: 'rel ' + cls, text: d.relation }),
        el('div', null, [
          el('p', { class: 'small', style: 'margin:0', text: d.to }),
          el('p', { class: 'tiny mute', style: 'margin:0', text: d.why }),
          el('p', { class: 'tiny mute mono', style: 'margin:0', text: `${d.kind || ''}${d.source ? ' · ' + d.source : ''}` }),
        ]),
      ]));
    }
    card.appendChild(arrows);
    s.appendChild(card);
  }

  if (cp.comparison) {
    const rows = ['SAME', 'ALLELIC', 'PARALOGUE', 'ANALOGOUS_SET', 'COMPENSATORY', 'UNRESOLVED'];
    s.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'The design against an unedited control, on the same requirement set' }),
      el('div', { class: 'scroll' }, el('table', null, frag([
        el('thead', null, el('tr', null, frag([el('th', { text: 'class' }), el('th', { text: 'this design' }), el('th', { text: 'unedited zebrafish' })]))),
        el('tbody', null, frag(rows.map(k => el('tr', null, [
          el('td', null, el('span', { class: 'verdict v-' + k, text: k })),
          el('td', { class: 'n', text: num(cp.comparison.design?.[k] ?? 0) }),
          el('td', { class: 'n', text: num(cp.comparison.control?.[k] ?? 0) }),
        ])))),
      ]))),
      el('p', { class: 'small', text: cp.comparison.statement }),
      el('p', { class: 'tiny mute', text: `control: ${cp.comparison.controlRole}` }),
      cp.rowsMoved.length ? el('div', { class: 'scroll' }, el('table', null, frag([
        el('thead', null, el('tr', null, frag([el('th', { text: 'row the edits moved' }), el('th', { text: 'from' }), el('th', { text: 'to' })]))),
        el('tbody', null, frag(cp.rowsMoved.map(r => el('tr', null, [
          el('td', { class: 'mono tiny', text: `${r.gene} ${r.id}` }),
          el('td', null, el('span', { class: 'verdict v-' + (r.from || 'UNRESOLVED'), text: r.from || 'absent' })),
          el('td', null, el('span', { class: 'verdict v-' + r.to, text: r.to })),
        ])))),
      ]))) : null,
    ]));
  }
  return s;
}

/* ================================================================= the case page */
function casePage(c, D) {
  const out = document.createDocumentFragment();

  /* the three numbers, at the top of every case */
  out.appendChild(el('div', { class: 'alarm' }, [
    el('div', null, [el('b', { text: '31%' }), el('span', { text: 'The compensation rule is right 4 times in 13 on cases independent of the papers it was built from. All nine errors are false positives. No compensation on this page is a rescue.' })]),
    el('div', null, [el('b', { text: `2 / ${num(D.honesty.interactome.edges)}` }), el('span', { text: 'Interaction edges that are curated zebrafish experiments. The rest are transferred, database-asserted or text-mined.' })]),
    el('div', null, [el('b', { text: '1 / 74' }), el('span', { text: 'Our own design validation FAILED: the design reproduces one of the 74 loci known to differ in flying fishes, and the claim that we can design an organism was dropped as unsupported.' })]),
  ]));

  /* the triple */
  const d = c.design, a = c.analogue;
  const head = el('div', { class: 'card' }, [
    el('h2', { text: isAbsent(d) ? c.id : d.label }),
    chips([
      [`case: ${c.id}`, 'k'],
      [c.role],
      c.isCommitted ? ['committed case'] : ['control'],
      !isAbsent(d) && d.kind ? [`genotype: ${d.kind}`] : null,
      !isAbsent(d) ? [`${d.nEdits} edited ${d.nEdits === 1 ? 'locus' : 'loci'}`] : null,
      !isAbsent(a) && a.direction ? [a.direction] : null,
    ]),
    c.desiredPhenotype ? el('p', { class: 'small', text: `desired phenotype: ${typeof c.desiredPhenotype === 'string' ? c.desiredPhenotype : c.desiredPhenotype.text}` }) : null,
  ]);
  if (!isAbsent(d)) {
    if (d.notOurs) head.appendChild(el('div', { class: 'absent' }, [el('b', { text: 'the design is not ours' }), el('p', { text: d.notOurs })]));
    if (d.statusCaveat) head.appendChild(el('div', { class: 'absent' }, [el('b', { text: 'status' }), el('p', { text: d.statusCaveat })]));
    head.appendChild(el('p', { class: 'tiny mute mono', text: `genotype from: ${d.source || 'not recorded'} · edits read from ${d.editsFrom}` }));
  } else head.appendChild(absent(d));

  /* the analogue, or its stated absence */
  if (isAbsent(a)) head.appendChild(absent(a));
  else if (a.noAnalogue) {
    head.appendChild(el('div', { class: 'absent' }, [
      el('b', { text: 'no functional analogue exists' }),
      el('p', { text: a.basis }),
      a.nearestPartial.length ? el('p', { class: 'tiny', text: 'nearest partial analogues: ' + a.nearestPartial.map(p => `${p.name} (${p.taxon})`).join('; ') }) : null,
      el('span', { class: 'src', text: 'sim-engine/validate/functional/results.json closest_functional_analogue' }),
    ].filter(Boolean)));
  } else {
    head.appendChild(kvTable([
      ['functional analogue', `${a.name} (${a.taxon})`],
      ['function', a.function],
      ['operational definition', a.operationalDefinition],
      ['direction', a.direction],
    ], 'the analogue the diff is taken against'));
    if (a.dataPoor) head.appendChild(el('div', { class: 'absent' }, [el('b', { text: 'the analogue is data-poor' }), el('p', { text: a.dataPoorStatement })]));
  }
  out.appendChild(head);

  /* scale 1 + 2 */
  const s1 = el('section', { class: 'scale' }, [
    el('p', { class: 'eyebrow', text: 'scale 1 and 2' }),
    el('h2', { text: 'The sequence, and every scale under each difference' }),
    el('p', { class: 'lede small', text: 'A real MAFFT alignment of the base protein, the same protein with the recorded edit applied, and the orthologue of the functional analogue. Colour means what kind of site a difference falls on, never which base it is, and it is always paired with a glyph and a word. Expand any annotated difference for its expression, protein, modification, pathway and developmental record.' }),
  ]);
  if (isAbsent(c.sequence)) {
    s1.appendChild(absent(c.sequence));
    if (c.sequence.statusCaveat) s1.appendChild(el('p', { class: 'tiny mute', text: c.sequence.statusCaveat }));
  } else {
    for (const g of c.sequence.genes) s1.appendChild(geneBlock(g, D, c.id));
  }
  out.appendChild(s1);

  /* the ledger itself, as the bridge to scale 3 */
  const L = c.ledger;
  const led = el('section', { class: 'scale' }, [
    el('p', { class: 'eyebrow', text: 'the resolution ledger' }),
    el('h2', { text: 'Every difference, with its class' }),
  ]);
  if (L.headline) led.appendChild(el('p', { class: 'small', text: L.headline }));
  if (L.counts) {
    const order = ['SAME', 'ALLELIC', 'PARALOGUE', 'ANALOGOUS_SET', 'COMPENSATORY', 'UNRESOLVED'];
    led.appendChild(el('div', { class: 'chips' }, frag(order.map(k =>
      el('span', { class: 'verdict v-' + k, text: `${k} ${L.counts[k] ?? 0}` })))));
  }
  if (L.resolutionTwoWays) led.appendChild(el('p', { class: 'tiny mute', text: L.resolutionTwoWays.rule }));
  if (L.coverage) led.appendChild(kvTable([
    ['requirements assessable', `${L.coverage.requirements_assessable} of ${L.coverage.requirements_total}`],
    ['genes mapped', `${L.coverage.genes_mapped} of ${L.coverage.genes_total}`],
    ['analogue loci with any expression or assay', L.coverage.analogue_loci_with_any_flying_fish_EXPRESSION_or_ASSAY],
    ['note', L.coverage.note],
  ], 'coverage'));
  if (L.requirementSetScope) led.appendChild(el('p', { class: 'tiny mute', text: L.requirementSetScope }));
  out.appendChild(led);

  out.appendChild(analogySection(c, D));
  out.appendChild(interactomeSection(c, D));
  out.appendChild(controlPlaneSection(c, D));
  return out;
}

/* ============================================================================ boot */
let DATA = null, current = null;

function selectCase(id, push) {
  current = id;
  const c = DATA.cases.find(x => x.id === id);
  const app = document.getElementById('app');
  app.textContent = '';
  if (!c) { app.appendChild(absent({ what: `a case called "${id}"`, why: 'data.json carries no case with that id', source: 'gene-diff/data.json' })); return; }
  app.appendChild(casePage(c, DATA));
  for (const b of document.querySelectorAll('#casebar .casebtn')) b.setAttribute('aria-pressed', String(b.dataset.case === id));
  if (push && /^[A-Za-z0-9._~-]+$/.test(id)) { try { location.hash = id; } catch (e) { /* ignore */ } }
  /* only scroll when the reader switched case; the first render must leave the page at its top,
     so the still frame shows the title and the three numbers rather than mid-alignment */
  if (push) app.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function boot(D) {
  DATA = D;
  const bar = document.getElementById('casebar');
  for (const c of D.cases) {
    bar.appendChild(el('button', {
      class: 'casebtn', type: 'button', 'data-case': c.id, 'aria-pressed': 'false',
      onclick: () => selectCase(c.id, true),
    }, [c.id, el('span', { class: 'r', text: c.isCommitted ? 'committed' : 'control' })]));
  }
  document.getElementById('prov').textContent =
    `Built ${D.built} by ${D.tool}. ${D.what}`;
  const want = (location.hash || '').replace('#', '');
  selectCase(D.cases.some(c => c.id === want) ? want : D.cases[0].id, false);
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace('#', '');
    if (h && h !== current && D.cases.some(c => c.id === h)) selectCase(h, false);
  });
}

fetch('data.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error(`data.json: HTTP ${r.status}`); return r.json(); })
  .then(boot)
  .catch(e => {
    document.getElementById('app').appendChild(absent({
      what: 'the diff', why: `gene-diff/data.json could not be loaded: ${e.message}. Rebuild it with "node dashboard/public/gene-diff/build.mjs".`,
      source: 'dashboard/public/gene-diff/build.mjs',
    }));
  });
