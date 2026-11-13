"""Run the authors' lumen_vm.py (MIT) once at one published setting and compare with the published sweep.
Usage: python -P 03_run_lumen_vm.py CODE_DIR WORK_DIR [SEED]
CODE_DIR contains lumen_vm.py (downloaded by 04_fetch_code.sh); WORK_DIR is scratch (grow_cyst writes .pick files there).
Needs numpy, scipy, matplotlib (Agg backend). One process, single thread.
"""
import sys, os, time, glob, pickle, json, math
import matplotlib
matplotlib.use("Agg")
import numpy as np
code, work = sys.argv[1], sys.argv[2]
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
os.makedirs(work, exist_ok=True)
sys.path.insert(0, code)
os.chdir(work)
# lumen_vm.py (2021) calls np.cross on 2-vectors, which NumPy >= 2.0 rejects (it needs 3-vectors). Shim: 2D cross = z-component,
# identical to what NumPy 1.x returned. Nothing else in the authors' file is changed.
_cross = np.cross
def _cross2(a, b, *args, **kw):
    a = np.asarray(a); b = np.asarray(b)
    if a.shape[-1] == 2 and b.shape[-1] == 2:
        return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]
    return _cross(a, b, *args, **kw)
np.cross = _cross2
import lumen_vm as L
np.random.seed(seed)
params = {"P_lumen": 1.0, "k": 1.0, "l_a": 0.6, "l_b": 1.6, "l_l": 0, "jitter": 0.05}   # sweep family (l_l,l_b,P,k)=(0,1.6,1.0,1.0), la0=0.6; jitter=0.05 is MY choice: the default jitter=0 gives A0=nan forever (see 03b)
t = time.time()
status = "ok"
try:
    L.grow_cyst(params, stretched=False)
except NameError as e:
    status = "NameError: %s" % e
    # lumen_vm.py uses os.path without importing os; inject it and retry (this is the only change)
    L.os = os
    L.grow_cyst(params, stretched=False)
dirs = glob.glob("growing_lvms_*")
out = []
for f in sorted(glob.glob(dirs[0] + "/*.pick")):
    m = L.LumenVertexModel.from_file(f)   # classmethod: returns the unpickled object
    n = m.n_cells if hasattr(m, "n_cells") else None
    out.append(dict(file=f, n=n, lumen_area=float(m.lumen_area()), lumen_perim=float(m.lumen_perim()), ipq=float(m.lumen_IPQ())))
json.dump(dict(status=status, seconds=round(time.time() - t, 1), n_saved=len(out), rows=out), open(os.path.join(os.path.dirname(os.path.abspath(work)), 'run1.json') if False else 'run.json', 'w'), indent=1)
print(json.dumps(dict(status=status, seconds=round(time.time() - t, 1), n_saved=len(out), rows=out), indent=1))
