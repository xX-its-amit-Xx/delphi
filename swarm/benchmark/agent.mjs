#!/usr/bin/env node
// One headless `claude -p` call, with the cost/token/tool accounting this project already uses.
//
// ADAPTED FROM `swarm/compare/run.mjs` `runClaude` (another thread's four-arm pipeline, which is read and
// reused here, never edited). The gotchas carried over from it, each of which cost that thread a run:
//   1. `--json-schema` must have an OBJECT at its root. An array root makes the API return
//      `400 tools.0.custom.input_schema.type: Input should be 'object'` and the CLI never makes a model
//      call (1 s, exit 1, zero tokens). Arrays are wrapped in an object property.
//   2. Prompts over 8,000 characters go on stdin, not argv.
//   3. `--output-format stream-json --verbose` gives the per-call tool list; the final `result` event
//      carries total_cost_usd, usage, num_turns, stop_reason, terminal_reason and is_error.
//   4. A run with zero tokens is an INFRASTRUCTURE failure, not a quality failure, and is excluded from
//      quality scores and counted separately.
//   5. `--no-session-persistence`, and cwd set to a scratch dir outside the repository, so no agent can
//      write into the tree.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const SCRATCH = process.platform === 'win32' ? 'C:\\Temp\\delphi-benchmark-scratch' : '/tmp/delphi-benchmark-scratch';
fs.mkdirSync(SCRATCH, { recursive: true });

export const MODEL = process.env.BENCH_MODEL || 'claude-sonnet-5-5';

// Returns { ok, parsed, meta }. `meta.infra_failure` is true when the CLI made no model call at all.
export function runClaude({ prompt, schema, maxTurns = 8, maxBudget = 0.15, label = 'call', logDir = null }) {
  return new Promise((resolve) => {
    const viaStdin = prompt.length > 8000;
    const args = ['-p', ...(viaStdin ? [] : [prompt]), '--model', MODEL,
      '--json-schema', JSON.stringify(schema), '--output-format', 'stream-json', '--verbose',
      '--no-session-persistence', '--max-turns', String(maxTurns), '--max-budget-usd', String(maxBudget)];
    const t0 = Date.now();
    const child = spawn('claude', args, { cwd: SCRATCH, stdio: [viaStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true });
    if (viaStdin) { child.stdin.on('error', () => { }); child.stdin.end(prompt); }
    let out = '', err = '';
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    child.on('close', (code) => {
      const t1 = Date.now();
      const events = out.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      let r = events.find(e => e.type === 'result') || null;
      if (!r) { try { r = JSON.parse(out); } catch { } }
      const usage = r?.usage ? { input: r.usage.input_tokens || 0, output: r.usage.output_tokens || 0, cache_read: r.usage.cache_read_input_tokens || 0, cache_creation: r.usage.cache_creation_input_tokens || 0 } : null;
      const total = usage ? usage.input + usage.output + usage.cache_read + usage.cache_creation : 0;
      const meta = {
        label, model: MODEL, exit_code: code, via_stdin: viaStdin, prompt_chars: prompt.length,
        duration_ms: t1 - t0, cost_usd: r?.total_cost_usd ?? null, num_turns: r?.num_turns ?? null,
        stop_reason: r?.stop_reason ?? null, terminal_reason: r?.terminal_reason ?? null,
        is_error: !!r?.is_error, error_text: r?.is_error ? String(r.result || '').slice(0, 400) : null,
        usage, tokens_total: total, infra_failure: total === 0,
        stderr: err.slice(0, 600),
      };
      let parsed = r?.structured_output ?? null;
      if (parsed == null && typeof r?.result === 'string') {
        const m = /```(?:json)?\s*([\s\S]*?)```/.exec(r.result);
        try { parsed = JSON.parse(m ? m[1] : r.result); } catch { parsed = null; }
      }
      if (logDir) {
        fs.mkdirSync(logDir, { recursive: true });
        fs.writeFileSync(path.join(logDir, `${label}.json`), JSON.stringify({ meta, prompt, parsed, raw_result: r, stdout_if_unparsed: r ? undefined : out.slice(0, 4000) }, null, 1));
      }
      resolve({ ok: parsed != null && !meta.infra_failure, parsed, meta });
    });
  });
}
