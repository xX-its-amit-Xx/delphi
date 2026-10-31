#!/usr/bin/env node
// Mutation evidence: a proof nobody tried to break is not evidence. Each entry below changes the
// STATEMENT of a headline theorem (or removes a hypothesis of the model) in a copy of the module,
// then asks the Lean compiler to check the copy. The proofs must be rejected (non-zero exit with an
// error). A control run of the unmodified module must pass through the very same command. Results
// go to lean/mutations.json and are folded into lean.json by report.mjs. Nothing under lean/Delphi
// is modified.
//   node lean/mutate.mjs            # MUTANT_JOBS=n caps the concurrency, MUTANT_DIR sets the scratch root
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [process.env.ELAN_HOME, path.join(process.env.USERPROFILE || process.env.HOME || '', '.elan'), 'C:/Temp/elan'].filter(Boolean);
let bin = '';
for (const c of candidates) { const d = path.join(c, 'bin'); if (fs.existsSync(path.join(d, process.platform === 'win32' ? 'lake.exe' : 'lake'))) { bin = d; break; } }
const env = { ...process.env, PATH: (bin ? bin + path.delimiter : '') + process.env.PATH };
if (bin && !process.env.ELAN_HOME) env.ELAN_HOME = path.dirname(bin);

const NHDS = '\u{1D4DD}'; // the 𝓝 (neighbourhood filter) symbol used in the Kimura statement

