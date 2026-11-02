// index.mjs - the slot sim-engine/validate/functional-interface.mjs calls.
//
//     export async function functionalResolution(design, opts) -> Ledger
//
// `design` and `opts` are exactly what the scorer received. The desired phenotype - the text prompt given to the
// generator - is the signal that chooses the analogue, so it is looked for in several places the pipeline might
// put it, and when it is absent the ledger SAYS the function was inferred rather than specified.
//
// This function never throws: the interface reports a throw as "did not run", which would hide a real result.
// A failure comes back as {ran:false, reason} so the reason is published.
import { ledgerFor } from './score.mjs';

export { ledgerFor, ledgerTable } from './score.mjs';
export { closestFunctionalAnalogue, registry, functionFromText, FUNCTIONS } from './analogue.mjs';
export { requirementSet, detectDirection } from './requirements.mjs';
export { resolveOne, resolveAll, paralogueResolution, analogousSetResolution, scoreCompensationVerdict, LADDER } from './resolve.mjs';
export { compensationApplies, lesionTriggersDecay, CONDITIONS, PAPERS, RULE_SUMMARY } from './compensation.mjs';

/** Where a desired phenotype may be hiding. The pipeline agent's DesignSpec arrives in opts.spec. */
function desiredFrom(design, opts) {
  const s = opts?.spec;
  const cands = [
    opts?.target_function, opts?.function, opts?.desired_phenotype, opts?.desired_function,
    s?.desired_phenotype, s?.desired_function, s?.target_function, s?.function, s?.prompt, s?.text, s?.goal, s?.description,
    typeof s === 'string' ? s : null,
    design?.desired_phenotype, design?.spec?.desired_phenotype,
  ].filter(x => typeof x === 'string' && x.trim());
  // A spec may also carry its criteria as objects; their text is worth reading for the function.
  const crit = Array.isArray(s?.criteria) ? s.criteria.map(c => [c?.id, c?.description, c?.label, c?.metric].filter(x => typeof x === 'string').join(' ')).join(' ') : null;
  if (crit && crit.trim()) cands.push(crit);
  return cands.length ? { text: cands[0], all_candidates: cands.length, from_spec: !!s } : null;
}

/** The design's pectoral fin ratio, for the functional half of the distance, when the caller supplies it. */
function finSL(design, opts) {
  const v = design?.specimen?.pectoral_len_SL ?? design?.params?.pectoral_len_over_SL ?? opts?.pectoral_len_over_SL ?? null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function functionalResolution(design, opts = {}) {
  try {
    const d = desiredFrom(design, opts);
    const L = await ledgerFor(design, { target: d ? d.text : null, designFinSL: finSL(design, opts) });
    L.desired_phenotype = d ? { text: d.text, from_spec: d.from_spec } : { text: null, note: 'no desired phenotype reached this module, so the function was INFERRED from the design\'s identity and the ledger says so' };
    // Lifted to the ledger root so a caller reading only the top level still sees that the ledger is
    // about a function it did not ask for. One level down inside the analogue, it was missed.
    const un = L.closest_functional_analogue?.desired_phenotype_unmatched;
    if (un) L.desired_phenotype_unmatched = un;
    return L;
  } catch (e) {
    return { ran: false, reason: `functional ledger failed: ${e.message}`, stack_head: String(e.stack || '').split('\n').slice(0, 3).join(' | ') };
  }
}
