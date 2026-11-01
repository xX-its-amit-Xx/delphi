/-
Axiom audit. `#print axioms` lists every axiom a theorem depends on. Mathlib proofs use only
Lean's three standard axioms (`propext`, `Classical.choice`, `Quot.sound`). A `sorry` would
show up here as `sorryAx`. `lean/report.mjs` runs this file and records the output.
-/
import Delphi.Kimura
import Delphi.Fisher
import Delphi.MaynardSmith
import Delphi.Favored
import Delphi.Blueprint
import Delphi.Thompson
import Delphi.Certificates.AFlyingFish
import Delphi.Scaling
import Delphi.Flight
import Delphi.Genotype
import Delphi.Physiology
import Delphi.Empirical
import Delphi.Altitude
import Delphi.Perturb
import Delphi.Constraints

#print axioms Delphi.NeutralChain.fixedBy_tendsto
#print axioms Delphi.NeutralChain.fixedBy_sub_le
#print axioms Delphi.wrightFisher_fixation_one
#print axioms Delphi.neutral_substitution_rate
#print axioms Delphi.neutral_substitution_rate_diploid
#print axioms Delphi.neutral_substitution_rate_tendsto
#print axioms Delphi.fisher_fundamental_theorem
#print axioms Delphi.fisher_fundamental_theorem'
#print axioms Delphi.mean_fitness_nondecreasing
#print axioms Delphi.twofold_cost_of_sex
#print axioms Delphi.twofold_cost_of_sex_n
#print axioms Delphi.FavoredChain.fixationProbability_ge
#print axioms Delphi.FavoredChain.fixationProbability_le_one
#print axioms Delphi.wrightFisherSelection_fixation_one_ge
#print axioms Delphi.neutral_expectedSubstitutions
#print axioms Delphi.favored_expectedSubstitutions_ge
#print axioms Delphi.expectedSubstitutions_le
#print axioms Delphi.wrightFisherSelection_substitutions_bounds
#print axioms Delphi.Blueprint.Graph.acyclic_of_levelsDown
#print axioms Delphi.Blueprint.Graph.transGen_trans
#print axioms Delphi.Blueprint.Graph.transGen_level_lt
#print axioms Delphi.Blueprint.Graph.rooted_of
#print axioms Delphi.Blueprint.wellFormed_of_check
#print axioms Delphi.Blueprint.Certificates.aFlyingFish_check
#print axioms Delphi.Blueprint.Certificates.aFlyingFish_wellFormed
#print axioms Delphi.Blueprint.Certificates.aFlyingFish_nodup
#print axioms Delphi.Blueprint.Certificates.aFlyingFish_counts
#print axioms Delphi.Blueprint.Certificates.aFlyingFish_size
#print axioms Delphi.cubeLaw_ratio
#print axioms Delphi.cubeLaw_loglog_exponent
#print axioms Delphi.not_cubeLaw_of_exponent_ne_three
#print axioms Delphi.Constraints.kimura_rate_rules_out
#print axioms Delphi.Constraints.neutral_fixation_rules_out
#print axioms Delphi.Constraints.favored_fixation_rules_out
#print axioms Delphi.Constraints.supply_rules_out
#print axioms Delphi.Constraints.supply_rules_out'
#print axioms Delphi.Constraints.fisher_rules_out
#print axioms Delphi.Constraints.fisher_decline_rules_out
#print axioms Delphi.Constraints.twofold_rules_out
#print axioms Delphi.Constraints.cubeLaw_rules_out
#print axioms Delphi.Constraints.cubeLaw_rules_out'
#print axioms Delphi.Constraints.exponent_rules_out
#print axioms Delphi.Constraints.kimura_rate_ratio_rules_out
#print axioms Delphi.Constraints.fisher_zero_variance_rules_out
#print axioms Delphi.Constraints.twofold_factor_rules_out
#print axioms Delphi.areaLaw_ratio
#print axioms Delphi.areaLaw_log
#print axioms Delphi.wingLoading_ratio
#print axioms Delphi.wingLoading_log
#print axioms Delphi.breakLoad_ratio
#print axioms Delphi.safetyFactor_eq
#print axioms Delphi.stress_ratio
#print axioms Delphi.safetyFactor_scaled
#print axioms Delphi.cannot_carry
#print axioms Delphi.vmin_le
#print axioms Delphi.vmin_ratio
#print axioms Delphi.vmin_log
#print axioms Delphi.powerRequired_ratio
#print axioms Delphi.powerRequired_log
#print axioms Delphi.powerAvailable_ratio
#print axioms Delphi.powerRatio_eq
#print axioms Delphi.exists_size_limit
#print axioms Delphi.froude_ratio
#print axioms Delphi.Constraints.axial_strength_rules_out
#print axioms Delphi.Constraints.strength_ratio_rules_out
#print axioms Delphi.Constraints.giant_rules_out
#print axioms Delphi.Constraints.stress_ratio_rules_out
#print axioms Delphi.Constraints.area_ratio_rules_out
#print axioms Delphi.Constraints.area_exponent_rules_out
#print axioms Delphi.Constraints.stress_exponent_rules_out
#print axioms Delphi.Constraints.vmin_exponent_rules_out
#print axioms Delphi.Constraints.vmin_rules_out
#print axioms Delphi.Constraints.vmin_scaling_rules_out
#print axioms Delphi.Constraints.powerRequired_exponent_rules_out
#print axioms Delphi.Constraints.froude_rules_out
#print axioms Delphi.bendingStress_ratio_body
#print axioms Delphi.bendingStress_log_body
#print axioms Delphi.bendingSafety_eq
#print axioms Delphi.bending_cannot_carry
#print axioms Delphi.bendingStress_ratio_sheet
#print axioms Delphi.bendingStress_log_sheet
#print axioms Delphi.Constraints.bending_exponent_rules_out
#print axioms Delphi.Constraints.bending_ratio_rules_out
#print axioms Delphi.Constraints.bending_exponent_sheet_rules_out
#print axioms Delphi.powerLaw_ratio
#print axioms Delphi.powerLaw_log
#print axioms Delphi.powerLaw_div
#print axioms Delphi.cubeLaw_powerLaw
#print axioms Delphi.vmin_powerLaw_log
#print axioms Delphi.climbRate_le
#print axioms Delphi.climb_nonneg_iff
#print axioms Delphi.glide_range_le
#print axioms Delphi.glide_range_le_groundEffect
#print axioms Delphi.aerobic_le_Ca
#print axioms Delphi.aerobic_le_metabolic
#print axioms Delphi.sustained_le
#print axioms Delphi.sustained_flight_requires
#print axioms Delphi.climb_le_aerobic
#print axioms Delphi.powerLaw_crossover
#print axioms Delphi.Constraints.allometry_consistency_rules_out
#print axioms Delphi.Constraints.aerobic_flight_rules_out
#print axioms Delphi.Constraints.glide_range_rules_out
#print axioms Delphi.Constraints.climb_rules_out
#print axioms Delphi.Genotype.minSubst_le
#print axioms Delphi.Genotype.claimed_substitutions_rules_out
#print axioms Delphi.Genotype.phe_leu_one
#print axioms Delphi.Genotype.trp_stop_one
#print axioms Delphi.Genotype.met_trp_two
#print axioms Delphi.Genotype.devOrdered_acyclic
#print axioms Delphi.Genotype.devOrdered_of_check
#print axioms Delphi.Genotype.closure_of_check
#print axioms Delphi.Genotype.closure_violated
#print axioms Delphi.Genotype.expectedWaitingTime_neutral
#print axioms Delphi.Genotype.expectedWaitingTime_bounds
#print axioms Delphi.Genotype.too_little_time_rules_out
#print axioms Delphi.Genotype.haldane_time_lower
#print axioms Delphi.Genotype.haldane_rules_out
#print axioms Delphi.Physiology.q10_ratio
#print axioms Delphi.Physiology.q10_log
#print axioms Delphi.Physiology.sphereWallStress_mono
#print axioms Delphi.Physiology.laplace_pressure_limit
#print axioms Delphi.Physiology.hoop_pressure_limit
#print axioms Delphi.Empirical.not_isometric_area
#print axioms Delphi.Empirical.loading_rises
#print axioms Delphi.Empirical.weight_ratio_band
#print axioms Delphi.Empirical.weight_ratio_rules_out
#print axioms Delphi.Empirical.aerobicCeiling_le
#print axioms Delphi.Empirical.no_aerobic_flight_above_ceiling
#print axioms Delphi.Empirical.stored_power_le
#print axioms Delphi.Empirical.finRatio_outside
#print axioms Delphi.Empirical.requiredFor_not_propagated_of_check
#print axioms Delphi.Empirical.requiredFor_propagated_violates
#print axioms Delphi.Empirical.cannot_score_of_lethal_before
#print axioms Delphi.Empirical.empirical_nonvacuous
#print axioms Delphi.Empirical.measured_ceiling_le
#print axioms Delphi.Empirical.ezh2_cannot_be_scored
#print axioms Delphi.Empirical.wls_rays_cannot_be_scored
#print axioms Delphi.Altitude.vmin_mono
#print axioms Delphi.Altitude.demand_mono
#print axioms Delphi.Altitude.supply_anti
#print axioms Delphi.Altitude.feasible_downward_closed
#print axioms Delphi.Altitude.ceiling
#print axioms Delphi.Altitude.infeasible_at_ground_infeasible_everywhere
#print axioms Delphi.Altitude.demand_anti_area
#print axioms Delphi.Perturb.sustained_power_le
#print axioms Delphi.Perturb.no_sustained_power_outside
#print axioms Delphi.Perturb.thermal_rules_out
#print axioms Delphi.Perturb.thermal_power_rules_out
#print axioms Delphi.Perturb.station_requires
#print axioms Delphi.Perturb.no_station_above_ucrit
#print axioms Delphi.Perturb.no_station_above_drag_bound
#print axioms Delphi.Perturb.Hydrostatic.pressure_pos
#print axioms Delphi.Perturb.bladder_volume_eq
#print axioms Delphi.Perturb.bladder_volume_anti
#print axioms Delphi.Perturb.secretion_ratio
#print axioms Delphi.Perturb.closed_bladder_rules_out
#print axioms Delphi.Perturb.depth_le_isosmotic
#print axioms Delphi.Perturb.no_teleost_below
#print axioms Delphi.Perturb.isa_rho_pos
#print axioms Delphi.Perturb.isa_rho_anti
#print axioms Delphi.Perturb.vmin_inv_sqrt
#print axioms Delphi.Perturb.vmin_density_ratio
#print axioms Delphi.Perturb.vmin_isa_mono
#print axioms Delphi.Perturb.glide_ground_range
#print axioms Delphi.Perturb.glide_ground_range_le
#print axioms Delphi.Perturb.wind_glide_rules_out
#print axioms Delphi.Perturb.mass_declines_of_deficit
#print axioms Delphi.Perturb.intake_needed
#print axioms Delphi.Perturb.energy_rules_out
#print axioms Delphi.Perturb.perturb_nonvacuous
#print axioms Delphi.Perturb.measured_no_teleost_below
