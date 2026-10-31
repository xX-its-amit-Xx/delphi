/-
# Scaling laws of an isometric family: area, wing loading, strength, minimum speed, power (R2–R8)

Formalises the statements the physics thread handed over in `physics/FORMAL-STATEMENTS.md` (2026-10-31),
building on `CubeLaw` (R1, `Delphi/Thompson.lean`). A *family* is described by functions of one linear
dimension `L > 0`: mass `M L`, weight `W L`, lifting area `S L`, load-bearing cross-section `A L`. The laws
are **named hypotheses** on those functions, never facts about the world:

* `CubeLaw W k₁`  : `W L = k₁ L³` (isometry with constant density; R1).
* `AreaLaw S k₂`  : `S L = k₂ L²` (isometry of an area; R2).
* `MusclePowerLaw P M f p` : `P L = f p M L` with `f`, `p` constants (R6, Thompson's premise; contested).
* `σ`, `ρ`, `C_L,max`, `L/D`, `Fr` enter as constants: "the same for every member of the family".

## What is proved (every statement conditional on the named hypotheses)

* R2 `areaLaw_ratio`: `S L₂ / S L₁ = (L₂/L₁)²`.
* R3 `wingLoading_ratio`: `(W/S)(L₂) / (W/S)(L₁) = L₂/L₁`.
* R7 `breakLoad_ratio`: with `F_break = σ A`, `F_break(L₂)/F_break(L₁) = (L₂/L₁)²`; `safetyFactor_eq`:
  `F_break/W = σ k₃ / (k₁ L)`, so `stress_ratio`: `(W/A)(L₂)/(W/A)(L₁) = L₂/L₁`; `cannot_carry`: above
  `L_max = σ k₃ / (k₁ n)` the member cannot carry `n` body weights. This is the missing half of Galileo's
  square–cube argument: with R1 and R7 together, "a giant of unchanged proportions and material can stand"
  is a commitment the checker can rule on (`Delphi/Constraints.lean`, C8).
* R4 `vmin_le`: if lift `½ ρ v² S C_L` equals weight with `C_L ≤ C_L,max`, then `v ≥ √(2W/(ρ S C_L,max))`
  (exact, no isometry). `vmin_ratio`: under R1, R2 and constant `ρ`, `C_L,max`, `v_min(L₂)/v_min(L₁) = √(L₂/L₁)`.
* R5 `powerRequired_ratio`: at `v_min` with constant `L/D`, `P_req(L₂)/P_req(L₁) = (L₂/L₁)³ √(L₂/L₁)`,
  i.e. `log` exponent `7/2` (`powerRequired_log`).
* R6 `powerAvailable_ratio`: under `MusclePowerLaw` and R1, `P_avail(L₂)/P_avail(L₁) = (L₂/L₁)³`; corollary
  `exists_size_limit`: there is a size above which `P_req > P_avail` (the size exists; its value needs
  `f`, `p`, `L/D`, `ρ`, `C_L,max`, which no proof supplies).
* R8 `froude_ratio`: at equal Froude number, `v(L₂)/v(L₁) = √(L₂/L₁)`.

## What is assumed, not proved

Isometry of mass, areas and sections (real animals break it: Davenport 1992 measured fin area ∝ L^1.83 and
wing loading ∝ L^1.24 within one flying-fish species; bones thicken with size), constant density, the same
material (`σ`), the same `C_L,max` across sizes (Reynolds effects), the same `L/D`, flight at `v_min`, axial
loading, and Thompson's muscle premise (`p` constant), which modern expectation puts below `L³`. Nothing here
is a measured fact: the physics thread found one flying-fish specimen inside its own `v_min` envelope and
could not test the `(W/S)^½` scaling with the data it had. No number from `physics/results.json` appears in
any statement.
-/
import Mathlib
import Delphi.Thompson

open Real

namespace Delphi

/-- Isometry of an area: `S L = k L²`. -/
def AreaLaw (S : ℝ → ℝ) (k : ℝ) : Prop := 0 < k ∧ ∀ L, 0 < L → S L = k * L ^ 2

/-- Thompson's muscle premise, carried as a named hypothesis: power available is a fixed fraction `f` of
body mass times a fixed mass-specific power `p`. -/
def MusclePowerLaw (P M : ℝ → ℝ) (f p : ℝ) : Prop := 0 < f ∧ 0 < p ∧ ∀ L, 0 < L → P L = f * p * M L

lemma areaLaw_pos {S : ℝ → ℝ} {k : ℝ} (h : AreaLaw S k) {L : ℝ} (hL : 0 < L) : 0 < S L := by
  rw [h.2 L hL]; have := h.1; positivity

/-- **R2, area law.** -/
theorem areaLaw_ratio {S : ℝ → ℝ} {k : ℝ} (h : AreaLaw S k) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    S L₂ / S L₁ = (L₂ / L₁) ^ 2 := by
  rw [h.2 L₁ h₁, h.2 L₂ h₂, div_pow, mul_div_mul_left _ _ h.1.ne']

/-- **R3, wing loading.** Weight per unit area grows linearly with size. -/
theorem wingLoading_ratio {W S : ℝ → ℝ} {k₁ k₂ : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂) {L₁ L₂ : ℝ}
    (h₁ : 0 < L₁) (h₂ : 0 < L₂) : (W L₂ / S L₂) / (W L₁ / S L₁) = L₂ / L₁ := by
  rw [hW.2 L₁ h₁, hW.2 L₂ h₂, hS.2 L₁ h₁, hS.2 L₂ h₂]
  have := hW.1; have := hS.1
  field_simp

/-- The `log` form of R2: exponent `2`. -/
theorem areaLaw_log {S : ℝ → ℝ} {k : ℝ} (h : AreaLaw S k) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    Real.log (S L₂ / S L₁) = 2 * Real.log (L₂ / L₁) := by
  rw [areaLaw_ratio h h₁ h₂, Real.log_pow]
  push_cast
  ring

/-- The `log` form of R3 (and of stress, below): exponent `1`. -/
theorem wingLoading_log {W S : ℝ → ℝ} {k₁ k₂ : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂) {L₁ L₂ : ℝ}
    (h₁ : 0 < L₁) (h₂ : 0 < L₂) : Real.log ((W L₂ / S L₂) / (W L₁ / S L₁)) = 1 * Real.log (L₂ / L₁) := by
  rw [wingLoading_ratio hW hS h₁ h₂, one_mul]

/-! ### R7: strength -/

/-- Axial breaking load of a member of cross-section `A L` made of material with breaking stress `σ`. -/
def breakLoad (σ : ℝ) (A : ℝ → ℝ) (L : ℝ) : ℝ := σ * A L

/-- **R7, conclusion 1.** Breaking load scales as `L²`. -/
theorem breakLoad_ratio {A : ℝ → ℝ} {k₃ σ : ℝ} (hA : AreaLaw A k₃) (hσ : 0 < σ) {L₁ L₂ : ℝ} (h₁ : 0 < L₁)
    (h₂ : 0 < L₂) : breakLoad σ A L₂ / breakLoad σ A L₁ = (L₂ / L₁) ^ 2 := by
  unfold breakLoad
  rw [mul_div_mul_left _ _ hσ.ne']
  exact areaLaw_ratio hA h₁ h₂

/-- **R7, conclusion 2.** The static safety factor `F_break / W` equals `σ k₃ / (k₁ L)`: it falls as `1/L`. -/
theorem safetyFactor_eq {W A : ℝ → ℝ} {k₁ k₃ σ : ℝ} (hW : CubeLaw W k₁) (hA : AreaLaw A k₃) {L : ℝ}
    (hL : 0 < L) : breakLoad σ A L / W L = σ * k₃ / (k₁ * L) := by
  unfold breakLoad
  rw [hW.2 L hL, hA.2 L hL]
  have := hW.1
  field_simp

/-- **Stress grows linearly with size**: `(W/A)(L₂)/(W/A)(L₁) = L₂/L₁` (R1 with R2 on the section). -/
theorem stress_ratio {W A : ℝ → ℝ} {k₁ k₃ : ℝ} (hW : CubeLaw W k₁) (hA : AreaLaw A k₃) {L₁ L₂ : ℝ}
    (h₁ : 0 < L₁) (h₂ : 0 < L₂) : (W L₂ / A L₂) / (W L₁ / A L₁) = L₂ / L₁ :=
  wingLoading_ratio hW hA h₁ h₂

/-- The safety factor of the body scaled by `ℓ` is the reference safety factor divided by `ℓ`. -/
theorem safetyFactor_scaled {W A : ℝ → ℝ} {k₁ k₃ σ : ℝ} (hW : CubeLaw W k₁) (hA : AreaLaw A k₃)
    {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    breakLoad σ A L₂ / W L₂ = (breakLoad σ A L₁ / W L₁) / (L₂ / L₁) := by
  rw [safetyFactor_eq hW hA h₁, safetyFactor_eq hW hA h₂]
  have := hW.1
  field_simp

/-- **Size limit.** Above `L_max = σ k₃ / (k₁ n)` the member cannot carry `n` body weights. -/
theorem cannot_carry {W A : ℝ → ℝ} {k₁ k₃ σ n : ℝ} (hW : CubeLaw W k₁) (hA : AreaLaw A k₃) (hσ : 0 < σ)
    (hn : 0 < n) {L : ℝ} (hL : σ * k₃ / (k₁ * n) < L) : breakLoad σ A L < n * W L := by
  have hk₁ := hW.1; have hk₃ := hA.1
  have hLpos : 0 < L := lt_of_le_of_lt (by positivity) hL
  unfold breakLoad
  rw [hW.2 L hLpos, hA.2 L hLpos]
  rw [div_lt_iff₀ (by positivity)] at hL
  nlinarith [mul_lt_mul_of_pos_right hL (pow_pos hLpos 2)]

/-! ### R4: minimum flight speed -/

/-- Lift at airspeed `v`: `½ ρ v² S C_L`. -/
noncomputable def lift (ρ v S C : ℝ) : ℝ := 1 / 2 * ρ * v ^ 2 * S * C

/-- The smallest airspeed at which lift can equal weight `W` with lifting area `S`. -/
noncomputable def vmin (ρ Cmax W S : ℝ) : ℝ := Real.sqrt (2 * W / (ρ * S * Cmax))

/-- **R4, conclusion 1 (exact, no isometry).** Steady lift-supported flight at lift coefficient at most
`C_L,max` needs `v ≥ v_min`. -/
theorem vmin_le {ρ S C Cmax W v : ℝ} (hρ : 0 < ρ) (hS : 0 < S) (hC : 0 < C) (hCmax : C ≤ Cmax) (hv : 0 ≤ v)
    (hlift : lift ρ v S C = W) : vmin ρ Cmax W S ≤ v := by
  have hCm : 0 < Cmax := lt_of_lt_of_le hC hCmax
  have hden : 0 < ρ * S * Cmax := by positivity
  have key : 2 * W / (ρ * S * Cmax) ≤ v ^ 2 := by
    rw [div_le_iff₀ hden, ← hlift, lift]
    have : 0 ≤ ρ * v ^ 2 * S := by positivity
    nlinarith [mul_le_mul_of_nonneg_left hCmax this]
  calc vmin ρ Cmax W S = Real.sqrt (2 * W / (ρ * S * Cmax)) := rfl
    _ ≤ Real.sqrt (v ^ 2) := Real.sqrt_le_sqrt key
    _ = v := Real.sqrt_sq hv

/-- **R4, conclusion 2.** Under R1, R2 and the same `ρ`, `C_L,max` for every member, `v_min` scales as `√L`. -/
theorem vmin_ratio {W S : ℝ → ℝ} {k₁ k₂ ρ Cmax : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂) (hρ : 0 < ρ)
    (hCmax : 0 < Cmax) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    vmin ρ Cmax (W L₂) (S L₂) / vmin ρ Cmax (W L₁) (S L₁) = Real.sqrt (L₂ / L₁) := by
  unfold vmin
  have hk₁ := hW.1; have hk₂ := hS.1
  have hx₁ : 0 ≤ 2 * W L₁ / (ρ * S L₁ * Cmax) := by
    rw [hW.2 L₁ h₁, hS.2 L₁ h₁]; positivity
  rw [← Real.sqrt_div' _ (by rw [hW.2 L₁ h₁, hS.2 L₁ h₁]; positivity)]
  congr 1
  rw [hW.2 L₁ h₁, hW.2 L₂ h₂, hS.2 L₁ h₁, hS.2 L₂ h₂]
  field_simp

/-- The `log` form of R4: exponent `1/2`. -/
theorem vmin_log {W S : ℝ → ℝ} {k₁ k₂ ρ Cmax : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂) (hρ : 0 < ρ)
    (hCmax : 0 < Cmax) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    Real.log (vmin ρ Cmax (W L₂) (S L₂) / vmin ρ Cmax (W L₁) (S L₁)) = 1 / 2 * Real.log (L₂ / L₁) := by
  rw [vmin_ratio hW hS hρ hCmax h₁ h₂, Real.log_sqrt (by positivity)]
  ring

/-! ### R5 and R6: power -/

/-- Mechanical power to sustain level flight at speed `v`: thrust equals drag, `P = W v / (L/D)`. -/
noncomputable def powerRequired (W v LD : ℝ) : ℝ := W * v / LD

/-- **R5.** At `v_min`, with constant `L/D`, power required scales as `L³ √L`, i.e. `L^3.5`. -/
theorem powerRequired_ratio {W S : ℝ → ℝ} {k₁ k₂ ρ Cmax LD : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂)
    (hρ : 0 < ρ) (hCmax : 0 < Cmax) (hLD : 0 < LD) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    powerRequired (W L₂) (vmin ρ Cmax (W L₂) (S L₂)) LD / powerRequired (W L₁) (vmin ρ Cmax (W L₁) (S L₁)) LD
      = (L₂ / L₁) ^ 3 * Real.sqrt (L₂ / L₁) := by
  have hr := vmin_ratio hW hS hρ hCmax h₁ h₂
  have hw := cubeLaw_ratio hW h₁ h₂
  have hv₁ : 0 < vmin ρ Cmax (W L₁) (S L₁) := by
    unfold vmin; apply Real.sqrt_pos.mpr; rw [hW.2 L₁ h₁, hS.2 L₁ h₁]; have := hW.1; have := hS.1; positivity
  have hW₁ : 0 < W L₁ := cubeLaw_pos hW h₁
  unfold powerRequired
  rw [← hw, ← hr]
  field_simp

/-- The `log` form of R5: exponent `7/2`. -/
theorem powerRequired_log {W S : ℝ → ℝ} {k₁ k₂ ρ Cmax LD : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂)
    (hρ : 0 < ρ) (hCmax : 0 < Cmax) (hLD : 0 < LD) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    Real.log (powerRequired (W L₂) (vmin ρ Cmax (W L₂) (S L₂)) LD /
      powerRequired (W L₁) (vmin ρ Cmax (W L₁) (S L₁)) LD) = 7 / 2 * Real.log (L₂ / L₁) := by
  rw [powerRequired_ratio hW hS hρ hCmax hLD h₁ h₂]
  have hq : 0 < L₂ / L₁ := by positivity
  rw [Real.log_mul (by positivity) (by positivity), Real.log_pow, Real.log_sqrt hq.le]
  push_cast
  ring

/-- **R6 (as a named hypothesis).** Under Thompson's muscle premise and R1, power available scales as `L³`. -/
theorem powerAvailable_ratio {P M : ℝ → ℝ} {f p k : ℝ} (hP : MusclePowerLaw P M f p) (hM : CubeLaw M k)
    {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) : P L₂ / P L₁ = (L₂ / L₁) ^ 3 := by
  rw [hP.2.2 L₁ h₁, hP.2.2 L₂ h₂, mul_div_mul_left _ _ (by have := hP.1; have := hP.2.1; positivity)]
  exact cubeLaw_ratio hM h₁ h₂

/-- The ratio `P_req / P_avail` equals `c √L` for an explicit positive constant `c`. -/
theorem powerRatio_eq {W S M P : ℝ → ℝ} {k₁ k₂ kM ρ Cmax LD f p : ℝ} (hW : CubeLaw W k₁) (hS : AreaLaw S k₂)
    (hM : CubeLaw M kM) (hP : MusclePowerLaw P M f p) (hρ : 0 < ρ) (hCmax : 0 < Cmax) (hLD : 0 < LD)
    {L : ℝ} (hL : 0 < L) :
    powerRequired (W L) (vmin ρ Cmax (W L) (S L)) LD / P L
      = k₁ / (LD * f * p * kM) * Real.sqrt (2 * k₁ / (ρ * k₂ * Cmax)) * Real.sqrt L := by
  have hk₁ := hW.1; have hk₂ := hS.1; have hkM := hM.1; have hf := hP.1; have hp := hP.2.1
  unfold powerRequired vmin
  rw [hW.2 L hL, hS.2 L hL, hP.2.2 L hL, hM.2 L hL]
  have hx : 2 * (k₁ * L ^ 3) / (ρ * (k₂ * L ^ 2) * Cmax) = 2 * k₁ / (ρ * k₂ * Cmax) * L := by
    field_simp
  rw [hx, Real.sqrt_mul (by positivity)]
  field_simp

/-- **Corollary of R5 and R6 (Thompson's "a bird as large as a man could not fly").** There is a size above
which the power required exceeds the power available. The size exists; its value is not supplied. -/
theorem exists_size_limit {W S M P : ℝ → ℝ} {k₁ k₂ kM ρ Cmax LD f p : ℝ} (hW : CubeLaw W k₁)
    (hS : AreaLaw S k₂) (hM : CubeLaw M kM) (hP : MusclePowerLaw P M f p) (hρ : 0 < ρ) (hCmax : 0 < Cmax)
    (hLD : 0 < LD) : ∃ Ls : ℝ, 0 < Ls ∧ ∀ L, Ls < L → P L < powerRequired (W L) (vmin ρ Cmax (W L) (S L)) LD := by
  have hk₁ := hW.1; have hk₂ := hS.1; have hkM := hM.1; have hf := hP.1; have hp := hP.2.1
  set c := k₁ / (LD * f * p * kM) * Real.sqrt (2 * k₁ / (ρ * k₂ * Cmax)) with hc
  have hcpos : 0 < c := by rw [hc]; positivity
  refine ⟨1 / c ^ 2, by positivity, fun L hL => ?_⟩
  have hLpos : 0 < L := lt_trans (by positivity) hL
  have hPpos : 0 < P L := by rw [hP.2.2 L hLpos, hM.2 L hLpos]; positivity
  have hratio := powerRatio_eq hW hS hM hP hρ hCmax hLD hLpos
  rw [← hc] at hratio
  have hsqrt : 1 / c < Real.sqrt L := by
    rw [Real.lt_sqrt (by positivity)]
    rwa [one_div, inv_pow, ← one_div]
  have h1 : 1 < c * Real.sqrt L := by
    have := mul_lt_mul_of_pos_left hsqrt hcpos
    rwa [mul_one_div_cancel hcpos.ne'] at this
  rw [← hratio] at h1
  rwa [lt_div_iff₀ hPpos, one_mul] at h1

/-! ### R8: Froude -/

/-- Speed at a fixed Froude number `Fr = v² / (g L)`. -/
noncomputable def froudeSpeed (Fr g L : ℝ) : ℝ := Real.sqrt (Fr * g * L)

/-- **R8.** At equal Froude number, speed scales as `√L`. -/
theorem froude_ratio {Fr g : ℝ} (hFr : 0 < Fr) (hg : 0 < g) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    froudeSpeed Fr g L₂ / froudeSpeed Fr g L₁ = Real.sqrt (L₂ / L₁) := by
  unfold froudeSpeed
  rw [← Real.sqrt_div' _ (by positivity)]
  congr 1
  field_simp

end Delphi
