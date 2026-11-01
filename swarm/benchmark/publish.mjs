#!/usr/bin/env node
// Builds the dashboard payload for swarm/benchmark:
//   dashboard/public/t/benchmark/data.json          small; the numbers the four figures draw
//   dashboard/public/t/benchmark/logs/<cell>.json   one TRACEABLE log per cell: every call's prompt as sent,
//                                                   the model's raw output, tokens, wall time, cost, stop
//                                                   reason, the final artifact, and the grader's verdict
//   swarm/benchmark/results.json                    the same numbers, beside the pre-registration
//
//   node swarm/benchmark/publish.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from './levels.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const OUT = path.join(repo, 'dashboard/public/t/benchmark');
const LOGS = path.join(OUT, 'logs');
fs.mkdirSync(LOGS, { recursive: true });

const ARMS = ['single', 'decentralised', 'centralised'];
const LEVEL_ORDER = ['nanopub', 'leanbio', 'design', 'validation'];
const LEVEL_TITLE = {
  nanopub: 'Nanopub creation', leanbio: 'LeanBio formalisation',
  design: 'Design-studio usage', validation: 'Validation-framework usage',
};
const LEVEL_METRIC = {
  nanopub: 'mean of 6 honesty checks (parses, leak-clean, locator traceability, quotable line, no invented numbers, no boilerplate reuse)',
  leanbio: 'mean of 5 checks (compiles, no cheats, witness proved, hypotheses load-bearing, says what the claim says)',
  design: 'mean of 4 checks (accepted, fixed fields present, laws actually evaluated, no unflagged invented fields)',
  validation: 'mean of 7 checks (five named correct, no summing, cannot-assess not a pass, composite not the verdict, withholding reported, scales reported, no fabrications)',
};
// A stage whose own task design is defective says so ON ITS FIGURE, not only in RESULTS.md.
const CAVEAT = {
  design: `TASK-DESIGN DEFECT: the briefs are infeasible at lawset 1.8.1. All three arms violate the same five binding laws on brief 1, because the sponsor's fixed SL_m 0.25 and mass_kg 0.075 sit outside the Exocoetidae isometry band the accepted laws are scoped to. Re-running lean_check on one arm's own design with SL_m set to the reference specimen's 0.19 drops binding violations from 5 to 0. "accepted" was unreachable by construction, so this stage measures the brief, not the arms. Do not quote its quality column.`,
  nanopub: `METRIC CAVEAT: "parses" is 0 for every arm on every task, because the prompt never asked for a provenance template and every record is minutes old — neither is an RDF problem. The post-hoc secondary "parses_valid_rdf", which tolerates those two notes, separates: single 1 of 3, decentralised 3 of 3, centralised 0 of 3 (no artifact). At n = 3 that is one task of difference.`,
};
const GROUND_TRUTH = {
  nanopub: 'holdout/nanopubs/check.mjs over the nanopub 1.95.0 validator, plus holdout/check-leaks.mjs',
  leanbio: 'lake env lean with Mathlib v4.35.0 (compilation is the ground truth), one process at a time',
  design: 'sim-engine lean_check at lawset 1.8.1',
  validation: 'the verbatim validate_generation output the arm was given',
};

const readJSON = p => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const slug = (lv, arm, task) => `${lv}__${arm}__${task}`;

const data = {
  built: new Date().toISOString(),
  prereg: 'swarm/benchmark/ARMS.md',
  model: null, N: 3, budget_total_usd_per_cell: 0.45, n_per_cell: 3,
  arms: ARMS,
  arm_definitions: {
    single: 'One agent does the whole task end to end. 1 call at the whole cell budget.',
    decentralised: '3 agents work the same task independently, no shared state, no orchestrator; merged at the end by a fixed oracle-free medoid vote. 3 parallel calls at a third of the budget each.',
    centralised: 'An orchestrator splits the task into 3 subtasks, 3 workers each do one, and a second orchestrator call sees all three and decides the final artifact. 5 calls at a fifth of the budget each.',
  },
  limitations: [
    'n = 3 tasks per (arm, level). No claim of statistical significance is possible and none is made. A difference smaller than the within-arm min-max spread is reported as NOT separating.',
    'No arm had any tools. Every arm\'s input was byte-identical. This measures the three architectures as REASONING architectures over fixed inputs; it does NOT measure tool use or tool coordination, which is what the rest of this project actually does. Do not quote it as if it did.',
    'Equal TOTAL budget per cell ($0.45), not equal budget per agent. The single agent gets it in one call; the centralised arm gets a fifth of it per call. Giving every agent the full budget is a different experiment and was not run.',
    'Temperature is not settable through the headless CLI, so runs are not deterministic. Spreads, not point values, carry the information.',
  ],
  levels: [],
  cells: [],
};

