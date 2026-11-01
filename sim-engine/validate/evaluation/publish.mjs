#!/usr/bin/env node
// Publishes one evaluation result to dashboard/public/scorer/: data-w<version>.json, the side-by-side versions.json
// (latest run per scorer version wins) and, unless {latest:false}, data.json.
//   node sim-engine/validate/evaluation/publish.mjs <results.json> [--no-latest]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const PUB = path.join(ROOT, 'dashboard', 'public', 'scorer');

export function publish(results, { latest = true } = {}) {
  fs.mkdirSync(PUB, { recursive: true });
  const V = results.versions, ver = V.score_weights.version;
  const { rows_file, ...pub } = results;
  fs.writeFileSync(path.join(PUB, `data-w${ver}.json`), JSON.stringify(pub));
  if (latest) fs.writeFileSync(path.join(PUB, 'data.json'), JSON.stringify(pub));
  const idxF = path.join(PUB, 'versions.json');
  let idx = []; try { idx = JSON.parse(fs.readFileSync(idxF, 'utf8')); } catch {}
  const HL = results.heldout.family.metrics, BL = results.heldout.family.baselines;
  const crit = cs => cs.map(c => ({ id: c.id, primary: c.primary, pass: !!c.pass, value: c.value.auc ?? c.value.frac ?? c.value.gap ?? c.value.median_positive ?? c.value.fishshapes ?? null }));
  idx = idx.filter(x => x.version !== ver);
  idx.push({ version: ver, file: `data-w${ver}.json`, run_id: V.run_id, score_mjs: V.scorer_files['score.mjs']?.slice(0, 12), weights_sha: V.score_weights.sha256?.slice(0, 12), prereg: V.benchmark.prereg_sha256?.slice(0, 12),
    overall_primary_pass: results.overall_primary_pass, criteria: crit(results.criteria),
    rank: results.rank ? { overall_primary_pass: results.rank.overall_primary_pass, criteria: crit(results.rank.criteria), auc: results.rank.heldout_family.metrics.roc_auc, ci: [results.rank.heldout_family.metrics.ci_family.lo, results.rank.heldout_family.metrics.ci_family.hi], nn_auc: results.rank.heldout_family.baselines.nn_distance_only.roc_auc, minus_nn: results.rank.heldout_family.baselines.nn_distance_only.scorer_minus_baseline } : null,
    heldout_lofo: { auc: HL.roc_auc, ci: [HL.ci_family.lo, HL.ci_family.hi], real_above: HL.real_above_threshold.frac, neg_below: HL.negatives_below_threshold.frac, readable_auc: results.heldout.family.readable_only.roc_auc,
      nn_auc: BL.nn_distance_only.roc_auc, minus_nn: BL.nn_distance_only.scorer_minus_baseline, errors: HL.errors_counted_worst_case },
    adversarial: results.adversarial?.headline || null, audit_pass: results.exclusion_audit.pass, audit_checked: results.exclusion_audit.checked });
  idx.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  fs.writeFileSync(idxF, JSON.stringify(idx, null, 1));
  return idx;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const idx = publish(r, { latest: !process.argv.includes('--no-latest') });
  console.log(idx.map(x => `${x.version} ${x.run_id} P1 ${x.criteria[0].value}`).join('\n'));
}
