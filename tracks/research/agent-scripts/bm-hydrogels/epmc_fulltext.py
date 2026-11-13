#!/usr/bin/env python
"""usage: python -I epmc_fulltext.py PMCID [regex ...]
Fetch Europe PMC OA full text XML, save text + record sha256/bytes in data dir manifest,
print sentences matching each regex."""
import sys,re,hashlib,urllib.request,datetime,os,json
sys.stdout.reconfigure(encoding="utf-8")
import xml.etree.ElementTree as ET
D='D:/Users/ashenoy00000/delphi-work/data/bm-hydrogels'
pmc=sys.argv[1]; pats=sys.argv[2:]
url=f'https://www.ebi.ac.uk/europepmc/webservices/rest/{pmc}/fullTextXML'
fn=f'{D}/{pmc}.xml'
if not os.path.exists(fn):
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'delphi-research/0.1'})
        b=urllib.request.urlopen(req,timeout=60).read()
    except Exception:
        url=f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id={pmc[3:]}&rettype=xml'
        req=urllib.request.Request(url,headers={'User-Agent':'delphi-research/0.1'})
        b=urllib.request.urlopen(req,timeout=60).read()
    open(fn,'wb').write(b)
    with open(f'{D}/MANIFEST.jsonl','a') as m:
        m.write(json.dumps({'url':url,'date':str(datetime.date.today()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'file':fn})+'\n')
b=open(fn,'rb').read()
root=ET.fromstring(b)
title=''.join(root.find('.//article-title').itertext()) if root.find('.//article-title') is not None else ''
print('TITLE:',title)
def txt(e): return re.sub(r'\s+',' ',''.join(e.itertext()))
paras=[txt(p) for p in root.iter('p')]
caps=[txt(c) for c in root.iter('caption')]
# tables
tabs=[]
for t in root.iter('table-wrap'):
    lab=txt(t.find('label')) if t.find('label') is not None else ''
    rows=[' | '.join(txt(c) for c in tr) for tr in t.iter('tr')]
    tabs.append(lab+' :: '+txt(t.find('caption')) if t.find('caption') is not None else lab)
    tabs.extend(rows)
allsent=[]
for p in paras+caps+tabs:
    allsent+=re.split(r'(?<=[.;])\s+(?=[A-Z])',p) if len(p)<100000 else [p]
for pat in pats:
    print('=== ',pat)
    n=0
    for s in allsent:
        if re.search(pat,s,re.I):
            print(' -',s[:600]); n+=1
            if n>=12: break
