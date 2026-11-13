"""Download Europe PMC full-text XML for a PMCID into the data dir, print passages matching keywords.
usage: python europepmc_fulltext.py PMC7143370 outdir kw1,kw2,..."""
import sys, re, html, urllib.request, os
pmc, out, kws = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
u=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmc}/fullTextXML"
x=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read()
os.makedirs(out,exist_ok=True); open(os.path.join(out,pmc+".xml"),"wb").write(x)
t=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',x.decode('utf8','ignore'))))
open(os.path.join(out,pmc+".txt"),"w",encoding='utf8').write(t)
print(len(x),"bytes xml;",len(t),"chars text")
for k in kws:
    for m in list(re.finditer(k,t))[:6]:
        print(f"[{k}] ...{t[max(0,m.start()-200):m.start()+400]}...\n")
