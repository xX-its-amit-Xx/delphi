/-
# Fixation when selection does not oppose the mutant: a kernel-checked lower bound

This module extends `Delphi.Kimura` for the flying-fish feasibility question: how much substitution
could have happened in a lineage over a given number of generations. It does **not** prove Kimura's
1962 selected-fixation formula `u ≈ 2s`; that result lives in the diffusion limit and is not
formalised here. What it proves is weaker and exact:

* `FavoredChain`: the same absorbing chain as `NeutralChain`, but with neutrality `E[X' | X = i] = i`
  relaxed to `E[X' | X = i] ≥ i` (the mutant's expected copy number never decreases; selection, if
  any, does not oppose it). Every neutral chain is a favored chain (`NeutralChain.toFavored`).
* `FavoredChain.fixationProbability_ge`: such a lineage starting from `i` of `M` copies is eventually
  fixed with probability **at least** `i / M`; `fixationProbability_le_one` gives the trivial ceiling.
  The limit exists because `fixedBy t i` is nondecreasing in `t` (fixation is absorbing) and bounded.
* `wrightFisherSelection M s`: Wright–Fisher sampling with relative fitness `1 + s` for the mutant,
  i.e. next-generation copy number `Binomial(M, (1+s) i / (M + s i))`, is a favored chain for every
  `s ≥ 0`, so a single new mutant with `s ≥ 0` fixes with probability at least `1 / M`.
* `expectedSubstitutions M μ u T := M μ u T`, the expected number of substitutions over `T`
  generations under Kimura's independent-fates definition (the rate `M μ u` summed over `T`
  generations). Theorems: for the neutral Wright–Fisher chain it equals `μ T` for every `M`
  (the molecular clock: population size cancels); for any favored chain it is at least `μ T`; and
  for any fixation probability `u ≤ 1` it is at most `M μ T`.

## What the kernel checked

The inequalities above, from the chain axioms, with no `sorry` and only the standard axioms
(see `lean/Delphi/Audit.lean`).

## What is assumed, not proved

* The population-genetic model: constant `M`, non-overlapping generations, binomial (Wright–Fisher)
  sampling, selection acting only through the sampling probability `(1+s) i / (M + s i)`, `s`
  constant over time and over sites.
* Independent fates of mutants: `expectedSubstitutions` is a **definition** (rate × generations), as
  in Kimura (1968). Linkage, interference and changing population size are excluded by that
  definition, not shown absent.
* `μ` (per copy per generation), `T` (generations available) and `M` (gene copies) are free
  parameters. Nothing here measures them; the record that applies this module to Exocoetidae names
  the literature sources for each and the range they span.
* Nothing here says which or how many substitutions a morphological change needs. The module bounds
  supply, never demand.
-/
import Mathlib
import Delphi.Kimura

open Finset Filter Topology Matrix

namespace Delphi

/-- An absorbing chain on `Fin (M+1)` mutant copies whose expected copy number never decreases:
neutral or favored by selection. Identical to `NeutralChain` except that `neutral` (an equality)
is weakened to `favored` (an inequality). -/
structure FavoredChain (M : ℕ) where
  /-- One-generation transition matrix. -/
  P : Matrix (Fin (M + 1)) (Fin (M + 1)) ℝ
  /-- Probabilities are nonnegative. -/
  nonneg : ∀ i j, 0 ≤ P i j
  /-- Each row is a probability distribution. -/
  rowSum : ∀ i, ∑ j, P i j = 1
  /-- Selection does not oppose the mutant: `E[X_{t+1} | X_t = i] ≥ i`. -/
  favored : ∀ i : Fin (M + 1), ((i : ℕ) : ℝ) ≤ ∑ j, P i j * ((j : ℕ) : ℝ)
  /-- Loss (`0` copies) is absorbing. -/
  absorb_zero : ∀ j, P 0 j = if j = 0 then 1 else 0
  /-- Fixation (`M` copies) is absorbing. -/
  absorb_last : ∀ j, P (Fin.last M) j = if j = Fin.last M then 1 else 0
  /-- From any intermediate state, absorption in one step has positive probability. -/
  escape : ∀ i : Fin (M + 1), i ≠ 0 → i ≠ Fin.last M → 0 < P i 0 + P i (Fin.last M)

