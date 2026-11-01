#!/usr/bin/env node
// CLI for the generative backends (sim-engine/generative).
//
//   node sim-engine/gen-cli.mjs status [--fresh]
//   node sim-engine/gen-cli.mjs generate --level body --base flying-fish --text "much deeper body" [--n 4] [--seed 1] [--model fm|ddpm] [--json]
//   node sim-engine/gen-cli.mjs generate --text "70% zebrafish 30% flying fish, more slender"      (base parsed from text)
//   node sim-engine/gen-cli.mjs generate --level protein --base P69905 [--mode inverse_fold]
//   node sim-engine/gen-cli.mjs seed-optimize --base flying-fish --text "deeper body" --scenario <key> --metric <m> \
//        --var body:body_width_over_SL:0.08:0.2 [--age 365]      generate, then optimize from the best-scoring candidate
//
// Prints the envelope as JSON with --json; otherwise a short table.

import { generateEnvelope, statusEnvelope } from './generative/index.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = {};
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  if (k === 'var') (opt.var ||= []).push(v); else opt[k] = v;
}

function table(env) {
  const r = env.result;
  console.log(`status: ${r.status}   model: ${r.model ?? '-'}   backend: ${r.backend ?? '-'}`);
  for (const [i, c] of (r.candidates || []).entries()) {
    if (c.params) {
      const q = c.params;
      console.log(`#${i} ${c.conditioned_on.family.padEnd(12)} SL ${(q.standard_length_m * 1000).toFixed(1)} mm  depth/SL ${q.body_depth_over_SL.toFixed(3)}  width/SL ${q.body_width_over_SL.toFixed(3)}  ped ${q.peduncle_depth_frac.toFixed(2)}/${q.peduncle_width_frac.toFixed(2)}  mass ${(q.body_mass_kg * 1000).toFixed(1)} g  K ${q.fulton_K.toFixed(2)}  nearest ${c.diagnostics.nearest_real_specimen.species} (${c.diagnostics.nearest_real_specimen.distance_sd_units} sd)`);
    } else console.log(`#${i}`, JSON.stringify(c).slice(0, 200));
  }
  for (const ng of r.parsed_text?.not_generated || []) console.log(`not generated: "${ng.clause}": ${ng.reason}`);
  if (r.fallback) console.log('fallback:', JSON.stringify({ ...r.fallback, esmfold: r.fallback.esmfold ? { ...r.fallback.esmfold, pdb: undefined } : undefined }));
  console.log(`scope: ${env.scope}`);
}

async function main() {
  if (cmd === 'status') {
    const env = await statusEnvelope({ fresh: !!opt.fresh });
    if (opt.json) return console.log(JSON.stringify(env, null, 1));
    const s = env.result;
    for (const [lv, x] of Object.entries(s.levels)) console.log(`${lv.padEnd(8)} ${x.status ?? x.generation}`);
    for (const [pv, x] of Object.entries(s.providers)) console.log(`${pv.padEnd(14)} ${x.status ?? JSON.stringify(x)}${x.need ? `  (${x.need})` : ''}${x.key_format ? `  key: ${x.key_format}` : ''}`);
    return;
  }
  if (cmd === 'generate' || cmd === 'seed-optimize') {
    const args = { level: opt.level || 'body', base: opt.base, text: typeof opt.text === 'string' ? opt.text : '', n: +(opt.n || 4), seed: +(opt.seed || 1),
      conditions: { ...(opt.model ? { model: opt.model } : {}), ...(opt.mode ? { mode: opt.mode } : {}), ...(opt['llm-assist'] ? { llm_assist: opt['llm-assist'] } : {}), ...(opt['no-keep-size'] ? { keep_size: false } : {}) } };
    const env = await generateEnvelope(args);
    if (cmd === 'generate') return opt.json ? console.log(JSON.stringify(env, null, 1)) : table(env);
    // seed-optimize: score each candidate on the objective, then run optimize from the best one
    const { optimize, scenarioRun } = await import('./tools/studio.mjs');
    const age = +(opt.age || 365);
    const scored = [];
    for (const c of env.result.candidates || []) {
      const run = await scenarioRun({ organism: c.organism, scenario: opt.scenario, ageDays: age });
      scored.push({ c, v: run.result?.run?.metrics?.find?.(m => m.key === opt.metric)?.value ?? null });
    }
    const ok = scored.filter(s => typeof s.v === 'number').sort((a, b) => b.v - a.v);
    if (!ok.length) return console.log(JSON.stringify({ error: 'no candidate produced the metric', scored: scored.map(s => s.v) }));
    const variables = (opt.var || []).map(s => { const [level, param, min, max] = s.split(':'); return { target: { level, id: level === 'body' ? 'body' : level }, param, min: +min, max: +max }; });
    const o = await optimize({ organism: ok[0].c.organism, objective: { scenario: opt.scenario, metric: opt.metric, ageDays: age }, variables, seed: args.seed });
    console.log(JSON.stringify({ candidate_scores: scored.map(s => s.v), seeded_from: ok[0].c.organism.id, optimize: { status: o.result.status, best: o.result.best?.values ?? null, start: o.result.start ?? null } }, null, 1));
    return;
  }
  console.log('usage: gen-cli.mjs status | generate [--level body|protein|organ|system|tissue|cell] [--base ID] [--text "..."] [--n N] [--seed S] [--model fm|ddpm] [--json] | seed-optimize ...');
  process.exitCode = 2;
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
