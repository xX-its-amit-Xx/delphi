"""s05: large-deflection (von Karman) Ritz study: width, anticlastic/synclastic curvature, cylinder switch.

For L/h = 20 and 40, several widths and swelling strains, find stationary shapes from three
starting guesses (sphere, cylinder bending along the length x, cylinder bending across the width y),
and report curvature along the length relative to Timoshenko f*d_eps/h, the curvature across the
width, the total energy and whether the point is a true minimum (smallest Hessian eigenvalue > 0).
Trial space: even polynomials, in-plane degree 4, deflection degree 4 (s05b compares degree 2/3/4).
Parameter lam = f*d_eps*w^2/h^2 (dimensionless width: strip width squared times curvature over thickness).
"""
import _env
import csv, sys
import numpy as np
from ritz_vk import Ritz, f_closed, clt_free_curvature

CASES = {
    'equalE_m1':   dict(m=1.0, n=1.0, nu1=0.30, nu2=0.30),
    'n10_opt':     dict(m=10 ** -0.5, n=10.0, nu1=0.30, nu2=0.30),
    'n10_opt_soft': dict(m=10 ** -0.5, n=10.0, nu1=0.49, nu2=0.35),
}
LH = [40.0]  # w <= L so that 'strip' means the length is the long side; rotation f*d_eps*L/2h <= 0.3 rad
WS = [2, 4, 8, 12, 16, 24, 32]
EPS = [1e-4, 1e-3, 3e-3, 1e-2]

def classify(s):
    # an equilibrium is a true minimum iff all Hessian eigenvalues > 0
    return 'min' if s['lam_min'] > 1e-12 else 'saddle'

rows = []
for cname, c in CASES.items():
    f = f_closed(c['m'], c['n'])
    for L in LH:
        for w in WS:
            for eps in EPS:
                R = Ritz(c['m'], c['n'], c['nu1'], c['nu2'], eps, L / 2, w / 2, Pu=4, Pw=4, ng=16)
                found = []
                for tag, (c1, c2) in {'sphere': (f * eps, f * eps),
                                      'cyl_x': ((1 + c['nu1']) * f * eps, 0.0),
                                      'cyl_y': (0.0, (1 + c['nu1']) * f * eps)}.items():
                    s = R.solve(c1, c2, eps)
                    g0 = np.linalg.norm(R.grad(np.zeros(R.N)))
                    if s['gnorm'] > 1e-8 * g0:  # not converged
                        continue
                    key = (round(s['c1'] / (f * eps), 4), round(s['c2'] / (f * eps), 4))
                    if any(abs(k[0] - key[0]) < 1e-3 and abs(k[1] - key[1]) < 1e-3 for k, _ in found):
                        continue
                    found.append((key, (tag, s)))
                emin = min(s['E'] for _, (_, s) in found)
                for key, (tag, s) in found:
                    rows.append(dict(case=cname, L_over_h=L, w_over_h=w, d_eps=eps, lam=f * eps * w * w,
                                     start=tag, kx_over_ftim=key[0], ky_over_ftim=key[1], energy=s['E'],
                                     kind=classify(s), is_lowest=bool(abs(s['E'] - emin) < 1e-12 * max(1, abs(emin)) + 1e-9 * abs(emin))))
with open(_env.OUT + r"\s05_nonlinear.csv", "w", newline="") as fh:
    wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)

lines = ["Von Karman Ritz study (stationary shapes). kx = curvature along the length, ky across the width, both divided by Timoshenko f*d_eps/h",
         "kind = min (stable) or saddle (unstable). 'lowest' = lowest-energy stationary shape found.\n"]
for cname in CASES:
    for L in LH:
        lines.append(f"[{cname}] L/h={L:.0f}")
        lines.append("  d_eps   w/h   lam    shape found (kx/f, ky/f, kind)")
        for eps in EPS:
            for w in WS:
                sub = [r for r in rows if r['case'] == cname and r['L_over_h'] == L and r['d_eps'] == eps and r['w_over_h'] == w]
                desc = "; ".join(f"({r['kx_over_ftim']:.3f},{r['ky_over_ftim']:.3f},{r['kind']}{'*' if r['is_lowest'] else ''})" for r in sub)
                lines.append(f"  {eps:<7g} {w:<5} {sub[0]['lam']:<7.3f} {desc}")
        lines.append("")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s05_output.txt", "w").write(txt + "\n")
