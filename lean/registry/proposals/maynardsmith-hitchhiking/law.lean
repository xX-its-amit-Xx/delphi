import Mathlib

/-
  LeanBio candidate from pipeline/leanbio (queue rank 2, belief 0.932 under leanbio-belief/0.1.0).
  Claim `maynardsmith-hitchhiking` (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "When a favourable mutation sweeps to fixation, it reduces genetic variation at closely linked neutral
     sites, and the reduction is larger the tighter the linkage relative to the strength of selection."
  The claim's own notation: H_after / H_before at a neutral site at recombination fraction c is an
  increasing function of c/s that tends to 0 as c/s -> 0.
  Source: Maynard Smith J, Haigh J (1974) The hitch-hiking effect of a favourable gene. Genetical Research
  23:23-35. doi:10.1017/S0016672300014634 (resolved through Crossref 2026-11-01).

  NAMED HYPOTHESIS (not proved, not an axiom): the relative heterozygosity left after one sweep is
      relHet K a x = 1 - K ^ (-(a * x)),   x = c / s,
  for some base K > 1 and rate a > 0 (`SweepHyp K a`). The exponential family is the shape of the
  deterministic-sweep approximation; the constants are left free so the theorem does not depend on which
  published constant is used. Whether this family matches an equation of the 1974 paper exactly was NOT
  checked against the paper's text.

  PROVED from the hypothesis: complete linkage relative to selection (x = 0) removes all variation; the
  variation left rises strictly with c/s (so the reduction is larger the tighter the linkage); and for any
  c/s > 0 a sweep reduces variation without removing all of it.

  Scope: a single sweep of a new mutation, two loci, deterministic trajectory. Says nothing about
  background selection, which produces the same diversity-recombination correlation in data.
-/

namespace Delphi.LeanBio.Hitchhiking

/-- Relative heterozygosity H_after / H_before at a neutral site, as a function of x = c / s. -/
noncomputable def relHet (K a x : ℝ) : ℝ := 1 - K ^ (-(a * x))

/-- Named hypothesis: the sweep approximation's base exceeds 1 and its rate is positive. -/
structure SweepHyp (K a : ℝ) : Prop where
  base_gt_one : 1 < K
  rate_pos : 0 < a

/-- **Hitchhiking.** Under `SweepHyp`: no variation is left at x = 0; what is left rises strictly with
x = c/s; and for x > 0 some, but not all, variation is removed. -/
theorem hitchhiking_relHet {K a : ℝ} (h : SweepHyp K a) :
    relHet K a 0 = 0 ∧ StrictMono (relHet K a) ∧
      ∀ x : ℝ, 0 < x → 0 < relHet K a x ∧ relHet K a x < 1 := by
  have hK := h.base_gt_one
  have ha := h.rate_pos
  refine ⟨by simp [relHet], ?_, ?_⟩
  · intro x y hxy
    have hexp : -(a * y) < -(a * x) := by nlinarith
    have := Real.rpow_lt_rpow_of_exponent_lt hK hexp
    unfold relHet
    linarith
  · intro x hx
    have hneg : -(a * x) < 0 := by nlinarith
    have hlt : K ^ (-(a * x)) < 1 := by
      have := Real.rpow_lt_rpow_of_exponent_lt hK hneg
      simpa using this
    have hpos : 0 < K ^ (-(a * x)) := Real.rpow_pos_of_pos (by linarith) _
    unfold relHet
    constructor <;> linarith

/-- A model instance: values for the sweep parameters together with the named hypothesis. -/
structure Instance where
  K : ℝ
  a : ℝ
  hyp : SweepHyp K a

/-- Non-vacuity: the hypothesis is satisfiable (K = 2, a = 1). -/
theorem witness : Nonempty Instance :=
  ⟨⟨2, 1, ⟨by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Hitchhiking
