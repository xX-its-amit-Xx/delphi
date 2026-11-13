"""Crossref search: python -I cr.py "<query>" [rows]  -> doi | year | title | container | has-abstract"""
import sys, json, urllib.request, urllib.parse, re
sys.stdout.reconfigure(encoding="utf-8")
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else "8"
u="https://api.crossref.org/works?"+urllib.parse.urlencode({"query.bibliographic":q,"rows":n,"select":"DOI,title,issued,container-title,abstract"})
j=json.loads(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read())
for r in j["message"]["items"]:
    print(r["DOI"],"|",(r.get("issued",{}).get("date-parts") or [[None]])[0][0],"|",(r.get("title") or [""])[0][:110],"|",(r.get("container-title") or [""])[0][:40],"| abs" if r.get("abstract") else "")
