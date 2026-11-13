"""Compare one local lumen_vm.py run (03_run_lumen_vm.py output JSON on stdin or file) with the published sweep rows
at the same (l_a,l_l,l_b,P,k) setting. Usage: python -P 04_compare_sim.py run.json [DATA_DIR]"""
import sys, json, numpy as np, pandas as pd
run = json.load(open(sys.argv[1]))
D = sys.argv[2] if len(sys.argv) > 2 else "D:/Users/ashenoy00000/delphi-work/data/t3-vasquez"
S = pd.read_excel(D + "/raw/lumen_manuscript_figure5_SF5.xlsx")
sub = S[(S.l_a == 0.6) & (S.l_l == 0) & (S.l_b == 1.6) & (S.P == 1.0) & (S.k == 1.0)].copy()
sub["ipq"] = 4*np.pi*sub.lumen_area/sub.lumen_perimeter**2
g = sub.groupby("n_cells").agg(reps=("ipq", "size"), ipq_mean=("ipq", "mean"), ipq_min=("ipq", "min"), ipq_max=("ipq", "max"),
                               sol_mean=("lumen_solidity", "mean"), area_mean=("lumen_area", "mean"))
print("published rows at this setting:", len(sub)); print(g.round(3).to_string())
r = pd.DataFrame(run["rows"]).sort_values("n")
print("local run (status=%s, %s s):" % (run["status"], run["seconds"])); print(r[["n", "lumen_area", "lumen_perim", "ipq"]].round(3).to_string())
for _, x in r.iterrows():
    n = int(x.n)
    if n in g.index:
        inside = g.loc[n, "ipq_min"] <= x.ipq <= g.loc[n, "ipq_max"]
        print("N=%d local IPQ %.3f; published range %.3f..%.3f -> %s" % (n, x.ipq, g.loc[n, "ipq_min"], g.loc[n, "ipq_max"], "inside" if inside else "OUTSIDE"))
