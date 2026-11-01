#!/usr/bin/env node
// The debate: four isolated roles, a fixed criteria file, mechanical hard gates, one verdict per candidate law.
//
//   node pipeline/leanbio/debate/debate.mjs --lock                 # fix and hash the criteria (do this first, once)
//   node pipeline/leanbio/debate/debate.mjs --poll [--for 40]       # poll the swarm board and debate candidates as they arrive
//   node pipeline/leanbio/debate/debate.mjs --law <id> [--law <id>] # debate named candidates
//   node pipeline/leanbio/debate/debate.mjs --round <dir>           # debate every <law_id>.meta.json in a directory
//   node pipeline/leanbio/debate/debate.mjs --law <id> --no-llm     # gates + evidence only, no worker invocations
//
//   --max-invocations 20   total headless `claude -p` calls across the whole run (hard stop)
//   --concurrency 3        at most this many workers alive at once
//   --model                default claude-sonnet-5-5
//   --offline              no network: evidence.mjs serves from cache/ only
//
// Writes out/rulings.json, out/run.json, transcripts/<law_id>/<role>.json, and queues a promotion request per
// survivor. Nothing is accepted: see promote.mjs and README.md.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { D, R, readJson, writeJson, nowIso, writeLock, requireLock, sha256 } from './lib.mjs';
import { loadCandidate, roundCandidates, pendingReviewTasks, ROUND_DIR, DEBATE_ROLE } from './candidates.mjs';
import { checkEvidence } from './evidence.mjs';
import { runGates, reconcile, overlappingAccepted, implicationProbe } from './referee.mjs';
import { runRole, cliAvailable } from './worker.mjs';
import { requestPromotion, writeCandidate, config, autoAcceptState } from './promote.mjs';

const argv = process.argv.slice(2);
const has = f => argv.includes(`--${f}`);
const val = (f, d = null) => { const i = argv.indexOf(`--${f}`); return i >= 0 ? argv[i + 1] : d; };
const all = f => argv.map((a, i) => (a === `--${f}` ? argv[i + 1] : null)).filter(Boolean);

const CFG = config();
const MODEL = val('model', CFG.model || 'claude-sonnet-5-5');
const MAX_INVOCATIONS = Number(val('max-invocations', 20));
const CONCURRENCY = Math.max(1, Number(val('concurrency', 3)));
const NO_LLM = has('no-llm');
if (has('offline')) process.env.DEBATE_OFFLINE = '1';

const state = { invocations: 0, inflight: 0, spent: 0, started: nowIso(), workers: [], stopped: null };
const log = (...m) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...m);

// ---------------------------------------------------------------- concurrency cap and the invocation budget
const waiters = [];
async function slot() {
  if (state.inflight < CONCURRENCY) { state.inflight++; return; }
  await new Promise(res => waiters.push(res)); state.inflight++;
}
function release() { state.inflight--; const w = waiters.shift(); if (w) w(); }

async function invoke({ role, blocks, lawId, maxBudget = 0.60, maxTurns = 14 }) {
  if (NO_LLM) return { ok: false, parsed: null, meta: { role, law_id: lawId, skipped: '--no-llm' } };
  if (state.invocations >= MAX_INVOCATIONS) {
    state.stopped ||= `invocation cap ${MAX_INVOCATIONS} reached`;
    log(`SKIP ${role}/${lawId}: ${state.stopped}`);
    return { ok: false, parsed: null, meta: { role, law_id: lawId, skipped: state.stopped } };
  }
  // Claim the budget slot BEFORE awaiting the concurrency slot: two callers that both pass the cap check and then
  // await can otherwise both increment past it (the first run logged "invocation 4/3").
  state.invocations++;
  await slot();
  log(`-> ${role} on ${lawId} (invocation ${state.invocations}/${MAX_INVOCATIONS}, ${state.inflight} in flight)`);
  try {
    const r = await runRole({ role, blocks, model: MODEL, lawId, maxBudget, maxTurns });
    if (r.meta.cost_usd) state.spent += r.meta.cost_usd;
    state.workers.push(r.meta);
    const dir = D('transcripts', lawId);
    fs.mkdirSync(dir, { recursive: true });
    writeJson(path.join(dir, `${role}.json`), { meta: r.meta, prompt: r.raw_prompt, answer: r.parsed, raw_final: r.meta.final_text });
    log(`<- ${role} on ${lawId}: ${r.ok ? 'ok' : 'NO PARSEABLE ANSWER'} (${r.meta.duration_s}s, $${(r.meta.cost_usd ?? 0).toFixed(3)}, ${r.meta.tool_calls.length} tool calls)`);
    return r;
  } finally { release(); }
}

