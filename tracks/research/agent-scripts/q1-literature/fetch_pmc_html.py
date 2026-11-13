import sys,re,urllib.request,os
# usage: fetch_pmc_html.py OUTDIR PMCID...  -> plain text of PMC article page
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
for p in sys.argv[2:]:
    try:
        x=urllib.request.urlopen(urllib.request.Request(f"https://pmc.ncbi.nlm.nih.gov/articles/{p}/",headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read().decode('utf8','replace')
    except Exception as e:
        print(p,"ERR",e); continue
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',x,flags=re.S); t=re.sub(r'<[^>]+>',' ',t); t=re.sub(r'\s+',' ',t)
    open(f"{out}/{p}.txt","w",encoding="utf8").write(t); print(p,len(t))
