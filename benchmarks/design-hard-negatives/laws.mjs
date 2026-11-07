// Constraints taken from the law registry instead of from intuition - and the audit of how few there are.
//
// ============================== THE GAP THIS CLOSES ==============================
// adversarial.mjs finds the most typical anatomically impossible fish by minimising q subject to breaking
// a constraint. It uses EXACTLY ONE constraint, `eye-in-head`, found by hand. Meanwhile
// lean/registry/laws/ holds 62 laws, 48 of them with a Lean module and theorem - machine-readable
// statements about what is biologically or mechanically possible. Not one of them reached the benchmark.
//
// So: which laws can constrain the ten fishbase trait ratios at all? The honest answer, measured below,
// is ONE of the 48. That is the finding, not a failure of effort.
//
// ============================== WHY ONE ==============================
// The ten traits are all lengths divided by standard length. That single normalisation destroys most of
// the registry's content:
//
//   * A law about MASS, POWER, OXYGEN, AREA, STRESS, TEMPERATURE, DEPTH or ALTITUDE has no quantity here
//     to bind. Thirty of the 48 are of this kind.
//   * A law about how a quantity CHANGES WITH SIZE - every allometry, every log-log exponent, the cube
//     law, Thompson's square-root speed - is a statement relating two specimens. One specimen has no
//     exponent, and dividing by SL has already thrown away the size the law is about. Eight more.
//   * A law about GENOTYPES, POPULATIONS or RATE PARAMETERS binds codons, allele frequencies and
//     diffusivities. No morphometric ratio appears in it. Ten more.
//   * E5 and the flying-fish fin-ratio gap are the near miss, and worth stating precisely: they bound
//     `pectoral fin length / SL`. The block has `prepectoral_over_SL`, which is the distance from the
//     snout to the pectoral fin BASE. Those are different measurements of different things. The law is
//     expressible on morphometric ratios; it is not expressible on THESE morphometric ratios.
//
// What is left is `blueprint-well-formedness`: a finite graph of ontology terms with a level per node and
// `part_of` edges, where every edge goes strictly down in level. That is the only accepted theorem whose
// subject matter is anatomical STRUCTURE rather than a quantity the block does not carry.
//
// ============================== THE INTERPRETATION, STATED BEFORE THE NUMBERS ==============================
// The Lean theorem's `level` is a natural number: body 0, organ system 1, organ 2, tissue 3, cell 4. The
// module says so, and says the proofs "use only that edges strictly decrease it". Reading `level` as
// SPATIAL EXTENT - so that a part is no larger than its whole - is an INTERPRETATION ADDED HERE. It is not
// in the theorem, nothing in this file checks it against the theorem, and `Delphi.Blueprint` would prove
// exactly the same things if every extent in the animal were reversed.
//
// A sound proof of a statement translated wrongly is worth nothing. Each constraint below records the
// reading it made and the fact that the reading is unproved. The real-fish control in
// `verifyAgainstReal` is the only thing standing between a bad reading and a benchmark that reports the
// scorer failing to detect animals that exist.
//
// ============================== AND THE CONTROL REJECTED MORE THAN HALF ==============================
// Thirteen candidate containments were derived from that one law. SEVEN of them are false of real fish:
//
//      70.19 %   caudal_fin_height <= body_depth      REJECTED - 1,393 of 4,673 real fish break it
//      99.87 %   head_length <= preanal               REJECTED - flatfishes, Achiridae and Citharidae
//      99.53 %   eye_diameter <= caudal_fin_height    REJECTED
//      99.96 %   body_depth <= 1 SL                   REJECTED - Antigonia capros is deeper than it is long
//      99.96 %   eye_diameter <= body_depth           REJECTED - Solenostomus paradoxus
//      99.98 %   preanal <= 1 SL                      REJECTED - one specimen, and one is enough
//      99.98 %   every along-body distance <= 1 SL    REJECTED - the same specimen
//
// "The caudal fin is no deeper than the body" sounds like anatomy. It is false for 30 % of real fish. The
// rejection rate here (7 of 13) is close to adversarial.mjs's (4 of 8), from a different law and a
// different set of guesses, which is the useful part: a plausible-sounding containment is about as likely
// to be wrong as right, and only the control can tell.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, pooled, makeScorer } from './joint.mjs';
import { mostTypicalViolator } from './adversarial.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_DIR = path.resolve(HERE, '../../lean/registry/laws');
export const HELDOUT_PATH = path.resolve(HERE, '../../sim-engine/validate/benchmark/heldout/items.jsonl');

/** The ten fishbase trait ratios the benchmark scores. Every one is a length over standard length. */
export const TRAITS = Object.freeze([
  'body_depth_over_SL',
  'caudal_fin_aspect_ratio',
  'caudal_fin_height_over_SL',
  'eye_diameter_over_SL',
  'head_length_over_SL',
  'preanal_over_SL',
  'predorsal_over_SL',
  'preorbital_over_SL',
  'prepectoral_over_SL',
  'prepelvic_over_SL',
]);

// ---------------------------------------------------------------- the registry, read not assumed

