import Mathlib

theorem l2_t2 (eta E Q Ca Cv Pavail Pdemand Psup : ℝ)
    (heta0 : 0 < eta) (heta1 : eta ≤ 1)
    (hE : 0 < E) (hQ : 0 < Q)
    (hav : 0 ≤ Ca - Cv)
    (hP : Pavail = eta * E * Q * (Ca - Cv))
    (hsup : Psup ≤ Pavail)
    (hdem : Pavail < Pdemand) :
    ¬ (Pdemand ≤ Psup) := by
  intro h
  linarith

theorem l2_t2_witness :
    ∃ (eta E Q Ca Cv Pavail Pdemand Psup : ℝ),
      0 < eta ∧ eta ≤ 1 ∧ 0 < E ∧ 0 < Q ∧ 0 ≤ Ca - Cv ∧
      Pavail = eta * E * Q * (Ca - Cv) ∧ Psup ≤ Pavail ∧ Pavail < Pdemand := by
  refine ⟨1/2, 1, 1, 2, 1, 1/2, 1, 1/2, ?_⟩
  norm_num
