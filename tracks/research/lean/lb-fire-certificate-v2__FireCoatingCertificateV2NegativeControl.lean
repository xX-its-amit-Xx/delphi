import Mathlib

/-!
NEGATIVE CONTROL. check.sh MUST reject this file.

It restates the version-1 mistake as a claim about the lossy thin model: "if the no-loss ignition
time is below the required time, the lossy-model temperature has reached ignition by the required
time". That is false (losses delay or prevent ignition), so it is left as `sorry`.
-/

namespace FireCoatingV2NegativeControl

noncomputable def relax (Tss τ t : ℝ) : ℝ := Tss * (1 - Real.exp (-(t / τ)))
noncomputable def thinTemp (T0 q h C t : ℝ) : ℝ := T0 + relax (q / h) (C / h) t

/-- FALSE: the wrong-direction ignition "elimination" of version 1. -/
theorem wrong_direction_ignition (T0 ΔTig q h C treq : ℝ) (hq : 0 < q) (hh : 0 < h) (hC : 0 < C)
    (hΔ : 0 < ΔTig) (hbad : C * ΔTig / q < treq) :
    T0 + ΔTig ≤ thinTemp T0 q h C treq := by
  sorry

#print axioms wrong_direction_ignition

end FireCoatingV2NegativeControl
