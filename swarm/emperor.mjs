#!/usr/bin/env node
// Emperor: decides the structure of the swarm. Pure control logic, no LLM call.
// Usage: node swarm/emperor.mjs [--ticks N] [--seed S] [--out swarm/state.json]
// Input: swarm/roster.json plus per-queen metrics (swarm/metrics.json if present).
// metrics.json is either a bare array of per-queen metrics or an object { queens: [...], arms: {...}, measured_from }
// written by swarm/compare/metrics.mjs from a real run. Without it a seeded simulation is used and the output is
// marked "simulated". The "arms" block (single vs isolated vs centralized vs decentralized scores) is passed through.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TICKS = +arg('ticks', 12);
let seed = +arg('seed', 20261031);
const OUT = arg('out', path.join(here, 'state.json'));
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const roster = JSON.parse(fs.readFileSync(path.join(here, 'roster.json'), 'utf8'));
const metricsPath = path.join(here, 'metrics.json');
const real = fs.existsSync(metricsPath);

// Policy knobs the emperor tunes.
const POLICY = {
  maxQueensPerKing: 5,        // beyond this a king's context window overflows: split the king
  stagnationThreshold: 0.25,  // novelty rate below this counts as stagnant
  stagnationPatience: 2,      // consecutive stagnant ticks before the king intervenes
  linkOverlap: 0.6,           // topic overlap above this lets two queens talk directly
  contextBudgetTokens: 120000 // per-queen average budget, redistributed by novelty
};

// A queen's metrics: novelty (new verified artifacts per unit work) and a topic vector.
function simulateMetrics(qs) {
  return qs.map(q => ({ id: q.id, novelty: 0.7 + 0.3 * rnd(), stale: 0, topic: Array.from({ length: 6 }, () => rnd() * 2 - 1), tokens: POLICY.contextBudgetTokens }));
}
const cosine = (a, b) => { let d = 0, na = 0, nb = 0; a.forEach((x, i) => { d += x * b[i]; na += x * x; nb += b[i] * b[i]; }); return na && nb ? d / Math.sqrt(na * nb) : 0; };

const metricsFile = real ? JSON.parse(fs.readFileSync(metricsPath, 'utf8')) : null;
const measuredQueens = metricsFile ? (Array.isArray(metricsFile) ? metricsFile : metricsFile.queens || []) : [];
const arms = metricsFile && !Array.isArray(metricsFile) ? metricsFile.arms || null : null;
const comparisons = metricsFile && !Array.isArray(metricsFile) ? metricsFile.comparisons || null : null;
const queens = real ? measuredQueens.map(q => ({ stale: 0, tokens: POLICY.contextBudgetTokens, ...q, topic: Array.isArray(q.topic) && q.topic.length === 6 ? q.topic : [0, 0, 0, 0, 0, 0] })) : simulateMetrics(roster.queens);
if (real && !queens.length) { console.error('metrics.json has no measured queens; refusing to run in measured mode'); process.exit(1); }
const log = [];
const kings = roster.kings.map(k => ({ ...k, queens: [] }));
const links = new Set();

