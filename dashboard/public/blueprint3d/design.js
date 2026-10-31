// Design Studio + Growth for Open the Fish. Parameters, scaling rules, an adapter for the Lean thread's
// lean/eliminate/browser-check.mjs (copied next to this page by dashboard/build-graph.mjs), a rule-based phrase grammar,
// an interventions reader with a labelled stand-in, the hypothetical flier from physics/flier/spec.json, and a stand-in
// growth trajectory. Every number is read from data.json, browser-check.mjs (its REFERENCE specimen), flier-spec.json or
// conditions-baseline.json, or is a stand-in that says so. Nothing predicts development; see the banner text below.
export const BANNER = 'This maps a change to candidate genetic routes from published experiments in zebrafish/medaka. It is not a predictive genotype-to-phenotype model; development is not simulated.';
export const GROWTH_BANNER = 'Data-driven growth: lengths, proportions and timings from measurements; development itself is not simulated mechanistically.';
// What limits a juvenile (Viz honesty fix, 2026-10-31): shown in the Growth panel and on the growth plot.
export const GROWTH_LIFT_NOTE = "The lift bound alone is easiest for small fish, so 'first glide' at hatching is an artefact of checking C9 at a fixed 10 m/s; what limits a juvenile is reaching airspeed, which no constraint evaluates.";

// ---------- parameters ----------
// id, label, unit, min, max, step, and where the baseline comes from
export const PARAMS = [
  { id: 'finLen', label: 'pectoral fin length / SL', unit: '', min: 0.2, max: 2.0, step: 0.005, basis: 'Daane 2021 median of 49 flying-fish specimens (manifest evidence_backed)' },
  { id: 'finSpan', label: 'fin chord factor (area ∝ length² × this)', unit: '×', min: 0.4, max: 2.5, step: 0.01, basis: 'assumed: 1 = the model as built; lifting area scales with fin length² times this factor' },
  { id: 'SL', label: 'standard length', unit: 'm', min: 0.05, max: 0.6, step: 0.001, basis: 'Park and Choi 2010 model L3 standard length (browser-check.mjs REFERENCE, physics/glide-data.csv)' },
  { id: 'mass', label: 'body mass', unit: 'kg', min: 0.005, max: 2, step: 0.001, basis: 'Park and Choi 2010 model L3 mass (browser-check.mjs REFERENCE)' },
  { id: 'lowerLobe', label: 'caudal lower lobe / SL', unit: '', min: 0.1, max: 0.6, step: 0.005, basis: 'manifest: lower lobe 0.27 SL, schematic' },
  { id: 'muscleFrac', label: 'flight-muscle fraction of mass', unit: '', min: 0.05, max: 0.6, step: 0.005, basis: 'stand-in 0.25; no flying-fish value in the files' },
  { id: 'gillArea', label: 'gill area factor', unit: '×', min: 0.3, max: 3, step: 0.01, basis: 'stand-in 1 = as built; no gill area in the files' }
];
// ref: browser-check.mjs REFERENCE (Park and Choi 2010 model L3) when the checker loaded; else the grounding numbers
export function baseline(D, ref) {
  const n = D.provenance?.grounding?.parts?.pectoral_fin_L?.numbers || {};
  const g = 9.80665, W = n.W_N ?? 0.5884, S = ref?.liftingArea_m2 ?? n.S_measured_m2 ?? 0.012688, finLen = n.finLengthOverSL ?? 0.687;
  const SL = ref?.SL_m ?? 0.203, mass = ref?.mass_kg ?? W / g;
  return { finLen, finSpan: 1, SL, mass, lowerLobe: 0.27, muscleFrac: 0.25, gillArea: 1,
    _basis: { W_N: mass * g, S_measured_m2: S, CLmax: ref?.CLmax ?? n.CLmax ?? 0.78, LD_max: ref?.LD_max ?? 4.37, rho: n.rho ?? 1.225, vmin_m_s: n.vmin_m_s ?? null, davenport: n.davenportExponents || { massVsSL: 2.981, finAreaVsSL: 1.834, wingLoadingVsSL: 1.236 },
      reference: ref?.name || 'Cypselurus hiraii, Park and Choi 2010 Table 1 model L3',
      SL_note: 'SL ' + SL + ' m, mass ' + mass + ' kg, lifting area ' + S + ' m², C_L,max ' + (ref?.CLmax ?? 0.78) + ' and L/D ' + (ref?.LD_max ?? 4.37) + ' are the measured reference specimen (' + (ref?.name || 'Park and Choi 2010 model L3') + '); the fin length ratio 0.687 is the Daane 2021 median, not this specimen',
      mass_note: 'changes in SL rescale mass by SL^' + (n.davenportExponents?.massVsSL ?? 2.981) + ' (Davenport 1992) unless mass is edited itself' } };
}
// derived quantities from a design; every rule named
export function derive(d, base) {
  const b = base._basis; const e = b.davenport;
  const S = b.S_measured_m2 * Math.pow(d.finLen / base.finLen, 2) * d.finSpan * Math.pow(d.SL / base.SL, 2);
  const W = d.mass * 9.80665;
  return { S_m2: S, W_N: W, wingLoading: W / S, span_m: 0.261 * (d.finLen / base.finLen) * (d.SL / base.SL),
    rules: ['lifting area S = S_L3 × (finLen/finLen_L3)² × chord factor × (SL/SL_L3)²: assumed isometric fin shape (the grounding says Davenport measures fin area ∝ SL^' + e.finAreaVsSL + ' across sizes, so SL changes are not isometric in real fish)', 'span = 0.261 m (Park and Choi L3, physics/flier/spec.json) × fin length ratio × SL ratio', 'weight W = mass × g'] };
}
export function onSLChange(d, base, newSL) { const e = base._basis.davenport.massVsSL; const r = newSL / d.SL; return { ...d, SL: newSL, mass: d.mass * Math.pow(r, e) }; }

