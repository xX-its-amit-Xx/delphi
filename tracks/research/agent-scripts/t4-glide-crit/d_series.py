import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
d = load('all_results_experiments.pkl'); d2 = load('dict_all_results.pkl')
print('second psi=0 series (dict_all_results.pkl) vs first at 2.16 key:')
lr = []
for rc in [65, 35, 26, 20]:
    v = np.array([abs(float(d2['seed_%dmm_%dmean_vertical_velocity' % (rc, i)])) for i in (1, 2, 3)])/1000.0
    KL = 60.0/rc
    k1 = [k for k in d[0] if abs(60.0/k - KL) < .01][0]
    u1 = np.mean([abs(float(r['u mean'])) for r in d[0][k1][2.16].values()])
    lr.append(np.log(v.mean()/u1))
    print(' KL %.3f  series2 %.4f (n=3 sd %.4f)  series1 %.4f  ratio %.3f' % (KL, v.mean(), v.std(ddof=1), u1, v.mean()/u1))
lr = np.array(lr); print(' mean log ratio %.3f, sd of log ratio across KL %.3f' % (lr.mean(), lr.std(ddof=1)))
# the design's two psi=0 ratios to the psi=35 control 0.0676
for lab, u in (('series1 KL2.31', 0.1011), ('series2 KL2.31', None)):
    pass
v26 = np.array([abs(float(d2['seed_26mm_%dmean_vertical_velocity' % i])) for i in (1, 2, 3)])/1000
print('R0 (psi0 KL2.31 / psi35 KL1.2 control 0.0676): series1 %.3f ; series2 %.3f' % (0.1011/0.0676, v26.mean()/0.0676))
print('R0 relative to psi35 minimum (KL1.33 0.0674): series1 %.3f series2 %.3f' % (0.1011/0.0674, v26.mean()/0.0674))
# training RMS as in freeze.py (single reference cell, no fitted scalar), with/without KL=0.06
ref = bem.eq(35, 1.2)[0]; rref = rmax(35, 1.2)
pub = {(35,0.06):0.1257,(35,0.60):0.0888,(35,0.923):0.0737,(35,1.333):0.0674,(35,1.5):0.0693,(35,1.714):0.0710,(0,0.923):0.1678,(0,1.714):0.1137,(0,2.308):0.1011,(0,3.0):0.1258}
for excl in (False, True):
    for psi in (35, 0):
        eb=[];ed=[]
        for (p,k),u in pub.items():
            if p!=psi or (excl and k<0.1): continue
            r=u/0.0676; eb.append(np.log(r/(bem.eq(p,k)[0]/ref))); ed.append(np.log(r/(rref/rmax(p,k))))
        print('freeze.py-style RMS psi',psi,'excl KL0.06' if excl else 'all', 'BEM %.3f disk %.3f n=%d'%(np.sqrt(np.mean(np.square(eb))),np.sqrt(np.mean(np.square(ed))),len(eb)))
