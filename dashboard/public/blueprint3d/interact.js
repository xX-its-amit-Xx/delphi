// Tissue-tissue and cell-cell interaction views for Open the Fish. Data: genotype/interactions.json (copied by
// dashboard/build-graph.mjs into ./interactions.json when the Genotype thread writes it). Until then the views
// draw the tissues and cell types the files already hold, with no arrows, and say "pending".
//
// Entry shape (Genotype thread): sender_node, receiver_node ({id,label,level}), ligands / receptors / channels
// (arrays), grade (association | necessity | sufficiency | mechanism | hypothesis), context (development |
// regeneration | adult), orthology_inferred (+ orthology_species), sources [{pmid|doi, quote}], flags [] from the
// validator. Drawing: grade sets stroke weight; orthology-inferred is dashed and lighter; flagged entries are
// drawn weaker still and the flag is shown in the panel; contexts are never merged (a filter picks one).

export const GRADES = ['mechanism', 'sufficiency', 'necessity', 'association', 'hypothesis'];
export const CONTEXTS = ['development', 'regeneration', 'adult'];
const nodeOf = x => { if (!x) return null; if (typeof x === 'string') return { id: x, label: x, level: null }; return { id: x.id || x.term || x.node || x.label, label: x.label || x.id || x.term, level: x.level || null }; };
const arr = v => Array.isArray(v) ? v : v ? [v] : [];
export function normaliseInteractions(raw) {
  if (!raw) return null;
  const rows = raw.interactions || raw.entries || raw.links || (Array.isArray(raw) ? raw : []);
  const list = rows.map(x => {
    const from = nodeOf(x.sender_node || x.sender || x.from), to = nodeOf(x.receiver_node || x.receiver || x.to);
    const grade = String(x.grade || x.evidence_grade || 'hypothesis').toLowerCase();
    const sources = arr(x.sources || x.source).map(sr => typeof sr === 'string' ? { ref: sr, quote: null } : { ref: sr.pmid ? 'PMID ' + sr.pmid : sr.doi ? 'doi ' + sr.doi : sr.ref || sr.citation || sr.url || null, pmid: sr.pmid || null, doi: sr.doi || null, url: sr.url || (sr.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + sr.pmid + '/' : sr.doi ? 'https://doi.org/' + sr.doi : null), quote: sr.quote || sr.verbatim || null, organism: sr.organism || null });
    return { from, to, ligands: arr(x.ligands || x.ligand), receptors: arr(x.receptors || x.receptor), channels: arr(x.channels || x.channel), genes: arr(x.genes),
      grade: GRADES.includes(grade) ? grade : 'hypothesis', gradeRaw: x.grade || x.evidence_grade || null,
      context: String(x.context || 'unstated').toLowerCase(), orthology: !!(x.orthology_inferred || x.inferred_by_orthology), orthologySpecies: x.orthology_species || x.orthology_from || x.inferred_from || null,
      kind: x.type || x.kind || (x.channels && x.channels.length ? 'gap junction / channel' : 'ligand-receptor'), organism: x.organism || null, flags: arr(x.flags || x.validator_flags), sources, level: x.level || (from && from.level) || null, note: x.note || null };
  }).filter(r => r.from && r.to);
  const isCell = r => /cell/.test(String(r.from.level || '')) || /cell/.test(String(r.to.level || '')) || /\+/.test(String(r.from.id)) || /\+/.test(String(r.to.id));
  return { source: 'genotype/interactions.json', built: raw.built || raw.generated || null, note: raw.note || raw.constraint || raw.caveat || null, organism_note: raw.organism_note || raw.proxy || null,
    validator: raw.validator || raw.validation || null, validation_flags: raw.validation_flags || null, unknown_node_ids: raw.unknown_node_ids || null, refuted: raw.refuted_or_unsupported || [], gaps: raw.gaps || [], coverage: raw.coverage || null, vetted: raw.vetted === true, all: list, tissue: list.filter(r => !isCell(r)), cell: list.filter(isCell),
    contexts: [...new Set(list.map(r => r.context))], flagged: list.filter(r => r.flags.length).length, orthology: list.filter(r => r.orthology).length };
}
export const PENDING = { source: 'pending', note: 'genotype/interactions.json has not been written yet by the Genotype thread; the tissues and cell types shown are the ones already in the files, and no interaction is drawn, because none is sourced', all: [], tissue: [], cell: [], contexts: [], flagged: 0, orthology: 0 };

const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (p) p.appendChild(e); return e; };
const WIDTH = { mechanism: 3, sufficiency: 2.6, necessity: 2.2, association: 1.6, hypothesis: 1.1 };
export function linkLabel(l) { const g = [...l.ligands, ...l.channels]; const r = l.receptors; let t = g.length ? g.slice(0, 3).join(', ') + (g.length > 3 ? ' +' + (g.length - 3) : '') : ''; if (r.length) t += (t ? ' → ' : '') + r.slice(0, 2).join(', ') + (r.length > 2 ? ' +' + (r.length - 2) : ''); if (!t && l.genes.length) t = l.genes.slice(0, 3).join(', '); return t || l.kind || ''; }

