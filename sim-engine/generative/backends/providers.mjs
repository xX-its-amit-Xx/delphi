// Hosted providers: NVIDIA NIM / BioNeMo, Nebius AI Studio, Google Cloud Vertex AI.
//
// Credentials are read ONLY from environment variables at call time and never written, logged or echoed:
//   NVIDIA_API_KEY                                  (NIM keys start "nvapi-"; a Brev "bak-" key is not a NIM key)
//   NEBIUS_API_KEY  [NEBIUS_BASE_URL]               (OpenAI-compatible; default https://api.studio.nebius.com/v1)
//   GOOGLE_APPLICATION_CREDENTIALS + GCP_PROJECT (or GOOGLE_CLOUD_PROJECT)  [GCP_REGION, default us-central1]
// Each health check returns one of: 'not configured' | 'auth failed' | 'unreachable' | 'error' | 'ok', honestly.
// A health result is cached for 10 minutes so a status call does not spend a request every time.

import fs from 'node:fs';
import crypto from 'node:crypto';

const TTL = 10 * 60 * 1000;
const memo = new Map();
const fetchT = (url, opt = {}, ms = 30000) => fetch(url, { ...opt, headers: { 'User-Agent': 'delphisci-sim-engine/0.1', ...(opt.headers || {}) }, signal: AbortSignal.timeout(ms) });
async function cached(key, fn, fresh) {
  const c = memo.get(key);
  if (!fresh && c && Date.now() - c.t < TTL) return { ...c.v, cached: true };
  const v = await fn(); memo.set(key, { t: Date.now(), v }); return v;
}
const verdict = (code) => (code >= 200 && code < 300 ? 'ok' : code === 401 || code === 403 ? 'auth failed' : 'error');

// ---------------------------------------------------------------- NVIDIA NIM (health.api.nvidia.com)
export const NIM = {
  base: 'https://health.api.nvidia.com/v1',
  // Endpoint paths as documented on build.nvidia.com model cards. NOT exercised against a live key from this box:
  // the only key provided was a Brev "bak-" key, which NIM rejects (HTTP 401). Marked unverified in status().
  endpoints: {
    esmfold: '/biology/nvidia/esmfold',
    proteinmpnn: '/biology/ipd/proteinmpnn/predict',
    rfdiffusion: '/biology/ipd/rfdiffusion/generate',
    evo2: '/biology/arc/evo2-40b/generate',
  },
};
function nimKey() { const k = process.env.NVIDIA_API_KEY; return k && k.trim() ? k.trim() : null; }
function keyShape(k) { return k.startsWith('nvapi-') ? 'nvapi- (NIM key format)' : k.startsWith('bak-') ? 'bak- (a Brev key: NIM expects nvapi-)' : 'unrecognised prefix'; }

