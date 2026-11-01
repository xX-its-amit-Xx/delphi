import Mathlib

theorem l2_t1 (m₁ m₂ S₁ S₂ g ρ CL : ℝ)
    (hg : 0 < g) (hρ : 0 < ρ) (hS₁ : 0 < S₁) (hS₂ : 0 < S₂) (hCL : 0 < CL)
    (hm₁ : 0 < m₁) (hm₂ : 0 < m₂) (h : m₁ / S₁ < m₂ / S₂) :
    Real.sqrt (2 * m₁ * g / (ρ * S₁ * CL)) < Real.sqrt (2 * m₂ * g / (ρ * S₂ * CL)) := by
  have key : ∀ m S : ℝ, 0 < S → 2 * m * g / (ρ * S * CL) = 2 * g / (ρ * CL) * (m / S) := by
    intro m S hS
    have h1 := hρ.ne'
    have h2 := hS.ne'
    have h3 := hCL.ne'
    field_simp
  apply Real.sqrt_lt_sqrt
  · positivity
  · rw [key m₁ S₁ hS₁, key m₂ S₂ hS₂]
    exact mul_lt_mul_of_pos_left h (by positivity)

theorem l2_t1_witness : ∃ (m₁ m₂ S₁ S₂ g ρ CL : ℝ),
    0 < g ∧ 0 < ρ ∧ 0 < S₁ ∧ 0 < S₂ ∧ 0 < CL ∧ 0 < m₁ ∧ 0 < m₂ ∧ m₁ / S₁ < m₂ / S₂ := by
  refine ⟨1, 2, 1, 1, 10, 1, 1, ?_⟩
  norm_num
