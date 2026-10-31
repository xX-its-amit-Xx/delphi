// Tissue-tissue and cell-cell interaction views for Open the Fish. Data: genotype/interactions.json (copied by
// dashboard/build-graph.mjs into ./interactions.json).
//
// Entry shape (Genotype thread, final): id, sender_node / receiver_node (id strings, ZFA or a post-composed
// "ZFA:x+ZFA:y"), sender_node_label / sender_node_level (same for receiver; null when the id is outside the fin subtree,
// then sender_label carries the words), node_not_in_subtree, signal {ligands, receptors, channels, pathway},
// evidence_grade, context, orthology_inferred + inferred_from, sources [{pmid, doi, first_author, year, quote}], agent
// (tissue | cellcell). Top level: unknown_node_ids {id: count} (ids outside the fin subtree), refuted_or_unsupported
// [{proposed, finding, sources, agent}], gaps, validation_flags, coverage.
// Drawing: grade sets stroke weight; orthology-inferred is dashed and lighter; flagged entries are drawn weaker still;
// contexts are never merged (a filter picks one); ids outside the subtree are drawn with a dashed outline and an
// "outside subtree" tag rather than dropped; refutations are crossed-out arrows, "not established in zebrafish".

export const GRADES = ['mechanism', 'sufficiency', 'necessity', 'association', 'hypothesis'];
export const CONTEXTS = ['development', 'regeneration', 'adult']; // selector values; a row matches when its context contains the value ('development and regeneration' is in both)
const arr = v => Array.isArray(v) ? v : v ? [v] : [];
const nodeOf = (x, label, level, outside) => { if (!x) return null; if (typeof x === 'string') return { id: x, label: label || x, level: level || null, outside: !!outside };
  return { id: x.id || x.term || x.node || x.label, label: x.label || label || x.id, level: x.level || level || null, outside: !!outside }; };
