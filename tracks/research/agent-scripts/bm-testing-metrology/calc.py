"""bm-testing-metrology: all arithmetic for the protocol.
Run: python calc.py   (writes calc_out.json next to it). Needs numpy + scipy.
"""
import json, math
from scipy.optimize import least_squares, brentq

out = {}


# ---- 0. Check the Fickian plate formula against ISO 62:2008 Table 1 ----
def plate(x, nterms=200):
    """c/c_s for a plane sheet open on both faces; x = D*pi^2*t/d^2."""
    s = 0.0
    for k in range(nterms):
        n = 2 * k + 1
        s += math.exp(-n * n * x) / (n * n)
    return 1 - 8 / math.pi ** 2 * s


iso_x = [0, 0.01, 0.10, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]
iso_c = [0, 0.07, 0.22, 0.51, 0.60, 0.70, 0.82, 0.89, 0.96, 0.99, 1.00]
out['iso62_table_check_x_isoC_myC'] = [(x, c, round(plate(x), 3)) for x, c in zip(iso_x, iso_c)]


# ---- 1. Fit D and M_inf to Formlabs Grey V5 data ----
def box_uptake(t, D, Minf, dims):
    f = 1.0
    for d in dims:
        f *= (1 - plate(D * math.pi ** 2 * t / d ** 2))
    return Minf * (1 - f)


day = 86400.0
data_bar = [(1 * day, 1.38), (7 * day, 3.23)]   # Clear V5 TDS p.9-10: 101.38 %, 103.23 % mass (Grey V5 Type IV bars, DI water)
data_cube = [(1 * day, 0.8)]                      # solvent-compatibility page: Grey Resin V5 water 24 h 1 cm cube


def resid(p, bar_dims):
    lD, Minf = p
    D = 10 ** lD
    r = [box_uptake(t, D, Minf, bar_dims) - m for t, m in data_bar]
    r += [box_uptake(t, D, Minf, (10, 10, 10)) - m for t, m in data_cube]
    return r


fits = {}
x95 = brentq(lambda x: plate(x) - 0.95, 1e-4, 10)
out['x95_D_pi2_t_over_d2'] = x95
for name, dims in [('bar thickness 3.2 mm, faces only', (3.2, 1e9, 1e9)),
                   ('bar box 3.2 x 6 x 33 mm', (3.2, 6.0, 33.0))]:
    best = None
    for l0 in (-8, -7, -6, -5.5, -5):
        s = least_squares(resid, [l0, 4.0], args=(dims,), bounds=([-10, 0.5], [-3, 30]))
        if best is None or s.cost < best.cost:
            best = s
    D = 10 ** best.x[0]
    Minf = best.x[1]
    fits[name] = dict(D_mm2_per_s=D, D_m2_per_s=D * 1e-6, Minf_pct=Minf,
                      residuals_pct=[round(float(x), 3) for x in best.fun])
    for d in (0.4, 0.8, 1.0, 2.0):
        fits[name]['t95_d%smm_h' % d] = round(x95 * d * d / (D * math.pi ** 2) / 3600, 2)
out['grey_v5_fit'] = fits
out['grey_v5_fit_note'] = ('2 parameters (D, M_inf) fitted to 3 points; bar thickness 3.2 mm and planform are ASSUMED '
                           '(ASTM D638 Type IV nominal, unverified background). Order-of-magnitude only.')

# ---- 2. Resolution arithmetic: 0.2 % strain on a 40 mm strip ----
L0 = 40.0
eps = 0.002
dL = eps * L0
st = dict(L0_mm=L0, eps=eps, signal_um=dL * 1e3)
st['sigma_dL_for_10pct_um'] = 0.10 * dL * 1e3
st['sigma_dL_for_6.7pct_um'] = (0.20 / 3) * dL * 1e3
st['sigma_single_reading_for_6.7pct_um'] = (0.20 / 3) * dL * 1e3 / math.sqrt(2)
out['strain'] = st
out['caliper'] = dict(accuracy_um=0.001 * 25.4 * 1e3, resolution_um=10,
                      strain_err_if_accuracy_not_cancelled_pct=0.001 * 25.4 / L0 * 100,
                      ratio_accuracy_to_signal=0.001 * 25.4 * 1e3 / (dL * 1e3),
                      quantisation_sigma_of_difference_um=10 / math.sqrt(12) * math.sqrt(2),
                      quantisation_strain_sigma_pct=10 / math.sqrt(12) * math.sqrt(2) / 1e3 / L0 * 100)
