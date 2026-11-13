"""Usage: python -I epmc_search.py "<query>" [n]  -- prints id, pmcid, doi, year, OA, title from Europe PMC (no auth)."""
import sys as _s; _s.stdout.reconfigure(encoding="utf-8")
import sys, json, urllib.request, urllib.parse
q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 10
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","resultType":"lite","pageSize":n})
r=urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})
d=json.load(urllib.request.urlopen(r,timeout=60))
for x in d["resultList"]["result"]:
    print(x.get("pmcid"),x.get("doi"),x.get("pubYear"),x.get("isOpenAccess"),"|",x.get("title","")[:110])
