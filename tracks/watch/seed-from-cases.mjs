#!/usr/bin/env node
// Put the papers of the earlier hygromorph case into the watcher as a back catalogue, so the Lean path
// has real records to check. Their numbers were extracted in the case run of 2026-11-14
// (tracks/research/agent-scripts/cs-hygromorph-bilayer/records.csv); the swelling difference there was
// INFERRED from each paper's own data, not printed in it. That is said on every record.
//   node tracks/watch/seed-from-cases.mjs      then: node tracks/watch/verify.mjs --from tracks/watch/seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const dir = path.join(ROOT, 'tracks/research/agent-scripts/cs-hygromorph-bilayer');
const csv = (f) => { const [h, ...r] = fs.readFileSync(path.join(dir, f), 'utf8').trim().split(/\r?\n/).map((l) => l.split(',')); return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };
const doiOf = Object.fromEntries(csv('records.csv').map((r) => [r.id, r.doi]));
const QUEUE = path.join(HERE, 'queue.jsonl');
const queue = fs.existsSync(QUEUE) ? fs.readFileSync(QUEUE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const have = new Set(queue.map((q) => q.key)), papers = new Map();
for (const r of csv('results_table.csv')) {
  const doi = doiOf[r.id], key = `doi:${doi}`;
  if (!papers.has(key)) papers.set(key, { key, usecase: 'hygromorph', read: 'full_text', relevant: true, outcome: 'extracted', why: 'back catalogue: records of the earlier hygromorph case', records: [], candidate_laws: [], injected_text: null });
  papers.get(key).records.push({ law: 'bilayer_plate_ceiling', label: `${r.id} (${r.split === 'dev' ? 'development' : 'held-out'} record of the earlier case)`,
    inputs: { kappa_per_mm: Number(r.kappa_meas_per_mm), h_mm: Number(Number(r.h_mm).toFixed(4)), deps: Number(r.deps) },
    quotes: [{ text: 'see tracks/research/agent-scripts/cs-hygromorph-bilayer/records.csv', where: 'case run of 2026-11-14' }], note: 'swelling difference inferred from the paper\'s own data in the case run, not printed in the paper' });
}
for (const key of papers.keys()) {
  if (have.has(key)) continue;
  const doi = key.slice(4);
  const res = await (await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`DOI:"${doi}"`)}&format=json&resultType=lite`)).json();
  const m = res.resultList?.result?.[0] ?? {};
  queue.push({ key, usecase: 'hygromorph', laws: ['bilayer_plate_ceiling', 'bilayer_strip_ceiling'], doi, pmid: m.pmid ?? null, pmcid: m.pmcid ?? null, source: m.source ?? null, title: String(m.title ?? doi), journal: m.journalTitle ?? null,
    published: m.firstPublicationDate ?? null, open_access: m.isOpenAccess === 'Y', preprint: false, found: 'back catalogue', status: 'seed' });
}
fs.writeFileSync(QUEUE, queue.map((x) => JSON.stringify(x)).join('\n') + '\n');
fs.mkdirSync(path.join(HERE, 'seed'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'seed', 'watch-seed.json'), JSON.stringify({ slice: 'seed', papers: [...papers.values()] }, null, 1) + '\n');
console.log(`seeded ${papers.size} papers, ${[...papers.values()].reduce((a, p) => a + p.records.length, 0)} records`);
