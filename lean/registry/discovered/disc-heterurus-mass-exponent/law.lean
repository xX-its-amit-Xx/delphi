import Mathlib

/-
  MACHINE-PROPOSED by lean/registry/discover.mjs on 2026-11-01. NOT in any law set.
  Within Cheilopogon heterurus doederleini, body mass scales with body length as L^b with b inside its 95% CI [0.478, 1.484] (OLS on log-log, n = 14 specimens, b = 0.981, r^2 = 0.601).
  Support: 14 organisms, 14 observations.
  Sources: physics/glide-data.csv (sha256 bc24245b5163723b), rows source_id makiguchi-2013 (specimen rows)
  Caveats: narrow length range (0.257 to 0.340 m), so the CI is wide; length kind as recorded in the CSV; one species, one study
-/

namespace Delphi.Proposed.HeterurusMass

/-- Within one flying-fish species, the log-log slope of body mass on body length lies in its 95% CI. -/
structure HeterurusMassExponent where
  b : ℝ
  lo : (0.478 : ℝ) ≤ b
  hi : b ≤ (1.484 : ℝ)

/-- Non-vacuity: the observed values are an instance. -/
theorem witness : Nonempty HeterurusMassExponent :=
  ⟨⟨0.981, by norm_num, by norm_num⟩⟩

end Delphi.Proposed.HeterurusMass