const mutations = [
  { id: 'kimura-rate-doubled', file: 'Delphi/Kimura.lean', theorem: 'Delphi.neutral_substitution_rate', claim_id: 'kimura-substitution-rate',
    description: 'Statement changed to claim the substitution rate is 2 mu instead of mu.',
    find: '(wrightFisher M hM).fixationProbability (oneCopy M hM)) = μ := by', replace: '(wrightFisher M hM).fixationProbability (oneCopy M hM)) = 2 * μ := by' },
  { id: 'kimura-fixation-one-wrong', file: 'Delphi/Kimura.lean', theorem: 'Delphi.wrightFisher_fixation_one', claim_id: 'kimura-substitution-rate',
    description: 'Statement changed to claim a single copy fixes with probability 1/(M+1) instead of 1/M.',
    find: '(wrightFisher M hM).fixationProbability (oneCopy M hM) = 1 / M := by', replace: '(wrightFisher M hM).fixationProbability (oneCopy M hM) = 1 / (M + 1) := by' },
  { id: 'kimura-limit-wrong', file: 'Delphi/Kimura.lean', theorem: 'Delphi.NeutralChain.fixedBy_tendsto', claim_id: 'kimura-fixation-probability',
    description: 'Statement changed so the fixation probability of i copies tends to i/(M+1) instead of i/M.',
    find: `Tendsto (fun t => C.fixedBy t i) atTop (${NHDS} (((i : ℕ) : ℝ) / M)) := by`, replace: `Tendsto (fun t => C.fixedBy t i) atTop (${NHDS} (((i : ℕ) : ℝ) / (M + 1))) := by` },
  { id: 'kimura-escape-dropped', file: 'Delphi/Kimura.lean', theorem: 'Delphi.NeutralChain.fixedBy_tendsto', claim_id: 'kimura-fixation-probability',
    description: 'Model hypothesis removed: the chain no longer has to be able to leave interior states (escape := True). Fixation then need not happen, so the limit theorem must fail.',
    find: 'escape : ∀ i : Fin (M + 1), i ≠ 0 → i ≠ Fin.last M → 0 < P i 0 + P i (Fin.last M)', replace: 'escape : True',
    also: [['escape := wf_escape hM', 'escape := trivial']] },
  { id: 'fisher-no-division', file: 'Delphi/Fisher.lean', theorem: 'Delphi.fisher_fundamental_theorem', claim_id: 'fisher-ftns',
    description: 'Statement changed to claim the change in mean fitness equals the variance itself, not the variance divided by mean fitness.',
    find: 'meanFitness (select p w) w - meanFitness p w = variance p w / meanFitness p w := by', replace: 'meanFitness (select p w) w - meanFitness p w = variance p w := by' },
  { id: 'maynardsmith-threefold', file: 'Delphi/MaynardSmith.lean', theorem: 'Delphi.twofold_cost_of_sex', claim_id: 'maynardsmith-twofold-cost',
    description: 'Statement changed to claim the odds triple each generation instead of doubling.',
    find: 'odds (asexualNext q f) = 2 * odds q := by', replace: 'odds (asexualNext q f) = 3 * odds q := by' },
  { id: 'favored-floor-strengthened', file: 'Delphi/Favored.lean', theorem: 'Delphi.FavoredChain.fixationProbability_ge', claim_id: 'favored-fixation-lower-bound',
    description: 'Statement changed to claim a favored lineage of i copies fixes with probability at least (i+1)/M instead of i/M. Not true (the neutral chain is favored and fixes with exactly i/M), so the proof must fail.',
    find: '    ((i : ℕ) : ℝ) / M ≤ C.fixationProbability i := by', replace: '    (((i : ℕ) : ℝ) + 1) / M ≤ C.fixationProbability i := by' },
  { id: 'favored-budget-doubled', file: 'Delphi/Favored.lean', theorem: 'Delphi.favored_expectedSubstitutions_ge', claim_id: 'favored-fixation-lower-bound',
    description: 'Statement changed to claim the expected substitutions over T generations are at least 2 mu T instead of mu T.',
    find: '    μ * T ≤ expectedSubstitutions M μ (C.fixationProbability (oneCopy M hM)) T := by', replace: '    2 * μ * T ≤ expectedSubstitutions M μ (C.fixationProbability (oneCopy M hM)) T := by' },
  { id: 'favored-drift-dropped', file: 'Delphi/Favored.lean', theorem: 'Delphi.FavoredChain.fixationProbability_ge', claim_id: 'favored-fixation-lower-bound',
    description: 'Model hypothesis removed: the chain no longer has to keep the expected copy number from falling (favored := True). Selection against the mutant is then allowed, so the lower bound i/M must fail.',
    find: '  favored : ∀ i : Fin (M + 1), ((i : ℕ) : ℝ) ≤ ∑ j, P i j * ((j : ℕ) : ℝ)', replace: '  favored : True',
    also: [['  { C with favored := fun i => (C.neutral i).ge }', '  { C with favored := trivial }'], ['  favored i := by rw [binomial_mean]; exact hfav i', '  favored := trivial']] },
  { id: 'blueprint-closure-level-flipped', file: 'Delphi/Blueprint.lean', theorem: 'Delphi.Blueprint.Graph.transGen_level_lt', claim_id: 'blueprint-well-formedness',
    description: 'Statement changed to claim the level INCREASES along the part_of closure (level a < level b) instead of decreasing; acyclicity rests on this lemma, so the proof must fail.',
    find: '    g.level b < g.level a := by\n  induction h with', replace: '    g.level a < g.level b := by\n  induction h with' },
  { id: 'blueprint-certificate-cycle', file: 'Delphi/Certificates/AFlyingFish.lean', theorem: 'Delphi.Blueprint.Certificates.aFlyingFish_check', claim_id: 'blueprint-well-formedness',
    description: 'Data sabotaged: an edge making the body root part of node 1 is added to the certified edge list (an upward edge, closing a cycle through the root). The kernel-evaluated checker must reject it.',
    find: 'Edges : List (ℕ × ℕ) := [', replace: 'Edges : List (ℕ × ℕ) := [(0, 1), ' },
  { id: 'blueprint-certificate-excluded-taxon', file: 'Delphi/Certificates/AFlyingFish.lean', theorem: 'Delphi.Blueprint.Certificates.aFlyingFish_check', claim_id: 'blueprint-well-formedness',
    description: 'Data sabotaged: a never_in_taxon row saying node 1 is never in Vertebrata (NCBITaxon 7742, an ancestor of Exocoetidae) is added. The checker must reject it.',
    find: '    neverIn := [', replace: '    neverIn := [(1, 7742), ' },
  { id: 'thompson-exponent-two', file: 'Delphi/Thompson.lean', theorem: 'Delphi.cubeLaw_loglog_exponent', claim_id: 'thompson1917-ch03-07',
    description: 'Statement changed to claim the log-log exponent of a cube law is 2 instead of 3.',
    find: '(h₂ : 0 < L₂) (hne : L₁ ≠ L₂) : logSlope W L₁ L₂ = 3 := by', replace: '(h₂ : 0 < L₂) (hne : L₁ ≠ L₂) : logSlope W L₁ L₂ = 2 := by' },
  { id: 'elimination-certificate-false-claim', file: 'Delphi/Certificates/Eliminations.lean', theorem: 'Delphi.Constraints.Eliminations.elim_giant_insect_mass_C7', claim_id: 'thompson1917-ch03-07',
    description: 'Certificate sabotaged: the giant-insect elimination is rewritten to claim that a weight ratio of exactly 10^6 at length ratio 100 is ruled out. It is not (10^6 = 100^3), so norm_num must fail and the kernel must reject the certificate.',
    find: '((100 : ℝ) ≤ W L₂ / W L₁ ∧ W L₂ / W L₁ ≤ (100 : ℝ))', replace: '((1000000 : ℝ) ≤ W L₂ / W L₁ ∧ W L₂ / W L₁ ≤ (1000000 : ℝ))' },
  { id: 'constraints-fisher-sign-flipped', file: 'Delphi/Constraints.lean', theorem: 'Delphi.Constraints.fisher_decline_rules_out', claim_id: 'fisher-ftns',
    description: 'Lemma statement changed to rule out a RISE in mean fitness (0 < b) instead of a fall; the law says mean fitness never decreases, so this must fail.',
    find: '    (hΔ : meanFitness (select p w) w - meanFitness p w ≤ b) (h : b < 0) : False := by', replace: '    (hΔ : meanFitness (select p w) w - meanFitness p w ≤ b) (h : 0 < b) : False := by' },
  { id: 'constraints-twofold-factor-three', file: 'Delphi/Constraints.lean', theorem: 'Delphi.Constraints.twofold_factor_rules_out', claim_id: 'maynardsmith-twofold-cost',
    description: 'Lemma statement changed to rule out any odds factor other than 3 instead of 2; the law gives exactly 2, so this must fail.',
    find: '(hr : odds (asexualNext q f) = r * odds q) (h : r ≠ 2) : False := by', replace: '(hr : odds (asexualNext q f) = r * odds q) (h : r ≠ 3) : False := by' },
  { id: 'open-problems-certificate-ratio-one', file: 'Delphi/Certificates/EliminationsOpenProblems.lean', theorem: 'Delphi.Constraints.Eliminations.elim_ORX_20_C2_C1b', claim_id: 'kimura-substitution-rate',
    description: 'Certificate sabotaged: the ORX-20/C2 elimination is rewritten to claim that a substitution-rate ratio of exactly 1 at equal mutation rates is ruled out. It is not (that is the theorem), so norm_num must fail and the kernel must reject it.',
    find: '(100 : ℝ) * Delphi.substitutionRate M₁', replace: '(1 : ℝ) * Delphi.substitutionRate M₁' },
  { id: 'scaling-area-exponent-three', file: 'Delphi/Scaling.lean', theorem: 'Delphi.areaLaw_ratio', claim_id: 'scaling-area-law', description: 'R2 mutant: area ratio claimed to be (L2/L1)^3.', find: '    S L₂ / S L₁ = (L₂ / L₁) ^ 2 := by', replace: '    S L₂ / S L₁ = (L₂ / L₁) ^ 3 := by' },
  { id: 'scaling-wingloading-exponent-two', file: 'Delphi/Scaling.lean', theorem: 'Delphi.wingLoading_ratio', claim_id: 'scaling-area-law', description: 'R3 mutant: wing loading claimed to scale as (L2/L1)^2.', find: '(h₁ : 0 < L₁) (h₂ : 0 < L₂) : (W L₂ / S L₂) / (W L₁ / S L₁) = L₂ / L₁ := by', replace: '(h₁ : 0 < L₁) (h₂ : 0 < L₂) : (W L₂ / S L₂) / (W L₁ / S L₁) = (L₂ / L₁) ^ 2 := by' },
  { id: 'scaling-strength-exponent-three', file: 'Delphi/Scaling.lean', theorem: 'Delphi.breakLoad_ratio', claim_id: 'scaling-strength-law', description: 'R7 mutant: breaking load claimed to scale as (L2/L1)^3 (then the safety factor would be constant and no L_max would exist).', find: '    (h₂ : 0 < L₂) : breakLoad σ A L₂ / breakLoad σ A L₁ = (L₂ / L₁) ^ 2 := by', replace: '    (h₂ : 0 < L₂) : breakLoad σ A L₂ / breakLoad σ A L₁ = (L₂ / L₁) ^ 3 := by' },
  { id: 'scaling-safety-factor-constant', file: 'Delphi/Scaling.lean', theorem: 'Delphi.safetyFactor_eq', claim_id: 'scaling-strength-law', description: 'R7 mutant: safety factor claimed independent of L (σ k3 / k1), i.e. the 1/L fall removed.', find: '    (hL : 0 < L) : breakLoad σ A L / W L = σ * k₃ / (k₁ * L) := by', replace: '    (hL : 0 < L) : breakLoad σ A L / W L = σ * k₃ / k₁ := by' },
  { id: 'scaling-vmin-hypothesis-dropped', file: 'Delphi/Scaling.lean', theorem: 'Delphi.vmin_le', claim_id: 'thompson1917-ch02-06', description: 'R4 mutant: the hypothesis C_L ≤ C_L,max dropped (replaced by True); then nothing bounds v below and the proof must fail.', find: '(hC : 0 < C) (hCmax : C ≤ Cmax) (hv : 0 ≤ v)\n    (hlift : lift ρ v S C = W) : vmin ρ Cmax W S ≤ v := by', replace: '(hC : 0 < C) (hCmax : True) (hv : 0 ≤ v)\n    (hlift : lift ρ v S C = W) : vmin ρ Cmax W S ≤ v := by' },
  { id: 'scaling-vmin-exponent-one', file: 'Delphi/Scaling.lean', theorem: 'Delphi.vmin_ratio', claim_id: 'thompson1917-ch02-10', description: 'R4 scaling mutant: v_min claimed to scale as L (exponent 1) instead of sqrt(L).', find: '    vmin ρ Cmax (W L₂) (S L₂) / vmin ρ Cmax (W L₁) (S L₁) = Real.sqrt (L₂ / L₁) := by', replace: '    vmin ρ Cmax (W L₂) (S L₂) / vmin ρ Cmax (W L₁) (S L₁) = L₂ / L₁ := by' },
  { id: 'scaling-power-exponent-three', file: 'Delphi/Scaling.lean', theorem: 'Delphi.powerRequired_ratio', claim_id: 'thompson1917-ch02-06', description: 'R5 mutant: power required claimed to scale as L^3 (flight no harder with size).', find: '      = (L₂ / L₁) ^ 3 * Real.sqrt (L₂ / L₁) := by\n  have hr := vmin_ratio', replace: '      = (L₂ / L₁) ^ 3 := by\n  have hr := vmin_ratio' },
  { id: 'scaling-power-available-three-and-a-half', file: 'Delphi/Scaling.lean', theorem: 'Delphi.powerAvailable_ratio', claim_id: 'thompson1917-ch02-06', description: 'R6 mutant: power available claimed to scale as L^3.5 under the muscle premise (then the ratio would be constant and no L* would exist).', find: '    {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) : P L₂ / P L₁ = (L₂ / L₁) ^ 3 := by', replace: '    {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) : P L₂ / P L₁ = (L₂ / L₁) ^ 3 * Real.sqrt (L₂ / L₁) := by' },
  { id: 'scaling-froude-exponent-one', file: 'Delphi/Scaling.lean', theorem: 'Delphi.froude_ratio', claim_id: 'thompson1917-ch02-10', description: 'R8 mutant: Froude speed claimed to scale as L instead of sqrt(L).', find: '    froudeSpeed Fr g L₂ / froudeSpeed Fr g L₁ = Real.sqrt (L₂ / L₁) := by', replace: '    froudeSpeed Fr g L₂ / froudeSpeed Fr g L₁ = L₂ / L₁ := by' },
  { id: 'bending-section-modulus-squared', file: 'Delphi/Scaling.lean', theorem: 'Delphi.bendingStress_ratio_body', claim_id: 'scaling-bending-law', description: 'R9 model mutant: the section modulus made to scale as d^2 instead of d^3 (then bending stress would scale as L^2 under a body-like load), so conclusion 1 must fail.', find: 'def SectionModulusLaw (Z : ℝ → ℝ) (k : ℝ) : Prop := 0 < k ∧ ∀ L, 0 < L → Z L = k * L ^ 3', replace: 'def SectionModulusLaw (Z : ℝ → ℝ) (k : ℝ) : Prop := 0 < k ∧ ∀ L, 0 < L → Z L = k * L ^ 2' },
  { id: 'bending-sheet-load-claims-body-conclusion', file: 'Delphi/Scaling.lean', theorem: 'Delphi.bendingStress_ratio_body', claim_id: 'scaling-bending-law', description: 'R9 mutant: the load made sheet-like (AreaLaw F) while conclusion 1 (stress proportional to L) is kept; it must fail, since a sheet-like load gives size-independent stress.', find: 'theorem bendingStress_ratio_body {F ℓ Z : ℝ → ℝ} {kF kℓ kZ : ℝ} (hF : CubeLaw F kF) (hℓ : LeverLaw ℓ kℓ)', replace: 'theorem bendingStress_ratio_body {F ℓ Z : ℝ → ℝ} {kF kℓ kZ : ℝ} (hF : AreaLaw F kF) (hℓ : LeverLaw ℓ kℓ)' },
  { id: 'bending-limit-without-sigma', file: 'Delphi/Scaling.lean', theorem: 'Delphi.bending_cannot_carry', claim_id: 'scaling-bending-law', description: 'R9 mutant: the size limit stated without the material strength (threshold k_Z/(k_F k_l n)), conclusion 2 kept while sigma_max is dropped from the bound; it must fail.', find: '    (hL : σmax * kZ / (kF * kℓ * n) < L) : σmax < n * bendingStress F ℓ Z L := by', replace: '    (hL : kZ / (kF * kℓ * n) < L) : σmax < n * bendingStress F ℓ Z L := by' },
  { id: 'aerobic-venous-term-wrong-way', file: 'Delphi/Flight.lean', theorem: 'Delphi.aerobic_le_Ca', claim_id: 'aerobic-power-bound', description: 'Mutant: the venous term dropped the wrong way, claiming aerobic power is at most η E Q Cv (the venous content) instead of η E Q Ca; false whenever Ca > 2 Cv, so the proof must fail.', find: '    aerobicPower η E Q Ca Cv ≤ η * E * Q * Ca := by', replace: '    aerobicPower η E Q Ca Cv ≤ η * E * Q * Cv := by' },
  { id: 'aerobic-efficiency-above-one', file: 'Delphi/Flight.lean', theorem: 'Delphi.aerobic_le_metabolic', claim_id: 'aerobic-power-bound', description: 'Mutant: the hypothesis η ≤ 1 dropped (replaced by True) while the metabolic ceiling E Q Ca is kept; with η > 1 mechanical power could exceed metabolic power, so the proof must fail.', find: 'theorem aerobic_le_metabolic {η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hη1 : η ≤ 1) (hE : 0 ≤ E)', replace: 'theorem aerobic_le_metabolic {η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hη1 : True) (hE : 0 ≤ E)' },
  { id: 'crossover-exponent-reversed', file: 'Delphi/Flight.lean', theorem: 'Delphi.powerLaw_crossover', claim_id: 'aerobic-power-bound', description: 'Mutant: the crossover claimed when the supply exponent EXCEEDS the demand exponent (b₁ < b₂); then supply overtakes demand and no size limit exists, so the proof must fail.', find: '    (hb : b₂ < b₁) : ∃ Ls : ℝ, 0 < Ls ∧ ∀ L, Ls < L → S L < D L := by', replace: '    (hb : b₁ < b₂) : ∃ Ls : ℝ, 0 < Ls ∧ ∀ L, Ls < L → S L < D L := by' },
  { id: 'glide-range-halved', file: 'Delphi/Flight.lean', theorem: 'Delphi.glide_range_le', claim_id: 'flight-climb-glide-law', description: 'Mutant: the glide range claimed to be at most half of h (L/D)max; the energy balance allows the full bound, so the proof must fail.', find: '    x ≤ h * LDmax := by\n  rw [hlift, div_le_iff₀ hD] at hLD', replace: '    x ≤ h * LDmax / 2 := by\n  rw [hlift, div_le_iff₀ hD] at hLD' },
  { id: 'climb-bound-reversed', file: 'Delphi/Flight.lean', theorem: 'Delphi.climbRate_le', claim_id: 'flight-climb-glide-law', description: 'Mutant: the climb bound reversed (the excess power over weight claimed to be at most the climb rate); false with positive losses, so the proof must fail.', find: '    (hloss : 0 ≤ loss) : c ≤ climbRate W Pavail Preq := by', replace: '    (hloss : 0 ≤ loss) : climbRate W Pavail Preq ≤ c := by' },
  { id: 'allometry-quotient-sum', file: 'Delphi/Flight.lean', theorem: 'Delphi.powerLaw_div', claim_id: 'flight-allometry-law', description: 'Mutant: a quotient of power laws claimed to have the SUM of the exponents instead of the difference.', find: '    PowerLaw (fun L => f L / g L) (a₁ / a₂) (b₁ - b₂) := by', replace: '    PowerLaw (fun L => f L / g L) (a₁ / a₂) (b₁ + b₂) := by' },
  { id: 'empirical-witness-outside-band', file: 'Delphi/Empirical.lean', theorem: 'Delphi.Empirical.empirical_nonvacuous', claim_id: 'empirical-E3',
    description: 'An empirical band moved so the measured value falls outside it: efficiency capped at 0.1 while the witness commits the measured 0.15. The non-vacuity witness must then fail to compile, which is the whole point of having one.',
    find: '  eta_le : eta \u2264 0.15', replace: '  eta_le : eta \u2264 0.1' },
  { id: 'empirical-contradictory-band', file: 'Delphi/Empirical.lean', theorem: 'Delphi.Empirical.empirical_nonvacuous', claim_id: 'empirical-E2',
    description: 'A deliberately CONTRADICTORY pair of observations: the mass-exponent band is given a floor of 3.05 against its ceiling of 3.02, so no exponent satisfies both. The structure becomes uninhabitable and no witness exists; an inconsistent empirical set would otherwise let the checker eliminate every candidate, and that failure would look exactly like success.',
    find: '  lo : (2.9 : \u211d) \u2264 b', replace: '  lo : (3.05 : \u211d) \u2264 b' },
  { id: 'genetic-code-distance-wrong', file: 'Delphi/Genotype.lean', theorem: 'Delphi.Genotype.phe_leu_one', claim_id: 'genotype-genetic-code',
    description: 'Data claim changed: Phe to Leu said to need 2 substitutions when the table gives 1 (UUU to UUA). The kernel evaluates minSubst on the code table, so it must reject it.',
    find: 'theorem phe_leu_one : minSubst Phe Leu = 1 := by decide +kernel', replace: 'theorem phe_leu_one : minSubst Phe Leu = 2 := by decide +kernel' },
  { id: 'genetic-code-distance-reversed', file: 'Delphi/Genotype.lean', theorem: 'Delphi.Genotype.minSubst_le', claim_id: 'genotype-genetic-code',
    description: 'Statement reversed: the code distance claimed to be at least the Hamming distance of any codon pair instead of at most it. False for any pair further apart than the nearest, so the proof must fail.',
    find: '    minSubst a b ≤ hamming c d := by', replace: '    hamming c d ≤ minSubst a b := by' },
  { id: 'pleiotropy-closure-reversed', file: 'Delphi/Genotype.lean', theorem: 'Delphi.Genotype.closure_violated', claim_id: 'genotype-pleiotropy-closure',
    description: 'Statement changed to claim the closure check is TRUE when a mapped node is missing from the changed list, which is exactly when it is false.',
    find: '    closureB mapped changed = false := by', replace: '    closureB mapped changed = true := by' },
  { id: 'waiting-time-bounds-swapped', file: 'Delphi/Genotype.lean', theorem: 'Delphi.Genotype.expectedWaitingTime_bounds', claim_id: 'genotype-substitution-time',
    description: 'Statement swapped: the waiting time claimed to be at most N/(M mu) and at least N/mu, the reverse of the bound. False for every u strictly between the ends, so the proof must fail.',
    find: '    N / ((M : ℝ) * μ) ≤ expectedWaitingTime N M μ u ∧ expectedWaitingTime N M μ u ≤ N / μ := by',
    replace: '    expectedWaitingTime N M μ u ≤ N / ((M : ℝ) * μ) ∧ N / μ ≤ expectedWaitingTime N M μ u := by' },
  { id: 'haldane-bound-reversed', file: 'Delphi/Genotype.lean', theorem: 'Delphi.Genotype.haldane_time_lower', claim_id: 'haldane-cost-of-selection',
    description: "Statement reversed: Haldane's accounting claimed to put a CEILING of c N / e on the generations instead of a floor, which would make the cost an argument for speed.",
    find: '(he : 0 < e) : c * N / e ≤ T := by', replace: '(he : 0 < e) : T ≤ c * N / e := by' },
  { id: 'dev-certificate-self-edge', file: 'Delphi/Certificates/FinDevelopment.lean', theorem: 'Delphi.Genotype.Certificates.finDev_check', claim_id: 'genotype-developmental-ordering',
    description: 'Data sabotaged: a develops_from edge from a node to itself is added to the certified list, so something would develop from itself and no stage could be strictly earlier. The kernel-evaluated checker must reject it.',
    find: 'def finDevEdges : List (ℕ × ℕ) := [', replace: 'def finDevEdges : List (ℕ × ℕ) := [(0, 0), ' },
  { id: 'q10-exponent-undivided', file: 'Delphi/Physiology.lean', theorem: 'Delphi.Physiology.q10_ratio', claim_id: 'physiology-q10',
    description: 'Statement changed to raise Q10 to the whole temperature difference instead of the difference over ten, which is the definition of Q10 (a factor per 10 degrees).',
    find: '    q10Scale X0 Q10 Tref T₂ / q10Scale X0 Q10 Tref T₁ = Q10 ^ ((T₂ - T₁) / 10) := by',
    replace: '    q10Scale X0 Q10 Tref T₂ / q10Scale X0 Q10 Tref T₁ = Q10 ^ (T₂ - T₁) := by' },
  { id: 'laplace-factor-dropped', file: 'Delphi/Physiology.lean', theorem: 'Delphi.Physiology.laplace_pressure_limit', claim_id: 'physiology-laplace',
    description: 'Statement strengthened by dropping the factor 2: a sphere claimed to hold at most sigma_max t / r, the cylinder bound. Stronger than the wall stress allows, so the proof must fail.',
    find: '    P ≤ 2 * σmax * t / r := by', replace: '    P ≤ σmax * t / r := by' },
];

