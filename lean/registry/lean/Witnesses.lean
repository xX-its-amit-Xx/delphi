/-
# Registry non-vacuity witnesses and shared-scope bridges

Compiled by lean/registry/build-registry.mjs and lean/registry/test.mjs with `lake env lean` (not part of the
Delphi library, so nothing under lean/Delphi changes).

1. Witnesses: every NAMED HYPOTHESIS the accepted laws take (CubeLaw, AreaLaw, PowerLaw, MusclePowerLaw,
   SectionModulusLaw, LeverLaw, HaldaneCost, the Fick supply inequality) has at least one instance, so no
   theorem proved from it is vacuously true. The empirical layer's own witness is
   `Delphi.Empirical.empirical_nonvacuous`.
2. Bridges: the registry's shared-scope atoms (lean/registry/laws/E*.json, `shared_scope.atoms`) are
   PROVED equivalent to the Lean structures they summarise, so the joint-consistency check in propose.mjs,
   which works on the atoms, is a check about the real hypotheses and not about a paraphrase.
-/
import Delphi.Empirical
import Delphi.Genotype
import Delphi.Scaling

namespace Delphi.Registry

/-! ### Witnesses for the named hypotheses -/

theorem cubeLaw_witness : CubeLaw (fun L => L ^ 3) 1 := ⟨by norm_num, fun _ _ => by ring⟩
theorem areaLaw_witness : AreaLaw (fun L => L ^ 2) 1 := ⟨by norm_num, fun _ _ => by ring⟩
theorem powerLaw_witness : PowerLaw (fun L => L ^ (1.834 : ℝ)) 1 1.834 := ⟨by norm_num, fun _ _ => by ring⟩
theorem musclePowerLaw_witness : MusclePowerLaw (fun L => L ^ 3) (fun L => L ^ 3) 1 1 :=
  ⟨by norm_num, by norm_num, fun _ _ => by ring⟩
theorem sectionModulusLaw_witness : SectionModulusLaw (fun L => L ^ 3) 1 := ⟨by norm_num, fun _ _ => by ring⟩
theorem leverLaw_witness : LeverLaw (fun L => L) 1 := ⟨by norm_num, fun _ _ => by ring⟩
theorem haldaneCost_witness : Genotype.HaldaneCost 1 10 1 1 := ⟨by norm_num, by norm_num, by norm_num⟩
/-- The Fick supply premise `P ≤ η E Q (Ca - Cv)` of `sustained_flight_requires` with every quantity inside
the measured teleost ranges (the `measured` proxies) and a positive power. -/
theorem fick_witness : ∃ P : ℝ, 0 < P ∧ P ≤ aerobicPower 0.15 19.342857 0.06564129 0.18723338 0.05 :=
  ⟨0.01, by norm_num, by unfold aerobicPower; norm_num⟩

/-! ### Bridges: shared-scope atoms are equivalent to the structures -/

open Delphi.Empirical in
theorem bridge_E1 (a w m : ℝ) :
    (a < 2 ∧ 1 < w ∧ 2.9 ≤ m ∧ m ≤ 3.02) ↔
      ∃ A : WithinSpeciesAllometry, A.areaExponent = a ∧ A.wingLoadingExponent = w ∧ A.massExponent = m :=
  ⟨fun ⟨h1, h2, h3, h4⟩ => ⟨⟨a, w, m, h1, h2, ⟨h3, h4⟩⟩, rfl, rfl, rfl⟩,
   fun ⟨A, ha, hw, hm⟩ => ha ▸ hw ▸ hm ▸ ⟨A.area_lt_isometric, A.loading_gt_isometric, A.mass_near_cube.1, A.mass_near_cube.2⟩⟩

open Delphi.Empirical in
theorem bridge_E2 (m : ℝ) : (2.9 ≤ m ∧ m ≤ 3.02) ↔ ∃ M : MassExponentBand, M.b = m :=
  ⟨fun ⟨h1, h2⟩ => ⟨⟨m, h1, h2⟩, rfl⟩, fun ⟨M, hM⟩ => hM ▸ ⟨M.lo, M.hi⟩⟩

