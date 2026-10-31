// Mechanical verifier for test plans. No LLM. Identical for every arm (see swarm/PREREG.md, "Verification").
// Usage as a module: import { verifyPlan } from './verify.mjs'
// Usage as a CLI:    node swarm/compare/verify.mjs <plan.json> [...]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(here, 'verify-cache.json');
const TIMEOUT_MS = 25000;
const BODY_CAP = 2 * 1024 * 1024;
const UA = 'Mozilla/5.0 (compatible; delphi-swarm-verifier/0.1; +https://github.com/fractastical/delphisci)';

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { cache = {}; }
function saveCache() { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1)); }

const STOP = new Set(['dataset', 'database', 'global', 'international', 'records', 'record', 'version', 'survey', 'species', 'world', 'national', 'united', 'states', 'institute', 'center', 'centre', 'system', 'information', 'portal', 'online', 'collection', 'collections', 'data', 'about', 'their', 'there', 'which', 'these', 'those', 'other', 'university', 'museum', 'natural', 'history', 'science', 'sciences', 'research', 'program', 'programme', 'project', 'table', 'tables', 'files', 'report', 'annual', 'public', 'open', 'download', 'archive', 'library', 'service', 'office', 'agency', 'department', 'council', 'federal', 'government', 'health', 'organization', 'organisation', 'foundation', 'network', 'resource', 'resources', 'repository', 'checklist', 'occurrence', 'occurrences', 'search', 'results', 'index', 'catalog', 'catalogue']);

export function extractIdentifiers(plan) {
  const text = JSON.stringify(plan);
  const found = new Map();
  const add = (raw, kind) => {
    let s = String(raw).trim().replace(/[.,;:)\]}'"]+$/, '');
    if (!s) return;
    let url = s;
    if (kind === 'doi') url = 'https://doi.org/' + s;
    else if (/^10\.\d{4,9}\//.test(s)) { kind = 'doi'; url = 'https://doi.org/' + s; }
    else if (/^doi\.org\//i.test(s)) { kind = 'doi'; url = 'https://' + s; }
    else if (/^https?:\/\/(dx\.)?doi\.org\//i.test(s)) kind = 'doi';
    else kind = 'url';
    const key = url.toLowerCase().replace(/\/+$/, '');
    if (!found.has(key)) found.set(key, { raw: s, kind, url });
  };
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>\\)\]}]+/g)) add(m[0].replace(/\\u0026/g, '&'), 'url');
  for (const m of text.matchAll(/\b10\.\d{4,9}\/[^\s"'<>\\)\]}]+/g)) add(m[0], 'doi');
  if (plan?.dataset?.landing_url) add(plan.dataset.landing_url, 'url');
  if (plan?.dataset?.doi) add(plan.dataset.doi, 'doi');
  for (const id of plan?.identifiers || []) add(id, 'auto');
  return [...found.values()];
}

async function fetchOnce(url) {
  if (cache[url] && cache[url].class !== 'blocked') return { ...cache[url], cached: true };
  const started = new Date().toISOString();
  const rec = { url, retrieved_at: started, status: null, final_url: null, class: null, title: null, bytes: 0, sha256: null, content_type: null, error: null };
  let u;
  try { u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw new Error('not http'); } catch { rec.class = 'malformed'; cache[url] = rec; saveCache(); return rec; }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' } });
    rec.status = res.status; rec.final_url = res.url; rec.content_type = res.headers.get('content-type');
    const chunks = []; let total = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; chunks.push(value); if (total >= BODY_CAP) { try { await reader.cancel(); } catch { } break; } }
    }
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
    rec.bytes = buf.length; rec.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const txt = buf.toString('utf8', 0, Math.min(buf.length, 600000));
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(txt); rec.title = t ? t[1].replace(/\s+/g, ' ').trim().slice(0, 200) : null;
    rec._text = (rec.title || '') + ' ' + (rec.final_url || '') + ' ' + txt.replace(/<[^>]+>/g, ' ').toLowerCase();
    const doiMissing = /doi\.org/i.test(u.host) && (res.status === 404 || /DOI Not Found|doi cannot be found|not found in the DOI system/i.test(txt));
    if (doiMissing) rec.class = 'fabricated';
    else if (res.status >= 200 && res.status < 300) rec.class = 'resolves';
    else if (res.status === 404 || res.status === 410) rec.class = 'fabricated';
    else rec.class = 'blocked';
  } catch (e) {
    const code = e?.cause?.code || e?.code || e?.name;
    rec.error = String(code || e.message).slice(0, 120);
    rec.class = (code === 'ENOTFOUND' || code === 'EAI_AGAIN' && false) ? 'fabricated' : 'blocked';
    if (code === 'ENOTFOUND') rec.class = 'fabricated';
  } finally { clearTimeout(timer); }
  const toCache = { ...rec }; delete toCache._text; toCache.text_sample = (rec._text || '').slice(0, 20000);
  cache[url] = toCache; saveCache();
  return rec;
}

