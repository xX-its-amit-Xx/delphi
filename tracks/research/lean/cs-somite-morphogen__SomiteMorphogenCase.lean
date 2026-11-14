import Mathlib

/-!
cs-somite-morphogen: two small statements the earlier files do not contain.
STATUS: NOT COMPILED in this run (no time for a Lean build). Treat as a draft until check.sh passes it.

1. Temperature compensation of the clock-and-wavefront law. If wavefront (growth) speed is
   v = beta * (T - Tc) and the clock period is tau = a / (T - Tc), then S = v * tau = beta * a,
   independent of temperature. (Fits quoted in Zhang et al. 2022, doi:10.1038/s42003-022-03053-0.)
2. lambda = sqrt (D / k) really is the decay length of the steady state: c(x) = c0 * exp (-x / lam)
   with lam^2 = D / k satisfies D * c'' = k * c pointwise (stated here on the second-derivative value).
-/

namespace SomiteMorphogenCase

/-- Temperature cancels: S = v * tau = beta * a whenever T ≠ Tc. -/
theorem somite_length_temperature_free (beta a T Tc : ℝ) (h : T - Tc ≠ 0) :
    (beta * (T - Tc)) * (a / (T - Tc)) = beta * a := by
  field_simp

/-- With a temperature-independent speed v0 instead, S changes with temperature:
two temperatures with different periods give different lengths. -/
theorem fixed_speed_not_compensated (v0 tau1 tau2 : ℝ) (hv : v0 ≠ 0) (h : tau1 ≠ tau2) :
    v0 * tau1 ≠ v0 * tau2 := by
  intro hEq
  exact h (mul_left_cancel₀ hv hEq)

/-- Algebraic core of the steady state: if lam^2 = D / k then D * (c / lam^2) = k * c,
i.e. the exponential profile's second derivative c / lam^2 balances degradation. -/
theorem steady_state_balance (D k lam c : ℝ) (hk : k ≠ 0) (hD : D ≠ 0) (h : lam ^ 2 = D / k) :
    D * (c / lam ^ 2) = k * c := by
  rw [h]
  field_simp

/-- A measured decay length shorter than sqrt(D/k) by a factor f means D/k is overestimated
by f^2: if lam_pred^2 = D / k and lam_meas = lam_pred / f then lam_meas^2 = (D / k) / f^2. -/
theorem fold_error_squares (D k lamp lamm f : ℝ) (h : lamp ^ 2 = D / k)
    (hm : lamm = lamp / f) : lamm ^ 2 = (D / k) / f ^ 2 := by
  rw [hm, div_pow, h]

end SomiteMorphogenCase

-- axiom audit lines added by tracks/scripts/add-axiom-audit.py
#print axioms SomiteMorphogenCase.somite_length_temperature_free
#print axioms SomiteMorphogenCase.fixed_speed_not_compensated
#print axioms SomiteMorphogenCase.steady_state_balance
#print axioms SomiteMorphogenCase.fold_error_squares
