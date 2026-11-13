import Mathlib

/-!
# Elimination certificates for fire-retardant coatings (one-dimensional heat laws)

Every physical assumption is a HYPOTHESIS of a theorem, never an axiom. A certificate here can only
ELIMINATE a candidate (prove it must fail a stated criterion under stated assumptions); none of
these theorems can approve a coating.

Units: SI. `ΔT` kelvin, `d`, `x` metres, `k` W/(m K), resistances m^2 K/W, `q` W/m^2, times in s.
-/

namespace FireCoating

open Real

/-! ## 1. Steady series resistance and back-face temperature rise -/

/-- Total thermal resistance per unit area: coating `d/k`, substrate `Rs`, unexposed-side film `Ra`. -/
noncomputable def totalR (d k Rs Ra : ℝ) : ℝ := d / k + Rs + Ra

/-- Steady back-face temperature rise above ambient: flux `ΔT / totalR` times the film resistance. -/
noncomputable def backRise (ΔT d k Rs Ra : ℝ) : ℝ := ΔT * Ra / totalR d k Rs Ra

theorem totalR_pos (d k Rs Ra : ℝ) (hd : 0 ≤ d) (hk : 0 < k) (hRs : 0 ≤ Rs) (hRa : 0 < Ra) :
    0 < totalR d k Rs Ra := by
  unfold totalR
  have : 0 ≤ d / k := div_nonneg hd hk.le
  linarith

/-- The back face never rises above the fire-side temperature difference. -/
theorem backRise_le_ΔT (ΔT d k Rs Ra : ℝ) (hΔ : 0 ≤ ΔT) (hd : 0 ≤ d) (hk : 0 < k)
    (hRs : 0 ≤ Rs) (hRa : 0 < Ra) : backRise ΔT d k Rs Ra ≤ ΔT := by
  have hpos := totalR_pos d k Rs Ra hd hk hRs hRa
  have hge : Ra ≤ totalR d k Rs Ra := by
    unfold totalR
    have : 0 ≤ d / k := div_nonneg hd hk.le
    linarith
  unfold backRise
  rw [div_le_iff₀ hpos]
  nlinarith

/-- A thicker coating never raises the steady back-face temperature. -/
theorem backRise_antitone_thickness (ΔT d₁ d₂ k Rs Ra : ℝ) (hΔ : 0 ≤ ΔT) (hd₁ : 0 ≤ d₁)
    (h12 : d₁ ≤ d₂) (hk : 0 < k) (hRs : 0 ≤ Rs) (hRa : 0 < Ra) :
    backRise ΔT d₂ k Rs Ra ≤ backRise ΔT d₁ k Rs Ra := by
  have hp₁ := totalR_pos d₁ k Rs Ra hd₁ hk hRs hRa
  have hle : totalR d₁ k Rs Ra ≤ totalR d₂ k Rs Ra := by
    unfold totalR
    have : d₁ / k ≤ d₂ / k := div_le_div_of_nonneg_right h12 hk.le
    linarith
  unfold backRise
  exact div_le_div_of_nonneg_left (by positivity) hp₁ hle

/-- LOWER bound on the steady rise from an upper bound on thickness and a lower bound on conductivity. -/
theorem backRise_lower (ΔT d dmax k kmin Rs Ra : ℝ) (hΔ : 0 ≤ ΔT) (hd : 0 ≤ d)
    (hdm : d ≤ dmax) (hkmin : 0 < kmin) (hk : kmin ≤ k) (hRs : 0 ≤ Rs) (hRa : 0 < Ra) :
    ΔT * Ra / (dmax / kmin + Rs + Ra) ≤ backRise ΔT d k Rs Ra := by
  have hk0 : 0 < k := lt_of_lt_of_le hkmin hk
  have hp := totalR_pos d k Rs Ra hd hk0 hRs hRa
  have h1 : d / k ≤ dmax / kmin := by
    calc d / k ≤ d / kmin := div_le_div_of_nonneg_left hd hkmin hk
      _ ≤ dmax / kmin := div_le_div_of_nonneg_right hdm hkmin.le
  have hle : totalR d k Rs Ra ≤ dmax / kmin + Rs + Ra := by unfold totalR; linarith
  unfold backRise
  exact div_le_div_of_nonneg_left (by positivity) hp hle

