"""Query Crossref for funder metadata of precedent hygromorph / 4D-print / responsive-architecture papers.
Prints title, DOI, year, funders. Titles are printed so a human can check each hit is the intended paper.
Run: python -I -X utf8 precedent_funders.py   (needs internet; generic User-Agent, no personal data)"""
import json, urllib.request, urllib.parse, time
QUERIES = [
 "Gladman Biomimetic 4D printing Nature Materials",
 "Grönquist Computational analysis of hygromorphic self-shaping wood gridshell structures",
 "Poppinga Toward a new generation of smart biomimetic actuators for architecture",
 "Reichert Menges Correa Meteorosensitive architecture biomimetic building skins",
 "Hygroscopically actuated wood elements for weather responsive and self-forming building parts",
 "Wood Grönquist Rüggeberg Menges Hygromorphic wood bilayer humidity response",
 "Tibbits 4D printing multi-material shape change Architectural Design",
 "Holstov Hygromorphic materials for sustainable responsive architecture",
 "Self-shaping wood bilayer curvature moisture Rüggeberg Burgert",
]
for q in QUERIES:
    url = "https://api.crossref.org/works?rows=1&select=DOI,title,issued,container-title,funder&query.bibliographic=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
    try:
        it = json.load(urllib.request.urlopen(req, timeout=40))["message"]["items"]
    except Exception as e:
        print("FAIL", q, e); continue
    if not it: print("NO HIT", q); continue
    i = it[0]
    print(i["DOI"], "|", i["title"][0][:100], "|", i["issued"]["date-parts"][0][0], "|",
          "; ".join(f"{f.get('name')} {f.get('award','')}" for f in i.get("funder", [])) or "no funder metadata")
    time.sleep(1)
