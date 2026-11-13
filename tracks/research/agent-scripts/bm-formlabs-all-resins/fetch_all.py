"""Fetch Formlabs product pages + English TDS PDFs for the materials listed in ds_index.json.
Run: python -I fetch_all.py   (re-runnable; skips files already present)
Outputs: scratch/<label>/pages/*.html, data/formlabs-tds/*.pdf, data/formlabs-tds/MANIFEST.tsv"""
import re,json,os,sys,hashlib,time,urllib.request,datetime
ROOT='D:/Users/ashenoy00000/delphi-work'
SC=ROOT+'/agents2/scratch/bm-formlabs-all-resins'
DD=ROOT+'/data/formlabs-tds'
os.makedirs(SC+'/pages',exist_ok=True); os.makedirs(DD,exist_ok=True)
UA='delphi-research/0.1'
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=60) as r: return r.read(),r.geturl()
idx=json.load(open(SC+'/ds_index.json'))
mat=open(SC+'/materials.html',encoding='utf8',errors='ignore').read()
slugs=sorted(set(re.findall(r'href="/products/([a-z0-9\-]+)/?"',mat)))
# keep material slugs only (drop accessories / sample parts / printers)
drop=re.compile(r'(form-|3d-printers|materials|sample|pigment|knob|tray|ruler|dust|ring|case|duct|switch|ratchet|buckle|gear|enclosure|watch|boot|impeller|mold|brace|bracket|nozzle|tee-fitting|lever|connector|probe|swatch|teeth|guide|segment|kit|restorative|signet|millifluidics|open-material)')
slugs=[s for s in slugs if not drop.search(s)]
man=[]
now=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for s in slugs:
    p=f'{SC}/pages/{s}.html'
    if not os.path.exists(p):
        try:
            b,u=get(f'https://formlabs.com/products/{s}/'); open(p,'wb').write(b)
            man.append((f'https://formlabs.com/products/{s}/',p,len(b),hashlib.sha256(b).hexdigest(),now))
        except Exception as e: print('ERR page',s,e)
        time.sleep(0.5)
print('pages',len(slugs),slugs)
want="alpha-black-resin alpha-clear-resin alpha-fast-resin alpha-grey-resin alpha-model-resin alpha-white-resin alumina4n biomedamber biomedblack biomedclear biomeddurable biomedflex50a biomedflexible80a biomedwhite blackv5 castablewax castablewax40 ceramic clearcast clearv5 colorbase colorresin draft durable elastic50av1 esd fastmodel flameretardant flexible-80a-resin-v2 flexible50a flexible80a grey-v5 greypro hightemp ibtflex model modelv3 nylon-11-pro nylon11 nylon11cf nylon12 nylon12gf nylon12tough nylon12white polypropylene precisionmodel purigid1000 purigid650 rigid10k rigid4000 silicone40a tough1000 tough1500 tough1500v2 tough2000 tough2000v2 tpu90a truecastresin white-v5".split()
for w in want:
    for r in idx['records']:
        if w in r['products'] and r['sheet_type']=='technical' and r['language']=='en':
            f=r['file']
            if f.startswith('/'): f='https://formlabs.com'+f
            ext='html' if not f.endswith('.pdf') else 'pdf'
            name=f'{w}__{r["pk"]}.{ext}'
            dst=(DD if ext=='pdf' else SC+'/pages')+'/'+name
            if os.path.exists(dst): continue
            try:
                b,u=get(f); open(dst,'wb').write(b)
                man.append((f,dst,len(b),hashlib.sha256(b).hexdigest(),now))
            except Exception as e: print('ERR tds',w,f,e)
            time.sleep(0.5)
with open(DD+'/MANIFEST.tsv','a',encoding='utf8') as m:
    for r in man: m.write('\t'.join(map(str,r))+'\n')
print('new files',len(man))
