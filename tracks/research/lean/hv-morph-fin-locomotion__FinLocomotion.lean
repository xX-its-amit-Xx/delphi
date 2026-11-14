import Mathlib

/-!
Fin and swimming statements (agent hv-morph-fin-locomotion).
Every biological assumption is a named hypothesis; nothing here is an axiom.
-/

namespace FinLocomotion

/-- Strouhal number St = f*A/U. If the tail amplitude is a fixed fraction `a` of body
length (A = a*L) and the normalised beat frequency is k = f*L/U, then St = a*k. -/
theorem strouhal_factor (f A U L a k : ℝ) (hU : U ≠ 0) (hL : L ≠ 0)
    (hA : A = a * L) (hf : f = k * U / L) : f * A / U = a * k := by
  subst hA hf
  field_simp <;> ring

/-- Rohr and Fish 2004 kinematic windows: a in [0.15, 0.25], k in [1, 2].
These alone only give St in [0.15, 0.5], which is wider than the 0.2-0.4 band. -/
theorem strouhal_window (a k : ℝ) (ha1 : (3 / 20 : ℝ) ≤ a) (ha2 : a ≤ 1 / 4)
    (hk1 : 1 ≤ k) (hk2 : k ≤ 2) : (3 / 20 : ℝ) ≤ a * k ∧ a * k ≤ 1 / 2 := by
  have ha0 : (0 : ℝ) ≤ a := by linarith
  have h1 := mul_le_mul_of_nonneg_left hk1 ha0
  have h2 := mul_le_mul_of_nonneg_left hk2 ha0
  constructor <;> linarith

/-- Lighthill elongated-body theory, travelling wave h = g(x - V t): lateral velocity is
-V*g', slope is g'. Mean thrust (m/2)*(w_t^2 - U^2*w_x^2) is positive iff the body wave
runs backward faster than the animal swims forward (V > U). -/
theorem lighthill_thrust_sign (m g U V : ℝ) (hm : 0 < m) (hg : g ≠ 0)
    (hU : 0 < U) (hV : 0 < V) :
    0 < m / 2 * ((V * g) ^ 2 - U ^ 2 * g ^ 2) ↔ U < V := by
  have hg2 : 0 < g ^ 2 := lt_of_le_of_ne (sq_nonneg g) (Ne.symm (pow_ne_zero 2 hg))
  have hpos : 0 < m / 2 * g ^ 2 * (V + U) :=
    mul_pos (mul_pos (by linarith) hg2) (by linarith)
  have key : m / 2 * ((V * g) ^ 2 - U ^ 2 * g ^ 2) = (m / 2 * g ^ 2 * (V + U)) * (V - U) := by
    ring
  rw [key]
  constructor
  · intro h
    by_contra hc
    push_neg at hc
    have h3 : 0 ≤ (m / 2 * g ^ 2 * (V + U)) * (U - V) :=
      mul_nonneg hpos.le (sub_nonneg.mpr hc)
    nlinarith [h, h3]
  · intro h
    exact mul_pos hpos (sub_pos.mpr h)

/-- Steady glide: horizontal distance x = h * (L/D). A ceiling on L/D caps the range. -/
theorem glide_range_bound (h x LD LDmax : ℝ) (hh : 0 ≤ h) (hx : x = h * LD)
    (hLD : LD ≤ LDmax) : x ≤ h * LDmax := by
  rw [hx]
  exact mul_le_mul_of_nonneg_left hLD hh

end FinLocomotion

#print axioms FinLocomotion.strouhal_factor
#print axioms FinLocomotion.strouhal_window
#print axioms FinLocomotion.lighthill_thrust_sign
#print axioms FinLocomotion.glide_range_bound