// ---- runner: the compiles are independent, so they run in a bounded pool ----
// Each compile gets its own directory under the scratch root so nothing two of them write can collide.
// The cap is set by MEMORY, not cores: each lean process maps the whole Mathlib object set, and this is the
// binding limit. MEASURED on this machine (32 cores, 126 GB, 48 GB free): 8 concurrent compiles exhausted it
// and every compile, controls included, failed with "failed to read file ... .olean" - a resource failure that
// looks exactly like a rejection, which is why the controls are run through the same command and must pass. lean also elaborates with its own thread
// pool (one per core by default), so each child is given a slice of the cores through LEAN_NUM_THREADS;
// without that slice the pool oversubscribes and each compile gets slower than it was in sequence.
const ROOT_TMP = fs.mkdtempSync(path.join(process.env.MUTANT_DIR || os.tmpdir(), 'delphi-mutants-'));
const CPUS = os.cpus().length;
const GB_PER_COMPILE = 12; // measured: 8 concurrent compiles on this box exhausted memory and every one failed to read Mathlib oleans
const JOBS = Math.max(1, Math.min(Number(process.env.MUTANT_JOBS) || Infinity, CPUS - 1, Math.max(1, Math.floor(os.freemem() / 2 ** 30 / GB_PER_COMPILE)), 4));
const LEAN_THREADS = Math.max(1, Math.floor(CPUS / JOBS));
const childEnv = { ...env, LEAN_NUM_THREADS: String(LEAN_THREADS) };

