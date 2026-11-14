import Mathlib

/-!
# What a printed hygromorphic strip cannot do: sag, speed and rotation certificates

A horizontal printed strip (bilayer or louvre blade) of length `L` and total thickness `h` is asked
to do three things at once: not droop under its own weight, respond to wetting in a required time,
and turn its tip through a required angle. Each demand bounds `h`:

* self-weight sag  `3 ρ g L⁴ / (2 E h²) ≤ δ`  is a FLOOR on `h`      (thin strips droop),
* response time    `h² / (π² D) ≤ t`          is a CEILING on `h`    (thick layers are slow),
* tip rotation     `θ ≤ (3/2) ε L / h`        is a CEILING on `h`    (thick strips curl less).

The file proves that these pin `h` into one interval, gives the exact condition for the interval to
be empty, and derives a maximum length that no thickness can rescue.

Everything physical is a NAMED HYPOTHESIS or a definition. Nothing here derives beam theory or the
diffusion equation: the cantilever formula enters through `sag_from_beam` (which takes the
Euler-Bernoulli tip deflection `q L⁴ / (8 E I)` as given), the diffusion time is the definition
`tau`, and the rotation ceiling is proved from the Timoshenko bilayer formula (definition copied
from `lean/ThompsonLaws/Hygromorphs.lean`). Small deflection, uniform section, one effective
modulus `E`, Fickian diffusion with constant `D`, and uniform curvature are all assumed.
-/

namespace ThompsonLaws.PrintStructure

noncomputable section

/-! ## 1. Self-weight sag -/

/-- Tip sag of a horizontal uniform rectangular cantilever under its own weight,
`3 ρ g L⁴ / (2 E h²)`. A definition, not a derivation. -/
def sag (ρ g L E h : ℝ) : ℝ := 3 * ρ * g * L ^ 4 / (2 * E * h ^ 2)

/-- The floor on `h²` that a sag limit `δ` implies: `3 ρ g L⁴ / (2 E δ)`. -/
def sagFloorSq (ρ g L E δ : ℝ) : ℝ := 3 * ρ * g * L ^ 4 / (2 * E * δ)

/-- SHOWS: if the tip deflection is the Euler-Bernoulli value `q L⁴ / (8 E I)` (hypothesis `hδ`),
the load per length is the strip's own weight `q = ρ g b h` and the section is a solid rectangle
`I = b h³ / 12`, then the deflection equals `sag`, and the width `b` cancels.
DOES NOT SHOW: that Euler-Bernoulli theory applies. It is a small-deflection formula; several
proof-of-concept strips sag by more than a tenth of their length, where it only indicates size. -/
theorem sag_from_beam (ρ g L E h b q I δ : ℝ) (hE : 0 < E) (hh : 0 < h) (hb : 0 < b)
    (hq : q = ρ * g * b * h) (hI : I = b * h ^ 3 / 12) (hδ : δ = q * L ^ 4 / (8 * E * I)) :
    δ = sag ρ g L E h := by
  subst hq hI hδ
  unfold sag
  have h1 : (8 * E * (b * h ^ 3 / 12)) ≠ 0 := by positivity
  have h2 : (2 * E * h ^ 2) ≠ 0 := by positivity
  rw [div_eq_div_iff h1 h2]
  ring

/-- SHOWS: for positive `E`, `h`, `δ`, the sag formula stays within the limit `δ` exactly when
`h²` is at least `sagFloorSq`. DOES NOT SHOW anything about a real strip beyond the formula. -/
theorem sag_le_iff (ρ g L E h δ : ℝ) (hE : 0 < E) (hh : 0 < h) (hδ : 0 < δ) :
    sag ρ g L E h ≤ δ ↔ sagFloorSq ρ g L E δ ≤ h ^ 2 := by
  unfold sag sagFloorSq
  have h1 : (0 : ℝ) < 2 * E * h ^ 2 := by positivity
  have h2 : (0 : ℝ) < 2 * E * δ := by positivity
  rw [div_le_iff₀ h1, div_le_iff₀ h2]
  constructor <;> intro H <;> linarith

