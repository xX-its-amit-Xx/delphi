import sys,json,urllib.request,re,html
UA={'User-Agent':'delphi-research/0.1'}
for doi in sys.argv[1:]:
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/'+doi,headers=UA),timeout=40))['message']
        a=re.sub('<[^>]+>','',html.unescape(d.get('abstract','') or ''))
        print('##',doi,'|',d['title'][0],'|',d.get('container-title'),'|',d['issued']['date-parts'][0][0],'|',d.get('license',[{}])[0].get('URL') if d.get('license') else '')
        print('  ABS:',a[:1800] or '(none)')
    except Exception as e: print('##',doi,'ERR',e)
