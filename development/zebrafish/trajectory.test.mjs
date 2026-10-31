// node development/zebrafish/trajectory.test.mjs
import { at, compareAt, dpfAtSLmm, SLmmAtDpf, describe } from './trajectory.mjs';
import assert from 'node:assert/strict';

console.log('dph     dpf     stage     SL_mm   mass_mg   pectoral');
for (const d of [-1.5, -0.5, 0, 1, 3, 6, 10, 15, 24.3, 40, 71, 150, 365]) {
  const r = at(d);
  console.log(String(d).padEnd(7), String(r.dpf).padEnd(7), r.stage.padEnd(9),
    (r.SL_m == null ? '-' : (r.SL_m * 1000).toFixed(2)).padEnd(7),
    (r.mass_kg == null ? '-' : (r.mass_kg * 1e6).toPrecision(3)).padEnd(9),
    r.SL_m == null ? r.zfs.name + ' | ' + r.pectoral.state : r.pectoral.state);
}
console.log('\nmaturity check: SL at 73 dpf =', SLmmAtDpf(73).toFixed(1), 'mm (FishBase Lm 23-25 mm SL, tm 0.20 yr)');
console.log('juvenile onset (J, 11 mm) at', dpfAtSLmm(11).toFixed(1), 'dpf (Parichy: ~4 weeks)');
console.log('pectoral ray onset (6.4 mm) at', dpfAtSLmm(6.4).toFixed(1), 'dpf');

console.log('\ncompareAt, absolute (days post-hatching):');
for (const d of [-1, 0, 10, 30, 100]) {
  const c = compareAt(d);
  console.log(`  ${String(d).padEnd(4)} FF ${c.flyingFish.stage.padEnd(9)} SL ${c.flyingFish.SL_m ?? '-'} m | ZF ${c.zebrafish.stage.padEnd(9)} SL ${c.zebrafish.SL_m ?? '-'} m | progress ${c.progress.flyingFish}/${c.progress.zebrafish}`);
}
console.log('compareAt, stage-normalised:');
for (const d of [-3, 5, 21, 100, 251, 355]) {
  const c = compareAt(d, { mode: 'stage' });
  console.log(`  FF ${String(d).padEnd(4)} d -> ZF ${String(c.zebrafishAgeDays).padEnd(7)} d  progress ${c.progress}  ${c.flyingFish.stage}/${c.zebrafish.stage}`);
}
console.log('\nrelations:'); for (const r of describe()) console.log(' -', r.quantity, ':', r.relation, `[${r.kind}]`);

for (const d of [2.2, 5, 20, 40, 200]) assert.ok(Math.abs(dpfAtSLmm(SLmmAtDpf(d)) - d) < 1e-6, 'inverse ' + d);
assert.ok(Math.abs(SLmmAtDpf(26.25) - 11) < 1e-9, 'continuity at J');
assert.ok(dpfAtSLmm(11) > 21 && dpfAtSLmm(11) < 35, 'J near 4 weeks');
assert.ok(SLmmAtDpf(73) > 22 && SLmmAtDpf(73) < 27, 'maturity size near Lm at tm');
for (const d of [-3, 5, 21, 100, 251]) { const c = compareAt(d, { mode: 'stage' }); assert.equal(c.zebrafish.stage, c.flyingFish.stage, 'stage mode keeps both in the same stage at ' + d); }
assert.equal(at(-1).stage, 'egg');
console.log('\nall checks passed');
