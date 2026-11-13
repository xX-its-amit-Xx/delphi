import sys,json,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
def s(q,n=8):
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':q,'format':'json','pageSize':n,'resultType':'lite'})
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
    print('##',q,r.get('hitCount'))
    for x in r['resultList']['result']:
        print(x.get('pmcid',''),x.get('doi',''),x.get('pubYear'),x['title'][:110],'|',x.get('journalTitle','')[:30],x.get('isOpenAccess'))
for q in sys.argv[1:]: s(q)
