// functional_resolution: the FOURTH named result, beside genotype_similarity, phenotype_similarity and lean_check.
//
// The ledger itself is built by another thread in `sim-engine/validate/functional/` (not mine; I do not edit it).
// This file is the INTERFACE ONLY: it states the shape I consume, imports their module when it lands, validates
// what comes back, and reports plainly when it is absent. It never invents a ledger, and it never upgrades a
// hypothesis into a demonstrated resolution.
//
// EXPECTED MODULE: `sim-engine/validate/functional/index.mjs`, exporting
//     export async function functionalResolution(design, opts) -> Ledger
// called with the same `design` and `opts` the scorer received (so `reference_set_excluding`, `lawset`, `network`
// and `ageDays` are all available). Any other export name, or a throw, is reported as "did not run" rather than
// guessed at.
//
// Ledger:
//   { ran: true,
//     closest_functional_analogue: { id, name, taxon, function, basis, source },   // by FUNCTION, not relatedness
//     requirement_set: [ { id, requirement, value?, unit?, source, kind } ],
//     ledger: [ { id, difference, component?, gene?, class, evidence: [{claim, source, kind}], kind,
//                 hypothesis: boolean } ],
//     counts?: { SAME, ALLELIC, PARALOGUE, ANALOGOUS_SET, COMPENSATORY, UNRESOLVED },
//     coverage?: { differences_classified, differences_total, genes_mapped, genes_total, note },
//     scope: string }
//
// THE LADDER. Only these six classes are accepted; anything else is counted under `unknown_classes` and reported,
// never folded into a resolved count.
export const LADDER = ['SAME', 'ALLELIC', 'PARALOGUE', 'ANALOGOUS_SET', 'COMPENSATORY', 'UNRESOLVED'];

// ---------------------------------------------------------------- the genotype_similarity contract they reuse
// The functional thread reuses my `genotype_similarity` for the ALLELIC class. These fields are STABLE: I will not
// rename, remove or change the meaning of any of them without saying so first.
//
//   genotype_similarity.n_edits
//   genotype_similarity.per_gene[] : gene, edit, kind, zygosity,
//                                    closest_real_orthologue { species, percent_identity_after_edit,
//                                                              percent_identity_before_edit },
//                                    percent_identity_to_unedited_reference,
//                                    fraction_of_reference_protein_retained,
//                                    edited_state_exists_in_real_organism  (true | false | null),
//                                    in_natural_orthologues[] (species names),
//                                    known_alleles[] (genotype/interventions.json ids),
//                                    site_conservation { fraction_of_orthologues_with_reference_residue, n_rows,
//                                                        conserved },
//                                    checks[] { id, status }
//   genotype_similarity.aggregate  : min_percent_identity_to_reference, mean_percent_identity_to_reference,
//                                    edits_whose_state_exists_in_a_real_organism, edits_assessed,
//                                    conserved_sites_changed
//
// NOT stable, and should not be depended on: `source` (free text), the wording of `rule`, and the ORDER of
// per_gene (it follows the document's edit order, which a caller controls).
//
// WHAT THESE FIELDS DO AND DO NOT LICENCE. Every one of them is a SEQUENCE-LEVEL STATE
// (dashboard/public/blueprint3d/genotype.js). `edited_state_exists_in_real_organism: true` means the edited residue
// or state is carried by a real organism or is a known allele. It does NOT mean the function is preserved: this
// project has no model that predicts a phenotype from a residue, and its own design validation failed. So ALLELIC
// is sound as "this difference is an allele that occurs in a real organism", and unsound as "this difference is
// functionally neutral". A high percent identity is likewise not evidence of preserved function. If the ladder
// needs the latter, the evidence for it has to come from somewhere other than these fields.

// Which classes are a DEMONSTRATED resolution and which are a HYPOTHESIS. COMPENSATORY is a hypothesis by
// definition here: "this gap could be compensated" is a claim about an unobserved mechanism. An entry may also mark
// itself `hypothesis: true` in any class, and that always wins over this table. The two are never added together,
// because a count that mixes them would let a hypothesis pay for a gap.
export const DEMONSTRATED = new Set(['SAME', 'ALLELIC', 'PARALOGUE', 'ANALOGOUS_SET']);
export const HYPOTHESIS = new Set(['COMPENSATORY']);
export const UNRESOLVED = new Set(['UNRESOLVED']);

export const SCOPE_NOTE = 'A functional-analogue ledger, not a validity claim. It says how each difference between the design and its closest FUNCTIONAL analogue is accounted for, and what the evidence for that account is. A COMPENSATORY entry is a hypothesis about an unobserved mechanism and is reported apart from demonstrated resolutions; it is never counted as one.';

/** Load the other thread's module, or say it is absent. Never throws. */
export async function loadFunctional() {
  try {
    const m = await import('./functional/index.mjs');
    if (typeof m.functionalResolution !== 'function') return { ok: false, reason: 'sim-engine/validate/functional/index.mjs exists but exports no functionalResolution(design, opts) function' };
    return { ok: true, fn: m.functionalResolution };
  } catch (e) {
    const missing = /Cannot find module|ERR_MODULE_NOT_FOUND/i.test(String(e?.message));
    return { ok: false, reason: missing ? 'sim-engine/validate/functional/ has not landed yet: no functional ledger is reported (nothing is assumed in its place)' : `functional module failed to load: ${e.message}` };
  }
}

