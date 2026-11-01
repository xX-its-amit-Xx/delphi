/**
 * validate-show act: GENE NETWORKS, REGULATION, METABOLISM, DEVELOPMENT, CAUSAL CHAINS
 * Owner: networks thread.  Contract: ./SCENES.md v2 (mountScene + §4 provenance + §10 generality).
 *
 * WHY 2D SVG AND NOT three.js
 * --------------------------------------------------------------------------
 * This act is four node-link / matrix / chain diagrams whose whole job is reading small text next
 * to small marks. SVG wins on every axis that matters here: text stays crisp and selectable at
 * 390 px, four evidence classes get dash patterns for free (so nothing is colour-only), there is
 * no WebGL context to leak on dispose, `seek(t)` is trivially pure because every frame is a
 * reflow of attributes from t, and `prefers-reduced-motion` is one branch. A 3D network of 22
 * nodes would be a hairball with occluded labels and no benefit. `THREE` is therefore ignored by
 * design, as SCENES.md §2 permits.
 *
 * NOTHING ABOUT THIS FILE IS SPECIFIC TO ANY ORGANISM, GENE, PATHWAY OR BODY PART (SCENES.md §10).
 * The subject is resolved at runtime from `data.case.changed[].part` / `data.design.edits[].gene`,
 * and every number on screen is computed from the repo's real served data for THOSE genes and
 * THOSE parts. There is no gene list, no pathway list, no anatomy list and no narration string
 * written for fins. The only lexical table in the file is METABOLIC_WORDS, which selects metabolic
 * pathways by matching real ontology labels; it is named on screen as a lexical filter.
 *
 * ALL DATA IS REAL AND SAME-ORIGIN under dashboard/public/blueprint3d/:
 *   omics/index.json        3,860-gene index, rows-per-layer per gene  (gene ranking)
 *   omics/parts.json        UBERON/CL part -> genes with evidence in it (the generic part->gene bridge)
 *   omics/genes/<sym>.json.gz  per-gene card: pathway + transcriptomic features with source lists,
 *                           evidence `kind`s, anatomy (ZFA+UBERON), stages, n_sources
 *   causal-chains.json      gene -> phenotype chains with per-link evidence grade + weakest_link
 *   physiology/circulation.json, physiology/gills.json   the O2 supply chain with per-value kind/species/source
 *   development/stages.json, model/<id>-dev-manifest.json   staged growth with per-field kind/source
 * KEGG is never fetched or shown: it is local-only for licence (omics/pathway/SOURCES.md).
 * No Aves data is read, derived or displayed.
 */

/* ------------------------------------------------------------------ palette */
/* Validated with the dataviz skill's scripts/validate_palette.js.
   Evidence classes are an ORDERED scale (how direct the evidence is), so they take a single-hue
   ORDINAL ramp, not categorical slots: `--ordinal --pairs all` PASSES in both modes, where four
   categorical slots would have failed the all-pairs floors. Dash pattern + legend label carry the
   same distinction redundantly, so nothing is colour-only. Status colours are the fixed status
   palette and always ship with a glyph + label (the palette doc's relief rule). */
const CSS = `
.nw-root{
  color-scheme:light;
  --nw-surface:#fcfcfb; --nw-plane:#f9f9f7;
  --nw-ink:#0b0b0b; --nw-ink2:#52514e; --nw-muted:#898781;
  --nw-grid:#e1e0d9; --nw-axis:#c3c2b7; --nw-ring:rgba(11,11,11,0.10);
  --nw-ev1:#0d366b; --nw-ev2:#256abf; --nw-ev3:#5598e7; --nw-ev4:#86b6ef;
  --nw-seq1:#cde2fb; --nw-seq2:#9ec5f4; --nw-seq3:#5598e7; --nw-seq4:#256abf; --nw-seq5:#104281;
  --nw-critical:#d03b3b; --nw-warning:#fab219; --nw-good:#0ca30c; --nw-serious:#ec835a;
  --nw-node:#f0efec;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--nw-plane); color:var(--nw-ink);
  display:block; container-type:inline-size;
}
@media (prefers-color-scheme:dark){
  :root:where(:not([data-theme="light"])) .nw-root{
    color-scheme:dark;
    --nw-surface:#1a1a19; --nw-plane:#0d0d0d;
    --nw-ink:#f0efec; --nw-ink2:#c3c2b7; --nw-muted:#898781;
    --nw-grid:#2c2c2a; --nw-axis:#383835; --nw-ring:rgba(255,255,255,0.10);
    --nw-ev1:#cde2fb; --nw-ev2:#86b6ef; --nw-ev3:#3987e5; --nw-ev4:#184f95;
    --nw-seq1:#184f95; --nw-seq2:#256abf; --nw-seq3:#3987e5; --nw-seq4:#86b6ef; --nw-seq5:#cde2fb;
    --nw-node:#2c2c2a;
  }
}
.nw-root[data-nwtheme="dark"]{
  color-scheme:dark;
  --nw-surface:#1a1a19; --nw-plane:#0d0d0d;
  --nw-ink:#f0efec; --nw-ink2:#c3c2b7; --nw-muted:#898781;
  --nw-grid:#2c2c2a; --nw-axis:#383835; --nw-ring:rgba(255,255,255,0.10);
  --nw-ev1:#cde2fb; --nw-ev2:#86b6ef; --nw-ev3:#3987e5; --nw-ev4:#184f95;
  --nw-seq1:#184f95; --nw-seq2:#256abf; --nw-seq3:#3987e5; --nw-seq4:#86b6ef; --nw-seq5:#cde2fb;
  --nw-node:#2c2c2a;
}
.nw-root[data-nwtheme="light"]{
  color-scheme:light;
  --nw-surface:#fcfcfb; --nw-plane:#f9f9f7;
  --nw-ink:#0b0b0b; --nw-ink2:#52514e; --nw-muted:#898781;
  --nw-grid:#e1e0d9; --nw-axis:#c3c2b7; --nw-ring:rgba(11,11,11,0.10);
  --nw-ev1:#0d366b; --nw-ev2:#256abf; --nw-ev3:#5598e7; --nw-ev4:#86b6ef;
  --nw-seq1:#cde2fb; --nw-seq2:#9ec5f4; --nw-seq3:#5598e7; --nw-seq4:#256abf; --nw-seq5:#104281;
  --nw-node:#f0efec;
}
.nw-panel{display:none; padding:0 0 10px;}
.nw-panel[data-on="1"]{display:block;}
.nw-head{padding:12px 16px 6px;}
.nw-eyebrow{font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--nw-muted); margin:0 0 3px;}
.nw-title{font-size:16px; font-weight:650; margin:0 0 4px; line-height:1.25; color:var(--nw-ink);}
.nw-sub{font-size:12.5px; line-height:1.45; margin:0; color:var(--nw-ink2); max-width:62ch;}
.nw-card{background:var(--nw-surface); border:1px solid var(--nw-ring); border-radius:10px; margin:8px 16px; padding:10px 12px;}
.nw-svgwrap{background:var(--nw-surface); border:1px solid var(--nw-ring); border-radius:10px; margin:8px 16px; overflow:hidden;}
.nw-svgwrap svg{display:block; width:100%; height:auto;}
.nw-legend{display:flex; flex-wrap:wrap; gap:4px 14px; padding:8px 16px 2px; font-size:11.5px; color:var(--nw-ink2);}
.nw-lg{display:flex; align-items:center; gap:6px;}
.nw-lg svg{flex:0 0 auto;}
.nw-stats{display:flex; flex-wrap:wrap; gap:8px; padding:4px 16px 0;}
.nw-stat{background:var(--nw-surface); border:1px solid var(--nw-ring); border-radius:8px; padding:7px 10px; min-width:84px; flex:1 1 84px;}
.nw-stat b{display:block; font-size:19px; font-weight:650; line-height:1.1; color:var(--nw-ink);}
.nw-stat span{display:block; font-size:10.5px; line-height:1.3; color:var(--nw-muted); margin-top:2px;}
.nw-gap{border:1.5px dashed var(--nw-critical); border-radius:9px; background:transparent; margin:8px 16px; padding:9px 11px;}
.nw-gap .nw-gh{font-size:11px; font-weight:650; letter-spacing:.05em; text-transform:uppercase; color:var(--nw-critical); display:flex; align-items:center; gap:6px; margin-bottom:3px;}
.nw-gap p{margin:0; font-size:12px; line-height:1.45; color:var(--nw-ink2);}
.nw-warn{border-left:3px solid var(--nw-warning); background:var(--nw-surface); border-radius:0 8px 8px 0; margin:8px 16px; padding:8px 11px;}
.nw-warn .nw-gh{font-size:11px; font-weight:650; letter-spacing:.05em; text-transform:uppercase; color:var(--nw-ink2); display:flex; align-items:center; gap:6px; margin-bottom:3px;}
.nw-warn p{margin:0; font-size:12px; line-height:1.45; color:var(--nw-ink2);}
.nw-tbl{width:100%; max-width:100%; table-layout:fixed; border-collapse:collapse; font-size:11.5px;}
.nw-tbl th{text-align:left; font-weight:600; color:var(--nw-muted); border-bottom:1px solid var(--nw-grid); padding:4px 6px 4px 0; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; overflow-wrap:anywhere;}
.nw-tbl td{padding:4px 6px 4px 0; border-bottom:1px solid var(--nw-grid); color:var(--nw-ink2); vertical-align:top; line-height:1.35; overflow-wrap:anywhere;}
.nw-tbl th.nw-num,.nw-tbl td.nw-num{width:3.4em;}
.nw-tbl th.nw-wide,.nw-tbl td.nw-wide{width:5.2em; text-align:right; font-variant-numeric:tabular-nums; color:var(--nw-ink);}
.nw-tbl td.nw-num{font-variant-numeric:tabular-nums; text-align:right; color:var(--nw-ink);}
.nw-tbl tr:last-child td{border-bottom:none;}
.nw-pill{display:inline-block; max-width:100%; font-size:10px; padding:1px 6px; border-radius:99px; border:1px solid var(--nw-ring); color:var(--nw-ink2); white-space:normal; overflow-wrap:anywhere; box-sizing:border-box;}
.nw-clkey{list-style:none; margin:0; padding:6px 16px 0; display:grid; gap:3px 12px; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); font-size:11px; color:var(--nw-ink2);}
.nw-clkey li{display:flex; gap:6px; align-items:baseline;}
.nw-agrow{padding:6px 0; border-bottom:1px solid var(--nw-grid);}
.nw-agrow:last-child{border-bottom:none;}
.nw-agh{display:flex; justify-content:space-between; gap:8px; font-size:12px; font-weight:650; color:var(--nw-ink); align-items:baseline;}
.nw-agn{flex:0 0 auto; font-weight:400; font-size:11px; color:var(--nw-muted); font-variant-numeric:tabular-nums;}
.nw-agb{font-size:11px; line-height:1.4; color:var(--nw-ink2); overflow-wrap:anywhere; margin-top:1px;}
.nw-clkey b{flex:0 0 auto; font-variant-numeric:tabular-nums; font-weight:650; color:var(--nw-ink); min-width:1.1em;}
.nw-anat{cursor:pointer; background:none; border:none; padding:0; font:inherit; color:inherit; text-align:left; text-decoration:underline; text-decoration-style:dotted; text-underline-offset:2px;}
.nw-anat:hover,.nw-anat:focus-visible{color:var(--nw-ink); outline:2px solid var(--nw-ev2); outline-offset:2px; border-radius:3px;}
.nw-anat[aria-pressed="true"]{color:var(--nw-ink); font-weight:650;}
.nw-note{padding:2px 16px 0; font-size:11px; line-height:1.45; color:var(--nw-muted); max-width:70ch; overflow-wrap:anywhere;}
.nw-src{padding:6px 16px 0; font-size:10.5px; line-height:1.45; color:var(--nw-muted); max-width:74ch; overflow-wrap:anywhere;}
.nw-root *{min-width:0;}
.nw-sub,.nw-gap p,.nw-warn p,.nw-title{overflow-wrap:anywhere;}
.nw-stat b{overflow-wrap:anywhere;}
.nw-loading{padding:26px 16px; font-size:13px; color:var(--nw-ink2);}
@container (max-width:430px){
  .nw-head{padding:10px 12px 5px;} .nw-card,.nw-svgwrap,.nw-gap,.nw-warn{margin:7px 12px;}
  .nw-legend,.nw-stats,.nw-note,.nw-src{padding-left:12px; padding-right:12px;}
  .nw-title{font-size:15px;} .nw-stat b{font-size:17px;}
}
`;

/* Evidence classes: an ORDERED scale from "someone did the experiment in this species" to
   "this is a human fact copied across". `rank` is used for the ordinal colour step; `dash` is the
   redundant non-colour channel. Derived from the served card's own `kind` array and `species`. */
const EV = [
  { id: 'curated',      rank: 0, varc: '--nw-ev1', dash: '0',      w: 2.0,
    label: 'curated in this species', legend: 'curated (experimental or curator statement)' },
  { id: 'electronic',   rank: 1, varc: '--nw-ev3', dash: '1 3',    w: 1.6,
    label: 'electronic (IEA)', legend: 'electronic — assigned by software (IEA)' },
  { id: 'orthology',    rank: 2, varc: '--nw-ev2', dash: '7 3',    w: 1.6,
    label: 'orthology-inferred', legend: 'orthology-inferred — transferred by sequence/phylogeny' },
  { id: 'cross-species',rank: 3, varc: '--nw-ev4', dash: '9 3 2 3',w: 1.6,
    label: 'cross-species transfer', legend: 'cross-species — a fact about another species, mapped over' },
];
const EV_BY = Object.fromEntries(EV.map(e => [e.id, e]));

/* The ONLY lexical table in the file. It selects metabolic pathways out of whatever real ontology
   labels the genes in play happen to carry, so it generalises to any design; it is named on screen
   and in provenance as a lexical filter over labels, not a curated pathway list. */
