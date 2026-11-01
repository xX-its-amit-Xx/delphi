/* Cloudflare Worker for delphi-mission-control.
 *
 * Everything on this site is static except one route: POST /api/chat, which proxies to SambaNova.
 *
 * WHY A PROXY AT ALL. The obvious thing — call the model from the page — would put the API key in
 * the client bundle, which on a public site means publishing it. The key is held as an encrypted
 * Worker secret (`wrangler secret put SAMBANOVA_API_KEY`), is never written to the repository, and
 * never reaches the browser. If the secret is missing the route says so plainly instead of failing
 * in a way that looks like the model refusing to answer.
 *
 * WHAT THE PROXY WILL NOT DO. It does not accept a model name, a system prompt, or a temperature
 * from the client: all three are fixed here. Otherwise the route is an open relay to a paid
 * inference account that anyone can point anywhere. The client sends only the conversation turns.
 */

// TWO PROVIDERS, tried in order, and several models within each.
//
// Groq is first: it is markedly faster and, on the first live test, actually had capacity when
// every SambaNova model was returning 429 "currently experiencing high demand". That 429 is per
// MODEL rather than per account, so a single hard-coded model means the assistant is down whenever
// that one model is busy — which is exactly what happened on the first live call, hence the list.
//
// Each provider's key is a separate encrypted Worker secret. A provider whose key is absent is
// skipped silently, so the site works with either key, both, or (degrading honestly) neither.
const PROVIDERS = [
  {
    name: 'groq',
    env: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
    // gpt-oss is a reasoning model: without this it spends the whole budget on hidden reasoning
    // and returns an EMPTY content string with finish_reason "length", which looks like a model
    // failure and is really a configuration one.
    extra: { reasoning_effort: 'low' },
  },
  {
    name: 'sambanova',
    env: 'SAMBANOVA_API_KEY',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    models: ['Meta-Llama-3.3-70B-Instruct', 'gemma-4-31B-it', 'DeepSeek-V3.2', 'DeepSeek-V3.1'],
    extra: {},
  },
];

const MAX_TURNS = 16;
const MAX_CHARS = 4000;

const SYSTEM = `You are the guide to MorphoLemma (the repository calls itself DELPHI; they are the
same system). You answer questions about this project for people reading its site.

THE ONE RULE THAT MATTERS. This project's entire argument is that it does not state numbers it
cannot trace. So: never invent a figure, a file path, a tool name, a claim id or a result. If the
context below does not contain the answer, say you do not know and name the page that would have
it. A confident wrong number from you would undermine the thing the project is for. "I don't know,
try /docs/#harness" is a good answer here; a plausible guess is not.

Other things to hold to:
- Never present the composite score as a verdict. Adding one criterion the design already met moved
  it from 0.4676 "not plausible" to 0.878 "plausible". It is reported, never gated on.
- cannot-evaluate and cannot-assess are not passes. They are the absence of a judgement.
- The five validation results are named and never summed.
- Our own headline design FAILS. The winged zebrafish cannot leave the water: 0.67 m/s against
  8.64 m/s required, lifting area 166x too small. Say so plainly; it is the point, not an
  embarrassment.
- The swarm benchmark mostly found NO difference between architectures. Do not oversell it.
- Aves (birds) is a frozen holdout. Never discuss bird data, bird taxa or bird-linked claims.

Style: direct and specific, two or three short paragraphs at most, plain prose. Link pages as
relative paths like /docs/#harness or /t/benchmark/. No bullet-point walls, no marketing voice.

After your answer, on its own final line, output exactly:
FOLLOWUPS: question one | question two | question three
Three short follow-up questions a reader would plausibly ask next, each under about 9 words. That
line is parsed by the page and removed before display.`;

function cors(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'content-type': 'application/json; charset=utf-8',
    ...extra,
  };
}

