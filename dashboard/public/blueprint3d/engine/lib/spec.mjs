// DesignSpec: the functional criteria a designed organism has to meet, in one checkable object.
//
//   { start_from:  [{ organism, weight }],                     weights sum to 1
//     base_edits:  [{ target:{level,id}, param, op, value, author, reason }]   optional, organism.mjs edit shape
//     criteria:    [{ id, scenario, params, metric, op, value, unit, stages, weight, hard, source_text }]
//     editable:    [{ target:{level,id}, param, min, max }]
//     constraints: { lean: 'must-hold' } }
//
// op is '>=' | '<=' | 'survives' | 'feasible' | 'maximize' | 'minimize'.
//   survives: the scenario's run().survives (the organism lives through the condition).
//   feasible: the scenario's run().feasible (the BEHAVIOUR is possible: it can glide, hold station,
//             grip, escape). The two are separate verdicts; one never stands in for the other.
// stages is 'all' | ['embryo','larva','juvenile','adult'] | { ageDays: { min, max } }.
//
// Pure ESM, no node-only import at top level, so the browser can load it next to parse-text.mjs.
// The only node-specific code is inside loadRegistry(), behind dynamic imports.
//
// Three rules this file enforces and should never loosen:
//   1. A criterion the engine has no model for is reported as 'no-model'. It is never counted as met.
//   2. A design meets the spec only if EVERY hard criterion holds at EVERY requested stage, and the
//      Lean verdicts hold. One unverified hard criterion means "does not meet", not "probably meets".
//   3. Aves are a frozen holdout (holdout/). No bird organism can be a parent, and no criterion or
//      part may name one. That is a refusal with a reason, not a warning.

export const OPS = ['>=', '<=', 'survives', 'feasible', 'maximize', 'minimize'];
const BOOL_OPS = new Set(['survives', 'feasible']);
export const STAGES = ['embryo', 'larva', 'juvenile', 'adult'];
// Same levels as lib/organism.mjs (which is the authority when loaded).
export const LEVELS = ['body', 'system', 'organ', 'tissue', 'cell', 'gene'];

// Representative ages (days after hatching) used only when state.mjs is not loaded. Labelled
// 'assumed' wherever they reach a result. When state.mjs is loaded, a stage name maps to EVERY
// stage age in the design's own stage table whose label starts with that word; 'embryo' maps to the
// hatching-period stage (Kimmel 1995 counts 48-72 hpf as embryonic), the earliest the tracks hold.
export const FALLBACK_STAGE_AGE_DAYS = { embryo: 0, larva: 7, juvenile: 30, adult: 180 };
const STAGE_LABEL_WORD = { embryo: 'hatching', larva: 'larva', juvenile: 'juvenile', adult: 'adult' };

// ── units ──────────────────────────────────────────────────────────────────
// Each unit: dimension and a linear map to the base of that dimension. Temperature has an offset.
// BL/s is a speed that needs the body length, so it converts only when SL_m is supplied.
export const UNITS = {
  '°C': { dim: 'temperature', a: 1, b: 0 }, 'K': { dim: 'temperature', a: 1, b: -273.15 },
  '°F': { dim: 'temperature', a: 5 / 9, b: -32 * 5 / 9 },
  'm': { dim: 'length', a: 1 }, 'km': { dim: 'length', a: 1000 }, 'cm': { dim: 'length', a: 0.01 },
  'mm': { dim: 'length', a: 0.001 }, 'ft': { dim: 'length', a: 0.3048 },
  'm/s': { dim: 'speed', a: 1 }, 'km/h': { dim: 'speed', a: 1 / 3.6 }, 'cm/s': { dim: 'speed', a: 0.01 },
  'mm/s': { dim: 'speed', a: 0.001 }, 'kn': { dim: 'speed', a: 0.514444 }, 'mph': { dim: 'speed', a: 0.44704 },
  'BL/s': { dim: 'speed', bodyLengths: true },
  'kPa': { dim: 'pressure', a: 1 }, 'Pa': { dim: 'pressure', a: 0.001 }, 'MPa': { dim: 'pressure', a: 1000 },
  'bar': { dim: 'pressure', a: 100 }, 'atm': { dim: 'pressure', a: 101.325 },
  'h': { dim: 'time', a: 1 }, 'min': { dim: 'time', a: 1 / 60 }, 's': { dim: 'time', a: 1 / 3600 }, 'd': { dim: 'time', a: 24 },
  '1': { dim: 'ratio', a: 1 }, '%': { dim: 'ratio', a: 0.01 },
  'm2': { dim: 'area', a: 1 }, 'cm2': { dim: 'area', a: 1e-4 },
  'N/m2': { dim: 'loading', a: 1 },
  'W': { dim: 'power', a: 1 }, 'W/kg': { dim: 'specific_power', a: 1 },
  'kg': { dim: 'mass', a: 1 }, 'g': { dim: 'mass', a: 0.001 },
};
// Spellings a scenario module might use for the same unit.
const UNIT_SPELLINGS = { 'degC': '°C', 'C': '°C', 'deg C': '°C', 'm s-1': 'm/s', 'm_s': 'm/s', 'm^2': 'm2', 'm²': 'm2',
  'N m-2': 'N/m2', 'N/m^2': 'N/m2', 'N/m²': 'N/m2', 'N_m2': 'N/m2', 'Pa (N/m2)': 'N/m2', 'hours': 'h', 'hr': 'h', '': '1', '-': '1',
  'ratio': '1', 'dimensionless': '1', 'fraction': '1', 'BL s-1': 'BL/s', 'body lengths/s': 'BL/s', 'bl/s': 'BL/s', 'kph': 'km/h', 'knots': 'kn', 'days': 'd' };
export const canonUnit = u => (u == null ? null : (UNIT_SPELLINGS[u] ?? u));
export const unitDim = u => UNITS[canonUnit(u)]?.dim ?? null;

// Convert value between two units of the same dimension. ctx.SL_m allows BL/s.
// Returns null (never a guess) when the conversion is impossible.
export function convert(value, from, to, ctx = {}) {
  from = canonUnit(from); to = canonUnit(to);
  if (from === to) return value;
  const f = UNITS[from], t = UNITS[to];
  if (!f || !t || f.dim !== t.dim || typeof value !== 'number') return null;
  const toBase = (v, u) => (u.bodyLengths ? (ctx.SL_m ? v * ctx.SL_m : null) : v * u.a + (u.b || 0));
  const fromBase = (v, u) => (u.bodyLengths ? (ctx.SL_m ? v / ctx.SL_m : null) : (v - (u.b || 0)) / u.a);
  const base = toBase(value, f);
  return base == null ? null : fromBase(base, t);
}

