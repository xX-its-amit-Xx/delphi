/-
# Two physiological laws the chain already uses: Q10 and Laplace

* **Q10.** `q10Scale X0 Q10 Tref T = X0 Q10^((T - Tref)/10)`: the ratio between two temperatures is
  `Q10^((T2 - T1)/10)` and the log form has slope `log Q10 / 10` (physiology/muscle.js scales V_max, force and
  power this way with Q10 1.69, 1.08, 1.88 from Rome 1992).
* **Laplace, thin wall.** For a thin-walled sphere under transmural pressure `P`, wall stress is `P r / (2 t)`;
  for a cylinder, `P r / t` (hoop). Stress grows with radius at fixed pressure and thickness, and the pressure a
  wall of strength `σ_max` can hold falls as `1/r`: `laplace_pressure_limit`. The swim bladder and the ventral
  aorta are the chain's candidates; no wall thickness or strength is sourced for Exocoetidae, so these are
  stated-and-proved laws with no instance yet.

Named hypotheses: the Q10 form itself (an empirical rule, not a theorem of physics); thin walls (`t ≪ r`),
uniform isotropic material, static pressure.
-/
import Mathlib

open Real

namespace Delphi
namespace Physiology

/-- Temperature scaling with a Q10. -/
noncomputable def q10Scale (X0 Q10 Tref T : ℝ) : ℝ := X0 * Q10 ^ ((T - Tref) / 10)

theorem q10_ratio {X0 Q10 Tref T₁ T₂ : ℝ} (hX : X0 ≠ 0) (hQ : 0 < Q10) :
    q10Scale X0 Q10 Tref T₂ / q10Scale X0 Q10 Tref T₁ = Q10 ^ ((T₂ - T₁) / 10) := by
  unfold q10Scale
  rw [mul_div_mul_left _ _ hX, ← Real.rpow_sub hQ]
  congr 1; ring

theorem q10_log {X0 Q10 Tref T₁ T₂ : ℝ} (hX : X0 ≠ 0) (hQ : 0 < Q10) :
    Real.log (q10Scale X0 Q10 Tref T₂ / q10Scale X0 Q10 Tref T₁) = (T₂ - T₁) / 10 * Real.log Q10 := by
  rw [q10_ratio hX hQ, Real.log_rpow hQ]

/-- Wall stress of a thin-walled sphere: `P r / (2 t)`. -/
noncomputable def sphereWallStress (P r t : ℝ) : ℝ := P * r / (2 * t)
/-- Hoop stress of a thin-walled cylinder: `P r / t`. -/
noncomputable def hoopStress (P r t : ℝ) : ℝ := P * r / t

/-- At fixed pressure and thickness, wall stress grows with radius. -/
theorem sphereWallStress_mono {P t r₁ r₂ : ℝ} (hP : 0 < P) (ht : 0 < t) (h : r₁ ≤ r₂) :
    sphereWallStress P r₁ t ≤ sphereWallStress P r₂ t := by
  unfold sphereWallStress
  apply div_le_div_of_nonneg_right _ (by positivity)
  exact mul_le_mul_of_nonneg_left h hP.le

/-- **Laplace pressure limit.** A thin spherical wall of strength `σmax` and thickness `t` holds at most
`2 σmax t / r`: the pressure limit falls as `1/r`. -/
theorem laplace_pressure_limit {P r t σmax : ℝ} (hr : 0 < r) (ht : 0 < t) (hσ : sphereWallStress P r t ≤ σmax) :
    P ≤ 2 * σmax * t / r := by
  unfold sphereWallStress at hσ
  rw [div_le_iff₀ (by positivity)] at hσ
  rw [le_div_iff₀ hr]
  linarith

theorem hoop_pressure_limit {P r t σmax : ℝ} (hr : 0 < r) (ht : 0 < t) (hσ : hoopStress P r t ≤ σmax) :
    P ≤ σmax * t / r := by
  unfold hoopStress at hσ
  rw [div_le_iff₀ ht] at hσ
  rw [le_div_iff₀ hr]
  linarith

end Physiology
end Delphi
