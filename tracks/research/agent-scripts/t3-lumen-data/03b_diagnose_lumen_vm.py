"""Diagnose why grow_cyst() does not return: build LumenVertexModel(3, ...) a few times and print A0 and timing.
Usage: python -P 03b_diagnose_lumen_vm.py CODE_DIR"""
import sys, time, warnings
import matplotlib; matplotlib.use("Agg")
import numpy as np
warnings.simplefilter("ignore")
_c = np.cross
def _c2(a, b, *x, **k):
    a = np.asarray(a); b = np.asarray(b)
    return a[..., 0]*b[..., 1]-a[..., 1]*b[..., 0] if a.shape[-1] == 2 and b.shape[-1] == 2 else _c(a, b, *x, **k)
np.cross = _c2
sys.path.insert(0, sys.argv[1])
import lumen_vm as L
np.random.seed(1)
params = {"P_lumen": 1.0, "k": 1.0, "l_a": 0.6, "l_b": 1.6, "l_l": 0}
for jit in (0.0, 0.05):
    for i in range(3):
        t = time.time()
        m = L.LumenVertexModel(3, jitter=jit, **params)
        print("jitter", jit, "try", i, "A0", m.A0, "E", m.pressure_tension_energy(), "s", round(time.time()-t, 2), flush=True)
