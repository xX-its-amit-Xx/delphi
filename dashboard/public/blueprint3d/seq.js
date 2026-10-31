// Sequences view for Open the Fish (?mode=sequences). Data: sequences/ (copied by dashboard/build-graph.mjs into
// ./sequences/): genes.json, alignments/<gene>.json, genome-regions.json, engineered-diff.json. Four views:
// (a) alignment per gene, zoomable to residues, species rows, variant sites highlighted, click a site for its source;
// (b) % identity heatmap per gene (species x species) plus the median across genes;
// (c) genome-region track coloured by kind (coding substitution, accelerated CNE, bat enhancer);
// (d) engineered edits vs between-lineage divergence, log scale, labelled.
// Birds are the holdout: no bird row is ever drawn (rows whose group or name says bird/Aves are dropped and counted),
// and the data's one-line note is shown. Pterosaurs: no DNA exists. Until the files land, a STAND-IN with placeholder
// residues and numbers is drawn under a hatched banner that says so; it is a layout test, not data.

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const arr = v => Array.isArray(v) ? v : v ? [v] : [];
const BIRD = /\b(aves|bird|gallus|chicken|taeniopygia|zebra finch|columba|anas|meleagris)\b/i;
export const KIND_ORDER = ['coding substitution', 'accelerated CNE', 'bat enhancer']; // categorical slots 1-3, fixed order
const kindKey = k => { const s = String(k || '').toLowerCase(); return /enhancer|bat/.test(s) ? 'bat enhancer' : /cne|accelerat|non-?coding|conserved/.test(s) ? 'accelerated CNE' : /cod|substitut|missense|amino/.test(s) ? 'coding substitution' : (k || 'other'); };
export const PTEROSAUR_NOTE = 'Pterosaurs: no DNA exists (extinct ~66 million years); no pterosaur sequence can appear here.';

