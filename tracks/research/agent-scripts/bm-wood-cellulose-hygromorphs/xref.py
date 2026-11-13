import sys,json,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
def q(t,n=4):
    u='https://api.crossref.org/works?'+urllib.parse.urlencode({'query.bibliographic':t,'rows':n,'select':'DOI,title,author,issued,container-title,license'})
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
    print('##',t)
    for x in r['message']['items']:
        au=','.join(a.get('family','') for a in x.get('author',[])[:3])
        print(x['DOI'],x['issued']['date-parts'][0][0],(x.get('title') or [''])[0][:90],'|',au,'|',(x.get('container-title') or [''])[0][:30])
for t in sys.argv[1:]: q(t)
