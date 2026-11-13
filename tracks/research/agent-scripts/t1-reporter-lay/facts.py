# Reads the (already downloaded) Eco1C1G1T1 UCF and prints the facts used in the lay explanation.
# Run: python -I facts.py <path to Eco1C1G1T1.UCF.json>
import json,sys,hashlib,collections,itertools,math
p=sys.argv[1]
raw=open(p,'rb').read()
print('bytes',len(raw),'sha256',hashlib.sha256(raw).hexdigest())
d=json.loads(raw.decode('utf-8'))
print('collections',collections.Counter(r.get('collection') for r in d))
h=[r for r in d if r.get('collection')=='header'][0]
print('header.description:',h['description']); print('organism:',h['organism']); print('temp',h['temperature'])
print('growth:',h['growth'])
ms=[r for r in d if r.get('collection')=='measurement_std'][0]
print('measurement_std:',json.dumps(ms)[:600])
fn=[r for r in d if r.get('collection')=='functions']
for f in fn: print('function',f['name'],f.get('equation'))
mods={r['name']:{x['name']:x['value'] for x in r['parameters']} for r in d if r.get('collection')=='models'}
st={r['name']:r for r in d if r.get('collection')=='structures'}
gates=[r for r in d if r.get('collection')=='gates']
print('n gates',len(gates), 'n models',len(mods))
cyt=[r for r in d if r.get('collection')=='models' and r.get('functions') and 'cytometry' in json.dumps(r.get('functions'))]
for r in d:
    if r.get('collection')=='models' and r['name'] in('B1_BM3R1_model','B2_BM3R1_model','B3_BM3R1_model','P1_PhlF_model','S1_SrpR_model','S2_SrpR_model'):
        print(r['name'],{x['name']:x['value'] for x in r['parameters']})
def rel(a,b): return abs(a-b)/((a+b)/2)
rows=[]
fam=collections.defaultdict(list)
for g in gates:
    s=st.get(g.get('structure')); cas=None
    if s:
        c=[x for x in s['devices'] if 'cassette' in x['name'].lower()]
        cas=tuple(c[0]['components']) if c else None
    fam[g.get('group') or g.get('regulator')].append((g['name'],mods.get(g['model'],{}),cas))
for f,mem in sorted(fam.items()):
    for (n1,m1,c1),(n2,m2,c2) in itertools.combinations(mem,2):
        if not c1 or not c2 or len(c1)!=len(c2) or 'n' not in m1 or 'n' not in m2: continue
        diff=[i for i in range(len(c1)) if c1[i]!=c2[i]]
        if len(diff)!=1: continue
        dn=rel(m1['n'],m2['n']); kf=max(m1['K'],m2['K'])/min(m1['K'],m2['K'])
        print('PAIR',f,n1,n2,'differs:',c1[diff[0]],'vs',c2[diff[0]],'n',m1['n'],m2['n'],'K',m1['K'],m2['K'],'dn=%.4f Kfold=%.3f'%(dn,kf))
