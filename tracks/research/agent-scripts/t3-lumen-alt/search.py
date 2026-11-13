import sys,json,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
for q in sys.argv[1:]:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=6&query='+urllib.parse.quote(q)
    print('##',q)
    for r in get(u)['resultList']['result']:
        print(r.get('pubYear'),r.get('doi'),r.get('pmcid'),r.get('isOpenAccess'),r['title'][:110])
