import Mathlib

theorem l2_t3 (D k : ℝ) (hD : 0 ≤ D) (hk : 0 < k) :
    Real.sqrt (D / (k / 2)) = Real.sqrt 2 * Real.sqrt (D / k) := by
  have hk' : k ≠ 0 := hk.ne'
  have h : D / (k / 2) = 2 * (D / k) := by
    field_simp <;> ring
  rw [h, Real.sqrt_mul (by norm_num : (0:ℝ) ≤ 2)]

theorem l2_t3_witness : ∃ D k : ℝ, 0 ≤ D ∧ 0 < k := by
  exact ⟨4, 1, by norm_num, by norm_num⟩