export function nameTokens(name, publisher) {
  const toks = `${name || ''} ${publisher || ''}`.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5 && !STOP.has(w));
  return [...new Set(toks)];
}

export async function verifyPlan(plan) {
  const ids = extractIdentifiers(plan);
  const out = { identifiers: [], fabricated: [], blocked: [], resolves: [], dataset_named: !!plan?.dataset, dataset_resolves: false, name_match: false, dataset_verified: false, matched_tokens: [] };
  for (const id of ids) {
    const r = await fetchOnce(id.url);
    const rec = { ...id, status: r.status, final_url: r.final_url, class: r.class, title: r.title, bytes: r.bytes, sha256: r.sha256, retrieved_at: r.retrieved_at, error: r.error, cached: !!r.cached };
    out.identifiers.push(rec);
    if (r.class === 'fabricated') out.fabricated.push(id.url);
    else if (r.class === 'blocked' || r.class === 'malformed') out.blocked.push(id.url);
    else out.resolves.push(id.url);
  }
  const ds = plan?.dataset;
  if (ds) {
    const cands = [ds.landing_url, ds.doi ? (/^https?:/.test(ds.doi) ? ds.doi : 'https://doi.org/' + ds.doi) : null].filter(Boolean);
    const toks = nameTokens(ds.name, ds.publisher);
    for (const c of cands) {
      const key = c.toLowerCase().replace(/\/+$/, '');
      const rec = out.identifiers.find(i => i.url.toLowerCase().replace(/\/+$/, '') === key);
      if (!rec || rec.class !== 'resolves') continue;
      out.dataset_resolves = true;
      const text = (cache[rec.url]?.text_sample || '') + ' ' + (rec.title || '') + ' ' + (rec.final_url || '');
      const low = text.toLowerCase();
      const hit = toks.filter(t => low.includes(t));
      if (hit.length) { out.name_match = true; out.matched_tokens = hit.slice(0, 8); }
    }
    out.dataset_verified = out.dataset_resolves && out.name_match;
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  for (const f of process.argv.slice(2)) {
    const plan = JSON.parse(fs.readFileSync(f, 'utf8'));
    const v = await verifyPlan(plan);
    console.log(f, JSON.stringify({ verified: v.dataset_verified, resolves: v.dataset_resolves, name_match: v.name_match, fabricated: v.fabricated, blocked: v.blocked, n_ids: v.identifiers.length }, null, 1));
  }
}

// Text our checker saw on a page (title, final URL and body sample), from the verify cache. Used by experiment 2 to
// compare the page title an agent reports with what the checker fetched.
export function pageText(url) {
  const key = Object.keys(cache).find(k => k.toLowerCase().replace(/\/+$/, '') === String(url || '').toLowerCase().replace(/\/+$/, ''));
  const rec = key ? cache[key] : null;
  if (!rec) return null;
  return [rec.title || '', rec.final_url || '', rec.text_sample || ''].join(' ');
}
