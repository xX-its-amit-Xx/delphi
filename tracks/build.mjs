#!/usr/bin/env node
// Assemble the six-track bundle the dashboard reads, from what the agents returned.
//
//   node tracks/build.mjs                    reads DELPHI_AGENTS_DIR or D:/Users/ashenoy00000/delphi-work/agents
//
// ============================== WHY THIS IS NOT A COPY ==============================
// Thirty-nine agents were asked to read and report. An agent's report is a draft: it can cite a paper
// that is not in the corpus, attach a DOI to the wrong title, or "quote" a sentence the abstract does
// not contain. Nothing here trusts a report on its say-so where a mechanical check exists.
//
//   CORPUS ENTRIES are joined back to the bibliography that was fetched before any agent ran. An entry
//   survives only if its DOI or OpenAlex id is in that file AND its title matches the record. A quote
//   survives only if it is a substring of the stored abstract after whitespace is normalised. What
//   fails is counted and listed, not silently dropped.
//
//   CITATIONS from the track and specialist agents carry the agent's own `verified` flag, which is a
//   claim about what it fetched. That flag is passed through as `agent_says_verified` and is NOT
//   promoted to "verified" here. tracks/scripts/verify-dois.py resolves each one independently, and
//   only its result is shown as verified on the page.
//
// The raw agent files stay outside the repo. What is committed is this merged, checked artefact.
import fs from 'node:fs';
import path from 'node:path';
import * as READ from './scripts/readability.mjs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const AGENTS = process.env.DELPHI_AGENTS_DIR ?? 'D:/Users/ashenoy00000/delphi-work/agents';
const OUT_REPO = path.join(HERE, 'research');
const OUT_DASH = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/tracks');

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const norm = (s) => String(s ?? '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const normDoi = (d) => String(d ?? '').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim();

export const TRACKS = [
  { n: 1, slug: 'reporter', level: 'single biological circuit', title: 'Shifting a reporter\'s response',
    loop: ['pick one circuit', 'compose the model', 'freeze', 'test'], route: 'paper' },
  { n: 2, slug: 'patterns', level: 'microbial self-organisation', title: 'Changes in spatial patterns',
    loop: ['agree the phenotype', 'connect mechanisms', 'test a new condition'], route: 'paper' },
  { n: 3, slug: 'lumen', level: 'multicellular tissue morphology', title: 'Changes in lumen geometry',
    loop: ['start from available data', 'reproduce morphogenesis', 'test one shape prediction'], route: 'paper' },
  { n: 4, slug: 'glide', level: 'organism-scale design', title: 'A fin or body constraint in a passive glide surrogate',
    loop: ['validate the mechanical model', 'build a physical comparison', 'review the biological bridge'], route: 'paper' },
  { n: 5, slug: 'biomaterial', level: 'contracting', title: 'A new biomaterial, printed on Formlabs',
    loop: ['Buehler + Marom pipeline', 'the partner\'s gaps', 'Lean laws constrain the design', 'print a proof of concept'], route: 'contract' },
  { n: 6, slug: 'flyingfish', level: 'organism-scale, existing', title: 'The flying fish and its evaluation framework',
    loop: ['reuse the elimination framework', 'stay on the latest law set'], route: 'existing' },
];

// ---------------------------------------------------------------- the corpus, checked against its source
export function mergeCorpus(agentsDir = AGENTS) {
  const src = readJson(path.join(OUT_REPO, 'corpus/buehler.json'));
  if (!src) return { error: 'tracks/research/corpus/buehler.json is missing; run tracks/scripts/fetch-bibliography.py' };
  const byDoi = new Map(), byOa = new Map();
  for (const w of src.works) {
    if (w.doi) byDoi.set(normDoi(w.doi), w);
    byOa.set(w.openalex, w);
  }
  const files = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter((f) => /^corpus-\d+\.json$/.test(f)).sort() : [];
  const kept = [], rejected = [];
  let quotesChecked = 0, quotesFailed = 0, read = 0;
  const themes = new Map();
  for (const f of files) {
    const d = readJson(path.join(agentsDir, f));
    if (!d) { rejected.push({ file: f, why: 'unparseable agent file' }); continue; }
    read += d.works_read ?? 0;
    for (const t of d.themes_seen ?? []) themes.set(t.theme, (themes.get(t.theme) ?? 0) + (t.count ?? 0));
    for (const r of d.relevant ?? []) {
      const rec = (r.doi && byDoi.get(normDoi(r.doi))) || (r.openalex && byOa.get(r.openalex)) || null;
      if (!rec) { rejected.push({ file: f, title: r.title, doi: r.doi ?? null, why: 'no record with this DOI or OpenAlex id in the fetched corpus' }); continue; }
      // the title must be the record's title, not merely a DOI that happens to exist
      const a = norm(r.title), b = norm(rec.title);
      if (!(a && b && (a === b || a.includes(b.slice(0, 40)) || b.includes(a.slice(0, 40))))) {
        rejected.push({ file: f, title: r.title, doi: r.doi ?? null, why: `title does not match the record (${String(rec.title).slice(0, 60)})` });
        continue;
      }
      let quote = (r.quote_from_abstract ?? '').trim();
      let quoteOk = null;
      if (quote) {
        quotesChecked++;
        const hay = norm(rec.abstract), needle = norm(quote);
        quoteOk = !!(needle && hay.includes(needle));
        if (!quoteOk) { quotesFailed++; quote = ''; }
      }
      kept.push({
        doi: rec.doi, openalex: rec.openalex, title: rec.title, year: rec.year, venue: rec.venue,
        authors: rec.authors, n_authors: rec.n_authors, cited_by: rec.cited_by,
        tracks: [...new Set((r.tracks ?? []).filter((n) => n >= 1 && n <= 6))].sort(),
        relevance: Math.max(1, Math.min(5, r.relevance | 0)),
        theme: r.theme, why: r.why,
        quote, quote_verified_in_abstract: quoteOk,
        has_abstract: !!rec.abstract,
      });
    }
  }
  // one paper can come back from two batches only if the slices overlapped; keep the higher relevance
  const uniq = new Map();
  for (const k of kept) {
    const key = k.doi ? normDoi(k.doi) : k.openalex;
    if (!uniq.has(key) || uniq.get(key).relevance < k.relevance) uniq.set(key, k);
  }
  const works = [...uniq.values()].sort((a, b) => b.relevance - a.relevance || (b.year ?? 0) - (a.year ?? 0) || (b.cited_by ?? 0) - (a.cited_by ?? 0));
  const perTrack = Object.fromEntries(TRACKS.map((t) => [t.n, works.filter((w) => w.tracks.includes(t.n)).length]));
  return {
    author: src.author,
    source: { what: src.source, retrieved: src.retrieved, works_fetched: src.n, works_listed_by_openalex: src.author.works_count,
      coverage_note: `${src.n} of ${src.author.works_count} works OpenAlex lists were fetched by a year-by-year walk. The remainder carry no publication year the walk could filter on.`,
      with_doi: src.with_doi, with_abstract: src.with_abstract },
    batches: files.length, works_read_by_agents: read,
    relevant: works.length, rejected: rejected.length, rejected_entries: rejected.slice(0, 60),
    quotes_checked: quotesChecked, quotes_failed: quotesFailed,
    quote_rule: 'a quote is shown only if it is a substring of the abstract stored in the fetched record, after lower-casing and collapsing punctuation',
    per_track: perTrack,
    themes: [...themes.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count),
    works,
  };
}

// ---------------------------------------------------------------- tracks and specialists
function citeKey(c) { return normDoi(c.doi_or_arxiv ?? ''); }

export function loadTracks(agentsDir = AGENTS, verified = {}) {
  return TRACKS.map((t) => {
    const scout = readJson(path.join(agentsDir, `scout-${t.slug}.json`));
    const design = readJson(path.join(agentsDir, `design-${t.slug}.json`));
    const laws = readJson(path.join(agentsDir, `laws-${t.slug}.json`));
    const cites = (scout?.citations ?? []).map((c) => ({
      ...c, agent_says_verified: !!c.verified, verified: undefined,
      resolved: verified[citeKey(c)] ?? null,
    }));
    return {
      ...t,
      status: design ? 'designed' : scout ? 'scouted' : laws ? 'laws mapped' : 'pending',
      scout: scout ? { summary: scout.summary, recommended: scout.recommended, candidates: scout.candidates,
        measured_numbers: scout.measured_numbers ?? [], could_not_find: scout.could_not_find ?? [], citations: cites } : null,
      design: design ?? null,
      laws: laws ?? null,
    };
  });
}

export function loadSpecialists(agentsDir = AGENTS, verified = {}) {
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir).filter((f) => /^spec-.*\.json$/.test(f)).sort().map((f) => {
    const d = readJson(path.join(agentsDir, f));
    if (!d) return { slug: f.replace(/^spec-|\.json$/g, ''), error: 'unparseable' };
    return {
      slug: f.replace(/^spec-|\.json$/g, ''), ...d,
      citations: (d.citations ?? []).map((c) => ({ ...c, agent_says_verified: !!c.verified, verified: undefined,
        resolved: verified[citeKey(c)] ?? null })),
    };
  });
}