for (let t = 1; t <= TICKS; t++) {
  const events = [];
  // 1. Metrics evolve (simulation only). Queens that keep exploring one topic lose novelty.
  if (!real) queens.forEach(q => {
    q.novelty = Math.max(0.02, q.novelty * (0.62 + 0.3 * rnd()));
    if (q.serendipitySince === t - 1) q.novelty = Math.min(1, q.novelty + 0.45 + 0.3 * rnd());
  });
  // 2. King: detect stagnation, force serendipity, or force a new field entirely.
  queens.forEach(q => {
    q.stale = q.novelty < POLICY.stagnationThreshold ? q.stale + 1 : 0;
    if (q.stale >= POLICY.stagnationPatience) {
      const f = roster.serendipity_fields[Math.floor(rnd() * roster.serendipity_fields.length)];
      const hardSwitch = (q.interventions || 0) >= 2;
      events.push({ tick: t, actor: 'king-content', action: hardSwitch ? 'force-new-field' : 'force-serendipity', target: q.id, field: f.field, prompt: f.prompt });
      q.interventions = hardSwitch ? 0 : (q.interventions || 0) + 1;
      q.serendipitySince = t; q.stale = 0;
      if (hardSwitch) q.topic = Array.from({ length: 6 }, () => rnd() * 2 - 1);
    }
  });
  // 3. Emperor: structure. Add kings so none exceeds the context cap.
  const need = Math.ceil(queens.length / POLICY.maxQueensPerKing);
  while (kings.length < need) {
    const id = 'king-' + (kings.length + 1);
    kings.push({ id, role: 'Added by the emperor to keep each king under the context cap.', queens: [] });
    events.push({ tick: t, actor: 'emperor', action: 'spawn-king', target: id, reason: `${queens.length} queens exceed ${POLICY.maxQueensPerKing} per king` });
  }
  kings.forEach(k => (k.queens = []));
  queens.forEach((q, i) => kings[i % kings.length].queens.push(q.id));
  // 4. Emperor: peer links where topics overlap; drop them when they stop overlapping.
  for (let i = 0; i < queens.length; i++) for (let j = i + 1; j < queens.length; j++) {
    const key = queens[i].id + '~' + queens[j].id;
    const ov = cosine(queens[i].topic, queens[j].topic);
    const want = ov > POLICY.linkOverlap;
    if (want && !links.has(key)) { links.add(key); events.push({ tick: t, actor: 'emperor', action: 'link', target: key, reason: `topic overlap ${ov.toFixed(2)}` }); }
    if (!want && links.has(key)) { links.delete(key); events.push({ tick: t, actor: 'emperor', action: 'unlink', target: key, reason: `overlap fell to ${ov.toFixed(2)}` }); }
  }
  // 5. Emperor: context budget proportional to novelty.
  const sum = queens.reduce((s, q) => s + q.novelty + 0.05, 0);
  queens.forEach(q => (q.tokens = Math.round(POLICY.contextBudgetTokens * queens.length * (q.novelty + 0.05) / sum)));
  log.push({ tick: t, events, novelty: Object.fromEntries(queens.map(q => [q.id, +q.novelty.toFixed(3)])) });
}

const byId = id => roster.queens.find(r => r.id === id) || {};
const out = {
  generated: new Date().toISOString(),
  mode: real ? 'measured' : 'simulated',
  note: real ? `MEASURED. Queen metrics read from swarm/metrics.json (run ${metricsFile.measured_from || 'unknown'}): novelty is each queen's verified-dataset rate per worker attempt in the centralized run; queens that never ran are not shown and not simulated.` : 'Novelty metrics are SIMULATED to exercise the control logic. No LLM agents produced them.',
  measured_from: real ? metricsFile.measured_from || null : null,
  unmeasured_queens: real ? metricsFile.unmeasured_queens || [] : [],
  arms, comparisons,
  policy: POLICY,
  kings: kings.map(k => ({ id: k.id, role: k.role, queens: k.queens })),
  queens: queens.map(q => ({ id: q.id, domain: byId(q.id).domain, workers: byId(q.id).workers, novelty: +q.novelty.toFixed(3), context_tokens: q.tokens, ...(real ? { attempts: q.attempts, verified: q.verified, tokens_used: q.tokens, calls: q.calls } : {}) })),
  links: [...links],
  log
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const ev = log.flatMap(l => l.events);
console.log(`${out.mode}: ${TICKS} ticks, ${ev.length} events (${ev.filter(e => e.action.startsWith('force')).length} king interventions, ${ev.filter(e => e.actor === 'emperor').length} emperor changes), ${kings.length} king(s), ${links.size} live links -> ${OUT}`);
