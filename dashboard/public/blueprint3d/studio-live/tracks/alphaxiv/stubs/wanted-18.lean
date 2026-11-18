import Mathlib
/-!
# Law wanted 18

Statement, in the paper's terms:
  In a two-region electrothermal film actuator wired in series, the ratio of the two regions' bending curvatures rises linearly with the ratio of their electrical resistances, whatever the drive current.

Source: Hierarchical laser-programmed soft actuators for designing bionic robots with freeform morphing shapes. (https://doi.org/10.1126/sciadv.aeb1989)
Where: Results, text describing Fig. 3G
Quote: "the resistance ratio (1.3 to 19.1) from part A to part B faithfully reflects a linear dependence on its curvature ratio (1.2 to 12.7), regardless of the applied current level."

Quantities:
  -- x1 : resistance ratio (part A / part B)
  -- x2 : curvature ratio

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted18

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted18
