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
const USED = ['C9', 'C7b', 'C2a', 'C8e', 'C8c', 'C14', 'C14b', 'C15', 'C16', 'C13', 'C10', 'C9c', 'G1', 'G2', 'G3', 'G4', 'G5', 'E2', 'E3', 'E4', 'E7', 'P1', 'P1b', 'P2', 'P2b', 'P3', 'P3b', 'P4', 'P4b', 'P5'];
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

// Declarative rows: every law whose file carries a `browser_check` block (filled in below, after DECLARED is
// built from the registry, because the data comes from the law files themselves).
const DECLARED_FRAGMENT_TEMPLATE = fs.readFileSync(path.join(here, 'browser-check-declared.fragment.mjs'), 'utf8');

// The perturbation laws (lean/Delphi/Perturb.lean) and their sources (lean/perturb-sources.json).
const PS = JSON.parse(fs.readFileSync(path.join(root, 'lean/perturb-sources.json'), 'utf8'));
const PERTURB_SLIM = { module: PS.module, fetched: PS.fetched, rule: PS.rule, sources: Object.fromEntries(Object.entries(PS.sources).map(([k, v]) => [k, { pmid: v.pmid, doi: v.doi, authors: v.authors, year: v.year, title: v.title, quote: v.quote }])), notFormalised: PS.notFormalised };
const PERTURB_FRAGMENT = fs.readFileSync(path.join(here, 'browser-check-perturb.fragment.mjs'), 'utf8')
  .split('__PERTURB__').join(JSON.stringify(PERTURB_SLIM, null, 1))
  .replace(/^\/\/ FRAGMENT[\s\S]*?placeholder[^\n]*\n/m, '// ---- perturbation rows (generated from lean/eliminate/browser-check-perturb.fragment.mjs) ----\n');

// The law registry (lean/registry/README.md): which law each constraint belongs to, that law's version, kind,
// status and scope in every released law set. check() judges against one law set (default: current).
const REGDIR = path.join(root, 'lean/registry');
const REG_CUR = JSON.parse(fs.readFileSync(path.join(REGDIR, 'lawsets/current.json'), 'utf8'));
const REG_LAWS = fs.readdirSync(path.join(REGDIR, 'laws')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(REGDIR, 'laws', f), 'utf8')));
const LAWSETS = Object.fromEntries(fs.readdirSync(path.join(REGDIR, 'lawsets')).filter(f => /^lawset-\d+\.\d+\.\d+\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(REGDIR, 'lawsets', f), 'utf8')))
  .map(ls => [ls.version, { created: ls.created, laws: Object.fromEntries(ls.laws.map(l => [l.law_id, { version: l.version, status: l.status, kind: l.kind, content_hash: l.content_hash }])) }]));
if (!LAWSETS[REG_CUR.version]) throw new Error('lean/registry/lawsets/current.json names a missing law set ' + REG_CUR.version);
// Declarative checks: a law file may carry an optional `browser_check` block, and the row for it is generated
// from that block instead of from a hand-written formula below. This is the ONLY way a new law reaches the
// evaluator without a code edit, which is what a living law base needs; see
// lean/eliminate/browser-check-declared.fragment.mjs and lean/registry/README.md.
const DECLARED = [];
for (const l of REG_LAWS) {
  const d = l.browser_check;
  if (!d) continue;
  const cid = d.constraint;
  if (!cid) throw new Error(`${l.law_id}: browser_check has no constraint id`);
  if (meta[cid]) throw new Error(`${l.law_id}: browser_check.constraint "${cid}" is already a constraint of lean/constraints.json (hand-written row); pick a new id`);
  if (DECLARED.some(x => x.constraint === cid)) throw new Error(`${l.law_id}: browser_check.constraint "${cid}" is already declared by ${DECLARED.find(x => x.constraint === cid).law_id}`);
  if (!(l.constraints || []).includes(cid)) throw new Error(`${l.law_id}: browser_check.constraint "${cid}" is not listed in the law's own "constraints" array, so no caller would map the row back to the law`);
  DECLARED.push({ ...d, law_id: l.law_id, lookups: (d.lookups || []).map(k => resolveLookup(l.law_id, k)) });
}

