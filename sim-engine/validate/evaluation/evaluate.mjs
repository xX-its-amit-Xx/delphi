#!/usr/bin/env node
// INDEPENDENT EVALUATION of the design scorer (sim-engine/validate/score.mjs -> designScore) on the pre-registered
// benchmark (sim-engine/validate/benchmark/, BENCHMARK-PREREGISTRATION.md). Written by an evaluator that built neither.
// Nothing in score.mjs, phenotype.mjs or benchmark/ is edited from here; defects are reported, not patched.
//
//   node sim-engine/validate/evaluation/evaluate.mjs
//   env: EVAL_WORKERS (default 14)  EVAL_MAX_DEV (stratified cap per dev split; 0 = all)  EVAL_SKIP_STABILITY=1
//        EVAL_SKIP_ADVERSARIAL=1  EVAL_SKIP_DEV=1  EVAL_TAG (label for the run, e.g. weights-v1.0.0)
//
// Outputs: evaluation/results/<run-id>.json (slim) and latest.json; per-item rows gzipped to C:/Temp/delphi-eval/
// (D: is nearly full); dashboard/public/scorer/data.json (slim, for the page).
// Exit 2 if the exclusion audit catches the scorer returning a reference that should have been left out (a cheating
// scorer FAILS loudly); exit 3 if the audit's canary does not trip (blind audit); 0 otherwise, even when criteria fail.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import * as S from './stats.mjs';
import { loadBenchmark, SCORER_READS } from './benchmark-adapter.mjs';
import { buildIndex, taxonOfRef } from './reference-index.mjs';

const DIR = import.meta.dirname, VAL = path.resolve(DIR, '..'), ROOT = path.resolve(VAL, '..', '..');
const ROWS_DIR = process.env.EVAL_ROWS_DIR || 'C:/Temp/delphi-eval';
const NW = +(process.env.EVAL_WORKERS || 14);
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-') + (process.env.EVAL_TAG ? `_${process.env.EVAL_TAG}` : '');
const log = (...a) => console.error(`[eval ${new Date().toISOString().slice(11, 19)}]`, ...a);
const SC = await import('../score.mjs');
const PH = await import('../phenotype.mjs');
const THRESH = SC.SCORER.plausible_threshold;
const SPLITS = ['specimen', 'species', 'family'];
const norm = x => String(x ?? '').trim().toLowerCase().replace(/[_\s]+/g, ' ');

// ---------------------------------------------------------------- versions and hashes
const sha = f => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
function versions() {
  const W = JSON.parse(fs.readFileSync(path.join(VAL, 'score-weights.json'), 'utf8'));
  const B = path.join(VAL, 'benchmark');
  const files = ['BENCHMARK-PREREGISTRATION.md', 'manifest.json', 'splits/splits.json', 'dev/items.jsonl', 'heldout/items.jsonl', 'dev/own-models.jsonl', 'build/lean-controls.json'];
  return {
    run_id: RUN_ID, node: process.version, started: new Date().toISOString(),
    score_weights: { version: W.version, sha256: sha(path.join(VAL, 'score-weights.json')), weights: W.weights, plausible_threshold: W.plausible_threshold, alpha: W.alpha },
    scorer_version_reported: SC.SCORER.version,
    scorer_files: Object.fromEntries(['score.mjs', 'phenotype.mjs', 'sanity.mjs', 'genotype.mjs', 'lean-components.mjs', 'SCORER-PREREGISTRATION.md'].map(f => [f, sha(path.join(VAL, f))])),
    benchmark: { prereg_sha256: sha(path.join(B, 'BENCHMARK-PREREGISTRATION.md')), prereg_sha256_declared: fs.existsSync(path.join(B, 'PREREG.sha256')) ? fs.readFileSync(path.join(B, 'PREREG.sha256'), 'utf8').trim().split(/\s+/)[0] : null,
      manifest_sha256: sha(path.join(B, 'manifest.json')), files: Object.fromEntries(files.map(f => [f, sha(path.join(B, f))])) },
    evaluator_files: Object.fromEntries(['evaluate.mjs', 'stats.mjs', 'benchmark-adapter.mjs', 'reference-index.mjs', 'adversarial.mjs'].map(f => [f, sha(path.join(DIR, f))])),
  };
}

