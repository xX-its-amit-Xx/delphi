"""bm-bilayer-theory-verified: every own-calculation number in the report.

Run:  python verify_bilayer.py   (Python 3, numpy, sympy; writes verify_bilayer_out.json next to itself's scratch dir)
Sections
  1  f(m,n) from Timoshenko 1925 eq.(4): ceiling 3/2, optimum m^2 n = 1, layer-swap symmetry
  2  Timoshenko's printed special cases eq.(5),(6),(7) reproduced
  3  Freund-Floro-Chason eq.(6) == Timoshenko f (symbolic identity, with M=E/(1-nu)); Stoney thin-film limit; Stoney 1909 eq.(1)
  4  sensitivity of f to modulus ratio (Reyssat-Mahadevan "<10 %/<20 %" claims; wet-modulus loss)
  5  Pezzulla-Smith-Nardinocchi-Holmes bifurcation curvature (eq.6) for disk and rectangle shape factors
  6  transient one-sided diffusion into the active layer: curvature response time in units of a^2/D
  7  response times in real units for measured filament diffusivities (Aniskevich 2023 Table 3)
"""
import json, math, os
import numpy as np
import sympy as sp

OUT = {}

def f(m, n):
    m = np.asarray(m, dtype=float); n = np.asarray(n, dtype=float)
    return 6*(1+m)**2 / (3*(1+m)**2 + (1+m*n)*(m**2 + 1/(m*n)))

# ---------------- 1 ceiling -----------------
mm = np.logspace(-3, 3, 4001); nn = np.logspace(-3, 3, 601)
M, N = np.meshgrid(mm, nn)
F = f(M, N)
OUT['grid_max_f'] = float(F.max())
OUT['grid_cells'] = int(F.size)
rel = (F - 1.5)
OUT['grid_max_f_minus_1p5'] = float(rel.max())   # must be <= ~0 (float round-off only)
# location of the max for several n
opt = {}
for n_ in (0.1, 0.5, 1, 2, 5, 10, 100):
    mfine = np.logspace(-3, 3, 400001)
    i = int(np.argmax(f(mfine, n_)))
    opt[str(n_)] = {'m_argmax': float(mfine[i]), 'm_theory': n_**-0.5, 'f_max': float(f(mfine[i], n_))}
OUT['optimum'] = opt
# symbolic AM-GM: 3/2 - f >= 0 with equality iff m^2 n = 1
m, n = sp.symbols('m n', positive=True)
fs = 6*(1+m)**2/(3*(1+m)**2 + (1+m*n)*(m**2 + 1/(m*n)))
gap = sp.simplify(sp.Rational(3, 2) - fs)
num = sp.factor(sp.together(gap))
OUT['gap_3over2_minus_f_factored'] = str(num)
# layer-swap symmetry f(m,n)=f(1/m,1/n)
OUT['swap_symmetry_residual'] = str(sp.simplify(fs - fs.subs({m: 1/m, n: 1/n}, simultaneous=True)))

# ---------------- 2 Timoshenko printed cases -----------------
tim = {}
tim['eq5_m1_n1 24/(14+n+1/n)'] = 24/(14+1+1)
tim['eq6_printed 3/2'] = 1.5
tim['f(1,1)'] = float(f(1, 1))
tim['eq7_printed 48/33'] = 48/33
tim['f(1,2)'] = float(f(1, 2)); tim['f(1,0.5)'] = float(f(1, 0.5))
tim['difference_(6)_vs_(7)_percent'] = 100*(1.5 - 48/33)/1.5
OUT['timoshenko_printed_cases'] = tim