// ---------- normalise whatever shape lands ----------
export function normalise(raw) {
  const out = { source: raw.source, genes: [], aln: {}, regions: null, diff: null, birdNote: null, dropped: 0, notes: [], unread: [] };
  const G = raw.genes;
  // sequences/genes.json keys its genes by symbol; the earlier shape was a list. Accept both.
  const gsrc = G && G.genes ? G.genes : G;
  const glist = !gsrc ? [] : Array.isArray(gsrc) ? gsrc
    : (gsrc && typeof gsrc === 'object' && !gsrc.gene && !gsrc.symbol) ? Object.entries(gsrc).map(([k, v]) => ({ ...(v && typeof v === 'object' ? v : {}), gene: k }))
    : arr(gsrc);
  out.genes = glist.map(g => typeof g === 'string' ? { gene: g } : { gene: g.gene || g.symbol || g.id, label: g.label || g.name || null, note: g.note || g.why || g.description || null, zfin: g.zfin_id || null }).filter(g => g.gene);
  out.birdNote = (G && (G.birds_note || G.holdout_note || G.bird_note)) || (raw.regions && (raw.regions.birds_note || raw.regions.holdout_note)) || null;
  for (const [gene, a] of Object.entries(raw.aln || {})) { if (!a) continue;
    // two shapes. OLD: a list of {species, seq}. REAL (sequences/alignments/*.json): alignment is a map
    // key -> aligned string, and sequences is a map key -> {species, common, role, protein_id, length}.
    let rows;
    if (a.alignment && !Array.isArray(a.alignment) && typeof a.alignment === 'object' && typeof Object.values(a.alignment)[0] === 'string') {
      const meta = (a.sequences && typeof a.sequences === 'object' && !Array.isArray(a.sequences)) ? a.sequences : {};
      rows = Object.entries(a.alignment).map(([k, seq]) => { const m = meta[k] || {};
        return { key: k, name: m.species || k.replace(/^[a-z0-9]+:/, '').replace(/_/g, ' '), group: m.role || m.group || m.clade || null,
          seq: String(seq || ''), accession: m.protein_id || m.gene_id || null, common: m.common || null, homology: m.homology_type || null }; });
    } else {
      rows = arr(a.rows || a.sequences || a.species || a.alignment).map(r => ({ key: r.id || r.name, name: r.species || r.name || r.taxon || r.id,
        group: r.group || r.clade || r.lineage || null, seq: String(r.seq || r.sequence || r.aligned || ''), accession: r.accession || r.id || null }));
    }
    const before = rows.length; rows = rows.filter(r => !BIRD.test([r.name, r.group, r.common, r.key].filter(Boolean).join(' '))); out.dropped += before - rows.length;
    const id = a.identity || a.percent_identity || a.pid || null; let ids = null;
    const Mraw = id && (id.matrix || (Array.isArray(id) ? id : null));
    if (Mraw && !Array.isArray(Mraw) && typeof Mraw === 'object') {
      // nested object: {key: {key: percent}}. Keep the keys that survived the bird filter, in the rows' order.
      const label = k => { const r = rows.find(x => x.key === k); return r ? r.name : k.replace(/^[a-z0-9]+:/, '').replace(/_/g, ' '); };
      const keys = Object.keys(Mraw).filter(k => !BIRD.test(k + ' ' + label(k)));
      out.dropped += Object.keys(Mraw).length - keys.length;
      ids = keys.length ? { names: keys.map(label), M: keys.map(i => keys.map(j => { const v = (Mraw[i] || {})[j]; return typeof v === 'number' ? v : null; })) } : null;
    } else if (Mraw) { const names = id.species || id.names || rows.map(r => r.name); const M = Mraw;
      const keep = names.map((n, i) => !BIRD.test(n) && Array.isArray(M[i]) ? i : -1).filter(i => i >= 0);
      ids = keep.length ? { names: keep.map(i => names[i]), M: keep.map(i => keep.map(j => M[i][j])) } : null; }
    if (!ids && rows.length > 1 && rows[0].seq) ids = identityFrom(rows);
    const variants = arr(a.variants || a.variant_sites || a.sites || a.marked).map(v => ({ pos: +(v.alignment_column_1based ?? v.column ?? v.aln_pos ?? v.pos ?? v.position), label: v.label || v.name || v.substitution || v.change || (v.ref && v.alt ? v.ref + (v.pos ?? '') + v.alt : v.id || ''), id: v.id || null, ref: v.ref || null, alt: v.alt || null, what: v.what || v.note || null, posOwn: v.pos ?? null, anchor: v.window_anchor || null, residues: v.residues || null, refMatches: v.reference_matches ?? null, kind: v.kind || v.type || null, source: v.source || v.ref || v.citation || null, url: v.url || (v.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + v.pmid + '/' : v.doi ? 'https://doi.org/' + v.doi : null), quote: v.quote || null, note: v.note || null, protein_pos: v.protein_pos || v.residue || null })).filter(v => isFinite(v.pos));
    out.aln[gene] = { gene, rows, ids, variants, type: a.type || a.molecule || (rows[0] && /^[ACGTUN-]+$/i.test(rows[0].seq.slice(0, 60)) ? 'nucleotide' : 'protein'), note: a.note || null, source: a.source || null, offset: +(a.offset || a.start || 1) };
  }
  const R = raw.regions; if (R) { const rows = arr(R.regions || R.loci || R); const keep = rows.filter(r => !BIRD.test(JSON.stringify([r.species, r.taxon, r.group]))); out.dropped += rows.length - keep.length;
    out.regions = { note: R.note || null, rows: keep.map(r => ({ id: r.id || r.name, locus: r.locus || r.gene || r.nearest_gene || r.name || r.id, chrom: r.chrom || r.chromosome || r.scaffold || null, start: r.start ?? null, end: r.end ?? null, kind: kindKey(r.kind || r.type || r.category), kindRaw: r.kind || r.type || null, species: r.species || r.taxon || null, source: r.source || r.ref || null, url: r.url || (r.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + r.pmid + '/' : r.doi ? 'https://doi.org/' + r.doi : null), quote: r.quote || null, note: r.note || null })) }; }
  const Df = raw.diff; if (Df) { const rows = arr(Df.rows || Df.comparisons || Df.bars || Df); out.diff = { note: Df.note || null, unit: Df.unit || 'differences', rows: rows.filter(r => !BIRD.test(JSON.stringify(r))).map(r => ({ label: r.label || r.name || r.comparison, value: +(r.value ?? r.count ?? r.edits ?? r.differences ?? r.n), kind: r.kind || r.type || null, note: r.note || r.basis || null, source: r.source || null })).filter(r => r.label && r.value > 0) }; }
  // a file that is present but whose shape this view does not read is named, not quietly shown as empty
  const topKeys = o => (o && typeof o === 'object' && !Array.isArray(o)) ? Object.keys(o) : [];
  if (raw.regions && (!out.regions || !out.regions.rows.length)) out.unread.push({ file: 'genome-regions.json', keys: topKeys(raw.regions) });
  if (raw.diff && (!out.diff || !out.diff.rows.length)) out.unread.push({ file: 'engineered-diff.json', keys: topKeys(raw.diff) });
  return out;
}
function identityFrom(rows) { const n = rows.length, M = []; for (let i = 0; i < n; i++) { M.push([]); for (let j = 0; j < n; j++) { let same = 0, tot = 0; const a = rows[i].seq, b = rows[j].seq; for (let k = 0; k < Math.min(a.length, b.length); k++) { if (a[k] === '-' && b[k] === '-') continue; tot++; if (a[k] === b[k] && a[k] !== '-') same++; } M[i].push(tot ? 100 * same / tot : null); } } return { names: rows.map(r => r.name), M, computed: true }; }
export function medianIdentity(aln) {
  const all = Object.values(aln).filter(a => a.ids); const names = [...new Set(all.flatMap(a => a.ids.names))]; if (!names.length) return null;
  const M = names.map(a => names.map(b => { const v = all.map(x => { const i = x.ids.names.indexOf(a), j = x.ids.names.indexOf(b); return i >= 0 && j >= 0 ? x.ids.M[i][j] : null; }).filter(v => v != null).sort((p, q) => p - q); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; }));
  const counts = names.map(a => names.map(b => all.filter(x => x.ids.names.includes(a) && x.ids.names.includes(b)).length));
  return { names, M, counts, genes: all.length };
}

