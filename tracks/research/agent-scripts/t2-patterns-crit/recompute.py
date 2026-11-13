"""Referee recomputation for Track 2 frozen predictions. Uses only SEEN sheets MOESM11 and MOESM22 (+MOESM3 params).
Run: python -I recompute.py   (openpyxl was installed with pip --target into the scratch pylib dir)"""
import sys, math
sys.path.insert(0, 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-crit/pylib')
import openpyxl
from math import log, sqrt, exp, erf
base = 'D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-patterns/dl/cremer/'

def sheet(f, i=0):
    wb = openpyxl.load_workbook(base + f + '.xlsx', data_only=True)
    return list(wb.worksheets)[i]

rows = [r for r in sheet('MOESM11').iter_rows(min_row=3, values_only=True) if isinstance(r[8], (int, float))]
print('MOESM11 data rows:', len(rows))

def ols(x, y):
    n = len(x); mx = sum(x) / n; my = sum(y) / n; sxx = sum((a - mx) ** 2 for a in x)
    b = sum((a - mx) * (c - my) for a, c in zip(x, y)) / sxx; a0 = my - b * mx
    res = sum((c - a0 - b * a) ** 2 for a, c in zip(x, y))
    if n > 2:
        return b, sqrt(res / (n - 2) / sxx), n - 2, sqrt(res / (n - 2))
    return b, float('nan'), 0, float('nan')

T = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571}

def ll(rs, tag):
    b, se, df, s = ols([log(r[11]) for r in rs], [log(r[8]) for r in rs])
    if df > 0:
        print(f'  {tag}: n={len(rs)} slope={b:.3f} SE={se:.3f} df={df} 95%CI=[{b - T[df] * se:.2f},{b + T[df] * se:.2f}] resid_sd={s:.3f}')
    else:
        print(f'  {tag}: n={len(rs)} slope={b:.3f}')
    return b, se

def Phi(z): return .5 * (1 + erf(z / sqrt(2)))

print('== A. fit of M0/M1 on WT carbon rows (rows 3-8 of ED Fig 1c)')
wt = [r for r in rows if r[0] == 'HE206' and r[5] == 'Aspartate']
print(' WT asp rows', len(wt), [(r[2], round(r[8], 3), round(r[11], 4)) for r in wt])
k = sum(r[8] ** 2 * r[11] for r in wt) / sum(r[11] ** 2 for r in wt)
print(' k LS through origin (u^2 on r):', round(k, 3))
kk = [r[8] ** 2 / r[11] for r in wt]; mk = sum(kk) / 6
print(' per-row u^2/r:', [round(x, 2) for x in kk], 'mean', round(mk, 2), 'CV', round((sum((x - mk) ** 2 for x in kk) / 5) ** .5 / mk, 3))
c = 3600e-6; Da = 800 * c; Dr = 50.2 * c; A = 100.0
b = k / A; X = (b + sqrt(b * b + 4 * b * Da)) / 2
print(' X=chi0-Drho', round(X, 4), 'mm2/h=', round(X / c, 1), 'um2/s; chi0', round(X / c + 50.2, 1), 'phi', round(X / Dr, 2), ' check X^2 A/(X+Da)=', round(X * X * A / (X + Da), 3))
Xp = (315 - 50.2) * c
print(' published chi0=315: X', round(Xp, 4), ' c at r=.9985', round(Xp * sqrt(.9985 * A / (Xp + Da)), 3), ' ratio to 4.3347', round(Xp * sqrt(.9985 * A / (Xp + Da)) / 4.3347, 3))
print(' dlnc/dlnD (fixed phi): fitted', round(1 - .5 * X / (X + Da), 3), ' published', round(1 - .5 * Xp / (Xp + Da), 3))
print(' Eq22 validity: 1+Da/X =', round(1 + Da / X, 2), '; ratio at a0/am=100:', round(100 / (1 + Da / X), 1), ' at a0/am=10:', round(10 / (1 + Da / X), 2))
print(' bulge rise length X/c mm:', round(X / 4.335, 4), round(Xp / 4.335, 4), ' Fisher speed 2sqrt(Drho r) r=.9985:', round(2 * sqrt(Dr * .9985), 3), 'mm/h; measured/Fisher =', round(4.335 / (2 * sqrt(Dr * .9985)), 2))
print(' M0 relative error on every non-training asp/ser row (sqrt(k r) vs u):')
errs = []
for r in rows:
    if r in wt or r[5] not in ('Aspartate', 'Serine'): continue
    p = sqrt(k * r[11]); errs.append((r[0], r[1], r[4], r[5], round(r[8], 3), round(p, 3), round((p - r[8]) / r[8] * 100, 1)))
