"""Fetch Crossref metadata + Europe PMC full text (if OA) for each DOI. Usage: fetch.py DOI... ; writes scratch/<slug>.{crossref.json,txt}; prints manifest with sha256."""
import sys,json,urllib.request,urllib.parse,re,hashlib,time,os
UA={'User-Agent':'delphi-research/0.1'}
OUT='D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-deep/'
def get(u):
    for i in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=90).read()
        except Exception as e:
            err=e; time.sleep(3*(i+1))
    raise err
def strip(x): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',x))
for doi in sys.argv[1:]:
    slug=re.sub(r'\W+','_',doi)
    try:
        m=json.loads(get('https://api.crossref.org/works/'+urllib.parse.quote(doi)))['message']
        t=(m.get('title') or [''])[0]; y=m['issued']['date-parts'][0][0]
        au=', '.join(a.get('family','') for a in m.get('author',[])[:4])
        print('CROSSREF OK',doi,y,t[:80],'|',au)
    except Exception as e: print('CROSSREF FAIL',doi,e); continue
    open(OUT+slug+'.crossref.json','w',encoding='utf8').write(json.dumps(m)[:200000])
    time.sleep(1)
    try:
        s=json.loads(get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&query=DOI:%22'+urllib.parse.quote(doi)+'%22&resultType=core'))
        r=s['resultList']['result'][0]; pm=r.get('pmcid'); ab=r.get('abstractText','')
        txt=strip(ab)
        if pm and r.get('isOpenAccess')=='Y':
            x=get(f'https://www.ebi.ac.uk/europepmc/webservices/rest/{pm}/fullTextXML').decode('utf8','ignore')
            txt=strip(x)
        b=txt.encode('utf8'); open(OUT+slug+'.txt','wb').write(b)
        print('  EPMC',pm,r.get('isOpenAccess'),len(b),'bytes sha256',hashlib.sha256(b).hexdigest()[:16])
    except Exception as e: print('  EPMC FAIL',e)
    time.sleep(1)
