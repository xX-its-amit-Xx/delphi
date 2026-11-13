import sys, json, urllib.request, urllib.parse, time
UA={"User-Agent":"delphi-research/0.1"}
def s(q,n=8):
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=%d&resultType=lite&query=%s"%(n,urllib.parse.quote(q))
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
    for r in d["resultList"]["result"]:
        print(r.get("doi"),"|",r.get("pubYear"),"|",r.get("title","")[:110],"|",r.get("journalTitle","")[:30],"|",r.get("source")+r.get("id",""),"|OA" if r.get("isOpenAccess")=="Y" else "")
for q in sys.argv[1:]:
    print("##",q)
    try: s(q)
    except Exception as e: print("ERR",e)
    time.sleep(1)