for (const lv of LEVEL_ORDER) {
  const g = readJSON(path.join(here, 'graded', lv, 'graded.json'));
  if (!g) { data.levels.push({ level: lv, title: LEVEL_TITLE[lv], missing: true }); continue; }
  const level = {
    level: lv, title: LEVEL_TITLE[lv], metric: LEVEL_METRIC[lv], ground_truth: GROUND_TRUTH[lv],
    n_tasks: LEVELS[lv].tasks.length, tasks: LEVELS[lv].tasks.map(t => t.id), caveat: CAVEAT[lv] || null, arms: {},
  };
  for (const arm of ARMS) {
    const a = g.arms[arm];
    const per = a.per_task.filter(p => !p.missing);
    data.model ||= per[0]?.cell?.model || null;
    level.arms[arm] = {
      n: a.n, mean_score: a.mean_score, min_score: a.min_score, max_score: a.max_score, spread: a.spread,
      cost_usd: a.cost_usd, tokens_total: a.tokens_total, wall_s: a.wall_s, calls: a.calls,
      infra_failures: a.infra_failures, cap_stops: a.cap_stops,
      artifacts_absent: a.artifacts_absent ?? per.filter(p => p.artifact_absent).length,
      per_task: per.map(p => ({
        task: p.task, score: p.score, score_uncorrected: p.score_uncorrected ?? null,
        artifact_absent: !!p.artifact_absent,
        cost_usd: p.cell?.cost_usd ?? null, tokens: p.cell?.tokens_total ?? null, wall_s: p.cell ? +(p.cell.wall_ms / 1000).toFixed(1) : null,
        calls: p.cell?.calls ?? null, cap_stops: p.cell?.cap_stops ?? 0, infra_failures: p.cell?.infra_failures ?? 0,
        log: `logs/${slug(lv, arm, p.task)}.json`,
        headline: headlineFor(lv, p),
      })),
    };
    // one traceable log per cell
    for (const p of per) {
      if (!p.task) { console.warn(`skipping an ungraded cell in ${lv}/${arm}: no task id`); continue; }
      const dir = path.join(here, 'runs', lv, arm, p.task);
      const fin = readJSON(path.join(dir, 'final.json'));
      if (!fin) continue;
      const callFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !['final.json', 'cell.json'].includes(f));
      const calls = callFiles.map(f => {
        const j = readJSON(path.join(dir, f));
        return {
          label: j.meta.label, prompt_sent: j.prompt, prompt_chars: j.meta.prompt_chars,
          model_output_parsed: j.parsed,
          model_output_raw: typeof j.raw_result?.result === 'string' ? j.raw_result.result : null,
          tokens: j.meta.usage, tokens_total: j.meta.tokens_total, cost_usd: j.meta.cost_usd,
          duration_ms: j.meta.duration_ms, num_turns: j.meta.num_turns,
          stop_reason: j.meta.stop_reason, terminal_reason: j.meta.terminal_reason,
          is_error: j.meta.is_error, error_text: j.meta.error_text,
          cap_stop: /budget/i.test(String(j.meta.terminal_reason || j.meta.stop_reason || '')),
          failure_class: /budget/i.test(String(j.meta.terminal_reason || '')) ? 'cap stop (budget, not a crash)'
            : j.meta.is_error ? 'harness: CLI error'
              : j.meta.tokens_total === 0 ? 'harness: no model call' : 'ok',
        };
      }).sort((a, b) => a.label.localeCompare(b.label));
      const log = {
        level: lv, level_title: LEVEL_TITLE[lv], arm, task: p.task,
        arm_definition: data.arm_definitions[arm],
        model: p.cell?.model, N: p.cell?.N, budget_total_usd: p.cell?.budget_total_usd, cap_per_call_usd: p.cell?.cap_per_call_usd,
        allocation: p.cell?.allocation || 'even',
        metric: LEVEL_METRIC[lv], ground_truth: GROUND_TRUTH[lv],
        shared_input_bytes: fs.existsSync(path.join(dir, 'shared-input.txt')) ? fs.statSync(path.join(dir, 'shared-input.txt')).size : null,
        shared_input: fs.existsSync(path.join(dir, 'shared-input.txt')) ? fs.readFileSync(path.join(dir, 'shared-input.txt'), 'utf8') : null,
        merge: p.cell?.merge || null,
        cell_totals: { calls: p.cell?.calls, cost_usd: p.cell?.cost_usd, tokens_total: p.cell?.tokens_total, wall_ms: p.cell?.wall_ms, cap_stops: p.cell?.cap_stops, infra_failures: p.cell?.infra_failures, produced_artifact: p.cell?.produced_artifact },
        calls,
        final_artifact: fin.final,
        swarm_candidates: fin.candidates || null,
        grader_verdict: { ...p, cell: undefined },
        candidate_grades: g.candidate_diagnosis?.[`${arm}/${p.task}`] || null,
        run_dir: path.relative(repo, dir).replace(/\\/g, '/'),
      };
      fs.writeFileSync(path.join(LOGS, `${slug(lv, arm, p.task)}.json`), JSON.stringify(log, null, 1));
      data.cells.push({ level: lv, arm, task: p.task, score: p.score, log: `logs/${slug(lv, arm, p.task)}.json` });
    }
  }
  // merge diagnosis: did the oracle-free medoid vote throw away a better candidate?
  level.merge_diagnosis = Object.entries(g.candidate_diagnosis || {}).map(([k, d]) => {
    const cands = (d.candidates || []).filter(c => !c.missing);
    const keptScore = d.kept != null ? cands.find(c => c.index === d.kept)?.score ?? null : null;
    const best = cands.length ? Math.max(...cands.map(c => c.score ?? 0)) : null;
    return { cell: k, rule: d.rule, kept: d.kept, kept_score: keptScore, best_candidate_score: best, candidate_scores: cands.map(c => ({ index: c.index, score: c.score })), discarded_a_better_candidate: keptScore != null && best != null && best > keptScore };
  });
  data.levels.push(level);
}

