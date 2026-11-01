import Mathlib

/-
  MACHINE-PROPOSED by lean/registry/discover.mjs on 2026-11-01. NOT in any law set.
  Every measured flying-fish specimen with mass and lifting area in the project has wing loading W/(A_pectoral + A_pelvic + A_body) between 37.025 and 46.375 N/m^2 (n = 4).
  Support: 4 organisms, 4 observations.
  Sources: physics/glide-data.csv (sha256 bc24245b5163723b), Park and Choi 2010 Table 1
  Caveats: stuffed specimens of one species (Cypselurus hiraii); n is tiny; model M has pelvic fins folded (A2 = 0); a record bound, not an impossibility
-/

namespace Delphi.Proposed.WingLoadingBand

/-- Wing loading of every measured specimen (Park and Choi 2010) lies in the observed band. -/
structure WingLoadingBand where
  wingLoading : ℝ
  lo : (37.025 : ℝ) ≤ wingLoading
  hi : wingLoading ≤ (46.375 : ℝ)

/-- Non-vacuity: the observed values are an instance. -/
theorem witness : Nonempty WingLoadingBand :=
  ⟨⟨41.7, by norm_num, by norm_num⟩⟩

end Delphi.Proposed.WingLoadingBand
