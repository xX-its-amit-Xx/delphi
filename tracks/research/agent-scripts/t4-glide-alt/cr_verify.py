import sys,json,urllib.request,time
UA={'User-Agent':'delphi-research/0.1'}
for doi in sys.argv[1:]:
    time.sleep(1.2)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/'+doi,headers=UA),timeout=40))['message']
        print('OK',doi,'|',d['title'][0][:90].encode('ascii','replace').decode(),'|',d['issued']['date-parts'][0][0])
    except Exception as e: print('FAIL',doi,e)
