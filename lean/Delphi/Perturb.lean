/-
# Perturbation laws for the Design Studio: temperature, current, pressure, altitude and wind, daily energy

The Design Studio optimises a design under perturbations at each developmental stage and rejects a candidate that
breaks a Lean law (lean/eliminate/browser-check.mjs). This module supplies the laws for the perturbations. Every
empirical ingredient is a NAMED HYPOTHESIS: a structure whose fields carry the observation, passed to the theorem as
an argument, exactly as lean/Delphi/Empirical.lean does. There is no `axiom` here: `#print axioms` on every theorem
names only `propext`, `Classical.choice` and `Quot.sound` (lean/Delphi/Audit.lean). A reader who rejects a
hypothesis rejects the structure and loses only its theorems. Every constant below has a fetched source recorded in
lean/perturb-sources.json (Europe PMC REST), with the quoted sentence.

## What is proved, per perturbation

1. **Temperature** (`ThermalPerformance`). Hypothesis: sustained power is ZERO outside `[CTmin, CTmax]` (the thermal
   performance curve, Schulte 2015, PMID 26085663) and inside the window is at most `P_ref Q10^((T - T_ref)/10)`
   (Q10 rule; Rome et al. 1992, PMID 1556515: scup red-muscle power 71 W/kg at 10 C, 134 W/kg at 20 C, Q10 1.88).
   Proved: `sustained_power_le` (the Q10 bound holds at every temperature, inside or outside the window),
   `no_sustained_power_outside` and `thermal_rules_out` (no positive sustained power outside the window).
2. **Swimming against a current** (`SwimLimits`). Hypotheses: ground speed is `U_swim - U_current`; sustained swimming
   is at most `U_crit` (Plaut 2001, PMID 11733165: fish "maintain their position ... until fatigue sets in");
   drag power `rho C_d A U^3 / 2` is paid by sustained power, which is aerobic (the Fick bound `sustained_le` of
   lean/Delphi/Flight.lean). Proved: `station_requires` and the two eliminations `no_station_above_ucrit`,
   `no_station_above_drag_bound`: NO design holds station in a current above `U_crit`, or in a current whose drag
   power at that speed exceeds `eta E Q Ca`.
3. **Pressure.** `Hydrostatic`: absolute pressure `p0 + k d` (1 atm per 10 m, Yancey 2020, PMID 32096337).
   Boyle's law for a closed swim bladder at fixed temperature (`P V = const`; quasi-static only: Kerr et al. 2023,
   PMID 37926724, show it fails for fast decompression): `bladder_volume_eq`, `bladder_volume_anti`,
   `secretion_ratio`, `closed_bladder_rules_out`. `OsmolyteDepthCap`: internal osmolality rises linearly with depth
   (TMAO, Yancey et al. 2014, PMID 24591588) and a teleost cannot be hyperosmotic to seawater (the gradient cannot be
   reversed); the isosmotic depth is at most 8200 m (their prediction). Proved: `depth_le_isosmotic`,
   `no_teleost_below`: no teleost design below 8200 m under that hypothesis.
   **THE HYPOTHESIS IS CONTRADICTED BY OBSERVATION.** A snailfish (*Pseudoliparis* sp. indet. 1) has been filmed
   at 8336 m in the Izu-Ogasawara Trench, "the deepest recorded fish" (Jamieson et al. 2026, PMID 41822858,
   quoting Jamieson et al. 2023, doi:10.1016/j.dsr.2023.104132), 136 m below the 8200 m cap and 146 m below the
   witness's 8190 m crossing. The theorem stays correct under its hypotheses, but `OsmolyteDepthCap` (with
   `isosmotic_le` and the no-reversal premise) is false of at least one real teleost, so the crossing is a SOFT
   limit (an approximate ceiling), not a cap. Rows using it are CONTESTED (lean/perturb-sources.json).
