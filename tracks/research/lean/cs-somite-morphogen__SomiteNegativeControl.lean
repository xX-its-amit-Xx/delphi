import Mathlib
/-! Negative control for SomiteMorphogenCase.somite_length_temperature_free. Deliberately false: somite length that still depends on temperature after the cancellation.
The checker must REJECT this file. Written 2026-11-15 because the suite gate (rule L1) found the case had none. -/
theorem length_not_free : ((2:ℝ) * (3 - 1)) * (5 / (3 - 1)) = 2 * 5 + 1 := by norm_num
#print axioms length_not_free
