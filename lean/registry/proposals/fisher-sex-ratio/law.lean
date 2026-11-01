import Mathlib

/-
  LeanBio discovery round 2, candidate 7. Claim `fisher-sex-ratio`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "Under random mating and autosomal inheritance, selection drives parents to invest equally in
     sons and daughters, which gives a 1:1 sex ratio when the two cost the same."
  Claim notation: ESS allocation N_m c_m = N_f c_f; with c_m = c_f the unbeatable primary sex ratio
  is 1:1.
  Sources: Fisher RA (1930) The Genetical Theory of Natural Selection, ch. 6 (no DOI);
  Shaw RF, Mohler JD (1953) doi:10.1086/281794 (the Shaw-Mohler fitness form).

  NAMED HYPOTHESIS (not proved here, not an axiom): `SexRatioHyp R cs cd Nm Nd` says a rare mutant
  parent with resource R > 0 splitting a fraction x of it into sons (each costing cs > 0) and the
  rest into daughters (each costing cd > 0), in a population with Nm > 0 males and Nd > 0 females,
  has relative fitness
      wAlloc x = (1 - x) * R / cd + x * R * Nd / (cs * Nm),
  the Shaw-Mohler form: offspring of each sex are weighted by the reproductive value of that sex,
  which is inversely proportional to its number.

  PROVED from the hypothesis -- an IMPOSSIBILITY, which is the useful shape:
    * if cs * Nm < cd * Nd the fitness is strictly INCREASING in x, so a more male-biased parent
      strictly invades;
    * if cd * Nd < cs * Nm it is strictly DECREASING, so a more female-biased parent strictly
      invades;
    * only when cs * Nm = cd * Nd is fitness the SAME for every allocation, so no allocation
      invades.
  Hence no sex allocation is uninvadable unless the total investment in the two sexes is equal.
  The 1:1 ratio is the special case cs = cd.

  NOT established: that any population is at this equilibrium, and nothing at all when offspring
  of the two sexes do not compete at random. When a few mothers lay on a patch and their offspring
  mate there before dispersing, the stable ratio is female-biased (Hamilton's local mate
  competition, a separate claim in this repo) and this law does not apply.
-/

namespace Delphi.LeanBio.Round2.SexRatio

/-- Shaw-Mohler relative fitness of a rare mutant parent allocating a fraction `x` of its resource
to sons, in a population with `Nm` males and `Nd` females. -/
noncomputable def wAlloc (R cs cd Nm Nd x : ℝ) : ℝ :=
  (1 - x) * R / cd + x * R * Nd / (cs * Nm)

/-- Named hypothesis: positive resource, positive per-offspring costs and a population containing
both sexes. -/
structure SexRatioHyp (R cs cd Nm Nd : ℝ) : Prop where
  R_pos : 0 < R
  cs_pos : 0 < cs
  cd_pos : 0 < cd
  Nm_pos : 0 < Nm
  Nd_pos : 0 < Nd

/-- **Fisher's equal investment, as an impossibility.** Under `SexRatioHyp`, unless the population's
total investment in the two sexes is equal, some allocation strictly invades; and when it is equal,
every allocation does equally well. -/
theorem fisher_equal_investment {R cs cd Nm Nd : ℝ} (h : SexRatioHyp R cs cd Nm Nd) :
    (cs * Nm < cd * Nd →
      ∀ x y : ℝ, x < y → wAlloc R cs cd Nm Nd x < wAlloc R cs cd Nm Nd y) ∧
    (cd * Nd < cs * Nm →
      ∀ x y : ℝ, x < y → wAlloc R cs cd Nm Nd y < wAlloc R cs cd Nm Nd x) ∧
    (cs * Nm = cd * Nd →
      ∀ x y : ℝ, wAlloc R cs cd Nm Nd x = wAlloc R cs cd Nm Nd y) := by
  have hR := h.R_pos
  have hcs := h.cs_pos
  have hcd := h.cd_pos
  have hNm := h.Nm_pos
  have hNd := h.Nd_pos
  have hden : (0:ℝ) < cd * (cs * Nm) := by positivity
  have key : ∀ x y : ℝ, wAlloc R cs cd Nm Nd y - wAlloc R cs cd Nm Nd x
      = (y - x) * (R * (cd * Nd - cs * Nm)) / (cd * (cs * Nm)) := by
    intro x y
    unfold wAlloc
    field_simp
    ring
  refine ⟨?_, ?_, ?_⟩
  · intro hlt x y hxy
    have hnum : 0 < (y - x) * (R * (cd * Nd - cs * Nm)) := by
      apply mul_pos (by linarith)
      apply mul_pos hR (by linarith)
    have := div_pos hnum hden
    have hk := key x y
    linarith
  · intro hlt x y hxy
    have hnum : (y - x) * (R * (cd * Nd - cs * Nm)) < 0 := by
      apply mul_neg_of_pos_of_neg (by linarith)
      apply mul_neg_of_pos_of_neg hR (by linarith)
    have := div_neg_of_neg_of_pos hnum hden
    have hk := key x y
    linarith
  · intro heq x y
    have hk := key x y
    rw [heq] at hk
    simp at hk
    linarith

/-- A model instance: a parent's resource, the two per-offspring costs and the two sex counts,
together with the named hypothesis. -/
structure Instance where
  R : ℝ
  cs : ℝ
  cd : ℝ
  Nm : ℝ
  Nd : ℝ
  hyp : SexRatioHyp R cs cd Nm Nd

/-- Non-vacuity: the hypothesis is satisfiable, at the equal-investment point. R = 1, cs = cd = 1,
Nm = Nd = 1000: equal per-offspring costs and a 1:1 adult sex ratio, so cs * Nm = cd * Nd and no
allocation invades. These are illustrative numbers, not a measurement. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1, 1, 1, 1000, 1000, ⟨by norm_num, by norm_num, by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.SexRatio