// ---------------------------------------------------------------- one debate
async function debateOne(cand) {
  const lock = requireLock();
  if (cand.withheld) { log(`WITHHELD ${cand.law_id}: ${cand.why}`); return { withheld: true, ...cand }; }
  log(`==== ${cand.law_id} ====`);
  const accepted = overlappingAccepted(cand);
  const probes = accepted.slice(0, 5).map(a => ({ law_id: a.law_id, ...(implicationProbe(cand, a) || { reading: 'no shared quantity to probe' }) }));

  // (1) the instrument: GET every cited source and look for every quoted constant. Code, not an argument.
  const evidenceReport = await checkEvidence(cand);
  log(`evidence: ${evidenceReport.verdict} (${JSON.stringify(evidenceReport.summary)})`);

  // (2) the hard gates, from the repository's own data
  const gates = runGates(cand, { evidenceReport });
  log(`gates: C1 ${gates.C1.verdict}, C2 ${gates.C2.verdict}, C5 ${gates.C5.verdict}, C6 ${gates.C6.verdict}${gates.hard_fail.length ? `  HARD FAIL: ${gates.hard_fail.join(', ')}` : ''}`);

  // (3) the isolated cases. The proponent and the critic see the candidate and the accepted set, and NOT each other:
  //     they run as separate processes with separate prompts and no shared transcript.
  const forArguers = [['CANDIDATE', candidateBlock(cand)], ['ACCEPTED_LAWS_WITH_OVERLAPPING_SCOPE', accepted]];
  const [prop, crit] = await Promise.all([
    invoke({ role: 'proponent', blocks: forArguers, lawId: cand.law_id, maxBudget: 0.35, maxTurns: 6 }),
    invoke({ role: 'critic', blocks: [...forArguers, ['NO_BIRD_DATA', 'Class Aves is a frozen holdout: no bird may be used as a counterexample or cited.']], lawId: cand.law_id, maxBudget: 0.75, maxTurns: 16 }),
  ]);

  // (4) the evidence checker worker, which judges the instrument's output. Run when there is something to judge:
  //     a constant the matcher could not confirm, a hit that may be a coincidence, or --full-evidence.
  const needsChecker = has('full-evidence') || (evidenceReport.constants || []).some(c => c.verdict !== 'found')
    || (evidenceReport.constants || []).some(c => c.matched && String(c.matched.why || '').includes('rounded'));
  const check = needsChecker && (evidenceReport.constants || []).length
    ? await invoke({ role: 'evidence-checker', blocks: [['CANDIDATE', candidateBlock(cand)], ['FETCH_REPORT', evidenceReport]], lawId: cand.law_id, maxBudget: 0.60, maxTurns: 12 })
    : { ok: false, parsed: null, meta: { role: 'evidence-checker', law_id: cand.law_id, skipped: 'every constant was found verbatim in its cited source by the GET, with no rounding, so there was nothing for the checker to overturn' } };

  // (5) the referee: the first role to see everything, bound by the gates
  const ref = await invoke({ role: 'referee', lawId: cand.law_id, maxBudget: 0.55, maxTurns: 6, blocks: [
    ['CRITERIA', { version: lock.version, criteria_sha256: lock.criteria_sha256, text: fs.readFileSync(D('CRITERIA.md'), 'utf8') }],
    ['CANDIDATE', candidateBlock(cand)],
    ['GATES', { C1: gates.C1, C2: gates.C2, C5: gates.C5, C6: gates.C6, hard_fail: gates.hard_fail,
      open_dispute_match: gates.disputes,
      note: 'decided by code against the repository data; you cannot overturn a hard gate. If open_dispute_match flags a dispute, say whether this law asserts one of its arms: if it does, the verdict is CONTESTED and it may not be promoted while the question is open.' }],
    ['PROPONENT_CASE', prop.parsed ?? { error: 'the proponent worker returned no parseable case', skipped: prop.meta.skipped ?? null }],
    ['CRITIC_ATTACKS', crit.parsed ?? { error: 'the critic worker returned no parseable attacks', skipped: crit.meta.skipped ?? null }],
    ['EVIDENCE_FETCH_REPORT', evidenceReport],
    ['EVIDENCE_CHECKER_FINDING', check.parsed ?? { skipped: check.meta.skipped ?? 'not run' }],
    ['ACCEPTED_LAWS_WITH_OVERLAPPING_SCOPE', accepted],
    ['INDEPENDENCE_PROBES', probes],
  ] });

  // (6) reconcile: the gates bound the verdict the referee's reasons can carry
  const ruling = reconcile({ cand, gates, refereeOut: ref.parsed, proponentOut: prop.parsed, criticOut: crit.parsed, evidenceReport, checkerOut: check.parsed });
  ruling.independence_probes = probes;
  ruling.worker_meta = { proponent: prop.meta, critic: crit.meta, evidence_checker: check.meta, referee: ref.meta };
  log(`VERDICT ${cand.law_id}: ${ruling.verdict}${ruling.gate_disagreement ? ` (referee said ${ruling.gate_disagreement.referee_verdict}; a hard gate overrode it)` : ''}`);

  // (7) the automatic step, and where it stops
  let registry = null;
  if (ruling.verdict === 'PROMOTE-TO-CANDIDATE' && CFG.write_candidate_automatically && !has('no-write')) {
    registry = await writeCandidate(cand);
    log(`registry: ${registry.written ? `written as ${registry.status}` : `NOT written - ${registry.why ?? JSON.stringify(registry.reasons)}`}`);
  }
  if (['PROMOTE-TO-CANDIDATE', 'CONTESTED'].includes(ruling.verdict)) {
    requestPromotion({ ruling, registry });
    log(`queued a promotion request for a human: node pipeline/leanbio/debate/promote.mjs approve ${cand.law_id} --by human:project-lead`);
  }
  ruling.registry = registry;
  const { emitRecord } = await import('./records.mjs');
  ruling.record = emitRecord(ruling, cand);
  log(`record: ${ruling.record.type} -> ${ruling.record.file}`);
  return ruling;
}

