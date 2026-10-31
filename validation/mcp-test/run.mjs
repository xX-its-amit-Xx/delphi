// MCP test harness for the delphisci server. Calls every tool on the hosted server
// (https://delphisci-mcp.fly.dev/mcp) and on a local stdio copy (node mcp/server.mjs), checks
// answers against an independent parse of the repo files, and writes validation/mcp-test-results.json.
//   node validation/mcp-test/run.mjs
// Paced at >= 1.1 s between hosted requests (< 55/min, limit is 120/min).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, buildIndex, rankIndependent } from "./repo-index.mjs";

const HOST = process.env.MCP_URL ?? "https://delphisci-mcp.fly.dev/mcp";
const GAP_MS = 1100;
const TRUNC = 700;
const CLAIM = "https://w3id.org/delphi/resource/claim/";
let lastHosted = 0;
const pace = async () => { const w = lastHosted + GAP_MS - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); lastHosted = Date.now(); };

// LOCAL_REPO: which checkout the local comparator runs from (default: this working tree).
// LOCAL_LABEL / LOCAL_NOTE describe it in the output; OUT is the results file.
const ROOT = process.env.LOCAL_REPO ?? REPO;
const LABEL = process.env.LOCAL_LABEL ?? "working tree";
const OUT = process.env.OUT ?? join(REPO, "validation/mcp-test-results.json");
const t0 = Date.now();
console.error(`indexing ${ROOT} ...`);
const idx = buildIndex(ROOT);
const claimsJson = JSON.parse(readFileSync(join(ROOT, "docs/claims.json"), "utf8"));
let coverage = null; try { coverage = JSON.parse(readFileSync(join(ROOT, "organisms/merged/coverage.json"), "utf8")); } catch {}
console.error(`index: ${idx.files} files, ${idx.claims.size} claims (${Date.now() - t0} ms)`);

await pace();
const healthz = await (await fetch(HOST.replace(/\/mcp$/, "/healthz"))).json();

const hosted = new Client({ name: "delphi-validation", version: "0.1.0" });
await pace(); await hosted.connect(new StreamableHTTPClientTransport(new URL(HOST)));
const local = new Client({ name: "delphi-validation", version: "0.1.0" });
await local.connect(new StdioClientTransport({ command: process.execPath, args: [join(ROOT, "mcp/server.mjs")], cwd: ROOT }));

await pace();
const hostedTools = (await hosted.listTools()).tools;
const localTools = (await local.listTools()).tools;

async function call(client, name, args, isHosted) {
  if (isHosted) await pace();
  const t = performance.now();
  try {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 90_000 });
    const text = (r.content ?? []).map(c => c.text ?? "").join("");
    let json; try { json = JSON.parse(text); } catch {}
    return { ms: Math.round(performance.now() - t), isError: !!r.isError, text, json };
  } catch (e) {
    return { ms: Math.round(performance.now() - t), isError: true, protocolError: true, code: e.code, text: String(e.message ?? e) };
  }
}

const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const sameAnswer = (a, b) => {
  if (a.isError !== b.isError) return false;
  if (a.isError) return true;
  return canon(a.json) === canon(b.json);
};

