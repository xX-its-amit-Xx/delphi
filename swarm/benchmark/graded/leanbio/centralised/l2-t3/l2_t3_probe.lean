import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t3_probe (D k : ℝ) : Real.sqrt (D / (k / 2)) = Real.sqrt 2 * Real.sqrt (D / k) ∧
      Real.sqrt (D / k) ^ 2 = D / k := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
