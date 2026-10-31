/-
# Thompson (1917): weight varies as the cube of a linear dimension

Claim `thompson1917-ch03-07` (On Growth and Form, chapter III): during growth, weight tends to vary
as the cube of a linear dimension, so the weight curve is approximately the cube of the stature curve.

## What is proved

* `CubeLaw W k`: a family of bodies of linear size `L` whose weight is `W L = k L^3` with `k > 0`
  (isometric growth at constant density: the shape and the density do not change, so weight is
  proportional to volume and volume to the cube of any linear dimension).
* `cubeLaw_loglog_exponent`: for any two sizes `L₁ ≠ L₂` the log-log slope
  `(log W L₂ - log W L₁) / (log L₂ - log L₁)` equals exactly `3`. This is the quantity the claim test
  measures (`claim-tests/thompson-growth-form/thompson1917-ch03-07`).
* `cubeLaw_ratio`: equivalently `W L₂ / W L₁ = (L₂ / L₁)^3`.
* `not_cubeLaw_of_exponent_ne_three`: the contrapositive the data test uses. If two measured sizes
  give a log-log slope different from `3`, then no `k` makes the family a cube law: the growth is not
  isometric at constant density on that interval.

## What is assumed, not proved

* "Linear dimension" and "weight" are read as a single length `L` and mass `W` of the same body family;
  density constant and shape fixed are what `W = k L^3` encodes. Thompson's "mainly (though not wholly)"
  is not formalised: the theorem is exact, the law is approximate, and the tolerance band
  `[2.5, 3.5]` used by the claim test is a decision rule outside this module.
* Nothing about any dataset: the measured exponents (NHANES age-bin means, claims thread) live in the
  claim test's result files and are pointed to from the record, not derived here.
-/
import Mathlib

open Real

namespace Delphi

/-- Isometric growth at constant density: weight is `k` times the cube of the linear dimension. -/
def CubeLaw (W : ℝ → ℝ) (k : ℝ) : Prop := 0 < k ∧ ∀ L, 0 < L → W L = k * L ^ 3

/-- The log-log slope between two sizes. -/
noncomputable def logSlope (W : ℝ → ℝ) (L₁ L₂ : ℝ) : ℝ := (log (W L₂) - log (W L₁)) / (log L₂ - log L₁)

lemma cubeLaw_pos {W : ℝ → ℝ} {k : ℝ} (h : CubeLaw W k) {L : ℝ} (hL : 0 < L) : 0 < W L := by
  rw [h.2 L hL]
  have := h.1
  positivity

/-- **Weight ratio is the cube of the size ratio.** -/
theorem cubeLaw_ratio {W : ℝ → ℝ} {k : ℝ} (h : CubeLaw W k) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    W L₂ / W L₁ = (L₂ / L₁) ^ 3 := by
  rw [h.2 L₁ h₁, h.2 L₂ h₂, div_pow, mul_div_mul_left _ _ h.1.ne']

/-- **The log-log exponent of a cube law is exactly 3.** -/
theorem cubeLaw_loglog_exponent {W : ℝ → ℝ} {k : ℝ} (h : CubeLaw W k) {L₁ L₂ : ℝ} (h₁ : 0 < L₁)
    (h₂ : 0 < L₂) (hne : L₁ ≠ L₂) : logSlope W L₁ L₂ = 3 := by
  have hlog : log L₂ - log L₁ ≠ 0 := by
    intro h0
    exact hne (log_injOn_pos h₂ h₁ (sub_eq_zero.mp h0)).symm
  unfold logSlope
  rw [div_eq_iff hlog, h.2 L₁ h₁, h.2 L₂ h₂, log_mul h.1.ne' (pow_ne_zero 3 h₂.ne'),
    log_mul h.1.ne' (pow_ne_zero 3 h₁.ne'), log_pow, log_pow]
  push_cast
  ring

/-- **What a measured exponent other than 3 refutes.** If two sizes give a log-log slope `b ≠ 3`, the
family is not a cube law for any constant `k`. -/
theorem not_cubeLaw_of_exponent_ne_three {W : ℝ → ℝ} {L₁ L₂ b : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂)
    (hne : L₁ ≠ L₂) (hb : logSlope W L₁ L₂ = b) (hb3 : b ≠ 3) : ∀ k, ¬ CubeLaw W k :=
  fun _ hk => hb3 (hb ▸ cubeLaw_loglog_exponent hk h₁ h₂ hne)

end Delphi