open Delphi.Empirical in
theorem bridge_E3 (η E Q Ca : ℝ) :
    (0 ≤ η ∧ η ≤ 0.15 ∧ 0 ≤ E ∧ E ≤ 19.35 ∧ 0 ≤ Q ∧ Q ≤ 0.075 ∧ 0 ≤ Ca ∧ Ca ≤ 0.21) ↔
      ∃ T : TeleostAerobic, T.eta = η ∧ T.oxycaloric = E ∧ T.cardiacOutput = Q ∧ T.arterialO2 = Ca :=
  ⟨fun ⟨a, b, c, d, e, f, g, h⟩ => ⟨⟨η, E, Q, Ca, a, b, c, d, e, f, g, h⟩, rfl, rfl, rfl, rfl⟩,
   fun ⟨T, h1, h2, h3, h4⟩ => h1 ▸ h2 ▸ h3 ▸ h4 ▸
     ⟨T.eta_nonneg, T.eta_le, T.oxy_nonneg, T.oxy_le, T.q_nonneg, T.q_le, T.ca_nonneg, T.ca_le⟩⟩

open Delphi.Empirical in
theorem bridge_E4 (u : ℝ) : u = 0 ↔ ∃ U : NoAerialUptake, U.uptakeInAir = u :=
  ⟨fun h => ⟨⟨u, h⟩, rfl⟩, fun ⟨U, hU⟩ => hU ▸ U.zero_in_air⟩

open Delphi.Empirical in
theorem bridge_E5 (r : ℝ) : (0.406 ≤ r ∧ r ≤ 0.823) ↔ measuredFinRatio r := Iff.rfl

/-! ### The accepted shared-scope atoms are jointly satisfiable (lawset 1.0.0 witness) -/

theorem lawset_shared_scope_witness : ∃ a w m η E Q Ca u r : ℝ,
    (a < 2 ∧ 1 < w ∧ 2.9 ≤ m ∧ m ≤ 3.02) ∧ (2.9 ≤ m ∧ m ≤ 3.02) ∧
    (0 ≤ η ∧ η ≤ 0.15 ∧ 0 ≤ E ∧ E ≤ 19.35 ∧ 0 ≤ Q ∧ Q ≤ 0.075 ∧ 0 ≤ Ca ∧ Ca ≤ 0.21) ∧ u = 0 ∧
    (0.406 ≤ r ∧ r ≤ 0.823) :=
  ⟨1.834, 1.236, 2.981, 0.15, 19.342857, 0.06564129, 0.18723338, 0, 0.687, by norm_num⟩

end Delphi.Registry

#print axioms Delphi.Registry.cubeLaw_witness
#print axioms Delphi.Registry.areaLaw_witness
#print axioms Delphi.Registry.powerLaw_witness
#print axioms Delphi.Registry.musclePowerLaw_witness
#print axioms Delphi.Registry.sectionModulusLaw_witness
#print axioms Delphi.Registry.leverLaw_witness
#print axioms Delphi.Registry.haldaneCost_witness
#print axioms Delphi.Registry.fick_witness
#print axioms Delphi.Registry.bridge_E1
#print axioms Delphi.Registry.bridge_E2
#print axioms Delphi.Registry.bridge_E3
#print axioms Delphi.Registry.bridge_E4
#print axioms Delphi.Registry.bridge_E5
#print axioms Delphi.Registry.lawset_shared_scope_witness
#print axioms Delphi.Empirical.empirical_nonvacuous

namespace Delphi.Registry

/-- Non-vacuity of the model hypotheses of `Delphi.Perturb.wind_glide_rules_out` (all but the claim `hbig`):
airspeed 10 m/s, sink 1 m/s (L/D 10), height 8 m, no wind, ground range 80 m. Restated here, not imported, so
this file does not depend on the perturbation module's build state. -/
theorem windGlide_model_witness : ∃ u s h w x LDmax : ℝ,
    0 < u ∧ 0 < s ∧ 0 ≤ h ∧ -u ≤ w ∧ u / s ≤ LDmax ∧ x = (u + w) * (h / s) :=
  ⟨10, 1, 8, 0, 80, 10, by norm_num⟩

end Delphi.Registry

#print axioms Delphi.Registry.windGlide_model_witness
