#!/usr/bin/env node
// Runs one (level, arm) cell set of the benchmark pre-registered in swarm/benchmark/ARMS.md.
//
//   node swarm/benchmark/run.mjs --level validation --arm single|decentralised|centralised [--task l4-t1] [--tag x]
//
// N, model and the TOTAL budget per cell are fixed in ARMS.md and in BUDGET below, not on the command line.
// Writes runs/<level>/<arm>/<task>/ with one JSON per call (prompt, raw result, tokens, cost, timings) and
// final.json holding the single artifact the arm is scored on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runClaude, MODEL } from './agent.mjs';
import { LEVELS } from './levels.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

const N = 3;
const BUDGET_PER_CELL = 0.45;            // ARMS.md 1.1: equal TOTAL budget per cell, every arm
const CAP = { single: BUDGET_PER_CELL / 1, decentralised: BUDGET_PER_CELL / N, centralised: BUDGET_PER_CELL / (N + 2) };

const LEVEL = arg('level');
const ARM = arg('arm');
const ONLY = arg('task', null);
const TAG = arg('tag', '');
if (!LEVELS[LEVEL]) { console.error('need --level ' + Object.keys(LEVELS).join('|')); process.exit(2); }
if (!CAP[ARM]) { console.error('need --arm single|decentralised|centralised'); process.exit(2); }
const L = LEVELS[LEVEL];

