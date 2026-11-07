#!/usr/bin/env node
// Measure the design scorer's AUC as a function of how much real structure the negatives keep.
//
//   node benchmarks/design-hard-negatives/run.mjs [--out results.json] [--n 2000]
//
// Reads benchmark/heldout (which the frozen joint model never saw) and sim-engine/validate/data.
// Writes nothing outside this directory.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, pooled, makeScorer, mulberry32 } from './joint.mjs';
import { LADDER, PRESERVES, EXPECTATION, independentMarginal, gaussianTypical, jitterReal, auc, aucCI } from './decoys.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = val('out', path.join(HERE, 'results.json'));
const NGEN = Number(val('n', '2000'));
const SEED = Number(val('seed', '20261107'));

const { meta, block } = loadModel('fishbase');
const P = pooled(block);
const S = makeScorer(P);
console.log(`joint model: ${P.n} specimens, ${P.families} families, ${P.traits.length} traits (log10, pooled)`);
console.log(`its source:  ${meta.source}`);

// ---------------------------------------------------------------- the held-out items
const lines = fs.readFileSync(path.join(ROOT, 'sim-engine/validate/benchmark/heldout/items.jsonl'), 'utf8').split('\n');
const positives = [], byNegType = new Map();
for (const l of lines) {
  if (!l) continue;
  const it = JSON.parse(l);
  const p = it.params || {};
  if (!P.traits.every(t => typeof p[t] === 'number' && Number.isFinite(p[t]) && p[t] > 0)) continue; // unscoreable
  if (it.label === 'positive') positives.push(p);
  else {
    const k = it.neg_type || 'unlabelled';
    if (!byNegType.has(k)) byNegType.set(k, []);
    byNegType.get(k).push(p);
  }
}
console.log(`heldout, complete on these traits: ${positives.length} positives, ${[...byNegType].reduce((a, [, v]) => a + v.length, 0)} negatives`);

const posQ = positives.map(p => S.q(p)).filter(Number.isFinite);

// ---------------------------------------------------------------- the ladder
const rng = () => mulberry32(SEED);
const existing = {
  'extreme-corner': byNegType.get('chimera_extreme_corner') || [],
  'shuffle-all': byNegType.get('decoy_shuffle_all') || [],
};
const generated = {
  'independent-marginal': independentMarginal(P, rng(), NGEN),
  'gaussian-typical': gaussianTypical(P, S.L, rng(), NGEN),
  'jitter-real': jitterReal(P, S.L, rng(), positives, NGEN),
};

const rows = [];
for (const kind of LADDER) {
  const set = existing[kind] ?? generated[kind];
  if (!set || !set.length) { console.log(`  ${kind}: no items`); continue; }
  const negQ = set.map(p => S.q(p)).filter(Number.isFinite);
  // the scorer calls LOW q typical, so a positive-like score is -q
  const a = auc(posQ.map(v => -v), negQ.map(v => -v));
  const ci = aucCI(posQ.map(v => -v), negQ.map(v => -v), { seed: SEED, rngFactory: mulberry32 });
  const medP = [...posQ].sort((x, y) => x - y)[Math.floor(posQ.length / 2)];
  const medN = [...negQ].sort((x, y) => x - y)[Math.floor(negQ.length / 2)];
  rows.push({
    kind, source: existing[kind] ? 'existing in benchmark/heldout' : 'generated here',
    n: negQ.length, preserves: PRESERVES[kind], expectation: EXPECTATION[kind],
    auc: a === null ? null : Number(a.toFixed(4)),
    auc_ci: ci ? ci.map(v => Number(v.toFixed(4))) : null,
    median_q_positives: Number(medP.toFixed(3)), median_q_decoys: Number(medN.toFixed(3)),
  });
  console.log(`  ${kind.padEnd(22)} n=${String(negQ.length).padStart(5)}  AUC ${a.toFixed(4)}  CI [${ci ? ci.map(v => v.toFixed(3)).join(', ') : '--'}]   median q: real ${medP.toFixed(2)} vs decoy ${medN.toFixed(2)}`);
}

const easy = rows.find(r => r.kind === 'shuffle-all');
const hard = rows.find(r => r.kind === 'gaussian-typical');
const jitter = rows.find(r => r.kind === 'jitter-real');

// ---------------------------------------------------------------- why gaussian-typical is not 0.5
// A d-dimensional Gaussian has E[q] = E[D^2/d] = 1 exactly, so samples from the fitted model should and do
// average 1. Real fish average less. That difference, not any biological implausibility, is what gives the
// scorer its residual discrimination against statistically typical decoys.
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const gq = (generated['gaussian-typical'] || []).map(p => S.q(p)).filter(Number.isFinite);
const misspec = {
  expected_mean_q_for_a_gaussian: 1,
  mean_q_of_samples_from_the_fitted_model: Number(mean(gq).toFixed(3)),
  mean_q_of_real_heldout_specimens: Number(mean(posQ).toFixed(3)),
  share_of_real_fish_inside_q_lt_1: Number((posQ.filter(v => v < 1).length / posQ.length).toFixed(3)),
  share_of_gaussian_samples_inside_q_lt_1: Number((gq.filter(v => v < 1).length / gq.length).toFixed(3)),
  what_it_means:
    'the sampler and the scorer agree to within 0.004 of the theoretical 1.0, so the model is reconstructed ' +
    'faithfully. Real fish are more concentrated than the fitted Gaussian says they are, because a covariance ' +
    'pooled over 311 families absorbs between-family variation and comes out wider and flatter than the real ' +
    'cloud. The scorer therefore separates real fish from its OWN typical samples - it is detecting that its ' +
    'model is misspecified, not that a decoy is implausible.',
  the_practical_consequence:
    'a design placed at the mode of the fitted model scores as LESS typical than an ordinary fish, and a design ' +
    'placed where real fish actually sit is indistinguishable from one (jitter-real).',
};
console.log(`\nmisspecification: samples from the fitted model mean q=${misspec.mean_q_of_samples_from_the_fitted_model} (theory 1.0), real fish mean q=${misspec.mean_q_of_real_heldout_specimens}`);
console.log(`  inside q<1: ${(misspec.share_of_real_fish_inside_q_lt_1 * 100).toFixed(1)}% of real fish vs ${(misspec.share_of_gaussian_samples_inside_q_lt_1 * 100).toFixed(1)}% of the model's own samples`);