export async function nimHealth({ fresh = false } = {}) {
  const k = nimKey();
  if (!k) return { provider: 'nvidia-nim', status: 'not configured', need: 'set NVIDIA_API_KEY (an nvapi- key from build.nvidia.com) in the environment' };
  return cached('nim', async () => {
    try {
      // Cheapest authenticated call: fold an 8-residue peptide on the ESMFold NIM.
      const r = await fetchT(NIM.base + NIM.endpoints.esmfold, { method: 'POST', headers: { Authorization: `Bearer ${k}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ sequence: 'MKTAYIAK' }) }, 60000);
      return { provider: 'nvidia-nim', status: r.status === 202 ? 'ok' : verdict(r.status), http: r.status, key_format: keyShape(k), probe: 'POST esmfold (8 residues)' };
    } catch (e) { return { provider: 'nvidia-nim', status: 'unreachable', error: e.message, key_format: keyShape(k) }; }
  }, fresh);
}

/** POST to a NIM endpoint; follows the NVCF 202 + NVCF-REQID polling protocol. */
export async function nimCall(name, body, { maxWaitMs = 300000 } = {}) {
  const k = nimKey(); if (!k) throw new Error('NVIDIA_API_KEY not set');
  const h = { Authorization: `Bearer ${k}`, 'content-type': 'application/json', accept: 'application/json' };
  let r = await fetchT(NIM.base + NIM.endpoints[name], { method: 'POST', headers: h, body: JSON.stringify(body) }, 120000);
  const t0 = Date.now();
  while (r.status === 202) {
    const id = r.headers.get('nvcf-reqid'); if (!id) throw new Error('NIM returned 202 without NVCF-REQID');
    if (Date.now() - t0 > maxWaitMs) throw new Error(`NIM ${name} still pending after ${maxWaitMs} ms (request ${id})`);
    await new Promise(res => setTimeout(res, 3000));
    r = await fetchT(`${NIM.base}/status/${id}`, { headers: h }, 60000);
  }
  if (!r.ok) throw new Error(`NIM ${name}: HTTP ${r.status} ${verdict(r.status)}`);
  return r.json();
}

// ---------------------------------------------------------------- Nebius AI Studio (OpenAI-compatible)
const nebiusBase = () => (process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.com/v1').replace(/\/$/, '');
export async function nebiusHealth({ fresh = false } = {}) {
  const k = process.env.NEBIUS_API_KEY;
  if (!k) return { provider: 'nebius', status: 'not configured', need: 'set NEBIUS_API_KEY (Nebius AI Studio / Token Factory API key); optional NEBIUS_BASE_URL' };
  return cached('nebius', async () => {
    try {
      const r = await fetchT(`${nebiusBase()}/models`, { headers: { Authorization: `Bearer ${k}` } });
      let models = null; if (r.ok) { const j = await r.json(); models = (j.data || []).map(m => m.id); }
      return { provider: 'nebius', status: verdict(r.status), http: r.status, base_url: nebiusBase(), model_count: models?.length ?? null, models_sample: models?.slice(0, 12) ?? null };
    } catch (e) { return { provider: 'nebius', status: 'unreachable', error: e.message, base_url: nebiusBase() }; }
  }, fresh);
}
export async function nebiusChat(messages, { model = process.env.NEBIUS_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct', temperature = 0 } = {}) {
  const k = process.env.NEBIUS_API_KEY; if (!k) throw new Error('NEBIUS_API_KEY not set');
  const r = await fetchT(`${nebiusBase()}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${k}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 400 }) }, 60000);
  if (!r.ok) throw new Error(`Nebius chat: HTTP ${r.status} ${verdict(r.status)}`);
  const j = await r.json(); return { text: j.choices?.[0]?.message?.content ?? '', model };
}

// ---------------------------------------------------------------- Google Cloud Vertex AI
const gcpProject = () => process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || null;
const gcpRegion = () => process.env.GCP_REGION || 'us-central1';
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function gcpToken() {
  const f = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const cred = JSON.parse(fs.readFileSync(f, 'utf8'));
  let body;
  if (cred.type === 'service_account') {
    const now = Math.floor(Date.now() / 1000);
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({ iss: cred.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 }));
    const sig = b64url(crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(cred.private_key));
    body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` });
  } else if (cred.type === 'authorized_user') {
    body = new URLSearchParams({ grant_type: 'refresh_token', client_id: cred.client_id, client_secret: cred.client_secret, refresh_token: cred.refresh_token });
  } else throw new Error(`unsupported credential type "${cred.type}" (service_account or authorized_user)`);
  const r = await fetchT('https://oauth2.googleapis.com/token', { method: 'POST', body });
  if (!r.ok) { const e = new Error(`token exchange HTTP ${r.status}`); e.http = r.status; throw e; }
  return (await r.json()).access_token;
}
export async function vertexHealth({ fresh = false } = {}) {
  const f = process.env.GOOGLE_APPLICATION_CREDENTIALS, proj = gcpProject();
  if (!f || !proj) return { provider: 'vertex', status: 'not configured', need: 'set GOOGLE_APPLICATION_CREDENTIALS (path to a service-account or authorized-user JSON) and GCP_PROJECT; optional GCP_REGION' };
  if (!fs.existsSync(f)) return { provider: 'vertex', status: 'not configured', need: 'GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist' };
  return cached('vertex', async () => {
    let tok;
    try { tok = await gcpToken(); } catch (e) { return { provider: 'vertex', status: e.http === 400 || e.http === 401 ? 'auth failed' : 'error', error: e.message }; }
    try {
      const url = `https://${gcpRegion()}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${gcpRegion()}/endpoints?pageSize=1`;
      const r = await fetchT(url, { headers: { Authorization: `Bearer ${tok}` } });
      return { provider: 'vertex', status: verdict(r.status), http: r.status, project: proj, region: gcpRegion(), probe: 'GET endpoints (Vertex AI API)' };
    } catch (e) { return { provider: 'vertex', status: 'unreachable', error: e.message }; }
  }, fresh);
}
export async function vertexGenerate(prompt, { model = process.env.VERTEX_MODEL || 'gemini-2.5-flash' } = {}) {
  const tok = await gcpToken(); const proj = gcpProject(); const reg = gcpRegion();
  const url = `https://${reg}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${reg}/publishers/google/models/${model}:generateContent`;
  const r = await fetchT(url, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 400 } }) }, 60000);
  if (!r.ok) throw new Error(`Vertex generateContent: HTTP ${r.status} ${verdict(r.status)}`);
  const j = await r.json(); return { text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '', model };
}

// ---------------------------------------------------------------- public, no-key endpoints (working fallbacks)
export async function publicHealth({ fresh = false } = {}) {
  return cached('public', async () => {
    const out = {};
    try { const r = await fetchT('https://alphafold.ebi.ac.uk/api/prediction/P69905', {}, 20000); out.alphafold_db = r.ok ? 'ok' : `error (HTTP ${r.status})`; }
    catch (e) { out.alphafold_db = `unreachable (${e.message})`; }
    try { const r = await fetchT('https://api.esmatlas.com/foldSequence/v1/pdb/', { method: 'POST', body: 'MKTAYIAKQRQISFVKSHFSRQ' }, 60000); out.esmfold_esmatlas = r.ok ? 'ok' : `error (HTTP ${r.status})`; }
    catch (e) { out.esmfold_esmatlas = `unreachable (${e.message})`; }
    return out;
  }, fresh);
}

// ---------------------------------------------------------------- LLM text assist (optional; output re-validated)
/** Ask a configured LLM (Nebius or Vertex) to restate a design request in the body lexicon. The caller re-parses the
 *  returned line with the rule-based parser, so the LLM can only choose among supported attributes. */
export async function assistText(text, provider) {
  const prompt = 'Rewrite this organism-design request as ONE short line using only these phrases: "deeper body", "more slender", "wider body", "narrower body", "deeper caudal peduncle", "shallower caudal peduncle", "heavier", "lighter", "larger fish", "smaller fish", optionally preceded by "much" or "slightly", plus the base organism ("flying fish" or "zebrafish") and optionally "<family>-like" (e.g. tuna-like). Mention fins or organs only by copying the user\'s words. Output only the line.\nRequest: ' + text;
  if (provider === 'nebius') return nebiusChat([{ role: 'user', content: prompt }]);
  if (provider === 'vertex') return vertexGenerate(prompt);
  throw new Error(`unknown assist provider "${provider}" (nebius or vertex)`);
}
