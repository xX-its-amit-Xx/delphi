import Mathlib

/-
  Track 1 (reporter gates): threshold-steepness separability of a Hill repressor gate.
  Cello form of the gate transfer function:  y = ymin + (ymax - ymin) / (1 + (x/K)^n).
  PROVED (no hypothesis beyond positivity of K, n, x, c):
    * rescaling the threshold K by any factor is exactly a rescaling of the input x (a translation
      in log x); n is untouched                                   -> repress_scale, repress_threshold_shift
    * the half-maximal output is at x = K                          -> repress_at_K
    * the input giving normalised activation level p in (0,1) is K*(p/(1-p))^(1/n) -> hill_level_unique
    * two gates with the same n and different K have the SAME threshold fold K2/K1 at EVERY
      level p                                                      -> level_fold
    * the 10%-to-90% input span is 81^(1/n), independent of K      -> span_81
  NOT established: that any real RBS change leaves n unchanged (that is the empirical claim the
  track tests); nothing about noise, dynamics or fitting.
-/

namespace Delphi.Track1.HillSeparability

/-- Activating Hill function, normalised to [0,1). -/
noncomputable def hill (K n x : ℝ) : ℝ := x ^ n / (K ^ n + x ^ n)

/-- Cello repressor transfer function, written exactly as in the UCF `Hill_response`. -/
noncomputable def repress (ymin ymax K n x : ℝ) : ℝ :=
  ymin + (ymax - ymin) / (1 + (x / K) ^ n)

theorem repress_scale {c K x : ℝ} (ymin ymax n : ℝ) (hc : c ≠ 0) :
    repress ymin ymax (c * K) n (c * x) = repress ymin ymax K n x := by
  unfold repress
  rw [mul_div_mul_left _ _ hc]

theorem repress_threshold_shift {K1 K2 : ℝ} (ymin ymax n x : ℝ) (h1 : 0 < K1) (h2 : 0 < K2) :
    repress ymin ymax K2 n x = repress ymin ymax K1 n (x * K1 / K2) := by
  unfold repress
  have : x * K1 / K2 / K1 = x / K2 := by field_simp
  rw [this]

