#!/usr/bin/env node
// Grounding: text and named entities -> ontology identifiers.
//
//   node pipeline/leanbio/ground.mjs "kcnk5b knockdown enlarges the zebrafish pectoral fin"   # text -> groundings (JSON)
//   node pipeline/leanbio/ground.mjs --entity kcnk5b --kind gene --context zebrafish            # one entity
//   add --offline to answer from the committed cache only (no network)
//
// Services, in cascade order (every response is cached in pipeline/leanbio/cache/, so a rerun and CI are offline):
//   1. Gilda (INDRA's grounder), public REST API https://grounding.indra.bio : /annotate (NER + grounding over free
//      text) and /ground (one string). Namespaces it returns: HGNC, UP, FPLX, CHEBI, GO, MESH, EFO, HP, DOID, ...
//   2. MyGene.info (species 7955) for zebrafish gene symbols, which Gilda's public index does not carry -> ZFIN ids.
//   3. The repo's own taxon inventory (organisms/merged/taxa.json, NCBI taxids already resolved by role A3/A5).
//   4. EBI OLS4 to VERIFY identifiers a draft declares itself (UBERON, CL, GO, ZFA, NCBITaxon): a declared id that
//      does not resolve is reported, never silently trusted.
// Acceptance rule (documented in README.md, "Grounding"):
//   score >= 0.70                    -> accepted
//   0.50 <= score < 0.70             -> accepted only if the matched entry shares a word stem with the mention,
//                                       else rejected as 'low-confidence' (Gilda's synonym hits such as "mass" -> FBN1)
//   a second DIFFERENT entry within 0.05 of the best score -> 'ambiguous' (kept, flagged, never auto-resolved)
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, ROOT, readJson, writeJson, exists, heldOutGuard } from './lib.mjs';

export const GILDA = process.env.GILDA_URL || 'https://grounding.indra.bio';
export const ACCEPT = 0.70, LOW = 0.50, AMBIG_DELTA = 0.05;