// ---------- stand-in (layout test only) ----------
export function standin() {
  const sp = [['flying fish (taxon A)', 'Beloniformes'], ['halfbeak (taxon B)', 'Beloniformes'], ['medaka (taxon C)', 'Beloniformes'], ['zebrafish (taxon D)', 'Cypriniformes'], ['bat (taxon E)', 'Chiroptera']];
  const mk = (seed, L) => { let x = seed; const out = []; for (let i = 0; i < L; i++) { x = (x * 1103515245 + 12345) % 2147483648; out.push('X'); } return out.join(''); };
  const aln = {};
  for (const [gi, g] of ['gene 1 (stand-in)', 'gene 2 (stand-in)'].entries()) { const L = 120; const rows = sp.map(([n, grp], i) => ({ species: n, group: grp, seq: mk(i + gi, L).split('').map((c, k) => (k % 17 === (i + gi) % 17 ? '-' : c)).join('') }));
    const M = sp.map((a, i) => sp.map((b, j) => i === j ? 100 : 100 - 6 * Math.abs(i - j) - 3 * gi));
    aln[g] = { rows, identity: { species: sp.map(s => s[0]), matrix: M }, variants: [{ column: 40 + 20 * gi, label: 'marked site (stand-in)', source: 'stand-in: no source', note: 'layout test' }] };
  }
  return { source: 'stand-in', genes: { genes: Object.keys(aln).map(g => ({ gene: g, note: 'stand-in' })), birds_note: 'Birds (Aves) are the frozen holdout: no bird sequence is used (stand-in note).' }, aln,
    regions: { note: 'stand-in', regions: [{ id: 'r1', locus: 'locus 1', kind: 'coding substitution' }, { id: 'r2', locus: 'locus 2', kind: 'accelerated CNE' }, { id: 'r3', locus: 'locus 3', kind: 'accelerated CNE' }, { id: 'r4', locus: 'locus 4', kind: 'bat enhancer' }] },
    diff: { note: 'stand-in', unit: 'differences', rows: [{ label: 'engineered design (stand-in)', value: 3, kind: 'engineered' }, { label: 'lineage pair 1 (stand-in)', value: 300, kind: 'divergence' }, { label: 'lineage pair 2 (stand-in)', value: 30000, kind: 'divergence' }] } };
}

