import Mathlib

/-!
cs-allometry-fins: how the Bainbridge line (statement B) constrains the Strouhal band (statement A).
Every biological assumption is a named hypothesis; nothing here is an axiom.
Symbols: f tail-beat frequency, A peak-to-peak tail amplitude, U speed, L body length,
u = U/L speed in body lengths per second, α = A/L, and the line f = a + b*u.
-/

namespace StrouhalBainbridge

/-- If f = a + b*(U/L) and A = α*L then St = f*A/U = α*(b + a/u) with u = U/L. -/
theorem strouhal_of_bainbridge (f A U L a b α : ℝ) (hU : U ≠ 0) (hL : L ≠ 0)
    (hA : A = α * L) (hf : f = a + b * (U / L)) :
    f * A / U = α * (b + a / (U / L)) := by
  subst hA hf
  field_simp
  ring

/-- With a positive intercept the Strouhal number falls as length-specific speed rises:
slow swimmers (and slow records of one swimmer) sit higher in St. -/
theorem strouhal_decreasing (a b α u v : ℝ) (ha : 0 < a) (hα : 0 < α)
    (hu : 0 < u) (huv : u < v) :
    α * (b + a / v) < α * (b + a / u) := by
  have h : a / v < a / u := div_lt_div_of_pos_left ha hu huv
  have h2 := mul_lt_mul_of_pos_left h hα
  rw [mul_add, mul_add]
  linarith

/-- St never drops below α*b: the slope of the Bainbridge line sets a floor. -/
theorem strouhal_floor (a b α u : ℝ) (ha : 0 ≤ a) (hα : 0 ≤ α) (hu : 0 < u) :
    α * b ≤ α * (b + a / u) := by
  have h : 0 ≤ a / u := div_nonneg ha hu.le
  nlinarith [mul_nonneg hα h]

/-- St ≤ 0.4 exactly when speed is at least a*α/(0.4 - α*b) body lengths per second
(needs α*b < 0.4). Below that speed the 0.2-0.4 band must fail. -/
theorem band_upper_iff (a b α u : ℝ) (hu : 0 < u) (hgap : α * b < 2 / 5) :
    α * (b + a / u) ≤ 2 / 5 ↔ α * a / (2 / 5 - α * b) ≤ u := by
  have hd : 0 < 2 / 5 - α * b := by linarith
  rw [div_le_iff₀ hd]
  have e : α * (b + a / u) = α * b + α * a / u := by ring
  rw [e]
  constructor
  · intro h
    have h2 : α * a / u ≤ 2 / 5 - α * b := by linarith
    rw [div_le_iff₀ hu] at h2
    linarith
  · intro h
    have h2 : α * a / u ≤ 2 / 5 - α * b := by
      rw [div_le_iff₀ hu]; linarith
    linarith

end StrouhalBainbridge

-- axiom audit lines added by tracks/scripts/add-axiom-audit.py
#print axioms StrouhalBainbridge.strouhal_of_bainbridge
#print axioms StrouhalBainbridge.strouhal_decreasing
#print axioms StrouhalBainbridge.strouhal_floor
#print axioms StrouhalBainbridge.band_upper_iff
