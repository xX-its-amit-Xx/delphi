import Mathlib

theorem l2_t2 (eta E Q Ca Cv Pavail Psup Pdem : ℝ)
    (h_eta_pos : 0 < eta) (h_eta_le : eta ≤ 1)
    (hE : 0 < E) (hQ : 0 < Q)
    (h_avdiff : 0 ≤ Ca - Cv)
    (h_avail : Pavail = eta * E * Q * (Ca - Cv))
    (h_supply : Psup ≤ Pavail)
    (h_demand : Pavail < Pdem) :
    ¬ (Pdem ≤ Psup) := by
  intro h
  linarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv Pavail Psup Pdem : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧ 0 ≤ Ca - Cv ∧
      Pavail = eta * E * Q * (Ca - Cv) ∧ Psup ≤ Pavail ∧ Pavail < Pdem := by
  refine ⟨1/2, 20, 10, 10, 5, 250, 200, 300, ?_⟩
  norm_num
