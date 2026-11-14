import Mathlib

/-!
Allometry and scaling: three small algebraic consequences.
Every biological premise is a named hypothesis; nothing here asserts the premise is true.
-/

namespace AllometryScaling

/-- Kleiber consequence: if whole-body rate is `a * M^(3/4)`, the rate per unit mass
is `a * M^(-1/4)`. Assumption: `M > 0`. -/
theorem kleiber_mass_specific (a M : ℝ) (hM : 0 < M) :
    a * M ^ (3 / 4 : ℝ) / M = a * M ^ (-(1 / 4) : ℝ) := by
  have h : (3 / 4 : ℝ) - 1 = -(1 / 4) := by norm_num
  have h2 : M ^ (3 / 4 : ℝ) / M = M ^ ((3 / 4 : ℝ) - 1) := by
    rw [Real.rpow_sub_one hM.ne']
  rw [mul_div_assoc, h2, h]

/-- Surface-to-volume law for a cube of side `L > 0`: area `6 L^2` over volume `L^3`
equals `6 / L`. -/
theorem cube_surface_to_volume (L : ℝ) (hL : 0 < L) :
    6 * L ^ 2 / L ^ 3 = 6 / L := by
  rw [div_eq_div_iff (by positivity) (by positivity)]
  ring

/-- Murray's law from its two premises: (i) flow in each vessel is `k * r^3` with the
same `k ≠ 0` (the minimum-work condition), (ii) flow is conserved at the branch.
Then the parent radius cubed is the sum of the daughter radii cubed. -/
theorem murray_cube_law (k Q0 Q1 Q2 r0 r1 r2 : ℝ) (hk : k ≠ 0)
    (h0 : Q0 = k * r0 ^ 3) (h1 : Q1 = k * r1 ^ 3) (h2 : Q2 = k * r2 ^ 3)
    (hc : Q0 = Q1 + Q2) :
    r0 ^ 3 = r1 ^ 3 + r2 ^ 3 := by
  have h : k * r0 ^ 3 = k * (r1 ^ 3 + r2 ^ 3) := by
    rw [mul_add, ← h0, ← h1, ← h2]
    exact hc
  exact mul_left_cancel₀ hk h

end AllometryScaling

#print axioms AllometryScaling.kleiber_mass_specific
#print axioms AllometryScaling.cube_surface_to_volume
#print axioms AllometryScaling.murray_cube_law
