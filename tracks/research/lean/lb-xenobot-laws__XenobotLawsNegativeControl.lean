import Mathlib

/-!
Negative control: a deliberately FALSE "law". It claims the lifetime ceiling holds without the
no-feeding hypothesis (`spent ≤ Estore` is dropped). That is false (take a huge `spent`), so the
proof is a `sorry`, and check.sh must REJECT this file.
-/

namespace XenobotLawsNegativeControl

theorem lifetime_le_without_store (Estore Pmin T spent : ℝ) (hP : 0 < Pmin)
    (hspent : Pmin * T ≤ spent) :
    T ≤ Estore / Pmin := by
  sorry

end XenobotLawsNegativeControl

#print axioms XenobotLawsNegativeControl.lifetime_le_without_store
