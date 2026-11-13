import json,sys,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
import time
for q in sys.argv[1:]:
    time.sleep(3)
    u='https://api.crossref.org/works?rows=6&select=DOI,title,issued,container-title,author&query.bibliographic='+urllib.parse.quote(q)
    print('##',q)
    for m in json.loads(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read())['message']['items']:
        yr=(m.get('issued',{}).get('date-parts') or [[None]])[0][0]
        print(' ',yr,m['DOI'],(m.get('title') or [''])[0][:95],'|',(m.get('container-title') or [''])[0][:40],'|',', '.join(a.get('family','') for a in m.get('author',[])[:2]))
