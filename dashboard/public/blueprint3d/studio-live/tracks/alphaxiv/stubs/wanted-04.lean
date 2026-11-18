import Mathlib
/-!
# Law wanted 4

Statement, in the paper's terms:
  Past a certain dose, extra polyacid crosslinker leaves unreacted acid groups that pull water in, so retention can rise again with dose.

Source: Cellulose-Based Superabsorbent Hydrogels for Hygiene Applications: A Study of Absorbency Properties (https://doi.org/10.21203/rs.3.rs-9801627/v1)
Where: Section 3.2
Quote: "excess unreacted acid can increase the ability of the gel to retain water (via osmotic effects) even though the crosslinked network is stiff"

Quantities:
  -- x1 : crosslinker dose (%)
  -- x2 : total carboxylic content (mmol/g)
  -- x3 : centrifuge retention capacity (g/g)

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted4

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted4
