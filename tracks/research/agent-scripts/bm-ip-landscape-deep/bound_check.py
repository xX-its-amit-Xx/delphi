"""Own calculation: minimum differential free strain implied by a measured curvature change, using the project-record ceiling
kappa*h/d_eps <= 3/2 (Timoshenko factor f(m,n) <= 3/2). Source numbers: WO2018033422A1 description (Google Patents page):
beech 4 mm + spruce 0.8 mm, 85%->35% RH, change in curvature 0.00818 mm^-1 (homogeneous), 0.00971 (horizontal strips), 0.01011 (diagonal).
Also evaluates f(m,n) at the patent's thickness ratio to see where it sits relative to the ceiling for plausible n.
Run: python -I bound_check.py"""
import json
def f(m, n):  # project-record formula
    return 6*(1+m)**2/(3*(1+m)**2 + (1+m*n)*(m**2 + 1/(m*n)))
h = 4.0 + 0.8
out = {}
for name, dk in [("homogeneous", 0.00818), ("horizontal strips", 0.00971), ("diagonal strips", 0.01011)]:
    out[name] = {"dkappa_per_mm": dk, "h_mm": h, "min_d_eps": dk*h/1.5, "arithmetic": f"{dk}*{h}/1.5"}
m = 0.8/4.0  # passive/active thickness ratio as in the patent text (0.2)
tab = {}
for n in [0.5, 1, 5/ (m*m) /5, 10, 25, 1/(m*m)]:
    tab[f"n={n:.3g}"] = round(f(m, n), 4)
out["f_at_m_0.2"] = tab
out["ceiling_at_m2n=1_n"] = 1/(m*m)
out["f_at_ceiling"] = f(m, 1/(m*m))
print(json.dumps(out, indent=1))
