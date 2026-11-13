# Minimum launch speed for a 50 m single flight, fish L3 polar, h0=0, no ground effect, by random-search optimal control (lower bound on what is achievable)
import io, contextlib, sys, os, importlib.util
spec=importlib.util.spec_from_file_location("ls",os.path.join(os.path.dirname(os.path.abspath(__file__)),"lofted_sim.py"))
ls=importlib.util.module_from_spec(spec); src=open(spec.origin).read().split("import sys")[0]
with contextlib.redirect_stdout(io.StringIO()): exec(src, ls.__dict__)
for v0 in (14,15,16,17,17.9):
    x,gam,cls=ls.run(0.06,0.012688,v0,0.0,n=1500)
    print(f"v0={v0}: best x={x:.1f} m (gamma0 {gam:.1f}); floor-bound x<= {ls.M3(0.06,0.012688,v0,0)[0]:.1f}; no-floor bound {ls.M3(0.06,0.012688,v0,0)[1]:.1f}")