// nodes: [{id,label,hasRec}], links: normalised rows (already filtered to one context); onPick(id), onLink(link)
export function drawInteractionGraph(svg, nodes, links, opts) {
  svg.innerHTML = ''; const W = svg.clientWidth || 800, H = svg.clientHeight || 500; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const defs = el('defs', {}, svg);
  for (const [id, col] of [['arrowExp', 'var(--ink)'], ['arrowInf', 'var(--mute)'], ['arrowFlag', 'var(--expr)']]) { const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs); el('path', { d: 'M0 0L10 5L0 10z', fill: col }, m); }
  const cx = W / 2, cy = H / 2 - 10, R = Math.min(W, H) * 0.36; const pos = {};
  const byKey = {}; nodes.forEach(n => { byKey[n.id] = n; byKey[String(n.id).replace('_', ':')] = n; byKey[(n.label || '').toLowerCase()] = n; });
  nodes.forEach((n, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(nodes.length, 1); pos[n.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const find = k => { const n = nodeOf(k); if (!n) return null; return byKey[n.id] || byKey[String(n.id).replace('_', ':')] || byKey[String(n.label).toLowerCase()] || nodes.find(x => String(n.label).toLowerCase() === x.label.toLowerCase()) || null; };
  let drawn = 0, unmatched = 0; const pairCount = {};
  for (const l of links) { const a = find(l.from), b = find(l.to); if (!a || !b || a === b) { unmatched++; continue; } drawn++;
    const key = a.id + '|' + b.id; const k = (pairCount[key] = (pairCount[key] || 0) + 1);
    const p = pos[a.id], q = pos[b.id]; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1; const bend = 10 + 14 * (k - 1); const ox = -dy / d * bend, oy = dx / d * bend;
    const flagged = l.flags.length > 0, inf = l.orthology;
    const stroke = flagged ? 'var(--expr)' : inf ? 'var(--mute)' : 'var(--ink)'; const width = (WIDTH[l.grade] || 1.2) * (flagged ? 0.6 : 1);
    const path = el('path', { d: `M${p.x + ox * 0.3} ${p.y + oy * 0.3} Q${(p.x + q.x) / 2 + ox * 3} ${(p.y + q.y) / 2 + oy * 3} ${q.x + ox * 0.3} ${q.y + oy * 0.3}`, fill: 'none', stroke, 'stroke-width': width, 'stroke-dasharray': inf ? '5 4' : flagged ? '2 3' : 'none', opacity: flagged ? 0.7 : 1, 'marker-end': `url(#${flagged ? 'arrowFlag' : inf ? 'arrowInf' : 'arrowExp'})`, class: 'ilink', style: 'cursor:pointer' }, svg);
    const lab = el('text', { x: (p.x + q.x) / 2 + ox * 3.2, y: (p.y + q.y) / 2 + oy * 3.2, 'font-size': 10.5, fill: stroke, 'text-anchor': 'middle' }, svg);
    lab.textContent = linkLabel(l) + ' [' + l.grade + (inf ? ', orthology' : '') + (flagged ? ', flagged' : '') + ']';
    const t = el('title', {}, path); t.textContent = `${a.label} → ${b.label}: ${linkLabel(l)}; grade ${l.grade}; context ${l.context}; ${l.sources.map(s => s.ref).filter(Boolean).join('; ') || 'no source'}${flagged ? '; flags: ' + l.flags.join('; ') : ''}`;
    path.onclick = () => opts.onLink && opts.onLink(l, a, b);
  }
  for (const n of nodes) { const p = pos[n.id]; const g = el('g', { class: 'inode', style: 'cursor:pointer' }, svg);
    if (opts.kind === 'cell') el('path', { d: `M${p.x} ${p.y - 13} l12 7 v12 l-12 7 l-12 -7 v-12z`, fill: n.hasRec ? 'var(--fill)' : 'var(--hollow)', stroke: 'var(--fill)', 'stroke-width': 1.6 }, g);
    else el('circle', { cx: p.x, cy: p.y, r: 12, fill: n.hasRec ? 'var(--fill)' : 'var(--hollow)', stroke: 'var(--fill)', 'stroke-width': 1.6 }, g);
    const t = el('text', { x: p.x, y: p.y + 28, 'font-size': 11.5, 'text-anchor': 'middle', fill: 'var(--ink)' }, g); t.textContent = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label;
    g.onclick = () => opts.onPick && opts.onPick(n.id); }
  const cap = el('text', { x: 130, y: H - 10, 'font-size': 11, fill: 'var(--mute)' }, svg); cap.textContent = opts.caption || '';
  return { drawn, unmatched };
}
