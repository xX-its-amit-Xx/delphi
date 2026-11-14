import Mathlib

/-!
# Fire-coating certificate, version 2: every theorem points the physically right way

Repairs three theorems of `FireCoatingCertificate.lean` that were valid algebra but unsafe physics:

* `thin_ignition_eliminates`, `thick_ignition_eliminates` compared a NO-LOSS ignition time with the
  required time. A no-loss time is a LOWER bound on the real ignition time, so it can only show
  SURVIVAL up to that time, never early ignition. Section 1 states that correctly; section 2 shows
  the old direction is false inside the old file's own lossy model; section 3 gives a sound
  replacement (critical-flux style, with losses bounded above).
* `transient_eliminates` concluded something about the model curve only. Section 5 states it about a
  real back-face temperature `Tb`, with the link to the one-node curve as a named hypothesis.

Every physical assumption is a NAMED HYPOTHESIS of a theorem. Nothing here is an axiom.
Each docstring carries a verdict:
  ELIMINATE         - the conclusion is that the candidate FAILS a criterion (given the hypotheses);
  CANNOT-ELIMINATE  - the conclusion is a guarantee of NOT failing; it can never rule a candidate out.

Units: SI. Temperatures K, flux W/m^2, areal heat capacity `C = rho c d` J/(m^2 K), time s,
resistances m^2 K/W, thermal inertia `I = k rho c`.
-/

namespace FireCoatingV2

/-! ## 0. Mean value step used by sections 1 and 3 -/

