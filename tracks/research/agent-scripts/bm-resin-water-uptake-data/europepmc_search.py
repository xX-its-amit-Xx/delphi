"""Search Europe PMC (open-access full text only). usage: python europepmc_search.py "query" [n]"""
import sys, json, urllib.request, urllib.parse
q=sys.argv[1]+' AND OPEN_ACCESS:y'; n=int(sys.argv[2]) if len(sys.argv)>2 else 10
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","pageSize":n,"resultType":"lite"})
r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))
print(r.get("hitCount"),"hits")
for x in r["resultList"]["result"]:
    print(x.get("pmcid"),"|",x.get("pubYear"),"|",x.get("doi"),"|",x.get("title","")[:120])
