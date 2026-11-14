import Mathlib

/-!
Binding thermodynamics: small exact statements. Assumptions are named hypotheses.
Single-site, equilibrium, ideal-solution (activities = concentrations) throughout.

Repaired copy of `tracks/research/lean/failed/hv-mol-binding-thermo__BindingThermo.lean`.
The statement of `cheng_prusoff_binding` is TRUE as written and is unchanged; only its proof
was repaired. One converse theorem (`cheng_prusoff_binding_unique`) was added.

None of these theorems says that a real molecule obeys the single-site model. Each one is
algebra or calculus about the model's formula; whether the model fits is an empirical question.
-/

namespace BindingThermo

/-- Langmuir / hyperbolic occupancy `L / (Kd + L)` is a fraction in [0,1).
SHOWS: for the single-site formula with `Kd > 0` and free ligand `L ≥ 0`, occupancy is never
negative and never reaches 1 at any finite concentration.
DOES NOT SHOW: that a real receptor follows this formula (no cooperativity, no ligand
depletion, no second site are assumed, not proved). `L` is FREE ligand, not total added. -/
theorem occupancy_bounds (L Kd : ℝ) (hKd : 0 < Kd) (hL : 0 ≤ L) :
    0 ≤ L / (Kd + L) ∧ L / (Kd + L) < 1 := by
  have hpos : 0 < Kd + L := by linarith
  refine ⟨div_nonneg hL hpos.le, ?_⟩
  rw [div_lt_one hpos]
  linarith

/-- At free ligand concentration equal to `Kd`, the single-site formula gives exactly 1/2.
SHOWS: the algebraic identity `Kd / (Kd + Kd) = 1/2` for `Kd > 0`.
DOES NOT SHOW: that the concentration giving half-maximal signal in an experiment equals `Kd`
(that needs signal proportional to occupancy and free = total ligand). -/
theorem half_occupancy_at_Kd (Kd : ℝ) (hKd : 0 < Kd) : Kd / (Kd + Kd) = 1 / 2 := by
  have h : Kd ≠ 0 := ne_of_gt hKd
  rw [div_eq_iff (by linarith : Kd + Kd ≠ 0)]
  ring

/-- Sign law for `dG = RT * ln Kd` (with `Kd` as a pure number, i.e. divided by the 1 M
standard state).
SHOWS: if `RT > 0` and `0 < Kd < 1` then `RT * ln Kd < 0`.
DOES NOT SHOW: that `dG = RT ln Kd` holds (that relation is the definition being assumed), nor
anything about a different standard state; the sign depends on the 1 M convention. -/
theorem dG_neg_of_Kd_lt_one (RT Kd : ℝ) (hRT : 0 < RT) (hK0 : 0 < Kd) (hK1 : Kd < 1) :
    RT * Real.log Kd < 0 :=
  mul_neg_of_pos_of_neg hRT (Real.log_neg hK0 hK1)

/-- Monotonicity of `dG = RT ln Kd`.
SHOWS: at the same `RT > 0`, a strictly smaller dissociation constant gives a strictly more
negative `RT * ln Kd`.
DOES NOT SHOW: anything about comparing two measurements made at different temperatures, or
about kinetics (on/off rates). -/
theorem dG_mono (RT Ka Kb : ℝ) (hRT : 0 < RT) (ha : 0 < Ka) (hab : Ka < Kb) :
    RT * Real.log Ka < RT * Real.log Kb :=
  mul_lt_mul_of_pos_left (Real.log_lt_log ha hab) hRT

/-- Cheng-Prusoff bound.
SHOWS: the number `IC50 / (1 + S/Km)` is never larger than `IC50` when `IC50 > 0`, `S ≥ 0`,
`Km > 0`.
DOES NOT SHOW: that this number is the true inhibition constant `Ki`; that identification
holds only for competitive inhibition and is an assumption outside this theorem. -/
theorem cheng_prusoff_le (IC50 S Km : ℝ) (hIC : 0 < IC50) (hS : 0 ≤ S) (hKm : 0 < Km) :
    IC50 / (1 + S / Km) ≤ IC50 := by
  have h : 0 ≤ S / Km := div_nonneg hS hKm.le
  exact div_le_self hIC.le (by linarith)