const METABOLIC_WORDS = [
  'metabolic', 'metabolism', 'catabolic', 'biosynth', 'respiration', 'respiratory electron',
  'electron transport', 'oxidative phosphoryl', 'glycolysis', 'gluconeogen', 'citrate cycle',
  'tca cycle', 'tricarboxylic', 'fatty acid', 'beta-oxidation', 'oxygen transport',
  'oxygen carrier', 'atp synthesis', 'atp metabolic', 'mitochondrial', 'pyruvate', 'lactate',
  'creatine', 'glycogen', 'lipid transport', 'amino acid transport', 'haem', 'heme',
];

const MAX_NODES = 22;          // honest cap; the remainder is shown as "+N more"
const MAX_ANATOMY = 12;        // rows in the expression matrix
const CARD_FETCH_LIMIT = 24;

/* ------------------------------------------------------------- tiny helpers */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uniq = a => Array.from(new Set(a));
const num = n => (n == null || !isFinite(n) ? '—' : Math.abs(n) >= 100 ? Math.round(n).toLocaleString()
  : Math.abs(n) >= 10 ? n.toFixed(1) : Number(n.toFixed(2)).toString());
const pct = n => (n == null || !isFinite(n) ? '—' : Math.round(n * 100) + '%');
/** deterministic PRNG so the layout is byte-identical on every mount and every seek */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function tokens(s) { return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)); }
const STOP = new Set(['the', 'and', 'over', 'per', 'log', 'ratio', 'length', 'area', 'span', 'mean', 'max', 'min', 'total', 'rel', 'frac', 'fraction', 'value', 'body']);
function isMetabolic(label) { const l = String(label || '').toLowerCase(); return METABOLIC_WORDS.some(w => l.includes(w)); }

/* gz-aware JSON fetch: the gene cards are committed as .json.gz, which a static host may or may
   not transparently decode. Sniff the gzip magic and decompress in-page when it is still gzipped. */
async function loadJSON(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  const b = new Uint8Array(buf);
  if (b.length > 2 && b[0] === 0x1f && b[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('gzip card and no DecompressionStream');
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(b));
}
async function tryJSON(url) { try { return await loadJSON(url); } catch { return null; } }

/* classify one served card entry into an evidence class */
function classify(entry) {
  const sp = entry && entry.species;
  if (Array.isArray(sp) && sp.some(s => s && !/danio|zebrafish/i.test(s))) return 'cross-species';
  const k = (entry && entry.kind) || [];
  if (k.includes('curated') || k.includes('measured') || k.includes('observed')) return 'curated';
  if (k.includes('inferred-electronic')) return 'electronic';
  if (k.includes('borrowed-ortholog') || k.includes('proxy')) return 'orthology';
  return 'electronic';
}
const strongestClass = ids => EV.find(e => ids.includes(e.id))?.id || 'electronic';

/* =============================================== 1. resolve the subject generically */
/**
 * The whole generality contract lives here. Out: which genes and which body parts this act is
 * about, plus the rule by which they were chosen (which is printed on screen).
 */
async function resolveSubject(data, base) {
  const c = (data && data.case) || {};
  const design = (data && data.design) || {};
  const changed = Array.isArray(c.changed) ? c.changed : [];

  /* ---- parts in play: case.changed[].part, then design.edits[].part, then the phenotype
          gate's dominant feature names. All resolved against the real part index by label token. */
  const partsIdx = await tryJSON(new URL('omics/parts.json', base));
  const wanted = [];
  for (const ch of changed) { if (ch && ch.part) wanted.push({ text: ch.part, from: 'case.changed[].part' }); }
  for (const e of (design.edits || [])) { if (e && e.part) wanted.push({ text: e.part, from: 'design.edits[].part' }); }
  if (!wanted.length) {
    for (const ch of changed) if (ch && (ch.label || ch.parameter)) wanted.push({ text: ch.label || ch.parameter, from: 'case.changed[].label' });
  }
  if (!wanted.length) {
    const ps = (data && data.phenotype_similarity) || {};
    const feats = []
      .concat(ps.fins?.closest_on_pectoral_length?.dominant_features || [])
      .concat(ps.closest_real_relative?.dominant_features || []);
    for (const f of feats) if (f && (f.label || f.feature)) wanted.push({ text: f.label || f.feature, from: 'phenotype_similarity dominant features' });
  }

  const parts = [];
  if (partsIdx) {
    const rows = Object.entries(partsIdx).map(([id, v]) => ({ id, ...v, toks: tokens(v.label) }));
    /* Best case: the run states the ontology terms its edit actually reached. An id is exact, so
       it is used ahead of any name matching. */
    for (const t of ((data && data.anatomy_reached && data.anatomy_reached.terms) || [])) {
      const hit = t && t.id && rows.find(r => r.id === t.id);
      if (hit && !parts.some(p => p.id === hit.id)) {
        parts.push({ ...hit, matched_from: 'anatomy_reached.terms (ontology id stated by the run)', matched_text: t.label || t.id });
      }
    }
    for (const w of wanted) {
      const wt = tokens(w.text);
      if (!wt.length) continue;
      let best = null, bestScore = 0;
      for (const r of rows) {
        const hit = r.toks.filter(t => wt.includes(t)).length;
        if (!hit) continue;
        /* prefer the most specific label that matches all its own tokens, then the larger index */
        const score = hit * 10 + (r.toks.length === hit ? 5 : 0) - r.toks.length * 0.1;
        if (score > bestScore) { bestScore = score; best = r; }
      }
      if (best && !parts.some(p => p.id === best.id)) parts.push({ ...best, matched_from: w.from, matched_text: w.text });
    }
  }

  /* ---- genes in play */
  let genes = uniq((design.edits || []).map(e => e && e.gene).filter(Boolean));
  let geneRule, geneSourceLabel;
  if (genes.length) {
    geneRule = `the ${genes.length} gene${genes.length === 1 ? '' : 's'} this design edits, as listed by the validator`;
    geneSourceLabel = 'data.design.edits';
  } else {
    /* no gene-level edits: the design is a shape change. Bridge part -> genes through the real
       part index, which lists the genes with recorded evidence in that part. */
    const pool = new Map();
    for (const p of parts) for (const g of (p.genes || [])) {
      const sym = Array.isArray(g) ? g[0] : g;
      if (!sym) continue;
      if (!pool.has(sym)) pool.set(sym, []);
      pool.get(sym).push(p.label);
    }
    genes = Array.from(pool.keys());
    geneRule = parts.length
      ? `no gene-level edit: this design moves a shape. The genes shown are those the part index records evidence for in ${parts.map(p => p.label).join(' / ')}`
      : 'no gene-level edit and no part could be resolved';
    geneSourceLabel = 'omics/parts.json (UBERON/CL part -> genes with recorded evidence)';
    genes.__inParts = pool;
  }

  /* ---- rank and cap. Rank by how much real evidence the gene carries (rows per layer in the
          omics index) and whether a causal chain exists for it, so the capped view is the
          best-evidenced slice rather than an alphabetical one. */
  const [idx, chains] = await Promise.all([
    tryJSON(new URL('omics/index.json', base)),
    tryJSON(new URL('causal-chains.json', base)),
  ]);
  const chainBySym = new Map();
  for (const g of (chains?.genes || [])) if (g && g.symbol) chainBySym.set(g.symbol, g);

  const rowsBySym = new Map(); const fileBySym = new Map();
  const order = idx?.layer_order || [];
  const iPath = order.indexOf('pathway'), iTx = order.indexOf('transcriptomic');
  for (const t of (idx?.genes || [])) {
    const sym = t[0]; const rows = t[4] || [];
    rowsBySym.set(sym, { pathway: rows[iPath] || 0, tx: rows[iTx] || 0, all: rows.reduce((a, b) => a + (b || 0), 0) });
    fileBySym.set(sym, t[2] || sym);
    for (const older of (t[6] || [])) if (!fileBySym.has(older)) fileBySym.set(older, t[2] || sym);
  }

  const scored = genes.map(sym => {
    const r = rowsBySym.get(sym) || { pathway: 0, tx: 0, all: 0 };
    return { sym, ...r, hasChain: chainBySym.has(sym), file: fileBySym.get(sym) || sym };
  }).sort((a, b) =>
    (b.hasChain - a.hasChain) || (b.pathway - a.pathway) || (b.tx - a.tx) || a.sym.localeCompare(b.sym));

  const shown = scored.slice(0, MAX_NODES);
  const hidden = Math.max(0, scored.length - shown.length);

  return {
    caseInfo: c, design, parts, changed,
    genesAll: scored, genesShown: shown, hiddenGenes: hidden,
    geneRule, geneSourceLabel, chainBySym, chains,
    partsIndexPresent: !!partsIdx,
  };
}

/* ==================================================== 2. build the four views */
async function loadCards(subject, base) {
  const out = new Map();
  const list = subject.genesShown.slice(0, CARD_FETCH_LIMIT);
  await Promise.all(list.map(async g => {
    const card = await tryJSON(new URL(`omics/genes/${encodeURIComponent(g.file)}.json.gz`, base));
    if (card) out.set(g.sym, card);
  }));
  return out;
}

/** ACT 1 — the network: nodes = genes, edges = pathway co-membership + documented regulatory links */
function buildNetwork(subject, cards) {
  const feat = (sym, name) => cards.get(sym)?.layers?.pathway?.features?.[name]?.entries || [];

  /* pathway membership, per gene, per source — the raw material for both the edges and the
     agreement numbers. Everything here is restricted to the genes in play. */
  const memb = new Map();                 // sym -> Map(pathwayLabel -> {sources:Set, classes:Set, tier})
  for (const g of subject.genesShown) {
    const m = new Map();
    for (const tier of ['key_pathway_member', 'pathway_member']) {
      for (const e of feat(g.sym, tier)) {
        const label = e.v; if (!label) continue;
        if (!m.has(label)) m.set(label, { sources: new Set(), classes: new Set(), tier, n_sources: 0 });
        const rec = m.get(label);
        for (const s of (e.sources || [])) rec.sources.add(s);
        rec.classes.add(classify(e));
        rec.n_sources = Math.max(rec.n_sources, e.n_sources || (e.sources || []).length);
        if (tier === 'key_pathway_member') rec.tier = tier;
      }
    }
    memb.set(g.sym, m);
  }

  /* cluster = the pathway a gene shares with the most other genes in play, preferring the
     canonical key_pathway tier when the data offers it. Derived, not declared. */
  const pathwayPop = new Map();
  for (const [, m] of memb) for (const [label, rec] of m) {
    if (!pathwayPop.has(label)) pathwayPop.set(label, { n: 0, tier: rec.tier });
    const p = pathwayPop.get(label); p.n++; if (rec.tier === 'key_pathway_member') p.tier = rec.tier;
  }
  const clusterOf = new Map();
  for (const g of subject.genesShown) {
    let best = null, bs = -1;
    for (const [label, rec] of (memb.get(g.sym) || new Map())) {
      const pop = pathwayPop.get(label) || { n: 0, tier: rec.tier };
      if (pop.n < 2) continue;
      const s = pop.n * 10 + (pop.tier === 'key_pathway_member' ? 50 : 0) + (rec.n_sources || 0);
      if (s > bs) { bs = s; best = label; }
    }
    clusterOf.set(g.sym, best || '(no shared pathway recorded)');
  }

  /* --- edges --- */
  const edges = [];
  const syms = subject.genesShown.map(g => g.sym);
  const seen = new Set();
  for (let i = 0; i < syms.length; i++) for (let j = i + 1; j < syms.length; j++) {
    const a = syms[i], b = syms[j];
    const ma = memb.get(a) || new Map(), mb = memb.get(b) || new Map();
    const shared = [];
    for (const [label, ra] of ma) { const rb = mb.get(label); if (rb) shared.push({ label, ra, rb }); }
    if (!shared.length) continue;
    /* The evidence for "these two genes are in the same pathway" is only as good as the WEAKER of
       the two memberships: a curated row for one gene says nothing about the other's. So per shared
       pathway take the weaker end, then across shared pathways take the best-evidenced one. Taking
       the strongest class across both ends would silently upgrade every edge touching one
       well-studied gene, which is exactly the overclaim this act exists to avoid. */
    const perPathway = shared.map(s => {
      const ra = EV_BY[strongestClass([...s.ra.classes])].rank;
      const rb = EV_BY[strongestClass([...s.rb.classes])].rank;
      return EV[Math.max(ra, rb)].id;                       // higher rank = weaker evidence
    });
    edges.push({
      a, b, type: 'co-membership', ev: strongestClass(perPathway),
      n: shared.length, pathways: shared.map(s => s.label),
      maxSources: Math.max(...shared.map(s => Math.min(s.ra.n_sources, s.rb.n_sources))),
    });
    seen.add(a + '|' + b);
  }
  /* documented regulatory links, from the served signalling_edge rows (human Pathway Commons SIF,
     mapped onto zebrafish paralogs) — directed, and always a cross-species transfer */
  const inSet = new Set(syms);
  let regDropped = 0;
  for (const g of subject.genesShown) {
    for (const e of feat(g.sym, 'signalling_edge')) {
      let payload = null;
      try { payload = typeof e.v === 'string' ? JSON.parse(e.v) : e.v; } catch { continue; }
      if (!payload) continue;
      const targets = payload.zebrafish_target_symbols || [];
      const hit = targets.filter(t => inSet.has(t) && t !== g.sym);
      regDropped += targets.length - hit.length;
      for (const t of hit) {
        edges.push({
          a: g.sym, b: t, type: 'regulatory', directed: true,
          ev: classify(e), n: 1, rel: payload.type || 'interaction',
          pathways: [payload.type || 'interaction'],
        });
      }
    }
  }

  /* --- the measured fact: how well do the sources agree, FOR THESE GENES --- */
  /* public core source groups, discovered from the data rather than declared */
  const srcGroup = s => {
    if (/Gene Ontology|^ZFIN$|UniProt-GOA/.test(s)) return 'GO (ZFIN + GOA)';
    if (/Reactome/.test(s)) return 'Reactome';
    if (/WikiPathways/.test(s)) return 'WikiPathways';
    if (/Pathway Commons|PID|PANTHER|NetPath|INOH/.test(s)) return 'Pathway Commons (human)';
    return s;
  };
  const CORE = ['GO (ZFIN + GOA)', 'Reactome', 'WikiPathways'];   // the public core; KEGG is local-only
  const clusters = new Map();
  for (const g of subject.genesShown) {
    const cl = clusterOf.get(g.sym);
    if (!clusters.has(cl)) clusters.set(cl, { label: cl, genes: [], bySource: new Map(), tier: pathwayPop.get(cl)?.tier });
    const C = clusters.get(cl); C.genes.push(g.sym);
    const rec = (memb.get(g.sym) || new Map()).get(cl);
    for (const s of (rec?.sources || [])) {
      const grp = srcGroup(s);
      if (!C.bySource.has(grp)) C.bySource.set(grp, new Set());
      C.bySource.get(grp).add(g.sym);
    }
  }
  const agreement = [];
  for (const C of clusters.values()) {
    if (C.label.startsWith('(')) continue;
    const present = CORE.filter(s => C.bySource.has(s));
    const pairs = [];
    for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
      const A = C.bySource.get(present[i]), B = C.bySource.get(present[j]);
      const inter = [...A].filter(x => B.has(x)).length;
      const union = new Set([...A, ...B]).size;
      pairs.push({ a: present[i], b: present[j], j: union ? inter / union : null, inter, union });
    }
    const allThree = C.genes.filter(s => {
      const got = new Set([...((memb.get(s) || new Map()).get(C.label)?.sources || [])].map(srcGroup));
      return CORE.every(x => got.has(x));
    });
    agreement.push({
      label: C.label, nGenes: C.genes.length, sourcesPresent: present,
      sourcesMissing: CORE.filter(s => !C.bySource.has(s)),
      pairs, jMin: pairs.length ? Math.min(...pairs.map(p => p.j)) : null,
      jMax: pairs.length ? Math.max(...pairs.map(p => p.j)) : null,
      allThree, tier: C.tier,
    });
  }
  agreement.sort((a, b) => b.nGenes - a.nGenes);

  const byClass = Object.fromEntries(EV.map(e => [e.id, edges.filter(x => x.ev === e.id).length]));
  return { edges, memb, clusterOf, clusters, agreement, byClass, regDropped, coreSources: CORE };
}

