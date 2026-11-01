#!/usr/bin/env node
// omics integration: reads omics/<layer>/annotations.jsonl.gz for every layer present, computes per-feature
// concordance (how many independent sources agree) and conflicts, and writes
//   omics/index/genes/<symbol>.json.gz        full per-gene cards (all layers, grouped; capped per feature)
//   omics/index/parts.json.gz                 blueprint part (UBERON/CL) -> genes recorded there, with per-layer counts
//   omics/index/search.json.gz                feature/term -> genes (for omics_search)
//   omics/index/INDEX.json                    gene list, per-layer/source coverage, build info
//   dashboard/public/blueprint3d/omics/       compact browser bundle (smaller caps), split per gene
// Usage: node omics/build-index.mjs [--layers genomic,transcriptomic,...] [--out <dir>] [--bundle <dir>]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LAYERS = (arg('--layers', 'genomic,transcriptomic,proteomic,pathway,ptm')).split(',');
const OUT = path.resolve(arg('--out', path.join(ROOT, 'omics/index')));
const BUNDLE = path.resolve(arg('--bundle', path.join(ROOT, 'dashboard/public/blueprint3d/omics')));
const CAP_CARD = Number(arg('--cap', 25));      // entries per feature in the full card
const CAP_BUNDLE = Number(arg('--bundle-cap', 6)); // entries per feature in the browser card
const KIND_RANK = { measured: 0, curated: 1, 'inferred-electronic': 2, predicted: 3, 'borrowed-ortholog': 4 };
// features where one gene should have one value: different values from different sources = conflict
const SINGLE = new Set(['chromosome', 'biotype', 'protein_length']);
// opposite assertions on the same anatomy
const OPPOSITE = { expressed_in: 'not_expressed_in', not_expressed_in: 'expressed_in', protein_detected: 'protein_not_detected', protein_not_detected: 'protein_detected' };

const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'omics/genes.json'), 'utf8'));
const byZ = new Map(G.genes.map(g => [g.zfin_id, g]));
const bySym = new Map(G.genes.map(g => [g.symbol.toLowerCase(), g]));
for (const g of G.genes) for (const a of g.symbols_in_genotype || []) if (!bySym.has(a.toLowerCase())) bySym.set(a.toLowerCase(), g);
let blueprint = new Map();
try {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'dashboard/public/blueprint3d/data.json'), 'utf8'));
  for (const t of d.terms || []) { const id = (t.iri || '').replace(/.*\/obo\//, '').replace('_', ':'); if (/^(UBERON|CL):/.test(id)) blueprint.set(id, { label: t.label, level: t.level }); }
} catch (e) { console.error('blueprint terms not read:', e.message); }

// ---------- helpers
const curieOf = id => (id || '').replace(/^(UBERON|CL|ZFA)_/, '$1:');
function srcKey(r) { // independent source: what the data actually came from
  if (r.derived_from) return r.derived_from;
  const m = /\(from ([^)]+)\)/.exec(r.source?.db || ''); if (m) return m[1];
  return r.source?.db || '?';
}
function display(v) {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.map(display).join(', ');
  if (v.modification && (v.position != null)) return `${v.modification} ${v.residue || ''}${v.position}${v.zf_position != null && v.zf_position !== v.position ? ` (zf ${v.zf_residue || ''}${v.zf_position})` : ''}`;
  if (v.species && (v.symbol || v.id)) return `${v.species}: ${v.symbol || v.id}`;
  if (v.chr && v.start) return `${v.chr}:${v.start}-${v.end}${v.assembly ? ' (' + v.assembly + ')' : ''}`;
  return v.label || v.name || v.symbol || v.id || JSON.stringify(v).slice(0, 160);
}
function normKey(r) {
  if (r.match_key) return String(r.match_key).toLowerCase();
  if (r.go_id) return r.go_id;
  const v = r.value;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.modification && v.position != null) return `${v.source_protein || 'self'}:${v.residue || ''}${v.position}`; // feature already separates modification classes
    if (v.species && (v.symbol || v.id)) return `${v.species}:${String(v.symbol || v.id).toUpperCase()}`;
    if (v.id) return String(v.id);
    if (v.chr) return 'chr' + v.chr;
    return JSON.stringify(v).toLowerCase();
  }
  return String(v).trim().toLowerCase();
}
const ANAT_FEATURE = f => /expressed|expression|detected|abundance|phenotype|marker|location/.test(f);
const zfaToUberon = new Map();

