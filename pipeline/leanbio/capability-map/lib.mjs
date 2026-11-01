// Shared loading, the real-tool universe, and the derived fields of the LeanBio capability map.
//
// The four enumerations are hand-written JSON (they are the deliverable). Everything DERIVED lives here, so a
// hand-edited file cannot assert its own rank or its own answerability:
//   - the tool universe is read from sim-engine/contract.json, mcp/server.mjs and this folder's own tool export;
//   - `answerable_today` on a use case is recomputed from its step statuses;
//   - `unblocks` and `rank` on a gap are counted from personas.json and use-cases.json and grand-questions.json.
//
// Nothing here fetches anything. Everything is read from the repo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const exists = p => fs.existsSync(p);
export const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

export const MAP_VERSION = '1.0.0';

export const FILES = {
  schema: path.join(HERE, 'capability-map.schema.json'),
  personas: path.join(HERE, 'personas.json'),
  use_cases: path.join(HERE, 'use-cases.json'),
  grand_questions: path.join(HERE, 'grand-questions.json'),
  tool_gap: path.join(HERE, 'tool-gap.json'),
  citations: path.join(HERE, 'citations.json'),
};

// The four tools this folder serves. Named here (not only in tools.mjs) so lib.mjs has no import cycle with it.
export const CAPABILITY_TOOL_NAMES = [
  'leanbio_personas',
  'leanbio_use_cases',
  'leanbio_grand_questions',
  'leanbio_tool_gap',
];

export const SCOPE =
  'A self-assessment of this repository, not a measurement of it. Tool names marked EXISTS or PARTIAL were checked ' +
  'mechanically against sim-engine/contract.json, mcp/server.mjs and this folder\'s own tool export, so a name cannot ' +
  'be invented; everything else here is judgement. The PARTIAL marks, the effort estimates, the formalisable/empirical ' +
  'split on each grand question and the risk notes were all written by this thread and are arguable. A Lean proof ' +
  'establishes that a conclusion follows from stated premises and never that any organism satisfies them, so a large ' +
  'formalisable core is not progress on a question, only a statement about which part of it is a question about premises. ' +
  'The four capability tools reach the hosted MCP server and contract.json only once the hub applies ' +
  'sim-engine/tools/CAPABILITY-REGISTER.md and mcp/CAPABILITY-PATCH.md. Nothing about the held-out exam clade is here.';

/**
 * Every tool name a user can actually call, with where it comes from.
 * `contract` is the generated sim-engine contract, which is authoritative for the sim-engine server, the CLI and
 * the HTTP bridge. `mcp` is the hosted delphisci server. `capability-map` is this folder, pending registration.
 */