/** Every law file, keyed by law_id. Read-only; this file never writes to lean/. */
export function loadRegistry(dir = REGISTRY_DIR) {
  const out = new Map();
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    out.set(j.law_id, j);
  }
  return out;
}

/**
 * 'theorem' only when the registry names BOTH a Lean module and a theorem in it. Everything else -
 * a gap, a named hypothesis, a bare empirical row - is 'no-lean-theorem'.
 *
 * This exists so that a law with no proof cannot be quoted here as though it had one. It says nothing
 * about whether the named theorem was checked, nor whether it says what the English says.
 */
export function proofStatus(law) {
  const r = law && law.lean_ref;
  return r && r.module && r.theorem ? 'theorem' : 'no-lean-theorem';
}

// ---------------------------------------------------------------- the audit

/** The reason codes used by SURVEY. Each one names a quantity the ten traits do not carry. */
export const WHY_NOT = Object.freeze({
  'expressible': 'the law constrains these traits, and a constraint is given below',
  'needs-mass-or-weight': 'binds a mass, a weight or a wing loading; the block carries no mass',
  'needs-power-or-oxygen': 'binds a metabolic or mechanical power, an O2 content, a flow or an efficiency',
  'needs-area-or-stress': 'binds an area, a cross-section, a section modulus or a stress',
  'needs-two-sizes':
    'a statement about how a quantity changes with size - a ratio between two specimens, or a log-log ' +
    'exponent. One specimen has no exponent, and dividing by SL has already removed the size the law ' +
    'is about, so the law is not merely unmeasured here, its content is annihilated by the normalisation',
  'needs-time-or-age': 'binds an age, a duration, a generation count or a developmental hour',
  'needs-genotype': 'binds codons, substitutions or allele identities',
  'needs-population': 'binds allele frequencies, fitnesses, sex ratios or effective population size',
  'needs-environment': 'binds depth, temperature, altitude, air or water density, current or wind',
  'needs-rate-parameters': 'binds diffusivities, Jacobian entries, Q10 or other rate constants',
  'needs-graph-not-measurement': 'a statement about an ontology or staging graph, not about any measurement',
  'trait-not-in-block':
    'the quantity IS a morphometric ratio, just not one of these ten - the near miss, and the reason ' +
    'to name the measurement rather than the body part',
  'direction-only-no-bound': 'states a direction of effect, not a bound, so it cannot be violated by a number',
  'bookkeeping-not-physical': 'a convention about how the project records things, with no physical content',
});

/**
 * One row per law file. `expressible` is whether the law can be written as an inequality on the ten
 * traits; `why_not` is the reason it cannot, from WHY_NOT.
 *
 * Every law in the registry gets a row, including the retired, proposed, candidate and contested ones,
 * so that the denominator is the registry and not a selection from it.
 */