// Hydrostatic pressure (absolute, kPa) from depth. Seawater 1025 kg/m3 x 9.80665 = 10.052 kPa/m;
// freshwater 998 kg/m3 = 9.79 kPa/m. The parser records which it used: the difference is 2.7 %.
export const depthToKPa = (depth_m, water = 'sea') => 101.325 + depth_m * (water === 'fresh' ? 9.787 : 10.052);

// ── vocabulary: concept → candidate scenario keys ──────────────────────────
// The scenario modules are the authority on keys (static `metrics` and `params` on the default
// export). These lists are ALIASES only: validateSpec maps a spec's key onto the first candidate the
// real module declares, and says so in a warning. If none is declared it is an error, not a guess.
export const METRIC_ALIASES = {
  // Glide distance (hub 2026-10-31): glide_range_total_m = kinetic phase + h·L/D glide, NOT covered by
  // a Lean theorem as a whole; glide_range_lean_bound_m = h·L/D only, the part Lean glide_range_le covers.
  // The wind scenario reports its total as ground_distance_total_m.
  glide_range_total_m: ['glide_range_total_m', 'ground_distance_total_m', 'glide_range_m'],
  glide_range_m: ['glide_range_total_m', 'ground_distance_total_m', 'glide_range_m', 'glide_distance_m', 'range_m'],
  glide_range_lean_bound_m: ['glide_range_lean_bound_m'],
  glide_ratio: ['glide_ratio', 'LD', 'lift_to_drag', 'L_D'],
  v_min_m_s: ['v_min_m_s', 'min_speed_m_s'],
  wing_loading_N_m2: ['wing_loading_N_m2', 'wing_loading'],
  powered_flight: ['powered_flight_margin', 'powered_flight_feasible', 'power_margin', 'powered_flight'],
  ucrit_m_s: ['ucrit_m_s', 'ucrit_bl_s', 'u_crit_m_s', 'Ucrit_m_s', 'max_sustained_speed_m_s', 'sustained_speed_m_s', 'max_speed_m_s', 'swim_speed_m_s', 'speed_margin_m_s'],
  thermal_margin_C: ['thermal_margin_C', 'ctmax_margin_C', 'margin_C'],
  escape_probability: ['escape_probability', 'p_escape', 'escape_p'],
  gut_transit_h: ['gut_passage_time_h', 'gut_transit_h', 'transit_time_h', 'digestion_time_h'],
  sleep_h: ['sleep_hours_per_day', 'sleep_h', 'sleep_hours', 'rest_h'],
  cost_of_transport: ['cost_of_transport', 'COT', 'cot_J_kg_m'],
};
export const PARAM_ALIASES = {
  water_temp_C: ['water_temperature_C', 'water_temp_C', 'temp_C', 'temperature_C', 'T_C', 'water_temperature_C'],
  current_m_s: ['current_m_s', 'flow_m_s', 'current_speed_m_s', 'U_m_s'],
  depth_m: ['depth_m'],
  pressure_kPa: ['pressure_kPa', 'pressure_MPa', 'pressure_atm', 'pressure_bar', 'P_kPa'],
  altitude_m: ['altitude_m', 'elevation_m'],
  wind_m_s: ['wind_m_s', 'headwind_m_s', 'wind_speed_m_s', 'gust_m_s'],
  gust_m_s: ['gust_m_s'],
  launch_height_m: ['launch_height_m', 'height_m', 'h0_m', 'start_height_m', 'altitude_m'],
  predator_speed_m_s: ['predator_speed_m_s', 'strike_speed_m_s', 'predator_m_s'],
  flow_m_s: ['flow_m_s', 'current_m_s'],
  meal_g: ['meal_g', 'meal_mass_g'],
  light_h: ['light_hours', 'light_h', 'photoperiod_h', 'day_length_h'],
  predator_speed_ratio: ['predator_speed_ratio'],
};
const KEY_UNITS = { C: '°C', K: 'K', m: 'm', km: 'km', m_s: 'm/s', kPa: 'kPa', MPa: 'MPa', atm: 'atm', bar: 'bar', h: 'h', g: 'g', N_m2: 'N/m2', W: 'W' };
const unitFromKey = k => { const m = /_(C|K|m_s|m|km|kPa|MPa|atm|bar|h|g|N_m2|W)$/.exec(k || ''); return m ? KEY_UNITS[m[1]] : null; };

// Scenarios the product plan names, so a spec can say "not yet available" rather than "unknown".
export const PLANNED_SCENARIOS = ['temperature', 'current', 'pressure', 'altitude', 'wind', 'predator', 'grip',
  'sleep', 'daynight', 'digestion', 'glide'];

// Aves: frozen holdout. Any of these words in an organism, part or scenario slot is refused.
export const BIRD_WORDS = ['bird', 'birds', 'avian', 'aves', 'sparrow', 'sparrows', 'swallow', 'swift', 'swifts', 'albatross', 'pigeon', 'dove',
  'gull', 'seagull', 'eagle', 'hawk', 'falcon', 'hummingbird', 'chicken', 'hen', 'duck', 'goose', 'penguin', 'owl', 'crow',
  'raven', 'parrot', 'finch', 'robin', 'ostrich', 'pelican', 'heron', 'petrel', 'shearwater', 'gannet', 'cormorant', 'puffin',
  'tern', 'kingfisher', 'feather', 'feathers', 'feathered'];
export const AVES_REFUSAL = 'Refused: Aves (birds) are a frozen holdout in DELPHI (holdout/, frozen 2026-10-31). ' +
  'No bird organism, measurement or part may be used as a parent, target or criterion, so a design cannot be copied from a bird. ' +
  'State the function instead (e.g. "glides at least 30 m from 1 m") and the engine will design for it from fish parents.';
export const isBirdId = s => typeof s === 'string' && BIRD_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(s.replace(/[-_]/g, ' ')));

// Organism ids in the data bundle (sim-engine/lib/data-node.mjs). The bundle is the authority
// when loaded; this list is only the offline fallback. "zebrafish" means zebrafish-adult, the
// reference whose development track runs from hatching to adult.
export const FALLBACK_ORGANISMS = ['zebrafish-adult', 'zebrafish-larva', 'flying-fish', 'tff', 'winged-zebrafish', 'wingless-flying-fish', 'ff-zf-chimera'];

