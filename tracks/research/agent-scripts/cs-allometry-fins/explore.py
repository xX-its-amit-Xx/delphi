#!/usr/bin/env python
"""EXPLORATORY, POST HOC (not pre-registered): apply the Lean-checked identity St = alpha*(b + a/u)
with a, b from the development Bainbridge fit and alpha = development median A/L, then compare with
observed St. Run after run.py:  python -P -E explore.py"""
import json, os, statistics, math, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run
recs, _ = run.load("C:/Temp/delphi-sprint/cs-allometry-fins/raw")
m = json.load(open(os.path.join(run.HERE, "results_dev.json")))["model"]
a, b = m["a"], m["b"]
st = [r for r in recs if "St" in r]
dev = [r for r in st if not r["held"]]; ho = [r for r in st if r["held"]]
alpha = statistics.median(r["A"] / r["L"] for r in dev)
out = {"a": round(a, 3), "b": round(b, 3), "alpha_dev_median_A_over_L": round(alpha, 3),
       "alpha_dev_quartiles": [round(q, 3) for q in statistics.quantiles([r["A"] / r["L"] for r in dev], n=4)],
       "St_floor_alpha_b": round(alpha * b, 3),
       "speed_below_which_St_exceeds_0.4_BLs": round(alpha * a / (0.4 - alpha * b), 3)}
for tag, rows in (("dev", dev), ("heldout", ho)):
    pred = [alpha * (b + a / r["ubl"]) for r in rows]; obs = [r["St"] for r in rows]
    mean_dev = statistics.mean(r["St"] for r in dev)
    out[tag] = {"n": len(rows), "rmse_identity": round(run.rmse(pred, obs), 3),
                "rmse_constant_dev_mean_St": round(run.rmse([mean_dev] * len(obs), obs), 3),
                "spearman_pred_obs": round(run.spearman(pred, obs), 3),
                "spearman_St_vs_speed": round(run.spearman([r["ubl"] for r in rows], obs), 3),
                "ubl_range": [round(min(r["ubl"] for r in rows), 2), round(max(r["ubl"] for r in rows), 2)]}
# larval zebrafish numbers quoted in van Leeuwen et al. 2015 abstract (PMID 26269230)
out["larva_abstract_check"] = {"f_Hz": 95, "A_mm": 2.4, "St_low_end": 0.72, "implied_U_mm_s": round(95 * 2.4 / 0.72, 1),
                               "St_range_reported": [0.72, 2.5], "inside_0.2_0.4": False}
json.dump(out, open(os.path.join(run.HERE, "results_explore.json"), "w"), indent=1); print(json.dumps(out, indent=1))