// The 77-agent fleet (workflow wf_af15c8ea-cdf). Read from the committed copy so the build is
// reproducible from the repo alone. Groups come from the file-name prefix.
const FLEET_DIR = path.join(HERE, 'research', 'agents');
const GROUPS = { bm: 'biomaterials', pp: 'people-funding-clients', q1: 'leanbio-enhancers', q2: 'leanbio-binding',
  t1: 'track-1', t2: 'track-2', t3: 'track-3', t4: 'track-4', t6: 'track-6' };
export function loadFleet(verified = {}) {
  if (!fs.existsSync(FLEET_DIR)) return [];
  return fs.readdirSync(FLEET_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const d = readJson(path.join(FLEET_DIR, f));
    const slug = f.replace(/\.json$/, '');
    const group = GROUPS[slug.split('-')[0]] ?? 'other';
    if (!d) return { slug, group, error: 'unparseable' };
    return {
      slug, group, ...d,
      citations: (d.citations ?? []).map((c) => ({ ...c, agent_says_verified: !!c.verified, verified: undefined,
        resolved: verified[citeKey(c)] ?? null })),
      // evidence quotes are the agent's claim until a verifier re-fetches the source
      findings: (d.findings ?? []).map((x) => ({ ...x, quote_checked: false })),
    };
  });
}

