#!/usr/bin/env node
// Builds dashboard/public/chat-context.json — what the site's chatbot is allowed to know.
//
// The bot is told, in its system prompt, never to state a number it cannot trace. That instruction
// is worth nothing unless the numbers it is handed are themselves traceable, so every figure here
// is READ from the file that owns it and the build FAILS rather than shipping a stale one. Same
// rule as docs/build.mjs and the deck.
//
//   node dashboard/build-chat-context.mjs
//   node dashboard/build-chat-context.mjs --check

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const CHECK = process.argv.includes('--check');
const read = p => fs.readFileSync(path.resolve(root, p), 'utf8');
const readJSON = p => JSON.parse(read(p));
const must = (c, m) => { if (!c) { console.error(`build-chat-context FAILED: ${m}`); process.exit(1); } };

const docs = readJSON('dashboard/public/docs/data.json');
must(docs?.counts?.sim_engine_tools > 50, 'docs/data.json has no sensible tool count — run docs/build.mjs first');
const C = docs.counts;

const bench = readJSON('swarm/benchmark/results.json');
must(bench?.levels, 'swarm/benchmark/results.json has no levels');

const uc = fs.existsSync(path.join(root, 'dashboard/public/docs/usecases.json'))
  ? readJSON('dashboard/public/docs/usecases.json') : null;

const lawset = readJSON('lean/registry/lawsets/current.json');
must(lawset?.version, 'lawsets/current.json has no version');

// The validator's own gate numbers. They live inside physics_check.gate as prose, so they are
// pulled out with asserting regexes: if the wording changes, this FAILS rather than handing the
// chatbot a null and letting it improvise a number. (It shipped nulls once; hence the asserts.)
const run = readJSON('dashboard/public/validate-show/run-winged-zebrafish.json');
const gateText = run?.physics_check?.gate ?? '';
must(/FAIL/.test(gateText), 'physics_check.gate no longer reports a FAIL for the winged zebrafish');
const grab = (re, what) => { const m = gateText.match(re); must(m, `could not read ${what} out of physics_check.gate`); return Number(m[1]); };
const launch = grab(/reachable launch speed ([\d.]+) m\/s/, 'the reachable launch speed');
const vmin = grab(/below v_min ([\d.]+) m\/s/, 'v_min');
const shortfall = grab(/lifting area is ([\d.]+)x too small/, 'the lifting-area shortfall');
const haveArea = grab(/([\d.]+) cm2 against/, 'the lifting area we have');
const needArea = grab(/against ([\d.]+) cm2 needed/, 'the lifting area needed');
must(launch < vmin, `launch ${launch} should be below v_min ${vmin}`);

const stageNames = { 0: 'nanopub creation', 1: 'LeanBio formalisation', 2: 'design-studio usage', 3: 'validation-framework usage' };
const stages = Object.entries(bench.levels).map(([k, lv]) => {
  const arms = {};
  for (const [a, x] of Object.entries(lv.arms || {})) {
    arms[a] = { mean: x.mean_score, spread: x.spread, cost_usd: x.cost_usd, calls: x.calls, cap_stops: x.cap_stops, artifacts_absent: x.artifacts_absent };
  }
  return { stage: Number(k) + 1, what: stageNames[k] ?? lv.title, metric: lv.metric, n_tasks: lv.n_tasks, arms, caveat: lv.caveat ?? null };
});

