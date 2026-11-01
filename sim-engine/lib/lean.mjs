// Lean verdicts for a resolved STATE, through the ONE law loader (lib/lean-source.mjs checkDesign).
// Node-only because lean-source reads the law registry from disk. Floating-point evaluation of the
// Lean-backed formulas, NOT a kernel check.
//
// Two things are added on top of checkDesign:
//  1. violations in the shape the Studio UI renders red:
//     {law_id, law_version, status, lean_ref:{constraint, theorem, module}, kind:'physical'|'biological',
//      inputs:{name:value}, parts:[partIds], message, binding, contested, baseline_violated}
//     Contested laws give verdict 'contested' (amber), not 'violated' (red).
//  2. baseline_violated: whether the UNEDITED base organism at the same age and conditions also
//     violates the row. Several rows compare implied scaling exponents against ONE flying-fish
//     reference specimen (Park & Choi L3), so a real zebrafish "violates" them; that is a
//     statement about the reference comparison, not about the edit. The optimizer's default
//     constraint is therefore "no NEW binding violation"; strict mode rejects any violation.
import * as LS from './lean-source.mjs';
import { leanSpec, INPUT_PARTS } from './state.mjs';

// Which spec inputs each constraint reads (for the parts that should glow); fallback: none mapped.
const CONSTRAINT_INPUTS = {
  C9: ['mass_kg', 'pectoralFinArea_m2'], C7b: ['SL_m', 'mass_kg'], C2a: ['SL_m', 'pectoralFinArea_m2'],
  C8e: ['SL_m', 'mass_kg', 'pectoralFinArea_m2'], C9c: ['SL_m', 'mass_kg', 'pectoralFinArea_m2'], C8c: ['SL_m'],
  C16: ['mass_kg', 'flightMuscleFraction'], C14: ['mass_kg', 'gillArea_m2'], E5: ['finLength_SL'], E2: ['SL_m', 'mass_kg'],
  P1: ['body_temperature_C', 'ct_min_C', 'ct_max_C', 'sustained_power_W'], P1b: ['body_temperature_C', 'q10', 'reference_temperature_C', 'reference_sustained_power_W', 'sustained_power_W'],
  P2: ['current_speed_m_s', 'critical_swimming_speed_m_s'], P2b: ['current_speed_m_s', 'drag_coefficient', 'drag_area_m2', 'aerobicCeiling_W'],
  P3: ['depth_m', 'bladder_volume_surface_ml', 'bladder_volume_at_depth_ml'], P3b: ['depth_m', 'teleost'], P4: ['altitude_m', 'airspeed_m_s', 'CLmax', 'mass_kg'], P4b: ['wind_along_track_m_s', 'horizontal_airspeed_m_s', 'glideHeight_m', 'LD_max', 'ground_distance_m'],
  P5: ['intake_J_per_day', 'routine_cost_J_per_day', 'activity_cost_J_per_day', 'assimilation_efficiency', 'mass_change'],
};
const BIO = /bio|genot|develop|ontog|physiol|empirical-bio/i;

export async function lawsetVersion(lawset = 'current') {
  try { return LS.resolveLawset(lawset).version; } catch (e) { throw new Error(`lawset: ${e.message}`); }
}

export async function leanVerdicts(state, { lawset = 'current', baselineState = null, extraSpec = {}, baselineExtraSpec = null, scoped = null } = {}) {
  const spec = { ...leanSpec(state), ...extraSpec };
  const r = await LS.checkDesign(spec, lawset);
  // Inputs valid only for some rows (e.g. a lifting area in a convention the reference-specimen rows do not share):
  // evaluated in a second pass, and ONLY the named rows are taken from it.
  if (scoped && scoped.only?.length && Object.keys(scoped.spec || {}).length) {
    const r2 = await LS.checkDesign({ ...spec, ...scoped.spec }, lawset);
    const only = new Set(scoped.only);
    r.verdicts = [...r.verdicts.filter(v => !only.has(v.constraint)), ...r2.verdicts.filter(v => only.has(v.constraint)).map(v => ({ ...v, scoped_inputs: Object.keys(scoped.spec) }))];
    r.violations = [...r.violations.filter(v => !only.has(v.constraint)), ...r2.violations.filter(v => only.has(v.constraint))];
    Object.assign(spec, Object.fromEntries(Object.entries(scoped.spec).map(([k, v]) => [`${k} (only ${scoped.only.join(', ')})`, v])));
  }
  let baseline = null;
  if (baselineState) baseline = new Set((await LS.checkDesign({ ...leanSpec(baselineState), ...(baselineExtraSpec || extraSpec) }, lawset)).violations.map(v => v.constraint));
  const idx = LS.constraintIndex();
  const partsPresent = new Set(Object.keys(state.parts || {}));
  const verdicts = r.verdicts.map(v => ({ ...v, verdict: v.verdict === 'violated' && v.status === 'contested' ? 'contested' : v.verdict, lawset_version: r.lawset }));
  const violations = r.violations.map(v => {
    const law = idx[v.constraint] || {};
    const names = CONSTRAINT_INPUTS[v.constraint] || [];
    const inputs = Object.fromEntries(names.filter(n => n in spec).map(n => [n, spec[n]]));
    const parts = [...new Set(names.flatMap(n => INPUT_PARTS[n] || []))].filter(p => partsPresent.has(p));
    return {
      law_id: v.law_id, law_version: v.version, status: v.status, lawset_version: r.lawset,
      lean_ref: { constraint: v.constraint, theorem: law.lean_ref?.theorem ?? null, module: law.lean_ref?.module ?? null },
      kind: ['physical', 'biological'].includes(v.kind) ? v.kind : (BIO.test(String(v.kind || '')) ? 'biological' : 'physical'), law_kind: v.kind,
      inputs, numbers: v.inputs, parts, message: v.message, binding: v.binding,
      contested: v.status === 'contested',
      // red: accepted law violated; amber: contested law; candidate: a proposed law (the UI draws it dashed)
      severity: v.status === 'contested' ? 'amber' : v.binding ? 'red' : v.status === 'candidate' ? 'candidate' : 'advisory',
      baseline_violated: baseline ? baseline.has(v.constraint) : null,
    };
  });
  return { lawset_version: r.lawset, kernel: r.kernel, spec, summary: r.summary, verdicts, violations,
    new_binding_violations: violations.filter(v => v.binding && !v.contested && v.baseline_violated === false),
    excluded: r.excluded, laws_without_browser_evaluation: r.laws_without_browser_evaluation };
}