export const SURVEY = Object.freeze([
  { law_id: 'E1', expressible: false, why_not: 'needs-two-sizes', note: 'three within-species log-log exponents (fin area, wing loading, mass) on one species of flying fish' },
  { law_id: 'E2', expressible: false, why_not: 'needs-two-sizes', note: 'a band on the mass exponent b, used as a weight ratio between two lengths' },
  { law_id: 'E3', expressible: false, why_not: 'needs-power-or-oxygen', note: 'an aerobic ceiling in watts from efficiency, oxycaloric equivalent and O2 delivery' },
  { law_id: 'E4', expressible: false, why_not: 'needs-power-or-oxygen', note: 'no O2 uptake in air, so power over a flight is bounded by a stored O2 budget' },
  { law_id: 'E5', expressible: false, why_not: 'trait-not-in-block', note: 'bounds pectoral FIN LENGTH / SL in [0.406, 0.823]. The block has prepectoral_over_SL, the snout-to-fin-BASE distance. Different measurement; also Exocoetidae-only scope' },
  { law_id: 'E6', expressible: false, why_not: 'bookkeeping-not-physical', note: 'how "required for" rows may be derived in the genotype map' },
  { law_id: 'E7', expressible: false, why_not: 'needs-time-or-age', note: 'death_hpf <= scored_hpf; hours post fertilisation, not a ratio' },
  { law_id: 'E8', expressible: false, why_not: 'needs-graph-not-measurement', note: 'develops_from staging; retired' },
  { law_id: 'aerobic-power-bound', expressible: false, why_not: 'needs-power-or-oxygen', note: 'the Fick chain to a mechanical power ceiling' },
  { law_id: 'altitude-coupling', expressible: false, why_not: 'needs-environment', note: 'density and O2 partial pressure against height' },
  { law_id: 'aspect-ratio-induced-drag', expressible: false, why_not: 'direction-only-no-bound', note: 'induced drag FALLS with aspect ratio - a monotonicity, with no value it forbids. The block does carry caudal_fin_aspect_ratio, but the law is about the lifting fin and in any case bounds nothing' },
  { law_id: 'blueprint-well-formedness', expressible: true, why_not: 'expressible', note: 'part_of edges go strictly down in level. READ as: a part is no larger than its whole. That reading is this file\'s, not the theorem\'s' },
  { law_id: 'development-growth-asymptote', expressible: false, why_not: 'needs-time-or-age', note: 'von Bertalanffy length at age' },
  { law_id: 'disc-flying-fish-fin-ratio-gap', expressible: false, why_not: 'trait-not-in-block', note: 'the same pectoral fin length / SL as E5, and the same near miss' },
  { law_id: 'disc-heterurus-mass-exponent', expressible: false, why_not: 'needs-two-sizes', note: 'an OLS exponent of mass on length; contested' },
  { law_id: 'disc-measured-wing-loading-band', expressible: false, why_not: 'needs-mass-or-weight', note: 'N/m^2 from mass and lifting area' },
  { law_id: 'disc-pectoral-length-allometry', expressible: false, why_not: 'needs-two-sizes', note: 'an exponent across 49 specimens; a single design has none' },
  { law_id: 'elastic-similarity', expressible: false, why_not: 'needs-two-sizes', note: 'd proportional to l^(3/2); a gap, with no Lean theorem' },
  { law_id: 'favored-fixation-lower-bound', expressible: false, why_not: 'needs-population', note: 'fixation probability in an absorbing chain on gene copies' },
  { law_id: 'fick-principle', expressible: false, why_not: 'needs-power-or-oxygen', note: 'cardiac output times arteriovenous difference; a named hypothesis with no theorem' },
  { law_id: 'fin-length-ratio', expressible: false, why_not: 'trait-not-in-block', note: 'an open question about pectoral fin length, not a constraint; a gap with no theorem' },
  { law_id: 'fisher-ftns', expressible: false, why_not: 'needs-population', note: 'additive genetic variance in fitness' },
  { law_id: 'fisher-kpp-speed', expressible: false, why_not: 'needs-rate-parameters', note: 'dispersal coefficient and selection coefficient' },
  { law_id: 'fisher-sex-ratio', expressible: false, why_not: 'needs-population', note: 'equal investment in sons and daughters' },
  { law_id: 'flight-allometry-law', expressible: false, why_not: 'needs-two-sizes', note: 'power laws between two sizes; wing loading exponent as a difference of exponents' },
  { law_id: 'flight-climb-glide-law', expressible: false, why_not: 'needs-power-or-oxygen', note: 'available power, climb rate and L/D' },
  { law_id: 'gene-regulatory-dynamics', expressible: false, why_not: 'needs-genotype', note: 'how an edit changes a structure; a gap with no theorem' },
  { law_id: 'genotype-developmental-ordering', expressible: false, why_not: 'needs-graph-not-measurement', note: 'the SAME Graph machinery as blueprint-well-formedness, with level = developmental stage. Stages are not lengths, so the spatial reading that makes the blueprint law usable has nothing to attach to here' },
  { law_id: 'genotype-genetic-code', expressible: false, why_not: 'needs-genotype', note: 'minimum nucleotide substitutions between codons' },
  { law_id: 'genotype-pleiotropy-closure', expressible: false, why_not: 'needs-graph-not-measurement', note: 'a list-inclusion check on mapped and changed nodes' },
  { law_id: 'genotype-substitution-time', expressible: false, why_not: 'needs-genotype', note: 'waiting time for N substitutions' },
  { law_id: 'gill-o2-uptake', expressible: false, why_not: 'needs-power-or-oxygen', note: 'arterial O2 from gill area and ventilation; a gap with no theorem' },
  { law_id: 'haldane-cost-of-selection', expressible: false, why_not: 'needs-population', note: 'reproductive excess and cost per substitution; contested' },
  { law_id: 'hamilton-rule', expressible: false, why_not: 'needs-population', note: 'relatedness, benefit and cost as regressions of fitness' },
  { law_id: 'kimura-fixation-probability', expressible: false, why_not: 'needs-population', note: 'initial frequency, selective advantage, effective size' },
  { law_id: 'kimura-heterozygosity', expressible: false, why_not: 'needs-population', note: 'infinite-alleles equilibrium in Ne and mu' },
  { law_id: 'kimura-substitution-rate', expressible: false, why_not: 'needs-genotype', note: 'the molecular clock' },
  { law_id: 'maynardsmith-hawk-dove', expressible: false, why_not: 'needs-population', note: 'resource value, injury cost, escalation probability' },
  { law_id: 'maynardsmith-hitchhiking', expressible: false, why_not: 'needs-population', note: 'relative heterozygosity after a sweep' },
  { law_id: 'maynardsmith-twofold-cost', expressible: false, why_not: 'needs-population', note: 'grandchildren of an asexual mutant' },
  { law_id: 'muscle-power-premise', expressible: false, why_not: 'needs-power-or-oxygen', note: 'f p M; retired, and no Lean theorem' },
  { law_id: 'perturb-current', expressible: false, why_not: 'needs-environment', note: 'station holding against a current speed' },
  { law_id: 'perturb-depth-cap', expressible: false, why_not: 'needs-environment', note: 'isosmotic depth; contested' },
  { law_id: 'perturb-energy-balance', expressible: false, why_not: 'needs-power-or-oxygen', note: 'daily intake against respiration and activity' },
  { law_id: 'perturb-isa-vmin', expressible: false, why_not: 'needs-environment', note: 'minimum flight speed against ISA density' },
  { law_id: 'perturb-pressure', expressible: false, why_not: 'needs-environment', note: 'Boyle on a closed swim bladder at depth' },
  { law_id: 'perturb-thermal', expressible: false, why_not: 'needs-environment', note: 'a thermal window and a Q10 ceiling' },
  { law_id: 'perturb-wind-glide', expressible: false, why_not: 'needs-environment', note: 'ground range in an along-track wind' },
  { law_id: 'physiology-laplace', expressible: false, why_not: 'needs-area-or-stress', note: 'wall stress P r / (2 t); needs a pressure and a wall thickness' },
  { law_id: 'physiology-q10', expressible: false, why_not: 'needs-rate-parameters', note: 'a rate against temperature' },
  { law_id: 'scaling-area-law', expressible: false, why_not: 'needs-two-sizes', note: 'S(L2)/S(L1) = (L2/L1)^2. Dividing an area by SL^2 is exactly the normalisation the law describes, so on normalised traits it is a tautology with nothing to forbid' },
  { law_id: 'scaling-bending-law', expressible: false, why_not: 'needs-area-or-stress', note: 'bending stress, section modulus, safety factor' },
  { law_id: 'scaling-strength-law', expressible: false, why_not: 'needs-area-or-stress', note: 'breaking load sigma A and the safety factor against W' },
  { law_id: 'taxiing-thrust', expressible: false, why_not: 'needs-power-or-oxygen', note: 'caudal thrust during taxiing; a gap with no theorem' },
  { law_id: 'test-loop-only-density-sanity', expressible: false, why_not: 'needs-mass-or-weight', note: 'mass over SL^3; retired, and no Lean theorem' },
  { law_id: 'thompson1917-ch02-06', expressible: false, why_not: 'needs-two-sizes', note: 'work needed as L^3.5 against muscle power as L^3' },
  { law_id: 'thompson1917-ch02-07', expressible: false, why_not: 'needs-mass-or-weight', note: 'an absolute size limit on flight; needs a size, and these traits have none' },
  { law_id: 'thompson1917-ch02-10', expressible: false, why_not: 'needs-two-sizes', note: 'velocity as the square root of linear dimension' },
  { law_id: 'thompson1917-ch03-07', expressible: false, why_not: 'needs-two-sizes', note: 'the cube law in log-log form' },
  { law_id: 'turing-ddi', expressible: false, why_not: 'needs-rate-parameters', note: 'diffusivities and Jacobian entries of a two-morphogen system' },
  { law_id: 'turing-wavelength', expressible: false, why_not: 'needs-rate-parameters', note: 'the critical wavenumber cannot depend on tissue size - and no trait here is a wavenumber' },
  { law_id: 'walking-pendulum-speed', expressible: false, why_not: 'needs-two-sizes', note: 'speed proportional to sqrt(L); a gap with no theorem' },
]);

