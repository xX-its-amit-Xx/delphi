import Mathlib
import Delphi.Flight

/-!
# Maximum lift-to-drag ratio from aspect ratio, composed with the glide range bound

Fills the registry gap `aspect-ratio-induced-drag` (law set 1.8.1, class `gap`, no theorem).
Parked outside `lean/` (read-only). Imports `Delphi.Flight` to compose with `Delphi.glide_range_le`.

Named hypothesis (NOT derived from lifting-line theory): parabolic drag polar
  C_D = C_D0 + C_L^2 / (pi e AR), with C_D0 > 0, 0 < e, AR > 0.
-/
namespace T4Glide

/-- Parabolic drag polar as a named hypothesis. -/
def Polar (CD0 e AR CL CD : ℝ) : Prop := CD = CD0 + CL ^ 2 / (Real.pi * e * AR)

/-- Squared form of the bound (no square root): (C_L/C_D)^2 <= pi e AR / (4 C_D0). -/
theorem ld_sq_le {CD0 e AR CL CD : ℝ} (hCD0 : 0 < CD0) (he : 0 < e) (hAR : 0 < AR)
    (hCL : 0 < CL) (hp : Polar CD0 e AR CL CD) :
    (CL / CD) ^ 2 ≤ Real.pi * e * AR / (4 * CD0) := by
  unfold Polar at hp
  have hk : 0 < Real.pi * e * AR := by positivity
  set k := Real.pi * e * AR with hkdef
  have hCD : 0 < CD := by rw [hp]; positivity
  rw [div_pow, div_le_div_iff₀ (by positivity) (by positivity)]
  have h1 : CD ^ 2 * k ≥ 4 * CD0 * CL ^ 2 := by
    rw [hp]
    have : (CD0 + CL ^ 2 / k) ^ 2 * k - 4 * CD0 * CL ^ 2 = k * (CD0 - CL ^ 2 / k) ^ 2 := by
      field_simp; ring
    nlinarith [mul_nonneg hk.le (sq_nonneg (CD0 - CL ^ 2 / k))]
  nlinarith

/-- **Maximum L/D from aspect ratio**: C_L/C_D <= (1/2) sqrt(pi e AR / C_D0). -/
theorem ld_le {CD0 e AR CL CD : ℝ} (hCD0 : 0 < CD0) (he : 0 < e) (hAR : 0 < AR)
    (hCL : 0 < CL) (hp : Polar CD0 e AR CL CD) :
    CL / CD ≤ (1 / 2) * Real.sqrt (Real.pi * e * AR / CD0) := by
  have h := ld_sq_le hCD0 he hAR hCL hp
  have hk : 0 < Real.pi * e * AR := by positivity
  have hCD : 0 < CD := by unfold Polar at hp; rw [hp]; positivity
  have hs : (1 / 2 * Real.sqrt (Real.pi * e * AR / CD0)) ^ 2 = Real.pi * e * AR / (4 * CD0) := by
    rw [mul_pow, Real.sq_sqrt (by positivity)]; field_simp; norm_num
  apply le_of_sq_le_sq _ (by positivity)
  rw [hs]; exact h

/-- Equality at C_L = sqrt(pi e AR C_D0): the bound is attained, so it is sharp. -/
theorem ld_attained {CD0 e AR : ℝ} (hCD0 : 0 < CD0) (he : 0 < e) (hAR : 0 < AR) :
    ∃ CL CD, 0 < CL ∧ Polar CD0 e AR CL CD ∧
      CL / CD = (1 / 2) * Real.sqrt (Real.pi * e * AR / CD0) := by
  have hk : 0 < Real.pi * e * AR := by positivity
  refine ⟨Real.sqrt (Real.pi * e * AR * CD0), 2 * CD0, by positivity, ?_, ?_⟩
  · unfold Polar
    rw [Real.sq_sqrt (by positivity)]; field_simp; ring
  · have h1 : Real.sqrt (Real.pi * e * AR * CD0) = Real.sqrt (Real.pi * e * AR / CD0) * CD0 := by
      rw [show Real.pi * e * AR * CD0 = (Real.pi * e * AR / CD0) * CD0 ^ 2 by field_simp,
        Real.sqrt_mul (by positivity), Real.sqrt_sq hCD0.le]
    rw [h1]; field_simp

/-- **Fin-geometry glide range**: a passive glide from height h with lift = weight on a parabolic
polar covers at most (h/2) sqrt(pi e AR / C_D0). Composes `Delphi.glide_range_le` with `ld_le`. -/
theorem glide_range_le_aspect {W h D x loss Lift CD0 e AR CL CD : ℝ} (hW : 0 < W) (hD : 0 < D)
    (hh : 0 ≤ h) (hlift : Lift = W) (henergy : W * h = D * x + loss) (hloss : 0 ≤ loss)
    (hCD0 : 0 < CD0) (he : 0 < e) (hAR : 0 < AR) (hCL : 0 < CL) (hp : Polar CD0 e AR CL CD)
    (hratio : Lift / D = CL / CD) :
    x ≤ h * ((1 / 2) * Real.sqrt (Real.pi * e * AR / CD0)) :=
  Delphi.glide_range_le hW hD hh hlift (by rw [hratio]; exact ld_le hCD0 he hAR hCL hp) henergy hloss

/-- Rule-out form: a committed (C_L, C_D, AR, e <= emax) cannot beat the polar's L/D. -/
theorem ld_rules_out {CD0 e AR CL CD : ℝ} (hCD0 : 0 < CD0) (he : 0 < e) (hAR : 0 < AR)
    (hCL : 0 < CL) (hp : Polar CD0 e AR CL CD)
    (hclaim : (1 / 2) * Real.sqrt (Real.pi * e * AR / CD0) < CL / CD) : False :=
  absurd (ld_le hCD0 he hAR hCL hp) (not_le.mpr hclaim)

#print axioms ld_sq_le
#print axioms ld_le
#print axioms ld_attained
#print axioms glide_range_le_aspect
#print axioms ld_rules_out
end T4Glide
