// node lean/eliminate/browser-check.test.mjs
// Reproduces the audit's pectoral-fin numbers (lean/flying-fish-audit.json, lean/morphology-grounding.json) from
// browser-check.mjs: lifting area needed 0.012316 m² at 10 m/s and 0.003079 m² at 20 m/s for the Park and Choi L3
// specimen, v_min 9.85 m/s, and the three-state behaviour on a few specs.
import assert from 'node:assert/strict';
import { check, liftingAreaNeeded, vmin, REFERENCE, KERNEL_NOTE, DEFAULTS } from './browser-check.mjs';

const W = REFERENCE.mass_kg * DEFAULTS.g;
assert.equal(liftingAreaNeeded(W, 10, DEFAULTS.rho, REFERENCE.CLmax).toFixed(6), '0.012316');
assert.equal(liftingAreaNeeded(W, 20, DEFAULTS.rho, REFERENCE.CLmax).toFixed(6), '0.003079');
assert.equal(vmin(W, REFERENCE.liftingArea_m2, DEFAULTS.rho, REFERENCE.CLmax).toFixed(2), '9.85');

// The reference specimen at the field speeds holds C9; at 5 m/s it is violated.
const base = { SL_m: REFERENCE.SL_m, mass_kg: REFERENCE.mass_kg, finArea_m2: REFERENCE.liftingArea_m2, CLmax: REFERENCE.CLmax, LD_max: REFERENCE.LD_max };
const r10 = check({ ...base, airspeed_m_s: 10 }), r5 = check({ ...base, airspeed_m_s: 5 });
const by = (rs, id) => rs.find(r => r.id === id);
assert.equal(by(r10, 'C9').verdict, 'holds');
assert.equal(by(r5, 'C9').verdict, 'violated');
assert.equal(by(r10, 'C9').kernel, KERNEL_NOTE);
assert.ok(r10.every(r => r.kernel === KERNEL_NOTE && r.theorem && r.module));

// Scaling against the reference: an isometric doubling holds; doubling length without changing mass is violated.
const iso = check({ ...base, SL_m: 2 * REFERENCE.SL_m, mass_kg: 8 * REFERENCE.mass_kg, finArea_m2: 4 * REFERENCE.liftingArea_m2, airspeed_m_s: 20 });
assert.equal(by(iso, 'C7b').verdict, 'holds'); assert.equal(by(iso, 'C2a').verdict, 'holds'); assert.equal(by(iso, 'C8e').verdict, 'holds');
assert.equal(by(iso, 'C9c').verdict, 'holds');
const stretched = check({ ...base, SL_m: 2 * REFERENCE.SL_m, airspeed_m_s: 10 });
assert.equal(by(stretched, 'C7b').verdict, 'violated');

// Glide: 50 m from 8 m with L/D 4.37 is violated; with 15.7 it holds (the audit's finding).
assert.equal(by(check({ glideHeight_m: 8, LD_max: 4.37, glideDistance_m: 50 }), 'C15').verdict, 'violated');
assert.equal(by(check({ glideHeight_m: 8, LD_max: 4.37, glideDistance_m: 50, groundEffect: 0.14 }), 'C15').verdict, 'violated');
assert.equal(by(check({ glideHeight_m: 8, LD_max: 15.7, glideDistance_m: 50 }), 'C15').verdict, 'holds');

// Missing inputs are named, never passed.
const empty = check({});
assert.ok(empty.every(r => r.verdict === 'cannot-evaluate' && r.missing.length > 0));
assert.ok(by(check({ ...base, airspeed_m_s: 12, gillArea_m2: 0.01 }), 'C14').missing.includes('arterialO2'));
// Viz design shape and aliases; environment from conditions/baseline.json.
import { ENVIRONMENT } from './browser-check.mjs';
assert.equal(ENVIRONMENT.source, 'conditions/baseline.json'); assert.equal(DEFAULTS.rho, ENVIRONMENT.air_density_kg_m3);
const viz = check({ SL_m: REFERENCE.SL_m, mass_kg: REFERENCE.mass_kg, fin_length_over_SL: 0.687, fin_area_m2: REFERENCE.liftingArea_m2, lower_lobe_over_SL: 0.2, muscle_fraction: 0.3, gill_area_m2: 0.01, airspeed_m_s: 15, CL_max: REFERENCE.CLmax });
assert.equal(by(viz, 'C9').verdict, 'holds');
assert.ok(viz.every(r => 'id' in r && 'verdict' in r && 'missing_inputs' in r && 'theorem' in r && 'module' in r && 'needed' in r && 'available' in r));
assert.ok(by(viz, 'unconstrained-inputs').numbers.finLength_SL === 0.687);
console.log('browser-check: all assertions passed; area needed at 10 m/s = ' + liftingAreaNeeded(W, 10, DEFAULTS.rho, REFERENCE.CLmax).toFixed(6) + ' m²');