/** Count the survey against the registry so the denominator is never taken on trust. */
export function surveyCensus(registry = loadRegistry()) {
  const byStatus = {}, byReason = {};
  let expressible = 0, theoremCarrying = 0, expressibleWithTheorem = 0, acceptedRows = 0;
  const missing = [], extra = [];
  const seen = new Set(SURVEY.map(r => r.law_id));
  for (const id of registry.keys()) if (!seen.has(id)) missing.push(id);
  for (const r of SURVEY) {
    const law = registry.get(r.law_id);
    if (!law) { extra.push(r.law_id); continue; }
    byStatus[law.status] = (byStatus[law.status] || 0) + 1;
    byReason[r.why_not] = (byReason[r.why_not] || 0) + 1;
    const hasThm = proofStatus(law) === 'theorem';
    if (hasThm) theoremCarrying++;
    if (law.status === 'accepted') acceptedRows++;
    if (r.expressible) { expressible++; if (hasThm) expressibleWithTheorem++; }
  }
  return {
    laws_in_registry: registry.size,
    survey_rows: SURVEY.length,
    laws_not_surveyed: missing,
    survey_rows_with_no_law: extra,
    accepted_in_registry: [...registry.values()].filter(l => l.status === 'accepted').length,
    accepted_rows_in_survey: acceptedRows,
    theorem_carrying: theoremCarrying,
    expressible,
    expressible_with_a_lean_theorem: expressibleWithTheorem,
    expressibility_rate_over_theorem_carrying: Number((expressibleWithTheorem / theoremCarrying).toFixed(4)),
    by_status: byStatus,
    by_reason: byReason,
  };
}

// ---------------------------------------------------------------- the candidate constraints

const BLUEPRINT = 'blueprint-well-formedness';

