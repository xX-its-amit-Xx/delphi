// Open-question tools: what this project holds UNSETTLED, as MCP tools, with the provenance envelope.
//
// The SAME handlers serve every surface, exactly as tools/lean-tools.mjs does for laws:
//   sim-engine/server.mjs  (stdio MCP; registration patch in sim-engine/tools/OPENQ-REGISTER.md)
//   sim-engine/http.mjs    (POST /tool/lean_open_question*)
//   mcp/server.mjs + mcp/cli.mjs (the hosted delphisci MCP)
//   lean/registry/open-questions/cli.mjs
// and all of them read records through ONE loader, openq-lib.mjs. Nothing here holds a list of its own.
//
// Why these tools exist next to lean_laws_list: an agent that can only ask what is PROVED will treat silence as
// absence of a problem. These make the unsettled questions, and the statements this project tried and could not
// establish, as queryable as the laws.

import { envelope, p } from '../../../sim-engine/lib/envelope.mjs';
import { load, summary, questionById, openQuestions, openQuestionGuard, proportionOf } from './openq-lib.mjs';

const SCOPE =
  'An OPEN QUESTION is a question this project holds unsettled, with an arm per live position. Each arm quotes ' +
  'its evidence from a primary source, and the belief `proportion` across arms is COMPUTED by ' +
  'pipeline/leanbio/belief.mjs (parameters in belief-params.json) rather than asserted. A proportion ORDERS the ' +
  'arms; it is NOT a probability that an arm is true, and belief-params.json states that its rand/syst values are ' +
  'hand-set and have not been fitted. NO arm of an open question is in any law set: the guard in openq-lib.mjs ' +
  'refuses to accept a law that asserts one, and refuses it whether the law is clean Lean or not. An arm ' +
  'formalised in Lean is proved INTERNALLY CONSISTENT and is not thereby proved true of any organism. Where the ' +
  'arms are not actually contradictory, `exclusivity.kind` says so rather than forcing a contradiction. A FAILED ' +
  'THEOREM is a statement this project tried and could not establish, kept with its reason so nobody reproposes ' +
  'it; read `what_survives` for what is still true after the failure.';

const prov = () => [
  p('open-question registry', 'lean/registry/open-questions/', 'derived',
    'Versioned records in this repository (questions/*.json, failed/*.json, requirements/*.json), schema open-questions.schema.json, record types fixed by pipeline/leanbio/debate/CRITERIA.md.'),
  p('belief formula', 'pipeline/leanbio/belief-params.json', 'derived',
    'The arm proportions are computed by pipeline/leanbio/belief.mjs, the same INDRA SimpleScorer form the LeanBio formalization queue uses. Hand-set parameters, not fitted.'),
];

// ── lean_open_questions ────────────────────────────────────────────────────
export const openQuestionsSchema = {
  title: 'List open questions and failed theorems',
  description: 'Everything this project holds UNSETTLED (open questions, each with its arms and a computed belief proportion) and everything it tried and could not establish (failed theorems, each with its reason and what survives). Filter by status, by whether an arm is formalised in Lean, by a law_id or design property the question touches, or by free text.',
  inputSchema: {
    type: 'object',
    properties: {
      status: { oneOf: [{ type: 'string', enum: ['open', 'settled', 'abandoned'] }, { type: 'array', items: { type: 'string', enum: ['open', 'settled', 'abandoned'] } }], description: 'One status or a list. Default: all.' },
      formalised: { type: 'boolean', description: 'true: only questions with at least one arm formalised in Lean.' },
      touches: { type: 'string', description: 'A law_id, constraint id, design property or scenario key the question bears on, e.g. "perturb-depth-cap", "adult_mass", "sleep".' },
      text: { type: 'string', description: 'Substring of question_id, statement or an arm statement.' },
      include_failed: { type: 'boolean', description: 'Include failed theorems and requirement records. Default true.' },
    },
  },
};
export async function openQuestionsList(args = {}) {
  const reg = load();
  const s = summary({ reg });
  let qs = s.questions;
  if (args.status) { const want = [].concat(args.status); qs = qs.filter(q => want.includes(q.status)); }
  if (args.formalised === true) qs = qs.filter(q => q.arms.some(a => a.formalised));
  if (args.formalised === false) qs = qs.filter(q => !q.arms.some(a => a.formalised));
  if (args.touches) {
    const t = String(args.touches).toLowerCase();
    const full = new Map(reg.questions.map(q => [q.question_id, q]));
    qs = qs.filter(q => { const tc = full.get(q.question_id)?.touches || {};
      return [...(tc.law_ids || []), ...(tc.design_properties || []), ...(tc.scenario_keys || []), ...(tc.constraints || []), ...(tc.files || [])].some(x => String(x).toLowerCase().includes(t)); });
  }
  if (args.text) {
    const t = String(args.text).toLowerCase();
    const full = new Map(reg.questions.map(q => [q.question_id, q]));
    qs = qs.filter(q => (q.question_id + ' ' + q.statement_en + ' ' + (full.get(q.question_id)?.arms || []).map(a => a.statement_en).join(' ')).toLowerCase().includes(t));
  }
  const includeFailed = args.include_failed !== false;
  return envelope({
    counts: s.counts, questions: qs,
    failed_theorems: includeFailed ? s.failed_theorems : undefined,
    requirements: includeFailed ? s.requirements : undefined,
    note: 'Use lean_open_question(id) for one full record: every arm\'s evidence with verbatim quotes, the belief breakdown, the exclusivity finding, and what would settle it.',
  }, prov(), SCOPE);
}