// Part words → organism.mjs targets and the editable params resolveTarget/editableParams expose
// for them (checked against lib/organism.mjs 2026-10-31). Paired fins use the ontology id, which
// resolveTarget maps to the part; their body-plan parameters apply to both sides.
export const PART_WORDS = {
  'pectoral fin': { level: 'organ', id: 'UBERON_0000151', params: { area: 'pectoral_area_over_SL2', span: 'pectoral_span_over_SL', length: 'pectoral_len_over_SL', size: 'scale' } },
  'pelvic fin': { level: 'organ', id: 'pelvic_fin_L', params: { length: 'pelvic_len_over_SL', size: 'scale' } },
  'caudal fin': { level: 'organ', id: 'caudal_fin', params: { 'upper lobe': 'caudal_upper_lobe_over_SL', 'lower lobe': 'caudal_lower_lobe_over_SL', size: 'scale' } },
  'tail fin': { level: 'organ', id: 'caudal_fin', params: { 'upper lobe': 'caudal_upper_lobe_over_SL', 'lower lobe': 'caudal_lower_lobe_over_SL', size: 'scale' } },
  'dorsal fin': { level: 'organ', id: 'dorsal_fin', params: { height: 'dorsal_height_over_SL', size: 'scale' } },
  'anal fin': { level: 'organ', id: 'anal_fin', params: { height: 'anal_height_over_SL', size: 'scale' } },
  'swim bladder': { level: 'organ', id: 'swim_bladder', params: { size: 'scale' } },
  'gills': { level: 'organ', id: 'gills_L', params: { area: 'gill_area_m2', size: 'scale' } },
  'gill': { level: 'organ', id: 'gills_L', params: { area: 'gill_area_m2', size: 'scale' } },
  'heart': { level: 'organ', id: 'heart', params: { size: 'scale' } },
  'flight muscle': { level: 'body', id: 'body', params: { fraction: 'flight_muscle_fraction', size: 'flight_muscle_fraction' } },
  'red muscle': { level: 'body', id: 'body', params: { fraction: 'red_muscle_fraction', size: 'red_muscle_fraction' } },
  'body length': { level: 'body', id: 'body', params: { size: 'standard_length_m' } },
  'body mass': { level: 'body', id: 'body', params: { size: 'body_mass_kg' } },
  'body depth': { level: 'body', id: 'body', params: { size: 'body_depth_over_SL' } },
  'body density': { level: 'body', id: 'body', params: { size: 'body_density_kg_m3' } },
};

// ── registry ───────────────────────────────────────────────────────────────
// What the engine actually has, so validation checks against it rather than against this file:
//   { scenarios: {key: module}, scenarioErrors, organisms: Set, bundle, organism (lib/organism.mjs),
//     state (lib/state.mjs), checkTarget(doc, target, param) → error string | null,
//     docFor(spec) → organism document, stagesFor(doc) → [{ageDays, label}], sources[] }
// Node only (the data bundle is read from disk). In the browser, pass a registry built from the
// browser engine, or none: validation then checks shape and units only, and says so.
export function makeRegistry({ scenarios = {}, scenarioErrors = {}, bundle = null, organism = null, state = null, runner = null, sources = [] } = {}) {
  const reg = { scenarios, scenarioErrors, bundle, organism, state, runner, sources,
    organisms: new Set(bundle ? Object.keys(bundle.organisms).filter(id => !isBirdId(id)) : FALLBACK_ORGANISMS) };
  reg.docFor = spec => {
    if (!organism || !bundle) return null;
    const parents = (spec.start_from || []).map(s => ({ organism: s.organism, weight: s.weight }));
    let doc = organism.createOrganism({ id: 'spec-design', parents, notes: 'built from a DesignSpec' }, bundle);
    for (const e of spec.base_edits || []) doc = organism.appendEdit(bundle, doc, { author: 'agent:spec', reason: 'base edit stated in the spec', ...e });
    return doc;
  };
  reg.checkTarget = (doc, target, param) => {
    if (!organism || !bundle || !doc) return null;
    try {
      const r = organism.resolveTarget(bundle, doc, target);
      if (param != null) {
        const allowed = organism.editableParams(bundle, doc, r);
        const a = allowed.find(x => x.param === param);
        if (!a) return `param "${param}" is not editable on ${r.level} "${r.id}"; editable: ${allowed.map(x => x.param).join(', ')}`;
        if (a.effect === 'recorded-only') return `param "${param}" on ${r.level} "${r.id}" is recorded-only: no model consumes it, so optimizing it cannot change any criterion`;
      }
      return null;
    } catch (e) { return e.message; }
  };
  reg.stagesFor = doc => {
    if (!state?.stageAges || !bundle || !doc) return null;
    try { return state.stageAges(bundle, doc); } catch { return null; }
  };
  reg.resolveState = state?.resolveState && bundle ? (doc, ageDays, conditions) => state.resolveState(doc, ageDays, conditions, bundle) : null;
  return reg;
}

export async function loadRegistry({ simRoot } = {}) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const sim = simRoot || path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
  const imp = f => import(url.pathToFileURL(f).href);
  const scenarios = {}, scenarioErrors = {}, sources = [];
  const sdir = path.join(sim, 'scenarios');
  if (fs.existsSync(sdir)) for (const f of fs.readdirSync(sdir).filter(f => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'index.mjs')) {
    try { const m = await imp(path.join(sdir, f)); const s = m.default || m.scenario; if (s?.key && typeof s.run === 'function') scenarios[s.key] = s; else scenarioErrors[f.replace(/\.mjs$/, '')] = 'no default export with a key and run(): not a scenario module (a helper library, or mid-edit)'; }
    catch (e) { scenarioErrors[f.replace(/\.mjs$/, '')] = e.message; }
  }
  sources.push(fs.existsSync(sdir) ? `scenarios/: ${Object.keys(scenarios).join(', ') || 'none loaded'}` : 'scenarios/ absent');
  let bundle = null, organism = null, state = null, runner = null;
  try { runner = (await imp(path.join(sdir, 'index.mjs'))).runScenario || null; } catch { /* run() is called directly */ }
  try { bundle = await (await imp(path.join(sim, 'lib', 'data-node.mjs'))).loadBundle(); sources.push('lib/data-node.mjs bundle'); }
  catch (e) { sources.push(`data bundle unavailable: ${e.message}`); }
  try { organism = await imp(path.join(sim, 'lib', 'organism.mjs')); sources.push('lib/organism.mjs'); } catch (e) { sources.push(`lib/organism.mjs unavailable: ${e.message}`); }
  try { state = await imp(path.join(sim, 'lib', 'state.mjs')); sources.push('lib/state.mjs'); } catch (e) { sources.push(`lib/state.mjs unavailable: ${e.message}`); }
  return makeRegistry({ scenarios, scenarioErrors, bundle, organism, state, runner, sources });
}

