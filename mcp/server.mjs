#!/usr/bin/env node
// MCP server exposing delphisci claims, their math, their assessment rankings and the claim graph.
// Runs over stdio, or over Streamable HTTP at /mcp when DELPHI_HTTP_PORT is set (see mcp/http.mjs).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GROUP_KEYS, SORT_KEYS, browseClaims } from "./graph.mjs";
import { NETWORK_ENDPOINT, PREFIXES, getClaim, overview, rankClaims, searchClaims, sparql } from "./lib.mjs";
import { LEAN_TOOLS } from "../sim-engine/tools/lean-tools.mjs";
import { LEANBIO_TOOLS } from "../pipeline/leanbio/tools.mjs";
import { OMICS_TOOLS } from "../sim-engine/tools/omics-tools.mjs";
import { VALIDATE_TOOLS } from "../sim-engine/tools/validate-tools.mjs";

const TOOLS = [];
export const VERSION = "0.6.0";
// Hosted (HTTP) mode never offers tools that run a Lean build or write files.
const HOSTED = !!process.env.DELPHI_HTTP_PORT;

export function createServer() {
  const server = new McpServer({ name: "delphisci", version: VERSION });
  for (const [name, description, inputSchema, fn] of TOOLS) {
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true } }, async args => {
      try { return json(await fn(args)); }
      catch (e) { return { isError: true, content: [{ type: "text", text: String(e?.message ?? e) }] }; }
    });
  }
  return server;
}

const source = z.enum(["local", "network"]).default("local").describe(
  `"local" = TriG files in this repo, including unpublished drafts and assessments. "network" = what is published, via ${NETWORK_ENDPOINT}.`);

const json = data => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const tool = (...spec) => TOOLS.push(spec);

tool("delphi_overview",
  "Start here. Counts claims per domain (and how many carry math in skos:notation), and lists the assessment types you can rank by.",
  { source },
  ({ source }) => overview(source));

tool("delphi_search_claims",
  "Find claims by text (matched against title, statement and math) and/or domain. Returns each claim's IRI, title, statement, LaTeX math and nanopub.",
  {
    text: z.string().optional().describe("Case-insensitive substring, e.g. \"fixation\" or \"\\\\sqrt\""),
    domain: z.string().optional().describe("Substring of the domain IRI, e.g. \"math\", \"turing\", \"darwin\""),
    mathOnly: z.boolean().default(false).describe("Only claims that have a formal statement (skos:notation)"),
    limit: z.number().int().min(1).max(500).default(20),
    source,
  },
  searchClaims);

tool("delphi_get_claim",
  "Everything about one claim: all assertion fields (statement, math, assumptions/context, proposed test, sources) plus every assessment with its per-dimension scores.",
  {
    id: z.string().describe("Claim IRI or its short id, e.g. \"fisher-kpp-speed\" or \"darwin1859-ch09-03\""),
    source,
  },
  getClaim);

tool("delphi_rank_claims",
  "Rank claims by an assessment type: mean overall score across assessors (one score per assessor), with assessor count, spread (max - min, i.e. disagreement) and verdict counts. Omit `type` to list the available types.",
  {
    type: z.string().optional().describe("Assessment type, e.g. \"dataset-resolvability/0.1.0\""),
    domain: z.string().optional().describe("Substring of the domain IRI"),
    minAssessors: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(500).default(20),
    source,
  },
  rankClaims);

tool("delphi_graph",
  "The claim graph from docs/claim-graph.html: every claim (including drafts) with thinker, year, work, proof status, testability and model truth scores (p_true per model, mean `truth`, `disagreement` = max - min). Filter, then sort or group by thinker/decade/status. Not nanopub-backed: truth scores are unpublished; `built` says when the snapshot was made.",
  {
    text: z.string().optional().describe("Case-insensitive substring of title, statement or quote"),
    thinker: z.string().optional().describe("Substring, e.g. \"darwin\", \"turing\""),
    work: z.string().optional().describe("Substring of the work title"),
    status: z.enum(["untested", "proved", "partial", "refuted"]).optional(),
    kind: z.string().optional().describe("Substring of the claim kind, e.g. \"mechanism\", \"theorem\""),
    yearFrom: z.number().int().optional(),
    yearTo: z.number().int().optional(),
    minTruth: z.number().min(0).max(1).optional(),
    maxTruth: z.number().min(0).max(1).optional(),
    minTruthAssessors: z.number().int().min(0).default(0).describe("Only claims scored by at least this many models"),
    published: z.boolean().optional().describe("true = only claims on the production nanopub registry; false = only unpublished/test"),
    sort: z.enum(SORT_KEYS).default("truth").describe("truth (high first), truth-asc, disagreement, testability, year"),
    groupBy: z.enum(GROUP_KEYS).optional().describe("Return per-group counts and means instead of claims"),
    limit: z.number().int().min(1).max(500).default(20),
  },
  browseClaims);

