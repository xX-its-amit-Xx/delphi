/-
Crosslinker laws for printable bio-based networks (agent lb-crosslinker-laws, DELPHI sprint 2026-11-13).
Checked with:  bash tracks/lean/check.sh <this file>
-/
import Mathlib

/-!
# Crosslink density as a design variable: stiffness, swelling, and an elimination certificate

The "linker" of a printable biomaterial (genipin, citric acid, tannin or an enzyme joining chitosan,
cellulose, alginate or protein chains) sets one number, the density `ν` of elastically active
network strands. This file proves what follows from three textbook models once they are ASSUMED:

* affine rubber elasticity          `G = ν kT`, `E = 3 G` (incompressible);
* the high-swelling Flory-Rehner balance  `ν V₁ s⁵ = 1/2 - χ`, where `s` is the LINEAR swelling
  stretch (`s = Q^(1/3)`, so `s⁵ = Q^(5/3)` and the balance is the usual `Q ∝ ν^(-3/5)`);
* Timoshenko's bilayer curvature     `κ = f(m,n) Δε / h`.

Nothing here says a real gel obeys these models. Every model is either a definition or a named
hypothesis of the theorem that uses it. `amgm_step` and `timoshenkoCoefficient_le` are re-proved
from `tracks/lean/HygromorphCeilingCheck.lean` (same definitions, same statements).
-/

namespace ThompsonLaws.Crosslinker

noncomputable section

open Real

/-! ## 1. Stiffness -/

/-- Affine rubber-elasticity shear modulus `G = ν kT` (`ν` strands per volume, `kT` thermal energy).
A definition of the model, not a claim about any material. -/
def affineShearModulus (ν kT : ℝ) : ℝ := ν * kT

/-- Young's modulus of an incompressible affine network, `E = 3 G = 3 ν kT`. Definition only. -/
def youngModulus (ν kT : ℝ) : ℝ := 3 * ν * kT

/-- SHOWS: in the affine model `G = ν kT`, at fixed positive `kT`, the shear modulus is strictly
increasing in crosslink density `ν` (for all real `ν`).
DOES NOT SHOW: that a real gel follows the affine model, that added crosslinker turns into
elastically active strands, or anything about entanglements, loops or dangling ends. -/
theorem affineShearModulus_strictMono (kT : ℝ) (hkT : 0 < kT) :
    StrictMono (fun ν : ℝ => affineShearModulus ν kT) := by
  intro a b hab
  show a * kT < b * kT
  exact mul_lt_mul_of_pos_right hab hkT

/-- SHOWS: in the model `E = 3 ν kT` with `kT > 0`, the requirement `E ≥ E_min` is EXACTLY the
requirement `ν ≥ E_min / (3 kT)`; so every density below that computable threshold is eliminated
and none above it is.
DOES NOT SHOW: that blocking force or any other performance number is set by `E` alone. -/
theorem stiffness_requirement_iff (ν kT Emin : ℝ) (hkT : 0 < kT) :
    Emin ≤ youngModulus ν kT ↔ Emin / (3 * kT) ≤ ν := by
  unfold youngModulus
  have e : ν * (3 * kT) = 3 * ν * kT := by ring
  rw [div_le_iff₀ (by positivity : (0 : ℝ) < 3 * kT), e]

/-! ## 2. Swelling -/

/-- The high-swelling limit of the Flory-Rehner balance for a neutral network, written with the
linear stretch `s` (swollen length over dry length): `ν V₁ s⁵ = A`, with `A = 1/2 - χ` and `V₁` the
solvent molar volume (`ν` then in moles of strands per dry volume). A predicate, not a theorem:
theorems below take it as a NAMED HYPOTHESIS. It ignores ionic (Donnan) swelling, which matters
for a charged polymer such as protonated chitosan. -/
def HighSwellingBalance (A V₁ ν s : ℝ) : Prop := ν * V₁ * s ^ 5 = A

/-- Linear swelling strain `ε = s - 1`. Definition. -/
def swellingStrain (s : ℝ) : ℝ := s - 1

