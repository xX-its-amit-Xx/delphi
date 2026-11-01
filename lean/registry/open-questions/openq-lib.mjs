#!/usr/bin/env node
// Open questions, failed theorems, requirement records and promotion requests: the loader, the reproducible
// belief proportion, and THE GUARD.
//
// Layout and schema: lean/registry/open-questions/README.md and open-questions.schema.json.
// Record types are fixed by pipeline/leanbio/debate/CRITERIA.md "Record types emitted (1.1.0)".
//
//   import { load, recompute, openQuestionGuard, validateRecord } from './openq-lib.mjs';
//
// THE GUARD is the point of this folder. `openQuestionGuard(law)` refuses a law that asserts one arm of an OPEN
// question. Without it, "we hold this question open" is a note in a file that nothing enforces, and the next clean
// proposal settles by automation a question the evidence has not settled.
//
// Nothing here writes to disk except `recompute({write:true})`, which rewrites the computed `proportion` block and
// each arm's `belief`/`belief_basis` in place. An open question is NEVER deleted: it is settled or abandoned, with
// the reason, and its file stays (laws and questions behave the same way).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { canonical, sha256, readJson, writeJson, validate, statementText, LAWS_DIR, loadLaws } from '../registry-lib.mjs';

export const OQ = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(OQ, '../../..');
export const QUESTIONS_DIR = path.join(OQ, 'questions');
export const FAILED_DIR = path.join(OQ, 'failed');
export const REQUIREMENTS_DIR = path.join(OQ, 'requirements');
export const REQUESTS_DIR = path.join(OQ, 'requests');
export const SCHEMA = path.join(OQ, 'open-questions.schema.json');

const R = (...p) => path.join(ROOT, ...p);
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const readDir = d => exists(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).sort() : [];

// ── the belief engine, borrowed rather than re-implemented ──────────────────
// The proportion across arms MUST be reproducible, so it is computed by the same formula the LeanBio queue uses
// (pipeline/leanbio/belief.mjs, parameters in belief-params.json), not asserted in the record.
let _belief = null;
export async function beliefEngine() {
  if (_belief) return _belief;
  _belief = await import(pathToFileURL(R('pipeline', 'leanbio', 'belief.mjs')).href);
  return _belief;
}

/** The hashed view of a record: what it SAYS. Status, history and computed belief are deliberately excluded, so
 * settling a question or recomputing its proportion does not change its content hash — exactly as a law changes
 * status without changing what it says. */
export function hashedView(rec) {
  const base = { record_type: rec.record_type, version: rec.version, statement_en: rec.statement_en };
  if (rec.record_type === 'open-question') {
    return { ...base, question_id: rec.question_id,
      arms: (rec.arms || []).map(a => ({ arm_id: a.arm_id, position: a.position, statement_en: a.statement_en,
        formalisable: a.formalisable, not_formalisable_because: a.not_formalisable_because ?? null,
        lean_ref: a.lean_ref ? { module: a.lean_ref.module, theorem: a.lean_ref.theorem ?? null, structure: a.lean_ref.structure ?? null, statement_sha256: a.lean_ref.statement_sha256 ?? null } : null,
        evidence: (a.evidence || []).map(e => ({ claim: e.claim, source: e.source, locator: e.locator, quote: e.quote, kind: e.kind, belief_class: e.belief_class, belief_key: e.belief_key ?? null, side: e.side ?? 'support' })) })),
      what_would_settle_it: rec.what_would_settle_it, touches: rec.touches, guard: rec.guard ?? null, exclusivity: rec.exclusivity ?? null };
  }
  if (rec.record_type === 'failed-theorem') return { ...base, failure_id: rec.failure_id, reason: rec.reason, reason_detail: rec.reason_detail, what_was_tried: rec.what_was_tried, what_survives: rec.what_survives, lean_ref: rec.lean_ref ?? null, sources: rec.sources ?? [], became_open_question: rec.became_open_question ?? null };
  if (rec.record_type === 'candidate-with-requirements') return { ...base, requirement_id: rec.requirement_id, law_id: rec.law_id ?? null, missing_inputs: rec.missing_inputs, would_constrain_if_supplied: rec.would_constrain_if_supplied, not_checkable_because: rec.not_checkable_because ?? null };
  return { ...base, request_id: rec.request_id, law_id: rec.law_id, blocked_by_open_questions: rec.blocked_by_open_questions ?? [] };
}
export const contentHash = rec => sha256(canonical(hashedView(rec)));

