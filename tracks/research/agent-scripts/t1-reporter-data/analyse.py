#!/usr/bin/env python3
"""t1-reporter-data: reproduce design-reporter numbers from Cello UCF libraries.
Usage: python -I analyse.py <data_dir>   (data_dir holds *.UCF.json and tree.json)
Pure standard library except for numpy/scipy in the optional refit (refit.py)."""
import json, sys, os, itertools, math, hashlib, collections, re

D = sys.argv[1]
def load(fn): return json.load(open(os.path.join(D, fn), encoding='utf-8'))
def rel(a, b): return abs(a-b)/((a+b)/2)

def blobsha(path):
    b = open(path, 'rb').read()
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()

def pairs(fn, strict_only=True):
    d = load(fn)
    mods = {r['name']: {x['name']: x['value'] for x in r['parameters']} for r in d if r.get('collection') == 'models'}
    st = {r['name']: r for r in d if r.get('collection') == 'structures'}
    ptype = {r['name']: r.get('type') for r in d if r.get('collection') == 'parts'}
    fam = collections.defaultdict(list)
    for g in (r for r in d if r.get('collection') == 'gates'):
        s = st[g['structure']]
        cas = tuple([x for x in s['devices'] if 'cassette' in x['name'].lower()][0]['components'])
        fam[(g.get('regulator'), g.get('group'))].append((g['name'], mods[g['model']], cas))
    out = []
    for (reg, grp), mem in sorted(fam.items(), key=str):
        for (n1, m1, c1), (n2, m2, c2) in itertools.combinations(mem, 2):
            diff = [i for i in range(len(c1)) if c1[i] != c2[i]] if len(c1) == len(c2) else None
            one = diff is not None and len(diff) == 1
            dtype = ptype.get(c1[diff[0]]) if one else None
            dn = rel(m1['n'], m2['n']); kf = max(m1['K'], m2['K'])/min(m1['K'], m2['K'])
            S = math.log2(kf)/dn if dn > 0 else float('inf')
            out.append(dict(fam=grp, a=n1, b=n2, n1=m1['n'], n2=m2['n'], K1=m1['K'], K2=m2['K'],
                            one_pos=one, diff_type=dtype, same_cassette=(diff == []), dn=dn, kfold=kf, S=S,
                            in_scope=bool(one and dtype in ('rbs', 'kozak') and kf >= 2.0), cas1=c1, cas2=c2))
    return out

def show(fn, only_one=True):
    print('==', fn)
    for p in pairs(fn):
        if only_one and not p['one_pos'] and not p['same_cassette']: continue
        print('  %-8s %-10s %-10s n=%s/%s K=%s/%s one_pos=%s type=%s same_cassette=%s dn=%.4f kfold=%.3f S=%.2f in_scope=%s' % (
            p['fam'], p['a'], p['b'], p['n1'], p['n2'], p['K1'], p['K2'], p['one_pos'], p['diff_type'],
            p['same_cassette'], p['dn'], p['kfold'], p['S'], p['in_scope']))

print('## 0. file integrity')
tree = {t['path']: t for t in load('tree.json')['tree']}
for f in ('Eco1C1G1T1', 'Eco2C1G5T1', 'SC1C1G1T1'):
    p = os.path.join(D, f+'.UCF.json'); t = tree['library/constraints/'+f+'.UCF.json']
    print(f, 'bytes', os.path.getsize(p), 'tree_size', t['size'], 'git_blob_sha1_matches_tree', blobsha(p) == t['sha'],
          'sha256', hashlib.sha256(open(p, 'rb').read()).hexdigest())
for f in ('Eco1C2G2T2', 'Eco2C1G3T1', 'Bth1C1G1T1'):
    t = tree['library/constraints/'+f+'.UCF.json']; print('(not downloaded, holdout)', f, t['size'], t['sha'])

print('\n## 1. Eco1C1G1T1 calibration: pairs with cassettes differing in exactly one position')
cal = [p for p in pairs('Eco1C1G1T1.UCF.json') if p['one_pos']]
show('Eco1C1G1T1.UCF.json')
print('strict pairs', len(cal), 'part types at differing position', collections.Counter(p['diff_type'] for p in cal))
print('max dn over strict pairs = %.4f' % max(p['dn'] for p in cal))
ins = [p for p in cal if p['in_scope']]
print('in_scope (kfold>=2) pairs', len(ins), 'min finite S = %.2f' % min(p['S'] for p in ins if p['S'] != float('inf')))
print('SrpR S1 vs S2 cassettes:'); [print('  ', p['a'], p['b'], p['cas1'], p['cas2'], 'kfold=%.2f' % p['kfold']) for p in pairs('Eco1C1G1T1.UCF.json') if p['fam'] == 'SrpR' and p['a'].startswith('S1')]

print('\n## 2. Eco2C1G5T1 (phage)'); show('Eco2C1G5T1.UCF.json')
print('\n## 3. SC1C1G1T1 (yeast), incl. same-cassette pairs'); show('SC1C1G1T1.UCF.json')
y = pairs('SC1C1G1T1.UCF.json')
print('yeast in_scope pairs:', [(p['fam'], p['a'], p['b']) for p in y if p['in_scope']])

print('\n## 4. raw-text quantisation of n,K in Eco1C1G1T1')
raw = open(os.path.join(D, 'Eco1C1G1T1.UCF.json'), encoding='utf-8').read()
for g in ('B1_BM3R1', 'S1_SrpR'):
    i = raw.index('"name": "%s_model"' % g); seg = raw[i:i+900]
    print(g, re.findall(r'"name": "(ymax|ymin|K|n)",\s*"value": ([0-9.eE+-]+)', seg)[:4])
d = load('Eco1C1G1T1.UCF.json')
nd = [len(str(m['value']).replace('0.', '').lstrip('0')) for r in d if r.get('collection') == 'models' for m in r['parameters'] if m['name'] == 'n']
print('n sig-digit-ish lengths over 20 gates', collections.Counter(nd))
eco2 = load('Eco2C1G5T1.UCF.json')
print('Eco2C1G5T1 R1_Lambda n,K:', [(m['name'], m['value']) for r in eco2 if r.get('name') == 'R1_Lambda_model' for m in r['parameters'] if m['name'] in 'nK'])

print('\n## 5. cytometry structure in Eco1C1G1T1')
cy = [r for r in d if r.get('collection') == 'functions' and 'cytometry' in r['name']]
print('cytometry functions', len(cy)); c0 = [r for r in cy if r['name'] == 'F1_AmeR_cytometry'][0]
tb = c0.get('tables') or c0.get('table') or c0
print('keys', list(c0.keys()))
