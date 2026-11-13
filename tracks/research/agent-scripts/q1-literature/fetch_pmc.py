import sys,re,urllib.request,os
# usage: fetch_pmc.py OUTDIR PMCID...  -> saves plain text of Europe PMC fulltext XML
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
for p in sys.argv[2:]:
    u=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{p}/fullTextXML"
    try:
        x=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read().decode('utf8','replace')
    except Exception as e:
        print(p,"ERR",e); continue
    t=re.sub(r'<[^>]+>',' ',x); t=re.sub(r'\s+',' ',t)
    open(f"{out}/{p}.txt","w",encoding="utf8").write(t); print(p,len(t))
