/-
LinkerBilayer.lean  (agent pr-linker-biomaterials, 2026-11-13)

Core Lean 4 only (no Mathlib), so it can be checked with a bare `lean` binary.
Units: swelling strain in parts per thousand (Int); crosslink density in any
integer unit. These are ORDER statements, not a physical model: they say what
a crosslinker-designed bilayer needs, given a NAMED HYPOTHESIS that swelling
falls as crosslink density rises (the direction reported for genipin, tannic
acid and citric acid in the sources table). Nothing here predicts a curvature
value.
-/
namespace LinkerBilayer

/-- Named hypothesis: swelling strain is antitone in crosslink density. -/
def SwellAntitone (swell : Int → Int) : Prop :=
  ∀ a b : Int, a ≤ b → swell b ≤ swell a

/-- Swelling mismatch between the loosely linked (active) face and the tightly
linked (passive) face. In Timoshenko's bilayer formula curvature is
proportional to this number. -/
def mismatch (swell : Int → Int) (nuActive nuPassive : Int) : Int :=
  swell nuActive - swell nuPassive

/-- If the passive face is at least as crosslinked as the active face, the
mismatch is never negative: the strip can only bend toward the passive face. -/
theorem mismatch_nonneg (swell : Int → Int) (h : SwellAntitone swell)
    (nuA nuP : Int) (hle : nuA ≤ nuP) : 0 ≤ mismatch swell nuA nuP := by
  have := h nuA nuP hle
  unfold mismatch
  omega

/-- No crosslink contrast, no actuation: equal density gives zero mismatch,
whatever the swelling law is. (Needs no hypothesis.) -/
theorem no_contrast_no_bend (swell : Int → Int) (nu : Int) :
    mismatch swell nu nu = 0 := by
  unfold mismatch
  omega

/-- Adding crosslinker to the passive face only (the one-sided dip in the
proposal) never reduces the mismatch. -/
theorem dip_never_hurts (swell : Int → Int) (h : SwellAntitone swell)
    (nuA nuP extra : Int) (hx : 0 ≤ extra) :
    mismatch swell nuA nuP ≤ mismatch swell nuA (nuP + extra) := by
  have := h nuP (nuP + extra) (by omega)
  unfold mismatch
  omega

/-- Viscosity gate as a decidable check (mPa·s). The limit is an INPUT: no
opened Formlabs page states one. -/
def printable (viscosity limit : Nat) : Bool := viscosity ≤ limit

/-- Whatever the limit is, a diluted resin that is no thicker than a printable
one is printable. -/
theorem thinner_still_printable (v v' limit : Nat) (hv : v' ≤ v)
    (h : printable v limit = true) : printable v' limit = true := by
  unfold printable at *
  simp at *
  omega

end LinkerBilayer

-- axiom audit lines added by the lead session (2026-11-13): the strict checker refuses a file without them
#print axioms LinkerBilayer.mismatch_nonneg
#print axioms LinkerBilayer.no_contrast_no_bend
#print axioms LinkerBilayer.dip_never_hurts
#print axioms LinkerBilayer.thinner_still_printable