const srcOf = sr => typeof sr === 'string' ? { ref: sr, quote: null } : { ref: [sr.first_author, sr.year].filter(Boolean).join(' ') || (sr.pmid ? 'PMID ' + sr.pmid : sr.doi ? 'doi ' + sr.doi : sr.ref || sr.citation || sr.url || null), title: sr.title || null, read: sr.read || null, pmid: sr.pmid || null, doi: sr.doi || null, url: sr.url || (sr.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + sr.pmid + '/' : sr.doi ? 'https://doi.org/' + sr.doi : null), quote: sr.quote || sr.verbatim || null, organism: sr.organism || null };
// the arrow the tissue view leads with: Braunstein 2021, basal epidermis shha -> pre-osteoblast ptch2/smo
export const LEAD_MATCH = l => l.sources.some(s => /Braunstein/.test(s.ref || '')) && l.ligands.includes('shha') && l.receptors.some(r => /smo|ptch2/.test(r));
export function normaliseInteractions(raw) {
  if (!raw) return null;
  const unknown = raw.unknown_node_ids ? (Array.isArray(raw.unknown_node_ids) ? raw.unknown_node_ids : Object.keys(raw.unknown_node_ids)) : [];
  const unknownSet = new Set(unknown);
  const rows = raw.interactions || raw.entries || raw.links || (Array.isArray(raw) ? raw : []);
  const list = rows.map(x => {
    const sg = x.signal || {};
    const from = nodeOf(x.sender_node || x.sender || x.from, x.sender_node_label || x.sender_label, x.sender_node_level, unknownSet.has(x.sender_node) || (x.node_not_in_subtree && !x.sender_node_level));
    const to = nodeOf(x.receiver_node || x.receiver || x.to, x.receiver_node_label || x.receiver_label, x.receiver_node_level, unknownSet.has(x.receiver_node) || (x.node_not_in_subtree && !x.receiver_node_level));
    const grade = String(x.evidence_grade || x.grade || 'hypothesis').toLowerCase();
    return { id: x.id || null, from, to, fromWords: x.sender_label || null, toWords: x.receiver_label || null,
      ligands: arr(sg.ligands || x.ligands || x.ligand), receptors: arr(sg.receptors || x.receptors || x.receptor), channels: arr(sg.channels || x.channels || x.channel), pathway: sg.pathway || x.pathway || null, genes: arr(x.genes),
      grade: GRADES.includes(grade) ? grade : 'hypothesis', gradeRaw: x.evidence_grade || x.grade || null,
      context: String(x.context || 'unstated').toLowerCase(), orthology: !!(x.orthology_inferred || x.inferred_by_orthology), orthologySpecies: x.inferred_from || x.orthology_species || x.orthology_from || null,
      kind: x.kind || x.type || (arr(sg.channels).length ? 'gap junction / channel' : arr(sg.ligands).length ? 'ligand-receptor' : 'signalling'), organism: x.organism || null, flags: arr(x.flags || x.validator_flags),
      sources: arr(x.sources || x.source).map(srcOf), shown: x.what_is_shown || null, experiment: x.experiment_type || null, stage: x.stage || null, agent: x.agent || null, note: x.notes || x.note || null };
  }).filter(r => r.from && r.to);
  { const m = list.filter(LEAD_MATCH); const pick = m.find(l => !l.from.outside && !l.to.outside && l.agent === 'tissue') || m.find(l => !l.from.outside && !l.to.outside) || m[0]; list.forEach(l => { l.lead = l === pick; }); }
  const isCell = r => r.agent ? r.agent !== 'tissue' : (/cell/.test(String(r.from.level || '')) || /cell/.test(String(r.to.level || '')));
  const refuted = arr(raw.refuted_or_unsupported).map((r, i) => ({ n: i + 1, proposed: r.proposed || r.claim || r.statement || String(r), finding: r.finding || null, agent: r.agent || 'tissue', sources: arr(r.sources).map(srcOf) }));
  // words for ids outside the subtree, from the links that use them
  const outsideWords = {}; for (const l of list) for (const [n, w] of [[l.from, l.fromWords], [l.to, l.toWords]]) if (unknownSet.has(n.id) && w) outsideWords[n.id] = w;
  return { source: 'genotype/interactions.json', built: raw.built || raw.generated || null, note: raw.note || raw.constraint || raw.caveat || null, organism_note: raw.organism_note || raw.proxy || null,
    validator: raw.validator || raw.validation || null, validation_flags: raw.validation_flags || null, unknown, unknownCounts: raw.unknown_node_ids && !Array.isArray(raw.unknown_node_ids) ? raw.unknown_node_ids : null, outsideWords,
    refuted, gaps: raw.gaps || [], coverage: raw.coverage || null, vetted: raw.vetted === true, all: list, tissue: list.filter(r => !isCell(r)), cell: list.filter(isCell),
    contexts: [...new Set(list.map(r => r.context))], flagged: list.filter(r => r.flags.length).length, orthology: list.filter(r => r.orthology).length };
}
export const PENDING = { source: 'pending', note: 'genotype/interactions.json has not been written yet by the Genotype thread; the tissues and cell types shown are the ones already in the files, and no interaction is drawn, because none is sourced', all: [], tissue: [], cell: [], contexts: [], flagged: 0, orthology: 0, refuted: [], unknown: [], gaps: [], outsideWords: {} };