/** ACT 2 — expression by anatomy and stage, with the independence test computed here */
function buildExpression(subject, cards) {
  const rows = new Map();   // anatomyKey -> {label, zfa, uberon, genes:Map(sym -> {sources:Set, stages:Set, kinds:Set})}
  let anyFeature = false;
  for (const g of subject.genesShown) {
    const tx = cards.get(g.sym)?.layers?.transcriptomic?.features || {};
    for (const fname of ['expressed_in', 'cell_type_marker']) {
      for (const e of (tx[fname]?.entries || [])) {
        anyFeature = true;
        const an = e.anatomy || {};
        const key = an.id || an.uberon || e.v;
        if (!key) continue;
        if (!rows.has(key)) rows.set(key, { key, label: an.label || e.v, zfa: an.id || null, uberon: an.uberon || null, genes: new Map() });
        const R = rows.get(key);
        if (!R.genes.has(g.sym)) R.genes.set(g.sym, { sources: new Set(), stages: new Set(), kinds: new Set() });
        const rec = R.genes.get(g.sym);
        for (const s of (e.sources || [])) rec.sources.add(s);
        for (const s of (e.stages || [])) rec.stages.add(s);
        for (const k of (e.kind || [])) rec.kinds.add(k);
      }
    }
  }

  /* INDEPENDENCE: Bgee imports ZFIN's in-situ records, so ZFIN + Bgee is one strand, not two.
     Count per anatomy how many genes have support from an assay that is genuinely independent of
     the curated in-situ record. Computed here for the genes in play, not quoted from anywhere. */
  const DEPENDENT = /^(ZFIN|Bgee)$/;
  for (const R of rows.values()) {
    R.nGenes = R.genes.size;
    R.independent = [...R.genes.entries()].filter(([, v]) => [...v.sources].some(s => !DEPENDENT.test(s))).map(([k]) => k);
    R.allSources = uniq([...R.genes.values()].flatMap(v => [...v.sources]));
    R.stages = uniq([...R.genes.values()].flatMap(v => [...v.stages])).sort();
  }
  const list = [...rows.values()].sort((a, b) => b.nGenes - a.nGenes || a.label.localeCompare(b.label));

  /* Put the parts the design actually changed first — they are the point of the act.
     Token matching alone is not enough: a token like "fin" is shared by half the structures here,
     so matching on it would stamp "this design changed it" on structures the design never touched.
     A token only counts if it is DISCRIMINATING in this set — present in under a quarter of the
     labels. Derived from the labels in play, so it holds for any anatomy. */
  const wantedU = new Set(subject.parts.map(p => p.id));
  /* A structure counts as the one this design changed only if it carries EVERY token of the
     changed part's name — "pectoral fin" matches "mesenchyme pectoral fin" and "pectoral fin bud
     mesenchyme", and correctly does NOT match "caudal fin" or "median fin fold". Matching on any
     single shared token would stamp the claim on half the body, because tokens like "fin" are
     common to many structures. Ontology id equality still wins outright. */
  const wantedSets = subject.parts.map(p => uniq(tokens(p.label))).filter(t => t.length);
  const isSubject = R => {
    if ((R.uberon && wantedU.has(R.uberon)) || (R.zfa && wantedU.has(R.zfa))) return true;
    const rt = tokens(R.label);
    return wantedSets.some(ws => ws.every(t => rt.includes(t)));
  };
  list.sort((a, b) => (isSubject(b) - isSubject(a)) || (b.nGenes - a.nGenes));
  for (const R of list) R.isSubject = isSubject(R);

  const shown = list.slice(0, MAX_ANATOMY);
  return { all: list, shown, hidden: Math.max(0, list.length - shown.length), anyFeature };
}

/** ACT 3 — metabolism: the design's own genes' metabolic pathways + the O2 supply chain */
function buildMetabolism(subject, cards, physio) {
  const paths = new Map();
  for (const g of subject.genesShown) {
    const pw = cards.get(g.sym)?.layers?.pathway?.features || {};
    for (const fname of ['pathway_member', 'go_process']) {
      for (const e of (pw[fname]?.entries || [])) {
        if (!isMetabolic(e.v)) continue;
        if (!paths.has(e.v)) paths.set(e.v, { label: e.v, genes: new Set(), sources: new Set(), classes: new Set(), from: fname });
        const P = paths.get(e.v);
        P.genes.add(g.sym);
        for (const s of (e.sources || [])) P.sources.add(s);
        P.classes.add(classify(e));
      }
    }
  }
  const list = [...paths.values()].map(p => ({
    label: p.label, nGenes: p.genes.size, genes: [...p.genes].sort(),
    sources: [...p.sources], ev: strongestClass([...p.classes]), from: p.from,
  })).sort((a, b) => b.nGenes - a.nGenes || a.label.localeCompare(b.label));

  /* The oxygen supply chain that any aerobic-performance number rests on, read from the served
     physiology JSONs with each value's own kind / species / source. The BROKEN RUNG is computed:
     the link whose value is a proxy taken from another species. */
  const chain = [];
  const cir = physio.circulation, gil = physio.gills;
  const push = (step, what, v, unit, meta) => chain.push({
    step, what, value: v, unit,
    kind: meta?.kind || null, species: meta?.species || null, source: meta?.source || null,
    note: meta?.note || null,
  });
  if (gil?.params?.Pw_in) push('water', 'inspired water O₂ tension', gil.params.Pw_in.value, gil.params.Pw_in.unit, gil.params.Pw_in);
  if (gil?.params?.k) push('gill', 'gill O₂ transfer (k = D/Gw)', gil.params.k.value, gil.params.k.unit, gil.params.k);
  if (gil?.params?.Pb_in) push('blood in', 'venous O₂ tension entering the gill', gil.params.Pb_in.value, gil.params.Pb_in.unit, gil.params.Pb_in);
  if (cir?.cardiac_output_ml_min_kg) {
    const co = cir.cardiac_output_ml_min_kg;
    push('pump', 'cardiac output at maximum', co.max != null ? co.max : co.rest, 'ml min⁻¹ kg⁻¹', co);
  }
  if (cir?.venous_PO2_kPa) push('return', 'venous O₂ tension at fatigue', cir.venous_PO2_kPa.fatigue_floor ?? cir.venous_PO2_kPa.rest, 'kPa', cir.venous_PO2_kPa);

  const PROXY = /proxy|borrow|assumed|tuned/i;
  const broken = chain.filter(c => c.species || PROXY.test(c.kind || ''));
  /* rank the breaks: a value measured in a NAMED OTHER SPECIES is the worst kind of break here,
     because it silently sets the ceiling for an animal it was never measured in */
  broken.sort((a, b) => (!!b.species - !!a.species) || String(a.step).localeCompare(String(b.step)));
  const worst = broken[0] || null;
  /* the alternative the repo itself records for that same quantity, if there is one */
  const alt = cir?.cardiac_output_ml_min_kg?.alt || null;

  return { pathways: list, chain, broken, worst, alt, present: !!(cir || gil) };
}

/** ACT 4 — the developmental trajectory, with every stage value carrying its kind */
function buildDevelopment(dev) {
  const out = { stages: [], disagreements: [], source: null, present: false, notFound: [] };
  /* preferred: the growth-mesh manifest's morph targets, which are the real staged geometry */
  if (dev.devManifest?.morph_targets?.length) {
    const t = dev.devManifest.morph_targets.filter(m => m.kind === 'stage' && m.age_days != null);
    if (t.length) {
      out.present = true;
      out.source = `${dev.devManifestName} morph targets (the growth mesh's own stage set)`;
      out.stages = t.map(m => {
        const basis = m.basis || {};
        const kinds = Object.entries(basis).map(([k, v]) => ({
          field: k, text: String(v),
          kind: /MEASURED/i.test(v) ? 'measured' : /no .*data|not found|none/i.test(v) ? 'absent'
            : /assumed|placeholder/i.test(v) ? 'assumed' : /proxy|stand-in/i.test(v) ? 'proxy' : 'derived',
        }));
        return {
          id: m.name, age: m.age_days, label: m.label || m.name,
          SL: m.SL_m, mass: m.mass_kg, sizeRel: m.size_rel,
          pieces: m.shrunk_pieces || null, basis: kinds,
          hasAbsent: kinds.some(k => k.kind === 'absent'),
        };
      }).sort((a, b) => a.age - b.age);
    }
  }
  /* fallback: the staged life-history table, whose every field carries kind + source + locator */
  if (!out.present && Array.isArray(dev.stages?.stages)) {
    out.present = true;
    /* The staged table is about a named organism. If that organism shares no name token with this
       design's lineage, the table is a STAND-IN, and saying so is the whole point of the panel. */
    const title = String(dev.stages.title || '');
    const tTok = tokens(title);
    const lin = dev.lineageTokens || [];
    out.offLineage = lin.length > 0 && tTok.length > 0 && !lin.some(t => tTok.includes(t));
    out.tableTitle = title;
    out.source = `development/stages.json — "${title}" (life stages; every field carries its own kind, source and verbatim locator)`;
    out.stages = dev.stages.stages.map(s => {
      const fields = [];
      for (const [k, v] of Object.entries(s)) {
        const arr = Array.isArray(v) ? v : [v];
        for (const e of arr) {
          if (e && typeof e === 'object' && 'kind' in e) fields.push({ field: k, kind: e.kind, value: e.value, unit: e.unit, source: e.source, reason: e.reason || e.locator });
        }
      }
      /* DISAGREEMENT, computed: two entries for the same field whose numeric ranges do not overlap */
      const byField = new Map();
      for (const f of fields) { if (!byField.has(f.field)) byField.set(f.field, []); byField.get(f.field).push(f); }
      for (const [field, fs] of byField) {
        const rng = fs.map(f => (Array.isArray(f.value) ? f.value : [f.value, f.value]))
          .filter(r => r.every(x => typeof x === 'number'));
        if (rng.length < 2) continue;
        for (let i = 0; i < rng.length; i++) for (let j = i + 1; j < rng.length; j++) {
          const A = rng[i], B = rng[j];
          if (A[1] < B[0] || B[1] < A[0]) out.disagreements.push({
            stage: s.id, field,
            a: `${num(A[0])}–${num(A[1])} ${fs[i].unit || ''} (${fs[i].kind}, ${fs[i].source || 'no source'})`,
            b: `${num(B[0])}–${num(B[1])} ${fs[j].unit || ''} (${fs[j].kind}, ${fs[j].source || 'no source'})`,
          });
        }
      }
      const age = Array.isArray(s.age_d?.value) ? s.age_d.value[0] : s.age_d?.value;
      return {
        id: s.id, age: typeof age === 'number' ? age : s.order, label: s.id,
        ageKind: s.age_d?.kind || null, SL: null, mass: null, basis: fields,
        hasAbsent: fields.some(f => f.kind === 'absent' || /not found/i.test(String(f.reason || ''))),
        caveat: s.definition_caveat || null,
      };
    }).sort((a, b) => a.age - b.age);
    /* the file's own explicit NOT FOUND answers are real, rendered gaps */
    for (const [k, v] of Object.entries(dev.stages)) {
      if (v && typeof v === 'object' && typeof v.answer === 'string' && /NOT FOUND/i.test(v.answer))
        out.notFound.push({ what: k.replace(/_/g, ' '), answer: v.answer, searched: (v.searched || []).length });
    }
  }
  return out;
}