// ---------- checker: lean/eliminate/browser-check.mjs (copied to ./browser-check.mjs by the build) ----------
// C9 is checked at one fixed airspeed, 10 m/s (the low end of the 10-20 m/s field speeds the audit uses). That choice is
// the studio's, not Lean's, and the Growth panel says what it hides.
export const AIRSPEED = 10;
// the fin length at which C9 flips at AIRSPEED, for the slider tick (closed form of the same relation)
export function finLenThreshold(d, base) {
  const b = base._basis; const v = AIRSPEED; const needed = 2 * d.mass * 9.80665 / (b.rho * v * v * b.CLmax);
  const S0 = b.S_measured_m2 * d.finSpan * Math.pow(d.SL / base.SL, 2);
  return base.finLen * Math.sqrt(needed / S0);
}
// inputs that no single design can ever supply: the row is shown with its amber icon, but it never glows
const INAPPLICABLE = /fitted exponents|across sizes|a length different from the reference/;
const r4 = x => (typeof x === 'number' ? (Math.abs(x) >= 100 ? x.toFixed(0) : x.toPrecision(4)) : String(x));
const kv = o => Object.entries(o || {}).map(([k, v]) => k.replace(/_/g, ' ') + ' ' + r4(v)).join(', ');
function rowText(x) {
  if (x.id === 'unconstrained-inputs') return 'constrained by no theorem: ' + kv(x.numbers);
  if (x.verdict === 'cannot-evaluate') return 'missing ' + (x.missing_inputs || []).join('; ');
  const n = x.numbers || {}; const imp = Object.keys(n).find(k => /^implied/.test(k));
  if (imp) return `implied exponent ${r4(n[imp])} against ${n.target} (band ±${n.band}, the studio's decision rule)`;
  if (x.id === 'C9') return `at ${n.airspeed_m_s} m/s needs ${n.liftingAreaNeeded_m2.toFixed(5)} m² of lifting area, has ${n.S_m2.toFixed(5)} (v_min ${n.vmin_m_s.toFixed(2)} m/s)`;
  if (x.id === 'C16') return `climb ${r4(n.climbRate_m_s)} m/s against the power bound ${r4(n.climbBound_m_s)} m/s (P_req ${r4(n.powerRequired_W)} W, P_avail ${r4(n.powerAvailable_W)} W)`;
  if (x.needed && x.available) return 'needs ' + kv(x.needed) + '; has ' + kv(x.available);
  return x.note || '';
}
// mod: the imported browser-check.mjs. Returns (design, base) -> rows for the page.
export function adaptChecker(mod) {
  const f = mod && (mod.check || mod.evaluate || mod.default); if (typeof f !== 'function') return null;
  return (d, base) => { const q = derive(d, base), b = base._basis;
    const spec = { SL_m: d.SL, mass_kg: d.mass, fin_length_over_SL: d.finLen, fin_area_m2: q.S_m2, lower_lobe_over_SL: d.lowerLobe, muscle_fraction: d.muscleFrac, airspeed_m_s: AIRSPEED, CL_max: b.CLmax, LD_max: b.LD_max, ...(d._extra || {}) };
    const r = f(spec); const arr = Array.isArray(r) ? r : (r.results || r.verdicts || []);
    return arr.map(x => { const missing = x.missing_inputs || x.missing || []; const unconstrained = x.id === 'unconstrained-inputs';
      return { id: x.id || x.constraint, name: x.relation || x.canEliminate || x.id, theorem: x.theorem || null, law: x.law || null, module: x.module || null,
        verdict: unconstrained ? 'reported' : /^viol/.test(x.verdict) ? 'violated' : /^hold/.test(x.verdict) ? 'holds' : 'cannot-evaluate',
        needed: x.needed ?? null, available: x.available ?? null, numbers: x.numbers || {}, missing, text: rowText(x), formula: x.relation || null, note: x.note || null,
        hypotheses: x.hypotheses || [], scope: x.scope || null, kernel: x.kernel || mod.KERNEL_NOTE || null, faithfulness: x.faithfulness || null,
        noGlow: unconstrained || (x.verdict === 'cannot-evaluate' && missing.length > 0 && missing.every(m => INAPPLICABLE.test(m))),
        pieces_theorem: x.law || x.theorem || null }; }); };
}
// pieces a verdict lights: from lean/morphology-grounding.json, every object whose theorems share the verdict's theorem,
// its law, or the law's stem (Delphi.areaLaw_log ~ Delphi.areaLaw_ratio); C16 (climbRate_le) has no grounding entry and
// lights the flight muscles through powerAvailable_ratio.
const EXTRA_PIECE_THEOREMS = { C16: ['Delphi.powerAvailable_ratio'] };
const stem = s => s.replace(/^Delphi\./, '').split('_')[0];
export function piecesFor(verdict, grounding) {
  if (!grounding || verdict.noGlow) return [];
  const names = [verdict.theorem, verdict.law, verdict.pieces_theorem, ...(EXTRA_PIECE_THEOREMS[verdict.id] || [])].filter(Boolean);
  const stems = new Set(names.filter(n => /^Delphi\.[a-z]/.test(n)).map(stem));
  return Object.entries(grounding.parts).filter(([k, v]) => (v.theorems || []).some(t => names.includes(t.theorem) || (/^Delphi\.[a-z]/.test(t.theorem) && stems.has(stem(t.theorem))))).map(([k]) => k);
}