4. **Altitude and wind.** `ISATroposphere`: `rho(h) = rho0 (1 - beta h / T0)^n` with `n > 0` (the barometric form,
   Narayanan and Osechas 2022, PMID 36501962: `T0` 288.15 K, `p0` 1013.25 hPa, lapse 6.5 K/km). Proved:
   `isa_rho_anti` (density falls with height in the troposphere), `vmin_inv_sqrt` and `vmin_density_ratio`
   (`v_min` is proportional to `1/sqrt rho`), `vmin_isa_mono`. Wind (pure kinematics, no source needed):
   SIGN CONVENTION: `w` is the along-track wind component, POSITIVE FOR A TAILWIND, negative for a headwind; `u` is
   the horizontal airspeed and `s` the sink rate, so `u / s = L/D`. Proved: `glide_ground_range`
   (`x = (L/D) h (1 + w/u)`), `glide_ground_range_le`, `wind_glide_rules_out`.
5. **Energy balance over a day** (`SDACoefficient`). Energy conservation, carried as the named hypothesis `hbal`:
   `eps dm = a I - (R + Act + s a I)` with tissue energy density `eps > 0`, assimilation efficiency `a`, intake `I`,
   routine and activity costs `R`, `Act`, and SDA a fraction `s` of the digestible energy (Bihun et al. 2024,
   PMID 38881304: 6 percent in walleye; McLeod and Clark 2016, PMID 27191721: 10.1 to 13.0 percent of meal energy
   in larval clownfish). Proved: `mass_declines_of_deficit`, `intake_needed`, `energy_rules_out`.
6. **Sleep: NO LAW.** The only quantitative theory fetched (Savage and West 2007, PMID 17215372) is for mammals
   (96 species) and predicts sleep time from brain mass; no source gives a quantitative sleep law for a teleost,
   and none was found for day/night activity. Nothing is invented: the Studio's sleep and day/night perturbations
   have no Lean row. Grip and predator escape likewise have no law here.

## Non-vacuity

`measured` instantiates every structure with the fetched numbers and `perturb_nonvacuous : Nonempty Record` is the
witness: if two hypotheses contradicted each other the eliminations would be worthless and `measured` would not
type-check. lean/mutate.mjs carries mutants that change a statement or move a witness number outside its band.
-/
import Mathlib
import Delphi.Flight
import Delphi.Physiology

open Real

namespace Delphi
namespace Perturb

/-! ### 1. Temperature: a thermal window and the Q10 rule -/

/-- A thermal performance curve for sustained power: zero outside `[ctMin, ctMax]`, at most the Q10-scaled
reference inside. `sustained T` is the largest sustained power at body temperature `T`. -/
structure ThermalPerformance where
  ctMin : ℝ
  ctMax : ℝ
  tRef : ℝ
  q10 : ℝ
  pRef : ℝ
  sustained : ℝ → ℝ
  window : ctMin < ctMax
  q10_pos : 0 < q10
  pRef_nonneg : 0 ≤ pRef
  /-- Outside the thermal window there is no sustained performance. -/
  zero_outside : ∀ T, T < ctMin ∨ ctMax < T → sustained T = 0
  /-- Inside it, sustained power is at most the reference scaled by the Q10 rule. -/
  q10_inside : ∀ T, ctMin ≤ T → T ≤ ctMax → sustained T ≤ Physiology.q10Scale pRef q10 tRef T

/-- **Sustained power at temperature `T` is at most `P_ref Q10^((T - T_ref)/10)`**, at every temperature. -/
theorem sustained_power_le (H : ThermalPerformance) {T P : ℝ} (hP : P ≤ H.sustained T) :
    P ≤ H.pRef * H.q10 ^ ((T - H.tRef) / 10) := by
  by_cases h : H.ctMin ≤ T ∧ T ≤ H.ctMax
  · exact hP.trans (H.q10_inside T h.1 h.2)
  · have hout : T < H.ctMin ∨ H.ctMax < T := by
      rcases lt_or_ge T H.ctMin with h1 | h1
      · exact Or.inl h1
      · right
        by_contra h2
        exact h ⟨h1, not_lt.mp h2⟩
    rw [H.zero_outside T hout] at hP
    exact hP.trans (mul_nonneg H.pRef_nonneg (Real.rpow_nonneg H.q10_pos.le _))

