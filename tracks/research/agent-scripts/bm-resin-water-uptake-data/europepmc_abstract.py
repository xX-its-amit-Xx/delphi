"""Fetch abstract + metadata from Europe PMC for a DOI. usage: python europepmc_abstract.py DOI"""
import sys, json, urllib.request, urllib.parse, re, html
d=sys.argv[1]
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":'DOI:"%s"'%d,"format":"json","resultType":"core"})
r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))
for x in r["resultList"]["result"][:1]:
    print(x.get("doi"),x.get("pubYear"),x.get("journalTitle"),x.get("title"))
    print(html.unescape(re.sub(r'<[^>]+>','',x.get("abstractText","(no abstract)"))))
