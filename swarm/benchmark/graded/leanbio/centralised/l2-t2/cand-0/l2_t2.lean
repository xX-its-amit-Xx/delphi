import Mathlib

theorem l2_t2 (eta E Q Ca Cv Pdem Pavail Paer : ℝ)
    (heta : 0 < eta) (heta1 : eta ≤ 1) (hE : 0 < E) (hQ : 0 < Q)
    (hCv : 0 ≤ Ca - Cv)
    (hP : Pavail = eta * E * Q * (Ca - Cv))
    (hsup : Paer ≤ Pavail)
    (hdem : Pavail < Pdem) :
    ¬ (Pdem ≤ Paer) := by
  intro h
  linarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv Pdem Pavail Paer : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧ 0 ≤ Ca - Cv ∧
      Pavail = eta * E * Q * (Ca - Cv) ∧ Paer ≤ Pavail ∧ Pavail < Pdem := by
  refine ⟨1/2, 1, 1, 3, 1, 2, 1, 1, ?_⟩
  norm_num
