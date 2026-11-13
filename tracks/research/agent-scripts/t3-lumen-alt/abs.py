import sys,json,urllib.request,re
UA={'User-Agent':'delphi-research/0.1'}
for d in sys.argv[1:]:
    u=f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:{d}'
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))['resultList']['result']
    if not r: print('##',d,'NONE');continue
    r=r[0]; print('##',d,r['pubYear'],r.get('pmcid'),r.get('license'),'|',r['title']); print((r.get('abstractText') or '')[:1800]);print()
