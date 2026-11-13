import json,sys,re,time,urllib.request,urllib.parse
# usage: epmc_data_avail.py DOI... ; prints PMCID, OA flag and sentences mentioning data/code availability from Europe PMC full text XML
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=90).read()
for doi in sys.argv[1:]:
    print("=====",doi)
    r=json.loads(get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&query=DOI:%22"+urllib.parse.quote(doi)+"%22"))
    res=r["resultList"]["result"]
    if not res: print(" no epmc record"); continue
    x=res[0]; print(" ",x.get("pmcid"),x.get("isOpenAccess"),x.get("title","")[:90])
    if not x.get("pmcid"): continue
    try: xml=get("https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"%x["pmcid"]).decode("utf8","ignore")
    except Exception as e: print(" fulltext err",e); continue
    txt=re.sub(r"<[^>]+>"," ",xml); txt=re.sub(r"\s+"," ",txt)
    for m in re.finditer(r"[^.]*(Data availability|Source data|data (are|is|have been) (available|deposited)|deposited|Zenodo|Dryad|figshare|github\.com|Code availability|available (at|from|on))[^.]*\.",txt,re.I):
        print("   -",m.group(0).strip()[:300])
    time.sleep(1)
