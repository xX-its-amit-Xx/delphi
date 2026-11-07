#!/usr/bin/env node
// Live retrieval of comparative-genomics metadata for the analogues inventory.
//
//   NCBI Datasets v2alpha  https://api.ncbi.nlm.nih.gov/datasets/v2alpha/   assembly reports
//   Ensembl REST           https://rest.ensembl.org                        gene models, homology, sequence
//   NCBI E-utilities       https://eutils.ncbi.nlm.nih.gov/entrez/eutils/  taxonomy and literature ids
//
// THREE OUTCOMES, NEVER TWO. Every exported function returns an envelope whose `outcome` is one of:
//
//   'answered'   the API was asked and gave an answer            -> `data` is populated
//   'absent'     the API was asked and said there is no such thing (HTTP 200 with an empty payload, or a
//                4xx that means "unknown identifier") -> `data` is null, `reason` says what was absent
//   'failed'     the API was asked and the asking broke (5xx, timeout, socket error, unparseable body)
//                -> `data` is null, `error` and `status` say how
//   'not_asked'  no request was made at all (bad arguments, a guard refused, the caller passed nothing)
//                -> `data` is null, `reason` says why we never asked
//
// Collapsing these is the failure this module exists to prevent: "no orthologue of this gene exists in
// that lineage" and "Ensembl returned 502" and "you passed an empty symbol" are three different states of
// the world, and a `null` return cannot tell them apart. A run that cannot distinguish "the API is down"
// from "the answer is no" will write down the second when it means the first.
//
// CACHING. Responses go to C:/Temp/delphi-genome-cache (override with DELPHI_GENOME_CACHE) and NEVER into
// the repository: genome payloads are large and the repo has a standing rule against committing big data.
// Cache keys are a SHA-256 of the HTTP method, the URL and the request body -- nothing else, so no user
// name, host name, home directory or any other personal identifier can reach a file name.
//
// NO CREDENTIALS. All three APIs serve these endpoints anonymously. There is no key, no token and no
// contact address anywhere in this module: the User-Agent is a generic client name, because a User-Agent
// is a log line on someone else's server and an address put there is an address published.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------------------------------
// Outcomes

export const OUTCOME = Object.freeze({
  ANSWERED: 'answered',
  ABSENT: 'absent',
  FAILED: 'failed',
  NOT_ASKED: 'not_asked',
});
export const OUTCOMES = Object.freeze(Object.values(OUTCOME));

const answered = (data, extra = {}) => ({ outcome: OUTCOME.ANSWERED, ok: true, data, ...extra });
const absent = (reason, extra = {}) => ({ outcome: OUTCOME.ABSENT, ok: false, data: null, reason, ...extra });
const failed = (error, extra = {}) => ({ outcome: OUTCOME.FAILED, ok: false, data: null, error: String(error), ...extra });
const notAsked = (reason, extra = {}) => ({ outcome: OUTCOME.NOT_ASKED, ok: false, data: null, reason, ...extra });

// ---------------------------------------------------------------------------------------------------
// Rate limiting
//
// PUBLISHED LIMITS, as of 2026-11:
//   * NCBI E-utilities: 3 requests/second per IP without an API key (10/s with one). NCBI asks that
//     scripted use outside 09:00-17:00 US Eastern be kept to large batched jobs. We have no key, so 3/s.
//   * NCBI Datasets v2: 5 requests/second per IP without an API key. We deliberately run it at the same
//     3/s as E-utilities -- one setting for the whole of ncbi.nlm.nih.gov is one fewer thing to get wrong,
//     and 3/s is inside both published ceilings.
//   * Ensembl REST: 15 requests/second, enforced as 55 000 requests/hour; the service replies with
//     X-RateLimit-* headers and, when exceeded, HTTP 429 plus Retry-After. 15/s == 67 ms apart.
//
// The delay is real: requests to one host are serialised through a promise chain and each one waits until
// at least `minIntervalMs` has passed since the previous request to that host STARTED. A limit that is
// only written in a comment is not a limit.
export const LIMITS = Object.freeze({
  'api.ncbi.nlm.nih.gov': { minIntervalMs: 334, published: 'NCBI Datasets v2: 5 req/s per IP without an API key; we run at 3 req/s' },
  'eutils.ncbi.nlm.nih.gov': { minIntervalMs: 334, published: 'NCBI E-utilities: 3 req/s per IP without an API key' },
  'rest.ensembl.org': { minIntervalMs: 67, published: 'Ensembl REST: 15 req/s (55 000 req/hour), 429 + Retry-After when exceeded' },
});
const DEFAULT_MIN_INTERVAL_MS = 334; // an unknown host is treated as the strictest host we know

