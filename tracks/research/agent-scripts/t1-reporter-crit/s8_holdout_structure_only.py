# STRUCTURE-ONLY look at the holdout: prints gate names, group, cassette part lists, output promoters. NEVER reads models/parameters.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
d = load('Eco1C2G2T2.UCF.json')
cnt = collections.Counter(r.get('collection') for r in d); print(dict(cnt))
st = {r['name']: r for r in d if r.get('collection') == 'structures'}
parts = {r['name']: r for r in d if r.get('collection') == 'parts'}
G = []
for g in (r for r in d if r.get('collection') == 'gates'):
    s = st[g['structure']]
    c = [x for x in s['devices'] if 'cassette' in x['name'].lower()]
    G.append((g['name'], g['group'], tuple(c[0]['components']) if c else None, tuple(s['outputs'])))
fam = collections.defaultdict(list)
for n, grp, cas, out in G: fam[grp].append((n, cas, out))
inscope = 0
for f, m in fam.items():
    print(f, len(m), [x[0] for x in m])
    for a, b in itertools.combinations(m, 2):
        if a[1] and b[1] and len(a[1]) == len(b[1]):
            diff = [i for i in range(len(a[1])) if a[1][i] != b[1][i]]
            if len(diff) == 1 and a[2] == b[2]:
                t = parts.get(a[1][diff[0]], {}).get('type'); inscope += (t == 'rbs')
                print('   strict pair', a[0], b[0], 'differs at', a[1][diff[0]], b[1][diff[0]], 'type', t)
print('strict RBS-only pairs (same outputs):', inscope, 'gates:', len(G))
old = set(g['name'] for g in gates(load('Eco1C1G1T1.UCF.json'))); new = set(x[0] for x in G)
print('gate names shared with Eco1C1G1T1:', sorted(old & new), 'new-only:', len(new - old))
oldc = {g['name']: g['cas'] for g in gates(load('Eco1C1G1T1.UCF.json'))}
print('identical cassette part list to Eco1C1G1T1 gate of same name:', sum(1 for x in G if oldc.get(x[0]) == x[2]))
