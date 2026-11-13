import Mathlib

/-!
# Track 3 (lumen geometry): the apical-length ceiling on normalised lumen area

Proposed law `lumen-area-ceiling` (NOT in law set 1.8.1; written for label t3-lumen-law).

Data map of Vasquez et al. 2021 (as transcribed in design-lumen.json, "model"): for a 2-D cyst section
with N cells, lumen area `AL`, lumen perimeter `p`, mean cell area `A0`,
  normalised lumen area  a  = AL / A0
  apical length per cell la = p / (N * sqrt A0)
  isoperimetric quotient IPQ = 4 pi AL / p^2.

What is PROVED (kernel-checked, no sorry):
 1. `ipq_identity`: IPQ = 4 pi a / (N la)^2. An identity of the definitions, so any test that feeds a
    lumen's own la in and scores its own area or IPQ is circular.
 2. `area_ceiling`: if IPQ <= 1 then a <= (N la)^2 / (4 pi).
 3. `lumen_area_rules_out`: a claimed (N, la, a) above that ceiling is impossible under IPQ <= 1.
 4. `ceiling_strictMono_la`, `ceiling_strictMono_N`: the ceiling rises strictly with la and with N.
 5. `rules_out_example`: N = 5, la = 7/10, claimed a = 1 is ruled out.

NAMED HYPOTHESIS (not proved here): `hIPQ : IPQ <= 1`, the planar isoperimetric inequality 4 pi A <= p^2
for the lumen outline. It is taken as a hypothesis, not derived; Mathlib does not state it for planar
curves in the form used here. No physical content beyond geometry: it says nothing about pressure,
tension or which lumens occur.
-/

namespace Delphi.Track3

open Real

/-- Isoperimetric quotient of a planar region of area `A` and perimeter `p`. -/
noncomputable def ipq (A p : ℝ) : ℝ := 4 * π * A / p ^ 2

/-- Normalised lumen area `AL / A0`. -/
noncomputable def normArea (AL A0 : ℝ) : ℝ := AL / A0

/-- Apical length per cell `p / (N sqrt A0)`. -/
noncomputable def apicalLen (p N A0 : ℝ) : ℝ := p / (N * Real.sqrt A0)

/-- Ceiling on normalised lumen area given cell number and apical length per cell. -/
noncomputable def ceiling (N la : ℝ) : ℝ := (N * la) ^ 2 / (4 * π)

/-- (N * la)^2 = p^2 / A0. -/
theorem sq_N_la {p N A0 : ℝ} (hp : 0 < p) (hN : 0 < N) (hA : 0 < A0) :
    (N * apicalLen p N A0) ^ 2 = p ^ 2 / A0 := by
  unfold apicalLen
  have hs : 0 < Real.sqrt A0 := Real.sqrt_pos.mpr hA
  have hsq : Real.sqrt A0 ^ 2 = A0 := Real.sq_sqrt hA.le
  have h1 : N * (p / (N * Real.sqrt A0)) = p / Real.sqrt A0 := by
    field_simp
  rw [h1, div_pow, hsq]

/-- IPQ is fixed by (a, N, la): an identity, not a prediction. -/
theorem ipq_identity {AL p N A0 : ℝ} (hAL : 0 < AL) (hp : 0 < p) (hN : 0 < N) (hA : 0 < A0) :
    ipq AL p = 4 * π * normArea AL A0 / (N * apicalLen p N A0) ^ 2 := by
  rw [sq_N_la hp hN hA]
  unfold ipq normArea
  field_simp

/-- Under IPQ <= 1, normalised lumen area is at most (N la)^2 / (4 pi). -/
theorem area_ceiling {AL p N A0 : ℝ} (hAL : 0 < AL) (hp : 0 < p) (hN : 0 < N) (hA : 0 < A0)
    (hIPQ : ipq AL p ≤ 1) :
    normArea AL A0 ≤ ceiling N (apicalLen p N A0) := by
  unfold ceiling
  rw [sq_N_la hp hN hA]
  unfold ipq at hIPQ
  have hp2 : 0 < p ^ 2 := by positivity
  rw [div_le_one hp2] at hIPQ
  unfold normArea
  rw [div_div, div_le_iff₀ hA, div_mul_eq_mul_div, le_div_iff₀ (by positivity)]
  nlinarith [Real.pi_pos]

/-- A claimed normalised area above the ceiling cannot come from a lumen with IPQ <= 1. -/
theorem lumen_area_rules_out {AL p N A0 : ℝ} (hAL : 0 < AL) (hp : 0 < p) (hN : 0 < N) (hA : 0 < A0)
    (hIPQ : ipq AL p ≤ 1) (hclaim : ceiling N (apicalLen p N A0) < normArea AL A0) : False :=
  absurd (area_ceiling hAL hp hN hA hIPQ) (not_le.mpr hclaim)

theorem ceiling_strictMono_la {N l₁ l₂ : ℝ} (hN : 0 < N) (h1 : 0 < l₁) (h : l₁ < l₂) :
    ceiling N l₁ < ceiling N l₂ := by
  unfold ceiling
  apply div_lt_div_of_pos_right _ (by positivity)
  have : N * l₁ < N * l₂ := by nlinarith
  have h0 : 0 < N * l₁ := by positivity
  nlinarith

theorem ceiling_strictMono_N {N₁ N₂ l : ℝ} (hl : 0 < l) (h1 : 0 < N₁) (h : N₁ < N₂) :
    ceiling N₁ l < ceiling N₂ l := by
  unfold ceiling
  apply div_lt_div_of_pos_right _ (by positivity)
  have : N₁ * l < N₂ * l := by nlinarith
  have h0 : 0 < N₁ * l := by positivity
  nlinarith

/-- N = 5, la = 7/10: ceiling = 12.25 / (4 pi) < 0.98, so a claimed normalised area of 1 is impossible. -/
theorem ceiling_example : ceiling 5 (7 / 10) < 1 := by
  unfold ceiling
  have := Real.pi_gt_d2
  rw [div_lt_one (by positivity)]
  nlinarith

theorem rules_out_example {AL p A0 : ℝ} (hAL : 0 < AL) (hp : 0 < p) (hA : 0 < A0)
    (hla : apicalLen p 5 A0 = 7 / 10) (hIPQ : ipq AL p ≤ 1) (hclaim : normArea AL A0 = 1) : False := by
  apply lumen_area_rules_out hAL hp (by norm_num : (0:ℝ) < 5) hA hIPQ
  rw [hla, hclaim]
  exact ceiling_example

end Delphi.Track3

#print axioms Delphi.Track3.ipq_identity
#print axioms Delphi.Track3.area_ceiling
#print axioms Delphi.Track3.lumen_area_rules_out
#print axioms Delphi.Track3.ceiling_strictMono_la
#print axioms Delphi.Track3.ceiling_strictMono_N
#print axioms Delphi.Track3.rules_out_example
