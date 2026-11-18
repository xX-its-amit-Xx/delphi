import Mathlib
/-!
# Law wanted 2

Statement, in the paper's terms:
  Adding nanoparticle filler to a crosslinked gel lowers its equilibrium swelling, up to a loading beyond which particles clump and swelling rises again.

Source: Photothermally Responsive Poly(vinyl alcohol)/Polyaniline Nanoparticle Composite Hydrogels Prepared by a Facile Aqueous Route. (https://doi.org/10.3390/polym18131638)
Where: Results, text describing Table 2
Quote: "Neat PVA hydrogel exhibited a maximum swelling of 247 ± 10%, whereas incorporation of PANI-NP significantly reduced this value to approximately 140%"

Quantities:
  -- x1 : filler loading (% w/w)
  -- x2 : equilibrium swelling (%)
  -- x3 : elastic modulus (MPa)

What to do: replace `True` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
`bash tracks/lean/check.sh <file>` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted2

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted2
