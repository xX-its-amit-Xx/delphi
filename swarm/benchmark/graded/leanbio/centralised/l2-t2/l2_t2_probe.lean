import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t2_probe (eta E Q Ca Cv Pdem Pavail Paer : ℝ) : ¬ (Pdem ≤ Paer) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
