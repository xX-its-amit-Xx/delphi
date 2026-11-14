import Mathlib

/-!
Halpin-Tsai modulus sits between the Reuss (series) and Voigt (parallel) rule-of-mixtures bounds.

Closed form used (algebraically equal to E/Em = (1+ξηφ)/(1-ηφ), η = (Ef/Em-1)/(Ef/Em+ξ),
for Ef + ξ Em ≠ 0):
  HT(ξ) = Em (Ef + ξ V) / (D + ξ Em),   V = φ Ef + (1-φ) Em,   D = (1-φ) Ef + φ Em.
Assumptions are named hypotheses: positive phase moduli, 0 ≤ φ ≤ 1, shape factor ξ ≥ 0.
This is algebra about the closed forms only; it does not derive them from elasticity.
-/

namespace HvMat

theorem series_den_pos (φ Em Ef : ℝ) (hφ0 : 0 ≤ φ) (hφ1 : φ ≤ 1) (hm : 0 < Em) (hf : 0 < Ef) :
    0 < (1 - φ) * Ef + φ * Em := by
  rcases hφ0.eq_or_lt with h | h
  · subst h; simpa using hf
  · have h1 := mul_pos h hm
    have h2 := mul_nonneg (sub_nonneg.2 hφ1) hf.le
    linarith

/-- Halpin-Tsai never exceeds the Voigt (parallel) rule of mixtures. -/
theorem halpinTsai_le_voigt (φ Em Ef ξ : ℝ) (hφ0 : 0 ≤ φ) (hφ1 : φ ≤ 1) (hm : 0 < Em)
    (hf : 0 < Ef) (hξ : 0 ≤ ξ) :
    Em * (Ef + ξ * (φ * Ef + (1 - φ) * Em)) / ((1 - φ) * Ef + φ * Em + ξ * Em)
      ≤ φ * Ef + (1 - φ) * Em := by
  have hD := series_den_pos φ Em Ef hφ0 hφ1 hm hf
  have hD2 : 0 < (1 - φ) * Ef + φ * Em + ξ * Em := by
    have := mul_nonneg hξ hm.le
    linarith
  rw [div_le_iff₀ hD2]
  nlinarith [mul_nonneg (mul_nonneg hφ0 (sub_nonneg.2 hφ1)) (sq_nonneg (Ef - Em))]

/-- Halpin-Tsai never falls below the Reuss (series) rule of mixtures. -/
theorem reuss_le_halpinTsai (φ Em Ef ξ : ℝ) (hφ0 : 0 ≤ φ) (hφ1 : φ ≤ 1) (hm : 0 < Em)
    (hf : 0 < Ef) (hξ : 0 ≤ ξ) :
    Em * Ef / ((1 - φ) * Ef + φ * Em)
      ≤ Em * (Ef + ξ * (φ * Ef + (1 - φ) * Em)) / ((1 - φ) * Ef + φ * Em + ξ * Em) := by
  have hD := series_den_pos φ Em Ef hφ0 hφ1 hm hf
  have hD2 : 0 < (1 - φ) * Ef + φ * Em + ξ * Em := by
    have := mul_nonneg hξ hm.le
    linarith
  rw [div_le_iff₀ hD, div_mul_eq_mul_div, le_div_iff₀ hD2]
  nlinarith [mul_nonneg (mul_nonneg hξ hm.le)
    (mul_nonneg (mul_nonneg hφ0 (sub_nonneg.2 hφ1)) (sq_nonneg (Ef - Em)))]

/-- At shape factor ξ = 0 Halpin-Tsai is exactly the Reuss (series) formula. -/
theorem halpinTsai_zero (φ Em Ef : ℝ) :
    Em * (Ef + 0 * (φ * Ef + (1 - φ) * Em)) / ((1 - φ) * Ef + φ * Em + 0 * Em)
      = Em * Ef / ((1 - φ) * Ef + φ * Em) := by
  simp

/-- Gibson-Ashby open-cell scaling E = C Es (ρ/ρs)^2: doubling density quadruples stiffness. -/
theorem gibsonAshby_double (C Es ρ ρs : ℝ) :
    C * Es * ((2 * ρ) / ρs) ^ 2 = 4 * (C * Es * (ρ / ρs) ^ 2) := by
  ring

end HvMat

#print axioms HvMat.series_den_pos
#print axioms HvMat.halpinTsai_le_voigt
#print axioms HvMat.reuss_le_halpinTsai
#print axioms HvMat.halpinTsai_zero
#print axioms HvMat.gibsonAshby_double
