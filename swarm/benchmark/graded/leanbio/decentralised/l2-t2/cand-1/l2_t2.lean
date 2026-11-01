import Mathlib

theorem l2_t2 (eta E Q Ca Cv P_sup P_dem : ℝ)
    (h_eta_pos : 0 < eta) (h_eta_le : eta ≤ 1)
    (hE : 0 < E) (hQ : 0 < Q)
    (h_avd : 0 ≤ Ca - Cv)
    (h_sup_nonneg : 0 ≤ P_sup)
    (h_bound : P_sup ≤ eta * E * Q * (Ca - Cv))
    (h_exceeds : eta * E * Q * (Ca - Cv) < P_dem) :
    ¬ (P_dem ≤ P_sup) := by
  intro h
  linarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv P_sup P_dem : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧ 0 ≤ Ca - Cv ∧ 0 ≤ P_sup ∧
      P_sup ≤ eta * E * Q * (Ca - Cv) ∧
      eta * E * Q * (Ca - Cv) < P_dem := by
  refine ⟨1/5, 20, 1, 10, 6, 10, 100, ?_⟩
  norm_num