const check = (dir, file) => new Promise(resolve => {
  const t0 = Date.now();
  let out = '';
  const finish = (exit) => {
    const errs = out.split(/\r?\n/).filter(l => /error:/.test(l));
    const strip = x => x.split(dir.replace(/\\/g, '/')).join('').split(dir).join('').replace(/^[\\/]+/, '');
    resolve({ exit, seconds: +((Date.now() - t0) / 1000).toFixed(1), errors: errs.length, firstError: errs[0] ? strip(errs[0]).slice(0, 300) : null });
  };
  const p = spawn('lake', ['env', 'lean', file], { cwd: here, env: childEnv, shell: process.platform === 'win32' });
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { out += d; });
  p.on('error', e => { out += 'error: spawn failed: ' + e.message; finish(-1); });
  p.on('close', code => finish(code));
});

const results = [];
// 1. Prepare every source first (sequential, cheap): controls are the unmodified modules, mutants the
// patched copies. A find string that is not unique is recorded as not applied, never silently mutated.
const prepared = [];
for (const file of [...new Set(mutations.map(m => m.file))]) {
  const id = 'control-' + path.basename(file, '.lean').toLowerCase();
  const dir = path.join(ROOT_TMP, id); fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, path.basename(file));
  fs.writeFileSync(dst, fs.readFileSync(path.join(here, file), 'utf8'));
  prepared.push({ kind: 'control', id, file, dir, dst });
}
for (const m of mutations) {
  const src = fs.readFileSync(path.join(here, m.file), 'utf8');
  const occ = src.split(m.find).length - 1;
  if (occ !== 1) { console.log(`${m.id}: find string occurs ${occ} times, skipping`); results.push({ ...m, kind: 'mutation', outcome: 'not applied', asExpected: false }); continue; }
  let mut = src.replace(m.find, m.replace);
  for (const [a, b] of m.also || []) { if (mut.split(a).length - 1 !== 1) throw new Error(m.id + ': secondary find not unique'); mut = mut.replace(a, b); }
  const dir = path.join(ROOT_TMP, m.id); fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, path.basename(m.file)); fs.writeFileSync(dst, mut);
  prepared.push({ kind: 'mutation', id: m.id, file: m.file, dir, dst, m });
}

