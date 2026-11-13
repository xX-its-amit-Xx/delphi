#!/usr/bin/env python
"""
bm-diffusion-kinetics: time for a polymer layer of thickness h to reach swelling equilibrium.

Run:   python -P diffusion_kinetics.py
Needs: Python >= 3.10, numpy, scipy.  Tested: Python 3.14.2, numpy 2.5.3, scipy 1.18.1.
Writes results.json and equilibration_table.csv next to this file.

Sections
 1  Slab Fick solution (Crank): half-time, 90 %, 99 % constants; independent finite-difference check
 2  Published water diffusivities converted to m^2/s (inputs copied from the sources named in comments)
 3  Equilibration-time table: h = 0.2, 0.4, 0.6, 0.8, 1.6 mm x D, both faces exposed and one face exposed
 4  Formlabs 1 cm cube, 24 h: how far from equilibrium is a 24 h reading?
 5  Inversions: D from Formlabs data (Grey V5 bars, Flexible 80A V2 slabs, Elastic 50A IPA cube) and from
    Pino 2024 LCD-resin plates (saturation times)
 6  Temperature: Arrhenius factor from PA11 at 23 and 40 C
 7  Concentration-dependent D: sorption vs desorption half-times (finite volume, D = D0 exp(beta c))
 8  Bilayer curvature kinetics: laminate with a Fickian eigenstrain profile in the active layer
 9  Case I / Case II scaling: t ~ h^2/D versus t ~ h/v
"""
import json, math, os, csv
import numpy as np
from scipy.optimize import brentq
from scipy.integrate import solve_ivp

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = {}

# ---------------------------------------------------------------- 1. slab solution
def F_slab(x, nterms=400):
    """Fractional uptake M_t/M_inf of a plane sheet of thickness l, both faces held at c_inf, x = D t / l^2.
    Crank, Mathematics of Diffusion, eq. 4.14:  1 - sum 8/((2n+1)^2 pi^2) exp(-(2n+1)^2 pi^2 x)."""
    x = np.asarray(x, dtype=float)
    n = np.arange(nterms)[:, None]
    k = (2 * n + 1) ** 2 * np.pi ** 2
    with np.errstate(over="ignore", under="ignore"):
        s = (8.0 / k * np.exp(-k * np.atleast_1d(x)[None, :])).sum(axis=0)
    out = 1.0 - s
    # short-time series is better conditioned for tiny x
    small = np.atleast_1d(x) < 1e-4
    out = np.where(small, 4.0 * np.sqrt(np.atleast_1d(x) / np.pi), out)
    return out if x.ndim else float(out[0])


def x_at(frac):
    return brentq(lambda x: F_slab(x) - frac, 1e-9, 5.0, xtol=1e-14)


X50, X90, X95, X99 = x_at(0.5), x_at(0.9), x_at(0.95), x_at(0.99)
# single-mode time constant: F ~ 1 - (8/pi^2) exp(-pi^2 x)  ->  tau = l^2/(pi^2 D)
OUT["slab_constants"] = {
    "x50_Dt_over_l2": X50, "x90": X90, "x95": X95, "x99": X99,
    "tau_single_mode_over_l2D": 1 / math.pi ** 2,
    "short_time_law": "M_t/M_inf = 4 sqrt(D t /(pi l^2))  (valid to about 0.6)",
    "both_faces_t50_in_h2_over_D": X50, "one_face_t50_in_h2_over_D": 4 * X50,
    "one_face_t90_in_h2_over_D": 4 * X90, "one_face_t99_in_h2_over_D": 4 * X99,
}


