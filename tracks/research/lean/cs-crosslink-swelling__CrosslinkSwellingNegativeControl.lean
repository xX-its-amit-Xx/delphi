import Mathlib
/-! Negative control for CrosslinkSwelling.modulus_strictMono. Deliberately false: stiffness FALLING as crosslink density doubles.
The checker must REJECT this file. Written 2026-11-15 because the suite gate (rule L1) found the case had none. -/
theorem modulus_falls : (2:ℝ) * 1 < 1 * 1 := by norm_num
#print axioms modulus_falls