// Plain-language explainers (phase 2). The reading grade is MEASURED here, not taken from the writer, and
// the no-context reader's own report travels with it so the page can show how the text actually landed.
const P2 = path.join(HERE, 'research', 'phase2');
export function loadVerdicts() {
  if (!fs.existsSync(P2)) return null;
  const out = { by_agent: {}, tally: {} };
  for (const f of fs.readdirSync(P2).filter((x) => x.startsWith('verify-'))) {
    const d = readJson(path.join(P2, f)); if (!d) continue;
    out.by_agent[d.label.replace(/^verify-/, '')] = { overall: d.overall, claims: d.claims };
    for (const c of d.claims) out.tally[c.verdict] = (out.tally[c.verdict] ?? 0) + 1;
  }
  return out;
}

const EXPLAIN_TITLE = { 'bm-science': 'The science', 'bm-making': 'The making: printer, resins, tests', 'bm-contract': 'The contract: architecture, market, patents, money' };
export function attachExplainers(tracks) {
  const rd = (n) => readJson(path.join(P2, n + '.json'));
  const prep = (g) => {
    const ex = rd(`explain2-${g}`) ?? rd(`explain-${g}`); if (!ex) return null;
    const prose = [ex.one_line, ex.what, ex.why, ...(ex.steps ?? []).map((x) => x.text), ex.wrong_if, ...(ex.could_go_wrong ?? []),
      ...(ex.questions ?? []).flatMap((q) => [q.q, q.a])].filter(Boolean).join(' ');
    const a = READ.assess(prose, { glossary: ex.glossary ?? [], limit: 10, max_jargon: 12 });
    const r = rd(`read2-${g}`) ?? rd(`read-${g}`);
    const revised = !!rd(`explain2-${g}`);
    return { ...ex, title: EXPLAIN_TITLE[g] ?? null, revised, reading: { grade: a.grade, unexplained_terms: a.jargon.length, longest_sentence: a.longest_sentence_words, ok: a.ok, failed: a.failed,
      reader_clarity: r?.clarity_1_to_5 ?? null, reader_unknown_words: r?.words_i_did_not_know ?? [], reader_could_not_follow: r?.sentences_i_could_not_follow ?? [],
      reader_unanswerable: (r?.test_questions ?? []).filter((q) => !q.answerable_from_text).map((q) => q.question), reader_help: r?.what_would_help ?? null } };
  };
  const by = { 1: ['track-1'], 2: ['track-2'], 3: ['track-3'], 4: ['track-4'], 5: ['bm-science', 'bm-making', 'bm-contract'], 6: ['track-6'] };
  for (const t of tracks) {
    const all = (by[t.n] ?? []).map(prep).filter(Boolean);
    t.explain = all[0] ?? null; t.explain_more = all.slice(1);
  }
  const lean = ['leanbio-enhancers', 'leanbio-binding', 'people-funding'].map((g) => ({ group: g, ...prep(g) })).filter((x) => x.one_line);
  return lean;
}

