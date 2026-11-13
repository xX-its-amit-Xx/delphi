"""Search Crossref (no OpenAlex). usage: python crossref_search.py "query" [rows]. Prints DOI, year, title, journal."""
import sys, json, urllib.request, urllib.parse
q=sys.argv[1]; rows=int(sys.argv[2]) if len(sys.argv)>2 else 8
u="https://api.crossref.org/works?"+urllib.parse.urlencode({"query.bibliographic":q,"rows":rows,"select":"DOI,title,issued,container-title,author"})
r=urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})
for it in json.load(urllib.request.urlopen(r,timeout=40))["message"]["items"]:
    a=it.get("author",[{}])[0].get("family","?")
    print(it["DOI"],"|",(it.get("issued",{}).get("date-parts",[[None]])[0] or [None])[0],"|",a,"|",(it.get("title") or ["?"])[0][:110],"|",(it.get("container-title") or ["?"])[0][:40])