// ---------- repo checks ----------
const C = id => idx.claims.get(id.startsWith("http") ? id : CLAIM + id);
function checkSearch(rows, { text, domain, mathOnly, limit = 20 }) {
  if (!Array.isArray(rows)) return "result is not an array";
  const issues = [];
  if (rows.length > limit) issues.push(`returned ${rows.length} > limit ${limit}`);
  for (const r of rows) {
    const c = idx.claims.get(r.claim);
    if (!c) { issues.push(`${r.claim} not a claim in repo files`); continue; }
    if (![...c.labels].includes(r.title)) issues.push(`${r.claim}: title differs from file`);
    if (text) {
      const hay = `${r.title} ${r.statement ?? ""} ${r.math ?? ""}`.toLowerCase();
      if (!hay.includes(text.toLowerCase())) issues.push(`${r.claim}: text "${text.slice(0, 20)}" not in returned title/statement/math`);
    }
    if (domain && !(r.domain ?? "").toLowerCase().includes(domain.toLowerCase())) issues.push(`${r.claim}: domain ${r.domain} lacks "${domain}"`);
    if (mathOnly && !r.math) issues.push(`${r.claim}: mathOnly but no math`);
    if (r.nanopub && !r.nanopub.startsWith("http") && ![...c.files].includes(r.nanopub)) issues.push(`${r.claim}: nanopub ${r.nanopub} is not the claim's file ${[...c.files]}`);
  }
  const expected = [...idx.claims].filter(([iri, c]) => {
    const hay = `${[...c.labels].join(" ")} ${[...c.desc].join(" ")} ${[...c.notation].join(" ")}`.toLowerCase();
    return (!text || hay.includes(text.toLowerCase())) && (!domain || [...c.domains].some(d => d.toLowerCase().includes(domain.toLowerCase()))) && (!mathOnly || c.notation.size) && c.labels.size;
  }).length;
  const want = Math.min(expected, limit);
  if (rows.length !== want) issues.push(`returned ${rows.length}, repo files give ${want} (of ${expected} matches)`);
  return issues.length ? issues.slice(0, 6).join("; ") : null;
}
function checkClaim(res, id) {
  const c = C(id);
  if (!c) return res.found === false ? null : `repo has no claim ${id} but server returned found!=false`;
  if (res.found === false) return `repo has claim ${id} (${[...c.files]}) but server says not found`;
  const f = res.fields ?? {};
  const issues = [];
  const one = v => (Array.isArray(v) ? v : [v]);
  if (canon(one(f["rdfs:label"]).sort()) !== canon([...c.labels].sort())) issues.push("label differs");
  if (canon(one(f["dct:description"] ?? []).sort()) !== canon([...c.desc].sort())) issues.push("description differs");
  if (canon(one(f["skos:notation"] ?? []).sort()) !== canon([...c.notation].sort())) issues.push("notation differs");
  const nAs = [...idx.asmt.values()].filter(a => a.claim === res.claim && !a.parent).length;
  if ((res.assessments ?? []).length !== nAs) issues.push(`assessments ${res.assessments?.length} vs repo top-level ${nAs}`);
  return issues.length ? issues.join("; ") : null;
}
function checkRank(rows, { type, limit = 20, minAssessors = 1 }) {
  if (!Array.isArray(rows)) return "result is not an array";
  const ind = rankIndependent(idx, type).rows.filter(r => r.assessors >= minAssessors);
  const issues = [];
  const byClaim = new Map(ind.map(r => [r.claim, r]));
  for (const r of rows) {
    const e = byClaim.get(r.claim);
    if (!e) { issues.push(`${r.claim} not ranked in repo`); continue; }
    if (Math.abs(e.score - r.score) > 1e-4 || e.assessors !== r.assessors || Math.abs(e.spread - r.spread) > 1e-4) issues.push(`${r.claim}: score/assessors/spread ${r.score}/${r.assessors}/${r.spread} vs repo ${e.score}/${e.assessors}/${e.spread}`);
  }
  for (let i = 1; i < rows.length; i++) if (rows[i].score > rows[i - 1].score) issues.push(`not sorted at rank ${i + 1}`);
  if (rows.length !== Math.min(limit, ind.length)) issues.push(`returned ${rows.length}, repo gives ${Math.min(limit, ind.length)}`);
  if (rows.length && Math.abs(rows[0].score - (ind[0]?.score ?? NaN)) > 1e-4) issues.push(`top score ${rows[0].score} vs repo ${ind[0]?.score}`);
  return issues.length ? issues.slice(0, 6).join("; ") : null;
}
function checkOrg(res, a) {
  if (!coverage) return "no coverage.json";
  const has = (v, n) => String(v ?? "").toLowerCase().includes(n.toLowerCase());
  const hits = coverage.taxa.filter(r => (!a.text || has(r.accepted_name, a.text) || has(r.slug, a.text)) && (!a.taxonClass || has(r.class, a.taxonClass))
    && (a.hasAxis ?? []).every(x => r.axes[x] > 0) && (a.missingAxis ?? []).every(x => !r.axes[x])
    && (a.minScore == null || r.score >= a.minScore) && (a.maxScore == null || r.score <= a.maxScore));
  const issues = [];
  if (res.generated !== coverage.generated) issues.push(`generated ${res.generated} vs file ${coverage.generated}`);
  if (res.matched !== hits.length) issues.push(`matched ${res.matched} vs coverage.json ${hits.length}`);
  if (a.groupBy) { const t = res.groups.reduce((s, g) => s + g.taxa, 0); if (t !== res.matched) issues.push(`group sum ${t} != matched`); }
  else {
    if (res.taxa.length !== Math.min(a.limit ?? 20, hits.length)) issues.push(`returned ${res.taxa.length}`);
    const key = a.sort === "mentions" ? "mentions" : "score";
    for (let i = 1; i < res.taxa.length; i++) if (res.taxa[i][key] > res.taxa[i - 1][key]) { issues.push(`not sorted by ${key}`); break; }
    for (const t of res.taxa) { const c = coverage.taxa.find(r => r.key === t.key); if (!c || c.score !== t.score) issues.push(`${t.key} score differs`); }
  }
  return issues.slice(0, 6).join("; ") || null;
}
function checkGraph(res, a) {
  const has = (v, n) => String(v ?? "").toLowerCase().includes(n.toLowerCase());
  const hits = claimsJson.claims.filter(c => (!a.text || has(`${c.label} ${c.statement} ${c.quote ?? ""}`, a.text)) && (!a.thinker || has(c.thinker, a.thinker))
    && (!a.status || c.status === a.status) && (a.yearFrom == null || c.year >= a.yearFrom) && (a.yearTo == null || c.year <= a.yearTo)
    && (a.minTruth == null || (c.truth != null && c.truth >= a.minTruth)));
  const issues = [];
  if (res.built !== claimsJson.built) issues.push(`built ${res.built} vs local docs/claims.json ${claimsJson.built}`);
  const replicable = Object.keys(a).every(k => ["text", "thinker", "status", "yearFrom", "yearTo", "minTruth", "limit", "sort", "groupBy"].includes(k));
  if (replicable && res.matched !== hits.length) issues.push(`matched ${res.matched} vs docs/claims.json ${hits.length}`);
  if (a.groupBy) {
    const total = (res.groups ?? []).reduce((s, g) => s + g.claims, 0);
    if (total !== res.matched) issues.push(`group counts sum ${total} != matched ${res.matched}`);
  } else {
    const lim = a.limit ?? 20;
    if (replicable && (res.claims ?? []).length !== Math.min(lim, hits.length)) issues.push(`returned ${res.claims?.length} vs ${Math.min(lim, hits.length)}`);
    if (a.sort === "disagreement") for (let i = 1; i < res.claims.length; i++) if ((res.claims[i].disagreement ?? -1) > (res.claims[i - 1].disagreement ?? -1)) issues.push("not sorted by disagreement");
    for (const c of res.claims ?? []) {
      const p = c.truthBy.map(x => x.p_true);
      const d = p.length > 1 ? +(Math.max(...p) - Math.min(...p)).toFixed(3) : null;
      if (d !== c.disagreement) issues.push(`${c.id}: disagreement ${c.disagreement} vs recomputed ${d}`);
    }
  }
  return issues.length ? issues.slice(0, 6).join("; ") : null;
}

