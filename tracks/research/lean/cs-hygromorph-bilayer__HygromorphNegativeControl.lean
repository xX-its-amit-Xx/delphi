import Mathlib
/-! Negative control for ThompsonLaws.Hygromorphs.amgm_step. Deliberately false: the inequality reversed at m = 1, n = 2 (it would let a strip beat the 3/2 ceiling).
The checker must REJECT this file. Written 2026-11-15 because the suite gate (rule L1) found the case had none. -/
theorem amgm_reversed : (1:ℝ) ^ 3 * 2 + 1 / (1 * 2) < 2 * 1 := by norm_num
#print axioms amgm_reversed