/**
 * Shared by every constraint below, because every one of them makes the same unproved move.
 *
 * `Delphi.Blueprint.Graph.LevelsDown` says the whole's level is a smaller NATURAL NUMBER than the part's,
 * where the levels are body 0, organ system 1, organ 2, tissue 3, cell 4. Nothing in the module relates a
 * level to a length. Replacing the ordinal depth with a measured extent is the step taken here, and it is
 * taken without proof.
 */
const LEVEL_AS_EXTENT = Object.freeze({
  reads: 'Graph.LevelsDown (whole shallower in level than part)',
  as: 'extent(part) <= extent(whole), with every extent measured in standard lengths',
  unproved_step:
    'the theorem\'s level is an ordinal depth in {0,1,2,3,4}; this file substitutes a measured length for ' +
    'it. The substitution is not in the Lean module and nothing here checks it against the module.',
  also_assumed:
    'that Ubergraph served the part_of edges correctly (the law\'s own assumed-1), and that the particular ' +
    'edge each constraint names is in the graph - this file names the edges in prose and does not read them ' +
    'from any emitted blueprint.',
});

/** The same, plus the extra step of treating two sub-extents of one whole as disjoint and additive. */
const DISJOINT_SUBPARTS = Object.freeze({
  reads: 'Graph.LevelsDown, twice, on two parts of the same whole',
  as: 'extent(part A) + extent(part B) <= extent(whole)',
  unproved_step:
    'the level order gives each part separately below the whole. ADDING two parts needs them to be ' +
    'disjoint and laid end to end along the same axis, which is geometry the theorem does not contain at ' +
    'all - the graph has no coordinates.',
  also_assumed: LEVEL_AS_EXTENT.also_assumed,
});

/** Siblings: no part_of edge joins them, so the level order says nothing. Kept to show what that costs. */
const SIBLING_ORDER = Object.freeze({
  reads: 'nothing in the theorem - the two terms are siblings under a common whole',
  as: 'an ordering or size comparison between them anyway',
  unproved_step:
    'there is no part_of edge between siblings, so LevelsDown constrains them not at all. These rows are ' +
    'in the list because they SOUND like anatomy, and the control is what tells them apart from the rest.',
  also_assumed: LEVEL_AS_EXTENT.also_assumed,
});

/**
 * Candidate constraints in the shape adversarial.mjs uses: slack >= 0 means satisfied.
 *
 * NO measured rate is stored on a candidate. The rate comes from verifyAgainstReal every time it is
 * asked for, so that the control cannot be passed by quoting a number that was true once.
 */
