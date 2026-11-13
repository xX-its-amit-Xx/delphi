import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from scipy.stats import norm, binom
rows = {r['name']: r for r in json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-crit/refit_rows.json'))}
gs = gates(load('Eco1C1G1T1.UCF.json'))
sd = [math.hypot(rows[p['a']]['se_n'], rows[p['b']]['se_n']) for p in pairs(gs)]
msd = math.sqrt(sum(x * x for x in sd) / len(sd)); nbar = sum(r['n_fit'] for r in rows.values()) / 20
print('rms SE of (n_a-n_b) from refit Jacobian: %.3f ; mean refit n over 20 gates %.2f' % (msd, nbar))
for d_true in (0.05, 0.10, 0.15, 0.25, 0.40):
    delta = d_true * nbar; z = delta / msd
    print('true dn=%.2f -> delta n=%.2f -> mean z=%.2f -> per-pair P(z>2)=%.2f, P(z>2.5)=%.2f' % (d_true, delta, z, 1 - norm.cdf(2 - z) + norm.cdf(-2 - z), 1 - norm.cdf(2.5 - z) + norm.cdf(-2.5 - z)))
for m in (8, 10, 13):
    p0 = 2 * (1 - norm.cdf(2.0))
    print('m=%d pairs, H0 (equal n): P(>=3 pairs z>2)=%.3f ; P(>=2 pairs z>2.5)=%.3f' % (m, 1 - binom.cdf(2, m, p0), 1 - binom.cdf(1, m, 2 * (1 - norm.cdf(2.5)))))
# P3 threshold sanity: what refit-vs-shipped correlation would random noise give? permute within family
import numpy as np
rng = np.random.default_rng(1)
ns = np.array([rows[k]['n_ship'] for k in rows]); nf = np.array([rows[k]['n_fit'] for k in rows])
noise = [np.corrcoef(ns, ns + rng.normal(0, 0.5, 20))[0, 1] for _ in range(2000)]
print('r(ship n, ship n + N(0,0.5^2) noise): median %.3f, 5th pct %.3f  (noise sd 0.5 = ~18%% of mean n)' % (np.median(noise), np.percentile(noise, 5)))
noise = [np.corrcoef(ns, ns + rng.normal(0, 1.0, 20))[0, 1] for _ in range(2000)]
print('r with noise sd 1.0: median %.3f, 5th pct %.3f' % (np.median(noise), np.percentile(noise, 5)))