/** ACT 5 — causal chains with their strength and their broken rung */
function buildChains(subject) {
  const out = [];
  for (const g of subject.genesShown) {
    const c = subject.chainBySym.get(g.sym);
    if (!c) continue;
    const steps = (c.chain || []).map(s => ({
      step: s.step, grade: s.evidence_grade, organism: s.organism,
      how: s.experiment_type, nSources: (s.sources || []).length,
    }));
    out.push({
      sym: g.sym, strength: c.chain_strength || c.weakest_grade || 'unknown',
      best: c.best_grade || null, steps,
      weakest: c.weakest_link || null, gaps: c.gaps || [],
      complete: !!c.chain_complete, deepest: c.deepest_node_with_evidence || null,
      nFull: c.n_full_text_sources ?? null, nAbs: c.n_abstract_only_sources ?? null,
    });
  }
  const GRADES = ['missing', 'hypothesis', 'association', 'necessity', 'sufficiency', 'mechanism'];
  out.sort((a, b) => GRADES.indexOf(b.strength) - GRADES.indexOf(a.strength) || a.sym.localeCompare(b.sym));
  return { chains: out, grades: GRADES, withoutChain: subject.genesShown.filter(g => !subject.chainBySym.has(g.sym)).map(g => g.sym) };
}

/* ================================================================ rendering */
const GLYPH = { gap: '●', warn: '⚠', ok: '✓' };

function svgEl(w, h, body, label) {
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}
function evLegend(ids) {
  return ids.map(id => {
    const e = EV_BY[id]; if (!e) return '';
    return `<span class="nw-lg"><svg width="26" height="8" aria-hidden="true"><line x1="1" y1="4" x2="25" y2="4" stroke="var(${e.varc})" stroke-width="${e.w}" stroke-dasharray="${e.dash}" stroke-linecap="round"/></svg>${esc(e.legend)}</span>`;
  }).join('');
}
function gapBlock(title, text) {
  return `<div class="nw-gap"><div class="nw-gh"><span aria-hidden="true">${GLYPH.gap}</span>gap · ${esc(title)}</div><p>${text}</p></div>`;
}
function warnBlock(title, text) {
  return `<div class="nw-warn"><div class="nw-gh"><span aria-hidden="true">${GLYPH.warn}</span>${esc(title)}</div><p>${text}</p></div>`;
}
function stats(items) {
  return `<div class="nw-stats">${items.map(i => `<div class="nw-stat"><b>${esc(i.v)}</b><span>${esc(i.k)}</span></div>`).join('')}</div>`;
}

