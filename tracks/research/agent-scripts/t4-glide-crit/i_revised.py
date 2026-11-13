"""Revised statistics proposed by the referee, with Monte Carlo operating characteristics. Seeded."""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy import stats
rng = np.random.default_rng(11)
FZ = json.load(open('D:/Users/ashenoy00000/delphi-work/agents/scratch/design-glide/frozen_predictions.json'))['rows']
B = {(r['psi_deg'], r['KL'], r['pitch_deg']): r['bem_ratio_to_control'] for r in FZ}
D = {(r['psi_deg'], r['KL'], r['pitch_deg']): r['disk_ratio_to_control'] for r in FZ}
def S(t): return np.mean([np.log(t[(15,k,15)]/t[(15,1.73,15)]) for k in (0.95,2.50,2.89)])
print('G3-prime shape contrast S = mean ln[u*(KL)/u*(1.73)], KL in {0.95,2.50,2.89}: BEM %.4f  disk %.4f  midpoint %.4f' % (S(B), S(D), (S(B)+S(D))/2))
print('G2: ln R15 BEM %.4f disk %.4f midpoint ratio %.4f' % (np.log(B[(15,1.73,15)]), np.log(D[(15,1.73,15)]), np.exp((np.log(B[(15,1.73,15)])+np.log(D[(15,1.73,15)]))/2)))
for sig in (0.02, 0.03, 0.04, 0.06):
    N = 40000
    res = {}
    for wn, t in (('BEM', B), ('disk', D)):
        e = lambda *s: rng.normal(0, sig, s)
        # G2' : 5 ctrl vs 5 psi15 fruits, Welch t on log, 3-way decision around 1.147
        c = e(N, 5); p = np.log(t[(15,1.73,15)]) + e(N, 5)
        d = p.mean(1) - c.mean(1); se = np.sqrt((p.var(1,ddof=1)+c.var(1,ddof=1))/5); hw = stats.t.ppf(.975, 8)*se
        mid = np.log(1.147)
        favB = (d + hw) < mid; favD = (d - hw) > mid
        # G3' : S from single fruits at 0.95,2.5,2.89 vs the mean of the 5 KL1.73 fruits (same p array)
        y = np.array([np.log(t[(15,k,15)]) for k in (0.95,2.50,2.89)])[None,:] + e(N,3)
        ref = np.log(t[(15,1.73,15)]) + e(N,5).mean(1)
        Sh = (y - ref[:,None]).mean(1); sS = 0.0
        S_mid = (S(B)+S(D))/2
        sB = Sh > S_mid   # BEM-like if S above midpoint
        # G5' : KL0.95 psi55, 2 fruits vs control mean of 5
        z = np.log(t[(55,0.95,15)]) + e(N,2).mean(1) - e(N,5).mean(1)
        res[wn] = dict(G2_favours_BEM=favB.mean(), G2_favours_disk=favD.mean(), G2_inconclusive=1-favB.mean()-favD.mean(),
                       G3p_says_BEM=sB.mean(), G3p_says_disk=1-sB.mean(), G5p_R55_ge_098=(np.exp(z)>=0.98).mean(), G5p_R55_lt_080=(np.exp(z)<0.80).mean())
    print('\nsigma_fruit %.2f  (G2: 5 ctrl + 5 psi15 fruits; G3p: 3 single fruits; G5p: 2 psi55 fruits)' % sig)
    for wn in res: print('  truth %-4s ' % wn + '  '.join('%s %.3f' % kv for kv in res[wn].items()))