// Per-host request headers. MEASURED, not guessed: sending `Accept: application/json` to rest.ensembl.org
// makes it take ~41 s to return the same 116 KB payload it returns in ~0.6 s when sent
// `Content-Type: application/json` (its own documented convention) and ~0.15 s with neither. So this
// module sends Ensembl what Ensembl's docs ask for, sends no Accept header by default, and sets one only
// when a caller explicitly needs a non-JSON body. A sensible-looking header is still a header someone
// else's content negotiation has to handle.
const HOST_HEADERS = Object.freeze({
  'rest.ensembl.org': { 'Content-Type': 'application/json' },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const gates = new Map(); // host -> { chain: Promise, last: epoch ms }

// Serialise and space out calls for one key. Exported under a double-underscore name because it is a seam
// for the tests (a rate limit you cannot measure is a rate limit you cannot trust), not a public API.
export function __gate(key, minIntervalMs) {
  let g = gates.get(key);
  if (!g) gates.set(key, (g = { chain: Promise.resolve(), last: 0 }));
  const run = async () => {
    const wait = g.last + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    g.last = Date.now();
  };
  g.chain = g.chain.then(run, run);
  return g.chain;
}

export function limitForUrl(url) {
  let host = null;
  try { host = new URL(url).host; } catch { host = null; }
  const l = (host && LIMITS[host]) || null;
  return {
    host,
    minIntervalMs: l ? l.minIntervalMs : DEFAULT_MIN_INTERVAL_MS,
    published: l ? l.published : 'host not in LIMITS; treated as the strictest known host (3 req/s)',
    known: Boolean(l),
  };
}

// ---------------------------------------------------------------------------------------------------
// Cache

export const CACHE_DIR = path.resolve(process.env.DELPHI_GENOME_CACHE || 'C:/Temp/delphi-genome-cache');

// Genome assemblies and gene models move on release cycles measured in months, not hours, so a week-old
// answer is the same answer. Negatives expire sooner: "no such accession" is often "not yet public".
export const TTL = Object.freeze({
  METADATA_MS: 7 * 24 * 60 * 60 * 1000, // 7 days  -- assembly reports, gene lookups, homology, sequence
  NEGATIVE_MS: 24 * 60 * 60 * 1000,     // 1 day   -- a 'no such identifier' answer
  HEALTH_MS: 0,                         // never cached: the whole point of a ping is that it is now
});

// SHA-256 of method + URL + body, truncated. Contains no user name, host name or path from this machine.
export const cacheKey = (url, { method = 'GET', body = '' } = {}) =>
  crypto.createHash('sha256').update(`${method.toUpperCase()} ${url}\n${body || ''}`).digest('hex').slice(0, 40);

const cachePath = key => path.join(CACHE_DIR, key.slice(0, 2), `${key}.json`);

const readCache = (key, ttlMs) => {
  if (!(ttlMs > 0)) return null;
  const p = cachePath(key);
  try {
    const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!rec || typeof rec.at !== 'number') return null;
    if (Date.now() - rec.at > ttlMs) return null;
    return rec;
  } catch { return null; }
};

const writeCache = (key, rec) => {
  const p = cachePath(key);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(rec));
    return true;
  } catch { return false; }  // an unwritable cache must not fail a fetch that already succeeded
};

export const cacheFileFor = (url, opts) => cachePath(cacheKey(url, opts));
export const forgetCached = (url, opts) => { try { fs.unlinkSync(cacheFileFor(url, opts)); return true; } catch { return false; } };

