import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t1_probe (m₁ m₂ S₁ S₂ g ρ CL : ℝ) : Real.sqrt (2 * m₁ * g / (ρ * S₁ * CL)) < Real.sqrt (2 * m₂ * g / (ρ * S₂ * CL)) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