/* ---------------------------------------------------- the network panel (SVG) */
function renderNetwork(subject, net, W) {
  const nodes = subject.genesShown;
  if (!nodes.length) return { html: gapBlock('no genes resolved', `Nothing could be resolved to a gene for this design. ${esc(subject.geneRule)}.`), svgH: 0 };

  /* cluster by pathway, lay the clusters out on a stable ring, genes on a small ring inside it.
     Seeded from the cluster label, so the picture is identical on every mount and every seek. */
  const byCluster = new Map();
  for (const n of nodes) {
    const cl = net.clusterOf.get(n.sym);
    if (!byCluster.has(cl)) byCluster.set(cl, []);
    byCluster.get(cl).push(n);
  }
  const clusters = [...byCluster.entries()]
    .map(([label, gs]) => ({ label, genes: gs.slice().sort((a, b) => a.sym.localeCompare(b.sym)) }))
    .sort((a, b) => b.genes.length - a.genes.length || a.label.localeCompare(b.label));

  const narrow = W < 430;
  const H = narrow ? Math.max(420, 300 + clusters.length * 18) : Math.max(420, 330 + clusters.length * 14);
  const cx = W / 2, cy = H / 2;
  /* an ELLIPTICAL ring, so a wide desktop canvas is actually used instead of packing every cluster
     into a circle the height of the shortest side */
  const Rx = (W / 2) * (narrow ? 0.60 : 0.66);
  const Ry = (H / 2) * 0.60;
  const pos = new Map();
  clusters.forEach((C, ci) => {
    const ang = (-Math.PI / 2) + (ci / Math.max(1, clusters.length)) * Math.PI * 2;
    const solo = clusters.length === 1;
    const ccx = solo ? cx : cx + Math.cos(ang) * Rx;
    const ccy = solo ? cy : cy + Math.sin(ang) * Ry;
    C.cx = ccx; C.cy = ccy; C.ang = ang;
    const n = C.genes.length;
    /* genes evenly spaced on their own circle, no random radius: random radii stack labels on top
       of each other, which is exactly the hairball this layout is meant to avoid. The seed only
       rotates the ring, so the picture stays stable and clusters do not all start at the same angle. */
    const rnd = mulberry32(hashStr(C.label));
    const spin = rnd() * Math.PI * 2;
    const inner = solo ? Math.min(W, H) * 0.3
      : n === 1 ? 0 : clamp(18 + 8 * n, 30, Math.min(Rx, Ry) * 0.78);
    C.inner = inner;
    C.genes.forEach((g, gi) => {
      const a2 = spin + (gi / Math.max(1, n)) * Math.PI * 2;
      pos.set(g.sym, { x: ccx + Math.cos(a2) * inner, y: ccy + Math.sin(a2) * inner, a: a2 });
    });
  });

  const nodeR = s => {
    const r = subject.genesAll.find(g => g.sym === s);
    return 3.6 + Math.min(4.2, Math.sqrt((r?.pathway || 0) + 1) * 0.55);
  };

  /* edges, strongest evidence drawn last so it sits on top */
  const order = ['cross-species', 'orthology', 'electronic', 'curated'];
  const drawn = net.edges.slice().sort((a, b) => order.indexOf(a.ev) - order.indexOf(b.ev));
  let eBody = '';
  for (const e of drawn) {
    const pa = pos.get(e.a), pb = pos.get(e.b); if (!pa || !pb) continue;
    const cls = EV_BY[e.ev] || EV_BY.electronic;
    const sw = Math.min(2.6, cls.w * (e.type === 'regulatory' ? 0.9 : (0.75 + Math.min(1.1, (e.n || 1) * 0.22))));
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const bow = e.type === 'regulatory' ? 0.17 : 0.07;
    const qx = mx - dy * bow, qy = my + dx * bow;
    eBody += `<path d="M${pa.x.toFixed(1)} ${pa.y.toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}" fill="none" stroke="var(${cls.varc})" stroke-width="${sw.toFixed(2)}" stroke-dasharray="${cls.dash}" stroke-linecap="round" opacity="${e.type === 'regulatory' ? 0.95 : 0.62}"${e.directed ? ' marker-end="url(#nwArrow)"' : ''}><title>${esc(e.a)} ${e.directed ? '→' : '—'} ${esc(e.b)} · ${esc(e.type === 'regulatory' ? e.rel : e.n + ' shared pathway' + (e.n === 1 ? '' : 's'))} · ${esc(cls.label)}</title></path>`;
  }

  /* nodes: SHAPE carries whether a causal chain exists (never colour alone) */
  let nBody = '';
  for (const n of nodes) {
    const p = pos.get(n.sym); if (!p) continue;
    const r = nodeR(n.sym);
    const title = `${n.sym} · ${n.pathway} pathway rows · ${n.hasChain ? 'has a causal chain' : 'no causal chain in this repo'}`;
    nBody += n.hasChain
      ? `<rect x="${(p.x - r).toFixed(1)}" y="${(p.y - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" rx="1.2" fill="var(--nw-node)" stroke="var(--nw-ink)" stroke-width="1.5"><title>${esc(title)}</title></rect>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--nw-node)" stroke="var(--nw-axis)" stroke-width="1.2"><title>${esc(title)}</title></circle>`;
    if (!narrow || nodes.length <= 16) {
      /* the label radiates OUTWARD from its own cluster centre, so labels fan out instead of
         piling on top of one another in the middle of a dense cluster */
      const left = typeof p.a === 'number' ? Math.cos(p.a) < 0 : p.x < cx;
      const lx = clamp(p.x + (left ? -r - 3 : r + 3), 3, W - 3);
      nBody += `<text x="${lx.toFixed(1)}" y="${(p.y + 3.2).toFixed(1)}" font-size="9.5" fill="var(--nw-ink)" text-anchor="${left ? 'end' : 'start'}" paint-order="stroke" stroke="var(--nw-surface)" stroke-width="2.6">${esc(n.sym)}</text>`;
    }
  }

  /* Cluster labels. Long pathway names placed on a ring run straight off the canvas and get
     clipped, so when the canvas is narrow or there are many clusters the SVG carries a numbered
     badge and the names go in a key below, where they can wrap. Positions are clamped inside the
     viewBox either way. */
  const keyMode = narrow || clusters.length > 6;
  let cBody = '';
  const clusterKey = [];
  clusters.forEach((C, ci) => {
    const ag = net.agreement.find(a => a.label === C.label);
    const srcTxt = ag && ag.sourcesPresent.length
      ? `${ag.sourcesPresent.length}/${net.coreSources.length} public sources`
      : 'no public source agreement recorded';
    clusterKey.push({ n: ci + 1, label: C.label, genes: C.genes.length, srcTxt, allThree: ag ? ag.allThree.length : null });
    const out = Math.cos(C.ang), outY = Math.sin(C.ang);
    const single = clusters.length === 1;
    /* sit the marker just outside the cluster's OWN gene ring, not a fixed distance from the
       canvas centre — otherwise a one-gene cluster's badge floats in empty space */
    const off = (C.inner || 0) + (keyMode ? 15 : 20);
    /* a one-gene cluster has no ring to sit outside, and its gene's label radiates sideways, so
       the marker goes ABOVE the node where nothing else is */
    const lone = C.genes.length === 1;
    let lx = single ? cx : lone ? C.cx : C.cx + out * off;
    let ly = single ? 16 : lone ? C.cy - 17 : C.cy + outY * off;
    if (keyMode) {
      lx = clamp(lx, 12, W - 12); ly = clamp(ly, 14, H - 8);
      cBody += `<circle cx="${lx.toFixed(1)}" cy="${(ly - 3).toFixed(1)}" r="8" fill="var(--nw-surface)" stroke="var(--nw-ink2)" stroke-width="1.2"/>`
        + `<text x="${lx.toFixed(1)}" y="${(ly + 0.5).toFixed(1)}" font-size="9.5" font-weight="650" fill="var(--nw-ink)" text-anchor="middle">${ci + 1}<title>${esc(C.label)} — ${C.genes.length} gene${C.genes.length === 1 ? '' : 's'}, ${esc(srcTxt)}</title></text>`;
      return;
    }
    const anchor = single ? 'middle' : (out < -0.3 ? 'end' : out > 0.3 ? 'start' : 'middle');
    const maxChars = 30;
    const short = C.label.length > maxChars ? C.label.slice(0, maxChars - 1) + '…' : C.label;
    /* keep the whole run of text inside the canvas for the anchor we picked */
    const estW = short.length * 5.6;
    lx = clamp(lx, anchor === 'end' ? estW + 4 : anchor === 'middle' ? estW / 2 + 4 : 4,
                   anchor === 'start' ? W - estW - 4 : anchor === 'middle' ? W - estW / 2 - 4 : W - 4);
    ly = clamp(ly, 14, H - 16);
    cBody += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="10.5" font-weight="650" fill="var(--nw-ink2)" text-anchor="${anchor}" paint-order="stroke" stroke="var(--nw-surface)" stroke-width="3">${esc(short)}<title>${esc(C.label)}</title></text>`
      + `<text x="${lx.toFixed(1)}" y="${(ly + 11).toFixed(1)}" font-size="9" fill="var(--nw-muted)" text-anchor="${anchor}" paint-order="stroke" stroke="var(--nw-surface)" stroke-width="3">${esc(C.genes.length + ' gene' + (C.genes.length === 1 ? '' : 's') + ' · ' + srcTxt)}</text>`;
  });

  const defs = `<defs><marker id="nwArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1 L7 4 L0 7 z" fill="var(--nw-ev4)"/></marker></defs>`;
  const svg = svgEl(W, H, defs + `<g data-l="edges">${eBody}</g><g data-l="nodes">${nBody}</g><g data-l="clabels">${cBody}</g>`,
    `Gene network: ${nodes.length} genes in ${clusters.length} pathway clusters, ${net.edges.length} edges classified by evidence provenance.`);
  const key = keyMode
    ? `<ol class="nw-clkey">${clusterKey.map(k => `<li><b>${k.n}</b><span>${esc(k.label)} — ${k.genes} gene${k.genes === 1 ? '' : 's'}, ${esc(k.srcTxt)}${k.allThree === 0 ? ', none confirmed in all' : ''}</span></li>`).join('')}</ol>`
    : '';
  return { html: `<div class="nw-svgwrap">${svg}</div>${key}`, clusters, H };
}

/* --------------------------------------------- the expression matrix (SVG) */
function renderExpression(subject, exp, W) {
  const anat = exp.shown, genes = subject.genesShown;
  if (!anat.length) return { html: '' };
  const narrow = W < 430;
  const labelW = narrow ? 112 : 150;
  const colW = Math.max(9, Math.min(34, (W - labelW - 20) / Math.max(1, genes.length)));
  const rowH = narrow ? 19 : 21;
  const H = anat.length * rowH + 46;
  /* the viewBox is sized to the CONTENT, not to the container: the svg is width:100%, so a grid
     narrower than the card scales up to fill it instead of leaving half the card empty */
  const VW = Math.max(labelW + genes.length * colW + 8, narrow ? W : Math.min(W, labelW + 120));
  let body = '';
  /* column headings: gene symbols, rotated */
  genes.forEach((g, i) => {
    const x = labelW + i * colW + colW / 2;
    body += `<text x="${x.toFixed(1)}" y="38" font-size="8.5" fill="var(--nw-muted)" text-anchor="start" transform="rotate(-62 ${x.toFixed(1)} 38)">${esc(g.sym)}</text>`;
  });
  const seqVar = n => n >= 4 ? '--nw-seq5' : n === 3 ? '--nw-seq4' : n === 2 ? '--nw-seq3' : '--nw-seq2';
  anat.forEach((R, ri) => {
    const y = 46 + ri * rowH;
    body += `<line x1="0" y1="${(y - 4).toFixed(1)}" x2="${VW}" y2="${(y - 4).toFixed(1)}" stroke="var(--nw-grid)" stroke-width="1"/>`;
    const lbl = R.label.length > (narrow ? 17 : 23) ? R.label.slice(0, narrow ? 16 : 22) + '…' : R.label;
    body += `<text x="2" y="${(y + rowH / 2 - 3).toFixed(1)}" font-size="10" font-weight="${R.isSubject ? 650 : 400}" fill="var(--nw-ink${R.isSubject ? '' : '2'})">${esc(lbl)}<title>${esc(R.label)}${R.uberon ? ' · ' + R.uberon : ''}${R.zfa ? ' · ' + R.zfa : ''}</title></text>`;
    genes.forEach((g, gi) => {
      const rec = R.genes.get(g.sym);
      const x = labelW + gi * colW;
      if (!rec) {
        /* not recorded is NOT absence — draw it as an empty, outlined slot */
        body += `<rect x="${(x + 1.5).toFixed(1)}" y="${(y + 2).toFixed(1)}" width="${(colW - 3).toFixed(1)}" height="${(rowH - 8).toFixed(1)}" rx="2" fill="none" stroke="var(--nw-grid)" stroke-width="1"><title>${esc(g.sym)} in ${esc(R.label)}: not recorded (which is not the same as not expressed)</title></rect>`;
        return;
      }
      const n = rec.sources.size;
      const indep = [...rec.sources].some(s => !/^(ZFIN|Bgee)$/.test(s));
      body += `<rect x="${(x + 1.5).toFixed(1)}" y="${(y + 2).toFixed(1)}" width="${(colW - 3).toFixed(1)}" height="${(rowH - 8).toFixed(1)}" rx="2" fill="var(${seqVar(n)})" stroke="var(--nw-surface)" stroke-width="2"><title>${esc(g.sym)} in ${esc(R.label)}: ${n} source${n === 1 ? '' : 's'} (${esc([...rec.sources].join(', '))})${indep ? '' : ' — ZFIN and Bgee only, which is one strand of evidence, not two'}${rec.stages.size ? ' · stages: ' + esc([...rec.stages].slice(0, 4).join(', ')) : ''}</title></rect>`;
      /* texture, not colour alone: a diagonal tick marks a genuinely independent assay */
      if (indep) body += `<line x1="${(x + 2.5).toFixed(1)}" y1="${(y + rowH - 7).toFixed(1)}" x2="${(x + colW - 4).toFixed(1)}" y2="${(y + 3).toFixed(1)}" stroke="var(--nw-surface)" stroke-width="1.3" opacity="0.95"/>`;
    });
  });
  return {
    html: `<div class="nw-svgwrap">${svgEl(VW, H, body, `Expression matrix: ${genes.length} genes across ${anat.length} anatomical structures, shaded by number of recording sources.`)}</div>`,
  };
}

/* ------------------------------------------------- the supply chain (SVG) */
function renderChain(met, W) {
  if (!met.chain.length) return '';
  const narrow = W < 430;
  const n = met.chain.length;
  const H = narrow ? 58 + n * 40 : 128;
  let body = '';
  if (narrow) {
    met.chain.forEach((c, i) => {
      const y = 22 + i * 40;
      const isBroken = met.worst && c.step === met.worst.step;
      body += `<rect x="8" y="${y}" width="${W - 16}" height="32" rx="6" fill="var(--nw-surface)" stroke="var(${isBroken ? '--nw-critical' : '--nw-axis'})" stroke-width="${isBroken ? 1.8 : 1}" ${isBroken ? 'stroke-dasharray="5 3"' : ''}/>`;
      body += `<text x="16" y="${y + 13}" font-size="9.5" font-weight="650" fill="var(--nw-ink)">${esc(c.step)}${isBroken ? '  ● broken rung' : ''}</text>`;
      body += `<text x="16" y="${y + 25}" font-size="9" fill="var(--nw-ink2)">${esc(num(c.value))} ${esc(c.unit || '')} · ${esc(c.kind || 'kind not stated')}${c.species ? ' · ' + esc(c.species) : ''}</text>`;
      if (i < n - 1) body += `<line x1="${W / 2}" y1="${y + 32}" x2="${W / 2}" y2="${y + 40}" stroke="var(--nw-axis)" stroke-width="1.4" marker-end="url(#nwArrow2)"/>`;
    });
  } else {
    const bw = (W - 16 - (n - 1) * 14) / n;
    met.chain.forEach((c, i) => {
      const x = 8 + i * (bw + 14);
      const isBroken = met.worst && c.step === met.worst.step;
      body += `<rect x="${x.toFixed(1)}" y="24" width="${bw.toFixed(1)}" height="66" rx="7" fill="var(--nw-surface)" stroke="var(${isBroken ? '--nw-critical' : '--nw-axis'})" stroke-width="${isBroken ? 1.8 : 1}" ${isBroken ? 'stroke-dasharray="5 3"' : ''}><title>${esc(c.what)} — ${esc(c.source || 'no source')}</title></rect>`;
      body += `<text x="${(x + bw / 2).toFixed(1)}" y="42" font-size="10" font-weight="650" fill="var(--nw-ink)" text-anchor="middle">${esc(c.step)}</text>`;
      body += `<text x="${(x + bw / 2).toFixed(1)}" y="58" font-size="11.5" fill="var(--nw-ink)" text-anchor="middle" style="font-variant-numeric:tabular-nums">${esc(num(c.value))}</text>`;
      body += `<text x="${(x + bw / 2).toFixed(1)}" y="70" font-size="8" fill="var(--nw-muted)" text-anchor="middle">${esc(c.unit || '')}</text>`;
      body += `<text x="${(x + bw / 2).toFixed(1)}" y="83" font-size="8.5" fill="var(${isBroken ? '--nw-critical' : '--nw-muted'})" text-anchor="middle">${esc(c.kind || 'kind not stated')}</text>`;
      if (isBroken) body += `<text x="${(x + bw / 2).toFixed(1)}" y="17" font-size="9" font-weight="650" fill="var(--nw-critical)" text-anchor="middle">● broken rung</text>`;
      if (i < n - 1) body += `<line x1="${(x + bw + 2).toFixed(1)}" y1="57" x2="${(x + bw + 11).toFixed(1)}" y2="57" stroke="var(--nw-axis)" stroke-width="1.4" marker-end="url(#nwArrow2)"/>`;
    });
  }
  const defs = `<defs><marker id="nwArrow2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 1 L7 4 L0 7 z" fill="var(--nw-axis)"/></marker></defs>`;
  return `<div class="nw-svgwrap">${svgEl(W, H, defs + body, 'Oxygen supply chain with each link’s provenance kind; the borrowed link is marked as the broken rung.')}</div>`;
}

/* ------------------------------------------------ the trajectory (SVG) */
function renderTrajectory(dev, W) {
  const st = dev.stages.filter(s => typeof s.age === 'number');
  if (st.length < 2) return '';
  const hasSL = st.some(s => typeof s.SL === 'number' && s.SL > 0);
  const narrow = W < 430;
  const H = narrow ? 150 : 170;
  const padL = 40, padR = 14, padT = 16, padB = 34;
  const x0 = Math.min(...st.map(s => s.age)), x1 = Math.max(...st.map(s => s.age));
  const X = a => padL + ((a - x0) / Math.max(1e-9, x1 - x0)) * (W - padL - padR);
  const vals = hasSL ? st.map(s => s.SL || 0) : st.map((s, i) => i);
  const y0 = 0, y1 = Math.max(...vals) || 1;
  const Y = v => H - padB - ((v - y0) / Math.max(1e-9, y1 - y0)) * (H - padT - padB);
  let body = `<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="var(--nw-axis)" stroke-width="1"/>`
    + `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="var(--nw-axis)" stroke-width="1"/>`;
  const pts = st.map((s, i) => ({ x: X(s.age), y: Y(hasSL ? (s.SL || 0) : i), s }));
  let lastTickX = -1e9;
  body += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('')}" fill="none" stroke="var(--nw-ev2)" stroke-width="2" stroke-linecap="round"/>`;
  pts.forEach((p, i) => {
    const absent = p.s.hasAbsent;
    body += absent
      ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="none" stroke="var(--nw-critical)" stroke-width="1.8" stroke-dasharray="3 2"><title>${esc(p.s.label)} — carries a field with no source</title></circle>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--nw-ev1)" stroke="var(--nw-surface)" stroke-width="2"><title>${esc(p.s.label)}</title></circle>`;
    /* label the ends always, and an interior tick only when it clears the last label drawn —
       early stages bunch up against the origin and would otherwise overprint each other */
    const isEnd = i === 0 || i === pts.length - 1;
    if (isEnd || p.x - lastTickX >= 24) {
      body += `<text x="${p.x.toFixed(1)}" y="${(H - padB + 13).toFixed(1)}" font-size="8.5" fill="var(--nw-muted)" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${esc(String(p.s.age))}</text>`;
      lastTickX = p.x;
    }
  });
  body += `<text x="2" y="${padT + 4}" font-size="8.5" fill="var(--nw-muted)">${esc(hasSL ? 'SL (m)' : 'stage')}</text>`;
  body += `<text x="${(W - padR).toFixed(1)}" y="${(H - 4).toFixed(1)}" font-size="8.5" fill="var(--nw-muted)" text-anchor="end">age (days, ${esc(dev.source && /morph/.test(dev.source) ? 'after hatching' : 'relative to hatching')})</text>`;
  return `<div class="nw-svgwrap">${svgEl(W, H, body, `Developmental trajectory across ${st.length} stages; dashed rings mark stages carrying a field with no source.`)}</div>`;
}

/* ------------------------------------------------- the chain ladder (SVG) */
function renderLadder(ch, W) {
  const rows = ch.chains.slice(0, 8);
  if (!rows.length) return '';
  const narrow = W < 430;
  const labelW = narrow ? 58 : 72;
  const rowH = 30;
  const H = rows.length * rowH + 34;
  const maxSteps = Math.max(...rows.map(r => r.steps.length), 1);
  const colW = (W - labelW - 12) / maxSteps;
  const gradeRank = g => Math.max(0, ch.grades.indexOf(g));
  const gradeVar = g => { const r = gradeRank(g); return r === 0 ? '--nw-critical' : r <= 2 ? '--nw-seq2' : r === 3 ? '--nw-seq3' : r === 4 ? '--nw-seq4' : '--nw-seq5'; };
  let body = '';
  for (let i = 0; i < maxSteps; i++) {
    body += `<text x="${(labelW + i * colW + colW / 2).toFixed(1)}" y="12" font-size="8" fill="var(--nw-muted)" text-anchor="middle">step ${i + 1}</text>`;
  }
  rows.forEach((r, ri) => {
    const y = 22 + ri * rowH;
    body += `<text x="2" y="${(y + 15).toFixed(1)}" font-size="10" font-weight="650" fill="var(--nw-ink)">${esc(r.sym)}</text>`;
    body += `<text x="2" y="${(y + 25).toFixed(1)}" font-size="7.5" fill="var(--nw-muted)">${esc(r.strength)}</text>`;
    r.steps.forEach((s, si) => {
      const x = labelW + si * colW;
      const isWeak = gradeRank(s.grade) === gradeRank(r.strength);
      body += `<rect x="${(x + 2).toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${(colW - 5).toFixed(1)}" height="${(rowH - 11).toFixed(1)}" rx="3" fill="var(${gradeVar(s.grade)})" stroke="var(${isWeak ? '--nw-critical' : '--nw-surface'})" stroke-width="${isWeak ? 1.8 : 2}" ${isWeak ? 'stroke-dasharray="4 2.5"' : ''}><title>${esc(r.sym)} · ${esc(s.step)} · ${esc(s.grade)}${isWeak ? ' — THIS IS THE WEAKEST LINK: the chain is only as strong as this' : ''} · ${esc(s.organism || '')} · ${esc(s.how || '')}</title></rect>`;
      if (isWeak) body += `<text x="${(x + colW / 2).toFixed(1)}" y="${(y + rowH / 2 + 1).toFixed(1)}" font-size="9" font-weight="700" fill="var(--nw-critical)" text-anchor="middle" paint-order="stroke" stroke="var(--nw-surface)" stroke-width="2.4">●</text>`;
    });
    for (let si = r.steps.length; si < maxSteps; si++) {
      const x = labelW + si * colW;
      body += `<rect x="${(x + 2).toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${(colW - 5).toFixed(1)}" height="${(rowH - 11).toFixed(1)}" rx="3" fill="none" stroke="var(--nw-grid)" stroke-width="1"><title>no step recorded</title></rect>`;
    }
  });
  return `<div class="nw-svgwrap">${svgEl(W, H, body, `Causal chains for ${rows.length} genes; each row is one gene, each cell one link shaded by evidence grade, with the weakest link ringed.`)}</div>`;
}

/* ============================================================== mountScene */
export async function mountScene({ container, THREE, data, act, theme, reducedMotion, onReady, onNote }) {
  const note = typeof onNote === 'function' ? onNote : () => {};
  const base = new URL('../blueprint3d/', import.meta.url);

  /* ---- shell up front so there is never a blank frame */
  const root = document.createElement('div');
  root.className = 'nw-root';
  if (theme === 'light' || theme === 'dark') root.dataset.nwtheme = theme;
  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);
  const body = document.createElement('div');
  body.innerHTML = `<div class="nw-loading">Reading the repo’s pathway, expression, physiology and developmental records for this design…</div>`;
  root.appendChild(body);
  container.appendChild(root);

  /* ---- resolve the subject, then load only what that subject needs */
  let subject, cards, net, exp, met, dev, ch, physio = {}, devRaw = {};
  try {
    subject = await resolveSubject(data, base);
    cards = await loadCards(subject, base);
    const designId = (data && data.design && data.design.id) || (data && data.case && data.case.id) || null;
    const parentId = (data && data.design && data.design.base)
      || (data && data.case && data.case.parents && data.case.parents[0] && data.case.parents[0].organism) || null;
    /* candidate growth-series manifests for this design's lineage. A dev manifest is named after
       the organism, not the stage, so an id like "<organism>-<stage>" also has its last segment
       stripped. Generic: no organism name appears here. */
    const devCandidates = uniq([parentId, designId].filter(Boolean).flatMap(id => {
      const stripped = id.includes('-') ? id.slice(0, id.lastIndexOf('-')) : null;
      return [`${id}-dev`, stripped ? `${stripped}-dev` : null].filter(Boolean);
    }));
    const [cir, gil, stagesJ] = await Promise.all([
      tryJSON(new URL('physiology/circulation.json', base)),
      tryJSON(new URL('physiology/gills.json', base)),
      tryJSON(new URL('development/stages.json', base)),
    ]);
    /* probed SEQUENTIALLY and stopped at the first hit: a growth-series manifest is optional, and
       probing all candidates in parallel means guaranteed 404s on the ones that do not exist. */
    let devManifest = null, devManifestName = null;
    for (const n of devCandidates) {
      const m = await tryJSON(new URL(`model/${n}-manifest.json`, base));
      if (m) { devManifest = m; devManifestName = n; break; }
    }
    physio = { circulation: cir, gills: gil };
    devRaw = {
      stages: stagesJ, devManifest, devManifestName,
      lineageTokens: uniq([designId, parentId].filter(Boolean).flatMap(id => tokens(id.replace(/-/g, ' ')))),
    };
    net = buildNetwork(subject, cards);
    exp = buildExpression(subject, cards);
    met = buildMetabolism(subject, cards, physio);
    dev = buildDevelopment(devRaw);
    ch = buildChains(subject);
  } catch (err) {
    body.innerHTML = `<div class="nw-head"><p class="nw-eyebrow">networks</p><h2 class="nw-title">The network view could not be built</h2></div>`
      + gapBlock('data could not be read', `${esc(err && err.message || String(err))}. Nothing is drawn in its place.`);
    onReady?.();
    return {
      duration: 6, play() {}, pause() {}, seek() {}, dispose() { root.remove(); },
      provenance: { summary: 'The served pathway and expression records could not be read, so no network is drawn.', verdict: 'assumed', items: [{ label: 'gene network', kind: 'absent', source: String(err && err.message || err) }] },
    };
  }

  /* ---- nothing at all to show: skip with a reason rather than a placeholder (SCENES §10.5) */
  if (!subject.genesShown.length && !dev.present && !met.present) {
    root.remove();
    return {
      skip: true,
      reason: subject.partsIndexPresent
        ? 'this design resolves to no gene and no body part the repo has records for, and no staged or physiological data exists for its lineage either'
        : 'the served omics part index could not be read, so no gene could be resolved for this design',
    };
  }

  /* ---------- narration, templated from case.changed / case.function (never a fin sentence) */
  const C = subject.caseInfo || {};
  const changed = subject.changed;
  const parentName = (C.parents && C.parents[0] && C.parents[0].organism) || (data?.design?.base) || 'its parent';
  const blend = (C.parents || []).length > 1;
  const dirWord = d => d === 'increase' ? 'enlarged' : d === 'decrease' ? 'reduced' : 'moved';
  const changeSentence = () => {
    if (!changed.length) return `This design carries no recorded parameter change against ${parentName}.`;
    const bits = changed.slice(0, 3).map(c => {
      const f = (typeof c.factor === 'number' && isFinite(c.factor) && c.factor > 0) ? `${num(c.factor)}×` : null;
      const join = c.direction === 'decrease' ? ' to ' : ' ';
      return `${c.label || c.parameter} ${dirWord(c.direction)}${f ? join + f : ''}`;
    });
    return `${bits.join('; ')}${changed.length > 3 ? `, and ${changed.length - 3} more` : ''} against ${blend ? 'the weighted parents' : parentName}.`;
  };
  const subtraction = /subtraction/.test(C.kind || '') || C.direction === 'decrease'
    || (!!changed.length && changed.every(c => c.direction === 'decrease'));
  const fnName = C.function?.name || null;
  const fnStatus = C.function?.status || null;
  const noAnalogue = C.function?.no_real_organism_has_it === true;
  const partNames = subject.parts.map(p => p.label);
  const partPhrase = partNames.length ? partNames.join(' and ') : 'the structure in play';

  /* the subtraction reading: the removed structure's genes do not disappear with it */
  const subtractionLine = subtraction
    ? `Because this is a subtraction, the question is not what the new ${partPhrase} does — it is what the ${partPhrase} was doing. These genes do not disappear with the structure: the panels below show the other places the same genes are recorded, which is what a subtraction actually costs.`
    : '';

  /* ------------------------------------------------------------- panels */
  const W0 = Math.max(300, Math.round(container.clientWidth || 720));
  function buildPanels(W) {
    const P = [];

    /* ---- 1. NETWORK ---- */
    {
      const r = renderNetwork(subject, net, W);
      const usedClasses = EV.map(e => e.id).filter(id => net.byClass[id] > 0);
      const noConfirm = net.agreement.filter(a => a.allThree.length === 0);
      const missingSrc = net.agreement.filter(a => a.sourcesMissing.length > 0);
      const jAll = net.agreement.flatMap(a => a.pairs.map(p => p.j)).filter(x => typeof x === 'number');
      let h = `<div class="nw-head"><p class="nw-eyebrow">under the hood · 1 of 5 · gene network</p>`
        + `<h2 class="nw-title">The genes behind ${esc(partPhrase)}, and how firmly they are linked</h2>`
        + `<p class="nw-sub">${esc(changeSentence())} ${esc(subject.geneRule)}. Each line is an edge the data records; the line's texture and shade say <em>how</em> it is known, which is the thing that usually goes unsaid.</p></div>`;
      h += stats([
        { v: subject.genesShown.length + (subject.hiddenGenes ? ` of ${subject.genesAll.length}` : ''), k: 'genes drawn' + (subject.hiddenGenes ? ` (+${subject.hiddenGenes} more not drawn)` : '') },
        { v: net.edges.length, k: 'edges' },
        { v: (r.clusters || []).length, k: 'pathway clusters' },
        { v: net.byClass.curated || 0, k: 'edges curated in this species' },
      ]);
      h += r.html;
      h += `<div class="nw-legend">${evLegend(usedClasses)}`
        + `<span class="nw-lg"><svg width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1" fill="var(--nw-node)" stroke="var(--nw-ink)" stroke-width="1.5"/></svg>square = a causal chain exists</span>`
        + `<span class="nw-lg"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="var(--nw-node)" stroke="var(--nw-axis)" stroke-width="1.2"/></svg>circle = no chain in this repo</span></div>`;
      if (net.byClass.curated === 0 && net.edges.length) {
        h += warnBlock('not one edge here is curated in this species',
          `All ${net.edges.length} edges are electronic, orthology-inferred or copied from another species. The picture is real; the <em>confidence</em> it suggests is not.`);
      }
      /* the measured agreement, for THESE genes */
      if (net.agreement.length) {
        const agRows = net.agreement.slice(0, 7);
        if (W < 560) {
          /* Five columns of prose do not fit a phone: the same numbers go in stacked rows, which
             stay readable instead of shredding every source name into one letter per line. */
          h += `<div class="nw-card">` + agRows.map(a => `<div class="nw-agrow">`
            + `<div class="nw-agh"><span>${esc(a.label)}</span><span class="nw-agn">${a.nGenes} gene${a.nGenes === 1 ? '' : 's'}</span></div>`
            + `<div class="nw-agb">${a.sourcesPresent.length ? esc(a.sourcesPresent.join(' · ')) : '<span style="color:var(--nw-critical)">no public source records these genes here</span>'}</div>`
            + (a.sourcesMissing.length ? `<div class="nw-agb" style="color:var(--nw-muted)">no rows from ${esc(a.sourcesMissing.join(', '))}</div>` : '')
            + `<div class="nw-agb">Jaccard ${a.pairs.length ? esc(num(a.jMin) + '–' + num(a.jMax)) : '—'} · `
            + `<span style="${a.allThree.length === 0 ? 'color:var(--nw-critical);font-weight:650' : ''}">${a.allThree.length} confirmed in all ${net.coreSources.length}</span></div>`
            + `</div>`).join('') + `</div>`;
        } else {
        h += `<div class="nw-card"><table class="nw-tbl"><thead><tr><th>pathway cluster</th><th class="nw-num">genes</th><th>public sources present</th><th class="nw-wide">Jaccard</th><th class="nw-wide">in all ${net.coreSources.length}</th></tr></thead><tbody>`
          + agRows.map(a => `<tr><td>${esc(a.label)}</td><td class="nw-num">${a.nGenes}</td>`
            + `<td>${a.sourcesPresent.length ? esc(a.sourcesPresent.join(', ')) : '<span style="color:var(--nw-critical)">none</span>'}`
            + `${a.sourcesMissing.length ? `<br><span class="nw-pill">no rows from ${esc(a.sourcesMissing.join(', '))}</span>` : ''}</td>`
            + `<td class="nw-wide">${a.pairs.length ? esc(num(a.jMin) + '–' + num(a.jMax)) : '—'}</td>`
            + `<td class="nw-wide" style="${a.allThree.length === 0 ? 'color:var(--nw-critical);font-weight:650' : ''}">${a.allThree.length}</td></tr>`).join('')
          + `</tbody></table></div>`;
        }
        h += `<p class="nw-note">Jaccard is computed here, over the genes in this picture only, between the public sources that actually have rows for each cluster. KEGG is excluded everywhere: its rows are licence-restricted and local-only, so only its pathway names could ever be cited.</p>`;
        if (noConfirm.length) {
          const silent = noConfirm.filter(a => a.sourcesMissing.length).length;
          h += gapBlock(`${noConfirm.length} of ${net.agreement.length} clusters have no gene confirmed across all public sources`,
            `${esc(noConfirm.slice(0, 4).map(a => a.label).join(', '))}${noConfirm.length > 4 ? `, and ${noConfirm.length - 4} more` : ''}. For ${silent} of them at least one public source records <em>none of these genes</em> in that cluster at all, so for those the agreement is not low — there is nothing to agree with. Whether that source carries no such pathway for this species, or simply places these particular genes elsewhere, is not something this view can tell you.`);
        }
        if (jAll.length) {
          const jm = jAll.reduce((a, b) => a + b, 0) / jAll.length;
          h += `<p class="nw-note">Mean pairwise agreement across every cluster drawn here: <strong>${esc(num(jm))}</strong> (Jaccard, 1.0 would be perfect agreement). Read it carefully: it is computed over <strong>${subject.genesShown.length} well-studied genes</strong>, not genome-wide, and a small, heavily-annotated gene set is the most favourable case there is — across the whole gene universe these same sources agree far less. The sources are also not independent of one another: orthology-inferred and cross-species rows largely descend from the same human annotation, so even this much agreement is partly an echo.</p>`;
        }
      }
      if (net.regDropped > 0) {
        h += `<p class="nw-note">${net.regDropped} documented regulatory targets were dropped because the target gene is not in this picture; the ones drawn are those with both ends in play.</p>`;
      }
      h += `<p class="nw-src">Nodes and edges: per-gene cards under <code>omics/genes/</code> (pathway layer: GO from ZFIN and UniProt-GOA with their evidence class, Reactome, WikiPathways, Pathway Commons). Gene set: ${esc(subject.geneSourceLabel)}. Node size = recorded pathway rows. Evidence classes come from each row's own <code>kind</code>; note that the served card collapses GO experimental codes and curator statements into one <code>curated</code> kind, so this view cannot separate those two — the legend says "curated", not "experimental", for that reason.</p>`;
      P.push({ id: 'network', label: 'the network', html: h, say: `These are the genes the repo has records for in ${partPhrase}, clustered by the pathways they share. The line textures are the point: most of these links are not experiments done in this animal, they are facts copied in from elsewhere.` });
    }

    /* ---- 2. REGULATION AND EXPRESSION ---- */
    {
      let h = `<div class="nw-head"><p class="nw-eyebrow">under the hood · 2 of 5 · regulation and expression</p>`
        + `<h2 class="nw-title">Where these genes are actually switched on</h2>`
        + `<p class="nw-sub">Recorded expression by anatomy and stage. Shade is how many sources record it; a filled cell is a record, an outlined cell means <em>not recorded</em>, which is not the same as not expressed. Structure names are clickable.</p></div>`;
      if (!exp.shown.length) {
        h += gapBlock('no expression record for these genes',
          `None of the ${subject.genesShown.length} genes drawn has an expression or marker record in the served transcriptomic layer, so there is nothing to place on the body. ${exp.anyFeature ? '' : 'The layer returned no rows at all for this gene set.'}`);
      } else {
        const subjRows = exp.shown.filter(r => r.isSubject);
        const indepTotals = exp.shown.map(r => r.independent.length);
        h += stats([
          { v: exp.all.length, k: 'structures with a record' + (exp.hidden ? ` (${exp.hidden} not shown)` : '') },
          { v: exp.shown.reduce((a, r) => a + r.nGenes, 0), k: 'gene × structure records drawn' },
          { v: Math.max(0, ...indepTotals), k: 'most genes with an independent assay in one structure' },
        ]);
        h += renderExpression(subject, exp, W).html;
        h += `<div class="nw-legend">`
          + [1, 2, 3, 4].map(n => `<span class="nw-lg"><svg width="14" height="10" aria-hidden="true"><rect x="1" y="1" width="12" height="8" rx="2" fill="var(--nw-seq${n >= 4 ? 5 : n + 1})"/></svg>${n}${n === 4 ? '+' : ''} source${n === 1 ? '' : 's'}</span>`).join('')
          + `<span class="nw-lg"><svg width="14" height="10" aria-hidden="true"><rect x="1" y="1" width="12" height="8" rx="2" fill="none" stroke="var(--nw-grid)"/></svg>not recorded</span>`
          + `<span class="nw-lg"><svg width="14" height="10" aria-hidden="true"><rect x="1" y="1" width="12" height="8" rx="2" fill="var(--nw-seq4)"/><line x1="2" y1="8" x2="12" y2="2" stroke="var(--nw-surface)" stroke-width="1.3"/></svg>tick = an independent assay</span></div>`;
        h += `<div class="nw-card"><table class="nw-tbl"><thead><tr><th>structure</th><th class="nw-num">genes</th><th class="nw-wide" title="genes with support from an assay independent of the curated in-situ record">indep. assay</th><th>sources recording it</th></tr></thead><tbody>`
          + exp.shown.slice(0, 8).map(r => `<tr><td><button class="nw-anat" type="button" data-uberon="${esc(r.uberon || '')}" data-zfa="${esc(r.zfa || '')}" data-label="${esc(r.label)}" aria-pressed="false">${esc(r.label)}</button>${r.isSubject ? ' <span class="nw-pill">this design changed it</span>' : ''}</td>`
            + `<td class="nw-num">${r.nGenes}</td><td class="nw-wide" style="${r.independent.length === 0 ? 'color:var(--nw-critical);font-weight:650' : ''}">${r.independent.length}</td>`
            + `<td>${esc(r.allSources.join(', '))}</td></tr>`).join('')
          + `</tbody></table></div>`;
        /* the independence caveat, computed */
        const worst = exp.shown.filter(r => r.nGenes >= 3).sort((a, b) => (a.independent.length / a.nGenes) - (b.independent.length / b.nGenes))[0];
        const hasDependent = exp.shown.some(r => r.allSources.includes('ZFIN') && r.allSources.includes('Bgee'));
        if (hasDependent) {
          h += warnBlock('two of these sources are one source',
            `Bgee imports the curated in-situ records, so a cell backed by both of them is one strand of evidence counted twice. Only the ticked cells have an assay that is genuinely independent of the curated record.${worst ? ` In <strong>${esc(worst.label)}</strong> that is <strong>${worst.independent.length} of ${worst.nGenes}</strong> genes.` : ''}`);
        }
        const subjNoIndep = subjRows.filter(r => r.independent.length === 0);
        if (subjNoIndep.length) {
          h += gapBlock('no independent assay in the structure this design changed',
            `${esc(subjNoIndep.map(r => r.label).join(', '))} has records, but none from an assay independent of the curated in-situ set.`);
        }
        if (subtraction) h += `<p class="nw-note">${esc(subtractionLine)}</p>`;
      }
      h += `<p class="nw-src">Expression and marker records: served transcriptomic layer (curated in-situ by anatomy and stage; Bgee present/absent calls; stage-resolved baseline TPMs; single-cell cluster markers). Anatomy carries both its species-specific term and its cross-species UBERON term where one exists.</p>`;
      P.push({ id: 'expression', label: 'regulation', html: h, say: `Here is where those genes are recorded as switched on, structure by structure. The ticks matter more than the shading: without one, the evidence is a curated record and a database that imported it.` });
    }

    /* ---- 3. METABOLISM ---- */
    {
      let h = `<div class="nw-head"><p class="nw-eyebrow">under the hood · 3 of 5 · metabolism</p>`
        + `<h2 class="nw-title">The metabolism this design’s performance rests on</h2>`
        + `<p class="nw-sub">${fnName ? `Any claim about ${esc(fnName)} runs through oxygen supply. ` : ''}The chain below is read link by link out of the repo's own physiology records, with each value's provenance printed under it — including the one that was borrowed from another animal.</p></div>`;
      if (met.pathways.length) {
        h += `<div class="nw-card"><table class="nw-tbl"><thead><tr><th>metabolic pathway these genes sit in</th><th class="nw-num">genes</th><th>how it is known</th></tr></thead><tbody>`
          + met.pathways.slice(0, 7).map(p => `<tr><td>${esc(p.label)}</td><td class="nw-num">${p.nGenes}</td><td>${esc((EV_BY[p.ev] || {}).label || p.ev)} · ${esc(p.sources.join(', '))}</td></tr>`).join('')
          + `</tbody></table></div>`
          + `<p class="nw-note">These ${met.pathways.length} pathways were picked out of the genes' own recorded pathway and process labels by matching metabolic words in the label text — a lexical filter over real ontology labels, not a curated pathway list. It will miss a metabolic pathway whose name does not say so.</p>`;
      } else {
        h += gapBlock('none of these genes is recorded in a metabolic pathway',
          `The genes this design resolves to carry no pathway or process label that reads as metabolic, so there is no metabolic view of them to draw. The oxygen chain below is about the whole animal, not about these genes.`);
      }
      if (met.present && met.chain.length) {
        h += renderChain(met, W);
        if (met.worst) {
          h += gapBlock(`the chain's weakest link: ${esc(met.worst.step)}`,
            `<strong>${esc(met.worst.what)}</strong> is ${esc(met.worst.kind || 'of unstated kind')}${met.worst.species ? `, measured in <em>${esc(met.worst.species)}</em> — a different animal from this design's lineage` : ''}. Every ceiling computed from this chain inherits that substitution. ${met.alt ? `The repo records a second value for the same quantity, ${esc(num(met.alt.rest ?? met.alt.max))} from ${esc(met.alt.species || 'another source')} — the two disagree, and nothing here hides that.` : ''}`);
          h += `<p class="nw-note">This is what a borrowed number does to a bound: a cardiac output measured in another species sets the oxygen ceiling for this one. When the ceiling is compared against an oxygen uptake <em>measured</em> in the proxy species the chain is supposed to describe, the ceiling can come out below the measurement — which means the bound was never a bound. The honest reading is that the chain holds only to within the distance between those two animals.</p>`;
        }
        const kinds = uniq(met.chain.map(c => c.kind).filter(Boolean));
        h += `<p class="nw-note">Provenance kinds present in this chain: ${esc(kinds.join(', ') || 'none stated')}. Not one link is measured in this design's own organism.</p>`;
      } else {
        h += gapBlock('no physiology chain is served for this design',
          'The oxygen supply records could not be read, so no chain is drawn and no aerobic ceiling is implied.');
      }
      const phys = data && data.physics_check;
      if (phys && phys.ran === false) {
        h += warnBlock('the physics gate did not run', esc(phys.reason || 'no reason given') + ' — so nothing on this panel has been checked against a physics bound.');
      }
      h += `<p class="nw-src">Chain values: served <code>physiology/circulation.json</code> and <code>physiology/gills.json</code>, each value carrying its own <code>kind</code>, species and source. Metabolic pathway membership: the genes' own pathway and GO process rows.</p>`;
      P.push({ id: 'metabolism', label: 'metabolism', html: h, say: `Performance claims rest on oxygen, and oxygen rests on this chain. One link was borrowed from a different animal, and that single substitution sets the ceiling for everything downstream of it.` });
    }

    /* ---- 4. DEVELOPMENT ---- */
    {
      let h = `<div class="nw-head"><p class="nw-eyebrow">under the hood · 4 of 5 · development</p>`
        + `<h2 class="nw-title">The trajectory this design would have to grow along</h2>`
        + `<p class="nw-sub">Real staged data, with each stage's values carrying the kind of thing they are — measured, derived, a stand-in from another species, or an assumption with no source at all. Disagreements are left in.</p></div>`;
      if (!dev.present) {
        h += gapBlock('no staged data for this design’s lineage',
          'Neither a growth-mesh stage set nor a staged life-history table could be read for this design or its parent, so no trajectory is drawn.');
      } else {
        const absent = dev.stages.filter(s => s.hasAbsent);
        if (dev.offLineage) {
          h += gapBlock('no staged data exists for this design’s own lineage',
            `No growth-series stage set is committed for this design or its parent, so the stages below are the only staged table available — and it is about a different animal: <em>${esc(dev.tableTitle)}</em>. Read every stage below as a stand-in, not as this design's development.`);
        }
        h += stats([
          { v: dev.stages.length, k: 'stages with records' },
          { v: absent.length, k: 'stages carrying a field with no source' },
          { v: dev.disagreements.length, k: 'disagreements between sources' },
        ]);
        h += renderTrajectory(dev, W);
        h += `<div class="nw-card"><table class="nw-tbl"><thead><tr><th>stage</th><th class="nw-num">age (d)</th><th>what its numbers are</th></tr></thead><tbody>`
          + dev.stages.slice(0, 8).map(s => {
            const kinds = {};
            for (const b of (s.basis || [])) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
            const pills = Object.entries(kinds).map(([k, n]) => `<span class="nw-pill" style="${k === 'absent' ? 'border-color:var(--nw-critical);color:var(--nw-critical)' : ''}">${esc(k)} ×${n}</span>`).join(' ');
            return `<tr><td>${esc(s.label.length > 46 ? s.label.slice(0, 45) + '…' : s.label)}</td><td class="nw-num">${esc(String(s.age))}</td><td>${pills || '<span style="color:var(--nw-muted)">no kinds recorded</span>'}${s.caveat ? `<br><span style="color:var(--nw-muted)">${esc(String(s.caveat).slice(0, 150))}</span>` : ''}</td></tr>`;
          }).join('')
          + `</tbody></table></div>`;
        if (dev.disagreements.length) {
          h += gapBlock(`${dev.disagreements.length} source disagreement${dev.disagreements.length === 1 ? '' : 's'}, shown rather than averaged`,
            dev.disagreements.slice(0, 3).map(d => `At <strong>${esc(d.stage)}</strong>, ${esc(d.field.replace(/_/g, ' '))}: ${esc(d.a)} versus ${esc(d.b)}. The ranges do not overlap, so one of them is wrong for this animal and nothing here decides which.`).join('<br><br>'));
        } else {
          h += `<p class="nw-note">No two entries for the same stage field have non-overlapping ranges in this set, so no numeric disagreement is flagged. That is the absence of a detected conflict, not a demonstration of agreement — most of these fields carry only one entry.</p>`;
        }
        if (dev.notFound.length) {
          h += gapBlock(`${dev.notFound.length} question the record answers with "not found"`,
            dev.notFound.slice(0, 2).map(n => `<strong>${esc(n.what)}</strong>: ${esc(String(n.answer).slice(0, 230))} (${n.searched} searches logged).`).join('<br><br>'));
        }
        if (absent.length) {
          h += warnBlock(`${absent.length} stage${absent.length === 1 ? '' : 's'} rest${absent.length === 1 ? 's' : ''} partly on an assumption`,
            `Dashed rings on the curve mark them. The curve is drawn through them anyway, because dropping them would make the trajectory look better sourced than it is.`);
        }
      }
      h += `<p class="nw-src">Staged values: ${esc(dev.source || 'none available')}. Growth-mesh stages are the morph targets of the committed <code>*-dev.glb</code> growth series; the life-stage table carries a per-field kind, source and verbatim locator.</p>`;
      P.push({ id: 'development', label: 'development', html: h, say: `A design is not a shape, it is a trajectory something has to grow along. These are the real stages, and the dashed rings are the stages where a number had no source and was assumed.` });
    }

    /* ---- 5. CAUSAL CHAINS ---- */
    {
      let h = `<div class="nw-head"><p class="nw-eyebrow">under the hood · 5 of 5 · causal chains</p>`
        + `<h2 class="nw-title">From gene to phenotype, with the broken rung left in</h2>`
        + `<p class="nw-sub">A chain is only as strong as its weakest link, so that is what is ringed. A network that implied a clean path from a gene to a working structure would be the single most misleading thing this walkthrough could draw.</p></div>`;
      if (!ch.chains.length) {
        h += gapBlock('no causal chain exists for any gene in this design',
          `None of the ${subject.genesShown.length} genes drawn has a gene-to-phenotype chain in the repo's chain file. So there is no causal story to tell about this design at all — only co-membership and expression, which are associations.`);
      } else {
        const byStrength = {};
        for (const c of ch.chains) byStrength[c.strength] = (byStrength[c.strength] || 0) + 1;
        const weakest = ch.chains.filter(c => ['missing', 'hypothesis', 'association'].includes(c.strength));
        h += stats([
          { v: `${ch.chains.length} of ${subject.genesShown.length}`, k: 'genes drawn that have any chain' },
          { v: weakest.length, k: 'chains whose weakest link is association or worse' },
          { v: `${subject.chainBySym.size} of ${subject.genesAll.length}`, k: 'genes resolved to this design that have a chain anywhere' },
        ]);
        /* Do not let the first stat read as a coverage result: the drawn set was RANKED by having
           a chain, so a high number there is the selection, not the evidence. */
        if (subject.hiddenGenes > 0) {
          h += warnBlock('that first number is a selection effect, not a coverage figure',
            `The ${subject.genesShown.length} genes drawn were ranked partly on <em>whether a chain exists</em>, so of course most of them have one. Across all <strong>${subject.genesAll.length}</strong> genes this design resolves to, only <strong>${subject.chainBySym.size}</strong> have a gene-to-phenotype chain anywhere in this repo — that is the coverage figure, and it is the honest one.`);
        }
        h += renderLadder(ch, W);
        h += `<div class="nw-legend">`
          + ['missing', 'association', 'necessity', 'sufficiency', 'mechanism'].map(g => {
            const r = ch.grades.indexOf(g);
            const v = r === 0 ? '--nw-critical' : r <= 2 ? '--nw-seq2' : r === 3 ? '--nw-seq3' : r === 4 ? '--nw-seq4' : '--nw-seq5';
            return `<span class="nw-lg"><svg width="14" height="10" aria-hidden="true"><rect x="1" y="1" width="12" height="8" rx="2" fill="var(${v})"/></svg>${esc(g)}</span>`;
          }).join('')
          + `<span class="nw-lg"><svg width="14" height="10" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="7" rx="2" fill="none" stroke="var(--nw-critical)" stroke-width="1.6" stroke-dasharray="4 2.5"/></svg>● the weakest link — the chain's real strength</span></div>`;
        const withBreak = ch.chains.filter(c => c.weakest);
        if (withBreak.length) {
          h += `<div class="nw-card"><table class="nw-tbl"><thead><tr><th>gene</th><th>chain strength</th><th>where it breaks</th></tr></thead><tbody>`
            + withBreak.slice(0, 5).map(c => `<tr><td><strong>${esc(c.sym)}</strong></td><td>${esc(c.strength)}${c.best && c.best !== c.strength ? `<br><span class="nw-pill">best single link: ${esc(c.best)}</span>` : ''}</td><td>${esc(String(c.weakest).slice(0, 300))}${String(c.weakest).length > 300 ? '…' : ''}</td></tr>`).join('')
            + `</tbody></table></div>`;
        }
        if (ch.withoutChain.length) {
          h += gapBlock(`${ch.withoutChain.length} of the ${subject.genesShown.length} genes drawn have no chain at all`,
            `${esc(ch.withoutChain.slice(0, 10).join(', '))}${ch.withoutChain.length > 10 ? ', …' : ''}. They are in the network on pathway membership and expression only. Neither is causation.`);
        }
      }
      /* the project's own verdict, read from the run rather than asserted */
      const gates = (data && data.verdict && data.verdict.gates) || [];
      const failed = gates.filter(g => /fail|mismatch|violat/i.test(String(g.status || '')));
      const notRun = ['genotype_similarity', 'phenotype_similarity', 'lean_check', 'functional_resolution', 'physics_check']
        .map(k => [k, data && data[k]]).filter(([, v]) => v && v.ran === false);
      if (failed.length || notRun.length) {
        h += `<div class="nw-card"><table class="nw-tbl"><thead><tr><th>the run’s own gates</th><th>outcome</th></tr></thead><tbody>`
          + failed.map(g => `<tr><td>${esc(g.label || g.id)}</td><td style="color:var(--nw-critical)">${esc(g.status)}${g.why ? ' — ' + esc(String(g.why).slice(0, 180)) : ''}</td></tr>`).join('')
          + notRun.map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, ' '))}</td><td>did not run — ${esc(String(v.reason || '').slice(0, 200))}</td></tr>`).join('')
          + `</tbody></table></div>`;
      }
      if (data && data.functional_resolution && data.functional_resolution.ran === false) {
        h += gapBlock('the functional-resolution ledger did not run',
          `${esc(data.functional_resolution.reason || 'no reason given')}. So for every difference between this design and its analogue, <em>nothing</em> here says how that difference is accounted for. This panel shows mechanism where the repo has it and a gap where it does not; it does not show that the design works.`);
      }
      if (noAnalogue) {
        h += gapBlock('no real organism has this function',
          'There is no analogue to compare the network against, so nothing in these five panels can be validated against an animal that does this. The comparison is absent, not merely weak.');
      } else if (fnStatus === 'lost') {
        h += `<p class="nw-note">This design <em>loses</em> ${esc(fnName || 'a function')}. The chains above are the mechanism that would have delivered it; read them as the bill for the subtraction, not as support for it.</p>`;
      }
      h += `<p class="nw-src">Chains: the repo's gene-to-phenotype chain file — every link carries its own publication, organism, experiment type and evidence grade, and every chain carries the sentence naming where it breaks. Grades, weakest to strongest: ${esc(ch.grades.join(' → '))}. All of it is proxy-species work; none of it was done in this design.</p>`;
      P.push({ id: 'chains', label: 'causal chains', html: h, say: `Finally, the chains from gene to structure. Every ringed cell is the weakest link, and the weakest link is the chain's real strength. The broken rungs are not a flaw in the picture; they are the finding.` });
    }
    return P;
  }

  let W = W0;
  let panels = buildPanels(W);

  /* ---------------------------------------------------------- the timeline */
  const PER = 7;                                  // seconds per panel
  const duration = panels.length * PER;
  const chapters = panels.map((p, i) => ({ t: i * PER, label: p.label, say: p.say }));

  /* DOM: one container per panel, only the active one displayed. Reveal is a pure function of t. */
  body.innerHTML = '';
  const hosts = panels.map(p => {
    const d = document.createElement('section');
    d.className = 'nw-panel';
    d.dataset.panel = p.id;
    d.innerHTML = p.html;
    body.appendChild(d);
    return d;
  });

  /* clickable anatomy -> tell the stage, and mark the selection */
  let selected = null;
  function onClick(ev) {
    const btn = ev.target.closest && ev.target.closest('.nw-anat');
    if (!btn || !root.contains(btn)) return;
    const payload = { uberon: btn.dataset.uberon || null, zfa: btn.dataset.zfa || null, label: btn.dataset.label || btn.textContent };
    selected = payload.label;
    for (const b of root.querySelectorAll('.nw-anat')) b.setAttribute('aria-pressed', String(b.dataset.label === selected));
    /* the stage owns the body; we only announce */
    container.dispatchEvent(new CustomEvent('delphi:part-select', { detail: payload, bubbles: true }));
    note({
      severity: 'note', title: `Structure selected: ${payload.label}`,
      text: `${payload.label}${payload.uberon ? ` (${payload.uberon}` : ''}${payload.zfa ? `${payload.uberon ? ', ' : ' ('}${payload.zfa}` : ''}${payload.uberon || payload.zfa ? ')' : ''} — the expression panel's row for this structure lists which sources record each gene there.`,
      source: 'networks.js',
    });
  }
  root.addEventListener('click', onClick);

  /** PURE IN t. Reveal is derived from t alone; scrubbing backwards gives the identical frame. */
  function render(t) {
    const tt = clamp(t, 0, duration);
    const i = Math.min(panels.length - 1, Math.floor(tt / PER));
    const p = reducedMotion ? 1 : clamp((tt - i * PER) / (PER * 0.55), 0, 1);
    hosts.forEach((h, k) => {
      h.dataset.on = k === i ? '1' : '0';
      const blocks = h.children;
      const n = blocks.length;
      /* An inactive panel is reset to its canonical state rather than left holding the inline
         styles from when it was last active — otherwise the DOM as a whole is not a pure function
         of t and scrubbing away and back gives a different tree. */
      const prog = k === i ? p : (k < i ? 1 : 0);
      for (let b = 0; b < n; b++) {
        const thresh = n <= 1 ? 0 : (b / n) * 0.92;
        const on = prog >= thresh;
        blocks[b].style.opacity = on ? '1' : '0';
        blocks[b].style.visibility = on ? 'visible' : 'hidden';
      }
    });
  }

  let raf = 0, playing = false, t0 = 0, local = 0;
  const loop = now => {
    if (!playing) return;                        // never a rAF while paused
    local = Math.min(duration, (now - t0) / 1000);
    render(local);
    if (local < duration) raf = requestAnimationFrame(loop); else { playing = false; raf = 0; }
  };

  render(0);

  /* stated limitations (SCENES §10.6) */
  if (subject.hiddenGenes > 0) {
    note({
      severity: 'note', title: 'The network is capped',
      text: `${subject.genesAll.length} genes resolve to this design; ${subject.genesShown.length} are drawn and ${subject.hiddenGenes} are not. The drawn set is ranked by recorded evidence and by whether a causal chain exists, so it is the best-evidenced slice, not a random one, and not the whole set.`,
      source: 'networks.js',
    });
  }
  if (!subject.parts.length && !(data?.design?.edits || []).length) {
    note({
      severity: 'warning', title: 'This act could not resolve a body part',
      text: 'Neither case.changed[].part nor design.edits[].part resolved to a structure in the served part index, so the gene set fell back to whatever the phenotype gate’s feature names matched. Treat the gene membership of these panels as approximate.',
      source: 'networks.js',
    });
  }
  if (met.pathways.length) {
    note({
      severity: 'note', title: 'Metabolic pathways are selected lexically',
      text: 'There is no "is metabolic" flag in the data, so metabolic pathways are picked by matching metabolic words in the real ontology labels these genes carry. It will miss a metabolic pathway whose name does not say so.',
      source: 'networks.js',
    });
  }

  /* --------------------------------------------------------- provenance §4 */
  const usedClasses = EV.filter(e => (net.byClass[e.id] || 0) > 0);
  const items = [];
  items.push({ label: `gene set (${subject.genesShown.length} drawn of ${subject.genesAll.length})`, kind: (data?.design?.edits || []).length ? 'observed' : 'derived', source: subject.geneSourceLabel });
  for (const e of usedClasses) {
    items.push({
      label: `${net.byClass[e.id]} network edges — ${e.label}`,
      kind: e.id === 'curated' ? 'observed' : e.id === 'electronic' ? 'derived' : e.id === 'orthology' ? 'proxy' : 'proxy',
      source: e.id === 'curated' ? 'GO rows whose served kind is curated — this collapses experimental codes with curator statements, so it is not "experimental"'
        : e.id === 'electronic' ? 'GO IEA rows: assigned by software, no curator'
        : e.id === 'orthology' ? 'orthology- or phylogeny-transferred rows (Reactome dre, GO IBA/ISS, homology-converted pathways)'
        : 'Pathway Commons human rows mapped onto zebrafish paralogs; a human fact, not a fish measurement',
    });
  }
  const noConfirm = net.agreement.filter(a => a.allThree.length === 0);
  if (noConfirm.length) items.push({ label: `${noConfirm.length} pathway clusters with no gene confirmed across all public sources`, kind: 'absent', source: 'computed here over the genes drawn; some clusters have a public source with no pathway of that kind at all for this species' });
  if (exp.shown.length) {
    const dep = exp.shown.some(r => r.allSources.includes('ZFIN') && r.allSources.includes('Bgee'));
    items.push({ label: 'expression by anatomy and stage', kind: 'proxy', source: 'curated in-situ, Bgee calls, stage TPMs and single-cell markers — a proxy species, never this design' });
    if (dep) items.push({ label: 'independence of the expression sources', kind: 'absent', source: 'Bgee imports the curated in-situ records, so those two are one strand; only the ticked cells have an independent assay' });
  } else {
    items.push({ label: 'expression layer', kind: 'absent', source: 'no expression or marker record for any gene drawn' });
  }
  if (met.pathways.length) items.push({ label: `${met.pathways.length} metabolic pathways`, kind: 'derived', source: 'selected by lexical match on the genes’ own ontology labels, not a curated pathway list' });
  else items.push({ label: 'metabolic pathway view', kind: 'absent', source: 'no gene drawn carries a pathway or process label that reads as metabolic' });
  if (met.worst) items.push({ label: `oxygen chain link "${met.worst.step}"`, kind: met.worst.species ? 'proxy' : (met.worst.kind || 'assumed'), source: `${met.worst.what} — ${met.worst.source || 'no source'}${met.worst.species ? `, measured in ${met.worst.species}` : ''}; every ceiling computed from this chain inherits it` });
  for (const c of met.chain) if (c !== met.worst) items.push({ label: `oxygen chain link "${c.step}"`, kind: c.kind || 'assumed', source: `${c.what} — ${c.source || 'no source'}` });
  if (dev.present) {
    items.push({ label: `developmental trajectory (${dev.stages.length} stages)`, kind: dev.offLineage ? 'proxy' : 'derived', source: dev.source });
    if (dev.offLineage) items.push({ label: 'staged data for this design’s own lineage', kind: 'absent', source: `none committed; the table shown is about ${dev.tableTitle || 'another organism'} and stands in` });
    const absent = dev.stages.filter(s => s.hasAbsent).length;
    if (absent) items.push({ label: `${absent} stages resting partly on an unsourced assumption`, kind: 'assumed', source: 'each stage’s own basis fields; marked with a dashed ring on the curve' });
    if (dev.disagreements.length) items.push({ label: `${dev.disagreements.length} source disagreements in the stage table`, kind: 'observed', source: 'computed here: two entries for one field with non-overlapping ranges; shown, not averaged' });
    for (const nf of dev.notFound) items.push({ label: `staged record: ${nf.what}`, kind: 'absent', source: nf.answer });
  } else {
    items.push({ label: 'developmental trajectory', kind: 'absent', source: 'no staged data for this design or its parent' });
  }
  if (ch.chains.length) {
    items.push({ label: `${ch.chains.length} gene-to-phenotype chains`, kind: 'proxy', source: 'every link carries its publication, organism, experiment type and evidence grade; all proxy-species work, none done in this design' });
    items.push({ label: `the weakest link of each chain`, kind: 'observed', source: 'the chain file’s own weakest-link sentence, rendered rather than summarised away' });
  }
  if (ch.withoutChain.length) items.push({ label: `${ch.withoutChain.length} genes drawn with no causal chain`, kind: 'absent', source: 'in the network on pathway membership and expression only; neither is causation' });
  if (data?.functional_resolution?.ran === false) items.push({ label: 'functional-resolution ledger', kind: 'absent', source: data.functional_resolution.reason || 'did not run' });
  if (noAnalogue) items.push({ label: 'an analogue to compare the network against', kind: 'absent', source: 'no real organism has this function' });
  items.push({ label: 'cluster ring layout and edge bowing', kind: 'decorative', source: 'drawn to keep the graph readable; positions are a seeded layout and carry no measurement' });
  items.push({ label: 'KEGG pathway rows', kind: 'absent', source: 'licence-restricted and local-only; never fetched, never shown, not even as a count derived from rows' });

  const nMeasured = items.filter(i => i.kind === 'observed').length;
  const nAbsent = items.filter(i => i.kind === 'absent').length;
  const provenance = {
    verdict: net.byClass.curated > 0 ? 'mixed' : 'proxy',
    summary: `${subject.genesShown.length} genes and ${net.edges.length} edges built from the repo's real pathway, expression, physiology and chain records for this design. `
      + `${net.byClass.curated || 0} edges are curated in this species; ${net.edges.length - (net.byClass.curated || 0)} are electronic, orthology-inferred or copied from another species. `
      + `${nAbsent} things on these panels are rendered gaps, not data.`,
    items,
  };

  return {
    duration,
    chapters,
    provenance,
    play(t) {
      playing = true;
      local = (typeof t === 'number' ? clamp(t, 0, duration) : local);
      if (reducedMotion) { render(local); playing = false; return; }   // no rAF when motion is off
      t0 = performance.now() - local * 1000;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() { playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    seek(t) { local = clamp(typeof t === 'number' ? t : 0, 0, duration); render(local); },
    setTheme(next) { if (next === 'light' || next === 'dark') root.dataset.nwtheme = next; },
    resize() {
      const nw = Math.max(300, Math.round(container.clientWidth || W));
      if (Math.abs(nw - W) < 24) return;
      W = nw;
      panels = buildPanels(W);
      hosts.forEach((h, i) => { if (panels[i]) h.innerHTML = panels[i].html; });
      for (const b of root.querySelectorAll('.nw-anat')) b.setAttribute('aria-pressed', String(b.dataset.label === selected));
      render(local);
    },
    dispose() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      root.removeEventListener('click', onClick);
      root.remove();
    },
    /* exposed for the test harness only; the stage does not use these */
    __debug: { subject, net, exp, met, dev, ch, panels: panels.map(p => p.id) },
  };
}

export default { mountScene };