/** Load everything. `{questions, failed, requirements, requests, all}`. */
export function load() {
  const q = readDir(QUESTIONS_DIR).map(f => readJson(path.join(QUESTIONS_DIR, f)));
  const failed = readDir(FAILED_DIR).map(f => readJson(path.join(FAILED_DIR, f)));
  const requirements = readDir(REQUIREMENTS_DIR).map(f => readJson(path.join(REQUIREMENTS_DIR, f)));
  const requests = readDir(REQUESTS_DIR).map(f => readJson(path.join(REQUESTS_DIR, f)));
  return { questions: q, failed, requirements, requests, all: [...q, ...failed, ...requirements, ...requests] };
}
export const questionById = (id, reg = load()) => reg.questions.find(q => q.question_id === id) || null;
export const openQuestions = (reg = load()) => reg.questions.filter(q => q.status === 'open');

// ── validation ─────────────────────────────────────────────────────────────
/** Schema errors plus the invariants the schema cannot state. Returns a list of strings. */
export function validateRecord(rec, { schema = readJson(SCHEMA) } = {}) {
  const errs = [];
  const defKey = { 'open-question': 'openQuestion', 'failed-theorem': 'failedTheorem', 'candidate-with-requirements': 'requirements', 'promotion-request': 'promotionRequest' }[rec.record_type];
  if (!defKey) return [`unknown record_type ${JSON.stringify(rec.record_type)}`];
  errs.push(...validate(schema.$defs[defKey], rec, '$'));
  const id = rec.question_id || rec.failure_id || rec.requirement_id || rec.request_id;

  if (rec.record_type === 'open-question') {
    // A one-armed open question is not a question. It is an unsupported claim wearing a question's clothes, and it
    // would let a proposer park a side as "open" while nothing contradicts it.
    const arms = rec.arms || [];
    if (arms.length < 2) errs.push(`${id}: an open question needs at least TWO arms; got ${arms.length}. One arm is an unsupported claim, not a question.`);
    const seen = new Set();
    for (const a of arms) {
      if (seen.has(a.arm_id)) errs.push(`${id}: duplicate arm_id ${a.arm_id}`);
      seen.add(a.arm_id);
      if (a.formalisable === false && !a.not_formalisable_because) errs.push(`${id}/${a.arm_id}: formalisable false needs not_formalisable_because`);
      for (const [i, e] of (a.evidence || []).entries()) {
        if (!['support', 'contradict', undefined].includes(e.side)) errs.push(`${id}/${a.arm_id}/evidence[${i}]: side must be support or contradict`);
        // belief-params.json `not_used[0]`: "A Lean proof of the claim's mathematical reading: it proves a
        // model's consequence, not that organisms obey the model." A proof that an arm is CONSISTENT is not
        // evidence that the arm is TRUE, so it must not raise that arm's belief. (Amit's ruling, 2026-11-01: the
        // belief gate applies to empirical regularities, not to model theorems.) The `lean-conflict` class is
        // sanctioned by belief-params.json for CONTRADICTION only, so it is allowed on the contradict side.
        // A Lean fact about the arms belongs in `exclusivity`, which is not an input to the proportion.
        const looksLean = /\blean\b|\bformalis|\btheorem\b|compiled/i.test(`${e.kind} ${e.claim}`);
        if ((e.side ?? 'support') === 'support' && looksLean) errs.push(`${id}/${a.arm_id}/evidence[${i}]: a Lean proof must not be SUPPORTING evidence for an arm (belief-params.json not_used[0]: it proves a model's consequence, not that organisms obey the model). Record the Lean fact in `+'`exclusivity`'+` instead, which is not an input to the computed proportion.`);
        if (e.belief_class === 'lean-conflict' && (e.side ?? 'support') !== 'contradict') errs.push(`${id}/${a.arm_id}/evidence[${i}]: belief-params.json defines the lean-conflict class for CONTRADICTION only`);
      }
      // An arm claiming a Lean ref must name a module that exists, or the record overstates what was formalised.
      if (a.lean_ref && a.lean_ref.module && !exists(R(a.lean_ref.module))) errs.push(`${id}/${a.arm_id}: lean_ref.module ${a.lean_ref.module} does not exist`);
    }
    // THE ASYMMETRY (pipeline/leanbio/debate/CRITERIA.md 1.2.0 precedence, encoded here).
    // A statement contradicted by an UNEDITED REAL ORGANISM in its own scope is wrong, not disputed. Two
    // measurements of the same system disagreeing with each other is an open question, because no organism
    // contradicts either. So:
    //   - an arm a wild type refutes is NOT a live position and must say so (`refuted_as_stated`);
    //   - it can never be the surviving arm of a settle;
    //   - and if EVERY arm is refuted by a wild type, there is no question left: it is a failed theorem.
    const live = arms.filter(a => !(a.wild_type_contradicted && a.wild_type_contradicted.within_scope !== false));
    for (const a of arms) {
      const w = a.wild_type_contradicted;
      if (!w) continue;
      if (w.within_scope !== false && w.refuted_as_stated !== true) errs.push(`${id}/${a.arm_id}: a wild-type organism contradicts this arm inside its own scope, so the arm is refuted as stated, not merely less believed. Set wild_type_contradicted.refuted_as_stated true (and carry any surviving weaker claim as its OWN arm), or set within_scope false with the reason.`);
      if (w.within_scope !== false && !(w.organisms || []).length) errs.push(`${id}/${a.arm_id}: wild_type_contradicted needs the organisms that contradict the arm`);
    }
    if (arms.length && !live.length) errs.push(`${id}: every arm is refuted by a wild-type organism in its own scope, so nothing is in question. Record this as a failed-theorem (contradicted_by: wild-type-organism), not an open question.`);
    if (rec.status === 'open' && arms.length > 1 && live.length === 1) errs.push(`${id}: only one arm (${live[0].arm_id}) is still a live position; the others are refuted by wild-type organisms. Either settle the question in favour of that arm, or carry the weaker surviving version of a refuted arm as its own arm so there is a real question.`);
    if (rec.status === 'settled' && rec.settled) {
      const sa = arms.find(a => a.arm_id === rec.settled.arm_id);
      if (sa && sa.wild_type_contradicted && sa.wild_type_contradicted.within_scope !== false) errs.push(`${id}: settled in favour of arm ${rec.settled.arm_id}, which a wild-type organism contradicts in its own scope. A question cannot be settled in favour of an arm real animals refute.`);
    }

    // Settling must say WHICH EVIDENCE settled it, and name a real arm.
    if (rec.status === 'settled') {
      const s = rec.settled;
      if (!s) errs.push(`${id}: status settled needs a 'settled' block`);
      else {
        if (!seen.has(s.arm_id)) errs.push(`${id}: settled.arm_id ${s.arm_id} is not an arm of this question`);
        if (!(s.evidence || []).length) errs.push(`${id}: settled needs the evidence that settled it`);
        if (/@|\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(String(s.approved_by_role || ''))) errs.push(`${id}: settled.approved_by_role must be a ROLE, never a personal identifier or e-mail`);
      }
    }
    if (rec.status === 'abandoned' && !(rec.abandoned && rec.abandoned.reason)) errs.push(`${id}: status abandoned needs abandoned.reason`);
    if (rec.status === 'open' && (rec.settled || rec.abandoned)) errs.push(`${id}: status open must not carry a settled or abandoned block`);
    // The guard's arm_signatures must name real arms, or the guard silently protects nothing.
    for (const armId of Object.keys(rec.guard?.arm_signatures || {})) if (!seen.has(armId)) errs.push(`${id}: guard.arm_signatures names unknown arm ${armId}`);
    for (const x of rec.guard?.scoped_exemptions || []) if (!seen.has(x.arm_id)) errs.push(`${id}: guard.scoped_exemptions names unknown arm ${x.arm_id}`);
    if (rec.exclusivity?.kind === 'proved-under-premise' && !rec.exclusivity.premise) errs.push(`${id}: exclusivity proved-under-premise needs the premise named`);
  }
  if (rec.record_type === 'failed-theorem') {
    if (rec.reason === 'provable-but-not-checkable' && !rec.reason_detail) {
      errs.push(`${id}: 'provable-but-not-checkable' is a requirements record under CRITERIA.md unless reason_detail says why the inputs are unobtainable`);
    }
    // The other side of the asymmetry: two measurements disagreeing with each other does NOT settle anything, so
    // a failure resting on that must justify why it is a settled failure rather than an open question.
    if (rec.contradicted_by === 'another-measurement-of-the-same-system' && !/open question|not an open question|settled because/i.test(String(rec.reason_detail || ''))) {
      errs.push(`${id}: contradicted_by 'another-measurement-of-the-same-system' does not by itself settle a statement -- two measurements disagreeing is an OPEN QUESTION. reason_detail must say why this is nevertheless settled, or move the record to questions/ with an arm per measurement.`);
    }
    if (rec.reason === 'fires-on-wild-type' && rec.contradicted_by && rec.contradicted_by !== 'wild-type-organism') {
      errs.push(`${id}: reason 'fires-on-wild-type' but contradicted_by is '${rec.contradicted_by}'`);
    }
    if (rec.contradicted_by === 'wild-type-organism' && !(rec.wild_type_failures || []).length) {
      errs.push(`${id}: contradicted_by 'wild-type-organism' needs wild_type_failures: the organisms that contradict it`);
    }
  }
  const want = contentHash(rec);
  if (rec.content_hash && rec.content_hash !== want) errs.push(`${id}: content_hash ${rec.content_hash.slice(0, 12)} != computed ${want.slice(0, 12)}; bump version if the content changed`);
  return errs;
}

