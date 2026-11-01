// cards.mjs - read-only access to the omics gene cards (omics/index/genes/<symbol>.json.gz).
//
// The multi-scale annotation sweep is another thread's component (sim-engine/validate/pipeline/). This file does
// NOT duplicate it: it reads the already-built cards for the few facts the ladder needs, and every fact it returns
// carries the card's own source and `kind`, so nothing is laundered into a stronger claim than the card makes.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const DIR = path.join(ROOT, 'omics', 'index', 'genes');
const _cache = new Map();

export function card(symbol) {
  if (!symbol) return null;
  const key = String(symbol).toLowerCase();
  if (_cache.has(key)) return _cache.get(key);
  const f = path.join(DIR, `${key}.json.gz`);
  const v = fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')) : null;
  _cache.set(key, v);
  return v;
}

export const hasCard = s => !!card(s);

/** entries of one feature of one layer, each already carrying {v, sources, kind, acc, url, anatomy, stages}. */
export function entries(symbol, layer, feature) {
  const c = card(symbol);
  return c?.layers?.[layer]?.features?.[feature]?.entries || [];
}

const SRC = (e, db) => `omics/index/genes/${db}.json.gz (${(e.sources || []).join(', ')}${e.acc?.length ? `; ${e.acc.slice(0, 3).join(', ')}` : ''})`;
const KIND = e => (e.kind || [])[0] || 'inferred-electronic';

// Many Ensembl Compara paralogues have no gene symbol in the card (symbol: null), so their Ensembl id is looked
// up in the gene universe to recover one. A paralogue whose symbol cannot be recovered is still REPORTED - it is
// a real paralogue we cannot follow up, which is a different thing from no paralogue at all.
let _byEns = null;
function ensemblToSymbol(id) {
  if (!_byEns) {
    const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'omics', 'genes.json'), 'utf8'));
    _byEns = new Map(g.genes.filter(x => x.ensembl_gene).map(x => [x.ensembl_gene, x.symbol]));
  }
  return _byEns.get(id) || null;
}

/** Documented paralogues of a gene, with the source that says so. A card's `value` is the object; `v` is its
 *  JSON string, so both shapes are handled rather than one being assumed. */
