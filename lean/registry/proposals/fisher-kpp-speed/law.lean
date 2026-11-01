import Mathlib

/-
  LeanBio discovery round 2, candidate 4. Claim `fisher-kpp-speed`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "An advantageous allele spreading through a continuous population advances as a travelling wave
     whose speed is set by the selection coefficient and the diffusion (dispersal) coefficient."
  Claim notation: u_t = D u_xx + s u (1-u); travelling waves exist iff c >= c* = 2 sqrt(s D).
  Source: Fisher RA (1937) The wave of advance of advantageous genes. Ann Eugen 7:355-369.
  doi:10.1111/j.1469-1809.1937.tb02153.x (Kolmogorov, Petrovskii and Piskunov 1937 independently;
  see_also doi:10.1016/0001-8708(78)90130-5 for the rigorous spreading-speed result).

  NAMED HYPOTHESIS (not proved here, not an axiom): `KppHyp D s c` says dispersal coefficient
  D > 0, selection coefficient s > 0, and that c > 0 is the minimal wave speed, fixed by
      c ^ 2 = 4 * s * D
  (the claim's c* = 2 sqrt(s D), squared so that no square root enters the statement).

  PROVED from the hypothesis, over the linearised speed relation c(k) = D k + s / k written in the
  division-free form `c * k <= D * k ^ 2 + s`:
    * no exponential decay rate k gives a slower speed than c, so c is a LOWER bound on the whole
      family of linear spreading speeds -- which is why c* is the minimum and not merely one value;
    * the bound is strict at every k except the single minimiser 2 D k = c, so the minimum is
      attained at exactly one decay rate;
    * stronger selection gives a strictly faster wave at fixed dispersal.

  NOT established: that a travelling wave exists, that compactly supported data converge to it, or
  that any population disperses diffusively. Those are the content of the 1937 papers and of
  Aronson and Weinberger; this law is the arithmetic of the speed relation alone.
-/

namespace Delphi.LeanBio.Round2.KppSpeed

/-- Named hypothesis: a Fisher-KPP wave with dispersal coefficient `D`, selection coefficient `s`
and minimal speed `c` satisfying `c ^ 2 = 4 * s * D`. -/
structure KppHyp (D s c : ℝ) : Prop where
  D_pos : 0 < D
  s_pos : 0 < s
  c_pos : 0 < c
  minimal : c ^ 2 = 4 * s * D

/-- **Fisher-KPP minimal wave speed.** Under `KppHyp`: `c` is a lower bound on the linear speed
relation at every decay rate, strictly so except at the unique minimiser `2 D k = c`, and the
minimal speed rises strictly with the selection coefficient at fixed dispersal. -/
theorem kpp_min_speed {D s c : ℝ} (h : KppHyp D s c) :
    (∀ k : ℝ, c * k ≤ D * k ^ 2 + s) ∧
    (∀ k : ℝ, 2 * D * k ≠ c → c * k < D * k ^ 2 + s) ∧
    (∀ s' c' : ℝ, 0 < c' → c' ^ 2 = 4 * s' * D → s < s' → c < c') := by
  have hD := h.D_pos
  have hs := h.s_pos
  have hc := h.c_pos
  have hm := h.minimal
  refine ⟨?_, ?_, ?_⟩
  · intro k
    nlinarith [sq_nonneg (2 * D * k - c), hD, hm]
  · intro k hk
    have hne : 2 * D * k - c ≠ 0 := sub_ne_zero.mpr hk
    have hsq : 0 < (2 * D * k - c) ^ 2 := by
      rcases lt_or_gt_of_ne hne with h1 | h1 <;> nlinarith
    nlinarith [hsq, hD, hm]
  · intro s' c' hc' hm' hlt
    nlinarith [hm, hm', hc, hc', hD, hlt]

/-- A model instance: the wave's parameters together with the named hypothesis. -/
structure Instance where
  D : ℝ
  s : ℝ
  c : ℝ
  hyp : KppHyp D s c

/-- Non-vacuity: the hypothesis is satisfiable. D = 1 (km^2 per generation), s = 1/100,
c = 1/5 (km per generation), since c ^ 2 = 4/100 = 4 * (1/100) * 1. These are orders of magnitude
used in textbook gene-wave calculations: plausible values, not measurements. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1, 1 / 100, 1 / 5, ⟨by norm_num, by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.KppSpeed
