#!/usr/bin/env node
// The EVIDENCE CHECKER's instrument: fetch each cited source and look for the quoted constant in the bytes.
//
//   node pipeline/leanbio/debate/evidence.mjs <law_id>            # from the round's candidate files
//   node pipeline/leanbio/debate/evidence.mjs --meta <meta.json>
//   node pipeline/leanbio/debate/evidence.mjs --self-test         # offline: the matcher against known strings
//
// Rules this file keeps, because the whole point of the role is independence:
//  - GET, never HEAD. A HEAD tells you a URL exists; it does not tell you the number is in the paper.
//  - Europe PMC REST for the full text (fullTextXML), Crossref for existence and metadata. No credentials: both are
//    open APIs and neither is sent a key.
//  - A constant counts as FOUND only if the number (or a stated rounding of it) appears in text that was actually
//    retrieved, and the surrounding ~160 characters are recorded so a reader can judge the hit.
//  - "The landing page exists" is not evidence. A 200 with no number in it is reported as `not-in-text`.
//  - Every response is cached under cache/ so a rerun and the test suite are offline and reproducible.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { D, R, readJson, writeJson, sha256, nowIso } from './lib.mjs';

const CACHE = D('cache');
const UA = 'delphisci-leanbio-debate/1.0 (research prototype; contact via repository)';
const OFFLINE = process.env.DEBATE_OFFLINE === '1';

const cacheKey = url => sha256(url).slice(0, 32);
function cached(url) { const f = path.join(CACHE, cacheKey(url) + '.json'); return fs.existsSync(f) ? readJson(f) : null; }
function store(url, rec) { fs.mkdirSync(CACHE, { recursive: true }); writeJson(path.join(CACHE, cacheKey(url) + '.json'), rec); return rec; }

/** One GET, cached. Returns {url, status, ok, body, bytes, content_type, fetched_at, error?}. */
export async function get(url, { accept = 'application/json', timeoutMs = 25000, maxBytes = 3_500_000 } = {}) {
  const hit = cached(url);
  if (hit) return { ...hit, from_cache: true };
  if (OFFLINE) return { url, status: null, ok: false, body: '', bytes: 0, error: 'DEBATE_OFFLINE=1 and this URL is not cached', fetched_at: null };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'GET', headers: { accept, 'user-agent': UA }, signal: ctl.signal, redirect: 'follow' });
    const text = (await r.text()).slice(0, maxBytes);
    return store(url, { url, final_url: r.url, status: r.status, ok: r.ok, content_type: r.headers.get('content-type') || null, bytes: text.length, body: text, fetched_at: nowIso(), method: 'GET' });
  } catch (e) {
    return store(url, { url, status: null, ok: false, body: '', bytes: 0, error: String(e.message || e).slice(0, 300), fetched_at: nowIso(), method: 'GET' });
  } finally { clearTimeout(timer); }
}

