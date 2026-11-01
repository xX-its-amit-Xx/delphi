#!/usr/bin/env node
// Scorer v1.2.0 on the benchmark DEV partition only (never heldout/), under leave-one-family-out (LOFO), with the
// benchmark's own pre-registered comparisons (benchmark/BENCHMARK-PREREGISTRATION.md P1-P3, S1, S2, S4) computed
// on dev. Refuses to run unless SCORER-PREREGISTRATION-v1.2.0.md carries its sha256 on its last line.
// The scorer sees only params, lean_spec and doc, as the benchmark protocol requires.
//   node sim-engine/validate/dev-benchmark-v12.mjs        -> dev-benchmark-v1.2.0.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { designScoreV12 } from './score-v12.mjs';
import { designScore } from './score.mjs';
import { mulberry32 } from './phenotype.mjs';

const DIR = import.meta.dirname;
const PRE = path.join(DIR, 'SCORER-PREREGISTRATION-v1.2.0.md');
{ const t = fs.readFileSync(PRE, 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n'); const last = t.pop(); const h = crypto.createHash('sha256').update(t.join('\n') + '\n').digest('hex');
  if (!last.includes(h)) throw new Error('SCORER-PREREGISTRATION-v1.2.0.md is not hashed: ' + h); }
const items = fs.readFileSync(path.join(DIR, 'benchmark', 'dev', 'items.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const N = +(process.env.N_PER_GROUP || 1000);
const rnd = mulberry32(20261102);
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const src = d => (/fishbase/i.test(JSON.stringify(d.source)) ? 'fishbase' : /fishshapes/i.test(JSON.stringify(d.source)) ? 'fishshapes' : 'other');
const groups = {
  fishshapes_pos: items.filter(d => d.subset === 'fishshapes_specimen'), fishbase_pos: items.filter(d => d.subset === 'fishbase_picture'),
  fishshapes_decoy: items.filter(d => ['decoy_shuffle_all', 'decoy_shuffle_shape'].includes(d.neg_type) && src(d) === 'fishshapes'),
  fishbase_decoy: items.filter(d => ['decoy_shuffle_all', 'decoy_shuffle_shape'].includes(d.neg_type) && src(d) === 'fishbase'),
  hard: items.filter(d => ['decoy_shuffle_one', 'chimera_extreme_corner'].includes(d.neg_type)),
};
const sample = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, shuffle(v).slice(0, N)]));
sample.easy = items.filter(d => ['out_of_range_extrapolation', 'law_breaker', 'impossible_combo', 'organ_containment'].includes(d.neg_type));
sample.ontogeny = items.filter(d => d.subset === 'ontogeny_stage');
sample.other_pos = items.filter(d => ['specimen_with_fins', 'specimen_mass_length', 'mutant_quantified', 'mutant_qualitative', 'mutant_baseline'].includes(d.subset));

