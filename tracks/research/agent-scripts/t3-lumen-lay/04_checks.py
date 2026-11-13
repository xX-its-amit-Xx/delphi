"""Own calculations used in t3-lumen-lay (needs scipy for one number; pandas/openpyxl for covariate counts).
Reads only COVARIATES (condition labels, cell counts) of held-out groups, never their shape outcomes.
Run: python 04_checks.py  (after 02_data_counts.py)"""
import json, math, io
D = r"D:/Users/ashenoy00000/delphi-work/data/lumen-lay/"
out = {}
# (a) critical Spearman/Pearson rho at 5% two-sided for n = 51 and 25  (design-lumen P2 thresholds 0.28 / 0.40)
from scipy import stats
for n in (51, 25):
    t = stats.t.ppf(0.975, n - 2); r = t / math.sqrt(n - 2 + t * t)
    out["rho_crit_n%d" % n] = round(r, 3)
# (b) size-only line S = 0.6703 + 0.0261 N hits the ceiling 1 at N = (1-0.6703)/0.0261   (coefficients are design-lumen's WT fit, not re-fitted here)
out["N_at_ceiling"] = round((1 - 0.6703) / 0.0261, 2)
# (c) 1.5 x 0.106 (design-lumen WT in-sample RMSE of linear-in-N) = threshold used for P4
out["P4_rmse_threshold"] = round(1.5 * 0.106, 3)
# (d) covariate counts: lumens per condition by cells-in-cross-section band (no outcome columns)
import pandas as pd
f6 = pd.read_excel(D + "lumen_manuscript_figure6.xlsx", sheet_name="Nondimensionalized_data")
c = {}
for cond, g in f6.groupby("condition"):
    n = g["num_cell_CS"]
    c[cond] = dict(rows=int(len(g)), with_count=int(n.notna().sum()), n3_10=int(((n >= 3) & (n <= 10)).sum()), n_gt10=int((n > 10).sum()), n_lt3=int((n < 3).sum()))
out["fig6_covariate_counts"] = c
json.dump(out, open(D + "checks.json", "w"), indent=1)
print(json.dumps(out, indent=1))
