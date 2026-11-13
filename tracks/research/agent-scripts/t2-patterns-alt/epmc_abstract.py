import json,sys,time,re,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding="utf8",errors="replace")
# usage: epmc_abstract.py DOI... -> Europe PMC title/year/journal/abstract (tags stripped)
for doi in sys.argv[1:]:
    time.sleep(1)
    r=json.load(urllib.request.urlopen(urllib.request.Request("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:%22"+urllib.parse.quote(doi)+"%22",headers={"User-Agent":"delphi-research/0.1"}),timeout=60))["resultList"]["result"]
    if not r: print("==",doi,"NO EPMC RECORD"); continue
    x=r[0]; print("==",doi,"|",x.get("title"),"|",x.get("journalTitle"),x.get("pubYear"),"| PMID",x.get("pmid"),"| OA",x.get("isOpenAccess"))
    print("  ",re.sub(r"<[^>]+>","",x.get("abstractText","(none)"))[:1500])
