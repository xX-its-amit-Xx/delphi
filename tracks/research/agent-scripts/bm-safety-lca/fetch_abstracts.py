"""Cache abstracts used as evidence into data/safety-lca/abstracts/<doi with / -> _>.txt (Europe PMC first, Crossref fallback),
and log url/size/sha256/date to abstracts/MANIFEST.tsv.  Run: python -I fetch_abstracts.py"""
import json,re,os,time,hashlib,datetime,urllib.request,urllib.parse
D='D:/Users/ashenoy00000/delphi-work/data/safety-lca/abstracts'; os.makedirs(D,exist_ok=True)
H={'User-Agent':'delphi-research/0.1'}
DOIS='''10.1016/j.aquatox.2019.105227 10.1038/s41370-025-00778-y 10.1021/acs.chas.2c00002 10.1021/acs.chas.5c00076 10.1021/acs.chas.4c00087
10.1080/15287394.2021.1998814 10.1080/15298669291359375 10.1111/jiec.13277 10.1021/polymscitech.5c00144 10.1021/prechem.6c00065
10.3390/polym18182208 10.1021/accountsmr.5c00354 10.1016/j.isci.2025.113185 10.3390/ma18194478'''.split()
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60).read()
for d in DOIS:
    fn=f'{D}/{d.replace("/","_")}.txt'
    if os.path.exists(fn): continue
    txt='';src=''
    try:
        u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':'DOI:'+d,'format':'json','resultType':'core'})
        r=json.loads(get(u))['resultList']['result']
        if r and r[0].get('abstractText'): txt=re.sub(r'<[^>]+>','',r[0]['abstractText']); src=u
    except Exception as e: print(d,'epmc err',e)
    if not txt:
        try:
            time.sleep(3); u='https://api.crossref.org/works/'+urllib.parse.quote(d)
            m=json.loads(get(u))['message']; txt=re.sub(r'<[^>]+>','',m.get('abstract','')); src=u
        except Exception as e: print(d,'crossref err',e)
    if txt:
        b=txt.encode('utf8'); open(fn,'wb').write(b)
        open(D+'/MANIFEST.tsv','a').write(f'{src}\t{fn}\t{len(b)}\t{hashlib.sha256(b).hexdigest()}\t{datetime.datetime.now(datetime.timezone.utc).isoformat()}\n')
        print('saved',d,len(b))
    else: print('NO ABSTRACT',d)