// ---------------------------------------------------------------- identifiers inside a source string
export function parseSource(src) {
  const s = String(src || '');
  const doi = /\b(10\.\d{4,9}\/[^\s,;)"'\]]+)/.exec(s)?.[1]?.replace(/[.,;)]+$/, '') || null;
  const pmcid = /\bPMC(\d{5,9})\b/i.exec(s)?.[1] || null;
  const pmid = /\bPMID[:\s]*(\d{5,9})\b/i.exec(s)?.[1] || null;
  const repo = /\b([\w./-]+\.(?:csv|json|tsv|md|lean|py|mjs))\b/.exec(s)?.[1] || null;
  const hash = /\bsha256[:\s]*([0-9a-f]{8,64})\b/i.exec(s)?.[1] || null;
  const url = /\bhttps?:\/\/[^\s,;)"'\]]+/.exec(s)?.[0] || null;
  return { doi, pmcid, pmid, repo, hash, url, raw: s };
}

// ---------------------------------------------------------------- the matcher: does this number appear in this text?
/** Every written form of a number a paper might use for it: as given, trimmed of trailing zeros, rounded to fewer
 *  decimals, with a comma thousands separator, and in g/cm where the law uses kg/m (a stated unit conversion).
 *  Returns [{form, why}]. */
export function numberForms(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return [{ form: String(value), why: 'as written' }];
  const forms = new Map();
  const add = (f, why) => { const s = String(f); if (s && s !== 'NaN' && !forms.has(s)) forms.set(s, why); };
  add(String(value), 'as written in the statement');
  add(v, 'numeric normalisation');
  const dp = (String(value).split('.')[1] || '').length;
  // toFixed rounds the BINARY double, so (37.025).toFixed(2) is "37.02" while a paper writing the decimal 37.025
  // would print "37.03". Both forms are generated: a source may carry either, and missing the one the paper used
  // would report a sourced constant as absent.
  for (let d = dp; d >= 0; d--) {
    add(v.toFixed(d), `rounded to ${d} decimal place(s) (binary rounding)`);
    const p10 = Math.pow(10, d);
    add((Math.sign(v) * Math.round(Math.abs(v) * p10 + Number.EPSILON * Math.abs(v) * p10) / p10).toFixed(d), `rounded to ${d} decimal place(s) (decimal half-up)`);
  }
  for (let d = dp + 1; d <= dp + 2; d++) add(v.toFixed(d), `written to ${d} decimal place(s)`);
  if (Math.abs(v) >= 1000) add(v.toLocaleString('en-US'), 'with a thousands separator');
  for (const [k, why] of [[1000, 'the same value in g where the law uses kg (or mm where m)'], [100, 'the same value in cm where the law uses m'], [0.001, 'the same value in kg where the source uses g']]) {
    const x = v * k;
    if (Math.abs(x) < 1e9 && Math.abs(x) > 1e-6) { add(x, why); add(x.toFixed(Math.max(0, dp - String(k).length + 1)), why + ', rounded'); }
  }
  return [...forms].map(([form, why]) => ({ form, why }));
}

const stripXml = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');

/** Look for a number in retrieved text. Returns {found, form, why, context, where}. */
export function findNumber(value, text, where) {
  const flat = stripXml(text);
  for (const { form, why } of numberForms(value)) {
    // a digit boundary, so 3.01 does not match inside 13.015
    const re = new RegExp(`(?<![\\d.])${String(form).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`);
    const m = re.exec(flat);
    if (m) {
      const i = m.index;
      return { found: true, form, why, where, context: flat.slice(Math.max(0, i - 80), i + 80).trim() };
    }
  }
  return { found: false, where, scanned_chars: flat.length };
}

// ---------------------------------------------------------------- source resolution
/** Europe PMC: find the record for a DOI/PMID/PMCID, then GET its full text if open. */
export async function europePmc(ids) {
  const out = { api: 'Europe PMC REST', queried: null, record: null, fulltext: null };
  const q = ids.pmcid ? `PMCID:PMC${ids.pmcid}` : ids.pmid ? `EXT_ID:${ids.pmid} AND SRC:MED` : ids.doi ? `DOI:"${ids.doi}"` : null;
  if (!q) return { ...out, error: 'no DOI, PMID or PMCID in the source string' };
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&resultType=core&format=json&pageSize=1`;
  out.queried = url;
  const r = await get(url);
  out.search = { status: r.status, bytes: r.bytes, from_cache: !!r.from_cache, error: r.error || null };
  if (!r.ok) return out;
  let j; try { j = JSON.parse(r.body); } catch { return { ...out, error: 'Europe PMC returned unparseable JSON' }; }
  const hit = j?.resultList?.result?.[0];
  if (!hit) return { ...out, error: 'Europe PMC has no record for this identifier' };
  out.record = { id: hit.id, source: hit.source, pmcid: hit.pmcid || null, doi: hit.doi || null, title: hit.title || null, year: hit.pubYear || null,
    open_access: hit.isOpenAccess === 'Y', in_epmc: hit.inEPMC === 'Y', has_text_mined: hit.hasTextMinedTerms === 'Y', abstract: hit.abstractText || null };
  if (hit.pmcid && hit.inEPMC === 'Y') {
    const ft = await get(`https://www.ebi.ac.uk/europepmc/webservices/rest/${hit.pmcid}/fullTextXML`, { accept: 'application/xml' });
    out.fulltext = { url: ft.url, status: ft.status, bytes: ft.bytes, from_cache: !!ft.from_cache, text: ft.ok ? ft.body : '', error: ft.error || null };
  }
  return out;
}

