-- Deliberately false: a 5 mm/s, 5 mm body is NOT low-Reynolds. Lean must reject this file.
theorem big_fast_is_lowRe : 5000 * 5000 ≤ 1000000 := by decide