// ---------------------------------------------------------------------------------------------------
// cachedFetch

const USER_AGENT = 'delphisci-analogues/1.0 (+node)'; // generic client name; deliberately no address
const DEFAULT_TIMEOUT_MS = 25_000;

// RETRIES. Measured on this host: the FIRST request to rest.ensembl.org on a cold connection can stall
// for 16-20 s and then answer, while every request after it on the warm connection answers in ~80 ms.
// One timeout is therefore not evidence that Ensembl is down, and a suite that treats it as such reports
// "the API failed" for an API that is up -- the exact confusion this module exists to prevent. So a
// transport failure, a 5xx or a 429 is retried a bounded number of times with backoff (honouring
// Retry-After when the server sends one), and only an exhausted retry budget is reported as 'failed'.
// A 4xx is NEVER retried: the server has answered, and the answer is no.
const DEFAULT_RETRIES = 2;
const BACKOFF_MS = [400, 1200];

const counters = { network: 0, cache_hits: 0, cache_writes: 0, rate_waits: 0, retries: 0 };
export const stats = () => ({ ...counters });
export const resetStats = () => { for (const k of Object.keys(counters)) counters[k] = 0; };

/**
 * Fetch `url`, through an on-disk cache keyed by a hash of the request, respecting the host's published
 * rate limit. Returns `{ body, fromCache, status, ... }`.
 *
 * `status` is the HTTP status, or 0 when the request never produced one (timeout, DNS failure, socket
 * reset). `status: 0` with `error` set is the transport failing -- not the server saying no.
 */
export async function cachedFetch(url, opts = {}) {
  const {
    method = 'GET',
    body = '',
    headers = {},
    ttlMs = TTL.METADATA_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    accept = null,        // left unset by default; see HOST_HEADERS for why
    fetchImpl,            // test seam: inject a counted fake so the cache can be proven offline
    bypassCache = false,
    retries = DEFAULT_RETRIES,
  } = opts;

  const key = cacheKey(url, { method, body });
  if (!bypassCache) {
    const hit = readCache(key, ttlMs);
    if (hit) {
      counters.cache_hits++;
      return { body: hit.body, fromCache: true, status: hit.status, url, key, cachedAt: new Date(hit.at).toISOString(), error: null, ttlMs };
    }
  }

  const limit = limitForUrl(url);
  const doFetch = fetchImpl || globalThis.fetch;
  const reqHeaders = {
    'User-Agent': USER_AGENT,
    ...(HOST_HEADERS[limit.host] || {}),
    ...(accept ? { Accept: accept } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  };

  let status = 0, text = null, error = null, attempts = 0, retryAfter = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      counters.retries++;
      await sleep(retryAfter != null ? Math.min(retryAfter, 10_000) : BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
    }
    const before = Date.now();
    await __gate(limit.host || '(unknown)', limit.minIntervalMs);
    if (Date.now() - before > 1) counters.rate_waits++;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    status = 0; text = null; error = null; retryAfter = null;
    attempts = attempt + 1;
    try {
      counters.network++;
      const res = await doFetch(url, { method, headers: reqHeaders, ...(body ? { body } : {}), signal: ac.signal });
      status = res.status ?? 0;
      const ra = res.headers?.get?.('retry-after');
      if (ra && /^\d+$/.test(ra.trim())) retryAfter = Number(ra.trim()) * 1000;
      text = await res.text();
    } catch (e) {
      error = e && e.name === 'AbortError' ? `timeout after ${timeoutMs} ms` : (e && e.message) || String(e);
    } finally {
      clearTimeout(timer);
    }
    // Retry only what might go away: a transport failure, a 5xx, a 429. A 4xx is a definitive answer.
    const transient = Boolean(error) || status >= 500 || status === 429;
    if (!transient) break;
  }

  // 2xx caches for the full TTL; a definitive 4xx caches for the shorter negative TTL; 5xx and transport
  // failures are never cached, because caching a transient outage turns one bad minute into a bad week.
  const cacheable = ttlMs > 0 && !error && ((status >= 200 && status < 300) || (status >= 400 && status < 500));
  if (cacheable && writeCache(key, { at: Date.now(), status, body: text, url })) counters.cache_writes++;

  return { body: text, fromCache: false, status, url, key, cachedAt: null, error, ttlMs, rateLimit: limit.published, attempts };
}

