"""Reproduce numbers reported by the earlier scout-lumen and design-lumen agents.
Usage: python -P 02_reproduce.py [DATA_DIR]      (needs pandas, numpy, scipy, openpyxl)
Writes results.json next to this script.

BLINDNESS: the design freezes predictions on Rab11a-GFP and Cldn-qKO outcomes. This script reads ONLY covariates
(cell number, filename) for those genotypes; no outcome column of a held-out genotype is read or printed.
Every outcome statistic below is computed on WT, ouabain/ddAVP/control (not held out) or the simulated sweep.
"""
import sys, json, math, os
import numpy as np, pandas as pd
from scipy.stats import spearmanr, pearsonr

D = sys.argv[1] if len(sys.argv) > 1 else "D:/Users/ashenoy00000/delphi-work/data/t3-vasquez"
R = D + "/raw/"
OUT = {}


def rec(key, **kw):
    OUT[key] = kw
    print(key, json.dumps(kw, default=float))


rm = lambda e: float(np.sqrt(np.mean(np.square(e))))

# ---------- SCOUT checks ----------
f1 = pd.read_excel(R + "lumen_manuscript_figure1_SF1.xlsx", sheet_name="lumen_shape")
rec("S1_sphericity_n", n=len(f1))
for ddof in (1, 0):
    rec(f"S1_sphericity_ddof{ddof}", lumen_mean=f1.spher_lumen.mean(), lumen_sd=f1.spher_lumen.std(ddof=ddof),
        cyst_mean=f1.spher_cyst.mean(), cyst_sd=f1.spher_cyst.std(ddof=ddof))
# definition check: sphericity = pi^(1/3) (6V)^(2/3) / SA
sph = np.pi ** (1 / 3) * (6 * f1.vol_lumen) ** (2 / 3) / f1.SA_lumen
rec("S1_sphericity_definition_max_abs_diff", value=float((sph - f1.spher_lumen).abs().max()))
# surface area per cell
sa = f1.SA_per_cell
rec("S2_SA_per_cell", mean=sa.mean(), sd=sa.std(ddof=1), cv=sa.std(ddof=1) / sa.mean(),
    slope_through_origin=float((f1.SA_lumen * f1.cell_num).sum() / (f1.cell_num ** 2).sum()),
    pearson_SA_N=float(pearsonr(f1.SA_lumen, f1.cell_num)[0]),
    SA_per_cell_equals_SA_over_N=float((f1.SA_lumen / f1.cell_num - f1.SA_per_cell).abs().max()),
    cell_num_min=int(f1.cell_num.min()), cell_num_max=int(f1.cell_num.max()))

f2a = pd.read_excel(R + "lumen_manuscript_figure2_SF2.xlsx", sheet_name="ouabain_ddAVP")
g = f2a.groupby("condition").lumen_solidity.agg(["mean", "std", "count"])
rec("S3_solidity_not_heldout", table=g.round(4).to_dict("index"))
f2b = pd.read_excel(R + "lumen_manuscript_figure2_SF2.xlsx", sheet_name="cldn-qKO")
wt_sol = f2b[f2b.condition == "WT"].solidity  # WT only
rec("S3_WT_solidity", mean=wt_sol.mean(), sd=wt_sol.std(ddof=1), n=int(wt_sol.count()))
rec("S3_conditions_present_in_cldn_sheet", counts=f2b.condition.value_counts().to_dict())

f3 = pd.read_excel(R + "lumen_manuscript_figure3_SF3.xlsx", sheet_name="lumen_vol_SA")
f3["vr"] = f3.v10 / f3.v0
f3["sr"] = f3.s10 / f3.s0
rec("S4_fig3_conditions", counts=f3.condition.value_counts().to_dict())
rec("S4_fig3_ratios", table={c: {"vr_mean": round(d.vr.mean(), 4), "vr_sd": round(d.vr.std(ddof=1), 4), "sr_mean": round(d.sr.mean(), 4), "sr_sd": round(d.sr.std(ddof=1), 4), "n": len(d)} for c, d in f3.groupby("condition")})

sim = pd.read_excel(R + "lumen_manuscript_figure5_SF5.xlsx")
rec("S5_sweep_rows", n=len(sim))

