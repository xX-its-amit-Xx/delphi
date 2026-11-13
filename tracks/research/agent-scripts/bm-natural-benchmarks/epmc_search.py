"""usage: python epmc_search.py "query" [n]  -> title, year, doi, pmcid, isOpenAccess"""
import sys, json, urllib.request, urllib.parse
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else "10"
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode(dict(query=q,format="json",pageSize=n,resultType="lite"))
r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60))
for x in r["resultList"]["result"]:
    print(x.get("pubYear"),"|",x.get("title","")[:100],"|",x.get("doi"),"|",x.get("pmcid"),"|OA",x.get("isOpenAccess"),"|",x.get("authorString","")[:50])