// ── the reproducible proportion ─────────────────────────────────────────────
/**
 * Compute each arm's belief from its own evidence, via pipeline/leanbio/belief.mjs, and the share of total belief
 * each arm holds. This is how Amit's "or in different proportions" becomes a number rather than an opinion.
 *
 * Evidence listed under an arm with side 'support' supports that arm; 'contradict' counts against it. Items are
 * deduplicated by `belief_key` within a class, so one PMID cited twice counts once (belief-params.json
 * "independence").
 */
export async function proportionOf(rec) {
  const { belief, PARAMS } = await beliefEngine();
  const beliefs = {}, bases = {};
  for (const a of rec.arms || []) {
    const items = (a.evidence || []).map(e => ({ side: e.side || 'support', cls: e.belief_class, key: e.belief_key || e.source }));
    const b = belief(items);
    beliefs[a.arm_id] = b.belief;
    bases[a.arm_id] = { E: b.E, R: b.R, n: b.n, params: b.params };
  }
  const total = Object.values(beliefs).reduce((s, x) => s + x, 0);
  const shares = Object.fromEntries(Object.entries(beliefs).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 1000) / 1000 : 0]));
  return {
    computed_by: 'lean/registry/open-questions/openq-lib.mjs proportionOf() -> pipeline/leanbio/belief.mjs belief()',
    params_version: PARAMS.version,
    shares, beliefs, bases,
    note: total > 0
      ? 'share = this arm\'s belief / the sum over arms. Belief is E*(1-R) from the INDRA SimpleScorer form over the arm\'s OWN evidence; belief-params.json says plainly that its rand/syst values are hand-set and NOT fitted, so treat a share as an ordering of the arms, not a probability that an arm is true.'
      : 'every arm has belief 0: the evidence on each side is fully cancelled by the evidence against it. The shares are reported as 0, not as an even split, because an even split would assert a symmetry the formula did not find.',
    computed_at: new Date().toISOString(),
  };
}

