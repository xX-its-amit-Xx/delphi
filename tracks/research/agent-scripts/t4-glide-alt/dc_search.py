import sys,json,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
for s in sys.argv[1:]:
    u='https://api.datacite.org/dois?page%5Bsize%5D=6&query='+urllib.parse.quote(s)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
        print('Q:',s,'total',d['meta']['total'])
        for it in d['data']:
            a=it['attributes']
            print(' ',a['doi'],'|',(a['titles'] or [{}])[0].get('title','')[:100],'|',a.get('publicationYear'),'|',a.get('publisher'),'|',(a.get('rightsList') or [{}])[0].get('rights'))
    except Exception as e: print('ERR',s,e)
