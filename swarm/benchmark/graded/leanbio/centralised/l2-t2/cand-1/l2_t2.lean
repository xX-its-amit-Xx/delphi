import Mathlib

theorem l2_t2 (eta E Q Ca Cv Pdem Paer : ℝ)
    (heta : 0 < eta) (heta1 : eta ≤ 1) (hE : 0 < E) (hQ : 0 < Q)
    (hAV : 0 ≤ Ca - Cv)
    (hdem : Pdem > eta * E * Q * (Ca - Cv))
    (hbound : Paer ≤ eta * E * Q * (Ca - Cv)) :
    ¬ (Pdem ≤ Paer) := by
  intro h
  linarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv Pdem Paer : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧ 0 ≤ Ca - Cv ∧
      Pdem > eta * E * Q * (Ca - Cv) ∧
      Paer ≤ eta * E * Q * (Ca - Cv) := by
  refine ⟨1/2, 20, 10, 8, 3, 1000, 500, ?_⟩
  norm_num