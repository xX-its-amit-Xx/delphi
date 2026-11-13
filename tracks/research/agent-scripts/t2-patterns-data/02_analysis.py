"""Step 2: reproduce the earlier agents' pilot numbers from Cremer 2019 source data.
Usage: python -P 02_analysis.py [DATA_DIR] [OUT_JSON]
Needs: Python 3.10+, openpyxl 3.1.x, numpy, scipy (scipy only for the slope CI t-quantile).
Reads only seen/MOESM11.xlsx, seen/MOESM22.xlsx, seen/MOESM3.txt. Never opens quarantined/.
"""
import json, math, re, sys
import numpy as np
import openpyxl
from scipy import stats

DATA = sys.argv[1] if len(sys.argv) > 1 else "D:/Users/ashenoy00000/delphi-work/data/cremer2019"
OUT = sys.argv[2] if len(sys.argv) > 2 else "D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-data/analysis_results.json"
R = {}

# ---------- load ED Fig 1c (MOESM11) by header name, not by position ----------
ws = openpyxl.load_workbook(f"{DATA}/seen/MOESM11.xlsx", data_only=True).active
hdr = [c.value for c in ws[2]]
col = {h: i for i, h in enumerate(hdr)}
rows = []
for r in ws.iter_rows(min_row=3, values_only=True):
    if r[0] and r[col["Mean ES mm/hr"]] is not None:
        rows.append(dict(strain=r[col["genotype"]], carbon=r[col["carbon"]], ind=r[col["inducer.conc µM"]],
                         att=r[col["attractant"]], u=r[col["Mean ES mm/hr"]], nES=r[col["n ES"]],
                         g=r[col["Mean GR 1/hr"]], nGR=r[col["n GR"]], sheet_row=r[0]))
# sheet row numbers: recompute (1-based) for traceability
for i, d in enumerate(rows):
    d["sheet_row"] = i + 3
R["n_rows_ed1c"] = len(rows)

def sel(strain, att, carbon=None):
    return [d for d in rows if d["strain"] == strain and d["att"] == att and (carbon is None or d["carbon"] == carbon)]

wt = [d for d in rows if d["strain"] == "wt" and d["att"] == "Aspartate"]          # sheet rows 3-8
glpFK = [d for d in rows if d["strain"] == "Pu-glpFK" and d["att"] == "Aspartate"]  # rows 15-19
glpFK_ser = [d for d in rows if d["strain"] == "Pu-glpFK" and d["att"] == "Serine"]
ptsG1 = [d for d in rows if d["strain"] == "Pu-ptsG1"]
ptsG2 = [d for d in rows if d["strain"] == "Pu-ptsG2"]
glpK22 = sel("glpK22", "Aspartate")[0]
R["wt_rows"] = [(d["sheet_row"], d["carbon"], d["u"], d["g"]) for d in wt]
assert [d["sheet_row"] for d in wt] == [3, 4, 5, 6, 7, 8]