// ---------- views ----------
const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
const seqCol = (v, lo, hi) => v == null ? 'transparent' : SEQ[Math.max(0, Math.min(SEQ.length - 1, Math.round((v - lo) / Math.max(1e-9, hi - lo) * (SEQ.length - 1))))];
export function alignmentHtml(A, zoom) {
  if (!A || !A.rows.length) return '<p class="small">No alignment for this gene.</p>';
  const L = Math.max(...A.rows.map(r => r.seq.length)); const w = zoom; const vset = new Map(A.variants.map(v => [v.pos, v])); const letters = w >= 9;
  const ruler = []; for (let k = 0; k < L; k += (w >= 9 ? 10 : w >= 4 ? 25 : 50)) ruler.push(`<span style="position:absolute;left:${k * w}px" class="tiny">${k + A.offset}</span>`);
  const marks = A.variants.map(v => `<button class="sqv" data-site="${v.pos}" title="${esc(v.label)}: click for its source" style="left:${(v.pos - A.offset) * w - 5 + w / 2}px">▲</button>`).join('');
  const rows = A.rows.map(r => `<div class="sqrow"><span class="sqn" title="${esc(r.group || '')}">${esc(r.name)}</span><span class="sqs" style="width:${L * w}px">${letters ? r.seq.split('').map((c, k) => `<i class="${vset.has(k + A.offset) ? 'hv' : ''}${c === '-' ? ' gap' : ''}" style="width:${w}px">${esc(c)}</i>`).join('') : `<canvas class="sqc" data-seq="${esc(r.seq)}" width="${L * w}" height="12"></canvas>`}</span></div>`).join('');
  return `<div class="sqscroll"><div class="sqruler" style="width:${L * w + 150}px"><span class="sqn"></span><span style="position:relative;display:inline-block;width:${L * w}px;height:14px">${ruler.join('')}${marks}</span></div>${rows}</div>`;
}
export function paintMini(root, A, w) { const vset = new Set(A.variants.map(v => v.pos - A.offset)); root.querySelectorAll('canvas.sqc').forEach(c => { const g = c.getContext('2d'); const s = c.dataset.seq; for (let k = 0; k < s.length; k++) { g.fillStyle = s[k] === '-' ? 'rgba(128,128,128,0.15)' : vset.has(k) ? '#eb6834' : 'rgba(90,107,105,0.55)'; g.fillRect(k * w, 2, Math.max(1, w - (w > 2 ? 1 : 0)), 8); } }); }
export function heatmapHtml(ids, title, counts) {
  if (!ids) return '<p class="small">No identity matrix.</p>'; const vals = ids.M.flat().filter(v => v != null); const lo = Math.min(...vals), hi = Math.max(...vals);
  const n = ids.names.length; const cell = n > 8 ? 34 : 46;
  return `<div class="hm"><div class="tiny" style="margin:0 0 4px">${esc(title)} · % identity, darker = more similar (scale ${lo.toFixed(0)} to ${hi.toFixed(0)} %)</div><table class="hmt"><tr><th></th>${ids.names.map(nm => `<th class="hmc" title="${esc(nm)}"><span>${esc(nm)}</span></th>`).join('')}</tr>${ids.names.map((a, i) => `<tr><th class="hmr">${esc(a)}</th>${ids.names.map((b, j) => { const v = ids.M[i][j]; const dark = v != null && (v - lo) / Math.max(1e-9, hi - lo) > 0.55; return `<td title="${esc(a)} vs ${esc(b)}: ${v == null ? 'no data' : v.toFixed(1) + ' %'}${counts ? ' (median of ' + counts[i][j] + ' genes)' : ''}" style="width:${cell}px;height:${cell * 0.7}px;background:${seqCol(v, lo, hi)};color:${dark ? '#fff' : 'var(--ink)'}">${v == null ? '–' : v.toFixed(0)}</td>`; }).join('')}</tr>`).join('')}</table></div>`;
}
export function regionTrackSvg(R, W) {
  if (!R || !R.rows.length) return '<p class="small">No genome regions.</p>';
  const kinds = [...KIND_ORDER.filter(k => R.rows.some(r => r.kind === k)), ...[...new Set(R.rows.map(r => r.kind))].filter(k => !KIND_ORDER.includes(k))];
  const COL = { 'coding substitution': 'var(--s1)', 'accelerated CNE': 'var(--s2)', 'bat enhancer': 'var(--s3)' }; const SHAPE = { 'coding substitution': 'circle', 'accelerated CNE': 'square', 'bat enhancer': 'diamond' };
  const loci = [...new Set(R.rows.map(r => r.locus))]; const rowH = 22, top = 34, left = 150; const H = top + loci.length * rowH + 10; const colW = Math.max(90, (W - left - 20) / Math.max(kinds.length, 1));
  const glyph = (k, x, y) => SHAPE[k] === 'square' ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2" fill="${COL[k] || 'var(--mute)'}"/>` : SHAPE[k] === 'diamond' ? `<path d="M${x} ${y - 6}l6 6l-6 6l-6 -6z" fill="${COL[k] || 'var(--mute)'}"/>` : `<circle cx="${x}" cy="${y}" r="5.5" fill="${COL[k] || 'var(--mute)'}"/>`;
  let s = `<svg class="rt" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="genome regions by kind">`;
  kinds.forEach((k, i) => { const x = left + i * colW + colW / 2; s += `${glyph(k, x - 50, 14)}<text x="${x - 40}" y="18" font-size="11" fill="var(--ink)">${esc(k)} (${R.rows.filter(r => r.kind === k).length})</text>`; });
  loci.forEach((l, li) => { const y = top + li * rowH + 10; s += `<line x1="${left}" x2="${W - 10}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${left - 8}" y="${y + 4}" font-size="11" text-anchor="end" fill="var(--ink)">${esc(String(l).slice(0, 22))}</text>`;
    kinds.forEach((k, i) => { const hits = R.rows.filter(r => r.locus === l && r.kind === k); if (!hits.length) return; const x = left + i * colW + colW / 2; s += `<g class="rth" data-reg="${esc(hits[0].id)}" style="cursor:pointer"><title>${esc(l)}: ${hits.length} ${esc(k)}${hits[0].source ? ' · ' + esc(hits[0].source) : ''}</title><rect x="${x - colW / 2 + 4}" y="${y - 9}" width="${colW - 8}" height="18" fill="transparent"/>${glyph(k, x, y)}${hits.length > 1 ? `<text x="${x + 9}" y="${y + 4}" font-size="10" fill="var(--mute)">×${hits.length}</text>` : ''}</g>`; }); });
  return s + '</svg>';
}
export function diffBarsSvg(Df, W) {
  if (!Df || !Df.rows.length) return '<p class="small">No engineered-vs-divergence data.</p>';
  const rows = [...Df.rows].sort((a, b) => a.value - b.value); const left = 230, right = 70, top = 22, bh = 18, gap = 10; const H = top + rows.length * (bh + gap) + 34;
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...rows.map(r => r.value))))), hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...rows.map(r => r.value)))));
  const X = v => left + (W - left - right) * (Math.log10(v) - Math.log10(lo)) / Math.max(1e-9, Math.log10(hi) - Math.log10(lo));
  let s = `<svg class="db" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="engineered edits versus between-lineage divergence, log scale">`;
  for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e++) { const x = X(Math.pow(10, e)); s += `<line x1="${x}" x2="${x}" y1="${top - 6}" y2="${H - 26}" stroke="var(--line)"/><text x="${x}" y="${H - 12}" font-size="10.5" text-anchor="middle" fill="var(--mute)">${Math.pow(10, e).toLocaleString()}</text>`; }
  s += `<text x="${W - right}" y="${H - 1}" font-size="10.5" text-anchor="end" fill="var(--mute)">${esc(Df.unit)} (log scale)</text>`;
  rows.forEach((r, i) => { const y = top + i * (bh + gap); const eng = /engineer|edit|design/i.test(r.kind || r.label); const x1 = X(r.value);
    s += `<g><title>${esc(r.label)}: ${r.value.toLocaleString()} ${esc(Df.unit)}${r.note ? ' · ' + esc(r.note) : ''}</title><text x="${left - 8}" y="${y + bh / 2 + 4}" font-size="11" text-anchor="end" fill="var(--ink)">${esc(String(r.label).slice(0, 36))}</text><rect x="${left}" y="${y}" width="${Math.max(2, x1 - left)}" height="${bh}" rx="4" fill="${eng ? 'var(--s2)' : 'var(--s1)'}"/><text x="${x1 + 6}" y="${y + bh / 2 + 4}" font-size="11" fill="var(--ink)">${r.value.toLocaleString()}${eng ? ' · engineered' : ''}</text></g>`; });
  return s + '</svg>';
}