/-- SHOWS (elimination by length): let `Lc > 0` be the length at which the sag formula exactly
meets the limit, `3 ρ g Lc⁴ = 2 E h² δ`. Then every longer strip of the same material and thickness
has formula sag strictly above `δ`.
DOES NOT SHOW: that a shorter strip is acceptable in practice, or anything for a strip that is
hung vertically or supported at both ends (the formula is for a horizontal cantilever). -/
theorem sag_eliminates_length (ρ g L Lc E h δ : ℝ) (hρ : 0 < ρ) (hg : 0 < g) (hE : 0 < E)
    (hh : 0 < h) (hLc : 0 < Lc) (hthr : 3 * ρ * g * Lc ^ 4 = 2 * E * h ^ 2 * δ) (hL : Lc < L) :
    δ < sag ρ g L E h := by
  have hLpos : 0 < L := lt_trans hLc hL
  have h2 : Lc ^ 2 < L ^ 2 := by nlinarith
  have h4 : Lc ^ 4 < L ^ 4 := by
    nlinarith [mul_pos (sub_pos.mpr h2) (add_pos (pow_pos hLpos 2) (pow_pos hLc 2))]
  have hc : (0 : ℝ) < 3 * ρ * g := by positivity
  have h5 : 3 * ρ * g * Lc ^ 4 < 3 * ρ * g * L ^ 4 := mul_lt_mul_of_pos_left h4 hc
  unfold sag
  have h1 : (0 : ℝ) < 2 * E * h ^ 2 := by positivity
  rw [lt_div_iff₀ h1]
  linarith

/-! ## 2. Diffusion response time -/

/-- Relaxation time of the slowest Fourier mode of Fickian diffusion through a slab of thickness
`h` wetted on both faces: `h² / (π² D)`. A slab wetted on one face is four times slower, so this is
the fastest case. A definition, not a derivation from the diffusion equation. -/
def tau (h D : ℝ) : ℝ := h ^ 2 / (Real.pi ^ 2 * D)

/-- The ceiling on `h²` that a required response time `t` implies: `π² D t`. -/
def speedCeilSq (D t : ℝ) : ℝ := Real.pi ^ 2 * D * t

/-- SHOWS: `tau h D ≤ t` exactly when `h² ≤ π² D t`. -/
theorem tau_le_iff (h D t : ℝ) (hD : 0 < D) :
    tau h D ≤ t ↔ h ^ 2 ≤ speedCeilSq D t := by
  unfold tau speedCeilSq
  have hp : (0 : ℝ) < Real.pi ^ 2 * D := mul_pos (pow_pos Real.pi_pos 2) hD
  rw [div_le_iff₀ hp]
  constructor <;> intro H <;> linarith

/-- SHOWS (elimination by speed): if `h²` exceeds `π² D t_req`, the required time is strictly
shorter than the slowest-mode time `tau`.
DOES NOT SHOW that the layer has finished responding at time `tau`; `tau` is one e-folding of the
slowest mode, so real settling (to within 10 %) takes several times longer. It is a lower bound
only under the named physical assumption that the response cannot beat its slowest mode. -/
theorem speed_eliminates (h D t_req : ℝ) (hD : 0 < D)
    (hbig : speedCeilSq D t_req < h ^ 2) : t_req < tau h D := by
  unfold tau
  unfold speedCeilSq at hbig
  have hp : (0 : ℝ) < Real.pi ^ 2 * D := mul_pos (pow_pos Real.pi_pos 2) hD
  rw [lt_div_iff₀ hp]
  linarith

/-- SHOWS: at any time `t` earlier than `tau`, the slowest mode's remaining fraction
`exp (-(t / tau))` is still above `exp (-1)` (about 37 %). This is the precise sense in which the
layer "cannot respond faster": more than a third of the slowest mode is still to come.
DOES NOT SHOW that the moisture profile is a single mode, nor that curvature follows it. -/
theorem slowest_mode_unfinished (h D t : ℝ) (hh : 0 < h) (hD : 0 < D) (ht : t < tau h D) :
    Real.exp (-1) < Real.exp (-(t / tau h D)) := by
  have hp : (0 : ℝ) < Real.pi ^ 2 * D := mul_pos (pow_pos Real.pi_pos 2) hD
  have htau : 0 < tau h D := by unfold tau; exact div_pos (pow_pos hh 2) hp
  have hlt : t / tau h D < 1 := (div_lt_one htau).mpr ht
  apply Real.exp_lt_exp.mpr
  linarith

