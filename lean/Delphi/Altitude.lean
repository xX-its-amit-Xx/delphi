/-
# Flight at altitude: the joint wing-oxygen constraint

Hub part B. Air gets thinner with height, so a wing of fixed area needs a higher speed to carry the same
weight and more power to fly at it; the oxygen partial pressure falls at the same time, so the blood carries
less oxygen per unit volume and the aerobic supply falls. Demand rises and supply falls together, which is
why the two cannot be traded off against each other by climbing.

## What is proved

* `vmin_mono`: the minimum speed of lift-supported flight is nondecreasing in height.
* `demand_mono`: the power to fly at that speed is nondecreasing in height.
* `supply_anti`: the sustained aerobic supply is nonincreasing in height.
* `feasible_downward_closed`: if the design can fly at a height, it can fly at every lower height. So the
  feasible set of heights is an interval reaching down to the ground, and the question "how high" has an
  answer of the form "up to some ceiling".
* `ceiling`: once infeasible at a height, infeasible at every greater height.
* `infeasible_at_ground_infeasible_everywhere`: a design that cannot fly at the ground cannot fly at any
  height. THIS is the statement that matters for the flying fish: its aerobic ceiling is about thirty times
  short of the power its flight needs AT SEA LEVEL (C14, lean/eliminate/ledger.physiology.json), so nothing
  about altitude is doing any work in that conclusion.

## Scope, and what the monotonicity does NOT say

The direction of the effect is a theorem; its SIZE is data and it is gentle. Over 0 to 5000 m the physics
thread's atmosphere fit raises the required aerobic capacity by about 30% and lowers arterial content from
0.190 to 0.173 ml/ml (physics/flier/tff/tff.json), while the real fish sits more than thirty times below
every boundary at every height. So "the feasible region shrinks with altitude" must never be read as the
reason a fish cannot fly high: the reason is the oxygen budget at sea level.

Air density and oxygen partial pressure enter as a MONOTONE ATMOSPHERE, a named hypothesis with no numbers:
`Atmosphere` asks only that both fall with height. The project's conditions file stays at sea level
(conditions/baseline.json); the altitude profile is the physics thread's NASA Glenn metric troposphere fit
(cited in physics/flier/tff/tff.json), an explicit design parameter, not an environment change.

Arterial content enters as a MONOTONE FUNCTION of oxygen partial pressure, which is what a Hill curve is
(physiology/haemoglobin.js). Nothing here formalises the Hill equation, the Bohr shift, the Root effect, or
any compensation an animal might make: a real animal at altitude can raise haematocrit, ventilation or
cardiac output, and this model holds those fixed. Nor is temperature, humidity or wind in it. No bird data
is used anywhere in this project.
-/
import Mathlib
import Delphi.Flight

open Real

namespace Delphi
namespace Altitude

/-- A monotone atmosphere: air density and oxygen partial pressure both fall with height, and both stay
positive. A named hypothesis; no numbers. -/
structure Atmosphere where
  rho : ℝ → ℝ
  po2 : ℝ → ℝ
  rho_pos : ∀ h, 0 < rho h
  po2_nonneg : ∀ h, 0 ≤ po2 h
  rho_anti : ∀ h₁ h₂ : ℝ, h₁ ≤ h₂ → rho h₂ ≤ rho h₁
  po2_anti : ∀ h₁ h₂ : ℝ, h₁ ≤ h₂ → po2 h₂ ≤ po2 h₁

variable (A : Atmosphere)

/-- Minimum speed of lift-supported flight at height `h`: `sqrt (2 W / (rho(h) S C_L,max))` (R4 of
lean/Delphi/Scaling.lean, with the density taken at that height). -/
noncomputable def vminAt (W S CL h : ℝ) : ℝ := Real.sqrt (2 * W / (A.rho h * S * CL))

/-- Power to hold level flight at the minimum speed at height `h`: `W v_min(h) / (L/D)`. -/
noncomputable def demandAt (W S CL LD h : ℝ) : ℝ := W * vminAt A W S CL h / LD

/-- Sustained aerobic supply at height `h`: `eta E Q Ca(PO2(h))` with `Ca` nondecreasing in partial
pressure, which is what a Hill curve gives. -/
noncomputable def supplyAt (ca : ℝ → ℝ) (eta E Q h : ℝ) : ℝ := eta * E * Q * ca (A.po2 h)

/-- **The minimum speed rises with height.** -/
theorem vmin_mono {W S CL : ℝ} (hW : 0 < W) (hS : 0 < S) (hCL : 0 < CL) {h₁ h₂ : ℝ} (h : h₁ ≤ h₂) :
    vminAt A W S CL h₁ ≤ vminAt A W S CL h₂ := by
  unfold vminAt
  apply Real.sqrt_le_sqrt
  have hd : A.rho h₂ * S * CL ≤ A.rho h₁ * S * CL :=
    mul_le_mul_of_nonneg_right (mul_le_mul_of_nonneg_right (A.rho_anti h₁ h₂ h) hS.le) hCL.le
  have hpos : 0 < A.rho h₂ * S * CL := mul_pos (mul_pos (A.rho_pos h₂) hS) hCL
  exact div_le_div_of_nonneg_left (by linarith) hpos hd

/-- **The power required rises with height**, because the minimum speed does. -/
theorem demand_mono {W S CL LD : ℝ} (hW : 0 < W) (hS : 0 < S) (hCL : 0 < CL) (hLD : 0 < LD)
    {h₁ h₂ : ℝ} (h : h₁ ≤ h₂) : demandAt A W S CL LD h₁ ≤ demandAt A W S CL LD h₂ := by
  unfold demandAt
  apply div_le_div_of_nonneg_right _ hLD.le
  exact mul_le_mul_of_nonneg_left (vmin_mono A hW hS hCL h) hW.le

