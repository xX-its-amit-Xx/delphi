/-
NEGATIVE CONTROL for CrosslinkerWindow.lean (agent lb-crosslinker-laws).
This file MUST be rejected by tracks/lean/check.sh. It states the OPPOSITE of the stiffness law
(modulus strictly DEcreasing in crosslink density), which is false, and "proves" it with sorry.
-/
import Mathlib

namespace ThompsonLaws.CrosslinkerNegativeControl

/-- FALSE on purpose: claims `G = ν kT` is strictly decreasing in `ν` for `kT > 0`. -/
theorem affineShearModulus_strictAnti_FALSE (kT : ℝ) (hkT : 0 < kT) :
    StrictAnti (fun ν : ℝ => ν * kT) := by
  sorry

end ThompsonLaws.CrosslinkerNegativeControl

#print axioms ThompsonLaws.CrosslinkerNegativeControl.affineShearModulus_strictAnti_FALSE