/-- SHOWS: doubling the thickness multiplies `tau` by four (the `h²` law). -/
theorem tau_double (h D : ℝ) : tau (2 * h) D = 4 * tau h D := by
  unfold tau
  ring

/-- SHOWS: if only a fraction `φ` of the strip thickness is the swelling layer, its slowest-mode
time equals that of the whole thickness with diffusivity `D / φ²`. This lets the single-thickness
window below be used for a bilayer by passing the effective diffusivity `D / φ²`. -/
theorem tau_active_fraction (h D φ : ℝ) (hD : 0 < D) (hφ : 0 < φ) :
    tau (φ * h) D = tau h (D / φ ^ 2) := by
  unfold tau
  have hpi : Real.pi ≠ 0 := Real.pi_pos.ne'
  have hD' : D ≠ 0 := hD.ne'
  have hφ' : φ ≠ 0 := hφ.ne'
  rw [mul_pow, show Real.pi ^ 2 * (D / φ ^ 2) = Real.pi ^ 2 * D / φ ^ 2 by ring, div_div_eq_mul_div]
  ring

/-! ## 3. Rotation ceiling (Timoshenko bilayer) -/

/-- Copied unchanged from `lean/ThompsonLaws/Hygromorphs.lean`. -/
def timoshenkoCoefficient (h m n : ℝ) : ℝ :=
  (1 / h) * (6 * (1 + m) ^ 2) / (3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)))

/-- Copied unchanged from `lean/ThompsonLaws/Hygromorphs.lean`. -/
def bilayerCurvature (h m n Δε : ℝ) : ℝ := timoshenkoCoefficient h m n * Δε

/-- Copied from `tracks/lean/HygromorphCeilingCheck.lean` (already kernel-checked there). -/
theorem amgm_step (m n : ℝ) (hm : 0 < m) (hn : 0 < n) :
    2 * m ≤ m ^ 3 * n + 1 / (m * n) := by
  have hmn : 0 < m * n := mul_pos hm hn
  have ha : 0 < m ^ 3 * n := mul_pos (pow_pos hm 3) hn
  have hb : 0 < 1 / (m * n) := one_div_pos.mpr hmn
  have hprod : m ^ 3 * n * (1 / (m * n)) = m ^ 2 := by field_simp
  by_contra hcon
  rw [not_le] at hcon
  have hpos : 0 < m ^ 3 * n + 1 / (m * n) := add_pos ha hb
  have h1 : 0 < 2 * m - (m ^ 3 * n + 1 / (m * n)) := by linarith
  have h2 : 0 < 2 * m + (m ^ 3 * n + 1 / (m * n)) := by linarith
  nlinarith [mul_pos h1 h2, sq_nonneg (m ^ 3 * n - 1 / (m * n)), hprod]

/-- Copied from `tracks/lean/HygromorphCeilingCheck.lean`: the Timoshenko coefficient never
exceeds `3 / (2 h)`, for any thickness ratio `m` and modulus ratio `n`. -/
theorem timoshenkoCoefficient_le (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n) :
    timoshenkoCoefficient h m n ≤ 3 / (2 * h) := by
  unfold timoshenkoCoefficient
  have hmn : 0 < m * n := mul_pos hm hn
  have hden : 0 < 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by
    have : 0 < (1 + m) ^ 2 := by positivity
    have : 0 < (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by positivity
    linarith
  have hexp : (1 + m * n) * (m ^ 2 + 1 / (m * n)) = m ^ 2 + 1 / (m * n) + m ^ 3 * n + 1 := by
    field_simp
    ring
  have hge : 4 * (1 + m) ^ 2 ≤ 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by
    rw [hexp]; nlinarith [amgm_step m n hm hn]
  rw [div_le_iff₀ hden]
  calc 1 / h * (6 * (1 + m) ^ 2) = 3 / (2 * h) * (4 * (1 + m) ^ 2) := by ring
    _ ≤ 3 / (2 * h) * (3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n))) :=
        mul_le_mul_of_nonneg_left hge (by positivity)

/-- The ceiling on `h` that a required tip rotation `θ` implies: `3 ε L / (2 θ)`. -/
def rotCeil (ε L θ : ℝ) : ℝ := 3 * ε * L / (2 * θ)

