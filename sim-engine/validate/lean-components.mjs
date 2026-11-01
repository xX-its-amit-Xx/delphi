// lean_by_component: run the Lean law check on a design (the ONE path: lib/lean.mjs leanVerdicts ->
// lib/lean-source.mjs checkDesign -> lean/eliminate/browser-check.mjs; floating point, NOT a kernel check) and group
// every verdict by the component it is about: body, organ system, organ/part, and gene. Each verdict carries law id,
// version, status, the verdict, and the inputs that decided it (or the inputs that were missing).
//
// "Newly caused" is judged against the design's LEAF reference organisms, each unedited at the same age: a violation
// that a real parent organism also has is a statement about the law's reference comparison, not about the design.
// Accepted-law violations are kept apart from candidate and contested ones and never mixed.
import { leanVerdicts } from '../lib/lean.mjs';
import { resolveState, INPUT_PARTS } from '../lib/state.mjs';
import * as O from '../lib/organism.mjs';

// Which spec inputs each constraint reads. Copy of lib/lean.mjs CONSTRAINT_INPUTS (not exported there), extended
// with the genotype rows; keep in step with it.
export const CONSTRAINT_INPUTS = {
  C9: ['mass_kg', 'pectoralFinArea_m2'], C7b: ['SL_m', 'mass_kg'], C2a: ['SL_m', 'pectoralFinArea_m2'],
  C8e: ['SL_m', 'mass_kg', 'pectoralFinArea_m2'], C9c: ['SL_m', 'mass_kg', 'pectoralFinArea_m2'], C8c: ['SL_m'],
  C16: ['mass_kg', 'flightMuscleFraction'], C14: ['mass_kg', 'gillArea_m2'], E5: ['finLength_SL'], E2: ['SL_m', 'mass_kg'],
  C10: ['SL_m', 'mass_kg'], C13: ['mass_kg', 'pectoralFinArea_m2'], C15: ['mass_kg', 'flightMuscleFraction'],
  G1: ['genotype_edits'], G2: ['genotype_edits'], G3: ['developmental_claims'], G4: ['substitution_budget'], G5: ['substitution_budget'],
};

function systemOf(parts, pid) { const p = parts.get(pid); return p ? { id: p.organ_system_id || p.organ_system || 'unassigned', label: p.organ_system || 'unassigned' } : { id: 'unassigned', label: 'unassigned' }; }

export async function leanByComponent(doc, bundle, { ageDays, conditions = {}, lawset = 'current', genotypeEdits = [] } = {}) {
  const state = resolveState(doc, ageDays, conditions, bundle);
  const extraSpec = genotypeEdits.length ? { genotype_edits: genotypeEdits } : {};
  const lean = await leanVerdicts(state, { lawset, extraSpec });
  // baseline: union of violations of every leaf reference organism, unedited, at the same age
  const leafIds = Object.keys(state._meta?.leaves || {});
  const baseline = new Set();
  for (const id of leafIds) {
    const s = resolveState(O.docFor(bundle, id), state.ageDays?.value, conditions, bundle);
    for (const v of (await leanVerdicts(s, { lawset })).violations) baseline.add(v.lean_ref.constraint);
  }
  const parts = O.partsOf(bundle, doc);
  const spec = lean.spec;
  const viol = new Map(lean.violations.map(v => [v.lean_ref.constraint, v]));
  const comps = new Map();
  const put = (key, comp, row) => { if (!comps.has(key)) comps.set(key, { component: comp, verdicts: [] }); comps.get(key).verdicts.push(row); };
  for (const v of lean.verdicts) {
    const names = CONSTRAINT_INPUTS[v.constraint] || [];
    const decided = Object.fromEntries(names.filter(n => n in spec && n !== 'genotype_edits').map(n => [n, spec[n]]));
    const vi = viol.get(v.constraint);
    const row = { law_id: v.law_id, law_version: v.version, status: v.status, constraint: v.constraint, verdict: v.verdict, binding: v.binding,
      decided_by: vi?.numbers ?? decided, missing: v.missing || [], ...(v.scope_reason ? { scope_reason: v.scope_reason } : {}),
      newly_caused: vi ? (v.status === 'accepted' && v.binding && !baseline.has(v.constraint)) : false, also_in_real_parent: vi ? baseline.has(v.constraint) : null,
      message: vi?.message || null };
    if (names.includes('genotype_edits')) {
      const items = vi?.numbers?.items || null;
      if (genotypeEdits.length) for (const g of genotypeEdits) put(`gene:${g.gene}`, { level: 'gene', id: g.gene }, { ...row, decided_by: (items || []).find(i => i.gene === g.gene) || { genotype_edit: g } });
      else put('gene:none', { level: 'gene', id: '(no gene edits)' }, row);
      continue;
    }
    const pids = [...new Set(names.flatMap(n => INPUT_PARTS[n] || []))].filter(p => parts.has(p));
    if (!pids.length) { put('body', { level: 'body', id: 'body' }, row); continue; }
    const sys = new Map(); for (const pid of pids) { const s = systemOf(parts, pid); (sys.get(s.id) || sys.set(s.id, { ...s, parts: [] }).get(s.id)).parts.push(pid); }
    for (const s of sys.values()) put(`system:${s.id}`, { level: 'system', id: s.id, label: s.label, parts: s.parts }, row);
  }
  const all = [...comps.values()].map(c => ({ ...c, summary: summarise(c.verdicts) }));
  const vs = lean.verdicts.map(v => viol.get(v.constraint)).filter(Boolean);
  return {
    lawset_version: lean.lawset_version, kernel: lean.kernel,
    components: all,
    accepted: { newly_caused: vs.filter(v => v.status === 'accepted' && v.binding && !baseline.has(v.lean_ref.constraint)).map(brief), also_in_real_parent: vs.filter(v => v.status === 'accepted' && baseline.has(v.lean_ref.constraint)).map(brief) },
    candidate: vs.filter(v => v.status === 'candidate').map(brief), contested: vs.filter(v => v.status === 'contested').map(brief),
    counts: lean.summary, baseline_leaves: leafIds, spec,
    note: 'Floating-point evaluation of the Lean-backed formulas (lean/eliminate/browser-check.mjs), not a kernel check. Accepted, candidate and contested are reported separately; only accepted-law violations newly caused by the design count against it.',
  };
}
const brief = v => ({ law_id: v.law_id, law_version: v.law_version, status: v.status, constraint: v.lean_ref.constraint, message: v.message, parts: v.parts, inputs: v.numbers ?? v.inputs });
function summarise(vs) { const c = {}; for (const v of vs) c[v.verdict] = (c[v.verdict] || 0) + 1; return c; }
