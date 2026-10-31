/-
# Kimura (1968): the neutral substitution rate equals the mutation rate

Claim `kimura-substitution-rate` in `math-bio-theorems/claims/key-claims.json`:

> For neutral mutations the long-run rate of molecular substitution equals the mutation rate
> per generation, independent of population size, which yields a molecular clock.
> k = 2Nμ · 1/(2N) = μ.

Source: Kimura, M. (1968). Evolutionary rate at the molecular level. Nature 217, 624–626.
doi:10.1038/217624a0.

## What is proved here, and from what

The law is a corollary of the *neutral fixation probability*: a neutral mutant present in `i`
of `M` gene copies (`M = 2N` for a diploid population of size `N`) is eventually fixed with
probability `i / M`, so a single new mutant fixes with probability `1 / M`. With `M μ` new
mutants arising per generation, the substitution rate is `M μ · (1 / M) = μ`, whatever `M` is.

The fixation probability is **proved, not assumed**. `Delphi.NeutralChain` is a finite Markov
chain on `{0, …, M}` copies with four explicit assumptions:

* `rowSum`, `nonneg`: `P` is a stochastic matrix (each row is a probability distribution);
* `neutral`: the expected number of copies in the next generation equals the current number
  (no selection: `∑ j, P i j * j = i`);
