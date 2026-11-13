"""bm-polyamide-sls calculations. Run: python -I -X utf8 calc.py
Every input is either copied from a fetched source (named in the comment) or labelled ASSUMPTION.
Writes calc_out.json and prints a readable report to stdout.
"""
import json, math, os

OUT = "D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-polyamide-sls/calc_out.json"
res = {}


# ---------- 1. Fickian slab, exact series (Crank) ----------
def frac(Dt_over_l2, nterms=200):
    """M_t/M_inf for a plane sheet of full thickness l, both faces exposed, constant D."""
    s = 0.0
    for n in range(nterms):
        k = (2 * n + 1)
        s += 8.0 / (k * k * math.pi ** 2) * math.exp(-k * k * math.pi ** 2 * Dt_over_l2)
    return 1.0 - s


def Dt_for_frac(target):
    lo, hi = 1e-6, 5.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if frac(mid) < target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


K50 = Dt_for_frac(0.5)
K90 = Dt_for_frac(0.9)
K99 = Dt_for_frac(0.99)
res["fick_constants_Dt_over_l2"] = {"t50": K50, "t90": K90, "t99": K99}
print("Dt/l^2 for 50/90/99 %%: %.4f %.4f %.4f" % (K50, K90, K99))

# ---------- 2. D inferred from published kinetics ----------
inf = {}
# 2a. Bahrami 2021 (PMC8537549): hot-pressed PA11 and PA12 sheets 20x20x4 mm, ASTM D570 style,
#     "After around two months, both PAs had the same saturation level" -> t_sat <= ~2 months. l = 4 mm (their text).
l = 4e-3
t_sat = 2 * 30 * 24 * 3600.0  # 2 months, ASSUMPTION: 60 days
for k, name in ((K90, "90%"), (K99, "99%")):
    inf["bahrami_D_if_%s_by_2_months_m2s" % name] = k * l ** 2 / t_sat
# 2b. Amstutz 2021 (PMC8549196): injection moulded Grilamid L25 ISO 527-2 1A bars, 40 days in water at 23 C,
#     uptake 0.91 % (IQR 0.15) relative to ambient-conditioned mass. Thickness 4 mm (ISO 527-2 1A; paper gives cross-section ~40 mm2
#     -> consistent with 10 x 4 mm, ASSUMPTION). Total possible extra uptake M_inf-M_amb unknown; bracket it.
t40 = 40 * 24 * 3600.0
l = 4e-3


def D_from_frac(f, l, t):
    # invert frac(Dt/l^2)=f
    lo, hi = 1e-8, 5.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if frac(mid) < f:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi) * l ** 2 / t


for Minf in (0.91, 1.0, 1.3, 1.6):  # extra % above ambient reached at saturation
    f = 0.91 / Minf
    if f >= 0.9999:
        f = 0.9999
    inf["amstutz_D_if_extra_saturation_%.2f_pct_m2s" % Minf] = D_from_frac(f, l, t40)
res["D_inferred"] = inf
for k, v in inf.items():
    print("%-60s %.3e m2/s = %.3e mm2/h" % (k, v, v * 1e6 * 3600))

# ---------- 3. response times ----------
Dset = {
    "D=1e-13 (low end of 1-3e-13 secondary PA12 figure; TPU-FDM low end 1.4e-13)": 1e-13,
    "D=3e-13 (Amstutz-based lower estimate; PA12 bulk)": 3e-13,
    "D=4.95e-13 (measured PA11 injection-moulded, 23 C immersion, Oliver-Ortega 2018)": 4.95e-13,
    "D=1.4e-12 (Bahrami-based, if 99% saturated at 2 months)": 1.4e-12,
    "D=5e-12 (10 x 4.95e-13: 'one order greater' for sintered, Villani 2024)": 4.95e-12,
}
hs = [0.4e-3, 0.8e-3, 1.6e-3]
rt = []
for name, D in Dset.items():
    for h in hs:
        row = {
            "D_label": name, "D_m2s": D, "h_mm": h * 1e3,
            "tau_h2_over_D_h": h ** 2 / D / 3600.0,
            "t90_two_faces_h": K90 * h ** 2 / D / 3600.0,
            "t90_one_face_h": K90 * (2 * h) ** 2 / D / 3600.0,
            "t50_two_faces_h": K50 * h ** 2 / D / 3600.0,
        }
        rt.append(row)
res["response_times"] = rt
print("\nResponse times (hours):")
for r in rt:
    print("%-80s h=%.1f mm  tau=%7.2f  t50(2f)=%7.2f  t90(2f)=%7.2f  t90(1f)=%8.2f" % (
        r["D_label"][:80], r["h_mm"], r["tau_h2_over_D_h"], r["t50_two_faces_h"], r["t90_two_faces_h"], r["t90_one_face_h"]))

