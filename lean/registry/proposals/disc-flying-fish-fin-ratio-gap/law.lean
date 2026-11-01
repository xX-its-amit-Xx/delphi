import Mathlib

/-
  MACHINE-PROPOSED by lean/registry/discover.mjs on 2026-11-01. NOT in any law set.
  Every measured flying fish has pectoral/SL at least 0.406, and every measured non-flying-fish beloniform (flying halfbeaks, halfbeaks, needlefish) at most 0.389: the groups do not overlap (n = 49 flying fish, 60 others).
  Support: 109 organisms, 109 observations.
  Sources: genotype/cache/daane2021_data_s1A_fin_measurements.csv (sha256 9c941299f5869e56), Daane 2021 Data S1
  Caveats: a bound every MEASURED specimen satisfies, not an impossibility; one new specimen can break it; museum specimens; ratios recomputed from the length columns
-/

namespace Delphi.Proposed.FinRatioGap

/-- Flying-fish pectoral/SL minimum lies above the maximum of every other measured beloniform group. -/
structure FinRatioGap where
  flyingFishMinRatio : ℝ
  otherBeloniformMaxRatio : ℝ
  ff_lo : (0.406 : ℝ) ≤ flyingFishMinRatio
  other_hi : otherBeloniformMaxRatio ≤ (0.389 : ℝ)
  gap : otherBeloniformMaxRatio < flyingFishMinRatio

/-- Non-vacuity: the observed values are an instance. -/
theorem witness : Nonempty FinRatioGap :=
  ⟨⟨0.406, 0.389, by norm_num, by norm_num, by norm_num⟩⟩

end Delphi.Proposed.FinRatioGap