// ── validation ─────────────────────────────────────────────────────────────
const isNum = x => typeof x === 'number' && Number.isFinite(x);
const stageList = st => (st === 'all' ? STAGES : Array.isArray(st) ? st : typeof st === 'string' && STAGES.includes(st) ? [st] : null);

// Returns { ok, errors[], warnings[], spec } where spec is a normalised deep copy: aliases mapped
// to the real scenario keys, param values converted to the scenario's units, ids assigned.
export function validateSpec(input, registry = null) {
  const errors = [], warnings = [];
  const E = (path, msg) => errors.push({ path, message: msg });
  const W = (path, msg) => warnings.push({ path, message: msg });
  if (!input || typeof input !== 'object') return { ok: false, errors: [{ path: '', message: 'spec must be an object' }], warnings, spec: null };
  const spec = JSON.parse(JSON.stringify(input));
  const scen = registry?.scenarios || null;
  if (!registry) W('', 'no registry supplied: scenario, metric and part ids were checked for shape only, not against the engine');

  for (const r of spec.refused || []) E('refused', `"${r.text}": ${r.reason}`);

  // start_from
  if (!Array.isArray(spec.start_from) || !spec.start_from.length) E('start_from', 'start_from needs at least one {organism, weight}');
  else {
    let sum = 0;
    spec.start_from.forEach((s, i) => {
      const P = `start_from[${i}]`;
      if (isBirdId(s?.organism)) return E(P, AVES_REFUSAL);
      if (!s || typeof s.organism !== 'string') return E(P, 'organism must be a string id');
      if (!isNum(s.weight) || s.weight <= 0 || s.weight > 1) E(`${P}.weight`, `weight must be in (0, 1], got ${s.weight}`);
      else sum += s.weight;
      const known = registry?.organisms || new Set(FALLBACK_ORGANISMS);
      if (!known.has(s.organism)) E(`${P}.organism`, `unknown organism "${s.organism}"; known: ${[...known].join(', ')}`);
    });
    if (spec.start_from.every(s => isNum(s?.weight)) && Math.abs(sum - 1) > 0.011) E('start_from', `parent weights must sum to 1 (100 %); they sum to ${+sum.toFixed(3)}`);
    const ids = spec.start_from.map(s => s?.organism); if (new Set(ids).size !== ids.length) E('start_from', 'the same organism is listed twice');
  }

  // constraints
  spec.constraints = spec.constraints || {};
  if (spec.constraints.lean == null) spec.constraints.lean = 'must-hold';
  if (spec.constraints.lean !== 'must-hold') E('constraints.lean', `Lean constraints cannot be waived: lean must be 'must-hold', got ${JSON.stringify(spec.constraints.lean)}`);

  // The organism document the targets are resolved against (null without organism.mjs + bundle,
  // or when start_from is itself invalid; then targets get a shape check only).
  let doc = null;
  if (registry?.docFor && !errors.length) {
    try { doc = registry.docFor({ start_from: spec.start_from }); }
    catch (e) { E('start_from', e.message); }
  }
  const checkPart = (P, t, param) => {
    if (!t || typeof t !== 'object') return E(P, 'target must be {level, id}');
    if (!LEVELS.includes(t.level)) return E(`${P}.level`, `unknown level "${t.level}"; allowed: ${LEVELS.join(', ')}`);
    if (t.level !== 'body' && (typeof t.id !== 'string' || !t.id)) return E(`${P}.id`, 'id must be a non-empty string');
    if (isBirdId(t.id)) return E(P, AVES_REFUSAL);
    const err = registry?.checkTarget?.(doc, t, param);
    if (err) E(P, err);
  };

  (spec.editable || []).forEach((v, i) => {
    const P = `editable[${i}]`;
    if (typeof v?.param !== 'string' || !v.param) E(`${P}.param`, 'param must be a string');
    checkPart(`${P}.target`, v?.target, typeof v?.param === 'string' ? v.param : null);
    if (v?.min == null || v?.max == null) W(P, 'no range stated: the optimizer must bound this by the parents\' envelope and report it');
    else if (!isNum(v.min) || !isNum(v.max)) E(P, 'min and max must be numbers');
    else if (v.min > v.max) E(P, `contradictory range: min ${v.min} > max ${v.max}`);
  });
  (spec.base_edits || []).forEach((v, i) => checkPart(`base_edits[${i}].target`, v?.target, v?.param));
  if (doc && spec.base_edits?.length && !errors.length) try { registry.docFor(spec); } catch (e) { E('base_edits', e.message); }

  // criteria
  if (!Array.isArray(spec.criteria) || !spec.criteria.length) E('criteria', 'at least one criterion is needed');
  (spec.criteria || []).forEach((c, i) => {
    const P = `criteria[${i}]`;
    if (!c || typeof c !== 'object') return E(P, 'criterion must be an object');
    c.id = c.id || `c${i + 1}`;
    if (!OPS.includes(c.op)) E(`${P}.op`, `unknown op ${JSON.stringify(c.op)}; allowed: ${OPS.join(' ')}`);
    if (typeof c.scenario !== 'string') return E(`${P}.scenario`, 'scenario must be a string');
    if (isBirdId(c.scenario)) return E(P, AVES_REFUSAL);
    c.params = c.params || {};
    c.weight = c.weight == null ? 1 : c.weight;
    c.stages = c.stages ?? ['adult'];
    if (typeof c.stages === 'string' && STAGES.includes(c.stages)) c.stages = [c.stages];
    if (!isNum(c.weight) || c.weight < 0) E(`${P}.weight`, 'weight must be a non-negative number');
    if (c.hard == null) c.hard = c.op === '>=' || c.op === '<=' || BOOL_OPS.has(c.op);
    if (c.hard && (c.op === 'maximize' || c.op === 'minimize')) E(`${P}.hard`, `a ${c.op} criterion has no threshold, so it cannot be hard`);
    if ((c.op === '>=' || c.op === '<=') && !isNum(c.value)) E(`${P}.value`, `op ${c.op} needs a numeric value`);
    if (['>=', '<=', 'maximize', 'minimize'].includes(c.op) && !c.metric) E(`${P}.metric`, `op ${c.op} needs a metric`);
    if (c.unit != null && !UNITS[canonUnit(c.unit)]) E(`${P}.unit`, `unknown unit "${c.unit}"`);
    if (c.unit && unitDim(c.unit) === 'temperature' && isNum(c.value) && convert(c.value, c.unit, 'K') < 0) E(`${P}.value`, `${c.value} ${c.unit} is below absolute zero`);
    for (const [k, v] of Object.entries(c.params)) {
      if (/temp/i.test(k) && isNum(v) && convert(v, unitFromKey(k) || '°C', 'K') < 0) E(`${P}.params.${k}`, `${v} ${unitFromKey(k) || '°C'} is below absolute zero`);
      if (/(depth|speed|current|wind|launch|pressure|flow)/i.test(k) && isNum(v) && v < 0) E(`${P}.params.${k}`, `${k} cannot be negative (${v})`);
    }
    const st = c.stages;
    if (st === 'all') { /* ok */ }
    else if (Array.isArray(st)) { const bad = st.filter(s => !STAGES.includes(s)); if (bad.length) E(`${P}.stages`, `unknown stage(s) ${bad.join(', ')}; allowed: ${STAGES.join(', ')}, 'all' or {ageDays:{min,max}}`); if (!st.length) E(`${P}.stages`, 'empty stage list'); }
    else if (st && typeof st === 'object' && st.ageDays) { const { min, max } = st.ageDays; if (!isNum(min) || !isNum(max) || min < 0 || min > max) E(`${P}.stages`, `ageDays range must be 0 <= min <= max, got ${min}..${max}`); }
    else E(`${P}.stages`, `stages must be 'all', a list of stage names, or {ageDays:{min,max}}`);

    if (!scen) return;
    const mod = scen[c.scenario];
    if (!mod) {
      if (registry.scenarioErrors?.[c.scenario]) return E(`${P}.scenario`, `scenario "${c.scenario}" exists but failed to load: ${registry.scenarioErrors[c.scenario]}`);
      if (PLANNED_SCENARIOS.includes(c.scenario)) return E(`${P}.scenario`, `scenario "${c.scenario}" not yet available (planned; no module in sim-engine/scenarios/)`);
      return E(`${P}.scenario`, `unknown scenario "${c.scenario}"; available: ${Object.keys(scen).join(', ') || 'none'}`);
    }
    if (c.metric) {
      const declared = mod.metrics || mod.modelCard?.metrics || null;
      if (!declared) W(`${P}.metric`, `scenario "${c.scenario}" declares no static metrics; "${c.metric}" is checked only when it runs`);
      else {
        const keys = declared.map(m => m.key);
        const cands = [c.metric, ...(METRIC_ALIASES[c.metric] || [])].filter(k => keys.includes(k));
        const unitOfKey = k => canonUnit(declared.find(x => x.key === k)?.unit);
        const key = (c.unit && cands.find(k => unitOfKey(k) === canonUnit(c.unit))) || cands[0];
        if (!key) E(`${P}.metric`, `scenario "${c.scenario}" has no metric "${c.metric}"; it declares: ${keys.join(', ')}`);
        else {
          if (key !== c.metric) { W(`${P}.metric`, `"${c.metric}" mapped to the scenario's key "${key}"`); c.metric = key; }
          const m = declared.find(x => x.key === key);
          if (c.unit && m.unit != null && canonUnit(c.unit) !== canonUnit(m.unit)) {
            if (unitDim(c.unit) !== unitDim(m.unit)) E(`${P}.unit`, `unit "${c.unit}" is not a ${unitDim(m.unit) || m.unit} unit; metric "${key}" is in ${m.unit}`);
            else if (canonUnit(c.unit) === 'BL/s' || canonUnit(m.unit) === 'BL/s') W(`${P}.unit`, `BL/s and ${m.unit} differ by the body length; converted per stage from the resolved state`);
            else if (isNum(c.value)) { c.value_as_given = { value: c.value, unit: c.unit }; c.value = convert(c.value, c.unit, m.unit); c.unit = m.unit; }
          }
          if (!c.unit && m.unit != null) c.unit = canonUnit(m.unit);
          if (m.better) c.better = m.better;
          if (c.op === 'maximize' && m.better === 'lower') W(`${P}.op`, `maximizing "${key}", which the scenario marks better=lower`);
          if (c.op === 'minimize' && m.better === 'higher') W(`${P}.op`, `minimizing "${key}", which the scenario marks better=higher`);
        }
      }
    }
    const declaredP = mod.params || [];
    const out = {};
    for (const [k, v] of Object.entries(c.params)) {
      if (k === 'water') continue;
      let dp = declaredP.find(d => d.key === k) || declaredP.find(d => (PARAM_ALIASES[k] || []).includes(d.key));
      if (!dp && k === 'depth_m') {
        dp = declaredP.find(d => PARAM_ALIASES.pressure_kPa.includes(d.key));
        if (dp) {
          const water = c.params.water === 'fresh' ? 'fresh' : 'sea';
          const val = convert(depthToKPa(v, water), 'kPa', dp.unit || unitFromKey(dp.key) || 'kPa');
          W(`${P}.params.depth_m`, `depth ${v} m converted to ${dp.key} = ${+val.toFixed(3)} (${water}water hydrostatic, absolute)`);
          rangeCheck(dp, val, k); out[dp.key] = val; continue;
        }
      }
      if (!dp && k === 'pressure_kPa' && isNum(v)) {
        const dd = declaredP.find(d => d.key === 'depth_m');
        if (dd) {
          const water = c.params.water === 'fresh' ? 'fresh' : 'sea';
          const depth = (v - 101.325) / (water === 'fresh' ? 9.787 : 10.052);
          if (depth < 0) { E(`${P}.params.pressure_kPa`, `${v} kPa is below one atmosphere; the pressure scenario models depth below the surface`); continue; }
          W(`${P}.params.pressure_kPa`, `${v} kPa absolute converted to depth_m = ${+depth.toFixed(2)} (${water}water hydrostatic)`);
          rangeCheck(dd, depth, k); out.depth_m = depth; continue;
        }
      }
      if (!dp) { E(`${P}.params.${k}`, `scenario "${c.scenario}" has no parameter "${k}"; it takes: ${declaredP.map(d => d.key).join(', ') || 'none'}`); continue; }
      let val = v;
      const fu = unitFromKey(k), tu = dp.unit || unitFromKey(dp.key);
      if (isNum(v) && fu && tu && canonUnit(fu) !== canonUnit(tu)) { const cv = convert(v, fu, tu); if (cv == null) { E(`${P}.params.${k}`, `cannot convert ${fu} to ${tu}`); continue; } val = cv; }
      if (dp.key !== k) W(`${P}.params.${k}`, `"${k}" mapped to the scenario's parameter "${dp.key}"${val !== v ? ` (${v} ${fu} = ${+val.toFixed(4)} ${tu})` : ''}`);
      rangeCheck(dp, val, k);
      out[dp.key] = val;
    }
    function rangeCheck(dp, val, k) {
      if (isNum(val) && ((isNum(dp.min) && val < dp.min) || (isNum(dp.max) && val > dp.max)))
        E(`${P}.params.${k}`, `${dp.key} = ${+val.toFixed(4)} ${dp.unit || ''} is outside the scenario's modelled range ${dp.min}..${dp.max}; the engine would be extrapolating`);
    }
    c.params = out;
  });

  // contradictions: same scenario+metric+params, overlapping stages, >= a and <= b with a > b
  const crit = spec.criteria || [];
  for (let i = 0; i < crit.length; i++) for (let j = i + 1; j < crit.length; j++) {
    const a = crit[i], b = crit[j];
    if (!a || !b || a.scenario !== b.scenario || a.metric !== b.metric || !a.metric) continue;
    if (JSON.stringify(a.params) !== JSON.stringify(b.params)) continue;
    const lo = a.op === '>=' ? a : b.op === '>=' ? b : null, hi = a.op === '<=' ? a : b.op === '<=' ? b : null;
    if (!lo || !hi || lo === hi || !stagesOverlap(lo.stages, hi.stages)) continue;
    const loV = lo.unit && hi.unit ? convert(lo.value, lo.unit, hi.unit) : lo.value;
    if (isNum(loV) && loV > hi.value) E(`criteria[${crit.indexOf(lo)}]+criteria[${crit.indexOf(hi)}]`, `contradictory: ${lo.metric} >= ${lo.value} ${lo.unit || ''} and <= ${hi.value} ${hi.unit || ''} cannot both hold`);
  }
  return { ok: errors.length === 0, errors, warnings, spec };
}