export function toolUniverse() {
  const byName = new Map();
  const add = (name, origin) => {
    const cur = byName.get(name) || { name, origins: [] };
    if (!cur.origins.includes(origin)) cur.origins.push(origin);
    byName.set(name, cur);
  };
  const contractPath = path.join(ROOT, 'sim-engine', 'contract.json');
  if (!exists(contractPath)) throw new Error(`missing ${rel(contractPath)}: the tool universe cannot be checked`);
  const contract = readJson(contractPath);
  for (const t of contract.tools || []) add(t.name, 'contract');
  // mcp/server.mjs registers its tools through two helpers; scrape the literal names rather than importing the
  // server (importing it would start a server and would need its deps).
  const serverPath = path.join(ROOT, 'mcp', 'server.mjs');
  if (exists(serverPath)) {
    const src = fs.readFileSync(serverPath, 'utf8');
    for (const m of src.matchAll(/(?:^|[^\w])(?:tool|leanTool)\(\s*"([a-z][a-z0-9_]*)"/g)) add(m[1], 'mcp');
  }
  for (const n of CAPABILITY_TOOL_NAMES) add(n, 'capability-map');
  return byName;
}

export function loadDocs() {
  const docs = {};
  for (const [k, p] of Object.entries(FILES)) {
    if (k === 'schema') continue;
    if (!exists(p)) throw new Error(`missing ${rel(p)}`);
    docs[k] = readJson(p);
  }
  return docs;
}

/** Every tool reference in the map, flattened, with where it came from. */
export function toolRefs(docs) {
  const out = [];
  for (const p of docs.personas.personas) {
    for (const t of p.tools) out.push({ ...t, from: `personas/${p.id}` });
  }
  for (const u of docs.use_cases.use_cases) {
    for (const s of u.sequence) out.push({ name: s.tool, status: s.status, gap_id: s.gap_id, note: s.why, from: `use_cases/${u.id}` });
  }
  for (const q of docs.grand_questions.grand_questions) {
    for (const t of q.tools_needed) out.push({ ...t, from: `grand_questions/${q.id}` });
  }
  return out;
}

/**
 * `answerable_today`, recomputed from the step statuses so the stored value cannot drift from the sequence.
 *   no     at least one MISSING step marked `load_bearing: true`: the route cannot be walked at all;
 *   partly a PARTIAL step, or MISSING steps that only improve an answer already reachable;
 *   yes    every step EXISTS.
 * Whether a MISSING step is load-bearing is a judgement, so it is recorded PER STEP in the data rather than
 * guessed from the order here. That keeps the atomic judgement inspectable and makes this function a real check
 * that a row's summary verdict agrees with its own steps.
 */
export function deriveAnswerable(uc) {
  const st = uc.sequence.map(s => s.status);
  if (st.every(s => s === 'EXISTS')) return 'yes';
  if (uc.sequence.some(s => s.status === 'MISSING' && s.load_bearing === true)) return 'no';
  return 'partly';
}

/** Count what each gap unblocks, across all three enumerations, and rank by it. Never hand-edited. */
export function deriveUnblocks(docs) {
  const byGap = new Map();
  const touch = (gapId, bucket, id) => {
    if (!gapId) return;
    const g = byGap.get(gapId) || { personas: new Set(), use_cases: new Set(), grand_questions: new Set(), blocking_use_cases: new Set() };
    g[bucket].add(id);
    byGap.set(gapId, g);
  };
  for (const p of docs.personas.personas) for (const t of p.tools) if (t.status === 'MISSING') touch(t.gap_id, 'personas', p.id);
  for (const u of docs.use_cases.use_cases) {
    const answerable = deriveAnswerable(u);
    for (const s of u.sequence) if (s.status === 'MISSING') {
      touch(s.gap_id, 'use_cases', u.id);
      if (answerable === 'no') touch(s.gap_id, 'blocking_use_cases', u.id);
    }
    for (const gid of u.missing || []) touch(gid, 'use_cases', u.id);
  }
  for (const q of docs.grand_questions.grand_questions) for (const t of q.tools_needed) if (t.status === 'MISSING') touch(t.gap_id, 'grand_questions', q.id);
  const rows = docs.tool_gap.gaps.map(g => {
    const u = byGap.get(g.id) || { personas: new Set(), use_cases: new Set(), grand_questions: new Set(), blocking_use_cases: new Set() };
    const personas = [...u.personas].sort(), use_cases = [...u.use_cases].sort(), grand_questions = [...u.grand_questions].sort();
    const blocking = [...u.blocking_use_cases].sort();
    return {
      ...g,
      unblocks: {
        personas, use_cases, grand_questions,
        blocking_use_cases: blocking,
        counts: { personas: personas.length, use_cases: use_cases.length, grand_questions: grand_questions.length, blocking_use_cases: blocking.length },
        // Breadth score: one point per distinct persona, use case and grand question, plus one extra for each use
        // case that CANNOT be answered at all without this gap. Stated here so the order can be argued with.
        score: personas.length + use_cases.length + grand_questions.length + blocking.length,
      },
    };
  });
  // Rank by score, then by effort (cheaper first), then by id so the order is stable.
  const effortOrder = { small: 0, medium: 1, large: 2, research: 3 };
  rows.sort((a, b) =>
    b.unblocks.score - a.unblocks.score ||
    (effortOrder[a.effort] ?? 9) - (effortOrder[b.effort] ?? 9) ||
    a.id.localeCompare(b.id));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** The whole map, with every derived field filled in. This is what the tools, the CLI and the mirror serve. */
export function buildMap() {
  const docs = loadDocs();
  const universe = toolUniverse();
  const gaps = deriveUnblocks(docs);
  const use_cases = docs.use_cases.use_cases.map(u => ({ ...u, answerable_today: deriveAnswerable(u) }));
  const refs = toolRefs(docs);
  const realNames = new Set([...universe.keys()]);
  const statusCounts = { EXISTS: 0, PARTIAL: 0, MISSING: 0 };
  for (const r of refs) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  return {
    version: MAP_VERSION,
    as_of: docs.personas.as_of,
    scope: SCOPE,
    counts: {
      personas: docs.personas.personas.length,
      use_cases: use_cases.length,
      grand_questions: docs.grand_questions.grand_questions.length,
      gaps: gaps.length,
      not_gaps: docs.tool_gap.not_gaps.length,
      citations: Object.keys(docs.citations.citations).length,
      real_tools: realNames.size,
      tool_references: refs.length,
      tool_reference_status: statusCounts,
      use_cases_by_answerability: use_cases.reduce((a, u) => ((a[u.answerable_today] = (a[u.answerable_today] || 0) + 1), a), {}),
      gaps_by_kind: gaps.reduce((a, g) => ((a[g.kind] = (a[g.kind] || 0) + 1), a), {}),
      grand_questions_with_formalisable_core: docs.grand_questions.grand_questions.filter(q => q.formalisable_core.has_core).length,
      grand_questions_with_real_repo_asset: docs.grand_questions.grand_questions.filter(q => (q.in_repo || []).some(r => r.strength === 'real')).length,
    },
    personas: docs.personas.personas,
    use_cases,
    the_line: docs.grand_questions.the_line,
    grand_questions: docs.grand_questions.grand_questions,
    gaps,
    not_gaps: docs.tool_gap.not_gaps,
    citations: docs.citations.citations,
    tool_universe: [...universe.values()].sort((a, b) => a.name.localeCompare(b.name)),
    docs: {
      personas: { version: docs.personas.version, scope: docs.personas.scope },
      use_cases: { version: docs.use_cases.version, scope: docs.use_cases.scope },
      grand_questions: { version: docs.grand_questions.version, scope: docs.grand_questions.scope },
      tool_gap: { version: docs.tool_gap.version, scope: docs.tool_gap.scope },
      citations: { version: docs.citations.version, scope: docs.citations.scope },
    },
  };
}

// ── Checks (shared by test.mjs and build.mjs --check; each returns a list of problems, empty means pass) ──

/** Every tool named EXISTS or PARTIAL must be a real tool; every MISSING name must NOT be, and must have a gap. */
export function toolNameProblems(docs, universe = toolUniverse()) {
  const bad = [];
  const gapNames = new Set(docs.tool_gap.gaps.map(g => g.name));
  const gapIds = new Set(docs.tool_gap.gaps.map(g => g.id));
  for (const r of toolRefs(docs)) {
    const real = universe.has(r.name);
    if (r.status === 'EXISTS' || r.status === 'PARTIAL') {
      if (!real) bad.push(`${r.from}: "${r.name}" is marked ${r.status} but is not a tool in contract.json, mcp/server.mjs or this folder's export`);
    } else if (r.status === 'MISSING') {
      if (real) bad.push(`${r.from}: "${r.name}" is marked MISSING but a real tool of that name exists`);
      if (!r.gap_id) bad.push(`${r.from}: "${r.name}" is MISSING with no gap_id`);
      else if (!gapIds.has(r.gap_id)) bad.push(`${r.from}: gap_id "${r.gap_id}" is not in tool-gap.json`);
      else if (!gapNames.has(r.name)) bad.push(`${r.from}: MISSING tool "${r.name}" is not the name of any gap in tool-gap.json`);
    } else bad.push(`${r.from}: "${r.name}" has unknown status ${JSON.stringify(r.status)}`);
  }
  return bad;
}

/** Every grand question states a formalisable core and an empirical remainder, or says it has none and why. */
export function grandQuestionProblems(docs) {
  const bad = [];
  for (const q of docs.grand_questions.grand_questions) {
    const fc = q.formalisable_core, er = q.empirical_remainder;
    if (!fc || typeof fc.has_core !== 'boolean') bad.push(`${q.id}: no formalisable_core.has_core`);
    else if (fc.has_core) {
      if (!Array.isArray(fc.statements) || fc.statements.length === 0) bad.push(`${q.id}: has_core true but no statements`);
      if (!fc.strength) bad.push(`${q.id}: has_core true but no strength`);
      for (const s of fc.statements || []) {
        if (!s.claim || !s.settles) bad.push(`${q.id}: a core statement lacks claim or settles`);
        if (s.state === 'proved-here' && !s.lean) bad.push(`${q.id}: a statement claims proved-here with no Lean declaration named`);
      }
    } else if (!fc.reason_none) bad.push(`${q.id}: has_core false with no reason_none`);
    if (!er || typeof er.has_remainder !== 'boolean') bad.push(`${q.id}: no empirical_remainder.has_remainder`);
    else if (er.has_remainder) {
      if (!Array.isArray(er.items) || er.items.length === 0) bad.push(`${q.id}: has_remainder true but no items`);
      if (!er.share) bad.push(`${q.id}: has_remainder true but no share`);
      for (const i of er.items || []) if (!i.what || !i.why_not_provable) bad.push(`${q.id}: a remainder item lacks what or why_not_provable`);
    } else if (!er.reason_none) bad.push(`${q.id}: has_remainder false with no reason_none`);
    if (!Array.isArray(q.tools_needed) || q.tools_needed.length === 0) bad.push(`${q.id}: no tools_needed`);
    if (q.disputed && !q.dispute) bad.push(`${q.id}: marked disputed with no dispute statement`);
  }
  return bad;
}

/** No persona has an empty tool list, and every persona is reachable from at least one use case. */
export function personaProblems(docs) {
  const bad = [];
  const used = new Set(docs.use_cases.use_cases.flatMap(u => u.personas));
  const ids = new Set();
  for (const p of docs.personas.personas) {
    if (ids.has(p.id)) bad.push(`duplicate persona id ${p.id}`);
    ids.add(p.id);
    if (!Array.isArray(p.tools) || p.tools.length === 0) bad.push(`${p.id}: empty tool list`);
    if (!Array.isArray(p.would_ask) || p.would_ask.length === 0) bad.push(`${p.id}: nothing it would ask`);
    if (!p.today) bad.push(`${p.id}: no statement of what they do today`);
    if (!used.has(p.id)) bad.push(`${p.id}: named by no use case`);
  }
  for (const u of docs.use_cases.use_cases) for (const pid of u.personas) if (!ids.has(pid)) bad.push(`${u.id}: unknown persona ${pid}`);
  return bad;
}

/** Citation keys resolve, and nothing is asserted as verified without saying how. */
export function citationProblems(docs) {
  const bad = [];
  const keys = new Set(Object.keys(docs.citations.citations));
  for (const [k, c] of Object.entries(docs.citations.citations)) {
    if (!c.verified_via) bad.push(`citation ${k}: no verified_via`);
    if (!c.ref || c.ref.length < 20) bad.push(`citation ${k}: no usable ref`);
    if (!c.doi && !c.pmid && !c.url && !String(c.verified_via).startsWith('UNVERIFIED')) bad.push(`citation ${k}: claims ${c.verified_via} with no identifier`);
  }
  for (const q of docs.grand_questions.grand_questions) {
    for (const key of q.citations || []) if (!keys.has(key)) bad.push(`${q.id}: citation key "${key}" is not in citations.json`);
    if (q.disputed && (q.citations || []).length < 2) bad.push(`${q.id}: marked disputed with fewer than two citations`);
  }
  return bad;
}

/** The stored answerable_today must equal the derived one, and every `missing` id must be a real gap. */
export function useCaseProblems(docs) {
  const bad = [];
  const gapIds = new Set(docs.tool_gap.gaps.map(g => g.id));
  const ids = new Set();
  for (const u of docs.use_cases.use_cases) {
    if (ids.has(u.id)) bad.push(`duplicate use case id ${u.id}`);
    ids.add(u.id);
    const derived = deriveAnswerable(u);
    if (u.answerable_today !== derived) bad.push(`${u.id}: answerable_today is "${u.answerable_today}" but the sequence derives "${derived}"`);
    for (const gid of u.missing || []) if (!gapIds.has(gid)) bad.push(`${u.id}: missing id "${gid}" is not a gap`);
    if (!u.does_not_establish) bad.push(`${u.id}: no does_not_establish`);
    u.sequence.forEach((s, i) => { if (s.step !== i + 1) bad.push(`${u.id}: step ${s.step} is out of order at position ${i + 1}`); });
    if (u.worked_example && !u.worked_example.result) bad.push(`${u.id}: a worked example with no result`);
  }
  return bad;
}

/** Gaps are well formed, deduplicated, and every gap is referenced by something. */
export function gapProblems(docs) {
  const bad = [];
  const ids = new Set(), names = new Set();
  const referenced = new Set(toolRefs(docs).filter(r => r.status === 'MISSING').map(r => r.gap_id));
  for (const u of docs.use_cases.use_cases) for (const g of u.missing || []) referenced.add(g);
  for (const g of docs.tool_gap.gaps) {
    if (ids.has(g.id)) bad.push(`duplicate gap id ${g.id}`);
    if (names.has(g.name)) bad.push(`duplicate gap name ${g.name}`);
    ids.add(g.id); names.add(g.name);
    if (!g.signature || g.signature.length < 15) bad.push(`${g.id}: no usable signature`);
    if (!Array.isArray(g.reads) || g.reads.length === 0) bad.push(`${g.id}: nothing it would read`);
    if (!g.buildable || typeof g.buildable.on_what_we_have !== 'boolean') bad.push(`${g.id}: no buildable.on_what_we_have`);
    if (g.buildable && g.buildable.on_what_we_have === false && !(g.buildable.needs_data || []).length && !g.buildable.needs_lean_build) {
      bad.push(`${g.id}: not buildable on what we have, but names no missing data and no Lean build`);
    }
    if (!g.risk) bad.push(`${g.id}: no risk note (a tool whose failure mode is not stated should not be built)`);
    if (!['tool', 'lean-module', 'data', 'integration'].includes(g.kind)) bad.push(`${g.id}: unknown kind ${g.kind}`);
    if (!referenced.has(g.id)) bad.push(`${g.id}: a gap nothing in the map asks for`);
  }
  for (const n of docs.tool_gap.not_gaps) if (!n.why_not) bad.push(`not_gap ${n.name}: no why_not`);
  return bad;
}

/** Lean declarations a core statement claims as proved-here must exist in the module it names. */
export function leanRefProblems(docs) {
  const bad = [];
  for (const q of docs.grand_questions.grand_questions) {
    for (const s of q.formalisable_core.statements || []) {
      if (s.state !== 'proved-here' || !s.lean) continue;
      const modules = String(s.module || '').split(',').map(x => x.trim()).filter(Boolean);
      if (!modules.length) { bad.push(`${q.id}: proved-here statement names no module`); continue; }
      const sources = modules.map(m => (exists(path.join(ROOT, m)) ? fs.readFileSync(path.join(ROOT, m), 'utf8') : null));
      if (sources.some(s2 => s2 === null)) { bad.push(`${q.id}: module not found among ${modules.join(', ')}`); continue; }
      const all = sources.join('\n');
      for (const decl of String(s.lean).split(',').map(x => x.trim()).filter(Boolean)) {
        // A fully qualified name such as Delphi.Genotype.minSubst is declared in the module by its last segment
        // (the namespace supplies the rest), so check the final segment as a declaration head.
        // Lean identifiers may contain a prime, so \b is wrong at the end: use a negative lookahead instead.
        const leaf = decl.split('.').pop();
        const esc = leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`(theorem|lemma|def|noncomputable def|structure|abbrev)\\s+${esc}(?![A-Za-z0-9_'])`).test(all)) {
          bad.push(`${q.id}: claims "${decl}" is proved here, but no declaration "${leaf}" is in ${modules.join(', ')}`);
        }
      }
    }
  }
  return bad;
}

export function allProblems(docs = loadDocs(), universe = toolUniverse()) {
  return [
    ...personaProblems(docs),
    ...useCaseProblems(docs),
    ...grandQuestionProblems(docs),
    ...gapProblems(docs),
    ...citationProblems(docs),
    ...toolNameProblems(docs, universe),
    ...leanRefProblems(docs),
  ];
}
