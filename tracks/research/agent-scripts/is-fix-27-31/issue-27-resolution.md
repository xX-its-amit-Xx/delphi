# #27 Binding-affinity models: ceiling vs leakage
Goes to: tracks/research/lean-for-bio/q2-answer.md ; script noise_floor.py goes to tracks/scripts/affinity_noise_floor.py
Status: RESOLVED as far as public data allow (the three Lean statements themselves are not written here).

## Independent re-check run 2026-11-13 (noise_floor.py, output in noise_floor_output.txt)
ChEMBL REST, Ki, relation "=", pChEMBL present. CHEMBL203 (EGFR): all 661 rows. CHEMBL244 (factor Xa): first 1000 of 4125 rows (a sample, not the full set).
- Same compound and target measured in different documents: 99 pairs, per-measurement SD s = 0.525 pKi. Dropping the 45 pairs with identical values (possible re-citations, which bias s down) keeps 54 pairs, s = 0.71. So s is 0.5 to 0.7 pKi on this small sample.
- Angle 1, attenuation ceiling within one target, r_max = sqrt(1 - s^2 / var_observed): EGFR (SD 0.98) 0.845 at s = 0.525 and 0.689 at s = 0.71; factor Xa (SD 1.65) 0.948 and 0.902. The ceiling binds hard only where the affinity range is narrow.
- Angle 2, variance split: these two targets happen to have the same mean (6.85 vs 6.82), so the between-target share here is 0.0. Two targets cannot estimate that share; use the earlier 39-target run (tracks/research/agents/q2-data.json: 7.7 % Ki, 14.7 % IC50; target-only predictor pooled r 0.28 / 0.38).
- Agreement with earlier work: q2-data.json found s = 0.61 pKi on 39 targets; Kramer et al. 2012 (doi:10.1021/jm300131x) report SD 0.54 according to q2-critic.json. My 0.525 to 0.71 brackets both.

## Which failures are a ceiling and which are leakage
Figures in this section are from tracks/research/agents/q2-critic.json; I did not re-open the papers today.
- Ceiling (noise): caps Pearson r near 0.85 to 0.95 on wide-range sets, lower (about 0.7) on narrow-range single-target series. It explains why no model reaches r near 1 and why ranking close analogues is hard.
- Leakage: explains why headline scores fall on clean splits. q2-critic.json cites doi:10.1038/s42256-025-01124-5: a nearest-neighbour lookup scores 0.716 on the standard benchmark and 0.653 on the cleaned split.
- Neither: clean-split models at about r 0.75 to 0.80 sit below the noise ceiling on wide-range sets, so that remaining gap is model and generalisation failure, not measurement noise.
- Angle 3 (cycle consistency) was not tested on data: it needs relative free-energy cycles, which this ChEMBL pull does not provide. OPEN.