/-- Every neutral chain is a favored chain (equality implies the inequality). -/
def NeutralChain.toFavored {M : ℕ} (C : NeutralChain M) : FavoredChain M :=
  { C with favored := fun i => (C.neutral i).ge }

namespace FavoredChain

open NeutralChain (interior mem_interior zero_ne_last sum_split)

variable {M : ℕ} (C : FavoredChain M)

lemma pow_nonneg (t : ℕ) (i j : Fin (M + 1)) : 0 ≤ (C.P ^ t) i j := by
  induction t generalizing i j with
  | zero => simp only [pow_zero, Matrix.one_apply]; split_ifs <;> norm_num
  | succ t ih =>
    rw [pow_succ, Matrix.mul_apply]
    exact Finset.sum_nonneg fun k _ => mul_nonneg (ih i k) (C.nonneg k j)

lemma pow_rowSum (t : ℕ) (i : Fin (M + 1)) : ∑ j, (C.P ^ t) i j = 1 := by
  induction t generalizing i with
  | zero => simp [Matrix.one_apply]
  | succ t ih =>
    simp only [pow_succ, Matrix.mul_apply]
    rw [Finset.sum_comm]
    simp_rw [← Finset.mul_sum, C.rowSum, mul_one]
    exact ih i

/-- The `t`-step chain is still favored: the expected copy number after `t` generations is at
least the starting number. -/
lemma pow_favored (t : ℕ) (i : Fin (M + 1)) :
    ((i : ℕ) : ℝ) ≤ ∑ j, (C.P ^ t) i j * ((j : ℕ) : ℝ) := by
  induction t generalizing i with
  | zero => simp [Matrix.one_apply]
  | succ t ih =>
    simp only [pow_succ, Matrix.mul_apply, Finset.sum_mul]
    rw [Finset.sum_comm]
    simp_rw [mul_assoc, ← Finset.mul_sum]
    calc ((i : ℕ) : ℝ) ≤ ∑ k, (C.P ^ t) i k * ((k : ℕ) : ℝ) := ih i
      _ ≤ ∑ k, (C.P ^ t) i k * ∑ j, C.P k j * ((j : ℕ) : ℝ) :=
          Finset.sum_le_sum fun k _ => mul_le_mul_of_nonneg_left (C.favored k) (C.pow_nonneg t i k)

