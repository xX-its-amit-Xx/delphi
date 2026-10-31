#!/usr/bin/env node
// Writes lean/constraints.json: every formalised theorem that can act as a filter on a candidate, joined
// with what the compiler reported for it (lean.json: axioms, proof scope, faithfulness verdicts), so that
// theorem names, axioms and verdicts are never retyped by hand. The hand-written part is the semantics:
// which property of a candidate each theorem constrains, the relation with every symbol named, the inputs
// a candidate must commit to, and whether the theorem can eliminate at all.
//   node lean/eliminate/build-constraints.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const R = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/public/t/lean/lean.json'), 'utf8'));
const audit = name => R.audit.theorems.find(t => t.theorem === name) || null;
const claim = id => R.formalized.find(f => f.claim_id === id) || null;

// Quantities a candidate may commit to. A quantity is a number, a string holding an exact decimal or
// fraction, or {low, high} for an interval; a point value is the interval [v, v].
export const QUANTITIES = {
  mutation_rate: { unit: 'mutations per site per generation', kind: 'interval' },
  neutral_substitution_rate: { unit: 'substitutions per site per generation, neutral sites', kind: 'interval' },
  gene_copies_M: { unit: 'gene copies in the population (2N for diploids)', kind: 'natural' },
  fixation_probability: { unit: 'probability that one new mutant copy is eventually fixed', kind: 'interval' },
  selection_coefficient_nonnegative: { unit: 'commitment that selection does not oppose the mutant (s >= 0)', kind: 'flag' },
  generations_T: { unit: 'generations', kind: 'natural' },
  sites_G: { unit: 'sites', kind: 'number' },
  expected_substitutions_total: { unit: 'expected substitutions over sites_G sites and generations_T generations', kind: 'interval' },
  mean_fitness: { unit: 'mean fitness before selection (> 0)', kind: 'interval' },
  variance_fitness: { unit: 'variance in fitness before selection', kind: 'interval' },
  mean_fitness_change: { unit: 'change in mean fitness over one round of selection', kind: 'interval' },
  asexual_fraction_initial: { unit: 'fraction of females that are asexual, now (0 < q < 1)', kind: 'point' },
  generations_n: { unit: 'generations', kind: 'natural' },
  asexual_fraction_after: { unit: 'fraction of females that are asexual after generations_n', kind: 'point' },
  length_ratio: { unit: 'L2 / L1, the same linear dimension of the same body family', kind: 'interval' },
  weight_ratio: { unit: 'W(L2) / W(L1)', kind: 'interval' },
  loglog_exponent: { unit: 'd log W / d log L between the two sizes', kind: 'interval' },
  blueprint_file: { unit: 'path to an emitted blueprint JSON (organism-design/examples/*.json)', kind: 'path' },
  mutation_rate_ratio: { unit: 'ratio of the mutation rates of two neutral lineages (lineage 2 over lineage 1)', kind: 'point' },
  neutral_substitution_rate_ratio: { unit: 'ratio of the neutral substitution rates of the same two lineages', kind: 'point' },
  mean_fitness_change_sign: { unit: 'sign of the change in mean fitness over one round of selection: positive, zero or negative', kind: 'sign' },
  asexual_odds_growth_factor: { unit: 'factor by which the odds of asexual females grow per generation', kind: 'point' }
};
// Assumption flags: a candidate must accept the model before a theorem about the model can rule on it.
export const ASSUMPTIONS = {
  neutral_wright_fisher: 'strictly neutral mutations, constant population size, Wright-Fisher reproduction, independent mutant fates (lean/Delphi/Kimura.lean header)',
  wright_fisher_selection: 'Wright-Fisher sampling with relative fitness 1+s for the mutant, s constant (lean/Delphi/Favored.lean header)',
  independent_fates_definition: 'the expected count is Kimura\'s definition rate x generations: independent fates, constant M, mu and s, no linkage (lean/Delphi/Favored.lean header)',
  fixed_fitnesses_one_locus: 'one haploid or clonal locus, fixed fitnesses within the step, infinite population, no mutation (lean/Delphi/Fisher.lean header)',
  equal_fecundity_1to1: 'equal fecundity of sexual and asexual females, a 1:1 sex ratio, males contributing nothing, discrete generations (lean/Delphi/MaynardSmith.lean header)',
  isometric_constant_density: 'the same body family scaled without change of shape or density, so W = k L^3 (lean/Delphi/Thompson.lean header)'
};