/**
 * A declarative check may bring its OWN data source: a reference table keyed by the design's taxon (or any
 * other design field), resolved HERE, at generation time, and embedded in the generated module as plain data,
 * so browser-check.mjs stays dependency-free and the browser never fetches anything. A law that needs a
 * reference value no engine state carries (von Bertalanffy Linf per species, say) can then bind with no code
 * edit, which is the point of the whole mechanism.
 *
 * The resolved table carries the file, the locator of every row it used and which row won, so the verdict can
 * say WHOSE number decided it: a reference value chosen silently is the same false assurance as a law that
 * evaluates nothing.
 */
function resolveLookup(lawId, k) {
  const where = `${lawId} browser_check.lookups["${k.name || '?'}"]`;
  for (const req of ['name', 'file', 'rows', 'match', 'row_key', 'value']) if (!k[req]) throw new Error(`${where}: ${req} is required`);
  const dig = (o, p) => String(p).split('.').reduce((x, s) => (x == null ? x : x[s]), o);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(root, k.file), 'utf8')); }
  catch (e) { throw new Error(`${where}: cannot read ${k.file}: ${e.message}`); }
  const raw = dig(doc, k.rows);
  if (!raw) throw new Error(`${where}: ${k.file} has nothing at "${k.rows}"`);
  const rows = Array.isArray(raw) ? raw : Object.entries(raw).map(([key, v]) => (v && typeof v === 'object' ? { ...v, [k.row_key]: v[k.row_key] ?? key } : { [k.row_key]: key, value: v }));
  const scale = k.scale == null ? 1 : k.scale;
  if (typeof scale !== 'number' || !Number.isFinite(scale)) throw new Error(`${where}: scale must be a finite number`);
  const select = k.select || 'first';
  if (!['first', 'min', 'max'].includes(select)) throw new Error(`${where}: select must be first, min or max`);
  const table = {}, used = {};
  for (const r of rows) {
    const key = dig(r, k.row_key);
    if (key == null) continue;
    if (k.where && !Object.entries(k.where).every(([f, v]) => dig(r, f) === v)) continue;
    const v = dig(r, k.value);
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const scaled = v * scale;
    const prev = table[key];
    if (prev === undefined || (select === 'max' && scaled > prev) || (select === 'min' && scaled < prev)) {
      table[key] = scaled;
      used[key] = { raw: v, scaled, locator: dig(r, k.locator || 'Linf.locator') ?? dig(r, 'locator') ?? null };
    }
  }
  if (!Object.keys(table).length) throw new Error(`${where}: no row of ${k.file}:${k.rows} gave a finite ${k.value}${k.where ? ` under where ${JSON.stringify(k.where)}` : ''}`);
  if (k.fallback_key && table[k.fallback_key] === undefined) throw new Error(`${where}: fallback_key "${k.fallback_key}" is not one of the resolved keys (${Object.keys(table).join(', ')})`);
  return { name: k.name, match: k.match, unit: k.unit ?? null, select, scale, table, rows_used: used,
    aliases: k.aliases || {}, fallback_key: k.fallback_key ?? null,
    source: { file: k.file, rows: k.rows, row_key: k.row_key, value: k.value, where: k.where ?? null, n_keys: Object.keys(table).length },
    note: k.note ?? null };
}
const DECLARED_IDS = DECLARED.map(d => d.constraint);
for (const d of DECLARED) meta[d.constraint] = { constraint: d.constraint, theorem: null, law: d.law_id, module: null,
  relation: d.relation || null, band: d.band || 'empirical', empirical: d.band !== 'proved' || null, constraintStatus: 'declared',
  scope: null, hypotheses: d.note || null, faithfulness: null, canEliminate: null, declared: true };