/-- STEADY-STATE ELIMINATION: if even the best case within the stated envelope exceeds the limit,
the steady back-face rise exceeds it. (Says nothing about a finite test time: see section 5.) -/
theorem steady_eliminates (ΔT d dmax k kmin Rs Ra limit : ℝ) (hΔ : 0 ≤ ΔT) (hd : 0 ≤ d)
    (hdm : d ≤ dmax) (hkmin : 0 < kmin) (hk : kmin ≤ k) (hRs : 0 ≤ Rs) (hRa : 0 < Ra)
    (hbad : limit < ΔT * Ra / (dmax / kmin + Rs + Ra)) : limit < backRise ΔT d k Rs Ra :=
  lt_of_lt_of_le hbad (backRise_lower ΔT d dmax k kmin Rs Ra hΔ hd hdm hkmin hk hRs hRa)

/-! ## 2. Char layer as an added resistance -/

noncomputable def backRiseChar (ΔT d k xc kc Rs Ra : ℝ) : ℝ :=
  ΔT * Ra / (d / k + xc / kc + Rs + Ra)

/-- A char layer (thickness `xc ≥ 0`, conductivity `kc > 0`) can only lower the steady rise. -/
theorem char_lowers_rise (ΔT d k xc kc Rs Ra : ℝ) (hΔ : 0 ≤ ΔT) (hd : 0 ≤ d) (hk : 0 < k)
    (hxc : 0 ≤ xc) (hkc : 0 < kc) (hRs : 0 ≤ Rs) (hRa : 0 < Ra) :
    backRiseChar ΔT d k xc kc Rs Ra ≤ backRise ΔT d k Rs Ra := by
  have hp := totalR_pos d k Rs Ra hd hk hRs hRa
  have hx : 0 ≤ xc / kc := div_nonneg hxc hkc.le
  unfold backRiseChar backRise totalR at *
  apply div_le_div_of_nonneg_left (by positivity) hp
  linarith

/-- Elimination with char: a bound on char thickness (`xc ≤ xmax`) and conductivity (`kc ≥ kcmin`),
all coating thickness/conductivity envelopes as in section 1. -/
theorem char_eliminates (ΔT d dmax k kmin xc xmax kc kcmin Rs Ra limit : ℝ) (hΔ : 0 ≤ ΔT)
    (hd : 0 ≤ d) (hdm : d ≤ dmax) (hkmin : 0 < kmin) (hk : kmin ≤ k) (hxc : 0 ≤ xc)
    (hxm : xc ≤ xmax) (hkcmin : 0 < kcmin) (hkc : kcmin ≤ kc) (hRs : 0 ≤ Rs) (hRa : 0 < Ra)
    (hbad : limit < ΔT * Ra / (dmax / kmin + xmax / kcmin + Rs + Ra)) :
    limit < backRiseChar ΔT d k xc kc Rs Ra := by
  have hk0 : 0 < k := lt_of_lt_of_le hkmin hk
  have hkc0 : 0 < kc := lt_of_lt_of_le hkcmin hkc
  have hxn : 0 ≤ xc / kc := div_nonneg hxc hkc0.le
  have hp : 0 < d / k + xc / kc + Rs + Ra := by
    have : 0 ≤ d / k := div_nonneg hd hk0.le
    linarith
  have h1 : d / k ≤ dmax / kmin := by
    calc d / k ≤ d / kmin := div_le_div_of_nonneg_left hd hkmin hk
      _ ≤ dmax / kmin := div_le_div_of_nonneg_right hdm hkmin.le
  have h2 : xc / kc ≤ xmax / kcmin := by
    calc xc / kc ≤ xc / kcmin := div_le_div_of_nonneg_left hxc hkcmin hkc
      _ ≤ xmax / kcmin := div_le_div_of_nonneg_right hxm hkcmin.le
  have hle : d / k + xc / kc + Rs + Ra ≤ dmax / kmin + xmax / kcmin + Rs + Ra := by linarith
  refine lt_of_lt_of_le hbad ?_
  unfold backRiseChar
  exact div_le_div_of_nonneg_left (by positivity) hp hle

/-! ## 3. Thermal penetration depth: thick or thin -/

/-- Penetration depth `c * sqrt (α t)`. The constant `c` is a convention (textbooks use 1, 2 or sqrt π);
the theorem holds for every `c > 0`. -/
noncomputable def pdepth (c α t : ℝ) : ℝ := c * Real.sqrt (α * t)

