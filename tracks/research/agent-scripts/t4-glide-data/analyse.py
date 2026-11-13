"""t4-glide-data: reproduce earlier agents' numbers from the Fauli/Rabault/Carlson public repo.
Usage: python -I analyse.py <model_dir>   (model_dir = .../EffectFoldAngleAutorotatingSeeds-master/model/)
Pickles are loaded with a restricted unpickler (only numpy array primitives)."""
import sys, os, pickle, importlib, hashlib, json
import numpy as np
M = sys.argv[1].replace(chr(92), '/').rstrip('/') + '/'
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bem
ALLOW = {('numpy.core.multiarray', '_reconstruct'), ('numpy.core.multiarray', 'scalar'), ('numpy', 'ndarray'), ('numpy', 'dtype'),
         ('numpy._core.multiarray', '_reconstruct'), ('numpy._core.multiarray', 'scalar')}
class U(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) in ALLOW:
            return getattr(importlib.import_module(module.replace('numpy.core', 'numpy._core')), name)
        raise pickle.UnpicklingError('blocked %s.%s' % (module, name))
def load(fn): return U(open(M + fn, 'rb'), encoding='latin1').load()
R = {}
print('bem.py sha256', hashlib.sha256(open(HERE + '/bem.py', 'rb').read()).hexdigest())
for fn in sorted(os.listdir(M)):
    if fn.endswith('.pkl'): print('sha256', hashlib.sha256(open(M + fn, 'rb').read()).hexdigest(), os.path.getsize(M + fn), fn)

d = load('all_results_experiments.pkl')
def cell(psi, KL_rc, w):
    reps = d[psi][KL_rc][w]
    u = np.array([abs(float(reps[i]['u mean'])) for i in reps]); f = np.array([abs(float(reps[i]['f mean'])) for i in reps])
    return len(u), u.mean(), f.mean()
print('\n[1] psi/rc/mass keys:', {p: (sorted(d[p]), sorted(next(iter(d[p].values())))) for p in d})
KEY = 2.16
def pick(psi):
    out = {}
    for rc in sorted(d[psi]):
        ws = sorted(d[psi][rc]); w = min(ws, key=lambda x: abs(x - KEY))
        KL = 60.0 / (1000 if rc == 10000 else rc); n, u, f = cell(psi, rc, w); out[round(KL, 3)] = (w, n, u, f)
    return out
p35 = pick(35); p0 = pick(0)
print('\n[2] psi=35, mass key ~2.16: KL -> (key, n, U m/s, f Hz)')
for k, v in sorted(p35.items()): print('  KL %.3f key %.2f n=%d U=%.4f f=%.3f' % ((k,) + v))
print('[3] psi=0:')
for k, v in sorted(p0.items()): print('  KL %.3f key %.2f n=%d U=%.4f f=%.3f' % ((k,) + v))
ctrl = p35[1.333] if 1.333 in p35 else None
print('\n[4] control psi=35 KL 1.2 (rc=50): ', {k: v for k, v in p35.items() if abs(k - 1.2) < .01})
c = [v for k, v in p35.items() if abs(k - 1.2) < .01][0]
print('   U=%.4f f=%.3f St=f*0.06/U=%.3f' % (c[2], c[3], c[3] * 0.06 / c[2]))
r_ps = [v[2] for k, v in p0.items() if abs(k - 2.308) < .01][0] / c[2]
print('[5] ratio psi0 KL2.31 / psi35 KL1.2 (all_results_experiments): %.3f' % r_ps)
d2 = load('dict_all_results.pkl')
v = [abs(float(d2['seed_%dmm_%dmean_vertical_velocity' % (26, i)])) for i in (1, 2, 3)] if 'seed_26mm_1mean_vertical_velocity' in d2 else None
rows = {}
for rc in [100, 65, 50, 35, 30, 26, 23, 20, 18, 16, 15]:
    vv = [abs(float(d2['seed_%dmm_%dmean_vertical_velocity' % (rc, i)])) for i in (1, 2, 3)]
    rows[rc] = np.mean(vv) / 1000.0
    print('  dict_all_results psi0 rc=%d KL=%.2f mean U=%.4f m/s (units mm/s/1000)' % (rc, 60.0 / rc, rows[rc]))
r_dict = rows[26] / c[2]
print('[6] ratio psi0 KL2.31 (dict_all_results, rc=26) / control: %.3f' % r_dict)

# stored model curves
print('\n[7] stored BEM output files: min Re, KL, St; U=Re*1e-6/0.06 ; f=St*U/0.06')
stored = {}
for fn, psi in [('model_data_camber_psi_0.0.pkl', 0), ('model_data_camber_psi_15.0.pkl', 15), ('model_data_camber_psi_35.0.pkl', 35), ('model_data_psi_0.pkl', 0), ('model_data_psi_35.pkl', 35)]:
    m = load(fn); KL = np.array(m['KL'], float); Re = np.abs(np.array(m['Re'], float)); St = np.array(m['St'], float)
    i = int(np.argmin(Re)); stored[fn] = (KL, Re, St)
    Um = Re[i] * 1e-6 / 0.06
    print('  %-34s n=%d minRe=%.0f at KL=%.3f St=%.3f  U=%.4f f=%.3f' % (fn, len(KL), Re[i], KL[i], St[i], Um, St[i] * Um / 0.06))