for e in errs: print('   ', e)
print('  within 15%:', sum(abs(e[6]) <= 15 for e in errs), 'of', len(errs))
print('== B. log-log slopes of u on r (with SE)')
glpFK = [r for r in rows if r[1] == 'Pu-glpFK' and r[5] == 'Aspartate']
ll(glpFK, 'Pu-glpFK asp 5pt'); ll(glpFK[1:], 'Pu-glpFK asp 4pt (no 0 inducer)')
ll([r for r in rows if r[1] == 'Pu-glpFK' and r[5] == 'Serine'], 'Pu-glpFK ser')
ll([r for r in rows if r[1] == 'Pu-ptsG2'], 'Pu-ptsG2 asp'); ll(wt, 'WT 6 carbon sources')
g = [r for r in rows if r[2] == '40mM glycerol' and r[1] in ('wt', 'glpK22') and r[5] == 'Aspartate']
print('  wt->glpK22 (glycerol) pair slope', round(log(g[1][8] / g[0][8]) / log(g[1][11] / g[0][11]), 3), [x[1] for x in g])
print('  F1 pass window for alpha, s_obs=1.12 +-0.20:', round((0.92 - .5) / .893, 3), round((1.32 - .5) / .893, 3), '; s_obs=0.90:', round((0.70 - .5) / .893, 3), round((1.10 - .5) / .893, 3), '; |1.12-0.90|=', round(1.12 - 0.90, 2))
b5, se5 = ll(glpFK, 'x')
print('  P(|s_pred-s_obs|<=0.2) if true colony exponent=1.12, SE_obs=%.3f; s_pred=0.5+0.893*alpha with alpha~N(alpha_true,SE_alpha):' % se5)
for sa in (0.05, 0.1, 0.2, 0.3):
    sd = sqrt(se5 ** 2 + (0.893 * sa) ** 2); out = []
    for alpha in (0.69, 0.5, 0.3, 0.0):
        mu = 0.5 + 0.893 * alpha - 1.12
        out.append(f'alpha_true={alpha}: P(pass)={Phi((0.2 - mu) / sd) - Phi((-0.2 - mu) / sd):.2f}')
    print(f'   SE_alpha={sa}: ' + '; '.join(out))
print('== C. F2')
for nm, u, r in (('glycerol+asp', 3.67462190077778, 0.7735), ('glucose+asp', 4.3347312336, 0.9985), ('glycerol+ser', 4.20332693366667, 0.7695)):
    L = u / r; Dterm = Dr * r / u ** 2
    print(f' {nm}: L=u/r={L:.3f} mm; diffusive correction Drho*r/u^2={Dterm:.4f}; +-30% window [{0.7 * L:.2f},{1.3 * L:.2f}]')
for nm, u, su, n, r, sr, nr in (('glycerol', 3.6746, 0.3182, 9, 0.7735, 0.01999, 8), ('glucose', 4.3347, 0.4422, 5, 0.9985, 0.01453, 4)):
    cv = sqrt((su / u) ** 2 / n + (sr / r) ** 2 / nr); print(f' {nm}: CV of L_pred (SE of means) = {cv * 100:.1f}%')