// 2. Run them. Completion order is whatever the pool gives; the results are sorted afterwards, so
// mutations.json does not depend on it.
console.log(`${prepared.length} compiles (${prepared.filter(p => p.kind === 'control').length} controls, ${prepared.filter(p => p.kind === 'mutation').length} mutants) at concurrency ${JOBS}, ${LEAN_THREADS} lean thread(s) each, on ${CPUS} cores`);
const wall0 = Date.now();
let cursor = 0, finished = 0;
const worker = async () => {
  while (cursor < prepared.length) {
    const t = prepared[cursor++];
    const r = await check(t.dir, t.dst);
    finished++;
    if (t.kind === 'control') {
      const ok = r.exit === 0 && r.errors === 0;
      console.log(`[${finished}/${prepared.length}] control ${t.file}: ${ok ? 'passed' : 'FAILED exit ' + r.exit} (${r.seconds}s)`);
      results.push({ id: t.id, kind: 'control', file: 'lean/' + t.file, expected: 'accepted', outcome: ok ? 'accepted' : 'rejected', asExpected: ok, ...r });
    } else {
      const rejected = r.exit !== 0 && r.errors > 0;
      console.log(`[${finished}/${prepared.length}] ${t.id}: ${rejected ? 'rejected (' + r.errors + ' error(s))' : 'NOT REJECTED exit ' + r.exit} (${r.seconds}s)`);
      const m = t.m;
      results.push({ id: m.id, kind: 'mutation', file: 'lean/' + m.file, theorem: m.theorem, claim_id: m.claim_id, description: m.description, find: m.find, replace: m.replace, also: m.also || [], expected: 'rejected', outcome: rejected ? 'rejected' : 'accepted', asExpected: rejected, ...r });
    }
  }
};
await Promise.all(Array.from({ length: JOBS }, worker));
const wallSeconds = +((Date.now() - wall0) / 1000).toFixed(1);

