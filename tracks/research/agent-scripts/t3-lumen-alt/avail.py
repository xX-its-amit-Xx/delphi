import sys,re,urllib.request
UA={'User-Agent':'delphi-research/0.1'}
for p in sys.argv[1:]:
    x=urllib.request.urlopen(urllib.request.Request(f'https://www.ebi.ac.uk/europepmc/webservices/rest/{p}/fullTextXML',headers=UA),timeout=90).read().decode('utf8','ignore')
    print('##',p,len(x))
    t=re.sub(r'<[^>]+>',' ',x); t=re.sub(r'\s+',' ',t)
    seen=0
    for m in re.finditer(r'(Data availability|Code availability|Data Availability|Code Availability|Source data|Source Data|available (on|upon) request|Zenodo|zenodo|github|GitHub|Dryad|figshare)',t):
        s=max(0,m.start()-60); print('  ..',t[s:m.start()+300]); seen+=1
        if seen>=5: break
