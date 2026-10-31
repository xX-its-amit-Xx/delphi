// Tissue-tissue and cell-cell interaction views for Open the Fish. Data: genotype/interactions.json (copied by
// dashboard/build-graph.mjs into ./interactions.json when the Genotype thread writes it). Until then the views
// draw the tissues and cell types the files already hold, with no arrows, and say "pending".
// Evidence grades: shown experimentally (solid) vs inferred by orthology from human/mouse databases (dashed, lighter).

export function normaliseInteractions(raw) {
  if (!raw) return null;
  const tiss = raw.tissue_interactions || raw.tissues || raw.signalling || [];
  const cells = raw.cell_interactions || raw.cells || raw.ligand_receptor || [];
  const grade = x => { const g = String(x.evidence_grade || x.evidence || x.grade || '').toLowerCase(); return /ortholog|inferred|predicted|homolog/.test(g) ? 'inferred' : /experiment|shown|direct|in situ|mutant|measured/.test(g) ? 'experimental' : (g || 'unstated'); };
  return {
    source: 'genotype/interactions.json', built: raw.built || null, note: raw.note || raw.constraint || null, organism_note: raw.organism_note || raw.proxy || null,
    tissue: tiss.map(x => ({ from: x.from || x.source_tissue || x.source, to: x.to || x.target_tissue || x.target, genes: x.genes || x.ligands || (x.gene ? [x.gene] : []), pathway: x.pathway || x.signal || null, direction: x.direction || 'directed', grade: grade(x), source: x.source_ref || x.reference || x.pmid || x.source_db || x.citation || null, organism: x.organism || null, url: x.url || null })).filter(x => x.from && x.to),
    cell: cells.map(x => ({ from: x.from || x.source_cell || x.sender, to: x.to || x.target_cell || x.receiver, ligand: x.ligand || null, receptor: x.receptor || null, kind: x.type || x.kind || (x.gap_junction ? 'gap junction' : 'ligand-receptor'), grade: grade(x), source: x.source_ref || x.reference || x.pmid || x.source_db || x.citation || null, organism: x.organism || null, url: x.url || null })).filter(x => x.from && x.to)
  };
}
export const PENDING = { source: 'pending', note: 'genotype/interactions.json has not been written yet by the Genotype thread; the tissues and cell types shown are the ones already in the files, and no interaction is drawn, because none is sourced', tissue: [], cell: [] };

const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (p) p.appendChild(e); return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// nodes: [{id,label,hasRec}], links: normalised rows whose from/to match node ids or labels; onPick(id), onLink(link)
export function drawInteractionGraph(svg, nodes, links, opts) {
  svg.innerHTML = ''; const W = svg.clientWidth || 800, H = svg.clientHeight || 500; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const defs = el('defs', {}, svg);
  for (const [id, col] of [['arrowExp', 'var(--ink)'], ['arrowInf', 'var(--mute)']]) { const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs); el('path', { d: 'M0 0L10 5L0 10z', fill: col }, m); }
  const cx = W / 2, cy = H / 2 - 10, R = Math.min(W, H) * 0.36; const pos = {};
  const byKey = {}; nodes.forEach(n => { byKey[n.id] = n; byKey[(n.label || '').toLowerCase()] = n; });
  nodes.forEach((n, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(nodes.length, 1); pos[n.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const find = k => byKey[k] || byKey[String(k).toLowerCase()] || nodes.find(n => String(k).toLowerCase().includes(n.label.toLowerCase()) || n.label.toLowerCase().includes(String(k).toLowerCase()));
  let drawn = 0, unmatched = 0;
  for (const l of links) { const a = find(l.from), b = find(l.to); if (!a || !b || a === b) { unmatched++; continue; } drawn++;
    const p = pos[a.id], q = pos[b.id]; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1; const ox = -dy / d * 10, oy = dx / d * 10;
    const inf = l.grade !== 'experimental';
    const path = el('path', { d: `M${p.x + ox} ${p.y + oy} Q${(p.x + q.x) / 2 + ox * 3} ${(p.y + q.y) / 2 + oy * 3} ${q.x + ox} ${q.y + oy}`, fill: 'none', stroke: inf ? 'var(--mute)' : 'var(--ink)', 'stroke-width': inf ? 1.4 : 2.2, 'stroke-dasharray': inf ? '5 4' : 'none', 'marker-end': `url(#${inf ? 'arrowInf' : 'arrowExp'})`, class: 'ilink', style: 'cursor:pointer' }, svg);
    if (l.direction === 'bidirectional' || l.direction === 'mutual') path.setAttribute('marker-start', `url(#${inf ? 'arrowInf' : 'arrowExp'})`);
    const lab = el('text', { x: (p.x + q.x) / 2 + ox * 3.2, y: (p.y + q.y) / 2 + oy * 3.2, 'font-size': 10.5, fill: inf ? 'var(--mute)' : 'var(--ink)', 'text-anchor': 'middle' }, svg);
    lab.textContent = (l.genes && l.genes.length ? l.genes.slice(0, 4).join(', ') + (l.genes.length > 4 ? ' +' + (l.genes.length - 4) : '') : [l.ligand, l.receptor].filter(Boolean).join(' → ') || l.kind || '') + (inf ? ' (inferred)' : '');
    const t = el('title', {}, path); t.textContent = `${a.label} → ${b.label}: ${lab.textContent}; evidence ${l.grade}; ${l.source || 'no source'}`;
    path.onclick = () => opts.onLink && opts.onLink(l, a, b);
  }
  for (const n of nodes) { const p = pos[n.id]; const g = el('g', { class: 'inode', style: 'cursor:pointer' }, svg);
    if (opts.kind === 'cell') { el('path', { d: `M${p.x} ${p.y - 13} l12 7 v12 l-12 7 l-12 -7 v-12z`, fill: n.hasRec ? 'var(--fill)' : 'var(--hollow)', stroke: 'var(--fill)', 'stroke-width': 1.6 }, g); }
    else el('circle', { cx: p.x, cy: p.y, r: 12, fill: n.hasRec ? 'var(--fill)' : 'var(--hollow)', stroke: 'var(--fill)', 'stroke-width': 1.6 }, g);
    const t = el('text', { x: p.x, y: p.y + 28, 'font-size': 11.5, 'text-anchor': 'middle', fill: 'var(--ink)' }, g); t.textContent = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label;
    g.onclick = () => opts.onPick && opts.onPick(n.id); }
  const cap = el('text', { x: 130, y: H - 10, 'font-size': 11, fill: 'var(--mute)' }, svg);
  cap.textContent = opts.caption || '';
  return { drawn, unmatched };
}