// ---------- the hypothetical flier (physics/flier/spec.json, copied to ./flier-spec.json) ----------
// Lifting area and span are matched exactly: fin length scales with span (two fins tip to tip: 2 × 0.687 SL is close to
// the measured 0.261 m span), and the chord factor takes the rest of the area change.
export const FLIER_NOTE = 'climb power-limited only until the O2 chain is applied; see /t/physics/sim/?fish=1&phys=1';
export function flierDesign(spec, base) {
  if (!spec || !spec.design) return null; const F = spec.design, v = k => (F[k] && typeof F[k] === 'object' ? F[k].value : F[k]);
  const real = (spec.sources && spec.sources.real_fish) || {}; const spanRatio = v('span_m') / (real.span_m || 0.261);
  const areaRatio = v('lifting_area_m2') / base._basis.S_measured_m2;
  const mpw = spec.bat_muscle_specific_power_derived_W_per_kg ? spec.bat_muscle_specific_power_derived_W_per_kg.max : null;
  return { ...base, finLen: base.finLen * spanRatio, finSpan: areaRatio / (spanRatio * spanRatio), mass: v('mass_kg'), muscleFrac: v('flight_muscle_fraction'), SL: base.SL,
    _flier: { label: F.label || 'HYPOTHETICAL flier', lifting_area_m2: v('lifting_area_m2'), span_m: v('span_m'), wing_loading_N_m2: v('wing_loading_N_m2'), aspect_ratio: v('aspect_ratio'), CL_max: v('CL_max'), LD_max: v('LD_max'), flight_muscle_fraction: v('flight_muscle_fraction'), mass_kg: v('mass_kg'), muscle_power_W_per_kg: mpw, note: spec.note, not_established: spec.what_this_does_not_establish || [], muscle_reason: F.flight_muscle_fraction ? F.flight_muscle_fraction.reason : null },
    _extra: mpw ? { musclePowerPerKg_W: mpw, climbRate_m_s: 1 } : {} };
}

