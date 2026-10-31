#!/usr/bin/env node
// Generates lean/eliminate/browser-check.mjs, a dependency-free ES module for the Design Studio, from
// lean/constraints.json (constraint ids, theorem and module names, relations, hypotheses, scope) and the
// reference specimen in physics/glide-data.csv, so the metadata cannot drift from the constraints. The formulas
// below are the same ones lean/eliminate/eliminate.mjs encodes, in floating point instead of exact rationals.
//   node lean/eliminate/build-browser-check.mjs && node lean/eliminate/browser-check.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const C = JSON.parse(fs.readFileSync(path.join(root, 'lean/constraints.json'), 'utf8'));
const csv = fs.readFileSync(path.join(root, 'physics/glide-data.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
const head = csv[0].split(',');
const rows = csv.slice(1).map(l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])); });
const L3 = rows.find(r => /model L3/.test(r.source_locator));
const REF = { name: 'Cypselurus hiraii, Park and Choi 2010 Table 1 model L3 (physics/glide-data.csv)', SL_m: +L3.body_length_m, mass_kg: +L3.body_mass_kg, pectoralFinArea_m2: +L3.pectoral_fin_area_m2, pelvicFinArea_m2: +L3.pelvic_fin_area_m2, bodyPlanformArea_m2: +L3.body_planform_area_m2, liftingArea_m2: +(+L3.pectoral_fin_area_m2 + +L3.pelvic_fin_area_m2 + +L3.body_planform_area_m2).toFixed(6), CLmax: +L3.CL_max, LD_max: +L3.LD_max };
const meta = Object.fromEntries(C.constraints.map(c => [c.id, { constraint: c.id, theorem: c.lemma, law: c.law, module: c.module, relation: c.relation, band: c.empirical ? 'empirical' : 'proved', empirical: c.empirical || null, constraintStatus: c.status || null, scope: c.proofScope ? { kernelChecked: c.proofScope.kernelChecked, assumed: c.proofScope.assumed } : null, hypotheses: c.assumptionsText, faithfulness: c.faithfulness, canEliminate: c.canEliminate }]));
const USED = ['C9', 'C7b', 'C2a', 'C8e', 'C8c', 'C14', 'C14b', 'C15', 'C16', 'C13', 'C10', 'C9c', 'G1', 'G2', 'G3', 'G4', 'G5', 'E2', 'E3', 'E4', 'E7'];
for (const u of USED) if (!meta[u]) throw new Error('constraint missing from constraints.json: ' + u);


// Genotype data the checker's genotype rows need: the code table (from the shared module that mirrors
// lean/Delphi/Genotype.lean), the gene reach of the closure check, and the certified develops_from edges.
const { CODE } = await import('../genotype/code.mjs');
const GN = JSON.parse(fs.readFileSync(path.join(root, 'lean/genotype/gene-nodes.json'), 'utf8'));
const DEVC = JSON.parse(fs.readFileSync(path.join(root, 'lean/genotype/dev-certificate.json'), 'utf8'));
const GENE_NODES = Object.fromEntries(Object.entries(GN.genes).filter(([, v]) => v).map(([k, v]) => [k, v.nodes.map(n => ({ term: n.term, label: n.label, linkTypes: n.linkTypes }))]));
const DEVELOPMENT = { source: DEVC.source, stageOrder: DEVC.stageOrder, certified: DEVC.edges.certified, unknownStage: DEVC.edges.unknownStage, theorem: DEVC.theorems.ordered,
  edges: DEVC.certifiedEdges.map(e => ({ derivative: e.derivativeLabel, derivative_zfs: e.derivativeZfs, precursor: e.precursorLabel, precursor_zfs: e.precursorZfs })) };
const FRAGMENT = fs.readFileSync(path.join(here, 'browser-check-genotype.fragment.mjs'), 'utf8')
  .split('__GENETIC_CODE__').join(JSON.stringify(CODE))
  .split('__GENE_NODES__').join(JSON.stringify(GENE_NODES, null, 1))
  .split('__DEVELOPMENT__').join(JSON.stringify(DEVELOPMENT, null, 1))
  .replace(/^\/\/ FRAGMENT[\s\S]*?placeholders:[^\n]*\n/m, '// ---- genotype rows (generated from lean/eliminate/browser-check-genotype.fragment.mjs) ----\n');


