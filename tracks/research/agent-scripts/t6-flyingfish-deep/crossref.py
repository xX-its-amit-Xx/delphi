import json,sys,urllib.request,urllib.parse,re,html
UA={'User-Agent':'delphi-research/0.1'}
def get(u): return json.loads(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read())
dois=sys.argv[1:]
for d in dois:
    try:
        m=get('https://api.crossref.org/works/'+urllib.parse.quote(d))['message']
        a=re.sub('<[^>]+>','',m.get('abstract','') or '')
        yr=(m.get('issued',{}).get('date-parts') or [[None]])[0][0]
        print('OK',d,'|',yr,'|',m['title'][0][:110],'|',(m.get('container-title') or [''])[0],m.get('volume'),m.get('page'),'|',', '.join(x.get('family','') for x in m.get('author',[])[:4]))
        if a: print('   ABS:',html.unescape(a)[:900])
    except Exception as e: print('FAIL',d,e)