function stagesOverlap(a, b) {
  const la = stageList(a ?? ['adult']), lb = stageList(b ?? ['adult']);
  if (la && lb) return la.some(s => lb.includes(s));
  return true; // an ageDays range may overlap any stage; report rather than miss it
}

// ── objective ──────────────────────────────────────────────────────────────
// Concrete evaluation points for a criterion: [{stage, ageDays, ageKind}].
// table = state.stageAges(bundle, doc) → [{ageDays, label}]. A stage name visits EVERY age in the
// table whose label starts with that stage's word (two larval ages → two evaluations). Without a
// table the fallback ages are used and marked 'assumed'.
export function stagePoints(c, table = null) {
  const st = c.stages ?? ['adult'];
  if (st && typeof st === 'object' && !Array.isArray(st)) {
    const { min, max } = st.ageDays;
    let ages = table ? table.map(t => t.ageDays).filter(a => a >= min && a <= max) : [];
    if (!ages.length) ages = min === max ? [min] : [min, max];
    return [...new Set(ages)].map(a => ({ stage: `${a}d`, ageDays: a, ageKind: 'stated' }));
  }
  const out = [];
  for (const s of stageList(st)) {
    const hits = table ? table.filter(t => String(t.label || t.key || '').toLowerCase().startsWith(STAGE_LABEL_WORD[s])) : [];
    if (hits.length) for (const h of hits) out.push({ stage: hits.length > 1 ? `${s}@${h.ageDays}d` : s, ageDays: h.ageDays, ageKind: 'table', label: h.label });
    else out.push({ stage: s, ageDays: FALLBACK_STAGE_AGE_DAYS[s], ageKind: 'assumed' });
  }
  return out;
}