export const CANDIDATES = Object.freeze([
  {
    id: 'bp-eye-in-head',
    law_id: BLUEPRINT,
    statement: 'eye_diameter_over_SL <= head_length_over_SL',
    why: 'the eye is part_of the head, so it cannot be wider than the head is long',
    edge: 'eye (UBERON:0000970) part_of head (UBERON:0000033)',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['eye_diameter_over_SL', 'head_length_over_SL'],
    slack: p => p.head_length_over_SL - p.eye_diameter_over_SL,
  },
  {
    id: 'bp-snout-plus-eye-in-head',
    law_id: BLUEPRINT,
    statement: 'preorbital_over_SL + eye_diameter_over_SL <= head_length_over_SL',
    why: 'the snout region and the orbit are disjoint parts of the head, in that order from the tip',
    edge: 'snout and orbit both part_of head',
    interpretation: DISJOINT_SUBPARTS,
    note: 'the same arithmetic as adversarial.mjs\'s hand-found `eye-in-head`, now derived from a law rather than guessed. The derivation does not make it more true; the control does',
    traits: ['preorbital_over_SL', 'eye_diameter_over_SL', 'head_length_over_SL'],
    slack: p => p.head_length_over_SL - (p.preorbital_over_SL + p.eye_diameter_over_SL),
  },
  {
    id: 'bp-snout-in-head',
    law_id: BLUEPRINT,
    statement: 'preorbital_over_SL <= head_length_over_SL',
    why: 'the snout is part_of the head, so the pre-orbital distance lies inside the head',
    edge: 'snout (UBERON:0006333) part_of head',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['preorbital_over_SL', 'head_length_over_SL'],
    slack: p => p.head_length_over_SL - p.preorbital_over_SL,
  },
  {
    id: 'bp-head-in-body',
    law_id: BLUEPRINT,
    statement: 'head_length_over_SL <= 1',
    why: 'the head is part_of the body, and the body is one standard length long by definition of the trait',
    edge: 'head part_of body (the graph root)',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['head_length_over_SL'],
    slack: p => 1 - p.head_length_over_SL,
  },
  {
    id: 'bp-caudal-fin-in-body',
    law_id: BLUEPRINT,
    statement: 'caudal_fin_height_over_SL <= 1',
    why: 'the caudal fin is part_of the body, so its height cannot exceed the body\'s own length scale',
    edge: 'caudal fin (UBERON:4000164) part_of body',
    interpretation: LEVEL_AS_EXTENT,
    note: 'a fin height compared against a body LENGTH is already a weak reading - the fin is deep, not long. It clears the control, which says only that no real fish breaks it, not that it is the right comparison',
    traits: ['caudal_fin_height_over_SL'],
    slack: p => 1 - p.caudal_fin_height_over_SL,
  },
  {
    id: 'bp-dorsal-origin-on-body',
    law_id: BLUEPRINT,
    statement: 'predorsal_over_SL <= 1',
    why: 'the dorsal fin is part_of the body, so its origin lies on the body and not past the end of it',
    edge: 'dorsal fin (UBERON:0003097) part_of body',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['predorsal_over_SL'],
    slack: p => 1 - p.predorsal_over_SL,
  },

  // ---- the ones that sound like anatomy and are not ----
  {
    id: 'bp-body-depth-in-body',
    law_id: BLUEPRINT,
    statement: 'body_depth_over_SL <= 1',
    why: 'body depth is an extent of the body, so it should not exceed the body\'s length',
    edge: 'body depth as an extent of the graph root',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['body_depth_over_SL'],
    slack: p => 1 - p.body_depth_over_SL,
  },
  {
    id: 'bp-anal-origin-on-body',
    law_id: BLUEPRINT,
    statement: 'preanal_over_SL <= 1',
    why: 'the anal fin is part_of the body, so its origin lies on the body',
    edge: 'anal fin (UBERON:4000163) part_of body',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['preanal_over_SL'],
    slack: p => 1 - p.preanal_over_SL,
  },
  {
    id: 'bp-all-along-body-on-body',
    law_id: BLUEPRINT,
    statement: 'max(preanal, predorsal, prepectoral, prepelvic, preorbital) <= 1',
    why: 'every fin and the orbit are parts of the body, so every along-body distance lies within one SL',
    edge: 'the five along-body landmarks, all part_of body',
    interpretation: LEVEL_AS_EXTENT,
    note: 'adversarial.mjs measured this at 0.9998 and kept it as "near-strict". Measured again here it is 0.99979, and it is REJECTED rather than flagged, because a near-strict constraint cannot label an impossibility',
    traits: ['preanal_over_SL', 'predorsal_over_SL', 'prepectoral_over_SL', 'prepelvic_over_SL', 'preorbital_over_SL'],
    slack: p => Math.min(
      1 - p.preanal_over_SL, 1 - p.predorsal_over_SL, 1 - p.prepectoral_over_SL,
      1 - p.prepelvic_over_SL, 1 - p.preorbital_over_SL,
    ),
  },
  {
    id: 'bp-eye-in-body-depth',
    law_id: BLUEPRINT,
    statement: 'eye_diameter_over_SL <= body_depth_over_SL',
    why: 'the eye is part_of the head is part_of the body, so it should fit within the body\'s depth',
    edge: 'eye part_of head part_of body, through the transitive closure',
    interpretation: LEVEL_AS_EXTENT,
    traits: ['eye_diameter_over_SL', 'body_depth_over_SL'],
    slack: p => p.body_depth_over_SL - p.eye_diameter_over_SL,
  },
  {
    id: 'bp-caudal-fin-in-body-depth',
    law_id: BLUEPRINT,
    statement: 'caudal_fin_height_over_SL <= body_depth_over_SL',
    why: 'the caudal fin is part_of the body, so it should not be deeper than the body it attaches to',
    edge: 'caudal fin part_of body, compared on depth rather than length',
    interpretation: LEVEL_AS_EXTENT,
    note: 'the one worth looking at. A fin is a projection from the body, not a region inside it, and a projection is free to be larger than what it projects from. The level order cannot tell the difference, and the control does',
    traits: ['caudal_fin_height_over_SL', 'body_depth_over_SL'],
    slack: p => p.body_depth_over_SL - p.caudal_fin_height_over_SL,
  },
  {
    id: 'bp-head-anterior-to-anus',
    law_id: BLUEPRINT,
    statement: 'head_length_over_SL <= preanal_over_SL',
    why: 'the head ends before the anus begins, so the head length is within the pre-anal distance',
    edge: 'none - head and anal fin are siblings under the body',
    interpretation: SIBLING_ORDER,
    traits: ['head_length_over_SL', 'preanal_over_SL'],
    slack: p => p.preanal_over_SL - p.head_length_over_SL,
  },
  {
    id: 'bp-eye-smaller-than-caudal-fin',
    law_id: BLUEPRINT,
    statement: 'eye_diameter_over_SL <= caudal_fin_height_over_SL',
    why: 'the eye sits deeper in the part_of graph than the caudal fin, so it should be the smaller structure',
    edge: 'none - eye (level 2, under the head) and caudal fin (level 2, under the body) are not joined',
    interpretation: SIBLING_ORDER,
    note: 'this is the clearest case of reading the level NUMBER as a size. Two terms at comparable depth in the graph are compared on extent, which the theorem never licenses',
    traits: ['eye_diameter_over_SL', 'caudal_fin_height_over_SL'],
    slack: p => p.caudal_fin_height_over_SL - p.eye_diameter_over_SL,
  },
]);