out['kruger_caliper'] = dict(acc_mm=0.02, L_mm=75, strain_err_pct=0.02 / 75 * 100, same_on_40mm_pct=0.02 / 40 * 100)
out['camera'] = []
for px_w, fov in [(4000, 60.0), (4000, 80.0), (8000, 60.0)]:
    um_px = fov / px_w * 1e3
    out['camera'].append(dict(px_across=px_w, fov_mm=fov, um_per_px=round(um_px, 2),
                              edge_0p1px_um=round(0.1 * um_px, 2),
                              sigma_dL_two_edges_um=round(0.1 * um_px * math.sqrt(2), 2),
                              strain_sigma_pct=round(0.1 * um_px * math.sqrt(2) / 1e3 / L0 * 100, 4),
                              strain_sigma_if_0p5px_pct=round(0.5 * um_px * math.sqrt(2) / 1e3 / L0 * 100, 4)))
out['tilt_foreshortening_pct'] = {str(a): round((1 - math.cos(math.radians(a))) * 100, 4) for a in (0.5, 1, 2, 5)}
out['scanner_1200dpi_um_per_px'] = 25.4 / 1200 * 1e3

# ---- 3. Mass arithmetic ----
V = 40 * 10 * 1e-3   # cm^3, 40 x 10 x 1 mm
m = {}
for k, rho in {'Clear/Grey V5 (1.21 g/cm3)': 1.21, 'Flexible 80A V2 (1.09 g/cm3)': 1.09}.items():
    mass_g = V * rho
    m[k] = dict(mass_g=round(mass_g, 4), mass_of_1pct_mg=round(mass_g * 10, 3),
                mass_of_0p1pct_mg=round(mass_g, 3), mass_of_0p9pct_mg=round(mass_g * 9, 2),
                mass_of_8pct_mg=round(mass_g * 80, 1))
out['coupon_mass'] = dict(volume_cm3=V, by_material=m)
surface_cm2 = 2 * (4.0 * 1.0 + 4.0 * 0.1 + 1.0 * 0.1)
out['wet_film'] = dict(surface_cm2=surface_cm2, film_1um_mg=surface_cm2 * 1e-4 * 1e3,
                       film_10um_mg=surface_cm2 * 1e-3 * 1e3,
                       film_1um_pct_of_coupon_clear=surface_cm2 * 1e-4 * 1e3 / (V * 1.21 * 1e3) * 100,
                       film_10um_pct_of_coupon_clear=surface_cm2 * 1e-3 * 1e3 / (V * 1.21 * 1e3) * 100)


def mass_err_pct(read_mg, uptake_pct, mass_g=V * 1.21):
    sig = read_mg / math.sqrt(12) * math.sqrt(2)      # mg, difference of two quantised readings
    return sig / (mass_g * 10 * uptake_pct) * 100


rows = {}
for name, r in [('0.1 mg analytical', 0.1), ('1 mg precision', 1.0), ('10 mg jewellery', 10.0),
                ('100 mg kitchen', 100.0), ('1 g kitchen', 1000.0)]:
    rows[name] = {'uptake_%spct' % u: round(mass_err_pct(r, u), 1) for u in (0.1, 0.5, 1.0, 3.0, 8.0)}
out['balance_1sigma_rel_err_pct_of_uptake_single_coupon'] = rows
stack = {}
for name, r in [('10 mg jewellery', 10.0), ('100 mg kitchen', 100.0), ('1 g kitchen', 1000.0)]:
    for N in (1, 10, 40):
        stack['%s N=%d' % (name, N)] = {'uptake_%spct' % u: round(mass_err_pct(r, u, mass_g=N * V * 1.21), 1)
                                        for u in (0.5, 1.0, 8.0)}
out['stacked_coupons_rel_err_pct'] = stack
out['desorption_during_60s_weighing_pct_of_content'] = {
    str(D): round(4 / 1.0 * math.sqrt(D * 60 / math.pi) * 100, 2) for D in (1e-6, 1e-5)}