/-- SHOWS: the best-case rotation `(3/2) (ε / h) L` reaches `θ` exactly when `h ≤ 3 ε L / (2 θ)`. -/
theorem rotation_ok_iff (h ε L θ : ℝ) (hh : 0 < h) (hθ : 0 < θ) :
    θ ≤ 3 / 2 * ε / h * L ↔ h ≤ rotCeil ε L θ := by
  unfold rotCeil
  have h2θ : (0 : ℝ) < 2 * θ := by positivity
  rw [show 3 / 2 * ε / h * L = (3 * ε * L / 2) / h by ring, le_div_iff₀ hh, le_div_iff₀ h2θ]
  constructor <;> intro H <;> linarith

/-- SHOWS: the same statement read as a strain requirement: the rotation `θ` is reachable in the
best case exactly when the differential strain is at least `(2/3) θ h / L`. -/
theorem strain_needed_iff (h ε L θ : ℝ) (hh : 0 < h) (hL : 0 < L) :
    θ ≤ 3 / 2 * ε / h * L ↔ 2 / 3 * θ * h / L ≤ ε := by
  rw [show 3 / 2 * ε / h * L = (3 * ε * L / 2) / h by ring, le_div_iff₀ hh, div_le_iff₀ hL]
  constructor <;> intro H <;> linarith

/-- SHOWS (elimination by rotation): for a bilayer whose curvature is the Timoshenko value, with
ANY thickness ratio `m` and modulus ratio `n`, tip rotation `κ L` is strictly below the required
`θ` whenever the total thickness exceeds `3 ε L / (2 θ)`. The only physical inputs are the
Timoshenko formula (a definition here) and "rotation = curvature × length" (uniform curvature).
DOES NOT SHOW anything for wide plates, large strains, or strips whose curvature is not uniform. -/
theorem rotation_eliminates (h m n ε L θ : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hε : 0 < ε) (hL : 0 < L) (hθ : 0 < θ) (hbig : rotCeil ε L θ < h) :
    bilayerCurvature h m n ε * L < θ := by
  have hle : timoshenkoCoefficient h m n ≤ 3 / (2 * h) := timoshenkoCoefficient_le h m n hh hm hn
  have h1 : bilayerCurvature h m n ε * L ≤ 3 / (2 * h) * ε * L := by
    unfold bilayerCurvature
    exact mul_le_mul_of_nonneg_right (mul_le_mul_of_nonneg_right hle hε.le) hL.le
  have h2θ : (0 : ℝ) < 2 * θ := by positivity
  have h2h : (0 : ℝ) < 2 * h := by positivity
  unfold rotCeil at hbig
  rw [div_lt_iff₀ h2θ] at hbig
  have h2 : 3 / (2 * h) * ε * L < θ := by
    rw [show 3 / (2 * h) * ε * L = (3 * ε * L) / (2 * h) by ring, div_lt_iff₀ h2h]
    linarith
  linarith

/-! ## 4. The three constraints pin `h` into an interval -/

/-- A thickness `h` passes all three formula tests: sag within `δ`, slowest-mode time within `t`,
best-case rotation at least `θ`. -/
def Feasible (ρ g L E δ D t ε θ h : ℝ) : Prop :=
  sag ρ g L E h ≤ δ ∧ tau h D ≤ t ∧ θ ≤ 3 / 2 * ε / h * L

theorem sqrt_le_iff_le_sq (a h : ℝ) (ha : 0 ≤ a) (hh : 0 < h) :
    Real.sqrt a ≤ h ↔ a ≤ h ^ 2 := by
  have hs : 0 ≤ Real.sqrt a := Real.sqrt_nonneg a
  have hsq : Real.sqrt a ^ 2 = a := Real.sq_sqrt ha
  constructor
  · intro H
    have : Real.sqrt a ^ 2 ≤ h ^ 2 := by
      nlinarith [mul_nonneg hs (sub_nonneg.mpr H), sq_nonneg (h - Real.sqrt a)]
    linarith
  · intro H
    by_contra hc
    rw [not_le] at hc
    have : h ^ 2 < Real.sqrt a ^ 2 := by
      nlinarith [mul_pos hh (sub_pos.mpr hc), sq_nonneg (Real.sqrt a - h)]
    linarith

