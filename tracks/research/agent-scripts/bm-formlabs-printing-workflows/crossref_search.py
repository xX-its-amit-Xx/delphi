"""Query Crossref works search (no auth, generic UA); print top hits: DOI, year, title, container. Usage: python crossref_search.py "query" [rows]"""
import sys, json, urllib.request, urllib.parse
q = sys.argv[1]; rows = int(sys.argv[2]) if len(sys.argv) > 2 else 6
u = "https://api.crossref.org/works?" + urllib.parse.urlencode({"query.bibliographic": q, "rows": rows, "select": "DOI,title,issued,container-title,author"})
d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1"}), timeout=60))
for it in d["message"]["items"]:
    a = it.get("author", [{}])[0].get("family", "")
    print(it["DOI"], it.get("issued", {}).get("date-parts", [[None]])[0][0], "|", (it.get("title") or [""])[0][:110], "|", (it.get("container-title") or [""])[0][:40], "|", a)
