/-
# Maynard Smith (1978): the twofold cost of sex

Claim `maynardsmith-twofold-cost` in `math-bio-theorems/claims/key-claims.json`:

> An asexual mutant female in a sexual population with equal sex ratio produces twice as many
> grandchildren as a sexual female, so sex needs a compensating advantage of up to twofold to
> persist.
> With equal fecundity and a 1:1 sex ratio, the odds of asexual to sexual females double each
> generation: q_{t+1} / (1 - q_{t+1}) = 2 q_t / (1 - q_t).

Source: Maynard Smith, J. (1978). The Evolution of Sex. Cambridge University Press.

## What is proved here, and from what

A population of females in which a fraction `q` are asexual (parthenogenetic) and `1 - q` are
sexual. Every female has the same fecundity `f > 0` and the same offspring viability. An asexual
female's offspring are all daughters. A sexual female's offspring are sons and daughters in the
ratio `1 : 1`, so half of her `f` offspring are daughters. Males contribute no resources
(anisogamy), so they add nothing to the count of daughters.

`Delphi.asexualNext q f` is the asexual fraction among next generation's females:

  (q · f) / (q · f + (1 - q) · f / 2).

`Delphi.twofold_cost_of_sex` proves the odds identity in the claim's notation, exactly:

  asexualNext q f / (1 - asexualNext q f) = 2 · (q / (1 - q))     for 0 < q < 1, f > 0.

`Delphi.twofold_cost_of_sex_n` iterates it: after `n` generations the odds are `2 ^ n` times the
initial odds, which is the "needs a compensating advantage of up to twofold" clause made exact:
a sexual female would need to double her daughters' number (or their viability) per generation to
hold the odds constant. Fecundity `f` cancels, as the claim says.

## Physical assumptions left outside

* Anisogamy with males contributing nothing to offspring number or survival.
* Equal fecundity and viability of sexual and asexual females, and of their daughters.
* A primary sex ratio of exactly `1 : 1` in sexual broods.
* Discrete, non-overlapping generations, infinite population (deterministic fractions).

No `sorry`, no additional axioms: see `lean/Delphi/Audit.lean` and the build report.
-/
import Mathlib

namespace Delphi

/-- Fraction of asexual females in the next generation, given fraction `q` now and fecundity
`f` for every female. Asexual females have `f` daughters; sexual females have `f / 2` daughters
and `f / 2` sons. -/
noncomputable def asexualNext (q f : ℝ) : ℝ := q * f / (q * f + (1 - q) * f / 2)

/-- Odds of a fraction `q`: `q / (1 - q)`. -/
noncomputable def odds (q : ℝ) : ℝ := q / (1 - q)

/-- **Twofold cost of sex.** With equal fecundity and a `1 : 1` sex ratio, the odds of asexual to
sexual females double every generation. Fecundity cancels. -/
theorem twofold_cost_of_sex {q f : ℝ} (hq0 : 0 < q) (hq1 : q < 1) (hf : 0 < f) :
    odds (asexualNext q f) = 2 * odds q := by
  have h1q : 0 < 1 - q := by linarith
  have hden : 0 < q * f + (1 - q) * f / 2 := by positivity
  unfold odds asexualNext
  have hne : 1 - q * f / (q * f + (1 - q) * f / 2) ≠ 0 := by
    rw [sub_ne_zero]
    intro h
    rw [eq_div_iff hden.ne'] at h
    have : 0 < (1 - q) * f / 2 := by positivity
    linarith
  rw [div_eq_iff hne]
  field_simp
  ring

/-- The next-generation fraction stays strictly between `0` and `1`, so the identity can be
iterated. -/
theorem asexualNext_mem {q f : ℝ} (hq0 : 0 < q) (hq1 : q < 1) (hf : 0 < f) :
    0 < asexualNext q f ∧ asexualNext q f < 1 := by
  have h1q : 0 < 1 - q := by linarith
  have hden : 0 < q * f + (1 - q) * f / 2 := by positivity
  unfold asexualNext
  constructor
  · positivity
  · rw [div_lt_one hden]
    have : 0 < (1 - q) * f / 2 := by positivity
    linarith

/-- Fraction of asexual females after `n` generations. -/
noncomputable def asexualAfter (q f : ℝ) : ℕ → ℝ
  | 0 => q
  | n + 1 => asexualNext (asexualAfter q f n) f

theorem asexualAfter_mem {q f : ℝ} (hq0 : 0 < q) (hq1 : q < 1) (hf : 0 < f) (n : ℕ) :
    0 < asexualAfter q f n ∧ asexualAfter q f n < 1 := by
  induction n with
  | zero => exact ⟨hq0, hq1⟩
  | succ n ih => exact asexualNext_mem ih.1 ih.2 hf

/-- After `n` generations the odds of asexual to sexual females are `2 ^ n` times the initial
odds: an asexual lineage doubles its relative share every generation unless sex brings a
compensating twofold advantage. -/
theorem twofold_cost_of_sex_n {q f : ℝ} (hq0 : 0 < q) (hq1 : q < 1) (hf : 0 < f) (n : ℕ) :
    odds (asexualAfter q f n) = 2 ^ n * odds q := by
  induction n with
  | zero => simp [asexualAfter]
  | succ n ih =>
    have hm := asexualAfter_mem hq0 hq1 hf n
    rw [asexualAfter, twofold_cost_of_sex hm.1 hm.2 hf, ih, pow_succ]
    ring

end Delphi
