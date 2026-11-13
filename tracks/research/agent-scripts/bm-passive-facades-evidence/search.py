import sys, json, urllib.request, urllib.parse
UA={"User-Agent":"delphi-research/0.1"}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
def crossref(q,rows=8):
    u="https://api.crossref.org/works?rows=%d&select=DOI,title,issued,container-title,author&query.bibliographic=%s"%(rows,urllib.parse.quote(q))
    for it in get(u)["message"]["items"]:
        a=(it.get("author") or [{}])[0].get("family","")
        print(it["DOI"],"|",(it.get("title") or [""])[0][:110],"|",(it.get("container-title") or [""])[0][:40],"|",it.get("issued",{}).get("date-parts",[[None]])[0][0],"|",a)
if __name__=="__main__":
    import time
    for q in sys.argv[1:]:
        time.sleep(2)
        print("##",q)
        try: crossref(q)
        except Exception as e: print("ERR",e)