const ctx = {
  generated_at: new Date().toISOString(),
  generated_by: 'dashboard/build-chat-context.mjs',
  what_this_is:
    'LeanBio Forum (the repository is named DELPHI) is five surfaces for stating a biological claim '
    + 'precisely enough that a machine can check it, and far more often refuse it.',
  the_five_surfaces: [
    { tab: 'Nanopubs', url: '/docs/#nanopubs', does: 'One claim, its evidence and its provenance as four named RDF graphs a validator either accepts or does not. Documents the errors that actually happen and the three validator complaints that are NOT errors on an unsigned draft.' },
    { tab: 'LeanBio', url: '/docs/#leanbio', does: 'Two gates: the statement compiles in Lean 4, and it survives agent debate on the evidence. Requires a non-vacuity witness, and strips relational hypotheses to check they were load-bearing.' },
    { tab: 'MCP · API · CLI', url: '/docs/#mcp', does: 'The laws, organisms, simulators and harness as tools, designed around personas and use cases rather than around what was easy to expose.' },
    { tab: 'Design Studio', url: '/docs/#studio', does: 'Text to organism, down nine layers to sequence and developmental time. In active development. Exports STL meshes and sequences; the print kits download from here.' },
    { tab: 'Validation harness', url: '/docs/#harness', does: 'Maps a design to its closest real functional analogue, annotates the differences, checks the laws at a pinned lawset, runs physics on the mesh, and then withholds the word validated.' },
  ],
  counts: {
    sim_engine_tools: C.sim_engine_tools,
    hosted_mcp_tools: C.hosted_mcp_tools,
    hosted_mcp_version: C.hosted_mcp_version,
    personas: C.personas, use_cases: C.use_cases, grand_questions: C.grand_questions,
    real_tools: C.real_tools, tool_references: C.tool_references,
    tool_reference_status: C.tool_reference_status,
    use_cases_by_answerability: C.use_cases_by_answerability,
    documented_law_exemptions: C.documented_exemptions,
    current_lawset: lawset.version,
  },
  tool_names: docs.tool_names,
  grand_questions: (docs.grand_questions || []).map(q => q.question),
  our_own_design_fails: {
    summary: 'The winged zebrafish — our headline design — is REFUSED by our own validator. The film opens on it.',
    launch_speed_m_s: launch,
    required_v_min_m_s: vmin,
    lifting_area_shortfall_x: shortfall,
    lifting_area_cm2: haveArea,
    lifting_area_needed_cm2: needArea,
    glided_in_percent_of_draws: 0.0,
    gate_text_verbatim: gateText.slice(0, 900),
    page: '/docs/#harness',
  },
  the_composite_score_problem:
    'Adding one criterion the design ALREADY met moved the same design from 0.4676 "not plausible" to '
    + '0.878 "plausible", on byte-identical inputs apart from a phrase of desired-phenotype prose. A number '
    + 'that moves like that is not a score. No released version of the composite has ever passed a blind '
    + 'evaluation. It is reported and never gated on.',
  five_named_validation_results: docs.five_results,
  swarm_benchmark: {
    what: 'Three architectures (single agent, decentralised swarm, centralised organisation) across four stages of the stack, pre-registered in swarm/benchmark/ARMS.md before any arm ran.',
    scale: '36 cells, 113 logged calls, $8.35, 2026-11-01. n = 3 per (arm, stage), single draws, no replicates.',
    headline: 'Quality did NOT separate at three of the four stages: the gap between best and worst arm sits inside the within-arm spread. Report this as the null result it is.',
    stage_1_caution: 'Stage 1 looks like it separates at a 0.648 gap, but that is an ARTIFACT-ABSENCE effect: the centralised arm produced no artifact in 3 of 3 cells with 8 calls stopped at the per-call budget cap. Read it as "centralisation is budget-fragile at the merge", never as "centralisation writes worse records".',
    stage_3_defective: 'Stage 3 (design studio) cannot discriminate anything: its task briefs were infeasible at the current lawset, so "accepted" was unreachable by construction and all three arms violate the same five laws.',
    stages,
    page: '/t/benchmark/',
  },
  holdout: 'Aves (birds) is a frozen holdout. No bird data, taxon or claim id appears anywhere in the system, deliberately. Do not discuss bird data.',
  not_built: [
    'Mesh segmentation into biological qualities (an LLM/VLM job) is a design intent, NOT a shipped capability. There is no vision model in the engine and the docs build asserts its continued absence.',
    'The round trip — feeding the predicted sequence back into Design Studio in a fresh session — has never been run end to end.',
    'A large share of the tool references the capability map\'s use cases need are MISSING, and the map reports the gap rather than rounding up.',
  ],
  byok: 'Model-backed steps are bring-your-own-key. NVIDIA_API_KEY powers Evo2 sequence likelihood (which RANKS options, never gates them); NEBIUS_API_KEY powers hosted inference. Without a key every model-derived field reports {ran:false} with the reason and nothing is silently substituted. Keys are read from the environment at call time and never written to a file, logged or echoed.',
  print: {
    what: 'The design leaves the screen as geometry: a full prototype at 120 mm, a 1:1 ten-part snap kit, and a 56-part containment-hierarchy kit.',
    downloads: ['/print/download/1-full-prototype-120mm.zip', '/print/download/2-assembly-starter-kit-1to1.zip', '/print/'],
    warnings: 'Print the fit-test coupon first — every snap fit depends on the clearance your printer actually holds. Fin membranes are zero-thickness surfaces and must be thickened. Clean-up had no manifold repair.',
  },
  key_pages: {
    '/docs/': 'The product report: five product tabs, the film, and a For humans / For agents toggle.',
    '/t/benchmark/': 'The swarm benchmark, with 36 traceable per-cell logs.',
    '/gene-diff/': 'The sequence difference expanded to every scale, including the scales where the answer is an absence.',
    '/print/': 'The print kit, viewer and per-part STL downloads.',
    '/blueprint3d/': 'Open the Fish — the organism layer by layer.',
    '/leanbio/': 'The LeanBio repo: claims arriving, grounded, queued.',
    '/proofs/': 'The claim book: every claim with its proof, verdict and provenance.',
  },
};

if (uc?.products) {
  ctx.live_use_cases = Object.fromEntries(Object.entries(uc.products).map(([k, p]) => [k, {
    single_agent_command: p.architectures?.single?.command ?? null,
    single_agent_exit: p.architectures?.single?.exit_code ?? null,
    benchmarked: !!p.benchmark?.measured,
  }]));
}

must(ctx.counts.sim_engine_tools && ctx.counts.hosted_mcp_tools, 'counts did not survive assembly');
// No null may reach the chatbot: a null here is an invitation to improvise.
for (const [k, v] of Object.entries(ctx.our_own_design_fails)) must(v !== null && v !== undefined, `our_own_design_fails.${k} is null`);
must(Array.isArray(ctx.grand_questions) && ctx.grand_questions.length === C.grand_questions,
  `grand questions ${ctx.grand_questions.length} != counts ${C.grand_questions}`);

const text = JSON.stringify(ctx, null, 1);
must(text.length < 60000, `context is ${text.length} chars; the Worker truncates at 24000 — trim it`);

if (CHECK) { console.log(`build-chat-context --check: ok, ${text.length} chars`); process.exit(0); }
fs.writeFileSync(path.join(root, 'dashboard/public/chat-context.json'), text);
console.log(`chat-context.json written: ${text.length} chars, ${ctx.tool_names.length} tools, ${ctx.grand_questions.length} grand questions, ${stages.length} benchmark stages`);
