"""s02: sweep of the 2-D FEM over modulus ratio n and thickness ratio m.

Compares FEM curvature*h/d_eps with the Timoshenko f(m,n) and with the ceiling 3/2.
Cases:
  A  plane stress, nu1=nu2=0.30            (beam-theory limit; expect f)
  B  plane strain, nu1=nu2=0.30            (expect (1+nu) f)
  C  plane strain, nu1=nu2=0.49            (rubbery layers; expect 1.49 f)
  D  plane strain, nu1=0.49 (active soft), nu2=0.35 (stiff passive), expect generalised formula
Writes results/s02_sweep.csv and results/s02_output.txt.
"""
import _env
import csv
import numpy as np
from fem2d import solve, f_closed, f_plane_strain_generalised

NS = [1, 2, 5, 10, 50]
MS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]
D_EPS = 1e-3
CASES = {
    'A_planestress_nu0.30': dict(mode='plane_stress', nu1=0.30, nu2=0.30),
    'B_planestrain_nu0.30': dict(mode='plane_strain', nu1=0.30, nu2=0.30),
    'C_planestrain_nu0.49': dict(mode='plane_strain', nu1=0.49, nu2=0.49),
    'D_planestrain_nu0.49_0.35': dict(mode='plane_strain', nu1=0.49, nu2=0.35),
}

def theory(case, m, n):
    c = CASES[case]
    if c['mode'] == 'plane_stress':
        return f_closed(m, n)
    return f_plane_strain_generalised(m, n, c['nu1'], c['nu2'])

rows = []
for case, c in CASES.items():
    for n in NS:
        ms = list(MS) + [n ** -0.5]
        for m in ms:
            r = solve(m, n, L=40.0, d_eps=D_EPS, nx_per_h=2, ny1=4, ny2=4, **c)
            fem = r['kappa'] / D_EPS
            f_t = theory(case, m, n)
            f_t_pure = f_closed(m, n)
            rows.append(dict(case=case, n=n, m=round(m, 5), f_fem=fem, f_theory=f_t,
                             rel_err_vs_theory=fem / f_t - 1, f_timoshenko=f_t_pure,
                             rel_err_vs_timoshenko=fem / f_t_pure - 1,
                             ratio_to_ceiling=fem / 1.5, kappa_ux_over_uy=r['kappa_ux'] / r['kappa']))
with open(_env.OUT + r"\s02_sweep.csv", "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

lines = []
lines.append(f"L/h=40, d_eps={D_EPS}, Q2 elements dx=h/2, 4 elements per layer; fit window x in [0, 0.5*L/2]")
for case in CASES:
    sub = [r for r in rows if r['case'] == case]
    worst_th = max(sub, key=lambda r: abs(r['rel_err_vs_theory']))
    worst_tim = max(sub, key=lambda r: abs(r['rel_err_vs_timoshenko']))
    mx = max(sub, key=lambda r: r['f_fem'])
    lines.append(f"\n[{case}]  {len(sub)} (m,n) points")
    lines.append(f"  max |FEM/own-theory - 1| = {abs(worst_th['rel_err_vs_theory']):.3e} at n={worst_th['n']}, m={worst_th['m']}  (own-theory = Timoshenko for plane stress, generalised plane-strain formula otherwise)")
    lines.append(f"  max |FEM/Timoshenko f - 1| = {abs(worst_tim['rel_err_vs_timoshenko']):.3e} at n={worst_tim['n']}, m={worst_tim['m']}")
    lines.append(f"  largest FEM coefficient = {mx['f_fem']:.5f} at n={mx['n']}, m={mx['m']}  (ceiling 3/2 = 1.5; ratio {mx['f_fem']/1.5:.5f})")
    at_opt = [r for r in sub if abs(r['m'] - round(r['n'] ** -0.5, 5)) < 1e-9]
    lines.append("  at optimum m=n^-0.5: " + "; ".join(f"n={r['n']}: f_FEM={r['f_fem']:.5f}" for r in at_opt))
lines.append("\nFull table in s02_sweep.csv. Selected rows (case A):")
lines.append("   n      m     f_FEM     f_Tim   rel.err")
for r in rows:
    if r['case'].startswith('A') and r['m'] in (0.05, 0.2, 1, 5, 20):
        lines.append(f"{r['n']:>4} {r['m']:>6} {r['f_fem']:>9.5f} {r['f_theory']:>9.5f} {r['rel_err_vs_theory']:>10.2e}")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s02_output.txt", "w").write(txt + "\n")
