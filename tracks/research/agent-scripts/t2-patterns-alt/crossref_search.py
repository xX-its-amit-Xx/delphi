import json,sys,time,urllib.parse,urllib.request
# usage: python -I crossref_search.py "query1" "query2" ...  -> top 3 Crossref bibliographic matches each
for q in sys.argv[1:]:
    u="https://api.crossref.org/works?rows=3&select=DOI,title,author,issued,container-title&query.bibliographic="+urllib.parse.quote(q)
    r=urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})
    for t in range(5):
        try:
            d=json.load(urllib.request.urlopen(r,timeout=60)); break
        except Exception as e:
            print("  retry",e); time.sleep(15*(t+1))
    time.sleep(3)
    print("##",q)
    for i in d["message"]["items"]:
        a=i.get("author",[{}])
        print(" ",i["DOI"],"|",(i.get("title") or [""])[0][:100],"|",a[0].get("family"),"|",i["issued"]["date-parts"][0][0],"|",(i.get("container-title") or [""])[0])
