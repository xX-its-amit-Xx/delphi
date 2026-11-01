import Mathlib

/-
  LeanBio discovery round 2, candidate 5. This one is NOT from a literature claim but from the
  repo's own measured data: `development/growth.json` (12 FishBase von Bertalanffy rows over 7
  Exocoetidae species, plus otolith and early-life data), built 2026-10-31.

  The repo's default curve is the one row FishBase marks as validated:
      FL_cm(t_yr) = 23.3 * (1 - exp(-3.12 * (t_yr - 0.01)))
  for Hirundichthys affinis off northwest Barbados (FishBase autoctr 4651; Main Ref 6829 =
  Oxenford HA, Hunte W, Deane R, Campana SE (1994) Mar Biol 118:585), validated by laboratory
  rearing of larvae and mark-recapture of adults, based on otolith daily increments.
  Across the 12 rows Linf runs 13.5 to 30.5 cm and K runs 0.86 to 3.65 per year; all 12 are
  `kind: secondary` (a FishBase compilation), not measurements made in this repo.

  NAMED HYPOTHESIS (not proved here, not an axiom): `GrowthHyp Linf K` says a cohort's length at
  age follows von Bertalanffy, length(t) = Linf * (1 - exp(-K * (t - t0))), with asymptotic length
  Linf > 0 and Brody coefficient K > 0.

  PROVED from the hypothesis:
    * length is STRICTLY BELOW Linf at every age, including ages before t0 and arbitrarily large
      ages -- the asymptote is never reached, so a declared length at or above a declared
      asymptotic length is impossible under the curve that was fitted to the animal;
    * length is strictly increasing in age, so the curve never predicts shrinkage;
    * two cohorts that share K reach the same FRACTION of their own asymptote at the same age
      measured from their own t0, however different their asymptotic lengths. This is the
      non-obvious part: K alone sets the shape, and Linf only sets the scale.

  NOT established: that Exocoetidae grow by von Bertalanffy, that these fitted constants transfer
  outside the localities and years they were fitted in, or anything about the 68 of 75 Exocoetidae
  species with no growth row. Field fits already embed the food and temperature of their locality
  (development/growth.json `conditions`), so the curve is not a temperature-free law of growth.
-/

namespace Delphi.LeanBio.Round2.GrowthAsymptote

/-- Von Bertalanffy length at age: `Linf` asymptotic length, `K` Brody growth coefficient,
`t0` the age at which the fitted curve passes through zero length. -/
noncomputable def vonB (Linf K t0 t : ℝ) : ℝ := Linf * (1 - Real.exp (-(K * (t - t0))))

/-- Named hypothesis: a positive asymptotic length and a positive Brody coefficient. -/
structure GrowthHyp (Linf K : ℝ) : Prop where
  Linf_pos : 0 < Linf
  K_pos : 0 < K

/-- **Von Bertalanffy growth.** Under `GrowthHyp`: length stays strictly below the asymptote at
every age, rises strictly with age, and -- for two cohorts sharing `K` -- the same age since `t0`
gives the same fraction of each cohort's own asymptote. -/
theorem von_bertalanffy_asymptote {Linf K t0 : ℝ} (h : GrowthHyp Linf K)
    {Linf' t0' : ℝ} (h' : GrowthHyp Linf' K) (f t : ℝ) :
    (∀ s : ℝ, vonB Linf K t0 s < Linf) ∧
    (∀ s u : ℝ, s < u → vonB Linf K t0 s < vonB Linf K t0 u) ∧
    (vonB Linf K t0 t = f * Linf ↔ vonB Linf' K t0' (t - t0 + t0') = f * Linf') := by
  have hL := h.Linf_pos
  have hL' := h'.Linf_pos
  have hK := h.K_pos
  refine ⟨?_, ?_, ?_⟩
  · intro s
    unfold vonB
    nlinarith [Real.exp_pos (-(K * (s - t0))), hL]
  · intro s u hsu
    unfold vonB
    have harg : -(K * (u - t0)) < -(K * (s - t0)) := by nlinarith
    nlinarith [Real.exp_lt_exp.mpr harg, hL]
  · have harg : -(K * ((t - t0 + t0') - t0')) = -(K * (t - t0)) := by ring
    unfold vonB
    rw [harg]
    constructor
    · intro hx
      have h1 : 1 - Real.exp (-(K * (t - t0))) = f :=
        mul_left_cancel₀ (ne_of_gt hL) (by linear_combination hx)
      rw [h1]
      ring
    · intro hx
      have h1 : 1 - Real.exp (-(K * (t - t0))) = f :=
        mul_left_cancel₀ (ne_of_gt hL') (by linear_combination hx)
      rw [h1]
      ring

/-- A model instance: a fitted growth curve together with the named hypothesis. -/
structure Instance where
  Linf : ℝ
  K : ℝ
  hyp : GrowthHyp Linf K

/-- Non-vacuity: the hypothesis is satisfied by the repo's default measured curve,
Linf = 23.3 cm FL and K = 3.12 per year (Hirundichthys affinis, FishBase autoctr 4651,
Oxenford et al. 1994; `kind: secondary`). This is an observed fit, not a plausible value. -/
theorem witness : Nonempty Instance :=
  ⟨⟨233 / 10, 312 / 100, ⟨by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.GrowthAsymptote
