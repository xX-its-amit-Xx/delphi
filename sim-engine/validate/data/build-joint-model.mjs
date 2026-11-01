// Builds data/joint-model.v1.3.0.json: a Gaussian joint model of the log-trait vector, for scorer v1.3.0.
//
// WHY A JOINT MODEL. The benchmark's standard decoys take every trait from a different family. Each marginal
// therefore stays exactly where real fish are, and only the CORRELATIONS between traits are broken. Per-trait
// envelopes cannot see that by construction (v1.2.0 scored AUC 0.50 against FishBase decoys). A joint model can.
//
// WHAT IS STORED. Two trait blocks, because the two large sources measure different traits:
//   A "fishshapes": standard_length_m, body_mass_kg, body_depth_over_SL, body_width_over_SL, peduncle_depth_frac,
//                   peduncle_width_frac, head_depth_over_body_depth, lower_jaw_over_SL, mouth_width_over_SL
//   B "fishbase":   body_depth_over_SL, caudal_fin_aspect_ratio, caudal_fin_height_over_SL, eye_diameter_over_SL,
//                   head_length_over_SL, preanal_over_SL, predorsal_over_SL, preorbital_over_SL,
//                   prepectoral_over_SL, prepelvic_over_SL
// For each block, PER-FAMILY sufficient statistics {n, sum, sum of outer products} over complete cases, from the
// benchmark's DEV positives only. heldout/ is never opened. Summing them gives the fit; subtracting one family's
// gives the exact family-held-out fit, which is why they are stored per family rather than as one covariance.
//
//   node sim-engine/validate/data/build-joint-model.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// The block definitions live in joint.mjs (the scorer must never import a build script).
import { BLOCKS } from '../joint.mjs';
export { BLOCKS };

{
  const DEV = path.resolve(import.meta.dirname, '..', 'benchmark', 'dev', 'items.jsonl');
  const raw = fs.readFileSync(DEV);
  const items = raw.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(d => d.label === 'positive');
  const out = { built: new Date().toISOString(), source: 'benchmark/dev/items.jsonl positives only (heldout/ never read)',
    dev_sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    model: 'multivariate Gaussian on log10 traits; complete cases per block; per-family sufficient statistics so a family can be held out exactly by subtraction',
    blocks: {} };
  for (const [name, traits] of Object.entries(BLOCKS)) {
    const perFamily = {};
    let used = 0;
    for (const d of items) {
      const v = traits.map(t => d.params?.[t]);
      if (!v.every(x => typeof x === 'number' && x > 0)) continue;
      const fam = d.taxon?.family || d.taxon?.family_alt || '(unknown family)';
      const x = v.map(Math.log10);
      const F = (perFamily[fam] ||= { n: 0, sum: new Array(traits.length).fill(0), sxx: new Array((traits.length * (traits.length + 1)) / 2).fill(0) });
      F.n++;
      let k = 0;
      for (let i = 0; i < x.length; i++) { F.sum[i] += x[i]; for (let j = i; j < x.length; j++) F.sxx[k++] += x[i] * x[j]; }
      used++;
    }
    const r6 = a => a.map(x => +x.toPrecision(10));
    out.blocks[name] = { traits, n: used, n_families: Object.keys(perFamily).length,
      per_family: Object.fromEntries(Object.entries(perFamily).map(([f, F]) => [f, { n: F.n, sum: r6(F.sum), sxx: r6(F.sxx) }])) };
    console.log(name, 'complete cases', used, 'families', Object.keys(perFamily).length);
  }
  const dest = path.join(import.meta.dirname, 'joint-model.v1.3.0.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log('wrote', dest, (fs.statSync(dest).size / 1024).toFixed(0), 'KB');
}
