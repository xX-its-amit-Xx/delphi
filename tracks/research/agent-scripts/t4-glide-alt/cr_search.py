import sys,json,urllib.request,urllib.parse
UA={'User-Agent':'delphi-research/0.1'}
def q(query,rows=4):
    u='https://api.crossref.org/works?rows=%d&select=DOI,title,author,issued,container-title&query.bibliographic=%s'%(rows,urllib.parse.quote(query))
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
    for it in d['message']['items']:
        au=', '.join(a.get('family','') for a in it.get('author',[])[:3])
        print(' ',it['DOI'],'|',(it.get('title') or [''])[0][:110],'|',au,'|',it.get('issued',{}).get('date-parts',[[None]])[0][0],'|',(it.get('container-title') or [''])[0][:40])
for s in sys.argv[1:]:
    print('Q:',s)
    try:q(s)
    except Exception as e:print('ERR',e)