tool("delphi_sparql",
  `Run a read-only SPARQL SELECT. Nanopubs are named graphs: join GRAPH ?h { ?np np:hasAssertion ?a } with GRAPH ?a { ... }. These prefixes are added if the query has none:\n${PREFIXES}`,
  { query: z.string(), source },
  ({ query, source }) => sparql(query, source));

// ── Lean laws ──────────────────────────────────────────────────────────────
// Handlers and descriptions come from sim-engine/tools/lean-tools.mjs, which reads every law through the one
// loader lib/lean-source.mjs (lean/registry/, or lean/laws.json + constraints.json until it exists). Results
// are the provenance envelope { result, provenance, scope }. lean/registry/check-exposed.mjs fails if a law
// is missing here.
const leanT = Object.fromEntries(LEAN_TOOLS.map(t => [t.name, t]));
const lawStatus = z.enum(["proposed", "candidate", "accepted", "contested", "retired"]);
const leanTool = (name, shape) => tool(name, leanT[name].description, shape, args => leanT[name].handler(args));

leanTool("lean_laws_list", {
  kind: z.enum(["physical", "biological"]).optional(),
  status: z.union([lawStatus, z.array(lawStatus)]).optional().describe("One status or a list"),
  scope: z.string().optional().describe("Substring of the law level or scope, e.g. \"genotype\""),
  lawset: z.string().optional().describe("Only laws in this lawset version, or \"current\""),
  text: z.string().optional().describe("Substring of law_id, label or statement"),
});
leanTool("lean_law_get", {
  id: z.string().describe("law_id from lean_laws_list, e.g. \"kimura-substitution-rate\""),
  version: z.string().optional().describe("A specific (e.g. archived) law version; omit for the current one"),
});
leanTool("lean_lawset_get", { version: z.string().default("current").describe("Semver, or \"current\"") });
leanTool("lean_check", {
  design: z.record(z.string(), z.any()).optional().describe("SI-unit design: SL_m, mass_kg, finArea_m2, CLmax, airspeed_m_s, genotype_edits, ..."),
  spec: z.record(z.string(), z.any()).optional().describe("Alias of design"),
  lawset: z.string().default("current"),
});
leanTool("lean_verify", {});
// Self-update: where the laws come from (local files, or a remote mirror/github ref re-checked every TTL), and
// what changed between lawsets. See lean/registry/SELF-UPDATE.md.
leanTool("lean_source_status", {
  refresh: z.boolean().optional().describe("Check the remote now instead of waiting for the TTL (at most once per 30 s)"),
});
leanTool("lean_changes", {
  since_version: z.string().optional().describe("Lawset version you last saw, e.g. \"1.3.0\" (exclusive), or \"current\"; omit for all releases"),
});
if (!HOSTED) leanTool("lean_propose", {
  file: z.string().optional().describe("Path to a .lean file"),
  source: z.string().optional().describe("Lean source text, if no file"),
  meta: z.record(z.string(), z.any()).default({}).describe("law_id, kind, statement_en, hypotheses, sources (see lean/registry/README.md)"),
});

// LeanBio: the formalization queue, grounding, and per-claim records (pipeline/leanbio/). Read-only; leanbio_ground
// calls Gilda / MyGene.info / OLS4 on a cache miss unless offline is set. In hosted mode it is forced offline so the
// public server makes no outbound calls on behalf of anonymous clients and never writes the cache.
const lb = Object.fromEntries(LEANBIO_TOOLS.map(t => [t.name, t]));
tool("leanbio_queue", lb.leanbio_queue.description, {
  limit: z.number().int().min(1).max(500).default(20),
  min_belief: z.number().min(0).max(1).optional().describe("Only items at or above this belief"),
  relation: z.string().optional().describe("Relation type, e.g. ScalingLaw, Bound, Equality, Dynamics, Inhibition"),
  origin: z.enum(["claim", "draft"]).optional(),
}, args => lb.leanbio_queue.handler(args));
tool("leanbio_ground", lb.leanbio_ground.description, {
  text: z.string().optional().describe("Free text to annotate"),
  entity: z.string().optional().describe("One entity name or identifier, instead of text"),
  kind: z.enum(["any", "gene", "taxon"]).default("any"),
  context: z.string().optional().describe("Context for an entity, e.g. \"zebrafish\""),
  offline: z.boolean().default(false).describe("Answer from the cache only"),
}, args => lb.leanbio_ground.handler({ ...args, offline: HOSTED ? true : args.offline }));
tool("leanbio_claim", lb.leanbio_claim.description, {
  id: z.string().describe("Claim id (docs/claims.json), e.g. \"maynardsmith-hitchhiking\", or \"draft:<repo path>\""),
  draft: z.boolean().default(true).describe("Include the unsigned nanopub draft (TriG)"),
}, args => lb.leanbio_claim.handler(args));

