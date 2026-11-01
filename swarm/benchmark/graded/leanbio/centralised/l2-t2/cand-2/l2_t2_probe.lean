import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t2_probe (eta E Q Ca Cv Pa Pdem : ℝ) : ¬ (Pdem ≤ Pa) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
