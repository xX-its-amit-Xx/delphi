import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t2_probe (eta E Q Ca Cv Pdem VO2 : ℝ) : ¬ (Pdem ≤ eta * E * VO2) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