KL, Re, St = stored['model_data_camber_psi_15.0.pkl']
o = np.argsort(KL); KLs, Us = KL[o], Re[o] * 1e-6 / 0.06
print('[8] stored psi=15 predicted U (interp):', {k: round(float(np.interp(k, KLs, Us)), 4) for k in (0.95, 1.34, 1.73, 2.11, 2.5, 2.89)})

# BEM port
print('\n[9] port check vs stored files (rel diff in Re):')
for fn, psi in [('model_data_camber_psi_15.0.pkl', 15), ('model_data_psi_0.pkl', 0), ('model_data_psi_35.pkl', 35)]:
    KL, Re, St = stored[fn]; e = [(bem.eq(psi, k)[0] - r) / r for k, r in zip(KL, Re)]
    print('  %s max|rel| %.4f' % (fn, np.max(np.abs(e))))
ref = bem.eq(35, 1.2)[0]
def bestratio(psi):
    ks = np.linspace(0.9, 2.6, 35); rs = [bem.eq(psi, k)[0] for k in ks]; return min(rs) / ref
print('[10] BEM ratio best psi=15 / control psi=35 KL1.2: %.3f ; best psi=0 / control: %.3f ; BEM psi0 KL2.31/ctrl %.3f' % (bestratio(15), bestratio(0), bem.eq(0, 2.31)[0] / ref))
def rmax(psi, k): return float(bem.wing(psi, k)[0].max())
print('[11] disk rule psi0 KL2.31/ctrl %.3f' % (rmax(35, 1.2) / rmax(0, 2.31)))
pub = {}
for psi, tab in ((35, p35), (0, p0)):
    eb = []
    for k, v in tab.items():
        if psi == 35 and abs(k - 0.06) < 1e-3: pass
        r = v[2] / c[2]; b = bem.eq(psi, k)[0] / ref
        eb.append(np.log(r / b))
    print('[12] psi=%d all %d KL points RMS log err BEM vs data-ratio-to-control: %.3f' % (psi, len(eb), np.sqrt(np.mean(np.square(eb)))))
# U^2 linear in mass; R2 per series
print('\n[13] U^2 vs lead-mass key linear fit R2 per (psi, rc):')
r2s = []
for psi in sorted(d):
    for rc in sorted(d[psi]):
        ws = np.array(sorted(d[psi][rc])); u = np.array([cell(psi, rc, w)[1] for w in ws])
        A = np.vstack([ws, np.ones_like(ws)]).T; co = np.linalg.lstsq(A, u ** 2, rcond=None)[0]
        r2 = 1 - np.sum((u ** 2 - A @ co) ** 2) / np.sum((u ** 2 - u.mean() ** 2) ** 2) if False else 1 - np.sum((u ** 2 - A @ co) ** 2) / np.sum((u ** 2 - np.mean(u ** 2)) ** 2)
        r2s.append(r2); print('   psi %s rc %s R2 %.4f' % (psi, rc, r2))
print('   R2 range %.3f-%.3f over %d series' % (min(r2s), max(r2s), len(r2s)))

# ---- refinements: exact optimum ratios, pitch ratios, RMS excluding the control point
from scipy.optimize import minimize_scalar
def opt(psi, pitch=15.0, lo=0.4, hi=3.2):
    r = minimize_scalar(lambda k: bem.eq(psi, k, pitch=pitch)[0], bounds=(lo, hi), method='bounded', options={'xatol': 1e-4}); return r.x, r.fun
k15, Re15 = opt(15); k0, Re0 = opt(0); k55, Re55 = opt(55, lo=0.3, hi=2.0)
print('\n[14] BEM continuous optimum: psi15 KL %.3f ratio-to-control %.3f ; psi0 KL %.3f ratio %.3f ; psi55 KL %.3f ratio %.3f' % (k15, Re15 / ref, k0, Re0 / ref, k55, Re55 / ref))
print('     BEM at KL1.73 psi15 ratio %.3f (design G2 1.111 is at KL 1.73); psi55 KL0.95 ratio %.3f' % (bem.eq(15, 1.73)[0] / ref, bem.eq(55, 0.95)[0] / ref))
base = bem.eq(15, 1.73)[0]
print('[15] pitch ratios psi15 KL1.73: U(5)/U(15) %.3f ; U(25)/U(15) %.3f' % (bem.eq(15, 1.73, pitch=5.0)[0] / base, bem.eq(15, 1.73, pitch=25.0)[0] / base))
eb = [np.log((v[2] / c[2]) / (bem.eq(35, k)[0] / ref)) for k, v in p35.items() if abs(k - 1.2) > .01]
print('[16] psi=35 RMS log err excluding the control point (6 pts): %.3f' % np.sqrt(np.mean(np.square(eb))))
ed = [np.log((v[2] / c[2]) / (rmax(35, 1.2) / rmax(35, k))) for k, v in p35.items() if abs(k - 1.2) > .01]
print('     disk rule same 6 pts: %.3f' % np.sqrt(np.mean(np.square(ed))))
ed0 = [np.log((v[2] / c[2]) / (rmax(35, 1.2) / rmax(0, k))) for k, v in p0.items()]
print('     disk rule psi=0 4 pts: %.3f' % np.sqrt(np.mean(np.square(ed0))))
print('[17] control replicate scatter (psi35 KL1.2, key 2.16) CV of 3 trials:',
      round(float(100 * np.std([abs(float(d[35][50][2.16][i]['u mean'])) for i in d[35][50][2.16]], ddof=1) / c[2]), 2), '%')