const spec = [
  { id: 'C1', claim_id: 'kimura-substitution-rate', lemma: 'Delphi.Constraints.kimura_rate_rules_out', law: 'Delphi.neutral_substitution_rate', module: 'lean/Delphi/Kimura.lean',
    property: 'the long-run rate at which neutral mutations become substitutions, relative to the mutation rate',
    relation: 'k = mu', symbols: { k: 'neutral_substitution_rate', mu: 'mutation_rate' },
    requires: ['mutation_rate', 'neutral_substitution_rate'], appliesWhen: ['neutral_wright_fisher'],
    rule: 'eliminated when the committed intervals for k and mu are disjoint; consistent when they overlap',
    canEliminate: 'only a candidate that commits to a neutral substitution rate different from its mutation rate (for example a neutral clock that scales with population size)', kernelCheckable: true },
  { id: 'C1b', claim_id: 'kimura-substitution-rate', lemma: 'Delphi.Constraints.kimura_rate_ratio_rules_out', law: 'Delphi.neutral_substitution_rate', module: 'lean/Delphi/Kimura.lean',
    property: 'whether neutral substitution rates can differ between lineages that share a mutation rate (for example through population size)',
    relation: 'mu_1 = mu_2  =>  k_2 / k_1 = 1', symbols: { 'mu_2 / mu_1': 'mutation_rate_ratio', 'k_2 / k_1': 'neutral_substitution_rate_ratio' },
    requires: ['mutation_rate_ratio', 'neutral_substitution_rate_ratio'], appliesWhen: ['neutral_wright_fisher'],
    rule: 'applies only when the committed mutation-rate ratio is exactly 1; then eliminated when the committed substitution-rate ratio is not 1',
    canEliminate: 'a candidate that attributes a difference in neutral substitution rate between lineages to anything other than a difference in mutation rate (population size, for instance)', kernelCheckable: true },
  { id: 'C2', claim_id: 'kimura-fixation-probability', lemma: 'Delphi.Constraints.neutral_fixation_rules_out', law: 'Delphi.wrightFisher_fixation_one', module: 'lean/Delphi/Kimura.lean',
    property: 'the probability that a single new neutral mutant copy is eventually fixed',
    relation: 'u = 1 / M', symbols: { u: 'fixation_probability', M: 'gene_copies_M' },
    requires: ['gene_copies_M', 'fixation_probability'], appliesWhen: ['neutral_wright_fisher'],
    rule: 'eliminated when 1/M lies outside the committed interval for u',
    canEliminate: 'only a candidate that commits to a specific contradicting probability; it says nothing about which mutations arise or what they do', kernelCheckable: true },
  { id: 'C3', claim_id: 'favored-fixation-lower-bound', lemma: 'Delphi.Constraints.favored_fixation_rules_out', law: 'Delphi.wrightFisherSelection_fixation_one_ge', module: 'lean/Delphi/Favored.lean',
    property: 'the fixation probability of a single new mutant that selection does not oppose',
    relation: 'u >= 1 / M', symbols: { u: 'fixation_probability', M: 'gene_copies_M' },
    requires: ['gene_copies_M', 'fixation_probability', 'selection_coefficient_nonnegative'], appliesWhen: ['wright_fisher_selection'],
    rule: 'eliminated when the committed upper end of u is below 1/M',
    canEliminate: 'a candidate that says a neutral or favored mutant fixes less often than drift alone allows; it cannot eliminate on the high side (no upper bound in s is proved)', kernelCheckable: true },
  { id: 'C3b', claim_id: 'favored-fixation-lower-bound', lemma: 'Delphi.Constraints.supply_rules_out', law: 'Delphi.expectedSubstitutions_le', module: 'lean/Delphi/Favored.lean',
    property: 'the expected number of substitutions a lineage can accumulate over a given time',
    relation: 'E[substitutions] <= G * M * mu * T', symbols: { 'E[substitutions]': 'expected_substitutions_total', G: 'sites_G', M: 'gene_copies_M', mu: 'mutation_rate', T: 'generations_T' },
    requires: ['expected_substitutions_total', 'sites_G', 'gene_copies_M', 'mutation_rate', 'generations_T'], appliesWhen: ['independent_fates_definition'],
    rule: 'eliminated when the committed lower end of E exceeds G * M * (upper end of mu) * T',
    canEliminate: 'a candidate that commits to an expected count above the mutation supply; a realised count, or a count without M, mu and T, cannot be ruled on', kernelCheckable: true },
  { id: 'C4', claim_id: 'fisher-ftns', lemma: 'Delphi.Constraints.fisher_rules_out', law: "Delphi.fisher_fundamental_theorem'", module: 'lean/Delphi/Fisher.lean',
    property: 'the change in mean fitness over one round of selection, given the variance in fitness',
    relation: 'delta_wbar * wbar = V', symbols: { delta_wbar: 'mean_fitness_change', wbar: 'mean_fitness', V: 'variance_fitness' },
    requires: ['mean_fitness_change', 'mean_fitness', 'variance_fitness'], appliesWhen: ['fixed_fitnesses_one_locus'],
    rule: 'point commitments only: eliminated when delta_wbar * wbar != V exactly; interval commitments fall to C4b',
    canEliminate: 'a candidate that commits to all three quantities as exact values violating the identity', kernelCheckable: true },
  { id: 'C4b', claim_id: 'fisher-ftns', lemma: 'Delphi.Constraints.fisher_decline_rules_out', law: 'Delphi.mean_fitness_nondecreasing', module: 'lean/Delphi/Fisher.lean',
    property: 'the sign of the change in mean fitness under fixed fitnesses',
    relation: 'delta_wbar >= 0', symbols: { delta_wbar: 'mean_fitness_change' },
    requires: ['mean_fitness_change'], appliesWhen: ['fixed_fitnesses_one_locus'],
    rule: 'eliminated when the committed upper end of delta_wbar is below 0',
    canEliminate: 'a candidate that says mean fitness falls under constant selection at one locus without mutation, drift, frequency dependence or environmental change', kernelCheckable: true },
  { id: 'C4c', claim_id: 'fisher-ftns', lemma: 'Delphi.Constraints.fisher_zero_variance_rules_out', law: 'Delphi.fisher_fundamental_theorem', module: 'lean/Delphi/Fisher.lean',
    property: 'whether mean fitness can change under selection when the variance in fitness is zero',
    relation: 'V = 0  =>  delta_wbar = 0', symbols: { V: 'variance_fitness', delta_wbar: 'mean_fitness_change_sign' },
    requires: ['variance_fitness', 'mean_fitness_change_sign'], appliesWhen: ['fixed_fitnesses_one_locus'],
    rule: 'applies only when the committed variance is exactly 0; then eliminated when the committed sign of the change is positive or negative',
    canEliminate: 'a candidate that says selection changes mean fitness while committing to zero variance in fitness', kernelCheckable: true },
  { id: 'C5', claim_id: 'maynardsmith-twofold-cost', lemma: 'Delphi.Constraints.twofold_rules_out', law: 'Delphi.twofold_cost_of_sex_n', module: 'lean/Delphi/MaynardSmith.lean',
    property: 'how fast an asexual lineage spreads among sexual females',
    relation: 'odds(q_n) = 2^n * odds(q_0), odds(q) = q / (1 - q)', symbols: { q_0: 'asexual_fraction_initial', q_n: 'asexual_fraction_after', n: 'generations_n' },
    requires: ['asexual_fraction_initial', 'generations_n', 'asexual_fraction_after'], appliesWhen: ['equal_fecundity_1to1'],
    rule: 'point commitments: eliminated when odds(q_n) != 2^n * odds(q_0) exactly on rationals',
    canEliminate: 'a candidate that commits to a spread faster or slower than the twofold doubling under the stated assumptions', kernelCheckable: true },
  { id: 'C5b', claim_id: 'maynardsmith-twofold-cost', lemma: 'Delphi.Constraints.twofold_factor_rules_out', law: 'Delphi.twofold_cost_of_sex', module: 'lean/Delphi/MaynardSmith.lean',
    property: 'the per-generation growth factor of the odds of asexual females',
    relation: 'odds(q_next) = 2 * odds(q)', symbols: { 'odds(q_next) / odds(q)': 'asexual_odds_growth_factor' },
    requires: ['asexual_odds_growth_factor'], appliesWhen: ['equal_fecundity_1to1'],
    rule: 'eliminated when the committed factor is not exactly 2',
    canEliminate: 'a candidate that commits to a per-generation odds factor other than 2 under the stated assumptions; a factor of 2 is the theorem and is consistent', kernelCheckable: true },
  { id: 'C6', claim_id: 'blueprint-well-formedness', lemma: 'Delphi.Blueprint.wellFormed_of_check', law: 'Delphi.Blueprint.wellFormed_of_check', module: 'lean/Delphi/Blueprint.lean',
    property: 'the internal coherence of a proposed anatomical design: acyclic part_of, every term reaching the body root, no term excluded by taxon constraints',
    relation: 'check g D = true', symbols: { g: 'the design as a graph (blueprint_file)', D: 'taxon statements pinned from Ubergraph for it' },
    requires: ['blueprint_file'], appliesWhen: [],
    rule: 'consistent when the generated certificate compiles (kernel-evaluated checker); eliminated when the checker rejects the design, naming the failing condition (plain computation: the completeness direction check = false -> not well-formed is not proved)',
    canEliminate: 'a design whose part_of graph has a cycle or an orphan, or that keeps a term the pinned taxon statements exclude; it says nothing biological', kernelCheckable: 'on pass (certificate); on rejection the failing condition is reported by plain computation' },
  { id: 'C7', claim_id: 'thompson1917-ch03-07', lemma: "Delphi.Constraints.cubeLaw_rules_out'", law: 'Delphi.cubeLaw_ratio', module: 'lean/Delphi/Thompson.lean',
    property: 'how weight scales with a linear dimension under isometric scaling at constant density',
    relation: 'W2 / W1 = (L2 / L1)^3', symbols: { 'W2 / W1': 'weight_ratio', 'L2 / L1': 'length_ratio' },
    requires: ['length_ratio', 'weight_ratio'], appliesWhen: ['isometric_constant_density'],
    rule: 'eliminated when the committed weight-ratio interval is disjoint from the cube of the length-ratio interval',
    canEliminate: 'the mass side of Galileo\'s square-cube argument only: a giant with unchanged proportions and density must weigh (L2/L1)^3 times more. Strength scaling as L^2 is NOT formalised, so a candidate claiming the giant can support itself is not ruled out by this theorem', kernelCheckable: true },
  { id: 'C7b', claim_id: 'thompson1917-ch03-07', lemma: 'Delphi.Constraints.exponent_rules_out', law: 'Delphi.cubeLaw_loglog_exponent', module: 'lean/Delphi/Thompson.lean',
    property: 'the log-log exponent of weight on a linear dimension under isometric scaling',
    relation: 'b = 3', symbols: { b: 'loglog_exponent' },
    requires: ['loglog_exponent'], appliesWhen: ['isometric_constant_density'],
    rule: 'eliminated when the committed exponent interval excludes 3',
    canEliminate: 'a candidate that asserts isometry and a measured exponent whose interval excludes 3 (for example every NHANES window in the claims thread\'s test, if read as isometric)', kernelCheckable: true }
];

