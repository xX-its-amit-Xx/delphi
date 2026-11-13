import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
y = load('SC1C1G1T1.UCF.json')
st = {r['name']: r for r in y if r.get('collection') == 'structures'}
for g in (r for r in y if r.get('collection') == 'gates' and r['group'] in ('CI', 'CI434', 'LexA')):
    print(g['name'], json.dumps({k: v for k, v in g.items() if k not in ('collection',)}), '\n   ', json.dumps(st[g['structure']]['devices']), st[g['structure']].get('outputs'))
m = {r['name']: r for r in y if r.get('collection') == 'models'}
for n in ('P1_CI_model', 'P2_CI_model'): print(n, {x['name']: x['value'] for x in m[n]['parameters']})
p = [r for r in y if r.get('collection') == 'parts' and r['name'] in ('Kozak12', 'Kozak15', 'Kozak24', 'Kozak14')]
for r in p: print(r['name'], r['type'], r.get('dnasequence'))