theorem repress_at_K {K : ℝ} (ymin ymax n : ℝ) (hK : 0 < K) (hn : 0 < n) :
    repress ymin ymax K n K = (ymin + ymax) / 2 := by
  unfold repress
  rw [div_self hK.ne', Real.one_rpow]
  ring

theorem hill_level {K n p : ℝ} (hK : 0 < K) (hn : 0 < n) (hp0 : 0 < p) (hp1 : p < 1) :
    hill K n (K * (p / (1 - p)) ^ (1 / n)) = p := by
  have hq : 0 < p / (1 - p) := div_pos hp0 (by linarith)
  have hxn : (K * (p / (1 - p)) ^ (1 / n)) ^ n = K ^ n * (p / (1 - p)) := by
    rw [Real.mul_rpow hK.le (Real.rpow_nonneg hq.le _), ← Real.rpow_mul hq.le,
      one_div, inv_mul_cancel₀ hn.ne', Real.rpow_one]
  have hKn : 0 < K ^ n := Real.rpow_pos_of_pos hK n
  unfold hill
  rw [hxn]
  have h1p : (1 - p) ≠ 0 := by linarith
  field_simp
  ring

theorem hill_level_unique {K n p x : ℝ} (hK : 0 < K) (hn : 0 < n) (hp0 : 0 < p) (hp1 : p < 1)
    (hx : 0 < x) (h : hill K n x = p) : x = K * (p / (1 - p)) ^ (1 / n) := by
  have hq : 0 < p / (1 - p) := div_pos hp0 (by linarith)
  have hKn : 0 < K ^ n := Real.rpow_pos_of_pos hK n
  have hxn0 : 0 < x ^ n := Real.rpow_pos_of_pos hx n
  have hxn : x ^ n = K ^ n * (p / (1 - p)) := by
    unfold hill at h
    have h1p : (1 - p) ≠ 0 := by linarith
    field_simp
    rw [div_eq_iff (by positivity)] at h
    nlinarith [h]
  have key : x = (x ^ n) ^ (1 / n) := by
    rw [← Real.rpow_mul hx.le, mul_one_div_cancel hn.ne', Real.rpow_one]
  rw [key, hxn, Real.mul_rpow hKn.le hq.le, ← Real.rpow_mul hK.le,
    mul_one_div_cancel hn.ne', Real.rpow_one]

/-- Same steepness, different threshold: the input threshold fold is K2/K1 at every level. -/
theorem level_fold {K1 K2 n p x1 x2 : ℝ} (h1 : 0 < K1) (h2 : 0 < K2) (hn : 0 < n)
    (hp0 : 0 < p) (hp1 : p < 1) (hx1 : 0 < x1) (hx2 : 0 < x2)
    (e1 : hill K1 n x1 = p) (e2 : hill K2 n x2 = p) : x2 / x1 = K2 / K1 := by
  rw [hill_level_unique h1 hn hp0 hp1 hx1 e1, hill_level_unique h2 hn hp0 hp1 hx2 e2]
  have : 0 < (p / (1 - p)) ^ (1 / n) := Real.rpow_pos_of_pos (div_pos hp0 (by linarith)) _
  field_simp

/-- The 10%-to-90% input span of a Hill gate is 81^(1/n), whatever K is. -/
theorem span_81 {K n x1 x2 : ℝ} (hK : 0 < K) (hn : 0 < n) (hx1 : 0 < x1) (hx2 : 0 < x2)
    (e1 : hill K n x1 = 1 / 10) (e2 : hill K n x2 = 9 / 10) : x2 / x1 = (81 : ℝ) ^ (1 / n) := by
  rw [hill_level_unique hK hn (by norm_num) (by norm_num) hx1 e1,
    hill_level_unique hK hn (by norm_num) (by norm_num) hx2 e2]
  have hA : (0 : ℝ) < ((9 / 10) / (1 - 9 / 10)) ^ (1 / n) := Real.rpow_pos_of_pos (by norm_num) _
  have hB : (0 : ℝ) < ((1 / 10) / (1 - 1 / 10)) ^ (1 / n) := Real.rpow_pos_of_pos (by norm_num) _
  rw [mul_div_mul_left _ _ hK.ne', ← Real.div_rpow (by norm_num) (by norm_num)]
  norm_num

theorem span_independent_of_K {K1 K2 n x1 x2 y1 y2 : ℝ} (h1 : 0 < K1) (h2 : 0 < K2) (hn : 0 < n)
    (hx1 : 0 < x1) (hx2 : 0 < x2) (hy1 : 0 < y1) (hy2 : 0 < y2)
    (a1 : hill K1 n x1 = 1 / 10) (a2 : hill K1 n x2 = 9 / 10)
    (b1 : hill K2 n y1 = 1 / 10) (b2 : hill K2 n y2 = 9 / 10) : x2 / x1 = y2 / y1 := by
  rw [span_81 h1 hn hx1 hx2 a1 a2, span_81 h2 hn hy1 hy2 b1 b2]

#print axioms Delphi.Track1.HillSeparability.repress_scale
#print axioms Delphi.Track1.HillSeparability.repress_threshold_shift
#print axioms Delphi.Track1.HillSeparability.repress_at_K
#print axioms Delphi.Track1.HillSeparability.hill_level
#print axioms Delphi.Track1.HillSeparability.hill_level_unique
#print axioms Delphi.Track1.HillSeparability.level_fold
#print axioms Delphi.Track1.HillSeparability.span_81
#print axioms Delphi.Track1.HillSeparability.span_independent_of_K

end Delphi.Track1.HillSeparability
