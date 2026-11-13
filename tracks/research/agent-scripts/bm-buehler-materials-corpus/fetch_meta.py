# Fetch Crossref + Europe PMC records for the selected DOIs; save raw JSON under data dir with sha256 manifest.
# Run: python -I fetch_meta.py
import json, sys
sys.stdout.reconfigure(encoding='utf8')
import urllib.request, urllib.parse, hashlib, os, time, datetime, sys
DATA='D:/Users/ashenoy00000/delphi-work/data/buehler-papers/'
os.makedirs(DATA,exist_ok=True)
UA={'User-Agent':'delphi-research/0.1'}
DOIS=['10.1126/sciadv.aau9183','10.1038/ncomms6942','10.1038/srep00035','10.1002/adfm.201300215','10.1039/c3sm52890a',
'10.1021/ab500120f','10.1039/c8mh00653a','10.1002/adma.201700060','10.1038/ncomms8038','10.1088/0957-4484/27/2/024002',
'10.1002/adma.202300373','10.1002/adma.201802306','10.48550/arxiv.2508.06591','10.1021/acsnano.7b01532','10.1039/d3mh01277h',
'10.1002/adem.202000387','10.48550/arxiv.2108.07877']
man=[]
def get(url,fn):
    p=DATA+fn
    if os.path.exists(p):
        b=open(p,'rb').read()
    else:
        req=urllib.request.Request(url,headers=UA)
        b=None
        for attempt in range(4):
            try:
                b=urllib.request.urlopen(req,timeout=40).read(); break
            except Exception as e:
                print('ERR',url,e); time.sleep(5*(attempt+1))
        if b is None: return None
        open(p,'wb').write(b); time.sleep(0.5)
    man.append({'url':url,'file':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'date':datetime.date.today().isoformat()})
    return b
for doi in DOIS:
    slug=doi.replace('/','_')
    b=get('https://api.crossref.org/works/'+urllib.parse.quote(doi,safe='/'),'crossref_'+slug+'.json')
    if b:
        j=json.loads(b)['message']
        print(doi,'| CR OK |',(j.get('title') or [''])[0][:80],'| abstract' if j.get('abstract') else '| no-abs', j.get('issued',{}).get('date-parts'))
    q=urllib.parse.quote('DOI:"%s"'%doi)
    b=get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=%s&format=json&resultType=core'%q,'epmc_'+slug+'.json')
    if b:
        r=json.loads(b).get('resultList',{}).get('result',[])
        if r: print('   EPMC:',r[0].get('pmcid'),r[0].get('isOpenAccess'),r[0].get('source'),r[0].get('id'))
        else: print('   EPMC: none')
json.dump(man,open(DATA+'manifest.json','w'),indent=1)
