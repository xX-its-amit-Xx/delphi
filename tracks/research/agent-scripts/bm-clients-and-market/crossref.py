"""Query Crossref (generic UA) for a bibliographic string, print top hits; or resolve a DOI. Usage: python -I crossref.py "query" | python -I crossref.py --doi 10.x/y"""
import sys, json, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
H = {"User-Agent": "delphi-research/0.1"}
if sys.argv[1] == "--doi":
    u = "https://api.crossref.org/works/" + sys.argv[2]
    j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=40))["message"]
    print(u); print(j.get("DOI"), "|", j.get("title"), "|", j.get("container-title"), "|", j.get("issued"), "|", [a.get("family") for a in j.get("author", [])][:6])
else:
    u = "https://api.crossref.org/works?rows=5&select=DOI,title,container-title,issued,author&query.bibliographic=" + urllib.parse.quote(sys.argv[1])
    for it in json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=40))["message"]["items"]:
        print(it["DOI"], "|", it.get("title"), "|", it.get("container-title"), "|", it.get("issued", {}).get("date-parts"), "|", [a.get("family") for a in it.get("author", [])][:5])