def fd_slab_halftime(N=400):
    """Independent check: finite-volume diffusion in a half-slab (symmetry plane at 0, surface at 1), D = 1, l = 2."""
    dx = 1.0 / N
    def rhs(t, c):
        cc = np.concatenate(([c[0]], c, [1.0 * 2 - c[-1]]))  # symmetry at left; Dirichlet c=1 at right (ghost)
        return (cc[2:] - 2 * cc[1:-1] + cc[:-2]) / dx ** 2
    # mean uptake of half-slab == uptake of whole slab; l = 2 -> x = D t / 4
    sol = solve_ivp(rhs, [0, 0.5], np.zeros(N), method="BDF", rtol=1e-10, atol=1e-12, dense_output=True)
    f = lambda t: sol.sol(t).mean()
    t50 = brentq(lambda t: f(t) - 0.5, 1e-4, 0.5)
    return t50 / 4.0  # x = D t / l^2 with l = 2


OUT["slab_constants"]["x50_finite_volume_check"] = fd_slab_halftime()

# ---------------------------------------------------------------- 2. diffusivities
MM2H = 1e-6 / 3600.0   # 1 mm^2/h in m^2/s = 2.778e-10
CM2S = 1e-4            # 1 cm^2/s in m^2/s
YR = 365.25 * 86400.0

SOURCES = [
    # name, D (m^2/s) or (lo, hi), class, source, note
    ("Nylon filament, 97% RH, 23C (Aniskevich 2023 Table 3, 0.001 mm2/h)", 0.001 * MM2H, "polyamide", "10.3390/polym15122600", "cylinders d=2.8 mm; the same filament SHRANK 2.43 % in humid air (anomalous)"),
    ("PEKK/Antero filament (0.00245 mm2/h)", 0.00245 * MM2H, "engineering thermoplastic", "10.3390/polym15122600", ""),
    ("PC filament (0.00472 mm2/h)", 0.00472 * MM2H, "engineering thermoplastic", "10.3390/polym15122600", ""),
    ("PET-G filament (0.00335 mm2/h)", 0.00335 * MM2H, "engineering thermoplastic", "10.3390/polym15122600", "D depends on humidity level"),
    ("PLA filaments (0.00782 to 0.0151 mm2/h)", (0.00782 * MM2H, 0.0151 * MM2H), "PLA", "10.3390/polym15122600", ""),
    ("PA11 (neat, hot-pressed), water, 23 C", 4.95e-13, "polyamide (SLS Nylon 11 analogue)", "10.3390/polym10070717", "Table 3; M_inf 1.43 %"),
    ("PA11 (neat), water, 40 C", 22.00e-13, "polyamide", "10.3390/polym10070717", "Table 3; M_inf 1.58 %"),
    ("TPU 60A-98A, FDM, 0.9 % NaCl (1.40e-13 to 3.40e-12)", (1.40e-13, 3.40e-12), "TPU (Fuse TPU 90A analogue)", "10.3390/polym18111392", "initial-stage Fickian fit"),
    ("Dimethacrylate dental resins, water (1.52e-8 to 11.01e-8 cm2/s)", (1.52e-8 * CM2S, 11.01e-8 * CM2S), "photocured methacrylate (SLA resin analogue)", "10.1016/j.dental.2011.06.007", "thin disc; thickness not in abstract"),
    ("Polyampholyte hydrogel, 45 wt% water, 1.1-1.3 mm (8.8e-11 to 1.7e-10)", (8.8e-11, 1.7e-10), "chemically crosslinked hydrogel", "10.1073/pnas.2207422119", "D_sw from tau = h^2/(pi^2 D)"),
    ("PDMS (Sylgard 184), water (6e-10 to 8e-10; 1e-9 older)", (6e-10, 1e-9), "silicone elastomer", "arXiv:2401.05139 (cites ref. 33) and Randall&Doyle 2005", "secondary citation"),
    ("Porous plant tissue / pine-cone scale, molecular pores", 1e-9, "porous / wicking", "10.1098/rsif.2009.0184", "scaling estimate D ~ 1e-9"),
]

# ---------------------------------------------------------------- 5 (needed early for table) inversions
INV = {}

def solve_x_from_ratio(R, k=7.0):
    """x such that F(k x)/F(x) = R (R between 1 and sqrt(k))."""
    g = lambda x: F_slab(k * x) / F_slab(x) - R
    return brentq(g, 1e-7, 50.0, xtol=1e-14)

