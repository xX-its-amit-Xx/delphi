"""usage: python crossref.py DOI [DOI...] -> verify via Crossref; prints title/year/journal"""
import sys, json, urllib.request, urllib.parse
for d in sys.argv[1:]:
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+urllib.parse.quote(d),headers={"User-Agent":"delphi-research/0.1"}),timeout=60))["message"]
        print("OK ",d,"|",r.get("title",[""])[0][:100],"|",(r.get("issued",{}).get("date-parts",[[None]])[0][0]),"|",(r.get("container-title") or [""])[0],"|",", ".join(a.get("family","") for a in r.get("author",[])[:3]))
    except Exception as e:
        print("ERR",d,e)
