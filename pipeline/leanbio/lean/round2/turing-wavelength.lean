import Mathlib

/-
  LeanBio discovery round 2, candidate 8. Claim `turing-wavelength`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "The spacing of a Turing pattern at onset is set by the reaction rates and diffusivities, not by
     the size of the tissue, so changing these parameters predictably changes the spacing."
  Claim notation: at onset k_c^2 = sqrt(det J / (Du Dv)), lambda_c = 2 pi / k_c; under uniform
  rescaling of D, lambda is proportional to sqrt(D).
  Source: Turing AM (1952) The chemical basis of morphogenesis. Phil Trans R Soc B 237:37-72.
  doi:10.1098/rstb.1952.0012 (see_also doi:10.1126/science.1226804, doi:10.1126/science.1252960).

  NAMED HYPOTHESIS (not proved here, not an axiom): `OnsetHyp du dv Dt q` says that at onset the
  squared critical wavenumber q = k_c ^ 2 satisfies
      q ^ 2 * (du * dv) = Dt,
  with positive diffusivities du, dv, positive Jacobian determinant Dt = det J, and q > 0. This is
  the claim's k_c^2 = sqrt(det J/(Du Dv)), squared so no square root enters the statement.

  PROVED from the hypothesis:
    * UNIQUENESS: any two solutions of the onset relation for the same du, dv and det J are equal.
      This is how "not by the size of the tissue" is formalised -- the domain size is not among the
      quantities the relation mentions, so it cannot enter the value. The formalisation is
      "determined by du, dv and det J alone", which is a statement about this relation and not a
      proof that no other mechanism depends on tissue size.
    * SCALING: if both diffusivities are multiplied by m > 1 at fixed kinetics, the new squared
      critical wavenumber qm satisfies qm * m = q exactly, and so is strictly smaller. Since
      lambda_c = 2 pi / sqrt(q), the wavelength grows as sqrt(m): the claim's lambda proportional
      to sqrt(D).

  NOT established: that any tissue patterns at onset, or that the observed spacing of any real
  pattern equals lambda_c. On a FINITE domain the admissible modes are quantised by the boundary
  conditions, so the realised spacing does depend on tissue size; this law is about the critical
  wavenumber of the dispersion relation on an unbounded domain, which is what "at onset" and
  "domain large compared with the wavelength" in the claim's own assumptions mean. Away from onset
  the selected wavelength is set by nonlinear mode competition.
-/

namespace Delphi.LeanBio.Round2.TuringWavelength

/-- Named hypothesis: the onset relation for the squared critical wavenumber `q = k_c ^ 2`, given
diffusivities `du`, `dv` and Jacobian determinant `Dt`. -/
structure OnsetHyp (du dv Dt q : ℝ) : Prop where
  du_pos : 0 < du
  dv_pos : 0 < dv
  det_pos : 0 < Dt
  q_pos : 0 < q
  onset : q ^ 2 * (du * dv) = Dt

/-- **Turing wavelength at onset.** Under `OnsetHyp` the squared critical wavenumber is determined
by the diffusivities and the Jacobian determinant alone (so the tissue size cannot enter it), and
multiplying both diffusivities by `m > 1` divides it by exactly `m`, which strictly lowers it --
so the critical wavelength grows as the square root of the diffusivity scale. -/
theorem onset_wavenumber {du dv Dt q q' : ℝ} (h : OnsetHyp du dv Dt q) (h' : OnsetHyp du dv Dt q')
    {m qm : ℝ} (hm : 1 < m) (hM : OnsetHyp (m * du) (m * dv) Dt qm) :
    q = q' ∧ qm * m = q ∧ qm < q := by
  have hdu := h.du_pos
  have hdv := h.dv_pos
  have hq := h.q_pos
  have hq' := h'.q_pos
  have hqm := hM.q_pos
  have e := h.onset
  have e' := h'.onset
  have em := hM.onset
  have hdd : (0:ℝ) < du * dv := mul_pos hdu hdv
  -- uniqueness
  have hz : (q - q') * (q + q') * (du * dv) = 0 := by linear_combination e - e'
  have hz2 : (q - q') * (q + q') = 0 := by
    rcases mul_eq_zero.1 hz with h3 | h3
    · exact h3
    · exfalso; linarith
  have h1 : q = q' := by
    rcases mul_eq_zero.1 hz2 with h3 | h3
    · linarith
    · exfalso; linarith
  -- scaling
  have hz3 : (qm * m - q) * (qm * m + q) * (du * dv) = 0 := by linear_combination em - e
  have hz4 : qm * m - q = 0 := by
    rcases mul_eq_zero.1 hz3 with h3 | h3
    · rcases mul_eq_zero.1 h3 with h4 | h4
      · exact h4
      · exfalso; nlinarith
    · exfalso; linarith
  refine ⟨h1, by linarith, ?_⟩
  nlinarith [hqm, hm, hz4]

/-- A model instance: the onset relation's numbers together with the named hypothesis. -/
structure Instance where
  du : ℝ
  dv : ℝ
  Dt : ℝ
  q : ℝ
  hyp : OnsetHyp du dv Dt q

/-- Non-vacuity: the hypothesis is satisfiable. du = 1, dv = 4, Dt = 4 and q = 1, since
1 ^ 2 * (1 * 4) = 4. Illustrative numbers in the same ratio range as the turing-ddi witness; not a
measurement. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1, 4, 4, 1, ⟨by norm_num, by norm_num, by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.TuringWavelength
