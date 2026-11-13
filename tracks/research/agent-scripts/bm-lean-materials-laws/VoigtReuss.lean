import Mathlib

/-!
# Voigt and Reuss bounds for a composite (label bm-lean-materials-laws)

Two-phase composite with volume fraction `f` of phase 1 (modulus `E₁`) and `1 - f` of phase 2
(modulus `E₂`).

* Voigt (rule of mixtures, equal strain):  `E_V = f E₁ + (1 - f) E₂`
* Reuss (equal stress, inverse rule):      `E_R = 1 / (f/E₁ + (1 - f)/E₂)`

Proved here, for positive moduli and `0 ≤ f ≤ 1`:

1. `voigt_mul_compliance_sub_one`: the exact identity
   `E_V · (f/E₁ + (1-f)/E₂) - 1 = f (1-f) (E₁ - E₂)² / (E₁ E₂)`.
2. `reuss_le_voigt`: `E_R ≤ E_V`.
3. `reuss_eq_voigt_iff`: equality holds exactly when `f (1-f) (E₁-E₂)² = 0`, i.e. a pure phase
   or equal moduli.
4. `reuss_le_voigt_finset`: the n-phase version, weights `w i ≥ 0` summing to 1, via Jensen for
   `x ↦ x⁻¹` (Mathlib `convexOn_zpow`).

Not proved here (and not claimed): that Voigt and Reuss are physical bounds on the effective
modulus of a real microstructure. That needs the energy principles (minimum potential energy and
complementary energy), which are not in Mathlib. The theorems say the two closed forms are ordered
as the bounds require; the physics is outside the kernel.
-/

namespace BmMaterials.VoigtReuss

noncomputable section

/-- Voigt (equal strain, rule of mixtures) modulus of a two-phase composite. -/
def voigt (f E₁ E₂ : ℝ) : ℝ := f * E₁ + (1 - f) * E₂

/-- Reuss (equal stress, inverse rule of mixtures) modulus of a two-phase composite. -/
def reuss (f E₁ E₂ : ℝ) : ℝ := 1 / (f / E₁ + (1 - f) / E₂)

theorem voigt_mul_compliance_sub_one (f E₁ E₂ : ℝ) (h1 : E₁ ≠ 0) (h2 : E₂ ≠ 0) :
    voigt f E₁ E₂ * (f / E₁ + (1 - f) / E₂) - 1
      = f * (1 - f) * (E₁ - E₂) ^ 2 / (E₁ * E₂) := by
  unfold voigt
  field_simp
  ring

theorem compliance_pos (f E₁ E₂ : ℝ) (hf0 : 0 ≤ f) (hf1 : f ≤ 1) (h1 : 0 < E₁) (h2 : 0 < E₂) :
    0 < f / E₁ + (1 - f) / E₂ := by
  have t1 : 0 ≤ f / E₁ := div_nonneg hf0 h1.le
  have t2 : 0 ≤ (1 - f) / E₂ := div_nonneg (by linarith) h2.le
  by_contra hneg
  push_neg at hneg
  have e1 : f / E₁ = 0 := by linarith
  have e2 : (1 - f) / E₂ = 0 := by linarith
  have a1 : f = 0 := (div_eq_zero_iff.mp e1).resolve_right h1.ne'
  have a2 : 1 - f = 0 := (div_eq_zero_iff.mp e2).resolve_right h2.ne'
  linarith

theorem reuss_le_voigt (f E₁ E₂ : ℝ) (hf0 : 0 ≤ f) (hf1 : f ≤ 1) (h1 : 0 < E₁) (h2 : 0 < E₂) :
    reuss f E₁ E₂ ≤ voigt f E₁ E₂ := by
  have ha := compliance_pos f E₁ E₂ hf0 hf1 h1 h2
  have key := voigt_mul_compliance_sub_one f E₁ E₂ h1.ne' h2.ne'
  have hnn : 0 ≤ f * (1 - f) * (E₁ - E₂) ^ 2 / (E₁ * E₂) :=
    div_nonneg (mul_nonneg (mul_nonneg hf0 (by linarith)) (sq_nonneg _)) (mul_pos h1 h2).le
  unfold reuss
  rw [div_le_iff₀ ha]
  linarith

