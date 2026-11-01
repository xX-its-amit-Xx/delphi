// Read-only access to delphisci nanopubs, either as published on the nanopub network
// (Knowledge Pixels SPARQL endpoint) or as the TriG files in this repo.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import oxigraph from "oxigraph";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const NETWORK_ENDPOINT = process.env.DELPHI_SPARQL_ENDPOINT ?? "https://query.knowledgepixels.com/repo/full";
const CLAIM_BASE = "https://w3id.org/delphi/resource/claim/";

// Unsigned nanopubs all share this temp base, so each file gets its own base when loaded locally.
const TEMP_BASE = "http://purl.org/nanopub/temp/np1/";
const LOCAL_BASE = "https://w3id.org/delphi/local/";

export const PREFIXES = `PREFIX np: <http://www.nanopub.org/nschema#>
PREFIX npx: <http://purl.org/nanopub/x/>
PREFIX delphi: <https://w3id.org/delphi/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX prov: <http://www.w3.org/ns/prov#>
`;

const NUMERIC = /#(double|decimal|float|integer|int|long)$/;

function simplify(json) {
  return json.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k,
    v.type === "uri" && v.value.startsWith(LOCAL_BASE) ? toLocalPath(v.value)
    : NUMERIC.test(v.datatype ?? "") ? Number(v.value)
    : v.value])));
}

function toLocalPath(iri) {
  const rest = iri.slice(LOCAL_BASE.length);
  const i = rest.indexOf(".trig/");
  return i < 0 ? rest : `${rest.slice(0, i + 5)}${rest.length > i + 6 ? `#${rest.slice(i + 6)}` : ""}`;
}

// Local store: every */nanopubs/unsigned and */nanopubs/*-unsigned directory. Signed copies are
// skipped because they duplicate the unsigned content.
function localFiles() {
  const files = [];
  for (const project of readdirSync(REPO, { withFileTypes: true })) {
    if (!project.isDirectory() || project.name.startsWith(".") || project.name === "node_modules") continue;
    const npDir = join(REPO, project.name, "nanopubs");
    let dirs;
    try { dirs = readdirSync(npDir, { withFileTypes: true }); } catch { continue; }
    for (const d of dirs) {
      if (!d.isDirectory() || !(d.name === "unsigned" || d.name.endsWith("-unsigned"))) continue;
      for (const f of readdirSync(join(npDir, d.name))) if (f.endsWith(".trig")) files.push(join(npDir, d.name, f));
    }
  }
  return files;
}

let cache = null;

function localStore() {
  const files = localFiles();
  const stamp = files.length + ":" + Math.max(0, ...files.map(f => statSync(f).mtimeMs));
  if (cache?.stamp === stamp) return cache.store;
  const store = new oxigraph.Store();
  for (const f of files) {
    const trig = readFileSync(f, "utf8").replaceAll(TEMP_BASE, `${LOCAL_BASE}${relative(REPO, f).replaceAll("\\", "/")}/`);
    store.load(trig, { format: "application/trig" });
  }
  cache = { stamp, store, files: files.length };
  return store;
}

export function localFileCount() {
  localStore();
  return cache.files;
}

