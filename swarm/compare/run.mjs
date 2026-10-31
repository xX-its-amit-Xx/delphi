#!/usr/bin/env node
// Runs one arm of the pre-registered comparison (swarm/PREREG.md).
// Usage: node swarm/compare/run.mjs --arm single|isolated|centralized|decentralized
//        [--budget 3] [--wall 45] [--model claude-sonnet-5-5] [--limit N] [--tag name]
// Every LLM call is one headless `claude -p` process with WebFetch+WebSearch only, run from a scratch dir.
// Output: swarm/compare/runs/<arm>-<timestamp>/ with one JSON per worker call, plans/, verify/, log.jsonl, summary.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyPlan, pageText, nameTokens } from './verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ARM = arg('arm');
if (!['single', 'isolated', 'centralized', 'decentralized'].includes(ARM)) { console.error('need --arm single|isolated|centralized|decentralized'); process.exit(2); }
// Experiment 2 (--exp 2, see PREREG.md "Experiment 2"): claims2/prompt2/schema2, web fetch REQUIRED and evidenced,
// a hard cost cap (no launch unless the worst case of everything in flight still fits), and tool calls counted
// from the CLI event stream.
const EXP = +arg('exp', 1);
const BUDGET = +arg('budget', EXP === 2 ? 8 : 3);
const WALL_MIN = +arg('wall', 45);
const MODEL = arg('model', 'claude-sonnet-5-5');
const LIMIT = +arg('limit', 0);
const TAG = arg('tag', '');
const CALL_CAP = +arg('call-cap', EXP === 2 ? 0.6 : 0.5);        // per worker call, enforced by the CLI
const MAX_TURNS_WORKER = EXP === 2 ? 20 : 12, MAX_TURNS_SINGLE = EXP === 2 ? 250 : 60, MAX_EXTRA_ATTEMPTS = 2, TOTAL_CONCURRENCY = 6;
const SCRATCH = process.platform === 'win32' ? 'C:\\Temp\\delphi-swarm-scratch' : path.join(process.env.HOME || '/tmp', 'delphi-swarm-scratch');
fs.mkdirSync(SCRATCH, { recursive: true });

const sfx = EXP === 2 ? '2' : '';
const claimsFile = JSON.parse(fs.readFileSync(path.join(here, `claims${sfx}.json`), 'utf8'));
let CLAIMS = claimsFile.claims; if (LIMIT) CLAIMS = CLAIMS.slice(0, LIMIT);
const PROMPT = fs.readFileSync(path.join(here, `prompt${sfx}.md`), 'utf8');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(here, `plan${sfx}.schema.json`), 'utf8'));
const BRIEFS = JSON.parse(fs.readFileSync(path.join(here, 'briefs.json'), 'utf8'));
const ROSTER = JSON.parse(fs.readFileSync(path.join(here, '..', 'roster.json'), 'utf8'));
const QUEENS = ['q-evolution', 'q-morphology', 'q-holdout'];
const queenFor = c => QUEENS.find(q => BRIEFS[q].claims_from === c.thinker) || 'q-holdout';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN = path.join(here, 'runs', `${EXP === 2 ? 'exp2-' : ''}${ARM}-${stamp}${TAG ? '-' + TAG : ''}`);
for (const d of ['calls', 'plans', 'verify']) fs.mkdirSync(path.join(RUN, d), { recursive: true });
const logf = fs.createWriteStream(path.join(RUN, 'log.jsonl'), { flags: 'a' });
const log = (ev) => { const e = { t: new Date().toISOString(), ...ev }; logf.write(JSON.stringify(e) + '\n'); console.log(`[${e.t.slice(11, 19)}] ${e.actor || ''} ${e.action} ${e.target || ''} ${e.note || ''}`.trim()); return e; };