/**
 * Other containments that clear the control but are omitted from CANDIDATES because they are vacuous on
 * real fish: prepectoral, prepelvic, preorbital and eye_diameter are each <= 1 SL on 4,673 of 4,673 with
 * a minimum slack above 0.1, so no search against them produces an interesting animal. Recorded so that
 * "six cleared" is not read as "six is all there are".
 */
export const OMITTED_AS_VACUOUS = Object.freeze([
  { statement: 'prepectoral_over_SL <= 1', holds_on_real: 1.0, min_slack: 0.43952 },
  { statement: 'prepelvic_over_SL <= 1', holds_on_real: 1.0, min_slack: 0.11163 },
  { statement: 'preorbital_over_SL <= 1', holds_on_real: 1.0, min_slack: 0.65844 },
  { statement: 'eye_diameter_over_SL <= 1', holds_on_real: 1.0, min_slack: 0.79952 },
]);

// ---------------------------------------------------------------- the control

let _cache = null;

/**
 * The real held-out positives, complete on all ten traits. Loaded once and reused, because the file is
 * 32 MB and the control is called for every candidate.
 *
 * Complete-on-the-needed-traits is applied over ALL TEN traits, not only the traits a constraint uses, so
 * that every constraint is measured on the same 4,673 specimens the scorer is measured on. Measuring a
 * two-trait constraint on a larger subset would make its rate incomparable to the rest.
 */
export function realPositives({ reload = false } = {}) {
  if (_cache && !reload) return _cache;
  const lines = fs.readFileSync(HELDOUT_PATH, 'utf8').split('\n');
  const out = [];
  for (const l of lines) {
    if (!l) continue;
    const it = JSON.parse(l);
    if (it.label !== 'positive') continue;
    const p = it.params || {};
    if (!TRAITS.every(t => typeof p[t] === 'number' && Number.isFinite(p[t]) && p[t] > 0)) continue;
    out.push({ params: p, taxon: it.taxon || {}, id: it.id });
  }
  _cache = Object.freeze(out);
  return _cache;
}

/**
 * Measure a candidate against every real specimen. Returns COUNTS, not a verdict.
 *
 * There is no `passed` field on purpose. The threshold is the caller's to apply, and the only threshold
 * this file accepts is `rate === 1`: a constraint that one real fish breaks cannot label an
 * impossibility, however close to 1 it gets.
 */
export function verifyAgainstReal(constraint, { sample = realPositives() } = {}) {
  let satisfied = 0, violated = 0, unscoreable = 0, minSlack = Infinity;
  const violators = [];
  for (const row of sample) {
    const s = constraint.slack(row.params);
    if (typeof s !== 'number' || !Number.isFinite(s)) { unscoreable++; continue; }
    if (s < minSlack) minSlack = s;
    if (s >= 0) satisfied++;
    else {
      violated++;
      if (violators.length < 8) violators.push({ species: row.taxon.species, family: row.taxon.family, slack: Number(s.toFixed(5)) });
    }
  }
  const measured = satisfied + violated;
  return {
    id: constraint.id,
    law_id: constraint.law_id,
    n_real: sample.length,
    n_measured: measured,
    n_satisfied: satisfied,
    n_violated: violated,
    n_unscoreable: unscoreable,
    rate: measured ? satisfied / measured : 0,
    min_slack: Number.isFinite(minSlack) ? minSlack : null,
    violators,
  };
}

/** Only the candidates no real fish breaks. `rate === 1` exactly; 0.99979 is not 1. */
export function cleared({ sample = realPositives(), candidates = CANDIDATES } = {}) {
  return candidates.filter(c => verifyAgainstReal(c, { sample }).rate === 1);
}

/**
 * The candidates the control threw out, with the rate that threw them out. Frozen from the run of
 * 2026-11-06; `verifyAgainstReal` reproduces every row, and test-laws.mjs checks that it does.
 */
export const REJECTED = Object.freeze([
  { id: 'bp-caudal-fin-in-body-depth', statement: 'caudal_fin_height_over_SL <= body_depth_over_SL', holds_on_real: 0.7019, n_violated: 1393, note: '30 % of real fish have a caudal fin deeper than the body. A fin is a projection, not a contained region' },
  { id: 'bp-head-anterior-to-anus', statement: 'head_length_over_SL <= preanal_over_SL', holds_on_real: 0.9987, n_violated: 6, note: 'flatfishes and surgeonfishes: Citharus linguatula, Hypoclinemus mentalis, Trinectes xanthurus, Paralichthodes algoensis, Epinephelus merra, Zebrasoma scopas' },
  { id: 'bp-eye-smaller-than-caudal-fin', statement: 'eye_diameter_over_SL <= caudal_fin_height_over_SL', holds_on_real: 0.9953, n_violated: 22, note: 'big-eyed fish with small tails; the level number is not a size' },
  { id: 'bp-body-depth-in-body', statement: 'body_depth_over_SL <= 1', holds_on_real: 0.9996, n_violated: 2, note: 'Antigonia capros (depth 1.217 SL) and Drepane punctata (1.051 SL) are deeper than they are long' },
  { id: 'bp-eye-in-body-depth', statement: 'eye_diameter_over_SL <= body_depth_over_SL', holds_on_real: 0.9996, n_violated: 2, note: 'Amblyeleotris downingi and Solenostomus paradoxus - a ghost pipefish is thinner than its own eye' },
  { id: 'bp-anal-origin-on-body', statement: 'preanal_over_SL <= 1', holds_on_real: 0.9998, n_violated: 1, note: 'Dermogenys brachynotopterus, preanal 1.00465 SL. It may well be a measurement artefact, and that changes nothing: overruling a control because the violator looks wrong is the exact move the control exists to prevent' },
  { id: 'bp-all-along-body-on-body', statement: 'max of the five along-body distances <= 1', holds_on_real: 0.9998, n_violated: 1, note: 'the same specimen, and the same refusal. adversarial.mjs flagged this one as near-strict rather than rejecting it' },
]);

