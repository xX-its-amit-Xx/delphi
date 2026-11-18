import Mathlib
/-!
# Law wanted 12

Statement, in the paper's terms:
  Along the growing notochord, the spacing between neighbouring cells rises linearly with position, set by posterior cell addition together with anterior vacuolation.

Source: Coupling Vgll4b/Yap-regulated posterior cell addition with anterior vacuolation enables robust notochord elongation. (https://doi.org/10.1242/dev.205951)
Where: Abstract
Quote: "progenitor incorporation, together with vacuolation, produces a linear gradient in nearest neighbour distance"

Quantities:
  -- x1 : nearest neighbour distance between notochord cells
  -- x2 : position along the anterior-posterior axis
  -- x3 : progenitor addition rate
  -- x4 : vacuolation rate

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted12

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted12