# ---------- DESIGN checks ----------
f6 = pd.read_excel(R + "lumen_manuscript_figure6.xlsx", sheet_name="Nondimensionalized_data")
rec("D0_fig6_condition_counts", counts=f6.condition.value_counts().to_dict())
# data map on the first WT row
w = f6[f6.condition == "WT"].iloc[0]
N = w.num_cell_CS
A0 = (w.area_cyst - w.area) / N
rec("D1_first_WT_row_datamap", file=w.filename, l_a_file=w.l_a, l_a_calc=w.perimeter / (N * math.sqrt(A0)),
    norm_area_file=w.normalized_lumen_area, norm_area_calc=w.area / A0,
    basal_file=w.nondim_basal_length, basal_calc=w.perimeter_cyst / (N * math.sqrt(A0)))
# data map on ALL rows with a cell count: covariates/identity only, not an outcome comparison across genotypes
ok = f6.dropna(subset=["num_cell_CS"]).copy()
ok["A0"] = (ok.area_cyst - ok.area) / ok.num_cell_CS
ok["la_c"] = ok.perimeter / (ok.num_cell_CS * np.sqrt(ok.A0))
ok["a_c"] = ok.area / ok.A0
ok["lb_c"] = ok.perimeter_cyst / (ok.num_cell_CS * np.sqrt(ok.A0))
rec("D1_datamap_all_rows_max_rel_diff", l_a=float((ok.la_c / ok.l_a - 1).abs().max()),
    norm_area=float((ok.a_c / ok.normalized_lumen_area - 1).abs().max()),
    basal=float((ok.lb_c / ok.nondim_basal_length - 1).abs().max()), n=len(ok))

# coverage of held-out genotypes: cell counts and filename joins ONLY
sol_sheets = {
    "WT": f2b[f2b.condition == "WT"], "Cldn_qKO": f2b[f2b.condition != "WT"],
    "Rab11a-GFP": pd.read_excel(R + "lumen_manuscript_figure4_SF4.xlsx", sheet_name="Crb_KIBRA_Rab11a"),
}
cov = {}
for gname in ("WT", "Rab11a-GFP", "Cldn_qKO"):
    sub = f6[f6.condition == gname]
    n = sub.num_cell_CS
    key = set(sol_sheets[gname].filename)
    cov[gname] = dict(rows=len(sub), no_cell_count=int(n.isna().sum()), N_lt3=int((n < 3).sum()),
                      N_3_10=int(n.between(3, 10).sum()), N_gt10=int((n > 10).sum()),
                      joined_to_solidity_sheet=int(sub.filename.isin(key).sum()))
rec("D2_coverage", table=cov)