/-- A slab of thickness `d` is thermally thick (front pulse has not reached the back) exactly while
`t ≤ d² / (c² α)`. -/
theorem thick_iff_time (c α t d : ℝ) (hc : 0 < c) (hα : 0 < α) (ht : 0 ≤ t) (hd : 0 ≤ d) :
    pdepth c α t ≤ d ↔ t ≤ d ^ 2 / (c ^ 2 * α) := by
  unfold pdepth
  have hαt : 0 ≤ α * t := by positivity
  have h1 : c * Real.sqrt (α * t) ≤ d ↔ Real.sqrt (α * t) ≤ d / c := by
    rw [le_div_iff₀ hc]; constructor <;> intro h <;> linarith
  rw [h1, Real.sqrt_le_left (by positivity)]
  rw [le_div_iff₀ (by positivity)]
  constructor <;> intro h
  · have : α * t ≤ (d / c) ^ 2 := h
    rw [div_pow] at this
    rw [le_div_iff₀ (by positivity)] at this
    nlinarith
  · have : α * t ≤ (d / c) ^ 2 := by
      rw [div_pow, le_div_iff₀ (by positivity)]
      nlinarith
    exact this

/-! ## 4. Lumped (one-node) transient: the finite-time version of the back-face rise,
and thermally thin ignition with surface loss -/

/-- First-order relaxation toward a steady value `Tss` with time constant `τ`, started at zero:
the solution of `τ T' = Tss - T`. -/
noncomputable def relax (Tss τ t : ℝ) : ℝ := Tss * (1 - Real.exp (-(t / τ)))

/-- `relax` really solves `τ T' = Tss - T` (derivative identity). -/
theorem relax_ode (Tss τ t : ℝ) (hτ : 0 < τ) :
    HasDerivAt (relax Tss τ) (Tss / τ * Real.exp (-(t / τ))) t ∧
    τ * (Tss / τ * Real.exp (-(t / τ))) = Tss - relax Tss τ t := by
  constructor
  · have h1 : HasDerivAt (fun s : ℝ => -(s / τ)) (-(1 / τ)) t :=
      ((hasDerivAt_id t).div_const τ).neg
    have h2 := (h1.exp).const_sub 1 |>.const_mul Tss
    convert h2 using 1
    · funext s; rfl
    · field_simp
  · unfold relax
    field_simp
    ring


/-- Only an UPPER bound `τmax` on the time constant is needed for a lower bound on the response. -/
theorem relax_lower (Tss τ τmax t : ℝ) (hT : 0 ≤ Tss) (hτ : 0 < τ) (hτm : τ ≤ τmax) (ht : 0 ≤ t) :
    Tss * (1 - Real.exp (-(t / τmax))) ≤ relax Tss τ t := by
  unfold relax
  have hdiv : t / τmax ≤ t / τ := div_le_div_of_nonneg_left ht hτ hτm
  have hexp : Real.exp (-(t / τ)) ≤ Real.exp (-(t / τmax)) := Real.exp_le_exp.mpr (neg_le_neg hdiv)
  exact mul_le_mul_of_nonneg_left (by linarith) hT

/-- FINITE-TIME ELIMINATION. Model assumption (hypothesis, not axiom): the back-face rise follows the
one-node response `relax` toward the steady rise, with time constant at most `τmax`. If the guaranteed
fraction `1 - exp(-t/τmax)` of the best-case steady rise already exceeds the limit at test time `t`,
the candidate exceeds the limit at `t`. -/
theorem transient_eliminates (ΔT d dmax k kmin Rs Ra τ τmax t limit : ℝ) (hΔ : 0 ≤ ΔT) (hd : 0 ≤ d)
    (hdm : d ≤ dmax) (hkmin : 0 < kmin) (hk : kmin ≤ k) (hRs : 0 ≤ Rs) (hRa : 0 < Ra)
    (hτ : 0 < τ) (hτm : τ ≤ τmax) (ht : 0 ≤ t)
    (hbad : limit < (1 - Real.exp (-(t / τmax))) * (ΔT * Ra / (dmax / kmin + Rs + Ra))) :
    limit < relax (backRise ΔT d k Rs Ra) τ t := by
  have hk0 : 0 < k := lt_of_lt_of_le hkmin hk
  have hp := totalR_pos d k Rs Ra hd hk0 hRs hRa
  have hB : 0 ≤ backRise ΔT d k Rs Ra := by unfold backRise; positivity
  have hτm0 : 0 < τmax := lt_of_lt_of_le hτ hτm
  have hf : 0 ≤ 1 - Real.exp (-(t / τmax)) := by
    have : Real.exp (-(t / τmax)) ≤ 1 :=
      Real.exp_le_one_iff.mpr (neg_nonpos.mpr (div_nonneg ht hτm0.le))
    linarith
  have h1 := backRise_lower ΔT d dmax k kmin Rs Ra hΔ hd hdm hkmin hk hRs hRa
  have h2 := relax_lower (backRise ΔT d k Rs Ra) τ τmax t hB hτ hτm ht
  have h3 : (1 - Real.exp (-(t / τmax))) * (ΔT * Ra / (dmax / kmin + Rs + Ra)) ≤
      backRise ΔT d k Rs Ra * (1 - Real.exp (-(t / τmax))) := by
    rw [mul_comm]; exact mul_le_mul_of_nonneg_right h1 hf
  linarith

