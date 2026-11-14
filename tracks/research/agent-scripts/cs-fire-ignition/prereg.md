# Pre-registration: cs-fire-ignition
Written (UTC, from shell): 2026-11-14T04:20:29Z

Data: FSRI Materials and Products Database, GitHub ulfsri/fsri_materials_database (branch main),
cone calorimeter *Scalar*.csv (field TIME TO IGN, HEAT FLUX) and HFM .tst files
(Lambda W/mK; volumetric specific heat J/(m3 K)), "Wet" = unconditioned samples only.

Outcomes seen before writing this: ONE value (ABS, 25 kW/m2, replicate 1, t_ig = 113 s) while
inspecting file format, plus MDF conductivity/heat-capacity files (inputs, not outcomes).

## Unit and holdout rule (cannot be tuned)
Unit = material directory name under 01_Data. A material is HELD OUT iff
int(sha256(dirname.encode()).hexdigest(), 16) % 4 == 0. Whole materials are held out.
Held-out outcomes are read once, in the final evaluation.

## Inclusion (decided on inputs only)
Material has >=1 unconditioned conductivity file and >=1 unconditioned heat-capacity file that parse,
and cone replicates with TIME TO IGN > 0. Record = one cone replicate with t_ig > 0.
kpc = mean(Lambda over setpoints and replicates) * mean(volumetric heat capacity). T0 = 20 C.

## Tests
T1 bound direction, no fitted parameter: t_floor = (pi/4) kpc (250-20)^2 / q^2 (T_ig floor 250 C is
   an assumption from memory of the piloted-ignition literature, not an opened source).
   Claim: measured t_ig >= t_floor. Metric: fraction of records violating; also the implied
   T_ig = 20 + q*sqrt(4 t/(pi kpc)) distribution.
T2 calibrated absolute model: log10 t = log10((pi/4) kpc / q^2) + 2 log10(dT_eff); the single
   parameter dT_eff is the dev-set median. Metric: RMSE of log10(t_ig) on held-out records.
   Baselines: B0 dev mean log10 t per flux level (no properties); B1 dev fit log10 t = a - 2 log10 q.
   Broken-input control: permute kpc across held-out materials (200 seeded permutations); RMSE must rise.
T3 linearity: per material with 3 flux levels, material-mean t_ig per flux: R2 of t^-1/2 vs q (thick)
   and t^-1 vs q (thin); log-log slope of t vs q (thick predicts -2, thin -1); leave-middle-out:
   predict t at 50 from 25 and 75 under each form, metric |log10 error|; baseline: geometric mean of
   t25 and t75. Broken control: swap the 25 and 75 labels.
T4 secondary (if *_Ignition_Temp_Properties.csv parse): bound test with measured T_ig.
No other metric will be reported as the headline. Headline performance = T2 held-out RMSE vs B0/B1.

## Dev stage completed (UTC 2026-11-14T04:21:48Z)
Dev result fixed before final: dT_eff = 924.9 K (see results_dev.json). T4 dropped: the *_Ignition_Temp_Properties.csv
files hold k, c, rho only, no ignition temperature. T3 broken control changed before final run: label swap leaves a
midpoint interpolation unchanged, so the T3 control is the geometric-mean baseline only; the headline shuffle control is T2's.
Final held-out evaluation launched next, once.