// ---------- cases ----------
// expect: "ok" (should answer), "error" (should refuse with a clear error), "empty" (should answer with nothing found)
const LONG = "fixation ".repeat(1200);
const LONG_ID = "x".repeat(10_000);
const cases = [
  ["overview-default", "delphi_overview", {}, "ok", "repo:overview"],
  ["overview-local", "delphi_overview", { source: "local" }, "ok", "repo:overview"],
  ["overview-network", "delphi_overview", { source: "network" }, "ok", null],
  ["overview-bad-source", "delphi_overview", { source: "bogus" }, "error", null],
  ["overview-wrong-type", "delphi_overview", { source: 7 }, "error", null],
  ["overview-unknown-arg", "delphi_overview", { foo: "bar" }, "ok", null],

  ["search-fixation", "delphi_search_claims", { text: "fixation" }, "ok", "repo:search"],
  ["search-fixation-math", "delphi_search_claims", { text: "fixation", mathOnly: true }, "ok", "repo:search"],
  ["search-domain-math-limit5", "delphi_search_claims", { domain: "math", limit: 5 }, "ok", "repo:search"],
  ["search-latex-sqrt", "delphi_search_claims", { text: "\\sqrt", mathOnly: true, limit: 50 }, "ok", "repo:search"],
  ["search-empty-text", "delphi_search_claims", { text: "" }, "ok", "repo:search"],
  ["search-no-args", "delphi_search_claims", {}, "ok", "repo:search"],
  ["search-nomatch", "delphi_search_claims", { text: "zzqqxx-no-such-phrase" }, "empty", "repo:search"],
  ["search-long-10kB", "delphi_search_claims", { text: LONG }, "empty", null],
  ["search-quote-injection", "delphi_search_claims", { text: "\")) } UNION { BIND(1 AS ?x) } #" }, "empty", null],
  ["search-unicode", "delphi_search_claims", { text: "Wright–Fisher" }, "ok", "repo:search"],
  ["search-wrong-type-text", "delphi_search_claims", { text: 123 }, "error", null],
  ["search-limit-0", "delphi_search_claims", { text: "fixation", limit: 0 }, "error", null],
  ["search-limit-501", "delphi_search_claims", { text: "fixation", limit: 501 }, "error", null],
  ["search-limit-string", "delphi_search_claims", { text: "fixation", limit: "5" }, "error", null],
  ["search-network", "delphi_search_claims", { text: "fixation", source: "network" }, "ok", null],

  ["claim-short-id", "delphi_get_claim", { id: "fisher-kpp-speed" }, "ok", "repo:claim"],
  ["claim-full-iri", "delphi_get_claim", { id: CLAIM + "fisher-kpp-speed" }, "ok", "repo:claim"],
  ["claim-darwin", "delphi_get_claim", { id: "darwin1859-ch09-03" }, "ok", "repo:claim"],
  ["claim-unknown", "delphi_get_claim", { id: "no-such-claim-xyz" }, "notfound", "repo:claim"],
  ["claim-empty-id", "delphi_get_claim", { id: "" }, "notfound", null],
  ["claim-missing-id", "delphi_get_claim", {}, "error", null],
  ["claim-wrong-type", "delphi_get_claim", { id: 42 }, "error", null],
  ["claim-long-id-10k", "delphi_get_claim", { id: LONG_ID }, "notfound", null],
  ["claim-space-in-id", "delphi_get_claim", { id: "fisher kpp speed" }, "notfound", null],
  ["claim-iri-injection", "delphi_get_claim", { id: "x> ?p ?o } } #" }, "notfound", null],
  ["claim-case", "delphi_get_claim", { id: "FISHER-KPP-SPEED" }, "notfound", null],
  ["claim-network", "delphi_get_claim", { id: "fisher-kpp-speed", source: "network" }, "ok", null],

  ["rank-list-types", "delphi_rank_claims", {}, "ok", null],
  ["rank-dr010", "delphi_rank_claims", { type: "dataset-resolvability/0.1.0", limit: 10 }, "ok", "repo:rank"],
  ["rank-dr020-min2", "delphi_rank_claims", { type: "dataset-resolvability/0.2.0", minAssessors: 2, limit: 500 }, "ok", "repo:rank"],
  ["rank-domain-filter", "delphi_rank_claims", { type: "dataset-resolvability/0.1.0", domain: "darwin", limit: 5 }, "ok", null],
  ["rank-domain-filter-limit-first", "delphi_rank_claims", { type: "dataset-resolvability/0.2.0", domain: "wolfram", limit: 5 }, "ok", null],
  ["rank-unknown-type", "delphi_rank_claims", { type: "no-such-type/9.9" }, "empty", null],
  ["rank-empty-type", "delphi_rank_claims", { type: "" }, "ok", null],
  ["rank-long-type", "delphi_rank_claims", { type: "y".repeat(10_000) }, "empty", null],
  ["rank-quote-injection", "delphi_rank_claims", { type: "a\" ; ?p ?o . } #" }, "empty", null],
  ["rank-min-assessors-0", "delphi_rank_claims", { type: "dataset-resolvability/0.1.0", minAssessors: 0 }, "error", null],
  ["rank-wrong-type", "delphi_rank_claims", { type: ["dataset-resolvability/0.1.0"] }, "error", null],
  ["rank-network", "delphi_rank_claims", { type: "dataset-resolvability/0.1.0", source: "network" }, "ok", null],
  ["rank-dr020-local-top10", "delphi_rank_claims", { type: "dataset-resolvability/0.2.0", limit: 10 }, "ok", "repo:rank"],
  ["rank-dr020-network-top10", "delphi_rank_claims", { type: "dataset-resolvability/0.2.0", limit: 10, source: "network" }, "ok", null],

  ["graph-default", "delphi_graph", {}, "ok", "repo:graph"],
  ["graph-darwin-disagreement", "delphi_graph", { thinker: "darwin", sort: "disagreement", limit: 5 }, "ok", "repo:graph"],
  ["graph-group-thinker", "delphi_graph", { groupBy: "thinker" }, "ok", "repo:graph"],
  ["graph-proved", "delphi_graph", { status: "proved", limit: 500 }, "ok", "repo:graph"],
  ["graph-year-inverted", "delphi_graph", { yearFrom: 1950, yearTo: 1850 }, "empty", "repo:graph"],
  ["graph-min-truth-0.9", "delphi_graph", { minTruth: 0.9, limit: 500 }, "ok", "repo:graph"],
  ["graph-bad-status", "delphi_graph", { status: "bogus" }, "error", null],
  ["graph-bad-sort", "delphi_graph", { sort: "random" }, "error", null],
  ["graph-min-truth-2", "delphi_graph", { minTruth: 2 }, "error", null],
  ["graph-long-text", "delphi_graph", { text: LONG }, "empty", null],
  ["graph-wrong-type", "delphi_graph", { yearFrom: "1859" }, "error", null],
  ["graph-source-network", "delphi_graph", { source: "network", limit: 1 }, "error", null],

  ["graph-verification-lean", "delphi_graph", { verification: "lean", limit: 500 }, "ok", "repo:graph"],
  ["graph-theorem", "delphi_graph", { theorem: true, limit: 500 }, "ok", "repo:graph"],
  ["graph-bad-verification", "delphi_graph", { verification: "magic" }, "error", null],

  ["org-default", "delphi_organisms", {}, "ok", "repo:org"],
  ["org-overview", "delphi_organisms", { overview: true }, "ok", "repo:org-overview"],
  ["org-aves-genome-no-traits", "delphi_organisms", { taxonClass: "Aves", hasAxis: ["genome"], missingAxis: ["traits"], limit: 50 }, "ok", "repo:org"],
  ["org-group-class", "delphi_organisms", { groupBy: "class" }, "ok", "repo:org"],
  ["org-sort-mentions", "delphi_organisms", { sort: "mentions", limit: 5 }, "ok", "repo:org"],
  ["org-score-inverted", "delphi_organisms", { minScore: 80, maxScore: 10 }, "empty", "repo:org"],
  ["org-nomatch", "delphi_organisms", { text: "zzqqxx" }, "empty", "repo:org"],
  ["org-empty-text", "delphi_organisms", { text: "" }, "ok", "repo:org"],
  ["org-long-text", "delphi_organisms", { text: LONG }, "empty", null],
  ["org-bad-axis", "delphi_organisms", { hasAxis: ["telepathy"] }, "error", null],
  ["org-axis-not-array", "delphi_organisms", { hasAxis: "genome" }, "error", null],
  ["org-limit-1001", "delphi_organisms", { limit: 1001 }, "error", null],
  ["org-wrong-type", "delphi_organisms", { minScore: "50" }, "error", null],
  ["org-bad-sort", "delphi_organisms", { sort: "random" }, "error", null],
  ["org-source-network", "delphi_organisms", { source: "network", limit: 1 }, "error", null],

  ["getorg-slug", "delphi_get_organism", { id: "columba-livia" }, "ok", "repo:getorg"],
  ["getorg-gbif", "delphi_get_organism", { id: "gbif:2495414", includeMentions: false }, "ok", "repo:getorg"],
  ["getorg-name-upper", "delphi_get_organism", { id: "COLUMBA LIVIA" }, "ok", "repo:getorg"],
  ["getorg-vernacular", "delphi_get_organism", { id: "rock pigeon" }, "ok", "repo:getorg"],
  ["getorg-unknown", "delphi_get_organism", { id: "no-such-taxon-xyz" }, "notfound", null],
  ["getorg-empty", "delphi_get_organism", { id: "" }, "error", null],
  ["getorg-missing", "delphi_get_organism", {}, "error", null],
  ["getorg-wrong-type", "delphi_get_organism", { id: 2495414 }, "error", null],
  ["getorg-long", "delphi_get_organism", { id: LONG_ID }, "notfound", null],

  ["sparql-count-claims", "delphi_sparql", { query: "SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH ?a { ?c a delphi:Claim } }" }, "ok", "repo:sparql-count"],
  ["sparql-own-prefix", "delphi_sparql", { query: "PREFIX d: <https://w3id.org/delphi/ontology/> SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH ?a { ?c a d:Claim } }" }, "ok", "repo:sparql-count"],
  ["sparql-lowercase-prefix", "delphi_sparql", { query: "prefix d: <https://w3id.org/delphi/ontology/> SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH ?a { ?c a d:Claim } }" }, "ok", "repo:sparql-count"],
  ["sparql-PREFIX-in-literal", "delphi_sparql", { query: "SELECT ?c WHERE { GRAPH ?a { ?c rdfs:label ?l FILTER(CONTAINS(?l, \"PREFIX\")) } } LIMIT 1" }, "ok", null],
  ["sparql-ask", "delphi_sparql", { query: "ASK { GRAPH ?a { ?c a delphi:Claim } }" }, "ok", null],
  ["sparql-construct", "delphi_sparql", { query: "CONSTRUCT { ?c a delphi:Claim } WHERE { GRAPH ?a { ?c a delphi:Claim } } LIMIT 1" }, "ok", null],
  ["sparql-update-insert", "delphi_sparql", { query: "INSERT DATA { <urn:x> <urn:y> <urn:z> }" }, "error", null],
  ["sparql-empty", "delphi_sparql", { query: "" }, "error", null],
  ["sparql-missing", "delphi_sparql", {}, "error", null],
  ["sparql-malformed", "delphi_sparql", { query: "SELEKT * WHERE {" }, "error", null],
  ["sparql-wrong-type", "delphi_sparql", { query: 5 }, "error", null],
  ["sparql-long-comment", "delphi_sparql", { query: "SELECT ?x WHERE { BIND(1 AS ?x) } #" + "z".repeat(10_000) }, "ok", null],
  ["sparql-service-ssrf", "delphi_sparql", { query: "SELECT * WHERE { SERVICE <http://169.254.169.254/latest/meta-data/> { ?s ?p ?o } } LIMIT 1" }, "error", null],
  ["sparql-network", "delphi_sparql", { query: "SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?a { ?c a delphi:Claim } }", source: "network" }, "ok", null],
];