// ── lean_open_question ─────────────────────────────────────────────────────
export const openQuestionSchema = {
  title: 'Get one open question, failed theorem or requirement record',
  description: 'One full record: every arm with its position, its Lean reference where it has been formalised, its evidence with VERBATIM quotes and locators, its computed belief and the breakdown behind it; whether the arms actually contradict; what would settle the question and whether that is feasible today; and what in this project rests on the answer. Accepts a question_id (oq-*), failure_id (ft-*) or requirement_id (cr-*).',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'question_id (e.g. "oq-kcnk5b-vm-sign"), failure_id (e.g. "ft-glider-interface-convergence") or requirement_id.' },
      recompute: { type: 'boolean', description: 'Recompute the belief proportion from the arms\' evidence and return it alongside the stored one, so a caller can verify the number rather than trust it.' },
    },
    required: ['id'],
  },
};
export async function openQuestionGet(args = {}) {
  const reg = load();
  const id = String(args.id || '');
  const rec = questionById(id, reg) || reg.failed.find(f => f.failure_id === id) || reg.requirements.find(r => r.requirement_id === id) || reg.requests.find(r => r.request_id === id);
  if (!rec) {
    return envelope({ error: `no record "${id}"`,
      available: { questions: reg.questions.map(q => q.question_id), failed_theorems: reg.failed.map(f => f.failure_id), requirements: reg.requirements.map(r => r.requirement_id) } }, prov(), SCOPE);
  }
  const out = { ...rec };
  if (args.recompute && rec.record_type === 'open-question') {
    const fresh = await proportionOf(rec);
    out.proportion_recomputed = fresh;
    out.proportion_reproducible = JSON.stringify(fresh.shares) === JSON.stringify(rec.proportion.shares);
  }
  if (rec.record_type === 'open-question' && rec.status === 'open') {
    out.guard_note = `No law may assert an arm of this question while it is open. lean/registry/propose.mjs and lean/registry/check-exposed.mjs both refuse one; to proceed, settle the question (recording which evidence settled it), register a scoped exemption on both sides, or restate the law so it takes no side.`;
  }
  return envelope(out, prov(), SCOPE);
}

// ── lean_open_question_guard ───────────────────────────────────────────────
// Lets a proposer ask BEFORE writing a law whether a statement would be refused, rather than finding out from
// propose.mjs after writing the Lean.
export const openQuestionGuardSchema = {
  title: 'Would this law be refused for asserting an open arm?',
  description: 'Run the open-question guard against a proposed law WITHOUT writing anything. Returns the arms it would be found to assert, and the full refusal text naming the question, its arms, the computed proportion and what would settle it. Ask this before writing the Lean, not after.',
  inputSchema: {
    type: 'object',
    properties: {
      law_id: { type: 'string' },
      statement_en: { type: 'string', description: 'The law\'s plain-English statement, as it would be written.' },
      lean_theorem: { type: 'string', description: 'Fully qualified theorem name, if there is one.' },
      lean_structure: { type: 'string', description: 'Fully qualified hypothesis structure name, if there is one.' },
      hypotheses: { type: 'array', items: { type: 'object' }, description: 'As the law file would carry them.' },
      atoms: { type: 'array', items: { type: 'string' }, description: 'shared_scope.atoms, if any.' },
      taxa: { type: 'array', items: { type: 'string' } },
    },
    required: ['statement_en'],
  },
};
export async function openQuestionGuardCheck(args = {}) {
  const law = {
    law_id: args.law_id || '(unnamed proposal)', status: 'candidate', statement_en: args.statement_en,
    hypotheses: args.hypotheses || [], scope: { taxa: args.taxa || ['any'] },
    shared_scope: args.atoms && args.atoms.length ? { atoms: args.atoms, quantities: {} } : null,
    lean_ref: { module: null, theorem: args.lean_theorem || null, structure: args.lean_structure || null },
  };
  const g = openQuestionGuard(law, { questions: openQuestions() });
  return envelope({
    would_be_refused: !g.ok,
    violations: g.violations,
    verdict: g.ok
      ? 'This statement asserts no arm of any open question. The open-question guard would not refuse it. (Every other registry check still applies.)'
      : `REFUSED by the open-question guard: this statement asserts ${g.violations.length} arm(s) of question(s) this project holds open. Promoting it would settle by automation a question the evidence has not settled.`,
  }, prov(), SCOPE);
}

// ── the tool table, in the shape sim-engine/server.mjs expects ─────────────
export const OPENQ_TOOLS = [
  { name: 'lean_open_questions', ...openQuestionsSchema, handler: openQuestionsList },
  { name: 'lean_open_question', ...openQuestionSchema, handler: openQuestionGet },
  { name: 'lean_open_question_guard', ...openQuestionGuardSchema, handler: openQuestionGuardCheck },
];
