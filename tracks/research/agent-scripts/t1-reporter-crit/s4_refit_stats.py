import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import numpy as np
rows = json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-crit/refit_rows.json'))
d = load('Eco1C1G1T1.UCF.json'); gs = gates(d)
alpha = {g['name']: g['par'].get('alpha') for g in gs}
R = {r['name']: r for r in rows}
print('ymax_ship/ymax_fit vs alpha (first 20):')
rat = []
for r in rows:
    q = r['ymax_ship'] / r['ymax_fit']; rat.append((q, alpha[r['name']]))
    print('  %-10s ship/fit=%.3f alpha=%.3f' % (r['name'], q, alpha[r['name']]))
a = np.array(rat); print('corr(ship/fit ymax, alpha)= %.3f' % np.corrcoef(a[:, 0], a[:, 1])[0, 1])
Kr = np.array([r['K_fit'] / r['K_ship'] for r in rows]); print('K_fit/K_ship: median %.2f min %.2f max %.2f' % (np.median(Kr), Kr.min(), Kr.max()))
print('Pearson r(log K_fit, log K_ship)= %.3f' % np.corrcoef(np.log([r['K_fit'] for r in rows]), np.log([r['K_ship'] for r in rows]))[0, 1])
print('pairs: ship Kfold vs refit Kfold, z of n difference, S refit')
zs = []; dns = []; dnf = []
for p in pairs(gs):
    a, b = R[p['a']], R[p['b']]
    kfr = max(a['K_fit'], b['K_fit']) / min(a['K_fit'], b['K_fit'])
    # orientation check: which gate has larger K in ship vs fit
    same_order = (a['K_ship'] > b['K_ship']) == (a['K_fit'] > b['K_fit'])
    z = abs(a['n_fit'] - b['n_fit']) / math.hypot(a['se_n'], b['se_n'])
    dn_f = rel(a['n_fit'], b['n_fit']); zs.append(z); dns.append(p['dn']); dnf.append(dn_f)
    zs_ship = abs(p['na'] - p['nb']) / math.hypot(a['se_n'], b['se_n'])
    print('  %s/%s kf ship=%.2f refit=%.2f order_same=%s | z(refit)=%.2f z(ship n diff / refit se)=%.2f | S refit=%.1f' % (
        p['a'], p['b'], p['kf'], kfr, same_order, z, zs_ship, math.log2(kfr) / dn_f))
print('max z refit = %.2f; pairs with z>2: %d of %d' % (max(zs), sum(z > 2 for z in zs), len(zs)))
print('corr(ship dn, refit dn) over 10 pairs = %.3f' % np.corrcoef(dns, dnf)[0, 1])
sd = np.sqrt(np.mean([(math.hypot(R[p['a']]['se_n'], R[p['b']]['se_n']) / ((R[p['a']]['n_fit'] + R[p['b']]['n_fit']) / 2)) ** 2 for p in pairs(gs)]))
print('typical SE of dn from fit (rms) = %.3f' % sd)
print('rms dn calibration shipped = %.3f' % np.sqrt(np.mean(np.square(dns))))
# within-family variance vs total variance of n (why r is high)
ns = np.array([R[k]['n_ship'] for k in R]); print('sd of n across 20 gates %.2f' % ns.std(ddof=1))
print('gates with strictly monotone median: %d/20' % sum(r['mono'] for r in rows))
# how many strict calibration pairs survive a monotonicity exclusion rule
ok = {k for k, r in R.items() if r['mono']}
print('strict pairs with both gates monotone: %d/10' % sum(p['a'] in ok and p['b'] in ok for p in pairs(gs)))
