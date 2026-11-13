"""Rank bilayer pairs. Inputs: values below (each with source) + solvent.json.
Output: scratch/bm-formlabs-all-resins/pairs.json and printed tables.
Run: python -I pairs.py
Conventions (project record): f(m,n)=6(1+m)^2/[3(1+m)^2+(1+mn)(m^2+1/(mn))],
m=t1/t2, n=E1/E2, kappa*h = f*d_eps (h total thickness), ceiling f=3/2 at m^2 n = 1.
"""
import json, math, itertools, sys
sys.stdout.reconfigure(encoding='utf-8')
SC = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins'
sol = json.load(open(SC + '/solvent.json', encoding='utf8'))['rows']


def num(s):
    s = s.strip()
    if s.startswith('<'):
        return float(s[1:])  # upper bound
    return float(s)


def f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m * m + 1 / (m * n)))


# sanity: ceiling 3/2 and optimum m = n^-1/2
best = max((f(m / 1000, n), m / 1000, n) for n in (0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000) for m in range(1, 200000, 37))
print('max f over grid <= 1.5:', best[0] <= 1.5 + 1e-12, round(best[0], 6))
for n in (0.0062, 1, 100):
    m = n ** -0.5
    print('n', n, 'm*=n^-1/2 =', round(m, 4), 'f =', round(f(m, n), 6))

# label: (process, E_MPa, E_source, solvent-table row name, chemistry family)
M = {
    'Rigid 10K': ('SLA', 10000, 'TDS rigid10k__910 tensile modulus, post-cured 70C 60 min (10 GPa)', 'Rigid 10K Resin', 'methacrylate'),
    'Rigid 4000': ('SLA', 4100, 'TDS rigid4000__56 tensile modulus post-cured (4.1 GPa)', 'Rigid 4000 Resin', 'methacrylate'),
    'Tough 1000': ('SLA', 932, 'TDS tough1000__3298 tensile modulus post-cured', 'Tough 1000 Resin', 'methacrylate'),
    'Tough 1500 V2': ('SLA', 1460, 'TDS tough1500v2__3173 tensile modulus post-cured', 'Tough 1500 Resin V2', 'methacrylate'),
    'Tough 2000 V2': ('SLA', 1800, 'TDS tough2000v2__3304 tensile modulus post-cured', 'Tough 2000 Resin V2', 'methacrylate'),
    'Durable': ('SLA', 1000, 'TDS durable__51 tensile modulus post-cured (1.0 GPa)', 'Durable Resin V2', 'methacrylate'),
    'Clear V5': ('SLA', 2750, 'TDS clearv5__2426 tensile modulus 15 min 60C', 'Clear Resin V5', 'methacrylate'),
    'Grey V5': ('SLA', 2675, 'TDS grey-v5__2425 tensile modulus 15 min 60C', 'Grey Resin V5', 'methacrylate'),
    'High Temp': ('SLA', 2800, 'TDS hightemp__55 tensile modulus post-cured', 'High Temp Resin V2', 'acrylate'),
    'Flexible 80A V2': ('SLA', 2.9 / 0.5, 'secant = stress@50% (2.9 MPa, TDS 3462) / 0.5; own calc, not a published modulus', 'Flexible 80A Resin', 'methacrylate+PU'),
    'Flexible 50A': ('SLA', 0.9 / 0.5, 'secant = stress@50% (0.9 MPa, TDS 2378) / 0.5; own calc', 'Elastic 50A Resin V2', 'methacrylate'),
    'Silicone 40A': ('SLA', 0.4 / 0.5, 'secant = stress@50% (0.4 MPa, TDS 2083) / 0.5; own calc', 'Silicone 40A Resin', 'polysiloxane'),
    'Nylon 12': ('SLS', 1850, 'TDS nylon12__1351 tensile modulus', 'Nylon 12', 'PA12'),
    'Nylon 11': ('SLS', 1600, 'TDS nylon11__1115 tensile modulus', 'Nylon 11', 'PA11'),
    'Nylon 12 Tough': ('SLS', 1450, 'TDS nylon12tough__2979', 'Nylon 12 Tough', 'PA12'),
    'Nylon 12 GF': ('SLS', 2800, 'TDS nylon12gf__1331', 'Nylon 12 GF', 'PA12'),
    'Nylon 12 White': ('SLS', 1950, 'TDS nylon12white__2978', 'Nylon 12 White', 'PA12'),
    'TPU 90A': ('SLS', 6.1 / 0.5, 'secant = stress@50% X/Y (6.1 MPa, TDS 1909) / 0.5; own calc', 'TPU 90A', 'TPU'),
    'Polypropylene': ('SLS', 1640, 'TDS polypropylene__2360', 'Polypropylene', 'PP'),
}
# water override: Flexible 80A V2 has a different (slab) test in its TDS
OVR = {'Flexible 80A V2': (8.0, 'TDS 3462 deionized water 1 day: +8% mass, +3% volume (slab, ASTM D543-style test, not the 1 cm cube)', 3.0)}
rows = {}
for k, (proc, E, Es, srow, fam) in M.items():
    w, ws, dV = (num(sol[srow]['Water']), 'solvent-compatibility page, 1 cm cube, 24 h (upper bound where printed as <)', None)
    if k in OVR:
        w, ws, dV = OVR[k]
    ipa = num(sol[srow]['Isopropyl Alcohol'])
    rows[k] = dict(process=proc, E_MPa=round(E, 3), E_source=Es, water24_pct=w, water_source=ws, dV_pct=dV, IPA24_pct=ipa, family=fam)


