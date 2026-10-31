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
// Two bands. A PROVED row carries the kernel note and names its theorem and module; an EMPIRICAL row carries
// the conditional sentence, the observation it rests on, and the entry a reader would reject to drop it.
const proved = r10.filter(r => r.band !== 'empirical' && r.id !== 'unconstrained-inputs');
const empirical = r10.filter(r => r.band === 'empirical');
assert.ok(proved.length >= 11 && proved.every(r => r.kernel === KERNEL_NOTE && r.theorem && r.module));
assert.ok(empirical.length === 5 && empirical.every(r => r.conditionalOn && r.observation && r.observationSource && r.kernel !== KERNEL_NOTE));
// The fin-ratio row is provenance: it may say a design is outside everything measured, never that it is ruled out.
const e5out = check({ ...base, airspeed_m_s: 10, fin_length_over_SL: 1.2 }).find(r => r.id === 'E5');
assert.equal(e5out.verdict, 'cannot-evaluate'); assert.equal(e5out.verdictKind, 'provenance'); assert.equal(e5out.numbers.outsideTheRecord, true);
const e5in = check({ ...base, airspeed_m_s: 10, fin_length_over_SL: 0.687 }).find(r => r.id === 'E5');
assert.equal(e5in.verdict, 'holds');
// E3 is stronger than C14: the real specimen at 10 m/s is above the ceiling of every teleost in the ranges.
assert.equal(by(r10, 'E3').verdict, 'violated');
assert.equal(by(check({ ...base, airspeed_m_s: 10, powerRequired_W: 0.04 }), 'E3').verdict, 'violated');
assert.equal(by(check({ powerRequired_W: 0.04 }), 'E3').verdict, 'holds');
// E7 fires on the two levers the genotype thread states in hours, and passes a lever whose animal survives.
assert.equal(by(check({ lethality: { death_hpf: 48, scored_hpf: 48 } }), 'E7').verdict, 'violated');
assert.equal(by(check({ lethality: { death_hpf: 4320, scored_hpf: 2160 } }), 'E7').verdict, 'holds');

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
assert.ok(empty.every(r => r.verdict === 'cannot-evaluate' && (r.missing.length > 0 || r.verdictKind === 'provenance')));
assert.ok(by(check({ ...base, airspeed_m_s: 12, gillArea_m2: 0.01 }), 'C14').missing.includes('arterialO2'));
// Viz design shape and aliases; environment from conditions/baseline.json.
import { ENVIRONMENT } from './browser-check.mjs';
assert.equal(ENVIRONMENT.source, 'conditions/baseline.json'); assert.equal(DEFAULTS.rho, ENVIRONMENT.air_density_kg_m3);
const viz = check({ SL_m: REFERENCE.SL_m, mass_kg: REFERENCE.mass_kg, fin_length_over_SL: 0.687, fin_area_m2: REFERENCE.liftingArea_m2, lower_lobe_over_SL: 0.2, muscle_fraction: 0.3, gill_area_m2: 0.01, airspeed_m_s: 15, CL_max: REFERENCE.CLmax });
assert.equal(by(viz, 'C9').verdict, 'holds');
assert.ok(viz.filter(r => r.band !== 'empirical').every(r => 'id' in r && 'verdict' in r && 'missing_inputs' in r && 'theorem' in r && 'module' in r && 'needed' in r && 'available' in r));
assert.ok(by(viz, 'unconstrained-inputs').numbers.finLength_SL === 0.687);
console.log('browser-check: all assertions passed; area needed at 10 m/s = ' + liftingAreaNeeded(W, 10, DEFAULTS.rho, REFERENCE.CLmax).toFixed(6) + ' m²');