/-- **Outside the thermal window no positive power is sustained.** -/
theorem no_sustained_power_outside (H : ThermalPerformance) {T P : ℝ} (hout : T < H.ctMin ∨ H.ctMax < T)
    (hP : P ≤ H.sustained T) : P ≤ 0 := by
  rw [H.zero_outside T hout] at hP
  exact hP

/-- A design claiming positive sustained power outside its thermal window is ruled out. -/
theorem thermal_rules_out (H : ThermalPerformance) {T P : ℝ} (hout : T < H.ctMin ∨ H.ctMax < T)
    (hP : P ≤ H.sustained T) (hpos : 0 < P) : False := by
  have := no_sustained_power_outside H hout hP
  linarith

/-- A design claiming more sustained power at `T` than the Q10 bound allows is ruled out. -/
theorem thermal_power_rules_out (H : ThermalPerformance) {T P : ℝ} (hP : P ≤ H.sustained T)
    (hbig : H.pRef * H.q10 ^ ((T - H.tRef) / 10) < P) : False := by
  have := sustained_power_le H hP
  linarith

/-! ### 2. Swimming against a current -/

/-- Drag power at speed `U` through water of density `rho`: `rho C_d A U^3 / 2`. -/
noncomputable def dragPower (rho Cd A U : ℝ) : ℝ := rho * Cd * A * U ^ 3 / 2

/-- Water density, drag coefficient, reference area and the critical (sustained) swimming speed. -/
structure SwimLimits where
  rho : ℝ
  Cd : ℝ
  area : ℝ
  uCrit : ℝ
  rho_pos : 0 < rho
  Cd_pos : 0 < Cd
  area_pos : 0 < area
  uCrit_pos : 0 < uCrit

/-- **Holding station needs the current below `U_crit` and its drag power inside the aerobic supply.** Hypotheses:
ground speed `U_swim - U_current` is not negative (the animal holds or gains ground), sustained swimming is at most
`U_crit`, the drag power at the swimming speed is paid by a sustained power `P`, and `P` is aerobic (Fick). -/
theorem station_requires (L : SwimLimits) {Uswim Ucur P η E Q Ca Cv : ℝ} (hcur : 0 ≤ Ucur)
    (hhold : 0 ≤ Uswim - Ucur) (hU : Uswim ≤ L.uCrit) (hdrag : dragPower L.rho L.Cd L.area Uswim ≤ P)
    (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv) (hsus : P ≤ aerobicPower η E Q Ca Cv) :
    Ucur ≤ L.uCrit ∧ dragPower L.rho L.Cd L.area Ucur ≤ η * E * Q * Ca := by
  have hle : Ucur ≤ Uswim := by linarith
  refine ⟨hle.trans hU, ?_⟩
  have h3 : Ucur ^ 3 ≤ Uswim ^ 3 := pow_le_pow_left₀ hcur hle 3
  have hk : 0 ≤ L.rho * L.Cd * L.area := by
    have := L.rho_pos; have := L.Cd_pos; have := L.area_pos; positivity
  have hd : dragPower L.rho L.Cd L.area Ucur ≤ dragPower L.rho L.Cd L.area Uswim := by
    unfold dragPower
    apply div_le_div_of_nonneg_right _ (by norm_num)
    exact mul_le_mul_of_nonneg_left h3 hk
  exact hd.trans (hdrag.trans (sustained_le hη hE hQ hCv hsus))