theorem le_sqrt_iff_sq_le (b h : ℝ) (hb : 0 ≤ b) (hh : 0 < h) :
    h ≤ Real.sqrt b ↔ h ^ 2 ≤ b := by
  have hs : 0 ≤ Real.sqrt b := Real.sqrt_nonneg b
  have hsq : Real.sqrt b ^ 2 = b := Real.sq_sqrt hb
  constructor
  · intro H
    have : h ^ 2 ≤ Real.sqrt b ^ 2 := by
      nlinarith [mul_nonneg hh.le (sub_nonneg.mpr H), sq_nonneg (Real.sqrt b - h)]
    linarith
  · intro H
    by_contra hc
    rw [not_le] at hc
    have : Real.sqrt b ^ 2 < h ^ 2 := by
      nlinarith [mul_nonneg hs (sub_pos.mpr hc).le, pow_pos (sub_pos.mpr hc) 2]
    linarith

/-- SHOWS: with all quantities positive, `h` passes the three formula tests exactly when
`sagFloorSq ≤ h²`, `h² ≤ speedCeilSq` and `h ≤ rotCeil`. -/
theorem feasible_iff_window_sq (ρ g L E δ D t ε θ h : ℝ) (hE : 0 < E) (hδ : 0 < δ) (hD : 0 < D)
    (hθ : 0 < θ) (hh : 0 < h) :
    Feasible ρ g L E δ D t ε θ h ↔
      sagFloorSq ρ g L E δ ≤ h ^ 2 ∧ h ^ 2 ≤ speedCeilSq D t ∧ h ≤ rotCeil ε L θ := by
  unfold Feasible
  rw [sag_le_iff ρ g L E h δ hE hh hδ, tau_le_iff h D t hD, rotation_ok_iff h ε L θ hh hθ]

/-- SHOWS (the interval): with all quantities positive, the thicknesses that pass the three formula
tests are exactly those in
`[ sqrt (3 ρ g L⁴ / (2 E δ)) ,  min (π sqrt (D t)) (3 ε L / (2 θ)) ]`
(the speed ceiling is written `sqrt (π² D t)`). Sag gives the lower end; speed and rotation give
the upper end.
DOES NOT SHOW that a thickness inside the interval works in reality: the three tests are necessary
conditions built from best-case formulas (two-face wetting, optimal bilayer). -/
theorem feasible_iff_interval (ρ g L E δ D t ε θ h : ℝ) (hρ : 0 < ρ) (hg : 0 < g) (hL : 0 < L)
    (hE : 0 < E) (hδ : 0 < δ) (hD : 0 < D) (ht : 0 < t) (hθ : 0 < θ) (hh : 0 < h) :
    Feasible ρ g L E δ D t ε θ h ↔
      Real.sqrt (sagFloorSq ρ g L E δ) ≤ h ∧ h ≤ Real.sqrt (speedCeilSq D t) ∧
        h ≤ rotCeil ε L θ := by
  have hA : 0 ≤ sagFloorSq ρ g L E δ := by unfold sagFloorSq; positivity
  have hB : 0 ≤ speedCeilSq D t := by
    unfold speedCeilSq
    exact mul_nonneg (mul_nonneg (sq_nonneg _) hD.le) ht.le
  rw [feasible_iff_window_sq ρ g L E δ D t ε θ h hE hδ hD hθ hh,
    sqrt_le_iff_le_sq (sagFloorSq ρ g L E δ) h hA hh,
    le_sqrt_iff_sq_le (speedCeilSq D t) h hB hh]

