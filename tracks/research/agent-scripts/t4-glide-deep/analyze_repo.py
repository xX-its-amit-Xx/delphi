"""Reproduces the numbers quoted from the Fauli/Rabault/Carlson repository.
Run:  python analyze_repo.py   (reads the zip extracted under D:/Users/ashenoy00000/delphi-work/data/t4-glide-repo/x)
Uses a restricted unpickler (only numpy array reconstruction allowed) because the pickles are untrusted data."""
import pickle, importlib, glob, hashlib, json, sys
import numpy as np
M=glob.glob('D:/Users/ashenoy00000/delphi-work/data/t4-glide-repo/x/Effect*/model/')[0]
ALLOW={('numpy.core.multiarray','_reconstruct'),('numpy.core.multiarray','scalar'),('numpy','ndarray'),('numpy','dtype'),('numpy._core.multiarray','_reconstruct'),('numpy._core.multiarray','scalar')}
class U(pickle.Unpickler):
    def find_class(self, module, name):
        if (module,name) in ALLOW:
            return getattr(importlib.import_module(module.replace('numpy.core','numpy._core')),name)
        raise pickle.UnpicklingError('blocked %s.%s'%(module,name))
def load(fn): return U(open(M+fn,'rb'),encoding='latin1').load()
out={}
print('== sha256 of kept files')
for fn in ['all_results_experiments.pkl','model_data_psi_0.pkl','model_data_camber_psi_15.0.pkl','model_data_psi_35.pkl']:
    print(' ',fn,hashlib.sha256(open(M+fn,'rb').read()).hexdigest()[:16])
print('== experiments (all_results_experiments.pkl): psi, KL=60mm/radius, mass key g, n, mean U m/s, mean f Hz, St=f*0.06/U')
d=load('all_results_experiments.pkl')
rows=[]
for psi in sorted(d):
    for rc in sorted(d[psi]):
        KL=60.0/(1000.0 if rc==10000 else rc)
        for w in sorted(d[psi][rc]):
            reps=d[psi][rc][w]
            us=[float(reps[i]['u mean']) for i in reps]; fs=[float(reps[i]['f mean']) for i in reps]
            rows.append((psi,KL,w,len(us),np.mean(us),np.mean(fs)))
for r in rows:
    if abs(float(r[2])-2.16)<1e-6 or True:
        pass
wset=sorted({r[2] for r in rows}); print(' mass keys present:',wset)
for r in rows:
    if abs(float(r[2])-2.16)<1e-6:
        print(' psi=%s KL=%.2f m=%s n=%d U=%.4f f=%.3f St=%.2f'%(r[0],r[1],r[2],r[3],r[4],r[5],r[5]*0.06/r[4]))
print('== blade-element model minimum |Re| (model files)')
for fn in ['model_data_psi_0.pkl','model_data_camber_psi_15.0.pkl','model_data_psi_35.pkl']:
    m=load(fn); KL=np.array(m['KL'],float); Re=np.abs(np.array(m['Re'],float)); St=np.array(m['St'],float)
    i=int(np.argmin(Re)); U_=Re[i]*1e-6/0.06; f=St[i]*U_/0.06
    print(' %s: min Re=%.0f at KL=%.2f, St=%.3f -> U=Re*nu/L=%.4f m/s (nu=1e-6, L=0.06), f=St*U/L=%.3f Hz'%(fn,Re[i],KL[i],St[i],U_,f))