function headlineFor(lv, p) {
  if (p.artifact_absent) return 'no artifact produced';
  if (lv === 'nanopub') return `parses ${p.parses}${p.parses_valid_rdf != null ? ` (valid RDF ${p.parses_valid_rdf})` : ''}, leak-clean ${p.leak_clean}, locators ${p.locator_traceability}, invented numbers ${p.unsupported_numeric_claims}, quotable line ${p.quotable_line}, boilerplate reuse ${p.boilerplate_reuse}`;
  if (lv === 'leanbio') return `compiles ${p.compiles}, witness proved ${p.witness_present_and_proved}, hypotheses load-bearing ${p.hypotheses_load_bearing}, content ${p.says_what_the_claim_says}`;
  if (lv === 'design') return `accepted ${p.accepted}, binding violations ${p.binding_violations}, laws evaluated ${p.evaluable_binding_laws}, invented fields ${p.invented_fields}`;
  return `five named correct ${p.five_named_correct}, no summing ${p.no_summing}, cannot-assess not a pass ${p.cannot_assess_not_a_pass}, composite not the verdict ${p.composite_not_the_verdict}, fabrications ${p.fabrications}`;
}

// post-hoc variant: the centralised arm's $0.45 split unevenly so the merge call can afford the artifact
const ph = [];
for (const lv of LEVEL_ORDER) {
  const base = path.join(here, 'runs', lv, 'centralised');
  if (!fs.existsSync(base)) continue;
  for (const d of fs.readdirSync(base).filter(x => x.endsWith('-posthoc-uneven'))) {
    const c = readJSON(path.join(base, d, 'cell.json'));
    const f = readJSON(path.join(base, d, 'final.json'));
    if (c) ph.push({ level: lv, task: c.task, allocation: c.allocation, calls: c.calls, cost_usd: c.cost_usd, tokens_total: c.tokens_total, wall_s: +(c.wall_ms / 1000).toFixed(1), cap_stops: c.cap_stops, produced_artifact: c.produced_artifact, artifact_bytes: f?.final?.trig?.length ?? null, run_dir: path.relative(repo, path.join(base, d)).replace(/\\/g, '/') });
  }
}
data.posthoc_centralised_uneven_allocation = ph;

fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(data, null, 1));
fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(data, null, 1));
const bytes = fs.readdirSync(LOGS).reduce((a, f) => a + fs.statSync(path.join(LOGS, f)).size, 0);
console.log(`data.json ${fs.statSync(path.join(OUT, 'data.json')).size} bytes; ${fs.readdirSync(LOGS).length} traceable logs, ${(bytes / 1e6).toFixed(2)} MB`);
for (const l of data.levels) {
  if (l.missing) { console.log(`${l.level}: MISSING`); continue; }
  console.log(`${l.level.padEnd(11)} ` + ARMS.map(a => `${a[0]}=${l.arms[a].mean_score} [${l.arms[a].min_score}..${l.arms[a].max_score}] $${l.arms[a].cost_usd}`).join('  '));
}
