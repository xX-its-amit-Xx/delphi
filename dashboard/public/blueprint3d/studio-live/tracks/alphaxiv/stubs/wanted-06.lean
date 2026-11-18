import Mathlib
/-!
# Law wanted 6

Statement, in the paper's terms:
  Measured critical swimming speed is steady while the test section is at least 4 body lengths long and drops when it is shorter.

Source: Effects of Test-Section Length and Cross-Sectional Blockage on the Swimming Performance of Juvenile Grass Carp: Implications for Standardized Testing and Fish-Passage Design. (https://doi.org/10.3390/ani16172710)
Where: Abstract
Quote: "Relative critical swimming speed was similar at 4–8 BL (9.71–9.95 BL/s) but decreased by 10.96% from 4 to 3.5 BL."

Quantities:
  -- x1 : test-section length (body lengths)
  -- x2 : relative critical swimming speed (BL/s)

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted6

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted6