// The number a criterion is about, from one scenario run. BL/s needs the body length in the state.
export function metricValue(c, run, state = null) {
  if (!run || !Array.isArray(run.metrics)) return { value: null };
  const m = run.metrics.find(x => x.key === c.metric);
  if (!m || !isNum(m.value)) return { value: null, metric: m };
  let v = m.value;
  if (c.unit && m.unit && canonUnit(c.unit) !== canonUnit(m.unit)) {
    const SL_m = state?.SL_m ?? state?.body?.SL_m ?? state?.standard_length_m ?? null;
    v = convert(m.value, m.unit, c.unit, { SL_m });
    if (v == null) return { value: null, metric: m, why: `cannot convert ${m.unit} to ${c.unit}${canonUnit(c.unit) === 'BL/s' ? ' (no body length in the state)' : ''}` };
  }
  return { value: v, metric: m };
}

// Verdict of one criterion at one stage: 'met' | 'failed' | 'no-model', with the number.
export function judge(c, run, state = null) {
  if (!run || run.error) return { verdict: 'no-model', why: run?.error || 'scenario not run' };
  const v = run.validity;
  const vs = typeof v === 'string' ? v : v?.status || '';
  if (v && v.ok !== true && /out|invalid|extrapolat|no-model/i.test(vs)) return { verdict: 'no-model', why: `outside the model's validity: ${typeof v === 'string' ? v : JSON.stringify(v)}` };
  if (c.op === 'survives') {
    if (typeof run.survives !== 'boolean') return { verdict: 'no-model', why: `scenario returned no survival verdict (survives = ${run.survives ?? 'null'})` };
    return { verdict: run.survives ? 'met' : 'failed', value: run.survives };
  }
  if (c.op === 'feasible') {
    if (typeof run.feasible !== 'boolean') return { verdict: 'no-model', why: `scenario returned no feasibility verdict (feasible = ${run.feasible ?? 'null'})` };
    return { verdict: run.feasible ? 'met' : 'failed', value: run.feasible };
  }
  const { value, why } = metricValue(c, run, state);
  if (value == null) return { verdict: 'no-model', why: why || `metric "${c.metric}" not returned` };
  if (c.op === '>=') return { verdict: value >= c.value ? 'met' : 'failed', value };
  if (c.op === '<=') return { verdict: value <= c.value ? 'met' : 'failed', value };
  return { verdict: 'met', value }; // maximize/minimize: no threshold; scored, not judged
}

