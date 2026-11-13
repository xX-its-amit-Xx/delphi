"""Print author lists (family names) for DOIs from Crossref. usage: python authors.py doi..."""
import sys, json, time, urllib.request, urllib.parse
for d in sys.argv[1:]:
    time.sleep(1.5)
    m=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+urllib.parse.quote(d,safe="/()"),headers={"User-Agent":"delphi-research/0.1"}),timeout=40))["message"]
    print(d,"|",", ".join(a.get("family","?") for a in m.get("author",[]))[:160],"|",m["issued"]["date-parts"][0][0],"|",m.get("container-title",[""])[0])
