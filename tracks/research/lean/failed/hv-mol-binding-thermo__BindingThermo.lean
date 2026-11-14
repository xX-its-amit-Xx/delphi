import Mathlib

/-!
Binding thermodynamics: small exact statements. Assumptions are named hypotheses.
Single-site, equilibrium, ideal-solution (activities = concentrations) throughout.
-/

namespace BindingThermo

/-- Langmuir / hyperbolic occupancy is a fraction in [0,1). -/
theorem occupancy_bounds (L Kd : ℝ) (hKd : 0 < Kd) (hL : 0 ≤ L) :
    0 ≤ L / (Kd + L) ∧ L / (Kd + L) < 1 := by
  have hpos : 0 < Kd + L := by linarith
  refine ⟨div_nonneg hL hpos.le, ?_⟩
  rw [div_lt_one hpos]
  linarith

/-- At ligand concentration equal to Kd, exactly half the sites are occupied. -/
theorem half_occupancy_at_Kd (Kd : ℝ) (hKd : 0 < Kd) : Kd / (Kd + Kd) = 1 / 2 := by
  have h : Kd ≠ 0 := ne_of_gt hKd
  field_simp
  first | ring | norm_num

/-- Kd-to-free-energy sign law: with dG = RT * ln Kd (Kd in units of the 1 M
standard state), any Kd below the standard state gives a negative dG. -/
theorem dG_neg_of_Kd_lt_one (RT Kd : ℝ) (hRT : 0 < RT) (hK0 : 0 < Kd) (hK1 : Kd < 1) :
    RT * Real.log Kd < 0 :=
  mul_neg_of_pos_of_neg hRT (Real.log_neg hK0 hK1)

/-- Tighter binder has more negative dG (monotonicity of dG = RT ln Kd). -/
theorem dG_mono (RT Ka Kb : ℝ) (hRT : 0 < RT) (ha : 0 < Ka) (hab : Ka < Kb) :
    RT * Real.log Ka < RT * Real.log Kb :=
  mul_lt_mul_of_pos_left (Real.log_lt_log ha hab) hRT

/-- Cheng-Prusoff bound: Ki = IC50 / (1 + S/Km) never exceeds IC50. -/
theorem cheng_prusoff_le (IC50 S Km : ℝ) (hIC : 0 < IC50) (hS : 0 ≤ S) (hKm : 0 < Km) :
    IC50 / (1 + S / Km) ≤ IC50 := by
  have h : 0 ≤ S / Km := div_nonneg hS hKm.le
  exact div_le_self hIC.le (by linarith)

/-- Cheng-Prusoff (binding form): under competitive single-site binding, the
inhibitor concentration I = Ki * (1 + L/Kd) halves the labelled-ligand occupancy. -/
theorem cheng_prusoff_binding (L Kd I Ki : ℝ) (hL : 0 < L) (hKd : 0 < Kd) (hKi : 0 < Ki)
    (hI : I = Ki * (1 + L / Kd)) :
    L / (L + Kd * (1 + I / Ki)) = (1 / 2) * (L / (L + Kd)) := by
  subst hI
  have hKd' : Kd ≠ 0 := ne_of_gt hKd
  have hKi' : Ki ≠ 0 := ne_of_gt hKi
  have hsum : L + Kd ≠ 0 := ne_of_gt (by linarith)
  have h1 : Kd * (1 + Ki * (1 + L / Kd) / Ki) = 2 * Kd + L := by
    field_simp
    first | ring | norm_num
  rw [h1]
  have h2 : L + (2 * Kd + L) = 2 * (L + Kd) := by ring
  rw [h2]
  first | ring | (field_simp; ring) | field_simp

/-- Detailed balance on a thermodynamic cycle: if the free energies along the two
paths agree (state function), the equilibrium constants K = exp(-dG/RT) multiply
to the same product along both paths. -/
theorem cycle_closure (RT g1 g2 g3 g4 : ℝ) (h : g1 + g2 = g3 + g4) :
    Real.exp (-g1 / RT) * Real.exp (-g2 / RT) = Real.exp (-g3 / RT) * Real.exp (-g4 / RT) := by
  rw [← Real.exp_add, ← Real.exp_add]
  have e1 : -g1 / RT + -g2 / RT = -(g1 + g2) / RT := by ring
  have e2 : -g3 / RT + -g4 / RT = -(g3 + g4) / RT := by ring
  rw [e1, e2, h]

/-- Enthalpy-entropy compensation identity: at fixed dG = dH - T dS, any change
in dH is matched exactly by the change in T dS. -/
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
#print axioms BindingThermo.cycle_closure
#print axioms BindingThermo.compensation_exact
