#!/usr/bin/env node
// The LeanBio pipeline, end to end, over the repo's claims and unsigned nanopub drafts:
//   claims + drafts -> held-out guard -> grounding -> INDRA-style statement typing -> evidence -> belief -> queue
//
//   node pipeline/leanbio/run.mjs              # network allowed for cache misses (Gilda, MyGene, OLS4); writes outputs
//   node pipeline/leanbio/run.mjs --offline    # cache only (CI); a cache miss is reported as 'not-run', never guessed
//   node pipeline/leanbio/run.mjs --check      # offline rebuild in memory; exit 1 if committed outputs are stale or
//                                              # any record lacks a grounding pass or a belief score
// Outputs: pipeline/leanbio/out/{records,queue,coverage,summary}.json and dashboard/public/leanbio/data.json.
import fs from 'node:fs';
import path from 'node:path';
import { HERE as HERE_DIR, ROOT, OUT, rel, readJson, writeJson, exists, heldOutGuard, scanTrig, listDrafts, round, sha256 } from './lib.mjs';
import { groundText, groundEntity, flushCaches } from './ground.mjs';
import { typeStatement, VOCAB } from './relations.mjs';
import { belief, PARAMS } from './belief.mjs';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const OFFLINE = CHECK || args.includes('--offline');
const opts = { offline: OFFLINE };
const SUPPORT_STATUS = /^(supported|established|observed|partially supported)$/i;
const CONTRA_STATUS = /^(refuted|not-established)$/i;