// ── cache ─────────────────────────────────────────────────────────────────────────────────────────
// Held-out redaction: a service can return a candidate that names a held-out organism (e.g. a homonymous genus) for an
// innocent query. Such candidates are dropped before they reach the cache or any output; the count is kept.
export const redactions = { n: 0 };
function redact(v) {
  const g = heldOutGuard();
  if (v == null || !g.hits(JSON.stringify(v))) return v;
  if (Array.isArray(v)) return v.map(x => (x && Array.isArray(x.matches) ? { ...x, matches: redact(x.matches) } : x)).filter(x => !g.hits(JSON.stringify(x)) || (redactions.n++, false));
  redactions.n++;
  return null;
}
const caches = {};
function cache(name) {
  if (!caches[name]) {
    const p = path.join(CACHE, `${name}.json`);
    const data = exists(p) ? readJson(p) : {};
    let dirty = false;
    for (const [k, v] of Object.entries(data)) {
      if (heldOutGuard().hits(k)) { delete data[k]; dirty = true; continue; }
      const r = redact(v); if (JSON.stringify(r) !== JSON.stringify(v)) { data[k] = r; dirty = true; }
    }
    caches[name] = { p, data, dirty };
  }
  return caches[name];
}
export function flushCaches() {
  for (const c of Object.values(caches)) if (c.dirty) {
    const sorted = Object.fromEntries(Object.keys(c.data).sort().map(k => [k, c.data[k]]));
    writeJson(c.p, sorted); c.dirty = false;
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function cached(name, key, fn, { offline }) {
  const c = cache(name);
  if (key in c.data) return { value: c.data[key], from: 'cache' };
  if (offline) return { value: undefined, from: 'offline-miss' };
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try { const v = redact(await fn()); c.data[key] = v; c.dirty = true; return { value: v, from: 'network' }; }
    catch (e) { lastErr = e; await sleep(800 * (i + 1)); }
  }
  return { value: undefined, from: 'error', error: String(lastErr && lastErr.message || lastErr) };
}
async function getJson(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', 'user-agent': 'delphisci-leanbio/0.1 (+https://github.com/fractastical/delphisci)', ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ── normalisation ─────────────────────────────────────────────────────────────────────────────────
export const curie = (db, id) => (String(id).includes(':') ? String(id) : `${db}:${id}`);
const stem = w => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/ies$/, 'y').replace(/s$/, '').replace(/e$/, '');
const stems = s => new Set(String(s).split(/[\s,\-/()]+/).map(stem).filter(w => w.length >= 3));
export const overlaps = (a, b) => { const A = stems(a); for (const w of stems(b)) if (A.has(w)) return true; return false; };
const compactMatch = m => ({ db: m.term.db, id: curie(m.term.db, m.term.id), name: m.term.entry_name, score: Math.round(m.score * 1000) / 1000, status: m.term.status });

/** Apply the acceptance rule to a ranked candidate list for one mention. */
export function decide(mention, cands) {
  const ranked = [...cands].sort((a, b) => b.score - a.score);
  const ok = ranked.filter(c => c.score >= ACCEPT || (c.score >= LOW && overlaps(mention, c.name)));
  if (!ok.length) return { status: ranked.length ? 'low-confidence' : 'ungroundable', best: null, rejected: ranked.slice(0, 2) };
  const best = ok[0];
  const rivals = ok.filter(c => c.id !== best.id && c.name.toLowerCase() !== best.name.toLowerCase() && best.score - c.score <= AMBIG_DELTA);
  return { status: rivals.length ? 'ambiguous' : 'grounded', best, alternatives: rivals.slice(0, 3) };
}

// ── services ──────────────────────────────────────────────────────────────────────────────────────
export async function gildaAnnotate(text, opts = {}) {
  const r = await cached('gilda-annotate', text, async () => {
    const a = await getJson(`${GILDA}/annotate`, { method: 'POST', body: JSON.stringify({ text }) });
    return a.map(x => ({ text: x.text, start: x.start, end: x.end, matches: x.matches.slice(0, 4).map(compactMatch) }));
  }, opts);
  return r;
}
export async function gildaGround(text, opts = {}) {
  return cached('gilda-ground', text, async () => (await getJson(`${GILDA}/ground`, { method: 'POST', body: JSON.stringify({ text }) })).slice(0, 4).map(compactMatch), opts);
}
export async function mygeneZebrafish(symbol, opts = {}) {
  return cached('mygene', `7955|${symbol}`, async () => {
    const j = await getJson(`https://mygene.info/v3/query?q=symbol:${encodeURIComponent(symbol)}&species=7955&fields=ZFIN,symbol,name,entrezgene`);
    return (j.hits || []).slice(0, 3).map(h => ({ symbol: h.symbol, name: h.name, zfin: h.ZFIN || null, entrez: h.entrezgene || null, ensembl: /^ENS/.test(h._id) ? h._id : (h.ensembl?.gene || null) }));
  }, opts);
}
export async function mygeneById(q, opts = {}) {
  return cached('mygene', `id|${q}`, async () => {
    const j = await getJson(`https://mygene.info/v3/query?q=${encodeURIComponent(q)}&fields=ZFIN,symbol,name,taxid`);
    return (j.hits || []).slice(0, 2).map(h => ({ symbol: h.symbol, name: h.name, zfin: h.ZFIN || null, taxid: h.taxid || null }));
  }, opts);
}
/** Exact-label search in one OLS4 ontology; returns a hit only when the label equals the query (case-insensitive). */
export async function olsExactLabel(q, ontology, opts = {}) {
  return cached('ols', `label2|${ontology}|${q.toLowerCase()}`, async () => {
    const j = await getJson(`https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(q)}&ontology=${ontology}&exact=true&rows=8&fieldList=obo_id,label`);
    const docs = j?.response?.docs || [];
    // NCBI homonyms carry a rank tag ("Hirundichthys <genus>"); exact label first, then the <genus> homonym
    const d = docs.find(x => String(x.label).toLowerCase() === q.toLowerCase())
      || docs.find(x => String(x.label).toLowerCase() === `${q.toLowerCase()} <genus>`);
    return d ? { id: d.obo_id, label: d.label } : null;
  }, opts);
}
export async function olsTerm(oboId, opts = {}) {
  return cached('ols', oboId, async () => {
    const j = await getJson(`https://www.ebi.ac.uk/ols4/api/terms?obo_id=${encodeURIComponent(oboId)}&size=1`);
    const t = j?._embedded?.terms?.[0];
    return t ? { label: t.label, ontology: t.ontology_name, obsolete: !!t.is_obsolete } : null;
  }, opts);
}

// ── the repo's taxon inventory ────────────────────────────────────────────────────────────────────
let taxIndex = null;
export function taxonInventory() {
  if (taxIndex) return taxIndex;
  taxIndex = new Map();
  const p = path.join(ROOT, 'organisms/merged/taxa.json');
  for (const t of exists(p) ? readJson(p) : []) {
    const id = t.identifiers?.ncbi_taxid; if (!id) continue;
    const rec = { id: `NCBITaxon:${id}`, name: t.accepted_name, rank: t.rank, mentioned_in: t.mentioned_in || [] };
    for (const n of [t.accepted_name, ...(t.names_as_written || []), ...(t.vernacular || [])]) if (n && !taxIndex.has(n.toLowerCase())) taxIndex.set(n.toLowerCase(), rec);
  }
  return taxIndex;
}

const pickGene = (hits, sym) => { const ex = (hits || []).filter(h => String(h.symbol).toLowerCase() === sym.toLowerCase()); return ex.find(h => h.zfin) || ex[0] || null; };
const geneBest = h => ({ db: h.zfin ? 'ZFIN' : h.entrez ? 'NCBIGene' : 'ENSEMBL', id: h.zfin ? `ZFIN:${h.zfin}` : h.entrez ? `NCBIGene:${h.entrez}` : `ENSEMBL:${h.ensembl}`, name: h.name, score: 1 });
const BINOMIAL = /^[A-Z][a-z]+( [a-z]{3,})?$/;

// ── public API ────────────────────────────────────────────────────────────────────────────────────
const ZF_CONTEXT = /zebrafish|danio|teleost|\bfish\b|medaka|fin\b|fins\b/i;
const GENE_TOKEN = /\b([a-z][a-z0-9]{1,7}\d[a-z0-9]{0,3})\b/g;

/** Text -> mentions with groundings. Gilda NER, plus zebrafish gene symbols and inventory taxa Gilda cannot see. */
export async function groundText(text, opts = {}) {
  const g = heldOutGuard();
  if (g.hits(text)) return { withheld: true, reason: 'touches the held-out clade; not sent to any service', mentions: [] };
  const mentions = [];
  const ann = await gildaAnnotate(text, opts);
  const inv = taxonInventory();
  for (const m of ann.value || []) {
    const d = decide(m.text, m.matches);
    const tax = d.status !== 'grounded' ? inv.get(m.text.toLowerCase()) : null;
    let olsTax = null;
    if (!tax && d.status !== 'grounded' && BINOMIAL.test(m.text) && (m.matches || []).some(x => x.db === 'MESH' || x.db === 'NCBITaxon')) olsTax = (await olsExactLabel(m.text, 'ncbitaxon', opts)).value;
    if (tax && !g.hits(tax.name)) mentions.push({ text: m.text, start: m.start, end: m.end, via: 'inventory', status: 'grounded', best: { db: 'NCBITaxon', id: tax.id, name: tax.name, score: 1 }, gilda_said: d.status });
    else if (olsTax && !g.hits(olsTax.label)) mentions.push({ text: m.text, start: m.start, end: m.end, via: 'ols-ncbitaxon', status: 'grounded', best: { db: 'NCBITaxon', id: olsTax.id, name: olsTax.label, score: 1 }, gilda_said: d.status });
    else mentions.push({ text: m.text, start: m.start, end: m.end, via: 'gilda', ...d });
  }
  const seen = new Set(mentions.map(m => m.text.toLowerCase()));
  if (ZF_CONTEXT.test(text)) {
    for (const [, tok] of text.matchAll(GENE_TOKEN)) {
      if (seen.has(tok)) continue; seen.add(tok);
      const r = await mygeneZebrafish(tok, opts);
      const hit = pickGene(r.value, tok);
      if (hit) mentions.push({ text: tok, via: 'mygene', status: 'grounded', best: geneBest(hit) });
    }
  }
  for (const [name, rec] of inv) {
    if (name.length < 5 || seen.has(name)) continue;
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text) && !g.hits(rec.name)) { seen.add(name); mentions.push({ text: name, via: 'inventory', status: 'grounded', best: { db: 'NCBITaxon', id: rec.id, name: rec.name, score: 1 } }); }
  }
  const errors = [ann.from === 'error' ? ann.error : null].filter(Boolean);
  return { withheld: false, mentions, gilda: ann.from, errors };
}