/-- Mean value theorem on `[0, t]`: some instant `c` has slope equal to the average slope.
Pure calculus, no physics. -/
theorem mvt_slope (T T' : ℝ → ℝ) (t : ℝ) (ht : 0 < t)
    (hderiv : ∀ s ∈ Set.Icc 0 t, HasDerivAt T (T' s) s) :
    ∃ c ∈ Set.Icc 0 t, T t - T 0 = T' c * t := by
  have hcont : ContinuousOn T (Set.Icc 0 t) :=
    fun s hs => (hderiv s hs).continuousAt.continuousWithinAt
  obtain ⟨c, hc, hceq⟩ := exists_hasDerivAt_eq_slope T T' ht hcont
    (fun s hs => hderiv s (Set.Ioo_subset_Icc_self hs))
  refine ⟨c, Set.Ioo_subset_Icc_self hc, ?_⟩
  have ht0 : t ≠ 0 := ht.ne'
  rw [sub_zero] at hceq
  rw [hceq]
  field_simp

/-! ## 1. SURVIVAL bounds (the right use of the no-loss formulas) -/

/-- Thin-layer no-loss ignition time `C (Tig - T0) / q`. -/
noncomputable def tigThin (C ΔTig q : ℝ) : ℝ := C * ΔTig / q

/-- Thick-solid no-loss ignition time `(pi/4) I (Tig - T0)^2 / q^2`. -/
noncomputable def tigThick (I ΔTig q : ℝ) : ℝ := Real.pi / 4 * I * ΔTig ^ 2 / q ^ 2

/-- VERDICT: CANNOT-ELIMINATE (upper bound on temperature rise).
Thin layer with one temperature `T`. Named hypotheses: `hderiv` (T is differentiable on `[0,t]` with
derivative `T'`) and `hnet` (energy balance in inequality form: the layer's heating rate `C T'` never
exceeds the incident flux `q`, i.e. net absorbed flux <= incident flux, whatever the losses are).
Shows: the real rise is at most the no-loss rise `q t / C`.
Does NOT show: that the layer is thin enough for one temperature to describe it, or any lower bound
on the rise. -/
theorem thin_rise_le_noloss (T T' : ℝ → ℝ) (C q t : ℝ) (hC : 0 < C) (ht : 0 ≤ t)
    (hderiv : ∀ s ∈ Set.Icc 0 t, HasDerivAt T (T' s) s)
    (hnet : ∀ s ∈ Set.Icc 0 t, C * T' s ≤ q) :
    T t - T 0 ≤ q * t / C := by
  rcases ht.eq_or_lt with h0 | hpos
  · subst h0
    simp
  · obtain ⟨c, hc, hceq⟩ := mvt_slope T T' t hpos hderiv
    have h1 := hnet c hc
    have h2 : C * T' c * t ≤ q * t := mul_le_mul_of_nonneg_right h1 hpos.le
    rw [hceq, le_div_iff₀ hC]
    nlinarith [h2]

/-- VERDICT: CANNOT-ELIMINATE (survival up to the no-loss time).
Same hypotheses as `thin_rise_le_noloss`. Shows: at every time `t` strictly before the no-loss
ignition time `tigThin C ΔTig q`, the layer is still below `T 0 + ΔTig`, so ignition by reaching
that temperature cannot have happened at `t`.
Does NOT show: that ignition happens at or after the no-loss time; with losses it may never happen. -/
theorem thin_no_ignition_before_noloss_time (T T' : ℝ → ℝ) (C q ΔTig t : ℝ) (hC : 0 < C)
    (hq : 0 < q) (ht : 0 ≤ t)
    (hderiv : ∀ s ∈ Set.Icc 0 t, HasDerivAt T (T' s) s)
    (hnet : ∀ s ∈ Set.Icc 0 t, C * T' s ≤ q)
    (hearly : t < tigThin C ΔTig q) :
    T t < T 0 + ΔTig := by
  have h1 := thin_rise_le_noloss T T' C q t hC ht hderiv hnet
  unfold tigThin at hearly
  rw [lt_div_iff₀ hq] at hearly
  have h2 : q * t / C < ΔTig := by
    rw [div_lt_iff₀ hC]
    nlinarith [hearly]
  linarith

/-- VERDICT: CANNOT-ELIMINATE (survival up to the no-loss time, thick solid), and CONDITIONAL.
Named hypothesis `hcomp`: the real surface rise at time `t` is at most the no-loss half-space value
`2 q sqrt(t / (pi I))`. That is what the comparison principle for the heat equation gives when net
surface flux <= `q`; the comparison principle itself is NOT proved here, and the half-space formula
was not confirmed from an opened textbook. Shows: under `hcomp`, before `tigThick I ΔTig q` the
surface rise is below `ΔTig`. Does NOT show: `hcomp`, or that the solid is thermally thick. -/
theorem thick_no_ignition_before_noloss_time (rise I ΔTig q t : ℝ) (hI : 0 < I) (hq : 0 < q)
    (ht : 0 ≤ t) (hΔ : 0 < ΔTig)
    (hcomp : rise ≤ 2 * q * Real.sqrt (t / (Real.pi * I)))
    (hearly : t < tigThick I ΔTig q) :
    rise < ΔTig := by
  by_contra hge
  push_neg at hge
  have hπI : 0 < Real.pi * I := mul_pos Real.pi_pos hI
  have hs2 : Real.sqrt (t / (Real.pi * I)) ^ 2 = t / (Real.pi * I) :=
    Real.sq_sqrt (div_nonneg ht hπI.le)
  have h1 : ΔTig ≤ 2 * q * Real.sqrt (t / (Real.pi * I)) := le_trans hge hcomp
  have h2 : ΔTig ^ 2 ≤ (2 * q * Real.sqrt (t / (Real.pi * I))) ^ 2 :=
    pow_le_pow_left₀ hΔ.le h1 2
  have h3 : (2 * q * Real.sqrt (t / (Real.pi * I))) ^ 2 = 4 * q ^ 2 * (t / (Real.pi * I)) := by
    rw [mul_pow, hs2]; ring
  have h2' : ΔTig ^ 2 ≤ 4 * q ^ 2 * (t / (Real.pi * I)) := h2.trans_eq h3
  have h4 : 4 * q ^ 2 * (t / (Real.pi * I)) * (Real.pi * I) = 4 * q ^ 2 * t := by
    field_simp
  have h5 : ΔTig ^ 2 * (Real.pi * I) ≤ 4 * q ^ 2 * t := by
    rw [← h4]
    exact mul_le_mul_of_nonneg_right h2' hπI.le
  unfold tigThick at hearly
  have hq2 : 0 < q ^ 2 := by positivity
  rw [lt_div_iff₀ hq2] at hearly
  nlinarith [h5, hearly]

/-! ## 2. Why the old ignition eliminations were wrong (inside the old file's own lossy model) -/

/-- First-order relaxation toward `Tss` with time constant `τ`, started at zero. -/
noncomputable def relax (Tss τ t : ℝ) : ℝ := Tss * (1 - Real.exp (-(t / τ)))

/-- Thin solid with linear surface loss `h`: solution of `C T' = q - h (T - T0)`, `T 0 = T0`. -/
noncomputable def thinTemp (T0 q h C t : ℝ) : ℝ := T0 + relax (q / h) (C / h) t

/-- VERDICT: CANNOT-ELIMINATE (a statement about two model curves).
For every `t > 0` the lossy thin-model rise is STRICTLY below the no-loss rise `q t / C`.
Shows only this inequality between the two formulas; says nothing about a real specimen. -/
theorem lossy_thin_rise_lt_noloss (q h C t : ℝ) (hq : 0 < q) (hh : 0 < h) (hC : 0 < C)
    (ht : 0 < t) : relax (q / h) (C / h) t < q * t / C := by
  unfold relax
  have hy : 0 < t / (C / h) := div_pos ht (div_pos hC hh)
  have hexp := Real.add_one_lt_exp (x := -(t / (C / h))) (neg_ne_zero.mpr hy.ne')
  have h1 : 1 - Real.exp (-(t / (C / h))) < t / (C / h) := by linarith
  have e : q / h * (t / (C / h)) = q * t / C := by
    field_simp
  calc q / h * (1 - Real.exp (-(t / (C / h))))
      < q / h * (t / (C / h)) := mul_lt_mul_of_pos_left h1 (div_pos hq hh)
    _ = q * t / C := e

/-- VERDICT: CANNOT-ELIMINATE; this is the REFUTATION of the version-1 direction.
In the lossy thin model, at the no-loss ignition time `tigThin` the temperature is still strictly
below the ignition temperature `T0 + ΔTig`. So "`tigThin < treq`" does not imply ignition before
`treq`: version 1's `thin_ignition_eliminates` could not eliminate anything.
Shows this for the lossy thin MODEL curve only (linear loss coefficient `h > 0`). -/
theorem noloss_time_is_before_lossy_ignition (T0 ΔTig q h C : ℝ) (hq : 0 < q) (hh : 0 < h)
    (hC : 0 < C) (hΔ : 0 < ΔTig) :
    thinTemp T0 q h C (tigThin C ΔTig q) < T0 + ΔTig := by
  unfold thinTemp tigThin
  have h1 := lossy_thin_rise_lt_noloss q h C (C * ΔTig / q) hq hh hC
    (div_pos (mul_pos hC hΔ) hq)
  have e : q * (C * ΔTig / q) / C = ΔTig := by
    field_simp
  rw [e] at h1
  linarith

/-! ## 3. A SOUND ignition elimination: critical-flux style, losses bounded ABOVE -/

/-- VERDICT: ELIMINATE (certain ignition by an explicit time).
Thin layer with one real temperature `T`. Named hypotheses, all on `[0, tup]`:
* `hderiv`: `T` is differentiable with derivative `T'`;
* `hbal`: energy balance `C T' = qabs - loss` (absorbed flux minus all surface losses);
* `habs`: absorbed flux is at least `qmin` (e.g. worst-case absorptivity times incident flux);
* `hloss`: while the layer is below `Tig`, losses are at most `hmax (T - T0)` (a worst-case combined
  convective plus linearised radiative coefficient valid up to `Tig`);
* `hstart`: the layer starts at or above ambient `T0`;
* `hsup`: `qmin` exceeds the critical flux `hmax (Tig - T0)`.
Shows: the layer reaches `Tig` at some instant no later than
`tup = C (Tig - T0) / (qmin - hmax (Tig - T0))`.
Does NOT show: that reaching `Tig` causes flaming (that is the ignition-temperature criterion
itself), that the layer is thin enough for one temperature (small Biot number), or that `hmax` and
`qmin` hold for a given product: those must come from measurement. -/
theorem thin_critical_flux_ignites (T T' qabs loss : ℝ → ℝ) (T0 Tig C qmin hmax tup : ℝ)
    (hC : 0 < C) (hTig : T0 < Tig) (hh : 0 ≤ hmax) (hstart : T0 ≤ T 0)
    (hsup : hmax * (Tig - T0) < qmin)
    (htup : tup = C * (Tig - T0) / (qmin - hmax * (Tig - T0)))
    (hderiv : ∀ s ∈ Set.Icc 0 tup, HasDerivAt T (T' s) s)
    (hbal : ∀ s ∈ Set.Icc 0 tup, C * T' s = qabs s - loss s)
    (habs : ∀ s ∈ Set.Icc 0 tup, qmin ≤ qabs s)
    (hloss : ∀ s ∈ Set.Icc 0 tup, T s < Tig → loss s ≤ hmax * (T s - T0)) :
    ∃ s ∈ Set.Icc 0 tup, Tig ≤ T s := by
  by_contra hne
  push_neg at hne
  have hmpos : 0 < qmin - hmax * (Tig - T0) := by linarith
  have hmne : qmin - hmax * (Tig - T0) ≠ 0 := hmpos.ne'
  have htpos : 0 < tup := by
    rw [htup]
    exact div_pos (mul_pos hC (sub_pos.mpr hTig)) hmpos
  obtain ⟨c, hc, hceq⟩ := mvt_slope T T' tup htpos hderiv
  have hTc := hne c hc
  have h1 : qmin - hmax * (Tig - T0) ≤ C * T' c := by
    have hb := hbal c hc
    have ha := habs c hc
    have hl := hloss c hc hTc
    have hm : hmax * (T c - T0) ≤ hmax * (Tig - T0) :=
      mul_le_mul_of_nonneg_left (by linarith) hh
    linarith
  have h3 : C * (Tig - T0) = (qmin - hmax * (Tig - T0)) * tup := by
    have e := (eq_div_iff hmne).mp htup
    linarith
  have hend := hne tup ⟨htpos.le, le_refl _⟩
  have h2 : (qmin - hmax * (Tig - T0)) * tup ≤ C * T' c * tup :=
    mul_le_mul_of_nonneg_right h1 htpos.le
  have h4 : C * (Tig - T0) ≤ C * (T tup - T 0) := by
    rw [hceq, h3]
    nlinarith [h2]
  have h5 : Tig - T0 ≤ T tup - T 0 := le_of_mul_le_mul_left h4 hC
  linarith

/-- VERDICT: ELIMINATE (fails a "no ignition before `treq`" requirement).
Same hypotheses as `thin_critical_flux_ignites`, plus `hreq`: the guaranteed-ignition time `tup` is
within the required non-ignition time `treq`. Shows: the layer reaches `Tig` at some instant in
`[0, treq]`. Same exclusions as `thin_critical_flux_ignites`. -/
theorem thin_ignition_eliminates_sound (T T' qabs loss : ℝ → ℝ)
    (T0 Tig C qmin hmax tup treq : ℝ)
    (hC : 0 < C) (hTig : T0 < Tig) (hh : 0 ≤ hmax) (hstart : T0 ≤ T 0)
    (hsup : hmax * (Tig - T0) < qmin)
    (htup : tup = C * (Tig - T0) / (qmin - hmax * (Tig - T0)))
    (hderiv : ∀ s ∈ Set.Icc 0 tup, HasDerivAt T (T' s) s)
    (hbal : ∀ s ∈ Set.Icc 0 tup, C * T' s = qabs s - loss s)
    (habs : ∀ s ∈ Set.Icc 0 tup, qmin ≤ qabs s)
    (hloss : ∀ s ∈ Set.Icc 0 tup, T s < Tig → loss s ≤ hmax * (T s - T0))
    (hreq : tup ≤ treq) :
    ∃ s ∈ Set.Icc 0 treq, Tig ≤ T s := by
  obtain ⟨s, hs, hT⟩ := thin_critical_flux_ignites T T' qabs loss T0 Tig C qmin hmax tup
    hC hTig hh hstart hsup htup hderiv hbal habs hloss
  exact ⟨s, ⟨hs.1, hs.2.trans hreq⟩, hT⟩

/-! ## 4. SOUND steady-state back-face eliminations (about a real temperature `Tb`) -/

/-- VERDICT: ELIMINATE at STEADY STATE only.
`Tb` is the real steady back-face rise above ambient, `qf` the real steady flux through the wall.
Named hypotheses: `hfilm` (all the flux leaves through the back-face film of resistance `Ra`:
`Tb = qf Ra`) and `hflux` (a lower bound `qlow` on that flux). Shows: if `qlow Ra` exceeds the limit,
so does `Tb`. Does NOT show anything at a finite test time (see section 5), and does not show
`hflux`. -/
theorem steady_flux_lower_eliminates (Tb qf qlow Ra limit : ℝ) (hRa : 0 < Ra)
    (hfilm : Tb = qf * Ra) (hflux : qlow ≤ qf) (hbad : limit < qlow * Ra) : limit < Tb := by
  have h1 : qlow * Ra ≤ qf * Ra := mul_le_mul_of_nonneg_right hflux hRa.le
  linarith

/-- VERDICT: ELIMINATE at STEADY STATE only.
`ΔT` is the fire-side SURFACE temperature of the coating minus ambient (not the gas temperature:
there is no fire-side film in this model). Named hypotheses: `hfilm` (`Tb = qf Ra`) and `hcond`
(steady one-dimensional conduction through total solid resistance `R`: `ΔT - Tb = qf R`), with
`R ≤ Rmax` the best-case (largest) resistance in the envelope. Shows: if even `Rmax` leaves the rise
above a non-negative limit, the real steady rise `Tb` exceeds the limit.
Does NOT show anything at a finite test time, and assumes the fire-side surface is held at `ΔT`. -/
theorem steady_backface_eliminates (Tb qf ΔT R Rmax Ra limit : ℝ) (hR : 0 ≤ R)
    (hRm : R ≤ Rmax) (hRa : 0 < Ra) (hlim : 0 ≤ limit)
    (hfilm : Tb = qf * Ra) (hcond : ΔT - Tb = qf * R)
    (hbad : limit < ΔT * Ra / (Rmax + Ra)) : limit < Tb := by
  have hp : 0 < R + Ra := by linarith
  have hpm : 0 < Rmax + Ra := by linarith
  rw [lt_div_iff₀ hpm] at hbad
  have key : Tb * (R + Ra) = ΔT * Ra := by
    have hΔ : ΔT = Tb + qf * R := by linarith
    rw [hΔ, hfilm]
    ring
  have h1 : limit * (R + Ra) ≤ limit * (Rmax + Ra) :=
    mul_le_mul_of_nonneg_left (by linarith) hlim
  have h2 : limit * (R + Ra) < Tb * (R + Ra) := by linarith
  exact lt_of_mul_lt_mul_right h2 hp.le

/-! ## 5. Finite-time lumped statement with the missing hypothesis made explicit -/

/-- VERDICT: ELIMINATE at the finite test time `t`, CONDITIONAL on `hmodel`.
`Tb t` is the real back-face rise at time `t`. Named hypotheses:
* `hmodel`: at time `t` the real rise is at least the one-node curve `relax Tss τ t`. This is the
  hypothesis version 1 claimed but did not have. It is a strong assumption: a real slab's back face
  LAGS (stays near zero until the heat pulse arrives), so `hmodel` is false at early times for a
  thick wall and is only plausible when the wall behaves as one node (small Biot number);
* `hlow`: the steady rise `Tss` is at least a best-case value `Tsslow`;
* `hτm`: the time constant is at most `τmax`.
Shows: if the guaranteed fraction `1 - exp(-t/τmax)` of `Tsslow` exceeds the limit, so does `Tb t`.
Does NOT show `hmodel`; without it this theorem eliminates nothing. -/
theorem transient_eliminates_explicit (Tb : ℝ → ℝ) (Tss Tsslow τ τmax t limit : ℝ)
    (hlow0 : 0 ≤ Tsslow) (hlow : Tsslow ≤ Tss) (hτ : 0 < τ) (hτm : τ ≤ τmax) (ht : 0 ≤ t)
    (hmodel : relax Tss τ t ≤ Tb t)
    (hbad : limit < (1 - Real.exp (-(t / τmax))) * Tsslow) : limit < Tb t := by
  have hτm0 : 0 < τmax := lt_of_lt_of_le hτ hτm
  have hf : 0 ≤ 1 - Real.exp (-(t / τmax)) := by
    have : Real.exp (-(t / τmax)) ≤ 1 :=
      Real.exp_le_one_iff.mpr (neg_nonpos.mpr (div_nonneg ht hτm0.le))
    linarith
  have hdiv : t / τmax ≤ t / τ := div_le_div_of_nonneg_left ht hτ hτm
  have hexp : Real.exp (-(t / τ)) ≤ Real.exp (-(t / τmax)) :=
    Real.exp_le_exp.mpr (neg_le_neg hdiv)
  have hT : 0 ≤ Tss := le_trans hlow0 hlow
  have h1 : (1 - Real.exp (-(t / τmax))) * Tsslow ≤ (1 - Real.exp (-(t / τmax))) * Tss :=
    mul_le_mul_of_nonneg_left hlow hf
  have h2 : (1 - Real.exp (-(t / τmax))) * Tss ≤ (1 - Real.exp (-(t / τ))) * Tss :=
    mul_le_mul_of_nonneg_right (by linarith) hT
  have h3 : (1 - Real.exp (-(t / τ))) * Tss = relax Tss τ t := by
    unfold relax; ring
  linarith

#print axioms mvt_slope
#print axioms thin_rise_le_noloss
#print axioms thin_no_ignition_before_noloss_time
#print axioms thick_no_ignition_before_noloss_time
#print axioms lossy_thin_rise_lt_noloss
#print axioms noloss_time_is_before_lossy_ignition
#print axioms thin_critical_flux_ignites
#print axioms thin_ignition_eliminates_sound
#print axioms steady_flux_lower_eliminates
#print axioms steady_backface_eliminates
#print axioms transient_eliminates_explicit

end FireCoatingV2