print(' Eq33 ratio ~ lambda*c/r = c^2/(X r) = k/X =', round(k / X, 1), ' e-folds from trough to half plateau ~', round(log(k / X / 2), 2), ' => window', round(log(k / X / 2) * 4.34, 1), 'mm at L=4.34')
print('== D. F3')
up = [1.02, 0.731, 0.687, 0.358]; print(' ratios 1.02/x:', [round(1.02 / x, 3) for x in up])
lx = [log(x) for x in up]; mx = sum(lx) / 4; sxx = sum((a - mx) ** 2 for a in lx)
print(' Sxx of ln uptake', round(sxx, 4), ' SE_slope = sigma*', round(1 / sqrt(sxx), 3))
for sig in (0.1, 0.2, 0.3):
    se = sig / sqrt(sxx); out = []
    for tr in (-1.0, -0.7, -0.5, -0.3):
        p_out = Phi((-1.3 - tr) / se) + 1 - Phi((-0.7 - tr) / se); out.append(f'true={tr}: P(est outside [-1.3,-0.7])={p_out:.2f}')
    print(f'  sigma_ln(rho)={sig} (SE_slope={se:.2f}): ' + '; '.join(out))
print(' Eq24 speed ratio lowest-uptake/WT = sqrt((1+K)/(1+2.849K)), K = WT correction term (unknown)')
for K in (0.02, 0.06, 0.1, 0.25, 0.56, 1.0):
    ratio = sqrt((1 + K) / (1 + 2.849 * K)); s = log(ratio) / log(0.358 / 1.02)
    print(f'   K={K}: speed ratio {ratio:.3f}, implied speed-vs-uptake slope {s:.3f}')
t = 0.351 ** 0.3  # (1+K)/(1+2.849K) = t at slope 0.15
Kc = (1 - t) / (2.849 * t - 1)
print('  K at which |speed slope| reaches 0.15:', round(Kc, 3), '; Eq24 K = 5.58*rho_min/rho_c (gamma=.26, X fitted, a0/am=100):', round(0.26 * X / (X + Da) * 100, 2), '-> rho_min/rho_c =', round(Kc / (0.26 * X / (X + Da) * 100), 4))
print('== E. F4')
sp = {'wt_glyc': (3.67462190077778, 4.20332693366667), 'glpK22': (4.95017794225, 5.8458949725), 'glpFK10': (2.0087633675, 1.3015932195), 'glpFK50': (2.76915795933333, 2.5283694485), 'glpFK800': (4.170896515, 4.079523067)}
for n_, (a, s) in sp.items():
    q = sqrt(a * a + s * s); m = max(a, s)
    print(' ', n_, 'max', round(m, 3), 'quad', round(q, 3), 'ratio quad/max', round(q / m, 3), '+-10% max window', (round(.9 * m, 2), round(1.1 * m, 2)), 'quad window', (round(.9 * q, 2), round(1.1 * q, 2)))

def Xof(u, r):
    bb = u * u / r / A; return (bb + sqrt(bb * bb + 4 * bb * Da)) / 2

for n_, (a, s), ra, rs in (('wt_glyc', sp['wt_glyc'], 0.7735, 0.7695), ('glpK22', sp['glpK22'], 0.9956, 0.93945)):
    Xa, Xs = Xof(a, ra), Xof(s, rs); Xm = Xa + Xs; rm = (ra + rs) / 2; um = Xm * sqrt(rm * A / (Xm + Da))
    print('  additive-chi alternative (my extension)', n_, 'Xa', round(Xa, 3), 'Xs', round(Xs, 3), 'u_mix', round(um, 2))
cvs = [0.442 / 4.335, 0.318 / 3.675, 0.425 / 4.95, 0.150 / 2.769, 0.2615 / 4.171, 0.4918 / 4.203]
print(' replicate CVs of speed (rows with n>=3):', [round(x, 3) for x in cvs], 'median', round(sorted(cvs)[3], 3), '; SE of mean at n=2, CV 9%:', round(.09 / sqrt(2), 3))
print(' growth rate ser vs asp (same strain+carbon): glucose 0.917 vs 0.9985; glycerol 0.7695 vs 0.7735; glpK22 0.93945 vs 0.9956')
print('== F. F5 (MOESM22)')
ws = sheet('MOESM22')
dose = {'glucose': {}, 'glycerol': {}}
for r in ws.iter_rows(min_row=3, values_only=True):
    if r[2] == 'HE206' and isinstance(r[8], (int, float)):
        dose['glucose' if '20mM' in r[4] else 'glycerol'][r[6]] = (r[8], r[9], r[10])
