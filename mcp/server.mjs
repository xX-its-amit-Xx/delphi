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
import { CAPABILITY_TOOLS } from "../pipeline/leanbio/capability-map/tools.mjs";
import { OMICS_TOOLS } from "../sim-engine/tools/omics-tools.mjs";
import { VALIDATE_TOOLS } from "../sim-engine/tools/validate-tools.mjs";
import { PIPELINE_TOOLS } from "../sim-engine/tools/pipeline-tools.mjs";
import { FUNCTIONAL_TOOLS } from "../sim-engine/tools/functional-tools.mjs";
import { PHYSICS_TOOLS } from "../sim-engine/tools/physics-tools.mjs";
import { EDITPLAN_TOOLS } from "../sim-engine/tools/editplan-tools.mjs";
import { SPEC_TOOLS } from "../sim-engine/tools/spec-tools.mjs";
import { OPENQ_TOOLS } from "../lean/registry/open-questions/openq-tools.mjs";

const TOOLS = [];
// Exported so mcp/cli.mjs can call any registered tool by name without duplicating the policy above
// (hosted network/BLAST forcing, the local-only exclusions). [name, description, inputSchema, fn].
export { TOOLS };
export const VERSION = "0.8.1";
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
    source: z.enum(["local"]).default("local").describe(
      "Only \"local\": this tool reads the docs/claims.json snapshot in the repo, drafts included. It has no network source; use `published` to filter by registry."),
  },
  browseClaims);

