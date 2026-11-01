// Where do the parametric reference organisms' body values sit among real FishShapes specimens?
//   node sim-engine/generative/body/compare-parametric.mjs
// The parametric sets were NOT used for training (their depth/width/peduncle values are mostly 'assumed'); this is
// the comparison instead. Percentile = fraction of real specimens of the family at or below the value.
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, '..', '..', '..');
const [head, ...lines] = fs.readFileSync(path.join(HERE, 'data', 'fishshapes-derived.csv'), 'utf8').trim().split(/\r?\n/);
const H = head.split(',');
const rows = lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [H[i], v])));
const feat = r => ({ body_depth_over_SL: r.depth_mm / r.SL_mm, body_width_over_SL: r.width_mm / r.SL_mm, peduncle_depth_frac: r.ped_depth_mm / r.depth_mm,
  peduncle_width_frac: r.ped_width_mm / r.width_mm, fulton_K: 1e5 * r.weight_g / r.SL_mm ** 3 });
const groups = { Exocoetidae: rows.filter(r => r.family === 'Exocoetidae'), Cyprinidae: rows.filter(r => r.family === 'Cyprinidae'), Danio_rerio: rows.filter(r => r.species === 'Danio_rerio') };
const out = {};
for (const [id, grp] of [['flying-fish', ['Exocoetidae']], ['zebrafish-adult', ['Cyprinidae', 'Danio_rerio']]]) {
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'anatomy-model', 'parametric', 'organisms', `${id}.json`), 'utf8')).parameters;
  const v = { body_depth_over_SL: P.body_depth_over_SL.value, body_width_over_SL: P.body_width_over_SL.value, peduncle_depth_frac: P.peduncle_depth_frac.value,
    peduncle_width_frac: P.peduncle_width_frac.value, fulton_K: 1e5 * P.body_mass_kg.value * 1000 / (P.standard_length_m.value * 1000) ** 3 };
  out[id] = {};
  for (const [k, x] of Object.entries(v)) {
    const kind = k === 'fulton_K' ? `${P.body_mass_kg.kind} mass, ${P.standard_length_m.kind} SL` : P[k].kind;
    out[id][k] = { value: +x.toFixed(4), kind };
    for (const g of grp) {
      const vals = groups[g].map(r => feat(r)[k]).sort((a, b) => a - b);
      out[id][k][g] = { percentile: +(vals.filter(y => y <= x).length / vals.length).toFixed(3), median: +vals[Math.floor(vals.length / 2)].toFixed(4), min: +vals[0].toFixed(4), max: +vals.at(-1).toFixed(4), n: vals.length };
    }
  }
}
console.log(JSON.stringify(out, null, 1));
