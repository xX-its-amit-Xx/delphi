#!/usr/bin/env node
// For every taxon in organisms/merged/taxa.json that has an NCBI taxid, ask the NCBI Datasets API how many
// genome assemblies exist under that taxon, and how many are RefSeq reference genomes.
// Result is cached in dashboard/genomes.cache.json with the retrieval time, so the dashboard states what was
// measured and when. Resumable: taxids already in the cache are skipped.
//   node dashboard/fetch-genomes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const taxa = JSON.parse(fs.readFileSync(path.join(root, 'organisms/merged/taxa.json'), 'utf8'));
const cachePath = path.join(root, 'dashboard/genomes.cache.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const ids = [...new Set(taxa.map(t => t.identifiers?.ncbi_taxid).filter(Boolean))].filter(i => !cache[i]);
const base = 'https://api.ncbi.nlm.nih.gov/datasets/v2/genome/taxon/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function count(id, extra) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(`${base}${id}/dataset_report?page_size=1${extra}`, { headers: { 'user-agent': 'delphisci-dashboard' } });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (a + 1)); continue; }
      if (!r.ok) return { err: r.status };
      const j = await r.json();
      const first = j.reports?.[0];
      return { total: j.total_count ?? 0, best: first ? { acc: first.accession, name: first.organism?.organism_name, level: first.assembly_info?.assembly_level } : null };
    } catch { await sleep(1000 * (a + 1)); }
  }
  return { err: 'failed' };
}

let done = 0;
async function worker(q) {
  while (q.length) {
    const id = q.pop();
    const all = await count(id, '');
    await sleep(220);
    const ref = await count(id, '&filters.reference_only=true');
    await sleep(220);
    cache[id] = { total: all.total ?? null, reference: ref.total ?? null, best: all.best || null, err: all.err || ref.err || null, retrieved: new Date().toISOString() };
    if (++done % 25 === 0) { fs.writeFileSync(cachePath, JSON.stringify(cache)); console.log(done + '/' + ids.length); }
  }
}
console.log(`${ids.length} taxids to fetch (${Object.keys(cache).length} cached)`);
const q = [...ids];
await Promise.all([worker(q), worker(q)]);
fs.writeFileSync(cachePath, JSON.stringify(cache));
const errs = Object.values(cache).filter(v => v.err).length;
console.log(`done: ${Object.keys(cache).length} cached, ${errs} with errors`);
