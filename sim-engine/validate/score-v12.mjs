// Scorer v1.2.0 (score-weights.v1.2.0.json; SCORER-PREREGISTRATION-v1.2.0.md). Built on the v1.1.0 machinery
// (assess(), version '1.1.0') and fixing the defects the independent evaluator's probe found:
//   1. absence = pass: every PRESENT trait is checked against an envelope (single-trait checks count); P always runs;
//      missing evidence lowers P through a coverage factor, never raises the score; coverage is reported.
//   2. invalid or refused edits (e.g. a partedit scale factor out of bounds) score as implausible instead of throwing.
//   3. genus:Name leave-out (phenotype.mjs excludeMatcher).
//   4. lean_spec / flight claims are accepted and routed through lean_check; any ACCEPTED-law binding violation sets L=0.
//   5. definitional and range-sanity failures feed P (peduncle deeper than the body, organ volume fractions that cannot
//      fit, failed phenotype sanity checks).
//   + rank_score (from v1.1.1) for ranking plausible designs.
// v1.0.0, v1.1.0 and v1.1.1 are untouched and remain callable through score.mjs designScore(design, {version}).
import fs from 'node:fs';
import path from 'node:path';
import * as LS from '../lib/lean-source.mjs';
import { assess, threeResults } from './score.mjs';
import { loadReferences } from './phenotype.mjs';
// lean_spec keys that describe the BODY; everything else in a lean_spec is a claim (airspeed, CLmax, glide ...).
export const BODY_SPEC_KEYS = new Set(['SL_m', 'mass_kg', 'finArea_m2', 'pectoralFinArea_m2', 'taxon', 'life_stage', 'gillArea_m2', 'finLength_SL', 'rho']);

const DIR = import.meta.dirname;
const W = JSON.parse(fs.readFileSync(path.join(DIR, 'score-weights.v1.2.0.json'), 'utf8'));
const ENV = JSON.parse(fs.readFileSync(path.join(DIR, 'data', 'trait-envelopes.v1.2.0.json'), 'utf8'));
export const SCORER_V12 = Object.freeze({ ...W, weights_file: 'sim-engine/validate/score-weights.v1.2.0.json', envelopes_file: 'sim-engine/validate/data/trait-envelopes.v1.2.0.json' });

// benchmark / schema trait name <-> the specimen record phenotype.mjs reads
export const PARAM_TO_RAW = { standard_length_m: 'SL_m', body_mass_kg: 'mass_kg', body_depth_over_SL: 'depth_SL', body_width_over_SL: 'width_SL', peduncle_depth_frac: 'ped_depth_frac', peduncle_width_frac: 'ped_width_frac',
  pectoral_len_over_SL: 'pectoral_len_SL', pectoral_area_over_SL2: 'pectoral_area_SL2', pectoral_span_over_SL: 'pectoral_span_SL', pelvic_len_over_SL: 'pelvic_len_SL', dorsal_height_over_SL: 'dorsal_h_SL', anal_height_over_SL: 'anal_h_SL',
  caudal_upper_lobe_over_SL: 'caudal_upper_SL', caudal_lower_lobe_over_SL: 'caudal_lower_SL' };
const RAW_TO_PARAM = Object.fromEntries(Object.entries(PARAM_TO_RAW).map(([a, b]) => [b, a]));
const ORGAN_FRAC = /_volume_over_body_volume$/;
const isNum = x => typeof x === 'number' && Number.isFinite(x);

