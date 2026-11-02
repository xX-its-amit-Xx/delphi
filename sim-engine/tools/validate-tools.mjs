// Design validation tools (sim-engine/validate/): closest real relative (phenotype, genotype), sanity checks,
// Lean by component, the design scorer, and the one-call validation report with an optional swarm task list.
// Same {name, title, description, inputSchema, handler} shape as TOOLS in server.mjs; registration patch for the hub
// in tools/VALIDATE-REGISTER.md. http.mjs serves these as POST /tool/<name> through its tools/ discovery already.
import { envelope, p } from '../lib/envelope.mjs';
// The weakest-to-strongest order lib/envelope.mjs uses. Object.keys(KINDS) is NOT this order, so it is repeated
// here verbatim rather than derived: reversing KINDS would rank borrowed below derived and misreport weakest_input.
const KIND_ORDER = ['assumed', 'borrowed', 'measured-secondhand', 'calibrated', 'derived', 'measured'];
import { loadBundle } from '../lib/data-node.mjs';
import { resolveState } from '../lib/state.mjs';
import { getDoc } from './studio.mjs';
import * as O from '../lib/organism.mjs';
import { rawFromState, closestPhenotype, loadReferences } from '../validate/phenotype.mjs';
import { closestGenotype, STATE_NOT_PHENOTYPE } from '../validate/genotype.mjs';
import { phenoSanity, genoSanity } from '../validate/sanity.mjs';
import { leanByComponent } from '../validate/lean-components.mjs';
import { leanRounds } from '../validate/lean-rounds.mjs';
import { designScoreTool, validateDesign, swarmTasks, assess, SCORER } from '../validate/score.mjs';

const ORG = { description: 'Organism: a saved document id, a repository organism/design id (zebrafish-adult, flying-fish, winged-zebrafish, tff, ff-zf-chimera, ...), or an inline organism document. Gene edits: target {level:"gene", id}, param "allele" with an HGVS-like value (p.W169L, p.Y285*, c.505del, p.T200K/+), "knockout" or "expression_fold"; genes outside the vetted map go in doc.genotype [{gene, change}].', anyOf: [{ type: 'string' }, { type: 'object' }] };
const SPECIMEN = { type: 'object', description: 'Instead of an organism: a raw specimen record {SL_m, mass_kg, depth_SL, width_SL, ped_depth_frac, ped_width_frac, pectoral_len_SL, ...} (e.g. a museum specimen).' };
const COMMON = {
  organism: ORG, specimen: SPECIMEN, ageDays: { type: 'number' }, conditions: { type: 'object' },
  exclude: { type: 'array', items: { type: 'string' }, description: 'Reference ids or groups to leave out of the nearest-neighbour search (e.g. "organism:zebrafish" for a leave-lineage-out check).' },
  containment: { type: 'array', items: { type: 'object' }, description: 'partedit.js containment results from the browser: [{part, refused}] (refused = reason string or false).' },
  network: { type: 'boolean', description: 'Allow cached network calls (UniProt, Ensembl). Default true; results are cached in sim-engine/validate/cache/.' },
  blast: { type: 'boolean', description: 'For genes not in sequences/alignments: run NCBI BLAST (blastp nr, NOT Aves[Organism]; minutes; cached). Default false.' },
  lawset: { type: 'string' },
  version: { type: 'string', description: 'Scorer version (score-weights*.json): 1.0.0 (default, the blind-validated one), 1.1.0, 1.1.1 (adds rank_score), 1.2.0 (frozen for the blind benchmark run) or 1.3.0 (adds the joint correlation-aware term; see SCORER-RESULTS.md).' },
};
const SCOPE_PH = 'Nearest real relatives in a 6-feature body space (FishShapes v1, 16 377 teleost specimens, measured; our 3 real organisms and their ontogeny stages) and on pectoral fin length (Daane 2021 sheet A, 9 beloniform species, measured). The other fin features have only our own two lineages as references, so they get an uncalibrated envelope rule. Distance is not relatedness: a nearest neighbour is the most similar shape, not an ancestor. Birds (Aves) excluded: frozen holdout.';

