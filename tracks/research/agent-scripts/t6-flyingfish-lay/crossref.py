import json,re,sys,urllib.request,urllib.parse
for doi in sys.argv[1:]:
    r=urllib.request.Request('https://api.crossref.org/works/'+urllib.parse.quote(doi),headers={'User-Agent':'delphi-research/0.1'})
    try:
        m=json.load(urllib.request.urlopen(r,timeout=30))['message']
        ab=re.sub('<[^>]+>','',m.get('abstract','') or '')
        print(doi,'| OK |',m['title'][0],'|',m.get('issued',{}).get('date-parts'),'|',m.get('container-title'))
        print('   ABS:',ab[:900])
    except Exception as e: print(doi,'FAIL',e)