* `absorb_zero`, `absorb_last`: `0` and `M` copies are absorbing states (no back mutation
  within a lineage's fate);
* `escape`: from every intermediate state the chain can be absorbed in one step with positive
  probability.

Theorem `fixedBy_tendsto` shows that the probability of being fixed by generation `t`
converges to `i / M` as `t → ∞`, with the explicit bound `|fixedBy t - i/M| ≤ ρ ^ t` for some
`ρ < 1` (`fixedBy_sub_le`). The proof is the martingale argument made elementary: the mean
copy number is conserved generation to generation, while the probability of still being
unresolved decays geometrically.

`Delphi.wrightFisher` instantiates the chain with the Wright–Fisher model: the next
generation's copy number is Binomial(`M`, `i / M`). Its four properties are proved from the
binomial formula (via Mathlib's Bernstein polynomials, which are exactly the binomial
probabilities as polynomials in `p`).

## Physical assumptions left outside the kernel

* **Strict neutrality** of the mutations (encoded as `neutral`).
* **Constant population size** `M` across generations (the chain is time-homogeneous).
* **Wright–Fisher reproduction** (non-overlapping generations, multinomial sampling).
* **Independent fates of mutants**: the substitution rate is *defined*, as in Kimura's paper,
  as (number of new mutants per generation) × (fixation probability of one mutant), i.e.
  `substitutionRate M μ u = M * μ * u`. This is where "no interference between lineages" and
  "mutation rate `μ` constant per copy per generation" enter. The theorem shows the
  definition evaluates to `μ` once `u` is the proved Wright–Fisher fixation probability.
* "Long-run / steady state" is captured by taking the `t → ∞` limit of the fixation
  probability.

Whether real genomes satisfy these assumptions is an empirical question (see the claim's
`proposed_test`); this file settles only that the law follows from them.

No `sorry`, no additional axioms: see `lean/Delphi/Audit.lean` and the build report.
-/
import Mathlib

open Finset Filter Topology Matrix

namespace Delphi

/-- A neutral, absorbing Markov chain on `Fin (M+1)`: the number of mutant gene copies
among `M`. `P i j` is the probability of going from `i` copies to `j` copies in one
generation. -/
structure NeutralChain (M : ℕ) where
  /-- One-generation transition matrix. -/
  P : Matrix (Fin (M + 1)) (Fin (M + 1)) ℝ
  /-- Probabilities are nonnegative. -/
  nonneg : ∀ i j, 0 ≤ P i j
  /-- Each row is a probability distribution. -/
  rowSum : ∀ i, ∑ j, P i j = 1
  /-- Neutrality: the expected copy number is conserved, `E[X_{t+1} | X_t = i] = i`. -/
  neutral : ∀ i, ∑ j, P i j * ((j : ℕ) : ℝ) = ((i : ℕ) : ℝ)
  /-- Loss (`0` copies) is absorbing. -/
  absorb_zero : ∀ j, P 0 j = if j = 0 then 1 else 0
  /-- Fixation (`M` copies) is absorbing. -/
  absorb_last : ∀ j, P (Fin.last M) j = if j = Fin.last M then 1 else 0
  /-- From any intermediate state, absorption in one step has positive probability. -/
  escape : ∀ i : Fin (M + 1), i ≠ 0 → i ≠ Fin.last M → 0 < P i 0 + P i (Fin.last M)

namespace NeutralChain

variable {M : ℕ} (C : NeutralChain M)

/-! ### The `t`-step chain is still stochastic and still neutral -/

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

lemma pow_neutral (t : ℕ) (i : Fin (M + 1)) :
    ∑ j, (C.P ^ t) i j * ((j : ℕ) : ℝ) = ((i : ℕ) : ℝ) := by
  induction t generalizing i with
  | zero => simp [Matrix.one_apply]
  | succ t ih =>
    simp only [pow_succ, Matrix.mul_apply, Finset.sum_mul]
    rw [Finset.sum_comm]
    simp_rw [mul_assoc, ← Finset.mul_sum, C.neutral]
    exact ih i

/-! ### Intermediate states and the probability of still being unresolved -/

/-- The intermediate (transient) states: neither lost nor fixed. -/
def interior (M : ℕ) : Finset (Fin (M + 1)) :=
  univ.filter fun j => j ≠ 0 ∧ j ≠ Fin.last M

lemma mem_interior {j : Fin (M + 1)} : j ∈ interior M ↔ j ≠ 0 ∧ j ≠ Fin.last M := by
  simp [interior]

lemma zero_ne_last (hM : 0 < M) : (0 : Fin (M + 1)) ≠ Fin.last M := by
  intro h
  have := congrArg Fin.val h
  simp at this
  omega

/-- Splitting a sum over all states into the two absorbing states and the interior. -/
lemma sum_split (hM : 0 < M) (f : Fin (M + 1) → ℝ) :
    ∑ j, f j = f 0 + f (Fin.last M) + ∑ j ∈ interior M, f j := by
  have hsplit := Finset.sum_filter_add_sum_filter_not univ (fun j : Fin (M + 1) => j ≠ 0 ∧ j ≠ Fin.last M) f
  have hpair : univ.filter (fun j : Fin (M + 1) => ¬(j ≠ 0 ∧ j ≠ Fin.last M)) = {0, Fin.last M} := by
    ext j; simp [or_comm]
    tauto
  rw [interior, ← hsplit, hpair, Finset.sum_pair (zero_ne_last hM)]
  ring

/-- Probability of leaving the interior in one step is at most `ρ < 1`, uniformly. -/
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

lemma unresolved_nonneg (t : ℕ) (i : Fin (M + 1)) : 0 ≤ C.unresolved t i :=
  Finset.sum_nonneg fun j _ => C.pow_nonneg t i j

lemma unresolved_le_one (t : ℕ) (i : Fin (M + 1)) : C.unresolved t i ≤ 1 := by
  rw [← C.pow_rowSum t i]
  exact Finset.sum_le_sum_of_subset_of_nonneg (Finset.subset_univ _)
    (fun j _ _ => C.pow_nonneg t i j)

/-- Absorbing states never re-enter the interior. -/
lemma absorbing_sum_interior (k : Fin (M + 1)) (hk : k = 0 ∨ k = Fin.last M) :
    ∑ j ∈ interior M, C.P k j = 0 := by
  apply Finset.sum_eq_zero
  intro j hj
  have hj' := mem_interior.mp hj
  rcases hk with rfl | rfl
  · rw [C.absorb_zero]; simp [hj'.1]
  · rw [C.absorb_last]; simp [hj'.2]

/-- The unresolved probability contracts by `ρ` every generation. -/
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

/-! ### Fixation -/

/-- Probability that a lineage starting from `i` copies is fixed (all `M` copies) by
generation `t`. -/
def fixedBy (t : ℕ) (i : Fin (M + 1)) : ℝ := (C.P ^ t) i (Fin.last M)

/-- Conservation of the mean splits as: `M · P(fixed by t) + E[copies · 1{unresolved}] = i`. -/
lemma mean_decomposition (hM : 0 < M) (t : ℕ) (i : Fin (M + 1)) :
    (M : ℝ) * C.fixedBy t i + ∑ j ∈ interior M, (C.P ^ t) i j * ((j : ℕ) : ℝ)
      = ((i : ℕ) : ℝ) := by
  have h := C.pow_neutral t i
  rw [sum_split hM] at h
  simp only [Fin.val_zero, Nat.cast_zero, mul_zero, zero_add, Fin.val_last] at h
  rw [fixedBy, mul_comm]
  exact h

/-- The error of `fixedBy` against `i / M` is at most the unresolved probability. -/
lemma fixedBy_sub_le_unresolved (hM : 0 < M) (t : ℕ) (i : Fin (M + 1)) :
    |C.fixedBy t i - ((i : ℕ) : ℝ) / M| ≤ C.unresolved t i := by
  have hMpos : (0 : ℝ) < M := by exact_mod_cast hM
  have hdec := C.mean_decomposition hM t i
  set S := ∑ j ∈ interior M, (C.P ^ t) i j * ((j : ℕ) : ℝ) with hS
  have hS0 : 0 ≤ S :=
    Finset.sum_nonneg fun j _ => mul_nonneg (C.pow_nonneg t i j) (Nat.cast_nonneg _)
  have hSM : S ≤ (M : ℝ) * C.unresolved t i := by
    rw [unresolved, Finset.mul_sum]
    apply Finset.sum_le_sum
    intro j _
    rw [mul_comm (M : ℝ)]
    apply mul_le_mul_of_nonneg_left _ (C.pow_nonneg t i j)
    exact_mod_cast Nat.le_of_lt_succ j.isLt
  have : C.fixedBy t i - ((i : ℕ) : ℝ) / M = -(S / M) := by
    field_simp
    linarith
  rw [this, abs_neg, abs_of_nonneg (div_nonneg hS0 hMpos.le), div_le_iff₀ hMpos]
  linarith

/-- **Neutral fixation probability (quantitative form).** For some `ρ < 1`, the probability of
fixation by generation `t` is within `ρ ^ t` of `i / M`. -/
theorem fixedBy_sub_le (hM : 0 < M) :
    ∃ ρ : ℝ, 0 ≤ ρ ∧ ρ < 1 ∧
      ∀ t (i : Fin (M + 1)), |C.fixedBy t i - ((i : ℕ) : ℝ) / M| ≤ ρ ^ t := by
  obtain ⟨ρ, hρ0, hρ1, hρ⟩ := C.exists_contraction hM
  exact ⟨ρ, hρ0, hρ1, fun t i =>
    (C.fixedBy_sub_le_unresolved hM t i).trans (C.unresolved_le_pow hM hρ0 hρ t i)⟩

/-- **Neutral fixation probability (Kimura 1962, neutral case).** A neutral lineage that
starts with `i` of `M` copies is eventually fixed with probability `i / M`. -/
theorem fixedBy_tendsto (hM : 0 < M) (i : Fin (M + 1)) :
    Tendsto (fun t => C.fixedBy t i) atTop (𝓝 (((i : ℕ) : ℝ) / M)) := by
  obtain ⟨ρ, hρ0, hρ1, hρ⟩ := C.fixedBy_sub_le hM
  rw [tendsto_iff_norm_sub_tendsto_zero]
  refine squeeze_zero (fun t => norm_nonneg _) (fun t => ?_)
    (tendsto_pow_atTop_nhds_zero_of_lt_one hρ0 hρ1)
  simpa [Real.norm_eq_abs] using hρ t i

/-- The fixation probability of a lineage starting from `i` copies: the limit of `fixedBy`. -/
noncomputable def fixationProbability (i : Fin (M + 1)) : ℝ :=
  limUnder atTop (fun t => C.fixedBy t i)

theorem fixationProbability_eq (hM : 0 < M) (i : Fin (M + 1)) :
    C.fixationProbability i = ((i : ℕ) : ℝ) / M :=
  (C.fixedBy_tendsto hM i).limUnder_eq

end NeutralChain

/-! ### The Wright–Fisher model is a neutral chain -/

/-- Wright–Fisher sampling: with `i` mutant copies among `M`, the next generation has `j`
mutant copies with probability `C(M, j) (i/M)^j (1 - i/M)^(M-j)`. -/
noncomputable def wfKernel (M : ℕ) : Matrix (Fin (M + 1)) (Fin (M + 1)) ℝ :=
  fun i j => (Nat.choose M j : ℝ) * (((i : ℕ) : ℝ) / M) ^ (j : ℕ) * (1 - ((i : ℕ) : ℝ) / M) ^ (M - j)

lemma wfKernel_eq_bernstein (i j : Fin (M + 1)) :
    wfKernel M i j = (bernsteinPolynomial ℝ M j).eval (((i : ℕ) : ℝ) / M) := by
  simp [wfKernel, bernsteinPolynomial]

lemma wf_p_nonneg (i : Fin (M + 1)) : 0 ≤ ((i : ℕ) : ℝ) / M :=
  div_nonneg (Nat.cast_nonneg _) (Nat.cast_nonneg _)

lemma wf_p_le_one (hM : 0 < M) (i : Fin (M + 1)) : ((i : ℕ) : ℝ) / M ≤ 1 := by
  have hMpos : (0 : ℝ) < M := by exact_mod_cast hM
  rw [div_le_one hMpos]
  exact_mod_cast Nat.le_of_lt_succ i.isLt

lemma wf_rowSum (i : Fin (M + 1)) : ∑ j, wfKernel M i j = 1 := by
  simp_rw [wfKernel_eq_bernstein]
  rw [Fin.sum_univ_eq_sum_range (fun j => (bernsteinPolynomial ℝ M j).eval (((i : ℕ) : ℝ) / M)),
    ← Polynomial.eval_finsetSum, bernsteinPolynomial.sum, Polynomial.eval_one]

lemma wf_neutral (hM : 0 < M) (i : Fin (M + 1)) :
    ∑ j, wfKernel M i j * ((j : ℕ) : ℝ) = ((i : ℕ) : ℝ) := by
  have hMne : (M : ℝ) ≠ 0 := by exact_mod_cast hM.ne'
  simp_rw [wfKernel_eq_bernstein]
  have h := congrArg (Polynomial.eval (((i : ℕ) : ℝ) / M)) (bernsteinPolynomial.sum_smul ℝ M)
  rw [Polynomial.eval_finsetSum] at h
  simp only [nsmul_eq_mul, Polynomial.eval_mul, Polynomial.eval_natCast, Polynomial.eval_X] at h
  rw [Fin.sum_univ_eq_sum_range (fun j => (bernsteinPolynomial ℝ M j).eval (((i : ℕ) : ℝ) / M) * (j : ℝ))]
  calc ∑ j ∈ range (M + 1), (bernsteinPolynomial ℝ M j).eval (((i : ℕ) : ℝ) / M) * (j : ℝ)
      = ∑ j ∈ range (M + 1), (j : ℝ) * (bernsteinPolynomial ℝ M j).eval (((i : ℕ) : ℝ) / M) := by
        simp_rw [mul_comm]
    _ = (M : ℝ) * (((i : ℕ) : ℝ) / M) := h
    _ = ((i : ℕ) : ℝ) := by field_simp

lemma wf_absorb_zero (j : Fin (M + 1)) :
    wfKernel M 0 j = if j = 0 then 1 else 0 := by
  simp only [wfKernel, Fin.val_zero, Nat.cast_zero, zero_div, sub_zero, one_pow, mul_one]
  split_ifs with h
  · subst h; simp
  · have : (j : ℕ) ≠ 0 := fun h0 => h (Fin.ext h0)
    simp [zero_pow this]

lemma wf_absorb_last (hM : 0 < M) (j : Fin (M + 1)) :
    wfKernel M (Fin.last M) j = if j = Fin.last M then 1 else 0 := by
  have hMne : (M : ℝ) ≠ 0 := by exact_mod_cast hM.ne'
  simp only [wfKernel, Fin.val_last, div_self hMne, sub_self, one_pow, mul_one]
  split_ifs with h
  · subst h; simp
  · have : M - (j : ℕ) ≠ 0 := by
      have := j.isLt
      have : (j : ℕ) ≠ M := fun h0 => h (Fin.ext (by simpa using h0))
      omega
    simp [zero_pow this]

lemma wf_escape (hM : 0 < M) (i : Fin (M + 1)) (_hi0 : i ≠ 0) (hiM : i ≠ Fin.last M) :
    0 < wfKernel M i 0 + wfKernel M i (Fin.last M) := by
  have hMpos : (0 : ℝ) < M := by exact_mod_cast hM
  have hlt : ((i : ℕ) : ℝ) < M := by
    have h1 := Nat.le_of_lt_succ i.isLt
    have h2 : (i : ℕ) ≠ M := fun h0 => hiM (Fin.ext (by simpa using h0))
    exact_mod_cast lt_of_le_of_ne h1 h2
  have hpos : 0 < wfKernel M i 0 := by
    simp only [wfKernel, Fin.val_zero, pow_zero, mul_one, Nat.choose_zero_right, Nat.cast_one,
      one_mul, Nat.sub_zero]
    apply pow_pos
    rw [sub_pos, div_lt_one hMpos]
    exact hlt
  have hnn : 0 ≤ wfKernel M i (Fin.last M) := by
    unfold wfKernel
    exact mul_nonneg (mul_nonneg (Nat.cast_nonneg _) (pow_nonneg (wf_p_nonneg i) _))
      (pow_nonneg (sub_nonneg.mpr (wf_p_le_one hM i)) _)
  linarith

/-- The neutral Wright–Fisher chain on `M` gene copies. -/
noncomputable def wrightFisher (M : ℕ) (hM : 0 < M) : NeutralChain M where
  P := wfKernel M
  nonneg i j := by
    unfold wfKernel
    exact mul_nonneg (mul_nonneg (Nat.cast_nonneg _) (pow_nonneg (wf_p_nonneg i) _))
      (pow_nonneg (sub_nonneg.mpr (wf_p_le_one hM i)) _)
  rowSum := wf_rowSum
  neutral := wf_neutral hM
  absorb_zero := wf_absorb_zero
  absorb_last := wf_absorb_last hM
  escape := wf_escape hM

/-- A single new mutant: one copy among `M`. -/
def oneCopy (M : ℕ) (hM : 0 < M) : Fin (M + 1) := ⟨1, by omega⟩

/-- **Wright–Fisher fixation probability of a new neutral mutant is `1 / M`.** -/
theorem wrightFisher_fixation_one (M : ℕ) (hM : 0 < M) :
    (wrightFisher M hM).fixationProbability (oneCopy M hM) = 1 / M := by
  rw [(wrightFisher M hM).fixationProbability_eq hM]
  simp [oneCopy]

/-! ### The substitution rate -/

/-- Kimura's substitution rate: `M μ` new mutants arise per generation (mutation rate `μ`
per copy), and each is fixed with probability `u`. The rate of substitution is their product.
This is the definition in Kimura (1968), eq. for `k`; it assumes mutants' fates are
independent. -/
def substitutionRate (M : ℕ) (μ u : ℝ) : ℝ := (M : ℝ) * μ * u

/-- **Kimura (1968).** Under neutral Wright–Fisher evolution, the substitution rate equals
the mutation rate, for every population size `M`. -/
theorem neutral_substitution_rate (M : ℕ) (hM : 0 < M) (μ : ℝ) :
    substitutionRate M μ ((wrightFisher M hM).fixationProbability (oneCopy M hM)) = μ := by
  have hMne : (M : ℝ) ≠ 0 := by exact_mod_cast hM.ne'
  rw [substitutionRate, wrightFisher_fixation_one]
  field_simp

/-- The same statement for a diploid population of `N` individuals (`M = 2N` gene copies):
`k = 2Nμ · 1/(2N) = μ`, exactly the formula in the claim's notation. -/
theorem neutral_substitution_rate_diploid (N : ℕ) (hN : 0 < N) (μ : ℝ) :
    substitutionRate (2 * N) μ
      ((wrightFisher (2 * N) (by omega)).fixationProbability (oneCopy (2 * N) (by omega))) = μ :=
  neutral_substitution_rate (2 * N) (by omega) μ

/-- Limit form, with no `limUnder`: the expected number of substitutions per generation
attributable to mutants that are fixed by generation `t` converges to `μ`. -/
theorem neutral_substitution_rate_tendsto (M : ℕ) (hM : 0 < M) (μ : ℝ) :
    Tendsto (fun t => substitutionRate M μ ((wrightFisher M hM).fixedBy t (oneCopy M hM)))
      atTop (𝓝 μ) := by
  have hMne : (M : ℝ) ≠ 0 := by exact_mod_cast hM.ne'
  have h := (wrightFisher M hM).fixedBy_tendsto hM (oneCopy M hM)
  have h2 := h.const_mul ((M : ℝ) * μ)
  have hlim : (M : ℝ) * μ * (((oneCopy M hM : ℕ) : ℝ) / M) = μ := by
    simp only [oneCopy, Nat.cast_one]
    field_simp
  rw [hlim] at h2
  exact h2

end Delphi