# 5a  Grey V5 tensile bars in DI water: mass +1.38 % (1 d), +3.23 % (1 wk)  [Formlabs TDS, read by word position]
r_v5 = 3.23 / 1.38
x_v5 = solve_x_from_ratio(r_v5)
INV["grey_v5"] = {"ratio_1wk_over_1d": r_v5, "x_1d": x_v5}
for l_mm in (2.0, 3.2, 4.0):
    D = x_v5 * (l_mm * 1e-3) ** 2 / 86400.0
    INV["grey_v5"][f"D_m2s_if_thickness_{l_mm}mm"] = D
INV["grey_v5"]["Minf_pct"] = 3.23 / F_slab(7 * x_v5)
INV["grey_v5"]["F_1d"] = float(F_slab(x_v5))
INV["grey_v5"]["F_1wk"] = float(F_slab(7 * x_v5))
INV["grey_v5"]["note"] = ("Two-point Fickian inversion; ratio 2.34 is below sqrt(7)=2.65 so the curve is bending toward a plateau. "
                           "Specimen thickness is NOT stated in the Formlabs TDS (ASTM D638 Type IV bars); 3.2 mm is unverified background.")

# 5b  Flexible 80A V2 slabs: +8 % (1 d), +9 % (1 wk); percentages are integers, so bracket the rounding
def flex_inv(m1, m7):
    R = m7 / m1
    if R <= 1.0:
        return None
    return solve_x_from_ratio(R)
x_f_mid = flex_inv(8.0, 9.0)
x_f_hi = flex_inv(7.5, 9.5)   # ratio 1.267 -> smallest x consistent with rounding (lower bound on D)
INV["flex80a_v2"] = {"ratio": 9 / 8, "x_1d_mid": x_f_mid, "x_1d_lower_bound_from_rounding": x_f_hi}
for l_mm in (1.0, 2.0, 3.0):
    INV["flex80a_v2"][f"D_mid_m2s_if_thickness_{l_mm}mm"] = x_f_mid * (l_mm * 1e-3) ** 2 / 86400.0
    INV["flex80a_v2"][f"D_lower_m2s_if_thickness_{l_mm}mm"] = x_f_hi * (l_mm * 1e-3) ** 2 / 86400.0
INV["flex80a_v2"]["note"] = ("ASTM D471 slab thickness is not stated in the TDS; 2 mm is unverified background. "
                              "Mass gain 8 -> 9 % between 1 d and 1 wk, so the 1 d point is already ~89 % of the plateau if Fickian. "
                              "Leaching of unreacted resin lowers net mass and would bias D upward.")

# 5c  Elastic 50A V2 in isopropanol, 1 cm cube, 24 h: 39.2 %; acetone 43.4 %, TPM 45.6 %  (Formlabs solvent page)
def F_cube(x):
    f1 = F_slab(x)
    return 1 - (1 - f1) ** 3

for plateau in (43.4, 45.6, 50.0):
    frac = 39.2 / plateau
    xc = brentq(lambda x: F_cube(x) - frac, 1e-9, 5.0)
    INV.setdefault("elastic50a_ipa", {})[f"D_m2s_if_plateau_{plateau}pct"] = xc * (10e-3) ** 2 / 86400.0
INV["elastic50a_ipa"]["note"] = ("Cube 10 mm, all six faces; plateau not measured, so the 24 h point is bracketed by the acetone and TPM 24 h values "
                                  "(also 24 h) and 50 %. D is a lower bound-style estimate because uptake at 24 h may itself be short of plateau.")

# 5d  Pino 2024 LCD resins, 1 mm plates (60x60x1 mm), saturation times; both faces
INV["pino_lcd"] = {}
for name, days in (("R3_Conjure_seawater_2.5d", 2.5), ("R2_seawater_4d", 4.0), ("R1_seawater_8d", 8.0)):
    t = days * 86400
    INV["pino_lcd"][name] = {"D_if_95pct_at_t": X95 * (1e-3) ** 2 / t, "D_if_99pct_at_t": X99 * (1e-3) ** 2 / t}
