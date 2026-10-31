// Design Studio + Growth for Open the Fish. Parameters, scaling rules, a stand-in Lean checker (C9 only, labelled),
// a rule-based phrase grammar, an interventions reader with a labelled stand-in, and a stand-in growth trajectory.
// Every number here is read from data.json (the Lean grounding numbers for specimen L3, the manifest's proportions)
// or is a stand-in that says so. Nothing predicts development; see the banner text exported below.
export const BANNER = 'This maps a change to candidate genetic routes from published experiments in zebrafish/medaka. It is not a predictive genotype-to-phenotype model; development is not simulated.';
export const GROWTH_BANNER = 'Data-driven growth: lengths, proportions and timings from measurements; development itself is not simulated mechanistically.';

// ---------- parameters ----------
// id, label, unit, min, max, step, and where the baseline comes from
export const PARAMS = [
  { id: 'finLen', label: 'pectoral fin length / SL', unit: '', min: 0.2, max: 1.4, step: 0.005, basis: 'Daane 2021 median of 49 flying-fish specimens (manifest evidence_backed)' },
  { id: 'finSpan', label: 'fin span factor (area ∝ length² × span)', unit: '×', min: 0.4, max: 2.5, step: 0.01, basis: 'assumed: 1 = the model as built; area scales with length² times this factor' },
  { id: 'SL', label: 'standard length', unit: 'm', min: 0.05, max: 0.6, step: 0.001, basis: 'specimen L3 standard length, back-computed from the grounding numbers (see basis panel)' },
  { id: 'mass', label: 'body mass', unit: 'kg', min: 0.005, max: 2, step: 0.001, basis: 'specimen L3 weight 0.5884 N / 9.81 (lean/morphology-grounding.json numbers)' },
  { id: 'lowerLobe', label: 'caudal lower lobe / SL', unit: '', min: 0.1, max: 0.6, step: 0.005, basis: 'manifest: lower lobe 0.27 SL, schematic' },
  { id: 'muscleFrac', label: 'flight-muscle fraction of mass', unit: '', min: 0.05, max: 0.6, step: 0.005, basis: 'stand-in 0.25; no flying-fish value in the files' },
  { id: 'gillArea', label: 'gill area factor', unit: '×', min: 0.3, max: 3, step: 0.01, basis: 'stand-in 1 = as built; no gill area in the files' }
];
export function baseline(D) {
  const n = D.provenance?.grounding?.parts?.pectoral_fin_L?.numbers || {};
  const g = 9.81, W = n.W_N ?? 0.5884, S = n.S_measured_m2 ?? 0.012688, finLen = n.finLengthOverSL ?? 0.687;
  // SL for L3 is not in the files; it is back-computed from the Davenport-style relation the grounding carries only as
  // exponents, so it is a stand-in: SL = 0.25 m (Park and Choi 2010 specimens are 0.04-0.06 kg), labelled.
  return { finLen, finSpan: 1, SL: 0.25, mass: W / g, lowerLobe: 0.27, muscleFrac: 0.25, gillArea: 1,
    _basis: { W_N: W, S_measured_m2: S, CLmax: n.CLmax ?? 0.78, rho: n.rho ?? 1.225, vmin_m_s: n.vmin_m_s ?? null, davenport: n.davenportExponents || { massVsSL: 2.981, finAreaVsSL: 1.834, wingLoadingVsSL: 1.236 },
      SL_note: 'SL 0.25 m is a stand-in (no specimen length in the files); only ratios of SL are evidence-backed', mass_note: 'mass from specimen L3 weight; changes in SL rescale mass by SL^' + (n.davenportExponents?.massVsSL ?? 2.981) + ' (Davenport 1992) unless mass is edited itself' } };
}
// derived quantities from a design; every rule named
export function derive(d, base) {
  const b = base._basis; const e = b.davenport;
  const S = b.S_measured_m2 * Math.pow(d.finLen / base.finLen, 2) * d.finSpan * Math.pow(d.SL / base.SL, 2);
  const W = d.mass * 9.81;
  return { S_m2: S, W_N: W, wingLoading: W / S,
    rules: ['lifting area S = S_L3 × (finLen/finLen_L3)² × span × (SL/SL_L3)²: assumed isometric fin shape (the grounding says Davenport measures fin area ∝ SL^' + e.finAreaVsSL + ' across sizes, so SL changes are not isometric in real fish)', 'weight W = mass × g'] };
}
export function onSLChange(d, base, newSL) { const e = base._basis.davenport.massVsSL; const r = newSL / d.SL; return { ...d, SL: newSL, mass: d.mass * Math.pow(r, e) }; }

