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

/** Documented paralogues of a gene, with the source that says so. */
export function paralogues(symbol) {
  return entries(symbol, 'genomic', 'paralog').map(e => ({ symbol: e.v, sources: e.sources, kind: KIND(e), source: SRC(e, symbol), acc: e.acc || null }));
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

/** Shared pathway/GO terms between two genes. The crosswalk this uses is the one already built in omics/pathway/
 *  (GO / Reactome / WikiPathways), read through the cards. Only terms present on BOTH cards are returned. */
export function sharedPathwayTerms(a, b) {
  const A = pathwayTerms(a), B = pathwayTerms(b);
  const keyOf = t => `${t.feature}|${t.id || t.term}`;
  const bMap = new Map(B.map(t => [keyOf(t), t]));
  const shared = [];
  for (const t of A) { const m = bMap.get(keyOf(t)); if (m) shared.push({ term: t.term, id: t.id, feature: t.feature, a_source: t.source, b_source: m.source, kind: [t.kind, m.kind].sort()[0] }); }
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