// ---------- conditions (conditions/baseline.json, copied to ./conditions-baseline.json) ----------
export function conditionsRows(raw) {
  if (!raw || !raw.conditions) return null;
  return { title: raw.title, decided: raw.decided, decided_by: raw.decided_by, rule: raw.rule, rows: Object.entries(raw.conditions).map(([k, c]) => ({ key: k, label: k.replace(/_/g, ' ').replace(/\bO2\b/, 'O₂').replace(/ C$/, ' (°C)').replace(/ psu$/, ' (psu)').replace(/ kg m3$/, ' (kg/m³)'), value: c.value, kind: c.kind, note: c.note })) };
}

// ---------- phrase grammar (rule-based; no model) ----------
const NUM = '(\\d+(?:\\.\\d+)?)';
const TARGETS = [
  [/pectoral fins?|fins?(?! area)|wings?/i, 'finLen'], [/fin (?:area|span)|wing (?:area|span)|span/i, 'finSpan'], [/body length|standard length|\bSL\b|longer body|body/i, 'SL'],
  [/mass|weight|heav/i, 'mass'], [/lower lobe|tail lobe|caudal|tail/i, 'lowerLobe'], [/muscle/i, 'muscleFrac'], [/gill/i, 'gillArea']];
export function parsePhrase(text, d) {
  const t = text.trim(); if (!t) return null;
  let target = null; for (const [re, id] of TARGETS) if (re.test(t)) { target = id; break; }
  if (!target) return { ok: false, echo: `I did not recognise what to change in "${t}". Known targets: pectoral fin length, fin span/area, body length (SL), mass, tail lower lobe, muscle fraction, gill area.` };
  const cur = d[target]; let next = null, how = '';
  let m;
  if ((m = t.match(new RegExp(NUM + '\\s*%\\s*(longer|larger|bigger|more|heavier|wider|greater)', 'i')))) { next = cur * (1 + +m[1] / 100); how = `+${m[1]} %`; }
  else if ((m = t.match(new RegExp(NUM + '\\s*%\\s*(shorter|smaller|less|lighter|narrower)', 'i')))) { next = cur * (1 - +m[1] / 100); how = `−${m[1]} %`; }
  else if (/\b(double|twice)\b/i.test(t)) { next = cur * 2; how = '×2'; }
  else if (/\b(triple)\b/i.test(t)) { next = cur * 3; how = '×3'; }
  else if (/\bhalve|half\b/i.test(t)) { next = cur * 0.5; how = '×0.5'; }
  else if ((m = t.match(new RegExp('(?:to|=|of|at)\\s*' + NUM + '\\s*(m|cm|mm|kg|g)?\\b', 'i')))) { let v = +m[1]; const u = (m[2] || '').toLowerCase(); if (u === 'cm') v /= 100; if (u === 'mm') v /= 1000; if (u === 'g') v /= 1000; next = v; how = `set to ${m[1]}${m[2] || ''}`; }
  else if ((m = t.match(new RegExp('\\b(?:by|×|x)\\s*' + NUM, 'i')))) { next = cur * +m[1]; how = `×${m[1]}`; }
  else if (/longer|larger|bigger|more|heavier|wider/i.test(t)) { next = cur * 1.1; how = '+10 % (no amount given)'; }
  else if (/shorter|smaller|less|lighter|narrower/i.test(t)) { next = cur * 0.9; how = '−10 % (no amount given)'; }
  if (next == null) return { ok: false, echo: `I recognised the target (${PARAMS.find(p => p.id === target).label}) but not the amount in "${t}". Try "20% longer", "double", "set to 0.8".` };
  const P = PARAMS.find(p => p.id === target); next = Math.max(P.min, Math.min(P.max, next));
  return { ok: true, target, value: next, echo: `Understood: ${P.label} ${how}: ${fmt(cur, P)} → ${fmt(next, P)}.` };
}
export const fmt = (v, P) => (P.unit === 'kg' ? (v * 1000).toFixed(0) + ' g' : P.unit === 'm' ? (v * 100).toFixed(1) + ' cm' : (P.unit === '×' ? '×' : '') + (+v).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));

