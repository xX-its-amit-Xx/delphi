#!/usr/bin/env python3
"""Europe PMC search. usage: epmc_search.py "query" [n]  -> prints year|pmcid|doi|title (OA flag)"""
import sys, json, urllib.request, urllib.parse
q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 10
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","pageSize":n,"resultType":"lite"})
r=urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})
d=json.load(urllib.request.urlopen(r,timeout=40))
print("hits",d["hitCount"])
for x in d["resultList"]["result"]:
    print(x.get("pubYear"),"|",x.get("pmcid"),"|",x.get("doi"),"|",x.get("title","")[:110],"| OA" if x.get("isOpenAccess")=="Y" else "")