for cn, d in dose.items():
    ks = sorted(d); print(' ', cn, [(x, round(d[x][0], 3)) for x in ks])
    print('   two-point slope 10->100', round(log(d[100][0] / d[10][0]) / log(10), 4))
    xs = [log(x) for x in (10, 30, 50, 100)]; ys = [log(d[x][0]) for x in (10, 30, 50, 100)]
    bb, se, df, s = ols(xs, ys); print('   OLS 4pt slope', round(bb, 3), 'SE', round(se, 3), 'CI95', (round(bb - T[df] * se, 2), round(bb + T[df] * se, 2)))
    pk = max(d, key=lambda x: d[x][0]); print('   max speed at', pk, 'uM:', round(d[pk][0], 3))
print(' 100uM glucose MOESM11:', [r[8] for r in rows if r[2] == '20mM glucose' and r[5] == 'Aspartate' and r[0] == 'HE206'], ' MOESM22:', dose['glucose'][100][0])
print(' 100uM glycerol MOESM11:', [r[8] for r in rows if r[2] == '40mM glycerol' and r[5] == 'Aspartate' and r[0] == 'HE206'], ' MOESM22:', dose['glycerol'][100][0])
sim = [(r[0], r[1]) for r in ws.iter_rows(min_row=3, values_only=True) if isinstance(r[0], (int, float)) and isinstance(r[1], (int, float))]
print(' sim ED8b points:', len(sim), sim[:3], '...', sim[-2:])
sd_ = dict(sim)
for lo, hi in ((20, 100), (20, 50), (50, 100), (100, 300), (300, 1000)):
    if lo in sd_ and hi in sd_: print(f'  sim slope {lo}->{hi}:', round(log(sd_[hi] / sd_[lo]) / log(hi / lo), 3))
print('  sim monotonic increasing:', all(sim[i + 1][1] > sim[i][1] for i in range(len(sim) - 1)), '; sim at 100 =', sd_.get(100), 'vs data glucose 4.335 -> ratio', round(sd_[100] / 4.3347, 3), '; at 1000 sim', sd_[1000], 'vs data', dose['glucose'][1000][0])
ch = [(r[18], r[19]) for r in ws.iter_rows(min_row=3, values_only=True) if isinstance(r[18], (int, float)) and isinstance(r[19], (int, float))]
cd = dict((round(a), b) for a, b in ch)
u2 = cd[300] + (cd[350] - cd[300]) * 15 / 50
print(' ED8k u^2 vs chi (label um^2/h): at 300', round(cd[300], 3), 'at 350', round(cd[350], 3), '-> interp at 315: u^2', round(u2, 3), 'u=', round(sqrt(u2), 3), 'mm/h')
gr = [(r[16], r[17]) for r in ws.iter_rows(min_row=3, values_only=True) if isinstance(r[16], (int, float)) and isinstance(r[17], (int, float)) and r[17] > 1e-5]
print(' ED8d-h sim u^2/r:', [round(b_ / a_, 2) for a_, b_ in gr][:3], '...', [round(b_ / a_, 2) for a_, b_ in gr][-3:], ' vs experimental k=', round(k, 2))
print('== G. F6'); print(' tau^-0.5:', round(1.5 ** -.5, 4), round(2 ** -.5, 4), ' 1/tau:', round(1 / 1.5, 3), 0.5)
print(' scaling check: c(X/t, Da/t) / c(X, Da) =', round((X / 2) * sqrt(0.9985 * A / (X / 2 + Da / 2)) / (X * sqrt(0.9985 * A / (X + Da))), 4))
