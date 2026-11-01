// Design validation tools (sim-engine/validate/): closest real relative (phenotype, genotype), sanity checks,
// Lean by component, the design scorer, and the one-call validation report with an optional swarm task list.
// Same {name, title, description, inputSchema, handler} shape as TOOLS in server.mjs; registration patch for the hub
// in tools/VALIDATE-REGISTER.md. http.mjs serves these as POST /tool/<name> through its tools/ discovery already.
import { envelope, p } from '../lib/envelope.mjs';
import { loadBundle } from '../lib/data-node.mjs';
import { resolveState } from '../lib/state.mjs';
import { getDoc } from './studio.mjs';
import { rawFromState, closestPhenotype, loadReferences } from '../validate/phenotype.mjs';
import { closestGenotype, STATE_NOT_PHENOTYPE } from '../validate/genotype.mjs';
import { phenoSanity, genoSanity } from '../validate/sanity.mjs';
import { leanByComponent } from '../validate/lean-components.mjs';
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
  version: { type: 'string', description: 'Scorer version (score-weights*.json): 1.0.0 (default, the pre-registered and validated one) or 1.1.0.' },
};
const SCOPE_PH = 'Nearest real relatives in a 6-feature body space (FishShapes v1, 16 377 teleost specimens, measured; our 3 real organisms and their ontogeny stages) and on pectoral fin length (Daane 2021 sheet A, 9 beloniform species, measured). The other fin features have only our own two lineages as references, so they get an uncalibrated envelope rule. Distance is not relatedness: a nearest neighbour is the most similar shape, not an ancestor. Birds (Aves) excluded: frozen holdout.';

async function stateOf(args) {
  const bundle = await loadBundle(); const { doc } = await getDoc(args.organism);
  return { bundle, doc, state: resolveState(doc, args.ageDays, args.conditions || {}, bundle) };
}

export const VALIDATE_TOOLS = [
  { name: 'closest_relative_phenotype', title: 'Closest real relative (phenotype)',
    description: 'Embed the design\'s resolved STATE (SL, mass/SL^3, depth/SL, width/SL, peduncle fractions, fin sizes) and return the nearest real organisms/specimens with distance, dominant features and an out-of-distribution flag whose threshold is calibrated on held-out real specimens.',
    inputSchema: { type: 'object', properties: { organism: ORG, specimen: SPECIMEN, ageDays: COMMON.ageDays, conditions: COMMON.conditions, exclude: COMMON.exclude, k: { type: 'integer' } } },
    handler: async args => {
      const raw = args.specimen || rawFromState((await stateOf(args)).state);
      const R = await loadReferences();
      const r = await closestPhenotype(raw, { k: args.k || 5, exclude: args.exclude || [] });
      return envelope({ ...r, calibration: { body: { n: R.calibration.body.n, held_out_species: R.calibration.body.held_out_species, p50: R.calibration.body.p50, p95: R.calibration.body.p95, threshold: R.calibration.body.threshold, rule: R.calibration.body.threshold_rule }, fin: { n: R.calibration.fin.n, threshold: R.calibration.fin.threshold, rule: R.calibration.fin.threshold_rule } } },
        [p('FishShapes v1', R.sources.fishshapes_rows, 'measured', 'doi 10.1002/ecy.3829; Zenodo 6642650'), p('OOD threshold', R.calibration.body.threshold, 'derived', R.calibration.body.threshold_rule)], SCOPE_PH);
    } },
  { name: 'closest_relative_genotype', title: 'Closest real relative (genotype)',
    description: 'For each gene-level edit, compare the edited protein against real orthologues (sequences/alignments first; NCBI BLAST on request): % identity, closest species, and whether the edited residue state exists in any real organism or known allele. A residue is a STATE, not a phenotype: nothing here predicts a phenotype.',
    inputSchema: { type: 'object', properties: { organism: ORG, network: COMMON.network, blast: COMMON.blast }, required: ['organism'] },
    handler: async args => {
      const { doc } = await getDoc(args.organism);
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
  { name: 'validate_design', title: 'Validate a design (one call)',
    description: 'Closest real relatives (phenotype and genotype), sanity checks, Lean by component and the design score in one report. The verdict never says "valid": it lists checks passed, failed, flagged and not run, and names the closest real relative. swarm:true adds validation sub-tasks for the swarm board.',
    inputSchema: { type: 'object', properties: { ...COMMON, spec: { type: 'object' }, swarm: { type: 'boolean' } } },
    handler: args => validateDesign(args) },
  { name: 'validate_swarm_tasks', title: 'Validation sub-tasks for the swarm board',
    description: 'The six validation sub-tasks (closest-relative-phenotype, closest-relative-genotype, sanity-geno, sanity-pheno, lean-by-component, adversarial-review) as JSON for swarm_post_task.',
    inputSchema: { type: 'object', properties: { organism: ORG, specimen: SPECIMEN, exclude: COMMON.exclude } },
    handler: async args => envelope(swarmTasks(args), [p('task list', 'validate', 'derived', 'sim-engine/validate/score.mjs swarmTasks')], 'A task list, not results. Running the tasks is the swarm\'s job.') },
];