/-- **No design holds station in a current faster than `U_crit`.** -/
theorem no_station_above_ucrit (L : SwimLimits) {Uswim Ucur P η E Q Ca Cv : ℝ} (hcur : 0 ≤ Ucur)
    (hhold : 0 ≤ Uswim - Ucur) (hU : Uswim ≤ L.uCrit) (hdrag : dragPower L.rho L.Cd L.area Uswim ≤ P)
    (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv) (hsus : P ≤ aerobicPower η E Q Ca Cv)
    (hfast : L.uCrit < Ucur) : False := by
  have := (station_requires L hcur hhold hU hdrag hη hE hQ hCv hsus).1
  linarith

/-- **No design holds station in a current whose drag power exceeds its aerobic ceiling `eta E Q Ca`.** -/
theorem no_station_above_drag_bound (L : SwimLimits) {Uswim Ucur P η E Q Ca Cv : ℝ} (hcur : 0 ≤ Ucur)
    (hhold : 0 ≤ Uswim - Ucur) (hU : Uswim ≤ L.uCrit) (hdrag : dragPower L.rho L.Cd L.area Uswim ≤ P)
    (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv) (hsus : P ≤ aerobicPower η E Q Ca Cv)
    (hbig : η * E * Q * Ca < dragPower L.rho L.Cd L.area Ucur) : False := by
  have := (station_requires L hcur hhold hU hdrag hη hE hQ hCv hsus).2
  linarith

/-! ### 3. Pressure: Boyle's law for the swim bladder, and the osmolyte depth cap -/

/-- Absolute pressure rises linearly with depth: `p0 + k d`. -/
structure Hydrostatic where
  p0 : ℝ
  k : ℝ
  p0_pos : 0 < p0
  k_pos : 0 < k

/-- Absolute pressure at depth `d`. -/
def Hydrostatic.pressure (H : Hydrostatic) (d : ℝ) : ℝ := H.p0 + H.k * d

theorem Hydrostatic.pressure_pos (H : Hydrostatic) {d : ℝ} (hd : 0 ≤ d) : 0 < H.pressure d := by
  unfold Hydrostatic.pressure
  have := H.p0_pos; have := H.k_pos; positivity

