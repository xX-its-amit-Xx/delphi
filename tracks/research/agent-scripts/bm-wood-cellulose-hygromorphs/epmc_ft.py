"""usage: epmc_ft.py PMCID [PMCID...]  -> data/wood-hygro/<PMCID>.txt (plain text from Europe PMC fullTextXML); prints sha256 of the XML"""
import sys,re,html,hashlib,urllib.request,datetime
D='D:/Users/ashenoy00000/delphi-work/data/wood-hygro/'
for p in sys.argv[1:]:
    u=f'https://www.ebi.ac.uk/europepmc/webservices/rest/{p}/fullTextXML'
    b=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=90).read()
    open(D+p+'.xml','wb').write(b)
    t=b.decode('utf8','replace')
    t=re.sub(r'</(p|title|sec|caption|td|tr|label)>','\n',t)
    t=html.unescape(re.sub(r'<[^>]+>','',t))
    t=re.sub(r'[ \t]+',' ',t);t=re.sub(r'\n\s*\n+','\n',t)
    open(D+p+'.txt','w',encoding='utf8').write(t)
    print(p,u,len(b),hashlib.sha256(b).hexdigest(),datetime.date.today())
