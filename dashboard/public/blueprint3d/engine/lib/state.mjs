// resolveState(organismDoc, ageDays, conditions, bundle) -> the STATE object scenarios consume.
//
// Pure ESM, no node-only imports (copied into the browser engine by dashboard/build-engine.mjs).
// Every field is { value, unit, kind, source } plus, where useful, weakest_input (the weakest kind
// among the inputs of a derived value), reason (why a value is null) and flags. A field the data do
// not support comes back value null, kind 'assumed', with a reason: never an invented number.
//
// Age scaling. Each reference organism the document descends from has a growth track
// (development/trajectory.mjs for flying fish, development/zebrafish/trajectory.mjs for zebrafish,
// sampled into the bundle) and the per-stage parameter overrides anatomy-model/parametric/stages.mjs
// derived from them. For a parameter p the value at age a is
//     p(a) = p_ref * SUM_leaf w_leaf * track_leaf(p, a) / track_leaf(p, refAge_leaf)
// i.e. the document's own (blended, edited) value is carried along each parent's measured
// ontogeny. Parameters with no ontogeny in a track are held at the reference-age value and flagged.
// Ages outside a track's range are clamped to it and flagged.
import { resolveParameters, partsOf, primaryManifest, weakest, mapKind } from './organism.mjs';

export const STATE_FIELDS = ['species', 'design_id', 'ageDays', 'stage', 'SL_m', 'mass_kg', 'body_density_kg_m3', 'wetted_area_m2',
  'frontal_area_m2', 'pectoral_area_both_m2', 'pectoral_span_m', 'caudal_area_m2', 'red_muscle_fraction', 'white_muscle_fraction',
  'gill_area_m2', 'hb_P50_kPa', 'has_swimbladder', 'temperature_C', 'ambient', 'parts'];
// Optional fields (added after v1; scenario modules declare them in `needs`). Same {value, unit, kind, source} shape.
export const STATE_FIELDS_OPTIONAL = ['lifting_area_m2', 'cardiac_output_max_ml_s', 'myotomal_muscle_fraction', 'swimbladder_volume_fraction', 'pcrit_kPa',
  'routine_metabolic_rate_umol_g_h', 'standard_metabolic_rate_umol_g_h', 'ucrit_m_s', 'o2_uptake_site', 'hb_needed_for_routine_O2'];
// The ambient keys (state.ambient.<key>, each {value, unit, kind, source}); extra caller conditions pass through.
export const AMBIENT_KEYS = ['medium', 'depth_m', 'altitude_m', 'salinity_psu', 'water_density_kg_m3', 'air_density_kg_m3', 'pressure_kPa', 'pO2_kPa', 'air_O2_fraction'];

const F = (value, unit, kind, source, extra = {}) => ({ value, unit, kind, source, ...extra });
const NULL = (unit, reason) => ({ value: null, unit, kind: 'assumed', source: 'none', reason });

// ---------------------------------------------------------------- interpolation helpers
function interp(rows, x, key) {
  if (x <= rows[0].ageDays) return rows[0][key];
  for (let i = 1; i < rows.length; i++) if (x <= rows[i].ageDays) {
    const a = rows[i - 1], b = rows[i];
    if (a[key] == null || b[key] == null) return null;
    return a[key] + (b[key] - a[key]) * (x - a.ageDays) / (b.ageDays - a.ageDays);
  }
  return rows.at(-1)[key];
}
function stageInterp(stages, x, param) {
  const rows = stages.filter(s => typeof s.parameters[param] === 'number').map(s => ({ ageDays: s.age_days, v: s.parameters[param] }));
  if (rows.length !== stages.length || rows.length < 2) return null; // not tracked at every stage -> no ontogeny
  return interp(rows, x, 'v');
}
const clampAge = (track, a) => Math.min(track.range_days[1], Math.max(track.range_days[0], a));

/** Value of one parameter on one track at one age, or null if the track has no ontogeny for it. */
function trackValue(track, param, age) {
  if (param === 'standard_length_m') return interp(track.dense, age, 'SL_m');
  if (param === 'body_mass_kg') return interp(track.dense, age, 'mass_kg');
  return stageInterp(track.stages, age, param);
}
function scalingKind(track, param, age, SL_m) {
  const k = track.kinds;
  if (param === 'standard_length_m') return age < (k.SL_m.early_below_days ?? -1) ? k.SL_m.early_kind : k.SL_m.kind;
  if (param === 'body_mass_kg') return k.mass_kg.kind;
  if (param.startsWith('pectoral_')) {
    if (k.fin.valid_SL_m && SL_m != null && (SL_m < k.fin.valid_SL_m[0] || SL_m > k.fin.valid_SL_m[1])) return k.fin.out_of_range_kind;
    return k.fin.kind;
  }
  return k.other.kind;
}

// ---------------------------------------------------------------- geometry helpers
// Lanczos gamma (g = 7, n = 9): a standard numerical approximation, used for the superellipse area.
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gamma(z) {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1; let x = LG[0]; for (let i = 1; i < 9; i++) x += LG[i] / (z + i);
  const t = z + 7.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}
