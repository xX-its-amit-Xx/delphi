import Mathlib

/-!
Morphogen gradient statements (synthesis-diffusion-degradation model).
Assumptions are named hypotheses. No sorry, no new axioms.
-/

namespace MorphogenGradient

/-- Slope of the exponential profile c(x) = c0 * exp(-x/lam). -/
theorem profile_deriv (c0 lam x : ℝ) :
    HasDerivAt (fun y : ℝ => c0 * Real.exp (-y / lam))
      (-(c0 / lam) * Real.exp (-x / lam)) x := by
  have h1 : HasDerivAt (fun y : ℝ => -y / lam) (-1 / lam) x := by
    simpa using ((hasDerivAt_id x).neg).div_const lam
  have h2 := (h1.exp).const_mul c0
  convert h2 using 1
  ring

/-- Moving a distance d down the gradient multiplies concentration by exp(-d/lam),
whatever the starting position. -/
theorem fold_change (c0 lam x d : ℝ) :
    c0 * Real.exp (-(x + d) / lam) = c0 * Real.exp (-x / lam) * Real.exp (-d / lam) := by
  have h : -(x + d) / lam = -x / lam + -d / lam := by ring
  rw [h, Real.exp_add]
  ring

/-- If the decay length obeys lam^2 = D * tau, the lifetime is fixed by lam and D. -/
theorem lifetime_from_length (D lam tau : ℝ) (hD : 0 < D) (h : lam ^ 2 = D * tau) :
    tau = lam ^ 2 / D := by
  rw [eq_div_iff hD.ne']
  linear_combination -h

/-- Berg-Purcell limit: if the relative error eps satisfies eps^2 * (D*a*c*T) = 1,
the averaging time is T = 1 / (D*a*c*eps^2). -/
theorem berg_purcell_time (D a c T eps : ℝ) (hD : 0 < D) (ha : 0 < a) (hc : 0 < c)
    (heps : 0 < eps) (h : eps ^ 2 * (D * a * c * T) = 1) :
    T = 1 / (D * a * c * eps ^ 2) := by
  have hne : D * a * c * eps ^ 2 ≠ 0 := by positivity
  rw [eq_div_iff hne]
  linear_combination h

/-- Scaling: if the decay length is a fixed fraction alpha of embryo length L,
the profile at relative position s does not depend on L. -/
theorem scaling_invariance (c0 alpha L s : ℝ) (hL : L ≠ 0) (halpha : alpha ≠ 0) :
    c0 * Real.exp (-(s * L) / (alpha * L)) = c0 * Real.exp (-s / alpha) := by
  have h : -(s * L) / (alpha * L) = -s / alpha := by
    field_simp
  rw [h]

end MorphogenGradient

#print axioms MorphogenGradient.profile_deriv
#print axioms MorphogenGradient.fold_change
#print axioms MorphogenGradient.lifetime_from_length
#print axioms MorphogenGradient.berg_purcell_time
#print axioms MorphogenGradient.scaling_invariance
