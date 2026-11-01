#!/usr/bin/env node
// Three architectures per product, each one actually executed, plus that product's benchmark result.
//
//   node dashboard/public/docs/usecases.mjs            all products
//   node dashboard/public/docs/usecases.mjs mcp        one product
//
// EVERY PRODUCT SUPPORTS ALL THREE ARCHITECTURES, because the arm is a property of the harness
// (swarm/benchmark/run.mjs) and not of the tool: a task is a prompt plus a grader, and the same task
// runs as one agent, as N independent agents merged by a fixed oracle-free medoid vote, or as an
// orchestrator that splits, dispatches and merges. So each product below shows the same job done
// three ways.
//
// WHAT "RUN" MEANS HERE, stated once because it differs by arm:
//   * `single` is executed live by THIS script, now. Exit code, duration and real stdout are recorded.
//   * `decentralised` and `centralised` are read from swarm/benchmark/runs/, which are real executions
//     with per-call logs - 36 cells, 113 logged calls, $8.35, run 2026-11-01. They are NOT re-run here:
//     re-running them costs real money per page build, and the recorded run is the one the benchmark
//     numbers come from, so citing it keeps the figures and the transcripts in agreement.
// The page says which is which on every card. A recorded run is cited by its own log path.
//
// The per-product benchmark block is read from swarm/benchmark/results.json. Four of the five products
// were benchmark stages. The MCP server was NOT, and this script refuses to invent a row for it.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const bench = path.join(root, 'swarm/benchmark');
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));

// product -> the benchmark level that measured it (results.json levels are keyed "0".."3")
const STAGE_OF = { nanopubs: '0', leanbio: '1', studio: '2', harness: '3' };
const RUNDIR_OF = { nanopubs: 'nanopub', leanbio: 'leanbio', studio: 'design', harness: 'validation' };

// ── the live single-agent case per product ───────────────────────────────────
const SINGLE = {
  nanopubs: {
    title: 'One agent writes the record, and the validator rules on it',
    why: 'The only pass is exit 0 with an empty `unexpected` list. Unsigned drafts legitimately report four complaints and the checker allows those by name — including "creation time is older than one hour", which is meaningless on a draft nobody signed.',
    // NOT holdout/nanopubs/unsigned: that is the holdout's own staging area, and its FILENAMES
    // carry held-out claim ids, which check-leaks.mjs correctly flagged when this page captured
    // them. physics/ drafts are ordinary records and a better demo of the normal path anyway.
    cmd: ['node', 'holdout/nanopubs/check.mjs', 'physics/nanopubs/unsigned'],
  },
  leanbio: {
    title: 'One agent checks a design against the law registry',
    why: 'The interesting output is not a verdict. It is that of 35 laws in scope, 18 are out of scope for this design and 17 cannot be evaluated at all — each naming the input it would need.',
    cmd: ['node', 'sim-engine/cli.mjs', 'tool', 'lean_check', '--json',
      '{"design":{"SL_m":0.19,"mass_kg":0.045,"body_temp_C":28}}'],
    // Stop before the per-law verdict array. Some law ids are also claim ids whose inventory
    // organisms are all held out, and dumping the whole array onto a public page put one of them
    // there - caught by check-leaks.mjs below. The summary is the point of the demo anyway.
    clip: 13,
  },
  mcp: {
    title: 'One agent resolves a claim, then is handed something malformed',
    why: 'An id containing a character that cannot appear in an IRI used to crash the parser. It now answers with the reason. The refusal is the feature.',
    cmd: ['node', 'mcp/cli.mjs', 'claim', 'fisher kpp speed'],
  },
  studio: {
    title: 'One agent turns a sentence into a checkable specification',
    why: 'The phrase becomes criteria. Clauses it cannot parse are reported, never silently dropped — on this input three of them are.',
    cmd: ['node', 'sim-engine/cli.mjs', 'tool', 'parse_design_text', '--json',
      '{"text":"a zebrafish with large wing-like pectoral fins that can glide over the water after leaping"}'],
  },
  harness: {
    title: 'One agent asks the simulator whether our own design leaves the water',
    why: 'This is our headline design being refused. The film opens on it.',
    cmd: ['node', 'sim-engine/cli.mjs', 'tool', 'physics_check', '--json', '{"organism":"winged-zebrafish"}'],
  },
};

