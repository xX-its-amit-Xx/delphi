# Fetch abstract + PMCID for each verified DOI from Europe PMC; save to scratch. Run: python -I fetch_epmc.py
import sys; sys.stdout.reconfigure(encoding="utf-8")
import json, urllib.request, urllib.parse, os, re, hashlib, time
OUT=r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-deep"
UA={"User-Agent":"delphi-research/0.1"}
bad={"10.1073/pnas.0900617106","10.1038/msb.2008.19","10.1073/pnas.0502264102","10.1016/j.gde.2005.02.005","10.1016/j.cell.2005.09.031","10.1038/nature04281","10.1038/msb.2011.26"}
cr=json.load(open(OUT+"/crossref.json"))
res={}
for d,v in cr.items():
    if d in bad or not v.get("ok"): continue
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%22"+urllib.parse.quote(d)+"%22&resultType=core&format=json"
    try:
        raw=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30).read()
        j=json.loads(raw); r=(j["resultList"]["result"] or [{}])[0]
        res[d]={"pmid":r.get("pmid"),"pmcid":r.get("pmcid"),"inEPMC":r.get("inEPMC"),"isOpenAccess":r.get("isOpenAccess"),"abstract":re.sub("<[^>]+>","",r.get("abstractText","")),"title":r.get("title"),"sha256":hashlib.sha256(raw).hexdigest(),"bytes":len(raw)}
        print(d,r.get("pmcid"),r.get("isOpenAccess"),len(res[d]["abstract"]))
    except Exception as e: print(d,"ERR",e)
    time.sleep(0.3)
json.dump(res,open(OUT+"/epmc.json","w"),indent=1)
