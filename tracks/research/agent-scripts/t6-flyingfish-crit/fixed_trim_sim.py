# Fixed-trim (constant CL) launches of the printed-glider placeholder (m=.03 kg, S=.0127 m2, L3 polar), h0=1 m.
# Imports the integrator from lofted_sim.py (same folder). Shows what an uncontrolled catapult launch does vs bound M3.
import math, importlib.util, sys, os
spec=importlib.util.spec_from_file_location("ls",os.path.join(os.path.dirname(os.path.abspath(__file__)),"lofted_sim.py"))
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    ls=importlib.util.module_from_spec(spec); sys.modules["ls"]=ls
    src=open(spec.origin).read().split("import sys")[0]   # only definitions, not the case loop
    exec(src, ls.__dict__)
m,S,h0=0.03,0.0127,1.0
for v0 in (7.5,8,10,12):
    b,bnf,vm=ls.M3(m,S,v0,h0)
    rows=[]
    for gam in (0,5,10,15):
        for cl in (0.1,0.2,0.3,0.4,0.48,0.6,0.78):
            rows.append((ls.fly(m,S,v0,h0,gam,[cl]),gam,cl))
    x,gam,cl=max(rows)
    print(f"v0={v0}: best fixed-CL launch x={x:.2f} m (gamma0 {gam}, CL {cl}); M3 bound {b:.2f}; ratio {x/b:.2f}; no-floor bound {bnf:.2f}")