# ---------------- 3 FFC / Stoney identities -----------------
a1, a2, E1, E2, eps = sp.symbols('a1 a2 E1 E2 eps', positive=True)
mT = a1/a2; nT = E1/E2
kT = eps*fs.subs({m: mT, n: nT})/(a1+a2)              # Timoshenko, film=layer 1
h_, mF = sp.symbols('h_ mF', positive=True)           # FFC: h=hf/hs, m=Mf/Ms
kF = 6*eps*h_*mF/a2*((1+h_)/(1+h_*mF*(4+6*h_+4*h_**2)+h_**4*mF**2))
resid = sp.simplify(kF.subs({h_: a1/a2, mF: E1/E2}) - kT)   # M<->E (same nu both layers)
OUT['ffc_eq6_minus_timoshenko_symbolic'] = str(resid)
# Stoney limit: film thin (a1->0)
stoney_lim = sp.limit(sp.simplify(kT*a2/(eps*a1/a2*E1/E2)), a1, 0)
OUT['timoshenko_thin_film_limit_kappa/(6 eps (E1/E2)(a1/a2)/a2)'] = str(stoney_lim)
# Stoney 1909 eq.(1)  P = (4/3) E d^2 z /(t l^2)  from  P t = (1/6) E d^2 / r , r = l^2/(8 z)
E, d, t, r, z_, l = sp.symbols('E d t r z l', positive=True)
P = (sp.Rational(1, 6)*E*d**2/r)/t
P1 = sp.simplify(P.subs(r, l**2/(8*z_)))
OUT['stoney1909_P_eq1'] = str(P1)           # expect 4*E*d**2*z/(3*l**2*t)
# FFC: error of Stoney for m=1 (equal moduli) h=0.1
hh = 0.1
kappa_ratio = (1+hh)/(1+hh*1*(4+6*hh+4*hh**2)+hh**4*1)
OUT['ffc_m1_h0.1'] = {'kappa/kappa_Stoney_exact': kappa_ratio, '1/(1+h)^3': 1/(1+hh)**3,
                      'Stoney_overestimates_by_percent': 100*(1/kappa_ratio-1)}

# ---------------- 4 sensitivity -----------------
sens = {}
sens['f(1,n) n=0.3,3.5,5'] = [float(f(1, x)) for x in (0.3, 3.5, 5)]
sens['RM_claim_<10%_n0.3-3.5_m1'] = float(100*(1.5-min(f(1, 0.3), f(1, 3.5)))/1.5)
sens['RM_claim_<20%_n0.3-5_m1'] = float(100*(1.5-f(1, 5))/1.5)
sens['f(1,10)'] = float(f(1, 10)); sens['loss_vs_optimum_n10_percent'] = float(100*(1-f(1, 10)/1.5))
sens['RM_pinecone_m1_n5_f'] = float(f(1, 5))   # R&M text says f ~ 1.3
# wet-modulus loss: design at n0 with optimum m, then active layer E falls to s*E (s=0.65: Grey V5 prior record)
wet = []
for n0 in (1, 3, 10):
    m0 = n0**-0.5
    for s in (0.9, 0.65, 0.5, 0.3):
        wet.append({'n_dry': n0, 'm_design': m0, 'E_active_retained': s, 'f_wet': float(f(m0, n0*s)), 'f_loss_percent': float(100*(1-f(m0, n0*s)/1.5))})
sens['wet_modulus_loss_active_layer'] = wet
# if the ACTIVE layer is the stiffer (n=E_active/E_passive>1) and softens, n falls; if soft active layer and passive stiff, n<1 and softening lowers n further:
wet2 = []
for n0 in (0.1, 0.3):
    m0 = n0**-0.5
    for s in (0.65, 0.3):
        wet2.append({'n_dry': n0, 'm_design': m0, 'E_active_retained': s, 'f_wet': float(f(m0, n0*s)), 'f_loss_percent': float(100*(1-f(m0, n0*s)/1.5))})
sens['wet_modulus_loss_soft_active'] = wet2
# modulus MIS-ESTIMATE of the printed (anisotropic) layer: design at n0 with optimum m, true n = s*n0 in either direction
mis = []
for n0 in (1, 3, 10):
    m0 = n0**-0.5
    for s in (0.3, 0.5, 2, 3.3):
        mis.append({'n_design': n0, 'm_design': m0, 'factor_on_n': s, 'f_true': float(f(m0, n0*s)), 'f_loss_percent': float(100*(1-f(m0, n0*s)/1.5))})
