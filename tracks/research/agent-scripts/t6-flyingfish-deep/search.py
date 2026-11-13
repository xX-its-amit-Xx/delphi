import json,sys,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read()
qs=['flying fish gliding','Exocoetidae flight','flying fish take-off','flying fish aerodynamic','flying fish fin evolution','flying fish robot']
seen=set()
for q in qs:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=15&query='+urllib.parse.quote(q)
    for r in json.loads(get(u))['resultList']['result']:
        k=r.get('doi') or r.get('id')
        if k in seen: continue
        seen.add(k);print(r.get('pubYear'),r.get('doi'),r.get('pmcid'),r.get('title','')[:100],'|',r.get('journalTitle'))