INV["pino_lcd"]["note"] = ("The paper says the mass 'stabilized' at these times (R3: 12.37 % in 2.5 d then 13.49 %; R2 within 4 d; R1 not before >8 d). "
                           "Judged by eye from a curve, so D is bracketed by 95 % and 99 % of plateau. Plate thickness 1 mm from the paper's Table 4.")

# 5e  hydrogel PEGDA-700/PEGMA 2 mm dry slabs, tau from exponential fit (VanZanten 2024, arXiv:2406.15224 Fig 2c)
INV["pegda_gels"] = {}
for name, tau_min in (("PEGDA700_5:95_to_40:60_tau<=61min", 61.0), ("PEGDA700_1:99_tau~120min", 120.0), ("PEGDA10k_1:99_tau~190min", 190.0)):
    tau = tau_min * 60
    INV["pegda_gels"][name] = {"D_m2s_lowerbound_l2mm": (2e-3) ** 2 / (math.pi ** 2 * tau),
                               "D_m2s_if_swollen_thickness_3mm": (3e-3) ** 2 / (math.pi ** 2 * tau)}
INV["pegda_gels"]["note"] = "D = l^2/(pi^2 tau), single-mode formula used by Hayward/Suo-type poroelastic papers; l = dry thickness 2 mm (lower bound; swollen gel is thicker)."


# 5f  Zheng 2022 SLS PA12 cylinders 8 mm dia x 8 mm: mass "increases sharply in the first 36 h" then saturates at 5.47 %
from scipy.special import jn_zeros
_a = jn_zeros(0, 200)
def F_cyl_radial(x):   # infinite cylinder, x = D t / R^2
    return 1 - (4.0 / _a ** 2 * np.exp(-_a ** 2 * x)).sum()
def F_finite_cyl(D, t, R=4e-3, L=8e-3):
    return 1 - (1 - F_cyl_radial(D * t / R ** 2)) * (1 - F_slab(D * t / L ** 2))
INV["sls_pa12_zheng"] = {}
for frac, hrs in ((0.8, 36), (0.9, 36), (0.9, 72), (0.99, 72)):
    D = brentq(lambda d: F_finite_cyl(d, hrs * 3600) - frac, 1e-14, 1e-8)
    INV["sls_pa12_zheng"][f"D_if_{int(frac*100)}pct_at_{hrs}h"] = D
INV["sls_pa12_zheng"]["note"] = ("The paper gives only 'increases sharply in the first 36 h ... reaches saturation 5.47 %'; the curve was not readable as numbers, "
                                  "so the fraction reached at 36 h or 72 h is assumed and D is a bracket, apparent (open pores fill, so not polymer-matrix D). Low confidence.")

# 5g  Cross-check: use the Grey V5 bar fit (D, M_inf) to predict the Formlabs 1 cm cube 24 h water gain (Grey Resin V5: 0.8 % in the solvent table)
_Dv = INV["grey_v5"]["D_m2s_if_thickness_3.2mm"]
_x = _Dv * 86400.0 / (10e-3) ** 2
INV["grey_v5"]["predicted_cube_10mm_24h_pct"] = INV["grey_v5"]["Minf_pct"] * float(F_cube(_x))
INV["grey_v5"]["measured_cube_24h_pct_solvent_page"] = 0.8
INV["grey_v5"]["cube_note"] = "Prediction uses D and M_inf fitted to the 3.2 mm bars (assumed thickness); measured cube value is Formlabs 'Grey Resin V5' water column = 0.8 (and Clear V5 = 0.9)."

# 5h  Can diffusion kinetics reconcile Flexible 80A V2 slab (+8 % at 1 d) with the 'Flexible 80A Resin' 1 cm cube value (0.7 % at 24 h)?
_Dl = INV["flex80a_v2"]["D_lower_m2s_if_thickness_2.0mm"]
_fc = float(F_cube(_Dl * 86400.0 / (10e-3) ** 2))
INV["flex80a_v2"]["cube_24h_fraction_of_plateau_at_lower_D"] = _fc
INV["flex80a_v2"]["predicted_cube_24h_pct_for_plateau_9pct"] = 9.0 * _fc
INV["flex80a_v2"]["measured_cube_24h_pct_solvent_page"] = 0.7

