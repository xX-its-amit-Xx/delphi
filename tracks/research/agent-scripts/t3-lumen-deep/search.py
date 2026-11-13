import sys,json,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
for q in sys.argv[1:]:
    u='https://api.crossref.org/works?rows=3&select=DOI,title,issued,container-title&query.bibliographic='+urllib.parse.quote(q)
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
    print('##',q)
    for i in d['message']['items']:
        print('  ',i['DOI'],i['issued']['date-parts'][0][0],(i.get('title') or [''])[0][:90],'|',(i.get('container-title') or [''])[0])
