import Mathlib

/-
  MACHINE-PROPOSED by lean/registry/discover.mjs on 2026-11-01. NOT in any law set.
  Across museum flying-fish specimens, pectoral fin length scales with standard length as SL^b with the exponent inside its 95% CI [1.017, 1.099] (OLS on log-log, n = 49, b = 1.058, r^2 = 0.983).
  Support: 49 organisms, 49 observations.
  Sources: genotype/cache/daane2021_data_s1A_fin_measurements.csv (sha256 9c941299f5869e56), Daane JM et al. 2021 Curr Biol doi:10.1016/j.cub.2021.08.054 Data S1 sheet A
  Caveats: preserved museum specimens; pooled across species (between-species and ontogenetic variation mixed); OLS, not RMA; the CI is the slope CI of y = pectoral on x = SL; SL spans 1.68 to 24 cm, so larvae/juveniles are included
-/

namespace Delphi.Proposed.PectoralAllometry

/-- Pooled across 49 museum flying-fish specimens: the log-log slope of pectoral fin length on standard length lies in its 95% CI. -/
structure PectoralLengthAllometry where
  b : ℝ
  lo : (1.017 : ℝ) ≤ b
  hi : b ≤ (1.099 : ℝ)

/-- Non-vacuity: the observed values are an instance. -/
theorem witness : Nonempty PectoralLengthAllometry :=
  ⟨⟨1.058, by norm_num, by norm_num⟩⟩

end Delphi.Proposed.PectoralAllometry