const lofo = d => { const e = d.exclusion || {}; return [...(e.family || []).map(f => `family:${f}`), ...(e.species || []).map(s => `species:${s}`)]; };
const designOf = d => (d.doc ? { doc: d.doc, params: d.params, lean_spec: d.lean_spec } : { params: d.params, lean_spec: d.lean_spec });
const t0 = Date.now(); const rows = {};
for (const [g, list] of Object.entries(sample)) {
  rows[g] = [];
  for (const d of list) {
    const r = await designScoreV12(designOf(d), { reference_set_excluding: lofo(d), network: false });
    let r10 = null;
    if (!d.doc) { try { const raw = {}; const M = { standard_length_m: 'SL_m', body_mass_kg: 'mass_kg', body_depth_over_SL: 'depth_SL', body_width_over_SL: 'width_SL', peduncle_depth_frac: 'ped_depth_frac', peduncle_width_frac: 'ped_width_frac', pectoral_len_over_SL: 'pectoral_len_SL', pectoral_area_over_SL2: 'pectoral_area_SL2', pectoral_span_over_SL: 'pectoral_span_SL' };
      for (const [k, v] of Object.entries(d.params || {})) if (M[k]) raw[M[k]] = v; r10 = (await designScore({ specimen: raw }, { version: '1.0.0', reference_set_excluding: lofo(d), network: false })).score; } catch (e) { r10 = null; } }
    rows[g].push({ id: d.id, label: d.label, type: d.subset || d.neg_type, score: r.score, rank_score: r.rank_score, plausible: r.plausible, coverage: r.coverage?.checked ?? 0, refused: r.refused || null, error: r.error || null, v100_score: r10 });
  }
  console.error(g, rows[g].length, Math.round((Date.now() - t0) / 1000) + 's');
}
const auc = (pos, neg) => { if (!pos.length || !neg.length) return null; const a = [...pos.map(v => [v, 1]), ...neg.map(v => [v, 0])].sort((x, y) => x[0] - y[0]); let r = 0, i = 0, sumPos = 0; while (i < a.length) { let j = i; while (j < a.length && a[j][0] === a[i][0]) j++; const avg = (i + j + 1) / 2; for (let k = i; k < j; k++) if (a[k][1]) sumPos += avg; i = j; } return (sumPos - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length); };
const q = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s.length ? s[lo] + (s[hi] - s[lo]) * (i - lo) : null; };
const vals = (g, k) => rows[g].map(r => r[k]).filter(x => x != null);
const allPos = k => [...vals('fishshapes_pos', k), ...vals('fishbase_pos', k), ...vals('ontogeny', k), ...vals('other_pos', k)];
const report = {};
for (const k of ['rank_score', 'score', 'v100_score']) {
  const p5 = q(allPos(k), 0.05), decoys = [...vals('fishshapes_decoy', k), ...vals('fishbase_decoy', k)];
  const easy = rows.easy.map(r => r[k]).filter(x => x != null);
  report[k] = {
    P1_auc_fishshapes: auc(vals('fishshapes_pos', k), vals('fishshapes_decoy', k)),
    P2_easy_below_p5_of_positives: easy.length ? easy.filter(v => v < p5).length / easy.length : null, P2_by_type: Object.fromEntries([...new Set(rows.easy.map(r => r.type))].map(t => { const v = rows.easy.filter(r => r.type === t).map(r => r[k]).filter(x => x != null); return [t, v.length ? +(v.filter(x => x < p5).length / v.length).toFixed(3) : null]; })), positive_p5: p5,
    P3_median_pos_above_decoy_p75: { median_pos: q(vals('fishshapes_pos', k), 0.5), decoy_p75: q(decoys, 0.75), pass: q(vals('fishshapes_pos', k), 0.5) > q(decoys, 0.75) },
    S1_auc_fishbase: auc(vals('fishbase_pos', k), vals('fishbase_decoy', k)),
    S2_auc_hard: auc([...vals('fishshapes_pos', k), ...vals('fishbase_pos', k)], vals('hard', k)),
    S4_ontogeny_above_decoy_median: vals('ontogeny', k).length ? vals('ontogeny', k).filter(v => v > q(decoys, 0.5)).length / vals('ontogeny', k).length : null,
    distinct_values: new Set(Object.values(rows).flat().map(r => r[k])).size, n: Object.values(rows).flat().length,
  };
}
const out = { version: '1.2.0', partition: 'dev only (heldout/ never read)', split: 'LOFO (family + species of every source specimen excluded)', n_per_group: N, seconds: Math.round((Date.now() - t0) / 1000),
  refused: Object.values(rows).flat().filter(r => r.refused).length, errors: Object.values(rows).flat().filter(r => r.error).map(r => ({ id: r.id, error: r.error })).slice(0, 20), report, rows };
fs.writeFileSync(path.join(DIR, 'dev-benchmark-v1.2.0.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ seconds: out.seconds, refused: out.refused, errors: out.errors.length, report }, null, 1));