// ---------------------------------------------------------------- exclusion audit (evaluator's own taxon index)
const audit = { checked: 0, violations: [], unknown_taxon_nearest: 0 };
function auditItem(item, split, res, IDX) {
  for (const [block, n] of [['body', res.verdict?.closest_real_relative], ['fin', res.verdict?.closest_real_relative_fins]]) {
    if (!n || !n.id) continue;
    audit.checked++;
    const t = taxonOfRef(IDX, n.id);
    if (!t) { audit.unknown_taxon_nearest++; continue; }
    let bad = null;
    if ((item.self_ref_ids || []).includes(n.id)) bad = 'nearest reference IS the item\'s own specimen';
    else if (item.organism_group && t.organism_group === item.organism_group) bad = `nearest reference is the item's own repository lineage (${t.organism_group})`;
    else if (split !== 'specimen' && t.species && (item.audit_sets?.species || []).includes(norm(t.species).toLowerCase())) bad = `nearest reference is of an excluded species (${t.species})`;
    else if (split === 'family' && t.family && (item.audit_sets?.family || []).includes(t.family.toLowerCase())) bad = `nearest reference is of an excluded family (${t.family})`;
    if (bad) audit.violations.push({ item: item.id, split, block, nearest: n.id, distance: n.distance, problem: bad });
  }
}
// What the evaluator passes: the benchmark's own exclusion lists at the split's level (splits.json), translated to the
// scorer's leave-out vocabulary. Nothing else about the item is passed.
const exclusionsFor = (item, split) => item.bench_exclude?.[split] || [];

async function scoreItem(item, split, IDX) {
  const exclude = split ? exclusionsFor(item, split) : [];
  let res;
  try { res = await SC.designScore(item.design, { reference_set_excluding: exclude, network: false }); }
  catch (e) { return { ...rowBase(item, split), error: String(e.message || e).slice(0, 200) }; }
  if (split) auditItem(item, split, res, IDX);
  const C = res.components || {};
  const s = typeof res.score === 'number' && Number.isFinite(res.score) ? res.score : null;
  return { ...rowBase(item, split), score: s, ...(s == null ? { error: 'no score returned' } : {}),
    comp: Object.fromEntries(Object.entries(C).map(([k, c]) => [k, c?.ran ? S.r4(c.value) : null])), limiting: C.P?.limiting || null,
    nearest: res.verdict?.closest_real_relative ? { id: res.verdict.closest_real_relative.id, name: res.verdict.closest_real_relative.name, d: res.verdict.closest_real_relative.distance } : null,
    nearest_fin_d: res.verdict?.closest_real_relative_fins?.distance ?? null, failed_checks: res.verdict?.failed || [] };
}
const rowBase = (it, split) => ({ id: it.id, label: it.label, y: it.y, type: it.type, subset: it.subset, src: it.source_ds, split, partition: it.partition, family: it.taxon?.family || null, order: it.taxon?.order || null,
  readable: it.scorer_readable, altered_read: it.altered_traits_read_by_scorer, paired_baseline: it.paired_baseline });

