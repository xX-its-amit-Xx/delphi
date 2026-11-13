import sys,re,urllib.request
UA={'User-Agent':'delphi-research/0.1'}
pat=sys.argv[1]
for p in sys.argv[2:]:
    x=urllib.request.urlopen(urllib.request.Request(f'https://www.ebi.ac.uk/europepmc/webservices/rest/{p}/fullTextXML',headers=UA),timeout=90).read().decode('utf8','ignore')
    t=re.sub(r'<[^>]+>',' ',x); t=re.sub(r'\s+',' ',t)
    print('##',p)
    for m in list(re.finditer(pat,t))[:4]:
        print('  ..',t[max(0,m.start()-80):m.start()+450])