/-- SHOWS: if two networks of the same polymer in the same solvent (same `A`, same `V₁ > 0`) both
satisfy the high-swelling balance `ν V₁ s⁵ = A` with positive stretches, then the one with the
strictly larger crosslink density has the strictly smaller linear stretch.
DOES NOT SHOW: that the balance holds (it is hypotheses `h₁`, `h₂`), nor anything outside the
high-swelling neutral-network limit. -/
theorem stretch_strictAnti_of_balance (A V₁ ν₁ ν₂ s₁ s₂ : ℝ) (hV : 0 < V₁) (hν₁ : 0 < ν₁)
    (hs₁ : 0 < s₁) (hs₂ : 0 < s₂)
    (h₁ : HighSwellingBalance A V₁ ν₁ s₁) (h₂ : HighSwellingBalance A V₁ ν₂ s₂)
    (hlt : ν₁ < ν₂) : s₂ < s₁ := by
  unfold HighSwellingBalance at h₁ h₂
  by_contra hcon
  rw [not_lt] at hcon
  have hp : s₁ ^ 5 ≤ s₂ ^ 5 := pow_le_pow_left₀ hs₁.le hcon 5
  have hb : 0 < s₂ ^ 5 := pow_pos hs₂ 5
  have h3 : ν₁ * V₁ * s₁ ^ 5 ≤ ν₁ * V₁ * s₂ ^ 5 :=
    mul_le_mul_of_nonneg_left hp (mul_pos hν₁ hV).le
  have h4 : ν₁ * V₁ * s₂ ^ 5 < ν₂ * V₁ * s₂ ^ 5 :=
    mul_lt_mul_of_pos_right (mul_lt_mul_of_pos_right hlt hV) hb
  linarith

/-- SHOWS: under the same hypotheses as `stretch_strictAnti_of_balance`, the equilibrium linear
swelling STRAIN `ε = s - 1` is strictly smaller at the strictly larger crosslink density.
DOES NOT SHOW: more than that theorem; it is the same statement shifted by one. -/
theorem swellingStrain_strictAnti_of_balance (A V₁ ν₁ ν₂ s₁ s₂ : ℝ) (hV : 0 < V₁) (hν₁ : 0 < ν₁)
    (hs₁ : 0 < s₁) (hs₂ : 0 < s₂)
    (h₁ : HighSwellingBalance A V₁ ν₁ s₁) (h₂ : HighSwellingBalance A V₁ ν₂ s₂)
    (hlt : ν₁ < ν₂) : swellingStrain s₂ < swellingStrain s₁ := by
  have h := stretch_strictAnti_of_balance A V₁ ν₁ ν₂ s₁ s₂ hV hν₁ hs₁ hs₂ h₁ h₂ hlt
  unfold swellingStrain
  linarith

/-! ## 3. The Timoshenko ceiling (re-proved from HygromorphCeilingCheck.lean) -/

/-- Copied unchanged from `tracks/lean/HygromorphCeilingCheck.lean`: Timoshenko's bilayer
coefficient for total thickness `h`, thickness ratio `m`, modulus ratio `n`. -/
def timoshenkoCoefficient (h m n : ℝ) : ℝ :=
  (1 / h) * (6 * (1 + m) ^ 2) / (3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)))

/-- Copied unchanged: curvature of a bilayer with differential strain `Δε`. -/
def bilayerCurvature (h m n Δε : ℝ) : ℝ := timoshenkoCoefficient h m n * Δε

/-- SHOWS: the algebraic inequality `2 m ≤ m³ n + 1/(m n)` for positive reals (AM-GM step).
DOES NOT SHOW: anything physical. -/
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

/-- SHOWS: for positive thickness, thickness ratio and modulus ratio, Timoshenko's coefficient
never exceeds `3 / (2 h)`.
DOES NOT SHOW: that Timoshenko's beam formula applies to a given printed part (thin, linear
elastic, small strain, perfectly bonded layers are assumed by the formula itself). -/
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

