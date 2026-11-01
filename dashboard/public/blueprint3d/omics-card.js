// Multi-omics gene card for the design studio. Reads the browser bundle built by omics/build-index.mjs:
//   omics/index.json   gene list [symbol, zfin_id, file, human_symbol, rows per layer, n_conflicts]
//   omics/parts.json   blueprint part (UBERON/CL) -> genes recorded there
//   omics/genes/<file>.json.gz   one card per gene (gzip JSON; decompressed here with DecompressionStream,
//                                or used as-is when the server already sent Content-Encoding: gzip)
// export renderOmics(el, symbolOrZfinId)  -> renders five collapsible layers into el
// export omicsGenesAt(partId)             -> [{symbol, layers}] for a blueprint part (or [] if none)
// Every row is a proxy-species (mostly zebrafish) or borrowed human-orthologue annotation: never a flying-fish
// measurement. No Aves data. A missing row means "not recorded", not "absent".

const BASE = new URL('omics/', import.meta.url);
const LAYERS = [
  ['genomic', 'Genomic', 'gene model, alleles and mutant phenotypes, orthology, disease'],
  ['transcriptomic', 'Transcriptomic', 'where and when the RNA is detected'],
  ['proteomic', 'Proteomic', 'protein detection, domains, location, interactions'],
  ['pathway', 'Pathway', 'GO, Reactome, KEGG, WikiPathways membership'],
  ['ptm', 'PTM', 'post-translational modification sites'],
];
const KIND = {
  measured: ['M', 'measured: an experiment\'s number'],
  curated: ['C', 'curated: a curator read a paper'],
  'inferred-electronic': ['E', 'inferred electronically (pipeline, IEA)'],
  predicted: ['P', 'predicted in silico'],
  'borrowed-ortholog': ['B', 'borrowed: annotation of the human orthologue, not of the fish gene'],
};
// features shown first (what a designer asks: which anatomy does it change, where is it, what does it do)
const FIRST = ['allele_phenotype', 'disease_model', 'expressed_in', 'expression_level', 'cell_type_marker', 'not_expressed_in', 'protein_detected', 'protein_abundance', 'subcellular_location', 'domain', 'key_pathway_member', 'pathway_member', 'go_process', 'phospho_site', 'ortholog'];
const rank = f => { const i = FIRST.indexOf(f); return i < 0 ? 99 : i; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let IDX = null, PARTS = null; const CARDS = new Map();

async function json(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(`${url.pathname || url}: HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot gunzip (no DecompressionStream)');
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(s).text());
  }
  return JSON.parse(new TextDecoder().decode(buf));
}
async function index() {
  if (!IDX) IDX = json(new URL('index.json', BASE)).then(j => {
    const by = new Map();
    for (const [s, z, f, h, n, c, a] of j.genes) { const g = { s, z, f, h, n, c }; by.set(s.toLowerCase(), g); by.set(z, g); for (const x of a || []) if (!by.has(x.toLowerCase())) by.set(x.toLowerCase(), g); if (h && !by.has('h:' + h.toLowerCase())) by.set('h:' + h.toLowerCase(), g); }
    return { ...j, by };
  });
  return IDX;
}
export async function omicsGenesAt(partId) {
  if (!PARTS) PARTS = json(new URL('parts.json', BASE)).catch(() => ({}));
  const P = await PARTS; const id = String(partId || '').replace(/^(UBERON|CL)_/, '$1:');
  const p = P[id]; if (!p) return [];
  const L = { g: 'genomic', t: 'transcriptomic', p: 'proteomic', pw: 'pathway', m: 'ptm' };
  return p.genes.map(([s, l]) => ({ symbol: s, layers: (l.match(/pw|g|t|p|m/g) || []).map(x => L[x]) }));
}

function style() {
  if (document.getElementById('omics-card-css')) return;
  const st = document.createElement('style'); st.id = 'omics-card-css';
  st.textContent = `
.omx{margin-top:8px;font-size:.84rem}
.omx h5{margin:6px 0 2px;font-size:.9rem}
.omx details.oml{border:1px solid var(--line,#d9dfdb);border-radius:8px;margin:5px 0;background:var(--panel,#fff)}
.omx details.oml>summary{cursor:pointer;padding:5px 8px;list-style:revert}
.omx .omf{padding:2px 8px 6px}
.omx .omf>summary{cursor:pointer;font-weight:600;font-size:.82rem}
.omx table{width:100%;border-collapse:collapse;table-layout:fixed}
.omx td{border-top:1px solid var(--line,#d9dfdb);padding:3px 4px;vertical-align:top;overflow-wrap:anywhere}
.omx td.v{width:52%}
.omx .k{display:inline-block;min-width:1.3em;text-align:center;border-radius:4px;font-size:.7rem;font-weight:700;padding:0 3px;margin-right:2px;border:1px solid var(--line,#d9dfdb)}
.omx .k.M{background:color-mix(in srgb,var(--ok,#2f7d4f) 22%,transparent)}
.omx .k.C{background:color-mix(in srgb,var(--accent,#0e7c86) 20%,transparent)}
.omx .k.E,.omx .k.P{background:var(--soft,#eef2ef)}
.omx .k.B{background:color-mix(in srgb,var(--warn,#a8650b) 22%,transparent)}
.omx .cc{font-variant-numeric:tabular-nums;font-weight:700}
.omx .cc.n2{color:var(--ok,#2f7d4f)}
.omx .mute,.omx .tiny{color:var(--mute,#5a6b69);font-size:.76rem}
.omx .conf{border-left:3px solid var(--warn,#a8650b);padding:3px 8px;margin:4px 0;background:var(--soft,#eef2ef)}
.omx .bp{color:var(--accent,#0e7c86);font-weight:600}
.omx .err{color:var(--bad,#b3392f)}`;
  document.head.appendChild(st);
}
const kinds = ks => (ks || []).map(k => { const [a, t] = KIND[k] || ['?', k]; return `<span class="k ${a}" title="${esc(t)}">${a}</span>`; }).join('');
function entryRow(e) {
  const anat = e.anatomy ? `<div class="tiny">${e.anatomy.bp ? '<span class="bp" title="a part of the flying-fish blueprint">●</span> ' : ''}${esc(e.anatomy.label || e.anatomy.id)} <span class="mute">${esc(e.anatomy.uberon || e.anatomy.id)}</span></div>` : '';
  const stg = e.stages ? `<div class="tiny">stage: ${esc(e.stages.join(', '))}</div>` : '';
  const cells = e.cells ? `<div class="tiny">cell: ${esc(e.cells.join(', '))}</div>` : '';
  const sp = e.species ? `<div class="tiny">species: ${esc(e.species.join(', '))}</div>` : '';
  const rng = e.range ? ` <span class="tiny">(${esc(e.range[0])}–${esc(e.range[1])}${e.unit ? ' ' + esc(e.unit) : ''})</span>` : (e.unit && e.unit !== 'count' ? ` <span class="tiny">${esc(e.unit)}</span>` : '');
  const src = e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.sources.join(', '))}</a>` : esc(e.sources.join(', '));
  return `<tr><td class="v">${esc(e.v)}${rng}${anat}${stg}${cells}${sp}</td><td>${kinds(e.kind)} <span class="cc${e.n_sources > 1 ? ' n2' : ''}" title="independent sources agreeing">${e.n_sources}×</span><div class="tiny">${src}${e.n > 1 ? ` · ${e.n} rows` : ''}</div></td></tr>`;
}
function layerHtml(key, title, blurb, L, open) {
  if (!L) return `<details class="oml"><summary><b>${title}</b> <span class="tiny">no rows recorded</span></summary><p class="tiny" style="padding:0 8px">${esc(blurb)}. Nothing in these sources for this gene: not recorded, not absent.</p></details>`;
  const srcs = Object.entries(L.sources).sort((a, b) => b[1] - a[1]);
  const feats = Object.entries(L.features).sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].n_multi_source - a[1].n_multi_source || b[1].n_rows - a[1].n_rows);
  const c = L.concordance || {};
  let h = `<details class="oml"${open ? ' open' : ''}><summary><b>${title}</b> <span class="tiny">${L.rows} rows · ${srcs.length} sources · ${c.multi_source_groups || 0} of ${c.groups || 0} facts stated by ≥2 sources</span></summary>`;
  h += `<div class="tiny" style="padding:0 8px">${srcs.map(([s, n]) => `${esc(s)} ${n}`).join(' · ')}</div>`;
  for (const [f, F] of feats) {
    h += `<details class="omf"><summary>${esc(f.replace(/_/g, ' '))} <span class="tiny">${F.n_distinct} distinct${F.n_multi_source ? ` · ${F.n_multi_source} multi-source` : ''}</span></summary><table>${F.entries.map(entryRow).join('')}</table>${F.truncated ? `<p class="tiny">+${F.truncated} more (full card: omics_gene MCP tool or omics/index/genes/)</p>` : ''}</details>`;
  }
  return h + '</details>';
}
function conflictsHtml(cs) {
  if (!cs || !cs.length) return '<p class="tiny">No conflicts between sources detected (for the checks run: single-valued features, opposite expression calls at one anatomy, human orthologue calls).</p>';
  return `<details class="oml"><summary><b>Conflicts between sources (${cs.length})</b></summary>${cs.map(c => `<div class="conf"><b class="small">${esc(c.layer)} · ${esc(c.feature)}</b> <span class="tiny">${esc(c.type)}${c.n ? ` · ${c.n} anatomies` : ''}</span>${c.values ? `<div class="tiny">${c.values.map(v => `${esc(v.v)} (${esc(v.sources.join(', '))})`).join(' vs ')}</div>` : ''}${c.examples ? `<div class="tiny">${c.examples.map(x => esc(x.anatomy ? `${x.anatomy}: ${Object.entries(x).filter(([k]) => /expressed|detected/.test(k)).map(([k, v]) => `${k.replace(/_/g, ' ')} by ${v.join(', ')}`).join(' / ')}` : `${x.v} (${(x.sources || []).join(', ')})`)).join('<br>')}</div>` : ''}</div>`).join('')}</details>`;
}

export async function renderOmics(el, q) {
  if (!el) return; style();
  el.classList.add('omx');
  el.innerHTML = '<p class="tiny">loading multi-omics…</p>';
  try {
    const I = await index(); const k = String(q || '').trim();
    const g = I.by.get(k.toLowerCase()) || I.by.get(k.replace(/^Z[FI]N?:/, '')) || I.by.get('h:' + k.toLowerCase());
    if (!g) { el.innerHTML = `<h5>Multi-omics</h5><p class="tiny">${esc(k)} is not in the omics gene universe (the 3,860 genes behind the blueprint's pathways, causal chains and interventions).</p>`; return; }
    if (!CARDS.has(g.f)) CARDS.set(g.f, json(new URL('genes/' + encodeURIComponent(g.f) + '.json.gz', BASE)));
    const c = await CARDS.get(g.f);
    const x = c.xrefs || {};
    const ho = x.human_ortholog;
    let h = `<h5>Multi-omics: ${esc(c.symbol)}</h5>
      <p class="tiny">${esc(c.zfin_id)}${x.ensembl_gene ? ' · ' + esc(x.ensembl_gene) : ''}${x.ncbi_gene ? ' · NCBI ' + esc(x.ncbi_gene) : ''}${x.uniprot ? ` · UniProt ${esc(x.uniprot)} (${esc(x.uniprot_status)})` : ''}${ho ? ` · human ${esc(ho.symbol)} ${esc(ho.hgnc_id || '')}` : ''}${x.flying_fish ? ` · flying fish ${esc(x.flying_fish.protein)} (${esc(x.flying_fish.pident)} % id)` : ''}</p>
      <p class="tiny">Zebrafish proxy and borrowed human-orthologue records; none is a flying-fish measurement. Badges: ${Object.values(KIND).map(([a, t]) => `<span class="k ${a}" title="${esc(t)}">${a}</span>${esc(t.split(':')[0])}`).join(' ')}. <span class="cc">n×</span> = independent databases stating the same fact (agreement between curations, not replication).</p>`;
    h += LAYERS.map(([key, title, blurb], i) => layerHtml(key, title, blurb, c.layers[key], false)).join('');
    h += conflictsHtml(c.conflicts);
    el.innerHTML = h;
  } catch (e) {
    el.innerHTML = `<h5>Multi-omics</h5><p class="tiny err">omics bundle not available: ${esc(e.message)}</p>`;
  }
}