// ---------------------------------------------------------------- reference-set taxon scope
//
// A reference set is calibrated on a clade, and comparing a design with a reference set that does not
// cover its clade produces an answer that is confident and meaningless. Before this gate existed, a mouse
// specimen -- SL 9 cm, mass 20 g, with `taxon: "Mus musculus"` stated in the record -- came back with
// `closest_real_relative: Nannacara anomala`, a cichlid, at distance 0.577. The out-of-distribution flag
// did fire, but the headline field still named a fish as the closest real relative to a mouse, and the
// taxon in the query was never read.
//
// So each reference set now DECLARES the clades it covers, and a query naming a taxon outside them gets
// cannot-assess with both clades named. This is not a measurement failure and must not read as one: it is
// a statement that this project holds no reference set for that animal.
//
// The clades come from the data, not from an opinion: FishShapes v1 is 16,377 teleost specimens, and the
// fin axis is nine beloniform species from Daane 2021. Membership is decided by the generated clade table
// (lib/lean-scope.mjs), the same one the law scope uses, so "inside Teleostei" means the same thing in
// both places.
const REFERENCE_SCOPES = {
  phenotype: {
    taxa: ['Teleostei'],
    basis: 'FishShapes v1 (doi 10.1002/ecy.3829) is 16 377 TELEOST specimens, and the fin axis is 9 beloniform species (Daane et al. 2021 sheet A). There is no non-teleost shape reference in this project.',
    what_is_missing: 'a body-shape reference set covering the design\'s clade, with its own out-of-distribution calibration',
  },
  genotype: {
    taxa: ['Teleostei'],
    basis: 'sequences/alignments/*.json are Ensembl 116 canonical proteins for zebrafish, medaka and two flying fishes, plus human as an outgroup. Orthologue comparison outside Teleostei has no alignment to run against here.',
    what_is_missing: 'orthologue alignments for the design\'s clade',
  },
};

/**
 * The taxon a validate call is about: the specimen record, the argument, the document's base, or -- for a
 * DESIGN -- the taxon of the organism it is a blend of.
 *
 * That last step matters. In the bundle only the three reference organisms carry a taxon; the four designs
 * carry parents instead, so `winged-zebrafish` reached the clade gate with no taxon at all and the gate
 * skipped itself on exactly the designs it most needs to cover. A design blended from Danio rerio is a
 * Danio rerio design for the purpose of asking whether a teleost reference set covers it.
 *
 * Where parents disagree the taxon is the dominant one by weight, and the gate reports which, because a
 * 50/50 chimera is not unambiguously inside either parent's clade and a reader should see the choice.
 */
async function queryTaxon(args, doc) {
  const direct = args?.taxon || args?.specimen?.taxon || doc?.base?.taxon || doc?.taxon || doc?.species;
  if (direct) return { taxon: direct, from: 'stated' };
  const parents = doc?.base?.parents;
  if (!Array.isArray(parents) || !parents.length) return { taxon: null, from: null };
  const bundle = await loadBundle();
  const leaves = O.leaves(bundle, parents);
  const ranked = Object.entries(leaves).sort((a, b) => b[1] - a[1]);
  for (const [id, w] of ranked) {
    const t = bundle.organisms[id]?.taxon || bundle.organisms[id]?.species;
    if (t) return { taxon: t, from: `the design's dominant parent ${id} (weight ${+w.toFixed(3)})${ranked.length > 1 ? `, of ${ranked.length} reference organisms it blends` : ''}` };
  }
  return { taxon: null, from: null };
}

/**
 * Decide whether a reference set may be used for this query.
 * -> { ok:true } | { ok:false, cannot_assess: {...} }
 */