// ── a second live case per product: the system declining to guess ────────────
const EXTRA = {
  nanopubs: { title: 'Prove the checker can still fail', why: 'A validator nobody has watched fail is a validator you cannot trust. Three deliberately broken fixtures, including one whose own description forges an ISSUES: marker.', cmd: ['node', 'holdout/nanopubs/check.mjs', '--selftest'] },
  leanbio: { title: 'The gate that stops a law being added and forgotten', why: 'A new law must reach the registry, the handlers, the static mirror, both CLIs, both MCP servers and the contract.', cmd: ['node', 'lean/registry/check-exposed.mjs'] },
  mcp: { title: 'Ask what the system was built to answer', why: 'Fourteen grand questions, each split into the part Lean can settle and the part only measurement can.', cmd: ['node', 'sim-engine/cli.mjs', 'tool', 'leanbio_grand_questions'] },
  studio: { title: 'Search the omics layers for a function', why: 'Which layers actually hold evidence for a term, and how many genes each one reaches. Note that a direct lookup of kcnk5b answers `found: false` - the gene universe does not cover it, and the tool says so rather than returning an empty record that reads like an answer.', cmd: ['node', 'sim-engine/cli.mjs', 'tool', 'omics_search', '--json', '{"term":"potassium channel"}'] },
  harness: { title: 'Find the closest real thing that actually exists', why: '"Is this plausible?" is not answerable. "What is the nearest real organism, and how does this differ?" is.', cmd: ['node', 'sim-engine/cli.mjs', 'tool', 'closest_relative_phenotype', '--json', '{"organism":"winged-zebrafish"}'] },
};

const PER_CASE_MS = 240000;
const clip = (s, n = 40) => {
  const t = String(s ?? '').replace(/\r\n/g, '\n').trimEnd();
  const lines = t.split('\n');
  return { text: lines.slice(0, n).join('\n'), truncated_lines: Math.max(0, lines.length - n), total_lines: lines.length };
};

function runLive(cmd, clipLines) {
  const t0 = Date.now();
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: root, encoding: 'utf8', timeout: PER_CASE_MS, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return {
    command: cmd.join(' '),
    ok: !r.error && r.status === 0,
    exit_code: r.status,
    error: r.error ? String(r.error.message || r.error).slice(0, 300) : null,
    duration_ms: Date.now() - t0,
    stdout: clip(r.stdout, clipLines ?? 40),
    stderr: clip(r.stderr, 12).text.slice(0, 1200),
  };
}

/** Read one recorded benchmark cell: how many calls it took and what it produced. */
function recorded(product, arm) {
  const dir = RUNDIR_OF[product];
  if (!dir) return null;
  const tasks = ['l1-t1', 'l2-t1', 'l3-t1', 'l4-t1'];
  for (const t of tasks) {
    const d = path.join(bench, 'runs', dir, arm, t);
    if (!fs.existsSync(d)) continue;
    const files = fs.readdirSync(d);
    const cellPath = path.join(d, 'cell.json');
    const cell = fs.existsSync(cellPath) ? JSON.parse(fs.readFileSync(cellPath, 'utf8')) : null;
    const calls = files.filter(f => f.endsWith('.json') && f !== 'cell.json' && f !== 'final.json');
    const finalPath = path.join(d, 'final.json');
    let artifact = null;
    if (fs.existsSync(finalPath)) {
      const fin = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
      artifact = clip(typeof fin === 'string' ? fin : (fin.artifact ?? fin.text ?? JSON.stringify(fin, null, 1)), 26);
    }
    return {
      kind: 'recorded',
      log_dir: path.relative(root, d).replace(/\\/g, '/'),
      task: t,
      call_files: calls.sort(),
      n_calls: calls.length,
      cost_usd: cell?.cost_usd ?? null,
      tokens: cell?.tokens_total ?? null,
      wall_s: cell?.wall_s ?? null,
      score: cell?.score ?? null,
      artifact_present: !!artifact,
      artifact,
      ran_at: cell?.ran_at ?? cell?.started_at ?? null,
    };
  }
  return null;
}

