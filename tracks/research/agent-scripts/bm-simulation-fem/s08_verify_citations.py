"""s08: resolve each cited DOI against Crossref (or DataCite) and print title/authors/year/venue.
Run: python s08_verify_citations.py   (needs internet; generic User-Agent, no personal data sent)
Writes results/s08_citations.txt
"""
import _env
import json, time, urllib.request, urllib.parse

DOIS = [
    "10.1364/josa.11.000233",            # Timoshenko 1925
    "10.1016/s0022-5096(99)00070-8",     # Freund 2000
    "10.1126/science.1203874",           # Armon et al 2011
    "10.1039/c3sm52313f",                # Armon et al 2014
    "10.21105/joss.02369",               # scikit-fem
]
EXTRA_QUERIES = [
    "Hyer Some observations on the cured shape of thin unsymmetric laminates",
    "Pezzulla Geometry and mechanics of thin growing bilayers",
]
UA = {"User-Agent": "delphi-research/0.1"}

def get(url):
    for k in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=30))
        except Exception as e:
            err = str(e); time.sleep(3 * (k + 1))
    return {"error": err}

lines = []
for d in DOIS:
    r = get("https://api.crossref.org/works/" + urllib.parse.quote(d, safe="/()"))
    if "message" in r:
        m = r["message"]
        lines.append(f"OK  {m['DOI']} | {m['title'][0]} | {[a.get('family') for a in m.get('author', [])][:4]} | {m['issued']['date-parts'][0]} | {m.get('container-title')}")
    else:
        lines.append(f"ERR {d} {r}")
    time.sleep(1)
for q in EXTRA_QUERIES:
    r = get("https://api.crossref.org/works?rows=3&select=DOI,title,author,issued,container-title&query.bibliographic=" + urllib.parse.quote(q))
    for m in r.get("message", {}).get("items", []):
        lines.append(f"Q[{q[:30]}] {m['DOI']} | {m.get('title', [''])[0][:100]} | {[a.get('family') for a in m.get('author', [])][:3]} | {m['issued']['date-parts'][0]}")
    time.sleep(1)
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s08_citations.txt", "w", encoding="utf-8").write(txt + "\n")
