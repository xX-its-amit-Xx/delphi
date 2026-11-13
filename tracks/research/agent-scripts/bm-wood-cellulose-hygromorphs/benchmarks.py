"""bm-wood-cellulose-hygromorphs: derived benchmark numbers.
Run:  python -I -X utf8 benchmarks.py
Reads  D:/Users/ashenoy00000/delphi-work/data/wood-hygro/eth-beech/beech_bilayers.csv  (ETH, doi 10.3929/ethz-b-000275694, copied read-only from
       the earlier agent's download; sha256 b5b6f24d...1119)
Writes D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-wood-cellulose-hygromorphs/benchmarks_out.json
Every input number carries a comment naming the fetched source.
"""
import csv, json, math

OUT = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-wood-cellulose-hygromorphs/benchmarks_out.json'
res = {}


def f(m, n):
    """Timoshenko coefficient, project record: f = 6(1+m)^2 / [3(1+m)^2 + (1+mn)(m^2 + 1/(mn))]"""
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m * m + 1 / (m * n)))


# ---- 1. grid check that the ceiling is 1.5 and sits at m = n^-1/2 (numerical, not a proof) -------------------
mx = 0.0; arg = None
for ln in range(-30, 31):          # n from 10^-3 to 10^3
    n = 10 ** (ln / 10)
    best = max((f(10 ** (lm / 200), n), 10 ** (lm / 200)) for lm in range(-600, 601))
    assert best[0] <= 1.5 + 1e-9, (n, best)
    mx = max(mx, best[0])
    if abs(best[1] - n ** -0.5) / n ** -0.5 > 0.02:
        raise SystemExit('optimum not at n^-1/2 for n=%g: %s' % (n, best))
res['grid_max_f'] = mx

# ---- 2. efficiency eta = f/1.5 of published bilayers ---------------------------------------------------------
rows = []


def add(name, m, n, src, note=''):
    rows.append(dict(name=name, m=m, n=n, f=round(f(m, n), 3), eta=round(f(m, n) / 1.5, 3),
                     m_opt=round(n ** -0.5, 3), src=src, note=note))


# Holstov 2015 worked example: wood 0.5 GPa, fibreglass 15 GPa, passive ~5x thinner than active  (holstov2015.pdf, section 3.2.4)
add('Holstov worked example, passive 5x thinner', 0.2, 30, 'holstov2015.pdf s3.2.4', 'n = Ep/Ea = 15/0.5')
add('Holstov worked example, equal thickness', 1.0, 30, 'holstov2015.pdf s3.2.4', 'paper says "reduced by as much as 60%"')
# Cellulose acetate bilayer, Khoshtinat 2023: m = hp/ha = 1.69, n = Ep/Ea = 3.84 (khosh.txt, Experimental section)
add('Cellulose acetate / tape (Khoshtinat 2023)', 1.69, 3.84, 'khosh.txt', 'm,n as stated by the authors')
# Ruggeberg & Burgert 2015: spruce passive 0.2..4 mm on 4 mm beech, n = 10-30 (PMC4383548)
for hs in (0.2, 0.8, 1.0, 2.0, 4.0):
    for n in (10, 20, 30):
        add('Ruggeberg & Burgert, spruce %.1f mm on 4 mm beech, n=%d' % (hs, n), hs / 4.0, n, 'PMC4383548')
# Dingler 2021: 6 um PEDOT:PSS on 11 or 48 um PDMS, as recomputed by the earlier agent: m=0.48 n=6.8 (PMC11469309)
add('Dingler 2021 (m=0.48,n=6.8, earlier agent)', 0.48, 6.8, 'PMC11469309 via agents/spec-hygromorph-4d.json')
res['efficiency_table'] = rows

