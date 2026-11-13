import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import numpy as np, random, itertools
d = load('Eco1C1G1T1.UCF.json'); gs = gates(d)
print('--- cassettes Eco1C1G1T1 multi-gate families')
for g in sorted(gs, key=lambda g: g['name']):
    if g['group'] in ('SrpR', 'BM3R1', 'PhlF', 'QacR'): print('  ', g['name'], g['cas'])
print('--- all 20 gates: strict-pair count by family size')
y = load('SC1C1G1T1.UCF.json'); yg = gates(y)
print('--- yeast gates')
for g in sorted(yg, key=lambda g: (g['group'] or '', g['name'])): print('  ', g['name'], g['group'], g['cas'], 'n=%s K=%s' % (g['par'].get('n'), g['par'].get('K')))
# yeast: families that have >=2 gates
# Mann-Whitney exact permutation: TetR vs phage dn
tet = [p['dn'] for p in pairs(gs)]; ph = [p['dn'] for p in pairs(gates(load('Eco2C1G5T1.UCF.json')))]
obs = np.mean(ph) - np.mean(tet); allv = tet + ph; cnt = 0; tot = 0
for idx in itertools.combinations(range(len(allv)), len(ph)):
    s = [allv[i] for i in idx]; r = [allv[i] for i in range(len(allv)) if i not in idx]
    tot += 1; cnt += (np.mean(s) - np.mean(r)) >= obs - 1e-12
print('TetR (n=%d, mean %.4f) vs phage (n=%d, mean %.4f): exact permutation one-sided p = %d/%d = %.4f (pairs not independent: shared gates)' % (len(tet), np.mean(tet), len(ph), np.mean(ph), cnt, tot, cnt / tot))
# family-level: mean dn per family
fam_tet = collections.defaultdict(list)
for p in pairs(gs): fam_tet[p['fam']].append(p['dn'])
fam_ph = collections.defaultdict(list)
for p in pairs(gates(load('Eco2C1G5T1.UCF.json'))): fam_ph[p['fam']].append(p['dn'])
print('family max dn TetR:', {k: round(max(v), 4) for k, v in fam_tet.items()}, 'phage:', {k: round(max(v), 4) for k, v in fam_ph.items()})
# P4: probability that new max over m pairs exceeds 0.2124 when drawn from calib TetR pool
random.seed(3)
for m in (3, 6, 9, 12):
    N = 100000; pe = sum(max(random.choice(tet) for _ in range(m)) > 0.2124 for _ in range(N)) / N
    pp = sum(max(random.choice(tet + ph) for _ in range(m)) > 0.2124 for _ in range(N)) / N
    print('P4 refutation (TetR max>0.2124) m=%d: if TetR~calib pool %.3f ; if TetR~calib+phage pool %.3f' % (m, pe, pp))
# within-family r for refit
rows = json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-crit/refit_rows.json'))
fam = collections.defaultdict(list)
for r in rows: fam[r['grp']].append(r)
xs = []; ys = []
for f, m in fam.items():
    if len(m) < 2: continue
    ms = np.mean([r['n_ship'] for r in m]); mf = np.mean([r['n_fit'] for r in m])
    for r in m: xs.append(r['n_ship'] - ms); ys.append(r['n_fit'] - mf)
print('within-family r (centered n, %d gates in 4 multi-gate families): %.3f' % (len(xs), np.corrcoef(xs, ys)[0, 1]))
# ymax / ymin invariance in strict pairs
print('--- ymax ratio, ymin ratio per strict pair (all libs)')
for fn in ('Eco1C1G1T1', 'Eco2C1G5T1', 'SC1C1G1T1'):
    for p in pairs(gates(load(fn + '.UCF.json'))):
        print('  %s %s/%s ymax ratio %.2f ymin ratio %.2f kf %.2f dn %.3f' % (fn, p['a'], p['b'], max(p['yma'], p['ymb']) / min(p['yma'], p['ymb']), max(p['yia'], p['yib']) / min(p['yia'], p['yib']), p['kf'], p['dn']))
