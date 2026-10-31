/-
Axiom audit. `#print axioms` lists every axiom a theorem depends on. Mathlib proofs use only
Lean's three standard axioms (`propext`, `Classical.choice`, `Quot.sound`). A `sorry` would
show up here as `sorryAx`. `lean/report.mjs` runs this file and records the output.
-/
import Delphi.Kimura
import Delphi.Fisher
import Delphi.MaynardSmith
import Delphi.Favored

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