# ---------- 4. pore capacity of sintered PA12 ----------
# EOS PA2200 sintered density 0.90-0.95 g/cm3 (eos-pa2200-mds-uzh.pdf); dense PA12 1.01 g/cm3 (Arkema Rilsamid AESNO MED TDS);
# dense PA12 immersion uptake 1.6 % (same TDS). water density 1.0.
rho_dense = 1.01
cap = []
for rho in (0.90, 0.93, 0.95):
    phi = 1 - rho / rho_dense                      # total void fraction if the solid is fully dense PA12
    pore_water_pct = phi * 1.0 / rho * 100.0       # g water per g of dry part, if all voids fill
    polymer_water_pct = 1.6 * (1 - 0.0)            # polymer bound water, per g polymer (approx, per g part ~1.6)
    cap.append({"rho_part": rho, "void_fraction": phi, "pore_water_pct_of_dry_mass": pore_water_pct,
                "polymer_bound_water_pct_arkema_immersion": 1.6, "sum_pct": pore_water_pct + 1.6})
res["pore_capacity"] = cap
print("\nPore capacity if ALL voids filled (rho_dense=1.01):")
for c in cap:
    print("rho=%.2f  void=%.3f  pore_water=%.2f %%  + polymer 1.6 = %.2f %%" % (
        c["rho_part"], c["void_fraction"], c["pore_water_pct_of_dry_mass"], c["sum_pct"]))
# what open-void fraction do the measured saturations imply (rho_part=0.93)?
imp = []
for name, m in (("Zheng 2022 SLS PA12 5.47%", 5.47), ("Villani 2024 SLS PA12 10.49%", 10.49)):
    extra = m - 1.6
    phi_open = extra / 100.0 * 0.93 / 1.0
    imp.append({"study": name, "extra_pct_over_dense": extra, "implied_water_filled_void_fraction_at_rho_0.93": phi_open})
res["implied_void_fraction"] = imp
for i in imp:
    print(i)

# ---------- 5. Kelvin radius ----------
gamma, Vm, R, T = 0.072, 18.0e-6, 8.314, 298.15
pref = 2 * gamma * Vm / (R * T)
kel = []
for RH in (0.2, 0.5, 0.8, 0.9, 0.96, 0.99):
    kel.append({"RH": RH, "kelvin_radius_nm": pref / math.log(1 / RH) * 1e9})
res["kelvin"] = {"prefactor_nm": pref * 1e9, "rows": kel}
print("\nKelvin radius (cylindrical-meniscus, perfect wetting): 2*gamma*Vm/RT = %.3f nm" % (pref * 1e9))
for k in kel:
    print("RH=%.2f  r_K=%.2f nm" % (k["RH"], k["kelvin_radius_nm"]))

# ---------- 6. isotherms (copied points) ----------
iso = {
    "EOS PA2200 sintered PA12 (DIN53495/ISO62)": {"50": 0.52, "96": 1.33, "water_100C_saturation": 1.93},
    "Arkema Rilsan BMNO TLD PA11 moulded (ISO 62)": {"50": 0.8, "immersion_23C": 1.9},
    "Arkema Rilsamid AESNO MED PA12 moulded (ISO 62)": {"immersion_23C": 1.6},
    "Bahrami 2021 hot-pressed PA11 and PA12 (after ~2 months)": {"50": 0.8, "immersion_23C": 1.5},
    "Protolabs PA12 (cites EOS PA 2200 Balance) DIN EN ISO 62": {"50": 0.5, "boiling_24h": 2.0},
    "Estane 58887 polyether TPU 87A (Pichler DVS via PMC10534667 Table 1)": {"20": 0.25, "40": 0.53, "60": 0.91, "80": 1.35},
}
res["isotherm_points_wt_pct"] = iso
# TPU linear fit through origin and slope
xs = [20, 40, 60, 80]
ys = [0.25, 0.53, 0.91, 1.35]
slope0 = sum(x * y for x, y in zip(xs, ys)) / sum(x * x for x in xs)
res["TPU_slope_through_origin_pct_per_pctRH"] = slope0
print("\nTPU Estane isotherm slope through origin: %.4f wt%% per %%RH; PA12 sintered 0->50%%RH: %.4f; 50->96: %.4f" % (
    slope0, 0.52 / 50, (1.33 - 0.52) / 46))

# ---------- 7. hygroscopic strain and bilayer curvature (uses the project's Timoshenko ceiling kappa = 1.5*d_eps/h) ----------
# swelling coefficient: Intech cast PA12GC vendor page: 1.4 % uptake -> 0.2 % dimensional change => 0.143 %/wt%.
# Upper: PA6.6 measured in-plane 1.81e-4 m3/kg, converted by earlier agent to 0.207-0.278 %/wt% (agents/spec-resin-chemistry.json). ASSUMPTION used as upper bound.
beta_lo, beta_hi = 0.2 / 1.4, 0.278
# PA12 water uptake swing between two RH levels from EOS points (piecewise-linear; 0 at 0%RH, ASSUMPTION)


def w_pa12(RH):
    if RH <= 50:
        return 0.52 * RH / 50.0
    return 0.52 + (1.33 - 0.52) * (RH - 50) / 46.0