/** What every role is handed about the candidate. One function, so no role quietly gets more than another. */
function candidateBlock(c) {
  return {
    law_id: c.law_id, label: c.label, class: c.class, kind: c.kind,
    statement_en: c.statement_en,
    lean: { declaration: c.lean.declaration, witness: c.lean.witness, file: c.lean.file, statement_text: c.lean.statement_text },
    shared_scope: c.shared_scope, scope: c.scope,
    constants: c.constants, hypotheses: c.hypotheses, evidence: c.evidence, sources: c.sources,
    browser_check: c.browser_check, browser_check_absent: c.browser_check_absent,
    propose_status: c.propose_status, contested_with: c.contested_with, origin: c.origin,
    provenance_note: 'A constant marked kind_inferred: true was not declared by the proposer; the kind was inferred by candidates.mjs from the evidence block and the rule is recorded. Treat an inferred kind as weaker than a declared one.',
  };
}

// ---------------------------------------------------------------- the board
async function boardSubmit(taskId, ruling) {
  try {
    // A Windows absolute path is not an ESM specifier: it must be a file:// URL, or the import fails with
    // "protocol 'd:' not supported" and every board submission is silently lost.
    const B = await import(pathToFileURL(path.join(R(), 'sim-engine', 'swarm', 'board.mjs')).href);
    await B.swarmClaim({ role: DEBATE_ROLE, task_id: taskId });
    await B.swarmSubmit({ task_id: taskId, role: DEBATE_ROLE, outcome: 'done',
      summary: `debate verdict ${ruling.verdict} for ${ruling.law_id} under criteria ${ruling.criteria_sha256.slice(0, 16)}`,
      findings: { verdict: ruling.verdict, criteria: ruling.criteria, ruling: ruling.ruling, needs_work: ruling.needs_work, reject_because: ruling.reject_because, registry: ruling.registry, queued_for_human: ['PROMOTE-TO-CANDIDATE', 'CONTESTED'].includes(ruling.verdict) } });
    return { submitted: true };
  } catch (e) { return { submitted: false, why: String(e.message || e).slice(0, 300) }; }
}