// ---------------------------------------------------------------- the search

/**
 * For each cleared law-derived constraint: the most typical animal that breaks it, and how many real fish
 * the scorer likes less than that animal.
 *
 * `margin` is in standard lengths. A violation of 0.02 means the forbidden overhang is 2 % of body length.
 */
export function report({ margins = [0.01, 0.02], block = 'fishbase', sample = realPositives() } = {}) {
  const { block: b } = loadModel(block);
  const P = pooled(b);
  const S = makeScorer(P);
  const realQ = sample.map(r => S.q(r.params)).filter(Number.isFinite).sort((a, c) => a - c);
  const rows = [];
  for (const c of cleared({ sample })) {
    const v = verifyAgainstReal(c, { sample });
    for (const margin of margins) {
      const r = mostTypicalViolator(P, c, { margin });
      const worse = realQ.filter(x => x > r.q).length;
      rows.push({
        id: c.id,
        law_id: c.law_id,
        statement: c.statement,
        holds_on_real: v.rate,
        min_slack_on_real: Number(v.min_slack.toFixed(5)),
        margin,
        reached_margin: r.reached_margin,
        min_q: Number(r.q.toFixed(4)),
        called_typical_by_the_scorer: r.q < 1,
        real_fish_less_typical_than_it: worse,
        real_fish_less_typical_share: Number((worse / realQ.length).toFixed(4)),
        params: Object.fromEntries(Object.entries(r.params).map(([k, x]) => [k, Number(x.toFixed(5))])),
      });
    }
  }
  return { n_real: realQ.length, traits: P.traits, rows };
}

export const WHAT_THE_SURVEY_MEANS = Object.freeze({
  the_expressibility_result:
    'ONE of the 48 theorem-carrying laws can be written as a constraint on these ten traits. The other 47 ' +
    'bind mass, power, oxygen, area, stress, temperature, depth, codons, allele frequencies, rate ' +
    'constants, or a ratio between two sizes. This is a statement about the BLOCK, not about the registry: ' +
    'ten length-over-length ratios of one specimen are nearly orthogonal to the quantities the laws are ' +
    'about, and the normalisation that makes them comparable is the same normalisation that removes the ' +
    'size every allometry is written in.',
  the_near_miss_to_state_out_loud:
    'E5 and disc-flying-fish-fin-ratio-gap bound pectoral FIN LENGTH over SL. The block carries ' +
    'prepectoral_over_SL, the snout-to-fin-BASE distance. Those names are two words apart and the ' +
    'measurements are unrelated. Had they been treated as the same quantity, a bound measured on 49 ' +
    'museum specimens would have been applied to a different number entirely.',
  the_control_result:
    'thirteen containments derived from the one expressible law; SEVEN are false of real fish. ' +
    'caudal_fin_height <= body_depth - "the tail is no deeper than the body" - fails on 1,393 of 4,673. ' +
    'Deriving a constraint from a proved theorem does not make it true of animals, because the derivation ' +
    'goes through an interpretation, and the interpretation is where it breaks.',
  the_sharpest_adversarial_result:
    'predorsal_over_SL <= 1 - the dorsal fin lies on the body - is broken at q = 0.347 by an animal whose ' +
    'dorsal fin begins 1.02 standard lengths from the snout, which is past the end of the fish. The scorer ' +
    'ranks it more typical than 4,068 of 4,673 real fish. The eye-in-head violator at q = 0.918 was the ' +
    'worst case adversarial.mjs could find; a law-derived constraint finds one far worse.',
  what_is_not_checked:
    'that any arithmetic here follows from any Lean theorem. The traits are not the theorem\'s variables, ' +
    'no proof term connects them, and no tool in this project checks a prose reading against a proof. ' +
    'Every constraint carries the reading it made in its `interpretation` field for exactly that reason. A ' +
    'sound proof of a statement translated wrongly is worth nothing, and seven of thirteen translations ' +
    'here were wrong.',
  what_would_change_it:
    'constraints on the ten ratios will not come from this registry. They would come either from a law ' +
    'layer written about morphometric ratios - which is a different body of work - or from the fishshapes ' +
    'block, or from giving the benchmark a mass and an area so that the scaling and power laws have ' +
    'something to bind. Until then the law layer and this benchmark overlap in one theorem.',
});
