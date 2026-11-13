"""s05b: how sensitive is the von Karman Ritz result to the size of the trial space?

Compares polynomial degree (in-plane Pu, deflection Pw) = (2,2), (3,3), (4,4) for the optimum
n=10 bilayer (m = n^-0.5, nu=0.3), L/h = 40, and compares the small-strain Ritz limit with the
linear classical-laminate-theory plate curvature and the linear 3-D FEM (s04).
"""
import _env
import numpy as np
from ritz_vk import Ritz, f_closed, clt_free_curvature

m, n, nu = 10 ** -0.5, 10.0, 0.30
f = f_closed(m, n)
lines = ["trial space (Pu,Pw): kx/f, ky/f of the lowest-energy stationary shape found, L/h=40",
         "d_eps   w/h   lam     (2,2)             (3,3)             (4,4)"]
for eps, w in [(1e-2, 4), (1e-2, 8), (1e-2, 12), (1e-2, 16), (1e-2, 24), (1e-2, 32), (3e-3, 32)]:
    cells = []
    for Pu, Pw in [(2, 2), (3, 3), (4, 4)]:
        R = Ritz(m, n, nu, nu, eps, 20.0, w / 2, Pu=Pu, Pw=Pw, ng=18)
        best = None
        for c in [(f * eps, f * eps), (1.3 * f * eps, 0), (0, 1.3 * f * eps)]:
            s = R.solve(*c, eps)
            if best is None or s['E'] < best['E']:
                best = s
        cells.append(f"({best['c1']/(f*eps):.3f},{best['c2']/(f*eps):.3f})")
    lines.append(f"{eps:<7g} {w:<5} {f*eps*w*w:<7.3f} " + "   ".join(cells))
k = clt_free_curvature(m, n, nu, nu, 1.0)
lines.append(f"\nlinear CLT free-plate curvature / (f d_eps): {abs(k[0])/f:.6f} (x), {abs(k[1])/f:.6f} (y)  [sphere, equals Timoshenko for equal Poisson ratios]")
k2 = clt_free_curvature(m, n, 0.49, 0.35, 1.0)
lines.append(f"linear CLT, nu1=0.49 (active), nu2=0.35: {abs(k2[0])/f:.6f}  (3-D FEM wide strip, s04: 0.99734)")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s05b_output.txt", "w").write(txt + "\n")
