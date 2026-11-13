import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
G = 9.81; RHO = 1000.0; FPB = 1 - 1/11.34   # lead density 11.34 g/cm3: unverified background
d = load('all_results_experiments.pkl')
rows = []
for psi in sorted(d):
    for rc in sorted(d[psi]):
        KL = 60.0 / (1000 if rc == 10000 else rc)
        ws = sorted(d[psi][rc])
        m = np.array(ws); u = np.array([np.mean([abs(float(r['u mean'])) for r in d[psi][rc][w].values()]) for w in ws])
        A = np.vstack([m, np.ones_like(m)]).T
        a, b = np.linalg.lstsq(A, u**2, rcond=None)[0]
        r2 = 1 - np.sum((u**2 - (a*m+b))**2)/np.sum((u**2-u.mean()**2*0 - np.mean(u**2))**2)
        # log-log slope
        ls = np.polyfit(np.log(m + b/a), np.log(u), 1)[0]
        ls_raw = np.polyfit(np.log(m), np.log(u), 1)[0]
        Re12, St12 = bem.eq(psi, KL); U12 = Re12*1e-6/0.06
        slope_bem_per_netg = U12**2/1.2          # (m/s)^2 per net gram, BEM
        slope_data_per_netg = a/FPB                # (m/s)^2 per net gram if key = lead mass in air
        R = rmax(psi, KL)
        Ceff = 2*G*1e-3/(RHO*np.pi*R**2*slope_data_per_netg)   # kg/g * ... slope per gram -> 1e-3 kg
        rows.append((psi, round(KL,3), len(ws), a, b/a, r2, ls_raw, slope_data_per_netg/slope_bem_per_netg, Ceff))
        print('psi %2d KL %.3f nm %d slope %.5f  m0 %.2f g R2 %.4f  dlogU/dlogm(raw key) %.3f  data/BEM slope %.3f  Ceff_data %.3f  BEM Ceff %.3f' % (psi, KL, len(ws), a, b/a, r2, ls_raw, slope_data_per_netg/slope_bem_per_netg, Ceff, 2*G*1e-3*1.2/(RHO*np.pi*R**2*U12**2)))
rows = np.array(rows)
for psi in (0, 35):
    s = rows[rows[:,0]==psi]
    lr = np.log(s[:,7])
    print('psi', psi, 'data/BEM slope ratio: mean log %.3f (ratio %.3f) sd log %.3f ; Ceff_data mean %.3f range %.3f-%.3f' % (lr.mean(), np.exp(lr.mean()), lr.std(ddof=1), s[:,8].mean(), s[:,8].min(), s[:,8].max()))
    print('   intercept m0 mean %.2f range %.2f-%.2f' % (s[:,4].mean(), s[:,4].min(), s[:,4].max()))
s = rows[rows[:,1] > 0.1]
lr = np.log(s[:,7]); print('all excluding KL=0.06: mean ratio %.3f sd log %.3f' % (np.exp(lr.mean()), lr.std(ddof=1)))
# within psi=35 vs psi=0 mean difference in log ratio
a35 = np.log(rows[(rows[:,0]==35)&(rows[:,1]>0.1)][:,7]); a0 = np.log(rows[rows[:,0]==0][:,7])
print('psi35 minus psi0 mean log(data/BEM): %.3f => psi0 data faster than BEM relative to psi35 by factor sqrt(exp(.))=%.3f in U' % (a35.mean()-a0.mean(), np.exp((a0.mean()-a35.mean())/2)))
