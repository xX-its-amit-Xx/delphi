import Mathlib

theorem l2_t2 (eta E Q Ca Cv Pdem VO2 : ℝ)
    (heta : 0 < eta) (heta1 : eta ≤ 1) (hE : 0 < E) (hQ : 0 < Q)
    (hAV : 0 ≤ Ca - Cv) (hVO2 : 0 ≤ VO2)
    (hfick : VO2 ≤ Q * (Ca - Cv))
    (hdem : eta * E * Q * (Ca - Cv) < Pdem) :
    ¬ (Pdem ≤ eta * E * VO2) := by
  intro h
  have h1 : 0 < eta * E := mul_pos heta hE
  have h2 : eta * E * VO2 ≤ eta * E * (Q * (Ca - Cv)) :=
    mul_le_mul_of_nonneg_left hfick h1.le
  nlinarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv Pdem VO2 : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧ 0 ≤ Ca - Cv ∧ 0 ≤ VO2 ∧
      VO2 ≤ Q * (Ca - Cv) ∧ eta * E * Q * (Ca - Cv) < Pdem := by
  refine ⟨1/2, 20, 1, 10, 4, 100, 3, ?_⟩
  norm_num
