# (1) Derivation check: if repressor R = c*x (c = RBS translation multiplier) and promoter output is a Hill function of R,
#     then curve with multiplier c equals curve with c=1 evaluated at c*x  => K scales as 1/c, n unchanged.
# (2) From shipped data: how much do ymax and ymin change inside in-scope RBS pairs (a pure translation would keep them fixed)?
# Run: python translation_law.py  (needs numpy, scipy)
import sys, json, math
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from scipy.optimize import curve_fit
hill = lambda x, ymax, ymin, K, n: ymin + (ymax-ymin)/(1+(np.abs(x)/K)**n)
x = np.logspace(-3, 1, 60)
K0, n0, ymax, ymin = 0.2, 2.8, 2.0, 0.05
print("(1) synthetic check of K -> K/c, n fixed")
for c in (0.25, 2, 10):
    y = hill(c*x, ymax, ymin, K0, n0)      # R proportional to c*x
    p, _ = curve_fit(lambda xx, K, n: hill(xx, ymax, ymin, K, n), x, y, p0=(0.1, 2))
    print(f"  c={c:5}: fitted K={p[0]:.4f} (expect {K0/c:.4f}), n={p[1]:.4f} (expect {n0})")
# max |error| of exact translation identity y_c(x) == y_1(c x)
print("  identity max abs error:", float(np.max(np.abs(hill(3*x,ymax,ymin,K0,n0) - hill(x*3,ymax,ymin,K0,n0)))))
print("(2) ymax,ymin ratios within in-scope RBS pairs (shipped values)")
D = r"D:/Users/ashenoy00000/delphi-work/data/t1-deep/"
pairs = json.load(open(r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-deep/pairs.json"))
for L in ("Eco1C1G1T1", "Eco1C2G2T2"):
    d = json.load(open(D+L+".UCF.json"))
    mod = {m["name"]: {p["name"]: p["value"] for p in m["parameters"]} for m in d if m.get("collection")=="models"}
    rs = []
    for p in pairs[L]["pairs"]:
        if p["kind"]=="one-position" and p["diff_types"]==["rbs"] and p["Kfold"]>=2:
            a, b = mod[p["a"]+"_model"], mod[p["b"]+"_model"]
            rs.append((max(a["ymax"],b["ymax"])/min(a["ymax"],b["ymax"]), max(a["ymin"],b["ymin"])/min(a["ymin"],b["ymin"])))
    print(f"  {L}: n_pairs={len(rs)} ymax ratio median={np.median([r[0] for r in rs]):.2f} max={max(r[0] for r in rs):.2f}; ymin ratio median={np.median([r[1] for r in rs]):.2f} max={max(r[1] for r in rs):.2f}")