# ---- 4. Is mass gain volume-additive? Flexible 80A V2 TDS ----
rho_res, rho_w = 1.09, 1.0
dm = 0.08
out['flex80_additivity'] = dict(
    mass_gain_1d=dm, expected_dV_if_additive=dm * rho_res / rho_w, reported_dV_1d=0.03,
    isotropic_linear_strain_1d_pct=((1.03) ** (1 / 3) - 1) * 100,
    ratio_reported_to_additive_1d=0.03 / (dm * rho_res / rho_w),
    week=dict(mass=0.09, dV_additive=0.09 * rho_res, reported=0.07, eps_pct=((1.07) ** (1 / 3) - 1) * 100,
              ratio=0.07 / (0.09 * rho_res)))

# ---- 5. Bilayer curvature and what the camera must resolve ----
cur = []
for h in (0.4, 0.8, 1.6):
    for e in (0.002, 0.005, 0.01):
        k = 1.5 * e / h
        cur.append(dict(h_mm=h, eps_pct=e * 100, kappa_per_m=round(k * 1e3, 2), R_mm=round(1 / k, 1),
                        sagitta_40mm_chord_mm=round(k * 40 ** 2 / 8, 3),
                        cantilever_tip_mm=round(k * 40 ** 2 / 2, 3)))
out['curvature_table'] = cur
out['eps_from_curvature_rel_err_pct'] = {
    'dk=2pct,dh=%sum,h=0.8mm' % dh: round(math.sqrt(0.02 ** 2 + (dh / 1e3 / 0.8) ** 2) * 100, 2) for dh in (1, 10, 25)}
out['sagitta_0p75mm_rel_err_single_edge_1p5um_pct'] = 1.5 / 1e3 / 0.75 * 100


def sag(rho, E_pa, L_m, h_m):
    return 3 * rho * 9.81 * L_m ** 4 / (2 * E_pa * h_m ** 2)


sags = {}
for name, rho, E in [('Clear V5 dry E=2750 MPa', 1210, 2.75e9),
                     ('Clear V5 after 1 wk water E=0.653x', 1210, 0.6529 * 2.75e9),
                     ('Flexible 80A V2 secant E=5.8 MPa (project-record estimate)', 1090, 5.8e6)]:
    sags[name] = dict(h_mm=0.8, L_mm=40, sag_mm=round(sag(rho, E, 0.04, 0.8e-3) * 1e3, 4))
out['horizontal_cantilever_gravity_sag'] = sags


def bend_defl(F, span, E_mpa, b, h):
    I = b * h ** 3 / 12
    return F * span ** 3 / (48 * E_mpa * I)


bd = {}
for name, E in [('Clear V5 dry 2750 MPa', 2750.0), ('Clear V5 wet 0.653x', 0.6529 * 2750), ('Flexible 80A V2 5.8 MPa', 5.8)]:
    for F in (0.1, 1.0, 5.0):
        bd['%s, F=%s N' % (name, F)] = round(bend_defl(F, 30.0, E, 10.0, 1.0), 4)
out['three_point_bend_deflection_mm_span30_b10_h1'] = bd


def E_err(d, dh, ds, dF):
    return math.sqrt(d ** 2 + (3 * dh) ** 2 + (3 * ds) ** 2 + dF ** 2)


out['E_bend_rel_err_pct'] = {
    'delta1pct_h1pct_span0.3pct_F1pct': round(E_err(0.01, 0.01, 0.003, 0.01) * 100, 2),
    'delta1pct_h2.5pct(25um caliper)_span0.3pct_F1pct': round(E_err(0.01, 0.025, 0.003, 0.01) * 100, 2)}

# ---- 6. Saturated-salt humidity: temperature sensitivity from Greenspan Table 2 (values read by OCR) ----
salts = {'LiCl': (11.31, 11.30, 11.28), 'MgCl2': (33.07, 32.78, 32.44),
         'Mg(NO3)2': (54.38, 52.89, 51.40), 'NaCl': (75.47, 75.29, 75.09)}
out['salt_RH_20_25_30C'] = {k: dict(zip(('20C', '25C', '30C'), v), slope_pctRH_per_C=round((v[2] - v[0]) / 10, 3))
                            for k, v in salts.items()}
out['rh_error_to_strain_pct'] = {'eps_tot=%s%%' % e: {'dRH=%s' % d: round(e * d / 100, 4) for d in (1, 2, 5)}
                                 for e in (0.3, 1.0)}

json.dump(out, open('calc_out.json', 'w'), indent=1, default=float)
print(json.dumps(out, indent=1, default=float))
