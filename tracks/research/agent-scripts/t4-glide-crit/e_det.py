import sys, os, json, hashlib; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
FZ = 'D:/Users/ashenoy00000/delphi-work/agents/scratch/design-glide/frozen_predictions.json'
print('frozen json sha256', hashlib.sha256(open(FZ,'rb').read()).hexdigest())
fz = json.load(open(FZ))['rows']
print('--- 1. re-derive every frozen BEM and disk ratio from bem.py (tolerance 1e-3)')
ref = bem.eq(35,1.2)[0]; rref = rmax(35,1.2); bad = 0
for r in fz:
    Re,St = bem.eq(r['psi_deg'], r['KL'], pitch=float(r['pitch_deg']))
    b = Re/ref; dk = rref/rmax(r['psi_deg'], r['KL'])
    # pitch-5/25 rows are ratios to the PITCH-15 control, as stored
    ok = abs(b-r['bem_ratio_to_control'])<1e-3 and abs(dk-r['disk_ratio_to_control'])<1e-3
    bad += (not ok)
    print(' psi %2d KL %.2f p %2d  BEM %.4f (stored %.4f)  disk %.4f (stored %.4f) %s'%(r['psi_deg'],r['KL'],r['pitch_deg'],b,r['bem_ratio_to_control'],dk,r['disk_ratio_to_control'],'OK' if ok else 'MISMATCH'))
print('mismatches:', bad)
print('--- 2. G1 arithmetic')
G=9.81; A=np.pi*rref**2; U12=ref*1e-6/0.06
print(' Rmax %.5f A %.5f U12 %.5f BEM Ceff %.4f' % (rref, A, U12, 2*0.0012*G/(1000*U12**2*A)))
mnet=(2.16+0.68)*(1-1/11.34)/1000
print(' net mass %.4f g ; rival Ceff %.4f' % (mnet*1e3, 2*mnet*G/(1000*0.0676**2*A)))
print(' BEM U if loaded to 2.59 g: %.4f m/s vs data 0.0676 -> BEM/data = %.3f' % (U12*np.sqrt(mnet/0.0012), U12*np.sqrt(mnet/0.0012)/0.0676))
print(' nuisance band of BEM Ceff (control, C_eff = 2 m g/(rho U^2 A), m=1.2 g):')
for name,kw in [('base',{}),('camber 0',{'camber':0.}),('camber 5',{'camber':5.}),('CD reg 1.5',{'reg':1.5}),('CD reg 3',{'reg':3.}),('pitch 12',{'pitch':12.}),('pitch 18',{'pitch':18.}),('chord 13.5',{'chord':.0135}),('chord 16.5',{'chord':.0165})]:
    Re,St=bem.eq(35,1.2,**kw); U=Re*1e-6/.06
    print('   %-11s Re %.0f  Ceff %.3f  St %.3f' % (name, Re, 2*0.0012*G/(1000*U**2*A), St))
print('--- 3. disk vs BEM predictions on the six G3 ratios (deterministic)')
kls=[0.95,1.34,1.73,2.11,2.50,2.89]
b=np.array([bem.eq(15,k)[0] for k in kls]); dk=np.array([1/rmax(15,k) for k in kls])
b/=b[2]; dk/=dk[2]
print(' BEM ', np.round(b,3)); print(' disk', np.round(dk,3)); print(' RMS log(BEM/disk) over six: %.3f (over five non-reference: %.3f); threshold 0.10'%(np.sqrt(np.mean(np.log(b/dk)**2)), np.sqrt(np.sum(np.log(b/dk)**2)/5)))
from scipy.optimize import minimize_scalar
for psi in (15,):
    r=minimize_scalar(lambda k:-rmax(psi,k),bounds=(0.05,3.5),method='bounded'); print(' disk-rule optimum KL at psi=15: %.3f (window 1.45-2.10)'%r.x)
print(' G3 St window 0.50-0.74 vs BEM 0.616: -%.0f%% / +%.0f%%' % (100*(1-0.5/0.616), 100*(0.74/0.616-1)))
print('--- 4. G5/G6 numbers')
for k in (0.6,0.95,1.34):
    print(' psi55 KL %.2f Rmax %.4f swept diameter %.4f m  BEM %.4f disk %.4f' % (k, rmax(55,k), 2*rmax(55,k), bem.eq(55,k)[0]/ref, rref/rmax(55,k)))
psis=np.array([0,5,10,15,20,25,35,45,55,65,75.]); kopt=np.array([2.078,1.978,1.877,1.772,1.665,1.556,1.331,1.098,.860,.617,.372])
print(' BEM KLopt fit over psi 0-55: slope %.4f intercept %.3f ; over 0-75: slope %.4f int %.3f'%(*np.polyfit(psis[:9],kopt[:9],1),*np.polyfit(psis,kopt,1)))
dk_opt=[]
for psi in (0,15,35,55):
    r=minimize_scalar(lambda k:-rmax(psi,k),bounds=(0.05,3.5),method='bounded'); dk_opt.append(r.x)
print(' disk-rule KLopt at psi 0,15,35,55:', np.round(dk_opt,3), 'slope %.4f'%np.polyfit([0,15,35,55],dk_opt,1)[0])
# wall blockage
for lab,psi,k,w in [('control in 25 cm cylinder',35,1.2,0.25),('control in 40 cm square',35,1.2,0.40),('psi55 KL.95 in 40 cm square',55,.95,.40),('psi55 KL.95 in 25 cm cyl',55,.95,.25)]:
    area = np.pi*(w/2)**2 if 'cyl' in lab else w*w
    print(' blockage %-30s swept disk / tank section = %.3f' % (lab, np.pi*rmax(psi,k)**2/area))
