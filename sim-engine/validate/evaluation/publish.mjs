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
  const V = results.versions, ver = V.label ? V.label.replace(/ \((\w+) input\)$/, '-$1-input') : V.score_weights.version;
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
    rank: results.rank ? { overall_primary_pass: results.rank.overall_primary_pass, criteria: crit(results.rank.criteria), auc: results.rank.heldout_family.metrics.roc_auc, ci: [results.rank.heldout_family.metrics.ci_family.lo, results.rank.heldout_family.metrics.ci_family.hi], nn_auc: results.rank.heldout_family.baselines.nn_distance_only.roc_auc, minus_nn: results.rank.heldout_family.baselines.nn_distance_only.scorer_minus_baseline, minus_joint: results.rank.heldout_family.baselines.joint_term_only?.scorer_minus_baseline ?? null } : null,
    heldout_lofo: { auc: HL.roc_auc, ci: [HL.ci_family.lo, HL.ci_family.hi], real_above: HL.real_above_threshold.frac, neg_below: HL.negatives_below_threshold.frac, readable_auc: results.heldout.family.readable_only.roc_auc,
      nn_auc: BL.nn_distance_only.roc_auc, minus_nn: BL.nn_distance_only.scorer_minus_baseline, joint_auc: BL.joint_term_only?.roc_auc ?? null, minus_joint: BL.joint_term_only?.scorer_minus_baseline ?? null, errors: HL.errors_counted_worst_case },
    p1: { auc: results.criteria[0].value.auc, nn_auc: results.criteria[0].value.nn_auc, minus_nn: results.criteria[0].value.minus_nn, joint_auc: results.criteria[0].value.joint_auc ?? null, minus_joint: results.criteria[0].value.minus_joint ?? null, rank_auc: results.rank?.criteria[0].value.auc ?? null, rank_minus_nn: results.rank?.criteria[0].value.minus_nn ?? null, rank_minus_joint: results.rank?.criteria[0].value.minus_joint ?? null }, design_input: V.design_input || '{specimen} mapped from params (the fields v1.0.0/v1.1.0 read) or the doc',
    joint_only: results.joint_only ? { overall_primary_pass: results.joint_only.overall_primary_pass, criteria: crit(results.joint_only.criteria) } : null,
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
