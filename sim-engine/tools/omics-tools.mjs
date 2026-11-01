// Multi-omics tools: per-gene cards, per-part gene lists and term search over the omics index
// (omics/build-index.mjs output). Same {name, title, description, inputSchema, handler} shape as TOOLS in
// server.mjs; registration patch in tools/OMICS-REGISTER.md. sim-engine/http.mjs discovers OMICS_TOOLS
// on its own (POST /tool/omics_*).
//
// Data: omics/index/ (full cards, 25 entries per feature) when present, else the browser bundle
// dashboard/public/blueprint3d/omics/ (6 entries per feature). Both are gzip JSON, read lazily and cached.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { envelope, p } from '../lib/envelope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FULL = process.env.DELPHI_OMICS_INDEX || path.join(ROOT, 'omics/index');
const BUNDLE = path.join(ROOT, 'dashboard/public/blueprint3d/omics');
const LAYERS = ['genomic', 'transcriptomic', 'proteomic', 'pathway', 'ptm'];

const readJ = f => { const b = fs.readFileSync(f); return JSON.parse((b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b).toString('utf8')); };
let IX = null;
function ix() {
  if (IX) return IX;
  if (fs.existsSync(path.join(FULL, 'INDEX.json'))) {
    const j = readJ(path.join(FULL, 'INDEX.json'));
    IX = { mode: 'full', dir: FULL, built: j.built, constraint: j.constraint, rule: j.concordance_rule, layers: j.layers,
      genes: j.genes.map(g => ({ s: g.s, z: g.z, f: g.f, h: g.h, n: g.n, c: g.c, a: g.a })),
      parts: () => readJ(path.join(FULL, 'parts.json.gz')), search: () => readJ(path.join(FULL, 'search.json.gz')),
      card: f => readJ(path.join(FULL, 'genes', f + '.json.gz')) };
  } else if (fs.existsSync(path.join(BUNDLE, 'index.json'))) {
    const j = readJ(path.join(BUNDLE, 'index.json'));
    IX = { mode: 'bundle', dir: BUNDLE, built: j.built, constraint: j.constraint, rule: j.concordance_rule, layers: j.layers,
      genes: j.genes.map(([s, z, f, h, n, c, a]) => ({ s, z, f, h, n: Object.fromEntries(LAYERS.map((l, i) => [l, n[i]])), c, a })),
      parts: () => { const P = readJ(path.join(BUNDLE, 'parts.json')); return Object.fromEntries(Object.entries(P).map(([k, v]) => [k, { ...v, genes: v.genes.map(([s, l]) => ({ s, l: [...l.matchAll(/gw?|t|pw|pr|m|p/g)].map(m => m[0]) })) }])); },
      search: null, card: f => readJ(path.join(BUNDLE, 'genes', f + '.json.gz')) };
  } else throw new Error('omics index not built: run node omics/build-index.mjs');
  IX.bySym = new Map(IX.genes.map(g => [g.s.toLowerCase(), g]));
  for (const g of IX.genes) for (const a of g.a || []) if (!IX.bySym.has(a.toLowerCase())) IX.bySym.set(a.toLowerCase(), g);
  IX.byZ = new Map(IX.genes.map(g => [g.z, g]));
  return IX;
}
const cache = new Map();
const lazy = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

function prov() {
  const I = ix();
  return [p('omics index', path.relative(ROOT, I.dir).replace(/\\/g, '/'), 'borrowed',
    `Built ${I.built} by omics/build-index.mjs from omics/<layer>/annotations.jsonl.gz (${Object.entries(I.layers).map(([l, v]) => `${l} ${v.rows} rows, ${v.status}`).join('; ')}). Annotations are zebrafish (proxy) or human-orthologue (borrowed) records; each entry names its sources and kind.`,
    { mode: I.mode })];
}
const SCOPE = 'Proxy-species annotations (mostly zebrafish, some medaka; human-orthologue rows are labelled borrowed-ortholog). None is a flying-fish measurement unless species says Hirundichthys speculiger. No bird (Aves) data: frozen holdout. A missing row means not recorded in these sources, not absent from the organism. Concordance counts independent databases that state the same thing; it is agreement between curations, not experimental replication. Entries are capped per feature (see truncated).';

function findGene(q) {
  const I = ix(); if (!q) return null; const s = String(q).trim();
  return I.byZ.get(s.replace(/^ZFIN:/, '').replace(/^ZF:/, '')) || I.bySym.get(s.toLowerCase())
    || I.genes.find(g => g.h && g.h.toLowerCase() === s.toLowerCase()) // human orthologue symbol
    || null;
}

// ── omics_gene ─────────────────────────────────────────────────────────────
export const geneSchema = {
  title: 'Multi-omic card for one gene',
  description: 'All omics layers for one gene of the DELPHI gene universe (3,860 zebrafish genes behind the flying-fish blueprint): genomic (Ensembl, NCBI Gene, ZFIN alleles and mutant phenotypes with ZFA anatomy, Alliance orthology and disease), transcriptomic, proteomic, pathway and PTM, grouped by feature with per-entry concordance (n_sources) and listed conflicts. Accepts a ZFIN symbol, a ZFIN gene id, or a human orthologue symbol.',
  inputSchema: { type: 'object', properties: {
    symbol: { type: 'string', description: 'ZFIN symbol (e.g. kcnk5b), ZDB-GENE id, or human orthologue symbol (e.g. KCNK5).' },
    id: { type: 'string', description: 'Alias of symbol.' },
    layers: { type: 'array', items: { type: 'string', enum: LAYERS }, description: 'Only these layers (default all).' },
    features: { type: 'array', items: { type: 'string' }, description: 'Only these features (e.g. allele_phenotype, expressed_in).' },
  } },
};
export async function omicsGene(args = {}) {
  const g = findGene(args.symbol || args.id);
  if (!g) return envelope({ found: false, query: args.symbol || args.id, hint: 'Not in the omics gene universe (omics/genes.json). Use omics_search to find genes by term.' }, prov(), SCOPE);
  const c = lazy('card:' + g.f, () => ix().card(g.f));
  const out = { ...c, layers: {} };
  for (const [l, L] of Object.entries(c.layers || {})) {
    if (args.layers && !args.layers.includes(l)) continue;
    out.layers[l] = args.features ? { ...L, features: Object.fromEntries(Object.entries(L.features).filter(([f]) => args.features.includes(f))) } : L;
  }
  return envelope({ found: true, ...out }, prov(), SCOPE);
}

