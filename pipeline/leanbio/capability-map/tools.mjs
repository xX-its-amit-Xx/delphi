// The four capability-map MCP tools, in the {name, title, description, inputSchema, handler} shape of
// sim-engine/tools/*.mjs and pipeline/leanbio/tools.mjs.
//
// Registration (applied by the hub, not here): sim-engine/tools/CAPABILITY-REGISTER.md and mcp/CAPABILITY-PATCH.md.
// This file edits no server.
//
//   leanbio_personas         who could use Lean for Bio, and which tools each kind of user needs
//   leanbio_use_cases        one row per concrete job: the tool sequence that answers it today, and what is missing
//   leanbio_grand_questions  the big questions, split into the formalisable core and the empirical remainder
//   leanbio_tool_gap         the deduplicated gap list, ranked by how many personas and use cases each unblocks
//
// All four are read-only, make no network call, and return the provenance envelope {result, provenance, scope}.
import fs from 'node:fs';
import path from 'node:path';
import { HERE, FILES, SCOPE, MAP_VERSION, buildMap, rel } from './lib.mjs';

const prov = (quantity, value, kind, source) => ({ quantity, value, kind, source });
const PROV = () => [
  prov('capability map version', MAP_VERSION, 'derived', rel(path.join(HERE, 'personas.json')) + ' and its siblings'),
  prov('tool universe', 'sim-engine/contract.json + mcp/server.mjs + this folder\'s own export', 'derived', 'pipeline/leanbio/capability-map/lib.mjs toolUniverse()'),
  prov('judgements (PARTIAL marks, effort, the formalisable/empirical split)', 'hand-written by the capability-map thread', 'assumed', 'pipeline/leanbio/capability-map/README.md'),
];

// One build per process unless a source file changes, so repeated tool calls are cheap but a live edit is picked up.
let cache = null;
function mapNow() {
  const stamp = Object.values(FILES).map(p => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0)).join(',');
  if (!cache || cache.stamp !== stamp) cache = { stamp, map: buildMap() };
  return cache.map;
}

const envelope = result => ({ result, provenance: PROV(), scope: SCOPE });
const slim = (o, keep) => Object.fromEntries(Object.entries(o).filter(([k]) => keep.includes(k)));

// ── leanbio_personas ──
export const personasSchema = {
  title: 'Personas: who could use Lean for Bio',
  description: 'Every kind of person or agent with a reason to use a formalised law registry over biology: who they are, what they do today without it, what they would ask of it, and the tools they need with each marked EXISTS (a real tool in sim-engine/contract.json or on the delphisci MCP server), PARTIAL (real but incomplete, with a note saying what it does not do) or MISSING (a proposal, defined in leanbio_tool_gap). No persona has an empty tool list. Includes AI agents doing automated science, which is what this project\'s own swarm is.',
  inputSchema: { type: 'object', properties: {
    id: { type: 'string', description: 'One persona by id, e.g. "reviewer-editor"' },
    text: { type: 'string', description: 'Only personas whose name, who, today or would_ask mention this text' },
    needs_tool: { type: 'string', description: 'Only personas who need this tool name (real or proposed)' },
    status: { type: 'string', enum: ['EXISTS', 'PARTIAL', 'MISSING'], description: 'Only personas with at least one tool at this status' },
    brief: { type: 'boolean', default: false, description: 'Name, who and tool statuses only' },
  } },
};
export async function personas({ id, text, needs_tool, status, brief = false } = {}) {
  const m = mapNow();
  let rows = m.personas;
  if (id) rows = rows.filter(p => p.id === id);
  if (text) { const q = text.toLowerCase(); rows = rows.filter(p => [p.name, p.who, p.today, ...(p.would_ask || [])].join(' ').toLowerCase().includes(q)); }
  if (needs_tool) rows = rows.filter(p => p.tools.some(t => t.name === needs_tool));
  if (status) rows = rows.filter(p => p.tools.some(t => t.status === status));
  if (id && rows.length === 0) throw new Error(`no persona "${id}" (ids: ${m.personas.map(p => p.id).join(', ')})`);
  const out = brief
    ? rows.map(p => ({ id: p.id, name: p.name, who: p.who, tools: p.tools.map(t => `${t.name}:${t.status}`) }))
    : rows;
  return envelope({ total: out.length, of: m.personas.length, personas: out, counts: m.counts });
}