/-- **The aerobic supply falls with height**, because the oxygen partial pressure does and arterial content
is nondecreasing in it. -/
theorem supply_anti {ca : ℝ → ℝ} (hca : ∀ x y : ℝ, x ≤ y → ca x ≤ ca y) {eta E Q : ℝ}
    (he : 0 ≤ eta) (hE : 0 ≤ E) (hQ : 0 ≤ Q) {h₁ h₂ : ℝ} (h : h₁ ≤ h₂) :
    supplyAt A ca eta E Q h₂ ≤ supplyAt A ca eta E Q h₁ := by
  unfold supplyAt
  exact mul_le_mul_of_nonneg_left (hca _ _ (A.po2_anti h₁ h₂ h)) (by positivity)

/-- Sustained flight is possible at height `h` when the aerobic supply there covers the power required
there. "Feasible" in the model's sense only: it says the oxygen budget is not what forbids the flight, and
nothing about burst power, structure, control, heat or whether the animal exists. -/
def Feasible (ca : ℝ → ℝ) (W S CL LD eta E Q h : ℝ) : Prop :=
  demandAt A W S CL LD h ≤ supplyAt A ca eta E Q h

/-- **The feasible heights reach down to the ground.** If the design can fly at a height, it can fly at
every lower one: demand only falls as you descend and supply only rises. -/
theorem feasible_downward_closed {ca : ℝ → ℝ} (hca : ∀ x y : ℝ, x ≤ y → ca x ≤ ca y)
    {W S CL LD eta E Q : ℝ} (hW : 0 < W) (hS : 0 < S) (hCL : 0 < CL) (hLD : 0 < LD)
    (he : 0 ≤ eta) (hE : 0 ≤ E) (hQ : 0 ≤ Q) {h₁ h₂ : ℝ} (hle : h₁ ≤ h₂)
    (hfeas : Feasible A ca W S CL LD eta E Q h₂) : Feasible A ca W S CL LD eta E Q h₁ := by
  unfold Feasible at hfeas ⊢
  calc demandAt A W S CL LD h₁ ≤ demandAt A W S CL LD h₂ := demand_mono A hW hS hCL hLD hle
    _ ≤ supplyAt A ca eta E Q h₂ := hfeas
    _ ≤ supplyAt A ca eta E Q h₁ := supply_anti A hca he hE hQ hle

/-- **A ceiling exists**, in the only sense this model can give one: above an infeasible height, every
height is infeasible. The feasible set is therefore an interval from the ground up to a ceiling, which may
be empty (nothing says the ground itself is feasible) and whose value this theorem does not compute. -/
theorem ceiling {ca : ℝ → ℝ} (hca : ∀ x y : ℝ, x ≤ y → ca x ≤ ca y)
    {W S CL LD eta E Q : ℝ} (hW : 0 < W) (hS : 0 < S) (hCL : 0 < CL) (hLD : 0 < LD)
    (he : 0 ≤ eta) (hE : 0 ≤ E) (hQ : 0 ≤ Q) {h₀ : ℝ} (hinf : ¬ Feasible A ca W S CL LD eta E Q h₀) :
    ∀ h, h₀ ≤ h → ¬ Feasible A ca W S CL LD eta E Q h := by
  intro h hle hfeas
  exact hinf (feasible_downward_closed A hca hW hS hCL hLD he hE hQ hle hfeas)

/-- **What matters for the flying fish.** A design whose oxygen budget cannot pay for flight at the ground
cannot pay for it at any height, so altitude explains nothing about such a design. The real fish is in this
case at sea level by a factor of about thirty (C14), and the gentle shrink of the feasible region with
height is NOT the reason. -/
theorem infeasible_at_ground_infeasible_everywhere {ca : ℝ → ℝ} (hca : ∀ x y : ℝ, x ≤ y → ca x ≤ ca y)
    {W S CL LD eta E Q : ℝ} (hW : 0 < W) (hS : 0 < S) (hCL : 0 < CL) (hLD : 0 < LD)
    (he : 0 ≤ eta) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hground : ¬ Feasible A ca W S CL LD eta E Q 0) :
    ∀ h, 0 ≤ h → ¬ Feasible A ca W S CL LD eta E Q h :=
  ceiling A hca hW hS hCL hLD he hE hQ hground

/-- **The wing can be traded against the oxygen budget, but only at a fixed height.** A larger lifting area
lowers the minimum speed and so the power required; this says nothing about altitude, and it is the only
direction in which the two sides of the constraint can be exchanged. -/
theorem demand_anti_area {W CL LD h : ℝ} (hW : 0 < W) (hCL : 0 < CL) (hLD : 0 < LD)
    {S₁ S₂ : ℝ} (hS₁ : 0 < S₁) (hS : S₁ ≤ S₂) :
    demandAt A W S₂ CL LD h ≤ demandAt A W S₁ CL LD h := by
  unfold demandAt vminAt
  apply div_le_div_of_nonneg_right _ hLD.le
  apply mul_le_mul_of_nonneg_left _ hW.le
  apply Real.sqrt_le_sqrt
  have hd : A.rho h * S₁ * CL ≤ A.rho h * S₂ * CL :=
    mul_le_mul_of_nonneg_right (mul_le_mul_of_nonneg_left hS (A.rho_pos h).le) hCL.le
  have hpos : 0 < A.rho h * S₁ * CL := mul_pos (mul_pos (A.rho_pos h) hS₁) hCL
  exact div_le_div_of_nonneg_left (by linarith) hpos hd

end Altitude
end Delphi