/** Area of a superellipse |x/a|^n + |y/b|^n <= 1. */
export const superellipseArea = (a, b, n) => 4 * a * b * gamma(1 + 1 / n) ** 2 / gamma(1 + 2 / n);
/** Surface of an ellipsoid, Knud Thomsen's approximation (p = 1.6075, relative error <= 1.06 %). */
export function ellipsoidSurface(a, b, c) {
  const p = 1.6075;
  return 4 * Math.PI * Math.pow((Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3, 1 / p);
}
const pH2O = T => 0.61094 * Math.exp((17.625 * T) / (T + 243.04)); // Magnus form, as in physiology/index.js

// ---------------------------------------------------------------- ambient
/** conditions: { temperature_C, salinity_psu, depth_m, altitude_m, air_O2_fraction, medium, ...extra }.
 *  Unset values come from conditions/baseline.json (bundle.conditions). */
export function resolveAmbient(conditions = {}, bundle) {
  const base = bundle.conditions;
  const given = k => conditions[k] !== undefined && conditions[k] !== null;
  const T = given('temperature_C') ? conditions.temperature_C : base.water_temperature_C.value;
  const S = given('salinity_psu') ? conditions.salinity_psu : base.salinity_psu.value;
  const depth = given('depth_m') ? conditions.depth_m : 0;
  const alt = given('altitude_m') ? conditions.altitude_m : 0;
  const fO2 = given('air_O2_fraction') ? conditions.air_O2_fraction : base.air_O2_fraction.value;
  const medium = conditions.medium || (alt > 0 ? 'air' : 'water');
  const src = (k, b) => (given(k) ? 'scenario condition (set by the caller)' : `conditions/baseline.json ${b}`);
  // International Standard Atmosphere, troposphere (standard formula, not fetched); valid below 11 km.
  const isa = 1 - 2.25577e-5 * alt;
  const P_atm = 101.325 * Math.pow(isa, 5.25588);
  const rho_air_sl = base.air_density_kg_m3.value;
  const rho_air = rho_air_sl * Math.pow(isa, 4.2559);
  const rho_w = S > 0 ? bundle.physiology.seawater_density_kg_m3.value : 1000;
  const P = medium === 'water' ? P_atm + rho_w * 9.80665 * depth / 1000 : P_atm;
  const pO2 = fO2 * (P_atm - pH2O(T));
  const extra = {};
  for (const [k, v] of Object.entries(conditions)) if (!['temperature_C', 'salinity_psu', 'depth_m', 'altitude_m', 'air_O2_fraction', 'medium'].includes(k)) extra[k] = F(v, null, 'assumed', 'scenario condition (set by the caller), passed through unvalidated');
  return {
    temperature: F(T, 'degC', 'assumed', src('temperature_C', 'water_temperature_C (25 degC, assumed); body temperature = water temperature (ectotherm)')),
    ambient: {
      medium: F(medium, null, 'assumed', conditions.medium ? 'scenario condition' : 'water unless altitude_m > 0'),
      depth_m: F(depth, 'm', 'assumed', src('depth_m', '(surface)')),
      altitude_m: F(alt, 'm', 'assumed', src('altitude_m', '(sea level)')),
      salinity_psu: F(S, 'psu', 'assumed', src('salinity_psu', 'salinity_psu (35, assumed)')),
      water_density_kg_m3: F(rho_w, 'kg/m3', 'assumed', bundle.physiology.seawater_density_kg_m3.source),
      air_density_kg_m3: F(rho_air, 'kg/m3', alt ? 'derived' : 'assumed', alt ? `ISA troposphere rho = ${rho_air_sl} (1 - 2.25577e-5 h)^4.2559 (standard formula, not fetched); valid below 11 km` : 'conditions/baseline.json air_density_kg_m3 (1.225, assumed)', alt > 11000 ? { flags: ['altitude above 11 km: ISA troposphere formula out of range'] } : {}),
      pressure_kPa: F(P, 'kPa', 'derived', medium === 'water' ? 'ISA surface pressure + rho_water g depth (hydrostatics)' : 'ISA troposphere P = 101.325 (1 - 2.25577e-5 h)^5.25588 (standard formula)'),
      pO2_kPa: F(pO2, 'kPa', 'derived', 'air_O2_fraction x (P_atm - pH2O(T)); for water, the O2 tension of surface water in equilibrium with air (as physiology/index.js). Hydrostatic pressure does not raise dissolved pO2 in an open water column; stratified or hypoxic water is not modelled.'),
      air_O2_fraction: F(fO2, '-', 'assumed', src('air_O2_fraction', 'air_O2_fraction (0.209)')),
      ...extra,
    },
  };
}

// ---------------------------------------------------------------- stage shrink -> part scales
const SHRINK_PARTS = {
  pectoral_rays: id => /^pectoral_fin_ray_/.test(id),
  pectoral_membrane: id => /^pectoral_fin_[LR]$/.test(id),
  pelvic: id => /^pelvic_fin/.test(id),
  dorsal: id => /^dorsal_fin/.test(id),
  anal: id => /^anal_fin/.test(id),
  caudal: id => /^caudal_fin/.test(id),
  gonad: id => /^gonad_/.test(id),
  swim_bladder: id => id === 'swim_bladder',
  pectoral_muscle: id => /^pectoral_muscle_/.test(id),
};
function stageAt(track, age) {
  let s = track.stages[0];
  for (const x of track.stages) if (x.age_days <= age) s = x;
  return s;
}

// ---------------------------------------------------------------- resolveState
export function resolveState(doc, ageDays, conditions = {}, bundle, opts = {}) {
  const R = resolveParameters(bundle, doc);
  const flags = [];
  const leafList = Object.entries(R.leaves).map(([id, w]) => {
    const o = bundle.organisms[id];
    return { id, w, o, track: bundle.tracks[o.track] };
  });
  const dominant = leafList.slice().sort((a, b) => b.w - a.w)[0];
  const age = ageDays == null ? dominant.o.ref_age_days : Number(ageDays);
  if (!Number.isFinite(age)) throw new Error('ageDays must be a number (days after hatching)');
  for (const L of leafList) {
    const c = clampAge(L.track, age);
    if (c !== age) flags.push(`age ${age} d is outside the ${L.o.track} growth data (${L.track.range_days.join('-')} d after hatching); clamped to ${c} d. Eggs and embryos (negative ages) are not modelled.`);
  }

  // Age-scale every parameter.
  const P = {};
  for (const [k, e] of Object.entries(R.params)) {
    if (e.value == null) { P[k] = e; continue; }
    if (/_count$/.test(k)) { P[k] = e; continue; } // counts do not scale with age here
    let factor = 0, tracked = true; const kinds = [];
    for (const L of leafList) {
      const a = clampAge(L.track, age), ra = clampAge(L.track, L.o.ref_age_days);
      const v = trackValue(L.track, k, a), v0 = trackValue(L.track, k, ra);
      if (v == null || v0 == null || v0 === 0) { tracked = false; break; }
      factor += L.w * (v / v0);
      if (a !== ra) kinds.push(scalingKind(L.track, k, a, interp(L.track.dense, a, 'SL_m')));
    }
    if (!tracked) {
      P[k] = { ...e, flags: [`no ontogeny for ${k} in every parent's growth track: held at the reference-age value`] };
      continue;
    }
    P[k] = Math.abs(factor - 1) < 1e-12 ? e
      : { value: e.value * factor, kind: weakest(e.kind, kinds), source: `${e.source} || age-scaled x${factor.toPrecision(4)} along ${leafList.map(L => `${L.o.track} (w ${L.w})`).join(' + ')}`, ...(e.edited ? { edited: true } : {}) };
  }
  const val = k => P[k]?.value;
  const SL = val('standard_length_m'), M = val('body_mass_kg');
  const stageRow = { stage: interpStage(dominant.track, clampAge(dominant.track, age)) };
  const disagree = new Set(leafList.map(L => interpStage(L.track, clampAge(L.track, age))));
  const singleTrack = new Set(leafList.map(L => L.o.track)).size === 1;
  // Each parent's own species SL at this age: the position on its ontogeny (ONTOGENY.md rule 1).
  for (const L of leafList) L.SLsp = interp(L.track.dense, clampAge(L.track, age), 'SL_m');

  // Part scales: stage shrink (dominant track) x engine 'scale' edits; partedit geometric edits listed per part.
  const parts = {};
  const shrink = stageAt(dominant.track, clampAge(dominant.track, age)).shrink || {};
  for (const pid of partsOf(bundle, doc).keys()) {
    let s = 1;
    for (const [key, match] of Object.entries(SHRINK_PARTS)) if (typeof shrink[key] === 'number' && match(pid)) s *= shrink[key];
    const vm = /^vertebra_(\d+)$/.exec(pid);
    if (vm && typeof shrink.vertebrae_formed === 'number' && Number(vm[1]) > shrink.vertebrae_formed) s *= shrink.vertebra_unformed ?? 1;
    const edit = R.partScale[pid];
    const geo = R.geometry.filter(g => g.parts.includes(pid)).map(g => ({ param: g.param, mode: g.mode, op: g.op, value: g.value, unit: g.unit }));
    parts[pid] = { scale: s * (edit ?? 1), stage_scale: s, ...(edit != null ? { edit_scale: edit } : {}), ...(geo.length ? { geometry: geo } : {}) };
  }
  const ps = id => parts[id]?.edit_scale ?? 1;

  const kOf = k => P[k]?.kind || 'assumed';
  const out = {};
  const geomFlags = [];
  out.species = F(leafList.map(L => `${L.o.species}${leafList.length > 1 ? ` (w ${L.w})` : ''}`).join(' + '), null, 'derived', 'organism document base parents, reduced to reference organisms', leafList.length > 1 ? { flags: ['blend of several species: ' + R.caveat] } : {});
  out.design_id = F(doc.id, null, 'derived', 'organism document id');
  out.ageDays = F(age, 'days after hatching', 'assumed', 'requested age', flags.length ? { flags: flags.slice() } : {});
  out.stage = F(stageRow.stage, null, dominant.track.kinds.other.kind, `${dominant.track.source} (stage of the dominant parent, ${dominant.id})`, disagree.size > 1 ? { flags: [`parents disagree on stage at this age: ${[...disagree].join(' / ')}`] } : {});
  out.SL_m = F(SL, 'm', kOf('standard_length_m'), P.standard_length_m.source);
  const massFlags = [];
  if (leafList.some(L => L.o.track === 'zebrafish' && L.SLsp < 0.015) && bundle.ontogeny?.conflicts?.zf_mass_larval) massFlags.push('UPPER BOUND for larvae: ' + bundle.ontogeny.conflicts.zf_mass_larval);
  out.mass_kg = F(M, 'kg', kOf('body_mass_kg'), P.body_mass_kg.source, massFlags.length ? { flags: massFlags } : {});

  const depth = val('body_depth_over_SL') * SL, width = val('body_width_over_SL') * SL, n = val('body_section_exponent');
  const geomKinds = ['standard_length_m', 'body_depth_over_SL', 'body_width_over_SL'].map(kOf);
  const shapeEdited = ['standard_length_m', 'body_depth_over_SL', 'body_width_over_SL', 'body_section_exponent'].some(k => P[k]?.edited);

  // ---- ontogeny.json (sim-engine/params/ontogeny.json, rule: params/ONTOGENY.md "Interpolation rule")
  const onto = (field, opt = {}) => ontogenyField(bundle.ontogeny, leafList, field, opt);
  const choose = (field, engine, ontoRec, why) => {
    // ontogeny wins when it has a value and the engine's is null or weaker; the loser is kept in `alternative`
    if (!ontoRec || ontoRec.value === null) return ontoRec && engine.value !== null ? { ...engine, ontogeny: { value: null, reason: ontoRec.reason } } : engine;
    const rank = k => KIND_RANK.indexOf(k);
    if (engine.value === null || rank(ontoRec.kind) > rank(engine.weakest_input || engine.kind)) return { ...ontoRec, source_choice: `ontogeny.json over the engine (${engine.value === null ? 'engine value null' : `engine ${engine.weakest_input || engine.kind} is weaker`}); ${why}`, alternative: { value: engine.value, kind: engine.kind, source: engine.source } };
    return { ...engine, source_choice: `engine kept: ontogeny.json is not stronger (${ontoRec.kind})`, alternative: { value: ontoRec.value, kind: ontoRec.kind, source: ontoRec.source } };
  };
  const NO_DENSITY = NULL('kg/m3', 'no measured whole-body density in the repository for this organism at this size (ontogeny.json searched); not invented. Set it with an edit (body, body_density_kg_m3) to run buoyancy-dependent scenarios.');
  out.body_density_kg_m3 = choose('body_density_kg_m3', NO_DENSITY, onto('body_density_kg_m3'), 'density is intensive, so a sourced value transfers to an edited shape');

  const wet = F(ellipsoidSurface(SL / 2, depth / 2, width / 2), 'm2', 'derived',
    'body idealised as an ellipsoid with axes SL, max depth, max width (Knud Thomsen surface approximation, <=1.06 % for the ellipsoid); fins excluded. The ellipsoid idealisation, not the formula, is the main error.',
    { weakest_input: weakest(geomKinds) });
  out.wetted_area_m2 = choose('wetted_area_m2', wet, singleTrack && !shapeEdited ? onto('wetted_area_m2', { area: SL }) : null, 'unedited body shape; area scaled by (SL/SL_species)^2');
  const front = F(superellipseArea(depth / 2, width / 2, n), 'm2', 'derived',
    'maximum cross-section as a superellipse with semi-axes depth/2, width/2 and exponent body_section_exponent', { weakest_input: weakest([...geomKinds, kOf('body_section_exponent')]) });
  out.frontal_area_m2 = choose('frontal_area_m2', front, singleTrack && !shapeEdited ? onto('frontal_area_m2', { area: SL }) : null, 'unedited body shape; area scaled by (SL/SL_species)^2');

  // Pectoral fins: parameter model x engine 'scale' x partedit geometric factors (per fin).
  const fin = { pectoral_fin_L: { A: ps('pectoral_fin_L') ** 2, S: ps('pectoral_fin_L') }, pectoral_fin_R: { A: ps('pectoral_fin_R') ** 2, S: ps('pectoral_fin_R') } };
  const gill = { gills_L: ps('gills_L') ** 2, gills_R: ps('gills_R') ** 2 };
  const paParam = val('pectoral_area_over_SL2') * SL * SL;
  let caudalGeom = false;
  for (const g of R.geometry) for (const pid of g.parts) {
    if (fin[pid] && g.pe_kind === 'fin') {
      let s;
      if (g.op === 'scale') s = g.value;
      else if (g.param === 'area') { const cur = (paParam / 2) * fin[pid].A; s = (g.op === 'set' ? g.value : cur + g.value) / cur; geomFlags.push(`${g.tag}: '${g.op}' area converted to a factor against STATE's parameter-model fin area; partedit converts against the mesh area, which differs by the manifest's mesh/parameter ratio`); }
      else { geomFlags.push(`${g.tag}: '${g.op}' ${g.param} in metres needs the mesh (partedit measurePart); STATE not updated for it`); continue; }
      const f = fin[pid];
      if (g.param === 'length') { f.S *= s; f.A *= s; }
      else if (g.param === 'width') { f.A *= s; }
      else if (g.param === 'area') { f.A *= s; if (g.mode !== 'span') f.S *= Math.sqrt(s); }
      else if (g.param === 'span') { f.S *= s; if (g.mode === 'aspect') f.A *= s * s; else if (g.mode === 'chord') f.A *= s; }
    }
    if (gill[pid] !== undefined && g.param === 'volume') {
      if (g.op === 'scale') { gill[pid] *= g.value ** (2 / 3); geomFlags.push(`${g.tag}: gill area x volume factor^(2/3) (shape-preserving scaling assumed)`); }
      else geomFlags.push(`${g.tag}: '${g.op}' volume needs the mesh; gill area not updated`);
    }
    if (/^caudal_fin/.test(pid)) caudalGeom = true;
  }
  const mA = (fin.pectoral_fin_L.A + fin.pectoral_fin_R.A) / 2, mS = (fin.pectoral_fin_L.S + fin.pectoral_fin_R.S) / 2;
  const finEdited = mA !== 1 || mS !== 1;
  const measured = opts.measured || {};
  out.pectoral_area_both_m2 = typeof measured.pectoral_area_both_m2 === 'number'
    ? F(measured.pectoral_area_both_m2, 'm2', 'derived', 'measured on the edited mesh by dashboard/public/blueprint3d/partedit.js measurePart (passed in by the caller)')
    : F(paParam * mA, 'm2', 'derived', 'pectoral_area_over_SL2 x SL^2 (membrane area of BOTH fins, the Park & Choi convention)' + (finEdited ? ` x mean per-fin area factor ${mA.toPrecision(4)} from part edits` : ''), { weakest_input: weakest(kOf('pectoral_area_over_SL2'), kOf('standard_length_m')) });
  out.pectoral_span_m = typeof measured.pectoral_span_m === 'number'
    ? F(measured.pectoral_span_m, 'm', 'derived', 'measured on the edited mesh by partedit.js measurePart (passed in by the caller)')
    : F(val('pectoral_span_over_SL') * SL * mS, 'm', 'derived', 'pectoral_span_over_SL x SL (tip to tip)' + (finEdited ? ` x mean per-fin span factor ${mS.toPrecision(4)} (ignores the body width between the fin bases)` : ''), { weakest_input: weakest(kOf('pectoral_span_over_SL'), kOf('standard_length_m')) });
  const caudalEdited = caudalGeom || ['caudal_upper_lobe_over_SL', 'caudal_lower_lobe_over_SL'].some(k => P[k]?.edited) || (parts.caudal_fin?.edit_scale ?? 1) !== 1;
  const NO_CAUDAL = NULL('m2', 'the parametric model carries caudal lobe LENGTHS only and ontogeny.json has no value at this size; not invented from lobe lengths.');
  out.caudal_area_m2 = caudalEdited ? NULL('m2', 'the caudal fin is edited; the sourced area (ontogeny.json) describes the unedited fin, and nothing here recomputes it') : choose('caudal_area_m2', NO_CAUDAL, singleTrack && !shapeEdited ? onto('caudal_area_m2', { area: SL }) : null, 'unedited caudal fin; area scaled by (SL/SL_species)^2');

  const red = bundle.physiology.red_fraction_of_myotome;
  const redOnto = onto('red_muscle_fraction');
  out.red_muscle_fraction = F(red.value, '- (of myotomal muscle mass)', 'borrowed', `${red.source} [${red.species}; ${red.module}]; used for this organism without a measurement in it`,
    redOnto && redOnto.value === null ? { flags: [`ontogeny.json: ${redOnto.reason}. The adult trout value is borrowed across stage as well as species.`] } : {});
  const gpk = bundle.physiology.gill_area_m2_per_kg;
  const gs = (gill.gills_L + gill.gills_R) / 2;
  out.gill_area_m2 = F(gpk.value * M * gs, 'm2', 'borrowed', `${gpk.source} [${gpk.module}], applied per kg (isometric in mass, an assumption: gill area usually scales below M^1)${gs !== 1 ? `; x mean gill area factor ${gs.toPrecision(4)} from part edits` : ''}`, { weakest_input: weakest('borrowed', kOf('body_mass_kg')) });
  const hb = bundle.physiology.hb_P50_kPa;
  const hbOnto = onto('hb_P50_kPa');
  out.hb_P50_kPa = F(hb.value, 'kPa', 'borrowed', `${hb.source} [${hb.species}; ${hb.module}]`, hbOnto && hbOnto.value === null ? { flags: [`ontogeny.json: ${hbOnto.reason}`] } : {});

  // Swim bladder: zebrafish by the measured size threshold (ONTOGENY.md rule 3), else the track's flag.
  const sbPart = parts.swim_bladder ? (parts.swim_bladder.edit_scale ?? 1) : 0;
  const zfLeaf = leafList.find(L => L.o.track === 'zebrafish');
  const thr = bundle.ontogeny?.species?.zebrafish?.size_thresholds_SL_m?.find(t => /posterior swim bladder inflation/.test(t.event));
  let sb, sbKind, sbSrc;
  if (singleTrack && zfLeaf && thr) { sb = zfLeaf.SLsp >= thr.SL_m; sbKind = 'measured'; sbSrc = `ontogeny.json size threshold: ${thr.event} at SL ${thr.SL_m} m (${thr.source.cite}, ${thr.source.locator}); species SL here ${zfLeaf.SLsp.toFixed(5)} m`; }
  else { sb = interpBool(dominant.track, clampAge(dominant.track, age)); sbKind = dominant.track.kinds.swimbladder.kind; sbSrc = dominant.track.kinds.swimbladder.source; }
  out.has_swimbladder = F(sb && sbPart > 0, 'bool', sbPart === 0 && parts.swim_bladder ? 'assumed' : sbKind, `${sbSrc}; and the part is present in the manifest${sbPart === 0 && parts.swim_bladder ? ' (removed by a part edit, scale 0)' : ''}`);

  // ---- fields scenario modules declare in `needs` (optional STATE fields)
  out.lifting_area_m2 = liftingArea(bundle, doc, P, SL, paParam * mA, measured, kOf);
  const qmax = bundle.physiology.cardiac_Q_max_ml_min_kg;
  out.cardiac_output_max_ml_s = F(qmax.value * M / 60, 'ml/s', 'borrowed', `${qmax.source} [${qmax.species}; ${qmax.module}] x mass / 60; per-kg transfer to this organism and size assumed`, { weakest_input: weakest('borrowed', kOf('body_mass_kg')) });
  out.myotomal_muscle_fraction = NULL('- (of body mass)', `no fetched value: physiology/index.js uses an unsourced placeholder (${bundle.physiology.axial_muscle_fraction_placeholder.value}, assumed) and ontogeny.json has none. Not passed off as data; set it with an edit if a scenario needs it.`);
  const sbv = bundle.ontogeny?.species?.zebrafish?.stages?.find(s => s.key === 'stage_180d')?.fields?.body_density_kg_m3;
  out.swimbladder_volume_fraction = singleTrack && zfLeaf && stageRow.stage === 'adult' && out.has_swimbladder.value && sbv && /swim bladder 5\.1/.test(sbv.note || '')
    ? F(0.051, '- (of body volume)', 'measured', `Robertson et al. 2008 J Morphol 269:666-673 (doi 10.1002/jmor.10610): swim bladder 5.1 +/- 1.4 % of body volume in adult zebrafish, as quoted in ontogeny.json stage_180d body_density note`, { range: [0.037, 0.065] })
    : NULL('- (of body volume)', zfLeaf ? 'measured only for adult zebrafish (Robertson 2008); not at this stage or for this design' : 'no swim-bladder volume measurement for this organism (ontogeny.json)');
  out.pcrit_kPa = NULL('kPa', 'not in ontogeny.json or physiology/: no critical O2 tension was fetched for zebrafish or flying fish');
  const rmr = routineMR(bundle.ontogeny, leafList, age, M, onto, singleTrack);
  out.routine_metabolic_rate_umol_g_h = rmr;
  out.standard_metabolic_rate_umol_g_h = onto('standard_metabolic_rate') || NULL('umol O2 g-1 h-1', 'no ontogeny row for this organism');
  out.ucrit_m_s = ucrit(onto, leafList, stageRow.stage, bundle.ontogeny);
  out.o2_uptake_site = onto('o2_uptake_site', { category: true }) || NULL(null, 'no ontogeny row for this organism');
  out.hb_needed_for_routine_O2 = onto('hb_needed_for_routine_O2', { category: true }) || NULL('bool', 'no ontogeny row for this organism');
  if (geomFlags.length) out.pectoral_area_both_m2 = { ...out.pectoral_area_both_m2, flags: [...(out.pectoral_area_both_m2.flags || []), ...geomFlags] };

  // State-level overrides from edits, applied in order.
  for (const [field, list] of Object.entries(R.overrides)) {
    let cur = out[field];
    for (const o of list) {
      if (o.op !== 'set' && (cur.value == null || typeof cur.value !== 'number')) throw new Error(`cannot ${o.op} ${field}: it has no numeric value (use op 'set')`);
      const v = o.op === 'set' ? o.value : o.op === 'scale' ? cur.value * o.value : cur.value + o.value;
      cur = F(v, cur.unit, 'assumed', `${o.source} (was ${cur.value}, ${cur.kind})`, { edited: true });
    }
    out[field] = cur;
  }
  out.white_muscle_fraction = out.red_muscle_fraction.value == null ? NULL('-', 'red fraction unknown')
    : F(1 - out.red_muscle_fraction.value, '- (of myotomal muscle mass)', 'derived', '1 - red_muscle_fraction: two fibre types only; pink/intermediate fibres are not separated', { weakest_input: out.red_muscle_fraction.kind });

  const amb = resolveAmbient(conditions, bundle);
  out.temperature_C = amb.temperature;
  out.ambient = amb.ambient;
  out.parts = parts;

  // Anything that came back non-finite is a bug or a missing input: surface it as null, never NaN.
  for (const k of [...STATE_FIELDS, ...STATE_FIELDS_OPTIONAL]) {
    const f = out[k];
    if (f && typeof f.value === 'number' && !Number.isFinite(f.value)) out[k] = NULL(f.unit, `computed a non-finite value from its inputs (${f.source})`);
  }
  // Taxon for law scoping (lib/lean-scope.mjs): the parents' taxon, or for a blend of different taxa the lowest
  // common one. For the project's organisms (flying fish, zebrafish) that is Teleostei.
  const taxa = [...new Set(leafList.map(L => L.o.taxon).filter(Boolean))];
  const taxon = taxa.length === 1 ? taxa[0] : 'Teleostei';
  return {
    ...out,
    _meta: { parameters: P, recorded_only_edits: R.recorded, flags, caveat: R.caveat, leaves: R.leaves, taxon, taxon_note: taxa.length > 1 ? `blend of ${taxa.join(' + ')}: lowest common taxon Teleostei, so laws scoped to one family are out of scope` : null },
  };
}


// ---------------------------------------------------------------- ontogeny.json (params/ONTOGENY.md)
// Weakest-first, the order ONTOGENY.md rule 5 and lib/envelope.mjs use.
const KIND_RANK = ['assumed', 'borrowed', 'calibrated', 'derived', 'measured-secondhand', 'measured'];
const weakestOnto = (a, b) => KIND_RANK[Math.min(KIND_RANK.indexOf(a), KIND_RANK.indexOf(b))] || 'assumed';
const ONTO_SPECIES = { 'flying-fish': 'flying_fish', zebrafish: 'zebrafish' };
// Interpolated in ln y vs ln SL (rule 2); everything else numeric is linear in SL (density, fractions, Ucrit).
const LOG_FIELDS = new Set(['mass_kg', 'wetted_area_m2', 'frontal_area_m2', 'pectoral_area_both_m2', 'pectoral_span_m', 'caudal_area_m2', 'gill_area_m2', 'routine_metabolic_rate', 'standard_metabolic_rate']);
const srcOf = (row, f) => (f.source ? `ontogeny.json ${row.key}: ${f.source.cite || f.source.id}${f.source.locator ? ` (${f.source.locator})` : ''}${f.source.doi_or_url ? ` <${f.source.doi_or_url}>` : ''}` : `ontogeny.json ${row.key}`);

/** One field for one species at species-SL x, by ONTOGENY.md: piecewise in SL, nulls never bridged, no
 *  extrapolation beyond the first/last row, ranges carried as [lo, hi] with a derived midpoint. */
export function ontogenyAt(onto, track, field, x, { category = false } = {}) {
  const sp = onto?.species?.[ONTO_SPECIES[track]];
  if (!sp) return null;
  const rows = sp.stages.map(s => ({ key: s.key, SL: s.fields.SL_m?.value, f: s.fields[field] })).filter(r => r.f !== undefined && typeof r.SL === 'number').sort((a, b) => a.SL - b.SL);
  if (!rows.length) return null;
  const tol = 1e-3;
  const unit = rows[0].f.unit ?? null;
  const nul = reason => ({ value: null, unit, kind: 'assumed', source: 'none', reason: `ontogeny.json: ${reason}` });
  if (x < rows[0].SL * (1 - tol) || x > rows.at(-1).SL * (1 + tol)) return nul(`SL ${x.toPrecision(4)} m is outside its rows (${rows[0].SL}-${rows.at(-1).SL} m); not extrapolated`);
  const exact = rows.find(r => Math.abs(r.SL - x) <= tol * r.SL);
  const asField = (row, f) => {
    if (f.value === null) return nul(f.reason || 'null');
    if (Array.isArray(f.value)) return { value: (f.value[0] + f.value[1]) / 2, unit, kind: 'derived', source: srcOf(row, f), range: f.value.slice(), weakest_input: f.kind, note: 'midpoint of a reported range (ONTOGENY.md rule 2)' };
    return { value: f.value, unit, kind: f.kind, source: srcOf(row, f), ...(f.note ? { note: f.note } : {}) };
  };
  if (exact) return asField(exact, exact.f);
  let i = 0; while (i < rows.length - 2 && rows[i + 1].SL < x) i++;
  const a = rows[i], b = rows[i + 1];
  if (a.f.value === null || b.f.value === null) {
    const near = Math.abs(Math.log(x / a.SL)) <= Math.abs(Math.log(b.SL / x)) ? a : b;
    const other = near === a ? b : a;
    return nul(`not bridged between ${a.key} and ${b.key}: ${(near.f.value === null ? near : other).f.reason || 'null row'}`);
  }
  if (category || typeof a.f.value !== 'number' && !Array.isArray(a.f.value)) {
    return { ...asField(a, a.f), note: `step function: value of the lower row ${a.key} (ONTOGENY.md rule 3)` };
  }
  const lin = (ya, yb) => (LOG_FIELDS.has(field) && ya > 0 && yb > 0)
    ? ya * Math.pow(x / a.SL, Math.log(yb / ya) / Math.log(b.SL / a.SL))
    : ya + (yb - ya) * (x - a.SL) / (b.SL - a.SL);
  const lo = v => (Array.isArray(v) ? v[0] : v), hi = v => (Array.isArray(v) ? v[1] : v);
  const kind = weakestOnto(a.f.kind, b.f.kind);
  const source = `${srcOf(a, a.f)} | ${srcOf(b, b.f)}; interpolated ${LOG_FIELDS.has(field) ? 'as a power law in SL' : 'linearly in SL'} (ONTOGENY.md rule 2)`;
  if (Array.isArray(a.f.value) || Array.isArray(b.f.value)) {
    const r = [lin(lo(a.f.value), lo(b.f.value)), lin(hi(a.f.value), hi(b.f.value))];
    return { value: (r[0] + r[1]) / 2, unit, kind: 'derived', source, range: r, weakest_input: kind };
  }
  return { value: lin(a.f.value, b.f.value), unit, kind, source };
}

/** Combine across a document's reference parents. opt.area: the document's SL, for an extensive (area)
 *  field on a single-species document, scaled by (SL/SL_species)^2. Intensive fields: weighted mean, null
 *  if any parent has none. Returns null when ontogeny.json has nothing for this organism or field. */
function ontogenyField(onto, leafList, field, opt = {}) {
  if (!onto) return null;
  const recs = leafList.map(L => ({ L, r: ontogenyAt(onto, L.o.track, field, L.SLsp, opt) }));
  if (recs.every(x => x.r === null)) return null;
  const missing = recs.find(x => !x.r || x.r.value === null);
  if (missing) return { value: null, unit: recs.find(x => x.r)?.r.unit ?? null, kind: 'assumed', source: 'none', reason: missing.r ? missing.r.reason : `ontogeny.json has no ${field} for ${missing.L.id}` };
  if (recs.length === 1) {
    const { L, r } = recs[0];
    if (opt.area && typeof r.value === 'number') { const k = (opt.area / L.SLsp) ** 2; return Math.abs(k - 1) < 1e-9 ? r : { ...r, value: r.value * k, kind: 'derived', weakest_input: r.weakest_input || r.kind, source: `${r.source}; x (SL ${opt.area.toPrecision(4)} / species SL ${L.SLsp.toPrecision(4)})^2, isometric` }; }
    return r;
  }
  if (recs.some(x => typeof x.r.value !== 'number')) return { ...recs.sort((p, q) => q.L.w - p.L.w)[0].r, note: 'category from the dominant parent' };
  return { value: recs.reduce((s, x) => s + x.L.w * x.r.value, 0), unit: recs[0].r.unit, kind: 'derived', weakest_input: recs.map(x => x.r.weakest_input || x.r.kind).reduce(weakestOnto),
    source: `weighted mean over parents: ${recs.map(x => `${x.L.w} x [${x.r.source}]`).join(' + ')}` };
}

/** Routine metabolic rate: the allometric equation where valid (ONTOGENY.md rule 2, "prefer the equation"),
 *  else the rows. umol O2 g-1 h-1. */
function routineMR(onto, leafList, age, M, onto1, singleTrack) {
  const unit = 'umol O2 g-1 h-1';
  if (singleTrack && leafList[0].o.track === 'zebrafish' && onto) {
    const eq = onto.species.zebrafish.allometries?.find(a => /rMO2/.test(a.y));
    const dpf = age + 2, mg = M * 1e6;
    if (eq && dpf >= eq.valid.age_dpf[0] && dpf <= eq.valid.age_dpf[1] && mg >= eq.valid.mass_mg[0] && mg <= eq.valid.mass_mg[1]) {
      const perFish = eq.a * Math.pow(mg, eq.b); // nmol O2 h-1
      return { value: perFish / mg, unit, kind: 'derived', source: `rMO2 = ${eq.a} M^${eq.b} nmol/h (M in mg), ${eq.source.cite} (${eq.source.locator}); divided by M -> umol g-1 h-1`, weakest_input: eq.kind,
        flags: [`equation fitted on Bouin-fixed mass at ${eq.valid.temperature_C} C; this STATE's mass is the live-mass law (an upper bound for larvae, ontogeny.json conflicts), and nothing is temperature-corrected`] };
    }
  }
  return onto1('routine_metabolic_rate') || { value: null, unit, kind: 'assumed', source: 'none', reason: 'no ontogeny row for this organism' };
}

/** Ucrit: the rows; adults hold the adult value (Plaut 2000: independent of SL within adults). */
function ucrit(onto1, leafList, stage, onto) {
  const r = onto1('Ucrit_m_s');
  if (r && r.value !== null) return r;
  if (stage === 'adult' && leafList.length === 1 && onto) {
    const sp = onto.species[ONTO_SPECIES[leafList[0].o.track]];
    const last = sp?.stages.at(-1);
    const f = last?.fields?.Ucrit_m_s;
    if (f && typeof f.value === 'number') return { value: f.value, unit: f.unit, kind: f.kind, source: srcOf(last, f), flags: ['adult Ucrit held constant across adult sizes (ONTOGENY.md rule 2: independent of SL within adults, Plaut 2000); protocol-dependent, about 2x (ontogeny.json conflicts)'] };
  }
  return r || { value: null, unit: 'm/s', kind: 'assumed', source: 'none', reason: 'no ontogeny row for this organism' };
}

/** Lifting area in the physics/flier convention (pectoral + pelvic + caudal membrane), from the mesh.
 *  The primary manifest's derived_from_the_mesh gives the area measured on the built adult mesh. The
 *  pectoral part follows STATE's pectoral area (mesh/parameter ratio of the reference build carried over);
 *  pelvic + caudal scale isometrically with SL (an assumption). A caller with a real measurePart result
 *  passes it as opts.measured.lifting_area_m2. */
function liftingArea(bundle, doc, P, SL, paState, measured, kOf) {
  const unit = 'm2';
  if (typeof measured.lifting_area_m2 === 'number') return { value: measured.lifting_area_m2, unit, kind: 'derived', source: 'measured on the edited mesh by partedit.js measurePart (pectoral + pelvic + caudal), passed in by the caller' };
  const man = primaryManifest(bundle, doc);
  const d = man?.derived_from_the_mesh || {};
  const SLm = man?.parameters?.standard_length_m;
  const ref = bundle.organisms[man?.organism]?.parameters;
  if (!(d.lifting_area_m2 > 0 && d.pectoral_area_both_m2 > 0 && SLm > 0 && ref)) return { value: null, unit, kind: 'assumed', source: 'none', reason: 'the manifest has no mesh-measured lifting area (derived_from_the_mesh); not invented' };
  const paRefParam = ref.pectoral_area_over_SL2.value * SLm * SLm;
  const kMesh = d.pectoral_area_both_m2 / paRefParam;
  const other = (d.lifting_area_m2 - d.pectoral_area_both_m2) * (SL / SLm) ** 2;
  const pect = paState * kMesh;
  return { value: pect + other, unit, kind: 'derived', weakest_input: 'assumed', components: { pectoral_m2: pect, pelvic_plus_caudal_m2: other },
    source: `mesh-measured lifting area of ${man.file} (${d.lifting_area_m2} m2 at SL ${SLm} m; pectoral ${d.pectoral_area_both_m2} m2 on the mesh, ${kMesh.toPrecision(4)} x the parameter value): pectoral = STATE pectoral area x that ratio; pelvic + caudal scaled by (SL/${SLm})^2, isometric (assumed). Convention pectoral + pelvic + caudal (physics/flier), NOT the Lean reference's pectoral + pelvic + body planform.` };
}

function interpStage(track, age) { let s = track.dense[0].stage; for (const r of track.dense) if (r.ageDays <= age) s = r.stage; return s; }
function interpBool(track, age) { let s = track.dense[0].swimbladder; for (const r of track.dense) if (r.ageDays <= age) s = r.swimbladder; return s; }

/** The stage ages a timecourse should visit: the union of every parent's stages.json ages. */
export function stageAges(bundle, doc) {
  const R = resolveParameters(bundle, doc);
  const set = new Map();
  for (const id of Object.keys(R.leaves)) {
    const t = bundle.tracks[bundle.organisms[id].track];
    for (const s of t.stages) if (!set.has(s.age_days)) set.set(s.age_days, { ageDays: s.age_days, key: s.key, label: s.label, track: bundle.organisms[id].track });
  }
  return [...set.values()].sort((a, b) => a.ageDays - b.ageDays);
}

/** The spec lean/eliminate/browser-check.mjs reads, built only from non-null state fields. */
export function leanSpec(state) {
  const s = {};
  const put = (k, f) => { if (f && typeof f.value === 'number' && Number.isFinite(f.value)) s[k] = f.value; };
  put('SL_m', state.SL_m); put('mass_kg', state.mass_kg);
  // NOT passed: pectoral area. browser-check compares the LIFTING area (pectoral + pelvic + body planform)
  // with the reference specimen's; STATE has no pelvic or planform area, so passing pectoral area alone
  // would manufacture area-law violations (C2a, C8e). Those laws therefore come back cannot-evaluate.
  if (state.lifting_area_m2 && typeof state.lifting_area_m2.value === 'number') s.finArea_m2 = state.lifting_area_m2.value;
  put('gillArea_m2', state.gill_area_m2);
  const fl = state._meta?.parameters?.pectoral_len_over_SL; if (fl && typeof fl.value === 'number') s.finLength_SL = fl.value;
  if (state.ambient?.air_density_kg_m3?.value) s.rho = state.ambient.air_density_kg_m3.value;
  if (state._meta?.taxon) s.taxon = state._meta.taxon;
  if (state.stage?.value) s.life_stage = state.stage.value;
  return s;
}
// Which parts each Lean input depends on, so a violation can light up the right meshes.
export const INPUT_PARTS = {
  SL_m: ['skin_L', 'skin_R'], mass_kg: ['skin_L', 'skin_R', 'muscle_L', 'muscle_R'],
  pectoralFinArea_m2: ['pectoral_fin_L', 'pectoral_fin_R'], finArea_m2: ['pectoral_fin_L', 'pectoral_fin_R', 'pelvic_fin_L', 'pelvic_fin_R', 'caudal_fin'],
  finLength_SL: ['pectoral_fin_L', 'pectoral_fin_R'], gillArea_m2: ['gills_L', 'gills_R'], flightMuscleFraction: ['pectoral_muscle_L', 'pectoral_muscle_R'],
};
export { mapKind };
