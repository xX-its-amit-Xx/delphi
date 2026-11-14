import Mathlib

/-! Falsifier form of the Timoshenko ceiling. First part copied unchanged from
`tracks/lean/HygromorphCeilingCheck.lean` (defs, amgm_step, timoshenkoCoefficient_le). -/

namespace ThompsonLaws.Hygromorphs

noncomputable section

open Real

/-- Copied unchanged from `lean/ThompsonLaws/Hygromorphs.lean`. -/
def timoshenkoCoefficient (h m n : ℝ) : ℝ :=
  (1 / h) * (6 * (1 + m) ^ 2) / (3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)))

/-- Copied unchanged from `lean/ThompsonLaws/Hygromorphs.lean`. -/
def bilayerCurvature (h m n Δε : ℝ) : ℝ := timoshenkoCoefficient h m n * Δε

theorem amgm_step (m n : ℝ) (hm : 0 < m) (hn : 0 < n) :
    2 * m ≤ m ^ 3 * n + 1 / (m * n) := by
  have hmn : 0 < m * n := mul_pos hm hn
  have ha : 0 < m ^ 3 * n := mul_pos (pow_pos hm 3) hn
  have hb : 0 < 1 / (m * n) := one_div_pos.mpr hmn
  have hprod : m ^ 3 * n * (1 / (m * n)) = m ^ 2 := by field_simp
  by_contra hcon
  rw [not_le] at hcon
  have hpos : 0 < m ^ 3 * n + 1 / (m * n) := add_pos ha hb
  have h1 : 0 < 2 * m - (m ^ 3 * n + 1 / (m * n)) := by linarith
  have h2 : 0 < 2 * m + (m ^ 3 * n + 1 / (m * n)) := by linarith
  nlinarith [mul_pos h1 h2, sq_nonneg (m ^ 3 * n - 1 / (m * n)), hprod]

theorem timoshenkoCoefficient_le (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n) :
    timoshenkoCoefficient h m n ≤ 3 / (2 * h) := by
  unfold timoshenkoCoefficient
  have hmn : 0 < m * n := mul_pos hm hn
  have hden : 0 < 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by
    have : 0 < (1 + m) ^ 2 := by positivity
    have : 0 < (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by positivity
    linarith
  have hexp : (1 + m * n) * (m ^ 2 + 1 / (m * n)) = m ^ 2 + 1 / (m * n) + m ^ 3 * n + 1 := by
    field_simp
    ring
  have hge : 4 * (1 + m) ^ 2 ≤ 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by
    rw [hexp]; nlinarith [amgm_step m n hm hn]
  rw [div_le_iff₀ hden]
  calc 1 / h * (6 * (1 + m) ^ 2) = 3 / (2 * h) * (4 * (1 + m) ^ 2) := by ring
    _ ≤ 3 / (2 * h) * (3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n))) :=
        mul_le_mul_of_nonneg_left hge (by positivity)


/-- Ceiling on curvature itself (differential strain `Δε ≥ 0`). -/
theorem bilayerCurvature_le (h m n Δε : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n) (hε : 0 ≤ Δε) :
    bilayerCurvature h m n Δε ≤ 3 / (2 * h) * Δε := by
  unfold bilayerCurvature
  exact mul_le_mul_of_nonneg_right (timoshenkoCoefficient_le h m n hh hm hn) hε

/-- FALSIFIER. If a measured curvature `κ` has dimensionless value `κ h / Δε > 3/2`, then no
positive thickness ratio `m` and modulus ratio `n` make the strip Timoshenko law reproduce it:
the measurement refutes the hypothesis set (strip law + this `Δε` + this `h`), whatever the moduli. -/
theorem exceeds_ceiling_refutes (h Δε κ : ℝ) (hh : 0 < h) (hε : 0 < Δε)
    (hex : 3 / 2 < κ * h / Δε) :
    ∀ m n : ℝ, 0 < m → 0 < n → κ ≠ bilayerCurvature h m n Δε := by
  intro m n hm hn heq
  have hle := bilayerCurvature_le h m n Δε hh hm hn hε.le
  rw [← heq] at hle
  have h1 : κ * h / Δε ≤ 3 / 2 := by
    rw [div_le_iff₀ hε]
    have : κ * h ≤ 3 / (2 * h) * Δε * h := mul_le_mul_of_nonneg_right hle hh.le
    have e : 3 / (2 * h) * Δε * h = 3 / 2 * Δε := by field_simp
    linarith
  linarith

/-- Wide-plate variant: if the strip value is amplified by `(1+ν)` (sheet rolled to a cylinder),
the ceiling becomes `(3/2)(1+ν)`, at most `9/4` for `ν ≤ 1/2`. -/
theorem plateCurvature_le (h m n Δε ν : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n) (hε : 0 ≤ Δε)
    (hν0 : 0 ≤ ν) (hν : ν ≤ 1 / 2) :
    (1 + ν) * bilayerCurvature h m n Δε ≤ 9 / 4 * (Δε / h) := by
  have hle := bilayerCurvature_le h m n Δε hh hm hn hε
  have e : 3 / (2 * h) * Δε = 3 / 2 * (Δε / h) := by field_simp
  rw [e] at hle
  have hq : 0 ≤ Δε / h := div_nonneg hε hh.le
  nlinarith [mul_nonneg hν0 hq, mul_nonneg (sub_nonneg.mpr hν) hq]

/-- The largest development record of this run (Rüggeberg & Burgert 2015, 6 h cycle, 0.2/4 mm):
κ = 0.0020 /mm, h = 4.2 mm, Δε = 0.004069 gives κh/Δε ≈ 2.06 > 3/2, so under the strip law it
is unreachable for every m, n. (What gives is a hypothesis: Δε there is inferred, not measured.) -/
example : ∀ m n : ℝ, 0 < m → 0 < n →
    (0.0020 : ℝ) ≠ bilayerCurvature 4.2 m n 0.004069 :=
  exceeds_ceiling_refutes 4.2 0.004069 0.0020 (by norm_num) (by norm_num) (by norm_num)

end

end ThompsonLaws.Hygromorphs

-- axiom audit lines added by tracks/scripts/add-axiom-audit.py
#print axioms ThompsonLaws.Hygromorphs.amgm_step
#print axioms ThompsonLaws.Hygromorphs.timoshenkoCoefficient_le
#print axioms ThompsonLaws.Hygromorphs.bilayerCurvature_le
#print axioms ThompsonLaws.Hygromorphs.exceeds_ceiling_refutes
#print axioms ThompsonLaws.Hygromorphs.plateCurvature_le