// ---------- URL state ----------
export function encodeDesign(d, base) { return Object.keys(base).filter(k => !k.startsWith('_') && Math.abs(d[k] - base[k]) > 1e-9).map(k => k + ':' + (+d[k]).toPrecision(5)).join(','); }
export function decodeDesign(s, base) { const d = { ...base }; if (!s) return d; for (const kv of s.split(',')) { const [k, v] = kv.split(':'); if (k in base && !k.startsWith('_') && isFinite(+v)) d[k] = +v; } return d; }

// ---------- interventions (genotype/interventions.json, copied to ./interventions.json) ----------
// Rules from the Genotype thread (hub, 2026-10-31): only entries with usable_as_a_calibrated_knob = true may move the model
// by a magnitude, and only inside the stage window they were measured in; every other entry shows the paper's own words
// with "no magnitude reported" (never interpolated); number_kind is shown when a number is a dose, penetrance or count;
// paralog_guards are honoured (never one paralog's evidence for the other); a compound level stays its own level.
const arr = v => Array.isArray(v) ? v : v ? [v] : [];
const deent = t => String(t).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// Studio parameter -> interventions.json "parameters" groups
export const PARAM_GROUPS = { finLen: ['pectoral fin length'], finSpan: ['fin area or span', 'fin dorsoventral extent', 'fin anterior-posterior extent'], SL: ['body length'], mass: [], lowerLobe: ['caudal fin'], muscleFrac: [], gillArea: [] };
const NO_ROUTE_MATCH = { finLen: /^pectoral fin length/, finSpan: /^fin area or span/, SL: /^body length/, lowerLobe: /caudal/, muscleFrac: /muscle/, gillArea: /gill/, mass: /mass|weight/ };
const LEVEL_NAMES = ['coding', 'cis-regulatory or expression', 'TF dosage', 'epigenetic', 'pharmacological', 'transgenic overexpression'];
const levelOf = l => LEVEL_NAMES.includes(l) ? l : /combined with/.test(l || '') ? 'compound (cis-regulatory plus coding)' : (l || 'unstated');
// stage window in hours from a stage string: "72-96 hpf", "4 dpf (96-120 h)", "1.0-1.5 dpf", "adult"
export function stageWindow(x) {
  const texts = [...arr(x.effects_by_stage).map(e => e.stage), x.stage && x.stage.age, x.stage && x.stage.stage_text].filter(Boolean).join(' | ');
  if (/\badult|months?\b|reproductively mature/i.test(texts) && !/hpf|dpf/.test(texts.split('|')[0])) return { regime: 'adult', text: texts.split(' | ')[0], h0: null, h1: null };
  let m = texts.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*hpf/); if (m) return { regime: 'embryo / larva', text: texts.split(' | ')[0], h0: +m[1], h1: +m[2] };
  m = texts.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*dpf/); if (m) return { regime: 'embryo / larva', text: texts.split(' | ')[0], h0: 24 * m[1], h1: 24 * m[2] };
  m = texts.match(/(\d+(?:\.\d+)?)\s*hpf/); if (m) return { regime: 'embryo / larva', text: texts.split(' | ')[0], h0: +m[1], h1: +m[1] + 24 };
  m = texts.match(/(\d+(?:\.\d+)?)\s*dpf/); if (m) return { regime: 'embryo / larva', text: texts.split(' | ')[0], h0: 24 * m[1], h1: 24 * m[1] + 24 };
  return { regime: 'unstated', text: texts.split(' | ')[0] || 'stage not reported', h0: null, h1: null };
}
// which model parameter a calibrated knob may move, and by what factor (only morphology magnitudes the model can show)
function knobEffect(x) {
  const e = x.effect_size || {}; if (!x.usable_as_a_calibrated_knob || typeof e.value !== 'number' || e.unit !== '% of wild type') return null;
  if (/^pectoral fin area$/.test(x.parameter)) return { param: 'finSpan', factor: 1 + e.value / 100, label: `pectoral fin area ${e.value >= 0 ? '+' : ''}${e.value} %` };
  return null;
}
export function normaliseInterventions(raw) {
  if (!raw) return null; const rows = raw.interventions || (Array.isArray(raw) ? raw : []);
  if (!rows.length || !('usable_as_a_calibrated_knob' in rows[0])) return null;
  const list = rows.map(x => ({ id: x.id, gene: x.gene, parameter: x.parameter, level: levelOf(x.level), levelRaw: x.level, lesion: x.lesion ? deent(x.lesion) : null, direction: x.direction, grade: x.evidence_grade || 'unstated',
    chain_strength: x.chain ? x.chain.chain_strength : null, weakest_link: x.chain ? x.chain.weakest_link : null, organism: x.organism, stage: stageWindow(x), effect: x.effect_size || null,
    knob: !!x.usable_as_a_calibrated_knob, knobEffect: knobEffect(x), magnitude: x.number_is_a_magnitude === true, number_kind: x.number_kind || null, lethality: x.lethality || null, side_effects: x.side_effects || null,
    pleiotropy: x.pleiotropy || null, designer_note: x.designer_note || null, fin_autonomous: x.fin_autonomous || null,
    sources: arr(x.sources).map(s => ({ ref: [s.first_author, s.year].filter(Boolean).join(' ') || (s.pmid ? 'PMID ' + s.pmid : s.doi ? 'doi ' + s.doi : 'source'), url: s.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + s.pmid + '/' : s.doi ? 'https://doi.org/' + s.doi : null, quote: s.quote ? deent(s.quote) : null, read: s.read || null })) }));
  const byId = Object.fromEntries(list.map(r => [r.id, r]));
  const params = raw.parameters || {};
  const byParam = {};
  for (const [pid, groups] of Object.entries(PARAM_GROUPS)) {
    const ids = [...new Set(groups.flatMap(g => (params[g] && params[g].intervention_ids) || []))];
    const rowsP = ids.map(i => byId[i]).filter(Boolean);
    const byLevel = {}; for (const r of rowsP) (byLevel[r.level] || (byLevel[r.level] = [])).push(r);
    byParam[pid] = { groups, rows: rowsP, byLevel, knobs: rowsP.filter(r => r.knob), noRoute: arr(raw.no_sourced_genetic_route).filter(n => NO_ROUTE_MATCH[pid].test(n.parameter)) };
  }
  const guards = raw.paralog_guards ? { rule: raw.paralog_guards.rule, pairs: Object.entries(raw.paralog_guards.pairs || {}).map(([g, p]) => ({ gene: g, paralog: p.paralog, n_this: p.interventions_for_this_paralog, n_other: p.interventions_for_the_other, note: p.note })) } : null;
  return { source: 'genotype/interventions.json', built: raw.built || null, note: raw.note || null, constraint: raw.constraint || null, vetted: raw.vetted === true, all: list, byParam, guards, coverage: raw.coverage || null, v2: true };
}
// stand-in while interventions.json is absent: candidates derived from causal-chains.json (genes whose chain ends in fin
// length), with chain strength; effect sizes are NOT in that file, and the panel says so
export function standinInterventions(chains) {
  if (!chains) return { source: 'pending', all: [], byParam: {}, note: 'genotype/interventions.json has not been written yet; no sourced genetic route is listed.' };
  const list = Object.values(chains.bySymbol).filter(e => /fin|length|lepidotrich|ray/i.test(JSON.stringify(e.chain.map(c => c.phenotype || c.to)))).map(e => ({ gene: e.symbol, level: 'from the causal chain (level not stated)', allele: (e.chain[0] || {}).from || e.symbol, parameter: 'pectoral fin length', effect: null, effect_text: 'effect size not in causal-chains.json', grade: e.weakest, chain_strength: e.weakest, strongest: e.strongest, organism: (e.chain[0] || {}).organism || null, stage: (e.chain[e.chain.length - 1] || {}).stage || null, sources: [], notes: 'candidate route read from genotype/causal-chains.json, not from interventions.json', flags: [], fromChain: true }));
  return { source: 'stand-in from genotype/causal-chains.json', all: list, byParam: { finLen: list }, note: 'genotype/interventions.json has not been written yet. The candidates below are the genes whose causal chain ends in pectoral fin length; their effect sizes and intervention levels are not in that file.' };
}