OUT["inversions"] = INV

# ---------------------------------------------------------------- 3. equilibration table
D_GRID = [1.4e-13, 3e-13, 1e-12, 3e-12, 1e-11, 3e-11, 1e-10, 1e-9]
H_MM = [0.2, 0.4, 0.6, 0.8, 1.6]

def fmt_t(s):
    if s < 120: return f"{s:.0f} s"
    if s < 7200: return f"{s/60:.0f} min"
    if s < 2 * 86400: return f"{s/3600:.1f} h"
    if s < 60 * 86400: return f"{s/86400:.1f} d"
    return f"{s/86400/7:.0f} wk ({s/YR:.2f} yr)" if s < 2 * YR else f"{s/YR:.1f} yr"

def klass(s):
    if s <= 24 * 3600: return "hours"
    if s <= 14 * 86400: return "days"
    return "weeks or longer"

rows = []
for D in D_GRID:
    for h in H_MM:
        for faces, l_factor in (("both faces", 1.0), ("one face (other bonded/sealed)", 2.0)):
            l = h * 1e-3 * l_factor
            t50, t90, t99 = (X50 * l * l / D, X90 * l * l / D, X99 * l * l / D)
            rows.append({"D_m2s": D, "h_mm": h, "exposure": faces, "t50_s": t50, "t90_s": t90, "t99_s": t99,
                         "t50": fmt_t(t50), "t90": fmt_t(t90), "t99": fmt_t(t99), "class_t90": klass(t90)})
