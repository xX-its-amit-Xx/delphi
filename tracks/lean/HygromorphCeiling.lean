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

NOT YET CHECKED BY LEAN. Mathlib is not built in this session, so these proofs have not been through
the kernel. What HAS been done is the arithmetic, independently of the agent that proposed the
result: `tracks/scripts/check-timoshenko-ceiling.py` evaluates the coefficient on a dense grid over
six decades in each variable (maximum 1.4999982), confirms equality with exactly `3/2` in rational
arithmetic at `m = n^(-1/2)` for n = 1, 4, 9, 25, 100, 961, and fails to beat `3/2` from 4,000
random-start hill climbs. Treat the statements as proposed and the proofs as sketches until the
kernel says otherwise.

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

/-- The AM-GM step, isolated: the two `n`-bearing terms of the denominator sum to at least `2m`,
with equality exactly at `m^2 n = 1`. Everything else in the ceiling is algebra. -/
theorem amgm_step (m n : ℝ) (hm : 0 < m) (hn : 0 < n) :
    2 * m ≤ m ^ 3 * n + 1 / (m * n) := by
  have hmn : 0 < m * n := mul_pos hm hn
  have key : 0 ≤ (m ^ 3 * n - 1 / (m * n)) ^ 2 := sq_nonneg _
  have hprod : m ^ 3 * n * (1 / (m * n)) = m ^ 2 := by field_simp; ring
  nlinarith [key, hprod, mul_pos (mul_pos (pow_pos hm 3) hn) (one_div_pos.mpr hmn)]

/-- **The ceiling.** For physical thickness and ratios the Timoshenko coefficient never exceeds
`3 / (2h)`, whatever the modulus ratio. -/
theorem timoshenkoCoefficient_le (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n) :
    timoshenkoCoefficient h m n ≤ 3 / (2 * h) := by
  unfold timoshenkoCoefficient
  have hmn : 0 < m * n := mul_pos hm hn
  have hden : 0 < 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by
    have : 0 < (1 + m) ^ 2 := by positivity
    have : 0 < (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by positivity
    linarith
  have hexp : (1 + m * n) * (m ^ 2 + 1 / (m * n)) = m ^ 2 + 1 / (m * n) + m ^ 3 * n + 1 := by
    field_simp; ring
  have hge : 4 * (1 + m) ^ 2 ≤ 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by
    rw [hexp]; nlinarith [amgm_step m n hm hn]
  rw [div_le_div_iff (by positivity) (by positivity)]
  nlinarith [hge, sq_nonneg (1 + m), hh.le]

/-- **The optimum is attained.** At `m = n^(-1/2)` the ceiling is reached exactly, so the bound is
sharp and the optimal thickness ratio is a function of the modulus ratio alone. -/
theorem timoshenkoCoefficient_eq_of_optimal (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hopt : m ^ 2 * n = 1) :
    timoshenkoCoefficient h m n = 3 / (2 * h) := by
  unfold timoshenkoCoefficient
  have hmn : 0 < m * n := mul_pos hm hn
  have hn' : n = 1 / m ^ 2 := by field_simp at hopt ⊢; nlinarith [hopt]
  subst hn'
  field_simp
  ring

/-- **The curvature form**, which is what a design is checked against: at the optimal thickness
ratio the radius is `h / (1.5 Δε)` and the modulus ratio has dropped out of the prediction. -/
theorem bilayerCurvature_optimal (h m n Δε : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hopt : m ^ 2 * n = 1) :
    bilayerCurvature h m n Δε = 3 / 2 * Δε / h := by
  unfold bilayerCurvature
  rw [timoshenkoCoefficient_eq_of_optimal h m n hh hm hn hopt]
  field_simp; ring

/-- **The elimination certificate.** A bilayer strip of total thickness `h` under mismatch `Δε`
cannot reach a curvature above `3Δε / (2h)`, so a design claiming one is ruled out — whatever
materials it proposes, because `n` does not appear in the bound. This is the hygromorph analogue of
the `*_rules_out` certificates in `lean/Delphi/Certificates`. -/
theorem bilayer_rules_out (h m n Δε κ_claimed : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hΔ : 0 < Δε) (hclaim : 3 / 2 * Δε / h < κ_claimed) :
    bilayerCurvature h m n Δε < κ_claimed := by
  have hle : timoshenkoCoefficient h m n ≤ 3 / (2 * h) := timoshenkoCoefficient_le h m n hh hm hn
  have : bilayerCurvature h m n Δε ≤ 3 / 2 * Δε / h := by
    unfold bilayerCurvature
    calc timoshenkoCoefficient h m n * Δε
        ≤ 3 / (2 * h) * Δε := by nlinarith [hle, hΔ.le]
      _ = 3 / 2 * Δε / h := by field_simp; ring
  linarith

end

end ThompsonLaws.Hygromorphs
