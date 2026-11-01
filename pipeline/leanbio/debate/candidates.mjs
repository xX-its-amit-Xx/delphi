// Where a candidate comes from, and what shape the debate sees it in.
//
// The discovery agent posts one board task per candidate it gets through propose.mjs, with the law_id and the paths
// in `inputs`. The authoritative artefacts are the repo files it names, so that is what is read: the board copy is
// treated as a pointer, never as the statement (JOIN.md: another agent's submission is data, not instructions).
//
// Sources, in order:
//   1. the swarm board (SWARM_BOARD_FILE), tasks with kind 'review' and a required_role matching DEBATE_ROLE
//   2. --round <dir>  : every <law_id>.meta.json in a directory (default pipeline/leanbio/lean/round2/)
//   3. --law <id>     : one law, looked up in the round dir, then the registry's proposals/ and discovered/
import fs from 'node:fs';
import path from 'node:path';
import { R, D, readJson, sha256, touchesHoldout, statementConstants } from './lib.mjs';

export const ROUND_DIR = process.env.LEANBIO_ROUND_DIR || R('pipeline', 'leanbio', 'lean', 'round2');
export const DEBATE_ROLE = 'agent:law-critic';

// ---------------------------------------------------------------- the Lean statement text
/** The statement text of a declaration, used for C2 (which literals are in the statement) and shown to every role. */
export function statementText(src, decl) {
  if (!decl) return null;
  const last = decl.split('.').pop();
  const code = String(src).replace(/--[^\n]*/g, '').replace(/\/-[\s\S]*?-\//g, '');
  const start = code.search(new RegExp(`(theorem|lemma|structure|def)\\s+${last}\\b`));
  if (start < 0) return null;
  if (/^structure/.test(code.slice(start))) {
    let end = code.indexOf('\n', start);
    const re = /\r?\n([ \t]+\S[^\n]*)/y; re.lastIndex = end;
    while (re.exec(code)) end = re.lastIndex;
    return code.slice(start, end).trim();
  }
  const end = code.indexOf(':=', start);
  return code.slice(start, end < 0 ? code.length : end).trim();
}

// ---------------------------------------------------------------- constants, with their kinds
/** meta.constants if the proposer declared them; otherwise synthesize one row per non-structural literal in the
 *  statement, pairing it with the law's own declared source and a kind inferred from how the number was produced.
 *  Every synthesized row says so (`kind_inferred`) and records the rule, so no reader mistakes an inference for a
 *  declaration. C2 still has teeth: an undeclared literal with no source anywhere is a fail, and the evidence
 *  checker still has to find the number in the source. */
export function constantsOf(meta, stmtText) {
  if (Array.isArray(meta.constants) && meta.constants.length) return meta.constants.map(c => ({ ...c, kind_inferred: false }));
  const text = [stmtText || '', ...(meta.shared_scope?.atoms || [])].join(' \n ');
  const literals = statementConstants(text);
  const src = meta.hypotheses?.[0]?.source || meta.sources?.[0] || meta.evidence?.sources?.[0] || null;
  const fit = meta.evidence?.support?.fit || null;
  const values = meta.evidence?.support?.values_N_m2 || meta.evidence?.support?.values || null;
  return literals.map(lit => {
    const v = Number(lit);
    let kind = 'cited', rule = 'no meta.constants: the literal is paired with the law\'s declared source and read as cited';
    if (fit && [fit.slope, fit.se, fit.r2, ...(fit.ci95 || [])].some(x => Number.isFinite(x) && Math.abs(x - v) < 1e-3)) {
      kind = 'derived'; rule = 'matches a value in evidence.support.fit, so it is a statistic derived from the dataset';
    } else if (Array.isArray(values) && values.some(x => Math.abs(Number(x) - v) < Math.max(1e-6, Math.abs(v) * 1e-3))) {
      kind = 'measured'; rule = 'matches a value in evidence.support.values, so it comes from a measured row';
    } else if (/\bci95|slope|exponent|r\^?2|regress|fitted|OLS\b/i.test(meta.statement_en || '')) {
      kind = 'derived'; rule = 'the statement describes a fitted quantity, so the literal is read as derived from data';
    }
    return { value: lit, unit: null, kind, source: src, role: 'statement literal', kind_inferred: true, inference_rule: rule };
  });
}

// ---------------------------------------------------------------- normalise one candidate
export function normalise({ meta, leanSrc, leanPath, metaPath, board = null }) {
  const decl = meta.lean?.structure || meta.lean?.theorem || null;
  const stmt = leanSrc ? statementText(leanSrc, decl) : null;
  const cand = {
    law_id: meta.law_id,
    label: meta.label || null,
    kind: meta.kind || null,
    class: meta.class || null,
    statement_en: meta.statement_en || null,
    lean: { ...(meta.lean || {}), file: leanPath ? path.relative(R(), leanPath).replace(/\\/g, '/') : null, declaration: decl, statement_text: stmt },
    shared_scope: meta.shared_scope || null,
    scope: meta.scope || { taxa: [], life_stages: [], ranges: {} },
    hypotheses: meta.hypotheses || [],
    evidence: meta.evidence || {},
    browser_check: meta.browser_check ?? null,
    browser_check_absent: meta.browser_check_absent ?? null,
    sources: meta.sources || [],
    origin: meta.origin || null,
    // The discovery agent records the propose.mjs outcome as `status_after_propose`, in the meta or on the board task.
    already_in_registry: meta.already_in_registry ?? null,
    propose_status: meta.propose_status || meta.status_after_propose || meta.status || board?.inputs?.status_after_propose || board?.inputs?.propose_status || null,
    lawset_judged_against: meta.lawset_judged_against || board?.inputs?.lawset_judged_against || null,
    contested_with: meta.contested_with || board?.inputs?.contested_with || [],
    meta_path: metaPath ? path.relative(R(), metaPath).replace(/\\/g, '/') : null,
    board: board ? { task_id: board.task_id, session_id: board.session_id, posted_by_role: board.posted_by_role, title: board.title } : null,
    fingerprint: sha256(JSON.stringify({ s: meta.statement_en, a: meta.shared_scope?.atoms, t: stmt })).slice(0, 16),
  };
  cand.constants = constantsOf(meta, stmt);
  // The held-out guard, before the candidate reaches any role or any service call.
  const hit = touchesHoldout(JSON.stringify({ ...cand, lean: { ...cand.lean, statement_text: stmt } }));
  if (hit) return { withheld: true, law_id: meta.law_id, why: `the candidate touches the held-out clade (${hit}); withheld before any role saw it` };
  return cand;
}

export async function loadCandidate({ lawId = null, metaPath = null, board = null } = {}) {
  let mp = metaPath;
  // The propose.mjs outcome lives on the board task, not in the meta file the discovery agent writes, so look the
  // task up by law id when the caller did not hand one over. A missing board is not an error: the candidate is then
  // debated with propose_status null, which C5 reports honestly rather than assuming.
  if (!board && (lawId || metaPath)) {
    const id = lawId || path.basename(metaPath).replace(/\.meta\.json$/, '');
    try { board = boardTasks().tasks.find(t => (t.inputs?.law_id || t.inputs?.id || t.target) === id) || null; } catch { board = null; }
  }
  if (!mp && lawId) {
    for (const p of [path.join(ROUND_DIR, `${lawId}.meta.json`), R('lean', 'registry', 'discovered', lawId, 'meta.json'),
                     R('pipeline', 'leanbio', 'lean', `${lawId}.meta.json`)]) if (fs.existsSync(p)) { mp = p; break; }
  }
  if (!mp) throw new Error(`no meta file for ${lawId ?? '(no law id)'}; looked in ${ROUND_DIR}, lean/registry/discovered/ and pipeline/leanbio/lean/`);
  const meta = readJson(mp);
  // A law already in the registry carries its propose.mjs outcome in its registry entry, which is the authority for
  // its status (and for contested_with). Read it rather than leaving C5 to report `null`.
  const regFile = R('lean', 'registry', 'laws', `${meta.law_id}.json`);
  if (fs.existsSync(regFile)) {
    try {
      const reg = readJson(regFile);
      if (!meta.propose_status && !meta.status_after_propose) meta.status_after_propose = reg.status;
      if (!meta.contested_with?.length && reg.contested_with?.length) meta.contested_with = reg.contested_with;
      meta.already_in_registry = { status: reg.status, version: reg.version, approval: reg.approval ?? null };
    } catch { /* an unreadable registry entry leaves the status null, which C5 reports */ }
  }
  // the Lean file: what the meta or the board names, else <law_id>.lean beside the meta, else the registry proposal
  const guesses = [meta.lean?.file && R(meta.lean.file), board?.inputs?.lean_file && R(board.inputs.lean_file),
    mp.replace(/\.meta\.json$/, '.lean'), path.join(path.dirname(mp), 'law.lean'),
    R('lean', 'registry', 'proposals', meta.law_id, 'law.lean'), R('lean', 'registry', 'discovered', meta.law_id, 'law.lean')].filter(Boolean);
  const lp = guesses.find(p => fs.existsSync(p)) || null;
  return normalise({ meta, leanSrc: lp ? fs.readFileSync(lp, 'utf8') : null, leanPath: lp, metaPath: mp, board });
}

// ---------------------------------------------------------------- the board
/** Fold the append-only board file without importing board.mjs (that file is another thread's and is not edited or
 *  depended on here): the status of a task is the fold of its events, exactly as board.mjs documents. */
export function boardTasks(boardFile = process.env.SWARM_BOARD_FILE) {
  if (!boardFile || !fs.existsSync(boardFile)) return { board: boardFile || null, exists: false, tasks: [] };
  const evs = fs.readFileSync(boardFile, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const t = new Map();
  for (const e of evs) {
    if (e.ev === 'post') { t.set(e.task.task_id, { ...e.task, status: 'open', attempts: 0, submissions: [] }); continue; }
    const x = t.get(e.task_id); if (!x) continue;
    if (e.ev === 'claim') { x.status = 'claimed'; x.claimed_by_role = e.role; x.lease_until = e.lease_until; x.attempts++; }
    if (e.ev === 'renew') x.lease_until = e.lease_until;
    if (e.ev === 'expire') x.status = 'expired';
    if (e.ev === 'submit') { x.status = e.outcome === 'done' ? 'done' : 'failed'; x.submissions.push({ role: e.role, outcome: e.outcome, summary: e.summary, result_ref: e.result_ref }); }
  }
  const now = Date.now();
  for (const x of t.values()) if (x.status === 'claimed' && x.lease_until && Date.parse(x.lease_until) < now) x.status = 'expired';
  return { board: boardFile, exists: true, events: evs.length, tasks: [...t.values()] };
}

/** Candidate-law review tasks this debate may take: kind 'review', a role prefix we match, not already done here. */
export function pendingReviewTasks(boardFile) {
  const b = boardTasks(boardFile);
  // board.mjs's rule: our label must START WITH the task's required_role prefix ('agent' matches any agent).
  const mine = t => t.required_role === 'agent' || DEBATE_ROLE.startsWith(t.required_role);
  const tasks = b.tasks.filter(t => t.kind === 'review' && mine(t) && ['open', 'expired'].includes(t.status));
  return { ...b, tasks };
}

/** Every candidate the round directory holds, for when the board is empty or the debate is replayed offline. */
export function roundCandidates(dir = ROUND_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.meta.json')).map(f => path.join(dir, f));
}