// Parse a cached/fetched body as JSON. A 2xx body that will not parse is the API failing, not saying no.
const asJson = (r, what) => {
  if (r.error) return { bad: failed(r.error, { status: r.status, what }) };
  if (r.status >= 500) return { bad: failed(`HTTP ${r.status} from the service`, { status: r.status, what }) };
  if (r.status === 429) return { bad: failed(`HTTP 429 rate limited (published limit: ${r.rateLimit || 'see LIMITS'})`, { status: r.status, what }) };
  let json;
  try { json = JSON.parse(r.body); }
  catch (e) {
    return { bad: failed(`HTTP ${r.status} body is not JSON: ${(e && e.message) || e}`, { status: r.status, what }) };
  }
  return { json };
};

const prov = (r, source) => ({
  status: r.status,
  from_cache: r.fromCache,
  source,
  url: r.url,
  retrieved: r.cachedAt || new Date().toISOString(),
});

// ---------------------------------------------------------------------------------------------------
// NCBI Datasets v2alpha: assembly reports

const ACC_RE = /^GC[AF]_\d{9}\.\d+$/;

/**
 * Assembly report for a GenBank/RefSeq assembly accession.
 *
 * Fields the API omits come back as `null`. In particular `submission_date` is NOT present on
 * `assembly_info` in v2alpha for most assemblies, and `release_date` is a different fact: the date the
 * assembly was released, not the date it was submitted. They are reported separately and the biosample's
 * own submission date is reported under its own name. Substituting one for another would manufacture a
 * date that no API ever said.
 */