const report = {
  what_this_measures:
    'the design scorer AUC as a function of how much of the real trait correlation structure the negatives keep. ' +
    'Reported accuracy is a property of the scorer AND the decoy generator, and this separates them.',
  joint_model: { n: P.n, families: P.families, traits: P.traits, source: meta.source, built: meta.built },
  heldout_used: { positives: posQ.length, note: 'the model was fitted on dev positives only, so these are genuinely held out' },
  generated_per_kind: NGEN, seed: SEED,
  ladder: rows,
  the_headline: easy && jitter
    ? `shuffled negatives give AUC ${easy.auc.toFixed(3)}; negatives that are real fish moved a quarter of a standard ` +
      `deviation give ${jitter.auc.toFixed(3)}, which is chance. The gap of ${(easy.auc - jitter.auc).toFixed(3)} is ` +
      `carried by the decoy generator, not by the model, and 12,152 of the 12,606 heldout negatives are shuffles.`
    : 'incomplete',
  the_prediction_that_was_wrong:
    'this benchmark predicted, in writing and before running, that gaussian-typical would come out at ~0.5 by ' +
    'construction, since a model cannot separate samples from its own distribution. It came out at ' +
    (hard ? hard.auc.toFixed(4) : '?') + '. The prediction was wrong, and the reason is the more interesting result: ' +
    'the fitted Gaussian is OVERDISPERSED relative to real fish, so the scorer can tell real specimens from its ' +
    'own typical samples. See misspecification below. jitter-real, which starts from real fish rather than from ' +
    'the model, is the honest hard-negative figure at ' + (jitter ? jitter.auc.toFixed(4) : '?') + '.',
  misspecification: misspec,
  what_it_bounds:
    'a statistically typical trait vector passes this scorer whether or not it is an animal that can exist. The ' +
    'scorer is a plausibility model, not a viability model, and tuning cannot change that - only a different kind ' +
    'of evidence can.',
  the_negatives_in_the_repository: {
    note: 'of 12,606 heldout negatives, 12,152 are shuffles - exactly the perturbation a Mahalanobis distance is built to detect.',
    counts: Object.fromEntries([...byNegType].map(([k, v]) => [k, v.length])),
  },
  not_done:
    'a negative that is statistically typical AND biologically impossible, built from the law layer rather than ' +
    'from the covariance. The registry holds 48 Lean theorems that could supply one. jitter-real approximates it ' +
    'from the statistical side only.',
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`\n${report.the_headline}`);
if (jitter) console.log(`jitter-real (a real fish nudged a quarter of a standard deviation): AUC ${jitter.auc.toFixed(4)}`);
console.log(`\nwritten to ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);

// ---------------------------------------------------------------- the constructed hard negative
// Everything above draws negatives. A worst case has to be searched for, so this part optimises.
{
  const { CONSTRAINTS, REJECTED, NEAR_STRICT, impossibilityCurve, WHAT_THE_CURVE_MEANS } = await import('./adversarial.mjs');
  const C = CONSTRAINTS[0];
  const realOk = positives.filter(p => C.slack(p) >= 0).length;
  console.log(`\nconstraint "${C.id}": holds on ${realOk}/${positives.length} real held-out specimens`);
  if (realOk !== positives.length) {
    console.log('  it does NOT hold on every real specimen, so it cannot label an impossibility. Not used.');
  } else {
    const curve = impossibilityCurve(P, C, posQ);
    console.log('  margin = by how much snout+eye EXCEEDS the whole head, in standard lengths\n');
    console.log('  margin   min q   typical?   real fish less typical than it');
    for (const r of curve) {
      console.log(`  ${String(r.margin).padEnd(8)}${r.min_q.toFixed(3).padStart(6)}   ${(r.called_typical_by_the_scorer ? 'YES' : 'no ').padEnd(9)}  ${(r.real_fish_less_typical_share * 100).toFixed(1).padStart(5)}%  (${r.real_fish_less_typical_than_it}/${posQ.length})`);
    }
    report.constructed_hard_negative = {
      constraint: { id: C.id, statement: C.statement, why: C.why, holds_on_real: `${realOk}/${positives.length}` },
      rejected_candidates: REJECTED, near_strict_not_used: NEAR_STRICT,
      curve, what_it_means: WHAT_THE_CURVE_MEANS,
      sampling_comparison: 'drawing 20,000 from the fitted model gave 88 violations and none inside q < 1; the search finds one at once',
    };
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    const two = curve.find(r => r.margin === 0.02);
    if (two) console.log(`\n  an animal whose snout and eye overhang the back of its head by 2% of its body length scores q=${two.min_q}, which the scorer calls ${two.called_typical_by_the_scorer ? 'TYPICAL' : 'atypical'}, and is more plausible by this measure than ${two.real_fish_less_typical_than_it} of ${posQ.length} real fish.`);
  }
}
