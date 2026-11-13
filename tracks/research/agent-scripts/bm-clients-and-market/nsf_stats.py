"""Median NSF SBIR/STTR award sizes from the saved NSF API JSON files (all keyword files, de-duplicated by award id)."""
import json, glob, statistics, re
D = r"D:/Users/ashenoy00000/delphi-work/data/bm-clients-market/nsf/*.json"
seen = {}
for f in glob.glob(D):
    for a in json.load(open(f, encoding="utf-8")).get("response", {}).get("award", []):
        seen[a["id"]] = a
groups = {}
for a in seen.values():
    m = re.match(r"(SBIR|STTR) (Phase I|Phase II|Fast-Track)\b", a["title"].strip())
    if m and a.get("estimatedTotalAmt"):
        groups.setdefault(m.group(1)+" "+m.group(2), []).append(int(a["estimatedTotalAmt"]))
    elif a["title"].startswith("I-Corps") and a.get("estimatedTotalAmt"):
        groups.setdefault("I-Corps", []).append(int(a["estimatedTotalAmt"]))
print("distinct awards", len(seen))
for k, v in sorted(groups.items()):
    print(k, "n=%d" % len(v), "min", min(v), "median", statistics.median(v), "max", max(v))