tool("delphi_sparql",
  `Run a read-only SPARQL query: SELECT (rows), ASK ({ boolean }), CONSTRUCT or DESCRIBE ({ triples } as N-Triples). Nanopubs are named graphs: join GRAPH ?h { ?np np:hasAssertion ?a } with GRAPH ?a { ... }. These prefixes are added when the query declares none of its own:\n${PREFIXES}`,
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

// The LeanBio capability map (pipeline/leanbio/capability-map/): who could use Lean for Bio, the concrete jobs
// they would bring, the grand questions split into what a proof can settle and what only measurement can, and the
// tools that do not exist yet. Read-only, no network, no writes, so these are served in hosted mode unchanged.
const cap = Object.fromEntries(CAPABILITY_TOOLS.map(t => [t.name, t]));
tool("leanbio_personas", cap.leanbio_personas.description, {
  id: z.string().optional().describe("One persona by id, e.g. \"reviewer-editor\""),
  text: z.string().optional().describe("Only personas whose name, who, today or would_ask mention this text"),
  needs_tool: z.string().optional().describe("Only personas who need this tool name (real or proposed)"),
  status: z.enum(["EXISTS", "PARTIAL", "MISSING"]).optional(),
  brief: z.boolean().default(false).describe("Name, who and tool statuses only"),
}, args => cap.leanbio_personas.handler(args));
tool("leanbio_use_cases", cap.leanbio_use_cases.description, {
  id: z.string().optional(),
  persona: z.string().optional().describe("Only use cases for this persona id"),
  answerable: z.enum(["yes", "partly", "no"]).optional(),
  tool: z.string().optional().describe("Only use cases whose sequence names this tool"),
  uses_gap: z.string().optional().describe("Only use cases waiting on this tool-gap id"),
  uncomfortable: z.boolean().optional(),
  worked_only: z.boolean().default(false),
  text: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
}, args => cap.leanbio_use_cases.handler(args));
tool("leanbio_grand_questions", cap.leanbio_grand_questions.description, {
  id: z.string().optional().describe("One question by id, e.g. \"gq-hamiltons-rule\""),
  disputed: z.boolean().optional().describe("Only the questions the literature actively disagrees about"),
  has_repo_asset: z.boolean().optional(),
  core_strength: z.enum(["strong", "moderate", "narrow"]).optional(),
  section: z.enum(["core", "remainder", "in_repo", "tools", "all"]).default("all"),
  with_citations: z.boolean().default(true),
}, args => cap.leanbio_grand_questions.handler(args));
tool("leanbio_tool_gap", cap.leanbio_tool_gap.description, {
  id: z.string().optional(),
  kind: z.enum(["tool", "lean-module", "data", "integration"]).optional(),
  effort: z.enum(["small", "medium", "large", "research"]).optional(),
  buildable_now: z.boolean().optional(),
  unblocks_persona: z.string().optional(),
  unblocks_question: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(30),
  include_not_gaps: z.boolean().default(true),
}, args => cap.leanbio_tool_gap.handler(args));

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

// -- The validation framework: what a collaborator runs a generated design through --------------------
// ONE entry point (validate_generation) plus the components it is made of, so a collaborator can also call any
// single one while iterating. The decision per tool, with the reasoning, is in mcp/README.md; the two standing
// hosted rules are enforced here rather than documented: `network` is forced FALSE and `blast` forced FALSE for
// anonymous callers, so the public server makes no outbound call and starts no minutes-long BLAST job on their
// behalf; and nothing that runs a Lean build or writes a file is registered at all.
const vt = Object.fromEntries(VALIDATE_TOOLS.map(t => [t.name, t]));
const st = Object.fromEntries(SPEC_TOOLS.map(t => [t.name, t]));
const ep = Object.fromEntries(EDITPLAN_TOOLS.map(t => [t.name, t]));
const oq = Object.fromEntries(OPENQ_TOOLS.map(t => [t.name, t]));

const ORGANISM = z.union([z.string(), z.record(z.string(), z.any())]).optional().describe(
  "A repository organism/design id (zebrafish-adult, flying-fish, winged-zebrafish, tff, wingless-flying-fish, ff-zf-chimera, ...) or an inline organism document.");
const SPECIMEN = z.record(z.string(), z.any()).optional().describe("Instead of an organism: a raw specimen record {SL_m, mass_kg, depth_SL, ...}.");
const EXCLUDING = z.array(z.string()).optional().describe('Leave-out entries for the reference set (ids, "species:", "family:", "order:", "organism:"); use it whenever the design IS a real organism.');
// network and blast are declared so a LOCAL caller (stdio, no DELPHI_HTTP_PORT) can still turn them on; hosted
// callers get them forced off whatever they send.
const NETWORK = z.boolean().optional().describe("Allow cached network lookups. FORCED OFF on the hosted server.");
const BLAST = z.boolean().optional().describe("Run NCBI BLAST for genes with no shipped alignment (minutes). FORCED OFF on the hosted server.");
const offline = args => (HOSTED ? { ...args, network: false, blast: false } : args);

// THE entry point. Generated + base + the desired phenotype as text -> five named results, five gates, a verdict
// sentence. Hosted: network off, so the sequence basis can only ever be `document-only` or `supplied`.
const pipe = PIPELINE_TOOLS[0];
tool("validate_generation", pipe.description, {
  desired_phenotype: z.string().describe("The desired phenotype as free text -- the same prompt the generator was given. Whatever cannot be parsed comes back verbatim and is marked UNCHECKED."),
  generated: z.union([z.string(), z.record(z.string(), z.any())]).describe("The generated organism: a design id, an inline organism document, or a FASTA / plain sequence string."),
  base: z.union([z.string(), z.record(z.string(), z.any())]).describe('The base organism, in any of the same forms (e.g. "zebrafish-adult").'),
  network: NETWORK,
  lawset: z.string().optional(),
  ageDays: z.number().optional(),
  conditions: z.record(z.string(), z.any()).optional(),
  reference_set_excluding: EXCLUDING,
  extra_genes: z.array(z.string()).optional().describe("Extra gene symbols for the multi-scale sweep."),
}, args => pipe.handler(offline(args)));

// The fourth named result on its own.
const fr = FUNCTIONAL_TOOLS[0];
tool("functional_resolution", fr.description, {
  organism: ORGANISM,
  desired_phenotype: z.string().optional().describe("The desired function as free text: it is the signal that chooses the analogue. Omit it and the function is INFERRED, and the ledger says so."),
  spec: z.record(z.string(), z.any()).optional().describe("A DesignSpec instead of (or beside) the text; build one with parse_design_text."),
  pectoral_len_over_SL: z.number().optional(),
  ageDays: z.number().optional(),
  conditions: z.record(z.string(), z.any()).optional(),
  network: NETWORK,
  lawset: z.string().optional(),
  reference_set_excluding: EXCLUDING,
}, args => fr.handler(offline(args)));

// The fifth named result on its own. No network at any point; `draws` is capped on the hosted server so one
// anonymous call cannot spend unbounded CPU on the shared host.
const pc = PHYSICS_TOOLS[0];
tool("physics_check", pc.description, {
  organism: ORGANISM,
  specimen: SPECIMEN,
  spec: z.record(z.string(), z.any()).optional().describe("A DesignSpec. AUTHORITATIVE when given: that IS the desired function. Build one with parse_design_text."),
  ageDays: z.number().optional(),
  conditions: z.record(z.string(), z.any()).optional(),
  draws: z.number().int().min(0).max(2000).optional().describe("Ensemble draws per criterion per stage (default 200; 0 switches the ensemble off). Capped at 500 on the hosted server."),
  seed: z.string().optional(),
  ensemble: z.boolean().optional(),
  launch_height_m: z.number().optional(),
}, args => pc.handler(HOSTED ? { ...args, draws: Math.min(args.draws ?? 200, 500) } : args));

// The aerodynamics on its own, for an animal physics_check cannot reach. No network, no writes, pure
// arithmetic over declared inputs and one sourced coefficient, so it is served hosted unchanged.
const fsc = PHYSICS_TOOLS.find(t => t.name === "flight_support_check");
tool("flight_support_check", fsc.description, jsonShape(fsc.inputSchema), args => fsc.handler(args));

// The components of the report, each callable alone.
tool("validate_design", vt.validate_design.description, {
  organism: ORGANISM, specimen: SPECIMEN, ageDays: z.number().optional(), conditions: z.record(z.string(), z.any()).optional(),
  exclude: EXCLUDING, containment: z.array(z.record(z.string(), z.any())).optional(),
  network: NETWORK, blast: BLAST, lawset: z.string().optional(), version: z.string().optional(),
  spec: z.record(z.string(), z.any()).optional(),
  made_under_lawset: z.string().optional(), second_round: z.boolean().optional(),
  swarm: z.boolean().optional().describe("Also return the six validation sub-tasks as JSON, for a collaborator swarm to claim."),
}, args => vt.validate_design.handler(offline(args)));
tool("closest_relative_phenotype", vt.closest_relative_phenotype.description, {
  organism: ORGANISM, specimen: SPECIMEN, ageDays: z.number().optional(), conditions: z.record(z.string(), z.any()).optional(),
  exclude: EXCLUDING, k: z.number().int().min(1).max(50).optional(),
}, args => vt.closest_relative_phenotype.handler(args));
tool("closest_relative_genotype", vt.closest_relative_genotype.description, {
  organism: z.union([z.string(), z.record(z.string(), z.any())]).describe("A design id or an inline organism document carrying gene-level edits."),
  network: NETWORK, blast: BLAST,
}, args => vt.closest_relative_genotype.handler(offline(args)));
tool("sanity_check_design", vt.sanity_check_design.description, {
  organism: ORGANISM, specimen: SPECIMEN, ageDays: z.number().optional(), conditions: z.record(z.string(), z.any()).optional(),
  containment: z.array(z.record(z.string(), z.any())).optional(), network: NETWORK,
  family: z.enum(["genotype", "phenotype", "both"]).optional(),
}, args => vt.sanity_check_design.handler(offline(args)));
tool("lean_by_component", vt.lean_by_component.description, {
  organism: z.union([z.string(), z.record(z.string(), z.any())]).describe("A design id or an inline organism document."),
  ageDays: z.number().optional(), conditions: z.record(z.string(), z.any()).optional(), lawset: z.string().optional(), network: NETWORK,
}, args => vt.lean_by_component.handler(offline(args)));
tool("validate_swarm_tasks", vt.validate_swarm_tasks.description, {
  organism: ORGANISM, specimen: SPECIMEN, exclude: EXCLUDING,
}, args => vt.validate_swarm_tasks.handler(args));

// parse_design_text turns a desired-phenotype sentence into the DesignSpec that physics_check and
// functional_resolution take as `spec`. Pure text parsing: no file read, no network, no write.
tool("parse_design_text", st.parse_design_text.description, {
  text: z.string().describe("The desired phenotype in plain language."),
}, args => st.parse_design_text.handler(args));

// edit_plan_methods: static text (the scoring rules, the off-target method, the feasibility citations and the
// falsifier list). edit_plan itself is NOT hosted -- see mcp/README.md.
tool("edit_plan_methods", ep.edit_plan_methods.description, {}, args => ep.edit_plan_methods.handler(args));

// The open-question guard. Read-only over lean/registry/open-questions/.
const oqStatus = z.enum(["open", "settled", "abandoned"]);
tool("lean_open_questions", oq.lean_open_questions.description, {
  status: z.union([oqStatus, z.array(oqStatus)]).optional().describe("One status or a list. Default: all."),
  formalised: z.boolean().optional().describe("true: only questions with at least one arm formalised in Lean."),
  touches: z.string().optional().describe('A law_id, constraint id, design property or scenario key the question bears on, e.g. "perturb-depth-cap", "adult_mass".'),
  text: z.string().optional().describe("Substring of question_id, statement or an arm statement."),
  include_failed: z.boolean().optional().describe("Include failed theorems and requirement records. Default true."),
}, args => oq.lean_open_questions.handler(args));
tool("lean_open_question", oq.lean_open_question.description, {
  id: z.string().describe('question_id (e.g. "oq-kcnk5b-vm-sign"), failure_id (e.g. "ft-glider-interface-convergence") or requirement_id.'),
  recompute: z.boolean().optional().describe("Recompute the belief proportion from the arms' evidence and return it beside the stored one, so the number can be checked rather than trusted."),
}, args => oq.lean_open_question.handler(args));
tool("lean_open_question_guard", oq.lean_open_question_guard.description, {
  law_id: z.string().optional(),
  statement_en: z.string().optional().describe("The law's plain-English statement, as it would be written."),
  lean_theorem: z.string().optional().describe("Fully qualified theorem name, if there is one."),
  lean_structure: z.string().optional().describe("Fully qualified hypothesis structure name, if there is one."),
  hypotheses: z.array(z.record(z.string(), z.any())).optional().describe("As the law file would carry them."),
  atoms: z.array(z.string()).optional().describe("shared_scope.atoms, if any."),
  taxa: z.array(z.string()).optional(),
}, args => oq.lean_open_question_guard.handler(args));

// -- The Design Studio -------------------------------------------------------------------------------
// The studio was reachable from sim-engine/cli.mjs and from the browser page, and NOT over MCP: an agent with
// only this server could parse a request into a spec, place its organism in a clade and check the laws, and then
// had no way to build the document those answers are about. The gap was invisible because every individual tool
// worked.
//
// These are registered LOCAL ONLY, under the same rule as everything else that writes: organism_create,
// organism_from_blueprint, organism_edit and the session log write files under sim-engine/sessions/, and the
// hosted server writes nothing on an anonymous caller's behalf. Running `node mcp/cli.mjs tools` locally lists
// them; the hosted tool list is unchanged.
//
// The schemas are JSON Schema (studio.mjs is shared with the browser, which has no zod). This converts the top
// level only -- enough for MCP to advertise the argument names, types and which are required -- and the handler
// validates in full, as it already did for every other caller. Nested shapes are passed through as objects
// rather than being described twice and drifting.
function JS2Z(s, name) {
  const t = Array.isArray(s?.type) ? s.type[0] : s?.type;
  let z0;
  if (s?.enum) z0 = z.enum(s.enum.map(String));
  else if (s?.anyOf) z0 = z.union(s.anyOf.map((x, i) => JS2Z(x, `${name}[${i}]`)).map(x => (x.isOptional?.() ? x.unwrap() : x)));
  else if (t === 'string') z0 = z.string();
  else if (t === 'number' || t === 'integer') z0 = z.number();
  else if (t === 'boolean') z0 = z.boolean();
  else if (t === 'array') z0 = z.array(s.items ? (x => (x.isOptional?.() ? x.unwrap() : x))(JS2Z(s.items, name + '[]')) : z.any());
  else if (t === 'object') z0 = z.record(z.string(), z.any());
  else z0 = z.any();
  return s?.description ? z0.describe(s.description) : z0;
}
function jsonShape(schema) {
  return Object.fromEntries(Object.entries(schema?.properties ?? {}).map(([k, v]) => {
    const zz = JS2Z(v, k);
    return [k, (schema.required ?? []).includes(k) ? zz : zz.optional()];
  }));
}
if (!HOSTED) {
  const { STUDIO_TOOLS } = await import("../sim-engine/tools/studio.mjs");
  for (const t of STUDIO_TOOLS) tool(t.name, `${t.title}. ${t.description}`, jsonShape(t.inputSchema), args => t.handler(args));
}

// Only start a transport when this file is the program. mcp/cli.mjs imports TOOLS from here, and connecting
// stdio on import would make the CLI hang waiting for MCP frames.
const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}`).href;
if (isMain) {
  if (process.env.DELPHI_HTTP_PORT) {
    const { serveHttp } = await import("./http.mjs");
    serveHttp(createServer, Number(process.env.DELPHI_HTTP_PORT), VERSION);
  } else {
    await createServer().connect(new StdioServerTransport());
  }
}