// ---------------------------------------------------------------- entry
async function main() {
  if (has('lock') || !fs.existsSync(D('criteria.lock.json'))) {
    const lock = writeLock({ force: has('force-lock') });
    log(`criteria locked: ${lock.version} sha256 ${lock.criteria_sha256}`);
    if (has('lock')) return;
  }
  requireLock();
  if (!NO_LLM) { const cli = cliAvailable(); log(`claude CLI: ${cli.ok ? cli.version : 'UNAVAILABLE - ' + cli.error}`); if (!cli.ok) throw new Error('the headless workers need the claude CLI on PATH and logged in'); }
  log(`auto-accept: ${autoAcceptState().enabled ? 'ON' : 'OFF'} - ${autoAcceptState().why}`);

  const rulings = [];
  const seen = new Set(existingRulings().map(r => r.law_id + '|' + r.fingerprint));
  const done = new Map(existingRulings().map(r => [r.law_id, r]));

  const todo = [];                      // [{cand, task_id?}]
  for (const id of all('law')) todo.push({ cand: await loadCandidate({ lawId: id }) });
  if (has('round')) for (const mp of roundCandidates(val('round', ROUND_DIR))) todo.push({ cand: await loadCandidate({ metaPath: mp }) });

  const deadline = Date.now() + Number(val('for', 0)) * 60_000;
  const pollEvery = Number(val('poll-every', 20)) * 1000;

  do {
    if (has('poll')) {
      const b = pendingReviewTasks(process.env.SWARM_BOARD_FILE);
      if (!b.exists) log(`board ${b.board ?? '(SWARM_BOARD_FILE unset)'} does not exist yet`);
      else log(`board: ${b.events} events, ${b.tasks.length} review task(s) claimable by ${DEBATE_ROLE}`);
      for (const t of b.tasks) {
        const id = t.inputs?.law_id || t.inputs?.id || t.target;
        if (!id || done.has(id) || todo.some(x => x.cand.law_id === id)) continue;
        try { todo.push({ cand: await loadCandidate({ lawId: id, board: t }), task_id: t.task_id }); log(`board -> ${id} (task ${t.task_id})`); }
        catch (e) { log(`board task ${t.task_id} names ${id} but it could not be loaded: ${e.message}`); }
      }
      // Also pick up anything the discovery agent dropped in the round directory without posting a task.
      for (const mp of roundCandidates(val('round', ROUND_DIR))) {
        const id = path.basename(mp).replace(/\.meta\.json$/, '');
        if (done.has(id) || todo.some(x => x.cand.law_id === id)) continue;
        try { todo.push({ cand: await loadCandidate({ metaPath: mp }) }); log(`round dir -> ${id}`); } catch { }
      }
    }

    while (todo.length) {
      const batch = todo.splice(0, 2);     // two laws in flight; the per-role cap is CONCURRENCY
      const out = await Promise.all(batch.map(async ({ cand, task_id }) => {
        if (seen.has(cand.law_id + '|' + cand.fingerprint)) { log(`already ruled on ${cand.law_id} at this fingerprint; skipping`); return null; }
        const r = await debateOne(cand);
        if (r && !r.withheld) { seen.add(cand.law_id + '|' + cand.fingerprint); done.set(cand.law_id, r); if (task_id) r.board = await boardSubmit(task_id, r); }
        return r;
      }));
      for (const r of out) if (r) rulings.push(r);
      persist(rulings);
      if (state.stopped) { log(`stopping: ${state.stopped}`); break; }
    }

    if (!has('poll') || Date.now() >= deadline || state.stopped) break;
    log(`nothing new; sleeping ${pollEvery / 1000}s (until ${new Date(deadline).toISOString().slice(11, 19)})`);
    await new Promise(r => setTimeout(r, pollEvery));
  } while (Date.now() < deadline && !state.stopped);

  persist(rulings);
  log(`done: ${rulings.length} ruling(s) this run, ${state.invocations} worker invocation(s), $${state.spent.toFixed(2)} reported by the CLI`);
  const counts = {};
  for (const r of [...done.values()]) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  log(`verdicts over all rulings: ${JSON.stringify(counts)}`);
}

function existingRulings() { const f = D('out', 'rulings.json'); return fs.existsSync(f) ? (readJson(f).rulings || []) : []; }
function persist(fresh) {
  const prev = existingRulings();
  const byKey = new Map(prev.map(r => [r.law_id, r]));
  for (const r of fresh) if (r && !r.withheld) byKey.set(r.law_id, r);
  const rulings = [...byKey.values()];
  const lock = requireLock();
  writeJson(D('out', 'rulings.json'), { version: 'leanbio-debate-rulings/1.0.0', generated: nowIso(),
    criteria_version: lock.version, criteria_sha256: lock.criteria_sha256,
    counts: rulings.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] || 0) + 1 }), {}), rulings });
  writeJson(D('out', 'run.json'), { ...state, model: MODEL, max_invocations: MAX_INVOCATIONS, concurrency: CONCURRENCY,
    finished: nowIso(), criteria_sha256: lock.criteria_sha256, no_llm: NO_LLM, offline: process.env.DEBATE_OFFLINE === '1' });
}

if (process.argv[1]?.endsWith('debate.mjs')) main().catch(e => { console.error('\nFAILED: ' + (e.stack || e.message)); process.exit(1); });
