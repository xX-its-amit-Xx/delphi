import sys, pickle, importlib, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bem
MODEL = 'D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-glide/dl/gh_fold/EffectFoldAngleAutorotatingSeeds-master/model/'
ALLOW = {('numpy.core.multiarray', '_reconstruct'), ('numpy.core.multiarray', 'scalar'), ('numpy', 'ndarray'), ('numpy', 'dtype')}
class U(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) in ALLOW:
            return getattr(importlib.import_module(module.replace('numpy.core', 'numpy._core')), name)
        raise pickle.UnpicklingError('blocked %s.%s' % (module, name))
def load(name):
    return U(open(MODEL + name, 'rb'), encoding='latin1').load()
def rmax(psi, k):
    return float(bem.wing(psi, k)[0].max())