/** Recompute `proportion` and each arm's `belief`/`belief_basis` in place. `--write` persists. */
export async function recompute({ write = false } = {}) {
  const out = [];
  for (const f of readDir(QUESTIONS_DIR)) {
    const p = path.join(QUESTIONS_DIR, f);
    const rec = readJson(p);
    const prop = await proportionOf(rec);
    for (const a of rec.arms || []) { a.belief = prop.beliefs[a.arm_id]; a.belief_basis = prop.bases[a.arm_id]; }
    rec.proportion = prop;
    rec.content_hash = contentHash(rec); // unchanged by the recompute: proportion is not a hashed field
    if (write) writeJson(p, rec);
    out.push({ question_id: rec.question_id, shares: prop.shares, beliefs: prop.beliefs });
  }
  return out;
}

// ── THE GUARD ───────────────────────────────────────────────────────────────
const norm = s => String(s ?? '').toLowerCase();

/** Every piece of text a law uses to say what it asserts. */
export function lawHaystack(law) {
  const parts = [law.statement_en, law.label, law.lean_ref?.theorem, law.lean_ref?.structure, law.lean_ref?.module];
  for (const h of law.hypotheses || []) parts.push(h.name, h.statement);
  for (const a of law.shared_scope?.atoms || []) parts.push(a);
  for (const q of Object.keys(law.shared_scope?.quantities || {})) parts.push(q, law.shared_scope.quantities[q]?.description);
  return norm(parts.filter(Boolean).join(' \n '));
}