def adhesion(a, b):
    A, B = rows[a], rows[b]
    if A['process'] != B['process']:
        return 1, 'different printer technologies (SLA vat vs SLS powder): no co-print; adhesive bond only (inferred)'
    if A['process'] == 'SLS':
        return 1, 'powders are printed one material per job (inferred: no multi-material statement found); adhesive bond only'
    if 'polysiloxane' in (A['family'], B['family']):
        return 1, 'polysiloxane resin vs methacrylate resin: no source found for co-cure or bond; a forum user reports silicone glue did not stick to acrylate elastomer parts (anecdotal)'
    return 3, 'both (meth)acrylate / urethane-methacrylate photopolymers (SDS section 3): co-curable; Formlabs blog says its resins act as glue under 405 nm light'


pairs = []
for a, b in itertools.combinations(rows, 2):
    A, B = rows[a], rows[b]
    hi, lo = (a, b) if A['E_MPa'] >= B['E_MPa'] else (b, a)
    nratio = rows[hi]['E_MPa'] / rows[lo]['E_MPa']
    dW = abs(A['water24_pct'] - B['water24_pct'])
    dI = abs(A['IPA24_pct'] - B['IPA24_pct'])
    ac, why = adhesion(a, b)
    act = a if A['water24_pct'] >= B['water24_pct'] else b
    pas = b if act == a else a
    pairs.append(dict(a=a, b=b, modulus_ratio=round(nratio, 2), dWater_pp=round(dW, 2), dIPA_pp=round(dI, 2),
                      adhesion_class=ac, adhesion_basis=why, active=act, passive=pas))


def rank(key, rev=True):
    s = sorted(pairs, key=lambda p: -p[key] if rev else p[key])
    r = {}
    i = 0
    while i < len(s):
        j = i
        while j < len(s) and s[j][key] == s[i][key]:
            j += 1
        for x in s[i:j]:
            r[(x['a'], x['b'])] = (i + 1 + j) / 2
        i = j
    return r


ra, rb, rc = rank('modulus_ratio'), rank('dWater_pp'), rank('adhesion_class')
for p in pairs:
    k = (p['a'], p['b'])
    p['rank_a'] = ra[k]; p['rank_b'] = rb[k]; p['rank_c'] = rc[k]; p['rank_sum'] = ra[k] + rb[k] + rc[k]

t_min = 0.2  # mm, Form 4 supported-wall minimum (Formlabs Form 4 design guide, Grey V5, as read by the earlier agent)


def geom(act, pas, deps):
    E1, E2 = rows[act]['E_MPa'], rows[pas]['E_MPa']
    n = E1 / E2
    mstar = n ** -0.5
    if mstar >= 1:
        ta, tp = t_min * mstar, t_min
    else:
        ta, tp = t_min, t_min / mstar
    h = ta + tp
    return dict(active=act, passive=pas, n=round(n, 5), m_opt=round(mstar, 3), t_active_mm=round(ta, 3),
                t_passive_mm=round(tp, 3), h_mm=round(h, 3), kappa_opt_per_m=round(1.5 * deps / (h / 1000), 2),
                f_equal_thickness=round(f(1.0, n), 4),
                kappa_equal_t_1mm_total_per_m=round(f(1.0, n) * deps / 0.001, 2))


eps1 = 1.03 ** (1 / 3) - 1
eps7 = 1.07 ** (1 / 3) - 1
geo = []
for pas in ['Tough 1000', 'Rigid 10K', 'Silicone 40A', 'Flexible 50A', 'Tough 2000 V2', 'Durable', 'Grey V5']:
    g = geom('Flexible 80A V2', pas, eps1)
    g['d_eps_1day'] = round(eps1, 5)
    g['d_eps_1week'] = round(eps7, 5)
    g['kappa_opt_1week_per_m'] = round(1.5 * eps7 / (g['h_mm'] / 1000), 2)
    geo.append(g)
json.dump(dict(rows=rows, pairs=pairs, geometry=geo), open(SC + '/pairs.json', 'w', encoding='utf8'), indent=1)


def show(title, key, rev=True, n=12, filt=lambda p: True):
    print('\n==', title)
    for p in sorted([p for p in pairs if filt(p)], key=lambda p: (-p[key] if rev else p[key]))[:n]:
        print(f"{p['a']:16s} + {p['b']:16s} ratioE={p['modulus_ratio']:>9} dWater={p['dWater_pp']:>5} dIPA={p['dIPA_pp']:>6} adh={p['adhesion_class']} ranksum={p['rank_sum']:.1f}")


sla = lambda p: rows[p['a']]['process'] == 'SLA' and rows[p['b']]['process'] == 'SLA'
show('(a) modulus contrast, all', 'modulus_ratio')
show('(a) modulus contrast, SLA only', 'modulus_ratio', filt=sla)
show('(b) water contrast', 'dWater_pp')
show('(b) IPA contrast, SLA', 'dIPA_pp', filt=sla)
show('combined rank-sum (lower better)', 'rank_sum', rev=False)
show('combined rank-sum, adhesion class 3 only', 'rank_sum', rev=False, filt=lambda p: p['adhesion_class'] == 3)
print('\n== geometry: active Flexible 80A V2; linear strain %.5f at 1 d (+3%% vol), %.5f at 1 wk (+7%% vol), isotropic, passive layer inert' % (eps1, eps7))
for g in geo:
    print(g)