// ---------- shared state (identical bookkeeping for every arm) ----------
const S = { spent: 0, calls: 0, inflight: 0, firstStart: null, lastEnd: null, verified: new Set(), attempts: {}, duplicated: 0, tokens: { input: 0, output: 0, cache_read: 0, cache_creation: 0 }, agentMs: 0, web: { search: 0, fetch: 0 }, stopped: null };
const elapsedMin = () => S.firstStart ? (Date.now() - S.firstStart) / 60000 : 0;
function budgetLeft(reason) {
  // Experiment 1: soft cap (checked against money already spent; calls in flight may overshoot).
  // Experiment 2: hard cap (a launch is refused unless spent + worst case of every call in flight + this call <= cap).
  const worst = EXP === 2 ? S.spent + (S.inflight + 1) * CALL_CAP : S.spent;
  const over = EXP === 2 ? worst > BUDGET : S.spent >= BUDGET;
  if (over) { S.stopped ||= 'budget'; log({ actor: 'orchestrator', action: 'stop', note: `budget cap $${BUDGET} reached (spent $${S.spent.toFixed(2)}${EXP === 2 ? `, ${S.inflight} in flight at up to $${CALL_CAP} each` : ''})` + (reason ? ' before ' + reason : '') }); return false; }
  if (elapsedMin() >= WALL_MIN) { S.stopped ||= 'wall'; log({ actor: 'orchestrator', action: 'stop', note: `wall cap ${WALL_MIN} min reached` }); return false; }
  return true;
}

function claimText(c) {
  return `CLAIM\nid: ${c.id}\nthinker: ${c.thinker}, ${c.work} (${c.year}), ${c.chapter}\nkind: ${c.kind}\nlabel: ${c.label}\nstatement: ${c.statement}\nquote (verbatim): "${c.quote}"`;
}

