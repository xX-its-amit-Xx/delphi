import json,sys,time,urllib.request
# usage: python -I crossref_verify.py DOI ...  -> fetch /works/<doi>, print title/first author/year/journal
out=[]
for doi in sys.argv[1:]:
    time.sleep(3)
    try:
        r=urllib.request.Request("https://api.crossref.org/works/"+doi,headers={"User-Agent":"delphi-research/0.1"})
        m=json.load(urllib.request.urlopen(r,timeout=60))["message"]
        row=dict(doi=doi,ok=True,title=(m.get("title") or [""])[0],first=(m.get("author") or [{}])[0].get("family"),year=m["issued"]["date-parts"][0][0],venue=(m.get("container-title") or [""])[0])
    except Exception as e:
        row=dict(doi=doi,ok=False,err=str(e))
    print(json.dumps(row))
