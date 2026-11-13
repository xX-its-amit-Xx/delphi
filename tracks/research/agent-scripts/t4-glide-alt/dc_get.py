import sys,json,urllib.request,re,html
UA={'User-Agent':'delphi-research/0.1'}
for doi in sys.argv[1:]:
    try:
        a=json.load(urllib.request.urlopen(urllib.request.Request('https://api.datacite.org/dois/'+doi,headers=UA),timeout=40))['data']['attributes']
        print('##',doi,'|',a['titles'][0]['title'],'|',a['publicationYear'],'|',a['publisher'],'|',[c.get('name') for c in a.get('creators',[])][:5])
        print('  URL:',a.get('url'),'| rights:',[r.get('rights') for r in a.get('rightsList',[])], '| sizes:',a.get('sizes'),'| formats:',a.get('formats'))
        for d in a.get('descriptions',[])[:2]: print('  DESC:',re.sub('<[^>]+>','',html.unescape(d['description']))[:900])
    except Exception as e: print('##',doi,'ERR',e)