// One headless agent call. Returns { ok, plan|plans, meta }.
function runClaude({ prompt, schema, maxTurns, maxBudget, label }) {
  return new Promise((resolve) => {
    const viaStdin = prompt.length > 8000 || process.env.SWARM_STDIN === '1';
    // stream-json gives every tool call (WebFetch/WebSearch are client-side tools, so the API's server_tool_use
    // counters stay at 0 for them); the final "result" event carries the same fields as --output-format json.
    const args = ['-p', ...(viaStdin ? [] : [prompt]), '--model', MODEL, '--tools', 'WebFetch', 'WebSearch', '--allowedTools', 'WebFetch', 'WebSearch',
      '--json-schema', JSON.stringify(schema), '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--max-turns', String(maxTurns), '--max-budget-usd', String(maxBudget)];
    const t0 = Date.now(); if (!S.firstStart) S.firstStart = t0; S.inflight++;
    const child = spawn('claude', args, { cwd: SCRATCH, stdio: [viaStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true });
    if (viaStdin) { child.stdin.on('error', () => { }); child.stdin.end(prompt); }
    let out = '', err = '';
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    child.on('close', (code) => {
      const t1 = Date.now(); S.lastEnd = t1; S.calls++; S.inflight--; S.agentMs += t1 - t0;
      const events = out.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      let r = events.find(e => e.type === 'result') || null;
      if (!r) { try { r = JSON.parse(out); } catch { } }
      const toolCalls = events.filter(e => e.type === 'assistant').flatMap(e => e.message?.content || []).filter(b => b.type === 'tool_use');
      const fetched = toolCalls.filter(b => b.name === 'WebFetch').map(b => b.input?.url).filter(Boolean);
      const searched = toolCalls.filter(b => b.name === 'WebSearch').map(b => b.input?.query).filter(Boolean);
      const meta = { label, code, via_stdin: viaStdin, prompt_chars: prompt.length, duration_ms: t1 - t0, cost_usd: r?.total_cost_usd ?? null, num_turns: r?.num_turns ?? events.filter(e => e.type === 'assistant').length, stop_reason: r?.stop_reason ?? null, terminal_reason: r?.terminal_reason ?? null,
        usage: r?.usage ? { input: r.usage.input_tokens, output: r.usage.output_tokens, cache_read: r.usage.cache_read_input_tokens, cache_creation: r.usage.cache_creation_input_tokens } : null,
        web: { web_search_requests: searched.length, web_fetch_requests: fetched.length }, fetched_urls: fetched, search_queries: searched, is_error: !!r?.is_error, error_text: r?.is_error ? String(r.result || '').slice(0, 300) : null,
        model_usage: r?.modelUsage ? Object.keys(r.modelUsage) : null, stderr: err.slice(0, 500) };
      if (r?.total_cost_usd) S.spent += r.total_cost_usd;
      if (meta.usage) { S.tokens.input += meta.usage.input || 0; S.tokens.output += meta.usage.output || 0; S.tokens.cache_read += meta.usage.cache_read || 0; S.tokens.cache_creation += meta.usage.cache_creation || 0; }
      S.web.search += searched.length; S.web.fetch += fetched.length;
      fs.writeFileSync(path.join(RUN, 'calls', `${String(S.calls).padStart(3, '0')}-${label}.json`), JSON.stringify({ meta, raw: r, tool_calls: toolCalls.map(b => ({ name: b.name, input: b.input })), stdout_if_unparsed: r ? undefined : out.slice(0, 4000) }, null, 1));
      let parsed = r?.structured_output ?? null;
      if (parsed == null && typeof r?.result === 'string') { const m = /```(?:json)?\s*([\s\S]*?)```/.exec(r.result); try { parsed = JSON.parse(m ? m[1] : r.result); } catch { parsed = null; } }
      resolve({ ok: parsed != null, parsed, meta });
    });
  });
}

const norm = u => String(u || '').toLowerCase().replace(/\/+$/, '');
async function verifyAndRecord(claim, plan, attemptLabel, by, meta) {
  S.attempts[claim.id] = (S.attempts[claim.id] || 0) + 1;
  if (!plan) { log({ actor: by, action: 'worker-failed', target: claim.id, note: meta?.error_text ? 'CLI error: ' + meta.error_text : 'no parseable plan' }); return { verified: false, note: 'The previous attempt produced no parseable plan.' }; }
  if (plan.claim_id !== claim.id) plan.claim_id_reported = plan.claim_id, plan.claim_id = claim.id;
  fs.writeFileSync(path.join(RUN, 'plans', `${claim.id}.${attemptLabel}.json`), JSON.stringify(plan, null, 1));
  const v = await verifyPlan(plan);
  const ds = plan.dataset;
  // Experiment 2: the agent must have fetched the landing page itself. Evidence = (a) the call that wrote this plan
  // made a WebFetch of the landing URL or the DOI (from the CLI event stream), and (b) the page title the agent reports
  // shares a distinctive word with what our checker saw on that page (or the checker saw no title at all, e.g. a JSON API).
  if (EXP === 2) {
    const fetchedUrls = (meta?.fetched_urls || []).map(norm);
    const targets = ds ? [ds.landing_url, ds.doi ? (/^https?:/.test(ds.doi) ? ds.doi : 'https://doi.org/' + ds.doi) : null, plan.fetched?.url].filter(Boolean).map(norm) : [];
    const agentFetchedTarget = targets.some(t => fetchedUrls.some(f => f === t || f.startsWith(t + '?') || t.startsWith(f.split('?')[0]) && f.split('?')[0].length > 12));
    const seen = ds ? pageText(ds.landing_url) || '' : '';
    const checkerTitle = v.identifiers.find(i => ds && norm(i.url) === norm(ds.landing_url))?.title;
    const toks = nameTokens(plan.fetched?.page_title || '', '');
    const titleAgrees = !ds ? false : (checkerTitle == null ? true : toks.some(t => seen.toLowerCase().includes(t)));
    v.agent_fetch = { fetched_urls: meta?.fetched_urls || [], searches: meta?.search_queries || [], fetched_target: agentFetchedTarget, reported: plan.fetched || null, checker_title: checkerTitle || null, title_agrees: titleAgrees };
    v.checker_verified = v.dataset_verified;
    v.dataset_verified = v.dataset_verified && agentFetchedTarget && titleAgrees;
  }
  fs.writeFileSync(path.join(RUN, 'verify', `${claim.id}.${attemptLabel}.json`), JSON.stringify(v, null, 1));
  let note;
  if (!ds) note = `The previous attempt named no dataset (reason given: ${plan.no_dataset_reason || 'none'}).`;
  else if (v.fabricated.length) note = `The previous attempt's identifier(s) do not exist: ${v.fabricated.join(', ')} (HTTP 404 or DOI not found). Do not reuse them.`;
  else if (!v.dataset_resolves) note = `The previous attempt's landing URL ${ds.landing_url} could not be confirmed (status ${v.identifiers.find(i => i.url === ds.landing_url)?.status ?? 'error'}). Name a dataset whose landing page is reachable, or a different page for the same dataset.`;
  else if (!v.name_match) note = `The previous attempt's URL ${ds.landing_url} resolves but the page does not mention "${ds.name}" (page title: ${v.identifiers.find(i => i.url === ds.landing_url)?.title || 'none'}). Give the dataset's own landing page.`;
  else if (EXP === 2 && !v.agent_fetch.fetched_target) note = `The previous attempt named ${ds.landing_url} but never fetched it with WebFetch (the run log shows no fetch of that URL). Fetch the landing page before naming it and report the title you saw.`;
  else if (EXP === 2 && !v.agent_fetch.title_agrees) note = `The previous attempt reported the page title "${plan.fetched?.page_title || ''}" for ${ds.landing_url}, but the page our checker fetched is titled "${v.agent_fetch.checker_title}". Fetch the page and report its real title.`;
  log({ actor: by, action: v.dataset_verified ? 'verified' : 'unverified', target: claim.id, note: v.dataset_verified ? `${ds.publisher}: ${ds.name}` : note });
  if (v.dataset_verified) S.verified.add(claim.id);
  return { verified: v.dataset_verified, note, v };
}

async function pool(items, n, fn) { const q = [...items]; const run = async () => { while (q.length) { const it = q.shift(); await fn(it); } }; await Promise.all(Array.from({ length: Math.min(n, items.length) }, run)); }

// ---------- arms ----------
async function armSingle() {
  const brief = QUEENS.map(q => `[${q}] ${BRIEFS[q].brief}`).join('\n\n');
  const prompt = `${PROMPT}\n\nThere are ${CLAIMS.length} claims. Produce one plan per claim and output a JSON object { "plans": [...] } holding ${CLAIMS.length} plan objects in the same order, nothing else.\n\nDATA PORTALS YOU KNOW WELL\n${brief}\n\n` + CLAIMS.map(claimText).join('\n\n');
  // The API requires an object at the schema root, so the array of plans is wrapped in { plans: [...] }.
  const schema = { type: 'object', additionalProperties: false, required: ['plans'], properties: { plans: { type: 'array', items: SCHEMA, minItems: CLAIMS.length, maxItems: CLAIMS.length } } };
  log({ actor: 'single', action: 'start', note: `${CLAIMS.length} claims in one call` });
  const r = await runClaude({ prompt, schema, maxTurns: MAX_TURNS_SINGLE, maxBudget: BUDGET, label: 'single-all' });
  const plans = Array.isArray(r.parsed?.plans) ? r.parsed.plans : Array.isArray(r.parsed) ? r.parsed : [];
  const seen = new Set();
  for (const c of CLAIMS) {
    const mine = plans.filter(p => p?.claim_id === c.id);
    if (!mine.length) { log({ actor: 'single', action: 'untouched', target: c.id }); continue; }
    if (mine.length > 1) S.duplicated += mine.length - 1;
    await verifyAndRecord(c, mine[0], 'a1', 'single', r.meta);
    seen.add(c.id);
  }
}

async function armIsolated() {
  await pool(CLAIMS, 5, async (c) => {
    if (!budgetLeft(c.id)) return;
    const q = queenFor(c);
    const prompt = `${PROMPT}\n\nDATA PORTALS YOU KNOW WELL\n${BRIEFS[q].brief}\n\n${claimText(c)}`;
    const r = await runClaude({ prompt, schema: SCHEMA, maxTurns: MAX_TURNS_WORKER, maxBudget: 0.5, label: `${c.id}-w1` });
    await verifyAndRecord(c, r.parsed, 'a1', 'worker', r.meta);
  });
}

let seed = 20261031; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
async function armCentralized() {
  // Emperor: structure only. Two active queens get the concurrency; q-holdout is reserved for escalations.
  const active = QUEENS.filter(q => CLAIMS.some(c => queenFor(c) === q));
  const conc = Object.fromEntries(active.map(q => [q, Math.max(1, Math.floor(TOTAL_CONCURRENCY / active.length))]));
  conc['q-holdout'] ||= 2;
  log({ actor: 'emperor', action: 'set-structure', note: `1 king, queens ${active.join(', ')} (${JSON.stringify(conc)} parallel workers), q-holdout reserved for escalation` });
  // King: assigns claims by domain.
  const assign = Object.fromEntries(QUEENS.map(q => [q, []]));
  for (const c of CLAIMS) assign[queenFor(c)].push(c);
  for (const q of active) log({ actor: 'king-content', action: 'assign', target: q, note: `${assign[q].length} claims` });
  const streak = Object.fromEntries(QUEENS.map(q => [q, 0]));
  const notes = {};
  const work = async (q, c, attempt, extra) => {
    if (!budgetLeft(c.id)) return;
    if (S.verified.has(c.id)) { S.duplicated++; }
    let prompt = `${PROMPT}\n\nDATA PORTALS YOU KNOW WELL\n${BRIEFS[q].brief}\n\n`;
    if (notes[c.id]) prompt += `FEEDBACK FROM THE VERIFIER ON A PREVIOUS ATTEMPT\n${notes[c.id]}\n\n`;
    if (extra) prompt += `A PROMPT FROM THE KING (think about it, then answer the task)\n${extra}\n\n`;
    prompt += claimText(c);
    const r = await runClaude({ prompt, schema: SCHEMA, maxTurns: MAX_TURNS_WORKER, maxBudget: 0.5, label: `${c.id}-${q}-a${attempt}` });
    const res = await verifyAndRecord(c, r.parsed, `a${attempt}`, q, r.meta);
    if (res.verified) streak[q] = 0; else { streak[q]++; notes[c.id] = res.note; }
  };
  // Pass 1: each queen runs its own claims in parallel.
  await Promise.all(active.map(q => pool(assign[q], conc[q], c => work(q, c, 1))));
  // Pass 2: king reviews; one retry with the same queen, with serendipity if the queen is stagnating.
  const failed1 = CLAIMS.filter(c => !S.verified.has(c.id));
  log({ actor: 'king-content', action: 'review', note: `${S.verified.size}/${CLAIMS.length} verified after pass 1; ${failed1.length} retries` });
  await Promise.all(active.map(q => pool(failed1.filter(c => queenFor(c) === q), conc[q], c => {
    let extra = null;
    if (streak[q] >= 2) { const f = ROSTER.serendipity_fields[Math.floor(rnd() * ROSTER.serendipity_fields.length)]; extra = `${f.field}: ${f.prompt}`; log({ actor: 'king-content', action: 'force-serendipity', target: q, note: f.field }); }
    return work(q, c, 2, extra);
  })));
  // Pass 3: escalate what is still unverified to the curator queen.
  const failed2 = CLAIMS.filter(c => !S.verified.has(c.id));
  log({ actor: 'king-content', action: 'escalate', target: 'q-holdout', note: `${failed2.length} claims still unverified` });
  await pool(failed2, conc['q-holdout'], c => work('q-holdout', c, 3));
}

async function armDecentralized() {
  const boardPath = path.join(RUN, 'board.json');
  const board = { tickets: CLAIMS.map(c => ({ claim_id: c.id, thinker: c.thinker, state: 'open', attempts: [] })), tips: [], messages: [] };
  const save = () => fs.writeFileSync(boardPath, JSON.stringify(board, null, 1));
  save();
  const tk = id => board.tickets.find(t => t.claim_id === id);
  const claim = id => CLAIMS.find(c => c.id === id);
  // Each queen chooses for itself; no planner. Concurrency per queen is a fixed 2 (6 total, same as the centralized arm).
  const pick = (q) => {
    const mine = t => BRIEFS[q].claims_from === t.thinker;
    const triedByMe = t => t.attempts.some(a => a.queen === q);
    const open = board.tickets.filter(t => t.state === 'open');
    const gaps = board.tickets.filter(t => t.state === 'gap' && !triedByMe(t) && t.attempts.length < 1 + MAX_EXTRA_ATTEMPTS);
    return open.find(mine) || gaps.find(t => !mine(t)) || gaps[0] || open[0] || null;
  };
  const queenLoop = async (q, slot) => {
    while (true) {
      if (!budgetLeft(q)) return;
      const t = pick(q); if (!t) { log({ actor: q, action: 'idle', note: `slot ${slot}: nothing left to pull` }); return; }
      const prev = t.state; t.state = 'claimed'; t.claimed_by = q; save();
      const c = claim(t.claim_id);
      if (S.verified.has(c.id)) S.duplicated++;
      let prompt = `${PROMPT}\n\nDATA PORTALS YOU KNOW WELL\n${BRIEFS[q].brief}\n\n`;
      if (board.tips.length) prompt += `TIPS POSTED BY OTHER AGENTS ON THE SHARED BOARD\n${board.tips.slice(-6).map(x => '- ' + x).join('\n')}\n\n`;
      const lastGap = t.attempts.filter(a => a.note).slice(-1)[0];
      if (prev === 'gap' && lastGap) prompt += `GAP NOTE POSTED BY ${lastGap.queen}\n${lastGap.note}\n\n`;
      prompt += claimText(c);
      log({ actor: q, action: prev === 'gap' ? 'pull-gap' : 'pull', target: c.id, note: lastGap ? `after ${lastGap.queen}` : '' });
      const r = await runClaude({ prompt, schema: SCHEMA, maxTurns: MAX_TURNS_WORKER, maxBudget: 0.5, label: `${c.id}-${q}-a${t.attempts.length + 1}` });
      const res = await verifyAndRecord(c, r.parsed, `a${t.attempts.length + 1}`, q, r.meta);
      t.attempts.push({ queen: q, verified: res.verified, note: res.verified ? null : res.note, at: new Date().toISOString() });
      if (res.verified) { t.state = 'done'; const p = r.parsed?.dataset; if (p) board.tips.push(`${q}: for ${c.id} (${c.thinker.split(' ').pop()}) the dataset "${p.name}" at ${p.publisher} verified (${p.landing_url}).`); }
      else { t.state = 'gap'; board.messages.push({ from: q, about: c.id, note: res.note, at: new Date().toISOString() }); }
      save();
    }
  };
  await Promise.all(QUEENS.flatMap(q => [1, 2].map(slot => queenLoop(q, slot))));
  log({ actor: 'board', action: 'final', note: `${board.tickets.filter(t => t.state === 'done').length} done, ${board.tickets.filter(t => t.state === 'gap').length} gaps, ${board.tips.length} tips` });
}

// ---------- run and summarize ----------
log({ actor: 'orchestrator', action: 'start-arm', target: ARM, note: `model ${MODEL}, budget $${BUDGET}, wall ${WALL_MIN} min, ${CLAIMS.length} claims` });
const t0 = Date.now();
try { await ({ single: armSingle, isolated: armIsolated, centralized: armCentralized, decentralized: armDecentralized })[ARM](); }
catch (e) { log({ actor: 'orchestrator', action: 'error', note: String(e.stack || e).slice(0, 500) }); }

// Final per-claim table from the files written (so the summary is recomputable from disk).
const perClaim = CLAIMS.map(c => {
  const vs = fs.readdirSync(path.join(RUN, 'verify')).filter(f => f.startsWith(c.id + '.')).sort();
  const best = vs.map(f => JSON.parse(fs.readFileSync(path.join(RUN, 'verify', f), 'utf8'))).sort((a, b) => (b.dataset_verified - a.dataset_verified) || (b.dataset_resolves - a.dataset_resolves))[0];
  const fab = new Set(); vs.forEach(f => JSON.parse(fs.readFileSync(path.join(RUN, 'verify', f), 'utf8')).fabricated.forEach(u => fab.add(u)));
  const planFile = vs.length ? vs.map(f => f.replace('.json', '')).find(k => JSON.parse(fs.readFileSync(path.join(RUN, 'verify', k + '.json'), 'utf8')).dataset_verified) || vs[vs.length - 1].replace('.json', '') : null;
  const plan = planFile ? JSON.parse(fs.readFileSync(path.join(RUN, 'plans', planFile + '.json'), 'utf8')) : null;
  const anyChecker = vs.some(f => JSON.parse(fs.readFileSync(path.join(RUN, 'verify', f), 'utf8')).checker_verified);
  const anyFetch = vs.some(f => (JSON.parse(fs.readFileSync(path.join(RUN, 'verify', f), 'utf8')).agent_fetch?.fetched_urls || []).length > 0);
  return { claim_id: c.id, attempts: S.attempts[c.id] || 0, verified: !!best?.dataset_verified, resolves: !!best?.dataset_resolves, dataset_named: !!plan?.dataset, fabricated: [...fab], dataset: plan?.dataset ? { name: plan.dataset.name, publisher: plan.dataset.publisher, landing_url: plan.dataset.landing_url, doi: plan.dataset.doi } : null, no_dataset_reason: plan?.no_dataset_reason || null,
    ...(EXP === 2 ? { checker_verified: !!best?.dataset_verified || anyChecker, agent_fetched_anything: anyFetch, agent_fetched_target: !!best?.agent_fetch?.fetched_target, title_agrees: !!best?.agent_fetch?.title_agrees } : {}) };
});
const allFab = new Set(perClaim.flatMap(p => p.fabricated));
const summary = {
  arm: ARM, experiment: EXP, run_dir: path.relative(path.join(here, '..', '..'), RUN).replace(/\\/g, '/'), model: MODEL, started: new Date(t0).toISOString(), finished: new Date().toISOString(),
  claims: CLAIMS.length, verified: perClaim.filter(p => p.verified).length, resolves_only: perClaim.filter(p => p.resolves).length, dataset_named: perClaim.filter(p => p.dataset_named).length,
  ...(EXP === 2 ? { verified_checker_only: perClaim.filter(p => p.checker_verified).length, claims_with_agent_fetch: perClaim.filter(p => p.agent_fetched_anything).length, call_cap_usd: CALL_CAP } : {}),
  fabricated_identifiers: allFab.size, fabricated_list: [...allFab], untouched: perClaim.filter(p => p.attempts === 0).length, duplicated_work: S.duplicated,
  calls: S.calls, attempts_total: Object.values(S.attempts).reduce((a, b) => a + b, 0), minutes_wall: S.firstStart && S.lastEnd ? +((S.lastEnd - S.firstStart) / 60000).toFixed(2) : 0, minutes_agent: +(S.agentMs / 60000).toFixed(2),
  tokens: S.tokens, cost_usd_list: +S.spent.toFixed(4), web_requests: S.web, budget_usd: BUDGET, wall_cap_min: WALL_MIN, stopped_by: S.stopped, per_claim: perClaim
};
fs.writeFileSync(path.join(RUN, 'summary.json'), JSON.stringify(summary, null, 1));
log({ actor: 'orchestrator', action: 'done', note: `verified ${summary.verified}/${summary.claims}, fabricated ${summary.fabricated_identifiers}, untouched ${summary.untouched}, dup ${summary.duplicated_work}, ${summary.minutes_wall} min wall, $${summary.cost_usd_list}` });
logf.end();
