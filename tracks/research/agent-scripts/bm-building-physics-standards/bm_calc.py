"""Calculations behind bm-building-physics-standards. Run: python -I bm_calc.py
Pure standard library. Every input is quoted with its source in the comments.
"""
import math, json

# ---- 1. Project-record check: Timoshenko bilayer coefficient ceiling 3/2 at m^2 n = 1
def f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))

best = (0, None, None)
for i in range(1, 400):
    m = 0.05 * i
    for j in range(1, 400):
        n = 0.05 * j
        v = f(m, n)
        if v > best[0]:
            best = (v, m, n)
print("grid max f =", round(best[0], 6), "at m=%.2f n=%.2f (m^2 n=%.3f)" % (best[1], best[2], best[1] ** 2 * best[2]))
# exact check at m^2 n = 1 for several m
for m in (0.5, 1.0, 2.0, 3.7):
    n = 1 / m ** 2
    print("m=%.2f n=%.4f f=%.12f" % (m, n, f(m, n)))

# curvature at optimum: kappa = 1.5 * d_eps / h  (h = total thickness)
def kappa_opt(d_eps, h_mm):
    return 1.5 * d_eps / h_mm  # 1/mm

# ---- 2. Thermal vs hygroscopic differential strain for a stock-Formlabs bilayer
# CTE (0-150 C, ASTM E831) read from Formlabs TDS PDFs fetched 2026-11-12 (um/m/C):
#   Rigid 10K: 48/47/46/41 (four cure states; column mapping not read)
#   Tough 1000: 161.6 / 168.2 (two states)
#   Tough 1500 V2: 116 / 99 ; Tough 2000 V2: 142.6 / 134.2
cte = {
    "Rigid 10K": (41, 48),
    "Tough 2000 V2": (134.2, 142.6),
    "Tough 1500 V2": (99, 116),
    "Tough 1000": (161.6, 168.2),
}
dT = 40.0  # K, e.g. 20 C -> 60 C (assumption, labelled)
pair = ("Rigid 10K", "Tough 1000")
lo = cte[pair[1]][0] - cte[pair[0]][1]
hi = cte[pair[1]][1] - cte[pair[0]][0]
print("delta CTE %s vs %s: %.1f to %.1f um/m/C" % (pair[1], pair[0], lo, hi))
print("thermal differential strain at dT=%g K: %.3f %% to %.3f %%" % (dT, lo * dT * 1e-4, hi * dT * 1e-4))
# Earlier-agent estimate for hygroscopic differential strain on stock resins (own estimate, spec-resin-chemistry.json): 0.2 % (24 h), 0.7-0.9 % (1 week)
for h in (1.0, 2.0):
    for label, eps in (("thermal low", lo * dT * 1e-6), ("thermal high", hi * dT * 1e-6), ("hygro 24h (earlier est.)", 0.002)):
        k = kappa_opt(eps, h)
        print("h=%.1f mm %-26s eps=%.4f kappa_opt=%.5f /mm radius=%.0f mm" % (h, label, eps, k, 1 / k))

# ---- 3. Test durations in hours
cheng_cycle_h = (120 + 240) / 60  # 90% RH 120 min + 30% RH 240 min (Cheng 2024 Methods)
print("Cheng 2024: cycle %.1f h x 170 cycles = %.0f h = %.1f days" % (cheng_cycle_h, cheng_cycle_h * 170, cheng_cycle_h * 170 / 24))
print("Cheng 2024 UV test: 96 h = %.1f days at 60 C dry heat" % (96 / 24))
print("Formlabs Nylon 12 D4329 Cycle A: 1000 h = %.1f days; cycle = 8 h UV + 4 h condensation -> %d full cycles" % (1000 / 24, 1000 // 12))
print("ASTM D3045 rule quoted by Formlabs (Flexible 80A V2 TDS): 6 weeks at 50 C ~ 1 year ambient -> %d h vs %d h/yr = factor %.1f" % (6 * 7 * 24, 8760, 8760 / (6 * 7 * 24)))
print("50-yr design working life = %d h; 1000 h xenon is %.2f %% of that in raw hours" % (50 * 8760, 1000 / (50 * 8760) * 100))
print("Daily RH cycles over 25 yr (1/day) = %d vs 170 tested = %.1f %%" % (25 * 365, 170 / (25 * 365) * 100))