export async function assemblyReport(accession, opts = {}) {
  if (typeof accession !== 'string' || !accession.trim()) return notAsked('no accession given');
  const acc = accession.trim();
  if (!ACC_RE.test(acc)) return notAsked(`"${acc}" is not an assembly accession (expected GCF_123456789.1 or GCA_123456789.1); not asked`);

  const url = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/${encodeURIComponent(acc)}/dataset_report`;
  const r = await cachedFetch(url, opts);
  const { bad, json } = asJson(r, `assembly report ${acc}`);
  if (bad) return bad;

  // NCBI answers an unknown accession with HTTP 200 and `{}` -- no `reports`, no error. That is the API
  // saying no, and it must not be read as a failure or as an empty success.
  const reports = Array.isArray(json.reports) ? json.reports : [];
  if (!reports.length) {
    const msg = (json.messages || []).map(m => m.error?.message || m.warning?.message || JSON.stringify(m)).join('; ');
    return absent(`NCBI Datasets has no assembly report for ${acc}${msg ? `: ${msg}` : ' (HTTP 200, empty reports)'}`, { ...prov(r, 'ncbi-datasets-v2alpha') });
  }

  const rep = reports[0];
  const ai = rep.assembly_info || {};
  const org = rep.organism || {};
  const st = rep.assembly_stats || {};
  const num = v => (v === undefined || v === null || v === '' ? null : Number(v));

  return answered({
    accession: rep.accession ?? null,
    current_accession: rep.current_accession ?? null,
    paired_accession: rep.paired_accession ?? null,
    assembly_name: ai.assembly_name ?? null,
    assembly_level: ai.assembly_level ?? null,
    assembly_status: ai.assembly_status ?? null,   // 'current' | 'suppressed' | ...
    organism: org.organism_name ?? null,
    common_name: org.common_name ?? null,
    taxid: num(org.tax_id),
    total_sequence_length: num(st.total_sequence_length),
    total_ungapped_length: num(st.total_ungapped_length),
    number_of_chromosomes: num(st.total_number_of_chromosomes),
    scaffold_n50: num(st.scaffold_n50),
    gc_percent: num(st.gc_percent),
    release_date: ai.release_date ?? null,
    submission_date: ai.submission_date ?? null,                       // null when the API omits it
    biosample_submission_date: ai.biosample?.submission_date ?? null,   // a different fact, under its own name
    submitter: ai.submitter ?? null,
    bioproject_accession: ai.bioproject_accession ?? null,
    source_database: rep.source_database ?? null,
  }, prov(r, 'ncbi-datasets-v2alpha'));
}

// ---------------------------------------------------------------------------------------------------
// Ensembl REST: gene lookup

const ensemblAbsent = (r, json, what) => {
  // Ensembl answers an unknown symbol or id with 4xx and {"error": "..."} -- a definitive no.
  const msg = (json && json.error) || `HTTP ${r.status}`;
  return absent(`Ensembl: ${msg}`, { ...prov(r, 'ensembl-rest'), what });
};

/** Gene record for a display symbol in one species: id, biotype, coordinates, strand, description. */
export async function geneBySymbol(species, symbol, opts = {}) {
  if (typeof species !== 'string' || !species.trim()) return notAsked('no species given');
  if (typeof symbol !== 'string' || !symbol.trim()) return notAsked('no gene symbol given');
  const sp = species.trim().toLowerCase().replace(/\s+/g, '_');
  const sym = symbol.trim();

  const url = `https://rest.ensembl.org/lookup/symbol/${encodeURIComponent(sp)}/${encodeURIComponent(sym)}?expand=0`;
  const r = await cachedFetch(url, opts);
  const { bad, json } = asJson(r, `gene ${sp}/${sym}`);
  if (bad) return bad;
  if (r.status >= 400) return ensemblAbsent(r, json, `gene ${sp}/${sym}`);
  if (!json || !json.id) return absent(`Ensembl returned HTTP ${r.status} with no gene for ${sp}/${sym}`, prov(r, 'ensembl-rest'));

  return answered({
    id: json.id,
    symbol: json.display_name ?? sym,
    species: json.species ?? sp,
    biotype: json.biotype ?? null,
    object_type: json.object_type ?? null,
    assembly_name: json.assembly_name ?? null,
    seq_region_name: json.seq_region_name ?? null,
    start: json.start ?? null,
    end: json.end ?? null,
    strand: json.strand ?? null,
    length: json.start != null && json.end != null ? json.end - json.start + 1 : null,
    canonical_transcript: json.canonical_transcript ?? null,
    description: json.description ?? null,
    source: json.source ?? null,
    version: json.version ?? null,
  }, prov(r, 'ensembl-rest'));
}

// ---------------------------------------------------------------------------------------------------
// Ensembl REST: homology
//
// THE TYPE IS THE ANSWER. Ensembl Compara labels every hit:
//
//   ortholog_one2one        one gene here, one gene there. The only hit that supports "the equivalent gene".
//   ortholog_one2many       one gene here, several there (or the reverse) -- a duplication on one side.
//                           Any one of them may have kept the ancestral role, split it, or lost it.
//   ortholog_many2many      duplications on both sides.
//   within_species_paralog  not an orthologue at all: a duplicate inside one genome.
//   gene_split, other_paralog, homoeolog_*  further Compara categories.
//
// Teleost genomes carry a whole extra round of duplication, so one2many is the COMMON case here, not the
// exception, and treating a one2many hit as a functional equivalent is the specific mistake this module
// refuses to make. There is deliberately no `bestOrthologue()` helper: nothing in this file will pick one
// gene out of a one2many set and hand it back as "the" orthologue.
export const HOMOLOGY_TYPES = Object.freeze([
  'ortholog_one2one', 'ortholog_one2many', 'ortholog_many2many',
  'within_species_paralog', 'other_paralog', 'gene_split',
  'homoeolog_one2one', 'homoeolog_one2many', 'homoeolog_many2many',
]);
export const isOneToOne = h => h && h.type === 'ortholog_one2one';
/** Only the one-to-one hits. Everything else is returned by `orthologues` and is the caller's problem. */
export const oneToOne = result => (result?.data?.hits || []).filter(isOneToOne);