const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (p) p.appendChild(e); return e; };
const WIDTH = { mechanism: 3, sufficiency: 2.6, necessity: 2.2, association: 1.6, hypothesis: 1.1 };
export function linkLabel(l) { const g = [...l.ligands, ...l.channels].map(s => String(s).split(' (')[0]); const r = l.receptors.map(s => String(s).split(' (')[0]); let t = g.length ? g.slice(0, 3).join(', ') + (g.length > 3 ? ' +' + (g.length - 3) : '') : ''; if (r.length) t += (t ? ' → ' : '') + r.slice(0, 2).join(', ') + (r.length > 2 ? ' +' + (r.length - 2) : ''); if (!t && l.genes.length) t = l.genes.slice(0, 3).join(', '); if (!t && l.pathway) t = String(l.pathway).split(/[;(,]/)[0].slice(0, 28); return t || l.kind || ''; }
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// nodes: [{id,label,hasRec}], links: normalised rows (already filtered to one context);
// opts: kind, caption, outside [{id,label,count}], refuted [], onPick(id), onLink(link,a,b), onRefuted(r)
export function drawInteractionGraph(svg, nodes, links, opts) {
  svg.innerHTML = ''; const W = svg.clientWidth || 800, H = svg.clientHeight || 500; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const narrow = W < 640;
  const defs = el('defs', {}, svg);
  for (const [id, col] of [['arrowExp', 'var(--ink)'], ['arrowInf', 'var(--mute)'], ['arrowFlag', 'var(--expr)'], ['arrowLead', 'var(--accent)'], ['arrowRef', 'var(--bad)']]) { const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs); el('path', { d: 'M0 0L10 5L0 10z', fill: col }, m); }
  // node set: the view's nodes, plus every endpoint of a drawn link, plus the ids outside the fin subtree
  const all = nodes.map(n => ({ ...n })); const have = new Set(all.map(n => n.id));
  for (const l of links) for (const n of [l.from, l.to]) if (!have.has(n.id)) { have.add(n.id); all.push({ id: n.id, label: n.label || n.id, hasRec: false, outside: n.outside, added: !n.outside }); }
  for (const o of opts.outside || []) if (!have.has(o.id)) { have.add(o.id); all.push({ id: o.id, label: o.label, hasRec: false, outside: true, unlinked: true }); } else { const n = all.find(x => x.id === o.id); n.outside = true; }
  const refuted = opts.refuted || []; const refH = refuted.length ? (narrow ? 22 * refuted.length + 30 : 22 * Math.ceil(refuted.length / 2) + 34) : 0;
  const Hb = H - 64; // the stage buttons and the legend sit over the bottom of the canvas
  const cx = W / 2, cy = (Hb - refH) / 2 + 6, Rx = Math.max(80, W * (narrow ? 0.3 : 0.33)), Ry = Math.max(70, (Hb - refH) * 0.38); const pos = {};
  // on an ellipse: nodes with arrows spread evenly between nodes without, outside-subtree nodes together at the end
  const deg = {}; for (const l of links) { deg[l.from.id] = (deg[l.from.id] || 0) + 1; deg[l.to.id] = (deg[l.to.id] || 0) + 1; }
  const inner = all.filter(n => !n.outside), linked = inner.filter(n => deg[n.id]), bare = inner.filter(n => !deg[n.id]); const mixed = []; const step = bare.length / Math.max(linked.length, 1);
  linked.forEach((n, i) => { mixed.push(n); for (let j = Math.round(i * step); j < Math.round((i + 1) * step); j++) mixed.push(bare[j]); }); if (!linked.length) mixed.push(...bare);
  const order = [...mixed.filter(Boolean), ...all.filter(n => n.outside && deg[n.id]), ...all.filter(n => n.outside && !deg[n.id])];
  order.forEach((n, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(order.length, 1); pos[n.id] = { x: cx + Rx * Math.cos(a), y: cy + Ry * Math.sin(a), a }; });
  let drawn = 0; const pairCount = {}; const leadEls = [];
  const sorted = [...links].sort((a, b) => (a.lead ? 1 : 0) - (b.lead ? 1 : 0)); // the lead arrow on top
  for (const l of sorted) { const a = l.from.id, b = l.to.id; const p = pos[a], q0 = pos[b]; if (!p || !q0) continue; drawn++;
    const key = a + '|' + b; const k = (pairCount[key] = (pairCount[key] || 0) + 1);
    const flagged = l.flags.length > 0, inf = l.orthology, lead = !!l.lead;
    const stroke = lead ? 'var(--accent)' : flagged ? 'var(--expr)' : inf ? 'var(--mute)' : 'var(--ink)'; const width = (WIDTH[l.grade] || 1.2) * (flagged ? 0.6 : 1) * (lead ? 1.6 : 1);
    let d;
    if (a === b) { const ux = Math.cos(p.a), uy = Math.sin(p.a); const r0 = 16 + 7 * k; d = `M${p.x + ux * 12 - uy * 6} ${p.y + uy * 12 + ux * 6} C${p.x + ux * (r0 + 26) - uy * 22} ${p.y + uy * (r0 + 26) + ux * 22} ${p.x + ux * (r0 + 26) + uy * 22} ${p.y + uy * (r0 + 26) - ux * 22} ${p.x + ux * 12 + uy * 6} ${p.y + uy * 12 - ux * 6}`; }
    else { const q = q0; const dx = q.x - p.x, dy = q.y - p.y, dd = Math.hypot(dx, dy) || 1; const bend = 10 + 14 * (k - 1); const ox = -dy / dd * bend, oy = dx / dd * bend;
      // stop short of the node glyph
      const ex = q.x - dx / dd * 15, ey = q.y - dy / dd * 15, sx = p.x + dx / dd * 13, sy = p.y + dy / dd * 13;
      d = `M${sx + ox * 0.3} ${sy + oy * 0.3} Q${(p.x + q.x) / 2 + ox * 3} ${(p.y + q.y) / 2 + oy * 3} ${ex + ox * 0.3} ${ey + oy * 0.3}`; }
    const path = el('path', { d, fill: 'none', stroke, 'stroke-width': width, 'stroke-dasharray': inf ? '5 4' : flagged ? '2 3' : 'none', opacity: flagged ? 0.7 : lead ? 1 : 0.85, 'marker-end': `url(#${lead ? 'arrowLead' : flagged ? 'arrowFlag' : inf ? 'arrowInf' : 'arrowExp'})`, class: 'ilink', style: 'cursor:pointer' }, svg);
    // wide invisible hit area
    const hit = el('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 10, style: 'cursor:pointer' }, svg);
    let lx, ly; if (a === b) { lx = p.x + Math.cos(p.a) * (44 + 7 * k); ly = p.y + Math.sin(p.a) * (44 + 7 * k); } else { const q = q0; const dx = q.x - p.x, dy = q.y - p.y, dd = Math.hypot(dx, dy) || 1; const bend = 10 + 14 * (k - 1); lx = (p.x + q.x) / 2 - dy / dd * bend * 1.6; ly = (p.y + q.y) / 2 + dx / dd * bend * 1.6; }
    const lab = el('text', { x: lx, y: ly, 'font-size': lead ? 11.5 : 10, fill: stroke, 'text-anchor': 'middle', 'font-weight': lead ? 700 : 400, 'paint-order': 'stroke', stroke: 'var(--panel)', 'stroke-width': 3 }, svg);
    lab.textContent = (lead ? '★ ' : '') + linkLabel(l) + (lead ? ' (Braunstein 2021)' : '') + (inf ? ' [orthology]' : flagged ? ' [flagged]' : '');
    const t = el('title', {}, hit); t.textContent = `${l.from.label} → ${l.to.label}: ${linkLabel(l)}; grade ${l.grade}; context ${l.context}; ${l.sources.map(s => s.ref).filter(Boolean).join('; ') || 'no source'}${flagged ? '; flags: ' + l.flags.join('; ') : ''}`;
    path.onclick = hit.onclick = () => opts.onLink && opts.onLink(l, l.from, l.to);
    if (lead) leadEls.push(path);
  }
  for (const n of order) { const p = pos[n.id]; const g = el('g', { class: 'inode', style: 'cursor:pointer' }, svg);
    const fill = n.outside ? 'var(--panel)' : n.hasRec ? 'var(--fill)' : 'var(--hollow)'; const st = n.outside ? 'var(--warn)' : 'var(--fill)'; const dash = n.outside ? '3 2' : 'none';
    if (opts.kind === 'cell') el('path', { d: `M${p.x} ${p.y - 13} l12 7 v12 l-12 7 l-12 -7 v-12z`, fill, stroke: st, 'stroke-width': 1.6, 'stroke-dasharray': dash }, g);
    else el('circle', { cx: p.x, cy: p.y, r: 12, fill, stroke: st, 'stroke-width': 1.6, 'stroke-dasharray': dash }, g);
    const below = Math.sin(p.a) > -0.2; const ty = below ? p.y + 27 : p.y - 19;
    const anchor = Math.cos(p.a) > 0.35 ? 'start' : Math.cos(p.a) < -0.35 ? 'end' : 'middle'; const tx = anchor === 'start' ? p.x + 6 : anchor === 'end' ? p.x - 6 : p.x;
    const t = el('text', { x: tx, y: ty, 'font-size': narrow ? 9.5 : 11, 'text-anchor': anchor, fill: 'var(--ink)', 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 3 }, g); const room = anchor === 'end' ? tx - 4 : anchor === 'start' ? W - tx - 4 : W; t.textContent = short(n.label, Math.max(10, Math.min(narrow ? 22 : 34, Math.floor(room / (narrow ? 5.2 : 6)))));
    if (n.outside) { const o = el('text', { x: tx, y: ty + (below ? 12 : -12), 'font-size': 9.5, 'text-anchor': anchor, fill: 'var(--warn)', 'font-weight': 600 }, g); o.textContent = '⊘ outside subtree' + (n.unlinked ? ' (no arrow kept)' : ''); }
    const tt = el('title', {}, g); tt.textContent = n.id + (n.outside ? ': outside the pectoral fin subtree (genotype/fin-subtree.json); drawn, not dropped' : '');
    g.onclick = () => opts.onPick && opts.onPick(n.id, n); }
  // refutations: crossed-out arrows, "not established in zebrafish"
  if (refuted.length) { const top = Hb - refH + 4; el('line', { x1: 12, y1: top - 4, x2: W - 12, y2: top - 4, stroke: 'var(--line)' }, svg);
    const hd = el('text', { x: 14, y: top + 10, 'font-size': 11, fill: 'var(--bad)', 'font-weight': 700 }, svg); hd.textContent = `✕ Not established in zebrafish (${refuted.length} proposed arrows refuted or unsupported; click one for the verbatim quote)`;
    const cols = narrow ? 1 : 2, cw = (W - 28) / cols;
    refuted.forEach((r, i) => { const x0 = 14 + (i % cols) * cw, y0 = top + 30 + Math.floor(i / cols) * 22; const g = el('g', { style: 'cursor:pointer', class: 'iref' }, svg);
      el('line', { x1: x0, y1: y0 - 4, x2: x0 + 40, y2: y0 - 4, stroke: 'var(--bad)', 'stroke-width': 1.8, 'stroke-dasharray': '4 3', 'marker-end': 'url(#arrowRef)' }, g);
      el('path', { d: `M${x0 + 13} ${y0 - 11} l14 14 M${x0 + 27} ${y0 - 11} l-14 14`, stroke: 'var(--bad)', 'stroke-width': 2.2 }, g);
      const t = el('text', { x: x0 + 48, y: y0, 'font-size': 10.5, fill: 'var(--ink)', 'text-decoration': 'line-through' }, g); t.textContent = short(r.proposed.replace(/^The /, ''), Math.max(30, Math.floor((cw - 60) / 5.6)));
      el('rect', { x: x0, y: y0 - 15, width: cw - 8, height: 20, fill: 'transparent' }, g);
      const tt = el('title', {}, g); tt.textContent = 'Not established in zebrafish: ' + r.proposed;
      g.onclick = () => opts.onRefuted && opts.onRefuted(r); }); }
  const cap = el('text', { x: 14, y: refuted.length ? Hb - refH - 6 : Hb - 10, 'font-size': 11, fill: 'var(--mute)' }, svg); cap.textContent = opts.caption || '';
  return { drawn, unmatched: links.length - drawn, nodes: order.length, outside: order.filter(n => n.outside).length };
}
