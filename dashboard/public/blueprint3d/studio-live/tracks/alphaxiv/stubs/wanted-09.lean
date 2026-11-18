import Mathlib
/-!
# Law wanted 9

Statement, in the paper's terms:
  The drag (braking) force from a flapping side fin depends on how far the fin sticks out, and hardly at all on how fast it flaps.

Source: Maneuvering of an Underwater Vehicle Using Bio-Inspired Pectoral Fins. (https://doi.org/10.3390/biomimetics11070447)
Where: Discussion/Conclusions
Quote: "The streamwise force is, to first order, a linear function of the projected frontal area of the flapping amplitude A*=sinβ"

Quantities:
  -- x1 : streamwise force coefficient CFx
  -- x2 : non-dimensional amplitude A* = sin(beta)
  -- x3 : reduced frequency k = fc/U

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted9

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted9