# ---- 3. Ruggeberg & Burgert predicted vs measured curvature --------------------------------------------------
d_alpha = 3.2e-3 - 0.07e-3        # per %MC; beech 3.2e-3, spruce 0.7e-4 (PMC4383548 text)
rb = []
for dmc in (7, 8, 9):             # "around 18% to around 10%" -> 7..9 points
    for hs in (0.2, 0.8, 1.0, 4.0):
        for n in (10, 20, 30):
            m = hs / 4.0; h = 4.0 + hs
            k = f(m, n) * d_alpha * dmc / h * 1000      # m^-1  (d_eps/h in 1/mm -> *1000)
            rb.append(dict(dMC=dmc, h_spruce=hs, n=n, kappa_pred_per_m=round(k, 2)))
res['rb_pred'] = rb
res['rb_measured'] = {'<=1mm spruce, 24 h': 8.7, '4mm spruce, 24 h': 1.5, 'unit': 'm^-1 (8.7e-3 and 1.5e-3 mm^-1, PMC4383548)'}
# implied normalised curvature kappa*h/d_eps for the 8.7 m^-1 peak, h=4.2 (0.2 mm spruce) .. 5.0 (1 mm spruce)
res['rb_peak_norm'] = {str(h): round(8.7e-3 * h / (d_alpha * 8), 3) for h in (4.2, 4.8, 5.0)}
res['rb_m1_norm'] = round(1.5e-3 * 8.0 / (d_alpha * 8), 3)

# ---- 4. ETH beech dataset: normalised curvature and moisture half-times -----------------------------------
CSV = 'D:/Users/ashenoy00000/delphi-work/data/wood-hygro/eth-beech/beech_bilayers.csv'
rws = list(csv.reader(open(CSV, encoding='utf-8')))
iw = [i for i, r in enumerate(rws) if r and r[0].startswith('Wood moisture')][0] + 1
ik = [i for i, r in enumerate(rws) if r and r[0].startswith('curvature')][0] + 1


def block(s):
    return {float(r[0]): [float(x) for x in r[1:7]] for r in rws[s:s + 8]}


W = block(iw); K = block(ik)
h1 = [0.6, 0.8, 1.2, 2.2, 3.2, 3.9]; h2 = 4.1       # mm, Grönquist 2018 Table 1 (as used by the earlier agent)
aL, aR = 0.0001, 0.0019                              # per %MC beech, paper text
eth = []
times = sorted(W)


def t_half(series, tgt):
    """linear interpolation time at which series (indexed by times) first reaches tgt of its final change"""
    s0 = series[0]; s1 = series[-1]; goal = s0 + tgt * (s1 - s0)
    for a, b, ta, tb in zip(series, series[1:], times, times[1:]):
        if (a - goal) * (b - goal) <= 0 and a != b:
            return ta + (goal - a) * (tb - ta) / (b - a)


for j in range(6):
    dw = W[0][j] - W[48][j]; de = (aR - aL) * dw; h = (h1[j] + h2) / 1000
    kap = K[48][j]
    mser = [W[t][j] for t in times]; kser = [K[t][j] for t in times]
    eth.append(dict(r=round(h1[j] / (h1[j] + h2), 2), h_mm=h1[j] + h2, kappa48_per_m=round(kap, 2), d_eps=round(de, 5),
                    kh_over_deps=round(kap * h / de, 3),
                    t50_moisture_h=round(t_half(mser, .5), 2), t80_moisture_h=round(t_half(mser, .8), 2),
                    t50_curv_h=round(t_half(kser, .5), 2), t80_curv_h=round(t_half(kser, .8), 2)))
res['eth_beech'] = eth

# ---- 5. apparent diffusivity from time-to-X for a slab of thickness L open on one face (or half-thickness for two faces)
def uptake(Fo, terms=200):
    return 1 - (8 / math.pi ** 2) * sum(math.exp(-((2 * k + 1) ** 2) * math.pi ** 2 * Fo / 4) / (2 * k + 1) ** 2 for k in range(terms))


def Fo_for(u):
    lo, hi = 1e-9, 20.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if uptake(mid) < u: lo = mid
        else: hi = mid
    return (lo + hi) / 2


res['Fo'] = {str(u): round(Fo_for(u), 4) for u in (0.5, 0.8, 0.95)}