theorem reuss_eq_voigt_iff (f E₁ E₂ : ℝ) (hf0 : 0 ≤ f) (hf1 : f ≤ 1) (h1 : 0 < E₁)
    (h2 : 0 < E₂) :
    reuss f E₁ E₂ = voigt f E₁ E₂ ↔ f * (1 - f) * (E₁ - E₂) ^ 2 = 0 := by
  have ha := compliance_pos f E₁ E₂ hf0 hf1 h1 h2
  have key := voigt_mul_compliance_sub_one f E₁ E₂ h1.ne' h2.ne'
  have hE : E₁ * E₂ ≠ 0 := (mul_pos h1 h2).ne'
  unfold reuss
  rw [div_eq_iff ha.ne']
  constructor
  · intro h
    have h0 : f * (1 - f) * (E₁ - E₂) ^ 2 / (E₁ * E₂) = 0 := by linarith
    exact (div_eq_zero_iff.mp h0).resolve_right hE
  · intro h
    rw [h, zero_div] at key
    linarith

/-- n-phase Voigt modulus with volume fractions `w`. -/
def voigtN {ι : Type*} (s : Finset ι) (w E : ι → ℝ) : ℝ := ∑ i ∈ s, w i * E i

/-- n-phase Reuss modulus with volume fractions `w`. -/
def reussN {ι : Type*} (s : Finset ι) (w E : ι → ℝ) : ℝ := (∑ i ∈ s, w i / E i)⁻¹

theorem reuss_le_voigt_finset {ι : Type*} (s : Finset ι) (w E : ι → ℝ)
    (hw0 : ∀ i ∈ s, 0 ≤ w i) (hw1 : ∑ i ∈ s, w i = 1) (hE : ∀ i ∈ s, 0 < E i) :
    reussN s w E ≤ voigtN s w E := by
  have hconv : ConvexOn ℝ (Set.Ioi (0 : ℝ)) (fun x : ℝ => x ^ (-1 : ℤ)) := convexOn_zpow (-1)
  have hmem : ∀ i ∈ s, E i ∈ Set.Ioi (0 : ℝ) := fun i hi => hE i hi
  have hVmem : ∑ i ∈ s, w i • E i ∈ Set.Ioi (0 : ℝ) :=
    hconv.1.sum_mem hw0 hw1 hmem
  have hjensen := hconv.map_sum_le hw0 hw1 hmem
  simp only [zpow_neg, zpow_one, smul_eq_mul] at hjensen hVmem
  have hV : 0 < ∑ i ∈ s, w i * E i := hVmem
  have hsum : ∑ i ∈ s, w i * (E i)⁻¹ = ∑ i ∈ s, w i / E i := by
    refine Finset.sum_congr rfl (fun i _ => ?_)
    rw [div_eq_mul_inv]
  have ha : 0 < ∑ i ∈ s, w i / E i := by
    have hinv : 0 < (∑ i ∈ s, w i * E i)⁻¹ := inv_pos.mpr hV
    rw [← hsum]
    exact lt_of_lt_of_le hinv hjensen
  unfold reussN voigtN
  rw [inv_le_comm₀ ha hV, ← hsum]
  exact hjensen

end

end BmMaterials.VoigtReuss

/-! Axiom audit: each line must list only propext, Classical.choice, Quot.sound. -/
#print axioms BmMaterials.VoigtReuss.voigt_mul_compliance_sub_one
#print axioms BmMaterials.VoigtReuss.compliance_pos
#print axioms BmMaterials.VoigtReuss.reuss_le_voigt
#print axioms BmMaterials.VoigtReuss.reuss_eq_voigt_iff
#print axioms BmMaterials.VoigtReuss.reuss_le_voigt_finset
