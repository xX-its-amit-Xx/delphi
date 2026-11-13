import json,sys,urllib.request,urllib.parse,time
UA={'User-Agent':'delphi-research/0.1'}
for d in sys.argv[1:]:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query='+urllib.parse.quote('DOI:'+d)
    r=json.loads(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read())['resultList']['result']
    if not r: print('NONE',d);continue
    r=r[0];print('##',d,r.get('pubYear'),r.get('title'),'|',r.get('journalTitle'),r.get('pmid'),r.get('pmcid'));print(r.get('abstractText','')[:2200]);print()
    time.sleep(1)
