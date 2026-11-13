"""Fetch Europe PMC full-text XML for a PMCID (saved in data/safety-lca/pmc/) and print sentences matching a regex.
Usage: python -I pmcgrep.py PMC12795753 "regex" [maxhits]"""
import sys,re,os,hashlib,urllib.request,html,datetime
sys.stdout.reconfigure(encoding='utf8',errors='replace')
D='D:/Users/ashenoy00000/delphi-work/data/safety-lca/pmc'; os.makedirs(D,exist_ok=True)
pid,rx=sys.argv[1],sys.argv[2]; mx=int(sys.argv[3]) if len(sys.argv)>3 else 12
fn=f'{D}/{pid}.xml'
url=f'https://www.ebi.ac.uk/europepmc/webservices/rest/{pid}/fullTextXML'
if not os.path.exists(fn):
    b=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'delphi-research/0.1'}),timeout=90).read()
    open(fn,'wb').write(b)
    open(D+'/MANIFEST.tsv','a').write(f'{url}\t{fn}\t{len(b)}\t{hashlib.sha256(b).hexdigest()}\t{datetime.datetime.utcnow().isoformat()}Z\n')
t=open(fn,encoding='utf8').read()
t=re.sub(r'<xref[^>]*>.*?</xref>','',t); t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
print(pid,'chars',len(t))
n=0
for s in re.split(r'(?<=[.!?])\s+(?=[A-Z])',t):
    if re.search(rx,s,re.I):
        print('-',s[:420]); n+=1
        if n>=mx: break
