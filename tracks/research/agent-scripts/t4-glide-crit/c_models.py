import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
FPB = 1 - 1/11.34
d = load('all_results_experiments.pkl')
cells = []   # psi, KL, Udata at 1 net gram (from slope of U^2 vs key), BEM U, disk 1/R
for psi in sorted(d):
    for rc in sorted(d[psi]):
        KL = 60.0/(1000 if rc == 10000 else rc)
        ws = sorted(d[psi][rc]); m = np.array(ws)
        u = np.array([np.mean([abs(float(r['u mean'])) for r in d[psi][rc][w].values()]) for w in ws])
        a, b = np.linalg.lstsq(np.vstack([m, np.ones_like(m)]).T, u**2, rcond=None)[0]
        U1 = np.sqrt(a/FPB)             # m/s at 1 g net immersed weight, slope-based
        Re12, _ = bem.eq(psi, KL)
        cells.append((psi, KL, U1, Re12*1e-6/0.06/np.sqrt(1.2), 1/rmax(psi, KL)))
c = np.array(cells)
def stats(sel, label):
    s = c[sel]
    for name, col in (('BEM', 3), ('disk', 4)):
        lr = np.log(s[:, 2]/s[:, col])
        res = lr - lr.mean()
        print('  %-10s %-5s n=%2d  pooled-scalar RMS log err %.3f  (bias to scalar %.3f)' % (label, name, len(s), np.sqrt(np.mean(res**2)), lr.mean()))
print('One free scalar per subset (in-sample):')
good = c[:, 1] > 0.1
stats((c[:,0]==35)&good, 'psi35,KL>.1'); stats((c[:,0]==35), 'psi35 all')
stats(c[:,0]==0, 'psi0'); stats(good, 'both,KL>.1'); stats(np.ones(len(c),bool), 'both all')
print('per-cell log(data/BEM) and log(data/disk) after pooled scalar (KL>.1):')
s = c[good]
for name, col in (('BEM', 3), ('disk', 4)):
    lr = np.log(s[:, 2]/s[:, col]); lr -= lr.mean()
    print(name, [(int(p), round(k, 2), round(x, 3)) for (p, k, *_), x in zip(s, lr)])
# separate-scalar-per-psi (what a ratio-to-own-control design effectively does within psi)
for name, col in (('BEM', 3), ('disk', 4)):
    tot = []
    for psi in (0, 35):
        ss = c[(c[:,0]==psi)&good]; lr = np.log(ss[:,2]/ss[:,col]); tot += list(lr-lr.mean())
    print(name, 'scalar per psi, pooled RMS %.3f' % np.sqrt(np.mean(np.square(tot))))
# U ratio at the optimum between psi=0 and psi=35 with slope-based U (equal net weight), data vs models
u0 = c[(c[:,0]==0)&(abs(c[:,1]-2.308)<.01)][0]; u35 = c[(c[:,0]==35)&(abs(c[:,1]-1.333)<.01)][0]; u35b = c[(c[:,0]==35)&(abs(c[:,1]-1.2)<.01)][0]
print('slope-based U ratio psi0 KL2.31 / psi35 KL1.2: data %.3f BEM %.3f disk %.3f' % (u0[2]/u35b[2], u0[3]/u35b[3], u0[4]/u35b[4]))
print('slope-based U ratio psi0 KL2.31 / psi35 KL1.33: data %.3f' % (u0[2]/u35[2]))