/-- Cheng-Prusoff (binding form), forward direction.
MODEL (assumed, built into the formula): competitive single-site binding, where labelled-ligand
occupancy with free inhibitor `I` is `L / (L + Kd * (1 + I/Ki))`, and without inhibitor is
`L / (L + Kd)`.
SHOWS: at the inhibitor concentration `I = Ki * (1 + L/Kd)` the occupancy is exactly half of
the uninhibited occupancy. So in this model `IC50 = Ki * (1 + L/Kd)`.
DOES NOT SHOW: that the competitive model applies to a given pair of molecules; nothing about
non-competitive or allosteric inhibitors; `L` and `I` are FREE concentrations (no depletion). -/
theorem cheng_prusoff_binding (L Kd I Ki : ℝ) (hL : 0 < L) (hKd : 0 < Kd) (hKi : 0 < Ki)
    (hI : I = Ki * (1 + L / Kd)) :
    L / (L + Kd * (1 + I / Ki)) = (1 / 2) * (L / (L + Kd)) := by
  subst hI
  have hKd' : Kd ≠ 0 := ne_of_gt hKd
  have hKi' : Ki ≠ 0 := ne_of_gt hKi
  have hsum : L + Kd ≠ 0 := ne_of_gt (by linarith)
  have e1 : Ki * (1 + L / Kd) / Ki = 1 + L / Kd := mul_div_cancel_left₀ _ hKi'
  have e2 : Kd * (L / Kd) = L := by
    rw [mul_div_assoc']
    exact mul_div_cancel_left₀ _ hKd'
  have hden : L + Kd * (1 + Ki * (1 + L / Kd) / Ki) = 2 * (L + Kd) := by
    rw [e1]
    linear_combination e2
  rw [hden]
  have h2 : (2 : ℝ) * (L + Kd) ≠ 0 := mul_ne_zero two_ne_zero hsum
  have e3 : L / (L + Kd) * (L + Kd) = L := div_mul_cancel₀ _ hsum
  rw [div_eq_iff h2]
  linear_combination (-1 : ℝ) * e3

/-- Cheng-Prusoff (binding form), converse: the halving concentration is unique.
SHOWS: in the same competitive single-site formula, if a non-negative inhibitor concentration
`I` halves the labelled-ligand occupancy, then `I = Ki * (1 + L/Kd)`. Together with
`cheng_prusoff_binding` this makes `IC50 = Ki * (1 + L/Kd)` an if-and-only-if in the model.
DOES NOT SHOW: that the model applies; same limits as `cheng_prusoff_binding`. -/
theorem cheng_prusoff_binding_unique (L Kd I Ki : ℝ) (hL : 0 < L) (hKd : 0 < Kd)
    (hKi : 0 < Ki) (hI0 : 0 ≤ I)
    (h : L / (L + Kd * (1 + I / Ki)) = (1 / 2) * (L / (L + Kd))) :
    I = Ki * (1 + L / Kd) := by
  have hKd' : Kd ≠ 0 := ne_of_gt hKd
  have hKi' : Ki ≠ 0 := ne_of_gt hKi
  have hsum : L + Kd ≠ 0 := ne_of_gt (by linarith)
  have hq : 0 < 1 + I / Ki := by
    have := div_nonneg hI0 hKi.le
    linarith
  have hA : 0 < L + Kd * (1 + I / Ki) := by
    have := mul_pos hKd hq
    linarith
  have e2 : Kd * (L / Kd) = L := by
    rw [mul_div_assoc']
    exact mul_div_cancel_left₀ _ hKd'
  have e3 : L / (L + Kd) * (L + Kd) = L := div_mul_cancel₀ _ hsum
  have e4 : Ki * (I / Ki) = I := by
    rw [mul_div_assoc']
    exact mul_div_cancel_left₀ _ hKi'
  have h0 : L = 1 / 2 * (L / (L + Kd)) * (L + Kd * (1 + I / Ki)) := by
    rwa [div_eq_iff hA.ne'] at h
  have h' : L * (2 * (L + Kd)) = L * (L + Kd * (1 + I / Ki)) := by
    linear_combination (2 * (L + Kd)) * h0 + (L + Kd * (1 + I / Ki)) * e3
  have hA2 : 2 * (L + Kd) = L + Kd * (1 + I / Ki) := mul_left_cancel₀ hL.ne' h'
  have h5 : Kd * (I / Ki) = Kd * (1 + L / Kd) := by
    linear_combination (-1 : ℝ) * hA2 - e2
  have h6 : I / Ki = 1 + L / Kd := mul_left_cancel₀ hKd' h5
  calc I = Ki * (I / Ki) := e4.symm
    _ = Ki * (1 + L / Kd) := by rw [h6]

/-- Thermodynamic cycle closure.
SHOWS: if the free-energy sums along two paths are equal (`g1 + g2 = g3 + g4`), then the
products of the Boltzmann factors `exp(-g/RT)` along the two paths are equal.
DOES NOT SHOW: that free energy is a state function (that is the hypothesis `h`), and it is
not a statement about rates or detailed balance of kinetics. Holds for any real `RT`, including
the unphysical `RT = 0` where Lean's division returns 0. -/
theorem cycle_closure (RT g1 g2 g3 g4 : ℝ) (h : g1 + g2 = g3 + g4) :
    Real.exp (-g1 / RT) * Real.exp (-g2 / RT) = Real.exp (-g3 / RT) * Real.exp (-g4 / RT) := by
  rw [← Real.exp_add, ← Real.exp_add]
  have e1 : -g1 / RT + -g2 / RT = -(g1 + g2) / RT := by ring
  have e2 : -g3 / RT + -g4 / RT = -(g3 + g4) / RT := by ring
  rw [e1, e2, h]

/-- Enthalpy-entropy compensation identity.
SHOWS: if two states have the same `dG = dH - T dS`, the difference in `dH` equals the
difference in `T dS`. This is bookkeeping.
DOES NOT SHOW: that compensation happens in nature (that `dG` stays fixed across a ligand
series is the hypothesis), so it gives no support to compensation as a physical effect. -/
theorem compensation_exact (dH1 dH2 TdS1 TdS2 : ℝ)
    (hG : dH1 - TdS1 = dH2 - TdS2) : dH2 - dH1 = TdS2 - TdS1 := by
  linarith

end BindingThermo

#print axioms BindingThermo.occupancy_bounds
#print axioms BindingThermo.half_occupancy_at_Kd
#print axioms BindingThermo.dG_neg_of_Kd_lt_one
#print axioms BindingThermo.dG_mono
#print axioms BindingThermo.cheng_prusoff_le
#print axioms BindingThermo.cheng_prusoff_binding
#print axioms BindingThermo.cheng_prusoff_binding_unique
#print axioms BindingThermo.cycle_closure
#print axioms BindingThermo.compensation_exact
