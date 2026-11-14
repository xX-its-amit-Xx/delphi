/-
Bridge between the volume form `Q ∝ ν^(-3/5)` and the linear-stretch form `ν V₁ s⁵ = A` used in
CrosslinkerWindow.lean (agent lb-crosslinker-laws). Checked separately with tracks/lean/check.sh.
-/
import Mathlib

namespace ThompsonLaws.CrosslinkerBridge

noncomputable section

open Real

/-- High-swelling Flory-Rehner scaling for the volume swelling ratio, `Q = C ν^(-3/5)`.
A definition of the model, not a claim about any material. -/
def swellRatio (C ν : ℝ) : ℝ := C * ν ^ (-(3 / 5) : ℝ)

/-- SHOWS: for a positive prefactor `C`, the model swelling ratio `Q = C ν^(-3/5)` is strictly
decreasing in crosslink density on `ν > 0`.
DOES NOT SHOW: that a real gel follows the `-3/5` scaling. -/
theorem swellRatio_strictAntiOn (C : ℝ) (hC : 0 < C) :
    StrictAntiOn (fun ν : ℝ => swellRatio C ν) (Set.Ioi 0) := by
  intro a ha b _hb hab
  have ha' : 0 < a := ha
  show C * b ^ (-(3 / 5) : ℝ) < C * a ^ (-(3 / 5) : ℝ)
  exact mul_lt_mul_of_pos_left (Real.rpow_lt_rpow_of_neg ha' hab (by norm_num)) hC

/-- SHOWS: for the same model, the linear swelling strain `ε = Q^(1/3) - 1` (isotropic swelling)
is strictly decreasing in crosslink density on `ν > 0`.
DOES NOT SHOW: that swelling is isotropic in a printed, layered or fibre-filled part. -/
theorem linearStrain_strictAntiOn (C : ℝ) (hC : 0 < C) :
    StrictAntiOn (fun ν : ℝ => swellRatio C ν ^ (1 / 3 : ℝ) - 1) (Set.Ioi 0) := by
  intro a ha b hb hab
  have hb' : 0 < b := hb
  have hQ : swellRatio C b < swellRatio C a := swellRatio_strictAntiOn C hC ha hb hab
  have hpos : 0 ≤ swellRatio C b := by
    unfold swellRatio
    exact (mul_pos hC (Real.rpow_pos_of_pos hb' _)).le
  have hr : swellRatio C b ^ (1 / 3 : ℝ) < swellRatio C a ^ (1 / 3 : ℝ) :=
    Real.rpow_lt_rpow hpos hQ (by norm_num)
  show swellRatio C b ^ (1 / 3 : ℝ) - 1 < swellRatio C a ^ (1 / 3 : ℝ) - 1
  linarith

/-- SHOWS: for a non-negative linear stretch `s`, the volume ratio `Q = s³` satisfies
`Q^(5/3) = s⁵`; so the balance `ν V₁ s⁵ = A` of CrosslinkerWindow.lean is the same equation as the
textbook `ν V₁ Q^(5/3) = A`.
DOES NOT SHOW: anything physical; it is an identity of real powers. -/
theorem volume_five_thirds_eq_stretch_five (s : ℝ) (hs : 0 ≤ s) :
    (s ^ 3) ^ (5 / 3 : ℝ) = s ^ 5 := by
  rw [← Real.rpow_natCast s 3, ← Real.rpow_mul hs, ← Real.rpow_natCast s 5]
  norm_num

end

end ThompsonLaws.CrosslinkerBridge

#print axioms ThompsonLaws.CrosslinkerBridge.swellRatio_strictAntiOn
#print axioms ThompsonLaws.CrosslinkerBridge.linearStrain_strictAntiOn
#print axioms ThompsonLaws.CrosslinkerBridge.volume_five_thirds_eq_stretch_five