async function referenceScopeGate(which, args, doc) {
  const sc = REFERENCE_SCOPES[which];
  const { taxon, from: taxonFrom } = await queryTaxon(args, doc);
  const S = await import('../../lib/lean-scope.mjs');
  if (!taxon) {
    // Nothing to check against. The call proceeds, because most callers pass a design built from this
    // engine's own teleosts, but the result says the scope was never checked rather than implying it was.
    return { ok: true, taxon: null, taxon_scope_unchecked: `no taxon was given, so it was NOT checked against this reference set's clades (${sc.taxa.join(', ')}). ${sc.basis} Pass taxon to have it checked.` };
  }
  const pl = sc.taxa.map(t => ({ clade: t, ...S.taxonPlacement(taxon, t) }));
  if (pl.some(x => x.within)) return { ok: true, taxon, taxon_from: taxonFrom, in_clade: pl.filter(x => x.within).map(x => x.clade) };
  const place = S.placeTaxon(taxon);
  if (pl.every(x => !x.known)) {
    return { ok: false, cannot_assess: {
      cannot_assess: true, taxon, reference_set_covers: sc.taxa, reason:
        `the clade table cannot place "${taxon}", so whether this reference set covers it is UNKNOWN rather than decided. Nothing was compared and no nearest relative is reported. Add the taxon in lean/registry/build-taxonomy.mjs and rerun it.`,
      taxon_from: taxonFrom, what_is_missing: sc.what_is_missing, basis: sc.basis, kind: 'unplaced' } };
  }
  return { ok: false, cannot_assess: {
    cannot_assess: true, taxon, reference_set_covers: sc.taxa,
    design_clades: place.placed ? place.ancestors.slice(0, 6) : [],
    reason:
      `this reference set covers ${sc.taxa.join(', ')}, and ${taxon} is outside it`
      + (place.placed ? ` (the NCBI taxonomy places it inside ${place.ancestors.slice(0, 4).join(', ')})` : '')
      + `. No nearest relative is reported, because the nearest shape in a reference set that does not cover the animal is not a relative of it -- it is the least bad row in the wrong table. This is cannot-assess, not a measurement that failed.`,
    taxon_from: taxonFrom, what_is_missing: sc.what_is_missing, basis: sc.basis, kind: 'out-of-clade' } };
}

async function stateOf(args) {
  const bundle = await loadBundle(); const { doc } = await getDoc(args.organism);
  return { bundle, doc, state: resolveState(doc, args.ageDays, args.conditions || {}, bundle) };
}

