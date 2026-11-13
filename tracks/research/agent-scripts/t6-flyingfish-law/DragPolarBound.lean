import Mathlib
import Delphi.Flight

/-!
# Parabolic drag polar: L/D is capped by aspect ratio (Track 6, label t6-flyingfish-law)

Closes, as a theorem, the registry gap `aspect-ratio-induced-drag` ("Induced drag falls with aspect ratio;
L/D depends on fin shape", status proposed, no Lean theorem in law set 1.8.1).

Model (hypothesis, not proved): the parabolic polar  C_D = C_D0 + C_L^2 / (pi e AR)  with C_D0 > 0 (zero-lift
drag), e > 0 (span efficiency), AR > 0 (aspect ratio b^2/S). Conclusion, proved for every C_L > 0:

    C_L / C_D  <=  (1/2) sqrt (pi e AR / C_D0)           (called ldBound)

with equality at C_L = sqrt (pi e AR C_D0) (non-vacuity), and ldBound strictly increasing in AR. Composed with
`Delphi.glide_range_le` (lean/Delphi/Flight.lean) it gives a glide range bound from shape alone, so
`LDmax` stops being only "a committed number".
-/

namespace T6.DragPolar

open Real

/-- The bound `(1/2) sqrt (pi e AR / C_D0)`. -/
noncomputable def ldBound (e AR CD0 : ℝ) : ℝ := Real.sqrt (π * e * AR / CD0) / 2

/-- Core algebra, no square root: with `C_D = C_D0 + k C_L^2`, `(C_L / C_D)^2 <= 1 / (4 k C_D0)`. -/
theorem ld_sq_le {CD0 k CL CD : ℝ} (hCD0 : 0 < CD0) (hk : 0 < k) (hCL : 0 < CL)
    (hpolar : CD = CD0 + k * CL ^ 2) : (CL / CD) ^ 2 ≤ 1 / (4 * k * CD0) := by
  have hCD : 0 < CD := by rw [hpolar]; positivity
  rw [div_pow, div_le_div_iff₀ (by positivity) (by positivity)]
  rw [hpolar]
  nlinarith [sq_nonneg (CD0 - k * CL ^ 2)]

/-- **Aspect-ratio cap on L/D.** Under the parabolic polar with `k = 1 / (pi e AR)`,
`C_L / C_D <= (1/2) sqrt (pi e AR / C_D0)`. -/
theorem ld_le_bound {e AR CD0 CL CD : ℝ} (he : 0 < e) (hAR : 0 < AR) (hCD0 : 0 < CD0) (hCL : 0 < CL)
    (hpolar : CD = CD0 + CL ^ 2 / (π * e * AR)) : CL / CD ≤ ldBound e AR CD0 := by
  have hk : 0 < 1 / (π * e * AR) := by positivity
  have hp : CD = CD0 + (1 / (π * e * AR)) * CL ^ 2 := by rw [hpolar]; ring
  have h1 := ld_sq_le hCD0 hk hCL hp
  have h2 : (CL / CD) ^ 2 ≤ π * e * AR / CD0 / 4 := by
    refine h1.trans (le_of_eq ?_)
    field_simp
  have h3 : |CL / CD| ≤ Real.sqrt (π * e * AR / CD0 / 4) := Real.abs_le_sqrt h2
  have h4 : Real.sqrt (π * e * AR / CD0 / 4) = ldBound e AR CD0 := by
    unfold ldBound
    rw [Real.sqrt_div' _ (by norm_num : (0:ℝ) ≤ 4)]
    have : Real.sqrt 4 = 2 := by
      rw [show (4:ℝ) = 2 ^ 2 by norm_num]; exact Real.sqrt_sq (by norm_num)
    rw [this]
  exact (le_abs_self _).trans (h3.trans_eq h4)

/-- Non-vacuity: the bound is attained, at `C_L = sqrt (pi e AR C_D0)`. -/
theorem ld_bound_attained {e AR CD0 : ℝ} (he : 0 < e) (hAR : 0 < AR) (hCD0 : 0 < CD0) :
    ∃ CL CD : ℝ, 0 < CL ∧ CD = CD0 + CL ^ 2 / (π * e * AR) ∧ CL / CD = ldBound e AR CD0 := by
  set A : ℝ := π * e * AR with hA
  have hApos : 0 < A := by positivity
  have hs : 0 < Real.sqrt (A * CD0) := Real.sqrt_pos.mpr (by positivity)
  have hsq : Real.sqrt (A * CD0) ^ 2 = A * CD0 := Real.sq_sqrt (by positivity)
  refine ⟨Real.sqrt (A * CD0), CD0 + Real.sqrt (A * CD0) ^ 2 / A, hs, rfl, ?_⟩
  have hCD : CD0 + Real.sqrt (A * CD0) ^ 2 / A = 2 * CD0 := by
    rw [hsq]; field_simp; ring
  rw [hCD]
  unfold ldBound
  rw [← hA]
  have hsplit : Real.sqrt (A * CD0) = Real.sqrt (A / CD0) * CD0 := by
    have : A * CD0 = (A / CD0) * CD0 ^ 2 := by field_simp
    rw [this, Real.sqrt_mul (by positivity), Real.sqrt_sq hCD0.le]
  rw [hsplit]
  field_simp

/-- The bound is strictly increasing in aspect ratio. -/
theorem ldBound_strictMono {e CD0 AR₁ AR₂ : ℝ} (he : 0 < e) (hCD0 : 0 < CD0) (h₁ : 0 < AR₁)
    (h : AR₁ < AR₂) : ldBound e AR₁ CD0 < ldBound e AR₂ CD0 := by
  unfold ldBound
  have hlt : π * e * AR₁ / CD0 < π * e * AR₂ / CD0 := by
    apply div_lt_div_of_pos_right _ hCD0
    have := Real.pi_pos
    nlinarith [mul_pos Real.pi_pos he]
  have : Real.sqrt (π * e * AR₁ / CD0) < Real.sqrt (π * e * AR₂ / CD0) :=
    Real.sqrt_lt_sqrt (by positivity) hlt
  linarith

/-- **Glide range from shape.** `Delphi.glide_range_le` with `LDmax` replaced by the aspect-ratio bound:
a lifting glide on the parabolic polar from height `h` goes no farther than `h (1/2) sqrt (pi e AR / C_D0)`. -/
theorem glide_range_le_polar {W h D x loss Lift e AR CD0 CL CD : ℝ} (hW : 0 < W) (hD : 0 < D) (hh : 0 ≤ h)
    (he : 0 < e) (hAR : 0 < AR) (hCD0 : 0 < CD0) (hCL : 0 < CL)
    (hpolar : CD = CD0 + CL ^ 2 / (π * e * AR)) (hratio : Lift / D = CL / CD)
    (hlift : Lift = W) (henergy : W * h = D * x + loss) (hloss : 0 ≤ loss) :
    x ≤ h * ldBound e AR CD0 :=
  Delphi.glide_range_le hW hD hh hlift (hratio ▸ ld_le_bound he hAR hCD0 hCL hpolar) henergy hloss

/-- Elimination form (the `*_rules_out` pattern): a claimed glide longer than the polar bound is impossible. -/
theorem glide_range_polar_rules_out {W h D x loss Lift e AR CD0 CL CD : ℝ} (hW : 0 < W) (hD : 0 < D)
    (hh : 0 ≤ h) (he : 0 < e) (hAR : 0 < AR) (hCD0 : 0 < CD0) (hCL : 0 < CL)
    (hpolar : CD = CD0 + CL ^ 2 / (π * e * AR)) (hratio : Lift / D = CL / CD) (hlift : Lift = W)
    (henergy : W * h = D * x + loss) (hloss : 0 ≤ loss) (hbig : h * ldBound e AR CD0 < x) : False := by
  have := glide_range_le_polar hW hD hh he hAR hCD0 hCL hpolar hratio hlift henergy hloss
  linarith

#print axioms ld_sq_le
#print axioms ld_le_bound
#print axioms ld_bound_attained
#print axioms ldBound_strictMono
#print axioms glide_range_le_polar
#print axioms glide_range_polar_rules_out

end T6.DragPolar
