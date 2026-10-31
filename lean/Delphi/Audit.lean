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
