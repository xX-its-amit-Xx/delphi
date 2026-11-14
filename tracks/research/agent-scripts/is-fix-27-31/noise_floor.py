"""Issue #27: noise floor and variance split on a small public ChEMBL sample.
Goes to: tracks/scripts/affinity_noise_floor.py
Input: ChEMBL activity JSON pages (Ki, relation '=', pchembl present) for a few targets,
fetched from https://www.ebi.ac.uk/chembl/api/data/activity.json?target_chembl_id=...&standard_type=Ki&limit=1000
Usage: python -I noise_floor.py egfr_ki.json fxa_ki.json
"""
import json, sys, math, itertools, collections, statistics as st
rows = []
for f in sys.argv[1:]:
    d = json.load(open(f, encoding="utf-8"))
    tot = d["page_meta"]["total_count"]
    for a in d["activities"]:
        rows.append((f, a["molecule_chembl_id"], a["document_chembl_id"], a["assay_chembl_id"], float(a["pchembl_value"])))
    print(f, "rows", len(d["activities"]), "of total", tot)
# 1. noise: same compound, same target, DIFFERENT document; exclude exact duplicates (likely re-citations)
by = collections.defaultdict(dict)
for f, m, doc, assay, p in rows:
    by[(f, m)].setdefault(doc, []).append(p)
diffs, diffs_nodup = [], []
for k, docs in by.items():
    means = [st.mean(v) for v in docs.values()]
    for x, y in itertools.combinations(means, 2):
        diffs.append(x - y)
        if abs(x - y) > 1e-9: diffs_nodup.append(x - y)
def s_from(d):  # sd of a single measurement: var(diff) = 2 s^2
    return math.sqrt(sum(x * x for x in d) / len(d) / 2) if d else float("nan")
print("cross-document pairs", len(diffs), "s =", round(s_from(diffs), 3), "| excluding identical values:", len(diffs_nodup), "s =", round(s_from(diffs_nodup), 3))
# 2. variance split: between target vs within target (one mean per compound-target pair)
pair = {k: st.mean([p for v in docs.values() for p in v]) for k, docs in by.items()}
allv = list(pair.values()); g = st.mean(allv); vt = st.pvariance(allv)
groups = collections.defaultdict(list)
for (f, m), v in pair.items(): groups[f].append(v)
between = sum(len(v) * (st.mean(v) - g) ** 2 for v in groups.values()) / len(allv)
print("pairs", len(allv), "total var", round(vt, 3), "between-target share", round(between / vt, 3), "within", round(1 - between / vt, 3))
for f, v in groups.items(): print(" ", f, "n", len(v), "mean", round(st.mean(v), 2), "sd", round(st.pstdev(v), 2))
# 3. attenuation ceiling r_max = sqrt(var_true/(var_true+s^2)), observed var = var_true + s^2
for name, s in (("this sample (all pairs)", s_from(diffs)), ("this sample (no identical)", s_from(diffs_nodup)), ("Kramer 2012 Ki sd 0.54", 0.54), ("Landrum&Riniker 2024 approx 0.7?", None)):
    if s is None or s != s: continue
    for f, v in groups.items():
        vo = st.pvariance(v); vtrue = max(vo - s * s, 0)
        print(name, f, "within-target r_max =", round(math.sqrt(vtrue / vo), 3), "R2_max =", round(vtrue / vo, 3))
