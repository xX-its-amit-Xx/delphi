/-
Copyright (c) 2026 Joel Dietz. All rights reserved.
Released under Apache 2.0 license as described in the file LICENSE.
Authors: Joel Dietz
-/
import Mathlib

/-!
# Checkable copy of the Timoshenko ceiling

`HygromorphCeiling.lean` is the version written to be pasted into
`lean/ThompsonLaws/Hygromorphs.lean`, so it refers to that file's `timoshenkoCoefficient` and
`bilayerCurvature` without defining them. This copy carries the two definitions, copied unchanged
from that file, so it can be handed to the Lean kernel on its own without touching `lean/`:

    cd lean && lake env lean ../tracks/lean/HygromorphCeilingCheck.lean

If this file and `HygromorphCeiling.lean` ever differ in a theorem, this one is the one that was run.
-/

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

theorem timoshenkoCoefficient_eq_of_optimal (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hopt : m ^ 2 * n = 1) :
    timoshenkoCoefficient h m n = 3 / (2 * h) := by
  unfold timoshenkoCoefficient
  have hmn : 0 < m * n := mul_pos hm hn
  have hn' : n = 1 / m ^ 2 := by field_simp at hopt ⊢; nlinarith [hopt]
  subst hn'
  field_simp
  ring

theorem bilayerCurvature_optimal (h m n Δε : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hopt : m ^ 2 * n = 1) :
    bilayerCurvature h m n Δε = 3 / 2 * Δε / h := by
  unfold bilayerCurvature
  rw [timoshenkoCoefficient_eq_of_optimal h m n hh hm hn hopt]
  field_simp

theorem bilayer_rules_out (h m n Δε κ_claimed : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hΔ : 0 < Δε) (hclaim : 3 / 2 * Δε / h < κ_claimed) :
    bilayerCurvature h m n Δε < κ_claimed := by
  have hle : timoshenkoCoefficient h m n ≤ 3 / (2 * h) := timoshenkoCoefficient_le h m n hh hm hn
  have : bilayerCurvature h m n Δε ≤ 3 / 2 * Δε / h := by
    unfold bilayerCurvature
    calc timoshenkoCoefficient h m n * Δε
        ≤ 3 / (2 * h) * Δε := by nlinarith [hle, hΔ.le]
      _ = 3 / 2 * Δε / h := by field_simp
  linarith

end

end ThompsonLaws.Hygromorphs

/-! Axiom audit. Each line must print only the three standard axioms (`propext`, `Classical.choice`,
`Quot.sound`) and never `sorryAx`. -/
#print axioms ThompsonLaws.Hygromorphs.amgm_step
#print axioms ThompsonLaws.Hygromorphs.timoshenkoCoefficient_le
#print axioms ThompsonLaws.Hygromorphs.timoshenkoCoefficient_eq_of_optimal
#print axioms ThompsonLaws.Hygromorphs.bilayerCurvature_optimal
#print axioms ThompsonLaws.Hygromorphs.bilayer_rules_out
