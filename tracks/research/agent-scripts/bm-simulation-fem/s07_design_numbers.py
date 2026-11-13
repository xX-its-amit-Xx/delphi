"""s07: what the verified law says for candidate Formlabs pairs (illustration, inputs from the project record).

INPUTS (not measured by this script; taken from project-record files, estimates flagged):
  Rigid 10K tensile modulus ~10.5 GPa (spec-formlabs-materials.json: 10-11 GPa post-cured)
  Flexible 80A V2 secant modulus ~5.8 MPa = 2.9 MPa / 0.5 (spec-formlabs-materials.json, own estimate, NOT a published modulus)
  Flexible 80A V2 swelling, isotropic linear strain from +3% / +7% volume: 0.99% (1 day), 2.28% (1 week)
     (bm-resin-water-uptake-data.json, own arithmetic from Formlabs data sheet values)
  Form 4 minimum supported wall 0.2 mm (spec-formlabs-materials.json)
For a soft active layer (E1 = n E2, n << 1) over a stiff passive layer we compute m, f, curvature and bend radius,
and the plane-strain (very wide sheet held cylindrical) factor (1+nu1) with nu1=0.49.
"""
import _env
import numpy as np
from fem2d import f_closed

E_rigid, E_soft = 10500.0, 5.8  # MPa
n = E_soft / E_rigid
lines = [f"n = E_soft/E_rigid = {n:.3e} (1/n = {1/n:.0f}); optimum soft/stiff thickness ratio m* = n^-0.5 = {n**-0.5:.1f}; f max = {f_closed(n**-0.5, n):.6f}"]
lines.append("stiff layer t_s [mm], soft layer t_a [mm], total h [mm], m=t_a/t_s, f, kappa*h/d_eps; R [mm] at d_eps=0.99% (1 day) and 2.28% (1 week); plane-strain R (x1/1.49)")
for ts in [0.05, 0.1, 0.2, 0.4]:
    for ta in [0.5, 1.0, 2.0, 4.0, n ** -0.5 * ts]:
        h = ts + ta
        m = ta / ts
        f = f_closed(m, n)
        R1 = h / (f * 0.0099); R7 = h / (f * 0.0228)
        lines.append(f"ts={ts:<5.3f} ta={ta:<6.3f} h={h:<6.3f} m={m:<7.2f} f={f:<7.4f} R1d={R1:<8.1f} R1w={R7:<8.1f} planestrain R1d={R1/1.49:<8.1f}")
lines.append("")
lines.append("Reading: with a >1000:1 stiffness contrast the 3/2 ceiling needs the stiff layer to be ~2% of the total thickness; "
             "at the Form 4 minimum supported wall (0.2 mm) that means a ~8.7 mm total strip. A thin total strip with a 0.2 mm stiff layer "
             "(h = 0.7 mm, m = 2.5) reaches only f = 0.096, i.e. 6% of the ceiling. 'planestrain' = very wide sheet held cylindrical, approx. R/(1+nu1), nu1 = 0.49 (assumed).")
ts = 0.2
lines.append(f"stiff layer 0.2 mm -> optimal total thickness h* = ts*(1+m*) = {ts*(1+n**-0.5):.2f} mm")
txt = "\n".join(lines)
print(txt)
open(_env.OUT + r"\s07_output.txt", "w").write(txt + "\n")
