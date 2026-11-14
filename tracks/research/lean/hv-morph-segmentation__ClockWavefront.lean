import Mathlib

/-!
Clock-and-wavefront arithmetic (Cooke & Zeeman 1976, doi:10.1016/S0022-5193(76)80131-2).
Model assumptions are named hypotheses; nothing biological is proved here, only what follows
from the model S = v * T (segment length = wavefront speed x clock period).
-/

namespace ClockWavefront

/-- Slowing the clock by a factor k lengthens each segment by the same factor. -/
theorem seg_length_scales (v T k : ℝ) : v * (k * T) = k * (v * T) := by ring

/-- With the tissue length L and wavefront speed v unchanged, slowing the clock by a factor k
divides the number of segments by k. -/
theorem seg_number_scales (L v T k : ℝ) : L / (v * (k * T)) = L / (v * T) / k := by
  rw [div_div]; congr 1; ring

/-- A longer period gives a strictly longer segment (positive wavefront speed). -/
theorem seg_longer (v T T' : ℝ) (hv : 0 < v) (h : T < T') : v * T < v * T' :=
  mul_lt_mul_of_pos_left h hv

/-- A longer period gives strictly fewer segments along a fixed length. -/
theorem seg_fewer (L v T T' : ℝ) (hL : 0 < L) (hv : 0 < v) (hT : 0 < T) (h : T < T') :
    L / (v * T') < L / (v * T) := by
  have h1 : 0 < v * T := mul_pos hv hT
  have h2 : v * T < v * T' := mul_lt_mul_of_pos_left h hv
  have h3 : 0 < v * T' := lt_trans h1 h2
  rw [div_eq_mul_inv, div_eq_mul_inv]
  apply mul_lt_mul_of_pos_left _ hL
  rw [← one_div, ← one_div]
  exact one_div_lt_one_div_of_lt h1 h2

/-- One segment per clock cycle: if N cycles of period T fill a duration D, then N = D / T. -/
theorem count_from_duration (N D T : ℝ) (hT : T ≠ 0) (h : N * T = D) : N = D / T :=
  eq_div_of_mul_eq hT h

/-- Total axis length is the sum of segments: N segments of length v * T span v * D
when the clock runs for D = N * T. -/
theorem axis_length (N v T D : ℝ) (h : N * T = D) : N * (v * T) = v * D := by
  rw [← h]; ring

end ClockWavefront

#print axioms ClockWavefront.seg_length_scales
#print axioms ClockWavefront.seg_number_scales
#print axioms ClockWavefront.seg_longer
#print axioms ClockWavefront.seg_fewer
#print axioms ClockWavefront.count_from_duration
#print axioms ClockWavefront.axis_length