/**
 * Homologues of `symbol` in `species`, optionally restricted to `targetSpecies` (a string or an array).
 * Every hit carries its Compara `type`.
 */
export async function orthologues(species, symbol, targetSpecies = null, opts = {}) {
  if (typeof species !== 'string' || !species.trim()) return notAsked('no species given');
  if (typeof symbol !== 'string' || !symbol.trim()) return notAsked('no gene symbol given');
  const sp = species.trim().toLowerCase().replace(/\s+/g, '_');
  const sym = symbol.trim();
  const targets = targetSpecies == null ? [] : (Array.isArray(targetSpecies) ? targetSpecies : [targetSpecies])
    .filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().toLowerCase().replace(/\s+/g, '_'));
  if (targetSpecies != null && !targets.length) return notAsked('targetSpecies was given but held no usable species key; not asked');

  // `type=all` so paralogues come back labelled rather than being filtered out upstream and never seen.
  const q = new URLSearchParams({ type: 'all', sequence: 'none', format: 'condensed', content_type: 'application/json' });
  for (const t of targets) q.append('target_species', t);
  const url = `https://rest.ensembl.org/homology/symbol/${encodeURIComponent(sp)}/${encodeURIComponent(sym)}?${q}`;
  const r = await cachedFetch(url, opts);
  const { bad, json } = asJson(r, `homology ${sp}/${sym}`);
  if (bad) return bad;
  if (r.status >= 400) return ensemblAbsent(r, json, `homology ${sp}/${sym}`);

  const blocks = Array.isArray(json?.data) ? json.data : [];
  const hits = blocks.flatMap(b => (b.homologies || []).map(h => ({
    query_id: b.id ?? null,
    target_id: h.id ?? null,
    target_species: h.species ?? null,
    type: h.type ?? null,                      // the field that decides what the hit means
    one_to_one: h.type === 'ortholog_one2one',
    known_type: HOMOLOGY_TYPES.includes(h.type),
    taxonomy_level: h.taxonomy_level ?? null,
    method_link_type: h.method_link_type ?? null,
    protein_id: h.protein_id ?? null,
  })));

  if (!blocks.length) return absent(`Ensembl Compara has no homology record for ${sp}/${sym}`, prov(r, 'ensembl-rest'));
  if (!hits.length) {
    return absent(`Ensembl Compara found ${sp}/${sym} but no homologues${targets.length ? ` in ${targets.join(', ')}` : ''}`,
      { ...prov(r, 'ensembl-rest'), query_id: blocks[0]?.id ?? null, by_type: {}, hits: [] });
  }

  const by_type = {};
  for (const h of hits) by_type[h.type ?? '(null)'] = (by_type[h.type ?? '(null)'] || 0) + 1;
  return answered({
    query: { species: sp, symbol: sym, target_species: targets },
    query_id: blocks[0]?.id ?? null,
    hits,
    by_type,
    n_hits: hits.length,
    n_one_to_one: hits.filter(isOneToOne).length,
    untyped: hits.filter(h => !h.type).length,
  }, prov(r, 'ensembl-rest'));
}

// ---------------------------------------------------------------------------------------------------
// Ensembl REST: sequence

export const SEQUENCE_TYPES = Object.freeze(['genomic', 'cds', 'protein']);

