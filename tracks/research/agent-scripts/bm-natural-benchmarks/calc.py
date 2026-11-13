"""Own calculations for bm-natural-benchmarks. Run: python calc.py   (no inputs; every number is typed below with its source)
f(m,n) = 6(1+m)^2 / [3(1+m)^2 + (1+m n)(m^2 + 1/(m n))]   (Reyssat & Mahadevan 2009 eq 2.6; project record: ceiling 3/2 at m^2 n = 1)
Convention (Reyssat): m = h_passive/h_active, n = E_passive/E_active. curvature kappa = f * d_eps / h  (h = total thickness).
"""
import math, json

def f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))

out = {}
# 0. sanity: ceiling and symmetry
grid = [(m, n) for m in (0.1, 0.3, 0.5, 1, 2, 5) for n in (0.1, 0.4, 1, 5, 23, 100)]
out["max_f_on_grid"] = max(f(m, n) for m, n in grid)
out["f_at_optimum_m0.5_n4"] = f(0.5, 4)           # m^2 n = 1
out["symmetry_f(m,n)-f(1/m,1/n)_max_abs"] = max(abs(f(m, n) - f(1 / m, 1 / n)) for m, n in grid)

rows = []
def add(name, m, n, note):
    v = f(m, n)
    rows.append(dict(name=name, m=round(m, 4), n=round(n, 4), m2n=round(m * m * n, 3), f=round(v, 4),
                     frac_of_ceiling=round(v / 1.5, 4), note=note))

# 1. Pine cone, Reyssat & Mahadevan 2009: m ~ 1, n ~ 5 (n from Dawson 1997 as quoted by R&M)
add("pine cone (Reyssat&Mahadevan: m~1, n~5)", 1.0, 5.0, "R&M quote f ~ 1.3")
# 2. Pine cone, Eger 2022 P. wallichiana: passive = fibre strands ~500 um, active = sclereid ~1000 um (thickest part)
add("pine cone P. wallichiana, Eger: E_fibre/E_sclereid dry (800/35 MPa)", 500 / 1000, 800 / 35, "nanoindentation, perpendicular to scale axis; fibre modulus has large SD")
add("pine cone P. wallichiana, Eger: wet (200/25 MPa)", 500 / 1000, 200 / 25, "E_fibre at 75 %RH, E_sclereid at 60 %RH")
# 3. Pine cone P. pinaster, Le Duigou&Castro 2016: swelling-tissue area fraction p -> m = (1-p)/p ; n NOT given -> use n=5 (R&M/Dawson) as illustration
for loc, p in (("top", 0.655), ("middle", 0.69), ("bottom", 0.625)):
    add(f"pine cone P. pinaster {loc}, area fraction active {p}, n=5 assumed", (1 - p) / p, 5.0, "m from Table 1 area %; n assumed from R&M, NOT measured by Le Duigou")
# 4. Reyssat paper(active)/polymer(passive) strip: h_a=100 um, h_p=200 um, n~0.4
add("R&M paper/polymer strip (m=2, n=0.4)", 2.0, 0.4, "R&M quote expected d_kappa ~ 0.19 /mm")
# 5. Pelargonium appendiculatum awn (Cecchini 2023): cap (active) 39.8 um, ridge (passive) 59.7 um; E 0.78 / 1.48 GPa
add("Pelargonium awn cap/ridge as a bilayer (my reduction)", 59.7 / 39.8, 1.48 / 0.78, "Cecchini use a helical-fibre model, not Timoshenko; bilayer reading is mine")
out["rows"] = rows

# thickness m that would sit on the ceiling for the measured n
out["m_opt_for_n5"] = 1 / math.sqrt(5)
out["m_opt_for_n22.86"] = 1 / math.sqrt(800 / 35)
out["m_opt_for_n8"] = 1 / math.sqrt(8)

# Reyssat paper strip: dRH needed for 0.19 /mm  (kappa = f * alpha * dRH / h)
fp = f(2, 0.4); alpha = 4e-4; h = 0.3
out["paper_strip_dRH_needed_for_0.19_per_mm"] = 0.19 * h / (alpha * fp)
# Reyssat pine cone: d_kappa = f alpha dRH / h, alpha = 1e-3 /%RH (eps = 0.0011 phi + 0.0033), dRH=100, h=1 mm
out["pine_dkappa_per_cm_f1.25"] = f(1, 5) * 1e-3 * 100 / 0.1  # h = 0.1 cm
out["pine_dkappa_per_cm_f1.30"] = 1.3 * 1e-3 * 100 / 0.1
out["pine_strain_at_100pct_from_fit"] = 0.0011 * 100 + 0.0033
# Eger differential strain (water): sclereid +22 % length, fibre +1 % -> mismatch
out["eger_mismatch_strain"] = 0.22 - 0.01
# Predicted/observed angle in R&M: 75 deg predicted vs up to 100 deg observed (different quantities: not a like-for-like error)
out["RM_pred_over_obs_angle"] = 75 / 100

# Response times, Reyssat fits (h in mm, minutes)
tw = lambda h: 29 * h ** 1.3
td = lambda h: 96 * h ** 1.5
D = 1e-9
out["times_min"] = {str(hh): dict(wet=round(tw(hh), 1), dry=round(td(hh), 1), h2_over_D_min=round((hh * 1e-3) ** 2 / D / 60, 2))
                    for hh in (0.1, 0.3, 0.5, 1.0, 1.5)}
# flytrap vs diffusion for 1 mm: 1000 s vs 0.1 s
out["flytrap_speedup_vs_h2_over_D_1mm"] = (1e-3) ** 2 / D / 0.1
# Ulrich 2024: after 102 cycles retained 97 % force; per-cycle geometric loss
out["ulrich_per_cycle_force_loss_pct"] = (1 - 0.97 ** (1 / 102)) * 100
# Le Duigou: ratio blocking moment / force ~ lever arm
for loc, F, M in (("top", 3.1, 80.5), ("middle", 3.6, 107.2), ("bottom", 2.2, 42.0)):
    out[f"LeDuigou_{loc}_M_over_F_mm"] = round(M / F, 1)
# Erodium gruinum Ronzan 2025: moment per extensional force
out["Erodium_moment_over_force_mm"] = 528e-6 / 45.9e-3 * 1e3
out["Pelargonium_moment_over_force_mm"] = 20.7e-6 / 5.1e-3 * 1e3
print(json.dumps(out, indent=1))
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-natural-benchmarks/calc_out.json", "w"), indent=1)