/-- SHOWS (the emptiness condition): with all quantities positive, SOME positive thickness passes
the three formula tests if and only if the sag floor is below both ceilings:
`3 ρ g L⁴ / (2 E δ) ≤ π² D t`  and  `3 ρ g L⁴ / (2 E δ) ≤ (3 ε L / (2 θ))²`.
If either fails, the design brief is eliminated for every thickness.
DOES NOT SHOW that a brief which passes can be built. -/
theorem feasible_nonempty_iff (ρ g L E δ D t ε θ : ℝ) (hρ : 0 < ρ) (hg : 0 < g) (hL : 0 < L)
    (hE : 0 < E) (hδ : 0 < δ) (hD : 0 < D) (hε : 0 < ε) (hθ : 0 < θ) :
    (∃ h : ℝ, 0 < h ∧ Feasible ρ g L E δ D t ε θ h) ↔
      sagFloorSq ρ g L E δ ≤ speedCeilSq D t ∧ sagFloorSq ρ g L E δ ≤ rotCeil ε L θ ^ 2 := by
  have hApos : 0 < sagFloorSq ρ g L E δ := by unfold sagFloorSq; positivity
  have hCpos : 0 < rotCeil ε L θ := by unfold rotCeil; positivity
  constructor
  · rintro ⟨h, hh, H⟩
    rw [feasible_iff_window_sq ρ g L E δ D t ε θ h hE hδ hD hθ hh] at H
    obtain ⟨H1, H2, H3⟩ := H
    refine ⟨le_trans H1 H2, ?_⟩
    have : h ^ 2 ≤ rotCeil ε L θ ^ 2 := by
      nlinarith [mul_nonneg hh.le (sub_nonneg.mpr H3), sq_nonneg (rotCeil ε L θ - h)]
    linarith
  · rintro ⟨H1, H2⟩
    have hs : 0 < Real.sqrt (sagFloorSq ρ g L E δ) := Real.sqrt_pos.mpr hApos
    have hsq : Real.sqrt (sagFloorSq ρ g L E δ) ^ 2 = sagFloorSq ρ g L E δ :=
      Real.sq_sqrt hApos.le
    refine ⟨Real.sqrt (sagFloorSq ρ g L E δ), hs, ?_⟩
    rw [feasible_iff_window_sq ρ g L E δ D t ε θ _ hE hδ hD hθ hs]
    refine ⟨le_of_eq hsq.symm, by rw [hsq]; exact H1, ?_⟩
    by_contra hc
    rw [not_le] at hc
    have : rotCeil ε L θ ^ 2 < Real.sqrt (sagFloorSq ρ g L E δ) ^ 2 := by
      nlinarith [mul_pos hCpos (sub_pos.mpr hc),
        sq_nonneg (Real.sqrt (sagFloorSq ρ g L E δ) - rotCeil ε L θ)]
    linarith

/-- SHOWS (elimination, sag against speed): if the sag floor on `h²` is above the speed ceiling,
no positive thickness passes. -/
theorem eliminated_sag_vs_speed (ρ g L E δ D t ε θ : ℝ) (hρ : 0 < ρ) (hg : 0 < g) (hL : 0 < L)
    (hE : 0 < E) (hδ : 0 < δ) (hD : 0 < D) (hε : 0 < ε) (hθ : 0 < θ)
    (hgap : speedCeilSq D t < sagFloorSq ρ g L E δ) :
    ¬ ∃ h : ℝ, 0 < h ∧ Feasible ρ g L E δ D t ε θ h := by
  intro hex
  have := ((feasible_nonempty_iff ρ g L E δ D t ε θ hρ hg hL hE hδ hD hε hθ).mp hex).1
  linarith

/-- SHOWS (elimination, sag against rotation): if the sag floor on `h²` is above the square of the
rotation ceiling, no positive thickness passes. -/
theorem eliminated_sag_vs_rotation (ρ g L E δ D t ε θ : ℝ) (hρ : 0 < ρ) (hg : 0 < g)
    (hL : 0 < L) (hE : 0 < E) (hδ : 0 < δ) (hD : 0 < D) (hε : 0 < ε) (hθ : 0 < θ)
    (hgap : rotCeil ε L θ ^ 2 < sagFloorSq ρ g L E δ) :
    ¬ ∃ h : ℝ, 0 < h ∧ Feasible ρ g L E δ D t ε θ h := by
  intro hex
  have := ((feasible_nonempty_iff ρ g L E δ D t ε θ hρ hg hL hE hδ hD hε hθ).mp hex).2
  linarith