// ---------- stand-in checker: C9 only, same formula as Delphi.vmin_le, NOT kernel-checked ----------
export const STANDIN_AIRSPEED = 10;
export function standinCheck(d, base) {
  const b = base._basis, q = derive(d, base); const v = STANDIN_AIRSPEED;
  const needed = 2 * q.W_N / (b.rho * v * v * b.CLmax);
  const out = [];
  out.push({ id: 'C9', name: 'v_min lift bound (vmin_le)', theorem: 'Delphi.vmin_le', module: 'lean/Delphi/Scaling.lean', verdict: q.S_m2 >= needed ? 'holds' : 'violated',
    needed, available: q.S_m2, unit: 'm²', airspeed: v, text: `at ${v} m/s needs ${needed.toFixed(5)} m² of lifting area, has ${q.S_m2.toFixed(5)}`,
    formula: 'S ≥ 2W/(ρ v² C_L,max), ρ ' + b.rho + ', C_L,max ' + b.CLmax + ', v ' + v + ' m/s (stand-in airspeed)', pieces_theorem: 'Delphi.Constraints.vmin_rules_out', standin: true });
  for (const [id, name, theorem, missing, pt] of [
    ['R9', 'fin-ray bending (bendingStress_ratio_sheet)', 'Delphi.bendingStress_ratio_sheet', ['ray cross-section', 'ray material strength σ_max', 'reference safety factor'], 'Delphi.Constraints.bending_exponent_rules_out'],
    ['R7', 'girdle axial strength (axial_strength_rules_out)', 'Delphi.Constraints.axial_strength_rules_out', ['member cross-section', 'material strength σ', 'reference safety factor'], 'Delphi.Constraints.axial_strength_rules_out'],
    ['C10', 'power required vs muscle power (powerRequired_ratio)', 'Delphi.powerRequired_ratio', ['muscle mass-specific power', 'lift-to-drag ratio'], null]])
    out.push({ id, name, theorem, module: 'lean/Delphi/Scaling.lean', verdict: 'cannot-evaluate', missing, text: 'cannot evaluate: ' + missing.join(', ') + ' not in the files', pieces_theorem: pt, standin: true });
  return out;
}
// the fin length at which C9 flips, for the handle tick (closed form of the stand-in)
export function finLenThreshold(d, base) {
  const b = base._basis; const v = STANDIN_AIRSPEED; const needed = 2 * d.mass * 9.81 / (b.rho * v * v * b.CLmax);
  const S0 = b.S_measured_m2 * d.finSpan * Math.pow(d.SL / base.SL, 2);
  return base.finLen * Math.sqrt(needed / S0);
}
// adapter for lean/eliminate/browser-check.mjs when it exists: accepts check(design) or evaluate(design)
export function adaptChecker(mod) {
  const f = mod && (mod.check || mod.evaluate || mod.default); if (typeof f !== 'function') return null;
  return (d, base) => { const q = derive(d, base); const r = f({ SL_m: d.SL, mass_kg: d.mass, fin_length_over_SL: d.finLen, fin_area_m2: q.S_m2, lower_lobe_over_SL: d.lowerLobe, muscle_fraction: d.muscleFrac, gill_area_factor: d.gillArea, airspeed_m_s: STANDIN_AIRSPEED, weight_N: q.W_N });
    const arr = Array.isArray(r) ? r : (r.results || r.verdicts || []);
    return arr.map(x => ({ id: x.id || x.constraint || x.name, name: x.name || x.property || x.id, theorem: x.theorem || x.lemma || null, module: x.module || null, verdict: /^viol/.test(x.verdict) ? 'violated' : /^hold/.test(x.verdict) ? 'holds' : 'cannot-evaluate', needed: x.needed ?? null, available: x.available ?? null, unit: x.unit || null, missing: x.missing_inputs || x.missing || [], text: x.text || x.reason || (x.needed != null ? `needs ${x.needed}, has ${x.available}` : (x.missing_inputs || []).join(', ')), formula: x.formula || null, pieces_theorem: x.pieces_theorem || x.theorem || null, standin: false })); };
}
// pieces a verdict lights: from lean/morphology-grounding.json, every object whose theorems include the verdict's theorem
export function piecesFor(verdict, grounding) {
  if (!grounding) return []; const names = [verdict.theorem, verdict.pieces_theorem].filter(Boolean);
  return Object.entries(grounding.parts).filter(([k, v]) => (v.theorems || []).some(t => names.includes(t.theorem))).map(([k]) => k);
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

// ---------- interventions (genotype/interventions.json) ----------
const arr = v => Array.isArray(v) ? v : v ? [v] : [];
export function normaliseInterventions(raw) {
  if (!raw) return null; const rows = raw.interventions || raw.routes || raw.entries || (Array.isArray(raw) ? raw : []);
  const LEVELS = { coding: 'coding change', allele: 'coding change', cis: 'cis-regulatory / expression', regulatory: 'cis-regulatory / expression', expression: 'cis-regulatory / expression', tf: 'transcription-factor dosage', dosage: 'transcription-factor dosage', epigenetic: 'epigenetic', silencing: 'epigenetic' };
  const list = rows.map(x => ({ gene: x.gene || x.symbol, level: LEVELS[String(x.level || x.kind || '').toLowerCase().split(/[ _-]/)[0]] || x.level || 'unstated', allele: x.allele || x.intervention || x.description || null, parameter: x.parameter || x.target || x.phenotype_parameter || null,
    effect: x.effect_size ?? x.effect ?? null, effect_unit: x.effect_unit || x.unit || null, effect_text: x.effect_text || x.measured_effect || null, direction: x.direction || null, grade: x.grade || x.evidence_grade || 'unstated', organism: x.organism || null, stage: x.stage || x.onset_stage || x.stage_measured || null, stages: x.stages || null,
    sources: arr(x.sources || x.source).map(s => typeof s === 'string' ? { ref: s } : { ref: s.pmid ? 'PMID ' + s.pmid : s.doi ? 'doi ' + s.doi : s.ref || null, url: s.url || (s.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + s.pmid + '/' : s.doi ? 'https://doi.org/' + s.doi : null), quote: s.quote || null }), notes: x.notes || null, flags: arr(x.flags) })).filter(r => r.gene);
  return { source: 'genotype/interventions.json', built: raw.built || null, note: raw.note || null, vetted: raw.vetted === true, all: list, byParam: list.reduce((a, r) => { const k = paramKey(r.parameter); (a[k] || (a[k] = [])).push(r); return a; }, {}) };
}
const paramKey = p => { const s = String(p || '').toLowerCase(); return /fin.*(length|ratio)|pectoral/.test(s) ? 'finLen' : /area|span/.test(s) ? 'finSpan' : /mass|weight/.test(s) ? 'mass' : /standard length|\bsl\b|body length/.test(s) ? 'SL' : /lobe|caudal|tail/.test(s) ? 'lowerLobe' : /muscle/.test(s) ? 'muscleFrac' : /gill/.test(s) ? 'gillArea' : 'other'; };
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
export function adaptTrajectory(mod, base) { const f = mod && (mod.at || mod.default); if (typeof f !== 'function') return null;
  return { at: t => { const r = f(t); return { t, SL: r.SL_m ?? r.SL, mass: r.mass_kg ?? r.mass, finLen: r.fin_ratio ?? r.finLen ?? base.finLen, finSpan: 1, stage: r.stage || '', parts: r.parts || r.parts_present || {}, genes_active: r.genes || r.genes_active || [] }; }, source: 'development/trajectory.mjs', note: mod.note || mod.NOTE || null, max_age: mod.max_age || mod.MAX_AGE || 3, ageUnits: mod.age_units || 'years' }; }