// 3. Deterministic order: controls first, then mutants, each by id, whatever order they finished in.
const rank = r => (r.kind === 'control' ? 0 : 1);
results.sort((a, b) => rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));

const compileSeconds = +results.reduce((t, r) => t + (r.seconds || 0), 0).toFixed(1);
const summary = { run: new Date().toISOString(), command: 'lake env lean <mutant copy>', mutations: results.filter(r => r.kind === 'mutation').length, rejected: results.filter(r => r.kind === 'mutation' && r.outcome === 'rejected').length, controlsPassed: results.filter(r => r.kind === 'control' && r.asExpected).length, controls: results.filter(r => r.kind === 'control').length, allAsExpected: results.every(r => r.asExpected),
  concurrency: JOBS, leanThreadsPerCompile: LEAN_THREADS, cores: CPUS, wallClockSeconds: wallSeconds, compileSecondsSummed: compileSeconds, speedup: wallSeconds > 0 ? +(compileSeconds / wallSeconds).toFixed(2) : null,
  order: 'controls first, then mutants, each sorted by id; the pool\'s completion order does not reach this file',
  parallelNote: `The compiles are independent, so they run in a pool of ${JOBS}. The cap is memory, not cores: each lean process holds several GB with Mathlib imported. lake env lean type-checks a copy outside the package, writing no .olean, and each compile also has its own directory under the scratch root, so none can clobber another. lean's own elaboration threads are capped at ${LEAN_THREADS} per compile (LEAN_NUM_THREADS) so the pool does not oversubscribe ${CPUS} cores; wall clock against summed compile time is the speedup.` };
fs.writeFileSync(path.join(here, 'mutations.json'), JSON.stringify({ summary, results }, null, 1));
fs.rmSync(ROOT_TMP, { recursive: true, force: true });
console.log(JSON.stringify(summary));
if (!summary.allAsExpected) process.exitCode = 1;