const repoChecks = {
  "repo:overview": j => {
    if (!j) return "no JSON";
    const issues = [];
    if (j.files !== idx.files) issues.push(`files ${j.files} vs repo ${idx.files}`);
    const total = j.domains.reduce((s, d) => s + d.claims, 0);
    if (total !== idx.claims.size) issues.push(`sum of per-domain claims ${total} vs repo claims ${idx.claims.size}`);
    return issues.join("; ") || null;
  },
  "repo:search": (j, a) => checkSearch(j, a),
  "repo:claim": (j, a) => checkClaim(j, a.id),
  "repo:rank": (j, a) => checkRank(j, a),
  "repo:graph": (j, a) => checkGraph(j, a),
  "repo:org": (j, a) => checkOrg(j, a),
  "repo:org-overview": j => {
    if (!coverage) return "no organisms/merged/coverage.json in local checkout";
    const issues = [];
    if (j.generated !== coverage.generated) issues.push(`generated ${j.generated} vs file ${coverage.generated}`);
    for (const ax of j.axes ?? []) { const n = coverage.taxa.filter(r => r.axes[ax.id] > 0).length; if (n !== ax.taxaCovered) issues.push(`${ax.id}: taxaCovered ${ax.taxaCovered} vs file ${n}`); }
    return issues.join("; ") || null;
  },
  "repo:getorg": (j, a) => {
    if (!coverage) return "no coverage.json";
    const issues = [];
    const cov = coverage.taxa.find(r => r.key === j.taxon?.key);
    if (!cov) return `taxon ${j.taxon?.key} not in coverage.json`;
    if (cov.score !== j.coverage?.score) issues.push(`score ${j.coverage?.score} vs file ${cov.score}`);
    if (j.datasets?.length !== cov.n_datasets) issues.push(`datasets returned ${j.datasets?.length} vs coverage n_datasets ${cov.n_datasets}`);
    if (j.mentions && j.mentions.length !== cov.mention_count) issues.push(`mentions returned ${j.mentions.length} vs coverage mention_count ${cov.mention_count}`);
    if (a.includeMentions === false && j.mentions !== undefined) issues.push("includeMentions=false but mentions present");
    return issues.join("; ") || null;
  },
  "repo:sparql-count": j => (j?.[0]?.n === idx.claims.size ? null : `count ${j?.[0]?.n} vs repo ${idx.claims.size}`),
};

