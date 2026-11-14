import json, math
out = {}
# V1 Euler mean-six; counts quoted in PMC4048254 (doi 10.1186/1742-4682-11-26)
for name, c in {"Drosophila_wing_disc": {4:64,5:606,6:993,7:437,8:69,9:3}, "Cucumis": {4:20,5:251,6:474,7:224,8:30,9:1}}.items():
    N = sum(c.values()); mean = sum(k*v for k,v in c.items())/N
    mu2 = sum(v*(k-6)**2 for k,v in c.items())/N
    out[name] = {"N": N, "mean_sides": round(mean,4), "abs_dev_from_6": round(abs(mean-6),4),
                 "frac": {k: round(v/N,4) for k,v in c.items()}, "mu2": round(mu2,4),
                 "pass_mean_within_0.1": abs(mean-6) < 0.1}
# V2 Laplace thin-wall applicability, otic vesicle PMC6773445 (doi 10.7554/eLife.39596)
def r_um(v_pl): return (3*v_pl*1000/(4*math.pi))**(1/3)   # 1 pl = 1000 um^3
for tag, V, h, P in [("early", 235, 20, 100), ("late", 807, 4, 300)]:
    R = r_um(V); out["otic_"+tag] = {"R_um_equiv_sphere": round(R,1), "h_um": h, "h_over_R": round(h/R,3),
        "thin_wall_ok(h/R<0.1)": h/R < 0.1, "sigma_Pa=PR/2h": round(P*R/(2*h),0)}
# V3 Kupffer vesicle threshold PMC5434515 (doi 10.1002/dvdy.24355)
out["KV"] = {"threshold_um2": 1300, "wt_mean_um2": 3127, "ratio": round(3127/1300,2), "wt_mean_above_threshold": 3127 > 1300}
json.dump(out, open(__file__.replace("validate.py","results.json"),"w"), indent=1); print(json.dumps(out, indent=1))
