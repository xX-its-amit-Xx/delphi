import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
print('pitch ratios at psi15 KL1.73 under nuisance (U5/U15, U25/U15):')
for name,kw in [('base',{}),('camber 0',{'camber':0.}),('camber 5',{'camber':5.}),('CD reg 1.5',{'reg':1.5}),('CD reg 3',{'reg':3.}),('chord 13.5',{'chord':.0135}),('chord 16.5',{'chord':.0165})]:
    b=bem.eq(15,1.73,pitch=15.,**kw)[0]
    print('  %-10s %.3f  %.3f'%(name,bem.eq(15,1.73,pitch=5.,**kw)[0]/b,bem.eq(15,1.73,pitch=25.,**kw)[0]/b))
print('pitch-offset sensitivity (printing error): printed pitch p_true, BEM U(p)/U(15) at psi15 KL1.73')
for p in (3,5,7,9,11,13,15,17,19,21,23,25,27):
    print('  pitch %2d: %.3f'%(p, bem.eq(15,1.73,pitch=float(p))[0]/bem.eq(15,1.73,pitch=15.)[0]))
print('alpha (deg) along span incl. camber at equilibrium; C_L peak at alpha=%.1f deg, C_D=max at %.0f deg' % ((90+7.2)/2.13, (180+9.82)/2.04))
g=bem.wing(15,1.73)
for p in (5,15,25):
    Re,St=bem.eq(15,1.73,pitch=float(p)); U=Re*1e-6/.06
    a=bem.forces(U,St*U/.06,g,pitch=float(p))[2]+2.5
    print('  pitch %2d alpha min %.1f max %.1f mean %.1f ; CL/CD at mean alpha %.2f'%(p,a.min(),a.max(),a.mean(), bem.CL(a.mean())/bem.CD(a.mean())))
# how stable is the pitch-5 equilibrium (second root?) and spin-up
for p in (0,2,5,8,15):
    print('  pitch',p,[(round(x[0]),round(x[1],3),x[2]) for x in bem.equilibria(15,1.73,pitch=float(p),st_lo=0.005,st_hi=3.0,nscan=1200)])