const out = {
  built: new Date().toISOString(), tool: 'lean/eliminate/build-constraints.mjs', leanReport: R.built, lemmaModule: 'lean/Delphi/Constraints.lean',
  framing: 'A theorem eliminates candidates, not open problems: a candidate is a proposed answer or design that commits to quantities the theorem forbids. Three states: eliminated (the violated relation with the numbers, kernel-checked where marked), consistent (not ruled out by these theorems; never "feasible"), cannot-rule (a required input or assumption is missing). An elimination holds only under the law\'s own assumptions, listed per constraint; three of the four original statements were judged narrower in scope than their claims by the assessor, and a candidate eliminated by a narrower statement is eliminated only under that statement\'s assumptions.',
  nextConstraint: 'Strength scaling as L^2 (cross-section), which with the cube law would turn Galileo\'s square-cube argument into an elimination; not formalised.',
  quantities: QUANTITIES, assumptions: ASSUMPTIONS,
  constraints: spec.map(c => {
    const f = claim(c.claim_id) || {};
    return { ...c, label: f.label || null, lawAxioms: audit(c.law)?.axioms ?? null, lemmaAxioms: audit(c.lemma)?.axioms ?? null, status: f.status || null,
      proofScope: f.proofScope || null, faithfulness: f.faithfulness || 'not assessed (no paper states this form)', verdicts: f.verdicts || [],
      assumptionsText: c.appliesWhen.map(a => ASSUMPTIONS[a]) };
  })
};
fs.writeFileSync(path.join(root, 'lean/constraints.json'), JSON.stringify(out, null, 1));
console.log(`lean/constraints.json: ${out.constraints.length} constraints; lemma audit ${out.constraints.map(c => `${c.id}:${c.lemmaAxioms ? 'ok' : 'MISSING'}`).join(' ')}`);