/** Sequence for an Ensembl stable id. `type` must be one of SEQUENCE_TYPES -- there is no default. */
export async function sequence(id, { type, multipleSequences = true, ...opts } = {}) {
  if (typeof id !== 'string' || !id.trim()) return notAsked('no Ensembl id given');
  if (!SEQUENCE_TYPES.includes(type)) {
    return notAsked(`type must be one of ${SEQUENCE_TYPES.join(', ')}; got ${JSON.stringify(type)}. Not asked, because guessing which molecule the caller meant is how a protein ends up labelled as a CDS.`);
  }
  const q = new URLSearchParams({ type, content_type: 'application/json' });
  if (multipleSequences) q.set('multiple_sequences', '1');
  const url = `https://rest.ensembl.org/sequence/id/${encodeURIComponent(id.trim())}?${q}`;
  const r = await cachedFetch(url, opts);
  const { bad, json } = asJson(r, `sequence ${id} (${type})`);
  if (bad) return bad;
  if (r.status >= 400) return ensemblAbsent(r, json, `sequence ${id} (${type})`);

  const recs = (Array.isArray(json) ? json : [json]).filter(x => x && typeof x.seq === 'string');
  if (!recs.length) return absent(`Ensembl has no ${type} sequence for ${id}`, prov(r, 'ensembl-rest'));

  return answered({
    requested_id: id.trim(),
    molecule: type,
    n_sequences: recs.length,
    sequences: recs.map(x => ({ id: x.id ?? null, seq: x.seq, length: x.seq.length, desc: x.desc ?? null, molecule: x.molecule ?? type })),
    total_length: recs.reduce((a, x) => a + x.seq.length, 0),
  }, prov(r, 'ensembl-rest'));
}

// ---------------------------------------------------------------------------------------------------
// NCBI E-utilities (used by the inventory for taxonomy confirmation)

/** esearch against any Entrez db; returns the id list. */
export async function esearch(db, term, { retmax = 20, ...opts } = {}) {
  if (typeof db !== 'string' || !db.trim()) return notAsked('no Entrez db given');
  if (typeof term !== 'string' || !term.trim()) return notAsked('no search term given');
  const q = new URLSearchParams({ db: db.trim(), term: term.trim(), retmode: 'json', retmax: String(retmax) });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${q}`;
  const r = await cachedFetch(url, opts);
  const { bad, json } = asJson(r, `esearch ${db}`);
  if (bad) return bad;
  const res = json?.esearchresult;
  if (!res) return failed(`esearch returned HTTP ${r.status} with no esearchresult`, { status: r.status, ...prov(r, 'ncbi-eutils') });
  if (res.ERROR) return absent(`esearch ${db}: ${res.ERROR}`, prov(r, 'ncbi-eutils'));
  const ids = Array.isArray(res.idlist) ? res.idlist : [];
  if (!ids.length) return absent(`esearch ${db} found nothing for "${term}"`, { ...prov(r, 'ncbi-eutils'), count: Number(res.count ?? 0) });
  return answered({ db: db.trim(), term: term.trim(), count: Number(res.count ?? ids.length), ids, query_translation: res.querytranslation ?? null }, prov(r, 'ncbi-eutils'));
}

/** esummary for one or more Entrez ids. */
export async function esummary(db, ids, opts = {}) {
  if (typeof db !== 'string' || !db.trim()) return notAsked('no Entrez db given');
  const list = (Array.isArray(ids) ? ids : [ids]).filter(x => x != null && String(x).trim()).map(String);
  if (!list.length) return notAsked('no Entrez ids given');
  const q = new URLSearchParams({ db: db.trim(), id: list.join(','), retmode: 'json' });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${q}`;
  const r = await cachedFetch(url, opts);
  const { bad, json } = asJson(r, `esummary ${db}`);
  if (bad) return bad;
  const res = json?.result;
  if (!res) return failed(`esummary returned HTTP ${r.status} with no result`, { status: r.status, ...prov(r, 'ncbi-eutils') });
  const records = (res.uids || []).map(u => res[u]).filter(Boolean);
  if (!records.length) return absent(`esummary ${db} has no records for ${list.join(',')}`, prov(r, 'ncbi-eutils'));
  return answered({ db: db.trim(), uids: res.uids, records }, prov(r, 'ncbi-eutils'));
}