const CONSTRAINT_LAW = {};
for (const l of REG_LAWS) for (const c of l.constraints || []) if (USED.includes(c) || DECLARED_IDS.includes(c)) CONSTRAINT_LAW[c] = l.law_id;
const LAW_INFO = Object.fromEntries(REG_LAWS.filter(l => Object.values(CONSTRAINT_LAW).includes(l.law_id)).map(l => [l.law_id, { label: l.label || null, statement_en: l.statement_en, kind: l.kind, scope: { taxa: l.scope.taxa, life_stages: l.scope.life_stages || [], ranges: l.scope.ranges || {}, basis: l.scope.basis || null, applies_to: l.scope.applies_to || [], excludes: l.scope.excludes || [] }, constraint_scopes: l.constraint_scopes || {} }]));
const DECLARED_FRAGMENT = DECLARED_FRAGMENT_TEMPLATE
  .split('__DECLARED__').join(JSON.stringify(DECLARED, null, 1))
  .replace(/^\/\/ FRAGMENT[\s\S]*?a law file cannot run code in the Studio\.\n/m,
    '// ---- declarative rows (generated from lean/eliminate/browser-check-declared.fragment.mjs; data from each law file\'s browser_check block) ----\n');
const unlawed = USED.filter(u => !CONSTRAINT_LAW[u]);
if (unlawed.length) console.warn('warning: constraints with no registry law (rows carry law: null and are judged as before): ' + unlawed.join(', '));
const LAWSET_FRAGMENT = fs.readFileSync(path.join(here, 'browser-check-lawset.fragment.mjs'), 'utf8')
  .split('__LAWSET_VERSION__').join(JSON.stringify(REG_CUR.version))
  .split('__LAWSETS__').join(JSON.stringify(LAWSETS, null, 1))
  .split('__CONSTRAINT_LAW__').join(JSON.stringify(CONSTRAINT_LAW, null, 1))
  .split('__LAW_INFO__').join(JSON.stringify(LAW_INFO, null, 1))
  .replace(/^\/\/ FRAGMENT[\s\S]*?placeholders[^\n]*\n/m, '// ---- law-set judgement (generated from lean/eliminate/browser-check-lawset.fragment.mjs; data from lean/registry) ----\n');

const BASE = JSON.parse(fs.readFileSync(path.join(root, 'conditions/baseline.json'), 'utf8'));
const REF_RHO = BASE.conditions.air_density_kg_m3.value, REF_G = 9.80665, EXP_BAND = 0.1;
// NEAR-SINGULAR IMPLIED EXPONENTS. C7b, C2a, C8e, C9c and E2 divide by ln(L/L_ref) against the single reference
// specimen, so as L approaches L_ref the denominator approaches zero and ordinary specimen variation is amplified
// without limit: the real Park and Choi siblings L1 (length ratio 1.0099) and L2 (1.0296) came out at implied v_min
// exponents of -1.43 and -3.86 against a target of 0.5 +/- 0.1, and model N (0.9951) at -60.8, so accepted laws
// fired red on unedited wild-type flying fish. A relative measurement uncertainty sigma in L moves an implied
// exponent by about sigma / |ln(L/L_ref)|, so the comparison carries no information until |ln(L/L_ref)| >=
// sigma / band. With sigma 1% and the studio's 0.1 band that is a length ratio outside [0.905, 1.105]. The registry
// states it per constraint (constraint_scopes[<id>].ranges.length_ratio_vs_reference.exclude_between) and the scope
// check turns those rows grey; this constant only records the number beside them.
const SINGULARITY = { sigma_rel: 0.01, band: EXP_BAND, ln_min: 0.01 / EXP_BAND,
  ratio_lo: +Math.exp(-0.01 / EXP_BAND).toFixed(4), ratio_hi: +Math.exp(0.01 / EXP_BAND).toFixed(4) };
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
// Perturbation fields (P1-P5, lean/Delphi/Perturb.lean, sources in lean/perturb-sources.json): see checkPerturb below.
// Reference specimen for scaling comparisons: ${REF.name}.

