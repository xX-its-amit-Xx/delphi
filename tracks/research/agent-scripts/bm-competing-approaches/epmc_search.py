import sys, json, urllib.request, urllib.parse
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else '8'
u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':q,'format':'json','pageSize':n,'resultType':'lite'})
r=urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'})
d=json.load(urllib.request.urlopen(r,timeout=60))
for x in d['resultList']['result']:
    print(x.get('pmcid',''),x.get('pmid',''),x.get('doi',''),x.get('pubYear',''),x.get('isOpenAccess',''),'|',x.get('title','')[:110],'|',x.get('journalTitle',''))
