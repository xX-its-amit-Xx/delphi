import Mathlib
/-!
# Law wanted 8

Statement, in the paper's terms:
  The sideways force from a flapping side fin grows with Strouhal number as a power law that is steep below a Strouhal number of 0.08 and about half as steep above it.

Source: Maneuvering of an Underwater Vehicle Using Bio-Inspired Pectoral Fins. (https://doi.org/10.3390/biomimetics11070447)
Where: Results, text describing the lateral force scaling figure
Quote: "The transition in the lateral force scaling from one regime to another occurs at the crossover Strouhal number Stc=0.08"

Quantities:
  -- x1 : Strouhal number St = fA/U of the fin
  -- x2 : lateral force coefficient divided by amplitude (CFy/A*)
  -- x3 : exponents 0.79 and 0.38
  -- x4 : crossover St 0.08

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted8

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted8