export async function sparql(query, source = "local") {
  const q = query.includes("PREFIX") ? query : PREFIXES + query;
  if (source === "local") {
    return simplify(JSON.parse(localStore().query(q, { results_format: "application/sparql-results+json" })));
  }
  if (source !== "network") throw new Error(`Unknown source "${source}" (use "local" or "network")`);
  const res = await fetch(NETWORK_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query: q }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`SPARQL endpoint ${NETWORK_ENDPOINT} returned ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return simplify(await res.json());
}

const lit = s => JSON.stringify(String(s));
const PREFIX_MAP = [...PREFIXES.matchAll(/PREFIX (\w+): <([^>]+)>/g)].map(m => [m[2], m[1]])
  .concat([["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf"]]);
const compact = iri => {
  const hit = PREFIX_MAP.find(([ns]) => iri.startsWith(ns));
  return hit ? `${hit[1]}:${iri.slice(hit[0].length)}` : iri;
};
const claimIri = id => (id.startsWith("http") ? id : CLAIM_BASE + id);

export async function overview(source = "local") {
  const domains = await sparql(`
SELECT ?domain (COUNT(DISTINCT ?claim) AS ?claims) (COUNT(DISTINCT ?mathClaim) AS ?claimsWithMath) WHERE {
  GRAPH ?h { ?np np:hasAssertion ?a ; np:hasPublicationInfo ?p . }
  GRAPH ?a { ?claim a delphi:Claim . OPTIONAL { ?claim skos:notation ?n . BIND(?claim AS ?mathClaim) } }
  OPTIONAL { GRAPH ?p { ?np delphi:domain ?d . } }
  BIND(COALESCE(STR(?d), "(none)") AS ?domain)
} GROUP BY ?domain ORDER BY DESC(?claims)`, source);
  const assessmentTypes = await sparql(`
SELECT ?type (COUNT(DISTINCT ?asmt) AS ?assessments) (COUNT(DISTINCT ?claim) AS ?claims) (COUNT(DISTINCT ?assessor) AS ?assessors) WHERE {
  GRAPH ?g {
    ?claim delphi:hasAssessment ?asmt .
    ?asmt delphi:assessmentType ?type ; prov:wasAttributedTo ?assessor .
    FILTER NOT EXISTS { ?asmt dct:isPartOf ?parent }
  }
} GROUP BY ?type ORDER BY DESC(?assessments)`, source);
  return { source, ...(source === "local" ? { files: localFileCount() } : { endpoint: NETWORK_ENDPOINT }), domains, assessmentTypes };
}

export async function searchClaims({ text, domain, mathOnly = false, limit = 20, source = "local" }) {
  const filters = [
    text && `FILTER(CONTAINS(LCASE(CONCAT(STR(?label), " ", COALESCE(STR(?desc), ""), " ", COALESCE(STR(?notation), ""))), LCASE(${lit(text)})))`,
    domain && `FILTER(CONTAINS(LCASE(STR(?d)), LCASE(${lit(domain)})))`,
  ].filter(Boolean).join("\n  ");
  return sparql(`
SELECT ?claim (SAMPLE(?label) AS ?title) (SAMPLE(?desc) AS ?statement)
       (GROUP_CONCAT(DISTINCT STR(?notation); separator=" || ") AS ?math)
       (SAMPLE(STR(?d)) AS ?domain) (SAMPLE(?np) AS ?nanopub) WHERE {
  GRAPH ?h { ?np np:hasAssertion ?a ; np:hasPublicationInfo ?p . }
  GRAPH ?a {
    ?claim a delphi:Claim ; rdfs:label ?label .
    OPTIONAL { ?claim dct:description ?desc }
    ${mathOnly ? "" : "OPTIONAL {"} ?claim skos:notation ?notation ${mathOnly ? "" : "}"}
  }
  OPTIONAL { GRAPH ?p { ?np delphi:domain ?d . } }
  ${filters}
} GROUP BY ?claim ORDER BY ?claim LIMIT ${Math.min(Number(limit) || 20, 500)}`, source);
}

export async function getClaim({ id, source = "local" }) {
  const iri = claimIri(id);
  const triples = await sparql(`
SELECT DISTINCT ?nanopub ?predicate ?value WHERE {
  GRAPH ?h { ?nanopub np:hasAssertion ?a . }
  GRAPH ?a { <${iri}> ?predicate ?value . FILTER(?predicate != delphi:hasAssessment) }
}`, source);
  const rows = await sparql(`
SELECT DISTINCT ?assessment ?type ?score ?verdict ?confidence ?assessor ?parent ?summary ?nanopub WHERE {
  GRAPH ?h { ?nanopub np:hasAssertion ?a . }
  GRAPH ?a {
    <${iri}> delphi:hasAssessment ?assessment .
    ?assessment delphi:assessmentType ?type .
    OPTIONAL { ?assessment delphi:hasScore ?score }
    OPTIONAL { ?assessment delphi:hasVerdict ?verdict }
    OPTIONAL { ?assessment delphi:hasConfidence ?confidence }
    OPTIONAL { ?assessment prov:wasAttributedTo ?assessor }
    OPTIONAL { ?assessment dct:isPartOf ?parent }
    OPTIONAL { ?assessment dct:description ?summary }
  }
}`, source);
  if (!triples.length && !rows.length) return { claim: iri, found: false, source };

  const fields = {};
  for (const t of triples) (fields[compact(t.predicate)] ??= new Set()).add(t.value);
  const parents = new Map(rows.filter(r => !r.parent).map(r => [r.assessment, { ...r, dimensions: {} }]));
  for (const r of rows) if (r.parent) {
    const parent = parents.get(r.parent);
    if (parent) parent.dimensions[r.type.startsWith(`${parent.type}/`) ? r.type.slice(parent.type.length + 1) : r.type] = r.score;
  }
  return {
    claim: iri,
    source,
    nanopubs: [...new Set(triples.map(t => t.nanopub))],
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.size === 1 ? [...v][0] : [...v]])),
    assessments: [...parents.values()].map(({ parent, ...p }) => p),
  };
}

// Ranks claims by the mean overall score of their top-level assessments of one type, one score
// per assessor. Spread (max - min) shows how much the assessors disagree.
export async function rankClaims({ type, domain, minAssessors = 1, limit = 20, source = "local" }) {
  if (!type) {
    const { assessmentTypes } = await overview(source);
    return { error: "Pass `type`, one of the assessment types below.", assessmentTypes };
  }
  const rows = await sparql(`
SELECT DISTINCT ?claim ?assessment ?assessor ?score ?verdict WHERE {
  GRAPH ?g {
    ?claim delphi:hasAssessment ?assessment .
    ?assessment delphi:assessmentType ${lit(type)} ; delphi:hasScore ?score ; prov:wasAttributedTo ?assessor .
    OPTIONAL { ?assessment delphi:hasVerdict ?verdict }
    FILTER NOT EXISTS { ?assessment dct:isPartOf ?parent }
  }
}`, source);

  const byClaim = new Map();
  for (const r of rows) {
    const c = byClaim.get(r.claim) ?? byClaim.set(r.claim, { claim: r.claim, scores: new Map(), verdicts: {} }).get(r.claim);
    c.scores.set(r.assessor, r.score);
    if (r.verdict) c.verdicts[r.verdict] = (c.verdicts[r.verdict] ?? 0) + 1;
  }
  let ranked = [...byClaim.values()].map(c => {
    const s = [...c.scores.values()];
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    return { claim: c.claim, score: +mean.toFixed(4), assessors: s.length, spread: +(Math.max(...s) - Math.min(...s)).toFixed(4), verdicts: c.verdicts };
  }).filter(c => c.assessors >= minAssessors);

  if (ranked.length) {
    const info = await sparql(`
SELECT ?claim (SAMPLE(?label) AS ?title) (GROUP_CONCAT(DISTINCT STR(?notation); separator=" || ") AS ?math) (SAMPLE(STR(?d)) AS ?domain) WHERE {
  VALUES ?claim { ${ranked.map(c => `<${c.claim}>`).join(" ")} }
  GRAPH ?h { ?np np:hasAssertion ?a ; np:hasPublicationInfo ?p . }
  GRAPH ?a { ?claim a delphi:Claim ; rdfs:label ?label . OPTIONAL { ?claim skos:notation ?notation } }
  OPTIONAL { GRAPH ?p { ?np delphi:domain ?d . } }
} GROUP BY ?claim`, source);
    const byIri = new Map(info.map(i => [i.claim, i]));
    ranked = ranked.map(c => ({ ...c, ...byIri.get(c.claim) }));
    if (domain) ranked = ranked.filter(c => (c.domain ?? "").toLowerCase().includes(domain.toLowerCase()));
  }
  ranked.sort((a, b) => b.score - a.score || b.assessors - a.assessors);
  return ranked.slice(0, Math.min(Number(limit) || 20, 500)).map((c, i) => ({ rank: i + 1, ...c, math: c.math || undefined }));
}