// The empirical layer (lean/empirical.json): observations a reader may reject, shown in their own band.
const EMP = JSON.parse(fs.readFileSync(path.join(root, 'lean/empirical.json'), 'utf8'));
const EMP_SLIM = { built: EMP.built, module: EMP.module, framing: EMP.framing, nonVacuity: EMP.nonVacuity,
  entries: EMP.entries.map(e => ({ id: e.id, status: e.status, title: e.title, statement: e.statement, observation: e.observation, source: e.source, taxa: e.taxa, scope: e.scope, constraints: e.constraints, rejectable: e.rejectable, lean: e.lean })) };
const EMP_FRAGMENT = fs.readFileSync(path.join(here, 'browser-check-empirical.fragment.mjs'), 'utf8')
  .split('__EMPIRICAL__').join(JSON.stringify(EMP_SLIM, null, 1));

const BASE = JSON.parse(fs.readFileSync(path.join(root, 'conditions/baseline.json'), 'utf8'));
const REF_RHO = BASE.conditions.air_density_kg_m3.value, REF_G = 9.80665, EXP_BAND = 0.1;
const ENV = { source: 'conditions/baseline.json', decided: BASE.decided, air_density_kg_m3: REF_RHO, water_temperature_C: BASE.conditions.water_temperature_C.value, salinity_psu: BASE.conditions.salinity_psu.value, air_O2_fraction: BASE.conditions.air_O2_fraction.value, rule: BASE.rule };
const out = `// GENERATED by lean/eliminate/build-browser-check.mjs on ${new Date().toISOString()} from lean/constraints.json (built ${C.built}).
// Dependency-free ES module for the Design Studio. check(spec) evaluates the SAME formulas the Lean-backed
// constraints encode, in floating point, and returns one result per constraint it can reach.
//
// NOT A KERNEL CHECK: this evaluates the same formulas; kernel certificates exist only for the recorded
// examples (lean/Delphi/Certificates/*.lean, generated by lean/eliminate/eliminate.mjs). Every result carries
// that sentence in its "kernel" field. Verdicts: "holds" (the spec satisfies the relation; never "feasible"),
// "violated" (the relation fails for the committed numbers, under the named hypotheses), "cannot-evaluate"
// (an input is missing, listed in "missing").
//
// spec fields (SI units): SL_m, mass_kg, finLength_SL, finArea_m2 (lifting area used for lift; if absent,
// pectoralFinArea_m2 + pelvicFinArea_m2 + bodyPlanformArea_m2 when given), CLmax, LD_max, rho (kg/m^3; default
// ${REF_RHO}), airspeed_m_s, g (default ${REF_G}); glideHeight_m, glideDistance_m, groundEffect (fraction, default 0);
// flightMuscleFraction and musclePowerPerKg_W (Thompson's muscle premise, R6: a NAMED HYPOTHESIS, used only if
// both are given, to form P_avail), or powerAvailable_W directly; climbRate_m_s; efficiency, oxycaloric_J_per_unit_O2,
// cardiacOutput (volume per s), arterialO2 (O2 per volume) for the aerobic bound (units must multiply to watts;
// gillArea_m2 is accepted but the gill-to-blood link is NOT formalised, so it never produces arterialO2);
// referenceSafetyFactor for Galileo's giant; exponentBand (default ${JSON.stringify(EXP_BAND)}) is the Design Studio's
// decision band for implied scaling exponents relative to the reference specimen, a decision rule outside Lean.
// Genotype fields: genotype_edits [{gene, wt_aa, mut_aa, substitutions, nodes_changed}], developmental_claims
// [{derivative, derivative_zfs, precursor, precursor_zfs}] and substitution_budget {required_substitutions,
// gene_copies_M, mutation_rate, generations_T, reproductive_excess, cost_per_substitution}. G1 to G5 each yield
// one row whose verdict is the worst over the items, with every item listed in numbers.items.
// Empirical fields: mass_exponent (E2), o2_store_ml with flight_duration_s and oxycaloric_J_per_unit_O2 (E4),
// fin_length_over_SL (E5, a provenance flag that never eliminates), lethality {death_hpf, scored_hpf} (E7).
// Every empirical row carries band: "empirical", the observation in plain words, its source and scope, and
// what rejecting it costs; the proved rows carry band: "proved". An empirical row is CONDITIONAL: the
// arithmetic is checked, the observation is not, and a reader may reject it and drop that row alone.
// Reference specimen for scaling comparisons: ${REF.name}.

export const KERNEL_NOTE = 'evaluates the same formulas; not a kernel check: kernel certificates exist only for the recorded examples';
export const REFERENCE = ${JSON.stringify(REF, null, 1)};
export const META = ${JSON.stringify(Object.fromEntries(USED.map(u => [u, meta[u]])), null, 1)};
export const ENVIRONMENT = ${JSON.stringify(ENV, null, 1)};
export const DEFAULTS = { rho: ${REF_RHO}, g: ${REF_G}, groundEffect: 0, exponentBand: ${JSON.stringify(EXP_BAND)} };
// Design Studio field names (Viz): design = {SL_m, mass_kg, fin_length_over_SL, fin_area_m2, lower_lobe_over_SL, muscle_fraction, gill_area_m2, airspeed_m_s}.
// Aliases map them onto the spec fields; fin_length_over_SL and lower_lobe_over_SL are accepted and reported but no theorem constrains them.
const ALIASES = { fin_area_m2: 'finArea_m2', muscle_fraction: 'flightMuscleFraction', gill_area_m2: 'gillArea_m2', fin_length_over_SL: 'finLength_SL', lower_lobe_over_SL: 'lowerLobe_SL', CL_max: 'CLmax', LD: 'LD_max', glide_height_m: 'glideHeight_m', glide_distance_m: 'glideDistance_m', ground_effect: 'groundEffect', climb_rate_m_s: 'climbRate_m_s', power_available_W: 'powerAvailable_W', power_required_W: 'powerRequired_W', cardiac_output: 'cardiacOutput', arterial_O2: 'arterialO2', oxycaloric: 'oxycaloric_J_per_unit_O2', reference_safety_factor: 'referenceSafetyFactor' };
export function normalise(design) { const s = {}; for (const [k, v] of Object.entries(design || {})) s[ALIASES[k] || k] = v; return s; }

/** Lifting area a weight W (N) needs at airspeed v (m/s): S >= 2 W / (rho v^2 CLmax). Theorem Delphi.vmin_le, rearranged. */
export function liftingAreaNeeded(W_N, v, rho, CLmax) { return 2 * W_N / (rho * v * v * CLmax); }
/** Minimum airspeed: sqrt(2 W / (rho S CLmax)). Delphi.vmin. */
export function vmin(W_N, S, rho, CLmax) { return Math.sqrt(2 * W_N / (rho * S * CLmax)); }

const num = x => typeof x === 'number' && Number.isFinite(x);
// Result shape (Viz): {id, verdict, needed, available, missing_inputs, theorem, module, ...}. "needed" and "available" are the two
// sides of the relation where it has that form (what the design must supply vs what it does), else null.
const result = (id, verdict, numbers, missing, note, sides) => ({ id, ...META[id], verdict, needed: sides ? sides.needed : null, available: sides ? sides.available : null, missing_inputs: missing, missing, numbers, note: note || null, kernel: KERNEL_NOTE });

${FRAGMENT}
${EMP_FRAGMENT}
export function check(design) {
  const s = { ...DEFAULTS, ...normalise(design) };
  const out = [];
  const unconstrained = ['finLength_SL', 'lowerLobe_SL'].filter(k => num(s[k])).map(k => ({ field: k, value: s[k], note: 'accepted, reported, constrained by no theorem (fin length ratio and caudal lobe ratio are inputs the model carries; see lean/morphology-grounding.json)' }));
  if (unconstrained.length) out.push({ id: 'unconstrained-inputs', verdict: 'cannot-evaluate', needed: null, available: null, missing_inputs: [], missing: [], numbers: Object.fromEntries(unconstrained.map(u => [u.field, u.value])), note: unconstrained.map(u => u.note).join('; '), theorem: null, module: null, kernel: KERNEL_NOTE });
  const W = num(s.mass_kg) ? s.mass_kg * s.g : null;
  const S = num(s.finArea_m2) ? s.finArea_m2 : (num(s.pectoralFinArea_m2) ? s.pectoralFinArea_m2 + (s.pelvicFinArea_m2 || 0) + (s.bodyPlanformArea_m2 || 0) : null);

  // C9: minimum speed, exact and dimensional.
  { const miss = []; if (W === null) miss.push('mass_kg'); if (S === null) miss.push('finArea_m2'); if (!num(s.CLmax)) miss.push('CLmax'); if (!num(s.airspeed_m_s)) miss.push('airspeed_m_s');
    if (miss.length) out.push(result('C9', 'cannot-evaluate', { W_N: W, S_m2: S }, miss));
    else { const vm = vmin(W, S, s.rho, s.CLmax), need = liftingAreaNeeded(W, s.airspeed_m_s, s.rho, s.CLmax);
      out.push(result('C9', s.airspeed_m_s >= vm ? 'holds' : 'violated', { W_N: W, S_m2: S, CLmax: s.CLmax, rho: s.rho, airspeed_m_s: s.airspeed_m_s, vmin_m_s: vm, liftingAreaNeeded_m2: need }, [], s.airspeed_m_s >= vm ? 'lift can equal weight at some C_L <= CLmax' : 'below the minimum speed: lift cannot reach the weight even at CLmax', { needed: { liftingArea_m2: need, or_airspeed_m_s: vm }, available: { liftingArea_m2: S, airspeed_m_s: s.airspeed_m_s } })); } }

  // Scaling relative to the reference specimen (implied exponents): C7b mass, C2a lifting area, C8e wing loading, C9c v_min.
  const lr = num(s.SL_m) ? s.SL_m / REFERENCE.SL_m : null;
  const expo = (x, xref) => (lr && lr !== 1 && num(x) && x > 0) ? Math.log(x / xref) / Math.log(lr) : null;
  const band = (b, target) => b === null ? 'cannot-evaluate' : (Math.abs(b - target) <= s.exponentBand ? 'holds' : 'violated');
  { const b = expo(W, REFERENCE.mass_kg * s.g);
    out.push(result('C7b', lr === null ? 'cannot-evaluate' : lr === 1 ? 'cannot-evaluate' : band(b, 3), { lengthRatio: lr, impliedMassExponent: b, target: 3, band: s.exponentBand }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : W === null ? ['mass_kg'] : [], 'implied exponent log(W/W_ref)/log(SL/SL_ref) against the cube law; the band is the studio decision rule, not a theorem')); }
  { const b = expo(S, REFERENCE.liftingArea_m2);
    out.push(result('C2a', lr === null || lr === 1 ? 'cannot-evaluate' : band(b, 2), { lengthRatio: lr, impliedAreaExponent: b, target: 2, band: s.exponentBand }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : S === null ? ['finArea_m2'] : [], 'implied lifting-area exponent against isometry (2); Davenport 1992 measured 1.834 within one species')); }
  { const b = (W !== null && S !== null) ? expo(W / S, REFERENCE.mass_kg * s.g / REFERENCE.liftingArea_m2) : null;
    out.push(result('C8e', lr === null || lr === 1 ? 'cannot-evaluate' : band(b, 1), { lengthRatio: lr, impliedWingLoadingExponent: b, target: 1, band: s.exponentBand }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : [W === null ? 'mass_kg' : null, S === null ? 'finArea_m2' : null].filter(Boolean), 'implied wing-loading exponent against isometry (1); Davenport 1992 measured 1.236')); }
  { const vm = (W !== null && S !== null && num(s.CLmax)) ? vmin(W, S, s.rho, s.CLmax) : null, vref = vmin(REFERENCE.mass_kg * s.g, REFERENCE.liftingArea_m2, s.rho, REFERENCE.CLmax);
    const b = vm === null ? null : expo(vm, vref);
    out.push(result('C9c', lr === null || lr === 1 ? 'cannot-evaluate' : band(b, 0.5), { lengthRatio: lr, impliedVminExponent: b, target: 0.5, band: s.exponentBand, vmin_m_s: vm, vminReference_m_s: vref }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : vm === null ? ['mass_kg, finArea_m2, CLmax'] : [], 'implied v_min exponent against the isometric 1/2 (R4); with Davenport\\'s exponents the predicted value is 0.57')); }

  // C8c: Galileo's giant, needs a reference safety factor.
  { if (lr === null) out.push(result('C8c', 'cannot-evaluate', {}, ['SL_m']));
    else if (!num(s.referenceSafetyFactor)) out.push(result('C8c', 'cannot-evaluate', { lengthRatio: lr }, ['referenceSafetyFactor'], 'no breaking stress or section data exists for flying fish; a reference safety factor must be committed'));
    else { const sf = s.referenceSafetyFactor / lr; out.push(result('C8c', sf >= 1 ? 'holds' : 'violated', { lengthRatio: lr, referenceSafetyFactor: s.referenceSafetyFactor, scaledSafetyFactor: sf }, [], 'scaled safety factor = reference / length ratio under isometric sections and the same material (R7)', { needed: { safetyFactor: 1 }, available: { safetyFactor: sf } })); } }

  // C15: glide range.
  { const miss = []; for (const k of ['glideHeight_m', 'LD_max', 'glideDistance_m']) if (!num(s[k])) miss.push(k);
    if (miss.length) out.push(result('C15', 'cannot-evaluate', {}, miss));
    else { const bound = s.glideHeight_m * s.LD_max / (1 - s.groundEffect); out.push(result('C15', s.glideDistance_m <= bound ? 'holds' : 'violated', { glideHeight_m: s.glideHeight_m, LD_max: s.LD_max, groundEffect: s.groundEffect, bound_m: bound, glideDistance_m: s.glideDistance_m }, [], 'one steady unpowered glide; taxiing thrust, repeated touch-and-go and wind are outside the model', { needed: { glideDistance_m: s.glideDistance_m }, available: { glideRange_m: bound } })); } }

  // Power required and available, C16 climb, C14 aerobic.
  const LD = num(s.LD_max) ? s.LD_max : (num(s.LD) ? s.LD : null);
  const Preq = (W !== null && num(s.airspeed_m_s) && LD) ? W * s.airspeed_m_s / LD : (num(s.powerRequired_W) ? s.powerRequired_W : null);
  const Pavail = num(s.powerAvailable_W) ? s.powerAvailable_W : (num(s.flightMuscleFraction) && num(s.musclePowerPerKg_W) && num(s.mass_kg) ? s.flightMuscleFraction * s.musclePowerPerKg_W * s.mass_kg : null);
  { const miss = []; if (Preq === null) miss.push('airspeed_m_s and LD_max (or powerRequired_W)'); if (Pavail === null) miss.push('powerAvailable_W (or flightMuscleFraction and musclePowerPerKg_W: the muscle premise R6, a named hypothesis)'); if (!num(s.climbRate_m_s)) miss.push('climbRate_m_s'); if (W === null) miss.push('mass_kg');
    if (miss.length) out.push(result('C16', 'cannot-evaluate', { powerRequired_W: Preq, powerAvailable_W: Pavail }, miss));
    else { const bound = (Pavail - Preq) / W; out.push(result('C16', s.climbRate_m_s <= bound ? 'holds' : 'violated', { powerRequired_W: Preq, powerAvailable_W: Pavail, W_N: W, climbBound_m_s: bound, climbRate_m_s: s.climbRate_m_s }, [], Pavail !== null && !num(s.powerAvailable_W) ? 'P_avail formed from the muscle premise (f, p constant), which is a named hypothesis, not a theorem' : null, { needed: { power_W: Preq + W * s.climbRate_m_s }, available: { power_W: Pavail } })); } }
  { const miss = []; for (const k of ['efficiency', 'oxycaloric_J_per_unit_O2', 'cardiacOutput', 'arterialO2']) if (!num(s[k])) miss.push(k); if (Preq === null) miss.push('airspeed_m_s and LD_max (or powerRequired_W)');
    if (miss.length) out.push(result('C14', 'cannot-evaluate', { powerRequired_W: Preq, gillArea_m2: num(s.gillArea_m2) ? s.gillArea_m2 : null }, miss, num(s.gillArea_m2) ? 'gillArea_m2 given, but the gill-to-blood link (water O2 and gill area to arterial content) is not formalised; commit arterialO2 directly' : null));
    else { const supply = s.efficiency * s.oxycaloric_J_per_unit_O2 * s.cardiacOutput * s.arterialO2; const need = Preq + (num(s.climbRate_m_s) && W !== null ? W * s.climbRate_m_s : 0); out.push(result('C14', supply >= need ? 'holds' : 'violated', { aerobicCeiling_W: supply, powerRequired_W: Preq, climbPower_W: need - Preq, efficiency: s.efficiency }, [], s.efficiency > 1 ? 'efficiency above 1 violates the named hypothesis 0 <= eta <= 1; the result is not meaningful' : 'sustained (aerobic) mechanical ceiling eta E Q Ca against level-flight power W v/(L/D) plus W x climb rate if a climb is claimed (climb_le_aerobic); units must multiply to watts', { needed: { power_W: need }, available: { power_W: supply } })); } }

  // C13 and C10 need exponents across sizes, which a single spec does not carry.
  out.push(result('C13', 'cannot-evaluate', {}, ['fitted exponents for weight, area and wing loading with intervals'], 'a single design has no exponents; see the audit for the measured Davenport triple'));
  out.push(result('C10', 'cannot-evaluate', {}, ['the power-required exponent across sizes'], 'a single design has no exponent'));

  // Genotype rows: the genetic code, pleiotropy closure, developmental ordering and the two time budgets.
  for (const r of checkGenotype(s)) out.push(r);

  // Empirical rows, in their own band: each is conditional on an observation the reader may reject.
  const impliedMassExponent = (out.find(r => r.id === 'C7b') || {}).numbers?.impliedMassExponent ?? null;
  for (const r of checkEmpirical(s, { powerRequired_W: Preq, impliedMassExponent })) out.push(r);
  return out;
}
`;
fs.writeFileSync(path.join(here, 'browser-check.mjs'), out);
console.log(`lean/eliminate/browser-check.mjs: ${USED.length} constraints, reference ${REF.name}`);