/-- **Boyle's law for a closed swim bladder.** If `P(d) V(d)` is the same constant at every depth (fixed amount
of gas, fixed temperature, quasi-static), the volume at depth `d` is the surface volume times `p0 / P(d)`. -/
theorem bladder_volume_eq (H : Hydrostatic) {V : ℝ → ℝ} {c : ℝ}
    (hboyle : ∀ d, 0 ≤ d → H.pressure d * V d = c) {d : ℝ} (hd : 0 ≤ d) :
    V d = V 0 * H.p0 / H.pressure d := by
  have h0 := hboyle 0 le_rfl
  have hd' := hboyle d hd
  have hP := H.pressure_pos hd
  have hp0 : H.pressure 0 = H.p0 := by unfold Hydrostatic.pressure; ring
  rw [hp0] at h0
  rw [eq_div_iff hP.ne']
  linarith

/-- **A closed bladder shrinks with depth.** -/
theorem bladder_volume_anti (H : Hydrostatic) {V : ℝ → ℝ} {c : ℝ} (hc : 0 ≤ c)
    (hboyle : ∀ d, 0 ≤ d → H.pressure d * V d = c) {d₁ d₂ : ℝ} (h₁ : 0 ≤ d₁) (h : d₁ ≤ d₂) :
    V d₂ ≤ V d₁ := by
  have hP₁ := H.pressure_pos h₁
  have hP₂ := H.pressure_pos (h₁.trans h)
  have e₁ : V d₁ = c / H.pressure d₁ := by rw [eq_div_iff hP₁.ne']; linarith [hboyle d₁ h₁]
  have e₂ : V d₂ = c / H.pressure d₂ := by rw [eq_div_iff hP₂.ne']; linarith [hboyle d₂ (h₁.trans h)]
  rw [e₁, e₂]
  apply div_le_div_of_nonneg_left hc hP₁
  unfold Hydrostatic.pressure
  have := H.k_pos
  nlinarith

/-- **Keeping the bladder volume at depth needs gas in proportion to pressure.** The amount `P V` at depth `d`
over the amount at the surface, at the same volume, is `1 + k d / p0`. -/
theorem secretion_ratio (H : Hydrostatic) {V d : ℝ} (hV : 0 < V) :
    H.pressure d * V / (H.pressure 0 * V) = 1 + H.k * d / H.p0 := by
  have hp := H.p0_pos.ne'
  unfold Hydrostatic.pressure
  rw [mul_zero, add_zero, mul_div_mul_right _ _ hV.ne', add_div, div_self hp]

/-- A closed-bladder design claiming a volume at depth larger than Boyle's law allows is ruled out. -/
theorem closed_bladder_rules_out (H : Hydrostatic) {V : ℝ → ℝ} {c d : ℝ}
    (hboyle : ∀ d, 0 ≤ d → H.pressure d * V d = c) (hd : 0 ≤ d) {claimed : ℝ} (hclaim : V d = claimed)
    (hbig : V 0 * H.p0 / H.pressure d < claimed) : False := by
  have := bladder_volume_eq H hboyle hd
  linarith

/-- The osmolyte depth cap (Yancey et al. 2014): internal osmolality `a + b d` rises with depth (TMAO), seawater
osmolality is `sw`, and the depth at which the two meet is at most 8200 m. -/
structure OsmolyteDepthCap where
  a : ℝ
  b : ℝ
  sw : ℝ
  b_pos : 0 < b
  /-- The predicted isosmotic depth, at most 8200 m. -/
  isosmotic_le : (sw - a) / b ≤ 8200

/-- Internal osmolality (mOsmol/kg) of a teleost at depth `d` (m). -/
def OsmolyteDepthCap.osm (O : OsmolyteDepthCap) (d : ℝ) : ℝ := O.a + O.b * d

/-- **A teleost that is not hyperosmotic to seawater lives no deeper than the isosmotic depth.** The hypothesis
`hreg` is Yancey's: greater depths would need a reversed osmotic gradient. -/
theorem depth_le_isosmotic (O : OsmolyteDepthCap) {d : ℝ} (hreg : O.osm d ≤ O.sw) :
    d ≤ (O.sw - O.a) / O.b := by
  unfold OsmolyteDepthCap.osm at hreg
  rw [le_div_iff₀ O.b_pos]
  linarith

/-- **No teleost design below 8200 m**, under the osmolyte hypothesis. -/
theorem no_teleost_below (O : OsmolyteDepthCap) {d : ℝ} (hreg : O.osm d ≤ O.sw) (hdeep : 8200 < d) : False := by
  have := depth_le_isosmotic O hreg
  have := O.isosmotic_le
  linarith

/-! ### 4. Altitude and wind -/

/-- The troposphere of the barometric formula: `rho(h) = rho0 (1 - beta h / T0)^n`, `n > 0` (for the ISA
`n = g0 / (R_d beta) - 1`, about 4.256). -/
structure ISATroposphere where
  rho0 : ℝ
  T0 : ℝ
  beta : ℝ
  n : ℝ
  rho0_pos : 0 < rho0
  T0_pos : 0 < T0
  beta_pos : 0 < beta
  n_pos : 0 < n

/-- Air density at height `h` (valid for `0 ≤ h < T0 / beta`). -/
noncomputable def ISATroposphere.rho (A : ISATroposphere) (h : ℝ) : ℝ :=
  A.rho0 * (1 - A.beta * h / A.T0) ^ A.n

theorem ISATroposphere.base_pos (A : ISATroposphere) {h : ℝ} (htop : h < A.T0 / A.beta) :
    0 < 1 - A.beta * h / A.T0 := by
  have := A.T0_pos; have := A.beta_pos
  rw [lt_div_iff₀ A.beta_pos] at htop
  rw [sub_pos, div_lt_one A.T0_pos]
  linarith

theorem isa_rho_pos (A : ISATroposphere) {h : ℝ} (htop : h < A.T0 / A.beta) : 0 < A.rho h := by
  unfold ISATroposphere.rho
  exact mul_pos A.rho0_pos (Real.rpow_pos_of_pos (A.base_pos htop) _)

/-- **Air density falls with height in the troposphere.** -/
theorem isa_rho_anti (A : ISATroposphere) {h₁ h₂ : ℝ} (h : h₁ ≤ h₂) (htop : h₂ < A.T0 / A.beta) :
    A.rho h₂ ≤ A.rho h₁ := by
  unfold ISATroposphere.rho
  apply mul_le_mul_of_nonneg_left _ A.rho0_pos.le
  apply Real.rpow_le_rpow (A.base_pos htop).le _ A.n_pos.le
  have : A.beta * h₁ / A.T0 ≤ A.beta * h₂ / A.T0 :=
    div_le_div_of_nonneg_right (mul_le_mul_of_nonneg_left h A.beta_pos.le) A.T0_pos.le
  linarith

/-- **`v_min` is proportional to `1 / sqrt rho`.** -/
theorem vmin_inv_sqrt {ρ Cmax W S : ℝ} (hρ : 0 < ρ) (hS : 0 < S) (hC : 0 < Cmax) (hW : 0 ≤ W) :
    vmin ρ Cmax W S = Real.sqrt (2 * W / (S * Cmax)) / Real.sqrt ρ := by
  unfold vmin
  rw [← Real.sqrt_div (by positivity)]
  congr 1
  field_simp

/-- **The ratio of minimum speeds is the square root of the inverse density ratio.** -/
theorem vmin_density_ratio {ρ₁ ρ₂ Cmax W S : ℝ} (h₁ : 0 < ρ₁) (h₂ : 0 < ρ₂) (hS : 0 < S) (hC : 0 < Cmax)
    (hW : 0 < W) : vmin ρ₂ Cmax W S / vmin ρ₁ Cmax W S = Real.sqrt (ρ₁ / ρ₂) := by
  rw [vmin_inv_sqrt h₂ hS hC hW.le, vmin_inv_sqrt h₁ hS hC hW.le, Real.sqrt_div h₁.le]
  have hk : 0 < Real.sqrt (2 * W / (S * Cmax)) := Real.sqrt_pos.mpr (by positivity)
  have hs₁ : 0 < Real.sqrt ρ₁ := Real.sqrt_pos.mpr h₁
  have hs₂ : 0 < Real.sqrt ρ₂ := Real.sqrt_pos.mpr h₂
  field_simp

/-- **In the ISA troposphere the minimum speed rises with height.** -/
theorem vmin_isa_mono (A : ISATroposphere) {Cmax W S h₁ h₂ : ℝ} (hS : 0 < S) (hC : 0 < Cmax) (hW : 0 ≤ W)
    (h : h₁ ≤ h₂) (htop : h₂ < A.T0 / A.beta) :
    vmin (A.rho h₁) Cmax W S ≤ vmin (A.rho h₂) Cmax W S := by
  unfold vmin
  apply Real.sqrt_le_sqrt
  have hr₂ := isa_rho_pos A htop
  have hle := isa_rho_anti A h htop
  apply div_le_div_of_nonneg_left (by positivity) (by positivity)
  exact mul_le_mul_of_nonneg_right (mul_le_mul_of_nonneg_right hle hS.le) hC.le

/-- **Ground range of a steady glide in wind.** Horizontal airspeed `u`, sink rate `s` (so `u / s = L/D`), height
`h`, along-track wind `w` (POSITIVE = TAILWIND): the glide lasts `h / s` and covers `(u + w) h / s`, which is
`(L/D) h (1 + w / u)`. -/
theorem glide_ground_range {u s h w x : ℝ} (hu : 0 < u) (hs : 0 < s) (hx : x = (u + w) * (h / s)) :
    x = (u / s) * h * (1 + w / u) := by
  rw [hx]
  field_simp

/-- **The wind-corrected range bound.** With `L/D ≤ (L/D)max` and a headwind no stronger than the airspeed,
`x ≤ (L/D)max h (1 + w / u)`. -/
theorem glide_ground_range_le {u s h w x LDmax : ℝ} (hu : 0 < u) (hs : 0 < s) (hh : 0 ≤ h) (hw : -u ≤ w)
    (hLD : u / s ≤ LDmax) (hx : x = (u + w) * (h / s)) : x ≤ LDmax * h * (1 + w / u) := by
  rw [glide_ground_range hu hs hx]
  have hf : 0 ≤ 1 + w / u := by
    have : -1 ≤ w / u := by rw [le_div_iff₀ hu]; linarith
    linarith
  exact mul_le_mul_of_nonneg_right (mul_le_mul_of_nonneg_right hLD hh) hf

/-- A glide claimed to cover more ground than the wind-corrected bound is ruled out. -/
theorem wind_glide_rules_out {u s h w x LDmax : ℝ} (hu : 0 < u) (hs : 0 < s) (hh : 0 ≤ h) (hw : -u ≤ w)
    (hLD : u / s ≤ LDmax) (hx : x = (u + w) * (h / s)) (hbig : LDmax * h * (1 + w / u) < x) : False := by
  have := glide_ground_range_le hu hs hh hw hLD hx
  linarith

/-! ### 5. Energy balance over a day -/

/-- Specific dynamic action as a fraction `s` of the digestible (assimilated) energy, `0 ≤ s < 1`. -/
structure SDACoefficient where
  s : ℝ
  s_nonneg : 0 ≤ s
  s_lt_one : s < 1

/-- **Mass declines when intake cannot pay the day's costs.** Energy conservation `hbal` over a day:
`eps dm = a I - (R + Act + s a I)`. If `a I (1 - s) < R + Act` then `dm < 0`. -/
theorem mass_declines_of_deficit (D : SDACoefficient) {ε dm a I R Act : ℝ} (hε : 0 < ε)
    (hbal : ε * dm = a * I - (R + Act + D.s * (a * I))) (hdef : a * I * (1 - D.s) < R + Act) : dm < 0 := by
  by_contra h
  have h1 : 0 ≤ ε * dm := mul_nonneg hε.le (not_lt.mp h)
  have h2 : ε * dm = a * I * (1 - D.s) - (R + Act) := by rw [hbal]; ring
  linarith

/-- **The intake a design needs to hold or gain mass:** `I ≥ (R + Act) / (a (1 - s))`. -/
theorem intake_needed (D : SDACoefficient) {ε dm a I R Act : ℝ} (hε : 0 < ε) (ha : 0 < a)
    (hbal : ε * dm = a * I - (R + Act + D.s * (a * I))) (hgrow : 0 ≤ dm) : (R + Act) / (a * (1 - D.s)) ≤ I := by
  have hpos : 0 < a * (1 - D.s) := mul_pos ha (by linarith [D.s_lt_one])
  have h1 : 0 ≤ ε * dm := mul_nonneg hε.le hgrow
  have h2 : ε * dm = I * (a * (1 - D.s)) - (R + Act) := by rw [hbal]; ring
  rw [div_le_iff₀ hpos]
  linarith

/-- A design claiming to hold or gain mass on less intake than its costs need is ruled out. -/
theorem energy_rules_out (D : SDACoefficient) {ε dm a I R Act : ℝ} (hε : 0 < ε) (ha : 0 < a)
    (hbal : ε * dm = a * I - (R + Act + D.s * (a * I))) (hgrow : 0 ≤ dm)
    (hshort : I < (R + Act) / (a * (1 - D.s))) : False := by
  have := intake_needed D hε ha hbal hgrow
  linarith

/-! ### Non-vacuity: the fetched numbers are a witness -/

/-- Every perturbation hypothesis, bundled. An instance is a proof that they are jointly satisfiable. -/
structure Record where
  thermal : ThermalPerformance
  swim : SwimLimits
  hydro : Hydrostatic
  osmolyte : OsmolyteDepthCap
  atmosphere : ISATroposphere
  sda : SDACoefficient

/-- The reference sustained-power curve of the witness: scup red muscle (Rome et al. 1992), 134 W/kg at 20 C with
Q10 1.88, positive only on `[10, 20]` C, the interval over which the source measured it (the true window contains
it; no CTmin or CTmax of scup is claimed). -/
noncomputable def scupSustained (T : ℝ) : ℝ :=
  if 10 ≤ T ∧ T ≤ 20 then Physiology.q10Scale 134 1.88 20 T else 0

/-- The fetched numbers. Thermal: scup, Rome et al. 1992 (PMID 1556515). Swimming: `U_crit` 0.80 m/s, the top speed
of scup on red muscle at 20 C (Rome et al. 1992, PMID 1556514); water density 10132.5 / 9.80665 kg/m^3 from 1 atm per
10 m (Yancey 2020); `C_d` and `A` are DESIGN INPUTS, not observations, set to 1 here only to exhibit the structure.
Pressure: 1 atm at the surface plus 0.1 atm/m (Yancey 2020). Osmolyte: 350 mOsmol/kg shallow, 991 at 7000 m,
seawater 1100 (Yancey et al. 2014), so the two-point line meets seawater at 750 * 7000 / 641 = 8190 m, inside the
published 8200 m. ISA: 1.225 kg/m^3, 288.15 K, 0.0065 K/m, exponent 4.2559 (Narayanan and Osechas 2022 for T0 and
the lapse rate). SDA: 0.06 (walleye, Bihun et al. 2024). -/
noncomputable def measured : Record where
  thermal :=
    { ctMin := 10, ctMax := 20, tRef := 20, q10 := 1.88, pRef := 134, sustained := scupSustained
      window := by norm_num
      q10_pos := by norm_num
      pRef_nonneg := by norm_num
      zero_outside := by
        intro T hT
        unfold scupSustained
        split_ifs with h
        · rcases hT with h' | h' <;> linarith [h.1, h.2]
        · rfl
      q10_inside := by
        intro T h1 h2
        unfold scupSustained
        split_ifs with h
        · exact le_rfl
        · exact absurd ⟨h1, h2⟩ h }
  swim :=
    { rho := 10132.5 / 9.80665, Cd := 1, area := 1, uCrit := 0.8
      rho_pos := by norm_num, Cd_pos := by norm_num, area_pos := by norm_num, uCrit_pos := by norm_num }
  hydro := { p0 := 1, k := 0.1, p0_pos := by norm_num, k_pos := by norm_num }
  osmolyte :=
    { a := 350, b := 641 / 7000, sw := 1100, b_pos := by norm_num
      isosmotic_le := by norm_num }
  atmosphere :=
    { rho0 := 1.225, T0 := 288.15, beta := 0.0065, n := 4.2559
      rho0_pos := by norm_num, T0_pos := by norm_num, beta_pos := by norm_num, n_pos := by norm_num }
  sda := { s := 0.06, s_nonneg := by norm_num, s_lt_one := by norm_num }

/-- **The perturbation layer is non-vacuous**: the fetched numbers satisfy every hypothesis at once. -/
theorem perturb_nonvacuous : Nonempty Record := ⟨measured⟩

/-- Under the witness, no teleost lives below 8200 m. -/
theorem measured_no_teleost_below {d : ℝ} (hreg : measured.osmolyte.osm d ≤ measured.osmolyte.sw)
    (hdeep : 8200 < d) : False := no_teleost_below measured.osmolyte hreg hdeep

end Perturb
end Delphi