/** Validate and normalise a ledger. Counts are recomputed here from the entries, so a module's own summary cannot
 *  disagree with its rows; a mismatch is reported under `counts_disagreed_with_module`. */
export function normaliseLedger(raw) {
  if (!raw || raw.ran === false) return { ran: false, reason: raw?.reason || 'the functional module reported that it did not run', scope: SCOPE_NOTE };
  const rows = Array.isArray(raw.ledger) ? raw.ledger : [];
  const unknown = [];
  const entries = rows.map((e, i) => {
    const cls = String(e?.class || '').toUpperCase().replace(/[\s-]+/g, '_');
    const known = LADDER.includes(cls);
    if (!known) unknown.push({ index: i, class: e?.class ?? null, difference: e?.difference ?? null });
    const hypothesis = e?.hypothesis === true || HYPOTHESIS.has(cls);
    return { id: e?.id ?? `difference-${i}`, difference: e?.difference ?? null, component: e?.component ?? null, gene: e?.gene ?? null,
      class: known ? cls : 'UNRESOLVED', class_as_given: e?.class ?? null, class_recognised: known,
      hypothesis, evidence: Array.isArray(e?.evidence) ? e.evidence : [], kind: e?.kind ?? null };
  });
  const count = p => entries.filter(p).length;
  const counts = Object.fromEntries(LADDER.map(c => [c, count(e => e.class === c && e.class_recognised)]));
  const demonstrated = count(e => DEMONSTRATED.has(e.class) && !e.hypothesis && e.class_recognised);
  const hypothesised = count(e => e.hypothesis);
  const unresolved = count(e => UNRESOLVED.has(e.class) || !e.class_recognised);
  const mismatch = raw.counts ? LADDER.filter(c => raw.counts[c] != null && raw.counts[c] !== counts[c]).map(c => ({ class: c, module_said: raw.counts[c], recomputed: counts[c] })) : [];
  return {
    ran: true,
    closest_functional_analogue: raw.closest_functional_analogue ?? null,
    // A desired phenotype that names no function in the registry. Carried explicitly because
    // normaliseLedger copies named fields only, and this one changes what the whole ledger means.
    ...(raw.desired_phenotype_unmatched ? { desired_phenotype_unmatched: raw.desired_phenotype_unmatched } : {}),
    requirement_set: Array.isArray(raw.requirement_set) ? raw.requirement_set : [],
    entries, counts,
    // The headline split: demonstrated resolutions and hypothesised ones are reported separately, always.
    resolution: { differences: entries.length, demonstrated, hypothesised, unresolved,
      demonstrated_fraction: entries.length ? +(demonstrated / entries.length).toFixed(4) : null,
      note: 'demonstrated and hypothesised are never summed; "could be compensated" is not a resolution' },
    coverage: raw.coverage ?? { note: 'the functional module reported no coverage figure, so how much of the design the ledger covers is unknown' },
    unknown_classes: unknown,
    ...(mismatch.length ? { counts_disagreed_with_module: mismatch } : {}),
    // A gate, in the spirit of the Lean gate: an unresolved difference means the design is not accounted for,
    // whatever the similarity scores say. It does NOT move the frozen composite score (see SCORER-RESULTS.md).
    // The first gate question is not "how many differences are unresolved" but "is this ledger even
    // about the function that was requested". A ledger built on a function nobody asked for cannot pass,
    // however tidy its counts are, so it is checked before them.
    gate: raw.desired_phenotype_unmatched
      ? `FAIL: the desired phenotype names no function in the registry (${(raw.desired_phenotype_unmatched.registry_functions || []).join(', ')}), so this ledger is about a DIFFERENT function and establishes nothing about the one requested. Not a measurement failure: an out-of-scope request.`
      : unresolved > 0
      ? `FAIL: ${unresolved} difference(s) from the closest functional analogue are UNRESOLVED; the design is not functionally accounted for, whatever the similarity scores`
      : entries.length === 0 ? 'no differences were classified: the ledger is empty, which is not evidence that there are none'
        : hypothesised > 0 ? `no UNRESOLVED difference, but ${hypothesised} rest on a COMPENSATORY hypothesis rather than a demonstrated resolution`
          : 'every difference has a demonstrated resolution',
    scope: raw.scope ? `${raw.scope} ${SCOPE_NOTE}` : SCOPE_NOTE,
    source: 'sim-engine/validate/functional/ (built by another thread; consumed through validate/functional-interface.mjs)',
  };
}

/** The fourth named result for a design. Absent module -> {ran:false, reason}; never fabricated. */
export async function functionalResolutionFor(design, opts = {}) {
  const mod = await loadFunctional();
  if (!mod.ok) return { ran: false, reason: mod.reason, scope: SCOPE_NOTE };
  try { return normaliseLedger(await mod.fn(design, opts)); }
  catch (e) { return { ran: false, reason: `the functional module threw: ${e.message}`, scope: SCOPE_NOTE }; }
}
