// Self-test: node physiology/test.mjs
import { solve, analytic } from './countercurrent.js';
import { content, saturation, pressureFromContent, HB_PARAMS } from './haemoglobin.js';
import { simulate } from './cardiac.js';
import { steadyPower, cyclicPower, tuneFc, MUSCLE_PARAMS, aerobicPowerFromVO2 } from './muscle.js';
import { calibrateGills, createPhysiology } from './index.js';
import { readFileSync } from 'node:fs';

const f = (x, d = 3) => (typeof x === 'number' ? x.toFixed(d) : String(x));
let fails = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails++; };

console.log('== 1. Counter-current vs co-current, dimensionless (gills.json params)');
const gj = JSON.parse(readFileSync(new URL('./gills.json', import.meta.url)));
const p = Object.fromEntries(Object.entries(gj.params).map(([k, v]) => [k, typeof v === 'object' ? v.value : v]));
const cc = solve({ ...p, N: 200 }, true), co = solve({ ...p, N: 200 }, false);
console.log(`k=${f(p.k)} ratio=${f(p.ratio)} Pw_in=${f(p.Pw_in, 2)} kPa Pb_in=${f(p.Pb_in, 2)} kPa`);
console.log(`counter-current: extraction=${f(cc.extraction)} utilisation=${f(cc.utilisation)} waterOut=${f(cc.waterOut, 2)} bloodOut=${f(cc.bloodOut, 2)} kPa (iter ${cc.iterations})`);
console.log(`co-current:      extraction=${f(co.extraction)} utilisation=${f(co.utilisation)} waterOut=${f(co.waterOut, 2)} bloodOut=${f(co.bloodOut, 2)} kPa (iter ${co.iterations})`);
check('counter matches analytic', Math.abs(cc.extraction - analytic(p.k, p.ratio, true)) < 1e-3);
check('co matches analytic', Math.abs(co.extraction - analytic(p.k, p.ratio, false)) < 1e-3);
check('counter beats co', cc.extraction > co.extraction);
check('co-current blood cannot exceed water outlet', co.bloodOut <= co.waterOut + 1e-6);

console.log('\n== 2. Counter-current with haemoglobin (trout reference, physical units per kg)');
const cal = calibrateGills();
console.log(`D=${f(cal.D, 5)} ml O2 s-1 kPa-1 kg-1, Gw=${f(cal.Gw, 5)}, Q=${f(cal.Q, 4)} ml/s/kg; tuned PaO2 -> counter ${f(cal.counter.bloodOut, 2)} kPa, co ${f(cal.co.bloodOut, 2)} kPa`);
console.log(`counter: extraction=${f(cal.counter.extraction)} uptake=${f(cal.counter.uptake * 60, 3)} ml O2/min/kg | co: extraction=${f(cal.co.extraction)} uptake=${f(cal.co.uptake * 60, 3)} ml O2/min/kg`);
console.log(`Ca=${f(cal.Ca, 4)} Cv=${f(cal.Cv, 4)} ml/ml; SaO2=${f(saturation(cal.counter.bloodOut))}, SvO2=${f(saturation(cal.Pb_in))}`);
check('Hb inverse round-trip', Math.abs(pressureFromContent(content(5)) - 5) < 1e-6);

console.log('\n== 3. Cardiac Windkessel (warm proxy, 0.06 kg)');
for (const x of [0, 1]) { const s = simulate({ mass_kg: 0.06, intensity: x }); console.log(`intensity ${x}: HR ${f(s.HR_bpm, 1)} bpm, SV ${f(s.SV_ml_kg, 3)} ml/kg, Q ${f(s.Q_ml_min_kg, 1)} ml/min/kg; P_VA ${f(s.P_VA.min, 2)}-${f(s.P_VA.max, 2)} (mean ${f(s.P_VA.mean, 2)}) kPa; P_DA mean ${f(s.P_DA.mean, 2)} kPa`); }

console.log('\n== 4. Muscle');
const fc = tuneFc();
console.log(`Hill steady max power: red 20 degC ${f(steadyPower('red', 20), 1)} W/kg (rome1992 measured 134), white 10 degC ${f(steadyPower('white', 10, 0.37), 1)} W/kg (sculpin burst measured 307)`);
console.log(`fc tuned = ${f(fc, 2)} Hz; red cyclic power at 25 degC: ` + [1, 3, 5, 8, 12, 15].map((h) => `${h} Hz ${f(cyclicPower('red', 25, h), 1)}`).join(', ') + ' W/kg');
console.log(`aerobic power per ml O2/s: ${f(aerobicPowerFromVO2(1), 2)} W (Eox ${f(MUSCLE_PARAMS.oxycalorific_J_per_mgO2.value / 0.7, 2)} J/ml x eta ${MUSCLE_PARAMS.efficiency.value})`);

console.log('\n== 5. createPhysiology, 0.06 kg fish');
const spec = { mass_kg: 0.06, flightMuscleFraction: 0.1, axialMuscleFraction: 0.5 };
const env = {}; // baseline: 25 degC, 35 psu, air O2 0.209, air-saturated (conditions/baseline.json)
const phys = createPhysiology(spec, env);
for (const g of ['axial', 'flight']) { const r = phys.powerAvailable(g, 1); console.log(`${g}: aerobic ${f(r.aerobic_W, 4)} W, burst ${f(r.burst_W, 3)} W, total ${f(r.total_W, 3)} W, limitedBy ${r.limitedBy}`); }
console.log('o2 (rest, water):', JSON.stringify(phys.o2(), (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
let t = 0;
for (; t < 30; t += 0.1) phys.step(0.1, { phase: 'glide', speed_m_s: 10, demand_W: 0.05 });
const sfGlide = phys.o2().storeFraction;
console.log('o2 after 30 s glide at 0.05 W demand:', JSON.stringify(phys.o2(), (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
console.log('axial after glide:', JSON.stringify(phys.powerAvailable('axial', 10), (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
for (t = 0; t < 120; t += 0.1) phys.step(0.1, { phase: 'swim', speed_m_s: 1, demand_W: 0.0 });
console.log('o2 after 120 s rest in water:', JSON.stringify(phys.o2(), (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
const d = phys.describe();
console.log(`describe(): ${d.length} rows; kinds: ` + JSON.stringify(d.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {})));
check('blood O2 store drains in air', sfGlide < 0.9);
const res = createPhysiology(spec, env); for (let i = 0; i < 6000; i++) res.step(0.1, { phase: 'glide', speed_m_s: 10, demand_W: 0 });
console.log('o2 after 600 s in air at zero work:', JSON.stringify(res.o2(), (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
check('store reaches the venous floor in air', res.o2().storeFraction < 0.05);
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exitCode = fails ? 1 : 0;
