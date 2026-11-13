"""python -I crabs.py <doi> [<doi>...] -> Crossref title/year/abstract (retry on 429)"""
import sys, json, urllib.request, re, time
sys.stdout.reconfigure(encoding="utf-8")
def get(u):
    for i in range(5):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read())
        except Exception as e:
            time.sleep(3*(i+1)); err=e
    return {"error":str(err)}
for d in sys.argv[1:]:
    j=get("https://api.crossref.org/works/"+d)
    if "error" in j: print(d,"ERR",j["error"]); continue
    m=j["message"]
    print("==",d,"|",(m.get("issued",{}).get("date-parts") or [[None]])[0][0],"|",m["title"][0],"|",(m.get("container-title") or [""])[0])
    print(re.sub('<[^>]+>','',m.get("abstract","(no abstract)")))
    time.sleep(1)