/-- Thin solid (uniform temperature) with surface loss `h`: `C T' = q - h (T - T0)`, `C = ρ c d`. -/
noncomputable def thinTemp (T0 q h C t : ℝ) : ℝ := T0 + relax (q / h) (C / h) t

/-- Critical flux, thin case: below `q = h (Tig - T0)` the surface never reaches `Tig`, at any time. -/
theorem thin_never_ignites (T0 Tig q h C t : ℝ) (hq : 0 ≤ q) (hh : 0 < h) (hC : 0 < C) (ht : 0 ≤ t)
    (hsub : q < h * (Tig - T0)) : thinTemp T0 q h C t < Tig := by
  unfold thinTemp relax
  have h1 : q / h < Tig - T0 := by rw [div_lt_iff₀ hh]; linarith
  have h2 : 0 < Real.exp (-(t / (C / h))) := Real.exp_pos _
  have h3 : 0 ≤ q / h := div_nonneg hq hh.le
  nlinarith

/-- Above the critical flux a thin solid does reach `Tig`, at the explicit time `t*`. -/
theorem thin_reaches_Tig (T0 Tig q h C : ℝ) (hTig : T0 < Tig) (hh : 0 < h) (hC : 0 < C)
    (hsup : h * (Tig - T0) < q) :
    thinTemp T0 q h C (-((C / h) * Real.log (1 - h * (Tig - T0) / q))) = Tig := by
  have hq : 0 < q := lt_trans (mul_pos hh (sub_pos.mpr hTig)) hsup
  have hx0 : 0 < h * (Tig - T0) / q := div_pos (mul_pos hh (sub_pos.mpr hTig)) hq
  have hx1 : h * (Tig - T0) / q < 1 := (div_lt_one hq).mpr hsup
  have hCh : C / h ≠ 0 := (div_pos hC hh).ne'
  have e1 : -(-((C / h) * Real.log (1 - h * (Tig - T0) / q)) / (C / h))
      = Real.log (1 - h * (Tig - T0) / q) := by
    field_simp
  unfold thinTemp relax
  rw [e1, Real.exp_log (by linarith)]
  field_simp
  ring

/-! ## 5. Time to ignition against a critical-flux style exposure -/

/-- Thermally thick, constant flux `q`, no loss (the standard first-term result):
`t = (π/4) · (kρc) · (Tig - T0)² / q²`. Model assumptions are those of that approximation. -/
noncomputable def tigThick (I ΔTig q : ℝ) : ℝ := Real.pi / 4 * I * ΔTig ^ 2 / q ^ 2

/-- Thermally thin, constant flux `q`, no loss: `t = ρ c d (Tig - T0) / q`. -/
noncomputable def tigThin (C ΔTig q : ℝ) : ℝ := C * ΔTig / q

theorem tigThick_antitone_flux (I ΔTig q₁ q₂ : ℝ) (hI : 0 ≤ I) (h1 : 0 < q₁) (h12 : q₁ ≤ q₂) :
    tigThick I ΔTig q₂ ≤ tigThick I ΔTig q₁ := by
  unfold tigThick
  apply div_le_div_of_nonneg_left (by positivity) (by positivity)
  exact pow_le_pow_left₀ h1.le h12 2

/-- IGNITION ELIMINATION: an UPPER bound `Imax` on the thermal inertia `kρc` and the flux the regulation
applies are enough to prove ignition happens before the required non-ignition time `treq`. -/
theorem thick_ignition_eliminates (I Imax ΔTig q treq : ℝ) (hI : 0 ≤ I) (hIm : I ≤ Imax) (hq : 0 < q)
    (hbad : Real.pi / 4 * Imax * ΔTig ^ 2 / q ^ 2 < treq) : tigThick I ΔTig q < treq := by
  refine lt_of_le_of_lt ?_ hbad
  unfold tigThick
  apply div_le_div_of_nonneg_right _ (by positivity)
  have : 0 ≤ Real.pi / 4 * ΔTig ^ 2 := by positivity
  nlinarith [mul_le_mul_of_nonneg_left hIm this]

