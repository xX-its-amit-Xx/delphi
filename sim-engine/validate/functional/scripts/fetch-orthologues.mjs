#!/usr/bin/env node
// Medaka (Oryzias latipes) Daane-2021 locus -> zebrafish orthologue, via Ensembl REST homology.
// Cached per locus under C:/Temp/functional-cache/ortho/. Polite: 3 concurrent, 1 s spacing, long timeouts
// (the homology endpoint takes ~60 s per gene). No credentials. No Aves anywhere: target_species is danio_rerio only.
import fs from 'node:fs';
import path from 'node:path';

const CACHE = process.env.FUNCTIONAL_CACHE_DIR || 'C:/Temp/functional-cache';
const DIR = path.join(CACHE, 'ortho');
fs.mkdirSync(DIR, { recursive: true });
const UA = { 'User-Agent': 'delphisci-validate-functional/0.1 (research; no credentials)', Accept: 'application/json' };

const sheets = JSON.parse(fs.readFileSync(path.join(CACHE, 'daane_sheets.json'), 'utf8'));
// Sheet G carries five loci whose Ensembl id is not medaka (Xiphophorus maculatus, Poecilia formosa): the
// homology endpoint needs the right source species, so each id's species is resolved from its prefix.
const SPECIES_OF = { ENSORLG: 'oryzias_latipes', ENSXMAG: 'xiphophorus_maculatus', ENSPFOG: 'poecilia_formosa' };
const ids = new Map();
const add = r => { const m = /^(ENS[A-Z]+G)\d+$/.exec(r[0] || ''); if (m && SPECIES_OF[m[1]] && r[1] && r[1] !== 'NA') ids.set(r[0], { symbol: r[1], species: SPECIES_OF[m[1]] }); };
for (const r of sheets['G - conv. aa subst.']) add(r);
for (const r of sheets['I - Glider RER genes']) add(r);
const todo = [...ids.keys()].filter(id => !fs.existsSync(path.join(DIR, `${id}.json`)));
console.error(`${ids.size} loci, ${todo.length} to fetch`);

async function one(id) {
  const url = `https://rest.ensembl.org/homology/id/${ids.get(id).species}/${id}?target_species=danio_rerio;type=orthologues;format=condensed`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 180000);
      const r = await fetch(url, { headers: UA, signal: ac.signal }); clearTimeout(t);
      if (r.status === 429) { await new Promise(s => setTimeout(s, 10000)); continue; }
      if (!r.ok) { if (r.status >= 500) { await new Promise(s => setTimeout(s, 5000)); continue; }
        fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify({ id, url, http: r.status, homologies: null, fetched: new Date().toISOString() })); return; }
      const j = await r.json();
      const h = j.data?.[0]?.homologies || [];
      fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify({ id, source_symbol: ids.get(id).symbol, source_species: ids.get(id).species, url, http: 200, fetched: new Date().toISOString(),
        homologies: h.map(x => ({ danio_gene: x.id, danio_protein: x.protein_id, type: x.type, taxonomy_level: x.taxonomy_level })) }));
      return;
    } catch (e) { if (attempt === 3) { console.error(id, 'FAILED', e.message); return; } await new Promise(s => setTimeout(s, 5000)); }
  }
}

const q = [...todo];
const workers = Array.from({ length: 3 }, async () => {
  while (q.length) { const id = q.shift(); await one(id); await new Promise(s => setTimeout(s, 1000)); console.error('done', id, q.length, 'left'); }
});
await Promise.all(workers);
console.error('all done');
