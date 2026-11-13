import time,json,sys,urllib.request,urllib.parse
UA={"User-Agent":"delphi-research/0.1"}
def get(u):
    for k in range(6):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
        except urllib.error.HTTPError as e:
            if e.code!=429: raise
            time.sleep(5*(k+1))
    raise SystemExit('429 persistent')
qs=json.load(open(sys.argv[1]))
out={}
for q in qs:
    r=get("https://api.crossref.org/works?rows=2&select=DOI,title,author,issued,container-title&query.bibliographic="+urllib.parse.quote(q))
    time.sleep(2)
    out[q]=[{"doi":i["DOI"],"title":i["title"][0] if i.get("title") else None,"year":i["issued"]["date-parts"][0][0],"venue":(i.get("container-title") or [None])[0],"first":(i.get("author") or [{}])[0].get("family")} for i in r["message"]["items"]]
json.dump(out,open(sys.argv[2],"w"),indent=1)
print(json.dumps(out,indent=1))