/-- SHOWS: Timoshenko's coefficient is strictly positive for positive `h`, `m`, `n`.
DOES NOT SHOW: anything physical beyond the sign of the formula. -/
theorem timoshenkoCoefficient_pos (h m n : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n) :
    0 < timoshenkoCoefficient h m n := by
  unfold timoshenkoCoefficient
  have hmn : 0 < m * n := mul_pos hm hn
  have hnum : 0 < 1 / h * (6 * (1 + m) ^ 2) := by positivity
  have hden : 0 < 3 * (1 + m) ^ 2 + (1 + m * n) * (m ^ 2 + 1 / (m * n)) := by positivity
  exact div_pos hnum hden

/-- SHOWS: if the differential strain `Δε` is strictly below a non-negative number `D`, then for
EVERY positive thickness ratio and modulus ratio the Timoshenko curvature is strictly below
`(3/2) D / h`. (Negative `Δε` is allowed.)
DOES NOT SHOW: that the formula applies to the part; see `timoshenkoCoefficient_le`. -/
theorem curvature_lt_of_strain_lt (h m n Δε D : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)
    (hD : 0 ≤ D) (hlt : Δε < D) :
    bilayerCurvature h m n Δε < 3 / 2 * D / h := by
  have hle := timoshenkoCoefficient_le h m n hh hm hn
  have hpos := timoshenkoCoefficient_pos h m n hh hm hn
  unfold bilayerCurvature
  calc timoshenkoCoefficient h m n * Δε
      < timoshenkoCoefficient h m n * D := mul_lt_mul_of_pos_left hlt hpos
    _ ≤ 3 / (2 * h) * D := mul_le_mul_of_nonneg_right hle hD
    _ = 3 / 2 * D / h := by field_simp

/-! ## 4. The design theorem, for ANY increasing modulus law and decreasing swelling law -/

/-- SHOWS: let the active layer's swelling strain `ε(ν)` be strictly decreasing on `ν > 0`
(named hypothesis `hε`), and let `νc > 0` be a density whose ceiling curvature `(3/2) ε(νc)/h` is
already at or below the target `κ*` (with `ε(νc) ≥ 0`). Then EVERY density above `νc` is
eliminated: no choice of layer thickness ratio `m` or modulus ratio `n` reaches `κ*`.
DOES NOT SHOW: that densities at or below `νc` reach the target (the ceiling is necessary, not
sufficient), nor that `ε` is decreasing for a real material, nor that the passive layer has zero
swelling (here the whole differential strain is taken to be `ε(ν)`; a swelling passive layer only
lowers it). -/
theorem curvature_eliminates_above (ε : ℝ → ℝ) (h κstar νc : ℝ) (hh : 0 < h)
    (hε : StrictAntiOn ε (Set.Ioi 0)) (hνc : 0 < νc) (h0 : 0 ≤ ε νc)
    (hc : 3 / 2 * ε νc / h ≤ κstar) :
    ∀ ν m n : ℝ, νc < ν → 0 < m → 0 < n → bilayerCurvature h m n (ε ν) < κstar := by
  intro ν m n hν hm hn
  have hlt : ε ν < ε νc := hε (Set.mem_Ioi.mpr hνc) (Set.mem_Ioi.mpr (hνc.trans hν)) hν
  have hcur := curvature_lt_of_strain_lt h m n (ε ν) (ε νc) hh hm hn h0 hlt
  linarith