// Score of one soft criterion at one stage. Threshold terms are capped at 1 (no reward for overshoot).
function softTerm(c, value, ref) {
  if (BOOL_OPS.has(c.op)) return value ? 1 : 0;
  if (!isNum(value)) return 0;
  if (c.op === '>=') return c.value === 0 ? (value >= 0 ? 1 : 0) : Math.max(0, Math.min(1, value / c.value));
  if (c.op === '<=') return value <= 0 ? 1 : Math.max(0, Math.min(1, c.value / value));
  const r = isNum(ref) && ref !== 0 ? Math.abs(ref) : isNum(c.value) && c.value !== 0 ? Math.abs(c.value) : 1;
  return c.op === 'maximize' ? value / r : value === 0 ? 0 : r / value;
}

// The objective an optimizer maximises. Returns { describe (JSON-safe), evaluate(evals, opts) }.
//   evals: { [criterionId]: { [stage]: { run, state, ageKind } } }   run = scenario.run() output
//   opts.baseline: { [criterionId]: number }   reference values for maximize/minimize
//   opts.lean: [{ id, holds }]                 Lean verdicts for the design
// score = Σ w·s / Σ w over soft criteria, each scored at its WORST requested stage.
// meets = every hard criterion 'met' at every stage (no-model counts as NOT met) and Lean holds.
export function specToObjective(spec, opts = {}) {
  const soft = spec.criteria.filter(c => !c.hard), hard = spec.criteria.filter(c => c.hard);
  const describe = {
    kind: 'weighted-normalised-sum',
    soft: soft.map(c => ({ id: c.id, scenario: c.scenario, params: c.params, metric: c.metric ?? null, op: c.op, target: c.value ?? null, unit: c.unit ?? null, weight: c.weight, stages: c.stages ?? ['adult'],
      normalisation: c.op === '>=' ? 'min(v/target, 1)' : c.op === '<=' ? 'min(target/v, 1)' : c.op === 'maximize' ? 'v / baseline' : c.op === 'minimize' ? 'baseline / v' : 'survives ? 1 : 0' })),
    hard: hard.map(c => ({ id: c.id, scenario: c.scenario, metric: c.metric ?? null, op: c.op, value: c.value ?? null, unit: c.unit ?? null, params: c.params, stages: c.stages ?? ['adult'] })),
    lean: spec.constraints?.lean || 'must-hold',
    aggregation: 'each soft criterion is scored at its worst requested stage; hard criteria are constraints, not score terms; no-model never counts as met',
    editable: spec.editable || [],
  };
  const evaluate = (evals = {}, o = {}) => {
    const baseline = { ...(opts.baseline || {}), ...(o.baseline || {}) };
    const violations = [], unverified = [];
    for (const c of hard) {
      const per = Object.entries(evals[c.id] || {});
      if (!per.length) unverified.push({ id: c.id, stage: '*', why: 'not evaluated' });
      for (const [stage, e] of per) {
        const j = judge(c, e?.run, e?.state);
        if (j.verdict === 'failed') violations.push({ id: c.id, stage, value: j.value });
        if (j.verdict === 'no-model') unverified.push({ id: c.id, stage, why: j.why });
      }
    }
    let num = 0, den = 0;
    const terms = {};
    for (const c of soft) {
      const per = Object.entries(evals[c.id] || {}).map(([, e]) => { const j = judge(c, e?.run, e?.state); return j.verdict === 'no-model' ? 0 : softTerm(c, j.value, baseline[c.id]); });
      const s = per.length ? Math.min(...per) : 0;
      terms[c.id] = s; num += c.weight * s; den += c.weight;
    }
    // Lean: [{id, holds}] for the design. Not supplied while constraints.lean is must-hold means the
    // laws were never checked, which is "unverified", never "holds".
    const lean = o.lean ?? opts.lean ?? null;
    if (lean == null && (spec.constraints?.lean ?? 'must-hold') === 'must-hold') unverified.push({ id: 'lean', stage: '*', why: 'Lean verdicts not supplied: the laws were not checked' });
    const leanFails = (lean || []).filter(l => l.holds === false);
    const meets = violations.length === 0 && unverified.length === 0 && leanFails.length === 0;
    return { score: den ? num / den : (meets ? 1 : 0), terms, meets, violations, unverified, lean_failures: leanFails };
  };
  return { describe, evaluate };
}

// Run every criterion at every requested stage. Needs registry.scenarios and registry.resolveState.
export async function evaluateDesign(spec, doc, registry) {
  doc = doc || registry?.docFor?.(spec) || null;
  const evals = {};
  for (const c of spec.criteria) {
    evals[c.id] = {};
    const mod = registry?.scenarios?.[c.scenario];
    for (const pt of stagePoints(c, registry?.stagesFor?.(doc))) {
      const slot = { ageDays: pt.ageDays, ageKind: pt.ageKind };
      if (!mod || typeof mod.run !== 'function') { evals[c.id][pt.stage] = { ...slot, run: { error: `scenario "${c.scenario}" not available` } }; continue; }
      if (!registry.resolveState) { evals[c.id][pt.stage] = { ...slot, run: { error: 'state.mjs resolveState not available' } }; continue; }
      try {
        const params = Object.fromEntries((mod.params || []).map(p => [p.key, p.default]));
        Object.assign(params, c.params);
        const state = await registry.resolveState(doc, pt.ageDays, conditionsFrom(params));
        // scenarios/index.mjs runScenario checks params and refuses to run on null STATE fields;
        // its refusal becomes a no-model verdict carrying the reason.
        let run;
        if (registry.runner) { const r = registry.runner(mod, state, c.params); run = r.ok === false ? { error: r.error + (r.errors ? ': ' + r.errors.join('; ') : '') } : r; }
        else run = await mod.run(state, params);
        evals[c.id][pt.stage] = { ...slot, state, run };
      } catch (e) { evals[c.id][pt.stage] = { ...slot, run: { error: e.message } }; }
    }
  }
  return evals;
}

// Scenario params that are also ambient conditions state.mjs understands. Other params go only to
// run(); passing them to resolveState would add unvalidated 'assumed' extras to the state.
function conditionsFrom(params) {
  const c = {};
  for (const k of PARAM_ALIASES.water_temp_C) if (isNum(params[k])) { c.temperature_C = params[k]; break; }
  if (isNum(params.depth_m)) c.depth_m = params.depth_m;
  if (isNum(params.altitude_m)) c.altitude_m = params.altitude_m;
  if (isNum(params.salinity_psu)) c.salinity_psu = params.salinity_psu;
  if (typeof params.medium === 'string') c.medium = params.medium;
  return c;
}

