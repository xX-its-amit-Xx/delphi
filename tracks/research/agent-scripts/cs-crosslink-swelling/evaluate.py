"""One command: python evaluate.py   (reads series.csv next to it; writes results.json)
Single-arm monotonicity test (deviation from prereg, see what_was_wrong): sign of Spearman rho(dose, value)
per series against the predicted sign; baseline 0.5; shuffled-label control."""
import csv, json, os, random, math, itertools
from collections import defaultdict
H = os.path.dirname(os.path.abspath(__file__))
def rank(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0]*len(v); i = 0
    while i < len(o):
        j = i
        while j+1 < len(o) and v[o[j+1]] == v[o[i]]: j += 1
        for k in range(i, j+1): r[o[k]] = (i+j)/2+1
        i = j+1
    return r
def spearman(x, y):
    a, b = rank(x), rank(y); ma, mb = sum(a)/len(a), sum(b)/len(b)
    den = math.sqrt(sum((p-ma)**2 for p in a)*sum((q-mb)**2 for q in b))
    return sum((p-ma)*(q-mb) for p, q in zip(a, b))/den if den else 0.0
S = defaultdict(list)
for r in csv.DictReader(open(os.path.join(H, "series.csv"))):
    S[(r["split"], r["system"], r["source"], r["series"], r["quantity"], r["predicted_sign"])].append((float(r["dose"]), float(r["value"])))
def score(split, shuffle_seed=None):
    rng = random.Random(shuffle_seed); out = []
    for k, pts in sorted(S.items()):
        if k[0] != split or len(pts) < 3: continue
        d = [p[0] for p in pts]; v = [p[1] for p in pts]
        if shuffle_seed is not None: rng.shuffle(v)
        rho = spearman(d, v); ok = (rho > 0) if k[5] == "+" else (rho < 0)
        out.append({"series": "|".join(k[2:5]), "n_doses": len(pts), "rho": round(rho, 3), "strict": abs(rho) == 1.0, "predicted_sign_ok": ok})
    return out
def binom_p(k, n): return sum(math.comb(n, i) for i in range(k, n+1))/2**n
res = {}
for split in ("dev", "held"):
    o = score(split); k = sum(x["predicted_sign_ok"] for x in o); n = len(o)
    sh = [sum(x["predicted_sign_ok"] for x in score(split, s))/n for s in range(1000)]
    res[split] = {"n_series": n, "n_sign_ok": k, "fraction": round(k/n, 3), "n_strictly_monotone": sum(x["strict"] and x["predicted_sign_ok"] for x in o),
                  "baseline_coin": 0.5, "one_sided_sign_test_p": round(binom_p(k, n), 4),
                  "shuffled_mean_fraction": round(sum(sh)/len(sh), 3), "shuffled_frac_runs_ge_observed": round(sum(f >= k/n for f in sh)/len(sh), 3), "series": o}
res["exponent_test_Q_vs_G"] = "NOT OBTAINED: no held-out (or dev) source gave swelling and modulus numerically at the same >=3 doses."
json.dump(res, open(os.path.join(H, "results.json"), "w"), indent=1)
for s in ("dev", "held"):
    r = res[s]; print(s, {k: v for k, v in r.items() if k != "series"})
    for x in r["series"]: print("   ", x)
print(res["exponent_test_Q_vs_G"])
