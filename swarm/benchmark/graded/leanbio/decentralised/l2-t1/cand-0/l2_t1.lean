import Mathlib

theorem l2_t1 (m₁ S₁ m₂ S₂ g ρ CLmax : ℝ)
    (hm₁ : 0 < m₁) (hm₂ : 0 < m₂) (hS₁ : 0 < S₁) (hS₂ : 0 < S₂)
    (hg : 0 < g) (hρ : 0 < ρ) (hCL : 0 < CLmax)
    (hload : m₁ / S₁ < m₂ / S₂) :
    Real.sqrt (2 * m₁ * g / (ρ * S₁ * CLmax)) < Real.sqrt (2 * m₂ * g / (ρ * S₂ * CLmax)) := by
  have h1 : ρ ≠ 0 := hρ.ne'
  have h2 : CLmax ≠ 0 := hCL.ne'
  have h3 : S₁ ≠ 0 := hS₁.ne'
  have h4 : S₂ ≠ 0 := hS₂.ne'
  have e1 : 2 * m₁ * g / (ρ * S₁ * CLmax) = (2 * g / (ρ * CLmax)) * (m₁ / S₁) := by
    first | (field_simp; done) | (field_simp; ring)
  have e2 : 2 * m₂ * g / (ρ * S₂ * CLmax) = (2 * g / (ρ * CLmax)) * (m₂ / S₂) := by
    first | (field_simp; done) | (field_simp; ring)
  have hc : 0 < 2 * g / (ρ * CLmax) := by positivity
  have hlt : 2 * m₁ * g / (ρ * S₁ * CLmax) < 2 * m₂ * g / (ρ * S₂ * CLmax) := by
    rw [e1, e2]
    exact mul_lt_mul_of_pos_left hload hc
  have hnn : 0 ≤ 2 * m₁ * g / (ρ * S₁ * CLmax) := by positivity
  exact Real.sqrt_lt_sqrt hnn hlt

theorem l2_t1_witness :
    ∃ (m₁ S₁ m₂ S₂ g ρ CLmax : ℝ),
      0 < m₁ ∧ 0 < m₂ ∧ 0 < S₁ ∧ 0 < S₂ ∧ 0 < g ∧ 0 < ρ ∧ 0 < CLmax ∧
      m₁ / S₁ < m₂ / S₂ := by
  refine ⟨1, 1, 2, 1, 10, 1, 1, ?_⟩
  norm_num
