import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
for fn in ('Eco1C1G1T1','Eco2C1G5T1','SC1C1G1T1'):
    d = load(fn + '.UCF.json')
    h = [r for r in d if r.get('collection') == 'header'][0]
    print('==', fn, '|', h.get('organism'), '|', h.get('date'), '|', h.get('description'))
    gs = gates(d); print('  gates', len(gs), 'with n:', sum('n' in g['par'] for g in gs))
    for p in sorted(pairs(gs), key=lambda p: (p['fam'], p['a'])):
        print('  %-8s %-14s %-14s ptype=%-6s n=%s/%s K=%s/%s dn=%.4f kf=%.3f S=%.2f ymax=%s/%s ymin=%s/%s' % (
            p['fam'], p['a'], p['b'], p['ptype'], p['na'], p['nb'], p['Ka'], p['Kb'], p['dn'], p['kf'], p['S'], p['yma'], p['ymb'], p['yia'], p['yib']))