OUT["equilibration_table"] = rows
with open(os.path.join(HERE, "equilibration_table.csv"), "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

# per-material table at one-face exposure, t90 (h mm)
MAT_ROWS = []
def mat_entry(name, D, source):
    Ds = D if isinstance(D, tuple) else (D,)
    r = {"material": name, "source": source, "D_lo": min(Ds), "D_hi": max(Ds)}
    for h in (0.2, 0.4, 0.8, 1.6):
        l = 2 * h * 1e-3
        r[f"one_face_t90_h{h}"] = f"{fmt_t(X90*l*l/max(Ds))} to {fmt_t(X90*l*l/min(Ds))}" if len(Ds) > 1 else fmt_t(X90 * l * l / Ds[0])
        l2 = h * 1e-3
        r[f"both_faces_t90_h{h}"] = f"{fmt_t(X90*l2*l2/max(Ds))} to {fmt_t(X90*l2*l2/min(Ds))}" if len(Ds) > 1 else fmt_t(X90 * l2 * l2 / Ds[0])
    return r
for name, D, cls, src, note in SOURCES:
    MAT_ROWS.append(mat_entry(name, D, src))
# derived entries
MAT_ROWS.append(mat_entry("Grey V5 (Formlabs bars, derived, 3.2 mm assumed)", INV["grey_v5"]["D_m2s_if_thickness_3.2mm"], "own inversion of Formlabs TDS 1 d / 1 wk mass"))
MAT_ROWS.append(mat_entry("Flexible 80A V2 (Formlabs slabs, derived, 2 mm assumed)", INV["flex80a_v2"]["D_mid_m2s_if_thickness_2.0mm"], "own inversion of Formlabs TDS 1 d / 1 wk mass"))
MAT_ROWS.append(mat_entry("LCD acrylate resins, 1 mm plates, seawater (derived)", (INV["pino_lcd"]["R1_seawater_8d"]["D_if_99pct_at_t"], INV["pino_lcd"]["R3_Conjure_seawater_2.5d"]["D_if_95pct_at_t"]), "own inversion of 10.3390/ma17235953 saturation times"))
MAT_ROWS.append(mat_entry("PEGDA-700 / PEGMA gels, 2 mm (derived)", (INV["pegda_gels"]["PEGDA10k_1:99_tau~190min"]["D_m2s_lowerbound_l2mm"], INV["pegda_gels"]["PEGDA700_5:95_to_40:60_tau<=61min"]["D_m2s_if_swollen_thickness_3mm"]), "own inversion of arXiv:2406.15224 tau"))
MAT_ROWS.append(mat_entry("Elastic 50A V2 + isopropanol (solvent, not water; derived)", (INV["elastic50a_ipa"]["D_m2s_if_plateau_50.0pct"], INV["elastic50a_ipa"]["D_m2s_if_plateau_43.4pct"]), "own inversion of Formlabs solvent page"))
OUT["material_table"] = MAT_ROWS

# ---------------------------------------------------------------- 4. cube 24 h
CUBE = []
for D in D_GRID:
    for edge_mm in (10.0, 3.0):
        x = D * 86400.0 / (edge_mm * 1e-3) ** 2
        CUBE.append({"D_m2s": D, "edge_mm": edge_mm, "frac_of_equilibrium_at_24h_cube": float(F_cube(x))})
OUT["cube_24h"] = CUBE

# ---------------------------------------------------------------- 6. temperature
R_GAS = 8.314
Ea = R_GAS * math.log(22.00 / 4.95) / (1 / 296.15 - 1 / 313.15)
OUT["temperature_PA11"] = {"Ea_J_per_mol": Ea, "Ea_kJ_per_mol": Ea / 1e3, "factor_40C_over_23C": 22.00 / 4.95,
                           "predicted_D_50C": 4.95e-13 * math.exp(-Ea / R_GAS * (1 / 323.15 - 1 / 296.15)),
                           "predicted_speedup_50C_over_23C": math.exp(-Ea / R_GAS * (1 / 323.15 - 1 / 296.15))}

# ---------------------------------------------------------------- 7. concentration-dependent D
def sorp_desorp(beta, N=300):
    """Half slab, x in [0,1] (0 = centre, 1 = surface), D(c) = D0 exp(beta c), c in [0,1]. Time unit: l^2/(4 D0)... see below.
    Returns t50 in units of (L^2 / D0) where L = full thickness = 2 (half-slab thickness 1)."""
    dx = 1.0 / N
    def make(mode):
        def rhs(t, c):
            cc = np.empty(N + 2)
            cc[1:-1] = c
            cc[0] = c[0]                      # symmetry
            cc[-1] = (1.0 if mode == "sorp" else 0.0) * 2 - c[-1]   # Dirichlet at surface via ghost cell
            D = np.exp(beta * np.clip(cc, 0, 1))
            Df = 0.5 * (D[1:] + D[:-1])        # D at faces
            flux = Df * (cc[1:] - cc[:-1]) / dx
            return (flux[1:] - flux[:-1]) / dx
        return rhs
    out = {}
    for mode, c0, target in (("sorp", 0.0, 0.5), ("desorp", 1.0, 0.5)):
        rhs = make(mode)
        sol = solve_ivp(rhs, [0, 20.0], np.full(N, c0), method="BDF", rtol=1e-9, atol=1e-11, dense_output=True)
        if mode == "sorp":
            f = lambda t: sol.sol(t).mean()
            t50 = brentq(lambda t: f(t) - 0.5, 1e-7, 20.0)
        else:
            f = lambda t: 1 - sol.sol(t).mean()    # fraction desorbed
            t50 = brentq(lambda t: f(t) - 0.5, 1e-7, 20.0)
        out[mode] = t50
    return out

CD = {}
for ratio in (1.0, 21.4, 100.0):
    beta = math.log(ratio)
    s = sorp_desorp(beta)
    # constant-D reference: half-slab thickness 1  ->  L = 2, t50 = X50 L^2 / D = 4 X50 / D  (D in units of D0)
    Dmean = (ratio - 1) / beta if ratio != 1 else 1.0   # integral of exp(beta c) dc over 0..1
    CD[f"D_ratio_{ratio}"] = {"beta": beta, "t50_sorption_units_1_over_D0": s["sorp"], "t50_desorption_units_1_over_D0": s["desorp"],
                              "desorption_over_sorption": s["desorp"] / s["sorp"],
                              "t50_const_D0": 4 * X50, "t50_const_Dmean": 4 * X50 / Dmean, "t50_const_Dhigh": 4 * X50 / ratio,
                              "sorption_t50_vs_const_D0": s["sorp"] / (4 * X50), "desorption_t50_vs_const_D0": s["desorp"] / (4 * X50)}
OUT["concentration_dependent_D"] = CD
OUT["PA6_D_ratio_Sambale"] = {"D_c0": 2.58e-9, "D_c89000ppm": 5.51e-8, "ratio": 5.51e-8 / 2.58e-9,
                               "note": "units in the source table are printed as '[m/s2]' (garbled); only the unit-free ratio is used"}

# ---------------------------------------------------------------- 8. bilayer curvature kinetics
def timoshenko_f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))