// ---------------------------------------------------------------- run
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT_REPO, { recursive: true });
  fs.mkdirSync(OUT_DASH, { recursive: true });
  const verified = readJson(path.join(OUT_REPO, 'doi-resolution.json'))?.results ?? {};
  const synthesis = readJson(path.join(HERE, 'synthesis.json'));
  const corpus = mergeCorpus();
  const tracks = loadTracks(AGENTS, verified);
  const specialists = loadSpecialists(AGENTS, verified);
  const fleet = loadFleet(verified);
  const extraExplain = attachExplainers(tracks);
  const verdicts = loadVerdicts();

  const allCites = [...tracks.flatMap((t) => t.scout?.citations ?? []), ...specialists.flatMap((s) => s.citations ?? []), ...fleet.flatMap((s) => s.citations ?? [])];
  const citeStats = {
    total: allCites.length,
    agent_says_verified: allCites.filter((c) => c.agent_says_verified).length,
    independently_resolved: allCites.filter((c) => c.resolved?.ok === true).length,
    failed_to_resolve: allCites.filter((c) => c.resolved && c.resolved.ok === false).length,
    not_yet_checked: allCites.filter((c) => !c.resolved).length,
    rule: 'an agent\'s own "verified" flag is a claim. Only a DOI or arXiv id that tracks/scripts/verify-dois.py resolved, with a matching title, is shown as verified.',
  };

  const bundle = {
    what_this_is: 'six tracks: four candidate routes for the paper, one contracting route, and the existing flying-fish framework',
    built: new Date().toISOString().slice(0, 10),
    brief: 'tracks/BRIEF-2026-11-12.md',
    lawset: tracks.find((t) => t.laws?.lawset_version)?.laws.lawset_version ?? null,
    tracks, specialists, fleet, extraExplain, verdicts, synthesis,
    corpus: corpus.error ? corpus : { ...corpus, works: corpus.works.slice(0, 400) },
    corpus_full_in_repo: 'tracks/research/buehler-corpus.json',
    citations: citeStats,
    open_for_amit: [
      '"Senty": no session, agent, tool, file or memory by that name was found. Which system is it, and how is it reached?',
      '"The paper is in repo": no manuscript was found on any fetched branch of fractastical/delphi or in fractastical/leanbio. Which repository and path?',
      '"Mobile Money" in the brief is read as Mamou-Mani. Confirm.',
    ],
  };
  if (!corpus.error) fs.writeFileSync(path.join(OUT_REPO, 'buehler-corpus.json'), JSON.stringify(corpus, null, 1));
  fs.writeFileSync(path.join(OUT_DASH, 'tracks.json'), JSON.stringify(bundle));
  console.log(`corpus: ${corpus.error ?? `${corpus.relevant} relevant of ${corpus.works_read_by_agents} read, ${corpus.rejected} rejected, quotes ${corpus.quotes_checked - corpus.quotes_failed}/${corpus.quotes_checked} verified`}`);
  if (!corpus.error) console.log(`  per track: ${Object.entries(corpus.per_track).map(([k, v]) => `T${k}=${v}`).join(' ')}`);
  for (const t of tracks) console.log(`track ${t.n} ${t.slug.padEnd(12)} ${t.status}`);
  console.log(`fleet: ${fleet.length} agents, ${fleet.reduce((a, x) => a + (x.findings?.length ?? 0), 0)} findings
specialists: ${specialists.length} | citations ${citeStats.total}, agent-verified ${citeStats.agent_says_verified}, resolved ${citeStats.independently_resolved}, failed ${citeStats.failed_to_resolve}, unchecked ${citeStats.not_yet_checked}`);
  console.log(`wrote ${path.relative(ROOT, path.join(OUT_DASH, 'tracks.json'))} (${fs.statSync(path.join(OUT_DASH, 'tracks.json')).size} bytes)`);
}