sens['modulus_misestimate_factor'] = mis
# interface at the neutral axis: B = n*a1^2/2 - a2^2/2 = 0 <=> m^2 n = 1 (own identity; explains why n drops out of the kinetics at the optimum)
sens['neutral_axis_identity'] = 'EA-weighted first moment about the interface = (E1 a1^2 - E2 a2^2)/2 = 0  <=>  m^2 n = 1'
OUT['sensitivity'] = sens

# ---------------- 5 Pezzulla bifurcation -----------------
c = math.sqrt((20+14*math.sqrt(2))/27)
OUT['pezzulla_eq6_prefactor_sqrt((20+14sqrt2)/27)'] = c
S_disk = (2/27)**0.25               # S/R for a circle: S=(2/9 * int r^4 dA / A)^(1/4); int r^4 dA/A = R^4/3
OUT['pezzulla_S_over_R_disk'] = S_disk
Rc_over_sqrt_h_over_k = math.sqrt(c/S_disk**2)   # kappa_b = c h/S^2  ->  S^2 = c h/kappa -> R = S/S_disk
OUT['pezzulla_disk_Rc_over_sqrt(h/kappa)'] = Rc_over_sqrt_h_over_k
def S_rect(a, b):  # centred rectangle a x b: <r^4> = a^4/80 + b^4/80 + a^2 b^2/72
    return ((2/9)*(a**4/80 + b**4/80 + a**2*b**2/72))**0.25
rows = []
for h in (0.4, 0.8, 1.6):                       # mm, total bilayer thickness
    for e in (0.002, 0.005, 0.01, 0.02):
        kap = 1.5*e/h                            # 1/mm, optimum Timoshenko curvature
        Rc = Rc_over_sqrt_h_over_k*math.sqrt(h/kap)
        # a rectangle L x w : critical natural curvature kappa_b = c h/S^2 ; find L for given w=10 mm
        rows.append({'h_mm': h, 'eps': e, 'kappa_per_mm': kap, 'R_beam_mm': 1/kap,
                     'critical_disk_radius_mm': Rc, 'critical_disk_diameter_mm': 2*Rc,
                     'sqrt(h/kappa)_mm': math.sqrt(h/kap)})
OUT['pezzulla_critical_disk_table'] = rows
# for a 10 mm x 40 mm strip: S and critical kappa
rect = []
for h in (0.4, 0.8, 1.6):
    S = S_rect(40, 10); kb = c*h/S**2
    rect.append({'h_mm': h, 'strip_mm': '40x10', 'S_mm': S, 'kappa_bif_per_mm': kb, 'R_bif_mm': 1/kb,
                 'eps_at_optimum_for_bif': kb*h/1.5})
OUT['pezzulla_rect_40x10'] = rect
OUT['pezzulla_note'] = ('S_rect formula assumes the shape-factor definition printed in the paper; for strips with L>>w the '
                        'result is dominated by L (the model compares sphere vs cylinder, not the strip-width effect).')

# 5b three independent estimates of the plate diameter above which the strip (beam) value no longer holds, in units of sqrt(h/kappa)
#  Timoshenko 1925 p.242: spherical-cap sag kappa*D^2/8 must be < h/2  ->  D < 2 sqrt(h/kappa)
#  Freund-Floro-Chason 1999: Stoney regime while S = K = kappa R^2/(4 h_s) < 0.3 -> R < sqrt(1.2 h/kappa) -> D < 2.19 sqrt(h/kappa)
#  Pezzulla et al. 2016 eq.6 (disk): R_c = 2.112 sqrt(h/kappa) -> D_c = 4.22 sqrt(h/kappa)  (sphere -> cylinder bifurcation)
OUT['critical_diameter_over_sqrt(h/kappa)'] = {
    'Timoshenko_sag<h/2': 2.0,
    'FFC_S<0.3': 2*math.sqrt(4*0.3),
    'Pezzulla_bifurcation_disk': 2*Rc_over_sqrt_h_over_k,
    'sag_at_Pezzulla_bifurcation_in_units_of_h': (2*Rc_over_sqrt_h_over_k)**2/8}

