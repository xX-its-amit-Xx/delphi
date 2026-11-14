#!/usr/bin/env python3
"""Track 1 (issue #17): RBS-swap separability score on a Cello UCF library.

Proposed repo path: tracks/scripts/score-rbs-separability.py

Rule (as stated in tracks/research/agents/t1-reporter-deep.json):
  among pairs of gates with the same repressor whose cassettes differ at
  exactly one position, that position being the RBS, and whose K differs at
  least 2-fold, report dn = |n1 - n2| / mean(n1, n2).  Frozen bound: max dn <= 0.25.

Uses the SHIPPED Hill parameters in the UCF (no re-fit of cytometry).
Usage: python score-rbs-separability.py <UCF.json> [bound]
"""
import hashlib
import itertools
import json
import sys

path = sys.argv[1]
bound = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
raw = open(path, "rb").read()
ucf = json.loads(raw.decode("utf-8"))
by = lambda c: {x["name"]: x for x in ucf if x.get("collection") == c}
gates, models, structs, parts = by("gates"), by("models"), by("structures"), by("parts")


def cassette(g):
    s = structs[g["structure"]]
    devs = {d["name"]: d["components"] for d in s["devices"]}
    out = []
    for comps in devs.values():
        for c in comps:
            if not c.startswith("#") and c not in devs:
                out.append(c)
    return out


def params(g):
    return {p["name"]: p["value"] for p in models[g["model"]]["parameters"]}


rows = []
for a, b in itertools.combinations(sorted(gates), 2):
    ga, gb = gates[a], gates[b]
    if ga["regulator"] != gb["regulator"]:
        continue
    ca, cb = cassette(ga), cassette(gb)
    if len(ca) != len(cb):
        continue
    diff = [i for i in range(len(ca)) if ca[i] != cb[i]]
    if len(diff) != 1:
        continue
    ta = parts.get(ca[diff[0]], {}).get("type")
    tb = parts.get(cb[diff[0]], {}).get("type")
    if ta != "rbs" or tb != "rbs":
        continue
    pa, pb = params(ga), params(gb)
    kfold = max(pa["K"], pb["K"]) / min(pa["K"], pb["K"])
    dn = abs(pa["n"] - pb["n"]) / ((pa["n"] + pb["n"]) / 2)
    rows.append(dict(a=a, b=b, K_a=pa["K"], K_b=pb["K"], K_fold=round(kfold, 4),
                     n_a=pa["n"], n_b=pb["n"], dn=round(dn, 4),
                     counted=kfold >= 2.0))

counted = [r for r in rows if r["counted"]]
mx = max((r["dn"] for r in counted), default=None)
print(json.dumps({
    "file": path, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
    "rbs_only_pairs": len(rows), "pairs_with_K_fold_ge_2": len(counted),
    "max_dn": mx, "bound": bound,
    "verdict": None if mx is None else ("PASS" if mx <= bound else "FAIL"),
    "pairs": rows}, indent=1))
