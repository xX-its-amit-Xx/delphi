"""Arithmetic behind the bm-lay-analogies explanations. Run: python calc.py  -> calc_out.json (same folder).
Every number quoted in the explanation bank that is 'own calculation' comes from here.
Inputs taken from fetched sources are marked SRC. No third-party packages needed (numpy optional, not used)."""
import json, math, random, os

out = {}
HERE = os.path.dirname(os.path.abspath(__file__))

# --- Timoshenko coefficient exactly as in the Lean file (HygromorphCeilingCheck.lean), times h
def f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))

# --- 1. Equivalence with the 1863 Villarceau form quoted on Wikipedia (SRC wiki_bimetallic.html):
#   kappa = 3/(2a) * d_eps/h,  a = 1 + (E1 h1^2 - E2 h2^2)^2 / (4 E1 h1 E2 h2 h^2)
def a_wiki(h1, h2, E1, E2):
    h = h1 + h2
    return 1 + (E1 * h1 ** 2 - E2 * h2 ** 2) ** 2 / (4 * E1 * h1 * E2 * h2 * h ** 2)

random.seed(1)
maxdiff = 0.0
for _ in range(200000):
    h1 = 10 ** random.uniform(-2, 2); h2 = 10 ** random.uniform(-2, 2)
    E1 = 10 ** random.uniform(-3, 3); E2 = 10 ** random.uniform(-3, 3)
    m = h1 / h2; n = E1 / E2
    d = abs(f(m, n) - 1.5 / a_wiki(h1, h2, E1, E2))
    maxdiff = max(maxdiff, d)
out["villarceau_vs_project_f_max_abs_diff_200k_random"] = maxdiff

# --- 2. Simulation (sampling) vs proof: 2 million log-uniform samples of f
mx = 0.0; arg = None
for _ in range(2_000_000):
    m = 10 ** random.uniform(-3, 3); n = 10 ** random.uniform(-3, 3)
    v = f(m, n)
    if v > mx:
        mx, arg = v, (m, n)
out["sampling_max_f_2M_samples"] = mx
out["sampling_argmax_m_n"] = arg
out["sampling_argmax_m2n"] = arg[0] ** 2 * arg[1]
out["sampling_gap_to_1.5"] = 1.5 - mx

# Euler's polynomial: 40 passing tests, then failure
vals = []
def isprime(k):
    if k < 2: return False
    for d in range(2, int(k ** 0.5) + 1):
        if k % d == 0: return False
    return True
first_fail = None
for k in range(0, 100):
    if not isprime(k * k + k + 41):
        first_fail = k; break
out["euler_polynomial_first_failure_n"] = first_fail
out["euler_polynomial_value_at_failure"] = first_fail ** 2 + first_fail + 41
out["euler_polynomial_passes_before_failure"] = first_fail

# --- 3. Stiffer partner is not better: f(m=1, n) and the best m for each n
rows = []
for n in [0.001, 0.01, 0.1, 0.3, 1, 3.5, 10, 100, 1000, 1e4]:
    mopt = n ** -0.5
    rows.append({"n": n, "f_equal_thickness": round(f(1, n), 4), "m_opt": round(mopt, 4), "f_at_m_opt": round(f(mopt, n), 6)})
out["stiffness_table"] = rows
# f(1, 0.3) vs f(1, 3.5)  (Reyssat: <10 % change)
out["f_m1_n0.3"] = f(1, 0.3); out["f_m1_n3.5"] = f(1, 3.5)
out["f_m1_n0.3_to_3.5_change_pct"] = 100 * abs(f(1, 3.5) - f(1, 0.3)) / f(1, 0.3)

out["f_m1_n30"] = f(1, 30); out["loss_m1_n30_pct_vs_1.5"] = 100 * (1 - f(1, 30) / 1.5)
out["f_m1_n10_fraction_of_ceiling"] = f(1, 10) / 1.5

# --- 4. Ceiling => ruling out before printing.  kappa_max = 1.5 d_eps / h ;  R_min = h / (1.5 d_eps)
tab = []
for h in [0.4, 0.8, 1.6]:
    for de in [0.002, 0.005, 0.01, 0.02]:
        tab.append({"h_mm": h, "d_eps": de, "R_min_mm": round(h / (1.5 * de), 1)})
out["Rmin_table"] = tab
# needed differential strain for target radius
need = []
for R in [25, 50, 100]:
    for h in [0.4, 0.8, 1.6]:
        need.append({"R_target_mm": R, "h_mm": h, "d_eps_needed_pct": round(100 * h / (1.5 * R), 3)})
