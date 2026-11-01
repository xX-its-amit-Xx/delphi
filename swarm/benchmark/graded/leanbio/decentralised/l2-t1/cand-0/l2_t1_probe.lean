import Mathlib

set_option maxHeartbeats 400000 in
theorem l2_t1_probe (m₁ S₁ m₂ S₂ g ρ CLmax : ℝ) : Real.sqrt (2 * m₁ * g / (ρ * S₁ * CLmax)) < Real.sqrt (2 * m₂ * g / (ρ * S₂ * CLmax)) := by
  first
  | norm_num
  | positivity
  | simp
  | trivial
  | tauto
  | nlinarith
  | aesop
