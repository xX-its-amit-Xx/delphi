/-
NegativeControl.lean: MUST FAIL. It claims the mismatch is non-negative with
no hypothesis on the swelling law, which is false (take swell = id).
-/
def mismatch (swell : Int → Int) (nuActive nuPassive : Int) : Int :=
  swell nuActive - swell nuPassive

theorem mismatch_nonneg_unconditional (swell : Int → Int)
    (nuA nuP : Int) (hle : nuA ≤ nuP) : 0 ≤ mismatch swell nuA nuP := by
  unfold mismatch
  omega
