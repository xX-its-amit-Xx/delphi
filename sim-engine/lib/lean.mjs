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
};
const BIO = /bio|genot|develop|ontog|physiol|empirical-bio/i;

export async function lawsetVersion(lawset = 'current') {
  try { return LS.resolveLawset(lawset).version; } catch (e) { throw new Error(`lawset: ${e.message}`); }
}

export async function leanVerdicts(state, { lawset = 'current', baselineState = null, extraSpec = {} } = {}) {
  const spec = { ...leanSpec(state), ...extraSpec };
  const r = await LS.checkDesign(spec, lawset);
  let baseline = null;
  if (baselineState) baseline = new Set((await LS.checkDesign({ ...leanSpec(baselineState), ...extraSpec }, lawset)).violations.map(v => v.constraint));
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
      severity: v.status === 'contested' ? 'amber' : (v.binding ? 'red' : 'advisory'),
      baseline_violated: baseline ? baseline.has(v.constraint) : null,
    };
  });
  return { lawset_version: r.lawset, kernel: r.kernel, spec, summary: r.summary, verdicts, violations,
    new_binding_violations: violations.filter(v => v.binding && !v.contested && v.baseline_violated === false),
    excluded: r.excluded, laws_without_browser_evaluation: r.laws_without_browser_evaluation };
}
