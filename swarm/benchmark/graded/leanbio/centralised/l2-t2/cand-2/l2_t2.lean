import Mathlib

/-- Fick bound: if the demanded power strictly exceeds the Fick product
`eta * E * Q * (Ca - Cv)`, and the aerobic power actually supplied `Pa` is bounded above by that
product, then the activity cannot be sustained aerobically (demand `Pdem` is not covered by `Pa`). -/
theorem l2_t2 (eta E Q Ca Cv Pa Pdem : ℝ)
    (heta : 0 < eta) (heta1 : eta ≤ 1) (hE : 0 < E) (hQ : 0 < Q)
    (hdiff : 0 ≤ Ca - Cv)
    (hPa : Pa ≤ eta * E * Q * (Ca - Cv))
    (hdem : eta * E * Q * (Ca - Cv) < Pdem) :
    ¬ (Pdem ≤ Pa) := by
  intro h
  linarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv Pa Pdem : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧
      0 ≤ Ca - Cv ∧
      Pa ≤ eta * E * Q * (Ca - Cv) ∧
      eta * E * Q * (Ca - Cv) < Pdem := by
  refine ⟨1/4, 20, 2, 8, 3, 50, 60, ?_⟩
  norm_num