function verdict(r, expect) {
  if (r.isError && /^MCP error -32602: Tool \S+ not found/.test(r.text)) return "fail: tool not exposed by this server";
  if (expect === "error") return r.isError ? (r.text && r.text.length > 5 ? "pass" : "fail: error with no message") : "fail: expected an error, got an answer";
  if (r.isError && expect !== "notfound") return `fail: ${r.protocolError ? "protocol error" : "tool error"}: ${r.text.slice(0, 160)}`;
  if (expect === "notfound" && r.isError) return /not found|no taxon|no match/i.test(r.text) && !/^MCP error -32602: Tool \S+ not found/.test(r.text) ? "pass" : `fail: unclear error for a not-found id: ${r.text.slice(0, 160)}`;
  if (r.json === undefined) return "fail: response is not JSON";
  if (expect === "empty" || expect === "notfound") {
    const j = r.json;
    const empty = (Array.isArray(j) && j.length === 0) || j?.found === false || j?.matched === 0;
    return empty ? "pass" : `fail: expected nothing found, got ${r.text.slice(0, 120)}`;
  }
  return "pass";
}

const records = [];
const full = {};
for (const [id, tool, args, expect, check] of cases) {
  process.stderr.write(`${id} ... `);
  const h = await call(hosted, tool, args, true);
  const l = await call(local, tool, args, false);
  full[id] = { h, l };
  const s = JSON.stringify(args);
  const rec = { id, tool, args: s.length > 300 ? `${s.slice(0, 300)}... (${s.length} chars)` : args, expect };
  for (const [k, r] of [["hosted", h], ["local", l]]) {
    const v = verdict(r, expect);
    const repo = check && !r.isError && r.json !== undefined ? repoChecks[check](r.json, args) : undefined;
    rec[k] = { ms: r.ms, isError: r.isError, protocolError: r.protocolError || undefined, verdict: v, repoCheck: check ? (repo ?? (r.isError ? "not run (error)" : "agrees")) : "n/a", size: r.text.length, rows: Array.isArray(r.json) ? r.json.length : undefined, response: r.text.length > TRUNC ? `${r.text.slice(0, TRUNC)}... (${r.text.length} chars)` : r.text };
  }
  rec.hostedEqualsLocal = sameAnswer(h, l);
  if (!rec.hostedEqualsLocal && Array.isArray(h.json) && Array.isArray(l.json)) {
    const key = x => x.claim ?? canon(x);
    const a = new Set(l.json.map(key)), b = new Set(h.json.map(key));
    rec.diff = { onlyLocal: [...a].filter(x => !b.has(x)).slice(0, 8), onlyHosted: [...b].filter(x => !a.has(x)).slice(0, 8) };
  }
  records.push(rec);
  console.error(`${rec.hosted.verdict.slice(0, 60)} | local ${rec.local.verdict.slice(0, 40)} | same=${rec.hostedEqualsLocal} ${h.ms}ms`);
}

