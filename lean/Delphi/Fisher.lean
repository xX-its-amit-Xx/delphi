/-
# Fisher (1930): the fundamental theorem of natural selection, partial-change form

Claim `fisher-ftns` in `math-bio-theorems/claims/key-claims.json`:

> The rate of increase in mean fitness of a population due to natural selection equals its
> additive genetic variance in fitness at that time.
> Δ_NS w̄ = V_A(w) / w̄ (discrete generations).

Source: Fisher, R. A. (1930). The Genetical Theory of Natural Selection. Clarendon Press.
Partial-change reading: Price (1972), doi:10.1111/j.1469-1809.1972.tb00764.x; Ewens (1989),
doi:10.1016/0040-5809(89)90028-2.

## What is proved here, and from what

The simplest population in which the theorem has content: **one locus with finitely many
alleles (types) in a haploid or clonal population**, discrete non-overlapping generations.

* `p : ι → ℝ` is the frequency of each type (`∑ p = 1`, `p ≥ 0`);
* `w : ι → ℝ` is the (absolute) fitness of each type, `w ≥ 0`, with mean fitness
  `w̄ = ∑ p i * w i > 0`;
* selection sets next generation's frequencies to `p' i = p i * w i / w̄` (`Delphi.select`).

**Partial change** (Price 1972, Ewens 1989) means the fitnesses `w` are held fixed while the
frequencies change, so no frequency dependence and no environmental change enter. With that,
`Delphi.fisher_fundamental_theorem` proves

  `meanFitness (select p w) w - meanFitness p w = variance p w / meanFitness p w`,

where `variance p w = ∑ p i * (w i - w̄)^2` is the variance in fitness. In a haploid or clonal
population every type breeds true, so the genetic variance in fitness **is** the additive
genetic variance `V_A`: there is no dominance or epistasis to subtract. That is why this
instance of the theorem is exact rather than a partial-change bookkeeping identity.

`Delphi.mean_fitness_nondecreasing` is the corollary Fisher emphasised: under fixed fitnesses
mean fitness never falls.

## Physical assumptions left outside

* Haploid / clonal inheritance (one locus, no segregation, no recombination). The diploid
  theorem needs the average-effect decomposition and holds only for the additive component;
  that version is not formalised here.
* Fitnesses constant within a generation and across the step (partial change). The claim's
  context says the theorem is **false** for the *total* change under dominance, epistasis,
  frequency dependence or a changing environment, and nothing here contradicts that.
* Infinite population (deterministic frequencies, no drift).

No `sorry`, no additional axioms: see `lean/Delphi/Audit.lean` and the build report.
-/
import Mathlib

open Finset

namespace Delphi

variable {ι : Type*} [Fintype ι]

/-- Mean fitness `w̄ = ∑ p i * w i`. -/
def meanFitness (p w : ι → ℝ) : ℝ := ∑ i, p i * w i

/-- Variance in fitness `∑ p i * (w i - w̄)^2`. For a haploid locus this is the additive genetic
variance in fitness, since each type breeds true. -/
def variance (p w : ι → ℝ) : ℝ := ∑ i, p i * (w i - meanFitness p w) ^ 2

/-- One generation of selection with fixed fitnesses: `p' i = p i * w i / w̄`. -/
noncomputable def select (p w : ι → ℝ) : ι → ℝ := fun i => p i * w i / meanFitness p w

/-- A frequency vector: nonnegative and summing to one. -/
structure IsFreq (p : ι → ℝ) : Prop where
  nonneg : ∀ i, 0 ≤ p i
  sum_one : ∑ i, p i = 1

/-- Selection returns a frequency vector when fitnesses are nonnegative and mean fitness is
positive. -/
theorem select_isFreq {p w : ι → ℝ} (hp : IsFreq p) (hw : ∀ i, 0 ≤ w i)
    (hmean : 0 < meanFitness p w) : IsFreq (select p w) where
  nonneg i := div_nonneg (mul_nonneg (hp.nonneg i) (hw i)) hmean.le
  sum_one := by
    unfold select
    rw [← Finset.sum_div, div_eq_one_iff_eq hmean.ne']
    rfl

/-- The variance identity `Var = E[w²] - w̄²`, which needs `∑ p = 1`. -/
lemma variance_eq {p w : ι → ℝ} (hp : IsFreq p) :
    variance p w = (∑ i, p i * w i ^ 2) - meanFitness p w ^ 2 := by
  unfold variance
  have h1 : ∑ i, p i * (w i - meanFitness p w) ^ 2
      = ∑ i, (p i * w i ^ 2 - 2 * meanFitness p w * (p i * w i) + meanFitness p w ^ 2 * p i) := by
    apply Finset.sum_congr rfl; intro i _; ring
  rw [h1, Finset.sum_add_distrib, Finset.sum_sub_distrib, ← Finset.mul_sum, ← Finset.mul_sum,
    hp.sum_one]
  unfold meanFitness
  ring

/-- **Fisher's fundamental theorem of natural selection** (haploid locus, partial change).
The change in mean fitness over one generation of selection, with fitnesses held fixed, equals
the variance in fitness divided by the mean fitness. -/
theorem fisher_fundamental_theorem {p w : ι → ℝ} (hp : IsFreq p)
    (hmean : 0 < meanFitness p w) :
    meanFitness (select p w) w - meanFitness p w = variance p w / meanFitness p w := by
  have hne := hmean.ne'
  rw [variance_eq hp]
  have h : meanFitness (select p w) w = (∑ i, p i * w i ^ 2) / meanFitness p w := by
    show ∑ i, (p i * w i / meanFitness p w) * w i = _
    rw [Finset.sum_div]
    apply Finset.sum_congr rfl; intro i _; ring
  rw [h]
  field_simp

/-- The same statement in the form Fisher wrote it: `Δ w̄ · w̄ = V`. -/
theorem fisher_fundamental_theorem' {p w : ι → ℝ} (hp : IsFreq p)
    (hmean : 0 < meanFitness p w) :
    (meanFitness (select p w) w - meanFitness p w) * meanFitness p w = variance p w := by
  rw [fisher_fundamental_theorem hp hmean, div_mul_cancel₀ _ hmean.ne']

/-- Corollary: under fixed fitnesses, mean fitness never decreases. -/
theorem mean_fitness_nondecreasing {p w : ι → ℝ} (hp : IsFreq p)
    (hmean : 0 < meanFitness p w) :
    meanFitness p w ≤ meanFitness (select p w) w := by
  have hvar : 0 ≤ variance p w :=
    Finset.sum_nonneg fun i _ => mul_nonneg (hp.nonneg i) (sq_nonneg _)
  have := fisher_fundamental_theorem hp hmean
  have : 0 ≤ meanFitness (select p w) w - meanFitness p w := by
    rw [this]; exact div_nonneg hvar hmean.le
  linarith

end Delphi