def D_app(L_mm, t_h, u):
    """mm^2/h and m^2/s; L = length of the diffusion path (thickness if one face open, half thickness if both)"""
    d = Fo_for(u) * L_mm ** 2 / t_h
    return dict(D_mm2_per_h=round(d, 4), D_m2_per_s=float('%.2e' % (d * 1e-6 / 3600)))


diff = {}
diff['Holstov 1 mm birch + 0.2 mm glass, t80=2.25 h (RH steps); one face open'] = D_app(1.0, 2.25, 0.8)
diff['Holstov, same, both faces open (L=0.5 mm)'] = D_app(0.5, 2.25, 0.8)
t50m = [e['t50_moisture_h'] for e in eth]
diff['ETH beech 4.1 mm active, moisture t50 (mean of 6), one face open'] = D_app(4.1, sum(t50m) / 6, 0.5)
diff['ETH beech 4.1 mm active, moisture t50, both faces (L=2.05 mm)'] = D_app(2.05, sum(t50m) / 6, 0.5)
diff['Cellulose acetate 86 um, FE saturation (take 95%) 60 min, one face open'] = D_app(0.086, 1.0, 0.95)
res['apparent_diffusivity'] = diff
res['prior_filament_D_mm2_per_h'] = [0.001, 0.015]  # agents/spec-bilayer-physics.json (measured filament diffusivities)

# ---- 6. minimum free differential strain implied by the ceiling: d_eps >= (2/3) kappa h ------------------------
imp = []


def add_imp(name, kappa_per_m, h_mm, d_eps_meas=None, src=''):
    dmin = (2 / 3) * kappa_per_m * h_mm * 1e-3
    imp.append(dict(name=name, kappa_per_m=kappa_per_m, h_mm=h_mm, d_eps_min_pct=round(100 * dmin, 3),
                    d_eps_reported_pct=None if d_eps_meas is None else round(100 * d_eps_meas, 3),
                    kh_over_deps=None if d_eps_meas is None else round(kappa_per_m * h_mm * 1e-3 / d_eps_meas, 3), src=src))


add_imp('Cellulose acetate/tape, RH 35->80%', 51.1, 0.228, None, 'khosh.txt: kappa=0.0511 mm^-1, htot=0.228 mm')
add_imp('Dingler PEDOT:PSS/PDMS 17 um, 90% RH', 1200, 0.017, 0.061, 'PMC11469309 (earlier agent: 1.2 mm^-1, strain 6.1%)')
add_imp('Dingler PEDOT:PSS/PDMS 54 um, 90% RH', 420, 0.054, 0.061, 'PMC11469309 (0.42 mm^-1)')
add_imp('Ruggeberg 8.7 m^-1, h=4.2', 8.7, 4.2, d_alpha * 8, 'PMC4383548')
add_imp('Ruggeberg 8.7 m^-1, h=5.0', 8.7, 5.0, d_alpha * 8, 'PMC4383548')
add_imp('Groenquist 2018 beech r=0.17 (ETH csv)', 4.51, 4.9, (aR - aL) * (W[0][1] - W[48][1]), 'ETH csv')
imp = [x for x in imp if x['h_mm']]
res['implied_min_strain'] = imp

# design table: strain needed to reach a target curvature at a given total thickness
tbl = []
for kappa in (8.7, 15.5, 51.1):
    for h in (0.4, 0.8, 1.6):
        tbl.append(dict(kappa_per_m=kappa, h_mm=h, d_eps_min_pct=round(100 * (2 / 3) * kappa * h * 1e-3, 2)))
res['strain_needed_for_benchmark_curvature'] = tbl
# earlier-agent figures for stock Flexible 80A V2 (scout-biomaterial.json): 0.99% (1 day), 2.28% (1 week) immersion strain
for e, lab in ((0.0099, '1 day'), (0.0228, '1 week')):
    res['flex80A_kappa_max_at_0.8mm_%s' % lab.replace(' ', '')] = round(1.5 * e / 0.8e-3, 1)

json.dump(res, open(OUT, 'w'), indent=1)
print(json.dumps(res, indent=1)[:12000])
