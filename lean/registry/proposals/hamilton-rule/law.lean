import Mathlib

/-
  LeanBio discovery round 2, candidate 6. Claim `hamilton-rule`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "A gene for social behaviour increases in frequency when the benefit to the recipient, weighted
     by genetic relatedness, exceeds the cost to the actor."
  Claim notation: Delta p-bar > 0 iff r b - c > 0, with r, b, c as regression coefficients
  (Queller form via the Price equation).
  Source: Hamilton WD (1964) The genetical evolution of social behaviour. I. J Theor Biol 7:1-16.
  doi:10.1016/0022-5193(64)90038-4 (general regression form: see_also
  doi:10.1111/j.1420-9101.2011.02236.x, doi:10.1038/nature09205).

  NAMED HYPOTHESIS (not proved here, not an axiom): `HamiltonHyp r b c k dp` says that the change
  in the mean breeding value of a social trait is
      dp = k * (r * b - c),   k > 0, 0 <= r <= 1,
  where b and c are the partial regressions of fitness on the partner's and the actor's genotype
  and r is the relatedness regression. The positive factor k collects the additive genetic variance
  and the generation-time normaliser of the Price equation; it is left free so the theorem does not
  depend on which normalisation is used.

  PROVED from the hypothesis: the SIGN of dp is exactly the sign of r*b - c. The trait increases
  iff c < r*b and decreases iff r*b < c -- both directions, which is what makes the rule a
  criterion rather than a sufficient condition.

  NOT established: that b, c and r can be measured for any real population, that fitness effects
  are additive, or that selection is weak. The whole empirical weight of Hamilton's rule sits in
  the hypothesis dp = k*(r*b - c), and the controversy in the literature is about whether that
  decomposition is ever identifiable, not about this arithmetic.
-/

namespace Delphi.LeanBio.Round2.HamiltonRule

/-- Named hypothesis: the Price-equation form of the change in a social trait. -/
structure HamiltonHyp (r b c k dp : ℝ) : Prop where
  k_pos : 0 < k
  r_nonneg : 0 ≤ r
  r_le_one : r ≤ 1
  gradient : dp = k * (r * b - c)

/-- **Hamilton's rule.** Under `HamiltonHyp` the social trait increases exactly when the
relatedness-weighted benefit exceeds the cost, and decreases exactly when it falls short. -/
theorem hamilton_rule {r b c k dp : ℝ} (h : HamiltonHyp r b c k dp) :
    (0 < dp ↔ c < r * b) ∧ (dp < 0 ↔ r * b < c) := by
  have hk := h.k_pos
  have hg := h.gradient
  constructor
  · constructor
    · intro hd
      nlinarith
    · intro hd
      nlinarith
  · constructor
    · intro hd
      nlinarith
    · intro hd
      nlinarith

/-- A model instance: the regression coefficients together with the named hypothesis. -/
structure Instance where
  r : ℝ
  b : ℝ
  c : ℝ
  k : ℝ
  dp : ℝ
  hyp : HamiltonHyp r b c k dp

/-- Non-vacuity: the hypothesis is satisfiable. r = 1/2 (full sibs or parent-offspring under
outbreeding), b = 3, c = 1, k = 1, so dp = 1/2 > 0: an altruistic act whose benefit is three times
its cost spreads between full sibs. The relatedness is a pedigree value; b and c are illustrative. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1 / 2, 3, 1, 1, 1 / 2, ⟨by norm_num, by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.HamiltonRule
