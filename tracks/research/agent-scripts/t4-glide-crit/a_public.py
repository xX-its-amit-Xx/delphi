"""Recompute the public-data numbers the design relies on."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
d = load('all_results_experiments.pkl')
tab = {}
for psi in sorted(d):
    for rc in sorted(d[psi]):
        KL = 60.0 / (1000 if rc == 10000 else rc)
        for w in sorted(d[psi][rc]):
            reps = d[psi][rc][w]
            us = np.array([abs(float(reps[i]['u mean'])) for i in reps])
            tab[(psi, round(KL, 3), w)] = us
print('series: psi, KL, mass keys, n drops per cell')
for psi in sorted(d):
    ks = sorted({k[1] for k in tab if k[0] == psi})
    ws = sorted({k[2] for k in tab if k[0] == psi})
    print(psi, 'n KL', len(ks), 'mass keys', ws, 'n reps', sorted({len(v) for k, v in tab.items() if k[0] == psi}))
# number of distinct masses per (psi,KL) series, and R2 of U^2 vs mass
for psi in sorted(d):
    for KL in sorted({k[1] for k in tab if k[0] == psi}):
        ws = sorted(w for (p, k, w) in tab if p == psi and k == KL)
        if len(ws) >= 2:
            u = np.array([tab[(psi, KL, w)].mean() for w in ws])
            print(' psi', psi, 'KL', KL, 'n masses', len(ws), 'mass keys', ws, 'U', np.round(u, 4))
ref = bem.eq(35, 1.2)[0]; rref = rmax(35, 1.2)
# main 2.16 g-key data
pub = {}
for (psi, KL, w), us in tab.items():
    if abs(w - 2.16) < 1e-6:
        pub[(psi, KL)] = us
print('\n2.16-key cells:')
for k, v in sorted(pub.items()):
    print(k, 'n', len(v), 'mean %.4f sd %.4f CV%% %.1f' % (v.mean(), v.std(ddof=1), 100 * v.std(ddof=1) / v.mean()))
ctrl = pub.get((35, 1.2))
print('control psi35 KL1.2 present?', ctrl is not None, '; keys psi35:', [k for k in pub if k[0] == 35])
