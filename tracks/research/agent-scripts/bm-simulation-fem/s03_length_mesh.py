"""s03: how much does strip length (L/h) and mesh density change the 2-D result?

(a) Mesh convergence at (m,n) = (1,1), (0.05,10), (20,50), (0.316,10): plane stress.
(b) Length study: curvature from the central window (fit) AND from the whole-strip sagitta
    kappa_sag = 8*[uy(L/2)-uy(0)]/L^2 (what you would measure with a ruler on a real strip),
    for L/h = 5, 10, 20, 40, 80, relative to Timoshenko f.
"""
import _env
import numpy as np
import fem2d
from fem2d import solve, f_closed, build_mesh
import skfem as fe

D_EPS = 1e-3
lines = []
lines.append("(a) mesh convergence, plane stress, L/h=40: kappa*h/d_eps / f - 1")
for (m, n) in [(1, 1), (0.05, 10), (20, 50), (10 ** -0.5, 10)]:
    out = []
    for (npx, ny) in [(1, 2), (2, 4), (4, 8)]:
        r = solve(m, n, mode='plane_stress', L=40.0, d_eps=D_EPS, nx_per_h=npx, ny1=ny, ny2=ny)
        out.append(f"dx=h/{npx},ny={ny}/layer: {r['kappa']/D_EPS/f_closed(m,n)-1:+.2e} (ndof {r['ndof']})")
    lines.append(f"  m={m:.4f} n={n}: " + " | ".join(out))

# sagitta measurement: patch solve() to return nodal uy; do it directly
def sagitta(m, n, L, mode='plane_stress', nu=0.3):
    mesh, h1, h2 = build_mesh(m, L, 2, 4, 4)
    # re-run solve internals through a small wrapper: use solve's fit result for the window and
    # compute the end deflection with a second assembly by calling solve with fit_frac=1.0 and reading
    r = solve(m, n, mode=mode, L=L, nu1=nu, nu2=nu, d_eps=D_EPS, fit_frac=0.5)
    return r

import types
# Minimal re-implementation returning the mid-line end deflection: reuse fem2d.solve with a hook
src = open(fem2d.__file__).read()
# expose uy, px, py by adding to the result dict (kept local; the repository file stays untouched)
src = src.replace("    res['ndof'] = K.shape[0]", "    res['ndof'] = K.shape[0]\n    res['_px'] = px; res['_py'] = py; res['_uy'] = uy")
ns_ = {}
exec(compile(src, 'fem2d_hooked', 'exec'), ns_)
solve_h = ns_['solve']

lines.append("\n(b) length study, plane stress. 'window' = central fit; 'sagitta' = 8*(uy(end)-uy(mid))/L^2 averaged over top/bottom")
lines.append("   case                 L/h   window/f-1    sagitta/f-1")
worst = (0, None)
for (m, n) in [(1, 1), (10 ** -0.5, 10), (0.05, 10), (20, 50), (2, 5)]:
    for Lh in [5, 10, 20, 40, 80]:
        r = solve_h(m, n, mode='plane_stress', L=float(Lh), d_eps=D_EPS, fit_frac=0.5)
        px, py, uy = r['_px'], r['_py'], r['_uy']
        vals = []
        for yc in (0.0, 1.0):
            sel = np.isclose(py, yc)
            xs = px[sel]; ys = uy[sel]
            d = ys[np.argmax(xs)] - ys[np.argmin(xs)]
            vals.append(8 * d / Lh ** 2)
        sag = np.mean(vals)
        f = f_closed(m, n)
        lines.append(f"   m={m:<7.4f} n={n:<3}      {Lh:>3}   {r['kappa']/D_EPS/f-1:+.2e}   {sag/D_EPS/f-1:+.2e}")
        if abs(sag / D_EPS / f - 1) > worst[0]:
            worst = (abs(sag / D_EPS / f - 1), (m, n, Lh))
lines.append(f"\nlargest sagitta-vs-Timoshenko deviation in this table: {worst[0]:.2e} at (m,n,L/h) = {worst[1]}")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s03_output.txt", "w").write(txt + "\n")
