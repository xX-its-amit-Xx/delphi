"""Fetch the small source files of lamm-mit/CategoryTheoryDesign (no videos, no .3dm, no pngs) and record sha256."""
import json,hashlib,os,urllib.request,datetime,sys
OUT=sys.argv[1] if len(sys.argv)>1 else r'D:/Users/ashenoy00000/delphi-work/data/bm-cat-papers/repo'
req=lambda u:urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'})
tree=json.load(urllib.request.urlopen(req('https://api.github.com/repos/lamm-mit/CategoryTheoryDesign/git/trees/main?recursive=1')))
rows=[]
for t in tree['tree']:
    p=t['path']
    if t['type']!='blob': continue
    if not (p.startswith('gh_scripts/') or p.startswith('g-code/') or p in('README.md','CITATION.cff','LICENSE','ct_design.gh')): continue
    if p.endswith('.png'): continue
    b=urllib.request.urlopen(req('https://raw.githubusercontent.com/lamm-mit/CategoryTheoryDesign/main/'+p)).read()
    fp=os.path.join(OUT,p); os.makedirs(os.path.dirname(fp),exist_ok=True); open(fp,'wb').write(b)
    rows.append((p,len(b),hashlib.sha256(b).hexdigest()))
open(os.path.join(OUT,'MANIFEST.tsv'),'w').write('fetched %s UTC from raw.githubusercontent.com\n'%datetime.datetime.utcnow().isoformat()+'\n'.join('%s\t%d\t%s'%r for r in rows))
print(len(rows),sum(r[1] for r in rows))