// ---------------------------------------------------------------- parallel scoring (child processes)
async function scoreMany(items, split, IDX, { seed = null } = {}) {
  if (items.length < 100 || NW <= 1) { const rows = []; for (const it of items) rows.push(await scoreItem(it, split, IDX)); return rows; }
  const shards = Array.from({ length: Math.min(NW, Math.ceil(items.length / 50)) }, () => []);
  items.forEach((it, i) => shards[i % shards.length].push(it));
  const parts = await Promise.all(shards.map(sh => new Promise((res, rej) => {
    const cp = fork(import.meta.filename, [], { env: { ...process.env, EVAL_WORKER: '1' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'], serialization: 'advanced' });
    let done = false;
    cp.on('message', m => { done = true; res(m); cp.kill(); }); cp.on('error', rej);
    cp.on('exit', c => { if (!done) rej(new Error(`worker exited ${c} before replying`)); });
    cp.send({ items: sh, split, seed });
  })));
  for (const p of parts) { audit.checked += p.audit.checked; audit.unknown_taxon_nearest += p.audit.unknown_taxon_nearest; audit.violations.push(...p.audit.violations); }
  const byId = new Map(parts.flatMap(p => p.rows).map(r => [r.id, r]));
  return items.map(it => byId.get(it.id));
}
if (process.env.EVAL_WORKER) {
  process.on('message', async ({ items, split, seed }) => {
    if (seed != null) { PH.useSeed(seed); await PH.loadReferences({ fresh: true, seed }); } else await PH.loadReferences();
    const IDXw = await buildIndex(); const rows = [];
    for (const it of items) rows.push(await scoreItem(it, split, IDXw));
    process.send({ rows, audit });
  });
}

// ---------------------------------------------------------------- metrics
// Failures count as the worst case (prereg section 1): positives get the lowest observed score, negatives the highest.
function withWorstCase(rows) {
  const ok = rows.filter(r => r.score != null).map(r => r.score);
  const lo = Math.min(...ok), hi = Math.max(...ok);
  return rows.map(r => (r.score != null ? r : { ...r, score: r.y === 1 ? lo : hi, imputed_worst: true }));
}
const clusterOf = r => (r.family ? `fam:${r.family}` : `item:${r.id}`);
function aucBlock(pos, neg, B = 1000) {
  const rows = [...pos.map(r => ({ s: r.score, y: 1, c: clusterOf(r) })), ...neg.map(r => ({ s: r.score, y: 0, c: clusterOf(r) }))];
  const ps = pos.map(r => r.score), ns = neg.map(r => r.score);
  return { n_pos: ps.length, n_neg: ns.length, roc_auc: S.r4(S.rocAuc(ps, ns)), ci_family: S.clusterBootstrap(rows, S.rocAuc, { B, seed: 1 }), pr_auc: S.r4(S.prAuc(ps, ns)), pr_ci_family: S.clusterBootstrap(rows, S.prAuc, { B: Math.min(B, 300), seed: 2 }), pr_chance: S.r4(ps.length / (ps.length + ns.length)) };
}
function metricsFor(rows0, label) {
  const rows = withWorstCase(rows0);
  const pos = rows.filter(r => r.y === 1), neg = rows.filter(r => r.y === 0);
  const types = [...new Set(rows.map(r => r.type))].sort();
  const kPos = pos.filter(r => r.score >= THRESH).length, kNeg = neg.filter(r => r.score < THRESH).length;
  const errors = {}; for (const r of rows0) if (r.score == null) errors[r.type] = (errors[r.type] || 0) + 1;
  return {
    label, n: rows.length, ...aucBlock(pos, neg), errors_counted_worst_case: errors,
    real_above_threshold: { k: kPos, n: pos.length, frac: S.r4(kPos / pos.length), ...S.wilson(kPos, pos.length) },
    negatives_below_threshold: { k: kNeg, n: neg.length, frac: S.r4(kNeg / neg.length), ...S.wilson(kNeg, neg.length) },
    by_type: Object.fromEntries(types.map(t => { const g = rows.filter(r => r.type === t), sc = g.map(r => r.score), isPos = g[0].y === 1;
      return [t, { y: g[0].y, n: g.length, frac_correct_side: S.r4((isPos ? sc.filter(s => s >= THRESH) : sc.filter(s => s < THRESH)).length / g.length), auc_vs_all_real: isPos ? null : S.r4(S.rocAuc(pos.map(r => r.score), sc)),
        scorer_readable_frac: S.r4(g.filter(r => r.readable).length / g.length), dist: S.summary(sc), hist: S.histogram(sc) }]; })),
    calibration: S.calibration(rows.map(r => ({ score: r.score, y: r.y }))),
  };
}
function baselines(rows0) {
  const rows = withWorstCase(rows0), rnd = S.mulberry32(11);
  const defs = { scorer: r => r.score, nn_distance_only: r => (r.nearest?.d != null ? -r.nearest.d : r.nearest_fin_d != null ? -r.nearest_fin_d : -1e9), P_only: r => r.comp?.P ?? 0, lean_only: r => r.comp?.L ?? 1, random: () => rnd() };
  const vals = Object.fromEntries(Object.entries(defs).map(([k, f]) => [k, rows.map(r => ({ s: f(r), y: r.y, c: clusterOf(r) }))]));
  const out = {};
  for (const [k, v] of Object.entries(vals)) out[k] = { roc_auc: S.r4(S.rocAuc(v.filter(x => x.y).map(x => x.s), v.filter(x => !x.y).map(x => x.s))), ci_family: S.clusterBootstrap(v, S.rocAuc, { B: 300, seed: 1 }) };
  // paired family bootstrap of (scorer AUC - baseline AUC)
  const groups = new Map(); rows.forEach((r, i) => { const c = clusterOf(r); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  const keys = [...groups.keys()];
  for (const k of Object.keys(defs).filter(k => k !== 'scorer')) {
    const r2 = S.mulberry32(5), diffs = [];
    for (let b = 0; b < 300; b++) {
      const idx = []; for (let i = 0; i < keys.length; i++) idx.push(...groups.get(keys[Math.floor(r2() * keys.length)]));
      const a = (key) => S.rocAuc(idx.filter(i => rows[i].y === 1).map(i => vals[key][i].s), idx.filter(i => rows[i].y === 0).map(i => vals[key][i].s));
      diffs.push(a('scorer') - a(k));
    }
    out[k].scorer_minus_baseline = { mean: S.r4(S.mean(diffs)), lo: S.r4(S.quantile(diffs, 0.025)), hi: S.r4(S.quantile(diffs, 0.975)), p_scorer_better: S.r4(diffs.filter(d => d > 0).length / diffs.length) };
  }
  return out;
}
function perTaxon(rows0) {
  const rows = withWorstCase(rows0), pos = rows.filter(r => r.y === 1 && r.family);
  const fam = {}; for (const r of pos) (fam[r.family] ||= []).push(r);
  const table = Object.entries(fam).map(([f, rs]) => ({ family: f, order: rs[0].order, n: rs.length, mean: S.r4(S.mean(rs.map(r => r.score))), frac_above: S.r4(rs.filter(r => r.score >= THRESH).length / rs.length),
    worst: [...rs].sort((a, b) => a.score - b.score).slice(0, 2).map(r => ({ id: r.id, score: S.r4(r.score), limiting: r.limiting, comp: r.comp, nearest: r.nearest?.name, d: r.nearest?.d, failed_checks: r.failed_checks })) }));
  table.sort((a, b) => a.frac_above - b.frac_above || a.mean - b.mean);
  const neg = rows.filter(r => r.y === 0);
  const ordAuc = {}; for (const r of pos) (ordAuc[r.order || 'NA'] ||= []).push(r);
  return { n_families: table.length, n_low_families: table.filter(t => t.frac_above < 0.8 && t.n >= 3).length, low_families: table.filter(t => t.n >= 3).slice(0, 25), all: table.map(({ worst, ...t }) => t),
    by_order: Object.entries(ordAuc).filter(([, rs]) => rs.length >= 30).map(([o, rs]) => ({ order: o, n: rs.length, frac_above: S.r4(rs.filter(r => r.score >= THRESH).length / rs.length), auc_vs_all_negatives: S.r4(S.rocAuc(rs.map(r => r.score), neg.map(r => r.score))) })).sort((a, b) => a.auc_vs_all_negatives - b.auc_vs_all_negatives),
    lowest_real_items: [...pos].sort((a, b) => a.score - b.score).slice(0, 15).map(r => ({ id: r.id, type: r.type, family: r.family, score: S.r4(r.score), comp: r.comp, limiting: r.limiting, nearest: r.nearest, failed_checks: r.failed_checks, readable: r.readable })) };
}
function recompose(comp, w, floor = SC.SCORER.floor) { let s = 0, t = 0; for (const [k, v] of Object.entries(comp || {})) if (v != null && w[k] != null) { s += w[k] * Math.log(Math.max(v, floor)); t += w[k]; } return t ? Math.exp(s / t) : null; }
function weightPerturbation(rows0) {
  const rows = rows0.filter(r => r.score != null), w0 = { ...SC.SCORER.weights };
  const evalW = w => { const v = rows.map(r => ({ y: r.y, s: recompose(r.comp, w) })); const p = v.filter(x => x.y === 1).map(x => x.s), n = v.filter(x => x.y === 0).map(x => x.s);
    return { roc_auc: S.r4(S.rocAuc(p, n)), real_above: S.r4(p.filter(s => s >= THRESH).length / p.length), neg_below: S.r4(n.filter(s => s < THRESH).length / n.length) }; };
  const maxDev = Math.max(...rows.map(r => Math.abs(recompose(r.comp, w0) - r.score)));
  const one = []; for (const k of Object.keys(w0)) for (const f of [0.8, 1.2]) one.push({ weight: k, factor: f, ...evalW({ ...w0, [k]: w0[k] * f }) });
  const rnd = S.mulberry32(20261101), joint = []; for (let i = 0; i < 200; i++) joint.push(evalW(Object.fromEntries(Object.entries(w0).map(([k, v]) => [k, v * (0.8 + 0.4 * rnd())]))));
  const rng = k => ({ min: S.r4(Math.min(...joint.map(j => j[k]))), max: S.r4(Math.max(...joint.map(j => j[k]))) });
  return { recompose_max_abs_deviation: S.r4(maxDev), base: evalW(w0), one_at_a_time: one, joint_random_pm20: { n: joint.length, roc_auc: rng('roc_auc'), real_above: rng('real_above'), neg_below: rng('neg_below') } };
}
function fullBlock(rows, label) { return { metrics: metricsFor(rows, label), baselines: baselines(rows), per_taxon: perTaxon(rows), weight_perturbation: weightPerturbation(rows),
  readable_only: (() => { const r = rows.filter(x => x.readable && (x.y === 1 || x.altered_read == null || x.altered_read > 0)); return { what: 'positives the scorer can read (>= 4 body features or a pectoral length) vs negatives whose altered traits include at least one the scorer reads', ...aucBlock(withWorstCase(r).filter(x => x.y === 1), withWorstCase(r).filter(x => x.y === 0), 300) }; })() }; }

// ---------------------------------------------------------------- pre-registered endpoints (BENCHMARK-PREREGISTRATION.md sections 2-4)
function endpoints(R, extra) {
  const H = withWorstCase(R.heldout.family), HS = withWorstCase(R.heldout.specimen);
  const pick = (rows, f) => rows.filter(f);
  const fsPos = r => r.subset === 'fishshapes_specimen', fsStd = r => (r.subset === 'decoy_shuffle_all' || r.subset === 'decoy_shuffle_shape') && r.src === 'fishshapes';
  const p1 = aucBlock(pick(H, fsPos), pick(H, fsStd));
  const p1loso = aucBlock(pick(HS, fsPos), pick(HS, fsStd), 300);
  const allPosH = H.filter(r => r.y === 1).map(r => r.score), q05 = S.quantile(allPosH, 0.05);
  const easyT = ['out_of_range_extrapolation', 'law_breaker', 'impossible_combo', 'organ_containment'];
  const easy = H.filter(r => easyT.includes(r.subset));
  const easyBy = Object.fromEntries(easyT.map(t => { const g = easy.filter(r => r.subset === t); return [t, { n: g.length, below: g.filter(r => r.score < q05).length, frac: S.r4(g.filter(r => r.score < q05).length / (g.length || 1)) }]; }));
  const p2frac = easy.filter(r => r.score < q05).length / easy.length;
  const stdAll = H.filter(r => r.subset === 'decoy_shuffle_all' || r.subset === 'decoy_shuffle_shape').map(r => r.score);
  const medPos = S.quantile(pick(H, fsPos).map(r => r.score), 0.5), q75d = S.quantile(stdAll, 0.75);
  const s1 = aucBlock(pick(H, r => r.subset === 'fishbase_picture'), pick(H, r => (r.subset === 'decoy_shuffle_all' || r.subset === 'decoy_shuffle_shape') && r.src === 'fishbase'), 300);
  const hardRows = pick(H, r => r.subset === 'decoy_shuffle_one' || r.subset === 'chimera_extreme_corner');
  const s2 = aucBlock(pick(H, r => r.y === 1 && (r.subset === 'fishshapes_specimen' || r.subset === 'fishbase_picture')), hardRows, 300);
  const s2bySrc = Object.fromEntries(['fishshapes', 'fishbase'].map(src => [src, aucBlock(pick(H, r => r.y === 1 && r.src === src), hardRows.filter(r => r.src === src), 300)]));
  const s3gap = p1loso.roc_auc - p1.roc_auc;
  // S4-S6 use every partition (dev + held-out), family-out
  const ALL = withWorstCase([...R.dev.family || [], ...R.heldout.family]);
  const stdMedAll = S.quantile(H.filter(r => r.subset === 'decoy_shuffle_all' || r.subset === 'decoy_shuffle_shape').map(r => r.score), 0.5);
  const ont = ALL.filter(r => r.subset === 'ontogeny_stage');
  const fsP25 = S.quantile(ALL.filter(r => r.subset === 'fishshapes_specimen').map(r => r.score), 0.25);
  const s5 = ALL.filter(r => r.subset === 'specimen_with_fins' || r.subset === 'specimen_mass_length');
  const lbs = ALL.filter(r => r.subset === 'law_breaker').map(r => r.score), ctrl = extra.controls;
  const crit = [
    { id: 'P1', primary: true, text: 'held-out LOFO: FishShapes positives vs FishShapes standard decoys: AUC >= 0.75 and family-bootstrap lower 95 % bound > 0.50', value: { auc: p1.roc_auc, ci: [p1.ci_family.lo, p1.ci_family.hi], n_pos: p1.n_pos, n_neg: p1.n_neg }, pass: p1.roc_auc >= 0.75 && p1.ci_family.lo > 0.5 },
    { id: 'P2', primary: true, text: 'held-out LOFO: >= 90 % of easy negatives (pooled) score below the 5th percentile of all held-out positive scores', value: { frac: S.r4(p2frac), n: easy.length, p05_of_positives: S.r4(q05), by_type: easyBy }, pass: p2frac >= 0.9 },
    { id: 'P3', primary: true, text: 'held-out LOFO: median FishShapes positive score > 75th percentile of standard decoys (both sources)', value: { median_positive: S.r4(medPos), p75_decoys: S.r4(q75d) }, pass: medPos > q75d },
    { id: 'S1', primary: false, text: 'held-out LOFO: FishBase positives vs FishBase standard decoys AUC >= 0.70', value: { auc: s1.roc_auc, ci: [s1.ci_family.lo, s1.ci_family.hi], n_pos: s1.n_pos, n_neg: s1.n_neg }, pass: s1.roc_auc >= 0.7 },
    { id: 'S2', primary: false, text: 'held-out LOFO: hard negatives (shuffle_one, extreme corner) vs same-source positives AUC >= 0.60', value: { auc_pooled: s2.roc_auc, fishshapes: s2bySrc.fishshapes.roc_auc, fishbase: s2bySrc.fishbase.roc_auc }, pass: s2bySrc.fishshapes.roc_auc >= 0.6 && s2bySrc.fishbase.roc_auc >= 0.6 },
    { id: 'S3', primary: false, text: 'memorisation: P1 AUC under LOSO minus under LOFO <= 0.10', value: { loso: p1loso.roc_auc, lofo: p1.roc_auc, gap: S.r4(s3gap) }, pass: s3gap <= 0.1 },
    { id: 'S4', primary: false, text: '>= 75 % of the 12 ontogeny stages score above the median of the standard decoys', value: { k: ont.filter(r => r.score > stdMedAll).length, n: ont.length, decoy_median: S.r4(stdMedAll), scores: ont.map(r => [r.id, S.r4(r.score)]) }, pass: ont.length && ont.filter(r => r.score > stdMedAll).length / ont.length >= 0.75 },
    { id: 'S5', primary: false, text: 'each Park & Choi / Makiguchi specimen scores above the 25th percentile of FishShapes positives', value: { p25_fishshapes: S.r4(fsP25), below: s5.filter(r => r.score <= fsP25).map(r => [r.id, S.r4(r.score)]), n: s5.length }, pass: s5.length > 0 && s5.every(r => r.score > fsP25) },
    { id: 'S6', primary: false, text: 'Lean controls (real Park & Choi specimens, realistic claims) are not ranked below any law-breaker', value: { controls: ctrl.map(c => [c.id, S.r4(c.score)]), max_law_breaker: S.r4(Math.max(...lbs)), note: 'the scorer has no input for flight claims, so a control is scored on the same params as its specimen' }, pass: ctrl.length > 0 && ctrl.every(c => c.score >= Math.max(...lbs)) },
  ];
  const mut = ALL.filter(r => /^mutant_(quantified|qualitative)$/.test(r.subset)).map(r => { const b = ALL.find(x => x.id === r.paired_baseline); return { id: r.id, score: S.r4(r.score), baseline: r.paired_baseline, baseline_score: b ? S.r4(b.score) : null, diff: b ? S.r4(r.score - b.score) : null }; });
  const pctl = (arr, v) => S.r4(arr.filter(x => x < v).length / arr.length);
  const own = (extra.own || []).map(r => ({ id: r.id, score: S.r4(r.score), pct_among_heldout_positives: pctl(allPosH, r.score), pct_among_standard_decoys: pctl(stdAll, r.score), limiting: r.limiting, error: r.error }));
  return { criteria: crit, overall_primary_pass: crit.filter(c => c.primary).every(c => c.pass), exploratory: { mutants_minus_paired_baseline: mut, own_models: own,
    feature_subsets: 'For FishShapes-derived items the scorer reads exactly the shared subset (SL, mass, depth, width, peduncle depth and width) and nothing else, so restricting items to it changes no score. For FishBase items the shared subset is body depth alone, below the scorer\'s 4-feature minimum for the body block.' } };
}

// ---------------------------------------------------------------- main
if (!process.env.EVAL_WORKER) await main();
async function main() {
  const t0 = Date.now();
  const V = versions();
  if (V.benchmark.prereg_sha256 !== V.benchmark.prereg_sha256_declared) log('WARNING: benchmark prereg sha256 does not match PREREG.sha256');
  log('versions', JSON.stringify({ weights: V.score_weights.version, score_mjs: V.scorer_files['score.mjs'].slice(0, 12), prereg: V.benchmark.prereg_sha256?.slice(0, 12), manifest: V.benchmark.manifest_sha256?.slice(0, 12) }));
  await PH.loadReferences();
  const IDX = await buildIndex();
  const BM = await loadBenchmark();
  log(BM.notes.join(' | '));

  // Canary: scoring a FishShapes positive WITHOUT its exclusions must trip the audit (nearest = itself).
  const c = BM.heldoutLabelled.find(i => i.subset === 'fishshapes_specimen' && i.self_ref_ids.length);
  const resC = await SC.designScore(c.design, { reference_set_excluding: [], network: false });
  const before = audit.violations.length; auditItem(c, 'family', resC, IDX);
  const canary = { item: c.id, nearest_without_exclusion: resC.verdict?.closest_real_relative?.id, distance: resC.verdict?.closest_real_relative?.distance, audit_tripped: audit.violations.length > before };
  audit.violations.length = 0; audit.checked = 0;
  if (!canary.audit_tripped) { console.error('CANARY FAILED: the exclusion audit did not catch an unexcluded run; aborting.'); process.exit(3); }
  log('canary ok:', JSON.stringify(canary));

  const R = { heldout: {}, dev: {} };
  for (const split of SPLITS) { log(`held-out ${split}-out: ${BM.heldoutLabelled.length} items`); R.heldout[split] = await scoreMany(BM.heldoutLabelled, split, IDX); }
  if (!process.env.EVAL_SKIP_DEV) {
    const cap = +(process.env.EVAL_MAX_DEV || 0);
    let dev = BM.devLabelled;
    if (cap && dev.length > cap) { const rnd = S.mulberry32(31337), byT = {}; for (const i of dev) (byT[i.subset] ||= []).push(i); dev = [];
      for (const xs of Object.values(byT)) { const k = xs.length <= 60 ? xs.length : Math.max(60, Math.round(cap * xs.length / BM.devLabelled.length)); const a = [...xs].sort(() => rnd() - 0.5); dev.push(...a.slice(0, k)); } }
    for (const split of SPLITS) { log(`dev ${split}-out: ${dev.length} items`); R.dev[split] = await scoreMany(dev, split, IDX); }
    R.dev_note = cap ? `dev is a stratified sample of ${dev.length} of ${BM.devLabelled.length} labelled items (EVAL_MAX_DEV=${cap}); every type with <= 60 items kept whole` : `all ${dev.length} dev labelled items`;
  }
  const own = await scoreMany(BM.unlabelled, 'family', IDX);
  // S6 controls: the real Park & Choi specimens (their params; the scorer cannot read flight claims)
  const allFam = [...(R.dev.family || []), ...R.heldout.family];
  const controls = BM.controls.map(cn => { const pid = cn.id.replace(/^control-/, ''); const r = allFam.find(x => x.id === pid); return { id: cn.id, specimen_item: pid, score: r?.score ?? null }; });

  const results = { versions: V, benchmark_source: BM.source, benchmark_notes: BM.notes, dev_note: R.dev_note, threshold: THRESH, canary,
    genus_split: 'NOT RUN: the scorer\'s leave-out options have no genus key (phenotype.mjs excludeMatcher accepts ids, species, family, order, organism groups). splits.json: report NOT RUN rather than substitute.',
    heldout: Object.fromEntries(SPLITS.map(s => [s, fullBlock(R.heldout[s], `held-out ${s}-out`)])),
    dev: Object.fromEntries(Object.entries(R.dev).filter(([k]) => SPLITS.includes(k)).map(([s, rows]) => [s, fullBlock(rows, `dev ${s}-out`)])) };
  const E = endpoints(R, { controls, own });
  results.criteria = E.criteria; results.overall_primary_pass = E.overall_primary_pass; results.exploratory = E.exploratory;
  results.exclusion_audit = { checked: audit.checked, unknown_taxon_nearest: audit.unknown_taxon_nearest, n_violations: audit.violations.length, pass: audit.violations.length === 0, violations: audit.violations.slice(0, 50) };

  if (!process.env.EVAL_SKIP_STABILITY) {
    const rnd = S.mulberry32(99), byT = {}; for (const i of BM.heldoutLabelled) (byT[i.subset] ||= []).push(i);
    const sub = []; for (const xs of Object.values(byT)) sub.push(...[...xs].sort(() => rnd() - 0.5).slice(0, Math.max(20, Math.round(xs.length * 0.08))));
    const runs = [];
    for (const s of [20261101, 11, 22, 33, 44]) {
      const rows = withWorstCase(await scoreMany(sub, 'family', IDX, { seed: s }));
      const p1 = S.rocAuc(rows.filter(r => r.subset === 'fishshapes_specimen').map(r => r.score), rows.filter(r => (r.subset === 'decoy_shuffle_all' || r.subset === 'decoy_shuffle_shape') && r.src === 'fishshapes').map(r => r.score));
      runs.push({ seed: s, n: rows.length, roc_auc_all: S.r4(S.rocAuc(rows.filter(r => r.y === 1).map(r => r.score), rows.filter(r => r.y === 0).map(r => r.score))), p1_auc: S.r4(p1), real_above: S.r4(rows.filter(r => r.y === 1 && r.score >= THRESH).length / rows.filter(r => r.y === 1).length) });
      log(`stability seed ${s}:`, JSON.stringify(runs.at(-1)));
    }
    const a = runs.map(r => r.p1_auc);
    results.stability = { what: `a fixed stratified ${sub.length}-item sample of held-out items (LOFO) rescored under 5 seeds of the scorer's species split (phenotype.useSeed: changes its calibration and train pool)`, runs, p1_auc_range: S.r4(Math.max(...a) - Math.min(...a)) };
  }
  if (!process.env.EVAL_SKIP_ADVERSARIAL) results.adversarial = await (await import('./adversarial.mjs')).run({ designScore: SC.designScore, quick: false, log });
  results.seconds = Math.round((Date.now() - t0) / 1000);

  // ---- outputs
  fs.mkdirSync(ROWS_DIR, { recursive: true });
  const allRows = { heldout: R.heldout, dev: R.dev, own };
  fs.writeFileSync(path.join(ROWS_DIR, `${RUN_ID}.rows.json.gz`), zlib.gzipSync(JSON.stringify(allRows)));
  const outDir = path.join(DIR, 'results'); fs.mkdirSync(outDir, { recursive: true });
  const slim = JSON.stringify({ ...results, rows_file: path.join(ROWS_DIR, `${RUN_ID}.rows.json.gz`).replace(/\\/g, '/') }, null, 1);
  fs.writeFileSync(path.join(outDir, `${RUN_ID}.json`), slim); fs.writeFileSync(path.join(outDir, 'latest.json'), slim);
  const pub = path.join(ROOT, 'dashboard', 'public', 'scorer'); fs.mkdirSync(pub, { recursive: true });
  const hist = (() => { try { return JSON.parse(fs.readFileSync(path.join(pub, 'data.json'), 'utf8')).history || []; } catch { return []; } })().filter(h => h.run_id !== RUN_ID);
  const head = { run_id: RUN_ID, weights: V.score_weights.version, score_mjs: V.scorer_files['score.mjs'].slice(0, 12), prereg: V.benchmark.prereg_sha256?.slice(0, 12), p1: results.criteria[0].value.auc, primary_pass: results.overall_primary_pass, real_above_heldout_lofo: results.heldout.family.metrics.real_above_threshold.frac };
  fs.writeFileSync(path.join(pub, 'data.json'), JSON.stringify({ ...results, history: [...hist, head].slice(-10) }));
  // one file per scorer version, plus an index for the side-by-side table (latest run per version wins)
  const vtag = `w${V.score_weights.version}`;
  fs.writeFileSync(path.join(pub, `data-${vtag}.json`), JSON.stringify(results));
  const idxF = path.join(pub, 'versions.json');
  let vidx = []; try { vidx = JSON.parse(fs.readFileSync(idxF, 'utf8')); } catch {}
  const HL = results.heldout.family.metrics;
  vidx = vidx.filter(x => x.version !== V.score_weights.version);
  vidx.push({ version: V.score_weights.version, file: `data-${vtag}.json`, run_id: RUN_ID, score_mjs: V.scorer_files['score.mjs'].slice(0, 12), weights_sha: V.score_weights.sha256.slice(0, 12), prereg: V.benchmark.prereg_sha256?.slice(0, 12),
    overall_primary_pass: results.overall_primary_pass, criteria: results.criteria.map(c => ({ id: c.id, primary: c.primary, pass: !!c.pass, value: c.value.auc ?? c.value.frac ?? c.value.gap ?? c.value.median_positive ?? c.value.auc_pooled ?? null })),
    heldout_lofo: { auc: HL.roc_auc, ci: [HL.ci_family.lo, HL.ci_family.hi], real_above: HL.real_above_threshold.frac, neg_below: HL.negatives_below_threshold.frac, readable_auc: results.heldout.family.readable_only.roc_auc },
    adversarial: results.adversarial?.headline || null, audit_pass: results.exclusion_audit.pass });
  vidx.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  fs.writeFileSync(idxF, JSON.stringify(vidx, null, 1));

  console.log(JSON.stringify({ run: RUN_ID, weights: V.score_weights.version, score_mjs: V.scorer_files['score.mjs'].slice(0, 12), prereg: V.benchmark.prereg_sha256, manifest: V.benchmark.manifest_sha256,
    heldout: Object.fromEntries(SPLITS.map(s => { const m = results.heldout[s].metrics; return [s, { auc: m.roc_auc, ci: [m.ci_family.lo, m.ci_family.hi], pr: m.pr_auc, real_above: m.real_above_threshold.frac, neg_below: m.negatives_below_threshold.frac }]; })),
    criteria: results.criteria.map(c => `${c.id}:${c.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(c.value).slice(0, 160)}`), overall_primary_pass: results.overall_primary_pass,
    audit: { pass: results.exclusion_audit.pass, n: results.exclusion_audit.n_violations, checked: audit.checked }, adversarial: results.adversarial?.headline, seconds: results.seconds }, null, 1));
  if (!results.exclusion_audit.pass) { console.error(`EXCLUSION AUDIT FAILED: ${audit.violations.length} scored item(s) got a reference that should have been left out. First: ${JSON.stringify(audit.violations[0])}`); process.exit(2); }
}
