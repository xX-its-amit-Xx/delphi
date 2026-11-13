import Mathlib
/-! Negative control: check.sh must FAIL on this file (a `sorry` and a false-direction claim). -/
namespace BmMaterials.Control
def voigt (f E₁ E₂ : ℝ) : ℝ := f * E₁ + (1 - f) * E₂
def reuss (f E₁ E₂ : ℝ) : ℝ := 1 / (f / E₁ + (1 - f) / E₂)
theorem wrong_direction (f E₁ E₂ : ℝ) (hf0 : 0 ≤ f) (hf1 : f ≤ 1) (h1 : 0 < E₁) (h2 : 0 < E₂) :
    voigt f E₁ E₂ ≤ reuss f E₁ E₂ := by
  sorry
end BmMaterials.Control
#print axioms BmMaterials.Control.wrong_direction
