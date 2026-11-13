#!/usr/bin/env python3
"""epmc_abs.py QUERY -> prints title, doi, journal, year, abstract for first hit (e.g. EXT_ID:24463362 AND SRC:MED or DOI:xx)"""
import sys,json,urllib.request,urllib.parse
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":sys.argv[1],"format":"json","resultType":"core","pageSize":1})
d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))
for x in d["resultList"]["result"]:
    print(x.get("title"),"|",x.get("doi"),"|",x.get("journalTitle"),x.get("pubYear"),"| pmcid",x.get("pmcid")); print(x.get("abstractText"))