function benchmarkFor(product) {
  const rp = path.join(bench, 'results.json');
  if (!fs.existsSync(rp)) return null;
  const r = JSON.parse(fs.readFileSync(rp, 'utf8'));
  const key = STAGE_OF[product];
  if (key === undefined) {
    return {
      measured: false,
      note: 'The MCP server was not one of the four benchmark stages, so there is no measured comparison of the three architectures on it. The architectures are available here exactly as they are everywhere else; their relative performance on this surface has not been measured, and no number is shown.',
    };
  }
  const lv = r.levels?.[key];
  if (!lv) return null;
  const arms = {};
  for (const a of Object.keys(lv.arms || {})) {
    const x = lv.arms[a];
    arms[a] = {
      mean: x.mean_score, min: x.min_score, max: x.max_score, spread: x.spread,
      cost_usd: x.cost_usd, tokens: x.tokens_total, wall_s: x.wall_s,
      calls: x.calls, cap_stops: x.cap_stops, artifacts_absent: x.artifacts_absent,
    };
  }
  const single = arms.single?.cost_usd || null;
  for (const a of Object.keys(arms)) arms[a].cost_x = single ? +(arms[a].cost_usd / single).toFixed(2) : null;
  const best = Object.entries(arms).sort((a, b) => b[1].mean - a[1].mean)[0];
  const worst = Object.entries(arms).sort((a, b) => a[1].mean - b[1].mean)[0];
  const gap = +(best[1].mean - worst[1].mean).toFixed(4);
  const widestSpread = Math.max(...Object.values(arms).map(a => a.spread));
  return {
    measured: true,
    stage: Number(key) + 1,
    title: lv.title,
    metric: lv.metric,
    n_tasks: lv.n_tasks,
    caveat: lv.caveat ?? null,
    arms,
    gap_between_best_and_worst: gap,
    widest_within_arm_spread: +widestSpread.toFixed(4),
    separates: gap > widestSpread,
    // A gap produced by an arm that emitted NOTHING is not a quality difference, and must not be
    // read as one. The centralised arm scored 0 at stage 1 because both of its merge calls hit the
    // per-call cap and it produced no artifact in 3 of 3 cells - a budget effect at the join, which
    // a post-hoc re-allocation of the SAME total then fixed. Saying "centralisation is worse at
    // writing nanopubs" off that number would be the single most misleading sentence on this page.
    starved: Object.entries(arms).filter(([, a]) => a.artifacts_absent > 0).map(([n, a]) => ({ arm: n, cells_without_artifact: a.artifacts_absent, cap_stops: a.cap_stops })),
    reading: (() => {
      const absent = Object.entries(arms).filter(([, a]) => a.artifacts_absent > 0);
      if (absent.length) {
        const [n, a] = absent[0];
        return `This stage appears to separate the arms, but the ${gap.toFixed(3)} gap is an ARTIFACT-ABSENCE effect, not a quality one: the ${n} arm produced no artifact in ${a.artifacts_absent} of ${lv.n_tasks} cells, with ${a.cap_stops} calls stopped at the per-call budget cap. Its merge was starved at the join under equal splitting; re-allocating the same total unevenly produced an artifact in 3 of 3. Read this as "centralisation is budget-fragile at the merge", never as "centralisation writes worse records".`;
      }
      return gap > widestSpread
        ? `The ${gap.toFixed(3)} gap between arms is larger than the widest within-arm spread (${widestSpread.toFixed(3)}), so this stage does separate them.`
        : `The ${gap.toFixed(3)} gap between the best and worst arm sits INSIDE the widest within-arm spread (${widestSpread.toFixed(3)}). At n=3 with single draws and no replicates, this stage does not separate the architectures on quality.`;
    })(),
  };
}

const PRODUCTS = ['nanopubs', 'leanbio', 'mcp', 'studio', 'harness'];
const list = only.length ? PRODUCTS.filter(p => only.includes(p)) : PRODUCTS;

