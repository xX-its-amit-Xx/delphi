"""Fisher-KPP baseline c = 2*sqrt(D*r) (registry law fisher-kpp-speed 1.1.0, c^2 = 4 s D) against Cremer 2019 ED Fig 1c speeds.
D_rho = 50.2 um^2/s from MOESM3.txt (D_chemotaxis_1). 1 um^2/s = 3.6e-3 mm^2/h. Usage: python -P 03_fisher_baseline.py"""
import math
D = 50.2 * 3.6e-3
for name, u, r in (("wt glucose+asp", 4.3347312336, 0.9985), ("wt glycerol+asp", 3.67462190077778, 0.7735),
                   ("wt acetate+asp", 2.958763981, 0.542), ("Pu-glpFK 0 uM", 0.9986998405, 0.222)):
    c = 2 * math.sqrt(D * r)
    print(f"{name}: Fisher c={c:.3f} mm/h  measured={u:.3f}  ratio meas/Fisher={u/c:.2f}")
print("D_rho mm2/h =", round(D, 4))
