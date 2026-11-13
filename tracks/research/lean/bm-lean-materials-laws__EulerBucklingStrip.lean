import Mathlib

/-!
# Euler buckling of a rectangular strip (label bm-lean-materials-laws)

Euler critical load of a slender column with Young's modulus `E`, second moment of area `I`,
effective-length factor `K` and length `L`:

    P_cr = π² E I / (K L)².

For a rectangular strip of width `b` and thickness `t` buckling about its weak axis,
`I = b t³ / 12`.

Proved here (all hypotheses are positivity of the physical inputs):

1. `eulerStrip_strictMono_thickness`: thicker strip, strictly larger buckling load.
2. `eulerStrip_strictAnti_length`: longer strip, strictly smaller buckling load.
3. `eulerStrip_thickness_scaling`: scaling the thickness by `s` multiplies `P_cr` by `s³`.
4. `eulerStrip_length_scaling`: scaling the length by `s ≠ 0` multiplies `P_cr` by `1/s²`.
5. `eulerStrip_geometric_similarity`: scaling width, thickness and length together by `s`
   multiplies `P_cr` by `s²` (so the critical stress `P_cr / (b t)` is unchanged).
6. `eulerStrip_criticalStress`: `P_cr / (b t) = π² E (t / (K L))² / 12`, which depends on the
   slenderness `t / L` only.
7. `eulerStrip_not_buckled_below`: any load strictly below `P_cr` is below the threshold.

Not proved (and not claimed): that `P_cr` is the load at which a real strip buckles. Deriving the
formula needs the Euler-Bernoulli beam equation and its eigenvalue problem; here `P_cr` is a
definition. Imperfections, plasticity and the shear correction for thick strips are outside.
-/

namespace BmMaterials.EulerBuckling

noncomputable section

open Real

/-- Euler critical load. -/
def eulerLoad (E I K L : ℝ) : ℝ := π ^ 2 * E * I / (K * L) ^ 2

/-- Second moment of area of a `b × t` rectangle about the axis along `b`. -/
def stripI (b t : ℝ) : ℝ := b * t ^ 3 / 12

/-- Euler critical load of a rectangular strip. -/
def eulerStrip (E b t K L : ℝ) : ℝ := eulerLoad E (stripI b t) K L

theorem eulerStrip_eq (E b t K L : ℝ) :
    eulerStrip E b t K L = π ^ 2 * E * b * t ^ 3 / (12 * (K * L) ^ 2) := by
  unfold eulerStrip eulerLoad stripI
  by_cases h : (K * L) ^ 2 = 0
  · simp [h]
  · field_simp

theorem eulerStrip_strictMono_thickness (E b K L t₁ t₂ : ℝ) (hE : 0 < E) (hb : 0 < b)
    (hK : 0 < K) (hL : 0 < L) (ht₁ : 0 < t₁) (h : t₁ < t₂) :
    eulerStrip E b t₁ K L < eulerStrip E b t₂ K L := by
  rw [eulerStrip_eq, eulerStrip_eq]
  have hcube : t₁ ^ 3 < t₂ ^ 3 := pow_lt_pow_left₀ h ht₁.le (by norm_num)
  have hKL : 0 < 12 * (K * L) ^ 2 := by positivity
  have hc : 0 < π ^ 2 * E * b := by positivity
  rw [div_lt_div_iff_of_pos_right hKL]
  nlinarith [mul_lt_mul_of_pos_left hcube hc]

theorem eulerStrip_strictAnti_length (E b t K L₁ L₂ : ℝ) (hE : 0 < E) (hb : 0 < b)
    (ht : 0 < t) (hK : 0 < K) (hL₁ : 0 < L₁) (h : L₁ < L₂) :
    eulerStrip E b t K L₂ < eulerStrip E b t K L₁ := by
  rw [eulerStrip_eq, eulerStrip_eq]
  have hL₂ : 0 < L₂ := hL₁.trans h
  have hsq : (K * L₁) ^ 2 < (K * L₂) ^ 2 := by
    have : K * L₁ < K * L₂ := mul_lt_mul_of_pos_left h hK
    exact pow_lt_pow_left₀ this (by positivity) (by norm_num)
  have hnum : 0 < π ^ 2 * E * b * t ^ 3 := by positivity
  have hp : 0 < 12 * (K * L₁) ^ 2 := by positivity
  rw [div_lt_div_iff₀ (by positivity) hp]
  nlinarith [mul_lt_mul_of_pos_left hsq hnum]

theorem eulerStrip_thickness_scaling (E b t K L s : ℝ) :
    eulerStrip E b (s * t) K L = s ^ 3 * eulerStrip E b t K L := by
  rw [eulerStrip_eq, eulerStrip_eq]
  by_cases h : 12 * (K * L) ^ 2 = 0
  · simp [h]
  · field_simp

theorem eulerStrip_length_scaling (E b t K L s : ℝ) (hK : K ≠ 0) (hL : L ≠ 0) (hs : s ≠ 0) :
    eulerStrip E b t K (s * L) = eulerStrip E b t K L / s ^ 2 := by
  rw [eulerStrip_eq, eulerStrip_eq]
  field_simp

theorem eulerStrip_geometric_similarity (E b t K L s : ℝ) (hK : K ≠ 0) (hL : L ≠ 0)
    (hs : s ≠ 0) :
    eulerStrip E (s * b) (s * t) K (s * L) = s ^ 2 * eulerStrip E b t K L := by
  rw [eulerStrip_eq, eulerStrip_eq]
  field_simp

/-- Critical stress of a strip: depends on the slenderness `t / (K L)` only. -/
theorem eulerStrip_criticalStress (E b t K L : ℝ) (hb : b ≠ 0) (ht : t ≠ 0) (hK : K ≠ 0)
    (hL : L ≠ 0) :
    eulerStrip E b t K L / (b * t) = π ^ 2 * E * (t / (K * L)) ^ 2 / 12 := by
  rw [eulerStrip_eq]
  field_simp

theorem eulerStrip_not_buckled_below (E b t K L P : ℝ) (hP : P < eulerStrip E b t K L) :
    P < π ^ 2 * E * b * t ^ 3 / (12 * (K * L) ^ 2) := by
  rwa [eulerStrip_eq] at hP

end

end BmMaterials.EulerBuckling

/-! Axiom audit: each line must list only propext, Classical.choice, Quot.sound. -/
#print axioms BmMaterials.EulerBuckling.eulerStrip_eq
#print axioms BmMaterials.EulerBuckling.eulerStrip_strictMono_thickness
#print axioms BmMaterials.EulerBuckling.eulerStrip_strictAnti_length
#print axioms BmMaterials.EulerBuckling.eulerStrip_thickness_scaling
#print axioms BmMaterials.EulerBuckling.eulerStrip_length_scaling
#print axioms BmMaterials.EulerBuckling.eulerStrip_geometric_similarity
#print axioms BmMaterials.EulerBuckling.eulerStrip_criticalStress
#print axioms BmMaterials.EulerBuckling.eulerStrip_not_buckled_below
