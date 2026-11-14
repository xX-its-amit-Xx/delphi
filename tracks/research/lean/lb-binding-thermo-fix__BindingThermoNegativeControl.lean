import Mathlib

/-!
NEGATIVE CONTROL. This file MUST be rejected by tracks/lean/check.sh.
The theorem below is FALSE (take L = Kd = Ki = 1: left side 1/3, right side 1/4) and is
closed with `sorry`, so it depends on sorryAx.
-/

namespace BindingThermoNegativeControl

/-- FALSE on purpose: claims that inhibitor at `I = Ki` (ignoring the labelled ligand) halves
occupancy. The true halving concentration is `Ki * (1 + L/Kd)`. -/
theorem wrong_ic50_equals_ki (L Kd Ki : ℝ) (hL : 0 < L) (hKd : 0 < Kd) (hKi : 0 < Ki) :
    L / (L + Kd * (1 + Ki / Ki)) = (1 / 2) * (L / (L + Kd)) := by
  sorry

end BindingThermoNegativeControl

#print axioms BindingThermoNegativeControl.wrong_ic50_equals_ki