/**
 * Does `law` assert one arm of an OPEN question?
 *
 * Three detectors, in decreasing certainty:
 *   (1) lean_ref  - the law points at the very declaration that states an arm. Certain.
 *   (2) declared  - the law carries `open_question_arm: {question_id, arm_id}`. The proposer said so.
 *   (3) signature - the law's own text contains every token of an arm's `guard.arm_signatures[arm].all_of`
 *                   and none of its `none_of`. Conservative: a signature is a hand-written token set in the
 *                   question's file, not a guess, so a false positive is a fixable error in a reviewed file.
 *
 * The ONLY ways past the guard:
 *   - settle (or abandon) the question, recording which evidence settled it; or
 *   - a SCOPED EXEMPTION, which needs a two-sided handshake: the question's `guard.scoped_exemptions` lists the
 *     law_id with the narrowing and an approving role, AND the law file carries `open_question_scoped` naming the
 *     same question. Either side alone is not enough, so no proposer can exempt itself.
 *
 * Returns {ok, violations:[{question_id, arm_id, via, statement_en, arms, proportion, what_would_settle_it,
 * refusal}], exemptions:[...]}.
 */
export function openQuestionGuard(law, { questions = openQuestions() } = {}) {
  const violations = [], exemptions = [];
  const hay = lawHaystack(law);
  const decls = [law.lean_ref?.theorem, law.lean_ref?.structure].filter(Boolean);

  for (const q of questions) {
    if (q.status !== 'open') continue;
    const hits = new Map(); // arm_id -> via

    for (const a of q.arms || []) {
      const armDecls = [a.lean_ref?.theorem, a.lean_ref?.structure].filter(Boolean);
      if (armDecls.some(d => decls.includes(d))) { hits.set(a.arm_id, `lean_ref: the law points at ${armDecls.filter(d => decls.includes(d)).join(', ')}, which IS arm "${a.arm_id}"`); continue; }
      const sig = q.guard?.arm_signatures?.[a.arm_id];
      if (sig && sig.all_of.every(t => hay.includes(norm(t))) && !(sig.none_of || []).some(t => hay.includes(norm(t)))) {
        hits.set(a.arm_id, `signature: the law's statement contains every token of arm "${a.arm_id}" [${sig.all_of.join(', ')}]`);
      }
    }
    if (law.open_question_arm?.question_id === q.question_id && law.open_question_arm.arm_id) {
      hits.set(law.open_question_arm.arm_id, `declared: the law file declares open_question_arm ${law.open_question_arm.arm_id}`);
    }

    for (const [arm_id, via] of hits) {
      // Scoped exemption needs BOTH sides of the handshake.
      const ex = (q.guard?.scoped_exemptions || []).find(x => x.law_id === law.law_id && x.arm_id === arm_id);
      const declared = law.open_question_scoped && law.open_question_scoped.question_id === q.question_id;
      if (ex && declared) { exemptions.push({ question_id: q.question_id, law_id: law.law_id, arm_id, how: ex.how, approved_by_role: ex.approved_by_role, via }); continue; }
      const armList = (q.arms || []).map(a => `  - ${a.arm_id} (${a.position}): ${a.statement_en}`).join('\n');
      const settle = (q.what_would_settle_it || []).map(w => `  - ${w.observation} -- ${w.how} (${w.feasible_today ? 'feasible today' : 'not feasible today'})`).join('\n');
      const halfHandshake = ex && !declared ? '\n  NOTE: the question lists a scoped exemption for this law, but the law file does not carry `open_question_scoped` naming the question. Both sides are required, so no proposer can exempt itself.'
        : declared && !ex ? '\n  NOTE: the law declares `open_question_scoped`, but the question does not list it in `guard.scoped_exemptions` with an approving role. Both sides are required.' : '';
      violations.push({
        question_id: q.question_id, arm_id, via, statement_en: q.statement_en,
        arms: (q.arms || []).map(a => ({ arm_id: a.arm_id, position: a.position, statement_en: a.statement_en, belief: a.belief ?? null })),
        proportion: q.proportion?.shares ?? null, what_would_settle_it: q.what_would_settle_it || [],
        exclusivity: q.exclusivity ?? null,
        refusal: `REFUSED: law "${law.law_id}" asserts arm "${arm_id}" of OPEN question ${q.question_id}, which this project holds unsettled.\n`
          + `  Question: ${q.statement_en}\n  Detected by ${via}.\n  Arms:\n${armList}\n`
          + `  Belief proportion (computed, pipeline/leanbio/belief.mjs): ${JSON.stringify(q.proportion?.shares ?? {})}\n`
          + `  What would settle it:\n${settle}\n`
          + `  To proceed, do ONE of:\n`
          + `   (a) settle ${q.question_id} -- set status 'settled' with the arm_id, the evidence that settled it and an approving role; or\n`
          + `   (b) narrow this law to the preparation the arm was measured in and register a SCOPED EXEMPTION on both sides: add {law_id, arm_id, how, approved_by_role} to ${q.question_id}'s guard.scoped_exemptions AND open_question_scoped to the law file; or\n`
          + `   (c) restate the law so it does not take a side.${halfHandshake}`,
      });
    }
  }
  return { ok: violations.length === 0, violations, exemptions };
}

