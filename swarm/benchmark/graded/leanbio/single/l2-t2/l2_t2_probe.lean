import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t2_probe (eta E Q Ca Cv Pavail Pdemand Psup : ℝ) : ¬ (Pdemand ≤ Psup) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
