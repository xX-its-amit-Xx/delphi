// node development/trajectory.test.mjs
import { at, describe, ageAtSLcm, SLcmAt } from './trajectory.mjs';
import assert from 'node:assert/strict';

const sizes_cm = [0.4, 1, 1.68, 3, 5, 8, 12, 16, 19, 21];
console.log('SL_cm  age_d   stage     mass_g    fin/SL  finArea_cm2  WL_N/m2  vmin_m/s');
for (const s of sizes_cm) {
  const r = at({ SL_cm: s });
  console.log(
    String(s).padEnd(6), String(r.ageDays).padEnd(7), r.stage.padEnd(9),
    (r.mass_kg * 1000).toPrecision(3).padEnd(9), String(r.finLength_SL).padEnd(7),
    (r.finArea_m2 * 1e4).toPrecision(3).padEnd(12), String(r.wingLoading_N_m2).padEnd(8), r.vmin_glide_m_s,
  );
}
console.log('\negg at -3 d:', JSON.stringify(at(-3).embryo));
console.log('day 80:', at(80).SL_m, 'm SL (Campana 1993 anchor: ~12 cm at 80 d; FL here', at(80).FL_m, 'm)');
console.log('E. volitans fin/SL at 3 vs 17 cm:', at({ SL_cm: 3 }, { species: 'Exocoetus volitans' }).finLength_SL, at({ SL_cm: 17 }, { species: 'Exocoetus volitans' }).finLength_SL);
console.log('\nrelations:'); for (const d of describe()) console.log(' -', d.quantity, ':', d.relation, `[${d.kind}]`);

// checks
for (const t of [0, 5, 14, 30, 100, 200]) assert.ok(Math.abs(ageAtSLcm(SLcmAt(t)) - t) < 1e-6, 'inverse at ' + t);
assert.ok(Math.abs(at(80).FL_m - 0.112) < 0.002, 'VB gives ~11.2 cm FL at 80 d');
assert.equal(at(-1).stage, 'egg');
assert.equal(at({ SL_cm: 20 }).stage, 'adult');
assert.ok(at({ SL_cm: 10 }).finLength_SL > 0.6 && at({ SL_cm: 10 }).finLength_SL < 0.79);
assert.ok(at({ SL_cm: 2 }).vmin_glide_m_s < at({ SL_cm: 20 }).vmin_glide_m_s, 'v_min rises with size');
console.log('\nall checks passed');
