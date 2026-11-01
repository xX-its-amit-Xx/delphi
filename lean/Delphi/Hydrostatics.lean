/-
# Hydrostatic pressure from ρ and g, and Boyle's law for a closed swim bladder (perturb-pressure v2.0.0)

Version 2.0.0 of the registry law `perturb-pressure`. Version 1.0.0 (lean/Delphi/Perturb.lean,
`Delphi.Perturb.closed_bladder_rules_out`, pressure `p0 + k d` with the Studio fixing k = 0.1 atm/m, "1 atm per
10 m") is SUPERSEDED, not deleted: it stays compiled, and law sets 1.1.0 to 1.3.0 still pin it.

Why a new version: the engine's pressure scenario computes real hydrostatics, `P = P0 + ρ g z` with a sourced
water density (sea water 1025 kg/m^3, fresh water 998.2 kg/m^3). With ρ = 1025 that is 0.0992 atm/m, not 0.1,
so a correct Boyle volume `V0 P0 / P(d)` sits 0.5 to 1 percent ABOVE the v1 bound `V0 / (1 + d/10)`, and the
v1 check called every correct fish violated. Here the pressure law is parameterised by the two quantities it
actually depends on.

Named hypotheses (fields of `WaterColumn`, never `axiom`): surface pressure `p0 > 0` (Pa), water density
`rho > 0` (kg/m^3), gravitational acceleration `g > 0` (m/s^2); pressure at depth `d` (m) is `p0 + rho g d`.
Boyle's law itself (`P(d) V(d)` constant: fixed amount of gas, fixed temperature, quasi-static) is the hypothesis
`hboyle`, as in v1. The theorems are v1's, transported through `WaterColumn.toHydrostatic` (k = rho g), so
nothing about Boyle is re-proved and the two versions cannot drift apart.

Instances: `oneAtmPer10m` (rho = 101325 / (10 g), the v1 "1 atm per 10 m" case, k = 10132.5 Pa/m exactly),
`seaWater` (1025 kg/m^3, the engine's nominal sea water) and `freshWater` (998.2 kg/m^3, NIST at 20 C, as the
engine cites). `waterColumn_nonvacuous` is the non-vacuity witness.
-/
import Mathlib
import Delphi.Perturb

namespace Delphi
namespace Hydro

/-- A water column: surface pressure `p0` (Pa), density `rho` (kg/m^3), gravity `g` (m/s^2). -/
structure WaterColumn where
  p0 : ℝ
  rho : ℝ
  g : ℝ
  p0_pos : 0 < p0
  rho_pos : 0 < rho
  g_pos : 0 < g

/-- Absolute pressure at depth `d` (m): `p0 + rho g d` (Pa). -/
def WaterColumn.pressure (W : WaterColumn) (d : ℝ) : ℝ := W.p0 + W.rho * W.g * d

/-- The v1 structure with `k = rho g`. -/
def WaterColumn.toHydrostatic (W : WaterColumn) : Perturb.Hydrostatic :=
  ⟨W.p0, W.rho * W.g, W.p0_pos, mul_pos W.rho_pos W.g_pos⟩

theorem WaterColumn.toHydrostatic_pressure (W : WaterColumn) (d : ℝ) :
    W.toHydrostatic.pressure d = W.pressure d := rfl

theorem WaterColumn.pressure_pos (W : WaterColumn) {d : ℝ} (hd : 0 ≤ d) : 0 < W.pressure d :=
  W.toHydrostatic.pressure_pos hd

/-- **Boyle's law for a closed swim bladder, from ρ and g.** With `P(d) V(d)` constant over depth, the volume at
depth `d` is `V(0) p0 / (p0 + rho g d)`. -/
theorem bladder_volume_eq (W : WaterColumn) {V : ℝ → ℝ} {c : ℝ}
    (hboyle : ∀ d, 0 ≤ d → W.pressure d * V d = c) {d : ℝ} (hd : 0 ≤ d) :
    V d = V 0 * W.p0 / (W.p0 + W.rho * W.g * d) :=
  Perturb.bladder_volume_eq W.toHydrostatic hboyle hd

/-- **A closed bladder shrinks with depth**, at any density and gravity. -/
theorem bladder_volume_anti (W : WaterColumn) {V : ℝ → ℝ} {c : ℝ} (hc : 0 ≤ c)
    (hboyle : ∀ d, 0 ≤ d → W.pressure d * V d = c) {d₁ d₂ : ℝ} (h₁ : 0 ≤ d₁) (h : d₁ ≤ d₂) :
    V d₂ ≤ V d₁ :=
  Perturb.bladder_volume_anti W.toHydrostatic hc hboyle h₁ h

/-- **Gas needed to keep the volume at depth:** `1 + rho g d / p0` times the surface amount. -/
theorem secretion_ratio (W : WaterColumn) {V d : ℝ} (hV : 0 < V) :
    W.pressure d * V / (W.pressure 0 * V) = 1 + W.rho * W.g * d / W.p0 :=
  Perturb.secretion_ratio W.toHydrostatic hV

/-- **A closed-bladder design claiming more volume at depth than Boyle allows, at the committed ρ and g, is
ruled out.** The P3 constraint of the eliminate pipeline. -/
theorem closed_bladder_rules_out (W : WaterColumn) {V : ℝ → ℝ} {c d : ℝ}
    (hboyle : ∀ d, 0 ≤ d → W.pressure d * V d = c) (hd : 0 ≤ d) {claimed : ℝ} (hclaim : V d = claimed)
    (hbig : V 0 * W.p0 / (W.p0 + W.rho * W.g * d) < claimed) : False :=
  Perturb.closed_bladder_rules_out W.toHydrostatic hboyle hd hclaim hbig

/-- The v1 "1 atm per 10 m" case: rho g = 101325 / 10 Pa/m. -/
noncomputable def oneAtmPer10m : WaterColumn where
  p0 := 101325
  rho := 101325 / (10 * 9.80665)
  g := 9.80665
  p0_pos := by norm_num
  rho_pos := by norm_num
  g_pos := by norm_num

theorem oneAtmPer10m_k : oneAtmPer10m.rho * oneAtmPer10m.g = 10132.5 := by
  simp only [oneAtmPer10m]; norm_num

/-- Nominal sea water, as the engine's pressure scenario uses it (1025 kg/m^3; g0 = 9.80665 m/s^2). -/
noncomputable def seaWater : WaterColumn where
  p0 := 101325
  rho := 1025
  g := 9.80665
  p0_pos := by norm_num
  rho_pos := by norm_num
  g_pos := by norm_num

/-- Fresh water at 20 C (998.2 kg/m^3, NIST WebBook as cited by the engine). -/
noncomputable def freshWater : WaterColumn where
  p0 := 101325
  rho := 998.2
  g := 9.80665
  p0_pos := by norm_num
  rho_pos := by norm_num
  g_pos := by norm_num

/-- In sea water the pressure gradient is BELOW one atmosphere per 10 m, which is why v1 over-predicted the
pressure and under-predicted the Boyle volume. -/
theorem seaWater_gradient_lt_oneAtmPer10m : seaWater.rho * seaWater.g < oneAtmPer10m.rho * oneAtmPer10m.g := by
  rw [oneAtmPer10m_k]; simp only [seaWater]; norm_num

/-- **Non-vacuity**: a water column exists (sea water). -/
theorem waterColumn_nonvacuous : Nonempty WaterColumn := ⟨seaWater⟩

end Hydro
end Delphi
