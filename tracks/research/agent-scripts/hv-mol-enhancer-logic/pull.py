import json,re,urllib.request,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
a=json.load(open('abstracts.json'))
for d in ['10.1038/s41588-019-0538-0','10.1038/s41586-022-04877-w']:
    print(d,a[d]['pmcid'],a[d]['abstractText'],'\n')
print({d:(v or {}).get('pmcid') for d,v in a.items()})
for pmc,kws in [(a['10.1038/s41586-022-04570-y']['pmcid'],['Hill coefficient','Hill function','sigmoid']),(a['10.1038/s41588-019-0538-0']['pmcid'],['divided by the sum','AUPRC','Spearman','geometric mean'])]:
    if not pmc: continue
    try:
        t=urllib.request.urlopen('https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML'%pmc,timeout=40).read().decode('utf-8','ignore')
        t=re.sub(r'<[^>]+>',' ',t); t=re.sub(r'\s+',' ',t)
        open(pmc+'.txt','w',encoding='utf-8').write(t)
        print('##',pmc,len(t))
        for kw in kws:
            for m in list(re.finditer(kw,t))[:3]:
                print('  [',kw,']',t[max(0,m.start()-200):m.start()+240])
    except Exception as e: print('ERR',pmc,e)