/** Per-trait envelope, definitional and organ-fraction checks on whatever traits are present. */
export function traitChecks(params) {
  const rows = []; const D = W.decay_decades;
  for (const [k, v] of Object.entries(params)) {
    if (!isNum(v)) continue;
    const E = ENV.envelopes[k];
    if (ORGAN_FRAC.test(k)) {
      // organ volume fraction: swim bladder has a sourced anchor (STATE 0.051, zebrafish adult, ontogeny.json),
      // widened x/÷2; any other organ: a single organ above 0.5 of body volume is treated as impossible (assumption).
      if (/swimbladder|swim_bladder/.test(k)) { const lo = Math.log10(0.051 / 2), hi = Math.log10(0.051 * 2), x = v > 0 ? Math.log10(v) : -Infinity; const e = Math.max(0, x - hi, lo - x); rows.push({ trait: k, value: v, kind: 'organ-envelope', p: Number.isFinite(e) ? Math.exp(-e / D) : 0, rule: 'swim bladder 0.051 of body volume (zebrafish, ontogeny.json) x/÷2' }); }
      else rows.push({ trait: k, value: v, kind: 'organ-rule', p: v < 0.5 ? 1 : 0, rule: 'a single organ above 0.5 of body volume cannot fit with the other organs (assumption, stated in score-weights.v1.2.0.json)' });
      continue;
    }
    if (/^peduncle_(depth|width)_frac$/.test(k) && v > 1) { rows.push({ trait: k, value: v, kind: 'definitional', p: 0, rule: 'a minimum (peduncle) cannot exceed the maximum (body) by definition' }); continue; }
    if (v <= 0 && /_over_|_m$|_kg$/.test(k) && !/^pelvic/.test(k)) { rows.push({ trait: k, value: v, kind: 'definitional', p: 0, rule: 'a size or ratio must be positive' }); continue; }
    if (!E || !(v > 0)) continue;
    const x = Math.log10(v), e = Math.max(0, x - E.hi_log10, E.lo_log10 - x);
    rows.push({ trait: k, value: v, kind: 'envelope', p: Math.exp(-e / D), lo: E.lo, hi: E.hi, excess_decades: +e.toFixed(4) });
  }
  const organSum = Object.entries(params).filter(([k, v]) => ORGAN_FRAC.test(k) && isNum(v)).reduce((a, [, v]) => a + v, 0);
  if (organSum >= 0.8) rows.push({ trait: 'sum of organ volume fractions', value: organSum, kind: 'organ-rule', p: 0, rule: 'listed organs fill >= 0.8 of the body' });
  return rows;
}

function composite(C, floor) {
  let s = 0, w = 0;
  for (const [k, c] of Object.entries(C)) if (c && c.ran && isNum(c.value)) { s += W.weights[k] * Math.log(Math.max(c.value, floor)); w += W.weights[k]; }
  return w ? Math.exp(s / w) : null;
}

/** v1.2.0 entry. design: repository id | organism document | {organism, ...} | {specimen} | {params, lean_spec?, doc?}.
 *  opts as score.mjs designScore (reference_set_excluding incl. genus:, lawset, ...) plus lean_spec. Never throws for a
 *  bad design: an invalid or refused design scores W.refused_score with plausible=false and the reason. */
