import Mathlib

/-
  LeanBio discovery round 2, candidate 2 of 10. Claim `turing-ddi`
  (docs/claims.json; math-bio-theorems/claims/key-claims.json):
    "A homogeneous steady state of two reacting chemicals that is stable without diffusion can
     become unstable to spatial perturbations when the chemicals diffuse at different rates."
  Claim notation: u_t = f(u,v) + Du lap u, v_t = g(u,v) + Dv lap v; with tr J < 0 and det J > 0,
  instability at some wavenumber k iff Dv f_u + Du g_v > 2 sqrt(Du Dv det J), which requires Du != Dv.
  Source: Turing AM (1952) The chemical basis of morphogenesis. Phil Trans R Soc B 237:37-72.
  doi:10.1098/rstb.1952.0012

  NAMED HYPOTHESIS (not proved here, not an axiom): `TuringHyp du dv fu fv gu gv` collects the
  linearisation of a two-morphogen reaction-diffusion system about a homogeneous steady state:
  positive diffusivities, a Jacobian that is stable without diffusion (negative trace, positive
  determinant), and Turing's inequality in its squared, division-free form
      4 * du * dv * det J < (dv * fu + du * gv)^2,   with  0 < dv * fu + du * gv.
  Squaring replaces the square root of the claim's notation; with both sides positive the two are
  equivalent, and no irrational constant enters the statement.

  PROVED from the hypothesis: there is a strictly positive squared wavenumber q = k^2 at which the
  dispersion relation `disp` is negative, so the homogeneous state is linearly unstable to a spatial
  mode -- and, separately, the diffusivities CANNOT be equal. The second half is an impossibility:
  no equal-diffusivity two-morphogen system whose steady state is stable without diffusion can
  produce a Turing instability, whatever its kinetics.

  NOT established: that any pattern forms. This is the linear instability of a fixed, non-growing,
  one-dimensional-in-wavenumber domain; which pattern is selected, and whether it persists, is
  nonlinear and outside the hypothesis. Nor does it establish that any developmental system in any
  organism is a two-morphogen reaction-diffusion system.
-/

namespace Delphi.LeanBio.Round2.TuringDDI

/-- The dispersion relation of the linearised two-morphogen system, as a function of the squared
wavenumber `q = k^2`: the determinant of `J - q * D`. The homogeneous state is unstable to the
mode `q` when this is negative (the trace stays negative, so the sign of the determinant decides). -/
noncomputable def disp (du dv fu fv gu gv q : ℝ) : ℝ :=
  du * dv * q ^ 2 - (dv * fu + du * gv) * q + (fu * gv - fv * gu)

/-- Named hypothesis: the linearisation of a two-morphogen reaction-diffusion system about a
homogeneous steady state that is stable without diffusion, satisfying Turing's inequality. -/
structure TuringHyp (du dv fu fv gu gv : ℝ) : Prop where
  du_pos : 0 < du
  dv_pos : 0 < dv
  trace_neg : fu + gv < 0
  det_pos : 0 < fu * gv - fv * gu
  cross_pos : 0 < dv * fu + du * gv
  turing : 4 * (du * dv) * (fu * gv - fv * gu) < (dv * fu + du * gv) ^ 2

/-- **Diffusion-driven instability.** Under `TuringHyp` there is a strictly positive squared
wavenumber whose mode is unstable, and the two diffusivities are necessarily unequal. -/
theorem turing_instability {du dv fu fv gu gv : ℝ} (h : TuringHyp du dv fu fv gu gv) :
    (∃ q : ℝ, 0 < q ∧ disp du dv fu fv gu gv q < 0) ∧ du ≠ dv := by
  have hdu := h.du_pos
  have hdv := h.dv_pos
  have hc := h.cross_pos
  have ht := h.trace_neg
  have hT := h.turing
  refine ⟨⟨(dv * fu + du * gv) / (2 * (du * dv)), ?_, ?_⟩, ?_⟩
  · positivity
  · have hA : (0:ℝ) < 4 * (du * dv) := by positivity
    have key : (4 * (du * dv)) * disp du dv fu fv gu gv ((dv * fu + du * gv) / (2 * (du * dv)))
        = 4 * (du * dv) * (fu * gv - fv * gu) - (dv * fu + du * gv) ^ 2 := by
      unfold disp
      field_simp
      ring
    nlinarith [key, hT, hA]
  · intro hEq
    rw [hEq] at hc
    nlinarith [hc, ht, hdv]

/-- A model instance: the linearisation's six numbers together with the named hypothesis. -/
structure Instance where
  du : ℝ
  dv : ℝ
  fu : ℝ
  fv : ℝ
  gu : ℝ
  gv : ℝ
  hyp : TuringHyp du dv fu fv gu gv

/-- Non-vacuity: the hypothesis is satisfiable. An activator-inhibitor linearisation with
du = 1, dv = 40, fu = 1, fv = -2, gu = 2, gv = -2: trace = -1 < 0, determinant = 1*(-2) - (-2)*2 = 2 > 0,
cross = 40*1 + 1*(-2) = 38 > 0, and 4*(1*40)*2 = 320 < 38^2 = 1444. The 40-fold diffusivity ratio is
of the order used in published activator-inhibitor fits; it is a plausible value, not a measurement. -/
theorem witness : Nonempty Instance :=
  ⟨⟨1, 40, 1, -2, 2, -2, ⟨by norm_num, by norm_num, by norm_num, by norm_num, by norm_num, by norm_num⟩⟩⟩

end Delphi.LeanBio.Round2.TuringDDI