out["strain_needed_table"] = need
# Tip deflection of a cantilever strip of length L curved to radius R (small-curvature: L^2/(2R)); exact arc: R(1-cos(L/R))
def tip(L, R): return R * (1 - math.cos(L / R)) if L / R < math.pi else None
L = 40.0
out["example_strip_L_mm"] = L

# --- 5. Water uptake 0.7 %
drop_mL = 0.05           # SRC Wikipedia 'Drop (unit)': 'approximately 0.05 mL' (organic-synthesis usage)
rho_w = 1.0              # g/mL, unverified background
cube_mass_g = 1.21 * 1.0 # SRC Clear V5 density 1.21 g/cm3 (project record, Formlabs TDS) x 1 cm3
out["cube_mass_g_ClearV5_density"] = cube_mass_g
for pct in [0.7, 0.9, 8.0]:
    g_per_g = pct / 100
    out[f"uptake_{pct}pct_mg_per_1g"] = g_per_g * 1000
    out[f"uptake_{pct}pct_drops_per_1g"] = g_per_g / rho_w / drop_mL
    out[f"uptake_{pct}pct_mg_in_1cm_cube"] = g_per_g * cube_mass_g * 1000
    out[f"uptake_{pct}pct_drops_in_1cm_cube"] = g_per_g * cube_mass_g / rho_w / drop_mL
# 70 kg person for scale (assumed body mass)
out["0.7pct_of_70kg_kg"] = 0.007 * 70
# Linear strain from mass gain.
#  (i) ideal volume mixing, isotropic: eps_lin = (rho_resin/rho_water) * w / 3  (w = mass fraction gained)
rho_res = 1.21
out["ideal_mixing_lin_strain_per_pct_mass"] = rho_res / rho_w / 3          # in percent strain per percent mass
out["ideal_mixing_lin_strain_for_0.7pct_pct"] = 0.7 * rho_res / 3
#  (ii) measured pairs from the project record (bm-resin-water-uptake-data): Flexible 80A V2 D471 table
#   SRC f80v2_tds.pdf p6: Deionized Water 1 day +8 % mass, +3 % volume ; 1 week +9 % mass, +7 % volume
for lab, mass, vol in [("1day", 8, 3), ("1week", 9, 7)]:
    lin = ((1 + vol / 100) ** (1 / 3) - 1) * 100
    out[f"F80V2_{lab}_linear_strain_pct"] = lin
    out[f"F80V2_{lab}_strain_per_pct_mass"] = lin / mass
lo = 0.7 * out["F80V2_1day_strain_per_pct_mass"]
hi = out["ideal_mixing_lin_strain_for_0.7pct_pct"]
out["strain_for_0.7pct_mass_low_pct"] = lo
out["strain_for_0.7pct_mass_high_pct"] = hi
# what that does in a bilayer with a perfectly passive partner, h = 0.8 mm, L = 40 mm, at the ceiling
h = 0.8
for lab, de in [("low", lo), ("high", hi)]:
    kappa = 1.5 * (de / 100) / h           # 1/mm
    R = 1 / kappa
    out[f"bilayer_{lab}_R_mm"] = R
    out[f"bilayer_{lab}_tip_mm_L40"] = tip(L, R)
    out[f"strip_elongation_{lab}_mm_L40"] = L * de / 100
    out[f"amplification_{lab}"] = tip(L, R) / (L * de / 100)
out["amplification_formula_0.75L_over_h"] = 0.75 * L / h

# --- 6. Thin vs thick.  Crank slab, ONE face exposed, thickness h:  Mt/Minf = 1 - sum 8/((2k+1)^2 pi^2) exp(-(2k+1)^2 pi^2 D t /(4 h^2))
def uptake(tau):  # tau = D t / h^2
    s = 0.0
    for k in range(0, 200):
        j = 2 * k + 1
        s += 8 / (j * j * math.pi ** 2) * math.exp(-j * j * math.pi ** 2 * tau / 4)
    return 1 - s
def tau_for(frac):
    lo_, hi_ = 1e-6, 10.0
    for _ in range(200):
        mid = (lo_ + hi_) / 2
        if uptake(mid) < frac: lo_ = mid
        else: hi_ = mid
    return (lo_ + hi_) / 2