// ---------- local CLI, same queries, compared at full size ----------
const cli = (...a) => { const t = performance.now(); try { const out = execFileSync(process.execPath, [join(ROOT, "mcp/cli.mjs"), ...a], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }); return { ms: Math.round(performance.now() - t), ok: true, json: JSON.parse(out) }; } catch (e) { return { ms: Math.round(performance.now() - t), ok: false, text: String(e.stderr || e.message).slice(0, 300) }; } };
const cliCases = [
  ["overview-default", ["overview"]],
  ["search-fixation-math", ["search", "fixation", "--math-only"]],
  ["claim-short-id", ["claim", "fisher-kpp-speed"]],
  ["rank-dr010", ["rank", "dataset-resolvability/0.1.0", "--limit", "10"]],
  ["graph-darwin-disagreement", ["graph", "--thinker", "darwin", "--sort", "disagreement", "--limit", "5"]],
  ["graph-group-thinker", ["graph", "--group-by", "thinker"]],
  ["sparql-count-claims", ["sparql", "SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH ?a { ?c a delphi:Claim } }"]],
  ["claim-unknown", ["claim", "no-such-claim-xyz"]],
];
const cliRecords = [];
for (const [caseId, argv] of cliCases) {
  const r = cli(...argv);
  const f = full[caseId];
  cliRecords.push({ case: caseId, argv: ["node", "mcp/cli.mjs", ...argv], ms: r.ms, ok: r.ok, error: r.text,
    rows: Array.isArray(r.json) ? r.json.length : undefined,
    equalsLocalMcp: f ? canon(r.json) === canon(f.l.json) : "n/a",
    equalsHosted: f ? canon(r.json) === canon(f.h.json) : "n/a",
    response: r.json ? JSON.stringify(r.json).slice(0, 400) : undefined });
}