bil = []
for (r1, r2) in ((30, 80), (40, 70), (50, 90)):
    dw = w_pa12(r2) - w_pa12(r1)
    for beta in (beta_lo, beta_hi):
        deps = dw * beta / 100.0                     # free linear strain of PA12 (passive partner assumed 0)
        for h in (0.4e-3, 0.8e-3, 1.6e-3):           # total bilayer thickness
            kappa = 1.5 * deps / h
            Rm = 1.0 / kappa
            L = 40e-3
            tip = L ** 2 / (2 * Rm)                  # small-deflection tip rise of a 40 mm cantilever strip, circular arc approx
            bil.append({"RH": [r1, r2], "dw_pct": dw, "beta_pct_per_wt": beta, "d_eps": deps,
                        "h_total_mm": h * 1e3, "kappa_per_m": kappa, "R_mm": Rm * 1e3, "tip_40mm_mm": tip * 1e3})
res["bilayer_estimates"] = bil
print("\nBilayer (ideal inert passive partner, optimum m^2 n = 1, kappa = 1.5 d_eps / h):")
for b in bil:
    print("RH %s dw=%.2f%% beta=%.3f d_eps=%.3e h=%.1f mm R=%.0f mm tip(40mm)=%.2f mm" % (
        b["RH"], b["dw_pct"], b["beta_pct_per_wt"], b["d_eps"], b["h_total_mm"], b["R_mm"], b["tip_40mm_mm"]))

# ---------- 8. modulus ratios ----------
mod = {
    "Amstutz Grilamid L25 23C 50mm/min dry(ambient 50%RH)->water": (1553.5, 882.0),
    "Amstutz Grilamid L25 23C 1mm/min dry(ambient)->water": (1506.5, 728.0),
    "Arkema Rilsamid AESNO MED tensile modulus DRY->COND": (1500.0, 1440.0),
    "Villani sintered PA12 dry->2h immersion (GPa as read from abstract)": (1000.0, 800.0),
}
res["modulus_ratios"] = {k: {"dry": a, "wet": b, "wet_over_dry": b / a, "change_pct": (b / a - 1) * 100} for k, (a, b) in mod.items()}
for k, v in res["modulus_ratios"].items():
    print("%-70s wet/dry=%.3f (%.1f %%)" % (k, v["wet_over_dry"], v["change_pct"]))
# TPU secant modulus from Formlabs TDS (stress at 50 % elongation 6.1 MPa X/Y, at 100% 7.2 MPa)
res["TPU90A_secant_MPa"] = {"at_50pct": 6.1 / 0.5, "at_100pct": 7.2 / 1.0}
res["modulus_ratio_PA12_over_TPU_secant50"] = 1850.0 / (6.1 / 0.5)
print("\nTPU 90A secant modulus: %.1f MPa at 50%%, %.1f MPa at 100%%; PA12 1850 MPa / 12.2 = %.0f" % (
    6.1 / 0.5, 7.2, 1850 / 12.2))
# optimum thickness ratio for the project's law m^2 n = 1 (n = modulus ratio) -> softer layer must be thicker by sqrt(E ratio)
res["optimum_thickness_ratio_soft_over_stiff"] = math.sqrt(1850.0 / 12.2)
print("Optimum thickness ratio (soft layer/stiff layer) for m^2 n = 1 with PA12/TPU: %.1f" % math.sqrt(1850 / 12.2))

# TPU FDM volumetric -> linear (isotropic assumption): Simunic 2026 96 h saline: 0.6 % ... 8 %
res["TPU_FDM_linear_from_volumetric_pct"] = {"0.6": 0.6 / 3, "4.5": 4.5 / 3, "8": 8 / 3}
print("\nTPU-FDM linear strain if isotropic: 0.2 %%, 1.5 %%, 2.7 %% (from 0.6, 4.5, 8 %% volumetric)")


# ---------- 9. sensitivity of the Timoshenko coefficient to moisture-softening of ONE layer ----------
# f(m,n)=6(1+m)^2/[3(1+m)^2+(1+m n)(m^2+1/(m n))], ceiling 3/2 at m^2 n=1 (project record; Lean file HygromorphCeilingCheck.lean)
def f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))
sens = []
for n0 in (1.0, 10.0, 100.0, 150.0):
    m0 = n0 ** -0.5
    for fac in (1.0, 0.568, 0.483):
        # the softening layer is the one whose modulus is in the numerator of n (assumption: active layer modulus in n); also check the other direction
        sens.append({"n_dry": n0, "m_tuned": m0, "modulus_factor": fac,
                     "f_if_n_scaled_by_fac": f(m0, n0 * fac), "f_if_n_scaled_by_1_over_fac": f(m0, n0 / fac)})
res["f_sensitivity"] = sens
print("\nf(m,n) at m tuned for dry n, when n changes with moisture:")
for r in sens:
    print("n_dry=%6.1f m=%.3f fac=%.3f f(n*fac)=%.4f f(n/fac)=%.4f (ceiling 1.5)" % (r["n_dry"], r["m_tuned"], r["modulus_factor"], r["f_if_n_scaled_by_fac"], r["f_if_n_scaled_by_1_over_fac"]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(res, open(OUT, "w"), indent=1)
print("\nwrote", OUT)
