"""Worked numeric example for CrosslinkerWindow.lean (genipin-chitosan films).

    python -I worked_example.py        (no downloads; writes worked_example.csv and prints it)

INPUTS, all read by us in the open full text of
Kildeeva et al., Polymers 12 (2020) 1086, doi 10.3390/polym12051086 (PMC7285115), Table 2 and text:
  Gp/NH2 0.003 : equilibrium swelling 1025 wt %, chi 0.85, Mc 6934 g/mol
  Gp/NH2 0.02  : equilibrium swelling  340 wt %, chi 0.99, Mc 1015 g/mol
  film density ~1.018 g/cm3 (crosslinked)
EVERYTHING ELSE below is derived by this script, not reported by the paper.
"""
import csv
import math
import os

RT = 8.314 * 298.15          # J/mol
RHO = 1.018e6                # g/m3 (paper: ~1.018 g/cm3)
RHO_W = 1.0e6                # g/m3 water
FILMS = [("0.003", 1025.0, 0.85, 6934.0), ("0.02", 340.0, 0.99, 1015.0)]
H = 1e-3                     # m, bilayer total thickness of the example
rows = []
for ratio, swell_pct, chi, mc in FILMS:
    nu = RHO / mc                                   # mol strands per m3 dry film
    q = 1.0 + (swell_pct / 100.0) * RHO / RHO_W     # volume ratio, additive volumes
    s = q ** (1.0 / 3.0)                            # linear stretch, isotropic
    eps = s - 1.0
    e_aff = 3.0 * nu * RT                           # Pa, affine dry-reference modulus
    kappa_ceiling = 1.5 * eps / H                   # 1/m, Timoshenko ceiling
    rows.append(dict(Gp_NH2=ratio, swelling_wt_pct=swell_pct, chi=chi, Mc_g_mol=mc,
                     nu_mol_m3=round(nu, 1), Q=round(q, 3), stretch=round(s, 4),
                     strain=round(eps, 4), E_affine_MPa=round(e_aff / 1e6, 3),
                     kappa_ceiling_per_m_h1mm=round(kappa_ceiling, 1),
                     half_minus_chi=round(0.5 - chi, 2)))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worked_example.csv")
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
for r in rows:
    print(r)

lo, hi = rows[0], rows[1]
nu_ratio = hi["nu_mol_m3"] / lo["nu_mol_m3"]
q_ratio = hi["Q"] / lo["Q"]
print("nu ratio (high/low)            : %.3f" % nu_ratio)
print("Q ratio observed               : %.3f" % q_ratio)
print("Q ratio predicted by nu^(-3/5) : %.3f" % nu_ratio ** (-0.6))
print("apparent exponent              : %.3f  (NOT independent: Mc was itself fitted from swelling)"
      % (math.log(q_ratio) / math.log(nu_ratio)))
# the Lean instance: nu_c = 1003, eps = 0.646, h = 1 mm, kappa* = 1000 /m, nu_s = 1050, Emin = 8 MPa
print("Lean instance check: ceiling at nu_c = %.1f /m (must be <= 1000)" % (1.5 * 0.646 / H))
print("Lean instance check: E(1050) with RT=2479 = %d Pa (must be <= 8000000)" % (3 * 1050 * 2479))
print("high-swelling neutral balance needs 1/2 - chi > 0; here it is %.2f and %.2f -> NOT applicable"
      % (0.5 - 0.85, 0.5 - 0.99))