/-- SHOWS (a length cap that no thickness escapes): if a strip of ANY positive thickness `h` both
keeps its formula sag within `δ` and reaches best-case rotation `θ`, then
`2 ρ g θ² L² ≤ 3 E δ ε²`, i.e. `L ≤ sqrt (3 E δ ε² / (2 ρ g θ²))`. Thickness has cancelled:
thinner turns further but droops more, in exactly compensating proportion.
DOES NOT SHOW anything for a strip that is not a horizontal cantilever in the fluid whose
buoyancy-corrected density is `ρ`. -/
theorem length_cap_from_sag_and_rotation (ρ g L E δ ε θ h : ℝ) (hρ : 0 < ρ) (hg : 0 < g)
    (hL : 0 < L) (hE : 0 < E) (hδ : 0 < δ) (hθ : 0 < θ) (hh : 0 < h)
    (hsag : sag ρ g L E h ≤ δ) (hrot : θ ≤ 3 / 2 * ε / h * L) :
    2 * ρ * g * θ ^ 2 * L ^ 2 ≤ 3 * E * δ * ε ^ 2 := by
  have h1 : (0 : ℝ) < 2 * E * h ^ 2 := by positivity
  have h2θ : (0 : ℝ) < 2 * θ := by positivity
  unfold sag at hsag
  rw [div_le_iff₀ h1] at hsag
  have hR := (rotation_ok_iff h ε L θ hh hθ).mp hrot
  unfold rotCeil at hR
  rw [le_div_iff₀ h2θ] at hR
  have hR0 : (0 : ℝ) ≤ h * (2 * θ) := by positivity
  have hR2 : h * (2 * θ) * (h * (2 * θ)) ≤ 3 * ε * L * (3 * ε * L) :=
    mul_self_le_mul_self hR0 hR
  have hθ2 : (0 : ℝ) ≤ 4 * θ ^ 2 := by positivity
  have hS : 3 * ρ * g * L ^ 4 * (4 * θ ^ 2) ≤ δ * (2 * E * h ^ 2) * (4 * θ ^ 2) :=
    mul_le_mul_of_nonneg_right hsag hθ2
  have hEδ : (0 : ℝ) ≤ 2 * E * δ := by positivity
  have hT : 2 * E * δ * (h * (2 * θ) * (h * (2 * θ))) ≤ 2 * E * δ * (3 * ε * L * (3 * ε * L)) :=
    mul_le_mul_of_nonneg_left hR2 hEδ
  have hk : 6 * L ^ 2 * (2 * ρ * g * θ ^ 2 * L ^ 2) ≤ 6 * L ^ 2 * (3 * E * δ * ε ^ 2) := by
    nlinarith [hS, hT]
  have h6 : (0 : ℝ) < 6 * L ^ 2 := by positivity
  exact le_of_mul_le_mul_left hk h6

end

end ThompsonLaws.PrintStructure

/-! Axiom audit. Each line must print only the three standard axioms and never `sorryAx`. -/
#print axioms ThompsonLaws.PrintStructure.sag_from_beam
#print axioms ThompsonLaws.PrintStructure.sag_le_iff
#print axioms ThompsonLaws.PrintStructure.sag_eliminates_length
#print axioms ThompsonLaws.PrintStructure.tau_le_iff
#print axioms ThompsonLaws.PrintStructure.speed_eliminates
#print axioms ThompsonLaws.PrintStructure.slowest_mode_unfinished
#print axioms ThompsonLaws.PrintStructure.tau_double
#print axioms ThompsonLaws.PrintStructure.tau_active_fraction
#print axioms ThompsonLaws.PrintStructure.amgm_step
#print axioms ThompsonLaws.PrintStructure.timoshenkoCoefficient_le
#print axioms ThompsonLaws.PrintStructure.rotation_ok_iff
#print axioms ThompsonLaws.PrintStructure.strain_needed_iff
#print axioms ThompsonLaws.PrintStructure.rotation_eliminates
#print axioms ThompsonLaws.PrintStructure.sqrt_le_iff_le_sq
#print axioms ThompsonLaws.PrintStructure.le_sqrt_iff_sq_le
#print axioms ThompsonLaws.PrintStructure.feasible_iff_window_sq
#print axioms ThompsonLaws.PrintStructure.feasible_iff_interval
#print axioms ThompsonLaws.PrintStructure.feasible_nonempty_iff
#print axioms ThompsonLaws.PrintStructure.eliminated_sag_vs_speed
#print axioms ThompsonLaws.PrintStructure.eliminated_sag_vs_rotation
#print axioms ThompsonLaws.PrintStructure.length_cap_from_sag_and_rotation