export async function designScoreV12(design, opts = {}) {
  try { return await scoreInner(design, opts); }
  catch (e) { return { score: null, plausible: null, rank_score: null, error: `scorer error (a bug, not a verdict): ${e.message}`, scorer: SCORER_V12 }; }
}
async function scoreInner(design, opts) {
  const exclude = [...(opts.reference_set_excluding || []), ...(opts.exclude || [])];
  const leanSpec = design?.lean_spec || opts.lean_spec || null;
  let r, params;
  try {
    if (design && typeof design === 'object' && design.params && !design.doc) {
      params = { ...design.params };
      const raw = {}; for (const [k, v] of Object.entries(params)) if (PARAM_TO_RAW[k] && isNum(v)) raw[PARAM_TO_RAW[k]] = v;
      // a specimen smaller than the 0.5th percentile of FishShapes SL is treated as larval (larval envelope, v1.1)
      const R0 = await loadReferences();
      if (raw.SL_m != null && Math.log10(raw.SL_m) < R0.range.log_SL.p005) raw.stage = 'larva';
      r = await assess({ ...opts, specimen: raw, exclude, version: '1.1.0', taxon: 'Teleostei' });
    } else if (design && typeof design === 'object' && 'specimen' in design) {
      r = await assess({ ...opts, ...design, exclude, version: '1.1.0' });
      params = Object.fromEntries(Object.entries(design.specimen).filter(([k]) => RAW_TO_PARAM[k]).map(([k, v]) => [RAW_TO_PARAM[k], v]));
    } else {
      const organism = design?.doc || (design && typeof design === 'object' && 'organism' in design ? design.organism : design);
      r = await assess({ ...opts, ...(design?.ageDays != null ? { ageDays: design.ageDays } : {}), organism, exclude, version: '1.1.0' });
      params = Object.fromEntries(Object.entries(r.raw || {}).filter(([k, v]) => RAW_TO_PARAM[k] && isNum(v)).map(([k, v]) => [RAW_TO_PARAM[k], v]));
      if (design?.params) Object.assign(params, design.params); // extra traits supplied alongside a doc (e.g. organ fractions)
    }
  } catch (e) {
    return { score: W.refused_score, plausible: false, rank_score: W.refused_score, refused: e.message, components: {},
      verdict: { statement: `Not a validity claim. The design could not be built: ${e.message}. A design the engine refuses (an out-of-bounds or unknown edit) scores as implausible (${W.refused_score}).` },
      scorer: SCORER_V12, coverage: { checked: 0 } };
  }
  const C1 = r.score.components;
  // ---- P
  const tc = traitChecks(params);
  // range:* sanity checks are superseded by the per-trait envelopes (wider reference set, incl. larvae)
  const sanFailed = (r.sanity?.phenotype || []).filter(c => c.status === 'failed' && !/^range:/.test(c.id));
  const parts = [...(C1.P.parts || []).filter(x => !/^p_fin_envelope/.test(x.part)).map(x => ({ ...x }))];
  // v1.1 fin envelope, recomputed WITHOUT the fin traits that now have a dev-positive envelope (pectoral area, span)
  const FINMAP = { pectoral_area_SL2: 'pectoral_area_over_SL2', pectoral_span_SL: 'pectoral_span_over_SL', pectoral_len_SL: 'pectoral_len_over_SL' };
  const finRows = (r.phenotype?.fin_envelope?.features || []).filter(f => !(FINMAP[f.feature] && ENV.envelopes[FINMAP[f.feature]]));
  if (finRows.length) { const ex = Math.max(...finRows.map(f => f.excess)); parts.push({ part: 'p_fin_envelope_v11 (uncalibrated; traits without a dev envelope)', value: Math.exp(-ex), p: Math.exp(-ex) }); }
  const envRows = tc.filter(t => t.kind === 'envelope');
  if (envRows.length) { const worst = envRows.reduce((a, b) => (b.p < a.p ? b : a)); parts.push({ part: 'p_trait_envelope', value: worst.p, p: worst.p, trait: worst.trait }); }
  for (const t of tc.filter(t => t.kind !== 'envelope')) parts.push({ part: `${t.kind}:${t.trait}`, value: t.p, p: t.p });
  for (const c of sanFailed) parts.push({ part: `sanity_failed:${c.id}`, value: W.sanity_failed_value, p: W.sanity_failed_value });
  const checkedTraits = new Set([...envRows.map(t => t.trait), ...(r.phenotype?.body?.ran ? (r.phenotype.body.features_present || r.phenotype.body.larval_envelope?.rows?.map(x => x.feature) || []) : [])]);
  const coverage = { checked: checkedTraits.size, traits_present: Object.keys(params).length, unchecked: Object.keys(params).filter(k => !ENV.envelopes[k] && !ORGAN_FRAC.test(k) && !PARAM_TO_RAW[k]), body_block_ran: !!r.phenotype?.body?.ran,
    factor: null, rule: `P x (0.5 + 0.5 x min(1, checked / ${W.coverage_target})); with nothing checked P = ${W.no_evidence_P}` };
  coverage.factor = 0.5 + 0.5 * Math.min(1, coverage.checked / W.coverage_target);
  const pMin = parts.length ? Math.min(...parts.map(x => x.value)) : null;
  const P = { ran: true, value: pMin == null ? W.no_evidence_P : pMin * coverage.factor, parts, limiting: parts.length ? parts.reduce((a, b) => (b.value < a.value ? b : a)).part : 'no evidence', coverage };
  // ---- L (lean_spec / claims routed through lean_check; accepted binding violations -> 0)
  let L = { ...C1.L };
  let claims = null;
  if (leanSpec) {
    try {
      // Claim-caused violations only: violations of the full spec that the same spec WITHOUT its claim fields does not
      // have. Scaling-exponent rows that a real specimen already violates against the one reference specimen
      // (C7b, E2, C2a, C8e for Park & Choi L1/L2) are about the reference comparison, not about the claim.
      const full = { life_stage: 'adult', ...leanSpec };
      const bodyOnly = Object.fromEntries(Object.entries(full).filter(([k]) => BODY_SPEC_KEYS.has(k)));
      const res = await LS.checkDesign(full, opts.lawset || 'current');
      const base = new Set((await LS.checkDesign(bodyOnly, opts.lawset || 'current')).violations.map(v => v.constraint));
      const claimKeys = Object.keys(full).filter(k => !BODY_SPEC_KEYS.has(k));
      const acc = claimKeys.length ? res.violations.filter(v => v.status === 'accepted' && v.binding && !base.has(v.constraint)) : [];
      claims = { lawset: res.lawset, claim_keys: claimKeys, body_only_violations: [...base], accepted_violations: acc.map(v => ({ law_id: v.law_id, version: v.version, constraint: v.constraint, message: v.message })), candidate: res.violations.filter(v => v.status === 'candidate').length, contested: res.violations.filter(v => v.status === 'contested').length, summary: res.summary };
      if (acc.length) L = { ran: true, value: 0, newly_caused_accepted: [...(C1.L.newly_caused_accepted || []), ...claims.accepted_violations], from_claims: true };
      else if (!L.ran) L = { ran: true, value: 1, from_claims: true };
    } catch (e) { claims = { error: e.message }; }
  }
  const C = { P, L, G: C1.G, S: C1.S, E: C1.E };
  const score = composite(C, W.floor);
  // ---- rank_score (v1.1.1 rule): raw P parts geometric mean x coverage, mean evidence
  const rp = parts.length ? Math.exp(parts.reduce((a, x) => a + Math.log(Math.max(x.p ?? x.value, W.rank.floor)), 0) / parts.length) * coverage.factor : W.no_evidence_P;
  const rank = composite({ P: { ran: true, value: rp }, L, G: C1.G, S: C1.S, E: { ran: true, value: r.score.rank?.components?.E ?? C1.E.value } }, W.rank.floor);
  const plausible = score != null && score >= W.plausible_threshold;
  const three = threeResults(r, { claims });
  return {
    ...three, score: score == null ? null : +score.toFixed(4), plausible, rank_score: rank == null ? null : +rank.toFixed(6), components: C, coverage, claims, trait_checks: tc,
    closest_real_relative: r.verdict.closest_real_relative, excluded: r.phenotype?.excluded,
    verdict: { statement: `Not a validity claim. Score ${score?.toFixed(3)} (${plausible ? 'plausible' : 'implausible'} by the pre-registered 0.5 cut; scorer v${W.version}); rank_score ${rank?.toFixed(3)}. Coverage: ${coverage.checked} trait(s) checked of ${coverage.traits_present} present. Closest real relative: ${r.verdict.closest_real_relative?.name || 'none'}. Lean: ${(L.newly_caused_accepted || []).length} accepted-law violation(s).`,
      failed: [...r.verdict.failed, ...tc.filter(t => t.p < 0.05).map(t => `trait:${t.trait}`)], could_not_run: r.verdict.could_not_run },
    scorer: SCORER_V12, design: r.design,
  };
}
