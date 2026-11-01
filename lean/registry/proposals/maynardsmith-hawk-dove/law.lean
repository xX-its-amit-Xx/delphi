import Mathlib

/-
  LeanBio discovery round 2, candidate 3 of 10. Claim `maynardsmith-hawk-dove`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "When the cost of injury exceeds the value of the contested resource, the stable outcome is a
     mixture in which animals escalate with probability equal to the ratio of resource value to cost."
  Claim notation: E(H,H) = (V-C)/2, E(H,D) = V, E(D,H) = 0, E(D,D) = V/2; for C > V the unique ESS
  plays Hawk with probability p* = V/C.
  Sources: Maynard Smith J, Price GR (1973) The logic of animal conflict. Nature 246:15-18.
  doi:10.1038/246015a0; Maynard Smith J (1982) Evolution and the Theory of Games.
  doi:10.1017/cbo9780511806292

  NAMED HYPOTHESIS (not proved here, not an axiom): `HawkDoveHyp V C p` says a symmetric pairwise
  contest has resource value V > 0 and injury cost C with V < C, and that p is the escalation
  probability fixed by p * C = V (the claim's p* = V/C, written without division).

  PROVED from the hypothesis: p lies strictly inside (0,1), so the mixture is a genuine mixture;
  the two pure strategies have EQUAL payoff against it (the ESS indifference condition); any
  population escalating less often than p gives Hawk a strictly higher payoff, and any population
  escalating more often gives Dove a strictly higher payoff -- so p is the only uninvadable
  escalation probability; and the payoff at p is strictly below V/2, the payoff of an all-Dove
  population, which is the cost of conflict.

  NOT established: that this is an ESS in the full sense (second-order stability against the mixed
  strategy itself is not stated), nor anything about asymmetric contests. With role asymmetries
  such as ownership the Bourgeois strategy is the ESS instead, and this law does not apply.
-/

namespace Delphi.LeanBio.Round2.HawkDove

/-- Payoff to a Hawk against a population escalating with probability `x`. -/
noncomputable def wH (V C x : ℝ) : ℝ := x * (V - C) / 2 + (1 - x) * V

/-- Payoff to a Dove against a population escalating with probability `x`. -/
noncomputable def wD (V C x : ℝ) : ℝ := (1 - x) * V / 2

/-- Named hypothesis: a symmetric Hawk-Dove contest whose cost exceeds the resource value,
with `p` the escalation probability satisfying `p * C = V`. -/
structure HawkDoveHyp (V C p : ℝ) : Prop where
  V_pos : 0 < V
  cost_exceeds : V < C
  mixture : p * C = V

/-- **Hawk-Dove mixture.** Under `HawkDoveHyp`: the escalation probability is a genuine mixture,
the two pure strategies are indifferent against it, it is invaded from neither side, and the
population pays for conflict (payoff strictly below the all-Dove payoff `V/2`). -/
theorem hawk_dove_mixture {V C p : ℝ} (h : HawkDoveHyp V C p) :
    0 < p ∧ p < 1 ∧ wH V C p = wD V C p ∧
      (∀ x : ℝ, x < p → wD V C x < wH V C x) ∧
      (∀ x : ℝ, p < x → wH V C x < wD V C x) ∧
      wD V C p < V / 2 := by
  have hV := h.V_pos
  have hVC := h.cost_exceeds
  have hC : (0:ℝ) < C := by linarith
  have hp := h.mixture
  have hp0 : 0 < p := by nlinarith
  have hp1 : p < 1 := by nlinarith
  refine ⟨hp0, hp1, ?_, ?_, ?_, ?_⟩
  · unfold wH wD
    linear_combination (-1/2 : ℝ) * hp
  · intro x hx
    unfold wH wD
    nlinarith [hx, hC, hp]
  · intro x hx
    unfold wH wD
    nlinarith [hx, hC, hp]
  · unfold wD
    nlinarith [hp0, hV]

/-- A model instance: the contest's numbers together with the named hypothesis. -/
structure Instance where
  V : ℝ
  C : ℝ
  p : ℝ
  hyp : HawkDoveHyp V C p

/-- Non-vacuity: the hypothesis is satisfiable. V = 1, C = 4, p = 1/4: a contest in which injury
costs four times the resource, escalated in one contest in four. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1, 4, 1 / 4, ⟨by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.HawkDove