export async function build() {
  const guard = heldOutGuard();
  const withheld = { claims: 0, drafts: 0 };

  // ── inputs ──────────────────────────────────────────────────────────────────────────────────────
  const claimsAll = readJson(path.join(ROOT, 'docs/claims.json')).claims;
  const claimIds = new Set(claimsAll.map(c => c.id));
  const tests = {};
  (function walk(d) {
    for (const n of fs.readdirSync(d)) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) walk(f);
      else if (n === 'result.json') { try { const j = readJson(f); const id = j.claim_id || path.basename(d); (tests[id] ||= []).push({ verdict: j.verdict, status: j.status, file: rel(f) }); } catch { /* unparsable result: skipped */ } }
    }
  })(path.join(ROOT, 'claim-tests'));
  const lawsDir = path.join(ROOT, 'lean/registry/laws');
  const laws = fs.readdirSync(lawsDir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(lawsDir, f)));
  const lawset = readJson(path.join(ROOT, 'lean/registry/lawsets/current.json'));
  const lawText = laws.map(l => ({ l, s: JSON.stringify(l) }));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkedLaws = (id, text = null) => lawText
    .filter(({ l, s }) => l.law_id === id || new RegExp(`(^|[^A-Za-z0-9-])${esc(id)}([^A-Za-z0-9-]|$)`).test(s) || (text && l.law_id.length >= 6 && new RegExp(`(^|[^A-Za-z0-9-])${esc(l.law_id)}([^A-Za-z0-9-]|$)`).test(text)))
    .map(({ l }) => ({ law_id: l.law_id, version: l.version, status: l.status, class: l.class, open_conflicts: (l.open_conflicts || []).length }));
  const inventory = exists(path.join(ROOT, 'organisms/merged/taxa.json')) ? readJson(path.join(ROOT, 'organisms/merged/taxa.json')) : [];
  const taxaByClaim = {};
  for (const t of inventory) for (const id of t.mentioned_in || []) (taxaByClaim[id] ||= []).push(t.accepted_name);
  const index = exists(path.join(ROOT, 'nanopubs-index/index.json')) ? readJson(path.join(ROOT, 'nanopubs-index/index.json')).drafts : {};

  // ── drafts ──────────────────────────────────────────────────────────────────────────────────────
  const drafts = [];
  for (const f of listDrafts()) {
    const src = fs.readFileSync(f, 'utf8');
    if (guard.hits(src)) { withheld.drafts++; continue; }
    const t = scanTrig(src);
    const r = rel(f);
    const ix = index[r];
    drafts.push({ path: r, ...t, thread: r.split('/')[0], declared: { genes: ix?.entities?.genes || [], taxa: ix?.entities?.taxa || [] }, links: t.claimLinks.filter(id => claimIds.has(id)) });
  }

  // ── records: one per claim, plus one per draft that is not evidence for a claim ───────────────
  const records = [];
  for (const c of claimsAll) {
    if (guard.hits(`${c.statement} ${c.quote || ''} ${c.label || ''}`, c.id)) { withheld.claims++; continue; }
    records.push({ id: c.id, origin: 'claim', source: 'docs/claims.json', text: c.statement, label: c.label, kind: c.kind, thinker: c.thinker, year: c.year, work: c.work, claim_status: c.status, testability: c.testability ?? null, nanopub: c.nanopub || null, registry: c.registry || null, truth_by: c.truth_by || [], declared: { taxa: (taxaByClaim[c.id] || []).filter(n => !guard.hits(n)), genes: [], curies: [] }, types: [] });
  }
  const evidenceDrafts = {};
  for (const d of drafts) {
    if (d.links.length) { for (const id of d.links) (evidenceDrafts[id] ||= []).push(d); continue; }
    const text = d.plain || d.label || d.description;
    records.push({ id: `draft:${d.path}`, origin: 'draft', source: d.path, text, label: d.label, kind: d.types.join(',') || 'unknown', thread: d.thread, draft_status: d.status, testability: null, declared: { taxa: d.declared.taxa, genes: d.declared.genes, curies: d.curies }, types: d.types, dois: d.dois, pmids: d.pmids, orcid_in_draft: d.orcid });
  }

  // ── per record: grounding, typing, evidence, belief ──────────────────────────────────────────────
  const queueItems = [];
  let i = 0;
  const work = async rec => {
    const g = await groundText(rec.text, opts);
    const declared = [];
    for (const t of rec.declared.taxa) declared.push({ ...(await groundEntity(t, { kind: 'taxon', ...opts })), declared_as: 'taxon' });
    for (const ge of rec.declared.genes) declared.push({ ...(await groundEntity(ge, { kind: 'gene', context: rec.text, ...opts })), declared_as: 'gene' });
    for (const cu of rec.declared.curies) declared.push({ ...(await groundEntity(cu, opts)), declared_as: 'identifier' });
    rec.grounding = { pass: g.gilda === 'offline-miss' ? 'not-run' : 'done', gilda: g.gilda, errors: g.errors, mentions: g.mentions, declared };
    const usable = [...g.mentions, ...declared.filter(d => d.best).map(d => ({ text: d.name, status: d.status === 'grounded' ? 'grounded' : d.status, best: d.best }))];
    rec.statement = typeStatement(rec.text, g.mentions, { types: rec.types });
    rec.entities = [...new Map(usable.filter(m => m.best && (m.status === 'grounded' || m.status === 'ambiguous')).map(m => [m.best.id, { id: m.best.id, name: m.best.name, db: m.best.db, status: m.status, text: m.text }])).values()];

    // evidence
    const items = [];
    const ev = [];
    if (rec.origin === 'claim') {
      for (const t of tests[rec.id] || []) {
        const v = String(t.verdict || '').toLowerCase();
        if (/^support/.test(v)) items.push({ side: 'support', cls: 'preregistered-test', key: rec.id, note: t.file });
        if (/^refut/.test(v)) items.push({ side: 'contradict', cls: 'preregistered-test', key: rec.id, note: t.file });
        if (/^mixed/.test(v)) { items.push({ side: 'support', cls: 'preregistered-test', key: rec.id, note: t.file }); items.push({ side: 'contradict', cls: 'preregistered-test', key: rec.id, note: t.file }); }
        ev.push({ kind: 'preregistered-test', verdict: t.verdict, file: t.file });
      }
      for (const tb of rec.truth_by) items.push({ side: tb.p_true >= 0.5 ? 'support' : 'contradict', cls: 'model-elicitation', key: tb.assessor, note: `p_true ${tb.p_true}` });
      for (const d of evidenceDrafts[rec.id] || []) {
        const st = String(d.status || '');
        const fromTest = d.path.startsWith('claim-tests/');
        ev.push({ kind: 'draft', file: d.path, status: d.status, from_test: fromTest });
        const side = SUPPORT_STATUS.test(st) ? 'support' : CONTRA_STATUS.test(st) ? 'contradict' : null;
        if (!side) continue;
        // a draft built from a claim test is the SAME evidence as the test, and its DOIs are the test's datasets:
        // counting either again would double-count one experiment (see belief-params.json "independence")
        if (fromTest) continue;
        items.push({ side, cls: 'repo-evidence', key: d.path, note: st });
        if (side === 'support') for (const x of [...d.dois.map(v => `doi:${v.toLowerCase()}`), ...d.pmids.map(v => `pmid:${v}`)]) items.push({ side, cls: 'literature', key: x, note: d.path });
      }
    } else {
      const st = String(rec.draft_status || '');
      const side = SUPPORT_STATUS.test(st) ? 'support' : CONTRA_STATUS.test(st) ? 'contradict' : null;
      if (side) {
        items.push({ side, cls: 'repo-evidence', key: rec.source, note: st });
        if (side === 'support') for (const x of [...rec.dois.map(v => `doi:${v.toLowerCase()}`), ...rec.pmids.map(v => `pmid:${v}`)]) items.push({ side, cls: 'literature', key: x, note: rec.source });
      }
      ev.push({ kind: 'self', status: rec.draft_status, file: rec.source });
    }
    rec.linked_laws = linkedLaws(rec.origin === 'claim' ? rec.id : '__none__', rec.origin === 'draft' ? fs.readFileSync(path.join(ROOT, rec.source), 'utf8') : null);
    for (const l of rec.linked_laws) if (l.status === 'contested' || l.open_conflicts) items.push({ side: 'contradict', cls: 'lean-conflict', key: l.law_id, note: l.status });
    rec.evidence = ev;
    rec.evidence_items = items;
    rec.belief = belief(items);
    rec.inconclusive_tests = (tests[rec.id] || []).filter(t => /inconclusive/i.test(t.verdict || '')).length;
    i++;
    if (!CHECK && i % 100 === 0) process.stderr.write(`  ${i}/${records.length}\n`);
  };
  // modest concurrency for the public services
  const pool = 4;
  let next = 0;
  await Promise.all(Array.from({ length: pool }, async () => { while (next < records.length) await work(records[next++]); }));
  if (!CHECK) flushCaches();

  // ── queue ───────────────────────────────────────────────────────────────────────────────────────
  const q = PARAMS.queue;
  const declined = new Map(readJson(path.join(HERE_DIR, 'proposals.json')).filter(p => p.decision === 'not proposed').map(p => [p.id, p]));
  for (const r of records) {
    const why = [];
    if (declined.has(r.id)) why.push(`reviewed ${declined.get(r.id).date}: no correct Lean statement (pipeline/leanbio/proposals.json)`);
    if (r.belief.belief < q.min_belief) why.push(`belief ${r.belief.belief} < ${q.min_belief}`);
    if (!q.formalizable.includes(r.statement.formalizable)) why.push(`relation ${r.statement.type} is not formalizable`);
    const blocking = r.linked_laws.filter(l => q.exclude_if_linked_law_status.includes(l.status));
    if (blocking.length) why.push(`already in the registry: ${blocking.map(l => `${l.law_id} (${l.status})`).join(', ')}`);
    if (!r.entities.length && r.origin === 'draft') why.push('no grounded entity');
    r.queue = why.length ? { eligible: false, why } : { eligible: true };
    if (r.queue.eligible) queueItems.push(r);
  }
  const tests_n = r => r.belief.n.support['preregistered-test'] || 0;
  const fRank = r => (r.statement.formalizable === 'theorem' ? 0 : 1);
  queueItems.sort((a, b) => fRank(a) - fRank(b) || b.belief.belief - a.belief.belief || tests_n(b) - tests_n(a) || (b.testability ?? -1) - (a.testability ?? -1) || a.id.localeCompare(b.id));
  const queue = queueItems.map((r, k) => ({ rank: k + 1, id: r.id, origin: r.origin, text: r.text, label: r.label, belief: r.belief.belief, E: r.belief.E, R: r.belief.R, n: r.belief.n, relation: r.statement.type, formalizable: r.statement.formalizable, lean_shape: r.statement.formalizable === 'theorem' ? 'theorem over a named-hypothesis structure (quantities with units)' : 'named hypothesis (structure) with a non-vacuity witness', entities: r.entities.slice(0, 8), testability: r.testability, linked_laws: r.linked_laws, source: r.source }));

  // ── coverage ────────────────────────────────────────────────────────────────────────────────────
  const tally = (xs, f) => xs.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
  const allMentions = records.flatMap(r => r.grounding.mentions.map(m => ({ ...m, rec: r.id })));
  const allDeclared = records.flatMap(r => r.grounding.declared.map(d => ({ ...d, rec: r.id })));
  const byOrigin = o => records.filter(r => r.origin === o);
  const withEntity = xs => xs.filter(r => r.entities.length).length;
  const ambiguous = allMentions.filter(m => m.status === 'ambiguous');
  const ungroundableDeclared = allDeclared.filter(d => !['grounded', 'ambiguous'].includes(d.status));
  const coverage = {
    records: { total: records.length, claims: byOrigin('claim').length, drafts: byOrigin('draft').length, evidence_drafts_attached_to_claims: Object.values(evidenceDrafts).reduce((a, x) => a + x.length, 0), withheld_held_out: withheld },
    records_with_grounded_entity: { all: withEntity(records), claims: withEntity(byOrigin('claim')), drafts: withEntity(byOrigin('draft')) },
    grounding_pass: tally(records, r => r.grounding.pass),
    text_mentions: { total: allMentions.length, by_status: tally(allMentions, m => m.status), by_via: tally(allMentions, m => m.via), grounded_by_namespace: tally(allMentions.filter(m => m.best), m => m.best.db) },
    declared_entities: { total: allDeclared.length, by_status: tally(allDeclared, d => d.status), by_kind: tally(allDeclared, d => d.declared_as) },
    ambiguous_mentions: Object.values(ambiguous.reduce((a, m) => { const k = m.text.toLowerCase(); (a[k] ||= { text: m.text, n: 0, best: m.best, alternatives: m.alternatives }).n++; return a; }, {})).sort((a, b) => b.n - a.n).slice(0, 40),
    ungroundable_declared: Object.values(ungroundableDeclared.reduce((a, d) => { const k = `${d.declared_as}|${d.name}`; (a[k] ||= { name: d.name, kind: d.declared_as, status: d.status, note: d.note || null, records: [] }).records.push(d.rec); return a; }, {})),
    low_confidence_rejected_top: Object.entries(tally(allMentions.filter(m => m.status === 'low-confidence'), m => m.text.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 25),
    relation_types: tally(records, r => r.statement.type),
  };
  const bins = Array.from({ length: 10 }, (_, k) => ({ lo: round(k / 10, 1), hi: round((k + 1) / 10, 1), n: 0 }));
  for (const r of records) bins[Math.min(9, Math.floor(r.belief.belief * 10))].n++;
  const draftFiles = drafts.length + withheld.drafts;
  const summary = {
    generated_from: { claims: 'docs/claims.json', drafts: listDrafts().map(rel).filter(p => !p.includes('/holdout/')).length, draft_dirs: 'pipeline/leanbio/lib.mjs DRAFT_DIRS', tests: 'claim-tests/**/result.json', laws: 'lean/registry/laws/*.json' },
    counts: { claims: records.filter(r => r.origin === 'claim').length, nanopub_drafts_read: draftFiles - withheld.drafts, records: records.length, grounded_entities_distinct: new Set(records.flatMap(r => r.entities.map(e => e.id))).size, queue: queue.length, withheld_held_out_records: withheld.claims + withheld.drafts },
    belief: { params: PARAMS.version, distribution: bins, mean: round(records.reduce((a, r) => a + r.belief.belief, 0) / records.length) },
    laws: { lawset: lawset.version, by_status: tally(laws, l => l.status), total: laws.length },
    relations: VOCAB.version,
    queue_head: queue.slice(0, 10).map(x => ({ rank: x.rank, id: x.id, belief: x.belief, relation: x.relation })),
  };
  return { records, queue, coverage, summary };
}

