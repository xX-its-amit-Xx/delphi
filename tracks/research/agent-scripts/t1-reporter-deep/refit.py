# Refit Hill parameters from shipped single-cell cytometry histograms (median of log-binned output mass), compare with shipped K,n.
# Run: python -I refit.py ; needs numpy, scipy. Reads data/t1-deep/*.UCF.json and scratch/pairs.json
import sys, json, math, itertools
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from scipy.optimize import least_squares
D = r"D:/Users/ashenoy00000/delphi-work/data/t1-deep/"
S = r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-deep/"
pairs = json.load(open(S+"pairs.json"))
out = {}
LOSS = sys.argv[1] if len(sys.argv)>1 else "linear"   # "linear" or "soft_l1" (robust to a mislabelled input level)
for L in ["Eco1C1G1T1","Eco1C2G2T2","SC1C1G1T1"]:
    d = json.load(open(D+L+".UCF.json"))
    models = {m["name"]: {p["name"]: p["value"] for p in m["parameters"]} for m in d if m.get("collection")=="models"}
    cyto = {f["name"]: f["table"] for f in d if f.get("collection")=="functions" and f["name"].endswith("_cytometry")}
    fit = {}
    for g in [x for x in d if x.get("collection")=="gates"]:
        t = cyto[g["name"]+"_cytometry"] if g["name"]+"_cytometry" in cyto else None
        if t is None: continue
        xs, ms = [], []
        for r in t:
            b = np.array(r["bin"]); w = np.array(r["output"]); w = w/w.sum()
            c = np.cumsum(w); ms.append(float(b[np.searchsorted(c, 0.5)])); xs.append(r["x"])
        xs, ms = np.array(xs), np.array(ms)
        def resid(p):
            ymax, ymin, K, n = p
            return np.log10(ymin + (ymax-ymin)/(1+(xs/K)**n)) - np.log10(ms)
        p0s = [(ms.max(), ms.min(), K0, n0) for K0 in (0.03,0.1,0.3) for n0 in (1.5,3,5)]
        best = None
        for p0 in p0s:
            try:
                r = least_squares(resid, p0, bounds=([1e-3,1e-4,1e-3,0.5],[50,5,10,12]), loss=LOSS, f_scale=0.1)
                if best is None or r.cost < best.cost: best = r
            except Exception: pass
        ship = models[g["model"]]
        fit[g["name"]] = dict(K=float(best.x[2]), n=float(best.x[3]), ymax=float(best.x[0]), ymin=float(best.x[1]), cost=float(best.cost), shipK=ship["K"], shipn=ship["n"])
    # in-scope pair stats from refit
    rows = []
    for p in out_pairs if False else pairs[L]["pairs"]:
        if p["kind"]=="one-position" and p["diff_types"]==["rbs"] and p["Kfold"]>=2.0 and p["a"] in fit and p["b"] in fit:
            a, b = fit[p["a"]], fit[p["b"]]
            dn = abs(a["n"]-b["n"])/((a["n"]+b["n"])/2); kf = max(a["K"],b["K"])/min(a["K"],b["K"])
            rows.append(dict(a=p["a"], b=p["b"], ship_dn=p["dn"], refit_dn=round(dn,4), ship_Kfold=p["Kfold"], refit_Kfold=round(kf,3)))
    nship = np.array([v["shipn"] for v in fit.values()]); nre = np.array([v["n"] for v in fit.values()])
    corr = float(np.corrcoef(nship, nre)[0,1]) if len(fit)>2 else None
    Kc = float(np.corrcoef(np.log([v["shipK"] for v in fit.values()]), np.log([v["K"] for v in fit.values()]))[0,1]) if len(fit)>2 else None
    out[L] = dict(n_fitted=len(fit), corr_n_ship_vs_refit=corr, corr_logK=Kc, rows=rows, max_refit_dn=max([r["refit_dn"] for r in rows], default=None), fit=fit)
    print("==", L, "fitted", len(fit), "corr n", corr, "corr logK", Kc, "max refit dn", out[L]["max_refit_dn"])
    for r in rows: print("  ", r)
    for k, v in list(fit.items())[:6]: print("   ", k, {a: round(b,3) for a,b in v.items()})
json.dump(out, open(S+"refit_"+LOSS+".json","w"), indent=1)
