"""Check sources.json and write table.md.  Usage: python -I build_table.py sources.json table.md"""
import json
import sys

src, out = sys.argv[1], sys.argv[2]
with open(src, encoding="utf-8") as f:
    data = json.load(f)

allowed = set(data["status_key"])
bad = []
counts = {}
lines = [
    "# Linker biomaterials: numbers and where they came from",
    "",
    "Opened on %s. Status: " % data["opened_on"]
    + "; ".join("**%s** = %s" % kv for kv in data["status_key"].items()),
    "",
]
topic = None
for i, r in enumerate(data["rows"]):
    st = r.get("status")
    if st not in allowed:
        bad.append("row %d: bad status %r" % (i, st))
    where = r.get("doi") or r.get("url") or ""
    if st in ("opened", "abstract") and not where:
        bad.append("row %d: %s row has no doi/url" % (i, st))
    counts[st] = counts.get(st, 0) + 1
    if r["topic"] != topic:
        topic = r["topic"]
        lines += ["", "## %s" % topic, "", "| system | printer | quantity | value | status | source |", "|---|---|---|---|---|---|"]
    lines.append("| %s | %s | %s | %s | %s | %s |" % (
        r["system"], r.get("printer", ""), r["quantity"], r["value"], st, where or "(none)"))

with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines) + "\n")

print("rows: %d  %s" % (len(data["rows"]), counts))
if bad:
    print("\n".join(bad))
    sys.exit(1)
print("table written: %s" % out)
