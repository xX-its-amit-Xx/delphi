import sys,json,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding='utf8')
def q(s,n=5):
    u="https://api.crossref.org/works?"+urllib.parse.urlencode({'query.bibliographic':s,'rows':n,'select':'DOI,title,author,issued,container-title'})
    r=urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'})
    d=json.load(urllib.request.urlopen(r,timeout=40))
    for x in d['message']['items']:
        print(x['DOI'],'|',(x.get('title') or [''])[0][:110],'|',x.get('issued',{}).get('date-parts',[[None]])[0][0],'|',(x.get('container-title') or [''])[0][:40],'|',(x.get('author') or [{}])[0].get('family'))
def doi(d):
    r=urllib.request.Request("https://api.crossref.org/works/"+d,headers={'User-Agent':'delphi-research/0.1'})
    m=json.load(urllib.request.urlopen(r,timeout=40))['message']
    print('OK',d,'|',m['title'][0][:130],'|',m['issued']['date-parts'][0][0],'|',(m.get('container-title') or [''])[0],'|',m.get('author',[{}])[0].get('family'))
if __name__=='__main__':
    mode=sys.argv[1]
    for a in sys.argv[2:]:
        print('##',a)
        try: (q if mode=='q' else doi)(a)
        except Exception as e: print('ERR',e)
