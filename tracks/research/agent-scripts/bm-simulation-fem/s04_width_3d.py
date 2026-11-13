"""s04: width effect and anticlastic curvature, 3-D linear FEM (small-deflection regime).

For L/h = 20, widths w/h = 0.5 ... 32, several (m,n) and Poisson ratios, reports
kappa_x*h/d_eps (compare Timoshenko f), kappa_x/kappa_beam and kappa_z/kappa_x.
(kappa_z/kappa_x < 0 would be anticlastic; > 0 is synclastic, i.e. a saddle-free dome.)
Also reports the mesh check at one case (finer mesh).
"""
import _env
import csv, time
import numpy as np
from fem3d import solve3d
from fem2d import f_closed

D_EPS = 1e-3
WS = [0.5, 1, 2, 4, 8, 16, 32]
CASES = [  # (m, n, nu1, nu2)
    (1.0, 1, 0.30, 0.30),
    (10 ** -0.5, 10, 0.30, 0.30),
    (0.2, 10, 0.30, 0.30),
    (1.0, 10, 0.30, 0.30),
    (0.05, 10, 0.30, 0.30),
    (20.0, 50, 0.30, 0.30),
    (10 ** -0.5, 10, 0.49, 0.35),
    (1.0, 1, 0.49, 0.49),
]
rows = []
t0 = time.time()
for (m, n, nu1, nu2) in CASES:
    for w in WS:
        r = solve3d(m, n, w, L=20.0, nu1=nu1, nu2=nu2, d_eps=D_EPS)
        rows.append(dict(m=round(m, 4), n=n, nu1=nu1, nu2=nu2, w_over_h=w,
                         f_timoshenko=f_closed(m, n), kx_over_deps=r['kappa_x'] / D_EPS,
                         kx_over_beam=r['kappa_x'] / D_EPS / f_closed(m, n),
                         kz_over_kx=r['kappa_z'] / r['kappa_x'], ndof=r['ndof']))
with open(_env.OUT + r"\s04_width.csv", "w", newline="") as fh:
    wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)

lines = [f"3-D linear FEM, L/h=20, d_eps={D_EPS}, ElementHex2, total {time.time()-t0:.0f} s",
         "m       n   nu1   nu2   w/h   kx*h/d_eps   f_Tim    kx/f_Tim   kz/kx     ndof"]
for r in rows:
    lines.append(f"{r['m']:<7} {r['n']:<3} {r['nu1']:<5} {r['nu2']:<5} {r['w_over_h']:<5} {r['kx_over_deps']:<12.5f} "
                 f"{r['f_timoshenko']:<8.5f} {r['kx_over_beam']:<9.5f} {r['kz_over_kx']:<9.5f} {r['ndof']}")
dev = max(rows, key=lambda r: abs(r['kx_over_beam'] - 1))
lines.append(f"\nlargest |kx/f_Tim - 1| = {abs(dev['kx_over_beam']-1):.4f} at m={dev['m']}, n={dev['n']}, nu=({dev['nu1']},{dev['nu2']}), w/h={dev['w_over_h']}")
eq = [r for r in rows if r['nu1'] == r['nu2']]
dev2 = max(eq, key=lambda r: abs(r['kx_over_beam'] - 1))
lines.append(f"largest |kx/f_Tim - 1| with equal Poisson ratios = {abs(dev2['kx_over_beam']-1):.4f} at m={dev2['m']}, n={dev2['n']}, w/h={dev2['w_over_h']}")
# mesh check
a = solve3d(10 ** -0.5, 10, 4.0, L=20.0, d_eps=D_EPS)
b = solve3d(10 ** -0.5, 10, 4.0, L=20.0, d_eps=D_EPS, nx_per_h=2, ny1=3, ny2=3)
lines.append(f"\nmesh check (m=n^-0.5, n=10, w/h=4): kx*h/d_eps {a['kappa_x']/D_EPS:.6f} (ndof {a['ndof']}) vs finer {b['kappa_x']/D_EPS:.6f} (ndof {b['ndof']}); kz/kx {a['kappa_z']/a['kappa_x']:.5f} vs {b['kappa_z']/b['kappa_x']:.5f}")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s04_output.txt", "w").write(txt + "\n")
