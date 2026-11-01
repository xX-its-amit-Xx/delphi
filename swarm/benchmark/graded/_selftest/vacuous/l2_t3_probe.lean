import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t3_probe (D k : ℝ) : (0:ℝ) ≤ Real.sqrt (D / k) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
