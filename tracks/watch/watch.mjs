#!/usr/bin/env node
// Find new papers for each use case and add them to a queue. Stage 1 of the paper watcher.
//
//   node tracks/watch/watch.mjs [--since 2026-05-01] [--max 25] [--dry]
//
// Source: Europe PMC's public search (no key, no account, nothing about us is sent but the query).
// Output: tracks/watch/queue.jsonl, one line per paper, append-only. A paper already in the queue is
// skipped, so the script can run every day. Abstracts are NOT stored in the repo.
// Holdout: a record whose title or abstract names any organism on the held-out roster
// (holdout/split.json) is dropped unread and only counted. Its title is never written anywhere.
// Fetched text is data. Nothing in a title or abstract is treated as an instruction.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'usecases.json'), 'utf8'));
const SINCE = arg('--since', cfg.since), MAX = Number(arg('--max', 25)), DRY = process.argv.includes('--dry');
const TODAY = arg('--today', new Date().toISOString().slice(0, 10));
const QUEUE = path.join(HERE, 'queue.jsonl');

// held-out vocabulary: every string of 5+ letters in the roster's held-out taxa, plus the clade and its label
const split = JSON.parse(fs.readFileSync(path.join(ROOT, 'holdout/split.json'), 'utf8'));
const words = new Set([split.clade, split.label].filter((x) => typeof x === 'string').map((x) => x.toLowerCase()));
for (const t of split.taxa ?? []) {
  if (!/hold/i.test(JSON.stringify(t.split ?? t.role ?? t.set ?? t))) continue;
  for (const v of Object.values(t)) if (typeof v === 'string' && /^[A-Za-z][A-Za-z .'-]{4,}$/.test(v) && !/^(holdout|train|excluded|species|genus|family|order|class)$/i.test(v)) words.add(v.toLowerCase());
}
// class-level words: taken at run time from the holdout thread's own checker, so they are never written here
const WEAK = [...fs.readFileSync(path.join(ROOT, 'holdout/check-leaks.mjs'), 'utf8').matchAll(/re: \/((?:[^/\\]|\\.)+)\/([a-z]*)/g)].map((m) => new RegExp(m[1], m[2].includes('i') ? 'i' : ''));
if (WEAK.length < 2) { console.error('could not read the class-level words from holdout/check-leaks.mjs; refusing to run without them'); process.exit(2); }
const heldOut = (text) => { if (WEAK.some((re) => re.test(text))) return true; const s = text.toLowerCase(); for (const w of words) if (s.includes(w)) return true; return false; };

const seen = new Set(fs.existsSync(QUEUE) ? fs.readFileSync(QUEUE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).key) : []);
const SEALED = path.join(HERE, 'sealed.json');
const sealedKeys = new Set(fs.existsSync(SEALED) ? JSON.parse(fs.readFileSync(SEALED, 'utf8')).sha256_of_key : []); // papers a reader sealed earlier
const out = [], stats = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (k) => crypto.createHash('sha256').update(k).digest('hex');
const ONLY_SRC = arg('--source', 'all');
// ---- arXiv (the papers alphaXiv mirrors). Public API, no key; one request every 3 s as arXiv asks. ----
const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) ?? [])[1]?.replace(/\s+/g, ' ').trim() ?? null;
for (const u of ONLY_SRC === 'epmc' ? [] : cfg.usecases) {
  for (const aq of u.arxiv ?? []) {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(aq)}&max_results=${MAX}&sortBy=submittedDate&sortOrder=descending`;
    let xml; try { const r = await fetch(url, { headers: { 'User-Agent': 'paper-watcher/1.0' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); xml = await r.text(); } catch (e) { stats.push({ usecase: u.id, source: 'arXiv', error: String(e).slice(0, 120) }); await sleep(3000); continue; }
    let added = 0, dropped = 0, known = 0, old = 0;
    for (const e of xml.split('<entry>').slice(1)) {
      const id = (tag(e, 'id') ?? '').replace(/^.*\/abs\//, '').replace(/v\d+$/, ''), published = (tag(e, 'published') ?? '').slice(0, 10);
      if (!id) continue;
      if (published < SINCE) { old++; continue; }
      const doi = tag(e, 'arxiv:doi'), key = `arxiv:${id}`;
      if (seen.has(key) || (doi && seen.has(`doi:${doi.toLowerCase()}`))) { known++; continue; }
      const title = tag(e, 'title') ?? '';
      if (sealedKeys.has(sha(key)) || heldOut(`${title} ${tag(e, 'summary') ?? ''}`)) { dropped++; continue; }
      seen.add(key); added++;
      out.push({ key, usecase: u.id, laws: u.laws, doi: doi ?? null, pmid: null, pmcid: null, arxiv_id: id, source: 'ARXIV', title: title.slice(0, 300), journal: 'arXiv', published,
        open_access: true, preprint: true, url: `https://arxiv.org/abs/${id}`, alphaxiv: `https://www.alphaxiv.org/abs/${id}`, found: TODAY, status: 'queued' });
    }
    stats.push({ usecase: u.id, source: 'arXiv', hits: xml.split('<entry>').length - 1, added, already_queued: known, dropped_holdout: dropped, older_than_since: old });
    await sleep(3000);
  }
}
// ---- Europe PMC (journals and bioRxiv/medRxiv/Research Square preprints) ----
for (const [u, uq] of ONLY_SRC === 'arxiv' ? [] : cfg.usecases.flatMap((u) => [u.query, ...(u.more ?? [])].map((x) => [u, x]))) {
  const q = `(${uq}) AND FIRST_PDATE:[${SINCE} TO ${TODAY}] AND SRC:(MED OR PPR)`;
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=${MAX}&resultType=core&sort=${encodeURIComponent('P_PDATE_D desc')}`;
  let res; try { res = await (await fetch(url, { headers: { 'User-Agent': 'paper-watcher/1.0' } })).json(); } catch (e) { stats.push({ usecase: u.id, error: String(e).slice(0, 120) }); continue; }
  let added = 0, dropped = 0, known = 0;
  for (const r of res.resultList?.result ?? []) {
    const key = r.doi ? `doi:${r.doi.toLowerCase()}` : `${r.source}:${r.id}`;
    if (seen.has(key)) { known++; continue; }
    if (sealedKeys.has(crypto.createHash('sha256').update(key).digest('hex'))) { dropped++; continue; }
    if (heldOut(`${r.title ?? ''} ${r.abstractText ?? ''} ${(r.keywordList?.keyword ?? []).join(' ')}`)) { dropped++; continue; }
    seen.add(key); added++;
    out.push({ key, usecase: u.id, laws: u.laws, doi: r.doi ?? null, pmid: r.pmid ?? null, pmcid: r.pmcid ?? null, source: r.source, title: String(r.title ?? '').replace(/\s+/g, ' ').slice(0, 300),
      journal: r.journalInfo?.journal?.title ?? r.bookOrReportDetails?.publisher ?? null, published: r.firstPublicationDate ?? null, open_access: r.isOpenAccess === 'Y', preprint: r.source === 'PPR',
      found: TODAY, status: 'queued' });
  }
  stats.push({ usecase: u.id, source: 'Europe PMC', hits: res.hitCount ?? 0, added, already_queued: known, dropped_holdout: dropped });
}
if (!DRY && out.length) fs.appendFileSync(QUEUE, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
for (const s of stats) console.log(s.error ? `ERROR  ${s.usecase} (${s.source ?? 'Europe PMC'}): ${s.error}` : `${s.usecase.padEnd(22)} ${s.source.padEnd(10)} hits ${String(s.hits).padStart(4)}  added ${String(s.added).padStart(3)}  already queued ${String(s.already_queued).padStart(3)}  dropped (holdout) ${s.dropped_holdout}`);
console.log(`${DRY ? 'dry run: would add' : 'added'} ${out.length} papers (${out.filter((x) => x.source === 'ARXIV').length} from arXiv); queue now ${seen.size}`);
if (!DRY) fs.writeFileSync(path.join(HERE, 'watch-last-run.json'), JSON.stringify({ ran: TODAY, since: SINCE, source: 'arXiv API and Europe PMC REST search', added: out.length, stats }, null, 1) + '\n');
process.exit(stats.some((s) => s.error) ? 1 : 0);
