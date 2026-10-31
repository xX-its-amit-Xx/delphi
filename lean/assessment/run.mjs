#!/usr/bin/env node
// Runs the blinded faithfulness prompts through a NON-Anthropic assessor and records results.
//   node lean/assessment/run.mjs --provider openai-codex [--model <id>] [--only <claim_id>]
//   node lean/assessment/run.mjs --provider openai       (needs OPENAI_API_KEY in the environment)
//   node lean/assessment/run.mjs --provider gemini       (needs GEMINI_API_KEY in the environment)
//   node lean/assessment/run.mjs --provider vertex       (needs gcloud auth + a billed project)
// Results go to lean/assessment/results/<claim_id>.<provider>.json. Keys never touch the repo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const provider = arg('provider'); if (!provider) { console.error('need --provider'); process.exit(2); }
const only = arg('only');
const inputs = JSON.parse(fs.readFileSync(path.join(here, 'inputs.json'), 'utf8'));
fs.mkdirSync(path.join(here, 'results'), { recursive: true });

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('no JSON in answer: ' + text.slice(0, 300));
  return JSON.parse(m[0]);
}

async function askOpenAICodex(prompt, model) {
  // OpenAI's Codex CLI in non-interactive, read-only mode, run from an empty temp dir so it sees no repo.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-assess-'));
  const pf = path.join(dir, 'prompt.md'); fs.writeFileSync(pf, prompt);
  const out = path.join(dir, 'last.txt');
  const args = ['-y', '@openai/codex@latest', 'exec', '--sandbox', 'read-only', '--skip-git-repo-check', '-C', dir, '-o', out, '-c', 'model_reasoning_effort="medium"'];
  if (model) args.push('-m', model);
  args.push('-');
  const r = spawnSync('npx', args, { input: prompt, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const used = (r.stdout + r.stderr).match(/model:\s*(\S+)/);
  return { text, model: model || (used ? used[1] : 'codex-default'), raw: (r.stdout || '').slice(-2000) + (r.stderr || '').slice(-1000) };
}

async function askGemini(prompt, model) {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error('GEMINI_API_KEY not set');
  const m = model || 'gemini-2.5-pro';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } })
  });
  const j = await res.json(); if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 500));
  return { text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '', model: m, raw: '' };
}

async function askVertex(prompt, model) {
  const tok = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', shell: true }).stdout.trim();
  const proj = process.env.GOOGLE_CLOUD_PROJECT || spawnSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8', shell: true }).stdout.trim();
  const m = model || 'gemini-2.5-pro';
  const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${proj}/locations/global/publishers/google/models/${m}:generateContent`, {
    method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } })
  });
  const j = await res.json(); if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 500));
  return { text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '', model: m, raw: '' };
}

async function askOpenAI(prompt, model) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY not set');
  const m = model || 'gpt-5';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await res.json(); if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 500));
  return { text: j.choices?.[0]?.message?.content || '', model: j.model || m, raw: '' };
}

const ask = { 'openai-codex': askOpenAICodex, openai: askOpenAI, gemini: askGemini, vertex: askVertex }[provider];
if (!ask) { console.error('unknown provider ' + provider); process.exit(2); }
const providerName = { 'openai-codex': 'openai', openai: 'openai', gemini: 'google', vertex: 'google' }[provider];

for (const r of inputs) {
  if (only && r.claim_id !== only) continue;
  const prompt = fs.readFileSync(path.join(here, 'prompts', r.claim_id + '.md'), 'utf8');
  const t0 = Date.now();
  process.stdout.write(`${r.claim_id} via ${provider} ... `);
  try {
    const a = await ask(prompt, arg('model'));
    const j = parseJson(a.text);
    const rec = {
      claim_id: r.claim_id, theorem: r.theorem, module: r.module, rubric: 'lean-faithfulness/0.1.0',
      assessor: { provider: providerName, via: provider, model: a.model, date: new Date().toISOString(), blind: true, seconds: +((Date.now() - t0) / 1000).toFixed(1) },
      scores: j.scores, verdict: j.verdict, rationale: j.rationale
    };
    fs.writeFileSync(path.join(here, 'results', `${r.claim_id}.${providerName}.json`), JSON.stringify(rec, null, 1));
    console.log(`${rec.verdict} ${JSON.stringify(rec.scores)} (${rec.assessor.seconds}s, ${a.model})`);
  } catch (e) {
    console.log('FAILED: ' + e.message.slice(0, 400));
    fs.writeFileSync(path.join(here, 'results', `${r.claim_id}.${providerName}.error.txt`), String(e.stack || e));
  }
}
