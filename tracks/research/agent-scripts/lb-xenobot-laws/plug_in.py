"""Plug published xenobot numbers into the four certificates of XenobotLaws.lean.
Run:  python -I plug_in.py     (writes results.tsv next to this file)

PUBLISHED = read in the opened full text (see sentences.txt, made by fetch_papers.py).
ASSUMED   = textbook-order value from memory, NOT opened in a source in this run. Any verdict that
            leans on an ASSUMED value is labelled so. Where nothing was measured, the certificate is
            inverted: we report the parameter threshold at which a real xenobot would cross it.
"""
import math, os

HERE = os.path.dirname(os.path.abspath(__file__))
rows = []
def row(cert, quantity, value, unit, status, note):
    rows.append((str(cert), quantity, f"{value:.4g}" if isinstance(value, float) else str(value), unit, status, note))

# ---- PUBLISHED numbers
life_lo_d, life_hi_d = 10.0, 14.0          # Kriegman 2021 PNAS: "for a period of 10 to 14 d"
cells_parent = 3000.0                       # Kriegman 2021: "spheres containing ~3,000 cells"
cells_min = 50.0                            # Kriegman 2021: "at least 50 cells"
gens_spheroid = [1, 1, 1, 1, 2]             # Kriegman 2021: "(1, 1, 1, 1, and 2 g)"
gens_semitoroid = [2, 3, 4]                 # Kriegman 2021: "(2, 3, and 4 g)"
body_len_m = 100e-6 / 0.12                  # Kriegman 2020: "100 um or greater (12% of total body length)"
R = body_len_m / 2

# ---- ASSUMED physical constants (not from an opened source)
mu, rho = 1.0e-3, 1.0e3                     # water, Pa s and kg/m3
D_o2 = 2.0e-9                               # m2/s, oxygen in watery tissue
c0 = 0.27                                   # mol/m3, air-saturated fresh water near 20 C

# 1. energy budget -----------------------------------------------------------------------------
row(1, "observed unfed lifetime", f"{life_lo_d:g}-{life_hi_d:g}", "d", "PUBLISHED", "Kriegman 2021 PNAS")
row(1, "E_store / P_min", "not measured", "-", "CANNOT TEST",
    "no opened source gives yolk energy or minimum power; paper attributes death to depleted stores (qualitative support only)")

# 2. Stokes / Reynolds ---------------------------------------------------------------------------
row(2, "body length L", body_len_m * 1e6, "um", "PUBLISHED (derived)", "100 um = 12% of body length, Kriegman 2020")
v_re1 = mu / (rho * body_len_m)
row(2, "speed at which Re = 1", v_re1 * 1e3, "mm/s", "ASSUMED water props", "Re<1 holds for any speed below this")
for v in (50e-6, 100e-6, 500e-6):
    F = 6 * math.pi * mu * R * v
    row(2, f"Stokes force needed for v={v*1e6:g} um/s", F * 1e9, "nN", "ASSUMED speed",
        f"Re={rho*v*body_len_m/mu:.3g}; xenobot speed not found in an opened source")
row(2, "n_cilia * f_max", "not measured", "-", "CANNOT TEST", "no opened source gives cilia count or per-cilium force")

# 3. diffusion limit -----------------------------------------------------------------------------
row(3, "radius R", R * 1e6, "um", "PUBLISHED (derived)", "half of body length")
q_max = 6 * D_o2 * c0 / R ** 2
row(3, "largest q for which centre stays oxygenated", q_max, "mol/m3/s", "ASSUMED D, c0",
    "xenobot is inside the bound iff its oxygen use per volume is below this")
for q in (1e-3, 1e-2, 5e-2):
    Rc = math.sqrt(6 * D_o2 * c0 / q)
    row(3, f"critical radius for q={q:g} mol/m3/s", Rc * 1e6, "um", "ASSUMED D, c0, q",
        "INSIDE" if R <= Rc else "OUTSIDE (anoxic core predicted)")

# 4. replication ---------------------------------------------------------------------------------
ratio = (cells_parent / cells_min) ** (1 / 3)
row(4, "d0/d_min from cell counts (3000/50)^(1/3)", ratio, "-", "PUBLISHED (derived)",
    "assumes volume proportional to cell number")
row(4, "max generations, wild-type spheroids", max(gens_spheroid), "-", "PUBLISHED", "Kriegman 2021")
row(4, "max generations, AI-designed semitoroids", max(gens_semitoroid), "-", "PUBLISHED", "Kriegman 2021")
for r in (0.5, 0.6, 0.7, 0.8):
    bound = math.log(ratio) / math.log(1 / r)
    ok_s = max(gens_spheroid) <= bound
    ok_t = max(gens_semitoroid) <= bound
    row(4, f"generation ceiling if r={r}", bound, "generations", "r ASSUMED (not in text)",
        f"spheroids {'inside' if ok_s else 'VIOLATE'}; semitoroids {'inside' if ok_t else 'VIOLATE'}")
for g, name in ((max(gens_spheroid), "spheroids"), (max(gens_semitoroid), "semitoroids")):
    row(4, f"smallest r compatible with {g} generations ({name})", ratio ** (-1 / g), "-", "PUBLISHED (derived)",
        "if measured shrink factor is below this, the shrink model is falsified")

with open(os.path.join(HERE, "results.tsv"), "w", encoding="utf-8") as f:
    f.write("certificate\tquantity\tvalue\tunit\tstatus\tnote\n")
    for r_ in rows:
        f.write("\t".join(r_) + "\n")
        print(" | ".join(r_))