// ── leanbio_use_cases ──
export const useCasesSchema = {
  title: 'Use cases: the tool sequence for one concrete job',
  description: 'One row per job somebody would come here to do, naming the question in a user\'s words, the ordered tool sequence that answers it TODAY with real tool names, what is missing (with the gap id), a worked example drawn from a file in this repo where one exists, and the honest limit of the answer. `answerable_today` is derived from the step statuses: "no" means a MISSING step the route cannot be walked without. Includes the uncomfortable ones: whether a published conclusion follows from its premises, what is NOT known at each scale for a gene, and open questions ranked by how decisive new evidence would be.',
  inputSchema: { type: 'object', properties: {
    id: { type: 'string', description: 'One use case by id, e.g. "uc-which-laws-violated"' },
    persona: { type: 'string', description: 'Only use cases for this persona id' },
    answerable: { type: 'string', enum: ['yes', 'partly', 'no'], description: 'Filter by whether it can be answered today' },
    tool: { type: 'string', description: 'Only use cases whose sequence names this tool' },
    uses_gap: { type: 'string', description: 'Only use cases waiting on this tool-gap id' },
    uncomfortable: { type: 'boolean', description: 'Only the rows that expose a gap or whose honest answer is "we do not know"' },
    worked_only: { type: 'boolean', default: false, description: 'Only rows with a worked example' },
    text: { type: 'string', description: 'Only use cases whose question mentions this text' },
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
  } },
};
export async function useCases({ id, persona, answerable, tool, uses_gap, uncomfortable, worked_only = false, text, limit = 50 } = {}) {
  const m = mapNow();
  let rows = m.use_cases;
  if (id) rows = rows.filter(u => u.id === id);
  if (persona) rows = rows.filter(u => u.personas.includes(persona));
  if (answerable) rows = rows.filter(u => u.answerable_today === answerable);
  if (tool) rows = rows.filter(u => u.sequence.some(s => s.tool === tool));
  if (uses_gap) rows = rows.filter(u => (u.missing || []).includes(uses_gap) || u.sequence.some(s => s.gap_id === uses_gap));
  if (uncomfortable !== undefined) rows = rows.filter(u => !!u.uncomfortable === uncomfortable);
  if (worked_only) rows = rows.filter(u => u.worked_example);
  if (text) { const q = text.toLowerCase(); rows = rows.filter(u => u.question.toLowerCase().includes(q)); }
  if (id && rows.length === 0) throw new Error(`no use case "${id}"`);
  return envelope({
    total: rows.length,
    of: m.use_cases.length,
    by_answerability: m.counts.use_cases_by_answerability,
    use_cases: rows.slice(0, limit),
  });
}

// ── leanbio_grand_questions ──
export const grandQuestionsSchema = {
  title: 'Grand questions, split into what a proof can settle and what only measurement can',
  description: 'The big open questions of biology, each separated honestly into (a) the FORMALISABLE CORE, written as conditionals so the premises are visible, with the Lean declaration in this repo that proves it where one exists; (b) the EMPIRICAL REMAINDER, item by item, each with why no proof reaches it and the measurement that would; (c) what already exists here towards it, graded real / adjacent / shape-only; (d) the tools a user would need. Lean proves that a conclusion follows from stated premises; it does not adjudicate reality, and the split is the point of the document. Citations were fetched from Europe PMC or Crossref, with both sides named for the disputed questions.',
  inputSchema: { type: 'object', properties: {
    id: { type: 'string', description: 'One question by id, e.g. "gq-hamiltons-rule"' },
    disputed: { type: 'boolean', description: 'Only the questions the literature actively disagrees about' },
    has_repo_asset: { type: 'boolean', description: 'Only questions where something in this repo is graded "real" towards them' },
    core_strength: { type: 'string', enum: ['strong', 'moderate', 'narrow'], description: 'How much of the question the formalisable core covers' },
    section: { type: 'string', enum: ['core', 'remainder', 'in_repo', 'tools', 'all'], default: 'all', description: 'Return only one part of each entry' },
    with_citations: { type: 'boolean', default: true, description: 'Resolve the citation keys into full records' },
  } },
};
export async function grandQuestions({ id, disputed, has_repo_asset, core_strength, section = 'all', with_citations = true } = {}) {
  const m = mapNow();
  let rows = m.grand_questions;
  if (id) rows = rows.filter(q => q.id === id);
  if (disputed !== undefined) rows = rows.filter(q => !!q.disputed === disputed);
  if (has_repo_asset !== undefined) rows = rows.filter(q => (q.in_repo || []).some(r => r.strength === 'real') === has_repo_asset);
  if (core_strength) rows = rows.filter(q => q.formalisable_core.strength === core_strength);
  if (id && rows.length === 0) throw new Error(`no grand question "${id}" (ids: ${m.grand_questions.map(q => q.id).join(', ')})`);
  const pick = q => {
    if (section === 'all') return q;
    const base = slim(q, ['id', 'name', 'question', 'disputed', 'dispute']);
    if (section === 'core') return { ...base, formalisable_core: q.formalisable_core };
    if (section === 'remainder') return { ...base, empirical_remainder: q.empirical_remainder };
    if (section === 'in_repo') return { ...base, in_repo: q.in_repo };
    return { ...base, tools_needed: q.tools_needed };
  };
  const out = rows.map(pick);
  const cites = {};
  if (with_citations) for (const q of rows) for (const k of q.citations || []) if (m.citations[k]) cites[k] = m.citations[k];
  return envelope({
    the_line: m.the_line,
    total: out.length,
    of: m.grand_questions.length,
    with_formalisable_core: m.counts.grand_questions_with_formalisable_core,
    with_real_repo_asset: m.counts.grand_questions_with_real_repo_asset,
    grand_questions: out,
    citations: with_citations ? cites : undefined,
  });
}