out["crank_tau_50"] = tau_for(0.5); out["crank_tau_90"] = tau_for(0.9); out["crank_tau_99"] = tau_for(0.99)
t90 = out["crank_tau_90"]
times = []
for D, lab in [(1e-12, "dense stock resin ~1e-12"), (1e-11, "soft rubbery/PEG-type ~1e-11"), (1e-9, "porous plant-like ~1e-9")]:
    for hmm in [0.2, 0.4, 0.8, 1.6]:
        hm = hmm * 1e-3
        t = t90 * hm * hm / D
        times.append({"D_m2_s": D, "label": lab, "h_mm": hmm, "t90_s": t, "t90_hours": t / 3600, "t90_days": t / 86400})
out["t90_table"] = times
out["ratio_thick_to_thin_for_double_thickness"] = 4
# Reyssat measured exponents
out["reyssat_drying_tau_min_h1mm"] = 96 * 1 ** 1.5
out["reyssat_drying_ratio_for_double_h"] = 2 ** 1.5
out["reyssat_wetting_ratio_for_double_h"] = 2 ** 1.3
out["reyssat_drying_tau_min_h2mm"] = 96 * 2 ** 1.5
out["reyssat_wetting_tau_min_h1mm"] = 29 * 1 ** 1.3
out["reyssat_wetting_tau_min_h2mm"] = 29 * 2 ** 1.3
# force vs thickness trade (project record, own derivation F ~ h^2, kappa ~ 1/h)
out["force_ratio_double_thickness"] = 4
out["curvature_ratio_double_thickness"] = 0.5

# --- 7. Bimetal (heat) vs hygromorph (water) speed.  SRC wiki_thermal_diffusivity.html: Steel AISI 1010 18.8 mm2/s ; Steel 1% C 11.72 mm2/s ; Nylon 0.09 mm2/s
for lab, alpha_mm2s in [("steel_1010", 18.8), ("steel_1pctC", 11.72), ("nylon", 0.09)]:
    for hmm in [0.2, 1.0]:
        out[f"heat_t90_s_{lab}_h{hmm}mm"] = t90 * hmm ** 2 / alpha_mm2s
D_water_mm2_s = 1e-12 * 1e6      # 1e-12 m2/s = 1e-6 mm2/s
out["water_D_1e-12_in_mm2_per_s"] = D_water_mm2_s
out["ratio_steel1010_heat_vs_water_D1e-12"] = 18.8 / D_water_mm2_s
out["ratio_nylon_heat_vs_water_D1e-12"] = 0.09 / D_water_mm2_s

json.dump(out, open(os.path.join(HERE, "calc_out.json"), "w"), indent=1, default=str)
for k in ["villarceau_vs_project_f_max_abs_diff_200k_random", "sampling_max_f_2M_samples", "sampling_gap_to_1.5",
          "euler_polynomial_first_failure_n", "euler_polynomial_value_at_failure", "f_m1_n0.3_to_3.5_change_pct",
          "uptake_0.7pct_mg_per_1g", "uptake_0.7pct_drops_per_1g", "uptake_0.7pct_mg_in_1cm_cube", "uptake_0.7pct_drops_in_1cm_cube",
          "uptake_8.0pct_drops_per_1g", "0.7pct_of_70kg_kg", "ideal_mixing_lin_strain_for_0.7pct_pct", "F80V2_1day_strain_per_pct_mass",
          "strain_for_0.7pct_mass_low_pct", "strain_for_0.7pct_mass_high_pct", "bilayer_low_R_mm", "bilayer_high_R_mm",
          "bilayer_low_tip_mm_L40", "bilayer_high_tip_mm_L40", "strip_elongation_low_mm_L40", "strip_elongation_high_mm_L40",
          "amplification_low", "amplification_high", "amplification_formula_0.75L_over_h", "crank_tau_50", "crank_tau_90", "crank_tau_99",
          "reyssat_drying_ratio_for_double_h", "reyssat_wetting_ratio_for_double_h", "heat_t90_s_steel_1010_h1.0mm",
          "ratio_steel1010_heat_vs_water_D1e-12", "ratio_nylon_heat_vs_water_D1e-12", "f_m1_n0.3", "f_m1_n3.5", "f_m1_n30", "loss_m1_n30_pct_vs_1.5", "f_m1_n10_fraction_of_ceiling"]:
    print(k, "=", out[k])
for r in out["stiffness_table"]: print(r)
for r in out["Rmin_table"]: print(r)
for r in out["strain_needed_table"]: print(r)
for r in out["t90_table"]: print(r["label"], r["h_mm"], round(r["t90_hours"], 3), "h")
