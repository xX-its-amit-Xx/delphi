#!/usr/bin/env node
// Harvest nanopubs from the public Knowledge Pixels query service, READ-ONLY (SPARQL SELECT over HTTP GET).
// This never signs, publishes or writes to any registry.
//
//   node pipeline/leanbio/harvest.mjs                                  # latest Delphi claims (delphi:Claim)
//   node pipeline/leanbio/harvest.mjs --type https://w3id.org/delphi/ontology/EvidenceItem --limit 50
//   node pipeline/leanbio/harvest.mjs --since 2026-10-01 --out pipeline/leanbio/harvest/claims.json
//   node pipeline/leanbio/harvest.mjs --count                          # how many nanopubs of the type exist
//
// Endpoint: https://query.knowledgepixels.com/repo/full (override with DELPHI_SPARQL_ENDPOINT), the same one the
// delphisci MCP server uses for source "network". It runs RDF4J without inference (BEST_PRACTICES.md section 10),
// so query the exact type IRI. Harvested items are candidates only: to enter the pipeline, a claim must be added as a
// draft or claim in the repo (see CONTRIBUTING-LEANBIO.md), then grounded and scored by run.mjs.
import fs from 'node:fs';
import path from 'node:path';

export const ENDPOINT = process.env.DELPHI_SPARQL_ENDPOINT ?? 'https://query.knowledgepixels.com/repo/full';

export async function sparql(query, endpoint = ENDPOINT) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${r.status} from ${endpoint}`);
  return (await r.json()).results.bindings;
}

export function harvestQuery({ type = 'https://w3id.org/delphi/ontology/Claim', since = null, limit = 20, count = false } = {}) {
  if (!/^https?:\/\/[^\s<>"]+$/.test(type)) throw new Error('type must be an IRI');
  if (since && !/^\d{4}-\d{2}-\d{2}/.test(since)) throw new Error('since must be an ISO date');
  const head = 'PREFIX npx: <http://purl.org/nanopub/x/> PREFIX dct: <http://purl.org/dc/terms/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>';
  if (count) return `${head} SELECT (COUNT(DISTINCT ?np) AS ?n) WHERE { GRAPH ?h { ?np npx:hasNanopubType <${type}> } }`;
  return `${head} SELECT DISTINCT ?np ?created ?label WHERE { GRAPH ?h { ?np npx:hasNanopubType <${type}> } ` +
    `OPTIONAL { GRAPH ?i { ?np dct:created ?created } } OPTIONAL { GRAPH ?i2 { ?np rdfs:label ?label } } ` +
    `${since ? `FILTER(?created >= "${since}T00:00:00Z"^^xsd:dateTime) ` : ''}} ORDER BY DESC(?created) LIMIT ${Math.min(500, Math.max(1, Number(limit) || 20))}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const a = process.argv.slice(2);
  const v = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const q = harvestQuery({ type: v('--type') || undefined, since: v('--since'), limit: v('--limit') || 20, count: a.includes('--count') });
  const at = new Date().toISOString();
  const rows = await sparql(q);
  const seen = new Set();
  const items = rows.map(b => Object.fromEntries(Object.entries(b).map(([k, x]) => [k, x.value]))).filter(x => (x.np && !seen.has(x.np) ? seen.add(x.np) : !x.np));
  const out = { endpoint: ENDPOINT, retrieved_at: at, query: q, n: items.length, items };
  if (v('--out')) { fs.mkdirSync(path.dirname(v('--out')), { recursive: true }); fs.writeFileSync(v('--out'), JSON.stringify(out, null, 1) + '\n'); console.log(`wrote ${v('--out')} (${items.length})`); }
  else console.log(JSON.stringify(out, null, 1));
}
