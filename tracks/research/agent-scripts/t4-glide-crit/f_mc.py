"""Monte Carlo: how often does each frozen refutation rule fire, given truth = BEM, truth = disk rule,
and truth = 'public-data-like' (R0 = 1.45), for between-fruit log-sd sigma_f. Seeded; run: python f_mc.py"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy import stats
rng = np.random.default_rng(20261112)
FZ = json.load(open('D:/Users/ashenoy00000/delphi-work/agents/scratch/design-glide/frozen_predictions.json'))['rows']
def tab(key, p15=None):
    d = {}
    for r in FZ:
        d[(r['psi_deg'], r['KL'], r['pitch_deg'])] = r[key]
    return d
BEM, DISK = tab('bem_ratio_to_control'), tab('disk_ratio_to_control')
KL15 = [0.95, 1.34, 1.73, 2.11, 2.50, 2.89]
def world(name):
    t = BEM if name == 'BEM' else DISK
    w = dict(R0=t[(0,2.31,15)], R15=t[(15,1.73,15)], g3=np.array([t[(15,k,15)] for k in KL15]),
             p5=t[(15,1.73,5)]/t[(15,1.73,15)] if name=='BEM' else 1.0, p25=t[(15,1.73,25)]/t[(15,1.73,15)] if name=='BEM' else 1.0,
             r55=np.array([t[(55,k,15)] for k in (0.6,0.95,1.34)]), g_ktest=t[(35,0.6,15)])
    return w
def run(wname, sig, N=20000, R0_override=None):
    w = world(wname)
    if R0_override: w['R0'] = R0_override
    e = lambda *s: rng.normal(0, sig, s)
    ctrl = e(N, 3)                      # log u* of 3 controls (true 0)
    c_mean = ctrl.mean(1)
    rng_ctrl = ctrl.max(1) - ctrl.min(1)
    gate_a = rng_ctrl <= 0.08            # 3 controls within 8 percent
    # G2
    p15 = np.log(w['R15']) + e(N, 3)     # three psi15 KL1.73 fruits
    d = p15.mean(1) - c_mean
    se = np.sqrt((p15.var(1, ddof=1) + ctrl.var(1, ddof=1)) / 3); df = 4
    hw = stats.t.ppf(0.975, df) * se
    R15hat = np.exp(d)
    excl_bem = (np.log(1.111) < d - hw) | (np.log(1.111) > d + hw)
    excl_dsk = (np.log(1.183) < d - hw) | (np.log(1.183) > d + hw)
    inconcl = (R15hat * hw) > 0.06       # half-width in ratio units
    R0hat = np.exp(np.log(w['R0']) + e(N, 2).mean(1) - c_mean)
    g2_bem_ref = (~inconcl) & (excl_bem | (R0hat >= 1.31))
    g2_dsk_ref = (~inconcl) & (excl_dsk | (R0hat < 1.31))
    # G3 (six single fruits, KL1.73 = mean of the three used in G2); log u* relative to that mean
    y = np.log(w['g3'])[None, :] + e(N, 6)
    y[:, 2] = np.log(w['g3'][2]) + e(N, 3).mean(1)
    ref = y[:, 2:3]
    yr = y - ref + np.log(w['g3'][2])    # ratios to the KL1.73 reference
    ratios = np.exp(y - ref)
    kl = np.array(KL15)
    kmin = np.empty(N)
    X = np.vstack([kl**2, kl, np.ones(6)]).T
    coef = np.linalg.lstsq(X, y.T, rcond=None)[0]   # 3 x N
    kmin = np.where(coef[0] > 0, -coef[1] / (2 * coef[0]), np.nan)
    opt_ok = (kmin >= 1.45) & (kmin <= 2.10)
    r_lo = ratios[:, 0] >= 1.10; r_hi = ratios[:, 5] >= 1.10
    pred = np.log(BEM_G3 / BEM_G3[2])
    rms = np.sqrt(np.mean((np.log(ratios) - pred[None, :])**2, 1))
    g3_bem_ok = opt_ok & r_lo & r_hi & (rms <= 0.10)
    # G4
    f5 = np.log(w['p5']) + e(N, 2).mean(1) - p15.mean(1) + np.log(w['R15'])   # pitch5 fruits vs the three KL1.73 fruits
    f25 = np.log(w['p25']) + e(N) - p15.mean(1) + np.log(w['R15'])
    g4_bem_ok = (np.exp(f5) <= 0.80) & (np.exp(f25) >= 1.25)
    g4_dsk_ok = (abs(np.exp(f5) - 1) <= 0.12) & (abs(np.exp(f25) - 1) <= 0.12)
    # G5: best of 3 singletons over control mean
    z = np.log(w['r55'])[None, :] + e(N, 3) - c_mean[:, None]
    R55 = np.exp(z.min(1))
    g5_ok = (R55 < 0.97) & (R55 >= 0.80)
    # gate d : single psi35 KL0.6 fruit vs control mean, public value 1.31 +/- 0.10
    gd = np.exp(np.log(w['g_ktest']) + e(N) - c_mean)
    gate_d_pub = abs(gd - 1.31) <= 0.10
    gate_d_true = abs(gd - w['g_ktest']) <= 0.10
    return dict(w=w, gate_a=gate_a.mean(), incl=inconcl.mean(), g2_bem_ref=g2_bem_ref.mean(), g2_dsk_ref=g2_dsk_ref.mean(),
                excl_bem=((~inconcl)&excl_bem).mean(), excl_dsk=((~inconcl)&excl_dsk).mean(), R0_ge_131=(R0hat >= 1.31).mean(),
                g3_opt_ok=opt_ok.mean(), g3_ratio_ok=(r_lo&r_hi).mean(), g3_rms_ok=(rms<=0.10).mean(), g3_all=g3_bem_ok.mean(),
                g4_bem_ok=g4_bem_ok.mean(), g4_dsk_ok=g4_dsk_ok.mean(), g5_ok=g5_ok.mean(), R55_mean=R55.mean(),
                gate_d_pub=gate_d_pub.mean(), gate_d_true=gate_d_true.mean(),
                bem_survives_G2_5=((~g2_bem_ref) & g3_bem_ok & g4_bem_ok & g5_ok & gate_a & (gate_d_pub)).mean(),
                bem_survives_noGates=((~g2_bem_ref) & g3_bem_ok & g4_bem_ok & g5_ok).mean(),
                kmin_sd=np.nanstd(kmin), R15_hw_med=np.median(R15hat*hw))
BEM_G3 = np.array([BEM[(15,k,15)] for k in KL15])
out = {}
for wname, ov in (('BEM', None), ('disk', None), ('disk', 1.45)):
    for sig in (0.02, 0.04, 0.06):
        r = run(wname, sig, R0_override=ov)
        lab = wname + ('(R0=%.2f)' % ov if ov else '')
        out[(lab, sig)] = r
        print('\n== truth=%s  sigma_fruit=%.2f' % (lab, sig))
        for k, v in r.items():
            if k != 'w': print('   %-20s %.3f' % (k, v))
