import Mathlib

theorem l2_t3 (D k : ℝ) (hk : 0 < k) (hD : 0 ≤ D) : (0:ℝ) ≤ Real.sqrt (D / k) := Real.sqrt_nonneg _

theorem l2_t3_witness : ∃ D k : ℝ, 0 < k ∧ 0 ≤ D := ⟨1, 1, by norm_num, by norm_num⟩