theorem thin_ignition_eliminates (C Cmax ΔTig q treq : ℝ) (hC : 0 ≤ C) (hCm : C ≤ Cmax)
    (hΔ : 0 ≤ ΔTig) (hq : 0 < q) (hbad : Cmax * ΔTig / q < treq) : tigThin C ΔTig q < treq := by
  refine lt_of_le_of_lt ?_ hbad
  unfold tigThin
  exact div_le_div_of_nonneg_right (mul_le_mul_of_nonneg_right hCm hΔ) hq.le

/-! ## 6. Energy balance: fuel load forces a peak heat release rate -/

/-- The peak of `n` equal-length samples of the heat release rate is at least their mean. -/
theorem peak_ge_mean (n : ℕ) (hn : 0 < n) (Q : Fin n → ℝ) : ∃ i, (∑ j, Q j) / n ≤ Q i := by
  by_contra h
  push_neg at h
  have hne : (Finset.univ : Finset (Fin n)).Nonempty := Finset.univ_nonempty_iff.mpr ⟨⟨0, hn⟩⟩
  have hlt := Finset.sum_lt_sum_of_nonempty hne (fun j _ => h j)
  simp only [Finset.sum_const, Finset.card_univ, Fintype.card_fin, nsmul_eq_mul] at hlt
  have hn' : (0 : ℝ) < n := by exact_mod_cast hn
  have : (n : ℝ) * ((∑ j, Q j) / n) = ∑ j, Q j := by field_simp
  linarith

/-- PEAK-HRR ELIMINATION from fuel load. Hypotheses: all the fuel burns inside `n` windows of `dt`
seconds (`hE`: sampled heat release times `dt` equals the energy `E`), and `E ≥ χmin·mmin·ΔHmin`
(combustion efficiency, fuel mass per area, heat of combustion). Then some window exceeds `limit`
whenever the mean already does. -/
theorem hrr_eliminates (n : ℕ) (hn : 0 < n) (Q : Fin n → ℝ) (dt E χmin mmin ΔHmin limit : ℝ)
    (hdt : 0 < dt) (hE : (∑ j, Q j) * dt = E) (hχ : 0 ≤ χmin) (hm : 0 ≤ mmin) (hH : 0 ≤ ΔHmin)
    (hEmin : χmin * mmin * ΔHmin ≤ E)
    (hbad : limit < χmin * mmin * ΔHmin / (n * dt)) : ∃ i, limit < Q i := by
  obtain ⟨i, hi⟩ := peak_ge_mean n hn Q
  have hn' : (0 : ℝ) < n := by exact_mod_cast hn
  have h2 : χmin * mmin * ΔHmin / (n * dt) ≤ (∑ j, Q j) / n := by
    rw [div_le_div_iff₀ (by positivity) hn']
    nlinarith [mul_nonneg hn'.le (sub_nonneg.mpr hEmin)]
  exact ⟨i, by linarith⟩

/-! ## 7. A worked, ILLUSTRATIVE instance (numbers are placeholders, see the report) -/

/-- 2 mm coating, k = 0.10 W/(m K), within the envelope d ≤ 3 mm and k ≥ 0.08, on a substrate
`Rs = 0.05`, film `Ra = 1/9`, fire-side difference 800 K: the best-case steady back-face rise exceeds
a 400 K illustrative limit, so the candidate is eliminated before any test. -/
theorem worked_example :
    (400 : ℝ) < backRise 800 (2 / 1000) (1 / 10) (1 / 20) (1 / 9) := by
  apply steady_eliminates 800 (2 / 1000) (3 / 1000) (1 / 10) (2 / 25) (1 / 20) (1 / 9) 400 <;>
    norm_num

#print axioms backRise_le_ΔT
#print axioms backRise_antitone_thickness
#print axioms steady_eliminates
#print axioms char_lowers_rise
#print axioms char_eliminates
#print axioms thick_iff_time
#print axioms relax_ode
#print axioms transient_eliminates
#print axioms thin_never_ignites
#print axioms thin_reaches_Tig
#print axioms tigThick_antitone_flux
#print axioms thick_ignition_eliminates
#print axioms thin_ignition_eliminates
#print axioms peak_ge_mean
#print axioms hrr_eliminates
#print axioms worked_example

end FireCoating
