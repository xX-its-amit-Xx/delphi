import json,os,sys
R='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/'
U='D:/Users/ashenoy00000/delphi-work/upstream/leanbio/lean/registry/lawsets/lawset-1.6.0.json'
n=json.load(open(R+'lawsets/lawset-1.8.1.json'))['laws']
o=json.load(open(U))['laws']
ni={l['law_id']:l for l in n}; oi={l['law_id']:l for l in o}
print('1.8.1 pinned',len(n),'1.6.0 pinned',len(o))
print('only in 1.8.1',sorted(set(ni)-set(oi)))
print('only in 1.6.0',sorted(set(oi)-set(ni)))
for k in sorted(set(ni)&set(oi)):
    a,b=oi[k],ni[k]
    if a['status']!=b['status'] or a['version']!=b['version'] or a['content_hash']!=b['content_hash']:
        print('changed',k,a['status'],a['version'],'->',b['status'],b['version'])
from collections import Counter
print(Counter(l['status'] for l in n))
