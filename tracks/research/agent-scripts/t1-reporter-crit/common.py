import json, itertools, math, collections, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DATA = "D:/Users/ashenoy00000/delphi-work/data/cello-ucf/"
def load(fn): return json.load(open(DATA + fn, encoding='utf-8'))
def gates(d):
    mods = {r['name']: {x['name']: x['value'] for x in r['parameters']} for r in d if r.get('collection') == 'models'}
    modrec = {r['name']: r for r in d if r.get('collection') == 'models'}
    st = {r['name']: r for r in d if r.get('collection') == 'structures'}
    out = []
    parts = {r['name']: r for r in d if r.get('collection') == 'parts'}
    for g in (r for r in d if r.get('collection') == 'gates'):
        s = st.get(g.get('structure')); cas = None
        if s:
            c = [x for x in s['devices'] if 'cassette' in x['name'].lower()]
            cas = tuple(c[0]['components']) if c else None
        out.append(dict(name=g['name'], group=g.get('group'), regulator=g.get('regulator'), system=g.get('system'),
                        par=mods.get(g['model'], {}), cas=cas, model=modrec.get(g['model']), parts=parts))
    return out
def rel(a, b): return abs(a - b) / ((a + b) / 2)
def pairs(gs, strict_only=True):
    fam = collections.defaultdict(list)
    for g in gs: fam[g['group'] or g['regulator']].append(g)
    res = []
    for f, mem in fam.items():
        for a, b in itertools.combinations(mem, 2):
            if not a['cas'] or not b['cas'] or len(a['cas']) != len(b['cas']): continue
            diff = [i for i in range(len(a['cas'])) if a['cas'][i] != b['cas'][i]]
            if len(diff) != 1: continue
            i = diff[0]
            pa = a['parts'].get(a['cas'][i]); ptype = pa['type'] if pa else '?'
            dn = rel(a['par']['n'], b['par']['n'])
            kf = max(a['par']['K'], b['par']['K']) / min(a['par']['K'], b['par']['K'])
            S = math.log2(kf) / dn if dn > 0 else float('inf')
            res.append(dict(fam=f, a=a['name'], b=b['name'], ptype=ptype, na=a['par']['n'], nb=b['par']['n'],
                            Ka=a['par']['K'], Kb=b['par']['K'], dn=dn, kf=kf, S=S,
                            yma=a['par']['ymax'], ymb=b['par']['ymax'], yia=a['par']['ymin'], yib=b['par']['ymin']))
    return res