/** efetch, returned as raw text (XML or whatever the db serves). */
export async function efetch(db, ids, { rettype = null, retmode = 'xml', ...opts } = {}) {
  if (typeof db !== 'string' || !db.trim()) return notAsked('no Entrez db given');
  const list = (Array.isArray(ids) ? ids : [ids]).filter(x => x != null && String(x).trim()).map(String);
  if (!list.length) return notAsked('no Entrez ids given');
  const q = new URLSearchParams({ db: db.trim(), id: list.join(','), retmode });
  if (rettype) q.set('rettype', rettype);
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${q}`;
  const r = await cachedFetch(url, { accept: 'text/plain', ...opts });
  if (r.error) return failed(r.error, { status: r.status });
  if (r.status >= 500) return failed(`HTTP ${r.status} from E-utilities`, { status: r.status });
  if (r.status >= 400) return absent(`efetch ${db} refused ${list.join(',')} with HTTP ${r.status}`, prov(r, 'ncbi-eutils'));
  if (!r.body || !r.body.trim()) return absent(`efetch ${db} returned an empty body for ${list.join(',')}`, prov(r, 'ncbi-eutils'));
  return answered({ db: db.trim(), ids: list, retmode, text: r.body, bytes: r.body.length }, prov(r, 'ncbi-eutils'));
}

// ---------------------------------------------------------------------------------------------------
// health

export const ENDPOINTS = Object.freeze([
  { name: 'ncbi-datasets', url: 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000001405.40/dataset_report', expect: 'reports' },
  { name: 'ensembl-rest', url: 'https://rest.ensembl.org/info/ping', expect: 'ping' },
  { name: 'ncbi-eutils', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?retmode=json', expect: 'einforesult' },
]);

/**
 * Ping all three APIs. The point is to let a caller tell "the API is down" from "the answer is no": if
 * `all_reachable` is false, an `absent` from this module that run means nothing at all.
 */
// The probe timeout is generous on purpose. A cold connection to rest.ensembl.org can stall for 16-20 s
// and then answer normally (see the RETRIES note), so a 10 s ping would report a working API as down --
// and a false "down" is the expensive error here: it is what makes a run skip the work, or read a real
// absence as an outage. The measured latency comes back in `ms`, so a slow API is still visible.
export async function health({ timeoutMs = 25_000 } = {}) {
  const checked_at = new Date().toISOString();
  const apis = [];
  for (const ep of ENDPOINTS) {
    const t0 = Date.now();
    // Health is never served from cache: a cached ping is a statement about the past.
    const r = await cachedFetch(ep.url, { ttlMs: TTL.HEALTH_MS, bypassCache: true, timeoutMs });
    const ms = Date.now() - t0;
    let parsed = false;
    if (!r.error && r.status >= 200 && r.status < 300) {
      try { parsed = Object.prototype.hasOwnProperty.call(JSON.parse(r.body), ep.expect); } catch { parsed = false; }
    }
    apis.push({
      name: ep.name,
      url: ep.url,
      reachable: Boolean(!r.error && r.status >= 200 && r.status < 300),
      answered_as_expected: parsed,   // reachable but not answering as expected is its own state
      status: r.status,
      ms,
      error: r.error,
      rate_limit: limitForUrl(ep.url).published,
    });
  }
  return {
    checked_at,
    apis,
    all_reachable: apis.every(a => a.reachable),
    any_reachable: apis.some(a => a.reachable),
    unreachable: apis.filter(a => !a.reachable).map(a => a.name),
    cache_dir: CACHE_DIR,
  };
}

/** True when at least the named APIs answer. Tests use it to skip live assertions instead of failing. */
export async function reachable(names = ['ensembl-rest', 'ncbi-datasets']) {
  const h = await health();
  const ok = names.every(n => h.apis.find(a => a.name === n)?.reachable);
  return { ok, health: h };
}

// ---------------------------------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const h = await health();
  console.log(`\nanalogues/fetch: cache ${CACHE_DIR}\n`);
  for (const a of h.apis) {
    console.log(`  ${a.reachable ? 'up  ' : 'DOWN'} ${a.name.padEnd(15)} HTTP ${String(a.status).padEnd(4)} ${String(a.ms).padStart(5)} ms  ${a.answered_as_expected ? 'answered as expected' : a.error || 'unexpected payload'}`);
    console.log(`       rate limit: ${a.rate_limit}`);
  }
  console.log(`\n  all reachable: ${h.all_reachable}${h.unreachable.length ? ` (down: ${h.unreachable.join(', ')})` : ''}\n`);
  process.exit(h.all_reachable ? 0 : 1);
}
