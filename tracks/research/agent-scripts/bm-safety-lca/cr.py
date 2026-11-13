"""Crossref helper. python -I cr.py doi <doi> | python -I cr.py q "<bibliographic query>" [n]"""
import re,sys,json,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding='utf8',errors='replace')
H={'User-Agent':'delphi-research/0.1'}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60))
def show(m):
    a=', '.join((x.get('family','')+' '+x.get('given','')[:1]) for x in m.get('author',[])[:4])
    yr=(m.get('issued',{}).get('date-parts') or [[None]])[0][0]
    print(m.get('DOI'),'|',yr,'|',(m.get('title') or [''])[0][:130],'|',(m.get('container-title') or [''])[0],'|',a)
if sys.argv[1]=='doi':
    for d in [a for a in sys.argv[2:] if not a.startswith('--')]:
        try:
            m=get('https://api.crossref.org/works/'+urllib.parse.quote(d))['message']; show(m)
            if '--abs' in sys.argv: print('ABSTRACT:',re.sub(r'<[^>]+>','',m.get('abstract','(none in Crossref)')))
        except Exception as e: print(d,'ERR',e)
else:
    n=sys.argv[3] if len(sys.argv)>3 else '5'
    for m in get('https://api.crossref.org/works?'+urllib.parse.urlencode({'query.bibliographic':sys.argv[2],'rows':n,'select':'DOI,title,author,issued,container-title'}))['message']['items']: show(m)
