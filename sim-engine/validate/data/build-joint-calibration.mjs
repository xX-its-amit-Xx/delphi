// Builds data/joint-calibration.v1.3.0.json: the null distribution of q = D^2/d for the v1.3.0 joint term, measured
// on real DEV positives under LEAVE-OWN-FAMILY-OUT, so the p-value answers "how often is a real fish, whose family
// the model never saw, at least this far out?". For each block and each dimension d, the first d traits of the
// block are used (a fixed, stated order), and 101 quantiles of q are stored.
//   node sim-engine/validate/data/build-joint-calibration.mjs
import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS } from './build-joint-model.mjs';
import { fitBlock, mahalanobis, MIN_TRAITS } from '../joint.mjs';

const DEV = path.resolve(import.meta.dirname, '..', 'benchmark', 'dev', 'items.jsonl');
const items = fs.readFileSync(DEV, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(d => d.label === 'positive');
const out = { built: new Date().toISOString(), rule: 'q = D^2/d of real DEV positives, each scored with its OWN FAMILY held out of the fit; the first d traits of each block are used for dimension d', blocks: {} };
for (const [name, traits] of Object.entries(BLOCKS)) {
  const rows = items.filter(d => traits.every(t => typeof d.params?.[t] === 'number' && d.params[t] > 0));
  const byFam = {};
  for (const d of rows) (byFam[d.taxon?.family || d.taxon?.family_alt || '(unknown family)'] ||= []).push(d);
  out.blocks[name] = {};
  for (let d = MIN_TRAITS; d <= traits.length; d++) {
    const use = traits.slice(0, d), qs = [];
    for (const [fam, list] of Object.entries(byFam)) {
      const fit = fitBlock(name, { excludeFamilies: [fam] });
      if (!fit.ran) continue;
      for (const it of list) { const m = mahalanobis(fit, Object.fromEntries(use.map(t => [t, it.params[t]]))); if (m.ran) qs.push(m.q); }
    }
    qs.sort((a, b) => a - b);
    const quantiles = Array.from({ length: 101 }, (_, i) => { const x = (qs.length - 1) * (i / 100), lo = Math.floor(x), hi = Math.ceil(x); return +(qs[lo] + (qs[hi] - qs[lo]) * (x - lo)).toPrecision(8); });
    out.blocks[name][d] = { n: qs.length, traits: use, quantiles };
    console.log(name, 'd =', d, 'n =', qs.length, 'median q', quantiles[50], 'q99', quantiles[99]);
  }
}
const dest = path.join(import.meta.dirname, 'joint-calibration.v1.3.0.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('wrote', dest, (fs.statSync(dest).size / 1024).toFixed(0), 'KB');