export const KERNEL_NOTE = 'evaluates the same formulas; not a kernel check: kernel certificates exist only for the recorded examples';
export const REFERENCE = ${JSON.stringify(REF, null, 1)};
export const META = ${JSON.stringify(Object.fromEntries([...USED, ...DECLARED_IDS].map(u => [u, meta[u]])), null, 1)};
export const ENVIRONMENT = ${JSON.stringify(ENV, null, 1)};
export const DEFAULTS = { rho: ${REF_RHO}, g: ${REF_G}, groundEffect: 0, exponentBand: ${JSON.stringify(EXP_BAND)} };
/** Why an implied exponent against the reference specimen is not evaluated near a unit length ratio. */
export const SINGULARITY = ${JSON.stringify(SINGULARITY)};
// Design Studio field names (Viz): design = {SL_m, mass_kg, fin_length_over_SL, fin_area_m2, lower_lobe_over_SL, muscle_fraction, gill_area_m2, airspeed_m_s}.
// Aliases map them onto the spec fields; fin_length_over_SL and lower_lobe_over_SL are accepted and reported but no theorem constrains them.
const ALIASES = { fin_area_m2: 'finArea_m2', muscle_fraction: 'flightMuscleFraction', gill_area_m2: 'gillArea_m2', fin_length_over_SL: 'finLength_SL', lower_lobe_over_SL: 'lowerLobe_SL', CL_max: 'CLmax', LD: 'LD_max', glide_height_m: 'glideHeight_m', glide_distance_m: 'glideDistance_m', ground_effect: 'groundEffect', climb_rate_m_s: 'climbRate_m_s', power_available_W: 'powerAvailable_W', power_required_W: 'powerRequired_W', aerobic_ceiling_W: 'aerobicCeiling_W', cardiac_output: 'cardiacOutput', arterial_O2: 'arterialO2', oxycaloric: 'oxycaloric_J_per_unit_O2', reference_safety_factor: 'referenceSafetyFactor' };
export function normalise(design) { const s = {}; for (const [k, v] of Object.entries(design || {})) s[ALIASES[k] || k] = v; return s; }

/** Lifting area a weight W (N) needs at airspeed v (m/s): S >= 2 W / (rho v^2 CLmax). Theorem Delphi.vmin_le, rearranged. */
export function liftingAreaNeeded(W_N, v, rho, CLmax) { return 2 * W_N / (rho * v * v * CLmax); }
/** Minimum airspeed: sqrt(2 W / (rho S CLmax)). Delphi.vmin. */
export function vmin(W_N, S, rho, CLmax) { return Math.sqrt(2 * W_N / (rho * S * CLmax)); }

const num = x => typeof x === 'number' && Number.isFinite(x);
/**
 * Does the design claim SUSTAINED POWERED flight? The aerobic bounds (C14, E3) cap the power an animal can supply
 * from metabolism, so they apply to a METABOLIC demand: powered level or climbing flight, or sustained swimming.
 * An unpowered glide spends potential and kinetic energy, not ATP, so W v / (L/D) computed for a descent is not a
 * demand those laws bound, and firing them on a real gliding flying fish is an application error, not a violation
 * (it happened: Park and Choi specimens making realistic glide claims came back red). Returns
 * {powered, unpowered, reason}: powered only when the design says so, unpowered when it claims glide geometry
 * (or flight_mode 'glide' / powered: false) and claims no power source or climb.
 */
function flightMode(s) {
  const says = s.flight_mode || (s.powered === true ? 'powered' : s.powered === false ? 'glide' : null);
  const poweredClaim = says === 'powered' || num(s.powerAvailable_W) || (num(s.climbRate_m_s) && s.climbRate_m_s > 0)
    || num(s.musclePowerPerKg_W) || num(s.cardiacOutput) && says === 'powered';
  const glideClaim = says === 'glide' || says === 'unpowered'
    || (!poweredClaim && (num(s.glideHeight_m) || num(s.glideDistance_m)));
  if (poweredClaim) return { powered: true, unpowered: false, reason: says === 'powered' ? 'flight_mode: powered' : num(s.powerAvailable_W) ? 'powerAvailable_W given' : num(s.climbRate_m_s) && s.climbRate_m_s > 0 ? 'a positive climb rate is claimed' : 'a muscle power source is given' };
  if (glideClaim) return { powered: false, unpowered: true, reason: says ? ('flight_mode: ' + says) : 'glide geometry is given (glideHeight_m / glideDistance_m) and no power source or climb is claimed' };
  return { powered: false, unpowered: false, reason: 'the design does not say whether the flight is powered; pass flight_mode: "powered" or "glide"' };
}
// Floating-point tolerance for comparisons against a COMPUTED bound: the same formula evaluated in a different
// operation order can differ by an ulp, and a correct design must not turn red on rounding. Relative 1e-9 of the
// larger magnitude (sign-safe, so negative bounds work). Comparisons of raw inputs with fixed constants or of
// integers stay exact. This is a check tolerance, not a law change (lean/registry/CHANGELOG.md, lawset 1.5.0 note).
export const REL_TOL = 1e-9;
function leTol(a, b) { return a <= b + REL_TOL * Math.max(Math.abs(a), Math.abs(b)); }
function geTol(a, b) { return leTol(b, a); }
// Result shape (Viz): {id, verdict, needed, available, missing_inputs, theorem, module, ...}. "needed" and "available" are the two
// sides of the relation where it has that form (what the design must supply vs what it does), else null.
const result = (id, verdict, numbers, missing, note, sides) => ({ id, ...META[id], verdict, needed: sides ? sides.needed : null, available: sides ? sides.available : null, missing_inputs: missing, missing, numbers, note: note || null, kernel: KERNEL_NOTE });