/** Guard every law in the registry at once (used by check-exposed.mjs and the tests). */
export function guardAllLaws({ lawsDir = LAWS_DIR, laws = null, questions = openQuestions(), statuses = ['accepted', 'candidate'] } = {}) {
  const all = laws || loadLaws(lawsDir);
  const out = [];
  for (const law of all) {
    if (statuses && !statuses.includes(law.status)) continue;
    const g = openQuestionGuard(law, { questions });
    if (!g.ok) out.push({ law_id: law.law_id, status: law.status, violations: g.violations });
  }
  return out;
}

/** Keep guard.keywords in step with pipeline/leanbio/debate/open-disputes.json rather than letting them drift. */
export function disputeDrift({ reg = load() } = {}) {
  const p = R('pipeline', 'leanbio', 'debate', 'open-disputes.json');
  if (!exists(p)) return [];
  const disputes = readJson(p).disputes || [];
  const out = [];
  for (const q of reg.questions) {
    const did = q.guard?.dispute_id;
    if (!did) continue;
    const d = disputes.find(x => x.id === did);
    if (!d) { out.push(`${q.question_id}: guard.dispute_id "${did}" is not in open-disputes.json`); continue; }
    const missing = (d.keywords || []).filter(k => !(q.guard?.keywords || []).map(norm).includes(norm(k)));
    if (missing.length) out.push(`${q.question_id}: open-disputes.json dispute "${did}" has keywords this question does not: ${missing.join(', ')}`);
  }
  for (const d of disputes) if (!reg.questions.some(q => q.guard?.dispute_id === d.id)) out.push(`open-disputes.json dispute "${d.id}" has no open-question record; the dispute list says lean/registry/open-questions/ is its first-class home`);
  return out;
}

/** Statement drift: an arm's pinned statement_sha256 against the Lean source today. */
export function armDrift({ reg = load() } = {}) {
  const out = [];
  for (const q of reg.questions) for (const a of q.arms || []) {
    const r = a.lean_ref;
    if (!r?.module || !r.statement_sha256) continue;
    if (!exists(R(r.module))) { out.push(`${q.question_id}/${a.arm_id}: module ${r.module} missing`); continue; }
    const src = fs.readFileSync(R(r.module), 'utf8');
    const decl = r.structure || r.theorem;
    const t = decl ? statementText(src, decl) : null;
    if (!t) out.push(`${q.question_id}/${a.arm_id}: ${decl} not found in ${r.module}`);
    else if (sha256(t) !== r.statement_sha256) out.push(`${q.question_id}/${a.arm_id}: ${decl} statement changed (pinned ${r.statement_sha256.slice(0, 12)}, now ${sha256(t).slice(0, 12)}); bump the question's version`);
  }
  return out;
}