const stable = v => JSON.stringify(v, null, 1) + '\n';
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const { records, queue, coverage, summary } = await build();
  const files = {
    [path.join(OUT, 'records.json')]: { version: 1, params: PARAMS.version, relations: VOCAB.version, records },
    [path.join(OUT, 'queue.json')]: { version: 1, params: PARAMS.version, queue },
    [path.join(OUT, 'coverage.json')]: coverage,
    [path.join(OUT, 'summary.json')]: summary,
    [path.join(ROOT, 'dashboard/public/leanbio/data.json')]: { summary, coverage: { records: coverage.records, records_with_grounded_entity: coverage.records_with_grounded_entity, text_mentions: coverage.text_mentions, declared_entities: coverage.declared_entities, ambiguous_mentions: coverage.ambiguous_mentions.slice(0, 12), ungroundable_declared: coverage.ungroundable_declared.map(u => ({ name: u.name, kind: u.kind, status: u.status, n: u.records.length })), relation_types: coverage.relation_types }, queue: queue.slice(0, 40).map(({ rank, id, origin, label, text, belief, E, R, relation, formalizable, entities, n }) => ({ rank, id, origin, label, text, belief, E, R, relation, formalizable, n, entities: entities.slice(0, 5).map(e => ({ id: e.id, name: e.name })) })), proposals: readJson(path.join(HERE_DIR, 'proposals.json')) },
  };
  if (CHECK) {
    const problems = [];
    for (const r of records) {
      if (!r.grounding || r.grounding.pass !== 'done') problems.push(`${r.id}: grounding not run (cache miss: run node pipeline/leanbio/run.mjs with network)`);
      if (!r.belief || typeof r.belief.belief !== 'number') problems.push(`${r.id}: no belief score`);
    }
    for (const [p, v] of Object.entries(files)) {
      if (!exists(p)) { problems.push(`${rel(p)} missing`); continue; }
      if (fs.readFileSync(p, 'utf8') !== stable(v)) problems.push(`${rel(p)} is stale: rerun node pipeline/leanbio/run.mjs`);
    }
    if (problems.length) { console.error(`leanbio --check: ${problems.length} problem(s)\n  ` + problems.slice(0, 30).join('\n  ')); process.exit(1); }
    console.log(`leanbio --check: OK (${records.length} records grounded and scored, outputs current, queue ${queue.length})`);
  } else {
    for (const [p, v] of Object.entries(files)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, stable(v)); }
    console.log(JSON.stringify(summary, null, 1));
  }
}