const out = {};
for (const p of list) {
  process.stderr.write(`\n== ${p}\n  single (live) ... `);
  const s = runLive(SINGLE[p].cmd, SINGLE[p].clip);
  process.stderr.write(`${s.ok ? 'ok' : `exit ${s.exit_code}`} in ${(s.duration_ms / 1000).toFixed(1)}s\n  extra  (live) ... `);
  const e = runLive(EXTRA[p].cmd, EXTRA[p].clip);
  process.stderr.write(`${e.ok ? 'ok' : `exit ${e.exit_code}`} in ${(e.duration_ms / 1000).toFixed(1)}s\n`);

  const dec = recorded(p, 'decentralised');
  const cen = recorded(p, 'centralised');
  process.stderr.write(`  decentralised: ${dec ? `${dec.n_calls} logged calls, ${dec.log_dir}` : 'no recorded run'}\n`);
  process.stderr.write(`  centralised  : ${cen ? `${cen.n_calls} logged calls, ${cen.log_dir}` : 'no recorded run'}\n`);

  out[p] = {
    architectures: {
      single: { kind: 'live', ...SINGLE[p], ...s, cmd: undefined },
      decentralised: dec ? { ...dec, title: 'N agents, same task, no shared state, merged by a fixed medoid vote', why: 'No orchestrator. Three independent samples plus an oracle-free vote: of the three candidates keep the one most similar to the other two. That is self-consistency, and it is a real baseline, not a strawman.' } : null,
      centralised: cen ? { ...cen, title: 'An orchestrator splits the task, dispatches workers, and merges', why: 'One plan call, three workers each given one subtask plus the same shared input, then a second orchestrator call that sees all three and decides what is kept.' } : null,
    },
    extra_live: { ...EXTRA[p], ...e, cmd: undefined },
    benchmark: benchmarkFor(p),
  };
}

const file = path.join(here, 'usecases.json');
const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { products: {} };
const products = only.length ? { ...(prev.products || {}), ...out } : out;

fs.writeFileSync(file, JSON.stringify({
  generated_at: new Date().toISOString(),
  generated_by: 'dashboard/public/docs/usecases.mjs',
  node: process.version,
  what_ran: {
    live: 'The single-agent case and one extra case per product were executed by this script at the time stamped above. Exit code, duration and real stdout are recorded.',
    recorded: 'The decentralised and centralised cases are real executions from swarm/benchmark/runs/ (36 cells, 113 logged calls, $8.35, 2026-11-01), cited by log path rather than re-run, because re-running them costs real money per page build and the benchmark numbers come from that run.',
  },
  benchmark_source: 'swarm/benchmark/results.json, pre-registered in swarm/benchmark/ARMS.md before any arm ran.',
  products,
}, null, 1));

// SAFETY NET. This file captures real stdout, and real stdout can carry a held-out claim id - it
// did, twice, on the first run. Rather than rely on anyone remembering to check, the leak checker
// runs over the file we just wrote and this script FAILS if it finds one. A page that can leak the
// holdout is worse than no page.
const leak = spawnSync('node', ['holdout/check-leaks.mjs', 'dashboard/public/docs'],
  { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const leakLines = (leak.stdout || '').split(/\r?\n/).filter(l => l.startsWith('LEAK'));
if (leakLines.length) {
  console.error('HOLDOUT LEAK in the output just written - NOT shipping it:');
  for (const l of leakLines) console.error('  ' + l);
  console.error('Fix the case that captured it, or cap its output with `clip`. Do NOT allowlist a');
  console.error('held-out id to make this pass: the allowlist is for files that filter the clade out.');
  process.exit(1);
}

const live = Object.values(products).flatMap(p => [p.architectures?.single, p.extra_live]).filter(Boolean);
const bad = live.filter(c => !c.ok);
console.log(`usecases.json: ${Object.keys(products).length} products, ${live.length} live runs, ${live.length - bad.length} exited 0`
  + (bad.length ? `, FAILED: ${bad.map(b => b.command?.slice(0, 50)).join(' | ')}` : ''));