def ols(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    b = np.sum((x - x.mean()) * (y - y.mean())) / np.sum((x - x.mean()) ** 2)
    return b, y.mean() - b * x.mean()

def ll(ds, ux="g"):
    return ols(np.log([d[ux] for d in ds]), np.log([d["u"] for d in ds]))[0]

def ll_ci(ds):
    x = np.log([d["g"] for d in ds]); y = np.log([d["u"] for d in ds]); n = len(x)
    b, a = ols(x, y); res = y - (a + b * x)
    se = math.sqrt(np.sum(res ** 2) / (n - 2) / np.sum((x - x.mean()) ** 2))
    t = stats.t.ppf(0.975, n - 2)
    return b, b - t * se, b + t * se, se

# ---------- (1) k on 6 WT rows ----------
u = np.array([d["u"] for d in wt]); g = np.array([d["g"] for d in wt])
k = float(np.sum(u * u * g) / np.sum(g * g))            # LSQ through origin of u^2 = k g
R["k_mm2_per_h"] = k
R["u2_over_r_each"] = [round(float(x), 2) for x in u * u / g]
R["k_alt_mean_of_ratios"] = float(np.mean(u * u / g))
R["k_alt_ols_u2_on_g_with_intercept"] = ols(g, u * u)

# ---------- (2) held-out error of u = sqrt(k r) ----------
def pred(d): return math.sqrt(k * d["g"])
held = {}
for name, ds in (("Pu-ptsG1", ptsG1), ("Pu-ptsG2", ptsG2), ("glpK22", [glpK22]),
                 ("Pu-glpFK asp", glpFK), ("Pu-glpFK ser", glpFK_ser)):
    held[name] = [(d["ind"], round(pred(d), 3), round(d["u"], 3), round(100 * (pred(d) / d["u"] - 1), 1)) for d in ds]
R["heldout_sqrt_law (inducer, pred, meas, pct_err)"] = held
six = [e for n in ("Pu-ptsG1", "Pu-ptsG2", "glpK22") for e in held[n]]
R["scout_six_heldout_abs_pct_range"] = (min(abs(e[3]) for e in six), max(abs(e[3]) for e in six), len(six))
allh = [e for n in held for e in held[n]]
R["all_heldout_n"] = len(allh)
R["all_heldout_abs_pct_range"] = (min(abs(e[3]) for e in allh), max(abs(e[3]) for e in allh))
R["all_heldout_within15pct"] = sum(abs(e[3]) <= 15 for e in allh)

# ---------- (3) log-log slopes of u on r ----------
R["slope_u_on_r"] = {
    "WT 6 carbon": ll(wt),
    "Pu-glpFK asp 5pt": ll(glpFK), "Pu-glpFK asp 4pt (no 0 uM inducer)": ll(glpFK[1:]),
    "Pu-glpFK ser 3pt": ll(glpFK_ser), "Pu-ptsG2 3pt": ll(ptsG2)}
b, lo, hi, se = ll_ci(glpFK); R["glpFK5_slope_ci95"] = (b, lo, hi, se)
b, lo, hi, se = ll_ci(glpFK[1:]); R["glpFK4_slope_ci95"] = (b, lo, hi, se)
b, lo, hi, se = ll_ci(wt); R["wt6_slope_ci95"] = (b, lo, hi, se)
R["n_for_glpFK_rows"] = [(d["ind"], d["nES"], d["nGR"]) for d in glpFK]
R["n_ES_eq_1_or_2_rows_in_ed1c"] = sum(d["nES"] <= 2 for d in rows)

# ---------- (4) dose series (MOESM22) ----------
ws2 = openpyxl.load_workbook(f"{DATA}/seen/MOESM22.xlsx", data_only=True).active
h2 = [c.value for c in ws2[2]]
dose = {"glucose": [], "glycerol": []}
for r in ws2.iter_rows(min_row=3, values_only=True):
    if r[2] == "HE206":
        key = "glucose" if "glucose" in r[4] else "glycerol"
        dose[key].append((r[6], r[8], r[10]))
R["dose_n_points"] = {k_: len(v) for k_, v in dose.items()}
R["dose"] = dose
sl = {}
for key, v in dose.items():
    d = {c: u_ for c, u_, n in v}
    two = math.log(d[100] / d[10]) / math.log(10)
    conc = [10, 30, 50, 100]
    b4 = ols(np.log(conc), np.log([d[c] for c in conc]))[0]
    peak = max(d, key=d.get)
    sl[key] = dict(two_point_10_100=two, ols_10_30_50_100=float(b4), peak_conc_uM=peak, peak_u=d[peak], u_10000=d[10000])
R["dose_slopes"] = sl
R["sqrt_law_predicts_ratio_u100_over_u10"] = math.sqrt(10)
R["observed_ratio_u100_over_u10"] = {k_: dose[k_][3][1] / dose[k_][0][1] for k_ in dose}
# consistency: dose row at 100 uM equals ED1c rows
R["dose100_matches_ED1c"] = (abs(dose["glucose"][3][1] - wt[3]["u"]) < 1e-9, abs(dose["glycerol"][3][1] - wt[4]["u"]) < 1e-9)
# simulated curve in MOESM22 columns A,B (ED8b)
sim = [(r[0], r[1]) for r in ws2.iter_rows(min_row=3, max_row=16, values_only=True) if isinstance(r[0], (int, float))]
R["ED8b_sim_curve_first_last"] = (sim[0], sim[-1], len(sim))

# ---------- (5) Narla closed form with parameters from MOESM3 ----------
txt = open(f"{DATA}/seen/MOESM3.txt", encoding="utf-8", errors="replace").read()
blk = txt[txt.index("{"): txt.index("}") + 1]
P = json.loads(blk)
um2s_to_mm2h = 3.6e-3                       # 1 um^2/s = 1e-6 mm^2 * 3600 /h
D = P["D_chemotaxis_1"] * 1e12 * um2s_to_mm2h
Da = P["D_nutrients"] * 1e12 * um2s_to_mm2h
chi = P["xhi_1"] * 1e12 * um2s_to_mm2h
R["params_um2s"] = dict(D_rho=P["D_chemotaxis_1"] * 1e12, D_a=P["D_nutrients"] * 1e12, chi0=P["xhi_1"] * 1e12,
                        a_m_uM=P["weber_offset_1"] * 1000, a_max_uM=P["weber_offsetmax_1"] * 1000)
A = 100.0                                    # a0/a_m for 100 uM / 1 uM
Xpub = chi - D
R["X_published_mm2h"] = Xpub
R["c_published_at_r0.9985"] = Xpub * math.sqrt(0.9985 * A / (Xpub + Da))
R["c_pub_pct_above_measured_4.3347"] = 100 * (R["c_published_at_r0.9985"] / wt[3]["u"] - 1)
bb = k / A
Xfit = (bb + math.sqrt(bb * bb + 4 * bb * Da)) / 2   # solves X^2 A/(X+Da) = k
R["X_fit_mm2h"] = Xfit
R["X_fit_um2s"] = Xfit / um2s_to_mm2h
R["chi0_fit_um2s"] = Xfit / um2s_to_mm2h + P["D_chemotaxis_1"] * 1e12
R["phi_fit"] = Xfit / D
R["phi_pub"] = Xpub / D
R["check_fit_k"] = Xfit ** 2 * A / (Xfit + Da)
R["dlnc_dlnD_fixed_phi"] = {"fit": 1 - 0.5 * Xfit / (Xfit + Da), "pub": 1 - 0.5 * Xpub / (Xpub + Da)}
R["bulge_rise_length_mm_at_c4.335"] = {"fit": Xfit / 4.3347, "pub": Xpub / 4.3347}
# dependence of the closed form on attractant: ratio u(100)/u(10) = sqrt(10) at fixed X
# ---------- (6) F2/F3/F4 arithmetic ----------
R["L_G_mm"] = {"glycerol+asp": 3.67462190077778 / 0.7735, "glucose+asp": 4.3347312336 / 0.9985, "glycerol+ser": 4.20332693366667 / 0.7695}
ser = {d["carbon"]: d for d in rows if d["att"] == "Serine"}
F4 = {}
def mix(a, b): return (max(a, b), math.hypot(a, b))
F4["wt glycerol"] = mix(wt[4]["u"], ser["40mM glycerol"]["u"]) if "40mM glycerol" in ser else None
R["F4_max_quadrature"] = {
    "wt glycerol": mix(wt[4]["u"], 4.20332693366667),
    "glpK22": mix(glpK22["u"], 5.8458949725),
    "Pu-glpFK 10/50/800": [mix(a["u"], s["u"]) for a, s in zip([glpFK[1], glpFK[3], glpFK[4]], glpFK_ser)]}
R["F3_uptake_density_ratios_vs_1.02"] = [1.02 / x for x in (0.731, 0.687, 0.358)]
# F1: alpha window for s_pred in [0.9,1.12+-0.2]
cf = R["dlnc_dlnD_fixed_phi"]["fit"]
# s_pred = 0.5 + cf*alpha must lie within +-0.20 of s_obs (design F1 refutation rule)
R["F1_alpha_window"] = {"s_obs=1.12 (5pt)": ((1.12 - 0.2 - 0.5) / cf, (1.12 + 0.2 - 0.5) / cf),
                        "s_obs=0.90 (4pt)": ((0.894670 - 0.2 - 0.5) / cf, (0.894670 + 0.2 - 0.5) / cf)}

def clean(o):
    if isinstance(o, (np.floating,)): return float(o)
    if isinstance(o, dict): return {str(k_): clean(v) for k_, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    return o
R = clean(R)
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(R, open(OUT, "w"), indent=1)
print(json.dumps(R, indent=1))