// ── leanbio_tool_gap ──
export const toolGapSchema = {
  title: 'Tool gap analysis, ranked by how much each gap unblocks',
  description: 'The union of every MISSING reference in the personas, use cases and grand questions, deduplicated, each with a name, a signature, what it would read, an effort estimate, whether it is buildable on what we already have or needs data we do not have, the nearest existing tool, and how it could mislead if built carelessly. `unblocks` and `rank` are counted at call time from the other three documents, so a gap cannot be promoted by editing its own entry. Also serves `not_gaps`: the things deliberately absent, so a missing feature is distinguishable from an unmade decision.',
  inputSchema: { type: 'object', properties: {
    id: { type: 'string', description: 'One gap by id, e.g. "scale-coverage"' },
    kind: { type: 'string', enum: ['tool', 'lean-module', 'data', 'integration'], description: 'tool: a surface over data we can reach. lean-module: a Lean file to write and propose first. data: a measurement set we do not have. integration: wiring to something outside this repo.' },
    effort: { type: 'string', enum: ['small', 'medium', 'large', 'research'] },
    buildable_now: { type: 'boolean', description: 'Only gaps that are (or are not) buildable on what we already have' },
    unblocks_persona: { type: 'string', description: 'Only gaps that unblock this persona id' },
    unblocks_question: { type: 'string', description: 'Only gaps that unblock this grand-question id' },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
    include_not_gaps: { type: 'boolean', default: true, description: 'Include the deliberately-absent list' },
  } },
};
export async function toolGap({ id, kind, effort, buildable_now, unblocks_persona, unblocks_question, limit = 30, include_not_gaps = true } = {}) {
  const m = mapNow();
  let rows = m.gaps;
  if (id) rows = rows.filter(g => g.id === id);
  if (kind) rows = rows.filter(g => g.kind === kind);
  if (effort) rows = rows.filter(g => g.effort === effort);
  if (buildable_now !== undefined) rows = rows.filter(g => g.buildable.on_what_we_have === buildable_now);
  if (unblocks_persona) rows = rows.filter(g => g.unblocks.personas.includes(unblocks_persona));
  if (unblocks_question) rows = rows.filter(g => g.unblocks.grand_questions.includes(unblocks_question));
  if (id && rows.length === 0) throw new Error(`no gap "${id}" (ids: ${m.gaps.map(g => g.id).join(', ')})`);
  return envelope({
    ranking: 'score = distinct personas + use cases + grand questions that name the gap, plus one extra for each use case that cannot be answered at all without it; ties broken by effort (cheaper first) then id. Counted at call time from personas.json, use-cases.json and grand-questions.json.',
    total: rows.length,
    of: m.gaps.length,
    by_kind: m.counts.gaps_by_kind,
    gaps: rows.slice(0, limit),
    not_gaps: include_not_gaps ? m.not_gaps : undefined,
  });
}

export const CAPABILITY_TOOLS = [
  { name: 'leanbio_personas', ...personasSchema, handler: personas },
  { name: 'leanbio_use_cases', ...useCasesSchema, handler: useCases },
  { name: 'leanbio_grand_questions', ...grandQuestionsSchema, handler: grandQuestions },
  { name: 'leanbio_tool_gap', ...toolGapSchema, handler: toolGap },
];
export const CAPABILITY_TOOL_NAMES = CAPABILITY_TOOLS.map(t => t.name);