export function paralogues(symbol) {
  return entries(symbol, 'genomic', 'paralog').map(e => {
    let o = e.value;
    if (!o || typeof o !== 'object') { try { o = JSON.parse(e.v); } catch { o = null; } }
    const ens = o?.ensembl_gene || null;
    const sym = o?.symbol || (ens ? ensemblToSymbol(ens) : null) || (typeof e.v === 'string' && !/^\{/.test(e.v) ? e.v : null);
    return { symbol: sym, ensembl_gene: ens, identity_pct: o?.identity_pct ?? null, paralog_type: o?.type || null,
      symbol_unresolved: !sym, sources: e.sources, kind: KIND(e), source: SRC(e, symbol), acc: e.acc || null, url: e.url || null };
  });
}

/** Expression records, optionally filtered to an anatomy id or a label substring. */
export function expressedIn(symbol, { anatomyId = null, label = null } = {}) {
  return entries(symbol, 'transcriptomic', 'expressed_in')
    .filter(e => (!anatomyId || e.anatomy?.id === anatomyId) && (!label || new RegExp(label, 'i').test(String(e.v))))
    .map(e => ({ anatomy: e.v, anatomy_id: e.anatomy?.id || null, stages: e.stages || [], sources: e.sources, kind: KIND(e), evidence: e.evidence || [], source: SRC(e, symbol) }));
}

/** Pathway / GO / Reactome memberships, as a set of {term, id, feature, source, kind}. */
export function pathwayTerms(symbol) {
  const out = [];
  for (const feature of ['go_process', 'go_function', 'go_component', 'pathway_member', 'reaction']) {
    for (const e of entries(symbol, 'pathway', feature)) {
      out.push({ term: e.v, id: (e.acc || [])[0] || null, feature, sources: e.sources, kind: KIND(e), evidence: e.evidence || [], source: SRC(e, symbol) });
    }
  }
  return out;
}

/** Protein domains / families / superfamilies, as {term, id, feature}. */
export function domains(symbol) {
  const out = [];
  for (const feature of ['domain', 'family', 'homologous_superfamily', 'repeat', 'region']) {
    for (const e of entries(symbol, 'proteomic', feature)) out.push({ term: e.v, id: (e.acc || [])[0] || null, feature, sources: e.sources, kind: KIND(e), source: SRC(e, symbol) });
  }
  return out;
}

// ---------------------------------------------------------------- term specificity
// "Both proteins are in the membrane" is shared by 760 of 3,856 annotated genes and licenses nothing. A shared
// term is evidence that two genes act in the same SPECIFIC process only when few genes carry it. The threshold is
// measured, not hand-picked per case: a term may support ANALOGOUS_SET only if at most 1 % of the annotated gene
// universe carries it, and go_component is excluded outright because co-localisation is not shared function.
let _spec = null;
const spec = () => (_spec ??= JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'data', 'term-specificity.json'), 'utf8')));
export const SPECIFICITY_RULE = Object.freeze({
  max_fraction_of_universe: 0.01,
  excluded_features: ['go_component'],
  why: 'a term carried by more than 1 % of the 3,856 annotated genes is not evidence that two particular genes do the same job; go_component is co-localisation, not function',
  source: 'functional/data/term-specificity.json, built from omics/pathway/annotations.jsonl.gz',
});
export function termSpecificity(t) {
  const S = spec();
  const n = S.by_term[`${t.feature}|${t.id || t.term}`] ?? null;
  const frac = n == null ? null : +(n / S.genes_with_pathway_rows).toFixed(5);
  const excluded = SPECIFICITY_RULE.excluded_features.includes(t.feature);
  return { n_genes_with_term: n, fraction_of_universe: frac, universe: S.genes_with_pathway_rows, excluded_feature: excluded,
    specific: !excluded && n != null && frac <= SPECIFICITY_RULE.max_fraction_of_universe,
    why_not: excluded ? `${t.feature} is excluded: co-localisation is not shared function`
      : n == null ? 'the term is not in the specificity table, so its specificity is unknown and it is not used'
        : frac > SPECIFICITY_RULE.max_fraction_of_universe ? `carried by ${n} of ${S.genes_with_pathway_rows} annotated genes (${(100 * frac).toFixed(1)} %), above the ${100 * SPECIFICITY_RULE.max_fraction_of_universe} % rule` : null };
}

/** Shared pathway/GO terms between two genes. The crosswalk this uses is the one already built in omics/pathway/
 *  (GO / Reactome / WikiPathways), read through the cards. Only terms present on BOTH cards are returned, each
 *  annotated with its measured specificity so a caller cannot use a generic term by accident. */
export function sharedPathwayTerms(a, b) {
  const A = pathwayTerms(a), B = pathwayTerms(b);
  const keyOf = t => `${t.feature}|${t.id || t.term}`;
  const bMap = new Map(B.map(t => [keyOf(t), t]));
  const shared = [];
  for (const t of A) { const m = bMap.get(keyOf(t)); if (m) shared.push({ term: t.term, id: t.id, feature: t.feature, a_source: t.source, b_source: m.source, kind: [t.kind, m.kind].sort()[0], specificity: termSpecificity(t) }); }
  return shared;
}

export function sharedDomains(a, b) {
  const A = domains(a), B = domains(b);
  const bSet = new Map(B.map(t => [t.id || t.term, t]));
  return A.filter(t => bSet.has(t.id || t.term)).map(t => ({ term: t.term, id: t.id, feature: t.feature, a_source: t.source, b_source: bSet.get(t.id || t.term).source, kind: t.kind }));
}

/** Fin anatomy, for the "expressed in the right place" condition. ZFA ids from omics/SCHEMA.md and
 *  genotype/cache/fin_subtree_zfa_terms.json. */
export const PECTORAL_FIN = { id: 'ZFA:0001161', label: 'pectoral fin', uberon: 'UBERON:0000151' };
export const FIN_LABEL = 'fin';

/** Is this gene expressed anywhere in the fin, by any source? Returns the records or null. */
export function finExpression(symbol) {
  const exact = expressedIn(symbol, { anatomyId: PECTORAL_FIN.id });
  if (exact.length) return { where: 'pectoral fin (ZFA:0001161)', records: exact };
  const anyFin = expressedIn(symbol, { label: FIN_LABEL });
  if (anyFin.length) return { where: `fin structures other than the pectoral fin proper (${anyFin.map(r => r.anatomy).slice(0, 4).join(', ')})`, records: anyFin };
  return null;
}
