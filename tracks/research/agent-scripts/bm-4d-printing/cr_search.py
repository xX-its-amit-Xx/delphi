"""Crossref search. Usage: python -I cr_search.py "<free-text query>" [rows] [from_year]"""
import sys, json, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
q = sys.argv[1]; n = sys.argv[2] if len(sys.argv) > 2 else "10"; yr = sys.argv[3] if len(sys.argv) > 3 else None
p = {"query": q, "rows": n, "select": "DOI,title,issued,container-title,type"}
if yr: p["filter"] = f"from-pub-date:{yr}"
d = json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works?" + urllib.parse.urlencode(p), headers={"User-Agent": "delphi-research/0.1"}), timeout=60))
print("total", d["message"]["total-results"])
for r in d["message"]["items"]:
    print(r["DOI"], "|", r.get("issued", {}).get("date-parts", [[None]])[0][0], "|", (r.get("container-title") or [""])[0][:30], "|", (r.get("title") or [""])[0][:110])