/** Crossref: does the DOI resolve to a registered work? Metadata only; it carries no tables. */
export async function crossref(doi) {
  if (!doi) return { api: 'Crossref', error: 'no DOI in the source string' };
  const r = await get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const out = { api: 'Crossref', url: r.url, status: r.status, from_cache: !!r.from_cache };
  if (!r.ok) return { ...out, resolves: false, error: r.error || `HTTP ${r.status}` };
  try {
    const m = JSON.parse(r.body).message;
    return { ...out, resolves: true, title: (m.title || [])[0] || null, year: m.issued?.['date-parts']?.[0]?.[0] ?? null,
      container: (m['container-title'] || [])[0] || null, type: m.type, abstract: m.abstract ? stripXml(m.abstract) : null };
  } catch { return { ...out, resolves: false, error: 'Crossref returned unparseable JSON' }; }
}

/** A source that is a file in this repository: the bytes are right here, so check them. */
export function repoFile(rel, declaredHash) {
  const p = R(rel);
  if (!fs.existsSync(p)) return { api: 'repo file', path: rel, exists: false, error: 'no such file in the repository' };
  const buf = fs.readFileSync(p);
  const txt = buf.toString('utf8');
  // The repository's provenance strings hash the RAW BYTES. lib.mjs's sha256() normalises CRLF to LF, which is right
  // for hashing a document whose line endings do not matter and WRONG for checking a declared file hash: on Windows
  // it reports a mismatch for a file that matches. Both are computed, and a declared hash matching either is ok.
  // (Found 2026-11-01: the first run reported genotype/cache/daane2021_data_s1A_fin_measurements.csv as hashing to
  // 4f654c70... against a cited 9c941299..., and two referees wrote a needs-work item about it. The cited hash was
  // correct; the instrument was not. See DEBATE-RESULTS.md, "Corrections".)
  const raw = crypto.createHash('sha256').update(buf).digest('hex');
  const lf = sha256(txt);
  const d = declaredHash ? String(declaredHash).toLowerCase() : null;
  return { api: 'repo file', path: rel, exists: true, bytes: buf.length,
    sha256_raw_bytes: raw, sha256_lf_normalised: lf, sha256: raw,
    declared_hash: declaredHash || null,
    hash_ok: d ? (raw.startsWith(d) || lf.startsWith(d)) : null,
    hash_matched: d ? (raw.startsWith(d) ? 'raw bytes' : lf.startsWith(d) ? 'LF-normalised text' : null) : null,
    text: txt };
}