// ---------- growth (stand-in until development/ lands) ----------
// von Bertalanffy L(t) = Linf (1 - e^{-K (t - t0)}); stand-in values labelled; mass by SL^massVsSL; fin ratio: adult median
// scaled by an assumed juvenile allometry (fin/SL rises from 0.35 at 2 cm to the adult value), labelled assumed.
export const GROWTH_STANDIN = { Linf_m: 0.30, K_per_year: 1.2, t0_year: -0.05, max_age_years: 3, SL_hatch_m: 0.004, stages: [[0, 'egg'], [0.004, 'larva'], [0.03, 'juvenile'], [0.15, 'adult']],
  note: 'stand-in: von Bertalanffy L∞ 0.30 m, K 1.2 /yr, t0 −0.05 yr are illustrative (FishBase values arrive with development/growth.json); stage thresholds by SL are assumed; the juvenile fin allometry (fin/SL from 0.35 at 2 cm to the adult 0.687) is assumed, not measured' };
export function standinTrajectory(base) {
  const G = GROWTH_STANDIN; const e = base._basis.davenport;
  const at = (t) => { const SL = Math.max(G.SL_hatch_m, G.Linf_m * (1 - Math.exp(-G.K_per_year * (t - G.t0_year)))); const mass = base.mass * Math.pow(SL / base.SL, e.massVsSL);
    const u = Math.max(0, Math.min(1, (SL - 0.02) / (0.15 - 0.02))); const finLen = 0.35 + (base.finLen - 0.35) * u;
    const stage = G.stages.filter(s => SL >= s[0]).pop()[1];
    const parts = { pectoral_fin: SL >= 0.006, fin_rays: SL >= 0.012, caudal_fin: SL >= 0.006, pelvic_fin: SL >= 0.02, scales: SL >= 0.03, gonads: SL >= 0.10, swim_bladder: SL >= 0.006 };
    return { t, SL, mass, finLen, finSpan: 1, stage, parts, genes_active: stage === 'larva' ? ['tbx5a (fin bud, zebrafish proxy)', 'fgf10a', 'shha'] : stage === 'juvenile' ? ['kcnk5b', 'kcnh2a', 'lat4a (slc43a2a)'] : [] }; };
  return { at, source: 'stand-in', note: G.note, max_age: G.max_age_years, ageUnits: 'years' };
}
// development/trajectory.mjs (Development thread): at(ageDays | {SL_m}) -> {ageDays, stage, SL_m, mass_kg, finLength_SL,
// finLength_SL_kind, finArea_m2 (pectoral), vmin_glide_m_s, partsPresent[{part, kind}], embryo}; describe() -> basis rows.
// The page's clock is in years; ages before hatching are negative (embryo, zebrafish-proxy staging).
const PECT_TO_TOTAL = 0.012688 / 0.006377; // Park and Choi L3: total lifting planform / pectoral pair
const PROXY_GENES = { egg: ['tbx5a (fin field, zebrafish proxy)', 'fgf10a', 'fgf24'], hatching: ['tbx5a (fin bud, zebrafish proxy)', 'fgf10a', 'shha'], larva: ['tbx5a (fin bud, zebrafish proxy)', 'fgf10a', 'shha'], juvenile: ['kcnk5b', 'kcnh2a', 'lat4a (slc43a2a)'], adult: [] };
export function adaptTrajectory(mod, base) {
  const f = mod && (mod.at || mod.default); if (typeof f !== 'function') return null;
  const basis = typeof mod.describe === 'function' ? mod.describe() : [];
  const finFitMin = mod.P && mod.P.fin && mod.P.fin.SL_range_cm ? mod.P.fin.SL_range_cm[0] : 1.68;
  const incub = mod.P && mod.P.incubation_d ? mod.P.incubation_d.value : 7;
  const at = t => { const r = f(t * 365); const egg = r.SL_m == null;
    const SL = egg ? 0.003 : r.SL_m, mass = egg ? 1e-6 : r.mass_kg, finLen = egg ? 0.05 : r.finLength_SL;
    const Stot = egg ? 1e-7 : r.finArea_m2 * PECT_TO_TOTAL;
    const finSpan = egg ? 1 : Stot / (base._basis.S_measured_m2 * Math.pow(finLen / base.finLen, 2) * Math.pow(SL / base.SL, 2));
    const names = (r.partsPresent || []).map(p => String(p.part || '').toLowerCase());
    const has = re => names.some(n => re.test(n));
    const parts = egg ? { pectoral_fin: false, fin_rays: false, caudal_fin: false, pelvic_fin: false, gonads: false, swim_bladder: false }
      : { pectoral_fin: has(/pectoral fin/), fin_rays: r.stage !== 'hatching' && r.stage !== 'larva' ? true : has(/ray|lepidotrich/), caudal_fin: true, pelvic_fin: r.stage !== 'hatching', gonads: has(/gonad/), swim_bladder: true };
    const proxy = egg || r.ageDays < 0 || (SL * 100) < finFitMin;
    return { t, ageDays: r.ageDays, SL, mass, finLen, finSpan, stage: r.stage, egg, embryo: r.embryo || null, parts, partsList: r.partsPresent || [], vmin: r.vmin_glide_m_s ?? null, finKind: r.finLength_SL_kind || null,
      proxy, genes_active: PROXY_GENES[r.stage] || [], raw: r }; };
  return { at, source: 'development/trajectory.mjs', note: 'data-driven lookup and fits from development/growth.json, allometry.json and stages.json; not a mechanistic model of development', basis,
    min_age: -incub / 365, max_age: 2, ageUnits: 'years', finFitMin_cm: finFitMin, incubation_d: incub };
}
