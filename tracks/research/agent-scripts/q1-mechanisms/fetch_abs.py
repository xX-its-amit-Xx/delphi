import sys,json,urllib.request,urllib.parse,os,datetime
# usage: fetch_abs.py out.json id1 id2 ... ; id = MED:<pmid> or PPR:<id> or PMC:<id>
out=sys.argv[1]; res={}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60))
for i in sys.argv[2:]:
    src,id=i.split(":")
    r=get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":f"EXT_ID:{id} AND SRC:{src}","format":"json","resultType":"core"}))["resultList"]["result"][0]
    doi=r.get("doi"); cr=None
    if doi:
        try:
            c=get("https://api.crossref.org/works/"+doi)["message"]
            cr={"title":c["title"][0],"year":(c.get("issued",{}).get("date-parts") or [[None]])[0][0],"container":(c.get("container-title") or [""])[0]}
        except Exception as e: cr={"error":str(e)}
    res[i]={"doi":doi,"title":r.get("title"),"year":r.get("pubYear"),"journal":r.get("journalTitle"),"authors":r.get("authorString"),"abstract":r.get("abstractText"),"crossref":cr,"fetched":datetime.date.today().isoformat(),"url":f"https://europepmc.org/article/{src}/{id}"}
json.dump(res,open(out,"w",encoding="utf-8"),indent=1,ensure_ascii=False)
for k,v in res.items(): print(k,v["doi"],v["crossref"])
