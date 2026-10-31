#!/usr/bin/env node
// Pins the taxon statements a blueprint certificate needs, from Ubergraph (the same endpoint the organism
// thread's tool queried), so that lean/Delphi/Certificates/<Name>.lean can check them with `decide`:
//   node lean/blueprint/fetch-taxon.mjs organism-design/examples/a-flying-fish.json
// -> lean/blueprint/data/<name>.taxon.json  { blueprint (file, sha256), queries (every batch: sparql, retrieved, rows),
//                                            ancestors, neverIn, inTaxon }
// never_in_taxon (RO_0002161) is collected on the kept term itself, on any rdfs:subClassOf ancestor and on any
// part_of (BFO_0000050) whole as Ubergraph serves them (inferred closure included): the three places the tool's
// taxon filter looks. in_taxon (RO_0002162) on the term. Ancestors of the blueprint's taxon are the rdfs:subClassOf
// closure Ubergraph serves, plus the taxon itself. Terms go in batches, because one query over all of them was cut
// off by the server mid-stream (observed 2026-10-31: an error message spliced into the JSON body).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
if (!file) { console.error('usage: node lean/blueprint/fetch-taxon.mjs <blueprint.json>'); process.exit(2); }
const B = JSON.parse(fs.readFileSync(file, 'utf8'));
const name = path.basename(file, '.json');
const ENDPOINT = 'https://ubergraph.apps.renci.org/sparql';
const taxonIri = B.reading.taxon.iri;
const terms = [...new Set(B.nodes.map(n => n.iri))].sort();
const P = 'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX obo: <http://purl.obolibrary.org/obo/> ';
const BATCH = Number(process.env.BATCH || 40);

const queries = [];
async function sparql(purpose, query) {
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/sparql-query', accept: 'application/sparql-results+json' }, body: P + query });
  const text = await r.text();
  if (!r.ok) throw new Error(`${purpose}: HTTP ${r.status} ${text.slice(0, 300)}`);
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error(`${purpose}: response is not JSON (${text.length} chars): ${text.slice(0, 200)}`); }
  const rows = j.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
  queries.push({ purpose, endpoint: ENDPOINT, sparql: P + query, retrieved: new Date().toISOString(), rows: rows.length, ms: Date.now() - t0 });
  return rows;
}
const batches = []; for (let i = 0; i < terms.length; i += BATCH) batches.push(terms.slice(i, i + BATCH));
const V = b => b.map(t => `<${t}>`).join(' ');

const anc = await sparql(`taxa that contain ${B.reading.taxon.label} (rdfs:subClassOf closure as Ubergraph serves it), NCBITaxon only`,
  `SELECT DISTINCT ?t WHERE { <${taxonIri}> rdfs:subClassOf ?t . FILTER(REGEX(STR(?t),'NCBITaxon_[0-9]+$')) }`);
const never = [], inT = [];
for (const [k, b] of batches.entries()) {
  const tag = `batch ${k + 1}/${batches.length} (${b.length} terms)`;
  for (const r of await sparql(`never_in_taxon on the kept term itself, ${tag}`, `SELECT DISTINCT ?s ?nt WHERE { VALUES ?s { ${V(b)} } ?s obo:RO_0002161 ?nt . }`)) never.push({ term: r.s, via: r.s, taxon: r.nt });
  for (const r of await sparql(`never_in_taxon on a subClassOf ancestor of the kept term, ${tag}`, `SELECT DISTINCT ?s ?via ?nt WHERE { VALUES ?s { ${V(b)} } ?s rdfs:subClassOf ?via . ?via obo:RO_0002161 ?nt . }`)) never.push({ term: r.s, via: r.via, taxon: r.nt });
  for (const r of await sparql(`never_in_taxon on a part_of whole of the kept term, ${tag}`, `SELECT DISTINCT ?s ?via ?nt WHERE { VALUES ?s { ${V(b)} } ?s obo:BFO_0000050 ?via . ?via obo:RO_0002161 ?nt . }`)) never.push({ term: r.s, via: r.via, taxon: r.nt });
  for (const r of await sparql(`in_taxon on the kept term (NCBITaxon only), ${tag}`, `SELECT DISTINCT ?s ?it WHERE { VALUES ?s { ${V(b)} } ?s obo:RO_0002162 ?it . FILTER(REGEX(STR(?it),'NCBITaxon_[0-9]+$')) }`)) inT.push({ term: r.s, taxon: r.it });
  process.stdout.write(`${tag}: never ${never.length}, in ${inT.length}\r`);
}
process.stdout.write('\n');
const taxId = iri => Number(iri.replace(/^.*NCBITaxon_/, ''));
const isNcbi = iri => /NCBITaxon_\d+$/.test(iri);
const dedupe = a => [...new Map(a.map(x => [JSON.stringify(x), x])).values()];
const out = {
  blueprint: { file: path.relative(path.resolve(here, '../..'), path.resolve(file)).replace(/\\/g, '/'), built: B.built, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), taxon: B.reading.taxon, terms: terms.length },
  queries,
  ancestors: [...new Set([taxId(taxonIri), ...anc.map(r => taxId(r.t))])].sort((a, b) => a - b),
  neverIn: dedupe(never).map(r => ({ ...r, taxid: isNcbi(r.taxon) ? taxId(r.taxon) : null })),
  inTaxon: dedupe(inT).map(r => ({ ...r, taxid: taxId(r.taxon) }))
};
fs.mkdirSync(path.join(here, 'data'), { recursive: true });
const dst = path.join(here, 'data', `${name}.taxon.json`);
fs.writeFileSync(dst, JSON.stringify(out, null, 1));
console.log(`${dst}: ${out.ancestors.length} ancestors, ${out.neverIn.length} never_in_taxon rows (${out.neverIn.filter(x => x.taxid === null).length} non-NCBITaxon), ${out.inTaxon.length} in_taxon rows, for ${terms.length} terms in ${queries.length} queries`);
