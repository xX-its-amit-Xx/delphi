import sys, json, urllib.parse, urllib.request
UA={'User-Agent':'delphi-research/0.1'}
qs=sys.argv[1:]
for q in qs:
    u='https://api.crossref.org/works?rows=3&select=DOI,title,author,issued,container-title&query.bibliographic='+urllib.parse.quote(q)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
        print('##',q)
        for it in d['message']['items']:
            a=it.get('author',[{}])[0].get('family','?')
            print('  ',it['DOI'],'|',(it.get('title') or ['?'])[0][:90],'|',a,it['issued']['date-parts'][0][0],'|',(it.get('container-title') or [''])[0])
    except Exception as e: print('ERR',q,e)
