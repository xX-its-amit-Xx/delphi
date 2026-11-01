// Tests for sim-engine/generative.   node sim-engine/generative/test/generative.mjs [--network]
//
// MUTATE=<name> flips one expectation so each guarded check can be seen to FAIL once:
//   manifest, parity-fm, parity-ddpm, determinism, conditioning, keep-size, fins, doc-valid, larva, bird, organ, cell,
//   not-configured, no-key-leak, metrics-claim, envelope, auth-failed (needs --network), fallback (needs --network)
// e.g. MUTATE=conditioning node sim-engine/generative/test/generative.mjs -> the conditioning check fails.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const M = process.env.MUTATE || '';
const NET = process.argv.includes('--network');
const HERE = import.meta.dirname;
const GEN = path.join(HERE, '..');
// Run with no provider keys, whatever the caller's shell holds (the key itself is never read here).
for (const k of ['NVIDIA_API_KEY', 'NEBIUS_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'GCP_PROJECT', 'GOOGLE_CLOUD_PROJECT']) delete process.env[k];

let pass = 0, fail = 0;
async function check(name, fn) {
  try {
    const ok = await fn(M === name);
    if (ok === true) { pass++; console.log(`ok   ${name}`); }
    else { fail++; console.log(`FAIL ${name}${typeof ok === 'string' ? `: ${ok}` : ''}`); }
  } catch (e) { fail++; console.log(`FAIL ${name}: ${e.message}`); }
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const { generate, backendsStatus } = await import('../index.mjs');
const { loadModel, netForward } = await import('../lib/flow.mjs');
const { GENERATIVE_TOOLS } = await import('../../tools/generative-tools.mjs');
const O = await import('../../lib/organism.mjs');
const { loadBundle } = await import('../../lib/data-node.mjs');
const { KINDS } = await import('../../lib/envelope.mjs');
const bundle = await loadBundle();

await check('manifest', mut => {
  const man = JSON.parse(fs.readFileSync(path.join(GEN, 'body/data/fishshapes-manifest.json'), 'utf8'));
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(GEN, 'body/data/fishshapes-derived.csv'))).digest('hex');
  const expect = mut ? '0'.repeat(64) : man.derived_file.sha256;
  if (sha !== expect) return `derived csv sha256 ${sha.slice(0, 12)} != manifest ${expect.slice(0, 12)}`;
  if (man.licence.id !== 'cc-zero') return `licence ${man.licence.id}`;
  if (man.taxa.Exocoetidae !== 79) return `Exocoetidae ${man.taxa.Exocoetidae}`;
  if (man.taxa.orders.some(o => /aves|formes$/i.test(o) && /(passer|accipitr|anser|gall|columb|strig|pic|charadr)iformes/i.test(o))) return 'a bird order is present';
  const csv = fs.readFileSync(path.join(GEN, 'body/data/fishshapes-derived.csv'), 'utf8');
  return !/\b(Aves|Passeriformes|Accipitridae)\b/.test(csv) || 'bird taxon string in derived table';
});

for (const kind of ['fm', 'ddpm']) {
  await check(`parity-${kind}`, mut => {
    const f = path.join(GEN, `body/model/${kind}-fixture.json`);
    if (!fs.existsSync(f)) return `${kind} fixture missing (train.py writes it)`;
    const fx = JSON.parse(fs.readFileSync(f, 'utf8'));
    const Mo = loadModel(JSON.parse(fs.readFileSync(path.join(GEN, `body/model/${kind}.json`), 'utf8')));
    let worst = 0;
    fx.x.forEach((x, i) => {
      const out = netForward(Mo, x, fx.t[i] + (mut ? 0.05 : 0), fx.fam[i], fx.obs[i], fx.mask[i]);
      out.forEach((v, j) => { worst = Math.max(worst, Math.abs(v - fx.out[i][j])); });
    });
    return worst < 1e-3 || `JS vs torch max |diff| ${worst.toExponential(2)}`;
  });
}

const ff = await generate({ level: 'body', base: 'flying-fish', text: '', n: 16, seed: 3 });
await check('determinism', async mut => {
  const again = await generate({ level: 'body', base: 'flying-fish', text: '', n: 16, seed: mut ? 4 : 3 });
  const other = await generate({ level: 'body', base: 'flying-fish', text: '', n: 16, seed: 5 });
  const a = JSON.stringify(ff.candidates.map(c => c.params)), b = JSON.stringify(again.candidates.map(c => c.params)), c = JSON.stringify(other.candidates.map(c => c.params));
  return (a === b && a !== c) || 'same seed must give the same candidates and a different seed different ones';
});

const deep = await generate({ level: 'body', base: 'flying-fish', text: 'a flying fish with a much deeper body and larger pectoral fins', n: 16, seed: 3 });
await check('conditioning', mut => {
  const m0 = median(ff.candidates.map(c => c.params.body_depth_over_SL)), m1 = median(deep.candidates.map(c => c.params.body_depth_over_SL));
  const k0 = median(ff.candidates.map(c => c.params.fulton_K)), k1 = median(deep.candidates.map(c => c.params.fulton_K));
  // deeper body must raise depth; the model should also carry mass along (deeper teleosts are heavier for their length)
  if (mut ? m1 <= m0 * 1.5 : m1 > m0 * 1.15) { if (k1 > k0) return true; return `depth rose but K did not (K ${k0.toFixed(2)} -> ${k1.toFixed(2)})`; }
  return `median depth/SL ${m0.toFixed(3)} -> ${m1.toFixed(3)}`;
});

await check('keep-size', mut => {
  const want = 0.203 * (mut ? 1.1 : 1);
  return ff.candidates.every(c => Math.abs(c.params.standard_length_m - want) < 1e-6) || `SL ${ff.candidates[0].params.standard_length_m} != ${want}`;
});

await check('fins', mut => {
  const ng = deep.parsed_text.not_generated.find(x => /pectoral/.test(x.clause));
  if (!ng) return 'pectoral clause not reported as not generated';
  const doc = deep.candidates[0].organism;
  const touched = doc.edits.filter(e => /pectoral/.test(e.param)).length + (mut ? 1 : 0);
  return touched === 0 || 'a fin parameter was edited by the body model';
});

await check('doc-valid', async mut => {
  const c = deep.candidates[0];
  const r = O.resolveParameters(bundle, c.organism);
  const { resolveState } = await import('../../lib/state.mjs');
  const st = resolveState(c.organism, 365, {}, bundle);
  const want = c.params.body_depth_over_SL * (mut ? 1.2 : 1);
  if (Math.abs(r.params.body_depth_over_SL.value - want) > 1e-4 * want) return `resolved depth ${r.params.body_depth_over_SL.value} != ${want}`;
  return (st.mass_kg?.value > 0) || 'STATE has no mass';
});

await check('larva', async mut => {
  const r = await generate({ level: 'body', base: mut ? 'zebrafish-adult' : 'zebrafish-larva', n: 2 });
  return (r.status === 'out of training distribution' && r.candidates.length === 0) || `status ${r.status}`;
});
await check('bird', async mut => {
  const r = await generate({ level: 'body', base: 'flying-fish', text: mut ? 'a fish with a deeper body' : 'a flying fish shaped like a swallow', n: 2 });
  return (r.status === 'refused' && r.candidates.length === 0) || `status ${r.status}`;
});
await check('organ', async mut => {
  const rs = await Promise.all(['organ', 'system', 'tissue'].map(level => generate({ level: mut ? 'body' : level, base: 'flying-fish', n: 2 })));
  return rs.every(r => r.status === 'no training data' && r.candidates.length === 0) || rs.map(r => r.status).join(',');
});
await check('cell', async mut => {
  const r = await generate({ level: mut ? 'organ' : 'cell', n: 2 });
  return (r.status === 'not configured' && r.candidates.length === 0) || `status ${r.status}`;
});

const st = await backendsStatus({ fresh: true });
await check('not-configured', mut => {
  const pv = st.providers;
  const want = mut ? 'ok' : 'not configured';
  return (['nvidia-nim', 'nebius', 'vertex'].every(k => pv[k].status === want)) || JSON.stringify(Object.fromEntries(Object.entries(pv).map(([k, v]) => [k, v.status])));
});

await check('no-key-leak', async mut => {
  const fake = 'nvapi-' + 'TESTKEY-not-real-0000'; // split so this file does not itself look like a key
  process.env.NVIDIA_API_KEY = fake; process.env.NEBIUS_API_KEY = 'neb-TESTKEY-not-real';
  const { nimHealth, nebiusHealth } = await import('../backends/providers.mjs');
  // offline: a stub fetch answers 401, so the auth-failed path runs and nothing leaves the box
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{"detail":"unauthorized"}', { status: 401 });
  let s;
  try { s = JSON.stringify([await nimHealth({ fresh: true }), await nebiusHealth({ fresh: true })]) + (mut ? fake : ''); }
  finally { globalThis.fetch = realFetch; delete process.env.NVIDIA_API_KEY; delete process.env.NEBIUS_API_KEY; }
  if (!/auth failed/.test(s)) return `stubbed 401 did not read as auth failed: ${s.slice(0, 160)}`;
  const files = fs.readdirSync(GEN, { recursive: true }).filter(f => /\.(mjs|json|md|py)$/.test(f) && !/node_modules/.test(f));
  const inFiles = files.filter(f => /nvapi-[A-Za-z0-9_-]{20,}|bak-[A-Za-z0-9]{20,}/.test(fs.readFileSync(path.join(GEN, f), 'utf8')));
  if (inFiles.length) return `key-like string in ${inFiles.join(', ')}`;
  return (!s.includes('TESTKEY')) || 'a status result echoed the key';
});

await check('metrics-claim', mut => {
  const m = JSON.parse(fs.readFileSync(path.join(GEN, 'body/model/metrics.json'), 'utf8'));
  const fm = m.runs.fm.nll_family_conditioned.all.mean_nll, g = m.baselines.gaussian_family.all.mean_nll;
  const d = m.runs.fm.paired_vs_gaussian_family;
  // RESULTS.md claims: the flow beats the family Gaussian on held-out species by more than 3 paired SEs
  return (mut ? fm > g : fm < g && d.mean_diff_nll + 3 * d.se < 0) || `flow ${fm.toFixed(3)} vs family Gaussian ${g.toFixed(3)} nats`;
});

await check('envelope', async mut => {
  const tool = GENERATIVE_TOOLS.find(t => t.name === 'generate_candidates');
  const env = await tool.handler({ level: 'body', base: [{ organism: 'zebrafish-adult', weight: 0.7 }, { organism: 'flying-fish', weight: 0.3 }], text: 'slightly more slender', n: 10, seed: 2 });
  if (!env.scope || !env.contract_version) return 'no scope / contract_version';
  if (env.provenance.some(q => !(q.kind in KINDS))) return 'unknown provenance kind';
  const fams = env.result.candidates.map(c => c.conditioned_on.family);
  const nC = fams.filter(f => f === 'Cyprinidae').length, nE = fams.filter(f => f === 'Exocoetidae').length;
  return ((mut ? nC === 3 : nC === 7) && nE === 10 - nC) || `apportioned ${nC} Cyprinidae / ${nE} Exocoetidae for a 70/30 blend`;
});

if (NET) {
  await check('auth-failed', async mut => {
    process.env.NVIDIA_API_KEY = mut ? '' : 'bak-TESTKEY-not-a-nim-key';
    const { nimHealth } = await import('../backends/providers.mjs');
    const r = await nimHealth({ fresh: true }); delete process.env.NVIDIA_API_KEY;
    return r.status === 'auth failed' || `NIM with a bogus key: ${r.status}`;
  });
  await check('fallback', async mut => {
    const r = await generate({ level: 'protein', base: mut ? 'NOTAPROTEIN1' : 'P69905', n: 2 });
    return (r.candidates.length === 0 && /not configured/.test(r.status) && r.fallback.alphafold_db?.mean_plddt > 50) || JSON.stringify(r).slice(0, 200);
  });
}

console.log(`\n${pass} passed, ${fail} failed${M ? ` (MUTATE=${M})` : ''}`);
process.exitCode = fail ? 1 : 0;