${FRAGMENT}
${EMP_FRAGMENT}
${PERTURB_FRAGMENT}
${DECLARED_FRAGMENT}
${LAWSET_FRAGMENT}
/** check(design, {lawset, includeCandidates}): every row judged against a law set (see judgeRows). checkRaw(design) is the formulas alone. */
export function check(design, opts = {}) { return judgeRows(checkRaw(design), design, normalise(design), opts); }
export function checkRaw(design) {
  const s = { ...DEFAULTS, ...normalise(design) };
  const out = [];
  const unconstrained = ['finLength_SL', 'lowerLobe_SL'].filter(k => num(s[k])).map(k => ({ field: k, value: s[k], note: 'accepted, reported, constrained by no theorem (fin length ratio and caudal lobe ratio are inputs the model carries; see lean/morphology-grounding.json)' }));
  if (unconstrained.length) out.push({ id: 'unconstrained-inputs', verdict: 'cannot-evaluate', needed: null, available: null, missing_inputs: [], missing: [], numbers: Object.fromEntries(unconstrained.map(u => [u.field, u.value])), note: unconstrained.map(u => u.note).join('; '), theorem: null, module: null, kernel: KERNEL_NOTE });
  const mode = flightMode(s);
  // Non-positive size inputs are treated as MISSING, not as zero: a zero mass, area or length makes a bound
  // infinite and every row would silently "hold" (a false negative, the mirror of the near-singular false positive).
  const pos = x => num(x) && x > 0;
  const W = pos(s.mass_kg) ? s.mass_kg * s.g : null;
  const S = pos(s.finArea_m2) ? s.finArea_m2 : (pos(s.pectoralFinArea_m2) ? s.pectoralFinArea_m2 + (s.pelvicFinArea_m2 || 0) + (s.bodyPlanformArea_m2 || 0) : null);

  // C9: minimum speed, exact and dimensional.
  { const miss = []; if (W === null) miss.push('mass_kg'); if (S === null) miss.push('finArea_m2'); if (!num(s.CLmax)) miss.push('CLmax'); if (!num(s.airspeed_m_s)) miss.push('airspeed_m_s');
    if (miss.length) out.push(result('C9', 'cannot-evaluate', { W_N: W, S_m2: S }, miss));
    else { const vm = vmin(W, S, s.rho, s.CLmax), need = liftingAreaNeeded(W, s.airspeed_m_s, s.rho, s.CLmax);
      out.push(result('C9', geTol(s.airspeed_m_s, vm) ? 'holds' : 'violated', { W_N: W, S_m2: S, CLmax: s.CLmax, rho: s.rho, airspeed_m_s: s.airspeed_m_s, vmin_m_s: vm, liftingAreaNeeded_m2: need }, [], geTol(s.airspeed_m_s, vm) ? 'lift can equal weight at some C_L <= CLmax' : 'below the minimum speed: lift cannot reach the weight even at CLmax', { needed: { liftingArea_m2: need, or_airspeed_m_s: vm }, available: { liftingArea_m2: S, airspeed_m_s: s.airspeed_m_s } })); } }

  // Scaling relative to the reference specimen (implied exponents): C7b mass, C2a lifting area, C8e wing loading, C9c v_min.
  const lr = pos(s.SL_m) ? s.SL_m / REFERENCE.SL_m : null;
  const expo = (x, xref) => (lr && lr !== 1 && num(x) && x > 0) ? Math.log(x / xref) / Math.log(lr) : null;
  const band = (b, target) => b === null ? 'cannot-evaluate' : (leTol(Math.abs(b - target), s.exponentBand) ? 'holds' : 'violated');
  { const b = expo(W, REFERENCE.mass_kg * s.g);
    out.push(result('C7b', lr === null ? 'cannot-evaluate' : lr === 1 ? 'cannot-evaluate' : band(b, 3), { lengthRatio: lr, length_ratio_vs_reference: lr, impliedMassExponent: b, target: 3, band: s.exponentBand }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : W === null ? ['mass_kg'] : [], 'implied exponent log(W/W_ref)/log(SL/SL_ref) against the cube law; the band is the studio decision rule, not a theorem')); }
  { const b = expo(S, REFERENCE.liftingArea_m2);
    out.push(result('C2a', lr === null || lr === 1 ? 'cannot-evaluate' : band(b, 2), { lengthRatio: lr, length_ratio_vs_reference: lr, impliedAreaExponent: b, target: 2, band: s.exponentBand }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : S === null ? ['finArea_m2'] : [], 'implied lifting-area exponent against isometry (2); Davenport 1992 measured 1.834 within one species')); }
  { const b = (W !== null && S !== null) ? expo(W / S, REFERENCE.mass_kg * s.g / REFERENCE.liftingArea_m2) : null;
    out.push(result('C8e', lr === null || lr === 1 ? 'cannot-evaluate' : band(b, 1), { lengthRatio: lr, length_ratio_vs_reference: lr, impliedWingLoadingExponent: b, target: 1, band: s.exponentBand }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : [W === null ? 'mass_kg' : null, S === null ? 'finArea_m2' : null].filter(Boolean), 'implied wing-loading exponent against isometry (1); Davenport 1992 measured 1.236')); }
  { const vm = (W !== null && S !== null && num(s.CLmax)) ? vmin(W, S, s.rho, s.CLmax) : null, vref = vmin(REFERENCE.mass_kg * s.g, REFERENCE.liftingArea_m2, s.rho, REFERENCE.CLmax);
    const b = vm === null ? null : expo(vm, vref);
    out.push(result('C9c', lr === null || lr === 1 ? 'cannot-evaluate' : band(b, 0.5), { lengthRatio: lr, length_ratio_vs_reference: lr, impliedVminExponent: b, target: 0.5, band: s.exponentBand, vmin_m_s: vm, vminReference_m_s: vref }, lr === null ? ['SL_m'] : lr === 1 ? ['a length different from the reference'] : vm === null ? ['mass_kg, finArea_m2, CLmax'] : [], 'implied v_min exponent against the isometric 1/2 (R4); with Davenport\\'s exponents the predicted value is 0.57')); }

  // C8c: Galileo's giant, needs a reference safety factor.
  { if (lr === null) out.push(result('C8c', 'cannot-evaluate', {}, ['SL_m']));
    else if (!num(s.referenceSafetyFactor)) out.push(result('C8c', 'cannot-evaluate', { lengthRatio: lr }, ['referenceSafetyFactor'], 'no breaking stress or section data exists for flying fish; a reference safety factor must be committed'));
    else { const sf = s.referenceSafetyFactor / lr; out.push(result('C8c', geTol(sf, 1) ? 'holds' : 'violated', { lengthRatio: lr, referenceSafetyFactor: s.referenceSafetyFactor, scaledSafetyFactor: sf }, [], 'scaled safety factor = reference / length ratio under isometric sections and the same material (R7)', { needed: { safetyFactor: 1 }, available: { safetyFactor: sf } })); } }

  // C15: glide range.
  { const miss = []; for (const k of ['glideHeight_m', 'LD_max', 'glideDistance_m']) if (!num(s[k])) miss.push(k);
    if (miss.length) out.push(result('C15', 'cannot-evaluate', {}, miss));
    else if (!(s.groundEffect < 1)) out.push(result('C15', 'cannot-evaluate', { groundEffect: s.groundEffect }, ['groundEffect < 1'], 'a ground-effect fraction of 1 or more makes the range bound infinite, so nothing could ever be ruled out; the glide model needs delta < 1'));
    else { const bound = s.glideHeight_m * s.LD_max / (1 - s.groundEffect); out.push(result('C15', leTol(s.glideDistance_m, bound) ? 'holds' : 'violated', { glideHeight_m: s.glideHeight_m, LD_max: s.LD_max, groundEffect: s.groundEffect, bound_m: bound, glideDistance_m: s.glideDistance_m }, [], 'one steady unpowered glide; taxiing thrust, repeated touch-and-go and wind are outside the model', { needed: { glideDistance_m: s.glideDistance_m }, available: { glideRange_m: bound } })); } }

  // Power required and available, C16 climb, C14 aerobic.
  const LD = num(s.LD_max) ? s.LD_max : (num(s.LD) ? s.LD : null);
  const Preq = (W !== null && num(s.airspeed_m_s) && LD) ? W * s.airspeed_m_s / LD : (num(s.powerRequired_W) ? s.powerRequired_W : null);
  const Pavail = num(s.powerAvailable_W) ? s.powerAvailable_W : (num(s.flightMuscleFraction) && num(s.musclePowerPerKg_W) && num(s.mass_kg) ? s.flightMuscleFraction * s.musclePowerPerKg_W * s.mass_kg : null);
  { const miss = []; if (Preq === null) miss.push('airspeed_m_s and LD_max (or powerRequired_W)'); if (Pavail === null) miss.push('powerAvailable_W (or flightMuscleFraction and musclePowerPerKg_W: the muscle premise R6, a named hypothesis)'); if (!num(s.climbRate_m_s)) miss.push('climbRate_m_s'); if (W === null) miss.push('mass_kg');
    if (miss.length) out.push(result('C16', 'cannot-evaluate', { powerRequired_W: Preq, powerAvailable_W: Pavail }, miss));
    else { const bound = (Pavail - Preq) / W; out.push(result('C16', leTol(s.climbRate_m_s, bound) ? 'holds' : 'violated', { powerRequired_W: Preq, powerAvailable_W: Pavail, W_N: W, climbBound_m_s: bound, climbRate_m_s: s.climbRate_m_s }, [], Pavail !== null && !num(s.powerAvailable_W) ? 'P_avail formed from the muscle premise (f, p constant), which is a named hypothesis, not a theorem' : null, { needed: { power_W: Preq + W * s.climbRate_m_s }, available: { power_W: Pavail } })); } }
  { const miss = []; for (const k of ['efficiency', 'oxycaloric_J_per_unit_O2', 'cardiacOutput', 'arterialO2']) if (!num(s[k])) miss.push(k); if (Preq === null) miss.push('airspeed_m_s and LD_max (or powerRequired_W)');
    if (mode.unpowered) out.push(result('C14', 'out-of-scope', { powerRequired_W: Preq, flight_mode: 'glide' }, [], 'the Fick aerobic bound caps SUSTAINED AEROBIC power demand (powered level or climbing flight, sustained swimming). This design claims an unpowered glide (' + mode.reason + '), whose energy comes from potential and kinetic energy rather than metabolism, so W v / (L/D) here is not a metabolic demand and this law does not judge it. See fick-principle scope.excludes in lean/registry.'));
    else
    if (miss.length) out.push(result('C14', 'cannot-evaluate', { powerRequired_W: Preq, gillArea_m2: num(s.gillArea_m2) ? s.gillArea_m2 : null }, miss, num(s.gillArea_m2) ? 'gillArea_m2 given, but the gill-to-blood link (water O2 and gill area to arterial content) is not formalised; commit arterialO2 directly' : null));
    else { const supply = s.efficiency * s.oxycaloric_J_per_unit_O2 * s.cardiacOutput * s.arterialO2; const need = Preq + (num(s.climbRate_m_s) && W !== null ? W * s.climbRate_m_s : 0); out.push(result('C14', geTol(supply, need) ? 'holds' : 'violated', { aerobicCeiling_W: supply, powerRequired_W: Preq, climbPower_W: need - Preq, efficiency: s.efficiency }, [], s.efficiency > 1 ? 'efficiency above 1 violates the named hypothesis 0 <= eta <= 1; the result is not meaningful' : 'sustained (aerobic) mechanical ceiling eta E Q Ca against level-flight power W v/(L/D) plus W x climb rate if a climb is claimed (climb_le_aerobic); units must multiply to watts' + (mode.powered || mode.unpowered ? '' : ' | this row ASSUMES the power required is a sustained powered-flight demand (' + mode.reason + '): pass flight_mode: "glide" for a descent and the aerobic laws will not judge it)'), { needed: { power_W: need }, available: { power_W: supply } })); } }

  // C14b: the SAME inequality as C14 with the aerobic ceiling committed as ONE number instead of its four factors,
  // for a design whose own oxygen chain computed the ceiling (lean/eliminate/eliminate.mjs C14b, with a kernel
  // certificate instantiating the theorem at eta = E = Q = 1 and Ca = the ceiling). It had no row here until
  // 2026-11-01, so the generator's USED list advertised a constraint that could never fire.
  { const ceil = num(s.aerobicCeiling_W) ? s.aerobicCeiling_W : null;
    const preq = num(s.powerRequired_W) ? s.powerRequired_W : Preq;
    if (mode.unpowered) out.push(result('C14b', 'out-of-scope', { aerobicCeiling_W: ceil, powerRequired_W: preq, flight_mode: 'glide' }, [], 'the aerobic bound caps SUSTAINED AEROBIC power demand; this design claims an unpowered glide (' + mode.reason + '), so the committed ceiling is not compared against it. See aerobic-power-bound scope.excludes in lean/registry.'));
    else { const miss = [];
      if (ceil === null) miss.push('aerobicCeiling_W (the ceiling as one number; C14 takes its four factors instead)');
      if (preq === null) miss.push('powerRequired_W (or airspeed_m_s and LD_max)');
      if (miss.length) out.push(result('C14b', 'cannot-evaluate', { aerobicCeiling_W: ceil, powerRequired_W: preq }, miss, 'commit the ceiling your own oxygen chain computed, and the power the flight needs'));
      else if (ceil < 0) out.push(result('C14b', 'cannot-evaluate', { aerobicCeiling_W: ceil }, ['a nonnegative aerobicCeiling_W'], 'a negative aerobic ceiling is not a number this law can rule on'));
      else out.push(result('C14b', geTol(ceil, preq) ? 'holds' : 'violated', { aerobicCeiling_W: ceil, powerRequired_W: preq, shortfall_factor: ceil > 0 ? preq / ceil : null }, [],
        'the ceiling the design commits against the power its flight needs; the same inequality as C14 with eta E Q Ca given as one number', { needed: { power_W: preq }, available: { power_W: ceil } })); } }

  // C13 and C10 need exponents across sizes, which a single spec does not carry.
  out.push(result('C13', 'cannot-evaluate', {}, ['fitted exponents for weight, area and wing loading with intervals'], 'a single design has no exponents; see the audit for the measured Davenport triple'));
  out.push(result('C10', 'cannot-evaluate', {}, ['the power-required exponent across sizes'], 'a single design has no exponent'));

  // Genotype rows: the genetic code, pleiotropy closure, developmental ordering and the two time budgets.
  for (const r of checkGenotype(s)) out.push(r);

  // Empirical rows, in their own band: each is conditional on an observation the reader may reject.
  const impliedMassExponent = (out.find(r => r.id === 'C7b') || {}).numbers?.impliedMassExponent ?? null;
  for (const r of checkEmpirical(s, { powerRequired_W: Preq, impliedMassExponent, flightMode: mode })) out.push(r);

  // Perturbation rows (lean/Delphi/Perturb.lean): temperature, current, pressure, altitude and wind, daily energy. Sleep and day/night have no law.
  for (const r of checkPerturb(s, { W_N: W, S_m2: S })) out.push(r);

  // Declarative rows: generated from the browser_check block of each law file, so a new law binds without a code edit.
  for (const r of checkDeclared(s, { W_N: W, S_m2: S, powerRequired_W: Preq, powerAvailable_W: Pavail, liftingArea_m2: S, lengthRatio: lr, impliedMassExponent })) out.push(r);
  return out;
}
`;
fs.writeFileSync(path.join(here, 'browser-check.mjs'), out);
console.log(`lean/eliminate/browser-check.mjs: ${USED.length} constraints, reference ${REF.name}`);
