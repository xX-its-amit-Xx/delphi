# usage: crossref_meta.py doi... -> prints title/authors/year/journal/abstract; confirms DOI resolves; logs to scratch
import sys, json, urllib.request, re, time, html, datetime
for doi in sys.argv[1:]:
    time.sleep(1.5)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+doi,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))["message"]
    except Exception as e:
        print("##",doi,"ERR",e); continue
    a=", ".join((x.get("family") or x.get("name","")) for x in d.get("author",[])[:4])
    ab=html.unescape(re.sub(r"<[^>]+>"," ",d.get("abstract","")))
    print("##",doi,"|",d["title"][0],"|",a,"|",d.get("issued",{}).get("date-parts",[[None]])[0][0],"|",(d.get("container-title") or [""])[0])
    print(ab[:1800]); print()
