"""Null rate of apparent enhancer rank reversals under a purely multiplicative model.
Run: python null_reversals.py   (numpy only; seed fixed; ~seconds)
Model: log-activity of enhancer i on promoter p = a_i + c_p (multiplicative => additive in log).
a_i ~ N(0, s^2) (spread, log2 units). Measurement: mean of r replicates, each with N(0, e^2) log2 noise.
Outputs: discordant-pair fraction, analytic check arccos(rho)/pi, Spearman rho,
count of 'significant reversals' (pair significantly ordered in opposite directions on the two promoters,
two-sided z test alpha=0.05), uncorrected vs Bonferroni across all pairs, and a ceiling variant.
"""
import numpy as np, itertools, json, sys
from math import erf, sqrt, acos, pi
rng = np.random.default_rng(20261112)
N = 100; REPS_SIM = 200
def zcrit(alpha):
    # inverse normal via bisection on erf
    lo, hi = 0.0, 10.0
    for _ in range(80):
        m = (lo+hi)/2
        if 1-erf(m/sqrt(2)) > alpha: lo = m
        else: hi = m
    return hi
iu = np.triu_indices(N, 1); npairs = len(iu[0])
Z05 = zcrit(0.05); ZB = zcrit(0.05/npairs)
def rank(x): return np.argsort(np.argsort(x))
def sim(s, e, r, ceiling=None, shift=1.0):
    se = e/sqrt(r)
    disc=[]; rho=[]; sig_u=[]; sig_b=[]; topk=[]
    for _ in range(REPS_SIM):
        a = rng.normal(0, s, N)
        t1 = a; t2 = a + shift
        if ceiling is not None:   # saturating readout on promoter 2 (linear scale, then log)
            t2 = ceiling*np.tanh((2**t2)/ceiling)
            t2 = np.log2(t2)
        y1 = t1 + rng.normal(0, se, N); y2 = t2 + rng.normal(0, se, N)
        d1 = (y1[:,None]-y1[None,:])[iu]; d2 = (y2[:,None]-y2[None,:])[iu]
        disc.append(np.mean(np.sign(d1)!=np.sign(d2)))
        rho.append(np.corrcoef(rank(y1), rank(y2))[0,1])
        z1 = d1/(sqrt(2)*se); z2 = d2/(sqrt(2)*se)
        opp = np.sign(d1)!=np.sign(d2)
        sig_u.append(np.sum(opp & (abs(z1)>Z05) & (abs(z2)>Z05)))
        sig_b.append(np.sum(opp & (abs(z1)>ZB) & (abs(z2)>ZB)))
        # regression to the mean: top 10 on promoter 1 -> mean true-rank-percentile on 2 (by observed)
        top = np.argsort(-y1)[:10]; topk.append(np.mean(rank(y2)[top])/(N-1))
    return dict(s=s,e=e,r=r,ceil=ceiling,disc=float(np.mean(disc)),rho=float(np.mean(rho)),
                sig_unc=float(np.mean(sig_u)),sig_bonf=float(np.mean(sig_b)),top10_pct_on_B=float(np.mean(topk)))
def analytic(s,e,r):
    vd = 2*s*s; vn = 2*e*e/r; rho = vd/(vd+vn); return acos(rho)/pi
rows=[]
print(f"N={N} enhancers, {npairs} pairs, {REPS_SIM} sims/cell, z05={Z05:.3f}, zBonf={ZB:.3f}")
print("s(spread,log2) e(rep noise,log2) r | disc_frac analytic spearman sigRev_unc sigRev_Bonf top10->pctB")
for s in (0.5,1.0,2.0):
    for e in (0.1,0.3,0.6,1.0):
        for r in (1,3):
            o = sim(s,e,r); o['analytic']=analytic(s,e,r); rows.append(o)
            print(f"{s:4} {e:4} {r} | {o['disc']:.3f} {o['analytic']:.3f} {o['rho']:.3f} {o['sig_unc']:8.1f} {o['sig_bonf']:6.2f} {o['top10_pct_on_B']:.2f}")
print("\nCeiling variant (promoter 2 saturates, ceiling=4x median; s=1, r=3):")
for e in (0.1,0.3,0.6):
    o = sim(1.0,e,3,ceiling=4.0); rows.append(o)
    print(f"e={e}: disc={o['disc']:.3f} rho={o['rho']:.3f} sigRev_unc={o['sig_unc']:.1f} sigRev_Bonf={o['sig_bonf']:.2f}")
json.dump(rows, open(sys.argv[1] if len(sys.argv)>1 else 'null_reversals_results.json','w'), indent=1)
