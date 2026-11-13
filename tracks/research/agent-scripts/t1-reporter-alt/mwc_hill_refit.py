"""Refit a 4-parameter Hill curve to the IPTG titrations in flow_master.csv (Razo-Mejia et al. 2018 repo, MIT).
fc(x) = a + (b-a) * x^n / (K^n + x^n); x = IPTG in uM; a = fold change at 0 uM (fit), b = plateau (fit).
Per (operator, RBS) curve, replicate rows pooled; bootstrap = resample rows within each IPTG level (B=300, seed 1).
Usage: python mwc_hill_refit.py DATA.csv OUT.json
Needs numpy, scipy (tested numpy 2.5.3? see reproduce) """
import csv, json, sys, collections
import numpy as np
from scipy.optimize import least_squares
rows = list(csv.DictReader(open(sys.argv[1])))
rng = np.random.default_rng(1)
def hill(p, x):
    a, b, lK, n = p
    K = 10**lK
    return a + (b - a) * x**n / (K**n + x**n)
def fit(x, y):
    best = None
    for lK0 in (0.5, 1.5, 2.5, 3.5):
        for n0 in (1.0, 1.8):
            r = least_squares(lambda p: hill(p, x) - y, list(np.clip([y[x == 0].mean() if (x == 0).any() else y.min(), y.max(), lK0, n0], [-0.19, -0.19, -1.9, 0.31], [1.49, 1.49, 4.9, 5.9])),
                              bounds=([-0.2, -0.2, -2, 0.3], [1.5, 1.5, 5, 6]))
            if best is None or r.cost < best.cost: best = r
    return best
out = []
groups = collections.defaultdict(list)
for r in rows:
    if r['rbs'] in ('auto', 'delta'): continue
    groups[(r['operator'], r['rbs'], int(r['repressors']))].append((float(r['IPTG_uM']), float(r['fold_change_A'])))
for (op, rbs, R), pts in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][2])):
    x = np.array([p[0] for p in pts]); y = np.array([p[1] for p in pts])
    f = fit(x, y)
    a, b, lK, n = f.x
    levels = sorted(set(x)); byl = [y[x == l] for l in levels]
    boots = []
    for _ in range(300):
        xs = np.concatenate([[l] * len(v) for l, v in zip(levels, byl)])
        ys = np.concatenate([rng.choice(v, len(v)) for v in byl])
        fb = fit(xs, ys); boots.append(fb.x)
    boots = np.array(boots)
    ci = lambda i: [float(np.percentile(boots[:, i], 2.5)), float(np.percentile(boots[:, i], 97.5))]
    out.append(dict(operator=op, rbs=rbs, repressors=R, n_rows=len(pts), fc_zero=float(a), fc_plateau=float(b), amplitude=float(b - a),
                    EC50_uM=float(10**lK), EC50_ci=[10**ci(2)[0], 10**ci(2)[1]], hill_n=float(n), hill_n_ci=ci(3), rss=float(2 * f.cost)))
json.dump(out, open(sys.argv[2], 'w'), indent=1)
print('operator rbs R rows  fc0  plateau amp  EC50[uM] (95% CI)  n (95% CI)')
for o in out:
    print(o['operator'], o['rbs'], o['repressors'], o['n_rows'], f"{o['fc_zero']:.3f} {o['fc_plateau']:.3f} {o['amplitude']:.3f}",
          f"{o['EC50_uM']:.1f} ({o['EC50_ci'][0]:.1f}-{o['EC50_ci'][1]:.1f})", f"{o['hill_n']:.2f} ({o['hill_n_ci'][0]:.2f}-{o['hill_n_ci'][1]:.2f})")
