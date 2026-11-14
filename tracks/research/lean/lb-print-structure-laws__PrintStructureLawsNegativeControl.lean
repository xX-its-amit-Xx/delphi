import Mathlib

/-!
Negative control. The statement below is FALSE physics (it claims thicker strips sag more) and is
closed with `sorry`. `check.sh` must reject this file (sorryAx). If it ever passes, the checker is
broken.
-/

namespace ThompsonLaws.PrintStructureNegative

/-- Deliberately wrong: claims the sag formula can never be met, for any thickness. -/
theorem sag_never_ok (ρ g L E h δ : ℝ) (hE : 0 < E) (hh : 0 < h) (hδ : 0 < δ) :
    δ < 3 * ρ * g * L ^ 4 / (2 * E * h ^ 2) := by
  sorry

end ThompsonLaws.PrintStructureNegative

#print axioms ThompsonLaws.PrintStructureNegative.sag_never_ok