// ── omics_part ─────────────────────────────────────────────────────────────
export const partSchema = {
  title: 'Genes recorded at a blueprint part, with multi-omic summaries',
  description: 'Genes with an omics row whose anatomy (or cell type) is this part: an UBERON or CL id from the flying-fish blueprint (UBERON:0000151 = pectoral fin), or a ZFA id mapped through the ontology crosswalk. Direct records only, no propagation from sub-parts. Each gene comes with the layers that place it there, row counts per feature, and its per-layer row totals.',
  inputSchema: { type: 'object', properties: {
    part_id: { type: 'string', description: 'UBERON:xxxxxxx, CL:xxxxxxx (UBERON_xxxxxxx also accepted).' },
    layer: { type: 'string', enum: LAYERS, description: 'Only genes placed at the part by this layer.' },
    limit: { type: 'number', description: 'Max genes returned (default 100).' },
  }, required: ['part_id'] },
};
export async function omicsPart(args = {}) {
  const I = ix(); const P = lazy('parts', () => I.parts());
  const id = String(args.part_id || '').replace(/^(UBERON|CL|ZFA)_/, '$1:');
  const part = P[id];
  if (!part) return envelope({ found: false, part_id: id, note: 'No omics row is anchored at this part (unstudied in these sources, not gene-free).', parts_available: Object.keys(P).length }, prov(), SCOPE);
  let genes = part.genes; if (args.layer) genes = genes.filter(x => (x.l || []).some(l => l === args.layer || args.layer.startsWith(l)));
  const lim = Math.max(1, Math.min(Number(args.limit) || 100, 2000));
  const rows = genes.slice(0, lim).map(x => { const g = I.bySym.get(x.s.toLowerCase()); return { symbol: x.s, zfin_id: g?.z, human_ortholog: g?.h, layers_here: x.l, features_here: x.f, rows_per_layer: g?.n, conflicts: g?.c }; });
  return envelope({ found: true, part_id: id, label: part.label, level: part.level, n_genes: part.n_genes, returned: rows.length, by_layer: genes.reduce((a, x) => { for (const l of x.l || []) a[l] = (a[l] || 0) + 1; return a; }, {}), genes: rows }, prov(), SCOPE);
}

// ── omics_search ───────────────────────────────────────────────────────────
export const searchSchema = {
  title: 'Search omics annotations by feature value or term',
  description: 'Find genes whose omics rows mention a term: an anatomy label, a GO/Reactome/KEGG/WikiPathways/InterPro/Pfam/DOID id or label, a phenotype phrase, a modification. Substring match on normalised values; returns matching terms with their layers, features and genes.',
  inputSchema: { type: 'object', properties: {
    term: { type: 'string', description: 'e.g. "pectoral fin", "GO:0030326", "Wnt signaling", "phosphoserine", "DOID:0050590".' },
    feature: { type: 'string', description: 'Restrict to one feature (e.g. allele_phenotype, pathway_member).' },
    layer: { type: 'string', enum: LAYERS },
    limit: { type: 'number', description: 'Max matching terms (default 25).' },
  }, required: ['term'] },
};
export async function omicsSearch(args = {}) {
  const I = ix(); const t = String(args.term || '').trim().toLowerCase();
  if (t.length < 2) return envelope({ error: 'term too short' }, prov(), SCOPE);
  if (!I.search) return envelope({ error: 'search index not deployed (bundle mode); omics_gene and omics_part still work' }, prov(), SCOPE);
  const S = lazy('search', () => I.search());
  const lim = Math.max(1, Math.min(Number(args.limit) || 25, 200));
  const hits = [];
  for (const [k, [layers, feats, genes, n]] of Object.entries(S)) {
    if (!k.includes(t)) continue;
    if (args.layer && !layers.includes(args.layer)) continue;
    if (args.feature && !feats.includes(args.feature)) continue;
    hits.push({ term: k, layers, features: feats, n_genes: n, genes: genes.slice(0, 50) });
  }
  hits.sort((a, b) => (a.term === t ? -1 : 0) - (b.term === t ? -1 : 0) || b.n_genes - a.n_genes);
  const allGenes = new Set(hits.flatMap(h => h.genes));
  return envelope({ term: t, n_terms: hits.length, n_genes_union_sampled: allGenes.size, terms: hits.slice(0, lim) }, prov(), SCOPE);
}

export const OMICS_TOOLS = [
  { name: 'omics_gene', ...geneSchema, handler: omicsGene },
  { name: 'omics_part', ...partSchema, handler: omicsPart },
  { name: 'omics_search', ...searchSchema, handler: omicsSearch },
];
export const OMICS_TOOL_NAMES = OMICS_TOOLS.map(t => t.name);
