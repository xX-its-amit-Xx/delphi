/-
Copyright (c) 2026 Joel Dietz. All rights reserved.
Released under Apache 2.0 license as described in the file LICENSE.
Authors: Joel Dietz
-/
import Mathlib

/-!
# The Timoshenko bilayer ceiling, and the design rule it licenses

PROPOSED ADDITION to `lean/ThompsonLaws/Hygromorphs.lean`. It is parked here, under `tracks/`,
because `lean/` belongs to another thread; it is written against that file's existing
`timoshenkoCoefficient` so it can be pasted in unchanged, below `bilayerCurvature_symmetric`.

CHECKED BY THE LEAN KERNEL on 2026-11-12 (see `HygromorphCeilingCheck.lean` and `check.sh`): no errors, and
all five theorems depend only on `propext`, `Classical.choice` and `Quot.sound`. The first attempt did NOT
check - the kernel found three real errors in proofs written without it - and the versions below are the
ones that passed. Separately, the arithmetic was verified independently of the agent that proposed the
result: `tracks/scripts/check-timoshenko-ceiling.py` evaluates the coefficient on a dense grid over
six decades in each variable (maximum 1.4999982), confirms equality with exactly `3/2` in rational
arithmetic at `m = n^(-1/2)` for n = 1, 4, 9, 25, 100, 961, and fails to beat `3/2` from 4,000
random-start hill climbs. The statements are still PROPOSED for the registry: the kernel has checked the proofs, not the claim that
this belongs in the law set.

## Why this one theorem matters

`timoshenkoCoefficient h m n` is `(1/h) * f m n` where

  f m n = 6(1+m)^2 / (3(1+m)^2 + (1+mn)(m^2 + 1/(mn)))

with `m` the thickness ratio and `n` the modulus ratio of the two layers. The modulus ratio of a
printed part is the quantity hardest to measure honestly: it changes with cure, with direction, and
with how wet the part is.

The ceiling removes it. `f ≤ 3/2` always, with equality exactly when `m^2 * n = 1`, so a strip built
at its optimal thickness ratio has

  κ = (3/2) Δε / h    and    R = h / (1.5 Δε)

in which `n` does not appear. The design prediction then needs only a swelling strain measured on a
free coupon and a thickness read with callipers — no fitted parameter, nothing taken from a data
sheet. That is what turns a formula into a constraint a design has to obey, and it is the form the
project's elimination certificates take: a design claiming a radius below `h / (1.5 Δε)` is ruled
out whatever its materials.

## The mathematics

Expanding the second bracket of the denominator,

  (1 + mn)(m^2 + 1/(mn)) = m^2 + 1/(mn) + m^3 n + 1

and the only terms carrying `n` are `m^3 n` and `1/(mn)`, whose product is `m^2`. By AM-GM their sum
is at least `2m`, with equality exactly when `m^3 n = 1/(mn)`, that is when `m^2 n = 1`. So

  denominator ≥ 3(1+m)^2 + 1 + m^2 + 2m = 3(1+m)^2 + (1+m)^2 = 4(1+m)^2

and `f ≤ 6/4 = 3/2`.
-/

namespace ThompsonLaws.Hygromorphs

noncomputable section

open Real

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