def curvature(E1, h1, E2, h2, eps_profile, ngrid=1500):
    """Active layer 1 on top of passive layer 2; z from bottom of layer 2. eps_profile(s) gives eigenstrain at distance s from the
    sealed (bonded) face, s in [0, h1]. Returns curvature (1/m) of the free laminate (beam, no width effect)."""
    h = h1 + h2
    s = np.linspace(0, h1, ngrid)
    z = h2 + s
    e = eps_profile(s)
    A = E2 * h2 + E1 * h1
    B = E2 * h2 ** 2 / 2 + E1 * (h ** 2 - h2 ** 2) / 2
    C = E2 * h2 ** 3 / 3 + E1 * (h ** 3 - h2 ** 3) / 3
    Pn = E1 * np.trapezoid(e, z)
    Pm = E1 * np.trapezoid(e * z, z)
    eps0, kap = np.linalg.solve([[A, B], [B, C]], [Pn, Pm])
    return kap

def prof_factory(D, h1, t, d_eps=1.0, nterms=300):
    k = np.arange(nterms)
    a = (2 * k + 1)
    def prof(s):
        s = np.asarray(s)
        terms = 4 * (-1.0) ** k[:, None] / (a[:, None] * np.pi) * np.exp(-D * (a[:, None] * np.pi) ** 2 * t / (4 * h1 ** 2)) * np.cos(a[:, None] * np.pi * s[None, :] / (2 * h1))
        return d_eps * (1 - terms.sum(axis=0))
    return prof

BL = {}
# saturation check against Timoshenko coefficient, including the optimum m^2 n = 1
checks = []
for (n, m) in ((1.0, 1.0), (0.1, 1.0), (0.1, 10 ** 0.5), (0.01, 10.0), (10.0, 10 ** -0.5), (3.0, 0.5)):
    E2 = 1.0; E1 = n * E2; h2 = 1.0e-3; h1 = m * h2
    kap = curvature(E1, h1, E2, h2, lambda s: np.ones_like(s))
    f_num = kap * (h1 + h2) / 1.0
    checks.append({"m": m, "n": n, "f_laminate_numeric": f_num, "f_formula": timoshenko_f(m, n), "m2n": m * m * n})
BL["saturation_check"] = checks

def bilayer_times(n, m, h1=0.4e-3, D=1e-12):
    E2 = 1.0; E1 = n * E2; h2 = h1 / m
    t_tau = h1 ** 2 / D
    kinf = curvature(E1, h1, E2, h2, lambda s: np.ones_like(s))
    ts = np.logspace(-4, 1.5, 220) * t_tau
    ks = np.array([curvature(E1, h1, E2, h2, prof_factory(D, h1, t)) / kinf for t in ts])
    ups = F_slab(D * ts / (2 * h1) ** 2)
    def cross(arr, frac):
        i = np.argmax(arr >= frac)
        return float(np.interp(frac, [arr[i - 1], arr[i]], [ts[i - 1], ts[i]]) / t_tau)
    return {"n": n, "m": m, "t50_curv_in_h1sq_over_D": cross(ks, .5), "t90_curv_in_h1sq_over_D": cross(ks, .9), "t99_curv_in_h1sq_over_D": cross(ks, .99),
            "t50_uptake_in_h1sq_over_D": cross(ups, .5), "t90_uptake_in_h1sq_over_D": cross(ups, .9), "t99_uptake_in_h1sq_over_D": cross(ups, .99)}

