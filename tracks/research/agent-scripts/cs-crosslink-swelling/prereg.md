# Preregistration: cs-crosslink-swelling
Timestamp (shell, UTC): 2026-11-14T04:17:07Z  -- written before any data was fetched or opened.

## Law under test
Within one network chemistry, raising crosslinker dose raises modulus (G = nu k T) and lowers equilibrium swelling
(Flory-Rehner). High-swelling limit: Q ~ G^(-3/5), i.e. slope of log Q on log G = -0.6.

## Unit and split (cannot be tuned)
Unit = material system. Fixed system ids: genipin-chitosan, genipin-gelatin, citric-acid-cellulose,
transglutaminase-gelatin, tannic-acid, calcium-alginate.
Rule: sort the six ids by sha256(utf-8 id) hex ascending; the FIRST TWO are held out, the other four are development.
Resulting order (hash prefix, id):
2a5f3362e1a0 citric-acid-cellulose
7e9cb563a4fd transglutaminase-gelatin
99de2a3a2799 tannic-acid
a29bf31b1872 genipin-gelatin
de42a6be58bf calcium-alginate
efd354f6a590 genipin-chitosan
Every paper/series belonging to a held-out system is held out. Held-out series are extracted into a table by the
same procedure but no slope, sign or plot is computed on them until the single final evaluation.

## Inclusion rule for a series (fixed before looking)
One series = one paper, one formulation family, >= 3 crosslinker dose levels, with BOTH a stiffness measure
(G', E, compressive or tensile modulus) and a swelling measure (mass swelling ratio or % swelling/water uptake)
reported numerically (table or text) at the same doses. Figure-only values are not digitised.
Swelling given as percent S is converted to Q = 1 + S/100 when S is defined as (Ws-Wd)/Wd*100.

## Metrics (fixed)
M1 monotonicity: per series, sign of Spearman rho(dose, modulus) should be +, rho(dose, swelling) should be -,
   rho(modulus, swelling) should be -. Report fraction of series with the predicted sign. Baseline: 0.5 (coin).
M2 exponent: per series OLS slope b of log10 Q on log10 modulus. Prediction model P: log Q = a_series - 0.6 log G
   (intercept from the series mean, slope fixed by theory, nothing fitted on held-out besides the intercept).
   Metric: pooled RMSE of log10 Q on held-out points. Baseline B0: series mean of log Q (slope 0).
   Second baseline B1: slope fixed at the development-set median slope.
   Pass if RMSE(P) < RMSE(B0). Also report the held-out median slope and whether -0.6 lies in its bootstrap 95% CI.
Broken-input control: shuffle Q within each series (seed 0, 1000 permutations); the scorer must get worse
   (sign fraction toward 0.5, RMSE(P) >= RMSE(B0) on average). If not, the test is broken.
Minimum n: if fewer than 2 held-out series are obtained, the performance number is reported as underpowered / not obtained.
