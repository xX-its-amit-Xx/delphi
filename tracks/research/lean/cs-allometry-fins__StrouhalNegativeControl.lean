import Mathlib
/-! Negative control for StrouhalBainbridge.strouhal_of_bainbridge. Deliberately false: the intercept term with the wrong sign, at f = 2, A = U = L = 1.
The checker must REJECT this file. Written 2026-11-15 because the suite gate (rule L1) found the case had none. -/
theorem strouhal_wrong_sign : (2:ℝ) * 1 / 1 = 1 * (1 - 1 / (1 / 1)) := by norm_num
#print axioms strouhal_wrong_sign