BL["kinetics"] = [bilayer_times(1.0, 1.0), bilayer_times(0.1, 10 ** 0.5), bilayer_times(0.01, 10.0), bilayer_times(1.0, 0.5), bilayer_times(1.0, 2.0)]
OUT["bilayer"] = BL

# ---------------------------------------------------------------- 9. Case I vs Case II scaling
CII = []
for h in H_MM:
    for D in (1e-12, 1e-11):
        CII.append({"h_mm": h, "D_m2s": D, "fick_time_h2_over_D_s": (h * 1e-3) ** 2 / D})
OUT["fick_h2_over_D_s"] = CII
OUT["scaling_note"] = ("Fick: t ~ h^2/D (doubling h quadruples t). Case II: front at constant speed v, uptake ~ t, time ~ h/v "
                       "(doubling h doubles t). Crossover length h* = D/v. Measured v for water in Formlabs resins: not found.")

# ---------------------------------------------------------------- print
def pr(*a): print(*a)
pr("== 1 slab constants (D t / l^2)")
pr(f"  half-time {X50:.5f} (finite-volume check {OUT['slab_constants']['x50_finite_volume_check']:.5f})  90% {X90:.4f}  95% {X95:.4f}  99% {X99:.4f}")
pr(f"  one-face (l = 2h):  t50 = {4*X50:.4f} h^2/D, t90 = {4*X90:.3f} h^2/D, t99 = {4*X99:.3f} h^2/D")
pr("== 2/3 per-material t90 (one face exposed; both faces)")
for r in MAT_ROWS:
    pr(f"  {r['material'][:70]:70s} D={r['D_lo']:.2e}-{r['D_hi']:.2e} | one-face t90: " + " | ".join(f"h{h}: {r[f'one_face_t90_h{h}']}" for h in (0.2, 0.4, 0.8, 1.6)))
pr("== equilibration table, one face exposed, t90 (and t50)")
for D in D_GRID:
    line = [f"D={D:.1e}"]
    for h in H_MM:
        r = [x for x in rows if x["D_m2s"] == D and x["h_mm"] == h and x["exposure"].startswith("one")][0]
        line.append(f"{h}mm: {r['t90']} (t50 {r['t50']})")
    pr("  " + " | ".join(line))
pr("== 4 fraction of equilibrium reached in 24 h by a cube")
for c in CUBE:
    if c["D_m2s"] in (1e-13 * 1.4, 1e-12, 1e-11, 1e-10) or True:
        pass
for D in D_GRID[:7]:
    a = [c for c in CUBE if c["D_m2s"] == D]
    pr(f"  D={D:.1e}: 10 mm cube {a[0]['frac_of_equilibrium_at_24h_cube']*100:.1f} %, 3 mm cube {a[1]['frac_of_equilibrium_at_24h_cube']*100:.1f} %")
pr("== 5 inversions")
pr(json.dumps(INV, indent=1))
pr("== 6 temperature (PA11)")
pr(json.dumps(OUT["temperature_PA11"], indent=1))
pr("== 7 concentration-dependent D")
pr(json.dumps(CD, indent=1))
pr("== 8 bilayer")
for c in checks: pr("  sat check", c)
for k in BL["kinetics"]: pr("  kin", {a: (round(b, 4) if isinstance(b, float) else b) for a, b in k.items()})

with open(os.path.join(HERE, "results.json"), "w") as fh:
    json.dump(OUT, fh, indent=1)
pr("wrote results.json and equilibration_table.csv")
