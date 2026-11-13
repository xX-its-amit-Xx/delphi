# Pair analysis of RBS-only variants in Cello UCF libraries. Run: python -I pairs.py   (reads data/t1-deep/*.UCF.json, writes scratch/pairs.json)
import sys, json, math, itertools, os
sys.stdout.reconfigure(encoding="utf-8")
D = r"D:/Users/ashenoy00000/delphi-work/data/t1-deep/"
OUT = r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-deep/pairs.json"
libs = ["Eco1C1G1T1","Eco1C2G2T2","Eco2C1G3T1","Eco2C1G5T1","SC1C1G1T1"]
res = {}
for L in libs:
    d = json.load(open(D+L+".UCF.json"))
    col = lambda c: [x for x in d if x.get("collection")==c]
    ptype = {p["name"]: p["type"] for p in col("parts")}
    struct = {s["name"]: s for s in col("structures")}
    model = {m["name"]: {p["name"]: p["value"] for p in m["parameters"]} for m in col("models")}
    gates = {}
    for g in col("gates"):
        s = struct[g["structure"]]
        cas = [dv for dv in s["devices"] if "cassette" in dv["name"]][0]["components"]
        p = model[g["model"]]
        gates[g["name"]] = dict(regulator=g["regulator"], group=g["group"], cassette=cas, K=p["K"], n=p["n"], ymax=p["ymax"], ymin=p["ymin"])
    pairs = []
    for a, b in itertools.combinations(sorted(gates), 2):
        A, B = gates[a], gates[b]
        if A["regulator"] != B["regulator"] or A["group"] != B["group"]: continue
        if len(A["cassette"]) != len(B["cassette"]): kind = "length-differs"; diff = None
        else:
            diff = [i for i,(x,y) in enumerate(zip(A["cassette"],B["cassette"])) if x!=y]
            kind = "one-position" if len(diff)==1 else f"{len(diff)}-positions"
        dtypes = [ptype[A["cassette"][i]] for i in diff] if diff is not None else None
        n1, n2 = A["n"], B["n"]
        dn = abs(n1-n2)/((n1+n2)/2)
        kf = max(A["K"],B["K"])/min(A["K"],B["K"])
        pairs.append(dict(a=a,b=b,kind=kind,diff_types=dtypes,diff_parts=[(A["cassette"][i],B["cassette"][i]) for i in diff] if diff else None,
                          Ka=A["K"],Kb=B["K"],na=n1,nb=n2,dn=round(dn,4),Kfold=round(kf,3),S=(round(math.log2(kf)/dn,2) if dn>0 else None)))
    inscope = [p for p in pairs if p["kind"]=="one-position" and p["diff_types"]==["rbs"] and p["Kfold"]>=2.0]
    res[L] = dict(n_gates=len(gates), n_same_regulator_pairs=len(pairs), n_one_position_rbs=sum(1 for p in pairs if p["kind"]=="one-position" and p["diff_types"]==["rbs"]),
                  n_inscope=len(inscope), pairs=pairs,
                  max_dn_inscope=max([p["dn"] for p in inscope], default=None),
                  max_dn_all_same_reg=max([p["dn"] for p in pairs], default=None),
                  n_range=(min(g["n"] for g in gates.values()), max(g["n"] for g in gates.values())),
                  K_range=(min(g["K"] for g in gates.values()), max(g["K"] for g in gates.values())))
    print("==",L,{k:v for k,v in res[L].items() if k!="pairs"})
    for p in pairs: print("  ",p["a"],p["b"],p["kind"],p["diff_types"],p["diff_parts"],"Kfold",p["Kfold"],"dn",p["dn"],"S",p["S"])
json.dump(res, open(OUT,"w"), indent=1)
