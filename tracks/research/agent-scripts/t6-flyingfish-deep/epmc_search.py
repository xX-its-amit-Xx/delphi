import json,sys,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
for q in sys.argv[1:]:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=8&query='+urllib.parse.quote(q)
    print('##',q)
    for r in json.loads(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read())['resultList']['result']:
        print(' ',r.get('pubYear'),r.get('doi'),r.get('pmcid'),r.get('title','')[:100],'|',r.get('journalTitle'))
