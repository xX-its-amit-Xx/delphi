#!/usr/bin/env python3
"""P3 refit (design-reporter step 1): refit Hill params from shipped cytometry histograms.
Usage: python -I refit.py <Eco1C1G1T1.UCF.json>  (needs numpy, scipy)
Freeze choices from design: level summary = histogram median (log10 space), log10-space least squares, multi-start."""
import json, sys, itertools, math
import numpy as np
from scipy.optimize import least_squares
d = json.load(open(sys.argv[1], encoding='utf-8'))
mods = {r['name']: {x['name']: x['value'] for x in r['parameters']} for r in d if r.get('collection') == 'models'}
cyt = {r['name']: r for r in d if r.get('collection') == 'functions' and 'cytometry' in r['name']}
gates = [r for r in d if r.get('collection') == 'gates']
def hill(x, ymax, ymin, K, n): return ymin + (ymax-ymin)/(1+(x/K)**n)
def wmedian(b, w):
    b = np.asarray(b, float); w = np.asarray(w, float); o = np.argsort(b); b, w = b[o], w[o]
    c = np.cumsum(w); return float(np.interp(0.5*c[-1], c, b))
res = {}
for g in gates:
    m = mods[g['model']]; t = cyt[m_f] if (m_f := g['name']+'_cytometry') in cyt else cyt[g['model'].replace('_model', '_cytometry')]
    xs = np.array([row['x'] for row in t['table']]); meds = np.array([wmedian(row['bin'], row['output']) for row in t['table']])
    o = np.argsort(xs); xs, meds = xs[o], meds[o]
    mono = bool(np.all(np.diff(meds) <= 0))
    best = None
    for K0, n0 in itertools.product([0.01, 0.05, 0.2, 1.0], [1.0, 2.0, 4.0]):
        p0 = np.log([meds.max(), meds.min(), K0, n0])
        f = lambda p: np.log10(hill(xs, *np.exp(p))) - np.log10(meds)
        try: r = least_squares(f, p0)
        except Exception: continue
        if best is None or r.cost < best.cost: best = r
    ymax, ymin, K, n = np.exp(best.x)
    res[g['name']] = dict(group=g['group'], mono=mono, n_ref=m['n'], K_ref=m['K'], n_fit=float(n), K_fit=float(K), ymax_fit=float(ymax), ymin_fit=float(ymin), cost=float(best.cost))
    print('%-10s mono=%s n_ship=%.2f n_fit=%.2f K_ship=%.3f K_fit=%.3f' % (g['name'], mono, m['n'], n, m['K'], K, ))
ng = list(res)
a = np.array([res[k]['n_ref'] for k in ng]); b = np.array([res[k]['n_fit'] for k in ng])
print('N gates', len(ng), 'non-monotone', [k for k in ng if not res[k]['mono']])
print('Pearson r(n_fit, n_ship) = %.3f' % np.corrcoef(a, b)[0, 1])
rat = b/a; print('n_fit/n_ship ratio min %.2f median %.2f max %.2f; gates outside [1/1.5,1.5]: %s' % (rat.min(), np.median(rat), rat.max(), [k for k, r in zip(ng, rat) if r > 1.5 or r < 1/1.5]))
Ka = np.array([res[k]['K_ref'] for k in ng]); Kb = np.array([res[k]['K_fit'] for k in ng])
print('Pearson r(log K_fit, log K_ship) = %.3f' % np.corrcoef(np.log(Ka), np.log(Kb))[0, 1])
# 10 strict calibration pairs: same group, cassette differs at exactly one position
st = {r['name']: r for r in d if r.get('collection') == 'structures'}
cas = {g['name']: tuple([x for x in st[g['structure']]['devices'] if 'cassette' in x['name'].lower()][0]['components']) for g in gates}
dns = []
for x, y in itertools.combinations(ng, 2):
    if res[x]['group'] != res[y]['group']: continue
    if len(cas[x]) == len(cas[y]) and sum(u != v for u, v in zip(cas[x], cas[y])) == 1:
        dn = abs(res[x]['n_fit']-res[y]['n_fit'])/((res[x]['n_fit']+res[y]['n_fit'])/2)
        dns.append((x, y, round(dn, 4)))
print('refit dn over strict pairs:', dns); print('count dn>0.25:', sum(1 for *_, v in dns if v > 0.25), 'max dn %.4f' % max(v for *_, v in dns))
json.dump(res, open('refit_out.json', 'w'), indent=1)
