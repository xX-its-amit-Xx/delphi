"""Usage: python -I epmc_abstract.py PMCID [PMCID...] -- prints title, journal, year, DOI and abstract from Europe PMC (core)."""
import sys, json, re, html, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
for pm in sys.argv[1:]:
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":"PMCID:"+pm,"format":"json","resultType":"core"})
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60))
    for x in d["resultList"]["result"]:
        a=html.unescape(re.sub(r"<[^>]+>","",x.get("abstractText","")))
        print("##",pm,x.get("doi"),x.get("pubYear"),x.get("journalTitle"),"|",html.unescape(x.get("title","")))
        print(a,"\n")
