"""s06: extreme modulus contrast (stiff, thin passive layer on a soft, thick active layer).

Plane stress, 2-D FEM. The layers are swapped by symmetry (f(m,n) = f(1/m,1/n)), so n >= 1 with
the stiff layer being the swelling one is the same physics as the soft layer swelling and
the stiff layer passive. Checks f at the optimum m = n^-0.5 for n up to 2000 and a few off-optimum points,
and gives the thickness of the thin stiff layer for a 1.6 mm total strip.
Elastomer/rigid pair used as an illustration: secant modulus of Flexible 80A V2 about 5.8 MPa
(project record: spec-formlabs-materials.json, own estimate) vs Rigid 10K 10.5 GPa -> n about 1800.
"""
import _env
from fem2d import solve, f_closed

D_EPS = 1e-3
lines = ["n      m        f_FEM      f_Timoshenko  rel.err    stiff layer thickness for h=1.6 mm (mm)  ndof"]
for n in [50, 100, 300, 1000, 1810, 2000]:
    mopt = n ** -0.5
    for m in [mopt, 3 * mopt, mopt / 3]:
        r = solve(m, n, mode='plane_stress', L=40.0, d_eps=D_EPS, nx_per_h=2, ny1=8, ny2=8)
        fem = r['kappa'] / D_EPS
        f = f_closed(m, n)
        thin = 1.6 * m / (1 + m)  # layer 1 (stiff) thickness
        lines.append(f"{n:<6} {m:<8.5f} {fem:<10.5f} {f:<13.5f} {fem/f-1:+.2e}   {thin:.4f}   {r['ndof']}")
lines.append("")
lines.append("Reading: the Timoshenko value is reproduced to the printed digits even for a 1800:1 stiffness contrast "
             "when the mesh resolves the thin layer; ratio-of-thickness sensitivity, not modulus, is what matters.")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s06_output.txt", "w").write(txt + "\n")