const ROLE = {
  single: [
    'You are a single agent working alone. You do the whole task, end to end, yourself.',
    'You have no colleagues, no tools and no second pass: what you output is final.',
  ].join('\n'),
  decentralised: [
    'You are one of 3 agents working on this task INDEPENDENTLY and in parallel.',
    'You cannot see the other agents and they cannot see you. There is no shared state and no coordinator.',
    'Your answer will be compared with theirs and the one most agreed-with will be kept, so do the whole task',
    'yourself and do it the way you believe is right. Do not hedge and do not leave anything for someone else.',
  ].join('\n'),
  centralised_plan: [
    'You are the ORCHESTRATOR of a 3-agent team. You will not do the task yourself.',
    'Split the task below into exactly 3 subtasks that can be worked in parallel by 3 agents who each see the',
    'same shared input but only their own subtask instruction. Later you will see all 3 of their outputs and',
    'assemble the final answer yourself, so split the work where the pieces will recombine.',
  ].join('\n'),
  centralised_worker: [
    'You are one of 3 agents on a team led by an orchestrator. You do ONLY your assigned subtask.',
    'The orchestrator will see your output beside the other two agents\' and will assemble the final answer.',
    'Do your part completely and state plainly anything you could not settle, so the orchestrator can.',
  ].join('\n'),
  centralised_merge: [
    'You are the ORCHESTRATOR of a 3-agent team. Your 3 agents have reported. You decide what is kept and',
    'you emit the FINAL answer. You may take, correct, combine or discard any part of what they produced.',
    'Where they disagree, decide, and say in your notes why. The final answer is yours and is what is scored.',
  ].join('\n'),
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const tasks = L.tasks.filter(t => !ONLY || t.id === ONLY);
const cells = [];

for (const task of tasks) {
  const dir = path.join(here, 'runs', LEVEL, ARM, task.id + (TAG ? '-' + TAG : ''));
  fs.mkdirSync(dir, { recursive: true });
  const shared = L.sharedInput(task.meta);
  fs.writeFileSync(path.join(dir, 'shared-input.txt'), shared);
  const t0 = Date.now();
  const calls = [];
  let final = null, merge_note = null, candidates = null;

  const go = (role, extra, label, maxTurns = 10, schema = L.schema, cap = CAP[ARM]) =>
    runClaude({ prompt: `${role}\n\n${extra ? extra + '\n\n' : ''}${shared}`, schema, maxTurns, maxBudget: cap, label, logDir: dir });

  if (ARM === 'single') {
    const r = await go(ROLE.single, null, 'single', 12);
    calls.push(r.meta); final = r.parsed;
    if (!r.ok) { const r2 = await go(ROLE.single, null, 'single-retry', 12); calls.push(r2.meta); if (r2.ok) final = r2.parsed; }
  }

  if (ARM === 'decentralised') {
    const rs = await Promise.all([0, 1, 2].map(i => go(ROLE.decentralised, `You are agent ${i} of 3.`, `worker-${i}`, 10)));
    rs.forEach(r => calls.push(r.meta));
    candidates = rs.map((r, i) => ({ index: i, ok: r.ok, parsed: r.parsed }));
    // Retry any infra failure once (ARMS.md 5).
    for (const c of candidates) {
      if (!c.ok) { const r = await go(ROLE.decentralised, `You are agent ${c.index} of 3.`, `worker-${c.index}-retry`, 10); calls.push(r.meta); if (r.ok) { c.ok = true; c.parsed = r.parsed; } }
    }
    // Medoid vote, oracle-free (ARMS.md 3). Ties -> lowest index.
    const live = candidates.filter(c => c.ok);
    if (live.length === 1) { final = live[0].parsed; merge_note = { rule: 'medoid', kept: live[0].index, reason: 'only one live candidate' }; }
    else if (live.length) {
      const scored = live.map(c => ({ i: c.index, s: live.filter(o => o.index !== c.index).reduce((a, o) => a + L.similarity(c.parsed, o.parsed, task.meta), 0) / (live.length - 1) }));
      scored.sort((a, b) => b.s - a.s || a.i - b.i);
      final = live.find(c => c.index === scored[0].i).parsed;
      merge_note = { rule: 'medoid', kept: scored[0].i, mean_similarity: scored, n_live: live.length };
    }
  }

  if (ARM === 'centralised') {
    const planSchema = {
      type: 'object', additionalProperties: false, required: ['subtasks'],
      properties: { subtasks: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['title', 'instruction'], properties: { title: { type: 'string' }, instruction: { type: 'string' } } } } },
    };
    const plan = await go(ROLE.centralised_plan, null, 'orchestrator-plan', 8, planSchema);
    calls.push(plan.meta);
    const subs = plan.parsed?.subtasks?.length === 3 ? plan.parsed.subtasks
      : [0, 1, 2].map(i => ({ title: `part ${i + 1}`, instruction: `The orchestrator call failed, so you have no subtask split: do the whole task yourself as part ${i + 1} of 3.` }));
    const rs = await Promise.all(subs.map((s, i) => go(ROLE.centralised_worker, `YOUR SUBTASK (${i + 1} of 3): ${s.title}\n${s.instruction}`, `worker-${i}`, 10)));
    rs.forEach(r => calls.push(r.meta));
    candidates = rs.map((r, i) => ({ index: i, ok: r.ok, parsed: r.parsed, subtask: subs[i] }));
    const reports = candidates.map(c => `--- AGENT ${c.index} (${c.subtask.title}) ${c.ok ? 'REPORTED' : 'FAILED TO REPORT'} ---\n${c.ok ? JSON.stringify(c.parsed, null, 1).slice(0, 9000) : '(no output)'}`).join('\n\n');
    const m = await go(ROLE.centralised_merge, `THE SPLIT YOU CHOSE\n${subs.map((s, i) => `${i}: ${s.title} -- ${s.instruction}`).join('\n')}\n\nWHAT YOUR AGENTS REPORTED\n${reports}`, 'orchestrator-merge', 10);
    calls.push(m.meta); final = m.parsed;
    if (!m.ok) { const m2 = await go(ROLE.centralised_merge, `THE SPLIT YOU CHOSE\n${subs.map((s, i) => `${i}: ${s.title}`).join('\n')}\n\nWHAT YOUR AGENTS REPORTED\n${reports}`, 'orchestrator-merge-retry', 10); calls.push(m2.meta); if (m2.ok) final = m2.parsed; }
    merge_note = { rule: 'orchestrator decides', subtasks: subs.map(s => s.title) };
  }

  const cost = calls.reduce((a, c) => a + (c.cost_usd || 0), 0);
  const tok = calls.reduce((a, c) => ({ input: a.input + (c.usage?.input || 0), output: a.output + (c.usage?.output || 0), cache_read: a.cache_read + (c.usage?.cache_read || 0), cache_creation: a.cache_creation + (c.usage?.cache_creation || 0) }), { input: 0, output: 0, cache_read: 0, cache_creation: 0 });
  const cell = {
    level: LEVEL, arm: ARM, task: task.id, model: MODEL, N, budget_total_usd: BUDGET_PER_CELL, cap_per_call_usd: CAP[ARM],
    started: new Date(t0).toISOString(), wall_ms: Date.now() - t0,
    calls: calls.length, cost_usd: +cost.toFixed(5), tokens: tok, tokens_total: tok.input + tok.output + tok.cache_read + tok.cache_creation,
    infra_failures: calls.filter(c => c.infra_failure).length,
    cap_stops: calls.filter(c => /budget/i.test(String(c.terminal_reason || c.stop_reason || ''))).length,
    cli_errors: calls.filter(c => c.is_error).map(c => ({ label: c.label, error: c.error_text })),
    produced_artifact: final != null, merge: merge_note,
    call_meta: calls,
  };
  fs.writeFileSync(path.join(dir, 'final.json'), JSON.stringify({ cell, final, candidates: candidates?.map(c => ({ index: c.index, ok: c.ok, subtask: c.subtask?.title || null, parsed: c.parsed })) || null }, null, 1));
  fs.writeFileSync(path.join(dir, 'cell.json'), JSON.stringify(cell, null, 1));
  cells.push(cell);
  console.log(`[${LEVEL}/${ARM}/${task.id}] ${cell.calls} calls, $${cell.cost_usd}, ${(cell.wall_ms / 1000).toFixed(1)}s, ${cell.tokens_total} tok, artifact=${cell.produced_artifact}${cell.infra_failures ? `, INFRA FAILURES ${cell.infra_failures}` : ''}${cell.cap_stops ? `, cap stops ${cell.cap_stops}` : ''}`);
}

fs.writeFileSync(path.join(here, 'runs', LEVEL, ARM, `_cells-${stamp}.json`), JSON.stringify(cells, null, 1));
console.log(`done: ${LEVEL}/${ARM}, ${cells.length} cells, $${cells.reduce((a, c) => a + c.cost_usd, 0).toFixed(4)}, ${(cells.reduce((a, c) => a + c.wall_ms, 0) / 1000).toFixed(0)}s`);