# ---------------- 6 transient diffusion -----------------
def curvature_unit(prof_eps, z, a1_, a2_, n_, nz):
    """Linear-elastic bilayer, layer1 (top, E1=n*E2, thickness a1) with eigenstrain profile; returns kappa (unit eps) """
    # unknown d,kappa ; sigma=E(d+kappa z - eps(z)) top ; E2(d+kappa z) bottom
    zt = z                      # z in [0,a1]
    w = np.full_like(zt, a1_/(len(zt)-1)); w[0] *= .5; w[-1] *= .5
    A = n_*a1_ + a2_
    B = n_*a1_**2/2 - a2_**2/2
    C = n_*a1_**3/3 + a2_**3/3
    R0 = n_*np.sum(prof_eps*w)
    R1 = n_*np.sum(prof_eps*zt*w)
    # A d + B k = R0 ; B d + C k = R1
    det = A*C - B*B
    return (A*R1 - B*R0)/det

def transient(n_=10.0, m_=None, nterms=400):
    if m_ is None: m_ = n_**-0.5
    a2_ = 1.0; a1_ = m_*a2_       # layer 1 = active & stiff (n=E1/E2)
    nz = 801; z = np.linspace(0, a1_, nz)
    k_inf = curvature_unit(np.ones(nz), z, a1_, a2_, n_, nz)
    times = np.logspace(-4, 1, 400)               # Dt/a1^2
    kap = []; mass = []
    for tau in times:
        cc = np.ones(nz)
        for k in range(nterms):
            lam = (2*k+1)*math.pi/2
            cc -= 4*(-1)**k/((2*k+1)*math.pi)*np.cos(lam*z/a1_)*math.exp(-lam**2*tau)
        kap.append(curvature_unit(cc, z, a1_, a2_, n_, nz)/k_inf)
        w = np.full(nz, a1_/(nz-1)); w[0] *= .5; w[-1] *= .5
        mass.append(float(np.sum(cc*w)/a1_))
    kap = np.array(kap); mass = np.array(mass)
    def t_at(arr, q):
        i = int(np.argmax(arr >= q)); return float(times[i])
    return {'n': n_, 'm': m_, 'kappa_inf_per_eps_over_a2': k_inf, 't63_kappa': t_at(kap, 0.632), 't90_kappa': t_at(kap, 0.9),
            't99_kappa': t_at(kap, 0.99), 't90_mass': t_at(mass, 0.9), 't63_mass': t_at(mass, 0.632),
            'max_kappa_over_final': float(kap.max()), 'slowest_mode_tau_Dt/a1^2': 4/math.pi**2}
tr = [transient(1.0, 1.0), transient(10.0), transient(3.0, 1.0)]
OUT['transient_one_sided'] = tr

# ---------------- 7 real-unit times -----------------
D_vals = {'Nylon filament (Aniskevich T3)': 0.001, 'PEKK/Antero': 0.00245, 'PET-G': 0.00335, 'PC': 0.00472,
          'PLA LAVA': 0.00782, 'PLA T-W': 0.0151}      # mm^2/h
real = []
t90 = tr[0]['t90_kappa']
for a in (0.2, 0.4, 0.8):
    for name, D in D_vals.items():
        real.append({'active_layer_mm': a, 'material': name, 'D_mm2_per_h': D,
                     't90_curvature_h(n=1,m=1)': t90*a*a/D, 'a^2/D_h': a*a/D})
OUT['real_unit_times'] = real
OUT['t90_units'] = 'Dt/a1^2 for one-sided exposure of the active layer (other face of active layer bonded to inert impermeable layer)'

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'verify_bilayer_out.json')
json.dump(OUT, open(p, 'w'), indent=1, default=str)
print(json.dumps(OUT, indent=1, default=str)[:12000])
print('written', p)