lemma exists_contraction (hM : 0 < M) :
    ∃ ρ : ℝ, 0 ≤ ρ ∧ ρ < 1 ∧ ∀ k ∈ interior M, ∑ j ∈ interior M, C.P k j ≤ ρ := by
  classical
  by_cases h : (interior M).Nonempty
  · refine ⟨(interior M).sup' h (fun k => ∑ j ∈ interior M, C.P k j), ?_, ?_, ?_⟩
    · obtain ⟨k, hk⟩ := h
      exact le_trans (Finset.sum_nonneg fun j _ => C.nonneg k j)
        (Finset.le_sup' (fun k => ∑ j ∈ interior M, C.P k j) hk)
    · rw [Finset.sup'_lt_iff]
      intro k hk
      have hk' := mem_interior.mp hk
      have h1 := C.rowSum k
      rw [sum_split hM] at h1
      have := C.escape k hk'.1 hk'.2
      linarith
    · intro k hk
      exact Finset.le_sup' (fun k => ∑ j ∈ interior M, C.P k j) hk
  · refine ⟨0, le_rfl, zero_lt_one, fun k hk => (h ⟨k, hk⟩).elim⟩

/-- Probability of being in the interior after `t` generations, starting from `i`. -/
def unresolved (t : ℕ) (i : Fin (M + 1)) : ℝ := ∑ j ∈ interior M, (C.P ^ t) i j

lemma unresolved_le_one (t : ℕ) (i : Fin (M + 1)) : C.unresolved t i ≤ 1 := by
  rw [← C.pow_rowSum t i]
  exact Finset.sum_le_sum_of_subset_of_nonneg (Finset.subset_univ _)
    (fun j _ _ => C.pow_nonneg t i j)

lemma absorbing_sum_interior (k : Fin (M + 1)) (hk : k = 0 ∨ k = Fin.last M) :
    ∑ j ∈ interior M, C.P k j = 0 := by
  apply Finset.sum_eq_zero
  intro j hj
  have hj' := mem_interior.mp hj
  rcases hk with rfl | rfl
  · rw [C.absorb_zero]; simp [hj'.1]
  · rw [C.absorb_last]; simp [hj'.2]

lemma unresolved_succ_le (hM : 0 < M) {ρ : ℝ}
    (hρ : ∀ k ∈ interior M, ∑ j ∈ interior M, C.P k j ≤ ρ) (t : ℕ) (i : Fin (M + 1)) :
    C.unresolved (t + 1) i ≤ ρ * C.unresolved t i := by
  unfold unresolved
  simp only [pow_succ, Matrix.mul_apply]
  rw [Finset.sum_comm]
  simp_rw [← Finset.mul_sum]
  rw [sum_split hM (fun k => (C.P ^ t) i k * ∑ j ∈ interior M, C.P k j)]
  simp only [C.absorbing_sum_interior 0 (Or.inl rfl),
    C.absorbing_sum_interior (Fin.last M) (Or.inr rfl), mul_zero, add_zero, zero_add]
  rw [Finset.mul_sum]
  apply Finset.sum_le_sum
  intro k hk
  rw [mul_comm ρ]
  exact mul_le_mul_of_nonneg_left (hρ k hk) (C.pow_nonneg t i k)

lemma unresolved_le_pow (hM : 0 < M) {ρ : ℝ} (hρ0 : 0 ≤ ρ)
    (hρ : ∀ k ∈ interior M, ∑ j ∈ interior M, C.P k j ≤ ρ) (t : ℕ) (i : Fin (M + 1)) :
    C.unresolved t i ≤ ρ ^ t := by
  induction t with
  | zero => simpa using C.unresolved_le_one 0 i
  | succ t ih =>
    calc C.unresolved (t + 1) i ≤ ρ * C.unresolved t i := C.unresolved_succ_le hM hρ t i
      _ ≤ ρ * ρ ^ t := mul_le_mul_of_nonneg_left ih hρ0
      _ = ρ ^ (t + 1) := by ring

/-- Probability that a lineage starting from `i` copies is fixed by generation `t`. -/
def fixedBy (t : ℕ) (i : Fin (M + 1)) : ℝ := (C.P ^ t) i (Fin.last M)

lemma fixedBy_le_one (t : ℕ) (i : Fin (M + 1)) : C.fixedBy t i ≤ 1 := by
  rw [← C.pow_rowSum t i]
  exact Finset.single_le_sum (fun j _ => C.pow_nonneg t i j) (Finset.mem_univ (Fin.last M))

/-- Fixation is absorbing, so the probability of having fixed can only grow with `t`. -/
lemma fixedBy_mono (i : Fin (M + 1)) : Monotone fun t => C.fixedBy t i := by
  apply monotone_nat_of_le_succ
  intro t
  show (C.P ^ t) i (Fin.last M) ≤ (C.P ^ (t + 1)) i (Fin.last M)
  rw [pow_succ, Matrix.mul_apply]
  have h := Finset.single_le_sum (f := fun k => (C.P ^ t) i k * C.P k (Fin.last M))
    (fun k _ => mul_nonneg (C.pow_nonneg t i k) (C.nonneg k _)) (Finset.mem_univ (Fin.last M))
  simpa [C.absorb_last] using h

/-- The favored version of conservation of the mean: `M · P(fixed by t) + E[copies · 1{unresolved}] ≥ i`. -/
lemma mean_decomposition_ge (hM : 0 < M) (t : ℕ) (i : Fin (M + 1)) :
    ((i : ℕ) : ℝ) ≤ (M : ℝ) * C.fixedBy t i + ∑ j ∈ interior M, (C.P ^ t) i j * ((j : ℕ) : ℝ) := by
  have h := C.pow_favored t i
  rw [sum_split hM] at h
  simp only [Fin.val_zero, Nat.cast_zero, mul_zero, zero_add, Fin.val_last] at h
  rw [fixedBy, mul_comm]
  exact h

/-- At every finite time, `fixedBy` is at least `i / M` minus the unresolved probability. -/
lemma fixedBy_ge (hM : 0 < M) (t : ℕ) (i : Fin (M + 1)) :
    ((i : ℕ) : ℝ) / M - C.unresolved t i ≤ C.fixedBy t i := by
  have hMpos : (0 : ℝ) < M := by exact_mod_cast hM
  have hdec := C.mean_decomposition_ge hM t i
  have hSM : ∑ j ∈ interior M, (C.P ^ t) i j * ((j : ℕ) : ℝ) ≤ (M : ℝ) * C.unresolved t i := by
    rw [unresolved, Finset.mul_sum]
    apply Finset.sum_le_sum
    intro j _
    rw [mul_comm (M : ℝ)]
    apply mul_le_mul_of_nonneg_left _ (C.pow_nonneg t i j)
    exact_mod_cast Nat.le_of_lt_succ j.isLt
  have : ((i : ℕ) : ℝ) / M ≤ C.fixedBy t i + C.unresolved t i := by
    rw [div_le_iff₀ hMpos]
    linarith
  linarith

/-- The fixation probability: the limit of `fixedBy`, which exists as the supremum of a
nondecreasing bounded sequence. -/
noncomputable def fixationProbability (i : Fin (M + 1)) : ℝ := ⨆ t, C.fixedBy t i

theorem fixedBy_tendsto (i : Fin (M + 1)) :
    Tendsto (fun t => C.fixedBy t i) atTop (nhds (C.fixationProbability i)) :=
  tendsto_atTop_ciSup (C.fixedBy_mono i) ⟨1, by rintro _ ⟨t, rfl⟩; exact C.fixedBy_le_one t i⟩

/-- **Lower bound on fixation when selection does not oppose the mutant.** A lineage starting from
`i` of `M` copies in a favored chain is eventually fixed with probability at least `i / M`. -/
theorem fixationProbability_ge (hM : 0 < M) (i : Fin (M + 1)) :
    ((i : ℕ) : ℝ) / M ≤ C.fixationProbability i := by
  obtain ⟨ρ, hρ0, hρ1, hρ⟩ := C.exists_contraction hM
  have h1 : Tendsto (fun t => C.fixedBy t i + ρ ^ t) atTop (nhds (C.fixationProbability i + 0)) :=
    (C.fixedBy_tendsto i).add (tendsto_pow_atTop_nhds_zero_of_lt_one hρ0 hρ1)
  rw [add_zero] at h1
  refine ge_of_tendsto' h1 fun t => ?_
  have h2 := C.fixedBy_ge hM t i
  have h3 := C.unresolved_le_pow hM hρ0 hρ t i
  linarith

theorem fixationProbability_le_one (i : Fin (M + 1)) : C.fixationProbability i ≤ 1 :=
  le_of_tendsto' (C.fixedBy_tendsto i) fun t => C.fixedBy_le_one t i

end FavoredChain

/-! ### Wright–Fisher sampling with selection is a favored chain -/

/-- Binomial sampling with an arbitrary success probability `p i` in state `i`:
`P(i → j) = C(M, j) (p i)^j (1 - p i)^(M-j)`. -/
noncomputable def binomialKernel (M : ℕ) (p : Fin (M + 1) → ℝ) :
    Matrix (Fin (M + 1)) (Fin (M + 1)) ℝ :=
  fun i j => (Nat.choose M j : ℝ) * (p i) ^ (j : ℕ) * (1 - p i) ^ (M - j)

section binomial

variable {M : ℕ} {p : Fin (M + 1) → ℝ}

lemma binomialKernel_eq_bernstein (i j : Fin (M + 1)) :
    binomialKernel M p i j = (bernsteinPolynomial ℝ M j).eval (p i) := by
  simp [binomialKernel, bernsteinPolynomial]

lemma binomial_nonneg (h0 : ∀ i, 0 ≤ p i) (h1 : ∀ i, p i ≤ 1) (i j : Fin (M + 1)) :
    0 ≤ binomialKernel M p i j := by
  unfold binomialKernel
  exact mul_nonneg (mul_nonneg (Nat.cast_nonneg _) (pow_nonneg (h0 i) _))
    (pow_nonneg (sub_nonneg.mpr (h1 i)) _)

lemma binomial_rowSum (i : Fin (M + 1)) : ∑ j, binomialKernel M p i j = 1 := by
  simp_rw [binomialKernel_eq_bernstein]
  rw [Fin.sum_univ_eq_sum_range (fun j => (bernsteinPolynomial ℝ M j).eval (p i)),
    ← Polynomial.eval_finsetSum, bernsteinPolynomial.sum, Polynomial.eval_one]

/-- The mean of `Binomial(M, p i)` is `M · p i`. -/
lemma binomial_mean (i : Fin (M + 1)) :
    ∑ j, binomialKernel M p i j * ((j : ℕ) : ℝ) = (M : ℝ) * p i := by
  simp_rw [binomialKernel_eq_bernstein]
  have h := congrArg (Polynomial.eval (p i)) (bernsteinPolynomial.sum_smul ℝ M)
  rw [Polynomial.eval_finsetSum] at h
  simp only [nsmul_eq_mul, Polynomial.eval_mul, Polynomial.eval_natCast, Polynomial.eval_X] at h
  rw [Fin.sum_univ_eq_sum_range (fun j => (bernsteinPolynomial ℝ M j).eval (p i) * (j : ℝ))]
  calc ∑ j ∈ range (M + 1), (bernsteinPolynomial ℝ M j).eval (p i) * (j : ℝ)
      = ∑ j ∈ range (M + 1), (j : ℝ) * (bernsteinPolynomial ℝ M j).eval (p i) := by
        simp_rw [mul_comm]
    _ = (M : ℝ) * p i := h

lemma binomial_absorb_zero (hz : p 0 = 0) (j : Fin (M + 1)) :
    binomialKernel M p 0 j = if j = 0 then 1 else 0 := by
  simp only [binomialKernel, hz, sub_zero, one_pow, mul_one]
  split_ifs with h
  · subst h; simp
  · have : (j : ℕ) ≠ 0 := fun h0 => h (Fin.ext h0)
    simp [zero_pow this]

lemma binomial_absorb_last (hl : p (Fin.last M) = 1) (j : Fin (M + 1)) :
    binomialKernel M p (Fin.last M) j = if j = Fin.last M then 1 else 0 := by
  simp only [binomialKernel, hl, sub_self, one_pow, mul_one]
  split_ifs with h
  · subst h; simp
  · have : M - (j : ℕ) ≠ 0 := by
      have := j.isLt
      have : (j : ℕ) ≠ M := fun h0 => h (Fin.ext (by simpa using h0))
      omega
    simp [zero_pow this]

lemma binomial_escape (h0 : ∀ i, 0 ≤ p i) (h1 : ∀ i, p i ≤ 1)
    (hlt : ∀ i, i ≠ Fin.last M → p i < 1) (i : Fin (M + 1)) (_hi0 : i ≠ 0) (hiM : i ≠ Fin.last M) :
    0 < binomialKernel M p i 0 + binomialKernel M p i (Fin.last M) := by
  have hpos : 0 < binomialKernel M p i 0 := by
    simp only [binomialKernel, Fin.val_zero, pow_zero, mul_one, Nat.choose_zero_right, Nat.cast_one,
      one_mul, Nat.sub_zero]
    exact pow_pos (sub_pos.mpr (hlt i hiM)) M
  have hnn := binomial_nonneg h0 h1 i (Fin.last M)
  linarith

/-- Any binomial sampling chain whose success probability is `0` at `0`, `1` at `M`, below `1`
elsewhere, and satisfies `M · p i ≥ i` is a favored chain. -/
noncomputable def binomialChain (M : ℕ) (p : Fin (M + 1) → ℝ) (h0 : ∀ i, 0 ≤ p i) (h1 : ∀ i, p i ≤ 1)
    (hz : p 0 = 0) (hl : p (Fin.last M) = 1) (hlt : ∀ i, i ≠ Fin.last M → p i < 1)
    (hfav : ∀ i : Fin (M + 1), ((i : ℕ) : ℝ) ≤ (M : ℝ) * p i) : FavoredChain M where
  P := binomialKernel M p
  nonneg := binomial_nonneg h0 h1
  rowSum := binomial_rowSum
  favored i := by rw [binomial_mean]; exact hfav i
  absorb_zero := binomial_absorb_zero hz
  absorb_last := binomial_absorb_last hl
  escape := binomial_escape h0 h1 hlt

end binomial

/-- Wright–Fisher with selection: a mutant of relative fitness `1 + s` among `i` of `M` copies is
drawn with probability `(1+s) i / ((1+s) i + (M - i)) = (1+s) i / (M + s i)`. -/
noncomputable def wfSelProb (M : ℕ) (s : ℝ) (i : Fin (M + 1)) : ℝ :=
  (1 + s) * ((i : ℕ) : ℝ) / ((M : ℝ) + s * ((i : ℕ) : ℝ))

section wfSel

variable {M : ℕ} {s : ℝ}

lemma wfSel_denom_pos (hM : 0 < M) (hs : 0 ≤ s) (i : Fin (M + 1)) :
    0 < (M : ℝ) + s * ((i : ℕ) : ℝ) := by
  have hMpos : (0 : ℝ) < M := by exact_mod_cast hM
  have := mul_nonneg hs (Nat.cast_nonneg (i : ℕ))
  linarith

lemma wfSel_i_le (i : Fin (M + 1)) : ((i : ℕ) : ℝ) ≤ M := by
  exact_mod_cast Nat.le_of_lt_succ i.isLt

lemma wfSel_nonneg (hM : 0 < M) (hs : 0 ≤ s) (i : Fin (M + 1)) : 0 ≤ wfSelProb M s i :=
  div_nonneg (mul_nonneg (by linarith) (Nat.cast_nonneg _)) (wfSel_denom_pos hM hs i).le

lemma wfSel_le_one (hM : 0 < M) (hs : 0 ≤ s) (i : Fin (M + 1)) : wfSelProb M s i ≤ 1 := by
  unfold wfSelProb
  rw [div_le_one (wfSel_denom_pos hM hs i)]
  have := wfSel_i_le i
  nlinarith

lemma wfSel_zero : wfSelProb M s 0 = 0 := by
  simp [wfSelProb]

lemma wfSel_last (hM : 0 < M) (hs : 0 ≤ s) : wfSelProb M s (Fin.last M) = 1 := by
  unfold wfSelProb
  have hne := (wfSel_denom_pos hM hs (Fin.last M)).ne'
  rw [div_eq_one_iff_eq hne]
  simp only [Fin.val_last]
  ring

lemma wfSel_lt_one (hM : 0 < M) (hs : 0 ≤ s) (i : Fin (M + 1)) (hi : i ≠ Fin.last M) :
    wfSelProb M s i < 1 := by
  unfold wfSelProb
  rw [div_lt_one (wfSel_denom_pos hM hs i)]
  have hle := wfSel_i_le i
  have hne : ((i : ℕ) : ℝ) ≠ M := by
    intro h0
    exact hi (Fin.ext (by exact_mod_cast h0 : (i : ℕ) = M))
  have hlt : ((i : ℕ) : ℝ) < M := lt_of_le_of_ne hle hne
  nlinarith

/-- With `s ≥ 0` the expected mutant count never decreases: `M · p i ≥ i`. -/
lemma wfSel_favored (hM : 0 < M) (hs : 0 ≤ s) (i : Fin (M + 1)) :
    ((i : ℕ) : ℝ) ≤ (M : ℝ) * wfSelProb M s i := by
  unfold wfSelProb
  rw [mul_div_assoc', le_div_iff₀ (wfSel_denom_pos hM hs i)]
  have hle := wfSel_i_le i
  have h := mul_nonneg (mul_nonneg hs (Nat.cast_nonneg (i : ℕ))) (sub_nonneg.mpr hle)
  nlinarith

end wfSel

/-- The Wright–Fisher chain with selection coefficient `s ≥ 0` on `M` gene copies. -/
noncomputable def wrightFisherSelection (M : ℕ) (hM : 0 < M) (s : ℝ) (hs : 0 ≤ s) : FavoredChain M :=
  binomialChain M (wfSelProb M s) (wfSel_nonneg hM hs) (wfSel_le_one hM hs) wfSel_zero
    (wfSel_last hM hs) (wfSel_lt_one hM hs) (wfSel_favored hM hs)

/-- **A new mutant that selection does not oppose fixes with probability at least `1 / M`** under
Wright–Fisher sampling, for every `s ≥ 0`. -/
theorem wrightFisherSelection_fixation_one_ge (M : ℕ) (hM : 0 < M) (s : ℝ) (hs : 0 ≤ s) :
    1 / (M : ℝ) ≤ (wrightFisherSelection M hM s hs).fixationProbability (oneCopy M hM) := by
  have h := (wrightFisherSelection M hM s hs).fixationProbability_ge hM (oneCopy M hM)
  simpa [oneCopy] using h

/-- The neutral Wright–Fisher chain, viewed as a favored chain, has the same `fixedBy`. -/
theorem wrightFisher_toFavored_fixedBy (M : ℕ) (hM : 0 < M) (t : ℕ) (i : Fin (M + 1)) :
    (wrightFisher M hM).toFavored.fixedBy t i = (wrightFisher M hM).fixedBy t i := rfl

/-! ### Expected substitutions over `T` generations -/

/-- Expected number of substitutions over `T` generations: Kimura's rate `M μ u` (new mutants per
generation × fixation probability of each, independent fates) summed over `T` generations. A
definition, not a theorem: linkage, interference and changing `M` are excluded by it. -/
def expectedSubstitutions (M : ℕ) (μ u : ℝ) (T : ℕ) : ℝ := substitutionRate M μ u * T

/-- **The neutral budget is `μ T`, whatever the population size.** -/
theorem neutral_expectedSubstitutions (M : ℕ) (hM : 0 < M) (μ : ℝ) (T : ℕ) :
    expectedSubstitutions M μ ((wrightFisher M hM).fixationProbability (oneCopy M hM)) T = μ * T := by
  rw [expectedSubstitutions, neutral_substitution_rate]

/-- **Floor:** for any favored chain (neutral, or selection for the mutant) the expected number of
substitutions over `T` generations is at least the neutral budget `μ T`. -/
theorem favored_expectedSubstitutions_ge (M : ℕ) (hM : 0 < M) (C : FavoredChain M) (μ : ℝ)
    (hμ : 0 ≤ μ) (T : ℕ) :
    μ * T ≤ expectedSubstitutions M μ (C.fixationProbability (oneCopy M hM)) T := by
  have hMpos : (0 : ℝ) < M := by exact_mod_cast hM
  have hu := C.fixationProbability_ge hM (oneCopy M hM)
  simp only [oneCopy, Nat.cast_one] at hu
  have hT : (0 : ℝ) ≤ T := Nat.cast_nonneg T
  have h1 : μ ≤ (M : ℝ) * μ * C.fixationProbability (oneCopy M hM) := by
    have : (M : ℝ) * μ * (1 / M) = μ := by field_simp
    calc μ = (M : ℝ) * μ * (1 / M) := this.symm
      _ ≤ (M : ℝ) * μ * C.fixationProbability (oneCopy M hM) :=
          mul_le_mul_of_nonneg_left hu (mul_nonneg hMpos.le hμ)
  unfold expectedSubstitutions substitutionRate
  exact mul_le_mul_of_nonneg_right h1 hT

/-- **Ceiling:** with any fixation probability `u ≤ 1`, the expected number of substitutions over
`T` generations is at most the mutation supply `M μ T`. This is where the population size enters. -/
theorem expectedSubstitutions_le (M : ℕ) (μ u : ℝ) (hμ : 0 ≤ μ) (hu : u ≤ 1) (T : ℕ) :
    expectedSubstitutions M μ u T ≤ (M : ℝ) * μ * T := by
  unfold expectedSubstitutions substitutionRate
  have hT : (0 : ℝ) ≤ T := Nat.cast_nonneg T
  have hMμ : 0 ≤ (M : ℝ) * μ := mul_nonneg (Nat.cast_nonneg M) hμ
  calc (M : ℝ) * μ * u * T ≤ (M : ℝ) * μ * 1 * T :=
        mul_le_mul_of_nonneg_right (mul_le_mul_of_nonneg_left hu hMμ) hT
    _ = (M : ℝ) * μ * T := by ring

/-- The two bounds together, for Wright–Fisher with any `s ≥ 0`: `μ T ≤ E[substitutions] ≤ M μ T`. -/
theorem wrightFisherSelection_substitutions_bounds (M : ℕ) (hM : 0 < M) (s : ℝ) (hs : 0 ≤ s)
    (μ : ℝ) (hμ : 0 ≤ μ) (T : ℕ) :
    μ * T ≤ expectedSubstitutions M μ
        ((wrightFisherSelection M hM s hs).fixationProbability (oneCopy M hM)) T ∧
      expectedSubstitutions M μ
        ((wrightFisherSelection M hM s hs).fixationProbability (oneCopy M hM)) T ≤ (M : ℝ) * μ * T :=
  ⟨favored_expectedSubstitutions_ge M hM _ μ hμ T,
    expectedSubstitutions_le M μ _ hμ ((wrightFisherSelection M hM s hs).fixationProbability_le_one _) T⟩

end Delphi