// Multi-omics cards (sim-engine/tools/omics-tools.mjs over omics/index/, shipped in the image and the npm package).
// Proxy-species data, kind borrowed; absence means not recorded.
const om = Object.fromEntries(OMICS_TOOLS.map(t => [t.name, t]));
const omicsLayer = z.enum(["genomic", "transcriptomic", "proteomic", "pathway", "ptm"]);
tool("omics_gene", om.omics_gene.description, {
  symbol: z.string().optional().describe("ZFIN symbol (e.g. kcnk5b), ZDB-GENE id, or human orthologue symbol (e.g. KCNK5)"),
  id: z.string().optional().describe("Alias of symbol"),
  layers: z.array(omicsLayer).optional().describe("Only these layers (default all)"),
  features: z.array(z.string()).optional().describe("Only these features, e.g. allele_phenotype, expressed_in"),
}, args => om.omics_gene.handler(args));
tool("omics_part", om.omics_part.description, {
  part_id: z.string().describe("UBERON:xxxxxxx or CL:xxxxxxx (underscore form accepted)"),
  layer: omicsLayer.optional(),
  limit: z.number().optional().describe("Max genes returned (default 100)"),
}, args => om.omics_part.handler(args));
tool("omics_search", om.omics_search.description, {
  term: z.string().describe("e.g. \"pectoral fin\", \"GO:0030326\", \"Wnt signaling\""),
  feature: z.string().optional(),
  layer: omicsLayer.optional(),
  limit: z.number().optional().describe("Max matching terms (default 25)"),
}, args => om.omics_search.handler(args));

// The design score (scorer v1.0.0, weights frozen: sim-engine/validate/score-weights.json and
// SCORER-PREREGISTRATION.md). In hosted mode network and BLAST are forced off: the public server answers from its
// shipped data and cache, makes no outbound calls for anonymous clients, and never runs minutes-long BLAST jobs.
const dsc = VALIDATE_TOOLS.find(t => t.name === "design_score");
tool("design_score", dsc.description, {
  organism: z.union([z.string(), z.record(z.string(), z.any())]).optional().describe("A repository organism/design id (zebrafish-adult, flying-fish, winged-zebrafish, tff, ...) or an inline organism document"),
  specimen: z.record(z.string(), z.any()).optional().describe("Instead of an organism: a raw specimen record {SL_m, mass_kg, depth_SL, ...}"),
  ageDays: z.number().optional(),
  conditions: z.record(z.string(), z.any()).optional(),
  exclude: z.array(z.string()).optional().describe("Reference ids or groups to leave out of the nearest-neighbour search"),
  reference_set_excluding: z.array(z.string()).optional().describe("Leave-out scoring (e.g. organism:zebrafish); use it whenever the design IS a real organism"),
  containment: z.array(z.record(z.string(), z.any())).optional().describe("partedit.js containment results [{part, refused}]"),
  network: z.boolean().optional().describe("Allow cached network calls (forced off on the hosted server)"),
  blast: z.boolean().optional().describe("Run NCBI BLAST for genes without an alignment (forced off on the hosted server)"),
  lawset: z.string().optional(),
  taxon: z.string().optional(),
  label: z.string().optional(),
  spec: z.record(z.string(), z.any()).optional().describe("Optional DesignSpec for the S component"),
}, args => dsc.handler(HOSTED ? { ...args, network: false, blast: false } : args));

if (process.env.DELPHI_HTTP_PORT) {
  const { serveHttp } = await import("./http.mjs");
  serveHttp(createServer, Number(process.env.DELPHI_HTTP_PORT), VERSION);
} else {
  await createServer().connect(new StdioServerTransport());
}
