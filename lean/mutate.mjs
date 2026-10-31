#!/usr/bin/env node
// Mutation evidence: a proof nobody tried to break is not evidence. Each entry below changes the
// STATEMENT of a headline theorem (or removes a hypothesis of the model) in a copy of the module,
// then asks the Lean compiler to check the copy. The proofs must be rejected (non-zero exit with an
// error). A control run of the unmodified module must pass through the very same command. Results
// go to lean/mutations.json and are folded into lean.json by report.mjs. Nothing under lean/Delphi
// is modified.
//   node lean/mutate.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
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
  { id: 'bending-limit-without-sigma', file: 'Delphi/Scaling.lean', theorem: 'Delphi.bending_cannot_carry', claim_id: 'scaling-bending-law', description: 'R9 mutant: the size limit stated without the material strength (threshold k_Z/(k_F k_l n)), conclusion 2 kept while sigma_max is dropped from the bound; it must fail.', find: '    (hL : σmax * kZ / (kF * kℓ * n) < L) : σmax < n * bendingStress F ℓ Z L := by', replace: '    (hL : kZ / (kF * kℓ * n) < L) : σmax < n * bendingStress F ℓ Z L := by' }
];

const tmp = fs.mkdtempSync(path.join(process.env.MUTANT_DIR || os.tmpdir(), 'delphi-mutants-'));
const check = (file) => {
  const t0 = Date.now();
  const r = spawnSync('lake', ['env', 'lean', file], { cwd: here, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const errs = out.split(/\r?\n/).filter(l => /error:/.test(l));
  const strip = s => s.replace(tmp.replace(/\\/g, '/'), '').replace(tmp, '').replace(/^[\\/]+/, '');
  return { exit: r.status, seconds: +((Date.now() - t0) / 1000).toFixed(1), errors: errs.length, firstError: errs[0] ? strip(errs[0]).slice(0, 300) : null };
};

const results = [];
for (const f of [...new Set(mutations.map(m => m.file))]) {
  const src = fs.readFileSync(path.join(here, f), 'utf8');
  const dst = path.join(tmp, 'control-' + path.basename(f)); fs.writeFileSync(dst, src);
  process.stdout.write(`control ${f} ... `);
  const r = check(dst); console.log(r.exit === 0 ? `passed (${r.seconds}s)` : `FAILED exit ${r.exit}`);
  results.push({ id: 'control-' + path.basename(f, '.lean').toLowerCase(), kind: 'control', file: 'lean/' + f, expected: 'accepted', outcome: r.exit === 0 && r.errors === 0 ? 'accepted' : 'rejected', asExpected: r.exit === 0 && r.errors === 0, ...r });
}
for (const m of mutations) {
  const src = fs.readFileSync(path.join(here, m.file), 'utf8');
  const occ = src.split(m.find).length - 1;
  if (occ !== 1) { console.log(`${m.id}: find string occurs ${occ} times, skipping`); results.push({ ...m, kind: 'mutation', outcome: 'not applied', asExpected: false }); continue; }
  let mut = src.replace(m.find, m.replace);
  for (const [a, b] of m.also || []) { if (mut.split(a).length - 1 !== 1) throw new Error(m.id + ': secondary find not unique'); mut = mut.replace(a, b); }
  const dst = path.join(tmp, m.id + '.lean'); fs.writeFileSync(dst, mut);
  process.stdout.write(`${m.id} ... `);
  const r = check(dst);
  const rejected = r.exit !== 0 && r.errors > 0;
  console.log(rejected ? `rejected (${r.errors} error(s), ${r.seconds}s)` : `NOT REJECTED exit ${r.exit}`);
  results.push({ id: m.id, kind: 'mutation', file: 'lean/' + m.file, theorem: m.theorem, claim_id: m.claim_id, description: m.description, find: m.find, replace: m.replace, also: m.also || [], expected: 'rejected', outcome: rejected ? 'rejected' : 'accepted', asExpected: rejected, ...r });
}
const summary = { run: new Date().toISOString(), command: 'lake env lean <mutant copy>', mutations: results.filter(r => r.kind === 'mutation').length, rejected: results.filter(r => r.kind === 'mutation' && r.outcome === 'rejected').length, controlsPassed: results.filter(r => r.kind === 'control' && r.asExpected).length, controls: results.filter(r => r.kind === 'control').length, allAsExpected: results.every(r => r.asExpected) };
fs.writeFileSync(path.join(here, 'mutations.json'), JSON.stringify({ summary, results }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify(summary));
if (!summary.allAsExpected) process.exitCode = 1;