// ---------- pass 1: stream rows into groups
const genes = new Map(); // zfin -> {layers:{layer:{rows, sources:{}, features: Map(feature -> Map(key -> group))}}}
const layerStats = {};
const partGenes = new Map(); // uberon/cl -> Map(zfin -> {layers:Set, feats:{}})
function partAdd(term, z, layer, feature) {
  if (!term) return; const m = partGenes.get(term) || new Map(); partGenes.set(term, m);
  const e = m.get(z) || { layers: new Set(), feats: {} }; e.layers.add(layer); e.feats[feature] = (e.feats[feature] || 0) + 1; m.set(z, e);
}
const pendingZfa = []; // (zfaId, z, layer, feature) to resolve after all crosswalk pairs are seen
for (const layer of LAYERS) {
  const f = path.join(ROOT, 'omics', layer, 'annotations.jsonl.gz');
  if (!fs.existsSync(f)) { console.log(`- ${layer}: no annotations yet`); continue; }
  let man = null; try { man = JSON.parse(fs.readFileSync(path.join(ROOT, 'omics', layer, 'MANIFEST.json'), 'utf8')); } catch {}
  const st = layerStats[layer] = { rows: 0, skipped_not_in_universe: 0, skipped_aves: 0, genes: new Set(), sources: {}, status: man?.status || 'unknown', built: man?.built || null, sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') };
  const rl = readline.createInterface({ input: fs.createReadStream(f).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    const z = r.gene?.zfin_id || bySym.get((r.gene?.symbol || '').toLowerCase())?.zfin_id;
    if (!z || !byZ.has(z)) { st.skipped_not_in_universe++; continue; }
    if (/\b(aves|gallus|taeniopygia|meleagris|columba|coturnix)\b/i.test(r.species || '')) { st.skipped_aves++; continue; }
    st.rows++; st.genes.add(z);
    const sk = srcKey(r); st.sources[r.source.db] = (st.sources[r.source.db] || 0) + 1;
    const g = genes.get(z) || { layers: {} }; genes.set(z, g);
    const L = g.layers[layer] || (g.layers[layer] = { rows: 0, sources: {}, features: new Map() });
    L.rows++; L.sources[r.source.db] = (L.sources[r.source.db] || 0) + 1;
    const a = r.context?.anatomy;
    let anatKey = '';
    if (a?.id) {
      const u = a.uberon || (/^(UBERON|CL):/.test(a.id) ? a.id : null);
      if (a.uberon && /^ZFA:/.test(a.id)) zfaToUberon.set(a.id, a.uberon);
      anatKey = u || a.id;
      if (u) partAdd(curieOf(u), z, layer, r.feature); else if (/^ZFA:/.test(a.id)) pendingZfa.push([a.id, z, layer, r.feature]);
    }
    const ct = r.context?.cell_type; if (ct?.id && /^CL:/.test(ct.id)) partAdd(ct.id, z, layer, r.feature);
    const key = normKey(r) + (anatKey && !ANAT_FEATURE(r.feature) ? '' : (anatKey ? '@' + anatKey : ''));
    const fm = L.features.get(r.feature) || new Map(); L.features.set(r.feature, fm);
    let grp = fm.get(key);
    if (!grp) { grp = { key, v: display(r.value), raw: typeof r.value === 'object' ? r.value : undefined, unit: r.unit || undefined, anatomy: a?.id ? { id: a.id, label: a.label, uberon: a.uberon } : undefined, stages: new Set(), cells: new Set(), srcs: new Set(), dbs: new Set(), kinds: new Set(), ev: new Set(), species: new Set(), acc: [], urls: [], n: 0, vals: [] }; fm.set(key, grp); }
    grp.n++; grp.srcs.add(sk); grp.dbs.add(r.source.db); grp.kinds.add(r.kind); grp.species.add(r.species);
    if (r.evidence) grp.ev.add(String(r.evidence).slice(0, 80));
    if (r.context?.stage?.label) grp.stages.add(r.context.stage.label);
    if (ct?.label) grp.cells.add(ct.label);
    if (r.source.accession && grp.acc.length < 3 && !grp.acc.includes(r.source.accession)) grp.acc.push(r.source.accession);
    if (r.source.url && grp.urls.length < 2 && !grp.urls.includes(r.source.url)) grp.urls.push(r.source.url);
    if (typeof r.value === 'number' && grp.vals.length < 50) grp.vals.push({ v: r.value, s: sk });
  }
  st.genes = st.genes.size;
  console.log(`- ${layer}: ${st.rows} rows, ${st.genes} genes (${st.status})`);
}
for (const [zfa, z, layer, feature] of pendingZfa) { const u = zfaToUberon.get(zfa); if (u) partAdd(curieOf(u), z, layer, feature); }

// ---------- pass 2: cards
const kr = s => Math.min(...[...s].map(k => KIND_RANK[k] ?? 5));
const uOf = q => q.anatomy ? (q.anatomy.uberon || zfaToUberon.get(q.anatomy.id) || (/^(UBERON|CL):/.test(q.anatomy.id) ? q.anatomy.id : null)) : null;
const inBp = q => (uOf(q) && blueprint.has(uOf(q))) ? 0 : 1;
function entryOf(g, full) {
  const e = { v: g.v, n_sources: g.srcs.size, sources: [...g.dbs], kind: [...g.kinds], n: g.n };
  if (g.unit) e.unit = g.unit;
  if (g.anatomy) { e.anatomy = { ...g.anatomy }; if (!e.anatomy.uberon && uOf(g)) e.anatomy.uberon = uOf(g); if (e.anatomy.uberon && blueprint.has(e.anatomy.uberon)) e.anatomy.bp = 1; }
  if (g.stages.size) e.stages = [...g.stages].slice(0, full ? 8 : 3);
  if (g.cells.size) e.cells = [...g.cells].slice(0, full ? 5 : 2);
  if (full) { if (g.ev.size) e.evidence = [...g.ev].slice(0, 4); if (g.acc.length) e.acc = g.acc; if (g.urls.length) e.url = g.urls[0]; if (g.raw && JSON.stringify(g.raw).length < 400) e.value = g.raw; if (g.species.size > 1 || !g.species.has('Danio rerio')) e.species = [...g.species]; }
  else { if (g.urls.length) e.url = g.urls[0]; if (!g.species.has('Danio rerio')) e.species = [...g.species]; }
  if (g.vals.length > 1) { const xs = g.vals.map(x => x.v); e.range = [Math.min(...xs), Math.max(...xs)]; }
  return e;
}
function card(z, full) {
  const x = byZ.get(z); const g = genes.get(z) || { layers: {} };
  const c = {
    symbol: x.symbol, zfin_id: z, ...(x.symbols_in_genotype ? { symbols_in_genotype: x.symbols_in_genotype } : {}),
    xrefs: { ensembl_gene: x.ensembl_gene, ncbi_gene: x.ncbi_gene, uniprot: x.uniprot, uniprot_status: x.uniprot_status, human_ortholog: x.human_ortholog ? { symbol: x.human_ortholog.symbol, hgnc_id: x.human_ortholog.hgnc_id, ncbi: x.human_ortholog.ncbi, uniprot: x.human_ortholog.uniprot } : null, flying_fish: x.flying_fish ? { protein: x.flying_fish.protein, pident: x.flying_fish.pident_vs_zebrafish } : null },
    summary: {}, layers: {}, conflicts: [],
  };
  for (const layer of LAYERS) {
    const L = g.layers[layer];
    if (!L) { c.summary[layer] = { rows: 0 }; continue; }
    const out = { rows: L.rows, sources: L.sources, features: {} };
    let multi = 0, groups = 0;
    for (const [feat, fm] of L.features) {
      const gs = [...fm.values()];
      groups += gs.length; multi += gs.filter(q => q.srcs.size > 1).length;
      gs.sort((a, b) => b.srcs.size - a.srcs.size || inBp(a) - inBp(b) || kr(a.kinds) - kr(b.kinds) || b.n - a.n || a.v.localeCompare(b.v));
      const cap = full ? CAP_CARD : CAP_BUNDLE;
      out.features[feat] = { n_rows: gs.reduce((s, q) => s + q.n, 0), n_distinct: gs.length, n_multi_source: gs.filter(q => q.srcs.size > 1).length, entries: gs.slice(0, cap).map(q => entryOf(q, full)) };
      if (gs.length > cap) out.features[feat].truncated = gs.length - cap;
      // conflicts: single-valued features
      if (SINGLE.has(feat) && gs.length > 1) {
        const bySrc = new Map(); for (const q of gs) for (const s of q.srcs) { const a = bySrc.get(s) || new Set(); a.add(q.v); bySrc.set(s, a); }
        if (bySrc.size > 1) c.conflicts.push({ layer, feature: feat, type: 'different values', values: gs.slice(0, 6).map(q => ({ v: q.v, sources: [...q.dbs] })) });
      }
      // conflicts: opposite assertions on the same anatomy
      const opp = OPPOSITE[feat];
      if (opp && L.features.has(opp) && feat < opp) {
        const om = L.features.get(opp);
        const anat = q => q.anatomy?.uberon || q.anatomy?.id;
        const idx = new Map(); for (const q of om.values()) if (anat(q)) idx.set(anat(q), q);
        let n = 0; const ex = [];
        for (const q of fm.values()) { const o = anat(q) && idx.get(anat(q)); if (o) { n++; if (ex.length < 5) ex.push({ anatomy: q.anatomy?.label || anat(q), [feat]: [...q.dbs], [opp]: [...o.dbs], stages_pos: [...q.stages].slice(0, 2), stages_neg: [...o.stages].slice(0, 2) }); } }
        if (n) c.conflicts.push({ layer, feature: `${feat} vs ${opp}`, type: 'opposite assertions on the same anatomy (often different stages or methods)', n, examples: ex });
      }
    }
    // curated human orthologue disagreement (genomic): one source calls a human orthologue the other does not
    if (layer === 'genomic' && L.features.has('ortholog')) {
      const hs = [...L.features.get('ortholog').values()].filter(q => /^homo sapiens:/.test(q.key));
      const one = hs.filter(q => q.srcs.size === 1);
      if (hs.length && one.length) c.conflicts.push({ layer, feature: 'ortholog (human)', type: 'called by one source only', examples: one.slice(0, 5).map(q => ({ v: q.v, sources: [...q.dbs] })) });
    }
    out.concordance = { groups, multi_source_groups: multi, fraction_multi_source: groups ? +(multi / groups).toFixed(3) : 0 };
    c.layers[layer] = out;
    c.summary[layer] = { rows: L.rows, sources: Object.keys(L.sources).length, features: L.features.size, multi_source_groups: multi };
  }
  return c;
}

// ---------- write
const gz = o => zlib.gzipSync(JSON.stringify(o), { level: 9 });
const safe = s => s.replace(/[^A-Za-z0-9._-]/g, '_');
for (const d of [OUT, path.join(OUT, 'genes'), BUNDLE, path.join(BUNDLE, 'genes')]) fs.mkdirSync(d, { recursive: true });
const fileOf = new Map(); // zfin -> file stem (symbol, disambiguated)
const used = new Set();
for (const g of G.genes) { let s = safe(g.symbol); if (used.has(s.toLowerCase())) s = s + '__' + g.zfin_id; used.add(s.toLowerCase()); fileOf.set(g.zfin_id, s); }
let bytesFull = 0, bytesBundle = 0;
const geneList = [];
for (const g of G.genes) {
  const full = card(g.zfin_id, true), lite = card(g.zfin_id, false);
  full.built = new Date().toISOString();
  const bf = gz(full), bl = gz(lite);
  fs.writeFileSync(path.join(OUT, 'genes', fileOf.get(g.zfin_id) + '.json.gz'), bf);
  fs.writeFileSync(path.join(BUNDLE, 'genes', fileOf.get(g.zfin_id) + '.json.gz'), bl);
  bytesFull += bf.length; bytesBundle += bl.length;
  geneList.push({ s: g.symbol, z: g.zfin_id, f: fileOf.get(g.zfin_id), h: g.human_ortholog?.symbol || null, n: Object.fromEntries(LAYERS.map(l => [l, full.summary[l]?.rows || 0])), c: full.conflicts.length, ...(g.symbols_in_genotype ? { a: g.symbols_in_genotype.filter(x => x !== g.symbol) } : {}) });
}
// parts
const parts = {};
for (const [term, m] of partGenes) {
  const inBp = blueprint.has(term);
  const list = [...m].map(([z, e]) => ({ z, s: byZ.get(z).symbol, l: [...e.layers].sort(), f: e.feats })).sort((a, b) => b.l.length - a.l.length || a.s.localeCompare(b.s));
  parts[term] = { label: blueprint.get(term)?.label || null, level: blueprint.get(term)?.level || null, in_blueprint: inBp, n_genes: list.length, genes: list };
}
const bundleParts = {};
for (const [t, p] of Object.entries(parts)) if (p.in_blueprint) bundleParts[t] = { label: p.label, level: p.level, n_genes: p.n_genes, genes: p.genes.slice(0, 400).map(x => [x.s, x.l.map(l => l[0] + (l === 'pathway' ? 'w' : l === 'ptm' ? 'm' : '')).join('')]), truncated: Math.max(0, p.n_genes - 400) };
// search: term/value -> genes
const search = new Map();
for (const [z, g] of genes) for (const [layer, L] of Object.entries(g.layers)) for (const [feat, fm] of L.features) for (const q of fm.values()) {
  const terms = new Set([q.v.toLowerCase().slice(0, 120)]);
  if (q.anatomy?.label) terms.add(q.anatomy.label.toLowerCase());
  if (q.raw?.id) terms.add(String(q.raw.id).toLowerCase());
  if (/^(go|r-|hsa|dre|wp|uberon|zfa|cl|doid|pf|ipr)/i.test(q.key)) terms.add(q.key.split('@')[0].toLowerCase());
  for (const t of terms) { if (t.length < 2) continue; const m = search.get(t) || { layers: new Set(), feats: new Set(), genes: new Set() }; m.layers.add(layer); m.feats.add(feat); m.genes.add(byZ.get(z).symbol); search.set(t, m); }
}
const searchOut = {}; for (const [t, m] of search) searchOut[t] = [[...m.layers], [...m.feats].slice(0, 6), [...m.genes].slice(0, 300), m.genes.size];
fs.writeFileSync(path.join(OUT, 'parts.json.gz'), gz(parts));
fs.writeFileSync(path.join(OUT, 'search.json.gz'), gz(searchOut));
const layerOut = Object.fromEntries(Object.entries(layerStats).map(([k, v]) => [k, v]));
const index = {
  title: 'DELPHI multi-omics index (per-gene cards, per-part gene lists, search)', built: new Date().toISOString(), tool: 'omics/build-index.mjs',
  constraint: 'Every row is a proxy-species (mostly zebrafish) or borrowed human-orthologue annotation; none is a flying-fish measurement unless species says Hirundichthys. No Aves data (frozen holdout). Absence of a row = not recorded.',
  concordance_rule: 'Rows are grouped per (gene, layer, feature, normalised value[, anatomy]). n_sources = number of independent sources in the group (source.db, or the upstream database when a row says derived_from / "(from X)"). Conflicts: different values for single-valued features (chromosome, biotype, protein_length); opposite assertions on the same anatomy (expressed_in vs not_expressed_in); human orthologue called by one source only.',
  caps: { card_entries_per_feature: CAP_CARD, bundle_entries_per_feature: CAP_BUNDLE, bundle_genes_per_part: 400 },
  layers: layerOut, n_genes: G.genes.length, n_parts: Object.keys(parts).length, n_parts_in_blueprint: Object.keys(bundleParts).length,
  bytes: { cards_gz: bytesFull, bundle_cards_gz: bytesBundle },
  files: { cards: 'omics/index/genes/<file>.json.gz', parts: 'omics/index/parts.json.gz', search: 'omics/index/search.json.gz' },
  genes: geneList,
};
fs.writeFileSync(path.join(OUT, 'INDEX.json'), JSON.stringify(index));
const bIndex = { built: index.built, constraint: index.constraint, concordance_rule: index.concordance_rule, layers: Object.fromEntries(Object.entries(layerStats).map(([k, v]) => [k, { rows: v.rows, genes: v.genes, status: v.status, sources: v.sources }])), caps: index.caps, genes: geneList.map(g => [g.s, g.z, g.f, g.h, LAYERS.map(l => g.n[l]), g.c, ...(g.a ? [g.a] : [])]), gene_tuple: ['symbol (current ZFIN)', 'zfin_id', 'file', 'human ortholog', 'rows per layer', 'n conflicts', 'older symbols used in genotype/ files (optional)'], layer_order: LAYERS };
fs.writeFileSync(path.join(BUNDLE, 'index.json'), JSON.stringify(bIndex));
fs.writeFileSync(path.join(BUNDLE, 'parts.json'), JSON.stringify(bundleParts));
const du = d => fs.readdirSync(d, { recursive: true }).map(f => path.join(d, f)).filter(f => fs.statSync(f).isFile()).reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`cards: ${(bytesFull / 1e6).toFixed(1)} MB gz; index dir ${(du(OUT) / 1e6).toFixed(1)} MB; bundle ${(du(BUNDLE) / 1e6).toFixed(1)} MB; parts ${Object.keys(parts).length} (${Object.keys(bundleParts).length} in blueprint)`);