# WT-only statistics. Join WT solidity by filename.
wt = f6[(f6.condition == "WT")].merge(f2b[f2b.condition == "WT"][["filename", "solidity"]], on="filename", how="left")
wt = wt.dropna(subset=["num_cell_CS"]).copy()
wt["N"] = wt.num_cell_CS.astype(int)
wt["ipq"] = 4 * np.pi * wt.area / wt.perimeter ** 2
q = lambda x: dict(median=float(np.median(x)), q25_numpy=float(np.percentile(x, 25)), q75_numpy=float(np.percentile(x, 75)),
                   q25_nearest_rank=float(np.sort(x)[len(x) // 4]), q75_nearest_rank=float(np.sort(x)[3 * len(x) // 4]))
rec("D3_WT_pooled", n=len(wt), solidity=q(wt.solidity.values), ipq=q(wt.ipq.values), l_a_median=float(wt.l_a.median()),
    spearman_la_N=float(spearmanr(wt.l_a, wt.N)[0]), spearman_sol_N=float(spearmanr(wt.solidity, wt.N)[0]),
    spearman_sol_ipq=float(spearmanr(wt.solidity, wt.ipq)[0]))
wi = wt[wt.N.between(3, 10)].copy()
ms, mi = wi.solidity.median(), wi.ipq.median()
slope, icpt = np.polyfit(wi.N, wi.solidity, 1)
slope_i, icpt_i = np.polyfit(wi.N, wi.ipq, 1)
rec("D4_WT_N3to10_baselines", n=len(wi),
    const_median_rmse_sol=rm(wi.solidity - ms), const_median_rmse_ipq=rm(wi.ipq - mi),
    laplace_rmse_sol=rm(wi.solidity - 1), laplace_rmse_ipq=rm(wi.ipq - 1),
    linearN_rmse_sol=rm(wi.solidity - (icpt + slope * wi.N)), linearN_rmse_ipq=rm(wi.ipq - (icpt_i + slope_i * wi.N)),
    M2_intercept=float(icpt), M2_slope=float(slope), N_at_ceiling=float((1 - icpt) / slope))

# ---------- sweep ----------
S = sim.copy()
S["A0"] = (S.cyst_area - S.lumen_area) / S.n_cells
S["bad_negarea"] = S.lumen_area <= 0
S["bad_A0"] = S.A0 <= 0
S["bad_sol"] = ~((S.lumen_solidity > 0) & (S.lumen_solidity <= 1.0001))
S["ipq"] = 4 * np.pi * S.lumen_area / S.lumen_perimeter ** 2
S["bad_ipq"] = S.ipq > 1.0001
S["nonphys_design_def"] = S.bad_negarea | S.bad_sol  # "negative area or solidity outside 0..1"
rec("D5_sweep_nonphysical", neg_area=int(S.bad_negarea.sum()), A0_le0=int(S.bad_A0.sum()), sol_outside=int(S.bad_sol.sum()),
    union_neg_area_or_sol=int(S.nonphys_design_def.sum()), ipq_gt1=int(S.bad_ipq.sum()),
    union_all=int((S.bad_negarea | S.bad_A0 | S.bad_sol | S.bad_ipq).sum()))
keep = S[~(S.bad_negarea | S.bad_A0 | S.bad_sol | S.bad_ipq)].copy()
keep["la"] = keep.lumen_perimeter / (keep.n_cells * np.sqrt(keep.A0))
keep["lb"] = keep.cyst_perimeter / (keep.n_cells * np.sqrt(keep.A0))
keep["a"] = keep.lumen_area / keep.A0
keys = ["l_a", "l_l", "l_b", "P", "k"]
nset_all = S.groupby(keys).ngroups
cnt = keep.groupby(keys).n_cells.apply(lambda s: set(s.astype(int)) >= set(range(3, 11)))
rec("D6_sweep_settings", distinct_all_rows=nset_all, distinct_after_filter=keep.groupby(keys).ngroups,
    with_all_N3to10=int(cnt.sum()), reps_per_setting_N_counts=keep.groupby(keys + ["n_cells"]).size().value_counts().sort_index().head(8).to_dict())
rec("D6_sweep_identity_check_IPQ", max_abs_diff=float((keep.ipq - 4 * np.pi * keep.a / (keep.n_cells * keep.la) ** 2).abs().max()))

full = cnt[cnt].index
msim = keep.groupby(keys + ["n_cells"])[["ipq", "lumen_solidity", "a", "lb", "la"]].mean()
res = []
for s in full:
    if not (0.5 <= s[0] <= 0.9):
        continue
    m = msim.loc[s]
    mm = m.reindex(range(3, 11))
    pred = mm.loc[wi.N.values]
    e_i = pred.ipq.values - wi.ipq.values
    e_s = pred.lumen_solidity.values - wi.solidity.values
    e_a = np.log(np.maximum(pred.a.values, 1e-6)) - np.log(wi.normalized_lumen_area.values)
    e_b = pred.lb.values - wi.nondim_basal_length.values
    res.append((rm(e_i) + rm(e_s), rm(e_i), rm(e_s), rm(e_a), rm(e_b), s))
res.sort(key=lambda r: r[0])
rec("D7_best_sweep_setting_by_sol_plus_ipq", n_scored=len(res), sum=res[0][0], ipq_rmse=res[0][1], sol_rmse=res[0][2],
    setting_la_ll_lb_P_k=list(res[0][5]))
res2 = sorted(res, key=lambda r: r[3] + r[4])
rec("D7_best_sweep_setting_paper_style", logarea_rmse=res2[0][3], basal_rmse=res2[0][4], setting=list(res2[0][5]))
mla = wi.normalized_lumen_area
const_la = rm(np.log(mla) - np.median(np.log(mla)))
iso = rm(np.log(mi * wi.N ** 2 * wi.l_a ** 2 / (4 * np.pi)) - np.log(mla))
rec("D7_logarea_baselines", constant=const_la, isoperimetric_identity_with_median_IPQ=iso)

# direction of the l_a effect in the sweep
def dirn(l_l, l_b, P, k):
    out = {}
    for la0 in sorted(keep.l_a.unique()):
        sub = keep[(keep.l_a == la0) & (keep.l_l == l_l) & (keep.l_b == l_b) & (keep.P == P) & (keep.k == k)]
        if sub.n_cells.nunique() == 8:
            out[round(float(la0), 3)] = round(float(sub.groupby("n_cells").lumen_solidity.mean().mean()), 3)
    return out
rec("D8_direction_lb1.4_P0.01_k2", table=dirn(0, 1.4, 0.01, 2))
rec("D8_direction_lb1.6_P1_k1", table=dirn(0, 1.6, 1.0, 1))
json.dump(OUT, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json"), "w"), indent=1, default=float)
