import sys,json,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding='utf8')
def search(q,n=8):
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({'query':q,'format':'json','pageSize':n,'resultType':'lite'})
    r=urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'})
    d=json.load(urllib.request.urlopen(r,timeout=40))
    for x in d['resultList']['result']:
        print(x.get('pubYear'),'|',x.get('title','')[:120],'|',x.get('doi'),'|',x.get('journalTitle'),'|',x.get('authorString','')[:50])
    print('hits',d.get('hitCount'))
for q in sys.argv[1:]:
    print('##',q); search(q)
