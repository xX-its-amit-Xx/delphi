import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import numpy as np
from scipy.optimize import least_squares
rng = np.random.default_rng(20261112)
d = load('Eco1C1G1T1.UCF.json'); gs = gates(d)
cyt = {r['name']: r['table'] for r in d if r.get('collection') == 'functions' and r['name'].endswith('_cytometry')}
def hill(x, ymax, ymin, K, n): return ymin + (ymax - ymin) / (1 + (x / K) ** n)
def hist_median(bins, out):
    b = np.array(bins); w = np.array(out); c = np.cumsum(w) / w.sum()
    i = np.searchsorted(c, 0.5); 
    # interpolate in log space between bins
    if i == 0: return b[0]
    f = (0.5 - c[i-1]) / (c[i] - c[i-1])
    return float(np.exp(np.log(b[i-1]) + f * (np.log(b[i]) - np.log(b[i-1]))))
def fit(x, m, starts=60):
    ly = np.log10(m)
    best = None
    for _ in range(starts):
        p0 = [10 ** rng.uniform(np.log10(m.max()) - .3, np.log10(m.max()) + .5), 10 ** rng.uniform(np.log10(m.min()) - .5, np.log10(m.min()) + .3),
              10 ** rng.uniform(-2.5, 0.5), rng.uniform(.8, 5)]
        try:
            r = least_squares(lambda p: ly - np.log10(np.maximum(hill(x, *p), 1e-9)), p0,
                              bounds=([1e-3, 1e-5, 1e-3, 0.3], [1e3, 1e1, 1e2, 12]))
        except Exception: continue
        if best is None or r.cost < best.cost: best = r
    return best
rows = []
for g in gs:
    t = cyt[g['name'].split('_')[0] + '_' + g['name'].split('_')[1] + '_cytometry'] if (g['name'].split('_')[0] + '_' + g['name'].split('_')[1] + '_cytometry') in cyt else None
    if t is None: print('no cyt', g['name']); continue
    x = np.array([e['x'] for e in t]); m = np.array([hist_median(e['bin'], e['output']) for e in t])
    mono = bool(np.all(np.diff(m) <= 1e-12))
    r = fit(x, m)
    ymax, ymin, K, n = r.x
    # SE of n via Jacobian (log-space), dof = 12-4
    J = r.jac; s2 = 2 * r.cost / (len(x) - 4)
    try: cov = np.linalg.inv(J.T @ J) * s2; se_n = float(np.sqrt(cov[3, 3]))
    except Exception: se_n = float('nan')
    p = g['par']
    rows.append(dict(name=g['name'], grp=g['group'], n_ship=p['n'], K_ship=p['K'], ymax_ship=p['ymax'], ymin_ship=p['ymin'],
                     n_fit=n, K_fit=K, ymax_fit=ymax, ymin_fit=ymin, se_n=se_n, rms=float(np.sqrt(2 * r.cost / len(x))), mono=mono,
                     at_bound=bool(n > 11.9 or n < .31 or K < 1.01e-3 or ymin < 1.01e-5)))
    print('%-12s ship n=%.2f K=%.3f ymax=%.2f ymin=%.3f | fit n=%.2f(se %.2f) K=%.3f ymax=%.2f ymin=%.3f rms_log10=%.3f mono=%s bound=%s' % (
        g['name'], p['n'], p['K'], p['ymax'], p['ymin'], n, se_n, K, ymax, ymin, rows[-1]['rms'], mono, rows[-1]['at_bound']))
ns = np.array([r['n_ship'] for r in rows]); nf = np.array([r['n_fit'] for r in rows])
print('Pearson r (n refit vs shipped, 20 gates): %.3f' % np.corrcoef(ns, nf)[0, 1])
ratio = nf / ns; print('ratio refit/shipped: min %.2f max %.2f; gates outside [1/1.5,1.5]: %d' % (ratio.min(), ratio.max(), int(np.sum((ratio > 1.5) | (ratio < 1 / 1.5)))))
# Spearman
from scipy.stats import spearmanr
print('Spearman: %.3f' % spearmanr(ns, nf)[0])
# trivial baseline: r between shipped n and a family-mean predictor is trivially high? compute r of n_ship vs the group-mean of n_ship (leave nothing out)
# refit dn for strict pairs
R = {r['name']: r for r in rows}
print('refit dn for strict pairs:')
bad = 0; out = []
for p in pairs(gs):
    a, b = R[p['a']], R[p['b']]
    dn_fit = rel(a['n_fit'], b['n_fit']); out.append(dn_fit)
    # propagate se
    print('  %s/%s ship dn=%.4f  refit dn=%.4f (n_fit %.2f vs %.2f, se %.2f, %.2f)' % (p['a'], p['b'], p['dn'], dn_fit, a['n_fit'], b['n_fit'], a['se_n'], b['se_n']))
print('max refit dn %.4f; pairs >0.25: %d; median refit dn %.4f' % (max(out), sum(x > .25 for x in out), float(np.median(out))))
json.dump(rows, open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-crit/refit_rows.json', 'w'), indent=1)
