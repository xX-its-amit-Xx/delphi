import Mathlib

theorem l2_t1 (m1 m2 S rho g CL : ℝ) (hrho : 0 < rho) (hS : 0 < S) (hCL : 0 < CL)
    (hg : 0 < g) (hm1 : 0 < m1) (hwl : m1 / S < m2 / S) :
    Real.sqrt (2 * m1 * g / (rho * S * CL)) < Real.sqrt (2 * m2 * g / (rho * S * CL)) := by
  -- PLACEHOLDER PROOF (to be replaced by the proof agent)
  sorry

theorem l2_t1_witness : ∃ (m1 m2 S rho g CL : ℝ), 0 < rho ∧ 0 < S ∧ 0 < CL ∧ 0 < g ∧ 0 < m1 ∧ m1 / S < m2 / S := by
  refine ⟨1, 2, 1, 1, 1, 1, ?_⟩
  norm_num