// ---------------------------------------------------------------- the check for one candidate
export async function checkEvidence(cand) {
  const constants = cand.constants || [];
  const report = { law_id: cand.law_id, checked_at: nowIso(), offline: OFFLINE, method: 'GET (never HEAD) against Europe PMC REST, Crossref and the repository bytes', constants: [], sources: [] };
  const seen = new Map();

  for (const c of constants) {
    const ids = parseSource(c.source);
    const key = JSON.stringify(ids);
    let res = seen.get(key);
    if (!res) {
      res = { ids, epmc: null, crossref: null, repo: null };
      if (ids.repo) res.repo = repoFile(ids.repo, ids.hash);
      if (ids.doi || ids.pmid || ids.pmcid) { res.epmc = await europePmc(ids); res.crossref = await crossref(ids.doi); }
      seen.set(key, res);
      report.sources.push({ source: c.source, ids,
        repo: res.repo ? { path: res.repo.path, exists: res.repo.exists, sha256_raw_bytes: res.repo.sha256_raw_bytes?.slice(0, 16), sha256_lf_normalised: res.repo.sha256_lf_normalised?.slice(0, 16), declared_hash: res.repo.declared_hash, hash_ok: res.repo.hash_ok, hash_matched: res.repo.hash_matched } : null,
        europe_pmc: res.epmc ? { record: res.epmc.record ? { id: res.epmc.record.id, pmcid: res.epmc.record.pmcid, title: res.epmc.record.title, open_access: res.epmc.record.open_access } : null, fulltext_bytes: res.epmc.fulltext?.bytes ?? 0, error: res.epmc.error || null } : null,
        crossref: res.crossref ? { resolves: !!res.crossref.resolves, title: res.crossref.title, year: res.crossref.year, error: res.crossref.error || null } : null });
    }
    // Look for the number in every body of text actually retrieved for this source, best hit first.
    const haystacks = [];
    if (res.repo?.text) haystacks.push([res.repo.text, `repository file ${res.repo.path}`]);
    if (res.epmc?.fulltext?.text) haystacks.push([res.epmc.fulltext.text, `Europe PMC full text (${res.epmc.record?.pmcid})`]);
    if (res.epmc?.record?.abstract) haystacks.push([res.epmc.record.abstract, 'Europe PMC abstract']);
    if (res.crossref?.abstract) haystacks.push([res.crossref.abstract, 'Crossref abstract']);
    let hit = null;
    for (const [text, where] of haystacks) { const f = findNumber(c.value, text, where); if (f.found) { hit = f; break; } }
    const reachable = haystacks.length > 0;
    report.constants.push({
      value: c.value, unit: c.unit ?? null, kind: c.kind ?? null, role: c.role ?? null, source: c.source,
      source_reachable: reachable,
      verdict: hit ? 'found' : reachable ? 'not-in-text' : (res.epmc?.record || res.crossref?.resolves) ? 'source-exists-text-not-retrievable' : 'source-unreachable',
      matched: hit ? { form: hit.form, why: hit.why, where: hit.where, context: hit.context } : null,
      searched: haystacks.map(h => h[1]),
      note: hit ? null
        : reachable ? `the number ${c.value} does not appear in the text retrieved (${haystacks.map(h => h[1]).join('; ')})`
        : (res.epmc?.record || res.crossref?.resolves) ? 'the work is registered but no open full text was retrievable, so the number could not be verified in the source; a registered DOI is not evidence that the number is in the paper'
        : `nothing was retrieved for this source: ${res.epmc?.error || res.crossref?.error || 'no identifier parsed'}`,
    });
  }
  const c = report.constants;
  report.summary = { constants: c.length, found: c.filter(x => x.verdict === 'found').length,
    not_in_text: c.filter(x => x.verdict === 'not-in-text').length,
    text_not_retrievable: c.filter(x => x.verdict === 'source-exists-text-not-retrievable').length,
    unreachable: c.filter(x => x.verdict === 'source-unreachable').length };
  report.verdict = !c.length ? 'nothing-to-check'
    : report.summary.found === c.length ? 'all-constants-found-in-source'
    : report.summary.not_in_text || report.summary.unreachable ? 'at-least-one-constant-not-verified-in-its-source'
    : 'partial: some sources carry no retrievable text';
  return report;
}

// ---------------------------------------------------------------- CLI
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') || process.argv[1]?.endsWith('evidence.mjs')) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    const cases = [
      [37.025, 'the band runs from 37.03 to 46.37 N/m2', true],
      [46.375, 'values of 45.09, 37.03, 46.37 and 40.21', true],
      [3.011, 'b = 3.011 (r2 = 0.993)', true],
      [3.011, 'b = 13.0115 for the pooled sample', false],
      [0.06, 'body mass 60 g', true],
      [99.9, 'nothing like it here', false],
    ];
    let bad = 0;
    for (const [v, text, want] of cases) {
      const got = findNumber(v, text, 'self-test').found;
      if (got !== want) { bad++; console.log(`FAIL ${v} in "${text}": got ${got}, want ${want}`); }
    }
    console.log(bad ? `${bad} matcher case(s) failed` : `matcher: ${cases.length}/${cases.length} cases pass`);
    process.exit(bad ? 1 : 0);
  }
  const metaFlag = argv.indexOf('--meta');
  const { loadCandidate } = await import('./candidates.mjs');
  const cand = metaFlag >= 0 ? await loadCandidate({ metaPath: argv[metaFlag + 1] }) : await loadCandidate({ lawId: argv[0] });
  console.log(JSON.stringify(await checkEvidence(cand), null, 1));
}
