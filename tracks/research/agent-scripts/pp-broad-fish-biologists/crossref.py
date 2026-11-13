import sys,json,urllib.request
for d in sys.argv[1:]:
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+d,headers={"User-Agent":"delphi-research/0.1"})))["message"]
        print(d,"|",r["title"][0][:110],"|",(r.get("container-title") or [""])[0],"|",r["issued"]["date-parts"][0][0],"|",[a.get("family") for a in r.get("author",[])][:2],[a.get("family") for a in r.get("author",[])][-1:])
    except Exception as e: print(d,"FAIL",e)
