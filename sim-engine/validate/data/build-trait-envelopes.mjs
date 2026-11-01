// Builds data/trait-envelopes.v1.2.0.json: per-trait envelopes for scorer v1.2.0, from the POSITIVE items of the
// benchmark's DEV partition only (sim-engine/validate/benchmark/dev/items.jsonl; FishShapes v1 CC0 and FishBase
// MORPHMET CC BY-NC 4.0 measurements). heldout/ is never opened. An envelope is [min, max] of log10(value)
// over positives with a value > 0; traits with fewer than 20 positive values get no envelope (reported, unchecked).
//   node sim-engine/validate/data/build-trait-envelopes.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const DEV = path.resolve(import.meta.dirname, '..', 'benchmark', 'dev', 'items.jsonl');
const raw = fs.readFileSync(DEV);
const items = raw.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(d => d.label === 'positive');
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const vals = {};
for (const d of items) for (const [k, v] of Object.entries(d.params || {})) if (typeof v === 'number' && v > 0) (vals[k] ||= []).push(Math.log10(v));
const env = {}, skipped = {};
for (const [k, xs] of Object.entries(vals)) {
  if (xs.length < 20) { skipped[k] = xs.length; continue; }
  const lo = Math.min(...xs), hi = Math.max(...xs);
  env[k] = { lo_log10: lo, hi_log10: hi, lo: 10 ** lo, hi: 10 ** hi, q001: 10 ** q(xs, 0.001), q999: 10 ** q(xs, 0.999), n: xs.length };
}
const out = { built: new Date().toISOString(), source: 'benchmark/dev/items.jsonl positives only (heldout/ never read)', dev_sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  rule: 'envelope = [min, max] of log10(value) over dev positives with value > 0 (the benchmark already screened transcription errors); n >= 20', n_positive_items: items.length, envelopes: env, skipped_too_few: skipped };
fs.writeFileSync(path.join(import.meta.dirname, 'trait-envelopes.v1.2.0.json'), JSON.stringify(out, null, 1));
console.log(Object.keys(env).length, 'envelopes;', 'skipped', JSON.stringify(skipped));