// ---------- raw HTTP protocol checks ----------
const raw = async (label, init) => {
  await pace();
  const t = performance.now();
  try {
    const res = await fetch(HOST, init);
    const body = await res.text();
    return { label, status: res.status, ms: Math.round(performance.now() - t), body: body.slice(0, 300) };
  } catch (e) { return { label, error: String(e.message ?? e), ms: Math.round(performance.now() - t) }; }
};
const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const protocol = [
  await raw("GET /mcp", { method: "GET" }),
  await raw("POST invalid JSON", { method: "POST", headers: H, body: "{not json" }),
  await raw("POST unknown method", { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "no/such" }) }),
  await raw("POST tools/call unknown tool, no initialize", { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "delphi_nope", arguments: {} } }) }),
  await raw("POST tools/list, no initialize", { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" }) }),
  await raw("POST tools/list without Accept header", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }) }),
  await raw("POST 1.5 MB body", { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list", params: { pad: "p".repeat(1_500_000) } }) }),
];
const unknownTool = { hosted: await call(hosted, "delphi_nope", {}, true), local: await call(local, "delphi_nope", {}, false) };

await hosted.close(); await local.close();

const ok = v => ["agrees", "n/a", "not run (error)"].includes(v);
const toolNames = hostedTools.map(t => t.name);
const out = {
  generated: new Date().toISOString(),
  host: HOST,
  healthz,
  local: { label: LABEL, root: ROOT, note: process.env.LOCAL_NOTE ?? "", commit: process.env.LOCAL_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim() },
  repo: { trigFiles: idx.files, claims: idx.claims.size, claimsJsonBuilt: claimsJson.built, gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim() },
  tools: {
    hosted: hostedTools.map(t => ({ name: t.name, params: Object.keys(t.inputSchema?.properties ?? {}) })),
    local: localTools.map(t => ({ name: t.name, params: Object.keys(t.inputSchema?.properties ?? {}) })),
    schemasIdentical: canon(hostedTools) === canon(localTools),
  },
  summary: Object.fromEntries(toolNames.map(n => {
    const rs = records.filter(r => r.tool === n);
    return [n, { cases: rs.length, hostedFail: rs.filter(r => !r.hosted.verdict.startsWith("pass")).length, localFail: rs.filter(r => !r.local.verdict.startsWith("pass")).length,
      hostedRepoDisagree: rs.filter(r => !ok(r.hosted.repoCheck)).length, localRepoDisagree: rs.filter(r => !ok(r.local.repoCheck)).length, hostedNotLocal: rs.filter(r => !r.hostedEqualsLocal).length }];
  })),
  cases: records, cli: cliRecords, protocol,
  unknownTool: { hosted: { ...unknownTool.hosted, json: undefined }, local: { ...unknownTool.local, json: undefined } },
  wallSeconds: Math.round((Date.now() - t0) / 1000),
};
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.error(JSON.stringify(out.summary, null, 1), out.wallSeconds, "s");