/** The public summary every surface serves (MCP, CLI, static mirror, the page). */
export function summary({ reg = load() } = {}) {
  return {
    counts: { questions: reg.questions.length, open: reg.questions.filter(q => q.status === 'open').length,
      settled: reg.questions.filter(q => q.status === 'settled').length, abandoned: reg.questions.filter(q => q.status === 'abandoned').length,
      failed_theorems: reg.failed.length, requirements: reg.requirements.length, promotion_requests: reg.requests.length },
    questions: reg.questions.map(q => ({ question_id: q.question_id, version: q.version, status: q.status, statement_en: q.statement_en,
      n_arms: (q.arms || []).length, arms: (q.arms || []).map(a => ({ arm_id: a.arm_id, position: a.position, formalised: !!(a.lean_ref && a.lean_ref.theorem), formalisable: a.formalisable, belief: a.belief ?? null })),
      proportion: q.proportion?.shares ?? null, exclusivity: q.exclusivity?.kind ?? null,
      touches: q.touches, settled: q.settled ? { arm_id: q.settled.arm_id, date: q.settled.date } : null, content_hash: q.content_hash })),
    failed_theorems: reg.failed.map(f => ({ failure_id: f.failure_id, version: f.version, reason: f.reason, statement_en: f.statement_en, what_survives: f.what_survives, became_open_question: f.became_open_question ?? null, content_hash: f.content_hash })),
    requirements: reg.requirements.map(r => ({ requirement_id: r.requirement_id, law_id: r.law_id ?? null, statement_en: r.statement_en, missing_inputs: r.missing_inputs, content_hash: r.content_hash })),
    promotion_requests: reg.requests.map(r => ({ request_id: r.request_id, law_id: r.law_id, blocked_by_open_questions: r.blocked_by_open_questions ?? [] })),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const reg = load();
  const J = v => process.stdout.write(JSON.stringify(v, null, 2) + '\n');
  if (cmd === 'list' || !cmd) J(summary({ reg }));
  else if (cmd === 'get') { const q = questionById(rest[0], reg) || reg.failed.find(f => f.failure_id === rest[0]) || reg.requirements.find(r => r.requirement_id === rest[0]); if (!q) { console.error(`no record ${rest[0]}`); process.exit(1); } J(q); }
  else if (cmd === 'failed') J(reg.failed);
  else if (cmd === 'recompute') J(await recompute({ write: rest.includes('--write') }));
  else if (cmd === 'guard') {
    const bad = guardAllLaws({ questions: openQuestions(reg), statuses: rest.includes('--all') ? null : ['accepted', 'candidate'] });
    if (!bad.length) { console.log('guard: no accepted or candidate law asserts an arm of an open question.'); process.exit(0); }
    for (const b of bad) for (const v of b.violations) console.error(v.refusal + '\n');
    process.exit(1);
  } else if (cmd === 'check') {
    const errs = [];
    for (const rec of reg.all) errs.push(...validateRecord(rec));
    errs.push(...disputeDrift({ reg }), ...armDrift({ reg }));
    const bad = guardAllLaws({ questions: openQuestions(reg) });
    for (const b of bad) errs.push(`GUARD: law ${b.law_id} (${b.status}) asserts an arm of an open question: ${b.violations.map(v => v.question_id + '/' + v.arm_id).join(', ')}`);
    if (errs.length) { errs.forEach(e => console.error('FAIL ' + e)); process.exit(1); }
    console.log(`ok: ${reg.questions.length} questions (${reg.questions.filter(q => q.status === 'open').length} open), ${reg.failed.length} failed theorems, ${reg.requirements.length} requirement records; no law asserts an open arm.`);
  } else { console.error('usage: node lean/registry/open-questions/openq-lib.mjs list|get <id>|failed|recompute [--write]|guard [--all]|check'); process.exit(2); }
}