export const VALIDATE_TOOLS = [
  { name: 'closest_relative_phenotype', title: 'Closest real relative (phenotype)',
    description: 'Embed the design\'s resolved STATE (SL, mass/SL^3, depth/SL, width/SL, peduncle fractions, fin sizes) and return the nearest real organisms/specimens with distance, dominant features and an out-of-distribution flag whose threshold is calibrated on held-out real specimens.',
    inputSchema: { type: 'object', properties: { organism: ORG, specimen: SPECIMEN, ageDays: COMMON.ageDays, conditions: COMMON.conditions, exclude: COMMON.exclude, k: { type: 'integer' } } },
    handler: async args => {
      // The clade gate runs BEFORE any neighbour is computed. Computing one and then labelling it
      // unusable still puts a species name in the result, and a species name in a result gets quoted.
      let doc = null;
      if (args.organism) { try { doc = (await getDoc(args.organism)).doc; } catch { /* reported by stateOf below */ } }
      const gate = await referenceScopeGate('phenotype', args, doc);
      if (!gate.ok) {
        return envelope(gate.cannot_assess,
          [p('reference set', 'FishShapes v1', 'measured', 'doi 10.1002/ecy.3829; Zenodo 6642650 -- not used for this query, which is outside its clade')],
          SCOPE_PH + ' THIS CALL RETURNED NO COMPARISON: the reference set does not cover the design\'s clade, which is reported as cannot-assess rather than as a distant neighbour.');
      }
      const raw = args.specimen || rawFromState((await stateOf(args)).state);
      const R = await loadReferences();
      const r = await closestPhenotype(raw, { k: args.k || 5, exclude: args.exclude || [] });
      return envelope({ ...r, taxon: gate.taxon ?? null, reference_set_covers: REFERENCE_SCOPES.phenotype.taxa,
        ...(gate.taxon_scope_unchecked ? { taxon_scope_unchecked: gate.taxon_scope_unchecked } : {}),
        ...(gate.in_clade ? { taxon_inside_reference_clade: gate.in_clade, taxon_from: gate.taxon_from } : {}),
        calibration: { body: { n: R.calibration.body.n, held_out_species: R.calibration.body.held_out_species, p50: R.calibration.body.p50, p95: R.calibration.body.p95, threshold: R.calibration.body.threshold, rule: R.calibration.body.threshold_rule }, fin: { n: R.calibration.fin.n, threshold: R.calibration.fin.threshold, rule: R.calibration.fin.threshold_rule } } },
        [p('FishShapes v1', R.sources.fishshapes_rows, 'measured', 'doi 10.1002/ecy.3829; Zenodo 6642650'), p('OOD threshold', R.calibration.body.threshold, 'derived', R.calibration.body.threshold_rule)], SCOPE_PH);
    } },
  { name: 'closest_relative_genotype', title: 'Closest real relative (genotype)',
    description: 'For each gene-level edit, compare the edited protein against real orthologues (sequences/alignments first; NCBI BLAST on request): % identity, closest species, and whether the edited residue state exists in any real organism or known allele. A residue is a STATE, not a phenotype: nothing here predicts a phenotype.',
    inputSchema: { type: 'object', properties: { organism: ORG, network: COMMON.network, blast: COMMON.blast }, required: ['organism'] },
    handler: async args => {
      const { doc } = await getDoc(args.organism);
      const gate = await referenceScopeGate('genotype', args, doc);
      if (!gate.ok) {
        return envelope(gate.cannot_assess,
          [p('alignments', 'sequences/alignments/*.json', 'measured', 'Ensembl 116 teleost proteins -- not used for this query, which is outside their clade')],
          STATE_NOT_PHENOTYPE + ' THIS CALL RETURNED NO COMPARISON: there is no orthologue alignment for the design\'s clade here, reported as cannot-assess.');
      }
      const r = await closestGenotype(doc, { network: args.network !== false, blast: !!args.blast });
      return envelope(r, [p('alignments', 'sequences/alignments/*.json', 'measured', 'Ensembl 116 / NCBI / figshare proteins, MAFFT L-INS-i (sequences/README.md)')], STATE_NOT_PHENOTYPE + ' Birds were never fetched (frozen holdout) and every comparison filters them explicitly.');
    } },
  { name: 'sanity_check_design', title: 'Genotype and phenotype sanity checks',
    description: 'Genotype: reference residue, frame, premature stop, conserved site, annotated domain, causal-chain caveats. Phenotype: allometry within the range observed across 16 377 FishShapes specimens, mass fits the body envelope, flight muscle fits (mesh or analytic), partedit containment if supplied, stage consistency. Each check: passed / failed / flagged / could-not-run.',
    inputSchema: { type: 'object', properties: { organism: ORG, specimen: SPECIMEN, ageDays: COMMON.ageDays, conditions: COMMON.conditions, containment: COMMON.containment, network: COMMON.network, family: { enum: ['genotype', 'phenotype', 'both'] } } },
    handler: async args => {
      const r = await assess({ ...args });
      const fam = args.family || 'both';
      return envelope({ phenotype: fam !== 'genotype' ? r.sanity.phenotype : undefined, genotype: fam !== 'phenotype' ? r.sanity.genotype : undefined },
        [p('FishShapes ranges', null, 'measured', 'validate/data/fishshapes-features.json')], 'Sanity checks compare against observed ranges; inside the range is not evidence the design could exist. ' + STATE_NOT_PHENOTYPE);
    } },
  { name: 'lean_by_component', title: 'Lean verdicts grouped by component',
    description: 'Runs lean_check on the design and groups every verdict by body, organ system (with its parts) and gene, each with law id, version, status, verdict and the inputs that decided it. Accepted-law violations newly caused by the design are kept apart from those its real parents also have, and from candidate/contested laws.',
    inputSchema: { type: 'object', properties: { organism: ORG, ageDays: COMMON.ageDays, conditions: COMMON.conditions, lawset: COMMON.lawset, network: COMMON.network }, required: ['organism'] },
    handler: async args => {
      const { bundle, doc } = await stateOf(args);
      const g = await closestGenotype(doc, { network: args.network !== false });
      const r = await leanByComponent(doc, bundle, { ageDays: args.ageDays, conditions: args.conditions || {}, lawset: args.lawset || 'current', genotypeEdits: g.edits.map(e => e.lean_genotype_edit).filter(Boolean) });
      return envelope(r, [p('Lean verdicts', r.lawset_version, 'derived', 'lib/lean.mjs leanVerdicts -> lib/lean-source.mjs checkDesign (floating point, not a kernel check)')], r.note);
    } },
  { name: 'design_score', title: 'Design score (pre-registered, validated)',
    description: `One number with its components: phenotype plausibility vs closest real relatives (P), accepted-law Lean violations newly caused (L), genotype sequence sanity (G), spec performance if a spec is given (S) and evidence strength (E). Formula and weights fixed in ${SCORER.preregistration} before validation; results of that validation in sim-engine/validate/SCORER-RESULTS.md.`,
    inputSchema: { type: 'object', properties: { ...COMMON, reference_set_excluding: { type: 'array', items: { type: 'string' }, description: 'Leave-out scoring: ids, species:Genus_species, family:Name, order:Name, organism:zebrafish|flying-fish. Use it whenever the design IS a real organism, or real-organism scores are trivially high (distance 0).' }, taxon: { type: 'string' }, label: { type: 'string' }, spec: { type: 'object', description: 'Optional DesignSpec (design_from_spec format) for the S component.' } } },
    handler: args => designScoreTool(args) },
  { name: 'validate_design', title: 'Validate a design (one call, TWO Lean rounds)',
    description: 'Closest real relatives (phenotype and genotype), sanity checks, Lean by component and the design score in one report, and TWO Lean rounds instead of one: round 1 against the law set that was in force when the design was made (read off the lawset_version its edits record), then the CURRENT law set is re-resolved and round 2 is run against that. Both rounds are reported with their law-set version and timestamp, and the difference is named: newly_violated_since (laws admitted since that the design now breaks), newly_binding_since (violations it already had, now binding because the law was raised to accepted), no_longer_violated_since and newly_unjudged_since. A design that was valid last week and is not valid today is what a living law base is for, and it is visible here. The verdict never says "valid": it lists checks passed, failed, flagged and not run, and names the closest real relative. swarm:true adds validation sub-tasks for the swarm board.',
    inputSchema: { type: 'object', properties: { ...COMMON, spec: { type: 'object' }, swarm: { type: 'boolean' },
      made_under_lawset: { type: 'string', description: 'The law set to use for round 1, when the design itself does not record one (an unedited repository organism or an inline document). Omitted: the newest lawset_version stamped on the document\'s edits, else the current set, and lean_rounds.round1.lawset_basis says which.' },
      second_round: { type: 'boolean', description: 'Run the second Lean round (default true). false gives the single-round report only.' } } },
    handler: async args => {
      const out = await validateDesign(args);
      if (args.second_round === false) { out.result.lean_rounds = { skipped: 'second_round:false was passed; only the single round inside lean_by_component ran' }; return out; }
      // The second round is reported even when it fails: a validation report that quietly drops it would be
      // exactly the "checked once, long ago" behaviour this replaces.
      try {
        out.result.lean_rounds = args.organism
          ? await leanRounds({ organism: args.organism, ageDays: args.ageDays, conditions: args.conditions || {}, from: args.made_under_lawset || null, to: args.lawset || null })
          : { skipped: 'no organism document was given (a raw specimen record carries no edit history, so there is no law set it was made under); pass organism, or made_under_lawset with an organism, to get two rounds' };
      } catch (e) { out.result.lean_rounds = { error: e.message, note: 'the second Lean round did not run; the single-round verdicts in lean_by_component are the only Lean result in this report' }; }
      const lr = out.result.lean_rounds;
      if (lr && lr.round2) {
        out.result.lean_rounds_headline = lr.summary;
        out.scope += ' The Lean part is reported TWICE: round 1 against law set ' + lr.round1.lawset_version
          + ' (' + lr.round1.lawset_basis + ') and round 2 against ' + lr.round2.lawset_version
          + '. lean_by_component, lean_check and the score use the CURRENT law set, so they agree with round 2;'
          + ' round 1 exists to show whether this design\'s verdict has changed since it was made, and it changes nothing else in this report.';
        out.provenance.push(p('round 1 law set', lr.round1.lawset_version, 'derived', 'sim-engine/validate/lean-rounds.mjs: ' + lr.round1.lawset_basis_detail),
          p('round 2 law set', lr.round2.lawset_version, 'derived', 'lean/registry/lawsets/current.json, re-resolved at call time'));
        // lib/envelope.mjs computes `counts` and `weakest_input` when the envelope is BUILT, so rows pushed
        // afterwards would leave both stale (counts under-reported by 2). They are honesty fields, so they are
        // recomputed here by the same rule rather than left disagreeing with the list they summarise.
        out.counts = out.provenance.reduce((a, q) => ((a[q.kind] = (a[q.kind] || 0) + 1), a), {});
        out.weakest_input = KIND_ORDER.find(k => out.provenance.some(q => q.kind === k)) || 'none';
      }
      return out;
    } },
  { name: 'validate_swarm_tasks', title: 'Validation sub-tasks for the swarm board',
    description: 'The six validation sub-tasks (closest-relative-phenotype, closest-relative-genotype, sanity-geno, sanity-pheno, lean-by-component, adversarial-review) as JSON for swarm_post_task.',
    inputSchema: { type: 'object', properties: { organism: ORG, specimen: SPECIMEN, exclude: COMMON.exclude } },
    handler: async args => envelope(swarmTasks(args), [p('task list', 'validate', 'derived', 'sim-engine/validate/score.mjs swarmTasks')], 'A task list, not results. Running the tasks is the swarm\'s job.') },
];
