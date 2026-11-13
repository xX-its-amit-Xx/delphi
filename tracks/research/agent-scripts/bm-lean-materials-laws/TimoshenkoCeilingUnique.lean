import Mathlib

/-!
# Extra (label bm-lean-materials-laws): the Timoshenko ceiling 3/(2h) is reached ONLY at m^2 n = 1

The project's `HygromorphCeilingCheck.lean` proves `f <= 3/(2h)` and `f = 3/(2h)` when `m^2 n = 1`.
It does not prove the converse. This file proves it, so the optimum is a characterisation, not
only a sufficient condition. The definition is copied unchanged from that file.
-/

namespace BmMaterials.TimoshenkoUnique

noncomputable section

/-- Copied unchanged from `tracks/lean/HygromorphCeilingCheck.lean`. -/
def timoshenkoCoefficient (h m n : ℝ) : ℝ :=
  (1 / h) * (6 * (1 + m) ^ 2) / (3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)))

theorem ceiling_only_at_optimum (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hceil : timoshenkoCoefficient h m n = 3 / (2 * h)) : m ^ 2 * n = 1 := by
  unfold timoshenkoCoefficient at hceil
  have hmn : 0 < m * n := mul_pos hm hn
  set u : ℝ := 1 / (m * n) with hu_def
  have hu : u * (m * n) = 1 := by rw [hu_def]; field_simp
  have hupos : 0 < u := one_div_pos.mpr hmn
  have hden : 0 < 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + u) := by positivity
  rw [div_eq_div_iff hden.ne' (by positivity)] at hceil
  have h2 : 3 * (1 + m * n) * (m ^ 2 + u) * 1 + 9 * (1 + m) ^ 2 - 12 * (1 + m) ^ 2 = 0 := by
    field_simp at hceil
    nlinarith [hceil]
  have h3 : (1 + m * n) * (m ^ 2 + u) = (1 + m) ^ 2 := by nlinarith [h2]
  have h4 : u + m ^ 3 * n = 2 * m := by nlinarith [h3, hu]
  have h5 : (m ^ 2 * n - 1) ^ 2 = 0 := by
    have : (u + m ^ 3 * n) * (m * n) = 2 * m * (m * n) := by rw [h4]
    nlinarith [this, hu]
  have := pow_eq_zero_iff (n := 2) (by norm_num) |>.mp h5
  linarith

end

end BmMaterials.TimoshenkoUnique

#print axioms BmMaterials.TimoshenkoUnique.ceiling_only_at_optimum
