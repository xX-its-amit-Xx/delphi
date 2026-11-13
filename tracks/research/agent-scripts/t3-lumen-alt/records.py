import json,urllib.request,sys
UA={'User-Agent':'delphi-research/0.1'}
def g(u):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
    except Exception as e: return {'error':str(e)}
for rid in ['15005334','5535691']:
    d=g(f'https://zenodo.org/api/records/{rid}')
    if 'error' in d: print(rid,d); continue
    print(rid,d['metadata'].get('title'),d['metadata'].get('publication_date'),d['metadata'].get('license'))
    for f in d.get('files',[])[:15]: print('   ',f['key'],f['size'])
    print('   total files',len(d.get('files',[])))
d=g('https://api.github.com/repos/WenjieShi8514/Physics_tube'); print({k:d.get(k) for k in ['full_name','size','license','pushed_at','message']}); print(d.get('license'))
d=g('https://api.github.com/repos/WenjieShi8514/Physics_tube/contents'); print([ (x['name'],x['size']) for x in d] if isinstance(d,list) else d)
