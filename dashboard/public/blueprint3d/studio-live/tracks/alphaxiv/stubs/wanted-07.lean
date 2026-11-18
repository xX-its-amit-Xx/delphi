import Mathlib
/-!
# Law wanted 7

Statement, in the paper's terms:
  The more of the tunnel cross-section the fish's body fills, the lower its measured critical swimming speed.

Source: Effects of Test-Section Length and Cross-Sectional Blockage on the Swimming Performance of Juvenile Grass Carp: Implications for Standardized Testing and Fish-Passage Design. (https://doi.org/10.3390/ani16172710)
Where: Abstract
Quote: "Increasing blockage from 1.88% to 9.26% and 15.31% reduced it from 6.99 to 5.34 and 5.24 BL/s, respectively."

Quantities:
  -- x1 : cross-sectional blockage ratio (%)
  -- x2 : relative critical swimming speed (BL/s)

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted7

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted7
