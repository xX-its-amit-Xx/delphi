import sys, json, urllib.request, urllib.parse
for t in sys.argv[1:]:
    u='https://api.crossref.org/works?'+urllib.parse.urlencode({'query.bibliographic':t,'rows':3,'select':'DOI,title,issued,container-title,author'})
    r=urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'})
    d=json.load(urllib.request.urlopen(r,timeout=60))
    print('##',t)
    for x in d['message']['items']:
        print(' ',x['DOI'],x.get('issued',{}).get('date-parts'),'|',(x.get('title') or [''])[0][:100],'|',(x.get('container-title') or [''])[0],'|',(x.get('author') or [{}])[0].get('family'))