/-- SHOWS: if the modulus `E(ν)` is strictly increasing on `ν > 0` (named hypothesis `hE`) and
`νs` is a density whose modulus is at or below the requirement `E_min`, then every positive
density below `νs` is eliminated: its modulus is strictly below `E_min`.
DOES NOT SHOW: that `E` is increasing for a real material, or that a blocking-force requirement
reduces to a modulus requirement (that reduction is the user's, made outside this file). -/
theorem stiffness_eliminates_below (E : ℝ → ℝ) (Emin νs : ℝ)
    (hE : StrictMonoOn E (Set.Ioi 0)) (hs : E νs ≤ Emin) :
    ∀ ν : ℝ, 0 < ν → ν < νs → E ν < Emin := by
  intro ν hν hlt
  have hmono : E ν < E νs := hE (Set.mem_Ioi.mpr hν) (Set.mem_Ioi.mpr (hν.trans hlt)) hlt
  linarith

/-- THE ELIMINATION CERTIFICATE (model-free form).
SHOWS: assume `E` strictly increasing and `ε` strictly decreasing on `ν > 0`; let `νc` be a
density at which the ceiling curvature is already at or below the target (`(3/2) ε(νc)/h ≤ κ*`,
`ε(νc) ≥ 0`) and `νs` a density at which the modulus is still at or below the requirement
(`E(νs) ≤ E_min`). If the thresholds cross, `νc < νs`, then NO positive crosslink density and no
bilayer geometry `(m, n)` meets both `κ ≥ κ*` and `E ≥ E_min`: the feasible window is empty.
DOES NOT SHOW: that the two monotonicity hypotheses hold for a real material family, that the
thresholds have been measured correctly, or anything about families whose `E` and `ε` are not
functions of one density (two-network gels, gradients, anisotropic fillers escape it). When
`νc ≥ νs` the theorem says nothing: a non-empty window is NOT certified. -/
theorem crosslink_window_empty (E ε : ℝ → ℝ) (h κstar Emin νc νs : ℝ) (hh : 0 < h)
    (hE : StrictMonoOn E (Set.Ioi 0)) (hε : StrictAntiOn ε (Set.Ioi 0))
    (hνc : 0 < νc) (h0 : 0 ≤ ε νc)
    (hc : 3 / 2 * ε νc / h ≤ κstar) (hs : E νs ≤ Emin) (hcross : νc < νs) :
    ¬ ∃ ν m n : ℝ, 0 < ν ∧ 0 < m ∧ 0 < n ∧
        κstar ≤ bilayerCurvature h m n (ε ν) ∧ Emin ≤ E ν := by
  rintro ⟨ν, m, n, hν, hm, hn, hκ, hEν⟩
  by_cases hgt : νc < ν
  · have hcur := curvature_eliminates_above ε h κstar νc hh hε hνc h0 hc ν m n hgt hm hn
    linarith
  · rw [not_lt] at hgt
    have hst := stiffness_eliminates_below E Emin νs hE hs ν hν (lt_of_le_of_lt hgt hcross)
    linarith

/-! ## 5. The same certificate with both thresholds COMPUTED from the two textbook models -/

/-- SHOWS: if a network obeys the high-swelling balance `ν V₁ s⁵ = A` (named hypothesis `hbal`)
and its density is above the computable threshold `ν_c = A / (V₁ (1 + (2/3) κ* h)⁵)`, then its
swelling strain `s - 1` cannot bend ANY bilayer of total thickness `h` to the target curvature
`κ* > 0`, whatever the thickness ratio `m` and modulus ratio `n`.
DOES NOT SHOW: that the balance holds for the material; that densities below `ν_c` succeed; or
anything for charged gels whose swelling is ionic. -/
theorem explicit_curvature_threshold (A V₁ h κstar ν s m n : ℝ) (hV : 0 < V₁) (hh : 0 < h)
    (hκ : 0 < κstar) (hν : 0 < ν) (hm : 0 < m) (hn : 0 < n)
    (hbal : HighSwellingBalance A V₁ ν s)
    (habove : A / (V₁ * (1 + 2 / 3 * κstar * h) ^ 5) < ν) :
    bilayerCurvature h m n (s - 1) < κstar := by
  unfold HighSwellingBalance at hbal
  have hLpos : 0 < 1 + 2 / 3 * κstar * h := by positivity
  have hden : 0 < V₁ * (1 + 2 / 3 * κstar * h) ^ 5 := by positivity
  have h1 : A < ν * (V₁ * (1 + 2 / 3 * κstar * h) ^ 5) := (div_lt_iff₀ hden).mp habove
  have h1' : A < ν * V₁ * (1 + 2 / 3 * κstar * h) ^ 5 := by
    have e : ν * (V₁ * (1 + 2 / 3 * κstar * h) ^ 5) = ν * V₁ * (1 + 2 / 3 * κstar * h) ^ 5 := by
      ring
    rw [e] at h1
    exact h1
  have hsL : s < 1 + 2 / 3 * κstar * h := by
    by_contra hcon
    rw [not_lt] at hcon
    have hp : (1 + 2 / 3 * κstar * h) ^ 5 ≤ s ^ 5 := pow_le_pow_left₀ hLpos.le hcon 5
    have h3 : ν * V₁ * (1 + 2 / 3 * κstar * h) ^ 5 ≤ ν * V₁ * s ^ 5 :=
      mul_le_mul_of_nonneg_left hp (mul_pos hν hV).le
    linarith
  have hD : (0 : ℝ) ≤ 2 / 3 * κstar * h := by positivity
  have hlt : s - 1 < 2 / 3 * κstar * h := by linarith
  have hcur := curvature_lt_of_strain_lt h m n (s - 1) (2 / 3 * κstar * h) hh hm hn hD hlt
  have e : 3 / 2 * (2 / 3 * κstar * h) / h = κstar := by
    have hne : h ≠ 0 := hh.ne'
    rw [div_eq_iff hne]
    ring
  rw [e] at hcur
  exact hcur

/-- THE ELIMINATION CERTIFICATE (computable form).
SHOWS: take the family of networks with `E = 3 ν kT` and high-swelling balance `ν V₁ s⁵ = A`.
If the curvature threshold lies below the stiffness threshold,
`A / (V₁ (1 + (2/3) κ* h)⁵) < E_min / (3 kT)`,
then no member of the family (no density `ν > 0`, no stretch `s > 0` obeying the balance, no
bilayer geometry `m, n > 0`) reaches both curvature `κ*` and modulus `E_min`.
Use molar units (`kT` read as `R T`, `ν` in mol per volume) or molecular units consistently.
DOES NOT SHOW: that a real crosslinked chitosan, cellulose, alginate or protein gel belongs to
this family (affine elasticity and neutral high-swelling Flory-Rehner are both idealisations);
it eliminates the MODEL family for the stated target, nothing else. It also takes the stiffness
that must meet `E_min` to be the dry-reference affine modulus `3 ν kT`, not the swollen modulus. -/
theorem explicit_window_empty (A V₁ kT h κstar Emin : ℝ) (hV : 0 < V₁) (hkT : 0 < kT)
    (hh : 0 < h) (hκ : 0 < κstar)
    (hcross : A / (V₁ * (1 + 2 / 3 * κstar * h) ^ 5) < Emin / (3 * kT)) :
    ¬ ∃ ν s m n : ℝ, 0 < ν ∧ 0 < s ∧ 0 < m ∧ 0 < n ∧ HighSwellingBalance A V₁ ν s ∧
        κstar ≤ bilayerCurvature h m n (s - 1) ∧ Emin ≤ youngModulus ν kT := by
  rintro ⟨ν, s, m, n, hν, _hs, hm, hn, hbal, hκge, hEge⟩
  by_cases habove : A / (V₁ * (1 + 2 / 3 * κstar * h) ^ 5) < ν
  · have hcur := explicit_curvature_threshold A V₁ h κstar ν s m n hV hh hκ hν hm hn hbal habove
    linarith
  · rw [not_lt] at habove
    have h2 : Emin / (3 * kT) ≤ ν := (stiffness_requirement_iff ν kT Emin hkT).mp hEge
    linarith

/-! ## 6. One worked instance: genipin-chitosan film numbers

Numbers (see `worked_example.md`): Kildeeva et al., Polymers 12 (2020) 1086, Table 2, film at
Gp/NH₂ = 0.02 mol/mol: equilibrium swelling 340 wt %, `M_c` = 1015 g/mol, film density about
1.018 g/cm³. Derived by us, not by the paper: `ν = ρ/M_c ≈ 1003 mol/m³`, volume ratio
`Q ≈ 4.46`, linear strain `ε = Q^(1/3) - 1 ≈ 0.646`. SI units: `h` in m, `κ` in 1/m, `E` in Pa,
`kT` read as `R T = 2479 J/mol` (298 K), `ν` in mol/m³. -/

/-- SHOWS: take ANY swelling law `ε(ν)` that is strictly decreasing on `ν > 0` and passes through
the one derived point `ε(1003 mol/m³) = 0.646`, and take `E = 3 ν R T` with `R T = 2479 J/mol`.
Then no crosslink density and no bilayer geometry gives a 1 mm thick bilayer both a curvature of
at least 1000 m⁻¹ (bend radius 1 mm) and an affine modulus of at least 8 MPa.
DOES NOT SHOW: that genipin-chitosan obeys `E = 3 ν R T` (dry films are glassy, GPa-scale, and
the paper reports hydrogen bonds adding to the network) or that its swelling is monotone beyond
the two measured films; that the point 0.646 is exact (it is derived from one table row, no
uncertainty carried); or anything about gentler targets: at 100 m⁻¹ this certificate does NOT
fire. A 1 mm bend radius on a 1 mm part is also outside the thin-beam range of Timoshenko's
formula, so this instance illustrates the arithmetic of the certificate, not a design verdict. -/
theorem genipin_chitosan_instance (ε : ℝ → ℝ) (hε : StrictAntiOn ε (Set.Ioi 0))
    (hmeas : ε 1003 = 0.646) :
    ¬ ∃ ν m n : ℝ, 0 < ν ∧ 0 < m ∧ 0 < n ∧
        1000 ≤ bilayerCurvature (1 / 1000) m n (ε ν) ∧ 8000000 ≤ youngModulus ν 2479 := by
  have hE : StrictMonoOn (fun ν : ℝ => youngModulus ν 2479) (Set.Ioi 0) := by
    intro a _ b _ hab
    show youngModulus a 2479 < youngModulus b 2479
    unfold youngModulus
    linarith
  have h0 : 0 ≤ ε 1003 := by rw [hmeas]; norm_num
  have hc : 3 / 2 * ε 1003 / (1 / 1000) ≤ 1000 := by rw [hmeas]; norm_num
  have hs : youngModulus 1050 2479 ≤ 8000000 := by unfold youngModulus; norm_num
  exact crosslink_window_empty (fun ν : ℝ => youngModulus ν 2479) ε (1 / 1000) 1000 8000000
    1003 1050 (by norm_num) hE hε (by norm_num) h0 hc hs (by norm_num)

end

end ThompsonLaws.Crosslinker

/-! Axiom audit: each line must print only `propext`, `Classical.choice`, `Quot.sound`. -/
#print axioms ThompsonLaws.Crosslinker.affineShearModulus_strictMono
#print axioms ThompsonLaws.Crosslinker.stiffness_requirement_iff
#print axioms ThompsonLaws.Crosslinker.stretch_strictAnti_of_balance
#print axioms ThompsonLaws.Crosslinker.swellingStrain_strictAnti_of_balance
#print axioms ThompsonLaws.Crosslinker.amgm_step
#print axioms ThompsonLaws.Crosslinker.timoshenkoCoefficient_le
#print axioms ThompsonLaws.Crosslinker.timoshenkoCoefficient_pos
#print axioms ThompsonLaws.Crosslinker.curvature_lt_of_strain_lt
#print axioms ThompsonLaws.Crosslinker.curvature_eliminates_above
#print axioms ThompsonLaws.Crosslinker.stiffness_eliminates_below
#print axioms ThompsonLaws.Crosslinker.crosslink_window_empty
#print axioms ThompsonLaws.Crosslinker.explicit_curvature_threshold
#print axioms ThompsonLaws.Crosslinker.explicit_window_empty
#print axioms ThompsonLaws.Crosslinker.genipin_chitosan_instance
