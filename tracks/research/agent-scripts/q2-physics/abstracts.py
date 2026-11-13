import time,json,sys,re,urllib.request,urllib.parse,urllib.error
UA={"User-Agent":"delphi-research/0.1"}
def get(u):
    for k in range(6):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
        except urllib.error.HTTPError as e:
            if e.code==404: return None
            if e.code!=429: raise
            time.sleep(5*(k+1))
dois=sys.argv[2:]
out={}
for d in dois:
    c=get("https://api.crossref.org/works/"+d); time.sleep(1.5)
    m=c["message"] if c else None
    e=get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:%22"+d+"%22")
    r=(e["resultList"]["result"] or [None])[0] if e else None
    out[d]={"crossref_title":m and m["title"][0],"year":m and m["issued"]["date-parts"][0][0],"venue":m and (m.get("container-title") or [""])[0],
      "authors":m and [a.get("family") for a in m.get("author",[])][:4],
      "abstract":(r or {}).get("abstractText") or (m and re.sub('<[^>]+>','',m.get("abstract",""))) }
json.dump(out,open(sys.argv[1],"w"),indent=1)
for d,v in out.items(): print("\n##",d,v["crossref_title"],v["year"],v["venue"]); print(v["abstract"])
