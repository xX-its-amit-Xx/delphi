# Pre-registration: cs-hygromorph-bilayer
Written (shell clock, UTC): 2026-11-14T04:17:26Z  -- before any paper was fetched or any curvature value read in this run.

## Law under test
kappa_pred = f(m,n) * delta_eps / h,  f(m,n) = 6(1+m)^2 / [3(1+m)^2 + (1+mn)(m^2 + 1/(mn))]
m = thickness ratio, n = modulus ratio (same layer ordering), h = total thickness,
delta_eps = differential free strain between the layers over the reported stimulus step.
Ceiling claim (Lean: tracks/lean/HygromorphCeilingCheck.lean, timoshenkoCoefficient_le): kappa*h/delta_eps <= 3/2.

## Unit of holdout: whole PAPERS
Rule (cannot be tuned): a paper is HELD OUT iff int(sha256(lowercase DOI string, utf-8).hexdigest(), 16) % 3 == 0.
Any paper added later is assigned by the same rule from its DOI. Split is computed by split.py.
Held-out papers: full text may be fetched and records transcribed (needed to build inputs), but no
prediction, ratio or plot is computed for them until the single final run of evaluate.py.

## Candidate papers (fixed now; ones that prove closed or lack numbers are reported as such)
10.1098/rsif.2009.0184      Reyssat & Mahadevan 2009, pine cone
10.1371/journal.pone.0120718 Rueggeberg & Burgert 2015, wooden bilayers
10.1371/journal.pone.0205607 Groenquist et al. 2018, thin wooden bilayers
10.1016/j.conbuildmat.2015.08.136 Holstov et al. 2015
10.1038/srep18105           Le Duigou & Castro 2016
10.1016/j.matdes.2016.02.018 Le Duigou et al. 2016, flax/PP hygromorph (if that DOI resolves to it)
10.1089/3dp.2015.0022       Correa et al. 2015
10.1098/rsta.2019.0445      Correa et al. 2020
10.3390/polym13193209       Krapez Tomec et al. 2021, wood-PLA printed bilayers
10.1038/nmat4544            Gladman et al. 2016
10.1364/JOSA.11.000233      Timoshenko 1925 (bimetal; if it holds measured values)

## Model and calibration
Zero free parameters. Development papers are used only to (a) debug the extraction and unit handling and
(b) decide ONE thing: if the dev median of kappa_meas/kappa_pred lies outside [0.8, 1.25], a single
multiplicative factor c = that median is frozen and applied to held-out predictions; otherwise c = 1.
Both c=1 and frozen-c numbers are reported for the holdout either way.

## Final metric (one evaluation)
Primary: median absolute log10(kappa_meas/kappa_pred) over held-out records (also RMSE of log10 ratio, n).
Baseline 1 (trivial): kappa = C/h with C = geometric mean of kappa_meas*h over development records.
Baseline 2: kappa = 1.5*delta_eps/h (ceiling, ignores m and n).
Broken-input control: measured curvatures permuted among held-out records (all permutations if n<=8,
else 2000 random with seed 0); mean metric must be worse than the unpermuted metric, else the test is declared broken.
Ceiling test (separate, no fitting): count of records with kappa_meas*h/delta_eps > 1.5, reported for dev and
holdout separately, with the paper's own uncertainty where given. Records where the paper gives delta_eps
only for one layer use that paper's stated differential strain; any assumption I add is flagged per record.
A record enters only if the paper itself reports h (or both layer thicknesses), both moduli (or their ratio),
delta_eps (or both free strains) and a measured curvature/radius. Missing inputs are never filled from other papers
for the primary metric (a flagged secondary set may do so).

## Amendment log (appended 2026-11-14T04:22:20Z, after the single final evaluation; the text above is unchanged)
- Papers added after the first split, assigned by the same sha256 rule (python split.py <doi> ...):
  dev: 10.3390/polym14081624, 10.3390/mi14050924, 10.1002/adma.202007982, 10.1039/d5me00018a, 10.3390/mi11040392, 10.1002/advs.202200458, 10.3390/ijms23158467
  HOLDOUT: 10.1089/3dp.2022.0061, 10.3390/biomimetics6040058, 10.3390/molecules28196752
- Held-out papers total 4; only 10.1371/journal.pone.0205607 prints usable curvature numbers in its text (2 records).
- Deviation from the entry rule: that paper shows its moduli only in a figure, so n = 8.72 was inferred from its printed
  optimum r_opt = 0.253 through m^2 n = 1 (range 5-15 carried as pred_lo/pred_hi). Flagged in records.csv.
- The broken-input control for n = 2 has exactly one non-identity permutation; the same control was also run on the 12 dev records.
- evaluate.py was run once on the held-out records. Nothing was changed afterwards.