const bad = (status, error, hint) =>
  new Response(JSON.stringify({ error, hint }), { status, headers: cors() });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/chat') {
      return env.ASSETS.fetch(request);
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (request.method !== 'POST') return bad(405, 'POST only');

    const available = PROVIDERS.filter(p => env[p.env]);
    if (!available.length) {
      return bad(503, 'The chat backend is not configured.',
        'Neither GROQ_API_KEY nor SAMBANOVA_API_KEY is set on this Worker. '
        + 'Run: wrangler secret put GROQ_API_KEY');
    }

    let body;
    try { body = await request.json(); } catch { return bad(400, 'Body must be JSON.'); }

    // Only the turns are taken from the client. Provider, model, system prompt and sampling are
    // all fixed here; otherwise this route is an open relay to a paid inference account.
    const turns = Array.isArray(body?.messages) ? body.messages : null;
    if (!turns || !turns.length) return bad(400, 'messages[] is required.');

    const clean = turns
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_TURNS)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!clean.length) return bad(400, 'no usable turns in messages[]');

    // Grounding: the site's own generated facts, served as a static asset so they cannot drift
    // from what the pages show. A fetch failure is not fatal — the model is told it has no
    // context, which makes it answer "I don't know" rather than inventing something.
    let context = '';
    try {
      const r = await env.ASSETS.fetch(new Request(new URL('/chat-context.json', url).toString()));
      if (r.ok) context = (await r.text()).slice(0, 24000);
    } catch { /* fall through with no context */ }

    const system = SYSTEM + (context
      ? `

CONTEXT (generated from the repository's own files; every figure here is traceable):
${context}`
      : `

NO CONTEXT WAS AVAILABLE on this request. Answer only what you are certain of from the
rules above, and otherwise say you cannot check right now and point at /docs/.`);

    let json = null, used = null, lastStatus = 0, lastDetail = '';
    outer:
    for (const prov of available) {
      for (const model of prov.models) {
        let upstream;
        try {
          upstream = await fetch(prov.url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${env[prov.env]}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: system }, ...clean],
              temperature: 0.2,
              max_tokens: 900,
              ...prov.extra,
            }),
          });
        } catch (e) { lastStatus = 0; lastDetail = String(e).slice(0, 200); continue; }

        if (upstream.ok) {
          let j = null;
          try { j = await upstream.json(); } catch { lastStatus = 502; lastDetail = 'body was not JSON'; continue; }
          // A 200 with empty content is a failure wearing a success code: a reasoning model that
          // ran out of budget returns exactly that. Treat it as a miss and try the next model.
          if (!j?.choices?.[0]?.message?.content) {
            lastStatus = 502;
            lastDetail = `${prov.name}/${model} returned an empty answer (finish_reason: ${j?.choices?.[0]?.finish_reason ?? 'unknown'})`;
            continue;
          }
          json = j; used = `${prov.name}/${model}`;
          break outer;
        }
        lastStatus = upstream.status;
        lastDetail = (await upstream.text().catch(() => '')).slice(0, 300);
        // A 4xx that is not "busy" means the request itself is wrong, so trying more models just
        // repeats the same mistake. Move to the next provider instead.
        if (upstream.status !== 429 && upstream.status < 500) break;
      }
    }

    if (!json) {
      return bad(502,
        lastStatus === 429
          ? 'Every model is busy right now. Try again in a moment.'
          : `The model backend returned ${lastStatus || 'no response'}.`,
        lastDetail);
    }

    const text = json?.choices?.[0]?.message?.content ?? '';
    if (!text) return bad(502, 'The model returned an empty answer.');

    // Split the FOLLOWUPS: tail off the end. Parsed defensively: a model that ignores the format
    // costs the reader nothing, it just means no follow-up chips on that turn.
    let answer = text.trim();
    let followups = [];
    const m = answer.match(/\n?FOLLOWUPS:\s*(.+)\s*$/i);
    if (m) {
      answer = answer.slice(0, m.index).trim();
      followups = m[1].split('|').map(s => s.trim()).filter(s => s.length > 2 && s.length < 90).slice(0, 3);
    }

    return new Response(JSON.stringify({ answer, followups, model: used }), { headers: cors() });
  },
};
