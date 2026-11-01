import Mathlib

/-
  LeanBio discovery round 2, candidate 1 of 10. Claim `kimura-heterozygosity`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "Under neutral mutation to new alleles and drift, expected heterozygosity reaches an equilibrium
     that rises with the product of effective population size and mutation rate."
  Claim notation: H = theta / (1 + theta), theta = 4 Ne mu (infinite-alleles model).
  Source: Kimura M, Crow JF (1964) The number of alleles that can be maintained in a finite
  population. Genetics 49:725-738. doi:10.1093/genetics/49.4.725

  NAMED HYPOTHESIS (not proved here, not an axiom): `HetHyp Ne mu H` says that the equilibrium
  expected heterozygosity H of a population with effective size Ne and per-generation neutral
  mutation rate mu satisfies the infinite-alleles equilibrium equation
      H * (1 + 4 * Ne * mu) = 4 * Ne * mu.
  The equation is stated in product form so that no division appears and the constants of the
  1964 model (the factor 4 for a diploid autosomal locus) are visible.

  PROVED from the hypothesis: heterozygosity is strictly between 0 and 1 for any positive Ne and
  mu (drift never fixes the population completely, and mutation never makes every pair of alleles
  distinct), and it is strictly increasing in the product Ne * mu, which is the claim's
  "rises with the product of effective population size and mutation rate". The comparison is
  between two populations, so the monotonicity is a statement about populations, not about a curve.

  NOT established: that any real population sits at this equilibrium. Observed diversity varies
  far less across species than Ne estimates predict (Lewontin's paradox, doi:10.1371/journal.pbio.1001388),
  which is a standing contradiction of the hypothesis as applied to census sizes, not of the theorem.
-/

namespace Delphi.LeanBio.Round2.KimuraHet

/-- Named hypothesis: the infinite-alleles equilibrium, in product form. -/
structure HetHyp (Ne mu H : ℝ) : Prop where
  Ne_pos : 0 < Ne
  mu_pos : 0 < mu
  equilibrium : H * (1 + 4 * Ne * mu) = 4 * Ne * mu

/-- **Neutral equilibrium heterozygosity.** Under `HetHyp`, heterozygosity is strictly inside
(0, 1), and of two populations the one with the larger product `Ne * mu` has strictly the larger
equilibrium heterozygosity. -/
theorem het_equilibrium {Ne mu H Ne' mu' H' : ℝ}
    (h : HetHyp Ne mu H) (h' : HetHyp Ne' mu' H') :
    0 < H ∧ H < 1 ∧ (Ne * mu < Ne' * mu' → H < H') := by
  have hNe := h.Ne_pos
  have hmu := h.mu_pos
  have hNe' := h'.Ne_pos
  have hmu' := h'.mu_pos
  have hth : 0 < 4 * Ne * mu := by positivity
  have hth' : 0 < 4 * Ne' * mu' := by positivity
  have he := h.equilibrium
  have he' := h'.equilibrium
  refine ⟨?_, ?_, ?_⟩
  · nlinarith [he, hth]
  · nlinarith [he, hth]
  · intro hlt
    have hpos : 0 < (1 + 4 * Ne * mu) * (1 + 4 * Ne' * mu') := by positivity
    have key : (H' - H) * ((1 + 4 * Ne * mu) * (1 + 4 * Ne' * mu'))
        = 4 * Ne' * mu' - 4 * Ne * mu := by
      linear_combination (1 + 4 * Ne * mu) * he' - (1 + 4 * Ne' * mu') * he
    nlinarith [key, hpos, hlt]

/-- A model instance: a population's parameters together with the named hypothesis. -/
structure Instance where
  Ne : ℝ
  mu : ℝ
  H : ℝ
  hyp : HetHyp Ne mu H

/-- Non-vacuity: the hypothesis is satisfiable. Ne = 1000, mu = 1/4000 gives theta = 1 and H = 1/2,
inside the range of neutral heterozygosity seen at synonymous sites in many invertebrates. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1000, 1 / 4000, 1 / 2, ⟨by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.KimuraHet
