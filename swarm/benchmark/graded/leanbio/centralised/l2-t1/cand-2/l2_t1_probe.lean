import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t1_probe (m1 m2 S rho g CL : ℝ) : Real.sqrt (2 * m1 * g / (rho * S * CL)) < Real.sqrt (2 * m2 * g / (rho * S * CL)) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