// ── explanation ────────────────────────────────────────────────────────────
const KIND_ORDER = ['assumed', 'borrowed', 'measured-secondhand', 'calibrated', 'derived', 'measured'];
export function weakestKind(run) {
  const kinds = [];
  for (const m of run?.metrics || []) if (m.kind) kinds.push(m.kind);
  for (const q of run?.provenance || []) if (q.kind) kinds.push(q.kind);
  if (run?.weakest_input && run.weakest_input !== 'none') kinds.push(run.weakest_input);
  return KIND_ORDER.find(k => kinds.includes(k)) || null;
}

// Per criterion, per stage: verdict, number, limiting factor, weakest provenance kind behind it.
// The summary line never says "meets" unless meets is true.
export function explainResult(spec, evals, opts = {}) {
  const summary = specToObjective(spec, opts).evaluate(evals, opts);
  const rows = spec.criteria.map(c => {
    const stages = Object.entries(evals[c.id] || {}).map(([stage, e]) => {
      const j = judge(c, e?.run, e?.state);
      const m = c.metric ? (e?.run?.metrics || []).find(x => x.key === c.metric) : null;
      // The weakest of the metric's own kind AND every input in the run's provenance: a metric marked
      // 'derived' can rest on an assumed launch speed or a calibrated Umax, and that must show.
      // Boolean verdicts (survives / feasible) rest on the whole run, so every metric kind counts too.
      const kinds = [m?.kind, ...(e?.run?.provenance || []).map(q => q.kind), e?.run?.weakest_input,
        ...(BOOL_OPS.has(c.op) || !m ? (e?.run?.metrics || []).map(x => x.kind) : [])].filter(k => k && k !== 'none');
      let weakest = KIND_ORDER.find(k => kinds.includes(k)) || null;
      if (e?.ageKind === 'assumed' && j.verdict !== 'no-model') weakest = 'assumed';
      return { stage, verdict: j.verdict, value: j.value ?? null, unit: BOOL_OPS.has(c.op) ? null : (c.unit || m?.unit || null),
        // feasible: the behaviour's reason (feasibility_note); survives: limiting (what kills it);
        // a metric threshold: limiting, else the behaviour's reason (a glide range of 0 because the
        // fish cannot reach v_min is explained by feasibility_note)
        limiting: c.op === 'feasible' ? (e?.run?.feasibility_note ?? e?.run?.limiting ?? null)
          : c.op === 'survives' ? (e?.run?.limiting ?? null) : (e?.run?.limiting ?? e?.run?.feasibility_note ?? null),
        ...leanCoverage(c, e?.run), weakest_provenance: weakest, why: j.why ?? null,
        scope: e?.run?.scope ?? null, age_days: e?.ageDays ?? null,
        ...(e?.ageKind === 'assumed' ? { age_note: 'stage age is a fallback (state.mjs exported no stage table): assumed' } : {}) };
    });
    const verdict = !stages.length ? 'no-model' : stages.some(s => s.verdict === 'failed') ? 'failed' : stages.some(s => s.verdict === 'no-model') ? 'no-model' : 'met';
    return { id: c.id, text: c.source_text || describeCriterion(c), hard: !!c.hard, op: c.op, target: c.value ?? null, unit: c.unit ?? null, verdict, stages,
      ...(LEAN_COVER[c.metric] ? { lean_coverage: LEAN_COVER[c.metric] } : {}) };
  });
  const n = k => rows.filter(r => r.hard && r.verdict === k).length;
  const leanUnchecked = summary.unverified.some(u => u.id === 'lean');
  const line = summary.meets
    ? `Meets the spec: all ${rows.filter(r => r.hard).length} hard criteria hold at every requested stage and the Lean verdicts hold. Soft score ${summary.score.toFixed(3)}.`
    : `Does NOT meet the spec: ${n('failed')} hard criteria failed, ${n('no-model')} could not be evaluated (no model counts as not met)` +
      `${summary.lean_failures.length ? `, ${summary.lean_failures.length} Lean laws violated` : ''}${leanUnchecked ? ', Lean laws not checked' : ''}. Soft score ${summary.score.toFixed(3)}.`;
  return { meets: summary.meets, score: summary.score, summary: line, criteria: rows, lean: opts.lean ?? null, violations: summary.violations, unverified: summary.unverified };
}

// Which part of a glide distance a Lean theorem covers. Stated on every glide row so a total that
// "meets" is never read as a proved distance.
const LEAN_COVER = {
  glide_range_lean_bound_m: 'Covered: this is the h·L/D range bound of Lean theorem glide_range_le (evaluated in floating point, not a kernel check).',
  glide_range_total_m: 'NOT covered as a whole: only the h·L/D part (glide_range_lean_bound_m) is covered by Lean glide_range_le; the kinetic phase (kinetic_phase_m) is outside the theorem.',
  ground_distance_total_m: 'NOT covered as a whole: only the still-air h·L/D part (glide_range_lean_bound_m) is covered by Lean glide_range_le; the kinetic phase and the wind drift are outside it.',
};
function leanCoverage(c, run) {
  if (!LEAN_COVER[c.metric] || !run?.metrics) return {};
  const val = k => { const m = run.metrics.find(x => x.key === k); return typeof m?.value === 'number' ? m.value : null; };
  return { lean_part: { lean_bound_m: val('glide_range_lean_bound_m'), kinetic_phase_m: val('kinetic_phase_m'), covered: c.metric === 'glide_range_lean_bound_m' ? 'all' : 'lean_bound_m only' } };
}

export function describeCriterion(c) {
  const st = c.stages === 'all' ? 'all stages' : Array.isArray(c.stages) ? c.stages.join(' + ') : c.stages?.ageDays ? `${c.stages.ageDays.min}–${c.stages.ageDays.max} d` : 'adult';
  const ps = Object.entries(c.params || {}).filter(([k]) => k !== 'water').map(([k, v]) => `${k}=${typeof v === 'number' ? +v.toFixed(4) : v}`).join(', ');
  const body = BOOL_OPS.has(c.op) ? `${c.op === 'survives' ? 'survives' : 'can do'} ${c.scenario}` : c.op === 'maximize' || c.op === 'minimize' ? `${c.op} ${c.metric}` : `${c.metric} ${c.op} ${c.value} ${c.unit || ''}`.trim();
  return `${body}${ps ? ` (${ps})` : ''} [${st}]${c.hard ? '' : ' (soft)'}`;
}
