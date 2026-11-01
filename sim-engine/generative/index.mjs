// sim-engine/generative: one interface over every level's generative backend.
//
//   generate({level, base, text, conditions, n, seed})
//     -> { candidates: [{params | structure | sequence | organism, provenance, ...}], model, backend, scope, status, ... }
//   backendsStatus({fresh}) -> per level and per provider: 'ok' | 'not configured' | 'auth failed' | 'no training data' | ...
//
// Levels: body (REAL, local flow matching / DDPM on FishShapes v1), protein (NVIDIA NIM if keyed; public structure
// fallback otherwise), organ / system / tissue (no training data, by decision), cell (not configured).
// Results are wrapped in the sim-engine provenance envelope (lib/envelope.mjs) by the tool layer.

import { generateBody, status as bodyStatus } from './backends/body.mjs';
import { generateProtein, status as proteinStatus } from './backends/protein.mjs';
import { generateNoData, status as noDataStatus } from './backends/no-data.mjs';
import { nimHealth, nebiusHealth, vertexHealth, publicHealth, assistText } from './backends/providers.mjs';
import { envelope, p } from '../lib/envelope.mjs';

export const LEVELS = ['cell', 'tissue', 'organ', 'system', 'body', 'protein'];

let ctx = null;
async function context() {
  if (ctx) return ctx;
  const [{ loadBundle }, O, { parseDesignText }] = await Promise.all([import('../lib/data-node.mjs'), import('../lib/organism.mjs'), import('../lib/parse-text.mjs')]);
  return (ctx = { bundle: await loadBundle(), O, parseDesignText });
}

export async function generate(args = {}) {
  const { level = 'body', base, text = '', conditions = {}, n = 4, seed = 1 } = args;
  if (!LEVELS.includes(level)) throw new Error(`level must be one of ${LEVELS.join(', ')}`);
  if (/\b(bird|birds|aves|avian|sparrow|swallow|eagle|pigeon|penguin|hummingbird)\b/i.test(text))
    return { status: 'refused', candidates: [], model: null, backend: null, scope: 'Birds are refused: Aves is the frozen holdout. Nothing generated.' };
  if (level === 'body') {
    const c = await context();
    let t = text; let assist = null;
    if (conditions.llm_assist && text) {
      // optional: an LLM restates the request in the supported lexicon; the rule parser still decides
      try { const a = await assistText(text, conditions.llm_assist); assist = { provider: conditions.llm_assist, model: a.model, rewritten: a.text }; t = `${text}; ${a.text}`; }
      catch (e) { assist = { provider: conditions.llm_assist, error: e.message }; }
    }
    const r = await generateBody({ base, text: t, conditions, n, seed }, c);
    return { backend: 'local', ...r, ...(assist ? { llm_assist: assist } : {}) };
  }
  if (level === 'protein') return generateProtein({ base, conditions, n, seed });
  return generateNoData({ level });
}

export async function backendsStatus({ fresh = false } = {}) {
  const [nim, nebius, vertex, pub] = await Promise.all([nimHealth({ fresh }), nebiusHealth({ fresh }), vertexHealth({ fresh }), publicHealth({ fresh })]);
  const protein = await proteinStatus();
  return {
    levels: {
      body: bodyStatus(), protein, organ: noDataStatus('organ'), system: noDataStatus('system'), tissue: noDataStatus('tissue'), cell: noDataStatus('cell'),
    },
    providers: { 'nvidia-nim': nim, nebius, vertex, public_no_key: pub },
    credentials_policy: 'keys are read from environment variables at call time only; nothing is written to disk or returned',
  };
}

// ---------------------------------------------------------------- envelope wrappers used by the MCP tools and CLI
export async function generateEnvelope(args) {
  const r = await generate(args);
  const prov = r.provenance?.length ? r.provenance : [p('generative backend', r.backend || 'none', 'derived', `sim-engine/generative (${args.level || 'body'})`)];
  const { provenance, scope, ...rest } = r;
  return envelope(rest, prov, scope || 'No scope returned by the backend.');
}
export async function statusEnvelope(args = {}) {
  const s = await backendsStatus(args);
  return envelope(s, [p('backend health', 'live probes', 'derived', 'HTTP probes made at call time (cached 10 min); body-model metrics from sim-engine/generative/body/model/metrics.json')],
    'A health check says whether a provider answered and accepted the key, nothing about model quality. "ok" for the public endpoints means structure lookup/prediction only, not generation.');
}