/** One declared entity (gene, taxon, identifier) -> a grounding decision. */
export async function groundEntity(name, { kind = 'any', context = '', ...opts } = {}) {
  const g = heldOutGuard();
  if (g.hits(name)) return { name, status: 'withheld' };
  const s = String(name).trim();
  // already an identifier: verify it resolves
  const idm = /^(NCBITaxon|UBERON|CL|GO|ZFA|CHEBI)[_:](\d+)$/i.exec(s.replace(/^NCBI Taxonomy\s+/i, 'NCBITaxon:'));
  if (idm) {
    const obo = `${idm[1].replace(/^ncbitaxon$/i, 'NCBITaxon').toUpperCase().replace('NCBITAXON', 'NCBITaxon')}:${idm[2]}`;
    const r = await olsTerm(obo, opts);
    if (r.value === undefined) return { name: s, status: 'declared-unverified', best: { db: obo.split(':')[0], id: obo, name: null }, via: 'declared', note: r.from };
    if (r.value === null) return { name: s, status: 'declared-unresolvable', best: null, via: 'ols', note: `${obo} not found in OLS4` };
    return { name: s, status: r.value.obsolete ? 'declared-obsolete' : 'grounded', best: { db: obo.split(':')[0], id: obo, name: r.value.label, score: 1 }, via: 'declared+ols' };
  }
  const zfin = /^ZFIN:(ZDB-GENE-\d{6}-\d+)$/.exec(s) || /^(ZDB-GENE-\d{6}-\d+)$/.exec(s);
  const ens = /^(?:ENSEMBL:)?(ENS[A-Z]*G\d{11})$/.exec(s);
  if (zfin || ens) {
    const q = zfin ? `ZFIN:${zfin[1]}` : `ensembl.gene:${ens[1]}`;
    const r = await mygeneById(q, opts);
    const h = (r.value || [])[0];
    if (r.value === undefined) return { name: s, status: 'declared-unverified', best: { db: zfin ? 'ZFIN' : 'ENSEMBL', id: s, name: null }, via: 'declared', note: r.from };
    return h ? { name: s, status: 'grounded', best: { db: zfin ? 'ZFIN' : 'ENSEMBL', id: zfin ? `ZFIN:${zfin[1]}` : `ENSEMBL:${ens[1]}`, name: `${h.symbol} (${h.name})`, score: 1 }, via: 'declared+mygene' }
      : { name: s, status: 'declared-unresolvable', best: null, via: 'mygene' };
  }
  if (/^gbif:\d+$/i.test(s)) return { name: s, status: 'declared-unverified', best: { db: 'GBIF', id: s, name: null }, via: 'declared' };
  if (kind === 'taxon') {
    const rec = taxonInventory().get(s.toLowerCase());
    if (rec) return { name: s, status: 'grounded', best: { db: 'NCBITaxon', id: rec.id, name: rec.name, score: 1 }, via: 'inventory' };
    const o = await olsExactLabel(s, 'ncbitaxon', opts);
    if (o.value && !g.hits(o.value.label)) return { name: s, status: 'grounded', best: { db: 'NCBITaxon', id: o.value.id, name: o.value.label, score: 1 }, via: 'ols-ncbitaxon' };
  }
  if (kind === 'gene' && (/^[a-z]/.test(s) || ZF_CONTEXT.test(context))) {
    const r = await mygeneZebrafish(s, opts);
    const hit = pickGene(r.value, s);
    if (hit) return { name: s, status: 'grounded', best: geneBest(hit), via: 'mygene' };
  }
  const r = await gildaGround(s, opts);
  if (r.value === undefined) return { name: s, status: 'not-run', best: null, via: 'gilda', note: r.from };
  return { name: s, via: 'gilda', ...decide(s, r.value) };
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const out = val('--entity')
    ? await groundEntity(val('--entity'), { kind: val('--kind') || 'any', context: val('--context') || '', offline })
    : await groundText(args.filter(a => !a.startsWith('--')).join(' '), { offline });
  flushCaches();
  console.log(JSON.stringify(out, null, 1));
}
