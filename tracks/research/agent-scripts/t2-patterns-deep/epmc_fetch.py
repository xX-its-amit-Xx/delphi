"""Search Europe PMC by title; save metadata + full text (as plain text) of open-access items to scratch.
Usage: python epmc_fetch.py "<title query>" <slug>"""
import json, sys, re, urllib.request, urllib.parse, html
B=r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/'
UA={'User-Agent':'delphi-research/0.1'}
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
q,slug=sys.argv[1],sys.argv[2]
r=json.loads(get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=3&resultType=lite&query='+urllib.parse.quote('TITLE:"%s"'%q)))
for x in r['resultList']['result']:
    print(x.get('pmcid'),x.get('doi'),x.get('pubYear'),x.get('journalTitle'),x['title'][:90],x.get('isOpenAccess'))
res=r['resultList']['result']
if not res: sys.exit()
p=[x for x in res if x.get('pmcid')]
if p:
    pm=p[0]['pmcid']
    try:
        x=get('https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML'%pm).decode('utf8')
        t=re.sub(r'<[^>]+>',' ',x); t=html.unescape(re.sub(r'\s+',' ',t))
        open(B+slug+'.txt','w',encoding='utf8').write(t); print('saved',slug,len(t),pm)
    except Exception as e: print('no fulltext',e)
