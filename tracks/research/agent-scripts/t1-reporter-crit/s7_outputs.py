import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
for fn in ('Eco1C1G1T1', 'Eco2C1G5T1', 'SC1C1G1T1'):
    d = load(fn + '.UCF.json')
    st = {r['name']: r for r in d if r.get('collection') == 'structures'}
    gm = {r['name']: r for r in d if r.get('collection') == 'gates'}
    parts = {r['name']: r for r in d if r.get('collection') == 'parts'}
    for p in pairs(gates(d)):
        oa = st[gm[p['a']]['structure']]['outputs']; ob = st[gm[p['b']]['structure']]['outputs']
        # sequence of the output promoters
        sa = [parts[o]['dnasequence'] if o in parts and 'dnasequence' in parts[o] else None for o in oa]
        sb = [parts[o]['dnasequence'] if o in parts and 'dnasequence' in parts[o] else None for o in ob]
        print('%s %s/%s outputs %s vs %s | same name: %s | same sequence: %s' % (fn, p['a'], p['b'], oa, ob, oa == ob, sa == sb))
