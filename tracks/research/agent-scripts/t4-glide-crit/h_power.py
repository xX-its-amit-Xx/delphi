import numpy as np
from scipy import stats
rng = np.random.default_rng(7)
print('G6: wild-fruit slope of KL on psi. rows: n species, psi span (deg, uniform), residual sd of KL (rad)')
print('columns: P(CI excludes 0 | beta=-0.0213) [power to SUPPORT];  P(refuted by frozen rule: CI entirely >=0 | beta)')
def sim(n, span, rsd, beta, N=20000):
    psi = rng.uniform(0, span, (N, n)); y = beta*psi + rng.normal(0, rsd, (N, n))
    xm = psi.mean(1, keepdims=True); ym = y.mean(1, keepdims=True)
    sxx = ((psi-xm)**2).sum(1); b = ((psi-xm)*(y-ym)).sum(1)/sxx
    res = y-ym-b[:, None]*(psi-xm); s2 = (res**2).sum(1)/(n-2); se = np.sqrt(s2/sxx); t = stats.t.ppf(.975, n-2)
    lo, hi = b-t*se, b+t*se
    return (hi < 0).mean(), (lo > 0).mean(), ((lo > -0.030) & (hi < -0.015)).mean(), ((lo > -0.0213-0.0) & False).mean()
for n in (10, 27):
    for span in (15, 35):
        for rsd in (0.15, 0.30, 0.45):
            sup, ref_b, _, _ = sim(n, span, rsd, -0.0213)
            sup0, ref0, _, _ = sim(n, span, rsd, 0.0)
            supg, _, _, _ = sim(n, span, rsd, -0.01745)
            print(' n=%2d span=%2d rsd=%.2f : support power(beta=-0.0213) %.2f ; (beta=-0.01745 geometric) %.2f ; refute-rule fires if beta=-0.0213: %.3f, if beta=0: %.3f ; false-support if beta=0: %.3f' % (n, span, rsd, sup, supg, ref_b, ref0, sup0))
print()
print('G2: fruits per arm needed (control, psi15) to separate BEM 1.111 from disk 1.183 (log gap %.4f) with 80%% power, two-sided 5%%' % np.log(1.183/1.111))
from scipy.stats import nct
def n_needed(sig, gap=np.log(1.183/1.111)):
    for n in range(2, 80):
        df = 2*n-2; tc = stats.t.ppf(.975, df); ncp = gap/(sig*np.sqrt(2/n))
        pw = 1 - nct.cdf(tc, df, ncp) + nct.cdf(-tc, df, ncp)
        if pw >= .8: return n
for sig in (0.01, 0.02, 0.03, 0.04, 0.06):
    print('  sigma_fruit %.2f : n per arm %s ; total prints (ctrl+psi15) %s' % (sig, n_needed(sig), 2*n_needed(sig)))
print('  paired-in-batch design: sd of log ratio within pair = sqrt(2)*sigma_within; with sigma_within 0.02 -> n pairs', end=' ')
for n in range(2,60):
    sg = 0.02*np.sqrt(2); tc = stats.t.ppf(.975, n-1); ncp = np.log(1.183/1.111)/(sg/np.sqrt(n)); pw = 1-nct.cdf(tc,n-1,ncp)+nct.cdf(-tc,n-1,ncp)
    if pw>=.8: print(n); break
print()
print('Gate a (3 controls within 8%) pass probability vs sigma_fruit (range of 3 iid normals in log):')
for sig in (0.02,0.03,0.04,0.05,0.06):
    r = rng.normal(0, sig, (200000, 3)); rg = r.max(1)-r.min(1); print('  sigma %.2f : P(range<=0.08) = %.3f' % (sig, (rg<=.08).mean()))
print()
print('Public 2.16-key replicate sd (same fruit, 3-10 drops): CV 1.3-5.2 percent (a_public.py). Between-series offset psi=0 KL-matched: mean log -0.088 (d_series.py); sigma_run if two iid draws = 0.088/sqrt(2) = %.3f' % (0.088/np.sqrt(2)))
